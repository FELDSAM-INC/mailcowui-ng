// An allow or block list pattern (UI 006 research R19, data-model §7): trimmed and lower-cased as
// the API does, then checked against the capabilities' rules before anything is sent: only the
// allowed characters, at least one letter or digit, at most `maxLength` characters. The messages are
// legacy's (`danger.policy_list_from_invalid` through `validation.format.senderPattern`) and
// `validation.tooLong`; legacy explains nothing more (D6, D12).
import type { QuarantineCapabilities } from '@/api'

/** The capabilities' rules, widened from the contract's constants. */
export type SenderPatternRules = {
  [
    K in keyof QuarantineCapabilities['senderPattern']
  ]: QuarantineCapabilities['senderPattern'][K] extends number ? number : string
}
export type PatternError = 'required' | 'invalidFormat' | 'tooLong'

export function normalisePattern(raw: string): string {
  return raw.trim().toLowerCase()
}

/** The capabilities' character class as a pattern; `\`, `[`, `]` and a leading `^` are literal. */
function characterClass(allowed: string): RegExp {
  const escaped = allowed.replace(/[\\[\]]/g, (char) => `\\${char}`).replace(/^\^/, '\\^')
  return new RegExp(`^[${escaped}]+$`)
}

/** The first rule a normalised pattern breaks, or null. */
export function patternError(pattern: string, rules: SenderPatternRules): PatternError | null {
  if (pattern === '') return 'required'
  if (!characterClass(rules.allowedCharacters).test(pattern) || !/[a-z0-9]/.test(pattern)) {
    return 'invalidFormat'
  }
  return pattern.length > rules.maxLength ? 'tooLong' : null
}
