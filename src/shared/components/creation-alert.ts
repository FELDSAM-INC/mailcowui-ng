// The outcome alerts of a creation, shown as the classic interface shows them (docs/conventions.md
// "Outcomes"): one alert per outcome, with legacy's `success.*`, `warning.*` or `danger.*` text.
import type { TextRef } from '@/i18n'

export type AlertKind = 'success' | 'warning' | 'danger'

export interface CreationAlert {
  kind: AlertKind
  /** mailcow's own text with its arguments, or a new string's key (filled with `params`). */
  text: TextRef
  params: string[]
}
