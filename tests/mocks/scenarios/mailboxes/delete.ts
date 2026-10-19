// Scenarios of the mailbox deletion (UI 003 US4, T079): the 30 mailboxes of the list plus a mailbox
// using 2 GiB in 10,000 messages with dependents and aliases, one whose mail store fails, and one
// whose deletion times out; and a preview with blockers. "Changed elsewhere" and "deleted
// elsewhere" are the control changes of T011 (`mailboxes.set`, `mailboxes.remove`).
import { GIB } from '../../factories/domain'
import { mockMailbox, seedMailboxes } from '../../factories/mailbox'
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'
import { setupMailboxList } from './list'

export function setupMailboxDeletion(state: ScenarioState): void {
  setupMailboxList(state)
  seedMailboxes(state, [
    mockMailbox({
      localPart: 'big',
      domain: 'a.example',
      displayName: 'Big Mailbox',
      quota: 5 * GIB,
      quotaUsed: 2 * GIB,
      messageCount: 10_000,
      tags: ['Sales', 'Staff'],
      dependents: { appPasswords: 2, passkeys: 1, syncJobs: 1, sieveFilters: 3 },
      exclusiveAliases: ['info@a.example'],
      sharedAliases: ['team@a.example', 'all@a.example'],
      present: { webmailData: true },
    }),
    mockMailbox({ localPart: 'broken', domain: 'a.example', displayName: 'Broken', quota: GIB }),
    mockMailbox({ localPart: 'slow', domain: 'a.example', displayName: 'Slow', quota: GIB }),
  ])
  state.mailboxFailures['broken@a.example'] = {
    status: 503,
    type: 'temporary-failure',
    operations: ['deleteMailbox'],
    extra: { dependency: 'mailStore' },
  }
  state.mailboxFailures['slow@a.example'] = {
    status: 504,
    type: 'outcome-unknown',
    operations: ['deleteMailbox'],
    extra: { step: 'mailStoreCleanup' },
  }
}

export const mailboxDeleteScenarios: Record<string, ScenarioDefinition> = {
  'admin-delete': {
    description:
      'An administrator with the 30 list mailboxes, big@a.example (2 GiB, 10,000 messages, dependents), broken@a.example (mail store down) and slow@a.example (times out) (UI 003 US4).',
    overrides: { signedInAs: 'admin' },
    setup: setupMailboxDeletion,
  },
  'delete-store-unreachable': {
    description:
      'The deletion preview of big@a.example names the unreachable mail store (UI 003 US4).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => {
      setupMailboxDeletion(state)
      state.mailboxFailures['preview:big@a.example'] = {
        status: 503,
        times: 1,
        extra: { dependency: 'mailStore' },
      }
    },
  },
}
