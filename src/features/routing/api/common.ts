// Shared pieces of the routing data layer (research R22, data-model §3): list pages, the audit log
// refresh after a change, and dropping an entry that answered 404.
import type { QueryClient, QueryKey } from '@tanstack/vue-query'

import { isApiProblem, queryKeys, type ListMeta } from '@/api'

export interface Page<T> {
  data: T[]
  meta: ListMeta
}

export const LIST_STALE_TIME = 30_000

/**
 * A request body whose members with a `default` may be left out: the generated types mark them as
 * required (`defaultNonNullable`), but the API applies the default.
 */
export type WithDefaults<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/** Invalidates the given roots and the audit log, which records every routing change. */
export function invalidate(client: QueryClient, ...keys: QueryKey[]): Promise<unknown> {
  return Promise.all([
    ...keys.map((queryKey) => client.invalidateQueries({ queryKey })),
    client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() }),
  ])
}

/** After a 404 the entry's detail is dropped and the lists are refreshed. */
export function forgetOnNotFound(
  client: QueryClient,
  error: unknown,
  detail: QueryKey,
  lists: QueryKey,
): void {
  if (isApiProblem(error) && error.status === 404) {
    client.removeQueries({ queryKey: detail })
    void client.invalidateQueries({ queryKey: lists })
  }
}

/** The entry with this ID from the cached list pages, as the detail page's initial data. */
export function cachedEntry<T extends { id: number }>(
  client: QueryClient,
  lists: QueryKey,
  id: number,
): { entry: T; updatedAt: number } | undefined {
  for (const [key, page] of client.getQueriesData<Page<T>>({ queryKey: lists })) {
    const entry = page?.data.find((item) => item.id === id)
    if (entry) return { entry, updatedAt: client.getQueryState(key)?.dataUpdatedAt ?? 0 }
  }
  return undefined
}
