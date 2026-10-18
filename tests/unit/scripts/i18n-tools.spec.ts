// Tests of the translation tooling (FR-086, SC-006, research R15, R27): the legacy import and the
// completeness check, against fixture message sets.
import { describe, expect, it } from 'vitest'

import {
  buildLegacyLayer,
  checkMessages,
  convertLegacyValue,
  enumValuesFromSchema,
  placeholders,
  problemNamesFromContract,
  refusalReason,
  requiredKeys,
  type CheckInput,
} from '../../../scripts/i18n/lib.mjs'

describe('legacy import: value conversion', () => {
  it('turns %s placeholders into list interpolations', () => {
    expect(convertLegacyValue('Login was delayed by %s seconds.')).toBe(
      'Login was delayed by {0} seconds.',
    )
    expect(convertLegacyValue('%s of %s')).toBe('{0} of {1}')
  })

  it("escapes vue-i18n's special characters as literal interpolations", () => {
    expect(convertLegacyValue('a {b} @c $d |e')).toBe("a {'{'}b{'}'} {'@'}c {'$'}d {'|'}e")
  })

  it('strips decorative leading and trailing glyphs', () => {
    expect(convertLegacyValue('> Forgot Password?')).toBe('Forgot Password?')
    expect(convertLegacyValue('» Next ›')).toBe('Next')
    expect(convertLegacyValue('  Password  ')).toBe('Password')
  })

  it('refuses values with HTML, "FIDO2" or "Touch ID"', () => {
    expect(refusalReason('The token is invalid.<br>Please request a new link.')).toBe('html')
    expect(refusalReason('FIDO2/WebAuthn Login')).toBe('fido2')
    expect(refusalReason('Touch ID on Apple M1')).toBe('touch-id')
    expect(refusalReason('Password')).toBeNull()
  })
})

describe('legacy import: building a locale layer', () => {
  const map = {
    'auth.signIn.password': 'login.password',
    'auth.signIn.titleAdmin': 'login.login_admin',
    'auth.signIn.delayed': 'login.delayed',
  }

  it('writes the mapped keys under the app keys, converted', () => {
    const { layer, missing } = buildLegacyLayer(map, {
      login: { password: 'Password', login_admin: 'Administrator Login', delayed: 'Wait %s s' },
    })
    expect(layer).toEqual({
      auth: {
        signIn: { password: 'Password', titleAdmin: 'Administrator Login', delayed: 'Wait {0} s' },
      },
    })
    expect(missing).toEqual([])
  })

  it("leaves out a key that the locale's legacy file lacks", () => {
    const { layer, missing } = buildLegacyLayer(map, {
      login: { password: 'Heslo', delayed: 'Oneskorené o %s s' },
    })
    expect(layer).toEqual({
      auth: { signIn: { password: 'Heslo', delayed: 'Oneskorené o {0} s' } },
    })
    expect(missing).toEqual(['auth.signIn.titleAdmin'])
  })

  it('refuses a mapped value with HTML or a banned name', () => {
    expect(() =>
      buildLegacyLayer(
        { 'auth.x': 'login.fido2_webauthn' },
        { login: { fido2_webauthn: 'FIDO2' } },
      ),
    ).toThrow(/auth\.x.*fido2/i)
    expect(() =>
      buildLegacyLayer({ 'auth.y': 'login.reset' }, { login: { reset: 'Invalid.<br>Retry' } }),
    ).toThrow(/auth\.y.*html/i)
  })
})

describe('placeholders and contract inputs', () => {
  it('extracts named and list placeholders but not literal interpolations', () => {
    expect(placeholders("Hello {name}, {0} {'{'} {count}")).toEqual(['0', 'count', 'name'])
    expect(placeholders('No placeholder')).toEqual([])
  })

  it('finds every problem type named in the contract text', () => {
    const text = JSON.stringify({
      a: 'See /api/v2/problems/sign-in-failed and /api/v2/problems/too-many-requests.',
      b: { c: '"/api/v2/problems/sign-in-failed"' },
    })
    expect(problemNamesFromContract(text)).toEqual(['sign-in-failed', 'too-many-requests'])
  })

  it('reads the generated enumeration arrays', () => {
    const schema = [
      'export const roleValues: ReadonlyArray<X> = ["admin", "domainAdmin", "mailboxUser"];',
      'export const themeValues: ReadonlyArray<Y> = ["light", "dark", "system"];',
    ].join('\n')
    expect(enumValuesFromSchema(schema)).toEqual({
      roleValues: ['admin', 'domainAdmin', 'mailboxUser'],
      themeValues: ['light', 'dark', 'system'],
    })
  })

  it('derives the required keys from the enumerations and the problem types', () => {
    const keys = requiredKeys({
      enums: { roleValues: ['admin'], validationRuleCodeValues: ['tooLong'] },
      problemNames: ['sign-in-failed'],
    })
    expect(keys).toEqual(
      expect.arrayContaining(['roles.admin', 'validation.tooLong', 'problem.sign-in-failed']),
    )
  })

  it('adds knownProblemTypeValues once a pin generates it', () => {
    const keys = requiredKeys({
      enums: { knownProblemTypeValues: ['/api/v2/problems/forbidden'] },
      problemNames: [],
    })
    expect(keys).toContain('problem.forbidden')
  })
})

function baseInput(): CheckInput {
  return {
    app: {
      'en-gb': { common: { save: 'Save', greet: 'Hello {name}' } },
      'cs-cz': { common: { save: 'Uložit', greet: 'Ahoj {name}' } },
      'sk-sk': { common: { save: 'Uložiť', greet: 'Ahoj {name}' }, auth: { title: 'Prihlásenie' } },
    },
    legacy: {
      'en-gb': { auth: { title: 'Administrator Login' } },
      'cs-cz': { auth: { title: 'Přihlášení administrátora' } },
      'sk-sk': {},
    },
    legacyMap: { 'auth.title': 'login.login_admin' },
    required: ['common.save'],
  }
}

describe('completeness check (research R27)', () => {
  it('passes a complete fixture set', () => {
    expect(checkMessages(baseInput()).errors).toEqual([])
  })

  it('rule 1: fails on differing key sets and on empty values', () => {
    const input = baseInput()
    input.app['cs-cz'] = { common: { save: 'Uložit', greet: 'Ahoj {name}', extra: 'Navíc' } }
    input.app['sk-sk'] = { common: { save: '', greet: 'Ahoj {name}' }, auth: { title: 'X' } }
    const { errors } = checkMessages(input)
    expect(errors.join('\n')).toMatch(/common\.extra/)
    expect(errors.join('\n')).toMatch(/sk-sk.*common\.save.*empty/)
  })

  it('rule 2: fails when the placeholder sets of a key differ', () => {
    const input = baseInput()
    input.app['cs-cz'] = { common: { save: 'Uložit', greet: 'Ahoj {user}' } }
    expect(checkMessages(input).errors.join('\n')).toMatch(/common\.greet.*placeholder/i)
  })

  it('rule 3: fails when a key for a contract value is missing', () => {
    const input = baseInput()
    input.required = ['common.save', 'problem.sign-in-failed']
    expect(checkMessages(input).errors.join('\n')).toMatch(/problem\.sign-in-failed/)
  })

  it('rule 4: fails on "FIDO2" and "Touch ID" anywhere and on "legacy" in en-gb', () => {
    const input = baseInput()
    input.app['en-gb'] = { common: { save: 'Save in the legacy UI', greet: 'Hello {name}' } }
    input.app['cs-cz'] = { common: { save: 'Uložit FIDO2', greet: 'Ahoj {name}' } }
    input.app['sk-sk'] = {
      common: { save: 'Touch ID', greet: 'Ahoj {name}' },
      auth: { title: 'Prihlásenie' },
    }
    const text = checkMessages(input).errors.join('\n')
    expect(text).toMatch(/en-gb.*legacy/i)
    expect(text).toMatch(/cs-cz.*FIDO2/)
    expect(text).toMatch(/sk-sk.*Touch ID/)
  })

  it('rule 5: fails on a key defined in both layers of one locale', () => {
    const input = baseInput()
    input.app['cs-cz'] = {
      common: { save: 'Uložit', greet: 'Ahoj {name}' },
      auth: { title: 'Dvakrát' },
    }
    expect(checkMessages(input).errors.join('\n')).toMatch(/cs-cz.*auth\.title.*both/i)
  })

  it('rule 5: fails on a legacy-map key missing from the en-gb legacy file', () => {
    const input = baseInput()
    input.legacyMap = { ...input.legacyMap, 'auth.missing': 'login.nothing' }
    expect(checkMessages(input).errors.join('\n')).toMatch(/auth\.missing.*en-gb legacy/i)
  })

  it('rule 5: a key missing from a cs-cz or sk-sk legacy file must come from that app layer', () => {
    const input = baseInput()
    input.app['sk-sk'] = { common: { save: 'Uložiť', greet: 'Ahoj {name}' } }
    expect(checkMessages(input).errors.join('\n')).toMatch(/sk-sk.*auth\.title/)
  })

  it('reports unused keys as warnings, not errors', () => {
    const input = baseInput()
    input.usedKeys = new Set(['common.save', 'auth.title'])
    const result = checkMessages(input)
    expect(result.errors).toEqual([])
    expect(result.warnings.join('\n')).toMatch(/common\.greet/)
  })
})
