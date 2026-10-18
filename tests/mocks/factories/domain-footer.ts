// Domain footer factory (UI 002 research D28): an absent footer reads as empty, and an absent and
// a stored empty footer share the same version tag.
import { createHash } from 'node:crypto'

import type { DomainFooter, DomainFooterSummary } from '@/api'

import type { MockFooter } from '../scenarios/state'

export function emptyFooter(): MockFooter {
  return {
    html: '',
    plain: '',
    skipReplies: false,
    excludedAddresses: [],
    excludedAliasDomains: [],
  }
}

export function mockFooter(overrides: Partial<MockFooter> = {}): MockFooter {
  return { ...emptyFooter(), ...overrides }
}

export function footerEtag(footer: MockFooter): string {
  return `"f${createHash('sha256').update(JSON.stringify(footer)).digest('hex').slice(0, 23)}"`
}

export function footerView(domain: string, stored: MockFooter | undefined): DomainFooter {
  const footer = stored ?? emptyFooter()
  return {
    domain,
    html: footer.html,
    plain: footer.plain,
    skipReplies: footer.skipReplies,
    excludedAddresses: [...footer.excludedAddresses],
    excludedAliasDomains: [...footer.excludedAliasDomains],
    etag: footerEtag(footer),
  }
}

const bytes = (text: string) => new TextEncoder().encode(text).length

/** `Domain.footer` (API gap G28): an absent footer reads as empty. */
export function footerSummary(stored: MockFooter | undefined): DomainFooterSummary {
  const footer = stored ?? emptyFooter()
  return {
    set: footer.html !== '' || footer.plain !== '',
    htmlBytes: bytes(footer.html),
    plainBytes: bytes(footer.plain),
    skipReplies: footer.skipReplies,
    excludedAddressCount: footer.excludedAddresses.length,
    excludedAliasDomainCount: footer.excludedAliasDomains.length,
  }
}
