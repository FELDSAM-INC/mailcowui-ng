import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { expect, it, vi } from 'vitest'
import RuleFilters from '@/features/system-settings/components/spam/RuleFilters.vue'
import { useRuleListState } from '@/features/system-settings/rule-list-state'
import { mountWithApp } from '../../support/mount'

it('maps inactive and sort controls to URL state and resets a stale page', async () => {
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
  await selects[1]!.setValue('modifiedAt')
  await vi.waitFor(() => expect(router.currentRoute.value.query.sort).toBe('modifiedAt'))
  expect(router.currentRoute.value.query.active).toBe('no')
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Ascending')!
    .trigger('click')
  await vi.waitFor(() => expect(router.currentRoute.value.query.order).toBe('desc'))
})
