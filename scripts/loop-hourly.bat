@echo off
chcp 65001 >nul
REM Alternativa simple a la tarea programada: deja esta ventana abierta
REM y corre el chequeo una vez por hora. Ctrl+C para cortar.
:loop
call "%~dp0run-check.bat"
echo.
echo [%TIME%] Chequeo hecho. Proximo en 1 hora. Ctrl+C para cortar.
timeout /t 3600 /nobreak >nul
goto loop
