// Sync job scenarios and state of the mock API (UI 008 T012, data-model §8). The jobs, the
// capabilities and the injected bulk failures live in `state.syncJobs`; the target mailboxes come
// from the scenario's domains (`mailboxAddresses`, `resourceAddresses`, `aliasAddresses`), as UI
// 002's directory lists read them. Runtime changes (`PATCH /__mock/scenarios/:id` with
// `syncJobs`) stand in for the imapsync runner and for another user or the classic interface.
import type { SyncJobCapabilities, SyncJobLastResult } from '@/api'

import { mockDomain } from '../factories/domain'
import {
  bigLog,
  FAILURE_CODES,
  finishedRun,
  mockSyncJob,
  neverRun,
  runLog,
  syncJobCapabilities,
  type MockSyncJob,
} from '../factories/sync-job'
import { permissionFlags } from './accounts'
import { assignDomains } from './domains-base'
import type { ScenarioDefinition } from './index'
import type { ScenarioState } from './state'

export interface SyncJobState {
  jobs: MockSyncJob[]
  /** The server configuration; `customParameters.allowed` is computed per caller. */
  capabilities: SyncJobCapabilities
  /** Job IDs whose bulk items answer `failed` with a 500 problem. */
  failBulkItems: number[]
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

/** Runtime changes of data-model §8 ("Runtime changes"). */
export interface SyncJobChanges {
  finishRun?: { id: number; lastResult: Exclude<SyncJobLastResult, 'unknown'>; exitStatus: string }
  startRun?: number
  changeElsewhere?: { id: number } & Partial<MockSyncJob>
  delete?: number
  renameMailbox?: { from: string; to: string }
  capabilities?: DeepPartial<SyncJobCapabilities>
  failBulkItems?: number[]
  /** Replaces the jobs (tests that need a specific set). */
  jobs?: (Partial<MockSyncJob> & { id: number })[]
}

export function initialSyncJobState(): SyncJobState {
  return { jobs: [], capabilities: syncJobCapabilities(), failBulkItems: [] }
}

function merge<T>(base: T, change: DeepPartial<T> | undefined): T {
  if (!change) return base
  const result = { ...base } as Record<string, unknown>
  for (const [key, value] of Object.entries(change)) {
    const current = result[key]
    result[key] =
      value && typeof value === 'object' && !Array.isArray(value) && current
        ? merge(current, value as DeepPartial<typeof current>)
        : value
  }
  return result as T
}

function job(state: ScenarioState, id: number): MockSyncJob {
  const found = state.syncJobs.jobs.find((item) => item.id === id)
  if (!found) throw new Error(`Unknown mock sync job ${id}`)
  return found
}

export function applySyncJobChanges(state: ScenarioState, changes: SyncJobChanges): void {
  const now = () => new Date(state.now()).toISOString()
  if (changes.jobs) state.syncJobs.jobs = changes.jobs.map((item) => mockSyncJob(item))
  if (changes.capabilities) {
    state.syncJobs.capabilities = merge(state.syncJobs.capabilities, changes.capabilities)
  }
  if (changes.failBulkItems) state.syncJobs.failBulkItems = [...changes.failBulkItems]
  if (changes.startRun !== undefined) job(state, changes.startRun).runStatus.running = true
  if (changes.finishRun) {
    const target = job(state, changes.finishRun.id)
    target.runStatus = {
      running: false,
      lastRunAt: now(),
      lastResult: changes.finishRun.lastResult,
      exitStatus: changes.finishRun.exitStatus,
      logAvailable: true,
    }
    target.log = `${target.log}Exiting with return value (${changes.finishRun.exitStatus})\n`
    target.modifiedAt = now()
  }
  if (changes.changeElsewhere) {
    const { id, ...rest } = changes.changeElsewhere
    Object.assign(job(state, id), rest, { modifiedAt: now() })
  }
  if (changes.delete !== undefined) {
    state.syncJobs.jobs = state.syncJobs.jobs.filter((item) => item.id !== changes.delete)
  }
  if (changes.renameMailbox) {
    const { from, to } = changes.renameMailbox
    for (const item of state.syncJobs.jobs) if (item.mailbox === from) item.mailbox = to
    for (const domain of state.domains) {
      if (domain.mailboxAddresses?.includes(from)) {
        domain.mailboxAddresses = domain.mailboxAddresses.map((address) =>
          address === from ? to : address,
        )
      }
    }
  }
}

// --- Scenario data -------------------------------------------------------------------------

const ORG = ['alice@example.org', 'dora@example.org', 'erik@example.org']
const NET = ['carol@example.net', 'frank@example.net']

/** example.org (three mailboxes, a resource and an alias) and example.net (two mailboxes). */
function seedDomains(state: ScenarioState): void {
  state.domains = [
    mockDomain({
      name: 'example.org',
      mailboxAddresses: ORG,
      resourceAddresses: ['room1@example.org'],
      aliasAddresses: ['info@example.org'],
      usage: {
        mailboxes: 3,
        resources: 1,
        aliases: 1,
        largestMailboxQuota: 0,
        quotaAllocated: 0,
        storageUsed: 0,
        messages: 0,
      },
    }),
    mockDomain({
      name: 'example.net',
      mailboxAddresses: NET,
      resourceAddresses: [],
      aliasAddresses: [],
      usage: {
        mailboxes: 2,
        resources: 0,
        aliases: 0,
        largestMailboxQuota: 0,
        quotaAllocated: 0,
        storageUsed: 0,
        messages: 0,
      },
    }),
  ]
}

const LONG_HOST = [63, 63, 63, 52]
  .map((length, index) => String.fromCharCode(97 + index).repeat(length))
  .join('.')
const LONG_USER = `${'u'.repeat(240)}@long.example`
const LONG_PATTERN = `(?i)${'x'.repeat(250)}|(?i)${'y'.repeat(238)}`
const LONG_PARAMS = Array.from({ length: 36 }, (_, index) => `--maxsize=${10000 + index}`)
  .join(' ')
  .slice(0, 512)
  .trim()
const MARKUP_LOG = '<script>alert(1)</script>\n&amp; <b>bold</b> {{ template }}\n'
const WIDE_LOG = Array.from(
  { length: 12 },
  (_, index) => `${String(index).padStart(3, '0')} ${'W'.repeat(116)}`,
).join('\n')

/** The 60 jobs of `sync-jobs-admin` (data-model §8): every state, result and edge value. */
export function adminJobs(): MockSyncJob[] {
  const jobs: MockSyncJob[] = []
  const add = (overrides: Partial<MockSyncJob> & { id: number }) => {
    const created = mockSyncJob(overrides)
    if (!overrides.log && created.runStatus.logAvailable) created.log = runLog(created)
    jobs.push(created)
  }
  add({
    id: 1,
    mailbox: 'alice@example.org',
    remoteHost: 'imap.old-mail.example',
    remoteUser: 'alice.old',
  })
  add({
    id: 2,
    mailbox: 'alice@example.org',
    remoteHost: 'mail.previous.example',
    remoteUser: 'alice',
    runStatus: finishedRun('failed', 'EXIT_AUTHENTICATION_FAILURE_USER1'),
  })
  add({
    id: 3,
    mailbox: 'carol@example.net',
    remoteHost: 'imap.carol.example',
    runStatus: finishedRun('succeeded', 'EX_OK'),
  })
  add({
    id: 4,
    mailbox: 'dora@example.org',
    runStatus: { ...finishedRun('succeeded', 'EX_OK'), running: true },
  })
  add({
    id: 5,
    mailbox: 'dora@example.org',
    active: false,
    runStatus: { ...finishedRun('succeeded', 'EX_OK'), running: true },
  })
  FAILURE_CODES.forEach((code, index) =>
    add({ id: 6 + index, mailbox: ORG[index % 3]!, runStatus: finishedRun('failed', code) }),
  )
  add({ id: 12, mailbox: 'erik@example.org', runStatus: finishedRun('failed', 'EXIT_UNPARSED') })
  add({ id: 13, mailbox: 'erik@example.org', runStatus: finishedRun('failed', null) })
  add({ id: 14, mailbox: 'frank@example.net', active: false, runStatus: neverRun() })
  add({
    id: 15,
    mailbox: 'frank@example.net',
    runStatus: {
      lastRunAt: null,
      lastResult: 'unknown',
      exitStatus: null,
      running: false,
      logAvailable: true,
    },
  })
  add({
    id: 16,
    mailbox: 'carol@example.net',
    runStatus: finishedRun('succeeded', 'EXIT_SOMETHING_NEW'),
  })
  add({
    id: 17,
    mailbox: 'erik@example.org',
    remoteHost: LONG_HOST,
    remoteUser: LONG_USER,
    exclude: LONG_PATTERN,
    customParameters: LONG_PARAMS,
    runStatus: finishedRun('succeeded', 'EX_OK'),
  })
  add({
    id: 18,
    mailbox: 'dora@example.org',
    runStatus: { ...finishedRun('succeeded', 'EX_OK'), logAvailable: false },
    log: '',
  })
  add({
    id: 19,
    mailbox: 'alice@example.org',
    runStatus: finishedRun('failed', 'EXIT_PARSE'),
    log: MARKUP_LOG,
  })
  add({
    id: 20,
    mailbox: 'carol@example.net',
    runStatus: finishedRun('succeeded', 'EX_OK'),
    log: WIDE_LOG,
  })
  const mailboxes = [...ORG, ...NET]
  for (let id = 21; id <= 60; id += 1) {
    const failed = id % 4 === 0
    add({
      id,
      mailbox: mailboxes[id % mailboxes.length]!,
      remoteHost: `imap.provider${id % 7}.example`,
      remoteUser: `account${id}`,
      intervalMinutes: 10 + (id % 6) * 5,
      active: id % 5 !== 0,
      encryption: id % 3 === 0 ? 'starttls' : 'ssl',
      remotePort: id % 3 === 0 ? 143 : 993,
      runStatus:
        id % 9 === 0
          ? neverRun()
          : finishedRun(
              failed ? 'failed' : 'succeeded',
              failed ? 'EXIT_CONNECTION_FAILURE' : 'EX_OK',
              new Date(Date.UTC(2026, 9, 17, 6) + id * 600_000).toISOString(),
            ),
    })
  }
  return jobs
}

function admin(state: ScenarioState): void {
  seedDomains(state)
  state.syncJobs.jobs = adminJobs()
}

/** alice's jobs #1 and #2 and carol's job #3 (out of alice's scope). */
function userJobs(state: ScenarioState): void {
  seedDomains(state)
  state.syncJobs.jobs = adminJobs().filter((item) => item.id <= 3)
}

const userFlag = (syncjobs: boolean) => ({
  'alice@example.org': {
    permissions: permissionFlags(false, { spamScore: true, spamPolicy: true, syncjobs }),
  },
})

export const syncJobScenarios: Record<string, ScenarioDefinition> = {
  'sync-jobs-admin': {
    description:
      'An administrator with 60 sync jobs over example.org and example.net in every state: never run, running, running while inactive, succeeded, each failure code, unknown codes, rescheduled, long values and special logs (UI 008).',
    overrides: { signedInAs: 'admin' },
    setup: admin,
  },
  'sync-jobs-empty': {
    description: 'An administrator without sync jobs; mailboxes exist (UI 008).',
    overrides: { signedInAs: 'admin' },
    setup: seedDomains,
  },
  'sync-jobs-domain-admin': {
    description:
      "The domain administrator of example.org with the syncjobs flag; the administrator scenario's jobs, of which only example.org's are visible (UI 008).",
    overrides: { signedInAs: 'reseller' },
    setup: (state) => {
      admin(state)
      assignDomains(state, 'reseller', ['example.org'])
    },
  },
  'sync-jobs-domain-admin-no-mailboxes': {
    description:
      'A domain administrator with the syncjobs flag whose only domain has no mailboxes; no jobs (UI 008).',
    overrides: { signedInAs: 'reseller' },
    setup: (state) => {
      seedDomains(state)
      state.domains.push(
        mockDomain({ name: 'empty.example', mailboxAddresses: [], resourceAddresses: [] }),
      )
      assignDomains(state, 'reseller', ['empty.example'])
    },
  },
  'sync-jobs-domain-admin-no-flag': {
    description:
      'A domain administrator without the syncjobs flag; jobs exist but are refused (UI 008).',
    overrides: { signedInAs: 'reseller' },
    setup: (state) => {
      admin(state)
      assignDomains(state, 'reseller', ['example.org'])
      const reseller = state.accounts.find((account) => account.username === 'reseller')!
      reseller.permissions = { ...reseller.permissions, syncjobs: false }
    },
  },
  'sync-jobs-user': {
    description:
      "alice@example.org with the syncjobs flag: her jobs #1 (never run) and #2 (wrong username or password, with a log); carol's job #3 is out of scope (UI 008).",
    overrides: { signedInAs: 'alice@example.org', accounts: userFlag(true) },
    setup: userJobs,
  },
  'sync-jobs-user-no-flag': {
    description: 'alice@example.org without the syncjobs flag (UI 008).',
    overrides: { signedInAs: 'alice@example.org', accounts: userFlag(false) },
    setup: userJobs,
  },
  'sync-jobs-user-restricted-params': {
    description:
      'alice@example.org with the syncjobs flag on a server that restricts custom parameters to administrators; one job with stored custom parameters (UI 008).',
    overrides: { signedInAs: 'alice@example.org', accounts: userFlag(true) },
    setup: (state) => {
      seedDomains(state)
      state.syncJobs.jobs = [
        mockSyncJob({
          id: 1,
          mailbox: 'alice@example.org',
          remoteHost: 'imap.old-mail.example',
          remoteUser: 'alice.old',
          customParameters: '--maxsize=10000000 --nofoldersizesatend',
        }),
      ]
      state.syncJobs.capabilities = syncJobCapabilities({
        customParameters: {
          allowed: true,
          restrictedToAdministrators: true,
          allowedOptions: ['maxsize', 'minage', 'nofoldersizesatend', 'useheader'],
        },
      })
    },
  },
  'sync-jobs-running': {
    description: 'An administrator with three jobs, #2 of them running (UI 008 FR-014).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => {
      seedDomains(state)
      state.syncJobs.jobs = [
        mockSyncJob({
          id: 1,
          mailbox: 'alice@example.org',
          runStatus: finishedRun('succeeded', 'EX_OK'),
        }),
        mockSyncJob({
          id: 2,
          mailbox: 'dora@example.org',
          runStatus: { ...finishedRun('failed', 'EXIT_CONNECTION_FAILURE'), running: true },
        }),
        mockSyncJob({ id: 3, mailbox: 'carol@example.net', runStatus: neverRun() }),
      ]
      for (const item of state.syncJobs.jobs)
        if (item.runStatus.logAvailable) item.log = runLog(item)
    },
  },
  'sync-jobs-bulk': {
    description: 'An administrator with 30 jobs; the bulk items of job #7 fail (UI 008 US4, US6).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => {
      seedDomains(state)
      const mailboxes = [...ORG, ...NET]
      state.syncJobs.jobs = Array.from({ length: 30 }, (_, index) =>
        mockSyncJob({
          id: index + 1,
          mailbox: mailboxes[index % mailboxes.length]!,
          active: index % 2 === 0,
          runStatus: finishedRun('succeeded', 'EX_OK'),
        }),
      )
      state.syncJobs.failBulkItems = [7]
    },
  },
  'sync-jobs-big-log': {
    description: 'An administrator with one job whose log is 5 MB (UI 008 SC-007).',
    overrides: { signedInAs: 'admin' },
    setup: (state) => {
      seedDomains(state)
      state.syncJobs.jobs = [
        mockSyncJob({
          id: 1,
          mailbox: 'alice@example.org',
          runStatus: finishedRun('succeeded', 'EX_OK'),
          log: bigLog(5),
        }),
      ]
    },
  },
}
