"""Phone pairing API: POST /api/pair/start and POST /api/pair/complete (temp SQLite)."""
from __future__ import annotations

import os
import re
import tempfile
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock


class PairingApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._tmpdir = tempfile.TemporaryDirectory()
        os.environ["DATABASE_PATH"] = str(Path(cls._tmpdir.name) / "pair.sqlite")
        os.environ.pop("DATABASE_URL", None)
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
        cls.db_module = db_module
        from fastapi.testclient import TestClient

        cls._cm = TestClient(app_module.app)
        cls.client = cls._cm.__enter__()

    @classmethod
    def tearDownClass(cls) -> None:
        cls._cm.__exit__(None, None, None)
        cls._tmpdir.cleanup()

    def _user(self) -> tuple[dict[str, str], int]:
        tag = uuid.uuid4().hex[:10]
        res = self.client.post(
            "/api/auth/signup",
            json={"email": f"p{tag}@example.com", "password": "secret12", "name": "P"},
        )
        self.assertEqual(res.status_code, 200, res.text)
        body = res.json()
        return {"Authorization": f"Bearer {body['token']}"}, int(body["user"]["id"])

    def _start(self, h: dict[str, str], server_url: str | None = "http://192.168.0.225:58888/"):
        body = {} if server_url is None else {"serverUrl": server_url}
        return self.client.post("/api/pair/start", headers=h, json=body)

    # ------------------------------------------------------------ start

    def test_start_requires_auth(self) -> None:
        res = self.client.post("/api/pair/start", json={})
        self.assertIn(res.status_code, (401, 403))

    def test_start_returns_code_and_link(self) -> None:
        h, _ = self._user()
        res = self._start(h)
        self.assertEqual(res.status_code, 200, res.text)
        body = res.json()
        self.assertRegex(body["code"], r"^[A-HJ-NP-Z2-9]{8}$")
        self.assertEqual(body["serverUrl"], "http://192.168.0.225:58888")
        self.assertEqual(
            body["deepLink"],
            f"lumina://pair?u=http%3A%2F%2F192.168.0.225%3A58888&c={body['code']}",
        )
        self.assertFalse(body["lan"])
        exp = datetime.fromisoformat(body["expiresAt"].replace("Z", "+00:00"))
        delta = (exp - datetime.now(timezone.utc)).total_seconds()
        self.assertAlmostEqual(delta, 300, delta=5)

    def test_start_codes_are_unique(self) -> None:
        h, _ = self._user()
        codes = {self._start(h).json()["code"] for _ in range(5)}
        self.assertEqual(len(codes), 5)

    def test_start_rejects_bad_url(self) -> None:
        h, _ = self._user()
        res = self._start(h, "ftp://x")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Invalid server URL", res.text)

    def test_start_without_url_uses_request_base(self) -> None:
        h, _ = self._user()
        res = self._start(h, None)
        self.assertEqual(res.status_code, 200, res.text)
        self.assertEqual(res.json()["serverUrl"], "http://testserver")

    # ------------------------------------------------------------ base url rule

    def test_resolve_base_url_loopback_uses_lan_ip(self) -> None:
        import pairing

        with mock.patch.object(pairing, "lan_ip", return_value="10.1.2.3"):
            self.assertEqual(
                pairing.resolve_base_url(None, "http://127.0.0.1:58888/", "58888"),
                ("http://10.1.2.3:58888", True),
            )
            self.assertEqual(
                pairing.resolve_base_url("", "http://localhost:5173", "58888"),
                ("http://10.1.2.3:58888", True),
            )
            self.assertEqual(
                pairing.resolve_base_url(None, "https://notes.example.com/", "58888"),
                ("https://notes.example.com", False),
            )
            # Explicit client URL wins, even if it is loopback.
            self.assertEqual(
                pairing.resolve_base_url("notes.example.com", "http://127.0.0.1:58888", "58888"),
                ("https://notes.example.com", False),
            )

    def test_resolve_base_url_loopback_without_lan_keeps_loopback(self) -> None:
        import pairing

        with mock.patch.object(pairing, "lan_ip", return_value=None):
            self.assertEqual(
                pairing.resolve_base_url(None, "http://127.0.0.1:58888", "58888"),
                ("http://127.0.0.1:58888", False),
            )

    # ------------------------------------------------------------ complete

    def test_complete_returns_session_for_owner(self) -> None:
        h, uid = self._user()
        code = self._start(h).json()["code"]
        res = self.client.post("/api/pair/complete", json={"code": code.lower(), "deviceName": "Pixel"})
        self.assertEqual(res.status_code, 200, res.text)
        body = res.json()
        self.assertEqual(int(body["user"]["id"]), uid)
        me = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['token']}"})
        self.assertEqual(me.status_code, 200)
        self.assertEqual(int(me.json()["id"]), uid)

    def test_complete_single_use(self) -> None:
        h, _ = self._user()
        code = self._start(h).json()["code"]
        first = self.client.post("/api/pair/complete", json={"code": code})
        self.assertEqual(first.status_code, 200, first.text)
        second = self.client.post("/api/pair/complete", json={"code": code})
        self.assertEqual(second.status_code, 400)
        self.assertIn("Pairing code is invalid or expired", second.text)

    def test_complete_expired(self) -> None:
        h, _ = self._user()
        code = self._start(h).json()["code"]
        past = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat().replace("+00:00", "Z")
        conn = self.db_module.connect()
        try:
            conn.execute("UPDATE pairing_codes SET expires_at = ? WHERE code = ?", (past, code))
            conn.commit()
        finally:
            conn.close()
        res = self.client.post("/api/pair/complete", json={"code": code})
        self.assertEqual(res.status_code, 400)
        self.assertIn("Pairing code is invalid or expired", res.text)

    def test_complete_unknown_code(self) -> None:
        res = self.client.post("/api/pair/complete", json={"code": "ZZZZZZZZ"})
        self.assertEqual(res.status_code, 400)
        self.assertIn("Pairing code is invalid or expired", res.text)

    def test_complete_rejects_empty_code(self) -> None:
        res = self.client.post("/api/pair/complete", json={"code": ""})
        self.assertIn(res.status_code, (400, 422))


if __name__ == "__main__":
    unittest.main()
