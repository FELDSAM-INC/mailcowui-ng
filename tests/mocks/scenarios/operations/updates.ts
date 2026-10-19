// Updates area of the operations scenarios (UI 011 T013, T126): the update status and the public
// addresses; `admin-operations` reports an available update with release notes, and the IP check
// is enabled.
import type { InstallationUpdateStatus } from '@/api'

import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'

export interface UpdatesData {
  status: InstallationUpdateStatus['status']
  addresses: { ipv4: string | null; ipv6: string | null }
}

export interface UpdatesPatch {
  status?: InstallationUpdateStatus['status']
  addresses?: Partial<UpdatesData['addresses']>
}

export function initialUpdatesData(): UpdatesData {
  return { status: 'updateAvailable', addresses: { ipv4: '203.0.113.10', ipv6: '2001:db8::10' } }
}

/** Applies runtime changes (`PATCH /__mock/scenarios/:id` with `operations.updates`). */
export function applyUpdatesPatch(state: ScenarioState, patch: UpdatesPatch): void {
  const data = state.operations.updates
  if (patch.status) data.status = patch.status
  if (patch.addresses) data.addresses = { ...data.addresses, ...patch.addresses }
}

/** The healthy installation's update data is the initial one. */
export function seedUpdates(_state: ScenarioState): void {}

/** Scenarios of this area; `setup` runs after the seed of every area. */
export const updatesScenarios: Record<string, ScenarioDefinition> = {
  'ops-update-up-to-date': {
    description: 'The installation is on the newest release (UI 011 US7).',
    overrides: { operations: { updates: { status: 'upToDate' } } },
  },
  'ops-update-check-failed': {
    description: 'The update check failed (UI 011 US7-AS2).',
    overrides: { operations: { updates: { status: 'checkFailed' } } },
  },
  'ops-update-disabled': {
    description: 'The update check is disabled, as on the FeldHost deployment (UI 011 US7-AS2).',
    overrides: { operations: { updates: { status: 'disabled' } } },
  },
  'ops-ip-check-disabled': {
    description: 'The IP check is switched off (UI 011 US7-AS4).',
    overrides: { operations: { capabilities: { ipCheckEnabled: false } } },
  },
  'ops-ip-partial': {
    description: 'The IPv6 address could not be determined (UI 011 US7-AS3).',
    overrides: { operations: { updates: { addresses: { ipv6: null } } } },
  },
  'ops-ip-disabled-meanwhile': {
    description:
      'The capabilities say the IP check is on, but the lookup answers 409 ip-check-disabled (UI 011 US7-AS4).',
    overrides: {
      operations: {
        inject: { getPublicAddresses: { status: 409, problemType: 'ip-check-disabled', times: 1 } },
      },
    },
  },
}
