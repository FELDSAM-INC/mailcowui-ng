// UI 004 US5 scenarios (T070): what anna@example.org may send as. The base world gives her
// sales@example.org (sending allowed), info@example.org (receive-only), the catch-all @example.org,
// anna@example.net through the alias domain, the explicit permissions @example.com, @other.example
// (outside the domain administrator's scope) and @deleted.example (stale), and two external sender
// addresses.
import { mockAlias } from '../factories/alias'
import { mailboxAddresses } from '../factories/domain'
import { mockMailbox, seedMailboxes } from '../factories/mailbox'
import { senderAclRows } from '../factories/sender-acl'
import { DOMAIN_ADMIN_004, MAILBOX_004, setupWorld004, syncUsage004 } from './feature-004-base'
import type { ScenarioDefinition } from './index'
import type { ScenarioState } from './state'

export const SENDER_004 = {
  mailbox: MAILBOX_004.anna,
  aliasDomainAddress: 'anna@example.net',
  allowedAlias: 'sales@example.org',
  receiveOnlyAlias: 'info@example.org',
  catchAll: '@example.org',
  explicitDomain: '@example.com',
  outsideScope: '@other.example',
  stale: '@deleted.example',
  external: ['@partner.example', 'news@mailer.example'],
  /** An external address in a domain of this server (US5-AS7). */
  localExternal: 'someone@example.net',
  /**
   * shared@example.com → erik, a grantable alias. A test makes it deliver to anna with sending
   * allowed after the candidates loaded (`changeElsewhere`), so granting it is not needed (FR-055).
   */
  notNeededAlias: 'shared@example.com',
  /** Matches of "sales" among the 5,000 candidates of `sender-settings-5000`. */
  salesCandidates: 60,
} as const

/**
 * The base world with its mailboxes also stored as UI 003 mailboxes, so that the mailbox page (where
 * "Allow to send as" lives, orchestrator 2026-10-19) opens for them.
 */
export function setupSenderWorld(state: ScenarioState): void {
  setupWorld004(state)
  const addresses = state.domains.flatMap((domain) => mailboxAddresses(domain))
  seedMailboxes(
    state,
    addresses
      .filter((address) => !state.mailboxes.some((m) => `${m.localPart}@${m.domain}` === address))
      .map((address) => {
        const [localPart, domain] = address.split('@') as [string, string]
        return mockMailbox({ localPart, domain, displayName: localPart, quota: 1024 * 1024 * 1024 })
      }),
  )
}

function anyAddress(state: ScenarioState): void {
  setupSenderWorld(state)
  state.senderAcl = [
    ...state.senderAcl.filter((row) => row.mailbox !== MAILBOX_004.anna || row.external),
    ...senderAclRows(MAILBOX_004.anna, ['*']),
  ]
}

function setFlag(extendSenderAcl: boolean) {
  return (state: ScenarioState) => {
    setupSenderWorld(state)
    const account = state.accounts.find((item) => item.username === DOMAIN_ADMIN_004)!
    account.permissions = { ...account.permissions, extendSenderAcl }
  }
}

export const senderSettingsScenarios: Record<string, ScenarioDefinition> = {
  'sender-settings': {
    description:
      'An administrator; anna@example.org with every kind of implicit and explicit sender address (SENDER_004) (UI 004 US5).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => setupSenderWorld(state),
  },
  'sender-settings-da': {
    description:
      'The domain administrator of example.org and example.com without extendSenderAcl: @other.example is not changeable (US5-AS4, AS6).',
    overrides: { signedInAs: DOMAIN_ADMIN_004 },
    setup: setFlag(false),
  },
  'sender-settings-da-extend': {
    description: 'The domain administrator with extendSenderAcl.',
    overrides: { signedInAs: DOMAIN_ADMIN_004 },
    setup: setFlag(true),
  },
  'sender-settings-any': {
    description:
      'An administrator; anna@example.org may send as any address (sender check disabled).',
    overrides: { signedInAs: 'admin' },
    setup: anyAddress,
  },
  'sender-settings-any-da': {
    description:
      'The domain administrator; an administrator let anna@example.org send as any address (edge case).',
    overrides: { signedInAs: DOMAIN_ADMIN_004 },
    setup: anyAddress,
  },
  'sender-settings-5000': {
    description:
      'An administrator with 5,000 grantable aliases in example.com, 60 of them matching "sales" (US5-AS9).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => {
      setupSenderWorld(state)
      const first = Math.max(...state.aliases.map((alias) => alias.id)) + 1
      state.aliases.push(
        ...Array.from({ length: 5000 }, (_, index) => {
          const number = String(index + 1).padStart(4, '0')
          const local = index < SENDER_004.salesCandidates ? `sales${number}` : `box${number}`
          return mockAlias({
            id: first + index,
            address: `${local}@example.com`,
            destinations: [MAILBOX_004.erik],
          })
        }),
      )
      state.lastAliasId = first + 4999
      state.domains.find((domain) => domain.name === 'example.com')!.maxAliases = 10_000
      syncUsage004(state)
    },
  },
}
