#!/usr/bin/env node
/**
 * Manually invoke the invoice-status sync endpoint locally — the same route
 * Vercel Cron hits daily in production (which never runs locally). Reads
 * CRON_SECRET from the environment or .env.local and sends it as the Bearer
 * token the route expects.
 *
 *   npm run sync:invoices                 # hits http://localhost:3000
 *   npm run sync:invoices -- https://your-app.vercel.app   # or any base URL
 *
 * Requires the dev server running (`npm run dev`) for the default local URL.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ROUTE = '/api/cron/sync-invoice-status'

/** Minimal .env parser — KEY=VALUE lines, ignores comments/blanks, strips quotes. */
function readEnvFile(path) {
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return {}
  }
  const env = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    env[key] = value
  }
  return env
}

const fileEnv = readEnvFile(join(ROOT, '.env.local'))
const secret = process.env.CRON_SECRET || fileEnv.CRON_SECRET
const baseUrl = (process.argv[2] || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

if (!secret) {
  console.error('✗ CRON_SECRET not found in the environment or .env.local.')
  console.error('  Add `CRON_SECRET=<value>` to .env.local (see docs/DEPLOYMENT.md §3).')
  process.exit(1)
}

const url = `${baseUrl}${ROUTE}`
console.log(`→ POST-equivalent GET ${url}`)

try {
  const res = await fetch(url, { headers: { authorization: `Bearer ${secret}` } })
  const text = await res.text()
  let body
  try {
    body = JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    body = text
  }
  console.log(`← ${res.status} ${res.statusText}`)
  console.log(body)

  if (res.status === 401) {
    console.error('\n✗ Unauthorized — the CRON_SECRET here does not match the one the server loaded.')
    console.error('  Restart the dev server after changing .env.local.')
    process.exit(1)
  }
  process.exit(res.ok ? 0 : 1)
} catch (err) {
  if (err && (err.code === 'ECONNREFUSED' || String(err).includes('ECONNREFUSED'))) {
    console.error(`\n✗ Could not reach ${baseUrl} — is the dev server running? (npm run dev)`)
  } else {
    console.error('\n✗ Request failed:', err?.message ?? err)
  }
  process.exit(1)
}
