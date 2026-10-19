// Scenario registry of the mock API (research R22). It aggregates one module per area, so that
// parallel stories never edit the same scenario file: each story adds `./<area>.ts` and one line
// below.
import { randomUUID } from 'node:crypto'

import type { ApiKey, AuditEvent, PublicConfig } from '@/api'

import { ViolationRecorder } from '../contract/validator'
import { standardAccounts, adminAccount, domainAdminAccount, mailboxAccount } from './accounts'
import { auditLogScenarios } from './audit-log'
import { baseScenarios } from './base'
import {
  applyDomainMutations,
  applyFooterMutations,
  applyTemplateMutations,
  assignDomains,
  domainsBaseScenarios,
  initialDomainState,
} from './domains-base'
import { domainTemplateScenarios } from './domain-templates'
import { domainsBulkScenarios } from './domains-bulk'
import { domainsCreateScenarios } from './domains-create'
import { domainsDeleteScenarios } from './domains-delete'
import { domainsEditScenarios } from './domains-edit'
import { domainsFooterScenarios } from './domains-footer'
import { domainsHistoryScenarios } from './domains-history'
import { domainsListScenarios } from './domains-list'
import { applyMailboxOverrides, initialMailboxState, mailboxBaseScenarios } from './mailboxes/base'
import { mailboxEditScenarios } from './mailboxes/edit'
import { publicConfig, PUBLIC_CONFIG_VARIANTS } from './public-config'
import { navigationScenarios } from './navigation'
import { passkeySignInScenarios } from './passkey-sign-in'
import { passkeyScenarios } from './passkeys'
import { pendingActionScenarios } from './pending-actions'
import { preferenceScenarios } from './preferences'
import { signInScenarios } from './sign-in'
import { apiKeyScenarios } from './api-keys'
import {
  anonymousSession,
  DEFAULT_IDLE_TIMEOUT,
  defaultBehaviour,
  endSession,
  findAccount,
  signIn,
  type MockAccount,
  type ScenarioOverrides,
  type ScenarioPatch,
  type ScenarioState,
} from './state'

export interface ScenarioDefinition {
  description: string
  overrides?: ScenarioOverrides
  /** Builds data in code when the scenario is created (UI 002: domains), before the overrides. */
  setup?: (state: ScenarioState) => void
}

export const scenarios: Record<string, ScenarioDefinition> = {
  ...baseScenarios,
  ...signInScenarios,
  ...passkeySignInScenarios,
  ...navigationScenarios,
  ...passkeyScenarios,
  ...pendingActionScenarios,
  ...preferenceScenarios,
  ...apiKeyScenarios,
  ...auditLogScenarios,
  ...domainsBaseScenarios,
  ...domainsListScenarios,
  ...domainsCreateScenarios,
  ...domainsEditScenarios,
  ...domainsDeleteScenarios,
  ...domainsBulkScenarios,
  ...domainTemplateScenarios,
  ...domainsFooterScenarios,
  ...domainsHistoryScenarios,
  ...mailboxBaseScenarios,
  ...mailboxEditScenarios,
}

function resolvePublicConfig(value: ScenarioOverrides['publicConfig']): PublicConfig {
  if (value === undefined) return publicConfig('default')
  if (typeof value === 'string') {
    if (!PUBLIC_CONFIG_VARIANTS.includes(value))
      throw new Error(`Unknown public config variant ${value}`)
    return publicConfig(value)
  }
  return { ...publicConfig('default'), ...value }
}

function applyAccounts(state: ScenarioState, changes: Record<string, Partial<MockAccount>>): void {
  for (const [username, change] of Object.entries(changes)) {
    const existing = findAccount(state, username)
    if (existing) {
      Object.assign(existing, change)
      continue
    }
    const role = change.role ?? 'mailboxUser'
    const created =
      role === 'admin'
        ? adminAccount({ username, ...change })
        : role === 'domainAdmin'
          ? domainAdminAccount({ username, ...change })
          : mailboxAccount({ username, ...change })
    state.accounts.push(created)
  }
}

/** UI 002: domain data, capabilities, failures and delays (research D28). */
function applyDomainOverrides(state: ScenarioState, overrides: ScenarioPatch): void {
  if (overrides.capabilities) {
    const { dkim, ...rest } = overrides.capabilities
    state.domainCapabilities = {
      ...state.domainCapabilities,
      ...rest,
      ...(dkim ? { dkim: { ...state.domainCapabilities.dkim!, ...dkim } } : {}),
    }
  }
  if (overrides.creationReport) {
    state.creationReport = { ...state.creationReport, ...overrides.creationReport }
  }
  if (overrides.domainFailures) {
    state.domainFailures = { ...state.domainFailures, ...overrides.domainFailures }
  }
  if (overrides.delays) state.delays = { ...state.delays, ...overrides.delays }
  if (overrides.aliasDomains) state.aliasDomains = structuredClone(overrides.aliasDomains)
  if (overrides.dkimKeys) state.dkimKeys = [...overrides.dkimKeys]
  for (const [username, names] of Object.entries(overrides.domainAssignments ?? {})) {
    assignDomains(state, username, names)
  }
  if (overrides.domains) applyDomainMutations(state, overrides.domains)
  if (overrides.templates) applyTemplateMutations(state, overrides.templates)
  if (overrides.footers) applyFooterMutations(state, overrides.footers)
}

/** Applies JSON overrides or runtime patches to a state. */
export function applyOverrides(
  state: ScenarioState,
  overrides: ScenarioPatch & { signedInAs?: string },
): void {
  if (overrides.publicConfig !== undefined)
    state.publicConfig = resolvePublicConfig(overrides.publicConfig)
  if (overrides.idleTimeout !== undefined) state.idleTimeout = overrides.idleTimeout
  if (overrides.behaviour) state.behaviour = { ...state.behaviour, ...overrides.behaviour }
  if (overrides.failures) state.failures = { ...state.failures, ...overrides.failures }
  if (overrides.accounts) applyAccounts(state, overrides.accounts)
  if (overrides.apiKeys) state.apiKeys = structuredClone<ApiKey[]>(overrides.apiKeys)
  if (overrides.auditEvents)
    state.auditEvents = structuredClone<AuditEvent[]>(overrides.auditEvents)
  applyDomainOverrides(state, overrides)
  applyMailboxOverrides(state, overrides)
  if (overrides.signedInAs) {
    const account = findAccount(state, overrides.signedInAs)
    if (!account) throw new Error(`Unknown account ${overrides.signedInAs}`)
    signIn(state, account, 'password')
  }
  if (overrides.session) state.session = { ...state.session, ...overrides.session }
  if (overrides.expireSession) endSession(state)
}

/** Creates a fresh, isolated state for a registered scenario name plus overrides. */
export function createScenarioState(
  name: string,
  overrides: ScenarioOverrides = {},
  options: { id?: string; now?: () => number } = {},
): ScenarioState {
  const definition = scenarios[name]
  if (!definition) throw new Error(`Unknown scenario "${name}"`)
  const now = options.now ?? (() => Date.now())
  const state: ScenarioState = {
    id: options.id ?? randomUUID(),
    name,
    accounts: standardAccounts(),
    apiKeys: [],
    auditEvents: [],
    publicConfig: publicConfig('default'),
    idleTimeout: DEFAULT_IDLE_TIMEOUT,
    session: anonymousSession(now()),
    behaviour: defaultBehaviour(),
    failedSignIns: 0,
    failures: {},
    requests: [],
    violations: new ViolationRecorder(),
    now,
    ...initialDomainState(),
    ...initialMailboxState(),
  }
  definition.setup?.(state)
  applyOverrides(state, structuredClone(definition.overrides ?? {}))
  applyOverrides(state, structuredClone(overrides))
  return state
}

export type { RecordedRequest, ScenarioOverrides, ScenarioPatch, ScenarioState } from './state'
