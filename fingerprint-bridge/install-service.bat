@echo off
setlocal
title Fingerprint Bridge - Service Installer

echo ============================================================
echo  Fingerprint Bridge - Windows Auto-Start Installer
echo ============================================================
echo.

REM Must run as Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Please right-click this file and choose "Run as Administrator"
    echo.
    pause
    exit /b 1
)

REM Check Node.js
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Node.js is not installed. Download from https://nodejs.org
    pause
    exit /b 1
)

cd /d "%~dp0"

REM Install pm2 globally if missing
where pm2 >nul 2>&1
if %errorLevel% neq 0 (
    echo Installing pm2 process manager...
    call npm install -g pm2
    if %errorLevel% neq 0 (
        echo ERROR: Failed to install pm2
        pause
        exit /b 1
    )
)

REM Install pm2-windows-startup if missing
call pm2 list >nul 2>&1
npm list -g pm2-windows-startup >nul 2>&1
if %errorLevel% neq 0 (
    echo Installing pm2-windows-startup...
    call npm install -g pm2-windows-startup
)

REM Stop any existing instance
echo Stopping any existing bridge instance...
call pm2 stop fingerprint-bridge >nul 2>&1
call pm2 delete fingerprint-bridge >nul 2>&1

REM Start the bridge
echo Starting fingerprint bridge...
call pm2 start server.js --name fingerprint-bridge --restart-delay=3000

if %errorLevel% neq 0 (
    echo ERROR: Failed to start the bridge. Check that server.js exists.
    pause
    exit /b 1
)

REM Save pm2 process list
call pm2 save

REM Register Windows startup
call pm2-startup install

echo.
echo ============================================================
echo  SUCCESS - Fingerprint Bridge installed as Windows service
echo  It will now auto-start every time this PC boots.
echo.
echo  Useful commands:
echo    pm2 status               - check if bridge is running
echo    pm2 logs fingerprint-bridge  - view live logs
echo    pm2 restart fingerprint-bridge - restart after changes
echo ============================================================
echo.
pause
