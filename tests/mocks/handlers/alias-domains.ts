// Alias domain handlers (UI 004 T017, research R21): the documented behaviour of API 004's alias
// domains. Scope (domain administrators: alias domains of their domains), search, filters, sort and
// paging; creation with the `aliasDomains` flag first, the name and target rules, `ratelimit` for an
// initial rate limit, 503 while the shared store is down, `alias-domain-already-exists` and the
// creation report; target changes within the new target's alias limit; deletion with its cascade;
// per-target bulk outcomes, with per-target failures injected through `domainFailures`.
import type { AliasDomainCreationReport, BulkItemResult } from '@/api'

import { domainPart } from '../factories/alias'
import { aliasDomainValues, mockAliasDomain } from '../factories/alias-domain'
import { readableName } from '../factories/domain'
import type { MockAccount, MockAliasDomain, ScenarioState } from '../scenarios/state'
import { csrfProblem, http, problem, scenario } from './context'
import {
  addViolation,
  compareValues,
  domainFailure,
  isValidAsciiDomain,
  notFound,
  outdated,
  page,
  requireManager,
  validationFailed,
  type Violations,
} from './domain-rules'
import {
  adjustAliasUsage,
  aliasDomainInScope,
  aliasDomainView,
  bareVersion,
  bulkResult,
  domainInScope,
  domainKey,
  findAliasDomain,
  findAliasDomainFor,
  findDomain,
  ifMatchFails,
  immutableMembers,
  limitProblem,
  now,
  problemOf,
  removeAliasDomain,
  temporaryFailure,
  tooManyTargets,
} from './feature-004-rules'

const SORT_VALUE: Record<string, (item: Required<MockAliasDomain>) => unknown> = {
  name: (a) => a.name,
  targetDomain: (a) => a.target,
  active: (a) => a.active,
  createdAt: (a) => a.createdAt,
  modifiedAt: (a) => a.modifiedAt,
}

const SELECTOR = /^[A-Za-z0-9._-]+$/

/**
 * The target of an alias domain (API `AliasDomainRules::target`): an existing domain of the scope,
 * not an alias domain, not a relay domain; with the violations of `targetDomain`.
 */
function checkTarget(
  state: ScenarioState,
  account: MockAccount,
  raw: string,
  errors: Violations,
): string | null {
  const name = domainKey(raw)
  if (!name || !isValidAsciiDomain(name)) {
    addViolation(errors, 'targetDomain', 'notFound', { resource: 'domain' })
    return null
  }
  const aliasDomain = findAliasDomain(state, name)
  if (aliasDomain && domainInScope(state, account, aliasDomain.target)) {
    addViolation(errors, 'targetDomain', 'notEligible', { kind: 'aliasDomain' })
    return null
  }
  const domain = domainInScope(state, account, name)
  if (!domain) {
    addViolation(errors, 'targetDomain', 'notFound', { resource: 'domain' })
    return null
  }
  if (domain.backupMx) {
    addViolation(errors, 'targetDomain', 'notEligible', { kind: 'relayDomain' })
    return null
  }
  return domain.name
}

function creationReport(
  state: ScenarioState,
  name: string,
  values: { rateLimit: unknown; dkimSelector: string },
): AliasDomainCreationReport {
  const caps = state.capabilities004
  const existed = state.dkimKeys.includes(name)
  const dkimKey: AliasDomainCreationReport['dkimKey'] =
    values.dkimSelector === '' ? 'notRequested' : existed ? 'alreadyExisted' : 'created'
  if (dkimKey === 'created') state.dkimKeys.push(name)
  const report: AliasDomainCreationReport = {
    rateLimit: values.rateLimit ? 'applied' : 'notRequested',
    dkimKey,
    dkimDnsPublication:
      dkimKey !== 'created'
        ? 'skipped'
        : caps.dkimDnsPublicationEnabled
          ? 'published'
          : 'notConfigured',
    groupwareDirectoryUpdate: caps.groupwareEnabled ? 'done' : 'groupwareDisabled',
    ...state.aliasDomainCreationOutcomes,
  }
  const failed = Object.entries(report).filter(([, outcome]) => outcome === 'failed')
  if (failed.length > 0) {
    report.messages = Object.fromEntries(failed.map(([step]) => [step, `The ${step} step failed.`]))
  }
  return report
}

const READ_ONLY = [
  'name',
  'nameUnicode',
  'targetDomainUnicode',
  'targetIsRelayDomain',
  'aliasCount',
  'rateLimit',
  'createdAt',
  'modifiedAt',
] as const

const etagHeaders = (etag: string) => ({ headers: { ETag: etag } })

export const aliasDomainHandlers = [
  http.get('/alias-domains', ({ request, response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    if (state.sharedStoreDown) return response.untyped(temporaryFailure())
    const url = new URL(request.url)
    const params = url.searchParams
    let items = state.aliasDomains
      .filter((item) => aliasDomainInScope(state, account, item))
      .map(aliasDomainValues)
    const q = params.get('q')?.trim().toLowerCase()
    if (q) {
      items = items.filter((item) =>
        [item.name, readableName(item.name), item.target, readableName(item.target)].some((value) =>
          value.toLowerCase().includes(q),
        ),
      )
    }
    const targets = params.getAll('targetDomain').map(domainKey)
    if (targets.length > 0) items = items.filter((item) => targets.includes(item.target))
    const active = params.get('active')
    if (active !== null) items = items.filter((item) => item.active === (active === 'true'))
    const sort = params.get('sort') ?? 'name'
    const direction = params.get('order') === 'desc' ? -1 : 1
    const value = SORT_VALUE[sort] ?? SORT_VALUE.name!
    items.sort(
      (a, b) => direction * (compareValues(value(a), value(b)) || a.name.localeCompare(b.name)),
    )
    const result = page(items, url)
    return response(200).json({
      data: result.data.map((item) => aliasDomainView(state, item)),
      meta: result.meta,
    })
  }),

  http.post('/alias-domains', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    if (account.role !== 'admin' && !account.permissions.aliasDomains) {
      return response.untyped(
        problem(403, 'permission-flag-required', { requiredFlags: ['aliasDomains'] }),
      )
    }
    const body = await request.json()
    const errors: Violations = {}
    const name = domainKey(body.name)
    if (body.name.trim() === '') addViolation(errors, 'name', 'required')
    else if (!name || !isValidAsciiDomain(name)) {
      addViolation(errors, 'name', 'invalidFormat', { format: 'domainName' })
    } else if (name === state.serverHostname) addViolation(errors, 'name', 'reserved')
    const target = checkTarget(state, account, body.targetDomain, errors)
    if (name && target && name === target && !errors.name) {
      addViolation(errors, 'name', 'conflictsWith', { field: 'targetDomain', value: target })
    }
    const selector = body.dkimSelector
    if (selector !== undefined && selector !== '' && !SELECTOR.test(selector)) {
      addViolation(errors, 'dkimSelector', 'invalidFormat', { format: 'dkimSelector' })
    }
    if (Object.keys(errors).length > 0 || !target) return response.untyped(validationFailed(errors))
    const rateLimit = body.rateLimit ?? null
    if (rateLimit && account.role !== 'admin' && !account.permissions.ratelimit) {
      return response.untyped(
        problem(403, 'attribute-not-permitted', {
          attributes: ['rateLimit'],
          requiredFlags: { rateLimit: 'ratelimit' },
        }),
      )
    }
    if (state.sharedStoreDown) return response.untyped(temporaryFailure())
    if (findAliasDomain(state, name)) {
      return response.untyped(
        problem(409, 'alias-domain-already-exists', { name, existingKind: 'aliasDomain' }),
      )
    }
    if (findDomain(state, name)) {
      return response.untyped(
        problem(409, 'alias-domain-already-exists', { name, existingKind: 'domain' }),
      )
    }
    const failure = domainFailure(state, name, 'createAliasDomain')
    if (failure) return response.untyped(failure)

    const item = mockAliasDomain({
      name,
      target,
      active: body.active ?? true,
      rateLimit,
      createdAt: now(state),
      modifiedAt: null,
    })
    state.aliasDomains.push(item)
    // External sender addresses in the new alias domain are now local and go (API research R10).
    state.senderAcl = state.senderAcl.filter(
      (row) => !row.external || domainPart(row.sendAs) !== name,
    )
    const report = creationReport(state, name, {
      rateLimit,
      dkimSelector: selector ?? state.capabilities004.dkimDefaults?.selector ?? 'dkim',
    })
    const data = aliasDomainView(state, item)
    return response(201).json(
      { data: { ...data, creationReport: report } },
      { headers: { Location: `/api/v2/alias-domains/${name}`, ETag: data.etag } },
    )
  }),

  http.post('/alias-domains/bulk-actions', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    const errors: Violations = {}
    if (tooManyTargets(state, body.targets.length, errors)) {
      return response.untyped(validationFailed(errors))
    }
    const seen = new Set<string>()
    const results: BulkItemResult[] = []
    for (const target of body.targets) {
      const name = domainKey(target.id) || target.id
      if (seen.has(name)) continue
      seen.add(name)
      const item = findAliasDomainFor(state, account, target.id)
      if (!item) {
        results.push({ id: target.id, outcome: 'notFound' })
        continue
      }
      const injected = domainFailure(state, item.name, 'applyAliasDomainBulkAction')
      const failure = state.sharedStoreDown ? temporaryFailure() : injected
      if (failure) {
        results.push({ id: target.id, outcome: 'failed', problem: await problemOf(failure) })
        continue
      }
      const etag = aliasDomainView(state, item).etag
      if (target.version !== undefined && bareVersion(target.version) !== bareVersion(etag)) {
        results.push({ id: target.id, outcome: 'outdated', problem: await problemOf(outdated()) })
        continue
      }
      if (body.action === 'delete') {
        removeAliasDomain(state, item)
        results.push({ id: target.id, outcome: 'done' })
        continue
      }
      const active = body.action === 'activate'
      if (aliasDomainValues(item).active !== active) {
        item.active = active
        item.modifiedAt = now(state)
      }
      results.push({ id: target.id, outcome: 'done', version: aliasDomainView(state, item).etag })
    }
    return response(200).json({ data: bulkResult(state, results) })
  }),

  http.get('/alias-domains/{aliasDomain}', ({ params, response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const item = findAliasDomainFor(state, account, params.aliasDomain)
    if (!item) return response.untyped(notFound())
    if (state.sharedStoreDown) return response.untyped(temporaryFailure())
    const data = aliasDomainView(state, item)
    return response(200).json({ data }, etagHeaders(data.etag))
  }),

  http.patch('/alias-domains/{aliasDomain}', async ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const item = findAliasDomainFor(state, account, params.aliasDomain)
    if (!item) return response.untyped(notFound())
    const current = aliasDomainView(state, item)
    if (ifMatchFails(request.headers.get('if-match'), current.etag)) {
      return response.untyped(outdated())
    }
    const failure = state.sharedStoreDown
      ? temporaryFailure()
      : domainFailure(state, item.name, 'updateAliasDomain')
    if (failure) return response.untyped(failure)
    const body = await request.json()
    const errors: Violations = {}
    let target = current.targetDomain
    if (body.targetDomain !== undefined) {
      const sent = domainKey(body.targetDomain)
      target =
        sent === current.targetDomain
          ? sent
          : (checkTarget(state, account, body.targetDomain, errors) ?? target)
    }
    const resulting = aliasDomainView(state, { ...item, target })
    immutableMembers(
      body,
      READ_ONLY.filter(
        (member) => member !== 'targetDomainUnicode' && member !== 'targetIsRelayDomain',
      ),
      current,
      errors,
    )
    immutableMembers(body, ['targetDomainUnicode', 'targetIsRelayDomain'], resulting, errors)
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    if (target !== current.targetDomain) {
      const limit = limitProblem(state, target, current.aliasCount)
      if (limit) return response.untyped(limit)
    }
    const values = aliasDomainValues(item)
    const active = typeof body.active === 'boolean' ? body.active : values.active
    if (target !== values.target || active !== values.active) {
      if (target !== values.target) {
        adjustAliasUsage(state, values.target, -current.aliasCount)
        adjustAliasUsage(state, target, current.aliasCount)
      }
      item.target = target
      item.active = active
      item.modifiedAt = now(state)
    }
    const data = aliasDomainView(state, item)
    return response(200).json({ data }, etagHeaders(data.etag))
  }),

  http.delete('/alias-domains/{aliasDomain}', ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const item = findAliasDomainFor(state, account, params.aliasDomain)
    if (!item) return response.untyped(notFound())
    const failure = state.sharedStoreDown
      ? temporaryFailure()
      : domainFailure(state, item.name, 'deleteAliasDomain')
    if (failure) return response.untyped(failure)
    if (ifMatchFails(request.headers.get('if-match'), aliasDomainView(state, item).etag)) {
      return response.untyped(outdated())
    }
    removeAliasDomain(state, item)
    return response(204).empty()
  }),
]
