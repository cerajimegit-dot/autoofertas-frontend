@echo off
REM Script para iniciar el servidor del frontend en Windows

echo.
echo ╔════════════════════════════════════════════════════╗
echo ║  Playas de Autos - Frontend Server                 ║
echo ║  Iniciando en puerto 3000...                       ║
echo ╚════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

REM Iniciar servidor Python
python server.py

if errorlevel 1 (
    echo.
    echo Error: No se pudo iniciar el servidor
    echo Verifica que Python esté instalado y disponible
    pause
)
