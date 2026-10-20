import type { TemporaryAliasCreateRequest, TemporaryAliasPatch, Writable } from '@/api'
import {
  HOUR,
  isLive,
  mockTemporaryAlias,
  temporaryAliasEtag,
  temporaryAliasView,
} from '../../factories/temporary-alias'
import { addressOf } from '../../factories/mailbox'
import { mailboxSelfService } from '../../scenarios/self-service/state'
import { csrfProblem, http, problem, requireAccount, scenario } from '../context'
import {
  addViolation,
  compareValues,
  page,
  validationFailed,
  type Violations,
} from '../domain-rules'
import { flagRefusal, isoNow, notFound, outage, preconditionFailed, reachMailbox } from './rules'

function scope(mailbox: string, request: Request, change: boolean) {
  const state = scenario()
  if (change) {
    const csrf = csrfProblem(state, request)
    if (csrf) return csrf
  }
  const account = requireAccount(state)
  if (account instanceof Response) return account
  const reached = reachMailbox(state, account, mailbox)
  if (reached instanceof Response) return reached
  if (change) {
    const denied = flagRefusal(account, 'spamAlias')
    if (denied) return denied
  }
  return mailboxSelfService(state, mailbox.toLowerCase())
}
function domains(mailbox: string) {
  return [
    ...new Set([
      mailbox.split('@')[1]!,
      ...mailboxSelfService(scenario(), mailbox).temporaryAliasDomains,
    ]),
  ]
}
function syncCount(mailbox: string) {
  const state = scenario()
  const entry = state.mailboxes.find((item) => addressOf(item) === mailbox.toLowerCase())
  if (entry)
    entry.activeTemporaryAliases = mailboxSelfService(state, mailbox).temporaryAliases.filter(
      (item) => isLive(item, state.now()),
    ).length
}
function valid(
  body: Writable<TemporaryAliasCreateRequest> | Writable<TemporaryAliasPatch>,
  mailbox: string,
) {
  const errors: Violations = {}
  if ('domain' in body && !domains(mailbox).includes(body.domain))
    addViolation(errors, 'domain', 'notInList', { allowed: domains(mailbox) })
  if ('description' in body && (body.description?.length ?? 0) > 255)
    addViolation(errors, 'description', 'tooLong', { limit: 255 })
  if (
    'lifetimeHours' in body &&
    body.lifetimeHours !== undefined &&
    (!Number.isInteger(body.lifetimeHours) || body.lifetimeHours < 1 || body.lifetimeHours > 87600)
  )
    addViolation(errors, 'lifetimeHours', 'outOfRange', { min: 1, max: 87600 })
  return Object.keys(errors).length ? validationFailed(errors) : null
}
export const temporaryAliasHandlers = [
  http.get('/mailboxes/{mailbox}/temporary-alias-domains', ({ params, request, response }) => {
    const record = scope(params.mailbox, request, false)
    if (record instanceof Response) return response.untyped(record)
    return response(200).json(
      page(
        domains(params.mailbox).map((domain, index) => ({
          domain,
          domainUnicode: domain,
          kind: index === 0 ? ('mailboxDomain' as const) : ('aliasDomain' as const),
        })),
        new URL(request.url),
      ),
    )
  }),
  http.get('/mailboxes/{mailbox}/temporary-aliases', ({ params, request, response }) => {
    const record = scope(params.mailbox, request, false)
    if (record instanceof Response) return response.untyped(record)
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const permanent = url.searchParams.get('permanent')
    const sort = (url.searchParams.get('sort') ?? 'createdAt') as
      'createdAt' | 'expiresAt' | 'address'
    const desc = url.searchParams.get('order') !== 'asc'
    const items = record.temporaryAliases
      .filter(
        (item) =>
          isLive(item, scenario().now()) &&
          (!q || item.address.toLowerCase().includes(q)) &&
          (permanent === null || (item.expiresAt === null) === (permanent === 'true')),
      )
      .map((item) => temporaryAliasView(params.mailbox, item))
    items.sort((a, b) => {
      if (sort === 'expiresAt' && (a.expiresAt === null || b.expiresAt === null))
        return Number(a.expiresAt === null) - Number(b.expiresAt === null)
      return compareValues(a[sort], b[sort]) * (desc ? -1 : 1) || a.address.localeCompare(b.address)
    })
    syncCount(params.mailbox)
    return response(200).json(page(items, url))
  }),
  http.post('/mailboxes/{mailbox}/temporary-aliases', async ({ params, request, response }) => {
    const record = scope(params.mailbox, request, true)
    if (record instanceof Response) return response.untyped(record)
    const body = (await request.json()) as Writable<TemporaryAliasCreateRequest>
    const invalid = valid(body, params.mailbox)
    if (invalid) return response.untyped(invalid)
    const unavailable = outage(scenario(), 'addressGeneration')
    if (unavailable) return response.untyped(unavailable)
    // The same alternating consonant/vowel shape as the contract; retry collisions.
    let address: string
    do {
      const word = () =>
        Array.from({ length: 6 }, (_, i) => {
          const letters = i % 2 ? 'aeiou' : 'bcdfghjklmnprstvwz'
          return letters[Math.floor(Math.random() * letters.length)]
        }).join('')
      address = `${word()}.${word()}@${body.domain}`
    } while (
      Object.values(scenario().selfService.mailboxes).some((m) =>
        m.temporaryAliases.some((a) => a.address === address),
      )
    )
    const item = mockTemporaryAlias({
      address,
      description: body.description ?? '',
      createdAt: isoNow(scenario()),
      expiresAt: body.permanent ? null : scenario().now() + (body.lifetimeHours ?? 8760) * HOUR,
    })
    record.temporaryAliases.push(item)
    syncCount(params.mailbox)
    return response(201).json(
      { data: temporaryAliasView(params.mailbox, item) },
      {
        headers: {
          ETag: temporaryAliasEtag(item),
          Location: `/api/v2/mailboxes/${encodeURIComponent(params.mailbox)}/temporary-aliases/${encodeURIComponent(item.address)}`,
        },
      },
    )
  }),
  http.get(
    '/mailboxes/{mailbox}/temporary-aliases/{temporaryAlias}',
    ({ params, request, response }) => {
      const record = scope(params.mailbox, request, false)
      if (record instanceof Response) return response.untyped(record)
      const item = record.temporaryAliases.find(
        (a) => a.address === params.temporaryAlias && isLive(a, scenario().now()),
      )
      if (!item) return response.untyped(notFound())
      return response(200).json(
        { data: temporaryAliasView(params.mailbox, item) },
        { headers: { ETag: temporaryAliasEtag(item) } },
      )
    },
  ),
  http.patch(
    '/mailboxes/{mailbox}/temporary-aliases/{temporaryAlias}',
    async ({ params, request, response }) => {
      const record = scope(params.mailbox, request, true)
      if (record instanceof Response) return response.untyped(record)
      const item = record.temporaryAliases.find(
        (a) => a.address === params.temporaryAlias && isLive(a, scenario().now()),
      )
      if (!item) return response.untyped(notFound())
      if (item.failWith) return response.untyped(problem(item.failWith, null))
      const stale = preconditionFailed(request, temporaryAliasEtag(item))
      if (stale) return response.untyped(stale)
      const body = (await request.json()) as Writable<TemporaryAliasPatch>
      const invalid = valid(body, params.mailbox)
      if (invalid) return response.untyped(invalid)
      item.expiresAt = 'permanent' in body ? null : scenario().now() + body.lifetimeHours * HOUR
      item.modifiedAt = isoNow(scenario())
      item.version++
      syncCount(params.mailbox)
      return response(200).json(
        { data: temporaryAliasView(params.mailbox, item) },
        { headers: { ETag: temporaryAliasEtag(item) } },
      )
    },
  ),
  http.delete(
    '/mailboxes/{mailbox}/temporary-aliases/{temporaryAlias}',
    ({ params, request, response }) => {
      const record = scope(params.mailbox, request, true)
      if (record instanceof Response) return response.untyped(record)
      const item = record.temporaryAliases.find(
        (a) => a.address === params.temporaryAlias && isLive(a, scenario().now()),
      )
      if (!item) return response.untyped(notFound())
      if (item.failWith) return response.untyped(problem(item.failWith, null))
      const stale = preconditionFailed(request, temporaryAliasEtag(item))
      if (stale) return response.untyped(stale)
      record.temporaryAliases = record.temporaryAliases.filter((a) => a !== item)
      syncCount(params.mailbox)
      return response(204).empty()
    },
  ),
]
