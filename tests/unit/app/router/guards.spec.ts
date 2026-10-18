// The session state machine in the router guard (FR-030, FR-031, FR-045, FR-050, research R11).
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createQueryClient, queryKeys, type Identity } from '@/api'
import { installGuards, routeAccess } from '@/app/router/guards'
import { useSessionStore } from '@/app/session/store'

import { mockState, useScenario } from '../../../mocks/node'
import type { ScenarioOverrides } from '../../../mocks/scenarios'
import { createTestRouter } from '../../support/router'

function setup() {
  const queryClient = createQueryClient({ retryDelay: 0 })
  const router = createTestRouter()
  installGuards(router, { queryClient })
  return { queryClient, router }
}

const pending = {
  session: {
    state: 'pendingSecondFactor' as const,
    pendingSignIn: { username: 'alice@example.org', role: null, expiresAt: '2099-01-01T00:00:00Z' },
  },
}

const where = (router: ReturnType<typeof createTestRouter>) => ({
  name: router.currentRoute.value.name,
  query: router.currentRoute.value.query,
})

afterEach(() => {
  vi.useRealTimers()
})

describe('anonymous', () => {
  beforeEach(() => useScenario('anonymous-default'))

  it('sends app routes to sign-in with returnTo', async () => {
    const { router } = setup()
    await router.push('/api-keys/new?x=1')
    expect(where(router)).toEqual({ name: 'sign-in', query: { returnTo: '/api-keys/new?x=1' } })
  })

  it('omits returnTo for the home screen', async () => {
    const { router } = setup()
    await router.push('/')
    expect(where(router)).toEqual({ name: 'sign-in', query: {} })
  })

  it('allows the sign-in routes and the not-found page', async () => {
    const { router } = setup()
    await router.push('/sign-in/admin')
    expect(router.currentRoute.value.name).toBe('sign-in-admin')
    await router.push('/no/such/page')
    expect(router.currentRoute.value.name).toBe('not-found')
  })

  it('never fetches the identity', async () => {
    const { router } = setup()
    await router.push('/domains')
    expect(mockState().requests.some((r) => r.operationId === 'getIdentity')).toBe(false)
  })
})

describe('pending second factor (FR-029)', () => {
  beforeEach(() => useScenario('anonymous-default', pending))

  it('resumes the second-factor step from any address and carries returnTo', async () => {
    const { router } = setup()
    await router.push('/domains')
    expect(where(router)).toEqual({
      name: 'sign-in-second-factor',
      query: { returnTo: '/domains' },
    })
    await router.push('/sign-in?returnTo=%2Fapi-keys')
    expect(where(router)).toEqual({
      name: 'sign-in-second-factor',
      query: { returnTo: '/api-keys' },
    })
  })
})

describe('restricted (FR-038)', () => {
  beforeEach(() => useScenario('anonymous-default', { signedInAs: 'bob@example.org' }))

  it('shows only the pending-actions screen', async () => {
    const { router } = setup()
    await router.push('/domains')
    expect(router.currentRoute.value.name).toBe('pending-actions')
    await router.push('/no/such/page')
    expect(router.currentRoute.value.name).toBe('pending-actions')
  })
})

describe('active', () => {
  beforeEach(() => useScenario('admin-active'))

  it('opens shell routes', async () => {
    const { router } = setup()
    await router.push('/domains')
    expect(router.currentRoute.value.name).toBe('placeholder-domains')
  })

  it('sends sign-in routes to returnTo, or home (FR-031)', async () => {
    const { router } = setup()
    await router.push('/sign-in?returnTo=%2Fapi-keys%2Fnew')
    expect(router.currentRoute.value.fullPath).toBe('/api-keys/new')
    await router.push('/sign-in/admin?returnTo=https%3A%2F%2Fevil.example')
    expect(router.currentRoute.value.fullPath).toBe('/')
    await router.push('/sign-in/second-factor')
    expect(router.currentRoute.value.fullPath).toBe('/')
    await router.push('/pending-actions')
    expect(router.currentRoute.value.fullPath).toBe('/')
  })

  it('uses the returnTo kept by a session end', async () => {
    const { router } = setup()
    useSessionStore().returnTo = '/audit-log'
    await router.push('/sign-in')
    expect(router.currentRoute.value.fullPath).toBe('/audit-log')
    expect(useSessionStore().returnTo).toBeNull()
  })

  it('refetches the identity only when it is older than 5 minutes (FR-050)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { router, queryClient } = setup()
    await router.push('/domains')
    const fetches = () => mockState().requests.filter((r) => r.operationId === 'getIdentity').length
    expect(fetches()).toBe(1)
    await router.push('/mailboxes')
    expect(fetches()).toBe(1)
    vi.setSystemTime(Date.now() + 301_000)
    await router.push('/aliases')
    expect(fetches()).toBe(2)
    expect(queryClient.getQueryData(queryKeys.identity())).toBeDefined()
  })

  it('resolves a route the catalogue denies, marked for NoAccessState (FR-045)', async () => {
    useScenario('anonymous-default', { signedInAs: 'reseller' })
    const { router, queryClient } = setup()
    await router.push('/api-keys/new')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('api-key-create')
    const identity = queryClient.getQueryData<Identity>(queryKeys.identity())
    expect(routeAccess(router.currentRoute.value, identity)).toBe('denied')
    await router.push('/domains')
    expect(routeAccess(router.currentRoute.value, identity)).toBe('allowed')
  })
})

describe('after a sign-in (FR-030)', () => {
  it('follows the new session state on the next navigation', async () => {
    useScenario('anonymous-default')
    const { router, queryClient } = setup()
    await router.push('/domains')
    expect(router.currentRoute.value.name).toBe('sign-in')
    // A sign-in step writes the new session into the cache (data-model §3).
    queryClient.setQueryData(queryKeys.session(), {
      state: 'active',
      username: 'admin',
      role: 'admin',
      authMethod: 'password',
      signedInAt: new Date().toISOString(),
      pendingActions: [],
      idleTimeout: 10800,
    })
    useScenario('admin-active')
    await router.push('/sign-in/admin?returnTo=%2Fdomains')
    expect(router.currentRoute.value.name).toBe('placeholder-domains')
  })
})

describe('meta.public (docs/conventions.md)', () => {
  const restricted = { accounts: { admin: { pendingActions: ['passwordChange'] } } }
  it.each([
    ['anonymous', 'anonymous-default', {}],
    ['pendingSecondFactor', 'anonymous-default', pending],
    ['restricted', 'admin-active', restricted],
    ['active', 'admin-active', {}],
  ] as [string, string, ScenarioOverrides][])(
    'resolves a public route in the %s state',
    async (_state, name, overrides) => {
      useScenario(name, overrides)
      const { router } = setup()
      router.addRoute({ path: '/open', name: 'open', component: {}, meta: { public: true } })
      await router.push('/open')
      expect(router.currentRoute.value.name).toBe('open')
    },
  )
})
