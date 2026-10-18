// Translates client rule errors (`client-errors.ts`) into field messages: mailcow's own messages by their
// legacy key, new strings with their parameters; a `field` parameter is a field label key and is
// translated too (`text()`, so a label with a classic text shows mailcow's).
import { useI18n } from 'vue-i18n'

import { resolveText, text } from '@/i18n'
import { isLegacyRef } from '@/i18n/text'

import type { ClientErrors } from '../validation/client-errors'

export function useClientErrors() {
  const { t } = useI18n()
  return (errors: ClientErrors): Record<string, string[]> =>
    Object.fromEntries(
      Object.entries(errors).map(([path, list]) => [
        path,
        list.map((error) => {
          if (isLegacyRef(error.key)) return resolveText(error.key, t)
          const params = { ...error.params }
          if (params.field) params.field = text(params.field)
          return Object.keys(params).length > 0 ? t(error.key, params) : t(error.key)
        }),
      ]),
    )
}
