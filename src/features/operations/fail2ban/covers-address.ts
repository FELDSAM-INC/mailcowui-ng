// Whether an address or network covers the caller's own address (FR-064, FR-069, research R16):
// the contract asks clients to warn before denylisting it. IPv4 and IPv6 are compared within their
// family by prefix arithmetic; host names and invalid input cover nothing. It warns, never blocks.

interface Parsed {
  family: 4 | 6
  value: bigint
}

function parseIpv4(text: string): bigint | null {
  const parts = text.split('.')
  if (parts.length !== 4) return null
  let value = 0n
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const octet = Number(part)
    if (octet > 255) return null
    value = (value << 8n) | BigInt(octet)
  }
  return value
}

function parseIpv6(text: string): bigint | null {
  if (!/^[0-9A-Fa-f:.]+$/.test(text)) return null
  let tail: number[] = []
  let body = text
  if (text.includes('.')) {
    const at = text.lastIndexOf(':')
    const v4 = parseIpv4(text.slice(at + 1))
    if (v4 === null) return null
    tail = [Number((v4 >> 16n) & 0xffffn), Number(v4 & 0xffffn)]
    body = text.slice(0, at + 1)
    if (!body.endsWith('::')) body = body.slice(0, -1)
  }
  const halves = body.split('::')
  if (halves.length > 2) return null
  const group = (part: string) => (part === '' ? [] : part.split(':'))
  const head = group(halves[0] ?? '')
  const rest = halves.length === 2 ? group(halves[1] ?? '') : []
  const groups = [...head, ...rest].map((item) =>
    /^[0-9A-Fa-f]{1,4}$/.test(item) ? parseInt(item, 16) : Number.NaN,
  )
  if (groups.some(Number.isNaN)) return null
  const total = groups.length + tail.length
  if (halves.length === 1 ? total !== 8 : total > 7) return null
  const zeros = 8 - total
  const all = [
    ...head.map((item) => parseInt(item, 16)),
    ...Array<number>(halves.length === 2 ? zeros : 0).fill(0),
    ...rest.map((item) => parseInt(item, 16)),
    ...tail,
  ]
  return all.reduce((value, part) => (value << 16n) | BigInt(part), 0n)
}

function parseAddress(text: string): Parsed | null {
  const v4 = parseIpv4(text)
  if (v4 !== null) return { family: 4, value: v4 }
  const v6 = parseIpv6(text)
  return v6 === null ? null : { family: 6, value: v6 }
}

export function coversAddress(entry: string, address: string): boolean {
  const own = parseAddress(address.trim())
  if (!own) return false
  const [base, prefixText] = entry.trim().split('/')
  const network = parseAddress(base ?? '')
  if (!network || network.family !== own.family) return false
  const bits = network.family === 4 ? 32 : 128
  if (prefixText !== undefined && !/^\d{1,3}$/.test(prefixText)) return false
  const prefix = prefixText === undefined ? bits : Number(prefixText)
  if (prefix > bits) return false
  const shift = BigInt(bits - prefix)
  return network.value >> shift === own.value >> shift
}
