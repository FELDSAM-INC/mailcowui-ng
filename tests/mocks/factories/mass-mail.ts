import type { MassMailJob, MassMailRecipient } from '@/api'

export const massMailId = (n = 1) => `01JQ${String(n).padStart(22, '0')}`
export function mockMassMailJob(overrides: Partial<MassMailJob> = {}): MassMailJob {
  return {
    id: massMailId(),
    status: 'running',
    sender: 'noreply@mail.example.org',
    subject: 'Maintenance',
    textBody: 'A maintenance notice.',
    htmlBody: '<p>A maintenance notice.</p>',
    selection: {},
    recipientCount: 120,
    counts: { delivered: 0, failed: 0, skipped: 0, pending: 120 },
    createdBy: { username: 'admin' },
    createdAt: '2026-10-20T08:00:00Z',
    startedAt: '2026-10-20T08:00:01Z',
    finishedAt: null,
    cancelledBy: null,
    ...overrides,
  }
}
export function mockMassMailRecipient(
  address: string,
  overrides: Partial<MassMailRecipient> = {},
): MassMailRecipient {
  return {
    address,
    outcome: 'pending',
    failureCode: null,
    failureReason: null,
    attempts: 0,
    lastAttemptAt: null,
    ...overrides,
  }
}
