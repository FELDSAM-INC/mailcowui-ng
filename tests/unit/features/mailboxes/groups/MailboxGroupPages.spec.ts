import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'
import { RouterView } from 'vue-router'
import MailboxGroupsPage from '@/features/mailboxes/groups/MailboxGroupsPage.vue'
import MailboxGroupCreatePage from '@/features/mailboxes/groups/MailboxGroupCreatePage.vue'
import type { MailboxGroup } from '@/features/mailboxes/groups/api'
import DomainPicker from '@/shared/components/DomainPicker.vue'
import { settleConfirm } from '@/shared/composables/useConfirm'
import { server, useScenario } from '../../../../mocks/node'
import { mountWithApp } from '../../../support/mount'
import { installMatchMedia } from '../../../support/media'
import { createTestRouter } from '../../../support/router'

const fixture = (): MailboxGroup => ({
  id: 1,
  domain: 'example.org',
  name: 'Staff',
  description: '<img src=x onerror=alert(1)>',
  address: 'staff@example.org',
  active: true,
  senderAllowed: true,
  sogoVisible: false,
  internal: false,
  templateId: null,
  priority: 0,
  identityReference: null,
  members: [{ mailbox: 'anna@example.org', source: 'manual', editable: true }],
  sendAs: [],
  imapGrants: [],
  sogoGrants: [],
  editable: true,
  adminFieldsEditable: true,
  createdAt: '2026-11-16T12:00:00Z',
  modifiedAt: null,
  etag: '"g1"',
  warnings: [],
})
let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  settleConfirm(false)
})
async function open(component: Component, path: string) {
  installMatchMedia({ '(min-width: 768px)': true })
  useScenario('admin-create')
  const router = createTestRouter()
  router.addRoute({ name: 'group-page-test', path, component })
  await router.push(path)
  wrapper = mountWithApp(RouterView, { attachTo: document.body, global: { plugins: [router] } })
  return { page: wrapper, router }
}
describe('Mailbox group pages', () => {
  it('loads groups, escapes names, sorts through the table header and preserves a search in the URL', async () => {
    const reads: URL[] = []
    server.use(
      http.get('*/api/v2/mailbox-groups', ({ request }) => {
        reads.push(new URL(request.url))
        return HttpResponse.json({
          data: [{ ...fixture(), name: '<img src=x onerror=alert(1)>' }],
          meta: { total: 1, limit: 25, offset: 0 },
        })
      }),
    )
    const { page, router } = await open(MailboxGroupsPage, '/group-list-test')
    await vi.waitFor(() => expect(page.text()).toContain('staff@example.org'))
    expect(page.find('img').exists()).toBe(false)
    expect(page.text()).toContain('<img src=x onerror=alert(1)>')
    await page.get('[data-sort="name"]').trigger('click')
    await vi.waitFor(() => expect(reads.at(-1)?.searchParams.get('order')).toBe('desc'))
    await page.get('input[type="search"]').setValue('Staff')
    await vi.waitFor(() => expect(reads.at(-1)?.searchParams.get('q')).toBe('Staff'))
    expect(router.currentRoute.value.query.q).toBe('Staff')
    expect(page.find('[data-row-href="/ng/mailbox-groups/1"]').exists()).toBe(true)
  })
  it('creates a group with the selected domain and navigates to its returned identity', async () => {
    const bodies: unknown[] = []
    server.use(
      http.post('*/api/v2/mailbox-groups', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ data: fixture() }, { status: 201 })
      }),
    )
    const { page, router } = await open(MailboxGroupCreatePage, '/group-create-test')
    await vi.waitFor(() => expect(page.find('#group-name').exists()).toBe(true))
    const domain = page
      .findAllComponents(DomainPicker)
      .find((p) => p.props('id') === 'group-domain')!
    domain.vm.$emit('update:modelValue', 'example.org')
    await page.get('#group-name').setValue('  Staff  ')
    await page.get('#group-address').setValue('staff@example.org')
    await page.get('form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('mailbox-group-detail'))
    expect(bodies).toHaveLength(1)
    expect(bodies[0]).toMatchObject({
      name: 'Staff',
      domain: 'example.org',
      address: 'staff@example.org',
      members: [],
      active: true,
    })
    expect(router.currentRoute.value.params.groupId).toBe('1')
  })
  it('keeps a rejected creation editable and does not leave the form', async () => {
    server.use(
      http.post('*/api/v2/mailbox-groups', () =>
        HttpResponse.json(
          { type: 'about:blank', title: 'Conflict', status: 409 },
          { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    const { page, router } = await open(MailboxGroupCreatePage, '/group-create-test')
    await page.get('#group-name').setValue('Existing team')
    await page.get('form').trigger('submit')
    await vi.waitFor(() => expect(page.find('[role="alert"]').exists()).toBe(true))
    await flushPromises()
    expect((page.get('#group-name').element as HTMLInputElement).value).toBe('Existing team')
    expect(page.get('fieldset').attributes('disabled')).toBeUndefined()
    expect(router.currentRoute.value.path).toBe('/group-create-test')
  })
})
