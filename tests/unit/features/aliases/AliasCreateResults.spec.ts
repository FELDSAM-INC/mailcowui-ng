// The per-address results of a multi-address creation (T043, FR-021): created with legacy's message
// and a link, refused with its reason, not processed; announced and focused.
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiProblem } from '@/api'
import AliasCreateResults from '@/features/aliases/components/AliasCreateResults.vue'
import { loadLegacy, resetLegacy } from '@/i18n/legacy'
import * as announcer from '@/shared/composables/useAnnouncer'

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

describe('AliasCreateResults', () => {
  it('lists each address with its outcome and announces them', async () => {
    const announce = vi.spyOn(announcer, 'announce')
    const wrapper = mountWithApp(AliasCreateResults, {
      attachTo: document.body,
      props: {
        results: [
          {
            entry: { value: 'info@example.org', index: 0 },
            outcome: 'created',
            data: alias({ id: 9, address: 'info@example.org' }),
          },
          {
            entry: { value: 'sales@example.org', index: 1 },
            outcome: 'refused',
            problem: ApiProblem.fromParts({ kind: 'problem', status: 409 }),
          },
          { entry: { value: 'office@example.org', index: 2 }, outcome: 'notProcessed' },
        ],
        message: () => 'sales@example.org is already known as an alias address',
      },
      global: { plugins: [router] },
    })
    await flushPromises()
    const items = wrapper.findAll('li')
    expect(items[0]!.get('a').text()).toBe('Alias address info@example.org (9) has been added')
    expect(items[0]!.get('a').attributes('href')).toBe('/aliases/9')
    expect(items[1]!.text()).toContain('sales@example.org is already known as an alias address')
    expect(items[2]!.text()).toContain('Not processed')
    expect(document.activeElement).toBe(wrapper.get('[data-create-results]').element)
    expect(announce).toHaveBeenCalled()
    wrapper.unmount()
  })
})
