/// <reference types="node" />
// Database layer: Neon Postgres in production (DATABASE_URL),
// embedded PGlite locally when DATABASE_URL is not set.
import { SEED_QUESTIONS } from './data.js'

export type Row = Record<string, any>
type Query = (text: string, params?: any[]) => Promise<Row[]>

let queryImpl: Query | null = null
let ready: Promise<void> | null = null

async function createQuery(): Promise<Query> {
  const url = process.env.DATABASE_URL
  if (url) {
    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(url)
    return async (text, params = []) => (await sql.query(text, params)) as Row[]
  }
  if (process.env.VERCEL) {
    throw new Error('DATABASE_URL is not set. Add it in Vercel: Project Settings -> Environment Variables, then redeploy.')
  }
  // Local fallback — PGlite (persisted under .data/)
  const modName = '@electric-sql/pglite'
  const { PGlite } = await import(/* @vite-ignore */ modName)
  const fs = await import('node:fs'); fs.mkdirSync('./.data/pg', { recursive: true })
  const pg = new PGlite('./.data/pg')
  return async (text, params = []) => (await pg.query(text, params)).rows as Row[]
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '❓',
  category TEXT NOT NULL DEFAULT 'Xaos',
  created_by TEXT,
  updated_by TEXT,
  deleted_by TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS votes (
  id SERIAL PRIMARY KEY,
  voter_id TEXT NOT NULL,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL,
  target_group TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (voter_id, question_id, target_group)
);
CREATE INDEX IF NOT EXISTS idx_votes_q ON votes(question_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter ON votes(voter_id);
CREATE TABLE IF NOT EXISTS question_history (
  id SERIAL PRIMARY KEY,
  question_id INTEGER,
  action TEXT NOT NULL,
  actor TEXT,
  old_text TEXT,
  new_text TEXT,
  at TIMESTAMPTZ DEFAULT now()
);
`

async function init() {
  const q = await createQuery()
  // Fast path: when the schema already exists, skip DDL + seeding so every
  // serverless cold start costs a single round-trip instead of ~40.
  const [{ tbl_ok }] = await q(`SELECT to_regclass('public.questions') IS NOT NULL AS tbl_ok`)
  if (!tbl_ok) {
    for (const stmt of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) {
      await q(stmt)
    }
    const values: any[] = []
    const rows = SEED_QUESTIONS.map((s) => {
      const base = values.length + 1
      values.push(s.text, s.emoji, s.category, 'system')
      return `($${base},$${base + 1},$${base + 2},$${base + 3})`
    })
    await q(`INSERT INTO questions (text, emoji, category, created_by) VALUES ${rows.join(',')}`, values)
  }
  queryImpl = q
}

export async function db(): Promise<Query> {
  if (!ready) ready = init()
  await ready
  return queryImpl!
}
