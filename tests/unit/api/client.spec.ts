// The API client (research R7, R8): CSRF handling with one silent retry, problem details, activity
// recording, cache modes, and no API keys and no client-side timeout.
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  api,
  ApiProblem,
  clearCsrfToken,
  currentCsrfToken,
  ensureCsrfToken,
  onActivity,
  onSessionEnded,
  problemName,
} from '@/api'

import { mockState, server, useScenario } from '../../mocks/node'

const API = '*/api/v2'

function problemResponse(status: number, type: string, extra: Record<string, unknown> = {}) {
  return HttpResponse.json(
    { type: `/api/v2/problems/${type}`, title: 'x', status, requestId: 'a'.repeat(32), ...extra },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

beforeEach(() => {
  clearCsrfToken()
})

afterEach(() => {
  clearCsrfToken()
})

describe('CSRF token', () => {
  it('sends X-CSRF-Token on POST, PATCH and DELETE only', async () => {
    useScenario('admin-active')
    await api.GET('/session')
    await api.DELETE('/session')
    const requests = mockState().requests
    const get = requests.find((r) => r.operationId === 'getSession')
    const del = requests.find((r) => r.operationId === 'deleteSession')
    expect(get?.headers['x-csrf-token']).toBeUndefined()
    // Signing out discards the server's token, so compare with the one the client holds.
    expect(del?.headers['x-csrf-token']).toBe(currentCsrfToken())
    expect(del?.status).toBe(204)
  })

  it('fetches the token once under concurrent writes (single flight)', async () => {
    useScenario('admin-active')
    // Writes that keep the session, so that no write sees a token the server discarded.
    server.use(http.delete(`${API}/session`, () => new HttpResponse(null, { status: 204 })))
    await Promise.all([api.DELETE('/session'), api.DELETE('/session'), ensureCsrfToken()])
    const tokenFetches = mockState().requests.filter((r) => r.operationId === 'getCsrfToken')
    expect(tokenFetches).toHaveLength(1)
  })

  it('refreshes the token silently once after csrf-token-mismatch and replays the original body', async () => {
    useScenario('admin-active')
    await ensureCsrfToken()
    const original = mockState().session.csrfToken
    // The server's session token changes (for example after it expired and was renewed).
    mockState().session.csrfToken = 'b'.repeat(48)
    const bodies: unknown[] = []
    server.use(
      http.patch(`${API}/me/preferences`, async ({ request }) => {
        bodies.push(await request.json())
        if (request.headers.get('x-csrf-token') !== mockState().session.csrfToken) {
          return problemResponse(403, 'csrf-token-mismatch')
        }
        return HttpResponse.json(
          { data: { language: 'cs-cz', theme: 'dark', etag: '"2"' } },
          { headers: { ETag: '"2"' } },
        )
      }),
    )
    const { data } = await api.PATCH('/me/preferences', {
      params: { header: { 'If-Match': '"1"' } },
      body: { theme: 'dark' },
      headers: { 'Content-Type': 'application/merge-patch+json' },
    })
    expect(data?.data.theme).toBe('dark')
    expect(bodies).toEqual([{ theme: 'dark' }, { theme: 'dark' }])
    expect(original).not.toBe(mockState().session.csrfToken)
    expect(mockState().requests.filter((r) => r.operationId === 'getCsrfToken')).toHaveLength(2)
  })

  it('treats a second mismatch as the end of the session', async () => {
    useScenario('admin-active')
    const ended = vi.fn()
    const stop = onSessionEnded(ended)
    server.use(http.delete(`${API}/session`, () => problemResponse(403, 'csrf-token-mismatch')))
    await expect(api.DELETE('/session')).rejects.toMatchObject({
      kind: 'problem',
      status: 403,
      type: '/api/v2/problems/csrf-token-mismatch',
    })
    expect(ended).toHaveBeenCalledTimes(1)
    stop()
  })

  it('treats unauthenticated on the replay as the end of the session', async () => {
    useScenario('admin-active')
    const ended = vi.fn()
    const stop = onSessionEnded(ended)
    let calls = 0
    server.use(
      http.delete(`${API}/session`, () => {
        calls += 1
        return calls === 1
          ? problemResponse(403, 'csrf-token-mismatch')
          : problemResponse(401, 'unauthenticated')
      }),
    )
    await expect(api.DELETE('/session')).rejects.toBeInstanceOf(ApiProblem)
    expect(calls).toBe(2)
    expect(ended).toHaveBeenCalledTimes(1)
    stop()
  })
  it('reports a network failure of the replay as kind network', async () => {
    useScenario('admin-active')
    let calls = 0
    server.use(
      http.delete(`${API}/session`, () => {
        calls += 1
        return calls === 1 ? problemResponse(403, 'csrf-token-mismatch') : HttpResponse.error()
      }),
    )
    await expect(api.DELETE('/session')).rejects.toMatchObject({ kind: 'network' })
    expect(calls).toBe(2)
  })
})

describe('problems', () => {
  it('turns problem+json into an ApiProblem with field errors and the request ID', async () => {
    server.use(
      http.post(`${API}/session`, () =>
        problemResponse(422, 'validation-failed', {
          errors: {
            username: [{ code: 'tooLong', params: { max: 255 }, message: 'Too long' }],
            'allowedNetworks.2': [
              { code: 'invalidFormat', params: { format: 'ipNetwork' }, message: 'x' },
            ],
          },
        }),
      ),
    )
    const error = await api
      .POST('/session', { body: { username: 'a', password: 'b' } })
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiProblem)
    const problem = error as ApiProblem
    expect(problem.kind).toBe('problem')
    expect(problem.status).toBe(422)
    expect(problem.problemName).toBe('validation-failed')
    expect(problem.requestId).toBe('a'.repeat(32))
    expect(problem.fieldErrors.get('username')?.[0]?.code).toBe('tooLong')
    expect(problem.fieldErrors.get('allowedNetworks.2')?.[0]?.params).toEqual({
      format: 'ipNetwork',
    })
  })

  it('reads retryAfter, pendingActions and the server Date', async () => {
    server.use(
      http.post(`${API}/session`, () =>
        HttpResponse.json(
          {
            type: '/api/v2/problems/too-many-requests',
            title: 'x',
            status: 429,
            requestId: 'b'.repeat(32),
            retryAfter: 105,
          },
          {
            status: 429,
            headers: {
              'Content-Type': 'application/problem+json',
              'Retry-After': '105',
              Date: 'Sun, 18 Oct 2026 12:00:00 GMT',
            },
          },
        ),
      ),
      http.get(`${API}/me`, () =>
        problemResponse(403, 'pending-action-required', { pendingActions: ['passwordChange'] }),
      ),
    )
    const throttled = (await api
      .POST('/session', { body: { username: 'a', password: 'b' } })
      .catch((e: unknown) => e)) as ApiProblem
    expect(throttled.retryAfter).toBe(105)
    expect(throttled.serverDate?.toISOString()).toBe('2026-10-18T12:00:00.000Z')
    const pending = (await api.GET('/me').catch((e: unknown) => e)) as ApiProblem
    expect(pending.pendingActions).toEqual(['passwordChange'])
  })

  it('reports a network error as kind network', async () => {
    server.use(http.get(`${API}/session`, () => HttpResponse.error()))
    await expect(api.GET('/session')).rejects.toMatchObject({ kind: 'network', status: null })
  })

  it('reports a non-problem response of 500 or more (an HTML 502) as kind unavailable', async () => {
    server.use(
      http.get(
        `${API}/session`,
        () =>
          new HttpResponse('<html>Bad Gateway</html>', {
            status: 502,
            headers: { 'Content-Type': 'text/html' },
          }),
      ),
    )
    await expect(api.GET('/session')).rejects.toMatchObject({ kind: 'unavailable', status: 502 })
  })

  it('treats a 419 as a generic problem without special handling', async () => {
    const ended = vi.fn()
    const stop = onSessionEnded(ended)
    server.use(
      http.post(`${API}/session`, () =>
        HttpResponse.json(
          { type: 'about:blank', title: 'x', status: 419, requestId: 'c'.repeat(32) },
          { status: 419, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    const problem = (await api
      .POST('/session', { body: { username: 'a', password: 'b' } })
      .catch((e: unknown) => e)) as ApiProblem
    expect(problem.kind).toBe('problem')
    expect(problem.status).toBe(419)
    expect(problem.problemName).toBeNull()
    expect(mockState().requests.filter((r) => r.operationId === 'getCsrfToken')).toHaveLength(1)
    expect(ended).not.toHaveBeenCalled()
    stop()
  })

  it('takes the problem name from the last path segment', () => {
    expect(problemName('/api/v2/problems/sign-in-failed')).toBe('sign-in-failed')
    expect(problemName('about:blank')).toBeNull()
    expect(problemName(null)).toBeNull()
  })
})

describe('activity, cache modes and headers', () => {
  it('records activity for every response except 401 unauthenticated', async () => {
    const activity = vi.fn()
    const stop = onActivity(activity)
    await api.GET('/session')
    expect(activity).toHaveBeenCalledTimes(1)
    await api.GET('/me').catch(() => undefined)
    expect(activity).toHaveBeenCalledTimes(1)
    server.use(http.get(`${API}/me`, () => problemResponse(401, 'second-factor-required')))
    await api.GET('/me').catch(() => undefined)
    expect(activity).toHaveBeenCalledTimes(2)
    stop()
  })

  it("uses cache 'no-store', except 'no-cache' for getPublicConfig", async () => {
    // MSW's interceptor rebuilds the request without its cache mode, so read what the client
    // hands to fetch.
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await api.GET('/session')
    await api.GET('/public-config')
    const modes = new Map(
      fetchSpy.mock.calls.map(([input]) => {
        const request = input as Request
        return [new URL(request.url).pathname, request.cache] as const
      }),
    )
    expect(modes.get('/api/v2/session')).toBe('no-store')
    expect(modes.get('/api/v2/public-config')).toBe('no-cache')
  })

  it('never sends X-API-Key and sets no client-side timeout', async () => {
    useScenario('admin-active')
    const seen: { key: string | null; signalAborted: boolean }[] = []
    server.events.on('request:start', ({ request }) => {
      seen.push({ key: request.headers.get('x-api-key'), signalAborted: request.signal.aborted })
    })
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const pending = api.GET('/me')
    vi.advanceTimersByTime(10 * 60_000)
    vi.useRealTimers()
    await pending
    await api.DELETE('/session')
    server.events.removeAllListeners()
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.every((entry) => entry.key === null && !entry.signalAborted)).toBe(true)
  })
})
