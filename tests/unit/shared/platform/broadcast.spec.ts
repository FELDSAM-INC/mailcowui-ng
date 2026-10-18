// Cross-tab messages (data-model §4, research R12): versioned, and anything unknown is ignored.
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppChannel, parseAppMessage, type AppMessage } from '@/shared/platform/broadcast'

import { installBroadcastChannel } from '../../support/broadcast'

describe('parseAppMessage', () => {
  it('accepts the three versioned message types', () => {
    expect(parseAppMessage({ v: 1, type: 'activity', at: 1_700_000_000_000 })).toEqual({
      v: 1,
      type: 'activity',
      at: 1_700_000_000_000,
    })
    expect(parseAppMessage({ v: 1, type: 'session-changed' })).toEqual({
      v: 1,
      type: 'session-changed',
    })
    expect(parseAppMessage({ v: 1, type: 'signed-out' })).toEqual({ v: 1, type: 'signed-out' })
  })

  it('drops extra fields', () => {
    expect(parseAppMessage({ v: 1, type: 'signed-out', username: 'alice' })).toEqual({
      v: 1,
      type: 'signed-out',
    })
  })

  it.each([
    ['an unknown version', { v: 2, type: 'signed-out' }],
    ['a missing version', { type: 'signed-out' }],
    ['an unknown type', { v: 1, type: 'reload' }],
    ['activity without a time', { v: 1, type: 'activity' }],
    ['activity with a non-numeric time', { v: 1, type: 'activity', at: '123' }],
    ['activity with a non-finite time', { v: 1, type: 'activity', at: Number.NaN }],
    ['null', null],
    ['a string', 'signed-out'],
    ['an array', [1, 'signed-out']],
  ])('ignores %s', (_label, data) => {
    expect(parseAppMessage(data)).toBeNull()
  })
})

describe('createAppChannel', () => {
  let tabs: ReturnType<typeof installBroadcastChannel>

  beforeEach(() => {
    tabs = installBroadcastChannel()
  })

  it('posts messages to the other tabs', () => {
    const other = tabs.remote()
    const channel = createAppChannel()
    channel.post({ v: 1, type: 'session-changed' })
    expect(other.received).toEqual([{ v: 1, type: 'session-changed' }])
    channel.close()
  })

  it('delivers valid messages from another tab and ignores invalid ones', () => {
    const other = tabs.remote()
    const channel = createAppChannel()
    const received: AppMessage[] = []
    channel.subscribe((message) => received.push(message))

    other.channel.postMessage({ v: 1, type: 'activity', at: 42 })
    other.channel.postMessage({ v: 2, type: 'activity', at: 43 })
    other.channel.postMessage({ v: 1, type: 'unknown' })
    other.channel.postMessage({ v: 1, type: 'signed-out' })

    expect(received).toEqual([
      { v: 1, type: 'activity', at: 42 },
      { v: 1, type: 'signed-out' },
    ])
    channel.close()
  })

  it('uses the mailcowui-ng channel name by default', () => {
    const otherApp = tabs.remote('another-app')
    const channel = createAppChannel()
    channel.post({ v: 1, type: 'signed-out' })
    expect(otherApp.received).toEqual([])
    channel.close()
  })

  it('stops delivering after unsubscribe and after close', () => {
    const other = tabs.remote()
    const channel = createAppChannel()
    const listener = vi.fn()
    const unsubscribe = channel.subscribe(listener)
    unsubscribe()
    other.channel.postMessage({ v: 1, type: 'signed-out' })
    expect(listener).not.toHaveBeenCalled()

    channel.subscribe(listener)
    channel.close()
    other.channel.postMessage({ v: 1, type: 'signed-out' })
    expect(listener).not.toHaveBeenCalled()
    expect(() => channel.post({ v: 1, type: 'signed-out' })).not.toThrow()
  })

  it('isolates a throwing listener from the others', () => {
    const other = tabs.remote()
    const channel = createAppChannel()
    const second = vi.fn()
    channel.subscribe(() => {
      throw new Error('listener failed')
    })
    channel.subscribe(second)
    other.channel.postMessage({ v: 1, type: 'signed-out' })
    expect(second).toHaveBeenCalledWith({ v: 1, type: 'signed-out' })
    channel.close()
  })

  it('falls back to a no-op channel without BroadcastChannel', () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    const channel = createAppChannel()
    const listener = vi.fn()
    expect(() => channel.post({ v: 1, type: 'signed-out' })).not.toThrow()
    const unsubscribe = channel.subscribe(listener)
    expect(() => {
      unsubscribe()
      channel.close()
    }).not.toThrow()
    expect(listener).not.toHaveBeenCalled()
  })

  it('falls back to a no-op channel when the constructor throws', () => {
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        constructor() {
          throw new DOMException('denied', 'SecurityError')
        }
      },
    )
    const channel = createAppChannel()
    expect(() => channel.post({ v: 1, type: 'signed-out' })).not.toThrow()
  })

  it('never throws when posting fails', () => {
    const channel = createAppChannel()
    channel.close()
    expect(() => channel.post({ v: 1, type: 'session-changed' })).not.toThrow()
  })
})
