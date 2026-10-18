// Bulk selection (conventions "Bulk actions" and "Shared building blocks", UI 001 R20, UI 002
// research D22). An explicit selection mode that covers the current page only; the list clears it
// through `useListState`'s `onReset`. With the API's bulk limit, "select all" selects the visible
// entries in order up to the limit (the first N) and says so, and further selection is refused at
// the limit with the same message.
import { computed, ref, shallowRef, toValue, type MaybeRefOrGetter } from 'vue'

export interface BulkSelectionOptions {
  /** The bulk limit from the feature's capabilities read; null or undefined for none. */
  limit?: MaybeRefOrGetter<number | null | undefined>
}

export function useBulkSelection(options: BulkSelectionOptions = {}) {
  const active = ref(false)
  const ids = shallowRef<ReadonlySet<string>>(new Set())
  /** Set when "select all" stopped at the limit or a selection was refused at it. */
  const limitNotice = ref(false)

  const limit = computed(() => toValue(options.limit) ?? null)
  const count = computed(() => ids.value.size)
  const atLimit = computed(() => limit.value !== null && count.value >= limit.value)

  function set(next: Set<string>) {
    ids.value = next
    if (!atLimit.value) limitNotice.value = false
  }

  const isSelected = (id: string) => ids.value.has(id)
  const canSelect = (id: string) => isSelected(id) || !atLimit.value

  /** Toggles one entry; returns false when the limit refused it. */
  function toggle(id: string): boolean {
    const next = new Set(ids.value)
    if (next.has(id)) {
      next.delete(id)
      set(next)
      return true
    }
    if (atLimit.value) {
      limitNotice.value = true
      return false
    }
    next.add(id)
    set(next)
    return true
  }

  /** Selects the visible entries in order, up to the limit; `cut` when the limit stopped it. */
  function selectPage(visible: readonly string[]): { cut: boolean } {
    const next = new Set(ids.value)
    let cut = false
    for (const id of visible) {
      if (next.has(id)) continue
      if (limit.value !== null && next.size >= limit.value) {
        cut = true
        break
      }
      next.add(id)
    }
    set(next)
    if (cut) limitNotice.value = true
    return { cut }
  }

  const allSelected = (visible: readonly string[]) =>
    visible.length > 0 && visible.every((id) => ids.value.has(id))

  function clear() {
    set(new Set())
    limitNotice.value = false
  }

  /** After a run: keeps only the given IDs (failed, refused and outdated items). */
  function keep(keepIds: readonly string[]) {
    const wanted = new Set(keepIds)
    set(new Set([...ids.value].filter((id) => wanted.has(id))))
  }

  function enter() {
    active.value = true
  }

  function leave() {
    active.value = false
    clear()
  }

  return {
    active,
    ids,
    limit,
    count,
    atLimit,
    /** True when the limit message should be shown. */
    limitReached: computed(() => limitNotice.value || atLimit.value),
    isSelected,
    canSelect,
    toggle,
    selectPage,
    allSelected,
    clear,
    keep,
    enter,
    leave,
  }
}

export type BulkSelection = ReturnType<typeof useBulkSelection>
