import { expect, it } from 'vitest'
import { QueryClient } from '@tanstack/vue-query'
import {
  regexMapOptions,
  regexMapsOptions,
  checkRegexMap,
  replaceRegexMap,
} from '@/features/system-settings/api/regex-maps'
import { mockState, useScenario } from '../../../mocks/node'
it('keeps summary lists light, checks without writing, and versions the explicit replacement', async () => {
  useScenario('filter-maps-13')
  const client = new QueryClient()
  const list = await client.fetchQuery(regexMapsOptions({}))
  expect(list.data).toHaveLength(13)
  expect(list.data[0]).not.toHaveProperty('content')
  const id = list.data[0]!.id
  const before = await client.fetchQuery(regexMapOptions(id))
  expect(await checkRegexMap(id, '/new/i', before.etag)).toEqual({ valid: true })
  expect(mockState().settings.regexMaps[0]).toEqual(before)
  await expect(replaceRegexMap(id, '/new/i', '"stale"')).rejects.toMatchObject({ status: 412 })
  const saved = await replaceRegexMap(id, '/new/i', before.etag)
  expect(saved.content).toBe('/new/i\n')
  expect(saved.etag).not.toBe(before.etag)
  client.clear()
})
it('refuses unavailable maps and scoped accounts; compiler errors carry the server line', async () => {
  useScenario('filter-maps-13')
  const map = mockState().settings.regexMaps[12]!
  await expect(replaceRegexMap(map.id, '/x/', map.etag)).rejects.toMatchObject({ status: 409 })
  const first = mockState().settings.regexMaps[0]!
  try {
    await checkRegexMap(first.id, '# comment\n/[bad/i', first.etag)
    expect.unreachable()
  } catch (error) {
    expect((error as { fieldErrors: Map<string, unknown[]> }).fieldErrors.get('content')).toEqual([
      expect.objectContaining({
        code: 'invalidRegexLine',
        params: { line: 2, reason: 'doesNotCompile' },
      }),
    ])
  }
  useScenario('settings-domain-admin')
  await expect(new QueryClient().fetchQuery(regexMapsOptions({}))).rejects.toMatchObject({
    status: 403,
  })
})
