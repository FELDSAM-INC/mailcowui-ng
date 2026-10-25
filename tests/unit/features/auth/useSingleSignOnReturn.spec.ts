// T047: the return page's decisions (research R6, FR-046 to FR-049): one completion with the
// captured values, the provider error reported or the pending sign-in cancelled, every completion
// outcome, the landing on the kept address, and "Try again" as a new start that never resends the
// old code.
import { afterEach, describe, expect, it, vi } from 'vitest'

import { queryKeys } from '@/api'
import { installGuards } from '@/app/router/guards'
import { setSessionContext } from '@/app/session/context'
import { useSingleSignOnReturn } from '@/features/auth/composables/useSingleSignOnReturn'
import {
  captureSingleSignOnReturn,
  SSO_RETURN_PATH,
  takeCapturedSingleSignOnReturn,
} from '@/features/auth/sso/capture'
import { createAppChannel } from '@/shared/platform/broadcast'

import { mockState, useScenario } from '../../../mocks/node'
import { withSetup } from '../../support/composable'
import { testPlugins } from '../../support/mount'
import { createTestRouter } from '../../support/router'

const KEY = 'mailcowui-ng.sso-return-to'

afterEach(() => {
  setSessionContext(null)
  sessionStorage.clear()
  takeCapturedSingleSignOnReturn()
})

function capture(search: string) {
  captureSingleSignOnReturn({
    location: { pathname: SSO_RETURN_PATH, search, hash: '' },
    history: { state: null, replaceState: vi.fn() },
  })
}

/** Starts the pending sign-in in the mock and returns its state. */
function pendingState(): string {
  mockState().singleSignOn.pending = {
    state: 'state-1',
    expiresAt: Date.now() + 600_000,
    returnUrl: 'http://localhost:3000/ng/sso/return',
  }
  return 'state-1'
}

async function setup() {
  const router = createTestRouter()
  const queryClient = testPlugins().queryClient
  queryClient.clear()
  installGuards(router, { queryClient })
  setSessionContext({ queryClient, router, channel: createAppChannel('test') })
  await router.push('/sso/return')
  const navigate = vi.fn()
  const { result } = withSetup(() => useSingleSignOnReturn({ navigate }), { router })
  return { result, router, navigate, queryClient }
}

const ops = () => mockState().requests.map((r) => r.operationId)

describe('useSingleSignOnReturn', () => {
  it('completes once and lands on the kept address', async () => {
    useScenario('sso-available')
    capture(`?code=mock-code-1&state=${pendingState()}`)
    sessionStorage.setItem(KEY, '/passkeys?page=2')
    const { router, queryClient } = await setup()
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/passkeys?page=2'))
    expect(ops().filter((op) => op === 'completeSingleSignOn')).toHaveLength(1)
    expect(sessionStorage.getItem(KEY)).toBeNull()
    expect(queryClient.getQueryData(queryKeys.session())).toMatchObject({
      state: 'active',
      authMethod: 'singleSignOn',
    })
    expect(queryClient.getQueryData(queryKeys.identity())).toMatchObject({
      username: 'anna@example.org',
    })
  })

  it('lands on Overview without a kept address', async () => {
    useScenario('sso-available')
    capture(`?code=c&state=${pendingState()}`)
    const { router } = await setup()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/account/overview'))
  })

  it.each([
    ['sso-refused', 'sign-in-failed', true],
    ['sso-provider-down', 'identity-provider-unavailable', true],
    ['sso-disabled-after-start', 'single-sign-on-not-available', false],
  ])('shows the outcome of %s', async (name, problem, canRetry) => {
    useScenario(name)
    capture(`?code=c&state=${pendingState()}`)
    const { result } = await setup()
    await vi.waitFor(() => expect(result.outcome.value).not.toBeNull())
    const outcome = result.outcome.value!
    expect(outcome.kind).toBe('problem')
    if (outcome.kind === 'problem') {
      expect(outcome.problem.is(problem)).toBe(true)
      expect(outcome.canRetry).toBe(canRetry)
    }
  })

  it('reports a provider error with its code and state only', async () => {
    useScenario('sso-available')
    capture(`?error=access_denied&error_description=Nope&state=${pendingState()}`)
    const { result } = await setup()
    await vi.waitFor(() => expect(result.outcome.value).toEqual({ kind: 'cancelled' }))
    const report = mockState().requests.find(
      (r) => r.operationId === 'reportSingleSignOnProviderError',
    )
    expect(report?.body).toEqual({ error: 'access_denied', state: 'state-1' })
    expect(ops()).not.toContain('cancelSingleSignOn')
  })

  it('cancels an error it cannot report, still saying it was cancelled', async () => {
    useScenario('sso-available')
    capture('?error=access_denied')
    const { result } = await setup()
    await vi.waitFor(() => expect(result.outcome.value).toEqual({ kind: 'cancelled' }))
    expect(ops()).toContain('cancelSingleSignOn')
    expect(ops()).not.toContain('reportSingleSignOnProviderError')
  })

  it('cancels a code without a state and says the sign-in expired', async () => {
    useScenario('sso-available')
    capture('?code=c')
    const { result } = await setup()
    await vi.waitFor(() => expect(result.outcome.value).not.toBeNull())
    expect(ops()).toContain('cancelSingleSignOn')
    expect(ops()).not.toContain('completeSingleSignOn')
    const outcome = result.outcome.value!
    expect(outcome.kind === 'problem' && outcome.problem.is('sign-in-state-invalid')).toBe(true)
  })

  it('opens the sign-in screen without parameters and without a session', async () => {
    useScenario('sso-available')
    capture('')
    const { router } = await setup()
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('sign-in'))
    expect(router.currentRoute.value.query).toEqual({})
  })

  it('opens the app without parameters when a session exists', async () => {
    useScenario('sso-signed-in')
    const { router } = await setup()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/account/overview'))
  })

  it('tries again with a new start and the kept address, never resending the code', async () => {
    useScenario('sso-refused')
    capture(`?code=c&state=${pendingState()}`)
    sessionStorage.setItem(KEY, '/passkeys')
    const { result, navigate } = await setup()
    await vi.waitFor(() => expect(result.outcome.value).not.toBeNull())
    await result.retry()
    expect(ops().filter((op) => op === 'completeSingleSignOn')).toHaveLength(1)
    expect(ops()).toContain('startSingleSignOn')
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(KEY)).toBe('/passkeys')
  })

  it('goes back to the sign-in screen with the kept address', async () => {
    useScenario('sso-refused')
    capture(`?code=c&state=${pendingState()}`)
    sessionStorage.setItem(KEY, '/passkeys')
    const { result } = await setup()
    await vi.waitFor(() => expect(result.outcome.value).not.toBeNull())
    expect(result.backTo.value).toEqual({ name: 'sign-in', query: { returnTo: '/passkeys' } })
  })
})
