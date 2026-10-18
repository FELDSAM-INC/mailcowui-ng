// Authentication sources (UI 003 T027, FR-024, FR-036): the options the capabilities report plus
// the mailbox's own external source, the built-in one named by the product, and the controls each
// source has.
import { describe, expect, it } from 'vitest'

import {
  authSourceLabelKey,
  authSourceOptions,
  controlsFor,
} from '@/features/mailboxes/auth-source'

describe('options', () => {
  it('lists the capabilities’ sources, the built-in first, plus the current external one', () => {
    expect(authSourceOptions({ authSources: ['ldap', 'mailcow'] })).toEqual(['mailcow', 'ldap'])
    expect(authSourceOptions({ authSources: ['mailcow'] }, 'keycloak')).toEqual([
      'mailcow',
      'keycloak',
    ])
  })

  it('offers only the built-in source when the capabilities failed', () => {
    expect(authSourceOptions(undefined)).toEqual(['mailcow'])
    expect(authSourceOptions(undefined, 'ldap')).toEqual(['mailcow', 'ldap'])
  })

  it('labels the built-in source with the product name and the others as legacy writes them', () => {
    expect(authSourceLabelKey('mailcow')).toBeNull()
    expect(authSourceLabelKey('genericOidc')).toBe('mailboxes.authSource.genericOidc')
  })
})

describe('controls (legacy edit form)', () => {
  it('shows the password and recovery e-mail only for the built-in source', () => {
    expect(controlsFor('mailcow')).toEqual({
      password: true,
      recoveryEmail: true,
      forcePasswordChange: true,
      forceSecondFactorSetup: true,
    })
    expect(controlsFor('ldap')).toEqual({
      password: false,
      recoveryEmail: false,
      forcePasswordChange: false,
      forceSecondFactorSetup: true,
    })
    expect(controlsFor('genericOidc').forceSecondFactorSetup).toBe(false)
  })
})
