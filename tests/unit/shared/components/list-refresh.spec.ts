import { defineComponent, h, nextTick, ref } from 'vue'
import { expect, it, vi } from 'vitest'
import ListToolbar from '@/shared/components/ListToolbar.vue'
import { useDataList } from '@/shared/composables/useDataList'
import { mountWithApp } from '../../support/mount'

it('owns the refresh label, icon and pending state for every list', async () => {
  const run = vi.fn()
  const pending = ref(false)
  const wrapper = mountWithApp(
    defineComponent({
      setup() {
        useDataList('refresh-test', undefined, () => ({ run, pending: pending.value }))
        return () => h(ListToolbar)
      },
    }),
  )
  const button = wrapper.get('[data-list-controls] [data-refresh]')
  expect(button.text()).toBe('Refresh')
  expect(button.findAll('svg')).toHaveLength(1)
  await button.trigger('click')
  expect(run).toHaveBeenCalledOnce()
  pending.value = true
  await nextTick()
  expect(button.attributes('disabled')).toBeDefined()
  await button.trigger('click')
  expect(run).toHaveBeenCalledOnce()
  wrapper.unmount()
})
