/// <reference types="node" />
// Telegram bot for "Kim ko'proq?" — two-button menu:
//   ✏️ Savollarni tahrirlash (create / edit / delete questions)
//   👥 Guruhni tanlash (send native Telegram polls for the picked group)
// Native polls (sendPoll, is_anonymous=false) are sent per group: every
// question becomes 1-2 polls (Telegram caps a poll at 10 options; group A has
// 14 members, group B has 13, so members are chunked into halves).
// poll_answer updates are written back into the site's votes table
// (self-votes skipped, re-vote upserts) so Telegram and the site stay in sync.
// Webhook deliveries are deduped via tg_updates (Telegram retries on timeout).
import { MEMBERS, CATEGORIES } from './data.js'
import { db } from './db.js'
import { createHash } from 'node:crypto'

// ---------- Types ----------
type TgUser = { id: number; first_name?: string; username?: string }
type TgChat = { id: number; type?: string }
type TgMessage = { message_id: number; chat: TgChat; text?: string; from?: TgUser }
type TgCallback = { id: string; from: TgUser; data?: string; message?: TgMessage }
type TgPollAnswer = { poll_id: string; user: TgUser; option_ids: number[] }
export type TgUpdate = {
  update_id: number
  message?: TgMessage
  callback_query?: TgCallback
  poll_answer?: TgPollAnswer
}

type Member = (typeof MEMBERS)[number]

const memberById = new Map<string, Member>(MEMBERS.map((m) => [m.id, m]))
const membersOf = (g: 'A' | 'B'): Member[] => MEMBERS.filter((m) => m.group === g)
const CATEGORY_EMOJI: Record<string, string> = { Roast: '🔥', 'Rostini ayt': '😳', Kelajak: '🔮', Xaos: '💀' }

export const webhookSecret = (token: string): string =>
  createHash('sha256').update(token + '|kim-koproq').digest('hex').slice(0, 48)

// ---------- Telegram API ----------
const TG_BASE = process.env.TG_API_BASE || 'https://api.telegram.org'
const token = () => process.env.TELEGRAM_BOT_TOKEN || ''

type InlineButton = { text: string; callback_data?: string; url?: string }
type InlineKeyboard = { inline_keyboard: InlineButton[][] }

async function tg<T = any>(method: string, payload: unknown): Promise<T> {
  const t = token()
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN is not set')
  const res = await fetch(`${TG_BASE}/bot${t}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (res.status === 429) {
    const retry = Number(res.headers.get('retry-after') || '1')
    await new Promise((r) => setTimeout(r, Math.min(retry, 30) * 1000))
    return tg<T>(method, payload)
  }
  const j = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string }
  if (!j.ok) console.error(`[tg] ${method} failed:`, j.description)
  return (j.result ?? ({} as T))
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function sendMsg(chatId: number, text: string, keyboard?: InlineKeyboard): Promise<number | undefined> {
  const r = await tg<{ message_id?: number }>('sendMessage', {
    chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true,
    reply_markup: keyboard ? { inline_keyboard: keyboard.inline_keyboard } : undefined,
  })
  return r.message_id
}

const answerCb = (cbId: string, text?: string, showAlert = false): Promise<unknown> =>
  tg('answerCallbackQuery', { callback_query_id: cbId, text, show_alert: showAlert })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const trimTo = (s: string, n: number): string => (s.length <= n ? s : s.slice(0, n - 1) + '…')

// ---------- DB helpers ----------
async function getBinding(chatId: number): Promise<string | undefined> {
  const q = await db()
  const [row] = await q('SELECT member_id FROM tg_users WHERE chat_id=$1', [chatId])
  return row ? String(row.member_id) : undefined
}

async function setBinding(chatId: number, memberId: string, tgName?: string): Promise<void> {
  const q = await db()
  await q(
    `INSERT INTO tg_users (chat_id, member_id, tg_name) VALUES ($1,$2,$3)
     ON CONFLICT (chat_id) DO UPDATE SET member_id=EXCLUDED.member_id, tg_name=EXCLUDED.tg_name`,
    [chatId, memberId, tgName ?? null]
  )
}

async function listQuestions(): Promise<Array<{ id: number; text: string; emoji: string; category: string }>> {
  const q = await db()
  const rows = await q(
    `SELECT id, text, emoji, category FROM questions WHERE deleted_at IS NULL ORDER BY id`
  )
  return rows.map((r) => ({ id: Number(r.id), text: String(r.text), emoji: String(r.emoji), category: String(r.category) }))
}

async function questionText(qid: number): Promise<{ text: string; emoji: string; category: string } | undefined> {
  const q = await db()
  const [row] = await q('SELECT text, emoji, category FROM questions WHERE id=$1 AND deleted_at IS NULL', [qid])
  return row ? { text: String(row.text), emoji: String(row.emoji), category: String(row.category) } : undefined
}

// ---------- Bot conversation state (serverless-safe: stored in DB) ----------
type Session = { state: string; payload: any }

async function getSession(chatId: number): Promise<Session | undefined> {
  const q = await db()
  const [row] = await q('SELECT state, payload FROM tg_sessions WHERE chat_id=$1', [chatId])
  if (!row) return undefined
  let payload = row.payload
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload) } catch { payload = {} }
  }
  return { state: String(row.state), payload: payload ?? {} }
}

async function setSession(chatId: number, state: string, payload: unknown = {}): Promise<void> {
  const q = await db()
  await q(
    `INSERT INTO tg_sessions (chat_id, state, payload, updated_at) VALUES ($1,$2,$3,now())
     ON CONFLICT (chat_id) DO UPDATE SET state=EXCLUDED.state, payload=EXCLUDED.payload, updated_at=now()`,
    [chatId, state, JSON.stringify(payload ?? {})]
  )
}

async function clearSession(chatId: number): Promise<void> {
  const q = await db()
  await q('DELETE FROM tg_sessions WHERE chat_id=$1', [chatId])
}

// Webhook dedupe: returns false when this update was already processed.
async function markUpdate(updateId: number): Promise<boolean> {
  const q = await db()
  const res = await q(
    'INSERT INTO tg_updates (update_id) VALUES ($1) ON CONFLICT (update_id) DO NOTHING RETURNING update_id',
    [updateId]
  )
  return res.length > 0
}

// ---------- Question CRUD (same rules as the website API) ----------
const validQuestionText = (t: string): boolean => t.length >= 5 && t.length <= 200

async function insertQuestion(text: string, emoji: string, category: string, actor: string): Promise<number> {
  const q = await db()
  const [row] = await q(
    'INSERT INTO questions (text, emoji, category, created_by) VALUES ($1,$2,$3,$4) RETURNING id',
    [text, emoji, category, actor]
  )
  await q('INSERT INTO question_history (question_id, action, actor, new_text) VALUES ($1,$2,$3,$4)', [row.id, 'add', actor, text])
  return Number(row.id)
}

async function updateQuestion(qid: number, text: string, actor: string): Promise<boolean> {
  const q = await db()
  const [old] = await q('SELECT text FROM questions WHERE id=$1 AND deleted_at IS NULL', [qid])
  if (!old) return false
  await q('UPDATE questions SET text=$1, updated_by=$2, updated_at=now() WHERE id=$3', [text, actor, qid])
  await q('INSERT INTO question_history (question_id, action, actor, old_text, new_text) VALUES ($1,$2,$3,$4,$5)', [qid, 'edit', actor, String(old.text), text])
  return true
}

async function deleteQuestion(qid: number, actor: string): Promise<boolean> {
  const q = await db()
  const [old] = await q('SELECT text FROM questions WHERE id=$1 AND deleted_at IS NULL', [qid])
  if (!old) return false
  await q('UPDATE questions SET deleted_by=$1, deleted_at=now() WHERE id=$2', [actor, qid])
  await q('INSERT INTO question_history (question_id, action, actor, old_text) VALUES ($1,$2,$3,$4)', [qid, 'delete', actor, String(old.text)])
  return true
}

// ---------- Native polls: registry + vote sync ----------
async function registerPoll(pollId: string, qid: number, group: string, optionMembers: string[], chatId: number): Promise<void> {
  const q = await db()
  await q(
    `INSERT INTO tg_polls (poll_id, question_id, target_group, option_members, chat_id) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (poll_id) DO NOTHING`,
    [pollId, qid, group, JSON.stringify(optionMembers), chatId]
  )
}

async function getPollRegistration(pollId: string): Promise<{ question_id: number; target_group: string; option_members: string[] } | undefined> {
  const q = await db()
  const [row] = await q('SELECT question_id, target_group, option_members FROM tg_polls WHERE poll_id=$1', [pollId])
  if (!row) return undefined
  let members = row.option_members
  if (typeof members === 'string') {
    try { members = JSON.parse(members) } catch { members = [] }
  }
  return { question_id: Number(row.question_id), target_group: String(row.target_group), option_members: Array.isArray(members) ? members.map(String) : [] }
}

// Same upsert semantics as the website's POST /api/vote; never throws —
// a failed sync must not break the webhook. Self-votes are skipped (site rule).
async function recordVote(voter: string, qid: number, group: string, targetId: string): Promise<void> {
  try {
    const m = memberById.get(targetId)
    if (!m || m.group !== group || targetId === voter) return
    const q = await db()
    const [exists] = await q('SELECT id FROM questions WHERE id=$1 AND deleted_at IS NULL', [qid])
    if (!exists) return
    await q(
      `INSERT INTO votes (voter_id, question_id, target_id, target_group) VALUES ($1,$2,$3,$4)
       ON CONFLICT (voter_id, question_id, target_group) DO UPDATE SET target_id=EXCLUDED.target_id, created_at=now()`,
      [voter, qid, targetId, group]
    )
  } catch (e) {
    console.error('[tg-bot] vote sync failed:', e)
  }
}

async function onPollAnswer(pa: TgPollAnswer): Promise<void> {
  const reg = await getPollRegistration(pa.poll_id)
  if (!reg) return
  const voter = await getBinding(pa.user.id)
  if (!voter) return // unbound users' votes live in Telegram only
  for (const oid of pa.option_ids) {
    const target = reg.option_members[oid]
    if (!target) continue
    await recordVote(voter, reg.question_id, reg.target_group, target)
  }
}

// ---------- UI builders ----------
const kb = (...rows: InlineButton[][]): InlineKeyboard => ({ inline_keyboard: rows })
const btn = (text: string, data: string): InlineButton => ({ text, callback_data: data })

function menuText(name?: string): string {
  return (
    `👋 Salom${name ? ', <b>' + esc(name) + '</b>' : ''}!\n\n` +
    `Bu — <b>Kim ko'proq?</b> boti.\n\n` +
    `✏️ <b>Savollarni tahrirlash</b> — savol qo'shish, o'zgartirish yoki o'chirish\n` +
    `👥 <b>Guruhni tanlash</b> — tanlangan guruh a'zolari bilan native Telegram so'rovnomalar (poll) yuboriladi\n\n` +
    `💡 Polllarda ovoz berganingiz sayt natijalariga ham avtomatik yoziladi.`
  )
}

const menuKb = kb([btn('✏️ Savollarni tahrirlash', 'editm')], [btn('👥 Guruhni tanlash', 'grp')])

const cancelKb = kb([btn('❌ Bekor qilish', 'cancel')])

const categoryKb = (): InlineKeyboard => {
  const cats = CATEGORIES.map((c) => btn(`${CATEGORY_EMOJI[c] ?? '❓'} ${c}`, `cat:${c}`))
  return kb(cats.slice(0, 2), cats.slice(2), [btn('❌ Bekor qilish', 'cancel')])
}

function whoKb(back: string): InlineKeyboard {
  const suffix = back ? '|' + back : ''
  const rows: InlineButton[][] = []
  for (let i = 0; i < MEMBERS.length; i += 2) {
    rows.push(MEMBERS.slice(i, i + 2).map((m) => btn(`(${m.group}) ${m.short}`, `who:${i}${suffix}`)))
  }
  rows.push([btn('🏠 Menyu', 'menu')])
  return { inline_keyboard: rows }
}

function groupChooserKb(): InlineKeyboard {
  return kb(
    [
      btn(`🅰 A guruh · ${membersOf('A').length} a'zo`, 'pollA'),
      btn(`🅱 B guruh · ${membersOf('B').length} a'zo`, 'pollB'),
    ],
    [btn('👤 Men kimman', 'me'), btn('🔙 Menyu', 'menu')]
  )
}

// ---------- Question list (edit / delete pickers, paginated) ----------
const PAGE_SIZE = 6

async function sendQuestionList(chatId: number, mode: 'e' | 'd', page: number): Promise<void> {
  const questions = await listQuestions()
  if (!questions.length) {
    await sendMsg(chatId, "Hozircha savollar yo'q. «➕ Yangi savol» orqali qo'shing.", menuKb)
    return
  }
  const pages = Math.max(1, Math.ceil(questions.length / PAGE_SIZE))
  const p = Math.min(Math.max(0, page), pages - 1)
  const slice = questions.slice(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE)
  const title = mode === 'e' ? "📝 Qaysi savolni o'zgartiramiz?" : "🗑 Qaysi savolni o'chiramiz?"
  const rows: InlineButton[][] = slice.map((q) => [
    btn(`${q.emoji} ${trimTo(q.text, 32)}`, `${mode === 'e' ? 'qe' : 'qd'}:${q.id}:${p}`),
  ])
  const nav: InlineButton[] = []
  if (p > 0) nav.push(btn('◀️', `lst:${mode}:${p - 1}`))
  nav.push(btn(`${p + 1} / ${pages}`, 'noop'))
  if (p < pages - 1) nav.push(btn('▶️', `lst:${mode}:${p + 1}`))
  rows.push(nav, [btn('🔙 Menyu', 'menu')])
  await sendMsg(chatId, `${title}\nJami ${questions.length} ta savol`, kb(...rows))
}

// ---------- Native poll fan-out ----------
type FanoutCursor = { group: 'A' | 'B'; qi: number; pi: number; sent: number }

// Telegram limits a poll to 10 options; groups have 14/13 members -> split
// each group into halves of <=10 and send one poll per half per question.
function chunkMembers(members: Member[]): Member[][] {
  if (members.length <= 10) return [members]
  const half = Math.ceil(members.length / 2)
  return [members.slice(0, half), members.slice(half)]
}

const isGroupChat = (chat: TgChat): boolean => chat.type === 'group' || chat.type === 'supergroup'
const paceMs = (): number => Number(process.env.TG_PACE_MS ?? 350)
const BUDGET_MS = 48_000 // stay safely under the 60s serverless limit

async function runFanout(chatId: number, chat: TgChat, cursor: FanoutCursor): Promise<void> {
  const questions = await listQuestions()
  if (!questions.length) {
    await clearSession(chatId)
    await sendMsg(chatId, "Hozircha savollar yo'q.", menuKb)
    return
  }
  const parts = chunkMembers(membersOf(cursor.group))
  const pace = isGroupChat(chat) ? Math.max(paceMs(), 1100) : paceMs()
  const started = Date.now()
  let qi = cursor.qi
  let pi = cursor.pi
  let sent = cursor.sent
  if (qi === 0 && pi === 0) {
    await sendMsg(chatId, `⏳ ${cursor.group}-guruh uchun ${questions.length} ta savol · native so'rovnomalar yuborilmoqda...`)
  }
  for (; qi < questions.length; qi++) {
    for (; pi < parts.length; pi++) {
      if (Date.now() - started > BUDGET_MS) {
        await setSession(chatId, 'fanout', { group: cursor.group, qi, pi, sent })
        const remaining = (questions.length - qi) * parts.length - pi
        await sendMsg(
          chatId,
          `⏸ Xavfsizlik uchun to'xtatildi — ${sent} ta yuborildi, ~${remaining} ta qoldi.\nDavom etish uchun tugmani bosing:`,
          kb([btn("▶️ Davom etish", 'resume')], [btn('❌ Bekor qilish', 'cancel')])
        )
        return
      }
      const q = questions[qi]
      const label = parts.length > 1 ? ` (${pi + 1}/${parts.length})` : ''
      const res = await tg<any>('sendPoll', {
        chat_id: chatId,
        question: trimTo(`${q.emoji} ${q.text}${label}`, 300),
        options: parts[pi].map((m) => m.short),
        is_anonymous: false,
      })
      const pollId: string | undefined = res?.poll?.id
      if (pollId) await registerPoll(pollId, q.id, cursor.group, parts[pi].map((m) => m.id), chatId)
      sent++
      await sleep(pace)
    }
    pi = 0
  }
  await clearSession(chatId)
  await sendMsg(
    chatId,
    `✅ Tayyor! ${cursor.group}-guruh uchun ${sent} ta native so'rovnoma yuborildi.\n\n` +
      `Polllarda ovoz berganingiz sayt natijalariga ham yoziladi (o'zingizga bergan ovoz hisobga olinmaydi).`,
    kb([btn('👥 Boshqa guruh', 'grp')], [btn('🏠 Menyu', 'menu')])
  )
}

// ---------- Text input handlers ----------
async function onNewQuestionText(chatId: number, raw: string): Promise<void> {
  const text = (raw || '').trim()
  if (!validQuestionText(text)) {
    await sendMsg(chatId, "⚠️ Savol 5–200 belgi bo'lsin. Qayta yozib yuboring (yoki «❌ Bekor qilish» bosing):", cancelKb)
    return
  }
  await setSession(chatId, 'new_cat', { text })
  await sendMsg(chatId, "🏷 Kategoriyani tanlang:", categoryKb())
}

async function onEditQuestionText(chatId: number, raw: string, payload: any): Promise<void> {
  const qid = Number(payload?.qid)
  const text = (raw || '').trim()
  if (!validQuestionText(text)) {
    await sendMsg(chatId, "⚠️ Savol 5–200 belgi bo'lsin. Qayta yozib yuboring (yoki «❌ Bekor qilish» bosing):", cancelKb)
    return
  }
  const bound = await getBinding(chatId)
  const actor = bound ?? 'tg:anon'
  const okUpd = await updateQuestion(qid, text, actor)
  await clearSession(chatId)
  if (!okUpd) {
    await sendMsg(chatId, "⚠️ Savol topilmadi (o'chirilgan bo'lishi mumkin).", menuKb)
    return
  }
  await sendMsg(chatId, `✅ Savol yangilandi:\n«${esc(text)}»`, menuKb)
}

// ---------- Callback router ----------
async function onCallback(cb: TgCallback): Promise<void> {
  const data = cb.data || ''
  const chatId = cb.message?.chat?.id
  if (!chatId) { await answerCb(cb.id); return }
  const from = cb.from
  const name = from.first_name || from.username
  const [cmd, ...rest] = data.split(':')

  if (cmd === 'menu') {
    await answerCb(cb.id)
    await clearSession(chatId)
    return onMenu(chatId, name)
  }

  if (cmd === 'noop') { await answerCb(cb.id); return }

  if (cmd === 'cancel') {
    await answerCb(cb.id, 'Bekor qilindi')
    await clearSession(chatId)
    return void (await sendMsg(chatId, '❌ Bekor qilindi.', menuKb))
  }

  // ----- edit menu -----
  if (cmd === 'editm') {
    await answerCb(cb.id)
    await clearSession(chatId)
    return void (await sendMsg(
      chatId,
      '✏️ <b>Savollarni boshqarish</b>',
      kb(
        [btn("➕ Yangi savol qo'shish", 'newq')],
        [btn("📝 Savolni o'zgartirish", 'editq0')],
        [btn("🗑 Savolni o'chirish", 'delq0')],
        [btn('🔙 Menyu', 'menu')]
      )
    ))
  }

  // ----- create flow -----
  if (cmd === 'newq') {
    await answerCb(cb.id)
    await clearSession(chatId)
    await setSession(chatId, 'new_text', {})
    return void (await sendMsg(chatId, "➕ Yangi savol matnini yozib yuboring (5–200 belgi):", cancelKb))
  }

  if (cmd === 'cat') {
    const category = rest.join(':')
    const sess = await getSession(chatId)
    const text = sess?.state === 'new_cat' ? String(sess.payload?.text ?? '') : ''
    if (!text) {
      await answerCb(cb.id, "Avval savol matnini yuboring", true)
      return
    }
    const validCat = (CATEGORIES as readonly string[]).includes(category) ? category : 'Xaos'
    const bound = await getBinding(chatId)
    const actor = bound ?? `tg:${from.first_name || from.username || chatId}`
    const id = await insertQuestion(text, CATEGORY_EMOJI[validCat] ?? '❓', validCat, actor)
    await clearSession(chatId)
    await answerCb(cb.id, '✅ Saqlandi')
    return void (await sendMsg(
      chatId,
      `✅ Savol qo'shildi (№${id}):\n${CATEGORY_EMOJI[validCat] ?? '❓'} ${esc(text)}\n#${validCat}`,
      kb([btn('👥 Guruhni tanlash', 'grp')], [btn("✏️ Yana qo'shish", 'newq')], [btn('🔙 Menyu', 'menu')])
    ))
  }

  // ----- edit flow -----
  if (cmd === 'editq0') {
    await answerCb(cb.id)
    await clearSession(chatId)
    return void (await sendQuestionList(chatId, 'e', 0))
  }

  if (cmd === 'qe') {
    const qid = Number(rest[0])
    const qt = await questionText(qid)
    if (!qt) { await answerCb(cb.id, 'Savol topilmadi', true); return }
    await clearSession(chatId)
    await setSession(chatId, 'edit_text', { qid })
    await answerCb(cb.id)
    return void (await sendMsg(
      chatId,
      `📝 Hozirgi matn:\n«${esc(qt.text)}»\n\nYangi matnni yozib yuboring (5–200 belgi):`,
      cancelKb
    ))
  }

  // ----- delete flow -----
  if (cmd === 'delq0') {
    await answerCb(cb.id)
    await clearSession(chatId)
    return void (await sendQuestionList(chatId, 'd', 0))
  }

  if (cmd === 'qd') {
    const qid = Number(rest[0])
    const qt = await questionText(qid)
    if (!qt) { await answerCb(cb.id, 'Savol topilmadi', true); return }
    await answerCb(cb.id)
    await clearSession(chatId)
    return void (await sendMsg(
      chatId,
      `🗑 O'chirilsinmi?\n\n${esc(qt.emoji)} ${esc(qt.text)}`,
      kb([btn("🗑 Ha, o'chirish", `qdel:${qid}`)], [btn('❌ Bekor qilish', 'cancel')])
    ))
  }

  if (cmd === 'qdel') {
    const qid = Number(rest[0])
    await answerCb(cb.id)
    await clearSession(chatId)
    const bound = await getBinding(chatId)
    const actor = bound ?? `tg:${from.first_name || from.username || chatId}`
    const okDel = await deleteQuestion(qid, actor)
    return void (await sendMsg(chatId, okDel ? "✅ Savol o'chirildi." : "⚠️ Savol topilmadi.", menuKb))
  }

  // ----- pagination -----
  if (cmd === 'lst') {
    await answerCb(cb.id)
    await clearSession(chatId)
    const mode = rest[0] === 'd' ? 'd' : 'e'
    const page = Number(rest[1] || 0)
    return void (await sendQuestionList(chatId, mode, Number.isFinite(page) ? page : 0))
  }

  // ----- group picker + binding -----
  if (cmd === 'grp') {
    await answerCb(cb.id)
    await clearSession(chatId)
    const bound = await getBinding(chatId)
    if (!bound) {
      return void (await sendMsg(chatId, "👤 Ovozlar saytga to'g'ri yozilishi uchun avval o'zingizni tanlang:", whoKb('grp')))
    }
    return void (await sendMsg(chatId, "👥 Qaysi guruh uchun native so'rovnomalar yuborilsin?", groupChooserKb()))
  }

  if (cmd === 'pollA' || cmd === 'pollB') {
    await answerCb(cb.id, 'Yuborilmoqda... ⏳')
    const group: 'A' | 'B' = cmd === 'pollA' ? 'A' : 'B'
    const cursor: FanoutCursor = { group, qi: 0, pi: 0, sent: 0 }
    await clearSession(chatId)
    await setSession(chatId, 'fanout', cursor)
    return runFanout(chatId, cb.message!.chat, cursor)
  }

  if (cmd === 'resume') {
    await answerCb(cb.id, 'Davom etilmoqda... ⏳')
    const sess = await getSession(chatId)
    if (sess?.state !== 'fanout' || !sess.payload?.group) {
      await sendMsg(chatId, "Avval «👥 Guruhni tanlash» orqali guruh tanlang.", menuKb)
      return
    }
    const cursor: FanoutCursor = {
      group: sess.payload.group === 'B' ? 'B' : 'A',
      qi: Number(sess.payload.qi) || 0,
      pi: Number(sess.payload.pi) || 0,
      sent: Number(sess.payload.sent) || 0,
    }
    return runFanout(chatId, cb.message!.chat, cursor)
  }

  if (cmd === 'me') {
    const bound = await getBinding(chatId)
    const m = bound ? memberById.get(bound) : undefined
    await answerCb(cb.id)
    if (m) {
      return void (await sendMsg(
        chatId,
        `👤 Siz: <b>${esc(m.name)}</b> (${m.group}-guruh)\nO'zgartirish uchun «🔁 Tanlash»ni bosing.`,
        kb([btn('🔁 Tanlash', 'who0')], [btn('🔙 Menyu', 'menu')])
      ))
    }
    return void (await sendMsg(chatId, "👤 O'zingizni tanlang:", whoKb('')))
  }

  if (cmd === 'who0') {
    await answerCb(cb.id)
    return void (await sendMsg(chatId, "👤 O'zingizni tanlang:", whoKb('')))
  }

  if (cmd === 'who') {
    const raw = rest.join(':')
    const [idxStr, back] = raw.split('|')
    const m = MEMBERS[Number(idxStr)]
    if (!m) { await answerCb(cb.id, "A'zo topilmadi", true); return }
    await setBinding(chatId, m.id, name)
    await answerCb(cb.id, `✅ Siz: ${m.name} (${m.group}-guruh)`)
    if (back) return onCallback({ ...cb, data: back })
    return void (await sendMsg(
      chatId,
      `👤 Siz endi <b>${esc(m.name)}</b> (${m.group}-guruh) sifatidasiz.\nPolllarda ovozlaringiz saytga yoziladi.`,
      menuKb
    ))
  }

  await answerCb(cb.id)
}

// ---------- Entry ----------
export async function handleUpdate(update: TgUpdate): Promise<void> {
  try {
    if (!(await markUpdate(update.update_id))) return // duplicate webhook delivery
    if (update.poll_answer) return await onPollAnswer(update.poll_answer)
    if (update.callback_query) return await onCallback(update.callback_query)
    const msg = update.message
    if (!msg?.chat) return
    const chatId = msg.chat.id
    const isPrivate = msg.chat.type === 'private'
    const cmd = (msg.text || '').trim().split(/[@\s]+/)[0]
    const name = msg.from?.first_name || msg.from?.username

    if (cmd === '/start' || cmd === '/menu') {
      if (isPrivate) await clearSession(chatId)
      return onMenu(chatId, name)
    }
    if (cmd === '/cancel') {
      if (isPrivate) await clearSession(chatId)
      return void (await sendMsg(chatId, '❌ Bekor qilindi.', menuKb))
    }
    if (cmd === '/who') return void (await sendMsg(chatId, "👤 O'zingizni tanlang:", whoKb('')))

    if (!isPrivate) return
    const sess = await getSession(chatId)
    if (sess?.state === 'new_text') return onNewQuestionText(chatId, msg.text || '')
    if (sess?.state === 'edit_text') return onEditQuestionText(chatId, msg.text || '', sess.payload)
    if (msg.text) {
      return void (await sendMsg(chatId, 'Botdan foydalanish uchun menyudagi tugmalardan birini bosing 👇', menuKb))
    }
  } catch (e) {
    console.error('[tg-bot] update failed:', e)
  }
}

async function onMenu(chatId: number, name?: string): Promise<void> {
  await sendMsg(chatId, menuText(name), menuKb)
}
