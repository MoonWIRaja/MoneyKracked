# MoneyKracked 💰

Smart Finance Dashboard with AI-powered budget coaching.

## Features

- 📊 **Dashboard** - Overview of spending, budgets, and recent transactions
- 💳 **Transactions** - Track income and expenses with categories
- 📈 **Budget** - Set spending limits per category
- 📉 **Reports** - Analyze trends and patterns
- 🤖 **AI Coach** - Get personalized financial advice
- 📸 **Receipt OCR** - Scan receipts to auto-add transactions

## Tech Stack

- **Frontend**: SvelteKit 5 + Tailwind CSS 4
- **Backend**: SvelteKit API routes
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Better Auth (email/username + GitHub OAuth)
- **AI**: Google Gemini 1.5 Flash

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Database (PostgreSQL)
DATABASE_URL=postgresql://moneykracked:moneykracked@localhost:5432/moneykracked

# Auth Secret (generate with: openssl rand -base64 32)
BETTER_AUTH_SECRET=your-secret-key

# Optional: GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Optional: Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# Server Config
PORT=5173
ALLOWED_HOSTS=your-domain.com,localhost
```

### 3. Setup Database

```bash
# Create PostgreSQL database
createdb moneykracked

# Generate migrations
npx drizzle-kit generate

# Push schema to database
npx drizzle-kit push
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Deployment

### Using Cloudflare

Add your domain to `ALLOWED_HOSTS` in `.env`:

```env
ALLOWED_HOSTS=your-domain.com,www.your-domain.com
```

### Custom Port

Change the port in `.env`:

```env
PORT=3000
```

## Project Structure

```
src/
├── lib/
│   ├── components/     # UI components
│   ├── server/         # Server-side code
│   │   ├── auth/       # Better Auth config
│   │   ├── db/         # Drizzle schema
│   │   └── ai/         # Gemini integration
│   └── auth-client.ts  # Client-side auth
├── routes/
│   ├── (app)/          # Protected app routes
│   │   ├── dashboard/
│   │   ├── transactions/
│   │   ├── budget/
│   │   ├── reports/
│   │   ├── coach/
│   │   └── settings/
│   ├── api/            # API endpoints
│   ├── login/
│   └── register/
└── hooks.server.ts     # Auth middleware
```

## License

MIT
