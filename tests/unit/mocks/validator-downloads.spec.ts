// UI 006 (T004, research R10 and R28): the mock contract validator checks the binary bodies of the
// quarantine downloads by their declared content type and the four required headers, and skips JSON
// schema validation for them. UI 001's validator already reads non-JSON bodies as binary (P21), so
// these checks pin that behaviour for the 006 operations.
import { describe, expect, it } from 'vitest'

import { contractValidator } from '../../mocks/contract/validator'

const validator = contractValidator()

function matchOf(method: string, path: string) {
  const match = validator.match(method, path)
  if (!match) throw new Error(`no operation for ${method} ${path}`)
  return match
}

const DOWNLOAD_HEADERS = {
  'Content-Disposition': `attachment; filename="invoice.pdf"; filename*=UTF-8''invoice.pdf`,
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; sandbox",
  'Cache-Control': 'private, no-store',
}

const problem = (type: string, status: number, extra: Record<string, unknown> = {}) => ({
  type: `/api/v2/problems/${type}`,
  title: 'Title',
  status,
  requestId: '4bf92f3577b34da6a3ce929d0e0e4736',
  ...extra,
})

describe('quarantine downloads in the mock validator', () => {
  it('accepts an attachment as application/octet-stream with the four required headers', () => {
    const match = matchOf('GET', '/quarantine/12/attachments/0')
    expect(match.operationId).toBe('downloadQuarantineAttachment')
    const headers = new Headers({ ...DOWNLOAD_HEADERS, 'Content-Type': 'application/octet-stream' })
    expect(validator.validateResponse(match, { status: 200, headers, body: '(binary)' })).toEqual(
      [],
    )
  })

  it('rejects the same answer without Content-Disposition', () => {
    const match = matchOf('GET', '/quarantine/12/attachments/0')
    const { 'Content-Disposition': _omitted, ...rest } = DOWNLOAD_HEADERS
    const headers = new Headers({ ...rest, 'Content-Type': 'application/octet-stream' })
    expect(validator.validateResponse(match, { status: 200, headers, body: '(binary)' })).toEqual([
      expect.stringContaining('missing required header Content-Disposition'),
    ])
  })

  it('rejects a whole-message download declared as text/html', () => {
    const match = matchOf('GET', '/quarantine/12/message')
    expect(match.operationId).toBe('downloadQuarantineMessage')
    const ok = new Headers({ ...DOWNLOAD_HEADERS, 'Content-Type': 'message/rfc822' })
    expect(
      validator.validateResponse(match, { status: 200, headers: ok, body: '(binary)' }),
    ).toEqual([])
    const html = new Headers({ ...DOWNLOAD_HEADERS, 'Content-Type': 'text/html' })
    expect(
      validator.validateResponse(match, { status: 200, headers: html, body: '<b>x</b>' }),
    ).toEqual([expect.stringContaining('undocumented content type text/html')])
  })

  it('rejects a download whose nosniff header has another value', () => {
    const match = matchOf('GET', '/quarantine/12/message')
    const headers = new Headers({
      ...DOWNLOAD_HEADERS,
      'X-Content-Type-Options': 'sniff',
      'Content-Type': 'message/rfc822',
    })
    expect(
      validator.validateResponse(match, { status: 200, headers, body: '(binary)' }),
    ).not.toEqual([])
  })

  it('accepts a 409 quarantine-item-busy problem with Retry-After', () => {
    const match = matchOf('POST', '/quarantine/12/release')
    const headers = new Headers({ 'Content-Type': 'application/problem+json', 'Retry-After': '5' })
    expect(
      validator.validateResponse(match, {
        status: 409,
        headers,
        body: problem('quarantine-item-busy', 409),
      }),
    ).toEqual([])
  })
})
