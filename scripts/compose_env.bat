@echo off
REM Usage: scripts\compose_env.bat charlie|bravo|alpha [up|down|logs|ps] ...
setlocal
cd /d "%~dp0.."
set ENV=%~1
if "%ENV%"=="" (
  echo Usage: %~nx0 charlie^|bravo^|alpha [compose args...]
  echo Examples:
  echo   %~nx0 charlie up --build -d
  echo   %~nx0 bravo up --build -d
  echo   %~nx0 alpha up --build -d
  exit /b 1
)
shift
docker compose -p %ENV% -f docker-compose.yml -f docker-compose.%ENV%.yml %*
