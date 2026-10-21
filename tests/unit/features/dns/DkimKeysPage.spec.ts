// The DKIM key list (T034, T045, T087; FR-005 to FR-015, FR-024, FR-038, FR-040, FR-092): the
// entries with the server settings, search and the narrow sort control through the address, the
// empty, no-match and error states, selection with generation and the typed bulk deletion, and
// "Generate keys for all names without a key". The end-to-end suite covers the same flows in the
// browser.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import GenerateKeyDialog from '@/features/dns/components/GenerateKeyDialog.vue'
import DkimKeysPage from '@/features/dns/pages/DkimKeysPage.vue'
import BulkActionBar from '@/shared/components/BulkActionBar.vue'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'

import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

const Stub = defineComponent({ render: () => h('h1', 'stub') })

function setWidth(wide: boolean) {
  window.matchMedia = (query: string) => ({
    matches: wide && query.includes('min-width'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })
}

async function mountList(path = '/dns/dkim-keys', wide = true) {
  setWidth(wide)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dns/dkim-keys', name: 'dkim-keys', component: DkimKeysPage },
      { path: '/dns/dkim-keys/:dkimName', name: 'dkim-key', component: Stub },
      { path: '/dns/dkim-import', name: 'dkim-import', component: Stub },
      { path: '/dns/diagnostics/:diagnosticsName', name: 'dns-diagnostics', component: Stub },
      { path: '/domains', name: 'domains', component: Stub },
    ],
  })
  await router.push(path)
  const wrapper = mountWithApp(defineComponent({ render: () => h(RouterView) }), {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await vi.waitFor(() =>
    expect(wrapper.get('[data-list-state]').attributes('data-list-state')).not.toBe('loading'),
  )
  return { wrapper, router }
}

type Wrapper = Awaited<ReturnType<typeof mountList>>['wrapper']

const names = (wrapper: Wrapper) =>
  wrapper.findAll('[data-entry]').map((item) => item.attributes('data-entry'))

const requests = (operationId: string) =>
  mockState().requests.filter((request) => request.operationId === operationId)

const button = (wrapper: Wrapper, text: string) =>
  wrapper.findAll('button').find((candidate) => candidate.text() === text)!

async function select(wrapper: Wrapper, ...entries: string[]) {
  await button(wrapper, 'Select').trigger('click')
  for (const name of entries) {
    await wrapper.get(`input[aria-label="Select ${name}"]`).setValue(true)
  }
}

afterEach(() => {
  settleConfirm(false)
  document.body.innerHTML = ''
})

describe('DkimKeysPage', () => {
  it('lists the entries with the total and the server settings for administrators', async () => {
    useScenario('dns-admin')
    const { wrapper } = await mountList()
    expect(names(wrapper)).toContain('example.org')
    expect(names(wrapper)).toContain('example.net')
    const row = wrapper.get('tbody tr[data-entry="example.org"]')
    const action = row.get('td:last-child .table-row-controls a')
    expect(action.text()).toBe('Edit')
    expect(action.attributes('href')).toBe('/dns/dkim-keys/example.org')
    expect(row.find('td:last-child [aria-expanded]').exists()).toBe(false)
    expect(wrapper.get('[data-result-count]').text()).toMatch(/\d/)
    await vi.waitFor(() =>
      expect(wrapper.get('[data-dkim-settings]').attributes('aria-busy')).toBeUndefined(),
    )
    expect(wrapper.find('a[href="/dns/dkim-import"]').exists()).toBe(true)
    await button(wrapper, 'Refresh').trigger('click')
    await vi.waitFor(() => expect(requests('listDkimKeys').length).toBeGreaterThan(1))
    wrapper.unmount()
  })

  it('shows a domain administrator their entries without the settings or the import', async () => {
    useScenario('dns-domain-admin')
    const { wrapper } = await mountList()
    expect(names(wrapper)).toContain('example.org')
    expect(wrapper.find('[data-dkim-settings]').exists()).toBe(false)
    expect(wrapper.find('a[href="/dns/dkim-import"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps the search and the narrow sort control in the address', async () => {
    useScenario('dns-admin')
    const { wrapper, router } = await mountList('/dns/dkim-keys?q=example.net', false)
    await vi.waitFor(() => expect(names(wrapper)).toEqual(['example.net']))
    await wrapper.get('#dkim-sort').setValue('keyLength')
    await flushPromises()
    expect(router.currentRoute.value.query.sort).toBe('keyLength')
    wrapper.unmount()
  })

  it('offers to clear a search without matches, and lists everything again', async () => {
    useScenario('dns-admin')
    const { wrapper } = await mountList('/dns/dkim-keys?q=zzz')
    expect(wrapper.text()).toContain('No matching records found')
    const clear = wrapper.findAll('button').filter((b) => b.text() === 'Clear all filters')
    await clear.at(-1)!.trigger('click')
    await vi.waitFor(() => expect(names(wrapper)).toContain('example.org'))
    wrapper.unmount()
  })

  it('says the table is empty and links to the domains', async () => {
    useScenario('dns-empty-admin')
    const { wrapper } = await mountList()
    expect(wrapper.get('[data-dkim-empty]').text()).toContain('No data available in table')
    expect(wrapper.find('[data-dkim-empty] a[href="/domains"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('says the list could not be loaded and retries', async () => {
    useScenario('dns-admin')
    mockState().failures.listDkimKeys = { status: 500, times: 1 }
    const { wrapper } = await mountList()
    expect(wrapper.text()).toContain('The list could not be loaded.')
    await button(wrapper, 'Try again').trigger('click')
    await vi.waitFor(() => expect(names(wrapper)).toContain('example.org'))
    wrapper.unmount()
  })

  it('generates keys for the selected names without one, skipping those with a key', async () => {
    useScenario('dns-admin')
    const { wrapper } = await mountList()
    await select(wrapper, 'example.net', 'example.org')
    wrapper.getComponent(BulkActionBar).vm.$emit('action', 'generate')
    await flushPromises()
    const dialog = wrapper.findAllComponents(GenerateKeyDialog).find((d) => d.props('open'))!
    expect(dialog.props('names').map((n: { name: string }) => n.name)).toEqual(['example.net'])
    dialog.vm.$emit('submit', { selector: 'dkim', keySize: 2048 })
    await vi.waitFor(() => expect(requests('generateDkimKey')).toHaveLength(1))
    wrapper.unmount()
  })

  it('opens the single dialog for one selected name and the run dialog for several', async () => {
    useScenario('dns-many-missing')
    const { wrapper } = await mountList('/dns/dkim-keys?state=missing')
    const missing = names(wrapper).slice(0, 3) as string[]
    await select(wrapper, ...missing)
    wrapper.getComponent(BulkActionBar).vm.$emit('action', 'generate')
    await flushPromises()
    const dialog = wrapper.findAllComponents(GenerateKeyDialog).find((d) => d.props('open'))!
    expect(dialog.props('names')).toHaveLength(3)
    dialog.vm.$emit('submit', { selector: 'dkim', keySize: 2048 })
    await vi.waitFor(() => expect(requests('generateDkimKey')).toHaveLength(3))
    wrapper.unmount()
  })

  it('deletes the selected keys in one bulk request after the number is typed', async () => {
    useScenario('dns-admin')
    const { wrapper } = await mountList()
    await select(wrapper, 'example.org', 'old.example')
    wrapper.getComponent(BulkActionBar).vm.$emit('action', 'delete')
    await vi.waitFor(() => expect(confirmState.value?.requireTyped?.accepted).toEqual(['2']))
    settleConfirm(true)
    await vi.waitFor(() => expect(requests('applyDkimKeyBulkAction')).toHaveLength(1))
    await vi.waitFor(() => expect(wrapper.find('[data-bulk-results]').exists()).toBe(true))
    wrapper.unmount()
  })

  it('says when the selection has nothing to generate', async () => {
    useScenario('dns-admin')
    const { wrapper } = await mountList()
    await select(wrapper, 'example.org')
    wrapper.getComponent(BulkActionBar).vm.$emit('action', 'generate')
    await flushPromises()
    expect(wrapper.findAllComponents(GenerateKeyDialog).some((d) => d.props('open'))).toBe(false)
    wrapper.unmount()
  })

  it('collects every name without a key, asks, and opens the generation', async () => {
    useScenario('dns-many-missing')
    const { wrapper } = await mountList()
    await vi.waitFor(() =>
      expect(wrapper.get('[data-generate-missing]').attributes('disabled')).toBeUndefined(),
    )
    await wrapper.get('[data-generate-missing]').trigger('click')
    await vi.waitFor(() => expect(confirmState.value?.description).toMatch(/\d+ names/))
    const count = Number(/(\d+) names/.exec(confirmState.value!.description!)![1])
    expect(count).toBeGreaterThan(25)
    settleConfirm(true)
    await flushPromises()
    const dialog = wrapper.findAllComponents(GenerateKeyDialog).find((d) => d.props('open'))!
    expect(dialog.props('names')).toHaveLength(count)
    expect(requests('listDkimKeys').length).toBeGreaterThan(1)
    wrapper.unmount()
  })
})
