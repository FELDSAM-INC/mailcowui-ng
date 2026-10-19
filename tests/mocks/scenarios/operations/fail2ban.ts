// Ban service area of the operations scenarios (UI 011 T013, T101): the stored settings and rules,
// active and permanent bans, whether the ban service runs, a change by another administrator before
// the next save, and how many list reads a lifted ban stays listed; the seed of `admin-operations`
// and the area's scenarios.
import {
  activeBans,
  defaultRules,
  defaultSettings,
  permanentBans,
  type MockActiveBan,
  type MockFail2banSettings,
  type MockPermanentBan,
} from '../../factories/fail2ban'
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'

export interface Fail2banData {
  settings: MockFail2banSettings
  rules: string[]
  rulesStored: boolean
  activeBans: MockActiveBan[]
  permanentBans: MockPermanentBan[]
  banServiceRunning: boolean | null
  /** Saved by another administrator just before the next settings save (a 412 follows). */
  changeBeforeSave: Partial<MockFail2banSettings> | null
  /** List reads after which a ban queued for lifting is gone (the ban service lifted it). */
  liftAfterReads: number
  /** Reads seen per queued network. */
  liftReads: Record<string, number>
}

export interface Fail2banPatch {
  /** Bans that end behind the app's back. */
  endBans?: string[]
  settings?: Partial<MockFail2banSettings>
  banServiceRunning?: boolean | null
}

export function initialFail2banData(): Fail2banData {
  return {
    settings: defaultSettings(),
    rules: defaultRules(),
    rulesStored: false,
    activeBans: [],
    permanentBans: [],
    banServiceRunning: true,
    changeBeforeSave: null,
    liftAfterReads: 0,
    liftReads: {},
  }
}

/** Applies runtime changes (`PATCH /__mock/scenarios/:id` with `operations.fail2ban`). */
export function applyFail2banPatch(state: ScenarioState, patch: Fail2banPatch): void {
  const data = state.operations.fail2ban
  if (patch.endBans) {
    const ended = new Set(patch.endBans)
    data.activeBans = data.activeBans.filter((ban) => !ended.has(ban.network))
  }
  if (patch.settings) data.settings = { ...data.settings, ...patch.settings }
  if (patch.banServiceRunning !== undefined) data.banServiceRunning = patch.banServiceRunning
}

/** The healthy installation's ban service, seeded into every operations scenario. */
export function seedFail2ban(state: ScenarioState): void {
  const data = state.operations.fail2ban
  data.settings = defaultSettings()
  data.rules = defaultRules()
  data.activeBans = activeBans(state.now())
  data.permanentBans = permanentBans(state.now(), data.settings.denylist)
}

/** Scenarios of this area; `setup` runs after the seed of every area. */
export const fail2banScenarios: Record<string, ScenarioDefinition> = {
  'ops-fail2ban': {
    description:
      'An administrator on the ban service: ban time 1,800 s, maximum 10,000 s, three active bans (one queued for lifting), two permanent bans and the default rules (UI 011 US5).',
  },
  'ops-fail2ban-legacy-values': {
    description:
      'Stored ban settings outside the rules, from the classic interface: ban time 30 s (UI 011 FR-068).',
    setup(state) {
      state.operations.fail2ban.settings.banTime = 30
    },
  },
  'ops-fail2ban-not-running': {
    description: 'The ban service container is not running (UI 011 FR-073).',
    setup(state) {
      state.operations.fail2ban.banServiceRunning = false
    },
  },
  'ops-fail2ban-changed-elsewhere': {
    description:
      'Another administrator changes the ban time and the allowlist between the read and the save (UI 011 US5-AS5).',
    setup(state) {
      state.operations.fail2ban.changeBeforeSave = {
        banTime: 3_600,
        allowlist: [...state.operations.fail2ban.settings.allowlist, '198.18.0.0/15'],
      }
    },
  },
  'ops-fail2ban-rules-not-restored': {
    description:
      'Resetting the rules removes them, but the ban service does not restore the defaults in time (UI 011 US5-AS6).',
    overrides: {
      operations: {
        inject: { resetFail2BanRules: { status: 504, problemType: 'ban-rules-not-restored' } },
      },
    },
  },
  'ops-fail2ban-client-in-denylist': {
    description:
      "An active ban whose network covers the administrator's own address 198.51.100.7 (UI 011 FR-064).",
    setup(state) {
      state.operations.fail2ban.activeBans.unshift({
        network: '198.51.100.0/24',
        address: '198.51.100.0',
        endsAt: new Date(state.now() + 15 * 60_000).toISOString(),
        queuedForLifting: false,
      })
    },
  },
  'ops-fail2ban-empty': {
    description: 'No active and no permanent bans (UI 011 FR-074).',
    setup(state) {
      const data = state.operations.fail2ban
      data.activeBans = []
      data.permanentBans = []
      data.settings.denylist = []
    },
  },
}
