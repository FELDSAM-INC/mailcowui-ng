import type { ScenarioDefinition } from './index'

export const settingsRspamdScenarios: Record<string, ScenarioDefinition> = {
  'rspamd-ui-service-fails': {
    description: 'The Rspamd container service cannot confirm password change and restart.',
    overrides: {
      signedInAs: 'admin',
      failures: {
        setRspamdUiPassword: {
          status: 502,
          type: 'container-action-failed',
          extra: { container: 'rspamd-mailcow' },
        },
      },
    },
  },
  'rspamd-ui-outcome-unknown': {
    description: 'The container service times out with an unknown Rspamd password outcome.',
    overrides: {
      signedInAs: 'admin',
      failures: {
        setRspamdUiPassword: {
          status: 504,
          type: 'outcome-unknown',
          extra: { step: 'rspamdUiPassword' },
        },
      },
    },
  },
}
