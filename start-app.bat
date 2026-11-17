@echo off
title Gym Manager Automation - Live Server
echo ========================================================
echo  🏋️ Starting Gym Manager Automation Server
echo ========================================================
echo.
cd /d "%~dp0"

echo [1/3] Checking dependencies...
if not exist "node_modules\" (
  echo Installing npm dependencies...
  call npm install
)

echo [2/3] Seeding demo members if not already seeded...
node scripts/seed_dummy_members.js

echo [3/3] Opening application in browser...
start http://localhost:3000

echo.
echo ========================================================
echo  🚀 Server is running at: http://localhost:3000
echo  Press Ctrl+C to stop the server at any time.
echo ========================================================
echo.
node server.js
pause
