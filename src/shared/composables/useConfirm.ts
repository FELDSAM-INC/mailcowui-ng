// Promise-based confirmations (conventions "Confirmations", research R20). One ConfirmDialog host
// in App.vue shows the request; `await confirm({...})` resolves true or false. Sign-out is never
// confirmed (FR-036). UI 002 adds a typed confirmation (`requireTyped`: a domain name, a bulk
// count), rich content (`content`: the impact of a deletion) and information dialogs with a single
// close action (`alertOnly`), research D20 and D22.
import { markRaw, shallowRef, type Component } from 'vue'

export interface TypedConfirmation {
  /** The values that unlock the confirm action, for example the readable and the ASCII name. */
  accepted: readonly string[]
  ignoreCase?: boolean
  /** Translation key of the field's label, with its parameters. */
  labelKey: string
  labelParams?: Record<string, unknown>
}

export interface ConfirmRequest {
  title: string
  description?: string
  confirmLabel: string
  cancelLabel?: string
  /** Shows the confirm action as destructive. */
  destructive?: boolean
  /** The confirm action stays disabled until one accepted value is typed. */
  requireTyped?: TypedConfirmation
  /** A component rendered inside the dialog, for example a deletion impact. */
  content?: { component: Component; props?: Record<string, unknown> }
  /** Information only: one action (`confirmLabel`) that closes the dialog and resolves false. */
  alertOnly?: boolean
  /**
   * UI 006 (FR-026, FR-034): a high-risk action. The confirm action stays disabled until this
   * checkbox is ticked (for example "I understand that this message contains a virus").
   */
  acknowledge?: { label: string }
}

/** Whether a typed value matches one accepted value. */
export function matchesTyped(typed: string, rule: TypedConfirmation): boolean {
  const normal = (value: string) => (rule.ignoreCase ? value.trim().toLowerCase() : value.trim())
  const value = normal(typed)
  return value !== '' && rule.accepted.some((accepted) => normal(accepted) === value)
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
      content: request.content
        ? { ...request.content, component: markRaw(request.content.component) }
        : undefined,
      resolve,
      returnFocus: active instanceof HTMLElement ? active : null,
    }
  })
}

export function useConfirm() {
  return confirm
}
