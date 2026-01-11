@echo off
REM MoneyKracked Server Wrapper - Auto-restart
set LOG_FILE=%1
set PID_FILE=%2
set RESTART_COUNT=0
set MAX_RESTARTS=100

:loop
if %RESTART_COUNT% GEQ %MAX_RESTARTS% goto :eof

if %RESTART_COUNT% GTR 0 (
    echo [%date% %time%] Server crashed, restarting... (attempt %RESTART_COUNT%) >> %LOG_FILE%
)

REM Start npm run dev
start /B npm run dev >> %LOG_FILE% 2>&1

REM Wait a bit and capture PID
for /f "tokens=2" %%a in ('tasklist ^| findstr /i "node.exe"') do (
    set NODE_PID=%%a
    goto :found
)
:found

if defined NODE_PID (
    echo !NODE_PID! > %PID_FILE%
    echo [%date% %time%] Server started with PID: !NODE_PID! >> %LOG_FILE%
)

REM Wait for process (check if PID file still exists = server should run)
:wait_loop
timeout /t 2 /nobreak >NUL
tasklist /FI "PID eq !NODE_PID!" 2>NUL | find "!NODE_PID!" >NUL
if %errorlevel% equ 0 (
    if exist "%PID_FILE%" goto :wait_loop
)

REM PID file deleted = user stopped server
if not exist "%PID_FILE%" (
    echo [%date% %time%] Server stopped (mkd stop was used) >> %LOG_FILE%
    goto :eof
)

set /a RESTART_COUNT+=1
goto :loop
