// The mailbox page (UI 003 T051, T058 under the forms rule): the heading with the address, the
// usage figures, the sections in legacy order, a section opened by `?edit=`, the canonical address,
// "not found" with the way back, the History link for administrators only, and the load error.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { setSessionContext } from '@/app/session/context'
import MailboxDetailPage from '@/features/mailboxes/pages/MailboxDetailPage.vue'
import { createAppChannel } from '@/shared/platform/broadcast'

import { useScenario } from '../../../../mocks/node'
import { mountWithApp, testPlugins } from '../../../support/mount'
import { createTestRouter } from '../../../support/router'

afterEach(() => setSessionContext(null))

async function mountAt(path: string) {
  const router = createTestRouter()
  await router.push(path)
  setSessionContext({
    queryClient: testPlugins().queryClient,
    router,
    channel: createAppChannel('test'),
  })
  const wrapper = mountWithApp(MailboxDetailPage, {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router }
}

describe('MailboxDetailPage', () => {
  it('shows the heading, the usage, the sections in legacy order and History for administrators', async () => {
    useScenario('admin-edit')
    const { wrapper } = await mountAt('/mailboxes/anna@a.example')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Edit mailbox'))
    expect(wrapper.find('[data-mailbox-usage]').exists()).toBe(true)
    // UI 006: the rate limit section is loaded on its own.
    await vi.waitFor(() => expect(wrapper.find('#section-rate-limit').exists()).toBe(true))
    const sections = wrapper.findAll('section[id^="section-"]').map((item) => item.attributes('id'))
    expect(sections).toEqual([
      'section-mailbox',
      'section-attributes',
      'section-pushover',
      'section-acl',
      'section-rate-limit',
      'section-rename',
    ])
    expect(wrapper.findAll('a').some((link) => link.text() === 'History')).toBe(true)
  })

  it('opens the section named by ?edit= and replaces another spelling of the address', async () => {
    useScenario('admin-edit')
    const { wrapper, router } = await mountAt('/mailboxes/ANNA@A.example?edit=acl')
    await vi.waitFor(() => expect(router.currentRoute.value.params.address).toBe('anna@a.example'))
    expect(router.currentRoute.value.query.edit).toBe('acl')
    await vi.waitFor(() => expect(wrapper.find('#section-acl-permissions').exists()).toBe(true))
  })

  it('drops an unknown section from the address', async () => {
    useScenario('admin-edit')
    const { router } = await mountAt('/mailboxes/anna@a.example?edit=nope')
    await vi.waitFor(() => expect(router.currentRoute.value.query.edit).toBeUndefined())
  })

  it('shows "not found" with the way back for a mailbox outside the scope, without History', async () => {
    useScenario('domain-admin-edit')
    const { wrapper } = await mountAt('/mailboxes/eve@b.example')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Page not found'))
    expect(wrapper.text()).toContain('Back to the mailboxes')
  })

  it('offers a retry when the mailbox cannot be loaded', async () => {
    const state = useScenario('admin-edit')
    state.failures.getMailbox = { status: 503, type: 'temporary-failure', times: 5 }
    const { wrapper } = await mountAt('/mailboxes/anna@a.example')
    await vi.waitFor(() => expect(wrapper.text()).toContain('The mailbox could not be loaded.'), {
      timeout: 5000,
    })
  })
})
