// T104: the passkey list (FR-052): display names, notes for another host and inactive passkeys as
// text, the authenticator and the registration date.
import { describe, expect, it } from 'vitest'

import PasskeyList from '@/features/passkeys/components/PasskeyList.vue'

import { alicePasskeys } from '../../../mocks/scenarios/passkeys'
import { mountWithApp } from '../../support/mount'

const passkeys = alicePasskeys()
  .reverse()
  .map(({ credentialId: _c, ...rest }) => rest)

describe('PasskeyList', () => {
  it('renders one card per passkey with its notes in text', () => {
    const wrapper = mountWithApp(PasskeyList, { props: { passkeys, total: 4 } })
    const items = wrapper.findAll('li')
    expect(items).toHaveLength(4)
    expect(items[0]!.get('h2').text()).toMatch(/^Unknown passkey, registered /)
    expect(items[1]!.text()).toContain('Inactive: it cannot be used to sign in')
    expect(items[2]!.text()).toContain('Works only on mail.example.net')
    expect(items[3]!.text()).toContain('iCloud Keychain')
    expect(items[3]!.find('time').exists()).toBe(true)
  })

  it('emits rename and remove for a passkey', async () => {
    const wrapper = mountWithApp(PasskeyList, { props: { passkeys, total: 4 } })
    const buttons = wrapper.findAll('li')[3]!.findAll('button')
    await buttons.find((b) => b.text().startsWith('Rename'))!.trigger('click')
    await buttons.find((b) => b.text().startsWith('Remove'))!.trigger('click')
    expect(wrapper.emitted('rename')?.[0]?.[0]).toMatchObject({ name: 'Phone' })
    expect(wrapper.emitted('remove')?.[0]?.[0]).toMatchObject({ name: 'Phone' })
  })
})
