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
  domainTemplates: { admin: true, domainAdmin: false, mailboxUser: false },
  mailboxes: { admin: true, domainAdmin: true, mailboxUser: false },
  mailboxTemplates: { admin: true, domainAdmin: true, mailboxUser: false },
  aliases: { admin: true, domainAdmin: true, mailboxUser: false },
  aliasDomains: { admin: true, domainAdmin: true, mailboxUser: false },
  resources: { admin: true, domainAdmin: true, mailboxUser: false },
  account: { admin: true, domainAdmin: true, mailboxUser: true },
  passkeys: { admin: true, domainAdmin: true, mailboxUser: true },
  quarantine: { admin: true, domainAdmin: true, mailboxUser: true },
  spamFilter: { admin: false, domainAdmin: false, mailboxUser: ['spamScore', 'spamPolicy'] },
  administrators: { admin: true, domainAdmin: false, mailboxUser: false },
  syncJobs: { admin: true, domainAdmin: ['syncjobs'], mailboxUser: ['syncjobs'] },
  // UI 009: domain administrators see the BCC maps read-only without the flag (US5-AS6).
  routing: { admin: true, domainAdmin: true, mailboxUser: false },
  // UI 010 (research R2): the row `dns` is split into two entries (FR-001).
  dkimKeys: { admin: true, domainAdmin: true, mailboxUser: false },
  mtaStsPolicies: { admin: true, domainAdmin: true, mailboxUser: false },
  dashboard: { admin: true, domainAdmin: false, mailboxUser: false },
  logs: { admin: true, domainAdmin: false, mailboxUser: false },
  mailQueue: { admin: true, domainAdmin: false, mailboxUser: false },
  fail2ban: { admin: true, domainAdmin: false, mailboxUser: false },
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
  it('has the rows of data-model §2 (UI 002 adds domainTemplates, UI 003 mailboxTemplates, UI 004 splits aliases into aliases, aliasDomains and resources) in navigation order', () => {
    expect(catalogue.map((entry) => entry.id)).toEqual(ORDER)
  })

  it('names every entry by its classic name or nav.<id>, with an icon and a section root', () => {
    const classic: Record<string, string> = {
      domains: 'mailbox.domains',
      domainTemplates: 'mailbox.domain_templates',
      mailboxes: 'mailbox.mailboxes',
      mailboxTemplates: 'mailbox.mailbox_templates',
      aliases: 'mailbox.aliases',
      aliasDomains: 'mailbox.domain_aliases',
      resources: 'mailbox.resources',
      account: 'header.user_settings',
      quarantine: 'header.quarantine',
      spamFilter: 'user.spamfilter',
      administrators: 'admin.admins',
      syncJobs: 'mailbox.sync_jobs',
      routing: 'admin.routing',
      dkimKeys: 'admin.dkim_keys',
      mtaStsPolicies: 'edit.mta_sts',
      dashboard: 'debug.system_containers',
      logs: 'debug.logs',
      mailQueue: 'queue.queue_manager',
      fail2ban: 'admin.f2b_parameters',
    }
    for (const entry of catalogue) {
      const legacyKey = classic[entry.id]
      expect(entry.labelKey).toEqual(legacyKey ? { legacy: legacyKey } : `nav.${entry.id}`)
      expect(entry.icon).toBeTruthy()
      // UI 010: the DNS entries live under /dns (research R2).
      // UI 011: the operations entries live under /operations, one with a digit (fail2ban).
      expect(entry.path).toMatch(/^\/([a-z0-9-]+(\/[a-z0-9-]+)?)?$/)
    }
    expect(new Set(catalogue.map((entry) => entry.path)).size).toBe(catalogue.length)
  })

  it('starts every row as a placeholder until its story makes it available', () => {
    // Rows that later features have delivered so far (UI 002 US1: domains; US6: templates;
    // UI 003 US1: mailboxes; US7: mailbox templates; UI 008: sync jobs; UI 009: routing; UI 010:
    // DKIM keys and MTA-STS policies; UI 012: identity providers and OAuth2; UI 004 US1: aliases;
    // US4: domain aliases; US7: resources).
    const available = new Set<NavEntryId>([
      'domains',
      'domainTemplates',
      'mailboxes',
      'mailboxTemplates',
      'syncJobs',
      'routing',
      'dkimKeys',
      'mtaStsPolicies',
      'identityProviders',
      'aliases',
      'aliasDomains',
      'resources',
      'dashboard',
      'logs',
      'mailQueue',
      'fail2ban',
    ])
    const delivered = catalogue.filter((entry) => entry.deliveredBy !== '001')
    for (const entry of delivered) {
      expect(entry.status, entry.id).toBe(available.has(entry.id) ? 'available' : 'placeholder')
    }
  })

  it('delivers mailbox templates with UI 003 and links them to the classic mailbox pages', () => {
    const entry = catalogue.find((item) => item.id === 'mailboxTemplates')
    expect(entry?.path).toBe('/mailbox-templates')
    expect(entry?.deliveredBy).toBe('003')
    expect(entry?.classic).toEqual({
      admin: ['/admin/mailbox'],
      domainAdmin: ['/domainadmin/mailbox'],
    })
    const ids = catalogue.map((item) => item.id)
    expect(ids.indexOf('mailboxTemplates')).toBe(ids.indexOf('mailboxes') + 1)
  })

  it('delivers the two DNS entries with UI 010 under /dns', () => {
    const dkim = catalogue.find((item) => item.id === 'dkimKeys')
    const mtaSts = catalogue.find((item) => item.id === 'mtaStsPolicies')
    expect(dkim?.path).toBe('/dns/dkim-keys')
    expect(mtaSts?.path).toBe('/dns/mta-sts-policies')
    expect(dkim?.deliveredBy).toBe('010')
    expect(mtaSts?.deliveredBy).toBe('010')
    expect(dkim?.classic).toEqual({
      admin: ['/admin/system'],
      domainAdmin: ['/domainadmin/mailbox'],
    })
    expect(mtaSts?.classic).toEqual({
      admin: ['/admin/mailbox'],
      domainAdmin: ['/domainadmin/mailbox'],
    })
    expect(catalogue.some((item) => (item.id as string) === 'dns')).toBe(false)
  })

  it('groups the four operations screens of UI 011 under "System", administrators only', () => {
    const system = catalogue.filter((entry) => entry.group === 'system')
    expect(system.map((entry) => [entry.id, entry.path, entry.deliveredBy])).toEqual([
      ['dashboard', '/operations/dashboard', '011'],
      ['logs', '/operations/logs', '011'],
      ['mailQueue', '/operations/mail-queue', '011'],
      ['fail2ban', '/operations/fail2ban', '011'],
    ])
    const ids = catalogue.map((entry) => entry.id)
    const first = ids.indexOf('dashboard')
    expect(ids.slice(first, first + 4)).toEqual(['dashboard', 'logs', 'mailQueue', 'fail2ban'])
    expect(system.map((entry) => entry.classic.admin)).toEqual([
      ['/admin/dashboard'],
      ['/admin/dashboard'],
      ['/admin/queue'],
      ['/admin/system'],
    ])
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

describe('UI 004 rows (T028, research R4)', () => {
  it('replace the aliases row with three consecutive rows delivered by 004 with the classic links', () => {
    const ids = catalogue.map((entry) => entry.id)
    const at = ids.indexOf('aliases')
    expect(ids.slice(at, at + 3)).toEqual(['aliases', 'aliasDomains', 'resources'])
    for (const [id, path] of [
      ['aliases', '/aliases'],
      ['aliasDomains', '/alias-domains'],
      ['resources', '/resources'],
    ] as const) {
      const entry = catalogue.find((item) => item.id === id)!
      expect(entry.path).toBe(path)
      expect(entry.deliveredBy).toBe('004')
      expect(entry.classic).toEqual({
        admin: ['/admin/mailbox'],
        domainAdmin: ['/domainadmin/mailbox'],
      })
    }
  })
})
