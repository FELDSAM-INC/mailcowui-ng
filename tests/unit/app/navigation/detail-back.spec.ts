import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { detailBackTo } from '@/app/navigation/detail-back'

async function routerAt(path: string, previous?: string) {
  const component = { render: () => null }
  const router = createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [
      { path: '/domains', name: 'domains', component },
      { path: '/domains/:domain', name: 'domain-detail', component },
      { path: '/aliases', name: 'aliases', component },
      { path: '/aliases/new', name: 'alias-create', component },
      { path: '/operations/dashboard', name: 'operations-dashboard', component },
      { path: '/operations/containers/:container', name: 'operations-container', component },
      { path: '/operations/logs/:logType', name: 'operations-log', component },
      { path: '/:pathMatch(.*)*', name: 'not-found', component },
    ],
  })
  await router.push(path)
  if (previous) router.options.history.replace(path, { back: previous })
  return router
}

describe('detail back navigation', () => {
  it('preserves the originating list query and supports direct entry', async () => {
    const router = await routerAt('/domains/example.org', '/domains?q=example&page=2&size=50')
    expect(detailBackTo(router.currentRoute.value, router)).toBe(
      '/domains?q=example&page=2&size=50',
    )
    const direct = await routerAt('/domains/example.org')
    expect(detailBackTo(direct.currentRoute.value, direct)).toBe('/domains')
  })
  it('ignores unrelated or external history and maps container details to the dashboard', async () => {
    for (const previous of [
      '/aliases',
      '//external.test/domains',
      'https://external.test/domains',
    ]) {
      const router = await routerAt('/domains/example.org', previous)
      expect(detailBackTo(router.currentRoute.value, router)).toBe('/domains')
    }
    const router = await routerAt('/operations/containers/postfix')
    expect(detailBackTo(router.currentRoute.value, router)).toBe('/operations/dashboard')
  })
  it('adds a way back for create forms without treating log tabs as record details', async () => {
    const create = await routerAt('/aliases/new')
    expect(detailBackTo(create.currentRoute.value, create)).toBe('/aliases')
    for (const path of ['/domains', '/operations/logs/postfix', '/unknown']) {
      const router = await routerAt(path)
      expect(detailBackTo(router.currentRoute.value, router)).toBeNull()
    }
  })
})
