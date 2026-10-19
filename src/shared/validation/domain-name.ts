// Domain names (UI 002 research D15, FR-020, FR-042), promoted to shared at their second use by UI
// 010 (research R3): the WHATWG URL host parser applies UTS #46 and lower-cases, as the API does,
// so no punycode library is needed. The API stays the authority (`invalidFormat`, `reserved`,
// `domain-exists`). UI 010 adds two options for MTA-STS MX hosts (research R18): `wildcard` allows
// a leading `*.` label, and `trailingDot` removes one trailing dot first.

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/
const FORBIDDEN = /[\s/\\?#@:%[\]]/

export interface DomainNameOptions {
  /** A leading `*.` label is allowed (MX hosts). */
  wildcard?: boolean
  /** One trailing dot is removed before the check. */
  trailingDot?: boolean
}

/** The lower-case ASCII form of a typed name, or null when it cannot be one. */
export function toAsciiDomain(input: string, options: DomainNameOptions = {}): string | null {
  let value = input.trim()
  if (options.trailingDot && value.endsWith('.') && !value.endsWith('..'))
    value = value.slice(0, -1)
  let prefix = ''
  if (options.wildcard && value.startsWith('*.')) {
    prefix = '*.'
    value = value.slice(2)
  }
  if (value === '' || FORBIDDEN.test(value) || value.includes('*')) return null
  try {
    const host = new URL(`http://${value}/`).hostname
    return host === '' ? null : `${prefix}${host}`
  } catch {
    return null
  }
}

/** FR-020: dot-separated labels of letters, digits and inner hyphens, at most 253 characters. */
export function isValidDomainName(input: string, options: DomainNameOptions = {}): boolean {
  const ascii = toAsciiDomain(input, options)
  if (!ascii || ascii.length > 253) return false
  const labels = ascii.split('.')
  if (options.wildcard && labels[0] === '*') labels.shift()
  return labels.length > 0 && labels.every((label) => LABEL.test(label))
}

/** FR-042: the readable or the ASCII name, ignoring letter case. */
export function matchesTypedName(
  typed: string,
  domain: { name: string; unicodeName: string },
): boolean {
  const value = typed.trim().toLowerCase()
  return (
    value !== '' &&
    (value === domain.name.toLowerCase() || value === domain.unicodeName.toLowerCase())
  )
}
