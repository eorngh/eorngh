@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js 22 이상을 설치한 뒤 다시 실행하세요.
 pause
 exit /b 1
)
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)" >nul 2>nul
if errorlevel 1 (
 echo 설치된 Node.js가 너무 오래됐습니다. Node.js 22 이상으로 업데이트하세요.
 pause
 exit /b 1
)
node tools/launch.mjs
pause
