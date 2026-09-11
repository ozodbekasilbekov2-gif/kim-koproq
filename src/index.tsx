import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { MEMBERS, QUESTIONS } from './data'

type Bindings = { DB: D1Database }

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())
app.use('/static/*', serveStatic({ root: './public' }))

const memberIds = new Set(MEMBERS.map((m) => m.id))
const questionIds = new Set(QUESTIONS.map((q) => q.id))

// ---------- API ----------
app.get('/api/meta', (c) => c.json({ members: MEMBERS, questions: QUESTIONS }))

// Which questions has this voter already answered?
app.get('/api/progress/:voter', async (c) => {
  const voter = c.req.param('voter')
  if (!memberIds.has(voter)) return c.json({ error: 'unknown voter' }, 400)
  const { results } = await c.env.DB.prepare(
    'SELECT question_id, target_id FROM votes WHERE voter_id = ?'
  ).bind(voter).all<{ question_id: number; target_id: string }>()
  const answers: Record<number, string> = {}
  for (const r of results) answers[r.question_id] = r.target_id
  return c.json({ answers, total: QUESTIONS.length })
})

// Save one vote (upsert)
app.post('/api/vote', async (c) => {
  const body = await c.req.json<{ voter: string; question: number; target: string }>()
  const { voter, question, target } = body
  if (!memberIds.has(voter) || !memberIds.has(target) || !questionIds.has(Number(question))) {
    return c.json({ error: 'invalid payload' }, 400)
  }
  await c.env.DB.prepare(
    `INSERT INTO votes (voter_id, question_id, target_id) VALUES (?, ?, ?)
     ON CONFLICT(voter_id, question_id) DO UPDATE SET target_id = excluded.target_id, created_at = CURRENT_TIMESTAMP`
  ).bind(voter, Number(question), target).run()
  return c.json({ ok: true })
})

// Bulk save (all answers at once)
app.post('/api/votes', async (c) => {
  const body = await c.req.json<{ voter: string; answers: Record<string, string> }>()
  const { voter, answers } = body
  if (!memberIds.has(voter) || typeof answers !== 'object') return c.json({ error: 'invalid payload' }, 400)
  const stmts: D1PreparedStatement[] = []
  for (const [q, t] of Object.entries(answers)) {
    if (!questionIds.has(Number(q)) || !memberIds.has(t)) continue
    stmts.push(
      c.env.DB.prepare(
        `INSERT INTO votes (voter_id, question_id, target_id) VALUES (?, ?, ?)
         ON CONFLICT(voter_id, question_id) DO UPDATE SET target_id = excluded.target_id, created_at = CURRENT_TIMESTAMP`
      ).bind(voter, Number(q), t)
    )
  }
  if (stmts.length) await c.env.DB.batch(stmts)
  return c.json({ ok: true, saved: stmts.length })
})

// Aggregated results
app.get('/api/results', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT question_id, target_id, COUNT(*) as n FROM votes GROUP BY question_id, target_id ORDER BY question_id, n DESC'
  ).all<{ question_id: number; target_id: string; n: number }>()

  const voters = await c.env.DB.prepare('SELECT COUNT(DISTINCT voter_id) as n FROM votes').first<{ n: number }>()
  const completed = await c.env.DB.prepare(
    'SELECT COUNT(*) as n FROM (SELECT voter_id FROM votes GROUP BY voter_id HAVING COUNT(*) >= ?)'
  ).bind(QUESTIONS.length).first<{ n: number }>()

  const byQuestion: Record<number, { target: string; n: number }[]> = {}
  for (const r of results) {
    ;(byQuestion[r.question_id] ||= []).push({ target: r.target_id, n: r.n })
  }
  return c.json({
    voters: voters?.n ?? 0,
    completed: completed?.n ?? 0,
    totalMembers: MEMBERS.length,
    results: byQuestion,
  })
})

// Who voted for whom (only for a specific person) - "kim meni tanladi"
app.get('/api/results/:member', async (c) => {
  const member = c.req.param('member')
  if (!memberIds.has(member)) return c.json({ error: 'unknown member' }, 400)
  const { results } = await c.env.DB.prepare(
    'SELECT question_id, COUNT(*) as n FROM votes WHERE target_id = ? GROUP BY question_id ORDER BY n DESC'
  ).bind(member).all<{ question_id: number; n: number }>()
  return c.json({ member, questions: results })
})

// ---------- Page ----------
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>Kim ko'proq... ? — Guruh so'rovi</title>
<meta name="description" content="Guruhimizdagi 24 a'zo uchun 54 ta qiziqarli savol. Kim birinchi turmush quradi? Kim millioner bo'ladi?">
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
<link href="/static/style.css" rel="stylesheet">
<link rel="icon" href="/static/favicon.ico">
</head>
<body class="min-h-screen text-white">
  <div class="bg-glow"></div>
  <header id="site-header" class="sticky top-0 z-30 backdrop-blur-md bg-black/40 border-b border-white/10">
    <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
      <a href="#" id="brand" class="brand text-2xl tracking-wide"><i class="fas fa-bolt text-yellow-400 mr-2"></i>KIM KO'PROQ...?</a>
      <nav class="flex items-center gap-2 text-sm">
        <button id="nav-results" class="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition"><i class="fas fa-chart-simple mr-1"></i>Natijalar</button>
        <button id="nav-reset" class="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition hidden" title="Boshqa odam sifatida kirish"><i class="fas fa-user-pen"></i></button>
      </nav>
    </div>
  </header>

  <main id="app" class="max-w-5xl mx-auto px-4 py-6"></main>

  <footer class="text-center text-xs text-white/40 py-6">24 a'zo · 54 savol · Guruh so'rovi 2026</footer>

  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js"></script>
  <script src="/static/app.js"></script>
</body>
</html>`)
})

export default app
