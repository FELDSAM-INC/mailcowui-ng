import { expect, it } from 'vitest'
import type { Identity, Role } from '@/api'
import { canSignInAs, type ActingTarget } from '@/features/acting/eligibility'
import { permissionFlags } from '../../../mocks/scenarios/accounts'

function identity(role: Role, loginAs = true): Identity {
  return {
    username: 'operator',
    role,
    authentication: { method: 'password' },
    permissions: permissionFlags(false, { loginAs }),
    pendingActions: [],
    scope:
      role === 'admin' ? { type: 'allDomains' } : { type: 'domains', domains: ['example.org'] },
  }
}
const targets: ActingTarget[] = [
  { kind: 'mailboxUser', address: 'alice@example.org', domain: 'example.org' },
  { kind: 'mailboxUser', address: 'bob@outside.example', domain: 'outside.example' },
  { kind: 'domainAdmin', username: 'reseller' },
]
it.each([
  ['admin', true, [true, true, true]],
  ['domainAdmin', true, [true, false, false]],
  ['domainAdmin', false, [false, false, false]],
  ['mailboxUser', true, [false, false, false]],
] as const)('scopes %s actions with loginAs=%s', (role, loginAs, expected) => {
  expect(targets.map((target) => canSignInAs(identity(role, loginAs), target))).toEqual(expected)
})
it('offers no action without identity, while restricted, or while already acting', () => {
  expect(canSignInAs(undefined, targets[0]!)).toBe(false)
  const current = identity('admin')
  current.pendingActions = ['passwordChange']
  expect(canSignInAs(current, targets[0]!)).toBe(false)
  current.pendingActions = []
  current.impersonation = {
    id: '01K00000000000000000000000',
    startedAt: '2026-10-20T10:00:00Z',
    impersonator: { username: 'admin', role: 'admin', authMethod: 'password' },
    target: { username: 'operator', role: 'domainAdmin' },
  }
  expect(targets.map((target) => canSignInAs(current, target))).toEqual([false, false, false])
})
