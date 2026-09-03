@echo off
chcp 65001 >nul
REM Registra una tarea de Windows que corre el chequeo cada hora, sin
REM ventana. No necesita admin (corre cuando tu usuario esta logueado).
REM Doble clic para instalar. Para sacarla: unschedule.bat
setlocal
set "TASK=RCL Price Tracker"
set "HERE=%~dp0"

schtasks /create /tn "%TASK%" /tr "wscript.exe \"%HERE%run-check-hidden.vbs\"" /sc HOURLY /mo 1 /f

if %ERRORLEVEL%==0 (
  echo.
  echo Tarea "%TASK%" creada. Corre cada hora, sin ventana.
  echo.
  echo   Correr ahora:  schtasks /run   /tn "%TASK%"
  echo   Ver estado:    schtasks /query /tn "%TASK%" /v /fo LIST
  echo   Sacar:         scripts\unschedule.bat
  echo   Log:           %HERE%..\data\run.log
) else (
  echo.
  echo No se pudo crear la tarea ^(codigo %ERRORLEVEL%^).
)
echo.
pause
endlocal
