import { flushPromises } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'

import { api, ensureCsrfToken } from '@/api'

it.each([
  { method: 'GET', alreadyAborted: false },
  { method: 'POST', alreadyAborted: false },
  { method: 'GET', alreadyAborted: true },
  { method: 'POST', alreadyAborted: true },
] as const)(
  'preserves cancellation through $method middleware (already aborted: $alreadyAborted)',
  async ({ method, alreadyAborted }) => {
    await ensureCsrfToken()
    const NativeRequest = globalThis.Request
    // Model a browser losing the signal link on a middleware-created Request. The original
    // request created by openapi-fetch still follows the caller's controller.
    vi.stubGlobal(
      'Request',
      class extends NativeRequest {
        constructor(input: RequestInfo | URL, init?: RequestInit) {
          super(input, { ...init, signal: new AbortController().signal })
        }
      },
    )
    const controller = new AbortController()
    const reason = new DOMException('Cancelled by caller', 'AbortError')
    if (alreadyAborted) controller.abort(reason)
    let started!: () => void
    const requestStarted = new Promise<void>((resolve) => {
      started = resolve
    })
    let finish!: (error: unknown) => void
    let transportAborted = false
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (input: Request, init?: RequestInit) =>
          new Promise<Response>((_, reject) => {
            finish = reject
            const signal = init?.signal ?? input.signal
            const abort = () => {
              transportAborted = true
              reject(reason)
            }
            if (signal.aborted) abort()
            else signal.addEventListener('abort', abort, { once: true })
            started()
          }),
      ),
    )
    const pending = (
      method === 'GET'
        ? api.GET('/session', { signal: controller.signal })
        : api.POST('/session', {
            signal: controller.signal,
            body: { username: 'test', password: 'test' },
          })
    ).catch((error: unknown) => error)
    try {
      await requestStarted
      if (!alreadyAborted) controller.abort(reason)
      await flushPromises()
      expect(transportAborted).toBe(true)
      await expect(pending).resolves.toMatchObject({ kind: 'network' })
    } finally {
      finish(reason)
      await pending
    }
  },
)
