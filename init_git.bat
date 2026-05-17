@echo off
setlocal
cd /d "%~dp0"

echo Inicializando repositorio git para playa-frontend...

if exist ".git" rmdir /s /q .git

git init -b main
if errorlevel 1 goto :nogit

git config user.email "leticia.jimenezdc@gmail.com"
git config user.name "Leticia"

git add .
git commit -m "Initial commit - frontend Playas Autos"
git branch develop

echo.
echo Repositorio inicializado.
git branch
goto :end

:nogit
echo.
echo ERROR: git no esta instalado o no esta en el PATH.

:end
pause
