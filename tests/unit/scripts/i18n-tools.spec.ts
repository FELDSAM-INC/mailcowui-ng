// Tests of the translation tooling (constitution IV 1.3.0, SC-006, research R15, R27): the
// completeness check of the new strings, the check of the legacy keys the source uses against the
// bundled en-gb snapshot, and the review list of new strings that repeat a legacy text.
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  checkCoverage,
  checkMessages,
  duplicateLegacyMeanings,
  enumValuesFromSchema,
  legacyKeysInSource,
  legacyTextsFromSource,
  appKeysInSource,
  placeholders,
  problemNamesFromContract,
  requiredKeys,
  type CheckInput,
} from '../../../scripts/i18n/lib.mjs'

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

describe('legacyKeysInSource', () => {
  it('finds the keys of lt(), legacy() and LegacyText', () => {
    const source = [
      "const a = lt('login.login')",
      'const b = lt("tfa.tfa", count)',
      "title: legacy('header.debug'),",
      '<LegacyText k="login.forgot_password" />',
      '<LegacyText :k="\'datatables.lengthMenu\'" as="label">',
      "t('auth.signIn.submitting')",
      "someOther('login.password')",
    ].join('\n')
    expect(legacyKeysInSource(source)).toEqual([
      'datatables.lengthMenu',
      'header.debug',
      'login.forgot_password',
      'login.login',
      'tfa.tfa',
    ])
  })
})

const snapshot = {
  login: { login: 'Login', password: 'Password', forgot_password: '> Forgot Password?' },
  footer: { cancel: 'Cancel' },
  datatables: { paginate: { next: 'Next' } },
}

function baseInput(): CheckInput {
  return {
    app: {
      'en-gb': { common: { save: 'Save', greet: 'Hello {name}' } },
      'cs-cz': { common: { save: 'Uložit', greet: 'Ahoj {name}' } },
      'sk-sk': { common: { save: 'Uložiť', greet: 'Ahoj {name}' } },
    },
    required: ['common.save'],
    snapshot,
    legacyKeysUsed: ['login.login', 'datatables.paginate.next'],
    usedKeys: new Set(['common.save', 'common.greet']),
  }
}

describe('completeness check (research R27)', () => {
  it('passes a complete fixture set', () => {
    expect(checkMessages(baseInput()).errors).toEqual([])
  })

  it('rule 1: fails on differing key sets and on empty values', () => {
    const input = baseInput()
    input.app['cs-cz'] = { common: { save: 'Uložit', greet: 'Ahoj {name}', extra: 'Navíc' } }
    input.app['sk-sk'] = { common: { save: '', greet: 'Ahoj {name}' } }
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
    input.app['sk-sk'] = { common: { save: 'Touch ID', greet: 'Ahoj {name}' } }
    const text = checkMessages(input).errors.join('\n')
    expect(text).toMatch(/en-gb.*legacy/i)
    expect(text).toMatch(/cs-cz.*FIDO2/)
    expect(text).toMatch(/sk-sk.*Touch ID/)
  })

  it('rule 5: fails on a legacy key that the en-gb snapshot lacks', () => {
    const input = baseInput()
    input.legacyKeysUsed = ['login.login', 'login.nothing', 'datatables.paginate']
    const text = checkMessages(input).errors.join('\n')
    expect(text).toMatch(/login\.nothing.*snapshot/)
    // A group is not a text.
    expect(text).toMatch(/datatables\.paginate.*snapshot/)
  })

  it('rule 6: fails on an unused new string, except keys built at runtime', () => {
    const input = baseInput()
    input.usedKeys = new Set(['common.save'])
    input.app['en-gb'] = { ...input.app['en-gb'], problem: { generic: 'Error' } }
    input.app['cs-cz'] = { ...input.app['cs-cz'], problem: { generic: 'Chyba' } }
    input.app['sk-sk'] = { ...input.app['sk-sk'], problem: { generic: 'Chyba' } }
    const errors = checkMessages(input).errors.join('\n')
    expect(errors).toMatch(/common\.greet.*unused/)
    expect(errors).not.toMatch(/problem\.generic/)
  })
})

describe('duplicateLegacyMeanings (review list)', () => {
  it('lists new strings whose English text a legacy key already has', () => {
    const list = duplicateLegacyMeanings(
      {
        common: { cancel: 'Cancel', forgot: 'Forgot password?', save: 'Save the key' },
        pages: { next: 'Next' },
      },
      snapshot,
    )
    expect(list).toEqual([
      { key: 'common.cancel', value: 'Cancel', legacyKeys: ['footer.cancel'] },
      { key: 'common.forgot', value: 'Forgot password?', legacyKeys: ['login.forgot_password'] },
      { key: 'pages.next', value: 'Next', legacyKeys: ['datatables.paginate.next'] },
    ])
  })
})

describe('LEGACY_TEXTS (keys built at runtime with a classic text)', () => {
  it('reads the table from the source', () => {
    const source = [
      'export const LEGACY_TEXTS: Readonly<Partial<Record<string, LegacyKey>>> = {',
      '  // Problems',
      "  'problem.sign-in-failed': 'danger.login_failed',",
      "  'roles.admin': 'admin.admin',",
      '}',
    ].join('\n')
    expect(legacyTextsFromSource(source)).toEqual({
      'problem.sign-in-failed': 'danger.login_failed',
      'roles.admin': 'admin.admin',
    })
  })

  it('satisfies a required key, refuses a duplicate new string and checks the target', () => {
    const input = baseInput()
    input.required = ['common.save', 'problem.sign-in-failed']
    input.legacyTexts = { 'problem.sign-in-failed': 'login.login' }
    expect(checkMessages(input).errors).toEqual([])
    input.legacyTexts = { 'common.save': 'login.login', 'roles.admin': 'login.nothing' }
    const text = checkMessages(input).errors.join('\n')
    expect(text).toMatch(/common\.save.*must not be a new string/)
    expect(text).toMatch(/roles\.admin.*login\.nothing/)
  })
})

describe('new-string keys named in the source', () => {
  it('finds quoted keys of the app namespaces only', () => {
    const source = "t('common.save'); legacy('login.login'); x = \"common.greet\"; y = 'a.b'"
    expect(appKeysInSource(source, ['common'])).toEqual(['common.greet', 'common.save'])
  })

  it('rule 7: fails on a key the source names that is not a new string', () => {
    const input = baseInput()
    input.appKeysUsed = ['common.save', 'common.cancel', 'problem.generic']
    input.legacyTexts = { 'problem.generic': 'login.login' }
    const errors = checkMessages(input).errors.join('\n')
    expect(errors).toMatch(/common\.cancel.*not a new string/)
    expect(errors).not.toMatch(/problem\.generic/)
  })
})

// UI 002 (research D2): the coverage manifest of growing shared enumerations.
describe('coverage manifest (UI 002 research D2)', () => {
  const contract = {
    components: {
      schemas: {
        BulkItemOutcome: { type: 'string', enum: ['done', 'failed'] },
        NotAnEnum: { type: 'string' },
      },
      parameters: { DomainSort: { schema: { type: 'string', enum: ['name', 'storageUsed'] } } },
    },
  }
  const enums = {
    auditEventTypeValues: ['signIn', 'signOut', 'domainCreation', 'mailboxCreation'],
    auditTargetTypeValues: ['session', 'domain'],
    auditFailureReasonValues: ['invalidCredentials', 'conflict'],
    authMethodValues: ['password', 'ssoToken'],
    validationRuleCodeValues: ['required', 'belowInUse'],
    roleValues: ['admin', 'domainAdmin'],
    themeValues: ['light'],
    knownProblemTypeValues: ['/api/v2/problems/forbidden', '/api/v2/problems/domain-exists'],
  }
  const problemNames = ['forbidden', 'domain-exists', 'mailbox-exists']
  const coverage = {
    partial: {
      AuditEventType: ['signIn', 'domainCreation'],
      'AuditTarget.type': ['domain'],
      AuditFailureReason: ['conflict'],
      AuthMethod: ['password'],
      ValidationRuleCode: ['required', 'belowInUse'],
      problemTypes: ['forbidden', 'domain-exists'],
    },
    complete: {
      'bulk.outcome': '#/components/schemas/BulkItemOutcome',
      'domains.sort': '#/components/parameters/DomainSort/schema',
    },
  }

  it('requires a key for every listed value of the growing enumerations and no other', () => {
    const { required, errors } = checkCoverage({ coverage, enums, problemNames, contract })
    expect(errors).toEqual([])
    expect(required).toEqual(
      expect.arrayContaining([
        'enums.auditEventType.signIn',
        'enums.auditEventType.domainCreation',
        'enums.auditTargetType.domain',
        'enums.auditFailureReason.conflict',
        'enums.authMethod.password',
        'validation.required',
        'validation.belowInUse',
        'problem.forbidden',
        'problem.domain-exists',
      ]),
    )
    expect(required).not.toContain('enums.auditEventType.mailboxCreation')
    expect(required).not.toContain('enums.authMethod.ssoToken')
    expect(required).not.toContain('problem.mailbox-exists')
  })

  it('reports every contract value that is not listed as a warning only', () => {
    const { warnings, errors } = checkCoverage({ coverage, enums, problemNames, contract })
    expect(errors).toEqual([])
    const text = warnings.join('\n')
    expect(text).toMatch(/AuditEventType.*signOut/)
    expect(text).toMatch(/AuditEventType.*mailboxCreation/)
    expect(text).toMatch(/AuthMethod.*ssoToken/)
    expect(text).toMatch(/problemTypes.*mailbox-exists/)
  })

  it('fails on a listed value missing from the pinned enumeration array', () => {
    const stale = structuredClone(coverage)
    stale.partial.AuditEventType.push('domainRename')
    stale.partial.ValidationRuleCode.push('notAThing')
    const text = checkCoverage({ coverage: stale, enums, problemNames, contract }).errors.join('\n')
    expect(text).toMatch(/AuditEventType.*domainRename/)
    expect(text).toMatch(/ValidationRuleCode.*notAThing/)
  })

  it('fails on a listed problem type that neither the bundle nor knownProblemTypeValues names', () => {
    const stale = structuredClone(coverage)
    stale.partial.problemTypes.push('invented-problem')
    const text = checkCoverage({ coverage: stale, enums, problemNames, contract }).errors.join('\n')
    expect(text).toMatch(/problemTypes.*invented-problem/)
  })

  it("keeps UI 001's fully required enumerations complete", () => {
    const { required } = checkCoverage({ coverage, enums, problemNames, contract })
    expect(required).toEqual(
      expect.arrayContaining(['roles.admin', 'roles.domainAdmin', 'themes.light']),
    )
  })

  it('requires <prefix>.<value> for every value of each `complete` registry entry', () => {
    const { required } = checkCoverage({ coverage, enums, problemNames, contract })
    expect(required).toEqual(
      expect.arrayContaining([
        'bulk.outcome.done',
        'bulk.outcome.failed',
        'domains.sort.name',
        'domains.sort.storageUsed',
      ]),
    )
  })

  it('fails on a `complete` pointer that does not resolve to an object with an enum', () => {
    const broken = structuredClone(coverage) as typeof coverage & {
      complete: Record<string, string>
    }
    broken.complete['x.missing'] = '#/components/schemas/Nope'
    broken.complete['x.plain'] = '#/components/schemas/NotAnEnum'
    const text = checkCoverage({ coverage: broken, enums, problemNames, contract }).errors.join(
      '\n',
    )
    expect(text).toMatch(/x\.missing/)
    expect(text).toMatch(/x\.plain/)
  })

  it('makes the completeness check fail when a listed value has no key in one locale', () => {
    const { required } = checkCoverage({ coverage, enums, problemNames, contract })
    const input = baseInput()
    input.required = required.filter((key) => key === 'validation.belowInUse')
    input.app['en-gb'] = { ...input.app['en-gb'], validation: { belowInUse: 'In use: {inUse}' } }
    input.app['cs-cz'] = { ...input.app['cs-cz'], validation: { belowInUse: 'Použito: {inUse}' } }
    expect(checkMessages(input).errors.join('\n')).toMatch(/sk-sk.*validation\.belowInUse/)
  })
})

describe('UI 012: enumerations the identity provider screen introduces (T003, research R26)', () => {
  const realCoverage = JSON.parse(readFileSync('src/i18n/coverage.json', 'utf8')) as {
    partial: Record<string, string[]>
    complete: Record<string, string>
  }
  const realContract = JSON.parse(readFileSync('contract/openapi.json', 'utf8')) as Record<
    string,
    unknown
  >
  const realEnums = enumValuesFromSchema(readFileSync('src/api/generated/schema.ts', 'utf8'))

  it('requires a key for every provider type and every test failure category', () => {
    expect(realCoverage.complete['identityProvider.type']).toBe(
      '#/components/schemas/IdentityProviderType',
    )
    expect(realCoverage.complete['identityProvider.test.failure']).toBe(
      '#/components/schemas/IdentityProviderConnectionTestResult/properties/failureCategory/oneOf/0',
    )
    const { required, errors } = checkCoverage({
      coverage: realCoverage,
      enums: realEnums,
      problemNames: [],
      contract: realContract,
    })
    expect(errors).toEqual([])
    for (const type of realEnums.identityProviderTypeValues ?? []) {
      expect(required).toContain(`identityProvider.type.${type}`)
    }
    for (const category of realEnums.identityProviderConnectionTestResultFailureCategoryOneOf0Values ??
      []) {
      expect(required).toContain(`identityProvider.test.failure.${category}`)
    }
  })

  it('fails when a test failure category has no text in a locale', () => {
    const input = baseInput()
    input.required = ['identityProvider.test.failure.timedOut']
    input.app['en-gb'] = {
      ...input.app['en-gb'],
      identityProvider: { test: { failure: { timedOut: 'The provider did not answer in time.' } } },
    }
    input.app['cs-cz'] = {
      ...input.app['cs-cz'],
      identityProvider: { test: { failure: { timedOut: 'Poskytovatel neodpověděl včas.' } } },
    }
    expect(checkMessages(input).errors.join('\n')).toMatch(
      /sk-sk.*identityProvider\.test\.failure\.timedOut/,
    )
  })
})

describe('UI 005: plural forms and the enumerations of the self-service screens (T002, research R23)', () => {
  const realCoverage = JSON.parse(readFileSync('src/i18n/coverage.json', 'utf8')) as {
    partial: Record<string, string[]>
    complete: Record<string, string>
  }
  const realContract = JSON.parse(readFileSync('contract/openapi.json', 'utf8')) as Record<
    string,
    unknown
  >
  const realEnums = enumValuesFromSchema(readFileSync('src/api/generated/schema.ts', 'utf8'))

  function pluralInput(cs: string, sk: string) {
    const input = baseInput()
    input.usedKeys = undefined
    input.app['en-gb'] = {
      ...input.app['en-gb'],
      count: { sessions: '{n} session | {n} sessions' },
    }
    input.app['cs-cz'] = { ...input.app['cs-cz'], count: { sessions: cs } }
    input.app['sk-sk'] = { ...input.app['sk-sk'], count: { sessions: sk } }
    return input
  }

  it('rule 8: a plural new string has exactly three forms in cs-cz and sk-sk', () => {
    const ok = pluralInput(
      '{n} relace | {n} relace | {n} relací',
      '{n} relácia | {n} relácie | {n} relácií',
    )
    expect(checkMessages(ok).errors).toEqual([])
    const two = pluralInput('{n} relace | {n} relací', '{n} relácia | {n} relácie | {n} relácií')
    expect(checkMessages(two).errors.join('\n')).toMatch(/cs-cz.*count\.sessions.*three/)
    const four = pluralInput(
      '{n} relace | {n} relace | {n} relací',
      '{n} | {n} relácia | {n} relácie | {n} relácií',
    )
    expect(checkMessages(four).errors.join('\n')).toMatch(/sk-sk.*count\.sessions.*three/)
  })

  it('rule 8: a cs-cz or sk-sk text without choices is accepted only when en-gb has none', () => {
    const input = pluralInput('{n} relací', '{n} relácií')
    expect(checkMessages(input).errors.join('\n')).toMatch(/count\.sessions/)
  })

  it('requires every value of the enumerations the self-service screens introduce', () => {
    const expected = {
      'account.twoFactor.type': '#/components/schemas/OwnSecondFactorType',
      'account.appPasswords.protocol': '#/components/schemas/AppPasswordProtocol',
      'account.mailSettings.tagged': '#/components/schemas/MailboxTaggedMailHandling',
      'filters.kind': '#/components/schemas/SieveFilterKind',
    }
    for (const [prefix, pointer] of Object.entries(expected)) {
      expect(realCoverage.complete[prefix]).toBe(pointer)
    }
    const { required, errors } = checkCoverage({
      coverage: realCoverage,
      enums: realEnums,
      problemNames: [],
      contract: realContract,
    })
    expect(errors).toEqual([])
    const values = {
      'account.twoFactor.type': realEnums.ownSecondFactorTypeValues,
      'account.appPasswords.protocol': realEnums.appPasswordProtocolValues,
      'account.mailSettings.tagged': realEnums.mailboxTaggedMailHandlingValues,
      'filters.kind': realEnums.sieveFilterKindValues,
    }
    for (const [prefix, list] of Object.entries(values)) {
      expect(list?.length).toBeGreaterThan(0)
      for (const value of list ?? []) expect(required).toContain(`${prefix}.${value}`)
    }
  })
})
