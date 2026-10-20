// UI013 T006/T007: existing binary support is retained; undocumented types and JSON remain checked.
import { describe, expect, it } from 'vitest'
import { contractValidator } from '../../mocks/contract/validator'

const validator = contractValidator()
function validate(path: string, method: string, contentType: string, body: unknown) {
  return validator.validateRequest({
    method,
    url: `http://localhost/api/v2${path}`,
    body,
    headers: new Headers({
      'Content-Type': contentType,
      'X-CSRF-Token': 'mock-token',
      'If-Match': '"read-version"',
    }),
  }).violations
}

describe('UI013 binary request validation', () => {
  it.each(['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'application/octet-stream'])(
    'accepts documented raw %s logo data',
    (contentType) => {
      expect(
        validate('/settings/logos/light', 'PUT', contentType, new Uint8Array([137, 80, 78, 71])),
      ).toEqual([])
    },
  )
  it('rejects an undocumented logo media type', () => {
    expect(validate('/settings/logos/light', 'PUT', 'text/plain', 'image')).not.toEqual([])
  })
  it('still validates JSON and merge-patch bodies against their schema', () => {
    expect(
      validate('/settings/ip-check', 'PATCH', 'application/merge-patch+json', { enabled: true }),
    ).toEqual([])
    expect(
      validate('/settings/ip-check', 'PATCH', 'application/merge-patch+json', { enabled: 'true' }),
    ).not.toEqual([])
    expect(
      validate('/settings/rspamd-ui-password', 'PUT', 'application/json', { password: 42 }),
    ).not.toEqual([])
  })
})
