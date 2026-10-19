// The sync-job form components (UI 008 T043): the remote password field (masked, reveal toggle,
// autofill opt-outs, hints per mode, masked again when it closes) and the form's fields (the
// classic order and labels per mode, encryption options from the capabilities, the port rule, the
// ranges, the custom parameters hidden or read-only with the reason).
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import RemotePasswordField from '@/features/sync-jobs/components/RemotePasswordField.vue'
import SyncJobFormFields from '@/features/sync-jobs/components/SyncJobFormFields.vue'
import { initialCreateValues, toFormValues } from '@/features/sync-jobs/form-model'
import { legacy } from '@/i18n'

import { mockSyncJob, syncJobCapabilities, syncJobView } from '../../../mocks/factories/sync-job'
import { mountWithApp } from '../../support/mount'

const caps = syncJobCapabilities({ encryptions: ['ssl', 'starttls'] })

describe('RemotePasswordField', () => {
  it('is masked with the autofill opt-outs and a named reveal toggle', async () => {
    const wrapper = mountWithApp(RemotePasswordField, {
      props: {
        id: 'pw',
        label: legacy('add.password'),
        mode: 'create',
        maxLength: 255,
        modelValue: '',
      },
    })
    const input = wrapper.get('input')
    expect(input.attributes()).toMatchObject({
      type: 'password',
      autocomplete: 'new-password',
      'data-lpignore': 'true',
      'data-form-type': 'other',
    })
    expect(input.attributes()).toHaveProperty('data-1p-ignore')
    expect(input.attributes()).toHaveProperty('data-bwignore')
    const toggle = wrapper.get('button')
    expect(toggle.attributes('aria-label')).toBe('Toggle password visibility')
    expect(toggle.attributes('aria-pressed')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('input').attributes('type')).toBe('text')
    expect(wrapper.text()).toContain('Password')
    expect(wrapper.text()).not.toContain('A password is saved')
  })

  it('says whether a password is saved on the job page', () => {
    const saved = mountWithApp(RemotePasswordField, {
      props: {
        id: 'pw',
        label: legacy('edit.password'),
        mode: 'edit',
        passwordSet: true,
        maxLength: 255,
        modelValue: '',
      },
    })
    expect(saved.text()).toContain('A password is saved. Leave the field empty to keep it.')
    const none = mountWithApp(RemotePasswordField, {
      props: {
        id: 'pw',
        label: legacy('edit.password'),
        mode: 'edit',
        passwordSet: false,
        maxLength: 255,
        modelValue: '',
      },
    })
    expect(none.text()).toContain('No password is saved.')
  })
})

function mountFields(
  props: Partial<InstanceType<typeof SyncJobFormFields>['$props']> = {},
  edit = false,
) {
  const values = ref(
    edit
      ? toFormValues(syncJobView(mockSyncJob({ id: 1, customParameters: '--maxsize=1' })))
      : initialCreateValues(caps, {}),
  )
  const Host = defineComponent({
    setup: () => () =>
      h(SyncJobFormFields, {
        mode: edit ? 'edit' : 'create',
        idPrefix: 'f',
        caps,
        role: 'admin',
        customParamsAllowed: true,
        errorsFor: () => [],
        values: values.value,
        'onUpdate:values': (next: typeof values.value) => (values.value = next),
        ...props,
      }),
  })
  return { wrapper: mountWithApp(Host), values }
}

describe('SyncJobFormFields', () => {
  it("has the add form's labels, the capabilities' encryptions and the ranges", () => {
    const { wrapper } = mountFields()
    expect(wrapper.get('label[for="f-remoteHost"]').text()).toContain('Host')
    expect(wrapper.get('label[for="f-encryption"]').text()).toBe('Encryption method')
    expect(wrapper.findAll('#f-encryption option').map((o) => o.text())).toEqual([
      'SSL',
      'STARTTLS',
    ])
    expect(wrapper.text()).toContain('1-65535')
    expect(wrapper.text()).toContain('0-125000000')
    expect(wrapper.text()).toContain('Right: --param=xy, wrong: --param xy')
    expect(wrapper.get('#f-customParameters').attributes('placeholder')).toBe(
      '--some-param=xy --other-param=yx',
    )
    expect(wrapper.get('#f-remotePort').attributes('inputmode')).toBe('numeric')
    expect(wrapper.get('#f-exclude').attributes('autocapitalize')).toBe('none')
  })

  it('follows the encryption with the port until it is typed into', async () => {
    const { wrapper, values } = mountFields()
    await wrapper.get('#f-encryption').setValue('starttls')
    expect(values.value.remotePort).toBe('143')
    await wrapper.get('#f-remotePort').setValue('1143')
    await wrapper.get('#f-encryption').setValue('ssl')
    expect(values.value.remotePort).toBe('1143')
  })

  it('hides custom parameters on create when not allowed, and shows them read-only on edit', () => {
    expect(
      mountFields({ customParamsAllowed: false }).wrapper.find('#f-customParameters').exists(),
    ).toBe(false)
    const { wrapper } = mountFields({ customParamsAllowed: false }, true)
    const params = wrapper.get('#f-customParameters')
    expect(params.attributes()).toHaveProperty('readonly')
    expect(wrapper.text()).toContain(
      'Only administrators may set custom parameters on this server.',
    )
    expect(wrapper.get('label[for="f-remoteHost"]').text()).toBe('Hostname')
    expect(wrapper.text()).not.toContain('1-65535')
    expect(wrapper.text()).toContain('1-43800')
  })

  it("uses the mailbox user's placeholder and no hint on create", () => {
    const { wrapper } = mountFields({ role: 'mailboxUser' })
    expect(wrapper.get('#f-customParameters').attributes('placeholder')).toBe(
      '--delete2folders --otheroption',
    )
    expect(wrapper.text()).not.toContain('Right: --param=xy')
  })
})
