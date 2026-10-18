// The messages of the redirect URI rules (FR-058, FR-061): the classic interface's hard-coded
// "Redirect/Callback URL cannot be empty" (a new string with the same English text), and the
// contract's format and length rules, each invalid URI named before its message.
import { useI18n } from 'vue-i18n'

import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'

import type { RedirectUriProblem } from '../redirect-uris'

export function useRedirectUriMessages() {
  const { t, locale } = useI18n()
  return (problems: readonly RedirectUriProblem[]): string[] =>
    problems.map((problem) => {
      switch (problem.kind) {
        case 'empty':
          return t('oauth2.redirectUriEmpty')
        case 'invalid':
          return `${problem.uri}: ${t('validation.format.redirectUri')}`
        case 'tooLong':
          return t('validation.tooLong', {
            max: formatNumber(problem.max, locale.value as AppLocale),
          })
      }
    })
}
