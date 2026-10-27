@echo off
echo ===================================================
echo     STARTING TRADING BOT MOBILE BACKEND & APP
echo ===================================================
echo.
echo 1. Starting FastAPI Backend (Port 8000)...
start "Trading Bot Backend API" cmd /k "python api.py"

timeout /t 3 /nobreak >nul

echo.
echo 2. Starting Expo Mobile Dev Server (Port 8081)...
cd mobile
start "Trading Bot Expo Mobile" cmd /k "npx expo start"

echo.
echo ===================================================
echo  Both services launched!
echo  - Backend API: http://192.168.1.16:8000
echo  - Mobile Web:  http://192.168.1.16:8081
echo.
echo  Scan the QR code in the Expo window with Expo Go!
echo ===================================================
pause
