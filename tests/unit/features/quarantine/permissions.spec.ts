// UI 006 (T018, SC-005): the permission matrix of FR-002, table-driven over every role and flag.
import { describe, expect, it } from 'vitest'

import type { Identity, PermissionFlags, Role } from '@/api'
import {
  canActOnItems,
  canChangeCategory,
  canChangeFrequency,
  canChangePolicy,
  canChangeRateLimits,
  canChangeSpamScore,
  canDownloadMessage,
  canReadPolicy,
  canReadRateLimits,
  canResetBucket,
  canSeeAttachments,
  canSeeHistory,
  canSeeSettings,
  canSeeStatistics,
  missingFlag,
} from '@/features/quarantine/permissions'

const MAILBOX_FLAGS = [
  'quarantine',
  'quarantineAttachments',
  'quarantineNotification',
  'quarantineCategory',
  'spamScore',
  'spamPolicy',
] as const
const DOMAIN_ADMIN_FLAGS = ['quarantine', 'spamPolicy', 'ratelimit'] as const

function who(role: Role, flags: Partial<PermissionFlags>, username = 'alice@example.org') {
  return { role, username, permissions: flags as PermissionFlags } as Pick<
    Identity,
    'role' | 'username' | 'permissions'
  >
}

const all = (names: readonly (keyof PermissionFlags)[]) =>
  Object.fromEntries(names.map((name) => [name, true])) as Partial<PermissionFlags>
const without = (names: readonly (keyof PermissionFlags)[], missing: keyof PermissionFlags) =>
  Object.fromEntries(names.map((name) => [name, name !== missing])) as Partial<PermissionFlags>

const OWN = 'alice@example.org'
const FOREIGN = 'bob@example.org'

describe('administrator', () => {
  const id = who('admin', {}, 'admin')
  it('may do everything, without any flag', () => {
    for (const fn of [
      canActOnItems,
      canSeeAttachments,
      canDownloadMessage,
      canReadRateLimits,
      canChangeRateLimits,
      canResetBucket,
      canSeeSettings,
      canSeeStatistics,
      canSeeHistory,
    ]) {
      expect(fn(id)).toBe(true)
    }
    for (const mailbox of [OWN, FOREIGN]) {
      expect(canChangeFrequency(id, mailbox)).toBe(true)
      expect(canChangeCategory(id, mailbox)).toBe(true)
      expect(canChangeSpamScore(id, mailbox)).toBe(true)
    }
    for (const kind of ['domain', 'aliasDomain', 'mailbox'] as const) {
      expect(canReadPolicy(id, kind)).toBe(true)
      expect(canChangePolicy(id, kind)).toBe(true)
    }
    expect(missingFlag(id, 'actOnItems')).toBeNull()
  })
})

describe('domain administrator', () => {
  it('with every flag', () => {
    const id = who('domainAdmin', all(DOMAIN_ADMIN_FLAGS), 'reseller')
    expect(canActOnItems(id)).toBe(true)
    expect(canSeeAttachments(id)).toBe(true)
    expect(canDownloadMessage(id)).toBe(true)
    expect(canChangeFrequency(id, FOREIGN)).toBe(true)
    expect(canChangeCategory(id, FOREIGN)).toBe(true)
    expect(canChangeSpamScore(id, FOREIGN)).toBe(true)
    expect(canReadPolicy(id, 'domain')).toBe(true)
    expect(canChangePolicy(id, 'aliasDomain')).toBe(true)
    expect(canReadRateLimits(id)).toBe(true)
    expect(canChangeRateLimits(id)).toBe(true)
    expect(canResetBucket(id)).toBe(false)
    expect(canSeeSettings(id)).toBe(false)
    expect(canSeeStatistics(id)).toBe(false)
    expect(canSeeHistory(id)).toBe(false)
  })

  it.each([
    ['quarantine', 'actOnItems', canActOnItems],
    ['quarantine', 'downloadMessage', canDownloadMessage],
    ['ratelimit', 'changeRateLimits', canChangeRateLimits],
  ] as const)('without %s cannot %s', (missing, ability, fn) => {
    const id = who('domainAdmin', without(DOMAIN_ADMIN_FLAGS, missing), 'reseller')
    expect(fn(id)).toBe(false)
    expect(missingFlag(id, ability)).toBe(missing)
  })

  it('without spamPolicy reads but does not change the lists', () => {
    const id = who('domainAdmin', without(DOMAIN_ADMIN_FLAGS, 'spamPolicy'), 'reseller')
    for (const kind of ['domain', 'aliasDomain', 'mailbox'] as const) {
      expect(canReadPolicy(id, kind)).toBe(true)
      expect(canChangePolicy(id, kind)).toBe(false)
    }
    expect(missingFlag(id, 'changePolicy')).toBe('spamPolicy')
    // Attachments, notifications and spam scores need no flag for a domain administrator.
    expect(canSeeAttachments(id)).toBe(true)
    expect(missingFlag(id, 'seeAttachments')).toBeNull()
    expect(missingFlag(id, 'changeSpamScore')).toBeNull()
  })
})

describe('mailbox user', () => {
  it('with every flag acts on the own mailbox only', () => {
    const id = who('mailboxUser', all(MAILBOX_FLAGS))
    expect(canActOnItems(id)).toBe(true)
    expect(canSeeAttachments(id)).toBe(true)
    expect(canDownloadMessage(id)).toBe(true)
    expect(canChangeFrequency(id, OWN)).toBe(true)
    expect(canChangeFrequency(id, 'ALICE@example.org')).toBe(true)
    expect(canChangeFrequency(id, FOREIGN)).toBe(false)
    expect(canChangeCategory(id, OWN)).toBe(true)
    expect(canChangeCategory(id, FOREIGN)).toBe(false)
    expect(canChangeSpamScore(id, OWN)).toBe(true)
    expect(canChangeSpamScore(id, FOREIGN)).toBe(false)
    expect(canReadPolicy(id, 'mailbox')).toBe(true)
    expect(canReadPolicy(id, 'domain')).toBe(false)
    expect(canChangePolicy(id, 'mailbox')).toBe(true)
    expect(canChangePolicy(id, 'domain')).toBe(false)
    expect(canReadRateLimits(id)).toBe(false)
    expect(canChangeRateLimits(id)).toBe(false)
    expect(canResetBucket(id)).toBe(false)
    expect(canSeeSettings(id)).toBe(false)
    expect(canSeeStatistics(id)).toBe(false)
    expect(canSeeHistory(id)).toBe(false)
  })

  const cases = [
    ['quarantine', 'actOnItems', (id: ReturnType<typeof who>) => canActOnItems(id)],
    ['quarantine', 'downloadMessage', (id: ReturnType<typeof who>) => canDownloadMessage(id)],
    [
      'quarantineAttachments',
      'seeAttachments',
      (id: ReturnType<typeof who>) => canSeeAttachments(id),
    ],
    [
      'quarantineAttachments',
      'downloadMessage',
      (id: ReturnType<typeof who>) => canDownloadMessage(id),
    ],
    [
      'quarantineNotification',
      'changeFrequency',
      (id: ReturnType<typeof who>) => canChangeFrequency(id, OWN),
    ],
    [
      'quarantineCategory',
      'changeCategory',
      (id: ReturnType<typeof who>) => canChangeCategory(id, OWN),
    ],
    ['spamScore', 'changeSpamScore', (id: ReturnType<typeof who>) => canChangeSpamScore(id, OWN)],
    ['spamPolicy', 'changePolicy', (id: ReturnType<typeof who>) => canChangePolicy(id, 'mailbox')],
  ] as const

  it.each(cases)('without %s cannot %s, and the note names the flag', (missing, ability, fn) => {
    const id = who('mailboxUser', without(MAILBOX_FLAGS, missing))
    expect(fn(id)).toBe(false)
    expect(missingFlag(id, ability)).toBe(missing)
  })

  it('without any flag still reads its own lists', () => {
    const id = who('mailboxUser', {})
    expect(canReadPolicy(id, 'mailbox')).toBe(true)
    expect(missingFlag(id, 'downloadMessage')).toBe('quarantine')
  })

  it('gets no ability without an identity', () => {
    expect(canActOnItems(null)).toBe(false)
    expect(canReadPolicy(undefined, 'mailbox')).toBe(false)
    expect(missingFlag(null, 'actOnItems')).toBeNull()
  })
})
