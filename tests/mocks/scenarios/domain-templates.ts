// UI 002 US6 scenarios (T078): the template list, its empty and error states, and the templates
// the add and edit tests use. Multiple deletion waits for the API's bulk operation (gap G40).
import { GIB } from '../factories/domain'
import { mockTemplate } from '../factories/domain-template'
import { defaultTemplate, scenarioTime } from './domains-base'
import type { ScenarioDefinition } from './index'
import type { ScenarioState } from './state'

function setupTemplates(state: ScenarioState): void {
  state.domainTemplates = [
    defaultTemplate(),
    mockTemplate({
      id: 2,
      name: 'Small',
      maxMailboxes: 5,
      maxAliases: 50,
      maxMailboxQuota: 2 * GIB,
      domainQuota: 10 * GIB,
      createdAt: scenarioTime(3),
      modifiedAt: scenarioTime(5),
    }),
    mockTemplate({
      id: 3,
      name: 'Reseller',
      tags: ['reseller', 'gold'],
      maxMailboxes: 50,
      maxAliases: 500,
      domainQuota: 50 * GIB,
      rateLimit: { value: 100, frame: 'hour' },
      globalAddressList: false,
      backupMx: true,
      dkimSelector: '',
      dkimKeySize: 1024,
      createdAt: scenarioTime(4),
    }),
    ...Array.from({ length: 30 }, (_, index) =>
      mockTemplate({
        id: 4 + index,
        name: `Package ${String(index + 1).padStart(2, '0')}`,
        maxMailboxes: 10 + index,
        createdAt: scenarioTime(6 + (index % 20)),
      }),
    ),
  ]
}

export const domainTemplateScenarios: Record<string, ScenarioDefinition> = {
  templates: {
    description:
      'An administrator with the Default, "Small" and "Reseller" templates and 30 more for paging (UI 002 US6).',
    setup: setupTemplates,
    overrides: { signedInAs: 'admin' },
  },
  'templates-empty': {
    description: 'An administrator without any template.',
    setup(state) {
      state.domainTemplates = []
    },
    overrides: { signedInAs: 'admin' },
  },
  'templates-list-error': {
    description: 'listDomainTemplates answers its documented 500.',
    setup: setupTemplates,
    overrides: { signedInAs: 'admin', failures: { listDomainTemplates: { status: 500 } } },
  },
}
