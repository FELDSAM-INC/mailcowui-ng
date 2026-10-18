// RFC 6238 TOTP codes for the smoke suite (research R25), with node:crypto. The API refuses a code
// whose time step is not later than the last one it accepted for the authenticator, so
// `freshTotp` waits for a step later than any this suite has used, and for one with enough time
// left to type and submit it. The last step is kept in `.smoke/totp-steps.json` rather than in
// memory: Playwright starts a new worker process after a failed test and for a retry, and a rerun
// within the same 30 s would otherwise reuse a step.
import { createHash, createHmac } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

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

const STATE_FILE = join(process.cwd(), '.smoke', 'totp-steps.json')

type StepState = Record<string, number>

function readState(): StepState {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as StepState
  } catch {
    return {}
  }
}

/** The state key of a secret: a hash, so that a real account's secret is never written down. */
function stateKey(secret: string): string {
  return createHash('sha256').update(secret).digest('hex').slice(0, 16)
}

function markUsed(secret: string, step: number) {
  const state = readState()
  state[stateKey(secret)] = step
  mkdirSync(dirname(STATE_FILE), { recursive: true })
  writeFileSync(STATE_FILE, JSON.stringify(state))
}

/** A code of a step later than any used before, with at least `minSecondsLeft` of its window left. */
export async function freshTotp(secret: string, minSecondsLeft = 8): Promise<string> {
  for (;;) {
    const now = Date.now() / 1000
    const step = Math.floor(now / STEP_SECONDS)
    const left = (step + 1) * STEP_SECONDS - now
    const last = readState()[stateKey(secret)] ?? -1
    if (step > last && left >= minSecondsLeft) {
      markUsed(secret, step)
      return totpAt(secret, step)
    }
    await new Promise((resolve) => setTimeout(resolve, Math.ceil(left * 1000) + 50))
  }
}
