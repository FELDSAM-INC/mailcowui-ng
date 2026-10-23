import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import DataRow from '@/shared/components/DataRow.vue'
import { mountWithApp } from '../../support/mount'

async function row(to: string | null = '/objects/one') {
  const router = createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [
      { path: '/objects', component: { render: () => null } },
      { path: '/objects/:id', component: { render: () => null } },
    ],
  })
  await router.push('/objects')
  const wrapper = mountWithApp(DataRow, {
    props: { to, label: 'one' },
    slots: {
      default:
        '<td>one</td><td>another value</td><td><button>Expand</button><label><input type="checkbox">Select</label><a href="/action">Action</a></td>',
    },
    global: { plugins: [router] },
  })
  return { wrapper, router }
}

describe('whole-row navigation', () => {
  it('opens the record from any plain cell and restores the list with back', async () => {
    const { wrapper, router } = await row()
    await wrapper.findAll('td')[1]!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/objects/one')
    router.back()
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/objects')
  })

  it.each(['button', 'input', 'label', 'a'])(
    'leaves %s interactions to the control',
    async (selector) => {
      const { wrapper, router } = await row()
      await wrapper.get(selector).trigger('click')
      await wrapper.get(selector).trigger('keydown', { key: 'Enter' })
      await flushPromises()
      expect(router.currentRoute.value.path).toBe('/objects')
    },
  )

  it('supports keyboard activation without hijacking modified keys', async () => {
    const { wrapper, router } = await row()
    expect(wrapper.attributes('tabindex')).toBe('0')
    await wrapper.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/objects/one')
  })

  it('opens modified and middle clicks in a new tab without changing the current route', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const { wrapper, router } = await row()
    await wrapper.findAll('td')[1]!.trigger('click', { ctrlKey: true })
    await wrapper.trigger('auxclick', { button: 1 })
    expect(open).toHaveBeenCalledTimes(2)
    expect(open).toHaveBeenLastCalledWith('/ng/objects/one', '_blank', 'noopener,noreferrer')
    expect(router.currentRoute.value.path).toBe('/objects')
    open.mockRestore()
  })

  it('does not offer navigation for rows without a detail page', async () => {
    const { wrapper, router } = await row(null)
    expect(wrapper.attributes('tabindex')).toBeUndefined()
    expect(wrapper.attributes('data-row-link')).toBeUndefined()
    await wrapper.trigger('click')
    expect(router.currentRoute.value.path).toBe('/objects')
  })
})
