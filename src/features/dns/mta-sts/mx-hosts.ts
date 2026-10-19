// The MTA-STS MX hosts (settled deviation 4: the classic comma-separated text area with
// `edit.mta_sts_mx_notice`). Entries are split on commas and trimmed; one trailing dot is removed;
// entries that differ only in letter case are kept once with the first spelling. Each entry is a
// host name, optionally starting with `*.`; the entries joined by commas, in their ASCII form, stay
// within the capabilities' limit (FR-048). Errors use the classic `danger.mx_invalid` with the entry.
import { legacy } from '@/i18n'
import { add, type ClientErrors } from '@/shared/validation/client-errors'
import { isValidDomainName, toAsciiDomain } from '@/shared/validation/domain-name'

const OPTIONS = { wildcard: true, trailingDot: true } as const

export interface ParsedMxHosts {
  hosts: string[]
  /** Entries left out because an earlier one differs only in letter case. */
  duplicates: string[]
}

export function parseMxHosts(text: string): ParsedMxHosts {
  const hosts: string[] = []
  const duplicates: string[] = []
  const seen = new Set<string>()
  for (const raw of text.split(',')) {
    let host = raw.trim()
    if (host.endsWith('.') && !host.endsWith('..')) host = host.slice(0, -1)
    if (host === '') continue
    const key = (toAsciiDomain(host, OPTIONS) ?? host).toLowerCase()
    if (seen.has(key)) {
      duplicates.push(host)
      continue
    }
    seen.add(key)
    hosts.push(host)
  }
  return { hosts, duplicates }
}

/** The lower-case ASCII form of a host, or null when it is not a valid host name. */
export function mxAscii(host: string): string | null {
  return isValidDomainName(host, OPTIONS) ? toAsciiDomain(host, OPTIONS) : null
}

/** The length of the entries joined by commas, as the API stores them (ASCII). */
export function joinedLength(hosts: readonly string[]): number {
  return hosts.map((host) => mxAscii(host) ?? host).join(',').length
}

/** The used length is shown once 90 % of the limit is reached (FR-048). */
export function nearLimit(used: number, max: number): boolean {
  return used >= Math.ceil(max * 0.9)
}

/** The hosts written back into the text area. */
export function formatMxHosts(hosts: readonly string[]): string {
  return hosts.join(', ')
}

/** The client checks of the MX hosts: entries by position, list rules on the field. */
export function validateMxHosts(
  hosts: readonly string[],
  maxLength: number,
  maxItems: number,
): ClientErrors {
  const errors: ClientErrors = {}
  if (hosts.length === 0) add(errors, 'mxHosts', { key: 'validation.required' })
  hosts.forEach((host, index) => {
    if (mxAscii(host) === null) {
      add(errors, `mxHosts.${index}`, { key: legacy('danger.mx_invalid', host) })
    }
  })
  if (hosts.length > maxItems) {
    add(errors, 'mxHosts', { key: 'validation.tooMany', params: { max: String(maxItems) } })
  } else if (joinedLength(hosts) > maxLength) {
    add(errors, 'mxHosts', { key: 'validation.tooLong', params: { max: String(maxLength) } })
  }
  return errors
}
