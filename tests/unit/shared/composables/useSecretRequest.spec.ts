// The secrets helper (conventions "Shared building blocks": useSecretRequest): a direct client
// call with loading, error and result state, never through a query cache.
import { describe, expect, it, vi } from 'vitest'

import { ApiProblem, setSessionReactions } from '@/api'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
import { invalidateSessionScope } from '@/api/session-scope'

import { withSetup } from '../../support/composable'

describe('useSecretRequest', () => {
  it.each(['success', 'failure'])(
    'discards a late secret %s after the session changes',
    async (outcome) => {
      let finish!: () => void
      const unauthenticated = vi.fn()
      setSessionReactions({
        unauthenticated,
        forbidden: vi.fn(),
        secondFactorRequired: vi.fn(),
        pendingActionRequired: vi.fn(),
      })
      const { result, unmount } = withSetup(() =>
        useSecretRequest(
          () =>
            new Promise<string>((resolve, reject) => {
              finish = () =>
                outcome === 'success'
                  ? resolve('old-account-secret')
                  : reject(
                      ApiProblem.fromParts({
                        kind: 'problem',
                        status: 401,
                        type: '/api/v2/problems/unauthenticated',
                      }),
                    )
            }),
        ),
      )
      const running = result.run()
      invalidateSessionScope()
      finish()
      expect(await running).toBeNull()
      expect(result.result.value).toBeNull()
      expect(result.problem.value).toBeNull()
      expect(unauthenticated).not.toHaveBeenCalled()
      unmount()
      setSessionReactions(null)
    },
  )
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

describe('useSecretRequest (UI 005, research R6, R13)', () => {
  it('skips the session reactions when asked (the password reset completion)', async () => {
    const secondFactorRequired = vi.fn()
    setSessionReactions({
      unauthenticated: vi.fn(),
      secondFactorRequired,
      pendingActionRequired: vi.fn(),
      forbidden: vi.fn(),
    })
    const problem = ApiProblem.fromParts({
      kind: 'problem',
      status: 401,
      type: '/api/v2/problems/second-factor-required',
    })
    const quiet = withSetup(() =>
      useSecretRequest(() => Promise.reject(problem), { sessionReactions: false }),
    )
    await quiet.result.run()
    expect(quiet.result.problem.value).toBe(problem)
    expect(secondFactorRequired).not.toHaveBeenCalled()
    const loud = withSetup(() => useSecretRequest(() => Promise.reject(problem)))
    await loud.result.run()
    expect(secondFactorRequired).toHaveBeenCalledWith(problem)
    setSessionReactions(null)
  })

  it('keeps passwords and secrets out of every query and mutation cache', async () => {
    const { queryClient } = await import('@/api')
    const { result } = withSetup(() =>
      useSecretRequest((password: string) =>
        Promise.resolve({ generatedPassword: `gen-${password}` }),
      ),
    )
    await result.run('Marker-Password-9')
    const cached = JSON.stringify([
      queryClient
        .getQueryCache()
        .getAll()
        .map((query) => query.state),
      queryClient
        .getMutationCache()
        .getAll()
        .map((mutation) => mutation.state),
    ])
    expect(cached).not.toContain('Marker-Password-9')
    expect(result.result.value?.generatedPassword).toBe('gen-Marker-Password-9')
  })
})
