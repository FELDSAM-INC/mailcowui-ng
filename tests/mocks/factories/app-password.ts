// App passwords of the mock (UI 005 T011, research R14): stored rows and their contract views.
import type { AppPassword } from '@/api'

import type { MockAppPassword } from '../scenarios/self-service/state'

export const APP_PASSWORD_PROTOCOLS = [
  'imap',
  'pop3',
  'smtp',
  'sieve',
  'activeSync',
  'dav',
] as const

export function mockAppPassword(
  overrides: Partial<MockAppPassword> & { id: number; name: string },
): MockAppPassword {
  return {
    protocols: [...APP_PASSWORD_PROTOCOLS],
    active: true,
    createdAt: '2026-09-01T08:00:00.000Z',
    modifiedAt: null,
    version: 1,
    ...overrides,
  }
}

export const appPasswordEtag = (mailbox: string, item: MockAppPassword) =>
  `"ap-${item.id}-${item.version}-${mailbox.length}"`

export function appPasswordView(mailbox: string, item: MockAppPassword): AppPassword {
  return {
    id: item.id,
    mailbox,
    name: item.name,
    protocols: [...item.protocols],
    active: item.active,
    createdAt: item.createdAt,
    modifiedAt: item.modifiedAt,
    etag: appPasswordEtag(mailbox, item),
  }
}

/** A 32-character password from the policy-safe alphabet (no look-alikes). */
export function generatedAppPassword(seed: number): string {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let value = seed * 7919 + 17
  let out = ''
  for (let index = 0; index < 32; index += 1) {
    value = (value * 1103515245 + 12345) % 2147483648
    out += alphabet[value % alphabet.length]
  }
  return `Ap${out.slice(2, 31)}7`
}
