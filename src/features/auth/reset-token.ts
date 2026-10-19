// The password reset token (UI 005 research R12, FR-038): the reset route's `beforeEnter` moves it
// from `?token=` (the API's default reset page) or `#token=` into this in-memory holder and returns
// the route without query and hash, replacing the history entry, so the token leaves the address
// bar before the page renders. The page reads it once; it is cleared on completion, on "request a
// new link" and when the page goes away. Never storage, never a URL afterwards.
import type { RouteLocationNormalizedGeneric, RouteLocationRaw } from 'vue-router'

let held: string | null = null

function tokenOf(to: RouteLocationNormalizedGeneric): string | null {
  const query = to.query.token
  if (typeof query === 'string' && query !== '') return query
  const hash = /^#token=([^&]+)/.exec(to.hash)?.[1]
  return hash ? decodeURIComponent(hash) : null
}

/** The reset route's `beforeEnter`. */
export function captureResetToken(to: RouteLocationNormalizedGeneric): true | RouteLocationRaw {
  const token = tokenOf(to)
  if (token === null) return true
  held = token
  // `force`: a link that differs only by its fragment is otherwise the same location.
  return { path: to.path, query: {}, hash: '', replace: true, force: true }
}

/** Reads the token once; later calls get null until a new link is opened. */
export function takeResetToken(): string | null {
  const token = held
  held = null
  return token
}

export function clearResetToken(): void {
  held = null
}
