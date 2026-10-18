// Identifier helpers of the mock: values in the formats the contract requires.
import { randomBytes } from 'node:crypto'

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** A ULID-shaped identifier (`^[0-9A-HJKMNP-TV-Z]{26}$`). */
export function ulid(): string {
  const bytes = randomBytes(26)
  return Array.from(bytes, (byte) => CROCKFORD[byte % 32]).join('')
}

/** Lower-case hex of `bytes` random bytes. */
export function hex(bytes: number): string {
  return randomBytes(bytes).toString('hex')
}

/** A request identifier (`^[0-9a-f]{32}$`). */
export const requestId = (): string => hex(16)

/** Unpadded base64url of the given bytes. */
export function base64url(data: Uint8Array | Buffer): string {
  return Buffer.from(data).toString('base64url')
}

/** Random unpadded base64url bytes. */
export const randomBase64url = (bytes = 32): string => base64url(randomBytes(bytes))

/** A random token with letters and digits only. */
export function token(length: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from(randomBytes(length), (byte) => alphabet[byte % alphabet.length]).join('')
}
