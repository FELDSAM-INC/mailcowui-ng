// RFC 6238 TOTP codes for the smoke suite (research R25), with node:crypto. The API refuses a code
// that was already accepted in its validity window, so `freshTotp` waits for a time step this
// process has not used yet, and for one with enough time left to type and submit it.
import { createHmac } from 'node:crypto'

const STEP_SECONDS = 30
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Decode(secret: string): Buffer {
  const clean = secret.replace(/[\s=]/g, '').toUpperCase()
  let bits = ''
  for (const char of clean) {
    const value = ALPHABET.indexOf(char)
    if (value < 0) throw new Error(`invalid base32 character "${char}"`)
    bits += value.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(parseInt(bits.slice(index, index + 8), 2))
  }
  return Buffer.from(bytes)
}

/** The six-digit code of a time step (RFC 4226 HOTP over the step counter). */
export function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest()
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f
  const binary =
    (((hmac[offset] ?? 0) & 0x7f) << 24) |
    ((hmac[offset + 1] ?? 0) << 16) |
    ((hmac[offset + 2] ?? 0) << 8) |
    (hmac[offset + 3] ?? 0)
  return String(binary % 1_000_000).padStart(6, '0')
}

const used = new Set<number>()

/** A code of a step not used before, with at least `minSecondsLeft` of its window remaining. */
export async function freshTotp(secret: string, minSecondsLeft = 8): Promise<string> {
  for (;;) {
    const now = Date.now() / 1000
    const step = Math.floor(now / STEP_SECONDS)
    const left = (step + 1) * STEP_SECONDS - now
    if (!used.has(step) && left >= minSecondsLeft) {
      used.add(step)
      return totpAt(secret, step)
    }
    await new Promise((resolve) => setTimeout(resolve, Math.ceil(left * 1000) + 50))
  }
}
