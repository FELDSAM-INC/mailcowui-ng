// The query key factory (data-model §3): every key starts with its root, so one prefix invalidates
// everything below it, and keys of the same root nest (UI 012 adds `identityProvider` and
// `oauth2Clients`).
import { describe, expect, it } from 'vitest'

import { queryKeys } from '@/api'

type Factory = (...args: never[]) => readonly unknown[]

function* factories(
  node: Record<string, unknown>,
  path: string[] = [],
): Generator<[string, Factory]> {
  for (const [name, value] of Object.entries(node)) {
    if (typeof value === 'function') yield [[...path, name].join('.'), value as Factory]
    else if (value && typeof value === 'object') {
      yield* factories(value as Record<string, unknown>, [...path, name])
    }
  }
}

describe('queryKeys', () => {
  it('builds every key as an array that starts with its root', () => {
    for (const [name, factory] of factories(queryKeys)) {
      const key = (factory as (...args: unknown[]) => readonly unknown[])('x', 'y')
      expect(Array.isArray(key), name).toBe(true)
      expect(typeof key[0], name).toBe('string')
      const root = name.split('.')[0]!
      const rootFactory = (queryKeys as Record<string, unknown>)[root]
      if (rootFactory && typeof rootFactory === 'object' && 'all' in rootFactory) {
        const all = (rootFactory as { all: () => readonly unknown[] }).all()
        expect(key.slice(0, all.length), name).toEqual(all)
      }
    }
  })

  it('nests the identity provider and OAuth2 client keys under their roots', () => {
    expect(queryKeys.identityProvider.capabilities()).toEqual(['identity-provider', 'capabilities'])
    expect(queryKeys.identityProvider.configuration()).toEqual([
      'identity-provider',
      'configuration',
    ])
    expect(queryKeys.oauth2Clients.list({ limit: 25 })).toEqual([
      'oauth2-clients',
      'list',
      { limit: 25 },
    ])
    expect(queryKeys.oauth2Clients.detail(7)).toEqual(['oauth2-clients', 'detail', 7])
    expect(queryKeys.oauth2Clients.lists()).toEqual(['oauth2-clients', 'list'])
  })
})
