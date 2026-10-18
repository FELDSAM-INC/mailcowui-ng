// An in-memory BroadcastChannel fake. Channels with the same name deliver to each other but
// never to themselves, like the real API. `remote(name)` gives a channel that stands for another
// tab of the app.
import { vi } from 'vitest'

type Listener = (event: MessageEvent) => void

export class FakeBroadcastChannel {
  static channels = new Set<FakeBroadcastChannel>()
  readonly name: string
  onmessage: Listener | null = null
  private listeners = new Set<Listener>()
  closed = false

  constructor(name: string) {
    this.name = name
    FakeBroadcastChannel.channels.add(this)
  }

  postMessage(data: unknown) {
    if (this.closed) throw new DOMException('Channel closed', 'InvalidStateError')
    const payload: unknown = structuredClone(data)
    for (const channel of FakeBroadcastChannel.channels) {
      if (channel !== this && channel.name === this.name && !channel.closed) {
        channel.deliver(payload)
      }
    }
  }

  addEventListener(_type: 'message', listener: Listener) {
    this.listeners.add(listener)
  }

  removeEventListener(_type: 'message', listener: Listener) {
    this.listeners.delete(listener)
  }

  close() {
    this.closed = true
    FakeBroadcastChannel.channels.delete(this)
  }

  private deliver(data: unknown) {
    const event = new MessageEvent('message', { data })
    this.onmessage?.(event)
    for (const listener of [...this.listeners]) listener(event)
  }
}

export function installBroadcastChannel() {
  FakeBroadcastChannel.channels.clear()
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
  return {
    /** A channel standing for another tab. */
    remote(name = 'mailcowui-ng') {
      const channel = new FakeBroadcastChannel(name)
      const received: unknown[] = []
      channel.addEventListener('message', (event) => received.push(event.data))
      return { channel, received }
    },
  }
}
