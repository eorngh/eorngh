@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo =====================================================
echo   Daily Naver Comment Draft Scheduler (no auto-post)
echo =====================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup_schedule.ps1"
if errorlevel 1 (
  echo Schedule creation failed. Please check Python installation and Task Scheduler permissions.
  pause
)
