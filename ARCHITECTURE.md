# 🗺️ Kim Ko'proq — Complete Architecture Map

## Overview
Multi-user test/survey platform with Telegram Mini App integration.
- **Stack**: Next.js 16, TypeScript, Prisma (PostgreSQL), NextAuth, Tailwind CSS 4, shadcn/ui
- **Auth**: 3 paths (email/password, Telegram Mini App JWT, Telegram bot binding)
- **Bot**: Reply keyboard + inline CRUD + native polls

---

## 📁 File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/     # NextAuth handler
│   │   ├── register/               # Email registration
│   │   ├── profile/                # GET/PUT user profile
│   │   ├── sets/                   # GET list, POST create
│   │   ├── sets/[id]/              # GET/PUT/DELETE set
│   │   ├── sets/[id]/questions/    # GET/POST questions
│   │   ├── questions/[id]/         # PUT/DELETE question
│   │   ├── avatars/                # GET list, POST create
│   │   ├── avatars/[id]/           # PUT/DELETE avatar
│   │   ├── groups/                 # GET list, POST create
│   │   ├── groups/[id]/            # PUT/DELETE group
│   │   ├── vote/                   # POST vote, GET progress
│   │   ├── guest-vote/             # POST/GET anonymous votes
│   │   ├── results/                # GET aggregated results
│   │   ├── seed/                   # GET/POST demo data
│   │   ├── upload/                 # ⚠️ MISSING — needed by avatars + profile
│   │   └── telegram/
│   │       ├── auth/               # Telegram Mini App login
│   │       └── webhook/            # Bot webhook handler
│   ├── layout.tsx                  # Root layout (fonts, Telegram SDK)
│   ├── page.tsx                    # Main entry (auth check → Login/AppShell/Guest)
│   └── globals.css                 # Theme + brand styles
│
├── components/
│   ├── ui/                         # shadcn/ui components
│   └── kk/
│       ├── app-shell.tsx           # Main layout (header + nav + pages)
│       ├── login-screen.tsx        # Email login/register
│       ├── guest-mode.tsx          # Guest test flow (share link)
│       ├── sets-page.tsx           # Sets list + detail + test + results
│       ├── avatars-page.tsx        # Avatars + groups CRUD
│       ├── profile-page.tsx        # Profile edit + logout
│       └── providers.tsx            # SessionProvider wrapper
│
├── lib/
│   ├── db.ts                       # Prisma client singleton
│   ├── auth.ts                     # NextAuth config
│   ├── auth-utils.ts               # bcrypt, email validation
│   ├── session.ts                  # getCurrentUserDb (JWT + NextAuth)
│   ├── jwt.ts                      # Custom HS256 JWT (no expiry!)
│   ├── api-client.ts               # fetch wrapper with auth header
│   ├── telegram.ts                 # initData validation + token normalization
│   ├── telegram-client.ts          # Client-side Telegram SDK + login
│   ├── telegram-bot.ts             # Bot logic (reply keyboard + CRUD + polls)
│   ├── demo-seed.ts                # ensureUserDemoSet + ensureDemoSeed
│   └── original-data.ts            # 27 members + 29 questions
│
└── types/
    └── next-auth.d.ts              # Session.user.id augmentation

prisma/
└── schema.prisma                   # 11 models (User, QuestionSet, etc.)
```

---

## 🔐 Auth Flow

```
User opens site
       │
       ├── Has ?share=<setId> in URL?
       │     └── YES → GuestMode (no auth, votes via guestToken)
       │
       ├── In Telegram Mini App? (window.Telegram.WebApp.initData exists)
       │     └── YES → POST /api/telegram/auth
       │           ├── Validates initData (HMAC-SHA256)
       │           ├── Find-or-create User
       │           ├── Signs JWT (kk_tg_token in localStorage)
       │           └── ensureUserDemoSet(userId)
       │
       ├── NextAuth session cookie exists?
       │     └── YES → AppShell (logged in)
       │
       └── None of the above → LoginScreen
             ├── Register → POST /api/register → ensureUserDemoSet
             └── Login → signIn("credentials") → NextAuth cookie
```

### Auth Issues:
- **No account linking** — email user + Telegram user = 2 separate accounts
- **JWT never expires** — no `exp` claim, valid forever
- **JWT in localStorage** — XSS vulnerable
- **Dead Telegram provider** in auth.ts (never called by client)

---

## 📊 Data Flow

```
QuestionSet (owned by User)
    ├── has many Questions (text, emoji, category)
    ├── has groupIds (JSON array of AvatarGroup IDs)
    └── receives Votes + GuestVotes

AvatarGroup (owned by User)
    └── has many Avatars (name, photo, iconName)

Avatar (owned by User, in one Group)
    └── receives Votes (as target)

Vote (voterId → questionId → targetId, groupId)
GuestVote (guestToken → questionId → targetId, groupId)
```

### Data Flow Issues:
- **Self-vote check broken** — `avatar.id === user.id` compares avatar cuid to user cuid (never matches)
- **No `User.selectedAvatarId`** — server doesn't know which avatar is "me"
- **`groupIds` not enforced server-side** — client-only filtering
- **`/api/avatars?setId=`** — ignored for logged-in users (wrong avatars shown)
- **`ensureUserDemoSet` wipes customization** — deletes ALL avatars if count < 27

---

## 🤖 Bot Architecture

```
Telegram Update → /api/telegram/webhook
    ├── Validates X-Telegram-Bot-Api-Secret-Token
    ├── Dedupes via TgUpdate table
    └── handleUpdate()
          ├── poll_answer → onPollAnswer → recordVote
          ├── callback_query → onCallback (inline button router)
          └── message → reply keyboard handler
                ├── 📋 Setlar → setlist → set detail → CRUD
                ├── 👥 Avatari → avatarlist → avatar detail → CRUD
                ├── 👤 Profil → profile info
                └── 🔍 Izlash → URL search → web_app button
```

### Bot Issues:
- **No ownership checks** on avatar/group delete
- **`getAvatarsForBot` always loads demo user's avatars** — ignores user's own
- **`markUpdate` dedupe broken** — upsert "update" branch doesn't detect duplicates
- **Multi-select polls** — only last selected option is saved
- **Typo "Aavatarlar"** in multiple places

---

## 🎨 UI Pages

```
LoginScreen (unauthenticated)
    ├── Login tab (email + password)
    └── Register tab (name + email + password)

AppShell (authenticated)
    ├── Header: logo + search + action buttons (create/edit/delete)
    ├── Content:
    │     ├── SetsPage
    │     │     ├── Set list (cards with emoji, count, mode badge)
    │     │     ├── SetDialog (create/edit + group selection)
    │     │     └── SetDetailView
    │     │           ├── Questions tab (list + CRUD)
    │     │           ├── Test tab (pick avatar per question)
    │     │           ├── Results tab (polls with voter stacks)
    │     │           └── People tab (wins + mentions per avatar)
    │     ├── AvatarsPage
    │     │     ├── Avatar grid (photo or icon)
    │     │     ├── AvatarDialog (create/edit + photo upload + icon picker)
    │     │     └── GroupDialog (create group)
    │     └── ProfilePage (name, photo, logout)
    └── Bottom nav: Setlar | Avatari | Profil

GuestMode (unauthenticated, via ?share=setId)
    ├── Pick Me screen ("SEN KIMSAN?")
    ├── Question flow (group grids with mandatory + optional)
    ├── Results (public, includes guest votes)
    └── People (public, wins + mentions)
```

### UI Issues:
- **`/api/upload` missing** — photo upload fails silently
- **`iconName` not rendered in AvatarTile** — icons lost in test view
- **`isDemo` flag never set by API** — demo avatar protection doesn't work
- **`localStorage.removeItem("kk_guest_me_*")`** — wildcards don't work
- **Profile edit uses `Object.assign`** — doesn't trigger re-render
- **ShareDialog hardcodes vercel URL** — wrong for other deployments

---

## 🗃️ Database Schema (11 models)

```
User ──< QuestionSet ──< Question ──< Vote
  │          │              │           │
  │          │              └──< QuestionHistory
  │          │
  │          ├──< Vote (via setId)
  │          └──< GuestVote
  │
  ├──< AvatarGroup ──< Avatar ──< Vote
  │                      │           │
  │                      └──< GuestVote
  │
  ├──< Vote (as voter)
  ├──< Session, Account (NextAuth)
  └──< TelegramBinding

TgSession, TgPoll, TgUpdate (bot support tables)
```

### Schema Issues:
- **No `User.selectedAvatarId`** — can't enforce self-vote skip
- **`Vote.groupId` is free-form String** — no FK to AvatarGroup
- **`QuestionSet.groupIds` is JSON string** — no referential integrity
- **Missing indexes** on `QuestionSet.ownerId`, `Vote.setId` (single-column)
- **No soft-delete on QuestionSet** — hard delete cascades everything
