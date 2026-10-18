// Focus after navigation (FR-080, research R19): after every navigation except the first, focus
// moves to the page's `<h1 tabindex="-1">`, or to `<main>` when a page has no heading yet.
import { nextTick } from 'vue'
import type { Router } from 'vue-router'

export function focusPageHeading(): void {
  const heading = document.querySelector<HTMLElement>('main h1, h1')
  if (heading) {
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
    heading.focus({ preventScroll: false })
    return
  }
  document.querySelector<HTMLElement>('main')?.focus()
}

export function installFocusManagement(router: Router): void {
  let first = true
  router.afterEach((to, from, failure) => {
    if (failure) return
    if (first) {
      first = false
      return
    }
    if (to.path === from.path && to.hash !== from.hash) return
    void nextTick(() => nextTick(focusPageHeading))
  })
}
