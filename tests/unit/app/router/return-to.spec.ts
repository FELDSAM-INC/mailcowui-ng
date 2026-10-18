// The page opened after sign-in must be an address of the app (FR-031, FR-092, research R11).
import { describe, expect, it } from 'vitest'

import { acceptReturnTo } from '@/app/router/return-to'

import { createTestRouter } from '../../support/router'

const router = createTestRouter()

describe('acceptReturnTo', () => {
  it.each([
    '/api-keys?status=active',
    '/domains',
    '/',
    '/audit-log?event=signIn&event=signOut#top',
  ])('accepts the in-app path %s', (value) => {
    expect(acceptReturnTo(value, router)).toBe(value)
  })

  it.each([
    ['a protocol-relative address', '//evil.example'],
    ['a backslash address', '/\\evil.example'],
    ['an absolute URL', 'https://x'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a relative path', 'api-keys'],
    ['a control character', '/api-keys\n'],
    ['a tab', '/api\tkeys'],
    ['a NUL', '/api-keys\u0000'],
    ['an over-long value', `/${'a'.repeat(2048)}`],
    ['the sign-in screen', '/sign-in'],
    ['a role sign-in screen', '/sign-in/admin?returnTo=/domains'],
    ['the second-factor step', '/sign-in/second-factor'],
    ['the pending-actions screen', '/pending-actions'],
    ['an empty string', ''],
  ])('rejects %s', (_label, value) => {
    expect(acceptReturnTo(value, router)).toBeNull()
  })

  it.each([undefined, null, 42, ['/domains'], { path: '/domains' }])(
    'rejects the non-string %j',
    (value) => {
      expect(acceptReturnTo(value, router)).toBeNull()
    },
  )

  it('accepts a value of exactly 2,048 characters', () => {
    const value = `/domains?q=${'a'.repeat(2048 - '/domains?q='.length)}`
    expect(value).toHaveLength(2048)
    expect(acceptReturnTo(value, router)).toBe(value)
  })
})
