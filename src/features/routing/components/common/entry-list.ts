// The column definitions of the routing lists (research R4, data-model §2 EntryList columns): the
// classic table's columns with their legacy headers. A column renders its `text`, or the list's
// `cell-<key>` slot when the page gives one.
export interface EntryColumn<T> {
  key: string
  label: string
  /** The sort value its header sorts by, when the API can sort by it. */
  sort?: string
  text?: (entry: T) => string
}

export interface SortChoice {
  value: string
  label: string
}

export type FilterDef =
  | { key: string; label: string; kind: 'select'; options: readonly SortChoice[] }
  | { key: string; label: string; kind: 'checks'; options: readonly SortChoice[] }
  | { key: string; label: string; kind: 'text' }
  /** One free-text value of a repeatable parameter (sent as a one-item list). */
  | { key: string; label: string; kind: 'textList' }
