// Field messages of the sync-job forms (UI 008 research R13, plan legacy form map part 2), through
// the shared form-context lookup (UI 004 research R17): `syncJobs.form.errors.<field>.<code>` (and
// `….<param>.<value>`) where the form has its own message, otherwise UI 001's generic keys. The
// owner left empty reads legacy's "No user defined" (`LEGACY_TEXTS`); the refused option or token
// of a custom parameter is filled in.
import type { FieldViolation } from '@/api'
import { hasMessage } from '@/i18n'
import { violationMessageKey } from '@/i18n/problems'

/** The form's message namespace, passed to `useProblemForm` as `formKey`. */
export const SYNC_JOB_FORM_KEY = 'syncJobs.form'

/** The message key a violation on a sync-job form field resolves to. */
export function fieldMessageKey(path: string, violation: FieldViolation): string {
  return violationMessageKey(violation, hasMessage, { formKey: SYNC_JOB_FORM_KEY, path })
}

/** The rules the sync-job forms have their own message for (new strings or `LEGACY_TEXTS`). */
export const FORM_MESSAGE_KEYS = [
  'syncJobs.form.errors.exclude.invalidRegex',
  'syncJobs.form.errors.customParameters.optionNotAllowed',
  'syncJobs.form.errors.customParameters.optionContainsSpace',
  'syncJobs.form.errors.customParameters.customParamsNotPermitted',
  'syncJobs.form.errors.mailbox.required',
  'syncJobs.form.errors.mailbox.notEligible.kind.resource',
  'syncJobs.form.errors.mailbox.notEligible.kind.alias',
  'syncJobs.form.errors.mailbox.notEligible.kind.aliasDomainAddress',
] as const
