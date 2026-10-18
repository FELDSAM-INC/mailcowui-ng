// T137: the audit log's address parameters (data-model §5) and their mapping to the request.
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import {
  auditListSchema,
  RESERVED_TARGET_PARAMS,
  toAuditParams,
  type AuditFilterValues,
} from '@/features/audit-log/list-state'
import { useListState, type ListState } from '@/shared/composables/useListState'

const NOW = Date.parse('2026-10-18T12:00:00Z')

const empty: AuditFilterValues = {
  range: undefined,
  from: undefined,
  to: undefined,
  event: [],
  outcome: undefined,
  actor: undefined,
  address: undefined,
  targetType: undefined,
  targetId: undefined,
}

const state = (
  filters: Partial<AuditFilterValues> = {},
  page = 1,
  size: 25 | 50 | 100 = 25,
): ListState<AuditFilterValues, never> => ({
  filters: { ...empty, ...filters },
  sort: undefined,
  order: undefined,
  page,
  size,
})

async function parse(query: string) {
  const router = createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [{ path: '/audit-log', component: { render: () => null } }],
  })
  await router.push(`/audit-log${query}`)
  let list!: ReturnType<typeof useListState<AuditFilterValues>>
  mount(
    defineComponent({
      setup() {
        list = useListState(auditListSchema)
        return () => h('div')
      },
    }),
    { global: { plugins: [router] } },
  )
  await flushPromises()
  return { list, router }
}

describe('auditListSchema', () => {
  it('reads every filter, including repeated event types', async () => {
    const { list } = await parse(
      '?range=custom&from=2026-10-01T08:00:00Z&to=2026-10-02T08:00:00Z&event=signIn&event=apiKeyCreation&outcome=failure&actor=alice%40example.org&address=192.0.2.0%2F24&page=2&size=50',
    )
    expect(list.state.value.filters).toEqual({
      ...empty,
      range: 'custom',
      from: '2026-10-01T08:00:00.000Z',
      to: '2026-10-02T08:00:00.000Z',
      event: ['signIn', 'apiKeyCreation'],
      outcome: 'failure',
      actor: 'alice@example.org',
      address: '192.0.2.0/24',
    })
    expect(list.state.value.page).toBe(2)
    expect(list.state.value.size).toBe(50)
  })

  it('drops invalid values and normalises the address', async () => {
    const { list, router } = await parse(
      '?range=1y&event=nope&event=signOut&outcome=maybe&address=999.1.1.1&from=yesterday&size=30',
    )
    expect(list.state.value.filters).toEqual({ ...empty, event: ['signOut'] })
    expect(list.state.value.size).toBe(25)
    expect(router.currentRoute.value.fullPath).toBe('/audit-log?event=signOut')
  })

  it('keeps the reserved target parameters in the address', async () => {
    expect(RESERVED_TARGET_PARAMS).toEqual(['targetType', 'targetId'])
    const { list, router } = await parse('?targetType=apiKey&targetId=01JB3K4M5N6P7Q8R9S0TVWXYZA')
    expect(list.state.value.filters.targetType).toBe('apiKey')
    expect(router.currentRoute.value.query.targetId).toBe('01JB3K4M5N6P7Q8R9S0TVWXYZA')
  })
})

describe('toAuditParams', () => {
  it('asks for the newest records first, 25 per page by default', () => {
    expect(toAuditParams(state(), NOW)).toEqual({
      limit: 25,
      offset: 0,
      sort: 'occurredAt',
      order: 'desc',
    })
    expect(toAuditParams(state({}, 3, 50), NOW)).toMatchObject({ limit: 50, offset: 100 })
  })

  it('maps the filters to the contract parameters', () => {
    expect(
      toAuditParams(
        state({
          event: ['signIn', 'signOut'],
          outcome: 'success',
          actor: 'admin',
          address: '2001:db8::/32',
        }),
        NOW,
      ),
    ).toMatchObject({
      eventType: ['signIn', 'signOut'],
      outcome: 'success',
      actor: 'admin',
      clientAddress: '2001:db8::/32',
    })
  })

  it('resolves a preset when the query runs', () => {
    expect(toAuditParams(state({ range: '24h' }), NOW).from).toBe('2026-10-17T12:00:00.000Z')
    expect(toAuditParams(state({ range: '7d' }), NOW).from).toBe('2026-10-11T12:00:00.000Z')
    expect(toAuditParams(state({ range: '30d' }), NOW + 60_000).from).toBe(
      '2026-09-18T12:01:00.000Z',
    )
    expect(toAuditParams(state({ range: '24h' }), NOW).to).toBeUndefined()
  })

  it('sends a custom range only when its start lies before its end', () => {
    const from = '2026-10-01T08:00:00.000Z'
    const to = '2026-10-02T08:00:00.000Z'
    expect(toAuditParams(state({ range: 'custom', from, to }), NOW)).toMatchObject({ from, to })
    const inverted = toAuditParams(state({ range: 'custom', from: to, to: from }), NOW)
    expect(inverted.from).toBeUndefined()
    expect(inverted.to).toBeUndefined()
    expect(toAuditParams(state({ from, to }), NOW).from).toBeUndefined()
  })

  it('never sends the reserved target parameters', () => {
    const params = toAuditParams(state({ targetType: 'apiKey', targetId: 'x' }), NOW)
    expect(params).not.toHaveProperty('targetType')
    expect(params).not.toHaveProperty('targetId')
  })
})
