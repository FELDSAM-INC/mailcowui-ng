// How a sync job reads in the lists, the job page and the log viewer (UI 008 data-model §2, plan
// legacy form map part 1). It mirrors `draw_sync_job_table` of the classic interface: the
// administrators' and domain administrators' table uses the `mailbox.*` keys, the mailbox user's
// table the `user.*` keys. The last run without a time reads "Waiting" and an unrecognised result
// code "Check log", as the classic interface shows them (plan deviations 1 and 2 are open).
import type { Role, SyncJob, SyncJobRunStatus } from '@/api'
import { legacy, type LegacyRef } from '@/i18n'

/** `user@host:port`, the classic "Server" column; the job's name in headings and dialogs. */
export function jobLabel(job: Pick<SyncJob, 'remoteUser' | 'remoteHost' | 'remotePort'>): string {
  return `${job.remoteUser}@${job.remoteHost}:${job.remotePort}`
}

type Table = 'mailbox' | 'user'
const tableOf = (role: Role): Table => (role === 'mailboxUser' ? 'user' : 'mailbox')

const CODES = [
  'EX_OK',
  'EXIT_CONNECTION_FAILURE',
  'EXIT_CONNECTION_FAILURE_HOST1',
  'EXIT_TLS_FAILURE',
  'EXIT_AUTHENTICATION_FAILURE',
  'EXIT_AUTHENTICATION_FAILURE_USER1',
  'EXIT_OVERQUOTA',
] as const
type Code = (typeof CODES)[number]

const RESULT_TEXTS: Record<Table, Record<Code | 'checkLog', LegacyRef>> = {
  mailbox: {
    EX_OK: legacy('mailbox.syncjob_EX_OK'),
    EXIT_CONNECTION_FAILURE: legacy('mailbox.syncjob_EXIT_CONNECTION_FAILURE'),
    EXIT_CONNECTION_FAILURE_HOST1: legacy('mailbox.syncjob_EXIT_CONNECTION_FAILURE_HOST1'),
    EXIT_TLS_FAILURE: legacy('mailbox.syncjob_EXIT_TLS_FAILURE'),
    EXIT_AUTHENTICATION_FAILURE: legacy('mailbox.syncjob_EXIT_AUTHENTICATION_FAILURE'),
    EXIT_AUTHENTICATION_FAILURE_USER1: legacy('mailbox.syncjob_EXIT_AUTHENTICATION_FAILURE_USER1'),
    EXIT_OVERQUOTA: legacy('mailbox.syncjob_EXIT_OVERQUOTA'),
    checkLog: legacy('mailbox.syncjob_check_log'),
  },
  user: {
    EX_OK: legacy('user.syncjob_EX_OK'),
    EXIT_CONNECTION_FAILURE: legacy('user.syncjob_EXIT_CONNECTION_FAILURE'),
    EXIT_CONNECTION_FAILURE_HOST1: legacy('user.syncjob_EXIT_CONNECTION_FAILURE_HOST1'),
    EXIT_TLS_FAILURE: legacy('user.syncjob_EXIT_TLS_FAILURE'),
    EXIT_AUTHENTICATION_FAILURE: legacy('user.syncjob_EXIT_AUTHENTICATION_FAILURE'),
    EXIT_AUTHENTICATION_FAILURE_USER1: legacy('user.syncjob_EXIT_AUTHENTICATION_FAILURE_USER1'),
    EXIT_OVERQUOTA: legacy('user.syncjob_EXIT_OVERQUOTA'),
    checkLog: legacy('user.syncjob_check_log'),
  },
}

const isCode = (value: string | null): value is Code =>
  value !== null && (CODES as readonly string[]).includes(value)

export type ResultView =
  { kind: 'none' } | { kind: 'succeeded' | 'failed'; text: LegacyRef; checkLog: boolean }

/**
 * The last run result: nothing without one; otherwise a check or a cross (the result) and the
 * text of a recognised exit code, or "Check log" with a way to the log.
 */
export function resultView(run: SyncJobRunStatus, role: Role): ResultView {
  if (run.lastResult === 'unknown') return { kind: 'none' }
  const texts = RESULT_TEXTS[tableOf(role)]
  const known = isCode(run.exitStatus)
  return {
    kind: run.lastResult,
    text: known ? texts[run.exitStatus as Code] : texts.checkLog,
    checkLog: !known,
  }
}

export type LastRunView = { kind: 'time'; at: string } | { kind: 'text'; text: LegacyRef }

export function lastRunView(run: SyncJobRunStatus, role: Role): LastRunView {
  if (run.lastRunAt) return { kind: 'time', at: run.lastRunAt }
  return { kind: 'text', text: listTexts(role).waiting }
}

/** The status column: Running or Waiting, whatever the active flag says (both are shown). */
export function statusView(running: boolean, role: Role): { running: boolean; text: LegacyRef } {
  const texts = listTexts(role)
  return { running, text: running ? texts.running : texts.waiting }
}

const MAILBOX_TEXTS = {
  title: legacy('mailbox.sync_jobs'),
  owner: legacy('mailbox.owner'),
  lastRun: legacy('mailbox.last_run'),
  result: legacy('mailbox.syncjob_last_run_result'),
  active: legacy('mailbox.active'),
  status: legacy('mailbox.status'),
  running: legacy('mailbox.running'),
  waiting: legacy('mailbox.waiting'),
  excludes: legacy('mailbox.excludes'),
  interval: legacy('mailbox.mins_interval'),
  action: legacy('mailbox.action'),
  edit: legacy('mailbox.edit'),
  remove: legacy('mailbox.remove'),
  openLogs: legacy('mailbox.open_logs'),
  username: legacy('user.username'),
  encryption: legacy('user.encryption'),
}

const USER_TEXTS: typeof MAILBOX_TEXTS = {
  ...MAILBOX_TEXTS,
  title: legacy('user.sync_jobs'),
  lastRun: legacy('user.last_run'),
  result: legacy('user.syncjob_last_run_result'),
  active: legacy('user.active'),
  status: legacy('user.status'),
  running: legacy('user.running'),
  waiting: legacy('user.waiting'),
  excludes: legacy('user.excludes'),
  interval: legacy('user.interval'),
  action: legacy('user.action'),
  edit: legacy('user.edit'),
  remove: legacy('user.remove'),
  openLogs: legacy('user.open_logs'),
}

export type ListTexts = typeof MAILBOX_TEXTS

/** The column headers and values of the classic table of a role. */
export function listTexts(role: Role): ListTexts {
  return tableOf(role) === 'user' ? USER_TEXTS : MAILBOX_TEXTS
}
