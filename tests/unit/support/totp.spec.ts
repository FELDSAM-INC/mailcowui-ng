// The RFC 6238 TOTP helper shared by the mock, the end-to-end tests and the smoke suite (UI 005
// T007, research R24): six-digit codes of 30-second steps over HMAC-SHA-1, and a ±1-step check.
import { describe, expect, it } from 'vitest'

import { totpAt, totpCode, verifyTotp } from '../../support/totp'

// RFC 6238 appendix B: the ASCII secret "12345678901234567890" in base32.
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'

describe('RFC 6238 SHA-1 test vectors (last six digits)', () => {
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
    [20000000000, '353130'],
  ])('at %i seconds the code is %s', (seconds, code) => {
    expect(totpAt(SECRET, Math.floor(seconds / 30))).toBe(code)
    expect(totpCode(SECRET, seconds * 1000)).toBe(code)
  })
})

describe('verifyTotp', () => {
  const now = 1_234_567_890_000

  it('accepts the current step and one step before and after', () => {
    for (const offset of [-1, 0, 1]) {
      expect(verifyTotp(SECRET, totpCode(SECRET, now + offset * 30_000), now)).toBe(true)
    }
  })

  it('refuses codes two steps away, malformed codes and a narrower window', () => {
    expect(verifyTotp(SECRET, totpCode(SECRET, now + 60_000), now)).toBe(false)
    expect(verifyTotp(SECRET, totpCode(SECRET, now - 60_000), now)).toBe(false)
    expect(verifyTotp(SECRET, '12345', now)).toBe(false)
    expect(verifyTotp(SECRET, totpCode(SECRET, now + 30_000), now, 0)).toBe(false)
  })

  it('ignores spaces inside the code', () => {
    const code = totpCode(SECRET, now)
    expect(verifyTotp(SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, now)).toBe(true)
  })
})
