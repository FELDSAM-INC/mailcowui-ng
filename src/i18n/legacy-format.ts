// The formatter of mailcow's own strings (constitution IV 1.3.0, research R15). It is plain
// substitution, so it is CSP-safe and never compiles a value: `%s` and `%d` in order, positional
// `%1$s` and `%1$d`, and the DataTables placeholders (`_START_`, `_MENU_` and so on) that the caller
// names. Every other character, including braces, `%` signs, glyphs and markup, stays as it is.
export type LegacyArg = string | number

/** DataTables placeholders and their values, for example `{ _START_: 1, _TOTAL_: '1,204' }`. */
export type LegacyNamed = Readonly<Record<`_${string}_`, LegacyArg>>

/** A part of a value that the caller renders itself, such as a select for `_MENU_`. */
export interface LegacySlot {
  slot: `_${string}_`
}

const TOKEN = /%(?:([1-9]\d*)\$)?([sd])|_[A-Z]+_/g

function asText(value: LegacyArg, conversion: string | undefined): string {
  if (conversion === 'd' && typeof value === 'number') return String(Math.trunc(value))
  return String(value)
}

/**
 * Splits a value into text and the slots the caller fills; placeholders without an argument stay
 * as they are, like the file has them.
 */
export function legacySegments(
  template: string,
  args: readonly LegacyArg[] = [],
  named: LegacyNamed = {},
  slots: readonly string[] = [],
  escape: (text: string) => string = (text) => text,
): (string | LegacySlot)[] {
  const segments: (string | LegacySlot)[] = []
  let text = ''
  let next = 0
  let last = 0
  for (const match of template.matchAll(TOKEN)) {
    const [token, position, conversion] = match
    const index = match.index
    text += template.slice(last, index)
    last = index + token.length
    if (conversion) {
      const argIndex = position ? Number(position) - 1 : next++
      const value = args[argIndex]
      text += value === undefined ? token : escape(asText(value, conversion))
    } else if (slots.includes(token)) {
      if (text) segments.push(text)
      text = ''
      segments.push({ slot: token as LegacySlot['slot'] })
    } else {
      const value = (named as Record<string, LegacyArg | undefined>)[token]
      text += value === undefined ? token : escape(asText(value, undefined))
    }
  }
  text += template.slice(last)
  if (text) segments.push(text)
  return segments
}

/** Fills a value's placeholders. `escape` is applied to the arguments of a value with markup. */
export function formatLegacy(
  template: string,
  args: readonly LegacyArg[] = [],
  named: LegacyNamed = {},
  escape?: (text: string) => string,
): string {
  return legacySegments(template, args, named, [], escape)
    .map((segment) => (typeof segment === 'string' ? segment : segment.slot))
    .join('')
}

const MARKUP = /<\/?[a-z][a-z0-9]*(?:\s[^<>]*)?\/?>|&(?:[a-z][a-z0-9]*|#\d+|#x[0-9a-f]+);/i

/** Whether a value contains HTML (a tag or a character reference) and must be sanitised. */
export function hasMarkup(value: string): boolean {
  return MARKUP.test(value)
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Escapes text for insertion into a value with markup. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char)
}
