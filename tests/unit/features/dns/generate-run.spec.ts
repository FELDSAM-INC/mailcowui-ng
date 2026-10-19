// "All names without a key" and run rows (T045, research R8, FR-024): the collection pages through
// `listDkimKeys` with state=missing, the current search and kind, sorted by name, 1,000 at a time,
// until every name is read; the confirmation lists the first 10 names and the rest as a count; the
// collection is never cached.
import { QueryClient } from '@tanstack/vue-query'
import { describe, expect, it, vi } from 'vitest'

import { ApiProblem, type DkimKey, type DkimListParams } from '@/api'
import { collectMissingNames, namePreview, runRows } from '@/features/dns/dkim/generate-run'

import { missingEntry } from './fixtures'

describe('collectMissingNames', () => {
  it('pages through every missing name with the search and kind', async () => {
    const all = Array.from({ length: 2300 }, (_, index) => missingEntry(`m${index}.example`))
    const fetchPage = vi.fn((params: { offset?: number; limit?: number }) =>
      Promise.resolve({
        data: all.slice(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 25)),
        meta: { total: all.length, limit: params.limit ?? 25, offset: params.offset ?? 0 },
      }),
    )
    const names = await collectMissingNames({ q: 'm', kind: 'domain' }, fetchPage)
    expect(names).toHaveLength(2300)
    expect(fetchPage).toHaveBeenCalledTimes(3)
    expect(fetchPage.mock.calls[0]![0]).toEqual({
      state: ['missing'],
      q: 'm',
      kind: 'domain',
      sort: 'name',
      order: 'asc',
      limit: 1000,
      offset: 0,
    })
    expect(fetchPage.mock.calls[2]![0]).toMatchObject({ offset: 2000 })
    expect(names[0]).toEqual({ name: 'm0.example', label: 'm0.example' })
  })

  it('leaves out unset filters and writes nothing to a query cache', async () => {
    const client = new QueryClient()
    const fetchPage = vi.fn((_params: DkimListParams) =>
      Promise.resolve({ data: [] as DkimKey[], meta: { total: 0, limit: 1000, offset: 0 } }),
    )
    expect(await collectMissingNames({}, fetchPage)).toEqual([])
    expect(fetchPage.mock.calls[0]![0]).toEqual({
      state: ['missing'],
      sort: 'name',
      order: 'asc',
      limit: 1000,
      offset: 0,
    })
    expect(client.getQueryCache().getAll()).toHaveLength(0)
  })
})

describe('namePreview', () => {
  it('shows the first 10 names and counts the others', () => {
    const names = Array.from({ length: 13 }, (_, index) => ({
      name: `n${index}`,
      label: `n${index}`,
    }))
    expect(namePreview(names)).toEqual({
      shown: names.slice(0, 10).map((item) => item.label),
      more: 3,
    })
    expect(namePreview(names.slice(0, 2))).toEqual({ shown: ['n0', 'n1'], more: 0 })
  })
})

describe('runRows', () => {
  it('turns runner results and skipped names into rows', () => {
    const refused = ApiProblem.fromParts({ kind: 'problem', status: 404 })
    const rows = runRows(
      [
        { entry: { value: 'a.example', index: 0 }, outcome: 'created', data: undefined },
        { entry: { value: 'b.example', index: 1 }, outcome: 'refused', problem: refused },
      ],
      [{ name: 'c.example', label: 'c.example' }],
      (name) => name.toUpperCase(),
    )
    expect(rows).toEqual([
      {
        name: 'a.example',
        label: 'A.EXAMPLE',
        outcome: 'created',
        result: undefined,
        problem: undefined,
      },
      {
        name: 'b.example',
        label: 'B.EXAMPLE',
        outcome: 'refused',
        result: undefined,
        problem: refused,
      },
      { name: 'c.example', label: 'c.example', outcome: 'skipped' },
    ])
  })
})
