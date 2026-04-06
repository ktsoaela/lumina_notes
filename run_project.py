"""
Run the full stack: FastAPI + Django admin + Vite concurrently.

Usage:
  python run_project.py
  python run_project.py --webview
  python run_project.py --reload          # uvicorn --reload (can fail on some Windows setups)
  python run_project.py --no-django       # skip Django admin server

Env:
  API_PORT     FastAPI (default 58888 — avoids common Windows reserved ports)
  DJANGO_PORT  Django admin (default 8001)
  VITE_PORT    Vite dev server (default 5173)
"""
from __future__ import annotations

import argparse
import os
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
API_PORT = int(os.environ.get("API_PORT", "58888"))
DJANGO_PORT = int(os.environ.get("DJANGO_PORT", "8001"))
VITE_PORT = int(os.environ.get("VITE_PORT", "5173"))


def _vite_command() -> list[str]:
    extra = ["--", "--host", "127.0.0.1", "--port", str(VITE_PORT)]
    if sys.platform == "win32":
        return ["cmd", "/c", "npm", "run", "dev", *extra]
    return ["npm", "run", "dev", *extra]


def _uvicorn_command(*, reload: bool) -> list[str]:
    cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "app:app",
        "--host",
        "127.0.0.1",
        "--port",
        str(API_PORT),
    ]
    if reload:
        cmd.append("--reload")
    return cmd


def _django_env() -> dict[str, str]:
    env = os.environ.copy()
    env.setdefault("DJANGO_SETTINGS_MODULE", "lumina.settings")
    return env


def _django_migrate() -> bool:
    r = subprocess.run(
        [sys.executable, "manage.py", "migrate", "--noinput"],
        cwd=ROOT,
        env=_django_env(),
    )
    return r.returncode == 0


def _django_runserver_command() -> list[str]:
    return [
        sys.executable,
        "manage.py",
        "runserver",
        f"127.0.0.1:{DJANGO_PORT}",
        "--noreload",
    ]


def _terminate(proc: subprocess.Popen | None) -> None:
    if proc is None or proc.poll() is not None:
        return
    proc.terminate()
    try:
        proc.wait(timeout=8)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=3)


def _default_reload() -> bool:
    """Uvicorn --reload is off by default on Windows (bind / multiprocess issues)."""
    if os.environ.get("UVICORN_RELOAD"):
        return os.environ["UVICORN_RELOAD"] not in ("0", "false", "False", "")
    return sys.platform != "win32"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run Lumina Notes: FastAPI + Django admin + Vite together.",
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Enable uvicorn --reload (watch Python files).",
    )
    parser.add_argument(
        "--no-reload",
        action="store_true",
        help="Disable uvicorn --reload (overrides --reload and platform default).",
    )
    parser.add_argument(
        "--no-django",
        action="store_true",
        help="Do not start Django (admin will not be available).",
    )
    parser.add_argument(
        "--webview",
        action="store_true",
        help="Open a desktop window (pywebview) pointing at the Vite dev URL.",
    )
    args = parser.parse_args()

    if not (ROOT / "package.json").is_file():
        print("package.json not found; run from the lumina-notes project root.", file=sys.stderr)
        sys.exit(1)
    if not (ROOT / "node_modules").is_dir():
        print("node_modules missing. Run: npm install", file=sys.stderr)
        sys.exit(1)

    os.chdir(ROOT)

    use_reload = _default_reload()
    if args.reload:
        use_reload = True
    if args.no_reload:
        use_reload = False

    django_proc: subprocess.Popen | None = None
    if not args.no_django:
        if not _django_migrate():
            print(
                "Django migrate failed. Try: python manage.py migrate",
                file=sys.stderr,
            )
            sys.exit(1)
        django_proc = subprocess.Popen(
            _django_runserver_command(),
            cwd=ROOT,
            env=_django_env(),
        )

    api_proc = subprocess.Popen(
        _uvicorn_command(reload=use_reload),
        cwd=ROOT,
    )
    vite_proc = subprocess.Popen(
        _vite_command(),
        cwd=ROOT,
    )

    children: list[subprocess.Popen] = [api_proc, vite_proc]
    if django_proc is not None:
        children.insert(0, django_proc)

    shutting_down = threading.Event()

    def stop_all() -> None:
        if shutting_down.is_set():
            return
        shutting_down.set()
        for p in children:
            _terminate(p)

    def on_signal(_sig: int | None = None, _frame=None) -> None:
        stop_all()
        sys.exit(0)

    signal.signal(signal.SIGINT, on_signal)
    if sys.platform != "win32":
        signal.signal(signal.SIGTERM, on_signal)

    admin_line = (
        f"Django admin http://127.0.0.1:{DJANGO_PORT}/admin/  (create staff: python manage.py createsuperuser)\n"
        if django_proc
        else ""
    )
    reload_note = "on" if use_reload else "off"
    print(
        f"FastAPI API http://127.0.0.1:{API_PORT}  (uvicorn reload: {reload_note})\n"
        f"{admin_line}"
        f"Vite UI     http://127.0.0.1:{VITE_PORT}  (proxies /api → FastAPI)\n"
        "Ctrl+C stops all.\n"
    )

    def watch_children() -> None:
        while not shutting_down.is_set():
            if django_proc is not None and django_proc.poll() is not None:
                print("Django runserver exited.", file=sys.stderr)
                break
            if api_proc.poll() is not None:
                print("Uvicorn exited.", file=sys.stderr)
                break
            if vite_proc.poll() is not None:
                print("Vite exited.", file=sys.stderr)
                break
            time.sleep(0.25)
        stop_all()

    if args.webview:
        watcher = threading.Thread(target=watch_children, daemon=True)
        watcher.start()
        time.sleep(1.2)
        try:
            import webview
        except ImportError:
            print("Install pywebview: pip install pywebview", file=sys.stderr)
            stop_all()
            sys.exit(1)
        try:
            webview.create_window(
                "Lumina Notes",
                f"http://127.0.0.1:{VITE_PORT}",
            )
            webview.start()
        finally:
            stop_all()
        return

    try:
        watch_children()
    finally:
        stop_all()


if __name__ == "__main__":
    main()
