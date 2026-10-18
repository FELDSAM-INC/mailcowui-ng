// The password generator (research R8, FR-029): it runs in the browser with
// `crypto.getRandomValues` and rejection sampling (no modulo bias). The length is the larger of 16
// and the policy minimum, at most 255. Lower case, upper case and digits are always present; a
// special character from a set mail clients accept is added when the policy requires one or is
// unknown. Look-alike characters (0 O 1 l I) are never used, and the value never starts with `{`,
// so it can never look like a pre-hashed value.
import { MAILBOX_PASSWORD_MAX } from '@/shared/validation/limits'

import type { PolicyValues } from './policy-rules'

const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
export const SPECIAL = '-_.+=!?'
export const LOOK_ALIKES = ['0', 'O', '1', 'l', 'I']
const MIN_LENGTH = 16

export type RandomSource = (count: number) => Uint32Array

const cryptoRandom: RandomSource = (count) => crypto.getRandomValues(new Uint32Array(count))

const RANGE = 0x1_0000_0000

/** Draws from the random source in batches; a uniform index rejects the values above the largest
 * multiple of the size, so there is no modulo bias. */
function sampler(random: RandomSource, batch: number) {
  let values = random(batch)
  let next = 0
  return (size: number): number => {
    const limit = RANGE - (RANGE % size)
    for (;;) {
      if (next >= values.length) {
        values = random(batch)
        next = 0
      }
      const value = values[next++]!
      if (value < limit) return value % size
    }
  }
}

export function generatePassword(
  policy: PolicyValues | null,
  random: RandomSource = cryptoRandom,
): string {
  const length = Math.min(MAILBOX_PASSWORD_MAX, Math.max(MIN_LENGTH, policy?.minLength ?? 0))
  const classes = [LOWER, UPPER, DIGITS]
  if (!policy || policy.requireSpecialCharacters) classes.push(SPECIAL)
  const pool = classes.join('')
  const uniform = sampler(random, length * 2 + 8)
  const chars = classes.map((set) => set[uniform(set.length)]!)
  while (chars.length < length) chars.push(pool[uniform(pool.length)]!)
  // Fisher–Yates with the same uniform source.
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const other = uniform(index + 1)
    ;[chars[index], chars[other]] = [chars[other]!, chars[index]!]
  }
  return chars.join('')
}
