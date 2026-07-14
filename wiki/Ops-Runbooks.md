# Ops runbooks

## Backup / restore (SQLite)

App data is one file (`database.sqlite` or `DATABASE_PATH`).

**Backup**
```bash
# stop writers if possible, then copy
cp "$DATABASE_PATH" "./backups/database-$(date +%Y%m%d).sqlite"
```
Or use the in-app **Storage → Backup** export for a per-user JSON backup.

**Restore**
```bash
# stop the API, replace the file, start again
cp ./backups/database-YYYYMMDD.sqlite "$DATABASE_PATH"
```
User-level: **Storage → Import** for JSON exported earlier.

## Secret rotation

1. Generate a new `JWT_SECRET` (and `DJANGO_SECRET_KEY` if used).
2. Deploy env/secret update; roll pods/process.
3. Existing JWTs become invalid — users re-login (expected).
4. Do not leave placeholder values (`change-me`, `REPLACE_WITH_*`) in any shared env.

## Incident basics

| Symptom | Check |
|--------|--------|
| 503 / failing probes | `GET /health` — DB path writable? disk full? |
| Login storms / 429 | `AUTH_RATE_*`; IP abuse; raise temporarily only if intentional |
| Auth suddenly fails for everyone | JWT_SECRET rotated without warning; clock skew |
| CORS errors | `CORS_ORIGINS` must list real origins (never `*` in prod) |
| Electron blank / won’t start | dialog shows backend path/stderr; rebuild `build:electron:app` |

Escalate: capture `/health` JSON, last 50 log lines, recent deploy/secret change.
