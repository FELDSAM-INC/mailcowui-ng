// The outcomes of an alias domain creation as legacy's alerts (T063; docs/conventions.md
// "Outcomes", legacy form map part 2): in legacy's order, the rate limit, the DKIM key, the DKIM
// DNS publication (FeldHost), the groupware directory, then `success.aliasd_added`; steps legacy
// reports nothing for show no alert.
import { describe, expect, it } from 'vitest'

import { creationAlerts } from '@/features/alias-domains/creation-report'
import { isLegacyRef } from '@/i18n/text'

const keyOf = (alert: ReturnType<typeof creationAlerts>[number]) =>
  isLegacyRef(alert.text) ? alert.text.legacy : alert.text

describe('creationAlerts', () => {
  it('lists the outcomes in legacy order with their kinds', () => {
    const alerts = creationAlerts('new.example', {
      rateLimit: 'applied',
      dkimKey: 'created',
      dkimDnsPublication: 'noZone',
      groupwareDirectoryUpdate: 'failed',
    })
    expect(alerts.map((alert) => [alert.kind, keyOf(alert)])).toEqual([
      ['success', 'success.rl_saved'],
      ['success', 'success.dkim_added'],
      ['warning', 'domains.outcome.dkimDnsNoZone'],
      ['warning', 'aliasDomains.outcome.groupwareFailed'],
      ['success', 'success.aliasd_added'],
    ])
  })

  it('shows nothing for steps not requested, and danger for failures', () => {
    const alerts = creationAlerts('new.example', {
      rateLimit: 'failed',
      dkimKey: 'failed',
      dkimDnsPublication: 'skipped',
      groupwareDirectoryUpdate: 'groupwareDisabled',
    })
    expect(alerts.map((alert) => [alert.kind, keyOf(alert)])).toEqual([
      ['danger', 'domains.outcome.rateLimitFailed'],
      ['danger', 'danger.dkim_domain_or_sel_invalid'],
      ['success', 'success.aliasd_added'],
    ])
    const quiet = creationAlerts('new.example', {
      rateLimit: 'notRequested',
      dkimKey: 'notRequested',
      dkimDnsPublication: 'notConfigured',
      groupwareDirectoryUpdate: 'done',
    })
    expect(quiet.map(keyOf)).toEqual(['success.aliasd_added'])
    const existed = creationAlerts('new.example', {
      rateLimit: 'notRequested',
      dkimKey: 'alreadyExisted',
      dkimDnsPublication: 'skipped',
      groupwareDirectoryUpdate: 'done',
    })
    expect(existed.map(keyOf)).toEqual([
      'success.domain_add_dkim_available',
      'success.aliasd_added',
    ])
  })
})
