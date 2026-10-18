// The members of an "identity provider in use" problem (T009, FR-014): typed from the generated
// IdentityProviderInUseProblem, null for any other problem or a body without them.
import { describe, expect, it } from 'vitest'

import { ApiProblem, identityProviderInUseDetails } from '@/api'

const inUse = (extensions: Record<string, unknown>, type = 'identity-provider-in-use') =>
  ApiProblem.fromParts({
    kind: 'problem',
    type: `/api/v2/problems/${type}`,
    status: 409,
    extensions,
  })

describe('identityProviderInUseDetails', () => {
  it('returns the blocking count and the counts per source', () => {
    const counts = { keycloak: 0, genericOidc: 3, ldap: 340 }
    expect(
      identityProviderInUseDetails(inUse({ blockingMailboxes: 343, mailboxCounts: counts })),
    ).toEqual({ blockingMailboxes: 343, mailboxCounts: counts })
  })

  it('returns null for another problem type', () => {
    expect(
      identityProviderInUseDetails(
        inUse(
          { blockingMailboxes: 1, mailboxCounts: { keycloak: 1, genericOidc: 0, ldap: 0 } },
          'domain-not-empty',
        ),
      ),
    ).toBeNull()
  })

  it('returns null for a body without the members', () => {
    expect(identityProviderInUseDetails(inUse({}))).toBeNull()
    expect(
      identityProviderInUseDetails(inUse({ blockingMailboxes: 'x', mailboxCounts: {} })),
    ).toBeNull()
    expect(identityProviderInUseDetails(null)).toBeNull()
  })
})
