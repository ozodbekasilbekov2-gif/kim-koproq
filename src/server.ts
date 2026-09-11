/// <reference types="node" />
// Local / generic Node server
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import app from '../api/lib/app.js'

app.use('/static/*', serveStatic({ root: './public' }))
const port = Number(process.env.PORT || 3000)
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, () => console.log(`listening on :${port}`))
