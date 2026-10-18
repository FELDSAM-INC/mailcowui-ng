// A contract-shaped domain for component tests.
import type { Domain } from '@/api'

const GIB = 1024 ** 3

export function domain(overrides: Partial<Domain> = {}): Domain {
  return {
    name: 'nearly.example',
    unicodeName: 'nearly.example',
    description: 'Nearly full',
    active: true,
    maxMailboxes: 10,
    maxAliases: 400,
    maxMailboxQuota: 2 * GIB,
    domainQuota: 10 * GIB,
    backupMx: false,
    relayAllRecipients: false,
    relayUnknownOnly: false,
    globalAddressList: true,
    tags: ['customer-a', 'gold'],
    relayhost: null,
    rateLimit: null,
    createdAt: '2026-01-06T09:00:00.000Z',
    modifiedAt: null,
    usage: {
      mailboxes: 8,
      resources: 1,
      aliases: 380,
      aliasDomains: 2,
      mailboxesLeft: 2,
      aliasesLeft: 20,
      largestMailboxQuota: 2 * GIB,
      quotaAllocated: 9.5 * GIB,
      storageUsed: 7.25 * GIB,
      messages: 12_345,
      maxNewMailboxQuota: GIB / 2,
    },
    footer: {
      set: false,
      htmlBytes: 0,
      plainBytes: 0,
      skipReplies: false,
      excludedAddressCount: 0,
      excludedAliasDomainCount: 0,
    },
    etag: '"e1"',
    domainAdmins: ['helper', 'reseller'],
    ...overrides,
  }
}
