// T104: the display name of a passkey (FR-052, data-model §2).
import { describe, expect, it } from 'vitest'

import { passkeyDisplayName } from '@/features/passkeys/display-name'

const t = (key: string, named?: Record<string, unknown>) =>
  `${key}${named ? JSON.stringify(named) : ''}`
const date = (value: string) => `date(${value})`

describe('passkeyDisplayName', () => {
  it('prefers the name, then the authenticator description', () => {
    expect(
      passkeyDisplayName(
        { name: 'Phone', authenticatorDescription: 'iCloud', registeredAt: 'x' },
        t,
        date,
      ),
    ).toBe('Phone')
    expect(
      passkeyDisplayName(
        { name: null, authenticatorDescription: 'iCloud', registeredAt: 'x' },
        t,
        date,
      ),
    ).toBe('iCloud')
  })

  it('falls back to "Unknown passkey" with the registration date', () => {
    expect(
      passkeyDisplayName(
        { name: null, authenticatorDescription: null, registeredAt: '2026-09-01T09:00:00Z' },
        t,
        date,
      ),
    ).toBe('passkeys.unknown{"date":"date(2026-09-01T09:00:00Z)"}')
  })

  it('treats blank values as missing', () => {
    expect(
      passkeyDisplayName({ name: '  ', authenticatorDescription: '', registeredAt: 'x' }, t, date),
    ).toContain('passkeys.unknown')
  })
})
