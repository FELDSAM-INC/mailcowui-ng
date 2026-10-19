// Values found in DNS are third-party text (FR-078): shown as text only, with control and
// direction characters made visible as `\u{XXXX}` escapes, so that they cannot hide or reorder
// what is shown.
const INVISIBLE = new RegExp(
  '[\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u061c\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u2069\\ufeff]',
  'g',
)

export function visibleText(value: string): string {
  return value.replace(
    INVISIBLE,
    (character) => `\\u{${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}}`,
  )
}
