// Problem and rule-code translations of UI 004 (T012, research R17, FR-068, SC-005; legacy form
// map part 2): the form-context lookup order, index stripping and the `{entry}` parameter, problem
// extension members as parameters, the legacy `danger.*` messages with their placeholders filled,
// and a translation for every code, parameter variant and problem type of the feature.
import { beforeAll, describe, expect, it } from 'vitest'

import { ApiProblem, type FieldViolation } from '@/api'
import { hasMessage, text } from '@/i18n'
import { loadLegacy } from '@/i18n/legacy'
import {
  extensionParams,
  problemMessage,
  problemMessageKey,
  violationMessage,
  violationMessageKey,
  type MessageContext,
  type MessageTranslator,
} from '@/i18n/problems'

const tr: MessageTranslator = { t: text, te: hasMessage, locale: 'en-gb' }

const violation = (code: string, params: Record<string, unknown> = {}): FieldViolation =>
  ({ code, params, message: 'never shown' }) as FieldViolation

const problem = (name: string, status: number, extensions: Record<string, unknown> = {}) =>
  ApiProblem.fromParts({
    kind: 'problem',
    type: `/api/v2/problems/${name}`,
    status,
    extensions,
  })

beforeAll(async () => {
  await loadLegacy('en-gb')
})

describe('form-context lookup (research R17)', () => {
  const sent: Record<string, string> = {
    address: 'sales@example.org',
    'destinations.0': 'anna@example.org',
    'destinations.2': 'not-an-address',
  }
  const context = (path: string): MessageContext => ({
    formKey: 'aliases.form',
    path,
    valueAt: (at) => sent[at],
  })

  it('tries <formKey>.errors.<field>.<code>.<param>.<value>, then <formKey>.errors.<field>.<code>', () => {
    expect(
      violationMessageKey(violation('notEligible', { kind: 'externalDestination' }), hasMessage, {
        formKey: 'aliases.form',
        path: 'destinations.1',
      }),
    ).toBe('aliases.form.errors.destinations.notEligible.kind.externalDestination')
    expect(
      violationMessageKey(violation('required'), hasMessage, {
        formKey: 'aliases.form',
        path: 'address',
      }),
    ).toBe('aliases.form.errors.address.required')
  })

  it('falls back to validation.<code> and validation.invalid', () => {
    expect(
      violationMessageKey(violation('outOfRange', { min: 1, max: 9 }), hasMessage, {
        formKey: 'aliases.form',
        path: 'bookingLimit',
      }),
    ).toBe('validation.outOfRange')
    expect(
      violationMessageKey(violation('someFutureCode'), hasMessage, {
        formKey: 'aliases.form',
        path: 'address',
      }),
    ).toBe('validation.invalid')
  })

  it('strips indices from the field and fills {entry} with the value sent at the index', () => {
    expect(
      violationMessage(
        violation('invalidFormat', { format: 'email' }),
        tr,
        context('destinations.2'),
      ),
    ).toBe('Goto address not-an-address is invalid')
    expect(violationMessage(violation('invalidFormat'), tr, context('address'))).toBe(
      'Alias address sales@example.org is invalid',
    )
  })

  it('uses the legacy messages of the legacy form map with their placeholders', () => {
    expect(violationMessage(violation('required'), tr, context('address'))).toBe(
      'Alias address must not be empty',
    )
    expect(violationMessage(violation('required'), tr, context('destinations'))).toBe(
      'An alias address must contain at least one valid goto address',
    )
    expect(
      violationMessage(
        violation('conflictsWith', { field: 'address' }),
        tr,
        context('destinations.0'),
      ),
    ).toBe('Alias and goto address must not be identical')
    expect(
      violationMessage(
        violation('tooLong', { max: 160, unit: 'bytes' }),
        tr,
        context('privateComment'),
      ),
    ).toBe('Comment too long, max 160 chars allowed')
  })
})

describe('problem extension members (research R17)', () => {
  it.each([
    ['alias', 'sales@example.org is already known as an alias address'],
    [
      'temporaryAlias',
      'sales@example.org is already known as a temporary alias address (spam alias address)',
    ],
    [
      'mailbox',
      'sales@example.org is already known as an alias, a mailbox or an alias address expanded from an alias domain.',
    ],
    [
      'resource',
      'sales@example.org is already known as an alias, a mailbox or an alias address expanded from an alias domain.',
    ],
  ])('address-in-use with holder %s uses its legacy message', (holder, expected) => {
    const found = problem('address-in-use', 409, { address: 'sales@example.org', holder })
    expect(problemMessageKey(found, hasMessage)).toBe(`problem.address-in-use.holder.${holder}`)
    expect(problemMessage(found, tr)).toBe(expected)
  })

  it('alias-domain-already-exists answers with legacy alias_domain_invalid by existingKind', () => {
    const found = problem('alias-domain-already-exists', 409, {
      name: 'example.net',
      existingKind: 'domain',
    })
    expect(problemMessageKey(found, hasMessage)).toBe(
      'problem.alias-domain-already-exists.existingKind.domain',
    )
    expect(problemMessage(found, tr)).toBe('Alias domain example.net is invalid')
  })

  it('fills a placeholder from the caller when the problem lacks the member', () => {
    expect(
      problemMessage(problem('not-primary-domain-alias', 409), tr, {
        params: { address: 'info@example.net' },
      }),
    ).toBe('Skipped non-primary alias info@example.net')
  })

  it('renders requiredFlags with the legacy acl labels', () => {
    const refused = problem('attribute-not-permitted', 403, {
      attributes: ['destinations.1'],
      requiredFlags: ['aliasExternalGoto', 'extendSenderAcl'],
    })
    expect(extensionParams(refused, tr).requiredFlags).toBe(
      'Allow aliases with external goto domains and Allow to extend sender ACL by external addresses',
    )
  })

  it('formats numbers of extension members with the locale', () => {
    const limit = problem('domain-alias-limit-reached', 409, {
      domain: 'example.org',
      count: 1200,
      limit: 1200,
      requested: 1,
    })
    expect(problemMessage(limit, tr)).toBe('Max. aliases exceeded')
  })
})

describe('every code and problem type of UI 004 has a message (SC-005)', () => {
  const VARIANTS: [
    formKey: string,
    path: string,
    code: string,
    params?: Record<string, unknown>,
  ][] = [
    ['aliases.form', 'address', 'required'],
    ['aliases.form', 'address', 'tooLong', { max: 255 }],
    ['aliases.form', 'address', 'invalidFormat', { format: 'aliasAddress' }],
    ['aliases.form', 'address', 'notFound', { resource: 'domain' }],
    ['aliases.form', 'address', 'immutable'],
    ['aliases.form', 'destinations', 'required'],
    ['aliases.form', 'destinations', 'conflictsWith', { field: 'destinationType' }],
    ['aliases.form', 'destinations', 'tooLong', { max: 65535, unit: 'characters' }],
    ['aliases.form', 'destinations.0', 'invalidFormat', { format: 'email' }],
    ['aliases.form', 'destinations.0', 'conflictsWith', { field: 'address' }],
    ['aliases.form', 'destinations.0', 'notEligible', { kind: 'resource' }],
    ['aliases.form', 'destinations.0', 'notEligible', { kind: 'externalDestination' }],
    ['aliases.form', 'publicComment', 'tooLong', { max: 160, unit: 'bytes' }],
    ['aliases.form', 'privateComment', 'tooLong', { max: 160, unit: 'bytes' }],
    ['aliasDomains.form', 'name', 'required'],
    ['aliasDomains.form', 'name', 'invalidFormat', { format: 'domainName' }],
    ['aliasDomains.form', 'name', 'reserved'],
    ['aliasDomains.form', 'name', 'conflictsWith', { field: 'targetDomain' }],
    ['aliasDomains.form', 'targetDomain', 'notFound', { resource: 'domain' }],
    ['aliasDomains.form', 'targetDomain', 'notEligible', { kind: 'relayDomain' }],
    ['aliasDomains.form', 'targetDomain', 'notEligible', { kind: 'aliasDomain' }],
    ['aliasDomains.form', 'rateLimit.value', 'outOfRange', { min: 1, max: 100 }],
    ['aliasDomains.form', 'rateLimit.frame', 'notInList', { allowed: ['second'] }],
    ['aliasDomains.form', 'dkimSelector', 'invalidFormat', { format: 'dkimSelector' }],
    ['aliasDomains.form', 'dkimKeySize', 'notInList', { allowed: [2048] }],
    ['resources.form', 'description', 'required'],
    ['resources.form', 'description', 'tooLong', { max: 255 }],
    ['resources.form', 'description', 'invalidFormat', { format: 'resourceDescription' }],
    ['resources.form', 'domain', 'notFound', { resource: 'domain' }],
    ['resources.form', 'domain', 'notEligible', { kind: 'aliasDomain' }],
    ['resources.form', 'kind', 'notInList', { allowed: ['location'] }],
    ['resources.form', 'bookingLimit', 'required'],
    ['resources.form', 'bookingLimit', 'outOfRange', { min: 1, max: 1000 }],
    ['resources.form', 'bookingLimit', 'conflictsWith', { field: 'bookingRule' }],
    ['senderSettings', 'explicitPermissions.0', 'invalidFormat', { format: 'senderPermission' }],
    ['senderSettings', 'explicitPermissions.0', 'notFound', { resource: 'address' }],
    ['senderSettings', 'explicitPermissions.0', 'notFound', { resource: 'domain' }],
    ['senderSettings', 'explicitPermissions.0', 'notEligible', { allowedRoles: ['admin'] }],
    ['senderSettings', 'externalSenderAddresses.0', 'invalidFormat', { format: 'emailOrDomain' }],
    ['senderSettings', 'externalSenderAddresses.0', 'notEligible', { kind: 'localDomain' }],
  ]

  it.each(VARIANTS)('%s %s %s has its own message', (formKey, path, code, params) => {
    const key = violationMessageKey(violation(code, params), hasMessage, { formKey, path })
    expect(key).not.toBe('validation.invalid')
    expect(hasMessage(key)).toBe(true)
    const message = violationMessage(violation(code, params), tr, {
      formKey,
      path,
      valueAt: () => 'x@example.org',
    })
    expect(message).not.toBe('')
    expect(message).not.toContain('%s')
  })

  it.each([
    ['address-in-use', 409, { address: 'a@example.org', holder: 'alias' }],
    ['domain-alias-limit-reached', 409, { domain: 'example.org', count: 1, limit: 1 }],
    ['alias-domain-already-exists', 409, { name: 'example.net', existingKind: 'aliasDomain' }],
    ['not-primary-domain-alias', 409, {}],
    ['attribute-not-permitted', 403, { attributes: ['rateLimit'], requiredFlags: ['ratelimit'] }],
    ['permission-flag-required', 403, { requiredFlags: ['aliasDomains'] }],
    ['temporary-failure', 503, {}],
  ] as const)('problem %s has its own message', (name, status, extensions) => {
    const found = problem(name, status, extensions)
    const key = problemMessageKey(found, hasMessage)
    expect(key.startsWith(`problem.${name}`)).toBe(true)
    expect(problemMessage(found, tr, { params: { address: 'a@example.org' } })).not.toContain('%s')
  })
})
