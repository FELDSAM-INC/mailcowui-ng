// Accounts of the smoke suite (research R25): the API's DevelopmentSeeder accounts with the dev
// password. On a real mailcow host (quickstart Part D), SMOKE_* variables point at existing
// accounts instead.
const env = process.env

export const SMOKE_DEFAULT_PASSWORD = 'Passw0rd!dev'

export interface SmokeAccount {
  username: string
  password: string
}

function account(prefix: string, username: string): SmokeAccount {
  return {
    username: env[`SMOKE_${prefix}_USERNAME`] ?? username,
    password: env[`SMOKE_${prefix}_PASSWORD`] ?? SMOKE_DEFAULT_PASSWORD,
  }
}

/** The administrator `admin`. */
export const admin = account('ADMIN', 'admin')
/** The domain administrator `reseller`, managing two domains. */
export const reseller = account('DOMAIN_ADMIN', 'reseller')
/** The mailbox user `alice@example.org`, with an authenticator app (TOTP). */
export const alice = {
  ...account('MAILBOX', 'alice@example.org'),
  totpSecret: env.SMOKE_MAILBOX_TOTP_SECRET ?? 'JBSWY3DPEHPK3PXP',
}
/** The mailbox user `bob@example.org`, forced to change the password. */
export const bob = account('FORCED', 'bob@example.org')

/** A username no account has, so that failed attempts never throttle a seeded account. */
export function unknownUsername(): string {
  return `nobody-${Math.random().toString(36).slice(2, 10)}@example.invalid`
}
