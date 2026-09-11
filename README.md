# Kim ko'proq...? — Guruh so'rovi

## Project Overview
- **Name**: Kim ko'proq...? (Who is most likely to...?)
- **Goal**: Fun "friend group survey" web app for a class of 24 members. Each member picks themselves, answers 54 Uzbek questions by choosing a classmate, and everyone can view the aggregated results with winner photos.
- **Features**:
  - Pick yourself (photo + name grid) to start
  - 54 Uzbek questions in 5 categories: Kelajak, Kulgili, Xaotik, Muhabbat, Bahsli
  - One classmate per question (you can't vote for yourself), progress bar, back/next
  - Progress saved to D1 + localStorage — resume later on the same device
  - Results page: winner photo + crown, vote %, runner-up avatars, category filters, "Odamlar bo'yicha" view (who won which questions)
  - Live counters: how many people voted / finished

## URLs
- **Sandbox preview**: https://3000-ivvddfzl8kbpus1xeh9e9-ad490db5.sandbox.novita.ai
- **Production**: not deployed yet

## API
| Method | Path | Description |
|---|---|---|
| GET | `/api/meta` | members + questions |
| GET | `/api/progress/:voter` | answers already given by a voter |
| POST | `/api/vote` | `{voter, question, target}` upsert one vote |
| POST | `/api/votes` | `{voter, answers:{qid: target}}` bulk upsert |
| GET | `/api/results` | aggregated votes per question + voter counters |
| GET | `/api/results/:member` | which questions a member got votes on |

## Data Architecture
- **Storage**: Cloudflare D1 (SQLite) — table `votes(voter_id, question_id, target_id)` with `UNIQUE(voter_id, question_id)`
- **Static data**: members & questions in `src/data.ts`; member photos in `public/static/members/*.jpg` (cropped from the group photo)
- **Identity**: no auth — user picks who they are; choice stored in localStorage (`kk_me`). "Change person" button in header.

## User Guide
1. Open the site → choose your own photo → **Boshlash**
2. For each question, tap a classmate → **Keyingi**
3. After the last question → **Natijalarni ko'rish**. Anyone can open **Natijalar** from the header at any time.

## Local Development
```bash
npm run build
npx wrangler d1 migrations apply webapp-production --local
pm2 start ecosystem.config.cjs
# reset votes
npx wrangler d1 execute webapp-production --local --command="DELETE FROM votes"
```

## Deployment
- **Platform**: Cloudflare Pages + D1
- **Status**: ⏳ sandbox only (needs `wrangler d1 create webapp-production` and `database_id` in `wrangler.jsonc` before production deploy)
- **Tech Stack**: Hono + TypeScript + Vanilla JS + TailwindCSS (CDN)
- **Last Updated**: 2026-09-11
