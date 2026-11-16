"""Phone pairing: short-lived single-use codes that put a phone on the same server + account.

Desktop/web (signed in) calls ``POST /api/pair/start`` and shows the returned
``deepLink`` as a QR. The phone scans it, saves ``u`` as its server URL and calls
``POST /api/pair/complete`` with ``c`` to get a session without typing a password.

Base URL rule for the link: the client's saved sync URL (``serverUrl``) if given;
otherwise the request's base URL, with loopback hosts replaced by this machine's
LAN IPv4 (``lan=True``) so a phone on the same Wi-Fi can reach it.
"""
from __future__ import annotations

import ipaddress
import secrets
import socket
from datetime import datetime, timedelta, timezone
from urllib.parse import quote, urlsplit

from db import Connection

TTL = timedelta(minutes=5)
CODE_LEN = 8
# No 0/O/1/I: codes may be read aloud or typed.
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
INVALID_CODE = "Pairing code is invalid or expired"

_LOOPBACK_NAMES = {"localhost", "localhost.localdomain"}


def migrate(conn: Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS pairing_codes (
            code TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            expires_at TEXT NOT NULL,
            used_at TEXT,
            device_name TEXT,
            created_at TEXT NOT NULL
        )
        """
    )


def new_code() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(CODE_LEN))


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _parse(value: str) -> datetime:
    dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def normalize_url(raw: str) -> str | None:
    """Same rules as the web client (default https://, drop trailing /). None if unusable."""
    s = (raw or "").strip().rstrip("/")
    if not s:
        return None
    if "://" not in s:
        s = f"https://{s}"
    parts = urlsplit(s)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        return None
    return s


def build_deep_link(server_url: str, code: str) -> str:
    return f"lumina://pair?u={quote(server_url, safe='')}&c={quote(code, safe='')}"


def lan_ip() -> str | None:
    """This machine's primary LAN IPv4 (UDP connect sends no packets). None if offline."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("192.0.2.1", 80))  # TEST-NET-1: never routed, only picks an interface
            ip = s.getsockname()[0]
    except OSError:
        return None
    return None if ip.startswith("127.") or ip == "0.0.0.0" else ip


def _is_loopback(host: str) -> bool:
    if host.lower() in _LOOPBACK_NAMES:
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def resolve_base_url(client_url: str | None, request_base: str, port: str) -> tuple[str, bool]:
    """(base url for the QR, whether a LAN IP was substituted for loopback)."""
    if client_url and client_url.strip():
        url = normalize_url(client_url)
        if url is None:
            raise ValueError("Invalid server URL")
        return url, False
    base = request_base.rstrip("/")
    parts = urlsplit(base)
    if parts.hostname and _is_loopback(parts.hostname):
        ip = lan_ip()
        if ip:
            return f"http://{ip}:{port}", True
    return base, False


def start(db: Connection, user_id: int) -> tuple[str, str]:
    """Store a fresh code for ``user_id``. Returns (code, expiresAt ISO)."""
    now = datetime.now(timezone.utc)
    # Drop this user's stale codes so the table stays tiny.
    db.execute(
        "DELETE FROM pairing_codes WHERE user_id = ? AND (used_at IS NOT NULL OR expires_at < ?)",
        (user_id, _iso(now)),
    )
    expires = _iso(now + TTL)
    for _ in range(5):
        code = new_code()
        if db.execute("SELECT 1 FROM pairing_codes WHERE code = ?", (code,)).fetchone() is None:
            db.execute(
                "INSERT INTO pairing_codes (code, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
                (code, user_id, expires, _iso(now)),
            )
            return code, expires
    raise RuntimeError("Could not allocate a pairing code")


def redeem(db: Connection, code: str, device_name: str | None) -> int | None:
    """Mark ``code`` used and return its user id, or None if unknown/expired/used.

    The conditional UPDATE makes concurrent redeems of one code succeed at most once.
    """
    code = (code or "").strip().upper()
    if not code:
        return None
    row = db.execute(
        "SELECT user_id, expires_at, used_at FROM pairing_codes WHERE code = ?", (code,)
    ).fetchone()
    now = datetime.now(timezone.utc)
    if row is None or row["used_at"] is not None or _parse(row["expires_at"]) <= now:
        return None
    cur = db.execute(
        "UPDATE pairing_codes SET used_at = ?, device_name = ? WHERE code = ? AND used_at IS NULL",
        (_iso(now), (device_name or "").strip()[:64] or None, code),
    )
    if cur.rowcount != 1:
        return None
    return int(row["user_id"])
