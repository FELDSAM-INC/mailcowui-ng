import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RouterView } from 'vue-router'
import SyncQueuePage from '@/features/sync-jobs/pages/SyncQueuePage.vue'
import { settleConfirm } from '@/shared/composables/useConfirm'
import { server, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'
import { createTestRouter } from '../../support/router'

let wrapper: VueWrapper | undefined
const data = () => ({ maxParallel: 4, maxBytesPerSecond: 0, etag: '"queue-v1"' })
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  settleConfirm(false)
})
async function open(settings = data()) {
  useScenario('sync-jobs-admin')
  server.use(http.get('*/api/v2/sync-queue/settings', () => HttpResponse.json({ data: settings })))
  const router = createTestRouter()
  router.addRoute({ name: 'queue-test', path: '/queue-test', component: SyncQueuePage })
  await router.push('/queue-test')
  wrapper = mountWithApp(RouterView, { attachTo: document.body, global: { plugins: [router] } })
  await vi.waitFor(() => expect(wrapper!.find('#section-sync-queue').exists()).toBe(true))
  await wrapper.get('button[aria-label^="Edit "]').trigger('click')
  await flushPromises()
  return wrapper
}
describe('Sync queue settings', () => {
  it('saves only the changed queue limit with its version and refreshes the display', async () => {
    const settings = data(),
      calls: { body: unknown; etag: string | null }[] = []
    server.use(
      http.patch('*/api/v2/sync-queue/settings', async ({ request }) => {
        calls.push({ body: await request.json(), etag: request.headers.get('If-Match') })
        settings.maxParallel = 8
        settings.etag = '"queue-v2"'
        return HttpResponse.json({ data: settings })
      }),
    )
    const page = await open(settings)
    await page.get('#queue-maxParallel').setValue(8)
    await page.get('form').trigger('submit')
    await vi.waitFor(() =>
      expect(calls).toEqual([{ body: { maxParallel: 8 }, etag: '"queue-v1"' }]),
    )
    await vi.waitFor(() => expect(page.find('form').exists()).toBe(false))
    expect(page.text()).toContain('8')
    expect(page.text()).toContain('Unlimited')
  })
  it('keeps a stale draft and retries only after a second explicit save with the refreshed version', async () => {
    const settings = data(),
      versions: (string | null)[] = []
    server.use(
      http.patch('*/api/v2/sync-queue/settings', ({ request }) => {
        versions.push(request.headers.get('If-Match'))
        if (versions.length === 1) {
          settings.etag = '"queue-v2"'
          return HttpResponse.json(
            { type: 'about:blank', title: 'Precondition Failed', status: 412 },
            { status: 412, headers: { 'Content-Type': 'application/problem+json' } },
          )
        }
        return HttpResponse.json({ data: settings })
      }),
    )
    const page = await open(settings)
    await page.get('#queue-maxBytesPerSecond').setValue(1024)
    await page.get('form').trigger('submit')
    await vi.waitFor(() => expect(page.text()).toContain('Save again'))
    expect((page.get('#queue-maxBytesPerSecond').element as HTMLInputElement).value).toBe('1024')
    expect(versions).toEqual(['"queue-v1"'])
    await page.get('form').trigger('submit')
    await vi.waitFor(() => expect(versions).toEqual(['"queue-v1"', '"queue-v2"']))
  })
  it('closes an unchanged form without sending a patch', async () => {
    const patch = vi.fn(() => HttpResponse.json({ data: data() }))
    server.use(http.patch('*/api/v2/sync-queue/settings', patch))
    const page = await open()
    await page.get('form').trigger('submit')
    await flushPromises()
    expect(page.find('form').exists()).toBe(false)
    expect(patch).not.toHaveBeenCalled()
  })
  it.each([
    ['maxParallel', ''],
    ['maxParallel', '0'],
    ['maxParallel', '33'],
    ['maxParallel', '1.5'],
    ['maxBytesPerSecond', ''],
    ['maxBytesPerSecond', '-1'],
    ['maxBytesPerSecond', '10485761'],
  ])('rejects invalid %s=%s without sending a patch', async (field, value) => {
    const patch = vi.fn(() => HttpResponse.json({ data: data() }))
    server.use(http.patch('*/api/v2/sync-queue/settings', patch))
    const page = await open()
    await page.get(`#queue-${field}`).setValue(value)
    await page.get('form').trigger('submit')
    await flushPromises()
    expect(page.get(`#queue-${field}`).attributes('aria-invalid')).toBe('true')
    expect(patch).not.toHaveBeenCalled()
  })
  it('preserves input and shows a failed save', async () => {
    server.use(
      http.patch('*/api/v2/sync-queue/settings', () =>
        HttpResponse.json(
          { type: 'about:blank', title: 'Server error', status: 500 },
          { status: 500, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    const page = await open()
    await page.get('#queue-maxParallel').setValue(12)
    await page.get('form').trigger('submit')
    await vi.waitFor(() => expect(page.find('[role="alert"]').exists()).toBe(true))
    expect((page.get('#queue-maxParallel').element as HTMLInputElement).value).toBe('12')
  })
  it.each([0, 64, 0.5])('displays KB/s and saves %s KB/s as bytes per second', async (kb) => {
    useScenario('sync-jobs-admin')
    const settings = { maxParallel: 4, maxBytesPerSecond: 1048576, etag: '"queue-1"' }
    const writes: { body: unknown; etag: string | null }[] = []
    server.use(
      http.get('*/api/v2/sync-queue/settings', () => HttpResponse.json({ data: settings })),
      http.patch('*/api/v2/sync-queue/settings', async ({ request }) => {
        const body = await request.json()
        writes.push({ body, etag: request.headers.get('If-Match') })
        Object.assign(settings, body)
        return HttpResponse.json({ data: settings })
      }),
    )
    const router = createTestRouter()
    await router.push('/sync-queue')
    wrapper = mountWithApp(SyncQueuePage, { global: { plugins: [router] } })
    await vi.waitFor(() => expect(wrapper!.text()).toContain('1024'))
    await wrapper.get('button[aria-label="Edit Sync-job settings"]').trigger('click')
    expect((wrapper.get('#queue-maxBytesPerSecond').element as HTMLInputElement).value).toBe('1024')
    expect(wrapper.text()).toContain('How many sync jobs may run at the same time (1-32).')
    expect(wrapper.text()).toContain('Bandwidth limit per process (KB/s)')
    await wrapper.get('#queue-maxBytesPerSecond').setValue(String(kb))
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() =>
      expect(writes).toEqual([{ body: { maxBytesPerSecond: kb * 1024 }, etag: '"queue-1"' }]),
    )
    await flushPromises()
    if (kb === 0) expect(wrapper.text()).toContain('Unlimited')
  })
})
