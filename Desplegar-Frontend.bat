@echo off
chcp 65001 >nul
title SalesIA Enterprise - Desplegar frontend en Vercel
cd /d "%~dp0frontend"

echo.
echo ============================================================
echo   SalesIA Enterprise - Despliegue del frontend (Vercel)
echo ============================================================
echo.
echo  1. Se compila el frontend (npm run build)
echo  2. Se publica en Vercel
echo.
echo  La primera vez Vercel te pedira iniciar sesion y/o
echo  autorizar el proyecto. Solo debes aceptar: el resto
echo  del proceso es automatico.
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encontro Node.js / npm en el PATH.
  echo         Instala Node.js desde https://nodejs.org
  pause
  exit /b 1
)

echo [1/2] Compilando el frontend...
echo.
call npm run build
if errorlevel 1 (
  echo.
  echo [ERROR] La compilacion fallo. Revisa los mensajes anteriores.
  pause
  exit /b 1
)

echo.
echo [2/2] Publicando en Vercel...
echo.
call npx --yes vercel@latest --prod
if errorlevel 1 (
  echo.
  echo [ERROR] El despliegue fallo. Revisa los mensajes anteriores.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   Despliegue completado. Vercel mostrara la URL publica.
echo   La guia completa esta en docs/08_despliegue.md
echo ============================================================
echo.

pause
