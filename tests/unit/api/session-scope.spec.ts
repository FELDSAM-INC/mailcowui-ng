import { http, HttpResponse } from 'msw'
import type { Middleware } from 'openapi-fetch'
import { expect, it, vi } from 'vitest'

import {
  api,
  currentCsrfToken,
  refreshCsrfToken,
  requireData,
  setCsrfToken,
  setSessionReactions,
} from '@/api'
import { invalidateSessionScope } from '@/api/session-scope'
import { server } from '../../mocks/node'

it('checks the original owner again at transport dispatch after CSRF preparation', async () => {
  let release!: () => void
  let reached!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const prepared = new Promise<void>((resolve) => {
    reached = resolve
  })
  const gate: Middleware = {
    async onRequest() {
      reached()
      await pending
    },
  }
  const send = vi.fn(() => new HttpResponse(null, { status: 204 }))
  server.use(http.delete('*/api/v2/session', send))
  setCsrfToken('original-token')
  api.use(gate)
  try {
    const old = api.DELETE('/session').catch((error: unknown) => error)
    await prepared
    invalidateSessionScope()
    setCsrfToken('replacement-token')
    release()
    expect(await old).toMatchObject({ kind: 'identityChanged' })
    expect(send).not.toHaveBeenCalled()
  } finally {
    api.eject(gate)
  }
})

it.each(['success', 'impersonation-ended'])(
  'discards an old %s response whose body finishes after an identity switch',
  async (outcome) => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    const reading = vi.fn()
    const impersonationEnded = vi.fn()
    setSessionReactions({
      impersonationEnded,
      unauthenticated: vi.fn(),
      forbidden: vi.fn(),
      secondFactorRequired: vi.fn(),
      pendingActionRequired: vi.fn(),
    })
    const body = new ReadableStream<Uint8Array>(
      {
        async pull(controller) {
          reading()
          await pending
          const value =
            outcome === 'success'
              ? { data: { username: 'old-account' } }
              : { type: '/api/v2/problems/impersonation-ended', status: 403 }
          controller.enqueue(new TextEncoder().encode(JSON.stringify(value)))
          controller.close()
        },
      },
      { highWaterMark: 0 },
    )
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(body, {
        status: outcome === 'success' ? 200 : 403,
        headers: {
          'Content-Type': outcome === 'success' ? 'application/json' : 'application/problem+json',
        },
      }),
    )
    const old = api
      .GET('/me')
      .then(requireData)
      .catch((error: unknown) => error)
    await vi.waitFor(() => expect(reading).toHaveBeenCalledOnce())
    invalidateSessionScope()
    release()
    expect(await old).toMatchObject({ kind: 'identityChanged' })
    expect(impersonationEnded).not.toHaveBeenCalled()
    setSessionReactions(null)
  },
)

it('never sends an old write with a new token when the identity changes during request preparation', async () => {
  const send = vi.fn(() => new HttpResponse(null, { status: 204 }))
  server.use(http.delete('*/api/v2/session', send))
  setCsrfToken('original-token')
  const old = api.DELETE('/session').catch((error: unknown) => error)
  invalidateSessionScope()
  setCsrfToken('replacement-token')
  expect(await old).toMatchObject({ kind: 'identityChanged' })
  expect(send).not.toHaveBeenCalled()
})

it('does not reuse an old pending token request or let it overwrite the replacement token', async () => {
  let release!: () => void
  const first = new Promise<void>((resolve) => {
    release = resolve
  })
  const received = vi.fn()
  server.use(
    http.get('*/api/v2/csrf-token', async () => {
      received()
      if (received.mock.calls.length === 1) {
        await first
        return HttpResponse.json({ data: { token: 'old-token' } })
      }
      return HttpResponse.json({ data: { token: 'replacement-token' } })
    }),
  )
  const old = refreshCsrfToken().catch((error: unknown) => error)
  await vi.waitFor(() => expect(received).toHaveBeenCalledOnce())
  invalidateSessionScope()
  expect(await refreshCsrfToken()).toBe('replacement-token')
  release()
  expect(await old).toMatchObject({ kind: 'identityChanged' })
  expect(currentCsrfToken()).toBe('replacement-token')
  expect(received).toHaveBeenCalledTimes(2)
})

it('discards a late impersonation-ended response before middleware can switch the new account', async () => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const received = vi.fn()
  const impersonationEnded = vi.fn()
  setSessionReactions({
    impersonationEnded,
    unauthenticated: vi.fn(),
    forbidden: vi.fn(),
    secondFactorRequired: vi.fn(),
    pendingActionRequired: vi.fn(),
  })
  server.use(
    http.get('*/api/v2/me', async () => {
      received()
      await pending
      return HttpResponse.json(
        { type: '/api/v2/problems/impersonation-ended', status: 403 },
        {
          status: 403,
          headers: { 'Content-Type': 'application/problem+json' },
        },
      )
    }),
  )
  const old = api.GET('/me').catch((error: unknown) => error)
  await vi.waitFor(() => expect(received).toHaveBeenCalledOnce())
  invalidateSessionScope()
  release()
  expect(await old).toMatchObject({ kind: 'identityChanged' })
  expect(impersonationEnded).not.toHaveBeenCalled()
  setSessionReactions(null)
})
