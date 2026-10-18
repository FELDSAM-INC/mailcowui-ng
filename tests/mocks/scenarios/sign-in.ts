// Scenarios of US1 (T066): password sign-in, the second-factor step, throttling, the idle
// timeout, the login page options and the anti-forgery retry. Every account signs in with
// MOCK_PASSWORD; TOTP methods accept their `secret` as the code (see accounts.ts).
import type { ScenarioDefinition } from './index'
import { securityKey, totp, yubiOtp } from './accounts'

const LOGIN_PAGE = {
  hideAdminLogin: false,
  hideDomainAdminLogin: false,
  hideMailboxUserLogin: false,
  forceSingleSignOn: false,
}

export const signInScenarios: Record<string, ScenarioDefinition> = {
  'admin-password': {
    description: 'Signed out; admin signs in with a password and no second factor.',
  },
  'domain-admin-password': {
    description: 'Signed out; reseller (domain administrator) signs in with a password.',
  },
  'mailbox-password': {
    description: 'Signed out; alice@example.org signs in with a password and no second factor.',
    overrides: { accounts: { 'alice@example.org': { secondFactors: [] } } },
  },
  'mailbox-all-factors': {
    description:
      'alice@example.org has a security key, an authenticator app (code 123456) and a Yubico OTP key.',
    overrides: {
      accounts: {
        'alice@example.org': {
          secondFactors: [
            yubiOtp(13, 'YubiKey 5C'),
            totp(12, 'Phone'),
            securityKey(11, 'Desk key'),
          ],
        },
      },
    },
  },
  'totp-two-methods': {
    description:
      'alice@example.org has two authenticator apps: Phone (123456) and Tablet (654321).',
    overrides: {
      accounts: {
        'alice@example.org': { secondFactors: [totp(21, 'Phone'), totp(22, 'Tablet', '654321')] },
      },
    },
  },
  'yubi-only': {
    description: 'alice@example.org has only a Yubico OTP key (an advanced method).',
    overrides: { accounts: { 'alice@example.org': { secondFactors: [yubiOtp(31, 'YubiKey')] } } },
  },
  'u2f-only': {
    description: "alice@example.org's only second factors are deprecated U2F entries.",
    overrides: {
      accounts: { 'alice@example.org': { secondFactors: [], secondFactorsUnavailable: true } },
    },
  },
  throttled: {
    description: 'Every sign-in attempt is refused as too many requests (retry after 90 s).',
    overrides: { behaviour: { throttleThreshold: 0, retryAfter: 90 } },
  },
  'slow-sign-in': {
    description: 'Sign-in answers are delayed by 1.5 s, as after failed attempts.',
    overrides: { behaviour: { signInDelayMs: 1500 } },
  },
  'yubico-outage': {
    description:
      'alice@example.org has a security key, an authenticator app and a Yubico OTP key; the Yubico service is unreachable.',
    overrides: {
      behaviour: { yubicoOutage: true },
      accounts: {
        'alice@example.org': {
          secondFactors: [securityKey(41, 'Desk key'), totp(42, 'Phone'), yubiOtp(43, 'YubiKey')],
        },
      },
    },
  },
  'short-idle': {
    description: 'admin is signed in and the idle lifetime is 150 s (the warning after 30 s).',
    overrides: { signedInAs: 'admin', idleTimeout: 150 },
  },
  'force-sso': {
    description: 'The operator forces single sign-on.',
    overrides: { publicConfig: 'force-sso' },
  },
  'hidden-admin-link': {
    description: 'The operator hides the administrator login link.',
    overrides: { publicConfig: { loginPage: { ...LOGIN_PAGE, hideAdminLogin: true } } },
  },
  'idp-configured': {
    description: 'An external identity provider is configured.',
    overrides: { publicConfig: 'identity-provider' },
  },
  'logo-broken': {
    description: 'The operator logos fail to load.',
    overrides: { failures: { getPublicConfigLogo: { status: 404 } } },
  },
  'help-html-malicious': {
    description:
      'The operator help text, footer, announcement and app links carry hostile content.',
    overrides: { publicConfig: 'malicious-html' },
  },
  'csrf-expired': {
    description:
      'admin is signed in; tests rotate the server token (`session.csrfToken`) or inject csrf-token-mismatch.',
    overrides: { signedInAs: 'admin' },
  },
}
