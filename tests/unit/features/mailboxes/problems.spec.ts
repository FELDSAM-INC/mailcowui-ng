// Problem mapping of the mailbox forms (UI 003 T025, research R17, FR-068, SC-005): the legacy
// `danger.*` message of the same meaning on the field, with its placeholders filled from the
// problem; the rest stays for the generic messages; the English detail is never used.
import { describe, expect, it } from 'vitest'

import { ApiProblem } from '@/api'
import { legacy } from '@/i18n'

import { mailboxProblem, renameReport } from '@/features/mailboxes/problems'

const MIB = 1_048_576

function problem(
  type: string,
  status: number,
  extensions: Record<string, unknown> = {},
  errors: Record<string, { code: string; params?: Record<string, unknown> }[]> = {},
) {
  return ApiProblem.fromParts({
    kind: 'problem',
    type: `/api/v2/problems/${type}`,
    status,
    detail: 'English detail',
    extensions,
    fieldErrors: new Map(
      Object.entries(errors).map(([path, list]) => [
        path,
        list.map((item) => ({ code: item.code, params: item.params ?? {}, message: 'x' })),
      ]),
    ) as never,
  })
}

describe('mailboxProblem', () => {
  it.each([
    ['mailbox', 'danger.is_alias_or_mailbox'],
    ['resource', 'danger.is_alias_or_mailbox'],
    ['alias', 'danger.is_alias'],
    ['temporaryAlias', 'danger.is_spam_alias'],
  ] as const)('names the %s holding the address on the local part field', (holder, key) => {
    const view = mailboxProblem(
      problem('address-in-use', 409, { address: 'anna@a.example', holder }),
    )
    expect(view.fields).toEqual({ localPart: [{ key: legacy(key, 'anna@a.example') }] })
    expect(view.rest).toBeNull()
  })

  it('puts the address in use on the rename field when asked', () => {
    const view = mailboxProblem(
      problem('address-in-use', 409, { address: 'b@a.example', holder: 'alias' }),
      { localPartField: 'newLocalPart' },
    )
    expect(Object.keys(view.fields)).toEqual(['newLocalPart'])
  })

  it('states the count and the limit of a full domain', () => {
    const view = mailboxProblem(
      problem('mailbox-limit-reached', 409, { domain: 'a.example', count: 10, limit: 10 }),
    )
    expect(view.form).toEqual(legacy('danger.max_mailbox_exceeded', 10, 10))
    expect(view.rest).toBeNull()
  })

  it('names the template that exists already', () => {
    const view = mailboxProblem(problem('mailbox-template-name-exists', 409), {
      templateName: 'staff',
    })
    expect(view.fields).toEqual({ name: [{ key: legacy('danger.template_exists', 'staff') }] })
  })

  it('turns refused attributes into field errors with "Prohibited by ACL" and the permission', () => {
    const view = mailboxProblem(
      problem('attribute-not-permitted', 403, {
        attributes: ['protocolAccess.pop3', 'quota'],
        requiredFlags: { 'protocolAccess.pop3': 'protocolAccess', quota: 'unlimitedQuota' },
      }),
    )
    expect(view.fields).toEqual({
      'protocolAccess.pop3': [
        { key: legacy('acl.prohibited') },
        { key: legacy('acl.protocol_access') },
      ],
      quota: [{ key: legacy('danger.unlimited_quota_acl') }],
    })
  })

  it('maps rule codes to legacy messages and keeps the others for the generic texts', () => {
    const view = mailboxProblem(
      problem(
        'validation-failed',
        422,
        {},
        {
          localPart: [{ code: 'invalidFormat', params: { format: 'localPart' } }],
          password: [
            { code: 'tooShort', params: { min: 10 } },
            { code: 'missingCharacterClass', params: { characterClass: 'digit' } },
          ],
          quota: [{ code: 'outOfRange', params: { max: 5120 * MIB, limit: 'domainQuotaLeft' } }],
          tags: [{ code: 'tooMany', params: { max: 25 } }],
          displayName: [{ code: 'tooLong', params: { max: 255 } }],
        },
      ),
    )
    expect(view.fields).toEqual({
      localPart: [{ key: legacy('danger.mailbox_invalid') }],
      password: [{ key: legacy('danger.password_complexity') }],
      quota: [{ key: legacy('danger.mailbox_quota_left_exceeded', 5120) }],
      tags: [{ key: 'mailboxes.problem.tagLimit', params: { max: '25' } }],
    })
    expect([...view.rest!.fieldErrors.keys()]).toEqual(['displayName'])
    expect(view.rest!.detail).toBeUndefined()
  })

  it('uses the domain limit message for the maximum mailbox quota and the largest allowed quota', () => {
    for (const limit of ['maxMailboxQuota', 'largestAllowedQuota']) {
      const view = mailboxProblem(
        problem(
          'validation-failed',
          422,
          {},
          {
            quota: [{ code: 'outOfRange', params: { max: 10240 * MIB, limit } }],
          },
        ),
      )
      expect(view.fields.quota).toEqual([{ key: legacy('danger.mailbox_quota_exceeded', 10240) }])
    }
  })

  it('leaves unknown problems to the generic messages', () => {
    const unknown = problem('something-new', 409)
    expect(mailboxProblem(unknown)).toEqual({ fields: {}, form: null, rest: unknown })
  })
})

describe('renameReport', () => {
  const steps = [
    { step: 'database', outcome: 'done' },
    { step: 'mailStoreMove', outcome: 'undoFailed' },
  ]

  it('reads an incomplete rename with both addresses and every step', () => {
    expect(
      renameReport(
        problem('mailbox-rename-incomplete', 500, {
          previousAddress: 'anna@a.example',
          newAddress: 'anna.smith@a.example',
          steps,
        }),
        'anna@a.example',
        'anna.smith@a.example',
      ),
    ).toEqual({
      kind: 'incomplete',
      previousAddress: 'anna@a.example',
      newAddress: 'anna.smith@a.example',
      steps,
      unknownStep: null,
    })
  })

  it('reads an unknown outcome with the step, and nothing for other problems', () => {
    expect(
      renameReport(
        problem('outcome-unknown', 504, { step: 'mailStoreMove', steps }),
        'anna@a.example',
        'anna.smith@a.example',
      ),
    ).toMatchObject({ kind: 'unknown', unknownStep: 'mailStoreMove' })
    expect(renameReport(problem('address-in-use', 409), 'a', 'b')).toBeNull()
  })
})
