// The sync-job list's address (UI 008 T028, data-model §5): every parameter, defaults omitted,
// `yes`/`no` as booleans, `none` as `unknown`, the role-dependent filters and sort, the page reset
// and `onReset` on changes, and `log` as a view parameter that resets neither.
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { Role } from '@/api'
import {
  syncJobListSchema,
  toListParams,
  useSyncJobListState,
} from '@/features/sync-jobs/list-state'

async function setup(path: string, role: Role = 'admin', onReset = vi.fn()) {
  const router = createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [{ path: '/sync-jobs', component: { render: () => null } }],
  })
  await router.push(path)
  await router.isReady()
  let list!: ReturnType<typeof useSyncJobListState>
  mount(
    defineComponent({
      setup() {
        list = useSyncJobListState(role, { onReset })
        return () => h('div')
      },
    }),
    { global: { plugins: [router] } },
  )
  await flushPromises()
  return { router, list, onReset }
}

describe('sync-job list state', () => {
  it('maps every parameter to the list request', async () => {
    const { list } = await setup(
      '/sync-jobs?q=imap&mailbox=alice%40example.org&domain=example.org&active=no&running=yes&result=none&sort=lastRunAt&order=desc&page=2&size=50&log=7',
    )
    expect(list.params.value).toEqual({
      q: 'imap',
      mailbox: 'alice@example.org',
      domain: 'example.org',
      active: false,
      running: true,
      lastResult: 'unknown',
      sort: 'lastRunAt',
      order: 'desc',
      limit: 50,
      offset: 50,
    })
    expect(list.views.value.log).toBe(7)
  })

  it('defaults to the newest job first and omits defaults from the address', async () => {
    const { list, router } = await setup('/sync-jobs?sort=id&order=desc&size=25&page=1')
    expect(list.params.value).toEqual({ sort: 'id', order: 'desc', limit: 25, offset: 0 })
    expect(router.currentRoute.value.query).toEqual({})
    expect(syncJobListSchema('admin').sort?.defaultOrder('mailbox')).toBe('asc')
  })

  it('drops the mailbox and domain filters and the mailbox sort for mailbox users', async () => {
    const { list, router } = await setup(
      '/sync-jobs?mailbox=x%40example.org&domain=example.org&sort=mailbox&result=failed',
      'mailboxUser',
    )
    expect(list.params.value).toEqual({
      lastResult: 'failed',
      sort: 'id',
      order: 'desc',
      limit: 25,
      offset: 0,
    })
    expect(router.currentRoute.value.query).toEqual({ result: 'failed' })
  })

  it('resets the page and the selection on changes, but not for the log', async () => {
    const { list, router, onReset } = await setup('/sync-jobs?page=3')
    onReset.mockClear()
    await list.setView('log', 12)
    expect(router.currentRoute.value.query).toEqual({ page: '3', log: '12' })
    expect(onReset).not.toHaveBeenCalled()
    await list.setFilter('active', 'yes')
    expect(router.currentRoute.value.query).toEqual({ active: 'yes', log: '12' })
    await list.setSort('remoteHost')
    await list.setSize(100)
    expect(onReset).toHaveBeenCalledTimes(3)
    expect(list.hasSearchOrFilters.value).toBe(true)
  })

  it('rejects invalid values', () => {
    const state = {
      filters: {
        q: undefined,
        mailbox: undefined,
        domain: undefined,
        active: undefined,
        running: undefined,
        result: 'succeeded' as const,
      },
      sort: 'intervalMinutes' as const,
      order: 'asc' as const,
      page: 1,
      size: 25 as const,
    }
    expect(toListParams(state)).toEqual({
      lastResult: 'succeeded',
      sort: 'intervalMinutes',
      order: 'asc',
      limit: 25,
      offset: 0,
    })
  })
})
