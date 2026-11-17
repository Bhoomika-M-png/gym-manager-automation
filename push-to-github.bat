@echo off
title Push Gym Manager to GitHub
echo ========================================================
echo  📤 Pushing Gym Manager Automation to GitHub
echo  Account: Bhoomika-M-png
echo  Repository: gym-manager-automation
echo ========================================================
echo.
cd /d "C:\Users\ENGG\gym-manager-app"

git push -u origin main

if %ERRORLEVEL% EQU 0 (
  echo.
  echo ========================================================
  echo  🎉 Successfully pushed to GitHub!
  echo  URL: https://github.com/Bhoomika-M-png/gym-manager-automation
  echo ========================================================
  start https://github.com/Bhoomika-M-png/gym-manager-automation
) else (
  echo.
  echo ⚠️ Note: If you have not created the repository yet,
  echo create it at https://github.com/new with name "gym-manager-automation"
  echo and then run this script again.
)
echo.
pause
