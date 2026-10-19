// The extension members of the self-service problems (UI 005 T019, research R6): typed accessors
// over the problem body, and the reaction to a withdrawn permission flag.
import { describe, expect, it, vi } from 'vitest'

import { createQueryClient, problemFromResponse, queryKeys, setSessionReactions } from '@/api'

const response = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify({ title: 't', status, requestId: '0'.repeat(32), ...body }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })

describe('ApiProblem extension members (UI 005)', () => {
  it('exposes requiredFlags and requiredFlagsMatch', async () => {
    const problem = await problemFromResponse(
      response(
        {
          type: '/api/v2/problems/permission-flag-required',
          requiredFlags: ['appPasswds'],
          requiredFlagsMatch: 'any',
        },
        403,
      ),
    )
    expect(problem.requiredFlags).toEqual(['appPasswds'])
    expect(problem.requiredFlagsMatch).toBe('any')
  })

  it('exposes dependency, attemptsRemaining and methods', async () => {
    const failure = await problemFromResponse(
      response({ type: '/api/v2/problems/temporary-failure', dependency: 'pushover' }, 503),
    )
    expect(failure.dependency).toBe('pushover')
    const enrolment = await problemFromResponse(
      response(
        { type: '/api/v2/problems/second-factor-enrolment-failed', attemptsRemaining: 3 },
        400,
      ),
    )
    expect(enrolment.attemptsRemaining).toBe(3)
    const methods = [{ id: 1, type: 'totp', name: 'Phone', tier: 'primary' }]
    const reset = await problemFromResponse(
      response({ type: '/api/v2/problems/second-factor-required', methods }, 401),
    )
    expect(reset.methods).toEqual(methods)
  })

  it('answers empty values for problems without them', async () => {
    const plain = await problemFromResponse(response({ type: 'about:blank' }, 404))
    expect(plain.requiredFlags).toEqual([])
    expect(plain.requiredFlagsMatch).toBe('all')
    expect(plain.dependency).toBeNull()
    expect(plain.attemptsRemaining).toBeNull()
    expect(plain.methods).toEqual([])
  })
})

describe('permission-flag-required reaction (research R6)', () => {
  it('goes to the forbidden reaction from a failed mutation', async () => {
    const forbidden = vi.fn()
    setSessionReactions({
      unauthenticated: vi.fn(),
      secondFactorRequired: vi.fn(),
      pendingActionRequired: vi.fn(),
      forbidden,
    })
    const client = createQueryClient({ retryDelay: 0 })
    const problem = await problemFromResponse(
      response(
        { type: '/api/v2/problems/permission-flag-required', requiredFlags: ['pushover'] },
        403,
      ),
    )
    await client
      .getMutationCache()
      .build(client, { mutationFn: () => Promise.reject(problem) })
      .execute(undefined)
      .catch(() => undefined)
    expect(forbidden).toHaveBeenCalledWith(problem)
    setSessionReactions(null)
    expect(queryKeys.capabilities.selfService()).toEqual(['capabilities', 'self-service'])
  })
})
