// Untrusted text for places that take a string, such as an announcement or an accessible name
// (UI 006 research R9): control and bidi characters become their visible `U+…` names, as
// PlainText shows them, so nothing can reorder the surrounding text.
import { neutralise } from '@/shared/security/plain-text'

export function inertText(value: string): string {
  return neutralise(value, { multiline: false })
    .map((segment) => (segment.kind === 'text' ? segment.value : ` ${segment.codePoint} `))
    .join('')
}
