// Layout checks (constitution II, FR-083, SC-005, research R21, R24): no horizontal scrolling at
// narrow widths, and touch targets of at least 44 × 44 CSS px.
import { expect, type Page } from '@playwright/test'

export async function expectNoHorizontalScroll(
  page: Page,
  options: { widths?: number[] } = {},
): Promise<void> {
  const original = page.viewportSize()
  for (const width of options.widths ?? [360, 320]) {
    await page.setViewportSize({ width, height: original?.height ?? 780 })
    // Let media-query listeners re-render the layout (for example the navigation drawer) first.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    )
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(metrics.scrollWidth, `horizontal scroll at ${width} px`).toBeLessThanOrEqual(
      metrics.clientWidth,
    )
  }
  if (original) await page.setViewportSize(original)
}

/**
 * Visible buttons, inputs, selects and standalone links must be at least 44 × 44 px. A label that
 * wraps or names a control counts as its target. Links inside running text are exempt (WCAG 2.5.8).
 */
export async function expectTouchTargets(page: Page): Promise<void> {
  const small = await page.evaluate(() => {
    const SELECTOR =
      'button, input:not([type=hidden]), select, textarea, a[href], [role=button], [role=link], [role=checkbox], [role=radio], [role=switch], [role=menuitem], summary'
    const INLINE = new Set(['SPAN', 'STRONG', 'EM', 'B', 'I', 'SMALL', 'U', 'CODE', 'TIME', 'ABBR'])
    const visible = (element: Element) => {
      if (element.closest('[aria-hidden="true"], [inert]')) return false
      const style = getComputedStyle(element)
      if (style.visibility === 'hidden' || style.display === 'none') return false
      const rect = element.getBoundingClientRect()
      return rect.width > 1 && rect.height > 1
    }
    const inRunningText = (link: Element) => {
      let block: Element | null = link.parentElement
      while (block && INLINE.has(block.tagName)) block = block.parentElement
      if (!block) return false
      const own = (link.textContent ?? '').trim()
      const all = (block.textContent ?? '').trim()
      return all.length > own.length
    }
    const failures: string[] = []
    for (const element of document.querySelectorAll(SELECTOR)) {
      if (!visible(element)) continue
      if (element.tagName === 'A' && inRunningText(element)) continue
      let { width, height } = element.getBoundingClientRect()
      const label =
        element.closest('label') ??
        (element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`) : null)
      if (label && (width < 44 || height < 44)) {
        const box = label.getBoundingClientRect()
        width = Math.max(width, box.width)
        height = Math.max(height, box.height)
      }
      if (width < 43.5 || height < 43.5) {
        const name =
          element.getAttribute('aria-label') ?? (element.textContent ?? '').trim().slice(0, 40)
        failures.push(
          `${element.tagName.toLowerCase()} "${name}" ${Math.round(width)}×${Math.round(height)}`,
        )
      }
    }
    return failures
  })
  expect(small, 'touch targets smaller than 44 × 44 px').toEqual([])
}
