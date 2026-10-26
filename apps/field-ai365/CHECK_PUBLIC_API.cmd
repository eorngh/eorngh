@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js 22 이상이 필요합니다. 기존 프로젝트의 START_WINDOWS.cmd 안내를 확인하세요.
 pause
 exit /b 1
)
node tools/check-public-api.mjs
set "field_check_result=%errorlevel%"
echo.
echo 점검 결과는 .local\public-api-check.json 에 저장됩니다. 승인키는 출력하지 않습니다.
pause
exit /b %field_check_result%
