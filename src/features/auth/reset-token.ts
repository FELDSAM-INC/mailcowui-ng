// The password reset token (UI 005 research R12, FR-038): the reset route's `beforeEnter` moves it
// from `?token=` (the API's default reset page) or `#token=` into this in-memory holder and returns
// the route without query and hash, replacing the history entry, so the token leaves the address
// bar before the page renders. The page reads it once; it is cleared on completion, on "request a
// new link" and when the page goes away. Never storage, never a URL afterwards.
import type { RouteLocationNormalizedGeneric, RouteLocationRaw } from 'vue-router'

let held: string | null = null

// PasswordResetTokenCheckRequest.token in the pinned contract.
const MAX_TOKEN_LENGTH = 64

function tokenOf(to: RouteLocationNormalizedGeneric): string | null {
  const query = to.query.token
  if (Object.hasOwn(to.query, 'token')) {
    return typeof query === 'string' && query.length > 0 && query.length <= MAX_TOKEN_LENGTH
      ? query
      : null
  }
  try {
    const hash = /^#token=([^&]+)/.exec(to.hash)?.[1]
    const token = hash ? decodeURIComponent(hash) : null
    return token && token.length <= MAX_TOKEN_LENGTH ? token : null
  } catch {
    return null
  }
}

/** The reset route's `beforeEnter`. */
export function captureResetToken(to: RouteLocationNormalizedGeneric): true | RouteLocationRaw {
  if (!Object.hasOwn(to.query, 'token') && !to.hash.startsWith('#token=')) return true
  // Invalid links still lose their token and must never reuse a previously captured value.
  held = tokenOf(to)
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
