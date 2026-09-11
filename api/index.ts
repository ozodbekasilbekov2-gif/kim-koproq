// Vercel serverless entry — static files in /public are served by Vercel directly
import type { IncomingMessage, ServerResponse } from 'node:http'
import app from './lib/app.js'

export const config = { runtime: 'nodejs' }

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const protocol = (req.headers['x-forwarded-proto'] as string) || 'https'
  const host = req.headers.host || 'localhost'
  const url = `${protocol}://${host}${req.url || '/'}`
  const headers = new Headers()

  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  const request = new Request(url, {
    method: req.method || 'GET',
    headers,
    body: hasBody ? (req as unknown as BodyInit) : undefined,
    duplex: hasBody ? 'half' : undefined,
  } as RequestInit)
  const response = await app.fetch(request)

  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  res.end(Buffer.from(await response.arrayBuffer()))
}
