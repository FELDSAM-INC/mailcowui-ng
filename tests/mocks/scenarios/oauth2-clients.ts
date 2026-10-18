// OAuth2 client scenarios (UI 012 US5 T076, research R24). Data is deterministic, so tests can
// name clients by their numeric identifier and client ID (`fixedClientId(n)`).
import { mockOauth2Client, type MockOauth2Client } from '../factories/oauth2-client'
import type { ScenarioDefinition } from './index'

/** The client ID of client number `n`: 12 lowercase hexadecimal characters. */
export const fixedClientId = (n: number): string => (0xa1b2c3000000 + n).toString(16)

/** The stored secret of client number `n`; the app never shows a stored secret. */
export const fixedClientSecret = (n: number): string =>
  (0xf00d0000 + n).toString(16).padStart(24, '0')

/** A single redirect URI of exactly 2,000 characters. */
export const LONG_REDIRECT_URI = `https://very-long.example.org/${'callback/'.repeat(240)}`.slice(
  0,
  2000,
)

/** Client number `n` of the scenarios. */
export function scenarioClient(n: number, overrides: Partial<MockOauth2Client> = {}) {
  return mockOauth2Client({
    id: n,
    clientId: fixedClientId(n),
    clientSecret: fixedClientSecret(n),
    redirectUris: [`https://app${n}.example.org/oauth/callback`],
    ...overrides,
  })
}

function many(): MockOauth2Client[] {
  return Array.from({ length: 40 }, (_, index) => {
    const n = index + 1
    if (n === 3) {
      return scenarioClient(n, {
        redirectUris: [
          'https://wiki.example.org/oauth/callback',
          'https://wiki.example.org/oauth/callback2',
        ],
      })
    }
    if (n === 17) return scenarioClient(n, { redirectUris: ['https://wiki.example.net/auth'] })
    if (n === 5) return scenarioClient(n, { activeAccessTokens: 12, activeRefreshTokens: 4 })
    if (n === 9) return scenarioClient(n, { redirectUris: [LONG_REDIRECT_URI] })
    return scenarioClient(n)
  })
}

const admin = { signedInAs: 'admin' } as const

export const oauth2ClientScenarios: Record<string, ScenarioDefinition> = {
  'oauth2-empty': {
    description: 'Administrator; no OAuth2 client yet',
    overrides: { ...admin, oauth2Clients: [] },
  },
  'oauth2-many': {
    description:
      'Administrator; 40 clients, two with "wiki" in their redirect URIs, one with active tokens and one with a 2,000-character redirect URI',
    overrides: { ...admin, oauth2Clients: many() },
  },
  'oauth2-legacy-invalid': {
    description:
      'Administrator; clients stored by the classic interface with an empty list and a fragment URI',
    overrides: {
      ...admin,
      oauth2Clients: [
        scenarioClient(1, { redirectUris: [] }),
        scenarioClient(2, { redirectUris: ['https://legacy.example.org/cb#frag'] }),
      ],
    },
  },
  'oauth2-changed-elsewhere': {
    description: 'Administrator; two clients that the test changes behind the app (mockApi.patch)',
    overrides: { ...admin, oauth2Clients: [scenarioClient(1), scenarioClient(2)] },
  },
  'oauth2-deleted-elsewhere': {
    description: 'Administrator; two clients, the second removed behind the app by the test',
    overrides: { ...admin, oauth2Clients: [scenarioClient(1), scenarioClient(2)] },
  },
  'oauth2-bulk-partial': {
    description:
      'Administrator; three clients for a bulk action, one changed elsewhere by the test',
    overrides: {
      ...admin,
      oauth2Clients: [
        scenarioClient(1, { activeAccessTokens: 2 }),
        scenarioClient(2),
        scenarioClient(3, { activeRefreshTokens: 1 }),
      ],
    },
  },
  'oauth2-bulk-twenty': {
    description: 'Administrator; 20 clients, of which client 7 fails in a bulk action',
    overrides: {
      ...admin,
      oauth2Clients: Array.from({ length: 20 }, (_, index) =>
        scenarioClient(index + 1, { failsInBulk: index + 1 === 7 }),
      ),
    },
  },
}
