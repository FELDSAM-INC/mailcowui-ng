// The typed API client (research R7, R8): openapi-fetch over the generated `paths`, same origin,
// with middleware for cache modes, the anti-forgery token (one silent refresh and replay),
// activity recording and problem details. Requests have no client-side timeout (FR-017), and the
// app never authenticates with an API key (FR-070).
import createClient, { type Middleware } from 'openapi-fetch'

import { recordActivity } from './activity'
import {
  ensureCsrfToken,
  refreshCsrfToken,
  setCsrfFetcher,
  requestIdentityKey,
  refuseChangedIdentity,
} from './csrf'
import type { paths } from './generated/schema'
import { ApiProblem, peekProblemName, problemFromResponse } from './problem'

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const CSRF_HEADER = 'X-CSRF-Token'

/** UI 012: why the session ended, when it was not a plain `unauthenticated` (FR-052). */
export type SessionEndReason = 'identityProviderSessionEnded'
type SessionEndedListener = (reason?: SessionEndReason) => void
const sessionEndedListeners = new Set<SessionEndedListener>()

/**
 * Subscribes to the session-ended signal: a write refused twice for its token, or refused as
 * unauthenticated (or, UI 012, as `identity-provider-session-ended`) after the refresh.
 */
export function onSessionEnded(listener: SessionEndedListener): () => void {
  sessionEndedListeners.add(listener)
  return () => sessionEndedListeners.delete(listener)
}

function emitSessionEnded(reason?: SessionEndReason): void {
  for (const listener of [...sessionEndedListeners]) listener(reason)
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

const replayClones = new Map<string, { request: Request; owner: string | null }>()

const csrfMiddleware: Middleware = {
  onError({ id }) {
    // A failed transport has no response hook; do not retain cloned request bodies.
    replayClones.delete(id)
  },
  async onRequest({ request, id }) {
    if (!UNSAFE_METHODS.has(request.method)) return undefined
    const owner = requestIdentityKey()
    const token = await ensureCsrfToken()
    const headers = new Headers(request.headers)
    headers.set(CSRF_HEADER, token)
    const withToken = new Request(request, { headers })
    replayClones.set(id, { request: withToken.clone(), owner })
    return withToken
  },
  async onResponse({ response, id, options }) {
    const saved = replayClones.get(id)
    replayClones.delete(id)
    if (!saved || response.status !== 403) return undefined
    if ((await peekProblemName(response)) !== 'csrf-token-mismatch') return undefined

    // UI007 R5: the cloned write belongs to the identity that prepared it. Refreshing a
    // token alone must never allow that write to run as another account.
    const token = await refreshCsrfToken()
    let identity
    try {
      identity = requireData(await api.GET('/me')).data
    } catch (error) {
      if (error instanceof ApiProblem && error.status === 401)
        emitSessionEnded(
          error.is('identity-provider-session-ended') ? 'identityProviderSessionEnded' : undefined,
        )
      throw error
    }
    if (await refuseChangedIdentity(saved.owner, identity))
      throw ApiProblem.fromParts({ kind: 'identityChanged' })
    const clone = saved.request
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
    } else if (replay.status === 401 && name === 'identity-provider-session-ended') {
      emitSessionEnded('identityProviderSessionEnded')
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
