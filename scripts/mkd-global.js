#!/usr/bin/env node
// ============================================================
// MoneyKracked Development Server Manager - Global Runner
// Works from any directory - automatically finds project root
// Usage: mkd [start|stop|status|logs|restart]
// ============================================================

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const command = process.argv[2] || 'help';
const validCommands = ['start', 'stop', 'status', 'logs', 'restart', 'help'];

if (!validCommands.includes(command)) {
    console.log('Invalid command. Use: start, stop, status, logs, restart, help');
    process.exit(1);
}

// Find project root by looking for package.json with "moneykracked" name
function findProjectRoot(startDir) {
    let currentDir = startDir;

    while (currentDir !== path.parse(currentDir).root) {
        const pkgPath = path.join(currentDir, 'package.json');

        if (fs.existsSync(pkgPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                if (pkg.name === 'moneykracked') {
                    return currentDir;
                }
            } catch (e) {
                // Ignore errors, continue searching
            }
        }

        currentDir = path.dirname(currentDir);
    }

    return null;
}

// Get project root - try current directory first
let projectRoot = findProjectRoot(process.cwd());

// If not found, try the directory where this script is located
if (!projectRoot) {
    const scriptDir = path.dirname(__dirname);
    projectRoot = findProjectRoot(scriptDir);
}

if (!projectRoot) {
    console.error('[!] MoneyKracked project not found.');
    console.error('    Make sure you are in or below a MoneyKracked project directory.');
    process.exit(1);
}

const platform = os.platform();
let scriptPath, shell, args;

if (platform === 'win32') {
    // Windows - use batch file
    scriptPath = path.join(projectRoot, 'mkd.bat');
    shell = scriptPath;
    args = [command];
} else {
    // macOS and Linux - use the mkd script
    scriptPath = path.join(projectRoot, 'mkd');
    shell = scriptPath;
    args = [command];
}

// Check if script exists
if (!fs.existsSync(scriptPath)) {
    console.error(`[!] Script not found: ${scriptPath}`);
    process.exit(1);
}

// Spawn the appropriate script with inherited stdio
const child = spawn(shell, args, {
    stdio: 'inherit',
    cwd: projectRoot,
    shell: platform === 'win32' // Use shell on Windows for .bat files
});

child.on('exit', (code) => {
    process.exit(code || 0);
});

child.on('error', (err) => {
    console.error(`Error running mkd command: ${err.message}`);

    // Fallback for Windows: try with cmd.exe
    if (platform === 'win32') {
        const cmdChild = spawn('cmd.exe', ['/C', scriptPath, command], {
            stdio: 'inherit',
            cwd: projectRoot
        });

        cmdChild.on('exit', (code) => process.exit(code || 0));
    } else {
        process.exit(1);
    }
});
