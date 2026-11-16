"""Headless FastAPI server for the Electron shell (no embedded browser)."""
from __future__ import annotations

import os

import uvicorn

# Import the app object so PyInstaller collects `app` and its deps.
from app import app

PORT = int(os.environ.get("PORT", "58888"))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="info")
