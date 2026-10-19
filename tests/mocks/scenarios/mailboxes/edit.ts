// Scenarios of the mailbox page (UI 003 US1 detail, US3, US5; T049, T070, T086): an administrator
// with mailboxes of every kind, and domain administrators lacking flags. The `updateMailbox`
// behaviour and the "changed elsewhere" control changes come from the mock base (T011).
import { GIB, MIB, mockDomain } from '../../factories/domain'
import { mockMailbox, seedMailboxes } from '../../factories/mailbox'
import { permissionFlags } from '../accounts'
import { assignDomains } from '../domains-base'
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'

/** a.example (10 GiB per mailbox, 20 GiB in all) and the IDN bücher.example. */
export function setupMailboxPage(state: ScenarioState): void {
  state.domains.push(
    mockDomain({
      name: 'a.example',
      maxMailboxes: 50,
      domainQuota: 20 * GIB,
      maxMailboxQuota: 10 * GIB,
    }),
    mockDomain({
      name: 'bücher.example',
      maxMailboxes: 50,
      domainQuota: 20 * GIB,
      maxMailboxQuota: 10 * GIB,
    }),
    mockDomain({
      name: 'b.example',
      maxMailboxes: 50,
      domainQuota: 20 * GIB,
      maxMailboxQuota: 10 * GIB,
    }),
  )
  state.passwordPolicy = { ...state.passwordPolicy, minLength: 10, requireDigits: true }
  state.mailboxCapabilities = {
    ...state.mailboxCapabilities,
    identityProviderType: 'ldap',
    authSources: ['mailcow', 'ldap'],
  }
  seedMailboxes(state, [
    mockMailbox({
      localPart: 'anna',
      domain: 'a.example',
      displayName: 'Anna Smith',
      quota: 2 * GIB,
      quotaUsed: 1536 * MIB,
      messageCount: 10_000,
      tags: ['Sales'],
      customAttributes: { old: '1' },
      recoveryEmail: 'anna.private@b.example',
      lastLogins: {
        imap: '2026-10-17T08:00:00Z',
        pop3: null,
        smtp: '2026-10-16T09:30:00Z',
        webmailSso: null,
      },
      relayhostId: 2,
    }),
    mockMailbox({
      localPart: 'dana',
      domain: 'a.example',
      displayName: 'Dana LDAP',
      authSource: 'ldap',
      hasPassword: false,
      quota: GIB,
    }),
    mockMailbox({
      localPart: 'carl',
      domain: 'a.example',
      displayName: 'Carl',
      quota: 0,
      status: 'inactive',
    }),
    mockMailbox({ localPart: 'dora', domain: 'bücher.example', displayName: 'Dora', quota: GIB }),
    mockMailbox({ localPart: 'eve', domain: 'b.example', displayName: 'Eve', quota: GIB }),
  ])
}

export const mailboxEditScenarios: Record<string, ScenarioDefinition> = {
  'admin-edit': {
    description:
      'An administrator with mailboxes of every kind in a.example, bücher.example and b.example (UI 003 US1, US3, US5).',
    overrides: { signedInAs: 'admin' },
    setup: setupMailboxPage,
  },
  'domain-admin-edit': {
    description: 'A domain administrator of a.example with every flag (UI 003 US1-AS8, US3).',
    setup: (state) => {
      setupMailboxPage(state)
      assignDomains(state, 'reseller', ['a.example'])
    },
    overrides: { signedInAs: 'reseller' },
  },
  'domain-admin-edit-limited': {
    description:
      'A domain administrator of a.example without protocol access, SOGo access, unlimited quota, sync jobs and mailbox relayhosts (UI 003 US3-AS5, FR-041, FR-042).',
    setup: (state) => {
      setupMailboxPage(state)
      assignDomains(state, 'reseller', ['a.example'])
      const reseller = state.accounts.find((account) => account.username === 'reseller')!
      reseller.permissions = permissionFlags(true, {
        protocolAccess: false,
        sogoAccess: false,
        unlimitedQuota: false,
        syncjobs: false,
        mailboxRelayhost: false,
        bccMaps: false,
        loginAs: false,
      })
    },
    overrides: { signedInAs: 'reseller' },
  },
}
