// UI 006 T083 (research R19, data-model §8 "List entry removal run"): one DELETE per entry, in
// order, each with its version tag; 404 counts as already removed; the run continues after a
// failure; "retry failed" sends only the failed entries again.
import { describe, expect, it, vi } from 'vitest'

import { ApiProblem, type SpamPolicyEntry } from '@/api'
import { useRemoveEntries } from '@/features/spam-filter/composables/useRemoveEntries'

function entry(id: number): SpamPolicyEntry {
  return {
    id,
    list: 'block',
    owner: { kind: 'mailbox', name: 'alice@example.org' },
    pattern: `*@s${id}.example`,
    createdAt: '2026-09-01T08:00:00Z',
    own: true,
    etag: `"e${id}"`,
  }
}

const problem = (status: number) => ApiProblem.fromParts({ kind: 'problem', status })

describe('useRemoveEntries', () => {
  it('removes the entries one after another, in order, and reports each result', async () => {
    const order: string[] = []
    let running = 0
    const remove = vi.fn(async (item: SpamPolicyEntry) => {
      running += 1
      expect(running).toBe(1)
      order.push(`${item.id} ${item.etag}`)
      await Promise.resolve()
      running -= 1
      if (item.id === 2) throw problem(404)
      if (item.id === 3) throw problem(500)
    })
    const finished = vi.fn()
    const run = useRemoveEntries({ remove, finished })
    const rows = await run.run([entry(1), entry(2), entry(3), entry(4)])
    expect(order).toEqual(['1 "e1"', '2 "e2"', '3 "e3"', '4 "e4"'])
    expect(rows.map((row) => [row.id, row.label, row.outcome])).toEqual([
      ['1', '*@s1.example', 'done'],
      ['2', '*@s2.example', 'notFound'],
      ['3', '*@s3.example', 'failed'],
      ['4', '*@s4.example', 'done'],
    ])
    expect(rows[2]!.problem?.status).toBe(500)
    expect(run.phase.value).toBe('results')
    expect(run.failedIds.value).toEqual(['3'])
    expect(finished).toHaveBeenCalledTimes(1)
  })

  it('maps refusals, outdated versions and lost connections to their outcomes', async () => {
    const failures: Record<number, ApiProblem> = {
      1: problem(403),
      2: problem(412),
      3: ApiProblem.fromParts({ kind: 'network' }),
    }
    const run = useRemoveEntries({
      remove: (item) => Promise.reject(failures[item.id]!),
    })
    const rows = await run.run([entry(1), entry(2), entry(3)])
    expect(rows.map((row) => row.outcome)).toEqual(['refused', 'outdated', 'unknown'])
    expect(run.failedIds.value).toEqual(['1', '2'])
  })

  it('retries only the failed entries and keeps the other results', async () => {
    let fail = true
    const remove = vi.fn((item: SpamPolicyEntry) =>
      item.id === 2 && fail ? Promise.reject(problem(503)) : Promise.resolve(),
    )
    const run = useRemoveEntries({ remove })
    await run.run([entry(1), entry(2), entry(3)])
    expect(run.failedIds.value).toEqual(['2'])
    remove.mockClear()
    fail = false
    await run.retry()
    expect(remove.mock.calls.map(([item]) => item.id)).toEqual([2])
    expect(run.rows.value.map((row) => [row.id, row.outcome])).toEqual([
      ['1', 'done'],
      ['2', 'done'],
      ['3', 'done'],
    ])
    expect(run.failedIds.value).toEqual([])
  })

  it('is running while it sends and idle again after close', async () => {
    let release: () => void = () => {}
    const run = useRemoveEntries({
      remove: () => new Promise<void>((resolve) => (release = resolve)),
    })
    const pending = run.run([entry(1)])
    expect(run.phase.value).toBe('running')
    release()
    await pending
    expect(run.phase.value).toBe('results')
    run.close()
    expect(run.phase.value).toBe('idle')
    expect(run.rows.value).toEqual([])
  })
})
