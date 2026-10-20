// Focus after navigation (FR-080, research R19): after every navigation except the first, focus
// moves to the page's `<h1 tabindex="-1">` (or a field marked `data-autofocus`), or to `<main>`
// when a page has no heading yet. UI 002 (research D9): a query-only change on the same page
// leaves the focus where it is (the search field while typing, a section or a step, which move
// focus themselves), and when Back restored a scroll position, the heading is focused without
// scrolling.
import { nextTick } from 'vue'
import type { Router } from 'vue-router'

let restored = false

/** Called by the scroll behaviour: whether this navigation restored a saved position. */
export function noteScrollRestored(value: boolean): void {
  restored = value
}

export function focusPageHeading(): void {
  // A page may name its first field instead (for example the single code field of US1-AS4).
  const first = document.querySelector<HTMLElement>('main [data-autofocus]')
  if (first) {
    first.focus()
    return
  }
  const heading = document.querySelector<HTMLElement>('main h1, h1')
  if (heading) {
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
    heading.focus({ preventScroll: restored })
    return
  }
  document.querySelector<HTMLElement>('main')?.focus({ preventScroll: restored })
}

/** An identity switch clears page queries, so the new heading may follow a loading state. */
export function focusPageHeadingWhenReady(): () => void {
  focusPageHeading()
  const main = document.querySelector<HTMLElement>('main')
  if (!main || main.querySelector('[data-autofocus], h1')) return () => {}
  const stop = () => {
    observer.disconnect()
    document.removeEventListener('focusin', onFocus)
    document.removeEventListener('pointerdown', stop)
    document.removeEventListener('keydown', stop)
  }
  const onFocus = (event: FocusEvent) => {
    if (event.target !== main) stop()
  }
  const observer = new MutationObserver(() => {
    if (!main.isConnected || document.activeElement !== main) {
      stop()
      return
    }
    if (main.querySelector('[data-autofocus], h1')) {
      stop()
      focusPageHeading()
    }
  })
  observer.observe(main, { childList: true, subtree: true })
  document.addEventListener('focusin', onFocus)
  document.addEventListener('pointerdown', stop)
  document.addEventListener('keydown', stop)
  return stop
}

export function installFocusManagement(router: Router): void {
  let first = true
  router.afterEach((to, from, failure) => {
    if (failure) return
    if (first) {
      first = false
      return
    }
    if (to.path === from.path) return
    void nextTick(() => nextTick(focusPageHeading))
  })
}
