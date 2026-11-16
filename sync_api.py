"""Offline sync for mobile clients: pull changes since a cursor, push queued ops.

Conflict policy (v1): last-write-wins. An op is applied when its
``clientUpdatedAt`` is not older than the server row's ``updatedAt``; otherwise
it is ``stale`` and the current server row is returned so the client can adopt
it. ``updatedAt``/tombstones are maintained by DB triggers (see ``db.py``), so
legacy routes used by Electron feed the same change stream.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field, ValidationError

from db import Connection

MAX_OPS = 500
CURSOR_OVERLAP = timedelta(seconds=5)
_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{1,64}$")

Entity = Literal["bookshelf", "notebook", "section", "page"]


class PushOp(BaseModel):
    opId: str = Field(..., min_length=1, max_length=64)
    entity: Entity
    op: Literal["upsert", "delete"]
    id: str = Field(..., min_length=1, max_length=200)
    clientUpdatedAt: str = Field(..., min_length=1, max_length=40)
    data: dict[str, Any] | None = None


class PushBody(BaseModel):
    ops: list[PushOp] = Field(..., max_length=MAX_OPS)


# ------------------------------------------------------------------ time


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def parse_time(value: Any) -> datetime | None:
    """DB value (sqlite text / pg datetime) or client ISO string -> aware UTC datetime."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    s = str(value).strip().replace("Z", "+00:00")
    if " " in s and "T" not in s:
        s = s.replace(" ", "T", 1)
    dt = datetime.fromisoformat(s)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def iso(value: Any) -> str | None:
    dt = parse_time(value)
    if dt is None:
        return None
    return dt.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _time_param(db: Connection, dt: datetime) -> Any:
    if db.dialect == "postgres":
        return dt
    # Same shape as the trigger's strftime('%Y-%m-%d %H:%M:%f'): sorts as text.
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]


# ------------------------------------------------------------------ rows

_TABLE = {"bookshelf": "bookshelves", "notebook": "notebooks", "section": "sections", "page": "pages"}

# Row + owning user id (owner_id is NULL for orphans).
_SELECT_ONE = {
    "bookshelf": "SELECT b.*, b.userId AS owner_id FROM bookshelves b WHERE b.id = ?",
    "notebook": "SELECT n.*, n.userId AS owner_id FROM notebooks n WHERE n.id = ?",
    "section": (
        "SELECT s.*, n.userId AS owner_id FROM sections s "
        "LEFT JOIN notebooks n ON n.id = s.notebookId WHERE s.id = ?"
    ),
    "page": (
        "SELECT p.*, n.userId AS owner_id FROM pages p "
        "LEFT JOIN sections s ON s.id = p.sectionId "
        "LEFT JOIN notebooks n ON n.id = s.notebookId WHERE p.id = ?"
    ),
}

_PARENT = {
    "notebook": ("bookshelfId", "SELECT 1 FROM bookshelves WHERE id = ? AND userId = ?"),
    "section": ("notebookId", "SELECT 1 FROM notebooks WHERE id = ? AND userId = ?"),
    "page": (
        "sectionId",
        "SELECT 1 FROM sections s JOIN notebooks n ON n.id = s.notebookId "
        "WHERE s.id = ? AND n.userId = ?",
    ),
}


def _out(entity: str, row: Any) -> dict[str, Any]:
    d = {k: row[k] for k in row.keys()}
    d.pop("owner_id", None)
    for k in ("createdAt", "updatedAt"):
        if k in d:
            d[k] = iso(d[k])
    if entity == "notebook":
        d["archived"] = bool(d.get("archived"))
    if entity == "page" and d.get("content") is None:
        d["content"] = ""
    return d


def _current(entity: str, row: Any) -> dict[str, Any]:
    return {"entity": entity, **_out(entity, row)}


# ------------------------------------------------------------------ pull


def changes(db: Connection, user_id: int, since: str | None) -> dict[str, Any]:
    started = utc_now()
    since_dt = parse_time(since) if since else None
    cond, params = "", (user_id,)
    if since_dt is not None:
        params = (user_id, _time_param(db, since_dt))

    def q(sql: str, ts_col: str) -> list[Any]:
        extra = f" AND {ts_col} >= ?" if since_dt is not None else cond
        return db.execute(sql + extra, params).fetchall()

    shelves = q("SELECT * FROM bookshelves WHERE userId = ?", "updatedAt")
    notebooks = q("SELECT * FROM notebooks WHERE userId = ?", "updatedAt")
    sections = q(
        "SELECT s.* FROM sections s JOIN notebooks n ON n.id = s.notebookId WHERE n.userId = ?",
        "s.updatedAt",
    )
    pages = q(
        "SELECT p.* FROM pages p JOIN sections s ON s.id = p.sectionId "
        "JOIN notebooks n ON n.id = s.notebookId WHERE n.userId = ?",
        "p.updatedAt",
    )
    tombs = q("SELECT entity, id FROM sync_tombstones WHERE userId = ?", "deletedAt")
    return {
        # Overlap absorbs writes committed just after we read; clients dedupe.
        "cursor": iso(started - CURSOR_OVERLAP),
        "bookshelves": [_out("bookshelf", r) for r in shelves],
        "notebooks": [_out("notebook", r) for r in notebooks],
        "sections": [_out("section", r) for r in sections],
        "pages": [_out("page", r) for r in pages],
        "tombstones": [{"entity": r["entity"], "id": r["id"]} for r in tombs],
    }


# ------------------------------------------------------------------ push


class _Reject(Exception):
    def __init__(self, detail: str, current: dict[str, Any] | None = None):
        super().__init__(detail)
        self.detail = detail
        self.current = current


def _first_error(e: ValidationError) -> str:
    err = e.errors()[0] if e.errors() else {}
    return str(err.get("msg") or "Invalid data")


def _validated(entity: str, op: PushOp, validators: dict[str, type[BaseModel]]) -> dict[str, Any]:
    data = dict(op.data or {})
    try:
        model = validators[entity](id=op.id, **{k: v for k, v in data.items() if k != "archived"})
    except ValidationError as e:
        raise _Reject(_first_error(e)) from None
    except TypeError:
        raise _Reject("Invalid data") from None
    out = model.model_dump()
    if entity == "notebook":
        out["archived"] = 1 if data.get("archived") else 0
    return out


def _delete_tree(db: Connection, entity: str, id_: str) -> None:
    """Children first, so delete triggers can still resolve each row's owner."""
    if entity == "notebook":
        db.execute(
            "DELETE FROM pages WHERE sectionId IN (SELECT id FROM sections WHERE notebookId = ?)",
            (id_,),
        )
        db.execute("DELETE FROM sections WHERE notebookId = ?", (id_,))
    elif entity == "section":
        db.execute("DELETE FROM pages WHERE sectionId = ?", (id_,))
    db.execute(f"DELETE FROM {_TABLE[entity]} WHERE id = ?", (id_,))


def _apply(db: Connection, user_id: int, op: PushOp, validators: dict[str, type[BaseModel]]) -> str:
    entity = op.entity
    if not _ID_RE.match(op.id):
        raise _Reject("Id contains invalid characters")
    try:
        client_at = parse_time(op.clientUpdatedAt)
    except ValueError:
        raise _Reject("Invalid clientUpdatedAt") from None
    assert client_at is not None

    row = db.execute(_SELECT_ONE[entity], (op.id,)).fetchone()
    if row is not None and row["owner_id"] != user_id:
        raise _Reject("Not found")
    server_at = parse_time(row["updatedAt"]) if row is not None else None
    if row is not None and server_at is not None and server_at > client_at:
        return "stale"

    if op.op == "delete":
        if row is None:
            return "applied"
        if entity == "bookshelf":
            n = db.execute("SELECT COUNT(*) AS c FROM notebooks WHERE bookshelfId = ?", (op.id,)).fetchone()
            if int(n["c"] or 0) > 0:
                raise _Reject(
                    "Move or delete notebooks before deleting this bookshelf",
                    _current(entity, row),
                )
        _delete_tree(db, entity, op.id)
        return "applied"

    data = _validated(entity, op, validators)
    if entity in _PARENT:
        col, sql = _PARENT[entity]
        if db.execute(sql, (data[col], user_id)).fetchone() is None:
            raise _Reject("Parent not found", _current(entity, row) if row is not None else None)

    if entity == "bookshelf":
        if row is None:
            db.execute("INSERT INTO bookshelves (id, userId, name) VALUES (?, ?, ?)", (op.id, user_id, data["name"]))
        else:
            db.execute("UPDATE bookshelves SET name = ? WHERE id = ?", (data["name"], op.id))
    elif entity == "notebook":
        if row is None:
            db.execute(
                "INSERT INTO notebooks (id, userId, name, bookshelfId, archived) VALUES (?, ?, ?, ?, ?)",
                (op.id, user_id, data["name"], data["bookshelfId"], data["archived"]),
            )
        else:
            db.execute(
                "UPDATE notebooks SET name = ?, bookshelfId = ?, archived = ? WHERE id = ?",
                (data["name"], data["bookshelfId"], data["archived"], op.id),
            )
    elif entity == "section":
        if row is None:
            db.execute(
                "INSERT INTO sections (id, notebookId, name) VALUES (?, ?, ?)",
                (op.id, data["notebookId"], data["name"]),
            )
        else:
            db.execute(
                "UPDATE sections SET name = ?, notebookId = ? WHERE id = ?",
                (data["name"], data["notebookId"], op.id),
            )
    else:
        if row is None:
            db.execute(
                "INSERT INTO pages (id, sectionId, title, content) VALUES (?, ?, ?, ?)",
                (op.id, data["sectionId"], data["title"], data["content"]),
            )
        else:
            db.execute(
                "UPDATE pages SET title = ?, content = ?, sectionId = ? WHERE id = ?",
                (data["title"], data["content"], data["sectionId"], op.id),
            )
    return "applied"


def push(
    db: Connection,
    user_id: int,
    ops: list[PushOp],
    validators: dict[str, type[BaseModel]],
) -> list[dict[str, Any]]:
    """Apply ops in order. Each op runs in its own savepoint, so one bad op never
    aborts the batch. Stale/rejected results carry the server's current row."""
    results: list[dict[str, Any]] = []
    for op in ops:
        db.execute("SAVEPOINT sync_op")
        try:
            status = _apply(db, user_id, op, validators)
            db.execute("RELEASE SAVEPOINT sync_op")
            res: dict[str, Any] = {"opId": op.opId, "status": status}
            if status == "stale":
                row = db.execute(_SELECT_ONE[op.entity], (op.id,)).fetchone()
                res["current"] = _current(op.entity, row) if row is not None else None
            results.append(res)
        except _Reject as r:
            db.execute("ROLLBACK TO SAVEPOINT sync_op")
            db.execute("RELEASE SAVEPOINT sync_op")
            results.append({"opId": op.opId, "status": "rejected", "detail": r.detail, "current": r.current})
        except Exception as e:  # IntegrityError etc.: reject this op, keep going
            db.execute("ROLLBACK TO SAVEPOINT sync_op")
            db.execute("RELEASE SAVEPOINT sync_op")
            results.append({"opId": op.opId, "status": "rejected", "detail": type(e).__name__, "current": None})
    return results
