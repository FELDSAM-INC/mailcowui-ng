// Multi-entry fields (UI 004 data-model §2, research R8): alias addresses, goto addresses, alias
// domain names and external sender addresses, separated as the classic forms separate them
// (`preg_split("/( |,|;|\n)/")`, plus any other whitespace), trimmed, without empty entries and
// without entries that differ only in letter case (the first spelling is kept).

/** An entry with its position in the list that is sent, so that `destinations.2` finds it. */
export interface ParsedEntry {
  value: string
  index: number
}

export function parseEntryList(text: string): ParsedEntry[] {
  const seen = new Set<string>()
  const entries: ParsedEntry[] = []
  for (const raw of text.split(/[,;\s]+/)) {
    const value = raw.trim()
    if (!value || seen.has(value.toLowerCase())) continue
    seen.add(value.toLowerCase())
    entries.push({ value, index: entries.length })
  }
  return entries
}

/** An alias address of the form `@domain` creates a catch-all alias. */
export function isCatchAll(value: string): boolean {
  return value.startsWith('@')
}

/** Entries written back into the field, as the classic edit form shows them (`, `). */
export function joinEntries(values: readonly string[]): string {
  return values.join(', ')
}
