// The texts of the "Allow to send as" entries, as the classic multi-select shows them: a domain and
// `*` as `edit.dont_check_sender_acl` with the domain name, an address as it is, and legacy's
// subtexts ("Admin", "Alias", "Alias (allowed)", "Alias (blocked)", hard-coded in the template,
// so new strings with English equal to legacy's) plus "No longer exists".
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'

import type { SenderSubtext } from './send-as-model'

export function entryLabel(entry: { type: string; valueUnicode: string }): string {
  if (entry.type === 'domain' || entry.type === 'anyAddress') {
    return lt('edit.dont_check_sender_acl', entry.valueUnicode.replace(/^@/, ''))
  }
  return entry.valueUnicode
}

export function useSubtextLabel() {
  const { t } = useI18n()
  return (subtext: SenderSubtext | null): string | null =>
    subtext ? t(`senderSettings.subtext.${subtext}`) : null
}
