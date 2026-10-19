// The "Allow to send as" model (T073, data-model §2; legacy form map: the multi-select of
// `edit/mailbox.twig` and `mailbox_get_sender_acl_handles()`): the selected entries with legacy's
// labels and subtexts, the aliases that deliver to the mailbox (allowed: selected and locked;
// blocked: options), the whole-set patch and the "not needed" entries.
import { describe, expect, it } from 'vitest'

import type { MailboxSenderSettings } from '@/api'
import {
  blockedAliases,
  buildSenderPatch,
  entryForPath,
  notNeededAfterSave,
  selectedEntries,
  toWorkingCopy,
} from '@/features/sender-settings/send-as-model'

const settings = (overrides: Partial<MailboxSenderSettings> = {}): MailboxSenderSettings => ({
  mailbox: 'anna@example.org',
  mailboxUnicode: 'anna@example.org',
  implicitAddresses: [
    {
      address: 'anna@example.org',
      addressUnicode: 'anna@example.org',
      source: 'ownAddress',
      aliasId: null,
      senderAllowed: true,
      catchAll: false,
    },
    {
      address: 'anna@example.net',
      addressUnicode: 'anna@example.net',
      source: 'aliasDomainAddress',
      aliasId: null,
      senderAllowed: true,
      catchAll: false,
    },
    {
      address: 'sales@example.org',
      addressUnicode: 'sales@example.org',
      source: 'alias',
      aliasId: 1,
      senderAllowed: true,
      catchAll: false,
    },
    {
      address: 'info@example.org',
      addressUnicode: 'info@example.org',
      source: 'alias',
      aliasId: 2,
      senderAllowed: false,
      catchAll: false,
    },
    {
      address: '@example.org',
      addressUnicode: '@example.org',
      source: 'alias',
      aliasId: 3,
      senderAllowed: true,
      catchAll: true,
    },
  ],
  explicitPermissions: [
    {
      value: '@example.com',
      valueUnicode: '@example.com',
      type: 'domain',
      kind: 'domain',
      changeable: true,
      stale: false,
    },
    {
      value: '@other.example',
      valueUnicode: '@other.example',
      type: 'domain',
      kind: 'domain',
      changeable: false,
      stale: false,
    },
    {
      value: '@deleted.example',
      valueUnicode: '@deleted.example',
      type: 'domain',
      kind: null,
      changeable: true,
      stale: true,
    },
  ],
  senderCheckDisabled: false,
  externalSenderAddresses: ['news@mailer.example', '@partner.example'],
  externalSenderAddressesUnicode: ['news@mailer.example', '@partner.example'],
  etag: '"s1"',
  ...overrides,
})

describe('the working copy and its entries', () => {
  it('lists the explicit permissions, then the allowed aliases locked, never the own or catch-all addresses', () => {
    const read = settings()
    const copy = toWorkingCopy(read)
    expect(copy.explicit.map((entry) => entry.value)).toEqual([
      '@example.com',
      '@other.example',
      '@deleted.example',
    ])
    expect(copy.externalText).toBe('news@mailer.example, @partner.example')
    const entries = selectedEntries(read, copy)
    expect(entries.map((entry) => [entry.value, entry.subtext, entry.removable])).toEqual([
      ['@example.com', null, true],
      ['@other.example', 'admin', false],
      ['@deleted.example', 'stale', true],
      ['sales@example.org', 'aliasAllowed', false],
    ])
    expect(blockedAliases(read, copy).map((entry) => entry.value)).toEqual(['info@example.org'])
  })

  it('marks an explicit alias permission "Alias" and takes a blocked alias out of the options once granted', () => {
    const read = settings()
    const copy = toWorkingCopy(read)
    copy.explicit.push({
      value: 'info@example.org',
      valueUnicode: 'info@example.org',
      type: 'address',
      kind: 'alias',
      changeable: true,
      stale: false,
    })
    expect(
      selectedEntries(read, copy).find((entry) => entry.value === 'info@example.org')?.subtext,
    ).toBe('alias')
    expect(blockedAliases(read, copy)).toEqual([])
  })
})

describe('buildSenderPatch', () => {
  it('is null when nothing changed, ignoring order and letter case', () => {
    const read = settings()
    const copy = toWorkingCopy(read)
    copy.explicit.reverse()
    copy.externalText = '@PARTNER.example; news@mailer.example'
    expect(buildSenderPatch(read, copy)).toBeNull()
  })

  it('sends a changed set whole, with the entries the user cannot change', () => {
    const read = settings()
    const copy = toWorkingCopy(read)
    copy.explicit = copy.explicit.filter((entry) => entry.value !== '@example.com')
    expect(buildSenderPatch(read, copy)).toEqual({
      explicitPermissions: ['@other.example', '@deleted.example'],
    })
  })

  it('sends * alone, and the external addresses only when they changed', () => {
    const read = settings()
    const copy = toWorkingCopy(read)
    copy.explicit.push({
      value: '*',
      valueUnicode: '*',
      type: 'anyAddress',
      kind: 'anyAddress',
      changeable: true,
      stale: false,
    })
    copy.externalText = 'news@mailer.example'
    expect(buildSenderPatch(read, copy)).toEqual({
      explicitPermissions: ['*'],
      externalSenderAddresses: ['news@mailer.example'],
    })
  })
})

describe('entryForPath and notNeededAfterSave', () => {
  it('maps an entry index back to the value sent', () => {
    const sent = {
      explicitPermissions: ['@a.example', 'x@b.example'],
      externalSenderAddresses: ['@c.example'],
    }
    expect(entryForPath('explicitPermissions.1', sent)).toBe('x@b.example')
    expect(entryForPath('externalSenderAddresses.0', sent)).toBe('@c.example')
    expect(entryForPath('other', sent)).toBeUndefined()
  })

  it('names the added entries the mailbox may already send as through an alias (FR-055)', () => {
    const response = settings({
      implicitAddresses: [
        ...settings().implicitAddresses,
        {
          address: 'shared@example.com',
          addressUnicode: 'shared@example.com',
          source: 'alias',
          aliasId: 8,
          senderAllowed: true,
          catchAll: false,
        },
      ],
    })
    expect(notNeededAfterSave(['shared@example.com', '@example.com'], response)).toEqual([
      'shared@example.com',
    ])
  })
})
