// Scenarios of the mailbox templates (UI 003 US7, T102): the list with Default, "Small", "Staff"
// and more for paging, a domain administrator who only reads them, a list that fails, and the
// groupware switched off (no SOGo access option).
import { GIB } from '../../factories/domain'
import { ALL_PROTOCOLS, defaultUserPermissions } from '../../factories/mailbox'
import { mockMailboxTemplate, smallMailboxTemplate } from '../../factories/mailbox-template'
import { assignDomains, scenarioTime } from '../domains-base'
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'

/** Default, "Small" (1 GiB, no POP3), "Staff" (every kind of value set) and 30 "Package" ones. */
export function setupMailboxTemplates(state: ScenarioState): void {
  state.mailboxTemplates.push(
    { ...smallMailboxTemplate(), createdAt: scenarioTime(3), modifiedAt: scenarioTime(5) },
    mockMailboxTemplate({
      id: 3,
      name: 'Staff',
      quota: 5 * GIB,
      tags: ['staff', 'office'],
      taggedMailHandling: 'subfolder',
      quarantineNotification: 'daily',
      quarantineCategory: 'all',
      tlsEnforceInbound: true,
      protocolAccess: { ...ALL_PROTOCOLS, pop3: false, activeSync: false },
      userPermissions: { ...defaultUserPermissions(), syncjobs: true, pushover: false },
      rateLimit: { value: 100, frame: 'hour' },
      forcePasswordChange: true,
      forceSecondFactorSetup: true,
      webmailRedirect: false,
      status: 'inactive',
      createdAt: scenarioTime(4),
    }),
    ...Array.from({ length: 30 }, (_, index) =>
      mockMailboxTemplate({
        id: 4 + index,
        name: `Package ${String(index + 1).padStart(2, '0')}`,
        quota: (index + 1) * GIB,
        createdAt: scenarioTime(6 + (index % 20)),
      }),
    ),
  )
}

export const mailboxTemplateScenarios: Record<string, ScenarioDefinition> = {
  'admin-templates': {
    description:
      'An administrator with the Default, "Small" and "Staff" mailbox templates and 30 more for paging (UI 003 US7).',
    setup: setupMailboxTemplates,
    overrides: { signedInAs: 'admin' },
  },
  'domain-admin-templates': {
    description:
      'A domain administrator without the sync jobs flag, who reads the mailbox templates only (UI 003 US7-AS7).',
    setup: (state) => {
      setupMailboxTemplates(state)
      assignDomains(state, 'reseller', ['a.example'])
      const reseller = state.accounts.find((account) => account.username === 'reseller')!
      reseller.permissions = { ...reseller.permissions, syncjobs: false }
    },
    overrides: { signedInAs: 'reseller' },
  },
  'mailbox-templates-list-error': {
    description: 'listMailboxTemplates answers its documented 500.',
    setup: setupMailboxTemplates,
    overrides: { signedInAs: 'admin', failures: { listMailboxTemplates: { status: 500 } } },
  },
  'capabilities-groupware-off-templates': {
    description: 'The mailbox templates with the groupware switched off: no SOGo access option.',
    setup: setupMailboxTemplates,
    overrides: { signedInAs: 'admin', mailboxCapabilities: { groupwareEnabled: false } },
  },
}
