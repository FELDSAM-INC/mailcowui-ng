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

/** The form's own message key of a rule on a field, for client checks that read the same text. */
export function formErrorKey(field: string, code: string): string {
  return `syncJobs.form.errors.${field}.${code}`
}
