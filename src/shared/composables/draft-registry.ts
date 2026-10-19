// The in-memory draft registry (UI 004 data-model §4, research R10): the module-level Map that
// `useFormDraft` keeps forms' unsaved input in, and the session hooks (sign-out, session end,
// account change). A module of its own, so that the session code in the shell's bundle does not
// carry the composable (T111). Never in device storage; a reload loses it by design.
import { readonly, ref } from 'vue'

export interface Draft {
  owner: string
  value: unknown
}

export const drafts = new Map<string, Draft>()
let owner: string | null = null
const ended = ref(false)

/**
 * Whether the session has ended and the app is on its way to the sign-in screen. Leave guards
 * stand aside then (`useLeaveGuard`): the input is kept as a draft instead.
 */
export const sessionEnded = readonly(ended)

/** The account the drafts belong to, or null before a sign-in. */
export function draftOwner(): string | null {
  return owner
}

/** The signed-in account. Another account's drafts are discarded; a new session starts. */
export function setDraftOwner(username: string | null): void {
  if (!username) return
  if (owner !== null && owner !== username) drafts.clear()
  owner = username
  ended.value = false
}

/** The session ended (idle, refused, another tab): forms that unmount now keep their input. */
export function markSessionEnded(): void {
  ended.value = true
}

/** Sign-out and an account change discard every draft. */
export function clearAllDrafts(): void {
  drafts.clear()
}

/** The number of kept drafts (tests). */
export function draftCount(): number {
  return drafts.size
}
