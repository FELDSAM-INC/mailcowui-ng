import { expect, it } from 'vitest'
import { QueryClient } from '@tanstack/vue-query'
import {
  globalFiltersOptions,
  checkGlobalFilter,
  replaceGlobalFilter,
} from '@/features/system-settings/api/global-filters'
import { mockState, useScenario } from '../../../mocks/node'

it('checks without writes or restarts and preserves the explicit restart choice', async () => {
  useScenario('global-sieve-default')
  const client = new QueryClient()
  const filters = await client.fetchQuery(globalFiltersOptions())
  expect(filters.map((filter) => filter.id)).toEqual(['prefilter', 'postfilter'])
  const before = structuredClone(filters[0]!)
  expect(await checkGlobalFilter(before, 'keep;')).toEqual({ valid: true })
  expect(mockState().settings.globalFilters[0]).toEqual(before)
  expect(mockState().settings.restartCount).toBe(0)
  const deferred = await replaceGlobalFilter(before, '# Changed\r\nkeep;', true)
  expect(deferred.filter.script).toBe('# Changed\nkeep;')
  expect(deferred.restart.outcome).toBe('deferred')
  expect(mockState().settings.restartCount).toBe(0)
  await expect(replaceGlobalFilter(before, 'keep;', false)).rejects.toMatchObject({ status: 412 })
  const done = await replaceGlobalFilter(deferred.filter, '', false)
  expect(done.restart.outcome).toBe('done')
  expect(mockState().settings.restartCount).toBe(1)
  expect(mockState().settings.globalFilters[1]).toEqual(filters[1])
  client.clear()
})

it('reports saved-but-failed restarts and refuses missing files without a restart', async () => {
  useScenario('global-sieve-restart-fails')
  const saved = await replaceGlobalFilter(
    mockState().settings.globalFilters[0]!,
    '# Changed\nkeep;',
    false,
  )
  expect(saved.restart.outcome).toBe('failed')
  expect(mockState().settings.globalFilters[0]!.script).toBe('# Changed\nkeep;')
})

it('refuses missing files without a restart', async () => {
  useScenario('global-sieve-file-missing')
  await expect(
    replaceGlobalFilter(mockState().settings.globalFilters[1]!, 'keep;', false),
  ).rejects.toMatchObject({ status: 409 })
  expect(mockState().settings.restartCount).toBe(0)
})

it('returns parser lines, preserves scripts on invalid requests, and refuses non-admins', async () => {
  useScenario('global-sieve-default')
  const before = structuredClone(mockState().settings.globalFilters)
  await expect(checkGlobalFilter(before[0]!, '# comment\nkeep')).rejects.toMatchObject({
    status: 422,
    fieldErrors: new Map([
      [
        'script',
        [
          expect.objectContaining({
            code: 'sieveSyntax',
            params: { line: 2, message: 'Expected semicolon after keep' },
          }),
        ],
      ],
    ]),
  })
  expect(mockState().settings.globalFilters).toEqual(before)
  expect(mockState().settings.restartCount).toBe(0)
  useScenario('settings-domain-admin')
  await expect(new QueryClient().fetchQuery(globalFiltersOptions())).rejects.toMatchObject({
    status: 403,
  })
})
