// UI 009 T017: the routing query keys of data-model §3. Every key of a collection starts with the
// collection's root, so that invalidating the root reaches lists, details and usage pages.
import { describe, expect, it } from 'vitest'

import { queryKeys } from '@/api'

describe('routing query keys', () => {
  it('roots every key of a collection at its name', () => {
    expect(queryKeys.routingCapabilities()).toEqual(['routing-capabilities'])
    const r = queryKeys.relayhosts
    expect([r.all(), r.lists(), r.list({ q: 'x' }), r.details(), r.detail(1)]).toEqual([
      ['relayhosts'],
      ['relayhosts', 'list'],
      ['relayhosts', 'list', { q: 'x' }],
      ['relayhosts', 'detail'],
      ['relayhosts', 'detail', 1],
    ])
    expect([r.usages(), r.usage(2, { kind: 'domain' })]).toEqual([
      ['relayhosts', 'usage'],
      ['relayhosts', 'usage', 2, { kind: 'domain' }],
    ])
    expect([queryKeys.relayhostChoices.all(), queryKeys.relayhostChoices.search('a')]).toEqual([
      ['relayhost-choices'],
      ['relayhost-choices', { q: 'a' }],
    ])
    for (const [group, root] of [
      [queryKeys.transports, 'transports'],
      [queryKeys.bccMaps, 'bcc-maps'],
      [queryKeys.recipientMaps, 'recipient-maps'],
      [queryKeys.tlsPolicyMaps, 'tls-policy-maps'],
    ] as const) {
      expect(group.all()).toEqual([root])
      expect(group.lists()).toEqual([root, 'list'])
      expect(group.list({})).toEqual([root, 'list', {}])
      expect(group.detail(3)).toEqual([root, 'detail', 3])
    }
    const f = queryKeys.forwardingHosts
    expect([f.all(), f.lists(), f.list({ source: '' })]).toEqual([
      ['forwarding-hosts'],
      ['forwarding-hosts', 'list'],
      ['forwarding-hosts', 'list', { source: '' }],
    ])
    expect([
      queryKeys.bccDestinationChoices.all(),
      queryKeys.bccDestinationChoices.search({ q: 'sales' }),
    ]).toEqual([['bcc-destination-choices'], ['bcc-destination-choices', { q: 'sales' }]])
  })

  it('keys assignments by the lower-case domain name and mailbox address', () => {
    const a = queryKeys.relayhostAssignments
    expect([a.all(), a.domains(), a.mailboxes()]).toEqual([
      ['relayhost-assignments'],
      ['relayhost-assignments', 'domain'],
      ['relayhost-assignments', 'mailbox'],
    ])
    expect(a.domain('Example.ORG')).toEqual(['relayhost-assignments', 'domain', 'example.org'])
    expect(a.mailbox('Alice@Example.org')).toEqual([
      'relayhost-assignments',
      'mailbox',
      'alice@example.org',
    ])
  })
})
