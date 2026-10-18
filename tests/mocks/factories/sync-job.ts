// Sync job factory (UI 008 T011, research R20): the stored job of the mock, with its remote
// password and log kept beside the contract fields, the contract `SyncJob` the handlers answer
// with, the capabilities with today's defaults and limits, and deterministic large logs. The
// version tag hashes the stored configuration only (remote connection, password, options, active
// flag and target mailbox), never the run status.
import { createHash } from 'node:crypto'

import type {
  SyncJob,
  SyncJobCapabilities,
  SyncJobEncryption,
  SyncJobLastResult,
  SyncJobRunStatus,
} from '@/api'

/** A stored sync job: the configuration, the stored password, the run status and the log. */
export interface MockSyncJob {
  id: number
  mailbox: string
  remoteHost: string
  remotePort: number
  encryption: SyncJobEncryption
  remoteUser: string
  /** The stored remote password ('' when none), never returned. */
  remotePassword: string
  exclude: string
  destinationSubfolder: string
  intervalMinutes: number
  maxAgeDays: number
  maxBytesPerSecond: number
  remoteTimeoutSeconds: number
  localTimeoutSeconds: number
  deleteFromSource: boolean
  deleteFromDestination: boolean
  deleteDuplicatesOnDestination: boolean
  automap: boolean
  skipCrossDuplicates: boolean
  subscribeAll: boolean
  dryRun: boolean
  customParameters: string
  active: boolean
  runStatus: SyncJobRunStatus
  /** The last run's output. */
  log: string
  createdAt: string
  modifiedAt: string | null
}

/** The members a patch or a create request may set; the rest is maintained by the mock. */
export const CONFIG_KEYS = [
  'mailbox',
  'remoteHost',
  'remotePort',
  'encryption',
  'remoteUser',
  'remotePassword',
  'exclude',
  'destinationSubfolder',
  'intervalMinutes',
  'maxAgeDays',
  'maxBytesPerSecond',
  'remoteTimeoutSeconds',
  'localTimeoutSeconds',
  'deleteFromSource',
  'deleteFromDestination',
  'deleteDuplicatesOnDestination',
  'automap',
  'skipCrossDuplicates',
  'subscribeAll',
  'dryRun',
  'customParameters',
  'active',
] as const satisfies readonly (keyof MockSyncJob)[]

export type ConfigKey = (typeof CONFIG_KEYS)[number]

export const RECOGNISED_CODES = [
  'EX_OK',
  'EXIT_CONNECTION_FAILURE',
  'EXIT_CONNECTION_FAILURE_HOST1',
  'EXIT_TLS_FAILURE',
  'EXIT_AUTHENTICATION_FAILURE',
  'EXIT_AUTHENTICATION_FAILURE_USER1',
  'EXIT_OVERQUOTA',
] as const

export const FAILURE_CODES = RECOGNISED_CODES.slice(1)

const CREATED = (id: number) => new Date(Date.UTC(2026, 0, 1, 8) + id * 3_600_000).toISOString()

export function neverRun(): SyncJobRunStatus {
  return {
    lastRunAt: null,
    lastResult: 'unknown',
    exitStatus: null,
    running: false,
    logAvailable: false,
  }
}

/** A finished run at a fixed time, with its result and exit code. */
export function finishedRun(
  lastResult: Exclude<SyncJobLastResult, 'unknown'>,
  exitStatus: string | null,
  lastRunAt = '2026-10-18T07:30:00.000Z',
): SyncJobRunStatus {
  return { lastRunAt, lastResult, exitStatus, running: false, logAvailable: true }
}

/** A stored job with the legacy add form's defaults, overridden. */
export function mockSyncJob(overrides: Partial<MockSyncJob> & { id: number }): MockSyncJob {
  const id = overrides.id
  return {
    mailbox: 'alice@example.org',
    remoteHost: `imap${id}.old-provider.example`,
    remotePort: 993,
    encryption: 'ssl',
    remoteUser: `user${id}@old-provider.example`,
    remotePassword: `remote-secret-${id}`,
    exclude: '(?i)spam|(?i)junk',
    destinationSubfolder: '',
    intervalMinutes: 20,
    maxAgeDays: 0,
    maxBytesPerSecond: 0,
    remoteTimeoutSeconds: 600,
    localTimeoutSeconds: 600,
    deleteFromSource: false,
    deleteFromDestination: false,
    deleteDuplicatesOnDestination: true,
    automap: true,
    skipCrossDuplicates: false,
    subscribeAll: true,
    dryRun: false,
    customParameters: '',
    active: true,
    runStatus: neverRun(),
    log: '',
    createdAt: CREATED(id),
    modifiedAt: null,
    ...overrides,
  }
}

/** The quoted strong version tag of the stored configuration. */
export function syncJobEtag(job: MockSyncJob): string {
  const config = CONFIG_KEYS.map((key) => job[key])
  const digest = createHash('sha256').update(JSON.stringify(config)).digest('hex')
  return `"sj${digest.slice(0, 30)}"`
}

/** The contract `SyncJob`: everything but the password and the log. */
export function syncJobView(job: MockSyncJob): SyncJob {
  const { remotePassword, log: _log, ...rest } = job
  return {
    ...rest,
    authMechanism: 'plain',
    remotePasswordSet: remotePassword !== '',
    runStatus: { ...job.runStatus },
    etag: syncJobEtag(job),
  }
}

/** Today's capabilities (API 008 FR-030), overridden. */
export function syncJobCapabilities(
  overrides: Partial<SyncJobCapabilities> = {},
): SyncJobCapabilities {
  const range = (minimum: number, maximum: number) => ({ minimum, maximum })
  return {
    bulkLimit: 100,
    customParameters: {
      allowed: true,
      restrictedToAdministrators: false,
      allowedOptions: ['maxsize', 'minage', 'nofoldersizesatend', 'useheader'],
    },
    defaults: {
      active: true,
      automap: true,
      customParameters: '',
      deleteDuplicatesOnDestination: true,
      deleteFromDestination: false,
      deleteFromSource: false,
      destinationSubfolder: '',
      dryRun: false,
      encryption: 'ssl',
      exclude: '(?i)spam|(?i)junk',
      intervalMinutes: 20,
      localTimeoutSeconds: 600,
      maxAgeDays: 0,
      maxBytesPerSecond: 0,
      remoteTimeoutSeconds: 600,
      skipCrossDuplicates: false,
      subscribeAll: true,
    },
    encryptions: ['ssl', 'starttls', 'plain'],
    limits: {
      customParametersMaxLength: 512,
      destinationSubfolderMaxLength: 255,
      excludeMaxLength: 500,
      intervalMinutes: range(1, 43800),
      localTimeoutSeconds: range(1, 32000),
      maxAgeDays: range(0, 32000),
      maxBytesPerSecond: range(0, 125000000),
      remoteHostMaxLength: 255,
      remotePasswordMaxLength: 255,
      remotePort: range(1, 65535),
      remoteTimeoutSeconds: range(1, 32000),
      remoteUserMaxLength: 255,
    },
    pageSize: { default: 25, maximum: 1000 },
    ...overrides,
  }
}

/** imapsync-like output of a few lines, with the job's hosts and no password. */
export function runLog(
  job: Pick<MockSyncJob, 'remoteHost' | 'remoteUser' | 'mailbox'>,
  outcome = 'EX_OK',
): string {
  return [
    `Transfer started on ${new Date(Date.UTC(2026, 9, 18, 7, 25)).toUTCString()}`,
    'PID is 4242 my PPID is 4241',
    `Host1: probing by default the imap port 993`,
    `Host1: ${job.remoteHost} says it has CAPABILITY for AUTHENTICATE PLAIN`,
    `Host1: success login on [${job.remoteHost}] with user [${job.remoteUser}] auth [PLAIN]`,
    `Host2: success login on [dovecot] with user [${job.mailbox}] auth [PLAIN]`,
    '++++ Listing folders',
    'All foldernames are presented between brackets like [X] where X is the foldername.',
    'Host1: 5 folders',
    'Host2: 5 folders',
    '++++ End looping on each folder',
    `Exiting with return value 0 (${outcome})`,
    '',
  ].join('\n')
}

/** A deterministic imapsync-like log of about `megabytes` MB (about 16,000 lines per MB). */
export function bigLog(megabytes: number): string {
  const target = Math.round(megabytes * 1_000_000)
  const lines: string[] = []
  let size = 0
  for (let index = 1; size < target; index += 1) {
    const line = `msg INBOX/${String(index).padStart(6, '0')} {${(index * 7919) % 99_991}} copied to INBOX/${index} 0.0${index % 10} msgs/s`
    lines.push(line)
    size += line.length + 1
  }
  return `${lines.join('\n')}\n`
}
