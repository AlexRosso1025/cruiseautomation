@echo off
chcp 65001 >nul
schtasks /delete /tn "RCL Price Tracker" /f
echo.
pause
