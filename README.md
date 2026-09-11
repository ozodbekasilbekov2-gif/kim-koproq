# Kim ko'proq...? — 2AF1 guruh so'rovi

Telegram-style "Who is most likely to…" survey for the 2AF1 group (27 members, A/B groups).

## Features
- Pick yourself (photo grid, A/B groups; 3 members without photo show a 🕵️ MAFIA card)
- ~29 creative Uzbek questions (Roast / Rostini ayt / Kelajak / Xaos) — **anyone can add, edit or delete** questions; author & editor are shown, full history is kept
- Per question: pick one person from **your own group (required)** and optionally from the other group
- Progress saved server-side, resume on any device by picking yourself again
- Results like a Telegram poll: % bars, vote counts, voter avatars, tap an option to see **who voted**, "Odamlar" tab = who won which question

## Stack
- Hono (TypeScript) · Vercel serverless (`api/index.ts`) · Neon Postgres (`@neondatabase/serverless`)
- Local dev uses embedded PGlite when `DATABASE_URL` is not set — no setup needed
- Vanilla JS frontend + Tailwind CDN (`public/static/`)

## Run locally
```bash
npm install
npm run dev          # http://localhost:3000  (PGlite data in .data/)
# or with Neon:
DATABASE_URL=postgresql://... npm run dev
```

## Deploy (Vercel + Neon)
1. Create a Neon project → copy the pooled connection string
2. Import this repo in Vercel (framework: **Other**, no build command, output dir empty)
3. Vercel → Settings → Environment Variables → `DATABASE_URL` = Neon connection string
4. Deploy. Tables & seed questions are created automatically on first request.

## API
| Method | Path | Body / notes |
|---|---|---|
| GET | `/api/meta` | members, questions, categories |
| GET | `/api/progress/:voter` | `{answers: {qid: {A?, B?}}}` |
| POST | `/api/vote` | `{voter, question, targets: {A?: id\|null, B?: id\|null}}` |
| GET | `/api/results` | `{voters, completed, results: {qid: {A: {target: [voters]}, B: …}}}` |
| POST | `/api/questions` | `{actor, text, emoji, category}` |
| PUT | `/api/questions/:id` | `{actor, text?, emoji?, category?}` |
| DELETE | `/api/questions/:id?actor=` | soft delete |
| GET | `/api/questions/history` | last 100 changes |

## Data
- `questions(id, text, emoji, category, created_by, updated_by, deleted_by, deleted_at, …)`
- `votes(voter_id, question_id, target_id, target_group)` — unique per voter/question/group
- `question_history(question_id, action, actor, old_text, new_text, at)`
- Members are static in `src/data.ts`; photos in `public/static/members/`
