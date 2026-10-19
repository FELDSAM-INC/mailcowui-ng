// The DKIM list's bulk actions (T045, FR-040): generation for both roles, deletion for
// administrators, and the entries each action skips.
import { describe, expect, it } from 'vitest'

import { dkimBulkActions, splitSelection } from '@/features/dns/dkim/bulk'

import { dkimEntry, incompleteEntry, missingEntry, unusedEntry } from './fixtures'

describe('dkim bulk', () => {
  it('offers generation to both roles and deletion to administrators', () => {
    expect(dkimBulkActions('admin').map((action) => action.id)).toEqual(['generate', 'delete'])
    expect(dkimBulkActions('domainAdmin').map((action) => action.id)).toEqual(['generate'])
    expect(dkimBulkActions('admin')[1]!.destructive).toBe(true)
  })

  it('generates for names without a key and skips the others', () => {
    const entries = [dkimEntry(), missingEntry(), incompleteEntry(), unusedEntry()]
    const { targets, skipped } = splitSelection(entries, 'generate')
    expect(targets.map((entry) => entry.name)).toEqual(['example.net'])
    expect(skipped.map((entry) => entry.name)).toEqual([
      'example.org',
      'incomplete.example',
      'Legacy.Example',
    ])
  })

  it('deletes keys and skips names without one', () => {
    const entries = [dkimEntry(), missingEntry(), incompleteEntry()]
    const { targets, skipped } = splitSelection(entries, 'delete')
    expect(targets.map((entry) => entry.name)).toEqual(['example.org', 'incomplete.example'])
    expect(skipped.map((entry) => entry.name)).toEqual(['example.net'])
  })
})
