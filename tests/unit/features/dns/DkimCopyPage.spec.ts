// The copy page (T080, T084, FR-034 to FR-036): the source summary, the targets, the overwrite
// confirmation for targets with a key, one request per target and an incomplete source.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { defineComponent, h } from 'vue'

import DkimCopyPage from '@/features/dns/pages/DkimCopyPage.vue'
import DomainPicker from '@/shared/components/DomainPicker.vue'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'

import { useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

const Stub = defineComponent({ render: () => h('h1', 'stub') })

async function mountPage(name: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dns/dkim-keys/:dkimName/copy', name: 'dkim-copy', component: DkimCopyPage },
      { path: '/dns/dkim-keys', name: 'dkim-keys', component: Stub },
      { path: '/dns/dkim-keys/:dkimName', name: 'dkim-key', component: Stub },
    ],
  })
  await router.push(`/dns/dkim-keys/${name}/copy`)
  const wrapper = mountWithApp(defineComponent({ render: () => h(RouterView) }), {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await vi.waitFor(() => expect(wrapper.find('[data-copy-source]').exists()).toBe(true))
  return wrapper
}

afterEach(() => settleConfirm(false))

describe('DkimCopyPage', () => {
  it('copies to each target with one request, asking before overwriting', async () => {
    const state = useScenario('dns-admin')
    const wrapper = await mountPage('example.org')
    const picker = wrapper.getComponent(DomainPicker)
    const source = picker.props('sources')[0]!
    await source.fetchPage({ q: '', offset: 0, limit: 100 })
    picker.vm.$emit('update:modelValue', ['example.net', 'shop.example'])
    await flushPromises()
    expect(wrapper.get('[data-copy-has-key]').text()).toContain('shop.example has a key')
    await wrapper.get('form[data-dkim-copy]').trigger('submit')
    await vi.waitFor(() => expect(confirmState.value?.description).toContain('shop.example'))
    settleConfirm(true)
    await vi.waitFor(() =>
      expect(state.requests.filter((r) => r.operationId === 'copyDkimKey')).toHaveLength(2),
    )
    wrapper.unmount()
  })

  it('refuses to copy an incomplete key', async () => {
    useScenario('dns-admin')
    const wrapper = await mountPage('incomplete.example')
    expect(wrapper.find('[data-copy-incomplete]').exists()).toBe(true)
    expect(wrapper.find('form').exists()).toBe(false)
    wrapper.unmount()
  })
})
