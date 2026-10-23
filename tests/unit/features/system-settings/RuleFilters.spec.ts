import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { expect, it, vi } from 'vitest'
import { installMatchMedia } from '../../support/media'
import RuleFilters from '@/features/system-settings/components/spam/RuleFilters.vue'
import { useRuleListState } from '@/features/system-settings/rule-list-state'
import { mountWithApp } from '../../support/mount'

it('maps the inactive filter to URL state and resets a stale page', async () => {
  installMatchMedia({ '(min-width: 768px)': true })
  const Host = defineComponent({
    setup() {
      const list = useRuleListState()
      return () => h(RuleFilters, { list })
    },
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: Host }],
  })
  await router.push('/?q=needle&page=2')
  await router.isReady()
  const wrapper = mountWithApp(RouterView, { global: { plugins: [router] } })
  const selects = wrapper.findAll('select')
  await selects[0]!.setValue('no')
  await vi.waitFor(() =>
    expect(router.currentRoute.value.query).toEqual({ q: 'needle', active: 'no' }),
  )
  expect(wrapper.findAll('select')).toHaveLength(1)
  expect(wrapper.find('[data-sort]').exists()).toBe(false)
})
