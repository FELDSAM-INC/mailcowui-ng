import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiProblem, createQueryClient, runMutation, setSessionReactions } from '@/api'
import { invalidateSessionScope } from '@/api/session-scope'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

afterEach(() => setSessionReactions(null))

describe('mutation session ownership', () => {
  it('does not refill a cleared cache or continue the caller after a late success', async () => {
    const client = createQueryClient()
    const response = deferred<string>()
    const started = vi.fn(() => response.promise)
    const onSuccess = vi.fn((value: string) => client.setQueryData(['private'], value))
    const onSettled = vi.fn()
    const redirect = vi.fn()
    const running = runMutation(client, { mutationFn: started, onSuccess, onSettled }, undefined)
      .then(redirect)
      .catch((error: unknown) => error)
    await vi.waitFor(() => expect(started).toHaveBeenCalledOnce())

    invalidateSessionScope()
    client.clear()
    response.resolve('previous account secret')

    expect(await running).toMatchObject({ kind: 'identityChanged' })
    expect(client.getQueryData(['private'])).toBeUndefined()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onSettled).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
    expect(
      await runMutation(client, { mutationFn: () => Promise.resolve('new account') }, undefined),
    ).toBe('new account')
  })

  it.each(['unauthenticated', 'forbidden'])(
    'does not report a late %s or run the old rollback/settled callbacks',
    async (name) => {
      const reactions = {
        unauthenticated: vi.fn(),
        forbidden: vi.fn(),
        secondFactorRequired: vi.fn(),
        pendingActionRequired: vi.fn(),
      }
      setSessionReactions(reactions)
      const client = createQueryClient()
      const response = deferred<string>()
      const started = vi.fn(() => response.promise)
      const onError = vi.fn(() => client.setQueryData(['private'], 'rollback from old account'))
      const onSettled = vi.fn()
      const running = runMutation(
        client,
        { mutationFn: started, onError, onSettled },
        undefined,
      ).catch((error: unknown) => error)
      await vi.waitFor(() => expect(started).toHaveBeenCalledOnce())
      invalidateSessionScope()
      client.clear()
      response.reject(
        ApiProblem.fromParts({ kind: 'problem', status: 401, type: `/api/v2/problems/${name}` }),
      )
      expect(await running).toMatchObject({ kind: 'identityChanged' })
      expect(onError).not.toHaveBeenCalled()
      expect(onSettled).not.toHaveBeenCalled()
      expect(Object.values(reactions).every((reaction) => reaction.mock.calls.length === 0)).toBe(
        true,
      )
      expect(client.getQueryCache().getAll()).toHaveLength(0)
    },
  )

  it('stops caller success when the session changes while success invalidations are pending', async () => {
    const client = createQueryClient()
    const invalidation = deferred<void>()
    const onSuccess = vi.fn(() => invalidation.promise)
    const redirect = vi.fn()
    const running = runMutation(
      client,
      { mutationFn: () => Promise.resolve('saved'), onSuccess },
      undefined,
    )
      .then(redirect)
      .catch((error: unknown) => error)
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
    invalidateSessionScope()
    client.clear()
    invalidation.resolve()
    expect(await running).toMatchObject({ kind: 'identityChanged' })
    expect(redirect).not.toHaveBeenCalled()
  })

  it('preserves default optimistic updates, context, rollback and settled for the current session', async () => {
    const client = createQueryClient()
    client.setQueryData(['value'], 'original')
    const problem = ApiProblem.fromParts({ kind: 'problem', status: 422 })
    const onSettled = vi.fn()
    client.setMutationDefaults(['edit'], {
      onMutate: () => {
        const previous = client.getQueryData<string>(['value'])
        client.setQueryData(['value'], 'optimistic')
        return previous
      },
      onError: (_error, _variables, previous) => client.setQueryData(['value'], previous),
      onSettled,
    })
    await expect(
      runMutation(
        client,
        {
          mutationKey: ['edit'],
          mutationFn: () => Promise.reject(problem),
        },
        undefined,
      ),
    ).rejects.toBe(problem)
    expect(client.getQueryData(['value'])).toBe('original')
    expect(onSettled).toHaveBeenCalledOnce()
    expect(onSettled.mock.calls[0]?.[3]).toBe('original')
  })
})
