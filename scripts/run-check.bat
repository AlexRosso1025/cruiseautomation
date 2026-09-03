@echo off
chcp 65001 >nul
REM Corre UN chequeo de precio y agrega el resultado a data\run.log
REM Lo llama la tarea programada (cada hora).
setlocal
cd /d "%~dp0.."

if not exist "data" mkdir "data"
set "LOG=data\run.log"

>>"%LOG%" echo(
>>"%LOG%" echo ======== %DATE% %TIME% ========

if exist ".env" (
  call "node_modules\.bin\tsx.cmd" --env-file=.env src\index.ts >>"%LOG%" 2>&1
) else (
  call "node_modules\.bin\tsx.cmd" src\index.ts >>"%LOG%" 2>&1
)
set "RC=%ERRORLEVEL%"

>>"%LOG%" echo [exit %RC%]
endlocal & exit /b %RC%
