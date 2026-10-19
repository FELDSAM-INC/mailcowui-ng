// UI 011 US5 (T106): the parts of the Fail2ban screen — the parameters section (legacy order and
// labels, changed values only with If-Match, the client checks, refused list entries by line, the
// own-address warning), the regex filters (limits, a refused rule on its row, the reset and its
// outcomes), an active ban's actions, and the ban list (the denylist confirmation, the rotation).
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { type Fail2BanActiveBan, type Fail2BanRules, type Fail2BanSettings } from '@/api'
import ActiveBanItem from '@/features/operations/fail2ban/components/ActiveBanItem.vue'
import BanListSection from '@/features/operations/fail2ban/components/BanListSection.vue'
import ParametersSection from '@/features/operations/fail2ban/components/ParametersSection.vue'
import RulesSection from '@/features/operations/fail2ban/components/RulesSection.vue'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'

import { mockState, useScenario } from '../../../../mocks/node'
import { defaultMonitoringCapabilities } from '../../../../mocks/scenarios/operations/state'
import { installMatchMedia } from '../../../support/media'
import { mountWithApp, testPlugins } from '../../../support/mount'
import { operationsKeys } from '@/features/operations/query-keys'

const router = () =>
  createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [{ path: '/audit-log', name: 'audit-log', component: { render: () => null } }],
  })

const settle = (check: () => void) => vi.waitFor(check, { timeout: 5000 })
const capabilities = defaultMonitoringCapabilities()

async function readSettings(): Promise<Fail2BanSettings> {
  const response = await fetch('http://localhost/api/v2/fail2ban/settings')
  return ((await response.json()) as { data: Fail2BanSettings }).data
}

async function readRules(): Promise<Fail2BanRules> {
  const response = await fetch('http://localhost/api/v2/fail2ban/rules')
  return ((await response.json()) as { data: Fail2BanRules }).data
}

function lastRequest(operationId: string) {
  return [...mockState().requests].reverse().find((r) => r.operationId === operationId)
}

async function signedIn(scenario = 'ops-fail2ban') {
  installMatchMedia({ '(min-width: 768px)': true })
  useScenario(scenario)
  // The CSRF token comes with the session; the client fetches it before the first write.
  await flushPromises()
}

async function openParameters(scenario = 'ops-fail2ban') {
  await signedIn(scenario)
  const settings = await readSettings()
  testPlugins().queryClient.setQueryData(operationsKeys.fail2ban.settings(), settings)
  const wrapper = mountWithApp(ParametersSection, {
    props: { settings, capabilities, editing: false },
    attachTo: document.body,
    global: { plugins: [router()] },
  })
  await flushPromises()
  return { wrapper, settings }
}

async function edit(wrapper: VueWrapper) {
  await wrapper.setProps({ editing: true })
  await flushPromises()
}

const input = (wrapper: VueWrapper, field: string) => wrapper.get<HTMLInputElement>(`#f2b-${field}`)

describe('ParametersSection', () => {
  it('shows the stored values with the legacy labels in legacy order', async () => {
    const { wrapper } = await openParameters()
    const labels = wrapper.findAll('[data-parameters] dt').map((dt) => dt.text())
    expect(labels).toEqual([
      'Ban time (s)',
      'Max. ban time (s)',
      'Ban time is incremented with each ban',
      'Max. attempts',
      'Retry window (s) for max. attempts',
      'IPv4 subnet size to apply ban on (8-32)',
      'IPv6 subnet size to apply ban on (8-128)',
      'Manage Fail2Ban externally',
    ])
    expect(wrapper.get('[data-value="banTime"]').text()).toBe('1,800')
    expect(wrapper.get('[data-value="ipv4PrefixLength"]').text()).toBe('/32')
    expect(wrapper.get('[data-value="allowlist"]').text()).toContain('office.example.org')
    wrapper.unmount()
  })

  it('sends only the changed values, with If-Match, and says the parameters were saved', async () => {
    const { wrapper, settings } = await openParameters()
    await edit(wrapper)
    expect(input(wrapper, 'banTime').attributes('inputmode')).toBe('numeric')
    await input(wrapper, 'banTime').setValue('7200')
    await wrapper.get('form').trigger('submit')
    await settle(() => expect(lastRequest('updateFail2BanSettings')).toBeDefined())
    const request = lastRequest('updateFail2BanSettings')!
    expect(request.body).toEqual({ banTime: 7200 })
    expect(request.headers['if-match']).toBe(settings.etag)
    expect(request.headers['content-type']).toContain('application/merge-patch+json')
    await settle(() => expect(wrapper.emitted('close')).toBeTruthy())
    wrapper.unmount()
  })

  it('checks the ranges and the maximum against the ban time before sending', async () => {
    const { wrapper } = await openParameters()
    await edit(wrapper)
    await input(wrapper, 'banTime').setValue('30')
    await input(wrapper, 'maxAttempts').setValue('0')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Enter a value from 60 to 2,147,483,647.')
    expect(wrapper.text()).toContain('Enter a value from 1 to 2,147,483,647.')
    await input(wrapper, 'banTime').setValue('3600')
    await input(wrapper, 'maxAttempts').setValue('10')
    await input(wrapper, 'maxBanTime').setValue('1200')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Enter a value from 3,600 (Ban time (s)) to 2,147,483,647.')
    expect(lastRequest('updateFail2BanSettings')).toBeUndefined()
    wrapper.unmount()
  })

  it('names refused list entries by their line and keeps the input', async () => {
    const { wrapper } = await openParameters()
    await edit(wrapper)
    await wrapper.get('#f2b-denylist').setValue('198.51.100.200\n\n0.0.0.0/0\nexample.org')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    const errors = wrapper.get('#f2b-denylist-error').text()
    expect(errors).toContain('Line 3: Invalid network or host: 0.0.0.0/0')
    expect(errors).toContain('Line 4: Invalid network or host: example.org')
    expect((wrapper.get('#f2b-denylist').element as HTMLTextAreaElement).value).toContain(
      '0.0.0.0/0',
    )
    expect(lastRequest('updateFail2BanSettings')).toBeUndefined()
    wrapper.unmount()
  })

  it("warns before saving a denylist entry that covers the caller's own address", async () => {
    const { wrapper } = await openParameters()
    await edit(wrapper)
    await wrapper.get('#f2b-denylist').setValue('198.51.100.200\n198.51.100.0/24')
    await wrapper.get('form').trigger('submit')
    await settle(() => expect(confirmState.value).not.toBeNull())
    expect(confirmState.value!.description).toBe(
      'This entry covers your own address 198.51.100.7. You could lock yourself out.',
    )
    settleConfirm(false)
    await flushPromises()
    expect(lastRequest('updateFail2BanSettings')).toBeUndefined()
    wrapper.unmount()
  })

  it('keeps the input after an outdated save and marks the values changed meanwhile', async () => {
    const { wrapper } = await openParameters('ops-fail2ban-changed-elsewhere')
    await edit(wrapper)
    await input(wrapper, 'maxAttempts').setValue('5')
    await wrapper.get('form').trigger('submit')
    await settle(() => expect(wrapper.find('[data-outdated]').exists()).toBe(true))
    const notice = wrapper.get('[data-outdated]').text()
    expect(notice).toContain('Ban time (s): now saved as 3600')
    expect(notice).toContain('Allowlisted networks/hosts: now saved as')
    expect(input(wrapper, 'maxAttempts').element.value).toBe('5')
    wrapper.unmount()
  })
})

describe('RulesSection', () => {
  async function openRules(scenario = 'ops-fail2ban') {
    await signedIn(scenario)
    const rules = await readRules()
    testPlugins().queryClient.setQueryData(operationsKeys.fail2ban.rules(), rules)
    const wrapper = mountWithApp(RulesSection, {
      props: { rules, capabilities },
      attachTo: document.body,
      global: { plugins: [router()] },
    })
    await flushPromises()
    await wrapper.get('[aria-expanded]').trigger('click')
    return { wrapper, rules }
  }

  it('is collapsed by default, lists the numbered rules and adds a "+" row', async () => {
    await signedIn()
    const rules = await readRules()
    const wrapper = mountWithApp(RulesSection, {
      props: { rules, capabilities },
      global: { plugins: [router()] },
    })
    expect(wrapper.get('[aria-expanded]').attributes('aria-expanded')).toBe('false')
    await wrapper.get('[aria-expanded]').trigger('click')
    expect(wrapper.findAll('[data-rule]')).toHaveLength(rules.rules.length)
    expect(wrapper.text()).toContain('Logs taken into consideration')
    const add = wrapper.findAll('button').find((button) => button.text() === 'Add row')!
    await add.trigger('click')
    expect(wrapper.findAll('[data-rule]').at(-1)!.find('td').text()).toBe('+')
  })

  it('refuses an empty rule before sending and shows a refused rule on its row', async () => {
    const { wrapper } = await openRules()
    const add = wrapper.findAll('button').find((button) => button.text() === 'Add row')!
    await add.trigger('click')
    const save = () => wrapper.findAll('button').find((button) => button.text() === 'Save changes')!
    await save().trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Enter at least 1 characters.')
    expect(lastRequest('replaceFail2BanRules')).toBeUndefined()
    const inputs = wrapper.findAll<HTMLInputElement>('[data-rule] input')
    await inputs.at(-1)!.setValue('no capture group here')
    await save().trigger('click')
    await settle(() =>
      expect(wrapper.text()).toContain('The rule needs a capture group for the client address.'),
    )
    expect(lastRequest('replaceFail2BanRules')!.headers['if-match']).toMatch(/^"rx/)
    wrapper.unmount()
  })

  it("resets after legacy's question and offers Refresh when the defaults are not restored in time", async () => {
    const { wrapper } = await openRules('ops-fail2ban-rules-not-restored')
    const reset = wrapper.findAll('button').find((button) => button.text() === 'Reset to default')!
    await reset.trigger('click')
    await settle(() => expect(confirmState.value).not.toBeNull())
    expect(confirmState.value!.description).toBe('Are you sure you want to proceed?')
    settleConfirm(true)
    await settle(() => expect(wrapper.find('[data-reset-problem]').exists()).toBe(true))
    expect(wrapper.get('[data-reset-problem]').text()).toContain(
      'Regex filter could not be reset in time',
    )
    expect(mockState().requests.filter((r) => r.operationId === 'resetFail2BanRules')).toHaveLength(
      1,
    )
    const refresh = wrapper.findAll('button').find((button) => button.text() === 'Refresh')!
    await refresh.trigger('click')
    await flushPromises()
    expect(mockState().requests.filter((r) => r.operationId === 'resetFail2BanRules')).toHaveLength(
      1,
    )
    wrapper.unmount()
  })
})

describe('ActiveBanItem', () => {
  const ban: Fail2BanActiveBan = {
    network: '203.0.113.0/24',
    address: '203.0.113.0',
    endsAt: '2026-10-19T09:00:00Z',
    remainingSeconds: 1530,
    queuedForLifting: false,
  }

  it("reads as legacy's line with the actions while the ban is not pending", async () => {
    const wrapper = mountWithApp(ActiveBanItem, { props: { ban, busy: false } })
    expect(wrapper.text()).toContain('203.0.113.0/24')
    expect(wrapper.text()).toContain('(00h 25m 30s)')
    expect(wrapper.findAll('button').map((b) => b.text())).toEqual([
      'unban',
      'allowlist',
      'denylist',
    ])
    await wrapper.findAll('button')[2]!.trigger('click')
    expect(wrapper.emitted('action')).toEqual([['denylist']])
    await wrapper.setProps({ ban: { ...ban, queuedForLifting: true } })
    await nextTick()
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.get('[data-pending]').text()).toBe('unban pending')
  })
})

describe('BanListSection', () => {
  async function openBanList(scenario = 'ops-fail2ban') {
    await signedIn(scenario)
    const settings = await readSettings()
    testPlugins().queryClient.setQueryData(operationsKeys.fail2ban.settings(), settings)
    const wrapper = mountWithApp(BanListSection, {
      props: { settings, capabilities },
      attachTo: document.body,
    })
    await settle(() => expect(wrapper.find('[data-active-bans]').exists()).toBe(true))
    return wrapper
  }

  it('lists the active and the permanent bans, and asks before denylisting with the own-address warning', async () => {
    const wrapper = await openBanList('ops-fail2ban-client-in-denylist')
    expect(wrapper.findAll('[data-ban]').map((li) => li.attributes('data-ban'))).toEqual([
      '192.0.2.77/32',
      '198.51.100.0/24',
      '203.0.113.0/24',
      '2001:db8:1234::/48',
    ])
    expect(wrapper.findAll('[data-permanent-bans] li').map((li) => li.text())).toEqual([
      '198.51.100.200/32',
      '2001:db8:dead::/48',
    ])
    const item = wrapper.get('[data-ban="198.51.100.0/24"]')
    await item.findAll('button')[2]!.trigger('click')
    await settle(() => expect(confirmState.value).not.toBeNull())
    expect(confirmState.value!.title).toBe('Denylist 198.51.100.0/24?')
    expect(confirmState.value!.description).toBe(
      'This entry covers your own address 198.51.100.7. You could lock yourself out.',
    )
    settleConfirm(false)
    await flushPromises()
    expect(lastRequest('denylistFail2BanBan')).toBeUndefined()
    wrapper.unmount()
  })

  it('rotates the ban list ID only after the confirmation, with If-Match', async () => {
    const wrapper = await openBanList()
    await wrapper.get('[aria-label="Refresh banlist ID"]').trigger('click')
    await settle(() => expect(confirmState.value).not.toBeNull())
    expect(confirmState.value!.description).toBe('The current banlist URL stops working at once.')
    expect(lastRequest('rotateFail2BanBanListId')).toBeUndefined()
    settleConfirm(true)
    await settle(() =>
      expect(wrapper.get('[data-ban-status]').text()).toBe(
        'Banlist ID has been successfully refreshed.',
      ),
    )
    expect(lastRequest('rotateFail2BanBanListId')!.headers['if-match']).toMatch(/^"f2b/)
    wrapper.unmount()
  })
})
