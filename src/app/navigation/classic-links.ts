// Same-host addresses of the classic interface (research R19, spec Assumptions). They are mailcow
// paths, not brand data. Classic tabs cannot be deep-linked, so links point to pages.
import type { Role } from '@/api'

/** The classic sign-in page per role (FR-007, FR-008, FR-040). */
export const CLASSIC_SIGN_IN: Readonly<Record<Role, string>> = {
  admin: '/admin',
  domainAdmin: '/domainadmin',
  mailboxUser: '/',
}

/**
 * The names of the classic pages that placeholders link to (FR-044), as translation keys. Classic
 * tabs cannot be deep-linked, so the links open these pages (plan parity note 1).
 */
export const CLASSIC_PAGE_LABELS: Readonly<Record<string, string>> = {
  '/admin/mailbox': 'placeholder.pages.mailSetup',
  '/domainadmin/mailbox': 'placeholder.pages.mailSetup',
  '/admin/system': 'placeholder.pages.configuration',
  '/admin/dashboard': 'placeholder.pages.information',
  '/admin/queue': 'placeholder.pages.queue',
  '/domainadmin/user': 'placeholder.pages.userSettings',
  '/user': 'placeholder.pages.userSettings',
  '/quarantine': 'placeholder.pages.quarantine',
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
