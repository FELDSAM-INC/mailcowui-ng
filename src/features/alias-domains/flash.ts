// The outcome alerts one screen leaves for the next (docs/conventions.md "Outcomes"): a creation
// leaves legacy's alerts for the page of the new alias domain; a vanished alias domain leaves "no
// longer exists" for the list. Each is shown once.
import type { CreationAlert } from '@/shared/components/creation-alert'

const created = new Map<string, CreationAlert[]>()
let listFlash: { kind: 'success' | 'danger'; message: string } | null = null

export function setCreationFlash(name: string, alerts: CreationAlert[]): void {
  created.set(name, alerts)
}

export function takeCreationFlash(name: string): CreationAlert[] | null {
  const alerts = created.get(name) ?? null
  created.delete(name)
  return alerts
}

export function setAliasDomainListFlash(kind: 'success' | 'danger', message: string): void {
  listFlash = { kind, message }
}

export function takeAliasDomainListFlash(): { kind: 'success' | 'danger'; message: string } | null {
  const value = listFlash
  listFlash = null
  return value
}
