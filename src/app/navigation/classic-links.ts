// Same-host addresses of the classic interface (research R19, spec Assumptions). They are mailcow
// paths, not brand data. Classic tabs cannot be deep-linked, so links point to pages.
import type { Role } from '@/api'
import { legacy, type LegacyRef } from '@/i18n'

/** The classic sign-in page per role (FR-007, FR-008, FR-040). */
export const CLASSIC_SIGN_IN: Readonly<Record<Role, string>> = {
  admin: '/admin',
  domainAdmin: '/domainadmin',
  mailboxUser: '/',
}

/**
 * The names of the classic pages that placeholders link to (FR-044): the entries of the classic
 * menu (`base.twig`), with the menu they sit in where the entry's name alone is ambiguous ("E-Mail"
 * › "Configuration", "System" › "Configuration"). Classic tabs cannot be deep-linked, so the links
 * open these pages (plan parity note 1).
 */
export const CLASSIC_PAGE_LABELS: Readonly<Record<string, readonly LegacyRef[]>> = {
  '/admin/mailbox': [legacy('header.email'), legacy('header.mailcow_config')],
  '/domainadmin/mailbox': [legacy('header.email'), legacy('header.mailcow_config')],
  '/admin/system': [legacy('header.mailcow_system'), legacy('header.mailcow_config')],
  '/admin/dashboard': [legacy('header.mailcow_system'), legacy('header.debug')],
  '/admin/queue': [legacy('header.email'), legacy('queue.queue_manager')],
  '/domainadmin/user': [legacy('header.user_settings')],
  '/user': [legacy('header.user_settings')],
  '/quarantine': [legacy('header.quarantine')],
}

/**
 * The classic sign-in page for a role. The role-neutral screens and the force-SSO notice use the
 * mailbox-user page, where the classic single sign-on button lives (FR-007).
 */
export function classicSignIn(role: Role | null): string {
  return role ? CLASSIC_SIGN_IN[role] : CLASSIC_SIGN_IN.mailboxUser
}
