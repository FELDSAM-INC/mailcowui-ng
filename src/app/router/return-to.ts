// The page to open after sign-in (FR-031, FR-092, research R11). Only an in-app path is accepted;
// anything else is ignored. Navigation always goes through the router with the base `/ng/`, so an
// accepted value can never leave the app.
import type { Router } from 'vue-router'

import { isAuthFlowRoute } from './route-kinds'

export const RETURN_TO_MAX_LENGTH = 2048

// Control characters, including tab, newline and NUL.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/

export function acceptReturnTo(value: unknown, router: Router): string | null {
  if (typeof value !== 'string') return null
  if (value.length === 0 || value.length > RETURN_TO_MAX_LENGTH) return null
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  if (CONTROL_CHARACTERS.test(value) || value.includes('\\')) return null
  try {
    const resolved = router.resolve(value)
    if (resolved.matched.length === 0 || isAuthFlowRoute(resolved)) return null
  } catch {
    return null
  }
  return value
}
