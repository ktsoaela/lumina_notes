"""Headless FastAPI server for the Electron shell (no embedded browser)."""
from __future__ import annotations

import os

import uvicorn

# Import the app object so PyInstaller collects `app` and its deps.
from app import app

PORT = int(os.environ.get("PORT", "58888"))
# Loopback by default. Set LUMINA_HOST=0.0.0.0 to let a phone on the same Wi-Fi
# reach this API (needed for "Connect phone" with the bundled local API).
HOST = os.environ.get("LUMINA_HOST", "127.0.0.1")

if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
