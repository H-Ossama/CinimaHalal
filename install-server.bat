@echo off
echo ==========================================
echo   CinemaHalal Streaming Server Installer
echo ==========================================
echo.

cd /d "%~dp0server"

echo Checking Node.js installation...
node --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please download and install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js found!
echo.
echo Installing dependencies...
call npm install

if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to install dependencies!
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   Installation Complete!
echo ==========================================
echo.
echo To start the streaming server, run:
echo   start-server.bat
echo.
pause
