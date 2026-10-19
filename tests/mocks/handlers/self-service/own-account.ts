// The own account's password (UI 005 T038, research R7, R8) and, from US3, the recovery address:
// the policy and the change, readable and allowed in a session restricted by `passwordChange`
// (API 005's route mode `includes,passwordChange`). The current password is checked except in that
// session; ten wrong ones answer 429. The new password follows the policy (`tooShort`,
// `missingCharacterClass`) and must not be pre-hashed. Other sessions end by default and are
// counted; a success lifts the forced change.
import type { OwnPasswordChangeRequest, Writable } from '@/api'

import { passwordPolicyView, passwordViolations } from '../../factories/password-policy'
import { mailboxSelfService, accountSelfService } from '../../scenarios/self-service/state'
import type { MockAccount, ScenarioState } from '../../scenarios/state'
import { csrfProblem, http, problem, requireAccount, scenario } from '../context'
import { addViolation, validationFailed, type Violations } from '../domain-rules'
import { isPreHashed } from '../mailbox-rules'
import { isoNow } from './rules'

const MAX_FAILURES = 10

/** Whether the account's password lives in an external identity provider. */
export function managedExternally(account: MockAccount): boolean {
  return account.external || (account.source !== undefined && account.source !== 'mailcow')
}

/** 429 after ten wrong current passwords, or 403 current-password-incorrect (counted). */
export function checkCurrentPassword(
  state: ScenarioState,
  account: MockAccount,
  current: string | undefined,
): Response | null {
  const record = accountSelfService(state, account.username)
  if (record.passwordFailures >= MAX_FAILURES) {
    const retryAfter = state.behaviour.retryAfter
    return problem(429, 'too-many-requests', { retryAfter }, { 'Retry-After': String(retryAfter) })
  }
  if (current === account.password) {
    record.passwordFailures = 0
    return null
  }
  record.passwordFailures += 1
  return problem(403, 'current-password-incorrect')
}

export const ownAccountHandlers = [
  http.get('/me/password-policy', ({ response }) => {
    const state = scenario()
    const account = requireAccount(state, { allowRestricted: 'passwordChange' })
    if (account instanceof Response) return response.untyped(account)
    const data = passwordPolicyView(state.passwordPolicy)
    return response(200).json({ data }, { headers: { ETag: data.etag } })
  }),

  http.put('/me/password', async ({ request, response }) => {
    const state = scenario()
    const refused = csrfProblem(state, request)
    if (refused) return response.untyped(refused)
    const account = requireAccount(state, { allowRestricted: 'passwordChange' })
    if (account instanceof Response) return response.untyped(account)
    if (managedExternally(account)) {
      return response.untyped(problem(403, 'password-managed-externally'))
    }
    const body = (await request.json()) as unknown as Writable<OwnPasswordChangeRequest>
    const forced = state.session.state === 'restricted'
    if (!forced) {
      if (!body.currentPassword) {
        const errors: Violations = {}
        addViolation(errors, 'currentPassword', 'required')
        return response.untyped(validationFailed(errors))
      }
      const wrong = checkCurrentPassword(state, account, body.currentPassword)
      if (wrong) return response.untyped(wrong)
    }
    const errors: Violations = {}
    const scheme = /^\{([^}]+)\}/.exec(body.newPassword)?.[1]
    if (scheme && isPreHashed(state, body.newPassword)) {
      addViolation(errors, 'newPassword', 'preHashedPassword', { scheme: scheme.toUpperCase() })
    } else {
      for (const item of passwordViolations(state.passwordPolicy, body.newPassword)) {
        addViolation(errors, 'newPassword', item.code, item.params)
      }
    }
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))

    account.password = body.newPassword
    account.pendingActions = account.pendingActions.filter((action) => action !== 'passwordChange')
    const record = accountSelfService(state, account.username)
    const sessionsEnded = body.endOtherSessions === false ? 0 : record.otherSessions
    record.otherSessions -= sessionsEnded
    let activeAppPasswords = 0
    if (account.role === 'mailboxUser') {
      const mailbox = state.mailboxes.find(
        (item) => `${item.localPart}@${item.domain}` === account.username.toLowerCase(),
      )
      if (mailbox) {
        mailbox.passwordChangedAt = isoNow(state)
        mailbox.forcePasswordChange = false
      }
      activeAppPasswords = mailboxSelfService(state, account.username).appPasswords.filter(
        (item) => item.active,
      ).length
    }
    if (state.session.state === 'restricted' && account.pendingActions.length === 0) {
      state.session.state = 'active'
    }
    return response(200).json({
      data: { sessionsEnded, activeAppPasswords, mailServerCacheSeconds: 300 },
    })
  }),
]
