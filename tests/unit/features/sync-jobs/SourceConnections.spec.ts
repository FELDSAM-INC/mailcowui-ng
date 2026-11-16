import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SourceConnections from '@/features/sync-jobs/sources/SourceConnections.vue'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'
import { server, useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'
import { createTestRouter } from '../../support/router'

let wrapper: VueWrapper | undefined
const mailbox = 'anna@example.org'
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  settleConfirm(false)
})
async function open() {
  useScenario('sync-jobs-admin')
  server.use(
    http.get('*/api/v2/sync-sources/1/connections', ({ request }) => {
      expect(new URL(request.url).searchParams.get('mailbox')).toBe(mailbox)
      return HttpResponse.json({
        data: [{ remoteUser: 'remote@example.net', expiresAt: null, refreshFailed: true }],
      })
    }),
  )
  const router = createTestRouter()
  await router.push('/sync-sources/1')
  wrapper = mountWithApp(SourceConnections, {
    props: { sourceId: 1, mailbox, allowSelect: true },
    global: { plugins: [router] },
  })
  await vi.waitFor(() => expect(wrapper!.text()).toContain('remote@example.net'))
  return wrapper
}
const button = (page: VueWrapper, text: string) =>
  page.findAll('button').find((b) => b.text() === text)!
describe('Source account connections', () => {
  it('shows refresh failures and selects a remote account without exposing tokens', async () => {
    const page = await open()
    expect(page.text()).toContain('OAuth token refresh failed')
    await button(page, 'Use account').trigger('click')
    expect(page.emitted('select')).toEqual([['remote@example.net']])
  })
  it('starts OAuth for the selected mailbox and clears the provider link when the owner changes', async () => {
    const calls: unknown[] = []
    server.use(
      http.post('*/api/v2/sync-sources/1/oauth/start', async ({ request }) => {
        calls.push(await request.json())
        return HttpResponse.json({
          data: { authorizationUrl: 'https://provider.example/authorize?state=opaque' },
        })
      }),
    )
    const page = await open()
    await button(page, 'Connect account').trigger('click')
    await vi.waitFor(() => expect(page.find('a[target="_blank"]').exists()).toBe(true))
    expect(calls).toEqual([{ mailbox }])
    expect(page.get('a').attributes('rel')).toBe('noopener noreferrer')
    expect(page.get('a').attributes('href')).toBe('https://provider.example/authorize?state=opaque')
    server.use(
      http.get('*/api/v2/sync-sources/1/connections', () => HttpResponse.json({ data: [] })),
    )
    await page.setProps({ mailbox: 'bob@example.org' })
    expect(page.find('a').exists()).toBe(false)
  })
  it('requires confirmation before disconnecting exactly the selected account', async () => {
    const calls: unknown[] = []
    server.use(
      http.delete('*/api/v2/sync-sources/1/connections', async ({ request }) => {
        calls.push(await request.json())
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const page = await open()
    await button(page, 'Disconnect').trigger('click')
    await vi.waitFor(() => expect(confirmState.value).not.toBeNull())
    settleConfirm(false)
    await flushPromises()
    expect(calls).toEqual([])
    await button(page, 'Disconnect').trigger('click')
    settleConfirm(true)
    await vi.waitFor(() => expect(calls).toEqual([{ mailbox, remoteUser: 'remote@example.net' }]))
  })
  it('shows OAuth startup errors without offering a stale provider link', async () => {
    server.use(
      http.post('*/api/v2/sync-sources/1/oauth/start', () =>
        HttpResponse.json(
          { type: 'about:blank', title: 'Unavailable', status: 503 },
          { status: 503, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    const page = await open()
    await button(page, 'Connect account').trigger('click')
    await vi.waitFor(() => expect(page.find('[role="alert"]').exists()).toBe(true))
    expect(page.find('a').exists()).toBe(false)
    expect(button(page, 'Connect account').attributes('disabled')).toBeUndefined()
  })
})
