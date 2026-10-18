// T112: the pending-actions screen (FR-038–FR-041): the order of actions, the classic sign-in per
// role, "Check again" (session and identity read again) and registration gated by a sole
// second-factor setup.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { installGuards } from '@/app/router/guards'
import { setSessionContext } from '@/app/session/context'
import PendingActionsPage from '@/features/auth/pages/PendingActionsPage.vue'
import { createAppChannel } from '@/shared/platform/broadcast'

import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp, testPlugins } from '../../support/mount'
import { createTestRouter } from '../../support/router'
import { installWebAuthn } from '../../support/webauthn-stub'

afterEach(() => setSessionContext(null))

async function mountPage() {
  const router = createTestRouter()
  const queryClient = testPlugins().queryClient
  installGuards(router, { queryClient })
  setSessionContext({ queryClient, router, channel: createAppChannel('test') })
  await router.push('/pending-actions')
  const wrapper = mountWithApp(PendingActionsPage, {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await vi.waitFor(() => expect(wrapper.findAll('li').length).toBeGreaterThan(0))
  await flushPromises()
  return { wrapper, router }
}

const headings = (wrapper: Awaited<ReturnType<typeof mountPage>>['wrapper']) =>
  wrapper.findAll('li h2').map((h) => h.text())

describe('PendingActionsPage', () => {
  it('lists the password change first', async () => {
    useScenario('forced-both')
    installWebAuthn()
    const { wrapper } = await mountPage()
    expect(headings(wrapper)).toEqual(['Change your password', 'Set up a second factor'])
    expect(wrapper.text()).toContain(
      'You can register a passkey here once your password has been changed.',
    )
    expect(wrapper.findAll('button').some((b) => b.text() === 'Register a passkey')).toBe(false)
  })

  it.each([
    ['bob@example.org', '/'],
    ['admin', '/admin'],
    ['reseller', '/domainadmin'],
  ])('links %s to the classic sign-in %s', async (username, href) => {
    useScenario('anonymous-default', {
      signedInAs: username,
      accounts: { [username]: { pendingActions: ['passwordChange'] } },
    })
    const { wrapper } = await mountPage()
    expect(wrapper.get('li a').attributes('href')).toBe(href)
  })

  it('reads the session and the identity again on "Check again" and says when still pending', async () => {
    useScenario('forced-password-change')
    const { wrapper, router } = await mountPage()
    const before = mockState().requests.length
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Check again')!
      .trigger('click')
    await vi.waitFor(() =>
      expect(wrapper.text()).toContain('The password change is still pending.'),
    )
    const ops = mockState()
      .requests.slice(before)
      .map((r) => r.operationId)
    expect(ops).toEqual(expect.arrayContaining(['getSession', 'getIdentity']))
    mockState().accounts.find((a) => a.username === 'bob@example.org')!.pendingActions = []
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Check again')!
      .trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/'))
  })

  it('offers passkey registration when second-factor setup is the only action', async () => {
    useScenario('forced-second-factor')
    installWebAuthn()
    const { wrapper } = await mountPage()
    expect(wrapper.findAll('button').some((b) => b.text() === 'Register a passkey')).toBe(true)
  })

  it('points to the classic interface on a device without passkeys', async () => {
    useScenario('forced-second-factor')
    installWebAuthn({ supported: false })
    const { wrapper } = await mountPage()
    expect(wrapper.text()).toContain('This device cannot create passkeys.')
    expect(wrapper.get('li a').attributes('href')).toBe('/')
  })
})
