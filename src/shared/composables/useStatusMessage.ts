// App-level status messages (UI 011 research R8, FR-078): outcomes that arrive after the user left
// the screen that started them, for example a container restart answered while the logs are open.
// `StatusMessageHost` (in the shell layout) shows them in a status region until the user dismisses
// them: they never disappear on a timer, so never while focused or hovered.
import { readonly, shallowRef } from 'vue'

export type StatusTone = 'success' | 'warning' | 'danger' | 'info'

export interface StatusMessage {
  id: number
  /** A translated text; untrusted parts are already neutralised by the caller's wording. */
  text: string
  tone: StatusTone
}

const messages = shallowRef<readonly StatusMessage[]>([])
let nextId = 1

export function pushStatusMessage(message: Omit<StatusMessage, 'id'>): number {
  const id = nextId++
  messages.value = [...messages.value, { ...message, id }]
  return id
}

export function dismissStatusMessage(id: number): void {
  messages.value = messages.value.filter((message) => message.id !== id)
}

/** Removes every message (tests, sign-out). */
export function clearStatusMessages(): void {
  messages.value = []
}

export function useStatusMessage() {
  return {
    messages: readonly(messages),
    push: pushStatusMessage,
    dismiss: dismissStatusMessage,
  }
}
