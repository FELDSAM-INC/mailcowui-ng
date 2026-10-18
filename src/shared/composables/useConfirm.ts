// Promise-based confirmations (conventions "Confirmations", research R20). One ConfirmDialog host
// in App.vue shows the request; `await confirm({...})` resolves true or false. Sign-out is never
// confirmed (FR-036). UI 002 adds `requireTyped`.
import { shallowRef } from 'vue'

export interface ConfirmRequest {
  title: string
  description?: string
  confirmLabel: string
  cancelLabel?: string
  /** Shows the confirm action as destructive. */
  destructive?: boolean
}

interface Pending extends ConfirmRequest {
  resolve: (confirmed: boolean) => void
  /** The element focused before the dialog opened, focused again on close. */
  returnFocus: HTMLElement | null
}

const pending = shallowRef<Pending | null>(null)

export const confirmState = pending

export function settleConfirm(confirmed: boolean): void {
  const current = pending.value
  if (!current) return
  pending.value = null
  current.resolve(confirmed)
}

export function confirm(request: ConfirmRequest): Promise<boolean> {
  // A new request cancels one that is still open.
  settleConfirm(false)
  return new Promise<boolean>((resolve) => {
    const active = document.activeElement
    pending.value = {
      ...request,
      resolve,
      returnFocus: active instanceof HTMLElement ? active : null,
    }
  })
}

export function useConfirm() {
  return confirm
}
