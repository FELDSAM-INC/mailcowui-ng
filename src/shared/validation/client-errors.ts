// Client-side rule errors of a form (UI 002 research D25, promoted at its second use by UI 003):
// each error is a new string's key or one of mailcow's own messages (`legacy('danger.…', …args)`),
// with display parameters. `useClientErrors` turns them into field messages.
import type { TextRef } from '@/i18n'

export interface ClientError {
  /** A new string's key, or one of mailcow's own messages (`legacy('danger.domain_invalid')`). */
  key: TextRef
  /** Display values; `field` holds the message key of another field's label (`text()`). */
  params?: Record<string, string>
}

export type ClientErrors = Record<string, ClientError[]>

export function add(errors: ClientErrors, path: string, error: ClientError): void {
  ;(errors[path] ??= []).push(error)
}
