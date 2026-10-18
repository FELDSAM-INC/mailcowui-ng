// Client-side rules of the mailbox forms (UI 003 T022, research R18, data-model §6). Each rule
// gives a legacy message where the classic interface has one, otherwise a new string; checks that
// need a capability are skipped without it (research R16).
import { describe, expect, it } from 'vitest'

import { legacy } from '@/i18n'
import type { ClientErrors } from '@/shared/validation/client-errors'

import {
  checkAttributes,
  checkDisplayName,
  checkLocalPart,
  checkPasswordPair,
  checkRateLimit,
  checkRecoveryEmail,
  checkRenameLocalPart,
  checkTemplateName,
  normaliseLocalPart,
} from '@/features/mailboxes/validation'

const run = (check: (errors: ClientErrors) => unknown) => {
  const errors: ClientErrors = {}
  const value = check(errors)
  return { errors, value }
}

describe('local part (FR-019)', () => {
  it('is trimmed and lower-cased', () => {
    expect(normaliseLocalPart('  Anna.Smith ')).toBe('anna.smith')
    expect(run((e) => checkLocalPart(e, 'localPart', ' Anna.Smith ', 'example.org')).value).toBe(
      'anna.smith',
    )
  })

  it.each([
    ["a!#$%&'*+/=?^_`{|}~-.b", true],
    ['anna', true],
    ['.anna', false],
    ['anna.', false],
    ['an..na', false],
    ['an na', false],
    ['anña', false],
    ['a'.repeat(64), true],
    ['a'.repeat(65), false],
  ])('%s is valid: %s', (raw, valid) => {
    const { errors } = run((e) => checkLocalPart(e, 'localPart', raw, 'example.org'))
    expect(errors.localPart ?? []).toEqual(valid ? [] : [{ key: legacy('danger.mailbox_invalid') }])
  })

  it('needs a value and keeps the full address within 255 characters', () => {
    expect(
      run((e) => checkLocalPart(e, 'localPart', '  ', 'example.org')).errors.localPart,
    ).toEqual([{ key: 'validation.required' }])
    const domain = `${'d'.repeat(240)}.org`
    expect(
      run((e) => checkLocalPart(e, 'localPart', 'a'.repeat(20), domain)).errors.localPart,
    ).toEqual([{ key: legacy('danger.mailbox_invalid') }])
  })

  it('refuses a rename that changes only the letter case', () => {
    const { errors } = run((e) =>
      checkRenameLocalPart(e, 'newLocalPart', 'ANNA', 'anna', 'a.example'),
    )
    expect(errors.newLocalPart).toEqual([{ key: 'validation.unchanged' }])
    expect(
      run((e) => checkRenameLocalPart(e, 'newLocalPart', 'anna.smith', 'anna', 'a.example')).errors,
    ).toEqual({})
  })
})

describe('password and its repeat', () => {
  it('needs a password on creation, as legacy (danger.password_complexity)', () => {
    expect(run((e) => checkPasswordPair(e, '', '', { required: true })).errors).toEqual({
      password: [{ key: legacy('danger.password_complexity') }],
    })
    expect(run((e) => checkPasswordPair(e, '', '', { required: false })).errors).toEqual({})
  })

  it('refuses a repeat that differs (danger.password_mismatch) and passwords above 255', () => {
    expect(run((e) => checkPasswordPair(e, 'abc', 'abd', { required: true })).errors).toEqual({
      password2: [{ key: legacy('danger.password_mismatch') }],
    })
    expect(
      run((e) => checkPasswordPair(e, 'x'.repeat(256), 'x'.repeat(256), { required: true })).errors
        .password,
    ).toEqual([{ key: 'validation.tooLong', params: { max: '255' } }])
  })
})

describe('other fields', () => {
  it('accepts an empty recovery e-mail or a valid one of at most 255 characters', () => {
    expect(run((e) => checkRecoveryEmail(e, 'recoveryEmail', '')).errors).toEqual({})
    expect(run((e) => checkRecoveryEmail(e, 'recoveryEmail', 'a@b.example')).errors).toEqual({})
    expect(run((e) => checkRecoveryEmail(e, 'recoveryEmail', 'nope')).errors.recoveryEmail).toEqual(
      [{ key: 'validation.format.email' }],
    )
    expect(
      run((e) => checkRecoveryEmail(e, 'recoveryEmail', `${'a'.repeat(250)}@b.example`)).errors
        .recoveryEmail,
    ).toEqual([{ key: 'validation.tooLong', params: { max: '255' } }])
  })

  it('limits the display name to 255 characters', () => {
    expect(
      run((e) => checkDisplayName(e, 'displayName', 'x'.repeat(256))).errors.displayName,
    ).toEqual([{ key: 'validation.tooLong', params: { max: '255' } }])
  })

  it('accepts no rate limit, or a whole number from 1 to 2,147,483,647', () => {
    expect(run((e) => checkRateLimit(e, 'rateLimit', '')).value).toBeNull()
    expect(run((e) => checkRateLimit(e, 'rateLimit', ' 20 ')).value).toBe(20)
    for (const bad of ['0', '-1', '1.5', 'x', '2147483648']) {
      expect(run((e) => checkRateLimit(e, 'rateLimit', bad)).errors.rateLimit).toEqual([
        { key: 'validation.outOfRange', params: { min: '1', max: '2147483647' } },
      ])
    }
  })

  it('needs a template name of at most 255 characters (danger.template_name_invalid)', () => {
    expect(run((e) => checkTemplateName(e, 'name', '  ')).errors.name).toEqual([
      { key: legacy('danger.template_name_invalid') },
    ])
    expect(run((e) => checkTemplateName(e, 'name', 'x'.repeat(256))).errors.name).toEqual([
      { key: 'validation.tooLong', params: { max: '255' } },
    ])
    expect(run((e) => checkTemplateName(e, 'name', ' Staff ')).value).toBe('Staff')
  })
})

describe('custom attributes (FR-039)', () => {
  const caps = {
    customAttributeLimit: 2,
    customAttributeNameMaxLength: 5,
    customAttributeValueMaxLength: 3,
  }

  it('needs names without whitespace, unique, within the length, and values within theirs', () => {
    const { errors } = run((e) =>
      checkAttributes(
        e,
        [
          { id: 1, name: 'a b', value: 'x' },
          { id: 2, name: 'dup', value: 'x' },
          { id: 3, name: 'dup', value: 'long' },
          { id: 4, name: '', value: '' },
          { id: 5, name: 'toolong', value: '' },
        ],
        caps,
        {},
      ),
    )
    expect(errors['attributes.1.name']).toEqual([{ key: 'validation.format.attributeName' }])
    expect(errors['attributes.3.name']).toEqual([{ key: 'mailboxes.attributes.duplicate' }])
    expect(errors['attributes.3.value']).toEqual([
      { key: 'validation.tooLong', params: { max: '3' } },
    ])
    expect(errors['attributes.4.name']).toEqual([{ key: 'validation.required' }])
    expect(errors['attributes.5.name']).toEqual([
      { key: 'validation.tooLong', params: { max: '5' } },
    ])
    expect(errors.attributes).toEqual([{ key: 'validation.tooMany', params: { max: '2' } }])
  })

  it('skips the capability checks without capabilities, and keeps stored values as they are', () => {
    const rows = [{ id: 1, name: 'old', value: 'x'.repeat(5000), storedName: 'old' }]
    expect(
      run((e) => checkAttributes(e, rows, undefined, { old: 'x'.repeat(5000) })).errors,
    ).toEqual({})
    expect(run((e) => checkAttributes(e, rows, caps, { old: 'x'.repeat(5000) })).errors).toEqual({})
  })
})
