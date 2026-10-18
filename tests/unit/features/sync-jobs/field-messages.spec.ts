// Field messages of the sync-job forms (UI 008 T018, research R13, plan legacy form map part 2):
// the rule codes API 008 adds map to their messages with parameters; the owner left empty reads
// legacy's "No user defined"; any other code falls back to UI 001's generic messages.
import { describe, expect, it } from 'vitest'

import type { FieldViolation } from '@/api'
import { fieldMessage } from '@/features/sync-jobs/field-messages'

const v = (code: string, params: Record<string, unknown> = {}): FieldViolation =>
  ({ code, params, message: 'x' }) as FieldViolation

describe('fieldMessage', () => {
  it('maps the sync-job rules to their messages', () => {
    expect(fieldMessage('remoteHost', v('invalidFormat', { format: 'hostName' }))).toEqual({
      key: 'validation.format.hostName',
    })
    expect(fieldMessage('exclude', v('invalidRegex'))).toEqual({ key: 'validation.invalidRegex' })
    expect(
      fieldMessage('customParameters', v('optionNotAllowed', { option: 'showpasswords' })),
    ).toEqual({
      key: 'validation.optionNotAllowed',
      params: { option: 'showpasswords' },
    })
    expect(
      fieldMessage('customParameters', v('optionContainsSpace', { token: 'maxsize 1' })),
    ).toEqual({
      key: 'validation.optionContainsSpace',
      params: { token: 'maxsize 1' },
    })
    expect(fieldMessage('customParameters', v('customParamsNotPermitted'))).toEqual({
      key: 'validation.customParamsNotPermitted',
    })
  })

  it('names the kind of an address that cannot receive synced mail', () => {
    for (const kind of ['resource', 'alias', 'aliasDomainAddress']) {
      expect(fieldMessage('mailbox', v('notEligible', { kind }))).toEqual({
        key: 'syncJobs.errors.notEligible',
        params: {},
        keyParams: { kind: `syncJobs.errors.kind.${kind}` },
      })
    }
    expect(fieldMessage('mailbox', v('notEligible', { kind: 'other' }))).toEqual({
      key: 'syncJobs.errors.notEligibleAny',
    })
  })

  it('reads legacy\'s "No user defined" for a missing owner', () => {
    expect(fieldMessage('mailbox', v('required'))).toEqual({
      key: { legacy: 'danger.no_user_defined' },
    })
  })

  it('leaves every other code to the generic messages', () => {
    expect(fieldMessage('intervalMinutes', v('outOfRange', { min: 1, max: 2 }))).toBeNull()
    expect(fieldMessage('remoteHost', v('tooLong', { max: 255 }))).toBeNull()
    expect(fieldMessage('mailbox', v('immutable'))).toBeNull()
    expect(fieldMessage('remoteHost', v('invalidFormat', { format: 'ipAddress' }))).toBeNull()
  })
})
