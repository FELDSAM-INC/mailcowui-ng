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
import { applyDnsOverrides, dnsScenarios, initialDnsState } from './dns'
// UI 006
import { applyQuarantineOverrides, initialQuarantineState, quarantineScenarios } from './quarantine'
import { quarantineAdminScenarios } from './quarantine-admin'
import { spamFilterScenarios } from './spam-filter'
import { applyMailboxOverrides, initialMailboxState, mailboxBaseScenarios } from './mailboxes/base'
import { mailboxBulkScenarios } from './mailboxes/bulk'
import { mailboxCreateScenarios } from './mailboxes/create'
import { mailboxDeleteScenarios } from './mailboxes/delete'
import { mailboxEditScenarios } from './mailboxes/edit'
import { mailboxHistoryScenarios } from './mailboxes/history'
import { mailboxListScenarios } from './mailboxes/list'
import { mailboxRenameScenarios } from './mailboxes/rename'
import { mailboxTemplateScenarios } from './mailboxes/templates'
import {
  applyFeature004Overrides,
  feature004BaseScenarios,
  initialState004,
} from './feature-004-base'
import { aliasesListScenarios } from './aliases-list'
import { aliasesCreateScenarios } from './aliases-create'
import { aliasesEditScenarios } from './aliases-edit'
import { aliasDomainScenarios } from './alias-domains'
import { senderSettingsScenarios } from './sender-settings'
import { bulk004Scenarios } from './bulk-004'
import { resourceScenarios } from './resources'
import { history004Scenarios } from './history-004'
import { publicConfig, PUBLIC_CONFIG_VARIANTS } from './public-config'
import { routingScenarios } from './routing'
import { rateLimitScenarios } from './rate-limits'
import { applyRoutingOverrides, initialRoutingState } from './routing/state'
import { navigationScenarios } from './navigation'
import { applyOperationsPatch, initialOperationsState, operationsScenarios } from './operations'
import { passkeySignInScenarios } from './passkey-sign-in'
import { passkeyScenarios } from './passkeys'
import { pendingActionScenarios } from './pending-actions'
import { preferenceScenarios } from './preferences'
import { signInScenarios } from './sign-in'
import { apiKeyScenarios } from './api-keys'
import { applySyncJobChanges, initialSyncJobState, syncJobScenarios } from './sync-jobs'
import { auditIdentityProviderScenarios } from './audit-identity-provider'
import { identityProviderScenarios } from './identity-provider'
import { oauth2ClientScenarios } from './oauth2-clients'
import { providerPasswordScenarios } from './provider-password'
import { singleSignOnScenarios } from './single-sign-on'
import { initialIdentityProvider } from '../factories/identity-provider'
import { OAUTH2_CAPABILITIES } from '../factories/oauth2-client'
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
  ...mailboxListScenarios,
  ...mailboxDeleteScenarios,
  ...mailboxRenameScenarios,
  ...mailboxBulkScenarios,
  ...mailboxCreateScenarios,
  ...mailboxHistoryScenarios,
  ...mailboxTemplateScenarios,
  ...syncJobScenarios,
  // UI 012
  ...identityProviderScenarios,
  ...singleSignOnScenarios,
  ...providerPasswordScenarios,
  ...oauth2ClientScenarios,
  ...auditIdentityProviderScenarios,
  // UI 004
  ...feature004BaseScenarios,
  ...aliasesListScenarios,
  ...aliasesCreateScenarios,
  ...aliasesEditScenarios,
  ...aliasDomainScenarios,
  ...senderSettingsScenarios,
  ...bulk004Scenarios,
  ...resourceScenarios,
  ...history004Scenarios,
  ...dnsScenarios,
  ...routingScenarios,
  // UI 011: one module per area under ./operations/ (T013).
  ...operationsScenarios,
  ...rateLimitScenarios,
  // UI 006
  ...quarantineScenarios,
  ...quarantineAdminScenarios,
  ...spamFilterScenarios,
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

/** UI 012: identity provider, single sign-on, OAuth2 and template data (research R24). */
function applyIdentityProviderOverrides(state: ScenarioState, overrides: ScenarioPatch): void {
  if (overrides.identityProvider) {
    const { capabilities, ...rest } = overrides.identityProvider
    state.identityProvider = { ...state.identityProvider, ...rest }
    if (capabilities) {
      state.identityProvider.capabilities = {
        ...state.identityProvider.capabilities,
        ...capabilities,
      }
    }
  }
  if (overrides.singleSignOn) {
    state.singleSignOn = { ...state.singleSignOn, ...overrides.singleSignOn }
  }
  if (overrides.oauth2Clients) state.oauth2Clients = structuredClone(overrides.oauth2Clients)
  if (overrides.oauth2Capabilities) {
    state.oauth2Capabilities = { ...state.oauth2Capabilities, ...overrides.oauth2Capabilities }
  }
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
  if (overrides.syncJobs) applySyncJobChanges(state, overrides.syncJobs)
  applyIdentityProviderOverrides(state, overrides)
  applyFeature004Overrides(state, overrides)
  if (overrides.dns) applyDnsOverrides(state, overrides.dns)
  applyRoutingOverrides(state, overrides.routing)
  if (overrides.operations) applyOperationsPatch(state, overrides.operations)
  applyQuarantineOverrides(state, overrides)
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
    syncJobs: initialSyncJobState(),
    identityProvider: initialIdentityProvider(),
    singleSignOn: {
      pending: null,
      completion: 'success',
      username: 'anna@example.org',
      provider: 'keycloak',
      startNotAvailable: false,
      endIdpSession: false,
      providerOutage: false,
      counter: 0,
    },
    oauth2Clients: [],
    oauth2Capabilities: { ...OAUTH2_CAPABILITIES },
    ...initialState004(),
    ...initialDnsState(),
    ...initialRoutingState(),
    operations: initialOperationsState(),
    ...initialQuarantineState(),
  }
  definition.setup?.(state)
  applyOverrides(state, structuredClone(definition.overrides ?? {}))
  applyOverrides(state, structuredClone(overrides))
  return state
}

export type { RecordedRequest, ScenarioOverrides, ScenarioPatch, ScenarioState } from './state'
