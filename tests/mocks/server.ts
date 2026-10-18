// Node mock server (T028, research R22): serves /api/v2/* and mailcow's /lang/*.json from the same
// handlers as Vitest, for
// `npm run dev:mock`, `npm run preview:mock`, the end-to-end tests and Lighthouse.
//
// Scenario selection: the `mock-scenario` cookie holds either the ID of a scenario created through
// `POST /__mock/scenarios` (end-to-end tests: isolated per test, shared by the test's tabs) or a
// scenario name (manual use: one shared instance per name). Without a cookie the server uses
// MOCK_DEFAULT_SCENARIO (default `anonymous-default`).
//
// Control endpoints:
//   GET    /__mock/health
//   POST   /__mock/scenarios                  { name, overrides }  -> 201 { id }
//   PATCH  /__mock/scenarios/:id              ScenarioPatch        -> 200 { id }
//          (UI 002 adds `domains`, `templates` and `footers` mutations, `capabilities`,
//          `domainFailures`, `delays`, `creationReport` and `domainAssignments`)
//   GET    /__mock/scenarios/:id/violations                        -> { violations }
//   GET    /__mock/scenarios/:id/requests                          -> { requests }
//   DELETE /__mock/scenarios/:id
//   GET    /__mock/use?scenario=<name>&redirect=<url>              sets the cookie, redirects
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { gzipSync } from 'node:zlib'

import { getResponse } from 'msw'

import { createHandlers } from './handlers'
import {
  applyOverrides,
  createScenarioState,
  scenarios,
  type ScenarioOverrides,
  type ScenarioPatch,
  type ScenarioState,
} from './scenarios'

const port = Number(process.env.MOCK_PORT ?? 4010)
const host = process.env.MOCK_HOST ?? '127.0.0.1'
const defaultScenario = process.env.MOCK_DEFAULT_SCENARIO ?? 'anonymous-default'
const SCENARIO_COOKIE = 'mock-scenario'
const MAX_AGE_MS = 2 * 60 * 60_000

if (!scenarios[defaultScenario]) {
  console.error(`Unknown MOCK_DEFAULT_SCENARIO "${defaultScenario}"`)
  process.exit(1)
}

const byId = new Map<string, { state: ScenarioState; createdAt: number }>()
const byName = new Map<string, ScenarioState>()

function cookies(header: string | null): Record<string, string> {
  const result: Record<string, string> = {}
  for (const part of (header ?? '').split(';')) {
    const [name, ...value] = part.trim().split('=')
    if (name) result[name] = decodeURIComponent(value.join('='))
  }
  return result
}

function stateFor(request: Request): ScenarioState {
  const selected = cookies(request.headers.get('cookie'))[SCENARIO_COOKIE]
  if (selected) {
    const created = byId.get(selected)
    if (created) return created.state
  }
  const name = selected && scenarios[selected] ? selected : defaultScenario
  let state = byName.get(name)
  if (!state) {
    state = createScenarioState(name)
    byName.set(name, state)
  }
  return state
}

const handlers = createHandlers(stateFor)

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

function prune(): void {
  const now = Date.now()
  for (const [id, entry] of byId) if (now - entry.createdAt > MAX_AGE_MS) byId.delete(id)
}

async function control(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const parts = url.pathname.split('/').filter(Boolean) // ['__mock', ...]
  if (parts[1] === 'health') return sendJson(res, 200, { status: 'ok' })

  if (parts[1] === 'use' && req.method === 'GET') {
    const name = url.searchParams.get('scenario') ?? ''
    if (!scenarios[name]) return sendJson(res, 404, { error: `Unknown scenario "${name}"` })
    byName.delete(name) // a fresh instance for a deliberate switch
    res.writeHead(302, {
      'Set-Cookie': `${SCENARIO_COOKIE}=${encodeURIComponent(name)}; Path=/; SameSite=Lax`,
      Location: url.searchParams.get('redirect') ?? 'http://localhost:4173/ng/',
    })
    return void res.end()
  }

  if (parts[1] !== 'scenarios') return sendJson(res, 404, { error: 'Unknown control endpoint' })
  const id = parts[2]
  if (!id && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}') as {
      name?: string
      overrides?: ScenarioOverrides
    }
    if (!body.name || !scenarios[body.name]) {
      return sendJson(res, 404, { error: `Unknown scenario "${body.name ?? ''}"` })
    }
    prune()
    try {
      const state = createScenarioState(body.name, body.overrides ?? {})
      byId.set(state.id, { state, createdAt: Date.now() })
      return sendJson(res, 201, { id: state.id })
    } catch (error) {
      return sendJson(res, 400, { error: String(error) })
    }
  }
  const entry = id ? byId.get(id) : undefined
  if (!entry) return sendJson(res, 404, { error: `Unknown scenario id "${id ?? ''}"` })
  if (req.method === 'PATCH' && parts.length === 3) {
    const patch = JSON.parse((await readBody(req)).toString('utf8') || '{}') as ScenarioPatch
    try {
      applyOverrides(entry.state, patch)
    } catch (error) {
      return sendJson(res, 400, { error: String(error) })
    }
    return sendJson(res, 200, { id })
  }
  if (req.method === 'DELETE' && parts.length === 3) {
    byId.delete(entry.state.id)
    return sendJson(res, 200, { id })
  }
  if (req.method === 'GET' && parts[3] === 'violations') {
    return sendJson(res, 200, { violations: entry.state.violations.list() })
  }
  if (req.method === 'GET' && parts[3] === 'requests') {
    return sendJson(res, 200, { requests: entry.state.requests })
  }
  return sendJson(res, 404, { error: 'Unknown control endpoint' })
}

async function api(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const method = req.method ?? 'GET'
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req)
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item)
  }
  const request = new Request(url, {
    method,
    headers,
    body: body && body.length > 0 ? new Uint8Array(body) : undefined,
  })
  const response = await getResponse(handlers, request)
  if (!response) return sendJson(res, 404, { error: 'No mock handler' })
  const outgoing: Record<string, string> = {}
  response.headers.forEach((value, name) => {
    outgoing[name] = value
  })
  let payload = Buffer.from(await response.arrayBuffer())
  // mailcow's nginx gzips the language files (`gzip_types … application/json`); so does the mock,
  // so that Lighthouse measures a realistic transfer.
  if (url.pathname.startsWith('/lang/') && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
    payload = gzipSync(payload)
    outgoing['content-encoding'] = 'gzip'
    outgoing.vary = 'Accept-Encoding'
  }
  res.writeHead(response.status, outgoing)
  res.end(payload)
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `${host}:${port}`}`)
  const handle = url.pathname.startsWith('/__mock/')
    ? control(req, res, url)
    : url.pathname.startsWith('/api/v2/') || url.pathname.startsWith('/lang/')
      ? api(req, res, url)
      : Promise.resolve(sendJson(res, 404, { error: 'Not a mock API address' }))
  handle.catch((error: unknown) => {
    console.error(error)
    if (!res.headersSent) sendJson(res, 500, { error: 'Mock server error' })
    else res.end()
  })
})

server.listen(port, host, () => {
  console.log(`mock API on http://${host}:${port}/api/v2 (default scenario ${defaultScenario})`)
})

const stop = () => server.close(() => process.exit(0))
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
