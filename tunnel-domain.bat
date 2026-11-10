@echo off
chcp 65001 >nul
title PickMe - Tunnel domain co dinh

where cloudflared >nul 2>nul || (
  echo [LOI] Chua cai cloudflared.
  pause & exit /b 1
)

echo ============================================
echo  PickMe - Cloudflare Tunnel (domain co dinh)
echo ============================================
echo.
echo Dang ket noi tunnel "pickme"...
echo Khach truy cap qua: https://pickme.yourdomain.com
echo.
echo (Dong cua so nay = tat tunnel)
echo.

cloudflared tunnel --no-autoupdate run pickme

pause
