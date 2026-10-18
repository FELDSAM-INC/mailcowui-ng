// JSON Merge Patches of the mailbox page's sections (UI 003 T041, research R6): only the changed
// members, nested objects with their changed members only, tags as a set, custom attributes by
// name, the recovery e-mail emptied as null, the password only when typed.
import { describe, expect, it } from 'vitest'

import {
  attributesPatch,
  mailboxPatch,
  permissionsPatch,
  protocolsPatch,
} from '@/features/mailboxes/patch'

const base = {
  authSource: 'mailcow' as const,
  displayName: 'Anna',
  tags: ['Sales'],
  quota: 1024 * 1_048_576,
  recoveryEmail: 'a@b.example' as string | null,
  protocolAccess: { imap: true, pop3: true, smtp: true, sieve: true, activeSync: true, dav: true },
  status: 'active' as const,
  forcePasswordChange: false,
  forceSecondFactorSetup: false,
  webmailRedirect: true,
}

const form = (changes: Partial<Parameters<typeof mailboxPatch>[1]> = {}) => ({
  authSource: base.authSource,
  displayName: base.displayName,
  tags: [...base.tags],
  quota: base.quota,
  password: '',
  recoveryEmail: base.recoveryEmail ?? '',
  protocols: ['imap', 'pop3', 'smtp', 'sieve', 'activeSync', 'dav'] as const,
  status: base.status,
  forcePasswordChange: false,
  forceSecondFactorSetup: false,
  webmailRedirect: true,
  ...changes,
})

describe('mailboxPatch', () => {
  it('is empty when nothing changed', () => {
    expect(mailboxPatch(base, form())).toEqual({})
  })

  it('sends changed scalars, the quota in bytes and the password only when typed', () => {
    expect(
      mailboxPatch(base, form({ displayName: 'Anna S', quota: 2048 * 1_048_576, password: 'x' })),
    ).toEqual({ displayName: 'Anna S', quota: 2048 * 1_048_576, password: 'x' })
  })

  it('sends tags as a whole set only when the set changed ignoring letter case', () => {
    expect(mailboxPatch(base, form({ tags: ['sales'] }))).toEqual({})
    expect(mailboxPatch(base, form({ tags: ['Sales', 'Staff'] }))).toEqual({
      tags: ['Sales', 'Staff'],
    })
  })

  it('sends an emptied recovery e-mail as null', () => {
    expect(mailboxPatch(base, form({ recoveryEmail: '' }))).toEqual({ recoveryEmail: null })
  })

  it('sends only the protocols that changed', () => {
    expect(
      mailboxPatch(base, form({ protocols: ['imap', 'smtp', 'sieve', 'activeSync', 'dav'] })),
    ).toEqual({ protocolAccess: { pop3: false } })
  })

  it('leaves out the fields the caller may not edit', () => {
    expect(
      mailboxPatch(
        base,
        form({ webmailRedirect: false, protocols: ['imap'] }),
        (field) => field !== 'webmailRedirect' && field !== 'protocolAccess',
      ),
    ).toEqual({})
  })
})

describe('protocols and permissions', () => {
  it('lists the changed members only, or nothing', () => {
    expect(
      protocolsPatch(base.protocolAccess, ['imap', 'pop3', 'smtp', 'sieve', 'activeSync', 'dav']),
    ).toBeNull()
    expect(protocolsPatch(base.protocolAccess, ['imap'])).toEqual({
      pop3: false,
      smtp: false,
      sieve: false,
      activeSync: false,
      dav: false,
    })
    expect(
      permissionsPatch({ syncjobs: false, pwReset: true } as never, ['syncjobs', 'pwReset']),
    ).toEqual({ syncjobs: true })
    expect(permissionsPatch({ syncjobs: false, pwReset: true } as never, ['pwReset'])).toBeNull()
  })
})

describe('attributesPatch', () => {
  const stored = { old: '1', department: 'Sales' }

  it('adds and changes names with their value, and removes the dropped or renamed ones', () => {
    expect(
      attributesPatch(stored, [
        { id: 1, name: 'department', value: 'Support', storedName: 'department' },
        { id: 2, name: 'phone', value: '+420' },
        { id: 3, name: 'renamed', value: '1', storedName: 'old' },
      ]),
    ).toEqual({ department: 'Support', phone: '+420', renamed: '1', old: null })
  })

  it('is null when nothing changed', () => {
    expect(
      attributesPatch(stored, [
        { id: 1, name: 'old', value: '1', storedName: 'old' },
        { id: 2, name: 'department', value: 'Sales', storedName: 'department' },
      ]),
    ).toBeNull()
  })
})
