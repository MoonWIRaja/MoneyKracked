#!/usr/bin/env pwsh
# ============================================================
# MoneyKracked Development Server Manager
# Cross-platform PowerShell script
# Works on Windows, macOS, and Linux
# Usage: ./mkd.ps1 [start|stop|status|logs|restart]
# ============================================================

param(
    [Parameter(Position=0)]
    [ValidateSet('start', 'stop', 'status', 'logs', 'restart', 'help')]
    [string]$Command = 'help'
)

$ScriptDir = Split-Path -Parent $PSScriptRoot
$PidFile = Join-Path $ScriptDir "logs\.server.pid"
$LogDir = Join-Path $ScriptDir "logs"

# ============================================================
# Helper Functions
# ============================================================

function Print-Header {
    param([string]$Title)
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Print-Ok {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Print-Info {
    param([string]$Message)
    Write-Host "[*] $Message" -ForegroundColor Blue
}

function Print-Error {
    param([string]$Message)
    Write-Host "[!] $Message" -ForegroundColor Red
}

function Print-Warn {
    param([string]$Message)
    Write-Host "[!] $Message" -ForegroundColor Yellow
}

function Test-ServerRunning {
    if (Test-Path $PidFile) {
        $pid = Get-Content $PidFile -ErrorAction SilentlyContinue
        if ($pid -and (Get-Process -Id $pid -ErrorAction SilentlyContinue)) {
            return $true
        }
    }
    return $false
}

function Get-LocalIPs {
    $ips = @()
    try {
        $adapters = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue
        foreach ($adapter in $adapters) {
            if ($adapter.IPAddress -ne "127.0.0.1" -and !$adapter.IPAddress.StartsWith("169.254")) {
                $ips += $adapter.IPAddress
            }
        }
    } catch {
        # Fallback for systems without Get-NetIPAddress
        try {
            $result = Invoke-Expression "hostname -I 2>/dev/null" -ErrorAction SilentlyContinue
            if ($result) {
                $ips = $result -split " " | Where-Object { $_ -ne "" }
            }
        } catch {}
    }
    return $ips
}

# ============================================================
# Commands
# ============================================================

function Start-Server {
    Print-Info "Starting MoneyKracked Development Server..."

    # Create logs directory
    if (-not (Test-Path $LogDir)) {
        New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    }

    # Check if already running
    if (Test-ServerRunning) {
        $pid = Get-Content $PidFile
        Print-Error "Server is already running (PID: $pid)"
        Write-Host "      Use 'mkd stop' first, or 'mkd restart' to restart."
        exit 1
    }

    # Create log file with timestamp
    $timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
    $logFile = Join-Path $LogDir "server_$timestamp.log"

    # Create log header
    $logHeader = @"
============================================================
  MoneyKracked Server Log - $(Get-Date)
============================================================
"@
    $logHeader | Out-File -FilePath $logFile -Encoding utf8

    # Get local IPs
    $localIPs = Get-LocalIPs

    # Create the wrapper script content inline
    $wrapperCode = @"
`$logFile = "$logFile"
`$pidFile = "$PidFile"
`$restartCount = 0
`$maxRestarts = 100

while (`$restartCount -lt `$maxRestarts) {
    try {
        if (`$restartCount -gt 0) {
            "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Server crashed, restarting... (attempt `$restartCount)" | Out-File -FilePath `$logFile -Append
        }

        Set-Location (Split-Path -Parent `$PSScriptRoot)
        `$process = Start-Process -FilePath "npm" -ArgumentList "run", "start" -PassThru -WindowStyle Hidden
        `$process.Id | Out-File -FilePath `$pidFile -Force

        "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Server started with PID: `$(`$process.Id)" | Out-File -FilePath `$logFile -Append

        `$process.WaitForExit()
        `$exitCode = `$process.ExitCode

        if (Test-Path `$pidFile) {
            `$restartCount++
            Start-Sleep -Seconds 2
        } else {
            "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Server stopped (mkd stop was used)" | Out-File -FilePath `$logFile -Append
            break
        }
    } catch {
        "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ERROR: `$_" | Out-File -FilePath `$logFile -Append
        `$restartCount++
        Start-Sleep -Seconds 2
    }
}
"@

    # Save wrapper to temp script
    $tempScript = Join-Path $LogDir "wrapper_$($PID).ps1"
    $wrapperCode | Out-File -FilePath $tempScript -Encoding utf8

    # Start wrapper in background
    Start-Process -FilePath "pwsh" -ArgumentList "-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$tempScript`"" -WindowStyle Hidden

    # Wait for server to start
    Start-Sleep -Seconds 3

    # Check if started successfully
    if (Test-ServerRunning) {
        $pid = Get-Content $PidFile
        Print-Ok "Server started successfully!"
        Write-Host ""
        Print-Header "SERVER INFO"
        Write-Host "  Status  : " -NoNewline
        Write-Host "RUNNING" -ForegroundColor Green
        Write-Host "  PID     : $pid"
        Write-Host "  URL     : " -NoNewline
        Write-Host "http://localhost:5173" -ForegroundColor Cyan
        Write-Host "  Network : Use your local IP from below for mobile access"
        Write-Host ""
        Write-Host "  Your Network IPs:"
        foreach ($ip in $localIPs) {
            Write-Host "             - " -NoNewline
            Write-Host "http://$ip`:5173" -ForegroundColor Cyan
        }
        Write-Host ""
        Write-Host "============================================================" -ForegroundColor Cyan
        Write-Host "  Log File: $logFile"
        Write-Host "  Use 'mkd logs' to view logs"
        Write-Host "  Use 'mkd stop' to stop the server"
        Write-Host "============================================================" -ForegroundColor Cyan
        Write-Host ""
    } else {
        Print-Error "Failed to start server. Check log file:"
        Write-Host "        $logFile" -ForegroundColor Yellow
        Remove-Item $PidFile -ErrorAction SilentlyContinue
        exit 1
    }
}

function Stop-Server {
    Print-Info "Stopping MoneyKracked Development Server..."

    # Remove PID file FIRST to stop auto-restart loop
    Remove-Item $PidFile -ErrorAction SilentlyContinue

    # Kill only npm processes running "npm run start"
    Get-Process npm -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            $cmd = (Get-WmiObject Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
            if ($cmd -like "*npm run start*") {
                Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
            }
        } catch {}
    }

    # Kill process listening on our port (5173)
    $port = 5173
    $netstatResult = netstat -ano | Select-String ":$port.*LISTENING"
    if ($netstatResult) {
        foreach ($line in $netstatResult) {
            $parts = $line -split '\s+'
            $pidOnPort = $parts[-1]
            if ($pidOnPort -match '^\d+$') {
                Stop-Process -Id $pidOnPort -Force -ErrorAction SilentlyContinue
            }
        }
    }

    # Clean up temp wrapper scripts
    Get-ChildItem (Join-Path $LogDir "wrapper_*.ps1") -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

    Print-Ok "Server stopped successfully"
    Write-Host ""
}

function Show-Status {
    Print-Header "Server Status"

    if (Test-ServerRunning) {
        $pid = Get-Content $PidFile
        Write-Host "  Status: " -NoNewline
        Write-Host "RUNNING" -ForegroundColor Green
        Write-Host "  PID:    $pid"
        Write-Host "  URL:    " -NoNewline
        Write-Host "http://localhost:5173" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  Use 'mkd logs' to view logs"
        Write-Host "  Use 'mkd stop' to stop the server"
    } else {
        Write-Host "  Status: " -NoNewline
        Write-Host "STOPPED" -ForegroundColor Red
        Write-Host ""
        Write-Host "  Start the server with: mkd start"
        Remove-Item $PidFile -ErrorAction SilentlyContinue
    }
    Write-Host ""
}

function Show-Logs {
    if (-not (Test-Path $LogDir)) {
        Print-Error "No logs directory found"
        exit 1
    }

    $latestLog = Get-ChildItem (Join-Path $LogDir "server_*.log") -ErrorAction SilentlyContinue |
                 Sort-Object LastWriteTime -Descending |
                 Select-Object -First 1

    if (-not $latestLog) {
        Print-Error "No log files found"
        exit 1
    }

    Print-Info "Showing logs from: $($latestLog.Name)"
    Print-Info "Press Ctrl+C to stop watching"
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host ""

    # Get current log content and tail it
    Get-Content $latestLog.FullName -Wait -Tail 20
}

function Show-Help {
    Print-Header "MoneyKracked Development Server Manager"
    Write-Host ""
    Write-Host "  Commands:"
    Write-Host "    ./mkd.ps1 start    - Start the development server in background"
    Write-Host "    ./mkd.ps1 stop     - Stop the development server"
    Write-Host "    ./mkd.ps1 restart  - Restart the development server"
    Write-Host "    ./mkd.ps1 status   - Show server status"
    Write-Host "    ./mkd.ps1 logs     - View server logs (live tail)"
    Write-Host ""
    Write-Host "  Shortcuts (after initial setup):"
    Write-Host "    mkd start"
    Write-Host "    mkd stop"
    Write-Host ""
}

# ============================================================
# Main
# ============================================================

# Create logs directory
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

# Execute command
switch ($Command) {
    'start' { Start-Server }
    'stop' { Stop-Server }
    'status' { Show-Status }
    'logs' { Show-Logs }
    'restart' {
        Stop-Server
        Start-Sleep -Seconds 1
        Start-Server
    }
    'help' { Show-Help }
}
