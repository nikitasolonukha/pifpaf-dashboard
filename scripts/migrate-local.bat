@echo off
cd /d "%~dp0.."
echo Checking Docker...
docker info >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker Desktop is not running. Start Docker and retry.
  exit /b 1
)
echo Starting Supabase...
call npm run db:start
if errorlevel 1 exit /b 1
echo Applying migrations...
call npm run db:push
if errorlevel 1 exit /b 1
echo Done. Restart: npm run dev
pause
