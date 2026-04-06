# Full pipeline: Vite + PyInstaller (windowed exe) + Inno Setup installer (.exe).
# Prerequisite: Inno Setup 6 — https://jrsoftware.org/isdl.php
# Output: release\installer\LuminaNotes-Setup-1.0.0.exe
#
# Run from repo root:  .\scripts\build_installer.ps1
# Or:                   npm run build:installer

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

Write-Host "=== 1/2 Desktop bundle (Vite + PyInstaller) ===" -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "build_desktop.ps1")

$iscc = @(
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "${env:ProgramFiles}\Inno Setup 6\ISCC.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $iscc) {
    Write-Host ""
    Write-Host "Inno Setup 6 was not found (ISCC.exe)." -ForegroundColor Yellow
    Write-Host "Install it from https://jrsoftware.org/isdl.php then run this script again." -ForegroundColor Yellow
    Write-Host "Your app bundle is still at: release\LuminaNotes\LuminaNotes.exe" -ForegroundColor Gray
    exit 1
}

$iss = Join-Path $root "installer\LuminaNotes.iss"
if (-not (Test-Path $iss)) {
    Write-Error "Missing $iss"
}

Write-Host ""
Write-Host "=== 2/2 Inno Setup compiler ===" -ForegroundColor Cyan
Write-Host "Using $iscc"
& $iscc $iss

Write-Host ""
Write-Host "Done. Run the installer:" -ForegroundColor Green
Write-Host "  $root\release\installer\LuminaNotes-Setup-1.0.0.exe"
Write-Host "Installs to: %LocalAppData%\Programs\Lumina Notes (per-user, no admin)." -ForegroundColor Gray
