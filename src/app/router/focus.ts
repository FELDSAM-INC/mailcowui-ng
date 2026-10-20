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

/** A fragment is an element id, never a CSS selector. Invalid encodings have no target. */
function fragmentId(hash: string): string | undefined {
  if (!hash.startsWith('#') || hash.length === 1) return undefined
  try {
    return decodeURIComponent(hash.slice(1))
  } catch {
    return undefined
  }
}

export function fragmentElement(hash: string): HTMLElement | undefined {
  const id = fragmentId(hash)
  const element = id ? document.getElementById(id) : null
  return element?.closest('main') ? element : undefined
}

/** Lazy sections follow their data. Stop waiting on navigation or deliberate user interaction. */
function focusFragmentWhenReady(hash: string): () => void {
  if (!fragmentId(hash)) {
    focusPageHeading()
    return () => {}
  }
  let observer: MutationObserver | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const stop = () => {
    observer?.disconnect()
    observer = undefined
    clearTimeout(timer)
    timer = undefined
    document.removeEventListener('focusin', stop)
    document.removeEventListener('pointerdown', stop)
    document.removeEventListener('keydown', stop)
  }
  const focus = () => {
    const element = fragmentElement(hash)
    // A section wrapper can exist during loading; wait for its real heading to arrive.
    const headingSelector = 'h1, h2, h3, h4, h5, h6, [role="heading"]'
    const target = element?.matches(headingSelector)
      ? element
      : element?.querySelector<HTMLElement>(headingSelector)
    if (!target) return false
    stop()
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
    target.focus({ preventScroll: true })
    // Native scrolling honours the shell's sticky-header scroll padding. Back/Forward keeps
    // the router's restored position, and lazy targets receive the same treatment as ready ones.
    if (!restored) target.scrollIntoView?.({ block: 'start' })
    return true
  }
  if (focus()) return stop
  observer = new MutationObserver(focus)
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['id'],
  })
  timer = setTimeout(() => {
    stop()
    focusPageHeading()
  }, 3000)
  document.addEventListener('focusin', stop)
  document.addEventListener('pointerdown', stop)
  document.addEventListener('keydown', stop)
  return stop
}

export function installFocusManagement(router: Router): () => void {
  let first = true
  let navigation = 0
  let stopWaiting = () => {}
  const removeHook = router.afterEach((to, from, failure) => {
    if (failure) return
    stopWaiting()
    const current = ++navigation
    const initial = first
    first = false
    // A first visit leaves ordinary focus alone. Deep links and hash-only navigation still
    // need section focus; query-only changes must retain the search/editing field's focus.
    if ((initial && !to.hash) || (to.path === from.path && to.hash === from.hash)) return
    void nextTick(() =>
      nextTick(() => {
        if (current !== navigation) return
        if (to.hash) stopWaiting = focusFragmentWhenReady(to.hash)
        else focusPageHeading()
      }),
    )
  })
  return () => {
    navigation++
    stopWaiting()
    removeHook()
  }
}
