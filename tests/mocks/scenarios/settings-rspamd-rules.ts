import type { RspamdSettingsRule } from '@/api'
import type { ScenarioDefinition } from './index'
import type { ScenarioState } from './state'
interface RuleState {
  rules: RspamdSettingsRule[]
  nextId: number
  revision: number
  outdatedOnce: boolean
}
const states = new WeakMap<ScenarioState, RuleState>()
export function rspamdRuleState(state: ScenarioState): RuleState {
  let value = states.get(state)
  if (!value) {
    value = { rules: [], nextId: 1, revision: 1, outdatedOnce: false }
    states.set(state, value)
  }
  return value
}
export function mockRspamdRule(id: number): RspamdSettingsRule {
  return {
    id,
    description: `Rule ${String(id).padStart(2, '0')}`,
    content: `# ${id % 10 === 0 ? 'needle-content' : 'example'}\npriority = 10;\napply { symbols = ["EXAMPLE_${id}"]; }`,
    active: id % 2 === 1,
    createdAt: '2026-10-01T10:00:00.000Z',
    modifiedAt: null,
    etag: `"rule-${id}-1"`,
  }
}
function seed(state: ScenarioState, count = 30) {
  const store = rspamdRuleState(state)
  store.rules = Array.from({ length: count }, (_, i) => mockRspamdRule(i + 1))
  store.nextId = count + 1
}
export const rspamdRulesScenarios: Record<string, ScenarioDefinition> = {
  'rspamd-rules-empty': { description: 'No Rspamd rules.', overrides: { signedInAs: 'admin' } },
  'rspamd-rules-30': {
    description: 'Thirty Rspamd rules with active and inactive entries.',
    overrides: { signedInAs: 'admin' },
    setup: (state) => seed(state),
  },
  'rspamd-rules-outdated': {
    description: 'A concurrent change replaces the first submitted version once.',
    overrides: { signedInAs: 'admin' },
    setup: (state) => {
      seed(state, 1)
      rspamdRuleState(state).outdatedOnce = true
    },
  },
  'settings-map-unavailable': {
    description: 'The effective Rspamd settings map is temporarily unavailable.',
    overrides: {
      signedInAs: 'admin',
      failures: {
        getEffectiveRspamdSettingsMap: {
          status: 503,
          type: 'temporary-failure',
          times: 1,
          extra: { dependency: 'spamFilter' },
        },
      },
    },
    setup: (state) => seed(state, 1),
  },
}
