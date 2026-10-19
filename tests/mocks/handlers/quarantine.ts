// Quarantine handlers (UI 006 T026, T039, T059, T070, T107, research R28): the documented behaviour
// of API 006's quarantine module on the scenario state. Scope per role (404 outside it), the flags
// of FR-006, search, filters (`to` exclusive, unscored items left out of score ranges), the ten sort
// keys with ties by ID (newest first), item details with attachments only for callers who may
// download them, actions with `If-Match`, action reports and injected step failures, busy items,
// refused deliveries and temporary failures, bulk actions with one result per item, binary
// downloads with their four headers, the settings (merge patch, defaults, rule codes, the template
// check) and the notification settings, single and in bulk.
import { createHash } from 'node:crypto'

import { HttpResponse } from 'msw'

import type {
  BulkItemResult,
  QuarantineActionReport,
  QuarantineBulkItemResult,
  QuarantineItemAction,
  QuarantineNotificationSettings,
} from '@/api'

import { asciiName } from '../factories/domain'
import { requestId } from '../factories/ids'
import { addressOf } from '../factories/mailbox'
import {
  attachmentView,
  contentStatusOf,
  downloadHeaders,
  messageBytes,
  messageFileName,
  attachmentBytes,
  quarantineItemDetails,
  quarantineItemEtag,
  quarantineItemView,
} from '../factories/quarantine-item'
import { DEFAULT_TEMPLATE, quarantineSettingsView } from '../factories/quarantine-settings'
import type {
  MockAccount,
  MockMailbox,
  MockQuarantineItem,
  MockQuarantineSettings,
  ScenarioState,
} from '../scenarios/state'
import { csrfProblem, http, problem, requireAccount, scenario } from './context'
import { addViolation, compareValues, validationFailed, type Violations } from './domain-rules'
import { EMAIL } from './mailbox-rules'
import {
  audit,
  bulkRequestId,
  flagRequired,
  forbidden,
  hasFlag,
  ifMatchFails,
  knownDomainNames,
  mailboxFor,
  notFound,
  outdated,
  reachesRecipient,
  versionFails,
} from './quarantine-rules'

// ---------------------------------------------------------------------------------------------
// Items

const SORT_VALUE: Record<string, (item: MockQuarantineItem) => unknown> = {
  arrivedAt: (item) => item.arrivedAt,
  id: (item) => item.id,
  queueId: (item) => item.queueId,
  score: (item) => item.score,
  sender: (item) => item.sender,
  recipient: (item) => item.recipient,
  subject: (item) => item.subject,
  action: (item) => item.action,
  virus: (item) => item.virus,
  notified: (item) => item.notified,
}

const DESCENDING_BY_DEFAULT = new Set(['arrivedAt', 'id', 'score'])

function findItem(
  state: ScenarioState,
  account: MockAccount,
  rawId: string | number,
): MockQuarantineItem | undefined {
  const id = Number(rawId)
  const item = state.quarantine.items.find((entry) => entry.id === id)
  if (!item || item.inject?.removedElsewhere) return undefined
  return reachesRecipient(account, item.recipient) ? item : undefined
}

/**
 * The version an action is checked against: an item changed elsewhere (`inject.outdated`) does not
 * match the version the client listed, once; the client's re-read then has the current one.
 */
function versionMismatch(item: MockQuarantineItem, sent: string | null | undefined): boolean {
  if (item.inject?.outdated) {
    if (sent === null || sent === undefined) return false
    delete item.inject.outdated
    return true
  }
  return sent !== null && sent !== undefined && ifMatchFails(sent, quarantineItemEtag(item))
}

const removeItem = (state: ScenarioState, item: MockQuarantineItem) => {
  state.quarantine.items = state.quarantine.items.filter((entry) => entry !== item)
}

const canSeeAttachments = (account: MockAccount) =>
  account.role !== 'mailboxUser' || !!account.permissions.quarantineAttachments

/** The missing flag of a whole-message download (`quarantine` named first), or null. */
function messageDownloadFlag(account: MockAccount): 'quarantine' | 'quarantineAttachments' | null {
  if (account.role === 'admin') return null
  if (!account.permissions.quarantine) return 'quarantine'
  if (account.role === 'mailboxUser' && !account.permissions.quarantineAttachments) {
    return 'quarantineAttachments'
  }
  return null
}

/** A problem object as bulk results carry it. */
function problemBody(status: number, type: string | null, extra: Record<string, unknown> = {}) {
  return {
    type: type ? `/api/v2/problems/${type}` : 'about:blank',
    title: `HTTP ${status}`,
    status,
    requestId: requestId(),
    ...extra,
  }
}

type ItemAction = 'release' | 'releaseWithoutLearning' | 'learnAsSpam' | 'delete'

const AUDIT_EVENT = {
  release: 'quarantineItemRelease',
  releaseWithoutLearning: 'quarantineItemRelease',
  learnAsSpam: 'quarantineItemSpamLearning',
  delete: 'quarantineItemDeletion',
} as const

type Refusal = { status: number; type: string | null; extra?: Record<string, unknown> }

/**
 * Runs one action on one item: the injected refusals first (busy, temporary failure, refused
 * delivery, failed spam learning), then the steps, the report, the removal and the audit record.
 */
function act(
  state: ScenarioState,
  account: MockAccount,
  item: MockQuarantineItem,
  action: ItemAction,
  bulk: string | null,
): { refusal: Refusal & { retryAfter?: number } } | { report: QuarantineActionReport | null } {
  const inject = item.inject ?? {}
  const base = { queueId: item.queueId, recipient: item.recipient, sender: item.sender }
  const refuse = (
    refusal: Refusal & { retryAfter?: number },
    failureReason: 'conflict' | 'temporaryFailure' | 'serviceFailure',
  ) => {
    audit(state, account, {
      eventType: AUDIT_EVENT[action],
      target: { type: 'quarantineItem', id: String(item.id), name: item.queueId },
      details: {
        ...base,
        ...(bulk ? { bulkRequestId: bulk } : {}),
        problemType: refusal.type ? `/api/v2/problems/${refusal.type}` : 'about:blank',
        status: refusal.status,
      },
      failureReason,
    })
    return { refusal }
  }
  if (inject.busy) {
    const retryAfter = inject.busy.retryAfter ?? 5
    // The other request then finished: the item is gone, or it is available again.
    if (inject.busy.then === 'gone') removeItem(state, item)
    else delete item.inject!.busy
    return refuse({ status: 409, type: 'quarantine-item-busy', retryAfter }, 'conflict')
  }
  if (inject.temporaryFailure) {
    return refuse(
      { status: 503, type: 'temporary-failure', extra: { ...inject.temporaryFailure } },
      'temporaryFailure',
    )
  }
  if (action.startsWith('release') && inject.deliveryRefused) {
    return refuse(
      {
        status: 409,
        type: 'quarantine-delivery-refused',
        extra: {
          smtpCode: inject.deliveryRefused.smtpCode ?? 550,
          smtpResponse:
            inject.deliveryRefused.smtpResponse ??
            '550 5.1.1 <‮gro.elpmaxe@ecila>: Recipient address rejected: User unknown',
        },
      },
      'serviceFailure',
    )
  }
  if (action === 'learnAsSpam' && inject.learning === 'failed') {
    return refuse(
      {
        status: 503,
        type: 'temporary-failure',
        extra: { dependency: 'spamFilter', step: 'learning' },
      },
      'temporaryFailure',
    )
  }

  let report: QuarantineActionReport | null = null
  if (action !== 'delete') {
    const learnRequested = action !== 'releaseWithoutLearning'
    const learning: QuarantineActionReport['learning'] = !learnRequested
      ? 'notRequested'
      : inject.learning === 'failed'
        ? 'failed'
        : inject.learning === 'alreadyLearned'
          ? 'alreadyLearned'
          : 'done'
    const fuzzy: QuarantineActionReport['fuzzy'] =
      !learnRequested || learning === 'failed' ? 'notRequested' : (inject.fuzzy ?? 'done')
    report = {
      itemId: item.id,
      queueId: item.queueId,
      action,
      delivery: action === 'learnAsSpam' ? 'notApplicable' : 'done',
      learning,
      fuzzy,
      itemRemoved: true,
      learningError: learning === 'failed' ? 'Rspamd answered: learning failed (500)' : null,
      fuzzyError: fuzzy === 'failed' ? 'Rspamd answered: fuzzy storage unavailable' : null,
    }
  }
  removeItem(state, item)
  audit(state, account, {
    eventType: AUDIT_EVENT[action],
    target: { type: 'quarantineItem', id: String(item.id), name: item.queueId },
    details: {
      ...base,
      ...(report
        ? {
            action: report.action,
            steps: { delivery: report.delivery, learning: report.learning, fuzzy: report.fuzzy },
          }
        : {}),
      ...(bulk ? { bulkRequestId: bulk } : {}),
    },
  })
  return { report }
}

function refusalResponse(refusal: Refusal & { retryAfter?: number }): Response {
  const headers: Record<string, string> = {}
  if (refusal.retryAfter !== undefined) headers['Retry-After'] = String(refusal.retryAfter)
  else if (refusal.status === 503) headers['Retry-After'] = '30'
  return problem(refusal.status, refusal.type, refusal.extra ?? {}, headers)
}

/** The shared path of the three single actions. */
async function singleAction(request: Request, rawId: string, action: ItemAction) {
  const state = scenario()
  const refused = csrfProblem(state, request)
  if (refused) return refused
  const account = requireAccount(state)
  if (account instanceof Response) return account
  if (!hasFlag(account, 'quarantine')) return flagRequired('quarantine')
  const item = findItem(state, account, rawId)
  if (!item) return notFound()
  if (versionMismatch(item, request.headers.get('if-match'))) return outdated()
  let finalAction = action
  if (action === 'release') {
    const text = await request.text()
    const body = text ? (JSON.parse(text) as { learnAsHam?: boolean }) : {}
    if (body.learnAsHam === false) finalAction = 'releaseWithoutLearning'
  }
  const outcome = act(state, account, item, finalAction, null)
  if ('refusal' in outcome) return refusalResponse(outcome.refusal)
  if (!outcome.report) return new HttpResponse(null, { status: 204 })
  return HttpResponse.json({ data: outcome.report })
}

// ---------------------------------------------------------------------------------------------
// Settings

const settingsOf = (state: ScenarioState) => state.quarantine.settings

const emptyToNull = (value: unknown) => (value === '' || value === null ? null : value)

const BLOCK_OPEN = /\{%-?\s*(for|if|block|macro|filter|with)\b/
const BLOCK_CLOSE = /\{%-?\s*end(for|if|block|macro|filter|with)\b/

/**
 * The check of a non-empty template the way the legacy notifier uses it (`invalidTemplate`): a
 * sandbox violation (`security`), an error while rendering (`render`), a render that does not
 * finish (`timeout`), or unbalanced blocks and expressions (`syntax`, with the line).
 */
export function checkTemplate(template: string): { reason: string; line?: number } | null {
  const lines = template.split('\n')
  const lineOf = (pattern: RegExp) => {
    const index = lines.findIndex((line) => pattern.test(line))
    return index < 0 ? undefined : index + 1
  }
  if (/__[a-z]+__|\.mro\b|\bimport\s*\(/.test(template)) {
    return { reason: 'security', line: lineOf(/__[a-z]+__|\.mro\b|\bimport\s*\(/) }
  }
  if (/range\(\s*\d{7,}/.test(template)) return { reason: 'timeout' }
  if (/\{\{[^}]*\bundefined_function\s*\(/.test(template)) {
    return { reason: 'render', line: lineOf(/undefined_function/) }
  }
  const stack: { tag: string; line: number }[] = []
  for (const [index, line] of lines.entries()) {
    const opens = (line.match(/\{\{/g) ?? []).length
    const closes = (line.match(/\}\}/g) ?? []).length
    if (opens !== closes) return { reason: 'syntax', line: index + 1 }
    for (const match of line.matchAll(
      /\{%-?\s*(end)?(for|if|block|macro|filter|with)\b[^%]*%\}/g,
    )) {
      if (match[1]) {
        const open = stack.pop()
        if (!open || open.tag !== match[2]) return { reason: 'syntax', line: index + 1 }
      } else stack.push({ tag: match[2]!, line: index + 1 })
    }
    if (BLOCK_OPEN.test(line) && !/%\}/.test(line)) return { reason: 'syntax', line: index + 1 }
    if (BLOCK_CLOSE.test(line) && !/%\}/.test(line)) return { reason: 'syntax', line: index + 1 }
  }
  if (stack.length > 0) return { reason: 'syntax', line: stack[0]!.line }
  return null
}

function checkAddress(errors: Violations, path: string, value: unknown): string | null {
  const text = emptyToNull(value)
  if (text === null) return null
  if (typeof text !== 'string' || text.length > 255 || !EMAIL.test(text.trim())) {
    addViolation(errors, path, 'invalidFormat', { format: 'email' })
    return null
  }
  return text.trim()
}

/** The merge patch applied to a copy of the stored values, with the field violations. */
function patchSettings(
  state: ScenarioState,
  current: MockQuarantineSettings,
  body: Record<string, unknown>,
  errors: Violations,
): MockQuarantineSettings {
  const caps = state.quarantine.capabilities.settings
  const next: MockQuarantineSettings = { ...current, excludedDomains: [...current.excludedDomains] }
  if ('retentionPerMailbox' in body) {
    const value = body.retentionPerMailbox as number
    if (value > caps.maxRetentionPerMailbox) {
      addViolation(errors, 'retentionPerMailbox', 'outOfRange', {
        min: 0,
        max: caps.maxRetentionPerMailbox,
      })
    } else next.retentionPerMailbox = value
  }
  if ('maxMessageSize' in body) {
    const value = body.maxMessageSize as number
    if (value % caps.maxMessageSizeStep !== 0) {
      addViolation(errors, 'maxMessageSize', 'notMultipleOf', { factor: caps.maxMessageSizeStep })
    } else if (value > caps.maxMessageSize) {
      addViolation(errors, 'maxMessageSize', 'outOfRange', { min: 0, max: caps.maxMessageSize })
    } else next.maxMessageSize = value
  }
  if ('notificationScoreLimit' in body) {
    next.notificationScoreLimit = body.notificationScoreLimit as number | null
  }
  if ('maxAgeDays' in body) {
    const value = body.maxAgeDays as number
    if (value < caps.maxAgeDays.min || value > caps.maxAgeDays.max) {
      addViolation(errors, 'maxAgeDays', 'outOfRange', {
        min: caps.maxAgeDays.min,
        max: caps.maxAgeDays.max,
      })
    } else next.maxAgeDays = value
  }
  if ('excludedDomains' in body) {
    const known = knownDomainNames(state)
    const stored = new Set(current.excludedDomains)
    const names: string[] = []
    ;(body.excludedDomains as string[]).forEach((raw, index) => {
      const name = raw.trim().toLowerCase()
      if (!known.has(name) && !stored.has(name)) {
        addViolation(errors, `excludedDomains.${index}`, 'notFound', {})
      } else if (!names.includes(name)) names.push(name)
    })
    next.excludedDomains = names
  }
  if ('releaseFormat' in body) next.releaseFormat = body.releaseFormat as 'original' | 'attachment'
  if ('notificationSender' in body) {
    next.notificationSender = checkAddress(errors, 'notificationSender', body.notificationSender)
  }
  if ('copyRecipient' in body) {
    next.copyRecipient = checkAddress(errors, 'copyRecipient', body.copyRecipient)
  }
  if ('redirectRecipient' in body) {
    next.redirectRecipient = checkAddress(errors, 'redirectRecipient', body.redirectRecipient)
  }
  if ('notificationSubject' in body) {
    const subject = emptyToNull(body.notificationSubject) as string | null
    if (subject !== null && Array.from(subject).length > caps.notificationSubjectMaxLength) {
      addViolation(errors, 'notificationSubject', 'tooLong', {
        max: caps.notificationSubjectMaxLength,
      })
    } else next.notificationSubject = subject
  }
  if ('notificationTemplate' in body) {
    const template = emptyToNull(body.notificationTemplate) as string | null
    if (template === null) next.notificationTemplate = null
    else if (Buffer.byteLength(template, 'utf8') > caps.notificationTemplateMaxBytes) {
      addViolation(errors, 'notificationTemplate', 'tooLong', {
        max: caps.notificationTemplateMaxBytes,
        unit: 'bytes',
      })
    } else {
      const invalid = checkTemplate(template)
      if (invalid) addViolation(errors, 'notificationTemplate', 'invalidTemplate', invalid)
      else next.notificationTemplate = template
    }
  }
  return next
}

/** The `changes` of the audit record: old and new values; the template only by its sizes. */
function settingsChanges(before: MockQuarantineSettings, after: MockQuarantineSettings) {
  const changes: Record<string, unknown> = {}
  for (const key of Object.keys(after) as (keyof MockQuarantineSettings)[]) {
    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) continue
    if (key === 'notificationTemplate') {
      changes[key] = {
        changed: true,
        oldSize: Buffer.byteLength(before[key] ?? DEFAULT_TEMPLATE, 'utf8'),
        newSize: Buffer.byteLength(after[key] ?? DEFAULT_TEMPLATE, 'utf8'),
      }
    } else changes[key] = { old: before[key], new: after[key] }
  }
  return changes
}

// ---------------------------------------------------------------------------------------------
// Notification settings

const isNoCategory = (state: ScenarioState, mailbox: MockMailbox) =>
  state.quarantine.noCategory.includes(addressOf(mailbox))

export function notificationSettingsView(
  state: ScenarioState,
  mailbox: MockMailbox,
): QuarantineNotificationSettings {
  const category = isNoCategory(state, mailbox) ? null : mailbox.quarantineCategory
  const key = JSON.stringify([addressOf(mailbox), mailbox.quarantineNotification, category])
  return {
    mailbox: addressOf(mailbox),
    frequency: mailbox.quarantineNotification,
    category,
    etag: `"n${createHash('sha256').update(key).digest('hex').slice(0, 23)}"`,
  }
}

function applyNotification(
  state: ScenarioState,
  mailbox: MockMailbox,
  values: {
    frequency?: MockMailbox['quarantineNotification']
    category?: MockMailbox['quarantineCategory']
  },
): Record<string, unknown> {
  const before = notificationSettingsView(state, mailbox)
  const changes: Record<string, unknown> = {}
  if (values.frequency !== undefined && values.frequency !== before.frequency) {
    changes.frequency = { old: before.frequency, new: values.frequency }
    mailbox.quarantineNotification = values.frequency
  }
  if (values.category !== undefined && values.category !== before.category) {
    changes.category = { old: before.category, new: values.category }
    mailbox.quarantineCategory = values.category
    state.quarantine.noCategory = state.quarantine.noCategory.filter(
      (address) => address !== addressOf(mailbox),
    )
  }
  if (Object.keys(changes).length > 0) mailbox.modifiedAt = new Date(state.now()).toISOString()
  return changes
}

// ---------------------------------------------------------------------------------------------

export const quarantineHandlers = [
  http.get('/capabilities/quarantine', ({ response }) => {
    const state = scenario()
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    return response(200).json({ data: state.quarantine.capabilities })
  }),

  // Literal paths before `/quarantine/{itemId}`.
  http.get('/quarantine/settings', ({ response }) => {
    const state = scenario()
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    const data = quarantineSettingsView(
      settingsOf(state),
      account.role === 'admin' ? 'full' : 'public',
      knownDomainNames(state),
    )
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.patch('/quarantine/settings', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    if (account.role !== 'admin') return response.untyped(forbidden())
    const current = settingsOf(state)
    const etag = quarantineSettingsView(current, 'full', knownDomainNames(state)).etag
    if (ifMatchFails(request.headers.get('if-match'), etag)) {
      return response.untyped(outdated())
    }
    const body = (await request.json()) as Record<string, unknown>
    const errors: Violations = {}
    const next = patchSettings(state, current, body, errors)
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    if (new URL(request.url).searchParams.get('validateOnly') === 'true') {
      return response.untyped(HttpResponse.json({ data: { valid: true } }))
    }
    const changes = settingsChanges(current, next)
    state.quarantine.settings = next
    audit(state, account, {
      eventType: 'quarantineSettingsUpdate',
      target: { type: 'quarantineSettings', id: null, name: null },
      details: { changes },
    })
    const data = quarantineSettingsView(next, 'full', knownDomainNames(state))
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.post('/quarantine/settings/template-preview', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    if (account.role !== 'admin') return response.untyped(forbidden())
    // The body may be omitted.
    const body: { template?: string | null; quarantineAcl?: boolean } = {
      ...(await request.json().catch(() => undefined)),
    }
    const template = body.template ?? settingsOf(state).notificationTemplate ?? DEFAULT_TEMPLATE
    const invalid = checkTemplate(template)
    if (invalid) {
      return response.untyped(
        validationFailed({
          template: [{ code: 'invalidTemplate', params: invalid, message: 'Invalid template.' }],
        }),
      )
    }
    const acl = body.quarantineAcl ?? true
    return response(200).json({
      data: {
        subject: settingsOf(state).notificationSubject ?? 'Spam Quarantine Notification',
        html: template,
        text: template.replace(/<[^>]*>/g, ''),
        sample: {
          username: 'user@example.org',
          counter: 3,
          hostname: state.serverHostname,
          quarantineAcl: acl ? 1 : 0,
          items: [],
        },
      },
    })
  }),

  http.post('/quarantine/bulk-actions', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    if (!hasFlag(account, 'quarantine')) return response.untyped(flagRequired('quarantine'))
    const body = await request.json()
    const max = state.quarantine.capabilities.bulkLimit
    if (body.targets.length > max) {
      const errors: Violations = {}
      addViolation(errors, 'targets', 'tooMany', { max })
      return response.untyped(validationFailed(errors))
    }
    const bulk = bulkRequestId(state)
    const seen = new Set<string>()
    const results: QuarantineBulkItemResult[] = []
    for (const target of body.targets) {
      if (seen.has(target.id)) continue
      seen.add(target.id)
      const item = /^\d+$/.test(target.id) ? findItem(state, account, target.id) : undefined
      if (!item) {
        results.push({ id: target.id, outcome: 'notFound' })
        continue
      }
      if (versionMismatch(item, target.version)) {
        results.push({ id: target.id, outcome: 'outdated', problem: problemBody(412, null) })
        continue
      }
      const outcome = act(state, account, item, body.action, bulk)
      if ('refusal' in outcome) {
        const { status, type, extra } = outcome.refusal
        results.push({
          id: target.id,
          outcome: status === 409 ? 'refused' : 'failed',
          problem: problemBody(status, type, extra),
        })
      } else {
        results.push({
          id: target.id,
          outcome: 'done',
          ...(outcome.report ? { report: outcome.report } : {}),
        })
      }
    }
    const count = (outcome: BulkItemResult['outcome']) =>
      results.filter((result) => result.outcome === outcome).length
    return response(200).json({
      data: {
        bulkRequestId: bulk,
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

  http.get('/quarantine', ({ request, response }) => {
    const state = scenario()
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    const url = new URL(request.url)
    const params = url.searchParams
    const q = params.get('q')?.trim().toLowerCase()
    const recipient = params.get('recipient')?.trim().toLowerCase()
    const domain = params.get('domain')?.trim().toLowerCase()
    const actions = params.getAll('action') as QuarantineItemAction[]
    const virus = params.get('virus')
    const notified = params.get('notified')
    const from = params.get('from')
    const to = params.get('to')
    const minScore = params.get('minScore')
    const maxScore = params.get('maxScore')
    let items = state.quarantine.items.filter((item) => reachesRecipient(account, item.recipient))
    if (q) {
      items = items.filter((item) =>
        [item.subject, item.sender, item.recipient, item.queueId].some((value) =>
          value.toLowerCase().includes(q),
        ),
      )
    }
    if (recipient) items = items.filter((item) => item.recipient === recipient)
    if (domain) {
      const ascii = asciiName(domain) || domain
      items = items.filter((item) => item.recipient.endsWith(`@${ascii}`))
    }
    if (actions.length > 0) items = items.filter((item) => actions.includes(item.action))
    if (virus !== null) items = items.filter((item) => item.virus === (virus === 'true'))
    if (notified !== null) items = items.filter((item) => item.notified === (notified === 'true'))
    if (from) items = items.filter((item) => Date.parse(item.arrivedAt) >= Date.parse(from))
    if (to) items = items.filter((item) => Date.parse(item.arrivedAt) < Date.parse(to))
    if (minScore !== null) {
      items = items.filter((item) => item.score !== null && item.score >= Number(minScore))
    }
    if (maxScore !== null) {
      items = items.filter((item) => item.score !== null && item.score <= Number(maxScore))
    }
    const sort = params.get('sort') ?? 'arrivedAt'
    const order = params.get('order') ?? (DESCENDING_BY_DEFAULT.has(sort) ? 'desc' : 'asc')
    const value = SORT_VALUE[sort] ?? SORT_VALUE.arrivedAt!
    const direction = order === 'desc' ? -1 : 1
    items = [...items].sort((a, b) => direction * compareValues(value(a), value(b)) || b.id - a.id)
    const limit = Number(params.get('limit') ?? state.quarantine.capabilities.defaultPageSize)
    const offset = Number(params.get('offset') ?? 0)
    return response(200).json({
      data: items.slice(offset, offset + limit).map(quarantineItemView),
      meta: { total: items.length, limit, offset },
    })
  }),

  http.get('/quarantine/{itemId}', ({ params, response }) => {
    const state = scenario()
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    const item = findItem(state, account, params.itemId)
    if (!item) return response.untyped(notFound())
    const data = quarantineItemDetails(item, {
      admin: account.role === 'admin',
      attachments: canSeeAttachments(account),
      contentSizeLimit: state.quarantine.capabilities.contentSizeLimit,
    })
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.delete('/quarantine/{itemId}', async ({ params, request, response }) =>
    response.untyped(await singleAction(request, String(params.itemId), 'delete')),
  ),

  http.post('/quarantine/{itemId}/release', async ({ params, request, response }) =>
    response.untyped(await singleAction(request, String(params.itemId), 'release')),
  ),

  http.post('/quarantine/{itemId}/spam-learning', async ({ params, request, response }) =>
    response.untyped(await singleAction(request, String(params.itemId), 'learnAsSpam')),
  ),

  http.get('/quarantine/{itemId}/message', ({ params, response }) => {
    const state = scenario()
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    const missing = messageDownloadFlag(account)
    if (missing) return response.untyped(flagRequired(missing))
    const item = findItem(state, account, params.itemId)
    if (!item) return response.untyped(notFound())
    const limit = state.quarantine.capabilities.contentSizeLimit
    if (contentStatusOf(item, limit) === 'tooLarge') {
      return response.untyped(
        problem(409, 'quarantine-message-too-large', { size: item.size, limit }),
      )
    }
    return response.untyped(
      new HttpResponse(new Uint8Array(messageBytes(item)), {
        status: 200,
        headers: downloadHeaders(messageFileName(item), 'message/rfc822'),
      }),
    )
  }),

  http.get('/quarantine/{itemId}/attachments/{position}', ({ params, response }) => {
    const state = scenario()
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    if (!canSeeAttachments(account)) return response.untyped(flagRequired('quarantineAttachments'))
    const item = findItem(state, account, params.itemId)
    if (!item) return response.untyped(notFound())
    const limit = state.quarantine.capabilities.contentSizeLimit
    if (contentStatusOf(item, limit) === 'tooLarge') {
      return response.untyped(
        problem(409, 'quarantine-message-too-large', { size: item.size, limit }),
      )
    }
    const position = Number(params.position)
    const attachment = item.content?.attachments[position]
    if (!attachment) return response.untyped(notFound())
    return response.untyped(
      new HttpResponse(new Uint8Array(attachmentBytes(attachment)), {
        status: 200,
        headers: downloadHeaders(
          attachmentView(attachment, position).fileName,
          'application/octet-stream',
        ),
      }),
    )
  }),

  http.post('/quarantine-notification-settings/bulk-actions', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    if (account.role === 'mailboxUser') return response.untyped(forbidden())
    const body = await request.json()
    const max = state.quarantine.capabilities.bulkLimit
    if (body.targets.length > max) {
      const errors: Violations = {}
      addViolation(errors, 'targets', 'tooMany', { max })
      return response.untyped(validationFailed(errors))
    }
    const bulk = bulkRequestId(state)
    const seen = new Set<string>()
    const results: BulkItemResult[] = []
    for (const target of body.targets) {
      const key = target.id.trim().toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const mailbox = mailboxFor(state, account, target.id)
      if (!mailbox) {
        results.push({ id: target.id, outcome: 'notFound' })
        continue
      }
      if (versionFails(target.version, notificationSettingsView(state, mailbox).etag)) {
        results.push({ id: target.id, outcome: 'outdated', problem: problemBody(412, null) })
        continue
      }
      const changes = applyNotification(state, mailbox, {
        frequency: body.frequency,
        category: body.category,
      })
      audit(state, account, {
        eventType: 'quarantineNotificationSettingsUpdate',
        target: {
          type: 'quarantineNotificationSettings',
          id: addressOf(mailbox),
          name: addressOf(mailbox),
        },
        details: { changes, bulkRequestId: bulk },
      })
      results.push({
        id: target.id,
        outcome: 'done',
        version: notificationSettingsView(state, mailbox).etag,
      })
    }
    const count = (outcome: BulkItemResult['outcome']) =>
      results.filter((result) => result.outcome === outcome).length
    return response(200).json({
      data: {
        bulkRequestId: bulk,
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

  http.get('/mailboxes/{mailbox}/quarantine-notification-settings', ({ params, response }) => {
    const state = scenario()
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    const mailbox = mailboxFor(state, account, params.mailbox)
    if (!mailbox) return response.untyped(notFound())
    const data = notificationSettingsView(state, mailbox)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.patch(
    '/mailboxes/{mailbox}/quarantine-notification-settings',
    async ({ params, request, response }) => {
      const state = scenario()
      const refused = csrfProblem(state, request)
      if (refused) return response.untyped(refused)
      const account = requireAccount(state)
      if (account instanceof Response) return response.untyped(account)
      const mailbox = mailboxFor(state, account, params.mailbox)
      if (!mailbox) return response.untyped(notFound())
      const current = notificationSettingsView(state, mailbox)
      if (ifMatchFails(request.headers.get('if-match'), current.etag)) {
        return response.untyped(outdated())
      }
      const body = await request.json()
      if (account.role === 'mailboxUser') {
        const attributes: ('frequency' | 'category')[] = []
        const requiredFlags: Record<string, 'quarantineNotification' | 'quarantineCategory'> = {}
        if (
          body.frequency !== undefined &&
          body.frequency !== current.frequency &&
          !account.permissions.quarantineNotification
        ) {
          attributes.push('frequency')
          requiredFlags.frequency = 'quarantineNotification'
        }
        if (
          body.category !== undefined &&
          body.category !== current.category &&
          !account.permissions.quarantineCategory
        ) {
          attributes.push('category')
          requiredFlags.category = 'quarantineCategory'
        }
        if (attributes.length > 0) {
          audit(state, account, {
            eventType: 'quarantineNotificationSettingsUpdate',
            target: {
              type: 'quarantineNotificationSettings',
              id: addressOf(mailbox),
              name: addressOf(mailbox),
            },
            details: {
              problemType: '/api/v2/problems/attribute-not-permitted',
              status: 403,
              requiredFlags: Object.values(requiredFlags),
            },
            failureReason: 'attributeNotPermitted',
          })
          return response.untyped(
            problem(403, 'attribute-not-permitted', { attributes, requiredFlags }),
          )
        }
      }
      const changes = applyNotification(state, mailbox, body)
      audit(state, account, {
        eventType: 'quarantineNotificationSettingsUpdate',
        target: {
          type: 'quarantineNotificationSettings',
          id: addressOf(mailbox),
          name: addressOf(mailbox),
        },
        details: { changes },
      })
      const data = notificationSettingsView(state, mailbox)
      return response(200).json({ data }, { headers: { ETag: data.etag } })
    },
  ),
]
