import type { DnsCheck } from '@/api'

type Proposal = {
  kind: 'create' | 'update' | 'unchanged' | 'mxPresent' | 'review' | 'unavailable'
  current: string | null
  record: string | null
}

// DNS evaluation belongs to the server. Suggest authorizing the domain's MX hosts while
// preserving providers, exclusions, redirects and the final policy. Existing MX mechanisms
// need review if the server still fails SPF; adding another one would not fix their DNS/order.
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
  if (check.status === 'missing' && !check.found.length) {
    return result('create', 'v=spf1 mx ~all')
  }
  if (!current || !/^[\x20-\x7e]+$/.test(current) || !/^v=spf1(?: |$)/i.test(current))
    return result('review')
  const terms = current.trim().split(/ +/).slice(1)
  const domain = check.recordName.toLowerCase().replace(/\.$/, '')
  let mxPresent = false
  for (const term of terms) {
    const match = /^([+~?-]?)mx(?::([^/]+))?(?:\/\d+)?(?:\/\/\d+)?$/i.exec(term)
    if (!match) continue
    const target = match[2]?.toLowerCase().replace(/\.$/, '')
    if (target && target !== domain && target !== '%{d}') continue
    if (match[1] && match[1] !== '+') return result('review')
    mxPresent = true
  }
  if (mxPresent) return result('mxPresent')
  return result('update', `${current.slice(0, 6)} mx${current.slice(6)}`)
}
