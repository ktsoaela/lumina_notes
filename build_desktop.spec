# -*- mode: python ; coding: utf-8 -*-
# Build: npm run build  →  then  pyinstaller --distpath release build_desktop.spec
# (Use --distpath release so PyInstaller does not overwrite the Vite dist/ folder.)

import os
from pathlib import Path

from PyInstaller.utils.hooks import collect_all

# SPECPATH is the folder containing this .spec (see PyInstaller CONF["specpath"])
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

# webview ships platform DLLs / loaders; uvicorn is picked up by Analysis()
d, b, h = collect_all("webview")
datas += d
binaries += b
hiddenimports += h

block_cipher = None

a = Analysis(
    [str(project_root / "main.py")],
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
    name="LuminaNotes",
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
    name="LuminaNotes",
)
