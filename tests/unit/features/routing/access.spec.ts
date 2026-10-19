// The routing access predicates (UI 009 T007, data-model §2): table-driven over the roles and the
// flags bccMaps, domainRelayhost and mailboxRelayhost.
import { describe, expect, it } from 'vitest'

import type { Identity, PermissionFlags } from '@/api'
import {
  canEditDomainRelayhost,
  canEditMailboxRelayhost,
  canListRelayhostChoices,
  canSeeHistory,
  canWriteBccMaps,
  canWriteRouting,
} from '@/features/routing/access'
import { canOpenScreen, findScreen, openScreens, ROUTING_SCREENS } from '@/features/routing/screens'

import { permissionFlags } from '../../../mocks/scenarios/accounts'

function identity(role: Identity['role'], flags: Partial<PermissionFlags> = {}): Identity {
  return {
    username: 'someone',
    role,
    permissions: permissionFlags(false, flags),
    scope:
      role === 'admin' ? { type: 'allDomains' } : { type: 'domains', domains: ['example.org'] },
  } as unknown as Identity
}

const admin = identity('admin')
const reseller = identity('domainAdmin')
const resellerAll = identity('domainAdmin', {
  bccMaps: true,
  domainRelayhost: true,
  mailboxRelayhost: true,
})
const user = identity('mailboxUser', { bccMaps: true, domainRelayhost: true })

describe('routing access', () => {
  it.each([
    ['admin', admin, [true, true, true, true, true, true]],
    ['domain administrator without flags', reseller, [false, false, false, false, false, false]],
    ['domain administrator with every flag', resellerAll, [false, true, true, true, true, false]],
    ['mailbox user', user, [false, false, false, false, false, false]],
  ])('%s', (_name, who, expected) => {
    expect([
      canWriteRouting(who),
      canWriteBccMaps(who),
      canEditDomainRelayhost(who),
      canEditMailboxRelayhost(who),
      canListRelayhostChoices(who),
      canSeeHistory(who),
    ]).toEqual(expected)
  })

  it('opens the BCC maps screen for every domain administrator, the others for administrators', () => {
    expect(canOpenScreen(reseller, findScreen('bccMaps'))).toBe(true)
    expect(canOpenScreen(reseller, findScreen('relayhosts'))).toBe(false)
    expect(canOpenScreen(user, findScreen('bccMaps'))).toBe(false)
    expect(canOpenScreen(admin, findScreen('forwardingHosts'))).toBe(true)
    expect(canOpenScreen(null, findScreen('bccMaps'))).toBe(false)
  })

  it('lists only the available screens in the order of FR-001', () => {
    const available = ROUTING_SCREENS.filter((screen) => screen.status === 'available')
    expect(openScreens(admin).map((screen) => screen.id)).toEqual(available.map((s) => s.id))
    expect(ROUTING_SCREENS.map((screen) => screen.id)).toEqual([
      'relayhosts',
      'transports',
      'tlsPolicyMaps',
      'recipientMaps',
      'bccMaps',
      'forwardingHosts',
    ])
    expect(canListRelayhostChoices(identity('domainAdmin', { mailboxRelayhost: true }))).toBe(true)
  })
})
