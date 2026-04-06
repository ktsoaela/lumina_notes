"""Headless FastAPI server for the Electron shell (no embedded browser)."""
from __future__ import annotations

import os

import uvicorn

PORT = int(os.environ.get("PORT", "58888"))

if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=PORT, log_level="info")
