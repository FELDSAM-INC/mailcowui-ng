// Field messages of the sync-job forms (UI 008 T018, research R13, plan legacy form map part 2):
// through the shared form-context lookup (UI 004 research R17), the rules API 008 adds resolve to
// the form's own messages with their parameters, the owner left empty to legacy's "No user
// defined", an address that cannot receive synced mail to a message per kind, and every other code
// to UI 001's generic messages.
import { describe, expect, it } from 'vitest'

import type { FieldViolation } from '@/api'
import { fieldMessageKey } from '@/features/sync-jobs/field-messages'
import { text } from '@/i18n'
import { violationMessage } from '@/i18n/problems'
import { hasMessage } from '@/i18n'

const v = (code: string, params: Record<string, unknown> = {}): FieldViolation =>
  ({ code, params, message: 'x' }) as FieldViolation

describe('fieldMessageKey', () => {
  it('maps the sync-job rules to the form\'s messages', () => {
    expect(fieldMessageKey('remoteHost', v('invalidFormat', { format: 'hostName' }))).toBe(
      'validation.format.hostName',
    )
    expect(fieldMessageKey('exclude', v('invalidRegex'))).toBe('syncJobs.form.errors.exclude.invalidRegex')
    for (const code of ['optionNotAllowed', 'optionContainsSpace', 'customParamsNotPermitted']) {
      expect(fieldMessageKey('customParameters', v(code))).toBe(
        `syncJobs.form.errors.customParameters.${code}`,
      )
    }
  })

  it('names the kind of an address that cannot receive synced mail', () => {
    for (const kind of ['resource', 'alias', 'aliasDomainAddress']) {
      expect(fieldMessageKey('mailbox', v('notEligible', { kind }))).toBe(
        `syncJobs.form.errors.mailbox.notEligible.kind.${kind}`,
      )
    }
  })

  it('reads legacy\'s "No user defined" for a missing owner', () => {
    expect(fieldMessageKey('mailbox', v('required'))).toBe('syncJobs.form.errors.mailbox.required')
    expect(text('syncJobs.form.errors.mailbox.required')).toBe('No user defined')
  })

  it('fills the refused option and token', () => {
    const tr = { t: text, te: hasMessage, locale: 'en-gb' }
    const context = { formKey: 'syncJobs.form', path: 'customParameters' }
    expect(violationMessage(v('optionNotAllowed', { option: 'showpasswords' }), tr, context)).toContain(
      '--showpasswords',
    )
    expect(violationMessage(v('optionContainsSpace', { token: 'maxsize 1' }), tr, context)).toContain(
      'maxsize 1',
    )
  })

  it('leaves every other code to the generic messages', () => {
    expect(fieldMessageKey('intervalMinutes', v('outOfRange', { min: 1, max: 2 }))).toBe(
      'validation.outOfRange',
    )
    expect(fieldMessageKey('remoteHost', v('tooLong', { max: 255 }))).toBe('validation.tooLong')
    expect(fieldMessageKey('mailbox', v('immutable'))).toBe('validation.immutable')
  })
})
