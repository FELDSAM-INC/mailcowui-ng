import { HttpResponse } from 'msw'
import {
  domainAdminPermissionNameValues,
  type AccountBulkActionRequest,
  type AdminCreateRequest,
  type AdminPatch,
  type DomainAdminCreateRequest,
  type DomainAdminPatch,
  type BulkItemResult,
  type BulkResult,
  type Writable,
} from '@/api'
import { accountEtag, adminView, mockAdmin, type MockAdmin } from '../factories/admin'
import {
  assignment,
  domainAdminView,
  mockDomainAdmin,
  permissionDefaults,
  type MockDomainAdmin,
} from '../factories/domain-admin'
import { asciiName } from '../factories/domain'
import { requestId } from '../factories/ids'
import { passwordViolations } from '../factories/password-policy'
import { syncManagedAccount } from '../scenarios/administrators'
import { endSession, type ScenarioState } from '../scenarios/state'
import { csrfProblem, problem, scenario } from './context'
import {
  addViolation,
  compareValues,
  isValidAsciiDomain,
  notFound,
  outdated,
  page,
  requireAdmin,
  validationFailed,
  type Violations,
} from './domain-rules'

type Role = 'admin' | 'domainAdmin'
type Managed = MockAdmin | MockDomainAdmin
type Create = Writable<AdminCreateRequest> | Writable<DomainAdminCreateRequest>
type Patch = Writable<AdminPatch> | Writable<DomainAdminPatch>
const collection = (state: ScenarioState, role: Role): Managed[] =>
  role === 'admin' ? state.admins : state.domainAdmins
const find = (state: ScenarioState, role: Role, username: string) =>
  collection(state, role).find((item) => item.username.toLowerCase() === username.toLowerCase())
const view = (item: Managed) => ('domains' in item ? domainAdminView(item) : adminView(item))
const bare = (value: string) => value.replace(/^W\//, '').replace(/^"|"$/g, '')
function access(state: ScenarioState, request: Request): Response | null {
  if (request.method !== 'GET') {
    const refused = csrfProblem(state, request)
    if (refused) return refused
  }
  const actor = requireAdmin(state)
  return actor instanceof Response ? actor : null
}
function checkName(errors: Violations, username: string, max: number): string {
  const value = username.trim().toLowerCase()
  if (!value) addViolation(errors, 'username', 'required')
  else if (value.length > max) addViolation(errors, 'username', 'tooLong', { max })
  else if (value === 'api') addViolation(errors, 'username', 'reserved')
  else if (!/^[a-z0-9._-]+$/.test(value) || !/[a-z0-9]/.test(value))
    addViolation(errors, 'username', 'invalidFormat', { format: 'accountUsername' })
  return value
}
function checkPassword(state: ScenarioState, errors: Violations, password: string): void {
  if (
    /^\{(?:BLF-CRYPT|SSHA512|SSHA256|SHA512-CRYPT|SHA256-CRYPT|MD5-CRYPT|ARGON2ID)\}/.test(password)
  )
    return
  for (const violation of passwordViolations(state.passwordPolicy, password))
    addViolation(errors, 'password', violation.code, violation.params)
}
function domainsOf(
  state: ScenarioState,
  raw: NonNullable<Writable<DomainAdminPatch>['domains']>,
  errors: Violations,
): string[] {
  if (!raw.length) addViolation(errors, 'domains', 'required')
  const names = raw.map((item, index) => {
    const name = asciiName(typeof item === 'string' ? item : item.domain)
    if (!isValidAsciiDomain(name))
      addViolation(errors, `domains.${index}`, 'invalidFormat', { format: 'domainName' })
    else if (state.aliasDomains.some((domain) => domain.name === name))
      addViolation(errors, `domains.${index}`, 'notEligible', { kind: 'aliasDomain' })
    else if (!state.domains.some((domain) => domain.name === name))
      addViolation(errors, `domains.${index}`, 'notFound')
    return name
  })
  return [...new Set(names)].sort()
}
const taken = (state: ScenarioState, username: string, except?: Managed) =>
  [...state.admins, ...state.domainAdmins].some(
    (item) => item !== except && item.username.toLowerCase() === username,
  )
const changedResponse = (item: Managed, status = 200, path?: string): Response =>
  HttpResponse.json(
    { data: view(item) },
    { status, headers: { ETag: accountEtag(item), ...(path ? { Location: path } : {}) } },
  )

export function listManaged(role: Role, request: Request): Response {
  const state = scenario()
  const refused = access(state, request)
  if (refused) return refused
  const url = new URL(request.url),
    params = url.searchParams
  let items = [...collection(state, role)]
  const q = params.get('q')?.toLowerCase()
  if (q)
    items = items.filter(
      (item) =>
        item.username.toLowerCase().includes(q) ||
        ('domains' in item &&
          item.domains.some(
            (d) => d.domain.toLowerCase().includes(q) || d.domainUnicode.toLowerCase().includes(q),
          )),
    )
  for (const key of ['active', 'forcePasswordChange', 'forceSecondFactorSetup'] as const)
    if (params.has(key)) items = items.filter((item) => item[key] === (params.get(key) === 'true'))
  if (params.has('secondFactorStatus'))
    items = items.filter((item) => item.secondFactorStatus === params.get('secondFactorStatus'))
  const domains = params.getAll('domain').map((domain) => domain.toLowerCase())
  if (domains.length)
    items = items.filter(
      (item) =>
        'domains' in item && item.domains.some((d) => domains.includes(d.domain.toLowerCase())),
    )
  const permission = domainAdminPermissionNameValues.find(
    (name) => name === params.get('permission'),
  )
  if (permission)
    items = items.filter(
      (item) =>
        'domains' in item &&
        (item.permissions?.[permission] ?? false) === (params.get('permissionValue') !== 'false'),
    )
  const sort = params.get('sort') ?? 'username',
    direction = params.get('order') === 'desc' ? -1 : 1
  const sortValue = (item: Managed): unknown =>
    sort === 'domainCount'
      ? 'domains' in item
        ? item.domains.length
        : 0
      : item[sort as keyof MockAdmin]
  items.sort(
    (a, b) =>
      direction * compareValues(sortValue(a), sortValue(b)) || a.username.localeCompare(b.username),
  )
  const result = page(items, url)
  return HttpResponse.json({ data: result.data.map(view), meta: result.meta })
}
export function readManaged(role: Role, username: string, request: Request): Response {
  const state = scenario()
  const refused = access(state, request)
  if (refused) return refused
  const item = find(state, role, username)
  return item ? changedResponse(item) : notFound()
}
export async function createManaged(role: Role, request: Request): Promise<Response> {
  const state = scenario()
  const refused = access(state, request)
  if (refused) return refused
  const body = (await request.json()) as Create
  const errors: Violations = {}
  const username = checkName(errors, body.username, state.accountDefaults.usernameMaxLength)
  checkPassword(state, errors, body.password)
  const domains = 'domains' in body ? domainsOf(state, body.domains, errors) : []
  if (Object.keys(errors).length) return validationFailed(errors)
  if (taken(state, username)) return problem(409, 'account-exists')
  const createdAt = new Date(state.now()).toISOString()
  const values = { ...state.accountDefaults.newAccountDefaults, ...body, username, createdAt }
  // Password is deliberately excluded from the object returned by the read factories.
  const { password, ...metadata } = values
  const item =
    role === 'admin'
      ? mockAdmin(metadata)
      : mockDomainAdmin({
          ...metadata,
          domains: domains.map((domain) =>
            assignment(domain, { active: values.active, createdAt }),
          ),
          permissions: {
            ...state.accountDefaults.domainAdminPermissionDefaults,
            ...('permissions' in body ? body.permissions : {}),
          },
        })
  collection(state, role).push(item)
  syncManagedAccount(state, item, password)
  return changedResponse(
    item,
    201,
    `/api/v2/${role === 'admin' ? 'admins' : 'domain-admins'}/${username}`,
  )
}
function checkVersion(request: Request, item: Managed): Response | null {
  const sent = request.headers.get('If-Match')
  return sent && bare(sent) === bare(accountEtag(item)) ? null : outdated()
}
function applyStatus(state: ScenarioState, item: Managed, active: boolean): void {
  item.active = active
  if ('domains' in item) for (const assignment of item.domains) assignment.active = active
  syncManagedAccount(state, item)
}
function protectedChange(
  state: ScenarioState,
  role: Role,
  item: Managed,
  action: 'delete' | 'deactivate',
): Response | null {
  if (role !== 'admin') return null
  if (action === 'delete' && item.username === state.session.username)
    return problem(409, 'cannot-delete-own-account')
  if (item.active && state.admins.filter((account) => account.active).length <= 1)
    return problem(409, 'last-active-admin')
  return null
}
function removeManaged(state: ScenarioState, role: Role, item: Managed): void {
  const items = collection(state, role)
  items.splice(items.indexOf(item), 1)
  state.accounts = state.accounts.filter((account) => account.username !== item.username)
  state.apiKeys = state.apiKeys.filter((key) => key.owner.username !== item.username)
  if (state.session.username === item.username) endSession(state)
}
export async function updateManaged(
  role: Role,
  username: string,
  request: Request,
): Promise<Response> {
  const state = scenario()
  const refused = access(state, request)
  if (refused) return refused
  const item = find(state, role, username)
  if (!item) return notFound()
  const stale = checkVersion(request, item)
  if (stale) return stale
  const body = (await request.json()) as Patch
  const errors: Violations = {}
  if (!Object.keys(body).length) addViolation(errors, 'body', 'required')
  const readonly = [
    'createdAt',
    'modifiedAt',
    'secondFactorStatus',
    'activePasskeyCount',
    'etag',
  ] as const
  const current = view(item)
  for (const key of readonly)
    if (key in body && JSON.stringify(body[key]) !== JSON.stringify(current[key]))
      addViolation(errors, key, 'immutable')
  const known = [
    'username',
    'password',
    'active',
    'forcePasswordChange',
    'forceSecondFactorSetup',
    ...readonly,
    ...(role === 'domainAdmin' ? ['domains', 'permissions'] : []),
  ]
  for (const key of Object.keys(body))
    if (!known.includes(key)) addViolation(errors, key, 'unknownField')
  const nextUsername =
    body.username === undefined
      ? item.username
      : checkName(errors, body.username, state.accountDefaults.usernameMaxLength)
  if (body.password !== undefined) checkPassword(state, errors, body.password)
  const domains =
    'domains' in body && body.domains !== undefined
      ? domainsOf(state, body.domains, errors)
      : undefined
  if ('permissions' in body && body.permissions)
    for (const name of Object.keys(body.permissions))
      if (!domainAdminPermissionNameValues.some((flag) => flag === name))
        addViolation(errors, `permissions.${name}`, 'unknownField')
  if (Object.keys(errors).length) return validationFailed(errors)
  if (taken(state, nextUsername, item)) return problem(409, 'account-exists')
  if (body.active === false) {
    const protectedAccount = protectedChange(state, role, item, 'deactivate')
    if (protectedAccount) return protectedAccount
  }
  if ('domains' in item) {
    if (domains)
      item.domains = domains.map(
        (domain) =>
          item.domains.find((entry) => entry.domain === domain) ??
          assignment(domain, {
            active: item.active,
            createdAt: new Date(state.now()).toISOString(),
          }),
      )
    if ('permissions' in body && body.permissions)
      item.permissions = { ...(item.permissions ?? permissionDefaults(false)), ...body.permissions }
  }
  for (const key of ['forcePasswordChange', 'forceSecondFactorSetup'] as const)
    if (body[key] !== undefined) item[key] = body[key]
  if (body.active !== undefined) applyStatus(state, item, body.active)
  const previous = item.username
  item.username = nextUsername
  if (
    ['username', 'password', 'active', 'forcePasswordChange', 'forceSecondFactorSetup'].some(
      (key) => key in body,
    )
  )
    item.modifiedAt = new Date(state.now()).toISOString()
  item.version++
  syncManagedAccount(state, item, body.password, previous)
  if (body.active === false && state.session.username === item.username) endSession(state)
  return changedResponse(item)
}
export function deleteManaged(role: Role, username: string, request: Request): Response {
  const state = scenario()
  const refused = access(state, request)
  if (refused) return refused
  const item = find(state, role, username)
  if (!item) return notFound()
  const stale = checkVersion(request, item)
  if (stale) return stale
  const protectedAccount = protectedChange(state, role, item, 'delete')
  if (protectedAccount) return protectedAccount
  removeManaged(state, role, item)
  return new HttpResponse(null, { status: 204 })
}
export function suspendManaged(role: Role, username: string, request: Request): Response {
  const state = scenario()
  const refused = access(state, request)
  if (refused) return refused
  const item = find(state, role, username)
  if (!item) return notFound()
  const stale = checkVersion(request, item)
  if (stale) return stale
  if (item.secondFactorStatus === 'active') item.secondFactorStatus = 'suspended'
  return changedResponse(item)
}
export async function bulkManaged(role: Role, request: Request): Promise<Response> {
  const state = scenario()
  const refused = access(state, request)
  if (refused) return refused
  const body = (await request.json()) as AccountBulkActionRequest
  if (body.targets.length > state.accountDefaults.bulkLimit) {
    const errors: Violations = {}
    addViolation(errors, 'targets', 'tooMany', { max: state.accountDefaults.bulkLimit })
    return validationFailed(errors)
  }
  const seen = new Set<string>(),
    results: BulkItemResult[] = []
  for (const target of body.targets) {
    const username = target.id.toLowerCase()
    if (seen.has(username)) continue
    seen.add(username)
    const item = find(state, role, username)
    if (!item) {
      results.push({ id: target.id, outcome: 'notFound' })
      continue
    }
    if (target.version !== undefined && bare(target.version) !== bare(accountEtag(item))) {
      results.push({
        id: target.id,
        outcome: 'outdated',
        problem: (await outdated().json()) as BulkItemResult['problem'],
      })
      continue
    }
    if (body.action === 'delete' || body.action === 'deactivate') {
      const denied = protectedChange(state, role, item, body.action)
      if (denied) {
        results.push({
          id: target.id,
          outcome: 'refused',
          problem: (await denied.json()) as BulkItemResult['problem'],
        })
        continue
      }
    }
    if (body.action === 'delete') removeManaged(state, role, item)
    else if (body.action === 'suspendSecondFactors') {
      if (item.secondFactorStatus === 'active') item.secondFactorStatus = 'suspended'
    } else {
      applyStatus(state, item, body.action === 'activate')
      item.modifiedAt = new Date(state.now()).toISOString()
      item.version++
    }
    results.push({
      id: target.id,
      outcome: 'done',
      ...(body.action === 'delete' ? {} : { version: accountEtag(item) }),
    })
  }
  const count = (outcome: BulkItemResult['outcome']) =>
    results.filter((item) => item.outcome === outcome).length
  const result: BulkResult = {
    bulkRequestId: requestId(),
    results,
    summary: {
      total: results.length,
      done: count('done'),
      notFound: count('notFound'),
      outdated: count('outdated'),
      refused: count('refused'),
      failed: count('failed'),
    },
  }
  return HttpResponse.json({ data: result })
}
