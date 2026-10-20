import { describe, expect, it } from 'vitest'
import {
  appLinkUrlError,
  appLinkPreview,
  appLinkErrors,
  moveAppLink,
} from '@/features/system-settings/lib/app-link-url'

describe('App link input and ordered list', () => {
  it.each(['https://help.example.org', 'http://localhost:8080/help', '/help', '/'])(
    'accepts %s',
    (url) => {
      expect(appLinkUrlError(url)).toBeNull()
    },
  )
  it.each([
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    'data:text/html,test',
    'https:/example.org',
    'https://example.org/a b',
    '/a\nb',
    '',
  ])('refuses %s', (url) => {
    expect(appLinkUrlError(url)).toBe('appLinkUrl')
  })
  it('reserves username substitution for signed-in links and counts Unicode characters', () => {
    expect(appLinkUrlError('/help/%u')).toBe('appLinkUrl')
    expect(appLinkUrlError('/help/%u', true)).toBeNull()
    expect(appLinkUrlError('/' + 'x'.repeat(2047))).toBeNull()
    expect(appLinkUrlError('/' + 'x'.repeat(2048))).toBe('tooLong')
    expect(
      appLinkPreview({ url: '/help', signedInUrl: '/help?u=%u' }, 'alice+tag@example.org'),
    ).toBe('/help?u=alice%2Btag%40example.org')
    expect(appLinkPreview({ url: '/help', signedInUrl: null }, 'admin')).toBe('/help')
  })
  it('reports every indexed entry error and limits custom entries', () => {
    expect(
      appLinkErrors([
        { name: '', url: 'javascript:a', signedInUrl: '/safe', showOnLoginPage: true },
        { name: 'two\nlines', url: '/safe', signedInUrl: 'x'.repeat(2049), showOnLoginPage: false },
      ]),
    ).toEqual({
      'links.0.name': 'required',
      'links.0.url': 'appLinkUrl',
      'links.1.name': 'singleLine',
      'links.1.signedInUrl': 'tooLong',
    })
    const link = { name: 'a', url: '/a', signedInUrl: null, showOnLoginPage: true }
    expect(appLinkErrors(Array.from({ length: 51 }, () => link)).links).toBe('limit')
    expect(appLinkErrors([{ ...link, name: 'x'.repeat(256) }])['links.0.name']).toBe('tooLong')
  })
  it('moves exactly one row without mutating the saved list and rejects bounds', () => {
    const list = ['first', 'second', 'third']
    expect(moveAppLink(list, 2, -1)).toEqual(['first', 'third', 'second'])
    expect(moveAppLink(list, 0, 1)).toEqual(['second', 'first', 'third'])
    expect(moveAppLink(list, 0, -1)).toEqual(list)
    expect(moveAppLink(list, 2, 1)).toEqual(list)
    expect(list).toEqual(['first', 'second', 'third'])
  })
})
