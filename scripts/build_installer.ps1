# Full pipeline: Vite + PyInstaller (LuminaApi) + electron-builder (NSIS installer).
# Output: release\electron\ (installer .exe and win-unpacked folder)
#
# Run from repo root:  .\scripts\build_installer.ps1
# Or:                   npm run build:installer

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

Write-Host "=== Vite + PyInstaller + electron-builder ===" -ForegroundColor Cyan
npm install
npm run build:electron:app

Write-Host ""
Write-Host "Done. See release\electron\ for the NSIS installer and win-unpacked." -ForegroundColor Green
Write-Host "Data file database.sqlite is next to LuminaApi.exe under resources\backend\ when installed." -ForegroundColor Gray
