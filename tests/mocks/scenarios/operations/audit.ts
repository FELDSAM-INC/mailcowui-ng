// Audit area of the operations scenarios (UI 011 T013, T136): the audit records of this feature's
// targets that the History screens read.
import { operationsAuditEvents } from '../../factories/audit-event'
import type { ScenarioDefinition } from '../index'

/** Scenarios of this area; `setup` runs after the seed of every area. */
export const auditScenarioDefinitions: Record<string, ScenarioDefinition> = {
  'ops-audit-records': {
    description:
      'An administrator with audit records of every UI 011 event type: container actions with the state before and after, queue deletions of 4 and 400 IDs, ban settings and rules changes, ban actions and the ban list rotation.',
    setup(state) {
      state.auditEvents = [...operationsAuditEvents(), ...state.auditEvents]
    },
  },
}
