// The secrets helper (conventions "Shared building blocks": useSecretRequest): a direct client
// call with loading, error and result state, never through a query cache.
import { describe, expect, it, vi } from 'vitest'

import { ApiProblem, setSessionReactions } from '@/api'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'

import { withSetup } from '../../support/composable'

describe('useSecretRequest', () => {
  it('runs the request and keeps its result in component state', async () => {
    const { result } = withSetup(() =>
      useSecretRequest((value: string) => Promise.resolve({ secret: value })),
    )
    expect(result.pending.value).toBe(false)
    const running = result.run('s3cret')
    expect(result.pending.value).toBe(true)
    expect(await running).toEqual({ secret: 's3cret' })
    expect(result.result.value).toEqual({ secret: 's3cret' })
    expect(result.pending.value).toBe(false)
    result.clear()
    expect(result.result.value).toBeNull()
  })

  it('ignores a second run while one is pending', async () => {
    let resolve!: (value: number) => void
    const request = vi.fn(() => new Promise<number>((r) => (resolve = r)))
    const { result } = withSetup(() => useSecretRequest(request))
    const first = result.run()
    expect(await result.run()).toBeNull()
    resolve(1)
    expect(await first).toBe(1)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('exposes a failure as an ApiProblem and reports session problems', async () => {
    const unauthenticated = vi.fn()
    setSessionReactions({
      unauthenticated,
      secondFactorRequired: vi.fn(),
      pendingActionRequired: vi.fn(),
      forbidden: vi.fn(),
    })
    const problem = ApiProblem.fromParts({
      kind: 'problem',
      status: 401,
      type: '/api/v2/problems/unauthenticated',
    })
    const { result } = withSetup(() => useSecretRequest(() => Promise.reject(problem)))
    expect(await result.run()).toBeNull()
    expect(result.problem.value).toBe(problem)
    expect(unauthenticated).toHaveBeenCalledWith(problem)
    setSessionReactions(null)

    const network = withSetup(() => useSecretRequest(() => Promise.reject(new TypeError('x'))))
    await network.result.run()
    expect(network.result.problem.value?.kind).toBe('network')
  })

  it('forgets the result when the component goes away', async () => {
    const { result, unmount } = withSetup(() => useSecretRequest(() => Promise.resolve('secret')))
    await result.run()
    unmount()
    expect(result.result.value).toBeNull()
  })
})
