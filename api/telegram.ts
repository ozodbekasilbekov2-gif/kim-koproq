/// <reference types="node" />
// Telegram webhook endpoint: https://<deployment>/api/telegram
import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleUpdate, webhookSecret } from './lib/telegram-bot.js'
import type { TgUpdate } from './lib/telegram-bot.js'

export const config = { runtime: 'nodejs' }
// Fan-out of 29 question cards is paced (group chats ~1 msg/sec), give it headroom
export const maxDuration = 60

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('[tg-webhook] TELEGRAM_BOT_TOKEN is not set')
    res.statusCode = 500
    res.end('TELEGRAM_BOT_TOKEN is not set')
    return
  }
  if (req.method !== 'POST') {
    res.statusCode = 200
    res.end('kim-koproq telegram webhook is live')
    return
  }
  const secret = req.headers['x-telegram-bot-api-secret-token']
  if (!secret || secret !== webhookSecret(token)) {
    res.statusCode = 401
    res.end('bad secret')
    return
  }
  let body = ''
  for await (const chunk of req) body += chunk
  let update: TgUpdate
  try {
    update = JSON.parse(body) as TgUpdate
  } catch {
    res.statusCode = 200
    res.end('bad json')
    return
  }
  try {
    await handleUpdate(update)
  } catch (e) {
    console.error('[tg-webhook] update failed:', e)
  }
  res.statusCode = 200
  res.end('ok')
}
