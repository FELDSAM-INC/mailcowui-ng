// The outcomes of a domain creation as the classic alerts (UI 002 T022, FR-026, docs/conventions.md
// "Outcomes"): one alert per outcome, in legacy's order, with the key legacy returns and its
// argument; new strings only for what legacy cannot report.
import { describe, expect, it } from 'vitest'

import { creationAlerts, type CreationAlert } from '@/features/domains/creation-report'

/** An alert's key: the legacy key, or the new string's key. */
const keyOf = (alert: CreationAlert) =>
  typeof alert.text === 'string' ? alert.text : alert.text.legacy

describe('creationAlerts', () => {
  it('reports the rate limit, the DKIM key and the domain as legacy does', () => {
    expect(
      creationAlerts('new.example', {
        rateLimit: 'applied',
        dkimKey: 'created',
        dkimDnsPublication: 'published',
        groupwareRestart: 'done',
      }),
    ).toEqual([
      { kind: 'success', text: { legacy: 'success.rl_saved', args: ['new.example'] }, params: [] },
      {
        kind: 'success',
        text: { legacy: 'success.dkim_added', args: ['new.example'] },
        params: [],
      },
      {
        kind: 'success',
        text: { legacy: 'success.domain_added', args: ['new.example'] },
        params: [],
      },
    ])
  })

  it('shows nothing for steps legacy reports nothing for', () => {
    expect(
      creationAlerts('plain.example', {
        rateLimit: 'notRequested',
        dkimKey: 'notRequested',
        dkimDnsPublication: 'skipped',
        groupwareRestart: 'groupwareDisabled',
      }).map(keyOf),
    ).toEqual(['success.domain_added'])
  })

  it('reports an existing key, failures and a failed restart instead of "added"', () => {
    expect(
      creationAlerts('x.example', {
        rateLimit: 'failed',
        dkimKey: 'alreadyExisted',
        dkimDnsPublication: 'skipped',
        groupwareRestart: 'failed',
        messages: { groupwareRestart: 'English, never shown' },
      }),
    ).toEqual([
      { kind: 'danger', text: 'domains.outcome.rateLimitFailed', params: ['x.example'] },
      { kind: 'success', text: { legacy: 'success.domain_add_dkim_available' }, params: [] },
      { kind: 'warning', text: { legacy: 'warning.domain_added_sogo_failed' }, params: [] },
    ])
  })

  it("uses legacy's DKIM refusal for a failed key and new strings only for the DNS publication", () => {
    expect(
      creationAlerts('y.example', {
        rateLimit: 'notRequested',
        dkimKey: 'failed',
        dkimDnsPublication: 'noZone',
        groupwareRestart: 'notRequested',
      }).map((alert) => [alert.kind, keyOf(alert)]),
    ).toEqual([
      ['danger', 'danger.dkim_domain_or_sel_invalid'],
      ['warning', 'domains.outcome.dkimDnsNoZone'],
      ['success', 'success.domain_added'],
    ])
    expect(
      creationAlerts('y.example', {
        rateLimit: 'notRequested',
        dkimKey: 'created',
        dkimDnsPublication: 'failed',
        groupwareRestart: 'notRequested',
      }).map(keyOf),
    ).toContain('domains.outcome.dkimDnsFailed')
  })
})
