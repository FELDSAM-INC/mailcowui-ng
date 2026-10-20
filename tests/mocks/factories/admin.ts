import { createHash } from 'node:crypto'
import type { Admin } from '@/api'

export interface MockAdmin extends Omit<Admin, 'etag'> {
  version: number
}
export function mockAdmin(overrides: Partial<MockAdmin> = {}): MockAdmin {
  return {
    username: 'admin',
    active: true,
    forcePasswordChange: false,
    forceSecondFactorSetup: false,
    secondFactorStatus: 'none',
    activePasskeyCount: 0,
    createdAt: '2026-01-01T09:00:00.000Z',
    modifiedAt: null,
    version: 1,
    ...overrides,
  }
}
/** Settings only: changing second factors or passkey counts does not change an account ETag. */
export function accountEtag(item: MockAdmin): string {
  const {
    secondFactorStatus: _secondFactorStatus,
    activePasskeyCount: _activePasskeyCount,
    ...stored
  } = item
  return `"${createHash('sha256').update(JSON.stringify(stored)).digest('hex').slice(0, 24)}"`
}
export function adminView(item: MockAdmin): Admin {
  const { version: _version, ...value } = item
  return { ...value, etag: accountEtag(item) }
}
