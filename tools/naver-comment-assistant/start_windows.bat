@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  echo Python 3 is required. Install Python from https://www.python.org/downloads/windows/
  echo Install with "Add python.exe to PATH" enabled.
  pause
  exit /b 1
)
echo ==========================================
echo   Naver Comment Assistant - GPT / Gemini
echo ==========================================
py -3 comment_assistant.py
if errorlevel 1 (
  echo Program stopped due to error.
)
pause
