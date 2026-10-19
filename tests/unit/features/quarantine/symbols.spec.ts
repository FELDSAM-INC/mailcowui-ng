// UI 006 T046 (FR-022, research R13): the filter's symbols in legacy's order (`js/site/quarantine.js`:
// positive scores from highest to lowest, then negative scores from lowest to highest, then zero),
// equal scores in stored order, and each score signed in text.
import { describe, expect, it } from 'vitest'

import { formatSymbolScore, sortSymbols } from '@/features/quarantine/symbols'

const symbol = (name: string, score: number) => ({ name, score, options: [] })

describe('quarantine symbols', () => {
  it('sorts as legacy: positives descending, negatives ascending, zeros last', () => {
    const sorted = sortSymbols([
      symbol('ZERO_A', 0),
      symbol('NEG_SMALL', -0.1),
      symbol('POS_SMALL', 0.1),
      symbol('POS_BIG', 5.1),
      symbol('NEG_BIG', -2.5),
      symbol('ZERO_B', 0),
      symbol('POS_MID', 1.2),
    ])
    expect(sorted.map((item) => item.name)).toEqual([
      'POS_BIG',
      'POS_MID',
      'POS_SMALL',
      'NEG_BIG',
      'NEG_SMALL',
      'ZERO_A',
      'ZERO_B',
    ])
  })

  it('keeps the stored order of equal scores and leaves the input unchanged', () => {
    const input = [symbol('B', 1), symbol('A', 1), symbol('C', -1), symbol('D', -1)]
    expect(sortSymbols(input).map((item) => item.name)).toEqual(['B', 'A', 'C', 'D'])
    expect(input.map((item) => item.name)).toEqual(['B', 'A', 'C', 'D'])
  })

  it('signs scores in text in the locale', () => {
    expect(formatSymbolScore(3.5, 'en-gb')).toBe('+3.5')
    expect(formatSymbolScore(-1.25, 'en-gb')).toBe('-1.25')
    expect(formatSymbolScore(0, 'en-gb')).toBe('0')
    expect(formatSymbolScore(1500, 'en-gb')).toBe('+1,500')
    expect(formatSymbolScore(-0.5, 'cs-cz')).toMatch(/^[-−]0,5$/)
  })
})
