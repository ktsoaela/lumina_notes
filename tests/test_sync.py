"""Sync API tests: GET /api/sync/changes, POST /api/sync/push (+ legacy-route compatibility).

Runs against a temp SQLite DB. Set LUMINA_TEST_PG_URL=postgresql://... to also run on Postgres.
"""
from __future__ import annotations

import os
import tempfile
import time
import unittest
import uuid
from pathlib import Path


def _reload_app(env: dict[str, str | None]):
    for k, v in env.items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = v
    import importlib

    import db as db_module
    import app as app_module

    importlib.reload(db_module)
    importlib.reload(app_module)
    return app_module


class SyncApiTestsSqlite(unittest.TestCase):
    pg_url: str | None = None

    @classmethod
    def setUpClass(cls) -> None:
        cls._tmpdir = tempfile.TemporaryDirectory()
        env = {
            "DATABASE_PATH": str(Path(cls._tmpdir.name) / "sync.sqlite"),
            "DATABASE_URL": cls.pg_url,
            "LUMINA_ENV": "development",
            "JWT_SECRET": "test-jwt-secret-not-for-prod",
            "SEED_DEMO_USER": "0",
            "ENABLE_DOCS": "0",
            "AUTH_RATE_LIMIT": "1000",
        }
        app_module = _reload_app(env)
        from fastapi.testclient import TestClient

        cls._cm = TestClient(app_module.app)
        cls.client = cls._cm.__enter__()

    @classmethod
    def tearDownClass(cls) -> None:
        cls._cm.__exit__(None, None, None)
        cls._tmpdir.cleanup()
        os.environ.pop("DATABASE_URL", None)

    # ------------------------------------------------------------ helpers

    def _user(self) -> tuple[dict[str, str], str]:
        tag = uuid.uuid4().hex[:10]
        res = self.client.post(
            "/api/auth/signup",
            json={"email": f"u{tag}@example.com", "password": "secret12", "name": "U"},
        )
        self.assertEqual(res.status_code, 200, res.text)
        body = res.json()
        h = {"Authorization": f"Bearer {body['token']}"}
        shelf = f"bs-{body['user']['id']}-default"
        return h, shelf

    def _tree(self, h: dict[str, str], shelf: str) -> tuple[str, str, str]:
        tag = uuid.uuid4().hex[:8]
        nb, sec, page = f"nb-{tag}", f"sec-{tag}", f"page-{tag}"
        r = self.client.post("/api/notebooks", headers=h, json={"id": nb, "name": "Book", "bookshelfId": shelf})
        self.assertEqual(r.status_code, 200, r.text)
        r = self.client.post("/api/sections", headers=h, json={"id": sec, "notebookId": nb, "name": "Ch"})
        self.assertEqual(r.status_code, 200, r.text)
        r = self.client.post(
            "/api/pages", headers=h, json={"id": page, "sectionId": sec, "title": "P", "content": "c"}
        )
        self.assertEqual(r.status_code, 200, r.text)
        return nb, sec, page

    def _changes(self, h: dict[str, str], since: str = "") -> dict:
        r = self.client.get("/api/sync/changes", headers=h, params={"since": since})
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()

    def _push(self, h: dict[str, str], ops: list[dict]) -> list[dict]:
        r = self.client.post("/api/sync/push", headers=h, json={"ops": ops})
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()["results"]

    @staticmethod
    def _op(entity: str, id_: str, data: dict | None = None, *, op: str = "upsert", at: str | None = None) -> dict:
        return {
            "opId": uuid.uuid4().hex,
            "entity": entity,
            "op": op,
            "id": id_,
            "clientUpdatedAt": at or "2999-01-01T00:00:00.000Z",
            "data": data,
        }

    # ------------------------------------------------------------ changes

    def test_changes_full_then_incremental(self) -> None:
        h, shelf = self._user()
        nb, sec, page = self._tree(h, shelf)
        full = self._changes(h)
        self.assertIn(shelf, [b["id"] for b in full["bookshelves"]])
        self.assertIn(nb, [n["id"] for n in full["notebooks"]])
        self.assertIn(sec, [s["id"] for s in full["sections"]])
        pg = next(p for p in full["pages"] if p["id"] == page)
        self.assertEqual(pg["content"], "c")
        self.assertTrue(pg["updatedAt"].endswith("Z"))
        self.assertTrue(full["cursor"].endswith("Z"))

        time.sleep(0.05)
        r = self.client.put(f"/api/notebooks/{nb}", headers=h, json={"name": "Renamed"})
        self.assertEqual(r.status_code, 200)
        inc = self._changes(h, full["cursor"])
        names = {n["id"]: n["name"] for n in inc["notebooks"]}
        self.assertEqual(names.get(nb), "Renamed")

    def test_changes_are_per_user(self) -> None:
        h1, s1 = self._user()
        h2, _ = self._user()
        nb, _, _ = self._tree(h1, s1)
        other = self._changes(h2)
        self.assertNotIn(nb, [n["id"] for n in other["notebooks"]])

    def test_changes_include_archived_notebooks(self) -> None:
        h, shelf = self._user()
        nb, _, _ = self._tree(h, shelf)
        self.client.patch(f"/api/notebooks/{nb}/archive", headers=h, json={"archived": True})
        row = next(n for n in self._changes(h)["notebooks"] if n["id"] == nb)
        self.assertIs(row["archived"], True)

    def test_legacy_put_page_still_returns_same_shape(self) -> None:
        h, shelf = self._user()
        _, _, page = self._tree(h, shelf)
        r = self.client.put(f"/api/pages/{page}", headers=h, json={"title": "T2", "content": "x"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"id": page, "title": "T2", "content": "x"})

    def test_delete_notebook_writes_tombstones_for_sections_and_pages(self) -> None:
        h, shelf = self._user()
        nb, sec, page = self._tree(h, shelf)
        cursor = self._changes(h)["cursor"]
        r = self.client.delete(f"/api/notebooks/{nb}", headers=h)
        self.assertEqual(r.status_code, 204)
        tomb = {(t["entity"], t["id"]) for t in self._changes(h, cursor)["tombstones"]}
        self.assertTrue({("notebook", nb), ("section", sec), ("page", page)} <= tomb, tomb)

    def test_wipe_user_data_writes_tombstones(self) -> None:
        h, shelf = self._user()
        nb, _, page = self._tree(h, shelf)
        self.client.delete("/api/user/data", headers=h)
        tomb = {(t["entity"], t["id"]) for t in self._changes(h)["tombstones"]}
        self.assertIn(("notebook", nb), tomb)
        self.assertIn(("page", page), tomb)

    # ------------------------------------------------------------ push

    def test_push_upsert_creates_page_visible_to_legacy_list(self) -> None:
        h, shelf = self._user()
        _, sec, _ = self._tree(h, shelf)
        res = self._push(h, [self._op("page", "page-m1", {"sectionId": sec, "title": "Mobile", "content": "# hi"})])
        self.assertEqual(res[0]["status"], "applied", res)
        listed = self.client.get(f"/api/pages/{sec}", headers=h).json()
        self.assertIn("page-m1", [p["id"] for p in listed])

    def test_push_creates_whole_tree_in_order(self) -> None:
        h, shelf = self._user()
        ops = [
            self._op("bookshelf", "bs-m", {"name": "Phone shelf"}),
            self._op("notebook", "nb-m", {"bookshelfId": "bs-m", "name": "N", "archived": False}),
            self._op("section", "sec-m", {"notebookId": "nb-m", "name": "S"}),
            self._op("page", "page-m", {"sectionId": "sec-m", "title": "P", "content": "x"}),
        ]
        self.assertEqual([r["status"] for r in self._push(h, ops)], ["applied"] * 4)
        notebooks = self.client.get("/api/notebooks", headers=h, params={"bookshelfId": "bs-m"}).json()
        self.assertEqual([n["id"] for n in notebooks], ["nb-m"])

    def test_push_upsert_is_idempotent(self) -> None:
        h, shelf = self._user()
        _, sec, _ = self._tree(h, shelf)
        op = self._op("page", "page-idem", {"sectionId": sec, "title": "T", "content": "x"})
        self.assertEqual(self._push(h, [op])[0]["status"], "applied")
        self.assertEqual(self._push(h, [op])[0]["status"], "applied")
        listed = self.client.get(f"/api/pages/{sec}", headers=h).json()
        self.assertEqual(sum(1 for p in listed if p["id"] == "page-idem"), 1)

    def test_push_stale_returns_current(self) -> None:
        h, shelf = self._user()
        _, _, page = self._tree(h, shelf)
        self.client.put(f"/api/pages/{page}", headers=h, json={"title": "Desktop", "content": "newer"})
        res = self._push(
            h,
            [self._op("page", page, {"sectionId": "x", "title": "Old", "content": "old"}, at="2000-01-01T00:00:00Z")],
        )
        self.assertEqual(res[0]["status"], "stale")
        self.assertEqual(res[0]["current"]["content"], "newer")
        self.assertEqual(res[0]["current"]["entity"], "page")

    def test_push_newer_wins_over_server(self) -> None:
        h, shelf = self._user()
        _, sec, page = self._tree(h, shelf)
        res = self._push(h, [self._op("page", page, {"sectionId": sec, "title": "Phone", "content": "phone"})])
        self.assertEqual(res[0]["status"], "applied")
        listed = {p["id"]: p for p in self.client.get(f"/api/pages/{sec}", headers=h).json()}
        self.assertEqual(listed[page]["content"], "phone")

    def test_push_child_of_deleted_parent_rejected(self) -> None:
        h, shelf = self._user()
        nb, sec, _ = self._tree(h, shelf)
        self.client.delete(f"/api/notebooks/{nb}", headers=h)
        res = self._push(h, [self._op("page", "page-orphan", {"sectionId": sec, "title": "T", "content": ""})])
        self.assertEqual(res[0]["status"], "rejected")
        self.assertIsNone(res[0]["current"])

    def test_push_other_users_entity_rejected(self) -> None:
        h1, s1 = self._user()
        h2, _ = self._user()
        _, sec, page = self._tree(h1, s1)
        res = self._push(h2, [self._op("page", page, {"sectionId": sec, "title": "Hijack", "content": "x"})])
        self.assertEqual(res[0]["status"], "rejected")
        listed = {p["id"]: p for p in self.client.get(f"/api/pages/{sec}", headers=h1).json()}
        self.assertEqual(listed[page]["title"], "P")
        # Deleting someone else's row is rejected too.
        res = self._push(h2, [self._op("page", page, op="delete")])
        self.assertEqual(res[0]["status"], "rejected")

    def test_push_delete_missing_is_applied(self) -> None:
        h, _ = self._user()
        res = self._push(h, [self._op("page", "page-never", op="delete")])
        self.assertEqual(res[0]["status"], "applied")

    def test_push_delete_cascades_and_tombstones(self) -> None:
        h, shelf = self._user()
        nb, sec, page = self._tree(h, shelf)
        cursor = self._changes(h)["cursor"]
        self.assertEqual(self._push(h, [self._op("notebook", nb, op="delete")])[0]["status"], "applied")
        self.assertEqual(
            self.client.get(f"/api/sections/{nb}", headers=h).status_code, 404
        )
        tomb = {(t["entity"], t["id"]) for t in self._changes(h, cursor)["tombstones"]}
        self.assertIn(("page", page), tomb)
        self.assertIn(("section", sec), tomb)

    def test_push_bookshelf_with_notebooks_delete_rejected(self) -> None:
        h, shelf = self._user()
        self._tree(h, shelf)
        res = self._push(h, [self._op("bookshelf", shelf, op="delete")])
        self.assertEqual(res[0]["status"], "rejected")
        self.assertEqual(res[0]["current"]["id"], shelf)

    def test_push_recreate_clears_tombstone(self) -> None:
        h, shelf = self._user()
        _, sec, page = self._tree(h, shelf)
        self.client.delete(f"/api/pages/{page}", headers=h)
        self._push(h, [self._op("page", page, {"sectionId": sec, "title": "Back", "content": ""})])
        ch = self._changes(h)
        self.assertNotIn(("page", page), {(t["entity"], t["id"]) for t in ch["tombstones"]})
        self.assertIn(page, [p["id"] for p in ch["pages"]])

    def test_push_bad_title_rejected_without_aborting_batch(self) -> None:
        h, shelf = self._user()
        _, sec, _ = self._tree(h, shelf)
        res = self._push(
            h,
            [
                self._op("page", "bad id!", {"sectionId": sec, "title": "T", "content": ""}),
                self._op("section", "sec-noname", {"notebookId": "nb-x", "name": "   "}),
                self._op("page", "page-ok", {"sectionId": sec, "title": "T", "content": ""}),
            ],
        )
        self.assertEqual([r["status"] for r in res], ["rejected", "rejected", "applied"])
        self.assertTrue(res[0]["detail"])

    def test_push_limit(self) -> None:
        h, _ = self._user()
        ops = [self._op("page", f"page-{i}", op="delete") for i in range(501)]
        r = self.client.post("/api/sync/push", headers=h, json={"ops": ops})
        self.assertEqual(r.status_code, 422)

    def test_sync_requires_auth(self) -> None:
        self.assertIn(self.client.get("/api/sync/changes").status_code, (401, 403))
        self.assertIn(self.client.post("/api/sync/push", json={"ops": []}).status_code, (401, 403))


@unittest.skipUnless(os.environ.get("LUMINA_TEST_PG_URL"), "set LUMINA_TEST_PG_URL to run on Postgres")
class SyncApiTestsPostgres(SyncApiTestsSqlite):
    pg_url = os.environ.get("LUMINA_TEST_PG_URL")


if __name__ == "__main__":
    unittest.main()
