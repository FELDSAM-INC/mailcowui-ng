// Scenarios of US4 (T101): own passkey management. Passkey IDs and version tags of
// `user-with-passkeys` are fixed, so tests can change a passkey "elsewhere" through
// `PATCH /__mock/scenarios/:id` (`accounts`).
import { passkey } from '../factories/passkey'
import type { ScenarioDefinition } from './index'

export const PASSKEY_IDS = {
  phone: '1'.repeat(64),
  otherHost: '2'.repeat(64),
  inactive: '3'.repeat(64),
  unnamed: '4'.repeat(64),
} as const

/** alice's passkeys: newest first by registration date is unnamed, inactive, otherHost, phone. */
export function alicePasskeys() {
  return [
    passkey({
      id: PASSKEY_IDS.phone,
      name: 'Phone',
      authenticatorDescription: 'iCloud Keychain',
      registeredAt: '2026-06-01T09:00:00Z',
      etag: '"pk-phone-1"',
    }),
    passkey({
      id: PASSKEY_IDS.otherHost,
      name: 'Old laptop',
      authenticatorDescription: 'Windows Hello',
      registeredAt: '2026-07-01T09:00:00Z',
      hostName: 'mail.example.net',
      etag: '"pk-other-1"',
    }),
    passkey({
      id: PASSKEY_IDS.inactive,
      name: 'Lost key',
      authenticatorDescription: 'YubiKey 5 Series',
      registeredAt: '2026-08-01T09:00:00Z',
      active: false,
      etag: '"pk-inactive-1"',
    }),
    passkey({
      id: PASSKEY_IDS.unnamed,
      name: null,
      authenticatorDescription: null,
      registeredAt: '2026-09-01T09:00:00Z',
      etag: '"pk-unnamed-1"',
    }),
  ]
}

export const passkeyScenarios: Record<string, ScenarioDefinition> = {
  'admin-no-passkeys': {
    description: 'admin is signed in and has no passkeys.',
    overrides: { signedInAs: 'admin' },
  },
  'user-with-passkeys': {
    description:
      'alice@example.org is signed in with four passkeys: one for another host, one inactive, one without name and description.',
    overrides: {
      signedInAs: 'alice@example.org',
      accounts: { 'alice@example.org': { passkeys: alicePasskeys() } },
    },
  },
  'passkey-registration-rejected': {
    description: 'admin is signed in; the server rejects every passkey registration.',
    overrides: {
      signedInAs: 'admin',
      failures: { registerPasskey: { status: 400, type: 'passkey-registration-failed' } },
    },
  },
  'passkey-changed-elsewhere': {
    description:
      'alice@example.org is signed in with passkeys; tests rename or remove one through PATCH (accounts) before the app saves.',
    overrides: {
      signedInAs: 'alice@example.org',
      accounts: { 'alice@example.org': { passkeys: alicePasskeys() } },
    },
  },
}
