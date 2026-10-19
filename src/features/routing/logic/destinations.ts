// Several transport destinations in legacy's single field (legacy form map part 3, decision 10):
// split as legacy splits them (spaces, commas, semicolons and line breaks,
// `inc/functions.transports.inc.php`), or on whitespace only for MX-based patterns, which may
// contain commas and semicolons; trimmed, empty items dropped, duplicates ignoring letter case kept
// once in their first spelling and order.
export function splitDestinations(input: string, mxBased: boolean): string[] {
  const parts = input.split(mxBased ? /\s+/ : /[\s,;]+/)
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of parts) {
    const value = raw.trim()
    if (!value || seen.has(value.toLowerCase())) continue
    seen.add(value.toLowerCase())
    result.push(value)
  }
  return result
}
