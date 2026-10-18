// UI 004 US1 scenarios (T030): the alias list and detail. `aliases-60` puts the aliases the tests
// name on the newest page (IDs 46 to 60); fillers 1 to 45 never contain "invoice", "sales" or a
// destination anna@example.org, so searches and filters find exactly the named aliases.
import { mockAlias } from '../factories/alias'
import { mockDomain } from '../factories/domain'
import {
  DOMAIN_ADMIN_004,
  MAILBOX_004,
  setupWorld004,
  syncUsage004,
  worldDomain,
} from './feature-004-base'
import type { ScenarioDefinition } from './index'
import type { MockAlias, ScenarioState } from './state'

export const ALIASES_60 = {
  total: 60,
  /** sales@example.org → anna, bob. */
  sales: 60,
  /** info@example.net → anna: example.net is an alias domain of example.org (US1-AS2). */
  infoNet: 59,
  /** @example.org → anna (catch-all). */
  catchAll: 58,
  /** noreply@example.org: discard silently. */
  discard: 57,
  /** spamtrap@example.org: learn as spam (US1-AS3). */
  learnSpam: 56,
  /** hamtrap@example.org: learn as ham. */
  learnHam: 55,
  /** old-team@example.org: inactive. */
  inactive: 54,
  /** staff@example.org: internal. */
  internal: 53,
  /** hidden@example.org: hidden from the groupware. */
  hidden: 52,
  /** newsletter@example.org: receive-only (sending not allowed). */
  receiveOnly: 51,
  /** lost@gone.example: orphaned (administrators only). */
  orphaned: 50,
  /** team@example.org: 12 destinations (US1-AS4). */
  twelve: 49,
  /** invoice@example.com: "invoice" in the address. */
  invoiceAddress: 48,
  /** billing@example.com → invoices@accounting.example: "invoice" in a destination. */
  invoiceDestination: 47,
  /** accounts@example.com: "Invoice questions" as its public comment. */
  invoiceComment: 46,
  /** list3@other.example: a filler in a third domain, outside the domain administrator's scope. */
  otherDomain: 3,
} as const

/** The three aliases that deliver to anna@example.org (US1-AS6). */
export const DELIVERS_TO_ANNA = [ALIASES_60.sales, ALIASES_60.infoNet, ALIASES_60.catchAll]

/** The aliases whose address, destination or comment contains "invoice" (US1-AS5). */
export const INVOICE_ALIASES = [
  ALIASES_60.invoiceAddress,
  ALIASES_60.invoiceDestination,
  ALIASES_60.invoiceComment,
]

/** The 12 destinations of `team@example.org`, none of them anna@example.org. */
export const TWELVE_DESTINATIONS = [
  MAILBOX_004.bob,
  MAILBOX_004.carol,
  MAILBOX_004.dave,
  MAILBOX_004.alice,
  MAILBOX_004.erik,
  MAILBOX_004.fiona,
  MAILBOX_004.gina,
  MAILBOX_004.hank,
  'ext1@partner.example',
  'ext2@partner.example',
  'ext3@partner.example',
  'ext4@partner.example',
]

const FILLER_DOMAINS = [
  'example.org',
  'example.com',
  'other.example',
  'shop.example',
  'alpha.example',
] as const
const FILLER_TARGET: Record<string, string> = {
  'example.org': MAILBOX_004.bob,
  'example.com': MAILBOX_004.erik,
  'other.example': MAILBOX_004.gina,
  'shop.example': MAILBOX_004.hank,
  'alpha.example': MAILBOX_004.carol,
}

const created = (id: number) => new Date(Date.UTC(2026, 2, 1, 8) + id * 3_600_000).toISOString()

/** The 60 aliases of `aliases-60`, oldest first. */
export function aliases60(): MockAlias[] {
  const fillers = Array.from({ length: 45 }, (_, index) => {
    const id = index + 1
    const domain = FILLER_DOMAINS[index % FILLER_DOMAINS.length]!
    return mockAlias({
      id,
      address: `list${id}@${domain}`,
      destinations: [FILLER_TARGET[domain]!],
      createdAt: created(id),
    })
  })
  const special = (id: number, overrides: Partial<MockAlias> & { address: string }) =>
    mockAlias({ id, createdAt: created(id), ...overrides })
  const S = ALIASES_60
  return [
    ...fillers,
    special(S.invoiceComment, {
      address: 'accounts@example.com',
      destinations: [MAILBOX_004.fiona],
      publicComment: 'Invoice questions',
    }),
    special(S.invoiceDestination, {
      address: 'billing@example.com',
      destinations: ['invoices@accounting.example'],
    }),
    special(S.invoiceAddress, { address: 'invoice@example.com', destinations: [MAILBOX_004.erik] }),
    special(S.twelve, { address: 'team@example.org', destinations: TWELVE_DESTINATIONS }),
    special(S.orphaned, { address: 'lost@gone.example', destinations: [MAILBOX_004.bob] }),
    special(S.receiveOnly, {
      address: 'newsletter@example.org',
      destinations: [MAILBOX_004.carol],
      senderAllowed: false,
    }),
    special(S.hidden, {
      address: 'hidden@example.org',
      destinations: [MAILBOX_004.bob],
      groupwareVisible: false,
    }),
    special(S.internal, {
      address: 'staff@example.org',
      destinations: [MAILBOX_004.bob],
      internal: true,
      privateComment: 'Internal staff list',
    }),
    special(S.inactive, {
      address: 'old-team@example.org',
      destinations: [MAILBOX_004.bob],
      active: false,
    }),
    special(S.learnHam, { address: 'hamtrap@example.org', destinationType: 'learnHam' }),
    special(S.learnSpam, { address: 'spamtrap@example.org', destinationType: 'learnSpam' }),
    special(S.discard, { address: 'noreply@example.org', destinationType: 'discard' }),
    special(S.catchAll, { address: '@example.org', destinations: [MAILBOX_004.anna] }),
    special(S.infoNet, { address: 'info@example.net', destinations: [MAILBOX_004.anna] }),
    special(S.sales, {
      address: 'sales@example.org',
      destinations: [MAILBOX_004.anna, MAILBOX_004.bob],
      modifiedAt: created(70),
    }),
  ]
}

/** The base world with the given aliases instead of the base ones. */
export function worldWithAliases(state: ScenarioState, aliases: MockAlias[]): void {
  setupWorld004(state, { aliases: false })
  state.aliases = aliases
  state.lastAliasId = Math.max(0, ...aliases.map((alias) => alias.id))
  syncUsage004(state)
}

/** 193 characters: labels of 63, 63 and 57, and `.example`. */
export const LONG_DOMAIN_004 = ['a'.repeat(63), 'b'.repeat(63), `${'c'.repeat(57)}.example`].join(
  '.',
)
/** A 254-character address: a 60-character local part in the 193-character domain. */
export const LONG_ADDRESS_004 = `${'l'.repeat(60)}@${LONG_DOMAIN_004}`
/** 200 destinations. */
export const MANY_DESTINATIONS_004 = Array.from(
  { length: 200 },
  (_, index) => `member${String(index + 1).padStart(3, '0')}@example.com`,
)

export const LONG_VALUES_004 = {
  /** The 254-character address. */
  long: 1,
  /** info@bücher.example (`info@xn--bcher-kva.example`). */
  idn: 2,
  /** everyone@example.org with 200 destinations. */
  many: 3,
  /** Mixed.Case@example.org: the local part is shown as stored. */
  mixedCase: 4,
} as const

export const aliasesListScenarios: Record<string, ScenarioDefinition> = {
  'aliases-60': {
    description:
      'An administrator with 60 aliases (ALIASES_60): regular, catch-all, every special action, in an alias domain, inactive, internal, hidden, receive-only, orphaned, 12 destinations, "invoice" three times, three delivering to anna@example.org (UI 004 US1).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => worldWithAliases(state, aliases60()),
  },
  'aliases-empty': {
    description: 'An administrator on a server without aliases (UI 004 US1-AS7).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => worldWithAliases(state, []),
  },
  'aliases-da-two-of-ten': {
    description:
      'The 60 aliases as the domain administrator of two of the ten domains, example.org and example.com (UI 004 US1-AS9).',
    overrides: { signedInAs: DOMAIN_ADMIN_004 },
    setup: (state) => worldWithAliases(state, aliases60()),
  },
  'aliases-long-values': {
    description:
      'An administrator with a 254-character address, an internationalised domain, 200 destinations and a mixed-case local part (UI 004 SC-004).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => {
      worldWithAliases(state, [
        mockAlias({
          id: LONG_VALUES_004.long,
          address: LONG_ADDRESS_004,
          destinations: [MAILBOX_004.bob],
          publicComment: 'x'.repeat(160),
        }),
        mockAlias({
          id: LONG_VALUES_004.idn,
          address: 'info@xn--bcher-kva.example',
          destinations: [MAILBOX_004.bob],
        }),
        mockAlias({
          id: LONG_VALUES_004.many,
          address: 'everyone@example.org',
          destinations: MANY_DESTINATIONS_004,
        }),
        mockAlias({
          id: LONG_VALUES_004.mixedCase,
          address: 'Mixed.Case@example.org',
          destinations: [MAILBOX_004.bob],
        }),
      ])
      state.domains.push(worldDomain(LONG_DOMAIN_004))
      syncUsage004(state)
    },
  },
  'aliases-5000-domains': {
    description:
      'An administrator with 5,000 domains and the base aliases, for the server-searched domain picker (UI 004 FR-011).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => {
      setupWorld004(state)
      const extra = Array.from({ length: 4990 }, (_, index) =>
        mockDomain({ name: `domain${String(index + 1).padStart(4, '0')}.example` }),
      )
      state.domains.push(...extra)
    },
  },
}
