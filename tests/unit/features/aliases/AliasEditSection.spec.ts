// The "Edit alias" section (T053; legacy form map: `templates/edit/alias.twig` as one section): the
// read-only values when closed, the form in legacy's order with legacy's labels, the groupware
// option only with the groupware, the external notice, only changed members on save, the marks
// after a 412, comments checked only when changed, and the deletion impact of the list.
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import type { Alias, AliasCapabilities, Identity } from '@/api'
import AliasDeleteImpact from '@/features/aliases/components/AliasDeleteImpact.vue'
import AliasEditSection from '@/features/aliases/components/AliasEditSection.vue'
import { fetchAlias } from '@/features/aliases/api'
import { loadLegacy, resetLegacy } from '@/i18n/legacy'

import { permissionFlags } from '../../../mocks/scenarios/accounts'
import { EDIT_ALIAS_004 } from '../../../mocks/scenarios/aliases-edit'
import { defaultCapabilities004 } from '../../../mocks/scenarios/feature-004-base'
import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp, resetTestPlugins } from '../../support/mount'
import { alias as aliasFixture } from './alias-fixture'

const identity = (role: Identity['role'], flags: Partial<Identity['permissions']> = {}) =>
  ({
    username: role === 'admin' ? 'admin' : 'reseller',
    role,
    authentication: { method: 'password' },
    scope:
      role === 'admin'
        ? { type: 'allDomains' }
        : { type: 'domains', domains: ['example.org', 'example.com'] },
    permissions: permissionFlags(role === 'admin', flags),
    pendingActions: [],
  }) as unknown as Identity

const readAlias = (id: number): Promise<Alias> => fetchAlias(id)

interface Options {
  editing?: boolean
  capabilities?: Partial<AliasCapabilities>
  who?: Identity
}

async function mountSection(value: Alias, options: Options = {}) {
  const events: { name: string; args: unknown[] }[] = []
  const Page = defineComponent({
    setup() {
      return () =>
        h(AliasEditSection, {
          alias: value,
          editing: options.editing ?? true,
          capabilities: { ...defaultCapabilities004(), ...options.capabilities },
          identity: options.who ?? identity('admin'),
          onEdit: () => events.push({ name: 'edit', args: [] }),
          onClose: () => events.push({ name: 'close', args: [] }),
          onGone: () => events.push({ name: 'gone', args: [] }),
          onDirty: (dirty: boolean) => events.push({ name: 'dirty', args: [dirty] }),
        })
    },
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/aliases/:aliasId', component: Page }],
  })
  await router.push(`/aliases/${value.id}?edit=alias`)
  const wrapper = mountWithApp(RouterView, {
    attachTo: document.body,
    global: { plugins: [router] },
  })
  await flushPromises()
  return { wrapper, events }
}

beforeEach(async () => {
  resetTestPlugins()
  await loadLegacy('en-gb')
})
afterEach(() => resetLegacy())

describe('AliasEditSection', () => {
  it('shows the values read-only while closed, with Edit', async () => {
    const { wrapper, events } = await mountSection(aliasFixture(), { editing: false })
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.get('[data-field="destinations"]').text()).toContain('anna@example.org')
    await wrapper.get('button').trigger('click')
    expect(events.map((event) => event.name)).toContain('edit')
    wrapper.unmount()
  })

  it("opens the classic form in legacy's order with legacy's labels", async () => {
    const { wrapper } = await mountSection(aliasFixture())
    const labels = wrapper
      .findAll('form label')
      .map((label) => label.text().replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    expect(labels).toEqual([
      'Edit alias',
      'Goto address/es (comma-separated)',
      'Silently discard mail',
      'Learn as spam',
      'Learn as ham',
      'Alias is visible in SOGo',
      'Internal',
      'Allow to send as this alias',
      'Private comment',
      'Public comment',
      'Active',
    ])
    expect(wrapper.get<HTMLTextAreaElement>('#alias-edit-goto').element.value).toBe(
      'anna@example.org, bob@example.org',
    )
    expect(wrapper.text()).toContain('Save changes')
    wrapper.unmount()
  })

  it('leaves out the groupware option while the groupware is disabled', async () => {
    const { wrapper } = await mountSection(aliasFixture(), {
      capabilities: { groupwareEnabled: false },
    })
    expect(wrapper.text()).not.toContain('Alias is visible in SOGo')
    wrapper.unmount()
  })

  it('gives the external notice to a domain administrator without external destinations', async () => {
    const restricted = await mountSection(aliasFixture(), { who: identity('domainAdmin') })
    expect(restricted.wrapper.find('[data-external-notice]').exists()).toBe(true)
    restricted.wrapper.unmount()
    const allowed = await mountSection(aliasFixture(), {
      who: identity('domainAdmin', { aliasExternalGoto: true }),
    })
    expect(allowed.wrapper.find('[data-external-notice]').exists()).toBe(false)
    allowed.wrapper.unmount()
  })

  it('saves only the changed members and closes with legacy\'s message', async () => {
    useScenario('aliases-edit')
    const read = await readAlias(EDIT_ALIAS_004.sales)
    const { wrapper, events } = await mountSection(read)
    await wrapper.get('#alias-edit-publicComment').setValue('Sales team')
    expect(events.some((event) => event.name === 'dirty' && event.args[0] === true)).toBe(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    const stored = mockState().aliases.find((item) => item.id === EDIT_ALIAS_004.sales)!
    expect(stored.publicComment).toBe('Sales team')
    expect(events.map((event) => event.name)).toContain('close')
    expect(wrapper.text()).toContain('Changes to alias address sales@example.org have been saved')
    wrapper.unmount()
  })

  it('marks the values changed elsewhere after a 412 and keeps the input', async () => {
    useScenario('aliases-edit')
    const read = await readAlias(EDIT_ALIAS_004.sales)
    const { wrapper } = await mountSection(read)
    await wrapper.get('#alias-edit-privateComment').setValue('mine')
    mockState().aliases.find((item) => item.id === EDIT_ALIAS_004.sales)!.active = false
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[data-outdated]').text()).toContain('Active: now saved as No')
    expect(wrapper.get<HTMLInputElement>('#alias-edit-privateComment').element.value).toBe('mine')
    wrapper.unmount()
  })

  it('checks a comment only when it changed', async () => {
    useScenario('aliases-edit')
    const read = await readAlias(EDIT_ALIAS_004.notes)
    const { wrapper, events } = await mountSection(read)
    await wrapper.get('#alias-edit-privateComment').setValue('é'.repeat(81))
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Comment too long, max 160 chars allowed')
    expect(events.map((event) => event.name)).not.toContain('close')

    await wrapper.get('#alias-edit-privateComment').setValue(read.privateComment)
    await wrapper.get('#alias-edit-internal').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mockState().aliases.find((item) => item.id === EDIT_ALIAS_004.notes)!.internal).toBe(
      true,
    )
    wrapper.unmount()
  })

  it('reports a vanished alias', async () => {
    useScenario('aliases-edit')
    const read = await readAlias(EDIT_ALIAS_004.sales)
    const { wrapper, events } = await mountSection(read)
    await wrapper.get('#alias-edit-publicComment').setValue('x')
    const state = mockState()
    state.aliases = state.aliases.filter((item) => item.id !== EDIT_ALIAS_004.sales)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(events.map((event) => event.name)).toContain('gone')
    wrapper.unmount()
  })
})

describe('AliasDeleteImpact', () => {
  it('names the address and the consequences, with the catch-all sentence for a catch-all', () => {
    const regular = mountWithApp(AliasDeleteImpact, { props: { alias: aliasFixture() } })
    expect(regular.text()).toContain('sales@example.org')
    expect(regular.text()).toContain('Mail to this address is no longer accepted')
    expect(regular.text()).not.toContain('catch-all')
    const catchAll = mountWithApp(AliasDeleteImpact, {
      props: {
        alias: aliasFixture({ address: '@example.org', addressUnicode: '@example.org', kind: 'catchAll' }),
      },
    })
    expect(catchAll.text()).toContain('catch-all')
    expect(catchAll.text()).toContain('example.org')
  })
})
