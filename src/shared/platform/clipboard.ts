// Copies text to the clipboard (FR-066). A refusal is a result, not an error: the caller then
// selects the text for manual copying (edge case "clipboard access refused").

export async function copyText(text: string): Promise<'copied' | 'refused'> {
  try {
    if (typeof navigator.clipboard?.writeText !== 'function') return 'refused'
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'refused'
  }
}
