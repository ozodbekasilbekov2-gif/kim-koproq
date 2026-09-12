# ⚡ Kim ko'proq...?

Test/survey platform with full Telegram Mini App integration. Built with Next.js 16, Prisma + PostgreSQL, NextAuth, and Telegram WebApp SDK.

## ✨ Features

### 🔐 Authentication
- **Email + Password** registration/login on web (NextAuth)
- **Telegram Mini App** auto-login: when opening from Telegram bot, account is created automatically via validated `initData`
- Profile editing: first name, last name, profile picture upload
- Same account works on web and Telegram — fully synced via shared database

### 📋 Question Sets
- Create / edit / delete question sets (CRUD via universal top-bar buttons)
- Each set has: title, description, emoji, **mode switch** (Strict/Loose), public/private
- Strict mode locks questions to set owner; Loose mode allows anyone to add/edit/delete
- Take the test: pick an avatar per question (mandatory for own group, optional for others)
- Results page: aggregated votes with progress bars

### 👥 Avatars (people)
- Create avatars for voting — name + short name
- Either a **photo upload** OR a **professional icon** (manager, doctor, developer, etc.)
- Optional group assignment (e.g. Group A / Group B)
- Universal buttons work here too (create / edit / delete / search)

### 🎛️ Universal Top Bar
Square-shaped action buttons:
- 🔍 Search input
- ➕ Yaratish (Create)
- ✏️ Tahrirlash (Edit)
- 🗑️ O'chirish (Delete)
- Auto-disables on Profile page

### 📱 Bottom Navigation
Square page buttons:
- **Setlar** (Question sets)
- **Avatari** (Avatars / people)
- **Profil** (Profile — universal actions disabled here)

### 🤖 Telegram Bot
- `/start` command sends a button that opens the Mini App
- Webhook endpoint at `/api/telegram/webhook` validates `X-Telegram-Bot-Api-Secret-Token`
- Auto-login: opens Mini App with validated `initData` → JWT issued → stored in localStorage → sent on every API request

## 🚀 Setup

### 1. Get a free PostgreSQL database (Neon)
Vercel serverless functions have no persistent filesystem, so SQLite won't work in production. Use Neon (free tier, no credit card):

1. Go to https://neon.tech and sign up
2. Create a new project
3. Copy the **connection string** — looks like `postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`

### 2. Local development
```bash
git clone https://github.com/ozodbekasilbekov2-gif/kim-koproq.git
cd kim-koproq
npm install
cp .env.example .env
# Edit .env:
#   DATABASE_URL=postgresql://...your Neon connection string...
#   TELEGRAM_BOT_TOKEN=...your bot token from @BotFather...
#   NEXTAUTH_SECRET=...openssl rand -base64 32...
npm run db:push    # creates tables in your Postgres
npm run dev        # http://localhost:3000
```

### 3. Deploy to Vercel
1. Push this repo to GitHub (already done if you forked)
2. Go to https://vercel.com → "New Project" → import `kim-koproq`
3. Add Environment Variables in Project Settings → Environment Variables:
   - `DATABASE_URL` = your Neon Postgres connection string
   - `TELEGRAM_BOT_TOKEN` = your bot token
   - `NEXTAUTH_SECRET` = generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL` = your Vercel URL (e.g. `https://kim-koproq.vercel.app`)
   - `NEXT_PUBLIC_MINI_APP_URL` = same as `NEXTAUTH_URL`
4. Deploy. The build will run `prisma generate && prisma db push && next build`.

### 4. Configure Telegram Mini App
After deploying, set the bot's Menu Button URL via BotFather:
1. Open `@BotFather` in Telegram
2. `/setmenubutton` → choose your bot → send your Vercel URL
3. Now when users open your bot, they see a "Menu" button that opens the Mini App

Optionally, set the webhook for native-poll features (not yet implemented):
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://your-app.vercel.app/api/telegram/webhook" \
  -d "secret_token=$(echo -n '<TOKEN>|kim-koproq' | sha256sum | cut -c1-48)"
```

## 🔑 Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Neon/Supabase/Vercel Postgres) | `postgresql://user:pass@host/db?sslmode=require` |
| `TELEGRAM_BOT_TOKEN` | Bot token from `@BotFather` | `1234:ABCdef...` |
| `NEXTAUTH_SECRET` | Random 32+ char string used to sign session JWTs | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Public URL of your deployed app | `https://kim-koproq.vercel.app` |
| `NEXT_PUBLIC_MINI_APP_URL` | Same as `NEXTAUTH_URL` (used by Telegram to open Mini App) | `https://kim-koproq.vercel.app` |

### How to generate NEXTAUTH_SECRET
Run any of these and paste the output as your `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
# or
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# or
python3 -c "import secrets; print(secrets.token_base64(32))"
```

## 🗄️ Database schema (Prisma)

- `User` — email/password OR Telegram-linked accounts
- `Account`, `Session` — NextAuth standard
- `QuestionSet` — title, mode (strict/loose), public flag
- `Question` — text, emoji, category, soft-delete + history
- `QuestionHistory` — audit log for question changes
- `Avatar` — name, photo or icon, group membership
- `AvatarGroup` — name, color tag
- `Vote` — voter → question → target avatar per group

## 🎨 Design

Brand colors (from the logo):
- 🟢 Lime green (#a3e635) — primary
- 🟡 Yellow (#facc15) — secondary / create button
- 🔴 Red (#ef4444) — delete button
- ⚪ Coral / muted — page tags

## 🛠️ Tech stack
- Next.js 16 (App Router, Turbopack)
- TypeScript 5
- Tailwind CSS 4 + shadcn/ui (New York style)
- Prisma ORM + PostgreSQL (Neon recommended)
- NextAuth.js v4 (Credentials provider + custom Telegram provider)
- Telegram WebApp SDK (`telegram-web-app.js`)
- bcryptjs for password hashing
- Lucide React icons

## 📝 License
MIT — built for the "Kim ko'proq...?" project.
