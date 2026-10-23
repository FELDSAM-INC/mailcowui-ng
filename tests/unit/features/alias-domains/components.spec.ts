// The domain alias list entry and the target field (T063): the card shows the classic table's
// columns (name, target with its link and legacy's relay badge, active) and the entry menu slot;
// the target field disables relay domains with legacy's reason; the entry menu offers Edit and Remove.
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import AliasDomainCard from '@/features/alias-domains/components/AliasDomainCard.vue'
import AliasDomainEntryActions from '@/features/alias-domains/components/AliasDomainEntryActions.vue'
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
  it('shows the name, the plain target, active and the relay badge', () => {
    const wrapper = mountWithApp(AliasDomainCard, {
      props: { aliasDomain: aliasDomain({ targetIsRelayDomain: true }), linkDomains: true },
      slots: { actions: '<button>menu</button>' },
      global: { plugins: [router()] },
    })
    expect(wrapper.get('[data-entry="example.net"]').text()).toContain('example.net')
    expect(wrapper.text()).toContain('example.org')
    expect(wrapper.find('a[href="/domains/example.org"]').exists()).toBe(false)
    expect(wrapper.attributes('data-row-href')).toBe('/alias-domains/example.net')
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

describe('AliasDomainEntryActions', () => {
  async function openMenu() {
    const testRouter = router()
    await testRouter.push('/')
    const wrapper = mountWithApp(AliasDomainEntryActions, {
      props: { aliasDomain: aliasDomain() },
      global: { plugins: [testRouter] },
      attachTo: document.body,
    })
    const trigger = wrapper.get('button')
    expect(trigger.attributes('aria-label')).toBe('Actions for example.net')
    await trigger.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    const items = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    return { wrapper, router: testRouter, items }
  }

  it('offers Edit, which opens the alias domain with its section open', async () => {
    const { wrapper, router: testRouter, items } = await openMenu()
    expect(items.map((item) => item.textContent?.trim())).toEqual(['Edit', 'Remove'])
    items[0]!.click()
    await vi.waitFor(() =>
      expect(testRouter.currentRoute.value.fullPath).toBe(
        '/alias-domains/example.net?edit=general',
      ),
    )
    wrapper.unmount()
  })

  it('emits the deletion once the menu has closed', async () => {
    const { wrapper, items } = await openMenu()
    items[1]!.click()
    await vi.waitFor(() => expect(wrapper.emitted('delete')).toHaveLength(1))
    expect((wrapper.emitted('delete')![0]![0] as { name: string }).name).toBe('example.net')
    wrapper.unmount()
  })
})
