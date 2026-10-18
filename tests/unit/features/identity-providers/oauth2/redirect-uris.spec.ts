// The redirect URI field (T081, FR-058, FR-061; legacy form map: one text field, several URIs
// separated by spaces): splitting, joining and the contract's rules with the length limit from the
// capabilities.
import { describe, expect, it } from 'vitest'

import {
  isRedirectUri,
  joinRedirectUris,
  redirectUriProblems,
  splitRedirectUris,
} from '@/features/identity-providers/oauth2/redirect-uris'

describe('redirect URIs', () => {
  it('splits on any whitespace and joins with single spaces', () => {
    expect(splitRedirectUris('  https://a.example/cb \n https://b.example/cb\t')).toEqual([
      'https://a.example/cb',
      'https://b.example/cb',
    ])
    expect(splitRedirectUris('   ')).toEqual([])
    expect(joinRedirectUris(['https://a.example/cb', 'com.example.app:/callback'])).toBe(
      'https://a.example/cb com.example.app:/callback',
    )
  })

  it('accepts absolute URIs with a scheme, custom schemes included', () => {
    expect(isRedirectUri('https://wiki.example.org/oauth/callback')).toBe(true)
    expect(isRedirectUri('com.example.app:/callback')).toBe(true)
    expect(isRedirectUri('http://localhost:8080/cb')).toBe(true)
  })

  it('refuses relative URIs, fragments and whitespace', () => {
    expect(isRedirectUri('/oauth/callback')).toBe(false)
    expect(isRedirectUri('https://x.example/cb#frag')).toBe(false)
    expect(isRedirectUri('https://x.example/a b')).toBe(false)
    expect(isRedirectUri('wiki.example.org/cb')).toBe(false)
  })

  it('reports an empty field, each invalid URI by position, and a list that is too long', () => {
    expect(redirectUriProblems([], 2000)).toEqual([{ kind: 'empty' }])
    expect(redirectUriProblems(['https://ok.example/cb', '/rel', 'x:#'], 2000)).toEqual([
      { kind: 'invalid', index: 1, uri: '/rel' },
      { kind: 'invalid', index: 2, uri: 'x:#' },
    ])
    expect(redirectUriProblems(['https://a.example/' + 'a'.repeat(30)], 20)).toEqual([
      { kind: 'tooLong', max: 20 },
    ])
    expect(redirectUriProblems(['https://ok.example/cb'], 2000)).toEqual([])
  })

  it('counts the length of the list without duplicates, as the API stores it', () => {
    const uri = 'https://a.example/cb'
    expect(redirectUriProblems([uri, uri], uri.length)).toEqual([])
  })
})
