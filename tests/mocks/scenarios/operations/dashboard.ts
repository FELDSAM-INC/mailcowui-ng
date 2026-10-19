// Dashboard area of the operations scenarios (UI 011 T013, T046): the host, its mail storage, the
// installed version and the containers; runtime changes to the storage and the containers; the
// seed of `admin-operations` (SOGo stopped, ClamAV unhealthy); and the dashboard scenarios.
import type { InstallationVersion } from '@/api'

import { mailcowContainers, type MockContainer } from '../../factories/container'
import {
  mockHost,
  mockStorage,
  mockVersion,
  type MockHost,
  type MockStorage,
} from '../../factories/host'
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'

export interface DashboardData {
  host: MockHost | null
  version: InstallationVersion
  storage: MockStorage
  containers: MockContainer[]
  /** Overview requests so far: the figures follow a sequence per request. */
  overviewRequests: number
  /** Resource samples per container: the sequence and the time of the last sample. */
  samples: Record<string, { sequence: number; last: number | null }>
}

export interface DashboardPatch {
  storage?: Partial<MockStorage>
  /** Changes containers by name; `null` removes one (a container renamed or removed). */
  containers?: Record<string, Partial<MockContainer> | null>
}

export function initialDashboardData(): DashboardData {
  return {
    host: null,
    version: mockVersion(),
    storage: mockStorage(),
    containers: [],
    overviewRequests: 0,
    samples: {},
  }
}

/** Applies runtime changes (`PATCH /__mock/scenarios/:id` with `operations.dashboard`). */
export function applyDashboardPatch(state: ScenarioState, patch: DashboardPatch): void {
  const data = state.operations.dashboard
  if (patch.storage) data.storage = { ...data.storage, ...patch.storage }
  for (const [name, change] of Object.entries(patch.containers ?? {})) {
    const index = data.containers.findIndex((container) => container.name === name)
    if (change === null) {
      if (index >= 0) data.containers.splice(index, 1)
    } else if (index >= 0) {
      data.containers[index] = { ...data.containers[index]!, ...change }
    }
  }
}

/** The healthy installation's dashboard data, seeded into every operations scenario. */
export function seedDashboard(state: ScenarioState): void {
  const now = state.now()
  const data = state.operations.dashboard
  data.host = mockHost(now)
  data.containers = mailcowContainers(now)
  const sogo = data.containers.find((container) => container.name === 'sogo-mailcow')!
  Object.assign(sogo, { state: 'exited', running: false })
  const clamd = data.containers.find((container) => container.name === 'clamd-mailcow')!
  clamd.health = 'unhealthy'
}

const SERVICE_DOWN = {
  status: 503,
  problemType: 'temporary-failure',
  retryAfter: 30,
} as const

/** Scenarios of this area; `setup` runs after the seed of every area. */
export const dashboardScenarios: Record<string, ScenarioDefinition> = {
  'admin-operations-lighthouse': {
    description:
      'The operations installation polled every 60 seconds, for Lighthouse (UI 011 R22).',
    overrides: { operations: { capabilities: { pollIntervalSeconds: 60 } } },
  },
  'ops-container-service-down': {
    description:
      'The container service is unavailable: host, storage, containers and resource usage answer 503 (UI 011 FR-025).',
    overrides: {
      operations: {
        inject: {
          getHostOverview: { ...SERVICE_DOWN },
          getMailStorageUsage: { ...SERVICE_DOWN },
          listContainers: { ...SERVICE_DOWN },
          getContainerResourceUsage: { ...SERVICE_DOWN },
        },
      },
    },
  },
  'ops-storage-unavailable': {
    description: 'The mail storage could not be measured (UI 011 US1-AS7).',
    overrides: { operations: { dashboard: { storage: { measured: false } } } },
  },
  'ops-capabilities-unavailable': {
    description: 'The monitoring capabilities cannot be read (UI 011 FR-018).',
    overrides: { operations: { inject: { getMonitoringCapabilities: { status: 500 } } } },
  },
}
