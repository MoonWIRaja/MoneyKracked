@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM MoneyKracked Development Server Manager
REM Simple version - no complex wrappers
REM ============================================================

set "SCRIPT_DIR=%~dp0"
set "PID_FILE=%SCRIPT_DIR%logs\.server.pid"
set "LOG_DIR=%SCRIPT_DIR%logs"

if "%1"=="" goto :help
if /i "%1"=="start" goto :start
if /i "%1"=="stop" goto :stop
if /i "%1"=="status" goto :status
if /i "%1"=="logs" goto :logs
if /i "%1"=="restart" goto :restart
goto :help

:help
echo.
echo MoneyKracked Server Manager
echo.
echo   mkd start    - Start dev server in background
echo   mkd stop     - Stop dev server
echo   mkd restart  - Restart server
echo   mkd status   - Check status
echo   mkd logs     - View logs
echo.
goto :eof

:start
echo.
echo [*] Starting MoneyKracked Dev Server...

REM Create logs dir
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM Check if running
if exist "%PID_FILE%" (
    set /p OLD_PID=<"%PID_FILE%"
    tasklist /FI "PID eq !OLD_PID!" 2>NUL | find "!OLD_PID!" >NUL
    if !errorlevel! equ 0 (
        echo [!] Already running (PID: !OLD_PID!)
        echo     Use 'mkd stop' first.
        goto :eof
    )
    del "%PID_FILE%" 2>NUL
)

REM Create log file
set "LOG_FILE=%LOG_DIR%\server_%date:~10,4%-%date:~4,2%-%date:~7,2%_%time:~0,2%%time:~3,2%.log"
set "LOG_FILE=%LOG_FILE: =0%"

echo ============================================================ > "%LOG_FILE%"
echo MoneyKracked Server Log - %date% %time% >> "%LOG_FILE%"
echo ============================================================ >> "%LOG_FILE%"

REM Start npm in background (production server)
start /B cmd /c "npm run start >> %LOG_FILE% 2>&1"

REM Wait for npm to start and find node.exe PID
timeout /t 3 /nobreak >NUL

for /f "tokens=2" %%a in ('tasklist ^| findstr /i "node.exe"') do (
    set NODE_PID=%%a
    echo !NODE_PID! > "%PID_FILE%"
    goto :pid_found
)

:pid_found
if exist "%PID_FILE%" (
    set /p SERVER_PID=<"%PID_FILE%"
    echo.
    echo [OK] Server Started!
    echo.
    echo   Status  : RUNNING
    echo   PID     : !SERVER_PID!
    echo   URL     : http://localhost:5173
    echo.
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
        set IP=%%a
        set IP=!IP: =!
        echo   Network : http://!IP!:5173
    )
    echo.
    echo   Log File: %LOG_FILE%
    echo   Use 'mkd logs' to view, 'mkd stop' to stop
    echo.
) else (
    echo [!] Failed to start. Check: %LOG_FILE%
)
goto :eof

:stop
echo.
echo [*] Stopping Server...

REM Read port from .env file (default 5173)
set "PORT=5173"
if exist "%SCRIPT_DIR%\.env" (
    for /f "tokens=1,2 delims==" %%a in ('type "%SCRIPT_DIR%\.env" ^| findstr /b "PORT="') do (
        set "PORT=%%b"
    )
)

REM Remove PID file FIRST to stop auto-restart loop
del "%PID_FILE%" 2>NUL

REM Kill only npm processes running "npm run start"
for /f "tokens=2" %%a in ('tasklist ^| findstr /i "npm.exe"') do (
    for /f "tokens=2" %%b in ('wmic process where "ProcessId=%%a" get CommandLine 2^>NUL ^| findstr /i "npm run start"') do (
        taskkill /F /PID %%a >NUL 2>&1
    )
)

REM Kill process listening on our port (from .env or default 5173)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%.*LISTENING"') do (
    taskkill /F /PID %%a >NUL 2>&1
)

echo [OK] Stopped
echo.
goto :eof

:status
echo.
if exist "%PID_FILE%" (
    set /p SERVER_PID=<"%PID_FILE%"
    tasklist /FI "PID eq !SERVER_PID!" 2>NUL | find "!SERVER_PID!" >NUL
    if !errorlevel! equ 0 (
        echo   Status: RUNNING
        echo   PID: !SERVER_PID!
        echo   URL: http://localhost:5173
    ) else (
        echo   Status: STOPPED
        del "%PID_FILE%" 2>NUL
    )
) else (
    echo   Status: STOPPED
)
echo.
goto :eof

:logs
echo.
if exist "%LOG_DIR%" (
    for /f "delims=" %%a in ('dir /B /O-D "%LOG_DIR%\server_*.log" 2^>NUL') do (
        type "%LOG_DIR%\%%a"
        goto :eof
    )
)
echo [!] No logs
goto :eof

:restart
call :stop
timeout /t 1 /nobreak >NUL
call :start
goto :eof
