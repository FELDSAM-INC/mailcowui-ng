// App link addresses are operator data and render only when safe (FR-001a, research R17).
import { describe, expect, it } from 'vitest'

import { safeHref } from '@/shared/security/safe-url'

describe('safeHref', () => {
  it.each([
    ['https://helpdesk.example.org/', 'https://helpdesk.example.org/'],
    ['http://webmail.example.org/SOGo', 'http://webmail.example.org/SOGo'],
    ['HTTPS://Example.org/path?q=1#x', 'HTTPS://Example.org/path?q=1#x'],
    ['/SOGo/so', '/SOGo/so'],
    ['/', '/'],
    ['/api-keys?status=active', '/api-keys?status=active'],
    ['  https://example.org/  ', 'https://example.org/'],
    [
      'https://helpdesk.example.org/?user=alice%40example.org',
      'https://helpdesk.example.org/?user=alice%40example.org',
    ],
  ])('accepts %s', (input, expected) => {
    expect(safeHref(input)).toBe(expected)
  })

  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['upper-case javascript:', 'JavaScript:alert(1)'],
    ['javascript: with leading space', ' javascript:alert(1)'],
    ['javascript: with an embedded tab', 'java\tscript:alert(1)'],
    ['data:', 'data:text/html,<script>alert(1)</script>'],
    ['vbscript:', 'vbscript:msgbox(1)'],
    ['mailto:', 'mailto:a@example.org'],
    ['ftp:', 'ftp://example.org/'],
    ['protocol-relative', '//evil.example/'],
    ['backslash path', '/\\evil.example/'],
    ['relative path', 'SOGo/so'],
    ['fragment only', '#top'],
    ['control character', '/path\u0000x'],
    ['newline', 'https://example.org/\nx'],
    ['empty string', ''],
    ['whitespace only', '   '],
    ['http without host', 'http:'],
    ['https with credentials-only host', 'https://'],
  ])('rejects %s', (_label, input) => {
    expect(safeHref(input)).toBeNull()
  })

  it('rejects null and undefined', () => {
    expect(safeHref(null)).toBeNull()
    expect(safeHref(undefined)).toBeNull()
  })
})
