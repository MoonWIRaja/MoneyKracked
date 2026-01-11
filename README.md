# MoneyKracked

> 💰 **Next-Gen Personal Finance Manager** - Visual Budgeting + AI-Powered Financial Coach

**Language / Bahasa:**
- 🇬🇧 **English** (You are here)
- 🇲🇾 [Bahasa Melayu](README.ms.md)

```
╔══════════════════════════════════════════════════════════════╗
║  ░▒▓ MONEY KRACKED ▓▒░                                       ║
║                                                              ║
║    ███╗   ███╗ ██████╗ ███╗   ██╗███████╗██╗   ██╗           ║
║    ████╗ ████║██╔═══██╗████╗  ██║██╔════╝╚██╗ ██╔╝           ║
║    ██╔████╔██║██║   ██║██╔██╗ ██║█████╗   ╚████╔╝            ║
║    ██║╚██╔╝██║██║   ██║██║╚██╗██║██╔══╝    ╚██╔╝             ║
║    ██║ ╚═╝ ██║╚██████╔╝██║ ╚████║███████╗   ██║              ║
║    ╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝   ╚═╝              ║
║                                                              ║
║    ██╗  ██╗██████╗  █████╗  ██████╗██╗  ██╗███████╗██████╗   ║
║    ██║ ██╔╝██╔══██╗██╔══██╗██╔════╝██║ ██╔╝██╔════╝██╔══██╗  ║
║    █████╔╝ ██████╔╝███████║██║     █████╔╝ █████╗  ██║  ██║  ║
║    ██║═██╗ ██╔══██╗██╔══██║██║     ██║═██╗ ██╔══╝  ██║  ██║  ║
║    ██║  ██╗██║  ██║██║  ██║╚██████╗██║  ██╗███████╗██████╔╝  ║
║    ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═════╝  ║
║                                                              ║
║         Build Wealth Without The Boring Stuff!               ║
╚══════════════════════════════════════════════════════════════╝
```

---

## ✨ Features

### 🎛️ Web Dashboard
- **Visual Budgeting** - Track and manage budget limits with interactive progress bars
- **Multi-Currency Support** - Live exchange rates for MYR, USD, SGD, and more!
- **Pixel Art Aesthetic** - Retro-gaming inspired UI for a fun financial experience
- **Advanced Reports** - Beautiful, interactive charts for Savings vs Expenses
- **Smart Transaction Log** - Organized history with categories and real-time filtering
- **Secure Authentication** - Powered by Better-Auth with Email & GitHub login support
- **Export Capabilities** - Download your financial reports in high-quality PDF or CSV formats

### 🤖 AI Financial Coach (Gemini Powered)
Your personal financial advisor that understands your actual budget context!

| Feature | Description |
|---------|-------------|
| 💬 **Context Aware** | Knows your overspent categories and specific budget limits in real-time |
| 🚨 **Overspent Analysis** | Automatically analyzes *why* you overspent and provides tactical recovery tips |
| 📊 **Natural Querying** | Ask questions like "How much did I spend on Food last month?" |
| 💡 **Tailored Strategies** | Personalized saving plans generated specifically for your spending habits |
| 🇲🇾 **Local Context** | Deep understanding of Malaysian financial landscape (EPF, ASB, local banks) |

### 🎨 Visual & UX Excellence
- **Immersive Layout** - Edge-to-edge content area for a modern, app-like feel
- **Responsive Architecture** - Seamlessly adapts to Desktop, Tablet, and Mobile devices
- **Smooth Animations** - Subtle micro-interactions and transitions for a premium feel
- **Dark & Light Modes** - Optimized for any lighting condition with a cohesive theme

---

## 📋 Table of Contents

1. [Prerequisites](#-prerequisites)
2. [Installation](#-installation)
3. [Database Setup](#-database-setup-postgresql)
4. [Environment Configuration](#-environment-configuration)
5. [Running the Application](#-running-the-application)
6. [Server Manager (mkd)](#-server-manager-mkd)
7. [Project Structure](#-project-structure)
8. [Troubleshooting](#-troubleshooting)

---

## 📦 Prerequisites

### Required Software

| Software | Minimum Version | Recommended | Download |
|----------|-----------------|-------------|----------|
| **Node.js** | v18.0.0 | v20.x LTS | [nodejs.org](https://nodejs.org/) |
| **PostgreSQL** | v14.0 | v16.x | [postgresql.org](https://www.postgresql.org/download/) |
| **Git** | Any | Latest | [git-scm.com](https://git-scm.com/) |

### System Requirements

- **RAM**: Minimum 4GB for Development
- **OS**: Windows 10/11, macOS 10.15+, Ubuntu 20.04+

---

## 🚀 Installation

### Step 1: Install Prerequisites

#### Windows

**Install Node.js**
1. Visit [nodejs.org](https://nodejs.org/)
2. Download the **LTS version** (v20.x recommended)
3. Run the installer and follow the prompts
4. ✅ Verify: Open cmd/PowerShell and run `node --version`

**Install PostgreSQL**
1. Visit [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
2. Download and run the installer
3. **Important**: Remember your password! (default: `postgres`)
4. **Port**: Default is `5432`
5. ✅ Verify: Open cmd/PowerShell and run `psql --version`

**Install Git**
1. Visit [git-scm.com](https://git-scm.com/)
2. Download and install for Windows

#### macOS

```bash
# Using Homebrew
brew install node@20 postgresql@16 git

# Start PostgreSQL
brew services start postgresql@16
```

#### Linux (Ubuntu)

```bash
sudo apt update
sudo apt install nodejs npm postgresql postgresql-contrib git
sudo systemctl start postgresql
```

---

### Step 2: Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/MoonWIRaja/MoneyKracked.git
cd MoneyKracked

# Install Node.js dependencies
npm install
```

---

## 🗄️ Database Setup (PostgreSQL)

### Option A: Automatic Setup (Recommended)

```bash
# This will create the database and push the schema automatically
npm run db:setup
```

### Option B: Manual Setup

**Step 1: Create Database & User**

Open your terminal and connect to PostgreSQL:

```bash
# Windows (pgAdmin 4 comes with PostgreSQL installer)
# Or use command line:
psql -U postgres

# macOS/Linux
sudo -u postgres psql
```

Once inside psql (you'll see `postgres=#`), run:

```sql
-- Create a new user (optional, you can use 'postgres')
CREATE USER moneykracked_user WITH PASSWORD 'your_secure_password';

-- Create the database
CREATE DATABASE moneykracked OWNER moneykracked_user;

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE moneykracked TO moneykracked_user;

-- Exit psql
\q
```

**Step 2: Push Database Schema**

```bash
# Push the schema to your database
npm run db:push
```

**Step 3: (Optional) Seed Sample Data**

```bash
# Add sample data for testing
npm run db:seed
```

---

## ⚙️ Environment Configuration

**Step 1: Create .env File**

```bash
# Copy the example file
cp .env.example .env
```

**Step 2: Edit .env File**

Open `.env` in your text editor and update these values:

```env
# ===== DATABASE =====
# If you created a new user (Option B above):
DATABASE_URL="postgresql://moneykracked_user:your_secure_password@localhost:5432/moneykracked"

# If you're using default postgres user:
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/moneykracked"

# ===== AUTHENTICATION =====
# Generate a secure secret (run this in terminal):
# openssl rand -base64 32 (Windows: use Git Bash or online generator)
BETTER_AUTH_SECRET=paste-your-generated-secret-here

# ===== AI FEATURES =====
# Get API key from: https://ai.google.dev/
GEMINI_API_KEY=your-gemini-api-key-here

# Alternative AI (Optional)
# Get from: https://z.ai/subscribe
ZAI_API_KEY=

# ===== EMAIL (Optional - for email verification) =====
# Skip this if you don't need email verification
EMAIL_VERIFICATION_ENABLED=false  # Set to true to enable

# For Gmail (if enabling email verification):
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # Use App Password, not regular password
SMTP_FROM=noreply@moneykracked.com
SMTP_FROM_NAME=MoneyKracked

# ===== GITHUB OAUTH (Optional) =====
# Get from: https://github.com/settings/developers
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# ===== SERVER =====
PORT=5173
```

### Generating Required Secrets

**BETTER_AUTH_SECRET** (Required)
- Windows (PowerShell): `-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})`
- macOS/Linux: `openssl rand -base64 32`
- Or use: [randomkeygen.com](https://randomkeygen.com/)

**GEMINI_API_KEY** (Required for AI Coach)
1. Go to [ai.google.dev](https://ai.google.dev/)
2. Sign in with your Google account
3. Click "Get API Key"
4. Create a new API key
5. Copy and paste into `.env`

---

## 🏃 Running the Application

### Development Mode (Hot Reload)

```bash
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Mode (Background)

Using the **mkd** server manager (recommended):

```bash
# Install mkd globally (first time only)
npm link

# Start production server in background
mkd start

# Stop server
mkd stop

# Check status
mkd status

# View logs
mkd logs

# Restart server
mkd restart
```

### Build for Production

```bash
# Build the application
npm run build

# Start production server
npm run start
```

---

## 🛠️ Server Manager (mkd)

MoneyKracked includes a cross-platform server manager for easy background operation.

### Installation

```bash
npm link
```

### Commands

| Command | Description |
|---------|-------------|
| `mkd start` | Start production server in background |
| `mkd stop` | Stop the server |
| `mkd restart` | Restart the server |
| `mkd status` | Check if server is running |
| `mkd logs` | View server logs |

### Features

- ✅ **Auto-restart** on crash
- ✅ **Works from any directory** (auto-finds project root)
- ✅ **Cross-platform** (Windows, macOS, Linux)
- ✅ **Organized logs** in `logs/` folder

### Uninstall

```bash
npm unlink -g moneykracked
```

---

## 📁 Project Structure

```
MoneyKracked/
├── src/
│   ├── lib/              # Core logic & utilities
│   │   ├── server/       # Server-only code (DB, AI, Auth)
│   │   ├── stores/       # Svelte 5 Stores (state management)
│   │   └── components/   # Pixel Art UI Components
│   └── routes/           # Pages & API Endpoints
├── drizzle/              # Database migrations & schema
├── logs/                 # Server logs (auto-created)
├── static/               # Assets (Logo, Favicon)
├── mkd.bat               # Server manager (Windows)
├── mkd                   # Server manager (macOS/Linux)
└── mkd.ps1               # Server manager (PowerShell)
```

---

## 🆘 Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
# Windows: Check Services for "postgresql-x64-[version]"
# macOS/Linux: sudo systemctl status postgresql

# Test connection
psql -U postgres -d moneykracked

# Reset database
npm run db:push
```

### Port Already in Use

```bash
# Find process using port 5173
# Windows:
netstat -ano | findstr :5173
taskkill /PID [PID] /F

# macOS/Linux:
lsof -ti:5173 | xargs kill -9
```

### AI Coach Not Working

- Verify `GEMINI_API_KEY` is set in `.env`
- Check you have quota at [ai.google.dev](https://ai.google.dev/)
- Check browser console for error messages

### Permission Denied (macOS/Linux)

```bash
# Make mkd script executable
chmod +x mkd
```

### Clean Slate Reset

```bash
# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Reset database
npm run db:push
```

---

## 📄 License

MIT License - Created with 💜 by **MoonWiRaja (KRACKED DEV)**

---

## 🙏 Credits

- **SvelteKit** - Web framework
- **Drizzle ORM** - Database toolkit
- **Better-Auth** - Authentication solution
- **Gemini AI** - AI Financial Coach
- **Chart.js** - Data visualization
- **Pixel Art** - Custom retro UI design
