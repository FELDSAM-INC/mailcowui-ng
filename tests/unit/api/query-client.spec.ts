// The QueryClient policy (research R8, R9): defaults that never refetch by themselves (FR-033),
// the retry policy, and the session-level reactions to problems.
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ApiProblem,
  createQueryClient,
  reportSessionProblem,
  setSessionReactions,
  shouldRetryQuery,
} from '@/api'

function problem(status: number, name: string | null, extra: Partial<ApiProblem> = {}) {
  return ApiProblem.fromParts({
    kind: 'problem',
    status,
    type: name ? `/api/v2/problems/${name}` : 'about:blank',
    requestId: 'a'.repeat(32),
    ...extra,
  })
}

const network = () => ApiProblem.fromParts({ kind: 'network' })
const unavailable = (status = 502) => ApiProblem.fromParts({ kind: 'unavailable', status })

afterEach(() => {
  setSessionReactions(null)
})

describe('QueryClient defaults', () => {
  it('uses a 30 s stale time and never refetches on focus, reconnect or an interval', () => {
    const client = createQueryClient()
    const queries = client.getDefaultOptions().queries ?? {}
    expect(queries.staleTime).toBe(30_000)
    expect(queries.gcTime).toBe(300_000)
    expect(queries.refetchOnWindowFocus).toBe(false)
    expect(queries.refetchOnReconnect).toBe(false)
    expect(queries.refetchInterval).toBeUndefined()
  })

  it('never retries mutations', () => {
    const client = createQueryClient()
    expect(client.getDefaultOptions().mutations?.retry).toBe(false)
  })
})

describe('retry policy', () => {
  it('retries once after a network error or a non-problem 5xx', () => {
    expect(shouldRetryQuery(0, network())).toBe(true)
    expect(shouldRetryQuery(0, unavailable())).toBe(true)
    expect(shouldRetryQuery(1, network())).toBe(false)
    expect(shouldRetryQuery(1, unavailable())).toBe(false)
  })

  it('never retries after a 4xx or a documented problem', () => {
    expect(shouldRetryQuery(0, problem(404, null))).toBe(false)
    expect(shouldRetryQuery(0, problem(401, 'unauthenticated'))).toBe(false)
    expect(shouldRetryQuery(0, problem(422, 'validation-failed'))).toBe(false)
    expect(shouldRetryQuery(0, problem(500, null))).toBe(false)
    expect(shouldRetryQuery(0, new Error('bug'))).toBe(false)
  })

  it('applies the policy to failing queries', async () => {
    const client = createQueryClient({ retryDelay: 0 })
    const fn = vi.fn().mockRejectedValue(network())
    await client
      .fetchQuery({
        queryKey: ['retry-test'],
        queryFn: fn,
        retry: client.getDefaultOptions().queries?.retry,
      })
      .catch(() => undefined)
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

describe('session reactions', () => {
  const reactions = () => ({
    unauthenticated: vi.fn(),
    secondFactorRequired: vi.fn(),
    pendingActionRequired: vi.fn(),
    forbidden: vi.fn(),
  })

  it.each([
    ['unauthenticated', 401, 'unauthenticated'],
    ['second-factor-required', 401, 'secondFactorRequired'],
    ['pending-action-required', 403, 'pendingActionRequired'],
    ['forbidden', 403, 'forbidden'],
  ] as const)('dispatches %s from a failed query', async (name, status, handler) => {
    const handlers = reactions()
    setSessionReactions(handlers)
    const client = createQueryClient()
    const error = problem(status, name)
    await client
      .fetchQuery({ queryKey: [name], queryFn: () => Promise.reject(error) })
      .catch(() => undefined)
    expect(handlers[handler]).toHaveBeenCalledWith(error)
  })

  // UI 008 T005 (research R2): a missing permission flag refreshes the identity, as `forbidden`
  // does, so the navigation and the screen follow the flag.
  it('dispatches permission-flag-required from a query and a mutation as forbidden', async () => {
    const handlers = reactions()
    setSessionReactions(handlers)
    const client = createQueryClient()
    const error = problem(403, 'permission-flag-required')
    await client
      .fetchQuery({ queryKey: ['flag'], queryFn: () => Promise.reject(error) })
      .catch(() => undefined)
    await client
      .getMutationCache()
      .build(client, { mutationFn: () => Promise.reject(error) })
      .execute(undefined)
      .catch(() => undefined)
    expect(handlers.forbidden).toHaveBeenCalledTimes(2)
    expect(handlers.forbidden).toHaveBeenCalledWith(error)
  })

  it('dispatches from a failed mutation', async () => {
    const handlers = reactions()
    setSessionReactions(handlers)
    const client = createQueryClient()
    const error = problem(401, 'unauthenticated')
    await client
      .getMutationCache()
      .build(client, { mutationFn: () => Promise.reject(error) })
      .execute(undefined)
      .catch(() => undefined)
    expect(handlers.unauthenticated).toHaveBeenCalledWith(error)
  })

  it('UI 012: dispatches identity-provider-session-ended, as unauthenticated without its reaction', () => {
    const ended = problem(401, 'identity-provider-session-ended')
    const withReaction = { ...reactions(), identityProviderSessionEnded: vi.fn() }
    setSessionReactions(withReaction)
    reportSessionProblem(ended)
    expect(withReaction.identityProviderSessionEnded).toHaveBeenCalledWith(ended)
    expect(withReaction.unauthenticated).not.toHaveBeenCalled()
    const without = reactions()
    setSessionReactions(without)
    reportSessionProblem(ended)
    expect(without.unauthenticated).toHaveBeenCalledWith(ended)
  })

  it('leaves every other problem to the screen', async () => {
    const handlers = reactions()
    setSessionReactions(handlers)
    const client = createQueryClient()
    await client
      .fetchQuery({
        queryKey: ['other'],
        queryFn: () => Promise.reject(problem(422, 'validation-failed')),
      })
      .catch(() => undefined)
    expect(Object.values(handlers).every((fn) => fn.mock.calls.length === 0)).toBe(true)
  })
})
