// The focus guard of sticky action bars (UI 002 T103, WCAG 2.4.11): the scroll that clears a
// focused element from a sticky bar below it, and nothing for elements inside the bar, above it or
// next to a bar that is not sticky.
import { describe, expect, it } from 'vitest'

import { coveredBy } from '@/shared/composables/useStickyBarFocus'

function box(top: number, bottom: number, position = 'static'): HTMLElement {
  const element = document.createElement('div')
  element.style.position = position
  element.getBoundingClientRect = () =>
    ({
      top,
      bottom,
      left: 0,
      right: 100,
      width: 100,
      height: bottom - top,
      x: 0,
      y: top,
    }) as DOMRect
  document.body.append(element)
  return element
}

describe('coveredBy', () => {
  it('scrolls a field under a sticky bar above it, with a margin', () => {
    const bar = box(700, 780, 'sticky')
    expect(coveredBy(box(690, 734), [bar])).toBe(42)
    expect(coveredBy(box(720, 764), [bar])).toBe(72)
  })

  it('leaves fields above the bar, inside it, and next to a bar that is not sticky', () => {
    const bar = box(700, 780, 'sticky')
    expect(coveredBy(box(600, 644), [bar])).toBe(0)
    const inside = box(710, 754)
    bar.append(inside)
    expect(coveredBy(inside, [bar])).toBe(0)
    expect(coveredBy(box(720, 764), [box(700, 780)])).toBe(0)
  })
})
