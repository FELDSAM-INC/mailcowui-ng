// The booking rules of a resource (research R14; legacy form map): legacy's "Multiple bookings"
// select (`mailbox.booking_null`, `booking_ltnull`, `booking_custom`), its short badge texts
// (`mailbox.booking_0_short`, `booking_lt0_short`, `booking_custom_short` with " (n)" as the
// classic list shows the hard limit), and the hard limit's range from the capabilities.
import type { Resource, ResourceBookingRule } from '@/api'
import { lt, type LegacyKey } from '@/i18n'

export interface BookingOption {
  rule: ResourceBookingRule
  labelKey: LegacyKey
  shortKey: LegacyKey
}

export const BOOKING_OPTIONS: readonly BookingOption[] = [
  { rule: 'alwaysFree', labelKey: 'mailbox.booking_null', shortKey: 'mailbox.booking_0_short' },
  { rule: 'unlimited', labelKey: 'mailbox.booking_ltnull', shortKey: 'mailbox.booking_lt0_short' },
  { rule: 'limited', labelKey: 'mailbox.booking_custom', shortKey: 'mailbox.booking_custom_short' },
]

export function bookingBadge(resource: Pick<Resource, 'bookingRule' | 'bookingLimit'>): string {
  const option = BOOKING_OPTIONS.find((item) => item.rule === resource.bookingRule)
  const text = option ? lt(option.shortKey) : resource.bookingRule
  return resource.bookingRule === 'limited' && resource.bookingLimit !== null
    ? `${text} (${resource.bookingLimit})`
    : text
}

/** Null when the hard limit is a whole number within the range; otherwise the range. */
export function checkBookingLimit(
  text: string,
  range: { min: number; max: number },
): { min: number; max: number } | null {
  const value = text.trim()
  if (!/^\d+$/.test(value)) return range
  const number = Number(value)
  return number < range.min || number > range.max ? range : null
}
