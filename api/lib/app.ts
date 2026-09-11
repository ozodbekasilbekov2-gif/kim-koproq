import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { MEMBERS, CATEGORIES } from './data.js'
import { db } from './db.js'
import { page } from './page.js'

const app = new Hono()
app.use('/api/*', cors())
app.onError((error, c) => {
  console.error('[kim-koproq] request failed:', error)
  return c.json({ error: 'Server vaqtincha ishlamayapti. DATABASE_URL sozlamasini tekshiring.' }, 503)
})

const memberById = new Map(MEMBERS.map((m) => [m.id, m]))
const isMember = (id: unknown): id is string => typeof id === 'string' && memberById.has(id)

async function listQuestions() {
  const q = await db()
  return q(
    `SELECT id, text, emoji, category, created_by, updated_by, created_at, updated_at
     FROM questions WHERE deleted_at IS NULL ORDER BY id`
  )
}

// ---------- Meta ----------
app.get('/api/meta', async (c) => {
  const questions = await listQuestions()
  return c.json({ members: MEMBERS, questions, categories: CATEGORIES })
})

// ---------- Questions CRUD (anyone in the group can edit) ----------
app.post('/api/questions', async (c) => {
  const b = await c.req.json<{ actor: string; text: string; emoji?: string; category?: string }>()
  if (!isMember(b.actor)) return c.json({ error: 'actor?' }, 400)
  const text = (b.text || '').trim()
  if (text.length < 5 || text.length > 200) return c.json({ error: 'Savol 5–200 belgi bo\'lsin' }, 400)
  const emoji = (b.emoji || '❓').trim().slice(0, 8)
  const category = (CATEGORIES as readonly string[]).includes(b.category || '') ? b.category! : 'Xaos'
  const q = await db()
  const [row] = await q(
    'INSERT INTO questions (text, emoji, category, created_by) VALUES ($1,$2,$3,$4) RETURNING *',
    [text, emoji, category, b.actor]
  )
  await q('INSERT INTO question_history (question_id, action, actor, new_text) VALUES ($1,$2,$3,$4)', [row.id, 'add', b.actor, text])
  return c.json(row)
})

app.put('/api/questions/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const b = await c.req.json<{ actor: string; text?: string; emoji?: string; category?: string }>()
  if (!isMember(b.actor)) return c.json({ error: 'actor?' }, 400)
  const q = await db()
  const [old] = await q('SELECT * FROM questions WHERE id=$1 AND deleted_at IS NULL', [id])
  if (!old) return c.json({ error: 'not found' }, 404)
  const text = (b.text ?? old.text).trim()
  if (text.length < 5 || text.length > 200) return c.json({ error: 'Savol 5–200 belgi bo\'lsin' }, 400)
  const emoji = (b.emoji ?? old.emoji).trim().slice(0, 8) || '❓'
  const category = (CATEGORIES as readonly string[]).includes(b.category || '') ? b.category! : old.category
  const [row] = await q(
    'UPDATE questions SET text=$1, emoji=$2, category=$3, updated_by=$4, updated_at=now() WHERE id=$5 RETURNING *',
    [text, emoji, category, b.actor, id]
  )
  await q('INSERT INTO question_history (question_id, action, actor, old_text, new_text) VALUES ($1,$2,$3,$4,$5)', [id, 'edit', b.actor, old.text, text])
  return c.json(row)
})

app.delete('/api/questions/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const actor = c.req.query('actor')
  if (!isMember(actor)) return c.json({ error: 'actor?' }, 400)
  const q = await db()
  const [old] = await q('SELECT * FROM questions WHERE id=$1 AND deleted_at IS NULL', [id])
  if (!old) return c.json({ error: 'not found' }, 404)
  await q('UPDATE questions SET deleted_by=$1, deleted_at=now() WHERE id=$2', [actor, id])
  await q('INSERT INTO question_history (question_id, action, actor, old_text) VALUES ($1,$2,$3,$4)', [id, 'delete', actor, old.text])
  return c.json({ ok: true })
})

app.get('/api/questions/history', async (c) => {
  const q = await db()
  const rows = await q('SELECT * FROM question_history ORDER BY at DESC LIMIT 100')
  return c.json(rows)
})

// ---------- Votes ----------
app.get('/api/progress/:voter', async (c) => {
  const voter = c.req.param('voter')
  if (!isMember(voter)) return c.json({ error: 'unknown voter' }, 400)
  const q = await db()
  const rows = await q('SELECT question_id, target_id, target_group FROM votes WHERE voter_id=$1', [voter])
  const answers: Record<number, { A?: string; B?: string }> = {}
  for (const r of rows) {
    ;(answers[r.question_id] ||= {})[r.target_group as 'A' | 'B'] = r.target_id
  }
  return c.json({ answers })
})

// body: { voter, question, targets: { A?: id|null, B?: id|null } }
app.post('/api/vote', async (c) => {
  const b = await c.req.json<{ voter: string; question: number; targets: Record<string, string | null> }>()
  if (!isMember(b.voter)) return c.json({ error: 'voter?' }, 400)
  const qid = Number(b.question)
  const q = await db()
  const [exists] = await q('SELECT id FROM questions WHERE id=$1 AND deleted_at IS NULL', [qid])
  if (!exists) return c.json({ error: 'question not found' }, 404)
  for (const g of ['A', 'B'] as const) {
    const t = b.targets?.[g]
    if (t === undefined) continue
    if (t === null || t === '') {
      await q('DELETE FROM votes WHERE voter_id=$1 AND question_id=$2 AND target_group=$3', [b.voter, qid, g])
      continue
    }
    const m = memberById.get(t)
    if (!m || m.group !== g || t === b.voter) return c.json({ error: `invalid target for ${g}` }, 400)
    await q(
      `INSERT INTO votes (voter_id, question_id, target_id, target_group) VALUES ($1,$2,$3,$4)
       ON CONFLICT (voter_id, question_id, target_group) DO UPDATE SET target_id=EXCLUDED.target_id, created_at=now()`,
      [b.voter, qid, t, g]
    )
  }
  return c.json({ ok: true })
})

// Full results incl. voter lists (Telegram style)
app.get('/api/results', async (c) => {
  const q = await db()
  const rows = await q(
    `SELECT v.question_id, v.target_id, v.target_group, v.voter_id
     FROM votes v JOIN questions qu ON qu.id = v.question_id
     WHERE qu.deleted_at IS NULL ORDER BY v.created_at`
  )
  const [{ n: voters }] = await q('SELECT COUNT(DISTINCT voter_id)::int AS n FROM votes')
  const [{ n: qcount }] = await q('SELECT COUNT(*)::int AS n FROM questions WHERE deleted_at IS NULL')
  // results[qid][group] = { target: [voterIds] }
  const results: Record<number, Record<string, Record<string, string[]>>> = {}
  const ownGroupAnswered = new Map<string, Set<number>>()
  for (const r of rows) {
    const byG = (results[r.question_id] ||= {})
    const byT = (byG[r.target_group] ||= {})
    ;(byT[r.target_id] ||= []).push(r.voter_id)
    if (memberById.get(r.voter_id)?.group === r.target_group) {
      if (!ownGroupAnswered.has(r.voter_id)) ownGroupAnswered.set(r.voter_id, new Set())
      ownGroupAnswered.get(r.voter_id)!.add(r.question_id)
    }
  }
  let completed = 0
  for (const s of ownGroupAnswered.values()) if (s.size >= Number(qcount)) completed++
  return c.json({ voters: Number(voters), completed, totalMembers: MEMBERS.length, results })
})

// ---------- Page ----------
app.get('/', (c) => c.html(page()))

export default app
