// Spam policy handlers (UI 006 T080, T090, T116, research R28): mailbox spam scores (defaults and
// fallback, custom values, the 0.1 rule and the equal-values raise), the allow and block lists of
// domains, alias domains and mailboxes with own and inherited entries, conflicts and pattern rules,
// and the spam filter's action statistics. Mailbox users reach their own mailbox only; domain and
// alias domain lists refuse them (`forbidden`); writes need `spamScore` or `spamPolicy`.
import { HttpResponse } from 'msw'

import type { SpamPolicyEntry } from '@/api'

import { addressOf } from '../factories/mailbox'
import {
  mockSpamPolicyEntry,
  spamPolicyEntryEtag,
  spamPolicyEntryView,
} from '../factories/spam-policy-entry'
import { spamScoreView, tenths } from '../factories/spam-score'
import { spamStatisticsView } from '../factories/spam-statistics'
import type { MockAccount, MockSpamPolicyEntry, ScenarioState } from '../scenarios/state'
import { csrfProblem, http, problem, requireAccount, scenario } from './context'
import { addViolation, compareValues, validationFailed, type Violations } from './domain-rules'
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
  nowIso,
  outdated,
  temporaryFailure,
} from './quarantine-rules'

type OwnerKind = MockSpamPolicyEntry['ownerKind']

const PATH: Record<OwnerKind, string> = {
  domain: 'domains',
  aliasDomain: 'alias-domains',
  mailbox: 'mailboxes',
}

/** The owner named in the path, or the problem to answer. */
function resolveOwner(
  state: ScenarioState,
  account: MockAccount,
  kind: OwnerKind,
  raw: string,
): { name: string; domain: string } | Response {
  if (kind === 'mailbox') {
    const mailbox = mailboxFor(state, account, raw)
    return mailbox ? { name: addressOf(mailbox), domain: mailbox.domain } : notFound()
  }
  if (account.role === 'mailboxUser') return forbidden()
  if (kind === 'domain') {
    const domain = domainFor(state, account, raw)
    return domain ? { name: domain.name, domain: domain.name } : notFound()
  }
  const aliasDomain = aliasDomainFor(state, account, raw)
  return aliasDomain ? { name: aliasDomain.name, domain: aliasDomain.target } : notFound()
}

/** The flag a write needs: administrators never; domain administrators and mailbox users `spamPolicy`. */
const canWrite = (account: MockAccount) => hasFlag(account, 'spamPolicy')

const ownEntries = (state: ScenarioState, kind: OwnerKind, owner: string) =>
  state.quarantine.entries.filter((entry) => entry.ownerKind === kind && entry.owner === owner)

/** Entries shown read-only: a mailbox's domain entries, a domain's mailbox entries. */
function inheritedEntries(
  state: ScenarioState,
  kind: OwnerKind,
  owner: { name: string; domain: string },
) {
  if (kind === 'mailbox') {
    return state.quarantine.entries.filter(
      (entry) => entry.ownerKind === 'domain' && entry.owner === owner.domain,
    )
  }
  if (kind === 'domain') {
    return state.quarantine.entries.filter(
      (entry) => entry.ownerKind === 'mailbox' && entry.owner.endsWith(`@${owner.name}`),
    )
  }
  return []
}

const PATTERN_CHARACTERS = /^[a-z0-9@_.*-]+$/

function listHandler(kind: OwnerKind) {
  return (request: Request, rawOwner: string) => {
    const state = scenario()
    const account = requireAccount(state)
    if (account instanceof Response) return account
    const owner = resolveOwner(state, account, kind, rawOwner)
    if (owner instanceof Response) return owner
    const query = new URL(request.url).searchParams
    const ownership = query.get('ownership')
    const list = query.get('list')
    const q = query.get('q')?.trim().toLowerCase()
    const views: SpamPolicyEntry[] = [
      ...(ownership === 'inherited' ? [] : ownEntries(state, kind, owner.name)).map((entry) =>
        spamPolicyEntryView(entry, true),
      ),
      ...(ownership === 'own' ? [] : inheritedEntries(state, kind, owner)).map((entry) =>
        spamPolicyEntryView(entry, false),
      ),
    ].filter((entry) => (!list || entry.list === list) && (!q || entry.pattern.includes(q)))
    const sort = (query.get('sort') ?? 'pattern') as 'pattern' | 'createdAt' | 'id'
    const direction = query.get('order') === 'desc' ? -1 : 1
    views.sort((a, b) => direction * compareValues(a[sort], b[sort]) || a.id - b.id)
    const limit = Number(query.get('limit') ?? 25)
    const offset = Number(query.get('offset') ?? 0)
    return HttpResponse.json({
      data: views.slice(offset, offset + limit),
      meta: { total: views.length, limit, offset },
    })
  }
}

function createHandler(kind: OwnerKind) {
  return async (request: Request, rawOwner: string) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return refused
    const account = requireAccount(state)
    if (account instanceof Response) return account
    const owner = resolveOwner(state, account, kind, rawOwner)
    if (owner instanceof Response) return owner
    const target = { type: kind, id: owner.name, name: owner.name } as const
    if (!canWrite(account)) {
      audit(state, account, {
        eventType: 'spamPolicyEntryCreation',
        target,
        details: {
          problemType: '/api/v2/problems/permission-flag-required',
          status: 403,
          requiredFlags: ['spamPolicy'],
        },
        failureReason: 'permissionDenied',
      })
      return flagRequired('spamPolicy')
    }
    const body = (await request.json()) as { list: 'allow' | 'block'; pattern: string }
    const pattern = body.pattern.trim().toLowerCase()
    const caps = state.quarantine.capabilities.senderPattern
    const errors: Violations = {}
    if (!PATTERN_CHARACTERS.test(pattern) || !/[a-z0-9]/.test(pattern)) {
      addViolation(errors, 'pattern', 'invalidFormat', { format: 'senderPattern' })
    } else if (pattern.length > caps.maxLength) {
      addViolation(errors, 'pattern', 'tooLong', { max: caps.maxLength })
    }
    if (Object.keys(errors).length > 0) return validationFailed(errors)
    const existing = ownEntries(state, kind, owner.name).find((entry) => entry.pattern === pattern)
    if (existing) {
      audit(state, account, {
        eventType: 'spamPolicyEntryCreation',
        target,
        details: {
          list: body.list,
          pattern,
          problemType: '/api/v2/problems/spam-policy-entry-exists',
          status: 409,
        },
        failureReason: 'conflict',
      })
      return problem(409, 'spam-policy-entry-exists', { list: existing.list, entryId: existing.id })
    }
    state.quarantine.lastEntryId += 1
    const entry = mockSpamPolicyEntry({
      id: state.quarantine.lastEntryId,
      list: body.list,
      ownerKind: kind,
      owner: owner.name,
      pattern,
      createdAt: nowIso(state),
    })
    state.quarantine.entries.push(entry)
    audit(state, account, {
      eventType: 'spamPolicyEntryCreation',
      target,
      details: { entryId: entry.id, list: entry.list, pattern: entry.pattern },
    })
    const data = spamPolicyEntryView(entry, true)
    return HttpResponse.json(
      { data },
      {
        status: 201,
        headers: {
          Location: `/api/v2/${PATH[kind]}/${owner.name}/spam-policy-entries/${entry.id}`,
          ETag: data.etag,
        },
      },
    )
  }
}

function findOwnEntry(
  state: ScenarioState,
  kind: OwnerKind,
  owner: string,
  rawId: string | number,
) {
  const id = Number(rawId)
  return ownEntries(state, kind, owner).find((entry) => entry.id === id)
}

function getHandler(kind: OwnerKind) {
  return (rawOwner: string, rawId: string | number) => {
    const state = scenario()
    const account = requireAccount(state)
    if (account instanceof Response) return account
    const owner = resolveOwner(state, account, kind, rawOwner)
    if (owner instanceof Response) return owner
    const entry = findOwnEntry(state, kind, owner.name, rawId)
    if (!entry) return notFound()
    const data = spamPolicyEntryView(entry, true)
    return HttpResponse.json({ data }, { headers: { ETag: data.etag } })
  }
}

function deleteHandler(kind: OwnerKind) {
  return (request: Request, rawOwner: string, rawId: string | number) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return refused
    const account = requireAccount(state)
    if (account instanceof Response) return account
    const owner = resolveOwner(state, account, kind, rawOwner)
    if (owner instanceof Response) return owner
    if (!canWrite(account)) return flagRequired('spamPolicy')
    const entry = findOwnEntry(state, kind, owner.name, rawId)
    if (!entry) return notFound()
    if (ifMatchFails(request.headers.get('if-match'), spamPolicyEntryEtag(entry))) {
      return outdated()
    }
    state.quarantine.entries = state.quarantine.entries.filter((item) => item !== entry)
    audit(state, account, {
      eventType: 'spamPolicyEntryRemoval',
      target: { type: kind, id: owner.name, name: owner.name },
      details: { entryId: entry.id, list: entry.list, pattern: entry.pattern },
    })
    return new HttpResponse(null, { status: 204 })
  }
}

// ---------------------------------------------------------------------------------------------
// Spam scores

function scoreView(state: ScenarioState, mailbox: string) {
  return spamScoreView(
    mailbox,
    state.quarantine.spamScores[mailbox],
    state.quarantine.spamScoreDefaults,
  )
}

/** Mailbox users need `spamScore`; administrators and domain administrators always may. */
const canChangeScore = (account: MockAccount) =>
  account.role !== 'mailboxUser' || !!account.permissions.spamScore

export const spamPolicyHandlers = [
  http.get('/mailboxes/{mailbox}/spam-score', ({ params, response }) => {
    const state = scenario()
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    const mailbox = mailboxFor(state, account, params.mailbox)
    if (!mailbox) return response.untyped(notFound())
    const data = scoreView(state, addressOf(mailbox))
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.put('/mailboxes/{mailbox}/spam-score', async ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    const mailbox = mailboxFor(state, account, params.mailbox)
    if (!mailbox) return response.untyped(notFound())
    const address = addressOf(mailbox)
    if (!canChangeScore(account)) return response.untyped(flagRequired('spamScore'))
    const current = scoreView(state, address)
    if (ifMatchFails(request.headers.get('if-match'), current.etag)) {
      return response.untyped(outdated())
    }
    const body = await request.json()
    const errors: Violations = {}
    for (const key of ['junkScore', 'rejectScore'] as const) {
      if (Math.abs(body[key] * 10 - tenths(body[key])) > 1e-9) {
        addViolation(errors, key, 'notMultipleOf', { factor: 0.1 })
      }
    }
    if (
      !errors.junkScore &&
      !errors.rejectScore &&
      tenths(body.junkScore) > tenths(body.rejectScore)
    ) {
      addViolation(errors, 'junkScore', 'mustNotExceed', {
        field: 'rejectScore',
        value: body.rejectScore,
      })
    }
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    const junk = tenths(body.junkScore)
    let reject = tenths(body.rejectScore)
    if (junk === reject) reject += 1
    const before = state.quarantine.spamScores[address]
    state.quarantine.spamScores[address] = { junkScore: junk / 10, rejectScore: reject / 10 }
    audit(state, account, {
      eventType: 'spamScoreUpdate',
      target: { type: 'spamScore', id: address, name: address },
      details: {
        changes: {
          junkScore: { old: before?.junkScore ?? null, new: junk / 10 },
          rejectScore: { old: before?.rejectScore ?? null, new: reject / 10 },
        },
      },
    })
    const data = scoreView(state, address)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.delete('/mailboxes/{mailbox}/spam-score', ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    const mailbox = mailboxFor(state, account, params.mailbox)
    if (!mailbox) return response.untyped(notFound())
    const address = addressOf(mailbox)
    if (!canChangeScore(account)) return response.untyped(flagRequired('spamScore'))
    if (ifMatchFails(request.headers.get('if-match'), scoreView(state, address).etag)) {
      return response.untyped(outdated())
    }
    const before = state.quarantine.spamScores[address]
    if (before) {
      delete state.quarantine.spamScores[address]
      audit(state, account, {
        eventType: 'spamScoreReset',
        target: { type: 'spamScore', id: address, name: address },
        details: {
          changes: {
            ...(before.junkScore !== null
              ? { junkScore: { old: before.junkScore, new: null } }
              : {}),
            ...(before.rejectScore !== null
              ? { rejectScore: { old: before.rejectScore, new: null } }
              : {}),
          },
        },
      })
    }
    return response.untyped(new HttpResponse(null, { status: 204 }))
  }),

  http.get('/spam-filter-action-statistics', ({ response }) => {
    const state = scenario()
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    if (account.role !== 'admin') return response.untyped(forbidden())
    const stats = state.quarantine.statistics
    if (stats === 'unavailable') return response.untyped(temporaryFailure('spamFilter'))
    return response(200).json({ data: spamStatisticsView(stats) })
  }),

  // Allow and block lists of the three owner kinds.
  http.get('/domains/{domain}/spam-policy-entries', ({ request, params, response }) =>
    response.untyped(listHandler('domain')(request, params.domain)),
  ),
  http.post('/domains/{domain}/spam-policy-entries', async ({ request, params, response }) =>
    response.untyped(await createHandler('domain')(request, params.domain)),
  ),
  http.get('/domains/{domain}/spam-policy-entries/{entryId}', ({ params, response }) =>
    response.untyped(getHandler('domain')(params.domain, params.entryId)),
  ),
  http.delete('/domains/{domain}/spam-policy-entries/{entryId}', ({ request, params, response }) =>
    response.untyped(deleteHandler('domain')(request, params.domain, params.entryId)),
  ),
  http.get('/alias-domains/{aliasDomain}/spam-policy-entries', ({ request, params, response }) =>
    response.untyped(listHandler('aliasDomain')(request, params.aliasDomain)),
  ),
  http.post(
    '/alias-domains/{aliasDomain}/spam-policy-entries',
    async ({ request, params, response }) =>
      response.untyped(await createHandler('aliasDomain')(request, params.aliasDomain)),
  ),
  http.get('/alias-domains/{aliasDomain}/spam-policy-entries/{entryId}', ({ params, response }) =>
    response.untyped(getHandler('aliasDomain')(params.aliasDomain, params.entryId)),
  ),
  http.delete(
    '/alias-domains/{aliasDomain}/spam-policy-entries/{entryId}',
    ({ request, params, response }) =>
      response.untyped(deleteHandler('aliasDomain')(request, params.aliasDomain, params.entryId)),
  ),
  http.get('/mailboxes/{mailbox}/spam-policy-entries', ({ request, params, response }) =>
    response.untyped(listHandler('mailbox')(request, params.mailbox)),
  ),
  http.post('/mailboxes/{mailbox}/spam-policy-entries', async ({ request, params, response }) =>
    response.untyped(await createHandler('mailbox')(request, params.mailbox)),
  ),
  http.get('/mailboxes/{mailbox}/spam-policy-entries/{entryId}', ({ params, response }) =>
    response.untyped(getHandler('mailbox')(params.mailbox, params.entryId)),
  ),
  http.delete(
    '/mailboxes/{mailbox}/spam-policy-entries/{entryId}',
    ({ request, params, response }) =>
      response.untyped(deleteHandler('mailbox')(request, params.mailbox, params.entryId)),
  ),
]
