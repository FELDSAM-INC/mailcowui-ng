// The typed API client (research R7, R8): openapi-fetch over the generated `paths`, same origin,
// with middleware for cache modes, the anti-forgery token (one silent refresh and replay),
// activity recording and problem details. Requests have no client-side timeout (FR-017), and the
// app never authenticates with an API key (FR-070).
import createClient, { type Middleware } from 'openapi-fetch'

import { recordActivity } from './activity'
import { ensureCsrfToken, refreshCsrfToken, setCsrfFetcher } from './csrf'
import type { paths } from './generated/schema'
import { ApiProblem, peekProblemName, problemFromResponse } from './problem'

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const CSRF_HEADER = 'X-CSRF-Token'

type SessionEndedListener = () => void
const sessionEndedListeners = new Set<SessionEndedListener>()

/** Subscribes to the session-ended signal: a write refused twice for its token, or refused as unauthenticated after the refresh. */
export function onSessionEnded(listener: SessionEndedListener): () => void {
  sessionEndedListeners.add(listener)
  return () => sessionEndedListeners.delete(listener)
}

function emitSessionEnded(): void {
  for (const listener of [...sessionEndedListeners]) listener()
}

function apiBaseUrl(): string {
  return `${globalThis.location?.origin ?? ''}/api/v2`
}

/** `no-store` for everything except the public configuration, which revalidates with its ETag. */
const cacheMiddleware: Middleware = {
  onRequest({ request, schemaPath }) {
    return new Request(request, {
      cache: schemaPath === '/public-config' ? 'no-cache' : 'no-store',
    })
  },
}

const replayClones = new Map<string, Request>()

const csrfMiddleware: Middleware = {
  async onRequest({ request, id }) {
    if (!UNSAFE_METHODS.has(request.method)) return undefined
    const token = await ensureCsrfToken()
    const headers = new Headers(request.headers)
    headers.set(CSRF_HEADER, token)
    const withToken = new Request(request, { headers })
    replayClones.set(id, withToken.clone())
    return withToken
  },
  async onResponse({ response, id, options }) {
    const clone = replayClones.get(id)
    replayClones.delete(id)
    if (!clone || response.status !== 403) return undefined
    if ((await peekProblemName(response)) !== 'csrf-token-mismatch') return undefined

    // FR-035: fetch a new token and replay the original request once, with its original body.
    const token = await refreshCsrfToken()
    const headers = new Headers(clone.headers)
    headers.set(CSRF_HEADER, token)
    let replay: Response
    try {
      replay = await options.fetch(new Request(clone, { headers }))
    } catch (error) {
      throw ApiProblem.fromParts({ kind: 'network', cause: error })
    }
    const name = await peekProblemName(replay)
    if (
      (replay.status === 403 && name === 'csrf-token-mismatch') ||
      (replay.status === 401 && name === 'unauthenticated')
    ) {
      emitSessionEnded()
    }
    return replay
  },
}

const activityMiddleware: Middleware = {
  async onResponse({ response }) {
    if (response.status === 401 && (await peekProblemName(response)) === 'unauthenticated') {
      return undefined
    }
    recordActivity()
    return undefined
  },
}

const problemMiddleware: Middleware = {
  async onResponse({ response }) {
    if (response.status >= 400) throw await problemFromResponse(response)
    return undefined
  },
  onError({ error }) {
    return error instanceof ApiProblem
      ? error
      : ApiProblem.fromParts({ kind: 'network', cause: error })
  },
}

export const api = createClient<paths>({
  baseUrl: apiBaseUrl(),
  credentials: 'same-origin',
  // Resolved per call, so test doubles and interceptors installed later still apply.
  fetch: (request: Request) => globalThis.fetch(request),
})

// openapi-fetch runs onRequest in this order and onResponse in reverse: the token replay sees the
// raw answer first, then activity is recorded, then errors become ApiProblem.
api.use(problemMiddleware, activityMiddleware, cacheMiddleware, csrfMiddleware)

setCsrfFetcher(async () => {
  const { data } = await api.GET('/csrf-token')
  if (!data) throw ApiProblem.fromParts({ kind: 'problem', status: 200 })
  return data.data.token
})

/** The `data` of a successful call; calls that fail throw ApiProblem before this point. */
export function requireData<T>(result: { data?: T; response: Response }): T {
  if (result.data === undefined) {
    throw ApiProblem.fromParts({ kind: 'problem', status: result.response.status })
  }
  return result.data
}
