#!/usr/bin/env bash
# Build FastAPI backend with PyInstaller (macOS / Linux) → release/LuminaApi/LuminaApi
set -euo pipefail
cd "$(dirname "$0")/.."

python3 -m pip install "pyinstaller>=6.0" --quiet

if [[ ! -f dist/index.html ]]; then
  echo "dist/index.html missing; running npm run build..."
  npm run build
fi

echo "Packaging backend → release/LuminaApi/"
python3 -m PyInstaller --noconfirm --distpath release --workpath build/pyinstaller_work build_backend.spec

echo "Done. Binary: release/LuminaApi/LuminaApi"
