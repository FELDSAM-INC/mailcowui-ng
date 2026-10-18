// Runs a mutation through the client's mutation cache, so that its default options and the session
// reactions (an ended session, a pending action, "forbidden") apply (UI 002 research D6, promoted
// at its second use by UI 003).
import type { MutationOptions, QueryClient } from '@tanstack/vue-query'

import type { ApiProblem } from '../problem'

export function runMutation<TData, TVariables>(
  client: QueryClient,
  options: MutationOptions<TData, ApiProblem, TVariables>,
  variables: TVariables,
): Promise<TData> {
  return client.getMutationCache().build(client, options).execute(variables)
}
