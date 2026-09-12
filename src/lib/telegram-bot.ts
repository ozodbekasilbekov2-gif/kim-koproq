/// <reference types="node" />
// Telegram bot for "Kim ko'proq...?" — restored from original 2AF1 implementation.
//
// Two-button menu:
//   ✏️ Savollarni tahrirlash (create / edit / delete questions)
//   👥 Guruhni tanlash (send native Telegram polls for the picked group)
//
// Native polls (sendPoll, is_anonymous=false) are sent per group: every
// question becomes 1-2 polls (Telegram caps a poll at 10 options; group A has
// 14 members, group B has 13, so members are chunked into halves).
// poll_answer updates are written back into the site's votes table
// (self-votes skipped, re-vote upserts) so Telegram and the site stay in sync.
// Webhook deliveries are deduped via tg_updates table.
//
// Adapted to new Prisma schema (User, Avatar, AvatarGroup, Vote models).

import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { ensureDemoSeed } from "@/lib/demo-seed";

// ---------- Types ----------
type TgUser = { id: number; first_name?: string; username?: string };
type TgChat = { id: number; type?: string };
type TgMessage = { message_id: number; chat: TgChat; text?: string; from?: TgUser };
type TgCallback = { id: string; from: TgUser; data?: string; message?: TgMessage };
type TgPollAnswer = { poll_id: string; user: TgUser; option_ids: number[] };
export type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallback;
  poll_answer?: TgPollAnswer;
};

// ---------- Telegram API helpers ----------
const TG_BASE = process.env.TG_API_BASE || "https://api.telegram.org";

export const webhookSecret = (token: string): string =>
  createHash("sha256").update(token + "|kim-koproq").digest("hex").slice(0, 48);

// Vercel env values are stored verbatim — users often paste extra whitespace,
// quotes or the whole "TELEGRAM_BOT_TOKEN=..." line. Normalize before use.
export function normalizeBotToken(raw: string | undefined): string {
  let t = (raw ?? "").trim();
  if (
    t.length > 1 &&
    ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))
  ) {
    t = t.slice(1, -1).trim();
  }
  const eq = t.indexOf("=");
  if (eq > 0 && /^[A-Za-z_][A-Za-z0-9_]*$/.test(t.slice(0, eq))) {
    t = t.slice(eq + 1).trim();
  }
  // Validate format: <bot_id>:<secret>
  if (!/^\d{6,12}:[A-Za-z0-9_-]{30,45}$/.test(t)) return "";
  return t;
}

function token(): string {
  return normalizeBotToken(process.env.TELEGRAM_BOT_TOKEN);
}

type InlineButton = { text: string; callback_data?: string; url?: string; web_app?: { url: string } };
type InlineKeyboard = { inline_keyboard: InlineButton[][] };

async function tg<T = any>(method: string, payload: unknown): Promise<T> {
  const t = token();
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  const res = await fetch(`${TG_BASE}/bot${t}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 429) {
    const retry = Number(res.headers.get("retry-after") || "1");
    await new Promise((r) => setTimeout(r, Math.min(retry, 30) * 1000));
    return tg<T>(method, payload);
  }
  const j = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: T;
    description?: string;
  };
  if (!j.ok) console.error(`[tg] ${method} failed:`, j.description);
  return (j.result ?? ({} as T));
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function sendMsg(
  chatId: number,
  text: string,
  keyboard?: InlineKeyboard
): Promise<number | undefined> {
  const r = await tg<{ message_id?: number }>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: keyboard ? { inline_keyboard: keyboard.inline_keyboard } : undefined,
  });
  return r.message_id;
}

// Send a message with a ReplyKeyboardMarkup (persistent buttons that replace
// the text input field at the bottom of the chat).
type ReplyButton = { text: string };
type ReplyKeyboard = {
  keyboard: ReplyButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
};

async function sendMsgWithReplyKb(
  chatId: number,
  text: string,
  replyKb?: ReplyKeyboard
): Promise<number | undefined> {
  const r = await tg<{ message_id?: number }>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: replyKb
      ? {
          keyboard: replyKb.keyboard,
          resize_keyboard: replyKb.resize_keyboard ?? true,
          one_time_keyboard: replyKb.one_time_keyboard ?? false,
        }
      : undefined,
  });
  return r.message_id;
}

// Send an inline web_app button (opens Mini App). Reply keyboards don't
// support web_app, so we send a separate inline button message.
async function sendMiniAppButton(
  chatId: number,
  text: string,
  miniAppUrl: string,
  buttonText: string
): Promise<void> {
  await tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [[{ text: buttonText, web_app: { url: miniAppUrl } }]],
    },
  });
}

const answerCb = (cbId: string, text?: string, showAlert = false): Promise<unknown> =>
  tg("answerCallbackQuery", { callback_query_id: cbId, text, show_alert: showAlert });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const trimTo = (s: string, n: number): string => (s.length <= n ? s : s.slice(0, n - 1) + "…");

// ---------- DB helpers (using Prisma) ----------

// Find or create a Telegram user (linked to a User record).
// We use chat_id (string) as the telegramId on the User model.
// The binding (chat_id → which avatar/member the user is) is stored in
// the TelegramBinding table.
async function getBinding(chatId: number): Promise<{ userId: string; avatarId?: string } | undefined> {
  // First check TelegramBinding (stores chat_id → user_id + avatar_id)
  const binding = await db.telegramBinding.findUnique({
    where: { chatId: String(chatId) },
    select: { userId: true, avatarId: true },
  });
  if (binding) {
    return { userId: binding.userId, avatarId: binding.avatarId || undefined };
  }
  // Fallback: check if a User exists with this telegramId (created via Mini App login)
  const u = await db.user.findUnique({
    where: { telegramId: String(chatId) },
    select: { id: true },
  });
  if (!u) return undefined;
  return { userId: u.id };
}

async function setBinding(
  chatId: number,
  avatarId: string,
  tgName?: string
): Promise<{ userId: string } | undefined> {
  // avatarId here is actually a member ID from the original data (e.g. "asilbekov-ozodbek")
  // For the new schema we treat it as: find an Avatar with that ID owned by this user
  // OR create one if it doesn't exist. We also need a User record for this chat_id.

  // Find the Avatar by id (could be any user's avatar, but for binding we want one we can vote as)
  const avatar = await db.avatar.findUnique({
    where: { id: avatarId },
    include: { owner: true },
  });
  if (!avatar) return undefined;

  // Ensure a User record exists for this Telegram chat
  let user = await db.user.findUnique({
    where: { telegramId: String(chatId) },
  });
  if (!user) {
    user = await db.user.create({
      data: {
        telegramId: String(chatId),
        telegramName: tgName,
        firstName: avatar.name.split(" ")[0],
        lastName: avatar.name.split(" ").slice(1).join(" "),
      },
    });
  }

  // Update the user to point to this avatar's group by setting a session marker
  // We store the bound avatarId in telegramPhoto field as a hack (or use a dedicated field)
  // For simplicity, we store the binding in tg_users table (kept in schema below)
  await db.telegramBinding.upsert({
    where: { chatId: String(chatId) },
    create: {
      chatId: String(chatId),
      userId: user.id,
      avatarId: avatar.id,
      tgName: tgName || null,
    },
    update: {
      userId: user.id,
      avatarId: avatar.id,
      tgName: tgName || null,
    },
  });

  return { userId: user.id };
}

// ---------- Bot conversation state (serverless-safe: stored in DB) ----------
type Session = { state: string; payload: any };

// We'll store sessions in the TgSession table (added below)
async function getSession(chatId: number): Promise<Session | undefined> {
  const s = await db.tgSession.findUnique({
    where: { chatId: String(chatId) },
  });
  if (!s) return undefined;
  let payload = s.payload;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = {};
    }
  }
  return { state: s.state, payload: (payload as any) ?? {} };
}

async function setSession(
  chatId: number,
  state: string,
  payload: unknown = {}
): Promise<void> {
  await db.tgSession.upsert({
    where: { chatId: String(chatId) },
    create: {
      chatId: String(chatId),
      state,
      payload: payload as any,
    },
    update: {
      state,
      payload: payload as any,
    },
  });
}

async function clearSession(chatId: number): Promise<void> {
  await db.tgSession.deleteMany({ where: { chatId: String(chatId) } });
}

// Webhook dedupe: returns false when this update was already processed.
async function markUpdate(updateId: number): Promise<boolean> {
  try {
    await db.tgUpdate.upsert({
      where: { updateId: String(updateId) },
      create: { updateId: String(updateId) },
      update: {},
    });
    // If we got here without error, it's a new update (best-effort dedupe)
    return true;
  } catch {
    return false;
  }
}

// ---------- Questions (via new schema) ----------
const CATEGORIES = ["Roast", "Rostini ayt", "Kelajak", "Xaos"] as const;
const CATEGORY_EMOJI: Record<string, string> = {
  Roast: "🔥",
  "Rostini ayt": "😳",
  Kelajak: "🔮",
  Xaos: "💀",
};

const validQuestionText = (t: string): boolean => t.length >= 5 && t.length <= 200;

// We need a "default" set for the bot to operate on.
// Preference order:
//   1. The canonical 2AF1 demo set ("Kim ko'proq...? — 2AF1 so'rovi") — public
//   2. The user's own first set (if bound)
//   3. Any public set
async function getDefaultSet(userId?: string): Promise<{ id: string; ownerId: string } | null> {
  // 1) Prefer the canonical 2AF1 demo set by exact title match
  const demo = await db.questionSet.findFirst({
    where: { title: "Kim ko'proq...? — 2AF1 so'rovi", isPublic: true },
    orderBy: { createdAt: "asc" },
  });
  if (demo) return { id: demo.id, ownerId: demo.ownerId };

  // 2) Fallback: any set whose title contains "Kim ko'proq" or "2AF1"
  const any2af1 = await db.questionSet.findFirst({
    where: {
      isPublic: true,
      OR: [
        { title: { contains: "Kim ko'proq" } },
        { title: { contains: "2AF1" } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  if (any2af1) return { id: any2af1.id, ownerId: any2af1.ownerId };

  // 3) User's own first set
  if (userId) {
    const own = await db.questionSet.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: "asc" },
    });
    if (own) return { id: own.id, ownerId: own.ownerId };
  }

  // 4) Any public set
  const pub = await db.questionSet.findFirst({
    where: { isPublic: true },
    orderBy: { createdAt: "asc" },
  });
  return pub ? { id: pub.id, ownerId: pub.ownerId } : null;
}

async function listQuestions(setId: string): Promise<
  Array<{ id: string; text: string; emoji: string; category: string }>
> {
  const qs = await db.question.findMany({
    where: { setId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  return qs.map((q) => ({
    id: q.id,
    text: q.text,
    emoji: q.emoji,
    category: q.category,
  }));
}

async function questionText(
  qid: string
): Promise<{ text: string; emoji: string; category: string } | undefined> {
  const q = await db.question.findUnique({ where: { id: qid } });
  if (!q || q.deletedAt) return undefined;
  return { text: q.text, emoji: q.emoji, category: q.category };
}

async function insertQuestion(
  setId: string,
  text: string,
  emoji: string,
  category: string,
  actorId: string
): Promise<string> {
  const q = await db.question.create({
    data: { text, emoji, category, setId, createdBy: actorId },
  });
  await db.questionHistory.create({
    data: { questionId: q.id, action: "add", actor: actorId, newText: text },
  });
  return q.id;
}

async function updateQuestion(
  qid: string,
  text: string,
  actorId: string
): Promise<boolean> {
  const old = await db.question.findUnique({ where: { id: qid } });
  if (!old || old.deletedAt) return false;
  await db.question.update({
    where: { id: qid },
    data: { text, updatedBy: actorId },
  });
  await db.questionHistory.create({
    data: {
      questionId: qid,
      action: "edit",
      actor: actorId,
      oldText: old.text,
      newText: text,
    },
  });
  return true;
}

async function deleteQuestion(qid: string, actorId: string): Promise<boolean> {
  const old = await db.question.findUnique({ where: { id: qid } });
  if (!old || old.deletedAt) return false;
  await db.question.update({
    where: { id: qid },
    data: { deletedAt: new Date(), deletedBy: actorId },
  });
  await db.questionHistory.create({
    data: { questionId: qid, action: "delete", actor: actorId, oldText: old.text },
  });
  return true;
}

// ---------- Avatars / members (via new schema) ----------
// Avatars now live in DB instead of hardcoded MEMBERS array.
// For the bot we load the 27 demo avatars from the system '2af1-demo-user'.
// We call ensureDemoSeed() first to guarantee the demo data exists.

async function getAvatarsForBot(_userId?: string): Promise<
  Array<{
    id: string;
    name: string;
    short: string;
    group: string; // group color tag ("A" / "B" / etc.)
    photoUrl: string | null;
  }>
> {
  // Step 1: Ensure the demo data exists (creates 27 avatars + 2 groups + set
  // + 29 questions if missing). This is idempotent and safe to call on every request.
  try {
    await ensureDemoSeed();
  } catch (e) {
    console.error("[tg-bot] ensureDemoSeed failed:", e);
  }

  // Step 2: Find the system demo user that owns the 27 avatars
  const demoUser = await db.user.findUnique({
    where: { telegramId: "2af1-demo-user" },
    select: { id: true },
  });
  if (!demoUser) {
    console.warn("[tg-bot] demo user not found after ensureDemoSeed — returning empty list");
    return [];
  }

  // Step 3: Load ALL avatars owned by the demo user (the 27 2AF1 members)
  const avatars = await db.avatar.findMany({
    where: { ownerId: demoUser.id },
    include: { group: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(
    `[tg-bot] Loaded ${avatars.length} avatars from demo user (expected 27)`
  );
  return avatars.map((a) => ({
    id: a.id,
    name: a.name,
    short: a.shortName || a.name,
    group: a.group?.color || "A",
    photoUrl: a.photoUrl,
  }));
}

function membersOfGroup(
  avatars: ReturnType<typeof getAvatarsForBot> extends Promise<infer T> ? T : never,
  group: string
) {
  return avatars.filter((m) => m.group === group);
}

// ---------- Native polls: registry + vote sync ----------
async function registerPoll(
  pollId: string,
  qid: string,
  group: string,
  optionAvatarIds: string[],
  chatId: number
): Promise<void> {
  await db.tgPoll.upsert({
    where: { pollId },
    create: {
      pollId,
      questionId: qid,
      targetGroup: group,
      optionAvatarIds: optionAvatarIds as any,
      chatId: String(chatId),
    },
    update: {},
  });
}

async function getPollRegistration(
  pollId: string
): Promise<{
  questionId: string;
  targetGroup: string;
  optionAvatarIds: string[];
} | undefined> {
  const p = await db.tgPoll.findUnique({ where: { pollId } });
  if (!p) return undefined;
  let members = p.optionAvatarIds as any;
  if (typeof members === "string") {
    try {
      members = JSON.parse(members);
    } catch {
      members = [];
    }
  }
  return {
    questionId: p.questionId,
    targetGroup: p.targetGroup,
    optionAvatarIds: Array.isArray(members) ? members.map(String) : [],
  };
}

// Same upsert semantics as the website's POST /api/vote; never throws —
// a failed sync must not break the webhook. Self-votes are skipped (site rule).
async function recordVote(
  voterUserId: string,
  voterAvatarId: string | undefined,
  qid: string,
  group: string,
  targetAvatarId: string,
  setId: string
): Promise<void> {
  try {
    if (targetAvatarId === voterAvatarId) return; // self-vote skip
    const q = await db.question.findUnique({ where: { id: qid } });
    if (!q || q.deletedAt) return;
    await db.vote.upsert({
      where: {
        voterId_questionId_groupId: {
          voterId: voterUserId,
          questionId: qid,
          groupId: group,
        },
      },
      create: {
        voterId: voterUserId,
        questionId: qid,
        setId,
        targetId: targetAvatarId,
        groupId: group,
      },
      update: { targetId: targetAvatarId },
    });
  } catch (e) {
    console.error("[tg-bot] vote sync failed:", e);
  }
}

async function onPollAnswer(pa: TgPollAnswer): Promise<void> {
  const reg = await getPollRegistration(pa.poll_id);
  if (!reg) return;
  const binding = await getBinding(pa.user.id);
  if (!binding) return; // unbound users' votes live in Telegram only
  const setId = await getDefaultSet(binding.userId);
  if (!setId) return;
  for (const oid of pa.option_ids) {
    const target = reg.optionAvatarIds[oid];
    if (!target) continue;
    await recordVote(
      binding.userId,
      binding.avatarId,
      reg.questionId,
      reg.targetGroup,
      target,
      setId.id
    );
  }
}

// ---------- UI builders ----------
const kb = (...rows: InlineButton[][]): InlineKeyboard => ({ inline_keyboard: rows });
const btn = (text: string, data: string): InlineButton => ({ text, callback_data: data });

function menuText(name?: string): string {
  return (
    `👋 Salom${name ? ", <b>" + esc(name) + "</b>" : ""}!\n\n` +
    `Bu — <b>Kim ko'proq...?</b> boti.\n\n` +
    `✏️ <b>Savollarni tahrirlash</b> — savol qo'shish, o'zgartirish yoki o'chirish\n` +
    `👥 <b>Guruhni tanlash</b> — tanlangan guruh a'zolari bilan native Telegram so'rovnomalar (poll) yuboriladi\n\n` +
    `💡 Polllarda ovoz berganingiz sayt natijalariga ham avtomatik yoziladi.`
  );
}

const menuKb = kb(
  [btn("✏️ Savollarni tahrirlash", "editm")],
  [btn("👥 Guruhni tanlash", "grp")]
);

const cancelKb = kb([btn("❌ Bekor qilish", "cancel")]);

function categoryKb(): InlineKeyboard {
  const cats = CATEGORIES.map((c) =>
    btn(`${CATEGORY_EMOJI[c] ?? "❓"} ${c}`, `cat:${c}`)
  );
  return kb(cats.slice(0, 2), cats.slice(2), [btn("❌ Bekor qilish", "cancel")]);
}

function whoKb(avatars: any[], back: string): InlineKeyboard {
  const suffix = back ? "|" + back : "";
  const rows: InlineButton[][] = [];
  for (let i = 0; i < avatars.length; i += 2) {
    rows.push(
      avatars.slice(i, i + 2).map((m) =>
        btn(`(${m.group}) ${m.short}`, `who:${i}${suffix}`)
      )
    );
  }
  rows.push([btn("🏠 Menyu", "menu")]);
  return { inline_keyboard: rows };
}

function groupChooserKb(avatars: any[]): InlineKeyboard {
  const aCount = avatars.filter((m) => m.group === "A").length;
  const bCount = avatars.filter((m) => m.group === "B").length;
  return kb(
    [
      btn(`🅰 A guruh · ${aCount} a'zo`, "pollA"),
      btn(`🅱 B guruh · ${bCount} a'zo`, "pollB"),
    ],
    [btn("👤 Men kimman", "me"), btn("🔙 Menyu", "menu")]
  );
}

// ---------- Question list (edit / delete pickers, paginated) ----------
const PAGE_SIZE = 6;

async function sendQuestionList(
  chatId: number,
  mode: "e" | "d",
  page: number,
  setId: string
): Promise<void> {
  const questions = await listQuestions(setId);
  if (!questions.length) {
    await sendMsg(
      chatId,
      "Hozircha savollar yo'q. «➕ Yangi savol» orqali qo'shing.",
      menuKb
    );
    return;
  }
  const pages = Math.max(1, Math.ceil(questions.length / PAGE_SIZE));
  const p = Math.min(Math.max(0, page), pages - 1);
  const slice = questions.slice(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE);
  const title = mode === "e" ? "📝 Qaysi savolni o'zgartiramiz?" : "🗑 Qaysi savolni o'chiramiz?";

  const rows: InlineButton[][] = slice.map((q) => [
    btn(
      `${q.emoji} ${trimTo(q.text, 32)}`,
      `${mode === "e" ? "qe" : "qd"}:${q.id}:${p}`
    ),
  ]);
  const nav: InlineButton[] = [];
  if (p > 0) nav.push(btn("◀️", `lst:${mode}:${p - 1}`));
  nav.push(btn(`${p + 1} / ${pages}`, "noop"));
  if (p < pages - 1) nav.push(btn("▶️", `lst:${mode}:${p + 1}`));
  rows.push(nav, [btn("🔙 Menyu", "menu")]);
  await sendMsg(chatId, `${title}\nJami ${questions.length} ta savol`, kb(...rows));
}

// ---------- Native poll fan-out ----------
type FanoutCursor = { group: string; qi: number; pi: number; sent: number };

// Telegram limits a poll to 10 options; groups with >10 members get chunked
function chunkMembers<T>(members: T[]): T[][] {
  if (members.length <= 10) return [members];
  const half = Math.ceil(members.length / 2);
  return [members.slice(0, half), members.slice(half)];
}

const isGroupChat = (chat: TgChat): boolean =>
  chat.type === "group" || chat.type === "supergroup";
const paceMs = (): number => Number(process.env.TG_PACE_MS ?? 350);
const BUDGET_MS = 48_000; // stay safely under the 60s serverless limit

async function runFanout(
  chatId: number,
  chat: TgChat,
  cursor: FanoutCursor,
  setId: string,
  avatars: any[]
): Promise<void> {
  const questions = await listQuestions(setId);
  if (!questions.length) {
    await clearSession(chatId);
    await sendMsg(chatId, "Hozircha savollar yo'q.", menuKb);
    return;
  }
  const groupMembers = membersOfGroup(avatars, cursor.group);
  if (groupMembers.length === 0) {
    await clearSession(chatId);
    await sendMsg(
      chatId,
      `⚠️ ${cursor.group}-guruhda a'zolar yo'q. Avval saytda avatarlar qo'shing.`,
      menuKb
    );
    return;
  }
  const parts = chunkMembers(groupMembers);
  const pace = isGroupChat(chat) ? Math.max(paceMs(), 1100) : paceMs();
  const started = Date.now();
  let qi = cursor.qi;
  let pi = cursor.pi;
  let sent = cursor.sent;
  if (qi === 0 && pi === 0) {
    await sendMsg(
      chatId,
      `⏳ ${cursor.group}-guruh uchun ${questions.length} ta savol · native so'rovnomalar yuborilmoqda...`
    );
  }
  for (; qi < questions.length; qi++) {
    for (; pi < parts.length; pi++) {
      if (Date.now() - started > BUDGET_MS) {
        await setSession(chatId, "fanout", {
          group: cursor.group,
          qi,
          pi,
          sent,
          setId,
        });
        const remaining = (questions.length - qi) * parts.length - pi;
        await sendMsg(
          chatId,
          `⏸ Xavfsizlik uchun to'xtatildi — ${sent} ta yuborildi, ~${remaining} ta qoldi.\nDavom etish uchun tugmani bosing:`,
          kb([btn("▶️ Davom etish", "resume")], [btn("❌ Bekor qilish", "cancel")])
        );
        return;
      }
      const q = questions[qi];
      const label = parts.length > 1 ? ` (${pi + 1}/${parts.length})` : "";
      const res = await tg<any>("sendPoll", {
        chat_id: chatId,
        question: trimTo(`${q.emoji} ${q.text}${label}`, 300),
        options: parts[pi].map((m: any) => m.short),
        is_anonymous: false,
      });
      const pollId: string | undefined = res?.poll?.id;
      if (pollId)
        await registerPoll(
          pollId,
          q.id,
          cursor.group,
          parts[pi].map((m: any) => m.id),
          chatId
        );
      sent++;
      await sleep(pace);
    }
    pi = 0;
  }
  await clearSession(chatId);
  await sendMsg(
    chatId,
    `✅ Tayyor! ${cursor.group}-guruh uchun ${sent} ta native so'rovnoma yuborildi.\n\n` +
      `Polllarda ovoz berganingiz sayt natijalariga ham yoziladi (o'zingizga bergan ovoz hisobga olinmaydi).`,
    kb([btn("👥 Boshqa guruh", "grp")], [btn("🏠 Menyu", "menu")])
  );
}

// ---------- Text input handlers ----------
async function onNewQuestionText(
  chatId: number,
  raw: string,
  setId: string
): Promise<void> {
  const text = (raw || "").trim();
  if (!validQuestionText(text)) {
    await sendMsg(
      chatId,
      "⚠️ Savol 5–200 belgi bo'lsin. Qayta yozib yuboring (yoki «❌ Bekor qilish» bosing):",
      cancelKb
    );
    return;
  }
  await setSession(chatId, "new_cat", { text, setId });
  await sendMsg(chatId, "🏷 Kategoriyani tanlang:", categoryKb());
}

async function onEditQuestionText(
  chatId: number,
  raw: string,
  payload: any
): Promise<void> {
  const qid = String(payload?.qid);
  const text = (raw || "").trim();
  if (!validQuestionText(text)) {
    await sendMsg(
      chatId,
      "⚠️ Savol 5–200 belgi bo'lsin. Qayta yozib yuboring (yoki «❌ Bekor qilish» bosing):",
      cancelKb
    );
    return;
  }
  const binding = await getBinding(chatId);
  const actorId = binding?.userId || "tg-anon";
  const okUpd = await updateQuestion(qid, text, actorId);
  await clearSession(chatId);
  if (!okUpd) {
    await sendMsg(chatId, "⚠️ Savol topilmadi (o'chirilgan bo'lishi mumkin).", menuKb);
    return;
  }
  await sendMsg(chatId, `✅ Savol yangilandi:\n«${esc(text)}»`, menuKb);
}

// ---------- Callback router ----------
async function onCallback(cb: TgCallback): Promise<void> {
  const data = cb.data || "";
  const chatId = cb.message?.chat?.id;
  if (!chatId) {
    await answerCb(cb.id);
    return;
  }
  const from = cb.from;
  const name = from.first_name || from.username;
  const [cmd, ...rest] = data.split(":");

  if (cmd === "menu") {
    await answerCb(cb.id);
    await clearSession(chatId);
    return onMenu(chatId, name);
  }

  if (cmd === "noop") {
    await answerCb(cb.id);
    return;
  }

  if (cmd === "cancel") {
    await answerCb(cb.id, "Bekor qilindi");
    await clearSession(chatId);
    return void (await sendMsg(chatId, "❌ Bekor qilindi.", menuKb));
  }

  // ----- edit menu -----
  if (cmd === "editm") {
    await answerCb(cb.id);
    await clearSession(chatId);
    return void (await sendMsg(
      chatId,
      "✏️ <b>Savollarni boshqarish</b>",
      kb(
        [btn("➕ Yangi savol qo'shish", "newq")],
        [btn("📝 Savolni o'zgartirish", "editq0")],
        [btn("🗑 Savolni o'chirish", "delq0")],
        [btn("🔙 Menyu", "menu")]
      )
    ));
  }

  // ----- create flow -----
  if (cmd === "newq") {
    await answerCb(cb.id);
    const binding = await getBinding(chatId);
    const set = await getDefaultSet(binding?.userId);
    if (!set) {
      await sendMsg(
        chatId,
        "⚠️ Avval saytda savol seti yarating (kim-koproq.vercel.app).",
        menuKb
      );
      return;
    }
    await clearSession(chatId);
    await setSession(chatId, "new_text", { setId: set.id });
    return void (await sendMsg(
      chatId,
      "➕ Yangi savol matnini yozib yuboring (5–200 belgi):",
      cancelKb
    ));
  }

  if (cmd === "cat") {
    const category = rest.join(":");
    const sess = await getSession(chatId);
    const text = sess?.state === "new_cat" ? String(sess.payload?.text ?? "") : "";
    const setId = sess?.state === "new_cat" ? String(sess.payload?.setId ?? "") : "";
    if (!text || !setId) {
      await answerCb(cb.id, "Avval savol matnini yuboring", true);
      return;
    }
    const validCat = (CATEGORIES as readonly string[]).includes(category)
      ? category
      : "Xaos";
    const binding = await getBinding(chatId);
    const actorId = binding?.userId || `tg:${from.first_name || from.username || chatId}`;
    const id = await insertQuestion(
      setId,
      text,
      CATEGORY_EMOJI[validCat] ?? "❓",
      validCat,
      actorId
    );
    await clearSession(chatId);
    await answerCb(cb.id, "✅ Saqlandi");
    return void (await sendMsg(
      chatId,
      `✅ Savol qo'shildi:\n${CATEGORY_EMOJI[validCat] ?? "❓"} ${esc(text)}\n#${validCat}`,
      kb(
        [btn("👥 Guruhni tanlash", "grp")],
        [btn("✏️ Yana qo'shish", "newq")],
        [btn("🔙 Menyu", "menu")]
      )
    ));
  }

  // ----- edit flow -----
  if (cmd === "editq0") {
    await answerCb(cb.id);
    await clearSession(chatId);
    const binding = await getBinding(chatId);
    const set = await getDefaultSet(binding?.userId);
    if (!set) {
      await sendMsg(chatId, "⚠️ Savol seti topilmadi.", menuKb);
      return;
    }
    return void (await sendQuestionList(chatId, "e", 0, set.id));
  }

  if (cmd === "qe") {
    const qid = String(rest[0]);
    const qt = await questionText(qid);
    if (!qt) {
      await answerCb(cb.id, "Savol topilmadi", true);
      return;
    }
    await clearSession(chatId);
    await setSession(chatId, "edit_text", { qid });
    await answerCb(cb.id);
    return void (await sendMsg(
      chatId,
      `📝 Hozirgi matn:\n«${esc(qt.text)}»\n\nYangi matnni yozib yuboring (5–200 belgi):`,
      cancelKb
    ));
  }

  // ----- delete flow -----
  if (cmd === "delq0") {
    await answerCb(cb.id);
    await clearSession(chatId);
    const binding = await getBinding(chatId);
    const set = await getDefaultSet(binding?.userId);
    if (!set) {
      await sendMsg(chatId, "⚠️ Savol seti topilmadi.", menuKb);
      return;
    }
    return void (await sendQuestionList(chatId, "d", 0, set.id));
  }

  if (cmd === "qd") {
    const qid = String(rest[0]);
    const qt = await questionText(qid);
    if (!qt) {
      await answerCb(cb.id, "Savol topilmadi", true);
      return;
    }
    await answerCb(cb.id);
    await clearSession(chatId);
    return void (await sendMsg(
      chatId,
      `🗑 O'chirilsinmi?\n\n${esc(qt.emoji)} ${esc(qt.text)}`,
      kb(
        [btn("🗑 Ha, o'chirish", `qdel:${qid}`)],
        [btn("❌ Bekor qilish", "cancel")]
      )
    ));
  }

  if (cmd === "qdel") {
    const qid = String(rest[0]);
    await answerCb(cb.id);
    await clearSession(chatId);
    const binding = await getBinding(chatId);
    const actorId = binding?.userId || `tg:${from.first_name || from.username || chatId}`;
    const okDel = await deleteQuestion(qid, actorId);
    return void (await sendMsg(
      chatId,
      okDel ? "✅ Savol o'chirildi." : "⚠️ Savol topilmadi.",
      menuKb
    ));
  }

  // ----- pagination -----
  if (cmd === "lst") {
    await answerCb(cb.id);
    await clearSession(chatId);
    const mode = rest[0] === "d" ? "d" : "e";
    const page = Number(rest[1] || 0);
    const binding = await getBinding(chatId);
    const set = await getDefaultSet(binding?.userId);
    if (!set) {
      await sendMsg(chatId, "⚠️ Savol seti topilmadi.", menuKb);
      return;
    }
    return void (await sendQuestionList(chatId, mode, Number.isFinite(page) ? page : 0, set.id));
  }

  // ----- group picker + binding -----
  if (cmd === "grp") {
    await answerCb(cb.id);
    await clearSession(chatId);
    const binding = await getBinding(chatId);
    if (!binding) {
      const avatars = await getAvatarsForBot();
      return void (await sendMsg(
        chatId,
        "👤 Ovozlar saytga to'g'ri yozilishi uchun avval o'zingizni tanlang:",
        whoKb(avatars, "grp")
      ));
    }
    const avatars = await getAvatarsForBot(binding.userId);
    return void (await sendMsg(
      chatId,
      "👥 Qaysi guruh uchun native so'rovnomalar yuborilsin?",
      groupChooserKb(avatars)
    ));
  }

  if (cmd === "pollA" || cmd === "pollB") {
    await answerCb(cb.id, "Yuborilmoqda... ⏳");
    const group = cmd === "pollA" ? "A" : "B";
    const binding = await getBinding(chatId);
    if (!binding) {
      const avatars = await getAvatarsForBot();
      await sendMsg(
        chatId,
        "👤 Avval o'zingizni tanlang:",
        whoKb(avatars, "grp")
      );
      return;
    }
    const set = await getDefaultSet(binding.userId);
    if (!set) {
      await sendMsg(chatId, "⚠️ Savol seti topilmadi.", menuKb);
      return;
    }
    const avatars = await getAvatarsForBot(binding.userId);
    const cursor: FanoutCursor = { group, qi: 0, pi: 0, sent: 0 };
    await clearSession(chatId);
    await setSession(chatId, "fanout", { ...cursor, setId: set.id });
    return runFanout(chatId, cb.message!.chat, cursor, set.id, avatars);
  }

  if (cmd === "resume") {
    await answerCb(cb.id, "Davom etilmoqda... ⏳");
    const sess = await getSession(chatId);
    if (sess?.state !== "fanout" || !sess.payload?.group) {
      await sendMsg(
        chatId,
        "Avval «👥 Guruhni tanlash» orqali guruh tanlang.",
        menuKb
      );
      return;
    }
    const cursor: FanoutCursor = {
      group: sess.payload.group === "B" ? "B" : "A",
      qi: Number(sess.payload.qi) || 0,
      pi: Number(sess.payload.pi) || 0,
      sent: Number(sess.payload.sent) || 0,
    };
    const setId = String(sess.payload.setId || "");
    const binding = await getBinding(chatId);
    const avatars = await getAvatarsForBot(binding?.userId);
    return runFanout(chatId, cb.message!.chat, cursor, setId, avatars);
  }

  if (cmd === "me") {
    const binding = await getBinding(chatId);
    await answerCb(cb.id);
    if (binding) {
      const avatars = await getAvatarsForBot(binding.userId);
      const bound = avatars.find((a) => a.id === binding.avatarId);
      if (bound) {
        return void (await sendMsg(
          chatId,
          `👤 Siz: <b>${esc(bound.name)}</b> (${bound.group}-guruh)\nO'zgartirish uchun «🔁 Tanlash»ni bosing.`,
          kb([btn("🔁 Tanlash", "who0")], [btn("🔙 Menyu", "menu")])
        ));
      }
    }
    const avatars = await getAvatarsForBot();
    return void (await sendMsg(chatId, "👤 O'zingizni tanlang:", whoKb(avatars, "")));
  }

  if (cmd === "who0") {
    await answerCb(cb.id);
    const avatars = await getAvatarsForBot();
    return void (await sendMsg(chatId, "👤 O'zingizni tanlang:", whoKb(avatars, "")));
  }

  if (cmd === "who") {
    const raw = rest.join(":");
    const [idxStr, back] = raw.split("|");
    const avatars = await getAvatarsForBot();
    const m = avatars[Number(idxStr)];
    if (!m) {
      await answerCb(cb.id, "A'zo topilmadi", true);
      return;
    }
    await setBinding(chatId, m.id, name);
    await answerCb(cb.id, `✅ Siz: ${m.name} (${m.group}-guruh)`);
    if (back) return onCallback({ ...cb, data: back });
    return void (await sendMsg(
      chatId,
      `👤 Siz endi <b>${esc(m.name)}</b> (${m.group}-guruh) sifatidasiz.\nPolllarda ovozlaringiz saytga yoziladi.`,
      menuKb
    ));
  }

  // ----- results — open results page on the site -----
  if (cmd === "results") {
    await answerCb(cb.id);
    const binding = await getBinding(chatId);
    const set = await getDefaultSet(binding?.userId);
    const miniAppUrl = process.env.NEXT_PUBLIC_MINI_APP_URL || "https://kim-koproq.vercel.app";
    if (!set) {
      return void (await sendMsg(chatId, "⚠️ Set topilmadi.", menuKb));
    }
    await sendMsg(chatId, "📊 Natijalarni saytda ko'rish uchun:", menuKb);
    await sendMiniAppButton(chatId, `Set ID: ${set.id}`, `${miniAppUrl}?share=${set.id}`, "📊 Natijalarni ochish");
    return;
  }

  // ----- open_site — open Mini App -----
  if (cmd === "open_site") {
    await answerCb(cb.id);
    const miniAppUrl = process.env.NEXT_PUBLIC_MINI_APP_URL || "https://kim-koproq.vercel.app";
    await sendMsg(chatId, "🌐 Sayt ochilmoqda...", menuKb);
    await sendMiniAppButton(chatId, "To'liq sayt", miniAppUrl, "🌐 Saytni ochish");
    return;
  }

  await answerCb(cb.id);
}

// ---------- Entry ----------
// Main menu reply keyboard — persistent buttons at the bottom of chat.
// Layout: 2 columns x 2 rows
//   📋 Setlar          |  👥 Guruh tanlash
//   🔍 Izlash          |  ℹ️ Yordam
const mainMenuReplyKb = (): ReplyKeyboard => ({
  keyboard: [
    [{ text: "📋 Setlar" }, { text: "👥 Guruh tanlash" }],
    [{ text: "🔍 Izlash" }, { text: "ℹ️ Yordam" }],
  ],
  resize_keyboard: true,
});

// Sub-flow keyboard — just a back button
const backReplyKb = (): ReplyKeyboard => ({
  keyboard: [[{ text: "🔙 Orqaga" }]],
  resize_keyboard: true,
});

export async function handleUpdate(update: TgUpdate): Promise<void> {
  try {
    if (!(await markUpdate(update.update_id))) return; // duplicate webhook delivery
    if (update.poll_answer) return await onPollAnswer(update.poll_answer);
    if (update.callback_query) return await onCallback(update.callback_query);
    const msg = update.message;
    if (!msg?.chat) return;
    const chatId = msg.chat.id;
    const isPrivate = msg.chat.type === "private";
    const rawText = (msg.text || "").trim();
    const cmd = rawText.split(/[@\s]+/)[0];
    const name = msg.from?.first_name || msg.from?.username;
    const miniAppUrl = process.env.NEXT_PUBLIC_MINI_APP_URL || "https://kim-koproq.vercel.app";

    // Commands
    if (cmd === "/start" || cmd === "/menu") {
      if (isPrivate) await clearSession(chatId);
      return onMenu(chatId, name);
    }
    if (cmd === "/cancel") {
      if (isPrivate) await clearSession(chatId);
      return void (await sendMsgWithReplyKb(chatId, "❌ Bekor qilindi.", mainMenuReplyKb()));
    }

    // ===== Reply keyboard button handlers =====
    // These trigger the SAME inline keyboard flows that existed in the original bot.

    // 📋 Setlar — question CRUD sub-menu (create / edit / delete / results / open site)
    if (rawText === "📋 Setlar") {
      await clearSession(chatId);
      const binding = await getBinding(chatId);
      const set = await getDefaultSet(binding?.userId);
      const count = set ? (await listQuestions(set.id)).length : 0;
      return void (await sendMsg(
        chatId,
        `📋 <b>Savollarni boshqarish</b>\n\n` +
        (set
          ? `Aktiv setda ${count} ta savol bor.\nQuyidagi amallardan birini tanlang:`
          : "Hozircha set topilmadi. Avval saytda set yarating."),
        kb(
          [btn("➕ Yangi savol qo'shish", "newq")],
          [btn("📝 Savolni o'zgartirish", "editq0")],
          [btn("🗑 Savolni o'chirish", "delq0")],
          [btn("📊 Natijalarni ko'rish", "results")],
          [btn("🌐 Saytda ochish", "open_site")]
        )
      ));
    }

    // 👥 Guruh tanlash — group chooser + binding + native polls
    if (rawText === "👥 Guruh tanlash") {
      await clearSession(chatId);
      const binding = await getBinding(chatId);
      if (!binding) {
        const avatars = await getAvatarsForBot();
        return void (await sendMsg(
          chatId,
          "👤 Ovozlar saytga to'g'ri yozilishi uchun avval o'zingizni tanlang:",
          whoKb(avatars, "grp")
        ));
      }
      const avatars = await getAvatarsForBot(binding.userId);
      return void (await sendMsg(
        chatId,
        "👥 Qaysi guruh uchun native so'rovnomalar yuborilsin?",
        groupChooserKb(avatars)
      ));
    }

    // 🔍 Izlash — enter search mode, user pastes URL
    if (rawText === "🔍 Izlash") {
      await setSession(chatId, "search_url", {});
      return void (await sendMsgWithReplyKb(
        chatId,
        "🔍 <b>Set izlash</b>\n\nSet savollari URL manzilini shu yerga yuboring:\n\n" +
        "<i>Misol: https://kim-koproq.vercel.app/?share=abc123</i>\n\n" +
        "Yoki set IDsini kiriting:",
        backReplyKb()
      ));
    }

    // ℹ️ Yordam — help text
    if (rawText === "ℹ️ Yordam") {
      return void (await sendMsgWithReplyKb(
        chatId,
        "ℹ️ <b>Yordam</b>\n\n" +
        "<b>📋 Setlar</b> — savol qo'shish, o'zgartirish, o'chirish, natijalar\n" +
        "<b>👥 Guruh tanlash</b> — native Telegram so'rovnomalar (poll) yuborish\n" +
        "<b>🔍 Izlash</b> — set URL orqali so'rovnomada qatnashish\n\n" +
        "Polllarda ovoz berganingiz sayt natijalariga avtomatik yoziladi.",
        mainMenuReplyKb()
      ));
    }

    // 🔙 Orqaga — return to main menu
    if (rawText === "🔙 Orqaga") {
      await clearSession(chatId);
      return onMenu(chatId, name);
    }

    if (!isPrivate) return;

    // ===== Conversation state handlers (multi-step flows) =====
    const sess = await getSession(chatId);

    // Search URL state — user pasted a URL or set ID
    if (sess?.state === "search_url") {
      const query = rawText.trim();
      let setId: string | null = null;

      try {
        if (query.startsWith("http")) {
          const url = new URL(query);
          setId = url.searchParams.get("share");
        } else if (query.includes("share=")) {
          const idx = query.indexOf("share=");
          setId = query.substring(idx + 6).split("&")[0];
        }
      } catch {}

      if (!setId && /^[a-z0-9]{20,30}$/i.test(query)) {
        setId = query;
      }

      if (setId) {
        await clearSession(chatId);
        const shareUrl = `${miniAppUrl}?share=${setId}`;
        await sendMsgWithReplyKb(chatId, "✅ Set topildi! Quyidagi tugma orqali ochish:", mainMenuReplyKb());
        await sendMiniAppButton(chatId, "So'rovnomada qatnashish uchun:", shareUrl, "🚀 Setni ochish");
      } else {
        await sendMsgWithReplyKb(
          chatId,
          "⚠️ URL yoki set ID noto'g'ri formatda.\n\nQayta kiriting yoki 🔙 Orqaga bosing:",
          backReplyKb()
        );
      }
      return;
    }

    // New question text — user typed a question
    if (sess?.state === "new_text" && sess.payload?.setId) {
      return onNewQuestionText(chatId, msg.text || "", String(sess.payload.setId));
    }

    // Edit question text — user typed the new text
    if (sess?.state === "edit_text") {
      return onEditQuestionText(chatId, msg.text || "", sess.payload);
    }

    // Unknown text — show main menu
    if (msg.text) {
      return void (await sendMsgWithReplyKb(
        chatId,
        "Botdan foydalanish uchun quyidagi tugmalardan birini bosing 👇",
        mainMenuReplyKb()
      ));
    }
  } catch (e) {
    console.error("[tg-bot] update failed:", e);
  }
}

async function onMenu(chatId: number, name?: string): Promise<void> {
  await sendMsgWithReplyKb(chatId, menuText(name), mainMenuReplyKb());
}
