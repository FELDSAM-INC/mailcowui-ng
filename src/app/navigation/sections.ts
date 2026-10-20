// Owner-directed navigation, 2026-10-20. Menu placement is independent of route access: hidden
// account/passkey/MTA-STS entries retain their catalogue permissions and direct addresses.
import type { Component } from 'vue'

import type { Identity, Role } from '@/api'
import { legacy, type TextRef } from '@/i18n'
import {
  ArrowLeftRightIcon,
  FilterIcon,
  GearIcon,
  MailIcon,
  ServerIcon,
  UsersIcon,
} from '@/shared/icons'

import { findEntry, type NavEntryId } from './catalogue'
import { canAccess } from './visibility'

interface TabSpec {
  id: string
  labelKey: TextRef
  path?: string
  entry?: NavEntryId
  roles?: readonly Role[]
  /** Roadmap destinations are visible, but never behave like links. */
  pending?: boolean
  matches?: readonly string[]
}
interface SectionSpec {
  id: string
  labelKey: TextRef
  icon: Component
  tabs: readonly TabSpec[]
}
export interface NavigationTab {
  id: string
  labelKey: TextRef
  to?: string
  disabled: boolean
  current: boolean
}
export interface NavigationSection {
  id: string
  labelKey: TextRef
  icon: Component
  to?: string
  tabs: NavigationTab[]
  current: boolean
}
export interface SidebarSection {
  id: string
  labelKey?: TextRef
  items: NavigationSection[]
}

const ADMIN: readonly Role[] = ['admin']
const tab = (entry: NavEntryId, extra: Partial<TabSpec> = {}): TabSpec => {
  const item = findEntry(entry)!
  return { id: entry, labelKey: item.labelKey, path: item.path, entry, ...extra }
}
const single = (id: NavEntryId): SectionSpec => {
  const item = findEntry(id)!
  return { id, labelKey: item.labelKey, icon: item.icon, tabs: [tab(id)] }
}
const pending = (id: string, labelKey: TextRef): TabSpec => ({
  id,
  labelKey,
  roles: ADMIN,
  pending: true,
})

const emailRouting: SectionSpec = {
  id: 'emailRouting',
  labelKey: legacy('admin.routing'),
  icon: ArrowLeftRightIcon,
  tabs: [
    tab('routing', {
      id: 'bccMaps',
      labelKey: legacy('mailbox.bcc_maps'),
      path: '/routing/bcc-maps',
      matches: ['/routing'],
    }),
    tab('routing', {
      id: 'recipientMaps',
      labelKey: legacy('mailbox.recipient_maps'),
      path: '/routing/recipient-maps',
      roles: ADMIN,
    }),
    tab('routing', {
      id: 'tlsPolicyMaps',
      labelKey: legacy('mailbox.tls_policy_maps'),
      path: '/routing/tls-policy-maps',
      roles: ADMIN,
    }),
  ],
}

const groups: readonly { id: string; labelKey?: TextRef; items: readonly SectionSpec[] }[] = [
  {
    id: 'email',
    labelKey: 'nav.groups.emailConfiguration',
    items: [
      { ...single('domains'), tabs: [tab('domains'), tab('domainTemplates')] },
      { ...single('mailboxes'), tabs: [tab('mailboxes'), tab('mailboxTemplates')] },
      { ...single('aliases'), tabs: [tab('aliases'), tab('aliasDomains')] },
      single('resources'),
      single('filters'),
      single('syncJobs'),
      emailRouting,
    ],
  },
  { id: 'quarantine', items: [single('quarantine'), single('spamFilter')] },
  {
    id: 'system',
    labelKey: legacy('header.mailcow_system'),
    items: [
      {
        id: 'systemContainers',
        labelKey: legacy('debug.system_containers'),
        icon: ServerIcon,
        tabs: [
          tab('dashboard', { matches: ['/operations/containers'] }),
          tab('logs'),
          tab('auditLog'),
        ],
      },
    ],
  },
  {
    id: 'configuration',
    labelKey: 'nav.groups.systemConfiguration',
    items: [
      {
        id: 'access',
        labelKey: legacy('admin.access'),
        icon: UsersIcon,
        tabs: [
          tab('administrators', {
            pending: findEntry('administrators')?.status !== 'available',
          }),
          tab('domainAdmins'),
          tab('apiKeys'),
          tab('identityProviders', {
            labelKey: legacy('admin.iam'),
            path: '/identity-providers/provider',
            matches: ['/identity-providers'],
          }),
          tab('identityProviders', {
            id: 'oauth2Apps',
            labelKey: legacy('admin.oauth2_apps'),
            path: '/identity-providers/oauth2-apps',
          }),
          {
            id: 'rspamdUi',
            labelKey: 'nav.rspamdUi',
            path: '/system/rspamd-web-interface',
            roles: ADMIN,
          },
        ],
      },
      {
        id: 'options',
        labelKey: legacy('admin.options'),
        icon: GearIcon,
        tabs: [
          tab('dkimKeys', { matches: ['/dns/dkim-import', '/dns/diagnostics'] }),
          tab('routing', {
            id: 'forwardingHosts',
            labelKey: legacy('admin.forwarding_hosts'),
            path: '/routing/forwarding-hosts',
            roles: ADMIN,
          }),
          tab('fail2ban'),
          {
            id: 'quotaNotifications',
            labelKey: legacy('admin.quota_notifications'),
            path: '/system/quota-notifications',
            roles: ['admin'],
          },
          {
            id: 'rspamdSettingsMap',
            labelKey: legacy('admin.rspamd_settings_map'),
            path: '/system/rspamd-rules',
            matches: ['/system/rspamd-effective-map'],
            roles: ADMIN,
          },
          {
            id: 'passwordSettings',
            labelKey: legacy('admin.password_settings'),
            path: '/system/password-policy',
            roles: ADMIN,
          },
          pending('customize', legacy('admin.customize')),
        ],
      },
      {
        id: 'systemRouting',
        labelKey: legacy('admin.routing'),
        icon: ArrowLeftRightIcon,
        tabs: [
          tab('routing', {
            id: 'relayhosts',
            labelKey: legacy('admin.relayhosts'),
            path: '/routing/relayhosts',
            roles: ADMIN,
          }),
          tab('routing', {
            id: 'transports',
            labelKey: legacy('admin.transport_maps'),
            path: '/routing/transports',
            roles: ADMIN,
          }),
        ],
      },
      {
        id: 'systemMails',
        labelKey: legacy('admin.sys_mails'),
        icon: MailIcon,
        tabs: [pending('systemMails', legacy('admin.sys_mails'))],
      },
      {
        id: 'globalFilterMaps',
        labelKey: legacy('admin.rspamd_global_filters'),
        icon: FilterIcon,
        tabs: [
          tab('system', {
            id: 'globalFilterMaps',
            labelKey: legacy('admin.rspamd_global_filters'),
            path: '/system/filter-maps',
            roles: ADMIN,
          }),
        ],
      },
    ],
  },
]

function matches(path: string, candidate: TabSpec): boolean {
  return (
    (!!candidate.path && (path === candidate.path || path.startsWith(`${candidate.path}/`))) ||
    !!candidate.matches?.some(
      (prefix) =>
        path === prefix ||
        (prefix !== '/routing' &&
          prefix !== '/identity-providers' &&
          path.startsWith(`${prefix}/`)),
    )
  )
}

/** A shared model for desktop navigation, the mobile drawer and content tabs. */
export function sidebarSections(
  identity: Identity | null | undefined,
  path = '',
): SidebarSection[] {
  if (!identity) return []
  return groups
    .map((group) => ({
      ...group,
      items: group.items
        .map((section): NavigationSection => {
          const tabs = section.tabs
            .filter(
              (item) =>
                (!item.entry || canAccess(item.entry, identity)) &&
                (!item.roles || item.roles.includes(identity.role)),
            )
            .map((item): NavigationTab => ({
              id: item.id,
              labelKey: item.labelKey,
              to: item.pending ? undefined : item.path,
              disabled: !!item.pending,
              current: matches(path, item),
            }))
          return {
            id: section.id,
            labelKey: section.labelKey,
            icon: section.icon,
            tabs,
            to: tabs.find((item) => !item.disabled)?.to,
            current: tabs.some((item) => item.current),
          }
        })
        .filter((item) => item.tabs.length > 0),
    }))
    .filter((group) => group.items.length > 0)
}

export function activeSection(
  path: string,
  identity: Identity | null | undefined,
): NavigationSection | undefined {
  return sidebarSections(identity, path)
    .flatMap((group) => group.items)
    .find((item) => item.current)
}
