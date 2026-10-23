// The routing list and form building blocks (UI 009 T013, T014): EntryList as table and cards,
// ListToolbar's filters, sort and chips, EntryActions, ScreenIntro's verbatim legacy hint,
// RoutingSectionNav, StatusText and FormActionBar.
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'

import EntryActions from '@/features/routing/components/common/EntryActions.vue'
import EntryList from '@/features/routing/components/common/EntryList.vue'
import FormActionBar from '@/features/routing/components/common/FormActionBar.vue'
import ListToolbar from '@/features/routing/components/common/ListToolbar.vue'
import RoutingSectionNav from '@/features/routing/components/common/RoutingSectionNav.vue'
import ScreenIntro from '@/features/routing/components/common/ScreenIntro.vue'
import StatusText from '@/features/routing/components/common/StatusText.vue'

import { useScenario } from '../../../../mocks/node'
import { installMatchMedia } from '../../../support/media'
import { mountWithApp } from '../../../support/mount'
import { createTestRouter } from '../../../support/router'

interface Row {
  id: number
  name: string
  value: string
}
const rows: Row[] = [
  { id: 1, name: 'alpha.example', value: 'one' },
  { id: 2, name: 'beta.example', value: 'two' },
]
const columns = [
  { key: 'id', label: 'ID', sort: 'id', text: (row: Row) => String(row.id) },
  { key: 'name', label: 'Name', sort: 'name', text: (row: Row) => row.name },
  { key: 'value', label: 'Value', text: (row: Row) => row.value },
]

const setMatchMedia = (wide: boolean) => installMatchMedia({ '(min-width: 768px)': wide })

async function mountList(wide: boolean, props: Record<string, unknown> = {}) {
  setMatchMedia(wide)
  const router = createTestRouter()
  const wrapper = mountWithApp(EntryList, {
    // EntryList is generic; the test rows stand in for its entries. vue-tsc types its props for
    // `unknown` entries, which ESLint's type information does not see.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    props: {
      entries: rows,
      columns,
      idOf: (row: Row) => String(row.id),
      editTo: (row: Row) => `/routing/relayhosts/${row.id}`,
      caption: 'Things',
      actionsLabel: 'Action',
      primary: 'name',
      sort: 'id',
      order: 'asc',
      ...props,
    } as never,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    slots: { actions: ({ entry }: { entry: Row }) => h('button', `act ${entry.id}`) } as never,
    global: { plugins: [router] },
  })
  await flushPromises()
  return wrapper
}

describe('EntryList', () => {
  it('renders a table from md up with aria-sort headers, the link on the primary column and actions', async () => {
    const wrapper = await mountList(true)
    const headers = wrapper.findAll('th')
    expect(headers.map((header) => header.text())).toEqual(['ID ▲', 'Name', 'Value', 'Action'])
    expect(headers[0]!.attributes('aria-sort')).toBe('ascending')
    expect(headers[1]!.attributes('aria-sort')).toBe('none')
    expect(headers[2]!.attributes('aria-sort')).toBeUndefined()
    expect(wrapper.find('[data-entry="1"] a').text()).toBe('alpha.example')
    await headers[1]!.find('button').trigger('click')
    expect(wrapper.emitted('sort')).toEqual([['name', 'asc']])
    await headers[0]!.find('button').trigger('click')
    expect(wrapper.emitted('sort')![1]).toEqual(['id', 'desc'])
    expect(wrapper.text()).toContain('act 2')
  })

  it('renders cards below md with the primary column as heading and every other column', async () => {
    const wrapper = await mountList(false, { selectable: true })
    const card = wrapper.find('[data-entry="2"]')
    expect(card.find('h3').text()).toBe('beta.example')
    expect(card.text()).toContain('ID:')
    expect(card.text()).toContain('Value:')
    expect(wrapper.find('ul').attributes('aria-label')).toBe('Things')
  })
})

describe('ListToolbar', () => {
  it('emits searches, filters, sorts and chip removals', async () => {
    setMatchMedia(false)
    const wrapper = mountWithApp(ListToolbar, {
      props: {
        idPrefix: 't',
        filters: [
          {
            key: 'active',
            label: 'Active',
            kind: 'select',
            options: [{ value: 'true', label: 'Yes' }],
          },
          {
            key: 'policy',
            label: 'Policy',
            kind: 'checks',
            options: [
              { value: 'dane', label: 'dane' },
              { value: 'may', label: 'may' },
            ],
          },
          { key: 'nextHop', label: 'Next hop', kind: 'text' },
        ],
        sorts: [
          { value: 'id', label: 'ID' },
          { value: 'host', label: 'Host' },
        ],
        values: { active: 'true', policy: ['dane'], nextHop: '[mx]:25' },
        search: '',
        sort: 'id',
        order: 'asc',
      },
    })
    const toggle = wrapper.find('button[aria-expanded]')
    expect(toggle.text()).toBe('Filters and sorting')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    await wrapper.find('#t-filter-active').setValue('')
    expect(wrapper.emitted('filter')![0]).toEqual(['active', undefined])
    const checks = wrapper.findAll('input[type="checkbox"]')
    await checks[1]!.setValue(true)
    expect(wrapper.emitted('filter')![1]).toEqual(['policy', ['dane', 'may']])
    await wrapper.find('#t-filter-nextHop').setValue(' relay.net ')
    expect(wrapper.emitted('filter')![2]).toEqual(['nextHop', 'relay.net'])
    await wrapper.find('#t-sort').setValue('host')
    expect(wrapper.emitted('sort')![0]).toEqual(['host', 'asc'])
    await wrapper.find('#t-order').setValue('desc')
    expect(wrapper.emitted('sort')![1]).toEqual(['id', 'desc'])
    const chips = wrapper.findAll('[aria-label^="Remove filter"]')
    expect(chips.map((chip) => chip.text())).toEqual([
      'Active: Yes',
      'Policy: dane',
      'Next hop: [mx]:25',
    ])
    await chips[1]!.trigger('click')
    expect(wrapper.emitted('filter')![3]).toEqual(['policy', []])
  })
})

describe('EntryActions, ScreenIntro, StatusText, FormActionBar', () => {
  it('groups multiple actions in a named menu without row History and emits removal', async () => {
    const router = createTestRouter()
    const wrapper = mountWithApp(EntryActions, {
      props: {
        name: 'relay.example',
        section: 'admin',
        testTo: '/routing',
        editTo: '/routing',
        removable: true,
      },
      global: { plugins: [router] },
      attachTo: document.body,
    })
    await flushPromises()
    expect(wrapper.findAll('button')).toHaveLength(1)
    await wrapper.get('[data-row-action-trigger]').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    const items = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    const labels = items.map((item) => item.getAttribute('aria-label'))
    expect(labels).toEqual(['Test: relay.example', 'Edit: relay.example', 'Remove: relay.example'])
    items.find((item) => item.dataset.action === 'remove')!.click()
    await vi.waitFor(() => expect(wrapper.emitted('remove')).toHaveLength(1))
    wrapper.unmount()
  })

  it('renders a lone action directly without an empty menu or expander', async () => {
    const wrapper = mountWithApp(EntryActions, {
      props: { name: '192.0.2.1', section: 'admin', removable: true },
      global: { plugins: [createTestRouter()] },
    })
    expect(wrapper.find('[data-row-action-trigger]').exists()).toBe(false)
    expect(wrapper.get('button').attributes('aria-label')).toBe('Remove: 192.0.2.1')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('remove')).toHaveLength(1)
    wrapper.unmount()
  })

  it('renders legacy hints with markup through the sanitiser and yes/no as legacy glyphs', () => {
    const intro = mountWithApp(ScreenIntro, { props: { hint: 'mailbox.tls_policy_maps_info' } })
    const link = intro.find('a')
    expect(link.attributes('href')).toBe(
      'http://www.postfix.org/postconf.5.html#smtp_tls_policy_maps',
    )
    expect(link.attributes('target')).toBe('_blank')
    expect(intro.html()).toContain('<br>')
    expect(mountWithApp(StatusText, { props: { value: true } }).text()).toBe('✓Yes')
    expect(mountWithApp(StatusText, { props: { value: false } }).text()).toBe('✕No')
  })

  it('keeps Save and Cancel together in the sticky bar', async () => {
    const router = createTestRouter()
    const wrapper = mountWithApp(FormActionBar, {
      props: { submitLabel: 'Save changes', pending: true, cancelTo: '/routing' },
      global: { plugins: [router] },
    })
    await flushPromises()
    expect(wrapper.find('button[type="submit"]').text()).toBe('Saving…')
    expect(wrapper.find('a').text()).toBe('Cancel')
  })
})

describe('RoutingSectionNav', () => {
  it('links the available screens with aria-current, behind a disclosure below md', async () => {
    useScenario('routing-admin-default')
    setMatchMedia(false)
    const router = createTestRouter()
    const wrapper = mountWithApp(RoutingSectionNav, {
      props: { current: 'relayhosts' },
      global: { plugins: [router] },
    })
    await vi.waitFor(() => expect(wrapper.find('nav').exists()).toBe(true))
    const current = wrapper.find('a[aria-current="page"]')
    expect(current.text()).toBe('Sender-dependent transports')
    const toggle = wrapper.find('button')
    expect(toggle.text()).toBe('Sender-dependent transports')
    expect(wrapper.find('ul').classes()).toContain('hidden')
    await toggle.trigger('click')
    expect(wrapper.find('ul').classes()).toContain('flex')
  })
})
