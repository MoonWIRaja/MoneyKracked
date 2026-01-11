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

- **RAM**: Minimum 4GB for Development
- **OS**: Windows 10/11, macOS 10.15+, Ubuntu 20.04+

---

## 🎯 Complete Installation Guide (A to Z)

### Part 1: Install Prerequisites

#### Windows

**1.1 Install Node.js**
1. Visit [nodejs.org](https://nodejs.org/)
2. Download the **LTS version** (v20.x recommended)
3. Run the installer and follow the prompts.
4. ✅ Verify: `node --version` & `npm --version`

**1.2 Install PostgreSQL**
1. Visit [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
2. Download and run the installer.
3. **Password**: Set to `postgres` (or remember your custom choice!).
4. **Port**: Default is `5432`.
5. ✅ Verify: `psql --version`

**1.3 Install Git**
1. Visit [git-scm.com](https://git-scm.com/)
2. Download and install for Windows.

#### macOS

```bash
# Using Homebrew
brew install node@20 postgresql@14 git

# Start PostgreSQL
brew services start postgresql@14
```

#### Linux (Ubuntu)

```bash
sudo apt update
sudo apt install nodejs npm postgresql postgresql-contrib git
```

---

### Part 2: Setup Project

**2.1 Clone Repository**
```bash
git clone https://github.com/MoonWIRaja/MoneyKracked.git
cd MoneyKracked
```

**2.2 Install Dependencies**
```bash
npm install
```

---

### Part 3: Database Setup

**3.1 Create Database**
```bash
# Connect to psql
psql -U postgres

# In psql shell:
CREATE DATABASE moneykracked;
\q
```

**3.2 Push Schema**
```bash
npm run db:push
```

---

### Part 4: Environment Configuration

**4.1 Create .env File**
```bash
cp .env.example .env
```

**4.2 Edit .env File**
Update the following critical variables:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/moneykracked"
BETTER_AUTH_SECRET=your_random_string_here
GEMINI_API_KEY=your_gemini_api_key_here # Get from https://ai.google.dev/
```

---

### Part 5: Running the Application

**5.1 Start Dev Server**
```bash
npm run dev
```

**5.2 Access Web UI**
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📁 Project Structure

```
MoneyKracked/
├── src/
│   ├── lib/              # Core logic & utilities
│   │   ├── server/       # Server-only code (DB, AI, Auth)
│   │   ├── stores/       # Svelte 5 Stores
│   │   └── components/   # Pixel Art UI Components
│   └── routes/           # Pages & API Endpoints
├── drizzle/              # Migrations & Schema
└── static/               # Assets (Logo, Favicon)
```

---

## 🆘 Troubleshooting

- **DB Error**: Check your `DATABASE_URL` matches your local Postgres credentials.
- **AI Error**: Ensure your `GEMINI_API_KEY` is valid and has sufficient quota.
- **Port Busy**: If `5173` is taken, try `npm run dev -- --port 3000`.

---

## 📄 License

MIT License - Created with 💜 by **MoonWiRaja (KRACKED DEV)**
