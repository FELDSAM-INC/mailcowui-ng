import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { afterEach, expect, it, vi } from 'vitest'
import { RouterView } from 'vue-router'
import KeyEditorPage from '@/features/api-keys/legacy/KeyEditorPage.vue'
import type { LegacyKey } from '@/features/api-keys/legacy/api'
import { settleConfirm } from '@/shared/composables/useConfirm'
import { server, useScenario } from '../../../mocks/node'
import { mountWithApp, testPlugins } from '../../support/mount'
import { installMatchMedia } from '../../support/media'
import { createTestRouter } from '../../support/router'
const fixture = (): LegacyKey => ({
  id: 1,
  description: 'Backup',
  prefix: 'ABC123',
  accessLevel: 'readOnly',
  allowedNetworks: ['192.0.2.0/24'],
  skipIpCheck: false,
  active: true,
  service: false,
  etag: '"key-v1"',
})
let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  settleConfirm(false)
})
async function open(data = fixture(), creating = false) {
  installMatchMedia({ '(min-width: 768px)': true })
  useScenario('admin-create')
  server.use(http.get('*/api/v2/legacy-api-keys/1', () => HttpResponse.json({ data })))
  const router = createTestRouter()
  for (const name of ['legacy-api-key-create', 'legacy-api-key-detail']) router.removeRoute(name)
  router.addRoute({
    name: 'legacy-api-key-create',
    path: '/legacy-api-keys/new',
    component: KeyEditorPage,
  })
  router.addRoute({
    name: 'legacy-api-key-detail',
    path: '/legacy-api-keys/:legacyKeyId',
    component: KeyEditorPage,
  })
  await router.push(creating ? '/legacy-api-keys/new' : '/legacy-api-keys/1')
  wrapper = mountWithApp(RouterView, { attachTo: document.body, global: { plugins: [router] } })
  await vi.waitFor(() =>
    expect(wrapper!.find(creating ? 'form' : '#section-legacy-api-key').exists()).toBe(true),
  )
  return wrapper
}
it('locks service keys and never shows regeneration, edit or delete controls', async () => {
  const page = await open({ ...fixture(), service: true, description: 'API_KEY' })
  expect(page.text()).toContain('managed in mailcow.conf')
  expect(page.findAll('button').some((b) => b.attributes('aria-label')?.startsWith('Edit '))).toBe(
    false,
  )
  expect(page.text()).not.toContain('Regenerate key')
  expect(page.text()).not.toContain('Delete')
})
it('keeps a new secret in the one-time dialog and out of every query cache', async () => {
  const token = 'LEGACY-SECRET-ONLY-ONCE'
  server.use(
    http.post('*/api/v2/legacy-api-keys', () =>
      HttpResponse.json({ data: { ...fixture(), secret: token } }, { status: 201 }),
    ),
  )
  const page = await open(fixture(), true)
  await page.get('#legacy-key-description').setValue('Backup')
  await page.get('#legacy-key-skipIpCheck').setValue(true)
  await page.get('form').trigger('submit')
  await vi.waitFor(() =>
    expect(document.querySelector<HTMLInputElement>('input[readonly]')?.value).toBe(token),
  )
  expect(
    JSON.stringify(
      testPlugins()
        .queryClient.getQueryCache()
        .getAll()
        .map((q) => q.state.data),
    ),
  ).not.toContain(token)
  expect(testPlugins().queryClient.getMutationCache().getAll()).toEqual([])
})
it('sends only the edited fields and requires explicit retry on a stale version', async () => {
  const data = fixture(),
    requests: { body: unknown; etag: string | null }[] = []
  server.use(
    http.patch('*/api/v2/legacy-api-keys/1', async ({ request }) => {
      requests.push({ body: await request.json(), etag: request.headers.get('If-Match') })
      if (requests.length === 1) {
        data.etag = '"key-v2"'
        return HttpResponse.json(
          { type: 'about:blank', title: 'Precondition Failed', status: 412 },
          { status: 412, headers: { 'Content-Type': 'application/problem+json' } },
        )
      }
      return HttpResponse.json({ data })
    }),
  )
  const page = await open(data)
  await page
    .findAll('button')
    .find((b) => b.attributes('aria-label')?.startsWith('Edit '))!
    .trigger('click')
  await flushPromises()
  await page.get('#legacy-key-description').setValue('Draft')
  await page.get('#section-legacy-api-key form').trigger('submit')
  await vi.waitFor(() => expect(page.text()).toContain('Save again'))
  expect((page.get('#legacy-key-description').element as HTMLInputElement).value).toBe('Draft')
  expect(requests).toEqual([{ body: { description: 'Draft' }, etag: '"key-v1"' }])
  await page.get('#section-legacy-api-key form').trigger('submit')
  await vi.waitFor(() =>
    expect(requests[1]).toEqual({ body: { description: 'Draft' }, etag: '"key-v2"' }),
  )
})
