// One request per item for actions without an API bulk operation (UI 005 research R15,
// data-model §2): temporary aliases and filters. Requests go one after another with each item's
// version tag; outcomes follow the conventions, and a lost connection is never retried.
import { describe, expect, it, vi } from 'vitest'

import { ApiProblem } from '@/api'
import { usePerItemRunner } from '@/shared/composables/usePerItemRunner'

import { withSetup } from '../../support/composable'

const problem = (status: number, type: string | null = null) =>
  ApiProblem.fromParts({ kind: 'problem', status, type: type ? `/api/v2/problems/${type}` : null })

const items = [
  { id: 'a', label: 'A', etag: '"1"' },
  { id: 'b', label: 'B', etag: '"2"' },
  { id: 'c', label: 'C', etag: '"3"' },
  { id: 'd', label: 'D', etag: '"4"' },
  { id: 'e', label: 'E', etag: '"5"' },
]

describe('usePerItemRunner', () => {
  it('sends one request at a time with each version tag and maps the outcomes', async () => {
    const order: string[] = []
    let inFlight = 0
    const send = vi.fn(async (item: (typeof items)[number]) => {
      inFlight += 1
      expect(inFlight).toBe(1)
      order.push(`${item.id}:${item.etag}`)
      await Promise.resolve()
      inFlight -= 1
      if (item.id === 'b') throw problem(404)
      if (item.id === 'c') throw problem(412)
      if (item.id === 'd') throw problem(403, 'permission-flag-required')
      if (item.id === 'e') throw problem(500)
    })
    const { result } = withSetup(() => usePerItemRunner())
    const rows = await result.run(items, send)
    expect(order).toEqual(['a:"1"', 'b:"2"', 'c:"3"', 'd:"4"', 'e:"5"'])
    expect(rows.map((row) => [row.id, row.outcome])).toEqual([
      ['a', 'done'],
      ['b', 'notFound'],
      ['c', 'outdated'],
      ['d', 'refused'],
      ['e', 'failed'],
    ])
    expect(rows[3]?.problem?.is('permission-flag-required')).toBe(true)
    expect(result.rows.value).toEqual(rows)
    expect(result.notDone.value).toEqual(['b', 'c', 'd', 'e'])
    expect(result.running.value).toBe(false)
  })

  it('reports a lost connection as outcome unknown, stops and never retries', async () => {
    const send = vi.fn((item: (typeof items)[number]) =>
      item.id === 'b'
        ? Promise.reject(ApiProblem.fromParts({ kind: 'network' }))
        : Promise.resolve(),
    )
    const { result } = withSetup(() => usePerItemRunner())
    const rows = await result.run(items, send)
    expect(send).toHaveBeenCalledTimes(2)
    expect(rows.map((row) => row.outcome)).toEqual([
      'done',
      'unknown',
      'notProcessed',
      'notProcessed',
      'notProcessed',
    ])
  })

  it('exposes the progress while running and ignores a second run', async () => {
    let release!: () => void
    const { result } = withSetup(() => usePerItemRunner())
    const first = result.run(items.slice(0, 2), (item) =>
      item.id === 'a' ? new Promise<void>((resolve) => (release = resolve)) : Promise.resolve(),
    )
    expect(result.running.value).toBe(true)
    expect(result.progress.value).toEqual({ current: 1, total: 2 })
    expect(await result.run(items, () => Promise.resolve())).toEqual([])
    release()
    await first
    expect(result.progress.value).toEqual({ current: 2, total: 2 })
  })
})
