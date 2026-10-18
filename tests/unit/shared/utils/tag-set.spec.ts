// Tags edited as a set (UI 002 T022, research D13, FR-039, FR-040).
import { describe, expect, it } from 'vitest'

import { addTags, exceedsTagLimit, removeTag, sameTagSet } from '@/shared/utils/tag-set'

describe('tag sets', () => {
  it('trims, ignores empty entries and splits on commas', () => {
    expect(addTags([], '  a , ,b,  ', { maxLength: 255 })).toEqual({
      tags: ['a', 'b'],
      refused: [],
    })
  })

  it('keeps case-only duplicates once with the first spelling', () => {
    expect(addTags(['Customer'], 'customer, CUSTOMER, new', { maxLength: 255 })).toEqual({
      tags: ['Customer', 'new'],
      refused: [],
    })
  })

  it('refuses tags longer than the maximum', () => {
    expect(addTags([], `ok,${'x'.repeat(256)}`, { maxLength: 255 })).toEqual({
      tags: ['ok'],
      refused: ['x'.repeat(256)],
    })
  })

  it('removes a tag', () => {
    expect(removeTag(['a', 'b'], 'a')).toEqual(['b'])
  })

  it('compares sets ignoring letter case and order', () => {
    expect(sameTagSet(['a', 'B'], ['b', 'A'])).toBe(true)
    expect(sameTagSet(['a'], ['a', 'b'])).toBe(false)
  })

  it('applies the limit, but lets a set above it shrink', () => {
    const stored = Array.from({ length: 27 }, (_, i) => `t${i}`)
    expect(exceedsTagLimit(stored.slice(0, 25), [], 25)).toBe(false)
    expect(exceedsTagLimit(stored.slice(0, 26), [], 25)).toBe(true)
    expect(exceedsTagLimit(stored.slice(1), stored, 25)).toBe(false)
    expect(exceedsTagLimit([...stored.slice(1), 'new'], stored, 25)).toBe(true)
    expect(exceedsTagLimit(stored, stored, 25)).toBe(false)
  })
})
