// The outcome alerts one screen leaves for the next (docs/conventions.md "Outcomes"): a creation
// leaves legacy's `success.resource_added` for the new resource's page; a vanished resource leaves
// "no longer exists" for the list. Each is shown once.
const created = new Map<string, string>()
let listFlash: { kind: 'success' | 'danger'; message: string } | null = null

export function setResourceFlash(address: string, message: string): void {
  created.set(address.toLowerCase(), message)
}

export function takeResourceFlash(address: string): string | null {
  const key = address.toLowerCase()
  const message = created.get(key) ?? null
  created.delete(key)
  return message
}

export function setResourceListFlash(kind: 'success' | 'danger', message: string): void {
  listFlash = { kind, message }
}

export function takeResourceListFlash(): { kind: 'success' | 'danger'; message: string } | null {
  const value = listFlash
  listFlash = null
  return value
}
