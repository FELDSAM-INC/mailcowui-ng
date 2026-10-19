// The optional columns of the wide mailbox list (UI 003 T052, FR-008, data-model §4): legacy's row
// details offered by the column chooser, remembered in `mailcowui-ng.mailboxes.columns`, unknown ids
// ignored, the defaults when storage fails.
import { afterEach, describe, expect, it, vi } from 'vitest'

import { COLUMNS, OPTIONAL_COLUMNS, readColumns, writeColumns } from '@/features/mailboxes/columns'

afterEach(() => vi.restoreAllMocks())

describe('columns', () => {
  it('lists legacy’s visible columns as defaults and its row details as optional', () => {
    expect(COLUMNS.filter((column) => column.default).map((column) => column.id)).toEqual([
      'address',
      'quota',
      'lastMailLogin',
      'passwordChangedAt',
      'inUse',
      'messages',
      'status',
    ])
    expect(OPTIONAL_COLUMNS).toEqual([
      'displayName',
      'domain',
      'authSource',
      'tlsEnforceInbound',
      'tlsEnforceOutbound',
      'smtp',
      'imap',
      'pop3',
      'sieve',
      'activeSync',
      'dav',
      'quarantineNotification',
      'quarantineCategory',
      'createdAt',
      'modifiedAt',
      'tags',
    ])
  })

  it('remembers the chosen optional columns and ignores unknown ids', () => {
    writeColumns(['domain', 'createdAt'])
    expect(localStorage.getItem('mailcowui-ng.mailboxes.columns')).toBe('["domain","createdAt"]')
    expect(readColumns()).toEqual(['domain', 'createdAt'])
    localStorage.setItem('mailcowui-ng.mailboxes.columns', '["nope","tags",3]')
    expect(readColumns()).toEqual(['tags'])
    localStorage.setItem('mailcowui-ng.mailboxes.columns', 'not json')
    expect(readColumns()).toEqual([])
  })

  it('falls back to no optional columns when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(readColumns()).toEqual([])
  })
})
