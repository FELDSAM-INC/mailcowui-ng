// UI 002 US2 scenarios (T046): creating a domain from a template, and the creation report.
import { GIB, mockDomain } from '../factories/domain'
import { mockTemplate } from '../factories/domain-template'
import type { ScenarioDefinition } from './index'
import type { ScenarioState } from './state'

/** Default and "Reseller" (50 mailboxes, 50 GiB), the domain taken.example and an alias domain. */
export function setupDomainCreate(state: ScenarioState): void {
  state.domainTemplates = [
    mockTemplate({ id: 1, name: 'Default' }),
    mockTemplate({
      id: 2,
      name: 'Reseller',
      maxMailboxes: 50,
      maxAliases: 500,
      domainQuota: 50 * GIB,
      maxMailboxQuota: 10 * GIB,
      tags: ['reseller'],
      rateLimit: { value: 100, frame: 'hour' },
      dkimKeySize: 4096,
    }),
  ]
  state.domains = [mockDomain({ name: 'taken.example' })]
  state.aliasDomains = [{ name: 'alias.example', target: 'taken.example' }]
}

export const domainsCreateScenarios: Record<string, ScenarioDefinition> = {
  'domain-create': {
    description:
      'Templates Default and Reseller, the domain taken.example and the alias domain alias.example.',
    setup: setupDomainCreate,
    overrides: { signedInAs: 'admin' },
  },
  'creation-report-mixed': {
    description: 'Creating a domain reports a failed groupware restart and an existing DKIM key.',
    setup(state) {
      setupDomainCreate(state)
      state.creationReport = {
        groupwareRestart: 'failed',
        dkimKey: 'alreadyExisted',
        dkimDnsPublication: 'skipped',
      }
    },
    overrides: { signedInAs: 'admin' },
  },
  'groupware-disabled': {
    description: 'The groupware is disabled: no Global Address List flag or restart option.',
    setup: setupDomainCreate,
    overrides: { signedInAs: 'admin', capabilities: { groupwareEnabled: false } },
  },
  'templates-none': {
    description: 'No domain template at all: the built-in values apply.',
    setup(state) {
      setupDomainCreate(state)
      state.domainTemplates = []
    },
    overrides: { signedInAs: 'admin' },
  },
  'create-temporary-failure': {
    description: 'createDomain answers 503 temporary-failure once.',
    setup: setupDomainCreate,
    overrides: {
      signedInAs: 'admin',
      failures: {
        createDomain: { status: 503, type: 'temporary-failure', retryAfter: 5, times: 1 },
      },
    },
  },
  'dkim-feldhost': {
    description: "The server's default DKIM selector is feldhost.",
    setup: setupDomainCreate,
    overrides: { signedInAs: 'admin', capabilities: { dkim: { defaultSelector: 'feldhost' } } },
  },
}
