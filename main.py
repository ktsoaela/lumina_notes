"""Desktop launcher: FastAPI + pywebview."""
from __future__ import annotations

import os
import threading
import time

import uvicorn

from app import DIST_DIR

PORT = int(os.environ.get("PORT", "58888"))


def run_server() -> None:
    uvicorn.run("app:app", host="127.0.0.1", port=PORT, log_level="info")


if __name__ == "__main__":
    import webview

    if not (DIST_DIR / "index.html").is_file():
        print("Frontend not built. Run: npm run build")
        raise SystemExit(1)

    threading.Thread(target=run_server, daemon=True).start()
    time.sleep(0.6)
    webview.create_window("Lumina Notes", f"http://127.0.0.1:{PORT}")
    webview.start()
