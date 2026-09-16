# Vercel + Neon deployment readiness

## Current status

The application is currently built around Drizzle `mysql2` and the Manus TiDB/MySQL schema. A Neon connection string is PostgreSQL, so replacing `DATABASE_URL` alone is **not safe**: the schema imports, enum definitions, upsert syntax, and auto-increment result handling must be migrated together.

The repository is therefore prepared for deployment documentation and secret injection, but the production database migration must be completed before pointing Vercel at Neon.

## Required migration sequence

1. Replace `drizzle-orm/mysql2` with `drizzle-orm/neon-http` or `drizzle-orm/node-postgres`.
2. Convert `drizzle-orm/mysql-core` tables to `drizzle-orm/pg-core`; replace `mysqlEnum` with `pgEnum`.
3. Replace `onDuplicateKeyUpdate` with `onConflictDoUpdate` and use `.returning()` for inserted IDs.
4. Generate a PostgreSQL migration and apply it to Neon with `pnpm drizzle-kit migrate`.
5. Add these Vercel environment variables: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `JWT_SECRET`, `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `OWNER_OPEN_ID`, `OWNER_NAME`, and `NEXT_PUBLIC_MINI_APP_URL` if the frontend URL is made configurable.
6. Configure the Telegram webhook only after the Vercel deployment URL and Neon migration are healthy.

## Important safety notes

- Never commit `.env`, Telegram bot tokens, GitHub tokens, or Neon passwords.
- The GitHub token supplied in chat should be revoked and regenerated after use because it has been exposed in conversation text.
- Vercel serverless functions do not support a long-running Telegram polling worker. Use Telegram webhook delivery; polling belongs on a persistent worker, not Vercel.
- Webhook handlers must finish quickly and write durable state to Neon; do not depend on process memory.

## Vercel checklist

- Build command: `pnpm build`
- Install command: `pnpm install --frozen-lockfile`
- Output: serverless Node handler plus built client assets
- Health check: `GET /` and `POST /api/telegram/webhook`
- After deployment: verify `getWebhookInfo`, Mini App `initData` auth, database writes, and Telegram message delivery.

This file intentionally does not contain credentials or a fabricated Neon URL.

## Reference design imported from `kim-koproq`

The Mini App now follows the reference project's interaction principles: neon lime/yellow/red palette, square icon-only action buttons, icon-only branding in the upper-right corner, long-press trash mode, explicit selection for edit/delete, and Telegram SDK based automatic login.
