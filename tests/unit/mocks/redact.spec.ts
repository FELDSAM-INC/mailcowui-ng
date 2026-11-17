import { describe, expect, it } from 'vitest'

import { recordedHeaders, redact } from '../../mocks/redact'

describe('mock request diagnostics', () => {
  it('redacts nested credential fields while retaining nonsecret request details', () => {
    const body = {
      bindPassword: 'LDAP-secret',
      clientSecret: 'OAuth-secret',
      remotePassword: 'IMAP-secret',
      state: 'OAuth-state',
      nested: [
        {
          access_token: 'access-secret',
          privateKey: 'private-secret',
          customPassword: 'new-secret',
        },
      ],
      passwordSet: true,
      remotePasswordSet: true,
      host: 'imap.example',
      enabled: false,
    }
    expect(redact(body)).toEqual({
      bindPassword: '[redacted]',
      clientSecret: '[redacted]',
      remotePassword: '[redacted]',
      state: '[redacted]',
      nested: [
        { access_token: '[redacted]', privateKey: '[redacted]', customPassword: '[redacted]' },
      ],
      passwordSet: true,
      remotePasswordSet: true,
      host: 'imap.example',
      enabled: false,
    })
    expect(body.bindPassword).toBe('LDAP-secret')
  })

  it('records header presence without retaining authentication values', () => {
    expect(
      recordedHeaders(
        new Headers({
          'X-CSRF-Token': 'csrf-secret',
          'X-API-Key': 'api-secret',
          Authorization: 'Bearer secret',
          Cookie: 'session=secret',
          'If-Match': '"v1"',
          'Content-Type': 'application/json',
          Referer: 'http://localhost/ng/identity-providers/provider',
        }),
      ),
    ).toEqual({
      'x-csrf-token': '[redacted]',
      'x-api-key': '[redacted]',
      'if-match': '"v1"',
      'content-type': 'application/json',
      referer: 'http://localhost/ng/identity-providers/provider',
    })
  })
})
