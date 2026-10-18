// The identity provider form's behaviour (T036, T073 at unit level): error paths on fields, the
// outdated save with what changed elsewhere and "Save again" or "Discard", a type change as a
// whole save, and a configuration removed elsewhere.
import { useQuery } from '@tanstack/vue-query'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, type Ref } from 'vue'

import {
  capabilitiesOptions,
  configurationOptions,
  type IdentityProviderConfig,
} from '@/features/identity-providers/provider/api'
import {
  fieldIdOf,
  useProviderEditor,
} from '@/features/identity-providers/provider/composables/useProviderEditor'

import { mockState, useScenario } from '../../../../mocks/node'
import { mountWithApp, resetTestPlugins } from '../../../support/mount'

async function editorFor(scenario: string) {
  useScenario(scenario)
  resetTestPlugins()
  let editor!: ReturnType<typeof useProviderEditor>
  let config!: Ref<IdentityProviderConfig | null | undefined>
  mountWithApp(
    defineComponent({
      setup() {
        const capabilities = useQuery(capabilitiesOptions())
        const query = useQuery(configurationOptions())
        config = query.data
        editor = useProviderEditor({
          capabilities: () => capabilities.data.value,
          config: () => query.data.value,
          refetch: async () => (await query.refetch()).data,
        })
        return () => h('div')
      },
    }),
  )
  await vi.waitFor(async () => {
    await flushPromises()
    expect(config.value).toBeDefined()
  })
  editor.open(config.value ?? null)
  return { editor, config }
}

describe('fieldIdOf', () => {
  it('maps the API paths of each type to the form fields', () => {
    expect(fieldIdOf('ldap', 'hosts')).toBe('idp-hosts')
    expect(fieldIdOf('ldap', 'attributeMapping.2.template')).toBe('idp-attributeMapping-2-template')
    expect(fieldIdOf('keycloak', 'additionalReturnUrls.1')).toBe('idp-additionalReturnUrls-1')
    expect(fieldIdOf('keycloak', 'attributeMapping')).toBe('idp-attributeMapping-add')
    expect(fieldIdOf('genericOidc', 'hosts')).toBeNull()
  })
})

describe('useProviderEditor', () => {
  it('reports an outdated save with what changed, then saves again with the new tag', async () => {
    const { editor } = await editorFor('idp-changed-elsewhere')
    editor.form.value!.syncInterval = '45'
    expect(editor.dirty.value).toBe(true)
    expect(await editor.save()).toBe('outdated')
    expect(editor.outdated.value?.map((change) => change.field)).toEqual(['bindPassword'])
    expect(editor.form.value!.syncInterval).toBe('45')
    expect(await editor.save()).toBe('saved')
    expect(mockState().identityProvider.stored).toMatchObject({ syncInterval: 45 })
  })

  it('lists the members another administrator changed, and discards to the reloaded values', async () => {
    const { editor } = await editorFor('idp-ldap')
    const state = mockState()
    state.identityProvider.stored = { ...state.identityProvider.stored!, port: 10389 } as never
    state.identityProvider.version += 1
    editor.form.value!.syncInterval = '45'
    expect(await editor.save()).toBe('outdated')
    expect(editor.outdated.value).toEqual([
      expect.objectContaining({ field: 'port', saved: '10389' }),
    ])
    editor.discard()
    expect(editor.form.value!.port).toBe('10389')
    expect(editor.form.value!.syncInterval).toBe('15')
  })

  it('saves another type as a whole save and maps API field errors', async () => {
    const { editor } = await editorFor('idp-keycloak')
    Object.assign(editor.form.value!, {
      type: 'ldap',
      hosts: 'ldap1.example.org',
      baseDn: 'dc=example,dc=org',
      bindDn: 'cn=admin,dc=example,dc=org',
      bindPassword: 'secret',
      attributeMapping: [{ attributeValue: 'x', template: 'Gone' }],
    })
    expect(await editor.save()).toBe('failed')
    expect(editor.problemForm.errorsFor('attributeMapping.0.template')).toEqual([
      'This mailbox template does not exist.',
    ])
    expect(editor.form.value!.bindPassword).toBe('')
    editor.form.value!.attributeMapping = []
    editor.form.value!.bindPassword = 'secret'
    expect(await editor.save()).toBe('saved')
    expect(mockState().identityProvider.stored?.type).toBe('ldap')
  })

  it('says when the configuration was removed elsewhere, and when nothing changed', async () => {
    const { editor } = await editorFor('idp-removed-elsewhere')
    expect(await editor.save()).toBe('unchanged')
    editor.form.value!.syncInterval = '20'
    expect(await editor.save()).toBe('removed')
  })

  it('creates, and runs the test of the entered values', async () => {
    const { editor } = await editorFor('idp-none')
    Object.assign(editor.form.value!, {
      type: 'ldap',
      hosts: 'ldap1.example.org',
      baseDn: 'dc=example,dc=org',
      bindDn: 'cn=admin,dc=example,dc=org',
      bindPassword: 'secret',
    })
    await editor.runTest()
    expect(editor.test.result.value?.outcome).toBe('success')
    expect(await editor.save()).toBe('created')
    expect(editor.status.value?.kind).toBe('success')
  })
})
