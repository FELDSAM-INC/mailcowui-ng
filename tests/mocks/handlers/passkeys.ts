// Own passkey handlers (T101): the list with sort, order, search and paging, registration options
// that exclude the account's credentials, registration (a duplicate credential or a stale challenge
// is `passkey-registration-failed`; a pending second-factor setup lifts), rename and removal with
// `If-Match` and 412. In a restricted session only a sole `secondFactorSetup` allows registering
// (T110 relies on it).
import { createHash } from 'node:crypto'

import type { PasskeyPatch, PasskeyRegistrationRequest, Writable } from '@/api'

import { toPasskey } from '../factories/passkey'
import {
  challengeOf,
  CHALLENGE_LIFETIME_MS,
  creationOptions,
  credentialIdFromRegistration,
} from '../factories/webauthn'
import type { MockAccount, MockPasskey, ScenarioState } from '../scenarios/state'
import { csrfProblem, http, problem, requireAccount, scenario } from './context'

let version = 0
const nextEtag = () => `"pk-v${++version}"`

/** Registration is allowed in a restricted session only while second-factor setup is all that is pending. */
function registrationAccount(state: ScenarioState): MockAccount | Response {
  const account = requireAccount(state, { allowRestricted: true })
  if (account instanceof Response) return account
  if (
    state.session.state === 'restricted' &&
    !(account.pendingActions.length === 1 && account.pendingActions[0] === 'secondFactorSetup')
  ) {
    return problem(403, 'pending-action-required', { pendingActions: account.pendingActions })
  }
  return account
}

function invalidName(name: string | undefined): Response | null {
  if (name === undefined) return null
  if (name.trim().length === 0) {
    return problem(422, 'validation-failed', {
      errors: { name: [{ code: 'required', message: 'The name is required.' }] },
    })
  }
  return null
}

function findPasskey(account: MockAccount, id: string): MockPasskey | undefined {
  return account.passkeys.find((passkey) => passkey.id === id)
}

export const passkeyHandlers = [
  http.get('/me/passkeys', ({ query, response }) => {
    const state = scenario()
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    const limit = Number(query.get('limit') ?? 25)
    const offset = Number(query.get('offset') ?? 0)
    const sort = query.get('sort') ?? 'registeredAt'
    const order = query.get('order') ?? 'asc'
    const q = (query.get('q') ?? '').trim().toLowerCase()
    const items = account.passkeys
      .filter((passkey) =>
        q
          ? [passkey.name, passkey.authenticatorDescription].some((value) =>
              value?.toLowerCase().includes(q),
            )
          : true,
      )
      .sort((a, b) => {
        const left = sort === 'name' ? (a.name ?? '') : a.registeredAt
        const right = sort === 'name' ? (b.name ?? '') : b.registeredAt
        return (left < right ? -1 : left > right ? 1 : 0) * (order === 'desc' ? -1 : 1)
      })
    return response(200).json({
      data: items.slice(offset, offset + limit).map(toPasskey),
      meta: { total: items.length, limit, offset },
    })
  }),

  http.post('/me/passkeys/registration-options', ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = registrationAccount(state)
    if (account instanceof Response) return response.untyped(account)
    const publicKey = creationOptions({
      username: account.username,
      excludeCredentials: account.passkeys.map((passkey) => passkey.credentialId),
    })
    const expiresAt = new Date(state.now() + CHALLENGE_LIFETIME_MS).toISOString()
    state.session.registrationChallenge = { challenge: publicKey.challenge, expiresAt }
    return response(200).json({ data: { publicKey, expiresAt } })
  }),

  http.post('/me/passkeys', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = registrationAccount(state)
    if (account instanceof Response) return response.untyped(account)
    const body = (await request.json()) as unknown as Writable<PasskeyRegistrationRequest>
    const nameProblem = invalidName(body.name)
    if (nameProblem) return response.untyped(nameProblem)

    const challenge = state.session.registrationChallenge
    state.session.registrationChallenge = null
    let credentialId: string
    try {
      credentialId = credentialIdFromRegistration(body.credential)
    } catch {
      return response.untyped(problem(400, 'passkey-registration-failed'))
    }
    if (
      !challenge ||
      new Date(challenge.expiresAt).getTime() <= state.now() ||
      challengeOf(body.credential.response.clientDataJSON) !== challenge.challenge ||
      state.accounts.some((other) => other.passkeys.some((p) => p.credentialId === credentialId))
    ) {
      return response.untyped(problem(400, 'passkey-registration-failed'))
    }
    const created: MockPasskey = {
      id: createHash('sha256').update(Buffer.from(credentialId, 'base64url')).digest('hex'),
      name: body.name?.trim() ?? null,
      authenticatorDescription: null,
      registeredAt: new Date(state.now()).toISOString(),
      hostName: new URL(request.url).hostname,
      active: true,
      etag: nextEtag(),
      credentialId,
    }
    account.passkeys.push(created)
    // A passkey is a second factor: a pending second-factor setup lifts (FR-039).
    account.pendingActions = account.pendingActions.filter(
      (action) => action !== 'secondFactorSetup',
    )
    return response(201).json(
      { data: toPasskey(created) },
      { headers: { Location: `/api/v2/me/passkeys/${created.id}`, ETag: created.etag } },
    )
  }),

  http.patch('/me/passkeys/{passkeyId}', async ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    const passkey = findPasskey(account, params.passkeyId)
    if (!passkey) return response.untyped(problem(404, null))
    const ifMatch = request.headers.get('if-match')
    if (ifMatch && ifMatch !== '*' && ifMatch !== passkey.etag) {
      return response.untyped(problem(412, null))
    }
    const body = (await request.json()) as unknown as Writable<PasskeyPatch>
    const nameProblem = invalidName(body.name)
    if (nameProblem) return response.untyped(nameProblem)
    passkey.name = body.name.trim()
    passkey.etag = nextEtag()
    return response(200).json({ data: toPasskey(passkey) }, { headers: { ETag: passkey.etag } })
  }),

  http.delete('/me/passkeys/{passkeyId}', ({ params, request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAccount(state)
    if (account instanceof Response) return response.untyped(account)
    const passkey = findPasskey(account, params.passkeyId)
    if (!passkey) return response.untyped(problem(404, null))
    const ifMatch = request.headers.get('if-match')
    if (ifMatch && ifMatch !== '*' && ifMatch !== passkey.etag) {
      return response.untyped(problem(412, null))
    }
    account.passkeys = account.passkeys.filter((other) => other !== passkey)
    return response(204).empty()
  }),
]
