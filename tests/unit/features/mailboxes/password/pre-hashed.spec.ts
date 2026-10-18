// Pre-hashed passwords (UI 003 T026, G31): a value that starts with one of the schemes of
// `MailboxCapabilities.preHashedPasswordSchemes`, in any letter case.
import { describe, expect, it } from 'vitest'

import { isPreHashed } from '@/features/mailboxes/password/pre-hashed'

const SCHEMES = ['ARGON2ID', 'BLF-CRYPT', 'SSHA512']

describe('isPreHashed', () => {
  it.each([
    ['{SSHA512}abc', true],
    ['{blf-crypt}$2y$05$x', true],
    ['{ARGON2ID}$argon2id$v=19', true],
    ['Passw0rd{x}', false],
    ['{UNKNOWN}x', false],
    ['{SSHA512', false],
  ])('%s → %s', (value, expected) => {
    expect(isPreHashed(value, SCHEMES)).toBe(expected)
  })
})
