// The outcomes of a domain alias creation (FR-038; legacy form map part 2), shown as the classic
// interface shows them: one alert per outcome, in the order `mailbox('add', 'alias_domain')`
// reports them (`inc/functions.mailbox.inc.php`, `inc/functions.ratelimit.inc.php`,
// `inc/functions.dkim.inc.php`), with the key legacy returns (docs/conventions.md "Outcomes").
// Steps legacy reports nothing for (nothing requested, DKIM DNS publication done, not configured or
// skipped, the groupware directory updated or disabled) show no alert. New strings only for what
// legacy cannot report: UI 002's failed rate limit and DKIM DNS publication outcomes, and a failed
// groupware directory update. The placeholder is the ASCII name, as legacy fills it.
import type { AliasDomainCreationReport } from '@/api'
import { legacy, type LegacyKey } from '@/i18n'
import type { AlertKind, CreationAlert } from '@/shared/components/creation-alert'

export function creationAlerts(name: string, report: AliasDomainCreationReport): CreationAlert[] {
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

  if (report.groupwareDirectoryUpdate === 'failed') {
    added('warning', 'aliasDomains.outcome.groupwareFailed')
  }
  classic('success', 'success.aliasd_added')
  return alerts
}
