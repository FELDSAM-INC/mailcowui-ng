// The section registry (UI 005 T014, data-model §2, FR-002 to FR-004, SC-009; decision D1): every
// section of My account for every role, each user flag on and off, the externally managed
// password, the groupware and an unreadable capabilities read; and the mailbox context's access
// for administrators and domain administrators with and without their own flags.
import { describe, expect, it } from 'vitest'

import type { Identity, PermissionFlags, Role, SelfServiceCapabilities } from '@/api'
import {
  ACCOUNT_SECTIONS,
  mailboxAccess,
  mailboxSettingsParts,
  ownSettingsParts,
  ownVisibility,
  type AccountSectionId,
} from '@/features/account/sections'

import { permissionFlags } from '../../../mocks/scenarios/accounts'

function identity(role: Role, flags: Partial<PermissionFlags> = {}): Identity {
  return {
    username: role === 'mailboxUser' ? 'anna@example.org' : role,
    role,
    authentication: { method: 'password' },
    scope:
      role === 'mailboxUser'
        ? { type: 'mailbox', mailbox: 'anna@example.org', domain: 'example.org' }
        : { type: 'allDomains' },
    permissions: permissionFlags(role === 'admin', flags),
    pendingActions: [],
  }
}

function caps(
  options: { pw?: boolean; tf?: boolean; gw?: boolean; role?: Role } = {},
): SelfServiceCapabilities {
  return {
    passwordReset: { available: true, tokenLifetimeMinutes: 15 },
    groupware: { enabled: options.gw ?? true, webmailUrl: '/SOGo/so/' },
    account: {
      role: options.role ?? 'mailboxUser',
      secondFactorRequired: false,
      passwordChangeAvailable: options.pw ?? true,
      secondFactorManagementAvailable: options.tf ?? true,
    },
  }
}

const USER_FLAGS = [
  'pwReset',
  'spamAlias',
  'appPasswds',
  'pushover',
  'delimiterAction',
  'tlsPolicy',
  'easReset',
  'sogoProfileReset',
] as const

const all = (value: boolean) =>
  Object.fromEntries(USER_FLAGS.map((name) => [name, value])) as Partial<PermissionFlags>

const ids = ACCOUNT_SECTIONS.map((section) => section.id)

describe('the registry', () => {
  it('lists the sections in the order of the classic user page', () => {
    expect(ids).toEqual([
      'overview',
      'mailApps',
      'activeScript',
      'password',
      'recoveryEmail',
      'twoFactor',
      'passkeys',
      'recentLogins',
      'mailSettings',
      'temporaryAliases',
      'appPasswords',
      'pushNotifications',
      'filters',
    ])
  })
})

describe('ownVisibility: administrators and domain administrators', () => {
  it.each(['admin', 'domainAdmin'] as const)(
    '%s: password, two-factor and passkeys only',
    (role) => {
      const who = identity(role)
      const shown = ids.filter((id) => ownVisibility(id, who, caps({ role })) === 'visible')
      expect(shown).toEqual(['password', 'twoFactor', 'passkeys'])
      expect(ownVisibility('mailApps', who, caps({ role }))).toBe('hidden')
    },
  )

  it('unknown without the capabilities, except passkeys', () => {
    const who = identity('domainAdmin')
    expect(ownVisibility('password', who, null)).toBe('unknown')
    expect(ownVisibility('twoFactor', who, null)).toBe('unknown')
    expect(ownVisibility('passkeys', who, null)).toBe('visible')
  })
})

describe('ownVisibility: mailbox users (FR-002)', () => {
  it('shows every section with every flag on', () => {
    const who = identity('mailboxUser', all(true))
    const shown = ids.filter((id) => ownVisibility(id, who, caps()) === 'visible')
    expect(shown).toEqual(ids.filter((id) => id !== 'filters'))
  })

  it('keeps the flag-free sections with every flag off', () => {
    const who = identity('mailboxUser', all(false))
    const shown = ids.filter((id) => ownVisibility(id, who, caps()) === 'visible')
    expect(shown).toEqual([
      'overview',
      'mailApps',
      'activeScript',
      'password',
      'twoFactor',
      'passkeys',
      'recentLogins',
    ])
  })

  const single: [AccountSectionId, (typeof USER_FLAGS)[number]][] = [
    ['recoveryEmail', 'pwReset'],
    ['temporaryAliases', 'spamAlias'],
    ['appPasswords', 'appPasswds'],
    ['pushNotifications', 'pushover'],
  ]
  it.each(single)('%s follows %s', (id, name) => {
    expect(ownVisibility(id, identity('mailboxUser', { [name]: true }), caps())).toBe('visible')
    expect(ownVisibility(id, identity('mailboxUser', { [name]: false }), caps())).toBe('hidden')
  })

  it.each(['delimiterAction', 'tlsPolicy', 'easReset', 'sogoProfileReset'] as const)(
    'Settings is shown with %s alone',
    (name) => {
      expect(ownVisibility('mailSettings', identity('mailboxUser', { [name]: true }), caps())).toBe(
        'visible',
      )
    },
  )

  it('Settings with only the resets follows the groupware', () => {
    const who = identity('mailboxUser', { easReset: true, sogoProfileReset: true })
    expect(ownVisibility('mailSettings', who, caps({ gw: false }))).toBe('hidden')
    expect(ownVisibility('mailSettings', who, null)).toBe('unknown')
    expect(ownSettingsParts(who, caps())).toEqual(['easReset', 'sogoProfileReset'])
    expect(ownSettingsParts(who, caps({ gw: false }))).toEqual([])
  })

  it('replaces the password and hides recovery and two-factor for an external source', () => {
    const who = identity('mailboxUser', all(true))
    const external = caps({ pw: false, tf: false })
    expect(ownVisibility('password', who, external)).toBe('replaced')
    expect(ownVisibility('recoveryEmail', who, external)).toBe('hidden')
    expect(ownVisibility('twoFactor', who, external)).toBe('hidden')
    expect(ownVisibility('appPasswords', who, external)).toBe('visible')
  })

  it('is unknown where a rule needs the unreadable capabilities', () => {
    const who = identity('mailboxUser', all(true))
    expect(ownVisibility('password', who, null)).toBe('unknown')
    expect(ownVisibility('recoveryEmail', who, null)).toBe('unknown')
    expect(ownVisibility('twoFactor', who, null)).toBe('unknown')
    expect(ownVisibility('appPasswords', who, null)).toBe('visible')
  })

  it('hides everything without an identity', () => {
    expect(ownVisibility('passkeys', null, caps())).toBe('hidden')
  })
})

describe('mailboxAccess (FR-003, FR-004)', () => {
  const contextIds = ACCOUNT_SECTIONS.filter((section) => section.mailboxRoute).map((s) => s.id)

  it('lets administrators change every mailbox-context section', () => {
    for (const id of contextIds)
      expect(mailboxAccess(id, identity('admin'))).toEqual({ mode: 'change' })
  })

  it('makes app passwords, Pushover and filters read-only without the domain administrator flag', () => {
    const without = identity('domainAdmin', { appPasswds: false, pushover: false, filters: false })
    expect(mailboxAccess('appPasswords', without)).toEqual({ mode: 'readOnly', flag: 'appPasswds' })
    expect(mailboxAccess('pushNotifications', without)).toEqual({
      mode: 'readOnly',
      flag: 'pushover',
    })
    expect(mailboxAccess('filters', without)).toEqual({ mode: 'readOnly', flag: 'filters' })
    for (const id of ['temporaryAliases', 'mailSettings', 'recentLogins'] as const) {
      expect(mailboxAccess(id, without)).toEqual({ mode: 'change' })
    }
    const withFlags = identity('domainAdmin', { appPasswds: true, pushover: true, filters: true })
    for (const id of contextIds) expect(mailboxAccess(id, withFlags)).toEqual({ mode: 'change' })
  })

  it('hides own-only sections and the mailbox context from mailbox users', () => {
    expect(mailboxAccess('password', identity('admin'))).toEqual({ mode: 'hidden' })
    expect(mailboxAccess('appPasswords', identity('mailboxUser', all(true)))).toEqual({
      mode: 'hidden',
    })
  })

  it('offers the groupware resets in Settings only with the groupware', () => {
    expect(mailboxSettingsParts(caps())).toEqual([
      'taggedMail',
      'tlsPolicy',
      'easReset',
      'sogoProfileReset',
    ])
    expect(mailboxSettingsParts(caps({ gw: false }))).toEqual(['taggedMail', 'tlsPolicy'])
  })
})
