// The in-memory draft registry (UI 004 data-model §4, research R10, spec edge case "Session
// expires while a form is open"). A form's unsaved input is kept when the form unmounts because the
// session ended, and given back when the same account opens the same address again in this tab.
// It lives in a module-level Map only: never in device storage, and a reload loses it by design.
// Forms that carry secrets never use it (docs/conventions.md "Secrets in requests or responses").
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

interface Draft {
  owner: string
  value: unknown
}

const drafts = new Map<string, Draft>()
let owner: string | null = null
let ended = false

/** The signed-in account. Another account's drafts are discarded; a new session starts. */
export function setDraftOwner(username: string | null): void {
  if (!username) return
  if (owner !== null && owner !== username) drafts.clear()
  owner = username
  ended = false
}

/** The session ended (idle, refused, another tab): forms that unmount now keep their input. */
export function markSessionEnded(): void {
  ended = true
}

/** Sign-out and an account change discard every draft. */
export function clearAllDrafts(): void {
  drafts.clear()
}

/** The number of kept drafts (tests). */
export function draftCount(): number {
  return drafts.size
}

export interface FormDraftOptions<T> {
  /** The form's input, as a structured-cloneable value. */
  capture: () => T
  restore: (value: T) => void
  /** Whether there is input worth keeping. */
  dirty: () => boolean
}

export function useFormDraft<T>(formId: string, options: FormDraftOptions<T>) {
  const route = useRoute()
  const key = `${route.fullPath}#${formId}`
  const restored = ref(false)
  /** The input as saved or discarded: unchanged input is not kept again. */
  let settled: string | null = null

  onMounted(() => {
    const draft = drafts.get(key)
    drafts.delete(key)
    if (draft && owner !== null && draft.owner === owner) {
      options.restore(draft.value as T)
      restored.value = true
    }
  })

  onBeforeUnmount(() => {
    if (!ended || owner === null || !options.dirty()) return
    const value = options.capture()
    if (settled !== null && JSON.stringify(value) === settled) return
    drafts.set(key, { owner, value: structuredClone(value) })
  })

  return {
    restored,
    /** After a successful save or an explicit discard. */
    clear() {
      drafts.delete(key)
      settled = JSON.stringify(options.capture())
    },
  }
}
