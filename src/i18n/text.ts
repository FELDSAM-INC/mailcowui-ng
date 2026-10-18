// A reference to a text that is either an app message key (vue-i18n, new strings) or one of
// mailcow's own strings (`legacy('header.debug')`), for tables such as the navigation catalogue,
// route titles and label maps (constitution IV 1.3.0, research R15).
import type { LegacyArg } from './legacy-format'
import { lt, type LegacyKey } from './legacy'

export interface LegacyRef {
  readonly legacy: LegacyKey
  readonly args?: readonly LegacyArg[]
}

/** An app message key, or a legacy key wrapped by `legacy()`. */
export type TextRef = string | LegacyRef

export function legacy(key: LegacyKey, ...args: LegacyArg[]): LegacyRef {
  return args.length > 0 ? { legacy: key, args } : { legacy: key }
}

export function isLegacyRef(ref: TextRef): ref is LegacyRef {
  return typeof ref === 'object'
}

/** The text of a reference, with vue-i18n's `t` for app keys. */
export function resolveText(ref: TextRef, t: (key: string) => string): string {
  return isLegacyRef(ref) ? lt(ref.legacy, ...(ref.args ?? [])) : t(ref)
}
