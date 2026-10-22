// Runs a mutation through the client's mutation cache, so that its default options and the session
// reactions (an ended session, a pending action, "forbidden") apply (UI 002 research D6, promoted
// at its second use by UI 003).
import type { MutationOptions, QueryClient } from '@tanstack/vue-query'

import type { ApiProblem } from '../problem'
import { captureSessionScope } from '../session-scope'

export function runMutation<TData, TVariables, TContext = unknown>(
  client: QueryClient,
  options: MutationOptions<TData, ApiProblem, TVariables, TContext>,
  variables: TVariables,
): Promise<TData> {
  const scope = captureSessionScope()
  const defaults = client.defaultMutationOptions(options)
  // Wrap the merged defaults as well: optimistic updates and rollbacks must belong to the
  // session that initiated them, including when a mutation resumes after being paused.
  const guarded = {
    ...defaults,
    mutationFn: defaults.mutationFn
      ? (...args: Parameters<NonNullable<typeof defaults.mutationFn>>) =>
          scope.run(() => defaults.mutationFn!(...args))
      : undefined,
    onMutate: defaults.onMutate
      ? (...args: Parameters<NonNullable<typeof defaults.onMutate>>) =>
          scope.run(() => defaults.onMutate!(...args))
      : undefined,
    onSuccess: (...args: Parameters<NonNullable<typeof defaults.onSuccess>>) =>
      scope.run(() => defaults.onSuccess?.(...args)),
    onError: (...args: Parameters<NonNullable<typeof defaults.onError>>) => {
      if (scope.isCurrent()) return defaults.onError?.(...args)
    },
    onSettled: (...args: Parameters<NonNullable<typeof defaults.onSettled>>) => {
      if (scope.isCurrent()) return defaults.onSettled?.(...args)
    },
  }
  // Check again after async lifecycle callbacks so callers cannot redirect/show a success for
  // the previous account even if the server answered before the transition started.
  return scope.run(() => client.getMutationCache().build(client, guarded).execute(variables))
}
