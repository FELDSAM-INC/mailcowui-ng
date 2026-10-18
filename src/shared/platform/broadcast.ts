// Cross-tab messages over BroadcastChannel (research R12, data-model §4). Messages are versioned;
// an unknown version or type is ignored, so a newer tab can never confuse an older one.

export type AppMessage =
  | { v: 1; type: 'activity'; at: number }
  | { v: 1; type: 'session-changed' }
  | { v: 1; type: 'signed-out' }

export interface AppChannel {
  post(message: AppMessage): void
  subscribe(listener: (message: AppMessage) => void): () => void
  close(): void
}

export function parseAppMessage(data: unknown): AppMessage | null {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return null
  const record = data as Record<string, unknown>
  if (record.v !== 1) return null
  switch (record.type) {
    case 'activity':
      return typeof record.at === 'number' && Number.isFinite(record.at)
        ? { v: 1, type: 'activity', at: record.at }
        : null
    case 'session-changed':
      return { v: 1, type: 'session-changed' }
    case 'signed-out':
      return { v: 1, type: 'signed-out' }
    default:
      return null
  }
}

const noopChannel: AppChannel = {
  post() {},
  subscribe: () => () => {},
  close() {},
}

export function createAppChannel(name = 'mailcowui-ng'): AppChannel {
  let channel: BroadcastChannel
  try {
    if (typeof BroadcastChannel !== 'function') return noopChannel
    channel = new BroadcastChannel(name)
  } catch {
    return noopChannel
  }

  const listeners = new Set<(message: AppMessage) => void>()
  const onMessage = (event: MessageEvent) => {
    const message = parseAppMessage(event.data)
    if (!message) return
    for (const listener of [...listeners]) {
      try {
        listener(message)
      } catch {
        // One failing listener must not keep the message from the others.
      }
    }
  }
  channel.addEventListener('message', onMessage)

  return {
    post(message) {
      try {
        channel.postMessage(message)
      } catch {
        // A closed channel or a serialisation failure is not the caller's problem.
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    close() {
      listeners.clear()
      channel.removeEventListener('message', onMessage)
      try {
        channel.close()
      } catch {
        // Already closed.
      }
    },
  }
}
