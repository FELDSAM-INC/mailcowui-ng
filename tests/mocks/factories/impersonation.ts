import type { Impersonation } from '@/api'
import { ulid } from './ids'
export function impersonation(overrides: Partial<Impersonation> = {}): Impersonation {
  return {
    id: ulid(),
    impersonator: { username: 'admin', role: 'admin', authMethod: 'password' },
    target: { username: 'reseller', role: 'domainAdmin' },
    startedAt: '2026-01-01T10:00:00.000Z',
    ...overrides,
  }
}
