// The requested in-app address, kept for one single sign-on round trip (UI 012 research R4,
// FR-043, FR-047, data-model §4): written to this tab's `sessionStorage` right before the browser
// leaves for the provider, read and removed once on return. Only a path the router accepts as a
// return address (UI 001 R11) is ever written or returned; a storage that fails is ignored, and the
// landing is then the home screen (SC-011).
import type { Router } from 'vue-router'

import { acceptReturnTo } from '@/app/router/return-to'
import { sessionStore } from '@/shared/platform/storage'

const KEY = 'mailcowui-ng.sso-return-to'

export function keepReturnTo(value: unknown, router: Router): void {
  const accepted = acceptReturnTo(value, router)
  if (accepted) sessionStore.set(KEY, accepted)
  else sessionStore.remove(KEY)
}

/** The kept address, removed at once; null when none is kept or the router refuses it. */
export function takeKeptReturnTo(router: Router): string | null {
  const value = sessionStore.get(KEY)
  sessionStore.remove(KEY)
  return acceptReturnTo(value, router)
}

/** Forgets an address left behind by an abandoned round trip (the sign-in screen mounts). */
export function forgetKeptReturnTo(): void {
  sessionStore.remove(KEY)
}
