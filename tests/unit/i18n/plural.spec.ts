// Czech and Slovak plural forms of the app's new strings (UI 005 T009, research R23, FR-119): the
// first form for 1, the second for 2 to 4 and the third for 0 and 5 or more. en-gb keeps vue-i18n's
// default choice. UI 002 to 004 ship no plural rules. (New strings are precompiled, so the rule is
// checked as a function and as the instance's registration; the account strings exercise it.)
import { describe, expect, it } from 'vitest'

import { createAppI18n, slavicPlural } from '@/i18n'

describe('slavicPlural', () => {
  it.each([
    [1, 0],
    [2, 1],
    [3, 1],
    [4, 1],
    [0, 2],
    [5, 2],
    [11, 2],
    [12, 2],
    [22, 2],
    [101, 2],
  ])('three forms: %i → form %i', (n, form) => {
    expect(slavicPlural(n, 3)).toBe(form)
  })

  it('degrades for messages with fewer forms', () => {
    expect(slavicPlural(1, 2)).toBe(0)
    expect(slavicPlural(3, 2)).toBe(1)
    expect(slavicPlural(7, 1)).toBe(0)
  })

  it('takes the absolute value of negative counts', () => {
    expect(slavicPlural(-1, 3)).toBe(0)
    expect(slavicPlural(-3, 3)).toBe(1)
  })
})

describe('registration', () => {
  it('registers the rule for cs-cz and sk-sk only', () => {
    const rules = createAppI18n().global.pluralRules
    expect(rules['cs-cz']).toBe(slavicPlural)
    expect(rules['sk-sk']).toBe(slavicPlural)
    expect(rules['en-gb']).toBeUndefined()
  })
})
