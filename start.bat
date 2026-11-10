@echo off
chcp 65001 >nul
title Chon anh - server
cd /d "%~dp0"
where node >nul 2>nul || (echo [LOI] Chua cai Node.js. Xem HUONG-DAN-WINDOWS.md buoc 1. & pause & exit /b 1)
if not exist ".env" if exist ".env.example" copy ".env.example" ".env" >nul
echo Dang chay server... (dong cua so nay = tat server)
echo.
node server.js
echo.
echo Server da dung.
pause
