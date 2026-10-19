// Scenarios of US3 (T060): the recovery address and the password reset before sign-in. The reset
// tokens are fixed so that tests open their links: carl has no second factor, alice has TOTP (the
// mock accepts 123456), dora only a deprecated U2F key.
import type { ScenarioDefinition } from '../index'
import { mailboxAccount } from '../accounts'
import type { ScenarioState } from '../state'
import { accountSelfService, ensureMailbox, type MockResetToken } from './state'
import { ANNA, seedAnna, userFlags } from './seed'

export const RESET_TOKENS = {
  plain: '3F9A1C-0B7E22-9D4F10-A6C3E8-51B2D7',
  totp: '7B21D0-55AE19-C0FFEE-12AB34-9E8D7C',
  expired: '000000-EXPIRED-000000-000000-000000',
  used: '111111-USED00-111111-111111-111111',
  unsupported: '222222-U2FONLY-222222-222222-22222',
  anna: '333333-ANNA00-333333-333333-333333',
} as const

function seedReset(state: ScenarioState): void {
  ensureMailbox(state, 'carl@example.org', {
    displayName: 'Carl',
    recoveryEmail: 'carl@example.net',
  })
  ensureMailbox(state, 'alice@example.org', { displayName: 'Alice' })
  ensureMailbox(state, 'dora@example.org', { displayName: 'Dora' })
  state.accounts.push(mailboxAccount({ username: 'carl@example.org' }))
  state.accounts.push(mailboxAccount({ username: 'dora@example.org' }))
  accountSelfService(state, 'dora@example.org').extraFactors = [
    { id: 41, type: 'u2f', name: 'Old key', active: true },
  ]
  const now = state.now()
  const token = (
    value: string,
    username: string,
    minutes: number,
    used = false,
  ): MockResetToken => ({
    token: value,
    username,
    expiresAt: now + minutes * 60_000,
    used,
  })
  state.selfService.resetTokens = [
    token(RESET_TOKENS.plain, 'carl@example.org', 15),
    token(RESET_TOKENS.totp, 'alice@example.org', 15),
    token(RESET_TOKENS.expired, 'carl@example.org', -1),
    token(RESET_TOKENS.used, 'carl@example.org', 15, true),
    token(RESET_TOKENS.unsupported, 'dora@example.org', 15),
  ]
}

export const passwordResetScenarios: Record<string, ScenarioDefinition> = {
  'account-password-reset': {
    description:
      'Signed out; reset tokens for carl (no second factor), alice (TOTP), dora (U2F only), and an expired and a used one.',
    setup: seedReset,
  },
  'account-password-reset-unavailable': {
    description: 'Signed out; the operator has not set up the reset message.',
    setup: seedReset,
    overrides: { selfService: { passwordResetAvailable: false } },
  },
  'account-password-reset-throttled': {
    description: 'Signed out; reset requests and completions answer 429.',
    setup: seedReset,
    overrides: {
      failures: {
        requestPasswordReset: { status: 429, type: 'too-many-requests', retryAfter: 90 },
        completePasswordReset: { status: 429, type: 'too-many-requests', retryAfter: 90 },
      },
    },
  },
  'account-password-reset-signed-in': {
    description: 'anna@example.org is signed in and opens a reset link for her own account.',
    setup: (state) => {
      seedReset(state)
      seedAnna(state)
      const anna = state.accounts.find((account) => account.username === ANNA)!
      anna.secondFactors = []
      state.selfService.resetTokens.push({
        token: RESET_TOKENS.anna,
        username: ANNA,
        expiresAt: state.now() + 15 * 60_000,
        used: false,
      })
    },
    overrides: { signedInAs: ANNA },
  },
  'account-mailbox-no-pw-reset': {
    description:
      'anna@example.org without the pwReset flag; an administrator set her recovery address.',
    setup: (state) => seedAnna(state, { flags: { ...userFlags(true), pwReset: false } }),
    overrides: { signedInAs: ANNA, session: { authMethod: 'passwordAndSecondFactor' } },
  },
}
