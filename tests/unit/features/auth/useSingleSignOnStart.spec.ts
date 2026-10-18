// T047: starting single sign-on (research R4, FR-043, FR-044): a busy state without a second
// start, the running WebAuthn ceremony aborted, the authorization address checked and opened in
// the same tab, the requested address kept just before, `409` refreshing the public configuration,
// and the busy state reset when the browser restores the page from its back-forward cache.
import { flushPromises } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { queryKeys } from '@/api'
import { setSessionContext } from '@/app/session/context'
import { useSingleSignOnStart } from '@/features/auth/composables/useSingleSignOnStart'
import { createAppChannel } from '@/shared/platform/broadcast'
import { getAssertion } from '@/shared/platform/webauthn'

import { mockState, server, useScenario } from '../../../mocks/node'
import { withSetup } from '../../support/composable'
import { testPlugins } from '../../support/mount'
import { createTestRouter } from '../../support/router'
import { installWebAuthn } from '../../support/webauthn-stub'

const KEY = 'mailcowui-ng.sso-return-to'

afterEach(() => {
  setSessionContext(null)
  sessionStorage.clear()
})

async function setup(returnTo: unknown = null) {
  const router = createTestRouter()
  const queryClient = testPlugins().queryClient
  setSessionContext({ queryClient, router, channel: createAppChannel('test') })
  await router.push('/sign-in')
  const navigate = vi.fn()
  const { result, unmount } = withSetup(
    () => useSingleSignOnStart({ returnTo: () => returnTo, navigate }),
    { router },
  )
  return { result, navigate, queryClient, unmount }
}

const starts = () => mockState().requests.filter((r) => r.operationId === 'startSingleSignOn')

describe('useSingleSignOnStart', () => {
  it('starts once, keeps the requested address and opens the provider in the same tab', async () => {
    useScenario('sso-available')
    const { result, navigate } = await setup('/passkeys?x=1')
    const first = result.start()
    expect(result.pending.value).toBe(true)
    void result.start()
    await first
    expect(starts()).toHaveLength(1)
    expect(sessionStorage.getItem(KEY)).toBe('/passkeys?x=1')
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(String(navigate.mock.calls[0]![0])).toMatch(/^https:\/\/idp\.example\.test\/auth\?/)
    expect(result.pending.value).toBe(true)
  })

  it('removes a kept address the router refuses', async () => {
    useScenario('sso-available')
    sessionStorage.setItem(KEY, '/domains')
    const { result } = await setup('https://evil.example/')
    await result.start()
    expect(sessionStorage.getItem(KEY)).toBeNull()
  })

  it('aborts a running conditional passkey request', async () => {
    useScenario('sso-available')
    const webauthn = installWebAuthn()
    webauthn.get.mockImplementationOnce(
      (options?: CredentialRequestOptions) =>
        new Promise((_resolve, reject) =>
          options?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          ),
        ),
    )
    const conditional = getAssertion(
      {
        challenge: 'Y2hhbGxlbmdl',
        rpId: 'localhost',
        allowCredentials: [],
        userVerification: 'required',
        timeout: 1,
      },
      { mediation: 'conditional' },
    ).catch((error: unknown) => error)
    const { result } = await setup()
    await result.start()
    expect(await conditional).toMatchObject({ kind: 'aborted' })
  })

  it('never navigates to an address that is not http or https', async () => {
    useScenario('sso-available')
    for (const authorizationUrl of ['javascript:alert(1)', '/ng/sso/return', 'data:text/html,x']) {
      server.use(
        http.post('*/api/v2/session/single-sign-on', () =>
          HttpResponse.json({
            data: { authorizationUrl, expiresAt: '2026-10-19T10:10:00Z' },
          }),
        ),
      )
      const { result, navigate, unmount } = await setup()
      await result.start()
      expect(navigate).not.toHaveBeenCalled()
      expect(result.pending.value).toBe(false)
      expect(result.problem.value).not.toBeNull()
      unmount()
    }
  })

  it('refreshes the public configuration when single sign-on is not offered', async () => {
    useScenario('sso-not-available-on-start')
    const { result, navigate, queryClient } = await setup()
    queryClient.setQueryData(queryKeys.publicConfig(), mockState().publicConfig)
    await result.start()
    expect(navigate).not.toHaveBeenCalled()
    expect(result.problem.value?.is('single-sign-on-not-available')).toBe(true)
    expect(result.pending.value).toBe(false)
    expect(queryClient.getQueryState(queryKeys.publicConfig())?.isInvalidated).toBe(true)
  })

  it('makes the action usable again when the page comes back from the back-forward cache', async () => {
    useScenario('sso-available')
    const { result } = await setup()
    await result.start()
    expect(result.pending.value).toBe(true)
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }))
    expect(result.pending.value).toBe(true)
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
    await flushPromises()
    expect(result.pending.value).toBe(false)
  })
})
