// UI 006 T092 (research R19, legacy form map D9): an owner selects its list, create and delete
// operations, the host page that carries its spam filter section with `#spam-filter`, and legacy's
// messages of its outcomes.
import { describe, expect, it } from 'vitest'

import {
  CREATED_KEY,
  hostLocation,
  REMOVED_KEY,
  SECTION_TITLE_KEY,
  SPAM_FILTER_HASH,
  ownerOperations,
} from '@/features/spam-filter/owner'

import { mockState, useScenario } from '../../../mocks/node'

describe('hostLocation', () => {
  it('opens the host page of each kind at the spam filter section', () => {
    expect(SPAM_FILTER_HASH).toBe('#spam-filter')
    expect(hostLocation({ kind: 'domain', name: 'example.org' })).toEqual({
      name: 'domain-detail',
      params: { domain: 'example.org' },
      hash: '#spam-filter',
    })
    expect(hostLocation({ kind: 'aliasDomain', name: 'example.net' })).toEqual({
      name: 'alias-domain-detail',
      params: { aliasDomain: 'example.net' },
      hash: '#spam-filter',
    })
    expect(hostLocation({ kind: 'mailbox', name: 'alice@example.org' })).toEqual({
      name: 'mailbox-detail',
      params: { address: 'alice@example.org' },
      hash: '#spam-filter',
    })
  })
})

describe('legacy keys per kind', () => {
  it('names the section and the outcomes as legacy does', () => {
    expect(SECTION_TITLE_KEY).toEqual({
      domain: 'edit.spam_filter',
      aliasDomain: 'edit.spam_filter',
      mailbox: 'user.spamfilter',
    })
    expect(CREATED_KEY).toEqual({
      domain: 'success.domain_modified',
      aliasDomain: 'success.aliasd_modified',
      mailbox: 'success.mailbox_modified',
    })
    expect(REMOVED_KEY).toEqual({
      domain: 'success.item_deleted',
      aliasDomain: 'success.item_deleted',
      mailbox: 'success.items_deleted',
    })
  })
})

describe('ownerOperations', () => {
  it.each([
    ['domain', 'example.org', '/api/v2/domains/example.org/spam-policy-entries'],
    ['aliasDomain', 'example.net', '/api/v2/alias-domains/example.net/spam-policy-entries'],
    ['mailbox', 'alice@example.org', '/api/v2/mailboxes/alice%40example.org/spam-policy-entries'],
  ] as const)('dispatches the %s operations to its paths', async (kind, name, path) => {
    useScenario('policy-admin')
    const operations = ownerOperations(kind)
    const page = await operations.list(name, { list: 'allow', ownership: 'own' })
    expect(page.meta.total).toBeGreaterThanOrEqual(0)
    const created = await operations.create(name, { list: 'block', pattern: '*@unit.example' })
    expect(created).toMatchObject({ pattern: '*@unit.example', own: true, owner: { kind, name } })
    await operations.remove(name, created.id, created.etag)
    const paths = mockState()
      .requests.filter((request) => request.path.includes('/spam-policy-entries'))
      .map((request) => `${request.method} ${request.path}`)
    expect(paths).toEqual([
      `GET ${path}?list=allow&ownership=own`,
      `POST ${path}`,
      `DELETE ${path}/${created.id}`,
    ])
  })
})
