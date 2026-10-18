// The navigation catalogue (FR-043, FR-044, SC-007, data-model §2, research R19): every row for
// every role and flag combination, and a placeholder route for every entry not yet available.
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import type { Identity, PermissionFlags, Role } from '@/api'
import { catalogue, placeholderRouteSpecs, type NavEntryId } from '@/app/navigation/catalogue'
import {
  CLASSIC_PASSWORD_RESET,
  CLASSIC_SIGN_IN,
  classicSignIn,
} from '@/app/navigation/classic-links'
import { canAccess, visibleEntries } from '@/app/navigation/visibility'

const contract = JSON.parse(readFileSync('contract/openapi.json', 'utf8')) as {
  components: { schemas: { PermissionFlags: { required: (keyof PermissionFlags)[] } } }
}
const FLAG_NAMES = contract.components.schemas.PermissionFlags.required

type Flag = 'syncjobs' | 'bccMaps' | 'spamScore' | 'spamPolicy'
const FLAGS: Flag[] = ['syncjobs', 'bccMaps', 'spamScore', 'spamPolicy']

function identity(role: Role, granted: Flag[]): Identity {
  const permissions = Object.fromEntries(
    FLAG_NAMES.map((name) => [name, role === 'admin' || granted.includes(name as Flag)]),
  ) as unknown as PermissionFlags
  return {
    username: `${role}@example.org`,
    role,
    authentication: { method: 'password' },
    scope:
      role === 'admin'
        ? { type: 'allDomains' }
        : role === 'domainAdmin'
          ? { type: 'domains', domains: ['example.org'] }
          : { type: 'mailbox', mailbox: 'alice@example.org', domain: 'example.org' },
    permissions,
    pendingActions: [],
  }
}

/** The catalogue of data-model §2: true, false, or the flags of which one must be granted. */
const EXPECTED: Record<NavEntryId, Record<Role, boolean | Flag[]>> = {
  home: { admin: true, domainAdmin: true, mailboxUser: true },
  domains: { admin: true, domainAdmin: true, mailboxUser: false },
  mailboxes: { admin: true, domainAdmin: true, mailboxUser: false },
  aliases: { admin: true, domainAdmin: true, mailboxUser: false },
  account: { admin: true, domainAdmin: true, mailboxUser: true },
  passkeys: { admin: true, domainAdmin: true, mailboxUser: true },
  quarantine: { admin: true, domainAdmin: true, mailboxUser: true },
  spamFilter: { admin: false, domainAdmin: false, mailboxUser: ['spamScore', 'spamPolicy'] },
  administrators: { admin: true, domainAdmin: false, mailboxUser: false },
  syncJobs: { admin: true, domainAdmin: ['syncjobs'], mailboxUser: ['syncjobs'] },
  routing: { admin: true, domainAdmin: ['bccMaps'], mailboxUser: false },
  dns: { admin: true, domainAdmin: true, mailboxUser: false },
  operations: { admin: true, domainAdmin: false, mailboxUser: false },
  identityProviders: { admin: true, domainAdmin: false, mailboxUser: false },
  system: { admin: true, domainAdmin: false, mailboxUser: false },
  apiKeys: { admin: true, domainAdmin: false, mailboxUser: false },
  auditLog: { admin: true, domainAdmin: false, mailboxUser: false },
}

const ORDER = Object.keys(EXPECTED) as NavEntryId[]

/** Every subset of the four flags. */
const flagSets: Flag[][] = Array.from({ length: 1 << FLAGS.length }, (_, mask) =>
  FLAGS.filter((_, bit) => mask & (1 << bit)),
)

function shown(rule: boolean | Flag[], granted: Flag[]): boolean {
  return Array.isArray(rule) ? rule.some((flag) => granted.includes(flag)) : rule
}

describe('navigation catalogue', () => {
  it('has the 17 rows of data-model §2 in navigation order', () => {
    expect(catalogue.map((entry) => entry.id)).toEqual(ORDER)
  })

  it('names every entry by its classic name or nav.<id>, with an icon and a section root', () => {
    const classic: Record<string, string> = {
      domains: 'mailbox.domains',
      mailboxes: 'mailbox.mailboxes',
      account: 'header.user_settings',
      quarantine: 'header.quarantine',
      spamFilter: 'user.spamfilter',
      administrators: 'admin.admins',
      syncJobs: 'mailbox.sync_jobs',
    }
    for (const entry of catalogue) {
      const legacyKey = classic[entry.id]
      expect(entry.labelKey).toEqual(legacyKey ? { legacy: legacyKey } : `nav.${entry.id}`)
      expect(entry.icon).toBeTruthy()
      expect(entry.path).toMatch(/^\/[a-z-]*$/)
    }
    expect(new Set(catalogue.map((entry) => entry.path)).size).toBe(catalogue.length)
  })

  it('starts every row as a placeholder until its story makes it available', () => {
    const delivered = catalogue.filter((entry) => entry.deliveredBy !== '001')
    expect(delivered.every((entry) => entry.status === 'placeholder')).toBe(true)
  })

  it('links every placeholder to the classic interface for each role that sees it', () => {
    for (const entry of catalogue.filter((e) => e.deliveredBy !== '001')) {
      for (const role of ['admin', 'domainAdmin', 'mailboxUser'] as Role[]) {
        if (EXPECTED[entry.id][role] === false) continue
        const links = entry.classic[role] ?? []
        expect(links.length, `${entry.id} for ${role}`).toBeGreaterThan(0)
        expect(links.every((path) => path.startsWith('/') && !path.startsWith('//'))).toBe(true)
      }
    }
  })
})

describe.each(['admin', 'domainAdmin', 'mailboxUser'] as Role[])('as %s', (role) => {
  it.each(flagSets.map((set) => [set.join('+') || 'no flags', set] as const))(
    'shows exactly the allowed entries with %s',
    (_label, granted) => {
      const who = identity(role, granted)
      const expected = ORDER.filter((id) => shown(EXPECTED[id][role], granted))
      expect(visibleEntries(who).map((entry) => entry.id)).toEqual(expected)
      for (const id of ORDER) {
        expect(canAccess(id, who), `${id}`).toBe(expected.includes(id))
      }
    },
  )
})

describe('access without an identity', () => {
  it('shows nothing and allows nothing', () => {
    expect(visibleEntries(null)).toEqual([])
    expect(canAccess('home', null)).toBe(false)
  })
})

describe('placeholder routes (FR-044, SC-007)', () => {
  it('exist for every entry that is not available, at its section root', () => {
    const specs = placeholderRouteSpecs()
    const placeholders = catalogue.filter((entry) => entry.status !== 'available')
    expect(specs.map((spec) => spec.navEntry)).toEqual(placeholders.map((entry) => entry.id))
    for (const spec of specs) {
      const entry = catalogue.find((e) => e.id === spec.navEntry)
      expect(spec.name).toBe(`placeholder-${spec.navEntry}`)
      expect(spec.path).toBe(entry?.path)
    }
  })
})

describe('classic interface addresses (research R19)', () => {
  it('names the sign-in pages per role and the password reset', () => {
    expect(CLASSIC_SIGN_IN).toEqual({
      admin: '/admin',
      domainAdmin: '/domainadmin',
      mailboxUser: '/',
    })
    expect(classicSignIn(null)).toBe('/')
    expect(classicSignIn('domainAdmin')).toBe('/domainadmin')
    expect(CLASSIC_PASSWORD_RESET).toBe('/reset-password')
  })
})
