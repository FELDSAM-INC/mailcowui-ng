// Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md.
const FOCUSABLE =
  'input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

/**
 * Reka selects the whole value of an auto-focused input. Focus the first field
 * with the caret at the end instead, so prefilled values are not highlighted.
 */
export function focusFirstFieldOnOpen(event: Event, root?: HTMLElement | null) {
  // A parent listener that already called preventDefault owns the focus.
  if (event.defaultPrevented) return
  event.preventDefault()

  const el = root?.querySelector<HTMLElement>(FOCUSABLE) ?? root
  el?.focus({ preventScroll: true })

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    try {
      const end = el.value.length
      el.setSelectionRange(end, end)
    } catch {
      // input types without selection support (e.g. number, email)
    }
  }
}
