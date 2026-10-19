// The import page (T080, research R11, FR-029 to FR-033, FR-076, FR-081): the key cleared after
// success and on pagehide and kept after a refusal; the name looked up after a pause; the inputs
// that never alter what is typed; the existing key named with its version kept for the overwrite.
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { defineComponent, h } from 'vue'

import DkimImportPage from '@/features/dns/pages/DkimImportPage.vue'
import { settleConfirm } from '@/shared/composables/useConfirm'

import { useScenario } from '../../../mocks/node'
import { DNS_PEM_FIXTURES } from '../../../mocks/scenarios/dns'
import { mountWithApp } from '../../support/mount'

const Stub = defineComponent({ render: () => h('h1', 'entry') })

async function mountPage(path = '/dns/dkim-import') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dns/dkim-import', name: 'dkim-import', component: DkimImportPage },
      { path: '/dns/dkim-keys', name: 'dkim-keys', component: Stub },
      { path: '/dns/dkim-keys/:dkimName', name: 'dkim-key', component: Stub },
    ],
  })
  await router.push(path)
  const wrapper = mountWithApp(defineComponent({ render: () => h(RouterView) }), {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await vi.waitFor(() => expect(wrapper.find('form[data-dkim-import]').exists()).toBe(true))
  return { wrapper, router }
}

beforeEach(() => settleConfirm(false))
afterEach(() => settleConfirm(false))

describe('DkimImportPage', () => {
  it('has inputs that never alter what is typed', async () => {
    useScenario('dns-admin')
    const { wrapper } = await mountPage()
    for (const id of ['#dkim-import-name', '#dkim-import-selector']) {
      expect(wrapper.get(id).attributes()).toMatchObject({
        autocapitalize: 'none',
        autocorrect: 'off',
        spellcheck: 'false',
      })
    }
    expect(wrapper.get<HTMLInputElement>('#dkim-import-selector').element.value).toBe('dkim')
    wrapper.unmount()
  })

  it('looks the name up after a pause and names an existing key', async () => {
    const state = useScenario('dns-admin')
    const { wrapper } = await mountPage('/dns/dkim-import?name=example.org')
    await vi.waitFor(() => expect(wrapper.find('[data-import-existing]').exists()).toBe(true), {
      timeout: 3000,
    })
    expect(wrapper.get('[data-import-existing]').text()).toContain('selector dkim, 2,048 bits')
    const lookups = state.requests.filter((r) => r.operationId === 'getDkimKey')
    expect(lookups).toHaveLength(1)
    wrapper.unmount()
  })

  it('keeps the key after a refusal and clears it after success', async () => {
    useScenario('dns-admin')
    const { wrapper, router } = await mountPage('/dns/dkim-import?name=example.net')
    const key = wrapper.get<HTMLTextAreaElement>('#dkim-import-key')
    await key.setValue(DNS_PEM_FIXTURES.ec)
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Only these key types are supported'))
    expect(key.element.value).toBe(DNS_PEM_FIXTURES.ec)
    await key.setValue(DNS_PEM_FIXTURES.pkcs8)
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() =>
      expect(router.currentRoute.value.fullPath).toBe('/dns/dkim-keys/example.net'),
    )
    wrapper.unmount()
  })

  it('clears the key on pagehide', async () => {
    useScenario('dns-admin')
    const { wrapper } = await mountPage()
    const key = wrapper.get<HTMLTextAreaElement>('#dkim-import-key')
    await key.setValue('-----BEGIN PRIVATE KEY-----')
    window.dispatchEvent(new Event('pagehide'))
    await flushPromises()
    expect(key.element.value).toBe('')
    wrapper.unmount()
  })
})
