// Tags edited as a set (UI 002 research D13, FR-039, FR-040, FR-058): trimmed, empty entries
// ignored, too long ones refused, case-only duplicates kept once with the first spelling. The same
// rules serve the footer exclusions. Promoted from UI 002 at its second use (UI 003's mailbox tags).

/** Adds the comma-separated entries of `input`; returns the new set and the refused entries. */
export function addTags(
  current: readonly string[],
  input: string,
  options: { maxLength: number },
): { tags: string[]; refused: string[] } {
  const tags = [...current]
  const seen = new Set(current.map((tag) => tag.toLowerCase()))
  const refused: string[] = []
  for (const raw of input.split(',')) {
    const tag = raw.trim()
    if (tag === '') continue
    if (tag.length > options.maxLength) {
      refused.push(tag)
      continue
    }
    if (seen.has(tag.toLowerCase())) continue
    seen.add(tag.toLowerCase())
    tags.push(tag)
  }
  return { tags, refused }
}

export function removeTag(current: readonly string[], tag: string): string[] {
  return current.filter((item) => item !== tag)
}

/** Equal sets, ignoring letter case and order. */
export function sameTagSet(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a.map((tag) => tag.trim().toLowerCase()))
  const right = new Set(b.map((tag) => tag.trim().toLowerCase()))
  return left.size === right.size && [...left].every((tag) => right.has(tag))
}

/**
 * FR-040: a set above the tagging limit is refused, unless it is the stored set or smaller than
 * it (a domain that already has more tags may shrink).
 */
export function exceedsTagLimit(
  tags: readonly string[],
  stored: readonly string[],
  limit: number,
): boolean {
  if (tags.length <= limit) return false
  if (sameTagSet(tags, stored)) return false
  return tags.length >= stored.length
}
