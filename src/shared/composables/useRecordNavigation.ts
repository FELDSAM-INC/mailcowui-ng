import { computed, inject, toValue, type MaybeRefOrGetter } from 'vue'
import { routerKey, type RouteLocationRaw } from 'vue-router'

// Rows and mobile cards share navigation, including keyboard and browser modifier behavior.
// Real controls and text selection always take precedence over the surrounding record.
const controls =
  'a, button, input, select, textarea, label, summary, [role="button"], [role="link"], [role="checkbox"], [role="menuitem"], [tabindex], [contenteditable]:not([contenteditable="false"]), [data-row-interactive]'

export function useRecordNavigation(to: MaybeRefOrGetter<RouteLocationRaw | null | undefined>) {
  const router = inject(routerKey, undefined)
  const destination = computed(() => {
    const location = toValue(to)
    return location && router ? router.resolve(location) : null
  })

  function ignores(event: MouseEvent) {
    if (event.defaultPrevented || event.altKey) return true
    const root = event.currentTarget as HTMLElement
    const target = event.target instanceof Element ? event.target : null
    const control = target?.closest(controls)
    if (control && control !== root && root.contains(control)) return true
    const selection = window.getSelection()
    return (
      !!selection &&
      !selection.isCollapsed &&
      (root.contains(selection.anchorNode) || root.contains(selection.focusNode))
    )
  }

  function open(newTab: boolean) {
    if (!destination.value) return
    if (newTab) window.open(destination.value.href, '_blank', 'noopener,noreferrer')
    else void router!.push(destination.value)
  }

  function click(event: MouseEvent) {
    if (event.button !== 0 || ignores(event)) return
    open(event.ctrlKey || event.metaKey || event.shiftKey)
  }

  function auxiliaryClick(event: MouseEvent) {
    if (event.button !== 1 || ignores(event)) return
    event.preventDefault()
    open(true)
  }

  function keydown(event: KeyboardEvent) {
    if (
      event.target !== event.currentTarget ||
      event.defaultPrevented ||
      event.altKey ||
      event.repeat
    )
      return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    open(event.ctrlKey || event.metaKey || event.shiftKey)
  }

  return computed(() =>
    destination.value
      ? {
          'data-row-link': '',
          'data-row-href': destination.value.href,
          tabindex: 0,
          class:
            'cursor-pointer hover:bg-row-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
          onClick: click,
          onAuxclick: auxiliaryClick,
          onKeydown: keydown,
        }
      : {},
  )
}
