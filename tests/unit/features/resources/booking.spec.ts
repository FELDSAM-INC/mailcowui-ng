// The booking rules (T095, research R14; legacy form map): legacy's select options and short badge
// texts, the hard limit's number with " (n)", and the range from the capabilities.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { BOOKING_OPTIONS, bookingBadge, checkBookingLimit } from '@/features/resources/booking'
import { loadLegacy, resetLegacy } from '@/i18n/legacy'

import { resource } from './resource-fixture'

beforeEach(async () => {
  await loadLegacy('en-gb')
})
afterEach(() => resetLegacy())

describe('booking rules', () => {
  it("offers legacy's three options in legacy's order", () => {
    expect(BOOKING_OPTIONS.map((option) => [option.rule, option.labelKey])).toEqual([
      ['alwaysFree', 'mailbox.booking_null'],
      ['unlimited', 'mailbox.booking_ltnull'],
      ['limited', 'mailbox.booking_custom'],
    ])
  })

  it("shows legacy's short texts, the hard limit with its number", () => {
    expect(bookingBadge(resource({ bookingRule: 'alwaysFree' }))).toBe('Always free')
    expect(bookingBadge(resource({ bookingRule: 'unlimited' }))).toBe('Soft limit')
    expect(bookingBadge(resource({ bookingRule: 'limited', bookingLimit: 2 }))).toBe(
      'Hard limit (2)',
    )
  })

  it('accepts whole numbers within the range only', () => {
    const range = { min: 1, max: 10 }
    expect(checkBookingLimit('3', range)).toBeNull()
    expect(checkBookingLimit('0', range)).toEqual({ min: 1, max: 10 })
    expect(checkBookingLimit('11', range)).toEqual({ min: 1, max: 10 })
    expect(checkBookingLimit('2.5', range)).toEqual({ min: 1, max: 10 })
    expect(checkBookingLimit('', range)).toEqual({ min: 1, max: 10 })
  })
})
