// The outcomes of a domain creation (UI 002 FR-026), shown as the classic interface shows them:
// one alert per outcome, in the order `mailbox('add', 'domain')` reports them
// (`inc/functions.mailbox.inc.php`, `inc/functions.dkim.inc.php`, `inc/functions.ratelimit.inc.php`),
// with the key legacy returns (docs/conventions.md "Outcomes"). Steps legacy reports nothing for
// (nothing requested, groupware disabled, DKIM DNS publication done or not configured) show no
// alert. New strings exist only for what legacy cannot report: a failed rate limit and the DKIM DNS
// publication outcomes "no zone" and "failed" (FeldHost). The placeholder is the ASCII domain name,
// as legacy fills it.
import type { DomainCreationReport } from '@/api'
import { legacy, type LegacyKey, type TextRef } from '@/i18n'

export type AlertKind = 'success' | 'warning' | 'danger'

export interface CreationAlert {
  kind: AlertKind
  /** mailcow's own text with its argument, or a new string's key (filled with `params`). */
  text: TextRef
  params: string[]
}

export function creationAlerts(name: string, report: DomainCreationReport): CreationAlert[] {
  const alerts: CreationAlert[] = []
  const classic = (kind: AlertKind, key: LegacyKey, withName = true) =>
    alerts.push({ kind, text: withName ? legacy(key, name) : legacy(key), params: [] })
  const added = (kind: AlertKind, key: string) => alerts.push({ kind, text: key, params: [name] })

  if (report.rateLimit === 'applied') classic('success', 'success.rl_saved')
  else if (report.rateLimit === 'failed') added('danger', 'domains.outcome.rateLimitFailed')

  if (report.dkimKey === 'created') classic('success', 'success.dkim_added')
  else if (report.dkimKey === 'alreadyExisted')
    classic('success', 'success.domain_add_dkim_available', false)
  else if (report.dkimKey === 'failed') classic('danger', 'danger.dkim_domain_or_sel_invalid')

  if (report.dkimDnsPublication === 'noZone') added('warning', 'domains.outcome.dkimDnsNoZone')
  else if (report.dkimDnsPublication === 'failed') added('warning', 'domains.outcome.dkimDnsFailed')

  if (report.groupwareRestart === 'failed')
    classic('warning', 'warning.domain_added_sogo_failed', false)
  else classic('success', 'success.domain_added')
  return alerts
}
