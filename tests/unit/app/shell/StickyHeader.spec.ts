import { afterEach, expect, it, vi } from 'vitest'
import StickyHeader from '@/app/shell/StickyHeader.vue'
import { mountWithApp } from '../../support/mount'

const elementFromPoint = Object.getOwnPropertyDescriptor(document, 'elementFromPoint')
afterEach(() => {
  if (elementFromPoint) Object.defineProperty(document, 'elementFromPoint', elementFromPoint)
  else Reflect.deleteProperty(document, 'elementFromPoint')
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it.each([
  { name: 'covered by the header', x: 240, y: 40, overlay: false, scroll: -32 },
  { name: 'beside the header', x: 40, y: 40, overlay: false, scroll: null },
  { name: 'below the header', x: 240, y: 80, overlay: false, scroll: null },
  { name: 'in front of the header in a dialog', x: 240, y: 40, overlay: true, scroll: null },
])('corrects focus only when it is $name', ({ x, y, overlay, scroll }) => {
  vi.useFakeTimers()
  const wrapper = mountWithApp(StickyHeader, { attachTo: document.body })
  vi.spyOn(wrapper.element, 'getBoundingClientRect').mockReturnValue(new DOMRect(200, 0, 600, 64))
  const control = document.createElement('button')
  document.body.append(control)
  vi.spyOn(control, 'getBoundingClientRect').mockReturnValue(new DOMRect(x, y, 100, 44))
  document.elementFromPoint = vi.fn(() => (overlay ? control : wrapper.element))
  const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
  control.focus()
  vi.advanceTimersByTime(50)
  if (scroll === null) expect(scrollBy).not.toHaveBeenCalled()
  else expect(scrollBy).toHaveBeenCalledWith({ top: scroll, behavior: 'instant' })
  wrapper.unmount()
  scrollBy.mockClear()
  window.dispatchEvent(new Event('resize'))
  vi.advanceTimersByTime(50)
  expect(scrollBy).not.toHaveBeenCalled()
  control.remove()
})

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
