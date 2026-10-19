// Keeps a form's unsaved input when the form unmounts because the session ended, and gives it back
// when the same account opens the same address again in this tab (UI 004 data-model §4, research
// R10, spec edge case "Session expires while a form is open"). The input lives in the in-memory
// registry (`draft-registry.ts`) only: never in device storage. Forms that carry secrets never use
// it (docs/conventions.md "Secrets in requests or responses").
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { draftOwner, drafts, sessionEnded } from './draft-registry'

export {
  clearAllDrafts,
  draftCount,
  markSessionEnded,
  sessionEnded,
  setDraftOwner,
} from './draft-registry'

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
    if (draft && draftOwner() !== null && draft.owner === draftOwner()) {
      options.restore(draft.value as T)
      restored.value = true
    }
  })

  onBeforeUnmount(() => {
    const owner = draftOwner()
    if (!sessionEnded.value || owner === null || !options.dirty()) return
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
