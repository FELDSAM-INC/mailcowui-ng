// Rate limit handlers (UI 006 T097, research R28): the limits of domains, alias domains and
// mailboxes, stored on those objects so that UI 002-004 show every change; a mailbox's effective
// limit and its source; invalid stored values; the overview with kind, search, sort and paging in
// the caller's scope; and the bucket reset. Mailbox users are refused (`forbidden`); domain
// administrators read without a flag and write with `ratelimit`.
import { HttpResponse } from 'msw'

import type { RateLimit, RateLimitValue } from '@/api'

import { addressOf } from '../factories/mailbox'
import {
  rateLimitKey,
  rateLimitView,
  storedText,
  type RateLimitKind,
} from '../factories/rate-limit'
import type { MockAccount, ScenarioState } from '../scenarios/state'
import { csrfProblem, http, requireAccount, scenario } from './context'
import { addViolation, compareValues, validationFailed, type Violations } from './domain-rules'
import { ensureMailboxes } from './mailbox-rules'
import {
  aliasDomainFor,
  audit,
  domainFor,
  flagRequired,
  forbidden,
  hasFlag,
  ifMatchFails,
  mailboxFor,
  notFound,
  outdated,
} from './quarantine-rules'

/** One object that can carry a limit, with access to its stored value. */
interface LimitHolder {
  kind: RateLimitKind
  object: string
  get(): RateLimitValue | null
  set(limit: RateLimitValue | null): void
  /** The domain whose limit applies to a mailbox without its own. */
  domain?: string
}

function holderFor(
  state: ScenarioState,
  account: MockAccount,
  kind: RateLimitKind,
  raw: string,
): LimitHolder | undefined {
  if (kind === 'domain') {
    const domain = domainFor(state, account, raw)
    return domain
      ? {
          kind,
          object: domain.name,
          get: () => domain.rateLimit,
          set: (limit) => (domain.rateLimit = limit),
        }
      : undefined
  }
  if (kind === 'aliasDomain') {
    const item = aliasDomainFor(state, account, raw)
    return item
      ? {
          kind,
          object: item.name,
          get: () => item.rateLimit ?? null,
          set: (limit) => (item.rateLimit = limit),
        }
      : undefined
  }
  const mailbox = mailboxFor(state, account, raw)
  return mailbox
    ? {
        kind,
        object: addressOf(mailbox),
        get: () => mailbox.rateLimit,
        set: (limit) => (mailbox.rateLimit = limit),
        domain: mailbox.domain,
      }
    : undefined
}

const invalidOf = (state: ScenarioState, holder: Pick<LimitHolder, 'kind' | 'object'>) =>
  state.quarantine.invalidRateLimits[rateLimitKey(holder.kind, holder.object)] ?? null

export function rateLimitOf(state: ScenarioState, holder: LimitHolder): RateLimit {
  const invalid = invalidOf(state, holder)
  const own = invalid ? null : holder.get()
  if (holder.kind !== 'mailbox') return rateLimitView(holder.kind, holder.object, own, invalid)
  const domainLimit =
    state.domains.find((domain) => domain.name === holder.domain)?.rateLimit ?? null
  const effective = own
    ? { limit: own, source: 'mailbox' as const }
    : domainLimit
      ? { limit: domainLimit, source: 'domain' as const }
      : { limit: null, source: 'none' as const }
  return rateLimitView('mailbox', holder.object, own, invalid, effective)
}

/** Every object with a limit (or an invalid stored value) in the account's scope. */
function holdersInScope(state: ScenarioState, account: MockAccount): LimitHolder[] {
  ensureMailboxes(state)
  const holders: LimitHolder[] = []
  for (const domain of state.domains) {
    const holder = holderFor(state, account, 'domain', domain.name)
    if (holder) holders.push(holder)
  }
  for (const item of state.aliasDomains) {
    const holder = holderFor(state, account, 'aliasDomain', item.name)
    if (holder) holders.push(holder)
  }
  for (const mailbox of state.mailboxes) {
    const holder = holderFor(state, account, 'mailbox', addressOf(mailbox))
    if (holder) holders.push(holder)
  }
  return holders.filter((holder) => holder.get() !== null || invalidOf(state, holder) !== null)
}

function access(state: ScenarioState): MockAccount | Response {
  const account = requireAccount(state)
  if (account instanceof Response) return account
  if (account.role === 'mailboxUser') return forbidden()
  return account
}

function getHandler(kind: RateLimitKind) {
  return (raw: string) => {
    const state = scenario()
    const account = access(state)
    if (account instanceof Response) return account
    const holder = holderFor(state, account, kind, raw)
    if (!holder) return notFound()
    const data = rateLimitOf(state, holder)
    return HttpResponse.json({ data }, { headers: { ETag: data.etag } })
  }
}

function setHandler(kind: RateLimitKind) {
  return async (request: Request, raw: string) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return refused
    const account = access(state)
    if (account instanceof Response) return account
    const holder = holderFor(state, account, kind, raw)
    if (!holder) return notFound()
    if (!hasFlag(account, 'ratelimit')) return flagRequired('ratelimit')
    const current = rateLimitOf(state, holder)
    if (ifMatchFails(request.headers.get('if-match'), current.etag)) return outdated()
    const body = (await request.json()) as RateLimitValue
    const caps = state.quarantine.capabilities.rateLimit
    const errors: Violations = {}
    if (body.value < caps.min || body.value > caps.max) {
      addViolation(errors, 'value', 'outOfRange', { min: caps.min, max: caps.max })
    }
    if (!caps.frames.includes(body.frame)) {
      addViolation(errors, 'frame', 'notInList', { allowed: caps.frames })
    }
    if (Object.keys(errors).length > 0) return validationFailed(errors)
    const old = invalidOf(state, holder) ?? storedText(holder.get())
    holder.set({ value: body.value, frame: body.frame })
    delete state.quarantine.invalidRateLimits[rateLimitKey(holder.kind, holder.object)]
    audit(state, account, {
      eventType: 'rateLimitUpdate',
      target: { type: 'rateLimit', id: holder.object, name: holder.object },
      details: { kind, old, new: storedText(holder.get()) },
    })
    const data = rateLimitOf(state, holder)
    return HttpResponse.json({ data }, { headers: { ETag: data.etag } })
  }
}

function removeHandler(kind: RateLimitKind) {
  return (request: Request, raw: string) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return refused
    const account = access(state)
    if (account instanceof Response) return account
    const holder = holderFor(state, account, kind, raw)
    if (!holder) return notFound()
    if (!hasFlag(account, 'ratelimit')) return flagRequired('ratelimit')
    const current = rateLimitOf(state, holder)
    if (ifMatchFails(request.headers.get('if-match'), current.etag)) return outdated()
    const old = invalidOf(state, holder) ?? storedText(holder.get())
    if (old !== null) {
      holder.set(null)
      delete state.quarantine.invalidRateLimits[rateLimitKey(holder.kind, holder.object)]
      audit(state, account, {
        eventType: 'rateLimitRemoval',
        target: { type: 'rateLimit', id: holder.object, name: holder.object },
        details: { kind, old, new: null },
      })
    }
    return new HttpResponse(null, { status: 204 })
  }
}

const KIND_ORDER: Record<RateLimitKind, number> = { domain: 0, aliasDomain: 1, mailbox: 2 }

export const rateLimitHandlers = [
  http.get('/rate-limits', ({ request, response }) => {
    const state = scenario()
    const account = access(state)
    if (account instanceof Response) return response.untyped(account)
    const query = new URL(request.url).searchParams
    const kind = query.get('kind')
    const q = query.get('q')?.trim().toLowerCase()
    const sort = query.get('sort') ?? 'object'
    const direction = query.get('order') === 'desc' ? -1 : 1
    const items = holdersInScope(state, account)
      .filter((holder) => (!kind || holder.kind === kind) && (!q || holder.object.includes(q)))
      .map((holder) => rateLimitOf(state, holder))
      .sort(
        (a, b) =>
          direction *
            (sort === 'kind'
              ? KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
              : compareValues(a.object, b.object)) || compareValues(a.object, b.object),
      )
    const limit = Number(query.get('limit') ?? 25)
    const offset = Number(query.get('offset') ?? 0)
    return response(200).json({
      data: items.slice(offset, offset + limit),
      meta: { total: items.length, limit, offset },
    })
  }),

  http.get('/domains/{domain}/rate-limit', ({ params, response }) =>
    response.untyped(getHandler('domain')(params.domain)),
  ),
  http.put('/domains/{domain}/rate-limit', async ({ params, request, response }) =>
    response.untyped(await setHandler('domain')(request, params.domain)),
  ),
  http.delete('/domains/{domain}/rate-limit', ({ params, request, response }) =>
    response.untyped(removeHandler('domain')(request, params.domain)),
  ),
  http.get('/alias-domains/{aliasDomain}/rate-limit', ({ params, response }) =>
    response.untyped(getHandler('aliasDomain')(params.aliasDomain)),
  ),
  http.put('/alias-domains/{aliasDomain}/rate-limit', async ({ params, request, response }) =>
    response.untyped(await setHandler('aliasDomain')(request, params.aliasDomain)),
  ),
  http.delete('/alias-domains/{aliasDomain}/rate-limit', ({ params, request, response }) =>
    response.untyped(removeHandler('aliasDomain')(request, params.aliasDomain)),
  ),
  http.get('/mailboxes/{mailbox}/rate-limit', ({ params, response }) =>
    response.untyped(getHandler('mailbox')(params.mailbox)),
  ),
  http.put('/mailboxes/{mailbox}/rate-limit', async ({ params, request, response }) =>
    response.untyped(await setHandler('mailbox')(request, params.mailbox)),
  ),
  http.delete('/mailboxes/{mailbox}/rate-limit', ({ params, request, response }) =>
    response.untyped(removeHandler('mailbox')(request, params.mailbox)),
  ),

  http.delete('/rate-limit-buckets/{bucketId}', ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    if (account.role !== 'admin') return response.untyped(forbidden())
    const bucketId = params.bucketId
    const target = { type: 'rateLimitBucket' as const, id: bucketId, name: bucketId }
    if (!state.quarantine.buckets.includes(bucketId)) {
      audit(state, account, {
        eventType: 'rateLimitBucketReset',
        target,
        details: { problemType: 'about:blank', status: 404 },
        failureReason: 'notFound',
      })
      return response.untyped(notFound())
    }
    state.quarantine.buckets = state.quarantine.buckets.filter((id) => id !== bucketId)
    audit(state, account, {
      eventType: 'rateLimitBucketReset',
      target,
      details: { countersExisted: true, logEntriesRemoved: 1 },
    })
    return response.untyped(new HttpResponse(null, { status: 204 }))
  }),
]
