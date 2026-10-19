// Keeps the focused element above a sticky action bar at the bottom of a form or an edited section
// (WCAG 2.4.11, UI 002 FR-071). `scroll-padding-bottom` (styles/main.css) does this where the
// browser honours it when focus moves; WebKit does not, so after each focus change the page is
// scrolled by the part of the focused element that the bar covers.
import { onBeforeUnmount, onMounted } from 'vue'

// UI 004 adds the bulk action bar (`data-bulk-bar`), which sticks to the bottom of the lists.
export const STICKY_BAR_SELECTOR =
  '[data-sticky-save], [data-section-actions].sticky, [data-bulk-bar]'

let users = 0

/** The distance to scroll so that `element` clears every sticky bar below it, or 0. */
export function coveredBy(element: Element, bars: Iterable<Element>): number {
  const rect = element.getBoundingClientRect()
  let scroll = 0
  for (const bar of bars) {
    if (bar.contains(element) || getComputedStyle(bar).position !== 'sticky') continue
    const area = bar.getBoundingClientRect()
    if (rect.bottom > area.top && rect.top < area.bottom) {
      scroll = Math.max(scroll, rect.bottom - area.top + 8)
    }
  }
  return scroll
}

function onFocusIn(event: FocusEvent) {
  const target = event.target
  if (!(target instanceof Element)) return
  requestAnimationFrame(() => {
    if (document.activeElement !== target) return
    const scroll = coveredBy(target, document.querySelectorAll(STICKY_BAR_SELECTOR))
    if (scroll > 0) window.scrollBy({ top: scroll })
  })
}

/** Installs the focus guard while a component with a sticky action bar is mounted. */
export function useStickyBarFocus(): void {
  onMounted(() => {
    if (users++ === 0) document.addEventListener('focusin', onFocusIn)
  })
  onBeforeUnmount(() => {
    if (--users === 0) document.removeEventListener('focusin', onFocusIn)
  })
}
