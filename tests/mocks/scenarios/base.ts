// Base scenarios of the foundation (T025). Later stories add their own area modules
// (tests/mocks/scenarios/<area>.ts) and register them in index.ts.
import type { ScenarioDefinition } from './index'

export const baseScenarios: Record<string, ScenarioDefinition> = {
  'anonymous-default': {
    description: 'Nobody signed in; default public configuration; the standard accounts.',
  },
  'admin-active': {
    description: 'An administrator with an active session.',
    overrides: { signedInAs: 'admin' },
  },
  'config-unavailable': {
    description: 'GET /public-config answers its documented 500 (FR-003 defaults apply).',
    overrides: { failures: { getPublicConfig: { status: 500 } } },
  },
  'bootstrap-500': {
    description: 'GET /session answers its documented 500 (the "API not ready" page).',
    overrides: { failures: { getSession: { status: 500 } } },
  },
}
