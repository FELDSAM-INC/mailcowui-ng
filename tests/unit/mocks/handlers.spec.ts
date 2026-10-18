// Baseline behaviour of the mock handlers (T026): the anti-forgery token, session states, idle
// timeout, sign-out, identity, public configuration revalidation, failure injection and the
// contract violation answer.
import { describe, expect, it } from 'vitest'

import { mockState, useScenario } from '../../mocks/node'

const api = (path: string) => `${location.origin}/api/v2${path}`

async function csrfToken(): Promise<string> {
  const response = await fetch(api('/csrf-token'))
  const body = (await response.json()) as { data: { token: string } }
  return body.data.token
}

describe('mock API handlers', () => {
  it('creates the anonymous session with GET /csrf-token and keeps the token', async () => {
    const first = await csrfToken()
    expect(first.length).toBeGreaterThanOrEqual(40)
    expect(await csrfToken()).toBe(first)
    const session = await (await fetch(api('/session'))).json()
    expect(session).toEqual({
      data: { state: 'anonymous', pendingActions: [], idleTimeout: 10800 },
    })
  })

  it('reports an active session and the identity of the signed-in account', async () => {
    useScenario('admin-active')
    const session = (await (await fetch(api('/session'))).json()) as {
      data: Record<string, unknown>
    }
    expect(session.data).toMatchObject({ state: 'active', username: 'admin', role: 'admin' })
    const identity = (await (await fetch(api('/me'))).json()) as { data: Record<string, unknown> }
    expect(identity.data).toMatchObject({
      username: 'admin',
      role: 'admin',
      scope: { type: 'allDomains' },
    })
  })

  it('answers 401 unauthenticated for /me without a session', async () => {
    const response = await fetch(api('/me'))
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ type: '/api/v2/problems/unauthenticated' })
  })

  it('ends the session after the idle timeout', async () => {
    const state = useScenario('admin-active', { idleTimeout: 60 })
    state.session.lastActivityAt = Date.now() - 61_000
    const response = await fetch(api('/me'))
    expect(response.status).toBe(401)
    expect(mockState().session.state).toBe('anonymous')
  })

  it('renews the idle timer on every answer except 401', async () => {
    const state = useScenario('admin-active', { idleTimeout: 60 })
    state.session.lastActivityAt = Date.now() - 30_000
    await fetch(api('/me'))
    expect(Date.now() - mockState().session.lastActivityAt).toBeLessThan(1000)
  })

  it('signs out with the right token and refuses a wrong one', async () => {
    useScenario('admin-active')
    const tokenValue = await csrfToken()
    const refused = await fetch(api('/session'), {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': 'wrong' },
    })
    expect(refused.status).toBe(403)
    expect(await refused.json()).toMatchObject({ type: '/api/v2/problems/csrf-token-mismatch' })
    const done = await fetch(api('/session'), {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': tokenValue },
    })
    expect(done.status).toBe(204)
    expect(mockState().session.state).toBe('anonymous')
  })

  it('revalidates the public configuration with its ETag', async () => {
    const first = await fetch(api('/public-config'))
    const etag = first.headers.get('ETag')
    expect(first.headers.get('Cache-Control')).toBe('no-cache')
    expect(etag).toBeTruthy()
    const second = await fetch(api('/public-config'), { headers: { 'If-None-Match': etag ?? '' } })
    expect(second.status).toBe(304)
  })

  it('serves the operator logos as SVG', async () => {
    const response = await fetch(api('/public-config/logos/light?v=5f3c1a9e0b7d4c21'))
    expect(response.headers.get('Content-Type')).toBe('image/svg+xml')
    expect(response.headers.get('Cache-Control')).toContain('immutable')
  })

  it('injects documented failures by operationId', async () => {
    useScenario('bootstrap-500')
    expect((await fetch(api('/session'))).status).toBe(500)
    useScenario('anonymous-default', { failures: { getSession: { status: 500, times: 1 } } })
    expect((await fetch(api('/session'))).status).toBe(500)
    expect((await fetch(api('/session'))).status).toBe(200)
  })

  it('answers a request outside the contract with a recorded violation', async () => {
    const response = await fetch(api('/unknown'))
    expect(response.status).toBe(500)
    expect(response.headers.get('X-Mock-Contract-Violation')).toBe('1')
    expect(mockState().violations.list()).toHaveLength(1)
    mockState().violations.clear()
  })

  it('records requests with secrets redacted', async () => {
    useScenario('admin-active')
    const tokenValue = await csrfToken()
    await fetch(api('/session'), { method: 'DELETE', headers: { 'X-CSRF-Token': tokenValue } })
    const deleted = mockState().requests.find((r) => r.operationId === 'deleteSession')
    expect(deleted?.status).toBe(204)
    expect(deleted?.headers['x-csrf-token']).toBe(tokenValue)
  })
})
