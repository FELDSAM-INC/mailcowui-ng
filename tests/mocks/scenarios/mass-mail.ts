import type { MassMailJob, MassMailRecipient } from '@/api'
import { mockResource } from '../factories/resource'
import { mockDomain } from '../factories/domain'
import { mockMailbox, addressOf } from '../factories/mailbox'
import { mockMassMailJob, mockMassMailRecipient } from '../factories/mass-mail'
import type { ScenarioDefinition } from './index'
import type { ScenarioState } from './state'

export interface MassMailState {
  jobs: MassMailJob[]
  recipients: Record<string, MassMailRecipient[]>
  step: number
}
export const initialMassMailState = (): MassMailState => ({ jobs: [], recipients: {}, step: 0 })
function setupMailboxes(state: ScenarioState) {
  const domains = ['example.org', 'example.net', 'example.com']
  state.resources = Array.from({ length: 4 }, (_, i) =>
    mockResource({ description: `Room ${i + 1}` }),
  )
  state.domains = domains.map((name) => mockDomain({ name }))
  state.mailboxes = Array.from({ length: 120 }, (_, i) =>
    mockMailbox({
      localPart: `user${String(i + 1).padStart(3, '0')}`,
      domain: domains[Math.floor(i / 40)]!,
      status: i % 2 ? 'loginDisabled' : 'active',
    }),
  )
  state.mailboxes.push(
    mockMailbox({ localPart: 'inactive', domain: 'example.org', status: 'inactive' }),
    mockMailbox({ localPart: 'inactive2', domain: 'example.org', status: 'inactive' }),
  )
}
function setupJob(state: ScenarioState, status: MassMailJob['status']) {
  setupMailboxes(state)
  const job = mockMassMailJob({ status })
  const recipients = state.mailboxes
    .filter((m) => m.status !== 'inactive')
    .map((m) => mockMassMailRecipient(addressOf(m)))
  if (status === 'completed') {
    const failures = [
      'overQuota',
      'mailboxUnavailable',
      'rejected',
      'temporaryFailurePersisted',
      'connectionFailed',
      'interrupted',
    ] as const
    recipients.forEach((entry, i) =>
      Object.assign(entry, {
        outcome: i < failures.length ? 'failed' : 'delivered',
        failureCode: failures[i] ?? null,
        failureReason:
          i < failures.length ? '550 private SMTP diagnostic must not be rendered' : null,
        attempts: 1,
        lastAttemptAt: '2026-10-20T08:01:00Z',
      }),
    )
    job.counts = { delivered: 114, failed: 6, skipped: 0, pending: 0 }
    job.finishedAt = '2026-10-20T08:01:00Z'
  } else if (status === 'cancelled') {
    recipients.forEach((entry) => {
      entry.outcome = 'skipped'
    })
    job.counts = { delivered: 0, failed: 0, skipped: 120, pending: 0 }
    job.cancelledBy = { username: 'admin' }
    job.finishedAt = '2026-10-20T08:01:00Z'
  }
  state.massMail.jobs = [job]
  state.massMail.recipients[job.id] = recipients
}
export const massMailScenarios: Record<string, ScenarioDefinition> = {
  'mass-mail-none': {
    description: 'No previous mass mail jobs.',
    overrides: { signedInAs: 'admin' },
  },
  'mass-mail-120': {
    description: '120 receiving mailboxes across three domains plus inactive mailboxes.',
    setup: setupMailboxes,
    overrides: { signedInAs: 'admin' },
  },
  'mass-mail-running': {
    description: 'An active job whose progress can be advanced explicitly.',
    setup: (state) => setupJob(state, 'running'),
    overrides: { signedInAs: 'admin' },
  },
  'mass-mail-completed': {
    description: 'A completed job with every stable delivery failure code.',
    setup: (state) => setupJob(state, 'completed'),
    overrides: { signedInAs: 'admin' },
  },
  'mass-mail-cancelled': {
    description: 'A cancelled job with skipped recipients.',
    setup: (state) => setupJob(state, 'cancelled'),
    overrides: { signedInAs: 'admin' },
  },
}
