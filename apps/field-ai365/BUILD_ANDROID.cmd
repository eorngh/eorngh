@echo off
chcp 65001 >nul
cd /d "%~dp0"
node tools/build.mjs
if errorlevel 1 exit /b 1
where gradle >nul 2>nul
if errorlevel 1 (
 echo Gradle 9.6.0과 Android SDK가 필요합니다.
 echo 또는 Android Studio에서 android 폴더를 열어 빌드하세요.
 pause
 exit /b 1
)
cd android
gradle assembleDebug
if errorlevel 1 exit /b 1
echo Debug APK: android\app\build\outputs\apk\debug\app-debug.apk
pause
