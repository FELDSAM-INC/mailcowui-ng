// UI 006 T047 (data-model §8 "Item action", research R14, FR-025 to FR-031): each outcome of an
// item action, with fake timers for the single busy re-check after Retry-After, the re-read after
// no response, and never a second action request.
import { flushPromises } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { isApiProblem, type QuarantineItemDetails } from '@/api'
import type { ItemActionKind } from '@/features/quarantine/api'
import { fetchQuarantineItem } from '@/features/quarantine/api'
import { useItemAction, type RereadResult } from '@/features/quarantine/composables/useItemAction'

import { mockState, server, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'

afterEach(() => {
  vi.useRealTimers()
})

const actionRequests = () =>
  mockState().requests.filter((request) =>
    ['releaseQuarantineItem', 'learnQuarantineItemAsSpam', 'deleteQuarantineItem'].includes(
      request.operationId ?? '',
    ),
  )
const reads = () =>
  mockState().requests.filter((request) => request.operationId === 'getQuarantineItem')

async function setup(
  scenario: string,
  itemId: number,
  ask: (kind: ItemActionKind) => Promise<boolean> = () => Promise.resolve(true),
) {
  useScenario(scenario)
  const item: QuarantineItemDetails = await fetchQuarantineItem(itemId)
  const finished = vi.fn()
  const gone = vi.fn()
  const reread = vi.fn(async (): Promise<RereadResult> => {
    try {
      await fetchQuarantineItem(itemId)
      return 'present'
    } catch (error) {
      return isApiProblem(error) && error.status === 404 ? 'gone' : 'failed'
    }
  })
  let action!: ReturnType<typeof useItemAction>
  mountWithApp(
    defineComponent({
      setup() {
        action = useItemAction({
          item: () => item,
          reread,
          onFinished: finished,
          onGone: gone,
          ask: (kind) => ask(kind),
        })
        return () => h('div')
      },
    }),
  )
  return { item, action, finished, gone, reread }
}

describe('useItemAction', () => {
  it('accepts only one action while its confirmation is pending', async () => {
    let answer!: (confirmed: boolean) => void
    const ask = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          answer = resolve
        }),
    )
    const { action } = await setup('quarantine-mailbox-user', 2, ask)
    const first = action.run('delete')
    const second = action.run('delete')
    expect(ask).toHaveBeenCalledOnce()
    answer(true)
    await Promise.all([first, second])
    expect(actionRequests()).toHaveLength(1)
  })

  it('prevents duplicate immediate deliveries before the first await resolves', async () => {
    const { action } = await setup('quarantine-mailbox-user', 2)
    await Promise.all([action.run('release'), action.run('release')])
    expect(actionRequests()).toHaveLength(1)
  })

  it('delivers with learning and If-Match, then returns with legacy’s alerts', async () => {
    const { item, action, finished } = await setup('quarantine-mailbox-user', 2)
    await action.run('release')
    const [request] = actionRequests()
    expect(request!.headers['if-match']).toBe(item.etag)
    expect(request!.body).toEqual({ learnAsHam: true })
    expect(finished).toHaveBeenCalledWith([
      { kind: 'success', text: 'Item 2 released' },
      { kind: 'success', text: 'Successfully learned ID 2 as ham' },
    ])
  })

  it('releases without learning and removes, each with its alert', async () => {
    const first = await setup('quarantine-mailbox-user', 2)
    await first.action.run('releaseWithoutLearning')
    expect(actionRequests().at(-1)!.body).toEqual({ learnAsHam: false })
    expect(first.finished).toHaveBeenCalledWith([{ kind: 'success', text: 'Item 2 released' }])
    await first.action.run('delete')
    // The item is gone now: the removal answers 404 and returns to the list.
    expect(first.gone).toHaveBeenCalledTimes(1)
    const second = await setup('quarantine-mailbox-user', 3)
    await second.action.run('delete')
    expect(second.finished).toHaveBeenCalledWith([
      { kind: 'success', text: 'Item 3 successfully deleted' },
    ])
  })

  it('sends nothing when the confirmation is cancelled', async () => {
    const { action, finished } = await setup('quarantine-mailbox-user', 5, () =>
      Promise.resolve(false),
    )
    await action.run('release')
    expect(actionRequests()).toEqual([])
    expect(finished).not.toHaveBeenCalled()
  })

  it('sends one request while one is running (FR-031)', async () => {
    const { action } = await setup('quarantine-mailbox-user', 2)
    mockState().delays.releaseQuarantineItem = 200
    const first = action.run('release')
    await vi.waitFor(() => expect(action.sending.value).toBe(true))
    // A second click in another task, while the first request runs.
    await new Promise((resolve) => setTimeout(resolve, 20))
    await action.run('release')
    await first
    expect(actionRequests()).toHaveLength(1)
  })

  it('404: back to the list', async () => {
    const { action, gone } = await setup('quarantine-mailbox-user', 2)
    mockState().quarantine.items = mockState().quarantine.items.filter((entry) => entry.id !== 2)
    await action.run('learnAsSpam')
    expect(gone).toHaveBeenCalledWith([{ kind: 'danger', text: 'This item could not be found.' }])
  })

  it('busy: one re-read after Retry-After, then back to the list when the item is gone', async () => {
    const { action, gone, reread } = await setup('quarantine-busy', 1)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await action.run('release')
    expect(action.lines.value[0]!.text).toContain('Another action is in progress')
    expect(action.waiting.value).toBe(true)
    expect(reread).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(4_900)
    expect(reread).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(200)
    await vi.waitFor(() => expect(gone).toHaveBeenCalledTimes(1))
    expect(reread).toHaveBeenCalledTimes(1)
    expect(actionRequests()).toHaveLength(1)
  })

  it('busy then available: the message clears and nothing is sent again', async () => {
    const { action, gone } = await setup('quarantine-mailbox-user', 2)
    mockState().quarantine.items.find((entry) => entry.id === 2)!.inject = {
      busy: { then: 'available', retryAfter: 3 },
    }
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await action.run('learnAsSpam')
    await vi.advanceTimersByTimeAsync(3_000)
    await vi.waitFor(() => expect(action.lines.value).toEqual([]))
    expect(gone).not.toHaveBeenCalled()
    expect(actionRequests()).toHaveLength(1)
  })

  it('a new action cancels the pending re-check', async () => {
    const { action, reread } = await setup('quarantine-mailbox-user', 2)
    mockState().quarantine.items.find((entry) => entry.id === 2)!.inject = {
      busy: { then: 'available' },
    }
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await action.run('release')
    expect(action.waiting.value).toBe(true)
    await action.run('releaseWithoutLearning')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(reread).not.toHaveBeenCalled()
  })

  it('a refused delivery keeps the item and names the answer', async () => {
    const { action, gone, finished } = await setup('quarantine-mailbox-user', 2)
    mockState().quarantine.items.find((entry) => entry.id === 2)!.inject = {
      deliveryRefused: { smtpCode: 550, smtpResponse: '5.1.1 User unknown' },
    }
    await action.run('release')
    expect(action.lines.value).toEqual([
      { kind: 'danger', text: 'Message could not be released: 550 5.1.1 User unknown' },
    ])
    expect(gone).not.toHaveBeenCalled()
    expect(finished).not.toHaveBeenCalled()
  })

  it('412: changed elsewhere, the item stays', async () => {
    const { action } = await setup('quarantine-mailbox-user', 2)
    mockState().quarantine.items.find((entry) => entry.id === 2)!.inject = { outdated: true }
    await action.run('delete')
    expect(action.lines.value[0]!.text).toBe(
      'This item was changed elsewhere. It has been reloaded; please try again.',
    )
  })

  it('503: names the service and retries only when asked', async () => {
    const { action, finished } = await setup('quarantine-mailbox-user', 2)
    const stored = mockState().quarantine.items.find((entry) => entry.id === 2)!
    stored.inject = { temporaryFailure: { dependency: 'mailServer', step: 'delivery' } }
    await action.run('release')
    expect(action.lines.value[0]!.text).toContain('the mail server is temporarily unavailable')
    expect(action.retryKind.value).toBe('release')
    expect(actionRequests()).toHaveLength(1)
    delete stored.inject
    await action.retry()
    expect(actionRequests()).toHaveLength(2)
    expect(finished).toHaveBeenCalledTimes(1)
  })

  it('no response: outcome unknown, one re-read, never resent; gone → back to the list', async () => {
    const { action, gone, reread } = await setup('quarantine-mailbox-user', 2)
    server.use(
      http.post('*/api/v2/quarantine/:itemId/release', () => HttpResponse.error(), { once: true }),
    )
    const before = reads().length
    // The release happened on the server although the answer was lost.
    mockState().quarantine.items = mockState().quarantine.items.filter((entry) => entry.id !== 2)
    await action.run('release')
    await flushPromises()
    expect(action.lines.value[0]!.text).toBe(
      'It is unknown whether the action was completed. Check the result before you try again.',
    )
    expect(reread).toHaveBeenCalledTimes(1)
    expect(reads().length - before).toBe(1)
    expect(gone).toHaveBeenCalledTimes(1)
    expect(actionRequests()).toEqual([])
  })

  it('no response while the item still exists: stays with the message', async () => {
    const { action, gone } = await setup('quarantine-mailbox-user', 2)
    server.use(
      http.delete('*/api/v2/quarantine/:itemId', () => HttpResponse.error(), { once: true }),
    )
    await action.run('delete')
    expect(gone).not.toHaveBeenCalled()
    expect(action.lines.value[0]!.kind).toBe('warning')
    action.dismiss()
    expect(action.lines.value).toEqual([])
  })
})
