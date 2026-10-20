import { afterEach, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { ApiProblem, createQueryClient, setSessionReactions } from '@/api'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
afterEach(() => setSessionReactions(null))
it.each(['query', 'mutation', 'secret'] as const)(
  'dispatches an ended impersonation from %s without retrying',
  async (kind) => {
    const ended = vi.fn()
    setSessionReactions({
      unauthenticated: vi.fn(),
      secondFactorRequired: vi.fn(),
      pendingActionRequired: vi.fn(),
      forbidden: vi.fn(),
      impersonationEnded: ended,
    })
    const client = createQueryClient({ retryDelay: 0 })
    const failure = ApiProblem.fromParts({
      kind: 'problem',
      status: 403,
      type: '/api/v2/problems/impersonation-ended',
    })
    const request = vi.fn(() => Promise.reject(failure))
    const scope = effectScope()
    if (kind === 'query')
      await client.fetchQuery({ queryKey: ['ended'], queryFn: request }).catch(() => {})
    else if (kind === 'mutation')
      await client
        .getMutationCache()
        .build(client, { mutationFn: request })
        .execute(undefined)
        .catch(() => {})
    else await scope.run(() => useSecretRequest(request))!.run()
    expect(request).toHaveBeenCalledOnce()
    expect(ended).toHaveBeenCalledOnce()
    scope.stop()
  },
)
