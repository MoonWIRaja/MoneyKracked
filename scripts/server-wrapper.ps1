# ============================================================
# MoneyKracked Server Wrapper
# Runs npm run dev with auto-restart on crash
# ============================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$LogFile,

    [Parameter(Mandatory=$true)]
    [string]$PidFile
)

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $PSScriptRoot

# Function to write to both console and log file
function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] $Message"
    Add-Content -Path $LogFile -Value $logEntry
}

# Function to get local IP addresses
function Get-LocalIPs {
    $ips = @()
    $adapters = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue
    foreach ($adapter in $adapters) {
        if ($adapter.IPAddress -ne "127.0.0.1" -and !$adapter.IPAddress.StartsWith("169.254")) {
            $ips += $adapter.IPAddress
        }
    }
    return $ips
}

# Main server loop with auto-restart
$RestartCount = 0
$MaxRestarts = 100  # Safety limit

while ($RestartCount -lt $MaxRestarts) {
    try {
        # Log restart attempt if not first run
        if ($RestartCount -gt 0) {
            Write-Log "============================================================"
            Write-Log "AUTO-RESTART #$RestartCount - Server crashed, restarting..."
            Write-Log "============================================================"
        } else {
            Write-Log "============================================================"
            Write-Log "Starting MoneyKracked Development Server"
            Write-Log "============================================================"

            # Get and log network info
            $ips = Get-LocalIPs
            Write-Log "Local IPs: $($ips -join ', ')"
            Write-Log "Server will be available at:"
            Write-Log "  - http://localhost:5173"
            foreach ($ip in $ips) {
                Write-Log "  - http://$ip`:5173"
            }
            Write-Log "============================================================"
            Write-Log ""
        }

        # Change to project directory
        Set-Location $ScriptDir

        # Start the dev server
        $process = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -PassThru -WindowStyle Hidden -RedirectStandardOutput $LogFile -RedirectStandardError $LogFile

        # Write PID to file
        $process.Id | Out-File -FilePath $PidFile -Force

        Write-Log "Server started with PID: $($process.Id)"
        Write-Log ""

        # Wait for process to exit
        $process.WaitForExit()
        $exitCode = $process.ExitCode

        # Remove PID file (process exited)
        Remove-Item $PidFile -ErrorAction SilentlyContinue

        # Check if it was intentional stop (PID file removed externally = stop requested)
        if (-not (Test-Path $PidFile)) {
            Write-Log "Server stopped. Not restarting (mkd stop was used)."
            break
        }

        # Check exit code
        if ($exitCode -eq 0) {
            Write-Log "Server exited cleanly (exit code 0). Not restarting."
            break
        }

        # Otherwise, it crashed - restart
        $RestartCount++

        # Wait a bit before restarting
        Start-Sleep -Seconds 2

    } catch {
        Write-Log "ERROR: $_"
        $RestartCount++
        Start-Sleep -Seconds 2
    }
}

if ($RestartCount -ge $MaxRestarts) {
    Write-Log "ERROR: Server restarted $MaxRestarts times. Giving up."
}
