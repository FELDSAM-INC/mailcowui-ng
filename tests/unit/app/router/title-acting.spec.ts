import { expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { documentTitle } from '@/app/router/title'
import { i18n } from '@/i18n'

it('prefixes the browser tab only while acting and uses the full target name', async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: {}, meta: { titleKey: 'nav.home' } }],
  })
  await router.push('/')
  let username: string | undefined
  const sources = {
    t: (key: string, values?: Record<string, unknown>) =>
      values ? i18n.global.t(key, values) : i18n.global.t(key),
    pageTitle: () => 'Example Mail',
    dependencies: [],
    actingUsername: () => username,
  }
  const ownTitle = documentTitle(router.currentRoute.value, sources)
  username = 'alice@example.org'
  expect(documentTitle(router.currentRoute.value, sources)).toBe(
    `Acting as alice@example.org · ${ownTitle}`,
  )
  username = undefined
  expect(documentTitle(router.currentRoute.value, sources)).toBe(ownTitle)
})
