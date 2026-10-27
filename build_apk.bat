@echo off
echo ===================================================
echo        BUILDING STANDALONE ANDROID APK
echo ===================================================
echo.
cd mobile
echo Starting EAS Android APK Build...
npx eas build -p android --profile preview
echo.
pause
