// Time ranges of the audit log (FR-073, data-model §5). A preset (24 h, 7 d, 30 d) is kept in the
// address as a token and resolved to a start time when the query runs, so a shared address always
// means "the last 24 hours" from now. A custom range is two RFC 3339 times whose start lies before
// their end; `<input type="datetime-local">` values are local times of the device.

export const AUDIT_RANGES = ['24h', '7d', '30d', 'custom'] as const
export type AuditRange = (typeof AUDIT_RANGES)[number]
export type AuditPreset = Exclude<AuditRange, 'custom'>

const DAY_MS = 86_400_000
export const PRESET_MS: Readonly<Record<AuditPreset, number>> = {
  '24h': DAY_MS,
  '7d': 7 * DAY_MS,
  '30d': 30 * DAY_MS,
}

export interface RangeInput {
  range: AuditRange | undefined
  from?: string | undefined
  to?: string | undefined
}

const timeOf = (value: string | undefined) => (value ? Date.parse(value) : Number.NaN)

/** The `from` and `to` of a request; a preset counts back from `now`. */
export function resolveRange(input: RangeInput, now: number = Date.now()) {
  const result: { from?: string; to?: string } = {}
  if (input.range === undefined) return result
  if (input.range !== 'custom') {
    result.from = new Date(now - PRESET_MS[input.range]).toISOString()
    return result
  }
  const from = timeOf(input.from)
  const to = timeOf(input.to)
  if (!Number.isNaN(from) && !Number.isNaN(to) && from >= to) return result
  if (!Number.isNaN(from)) result.from = new Date(from).toISOString()
  if (!Number.isNaN(to)) result.to = new Date(to).toISOString()
  return result
}

/** A local `datetime-local` value as a UTC RFC 3339 time, or null when it is empty or invalid. */
export function localInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return null
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : new Date(time).toISOString()
}

const pad = (value: number) => String(value).padStart(2, '0')

/** An RFC 3339 time as a local `datetime-local` value. */
export function isoToLocalInput(iso: string | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

/**
 * Checks a custom range before it is applied: a start or an end is needed, each must be a valid
 * date and time, and the start must lie before the end. Returns message keys per field.
 */
export function validateCustomRange(
  from: string,
  to: string,
): Partial<Record<'from' | 'to', string>> {
  if (!from && !to) return { from: 'validation.required' }
  const errors: Partial<Record<'from' | 'to', string>> = {}
  const start = from ? localInputToIso(from) : null
  const end = to ? localInputToIso(to) : null
  if (from && !start) errors.from = 'validation.format.dateTime'
  if (to && !end) errors.to = 'validation.format.dateTime'
  if (start && end && Date.parse(start) >= Date.parse(end))
    errors.to = 'auditLog.filters.rangeOrder'
  return errors
}
