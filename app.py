"""Lumina Notes API: FastAPI + SQLite (desktop) / PostgreSQL (server prod)."""
from __future__ import annotations

import os
import re
import sys
import time
import logging
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.middleware.cors import CORSMiddleware
import bcrypt
from jose import JWTError, jwt
from pydantic import BaseModel, Field, field_validator, model_validator

import db as database
from db import Connection, IntegrityError, OperationalError, SQLITE_PATH, USE_POSTGRES
from export_document import render_pdf_bytes


def _paths() -> tuple[Path, Path]:
    """DB next to the executable when frozen (writable); static assets from bundle."""
    if getattr(sys, "frozen", False):
        exe_dir = Path(sys.executable).resolve().parent
        bundle = Path(getattr(sys, "_MEIPASS", exe_dir))
        return exe_dir / "database.sqlite", bundle / "dist"
    root = Path(__file__).resolve().parent
    return root / "database.sqlite", root / "dist"


_DB_PATH_LEGACY, DIST_DIR = _paths()
DB_PATH = SQLITE_PATH

LUMINA_ENV = os.environ.get("LUMINA_ENV", "development").strip().lower()
IS_PRODUCTION = LUMINA_ENV in ("production", "prod")

logging.basicConfig(
    level=logging.INFO if IS_PRODUCTION else logging.DEBUG,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("lumina")

# ponytail: Sentry only when DSN set; skip OpenTelemetry until traces matter
_sentry_dsn = (os.environ.get("SENTRY_DSN") or "").strip()
if _sentry_dsn:
    try:
        import sentry_sdk

        sentry_sdk.init(dsn=_sentry_dsn, environment=LUMINA_ENV, traces_sample_rate=0.0)
        logger.info("Sentry enabled")
    except ImportError:
        logger.warning("SENTRY_DSN set but sentry-sdk not installed")

# Same SQLite file for FastAPI + Django; these are the dev URLs that talk to that DB over HTTP.
_DEFAULT_CORS = (
    "http://127.0.0.1:5173,"
    "http://127.0.0.1:8001,"
    "http://127.0.0.1:58888"
)
_raw_cors = os.environ.get("CORS_ORIGINS", _DEFAULT_CORS).strip()
if _raw_cors == "*":
    if IS_PRODUCTION:
        raise RuntimeError(
            "CORS_ORIGINS='*' is not allowed in production with credentials. "
            "Set explicit origins, e.g. https://app.example.com"
        )
    CORS_ORIGINS = ["*"]
else:
    CORS_ORIGINS = [o.strip() for o in _raw_cors.split(",") if o.strip()]

_PLACEHOLDER_SECRETS = {
    "",
    "change-me-in-production",
    "lumina-notes-secret-key",
    "your_super_secret_key_here",
}


def _resolve_jwt_secret() -> str:
    secret = (os.environ.get("JWT_SECRET") or "").strip()
    if IS_PRODUCTION:
        if secret in _PLACEHOLDER_SECRETS:
            raise RuntimeError(
                "JWT_SECRET must be set to a strong non-placeholder value when LUMINA_ENV=production"
            )
        return secret
    if secret in _PLACEHOLDER_SECRETS or not secret:
        return "lumina-notes-dev-only-secret"
    return secret


JWT_SECRET = _resolve_jwt_secret()
JWT_EXPIRE_HOURS = int(os.environ.get("JWT_EXPIRE_HOURS", "24"))
ALGORITHM = "HS256"

# Never seed demo accounts in production, even if SEED_DEMO_USER=1 is misconfigured.
SEED_DEMO_USER = False if IS_PRODUCTION else (
    os.environ.get("SEED_DEMO_USER", "1").strip().lower()
    not in ("0", "false", "no", "")
)

ENABLE_DOCS = os.environ.get(
    "ENABLE_DOCS",
    "0" if IS_PRODUCTION else "1",
).strip().lower() not in ("0", "false", "no", "")

AUTH_RATE_LIMIT = int(os.environ.get("AUTH_RATE_LIMIT", "20"))
AUTH_RATE_WINDOW_SEC = int(os.environ.get("AUTH_RATE_WINDOW_SEC", "60"))

SCHEMA_VERSION = "2"

security = HTTPBearer(auto_error=False)

_auth_hits: dict[str, deque[float]] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if forwarded:
        return forwarded
    if request.client:
        return request.client.host
    return "unknown"


def _rate_limit_auth(request: Request) -> None:
    key = f"auth:{_client_ip(request)}"
    now = time.monotonic()
    bucket = _auth_hits[key]
    while bucket and now - bucket[0] > AUTH_RATE_WINDOW_SEC:
        bucket.popleft()
    if len(bucket) >= AUTH_RATE_LIMIT:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many auth attempts. Try again shortly.",
        )
    bucket.append(now)


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

SCHEMA = database.SCHEMA_SQLITE


def _migrate_bookshelves(conn: Connection) -> None:
    """Create bookshelves table, add notebooks.bookshelfId, backfill per-user defaults."""
    if conn.dialect == "sqlite":
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
        except OperationalError:
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


def _insert_default_bookshelf(db: Connection, user_id: int) -> None:
    """Ensure a new Lumina user has a default shelf (same id pattern as migration)."""
    bid = f"bs-{user_id}-default"
    db.execute(
        "INSERT OR IGNORE INTO bookshelves (id, userId, name) VALUES (?, ?, ?)",
        (bid, user_id, "My bookshelf"),
    )


def _seed_demo_user(conn: Connection) -> None:
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
    conn = database.connect()
    try:
        database.init_schema(conn)
        _migrate_bookshelves(conn)
        conn.execute(
            "INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)",
            ("version", SCHEMA_VERSION),
        )
        if SEED_DEMO_USER:
            _seed_demo_user(conn)
        conn.commit()
    finally:
        conn.close()


def get_db():
    conn = database.connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


Db = Annotated[Connection, Depends(get_db)]


def create_token(user_id: int, email: str, name: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "id": user_id,
        "email": email,
        "name": name,
        "iat": now,
        "exp": now + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


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


def _link_django_user(db: Connection, body: "LoginBody", dj: Any) -> tuple[int, str, str]:
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


def _row_to_user(row: Any) -> dict[str, Any]:
    d = {k: row[k] for k in row.keys()}
    return {
        "id": int(d["id"]),
        "email": d["email"],
        "name": d["name"],
        "username": d.get("username"),
    }


_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_ENTITY_ID_RE = re.compile(r"^[A-Za-z0-9._:-]+$")


def _collapse_ws(value: str) -> str:
    return " ".join(value.split()).strip()


class SignupBody(BaseModel):
    email: str = Field(..., min_length=1, max_length=254)
    password: str = Field(..., min_length=6, max_length=128)
    name: str = Field(..., min_length=1, max_length=80)
    username: str | None = Field(None, max_length=32)

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str) -> str:
        email = v.strip().lower()
        if not _EMAIL_RE.match(email):
            raise ValueError("Enter a valid email address")
        return email

    @field_validator("name")
    @classmethod
    def _valid_name(cls, v: str) -> str:
        name = _collapse_ws(v)
        if not name:
            raise ValueError("Name is required")
        return name


class LoginBody(BaseModel):
    password: str = Field(..., min_length=1, max_length=128)
    identifier: str | None = Field(None, max_length=254)
    email: str | None = Field(None, max_length=254)  # legacy: same as identifier

    @model_validator(mode="after")
    def _require_login_identifier(self) -> "LoginBody":
        if not (self.identifier or self.email):
            raise ValueError("identifier or email required")
        return self

    def login_key(self) -> str:
        return (self.identifier or self.email or "").strip()


class BookshelfCreate(BaseModel):
    id: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=120)

    @field_validator("id")
    @classmethod
    def _valid_id(cls, v: str) -> str:
        vid = v.strip()
        if not _ENTITY_ID_RE.match(vid):
            raise ValueError("Id contains invalid characters")
        return vid

    @field_validator("name")
    @classmethod
    def _valid_name(cls, v: str) -> str:
        name = _collapse_ws(v)
        if not name:
            raise ValueError("Name is required")
        return name


class BookshelfUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def _valid_name(cls, v: str) -> str:
        name = _collapse_ws(v)
        if not name:
            raise ValueError("Name is required")
        return name


class NotebookCreate(BaseModel):
    id: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=120)
    bookshelfId: str = Field(..., min_length=1, max_length=64)

    @field_validator("id", "bookshelfId")
    @classmethod
    def _valid_ids(cls, v: str) -> str:
        vid = v.strip()
        if not _ENTITY_ID_RE.match(vid):
            raise ValueError("Id contains invalid characters")
        return vid

    @field_validator("name")
    @classmethod
    def _valid_name(cls, v: str) -> str:
        name = _collapse_ws(v)
        if not name:
            raise ValueError("Name is required")
        return name


class SectionCreate(BaseModel):
    id: str = Field(..., min_length=1, max_length=64)
    notebookId: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=120)

    @field_validator("id", "notebookId")
    @classmethod
    def _valid_ids(cls, v: str) -> str:
        vid = v.strip()
        if not _ENTITY_ID_RE.match(vid):
            raise ValueError("Id contains invalid characters")
        return vid

    @field_validator("name")
    @classmethod
    def _valid_name(cls, v: str) -> str:
        name = _collapse_ws(v)
        if not name:
            raise ValueError("Name is required")
        return name


class PageCreate(BaseModel):
    id: str = Field(..., min_length=1, max_length=64)
    sectionId: str = Field(..., min_length=1, max_length=64)
    title: str = Field(..., min_length=1, max_length=120)
    content: str = Field(..., max_length=2_000_000)

    @field_validator("id", "sectionId")
    @classmethod
    def _valid_ids(cls, v: str) -> str:
        vid = v.strip()
        if not _ENTITY_ID_RE.match(vid):
            raise ValueError("Id contains invalid characters")
        return vid

    @field_validator("title")
    @classmethod
    def _valid_title(cls, v: str) -> str:
        title = _collapse_ws(v) or "Untitled"
        return title[:120]


class PageUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    content: str = Field(..., max_length=2_000_000)

    @field_validator("title")
    @classmethod
    def _valid_title(cls, v: str) -> str:
        title = _collapse_ws(v) or "Untitled"
        return title[:120]


class NotebookUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def _valid_name(cls, v: str) -> str:
        name = _collapse_ws(v)
        if not name:
            raise ValueError("Name is required")
        return name


class NotebookArchiveBody(BaseModel):
    archived: bool


class PasswordChange(BaseModel):
    currentPassword: str = Field(..., min_length=1, max_length=128)
    newPassword: str = Field(..., min_length=6, max_length=128)


class ProfileUpdate(BaseModel):
    name: str | None = Field(None, max_length=80)
    email: str | None = Field(None, max_length=254)
    username: str | None = Field(None, max_length=32)

    @field_validator("name")
    @classmethod
    def _valid_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        name = _collapse_ws(v)
        if not name:
            raise ValueError("Name is required")
        return name

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str | None) -> str | None:
        if v is None:
            return None
        email = v.strip().lower()
        if not email or not _EMAIL_RE.match(email):
            raise ValueError("Enter a valid email address")
        return email


class SectionUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def _valid_name(cls, v: str) -> str:
        name = _collapse_ws(v)
        if not name:
            raise ValueError("Name is required")
        return name


def _bookshelf_owned(db: Connection, bookshelf_id: str, user_id: int) -> bool:
    row = db.execute(
        "SELECT 1 FROM bookshelves WHERE id = ? AND userId = ?",
        (bookshelf_id, user_id),
    ).fetchone()
    return row is not None


def _notebook_owned(db: Connection, notebook_id: str, user_id: int) -> bool:
    row = db.execute(
        "SELECT 1 FROM notebooks WHERE id = ? AND userId = ?",
        (notebook_id, user_id),
    ).fetchone()
    return row is not None


def _section_owned(db: Connection, section_id: str, user_id: int) -> bool:
    row = db.execute(
        """
        SELECT 1 FROM sections s
        INNER JOIN notebooks n ON n.id = s.notebookId
        WHERE s.id = ? AND n.userId = ?
        """,
        (section_id, user_id),
    ).fetchone()
    return row is not None


def _page_owned(db: Connection, page_id: str, user_id: int) -> bool:
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


app = FastAPI(
    title="Lumina Notes",
    docs_url="/swagger" if ENABLE_DOCS else None,
    redoc_url="/redoc" if ENABLE_DOCS else None,
    openapi_url="/openapi.json" if ENABLE_DOCS else None,
)

_cors_wildcard = CORS_ORIGINS == ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    # Browsers reject Access-Control-Allow-Origin: * with credentials
    allow_credentials=not _cors_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Permissions-Policy", "camera=(), microphone=(), geolocation=()"
    )
    # ponytail: unsafe-inline/eval needed for Vite + Mermaid/Plotly; hash nonces later if CDN-free
    if "Content-Security-Policy" not in response.headers:
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob: https:; "
            "font-src 'self' data:; "
            "connect-src 'self' https:; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
    return response


@app.on_event("startup")
def _startup() -> None:
    init_db()
    log = logging.getLogger("lumina")
    log.info(
        "startup env=%s docs=%s seed_demo=%s db=%s",
        LUMINA_ENV,
        ENABLE_DOCS,
        SEED_DEMO_USER,
        "postgres" if USE_POSTGRES else str(DB_PATH),
    )


@app.get("/health", response_model=None)
def health():
    """Liveness + DB readiness for container / Kubernetes probes."""
    try:
        info = database.ping()
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unavailable",
                "database": "error",
                "detail": str(exc),
            },
        )
    return {
        "status": "ok",
        "database": info.get("database", "ok"),
        "driver": info.get("driver"),
        "schema_version": info.get("schema_version"),
        "env": LUMINA_ENV,
    }


@app.get("/ready", response_model=None)
def ready():
    """Alias for /health (DB-ready)."""
    return health()


@app.post("/api/auth/signup")
def auth_signup(request: Request, body: SignupBody, db: Db):
    _rate_limit_auth(request)
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
    except IntegrityError:
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
def auth_login(request: Request, body: LoginBody, db: Db):
    _rate_limit_auth(request)
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
    except OperationalError:
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


@app.put("/api/auth/password")
def auth_password_change(
    request: Request, user: CurrentUser, body: PasswordChange, db: Db
):
    _rate_limit_auth(request)
    if body.currentPassword == body.newPassword:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password",
        )
    row = db.execute(
        "SELECT id, password FROM users WHERE id = ?", (user["id"],)
    ).fetchone()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
    if not verify_password(body.currentPassword, row["password"]):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect"
        )
    db.execute(
        "UPDATE users SET password = ? WHERE id = ?",
        (hash_password(body.newPassword), user["id"]),
    )
    return {"ok": True}


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
    username = row["username"]
    if "username" in body.model_fields_set:
        username = _normalize_username(body.username)
        if username is not None:
            clash = db.execute(
                """
                SELECT id FROM users
                WHERE username IS NOT NULL
                  AND lower(trim(username)) = lower(trim(?))
                  AND id != ?
                """,
                (username, user["id"]),
            ).fetchone()
            if clash is not None:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST, detail="Username already in use"
                )
    db.execute(
        "UPDATE users SET name = ?, email = ?, username = ? WHERE id = ?",
        (name, email, username, user["id"]),
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


def _export_user_library(db: Connection, user_id: int) -> dict[str, Any]:
    shelves = db.execute(
        "SELECT id, name, createdAt FROM bookshelves WHERE userId = ? ORDER BY createdAt ASC, id ASC",
        (user_id,),
    ).fetchall()
    shelf_payload: list[dict[str, Any]] = []
    for sh in shelves:
        notebooks = db.execute(
            """
            SELECT id, name, archived, createdAt
            FROM notebooks
            WHERE userId = ? AND bookshelfId = ?
            ORDER BY createdAt ASC, id ASC
            """,
            (user_id, sh["id"]),
        ).fetchall()
        nb_payload: list[dict[str, Any]] = []
        for nb in notebooks:
            sections = db.execute(
                "SELECT id, name, createdAt FROM sections WHERE notebookId = ? ORDER BY createdAt ASC, id ASC",
                (nb["id"],),
            ).fetchall()
            sec_payload: list[dict[str, Any]] = []
            for sec in sections:
                pages = db.execute(
                    """
                    SELECT id, title, content, updatedAt
                    FROM pages WHERE sectionId = ?
                    ORDER BY updatedAt ASC, id ASC
                    """,
                    (sec["id"],),
                ).fetchall()
                sec_payload.append(
                    {
                        "id": sec["id"],
                        "name": sec["name"],
                        "createdAt": sec["createdAt"],
                        "pages": [
                            {
                                "id": p["id"],
                                "title": p["title"],
                                "content": p["content"] or "",
                                "updatedAt": p["updatedAt"],
                            }
                            for p in pages
                        ],
                    }
                )
            nb_payload.append(
                {
                    "id": nb["id"],
                    "name": nb["name"],
                    "archived": bool(nb["archived"]),
                    "createdAt": nb["createdAt"],
                    "sections": sec_payload,
                }
            )
        shelf_payload.append(
            {
                "id": sh["id"],
                "name": sh["name"],
                "createdAt": sh["createdAt"],
                "notebooks": nb_payload,
            }
        )
    return {"bookshelves": shelf_payload}


def _delete_user_library(db: Connection, user_id: int) -> None:
    notebooks = db.execute(
        "SELECT id FROM notebooks WHERE userId = ?", (user_id,)
    ).fetchall()
    for nb in notebooks:
        sections = db.execute(
            "SELECT id FROM sections WHERE notebookId = ?", (nb["id"],)
        ).fetchall()
        for sec in sections:
            db.execute("DELETE FROM pages WHERE sectionId = ?", (sec["id"],))
        db.execute("DELETE FROM sections WHERE notebookId = ?", (nb["id"],))
    db.execute("DELETE FROM notebooks WHERE userId = ?", (user_id,))
    db.execute("DELETE FROM bookshelves WHERE userId = ?", (user_id,))


def _import_user_library(db: Connection, user_id: int, payload: dict[str, Any]) -> None:
    shelves = payload.get("bookshelves")
    if not isinstance(shelves, list):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Invalid backup: bookshelves required"
        )
    _delete_user_library(db, user_id)
    if not shelves:
        _insert_default_bookshelf(db, user_id)
        return
    for sh in shelves:
        if not isinstance(sh, dict) or not sh.get("id") or not sh.get("name"):
            continue
        try:
            db.execute(
                "INSERT INTO bookshelves (id, userId, name) VALUES (?, ?, ?)",
                (str(sh["id"]), user_id, str(sh["name"])),
            )
        except IntegrityError:
            sid = f"bs-{user_id}-{int(time.time() * 1000)}"
            db.execute(
                "INSERT INTO bookshelves (id, userId, name) VALUES (?, ?, ?)",
                (sid, user_id, str(sh["name"])),
            )
            sh = {**sh, "id": sid}
        for nb in sh.get("notebooks") or []:
            if not isinstance(nb, dict) or not nb.get("id") or not nb.get("name"):
                continue
            nb_id = str(nb["id"])
            try:
                db.execute(
                    """
                    INSERT INTO notebooks (id, userId, bookshelfId, name, archived)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        nb_id,
                        user_id,
                        str(sh["id"]),
                        str(nb["name"]),
                        1 if nb.get("archived") else 0,
                    ),
                )
            except IntegrityError:
                nb_id = f"nb-{user_id}-{int(time.time() * 1000)}"
                db.execute(
                    """
                    INSERT INTO notebooks (id, userId, bookshelfId, name, archived)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        nb_id,
                        user_id,
                        str(sh["id"]),
                        str(nb["name"]),
                        1 if nb.get("archived") else 0,
                    ),
                )
            for sec in nb.get("sections") or []:
                if not isinstance(sec, dict) or not sec.get("id") or not sec.get("name"):
                    continue
                sec_id = str(sec["id"])
                try:
                    db.execute(
                        "INSERT INTO sections (id, notebookId, name) VALUES (?, ?, ?)",
                        (sec_id, nb_id, str(sec["name"])),
                    )
                except IntegrityError:
                    sec_id = f"sec-{user_id}-{int(time.time() * 1000)}"
                    db.execute(
                        "INSERT INTO sections (id, notebookId, name) VALUES (?, ?, ?)",
                        (sec_id, nb_id, str(sec["name"])),
                    )
                for page in sec.get("pages") or []:
                    if not isinstance(page, dict) or not page.get("id"):
                        continue
                    page_id = str(page["id"])
                    title = str(page.get("title") or "Untitled")
                    content = str(page.get("content") or "")
                    try:
                        db.execute(
                            """
                            INSERT INTO pages (id, sectionId, title, content)
                            VALUES (?, ?, ?, ?)
                            """,
                            (page_id, sec_id, title, content),
                        )
                    except IntegrityError:
                        page_id = f"page-{user_id}-{int(time.time() * 1000)}"
                        db.execute(
                            """
                            INSERT INTO pages (id, sectionId, title, content)
                            VALUES (?, ?, ?, ?)
                            """,
                            (page_id, sec_id, title, content),
                        )


@app.get("/api/user/backup")
def user_backup(user: CurrentUser, db: Db):
    row = db.execute(
        "SELECT id, email, name, username FROM users WHERE id = ?",
        (user["id"],),
    ).fetchone()
    library = _export_user_library(db, user["id"])
    return {
        "format": "lumina-notes-backup",
        "version": 1,
        "exportedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "user": _row_to_user(row) if row is not None else user,
        **library,
    }


@app.post("/api/user/backup/import")
def user_backup_import(user: CurrentUser, body: dict[str, Any], db: Db):
    if body.get("format") not in (None, "lumina-notes-backup") and "bookshelves" not in body:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Unrecognized backup file")
    _import_user_library(db, user["id"], body)
    return {"ok": True, "stats": user_stats(user, db)}


@app.delete("/api/user/data")
def user_delete_data(user: CurrentUser, db: Db):
    _delete_user_library(db, user["id"])
    _insert_default_bookshelf(db, user["id"])
    return {"ok": True}


@app.delete("/api/auth/account")
def auth_close_account(user: CurrentUser, db: Db):
    _delete_user_library(db, user["id"])
    db.execute("DELETE FROM users WHERE id = ?", (user["id"],))
    return {"ok": True}


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
    except IntegrityError:
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
    except IntegrityError:
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


class ExportPdfBody(BaseModel):
    title: str = Field(default="Untitled", max_length=500)
    markdown: str = Field(default="", max_length=1_500_000)
    filename: str = Field(default="note", max_length=200)

    @field_validator("filename")
    @classmethod
    def clean_filename(cls, v: str) -> str:
        stem = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "", (v or "note")).strip() or "note"
        return stem[:180]


@app.post("/api/export/pdf")
def export_pdf(user: CurrentUser, body: ExportPdfBody):
    """Render page Markdown → HTML → PDF via Chrome/Edge (or Playwright)."""
    try:
        pdf = render_pdf_bytes(body.title, body.markdown, body.filename)
    except Exception as e:
        logger.exception("PDF export failed for user=%s", user.get("id"))
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e) or "PDF export unavailable",
        ) from e
    headers = {
        "Content-Disposition": f'attachment; filename="{body.filename}.pdf"',
    }
    return Response(content=pdf, media_type="application/pdf", headers=headers)


def _serve_dist_file(full_path: str):
    reserved = {
        "api",
        "health",
        "ready",
        "swagger",
        "redoc",
        "openapi.json",
        "docs",
    }
    head = (full_path or "").split("/", 1)[0].lower()
    if head in reserved or full_path.startswith("api"):
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
