// The query key factory (data-model §3): every key starts with its root, so one prefix invalidates
// everything below it, and keys of the same root nest (UI 012 adds `identityProvider` and
// `oauth2Clients`, UI 010 the DNS roots and the diagnostics keys per name, T009).
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

describe('UI 010 query keys', () => {
  it('has the DNS capabilities key', () => {
    expect(queryKeys.dns.capabilities()).toEqual(['dns-capabilities'])
  })

  it('keys DKIM lists, details and copy targets under one root', () => {
    expect(queryKeys.dkimKeys.all()).toEqual(['dkim-keys'])
    expect(queryKeys.dkimKeys.lists()).toEqual(['dkim-keys', 'list'])
    expect(queryKeys.dkimKeys.list({ state: ['missing'], limit: 25, offset: 0 })).toEqual([
      'dkim-keys',
      'list',
      { state: ['missing'], limit: 25, offset: 0 },
    ])
    expect(queryKeys.dkimKeys.detail('example.org')).toEqual(['dkim-keys', 'detail', 'example.org'])
    expect(queryKeys.dkimKeys.copyTargetLists()).toEqual(['dkim-keys', 'copy-targets'])
    expect(queryKeys.dkimKeys.copyTargets('ex')).toEqual(['dkim-keys', 'copy-targets', { q: 'ex' }])
    expect(queryKeys.dkimKeys.outcome('example.org')).toEqual([
      'dkim-keys',
      'outcome',
      'example.org',
    ])
  })

  it('keys MTA-STS policies by domain', () => {
    expect(queryKeys.mtaStsPolicies.lists()).toEqual(['mta-sts-policies', 'list'])
    expect(queryKeys.mtaStsPolicies.list({ mode: 'enforce' })).toEqual([
      'mta-sts-policies',
      'list',
      { mode: 'enforce' },
    ])
    expect(queryKeys.mtaStsPolicies.detail('example.org')).toEqual([
      'mta-sts-policies',
      'detail',
      'example.org',
    ])
  })

  it('keys diagnostics results, the rate limit and the change markers', () => {
    expect(queryKeys.dnsDiagnostics.result('example.org')).toEqual([
      'dns-diagnostics',
      'result',
      'example.org',
    ])
    expect(queryKeys.dnsDiagnostics.rateLimit()).toEqual(['dns-diagnostics', 'rate-limit'])
    expect(queryKeys.dnsDiagnostics.changed('example.org')).toEqual([
      'dns-diagnostics',
      'changed',
      'example.org',
    ])
  })
})
