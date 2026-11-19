@echo off
cd /d "%~dp0"
node build.js
echo.
echo Build finished. Press any key to close.
pause >nul
