// The outcomes of "Expand alias over alias domains" (T083, research R12; legacy form map part 2):
// one line per alias domain with legacy's message, the created copy linked, the skipped reasons,
// a failure's message, and the empty list.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { AliasCopyOutcome } from '@/api'
import CopyResults from '@/features/aliases/components/CopyResults.vue'
import { loadLegacy, resetLegacy } from '@/i18n/legacy'

import { mountWithApp } from '../../support/mount'

const copy = (overrides: Partial<AliasCopyOutcome>): AliasCopyOutcome => ({
  address: 'sales@example.com',
  addressUnicode: 'sales@example.com',
  aliasDomain: 'example.com',
  aliasDomainUnicode: 'example.com',
  aliasId: null,
  outcome: 'skipped',
  reason: null,
  ...overrides,
})

const router = () =>
  createRouter({
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

describe('CopyResults', () => {
  it("shows each alias domain's outcome with legacy's message", () => {
    const wrapper = mountWithApp(CopyResults, {
      props: {
        copies: [
          copy({ outcome: 'created', aliasId: 40, reason: null }),
          copy({
            address: 'sales@example.net',
            addressUnicode: 'sales@example.net',
            reason: 'addressInUse',
          }),
          copy({ address: 'sales@example.eu', reason: 'aliasLimitReached' }),
          copy({ address: 'sales@example.de', reason: 'destinationNotPermitted' }),
        ],
      },
      global: { plugins: [router()] },
    })
    const lines = wrapper.findAll('li').map((line) => line.text())
    expect(lines[0]).toBe('Alias address sales@example.com (40) has been added')
    expect(wrapper.find('a[href="/aliases/40"]').exists()).toBe(true)
    expect(lines[1]).toContain('sales@example.net is already known as an alias')
    expect(lines[2]).toBe('Max. aliases exceeded')
    expect(lines[3]).toBe('External goto address sales@example.de is not allowed')
  })

  it('says that nothing was created without alias domains', () => {
    const wrapper = mountWithApp(CopyResults, {
      props: { copies: [] },
      global: { plugins: [router()] },
    })
    expect(wrapper.text()).toBe('This domain has no alias domains, so nothing was created.')
  })
})
