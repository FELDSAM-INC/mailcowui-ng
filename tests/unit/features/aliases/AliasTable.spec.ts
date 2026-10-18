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
  it('has the classic columns with aria-sort on the sortable ones', async () => {
    const wrapper = mountTable(true)
    const headers = wrapper.findAll('th')
    const text = headers.map((header) => header.text())
    for (const label of [
      'ID',
      'Alias',
      'Goto address',
      'Domain',
      'Alias is visible in SOGo',
      'Public comment',
      'Private comment',
      'Internal',
      'Active',
    ]) {
      expect(text.some((item) => item.startsWith(label))).toBe(true)
    }
    const sortable = headers.filter((header) => header.attributes('aria-sort') !== undefined)
    expect(sortable.map((header) => header.text().replace(/[▲▼]/g, '').trim())).toEqual([
      'ID',
      'Alias',
      'Domain',
      'Alias is visible in SOGo',
      'Internal',
      'Active',
    ])
    expect(headers.find((header) => header.text().startsWith('ID'))!.attributes('aria-sort')).toBe(
      'descending',
    )
    await headers
      .find((header) => header.text().startsWith('Alias'))!
      .get('button')
      .trigger('click')
    expect(wrapper.emitted('sort')?.[0]).toEqual(['address', 'asc'])
  })

  it('has no groupware column while the groupware is disabled', () => {
    expect(mountTable(false).text()).not.toContain('SOGo')
  })
})
