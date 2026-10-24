import type { DnsCheck } from '@/api'
import { isIpNetwork } from '@/shared/validation/ip-network'

type Proposal = {
  kind: 'create' | 'update' | 'unchanged' | 'review' | 'unavailable'
  current: string | null
  record: string | null
}

// DNS evaluation belongs to the server. This only adds explicit authorizations to a policy
// whose reported problem is a non-passing server address. Preserve providers, exclusions,
// redirect and the final policy; never offer a replacement for evaluation/syntax errors.
// RFC 7208 sections 4.6 and 5: order matters, including terms before `all` and `redirect`.
export function spfProposal(check: DnsCheck): Proposal {
  const current = check.found.length === 1 ? check.found[0]! : null
  const result = (kind: Proposal['kind'], record: string | null = null): Proposal => ({
    kind,
    current,
    record,
  })
  if (check.id !== 'spf') return result('unavailable')
  if (check.status === 'match') return result('unchanged')
  if (check.status !== 'missing' && check.status !== 'mismatch') return result('unavailable')
  if (check.found.length > 1) return result('review')
  if (check.status === 'mismatch' && check.reason?.code !== 'spfNotPass') return result('review')
  const addresses = check.guidance.find(
    (message) => message.code === 'spfAuthorizeAddresses',
  )?.params
  const mechanisms: string[] = []
  for (const [key, family] of [
    ['ipv4', 'ip4'],
    ['ipv6', 'ip6'],
  ] as const) {
    const address = addresses?.[key]
    if (address == null || address === '') continue
    if (
      typeof address !== 'string' ||
      address.includes('/') ||
      !isIpNetwork(address) ||
      address.includes(':') !== (family === 'ip6')
    ) {
      return result('unavailable')
    }
    mechanisms.push(`${family}:${address}`)
  }
  if (!mechanisms.length) return result('unavailable')
  if (check.status === 'missing' && !check.found.length) {
    return result('create', `v=spf1 ${mechanisms.join(' ')} ~all`)
  }
  if (!current || !/^[\x20-\x7e]+$/.test(current) || !/^v=spf1(?: |$)/i.test(current))
    return result('review')
  const terms = current.trim().split(/ +/).slice(1)
  const additions = mechanisms.filter((mechanism) => !explicitlyAuthorized(mechanism, terms))
  // An inconsistency between explicit coverage and the evaluator needs review, not a guessed fix.
  if (!additions.length) return result('review')
  return result('update', `${current.slice(0, 6)} ${additions.join(' ')}${current.slice(6)}`)
}

function numericAddress(address: string): bigint {
  if (!address.includes(':'))
    return address.split('.').reduce((value, part) => (value << 8n) + BigInt(part), 0n)
  // URL canonicalization also normalizes the IPv4-embedded form, after isIpNetwork validation.
  const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1)
  const [left = '', right] = canonical.split('::')
  const head = left ? left.split(':') : []
  const tail = right ? right.split(':') : []
  const groups =
    right === undefined
      ? head
      : [...head, ...Array<string>(8 - head.length - tail.length).fill('0'), ...tail]
  return groups.reduce((value, part) => (value << 16n) + BigInt(`0x${part}`), 0n)
}

function explicitlyAuthorized(mechanism: string, terms: string[]): boolean {
  const family = mechanism.slice(0, 3)
  const address = numericAddress(mechanism.slice(4))
  const bits = family === 'ip4' ? 32 : 128
  for (const term of terms) {
    const qualifier = /^[+~?-]/.test(term) ? term[0] : '+'
    const body = term.replace(/^[+~?-]/, '')
    if (/^all$/i.test(body)) return false
    const network = /^(ip4|ip6):(.+)$/i.exec(body)
    if (network) {
      if (network[1]!.toLowerCase() !== family) continue
      const value = network[2]!
      if (!isIpNetwork(value) || value.includes(':') !== (family === 'ip6')) return false
      const [ip, prefix] = value.split('/')
      const shift = BigInt(bits - (prefix === undefined ? bits : Number(prefix)))
      if (numericAddress(ip!) >> shift === address >> shift) return qualifier === '+'
    } else if (qualifier !== '+') {
      // A preceding negative include/a/mx may match; add the explicit IP before it.
      return false
    }
  }
  return false
}
