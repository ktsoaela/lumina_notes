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
  updatedAt DATETIME,
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
        "deletedAt",
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
    init_sync_schema(conn)


# ---------------------------------------------------------------------------
# Sync support (additive): every hierarchy row carries updatedAt, and deletes
# leave a tombstone, so clients can pull "what changed since <cursor>".
# Triggers keep this true for every write path (legacy routes, backup import,
# data wipe) without touching those queries.
# ---------------------------------------------------------------------------

SYNC_TABLES = ("bookshelves", "notebooks", "sections", "pages")
SYNC_ENTITY = {
    "bookshelves": "bookshelf",
    "notebooks": "notebook",
    "sections": "section",
    "pages": "page",
}
_TOUCH_COLS = {
    "bookshelves": "name",
    "notebooks": "name, archived, bookshelfId",
    "sections": "name, notebookId",
    "pages": "title, content, sectionId",
}
# SQL giving the owning user id of OLD in a delete trigger.
_OWNER_SQL = {
    "bookshelves": "SELECT OLD.userId",
    "notebooks": "SELECT OLD.userId",
    "sections": "SELECT n.userId FROM notebooks n WHERE n.id = OLD.notebookId",
    "pages": (
        "SELECT n.userId FROM sections s JOIN notebooks n ON n.id = s.notebookId "
        "WHERE s.id = OLD.sectionId"
    ),
}

# Millisecond UTC text, sorts correctly next to legacy CURRENT_TIMESTAMP values.
SQLITE_NOW_MS = "strftime('%Y-%m-%d %H:%M:%f', 'now')"


def _init_sync_sqlite(conn: Connection) -> None:
    for table in ("bookshelves", "notebooks", "sections"):
        try:
            # SQLite rejects non-constant defaults on ALTER; triggers stamp instead.
            conn.execute(f"ALTER TABLE {table} ADD COLUMN updatedAt DATETIME")
        except OperationalError:
            pass
    for table in SYNC_TABLES:
        conn.execute(
            f"UPDATE {table} SET updatedAt = "
            f"COALESCE({'createdAt' if table != 'pages' else 'NULL'}, CURRENT_TIMESTAMP) "
            "WHERE updatedAt IS NULL"
        )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS sync_tombstones (
          entity TEXT NOT NULL,
          id TEXT NOT NULL,
          userId INTEGER,
          deletedAt DATETIME NOT NULL,
          PRIMARY KEY (entity, id)
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_tombstones_user ON sync_tombstones(userId, deletedAt)"
    )
    for table in SYNC_TABLES:
        entity = SYNC_ENTITY[table]
        for name in ("ins", "upd", "del"):
            conn.execute(f"DROP TRIGGER IF EXISTS lumina_sync_{table}_{name}")
        conn.execute(
            f"""
            CREATE TRIGGER lumina_sync_{table}_ins AFTER INSERT ON {table}
            BEGIN
              UPDATE {table} SET updatedAt = {SQLITE_NOW_MS} WHERE id = NEW.id;
              DELETE FROM sync_tombstones WHERE entity = '{entity}' AND id = NEW.id;
            END
            """
        )
        conn.execute(
            f"""
            CREATE TRIGGER lumina_sync_{table}_upd AFTER UPDATE OF {_TOUCH_COLS[table]} ON {table}
            BEGIN
              UPDATE {table} SET updatedAt = {SQLITE_NOW_MS} WHERE id = NEW.id;
            END
            """
        )
        conn.execute(
            f"""
            CREATE TRIGGER lumina_sync_{table}_del AFTER DELETE ON {table}
            BEGIN
              INSERT OR REPLACE INTO sync_tombstones (entity, id, userId, deletedAt)
              SELECT '{entity}', OLD.id, ({_OWNER_SQL[table]}), {SQLITE_NOW_MS};
            END
            """
        )


def _init_sync_postgres(conn: Connection) -> None:
    for table in ("bookshelves", "notebooks", "sections"):
        conn.execute(
            f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS updatedAt TIMESTAMPTZ DEFAULT NOW()"
        )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS sync_tombstones (
          entity TEXT NOT NULL,
          id TEXT NOT NULL,
          userId INTEGER,
          deletedAt TIMESTAMPTZ NOT NULL,
          PRIMARY KEY (entity, id)
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_tombstones_user ON sync_tombstones (userId, deletedAt)"
    )
    conn.execute(
        """
        CREATE OR REPLACE FUNCTION lumina_sync_touch() RETURNS trigger AS $$
        BEGIN
          NEW.updatedAt := clock_timestamp();
          RETURN NEW;
        END
        $$ LANGUAGE plpgsql
        """
    )
    conn.execute(
        """
        CREATE OR REPLACE FUNCTION lumina_sync_untomb() RETURNS trigger AS $$
        BEGIN
          DELETE FROM sync_tombstones WHERE entity = TG_ARGV[0] AND id = NEW.id;
          RETURN NULL;
        END
        $$ LANGUAGE plpgsql
        """
    )
    for table in SYNC_TABLES:
        entity = SYNC_ENTITY[table]
        conn.execute(
            f"""
            CREATE OR REPLACE FUNCTION lumina_sync_tomb_{table}() RETURNS trigger AS $$
            BEGIN
              INSERT INTO sync_tombstones (entity, id, userId, deletedAt)
              VALUES ('{entity}', OLD.id, ({_OWNER_SQL[table]}), clock_timestamp())
              ON CONFLICT (entity, id) DO UPDATE
                SET userId = EXCLUDED.userId, deletedAt = EXCLUDED.deletedAt;
              RETURN NULL;
            END
            $$ LANGUAGE plpgsql
            """
        )
        for name in ("touch", "untomb", "tomb"):
            conn.execute(f"DROP TRIGGER IF EXISTS lumina_sync_{table}_{name} ON {table}")
        conn.execute(
            f"CREATE TRIGGER lumina_sync_{table}_touch BEFORE INSERT OR UPDATE ON {table} "
            "FOR EACH ROW EXECUTE FUNCTION lumina_sync_touch()"
        )
        conn.execute(
            f"CREATE TRIGGER lumina_sync_{table}_untomb AFTER INSERT ON {table} "
            f"FOR EACH ROW EXECUTE FUNCTION lumina_sync_untomb('{entity}')"
        )
        conn.execute(
            f"CREATE TRIGGER lumina_sync_{table}_tomb AFTER DELETE ON {table} "
            f"FOR EACH ROW EXECUTE FUNCTION lumina_sync_tomb_{table}()"
        )


def init_sync_schema(conn: Connection) -> None:
    if conn.dialect == "postgres":
        _init_sync_postgres(conn)
    else:
        _init_sync_sqlite(conn)
