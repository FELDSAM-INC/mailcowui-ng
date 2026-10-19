// The MTA-STS max age (research R18 as settled: seconds, as the classic form takes them, with
// `edit.mta_sts_max_age_info` "Time in seconds"): a whole number of seconds inside the range of the
// capabilities. The API stays the authority (`outOfRange`).
import type { DnsCapabilities } from '@/api'

/** The max age typed in seconds: a whole number (digits only), or null. */
export function parseMaxAge(text: string): number | null {
  const value = text.trim()
  return /^\d{1,10}$/.test(value) ? Number(value) : null
}

export function maxAgeInRange(
  seconds: number,
  caps: Pick<DnsCapabilities['mtaSts'], 'maxAgeMin' | 'maxAgeMax'>,
): boolean {
  return seconds >= caps.maxAgeMin && seconds <= caps.maxAgeMax
}
