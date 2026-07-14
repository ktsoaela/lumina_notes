"""Lumina Notes API: FastAPI + SQLite."""
from __future__ import annotations

import os
import re
import sqlite3
import sys
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.middleware.cors import CORSMiddleware
import bcrypt
from jose import JWTError, jwt
from pydantic import BaseModel, model_validator


def _paths() -> tuple[Path, Path]:
    """DB next to the executable when frozen (writable); static assets from bundle."""
    if getattr(sys, "frozen", False):
        exe_dir = Path(sys.executable).resolve().parent
        bundle = Path(getattr(sys, "_MEIPASS", exe_dir))
        return exe_dir / "database.sqlite", bundle / "dist"
    root = Path(__file__).resolve().parent
    return root / "database.sqlite", root / "dist"


DB_PATH, DIST_DIR = _paths()
if os.environ.get("DATABASE_PATH"):
    DB_PATH = Path(os.environ["DATABASE_PATH"]).expanduser().resolve()

# Same SQLite file for FastAPI + Django; these are the dev URLs that talk to that DB over HTTP.
_DEFAULT_CORS = (
    "http://127.0.0.1:5173,"
    "http://127.0.0.1:8001,"
    "http://127.0.0.1:58888"
)
CORS_ORIGINS = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", _DEFAULT_CORS).split(",")
    if o.strip()
]

JWT_SECRET = os.environ.get("JWT_SECRET", "lumina-notes-secret-key")
ALGORITHM = "HS256"

security = HTTPBearer(auto_error=False)

# bcrypt enforces a 72-byte limit; match that for hashing and checks.
def _pwd_bytes(plain: str) -> bytes:
    return plain.encode("utf-8")[:72]


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(_pwd_bytes(plain), bcrypt.gensalt()).decode("ascii")


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(_pwd_bytes(plain), hashed.encode("ascii"))
    except (ValueError, TypeError):
        return False

SCHEMA = """
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


def _migrate_bookshelves(conn: sqlite3.Connection) -> None:
    """Create bookshelves table, add notebooks.bookshelfId, backfill per-user defaults."""
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS bookshelves (
            id TEXT PRIMARY KEY,
            userId INTEGER NOT NULL,
            name TEXT NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(userId) REFERENCES users(id)
        )
        """
    )
    try:
        conn.execute("ALTER TABLE notebooks ADD COLUMN bookshelfId TEXT")
    except sqlite3.OperationalError:
        pass
    for row in conn.execute("SELECT id FROM users").fetchall():
        uid = int(row["id"])
        bid = f"bs-{uid}-default"
        conn.execute(
            "INSERT OR IGNORE INTO bookshelves (id, userId, name) VALUES (?, ?, ?)",
            (bid, uid, "My bookshelf"),
        )
        conn.execute(
            """
            UPDATE notebooks SET bookshelfId = ?
            WHERE userId = ? AND (bookshelfId IS NULL OR bookshelfId = '')
            """,
            (bid, uid),
        )


def _insert_default_bookshelf(db: sqlite3.Connection, user_id: int) -> None:
    """Ensure a new Lumina user has a default shelf (same id pattern as migration)."""
    bid = f"bs-{user_id}-default"
    db.execute(
        "INSERT OR IGNORE INTO bookshelves (id, userId, name) VALUES (?, ?, ?)",
        (bid, user_id, "My bookshelf"),
    )


def _seed_demo_user(conn: sqlite3.Connection) -> None:
    """Public demo account: username and password `demo_user`; two notebooks on the default shelf."""
    demo_email = "demo_user@demo.lumina.local"
    demo_login = "demo_user"
    row = conn.execute(
        """
        SELECT id FROM users
        WHERE lower(trim(email)) = lower(trim(?))
           OR (username IS NOT NULL AND lower(trim(username)) = lower(trim(?)))
        """,
        (demo_email, demo_login),
    ).fetchone()
    if row is None:
        hashed = hash_password(demo_login)
        cur = conn.execute(
            """
            INSERT INTO users (email, password, name, username)
            VALUES (?, ?, ?, ?)
            """,
            (demo_email, hashed, "Demo User", demo_login),
        )
        uid = int(cur.lastrowid)
    else:
        uid = int(row["id"])

    bid = f"bs-{uid}-default"
    conn.execute(
        "INSERT OR IGNORE INTO bookshelves (id, userId, name) VALUES (?, ?, ?)",
        (bid, uid, "My bookshelf"),
    )

    markdown_syntax_page = """# Markdown basic syntax

Official reference: [Markdown Guide — Basic Syntax](https://www.markdownguide.org/basic-syntax/)

The examples below follow the same ideas as that guide (headings, emphasis, lists, links, code, and more).

---

## Headings

# Heading level 1
## Heading level 2
### Heading level 3
#### Heading level 4

---

## Paragraphs and line breaks

Separate paragraphs with a blank line.

End a line with two spaces before a newline for a soft line break  
like this (two trailing spaces on the previous line).

---

## Emphasis

**Bold** with `**double asterisks**` or `__double underscores__`.

*Italic* with `*single asterisks*` or `_single underscores_`.

***Bold and italic*** with three asterisks.

---

## Blockquotes

> This is a blockquote.
>
> It can span multiple lines.

---

## Lists

Unordered:

- First item
- Second item
  - Nested item
  - Another nested item

Ordered:

1. First item
2. Second item
3. Third item

---

## Code

Inline: `const x = 1;`

Fenced block:

```
function hello() {
  console.log("Hello");
}
```

---

## Horizontal rule

Three or more asterisks, dashes, or underscores on their own line:

---

## Links

[Markdown Guide](https://www.markdownguide.org/basic-syntax/ "Basic syntax — Markdown Guide")

Autolink style: <https://www.markdownguide.org/basic-syntax/>

---

## Images

![Alt text describes the image](https://picsum.photos/seed/md-demo/400/240 "Optional title")

---

## Escaping

Use a backslash to show literal formatting characters: \\*not italic\\*

---

*Tip: bookmark [Basic Syntax](https://www.markdownguide.org/basic-syntax/) for the full tables and best-practice notes.*
"""

    demos: list[tuple[str, str, str, str]] = [
        (
            "nb-demo-welcome",
            "Welcome",
            "Getting started",
            "# Welcome\n\n"
            "You are signed in as **demo_user**. "
            "Explore sections and pages in the sidebar, or open **Bookshelves** from the header.\n",
        ),
        (
            "nb-demo-sandbox",
            "Sandbox",
            "Scratch pad",
            "# Sandbox\n\n"
            "Use this notebook to try Markdown, diagrams, and anything else. "
            "Add sections and pages from the sidebar.\n",
        ),
        (
            "nb-demo-markdown",
            "Markdown basics",
            "Basic syntax",
            markdown_syntax_page,
        ),
    ]
    for nb_id, nb_title, page_title, page_md in demos:
        exists = conn.execute(
            "SELECT 1 FROM notebooks WHERE id = ?", (nb_id,)
        ).fetchone()
        if exists:
            continue
        conn.execute(
            """
            INSERT INTO notebooks (id, userId, name, bookshelfId, archived)
            VALUES (?, ?, ?, ?, 0)
            """,
            (nb_id, uid, nb_title, bid),
        )
        sec_id = f"sec-{nb_id}"
        conn.execute(
            "INSERT INTO sections (id, notebookId, name) VALUES (?, ?, ?)",
            (sec_id, nb_id, "Notes"),
        )
        page_id = f"page-{nb_id}"
        conn.execute(
            """
            INSERT INTO pages (id, sectionId, title, content)
            VALUES (?, ?, ?, ?)
            """,
            (page_id, sec_id, page_title, page_md),
        )


def init_db() -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        conn.executescript(SCHEMA)
        try:
            conn.execute("ALTER TABLE users ADD COLUMN username TEXT")
        except sqlite3.OperationalError:
            pass
        try:
            conn.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username "
                "ON users(username) WHERE username IS NOT NULL"
            )
        except sqlite3.OperationalError:
            pass
        try:
            conn.execute(
                "ALTER TABLE notebooks ADD COLUMN archived INTEGER NOT NULL DEFAULT 0"
            )
        except sqlite3.OperationalError:
            pass
        _migrate_bookshelves(conn)
        _seed_demo_user(conn)
        conn.commit()
    finally:
        conn.close()


def get_db():
    # FastAPI runs sync deps in a thread pool; enter/exit can run on different threads.
    # check_same_thread=False is required for sqlite3 in that model (single writer is still fine).
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


Db = Annotated[sqlite3.Connection, Depends(get_db)]


def create_token(user_id: int, email: str, name: str) -> str:
    return jwt.encode(
        {"id": user_id, "email": email, "name": name},
        JWT_SECRET,
        algorithm=ALGORITHM,
    )


def _django_check_password(plain: str, encoded: str) -> bool:
    """Verify Django auth_user.password (pbkdf2_sha256, etc.)."""
    try:
        import django
        from django.conf import settings as dj_settings

        if not dj_settings.configured:
            os.environ.setdefault("DJANGO_SETTINGS_MODULE", "lumina.settings")
            django.setup()
        from django.contrib.auth.hashers import check_password

        return bool(check_password(plain, encoded))
    except Exception:
        return False


def _normalize_username(raw: str | None) -> str | None:
    if not raw or not str(raw).strip():
        return None
    s = str(raw).strip().lower()
    if not re.match(r"^[a-z0-9_]{3,32}$", s):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Username must be 3–32 characters: lowercase letters, numbers, underscore",
        )
    return s


def _link_django_user(db: sqlite3.Connection, body: "LoginBody", dj: sqlite3.Row) -> tuple[int, str, str]:
    """Create or update Lumina users row after successful Django password check."""
    login_key = body.login_key()
    email_from_dj = (dj["email"] or "").strip()
    if email_from_dj:
        email = email_from_dj
    elif "@" in login_key:
        email = login_key
    else:
        email = f"{(dj['username'] or login_key).strip()}@django.local"

    name = (dj["first_name"] or "").strip()
    ln = (dj["last_name"] or "").strip()
    if ln:
        name = f"{name} {ln}".strip() if name else ln
    if not name:
        name = (dj["username"] or "User").strip()

    dj_username = (dj["username"] or "").strip().lower() or None

    hashed = hash_password(body.password)
    if dj_username:
        existing = db.execute(
            """
            SELECT id FROM users
            WHERE lower(trim(email)) = lower(trim(?))
               OR (username IS NOT NULL AND lower(trim(username)) = ?)
            """,
            (email, dj_username),
        ).fetchone()
    else:
        existing = db.execute(
            "SELECT id FROM users WHERE lower(trim(email)) = lower(trim(?))",
            (email,),
        ).fetchone()
    if existing:
        uid = int(existing["id"])
        db.execute(
            "UPDATE users SET password = ?, name = ?, email = ?, username = ? WHERE id = ?",
            (hashed, name, email, dj_username, uid),
        )
        return uid, email, name

    cur = db.execute(
        "INSERT INTO users (email, password, name, username) VALUES (?, ?, ?, ?)",
        (email, hashed, name, dj_username),
    )
    new_uid = int(cur.lastrowid)
    _insert_default_bookshelf(db, new_uid)
    return new_uid, email, name


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> dict[str, Any]:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        uid = payload.get("id")
        if uid is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Invalid token")
        return {"id": int(uid), "email": payload.get("email"), "name": payload.get("name")}
    except JWTError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Invalid token")


CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]


def _row_to_user(row: sqlite3.Row) -> dict[str, Any]:
    d = {k: row[k] for k in row.keys()}
    out: dict[str, Any] = {
        "id": int(d["id"]),
        "email": d["email"],
        "name": d["name"],
    }
    if "username" in d and d["username"] is not None:
        out["username"] = d["username"]
    return out


class SignupBody(BaseModel):
    email: str
    password: str
    name: str
    username: str | None = None


class LoginBody(BaseModel):
    password: str
    identifier: str | None = None
    email: str | None = None  # legacy: same as identifier

    @model_validator(mode="after")
    def _require_login_identifier(self) -> "LoginBody":
        if not (self.identifier or self.email):
            raise ValueError("identifier or email required")
        return self

    def login_key(self) -> str:
        return (self.identifier or self.email or "").strip()


class BookshelfCreate(BaseModel):
    id: str
    name: str


class BookshelfUpdate(BaseModel):
    name: str


class NotebookCreate(BaseModel):
    id: str
    name: str
    bookshelfId: str


class SectionCreate(BaseModel):
    id: str
    notebookId: str
    name: str


class PageCreate(BaseModel):
    id: str
    sectionId: str
    title: str
    content: str


class PageUpdate(BaseModel):
    title: str
    content: str


class NotebookUpdate(BaseModel):
    name: str


class NotebookArchiveBody(BaseModel):
    archived: bool


class ProfileUpdate(BaseModel):
    name: str | None = None
    email: str | None = None


class SectionUpdate(BaseModel):
    name: str


def _bookshelf_owned(db: sqlite3.Connection, bookshelf_id: str, user_id: int) -> bool:
    row = db.execute(
        "SELECT 1 FROM bookshelves WHERE id = ? AND userId = ?",
        (bookshelf_id, user_id),
    ).fetchone()
    return row is not None


def _notebook_owned(db: sqlite3.Connection, notebook_id: str, user_id: int) -> bool:
    row = db.execute(
        "SELECT 1 FROM notebooks WHERE id = ? AND userId = ?",
        (notebook_id, user_id),
    ).fetchone()
    return row is not None


def _section_owned(db: sqlite3.Connection, section_id: str, user_id: int) -> bool:
    row = db.execute(
        """
        SELECT 1 FROM sections s
        INNER JOIN notebooks n ON n.id = s.notebookId
        WHERE s.id = ? AND n.userId = ?
        """,
        (section_id, user_id),
    ).fetchone()
    return row is not None


def _page_owned(db: sqlite3.Connection, page_id: str, user_id: int) -> bool:
    row = db.execute(
        """
        SELECT 1 FROM pages p
        INNER JOIN sections s ON s.id = p.sectionId
        INNER JOIN notebooks n ON n.id = s.notebookId
        WHERE p.id = ? AND n.userId = ?
        """,
        (page_id, user_id),
    ).fetchone()
    return row is not None


app = FastAPI(title="Lumina Notes", docs_url="/swagger", openapi_url="/openapi.json")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()


@app.post("/api/auth/signup")
def auth_signup(body: SignupBody, db: Db):
    email = body.email.strip()
    if not email:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Email is required"
        )
    uname: str | None = None
    if body.username is not None and str(body.username).strip():
        uname = _normalize_username(body.username)
    hashed = hash_password(body.password)
    try:
        cur = db.execute(
            "INSERT INTO users (email, password, name, username) VALUES (?, ?, ?, ?)",
            (email, hashed, body.name, uname),
        )
        user_id = int(cur.lastrowid)
    except sqlite3.IntegrityError:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Email or username already exists",
        )
    _insert_default_bookshelf(db, user_id)
    row = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    assert row is not None
    token = create_token(user_id, row["email"], row["name"])
    return {"token": token, "user": _row_to_user(row)}


@app.post("/api/auth/login")
def auth_login(body: LoginBody, db: Db):
    key = body.login_key()
    if not key:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Email or username is required",
        )
    row = db.execute(
        """
        SELECT * FROM users
        WHERE lower(trim(email)) = lower(trim(?))
           OR (username IS NOT NULL AND lower(trim(username)) = lower(trim(?)))
        """,
        (key, key),
    ).fetchone()
    if row is not None:
        if not verify_password(body.password, row["password"]):
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
            )
        user_id = int(row["id"])
        return {
            "token": create_token(user_id, row["email"], row["name"]),
            "user": _row_to_user(row),
        }

    # Django admin / staff users live in auth_user (PBKDF2), not in users — link on first app login
    try:
        dj = db.execute(
            """
            SELECT id, username, email, password, first_name, last_name
            FROM auth_user
            WHERE lower(trim(COALESCE(email, ''))) = lower(trim(?))
               OR lower(trim(username)) = lower(trim(?))
            """,
            (key, key),
        ).fetchone()
    except sqlite3.OperationalError:
        dj = None

    if dj is None or not _django_check_password(body.password, dj["password"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    user_id, email, name = _link_django_user(db, body, dj)
    row2 = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    udict = (
        _row_to_user(row2)
        if row2 is not None
        else {"id": user_id, "email": email, "name": name}
    )
    return {
        "token": create_token(user_id, email, name),
        "user": udict,
    }


@app.get("/api/auth/me")
def auth_me(user: CurrentUser, db: Db):
    row = db.execute(
        "SELECT id, email, name, username FROM users WHERE id = ?",
        (user["id"],),
    ).fetchone()
    if row is None:
        return user
    return _row_to_user(row)


@app.put("/api/auth/profile")
def auth_profile_update(user: CurrentUser, body: ProfileUpdate, db: Db):
    row = db.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
    name = (body.name.strip() if body.name is not None else None) or row["name"]
    email = (body.email.strip() if body.email is not None else None) or row["email"]
    if not email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Email is required")
    if body.email is not None:
        other = db.execute(
            "SELECT id FROM users WHERE lower(trim(email)) = lower(trim(?)) AND id != ?",
            (email, user["id"]),
        ).fetchone()
        if other is not None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, detail="Email already in use"
            )
    db.execute(
        "UPDATE users SET name = ?, email = ? WHERE id = ?",
        (name, email, user["id"]),
    )
    row2 = db.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
    assert row2 is not None
    u = _row_to_user(row2)
    token = create_token(int(u["id"]), u["email"], u["name"])
    return {"token": token, "user": u}


@app.get("/api/user/stats")
def user_stats(user: CurrentUser, db: Db):
    uid = user["id"]
    active_nb = db.execute(
        "SELECT COUNT(*) FROM notebooks WHERE userId = ? AND archived = 0",
        (uid,),
    ).fetchone()[0]
    archived_nb = db.execute(
        "SELECT COUNT(*) FROM notebooks WHERE userId = ? AND archived = 1",
        (uid,),
    ).fetchone()[0]
    sec_row = db.execute(
        """
        SELECT COUNT(DISTINCT s.id)
        FROM sections s
        INNER JOIN notebooks n ON n.id = s.notebookId
        WHERE n.userId = ? AND n.archived = 0
        """,
        (uid,),
    ).fetchone()
    sections_active = int(sec_row[0] or 0)
    page_row = db.execute(
        """
        SELECT COUNT(p.id),
               COALESCE(SUM(LENGTH(COALESCE(p.content, '')) + LENGTH(COALESCE(p.title, ''))), 0)
        FROM pages p
        INNER JOIN sections s ON s.id = p.sectionId
        INNER JOIN notebooks n ON n.id = s.notebookId
        WHERE n.userId = ? AND n.archived = 0
        """,
        (uid,),
    ).fetchone()
    pages_active = int(page_row[0] or 0)
    storage_bytes = int(page_row[1] or 0)
    archived_pages = db.execute(
        """
        SELECT COUNT(p.id)
        FROM pages p
        INNER JOIN sections s ON s.id = p.sectionId
        INNER JOIN notebooks n ON n.id = s.notebookId
        WHERE n.userId = ? AND n.archived = 1
        """,
        (uid,),
    ).fetchone()[0]
    return {
        "storageBytes": storage_bytes,
        "notebooksActive": int(active_nb),
        "notebooksArchived": int(archived_nb),
        "sectionsActive": sections_active,
        "pagesActive": pages_active,
        "pagesArchived": int(archived_pages or 0),
    }


@app.get("/api/bookshelves")
def list_bookshelves(user: CurrentUser, db: Db):
    rows = db.execute(
        "SELECT * FROM bookshelves WHERE userId = ? ORDER BY createdAt ASC, id ASC",
        (user["id"],),
    ).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/bookshelves")
def create_bookshelf(user: CurrentUser, body: BookshelfCreate, db: Db):
    try:
        db.execute(
            "INSERT INTO bookshelves (id, userId, name) VALUES (?, ?, ?)",
            (body.id, user["id"], body.name),
        )
    except sqlite3.IntegrityError:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Bookshelf id already exists",
        )
    return {"id": body.id, "name": body.name}


@app.put("/api/bookshelves/{bookshelf_id}")
def update_bookshelf(
    bookshelf_id: str, user: CurrentUser, body: BookshelfUpdate, db: Db
):
    if not _bookshelf_owned(db, bookshelf_id, user["id"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Bookshelf not found")
    db.execute(
        "UPDATE bookshelves SET name = ? WHERE id = ? AND userId = ?",
        (body.name, bookshelf_id, user["id"]),
    )
    return {"id": bookshelf_id, "name": body.name}


@app.delete("/api/bookshelves/{bookshelf_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bookshelf(bookshelf_id: str, user: CurrentUser, db: Db):
    if not _bookshelf_owned(db, bookshelf_id, user["id"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Bookshelf not found")
    n = db.execute(
        "SELECT COUNT(*) FROM notebooks WHERE bookshelfId = ?",
        (bookshelf_id,),
    ).fetchone()[0]
    if int(n or 0) > 0:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Move or delete notebooks before deleting this bookshelf",
        )
    db.execute(
        "DELETE FROM bookshelves WHERE id = ? AND userId = ?",
        (bookshelf_id, user["id"]),
    )
    return None


@app.get("/api/notebooks")
def list_notebooks(
    user: CurrentUser,
    db: Db,
    archived: bool = False,
    bookshelf_id: str = Query(..., alias="bookshelfId"),
):
    if not _bookshelf_owned(db, bookshelf_id, user["id"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Bookshelf not found")
    rows = db.execute(
        """
        SELECT * FROM notebooks
        WHERE userId = ? AND bookshelfId = ? AND archived = ?
        """,
        (user["id"], bookshelf_id, 1 if archived else 0),
    ).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/notebooks")
def create_notebook(user: CurrentUser, body: NotebookCreate, db: Db):
    if not _bookshelf_owned(db, body.bookshelfId, user["id"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Bookshelf not found")
    try:
        db.execute(
            """
            INSERT INTO notebooks (id, userId, name, bookshelfId)
            VALUES (?, ?, ?, ?)
            """,
            (body.id, user["id"], body.name, body.bookshelfId),
        )
    except sqlite3.IntegrityError:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Notebook id already exists",
        )
    return {
        "id": body.id,
        "name": body.name,
        "bookshelfId": body.bookshelfId,
    }


@app.put("/api/notebooks/{notebook_id}")
def update_notebook(notebook_id: str, user: CurrentUser, body: NotebookUpdate, db: Db):
    if not _notebook_owned(db, notebook_id, user["id"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Notebook not found")
    db.execute(
        "UPDATE notebooks SET name = ? WHERE id = ? AND userId = ?",
        (body.name, notebook_id, user["id"]),
    )
    return {"id": notebook_id, "name": body.name}


@app.patch("/api/notebooks/{notebook_id}/archive")
def notebook_set_archive(
    notebook_id: str,
    user: CurrentUser,
    body: NotebookArchiveBody,
    db: Db,
):
    if not _notebook_owned(db, notebook_id, user["id"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Notebook not found")
    db.execute(
        "UPDATE notebooks SET archived = ? WHERE id = ? AND userId = ?",
        (1 if body.archived else 0, notebook_id, user["id"]),
    )
    return {"id": notebook_id, "archived": body.archived}


@app.delete("/api/notebooks/{notebook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notebook(notebook_id: str, user: CurrentUser, db: Db):
    if not _notebook_owned(db, notebook_id, user["id"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Notebook not found")
    db.execute(
        "DELETE FROM pages WHERE sectionId IN (SELECT id FROM sections WHERE notebookId = ?)",
        (notebook_id,),
    )
    db.execute("DELETE FROM sections WHERE notebookId = ?", (notebook_id,))
    db.execute(
        "DELETE FROM notebooks WHERE id = ? AND userId = ?",
        (notebook_id, user["id"]),
    )
    return None


@app.get("/api/sections/{notebook_id}")
def list_sections(notebook_id: str, user: CurrentUser, db: Db):
    if not _notebook_owned(db, notebook_id, user["id"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Notebook not found")
    rows = db.execute(
        "SELECT * FROM sections WHERE notebookId = ?", (notebook_id,)
    ).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/sections")
def create_section(user: CurrentUser, body: SectionCreate, db: Db):
    if not _notebook_owned(db, body.notebookId, user["id"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Notebook not found")
    db.execute(
        "INSERT INTO sections (id, notebookId, name) VALUES (?, ?, ?)",
        (body.id, body.notebookId, body.name),
    )
    return {"id": body.id, "notebookId": body.notebookId, "name": body.name}


@app.put("/api/sections/{section_id}")
def update_section(section_id: str, user: CurrentUser, body: SectionUpdate, db: Db):
    if not _section_owned(db, section_id, user["id"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Section not found")
    db.execute(
        "UPDATE sections SET name = ? WHERE id = ?",
        (body.name, section_id),
    )
    return {"id": section_id, "name": body.name}


@app.delete("/api/sections/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_section(section_id: str, user: CurrentUser, db: Db):
    if not _section_owned(db, section_id, user["id"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Section not found")
    db.execute("DELETE FROM pages WHERE sectionId = ?", (section_id,))
    db.execute("DELETE FROM sections WHERE id = ?", (section_id,))
    return None


@app.get("/api/pages/{section_id}")
def list_pages(section_id: str, user: CurrentUser, db: Db):
    if not _section_owned(db, section_id, user["id"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Section not found")
    rows = db.execute(
        "SELECT * FROM pages WHERE sectionId = ?", (section_id,)
    ).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/pages")
def create_page(user: CurrentUser, body: PageCreate, db: Db):
    if not _section_owned(db, body.sectionId, user["id"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Section not found")
    db.execute(
        "INSERT INTO pages (id, sectionId, title, content) VALUES (?, ?, ?, ?)",
        (body.id, body.sectionId, body.title, body.content),
    )
    return {
        "id": body.id,
        "sectionId": body.sectionId,
        "title": body.title,
        "content": body.content,
    }


@app.put("/api/pages/{page_id}")
def update_page(page_id: str, user: CurrentUser, body: PageUpdate, db: Db):
    if not _page_owned(db, page_id, user["id"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Page not found")
    db.execute(
        "UPDATE pages SET title = ?, content = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
        (body.title, body.content, page_id),
    )
    return {"id": page_id, "title": body.title, "content": body.content}


@app.delete("/api/pages/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_page(page_id: str, user: CurrentUser, db: Db):
    if not _page_owned(db, page_id, user["id"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Page not found")
    db.execute("DELETE FROM pages WHERE id = ?", (page_id,))
    return None


def _serve_dist_file(full_path: str):
    if full_path.startswith("api"):
        raise HTTPException(status.HTTP_404_NOT_FOUND)

    base = DIST_DIR.resolve()
    if not base.is_dir():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Frontend not built. Run: npm run build",
        )

    if not full_path:
        index = base / "index.html"
        if index.is_file():
            return FileResponse(index)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="Missing dist/index.html")

    candidate = (base / full_path).resolve()
    try:
        candidate.relative_to(base)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND)

    if candidate.is_file():
        return FileResponse(candidate)

    index = base / "index.html"
    if index.is_file():
        return FileResponse(index)
    raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="Missing dist/index.html")


@app.get("/")
async def spa_index():
    return _serve_dist_file("")


@app.get("/{full_path:path}")
async def spa_or_static(full_path: str):
    """Serve Vite build; SPA fallback to index.html."""
    return _serve_dist_file(full_path)
