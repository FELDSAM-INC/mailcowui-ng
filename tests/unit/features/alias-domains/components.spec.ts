// The domain alias list entry and the target field (T063): the card shows the classic table's
// columns (name, target with its link and legacy's relay badge, active) and the entry menu slot;
// the target field disables relay domains with legacy's reason.
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import AliasDomainCard from '@/features/alias-domains/components/AliasDomainCard.vue'
import TargetDomainField from '@/features/alias-domains/components/TargetDomainField.vue'
import { loadLegacy, resetLegacy } from '@/i18n/legacy'

import { useScenario } from '../../../mocks/node'
import { mountWithApp } from '../../support/mount'
import { aliasDomain } from './alias-domain-fixture'

const router = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { render: () => null } },
      {
        path: '/alias-domains/:aliasDomain',
        name: 'alias-domain-detail',
        component: { render: () => null },
      },
      { path: '/domains/:domain', name: 'domain-detail', component: { render: () => null } },
    ],
  })

beforeEach(async () => {
  await loadLegacy('en-gb')
})
afterEach(() => resetLegacy())

describe('AliasDomainCard', () => {
  it('shows the name, the linked target, active and the relay badge', () => {
    const wrapper = mountWithApp(AliasDomainCard, {
      props: { aliasDomain: aliasDomain({ targetIsRelayDomain: true }), linkDomains: true },
      slots: { actions: '<button>menu</button>' },
      global: { plugins: [router()] },
    })
    expect(wrapper.get('[data-entry="example.net"]').text()).toContain('example.net')
    expect(wrapper.get('a[href="/domains/example.org"]').text()).toBe('example.org')
    expect(wrapper.text()).toContain('Alias domain inactive for relay domain')
    expect(wrapper.text()).toContain('Active')
    expect(wrapper.text()).toContain('menu')
  })

  it('shows the target as text when the domain screen is not available', () => {
    const wrapper = mountWithApp(AliasDomainCard, {
      props: { aliasDomain: aliasDomain(), linkDomains: false },
      global: { plugins: [router()] },
    })
    expect(wrapper.find('a[href="/domains/example.org"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Alias domain inactive for relay domain')
  })
})

describe('TargetDomainField', () => {
  it("offers relay domains disabled with legacy's reason", async () => {
    useScenario('alias-domains-admin')
    const wrapper = mountWithApp(TargetDomainField, {
      props: { id: 'target', labelKey: 'add.target_domain', modelValue: null },
      attachTo: document.body,
    })
    const input = wrapper.get('input')
    await input.trigger('focus')
    await input.setValue('relay')
    await new Promise((resolve) => setTimeout(resolve, 400))
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 50))
    await flushPromises()
    const option = wrapper
      .findAll('[role="option"]')
      .find((item) => item.text().includes('relay.example'))
    expect(option?.attributes('aria-disabled')).toBe('true')
    expect(option?.text()).toContain('Target domain relay.example is a relay domain')
    wrapper.unmount()
  })
})
