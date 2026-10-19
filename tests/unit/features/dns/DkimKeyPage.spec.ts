// The DKIM entry page (T037, T039, T087; FR-016 to FR-020, FR-037 to FR-039, FR-090): the readable
// heading, facts and record, the not-found page, "Add ARC/DKIM key" for a name without a key, the
// replacement and the removal with their confirmations, a key changed elsewhere (412) asked again,
// and a key that vanished. The end-to-end suite covers the same flows in the browser.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import GenerateKeyDialog from '@/features/dns/components/GenerateKeyDialog.vue'
import ReplaceKeyDialog from '@/features/dns/components/ReplaceKeyDialog.vue'
import DkimKeyPage from '@/features/dns/pages/DkimKeyPage.vue'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'

import { mockState, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

const Stub = defineComponent({ render: () => h('h1', 'stub') })

async function mountEntry(name: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dns/dkim-keys', name: 'dkim-keys', component: Stub },
      { path: '/dns/dkim-keys/:dkimName', name: 'dkim-key', component: DkimKeyPage },
      { path: '/dns/dkim-keys/:dkimName/copy', name: 'dkim-copy', component: Stub },
      { path: '/dns/dkim-import', name: 'dkim-import', component: Stub },
      { path: '/dns/diagnostics/:diagnosticsName', name: 'dns-diagnostics', component: Stub },
      { path: '/audit-log', name: 'audit-log', component: Stub },
      { path: '/domains', name: 'domains', component: Stub },
    ],
  })
  await router.push(`/dns/dkim-keys/${encodeURIComponent(name)}`)
  const wrapper = mountWithApp(defineComponent({ render: () => h(RouterView) }), {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await vi.waitFor(() =>
    expect(wrapper.find('article, [data-page-loading], section').exists()).toBe(true),
  )
  await vi.waitFor(() => expect(wrapper.find('[data-page-loading]').exists()).toBe(false))
  return { wrapper, router }
}

const requests = (operationId: string) =>
  mockState().requests.filter((request) => request.operationId === operationId)

afterEach(() => {
  settleConfirm(false)
  document.body.innerHTML = ''
})

describe('DkimKeyPage', () => {
  it('shows the entry with its facts, record and the administrator actions', async () => {
    useScenario('dns-admin')
    const { wrapper } = await mountEntry('example.org')
    expect(wrapper.get('h1').text()).toBe('example.org')
    await vi.waitFor(() => expect(wrapper.find('[data-delete]').exists()).toBe(true))
    expect(wrapper.text()).toContain('Replace with a new key')
    expect(wrapper.find('[data-dkim-record]').exists()).toBe(true)
    expect(wrapper.find('a[href^="/audit-log"]').attributes('href')).toContain('targetType=dkimKey')
    wrapper.unmount()
  })

  it('shows the not-found page for an unknown name', async () => {
    useScenario('dns-admin')
    const { wrapper } = await mountEntry('unknown.example')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Page not found'))
    wrapper.unmount()
  })

  it('says the entry could not be loaded and offers to try again', async () => {
    useScenario('dns-admin')
    mockState().failures.getDkimKey = { status: 500, times: 1 }
    const { wrapper } = await mountEntry('example.org')
    await vi.waitFor(() => expect(wrapper.text()).toContain('The DKIM key could not be loaded.'))
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Try again')!
      .trigger('click')
    await vi.waitFor(() => expect(wrapper.get('h1').text()).toBe('example.org'))
    wrapper.unmount()
  })

  it('generates a key for a name without one from the dialog', async () => {
    useScenario('dns-admin')
    const { wrapper } = await mountEntry('example.net')
    await vi.waitFor(() => expect(wrapper.find('[data-generate]').exists()).toBe(true))
    await wrapper.get('[data-generate]').trigger('click')
    const dialog = wrapper.findAllComponents(GenerateKeyDialog).find((d) => d.props('open'))!
    expect(dialog.props('names')).toEqual([{ name: 'example.net', label: 'example.net' }])
    dialog.vm.$emit('submit', { selector: 'dkim', keySize: 2048 })
    await vi.waitFor(() => expect(requests('generateDkimKey')).toHaveLength(1))
    await vi.waitFor(() => expect(wrapper.find('[data-delete]').exists()).toBe(true))
    wrapper.unmount()
  })

  it('replaces the key after the confirmation names the old selector', async () => {
    useScenario('dns-admin')
    const { wrapper } = await mountEntry('example.org')
    await vi.waitFor(() => expect(wrapper.findComponent(ReplaceKeyDialog).exists()).toBe(true))
    wrapper.getComponent(ReplaceKeyDialog).vm.$emit('submit', { selector: 'new', keySize: 2048 })
    await vi.waitFor(() => expect(confirmState.value?.description).toContain('dkim'))
    settleConfirm(true)
    await vi.waitFor(() => expect(requests('generateDkimKey')).toHaveLength(1))
    const sent = requests('generateDkimKey')[0]!
    expect(sent.headers['if-match']).toBeTruthy()
    await vi.waitFor(() =>
      expect(wrapper.get('[data-entry-status]').text()).toContain('example.org'),
    )
    wrapper.unmount()
  })

  it('asks again with the fresh key when the replacement finds it changed elsewhere', async () => {
    useScenario('dns-admin')
    mockState().failures.generateDkimKey = { status: 412, type: 'version-outdated', times: 1 }
    const { wrapper } = await mountEntry('example.org')
    await vi.waitFor(() => expect(wrapper.findComponent(ReplaceKeyDialog).exists()).toBe(true))
    wrapper.getComponent(ReplaceKeyDialog).vm.$emit('submit', { selector: 'new', keySize: 2048 })
    await vi.waitFor(() => expect(confirmState.value).not.toBeNull())
    settleConfirm(true)
    await vi.waitFor(() => expect(requests('getDkimKey').length).toBeGreaterThan(1))
    await vi.waitFor(() => expect(confirmState.value).not.toBeNull())
    settleConfirm(false)
    await flushPromises()
    expect(requests('generateDkimKey')).toHaveLength(1)
    wrapper.unmount()
  })

  it('removes the key after the confirmation with its impact, and confirms again after a 412', async () => {
    useScenario('dns-admin')
    mockState().failures.deleteDkimKey = { status: 412, type: 'version-outdated', times: 1 }
    const { wrapper } = await mountEntry('example.org')
    await vi.waitFor(() => expect(wrapper.find('[data-delete]').exists()).toBe(true))
    await wrapper.get('[data-delete]').trigger('click')
    await vi.waitFor(() => expect(confirmState.value?.content).toBeTruthy())
    settleConfirm(true)
    await vi.waitFor(() => expect(requests('deleteDkimKey')).toHaveLength(1))
    await vi.waitFor(() => expect(confirmState.value).not.toBeNull())
    settleConfirm(true)
    await vi.waitFor(() => expect(requests('deleteDkimKey')).toHaveLength(2))
    await vi.waitFor(() =>
      expect(wrapper.get('[data-entry-status]').text()).toContain('example.org'),
    )
    wrapper.unmount()
  })

  it('returns to the list after removing an unused key', async () => {
    useScenario('dns-admin')
    const { wrapper, router } = await mountEntry('old.example')
    await vi.waitFor(() => expect(wrapper.find('[data-delete]').exists()).toBe(true))
    await wrapper.get('[data-delete]').trigger('click')
    await vi.waitFor(() => expect(confirmState.value).not.toBeNull())
    settleConfirm(true)
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('dkim-keys'))
    wrapper.unmount()
  })

  it('says the key is gone when it vanished before the removal', async () => {
    useScenario('dns-admin')
    mockState().failures.deleteDkimKey = { status: 404, type: 'not-found', times: 1 }
    const { wrapper } = await mountEntry('example.org')
    await vi.waitFor(() => expect(wrapper.find('[data-delete]').exists()).toBe(true))
    await wrapper.get('[data-delete]').trigger('click')
    await vi.waitFor(() => expect(confirmState.value).not.toBeNull())
    settleConfirm(true)
    await vi.waitFor(() => expect(wrapper.find('[data-entry-status]').exists()).toBe(true))
    expect(wrapper.get('[data-entry-status]').attributes('role')).toBe('alert')
    wrapper.unmount()
  })
})
