// What a user may do in the quarantine, spam policy and rate limit screens (UI 006 FR-002,
// data-model §2 "Abilities", research R7, SC-005): pure functions of the identity, so the matrix is
// testable as a table and components never read flags themselves. Hiding a control is a
// convenience: the API enforces scope with 404 and flags with 403 (constitution V). API 001 folds
// a domain administrator's implied flags into the identity, so only flags are read here.
import type { Identity, PermissionFlags } from '@/api'

/** A mailbox address. */
export type MailboxRef = string
export type OwnerKind = 'domain' | 'aliasDomain' | 'mailbox'

type Who = Pick<Identity, 'role' | 'username' | 'permissions'> | null | undefined

const isAdmin = (id: Who) => id?.role === 'admin'
const isDomainAdmin = (id: Who) => id?.role === 'domainAdmin'
const isMailboxUser = (id: Who) => id?.role === 'mailboxUser'
const flag = (id: Who, name: keyof PermissionFlags) => !!id?.permissions?.[name]
const own = (id: Who, mailbox: MailboxRef | null | undefined) =>
  !!mailbox && !!id?.username && id.username.toLowerCase() === mailbox.toLowerCase()

/** Deliver, learn as spam and remove, singly and in bulk. */
export const canActOnItems = (id: Who) => isAdmin(id) || flag(id, 'quarantine')

/** Attachment details and downloads. */
export const canSeeAttachments = (id: Who) =>
  isAdmin(id) || isDomainAdmin(id) || flag(id, 'quarantineAttachments')

/** "Download (.eml)". */
export const canDownloadMessage = (id: Who) =>
  isAdmin(id) ||
  (isDomainAdmin(id) && flag(id, 'quarantine')) ||
  (isMailboxUser(id) && flag(id, 'quarantine') && flag(id, 'quarantineAttachments'))

/** The notification frequency of a mailbox. */
export const canChangeFrequency = (id: Who, mailbox: MailboxRef) =>
  isAdmin(id) || isDomainAdmin(id) || (own(id, mailbox) && flag(id, 'quarantineNotification'))

/** The notification category of a mailbox. */
export const canChangeCategory = (id: Who, mailbox: MailboxRef) =>
  isAdmin(id) || isDomainAdmin(id) || (own(id, mailbox) && flag(id, 'quarantineCategory'))

/** The spam score of a mailbox. */
export const canChangeSpamScore = (id: Who, mailbox: MailboxRef) =>
  isAdmin(id) || isDomainAdmin(id) || (own(id, mailbox) && flag(id, 'spamScore'))

/** Reading the allow and block lists of an owner. */
export const canReadPolicy = (id: Who, kind: OwnerKind) =>
  isAdmin(id) || isDomainAdmin(id) || (isMailboxUser(id) && kind === 'mailbox')

/** Adding and removing allow and block list entries of an owner. */
export const canChangePolicy = (id: Who, kind: OwnerKind) =>
  isAdmin(id) ||
  (isDomainAdmin(id) && flag(id, 'spamPolicy')) ||
  (isMailboxUser(id) && kind === 'mailbox' && flag(id, 'spamPolicy'))

export const canReadRateLimits = (id: Who) => isAdmin(id) || isDomainAdmin(id)
export const canChangeRateLimits = (id: Who) =>
  isAdmin(id) || (isDomainAdmin(id) && flag(id, 'ratelimit'))
export const canResetBucket = (id: Who) => isAdmin(id)
export const canSeeSettings = (id: Who) => isAdmin(id)
export const canSeeStatistics = (id: Who) => isAdmin(id)
export const canSeeHistory = (id: Who) => isAdmin(id)

export type FlaggedAbility =
  | 'actOnItems'
  | 'seeAttachments'
  | 'downloadMessage'
  | 'changeFrequency'
  | 'changeCategory'
  | 'changeSpamScore'
  | 'changePolicy'
  | 'changeRateLimits'

/**
 * The flag whose absence denies an ability, for the "Prohibited by ACL" note; null when the role
 * or the scope denies it, or nothing does. For "Download (.eml)", `quarantine` is named first, as
 * the API names it.
 */
export function missingFlag(id: Who, ability: FlaggedAbility): keyof PermissionFlags | null {
  if (!id || isAdmin(id)) return null
  const lacks = (name: keyof PermissionFlags) => (flag(id, name) ? null : name)
  switch (ability) {
    case 'actOnItems':
      return lacks('quarantine')
    case 'seeAttachments':
      return isMailboxUser(id) ? lacks('quarantineAttachments') : null
    case 'downloadMessage':
      return lacks('quarantine') ?? (isMailboxUser(id) ? lacks('quarantineAttachments') : null)
    case 'changeFrequency':
      return isMailboxUser(id) ? lacks('quarantineNotification') : null
    case 'changeCategory':
      return isMailboxUser(id) ? lacks('quarantineCategory') : null
    case 'changeSpamScore':
      return isMailboxUser(id) ? lacks('spamScore') : null
    case 'changePolicy':
      return lacks('spamPolicy')
    case 'changeRateLimits':
      return isDomainAdmin(id) ? lacks('ratelimit') : null
  }
}
