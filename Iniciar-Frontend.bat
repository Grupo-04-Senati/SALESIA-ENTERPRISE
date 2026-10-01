@echo off
chcp 65001 >nul
title SalesIA Enterprise - Frontend
cd /d "%~dp0frontend"

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encontro Node.js / npm en el PATH.
  echo         Instala Node.js desde https://nodejs.org y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo.
  echo Instalando dependencias por primera vez, esto puede tardar un poco...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] Fallo la instalacion de dependencias.
    pause
    exit /b 1
  )
)

echo.
echo ============================================
echo   SalesIA Enterprise - Servidor de desarrollo
echo   URL: http://localhost:5173
echo   Para detener: cierra esta ventana o Ctrl+C
echo ============================================
echo.

timeout /t 3 /nobreak >nul
start "" "http://localhost:5173"

call npm run dev

pause
