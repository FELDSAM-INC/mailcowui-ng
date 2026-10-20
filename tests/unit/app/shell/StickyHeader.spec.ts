import { expect, it, vi } from 'vitest'
import StickyHeader from '@/app/shell/StickyHeader.vue'
import { mountWithApp } from '../../support/mount'

it('measures the complete sticky region and removes its height when unmounted', () => {
  let changed = () => {}
  const disconnect = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        changed = callback
      }
      observe() {}
      disconnect = disconnect
    },
  )
  const wrapper = mountWithApp(StickyHeader)
  vi.spyOn(wrapper.element, 'getBoundingClientRect').mockReturnValue({ height: 210 })
  changed()
  expect(document.documentElement.style.getPropertyValue('--shell-sticky-height')).toBe('210px')
  wrapper.unmount()
  expect(disconnect).toHaveBeenCalledOnce()
  expect(document.documentElement.style.getPropertyValue('--shell-sticky-height')).toBe('')
  vi.unstubAllGlobals()
})
it('still renders its header if ResizeObserver is unavailable', () => {
  vi.stubGlobal('ResizeObserver', undefined)
  const wrapper = mountWithApp(StickyHeader, { slots: { default: '<header>Account</header>' } })
  expect(wrapper.text()).toBe('Account')
  vi.unstubAllGlobals()
})
