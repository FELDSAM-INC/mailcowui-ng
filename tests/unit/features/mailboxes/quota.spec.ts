// The quota in MiB with "0 = ∞" (UI 003 T024, docs/conventions.md "Follow the legacy form", "The
// domain's Default mailbox quota"): the create form's prefill from the template capped at the
// domain's largest quota for a new mailbox, and the checks before sending.
import { describe, expect, it } from 'vitest'

import { legacy } from '@/i18n'
import type { ClientErrors } from '@/shared/validation/client-errors'

import {
  checkQuota,
  MIB,
  parseQuotaMib,
  prefillQuotaMib,
  quotaMib,
} from '@/features/mailboxes/quota'

const GIB = 1024 * MIB

describe('prefill (owner decision 2026-10-18)', () => {
  it.each([
    ['a 1 GiB template in a domain with room', GIB, 5 * GIB, 1024],
    ['an unlimited template, capped at the largest quota', 0, 5 * GIB, 5120],
    ['a template above the largest quota, capped', 10 * GIB, 5 * GIB, 5120],
    ['a domain without quota left: unlimited, as legacy fixes it', GIB, 0, 0],
    ['no domain chosen yet: the template', 2 * GIB, null, 2048],
  ])('%s', (_name, template, max, expected) => {
    expect(prefillQuotaMib(template, max)).toBe(expected)
  })
})

describe('parsing and display', () => {
  it('reads whole MiB only', () => {
    expect(parseQuotaMib(' 1024 ')).toBe(1024)
    expect(parseQuotaMib('0')).toBe(0)
    for (const bad of ['', '1.5', '-1', '1e3', 'x']) expect(parseQuotaMib(bad)).toBeNull()
    expect(quotaMib(3 * GIB)).toBe('3072')
  })
})

describe('checks before sending', () => {
  const run = (text: string, options: Parameters<typeof checkQuota>[3]) => {
    const errors: ClientErrors = {}
    const bytes = checkQuota(errors, 'quota', text, options)
    return { errors, bytes }
  }

  it('returns bytes for a valid value', () => {
    expect(run('1024', { max: 5 * GIB, unlimitedAllowed: false }).bytes).toBe(GIB)
  })

  it('refuses a value above the maximum with legacy’s message in MiB', () => {
    expect(run('8192', { max: 5 * GIB, unlimitedAllowed: true }).errors.quota).toEqual([
      { key: legacy('danger.mailbox_quota_exceeded', 5120) },
    ])
  })

  it('refuses 0 without the unlimited quota permission (danger.unlimited_quota_acl)', () => {
    expect(run('0', { max: 5 * GIB, unlimitedAllowed: false }).errors.quota).toEqual([
      { key: legacy('danger.unlimited_quota_acl') },
    ])
    expect(run('0', { max: 5 * GIB, unlimitedAllowed: true }).bytes).toBe(0)
  })

  it('refuses what is not a whole number of MiB', () => {
    expect(run('1.5', { max: null, unlimitedAllowed: true }).errors.quota).toEqual([
      { key: 'validation.invalid' },
    ])
  })

  it('accepts the stored value even above the maximum', () => {
    expect(run('8192', { max: 5 * GIB, unlimitedAllowed: false, current: 8 * GIB }).bytes).toBe(
      8 * GIB,
    )
  })
})
