import { describe, expect, it } from 'vitest'

import type { Identity } from '@/api'
import { activeSection, sidebarSections } from '@/app/navigation/sections'
import { defaultLandingPath } from '@/app/navigation/landing'
import { canAccess } from '@/app/navigation/visibility'

function identity(role: Identity['role'], syncjobs = true): Identity {
  return { role, permissions: { syncjobs, spamScore: true } } as Identity
}

describe('requested application navigation', () => {
  it('groups the administrator sidebar without showing individual tabs as sidebar links', () => {
    const groups = sidebarSections(identity('admin'))
    expect(groups.map((group) => [group.id, group.items.map((item) => item.id)])).toEqual([
      [
        'email',
        ['domains', 'mailboxes', 'aliases', 'resources', 'filters', 'syncJobs', 'emailRouting'],
      ],
      ['quarantine', ['quarantine']],
      ['system', ['systemContainers']],
      ['configuration', ['access', 'options', 'systemRouting', 'systemMails', 'globalFilterMaps']],
    ])
    expect(groups.flatMap((group) => group.items).map((item) => item.id)).not.toEqual(
      expect.arrayContaining(['home', 'passkeys', 'account', 'mtaStsPolicies']),
    )
  })

  it('keeps exact requested tab groups and separates the two Routing sections', () => {
    const who = identity('admin')
    expect(activeSection('/domain-templates/new', who)?.tabs.map((tab) => tab.id)).toEqual([
      'domains',
      'domainTemplates',
    ])
    expect(activeSection('/mailboxes/alice@example.org', who)?.tabs.map((tab) => tab.id)).toEqual([
      'mailboxes',
      'mailboxTemplates',
    ])
    expect(activeSection('/alias-domains/example.org', who)?.tabs.map((tab) => tab.id)).toEqual([
      'aliases',
      'aliasDomains',
    ])
    expect(activeSection('/routing/bcc-maps/new', who)?.tabs.map((tab) => tab.id)).toEqual([
      'bccMaps',
      'recipientMaps',
      'tlsPolicyMaps',
    ])
    expect(activeSection('/routing/transports/42', who)?.tabs.map((tab) => tab.id)).toEqual([
      'relayhosts',
      'transports',
    ])
    expect(activeSection('/operations/logs/postfix', who)?.tabs.map((tab) => tab.id)).toEqual([
      'dashboard',
      'logs',
      'auditLog',
    ])
    expect(activeSection('/routing/forwarding-hosts', who)?.id).toBe('options')
    expect(
      activeSection('/administrators/domain-admins/reseller', who)?.tabs.map((tab) => tab.id),
    ).toEqual([
      'administrators',
      'domainAdmins',
      'apiKeys',
      'identityProviders',
      'oauth2Apps',
      'rspamdUi',
    ])
    expect(
      activeSection('/identity-providers/oauth2-apps/42', who)?.tabs.find((tab) => tab.current)?.id,
    ).toBe('oauth2Apps')
  })

  it('shows unfinished destinations as disabled, without a navigable target', () => {
    const sections = sidebarSections(identity('admin')).flatMap((group) => group.items)
    const unavailable = sections.flatMap((section) => section.tabs).filter((tab) => tab.disabled)
    expect(unavailable.map((tab) => tab.id)).toEqual(['customize', 'systemMails'])
    expect(unavailable.every((tab) => tab.to === undefined)).toBe(true)
    expect(sections.find((section) => section.id === 'access')?.to).toBe('/administrators/admins')
  })

  it('makes Password Settings an administrator Options tab', () => {
    const section = activeSection('/system/password-policy', identity('admin'))
    expect(section?.id).toBe('options')
    expect(section?.tabs.find((tab) => tab.current)).toMatchObject({
      id: 'passwordSettings',
      to: '/system/password-policy',
      disabled: false,
    })
    expect(activeSection('/system/password-policy', identity('domainAdmin'))).toBeUndefined()
    expect(activeSection('/system/password-policy', identity('mailboxUser'))).toBeUndefined()
  })

  it.each(['/dns/dkim-import', '/dns/diagnostics/example.org'])(
    'keeps Options active on the related DKIM screen %s',
    (path) => {
      const section = activeSection(path, identity('admin'))
      expect(section?.id).toBe('options')
      expect(section?.tabs.find((tab) => tab.current)?.id).toBe('dkimKeys')
    },
  )

  it('filters each tab by role, keeps read-only BCC access, and hides empty groups', () => {
    const who = identity('domainAdmin', false)
    const groups = sidebarSections(who)
    expect(groups.map((group) => group.id)).toEqual(['email', 'quarantine', 'configuration'])
    expect(groups.flatMap((group) => group.items).map((item) => item.id)).not.toContain('syncJobs')
    expect(activeSection('/domains', who)?.tabs.map((tab) => tab.id)).toEqual(['domains'])
    expect(activeSection('/routing/bcc-maps', who)?.tabs.map((tab) => tab.id)).toEqual(['bccMaps'])
    expect(activeSection('/api-keys', who)).toBeUndefined()
    expect(
      sidebarSections(identity('mailboxUser', false))
        .flatMap((group) => group.items)
        .map((item) => item.id),
    ).toEqual(['quarantine', 'spamFilter'])
    expect(sidebarSections(null)).toEqual([])
  })

  it('offers the delivered Rspamd UI page only to administrators in Access', () => {
    const section = activeSection('/system/rspamd-web-interface', identity('admin'))
    expect(section?.id).toBe('access')
    expect(section?.tabs.find((tab) => tab.id === 'rspamdUi')).toMatchObject({
      to: '/system/rspamd-web-interface',
      current: true,
      disabled: false,
    })
    expect(activeSection('/system/rspamd-web-interface', identity('domainAdmin'))).toBeUndefined()
    expect(activeSection('/system/rspamd-web-interface', identity('mailboxUser'))).toBeUndefined()
  })

  it('preserves direct access to settings removed from the sidebar', () => {
    expect(canAccess('account', identity('mailboxUser'))).toBe(true)
    expect(canAccess('passkeys', identity('domainAdmin'))).toBe(true)
    expect(canAccess('mtaStsPolicies', identity('domainAdmin'))).toBe(true)
  })

  it.each([
    ['admin', '/operations/dashboard'],
    ['domainAdmin', '/domains'],
    ['mailboxUser', '/account/password'],
  ] as const)('lands %s on the working section instead of Home', (role, path) => {
    expect(defaultLandingPath(identity(role))).toBe(path)
  })
})
