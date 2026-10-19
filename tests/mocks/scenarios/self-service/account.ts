// Base scenarios of UI 005 (T013): one signed-in account per role, with and without the flags of
// FR-002 and FR-004, an externally managed password, groupware off and an unreadable capabilities
// read. anna@example.org is the mailbox user of the spec's examples.
import type { ScenarioDefinition } from '../index'
import { permissionFlags } from '../accounts'
import { accountSelfService, ensureMailbox } from './state'
import { ANNA, seedAnna, userFlags } from './seed'

export const accountScenarios: Record<string, ScenarioDefinition> = {
  'account-mailbox': {
    description:
      'anna@example.org signed in (mailcow source, every user flag, TOTP and security key, three app passwords, aliases, recent logins, 1 GiB quota with 256 MiB used, webmail on).',
    setup: (state) => seedAnna(state),
    overrides: { signedInAs: ANNA, session: { authMethod: 'passwordAndSecondFactor' } },
  },
  'account-mailbox-no-flags': {
    description: 'anna@example.org signed in with every user flag of FR-002 off.',
    setup: (state) => seedAnna(state, { flags: userFlags(false) }),
    overrides: { signedInAs: ANNA, session: { authMethod: 'passwordAndSecondFactor' } },
  },
  'account-external-source': {
    description:
      'anna@example.org signed in with a passkey; her password lives in Keycloak (no password change, no second-factor management).',
    setup: (state) => {
      seedAnna(state)
      ensureMailbox(state, ANNA, { authSource: 'keycloak', recoveryEmail: null })
      const anna = state.accounts.find((account) => account.username === ANNA)!
      anna.source = 'keycloak'
      anna.secondFactors = []
      accountSelfService(state, ANNA).signInFactorId = null
    },
    overrides: { signedInAs: ANNA, session: { authMethod: 'passkey' } },
  },
  'account-domain-admin': {
    description:
      'reseller signed in with two other sessions, a policy of 10 characters with digits, and the appPasswds, pushover and filters flags.',
    setup: (state) => {
      seedAnna(state)
      accountSelfService(state, 'reseller').otherSessions = 2
    },
    overrides: {
      signedInAs: 'reseller',
      passwordPolicy: { minLength: 10, requireDigits: true },
    },
  },
  'account-domain-admin-no-flags': {
    description: 'reseller signed in without the appPasswds, pushover and filters flags.',
    setup: (state) => {
      seedAnna(state)
      accountSelfService(state, 'reseller').otherSessions = 2
    },
    overrides: {
      signedInAs: 'reseller',
      passwordPolicy: { minLength: 10, requireDigits: true },
      accounts: {
        reseller: {
          permissions: permissionFlags(true, {
            syncjobs: true,
            bccMaps: false,
            loginAs: false,
            appPasswds: false,
            pushover: false,
            filters: false,
          }),
        },
      },
    },
  },
  'account-admin': {
    description: 'admin signed in; anna@example.org is in scope for the mailbox context.',
    setup: (state) => seedAnna(state),
    overrides: { signedInAs: 'admin' },
  },
  'account-groupware-disabled': {
    description: 'anna@example.org signed in on a server without the groupware (SKIP_SOGO).',
    setup: (state) => seedAnna(state),
    overrides: { signedInAs: ANNA, selfService: { groupwareEnabled: false } },
  },
  'account-capabilities-unavailable': {
    description:
      'anna@example.org signed in; GET /capabilities/self-service answers its documented 500.',
    setup: (state) => seedAnna(state),
    overrides: {
      signedInAs: ANNA,
      failures: { getSelfServiceCapabilities: { status: 500 } },
    },
  },
}
