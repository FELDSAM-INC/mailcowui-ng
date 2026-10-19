// UI 011 US5 (FR-064–FR-072, T106): the remaining paths of the Fail2ban parts — the ban list's
// actions and their outcomes (lifted, allowlisted, denylisted, already ended, not recorded,
// refused), copying the ban list address, more bans than one read returns, a failed list; the
// parameters' server refusals, outdated save, discard and cancel; the regex filters' limits,
// compiler messages, outdated save and the reset's outcomes.
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type {
  Fail2BanActiveBan,
  Fail2BanPermanentBan,
  Fail2BanRules,
  Fail2BanSettings,
  MonitoringCapabilities,
} from '@/api'
import BanListSection from '@/features/operations/fail2ban/components/BanListSection.vue'
import ParametersSection from '@/features/operations/fail2ban/components/ParametersSection.vue'
import RulesSection from '@/features/operations/fail2ban/components/RulesSection.vue'
import { ACTIVE_BAN_PARAMS, PERMANENT_BAN_PARAMS } from '@/features/operations/fail2ban/api'
import { operationsKeys } from '@/features/operations/query-keys'
import { liveMessages } from '@/shared/composables/useAnnouncer'
import { confirmState, settleConfirm } from '@/shared/composables/useConfirm'

import { mockState, useScenario } from '../../../../mocks/node'
import type { OperationInjection } from '../../../../mocks/scenarios/operations/state'
import { defaultMonitoringCapabilities } from '../../../../mocks/scenarios/operations/state'
import { installMatchMedia } from '../../../support/media'
import { mountWithApp, testPlugins } from '../../../support/mount'

const settle = (check: () => void) => vi.waitFor(check, { timeout: 10_000 })
// Several requests per test (session, token, write, reads) are slow on a loaded machine.
const slow = { timeout: 30_000 }
const capabilities = defaultMonitoringCapabilities()
const router = () =>
  createRouter({
    history: createMemoryHistory('/ng/'),
    routes: [{ path: '/audit-log', name: 'audit-log', component: { render: () => null } }],
  })

const mounted: VueWrapper[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  vi.restoreAllMocks()
})

function inject(operationId: string, injection: OperationInjection) {
  mockState().operations.inject[operationId] = injection
}

function requests(operationId: string) {
  return mockState().requests.filter((request) => request.operationId === operationId)
}

async function read<T>(path: string): Promise<T> {
  const response = await fetch(`http://localhost/api/v2${path}`)
  return ((await response.json()) as { data: T }).data
}

async function signedIn(scenario = 'ops-fail2ban') {
  installMatchMedia({ '(min-width: 768px)': true })
  useScenario(scenario)
  await flushPromises()
}

const buttonNamed = (wrapper: VueWrapper, name: string) =>
  wrapper.findAll('button').find((button) => button.text() === name)!

describe('BanListSection outcomes', slow, () => {
  async function openBanList(
    scenario = 'ops-fail2ban',
    options: { capabilities?: MonitoringCapabilities | null; seed?: () => void } = {},
  ) {
    await signedIn(scenario)
    const settings = await read<Fail2BanSettings>('/fail2ban/settings')
    testPlugins().queryClient.setQueryData(operationsKeys.fail2ban.settings(), settings)
    options.seed?.()
    const wrapper = mountWithApp(BanListSection, {
      props: {
        settings,
        capabilities: options.capabilities === undefined ? capabilities : options.capabilities,
      },
      attachTo: document.body,
    })
    mounted.push(wrapper)
    await flushPromises()
    return { wrapper, settings }
  }

  const ban = (wrapper: VueWrapper, network: string) => wrapper.get(`[data-ban="${network}"]`)

  it('lifts a ban without asking and says the network was changed', async () => {
    const { wrapper } = await openBanList()
    await settle(() => expect(wrapper.find('[data-active-bans]').exists()).toBe(true))
    await ban(wrapper, '203.0.113.0/24').findAll('button')[0]!.trigger('click')
    await settle(() =>
      expect(wrapper.get('[data-ban-status]').text()).toBe(
        'Changes to object 203.0.113.0/24 have been saved',
      ),
    )
    expect(confirmState.value).toBeNull()
    expect(requests('liftFail2BanBan')).toHaveLength(1)
    await settle(() =>
      expect(ban(wrapper, '203.0.113.0/24').find('[data-pending]').exists()).toBe(true),
    )
  })

  it('allowlists a ban and reads the settings and permanent bans again', async () => {
    const { wrapper } = await openBanList()
    await settle(() => expect(wrapper.find('[data-active-bans]').exists()).toBe(true))
    const reads = requests('listFail2BanPermanentBans').length
    await ban(wrapper, '203.0.113.0/24').findAll('button')[1]!.trigger('click')
    await settle(() => expect(requests('allowlistFail2BanBan')).toHaveLength(1))
    await settle(() => expect(requests('listFail2BanPermanentBans').length).toBeGreaterThan(reads))
  })

  it('denylists after the confirmation, without the warning for another network', async () => {
    const { wrapper } = await openBanList()
    await settle(() => expect(wrapper.find('[data-active-bans]').exists()).toBe(true))
    await ban(wrapper, '203.0.113.0/24').findAll('button')[2]!.trigger('click')
    await settle(() => expect(confirmState.value).not.toBeNull())
    expect(confirmState.value!.title).toBe('Denylist 203.0.113.0/24?')
    expect(confirmState.value!.description).toBeUndefined()
    settleConfirm(true)
    await settle(() => expect(requests('denylistFail2BanBan')).toHaveLength(1))
    await settle(() => expect(wrapper.find('[data-ban-status]').exists()).toBe(true))
  })

  it('denylists without a warning when the capabilities could not be read', async () => {
    const { wrapper } = await openBanList('ops-fail2ban-client-in-denylist', {
      capabilities: null,
    })
    await settle(() => expect(wrapper.find('[data-active-bans]').exists()).toBe(true))
    await ban(wrapper, '198.51.100.0/24').findAll('button')[2]!.trigger('click')
    await settle(() => expect(confirmState.value).not.toBeNull())
    expect(confirmState.value!.description).toBeUndefined()
    settleConfirm(false)
  })

  it('says the ban already ended on a 404 and reads the list again', async () => {
    const { wrapper } = await openBanList()
    await settle(() => expect(wrapper.find('[data-active-bans]').exists()).toBe(true))
    inject('liftFail2BanBan', { status: 404 })
    const reads = requests('listFail2BanActiveBans').length
    await ban(wrapper, '203.0.113.0/24').findAll('button')[0]!.trigger('click')
    await settle(() =>
      expect(wrapper.get('[data-ban-ended]').text()).toBe('This ban has already ended.'),
    )
    await settle(() => expect(requests('listFail2BanActiveBans').length).toBeGreaterThan(reads))
    expect(wrapper.find('[data-ban-status]').exists()).toBe(false)
  })

  it('warns when the action was carried out without an audit record', async () => {
    const { wrapper } = await openBanList()
    await settle(() => expect(wrapper.find('[data-active-bans]').exists()).toBe(true))
    inject('liftFail2BanBan', { auditRecorded: false })
    await ban(wrapper, '203.0.113.0/24').findAll('button')[0]!.trigger('click')
    await settle(() =>
      expect(wrapper.text()).toContain(
        'The action was carried out, but no audit record was written.',
      ),
    )
  })

  it('shows a refused action as a problem', async () => {
    const { wrapper } = await openBanList()
    await settle(() => expect(wrapper.find('[data-active-bans]').exists()).toBe(true))
    inject('liftFail2BanBan', { status: 503, problemType: 'temporary-failure' })
    await ban(wrapper, '203.0.113.0/24').findAll('button')[0]!.trigger('click')
    await settle(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true))
    expect(wrapper.get('[role="alert"]').text()).toContain('Nothing was changed')
  })

  it('says "No active bans" when there are neither active nor permanent bans', async () => {
    const { wrapper } = await openBanList('ops-fail2ban-empty')
    await settle(() => expect(wrapper.find('[data-no-bans]').exists()).toBe(true))
    expect(wrapper.get('[data-no-bans]').text()).toBe('No active bans')
    expect(wrapper.find('[data-active-bans]').exists()).toBe(false)
  })

  it('copies the ban list address, or says copying is not available', async () => {
    const { wrapper, settings } = await openBanList()
    expect(wrapper.get<HTMLInputElement>('[data-ban-list-url]').element.value).toBe(
      settings.banListUrl,
    )
    const copy = wrapper.get('button[aria-label="Copy"]')
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    await copy.trigger('click')
    await settle(() =>
      expect(liveMessages.polite.value).toBe(
        'Copying is not available here. Select the text to copy it.',
      ),
    )
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    await copy.trigger('click')
    await settle(() => expect(writeText).toHaveBeenCalledWith(settings.banListUrl))
    await settle(() => expect(liveMessages.polite.value).toBe('Text copied to clipboard!'))
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
  })

  it("shows legacy's count line when there are more bans than one read returns", async () => {
    const activeBan: Fail2BanActiveBan = {
      network: '203.0.113.0/24',
      address: '203.0.113.0',
      endsAt: '2099-01-01T00:00:00Z',
      remainingSeconds: 60,
      queuedForLifting: false,
    }
    const permanentBan: Fail2BanPermanentBan = {
      network: '198.51.100.200/32',
      startedAt: '2026-10-19T07:00:00Z',
    } as Fail2BanPermanentBan
    const { wrapper } = await openBanList('ops-fail2ban', {
      seed: () => {
        const client = testPlugins().queryClient
        client.setQueryData(operationsKeys.fail2ban.activeBans(ACTIVE_BAN_PARAMS), {
          data: [activeBan],
          meta: { total: 1500, limit: 1000, offset: 0 },
        })
        client.setQueryData(operationsKeys.fail2ban.permanentBans(PERMANENT_BAN_PARAMS), {
          data: [permanentBan],
          meta: { total: 1200, limit: 1000, offset: 0 },
        })
      },
    })
    expect(wrapper.text()).toContain('Showing 1 to 1 of 1,500 entries')
    expect(wrapper.text()).toContain('Showing 1 to 1 of 1,200 entries')
  })

  it('shows a failed list with a retry that reads both lists again', async () => {
    await signedIn()
    inject('listFail2BanActiveBans', { status: 503, problemType: 'temporary-failure', times: 1 })
    const settings = await read<Fail2BanSettings>('/fail2ban/settings')
    const wrapper = mountWithApp(BanListSection, {
      props: { settings, capabilities },
      attachTo: document.body,
    })
    mounted.push(wrapper)
    await settle(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true))
    const reads = requests('listFail2BanPermanentBans').length
    await buttonNamed(wrapper, 'Try again').trigger('click')
    await settle(() => expect(wrapper.find('[data-active-bans]').exists()).toBe(true))
    expect(requests('listFail2BanPermanentBans').length).toBeGreaterThan(reads)
  })

  it('shows a refused rotation as a problem', async () => {
    const { wrapper } = await openBanList()
    inject('rotateFail2BanBanListId', { status: 503, problemType: 'temporary-failure' })
    await wrapper.get('[aria-label="Refresh banlist ID"]').trigger('click')
    await settle(() => expect(confirmState.value).not.toBeNull())
    settleConfirm(true)
    await settle(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true))
    expect(wrapper.find('[data-ban-status]').exists()).toBe(false)
  })

  it('does nothing when the rotation is not confirmed', async () => {
    const { wrapper } = await openBanList()
    await wrapper.get('[aria-label="Refresh banlist ID"]').trigger('click')
    await settle(() => expect(confirmState.value).not.toBeNull())
    settleConfirm(false)
    await flushPromises()
    expect(requests('rotateFail2BanBanListId')).toHaveLength(0)
  })
})

describe('ParametersSection, more paths', slow, () => {
  async function openParameters(
    scenario = 'ops-fail2ban',
    options: { capabilities?: MonitoringCapabilities | null } = {},
  ) {
    await signedIn(scenario)
    const settings = await read<Fail2BanSettings>('/fail2ban/settings')
    testPlugins().queryClient.setQueryData(operationsKeys.fail2ban.settings(), settings)
    const wrapper = mountWithApp(ParametersSection, {
      props: {
        settings,
        capabilities: options.capabilities === undefined ? capabilities : options.capabilities,
        editing: false,
      },
      attachTo: document.body,
      global: { plugins: [router()] },
    })
    mounted.push(wrapper)
    await flushPromises()
    await wrapper.setProps({ editing: true })
    await flushPromises()
    return { wrapper, settings }
  }

  const field = (wrapper: VueWrapper, name: string) => wrapper.get<HTMLInputElement>(`#f2b-${name}`)

  it('closes without a request when nothing changed', async () => {
    const { wrapper } = await openParameters()
    await wrapper.get('form').trigger('submit')
    await settle(() => expect(wrapper.emitted('close')).toBeTruthy())
    expect(requests('updateFail2BanSettings')).toHaveLength(0)
  })

  it('cancels, restoring the stored values', async () => {
    const { wrapper, settings } = await openParameters()
    await field(wrapper, 'maxAttempts').setValue('3')
    expect(wrapper.emitted('dirty')!.at(-1)).toEqual([true])
    await buttonNamed(wrapper, 'Cancel').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
    await wrapper.setProps({ editing: false })
    await wrapper.setProps({ editing: true })
    await flushPromises()
    expect(field(wrapper, 'maxAttempts').element.value).toBe(String(settings.maxAttempts))
  })

  it("names the API's refusals of the parameters and of list entries by their line", async () => {
    const { wrapper } = await openParameters()
    inject('updateFail2BanSettings', {
      status: 422,
      problemType: 'validation-failed',
      errors: {
        maxBanTime: [
          {
            code: 'outOfRange',
            message: 'x',
            params: { min: 1800, max: 2147483647, minField: 'banTime' },
          },
        ],
        banTime: [
          { code: 'mustNotExceed', message: 'x', params: { field: 'maxBanTime', value: 1000 } },
        ],
        retryWindow: [{ code: 'invalidType', message: 'x', params: {} }],
        'denylist.1': [{ code: 'conflictsWith', message: 'x', params: { field: 'allowlist' } }],
        'allowlist.0': [{ code: 'tooLong', message: 'x', params: { max: 253 } }],
        'denylist.0': [{ code: 'tooMany', message: 'x', params: { max: 2 } }],
      },
    })
    await wrapper.get('#f2b-denylist').setValue('192.0.2.1\n\n192.0.2.2')
    await wrapper.get('#f2b-allowlist').setValue('office.example.org')
    await wrapper.get('form').trigger('submit')
    await settle(() => expect(wrapper.find('#f2b-maxBanTime-error').exists()).toBe(true))
    expect(wrapper.get('#f2b-maxBanTime-error').text()).toContain(
      'Enter a value from 1,800 (Ban time (s)) to 2,147,483,647.',
    )
    expect(wrapper.get('#f2b-banTime-error').text()).toContain(
      'This may not be higher than Max. ban time (s) (1,000).',
    )
    expect(wrapper.get('#f2b-retryWindow-error').text()).toBeTruthy()
    const deny = wrapper.get('#f2b-denylist-error').text()
    expect(deny).toContain('Line 3: This conflicts with Allowlisted networks/hosts.')
    expect(deny).toContain('Line 1: This value is not valid.')
    expect(wrapper.get('#f2b-allowlist-error').text()).toContain(
      'Line 1: Enter at most 253 characters.',
    )
  })

  it('shows a refusal without field errors as a problem and keeps the input', async () => {
    const { wrapper } = await openParameters()
    inject('updateFail2BanSettings', { status: 503, problemType: 'temporary-failure' })
    await field(wrapper, 'maxAttempts').setValue('4')
    await wrapper.get('form').trigger('submit')
    await settle(() => expect(wrapper.text()).toContain('Nothing was changed'))
    expect(field(wrapper, 'maxAttempts').element.value).toBe('4')
  })

  it('reads the permanent bans again after a denylist change, and warns of a missing record', async () => {
    const { wrapper } = await openParameters('ops-fail2ban', { capabilities: null })
    inject('updateFail2BanSettings', { auditRecorded: false })
    const reads = requests('listFail2BanPermanentBans').length
    await wrapper.get('#f2b-denylist').setValue('198.51.100.200\n203.0.113.9')
    await wrapper.get('form').trigger('submit')
    await settle(() => expect(requests('updateFail2BanSettings')).toHaveLength(1))
    expect(confirmState.value).toBeNull()
    await settle(() => expect(wrapper.emitted('close')).toBeTruthy())
    await wrapper.setProps({ editing: false })
    await settle(() => expect(wrapper.find('[data-not-recorded]').exists()).toBe(true))
    expect(requests('listFail2BanPermanentBans').length).toBe(reads)
  })

  it('discards after an outdated save, taking the values saved meanwhile', async () => {
    const { wrapper } = await openParameters('ops-fail2ban-changed-elsewhere')
    await field(wrapper, 'maxAttempts').setValue('5')
    await wrapper.get('form').trigger('submit')
    await settle(() => expect(wrapper.find('[data-outdated]').exists()).toBe(true))
    await buttonNamed(wrapper, 'Discard my changes').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-outdated]').exists()).toBe(false)
    expect(field(wrapper, 'banTime').element.value).toBe('3600')
    expect(field(wrapper, 'maxAttempts').element.value).not.toBe('5')
  })

  it('saves again after an outdated save', async () => {
    const { wrapper } = await openParameters('ops-fail2ban-changed-elsewhere')
    await field(wrapper, 'maxAttempts').setValue('5')
    await wrapper.get('form').trigger('submit')
    await settle(() => expect(wrapper.find('[data-outdated]').exists()).toBe(true))
    await wrapper.get('form').trigger('submit')
    await settle(() => expect(requests('updateFail2BanSettings')).toHaveLength(2))
    const last = requests('updateFail2BanSettings').at(-1)!
    expect(last.body).toEqual({ maxAttempts: 5 })
  })
})

describe('RulesSection, more paths', slow, () => {
  async function openRules(
    scenario = 'ops-fail2ban',
    options: { capabilities?: MonitoringCapabilities | null } = {},
  ) {
    await signedIn(scenario)
    const rules = await read<Fail2BanRules>('/fail2ban/rules')
    testPlugins().queryClient.setQueryData(operationsKeys.fail2ban.rules(), rules)
    const wrapper = mountWithApp(RulesSection, {
      props: {
        rules,
        capabilities: options.capabilities === undefined ? capabilities : options.capabilities,
      },
      attachTo: document.body,
      global: { plugins: [router()] },
    })
    mounted.push(wrapper)
    await flushPromises()
    await wrapper.get('[aria-expanded]').trigger('click')
    return { wrapper, rules }
  }

  const ruleInputs = (wrapper: VueWrapper) => wrapper.findAll<HTMLInputElement>('[data-rule] input')

  it('removes a row and refuses saving no rule at all', async () => {
    const { wrapper, rules } = await openRules()
    for (let index = 0; index < rules.rules.length; index += 1) {
      await buttonNamed(wrapper, 'Remove row').trigger('click')
    }
    expect(wrapper.findAll('[data-rule]')).toHaveLength(0)
    await buttonNamed(wrapper, 'Save changes').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('This field is required.')
    expect(requests('replaceFail2BanRules')).toHaveLength(0)
  })

  it('checks the number and the length of the rules against the capabilities', async () => {
    const tight = {
      ...capabilities,
      limits: { ...capabilities.limits, fail2banRulesMax: 1, fail2banRuleMaxLength: 5 },
    }
    const { wrapper } = await openRules('ops-fail2ban', { capabilities: tight })
    await buttonNamed(wrapper, 'Save changes').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Enter at most 1 entries.')
    expect(wrapper.text()).toContain('Enter at most 5 characters.')
    expect(requests('replaceFail2BanRules')).toHaveLength(0)
  })

  it("shows the compiler's message under a rule the API refuses as invalid", async () => {
    const { wrapper } = await openRules()
    await ruleInputs(wrapper)[0]!.setValue('(unclosed')
    await buttonNamed(wrapper, 'Save changes').trigger('click')
    await settle(() => expect(wrapper.text()).toContain('This is not a valid regular expression.'))
    expect(wrapper.findAll('[data-rule]')[0]!.text().length).toBeGreaterThan(40)
  })

  it('shows other refusals by their message, and a refusal without fields as a problem', async () => {
    const { wrapper } = await openRules()
    inject('replaceFail2BanRules', {
      status: 422,
      problemType: 'validation-failed',
      errors: { 'rules.0': [{ code: 'tooLong', message: 'x', params: { max: 1000 } }] },
      times: 1,
    })
    await ruleInputs(wrapper)[0]!.setValue('^changed (\\S+)$')
    await buttonNamed(wrapper, 'Save changes').trigger('click')
    await settle(() => expect(wrapper.text()).toContain('Enter at most 1,000 characters.'))
    inject('replaceFail2BanRules', { status: 503, problemType: 'temporary-failure', times: 1 })
    await buttonNamed(wrapper, 'Save changes').trigger('click')
    await settle(() => expect(wrapper.text()).toContain('Nothing was changed'))
  })

  it("saves the rules with legacy's message and warns of a missing audit record", async () => {
    const { wrapper } = await openRules()
    inject('replaceFail2BanRules', { auditRecorded: false })
    await ruleInputs(wrapper)[0]!.setValue('^changed (\\S+)$')
    await buttonNamed(wrapper, 'Save changes').trigger('click')
    await settle(() => expect(wrapper.find('[data-rules-status]').exists()).toBe(true))
    expect(wrapper.get('[data-rules-status]').text()).toContain('Changes to object')
    expect(wrapper.text()).toContain('The action was carried out, but no audit record was written.')
  })

  it('stops an outdated save, then discards or saves again', async () => {
    const { wrapper } = await openRules()
    mockState().operations.fail2ban.rules = ['^elsewhere (\\S+)$']
    mockState().operations.fail2ban.rulesStored = true
    await ruleInputs(wrapper)[0]!.setValue('^mine (\\S+)$')
    await buttonNamed(wrapper, 'Save changes').trigger('click')
    await settle(() => expect(wrapper.find('[data-outdated]').exists()).toBe(true))
    await buttonNamed(wrapper, 'Discard my changes').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-outdated]').exists()).toBe(false)
    expect(ruleInputs(wrapper)[0]!.element.value).toBe('^elsewhere (\\S+)$')

    mockState().operations.fail2ban.rules = ['^again (\\S+)$']
    await ruleInputs(wrapper)[0]!.setValue('^mine (\\S+)$')
    await buttonNamed(wrapper, 'Save changes').trigger('click')
    await settle(() => expect(wrapper.find('[data-outdated]').exists()).toBe(true))
    await buttonNamed(wrapper, 'Save again').trigger('click')
    await settle(() => expect(wrapper.find('[data-rules-status]').exists()).toBe(true))
    expect(mockState().operations.fail2ban.rules).toEqual(['^mine (\\S+)$'])
  })

  it('resets to the defaults after the question and says the parameters were saved', async () => {
    const { wrapper } = await openRules()
    await buttonNamed(wrapper, 'Reset to default').trigger('click')
    await settle(() => expect(confirmState.value).not.toBeNull())
    settleConfirm(true)
    await settle(() =>
      expect(wrapper.get('[data-rules-status]').text()).toBe(
        'Changes to Fail2ban parameters have been saved',
      ),
    )
    expect(requests('resetFail2BanRules')).toHaveLength(1)
  })

  it('reads the rules again when the reset has an unknown outcome, and never resets again', async () => {
    const { wrapper } = await openRules()
    inject('resetFail2BanRules', {
      status: 504,
      problemType: 'outcome-unknown',
      extensions: { step: 'rulesReset' },
      auditRecorded: false,
    })
    const reads = requests('getFail2BanRules').length
    await buttonNamed(wrapper, 'Reset to default').trigger('click')
    await settle(() => expect(confirmState.value).not.toBeNull())
    settleConfirm(true)
    await settle(() => expect(wrapper.find('[data-reset-problem]').exists()).toBe(true))
    await settle(() => expect(requests('getFail2BanRules').length).toBeGreaterThan(reads))
    expect(requests('resetFail2BanRules')).toHaveLength(1)
    expect(wrapper.text()).toContain('The action was carried out, but no audit record was written.')
  })

  it('does not reset without the confirmation', async () => {
    const { wrapper } = await openRules()
    await buttonNamed(wrapper, 'Reset to default').trigger('click')
    await settle(() => expect(confirmState.value).not.toBeNull())
    settleConfirm(false)
    await flushPromises()
    expect(requests('resetFail2BanRules')).toHaveLength(0)
  })

  it('takes new rules from outside while nothing is edited', async () => {
    const { wrapper, rules } = await openRules()
    await wrapper.setProps({
      rules: { ...rules, rules: [{ number: 1, pattern: '^outside (\\S+)$' }] },
    })
    await flushPromises()
    expect(ruleInputs(wrapper).map((input) => input.element.value)).toEqual(['^outside (\\S+)$'])
  })
})
