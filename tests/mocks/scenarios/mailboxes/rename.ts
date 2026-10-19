// Scenarios of the mailbox rename (UI 003 US8, T111): the mailboxes of the mailbox page plus a
// taken target address, a domain at its alias limit, and mailboxes whose rename fails with each
// outcome: the webmail step failed and was undone (503), incomplete (500) and unknown (504).
import type { MailboxRenameStep } from '@/api'

import { GIB, mockDomain } from '../../factories/domain'
import { mockMailbox, seedMailboxes } from '../../factories/mailbox'
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'
import { setupMailboxPage } from './edit'

const steps = (
  outcomes: Partial<Record<MailboxRenameStep['step'], MailboxRenameStep['outcome']>>,
): MailboxRenameStep[] =>
  (
    [
      'sharedFolderPermissionsRemoval',
      'sharedStoreMove',
      'database',
      'mailStoreMove',
      'webmailRename',
      'sharedFolderPermissionsRecreation',
    ] as const
  ).map((step) => ({ step, outcome: outcomes[step] ?? 'notDone' }))

export function setupMailboxRename(state: ScenarioState): void {
  setupMailboxPage(state)
  const a = state.domains.find((domain) => domain.name === 'a.example')!
  a.aliasAddresses = ['taken@a.example']
  a.usage.aliases = 1
  state.domains.push(
    mockDomain({ name: 'full.example', maxMailboxes: 10, maxAliases: 1, domainQuota: 10 * GIB }),
  )
  const full = state.domains.find((domain) => domain.name === 'full.example')!
  full.aliasAddresses = ['only@full.example']
  full.usage.aliases = 1
  seedMailboxes(state, [
    mockMailbox({ localPart: 'fay', domain: 'full.example', quota: GIB }),
    mockMailbox({ localPart: 'webfail', domain: 'a.example', quota: GIB }),
    mockMailbox({ localPart: 'broken', domain: 'a.example', quota: GIB }),
    mockMailbox({ localPart: 'slow', domain: 'a.example', quota: GIB }),
  ])
  state.mailboxFailures['webfail@a.example'] = {
    status: 503,
    type: 'temporary-failure',
    operations: ['renameMailbox'],
    extra: {
      dependency: 'webmail',
      steps: steps({
        sharedFolderPermissionsRemoval: 'undone',
        sharedStoreMove: 'undone',
        database: 'undone',
        mailStoreMove: 'undone',
        webmailRename: 'failed',
        sharedFolderPermissionsRecreation: 'skipped',
      }),
    },
  }
  state.mailboxFailures['broken@a.example'] = {
    status: 500,
    type: 'mailbox-rename-incomplete',
    operations: ['renameMailbox'],
    extra: {
      previousAddress: 'broken@a.example',
      newAddress: 'broken.new@a.example',
      steps: steps({
        sharedFolderPermissionsRemoval: 'done',
        sharedStoreMove: 'done',
        database: 'undoFailed',
        mailStoreMove: 'failed',
      }),
    },
  }
  state.mailboxFailures['slow@a.example'] = {
    status: 504,
    type: 'outcome-unknown',
    operations: ['renameMailbox'],
    extra: {
      step: 'mailStoreMove',
      steps: steps({
        sharedFolderPermissionsRemoval: 'done',
        sharedStoreMove: 'done',
        database: 'done',
        mailStoreMove: 'unknown',
      }),
    },
  }
}

export const mailboxRenameScenarios: Record<string, ScenarioDefinition> = {
  'admin-rename': {
    description:
      'An administrator renaming mailboxes: anna@a.example, the inactive carl@a.example, the taken taken@a.example, full.example at its alias limit, and webfail, broken and slow@a.example failing with 503, 500 and 504 (UI 003 US8).',
    overrides: { signedInAs: 'admin' },
    setup: setupMailboxRename,
  },
}
