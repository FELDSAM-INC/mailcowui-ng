import { expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { administratorRoutes } from '@/features/administrators/routes'
import type { Identity } from '@/api'
import { buildRoutes } from '@/app/router/routes'
import { activeSection } from '@/app/navigation/sections'
it('keeps the valid username new available and reserves the non-username creation path', () => {
  const router = createRouter({ history: createMemoryHistory(), routes: administratorRoutes })
  for (const [path, name] of [
    ['domain-admins', 'domain-admin'],
    ['admins', 'admin'],
  ]) {
    expect(router.resolve(`/administrators/${path}/new`).name).toBe(`${name}-detail`)
    expect(router.resolve(`/administrators/${path}/-/new`).name).toBe(`${name}-create`)
  }
  expect(administratorRoutes.every((route) => route.meta?.roles?.join() === 'admin')).toBe(true)
})

it('resolves both account types under Administrators and keeps the tab active on detail', () => {
  const router = createRouter({ history: createMemoryHistory(), routes: buildRoutes() })
  const identity = { role: 'admin' } as Identity
  for (const [path, name, entry] of [
    ['admins', 'admins', 'administrators'],
    ['domain-admins', 'domain-admins', 'domainAdmins'],
  ]) {
    const listPath = `/administrators/${path}`
    expect(router.resolve(listPath).name).toBe(name)
    expect(router.resolve(`${listPath}/account`).meta.navEntry).toBe(entry)
    const section = activeSection(`${listPath}/account`, identity)
    expect(section?.id).toBe('access')
    expect(section?.tabs.find((tab) => tab.current)).toMatchObject({
      id: entry,
      disabled: false,
      to: listPath,
    })
  }
})
