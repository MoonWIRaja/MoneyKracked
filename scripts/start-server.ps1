# MoneyKracked Server Auto-Restart Wrapper
param(
    [string]$LogFile,
    [string]$PidFile
)

$restartCount = 0
$maxRestarts = 100

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    "[$timestamp] $Message" | Out-File -FilePath $LogFile -Append
}

while ($restartCount -lt $maxRestarts) {
    try {
        if ($restartCount -gt 0) {
            Write-Log "Server crashed, restarting... (attempt $restartCount)"
        }

        # Change to script directory
        Set-Location $PSScriptRoot\..

        # Start npm run start (production server)
        $process = Start-Process -FilePath "npm" -ArgumentList "run", "start" -PassThru -WindowStyle Hidden

        if (-not $process) {
            Write-Log "ERROR: Failed to start npm process"
            Start-Sleep -Seconds 2
            $restartCount++
            continue
        }

        # Save PID
        $process.Id | Out-File -FilePath $PidFile -Force
        Write-Log "Server started with PID: $($process.Id)"

        # Wait for process to exit
        $process.WaitForExit()

        # Check if we should restart
        if (Test-Path $PidFile) {
            $restartCount++
            Start-Sleep -Seconds 2
        } else {
            Write-Log "Server stopped (mkd stop was used)"
            break
        }
    } catch {
        Write-Log "ERROR: $_"
        $restartCount++
        Start-Sleep -Seconds 2
    }
}
