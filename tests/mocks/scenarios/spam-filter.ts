// UI 006 spam filter scenarios (T080, T090, research R28): the spam score of alice@example.org
// (server defaults 8 and 15, the fallback 5 and 15, custom values, one stored value), her flags,
// her allow and block lists next to the domain entry `*@spam.example` of example.org, 40 own
// entries for paging, and the lists of domains, alias domains and mailboxes for administrators and
// for the domain administrator "reseller" with and without `spamPolicy`. Built on the UI 006 world
// of `./quarantine` (`setupQuarantineWorld`).
import type { PermissionFlags } from '@/api'

import { fallbackSpamScoreDefaults } from '../factories/spam-score'
import { generateEntries, mockSpamPolicyEntry } from '../factories/spam-policy-entry'
import type { ScenarioDefinition } from './index'
import { ALICE, BOB, QUARANTINE_DOMAIN_ADMIN, setupQuarantineWorld } from './quarantine'
import type { MockSpamPolicyEntry, ScenarioState } from './state'

export const SPAM_USER = ALICE

/** alice's own entries in `policy-user` and `policy-admin` (IDs 2-4). */
export const ALICE_ENTRIES = {
  friends: 2,
  newsletter: 3,
  ads: 4,
} as const

/** Entries of the domain example.org, bob and the alias domain example.net in `policy-admin`. */
export const POLICY_ADMIN_ENTRIES = {
  domainPartner: 10,
  bobBoss: 11,
  aliasOld: 12,
} as const

function aliceEntries(): MockSpamPolicyEntry[] {
  return [
    mockSpamPolicyEntry({
      id: ALICE_ENTRIES.friends,
      list: 'allow',
      ownerKind: 'mailbox',
      owner: ALICE,
      pattern: '*@friends.example',
    }),
    mockSpamPolicyEntry({
      id: ALICE_ENTRIES.newsletter,
      list: 'allow',
      ownerKind: 'mailbox',
      owner: ALICE,
      pattern: 'news@shop.example',
    }),
    mockSpamPolicyEntry({
      id: ALICE_ENTRIES.ads,
      list: 'block',
      ownerKind: 'mailbox',
      owner: ALICE,
      pattern: '*@ads.example',
    }),
  ]
}

function adminEntries(): MockSpamPolicyEntry[] {
  return [
    mockSpamPolicyEntry({
      id: POLICY_ADMIN_ENTRIES.domainPartner,
      list: 'allow',
      ownerKind: 'domain',
      owner: 'example.org',
      pattern: '*@partner.example',
    }),
    mockSpamPolicyEntry({
      id: POLICY_ADMIN_ENTRIES.bobBoss,
      list: 'allow',
      ownerKind: 'mailbox',
      owner: BOB,
      pattern: 'boss@example.com',
    }),
    mockSpamPolicyEntry({
      id: POLICY_ADMIN_ENTRIES.aliasOld,
      list: 'block',
      ownerKind: 'aliasDomain',
      owner: 'example.net',
      pattern: '*@old.example',
    }),
  ]
}

function withEntries(state: ScenarioState, entries: MockSpamPolicyEntry[]): void {
  state.quarantine.entries.push(...entries)
  state.quarantine.lastEntryId = Math.max(...state.quarantine.entries.map((entry) => entry.id))
}

/** alice in the UI 006 world, with these flags changed and her three own entries. */
function spamUser(state: ScenarioState, aliceFlags: Partial<PermissionFlags> = {}): void {
  setupQuarantineWorld(state, { items: [], aliceFlags })
  withEntries(state, aliceEntries())
}

/** The world with the entries of every owner kind (`policy-admin`). */
function policyWorld(
  state: ScenarioState,
  options: { resellerFlags?: Partial<PermissionFlags> } = {},
): void {
  setupQuarantineWorld(state, {
    items: [],
    aliceFlags: { spamScore: false },
    resellerFlags: options.resellerFlags,
  })
  withEntries(state, [...aliceEntries(), ...adminEntries()])
}

const asAlice = { signedInAs: ALICE }

export const spamFilterScenarios: Record<string, ScenarioDefinition> = {
  'spam-score-defaults': {
    description:
      'alice@example.org with every spam flag and no score of her own; the spam filter reports 8 and 15 (UI 006 US4-AS1).',
    overrides: asAlice,
    setup: (state) => spamUser(state),
  },
  'spam-score-fallback': {
    description:
      'alice without a score of her own; the spam filter cannot be asked, so 5 and 15 apply as fallback values.',
    overrides: { ...asAlice, quarantine: { spamScoreDefaults: fallbackSpamScoreDefaults() } },
    setup: (state) => spamUser(state),
  },
  'spam-score-custom': {
    description: 'alice with her own score 6.5 and 12 (US4-AS5).',
    overrides: {
      ...asAlice,
      quarantine: { spamScores: { [ALICE]: { junkScore: 6.5, rejectScore: 12 } } },
    },
    setup: (state) => spamUser(state),
  },
  'spam-score-one-value': {
    description:
      'alice with only a junk value of 4 stored (written by another tool): custom, the reject value from the defaults.',
    overrides: {
      ...asAlice,
      quarantine: { spamScores: { [ALICE]: { junkScore: 4, rejectScore: null } } },
    },
    setup: (state) => spamUser(state),
  },
  'spam-user-no-score-flag': {
    description: 'alice without "Spam score" (`spamScore`): the score is read-only.',
    overrides: asAlice,
    setup: (state) => spamUser(state, { spamScore: false }),
  },
  'spam-user-no-policy-flag': {
    description: 'alice without "Denylist/Allowlist" (`spamPolicy`): the lists are read-only.',
    overrides: asAlice,
    setup: (state) => spamUser(state, { spamPolicy: false }),
  },
  'spam-user-no-flags': {
    description: 'alice without `spamScore` and `spamPolicy`: no Spam filter entry (US4-AS10).',
    overrides: asAlice,
    setup: (state) => spamUser(state, { spamScore: false, spamPolicy: false }),
  },
  'policy-user': {
    description:
      'alice with every spam flag, her Allowlist *@friends.example and news@shop.example, her Denylist *@ads.example, and the Denylist entry *@spam.example of example.org (US4).',
    overrides: asAlice,
    setup: (state) => spamUser(state),
  },
  'policy-many-entries': {
    description:
      'alice with 40 Allowlist entries (*@s001.list.example to *@s040.list.example) and 5 Denylist entries (FR-047).',
    overrides: asAlice,
    setup: (state) => {
      setupQuarantineWorld(state, { items: [] })
      const blocked = generateEntries('mailbox', ALICE, 5, 201, 'block').map((entry) => ({
        ...entry,
        pattern: entry.pattern.replace('.list.', '.deny.'),
      }))
      withEntries(state, [...generateEntries('mailbox', ALICE, 40, 101, 'allow'), ...blocked])
    },
  },
  'policy-admin': {
    description:
      'The administrator; example.org with its Allowlist *@partner.example and Denylist *@spam.example, the mailbox entries of alice (*@friends.example, news@shop.example, *@ads.example) and bob (boss@example.com), the alias domain example.net with *@old.example; alice lacks `spamScore` (US5).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => policyWorld(state),
  },
  'policy-domain-admin': {
    description:
      'The domain administrator "reseller" of example.org and example.com with `spamPolicy`, and the entries of policy-admin (US5-AS1).',
    overrides: { signedInAs: QUARANTINE_DOMAIN_ADMIN },
    setup: (state) => policyWorld(state),
  },
  'policy-domain-admin-no-policy': {
    description: 'The domain administrator "reseller" without `spamPolicy` (US5-AS3).',
    overrides: { signedInAs: QUARANTINE_DOMAIN_ADMIN },
    setup: (state) => policyWorld(state, { resellerFlags: { spamPolicy: false } }),
  },
  'policy-resource': {
    description:
      'The administrator with the entries of policy-admin and the resources of UI 004 (MeetingRoom1@example.org): a resource is not a mailbox and gets no spam filter (US5-AS5).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => policyWorld(state),
  },
}
