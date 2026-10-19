// The alias mass actions (T083, data-model §2 BulkActionConfig, research R16): the actions per
// permission and groupware state with legacy's labels, the confirmation kinds, the targets with
// unquoted versions, and every item not done kept selected.
import { describe, expect, it } from 'vitest'

import { aliasBulkActions, retainedIds, toTargets, unquote } from '@/features/aliases/alias-bulk'
import { feature004Permissions } from '@/features/aliases/permissions'
import type { BulkRow } from '@/shared/components/bulk-row'

import { alias } from './alias-fixture'

const admin = feature004Permissions(
  { role: 'admin', permissions: {} } as never,
  { groupwareEnabled: true } as never,
)

describe('aliasBulkActions', () => {
  it("offers legacy's actions with their confirmations, the groupware ones only with the groupware", () => {
    expect(
      aliasBulkActions(admin, { groupwareEnabled: true }).map((action) => [
        action.action,
        action.labelKey,
        action.confirm,
      ]),
    ).toEqual([
      ['activate', 'mailbox.activate', 'none'],
      ['deactivate', 'mailbox.deactivate', 'simple'],
      ['showInGroupware', 'mailbox.sogo_visible_y', 'none'],
      ['hideInGroupware', 'mailbox.sogo_visible_n', 'simple'],
      ['copyOverAliasDomains', 'mailbox.add_alias_expand', 'explain'],
      ['delete', 'mailbox.remove', 'typedCount'],
    ])
    expect(
      aliasBulkActions(admin, { groupwareEnabled: false }).map((action) => action.action),
    ).not.toContain('showInGroupware')
  })
})

describe('toTargets', () => {
  it('sends the ID and the version as listed, without quotes', () => {
    expect(unquote('"a1"')).toBe('a1')
    expect(unquote('W/"a1"')).toBe('a1')
    expect(toTargets([alias({ id: 7, etag: '"abc"' })], (item) => String(item.id))).toEqual([
      { id: '7', version: 'abc' },
    ])
  })
})

describe('retainedIds', () => {
  it('keeps every item that is not done', () => {
    const rows: BulkRow[] = [
      { id: '1', label: 'a', outcome: 'done' },
      { id: '2', label: 'b', outcome: 'notFound' },
      { id: '3', label: 'c', outcome: 'outdated' },
      { id: '4', label: 'd', outcome: 'unknown' },
    ]
    expect(retainedIds(rows)).toEqual(['2', '3', '4'])
  })
})
