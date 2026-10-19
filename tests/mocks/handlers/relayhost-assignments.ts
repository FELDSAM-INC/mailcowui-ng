// Relayhost assignment handlers (UI 009 T039, research R23): the domain's and the mailbox's
// assignment with `RelayhostReference` states, the mailbox's effective relayhost and credentials
// relayhost by the contract's rules, the domain administrator's scope (404 outside it and for
// alias domains), the permission flag checked before the lookup, `422 notFound` for an unknown
// relayhost, and `If-Match`. A change also changes the domain's or mailbox's version tag.
import type {
  DomainRelayhostAssignment,
  MailboxRelayhostAssignment,
  RelayhostReference,
} from '@/api'

import { asciiName } from '../factories/domain'
import { routingEtag } from '../factories/routing-etag'
import type { MockAccount, MockDomain, MockMailbox, ScenarioState } from '../scenarios/state'
import { csrfProblem, http, scenario } from './context'
import { addViolation, notFound, validationFailed, type Violations } from './domain-rules'
import {
  flagProblem,
  ifMatchProblem,
  nowIso,
  requireRoutingManager,
  scopeDomains,
} from './routing-rules'

function reference(state: ScenarioState, id: number | null): RelayhostReference | null {
  if (id === null) return null
  const relayhost = state.routing.relayhosts.find((item) => item.id === id)
  if (!relayhost) return { id, host: null, state: 'dangling' }
  return { id, host: relayhost.host, state: relayhost.active ? 'active' : 'inactive' }
}

function findDomain(
  state: ScenarioState,
  account: MockAccount,
  raw: string,
): MockDomain | undefined {
  const name = asciiName(raw)
  if (!scopeDomains(state, account).includes(name)) return undefined
  return state.domains.find((domain) => domain.name === name)
}

function findMailbox(
  state: ScenarioState,
  account: MockAccount,
  raw: string,
): MockMailbox | undefined {
  const at = raw.lastIndexOf('@')
  if (at < 1) return undefined
  const local = raw.slice(0, at).toLowerCase()
  const domain = asciiName(raw.slice(at + 1))
  if (!scopeDomains(state, account).includes(domain)) return undefined
  return state.mailboxes.find((mailbox) => mailbox.localPart === local && mailbox.domain === domain)
}

export function domainAssignment(
  state: ScenarioState,
  domain: MockDomain,
): DomainRelayhostAssignment {
  const id = domain.relayhost?.id ?? null
  return {
    domain: domain.name,
    relayhost: reference(state, id),
    etag: routingEtag('d', { domain: domain.name, id }),
  }
}

export function mailboxAssignment(
  state: ScenarioState,
  mailbox: MockMailbox,
): MailboxRelayhostAssignment {
  const domain = state.domains.find((item) => item.name === mailbox.domain)
  const own = reference(state, mailbox.relayhostId)
  const ofDomain = reference(state, domain?.relayhost?.id ?? null)
  const effective =
    own?.state === 'active'
      ? { id: own.id, host: own.host!, source: 'mailbox' as const }
      : ofDomain?.state === 'active'
        ? { id: ofDomain.id, host: ofDomain.host!, source: 'domain' as const }
        : null
  // mailcow's mail server looks up the domain's active relayhost's credentials first.
  const relayhostOf = (ref: RelayhostReference | null) =>
    ref?.state === 'active'
      ? state.routing.relayhosts.find((item) => item.id === ref.id)
      : undefined
  const domainRelayhost = relayhostOf(ofDomain)
  const mailboxRelayhost = relayhostOf(own)
  const credentials = domainRelayhost
    ? domainRelayhost.username
      ? { id: domainRelayhost.id, source: 'domain' as const }
      : null
    : mailboxRelayhost?.username
      ? { id: mailboxRelayhost.id, source: 'mailbox' as const }
      : null
  return {
    mailbox: `${mailbox.localPart}@${mailbox.domain}`,
    domain: mailbox.domain,
    relayhost: own,
    domainRelayhost: ofDomain,
    effectiveRelayhost: effective,
    credentialsRelayhost: credentials,
    etag: routingEtag('a', {
      mailbox: `${mailbox.localPart}@${mailbox.domain}`,
      id: mailbox.relayhostId,
    }),
  }
}

function checkRelayhostId(state: ScenarioState, id: number | null): Response | null {
  if (id === null || state.routing.relayhosts.some((item) => item.id === id)) return null
  const errors: Violations = {}
  addViolation(errors, 'relayhostId', 'notFound')
  return validationFailed(errors)
}

export const relayhostAssignmentHandlers = [
  http.get('/domains/{domain}/relayhost-assignment', ({ params, response }) => {
    const state = scenario()
    const account = requireRoutingManager(state)
    if (account instanceof Response) return response.untyped(account)
    const domain = findDomain(state, account, String(params.domain))
    if (!domain) return response.untyped(notFound())
    const data = domainAssignment(state, domain)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.put('/domains/{domain}/relayhost-assignment', async ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingManager(state)
    if (account instanceof Response) return response.untyped(account)
    const missing = flagProblem(account, ['domainRelayhost'])
    if (missing) return response.untyped(missing)
    const domain = findDomain(state, account, String(params.domain))
    if (!domain) return response.untyped(notFound())
    const stale = ifMatchProblem(request, domainAssignment(state, domain).etag)
    if (stale) return response.untyped(stale)
    const body = await request.json()
    const invalid = checkRelayhostId(state, body.relayhostId)
    if (invalid) return response.untyped(invalid)
    const relayhost = state.routing.relayhosts.find((item) => item.id === body.relayhostId)
    domain.relayhost =
      body.relayhostId === null ? null : { id: body.relayhostId, hostname: relayhost?.host ?? null }
    domain.modifiedAt = nowIso(state)
    const data = domainAssignment(state, domain)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.get('/mailboxes/{mailbox}/relayhost-assignment', ({ params, response }) => {
    const state = scenario()
    const account = requireRoutingManager(state)
    if (account instanceof Response) return response.untyped(account)
    const mailbox = findMailbox(state, account, String(params.mailbox))
    if (!mailbox) return response.untyped(notFound())
    const data = mailboxAssignment(state, mailbox)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.put('/mailboxes/{mailbox}/relayhost-assignment', async ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireRoutingManager(state)
    if (account instanceof Response) return response.untyped(account)
    const missing = flagProblem(account, ['mailboxRelayhost'])
    if (missing) return response.untyped(missing)
    const mailbox = findMailbox(state, account, String(params.mailbox))
    if (!mailbox) return response.untyped(notFound())
    const stale = ifMatchProblem(request, mailboxAssignment(state, mailbox).etag)
    if (stale) return response.untyped(stale)
    const body = await request.json()
    const invalid = checkRelayhostId(state, body.relayhostId)
    if (invalid) return response.untyped(invalid)
    mailbox.relayhostId = body.relayhostId
    mailbox.modifiedAt = nowIso(state)
    const data = mailboxAssignment(state, mailbox)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),
]
