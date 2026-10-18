// Scenarios of US2 (T085): usernameless passkey sign-in. Each seeded passkey carries a credential
// ID of SEEDED_CREDENTIALS, which the end-to-end tests give to the virtual authenticator or to the
// credential stub.
import { passkey } from '../factories/passkey'
import { SEEDED_CREDENTIALS } from '../factories/webauthn'
import type { ScenarioDefinition } from './index'
import { totp } from './accounts'

const alicePasskey = () =>
  passkey({ name: 'Phone', credentialId: SEEDED_CREDENTIALS.alice, hostName: 'localhost' })

export const passkeySignInScenarios: Record<string, ScenarioDefinition> = {
  'passkey-user': {
    description:
      'alice@example.org has a passkey (SEEDED_CREDENTIALS.alice) and an authenticator app, which a passkey sign-in skips.',
    overrides: {
      accounts: {
        'alice@example.org': { passkeys: [alicePasskey()], secondFactors: [totp(51, 'Phone')] },
      },
    },
  },
  'passkey-admin': {
    description: 'admin has a passkey (SEEDED_CREDENTIALS.admin).',
    overrides: {
      accounts: {
        admin: { passkeys: [passkey({ name: 'Laptop', credentialId: SEEDED_CREDENTIALS.admin })] },
      },
    },
  },
  'passkey-forced-password-change': {
    description:
      'bob@example.org must change his password and has a passkey (SEEDED_CREDENTIALS.bob).',
    overrides: {
      accounts: {
        'bob@example.org': {
          passkeys: [passkey({ name: 'Phone', credentialId: SEEDED_CREDENTIALS.bob })],
        },
      },
    },
  },
  'passkey-throttled': {
    description: 'Every passkey sign-in is refused as too many requests (retry after 90 s).',
    overrides: {
      behaviour: { throttleThreshold: 0, retryAfter: 90 },
      accounts: { 'alice@example.org': { passkeys: [alicePasskey()] } },
    },
  },
}
