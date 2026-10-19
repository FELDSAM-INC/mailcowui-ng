// The outcome an item action leaves for the list it returns to (UI 006 FR-025, conventions
// "Outcomes"): legacy's alerts of the action, shown once above the list and then forgotten. Memory
// only (FR-085).
import type { OutcomeLine } from './action-outcome'

let pending: OutcomeLine[] = []

export function setQuarantineFlash(lines: OutcomeLine[]): void {
  pending = [...lines]
}

export function takeQuarantineFlash(): OutcomeLine[] {
  const lines = pending
  pending = []
  return lines
}
