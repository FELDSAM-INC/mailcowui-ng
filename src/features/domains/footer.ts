// The domain-wide footer (UI 002 US7, data-model §4 "Footer", FR-057 to FR-061), as the classic
// tab `templates/edit/domain.twig` #dfooter edits it: the exclusions, "ignore footer on reply
// e-mails" and the HTML and plain texts as source, never rendered (FR-059). The texts are limited
// in UTF-8 bytes (`capabilities.footerTextMaxBytes`).
import type { DomainFooter, DomainFooterReplace } from '@/api'

import { add, type ClientErrors } from './form-rules'

export interface FooterForm {
  excludedAddresses: string[]
  excludedAliasDomains: string[]
  skipReplies: boolean
  html: string
  plain: string
}

export const FOOTER_FIELDS = [
  'excludedAddresses',
  'excludedAliasDomains',
  'skipReplies',
  'html',
  'plain',
] as const satisfies readonly (keyof DomainFooter)[]

export function footerForm(footer: DomainFooter): FooterForm {
  return {
    excludedAddresses: [...footer.excludedAddresses],
    excludedAliasDomains: [...footer.excludedAliasDomains],
    skipReplies: footer.skipReplies,
    html: footer.html,
    plain: footer.plain,
  }
}

export function toFooterReplace(form: FooterForm): DomainFooterReplace {
  return {
    html: form.html,
    plain: form.plain,
    skipReplies: form.skipReplies,
    excludedAddresses: [...form.excludedAddresses],
    excludedAliasDomains: [...form.excludedAliasDomains],
  }
}

/** The size of a text in UTF-8 bytes, as the API measures it. */
export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length
}

/** The size limit of the two texts (data-model §6). */
export function validateFooter(
  form: FooterForm,
  maxBytes: number,
  format: { size: (bytes: number) => string },
): ClientErrors {
  const errors: ClientErrors = {}
  for (const path of ['html', 'plain'] as const) {
    if (utf8Bytes(form[path]) > maxBytes) {
      add(errors, path, { key: 'validation.tooLongBytes', params: { max: format.size(maxBytes) } })
    }
  }
  return errors
}

/**
 * The values a "Save again" sends after a 412: the reloaded footer with the user's changes (the
 * fields that differ from the version the form was opened with) applied, because the footer is
 * replaced as a whole.
 */
export function mergeFooterChanges(
  opened: DomainFooter,
  latest: DomainFooter,
  form: FooterForm,
): FooterForm {
  const base = footerForm(latest)
  const start = footerForm(opened)
  const merged = { ...base }
  for (const field of FOOTER_FIELDS) {
    if (JSON.stringify(form[field]) !== JSON.stringify(start[field])) {
      ;(merged as Record<string, unknown>)[field] = form[field]
    }
  }
  return merged
}
