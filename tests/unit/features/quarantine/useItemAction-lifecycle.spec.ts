import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import { ApiProblem, type QuarantineItem } from '@/api'
import * as itemApi from '@/features/quarantine/api'
import { useItemAction, type RereadResult } from '@/features/quarantine/composables/useItemAction'
import { mountWithApp } from '../../support/mount'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const item = (
  id: number,
): Pick<QuarantineItem, 'id' | 'etag' | 'subject' | 'sender' | 'virus'> => ({
  id,
  etag: `"q-${id}-1"`,
  subject: `Message ${id}`,
  sender: 'sender@example.org',
  virus: false,
})
const problem = (status: number, type?: string) =>
  ApiProblem.fromParts({
    kind: 'problem',
    status,
    type: type ? `/api/v2/problems/${type}` : undefined,
  })
const dispose: (() => void)[] = []
afterEach(() => {
  for (const unmount of dispose.splice(0)) unmount()
  vi.useRealTimers()
})

function setup() {
  const current = ref<ReturnType<typeof item> | undefined>(item(1))
  const scopeId = ref(1)
  const ask = vi.fn<() => Promise<boolean>>().mockResolvedValue(true)
  const reread = vi.fn<() => Promise<RereadResult>>().mockResolvedValue('present')
  const finished = vi.fn()
  const gone = vi.fn()
  const send = vi.spyOn(itemApi, 'runItemAction').mockResolvedValue(null)
  let action!: ReturnType<typeof useItemAction>
  const wrapper = mountWithApp(
    defineComponent({
      setup() {
        action = useItemAction({
          item: () => current.value,
          itemId: () => scopeId.value,
          ask,
          reread,
          onFinished: finished,
          onGone: gone,
        })
        return () => h('div')
      },
    }),
  )
  dispose.push(() => wrapper.unmount())
  function change(id: number) {
    scopeId.value = id
    current.value = item(id)
  }
  return { action, current, scopeId, ask, reread, finished, gone, send, wrapper, change }
}

describe('quarantine item action lifetime', () => {
  it('does not submit a confirmation completed after unmount', async () => {
    const s = setup()
    const confirmation = deferred<boolean>()
    s.ask.mockReturnValue(confirmation.promise)
    const running = s.action.run('delete')
    s.wrapper.unmount()
    confirmation.resolve(true)
    await running
    expect(s.send).not.toHaveBeenCalled()
    expect(s.finished).not.toHaveBeenCalled()
  })

  it('does not submit a confirmation for an item left in the same mounted page', async () => {
    const s = setup()
    const confirmation = deferred<boolean>()
    s.ask.mockReturnValue(confirmation.promise)
    const running = s.action.run('delete')
    s.change(2)
    await nextTick()
    confirmation.resolve(true)
    await running
    expect(s.send).not.toHaveBeenCalled()
    expect(s.action.busy.value).toBe(false)
  })

  it('ignores an old response without unlocking or completing the new item action', async () => {
    const s = setup()
    const first = deferred<null>()
    const second = deferred<null>()
    s.send.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const oldRun = s.action.run('delete')
    await flushPromises()
    s.change(2)
    await nextTick()
    const newRun = s.action.run('delete')
    await flushPromises()
    expect(s.send).toHaveBeenCalledTimes(2)
    first.resolve(null)
    await oldRun
    expect(s.finished).not.toHaveBeenCalled()
    expect(s.action.sending.value).toBe(true)
    second.resolve(null)
    await newRun
    expect(s.finished).toHaveBeenCalledWith([
      { kind: 'success', text: 'Item 2 successfully deleted' },
    ])
  })

  it('ignores a late not-found response after unmount', async () => {
    const s = setup()
    const response = deferred<null>()
    s.send.mockReturnValue(response.promise)
    const running = s.action.run('delete')
    await flushPromises()
    s.wrapper.unmount()
    response.reject(problem(404))
    await running
    expect(s.gone).not.toHaveBeenCalled()
    expect(s.action.lines.value).toEqual([])
  })

  it('does not schedule a busy recheck from an answer received after unmount', async () => {
    const s = setup()
    const response = deferred<null>()
    s.send.mockReturnValue(response.promise)
    const running = s.action.run('release')
    await flushPromises()
    s.wrapper.unmount()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    response.reject(problem(409, 'quarantine-item-busy'))
    await running
    await vi.advanceTimersByTimeAsync(5000)
    expect(s.reread).not.toHaveBeenCalled()
  })

  it('cancels a waiting busy recheck when the route switches item', async () => {
    const s = setup()
    s.send.mockRejectedValue(problem(409, 'quarantine-item-busy'))
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await s.action.run('release')
    expect(s.action.waiting.value).toBe(true)
    s.change(2)
    await nextTick()
    expect(s.action.waiting.value).toBe(false)
    expect(s.action.lines.value).toEqual([])
    await vi.advanceTimersByTimeAsync(5000)
    expect(s.reread).not.toHaveBeenCalled()
  })

  it('ignores a busy read already in flight when the item changes', async () => {
    const s = setup()
    const read = deferred<RereadResult>()
    s.reread.mockReturnValue(read.promise)
    s.send.mockRejectedValue(problem(409, 'quarantine-item-busy'))
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await s.action.run('release')
    await vi.advanceTimersByTimeAsync(5000)
    expect(s.reread).toHaveBeenCalledOnce()
    s.change(2)
    await nextTick()
    read.resolve('gone')
    await flushPromises()
    expect(s.gone).not.toHaveBeenCalled()
  })

  it('does not clear a newer failure when an earlier busy read finishes', async () => {
    const s = setup()
    const read = deferred<RereadResult>()
    s.reread.mockReturnValue(read.promise)
    s.send
      .mockRejectedValueOnce(problem(409, 'quarantine-item-busy'))
      .mockRejectedValueOnce(problem(503, 'temporary-failure'))
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await s.action.run('release')
    await vi.advanceTimersByTimeAsync(5000)
    await s.action.run('releaseWithoutLearning')
    const latest = s.action.lines.value
    expect(latest).not.toEqual([])
    read.resolve('present')
    await flushPromises()
    expect(s.action.lines.value).toEqual(latest)
    expect(s.action.retryKind.value).toBe('releaseWithoutLearning')
  })

  it('ignores a late unknown-outcome read after leaving the page', async () => {
    const s = setup()
    const read = deferred<RereadResult>()
    s.reread.mockReturnValue(read.promise)
    s.send.mockRejectedValue(ApiProblem.fromParts({ kind: 'network' }))
    const running = s.action.run('delete')
    await flushPromises()
    expect(s.reread).toHaveBeenCalledOnce()
    s.wrapper.unmount()
    read.resolve('gone')
    await running
    expect(s.gone).not.toHaveBeenCalled()
  })

  it('still finishes the current route when the mutation removes its cached item', async () => {
    const s = setup()
    const response = deferred<null>()
    s.send.mockReturnValue(response.promise)
    const running = s.action.run('delete')
    await flushPromises()
    s.current.value = undefined
    await nextTick()
    response.resolve(null)
    await running
    expect(s.finished).toHaveBeenCalledOnce()
  })
})
