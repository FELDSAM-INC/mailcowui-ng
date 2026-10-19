// The section registry of My account and of the mailbox context (UI 005 data-model §2, research R4,
// R5; legacy form map decision D1): one ordered list of sections in the order of the classic user
// page (General tab, then the Settings, Spam aliases, App passwords and Pushover tabs), with two
// pure rules. `ownVisibility` decides per role, permission flag and self-service capability whether
// a section of My account is shown, replaced by the externally-managed notice, hidden ("no access")
// or unknown (the capabilities cannot be read). `mailboxAccess` decides whether an administrator or
// a domain administrator may change a mailbox's section, may only read it, or does not see it.
import type { Identity, PermissionFlags, SelfServiceCapabilities } from '@/api'
import { legacy, type LegacyKey, type TextRef } from '@/i18n'

export type AccountSectionId =
  | 'mailApps'
  | 'activeScript'
  | 'password'
  | 'recoveryEmail'
  | 'twoFactor'
  | 'passkeys'
  | 'recentLogins'
  | 'mailSettings'
  | 'temporaryAliases'
  | 'appPasswords'
  | 'pushNotifications'
  | 'filters'

export type OwnVisibility = 'visible' | 'hidden' | 'replaced' | 'unknown'

export type MailboxAccess =
  { mode: 'change' } | { mode: 'readOnly'; flag: keyof PermissionFlags } | { mode: 'hidden' }

/** The parts of a section that have their own flag (the Settings tab, decision D1). */
export type SectionPart = 'taggedMail' | 'tlsPolicy' | 'easReset' | 'sogoProfileReset'

export interface AccountSection {
  id: AccountSectionId
  /** The section's title: legacy's tab, modal or legend name, or a new string. */
  title: TextRef
  /** The route of My account, if the section has one there. */
  route: string | null
  /** The route of the mailbox context, if the section has one there. */
  mailboxRoute: string | null
  /** The classic text shown in place of the section to roles that may not use it. */
  noAccessReason?: LegacyKey
}

type Caps = SelfServiceCapabilities | null | undefined
type Flags = Partial<PermissionFlags>

const flag = (identity: Identity, name: keyof PermissionFlags) =>
  (identity.permissions as Flags)[name] === true

/** The ordered registry. */
export const ACCOUNT_SECTIONS: readonly AccountSection[] = [
  {
    id: 'mailApps',
    title: 'account.sections.mailApps',
    route: 'account-mail-apps',
    mailboxRoute: null,
    noAccessReason: 'login.mobileconfig_info',
  },
  {
    id: 'activeScript',
    title: legacy('user.active_sieve'),
    route: 'account-filters',
    mailboxRoute: null,
  },
  {
    id: 'password',
    title: legacy('user.change_password'),
    route: 'account-password',
    mailboxRoute: null,
  },
  {
    id: 'recoveryEmail',
    title: legacy('user.pw_recovery_email'),
    route: 'account-recovery-email',
    mailboxRoute: null,
  },
  { id: 'twoFactor', title: legacy('tfa.tfa'), route: 'account-two-factor', mailboxRoute: null },
  { id: 'passkeys', title: 'passkeys.title', route: 'passkeys', mailboxRoute: null },
  {
    id: 'recentLogins',
    title: legacy('user.recent_successful_connections'),
    route: 'account-recent-logins',
    mailboxRoute: 'mailbox-recent-logins',
  },
  {
    id: 'mailSettings',
    title: legacy('user.mailbox_settings'),
    route: 'account-mail-settings',
    mailboxRoute: 'mailbox-mail-settings',
  },
  {
    id: 'temporaryAliases',
    title: legacy('user.spam_aliases'),
    route: 'account-temporary-aliases',
    mailboxRoute: 'mailbox-temporary-aliases',
  },
  {
    id: 'appPasswords',
    title: legacy('user.app_passwds'),
    route: 'account-app-passwords',
    mailboxRoute: 'mailbox-app-passwords',
  },
  {
    id: 'pushNotifications',
    title: legacy('edit.pushover'),
    route: 'account-push-notifications',
    mailboxRoute: 'mailbox-push-notifications',
  },
  { id: 'filters', title: legacy('mailbox.filters'), route: null, mailboxRoute: 'mailbox-filters' },
]

export function findSection(id: AccountSectionId): AccountSection {
  const section = ACCOUNT_SECTIONS.find((item) => item.id === id)
  if (!section) throw new Error(`Unknown account section ${id}`)
  return section
}

/** The parts of the Settings section a mailbox user may change in My account. */
export function ownSettingsParts(identity: Identity, caps: Caps): SectionPart[] {
  const parts: SectionPart[] = []
  if (flag(identity, 'delimiterAction')) parts.push('taggedMail')
  if (flag(identity, 'tlsPolicy')) parts.push('tlsPolicy')
  if (caps?.groupware?.enabled) {
    if (flag(identity, 'easReset')) parts.push('easReset')
    if (flag(identity, 'sogoProfileReset')) parts.push('sogoProfileReset')
  }
  return parts
}

/**
 * Whether a section of My account is shown (FR-002). Administrators and domain administrators have
 * the password, second factors and passkeys only; mailbox users see each section with its flag.
 * `replaced` is the password section of an externally managed mailbox; `unknown` a rule that needs
 * the capabilities when they could not be read.
 */
export function ownVisibility(
  id: AccountSectionId,
  identity: Identity | null | undefined,
  caps: Caps,
): OwnVisibility {
  if (!identity) return 'hidden'
  const account = caps?.account
  if (identity.role !== 'mailboxUser') {
    if (id === 'passkeys') return 'visible'
    if (id === 'password' || id === 'twoFactor') {
      if (!account) return 'unknown'
      return id === 'password'
        ? account.passwordChangeAvailable
          ? 'visible'
          : 'replaced'
        : account.secondFactorManagementAvailable
          ? 'visible'
          : 'hidden'
    }
    return 'hidden'
  }
  switch (id) {
    case 'passkeys':
    case 'recentLogins':
    case 'mailApps':
    case 'activeScript':
      return 'visible'
    case 'password':
      if (!account) return 'unknown'
      return account.passwordChangeAvailable ? 'visible' : 'replaced'
    case 'recoveryEmail':
      if (!flag(identity, 'pwReset')) return 'hidden'
      if (!account) return 'unknown'
      return account.passwordChangeAvailable ? 'visible' : 'hidden'
    case 'twoFactor':
      if (!account) return 'unknown'
      return account.secondFactorManagementAvailable ? 'visible' : 'hidden'
    case 'mailSettings': {
      if (flag(identity, 'delimiterAction') || flag(identity, 'tlsPolicy')) return 'visible'
      const resets = flag(identity, 'easReset') || flag(identity, 'sogoProfileReset')
      if (!resets) return 'hidden'
      if (!caps?.groupware) return 'unknown'
      return caps.groupware.enabled ? 'visible' : 'hidden'
    }
    case 'temporaryAliases':
      return flag(identity, 'spamAlias') ? 'visible' : 'hidden'
    case 'appPasswords':
      return flag(identity, 'appPasswds') ? 'visible' : 'hidden'
    case 'pushNotifications':
      return flag(identity, 'pushover') ? 'visible' : 'hidden'
    case 'filters':
      return 'hidden'
  }
}

/** The domain administrator's own flag a mailbox-context change needs (FR-004). */
const DOMAIN_ADMIN_FLAGS: Partial<Record<AccountSectionId, keyof PermissionFlags>> = {
  appPasswords: 'appPasswds',
  pushNotifications: 'pushover',
  filters: 'filters',
}

/**
 * What an administrator or a domain administrator may do with a mailbox's section (FR-003,
 * FR-004). Administrators change everything; domain administrators need their own flag for app
 * passwords, Pushover and filters (read-only without it). Mailbox users have no mailbox context.
 */
export function mailboxAccess(
  id: AccountSectionId,
  identity: Identity | null | undefined,
): MailboxAccess {
  const section = ACCOUNT_SECTIONS.find((item) => item.id === id)
  if (!identity || !section?.mailboxRoute || identity.role === 'mailboxUser') {
    return { mode: 'hidden' }
  }
  if (identity.role === 'admin') return { mode: 'change' }
  const needed = DOMAIN_ADMIN_FLAGS[id]
  if (needed && !flag(identity, needed)) return { mode: 'readOnly', flag: needed }
  return { mode: 'change' }
}

/** The parts of the Settings section in the mailbox context: the resets only with the groupware. */
export function mailboxSettingsParts(caps: Caps): SectionPart[] {
  const parts: SectionPart[] = ['taggedMail', 'tlsPolicy']
  if (caps?.groupware?.enabled) parts.push('easReset', 'sogoProfileReset')
  return parts
}
