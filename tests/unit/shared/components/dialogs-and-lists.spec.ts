// Shared dialogs, list states and small display components (FR-078, FR-082, FR-087, FR-089,
// research R17, R20).
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import { ApiProblem } from '@/api'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import DateTime from '@/shared/components/DateTime.vue'
import ListState from '@/shared/components/ListState.vue'
import LiveAnnouncer from '@/shared/components/LiveAnnouncer.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import RelativeTime from '@/shared/components/RelativeTime.vue'
import SanitizedHtml from '@/shared/components/SanitizedHtml.vue'
import { useAnnouncer } from '@/shared/composables/useAnnouncer'
import { useConfirm } from '@/shared/composables/useConfirm'

import { mountWithApp } from '../../support/mount'

describe('ConfirmDialog and useConfirm', () => {
  function mountHost() {
    let confirm!: ReturnType<typeof useConfirm>
    const Host = defineComponent({
      setup() {
        confirm = useConfirm()
        return () => h('div', [h('button', { id: 'trigger' }, 'Remove'), h(ConfirmDialog)])
      },
    })
    const wrapper = mountWithApp(Host, { attachTo: document.body })
    return { wrapper, confirm: () => confirm }
  }

  it('resolves true when confirmed, as an alertdialog', async () => {
    const { wrapper, confirm } = mountHost()
    const answer = confirm()({
      title: 'Remove the passkey?',
      description: 'You can no longer sign in with it.',
      confirmLabel: 'Remove',
      destructive: true,
    })
    await flushPromises()
    const dialog = document.querySelector('[role="alertdialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog?.textContent).toContain('Remove the passkey?')
    expect(dialog?.textContent).toContain('You can no longer sign in with it.')
    const confirmButton = [...document.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Remove' && button.id !== 'trigger',
    )
    confirmButton?.click()
    await expect(answer).resolves.toBe(true)
    wrapper.unmount()
  })

  it('resolves false on cancel and on Escape', async () => {
    const { wrapper, confirm } = mountHost()
    const first = confirm()({ title: 'Revoke?', confirmLabel: 'Revoke' })
    await flushPromises()
    const cancel = [...document.querySelectorAll('[role="alertdialog"] button')].find(
      (button) => button.textContent?.trim() === 'Cancel',
    ) as HTMLButtonElement
    cancel.click()
    await expect(first).resolves.toBe(false)

    const second = confirm()({ title: 'Revoke?', confirmLabel: 'Revoke' })
    await flushPromises()
    const dialog = document.querySelector('[role="alertdialog"]') as HTMLElement
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await expect(second).resolves.toBe(false)
    wrapper.unmount()
  })

  it('returns focus to the element that was focused before', async () => {
    const { wrapper, confirm } = mountHost()
    const trigger = document.getElementById('trigger') as HTMLButtonElement
    trigger.focus()
    const answer = confirm()({ title: 'Revoke?', confirmLabel: 'Revoke' })
    await flushPromises()
    expect(document.activeElement).not.toBe(trigger)
    const cancel = [...document.querySelectorAll('[role="alertdialog"] button')].find(
      (button) => button.textContent?.trim() === 'Cancel',
    ) as HTMLButtonElement
    cancel.click()
    await answer
    await flushPromises()
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
    wrapper.unmount()
  })
})

describe('ListState (FR-089)', () => {
  it('shows a loading state', () => {
    const wrapper = mountWithApp(ListState, {
      props: { loading: true, empty: false, problem: null },
    })
    // The classic interface's DataTables text (`datatables.loadingRecords`).
    expect(wrapper.get('[role="status"]').text()).toContain('Loading...')
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true)
  })

  it('shows the empty state with its message', () => {
    const wrapper = mountWithApp(ListState, {
      props: { loading: false, empty: true, problem: null, emptyText: 'No passkeys yet.' },
      slots: { default: '<ul id="items"></ul>' },
    })
    expect(wrapper.text()).toContain('No passkeys yet.')
    expect(wrapper.find('#items').exists()).toBe(false)
  })

  it('shows the error with a retry', async () => {
    const wrapper = mountWithApp(ListState, {
      props: { loading: false, empty: false, problem: ApiProblem.fromParts({ kind: 'network' }) },
    })
    expect(wrapper.get('[role="alert"]').text()).toContain('The list could not be loaded.')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('shows the content when ready', () => {
    const wrapper = mountWithApp(ListState, {
      props: { loading: false, empty: false, problem: null },
      slots: { default: '<ul id="items"><li>one</li></ul>' },
    })
    expect(wrapper.find('#items').exists()).toBe(true)
  })
})

describe('PaginationBar', () => {
  it('shows the range and total, and page sizes 25, 50 and 100, in DataTables words', () => {
    const wrapper = mountWithApp(PaginationBar, { props: { total: 1200, page: 2, size: 25 } })
    expect(wrapper.text()).toContain('Showing 26 to 50 of 1,200 entries')
    const options = wrapper.findAll('select option').map((option) => option.text())
    expect(options).toEqual(['25', '50', '100'])
    // "Show _MENU_ entries" with the select in the place of _MENU_, as the select's label.
    const label = wrapper.get('select').element.labels?.[0]
    expect(label?.textContent?.replace(/\s+/g, ' ')).toMatch(/^Show 25 ?50 ?100 entries$/)
    expect(wrapper.get('nav').attributes('aria-label')).toBe('Pagination')
  })

  it('moves between pages with buttons operable by keyboard', async () => {
    const wrapper = mountWithApp(PaginationBar, { props: { total: 120, page: 1, size: 50 } })
    const previous = wrapper.get('button[aria-label="Previous"]')
    const next = wrapper.get('button[aria-label="Next"]')
    expect(previous.attributes('disabled')).toBeDefined()
    expect(next.element.tagName).toBe('BUTTON')
    await next.trigger('click')
    expect(wrapper.emitted('update:page')).toEqual([[2]])
    expect(wrapper.text()).toContain('Page 1 of 3')
  })

  it('disables next on the last page and changes the page size', async () => {
    const wrapper = mountWithApp(PaginationBar, { props: { total: 120, page: 3, size: 50 } })
    expect(wrapper.get('button[aria-label="Next"]').attributes('disabled')).toBeDefined()
    await wrapper.get('select').setValue('100')
    expect(wrapper.emitted('update:size')).toEqual([[100]])
  })

  it('reads well for an empty list', () => {
    const wrapper = mountWithApp(PaginationBar, { props: { total: 0, page: 1, size: 25 } })
    expect(wrapper.text()).toContain('Showing 0 to 0 of 0 entries')
  })
})

describe('LiveAnnouncer and useAnnouncer', () => {
  it('has a polite and an assertive region and announces into them', async () => {
    let announcer!: ReturnType<typeof useAnnouncer>
    const Host = defineComponent({
      setup() {
        announcer = useAnnouncer()
        return () => h(LiveAnnouncer)
      },
    })
    const wrapper = mountWithApp(Host)
    const polite = wrapper.get('[data-live="polite"]')
    const assertive = wrapper.get('[data-live="assertive"]')
    expect(polite.attributes('aria-live')).toBe('polite')
    expect(assertive.attributes('aria-live')).toBe('assertive')
    announcer.announce('Saved')
    announcer.announce('Could not save', { assertive: true })
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(polite.text()).toBe('Saved')
    expect(assertive.text()).toBe('Could not save')
    // The same text again is announced again.
    announcer.announce('Saved')
    await nextTick()
    expect(polite.text()).toBe('')
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(polite.text()).toBe('Saved')
  })
})

describe('SanitizedHtml', () => {
  it('renders sanitised HTML only', () => {
    const wrapper = mountWithApp(SanitizedHtml, {
      props: {
        html: '<p>Hello <strong>you</strong></p><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a><a href="https://example.org">ok</a>',
      },
    })
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('strong').text()).toBe('you')
    const links = wrapper.findAll('a')
    expect(links.map((link) => link.attributes('href'))).toEqual([undefined, 'https://example.org'])
    expect(links[1]?.attributes('rel')).toBe('noopener noreferrer nofollow')
  })

  it('renders nothing for empty content', () => {
    const wrapper = mountWithApp(SanitizedHtml, { props: { html: null } })
    expect(wrapper.find('div').exists()).toBe(false)
  })
})

describe('DateTime and RelativeTime (FR-087)', () => {
  const INSTANT = '2026-10-18T12:05:00Z'
  let tz: string | undefined

  beforeEach(() => {
    tz = process.env.TZ
    process.env.TZ = 'UTC'
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.parse('2026-10-18T12:10:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    if (tz === undefined) delete process.env.TZ
    else process.env.TZ = tz
  })

  it('renders an absolute time in a <time datetime> element', () => {
    const wrapper = mountWithApp(DateTime, { props: { value: INSTANT } })
    const time = wrapper.get('time')
    expect(time.attributes('datetime')).toBe('2026-10-18T12:05:00.000Z')
    expect(time.text()).toBe('18 Oct 2026, 12:05')
  })

  it('renders a relative time with the absolute time available', () => {
    const wrapper = mountWithApp(RelativeTime, { props: { value: INSTANT } })
    const time = wrapper.get('time')
    expect(time.attributes('datetime')).toBe('2026-10-18T12:05:00.000Z')
    expect(time.attributes('title')).toBe('18 Oct 2026, 12:05')
    expect(time.text()).toContain('5 minutes ago')
    expect(wrapper.get('.sr-only').text()).toContain('18 Oct 2026, 12:05')
  })
})
