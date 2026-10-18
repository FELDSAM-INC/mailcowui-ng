// Display values of domain and template fields, for the outdated notice of a section ("now saved
// as …", FR-037).
import { useI18n } from 'vue-i18n'

import { text } from '@/i18n'
import type { DomainRateLimit } from '@/api'

import { FIELD_LABEL_KEYS, SIZE_FIELDS } from './field-labels'
import { useDomainFormat } from './format'

export function useFieldDisplay() {
  const { t } = useI18n()
  const format = useDomainFormat()

  function value(field: string, raw: unknown): string {
    if (SIZE_FIELDS.has(field) && typeof raw === 'number') return format.quota(raw)
    if (typeof raw === 'boolean') return format.yesNo(raw)
    if (typeof raw === 'number') return format.count(raw)
    if (Array.isArray(raw)) return raw.length > 0 ? raw.join(', ') : t('domains.values.none')
    if (field === 'rateLimit') return format.rateLimit(raw as DomainRateLimit | null)
    if (raw === null || raw === undefined || raw === '') return t('domains.values.none')
    return typeof raw === 'string' ? raw : JSON.stringify(raw)
  }

  const label = (field: string) => (FIELD_LABEL_KEYS[field] ? text(FIELD_LABEL_KEYS[field]) : field)

  /** The outdated notice entries of EditableSection. */
  function changes(fields: readonly { field: string; savedValue: unknown }[] | null) {
    return (
      fields?.map((item) => ({
        field: item.field,
        label: label(item.field),
        saved: value(item.field, item.savedValue),
      })) ?? null
    )
  }

  return { value, label, changes }
}
