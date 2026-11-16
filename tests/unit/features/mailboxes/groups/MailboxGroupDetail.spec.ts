import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RouterView } from 'vue-router'
import MailboxGroupDetailPage from '@/features/mailboxes/groups/MailboxGroupDetailPage.vue'
import type { MailboxGroup } from '@/features/mailboxes/groups/api'
import { settleConfirm } from '@/shared/composables/useConfirm'
import { server, useScenario } from '../../../../mocks/node'
import { mountWithApp } from '../../../support/mount'
import { installMatchMedia } from '../../../support/media'
import { createTestRouter } from '../../../support/router'

const fixture = (): MailboxGroup => ({
  id: 1,
  domain: 'example.org',
  name: 'Staff',
  description: 'Team members',
  address: null,
  active: true,
  senderAllowed: false,
  sogoVisible: false,
  internal: false,
  templateId: null,
  priority: 0,
  identityReference: null,
  members: [
    { mailbox: 'anna@example.org', source: 'manual', editable: true },
    { mailbox: 'linked@example.org', source: 'idp', editable: false },
  ],
  sendAs: [],
  imapGrants: [],
  sogoGrants: [],
  editable: true,
  adminFieldsEditable: true,
  createdAt: '2026-11-16T12:00:00Z',
  modifiedAt: null,
  etag: '"group-v1"',
  warnings: [],
})
let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  settleConfirm(false)
})
async function open(data = fixture()) {
  installMatchMedia({ '(min-width: 768px)': true })
  useScenario('admin-create')
  server.use(http.get('*/api/v2/mailbox-groups/1', () => HttpResponse.json({ data })))
  const router = createTestRouter()
  router.removeRoute('mailbox-group-detail')
  router.addRoute({
    name: 'mailbox-group-detail',
    path: '/mailbox-groups/:groupId',
    component: MailboxGroupDetailPage,
  })
  await router.push('/mailbox-groups/1')
  wrapper = mountWithApp(RouterView, { attachTo: document.body, global: { plugins: [router] } })
  await vi.waitFor(() => expect(wrapper!.find('#section-mailbox-group').exists()).toBe(true))
  return wrapper
}
async function edit(page: VueWrapper) {
  await page.get('button[aria-label="Edit Group settings"]').trigger('click')
  await flushPromises()
}
describe('Mailbox group detail', () => {
  it('sends only the changed field and version, retaining identity-managed membership', async () => {
    const data = fixture(),
      requests: { body: unknown; etag: string | null }[] = []
    server.use(
      http.patch('*/api/v2/mailbox-groups/1', async ({ request }) => {
        const body = await request.json()
        requests.push({ body, etag: request.headers.get('If-Match') })
        data.description = 'Updated team'
        data.etag = '"group-v2"'
        return HttpResponse.json({ data })
      }),
    )
    const page = await open(data)
    await edit(page)
    expect(page.text()).toContain('linked@example.org')
    await page.get('#group-description').setValue('Updated team')
    await page.get('#section-mailbox-group form').trigger('submit')
    await vi.waitFor(() =>
      expect(requests).toEqual([{ body: { description: 'Updated team' }, etag: '"group-v1"' }]),
    )
    await vi.waitFor(() => expect(page.find('#group-description').exists()).toBe(false))
  })
  it('preserves a draft after a stale save and requires an explicit retry', async () => {
    const data = fixture(),
      versions: (string | null)[] = []
    server.use(
      http.patch('*/api/v2/mailbox-groups/1', ({ request }) => {
        versions.push(request.headers.get('If-Match'))
        if (versions.length === 1) {
          data.etag = '"group-v2"'
          return HttpResponse.json(
            { type: 'about:blank', title: 'Precondition Failed', status: 412 },
            { status: 412, headers: { 'Content-Type': 'application/problem+json' } },
          )
        }
        return HttpResponse.json({ data })
      }),
    )
    const page = await open(data)
    await edit(page)
    await page.get('#group-name').setValue('My draft')
    await page.get('#section-mailbox-group form').trigger('submit')
    await vi.waitFor(() => expect(page.text()).toContain('Save again'))
    expect((page.get('#group-name').element as HTMLInputElement).value).toBe('My draft')
    expect(versions).toEqual(['"group-v1"'])
    await page.get('#section-mailbox-group form').trigger('submit')
    await vi.waitFor(() => expect(versions).toEqual(['"group-v1"', '"group-v2"']))
  })
  it('hides administrator settings for domain administrators', async () => {
    const data = fixture()
    data.adminFieldsEditable = false
    const page = await open(data)
    await edit(page)
    expect(page.find('#group-priority').exists()).toBe(false)
    expect(page.find('#group-identityReference').exists()).toBe(false)
    expect(page.find('#group-name').exists()).toBe(true)
  })
  it('never offers changes to a read-only group and escapes untrusted text', async () => {
    const data = fixture()
    data.editable = false
    data.description = '<img src=x onerror=alert(1)>'
    const page = await open(data)
    expect(page.text()).toContain('<img src=x onerror=alert(1)>')
    expect(page.find('img').exists()).toBe(false)
    expect(page.find('button[aria-label="Edit Group settings"]').exists()).toBe(false)
    expect(page.findAll('button').some((b) => b.text() === 'Delete')).toBe(false)
  })
})
