// The write-only credential fields (UI 009 T029, research R7): the empty password field with the
// stored status, "Remove password" pending with "Undo", the cleared-username note, the password
// manager attributes, and legacy's haveibeenpwned check on edit pages.
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import CredentialFields from '@/features/routing/components/common/CredentialFields.vue'
import { credentialIntent } from '@/features/routing/logic/credentials'

import { mountWithApp } from '../../../support/mount'

function mountFields(mode: 'create' | 'edit', stored = { username: 'relay', passwordSet: true }) {
  const intent = ref(mode === 'edit' ? credentialIntent(stored) : credentialIntent(null))
  const wrapper = mountWithApp(
    defineComponent({
      setup: () => () =>
        h(CredentialFields, {
          idPrefix: 'c',
          mode,
          errorsFor: (path: string) => (path === 'username' ? ['problem'] : []),
          maxLengths: { username: 255, password: 255 },
          modelValue: intent.value,
          'onUpdate:modelValue': (value: typeof intent.value) => {
            intent.value = value
          },
        }),
    }),
  )
  return { wrapper, intent }
}

describe('CredentialFields', () => {
  it('labels the add form like legacy and keeps password managers away', () => {
    const { wrapper } = mountFields('create')
    const labels = wrapper.findAll('label').map((label) => label.text())
    expect(labels).toEqual(['Username', 'Password'])
    const username = wrapper.find('#c-username')
    expect(username.attributes()).toMatchObject({
      name: 'relay-username',
      autocomplete: 'off',
      'data-lpignore': 'true',
    })
    expect(username.attributes('aria-invalid')).toBe('true')
    const password = wrapper.find('#c-password')
    expect(password.attributes()).toMatchObject({
      type: 'password',
      autocomplete: 'new-password',
      'data-1p-ignore': '',
      'data-bwignore': '',
    })
    expect(password.attributes('placeholder')).toBeUndefined()
    expect(wrapper.find('[data-password-status]').exists()).toBe(false)
  })

  it('says a password is stored, removes it pending with undo, and warns when the username goes', async () => {
    const { wrapper, intent } = mountFields('edit')
    expect(wrapper.find('#c-password').attributes('placeholder')).toBe('If unchanged leave blank')
    expect(wrapper.text()).toContain('A password is stored.')
    expect(wrapper.text()).toContain('Check against haveibeenpwned.com')
    await wrapper.find('[data-remove-password]').trigger('click')
    expect(intent.value.removePassword).toBe(true)
    expect(wrapper.text()).toContain('The password will be removed when you save.')
    expect(wrapper.find('#c-password').attributes('disabled')).toBeDefined()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Undo')!
      .trigger('click')
    expect(intent.value.removePassword).toBe(false)
    await wrapper.find('#c-username').setValue('')
    expect(wrapper.find('[data-username-note]').text()).toBe(
      'Saving without a username also removes the stored password.',
    )
    await wrapper.find('#c-password').setValue('Typed-1')
    expect(intent.value.password).toBe('Typed-1')
  })

  it('says no password is stored without offering its removal', () => {
    const { wrapper } = mountFields('edit', { username: 'relay', passwordSet: false })
    expect(wrapper.text()).toContain('No password is stored.')
    expect(wrapper.find('[data-remove-password]').exists()).toBe(false)
  })
})
