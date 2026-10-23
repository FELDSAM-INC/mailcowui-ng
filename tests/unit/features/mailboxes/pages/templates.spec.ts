// The mailbox template pages (UI 003 T104, T108 under the forms rule): the list for both roles with
// its states and single deletion, the add form with the built-in defaults and the name rules, and
// the template page with Default's read-only name, changed values only, the outdated handling,
// domain administrators' read-only values and "not found".
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'

import { setSessionContext } from '@/app/session/context'
import MailboxTemplateCreatePage from '@/features/mailboxes/pages/templates/MailboxTemplateCreatePage.vue'
import MailboxTemplateDetailPage from '@/features/mailboxes/pages/templates/MailboxTemplateDetailPage.vue'
import MailboxTemplatesPage from '@/features/mailboxes/pages/templates/MailboxTemplatesPage.vue'
import * as confirmModule from '@/shared/composables/useConfirm'
import { createAppChannel } from '@/shared/platform/broadcast'

import { mockState, useScenario } from '../../../../mocks/node'
import { mountWithApp, testPlugins } from '../../../support/mount'
import { createTestRouter } from '../../../support/router'

const GIB = 1024 ** 3

afterEach(() => {
  setSessionContext(null)
  vi.restoreAllMocks()
})

async function mountAt(component: Component, path: string) {
  const router = createTestRouter()
  await router.push(path)
  setSessionContext({
    queryClient: testPlugins().queryClient,
    router,
    channel: createAppChannel('test'),
  })
  const wrapper = mountWithApp(component, {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router }
}

const requests = (operationId: string) =>
  mockState().requests.filter((request) => request.operationId === operationId)

describe('MailboxTemplatesPage', () => {
  it('lists the templates with the add, select and entry actions for administrators', async () => {
    useScenario('admin-templates')
    const { wrapper } = await mountAt(MailboxTemplatesPage, '/mailbox-templates')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Templates found: 33'))
    expect(wrapper.findAll('[data-entry]')).toHaveLength(25)
    expect(wrapper.text()).toContain('Add Template')
    expect(wrapper.findAll('button').some((button) => button.text() === 'Select')).toBe(true)
    const menu = wrapper.get('[aria-label="Actions for Package 01"]')
    await menu.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(
      document.querySelector('[role="menuitem"][aria-label="Remove: Package 01"]'),
    ).not.toBeNull()
    await menu.trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[aria-label="Edit: Default"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Remove: Default"]').exists()).toBe(false)
  })

  it('gives domain administrators the templates without any control', async () => {
    useScenario('domain-admin-templates')
    const { wrapper } = await mountAt(MailboxTemplatesPage, '/mailbox-templates')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Templates found: 33'))
    expect(wrapper.text()).not.toContain('Add Template')
    expect(wrapper.findAll('button').some((button) => button.text() === 'Select')).toBe(false)
    expect(wrapper.find('[aria-label^="Remove:"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label^="Edit:"]').exists()).toBe(false)
  })

  it('shows the error state with a retry', async () => {
    useScenario('mailbox-templates-list-error')
    const { wrapper } = await mountAt(MailboxTemplatesPage, '/mailbox-templates')
    await vi.waitFor(() => expect(wrapper.text()).toContain('The list could not be loaded.'))
    expect(wrapper.get('[data-list-state]').attributes('data-list-state')).toBe('error')
  })

  it('deletes a template after the confirmation, with its version tag', async () => {
    useScenario('admin-templates')
    const ask = vi.spyOn(confirmModule, 'confirm').mockResolvedValue(true)
    const { wrapper } = await mountAt(MailboxTemplatesPage, '/mailbox-templates?q=small')
    await vi.waitFor(() =>
      expect(wrapper.find('[aria-label="Actions for Small"]').exists()).toBe(true),
    )
    await wrapper.get('[aria-label="Actions for Small"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    document.querySelector<HTMLElement>('[role="menuitem"][aria-label="Remove: Small"]')!.click()
    await vi.waitFor(() => expect(requests('deleteMailboxTemplate')).toHaveLength(1))
    expect(ask.mock.calls[0]![0].content?.props).toEqual(
      expect.objectContaining({ names: ['Small'] }),
    )
    expect(requests('deleteMailboxTemplate')[0]!.headers['if-match']).toMatch(/^"t/)
    await vi.waitFor(() => expect(wrapper.text()).toContain('No matching records found'))
  })
})

describe('MailboxTemplateCreatePage', () => {
  it('starts with the built-in defaults and sends every value with the name', async () => {
    const state = useScenario('admin-templates')
    state.mailboxCapabilities.templateDefaults.quota = 2 * GIB
    const { wrapper, router } = await mountAt(MailboxTemplateCreatePage, '/mailbox-templates/new')
    await vi.waitFor(() => expect(wrapper.find('form').exists()).toBe(true))
    expect(wrapper.get<HTMLInputElement>('#template-add-quota').element.value).toBe('2048')
    await wrapper.get('#template-add-name').setValue('  Students ')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('mailbox-templates'))
    expect(requests('createMailboxTemplate')[0]!.body).toMatchObject({
      name: 'Students',
      quota: 2 * GIB,
      quarantineNotification: 'hourly',
      rateLimit: null,
      tags: [],
    })
  })

  it('refuses an empty name before sending and shows a name in use on the name field', async () => {
    useScenario('admin-templates')
    const { wrapper } = await mountAt(MailboxTemplateCreatePage, '/mailbox-templates/new')
    await vi.waitFor(() => expect(wrapper.find('form').exists()).toBe(true))
    await wrapper.get('#template-add-rateLimit-value').setValue('abc')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Template name invalid')
    expect(requests('createMailboxTemplate')).toHaveLength(0)
    await wrapper.get('#template-add-rateLimit-value').setValue('')
    await wrapper.get('#template-add-name').setValue('STAFF')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Template STAFF already exists'))
  })

  it('offers a retry when the capabilities cannot be loaded', async () => {
    const state = useScenario('admin-templates')
    state.failures.getMailboxCapabilities = { status: 500, times: 5 }
    const { wrapper } = await mountAt(MailboxTemplateCreatePage, '/mailbox-templates/new')
    await vi.waitFor(() => expect(wrapper.text()).toContain('The form could not be loaded.'))
  })
})

describe('MailboxTemplateDetailPage', () => {
  it('keeps Default’s name read-only with the reason and sends only the changed quota', async () => {
    useScenario('admin-templates')
    const { wrapper } = await mountAt(MailboxTemplateDetailPage, '/mailbox-templates/1')
    await vi.waitFor(() => expect(wrapper.find('form').exists()).toBe(true))
    expect(wrapper.get('#template-edit-name').attributes('readonly')).toBeDefined()
    expect(wrapper.text()).toContain('The Default template cannot be renamed.')
    expect(wrapper.findAll('a').some((link) => link.text() === 'History')).toBe(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(requests('updateMailboxTemplate')).toHaveLength(0)
    await wrapper.get('#template-edit-quota').setValue('1024')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(requests('updateMailboxTemplate')).toHaveLength(1))
    expect(requests('updateMailboxTemplate')[0]!.body).toEqual({ quota: GIB })
  })

  it('lists what changed elsewhere, keeps the input, and saves again or discards', async () => {
    const state = useScenario('admin-templates')
    const { wrapper } = await mountAt(MailboxTemplateDetailPage, '/mailbox-templates/2')
    await vi.waitFor(() => expect(wrapper.find('form').exists()).toBe(true))
    await wrapper.get('#template-edit-quota').setValue('3072')
    state.mailboxTemplates.find((item) => item.id === 2)!.rateLimit = { value: 5, frame: 'day' }
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[data-outdated]').exists()).toBe(true))
    expect(wrapper.get('[data-outdated]').text()).toContain('Rate limit: now saved as 5 msgs / day')
    expect(wrapper.get<HTMLInputElement>('#template-edit-quota').element.value).toBe('3072')
    const again = wrapper.get('[data-outdated]').findAll('button')
    await again[0]!.trigger('click')
    await vi.waitFor(() => expect(requests('updateMailboxTemplate')).toHaveLength(2))
    await flushPromises()
    expect(wrapper.find('[data-outdated]').exists()).toBe(false)
    const updates = requests('updateMailboxTemplate')
    expect(updates.map((request) => request.status)).toEqual([412, 200])
    expect(updates[1]!.body).toEqual({ quota: 3 * GIB })

    state.mailboxTemplates.find((item) => item.id === 2)!.quota = GIB
    await wrapper.get('#template-edit-name').setValue('Smaller')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[data-outdated]').exists()).toBe(true))
    await wrapper.get('[data-outdated]').findAll('button')[1]!.trigger('click')
    await flushPromises()
    expect(wrapper.get<HTMLInputElement>('#template-edit-name').element.value).toBe('Small')
    expect(wrapper.get<HTMLInputElement>('#template-edit-quota').element.value).toBe('1024')
  })

  it('shows a name in use on the name field and a template removed meanwhile with the way back', async () => {
    const state = useScenario('admin-templates')
    const { wrapper } = await mountAt(MailboxTemplateDetailPage, '/mailbox-templates/2')
    await vi.waitFor(() => expect(wrapper.find('form').exists()).toBe(true))
    await wrapper.get('#template-edit-name').setValue('staff')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Template staff already exists'))
    state.mailboxTemplates = state.mailboxTemplates.filter((item) => item.id !== 2)
    await wrapper.get('#template-edit-name').setValue('Gone')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('This template no longer exists.'))
    expect(wrapper.text()).toContain('Back to the mailbox templates')
  })

  it('gives domain administrators the values without a form or History', async () => {
    useScenario('domain-admin-templates')
    const { wrapper } = await mountAt(MailboxTemplateDetailPage, '/mailbox-templates/3')
    await vi.waitFor(() => expect(wrapper.find('[data-template-values]').exists()).toBe(true))
    expect(wrapper.find('form').exists()).toBe(false)
    const values = wrapper.get('[data-template-values]')
    expect(values.get('[data-value="quota"]').text()).toContain('5 GiB')
    expect(values.get('[data-value="userPermissions"]').text()).not.toContain('Sync jobs')
    expect(values.get('[data-value="tls"]').text()).toContain('Enforce TLS incoming')
    expect(values.get('[data-value="webmailRedirect"]').text()).toContain('No')
    expect(wrapper.findAll('a').some((link) => link.text() === 'History')).toBe(false)
  })

  it('shows "not found" with the way back, and a retry when the template cannot be loaded', async () => {
    useScenario('admin-templates')
    const missing = await mountAt(MailboxTemplateDetailPage, '/mailbox-templates/999')
    await vi.waitFor(() => expect(missing.wrapper.text()).toContain('Page not found'))
    expect(missing.wrapper.text()).toContain('Back to the mailbox templates')

    const state = useScenario('admin-templates')
    state.failures.getMailboxTemplate = { status: 500, times: 5 }
    const failing = await mountAt(MailboxTemplateDetailPage, '/mailbox-templates/2')
    await vi.waitFor(() =>
      expect(failing.wrapper.text()).toContain('The template could not be loaded.'),
    )
  })
})
