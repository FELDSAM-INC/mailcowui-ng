// The operations scenarios (UI 011 T013, research R21). Each area module contributes its seed
// data, its runtime changes and its own scenarios, so that parallel stories never edit the same
// file. Every operations scenario signs in as `admin` and starts from the healthy installation
// that the seeds of all areas build (`admin-operations`); an area scenario's `setup` then adjusts
// it.
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'
import { auditScenarios } from './audit'
import {
  applyContainerActionsPatch,
  containerActionsScenarios,
  initialContainerActionsData,
  seedContainerActions,
} from './container-actions'
import {
  applyDashboardPatch,
  dashboardScenarios,
  initialDashboardData,
  seedDashboard,
} from './dashboard'
import {
  applyFail2banPatch,
  fail2banScenarios,
  initialFail2banData,
  seedFail2ban,
} from './fail2ban'
import { applyLogsPatch, initialLogsData, logsScenarios, seedLogs } from './logs'
import {
  applyMailQueuePatch,
  initialMailQueueData,
  mailQueueScenarios,
  seedMailQueue,
} from './mail-queue'
import { applyRspamdPatch, initialRspamdData, rspamdScenarios, seedRspamd } from './rspamd'
import {
  defaultMonitoringCapabilities,
  mergeDeep,
  type OperationsPatch,
  type OperationsState,
} from './state'
import { applyUpdatesPatch, initialUpdatesData, seedUpdates, updatesScenarios } from './updates'

export function initialOperationsState(): OperationsState {
  return {
    capabilities: defaultMonitoringCapabilities(),
    hostClockOffsetMs: 0,
    lags: {},
    inject: {},
    dashboard: initialDashboardData(),
    containerActions: initialContainerActionsData(),
    logs: initialLogsData(),
    mailQueue: initialMailQueueData(),
    fail2ban: initialFail2banData(),
    rspamd: initialRspamdData(),
    updates: initialUpdatesData(),
  }
}

/** The healthy installation: the seed data of every area. */
export function seedOperations(state: ScenarioState): void {
  seedDashboard(state)
  seedContainerActions(state)
  seedLogs(state)
  seedMailQueue(state)
  seedFail2ban(state)
  seedRspamd(state)
  seedUpdates(state)
}

export function applyOperationsPatch(state: ScenarioState, patch: OperationsPatch): void {
  const operations = state.operations
  if (patch.advanceHostClockSeconds) {
    operations.hostClockOffsetMs += patch.advanceHostClockSeconds * 1000
  }
  if (patch.capabilities) {
    operations.capabilities = mergeDeep(operations.capabilities, patch.capabilities)
  }
  if (patch.lags) operations.lags = { ...operations.lags, ...patch.lags }
  for (const [operationId, injection] of Object.entries(patch.inject ?? {})) {
    if (injection === null) delete operations.inject[operationId]
    else operations.inject[operationId] = { ...injection }
  }
  if (patch.dashboard) applyDashboardPatch(state, patch.dashboard)
  if (patch.containerActions) applyContainerActionsPatch(state, patch.containerActions)
  if (patch.logs) applyLogsPatch(state, patch.logs)
  if (patch.mailQueue) applyMailQueuePatch(state, patch.mailQueue)
  if (patch.fail2ban) applyFail2banPatch(state, patch.fail2ban)
  if (patch.rspamd) applyRspamdPatch(state, patch.rspamd)
  if (patch.updates) applyUpdatesPatch(state, patch.updates)
}

const areaScenarios: Record<string, ScenarioDefinition> = {
  ...dashboardScenarios,
  ...containerActionsScenarios,
  ...logsScenarios,
  ...mailQueueScenarios,
  ...fail2banScenarios,
  ...rspamdScenarios,
  ...updatesScenarios,
  ...auditScenarios,
}

/** An area scenario on top of the healthy installation, signed in as `admin` unless it says otherwise. */
function onInstallation(definition: ScenarioDefinition): ScenarioDefinition {
  return {
    ...definition,
    overrides: { signedInAs: 'admin', ...definition.overrides },
    setup(state) {
      seedOperations(state)
      definition.setup?.(state)
    },
  }
}

export const operationsScenarios: Record<string, ScenarioDefinition> = {
  'admin-operations': onInstallation({
    description:
      'An administrator on the healthy installation of every operations area: host, containers (SOGo stopped, ClamAV unhealthy), logs, mail queue, ban service, Rspamd, update status (UI 011).',
  }),
  'domain-admin-operations': onInstallation({
    description: 'A domain administrator on the operations installation (UI 011 FR-001).',
    overrides: { signedInAs: 'reseller' },
  }),
  'mailbox-user-operations': onInstallation({
    description: 'A mailbox user on the operations installation (UI 011 FR-001).',
    overrides: { signedInAs: 'alice@example.org' },
  }),
  ...Object.fromEntries(
    Object.entries(areaScenarios).map(([name, definition]) => [name, onInstallation(definition)]),
  ),
}

export type { OperationInjection, OperationsPatch, OperationsState } from './state'
