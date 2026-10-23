import { sortList } from '../../../support/data-list'
// UI 011 US4 (FR-050 to FR-062): the Queue Manager page's wiring under the unit coverage — the
// list with its total, the search with its announced count, the states (loading, empty, no match,
// failure, Postfix stopped, truncated), selection mode with legacy's actions in one request each,
// the typed deletion, flush and delete all, every outcome (done, refused, unknown, not recorded),
// the sort controls and the content viewer at its own address. The end-to-end specs cover the same
// paths in a browser.
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import MailQueuePage from '@/features/operations/mail-queue/pages/MailQueuePage.vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import { liveMessages } from '@/shared/composables/useAnnouncer'

import type { ScenarioOverrides } from '../../../../mocks/scenarios'
import { mockState, useScenario } from '../../../../mocks/node'
import { installMatchMedia } from '../../../support/media'
import { mountWithApp } from '../../../support/mount'

const settle = (check: () => void) => vi.waitFor(check, { timeout: 5000 })

const mounted: VueWrapper[] = []
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
})

function buildRouter(): Router {
  const stub = { render: () => null }
  return createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [
      { path: '/operations/mail-queue', name: 'operations-mail-queue', component: MailQueuePage },
      {
        path: '/operations/mail-queue/messages/:queueId',
        name: 'operations-mail-queue-message',
        component: MailQueuePage,
        props: true,
      },
      {
        path: '/operations/containers/:containerName',
        name: 'operations-container',
        component: stub,
      },
      { path: '/audit-log', name: 'audit-log', component: stub },
    ],
  })
}

async function open(
  path = '/operations/mail-queue',
  scenario = 'ops-queue',
  options: { wide?: boolean; overrides?: ScenarioOverrides; ready?: boolean } = {},
) {
  installMatchMedia({ '(min-width: 768px)': options.wide ?? false })
  useScenario(scenario, options.overrides)
  const router = buildRouter()
  await router.push(path)
  await router.isReady()
  const wrapper = mountWithApp(
    { components: { ConfirmDialog }, template: '<div><RouterView /><ConfirmDialog /></div>' },
    { global: { plugins: [router] }, attachTo: document.body },
  )
  mounted.push(wrapper)
  if (options.ready !== false) {
    await settle(() =>
      expect(wrapper.find('[data-list-state]').attributes('data-list-state')).not.toBe('loading'),
    )
  }
  return { wrapper, router }
}

const requests = (operationId: string) =>
  mockState().requests.filter((request) => request.operationId === operationId)

function button(wrapper: VueWrapper, name: string) {
  const found = wrapper.findAll('button').find((item) => item.text().trim() === name)
  if (!found) throw new Error(`no button "${name}"`)
  return found
}

function bar(wrapper: VueWrapper) {
  return wrapper.get('[data-bulk-bar]')
}

function barButton(wrapper: VueWrapper, name: string) {
  const found = bar(wrapper)
    .findAll('button')
    .find((item) => item.text().trim() === name)
  if (!found) throw new Error(`no bar button "${name}"`)
  return found
}

/** Enters selection mode and ticks the messages with these queue IDs. */
async function select(wrapper: VueWrapper, ...ids: string[]) {
  await button(wrapper, 'Select').trigger('click')
  for (const id of ids) {
    const box = wrapper.find(`input[type="checkbox"][aria-label="Select ${id}"]`)
    await box.setValue(true)
  }
  await nextTick()
}

function dialog(): HTMLElement {
  const found = document.querySelector<HTMLElement>('[role="alertdialog"]')
  if (!found) throw new Error('no dialog')
  return found
}

function dialogButton(name: string): HTMLButtonElement {
  const found = [...dialog().querySelectorAll('button')].find(
    (item) => item.textContent?.trim() === name,
  )
  if (!found) throw new Error(`no dialog button "${name}"`)
  return found
}

describe('MailQueuePage list', () => {
  it('shows the loading state first, then the queue with its total, legend and cards', async () => {
    const { wrapper } = await open('/operations/mail-queue', 'ops-queue', { ready: false })
    expect(wrapper.get('[data-list-state]').attributes('data-list-state')).toBe('loading')
    expect(wrapper.find('[data-list-loading]').exists()).toBe(true)
    await settle(() =>
      expect(wrapper.get('[data-list-state]').attributes('data-list-state')).toBe('ready'),
    )
    expect(wrapper.get('h1').text()).toBe('Queue Manager')
    expect(wrapper.get('[data-queue-total]').text()).toBe('9')
    expect(wrapper.find('[data-queue-legend]').exists()).toBe(true)
    expect(wrapper.findAll('[data-entry]')).toHaveLength(9)
    expect(wrapper.find('[data-queue-truncated]').exists()).toBe(false)
    expect(wrapper.find('[data-list-columns]').exists()).toBe(true)
  })

  it('announces the new count once a search applies and keeps it in the address', async () => {
    const { wrapper, router } = await open()
    await router.push('/operations/mail-queue?q=partner.example')
    await settle(() => expect(wrapper.findAll('[data-entry]')).toHaveLength(3))
    await settle(() => expect(liveMessages.polite.value).toBe('Showing 1 to 3 of 3 entries'))
    const request = requests('listMailQueueMessages').at(-1)!
    expect(request.path).toContain('q=partner.example')
  })

  it('says when nothing matches and clears the search', async () => {
    const { wrapper, router } = await open('/operations/mail-queue?q=no-such-message-anywhere')
    await settle(() => expect(wrapper.text()).toContain('No matching records found'))
    await button(wrapper, 'Clear search').trigger('click')
    await settle(() => expect(router.currentRoute.value.query).toEqual({}))
    await settle(() => expect(wrapper.findAll('[data-entry]')).toHaveLength(9))
  })

  it('says that the queue is empty, and offers no selection actions on it', async () => {
    const { wrapper } = await open('/operations/mail-queue', 'ops-queue-empty')
    expect(wrapper.get('[data-list-state]').attributes('data-list-state')).toBe('empty')
    expect(wrapper.get('[data-empty]').text()).toBe('No data available in table')
    expect(wrapper.get('[data-queue-total]').text()).toBe('0')
  })

  it('shows a failed load with a retry that reads the list again', async () => {
    const { wrapper } = await open('/operations/mail-queue', 'ops-queue', {
      overrides: { operations: { inject: { listMailQueueMessages: { status: 500, times: 1 } } } },
    })
    expect(wrapper.get('[data-list-state]').attributes('data-list-state')).toBe('error')
    expect(wrapper.text()).toContain('The list could not be loaded.')
    const before = requests('listMailQueueMessages').length
    await button(wrapper, 'Try again').trigger('click')
    await settle(() =>
      expect(wrapper.get('[data-list-state]').attributes('data-list-state')).toBe('ready'),
    )
    expect(requests('listMailQueueMessages').length).toBeGreaterThan(before)
  })

  it('names the stopped Postfix container instead of the list', async () => {
    const { wrapper } = await open('/operations/mail-queue', 'ops-queue-postfix-stopped')
    await settle(() => expect(wrapper.text()).toContain('postfix-mailcow'))
    expect(wrapper.findAll('[data-entry]')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('Flush queue')
  })

  it('says that only the first messages are listed when the list is truncated', async () => {
    const { wrapper } = await open('/operations/mail-queue', 'ops-queue-large')
    await settle(() => expect(wrapper.find('[data-queue-truncated]').exists()).toBe(true))
    expect(wrapper.get('[data-queue-truncated]').text()).toContain('10,000')
    expect(wrapper.get('[data-queue-total]').text()).toBe('12,000')
  })

  it('refreshes the list on Refresh', async () => {
    const { wrapper } = await open()
    const before = requests('listMailQueueMessages').length
    await button(wrapper, 'Refresh').trigger('click')
    await settle(() => expect(requests('listMailQueueMessages').length).toBe(before + 1))
  })
})

describe('MailQueuePage sorting and paging', () => {
  it('sorts by the phone selects and keeps the sort in the address', async () => {
    const { wrapper, router } = await open()
    await sortList(wrapper, 'size')
    await settle(() => expect(router.currentRoute.value.query.sort).toBe('size'))
    await sortList(wrapper, 'size')
    await settle(() => expect(router.currentRoute.value.query.order).toBe('desc'))
    await settle(() =>
      expect(requests('listMailQueueMessages').at(-1)!.path).toContain('order=desc'),
    )
  })

  it('sorts by a column header of the wide table', async () => {
    const { wrapper, router } = await open('/operations/mail-queue', 'ops-queue', { wide: true })
    expect(wrapper.find('table').exists()).toBe(true)
    await wrapper.findAll('thead button')[0]!.trigger('click')
    await settle(() => expect(router.currentRoute.value.query).not.toEqual({}))
  })

  it('pages through the queue', async () => {
    const { wrapper, router } = await open('/operations/mail-queue', 'ops-queue-large')
    await wrapper.get('button[aria-label="Next"]').trigger('click')
    await settle(() => expect(router.currentRoute.value.query.page).toBe('2'))
    await settle(() =>
      expect(requests('listMailQueueMessages').at(-1)!.path).toContain('offset=25'),
    )
  })
})

describe('MailQueuePage selection and actions', () => {
  it('holds the selected messages in one request and reports the result per message', async () => {
    const { wrapper } = await open()
    await select(wrapper, '4F2A1B3C9D', '5B0C2D4E1F')
    expect(bar(wrapper).text()).toContain('2 selected')
    await barButton(wrapper, 'Hold').trigger('click')
    await settle(() => expect(wrapper.find('[data-queue-status]').exists()).toBe(true))
    expect(wrapper.get('[data-queue-status]').text()).toBe('Queue command completed successfully')
    const [request] = requests('bulkMailQueueMessages')
    expect(request!.body).toEqual({
      action: 'hold',
      targets: [{ id: '4F2A1B3C9D' }, { id: '5B0C2D4E1F' }],
    })
    expect(wrapper.get('section[aria-label="Results"]').text()).toContain('4F2A1B3C9D')
    expect(bar(wrapper).text()).toContain('0 selected')
  })

  it('selects every message of the page with "Toggle all" and clears it again', async () => {
    const { wrapper } = await open()
    await button(wrapper, 'Select').trigger('click')
    const toggle = wrapper.get('input[type="checkbox"][aria-label="Toggle all"]')
    await toggle.setValue(true)
    expect(bar(wrapper).text()).toContain('9 selected')
    await wrapper.get('input[type="checkbox"][aria-label="Toggle all"]').setValue(false)
    expect(bar(wrapper).text()).toContain('0 selected')
    await button(wrapper, 'Done selecting').trigger('click')
    expect(wrapper.find('[data-bulk-bar]').exists()).toBe(false)
  })

  it('reports a message that left the queue before the action as not found', async () => {
    const { wrapper } = await open('/operations/mail-queue', 'ops-queue-vanishing')
    await select(wrapper, '5B0C2D4E1F', '6C1D3E5F20')
    await barButton(wrapper, 'Unhold').trigger('click')
    await settle(() => expect(wrapper.find('section[aria-label="Results"]').exists()).toBe(true))
    const results = wrapper.get('section[aria-label="Results"]').text()
    expect(results).toContain('Not found')
    expect(requests('bulkMailQueueMessages')[0]!.body).toMatchObject({ action: 'release' })
  })

  it('asks for the typed number before deleting, and sends nothing when cancelled', async () => {
    const { wrapper } = await open()
    await select(wrapper, '4F2A1B3C9D')
    await barButton(wrapper, 'Remove').trigger('click')
    await settle(() => expect(document.querySelector('[role="alertdialog"]')).not.toBeNull())
    expect(dialog().textContent).toContain('Confirm deletion')
    expect(dialog().querySelector('[data-delete-ids]')!.textContent).toContain('4F2A1B3C9D')
    dialogButton('Cancel').click()
    await settle(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull())
    expect(requests('bulkMailQueueMessages')).toEqual([])

    await barButton(wrapper, 'Remove').trigger('click')
    await settle(() => expect(document.querySelector('[role="alertdialog"]')).not.toBeNull())
    const remove = dialogButton('Delete now')
    expect(remove.disabled).toBe(true)
    const input = dialog().querySelector<HTMLInputElement>('input[type="text"]')!
    input.value = '1'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    expect(remove.disabled).toBe(false)
    remove.click()
    await settle(() => expect(requests('bulkMailQueueMessages')).toHaveLength(1))
    expect(requests('bulkMailQueueMessages')[0]!.body).toEqual({
      action: 'delete',
      targets: [{ id: '4F2A1B3C9D' }],
    })
    await settle(() => expect(wrapper.find('[data-queue-status]').exists()).toBe(true))
  })

  it("shows Postfix's refusal and keeps the selection", async () => {
    const { wrapper } = await open('/operations/mail-queue', 'ops-queue-failure')
    await select(wrapper, '4F2A1B3C9D')
    await barButton(wrapper, 'Deliver').trigger('click')
    await settle(() =>
      expect(wrapper.text()).toContain('Error: postsuper: fatal: queue file is locked'),
    )
    expect(wrapper.find('[data-queue-status]').exists()).toBe(false)
    expect(bar(wrapper).text()).toContain('1 selected')
  })

  it('says "outcome unknown" after a timeout, never repeats it, and reads the list again', async () => {
    const { wrapper } = await open('/operations/mail-queue', 'ops-queue-timeout')
    await select(wrapper, '4F2A1B3C9D')
    const before = requests('listMailQueueMessages').length
    await barButton(wrapper, 'Hold').trigger('click')
    await settle(() => expect(wrapper.find('[data-queue-unknown]').exists()).toBe(true))
    expect(wrapper.get('[data-queue-unknown]').text()).toContain('Outcome unknown')
    expect(requests('bulkMailQueueMessages')).toHaveLength(1)
    await settle(() => expect(requests('listMailQueueMessages').length).toBeGreaterThan(before))
    await flushPromises()
    expect(requests('bulkMailQueueMessages')).toHaveLength(1)
  })

  it('warns when an action was carried out without an audit record', async () => {
    const { wrapper } = await open('/operations/mail-queue', 'ops-queue', {
      overrides: {
        operations: { inject: { bulkMailQueueMessages: { auditRecorded: false } } },
      },
    })
    await select(wrapper, '4F2A1B3C9D')
    await barButton(wrapper, 'Hold').trigger('click')
    await settle(() => expect(wrapper.find('[data-not-recorded]').exists()).toBe(true))
    expect(wrapper.get('[data-not-recorded]').text()).toBe(
      'The action was carried out, but no audit record was written.',
    )
  })

  it('names the Postfix container when an action finds it stopped', async () => {
    const { wrapper } = await open('/operations/mail-queue', 'ops-queue', {
      overrides: {
        operations: {
          inject: {
            bulkMailQueueMessages: {
              status: 409,
              problemType: 'mail-service-not-running',
              extensions: { container: 'postfix-mailcow' },
            },
          },
        },
      },
    })
    await select(wrapper, '4F2A1B3C9D')
    await barButton(wrapper, 'Hold').trigger('click')
    await settle(() => expect(wrapper.text()).toContain('postfix-mailcow'))
    expect(wrapper.findAll('[data-entry]')).toHaveLength(0)
  })
})

describe('MailQueuePage whole-queue actions', () => {
  it('flushes the queue without a confirmation', async () => {
    const { wrapper } = await open()
    await button(wrapper, 'Flush queue').trigger('click')
    await settle(() => expect(requests('flushMailQueue')).toHaveLength(1))
    await settle(() => expect(wrapper.find('[data-queue-status]').exists()).toBe(true))
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
  })

  it('reports an unknown flush outcome', async () => {
    const { wrapper } = await open('/operations/mail-queue', 'ops-queue-timeout')
    await button(wrapper, 'Flush queue').trigger('click')
    await settle(() => expect(wrapper.find('[data-queue-unknown]').exists()).toBe(true))
    expect(wrapper.findAll('section[aria-label="Results"]')).toHaveLength(0)
  })

  it('deletes every queued message only after the acknowledged confirmation', async () => {
    const { wrapper } = await open()
    await button(wrapper, 'Delete all').trigger('click')
    await settle(() => expect(document.querySelector('[data-purge-count]')).not.toBeNull())
    const purge = document.querySelector<HTMLElement>('[data-purge-dialog]')!
    expect(requests('purgeMailQueue')).toEqual([])
    const input = purge.querySelector<HTMLInputElement>('input[type="text"]')!
    input.value = '9'
    input.dispatchEvent(new Event('input'))
    purge.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()
    await nextTick()
    const remove = [...purge.querySelectorAll('button')].find((item) =>
      item.textContent?.includes('Delete now'),
    )!
    remove.click()
    await settle(() => expect(requests('purgeMailQueue')).toHaveLength(1))
    await settle(() => expect(wrapper.find('[data-queue-status]').exists()).toBe(true))
  })
})

describe('MailQueuePage content viewer', () => {
  it('opens a message at its own address over the list and returns to the list on close', async () => {
    const { wrapper, router } = await open(
      '/operations/mail-queue/messages/4F2A1B3C9D?q=partner.example',
    )
    await settle(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull())
    expect(requests('getMailQueueMessageContent')).toHaveLength(1)
    const close = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
      (item) => item.textContent?.trim() === 'Close' || item.getAttribute('aria-label') === 'Close',
    )!
    close.click()
    await settle(() => expect(router.currentRoute.value.name).toBe('operations-mail-queue'))
    expect(router.currentRoute.value.query).toEqual({ q: 'partner.example' })
    await settle(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
    expect(wrapper.findAll('[data-entry]').length).toBeGreaterThan(0)
  })

  it('links each message to its content', async () => {
    const { wrapper } = await open('/operations/mail-queue', 'ops-queue', { wide: true })
    const link = wrapper.find('a[data-show-message="4F2A1B3C9D"]')
    expect(link.attributes('href')).toBe('/ng/operations/mail-queue/messages/4F2A1B3C9D')
  })
})
