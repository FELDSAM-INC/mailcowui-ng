// The recovery address (UI 005 T064, FR-032, FR-016; legacy `#pwRecoveryEmailModal`): legacy's
// fields and help, the change with the current password, clearing by an empty field, and an
// outdated version keeping the typed address.
import { flushPromises } from '@vue/test-utils'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import RecoveryEmailForm from '@/features/account/components/recovery/RecoveryEmailForm.vue'
import { loadLegacy } from '@/i18n/legacy'

import { mockState, useScenario } from '../../../mocks/node'
import { MOCK_PASSWORD } from '../../../mocks/scenarios/accounts'
import { mountWithApp } from '../../support/mount'

beforeAll(async () => {
  await loadLegacy('en-gb')
})

function mountForm(
  stored = { address: 'anna.private@example.net' as string | null, etag: '"re-1"' },
) {
  return mountWithApp(RecoveryEmailForm, {
    props: { stored, username: 'anna@example.org' },
    attachTo: document.body,
  })
}

describe('RecoveryEmailForm', () => {
  it('shows legacy’s fields, help and an e-mail field prefilled', () => {
    useScenario('account-mailbox')
    const wrapper = mountForm()
    const email = wrapper.get('input[type="email"]')
    expect((email.element as HTMLInputElement).value).toBe('anna.private@example.net')
    expect(wrapper.text()).toContain('If no email for password recovery is provided')
    expect(wrapper.text()).toContain('Current password (confirm changes)')
  })

  it('saves a new address and clears one with an empty field', async () => {
    useScenario('account-mailbox')
    const wrapper = mountForm()
    await wrapper.get('input[type="email"]').setValue('anna@example.net')
    await wrapper.get('input[type="password"]').setValue(MOCK_PASSWORD)
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Changes to mailbox anna@example.org'))
    expect(mockState().mailboxes.find((m) => m.localPart === 'anna')?.recoveryEmail).toBe(
      'anna@example.net',
    )
    await wrapper.setProps({ stored: { address: 'anna@example.net', etag: '"re-2"' } })
    await wrapper.get('input[type="email"]').setValue('')
    await wrapper.get('input[type="password"]').setValue(MOCK_PASSWORD)
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() =>
      expect(mockState().mailboxes.find((m) => m.localPart === 'anna')?.recoveryEmail).toBeNull(),
    )
  })

  it('keeps the typed address and drops the password when the version is outdated (FR-016)', async () => {
    useScenario('account-mailbox')
    const wrapper = mountForm({ address: 'anna.private@example.net', etag: '"re-old"' })
    await wrapper.get('input[type="email"]').setValue('typed@example.net')
    await wrapper.get('input[type="password"]').setValue(MOCK_PASSWORD)
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[data-outdated]').exists()).toBe(true))
    expect((wrapper.get('input[type="email"]').element as HTMLInputElement).value).toBe(
      'typed@example.net',
    )
    expect((wrapper.get('input[type="password"]').element as HTMLInputElement).value).toBe('')
    expect(wrapper.emitted('reload')).toBeTruthy()
  })

  it('checks the address format before sending', async () => {
    useScenario('account-mailbox')
    const wrapper = mountForm()
    await wrapper.get('input[type="email"]').setValue('not-an-address')
    await wrapper.get('input[type="password"]').setValue(MOCK_PASSWORD)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Enter a valid email address.')
  })
})
