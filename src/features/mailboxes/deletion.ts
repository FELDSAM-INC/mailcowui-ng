// What deleting a mailbox does, from the API's deletion preview (data-model §2 "DeletionImpact",
// FR-045): the mail moved to the garbage area with its retention period, the dependent records
// that are removed (non-zero counts only), the settings that exist, the aliases deleted with it and
// those that keep their other recipients, and the blockers while a store is unreachable.
import type { MailboxDeletionPreview } from './types'

export type CountKind = keyof MailboxDeletionPreview['counts']
export type PresentKind = keyof MailboxDeletionPreview['present']

/** The counts in the order the confirmation lists them. */
export const COUNT_ORDER: readonly CountKind[] = [
  'tags',
  'appPasswords',
  'passkeys',
  'secondFactors',
  'oauthGrants',
  'senderPermissionsGranted',
  'senderPermissionsHeld',
  'syncJobs',
  'sieveFilters',
  'spamFilterSettings',
  'quarantineItems',
  'bccMaps',
  'temporaryAliases',
  'recentLogins',
]

export const PRESENT_ORDER: readonly PresentKind[] = [
  'webmailData',
  'pushNotificationSettings',
  'rateLimit',
  'taggedMailHandling',
]

export interface Retention {
  value: number
  unit: 'day' | 'hour' | 'minute'
}

/** The retention period in the largest whole unit: days, hours or minutes. */
export function retentionOf(minutes: number): Retention {
  if (minutes > 0 && minutes % 1440 === 0) return { value: minutes / 1440, unit: 'day' }
  if (minutes > 0 && minutes % 60 === 0) return { value: minutes / 60, unit: 'hour' }
  return { value: minutes, unit: 'minute' }
}

export interface DeletionImpact {
  address: string
  /** The version the deletion is sent with (`If-Match`). */
  etag: string
  mail: MailboxDeletionPreview['mail']
  retention: Retention
  counts: { kind: CountKind; count: number }[]
  present: PresentKind[]
  exclusiveAliases: MailboxDeletionPreview['exclusiveAliases']
  sharedAliases: MailboxDeletionPreview['sharedAliases']
  blockers: MailboxDeletionPreview['blockers']
  canProceed: boolean
}

export function deletionImpact(preview: MailboxDeletionPreview): DeletionImpact {
  return {
    address: preview.address,
    etag: preview.etag,
    mail: preview.mail,
    retention: retentionOf(preview.garbageRetentionMinutes),
    counts: COUNT_ORDER.filter((kind) => preview.counts[kind] > 0).map((kind) => ({
      kind,
      count: preview.counts[kind],
    })),
    present: PRESENT_ORDER.filter((kind) => preview.present[kind] === true),
    exclusiveAliases: preview.exclusiveAliases,
    sharedAliases: preview.sharedAliases,
    blockers: preview.blockers,
    canProceed: preview.canProceed,
  }
}
