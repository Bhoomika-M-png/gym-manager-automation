@echo off
title Gym Manager Automation - Docker Deployment
echo ========================================================
echo  🐳 Deploying Gym Manager & n8n via Docker Compose
echo ========================================================
echo.
cd /d "%~dp0"

echo [1/2] Building and starting Docker containers...
docker compose up -d --build

echo [2/2] Opening application and n8n...
start http://localhost:3000
timeout /t 5 /nobreak >nul
start http://localhost:5678

echo.
echo ========================================================
echo  ✅ Deployment complete!
echo  Gym Manager App: http://localhost:3000
echo  n8n Automation:  http://localhost:5678
echo ========================================================
echo.
pause
