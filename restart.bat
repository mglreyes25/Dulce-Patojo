@echo off
echo Matando procesos anteriores...
taskkill /f /im node.exe 2>nul
timeout /t 2 /nobreak >nul
cd /d "%~dp0restaurant-pos\backend"
echo Iniciando servidor backend...
start /B node src\server.js
echo Servidor backend iniciado en puerto 5000
timeout /t 3 /nobreak >nul
echo.
echo Para verificar: http://localhost:5000/auth/login
