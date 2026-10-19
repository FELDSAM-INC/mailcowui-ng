// Scenarios of the add mailbox form (UI 003 US2, T061): example.org with room (5 GiB per mailbox),
// where anna@example.org is an alias; a full domain; a domain without quota left; the Default and
// "Small" templates; a domain administrator without the unlimited quota and protocol flags; a
// strict password policy; and failed follow-up steps in the creation report.
import { GIB, mockDomain } from '../../factories/domain'
import { mockMailbox, seedMailboxes } from '../../factories/mailbox'
import { smallMailboxTemplate } from '../../factories/mailbox-template'
import { permissionFlags } from '../accounts'
import { assignDomains } from '../domains-base'
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'

export function setupMailboxCreate(state: ScenarioState): void {
  state.domains.push(
    mockDomain({
      name: 'example.org',
      maxMailboxes: 10,
      maxMailboxQuota: 5 * GIB,
      domainQuota: 50 * GIB,
      aliasAddresses: ['anna@example.org'],
    }),
    mockDomain({
      name: 'full.example',
      maxMailboxes: 1,
      maxMailboxQuota: GIB,
      domainQuota: 5 * GIB,
    }),
    mockDomain({
      name: 'nospace.example',
      maxMailboxes: 10,
      maxMailboxQuota: GIB,
      domainQuota: GIB,
    }),
  )
  const example = state.domains.find((domain) => domain.name === 'example.org')!
  example.usage.aliases = 1
  state.mailboxTemplates.push(smallMailboxTemplate())
  seedMailboxes(state, [
    mockMailbox({ localPart: 'only', domain: 'full.example', quota: GIB }),
    mockMailbox({ localPart: 'big', domain: 'nospace.example', quota: GIB }),
  ])
}

export const mailboxCreateScenarios: Record<string, ScenarioDefinition> = {
  'admin-create': {
    description:
      'An administrator adding mailboxes to example.org (5 GiB each, anna@example.org is an alias), full.example (full) and nospace.example (no quota left) (UI 003 US2).',
    overrides: { signedInAs: 'admin' },
    setup: setupMailboxCreate,
  },
  'domain-admin-create-limited': {
    description:
      'A domain administrator of example.org and nospace.example without unlimited quota and protocol access (UI 003 US2-AS5, US2-AS9).',
    overrides: { signedInAs: 'reseller' },
    setup: (state) => {
      setupMailboxCreate(state)
      assignDomains(state, 'reseller', ['example.org', 'nospace.example'])
      const reseller = state.accounts.find((account) => account.username === 'reseller')!
      reseller.permissions = permissionFlags(true, { unlimitedQuota: false, protocolAccess: false })
    },
  },
  'password-policy-strict': {
    description:
      'The add mailbox form with a password policy of 10 characters and digits (UI 003 US2-AS4).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => {
      setupMailboxCreate(state)
      state.passwordPolicy = { ...state.passwordPolicy, minLength: 10, requireDigits: true }
    },
  },
  'create-report-failures': {
    description: 'Mailboxes are created, but the rate limit step fails (UI 003 creation report).',
    overrides: { signedInAs: 'admin', mailboxCreationReport: { rateLimit: 'failed' } },
    setup: setupMailboxCreate,
  },
}
