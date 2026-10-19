// The alias form model (T043, data-model §2, research R8, R9; legacy form map): the create request
// of the classic "Add alias" form, the patch of the "Edit alias" form, and which refusals concern
// one address only.
import { describe, expect, it } from 'vitest'

import { ApiProblem } from '@/api'
import {
  buildAliasPatch,
  classifyAliasRefusal,
  createFormDefaults,
  editFormFrom,
  toCreateRequest,
} from '@/features/aliases/alias-form'

import { alias } from './alias-fixture'

const problem = (name: string, status: number, errors: Record<string, unknown[]> = {}) =>
  ApiProblem.fromParts({
    kind: 'problem',
    type: `/api/v2/problems/${name}`,
    status,
    fieldErrors: new Map(Object.entries(errors)) as never,
  })

describe('toCreateRequest', () => {
  it('sends the legacy defaults, the destinations as parsed, and the groupware option only with the groupware', () => {
    const form = {
      ...createFormDefaults(),
      destinationsText: 'anna@example.org, Bob@example.org; anna@EXAMPLE.org',
    }
    expect(toCreateRequest(form, 'sales@example.org', { groupwareEnabled: true })).toEqual({
      address: 'sales@example.org',
      destinations: ['anna@example.org', 'Bob@example.org'],
      active: true,
      senderAllowed: true,
      internal: false,
      groupwareVisible: true,
    })
    expect(
      toCreateRequest(form, 'sales@example.org', { groupwareEnabled: false }),
    ).not.toHaveProperty('groupwareVisible')
  })

  it('sends a special action alone, never the destinations', () => {
    const form = {
      ...createFormDefaults(),
      destinationsText: 'anna@example.org',
      gotoAction: 'learnHam' as const,
    }
    const request = toCreateRequest(form, '@example.org', { groupwareEnabled: true })
    expect(request.destinationType).toBe('learnHam')
    expect(request).not.toHaveProperty('destinations')
  })
})

describe('buildAliasPatch', () => {
  const read = alias({ publicComment: 'x'.repeat(200) })

  it('is null when nothing changed', () => {
    expect(buildAliasPatch(read, editFormFrom(read), { groupwareEnabled: true })).toBeNull()
  })

  it('sends only the changed members', () => {
    const form = { ...editFormFrom(read), active: false }
    expect(buildAliasPatch(read, form, { groupwareEnabled: true })).toEqual({ active: false })
  })

  it('sends the destinations only when the choice or the list changed', () => {
    const reordered = {
      ...editFormFrom(read),
      destinationsText: 'bob@example.org anna@example.org',
    }
    expect(buildAliasPatch(read, reordered, { groupwareEnabled: true })).toEqual({
      destinationType: 'addresses',
      destinations: ['bob@example.org', 'anna@example.org'],
    })
    const same = { ...editFormFrom(read), destinationsText: 'anna@example.org,bob@example.org' }
    expect(buildAliasPatch(read, same, { groupwareEnabled: true })).toBeNull()
    const discard = { ...editFormFrom(read), gotoAction: 'discard' as const }
    expect(buildAliasPatch(read, discard, { groupwareEnabled: true })).toEqual({
      destinationType: 'discard',
    })
  })

  it('sends a comment only when it changed, and never the groupware option while it is disabled', () => {
    const form = { ...editFormFrom(read), privateComment: 'new', groupwareVisible: false }
    expect(buildAliasPatch(read, form, { groupwareEnabled: false })).toEqual({
      privateComment: 'new',
    })
  })

  it('sends a changed address', () => {
    const form = { ...editFormFrom(read), address: 'team@example.org' }
    expect(buildAliasPatch(read, form, { groupwareEnabled: true })).toEqual({
      address: 'team@example.org',
    })
  })
})

describe('classifyAliasRefusal (research R9)', () => {
  it.each([
    [problem('address-in-use', 409), 'entry'],
    [problem('domain-alias-limit-reached', 409), 'entry'],
    [problem('validation-failed', 422, { address: [{}] }), 'entry'],
    [problem('validation-failed', 422, { address: [{}], 'destinations.0': [{}] }), 'form'],
    [problem('validation-failed', 422, { publicComment: [{}] }), 'form'],
    [problem('attribute-not-permitted', 403), 'form'],
    [problem('forbidden', 403), 'form'],
    [problem('something-new', 409), 'form'],
  ] as const)('%#: %s', (refusal, scope) => {
    expect(classifyAliasRefusal(refusal)).toBe(scope)
  })
})
