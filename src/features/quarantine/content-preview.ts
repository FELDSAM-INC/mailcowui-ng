// The preview of a long content part (UI 006 FR-021, data-model §2 "Content preview"): at most the
// first 20 lines and 4,000 characters, always a prefix of the text that never splits a surrogate
// pair. "Show full text" then shows the rest.

export const PREVIEW_MAX_LINES = 20
export const PREVIEW_MAX_CHARS = 4000

export interface Preview {
  head: string
  truncated: boolean
}

export function preview(
  text: string,
  options: { maxLines?: number; maxChars?: number } = {},
): Preview {
  const maxLines = options.maxLines ?? PREVIEW_MAX_LINES
  const maxChars = options.maxChars ?? PREVIEW_MAX_CHARS
  let end = text.length
  // The end of the last allowed line: the line break after it is left out.
  let breaks = 0
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '\n') continue
    breaks += 1
    if (breaks === maxLines) {
      // A line break that only ends the text adds no line.
      if (index < text.length - 1) end = index
      break
    }
  }
  if (end > maxChars) {
    end = maxChars
    const code = text.charCodeAt(end - 1)
    // Never end on a high surrogate: the character would be cut in half.
    if (code >= 0xd800 && code <= 0xdbff) end -= 1
  }
  return end < text.length
    ? { head: text.slice(0, end), truncated: true }
    : { head: text, truncated: false }
}
