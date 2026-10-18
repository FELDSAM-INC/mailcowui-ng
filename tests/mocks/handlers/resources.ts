// Resource handlers (UI 004 T017, research R21): the documented behaviour of API 004's resources.
// The address is derived from the description (letters and digits, letter case kept; none or more
// than 64 refused), the domain is a domain of the scope (alias domains refused), the booking rule
// and limit are checked together, a derived address in use is `409 address-in-use`, and changes,
// deletions and bulk actions carry version checks.
import type { BulkItemResult } from '@/api'

import { domainPart, normaliseAddress, readableAddress } from '../factories/alias'
import { derivedLocalPart, mockResource, multipleBookings } from '../factories/resource'
import type { MockResource, ScenarioState } from '../scenarios/state'
import { csrfProblem, http, scenario } from './context'
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
  bareVersion,
  bulkResult,
  domainInScope,
  domainKey,
  findAliasDomain,
  findResourceFor,
  holderOf,
  ifMatchFails,
  immutableMembers,
  now,
  problemOf,
  removeResource,
  resourceInScope,
  resourceView,
  tooManyTargets,
} from './feature-004-rules'

const SORT_VALUE: Record<string, (resource: MockResource) => unknown> = {
  address: (r) => r.address,
  description: (r) => r.description,
  kind: (r) => r.kind,
  domain: (r) => domainPart(r.address),
  bookingRule: (r) => multipleBookings(r),
  active: (r) => r.active,
  createdAt: (r) => r.createdAt,
  modifiedAt: (r) => r.modifiedAt,
}

/** The trimmed description, `required` and `tooLong` (the capability's limit). */
function checkDescription(state: ScenarioState, raw: string, errors: Violations): string | null {
  const description = raw.trim()
  if (description === '') {
    addViolation(errors, 'description', 'required')
    return null
  }
  const max = state.capabilities004.resourceDescriptionMaxLength
  if ([...description].length > max) {
    addViolation(errors, 'description', 'tooLong', { max })
    return null
  }
  return description
}

/** The booking limit of a rule (API `ResourceRules::bookings`), with its violations. */
function checkBookings(
  state: ScenarioState,
  rule: MockResource['bookingRule'],
  limit: number | null | undefined,
  limitSent: boolean,
  current: number | null,
  errors: Violations,
): number | null {
  if (rule !== 'limited') {
    if (limitSent && limit !== null && limit !== undefined) {
      addViolation(errors, 'bookingLimit', 'conflictsWith', { field: 'bookingRule' })
    }
    return null
  }
  const value = limitSent ? limit : current
  if (typeof value !== 'number') {
    addViolation(errors, 'bookingLimit', 'required')
    return null
  }
  const { min, max } = state.capabilities004.resourceBookingLimit
  if (value < min || value > max) addViolation(errors, 'bookingLimit', 'outOfRange', { min, max })
  return value
}

const etagHeaders = (etag: string) => ({ headers: { ETag: etag } })

const READ_ONLY = [
  'address',
  'addressUnicode',
  'domain',
  'domainUnicode',
  'createdAt',
  'modifiedAt',
]

export const resourceHandlers = [
  http.get('/resources', ({ request, response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const url = new URL(request.url)
    const params = url.searchParams
    let items = state.resources.filter((resource) => resourceInScope(state, account, resource))
    const q = params.get('q')?.trim().toLowerCase()
    if (q) {
      items = items.filter((resource) =>
        [resource.description, resource.address, readableAddress(resource.address)].some((value) =>
          value.toLowerCase().includes(q),
        ),
      )
    }
    const domains = params.getAll('domain').map(domainKey)
    if (domains.length > 0)
      items = items.filter((resource) => domains.includes(domainPart(resource.address)))
    const kinds = params.getAll('kind')
    if (kinds.length > 0) items = items.filter((resource) => kinds.includes(resource.kind))
    const active = params.get('active')
    if (active !== null) items = items.filter((resource) => resource.active === (active === 'true'))
    const sort = params.get('sort') ?? 'address'
    const direction = params.get('order') === 'desc' ? -1 : 1
    const value = SORT_VALUE[sort] ?? SORT_VALUE.address!
    items.sort(
      (a, b) =>
        direction * (compareValues(value(a), value(b)) || compareValues(a.address, b.address)),
    )
    const result = page(items, url)
    return response(200).json({ data: result.data.map(resourceView), meta: result.meta })
  }),

  http.post('/resources', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const body = await request.json()
    const errors: Violations = {}
    const description = checkDescription(state, body.description, errors)
    const local = description === null ? '' : derivedLocalPart(description)
    if (description !== null && (local === '' || local.length > 64)) {
      addViolation(errors, 'description', 'invalidFormat', { format: 'resourceDescription' })
    }
    const name = domainKey(body.domain)
    const domain = domainInScope(state, account, body.domain)
    if (!domain) {
      const aliasDomain = name ? findAliasDomain(state, name) : undefined
      if (aliasDomain && domainInScope(state, account, aliasDomain.target)) {
        addViolation(errors, 'domain', 'notEligible', { kind: 'aliasDomain' })
      } else addViolation(errors, 'domain', 'notFound', { resource: 'domain' })
    }
    const rule = body.bookingRule ?? 'unlimited'
    const limit = checkBookings(
      state,
      rule,
      body.bookingLimit,
      'bookingLimit' in body,
      null,
      errors,
    )
    if (Object.keys(errors).length > 0 || !domain || description === null) {
      return response.untyped(validationFailed(errors))
    }
    const address = normaliseAddress(`${local}@${domain.name}`)
    const holder = holderOf(state, address)
    if (holder) return response.untyped(addressInUse(address, holder))
    const resource = mockResource({
      address,
      description,
      kind: body.kind,
      bookingRule: rule,
      bookingLimit: limit,
      active: body.active ?? true,
      createdAt: now(state),
      modifiedAt: null,
    })
    state.resources.push(resource)
    domain.usage = { ...domain.usage, resources: domain.usage.resources + 1 }
    const data = resourceView(resource)
    return response(201).json(
      { data },
      { headers: { Location: `/api/v2/resources/${address}`, ETag: data.etag } },
    )
  }),

  http.post('/resources/bulk-actions', async ({ request, response }) => {
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
      const key = normaliseAddress(target.id).toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const resource = findResourceFor(state, account, target.id)
      if (!resource) {
        results.push({ id: target.id, outcome: 'notFound' })
        continue
      }
      const etag = resourceView(resource).etag
      if (target.version !== undefined && bareVersion(target.version) !== bareVersion(etag)) {
        results.push({ id: target.id, outcome: 'outdated', problem: await problemOf(outdated()) })
        continue
      }
      if (body.action === 'delete') {
        removeResource(state, resource)
        results.push({ id: target.id, outcome: 'done' })
        continue
      }
      const active = body.action === 'activate'
      if (resource.active !== active) {
        resource.active = active
        resource.modifiedAt = now(state)
      }
      results.push({ id: target.id, outcome: 'done', version: resourceView(resource).etag })
    }
    return response(200).json({ data: bulkResult(state, results) })
  }),

  http.get('/resources/{resourceAddress}', ({ params, response }) => {
    const state = scenario()
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const resource = findResourceFor(state, account, params.resourceAddress)
    if (!resource) return response.untyped(notFound())
    const data = resourceView(resource)
    return response(200).json({ data }, etagHeaders(data.etag))
  }),

  http.patch('/resources/{resourceAddress}', async ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const resource = findResourceFor(state, account, params.resourceAddress)
    if (!resource) return response.untyped(notFound())
    const current = resourceView(resource)
    if (ifMatchFails(request.headers.get('if-match'), current.etag)) {
      return response.untyped(outdated())
    }
    const body = await request.json()
    const errors: Violations = {}
    const description =
      body.description === undefined
        ? resource.description
        : checkDescription(state, body.description, errors)
    const rule = body.bookingRule ?? resource.bookingRule
    const limit = checkBookings(
      state,
      rule,
      body.bookingLimit,
      'bookingLimit' in body,
      resource.bookingRule === 'limited' ? resource.bookingLimit : null,
      errors,
    )
    immutableMembers(body, READ_ONLY, current, errors)
    if (Object.keys(errors).length > 0 || description === null) {
      return response.untyped(validationFailed(errors))
    }
    resource.description = description
    if (body.kind) resource.kind = body.kind
    resource.bookingRule = rule
    resource.bookingLimit = limit
    if (typeof body.active === 'boolean') resource.active = body.active
    const data = resourceView(resource)
    if (data.etag !== current.etag) {
      resource.modifiedAt = now(state)
      data.modifiedAt = resource.modifiedAt
    }
    return response(200).json({ data }, etagHeaders(data.etag))
  }),

  http.delete('/resources/{resourceAddress}', ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireManager(state)
    if (account instanceof Response) return response.untyped(account)
    const resource = findResourceFor(state, account, params.resourceAddress)
    if (!resource) return response.untyped(notFound())
    if (ifMatchFails(request.headers.get('if-match'), resourceView(resource).etag)) {
      return response.untyped(outdated())
    }
    removeResource(state, resource)
    return response(204).empty()
  }),
]
