// UI 011 US4 (T091): the parts of the Queue Manager — the card and the table (legacy's columns,
// "address (reason)", sortable headers), the delete-all dialog (count read when it opens, typed
// count and acknowledgement), the content viewer (plain text, the first view, the complete copy,
// discarded on close, a message that left the queue) and the Postfix-stopped notice.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { queryKeys, type MailQueueMessage } from '@/api'
import MailServiceStopped from '@/features/operations/mail-queue/components/MailServiceStopped.vue'
import MessageContentViewer from '@/features/operations/mail-queue/components/MessageContentViewer.vue'
import PurgeQueueDialog from '@/features/operations/mail-queue/components/PurgeQueueDialog.vue'
import QueueMessageCard from '@/features/operations/mail-queue/components/QueueMessageCard.vue'
import QueueMessageTable from '@/features/operations/mail-queue/components/QueueMessageTable.vue'
import { FIRST_VIEW_LENGTH } from '@/features/operations/mail-queue/content'
import { liveMessages } from '@/shared/composables/useAnnouncer'

import { mockState, useScenario } from '../../../../mocks/node'
import { installMatchMedia } from '../../../support/media'
import { mountWithApp, testPlugins } from '../../../support/mount'

const settle = (check: () => void) => vi.waitFor(check, { timeout: 5000 })

const MESSAGE: MailQueueMessage = {
  id: '4F2A1B3C9D',
  queue: 'deferred',
  arrivalTime: '2026-10-19T06:00:00Z',
  sizeBytes: 18_432,
  sender: '',
  recipients: [
    { address: 'carol@partner.example', deferralReason: 'Connection timed out' },
    { address: 'dave@partner.example', deferralReason: null },
    { address: '<b>x</b>@example.net', deferralReason: null },
  ],
  forcedExpiry: true,
}

function router() {
  return createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [
      {
        path: '/operations/mail-queue',
        name: 'operations-mail-queue',
        component: { render: () => null },
      },
      {
        path: '/operations/mail-queue/messages/:queueId',
        name: 'operations-mail-queue-message',
        component: { render: () => null },
      },
      {
        path: '/operations/containers/:containerName',
        name: 'operations-container',
        component: { render: () => null },
      },
    ],
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('QueueMessageCard', () => {
  it('names the message by its QID and shows the first recipient with the rest behind "+ n more"', async () => {
    const wrapper = mountWithApp(QueueMessageCard, {
      props: { message: MESSAGE, show: '/operations/mail-queue/messages/4F2A1B3C9D' },
      global: { plugins: [router()] },
    })
    await flushPromises()
    expect(wrapper.get('h3').text()).toBe('4F2A1B3C9D')
    expect(wrapper.get('[data-queue-name]').text()).toBe('deferred')
    expect(wrapper.get('[data-first-recipient]').text()).toBe(
      'carol@partner.example (Connection timed out)',
    )
    expect(wrapper.get('summary').text()).toBe('+ 2 more')
    expect(wrapper.find('b').exists()).toBe(false)
    expect(wrapper.text()).toContain('<b>x</b>@example.net')
    expect(wrapper.text()).toContain('18 KiB')
    expect(wrapper.text()).not.toMatch(/forced|expir/i)
    const link = wrapper.get('[data-show-message]')
    expect(link.text()).toBe('Show message')
    expect(link.attributes('aria-describedby')).toBe(wrapper.get('h3').attributes('id'))
  })
})

describe('QueueMessageTable', () => {
  it("has legacy's columns, sortable headers and every recipient with its reason", async () => {
    const wrapper = mountWithApp(QueueMessageTable, {
      props: {
        messages: [MESSAGE],
        sort: 'arrivalTime',
        order: 'asc',
        show: () => '/operations/mail-queue/messages/4F2A1B3C9D',
      },
      global: { plugins: [router()] },
    })
    await flushPromises()
    const headers = wrapper.findAll('thead th').map((th) => th.text().replace(/[▲▼]/g, '').trim())
    expect(headers).toEqual([
      'QID',
      'Queue',
      'Arrival time (server time)',
      'Message size',
      'Sender',
      'Recipients',
      'Action',
    ])
    const sorted = wrapper.findAll('thead th[aria-sort]').map((th) => th.attributes('aria-sort'))
    expect(sorted).toEqual(['none', 'none', 'ascending', 'none', 'none'])
    expect(wrapper.findAll('tbody li').map((li) => li.text())).toEqual([
      'carol@partner.example (Connection timed out)',
      'dave@partner.example',
      '<b>x</b>@example.net',
    ])
    await wrapper.findAll('thead button')[2]!.trigger('click')
    expect(wrapper.emitted('sort')).toEqual([['arrivalTime', 'desc']])
    await wrapper.findAll('thead button')[3]!.trigger('click')
    expect(wrapper.emitted('sort')![1]).toEqual(['size', 'asc'])
  })
})

describe('PurgeQueueDialog', () => {
  async function openPurge() {
    useScenario('admin-operations')
    const open = ref(false)
    const confirmed = vi.fn()
    const Host = defineComponent({
      setup: () => () =>
        h(PurgeQueueDialog, {
          open: open.value,
          'onUpdate:open': (value: boolean) => (open.value = value),
          onConfirm: confirmed,
        }),
    })
    const wrapper = mountWithApp(Host, { attachTo: document.body })
    open.value = true
    await flushPromises()
    await settle(() => expect(document.querySelector('[data-purge-count]')).not.toBeNull())
    return { wrapper, open, confirmed }
  }

  it('reads the count when it opens and stays disabled until the count is typed and ticked', async () => {
    const { wrapper, open, confirmed } = await openPurge()
    const dialog = document.querySelector<HTMLElement>('[data-purge-dialog]')!
    expect(dialog.textContent).toContain('Confirm deletion')
    expect(dialog.textContent).toContain(
      'Please confirm you want to delete all items from the current queue.',
    )
    expect(dialog.querySelector('[data-purge-count]')!.textContent).toContain(
      '8 messages are queued, including held ones.',
    )
    expect(
      mockState().requests.some(
        (r) => r.operationId === 'listMailQueueMessages' && r.path.includes('limit=1'),
      ),
    ).toBe(true)
    const remove = [...dialog.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Delete now'),
    )!
    expect(remove.disabled).toBe(true)
    const input = dialog.querySelector<HTMLInputElement>('input[type="text"]')!
    input.value = '8'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    expect(remove.disabled).toBe(true)
    dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()
    await nextTick()
    expect(remove.disabled).toBe(false)
    remove.click()
    await nextTick()
    expect(confirmed).toHaveBeenCalledWith(8)
    expect(open.value).toBe(false)
    wrapper.unmount()
  })

  it('closes with Escape without confirming', async () => {
    const { wrapper, open, confirmed } = await openPurge()
    document
      .querySelector('[data-purge-dialog]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(open.value).toBe(false)
    expect(confirmed).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})

describe('MessageContentViewer', () => {
  async function openViewer(id: string, scenario = 'ops-queue') {
    installMatchMedia({ '(min-width: 768px)': true })
    useScenario(scenario)
    const wrapper = mountWithApp(MessageContentViewer, {
      props: { queueId: id },
      attachTo: document.body,
    })
    await flushPromises()
    return wrapper
  }

  it('shows the content as plain text with the audit notice and copies it whole', async () => {
    const write = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: write } })
    const wrapper = await openViewer('4F2A1B3C9D')
    await settle(() => expect(document.querySelector('[data-message-content]')).not.toBeNull())
    const dialog = document.querySelector('[data-content-viewer]')!
    expect(dialog.textContent).toContain('ID 4F2A1B3C9D')
    expect(dialog.textContent).toContain('Each view of a message is recorded in the audit log.')
    const content = dialog.querySelector('[data-message-content]')!
    expect(content.querySelector('script, b')).toBeNull()
    expect(content.textContent).toContain('<script>alert(1)</script>')
    expect(content.querySelector('[data-plain-text]')!.className).toContain('whitespace-pre-wrap')
    ;[...dialog.querySelectorAll('button')].find((b) => b.textContent?.includes('Copy'))!.click()
    await settle(() => expect(write).toHaveBeenCalled())
    expect((write.mock.calls[0] as unknown as string[])[0]).toContain('<script>alert(1)</script>')
    await settle(() => expect(liveMessages.polite.value).toBe('Text copied to clipboard!'))
    wrapper.unmount()
    expect(
      testPlugins().queryClient.getQueryData(queryKeys.mailQueue.content('4F2A1B3C9D')),
    ).toBeUndefined()
  })

  it('renders the first 256 Ki characters of a large message, then the rest on request', async () => {
    const write = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: write } })
    const wrapper = await openViewer('C2739415A6')
    await settle(() => expect(document.querySelector('[data-show-rest]')).not.toBeNull())
    const content = () => document.querySelector('[data-message-content]')!.textContent.length
    expect(content()).toBeLessThanOrEqual(FIRST_VIEW_LENGTH)
    expect(document.querySelector('[data-show-rest]')!.textContent).toMatch(
      /Show the rest \(.+MiB\)/,
    )
    ;[...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Copy'))!.click()
    await settle(() => expect(write).toHaveBeenCalled())
    expect((write.mock.calls[0] as unknown as string[])[0]).toHaveLength(10 * 1024 * 1024)
    document.querySelector<HTMLElement>('[data-show-rest]')!.click()
    await flushPromises()
    expect(content()).toBe(10 * 1024 * 1024)
    expect(document.querySelector('[data-show-rest]')).toBeNull()
    wrapper.unmount()
  })

  it('says when the message left the queue', async () => {
    const wrapper = await openViewer('7D2E4F6031', 'ops-queue-vanishing')
    await settle(() =>
      expect(document.body.textContent).toContain('This message is no longer in the queue.'),
    )
    wrapper.unmount()
  })
})

describe('MailServiceStopped', () => {
  it('names the container and links to its card', async () => {
    const wrapper = mountWithApp(MailServiceStopped, {
      props: { container: 'postfix-mailcow' },
      global: { plugins: [router()] },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('The Postfix container postfix-mailcow is not running.')
    const link = wrapper.get('a')
    expect(link.text()).toBe('Show postfix-mailcow on the dashboard')
    expect(link.attributes('href')).toBe('/ng/operations/containers/postfix-mailcow')
  })

  it('renders no link while the container address does not exist', async () => {
    const plain = createRouter({
      history: createMemoryHistory('/ng/'),
      routes: [{ path: '/', component: { render: () => null } }],
    })
    const wrapper = mountWithApp(MailServiceStopped, {
      props: { container: 'postfix-mailcow' },
      global: { plugins: [plain] },
    })
    await flushPromises()
    expect(wrapper.find('a').exists()).toBe(false)
  })
})
