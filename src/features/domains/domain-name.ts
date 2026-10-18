// Domain names (UI 002 research D15, FR-020, FR-042): the WHATWG URL host parser applies UTS #46
// and lower-cases, as API 002 does, so no punycode library is needed. The API stays the
// authority (`invalidFormat`, `reserved`, `domain-exists`).

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/
const FORBIDDEN = /[\s/\\?#@:%[\]]/

/** The lower-case ASCII form of a typed name, or null when it cannot be one. */
export function toAsciiDomain(input: string): string | null {
  const value = input.trim()
  if (value === '' || FORBIDDEN.test(value)) return null
  try {
    const host = new URL(`http://${value}/`).hostname
    return host === '' ? null : host
  } catch {
    return null
  }
}

/** FR-020: dot-separated labels of letters, digits and inner hyphens, at most 253 characters. */
export function isValidDomainName(input: string): boolean {
  const ascii = toAsciiDomain(input)
  if (!ascii || ascii.length > 253) return false
  return ascii.split('.').every((label) => LABEL.test(label))
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
