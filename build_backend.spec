# -*- mode: python ; coding: utf-8 -*-
# PyInstaller: FastAPI + static dist (served by app.py). Used by Electron (no pywebview).
# Build: npm run build  →  pyinstaller --distpath release build_backend.spec

import os
from pathlib import Path

try:
    project_root = Path(SPECPATH).resolve()
except NameError:
    project_root = Path.cwd().resolve()

vite_dist = project_root / "dist"
if not (vite_dist / "index.html").is_file():
    raise FileNotFoundError(
        f"Missing {vite_dist / 'index.html'} — run: npm run build"
    )

datas = [(str(vite_dist), "dist")]
binaries = []
hiddenimports = [
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "bcrypt",
    "jose.backends",
    "jose.backends.cryptography_backend",
]

block_cipher = None

a = Analysis(
    [str(project_root / "run_api.py")],
    pathex=[str(project_root)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="LuminaApi",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="LuminaApi",
)
