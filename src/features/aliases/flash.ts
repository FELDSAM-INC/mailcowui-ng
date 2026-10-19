// The outcome alerts one screen leaves for the next (docs/conventions.md "Outcomes"): a creation
// leaves legacy's `success.alias_added` with the address and the ID for the alias page it opens; a
// vanished alias leaves "no longer exists" for the list. Each is shown once.
const flashes = new Map<number, string>()

export function setAliasFlash(id: number, message: string): void {
  flashes.set(id, message)
}

export function takeAliasFlash(id: number): string | null {
  const message = flashes.get(id) ?? null
  flashes.delete(id)
  return message
}

/** An outcome for the alias list a page returns to, for example "no longer exists" (FR-028). */
let listFlash: { kind: 'success' | 'danger'; message: string } | null = null

export function setAliasListFlash(kind: 'success' | 'danger', message: string): void {
  listFlash = { kind, message }
}

export function takeAliasListFlash(): { kind: 'success' | 'danger'; message: string } | null {
  const value = listFlash
  listFlash = null
  return value
}
