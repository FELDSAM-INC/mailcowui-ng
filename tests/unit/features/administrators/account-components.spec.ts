import { beforeAll, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'
import MultiSelect from '@/shared/components/MultiSelect.vue'
import AccountFields from '@/features/administrators/components/AccountFields.vue'
import PermissionsEditor from '@/features/administrators/components/PermissionsEditor.vue'
import { formFromAccount } from '@/features/administrators/account-form'
import { loadLegacy } from '@/i18n/legacy'
import { permissionDefaults } from '../../../mocks/factories/domain-admin'
import { mountWithApp } from '../../support/mount'
beforeAll(() => loadLegacy('en-gb'))
it('keeps the classic edit field order, including repeat password and HIBP', () => {
  const wrapper = mountWithApp(AccountFields, {
    props: { modelValue: formFromAccount(), role: 'domainAdmin', mode: 'edit', idPrefix: 'test' },
    global: {
      stubs: { DomainPicker: { props: ['label'], template: '<label>{{ label }}</label>' } },
    },
  })
  const labels = wrapper.findAll('label').map((label) => label.text().replace(' (required)', ''))
  expect(labels).toEqual(
    expect.arrayContaining([
      'Username',
      'Domains',
      'Password',
      'Confirmation password (repeat)',
      'Active',
      'Force 2FA enrollment at login',
      'Force password update at next login',
    ]),
  )
  const password = labels.indexOf('Password'),
    repeat = labels.indexOf('Confirmation password (repeat)')
  expect(password).toBeGreaterThan(labels.indexOf('Domains'))
  expect(repeat).toBeGreaterThan(password)
  expect(labels.indexOf('Active')).toBeGreaterThan(repeat)
  expect(wrapper.text().toLowerCase()).toContain('haveibeenpwned')
})
it('offers all 19 ACL choices in classic order and emits a changed flag', () => {
  const wrapper = mountWithApp(PermissionsEditor, {
    props: { modelValue: permissionDefaults(), idPrefix: 'acl' },
  })
  const selector = wrapper.getComponent(MultiSelect)
  expect(selector.props('options')).toHaveLength(19)
  expect(selector.props('options')[0]!.value).toBe('syncjobs')
  selector.vm.$emit(
    'update:modelValue',
    selector.props('modelValue').filter((value) => value !== 'loginAs'),
  )
  expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toMatchObject({
    loginAs: false,
    syncjobs: true,
  })
})

it('keeps both generated password updates in the parent model', async () => {
  const Parent = defineComponent({
    components: { AccountFields },
    setup() {
      return { form: ref(formFromAccount()) }
    },
    template: '<AccountFields v-model="form" role="admin" mode="create" id-prefix="generated" />',
  })
  const wrapper = mountWithApp(Parent)
  await wrapper.get('[data-generate]').trigger('click')
  const values = wrapper
    .findAll('input[autocomplete="new-password"]')
    .map((input) => (input.element as HTMLInputElement).value)
  expect(values[0]).not.toBe('')
  expect(values[1]).toBe(values[0])
})
