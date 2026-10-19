// The own second factors (UI 005 T047, research R9 to R11): the list (sort, search, paging), the
// TOTP enrolment (a 32-character base32 secret, five attempts, ten minutes; a new start replaces
// the old one; codes checked with tests/support/totp.ts, ±1 step), WebAuthn options that exclude
// the account's WebAuthn factors, the enrolment of the three methods (the current password unless
// restricted by `secondFactorSetup`; the same Yubico key replaces its entry), the removal of one
// entry (`last-second-factor`, `second-factor-required-by-policy`) and of all. Every list and
// enrolment is allowed in a session restricted by `secondFactorSetup` (API 005's route mode
// `includes,secondFactorSetup`); an enrolment lifts that restriction.
import { randomBytes } from 'node:crypto'

import type { OwnSecondFactorEnrolmentRequest, Writable } from '@/api'

import { verifyTotp } from '../../../support/totp'
import { qrDataUri } from '../../factories/qr-svg'
import { hasActiveSecondFactor, ownSecondFactors } from '../../factories/second-factor'
import {
  CHALLENGE_LIFETIME_MS,
  challengeOf,
  creationOptions,
  credentialIdFromRegistration,
} from '../../factories/webauthn'
import { accountSelfService } from '../../scenarios/self-service/state'
import type { MockAccount, ScenarioState } from '../../scenarios/state'
import { csrfProblem, http, problem, requireAccount, scenario } from '../context'
import {
  addViolation,
  compareValues,
  page,
  validationFailed,
  type Violations,
} from '../domain-rules'
import { checkCurrentPassword, managedExternally } from './own-account'

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const ENROLMENT_SECONDS = 600
const MAX_ATTEMPTS = 5

function base32Secret(): string {
  return [...randomBytes(32)].map((byte) => BASE32[byte % 32]).join('')
}

/** The account, or the refusal: external sources manage no second factors here. */
function owner(state: ScenarioState): MockAccount | Response {
  const account = requireAccount(state, { allowRestricted: 'secondFactorSetup' })
  if (account instanceof Response) return account
  if (managedExternally(account)) return problem(403, 'password-managed-externally')
  return account
}

function nextFactorId(state: ScenarioState): number {
  state.selfService.nextFactorId += 1
  return state.selfService.nextFactorId
}

function enrolled(state: ScenarioState, account: MockAccount, id: number) {
  account.pendingActions = account.pendingActions.filter((action) => action !== 'secondFactorSetup')
  if (state.session.state === 'restricted' && account.pendingActions.length === 0) {
    state.session.state = 'active'
  }
  const entry = ownSecondFactors(state, account).find((item) => item.id === id)!
  return entry
}

export const secondFactorHandlers = [
  http.get('/me/second-factors', ({ request, response }) => {
    const state = scenario()
    const account = owner(state)
    if (account instanceof Response) return response.untyped(account)
    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.toLowerCase() ?? ''
    const sort = (url.searchParams.get('sort') ?? 'id') as 'id' | 'type' | 'name'
    const desc = url.searchParams.get('order') === 'desc'
    const items = ownSecondFactors(state, account)
      .filter((item) => !q || item.name.toLowerCase().includes(q))
      .sort((a, b) => compareValues(a[sort], b[sort]) * (desc ? -1 : 1) || a.id - b.id)
    return response(200).json(page(items, url))
  }),

  http.post('/me/second-factors/totp-enrolment', ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = owner(state)
    if (account instanceof Response) return response.untyped(account)
    const secret = base32Secret()
    const expiresAt = state.now() + ENROLMENT_SECONDS * 1000
    accountSelfService(state, account.username).totpEnrolment = {
      secret,
      expiresAt,
      attemptsLeft: MAX_ATTEMPTS,
    }
    const issuer = 'mailcow UI'
    const label = encodeURIComponent(account.username)
    const provisioningUri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&period=30&algorithm=SHA1&digits=6`
    return response(200).json({
      data: {
        secret,
        provisioningUri,
        qrCode: qrDataUri(provisioningUri),
        issuer,
        digits: 6,
        period: 30,
        algorithm: 'SHA1',
        expiresAt: new Date(expiresAt).toISOString(),
      },
    })
  }),

  http.post('/me/second-factors/webauthn-registration-options', ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = owner(state)
    if (account instanceof Response) return response.untyped(account)
    const record = accountSelfService(state, account.username)
    const publicKey = creationOptions({
      username: account.username,
      excludeCredentials: Object.values(record.webauthnCredentialIds),
    })
    const expiresAt = state.now() + CHALLENGE_LIFETIME_MS
    record.webauthnOptions = { challenge: publicKey.challenge, expiresAt }
    return response(200).json({ data: { publicKey, expiresAt: new Date(expiresAt).toISOString() } })
  }),

  http.post('/me/second-factors', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = owner(state)
    if (account instanceof Response) return response.untyped(account)
    const body = (await request.json()) as unknown as Writable<OwnSecondFactorEnrolmentRequest> & {
      currentPassword?: string
      name: string
      type: string
    }
    const errors: Violations = {}
    const name = body.name.trim()
    if (!name) addViolation(errors, 'name', 'required')
    else if (name.length > 255) addViolation(errors, 'name', 'tooLong', { max: 255 })
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    if (state.session.state !== 'restricted') {
      const wrong = checkCurrentPassword(state, account, body.currentPassword)
      if (wrong) return response.untyped(wrong)
    }
    const record = accountSelfService(state, account.username)

    if (body.type === 'totp') {
      const enrolment = record.totpEnrolment
      if (!enrolment || enrolment.expiresAt <= state.now()) {
        record.totpEnrolment = null
        return response.untyped(problem(400, 'second-factor-enrolment-expired'))
      }
      const code = (body as { code: string }).code
      if (!verifyTotp(enrolment.secret, code, state.now())) {
        enrolment.attemptsLeft -= 1
        const attemptsRemaining = enrolment.attemptsLeft
        if (attemptsRemaining <= 0) record.totpEnrolment = null
        return response.untyped(
          problem(400, 'second-factor-enrolment-failed', { attemptsRemaining }),
        )
      }
      record.totpEnrolment = null
      const id = nextFactorId(state)
      account.secondFactors.push({ id, type: 'totp', name, tier: 'primary', secret: '123456' })
      const data = enrolled(state, account, id)
      return response(201).json(
        { data },
        { headers: { Location: `/api/v2/me/second-factors/${id}` } },
      )
    }

    if (body.type === 'webauthn') {
      const options = record.webauthnOptions
      record.webauthnOptions = null
      const credential = (
        body as { credential: Parameters<typeof credentialIdFromRegistration>[0] }
      ).credential
      let credentialId: string
      try {
        credentialId = credentialIdFromRegistration(credential)
      } catch {
        return response.untyped(problem(400, 'second-factor-enrolment-failed'))
      }
      if (!options || options.expiresAt <= state.now()) {
        return response.untyped(problem(400, 'second-factor-enrolment-expired'))
      }
      if (challengeOf(credential.response.clientDataJSON) !== options.challenge) {
        return response.untyped(problem(400, 'second-factor-enrolment-failed'))
      }
      const id = nextFactorId(state)
      account.secondFactors.push({ id, type: 'webauthn', name, tier: 'primary', secret: '' })
      record.webauthnCredentialIds[id] = credentialId
      const data = enrolled(state, account, id)
      return response(201).json(
        { data },
        { headers: { Location: `/api/v2/me/second-factors/${id}` } },
      )
    }

    // Yubico OTP
    if (state.selfService.yubicoOutage) {
      return response.untyped(
        problem(503, 'temporary-verification-failure', {}, { 'Retry-After': '30' }),
      )
    }
    if (state.selfService.yubicoRejects) {
      return response.untyped(problem(400, 'second-factor-enrolment-failed'))
    }
    const otp = (body as { otp: string }).otp
    const publicId = otp.slice(0, 12).toLowerCase()
    const existing = Object.entries(record.yubicoPublicIds).find(([, value]) => value === publicId)
    if (existing) {
      account.secondFactors = account.secondFactors.filter(
        (item) => item.id !== Number(existing[0]),
      )
      delete record.yubicoPublicIds[Number(existing[0])]
    }
    const id = nextFactorId(state)
    account.secondFactors.push({ id, type: 'yubiOtp', name, tier: 'advanced', secret: otp })
    record.yubicoPublicIds[id] = /^[a-z]{12}$/.test(publicId) ? publicId : 'cccccbcgujhi'
    const data = enrolled(state, account, id)
    return response(201).json(
      { data },
      { headers: { Location: `/api/v2/me/second-factors/${id}` } },
    )
  }),

  http.delete('/me/second-factors/{secondFactorId}', ({ request, params, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = owner(state)
    if (account instanceof Response) return response.untyped(account)
    const id = Number(params.secondFactorId)
    const record = accountSelfService(state, account.username)
    const entries = ownSecondFactors(state, account)
    const entry = entries.find((item) => item.id === id)
    if (!entry) return response.untyped(problem(404, null))
    const counting = entries.filter((item) => item.active && item.usable)
    if (entry.active && entry.usable) {
      if (record.secondFactorRequired) {
        return response.untyped(problem(403, 'second-factor-required-by-policy'))
      }
      if (counting.length === 1) return response.untyped(problem(409, 'last-second-factor'))
    }
    account.secondFactors = account.secondFactors.filter((item) => item.id !== id)
    record.extraFactors = record.extraFactors.filter((item) => item.id !== id)
    delete record.webauthnCredentialIds[id]
    delete record.yubicoPublicIds[id]
    return response(204).empty()
  }),

  http.post('/me/second-factors/removal', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = owner(state)
    if (account instanceof Response) return response.untyped(account)
    const body = (await request.json()) as unknown as { currentPassword?: string }
    const wrong = checkCurrentPassword(state, account, body.currentPassword)
    if (wrong) return response.untyped(wrong)
    const record = accountSelfService(state, account.username)
    if (record.secondFactorRequired && hasActiveSecondFactor(state, account)) {
      return response.untyped(problem(403, 'second-factor-required-by-policy'))
    }
    account.secondFactors = []
    record.extraFactors = []
    record.webauthnCredentialIds = {}
    record.yubicoPublicIds = {}
    return response(204).empty()
  }),
]
