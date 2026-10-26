@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is required. & pause & exit /b 1)
where npm >nul 2>nul || (echo npm is required. & pause & exit /b 1)
if not exist "package-lock.json" (echo Missing reviewed package-lock.json. Stop. & pause & exit /b 1)
call npm ci --no-fund || (echo Dependency installation failed. & pause & exit /b 1)
echo Read the localhost URL printed below. Ctrl+C stops the server.
call npm run dev
