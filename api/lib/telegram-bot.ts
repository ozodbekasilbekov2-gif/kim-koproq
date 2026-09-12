/// <reference types="node" />
// Telegram bot for "Kim ko'proq?" — mirrors the website's survey flow.
// Same DB (questions/votes), same rules: vote per group A/B, no self-votes,
// re-voting replaces, results with voter lists (Telegram style).
import { MEMBERS, CATEGORIES } from './data.js'
import { db } from './db.js'
import { createHash } from 'node:crypto'

// ---------- Types ----------
type TgUser = { id: number; first_name?: string; username?: string }
type TgChat = { id: number; type?: string }
type TgMessage = { message_id: number; chat: TgChat; text?: string; from?: TgUser }
type TgCallback = { id: string; from: TgUser; data?: string; message?: TgMessage }
export type TgUpdate = { update_id: number; message?: TgMessage; callback_query?: TgCallback }

type Member = (typeof MEMBERS)[number]

const memberById = new Map<string, Member>(MEMBERS.map((m, i) => [m.id, m]))
const idxById = new Map<string, number>(MEMBERS.map((m, i) => [m.id, i]))
const memberByIdx = (i: number): Member | undefined => MEMBERS[i]

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

async function editMsg(chatId: number, messageId: number, text: string, keyboard?: InlineKeyboard): Promise<void> {
  await tg('editMessageText', {
    chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: keyboard ? { inline_keyboard: keyboard.inline_keyboard } : undefined,
  }).catch(() => {}) // "message is not modified" and similar are non-fatal
}

const answerCb = (cbId: string, text?: string, showAlert = false): Promise<unknown> =>
  tg('answerCallbackQuery', { callback_query_id: cbId, text, show_alert: showAlert })

const chunkText = (s: string, size = 3800): string[] => {
  if (s.length <= size) return [s]
  const parts: string[] = []
  let rest = s
  while (rest.length > size) {
    let cut = rest.lastIndexOf('\n', size)
    if (cut < size * 0.5) cut = size
    parts.push(rest.slice(0, cut))
    rest = rest.slice(cut)
  }
  if (rest.trim()) parts.push(rest)
  return parts
}

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

async function questionExists(qid: number): Promise<boolean> {
  const q = await db()
  const [row] = await q('SELECT id FROM questions WHERE id=$1 AND deleted_at IS NULL', [qid])
  return !!row
}

async function getMyVotes(voter: string, qid: number): Promise<Record<string, string>> {
  const q = await db()
  const rows = await q('SELECT target_id, target_group FROM votes WHERE voter_id=$1 AND question_id=$2', [voter, qid])
  const out: Record<string, string> = {}
  for (const r of rows) out[String(r.target_group)] = String(r.target_id)
  return out
}

// Same upsert + validation as the website's POST /api/vote
async function castVote(voter: string, qid: number, group: 'A' | 'B', targetId: string): Promise<void> {
  const m = memberById.get(targetId)
  if (!m || m.group !== group) throw new Error('invalid target')
  if (targetId === voter) throw new Error('self vote')
  if (!(await questionExists(qid))) throw new Error('question not found')
  const q = await db()
  await q(
    `INSERT INTO votes (voter_id, question_id, target_id, target_group) VALUES ($1,$2,$3,$4)
     ON CONFLICT (voter_id, question_id, target_group) DO UPDATE SET target_id=EXCLUDED.target_id, created_at=now()`,
    [voter, qid, targetId, group]
  )
}

// ---------- UI builders ----------
const kb = (...rows: InlineButton[][]): InlineKeyboard => ({ inline_keyboard: rows })
const btn = (text: string, data: string): InlineButton => ({ text, callback_data: data })

function menuText(name?: string): string {
  return (
    `👋 Salom${name ? ', <b>' + esc(name) + '</b>' : ''}!\n\n` +
    `Bu — <b>Kim ko'proq?</b> boti. Saytdagi kabi guruh do'stlaringiz uchun so'rovnomalar o'tkazing:\n\n` +
    `📋 <b>So'rovnomа yaratish</b> — barcha savollar uchun ovoz berish kartochkalari yaratiladi\n` +
    `👤 <b>Men kimman</b> — o'zingizni tanlang (bir marta)\n` +
    `🏆 <b>Natijalar</b> — har bir savol bo'yicha kim ko'p ovoz olganini ko'ring`
  )
}

const menuKb = kb([
  btn('📋 So\'rovnomа yaratish', 'create'),
  btn('👤 Men kimman', 'me'), btn('🏆 Natijalar', 'qlist'),
])

async function onMenu(chatId: number, name?: string): Promise<void> {
  await sendMsg(chatId, menuText(name), menuKb)
}

function questionCard(
  q: { id: number; text: string; emoji: string; category: string },
  my: Record<string, string>
): { text: string; kb: InlineKeyboard } {
  const a = my.A ? memberById.get(my.A)?.short : undefined
  const b = my.B ? memberById.get(my.B)?.short : undefined
  const text =
    `${esc(q.emoji)} <b>${esc(q.text)}</b>\n` +
    `#${esc(q.category)} · Ovozingiz: 🅰 ${a ? '✅ ' + esc(a) : '➖'} · 🅱 ${b ? '✅ ' + esc(b) : '➖'}`
  return { text, kb: kb([btn('🅰 A guruh', `g:${q.id}:A`), btn('🅱 B guruh', `g:${q.id}:B`), btn('🏆 Natija', `res:${q.id}`)]) }
}

function pickerKb(qid: number, group: 'A' | 'B', voter: string | undefined, chosen?: string): InlineKeyboard {
  const rows: InlineButton[][] = []
  const options = MEMBERS.map((m, i) => ({ m, i })).filter(({ m }) => m.group === group && m.id !== voter)
  for (let i = 0; i < options.length; i += 2) {
    const row = [options[i], options[i + 1]].filter(Boolean).map(({ m }) =>
      btn((chosen === m.id ? '✅ ' : '') + m.short, `vt:${qid}:${group}:${idxById.get(m.id)}`)
    )
    rows.push(row)
  }
  rows.push([btn('🔙 Savolga', `q:${qid}`)])
  return { inline_keyboard: rows }
}

async function questionStatusText(qid: number): Promise<string> {
  const q = await db()
  const [row] = await q('SELECT text, emoji, category FROM questions WHERE id=$1', [qid])
  const [{ n }] = await q('SELECT COUNT(DISTINCT voter_id)::int AS n FROM votes WHERE question_id=$1', [qid])
  return `${esc(row.emoji)} <b>${esc(row.text)}</b>\n#${esc(row.category)} · ${n} kishi ovoz bergan`
}

// Site-style results with voter lists
async function resultsText(qid: number): Promise<string> {
  const q = await db()
  const [row] = await q('SELECT text, emoji, category FROM questions WHERE id=$1', [qid])
  if (!row) throw new Error('question not found')
  const votes = await q(
    'SELECT target_id, target_group, voter_id FROM votes WHERE question_id=$1 ORDER BY created_at', [qid]
  )
  const byGroup: Record<string, Map<string, string[]>> = { A: new Map(), B: new Map() }
  for (const v of votes) {
    const g = String(v.target_group)
    const t = String(v.target_id)
    if (!byGroup[g]) continue
    if (!byGroup[g].has(t)) byGroup[g].set(t, [])
    byGroup[g].get(t)!.push(String(v.voter_id))
  }
  let out = `${esc(row.emoji)} <b>${esc(row.text)}</b>\n#${esc(row.category)}\n`
  for (const g of ['A', 'B'] as const) {
    out += `\n${g === 'A' ? '🅰' : '🅱'} <b>${g} guruh</b>\n`
    const entries = [...byGroup[g].entries()].sort((x, y) => y[1].length - x[1].length)
    if (!entries.length) {
      out += `➖ Hali ovozlar yo'q\n`
      continue
    }
    entries.forEach(([targetId, voters], i) => {
      const m = memberById.get(targetId)
      out += `${i + 1}. ${esc(m?.name ?? targetId)} — <b>${voters.length}</b> ovoz\n`
      out += `   ↳ ${voters.map((v) => esc(memberById.get(v)?.short ?? v)).join(', ')}\n`
    })
  }
  return out
}

// ---------- Handlers ----------
const isGroup = (chat: TgChat): boolean => chat.type === 'group' || chat.type === 'supergroup'

async function fanOut(chatId: number, chat: TgChat): Promise<void> {
  const questions = await listQuestions()
  if (!questions.length) {
    await sendMsg(chatId, 'Hozircha savollar yo\'q.')
    return
  }
  await sendMsg(chatId, `⏳ <b>${questions.length}</b> ta so'rov yaratilmoqda...`)
  const pace = isGroup(chat) ? 1100 : 250
  for (const q of questions) {
    const card = questionCard(q, {})
    await sendMsg(chatId, card.text, card.kb)
    await new Promise((r) => setTimeout(r, pace))
  }
  await sendMsg(chatId, `✅ Tayyor! <b>${questions.length}</b> ta savol yaratildi — ovoz bering. O'z guruhingizdan bo'lgan do'stingizga ovoz bering (o'zingizga yo'q).`, kb([btn('🏠 Menyu', 'menu')]))
}

async function onCallback(cb: TgCallback): Promise<void> {
  const data = cb.data || ''
  const chatId = cb.message?.chat?.id
  if (!chatId) { await answerCb(cb.id); return }
  const from = cb.from
  const name = from.first_name || from.username

  const [cmd, ...rest] = data.split(':')

  if (cmd === 'menu') {
    await answerCb(cb.id)
    return onMenu(chatId, name)
  }

  if (cmd === 'create') {
    await answerCb(cb.id, 'Yaratilmoqda... ⏳')
    return fanOut(chatId, cb.message!.chat)
  }

  if (cmd === 'me') {
    const bound = await getBinding(chatId)
    const m = bound ? memberById.get(bound) : undefined
    await answerCb(cb.id)
    if (m) {
      return void (await sendMsg(chatId,
        `👤 Siz: <b>${esc(m.name)}</b> (${m.group}-guruh)\nO'zgartirish uchun pastdagi tugmani bosing.`,
        kb([btn('🔁 Tanlash', 'who0')], [btn('🏠 Menyu', 'menu')])))
    }
    return void (await sendMsg(chatId, '👤 O\'zingizni tanlang:', whoKb('')))
  }

  if (cmd === 'qlist') {
    await answerCb(cb.id)
    const questions = await listQuestions()
    const rows: InlineButton[][] = []
    for (let i = 0; i < questions.length; i += 2) {
      rows.push(questions.slice(i, i + 2).map((q) => btn(`${q.emoji} ${q.text.slice(0, 24)}`, `res:${q.id}`)))
    }
    rows.push([btn('🏠 Menyu', 'menu')])
    return void (await sendMsg(chatId, '🏆 Qaysi savol natijalarini ko\'ramiz?', kb(...rows)))
  }

  if (cmd === 'who0' || cmd === 'who') {
    const back = cmd === 'who0' ? '' : rest.slice(1).join(':')
    if (cmd === 'who') {
      const idx = Number(rest[0])
      const m = memberByIdx(idx)
      if (!m) { await answerCb(cb.id, 'A\'zo topilmadi', true); return }
      await setBinding(chatId, m.id, name)
      await answerCb(cb.id, `✅ Siz: ${m.name} (${m.group}-guruh)`)
      if (back) return onCallback({ ...cb, data: back })
      return void (await sendMsg(chatId, `👤 Siz endi <b>${esc(m.name)}</b> (${m.group}-guruh) sifatida ovoz berishingiz mumkin.`, kb([btn('📋 So\'rovnomа yaratish', 'create')])))
    }
    await answerCb(cb.id)
    return void (await sendMsg(chatId, '👤 O\'zingizni tanlang:', whoKb(back)))
  }

  if (cmd === 'q') {
    const qid = Number(rest[0])
    await answerCb(cb.id)
    const voter = await getBinding(chatId)
    const my = voter ? await getMyVotes(voter, qid) : {}
    const card = questionCard({ id: qid, text: (await questionText(qid)).text, emoji: (await questionText(qid)).emoji, category: (await questionText(qid)).category }, my)
    if (cb.message) await editMsg(chatId, cb.message.message_id, card.text, card.kb)
    return
  }

  if (cmd === 'g') {
    const qid = Number(rest[0])
    const group = rest[1] as 'A' | 'B'
    await answerCb(cb.id)
    const voter = await getBinding(chatId)
    if (!voter) {
      await answerCb(cb.id, 'Avval o\'zingizni tanlang 👤', true)
      return void (await sendMsg(chatId, '👤 Ovoz berishdan oldin o\'zingizni tanlang:', whoKb(`g:${qid}:${group}`)))
    }
    const my = await getMyVotes(voter, qid)
    const text =
      `${esc((await questionText(qid)).emoji)} <b>${esc((await questionText(qid)).text)}</b>\n` +
      `${group === 'A' ? '🅰' : '🅱'} <b>${group}-guruh</b> uchun kimga ovoz beramiz?\n` +
      `(o'zingizga ovoz bera olmaysiz)`
    if (cb.message) await editMsg(chatId, cb.message.message_id, text, pickerKb(qid, group, voter, my[group]))
    return
  }

  if (cmd === 'vt') {
    const qid = Number(rest[0])
    const group = rest[1] as 'A' | 'B'
    const idx = Number(rest[2])
    const target = memberByIdx(idx)
    if (!target) { await answerCb(cb.id, 'A\'zo topilmadi', true); return }
    const voter = await getBinding(chatId)
    if (!voter) {
      await answerCb(cb.id, 'Avval o\'zingizni tanlang 👤', true)
      return void (await sendMsg(chatId, '👤 Ovoz berishdan oldin o\'zingizni tanlang:', whoKb(`g:${qid}:${group}`)))
    }
    try {
      await castVote(voter, qid, group, target.id)
    } catch (e: any) {
      const msg = e?.message === 'self vote' ? 'O\'zingizga ovoz bera olmaysiz 🙂'
        : e?.message === 'invalid target' ? 'Noto\'g\'ri guruh a\'zosi'
        : e?.message === 'question not found' ? 'Savol topilmadi' : 'Xatolik, qayta urinib ko\'ring'
      await answerCb(cb.id, msg, true); return
    }
    const my = await getMyVotes(voter, qid)
    await answerCb(cb.id, `✅ Ovoz: ${target.short} (${group})`)
    const done = my.A && my.B
    const qt = await questionText(qid)
    const text = done
      ? `${esc(qt.emoji)} <b>${esc(qt.text)}</b>\n🎉 Ikkala guruhga ham ovoz berdingiz!\n🅰 ${esc(memberById.get(my.A)?.short ?? '—')} · 🅱 ${esc(memberById.get(my.B)?.short ?? '—')}`
      : `${esc(qt.emoji)} <b>${esc(qt.text)}</b>\nOvozingiz: 🅰 ${my.A ? '✅ ' + esc(memberById.get(my.A)!.short) : '➖'} · 🅱 ${my.B ? '✅ ' + esc(memberById.get(my.B)!.short) : '➖'}`
    const keyboard = done
      ? kb([btn('🏆 Natijalarni ko\'rish', `res:${qid}`)], [btn('🏠 Menyu', 'menu')])
      : kb(my.A ? [btn('🅱 B guruhga ovoz', `g:${qid}:B`)] : [btn('🅰 A guruhga ovoz', `g:${qid}:A`)], [btn('🏠 Menyu', 'menu')])
    if (cb.message) await editMsg(chatId, cb.message.message_id, text, keyboard)
    return
  }

  if (cmd === 'res') {
    const qid = Number(rest[0])
    await answerCb(cb.id)
    const text = await resultsText(qid)
    for (const part of chunkText(text)) await sendMsg(chatId, part)
    return
  }

  await answerCb(cb.id)
}

async function questionText(qid: number): Promise<{ text: string; emoji: string; category: string }> {
  const q = await db()
  const [row] = await q('SELECT text, emoji, category FROM questions WHERE id=$1', [qid])
  if (!row) throw new Error('question not found')
  return { text: String(row.text), emoji: String(row.emoji), category: String(row.category) }
}

function whoKb(back: string): InlineKeyboard {
  const suffix = back ? '|' + back : ''
  const rows: InlineButton[][] = []
  for (let i = 0; i < MEMBERS.length; i += 2) {
    rows.push(MEMBERS.slice(i, i + 2).map((m) => btn(`${m.group}-🅰/🅱: ${m.short}`.replace('-🅰/🅱', ` (${m.group})`), `who:${i}${suffix}`)))
  }
  rows.push([btn('🏠 Menyu', 'menu')])
  return { inline_keyboard: rows }
}

// ---------- Entry ----------
export async function handleUpdate(update: TgUpdate): Promise<void> {
  try {
    if (update.callback_query) return await onCallback(update.callback_query)
    const msg = update.message
    if (!msg?.text || !msg.chat) return
    const cmd = msg.text.trim().split(/[@\s]+/)[0]
    const name = msg.from?.first_name || msg.from?.username
    if (cmd === '/start') {
      const bound = await getBinding(msg.chat.id)
      if (!bound) await sendMsg(msg.chat.id, menuText(name) + '\n\n⚠️ Avval «👤 Men kimman» orqali o\'zingizni tanlang.', menuKb)
      else await onMenu(msg.chat.id, name)
      return
    }
    if (cmd === '/menu') return onMenu(msg.chat.id, name)
    if (cmd === '/who') return void (await sendMsg(msg.chat.id, '👤 O\'zingizni tanlang:', whoKb('')))
    // text buttons support (reply keyboard style)
    if (msg.text.includes('Создать') || msg.text.includes('yaratish')) {
      await fanOut(msg.chat.id, msg.chat)
      return
    }
  } catch (e) {
    console.error('[tg-bot] update failed:', e)
  }
}
