// The outcome of a creation, shown on the new job's page (FR-028, conventions "Outcomes"): the
// create page leaves legacy's message here before it opens the job, and the job page takes it once.
// It lives in memory only, never in storage or the address.
let pending: { id: number; message: string } | null = null

export function rememberOutcome(id: number, message: string): void {
  pending = { id, message }
}

/** The message left for a job, removed when taken. */
export function takeOutcome(id: number): string | null {
  if (!pending || pending.id !== id) return null
  const { message } = pending
  pending = null
  return message
}
