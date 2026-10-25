// UI 011 US5 (FR-063, FR-067, FR-073, FR-074, FR-017): the Fail2ban page in legacy's panel order,
// its loading, its own errors per part, the notice of a stopped ban service, the open section in
// the address, and "Restart netfilter" beside the parameters for the ban service container.
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import Fail2banPage from '@/features/operations/fail2ban/pages/Fail2banPage.vue'

import { mockState, useScenario } from '../../../../mocks/node'
import type { ScenarioOverrides } from '../../../../mocks/scenarios/state'
import { installMatchMedia } from '../../../support/media'
import { mountWithApp } from '../../../support/mount'
import { createTestRouter } from '../../../support/router'

const settle = (check: () => void) => vi.waitFor(check, { timeout: 10_000 })
const count = (operationId: string) =>
  mockState().requests.filter((request) => request.operationId === operationId).length

let unmount: (() => void) | null = null
afterEach(() => {
  unmount?.()
  unmount = null
})

async function openPage(scenario = 'ops-fail2ban', overrides?: ScenarioOverrides) {
  installMatchMedia({ '(min-width: 768px)': true })
  useScenario(scenario, overrides)
  const router = createTestRouter()
  await router.push('/operations/fail2ban')
  await router.isReady()
  const wrapper = mountWithApp(Fail2banPage, {
    attachTo: document.body,
    global: { plugins: [router] },
  })
  unmount = () => wrapper.unmount()
  return { wrapper, router }
}

describe('Fail2banPage', { timeout: 30_000 }, () => {
  it('loads, then shows the parameters, the regex filters and the ban list in legacy order', async () => {
    const { wrapper } = await openPage()
    expect(wrapper.text()).toContain('Loading...')
    await settle(() => expect(wrapper.find('[data-parameters]').exists()).toBe(true))
    await settle(() => expect(wrapper.find('[data-rules]').exists()).toBe(true))
    expect(wrapper.get('h1').text()).toBe('Fail2ban parameters')
    // Inspect document order directly; formatting the entire page is unnecessary here
    // and matching formatted HTML fragments can silently compare three missing (-1) offsets.
    const sections = wrapper.findAll('[data-parameters], [data-rules], [data-ban-list]')
    expect(
      sections.map((section) =>
        ['parameters', 'rules', 'ban-list'].find(
          (name) => section.attributes(`data-${name}`) !== undefined,
        ),
      ),
    ).toEqual(['parameters', 'rules', 'ban-list'])
    expect(wrapper.find('[data-ban-service-stopped]').exists()).toBe(false)
  })

  it('offers "Restart netfilter" for the ban service container beside the parameters', async () => {
    const { wrapper } = await openPage()
    await settle(() =>
      expect(
        wrapper.findAll('button').some((button) => button.text() === 'Restart netfilter'),
      ).toBe(true),
    )
    expect(count('listContainers')).toBeGreaterThan(0)
  })

  it('says when the ban service is not running', async () => {
    const { wrapper } = await openPage('ops-fail2ban-not-running')
    await settle(() =>
      expect(wrapper.get('[data-ban-service-stopped]').text()).toBe(
        'The ban service is not running. Saved changes take effect, and queued unbans are processed, once it runs.',
      ),
    )
  })

  it('opens the parameters for editing through the address, and closes them again', async () => {
    const { wrapper, router } = await openPage()
    await settle(() => expect(wrapper.find('[data-parameters]').exists()).toBe(true))
    await wrapper.get('button[aria-label="Edit Fail2ban parameters"]').trigger('click')
    await settle(() => expect(router.currentRoute.value.query.edit).toBe('parameters'))
    await settle(() => expect(wrapper.find('#f2b-banTime').exists()).toBe(true))
    const cancel = wrapper.findAll('button').find((button) => button.text() === 'Cancel')!
    await cancel.trigger('click')
    await settle(() => expect(router.currentRoute.value.query.edit).toBeUndefined())
  })

  it('shows the settings error with a retry, and nothing else', async () => {
    const { wrapper } = await openPage('ops-fail2ban', {
      operations: {
        inject: { getFail2BanSettings: { status: 503, problemType: 'temporary-failure' } },
      },
    })
    await settle(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true))
    expect(wrapper.find('[data-parameters]').exists()).toBe(false)
    const before = count('getFail2BanSettings')
    delete mockState().operations.inject.getFail2BanSettings
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Try again')!
      .trigger('click')
    await settle(() => expect(count('getFail2BanSettings')).toBeGreaterThan(before))
    await settle(() => expect(wrapper.find('[data-parameters]').exists()).toBe(true))
  })

  it('shows the rules error on its own, with a retry', async () => {
    const { wrapper } = await openPage('ops-fail2ban', {
      operations: {
        inject: { getFail2BanRules: { status: 503, problemType: 'temporary-failure' } },
      },
    })
    await settle(() => expect(wrapper.find('[data-parameters]').exists()).toBe(true))
    await settle(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true))
    expect(wrapper.find('[data-rules]').exists()).toBe(false)
    delete mockState().operations.inject.getFail2BanRules
    const retry = wrapper.findAll('button').find((button) => button.text() === 'Try again')!
    await retry.trigger('click')
    await settle(() => expect(wrapper.find('[data-rules]').exists()).toBe(true))
    await flushPromises()
  })
})
