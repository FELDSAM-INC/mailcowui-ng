// The mock contract validator (research R22, FR-093): every mocked request and response must be
// one the pinned contract allows, so tests can never pass on data the API could never return.
import { describe, expect, it } from 'vitest'

import { contractValidator, type RequestInfo } from '../../mocks/contract/validator'

const validator = contractValidator()
const origin = 'http://localhost'

function request(
  method: string,
  path: string,
  init: { headers?: Record<string, string>; body?: unknown; contentType?: string } = {},
): RequestInfo {
  const headers = new Headers(init.headers)
  if (init.body !== undefined) headers.set('Content-Type', init.contentType ?? 'application/json')
  return { method, url: `${origin}/api/v2${path}`, headers, body: init.body }
}

function matchOf(method: string, path: string) {
  const match = validator.match(method, path)
  if (!match) throw new Error(`no operation for ${method} ${path}`)
  return match
}

const problem = (type: string, status: number) => ({
  type: `/api/v2/problems/${type}`,
  title: 'Title',
  status,
  requestId: '4bf92f3577b34da6a3ce929d0e0e4736',
})

describe('operation matching', () => {
  it('matches a request to its operation by method and templated path', () => {
    expect(validator.match('GET', '/session')?.operationId).toBe('getSession')
    expect(validator.match('DELETE', '/session')?.operationId).toBe('deleteSession')
    const passkey = validator.match('PATCH', `/me/passkeys/${'a'.repeat(64)}`)
    expect(passkey?.operationId).toBe('updatePasskey')
    expect(passkey?.pathParams).toEqual({ passkeyId: 'a'.repeat(64) })
  })

  it('prefers literal path segments over templates', () => {
    expect(validator.match('GET', '/api-keys/owner-candidates')?.operationId).toBe(
      'listApiKeyOwnerCandidates',
    )
    expect(validator.match('GET', '/api-keys/01J9ZQ4X2V8R6T3M5N7P9Q1S2T')?.operationId).toBe(
      'getApiKey',
    )
  })

  it('rejects a request that matches no operation (FR-093)', () => {
    const result = validator.validateRequest(request('GET', '/unknown'))
    expect(result.match).toBeNull()
    expect(result.violations.join('\n')).toMatch(/no contract operation/i)
    expect(validator.validateRequest(request('PUT', '/session')).match).toBeNull()
    const legacy = validator.validateRequest({
      method: 'GET',
      url: `${origin}/api/v1/get/mailbox/all`,
      headers: new Headers(),
    })
    expect(legacy.violations).not.toEqual([])
  })
})

describe('request validation', () => {
  it('accepts a valid request', () => {
    const result = validator.validateRequest(
      request('POST', '/session', {
        headers: { 'X-CSRF-Token': 'token' },
        body: { username: 'admin', password: 'secret', role: 'admin' },
      }),
    )
    expect(result.match?.operationId).toBe('createSession')
    expect(result.violations).toEqual([])
  })

  it('rejects an unsafe request without X-CSRF-Token', () => {
    const result = validator.validateRequest(request('DELETE', '/session'))
    expect(result.violations.join('\n')).toMatch(/X-CSRF-Token/)
    expect(validator.validateRequest(request('GET', '/session')).violations).toEqual([])
  })

  it('rejects a request body that violates its schema', () => {
    const missing = validator.validateRequest(
      request('POST', '/session', { headers: { 'X-CSRF-Token': 't' }, body: { username: 'a' } }),
    )
    expect(missing.violations.join('\n')).toMatch(/password/)
    const wrongRole = validator.validateRequest(
      request('POST', '/session', {
        headers: { 'X-CSRF-Token': 't' },
        body: { username: 'a', password: 'b', role: 'superuser' },
      }),
    )
    expect(wrongRole.violations).not.toEqual([])
  })

  it('rejects a missing required body and a wrong content type', () => {
    expect(
      validator.validateRequest(request('POST', '/session', { headers: { 'X-CSRF-Token': 't' } }))
        .violations,
    ).not.toEqual([])
    expect(
      validator
        .validateRequest(
          request('PATCH', '/me/preferences', {
            headers: { 'X-CSRF-Token': 't' },
            body: { theme: 'dark' },
            contentType: 'text/plain',
          }),
        )
        .violations.join('\n'),
    ).toMatch(/content type/i)
  })

  it('validates path and query parameters', () => {
    expect(
      validator.validateRequest(request('GET', '/me/passkeys/not-hex')).violations,
    ).not.toEqual([])
    expect(validator.validateRequest(request('GET', '/api-keys?limit=0')).violations).not.toEqual(
      [],
    )
    expect(
      validator.validateRequest(request('GET', '/api-keys?unknownFilter=1')).violations.join('\n'),
    ).toMatch(/unknownFilter/)
    expect(
      validator.validateRequest(
        request('GET', '/audit-events?eventType=signIn&eventType=signOut&limit=50&outcome=failure'),
      ).violations,
    ).toEqual([])
    expect(
      validator.validateRequest(request('GET', '/audit-events?eventType=noSuchEventType'))
        .violations,
    ).not.toEqual([])
  })
})

describe('response validation', () => {
  it('accepts a valid getSession 200', () => {
    const violations = validator.validateResponse(matchOf('GET', '/session'), {
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: { data: { state: 'anonymous', pendingActions: [], idleTimeout: 10800 } },
    })
    expect(violations).toEqual([])
  })

  it('rejects an undocumented status', () => {
    const violations = validator.validateResponse(matchOf('GET', '/session'), {
      status: 404,
      headers: new Headers({ 'Content-Type': 'application/problem+json' }),
      body: problem('unauthenticated', 404),
    })
    expect(violations.join('\n')).toMatch(/404/)
  })

  it('rejects a body that violates the schema (Base64Url with = padding)', () => {
    const violations = validator.validateResponse(matchOf('POST', '/session/passkey-challenge'), {
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: {
        data: {
          publicKey: {
            challenge: 'abc=',
            rpId: 'mail.example.org',
            timeout: 300000,
            userVerification: 'required',
            allowCredentials: [],
          },
          expiresAt: '2026-10-18T12:00:00Z',
        },
      },
    })
    expect(violations.join('\n')).toMatch(/challenge/)
  })

  it('rejects an undocumented content type', () => {
    const violations = validator.validateResponse(matchOf('GET', '/session'), {
      status: 200,
      headers: new Headers({ 'Content-Type': 'text/html' }),
      body: '<html></html>',
    })
    expect(violations.join('\n')).toMatch(/content type/i)
  })

  it('rejects a missing required header', () => {
    const session = { state: 'active', pendingActions: [], idleTimeout: 10800 }
    const location = validator.validateResponse(matchOf('POST', '/session'), {
      status: 201,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: { data: session },
    })
    expect(location.join('\n')).toMatch(/Location/)

    const retryAfter = validator.validateResponse(matchOf('POST', '/session'), {
      status: 429,
      headers: new Headers({ 'Content-Type': 'application/problem+json' }),
      body: { ...problem('too-many-requests', 429), retryAfter: 30 },
    })
    expect(retryAfter.join('\n')).toMatch(/Retry-After/)

    const etag = validator.validateResponse(matchOf('GET', '/me/preferences'), {
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: { data: { language: 'en-gb', theme: 'system', etag: '"1"' } },
    })
    expect(etag.join('\n')).toMatch(/ETag/)
  })

  it('accepts empty 204 and 304 responses and rejects a body on 204', () => {
    expect(
      validator.validateResponse(matchOf('DELETE', '/session'), {
        status: 204,
        headers: new Headers(),
      }),
    ).toEqual([])
    expect(
      validator.validateResponse(matchOf('GET', '/public-config'), {
        status: 304,
        headers: new Headers({ ETag: '"abc"' }),
      }),
    ).toEqual([])
    expect(
      validator.validateResponse(matchOf('DELETE', '/session'), {
        status: 204,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        body: { data: {} },
      }),
    ).not.toEqual([])
  })

  it('rejects a value outside a closed enumeration (unknown AuditEventType)', () => {
    const event = {
      id: '01J9ZQ4X2V8R6T3M5N7P9Q1S2T',
      occurredAt: '2026-10-18T10:00:00Z',
      eventType: 'noSuchEventType',
      outcome: 'success',
      actor: { username: 'admin', role: 'admin', apiKeyId: null },
      target: null,
      clientAddress: '192.0.2.10',
      userAgent: 'Test',
      authMethod: 'password',
      failureReason: null,
      requestId: '4bf92f3577b34da6a3ce929d0e0e4736',
      details: {},
    }
    const violations = validator.validateResponse(matchOf('GET', '/audit-events'), {
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: { data: [event], meta: { total: 1, limit: 25, offset: 0 } },
    })
    expect(violations.join('\n')).toMatch(/eventType/)
    const valid = validator.validateResponse(matchOf('GET', '/audit-events'), {
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: { data: [{ ...event, eventType: 'signIn' }], meta: { total: 1, limit: 25, offset: 0 } },
    })
    expect(valid).toEqual([])
  })

  it('validates a value against a named component schema', () => {
    expect(validator.validateSchema('#/components/schemas/Role', 'admin')).toEqual([])
    expect(validator.validateSchema('#/components/schemas/Role', 'root')).not.toEqual([])
  })
})
