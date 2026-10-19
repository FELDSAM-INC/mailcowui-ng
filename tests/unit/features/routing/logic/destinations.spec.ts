// Several transport destinations in one field (UI 009 T055, legacy form map decision 10).
import { describe, expect, it } from 'vitest'

import { splitDestinations } from '@/features/routing/logic/destinations'

describe('transport destinations', () => {
  it('splits as legacy does, trims, drops empties and keeps the first spelling once', () => {
    expect(
      splitDestinations('a.example, b.example;c.example\nd.example  e.example', false),
    ).toEqual(['a.example', 'b.example', 'c.example', 'd.example', 'e.example'])
    expect(splitDestinations(' A.example,a.example,,; ', false)).toEqual(['A.example'])
  })

  it('splits MX-based patterns on whitespace only', () => {
    expect(splitDestinations('mx[0-9]{1,2}\\.example\\.com .*\\.google\\.com', true)).toEqual([
      'mx[0-9]{1,2}\\.example\\.com',
      '.*\\.google\\.com',
    ])
  })
})
