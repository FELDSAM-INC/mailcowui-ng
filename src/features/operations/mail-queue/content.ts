// The content viewer's first view (research R15, data-model §2): a queued message can be several
// megabytes, so only its first 262,144 UTF-16 code units (256 Ki characters) are rendered at
// first, cut before a surrogate pair rather than through it; "Show the rest" renders everything.
// Copying always copies the complete, unmodified content.

export const FIRST_VIEW_LENGTH = 262_144

export function firstView(content: string): { text: string; rest: number } {
  if (content.length <= FIRST_VIEW_LENGTH) return { text: content, rest: 0 }
  let end = FIRST_VIEW_LENGTH
  const last = content.charCodeAt(end - 1)
  if (last >= 0xd800 && last <= 0xdbff) end -= 1
  return { text: content.slice(0, end), rest: content.length - end }
}
