import { afterEach, expect, it, vi } from 'vitest'
import StickyHeader from '@/app/shell/StickyHeader.vue'
import { mountWithApp } from '../../support/mount'

afterEach(() => vi.unstubAllGlobals())

it('uses the observed border size without forcing layout and cleans up on unmount', () => {
  let changed: (entries: ResizeObserverEntry[]) => void = () => {}
  const disconnect = vi.fn()
  const observe = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: (entries: ResizeObserverEntry[]) => void) {
        changed = callback
      }
      observe = observe
      disconnect = disconnect
    },
  )
  const wrapper = mountWithApp(StickyHeader)
  const rectangle = vi.spyOn(wrapper.element, 'getBoundingClientRect')
  expect(observe).toHaveBeenCalledWith(wrapper.element, { box: 'border-box' })
  changed([
    {
      target: wrapper.element,
      borderBoxSize: [{ blockSize: 210, inlineSize: 360 }],
      contentBoxSize: [{ blockSize: 200, inlineSize: 360 }],
      devicePixelContentBoxSize: [{ blockSize: 200, inlineSize: 360 }],
      contentRect: new DOMRectReadOnly(0, 0, 360, 200),
    },
  ])
  expect(document.documentElement.style.getPropertyValue('--shell-sticky-height')).toBe('210px')
  expect(rectangle).not.toHaveBeenCalled()
  wrapper.unmount()
  expect(disconnect).toHaveBeenCalledOnce()
  expect(document.documentElement.style.getPropertyValue('--shell-sticky-height')).toBe('')
})
it('still renders its header if ResizeObserver is unavailable', () => {
  vi.stubGlobal('ResizeObserver', undefined)
  const wrapper = mountWithApp(StickyHeader, { slots: { default: '<header>Account</header>' } })
  expect(wrapper.text()).toBe('Account')
  wrapper.unmount()
})
