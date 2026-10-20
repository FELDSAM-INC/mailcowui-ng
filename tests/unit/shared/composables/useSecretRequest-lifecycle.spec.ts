import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiProblem, setSessionReactions } from '@/api'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'

import { withSetup } from '../../support/composable'

afterEach(() => setSessionReactions(null))

describe('useSecretRequest scope disposal', () => {
  it('discards a secret response arriving after the component was unmounted', async () => {
    let resolve!: (value: string) => void
    const pending = new Promise<string>((done) => {
      resolve = done
    })
    const request = vi.fn(() => pending)
    const { result, unmount } = withSetup(() => useSecretRequest(request))
    const running = result.run()
    unmount()
    resolve('late-secret')
    expect(await running).toBeNull()
    expect(result.result.value).toBeNull()
    expect(result.pending.value).toBe(false)
    expect(await result.run()).toBeNull()
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('does not restore a stale failure or react to it after unmount', async () => {
    let reject!: (error: unknown) => void
    const pending = new Promise<never>((_resolve, fail) => {
      reject = fail
    })
    const unauthenticated = vi.fn()
    setSessionReactions({
      unauthenticated,
      secondFactorRequired: vi.fn(),
      pendingActionRequired: vi.fn(),
      forbidden: vi.fn(),
    })
    const { result, unmount } = withSetup(() => useSecretRequest(() => pending))
    const running = result.run()
    unmount()
    reject(
      ApiProblem.fromParts({
        kind: 'problem',
        status: 401,
        type: '/api/v2/problems/unauthenticated',
      }),
    )
    expect(await running).toBeNull()
    expect(result.problem.value).toBeNull()
    expect(unauthenticated).not.toHaveBeenCalled()
  })
})
