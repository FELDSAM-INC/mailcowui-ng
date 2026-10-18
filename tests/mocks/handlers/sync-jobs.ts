// Sync job handlers (UI 008 T014, research R20): the documented behaviour of API 008 on the
// scenario state. The syncjobs flag is checked before any lookup; a job or target mailbox outside
// the caller's scope answers 404; the list searches, filters, sorts (ties by id) and pages; create
// and update apply the field rules with their codes and parameters, `sync-job-exists`, If-Match
// and 412, the write-only password and the immutable target; reschedule keeps the version tag;
// bulk actions answer per target in request order. The password never appears in a response.
import type { BulkItemResult, SyncJob, SyncJobCapabilities, SyncJobPatch } from '@/api'

import { mailboxAddresses, resourceAddresses, aliasAddresses } from '../factories/domain'
import {
  CONFIG_KEYS,
  mockSyncJob,
  syncJobEtag,
  syncJobView,
  type ConfigKey,
  type MockSyncJob,
} from '../factories/sync-job'
import type { MockAccount, ScenarioState } from '../scenarios/state'
import { csrfProblem, http, problem, requireAccount, scenario } from './context'
import {
  addViolation,
  compareValues,
  page,
  validationFailed,
  type Violations,
} from './domain-rules'

const notFound = () => problem(404, null)
const outdated = () => problem(412, null)

/** The account, or 403 permission-flag-required before any object is looked up. */
function requireSyncJobs(state: ScenarioState): MockAccount | Response {
  const account = requireAccount(state)
  if (account instanceof Response) return account
  if (account.role !== 'admin' && !account.permissions.syncjobs) {
    return problem(403, 'permission-flag-required', { requiredFlags: ['syncjobs'] })
  }
  return account
}

const domainOf = (address: string) => address.split('@')[1]?.toLowerCase() ?? ''

function inScope(account: MockAccount, address: string): boolean {
  const lower = address.toLowerCase()
  if (account.role === 'admin') return true
  if (account.scope.type === 'domains') return account.scope.domains.includes(domainOf(lower))
  if (account.scope.type === 'mailbox') return account.scope.mailbox.toLowerCase() === lower
  return false
}

function visibleJobs(state: ScenarioState, account: MockAccount): MockSyncJob[] {
  return state.syncJobs.jobs.filter((job) => inScope(account, job.mailbox))
}

function findJob(
  state: ScenarioState,
  account: MockAccount,
  raw: string | number,
): MockSyncJob | undefined {
  const id = Number(raw)
  return visibleJobs(state, account).find((job) => job.id === id)
}

/** The capabilities for the caller: custom parameters refused to non-administrators when restricted. */
function capabilitiesFor(state: ScenarioState, account: MockAccount): SyncJobCapabilities {
  const caps = state.syncJobs.capabilities
  const allowed = !(caps.customParameters.restrictedToAdministrators && account.role !== 'admin')
  return { ...caps, customParameters: { ...caps.customParameters, allowed } }
}

const etagHeaders = (job: MockSyncJob) => ({ headers: { ETag: syncJobEtag(job) } })
const bare = (version: string) => version.replace(/^"|"$/g, '')

// --- Field rules ----------------------------------------------------------------------------

const LABEL = /^[\p{L}\p{N}]([\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?$/u
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/

/** Host names (labels of letters and digits with inner hyphens) or IPv4; never IPv6 literals. */
function isHostName(value: string): boolean {
  if (IPV4.test(value)) return true
  if (value.includes(':') || value.length > 253) return false
  return value.split('.').every((label) => LABEL.test(label))
}

/** A deterministic stand-in for PCRE: balanced parentheses and brackets. */
function isRegex(value: string): boolean {
  const stack: string[] = []
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (char === '\\') {
      index += 1
      continue
    }
    if (char === '(' || char === '[') stack.push(char)
    else if (char === ')' && stack.pop() !== '(') return false
    else if (char === ']' && stack.pop() !== '[') return false
  }
  return stack.length === 0
}

/** Legacy's custom parameter check: split at hyphens, each option name allowed and space-free. */
function checkCustomParameters(
  errors: Violations,
  value: string,
  allowed: readonly string[],
): void {
  for (const piece of value.trim().split('-')) {
    if (!piece) continue
    const name = piece.includes('=') ? piece.split('=')[0]! : piece.replace(/ +$/, '')
    if (name.includes(' ')) {
      addViolation(errors, 'customParameters', 'optionContainsSpace', { token: name })
      continue
    }
    const lower = name.toLowerCase()
    if (lower === 'showpasswords' || !allowed.includes(lower)) {
      addViolation(errors, 'customParameters', 'optionNotAllowed', { option: name })
    }
  }
}

type Values = Omit<MockSyncJob, 'id' | 'runStatus' | 'log' | 'createdAt' | 'modifiedAt'>

const RANGES = [
  'remotePort',
  'intervalMinutes',
  'maxAgeDays',
  'maxBytesPerSecond',
  'remoteTimeoutSeconds',
  'localTimeoutSeconds',
] as const

const LENGTHS: [keyof Values, keyof SyncJobCapabilities['limits']][] = [
  ['remoteHost', 'remoteHostMaxLength'],
  ['remoteUser', 'remoteUserMaxLength'],
  ['remotePassword', 'remotePasswordMaxLength'],
  ['destinationSubfolder', 'destinationSubfolderMaxLength'],
  ['exclude', 'excludeMaxLength'],
  ['customParameters', 'customParametersMaxLength'],
]

/** The rules of `SyncJobCreateRequest` for the members in `check` (all on create, the changed ones on update). */
function validate(
  caps: SyncJobCapabilities,
  values: Values,
  check: ReadonlySet<keyof Values>,
): Violations {
  const errors: Violations = {}
  for (const [key, limit] of LENGTHS) {
    const value = String(values[key])
    if (check.has(key) && value.length > (caps.limits[limit] as number)) {
      addViolation(errors, key, 'tooLong', { max: caps.limits[limit] })
    }
  }
  for (const key of RANGES) {
    const range = caps.limits[key]
    if (check.has(key) && (values[key] < range.minimum || values[key] > range.maximum)) {
      addViolation(errors, key, 'outOfRange', { min: range.minimum, max: range.maximum })
    }
  }
  if (check.has('encryption') && !caps.encryptions.includes(values.encryption)) {
    addViolation(errors, 'encryption', 'notInList', { allowed: caps.encryptions })
  }
  if (check.has('remoteHost') && !errors.remoteHost && !isHostName(values.remoteHost)) {
    addViolation(errors, 'remoteHost', 'invalidFormat', { format: 'hostName' })
  }
  if (check.has('exclude') && !isRegex(values.exclude))
    addViolation(errors, 'exclude', 'invalidRegex')
  if (check.has('customParameters') && values.customParameters.trim() && !errors.customParameters) {
    if (!caps.customParameters.allowed) {
      addViolation(errors, 'customParameters', 'customParamsNotPermitted')
    } else {
      checkCustomParameters(errors, values.customParameters, caps.customParameters.allowedOptions)
    }
  }
  return errors
}

/** `404` for an unknown or foreign target, `notEligible` for a resource or an alias. */
function checkTarget(
  state: ScenarioState,
  account: MockAccount,
  address: string,
  errors: Violations,
): Response | null {
  const lower = address.trim().toLowerCase()
  const domains = state.domains.filter((domain) => inScope(account, `x@${domain.name}`))
  const has = (list: (domain: (typeof domains)[number]) => string[]) =>
    domains.some((domain) => list(domain).some((item) => item.toLowerCase() === lower))
  if (!inScope(account, lower)) return notFound()
  if (has(resourceAddresses)) addViolation(errors, 'mailbox', 'notEligible', { kind: 'resource' })
  else if (has(aliasAddresses)) addViolation(errors, 'mailbox', 'notEligible', { kind: 'alias' })
  else if (!has(mailboxAddresses)) return notFound()
  return null
}

function duplicateOf(
  state: ScenarioState,
  values: Pick<Values, 'mailbox' | 'remoteHost' | 'remoteUser'>,
  except?: number,
) {
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
  return state.syncJobs.jobs.find(
    (job) =>
      job.id !== except &&
      same(job.mailbox, values.mailbox) &&
      same(job.remoteHost, values.remoteHost) &&
      same(job.remoteUser, values.remoteUser),
  )
}

const exists = (job: MockSyncJob) => problem(409, 'sync-job-exists', { syncJobId: job.id })

// --- List ------------------------------------------------------------------------------------

type SortKey = string
const RESULT_ORDER = { unknown: 0, failed: 1, succeeded: 2 } as const

function sortValue(job: MockSyncJob, key: SortKey): unknown {
  switch (key) {
    case 'lastRunAt':
      return job.runStatus.lastRunAt
    case 'lastResult':
      return RESULT_ORDER[job.runStatus.lastResult]
    case 'active':
      return job.active ? 1 : 0
    default:
      return (job as unknown as Record<string, unknown>)[key]
  }
}

function sortJobs(jobs: MockSyncJob[], key: SortKey, order: string): MockSyncJob[] {
  const direction = order === 'desc' ? -1 : 1
  return [...jobs].sort(
    (a, b) => direction * (compareValues(sortValue(a, key), sortValue(b, key)) || a.id - b.id),
  )
}

const boolParam = (value: string | null) => (value === null ? null : value === 'true')

function bulkProblem(answer: Response): Promise<BulkItemResult['problem']> {
  return answer.json() as Promise<BulkItemResult['problem']>
}

export const syncJobHandlers = [
  http.get('/capabilities/sync-jobs', ({ response }) => {
    const state = scenario()
    const account = requireSyncJobs(state)
    if (account instanceof Response) return response.untyped(account)
    return response(200).json({ data: capabilitiesFor(state, account) })
  }),

  http.get('/sync-jobs', ({ request, response }) => {
    const state = scenario()
    const account = requireSyncJobs(state)
    if (account instanceof Response) return response.untyped(account)
    const url = new URL(request.url)
    const params = url.searchParams
    const q = params.get('q')?.trim().toLowerCase()
    const mailbox = params.get('mailbox')?.toLowerCase()
    const domain = params.get('domain')?.toLowerCase()
    const active = boolParam(params.get('active'))
    const running = boolParam(params.get('running'))
    const lastResult = params.get('lastResult')
    const items = visibleJobs(state, account).filter(
      (job) =>
        (!q ||
          [job.mailbox, job.remoteUser, job.remoteHost].some((v) => v.toLowerCase().includes(q))) &&
        (!mailbox || job.mailbox.toLowerCase() === mailbox) &&
        (!domain || domainOf(job.mailbox) === domain) &&
        (active === null || job.active === active) &&
        (running === null || job.runStatus.running === running) &&
        (!lastResult || job.runStatus.lastResult === lastResult),
    )
    const sorted = sortJobs(items, params.get('sort') ?? 'id', params.get('order') ?? 'asc')
    return response(200).json(page(sorted.map(syncJobView), url))
  }),

  http.post('/sync-jobs', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireSyncJobs(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    const caps = capabilitiesFor(state, account)
    const errors: Violations = {}
    let mailbox = body.mailbox?.trim() ?? ''
    if (account.role === 'mailboxUser' && account.scope.type === 'mailbox') {
      if (mailbox && mailbox.toLowerCase() !== account.scope.mailbox.toLowerCase()) {
        return response.untyped(notFound())
      }
      mailbox = account.scope.mailbox
    } else if (!mailbox) {
      addViolation(errors, 'mailbox', 'required')
    } else {
      const missing = checkTarget(state, account, mailbox, errors)
      if (missing) return response.untyped(missing)
    }
    // The generated request type marks the password write-only; the mock stores plain values.
    const sent = body as unknown as Partial<Values> & Pick<Values, 'remoteHost'>
    const values: Values = {
      ...caps.defaults,
      remotePort: 0,
      remoteUser: '',
      remotePassword: '',
      ...sent,
      mailbox: mailbox.toLowerCase(),
      remoteHost: sent.remoteHost.trim().toLowerCase(),
      customParameters: (sent.customParameters ?? caps.defaults.customParameters).trim(),
    }
    Object.assign(errors, validate(caps, values, new Set(Object.keys(values) as (keyof Values)[])))
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    const duplicate = duplicateOf(state, values)
    if (duplicate) return response.untyped(exists(duplicate))
    const id = Math.max(0, ...state.syncJobs.jobs.map((job) => job.id)) + 1
    const created = mockSyncJob({ ...values, id, createdAt: new Date(state.now()).toISOString() })
    state.syncJobs.jobs.push(created)
    const data: SyncJob = syncJobView(created)
    return response(201).json(
      { data },
      { headers: { ETag: data.etag, Location: `/api/v2/sync-jobs/${id}` } },
    )
  }),

  http.post('/sync-jobs/bulk-actions', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireSyncJobs(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    const limit = state.syncJobs.capabilities.bulkLimit
    if (body.targets.length > limit) {
      const errors: Violations = {}
      addViolation(errors, 'targets', 'tooMany', { max: limit })
      return response.untyped(validationFailed(errors))
    }
    const seen = new Set<string>()
    const results: BulkItemResult[] = []
    for (const target of body.targets) {
      const id = String(target.id ?? '')
      if (seen.has(id)) continue
      seen.add(id)
      const job = /^[1-9][0-9]*$/.test(id) ? findJob(state, account, id) : undefined
      if (!job) {
        results.push({ id, outcome: 'notFound' })
        continue
      }
      if (state.syncJobs.failBulkItems.includes(job.id)) {
        results.push({ id, outcome: 'failed', problem: await bulkProblem(problem(500, null)) })
        continue
      }
      if (
        body.action !== 'reschedule' &&
        target.version !== undefined &&
        bare(target.version) !== bare(syncJobEtag(job))
      ) {
        results.push({ id, outcome: 'outdated', problem: await bulkProblem(outdated()) })
        continue
      }
      if (body.action === 'delete') {
        state.syncJobs.jobs = state.syncJobs.jobs.filter((item) => item.id !== job.id)
        results.push({ id, outcome: 'done' })
        continue
      }
      if (body.action === 'reschedule') {
        job.runStatus = {
          ...job.runStatus,
          lastRunAt: null,
          lastResult: 'unknown',
          exitStatus: null,
        }
      } else {
        const active = body.action === 'activate'
        if (job.active !== active) {
          job.active = active
          job.modifiedAt = new Date(state.now()).toISOString()
        }
      }
      results.push({ id, outcome: 'done', version: syncJobEtag(job) })
    }
    const count = (outcome: BulkItemResult['outcome']) =>
      results.filter((item) => item.outcome === outcome).length
    return response(200).json({
      data: {
        bulkRequestId: Buffer.from(`sj${state.now()}`).toString('hex').padEnd(32, '0').slice(0, 32),
        results,
        summary: {
          total: results.length,
          done: count('done'),
          notFound: count('notFound'),
          refused: count('refused'),
          outdated: count('outdated'),
          failed: count('failed'),
        },
      },
    })
  }),

  http.get('/sync-jobs/{syncJobId}', ({ params, response }) => {
    const state = scenario()
    const account = requireSyncJobs(state)
    if (account instanceof Response) return response.untyped(account)
    const job = findJob(state, account, params.syncJobId)
    if (!job) return response.untyped(notFound())
    return response(200).json({ data: syncJobView(job) }, etagHeaders(job))
  }),

  http.patch('/sync-jobs/{syncJobId}', async ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireSyncJobs(state)
    if (account instanceof Response) return response.untyped(account)
    const job = findJob(state, account, params.syncJobId)
    if (!job) return response.untyped(notFound())
    const ifMatch = request.headers.get('if-match')
    if (ifMatch !== null && ifMatch !== syncJobEtag(job)) return response.untyped(outdated())
    const body: SyncJobPatch = await request.json()
    const errors: Violations = {}
    if (body.mailbox !== undefined && body.mailbox.trim().toLowerCase() !== job.mailbox) {
      addViolation(errors, 'mailbox', 'immutable')
    }
    const next: Values = { ...job }
    const changed = new Set<keyof Values>()
    for (const key of CONFIG_KEYS) {
      if (key === 'mailbox') continue
      const value = (body as Record<string, unknown>)[key]
      if (value === undefined) continue
      if (key === 'remotePassword' && value === '') continue
      const normal =
        key === 'remoteHost' && typeof value === 'string' ? value.trim().toLowerCase() : value
      if (normal !== job[key as ConfigKey]) {
        ;(next as unknown as Record<string, unknown>)[key] = normal
        changed.add(key)
      }
    }
    Object.assign(errors, validate(capabilitiesFor(state, account), next, changed))
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    if (changed.has('remoteHost') || changed.has('remoteUser')) {
      const duplicate = duplicateOf(state, next, job.id)
      if (duplicate) return response.untyped(exists(duplicate))
    }
    if (changed.size > 0) {
      Object.assign(job, next)
      job.modifiedAt = new Date(state.now()).toISOString()
    }
    return response(200).json({ data: syncJobView(job) }, etagHeaders(job))
  }),

  http.delete('/sync-jobs/{syncJobId}', ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireSyncJobs(state)
    if (account instanceof Response) return response.untyped(account)
    const job = findJob(state, account, params.syncJobId)
    if (!job) return response.untyped(notFound())
    const ifMatch = request.headers.get('if-match')
    if (ifMatch !== null && ifMatch !== syncJobEtag(job)) return response.untyped(outdated())
    state.syncJobs.jobs = state.syncJobs.jobs.filter((item) => item.id !== job.id)
    return response(204).empty()
  }),

  http.get('/sync-jobs/{syncJobId}/log', ({ params, response }) => {
    const state = scenario()
    const account = requireSyncJobs(state)
    if (account instanceof Response) return response.untyped(account)
    const job = findJob(state, account, params.syncJobId)
    if (!job) return response.untyped(notFound())
    return response(200).json({
      data: { syncJobId: job.id, runStatus: { ...job.runStatus }, log: job.log },
    })
  }),

  http.post('/sync-jobs/{syncJobId}/schedule-reset', ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireSyncJobs(state)
    if (account instanceof Response) return response.untyped(account)
    const job = findJob(state, account, params.syncJobId)
    if (!job) return response.untyped(notFound())
    job.runStatus = { ...job.runStatus, lastRunAt: null, lastResult: 'unknown', exitStatus: null }
    return response(200).json({ data: syncJobView(job) }, etagHeaders(job))
  }),
]
