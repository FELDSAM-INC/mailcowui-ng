// The expiry of a new API key (FR-065, data-model §6): never (preselected), 30, 90 or 365 days
// from the moment of submitting, or a specific date and time entered in the device's time zone
// with `<input type="datetime-local">`, sent as UTC RFC 3339 and required to lie in the future.
export const EXPIRY_CHOICES = ['never', '30', '90', '365', 'custom'] as const
export type ExpiryChoice = (typeof EXPIRY_CHOICES)[number]

const DAY_MS = 86_400_000

export function presetExpiry(days: number, now: number = Date.now()): string {
  return new Date(now + days * DAY_MS).toISOString()
}

/** A `datetime-local` value (device time zone) as UTC RFC 3339, or null when it is not a date. */
export function localInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(value)) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** A date as a `datetime-local` value in the device time zone, to the minute. */
export function localInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

export function isInFuture(iso: string, now: number = Date.now()): boolean {
  return new Date(iso).getTime() > now
}

export type ExpiryResult = { ok: true; value: string | null } | { ok: false; error: string }

/** The `expiresAt` to send, or the message key of what is wrong with the choice. */
export function resolveExpiry(
  choice: ExpiryChoice,
  custom: string,
  now: number = Date.now(),
): ExpiryResult {
  if (choice === 'never') return { ok: true, value: null }
  if (choice !== 'custom') return { ok: true, value: presetExpiry(Number(choice), now) }
  if (!custom) return { ok: false, error: 'validation.required' }
  const value = localInputToIso(custom)
  if (!value) return { ok: false, error: 'validation.format.dateTime' }
  if (!isInFuture(value, now)) return { ok: false, error: 'validation.mustBeInFuture' }
  return { ok: true, value }
}
