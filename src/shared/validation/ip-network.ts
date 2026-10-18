// Client-side check of an IP address or prefix (data-model §6): API key allowed networks and the
// audit log's address filter. The server validates again; this only catches typing slips early.
//
// IPv4: dotted quad, octets 0–255 without leading zeros (`192.0.02.1` is ambiguous between octal
// and decimal, so it is refused), optional prefix /0–32.
// IPv6: full or `::`-compressed hex groups, optionally ending in an embedded IPv4 address, optional
// prefix /0–128. No zone index and no brackets. Prefixes have no leading zeros.

const MAX_LENGTH = 49
const OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)'
const IPV4 = new RegExp(`^${OCTET}(?:\\.${OCTET}){3}$`)
const HEX_GROUP = /^[0-9A-Fa-f]{1,4}$/
const PREFIX = /^(?:0|[1-9]\d{0,2})$/

function isIpv4(value: string): boolean {
  return IPV4.test(value)
}

function isIpv6(value: string): boolean {
  if (!/^[0-9A-Fa-f:.]+$/.test(value)) return false

  let head = value
  let groups = 8
  if (value.includes('.')) {
    // An embedded IPv4 address takes the place of the last two groups.
    const lastColon = value.lastIndexOf(':')
    if (!isIpv4(value.slice(lastColon + 1))) return false
    head = value.slice(0, lastColon + 1)
    if (!head.endsWith('::')) head = head.slice(0, -1)
    groups = 6
  }

  const halves = head.split('::')
  if (halves.length > 2) return false
  const split = (part: string) => (part === '' ? [] : part.split(':'))

  if (halves.length === 2) {
    const all = [...split(halves[0] ?? ''), ...split(halves[1] ?? '')]
    // `::` stands for at least one zero group.
    return all.every((group) => HEX_GROUP.test(group)) && all.length <= groups - 1
  }
  const all = split(head)
  return all.length === groups && all.every((group) => HEX_GROUP.test(group))
}

export function isIpNetwork(value: string): boolean {
  if (typeof value !== 'string' || value === '' || value.length > MAX_LENGTH) return false

  const slash = value.indexOf('/')
  const address = slash === -1 ? value : value.slice(0, slash)
  const prefix = slash === -1 ? null : value.slice(slash + 1)
  const v6 = address.includes(':')

  if (!(v6 ? isIpv6(address) : isIpv4(address))) return false
  if (prefix === null) return true
  return PREFIX.test(prefix) && Number(prefix) <= (v6 ? 128 : 32)
}
