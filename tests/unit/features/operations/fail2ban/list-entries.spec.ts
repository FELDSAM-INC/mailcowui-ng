// UI 011 (FR-069, data-model §2 EntryListModel and §6, T104): a list field holds one entry per
// line; entries are trimmed, empty lines dropped and duplicates kept once, each sent entry keeps its
// line for the error messages, and the client checks follow the contract's rules.
import { describe, expect, it } from 'vitest'

import { checkLists, parseEntries } from '@/features/operations/fail2ban/list-entries'

describe('parseEntries', () => {
  it('trims, drops empty lines and keeps the first of duplicates with its line', () => {
    expect(
      parseEntries('  192.0.2.0/24 \n\n office.example.org\n192.0.2.0/24\nOFFICE.example.org\n'),
    ).toEqual({
      entries: ['192.0.2.0/24', 'office.example.org'],
      lineOf: [1, 3],
    })
    expect(parseEntries('')).toEqual({ entries: [], lineOf: [] })
  })
})

describe('checkLists', () => {
  const limits = { maxEntries: 3 }

  it('accepts addresses, networks and host names on the allowlist', () => {
    const allow = parseEntries('192.0.2.1\n192.0.2.0/24\n2001:db8::/32\noffice.example.org')
    expect(checkLists(allow, parseEntries(''), { maxEntries: 10 })).toEqual([])
  })

  it('refuses invalid entries, reserved denylist entries, entries on both lists and too many', () => {
    const allow = parseEntries('192.0.2.0/24\nbad host!\n198.51.100.9')
    const deny = parseEntries('0.0.0.0/0\nexample.org\n198.51.100.9\n203.0.113.5')
    expect(checkLists(allow, deny, limits)).toEqual([
      { list: 'allowlist', index: 1, line: 2, entry: 'bad host!', code: 'invalidFormat' },
      { list: 'denylist', index: null, line: null, entry: null, code: 'tooMany' },
      { list: 'denylist', index: 0, line: 1, entry: '0.0.0.0/0', code: 'reserved' },
      { list: 'denylist', index: 1, line: 2, entry: 'example.org', code: 'invalidFormat' },
      { list: 'denylist', index: 2, line: 3, entry: '198.51.100.9', code: 'conflictsWith' },
    ])
  })

  it('refuses entries longer than 253 characters', () => {
    const allow = parseEntries(`${'a'.repeat(250)}.org`)
    expect(checkLists(allow, parseEntries(''), { maxEntries: 10 })).toEqual([
      { list: 'allowlist', index: 0, line: 1, entry: `${'a'.repeat(250)}.org`, code: 'tooLong' },
    ])
  })
})
