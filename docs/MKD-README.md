# MoneyKracked Server Manager

Cross-platform command system to manage the production server with background execution, logging, and auto-restart capability.

## Installation (Global Command)

Run once to install `mkd` as a global command:

```bash
npm link
```

Now you can use `mkd` from **any directory** (as long as you're inside or below a MoneyKracked project):

```bash
mkd start    # Start production server in background
mkd stop     # Stop server
mkd status   # Check server status
mkd logs     # View server logs (live tail)
mkd restart  # Restart server
```

## Quick Start

```bash
mkd start    # Start production server in background
mkd stop     # Stop server
mkd status   # Check server status
mkd logs     # View server logs (live tail)
mkd restart  # Restart server
```

## Commands

| Command | Description |
|---------|-------------|
| `mkd start` | Start the **production** server (npm run start) in background |
| `mkd stop` | Stop the production server |
| `mkd restart` | Restart the production server |
| `mkd status` | Show server status |
| `mkd logs` | View server logs (live tail) |

**Note:** Use `npm run dev` for development with hot reload. Use `mkd start` for production server.

## Features

### Works From Any Directory
Once installed with `npm link`, you can run `mkd` commands from any folder within your MoneyKracked project. The command automatically finds the project root.

### Auto-Restart on Crash
If the server crashes for any reason, it will automatically restart. The server will keep running until you explicitly stop it.

### Network Resilience
- Internet disconnect? Server keeps running
- Server crash? Auto-restarts
- Only `mkd stop` will stop the server

### Organized Logs
All logs are stored in the `logs/` folder:
```
logs/
├── server_2025-01-11_143022.log
├── server_2025-01-11_150530.log
└── .server.pid
```

## Example Output

```
$ mkd start

[*] Starting MoneyKracked Development Server...

[OK] Server started successfully!

============================================================
  SERVER INFO
============================================================
  Status  : RUNNING
  PID     : 12345
  URL     : http://localhost:5173
  Network : Use your local IP from below for mobile access

  Your Network IPs:
             - http://192.168.1.100:5173

============================================================
  Log File: logs\server_2025-01-11_143022.log
  Use 'mkd logs' to view logs
  Use 'mkd stop' to stop the server
============================================================
```

## Troubleshooting

### Command not found after npm link
```bash
# Check if npm global bin is in your PATH
npm config get prefix

# On Windows, add this to your PATH:
# %APPDATA%\npm

# On macOS/Linux, add this to your PATH:
# $(npm config get prefix)/bin
```

### Server won't start
```bash
# Check if already running
mkd status

# Force stop first
mkd stop

# Then start again
mkd start
```

### Check logs for errors
```bash
mkd logs
```

### Uninstall global command
```bash
npm unlink -g moneykracked
```

## Platform-Specific Notes

### Windows
- Uses `mkd.bat` internally
- Works in cmd, PowerShell, and Git Bash

### macOS / Linux
- Uses the `mkd` bash script internally
- No additional setup needed after `npm link`
