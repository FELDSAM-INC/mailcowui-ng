// UI 006 (T021, research R24): guards over the generated problem types read the extension members
// of the quarantine, spam policy and rate limit problems.
import { describe, expect, it } from 'vitest'

import {
  ApiProblem,
  deliveryRefusalOf,
  existingEntryOf,
  messageTooLargeOf,
  notPermittedAttributesOf,
  requiredFlagsOf,
  temporaryFailureOf,
} from '@/api'

const problem = (name: string, extensions: Record<string, unknown>, status = 409) =>
  ApiProblem.fromParts({ kind: 'problem', type: `/api/v2/problems/${name}`, status, extensions })

describe('UI 006 problem guards', () => {
  it('reads requiredFlags and requiredFlagsMatch', () => {
    expect(
      requiredFlagsOf(problem('permission-flag-required', { requiredFlags: ['quarantine'] }, 403)),
    ).toEqual({ requiredFlags: ['quarantine'], requiredFlagsMatch: 'all' })
    expect(
      requiredFlagsOf(
        problem(
          'permission-flag-required',
          { requiredFlags: ['quarantine', 'quarantineAttachments'], requiredFlagsMatch: 'any' },
          403,
        ),
      ),
    ).toEqual({ requiredFlags: ['quarantine', 'quarantineAttachments'], requiredFlagsMatch: 'any' })
    expect(
      requiredFlagsOf(problem('permission-flag-required', { requiredFlags: [] }, 403)),
    ).toBeNull()
    expect(requiredFlagsOf(problem('forbidden', {}, 403))).toBeNull()
  })

  it('reads the attributes a mailbox user may not change', () => {
    expect(
      notPermittedAttributesOf(
        problem(
          'attribute-not-permitted',
          { attributes: ['category'], requiredFlags: { category: 'quarantineCategory' } },
          403,
        ),
      ),
    ).toEqual({ attributes: ['category'], requiredFlags: { category: 'quarantineCategory' } })
    expect(notPermittedAttributesOf(problem('attribute-not-permitted', {}, 403))).toBeNull()
  })

  it('reads the dependency and step of a temporary failure', () => {
    expect(
      temporaryFailureOf(
        problem('temporary-failure', { dependency: 'spamFilter', step: 'learning' }, 503),
      ),
    ).toEqual({ dependency: 'spamFilter', step: 'learning' })
    expect(
      temporaryFailureOf(problem('temporary-failure', { dependency: 'sharedStore' }, 503)),
    ).toEqual({
      dependency: 'sharedStore',
    })
    expect(temporaryFailureOf(problem('temporary-failure', {}, 503))).toBeNull()
  })

  it('reads the refused delivery, the size limit and the existing entry', () => {
    expect(
      deliveryRefusalOf(
        problem('quarantine-delivery-refused', { smtpCode: 550, smtpResponse: '5.7.1 no' }),
      ),
    ).toEqual({ smtpCode: 550, smtpResponse: '5.7.1 no' })
    expect(
      deliveryRefusalOf(problem('quarantine-delivery-refused', { smtpCode: '550' })),
    ).toBeNull()
    expect(
      messageTooLargeOf(problem('quarantine-message-too-large', { size: 12, limit: 10 })),
    ).toEqual({ size: 12, limit: 10 })
    expect(messageTooLargeOf(problem('quarantine-item-busy', {}))).toBeNull()
    expect(
      existingEntryOf(problem('spam-policy-entry-exists', { list: 'block', entryId: 7 })),
    ).toEqual({
      list: 'block',
      entryId: 7,
    })
    expect(
      existingEntryOf(problem('spam-policy-entry-exists', { list: 'x', entryId: 7 })),
    ).toBeNull()
  })
})
