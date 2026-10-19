// UI 011 (FR-057, FR-059, research R14): the queue actions' outcomes — the result per message, a
// lost connection as "outcome unknown" (never repeated), a stopped Postfix naming its container,
// and the list refreshed after every action; and the cached list without a message that left.
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type { MailQueueMessage } from '@/api'
import {
  forgetQueuedMessage,
  mailQueueListOptions,
  type MailQueuePage,
} from '@/features/operations/mail-queue/api'
import { useQueueActions } from '@/features/operations/mail-queue/composables/useQueueActions'

import { mockState, server, useScenario } from '../../../../mocks/node'
import { withSetup } from '../../../support/composable'
import { testPlugins } from '../../../support/mount'

const API = '*/api/v2'

const message = (id: string) => ({ id }) as MailQueueMessage

const requests = (operationId: string) =>
  mockState().requests.filter((request) => request.operationId === operationId)

describe('useQueueActions', () => {
  it('sends one request and keeps the result per message', async () => {
    useScenario('ops-queue')
    const { result } = withSetup(() => useQueueActions())
    const done = await result.run('hold', [message('4F2A1B3C9D'), message('5B0C2D4E1F')])
    expect(done).toBe(true)
    expect(result.status.value).toBe('Queue command completed successfully')
    expect(result.rows.value.map((row) => row.label)).toEqual(['4F2A1B3C9D', '5B0C2D4E1F'])
    expect(result.unknown.value).toBe(false)
    expect(result.notRecorded.value).toBe(false)
    expect(requests('bulkMailQueueMessages')).toHaveLength(1)
    result.close()
    expect(result.status.value).toBeNull()
    expect(result.rows.value).toEqual([])
  })

  it('reports a lost connection as "outcome unknown" for every message, without a problem', async () => {
    useScenario('ops-queue')
    server.use(http.post(`${API}/mail-queue/messages/bulk-actions`, () => HttpResponse.error()))
    const { result } = withSetup(() => useQueueActions())
    const done = await result.run('delete', [message('4F2A1B3C9D')])
    expect(done).toBe(false)
    expect(result.unknown.value).toBe(true)
    expect(result.problem.value).toBeNull()
    expect(result.rows.value.map((row) => [row.label, row.outcome])).toEqual([
      ['4F2A1B3C9D', 'unknown'],
    ])
    expect(result.running.value).toBe(false)
  })

  it('names the stopped Postfix container of a refused flush', async () => {
    useScenario('ops-queue-postfix-stopped')
    const { result } = withSetup(() => useQueueActions())
    expect(await result.flush()).toBe(false)
    expect(result.stoppedContainer.value).toBe('postfix-mailcow')
    expect(result.problem.value?.is('mail-service-not-running')).toBe(true)
  })

  it('reads the list again after an action, whatever its outcome', async () => {
    useScenario('ops-queue-timeout')
    const { queryClient } = testPlugins()
    const params = { sort: 'arrivalTime', order: 'asc', limit: 25, offset: 0 } as const
    await queryClient.fetchQuery(mailQueueListOptions(params))
    const { result } = withSetup(() => useQueueActions())
    expect(await result.flush()).toBe(false)
    expect(result.unknown.value).toBe(true)
    expect(queryClient.getQueryState(mailQueueListOptions(params).queryKey)?.isInvalidated).toBe(
      true,
    )
  })
})

describe('forgetQueuedMessage', () => {
  it('drops a message that left the queue from every cached page', async () => {
    useScenario('ops-queue')
    const { queryClient } = testPlugins()
    const params = { sort: 'arrivalTime', order: 'asc', limit: 25, offset: 0 } as const
    const page = await queryClient.fetchQuery(mailQueueListOptions(params))
    expect(page.data.some((item) => item.id === '4F2A1B3C9D')).toBe(true)
    forgetQueuedMessage(queryClient, '4F2A1B3C9D')
    const cached = queryClient.getQueryData<MailQueuePage>(mailQueueListOptions(params).queryKey)!
    expect(cached.data.some((item) => item.id === '4F2A1B3C9D')).toBe(false)
    expect(cached.data).toHaveLength(page.data.length - 1)
  })
})
