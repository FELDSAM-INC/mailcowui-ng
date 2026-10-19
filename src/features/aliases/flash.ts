// The outcome alert a creation leaves for the alias page it opens (docs/conventions.md "Outcomes"):
// legacy's `success.alias_added` with the address and the ID, shown once.
const flashes = new Map<number, string>()

export function setAliasFlash(id: number, message: string): void {
  flashes.set(id, message)
}

export function takeAliasFlash(id: number): string | null {
  const message = flashes.get(id) ?? null
  flashes.delete(id)
  return message
}
