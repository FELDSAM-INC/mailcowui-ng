// The values of the legacy add mailbox and template forms (UI 003 T063, T104): read from a template
// or the built-in defaults, sent in full for a template, and for a new mailbox only where they
// differ from the chosen template (FR-025), with the quota always.
import { describe, expect, it } from 'vitest'

import {
  createRequest,
  templateBody,
  valuesFrom,
  type TemplateSource,
} from '@/features/mailboxes/form-values'

const MIB = 1_048_576

const template: TemplateSource = {
  quota: 1024 * MIB,
  status: 'active',
  forcePasswordChange: false,
  forceSecondFactorSetup: false,
  webmailRedirect: true,
  protocolAccess: { imap: true, pop3: false, smtp: true, sieve: true, activeSync: true, dav: true },
  userPermissions: {
    spamAlias: true,
    tlsPolicy: true,
    spamScore: true,
    spamPolicy: true,
    delimiterAction: true,
    syncjobs: true,
    easReset: true,
    sogoProfileReset: false,
    pushover: true,
    quarantine: true,
    quarantineAttachments: true,
    quarantineNotification: true,
    quarantineCategory: true,
    appPasswds: true,
    pwReset: true,
  },
  tags: ['Staff'],
  taggedMailHandling: 'none',
  quarantineNotification: 'hourly',
  quarantineCategory: 'rejected',
  tlsEnforceInbound: false,
  tlsEnforceOutbound: false,
  rateLimit: null,
}

describe('valuesFrom', () => {
  it('reads the selected protocols and permissions in legacy order and the quota in MiB', () => {
    const values = valuesFrom(template)
    expect(values.quota).toBe('1024')
    expect(values.protocols).toEqual(['imap', 'smtp', 'sieve', 'activeSync', 'dav'])
    expect(values.permissions).not.toContain('sogoProfileReset')
    expect(values.presentPermissions).toHaveLength(15)
    expect(values.rateLimitValue).toBe('')
    expect(values.rateLimitFrame).toBe('second')
  })

  it('reads only the permissions present for a domain administrator', () => {
    const { syncjobs: _hidden, ...visible } = template.userPermissions
    expect(valuesFrom({ ...template, userPermissions: visible }).presentPermissions).not.toContain(
      'syncjobs',
    )
  })
})

describe('templateBody', () => {
  it('sends every value the form shows', () => {
    const body = templateBody(valuesFrom(template), {
      quota: 2048 * MIB,
      rateLimit: { value: 10, frame: 'hour' },
    })
    expect(body).toEqual({
      quota: 2048 * MIB,
      status: 'active',
      forcePasswordChange: false,
      forceSecondFactorSetup: false,
      webmailRedirect: true,
      protocolAccess: template.protocolAccess,
      userPermissions: template.userPermissions,
      tags: ['Staff'],
      taggedMailHandling: 'none',
      quarantineNotification: 'hourly',
      quarantineCategory: 'rejected',
      tlsEnforceInbound: false,
      tlsEnforceOutbound: false,
      rateLimit: { value: 10, frame: 'hour' },
    })
  })
})

describe('createRequest (FR-025)', () => {
  const essentials = {
    localPart: ' Anna.Smith ',
    domain: 'example.org',
    displayName: '',
    templateId: 2,
    password: 'Secret-12345',
  }

  it('always holds the local part, domain, template, quota and password, and nothing equal to the template', () => {
    expect(
      createRequest(essentials, valuesFrom(template), template, {
        quota: 1024 * MIB,
        rateLimit: null,
      }),
    ).toEqual({
      localPart: 'anna.smith',
      domain: 'example.org',
      templateId: 2,
      quota: 1024 * MIB,
      password: 'Secret-12345',
    })
  })

  it('adds the display name and only the values that differ, nested members included', () => {
    const values = {
      ...valuesFrom(template),
      protocols: ['imap', 'pop3', 'smtp', 'sieve', 'activeSync', 'dav'] as const,
      permissions: valuesFrom(template).permissions.filter((item) => item !== 'syncjobs'),
      tags: ['staff'],
      status: 'inactive' as const,
      tlsEnforceInbound: true,
    }
    expect(
      createRequest(
        { ...essentials, displayName: 'Anna' },
        { ...values, protocols: [...values.protocols] },
        template,
        {
          quota: 0,
          rateLimit: { value: 5, frame: 'minute' },
        },
      ),
    ).toEqual({
      localPart: 'anna.smith',
      domain: 'example.org',
      templateId: 2,
      quota: 0,
      password: 'Secret-12345',
      displayName: 'Anna',
      status: 'inactive',
      protocolAccess: { pop3: true },
      userPermissions: { syncjobs: false },
      tlsEnforceInbound: true,
      rateLimit: { value: 5, frame: 'minute' },
    })
  })
})
