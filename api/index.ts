// Vercel serverless entry — static files in /public are served by Vercel directly
import { handle } from 'hono/vercel'
import app from './lib/app.js'

export const config = { runtime: 'nodejs' }
export default handle(app)
