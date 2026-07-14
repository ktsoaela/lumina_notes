"""DB access: SQLite (desktop/dev) or PostgreSQL (server production)."""
from __future__ import annotations

import os
import re
import sqlite3
import sys
from pathlib import Path
from typing import Any, Iterator

DATABASE_URL = (os.environ.get("DATABASE_URL") or "").strip()
USE_POSTGRES = DATABASE_URL.startswith(("postgres://", "postgresql://"))

LUMINA_ENV = os.environ.get("LUMINA_ENV", "development").strip().lower()
IS_PRODUCTION = LUMINA_ENV in ("production", "prod")
IS_FROZEN = bool(getattr(sys, "frozen", False))

# Server production must use Postgres. Electron freestanding builds keep SQLite.
if IS_PRODUCTION and not IS_FROZEN and not USE_POSTGRES:
    raise RuntimeError(
        "Server production requires DATABASE_URL=postgresql://... "
        "(desktop/Electron builds may keep SQLite)."
    )

if USE_POSTGRES:
    import psycopg
    from psycopg import errors as pg_errors
    from psycopg.rows import dict_row

    IntegrityError = pg_errors.IntegrityError
    OperationalError = pg_errors.OperationalError
else:
    IntegrityError = sqlite3.IntegrityError
    OperationalError = sqlite3.OperationalError


def _default_sqlite_path() -> Path:
    if IS_FROZEN:
        return Path(sys.executable).resolve().parent / "database.sqlite"
    root = Path(__file__).resolve().parent
    if os.environ.get("DATABASE_PATH"):
        return Path(os.environ["DATABASE_PATH"]).expanduser().resolve()
    return root / "database.sqlite"


SQLITE_PATH = _default_sqlite_path()

SCHEMA_SQLITE = """
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  username TEXT,
  password TEXT,
  name TEXT
);

CREATE TABLE IF NOT EXISTS bookshelves (
  id TEXT PRIMARY KEY,
  userId INTEGER NOT NULL,
  name TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(userId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notebooks (
  id TEXT PRIMARY KEY,
  userId INTEGER,
  name TEXT,
  bookshelfId TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(userId) REFERENCES users(id),
  FOREIGN KEY(bookshelfId) REFERENCES bookshelves(id)
);

CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  notebookId TEXT,
  name TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(notebookId) REFERENCES notebooks(id)
);

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  sectionId TEXT,
  title TEXT,
  content TEXT,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(sectionId) REFERENCES sections(id)
);
"""

SCHEMA_POSTGRES = """
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE,
  username TEXT,
  password TEXT,
  name TEXT
);

CREATE TABLE IF NOT EXISTS bookshelves (
  id TEXT PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notebooks (
  id TEXT PRIMARY KEY,
  "userId" INTEGER REFERENCES users(id),
  name TEXT,
  "bookshelfId" TEXT REFERENCES bookshelves(id),
  archived INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  "notebookId" TEXT REFERENCES notebooks(id),
  name TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  "sectionId" TEXT REFERENCES sections(id),
  title TEXT,
  content TEXT,
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);
"""


def _quote_idents_pg(sql: str) -> str:
    """Quote camelCase identifiers for PostgreSQL."""
    for name in (
        "userId",
        "bookshelfId",
        "notebookId",
        "sectionId",
        "createdAt",
        "updatedAt",
    ):
        sql = re.sub(rf'\b{name}\b', f'"{name}"', sql)
    return sql


def adapt_sql(sql: str) -> str:
    if not USE_POSTGRES:
        return sql
    s = sql.strip()
    # INSERT OR IGNORE INTO t (...) VALUES (...)
    m = re.match(
        r"INSERT\s+OR\s+IGNORE\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)\s*$",
        s,
        flags=re.I | re.S,
    )
    if m:
        table, cols, vals = m.group(1), m.group(2), m.group(3)
        conflict = "id"
        if table == "schema_meta":
            conflict = "key"
        s = (
            f'INSERT INTO {table} ({cols}) VALUES ({vals}) '
            f"ON CONFLICT ({conflict}) DO NOTHING"
        )
    # INSERT OR REPLACE INTO schema_meta
    m2 = re.match(
        r"INSERT\s+OR\s+REPLACE\s+INTO\s+schema_meta\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)\s*$",
        s,
        flags=re.I | re.S,
    )
    if m2:
        cols, vals = m2.group(1), m2.group(2)
        s = (
            f'INSERT INTO schema_meta ({cols}) VALUES ({vals}) '
            f"ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"
        )
    s = s.replace("?", "%s")
    s = s.replace("CURRENT_TIMESTAMP", "NOW()")
    s = _quote_idents_pg(s)
    return s


class _Cursor:
    def __init__(self, cur: Any, dialect: str):
        self._cur = cur
        self._dialect = dialect

    def fetchone(self) -> Any:
        return self._cur.fetchone()

    def fetchall(self) -> list[Any]:
        return list(self._cur.fetchall())

    @property
    def lastrowid(self) -> int | None:
        if self._dialect == "sqlite":
            return self._cur.lastrowid
        # SERIAL inserts — lastval() in this session
        self._cur.execute("SELECT lastval()")
        row = self._cur.fetchone()
        if row is None:
            return None
        if isinstance(row, dict):
            return int(next(iter(row.values())))
        return int(row[0])

    @property
    def rowcount(self) -> int:
        return self._cur.rowcount


class Connection:
    def __init__(self, raw: Any, dialect: str):
        self._raw = raw
        self.dialect = dialect

    def execute(self, sql: str, params: Any = ()) -> _Cursor:
        q = adapt_sql(sql)
        if params is None:
            params = ()
        cur = self._raw.execute(q, params)
        return _Cursor(cur, self.dialect)

    def executescript(self, script: str) -> None:
        if self.dialect == "sqlite":
            self._raw.executescript(script)
            return
        # Postgres: run statements one by one
        for stmt in script.split(";"):
            s = stmt.strip()
            if s:
                self._raw.execute(s)

    def commit(self) -> None:
        self._raw.commit()

    def rollback(self) -> None:
        self._raw.rollback()

    def close(self) -> None:
        self._raw.close()


def connect(*, timeout: float | None = None) -> Connection:
    if USE_POSTGRES:
        # ponytail: sync psycopg; pool later if RPS needs it
        raw = psycopg.connect(DATABASE_URL, row_factory=dict_row)
        raw.autocommit = False
        return Connection(raw, "postgres")
    kwargs: dict[str, Any] = {"check_same_thread": False}
    if timeout is not None:
        kwargs["timeout"] = timeout
    raw = sqlite3.connect(str(SQLITE_PATH), **kwargs)
    raw.row_factory = sqlite3.Row
    return Connection(raw, "sqlite")


def ping() -> dict[str, Any]:
    conn = connect(timeout=2.0)
    try:
        conn.execute("SELECT 1").fetchone()
        ver = None
        try:
            row = conn.execute(
                "SELECT value FROM schema_meta WHERE key = ?", ("version",)
            ).fetchone()
            if row is not None:
                ver = row["value"] if not isinstance(row, tuple) else row[0]
        except OperationalError:
            pass
        return {
            "database": "ok",
            "driver": "postgres" if USE_POSTGRES else "sqlite",
            "schema_version": ver,
        }
    finally:
        conn.close()


def init_schema(conn: Connection) -> None:
    if conn.dialect == "postgres":
        conn.executescript(SCHEMA_POSTGRES)
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username "
            "ON users (username) WHERE username IS NOT NULL"
        )
    else:
        conn.executescript(SCHEMA_SQLITE)
        for stmt in (
            "ALTER TABLE users ADD COLUMN username TEXT",
            "ALTER TABLE notebooks ADD COLUMN archived INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE notebooks ADD COLUMN bookshelfId TEXT",
        ):
            try:
                conn.execute(stmt)
            except OperationalError:
                pass
        try:
            conn.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username "
                "ON users(username) WHERE username IS NOT NULL"
            )
        except OperationalError:
            pass
