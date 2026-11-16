"""FastAPI TestClient integration tests (temp SQLite)."""
from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path


class ApiIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._tmpdir = tempfile.TemporaryDirectory()
        db = Path(cls._tmpdir.name) / "test.sqlite"
        os.environ["DATABASE_PATH"] = str(db)
        os.environ["LUMINA_ENV"] = "development"
        os.environ["JWT_SECRET"] = "test-jwt-secret-not-for-prod"
        os.environ["SEED_DEMO_USER"] = "0"
        os.environ["ENABLE_DOCS"] = "0"
        os.environ["AUTH_RATE_LIMIT"] = "1000"
        import importlib
        import db as db_module
        import app as app_module

        importlib.reload(db_module)
        importlib.reload(app_module)
        cls.app_module = app_module
        from fastapi.testclient import TestClient

        # Context manager runs FastAPI lifespan (init_db)
        cls._cm = TestClient(app_module.app)
        cls.client = cls._cm.__enter__()

    @classmethod
    def tearDownClass(cls) -> None:
        cls._cm.__exit__(None, None, None)
        cls._tmpdir.cleanup()

    def test_health_ok(self) -> None:
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["status"], "ok")
        self.assertEqual(body["database"], "ok")

    def test_swagger_hidden_when_docs_disabled(self) -> None:
        res = self.client.get("/swagger")
        self.assertEqual(res.status_code, 404)

    def test_signup_login_roundtrip_and_jwt_exp(self) -> None:
        signup = self.client.post(
            "/api/auth/signup",
            json={
                "email": "alice@example.com",
                "password": "secret12",
                "name": "Alice",
                "username": "alice",
            },
        )
        self.assertEqual(signup.status_code, 200, signup.text)
        token = signup.json()["token"]
        payload = self.app_module.jwt.decode(
            token,
            self.app_module.JWT_SECRET,
            algorithms=[self.app_module.ALGORITHM],
        )
        self.assertIn("exp", payload)

        me = self.client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["email"], "alice@example.com")

        login = self.client.post(
            "/api/auth/login",
            json={"identifier": "alice", "password": "secret12"},
        )
        self.assertEqual(login.status_code, 200)
        self.assertIn("token", login.json())

    def test_rejects_short_password(self) -> None:
        res = self.client.post(
            "/api/auth/signup",
            json={
                "email": "bob@example.com",
                "password": "short",
                "name": "Bob",
            },
        )
        self.assertEqual(res.status_code, 422)

    def test_change_password(self) -> None:
        signup = self.client.post(
            "/api/auth/signup",
            json={
                "email": "carol@example.com",
                "password": "oldpass1",
                "name": "Carol",
                "username": "carol",
            },
        )
        self.assertEqual(signup.status_code, 200, signup.text)
        token = signup.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        bad = self.client.put(
            "/api/auth/password",
            headers=headers,
            json={"currentPassword": "wrong", "newPassword": "newpass1"},
        )
        self.assertEqual(bad.status_code, 400)

        ok = self.client.put(
            "/api/auth/password",
            headers=headers,
            json={"currentPassword": "oldpass1", "newPassword": "newpass1"},
        )
        self.assertEqual(ok.status_code, 200, ok.text)

        old_login = self.client.post(
            "/api/auth/login",
            json={"identifier": "carol", "password": "oldpass1"},
        )
        self.assertEqual(old_login.status_code, 401)

        new_login = self.client.post(
            "/api/auth/login",
            json={"identifier": "carol", "password": "newpass1"},
        )
        self.assertEqual(new_login.status_code, 200)

    def test_notebook_crud_requires_auth(self) -> None:
        res = self.client.get("/api/notebooks")
        self.assertEqual(res.status_code, 401)

    def _signup(self, username: str) -> dict[str, str]:
        res = self.client.post(
            "/api/auth/signup",
            json={
                "email": f"{username}@example.com",
                "password": "secret12",
                "name": username,
                "username": username,
            },
        )
        self.assertEqual(res.status_code, 200, res.text)
        return {"Authorization": f"Bearer {res.json()['token']}"}

    def test_move_page_and_section_between_books(self) -> None:
        h = self._signup("mover")
        c = self.client
        self.assertEqual(c.post("/api/bookshelves", headers=h, json={"id": "mv-shelf", "name": "S"}).status_code, 200)
        for nb in ("mv-nb1", "mv-nb2"):
            r = c.post("/api/notebooks", headers=h, json={"id": nb, "name": nb, "bookshelfId": "mv-shelf"})
            self.assertEqual(r.status_code, 200, r.text)
        for sec, nb in (("mv-s1", "mv-nb1"), ("mv-s2", "mv-nb2")):
            r = c.post("/api/sections", headers=h, json={"id": sec, "notebookId": nb, "name": sec})
            self.assertEqual(r.status_code, 200, r.text)
        r = c.post("/api/pages", headers=h, json={"id": "mv-p1", "sectionId": "mv-s1", "title": "P", "content": "x"})
        self.assertEqual(r.status_code, 200, r.text)

        # Page → chapter in another book
        r = c.post("/api/pages/mv-p1/move", headers=h, json={"sectionId": "mv-s2"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["sectionId"], "mv-s2")
        ids = [p["id"] for p in c.get("/api/pages/mv-s2", headers=h).json()]
        self.assertIn("mv-p1", ids)
        self.assertEqual(c.get("/api/pages/mv-s1", headers=h).json(), [])

        # Chapter → another book, pages travel with it
        r = c.post("/api/sections/mv-s2/move", headers=h, json={"notebookId": "mv-nb1"})
        self.assertEqual(r.status_code, 200, r.text)
        secs = [s["id"] for s in c.get("/api/sections/mv-nb1", headers=h).json()]
        self.assertIn("mv-s2", secs)
        self.assertIn("mv-p1", [p["id"] for p in c.get("/api/pages/mv-s2", headers=h).json()])

        # Cannot move into someone else's chapter
        other = self._signup("intruder")
        r = c.post("/api/pages/mv-p1/move", headers=other, json={"sectionId": "mv-s1"})
        self.assertEqual(r.status_code, 404)
        r = c.post("/api/pages/mv-p1/move", headers=h, json={"sectionId": "nope"})
        self.assertEqual(r.status_code, 404)

    def test_demo_user_not_seeded(self) -> None:
        login = self.client.post(
            "/api/auth/login",
            json={"identifier": "demo_user", "password": "demo_user"},
        )
        self.assertEqual(login.status_code, 401)


if __name__ == "__main__":
    unittest.main()
