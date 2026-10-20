import { http, HttpResponse } from 'msw'
import { afterEach, expect, it, vi } from 'vitest'
import { api, type Identity, onSessionEnded } from '@/api'
import { identityKey } from '@/api/identity'
import { setIdentityChangeHandler } from '@/api/csrf'
import { server, useScenario } from '../../mocks/node'

const denied = (status = 403, name = 'csrf-token-mismatch') =>
  HttpResponse.json(
    { type: `/api/v2/problems/${name}`, title: 'refused', status, requestId: 'a'.repeat(32) },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )
afterEach(() => setIdentityChangeHandler(null))
async function originalIdentity() {
  useScenario('admin-active')
  return (await api.GET('/me')).data!.data
}

it('includes the impersonation instance in the identity key', async () => {
  const identity = await originalIdentity()
  expect(identityKey(identity)).toBe('admin|admin|')
  const acting = { ...identity, impersonation: { id: 'one' } } as Identity
  expect(identityKey(acting)).not.toBe(identityKey(identity))
  expect(identityKey({ ...acting, impersonation: { id: 'two' } } as Identity)).not.toBe(
    identityKey(acting),
  )
})
it('refreshes and rereads identity before replaying the same write once', async () => {
  const identity = await originalIdentity()
  const changed = vi.fn()
  setIdentityChangeHandler({ current: () => identity, changed })
  const requests: string[] = []
  let writes = 0
  server.use(
    http.get('*/api/v2/me', () => {
      requests.push('identity')
      return HttpResponse.json({ data: identity })
    }),
    http.patch('*/api/v2/me/preferences', () => {
      requests.push('write')
      return ++writes === 1
        ? denied()
        : HttpResponse.json({ data: { language: 'en-gb', theme: 'dark', etag: '"2"' } })
    }),
  )
  await api.PATCH('/me/preferences', { body: { theme: 'dark' } })
  expect(requests).toEqual(['write', 'identity', 'write'])
  expect(changed).not.toHaveBeenCalled()
})
it('does not replay a write when the username, role or acting instance changed', async () => {
  const identity = await originalIdentity()
  for (const next of [
    { ...identity, username: 'another' },
    { ...identity, role: 'domainAdmin' as const },
    { ...identity, impersonation: { id: 'new-instance' } } as Identity,
  ]) {
    const changed = vi.fn()
    setIdentityChangeHandler({ current: () => identity, changed })
    const write = vi.fn(() => denied())
    server.use(
      http.patch('*/api/v2/me/preferences', write),
      http.get('*/api/v2/me', () => HttpResponse.json({ data: next })),
    )
    await expect(api.PATCH('/me/preferences', { body: { theme: 'dark' } })).rejects.toMatchObject({
      kind: 'identityChanged',
    })
    expect(write).toHaveBeenCalledTimes(1)
    expect(changed).toHaveBeenCalledWith({ identity: next, refusedWrite: true })
    server.resetHandlers()
  }
})
it('compares against the identity that prepared the write, even if the current cache changes first', async () => {
  const identity = await originalIdentity()
  let current = identity
  const next = { ...identity, username: 'another' }
  const changed = vi.fn()
  setIdentityChangeHandler({ current: () => current, changed })
  const write = vi.fn(() => {
    current = next
    return denied()
  })
  server.use(
    http.patch('*/api/v2/me/preferences', write),
    http.get('*/api/v2/me', () => HttpResponse.json({ data: next })),
  )
  await expect(api.PATCH('/me/preferences', { body: { theme: 'dark' } })).rejects.toMatchObject({
    kind: 'identityChanged',
  })
  expect(write).toHaveBeenCalledTimes(1)
  expect(changed).toHaveBeenCalledTimes(1)
})
it('ends the session when the identity reread is unauthenticated without replaying', async () => {
  const identity = await originalIdentity()
  setIdentityChangeHandler({ current: () => identity, changed: vi.fn() })
  const ended = vi.fn()
  const stop = onSessionEnded(ended)
  const write = vi.fn(() => denied())
  server.use(
    http.patch('*/api/v2/me/preferences', write),
    http.get('*/api/v2/me', () => denied(401, 'unauthenticated')),
  )
  await expect(api.PATCH('/me/preferences', { body: { theme: 'dark' } })).rejects.toMatchObject({
    status: 401,
  })
  expect(write).toHaveBeenCalledTimes(1)
  expect(ended).toHaveBeenCalledTimes(1)
  stop()
})
