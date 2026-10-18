// Multi-entry fields (T019, UI 004 data-model §2, research R8): the separators and duplicate rule
// of the classic forms, with each entry's position in the list sent.
import { describe, expect, it } from 'vitest'

import { isCatchAll, joinEntries, parseEntryList } from '@/shared/validation/entry-list'

describe('parseEntryList', () => {
  it('splits on commas, semicolons, spaces and new lines, trims and drops empty entries', () => {
    expect(
      parseEntryList(' a@example.org,b@example.org;c@example.org\n\nd@example.org\te@x ,,; '),
    ).toEqual([
      { value: 'a@example.org', index: 0 },
      { value: 'b@example.org', index: 1 },
      { value: 'c@example.org', index: 2 },
      { value: 'd@example.org', index: 3 },
      { value: 'e@x', index: 4 },
    ])
    expect(parseEntryList('   ')).toEqual([])
  })

  it('drops entries that differ only in letter case, keeping the first spelling and its case', () => {
    expect(parseEntryList('Sales@Example.org, sales@example.org, Info@example.org')).toEqual([
      { value: 'Sales@Example.org', index: 0 },
      { value: 'Info@example.org', index: 1 },
    ])
  })

  it('marks catch-all entries and joins entries back for the field', () => {
    expect(isCatchAll('@example.org')).toBe(true)
    expect(isCatchAll('info@example.org')).toBe(false)
    expect(joinEntries(['a@example.org', 'b@example.org'])).toBe('a@example.org, b@example.org')
  })
})
