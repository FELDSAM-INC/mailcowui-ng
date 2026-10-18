// Same-host addresses of the classic interface (research R19, spec Assumptions). They are mailcow
// paths, not brand data. Classic tabs cannot be deep-linked, so links point to pages.
import type { Role } from '@/api'

/** The classic sign-in page per role (FR-007, FR-008, FR-040). */
export const CLASSIC_SIGN_IN: Readonly<Record<Role, string>> = {
  admin: '/admin',
  domainAdmin: '/domainadmin',
  mailboxUser: '/',
}

/** The classic password reset page, linked as "Forgot password?" until feature 005 (FR-009). */
export const CLASSIC_PASSWORD_RESET = '/reset-password'

/**
 * The classic sign-in page for a role. The role-neutral screens and the force-SSO notice use the
 * mailbox-user page, where the classic single sign-on button lives (FR-007).
 */
export function classicSignIn(role: Role | null): string {
  return role ? CLASSIC_SIGN_IN[role] : CLASSIC_SIGN_IN.mailboxUser
}
