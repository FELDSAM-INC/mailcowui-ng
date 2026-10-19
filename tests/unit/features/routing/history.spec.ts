// UI 009 T110: the audit log targets of routing entries and assignments (research R18).
import { describe, expect, it } from 'vitest'

import { historyTarget } from '@/features/routing/history'

describe('historyTarget', () => {
  it.each([
    ['relayhost', { id: 1 }, '1'],
    ['transport', { id: 12 }, '12'],
    ['bccMap', { id: 3 }, '3'],
    ['recipientMap', { id: 4 }, '4'],
    ['tlsPolicyMap', { id: 5 }, '5'],
    // The forwarding host's stored address, unencoded; the source is a target of its own kind too.
    ['forwardingHost', { address: '192.0.2.0/24' }, '192.0.2.0/24'],
    ['forwardingHost', { address: 'forwarder.example' }, 'forwarder.example'],
    // The domain's ASCII name and the mailbox's address.
    ['domainRelayhostAssignment', { name: 'xn--bcher-kva.example' }, 'xn--bcher-kva.example'],
    ['mailboxRelayhostAssignment', { name: 'alice@example.org' }, 'alice@example.org'],
  ] as const)('%s %o → %s', (type, entry, targetId) => {
    expect(historyTarget(type, entry)).toEqual({ targetType: type, targetId })
  })
})
