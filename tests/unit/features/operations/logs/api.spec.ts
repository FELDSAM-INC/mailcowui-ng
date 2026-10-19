// UI 011 (FR-036 to FR-038, SC-010, T075; plan decision 11): a log loads its newest 50 entries,
// legacy's "+ 100" and "+ 1000" add older entries with the cursor (newer ones by offset when sorted
// oldest first) without duplicates while entries arrive, the total comes from the first page, it
// never refetches on its own, and Refresh starts again from the first page.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'

import { FIRST_PAGE, useLogEntries, type LogQuery } from '@/features/operations/logs/api'
import { findLogType } from '@/features/operations/logs/log-types'

import { mockState, useScenario } from '../../../../mocks/node'
import { withSetup } from '../../../support/composable'

const postfix = findLogType('postfix')!

function requests() {
  return mockState()
    .requests.filter((request) => request.operationId === 'listPostfixLog')
    .map((request) => new URL(request.path, 'http://x').searchParams)
}

async function settle(condition: () => boolean) {
  for (let i = 0; i < 200 && !condition(); i += 1) {
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  expect(condition()).toBe(true)
}

function setup(query: LogQuery = { order: 'desc' }) {
  const params = ref<LogQuery>(query)
  const mounted = withSetup(() =>
    useLogEntries(
      () => postfix,
      () => params.value,
    ),
  )
  return { ...mounted, params }
}

describe('useLogEntries', () => {
  it('loads the newest 50 entries with the total of the first page', async () => {
    useScenario('ops-logs-large')
    const { result } = setup()
    await settle(() => result.entries.value.length > 0)
    expect(FIRST_PAGE).toBe(50)
    expect(result.entries.value).toHaveLength(50)
    expect(result.total.value).toBe(10_003)
    const [first] = requests()
    expect(first!.get('limit')).toBe('50')
    expect(first!.get('order')).toBe('desc')
    expect(first!.has('before')).toBe(false)
  })

  it('adds older entries with the cursor of the oldest shown entry, without duplicates', async () => {
    useScenario('ops-logs-large')
    const { result } = setup()
    await settle(() => result.entries.value.length > 0)
    const oldest = result.entries.value.at(-1)!.id
    expect(await result.loadMore(100)).toBe(100)
    const second = requests()[1]!
    expect(second.get('before')).toBe(oldest)
    expect(second.get('offset')).toBe('0')
    expect(second.get('limit')).toBe('100')
    expect(await result.loadMore(1000)).toBe(1000)
    const ids = result.entries.value.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(1150)
    expect(result.total.value).toBe(10_003)
  })

  it('continues by offset when sorted oldest first', async () => {
    useScenario('admin-operations')
    const { result } = setup({ order: 'asc' })
    await settle(() => result.entries.value.length > 0)
    expect(result.entries.value[0]!.id).toBe('postfix-0')
    expect(await result.loadMore(100)).toBe(70)
    const second = requests()[1]!
    expect(second.get('order')).toBe('asc')
    expect(second.get('offset')).toBe('50')
    expect(second.has('before')).toBe(false)
    expect(await result.loadMore(100)).toBe(0)
  })

  it('sends the search and starts again when it changes', async () => {
    useScenario('admin-operations')
    const { result, params } = setup()
    await settle(() => result.entries.value.length > 0)
    params.value = { order: 'desc', q: 'ALICE@example.org' }
    await nextTick()
    await settle(() => requests().length === 2 && !result.loading.value)
    expect(requests()[1]!.get('q')).toBe('ALICE@example.org')
    expect(
      result.entries.value.every(
        (entry) => 'message' in entry && /alice/i.test(entry.message ?? ''),
      ),
    ).toBe(true)
  })

  it('reloads only the first page on refresh, and never on its own', async () => {
    useScenario('admin-operations')
    const { result } = setup()
    await settle(() => result.entries.value.length > 0)
    await result.loadMore(100)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(requests()).toHaveLength(2)
    await result.refresh()
    await settle(() => requests().length === 3 && result.entries.value.length === 50)
    expect(requests()[2]!.has('before')).toBe(false)
  })

  it('reports a failed first page as a problem', async () => {
    useScenario('ops-logs-unavailable')
    const { result } = setup()
    await settle(() => result.problem.value !== null)
    expect(result.problem.value?.status).toBe(503)
    expect(result.entries.value).toEqual([])
  })
})
