// API key handlers (T123): list with filters, sorting and paging; create with the contract's
// validation codes and the one-time secret; read; revoke (idempotent, with If-Match); and the
// key-owner candidates. Every operation is for administrators only.
import { isIP } from 'node:net'

import type { ApiKey, ApiKeyCreateRequest, FieldViolation, Writable } from '@/api'

import { token, ulid } from '../factories/ids'
import { findAccount, type ScenarioState } from '../scenarios/state'
import { csrfProblem, http, problem, requireAccount, scenario } from './context'

const OWNER_ROLES = ['admin', 'domainAdmin'] as const

type Violations = Record<string, FieldViolation[]>

function violation(code: FieldViolation['code'], params: Record<string, unknown> = {}) {
  return { code, params, message: `Rule ${code} failed.` }
}

/** The signed-in administrator, or the problem the API answers instead. */
function requireAdmin(state: ScenarioState): Response | null {
  const account = requireAccount(state)
  if (account instanceof Response) return account
  return account.role === 'admin' ? null : problem(403, 'forbidden')
}

/** A key as the API reports it now: owner and status follow the current accounts and time. */
function present(state: ScenarioState, key: ApiKey): ApiKey {
  const account = findAccount(state, key.owner.username)
  const eligible = account && (OWNER_ROLES as readonly string[]).includes(account.role)
  const owner = account
    ? {
        username: account.username,
        role: eligible ? (account.role as ApiKey['owner']['role']) : null,
        active: !!eligible && account.active,
      }
    : { ...key.owner, active: false }
  const expired = key.expiresAt !== null && new Date(key.expiresAt).getTime() <= state.now()
  const status = key.revokedAt ? 'revoked' : expired ? 'expired' : 'active'
  return { ...key, owner, status }
}

function compareNullable(a: string | null, b: string | null, nullsAs: number): number {
  const time = (value: string | null) => (value === null ? nullsAs : new Date(value).getTime())
  return time(a) - time(b)
}

const SORTERS: Record<string, (a: ApiKey, b: ApiKey) => number> = {
  createdAt: (a, b) => compareNullable(a.createdAt, b.createdAt, 0),
  name: (a, b) => a.name.localeCompare(b.name),
  // A key that never expires expires last; a key never used was used least recently.
  expiresAt: (a, b) => compareNullable(a.expiresAt, b.expiresAt, Number.POSITIVE_INFINITY),
  lastUsedAt: (a, b) => compareNullable(a.lastUsedAt, b.lastUsedAt, Number.NEGATIVE_INFINITY),
}

/** `192.0.2.7` becomes `192.0.2.7/32`; `null` when the value is not an address or prefix. */
function normaliseNetwork(value: string): string | null {
  const [address = '', prefix, extra] = value.trim().split('/')
  if (extra !== undefined) return null
  const family = isIP(address)
  if (family === 0) return null
  const max = family === 4 ? 32 : 128
  if (prefix === undefined) return `${address}/${max}`
  if (!/^(?:0|[1-9]\d{0,2})$/.test(prefix) || Number(prefix) > max) return null
  return `${address}/${prefix}`
}

function validateCreate(
  state: ScenarioState,
  body: Writable<ApiKeyCreateRequest>,
): { errors: Violations; networks: string[] } {
  const errors: Violations = {}
  const add = (path: string, item: FieldViolation) => (errors[path] ??= []).push(item)
  const name = body.name.trim()
  if (!name) add('name', violation('required'))
  else if (name.length > 255) add('name', violation('tooLong', { max: 255 }))

  const ownerName = body.ownerUsername.trim()
  const owner = findAccount(state, ownerName)
  if (!ownerName) add('ownerUsername', violation('required'))
  else if (!owner) add('ownerUsername', violation('notFound'))
  else if (!owner.active || !(OWNER_ROLES as readonly string[]).includes(owner.role)) {
    add('ownerUsername', violation('notEligible', { allowedRoles: [...OWNER_ROLES] }))
  }

  if (body.expiresAt && new Date(body.expiresAt).getTime() <= state.now()) {
    add('expiresAt', violation('mustBeInFuture'))
  }

  const networks: string[] = []
  const entries = body.allowedNetworks ?? []
  if (entries.length > 100) add('allowedNetworks', violation('tooMany', { max: 100 }))
  entries.forEach((entry, index) => {
    const normal = normaliseNetwork(entry)
    if (normal) networks.push(normal)
    else add(`allowedNetworks.${index}`, violation('invalidFormat', { format: 'ipNetwork' }))
  })
  return { errors, networks }
}

function keyResponse(key: ApiKey) {
  return { body: { data: key }, headers: { ETag: key.etag } }
}

export const apiKeyHandlers = [
  http.get('/api-keys', ({ query, response }) => {
    const state = scenario()
    const refused = requireAdmin(state)
    if (refused) return response.untyped(refused)
    const limit = Number(query.get('limit') ?? 25)
    const offset = Number(query.get('offset') ?? 0)
    const sort = query.get('sort') ?? 'createdAt'
    const order = query.get('order') ?? (sort === 'createdAt' ? 'desc' : 'asc')
    const q = query.get('q')?.trim().toLowerCase() ?? ''
    const ownerUsername = query.get('ownerUsername')?.trim().toLowerCase() ?? ''
    const status = query.get('status')
    const accessLevel = query.get('accessLevel')

    const sorter = SORTERS[sort] ?? SORTERS.createdAt!
    const items = state.apiKeys
      .map((key) => present(state, key))
      .filter((key) => !ownerUsername || key.owner.username.toLowerCase() === ownerUsername)
      .filter((key) => !status || key.status === status)
      .filter((key) => !accessLevel || key.accessLevel === accessLevel)
      .filter(
        (key) => !q || key.name.toLowerCase().includes(q) || key.prefix.toLowerCase().includes(q),
      )
      .sort((a, b) => (order === 'desc' ? sorter(b, a) : sorter(a, b)))
    return response(200).json({
      data: items.slice(offset, offset + limit),
      meta: { total: items.length, limit, offset },
    })
  }),

  http.post('/api-keys', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request) ?? requireAdmin(state)
    if (refused) return response.untyped(refused)
    const body = (await request.json()) as unknown as Writable<ApiKeyCreateRequest>
    const { errors, networks } = validateCreate(state, body)
    if (Object.keys(errors).length > 0) {
      return response.untyped(problem(422, 'validation-failed', { errors }))
    }
    const owner = findAccount(state, body.ownerUsername)!
    const secret = `mcv2_${token(40)}`
    const key: ApiKey = {
      id: ulid(),
      name: body.name.trim(),
      prefix: secret.slice(0, 12),
      owner: {
        username: owner.username,
        role: owner.role as ApiKey['owner']['role'],
        active: true,
      },
      accessLevel: body.accessLevel,
      allowedNetworks: networks,
      expiresAt: body.expiresAt ?? null,
      status: 'active',
      createdAt: new Date(state.now()).toISOString(),
      createdBy: { username: state.session.username ?? 'admin' },
      lastUsedAt: null,
      lastUsedFrom: null,
      revokedAt: null,
      revokedBy: null,
      etag: `"ak-${token(12)}"`,
    }
    state.apiKeys.push(key)
    return response(201).json(
      { data: { ...key, secret } },
      { headers: { Location: `/api/v2/api-keys/${key.id}`, ETag: key.etag } },
    )
  }),

  http.get('/api-keys/owner-candidates', ({ query, response }) => {
    const state = scenario()
    const refused = requireAdmin(state)
    if (refused) return response.untyped(refused)
    const limit = Number(query.get('limit') ?? 25)
    const offset = Number(query.get('offset') ?? 0)
    const order = query.get('order') ?? 'asc'
    const q = query.get('q')?.trim().toLowerCase() ?? ''
    const role = query.get('role')
    const items = state.accounts
      .filter((account) => account.active)
      .filter((account) => (OWNER_ROLES as readonly string[]).includes(account.role))
      .filter((account) => !role || account.role === role)
      .filter((account) => !q || account.username.toLowerCase().includes(q))
      .map((account) => ({
        username: account.username,
        role: account.role as (typeof OWNER_ROLES)[number],
      }))
      .sort((a, b) =>
        order === 'desc'
          ? b.username.localeCompare(a.username)
          : a.username.localeCompare(b.username),
      )
    return response(200).json({
      data: items.slice(offset, offset + limit),
      meta: { total: items.length, limit, offset },
    })
  }),

  http.get('/api-keys/{apiKeyId}', ({ params, response }) => {
    const state = scenario()
    const refused = requireAdmin(state)
    if (refused) return response.untyped(refused)
    const key = state.apiKeys.find((candidate) => candidate.id === params.apiKeyId)
    if (!key) return response.untyped(problem(404, null))
    const { body, headers } = keyResponse(present(state, key))
    return response(200).json(body, { headers })
  }),

  http.post('/api-keys/{apiKeyId}/revocation', ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request) ?? requireAdmin(state)
    if (refused) return response.untyped(refused)
    const key = state.apiKeys.find((candidate) => candidate.id === params.apiKeyId)
    if (!key) return response.untyped(problem(404, null))
    const ifMatch = request.headers.get('if-match')
    if (ifMatch && ifMatch !== '*' && ifMatch !== key.etag) {
      return response.untyped(problem(412, null))
    }
    // Idempotent: a revoked key stays as it is.
    if (!key.revokedAt) {
      key.revokedAt = new Date(state.now()).toISOString()
      key.revokedBy = { username: state.session.username ?? 'admin' }
      key.status = 'revoked'
      key.etag = `"ak-${token(12)}"`
    }
    const { body, headers } = keyResponse(present(state, key))
    return response(200).json(body, { headers })
  }),
]
