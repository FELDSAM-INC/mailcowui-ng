// UI 011 (research R15, data-model §2, T090): the content viewer shows the first 262,144 UTF-16
// code units at first, never splitting a surrogate pair, and the rest on request.
import { describe, expect, it } from 'vitest'

import { FIRST_VIEW_LENGTH, firstView } from '@/features/operations/mail-queue/content'

describe('firstView', () => {
  it('keeps short content whole', () => {
    expect(firstView('Subject: hi\n')).toEqual({ text: 'Subject: hi\n', rest: 0 })
  })

  it('cuts after 262,144 code units and counts the rest', () => {
    expect(FIRST_VIEW_LENGTH).toBe(262_144)
    const content = 'a'.repeat(FIRST_VIEW_LENGTH + 10)
    const view = firstView(content)
    expect(view.text).toHaveLength(FIRST_VIEW_LENGTH)
    expect(view.rest).toBe(10)
  })

  it('never splits a surrogate pair', () => {
    const content = `${'a'.repeat(FIRST_VIEW_LENGTH - 1)}😀tail`
    const view = firstView(content)
    expect(view.text).toHaveLength(FIRST_VIEW_LENGTH - 1)
    expect(view.text + content.slice(view.text.length)).toBe(content)
    expect(view.rest).toBe(content.length - (FIRST_VIEW_LENGTH - 1))
  })
})
