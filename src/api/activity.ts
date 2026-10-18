// Session activity (research R8, R12). The API renews its idle timer on every session request, so
// every response except `401 unauthenticated` counts as "the session was used now". The session
// module listens, updates the idle deadline and tells the other tabs.
type ActivityListener = (at: number) => void

const listeners = new Set<ActivityListener>()

export function onActivity(listener: ActivityListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function recordActivity(at: number = Date.now()): void {
  for (const listener of [...listeners]) listener(at)
}
