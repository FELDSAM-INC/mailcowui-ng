// OAuth2 clients of the mock API (UI 012 T010, research R24): client IDs of 12 and secrets of 24
// lowercase hexadecimal characters, version tags that change with every stored change, token
// counts, and the capabilities read.
import { createHash } from 'node:crypto'

import type { Oauth2Client, Oauth2ClientCapabilities } from '@/api'

import { hex } from './ids'

/** A stored OAuth2 client; the secret stays server-side except in create and renew answers. */
export interface MockOauth2Client {
  id: number
  clientId: string
  clientSecret: string
  redirectUris: string[]
  scope: string | null
  activeAccessTokens: number
  activeRefreshTokens: number
  /** Changes with every stored change; the version tag is derived from it. */
  version: number
}

export const OAUTH2_CAPABILITIES: Oauth2ClientCapabilities = {
  endpoints: {
    authorization: '/oauth/authorize',
    token: '/oauth/token',
    profile: '/oauth/profile',
  },
  scope: 'profile',
  grantTypes: ['authorization_code', 'refresh_token', 'password'],
  accessTokenLifetimeSeconds: 86_400,
  refreshTokenLifetimeSeconds: 2_678_400,
  redirectUrisMaxLength: 2000,
  bulkLimit: 100,
  defaultPageSize: 25,
  maxPageSize: 100,
}

export const newClientId = (): string => hex(6)
export const newClientSecret = (): string => hex(12)

export function mockOauth2Client(overrides: Partial<MockOauth2Client> & { id: number }) {
  return {
    clientId: newClientId(),
    clientSecret: newClientSecret(),
    redirectUris: [`https://app${overrides.id}.example.org/oauth/callback`],
    scope: 'profile',
    activeAccessTokens: 0,
    activeRefreshTokens: 0,
    version: 1,
    ...overrides,
  } satisfies MockOauth2Client
}

export function oauth2ClientEtag(client: MockOauth2Client): string {
  const { activeAccessTokens: _a, activeRefreshTokens: _r, ...stored } = client
  return `"o${createHash('sha256').update(JSON.stringify(stored)).digest('hex').slice(0, 23)}"`
}

/** The representation without the secret. */
export function oauth2ClientView(client: MockOauth2Client): Oauth2Client {
  return {
    id: client.id,
    clientId: client.clientId,
    redirectUris: [...client.redirectUris],
    scope: client.scope,
    activeAccessTokens: client.activeAccessTokens,
    activeRefreshTokens: client.activeRefreshTokens,
    etag: oauth2ClientEtag(client),
  }
}
