// The alias domain form model (T063, data-model §2; legacy form map): the creation request of the
// classic `#addAliasDomainModal` (the DKIM selector emptied for no key, the rate limit only when
// given and permitted), the patch of `edit/aliasdomain.twig`, and which refusals concern one name.
import { describe, expect, it } from 'vitest'

import { ApiProblem } from '@/api'
import {
  buildAliasDomainPatch,
  classifyAliasDomainRefusal,
  createFormDefaults,
  editFormFrom,
  toCreateRequest,
} from '@/features/alias-domains/alias-domain-form'

import { aliasDomain } from './alias-domain-fixture'

const DEFAULTS = { selector: 'feldhost', keySize: 2048 }

describe('toCreateRequest', () => {
  it('prefills the DKIM defaults and sends the form as shown, without an empty rate limit', () => {
    const form = { ...createFormDefaults(DEFAULTS), targetDomain: 'example.org' }
    expect(form.dkimSelector).toBe('feldhost')
    expect(form.dkimKeySize).toBe(2048)
    expect(form.active).toBe(true)
    expect(toCreateRequest(form, 'new.example', { canSetRateLimit: true })).toEqual({
      name: 'new.example',
      targetDomain: 'example.org',
      active: true,
      dkimSelector: 'feldhost',
      dkimKeySize: 2048,
    })
  })

  it('sends an emptied selector without a key size', () => {
    const form = { ...createFormDefaults(DEFAULTS), targetDomain: 'example.org', dkimSelector: ' ' }
    const request = toCreateRequest(form, 'new.example', { canSetRateLimit: true })
    expect(request.dkimSelector).toBe('')
    expect(request).not.toHaveProperty('dkimKeySize')
  })

  it('sends a rate limit only when given and permitted', () => {
    const form = {
      ...createFormDefaults(DEFAULTS),
      targetDomain: 'example.org',
      rateLimitValue: '20',
      rateLimitFrame: 'hour' as const,
    }
    expect(toCreateRequest(form, 'a.example', { canSetRateLimit: true }).rateLimit).toEqual({
      value: 20,
      frame: 'hour',
    })
    expect(toCreateRequest(form, 'a.example', { canSetRateLimit: false })).not.toHaveProperty(
      'rateLimit',
    )
  })
})

describe('buildAliasDomainPatch', () => {
  const read = aliasDomain()

  it('is null when nothing changed, and holds only the changed members', () => {
    expect(buildAliasDomainPatch(read, editFormFrom(read))).toBeNull()
    expect(buildAliasDomainPatch(read, { ...editFormFrom(read), active: false })).toEqual({
      active: false,
    })
    expect(
      buildAliasDomainPatch(read, { ...editFormFrom(read), targetDomain: 'example.com' }),
    ).toEqual({ targetDomain: 'example.com' })
  })
})

describe('classifyAliasDomainRefusal (research R9)', () => {
  const problem = (name: string, status: number, errors: Record<string, unknown[]> = {}) =>
    ApiProblem.fromParts({
      kind: 'problem',
      type: `/api/v2/problems/${name}`,
      status,
      fieldErrors: new Map(Object.entries(errors)) as never,
    })

  it('goes on after a refused name and stops for the whole form', () => {
    expect(classifyAliasDomainRefusal(problem('alias-domain-already-exists', 409))).toBe('entry')
    expect(
      classifyAliasDomainRefusal(
        problem('validation-failed', 422, { name: [{ code: 'reserved' }] }),
      ),
    ).toBe('entry')
    expect(
      classifyAliasDomainRefusal(
        problem('validation-failed', 422, { targetDomain: [{ code: 'notFound' }] }),
      ),
    ).toBe('form')
    expect(classifyAliasDomainRefusal(problem('permission-flag-required', 403))).toBe('form')
    expect(classifyAliasDomainRefusal(problem('temporary-failure', 503))).toBe('form')
  })
})
