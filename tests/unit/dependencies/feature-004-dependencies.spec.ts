// The building blocks UI 004 relies on (T006, research R2): each is imported where UI 001 reserved
// it or UI 002 put it, and the behaviour this feature needs is checked. A missing block or a
// missing behaviour fails here first; T007-T009 fill the gaps.
import { flushPromises, mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import { ApiProblem, setSessionReactions, reportSessionProblem } from '@/api'
import { findEntry } from '@/app/navigation/catalogue'
import { isEntryAvailable } from '@/app/navigation/visibility'
import { buildRoutes } from '@/app/router/routes'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import { auditListSchema } from '@/features/audit-log/list-state'
import ActiveFilterChips from '@/shared/components/ActiveFilterChips.vue'
import BulkActionBar from '@/shared/components/BulkActionBar.vue'
import BulkResultSummary from '@/shared/components/BulkResultSummary.vue'
import EditableSection from '@/shared/components/EditableSection.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import SearchField from '@/shared/components/SearchField.vue'
import { useBulkSelection } from '@/shared/composables/useBulkSelection'
import { matchesTyped } from '@/shared/composables/useConfirm'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { manyText, useListState } from '@/shared/composables/useListState'
import { changedSince } from '@/shared/composables/useVersionedSave'
import { utf8ByteLength } from '@/shared/validation/utf8'

import { mountWithApp } from '../support/mount'

const identity = (role: 'admin' | 'domainAdmin' | 'mailboxUser') =>
  ({ role, permissions: {} }) as never

describe('D1 useListState: repeatable free-text parameters and onReset', () => {
  it('parses, normalises and writes a repeatable domain parameter, and resets on change', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { render: () => null } }],
    })
    await router.push('/?domain=example.org&domain=Example.ORG&domain=example.net')
    const onReset = vi.fn()
    let list!: ReturnType<typeof useListState<{ domain: string[] }>>
    mount(
      defineComponent({
        setup() {
          list = useListState(
            { filters: { domain: manyText({ max: 100, maxLength: 253 }) } },
            { onReset },
          )
          return () => null
        },
      }),
      { global: { plugins: [router] } },
    )
    expect(list.state.value.filters.domain).toEqual(['example.org', 'example.net'])
    await list.setFilter('domain', ['example.com'])
    await flushPromises()
    expect(router.currentRoute.value.query.domain).toEqual(['example.com'])
    expect(onReset).toHaveBeenCalled()
  })
})

describe('D2 useBulkSelection with the bulk limit', () => {
  it('caps "select all" at the first N and refuses further selection at the limit', () => {
    const selection = useBulkSelection({ limit: 2 })
    expect(selection.selectPage(['a', 'b', 'c']).cut).toBe(true)
    expect([...selection.ids.value]).toEqual(['a', 'b'])
    expect(selection.toggle('c')).toBe(false)
    expect(selection.canSelect('c')).toBe(false)
    expect(selection.limitReached.value).toBe(true)
    selection.keep(['b'])
    expect([...selection.ids.value]).toEqual(['b'])
    selection.clear()
    expect(selection.count.value).toBe(0)
  })
})

describe('D3 BulkActionBar', () => {
  it('names the count, offers the actions and clears', async () => {
    const wrapper = mountWithApp(BulkActionBar, {
      props: { count: 3, actions: [{ id: 'activate', label: 'Activate' }] },
    })
    expect(wrapper.text()).toContain('3 selected')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('action')?.[0]).toEqual(['activate'])
  })
})

describe('D4 BulkResultSummary', () => {
  it('renders an item slot, the unknown outcome, and "Refresh the list" for outdated rows', async () => {
    const wrapper = mountWithApp(BulkResultSummary, {
      props: {
        rows: [
          { id: '1', label: 'a@example.org', outcome: 'done' },
          { id: '2', label: 'b@example.org', outcome: 'outdated' },
          { id: '3', label: 'c@example.org', outcome: 'unknown' },
        ],
      },
      slots: { item: ({ row }: { row: { id: string } }) => h('span', { class: 'extra' }, row.id) },
    })
    expect(wrapper.findAll('.extra')).toHaveLength(3)
    expect(wrapper.text()).toContain('Outcome unknown')
    const refresh = wrapper.findAll('button').find((b) => b.text() === 'Refresh the list')
    expect(refresh).toBeDefined()
    await refresh!.trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })
})

describe('D5 confirmations', () => {
  it('accepts a typed count', () => {
    expect(matchesTyped(' 5 ', { accepted: ['5'], labelKey: 'bulk.confirm.typeCount' })).toBe(true)
    expect(matchesTyped('4', { accepted: ['5'], labelKey: 'bulk.confirm.typeCount' })).toBe(false)
  })
})

describe('D6 EditableSection and changedSince', () => {
  it('opens one section driven by the parent and lists fields changed elsewhere', () => {
    const wrapper = mountWithApp(EditableSection, {
      props: { sectionId: 'alias', title: 'Edit alias', editable: true, editing: false },
    })
    expect(wrapper.find('form').exists()).toBe(false)
    expect(changedSince({ a: 1, b: ['x'] }, { a: 1, b: ['y'] }, ['a', 'b'])).toEqual([
      { field: 'b', savedValue: ['y'] },
    ])
  })
})

describe('D7 HistoryLink and the audit target filters', () => {
  it('links to the audit log filtered by target type and ID', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { render: () => null } },
        { path: '/audit-log', name: 'audit-log', component: { render: () => null } },
      ],
    })
    const wrapper = mountWithApp(HistoryLink, {
      props: { targetType: 'alias', targetId: '42' },
      global: { plugins: [router] },
    })
    await router.isReady()
    expect(wrapper.get('a').attributes('href')).toBe('/audit-log?targetType=alias&targetId=42')
    expect(Object.keys(auditListSchema.filters)).toEqual(
      expect.arrayContaining(['targetType', 'targetId']),
    )
  })
})

describe('D8 ActiveFilterChips in src/shared/components', () => {
  it('removes one chip or clears all', async () => {
    const wrapper = mountWithApp(ActiveFilterChips, {
      props: { chips: [{ key: 'domain', label: 'example.org' }] },
    })
    const [chip, clear] = wrapper.findAll('button')
    await chip!.trigger('click')
    await clear!.trigger('click')
    expect(wrapper.emitted('remove')?.[0]).toEqual(['domain'])
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })
})

describe('D9 useLeaveGuard', () => {
  it('is armed while the form is dirty', () => {
    let guard!: ReturnType<typeof useLeaveGuard>
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/',
          component: defineComponent({
            setup() {
              guard = useLeaveGuard(true, 'leaveGuard.body')
              return () => null
            },
          }),
        },
      ],
    })
    void router.push('/')
    mountWithApp(RouterView, { global: { plugins: [router] } })
    return router.isReady().then(async () => {
      await nextTick()
      expect(guard.armed.value).toBe(true)
    })
  })
})

describe('D10 the in-place "not found" state', () => {
  it("is UI 001's NotFoundPage with a link back to the list (UI 002 FR-004)", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { render: () => null } },
        { path: '/aliases', name: 'aliases', component: { render: () => null } },
      ],
    })
    const wrapper = mountWithApp(NotFoundPage, {
      props: { backTo: { name: 'aliases' }, backLabel: 'Back' },
      global: { plugins: [router] },
    })
    await router.isReady()
    expect(wrapper.get('a').attributes('href')).toBe('/aliases')
  })
})

describe('D14 problem extension members', () => {
  it('are readable on ApiProblem', () => {
    const problem = ApiProblem.fromParts({
      kind: 'problem',
      type: '/api/v2/problems/address-in-use',
      status: 409,
      extensions: { address: 'a@example.org', holder: 'alias', count: 3, requiredFlags: ['x'] },
    })
    expect(problem.extensions.holder).toBe('alias')
    expect(problem.extensions.count).toBe(3)
  })
})

describe('D15 permission refusals refresh the identity', () => {
  it.each(['forbidden', 'attribute-not-permitted', 'permission-flag-required'])(
    '%s reaches the forbidden reaction',
    (name) => {
      const forbidden = vi.fn()
      setSessionReactions({
        unauthenticated: vi.fn(),
        secondFactorRequired: vi.fn(),
        pendingActionRequired: vi.fn(),
        forbidden,
      })
      reportSessionProblem(
        ApiProblem.fromParts({ kind: 'problem', type: `/api/v2/problems/${name}`, status: 403 }),
      )
      setSessionReactions(null)
      expect(forbidden).toHaveBeenCalledTimes(1)
    },
  )
})

describe('D16 isEntryAvailable', () => {
  it('is true only for an available entry the identity may open', () => {
    expect(isEntryAvailable('domains', identity('admin'))).toBe(true)
    expect(isEntryAvailable('domains', identity('mailboxUser'))).toBe(false)
    expect(isEntryAvailable('dns', identity('admin'))).toBe(
      findEntry('dns')?.status === 'available',
    )
    expect(isEntryAvailable('nope', identity('admin'))).toBe(false)
  })
})

describe('D17 the domain page route', () => {
  it('is registered as domain-detail at /domains/:domain', () => {
    const route = buildRoutes().find((item) => item.name === 'domain-detail')
    expect(route?.path).toBe('/domains/:domain')
  })
})

describe('D19 the enumeration scope manifest', () => {
  it('lists the 004 values', () => {
    const coverage = JSON.parse(
      readFileSync(join(process.cwd(), 'src/i18n/coverage.json'), 'utf8'),
    ) as { partial: Record<string, string[]> }
    expect(coverage.partial['AuditTarget.type']).toEqual(
      expect.arrayContaining(['alias', 'aliasDomain', 'resource', 'mailboxSenderSettings']),
    )
  })
})

describe('SearchField', () => {
  it('searches on submit at once and after a pause while typing', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = mountWithApp(SearchField, {
        props: { id: 'q', label: 'Search:', modelValue: '' },
      })
      const input = wrapper.get('input')
      await input.setValue('inv')
      expect(wrapper.emitted('search')).toBeUndefined()
      vi.advanceTimersByTime(500)
      expect(wrapper.emitted('search')?.[0]).toEqual(['inv'])
      await input.setValue('invoice')
      await wrapper.get('form').trigger('submit')
      expect(wrapper.emitted('search')?.[1]).toEqual(['invoice'])
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('utf8ByteLength', () => {
  it('counts UTF-8 bytes', () => {
    expect(utf8ByteLength('abc')).toBe(3)
    expect(utf8ByteLength('Süd')).toBe(4)
    expect(utf8ByteLength('🙂')).toBe(4)
  })
})
