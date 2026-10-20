// The navigation catalogue (data-model §2, research R19): the single source for the navigation,
// the home screen shortcuts, the placeholder routes and the access checks (SC-007). A later
// feature sets its entry's `status` to `available` and registers its routes under `path`.
import type { Component } from 'vue'

import type { PermissionFlags, Role } from '@/api'
import { legacy, type LegacyRef, type TextRef } from '@/i18n'
import {
  ArchiveIcon,
  ArrowLeftRightIcon,
  AtSignIcon,
  CalendarIcon,
  DatabaseIcon,
  FilterIcon,
  GearIcon,
  GlobeIcon,
  HomeIcon,
  KeyIcon,
  LayersIcon,
  LayoutTemplateIcon,
  LinkIcon,
  ListIcon,
  LockIcon,
  LogsIcon,
  MailIcon,
  PasskeyIcon,
  QueueIcon,
  ServerIcon,
  ShieldIcon,
  SyncIcon,
  UserCircleIcon,
  UsersIcon,
} from '@/shared/icons'

export type NavEntryId =
  | 'home'
  | 'domains'
  | 'domainTemplates'
  | 'mailboxes'
  | 'mailboxTemplates'
  | 'aliases'
  | 'aliasDomains'
  | 'resources'
  | 'filters'
  | 'account'
  | 'passkeys'
  | 'quarantine'
  | 'spamFilter'
  | 'administrators'
  | 'domainAdmins'
  | 'syncJobs'
  | 'routing'
  | 'dkimKeys'
  | 'mtaStsPolicies'
  | 'dashboard'
  | 'logs'
  | 'mailQueue'
  | 'fail2ban'
  | 'identityProviders'
  | 'system'
  | 'apiKeys'
  | 'auditLog'

/** Per role: always, never, or when the identity grants at least one of the flags (FR-043). */
export type EntryAccess = boolean | { anyFlag: (keyof PermissionFlags)[] }

export interface NavigationEntry {
  id: NavEntryId
  /** The entry's name: the classic interface's name of the section, or a new `nav.*` string. */
  labelKey: TextRef
  icon: Component
  /** The section root: a stable app address that feature 014 maps classic addresses to. */
  path: string
  access: Readonly<Record<Role, EntryAccess>>
  /** The UI feature that delivers the section. */
  deliveredBy: string
  status: 'available' | 'placeholder'
  /** The classic interface pages a placeholder links to, per role (research R19). */
  classic: Readonly<Partial<Record<Role, readonly string[]>>>
  /**
   * UI 011 (research R3): consecutive entries of one group are listed under the group's heading
   * (`nav.groups.<group>`).
   */
  group?: 'system'
}

const ALL: Record<Role, EntryAccess> = { admin: true, domainAdmin: true, mailboxUser: true }
const MANAGERS: Record<Role, EntryAccess> = { admin: true, domainAdmin: true, mailboxUser: false }
const ADMIN: Record<Role, EntryAccess> = { admin: true, domainAdmin: false, mailboxUser: false }

const MAIL_SETUP = { admin: ['/admin/mailbox'], domainAdmin: ['/domainadmin/mailbox'] } as const
const DASHBOARD = { admin: ['/admin/dashboard'] } as const
const QUEUE = { admin: ['/admin/queue'] } as const
const SYSTEM = { admin: ['/admin/system'] } as const

/**
 * Sections that have a name in the classic interface use it (docs/conventions.md "Wording"); the
 * others are new `nav.<id>` strings until their feature maps them.
 */
const LEGACY_LABELS: Partial<Record<NavEntryId, LegacyRef>> = {
  domains: legacy('mailbox.domains'),
  domainTemplates: legacy('mailbox.domain_templates'),
  mailboxes: legacy('mailbox.mailboxes'),
  mailboxTemplates: legacy('mailbox.mailbox_templates'),
  // UI 004: the entries of the classic "Aliases" tab dropdown (research R4).
  aliases: legacy('mailbox.aliases'),
  aliasDomains: legacy('mailbox.domain_aliases'),
  resources: legacy('mailbox.resources'),
  // UI 005: the classic "Filters" tab of Mail setup.
  filters: legacy('mailbox.filters'),
  account: legacy('header.user_settings'),
  quarantine: legacy('header.quarantine'),
  spamFilter: legacy('user.spamfilter'),
  administrators: legacy('admin.admins'),
  domainAdmins: legacy('admin.domain_admins'),
  syncJobs: legacy('mailbox.sync_jobs'),
  // UI 010 (legacy form map): the classic DKIM tab and the domain page's MTA-STS tab.
  dkimKeys: legacy('admin.dkim_keys'),
  mtaStsPolicies: legacy('edit.mta_sts'),
  // UI 009: the classic Routing tab (legacy form map part 1c).
  routing: legacy('admin.routing'),
  // UI 011 (plan "Legacy form map (T010a)"): the dashboard's tab, the log dropdown, the queue's
  // menu entry and the Fail2ban panel's title.
  dashboard: legacy('debug.system_containers'),
  logs: legacy('debug.logs'),
  mailQueue: legacy('queue.queue_manager'),
  fail2ban: legacy('admin.f2b_parameters'),
}

function entry(
  id: NavEntryId,
  path: string,
  icon: Component,
  access: Record<Role, EntryAccess>,
  deliveredBy: string,
  classic: NavigationEntry['classic'] = {},
  status: NavigationEntry['status'] = 'placeholder',
): NavigationEntry {
  const labelKey = LEGACY_LABELS[id] ?? `nav.${id}`
  return { id, labelKey, icon, path, access, deliveredBy, status, classic }
}

function system(item: NavigationEntry): NavigationEntry {
  return { ...item, group: 'system' }
}

export const catalogue: readonly NavigationEntry[] = [
  entry('home', '/', HomeIcon, ALL, '001', {}, 'available'),
  entry('domains', '/domains', GlobeIcon, MANAGERS, '002', MAIL_SETUP, 'available'),
  entry(
    'domainTemplates',
    '/domain-templates',
    LayersIcon,
    ADMIN,
    '002',
    { admin: ['/admin/mailbox'] },
    'available',
  ),
  entry('mailboxes', '/mailboxes', MailIcon, MANAGERS, '003', MAIL_SETUP, 'available'),
  entry(
    'mailboxTemplates',
    '/mailbox-templates',
    LayoutTemplateIcon,
    MANAGERS,
    '003',
    MAIL_SETUP,
    'available',
  ),
  entry('aliases', '/aliases', AtSignIcon, MANAGERS, '004', MAIL_SETUP, 'available'),
  entry('aliasDomains', '/alias-domains', LinkIcon, MANAGERS, '004', MAIL_SETUP, 'available'),
  entry('resources', '/resources', CalendarIcon, MANAGERS, '004', MAIL_SETUP, 'available'),
  // UI 005 (research R4): domain administrators without the filters flag read the list.
  entry('filters', '/filters', FilterIcon, MANAGERS, '005', MAIL_SETUP, 'available'),
  entry(
    'account',
    '/account',
    UserCircleIcon,
    ALL,
    '005',
    { admin: ['/admin/system'], domainAdmin: ['/domainadmin/user'], mailboxUser: ['/user'] },
    'available',
  ),
  entry('passkeys', '/passkeys', PasskeyIcon, ALL, '001', {}, 'available'),
  entry('quarantine', '/quarantine', ArchiveIcon, ALL, '006', {
    admin: ['/quarantine'],
    domainAdmin: ['/quarantine'],
    mailboxUser: ['/quarantine'],
  }),
  entry(
    'spamFilter',
    '/spam-filter',
    FilterIcon,
    { admin: false, domainAdmin: false, mailboxUser: { anyFlag: ['spamScore', 'spamPolicy'] } },
    '006',
    { mailboxUser: ['/user'] },
  ),
  entry('administrators', '/administrators/admins', UsersIcon, ADMIN, '007', {
    admin: ['/admin/system'],
  }),
  entry('domainAdmins', '/administrators/domain-admins', UsersIcon, ADMIN, '007', {
    admin: ['/admin/system'],
  }),
  entry(
    'syncJobs',
    '/sync-jobs',
    SyncIcon,
    { admin: true, domainAdmin: { anyFlag: ['syncjobs'] }, mailboxUser: { anyFlag: ['syncjobs'] } },
    '008',
    { ...MAIL_SETUP, mailboxUser: ['/user'] },
    'available',
  ),
  entry(
    'routing',
    '/routing',
    ArrowLeftRightIcon,
    MANAGERS,
    '009',
    { admin: ['/admin/system', '/admin/mailbox'], domainAdmin: ['/domainadmin/mailbox'] },
    'available',
  ),
  // UI 010 (research R2): DKIM keys (with the diagnostics) and the MTA-STS policies, under /dns.
  entry(
    'dkimKeys',
    '/dns/dkim-keys',
    DatabaseIcon,
    MANAGERS,
    '010',
    { admin: ['/admin/system'], domainAdmin: ['/domainadmin/mailbox'] },
    'available',
  ),
  entry(
    'mtaStsPolicies',
    '/dns/mta-sts-policies',
    LockIcon,
    MANAGERS,
    '010',
    MAIL_SETUP,
    'available',
  ),
  // UI 011 (research R3): the "System" group of the operations screens.
  system(
    entry('dashboard', '/operations/dashboard', ServerIcon, ADMIN, '011', DASHBOARD, 'available'),
  ),
  system(entry('logs', '/operations/logs', LogsIcon, ADMIN, '011', DASHBOARD, 'available')),
  system(entry('mailQueue', '/operations/mail-queue', QueueIcon, ADMIN, '011', QUEUE, 'available')),
  system(entry('fail2ban', '/operations/fail2ban', ShieldIcon, ADMIN, '011', SYSTEM, 'available')),
  entry(
    'identityProviders',
    '/identity-providers',
    LockIcon,
    ADMIN,
    '012',
    { admin: ['/admin/system'] },
    'available',
  ),
  entry('system', '/system', GearIcon, ADMIN, '013', { admin: ['/admin/system'] }, 'available'),
  entry('apiKeys', '/api-keys', KeyIcon, ADMIN, '001', {}, 'available'),
  entry('auditLog', '/audit-log', ListIcon, ADMIN, '001', {}, 'available'),
]

export function findEntry(id: string | undefined | null): NavigationEntry | undefined {
  return id ? catalogue.find((item) => item.id === id) : undefined
}

export interface PlaceholderRouteSpec {
  name: `placeholder-${NavEntryId}`
  path: string
  navEntry: NavEntryId
}

/** One placeholder route per entry that is not available yet (FR-044, SC-007). */
export function placeholderRouteSpecs(): PlaceholderRouteSpec[] {
  return catalogue
    .filter((item) => item.status !== 'available')
    .map((item) => ({ name: `placeholder-${item.id}`, path: item.path, navEntry: item.id }))
}
