// Domain handlers (UI 002 T009, research D28): the documented behaviour of API 002 on the
// scenario state: scope, name normalisation, search, filters, sort and paging, template pre-fill,
// relay normalisation, the field rules with their codes and parameters, If-Match and 412,
// attribute-not-permitted, domain-exists and domain-not-empty, the deletion preview, the footer
// exclusion checks by position, distinct tags and per-item bulk outcomes with version checks.
import type {
  BulkItemResult,
  Domain,
  DomainCreationReport,
  DomainPatch,
  DomainTagSummary,
} from '@/api'

import {
  aliasAddresses,
  aliasDomainsOf,
  asciiName,
  domainAdminsOf,
  domainEtag,
  domainView,
  mailboxAddresses,
  mockDomain,
  normaliseTags,
  readableName,
  resourceAddresses,
} from '../factories/domain'
import { footerView } from '../factories/domain-footer'
import { isDefaultTemplate } from '../factories/domain-template'
import type { MockAccount, MockDomain, ScenarioState } from '../scenarios/state'
import { csrfProblem, http, problem, scenario } from './context'
import {
  addViolation,
  checkQuotas,
  compareValues,
  domainFailure,
  findInScope,
  isValidAsciiDomain,
  MIB,
  normaliseRelay,
  notFound,
  outdated,
  page,
  requireAdmin,
  requireManager,
  sameTags,
  scopeOf,
  utf8Bytes,
  validationFailed,
  type Violations,
} from './domain-rules'

const view = (state: ScenarioState, account: MockAccount, domain: MockDomain): Domain =>
  domainView(state, domain, { admin: account.role === 'admin' })

const SORT_VALUE: Record<string, (domain: MockDomain) => unknown> = {
  name: (d) => d.name,
  description: (d) => d.description,
  active: (d) => d.active,
  backupMx: (d) => d.backupMx,
  mailboxes: (d) => d.usage.mailboxes,
  aliases: (d) => d.usage.aliases,
  quotaAllocated: (d) => d.usage.quotaAllocated,
  storageUsed: (d) => d.usage.storageUsed,
  maxMailboxes: (d) => d.maxMailboxes,
  maxAliases: (d) => d.maxAliases,
  maxMailboxQuota: (d) => d.maxMailboxQuota,
  domainQuota: (d) => d.domainQuota,
  createdAt: (d) => d.createdAt,
  modifiedAt: (d) => d.modifiedAt,
}

function matchesSearch(domain: MockDomain, q: string): boolean {
  const needle = q.toLowerCase()
  return [domain.name, readableName(domain.name), domain.description, ...domain.tags].some(
    (value) => value.toLowerCase().includes(needle),
  )
}

/** Tags and their limit: `tooMany` above the limit unless the set shrinks (DomainTagList). */
function checkTags(
  errors: Violations,
  state: ScenarioState,
  tags: string[] | undefined,
  current: string[] = [],
): string[] | undefined {
  if (tags === undefined) return undefined
  const normal = normaliseTags(tags)
  const limit = state.domainCapabilities.taggingLimit
  if (normal.length > limit && !(normal.length < current.length) && !sameTags(normal, current)) {
    addViolation(errors, 'tags', 'tooMany', { max: limit })
  }
  return normal
}

const isTaken = (state: ScenarioState, name: string) =>
  state.domains.some((domain) => domain.name === name) ||
  state.aliasDomains.some((alias) => alias.name === name)

function creationReport(
  state: ScenarioState,
  body: { rateLimit: unknown; dkimSelector: string; restartGroupware: boolean; name: string },
): DomainCreationReport {
  const groupware = state.domainCapabilities.groupwareEnabled
  const existed = state.dkimKeys.includes(body.name)
  const dkimKey: DomainCreationReport['dkimKey'] =
    body.dkimSelector === '' ? 'notRequested' : existed ? 'alreadyExisted' : 'created'
  if (dkimKey === 'created') state.dkimKeys.push(body.name)
  const computed: DomainCreationReport = {
    rateLimit: body.rateLimit ? 'applied' : 'notRequested',
    dkimKey,
    dkimDnsPublication:
      dkimKey !== 'created'
        ? 'skipped'
        : state.domainCapabilities.dkim?.dnsPublicationEnabled
          ? 'published'
          : 'notConfigured',
    groupwareRestart: !groupware
      ? 'groupwareDisabled'
      : body.restartGroupware
        ? 'done'
        : 'notRequested',
  }
  const report: DomainCreationReport = { ...computed, ...state.creationReport }
  const failed = Object.entries(report).filter(([, outcome]) => outcome === 'failed')
  if (failed.length > 0) {
    report.messages = Object.fromEntries(failed.map(([step]) => [step, `The ${step} step failed.`]))
  }
  return report
}

function etagHeaders(etag: string) {
  return { headers: { ETag: etag } }
}

/** The attributes that differ from the stored values, as named in the request body. */
function changedAttributes(domain: MockDomain, body: DomainPatch): string[] {
  const changed: string[] = []
  for (const [key, value] of Object.entries(body)) {
    if (key === 'tags') {
      if (!sameTags((value as string[]) ?? [], domain.tags)) changed.push(key)
    } else if (key === 'description') {
      const next = value === null || value === '' ? domain.name : value
      if (next !== domain.description) changed.push(key)
    } else if (key in domain && (domain as unknown as Record<string, unknown>)[key] !== value) {
      changed.push(key)
    }
  }
  return changed
}

const PATCHABLE = new Set([
  'description',
  'active',
  'maxMailboxes',
  'maxAliases',
  'maxMailboxQuota',
  'domainQuota',
  'backupMx',
  'relayAllRecipients',
  'relayUnknownOnly',
  'globalAddressList',
  'tags',
])

function permittedFor(account: MockAccount): Set<string> {
  if (account.role === 'admin') return PATCHABLE
  const allowed = new Set(['globalAddressList', 'tags'])
  if (account.permissions.domainDesc) allowed.add('description')
  return allowed
}

/** Read-only members sent with a different value (`immutable`). */
function immutableMembers(
  state: ScenarioState,
  account: MockAccount,
  domain: MockDomain,
  body: DomainPatch,
): string[] {
  const current = view(state, account, domain) as unknown as Record<string, unknown>
  const wrong: string[] = []
  for (const [key, value] of Object.entries(body)) {
    if (PATCHABLE.has(key)) continue
    if (key === 'name') {
      if (typeof value !== 'string' || asciiName(value) !== domain.name) wrong.push(key)
    } else if (key === 'usage') {
      continue
    } else if (JSON.stringify(current[key]) !== JSON.stringify(value)) {
      wrong.push(key)
    }
  }
  return wrong
}

function removeDomain(state: ScenarioState, name: string): void {
  state.domains = state.domains.filter((domain) => domain.name !== name)
  state.aliasDomains = state.aliasDomains.filter((alias) => alias.target !== name)
  delete state.footers[name]
  const orphaned = new Set<string>()
  for (const account of state.accounts) {
    if (account.role !== 'domainAdmin' || account.scope.type !== 'domains') continue
    if (!account.scope.domains.includes(name)) continue
    account.scope = { type: 'domains', domains: account.scope.domains.filter((d) => d !== name) }
    if (account.scope.domains.length === 0) orphaned.add(account.username)
  }
  state.accounts = state.accounts.filter((account) => !orphaned.has(account.username))
}

const sample = (addresses: string[]) => ({
  count: addresses.length,
  addresses: addresses.slice(0, 100),
})

const bareVersion = (etag: string) => etag.replaceAll('"', '')

export const domainHandlers = [
  http.get('/domains', ({ request, response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const url = new URL(request.url)
    const params = url.searchParams
    let items = [...scopeOf(state, account)]
    const q = params.get('q')
    if (q) items = items.filter((domain) => matchesSearch(domain, q))
    const active = params.get('active')
    if (active !== null) items = items.filter((domain) => domain.active === (active === 'true'))
    const backupMx = params.get('backupMx')
    if (backupMx !== null)
      items = items.filter((domain) => domain.backupMx === (backupMx === 'true'))
    const tags = params.getAll('tag').map((tag) => tag.toLowerCase())
    if (tags.length > 0) {
      items = items.filter((domain) => domain.tags.some((tag) => tags.includes(tag.toLowerCase())))
    }
    const sort = params.get('sort') ?? 'name'
    const direction = params.get('order') === 'desc' ? -1 : 1
    const value = SORT_VALUE[sort] ?? SORT_VALUE.name!
    items.sort(
      (a, b) => direction * compareValues(value(a), value(b)) || a.name.localeCompare(b.name),
    )
    const result = page(items, url)
    return response(200).json({
      data: result.data.map((domain) => view(state, account, domain)),
      meta: result.meta,
    })
  }),

  http.post('/domains', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    const errors: Violations = {}
    const name = asciiName(body.name)
    if (body.name.trim() === '') addViolation(errors, 'name', 'required')
    else if (!name || !isValidAsciiDomain(name)) {
      addViolation(errors, 'name', 'invalidFormat', { format: 'domainName' })
    } else if (name === state.serverHostname) addViolation(errors, 'name', 'reserved')

    let template = state.domainTemplates.find((item) => isDefaultTemplate(item))
    if (body.templateId !== undefined) {
      template = state.domainTemplates.find((item) => item.id === body.templateId)
      if (!template) addViolation(errors, 'templateId', 'notFound')
    }
    const base = template ?? {
      ...mockDomain({ name: 'x' }),
      dkimSelector: state.domainCapabilities.dkim?.defaultSelector ?? 'dkim',
      dkimKeySize: 2048,
    }
    const values = normaliseRelay({
      active: body.active ?? base.active,
      maxMailboxes: body.maxMailboxes ?? base.maxMailboxes,
      maxAliases: body.maxAliases ?? base.maxAliases,
      maxMailboxQuota: body.maxMailboxQuota ?? base.maxMailboxQuota,
      domainQuota: body.domainQuota ?? base.domainQuota,
      backupMx: body.backupMx ?? base.backupMx,
      relayAllRecipients: body.relayAllRecipients ?? base.relayAllRecipients,
      relayUnknownOnly: body.relayUnknownOnly ?? base.relayUnknownOnly,
      globalAddressList: body.globalAddressList ?? base.globalAddressList,
    })
    checkQuotas(errors, values, body)
    const tags = checkTags(errors, state, body.tags ?? base.tags)
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    if (isTaken(state, name)) return response.untyped(problem(409, 'domain-exists'))
    const failure = domainFailure(state, name, 'createDomain')
    if (failure) return response.untyped(failure)

    const rateLimit = 'rateLimit' in body ? (body.rateLimit ?? null) : base.rateLimit
    const domain = mockDomain({
      name,
      ...values,
      description: body.description ? body.description : name,
      tags: tags ?? [],
      rateLimit,
      createdAt: new Date(state.now()).toISOString(),
      modifiedAt: null,
    })
    state.domains.push(domain)
    const report = creationReport(state, {
      name,
      rateLimit,
      dkimSelector: body.dkimSelector ?? base.dkimSelector,
      restartGroupware: body.restartGroupware ?? false,
    })
    const created = view(state, account, domain)
    return response(201).json(
      { data: { ...created, creationReport: report } },
      { headers: { Location: `/api/v2/domains/${name}`, ETag: created.etag } },
    )
  }),

  http.post('/domains/bulk-actions', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    const limit = state.domainCapabilities.bulkLimit
    if (body.targets.length > limit) {
      const errors: Violations = {}
      addViolation(errors, 'targets', 'tooMany', { max: limit })
      return response.untyped(validationFailed(errors))
    }
    const seen = new Set<string>()
    const results: BulkItemResult[] = []
    for (const target of body.targets) {
      const name = asciiName(target.id) || target.id
      if (seen.has(name)) continue
      seen.add(name)
      const domain = findInScope(state, account, target.id)
      const itemProblem = async (answer: Response) =>
        (await answer.json()) as BulkItemResult['problem']
      if (!domain) {
        results.push({ id: target.id, outcome: 'notFound' })
        continue
      }
      const failure = domainFailure(state, domain.name, 'applyDomainBulkAction')
      if (failure) {
        results.push({ id: target.id, outcome: 'failed', problem: await itemProblem(failure) })
        continue
      }
      if (
        target.version !== undefined &&
        bareVersion(target.version) !== bareVersion(domainEtag(domain))
      ) {
        results.push({ id: target.id, outcome: 'outdated', problem: await itemProblem(outdated()) })
        continue
      }
      if (body.action === 'delete') {
        if (domain.usage.mailboxes + domain.usage.resources > 0) {
          const answer = problem(409, 'domain-not-empty', {
            mailboxes: domain.usage.mailboxes,
            resources: domain.usage.resources,
          })
          results.push({ id: target.id, outcome: 'refused', problem: await itemProblem(answer) })
          continue
        }
        removeDomain(state, domain.name)
        results.push({ id: target.id, outcome: 'done' })
        continue
      }
      const active = body.action === 'activate'
      if (domain.active !== active) {
        domain.active = active
        domain.modifiedAt = new Date(state.now()).toISOString()
      }
      results.push({ id: target.id, outcome: 'done', version: domainEtag(domain) })
    }
    const count = (outcome: BulkItemResult['outcome']) =>
      results.filter((item) => item.outcome === outcome).length
    return response(200).json({
      data: {
        bulkRequestId: Buffer.from(String(state.now()))
          .toString('hex')
          .padEnd(32, '0')
          .slice(0, 32),
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

  http.get('/domains/{domain}', ({ params, response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const domain = findInScope(state, account, params.domain)
    if (!domain) return response.untyped(notFound())
    const data = view(state, account, domain)
    return response(200).json({ data }, etagHeaders(data.etag))
  }),

  http.patch('/domains/{domain}', async ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const domain = findInScope(state, account, params.domain)
    if (!domain) return response.untyped(notFound())
    const ifMatch = request.headers.get('if-match')
    if (ifMatch !== null && ifMatch !== domainEtag(domain)) return response.untyped(outdated())
    const body = await request.json()

    const changed = changedAttributes(domain, body)
    const permitted = permittedFor(account)
    const notPermitted = changed.filter((key) => PATCHABLE.has(key) && !permitted.has(key))
    if (notPermitted.length > 0) {
      return response.untyped(problem(403, 'attribute-not-permitted', { attributes: notPermitted }))
    }
    const errors: Violations = {}
    for (const key of immutableMembers(state, account, domain, body))
      addViolation(errors, key, 'immutable')
    const usage = domain.usage
    const below: [keyof DomainPatch, number][] = [
      ['maxMailboxes', usage.mailboxes],
      ['maxAliases', usage.aliases],
      ['maxMailboxQuota', usage.largestMailboxQuota],
      ['domainQuota', usage.quotaAllocated],
    ]
    for (const [key, inUse] of below) {
      const value = body[key]
      if (changed.includes(key) && typeof value === 'number' && value < inUse) {
        addViolation(errors, key, 'belowInUse', { inUse })
      }
    }
    const next = normaliseRelay({
      ...domain,
      ...Object.fromEntries(
        Object.entries(body).filter(
          ([key]) => PATCHABLE.has(key) && key !== 'tags' && key !== 'description',
        ),
      ),
    })
    checkQuotas(errors, next, body)
    const tags = checkTags(errors, state, body.tags, domain.tags)
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))

    const before = domainEtag(domain)
    Object.assign(domain, {
      active: next.active,
      maxMailboxes: next.maxMailboxes,
      maxAliases: next.maxAliases,
      maxMailboxQuota: next.maxMailboxQuota,
      domainQuota: next.domainQuota,
      backupMx: next.backupMx,
      relayAllRecipients: next.relayAllRecipients,
      relayUnknownOnly: next.relayUnknownOnly,
      globalAddressList: next.globalAddressList,
    })
    if ('description' in body)
      domain.description = body.description ? body.description : domain.name
    if (tags && !sameTags(tags, domain.tags)) domain.tags = tags
    if (domainEtag(domain) !== before) domain.modifiedAt = new Date(state.now()).toISOString()
    const data = view(state, account, domain)
    return response(200).json({ data }, etagHeaders(data.etag))
  }),

  http.delete('/domains/{domain}', ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const domain = findInScope(state, account, params.domain)
    if (!domain) return response.untyped(notFound())
    const ifMatch = request.headers.get('if-match')
    if (ifMatch !== null && ifMatch !== domainEtag(domain)) return response.untyped(outdated())
    if (domain.usage.mailboxes + domain.usage.resources > 0) {
      return response.untyped(
        problem(409, 'domain-not-empty', {
          mailboxes: domain.usage.mailboxes,
          resources: domain.usage.resources,
        }),
      )
    }
    const failure = domainFailure(state, domain.name, 'deleteDomain')
    if (failure) return response.untyped(failure)
    removeDomain(state, domain.name)
    return response(204).empty()
  }),

  http.get('/domains/{domain}/deletion-preview', ({ params, response }) => {
    const state = scenario()
    const account = requireAdmin(state)
    if (account instanceof Response) return response.untyped(account)
    const domain = findInScope(state, account, params.domain)
    if (!domain) return response.untyped(notFound())
    const admins = domainAdminsOf(state, domain.name)
    const toDelete = admins.filter((username) => {
      const admin = state.accounts.find((item) => item.username === username)
      return admin?.scope.type === 'domains' && admin.scope.domains.length === 1
    })
    return response(200).json({
      data: {
        domain: domain.name,
        allowed: domain.usage.mailboxes + domain.usage.resources === 0,
        blockers: {
          mailboxes: sample(mailboxAddresses(domain)),
          resources: sample(resourceAddresses(domain)),
        },
        removals: {
          aliasDomains: aliasDomainsOf(state, domain.name),
          aliases: sample(aliasAddresses(domain)),
          footer: domain.name in state.footers,
        },
        domainAdminsToDelete: toDelete,
        dkimKeyKept: state.dkimKeys.includes(domain.name),
        etag: domainEtag(domain),
      },
    })
  }),

  http.get('/domains/{domain}/footer', ({ params, response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const domain = findInScope(state, account, params.domain)
    if (!domain) return response.untyped(notFound())
    const data = footerView(domain.name, state.footers[domain.name])
    return response(200).json({ data }, etagHeaders(data.etag))
  }),

  http.put('/domains/{domain}/footer', async ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const domain = findInScope(state, account, params.domain)
    if (!domain) return response.untyped(notFound())
    const current = footerView(domain.name, state.footers[domain.name])
    const ifMatch = request.headers.get('if-match')
    if (ifMatch !== null && ifMatch !== current.etag) return response.untyped(outdated())
    const body = await request.json()
    const errors: Violations = {}
    const max = state.domainCapabilities.footerTextMaxBytes
    for (const key of ['html', 'plain'] as const) {
      if (utf8Bytes(body[key]) > max) addViolation(errors, key, 'tooLong', { max, unit: 'bytes' })
    }
    const aliasDomains = aliasDomainsOf(state, domain.name)
    const known = new Set(
      [...mailboxAddresses(domain), ...aliasAddresses(domain)].map((a) => a.toLowerCase()),
    )
    const addresses = (body.excludedAddresses ?? []).map((entry) => entry.trim().toLowerCase())
    addresses.forEach((address, index) => {
      const [local, host] = address.split('@')
      const own =
        host === domain.name
          ? address
          : aliasDomains.includes(host ?? '')
            ? `${local}@${domain.name}`
            : null
      if (!own || !known.has(own)) addViolation(errors, `excludedAddresses.${index}`, 'notFound')
    })
    const excludedDomains = (body.excludedAliasDomains ?? []).map(
      (entry) => asciiName(entry) || entry.trim().toLowerCase(),
    )
    excludedDomains.forEach((name, index) => {
      if (!aliasDomains.includes(name))
        addViolation(errors, `excludedAliasDomains.${index}`, 'notFound')
    })
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    state.footers[domain.name] = {
      html: body.html,
      plain: body.plain,
      skipReplies: body.skipReplies,
      excludedAddresses: [...new Set(addresses)],
      excludedAliasDomains: [...new Set(excludedDomains)],
    }
    const data = footerView(domain.name, state.footers[domain.name])
    return response(200).json({ data }, etagHeaders(data.etag))
  }),

  http.get('/capabilities/domains', ({ response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    // `dkim` and `templateDefaults` are returned to administrators only.
    const { dkim, templateDefaults, ...rest } = state.domainCapabilities
    if (account.role !== 'admin') return response(200).json({ data: rest })
    return response(200).json({
      data: {
        ...rest,
        ...(dkim ? { dkim: { ...dkim } } : {}),
        ...(templateDefaults
          ? {
              templateDefaults: {
                ...templateDefaults,
                tags: [],
                dkimSelector: dkim?.defaultSelector ?? templateDefaults.dkimSelector,
              },
            }
          : {}),
      },
    })
  }),

  http.get('/domain-tags', ({ request, response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const url = new URL(request.url)
    const byKey = new Map<string, DomainTagSummary>()
    for (const domain of scopeOf(state, account)) {
      for (const tag of domain.tags) {
        const key = tag.toLowerCase()
        const entry = byKey.get(key)
        if (!entry) byKey.set(key, { name: tag, domainCount: 1 })
        else {
          entry.domainCount += 1
          if (tag < entry.name) entry.name = tag
        }
      }
    }
    let items = [...byKey.values()]
    const q = url.searchParams.get('q')?.toLowerCase()
    if (q) items = items.filter((item) => item.name.toLowerCase().includes(q))
    const direction = url.searchParams.get('order') === 'desc' ? -1 : 1
    const byCount = url.searchParams.get('sort') === 'domainCount'
    items.sort(
      (a, b) =>
        direction * (byCount ? a.domainCount - b.domainCount : compareValues(a.name, b.name)) ||
        compareValues(a.name, b.name),
    )
    return response(200).json(page(items, url))
  }),
]

export { MIB }
