import { expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { administratorRoutes } from '@/features/administrators/routes'
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
