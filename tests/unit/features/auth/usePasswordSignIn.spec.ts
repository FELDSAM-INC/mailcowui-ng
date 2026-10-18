// T062 (UI 012 FR-051, research R8): a password sign-in answered with "identity provider
// unavailable" says that the organisation's sign-in service is not reachable, keeps the username,
// clears the password, moves the focus to the message and starts no countdown despite Retry-After.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'

import { installGuards } from '@/app/router/guards'
import { setSessionContext } from '@/app/session/context'
import PasswordForm from '@/features/auth/components/PasswordForm.vue'
import { createAppChannel } from '@/shared/platform/broadcast'

import { MOCK_PASSWORD } from '../../../mocks/scenarios/accounts'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp, testPlugins } from '../../support/mount'
import { createTestRouter } from '../../support/router'

afterEach(() => {
  setSessionContext(null)
  document.body.innerHTML = ''
})

async function mountForm() {
  const router = createTestRouter()
  const queryClient = testPlugins().queryClient
  installGuards(router, { queryClient })
  setSessionContext({ queryClient, router, channel: createAppChannel('test') })
  await router.push('/sign-in')
  return mountWithApp(PasswordForm, {
    props: { role: null },
    global: { plugins: [router] },
    attachTo: document.body,
  })
}

describe('usePasswordSignIn: identity provider unavailable', () => {
  it('keeps the username, clears the password, focuses the message and does not throttle', async () => {
    useScenario('ldap-provider-down')
    const wrapper = await mountForm()
    await wrapper.get('input[name="username"]').setValue('carl@example.org')
    await wrapper.get('input[name="password"]').setValue(MOCK_PASSWORD)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await flushPromises()
    const message = wrapper.get('[data-provider-unavailable]')
    expect(message.text()).toContain("organisation's sign-in service cannot be reached")
    expect(document.activeElement).toBe(message.element)
    expect((wrapper.get('input[name="username"]').element as HTMLInputElement).value).toBe(
      'carl@example.org',
    )
    expect((wrapper.get('input[name="password"]').element as HTMLInputElement).value).toBe('')
    expect(wrapper.text()).not.toMatch(/Try again in|wait/i)
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
    expect(mockState().failedSignIns).toBe(0)
  })
})
