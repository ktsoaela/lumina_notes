# Build the FastAPI backend (PyInstaller onedir): LuminaApi.exe + dist in bundle.
# Electron loads http://127.0.0.1:58888 in production (see electron/main.cjs).
#
# Prerequisite: npm run build (Vite -> dist/)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "Installing PyInstaller (if needed)..."
python -m pip install "pyinstaller>=6.0" --quiet

if (-not (Test-Path "dist\index.html")) {
    Write-Host "dist/index.html missing; running npm run build..."
    npm run build
    if (-not (Test-Path "dist\index.html")) {
        Write-Error "dist/index.html still missing after npm run build."
    }
}

Write-Host "Packaging backend -> release\LuminaApi\"
python -m PyInstaller --noconfirm --distpath release --workpath build\pyinstaller_work build_backend.spec

Write-Host ""
Write-Host "Done. Backend exe: release\LuminaApi\LuminaApi.exe"
Write-Host "Database file is created next to the exe when run standalone."
Write-Host "For the desktop app, use: npm run build:electron:app"
