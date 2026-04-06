"""Lumina Notes API: FastAPI + SQLite."""
from __future__ import annotations

import os
import re
import sqlite3
import sys
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends, FastAPI, HTTPException, status
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

CREATE TABLE IF NOT EXISTS notebooks (
  id TEXT PRIMARY KEY,
  userId INTEGER,
  name TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(userId) REFERENCES users(id)
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


def init_db() -> None:
    conn = sqlite3.connect(DB_PATH)
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
    return int(cur.lastrowid), email, name


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


class NotebookCreate(BaseModel):
    id: str
    name: str


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


class SectionUpdate(BaseModel):
    name: str


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


@app.get("/api/notebooks")
def list_notebooks(user: CurrentUser, db: Db):
    rows = db.execute(
        "SELECT * FROM notebooks WHERE userId = ?", (user["id"],)
    ).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/notebooks")
def create_notebook(user: CurrentUser, body: NotebookCreate, db: Db):
    db.execute(
        "INSERT INTO notebooks (id, userId, name) VALUES (?, ?, ?)",
        (body.id, user["id"], body.name),
    )
    return {"id": body.id, "name": body.name}


@app.put("/api/notebooks/{notebook_id}")
def update_notebook(notebook_id: str, user: CurrentUser, body: NotebookUpdate, db: Db):
    if not _notebook_owned(db, notebook_id, user["id"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Notebook not found")
    db.execute(
        "UPDATE notebooks SET name = ? WHERE id = ? AND userId = ?",
        (body.name, notebook_id, user["id"]),
    )
    return {"id": notebook_id, "name": body.name}


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
