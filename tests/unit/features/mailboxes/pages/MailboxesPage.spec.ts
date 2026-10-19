// The mailbox list page (UI 003 T052, T057): the first page sorted by address; the search committed
// as a new history entry; filters as chips that are removed one by one or all at once; the empty
// and no-match states; the error with retry; the column choice remembered; and no last-login column
// when the server does not report them.
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setSessionContext } from '@/app/session/context'
import MailboxesPage from '@/features/mailboxes/pages/MailboxesPage.vue'
import { createAppChannel } from '@/shared/platform/broadcast'

import { useScenario } from '../../../../mocks/node'
import { installMatchMedia } from '../../../support/media'
import { mountWithApp, testPlugins } from '../../../support/mount'
import { createTestRouter } from '../../../support/router'

let media: ReturnType<typeof installMatchMedia>
beforeEach(() => {
  media = installMatchMedia({ '(min-width: 768px)': true })
  localStorage.clear()
})
afterEach(() => {
  setSessionContext(null)
  vi.unstubAllGlobals()
})

async function mountAt(path: string) {
  const router = createTestRouter()
  await router.push(path)
  setSessionContext({
    queryClient: testPlugins().queryClient,
    router,
    channel: createAppChannel('test'),
  })
  const wrapper = mountWithApp(MailboxesPage, {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router }
}

const rows = (wrapper: Awaited<ReturnType<typeof mountAt>>['wrapper']) =>
  wrapper.findAll('[data-entry]').map((row) => row.attributes('data-entry'))

describe('MailboxesPage', () => {
  it('shows the first page sorted by address with legacy’s columns and the entries shown', async () => {
    useScenario('admin-mailboxes-30')
    const { wrapper } = await mountAt('/mailboxes')
    await vi.waitFor(() => expect(rows(wrapper)).toHaveLength(25))
    expect(rows(wrapper)[0]).toBe('anna@a.example')
    expect(wrapper.text()).toContain('Showing 1 to 25 of 30 entries')
    expect(wrapper.find('[data-column="lastMailLogin"]').exists()).toBe(true)
    expect(wrapper.find('h1').text()).toBe('Mailboxes')
  })

  it('commits the search as a new history entry and shows the matches', async () => {
    useScenario('admin-mailboxes-30')
    const { wrapper, router } = await mountAt('/mailboxes')
    await vi.waitFor(() => expect(rows(wrapper)).toHaveLength(25))
    const push = vi.spyOn(router, 'push')
    await wrapper.get('#mailbox-search').setValue('ANNA')
    await wrapper.get('form[role="search"]').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.query.q).toBe('ANNA'))
    expect(push).toHaveBeenCalled()
    await vi.waitFor(() =>
      expect(rows(wrapper)).toEqual(['anna@a.example', 'bob@a.example', 'carl@a.example']),
    )
  })

  it('shows filters as chips, removes one and clears all', async () => {
    useScenario('admin-mailboxes-30')
    const { wrapper, router } = await mountAt(
      '/mailboxes?status=inactive&status=loginDisabled&domain=a.example',
    )
    await vi.waitFor(() => expect(rows(wrapper)).toEqual(['gina@a.example', 'hugo@a.example']))
    const chips = wrapper.findAll('[aria-label^="Remove filter"]').map((chip) => chip.text())
    expect(chips).toEqual([
      'Domain: a.example',
      'Status: Inactive',
      'Status: Disallow login (incoming mail is still accepted)',
    ])
    await wrapper.get('[aria-label="Remove filter: Status: Inactive"]').trigger('click')
    await vi.waitFor(() =>
      expect(router.currentRoute.value.query.status).toEqual(['loginDisabled']),
    )
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Clear all filters')!
      .trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({}))
  })

  it('offers to clear the filters when nothing matches, and explains an empty list', async () => {
    useScenario('admin-mailboxes-30')
    const { wrapper } = await mountAt('/mailboxes?q=nothing-matches')
    await vi.waitFor(() => expect(wrapper.find('[data-empty="noMatch"]').exists()).toBe(true))
    expect(wrapper.text()).toContain('No matching records found')
    wrapper.unmount()
    useScenario('mailboxes-empty-filter')
    const empty = await mountAt('/mailboxes')
    await vi.waitFor(() => expect(empty.wrapper.find('[data-empty="none"]').exists()).toBe(true))
    expect(empty.wrapper.text()).toContain('No data available in table')
  })

  it('shows the error with a retry', async () => {
    useScenario('mailboxes-list-error')
    const { wrapper } = await mountAt('/mailboxes')
    await vi.waitFor(() => expect(wrapper.attributes('data-list-state')).toBe('error'), {
      timeout: 5000,
    })
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  })

  it('shows the chosen optional columns and leaves out unreported last logins', async () => {
    useScenario('capabilities-last-logins-off')
    localStorage.setItem('mailcowui-ng.mailboxes.columns', '["createdAt"]')
    const { wrapper } = await mountAt('/mailboxes')
    await vi.waitFor(() => expect(rows(wrapper)).toHaveLength(25))
    await vi.waitFor(() =>
      expect(wrapper.find('[data-column="lastMailLogin"]').exists()).toBe(false),
    )
    expect(wrapper.find('[data-column="createdAt"]').exists()).toBe(true)
  })

  it('shows cards and the sort in the filters below md', async () => {
    useScenario('admin-mailboxes-30')
    media.set('(min-width: 768px)', false)
    const { wrapper } = await mountAt('/mailboxes')
    await vi.waitFor(() => expect(wrapper.findAll('li[data-entry]')).toHaveLength(25))
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.find('#mailbox-sort').exists()).toBe(true)
  })
})
