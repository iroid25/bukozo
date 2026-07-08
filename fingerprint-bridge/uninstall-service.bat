@echo off
title Fingerprint Bridge - Service Uninstaller

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Please right-click and "Run as Administrator"
    pause
    exit /b 1
)

echo Stopping and removing fingerprint bridge service...
call pm2 stop fingerprint-bridge
call pm2 delete fingerprint-bridge
call pm2 save
call pm2-startup uninstall

echo Done. Fingerprint bridge service removed.
pause
