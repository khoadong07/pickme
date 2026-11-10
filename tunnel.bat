@echo off
chcp 65001 >nul
title PickMe - Cloudflare Tunnel

where cloudflared >nul 2>nul || (
  echo [LOI] Chua cai cloudflared.
  echo Tai ve tai: https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
  echo Doi ten thanh cloudflared.exe va copy vao C:\Windows\System32\
  pause & exit /b 1
)

REM === Dung tunnel co dinh voi domain (khuyen dung) ===
REM Bo dau REM o dong duoi de bat, va chinh ten tunnel cho dung:
REM cloudflared tunnel --no-autoupdate run pickme

REM === Dung tunnel tam thoi (link doi moi lan mo) ===
echo Dang mo tunnel... cho xuat hien link https://xxxx.trycloudflare.com bên duoi.
echo (Dong cua so nay = tat tunnel, khach se khong vao duoc nua)
echo.
cloudflared tunnel --no-autoupdate --url http://localhost:3456

pause
