// List state in the page address (conventions "Lists", data-model §5, research R20). The address
// is parsed against a typed schema; invalid values fall back to their defaults and the address is
// normalised with `router.replace`, defaults omitted. Explicit changes use `router.push`, so Back
// restores the previous view; typing uses `router.replace`. Changing filters, sort or page size
// returns to the first page and calls `onReset` (for bulk selection). Nothing goes to storage.
import { computed, watch, type ComputedRef } from 'vue'
import { useRoute, useRouter, type LocationQuery, type LocationQueryRaw } from 'vue-router'

export const PAGE_SIZES = [25, 50, 100] as const
export type PageSize = (typeof PAGE_SIZES)[number]
export type SortOrder = 'asc' | 'desc'

type Raw = LocationQuery[string]

/** How one filter is read from and written to the address. `undefined` means "not set". */
export interface ParamSpec<T> {
  parse(raw: Raw | undefined): T
  serialize(value: T): string | string[] | undefined
  isSet(value: T): boolean
}

function first(raw: Raw | undefined): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' ? value : undefined
}

/** Free text, trimmed; empty or longer than `maxLength` is "not set". */
export function text(options: { maxLength: number }): ParamSpec<string | undefined> {
  return {
    parse(raw) {
      const value = first(raw)?.trim()
      return value && value.length <= options.maxLength ? value : undefined
    },
    serialize: (value) => (value ? value : undefined),
    isSet: (value) => !!value,
  }
}

/** One value of a closed list. */
export function oneOf<const V extends string>(values: readonly V[]): ParamSpec<V | undefined> {
  return {
    parse(raw) {
      const value = first(raw)
      return value !== undefined && (values as readonly string[]).includes(value)
        ? (value as V)
        : undefined
    },
    serialize: (value) => value,
    isSet: (value) => value !== undefined,
  }
}

/** A repeatable parameter of a closed list, at most `max` distinct values. */
export function manyOf<const V extends string>(
  values: readonly V[],
  options: { max: number },
): ParamSpec<V[]> {
  return {
    parse(raw) {
      const list = (Array.isArray(raw) ? raw : [raw]).filter(
        (value): value is V =>
          typeof value === 'string' && (values as readonly string[]).includes(value),
      )
      const unique = [...new Set(list)]
      return unique.length <= options.max ? unique : []
    },
    serialize: (value) => (value.length > 0 ? [...value] : undefined),
    isSet: (value) => value.length > 0,
  }
}

/** A custom parameter, for example an IP network or a time. */
export function custom<T>(spec: ParamSpec<T>): ParamSpec<T> {
  return spec
}

export interface SortSpec<S extends string> {
  values: readonly S[]
  default: S
  defaultOrder: (sort: S) => SortOrder
}

export interface ListSchema<F extends Record<string, unknown>, S extends string = never> {
  filters: { [K in keyof F]: ParamSpec<F[K]> }
  sort?: SortSpec<S>
}

export interface ListState<F, S extends string> {
  filters: F
  sort: S | undefined
  order: SortOrder | undefined
  page: number
  size: PageSize
}

function parseState<F extends Record<string, unknown>, S extends string>(
  schema: ListSchema<F, S>,
  query: LocationQuery,
): ListState<F, S> {
  const filters = {} as F
  for (const key of Object.keys(schema.filters) as (keyof F & string)[]) {
    filters[key] = schema.filters[key].parse(query[key])
  }
  let sort: S | undefined
  let order: SortOrder | undefined
  if (schema.sort) {
    const rawSort = first(query.sort)
    sort = (schema.sort.values as readonly string[]).includes(rawSort ?? '')
      ? (rawSort as S)
      : schema.sort.default
    const rawOrder = first(query.order)
    order = rawOrder === 'asc' || rawOrder === 'desc' ? rawOrder : schema.sort.defaultOrder(sort)
  }
  const rawPage = first(query.page)
  const page = rawPage && /^[1-9][0-9]{0,8}$/.test(rawPage) ? Number(rawPage) : 1
  const rawSize = Number(first(query.size))
  const size = (PAGE_SIZES as readonly number[]).includes(rawSize) ? (rawSize as PageSize) : 25
  return { filters, sort, order, page, size }
}

function toQuery<F extends Record<string, unknown>, S extends string>(
  schema: ListSchema<F, S>,
  state: ListState<F, S>,
): LocationQueryRaw {
  const query: LocationQueryRaw = {}
  for (const key of Object.keys(schema.filters) as (keyof F & string)[]) {
    const value = schema.filters[key].serialize(state.filters[key])
    if (value !== undefined) query[key] = value
  }
  if (schema.sort && state.sort) {
    if (state.sort !== schema.sort.default) query.sort = state.sort
    if (state.order && state.order !== schema.sort.defaultOrder(state.sort)) {
      query.order = state.order
    }
  }
  if (state.page > 1) query.page = String(state.page)
  if (state.size !== 25) query.size = String(state.size)
  return query
}

function sameQuery(a: LocationQuery, b: LocationQueryRaw): boolean {
  const norm = (q: LocationQuery | LocationQueryRaw) =>
    JSON.stringify(
      Object.keys(q)
        .sort()
        .map((key) => [key, ([] as unknown[]).concat(q[key] ?? []).map(String)]),
    )
  return norm(a) === norm(b)
}

export interface ListStateOptions {
  /** Called when the visible set changes: filters, sort, page size or page (bulk selection). */
  onReset?: () => void
}

export interface UseListState<F, S extends string> {
  state: ComputedRef<ListState<F, S>>
  /** `limit`, `offset` and, with a sort schema, `sort` and `order` for the API request. */
  paging: ComputedRef<{ limit: number; offset: number; sort?: S; order?: SortOrder }>
  activeFilters: ComputedRef<(keyof F & string)[]>
  pageSizes: readonly PageSize[]
  setFilter<K extends keyof F & string>(
    key: K,
    value: F[K],
    options?: { typing?: boolean },
  ): Promise<void>
  setFilters(values: Partial<F>): Promise<void>
  setSort(sort: S, order?: SortOrder): Promise<void>
  setPage(page: number): Promise<void>
  setSize(size: PageSize): Promise<void>
}

export function useListState<F extends Record<string, unknown>, S extends string = never>(
  schema: ListSchema<F, S>,
  options: ListStateOptions = {},
): UseListState<F, S> {
  const route = useRoute()
  const router = useRouter()

  const state = computed(() => parseState(schema, route.query))

  // Normalise the address: invalid values and defaults are removed without a history entry.
  watch(
    () => route.query,
    (query) => {
      const normal = toQuery(schema, parseState(schema, query))
      if (!sameQuery(query, normal)) void router.replace({ query: normal, hash: route.hash })
    },
    { immediate: true },
  )

  async function navigate(next: ListState<F, S>, mode: 'push' | 'replace', reset: boolean) {
    if (reset) options.onReset?.()
    const location = { query: toQuery(schema, next), hash: route.hash }
    await (mode === 'push' ? router.push(location) : router.replace(location))
  }

  const current = () => ({ ...state.value, filters: { ...state.value.filters } })

  return {
    state,
    paging: computed(() => {
      const { page, size, sort, order } = state.value
      return {
        limit: size,
        offset: (page - 1) * size,
        ...(sort ? { sort, order } : {}),
      }
    }),
    activeFilters: computed(() =>
      (Object.keys(schema.filters) as (keyof F & string)[]).filter((key) =>
        schema.filters[key].isSet(state.value.filters[key]),
      ),
    ),
    pageSizes: PAGE_SIZES,
    setFilter(key, value, opts = {}) {
      const next = current()
      next.filters[key] = value
      next.page = 1
      return navigate(next, opts.typing ? 'replace' : 'push', true)
    },
    setFilters(values) {
      const next = current()
      Object.assign(next.filters, values)
      next.page = 1
      return navigate(next, 'push', true)
    },
    setSort(sort, order) {
      const next = current()
      next.sort = sort
      next.order = order ?? schema.sort?.defaultOrder(sort)
      next.page = 1
      return navigate(next, 'push', true)
    },
    setPage(page) {
      const next = current()
      next.page = Number.isInteger(page) && page > 0 ? page : 1
      return navigate(next, 'push', true)
    },
    setSize(size) {
      const next = current()
      next.size = (PAGE_SIZES as readonly number[]).includes(size) ? size : 25
      next.page = 1
      return navigate(next, 'push', true)
    },
  }
}
