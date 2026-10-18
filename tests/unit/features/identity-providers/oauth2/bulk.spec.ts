// Bulk targets and result rows of the OAuth2 list (T081, FR-065): each client by its identifier
// with the version tag as listed, and one row per result labelled with the client ID.
import { describe, expect, it } from 'vitest'

import type { Oauth2Client, Oauth2ClientBulkResult } from '@/api'
import {
  newSecretsOf,
  rowsFromOauth2BulkResult,
  toBulkTargets,
} from '@/features/identity-providers/oauth2/bulk'

const client = (id: number, clientId: string): Oauth2Client => ({
  id,
  clientId,
  redirectUris: [],
  scope: 'profile',
  activeAccessTokens: 0,
  activeRefreshTokens: 0,
  etag: `"e${id}"`,
})

describe('OAuth2 bulk helpers', () => {
  it('sends String(id) with the etag exactly as listed', () => {
    expect(toBulkTargets([client(3, 'aaa'), client(12, 'bbb')])).toEqual([
      { id: '3', version: '"e3"' },
      { id: '12', version: '"e12"' },
    ])
  })

  it('labels each result with the client ID and keeps the problem', () => {
    const result: Oauth2ClientBulkResult = {
      bulkRequestId: '1'.repeat(32),
      results: [
        { id: '3', outcome: 'done' },
        {
          id: '12',
          outcome: 'outdated',
          problem: { type: 'about:blank', title: 'x', status: 412, requestId: '0'.repeat(32) },
        },
        { id: '99', outcome: 'notFound' },
      ],
      summary: { total: 3, done: 1, notFound: 1, refused: 0, outdated: 1, failed: 0 },
    }
    const rows = rowsFromOauth2BulkResult(result, [client(3, 'aaa'), client(12, 'bbb')])
    expect(rows.map((row) => [row.id, row.label, row.outcome])).toEqual([
      ['3', 'aaa', 'done'],
      ['12', 'bbb', 'outdated'],
      ['99', '99', 'notFound'],
    ])
    expect(rows[1]!.problem?.status).toBe(412)
  })

  it('collects the new secrets of done renewals, with their client IDs', () => {
    const result = {
      bulkRequestId: '1'.repeat(32),
      results: [
        { id: '3', outcome: 'done', clientSecret: 'a'.repeat(24) },
        { id: '12', outcome: 'failed' },
      ],
      summary: { total: 2, done: 1, notFound: 0, refused: 0, outdated: 0, failed: 1 },
    } as Oauth2ClientBulkResult
    expect(newSecretsOf(result, [client(3, 'aaa'), client(12, 'bbb')])).toEqual([
      { id: '3', clientId: 'aaa', secret: 'a'.repeat(24) },
    ])
  })
})
