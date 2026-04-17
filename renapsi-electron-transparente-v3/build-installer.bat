@echo off
setlocal

title Gerar instalador NSIS

echo ================================
echo Instalando dependencias...
echo ================================
call npm install
if errorlevel 1 goto erro

echo.
echo ================================
echo Gerando instalador local...
echo ================================
call npm run dist
if errorlevel 1 goto erro

echo.
echo Pronto! Verifique a pasta dist.
pause
exit /b 0

:erro
echo.
echo Ocorreu um erro durante o processo.
pause
exit /b 1
