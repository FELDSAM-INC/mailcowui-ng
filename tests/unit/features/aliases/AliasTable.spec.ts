// The alias table (T033, FR-007, FR-014): the classic columns, and aria-sort only on the contract's
// sort keys, the groupware column only with the groupware.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import AliasTable from '@/features/aliases/components/AliasTable.vue'
import { loadLegacy, resetLegacy } from '@/i18n/legacy'

import { mountWithApp } from '../../support/mount'
import { alias } from './alias-fixture'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { render: () => null } },
    { path: '/aliases/:aliasId', name: 'alias-detail', component: { render: () => null } },
  ],
})

beforeEach(async () => {
  await loadLegacy('en-gb')
})
afterEach(() => resetLegacy())

const mountTable = (groupwareEnabled: boolean | undefined) =>
  mountWithApp(AliasTable, {
    props: {
      aliases: [alias()],
      sort: 'id',
      order: 'desc',
      groupwareEnabled,
      canSeeOrphaned: true,
    },
    global: { plugins: [router] },
  })

describe('AliasTable', () => {
  it('keeps primary columns sortable and secondary values collapsed behind the final control', async () => {
    const wrapper = mountTable(true)
    const headers = wrapper.findAll('th')
    expect(headers.map((header) => header.text().replace(/[▲▼]/g, '').trim())).toEqual([
      'ID',
      'Alias',
      'Goto address',
      'Domain',
      'Allow to send as this alias',
      'Action',
    ])
    const row = wrapper.get('tbody tr[data-entry]')
    expect(row.find('[data-field="internal"]').exists()).toBe(false)
    expect(wrapper.find('[data-entry-details]').exists()).toBe(false)
    const expand = row.get('td:last-child [data-row-expand]')
    expect(expand.attributes('aria-expanded')).toBe('false')
    await expand.trigger('click')
    expect(expand.attributes('aria-expanded')).toBe('true')
    const details = wrapper.get('[data-entry-details]')
    expect(details.text()).toContain('Alias is visible in SOGo')
    expect(details.text()).toContain('Public comment')
    expect(details.text()).toContain('Private comment')
    expect(details.find('[data-field="internal"]').exists()).toBe(true)
    expect(Number(details.element.closest('td')?.getAttribute('colspan'))).toBe(
      row.findAll('td').length,
    )
    await expand.trigger('click')
    expect(wrapper.find('[data-entry-details]').exists()).toBe(false)
    expect(headers[0]!.attributes('aria-sort')).toBe('descending')
    await headers[1]!.get('button').trigger('click')
    expect(wrapper.emitted('sort')?.[0]).toEqual(['address', 'asc'])
  })

  it('has no groupware field in expanded details while groupware is disabled', async () => {
    const wrapper = mountTable(false)
    await wrapper.get('[data-row-expand]').trigger('click')
    expect(wrapper.text()).not.toContain('SOGo')
  })
})
