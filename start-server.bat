@echo off
echo ==========================================
echo   CinemaHalal Streaming Server
echo ==========================================
echo.

cd /d "%~dp0server"

echo Starting streaming server on http://localhost:3001
echo.
echo Press Ctrl+C to stop the server
echo.

node server.js
