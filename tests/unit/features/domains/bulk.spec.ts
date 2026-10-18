// Bulk targets, the skipped partition and per-item rows (UI 002 T022, research D22).
import { describe, expect, it } from 'vitest'

import { ApiProblem, type BulkResult } from '@/api'
import {
  partitionDeletable,
  rowsFromBulkResult,
  toBulkTargets,
  unknownRows,
} from '@/features/domains/bulk'

const entry = (name: string, unicodeName = name, mailboxes = 0, resources = 0) => ({
  name,
  unicodeName,
  etag: `"v-${name}"`,
  usage: { mailboxes, resources },
})

describe('bulk helpers', () => {
  it('maps entries to targets with the etag exactly as read (G33)', () => {
    expect(
      toBulkTargets([entry('a.example'), { ...entry('b.example'), etag: 'W/"weak"' }]),
    ).toEqual([
      { id: 'a.example', version: '"v-a.example"' },
      { id: 'b.example', version: 'W/"weak"' },
    ])
  })

  it('sets aside domains with mailboxes or resources', () => {
    const { deletable, skipped } = partitionDeletable([
      entry('a.example'),
      entry('busy.example', 'busy.example', 3),
      entry('things.example', 'things.example', 0, 1),
    ])
    expect(deletable.map((d) => d.name)).toEqual(['a.example'])
    expect(skipped.map((d) => d.name)).toEqual(['busy.example', 'things.example'])
  })

  it('keeps request order and labels rows by readable name, with item problems', () => {
    const result: BulkResult = {
      bulkRequestId: 'a'.repeat(32),
      results: [
        { id: 'xn--mnchen-3ya.de', outcome: 'done', version: 'v2' },
        {
          id: 'b.example',
          outcome: 'failed',
          problem: {
            type: '/api/v2/problems/temporary-failure',
            title: 'x',
            status: 503,
            requestId: 'b'.repeat(32),
          },
        },
      ],
      summary: { total: 2, done: 1, notFound: 0, refused: 0, outdated: 0, failed: 1 },
    }
    const rows = rowsFromBulkResult(result, [
      entry('b.example'),
      entry('xn--mnchen-3ya.de', 'münchen.de'),
    ])
    expect(rows.map((r) => [r.id, r.label, r.outcome])).toEqual([
      ['xn--mnchen-3ya.de', 'münchen.de', 'done'],
      ['b.example', 'b.example', 'failed'],
    ])
    expect(rows[1]!.problem).toBeInstanceOf(ApiProblem)
    expect(rows[1]!.problem!.is('temporary-failure')).toBe(true)
  })

  it('reports every target as outcome unknown after a lost connection', () => {
    expect(unknownRows([entry('a.example'), entry('b.example')]).map((r) => r.outcome)).toEqual([
      'unknown',
      'unknown',
    ])
  })
})
