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
║    ██╔═██╗ ██╔══██╗██╔══██║██║     ██╔═██╗ ██╔══╝  ██║  ██║  ║
║    ██║  ██╗██║  ██║██║  ██║╚██████╗██║  ██╗███████╗██████╔╝  ║
║    ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═════╝   ║
║                                                              ║
║         Build Wealth Without The Boring Stuff!               ║
╚══════════════════════════════════════════════════════════════╝
```

---

## ✨ Features

### 🎛️ Web Dashboard
- **Visual Budgeting** - Track limits with progress bars
- **Multi-Currency** - Live rates for MYR, USD, SGD
- **Pixel Art UI** - Retro-gaming inspired interface
- **Reports & Analytics** - Beautiful charts for savings vs expenses
- **CSV/PDF Export** - Download your financial data easily
- **Transaction Log** - Categorized history with smart filters
- **Secure Auth** - Powered by Better-Auth (Email/GitHub)

### 🤖 AI Financial Coach (Gemini Powered)
Your personal financial advisor that knows your budget context!

| Feature | Description |
|---------|-------------|
| 💬 **Context Aware** | Knows your overspent categories and budget limits |
| 🚨 **Overspent Advice** | Autonomously analyzes *why* you overspent and gives tips |
| 📊 **Smart Analysis** | "How much did I spend on Food last month?" |
| 💡 **Financial Tips** | Personalized saving strategies based on YOUR habits |
| 🇲🇾 **Local Knowledge** | Understands Malaysian financial context (EPF, etc.) |

### 🎨 Visual Experience
- **Edge-to-Edge Layout** - Immersive, full-screen app feel
- **Responsive Design** - Works on Desktop, Tablet, and Mobile
- **Interactive Charts** - Visualise where your money goes
- **Gamified Elements** - Makes finance feel less like a chore

---

## 📋 Table of Contents

1. [Prerequisites](#-prerequisites)
2. [Installation](#-installation)
3. [Database Setup](#-database-setup-postgresql)
4. [Environment Setup](#-environment-setup)
5. [Running the Application](#-running-the-application)
6. [Project Structure](#-project-structure)
7. [Troubleshooting](#-troubleshooting)

---

## 📦 Prerequisites

### Required Software

| Software | Minimum Version | Recommended | Download |
|----------|-----------------|-------------|----------|
| **Node.js** | v18.0.0 | v20.x LTS | [nodejs.org](https://nodejs.org/) |
| **PostgreSQL** | v14.0 | v16.x | [postgresql.org](https://www.postgresql.org/download/) |
| **Git** | Any | Latest | [git-scm.com](https://git-scm.com/) |

### System Requirements

- **RAM**: Minimum 4GB for dev
- **OS**: Windows 10/11, macOS, Linux

---

## 🎯 Complete Installation Guide (A to Z)

This section provides **step-by-step instructions** for complete beginners.

### Part 1: Install Prerequisites

#### Windows

**1.1 Install Node.js**

1. Go to [nodejs.org](https://nodejs.org/)
2. Download **LTS version**
3. Run installer → Click "Next" through all steps
4. ✅ Verify installation:
   ```cmd
   node --version
   npm --version
   ```

**1.2 Install PostgreSQL**

1. Go to [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
2. Download installer
3. Run installer:
   - **Password**: Enter `postgres` (or remember your custom password!)
   - **Port**: Keep default `5432`
4. ✅ Verify installation:
   ```cmd
   psql --version
   ```

**1.3 Install Git**

1. Go to [git-scm.com](https://git-scm.com/)
2. Download for Windows and install.

#### macOS

**1.1 Install via Homebrew**

```bash
# Install Node.js
brew install node@20

# Install PostgreSQL
brew install postgresql@14
brew services start postgresql@14

# Install Git
brew install git
```

---

### Part 2: Download & Setup Project

**2.1 Clone Repository**

Open terminal/command prompt:

```bash
# Clone repository
git clone https://github.com/MoonWIRaja/MoneyKracked.git

# Enter directory
cd MoneyKracked
```

**2.2 Install Dependencies**

```bash
# This will install all required packages
npm install
```

---

### Part 3: Database Setup

**3.1 Create Database**

**Option A: Using psql (All platforms)**

```bash
# Connect to PostgreSQL default database
psql -U postgres

# Enter password (e.g., postgres)
# In psql shell:
CREATE DATABASE moneykracked;

# Exit
\q
```

**Option B: Using automated script (if available)**
We use Drizzle Kit to manage schemas, so creating the empty DB first is required.

**3.2 Push Schema**

```bash
# Apply database tables and structure
npm run db:push
```

Expected output:
```
✅ Pushing schema to database...
✅ Done!
```

---

### Part 4: Environment Configuration

**4.1 Create .env File**

```bash
# Windows
copy .env.example .env

# macOS/Linux
cp .env.example .env
```

**4.2 Edit .env File**

Open `.env` in text editor and update:

```env
# 1. Database (check username/password match your PostgreSQL)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/moneykracked"

# 2. Authentication Secret (Generate a random string)
BETTER_AUTH_SECRET=your_super_secret_random_string

# 3. Google Gemini API Key (Required for AI Coach)
# Get from: https://ai.google.dev/
GEMINI_API_KEY=your_gemini_api_key

# 4. Email / SMTP (Optional for local dev)
SMTP_HOST=smtp.gmail.com
SMTP_USER=your@email.com
SMTP_PASS=your_app_password
```

Save the file.

---

### Part 5: Running the Application

**5.1 Start Development Server**

```bash
npm run dev
```

Expected output:
```
  VITE v6.0.0  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**5.2 Access Web Dashboard**

1. Open browser
2. Go to: **http://localhost:5173**
3. Register a new account
4. Start tracking your wealth!

---

## 📁 Project Structure

```
MoneyKracked/
├── .env                      # Environment variables
├── drizzle.config.ts         # ORM Configuration
├── package.json              # Dependencies
│
├── src/
│   ├── lib/
│   │   ├── server/
│   │   │   ├── db/
│   │   │   │   ├── index.ts      # DB Connection
│   │   │   │   └── schema.ts     # DB Tables
│   │   │   └── ai/               # Gemini AI Logic
│   │   ├── stores/               # Svelte 5 Runes (State)
│   │   └── components/           # UI Components (Pixel Art)
│   │
│   └── routes/                   # Pages (SvelteKit)
│       ├── (app)/                # Protected Routes
│       │   ├── dashboard/        # Main Dashboard
│       │   ├── transactions/     # Transaction Log
│       │   ├── budget/           # Budget Planner
│       │   ├── reports/          # Charts & Analytics
│       │   └── coach/            # AI Chat Interface
│       └── (auth)/               # Login/Register
│
└── drizzle/                  # Database Migrations
```

---

## 🆘 Troubleshooting

### PostgreSQL Connection Failed

**Error:** `password authentication failed for user "postgres"`

Check `DATABASE_URL` in `.env`. If you set a custom password during installation, use format:
`postgresql://postgres:YOUR_PASSWORD@localhost:5432/moneykracked`

### AI Coach Not Responding

1. Check `GEMINI_API_KEY` in `.env`.
2. Ensure you have internet access.
3. Check server console for "GoogleGenerativeAI Error".

### "Better Auth" Error

If you see auth errors, try:
1. Clearing browser cookies.
2. Ensure `BETTER_AUTH_SECRET` is set in `.env`.
3. Restart server.

---

## 📄 License

MIT License - Free to use and crack your money goals!

---

## 🙏 Acknowledgments

- Built with [SvelteKit](https://kit.svelte.dev/)
- Database: [PostgreSQL](https://www.postgresql.org/) + [Drizzle](https://orm.drizzle.team/)
- AI: [Google Gemini](https://ai.google.dev/)
- Styling: [TailwindCSS](https://tailwindcss.com/)

---

Made with 💸 by MoonWiRaja (KRACKED DEV)
