// A log's entries (research R11, data-model §3 `['logs', slug, params]`; plan decision 11). The
// newest 50 entries come first. Legacy's quick actions "+ 100" and "+ 1000" add the next entries:
// newest first, with `before` = the oldest entry shown and `offset` 0, exactly as `LogBefore`
// documents, so entries that arrive meanwhile never duplicate one; oldest first, by `offset` (new
// entries arrive after everything shown). Entries whose id is already shown are dropped as a guard.
// The total is the first page's (with `before`, `meta.total` counts only the older entries). Logs
// never refresh on their own (`staleTime` Infinity); Refresh starts again from the first page.
import { useInfiniteQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'

import { api, problemOf, queryKeys, requireData, type ListMeta } from '@/api'

import type { LogEntry, LogTypeDescriptor } from './log-types'

export const FIRST_PAGE = 50

export interface LogQuery {
  q?: string
  order: 'asc' | 'desc'
}

export interface LogPage {
  data: LogEntry[]
  meta: ListMeta
}

export interface LogPageParam {
  first: boolean
  before?: string
  offset: number
}

type LogGet = (
  path: string,
  init: { params: { query: Record<string, unknown> } },
) => Promise<{ data?: LogPage; response: Response }>

export async function fetchLogPage(
  type: LogTypeDescriptor,
  query: LogQuery,
  param: LogPageParam,
  limit: number,
): Promise<LogPage> {
  const params: Record<string, unknown> = { limit, order: query.order, offset: param.offset }
  if (query.q) params.q = query.q
  if (param.before) params.before = param.before
  // The 12 operations share their query parameters and their list shape (`{ data, meta }`).
  const get = api.GET as unknown as LogGet
  return requireData(await get(type.path, { params: { query: params } }))
}

/** The entries of the pages, each id once (the first occurrence). */
export function uniqueEntries(pages: readonly LogPage[]): LogEntry[] {
  const seen = new Set<string>()
  const entries: LogEntry[] = []
  for (const page of pages) {
    for (const entry of page.data) {
      if (seen.has(entry.id)) continue
      seen.add(entry.id)
      entries.push(entry)
    }
  }
  return entries
}

/** Where the next page starts: after the oldest entry shown, or after the entries received. */
export function nextPageParam(order: LogQuery['order'], pages: readonly LogPage[]): LogPageParam {
  if (order === 'desc') {
    const oldest = uniqueEntries(pages).at(-1)
    return oldest ? { first: false, before: oldest.id, offset: 0 } : { first: false, offset: 0 }
  }
  const received = pages.reduce((sum, page) => sum + page.data.length, 0)
  return { first: false, offset: received }
}

export function useLogEntries(
  type: MaybeRefOrGetter<LogTypeDescriptor | undefined>,
  query: MaybeRefOrGetter<LogQuery>,
) {
  const queryClient = useQueryClient()
  // The size of the next "+ 100" or "+ 1000"; read when the next page is fetched.
  const nextSize = ref(100)
  const key = computed(() => {
    const current = toValue(query)
    return queryKeys.logs.list(toValue(type)?.slug ?? '', {
      q: current.q ?? '',
      order: current.order,
    })
  })

  const result = useInfiniteQuery(
    computed(() => {
      const descriptor = toValue(type)
      const current = { ...toValue(query) }
      return {
        queryKey: key.value,
        queryFn: ({ pageParam }: { pageParam: LogPageParam }) =>
          fetchLogPage(
            descriptor!,
            current,
            pageParam,
            pageParam.first ? FIRST_PAGE : nextSize.value,
          ),
        initialPageParam: { first: true, offset: 0 },
        getNextPageParam: (_last: LogPage, pages: LogPage[]) => nextPageParam(current.order, pages),
        staleTime: Infinity,
        retry: false,
        enabled: descriptor !== undefined,
      }
    }),
  )

  const pages = computed(() => result.data.value?.pages ?? [])
  const entries = computed(() => uniqueEntries(pages.value))

  return {
    entries,
    /** All matching entries, from the first page. */
    total: computed(() => pages.value[0]?.meta.total ?? 0),
    loading: computed(() => result.isPending.value && result.fetchStatus.value !== 'idle'),
    fetching: computed(() => result.isFetching.value),
    loadingMore: computed(() => result.isFetchingNextPage.value),
    problem: computed(() => problemOf(result.error.value)),
    /** When the shown entries were loaded (epoch milliseconds). */
    loadedAt: computed(() => result.dataUpdatedAt.value),
    /** Adds up to `size` further entries; the number added, or null when loading failed. */
    async loadMore(size: number): Promise<number | null> {
      nextSize.value = size
      const before = entries.value.length
      const outcome = await result.fetchNextPage()
      if (outcome.isError) return null
      return entries.value.length - before
    },
    /** Loads the newest (or oldest) entries again, dropping the older pages. */
    refresh() {
      return queryClient.resetQueries({ queryKey: key.value, exact: true })
    },
    retry: () => result.refetch(),
  }
}
