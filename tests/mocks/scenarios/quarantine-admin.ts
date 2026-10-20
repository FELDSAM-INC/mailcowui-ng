// UI 006 scenarios of the notification settings, the quarantine settings, the spam filter
// statistics and the History records (US3, US7, US8, US9; T070, T107, T116, T122). They build on
// `setupQuarantineWorld` (UI 004's world, the quarantine active with 20 items and 15 MiB, alice with
// all six flags, the domain administrator "reseller" of example.org and example.com). Notification
// values live on the mailboxes (`quarantineNotification`, `quarantineCategory`; alice: hourly and
// rejected), so UI 003's mailbox reads show every change.
import type { PermissionFlags } from '@/api'

import { GIB, mockDomain } from '../factories/domain'
import { mockMailbox, seedMailboxes } from '../factories/mailbox'
import { quarantineAuditEvents } from '../factories/quarantine-audit'
import {
  activeQuarantineSettings,
  customQuarantineSettings,
  freshQuarantineSettings,
} from '../factories/quarantine-settings'
import { spamStatistics, zeroSpamStatistics } from '../factories/spam-statistics'
import { assignDomains } from './domains-base'
import type { ScenarioDefinition } from './index'
import { ALICE, QUARANTINE_DOMAIN_ADMIN, setupQuarantineWorld } from './quarantine'
import type { ScenarioState } from './state'

/** The domain of the 29 mailboxes of the bulk scenario, and the one that leaves the scope. */
export const NOTIFY_DOMAIN = 'notify.example'
export const LEAVING_DOMAIN = 'leaving.example'
/** `n01@notify.example` … `n29@notify.example`, then `n30@leaving.example`. */
export const notifyMailbox = (n: number) =>
  `n${String(n).padStart(2, '0')}@${n === 30 ? LEAVING_DOMAIN : NOTIFY_DOMAIN}`

/** A stored excluded domain that no longer exists. */
export const STALE_DOMAIN = 'gone.example'

const asAlice = { signedInAs: ALICE }
const asAdmin = { signedInAs: 'admin' }

const aliceWithout = (flags: (keyof PermissionFlags)[]) =>
  Object.fromEntries(flags.map((flag) => [flag, false])) as Partial<PermissionFlags>

/** 29 mailboxes in notify.example and one in leaving.example, managed by "reseller" alone. */
function setupNotifyMailboxes(state: ScenarioState): void {
  state.domains.push(
    mockDomain({ name: NOTIFY_DOMAIN, maxMailboxes: 100, domainQuota: 100 * GIB }),
    mockDomain({ name: LEAVING_DOMAIN, maxMailboxes: 10, domainQuota: 10 * GIB }),
  )
  seedMailboxes(
    state,
    Array.from({ length: 30 }, (_, index) => {
      const [localPart, domain] = notifyMailbox(index + 1).split('@') as [string, string]
      return mockMailbox({ localPart, domain, displayName: `Notify ${index + 1}`, quota: GIB })
    }),
  )
  assignDomains(state, QUARANTINE_DOMAIN_ADMIN, [NOTIFY_DOMAIN, LEAVING_DOMAIN])
}

export const quarantineAdminScenarios: Record<string, ScenarioDefinition> = {
  // US3: notifications
  'notifications-user-all-flags': {
    description:
      'alice@example.org with both notification flags; frequency hourly, category rejected (US3-AS1).',
    overrides: asAlice,
    setup: (state) => setupQuarantineWorld(state),
  },
  'notifications-user-no-category': {
    description: 'alice without "Change quarantine notification category" (US3-AS2).',
    overrides: asAlice,
    setup: (state) =>
      setupQuarantineWorld(state, { aliceFlags: aliceWithout(['quarantineCategory']) }),
  },
  'notifications-user-none': {
    description: 'alice without either notification flag: both values read-only.',
    overrides: asAlice,
    setup: (state) =>
      setupQuarantineWorld(state, {
        aliceFlags: aliceWithout(['quarantineNotification', 'quarantineCategory']),
      }),
  },
  'notifications-no-category-stored': {
    description: 'alice whose mailbox has no stored category: no option is selected (US3-AS3).',
    overrides: asAlice,
    setup: (state) => {
      setupQuarantineWorld(state)
      state.quarantine.noCategory = [ALICE]
    },
  },
  'notifications-admin': {
    description:
      "The administrator in the quarantine world: alice's mailbox page edits her notifications in the Mailbox section (D9).",
    overrides: asAdmin,
    setup: (state) => setupQuarantineWorld(state),
  },
  'notifications-domain-admin': {
    description:
      'The domain administrator "reseller" of example.org and example.com in the quarantine world (D9).',
    overrides: { signedInAs: QUARANTINE_DOMAIN_ADMIN },
    setup: (state) => setupQuarantineWorld(state),
  },
  'notifications-domain-admin-bulk': {
    description:
      'The domain administrator "reseller" of notify.example (n01-n29) and leaving.example (n30) only; a test drops leaving.example from the scope to make n30 "not found" (US3-AS4).',
    overrides: { signedInAs: QUARANTINE_DOMAIN_ADMIN },
    setup: (state) => {
      setupQuarantineWorld(state)
      setupNotifyMailboxes(state)
    },
  },
  'notifications-admin-bulk': {
    description: 'The administrator with the 30 mailboxes of notify.example and leaving.example.',
    overrides: asAdmin,
    setup: (state) => {
      setupQuarantineWorld(state)
      setupNotifyMailboxes(state)
    },
  },

  // US7: settings
  'quarantine-settings-fresh': {
    description:
      'The administrator on a server where nothing was saved: inactive, maximum age 365, unmodified original, quarantine@localhost, the default subject and template (US7-AS1).',
    overrides: asAdmin,
    setup: (state) => {
      setupQuarantineWorld(state)
      state.quarantine.settings = freshQuarantineSettings()
    },
  },
  'quarantine-settings-active': {
    description:
      'The administrator with the seeded settings: retention 20, 15 MiB, the rest unset.',
    overrides: asAdmin,
    setup: (state) => {
      setupQuarantineWorld(state)
      state.quarantine.settings = activeQuarantineSettings()
    },
  },
  'quarantine-settings-custom': {
    description:
      'The administrator with custom values everywhere: a template with `<img src=x onerror=alert(1)>`, copy and redirect recipients, excluded example.com and example.net (US7-AS6).',
    overrides: asAdmin,
    setup: (state) => {
      setupQuarantineWorld(state)
      state.quarantine.settings = customQuarantineSettings()
    },
  },
  'quarantine-settings-stale-domain': {
    description:
      'The administrator with the excluded domains example.com and gone.example, which no longer exists (US7-AS4).',
    overrides: asAdmin,
    setup: (state) => {
      setupQuarantineWorld(state)
      state.quarantine.settings = {
        ...activeQuarantineSettings(),
        excludedDomains: ['example.com', STALE_DOMAIN],
      }
    },
  },

  // US8: statistics
  'spam-statistics': {
    description:
      'The administrator with 120 rejected, 30 soft-rejected, 0 rewritten, 250 junk and 600 without action, counted since 2026-09-01 (US8-AS1).',
    overrides: asAdmin,
    setup: (state) => {
      setupQuarantineWorld(state)
      state.quarantine.statistics = spamStatistics()
    },
  },
  'spam-statistics-zero': {
    description: 'The administrator with every count 0 and the counting period unknown.',
    overrides: asAdmin,
    setup: (state) => {
      setupQuarantineWorld(state)
      state.quarantine.statistics = zeroSpamStatistics()
    },
  },
  'spam-statistics-unavailable': {
    description: 'The administrator while the spam filter cannot be reached: 503 (US8-AS2).',
    overrides: asAdmin,
    setup: (state) => {
      setupQuarantineWorld(state)
      state.quarantine.statistics = 'unavailable'
    },
  },

  // US9: History
  'quarantine-audit': {
    description:
      'The administrator in the quarantine world with records of the 12 event types of API 006: a release with steps and a right-to-left override in its recipient, two deletions of one bulk request, settings with the template sizes, entries recorded on their owner, rate limits, a bucket reset and refusals (US9).',
    overrides: asAdmin,
    setup: (state) => {
      setupQuarantineWorld(state)
      state.auditEvents = quarantineAuditEvents()
    },
  },
  'quarantine-audit-domain-admin': {
    description:
      'The domain administrator in the quarantine world with the records of US9 (US9-AS3).',
    overrides: { signedInAs: QUARANTINE_DOMAIN_ADMIN },
    setup: (state) => {
      setupQuarantineWorld(state)
      state.auditEvents = quarantineAuditEvents()
    },
  },
}
