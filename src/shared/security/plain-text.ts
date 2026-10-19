// Neutralising untrusted text for display (UI 006 research R9, data-model §2 "PlainText segments";
// created by UI 008, the first feature implemented that needs it, for sync job logs). The value is
// split into text and marker segments: a marker shows a code point visibly (`U+202E`), so control
// characters and bidi overrides cannot hide or reorder text. Nothing else is changed, and nothing
// is ever interpreted as markup: segments are rendered through text interpolation only.
//
// | Class                                         | Single-line | Multi-line            |
// |-----------------------------------------------|-------------|-----------------------|
// | U+0009, U+000A                                | marker      | kept                  |
// | U+000D, CR LF                                 | marker      | normalised to U+000A  |
// | other C0, U+007F, C1 (U+0080–U+009F)          | marker      | marker                |
// | U+202A–U+202E, U+2066–U+2069                  | marker      | marker                |
// | U+200E, U+200F, U+061C (bidi marks)           | marker      | kept                  |
// | U+2028, U+2029                                | marker      | normalised to U+000A  |
// | U+FEFF                                        | marker      | marker                |

export type PlainTextSegment =
  { kind: 'text'; value: string } | { kind: 'marker'; codePoint: string }

const SINGLE_LINE =
  /[\u0000-\u001F\u007F-\u009F\u061C\u200E\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069\uFEFF]/g
const MULTI_LINE = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069\uFEFF]/g

const codePoint = (char: string) =>
  `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`

export function neutralise(value: string, options: { multiline: boolean }): PlainTextSegment[] {
  const text = options.multiline ? value.replace(/\r\n?|[\u2028\u2029]/g, '\n') : value
  const pattern = options.multiline ? MULTI_LINE : SINGLE_LINE
  const segments: PlainTextSegment[] = []
  let last = 0
  pattern.lastIndex = 0
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) segments.push({ kind: 'text', value: text.slice(last, match.index) })
    segments.push({ kind: 'marker', codePoint: codePoint(match[0]) })
    last = match.index + match[0].length
  }
  if (last < text.length) segments.push({ kind: 'text', value: text.slice(last) })
  return segments
}
