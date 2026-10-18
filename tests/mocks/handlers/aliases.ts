// Alias handlers (UI 004 T017, research R21): the documented behaviour of API 004's aliases on the
// scenario state. Scope (domain administrators: their domains and those domains' alias domains;
// orphaned aliases for administrators only), search, filters, sort and paging, the order of checks
// of `createAlias` (422, then 403 for external destinations, then 409), If-Match and 412, only added
// destinations checked, comments checked when they change, orphaned aliases, `immutable`, deletion,
// copies over alias domains, per-target bulk outcomes with `meta.copies`, and the capabilities.
import type { AliasCopyOutcome, BulkItemResult } from '@/api'

import {
  domainPart,
  mockAlias,
  normaliseAddress,
  readableAddress,
  splitAddress,
} from '../factories/alias'
import { readableName } from '../factories/domain'
import type { MockAccount, MockAlias, ScenarioState } from '../scenarios/state'
import { csrfProblem, http, problem, scenario } from './context'
import {
  addViolation,
  compareValues,
  notFound,
  outdated,
  page,
  requireManager,
  validationFailed,
  type Violations,
} from './domain-rules'
import {
  addressInUse,
  adjustAliasUsage,
  aliasInScope,
  aliasView,
  bareVersion,
  bulkResult,
  checkAliasAddress,
  checkComment,
  checkDestinations,
  domainKey,
  dropRedundantPermissions,
  externalRefusal,
  findAliasDomain,
  findAliasFor,
  findDomain,
  holderOf,
  ifMatchFails,
  limitProblem,
  materialiseDomainAliases,
  now,
  parseDestination,
  primaryDomainOf,
  problemOf,
  removeAlias,
  tooManyTargets,
  type ParsedDestination,
} from './feature-004-rules'

const SORT_VALUE: Record<string, (alias: MockAlias) => unknown> = {
  id: (a) => a.id,
  address: (a) => a.address,
  domain: (a) => domainPart(a.address),
  active: (a) => a.active,
  groupwareVisible: (a) => a.groupwareVisible,
  internal: (a) => a.internal,
  senderAllowed: (a) => a.senderAllowed,
  createdAt: (a) => a.createdAt,
  modifiedAt: (a) => a.modifiedAt,
}

function matchesSearch(alias: MockAlias, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return [
    alias.address,
    readableAddress(alias.address),
    ...alias.destinations,
    alias.publicComment,
    alias.privateComment,
  ].some((value) => value.toLowerCase().includes(needle))
}

const destinationOf = (alias: MockAlias): ParsedDestination => ({
  type: alias.destinationType,
  addresses: [...alias.destinations],
})

function etagHeaders(etag: string) {
  return { headers: { ETag: etag } }
}

function nextAliasId(state: ScenarioState): number {
  const id = Math.max(state.lastAliasId, ...state.aliases.map((alias) => alias.id)) + 1
  state.lastAliasId = id
  return id
}

interface CreateInput {
  address: string
  destinationType?: string
  destinations?: string[]
  active?: boolean
  senderAllowed?: boolean
  groupwareVisible?: boolean
  internal?: boolean
  publicComment?: string
  privateComment?: string
}

/**
 * One creation, as `createAlias` checks it: the response to refuse it with, or the created alias.
 * Copies use it too (API research R17).
 */
function create(
  state: ScenarioState,
  account: MockAccount,
  body: CreateInput,
): { refused: Response } | { alias: MockAlias } {
  const errors: Violations = {}
  const address = checkAliasAddress(state, account, body.address, errors)
  const { destination, indexes } = parseDestination(
    body.destinationType === undefined && body.destinations === undefined
      ? { destinationType: 'addresses' }
      : body,
    null,
    errors,
  )
  if (address && destination) checkDestinations(state, destination, address, indexes, null, errors)
  for (const field of ['publicComment', 'privateComment'] as const) {
    const value = body[field]
    if (typeof value === 'string') checkComment(state, field, value, errors)
  }
  if (Object.keys(errors).length > 0 || !address || !destination) {
    return { refused: validationFailed(errors) }
  }
  const external = externalRefusal(state, account, destination, indexes, null)
  if (external) return { refused: external }
  const holder = holderOf(state, address)
  if (holder) return { refused: addressInUse(address, holder) }
  const primary = primaryDomainOf(state, domainPart(address))
  const limit = limitProblem(state, primary, 1)
  if (limit) return { refused: limit }

  const alias = mockAlias({
    id: nextAliasId(state),
    address,
    destinationType: destination.type,
    destinations: destination.addresses,
    active: body.active ?? true,
    senderAllowed: body.senderAllowed ?? true,
    groupwareVisible: body.groupwareVisible ?? true,
    internal: body.internal ?? false,
    publicComment: body.publicComment ?? '',
    privateComment: body.privateComment ?? '',
    createdAt: now(state),
    modifiedAt: null,
  })
  state.aliases.push(alias)
  adjustAliasUsage(state, primary, 1)
  dropRedundantPermissions(state, alias)
  return { alias }
}

/** The copies of an alias over its domain's alias domains, in name order (API research R17). */
async function copy(
  state: ScenarioState,
  account: MockAccount,
  alias: MockAlias,
): Promise<AliasCopyOutcome[]> {
  const parts = splitAddress(alias.address)!
  const names = state.aliasDomains
    .filter((item) => item.target === parts.domain)
    .map((item) => item.name)
    .sort()
  const copies: AliasCopyOutcome[] = []
  for (const name of names) {
    const address = `${parts.local}@${name}`
    const base = {
      aliasDomain: name,
      aliasDomainUnicode: readableName(name),
      address,
      addressUnicode: readableAddress(address),
    }
    if (holderOf(state, address)) {
      copies.push({ ...base, outcome: 'skipped', aliasId: null, reason: 'addressInUse' })
      continue
    }
    const result = create(state, account, {
      address,
      destinationType: alias.destinationType,
      ...(alias.destinationType === 'addresses' ? { destinations: alias.destinations } : {}),
      active: alias.active,
      senderAllowed: alias.senderAllowed,
      groupwareVisible: alias.groupwareVisible,
      internal: alias.internal,
    })
    if ('alias' in result) {
      copies.push({ ...base, outcome: 'created', aliasId: result.alias.id, reason: null })
      continue
    }
    const body = (await result.refused.clone().json()) as {
      type: string
      errors?: Record<string, { params?: { kind?: string } }[]>
    }
    const refusal = String(body.type).split('/').at(-1)
    const externalOnly =
      body.errors &&
      Object.values(body.errors).every((list) =>
        list.every((item) => item.params?.kind === 'externalDestination'),
      )
    const reason =
      refusal === 'address-in-use'
        ? 'addressInUse'
        : refusal === 'domain-alias-limit-reached'
          ? 'aliasLimitReached'
          : refusal === 'attribute-not-permitted' || externalOnly
            ? 'destinationNotPermitted'
            : null
    if (reason) copies.push({ ...base, outcome: 'skipped', aliasId: null, reason })
    else {
      copies.push({
        ...base,
        outcome: 'failed',
        aliasId: null,
        reason: null,
        problem: await problemOf(result.refused),
      })
    }
  }
  return copies
}

const READ_ONLY = [
  'id',
  'addressUnicode',
  'kind',
  'domain',
  'domainUnicode',
  'inAliasDomain',
  'primaryDomain',
  'primaryDomainUnicode',
  'createdAt',
  'modifiedAt',
  'orphaned',
] as const

export const aliasHandlers = [
  http.get('/aliases', ({ request, response }) => {
    const state = scenario()
    materialiseDomainAliases(state)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const url = new URL(request.url)
    const params = url.searchParams
    let items = state.aliases.filter((alias) => aliasInScope(state, account, alias))
    const q = params.get('q')
    if (q) items = items.filter((alias) => matchesSearch(alias, q))
    const addressFilter = params
      .getAll('address')
      .map((value) => normaliseAddress(value).toLowerCase())
    if (addressFilter.length > 0) {
      items = items.filter((alias) => addressFilter.includes(alias.address.toLowerCase()))
    }
    const domainFilter = params.getAll('domain').map(domainKey)
    if (domainFilter.length > 0) {
      items = items.filter((alias) => domainFilter.includes(domainPart(alias.address)))
    }
    const primaryFilter = params.getAll('primaryDomain').map(domainKey)
    if (primaryFilter.length > 0) {
      items = items.filter((alias) =>
        primaryFilter.includes(primaryDomainOf(state, domainPart(alias.address))),
      )
    }
    const kinds = params.getAll('kind')
    if (kinds.length > 0) {
      items = items.filter((alias) =>
        kinds.includes(alias.address.startsWith('@') ? 'catchAll' : 'regular'),
      )
    }
    const types = params.getAll('destinationType')
    if (types.length > 0) items = items.filter((alias) => types.includes(alias.destinationType))
    const destinations = params
      .getAll('destination')
      .map((value) => normaliseAddress(value).toLowerCase())
    if (destinations.length > 0) {
      items = items.filter((alias) =>
        alias.destinations.some((item) => destinations.includes(item.toLowerCase())),
      )
    }
    for (const flag of ['active', 'senderAllowed', 'groupwareVisible', 'internal'] as const) {
      const value = params.get(flag)
      if (value !== null) items = items.filter((alias) => alias[flag] === (value === 'true'))
    }
    const sort = params.get('sort') ?? 'id'
    const order = params.get('order') ?? (sort === 'id' ? 'desc' : 'asc')
    const direction = order === 'desc' ? -1 : 1
    const value = SORT_VALUE[sort] ?? SORT_VALUE.id!
    items.sort((a, b) => direction * (compareValues(value(a), value(b)) || a.id - b.id))
    const result = page(items, url)
    return response(200).json({
      data: result.data.map((alias) => aliasView(state, alias)),
      meta: result.meta,
    })
  }),

  http.post('/aliases', async ({ request, response }) => {
    const state = scenario()
    materialiseDomainAliases(state)
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const result = create(state, account, await request.json())
    if ('refused' in result) return response.untyped(result.refused)
    const data = aliasView(state, result.alias)
    return response(201).json(
      { data },
      { headers: { Location: `/api/v2/aliases/${data.id}`, ETag: data.etag } },
    )
  }),

  http.post('/aliases/bulk-actions', async ({ request, response }) => {
    const state = scenario()
    materialiseDomainAliases(state)
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    const errors: Violations = {}
    if (tooManyTargets(state, body.targets.length, errors)) {
      return response.untyped(validationFailed(errors))
    }
    const seen = new Set<number>()
    const results: BulkItemResult[] = []
    const copies: Record<string, AliasCopyOutcome[]> = {}
    for (const target of body.targets) {
      const id = Number(target.id)
      if (Number.isInteger(id) && seen.has(id)) continue
      seen.add(id)
      const alias = Number.isInteger(id) ? findAliasFor(state, account, id) : undefined
      if (!alias) {
        results.push({ id: target.id, outcome: 'notFound' })
        continue
      }
      const etag = aliasView(state, alias).etag
      if (target.version !== undefined && bareVersion(target.version) !== bareVersion(etag)) {
        results.push({ id: target.id, outcome: 'outdated', problem: await problemOf(outdated()) })
        continue
      }
      if (body.action === 'delete') {
        removeAlias(state, alias)
        results.push({ id: target.id, outcome: 'done' })
        continue
      }
      if (body.action === 'copyOverAliasDomains') {
        if (findAliasDomain(state, domainPart(alias.address))) {
          const answer = problem(409, 'not-primary-domain-alias')
          results.push({ id: target.id, outcome: 'refused', problem: await problemOf(answer) })
          continue
        }
        copies[target.id] = await copy(state, account, alias)
        results.push({ id: target.id, outcome: 'done', version: aliasView(state, alias).etag })
        continue
      }
      const before = etag
      if (body.action === 'activate' || body.action === 'deactivate') {
        alias.active = body.action === 'activate'
      } else {
        alias.groupwareVisible = body.action === 'showInGroupware'
      }
      const after = aliasView(state, alias).etag
      if (after !== before) alias.modifiedAt = now(state)
      results.push({ id: target.id, outcome: 'done', version: after })
    }
    return response(200).json({
      data: bulkResult(state, results),
      ...(body.action === 'copyOverAliasDomains' ? { meta: { copies } } : {}),
    })
  }),

  http.get('/aliases/{aliasId}', ({ params, response }) => {
    const state = scenario()
    materialiseDomainAliases(state)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const alias = findAliasFor(state, account, params.aliasId)
    if (!alias) return response.untyped(notFound())
    const data = aliasView(state, alias)
    return response(200).json({ data }, etagHeaders(data.etag))
  }),

  http.patch('/aliases/{aliasId}', async ({ params, request, response }) => {
    const state = scenario()
    materialiseDomainAliases(state)
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const alias = findAliasFor(state, account, params.aliasId)
    if (!alias) return response.untyped(notFound())
    const current = aliasView(state, alias)
    if (ifMatchFails(request.headers.get('if-match'), current.etag)) {
      return response.untyped(outdated())
    }
    const body = await request.json()
    const errors: Violations = {}

    let address: string | null = alias.address
    let addressChanged = false
    if (body.address !== undefined) {
      address = checkAliasAddress(state, account, body.address, errors)
      addressChanged = address !== null && address !== alias.address
    } else if (current.orphaned) {
      addViolation(errors, 'address', 'notFound', { resource: 'domain' })
    }
    const stored = destinationOf(alias)
    const { destination: sent, indexes } = parseDestination(body, stored, errors)
    const destination = sent ?? stored
    const replaced = sent !== null && (body.destinations !== undefined || sent.type !== stored.type)
    if (address && replaced) {
      checkDestinations(state, destination, address, indexes, stored, errors)
    } else if (
      address &&
      addressChanged &&
      destination.addresses.some((item) => item.toLowerCase() === address.toLowerCase())
    ) {
      addViolation(errors, 'address', 'conflictsWith', { field: 'destinations', value: address })
    }
    for (const field of ['publicComment', 'privateComment'] as const) {
      const value = body[field]
      if (typeof value === 'string' && value !== alias[field])
        checkComment(state, field, value, errors)
    }
    if (address) {
      const resulting = aliasView(state, { ...alias, address })
      for (const member of READ_ONLY) {
        if (!(member in body)) continue
        const fixed = member === 'id' || member === 'createdAt' || member === 'modifiedAt'
        const expected = fixed ? current[member] : resulting[member]
        const sentValue = (body as Record<string, unknown>)[member]
        if (JSON.stringify(sentValue) !== JSON.stringify(expected)) {
          addViolation(errors, member, 'immutable')
        }
      }
    }
    if (Object.keys(errors).length > 0 || !address) {
      return response.untyped(validationFailed(errors))
    }
    if (replaced) {
      const external = externalRefusal(state, account, destination, indexes, stored)
      if (external) return response.untyped(external)
    }
    const oldPrimary = primaryDomainOf(state, domainPart(alias.address))
    const newPrimary = primaryDomainOf(state, domainPart(address))
    if (addressChanged) {
      const holder = holderOf(state, address, { aliasId: alias.id })
      if (holder) return response.untyped(addressInUse(address, holder))
      if (oldPrimary !== newPrimary) {
        const limit = limitProblem(state, newPrimary, 1)
        if (limit) return response.untyped(limit)
      }
    }

    const before = current.etag
    const oldAddress = alias.address
    alias.address = address
    alias.destinationType = destination.type
    alias.destinations = destination.type === 'addresses' ? [...destination.addresses] : []
    for (const flag of ['active', 'senderAllowed', 'groupwareVisible', 'internal'] as const) {
      if (typeof body[flag] === 'boolean') alias[flag] = body[flag]
    }
    if (typeof body.publicComment === 'string') alias.publicComment = body.publicComment
    if (typeof body.privateComment === 'string') alias.privateComment = body.privateComment
    if (addressChanged) {
      const oldKey = oldAddress.toLowerCase()
      for (const row of state.senderAcl) {
        if (!row.external && row.sendAs.toLowerCase() === oldKey) row.sendAs = address
      }
      if (oldPrimary !== newPrimary) {
        if (findDomain(state, oldPrimary)) adjustAliasUsage(state, oldPrimary, -1)
        adjustAliasUsage(state, newPrimary, 1)
      }
    }
    dropRedundantPermissions(state, alias)
    const data = aliasView(state, alias)
    if (data.etag !== before) {
      alias.modifiedAt = now(state)
      data.modifiedAt = alias.modifiedAt
    }
    return response(200).json({ data }, etagHeaders(data.etag))
  }),

  http.delete('/aliases/{aliasId}', ({ params, request, response }) => {
    const state = scenario()
    materialiseDomainAliases(state)
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const alias = findAliasFor(state, account, params.aliasId)
    if (!alias) return response.untyped(notFound())
    if (ifMatchFails(request.headers.get('if-match'), aliasView(state, alias).etag)) {
      return response.untyped(outdated())
    }
    removeAlias(state, alias)
    return response(204).empty()
  }),

  http.post('/aliases/{aliasId}/alias-domain-copies', async ({ params, request, response }) => {
    const state = scenario()
    materialiseDomainAliases(state)
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const alias = findAliasFor(state, account, params.aliasId)
    if (!alias) return response.untyped(notFound())
    if (ifMatchFails(request.headers.get('if-match'), aliasView(state, alias).etag)) {
      return response.untyped(outdated())
    }
    if (findAliasDomain(state, domainPart(alias.address))) {
      return response.untyped(problem(409, 'not-primary-domain-alias'))
    }
    const copies = await copy(state, account, alias)
    return response(200).json({ data: { aliasId: alias.id, address: alias.address, copies } })
  }),

  http.get('/capabilities/aliases', ({ response }) => {
    const state = scenario()
    materialiseDomainAliases(state)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const capabilities = structuredClone(state.capabilities004)
    if (account.role !== 'admin') {
      capabilities.dkimDnsPublicationEnabled = null
      if (!account.permissions.aliasDomains) capabilities.dkimDefaults = null
    }
    return response(200).json({ data: capabilities })
  }),
]
