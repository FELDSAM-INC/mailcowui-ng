// The leave guard (UI 002 T018, research D21): while armed, leaving the route or changing its path
// asks through useConfirm and a `beforeunload` listener is registered; query-only changes are
// left to the page; nothing is asked when disarmed; the listener goes away on unmount.
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, type Ref } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import * as confirmModule from '@/shared/composables/useConfirm'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { i18n } from '@/i18n'

let guard: Ref<boolean>

const Form = defineComponent({
  setup() {
    useLeaveGuard(guard, { messageKey: 'leaveGuard.body' })
    return () => h('form')
  },
})

async function setup(initial: boolean) {
  guard = ref(initial)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/form/:id', component: Form },
      { path: '/other', component: { render: () => h('p', 'other') } },
    ],
  })
  await router.push('/form/1')
  const wrapper = mount({ render: () => h(RouterView) }, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return { router, wrapper }
}

describe('useLeaveGuard', () => {
  afterEach(() => vi.restoreAllMocks())

  it('asks before leaving the route and stays when the user declines', async () => {
    const ask = vi.spyOn(confirmModule, 'confirm').mockResolvedValue(false)
    const { router } = await setup(true)
    await router.push('/other')
    expect(ask).toHaveBeenCalledTimes(1)
    expect(ask.mock.calls[0]![0]).toMatchObject({ description: 'Your changes will be lost.' })
    expect(router.currentRoute.value.path).toBe('/form/1')
    ask.mockResolvedValue(true)
    await router.push('/other')
    expect(router.currentRoute.value.path).toBe('/other')
  })

  it('asks when the path changes, but not for query-only changes', async () => {
    const ask = vi.spyOn(confirmModule, 'confirm').mockResolvedValue(true)
    const { router } = await setup(true)
    await router.push('/form/1?edit=general')
    expect(ask).not.toHaveBeenCalled()
    await router.push('/form/2')
    expect(ask).toHaveBeenCalledTimes(1)
  })

  it('asks nothing while disarmed', async () => {
    const ask = vi.spyOn(confirmModule, 'confirm')
    const { router } = await setup(false)
    await router.push('/other')
    expect(ask).not.toHaveBeenCalled()
  })

  it('registers beforeunload while armed and removes it on unmount', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const { wrapper } = await setup(true)
    const listener = add.mock.calls.find(([type]) => type === 'beforeunload')?.[1]
    expect(listener).toBeDefined()
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    guard.value = false
    await flushPromises()
    expect(remove).toHaveBeenCalledWith('beforeunload', listener)
    guard.value = true
    await flushPromises()
    wrapper.unmount()
    expect(
      remove.mock.calls.filter(([type]) => type === 'beforeunload').length,
    ).toBeGreaterThanOrEqual(2)
  })
})
