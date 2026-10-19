// The new-password fields (UI 005 T016, FR-022 to FR-025, research R7; decisions D7, D8): show and
// hide, the autocomplete attributes and the username for password managers, the mismatch with
// legacy's message, "generate" with copy, the policy checklist in text with one announcement, the
// rules a server refusal names, and submitting never blocked.
import { flushPromises } from '@vue/test-utils'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import { loadLegacy } from '@/i18n/legacy'
import NewPasswordFields from '@/shared/components/password/NewPasswordFields.vue'
import * as announcer from '@/shared/composables/useAnnouncer'
import { meetsPolicy, type PolicyValues } from '@/shared/password/policy-rules'

import { mountWithApp } from '../../support/mount'

beforeAll(async () => {
  await loadLegacy('en-gb')
})

const policy: PolicyValues = {
  minLength: 10,
  requireLetters: false,
  requireDigits: true,
  requireSpecialCharacters: false,
  requireMixedCase: false,
}

function mountFields(props: Record<string, unknown> = {}) {
  const password = ref('')
  const password2 = ref('')
  const fields = ref<{ validate(): boolean } | null>(null)
  const Host = defineComponent({
    setup: () => () =>
      h(NewPasswordFields, {
        ref: fields,
        idPrefix: 'own',
        password: password.value,
        password2: password2.value,
        policy,
        username: 'anna@example.org',
        labelKey: 'user.new_password',
        repeatKey: 'user.new_password_repeat',
        generateKey: 'user.generate',
        'onUpdate:password': (value: string) => (password.value = value),
        'onUpdate:password2': (value: string) => (password2.value = value),
        ...props,
      }),
  })
  const wrapper = mountWithApp(Host, { attachTo: document.body })
  return { wrapper, password, password2, fields }
}

describe('NewPasswordFields', () => {
  it('labels the fields with the form legacy keys and sets autocomplete for password managers', () => {
    const { wrapper } = mountFields()
    const inputs = wrapper.findAll('input')
    expect(inputs.map((input) => input.attributes('autocomplete'))).toEqual([
      'username',
      'new-password',
      'new-password',
    ])
    expect(inputs[0]!.element.value).toBe('anna@example.org')
    expect(inputs[0]!.attributes('readonly')).toBeDefined()
    expect(wrapper.text()).toContain('New password')
    expect(wrapper.text()).toContain('Confirmation password (repeat)')
  })

  it('shows and hides both fields with a pressed toggle', async () => {
    const { wrapper } = mountFields()
    const toggle = wrapper.get('button[aria-pressed]')
    expect(toggle.attributes('aria-label')).toBe('Toggle password visibility')
    expect(toggle.attributes('aria-pressed')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    const types = wrapper
      .findAll('input')
      .slice(1)
      .map((input) => input.attributes('type'))
    expect(types).toEqual(['text', 'text'])
  })

  it('reports a mismatch with danger.password_mismatch once the confirmation was left', async () => {
    const { wrapper, password, password2, fields } = mountFields()
    password.value = 'one-password-1'
    password2.value = 'other'
    await flushPromises()
    expect(wrapper.text()).not.toContain('Confirmation password does not match')
    await wrapper.findAll('input')[2]!.trigger('blur')
    expect(wrapper.text()).toContain('Confirmation password does not match')
    password2.value = 'one-password-1'
    await flushPromises()
    expect(wrapper.text()).not.toContain('Confirmation password does not match')
    expect(fields.value!.validate()).toBe(true)
  })

  it('generates a password that meets the policy into both fields, in clear text, with copy', async () => {
    const { wrapper, password, password2 } = mountFields()
    await wrapper.get('[data-generate]').trigger('click')
    expect(password.value).toBe(password2.value)
    expect(meetsPolicy(policy, password.value)).toBe(true)
    expect(wrapper.findAll('input')[1]!.attributes('type')).toBe('text')
    expect(wrapper.find('button[aria-label="Copy the generated password"]').exists()).toBe(true)
  })

  it('marks each rule in text and announces once every rule is met', async () => {
    const announce = vi.spyOn(announcer, 'announce')
    const { wrapper, password } = mountFields()
    password.value = 'summer'
    await flushPromises()
    const rules = wrapper.findAll('[data-rule]')
    expect(rules.map((rule) => rule.attributes('data-met'))).toEqual(['false', 'false'])
    expect(rules[0]!.text()).toContain('not met')
    expect(announce).not.toHaveBeenCalled()
    password.value = 'summer2026x'
    await flushPromises()
    expect(wrapper.findAll('[data-rule]').map((rule) => rule.attributes('data-met'))).toEqual([
      'true',
      'true',
    ])
    expect(announce).toHaveBeenCalledWith('The password meets every rule.')
  })

  it('marks the rules a server refusal named and shows the field errors', async () => {
    const { wrapper, password } = mountFields({
      failedRules: ['digits'],
      errors: ['Password does not meet the policy'],
    })
    password.value = 'summer2026x'
    await flushPromises()
    expect(wrapper.get('[data-rule="digits"]').attributes('data-met')).toBe('false')
    expect(wrapper.text()).toContain('Password does not meet the policy')
  })

  it('offers the haveibeenpwned check only where the classic field has it', () => {
    expect(mountFields().wrapper.text()).not.toContain('haveibeenpwned')
    expect(mountFields({ hibp: true }).wrapper.text()).toMatch(/haveibeenpwned/i)
  })
})
