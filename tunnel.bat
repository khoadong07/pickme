@echo off
chcp 65001 >nul
title Chon anh - Cloudflare tunnel
where cloudflared >nul 2>nul || (echo [LOI] Chua cai cloudflared. Xem HUONG-DAN-WINDOWS.md buoc 6. & pause & exit /b 1)
echo Dang mo tunnel... Tim dong co dang  https://xxxx.trycloudflare.com  ben duoi.
echo (dong cua so nay = tat tunnel, khach se khong vao duoc nua)
echo.
cloudflared tunnel --no-autoupdate --url http://localhost:3456
pause
