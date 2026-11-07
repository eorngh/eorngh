@echo off
chcp 65001 >nul
cd /d "%~dp0"
py -3 comment_assistant.py --daily
pause
