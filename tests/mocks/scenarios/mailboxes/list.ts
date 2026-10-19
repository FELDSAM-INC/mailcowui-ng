// Scenarios of the mailbox list (UI 003 US1, T049): 30 mailboxes of every kind in a.example,
// b.example and the IDN bücher.example; a domain administrator of a.example; a mailbox user; a
// search without matches; a failing list; and capabilities without last logins or the groupware.
import { GIB, MIB, mockDomain } from '../../factories/domain'
import { mockMailbox, seedMailboxes } from '../../factories/mailbox'
import { assignDomains } from '../domains-base'
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'

export const LONG_NAME = 'N'.repeat(255)
export const LONG_TAG = 'T'.repeat(255)
export const MARKUP_NAME = '<b>Bold</b>'
export const MARKUP_TAG = '<img src=x onerror=alert(1)>'

/** The 30 mailboxes of US1: "anna" matches three of them (address, display name, tag). */
export function setupMailboxList(state: ScenarioState): void {
  for (const name of ['a.example', 'b.example', 'bücher.example']) {
    state.domains.push(
      mockDomain({ name, maxMailboxes: 100, domainQuota: 200 * GIB, maxMailboxQuota: 10 * GIB }),
    )
  }
  state.mailboxCapabilities = {
    ...state.mailboxCapabilities,
    identityProviderType: 'ldap',
    authSources: ['mailcow', 'ldap'],
  }
  const special = [
    mockMailbox({
      localPart: 'anna',
      domain: 'a.example',
      displayName: 'Anna Smith',
      quota: 2 * GIB,
      quotaUsed: 512 * MIB,
      messageCount: 1200,
      lastLogins: {
        imap: '2026-10-17T08:00:00Z',
        pop3: null,
        smtp: '2026-10-16T09:00:00Z',
        webmailSso: null,
      },
    }),
    mockMailbox({
      localPart: 'bob',
      domain: 'a.example',
      displayName: 'Joanna Bob',
      quota: 1000 * MIB,
      quotaUsed: 920 * MIB,
      messageCount: 40,
    }),
    mockMailbox({
      localPart: 'carl',
      domain: 'a.example',
      displayName: 'Carl',
      tags: ['Annapolis'],
      quota: GIB,
    }),
    mockMailbox({ localPart: 'dora', domain: 'a.example', displayName: 'Dora', quota: 0 }),
    mockMailbox({ localPart: 'emil', domain: 'a.example', displayName: 'Emil', quota: 0 }),
    mockMailbox({ localPart: 'fred', domain: 'b.example', displayName: 'Fred', quota: 0 }),
    mockMailbox({
      localPart: 'gina',
      domain: 'a.example',
      displayName: 'Gina',
      status: 'inactive',
      quota: GIB,
    }),
    mockMailbox({
      localPart: 'hugo',
      domain: 'a.example',
      displayName: 'Hugo',
      status: 'loginDisabled',
      quota: GIB,
    }),
    mockMailbox({
      localPart: 'ivan',
      domain: 'b.example',
      displayName: 'Ivan LDAP',
      authSource: 'ldap',
      hasPassword: false,
      quota: GIB,
    }),
    mockMailbox({ localPart: 'jana', domain: 'bücher.example', displayName: 'Jana', quota: GIB }),
    mockMailbox({
      localPart: 'long',
      domain: 'b.example',
      displayName: LONG_NAME,
      tags: [LONG_TAG],
      quota: GIB,
    }),
    mockMailbox({
      localPart: 'markup',
      domain: 'b.example',
      displayName: MARKUP_NAME,
      tags: [MARKUP_TAG],
      quota: GIB,
    }),
  ]
  const filler = Array.from({ length: 30 - special.length }, (_, index) =>
    mockMailbox({
      localPart: `user${String(index + 1).padStart(2, '0')}`,
      domain: index % 2 === 0 ? 'a.example' : 'b.example',
      displayName: `User ${index + 1}`,
      quota: GIB,
      quotaUsed: (index + 1) * 10 * MIB,
      messageCount: index * 3,
    }),
  )
  seedMailboxes(state, [...special, ...filler])
}

export const mailboxListScenarios: Record<string, ScenarioDefinition> = {
  'admin-mailboxes-30': {
    description:
      'An administrator with 30 mailboxes of every kind in a.example, b.example and bücher.example (UI 003 US1).',
    overrides: { signedInAs: 'admin' },
    setup: setupMailboxList,
  },
  'domain-admin-mailboxes': {
    description: 'A domain administrator of a.example only, while b.example exists (UI 003 US1).',
    overrides: { signedInAs: 'reseller' },
    setup: (state) => {
      setupMailboxList(state)
      assignDomains(state, 'reseller', ['a.example'])
    },
  },
  'mailbox-user-active': {
    description: 'A mailbox user, who has no mailbox list (UI 003 US1-AS11).',
    overrides: { signedInAs: 'alice@example.org' },
    setup: setupMailboxList,
  },
  'mailboxes-empty-filter': {
    description: 'An administrator of a domain without mailboxes (UI 003 US1-AS5).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => {
      state.domains.push(mockDomain({ name: 'empty.example', maxMailboxes: 10 }))
    },
  },
  'mailboxes-list-error': {
    description: 'An administrator whose mailbox list fails with 500 (UI 003 US1-AS10).',
    overrides: { signedInAs: 'admin', failures: { listMailboxes: { status: 500 } } },
    setup: setupMailboxList,
  },
  'capabilities-last-logins-off': {
    description: 'The 30 mailboxes on a server that does not report last logins (UI 003 US1).',
    overrides: { signedInAs: 'admin', mailboxCapabilities: { lastLoginsReported: false } },
    setup: setupMailboxList,
  },
  'capabilities-groupware-off': {
    description: 'The 30 mailboxes on a server without the groupware (UI 003 US1).',
    overrides: { signedInAs: 'admin', mailboxCapabilities: { groupwareEnabled: false } },
    setup: setupMailboxList,
  },
}
