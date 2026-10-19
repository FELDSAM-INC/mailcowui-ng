// The routing list states (UI 009 T009, data-model §5): parameter types, defaults left out of the
// address, invalid values normalised, repeated values, `orphaned` ignored for domain
// administrators, the generated query parameters, and the reset on filter, sort and size changes.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { bccMapListSchema, toBccMapListParams } from '@/features/routing/list-states/bcc-maps'
import {
  forwardingHostListSchema,
  toForwardingHostListParams,
} from '@/features/routing/list-states/forwarding-hosts'
import { toRecipientMapListParams } from '@/features/routing/list-states/recipient-maps'
import { toRelayhostUsageParams } from '@/features/routing/list-states/relayhost-usage'
import {
  relayhostListSchema,
  toRelayhostListParams,
  useRelayhostListState,
} from '@/features/routing/list-states/relayhosts'
import {
  tlsPolicyMapListSchema,
  toTlsPolicyMapListParams,
} from '@/features/routing/list-states/tls-policy-maps'
import { toTransportListParams } from '@/features/routing/list-states/transports'

import { withSetup } from '../../support/composable'
import { createTestRouter } from '../../support/router'

const base = { sort: undefined, order: undefined, page: 1, size: 25 as const }

describe('routing list states', () => {
  it('maps the relayhost state to the API parameters, leaving out what is not set', () => {
    expect(
      toRelayhostListParams({ ...base, filters: { q: 'smtp', active: 'false', inUse: undefined } }),
    ).toEqual({ limit: 25, offset: 0, sort: 'id', order: 'asc', q: 'smtp', active: false })
    expect(
      toRelayhostListParams({
        ...base,
        page: 3,
        size: 50,
        sort: 'domainCount',
        order: 'desc',
        filters: { q: undefined, active: undefined, inUse: 'true' },
      }),
    ).toEqual({ limit: 50, offset: 100, sort: 'domainCount', order: 'desc', inUse: true })
  })

  it('refuses invalid values and keeps repeated ones within their limit', () => {
    expect(relayhostListSchema.filters.active.parse('maybe')).toBeUndefined()
    expect(relayhostListSchema.sort!.values).toContain('mailboxCount')
    expect(tlsPolicyMapListSchema.filters.policy.parse(['dane', 'nope', 'dane', 'secure'])).toEqual(
      ['dane', 'secure'],
    )
    expect(
      bccMapListSchema.filters.domain.parse(['example.org', 'EXAMPLE.org', ' x.example ']),
    ).toEqual(['example.org', 'x.example'])
    expect(
      bccMapListSchema.filters.domain.parse(Array.from({ length: 101 }, (_, i) => `d${i}.example`)),
    ).toEqual([])
    expect(forwardingHostListSchema.filters.source.parse('')).toBe('')
    expect(forwardingHostListSchema.filters.source.isSet('')).toBe(true)
  })

  it('maps every other list, ignoring orphaned for domain administrators', () => {
    const bcc = {
      ...base,
      filters: {
        q: undefined,
        type: 'sender' as const,
        active: undefined,
        domain: ['a.example'],
        orphaned: 'true' as const,
      },
    }
    expect(toBccMapListParams(bcc, true)).toMatchObject({
      type: 'sender',
      domain: ['a.example'],
      orphaned: true,
    })
    expect(toBccMapListParams(bcc, false)).not.toHaveProperty('orphaned')
    expect(
      toTransportListParams({
        ...base,
        filters: { q: undefined, active: undefined, mxBased: 'true', nextHop: '[mx]:25' },
      }),
    ).toMatchObject({ mxBased: true, nextHop: '[mx]:25' })
    expect(
      toRecipientMapListParams({ ...base, filters: { q: 'old', active: 'true' } }),
    ).toMatchObject({ q: 'old', active: true })
    expect(
      toTlsPolicyMapListParams({
        ...base,
        filters: { q: undefined, policy: ['dane'], active: undefined },
      }),
    ).toMatchObject({ policy: ['dane'] })
    expect(
      toForwardingHostListParams({
        ...base,
        filters: { q: undefined, spamFilter: 'false', source: '' },
      }),
    ).toMatchObject({ sort: 'address', spamFilter: false, source: '' })
    expect(
      toRelayhostUsageParams({ ...base, filters: { q: 'bob', kind: 'mailbox' } }),
    ).toMatchObject({
      sort: 'kind',
      q: 'bob',
      kind: 'mailbox',
    })
  })

  it('normalises the address and resets the page and the selection on changes', async () => {
    const router = createTestRouter()
    await router.push('/routing/relayhosts?active=nope&page=3&sort=id&size=50')
    const reset = vi.fn()
    const { result } = withSetup(() => useRelayhostListState({ onReset: reset }), { router })
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ page: '3', size: '50' })
    await result.setFilter('active', 'true')
    expect(router.currentRoute.value.query).toEqual({ active: 'true', size: '50' })
    expect(reset).toHaveBeenCalled()
    expect(result.hasFilters.value).toBe(true)
    await result.clearFilters()
    expect(router.currentRoute.value.query).toEqual({ size: '50' })
  })
})
