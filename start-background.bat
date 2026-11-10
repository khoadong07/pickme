@echo off
rem Dung cho Task Scheduler: chay server khong can cua so, ghi log vao data\server.log
cd /d "%~dp0"
if not exist data mkdir data
node server.js >> data\server.log 2>&1
