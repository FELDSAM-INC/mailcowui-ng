// Mailbox deletion (UI 003 T079, research R20): `previewMailboxDeletion` with the seeded counts, up
// to 100 alias addresses, the `present` flags, blockers (`canProceed: false`) while the mail store
// or the shared store is down, and the version tag; `deleteMailbox` with `If-Match` and 412, the
// injected 503 `temporary-failure` and 504 `outcome-unknown`, 404, and on success the removal from
// the lists with the domain's usage updated. Every injected 503 carries `Retry-After`.
import type { MailboxDeletionPreview } from '@/api'

import { addressOf, mailboxEtag, syncDomainUsage } from '../factories/mailbox'
import type { MockMailbox, ScenarioState } from '../scenarios/state'
import { csrfProblem, http, scenario } from './context'
import { notFound, outdated, requireManager } from './domain-rules'
import { findMailbox, mailboxFailure } from './mailbox-rules'

const SAMPLE = 100

const ZERO_COUNTS: MailboxDeletionPreview['counts'] = {
  appPasswords: 0,
  bccMaps: 0,
  oauthGrants: 0,
  passkeys: 0,
  quarantineItems: 0,
  recentLogins: 0,
  secondFactors: 0,
  senderPermissionsGranted: 0,
  senderPermissionsHeld: 0,
  sieveFilters: 0,
  spamFilterSettings: 0,
  syncJobs: 0,
  tags: 0,
  temporaryAliases: 0,
}

const sample = (addresses: readonly string[] = []) => ({
  addresses: addresses.slice(0, SAMPLE),
  count: addresses.length,
})

/** The blockers named by a failure injected for the preview (`dependency` in its extra members). */
function blockers(state: ScenarioState, mailbox: MockMailbox): MailboxDeletionPreview['blockers'] {
  const failure = state.mailboxFailures[`preview:${addressOf(mailbox)}`]
  if (!failure || (failure.times !== undefined && failure.times <= 0)) return []
  if (failure.times !== undefined) failure.times -= 1
  const dependency = failure.extra?.dependency === 'sharedStore' ? 'sharedStore' : 'mailStore'
  return [{ dependency, detail: `${dependency} unreachable` }]
}

export function deletionPreview(
  state: ScenarioState,
  mailbox: MockMailbox,
): MailboxDeletionPreview {
  const blocked = blockers(state, mailbox)
  const sharedDown = blocked.some((blocker) => blocker.dependency === 'sharedStore')
  return {
    address: addressOf(mailbox),
    blockers: blocked,
    canProceed: blocked.length === 0,
    counts: { ...ZERO_COUNTS, tags: mailbox.tags.length, ...mailbox.dependents },
    etag: mailboxEtag(mailbox),
    exclusiveAliases: sample(mailbox.exclusiveAliases),
    garbageRetentionMinutes: state.mailboxCapabilities.garbageRetentionMinutes,
    mail: { messageCount: mailbox.messageCount, storageUsed: mailbox.quotaUsed },
    present: {
      pushNotificationSettings: mailbox.present?.pushNotificationSettings ?? false,
      rateLimit: sharedDown ? null : (mailbox.present?.rateLimit ?? mailbox.rateLimit !== null),
      taggedMailHandling: sharedDown
        ? null
        : (mailbox.present?.taggedMailHandling ?? mailbox.taggedMailHandling !== 'none'),
      webmailData: mailbox.present?.webmailData ?? false,
    },
    sharedAliases: sample(mailbox.sharedAliases),
  }
}

export const mailboxDeletionHandlers = [
  http.get('/mailboxes/{mailbox}/deletion-preview', ({ params, response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const mailbox = findMailbox(state, account, params.mailbox)
    if (!mailbox) return response.untyped(notFound())
    const failure = mailboxFailure(state, addressOf(mailbox), 'previewMailboxDeletion')
    if (failure) return response.untyped(failure)
    return response(200).json({ data: deletionPreview(state, mailbox) })
  }),

  http.delete('/mailboxes/{mailbox}', ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const mailbox = findMailbox(state, account, params.mailbox)
    if (!mailbox) return response.untyped(notFound())
    const ifMatch = request.headers.get('if-match')
    if (ifMatch !== null && ifMatch !== '*' && ifMatch !== mailboxEtag(mailbox)) {
      return response.untyped(outdated())
    }
    const failure = mailboxFailure(state, addressOf(mailbox), 'deleteMailbox')
    if (failure) return response.untyped(failure)
    state.mailboxes = state.mailboxes.filter((item) => item !== mailbox)
    syncDomainUsage(state, mailbox.domain)
    return response(204).empty()
  }),
]
