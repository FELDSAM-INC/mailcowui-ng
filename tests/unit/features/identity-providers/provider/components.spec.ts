// The identity provider form's parts (T023, T024): the connection test's limit and outcomes, the
// write-only secret field, the app's return addresses with copy, and the attribute mapping.
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { ApiProblem } from '@/api'
import AppReturnAddresses from '@/features/identity-providers/provider/components/AppReturnAddresses.vue'
import ConnectionTest from '@/features/identity-providers/provider/components/ConnectionTest.vue'
import MappingField from '@/features/identity-providers/provider/components/MappingField.vue'
import ProviderSecretField from '@/features/identity-providers/provider/components/ProviderSecretField.vue'
import { useConnectionTest } from '@/features/identity-providers/provider/composables/useConnectionTest'
import type { ProviderInput } from '@/features/identity-providers/provider/form-model'
import { i18n } from '@/i18n'
import { liveMessages } from '@/shared/composables/useAnnouncer'

import { useScenario } from '../../../../mocks/node'
import { mountWithApp, resetTestPlugins } from '../../../support/mount'

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

const candidate = {
  type: 'ldap',
  hosts: ['ldap1.example.org'],
  baseDn: 'dc=example,dc=org',
  bindDn: 'cn=admin,dc=example,dc=org',
  bindPassword: 'secret',
} as ProviderInput

function withTest(limitMs?: number) {
  let api!: ReturnType<typeof useConnectionTest>
  mount(
    defineComponent({
      setup() {
        api = useConnectionTest(limitMs ? { limitMs } : {})
        return () => h('div')
      },
    }),
  )
  return api
}

describe('useConnectionTest', () => {
  it('returns the result, ignores a second start, and reports no result after the limit', async () => {
    const state = useScenario('idp-none')
    const test = withTest(50)
    expect(await test.run(candidate)).toBe('done')
    expect(test.result.value?.outcome).toBe('success')
    state.identityProvider.connectionTest = { outcome: 'success', hang: true }
    const running = test.run(candidate)
    expect(await test.run(candidate)).toBe('busy')
    expect(await running).toBe('noResult')
    expect(test.noResult.value).toBe(true)
    expect(test.running.value).toBe(false)
    test.reset()
    expect(test.noResult.value).toBe(false)
  })

  it('keeps a request problem', async () => {
    useScenario('idp-none')
    const test = withTest()
    expect(await test.run({ ...candidate, bindPassword: undefined } as never)).toBe('failed')
    expect(test.problem.value?.status).toBe(422)
  })
})

describe('ConnectionTest', () => {
  it('shows the classic outcome with the category and the status of an unexpected answer', () => {
    resetTestPlugins()
    const wrapper = mountWithApp(ConnectionTest, {
      props: {
        running: false,
        noResult: false,
        problem: null,
        result: {
          type: 'keycloak',
          testedAddress: 'https://sso.example.org/token',
          testedAt: '2026-10-19T08:00:00Z',
          outcome: 'failure',
          failureCategory: 'unexpectedResponse',
          providerStatus: 404,
        },
      },
    })
    expect(wrapper.text()).toContain('Connection failed')
    expect(wrapper.text()).toContain('The provider gave an unexpected answer.')
    expect(wrapper.text()).toContain('Status: 404')
  })

  it('announces the progress, offers nothing twice, and shows no result and problems', async () => {
    resetTestPlugins()
    const wrapper = mountWithApp(ConnectionTest, {
      props: { running: true, noResult: false, problem: null, result: null },
    })
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Testing the connection…')
    await wrapper.setProps({ running: false, noResult: true })
    expect(wrapper.text()).toContain('No result was received within 90 seconds.')
    await wrapper.setProps({
      noResult: false,
      problem: ApiProblem.fromParts({ kind: 'network' }),
    })
    expect(wrapper.text()).toContain('could not be reached')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('test')).toHaveLength(1)
  })
})

describe('ProviderSecretField', () => {
  it('is masked, opts out of saved sign-ins, says a stored secret is kept and reveals on request', async () => {
    resetTestPlugins()
    const wrapper = mountWithApp(ProviderSecretField, {
      props: {
        id: 's',
        label: 'Bind Password',
        modelValue: '',
        required: false,
        keepsStored: true,
      },
    })
    const input = wrapper.get('input')
    expect(input.attributes('type')).toBe('password')
    expect(input.attributes('autocomplete')).toBe('new-password')
    expect(input.attributes('data-lpignore')).toBe('true')
    expect(wrapper.text()).toContain('Leave the field empty to keep it.')
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('input').attributes('type')).toBe('text')
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('true')
    await input.setValue('typed')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['typed'])
    await wrapper.setProps({ required: true })
    expect(wrapper.text()).not.toContain('Leave the field empty to keep it.')
    expect(wrapper.text()).toContain('required')
  })
})

describe('AppReturnAddresses', () => {
  it('copies an address and announces it, or selects it when copying is refused', async () => {
    resetTestPlugins()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const wrapper = mountWithApp(AppReturnAddresses, {
      props: { idPrefix: 'a', urls: ['https://mail.example.org/ng/sso/return'] },
      attachTo: document.body,
    })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('https://mail.example.org/ng/sso/return')
    await vi.waitFor(() =>
      expect(liveMessages.polite.value).toContain(i18n.global.t('secrets.copied')),
    )
    writeText.mockRejectedValue(new Error('denied'))
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('The address is selected')
    expect(document.activeElement?.id).toBe('a-app-return-0')
  })

  it('renders nothing without addresses', () => {
    resetTestPlugins()
    const wrapper = mountWithApp(AppReturnAddresses, { props: { idPrefix: 'a', urls: [] } })
    expect(wrapper.find('[data-app-return-urls]').exists()).toBe(false)
  })
})

describe('MappingField', () => {
  it('adds and removes entries named after their value, keeps a stored template that is gone', async () => {
    resetTestPlugins()
    const wrapper = mountWithApp(MappingField, {
      props: {
        idPrefix: 'm',
        rows: [{ attributeValue: 'alumni', template: 'Alumni' }],
        defaultTemplate: '',
        templates: ['Default', 'Staff'],
        templatesProblem: null,
        max: 2,
        errorsFor: (path: string) =>
          path === 'attributeMapping.0.template' ? ['This mailbox template does not exist.'] : [],
      },
      attachTo: document.body,
    })
    const options = wrapper.findAll('#m-attributeMapping-0-template option').map((o) => o.text())
    expect(options).toEqual(['-- Template --', 'Default', 'Staff', 'Alumni'])
    expect(wrapper.text()).toContain('This mailbox template does not exist.')
    await wrapper.get('button[aria-label="Add: Attribute Mapping"]').trigger('click')
    expect(wrapper.emitted('update:rows')?.[0]?.[0]).toHaveLength(2)
    await wrapper.get('button[aria-label="Remove: alumni"]').trigger('click')
    expect(wrapper.emitted('update:rows')?.[1]?.[0]).toEqual([])
    await wrapper.get('#m-defaultTemplate').setValue('Staff')
    expect(wrapper.emitted('update:defaultTemplate')?.[0]).toEqual(['Staff'])
    await wrapper.setProps({
      rows: [
        { attributeValue: 'a', template: '' },
        { attributeValue: 'b', template: '' },
      ],
    })
    expect(
      wrapper.get('button[aria-label="Add: Attribute Mapping"]').attributes('disabled'),
    ).toBeDefined()
  })
})
