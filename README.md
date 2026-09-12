# ⚡ Kim ko'proq...?

Test/survey platform with full Telegram Mini App integration. Built with Next.js 16, Prisma, NextAuth, and Telegram WebApp SDK.

## ✨ Features

### 🔐 Authentication
- **Email + Password** registration/login on web (NextAuth)
- **Telegram Mini App** auto-login: when opening from Telegram bot, account is created automatically via validated `initData`
- Profile editing: first name, last name, profile picture upload
- Same account works on web and Telegram — fully synced via shared database

### 📋 Question Sets
- Create / edit / delete question sets (CRUD via universal top-bar buttons)
- Each set has:
  - Title, description, emoji
  - **Mode switch**: Strict (only owner edits) vs Loose (any logged-in user can edit)
  - Public / private flag
- Strict mode locks questions to set owner; Loose mode allows anyone to add/edit/delete questions
- Take the test: pick an avatar per question (mandatory for own group, optional for other groups)
- Results page: aggregated votes with progress bars

### 👥 Avatars (people)
- Create avatars for voting — each avatar has:
  - Name + short name
  - Either a **photo upload** OR a **professional icon** (manager, doctor, developer, etc.)
  - Optional group assignment (e.g. Group A / Group B)
- Avatars can be filtered by group
- Universal buttons work here too (create / edit / delete / search)

### 🎛️ Universal Top Bar
Square-shaped action buttons (matching the design):
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

### Local development
```bash
bun install
cp .env.example .env
# Fill in TELEGRAM_BOT_TOKEN and NEXTAUTH_SECRET
bun run db:push    # creates SQLite db
bun run dev        # http://localhost:3000
```

### Deploy to Vercel
1. Push this repo to GitHub
2. Import in Vercel
3. Set env vars:
   - `DATABASE_URL` — Neon Postgres connection string (recommended for production)
   - `TELEGRAM_BOT_TOKEN`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` — your Vercel deployment URL
   - `NEXT_PUBLIC_MINI_APP_URL` — same as above
4. Deploy

### Telegram webhook setup
After deploying, set the webhook:
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://your-app.vercel.app/api/telegram/webhook" \
  -d "secret_token=$(echo -n '<TOKEN>|kim-koproq' | sha256sum | cut -c1-48)"
```

Or use the `@BotFather` "Menu Button" → "Edit menu button URL" to point to your deployment so the Mini App opens from the bot's menu.

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

Logo: stylized shield with two cards (green question mark + yellow lightning), red arrows pointing inward.

## 🛠️ Tech stack
- Next.js 16 (App Router, Turbopack)
- TypeScript 5
- Tailwind CSS 4 + shadcn/ui (New York style)
- Prisma ORM (SQLite dev / Postgres prod)
- NextAuth.js v4 (Credentials provider + custom Telegram provider)
- Telegram WebApp SDK (`telegram-web-app.js`)
- bcryptjs for password hashing
- Lucide React icons

## 📝 License
MIT — built for the "Kim ko'proq...?" project.
