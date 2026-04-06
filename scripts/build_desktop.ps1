# Build a Windows folder distribution (PyInstaller onedir): FastAPI + built SPA + webview.
# This matches production "desktop" behavior (python main.py), not the dev stack (run_project.py).
#
# Why not "python run_project.py --webview"?
#   That starts Node/Vite + Django + FastAPI. Bundling Node into an exe is a separate project.
#   For a single .exe / one folder to ship, use the built static UI + main.py (this script).

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "Installing PyInstaller (if needed)..."
python -m pip install "pyinstaller>=6.0" --quiet

Write-Host "Building frontend (Vite) -> dist/"
npm run build
if (-not (Test-Path "dist\index.html")) {
    Write-Error "dist/index.html missing after npm run build."
}

Write-Host "Packaging desktop app -> release/ (does not overwrite dist/)"
python -m PyInstaller --noconfirm --distpath release --workpath build\pyinstaller_work build_desktop.spec

Write-Host ""
Write-Host "Done. Run:  release\LuminaNotes\LuminaNotes.exe"
Write-Host "Database file is created next to the exe: database.sqlite"
Write-Host "To hide the console window, edit build_desktop.spec (console=False) and rebuild."
