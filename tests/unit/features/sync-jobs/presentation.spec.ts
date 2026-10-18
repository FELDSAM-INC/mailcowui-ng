// Presentation of a sync job (UI 008 T016, data-model §2, plan legacy form map): the job label,
// the status, the last run and the last result as the classic tables show them, with the keys of
// the administrators' table (`mailbox.*`) or the mailbox user's table (`user.*`).
import { describe, expect, it } from 'vitest'

import type { SyncJobRunStatus } from '@/api'
import {
  jobLabel,
  lastRunView,
  listTexts,
  resultView,
  statusView,
} from '@/features/sync-jobs/presentation'

const run = (overrides: Partial<SyncJobRunStatus> = {}): SyncJobRunStatus => ({
  lastRunAt: '2026-10-18T07:30:00.000Z',
  lastResult: 'succeeded',
  exitStatus: 'EX_OK',
  running: false,
  logAvailable: true,
  ...overrides,
})

const CODES = [
  'EXIT_CONNECTION_FAILURE',
  'EXIT_CONNECTION_FAILURE_HOST1',
  'EXIT_TLS_FAILURE',
  'EXIT_AUTHENTICATION_FAILURE',
  'EXIT_AUTHENTICATION_FAILURE_USER1',
  'EXIT_OVERQUOTA',
] as const

describe('jobLabel', () => {
  it('is user@host:port, the classic "Server" column', () => {
    expect(jobLabel({ remoteUser: 'alice', remoteHost: 'imap.example', remotePort: 993 })).toBe(
      'alice@imap.example:993',
    )
  })
})

describe('resultView', () => {
  it('shows nothing without a result', () => {
    expect(resultView(run({ lastResult: 'unknown', exitStatus: null }), 'admin')).toEqual({
      kind: 'none',
    })
  })

  it('reads "Success" with a check for a recognised success', () => {
    expect(resultView(run(), 'admin')).toEqual({
      kind: 'succeeded',
      text: { legacy: 'mailbox.syncjob_EX_OK' },
      checkLog: false,
    })
    expect(resultView(run(), 'mailboxUser')).toMatchObject({
      text: { legacy: 'user.syncjob_EX_OK' },
    })
  })

  it.each(CODES)('reads the legacy reason of %s with a cross', (code) => {
    expect(resultView(run({ lastResult: 'failed', exitStatus: code }), 'domainAdmin')).toEqual({
      kind: 'failed',
      text: { legacy: `mailbox.syncjob_${code}` },
      checkLog: false,
    })
    expect(
      resultView(run({ lastResult: 'failed', exitStatus: code }), 'mailboxUser'),
    ).toMatchObject({
      text: { legacy: `user.syncjob_${code}` },
    })
  })

  it('reads "Check log" for an unknown code or none, as the classic interface does', () => {
    for (const exitStatus of ['EXIT_WHATEVER', null]) {
      expect(resultView(run({ lastResult: 'failed', exitStatus }), 'admin')).toEqual({
        kind: 'failed',
        text: { legacy: 'mailbox.syncjob_check_log' },
        checkLog: true,
      })
    }
    // A success with an unrecognised code also reads "Check log" (plan deviation 2 is open).
    expect(resultView(run({ exitStatus: 'EXIT_NEW' }), 'admin')).toEqual({
      kind: 'succeeded',
      text: { legacy: 'mailbox.syncjob_check_log' },
      checkLog: true,
    })
  })
})

describe('lastRunView', () => {
  it('is the time of the last run, or "Waiting" without one (plan deviation 1 is open)', () => {
    expect(lastRunView(run(), 'admin')).toEqual({ kind: 'time', at: '2026-10-18T07:30:00.000Z' })
    for (const logAvailable of [true, false]) {
      expect(lastRunView(run({ lastRunAt: null, logAvailable }), 'admin')).toEqual({
        kind: 'text',
        text: { legacy: 'mailbox.waiting' },
      })
    }
    expect(lastRunView(run({ lastRunAt: null }), 'mailboxUser')).toMatchObject({
      text: { legacy: 'user.waiting' },
    })
  })
})

describe('statusView', () => {
  it('is Running or Waiting, independent of the active flag', () => {
    expect(statusView(true, 'admin')).toEqual({
      running: true,
      text: { legacy: 'mailbox.running' },
    })
    expect(statusView(false, 'admin')).toEqual({
      running: false,
      text: { legacy: 'mailbox.waiting' },
    })
    expect(statusView(true, 'mailboxUser').text).toEqual({ legacy: 'user.running' })
  })
})

describe('listTexts', () => {
  it("uses the administrators' table keys or the mailbox user's", () => {
    expect(listTexts('admin').title).toEqual({ legacy: 'mailbox.sync_jobs' })
    expect(listTexts('domainAdmin').lastRun).toEqual({ legacy: 'mailbox.last_run' })
    expect(listTexts('mailboxUser').title).toEqual({ legacy: 'user.sync_jobs' })
    expect(listTexts('mailboxUser').openLogs).toEqual({ legacy: 'user.open_logs' })
  })
})
