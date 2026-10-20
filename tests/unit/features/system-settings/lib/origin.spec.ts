import { expect, it } from 'vitest'
import { isOrigin, parseOrigins } from '@/features/system-settings/lib/origin'
it.each([
  '*',
  'https://portal.example.org',
  'HTTP://LOCALHOST:8080',
  'https://[::1]:8443',
  'https://example.org:443',
])('accepts the API origin format: %s', (value) => {
  expect(isOrigin(value)).toBe(true)
})
it.each([
  'portal.example.org',
  'https://example.org/',
  'https://example.org/path',
  'https://example.org?',
  'https://example.org#',
  'https://user@example.org',
  'ftp://example.org',
  'https://example.org\\evil',
  'https://bad_host',
  'https://example.org:99999',
  ' https://example.org',
  'https://example.org:0443',
  'https://%65xample.org',
])('rejects non-origins: %s', (value) => {
  expect(isOrigin(value)).toBe(false)
})
it('splits pasted origins, lower-cases and deduplicates while preserving invalid entries for correction', () => {
  expect(
    parseOrigins('HTTPS://Portal.EXAMPLE.ORG, https://portal.example.org; *\nold-host'),
  ).toEqual(['https://portal.example.org', '*', 'old-host'])
})
