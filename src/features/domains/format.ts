// Display formatting of domain values for the user's language (FR-016): counts, sizes (storage
// rounded, quotas exact), rate limits with the classic frame labels, times in the device time zone.
import { useI18n } from 'vue-i18n'

import { lt, text } from '@/i18n'
import type { DomainRateLimit } from '@/api'
import { useFormat } from '@/i18n/format'

export function useDomainFormat() {
  const { t } = useI18n()
  const fmt = useFormat()
  return {
    count: (value: number) => fmt.number(value),
    /** Storage and usage, rounded to one decimal. */
    size: (bytes: number) => fmt.bytes(bytes),
    /** Limits and quotas, in the largest exact unit. */
    quota: (bytes: number) => fmt.bytes(bytes, { exact: true }),
    rateLimit: (rateLimit: DomainRateLimit | null) =>
      rateLimit
        ? t('domains.values.rateLimit', {
            value: fmt.number(rateLimit.value),
            frame: text(`domains.rateLimit.frame.${rateLimit.frame}`),
          })
        : t('domains.values.none'),
    yesNo: (value: boolean) => t(value ? 'domains.values.yes' : 'domains.values.no'),
    time: (value: string | null) => (value ? fmt.dateTime(value) : lt('user.never')),
    list: (values: readonly string[]) => fmt.list(values),
  }
}
