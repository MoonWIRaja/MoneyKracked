#!/usr/bin/env node
// ============================================================
// MoneyKracked Development Server Manager
// Cross-platform Node.js runner
// Works on Windows, macOS, and Linux
// Usage: node scripts/mkd.js [start|stop|status|logs|restart]
// ============================================================

const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');

const command = process.argv[2] || 'help';
const validCommands = ['start', 'stop', 'status', 'logs', 'restart', 'help'];

if (!validCommands.includes(command)) {
    console.log('Invalid command. Use: start, stop, status, logs, restart, help');
    process.exit(1);
}

const platform = os.platform();
const scriptDir = path.dirname(__dirname);
let scriptPath, shell, args;

if (platform === 'win32') {
    // Windows - use PowerShell script (more reliable than batch)
    scriptPath = path.join(scriptDir, 'mkd.ps1');
    shell = 'pwsh';
    args = ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, command];
} else {
    // macOS and Linux - use bash script
    scriptPath = path.join(scriptDir, 'mkd.sh');
    shell = scriptPath;
    args = [command];
}

// Spawn the appropriate script
const child = spawn(shell, args, {
    stdio: 'inherit',
    cwd: scriptDir
});

child.on('exit', (code) => {
    process.exit(code || 0);
});

child.on('error', (err) => {
    console.error(`Error running mkd command: ${err.message}`);

    // Fallback: try alternative methods
    if (platform === 'win32') {
        // Try with powershell.exe if pwsh failed
        const psChild = spawn('powershell.exe', [
            '-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass',
            '-File', scriptPath, command
        ], { stdio: 'inherit', cwd: scriptDir });

        psChild.on('exit', (code) => process.exit(code || 0));
    } else {
        process.exit(1);
    }
});
