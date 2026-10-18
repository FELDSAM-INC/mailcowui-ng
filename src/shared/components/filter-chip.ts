// One chip of ActiveFilterChips.vue, in a TypeScript module so that other modules can import it.
export interface FilterChip {
  key: string
  label?: string
  /** UI 004: a key built at runtime, shown with its legacy markup (`enums.aliasDestinationType.learnSpam`). */
  messageKey?: string
}
