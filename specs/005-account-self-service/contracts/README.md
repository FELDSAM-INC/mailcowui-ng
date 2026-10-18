# Contracts of UI feature 005

This app exposes no API of its own. Its only interface is the mailcow-rest-v2 contract
(constitution I), vendored in `contract/` as UI 001 describes
(`specs/001-sign-in-app-shell/contracts/README.md`). This file records the pin UI 005 needs, the
operations it calls and how it reacts to their problem types.

## Pinned contract

| Field | Value |
|---|---|
| API repository | `FELDSAM-INC/mailcow-rest-v2` |
| API feature | 005 – account self-service (module `api/modules/self-service/`, 51 operations), on top of 001–004 |
| Contract version (`info.version`) | `0.1.0` (does not identify a contract, 001-R6) |
| Baseline commit | `32079252d55797d3da4e58ae661e9fb91c51c6f9` (2026-10-18, "Register KnownProblemType in contract components"): the newest commit that touches `api/`, with the complete feature 005 contract and every amendment |
| Bundle | `@redocly/cli@2.64.1 bundle api/openapi.yaml` |
| Bundle sha256 at the baseline | `5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6` |
| Operations in the bundle | 376 (all features 001–013); UI 005 calls the ones listed below |
| `KnownProblemType` | under `components.schemas` at the baseline, so `knownProblemTypeValues` is generated (closes UI 001's API gap 5) |

**Pin rule** (research R2, `docs/conventions.md` "Contract pins"): pins only move forward. The setup
task runs `scripts/contract/bump.sh` with the baseline commit, or with a later commit when it is newer
than the pin UI 002–004 left in `contract/VERSION.json` or contains the fix of API gap AG1 or AG2
(plan). It diffs `api/` between the baseline and the chosen pin and checks every operation below for
changes before accepting it.
After the bump: `npm run typecheck`, `npm run test:unit`, `npm run test:e2e` and `npm run
i18n:check`, translating every value the check reports (research R23).

## Operations used by this feature

### Self-service module (49 of 51)

| operationId | Method and path | Used by | Requirements |
|---|---|---|---|
| `getSelfServiceCapabilities` | GET `/capabilities/self-service` | sign-in screens (signed out), My account, mailbox context, pending actions | FR-009, FR-034 |
| `changeOwnPassword` | PUT `/me/password` | own password, forced change | FR-021–FR-031 |
| `getOwnPasswordPolicy` | GET `/me/password-policy` | own password, forced change | FR-022, FR-030 |
| `listOwnSecondFactors` | GET `/me/second-factors` | two-factor section, pending actions, setup guide | FR-043, FR-102 |
| `enrolOwnSecondFactor` | POST `/me/second-factors` | TOTP, security key, Yubico OTP (also forced) | FR-045–FR-050, FR-058 |
| `startOwnTotpEnrolment` | POST `/me/second-factors/totp-enrolment` | TOTP setup | FR-046–FR-048 |
| `createOwnSecondFactorWebAuthnOptions` | POST `/me/second-factors/webauthn-registration-options` | security key setup | FR-049 |
| `removeAllOwnSecondFactors` | POST `/me/second-factors/removal` | turn off two-factor | FR-052, FR-053 |
| `deleteOwnSecondFactor` | DELETE `/me/second-factors/{secondFactorId}` | remove one entry | FR-051 |
| `getOwnRecoveryEmail` | GET `/me/recovery-email` | recovery e-mail | FR-032 |
| `replaceOwnRecoveryEmail` | PUT `/me/recovery-email` | recovery e-mail | FR-032, FR-016 |
| `getOwnMailboxOverview` | GET `/me/mailbox` | overview, home card, forwarding, password note, setup guide | FR-027, FR-097, FR-100 |
| `createWebmailHandOff` | POST `/me/webmail-handoff` | Webmail action, forwarding | FR-098–FR-100 |
| `getOwnClientConfiguration` | GET `/me/mailbox/client-configuration` | setup guide | FR-101, FR-102 |
| `getOwnAppleProfile` | GET `/me/mailbox/apple-profile` | profile download | FR-103, FR-105 |
| `createOwnAppleProfileWithAppPassword` | POST `/me/mailbox/apple-profile` | profile download with app password | FR-104, FR-105 |
| `requestPasswordReset` | POST `/password-resets` | reset request screen | FR-035–FR-037 |
| `checkPasswordResetToken` | POST `/password-resets/token-check` | reset page | FR-039 |
| `createPasswordResetWebAuthnChallenge` | POST `/password-resets/webauthn-challenge` | reset second factor | FR-040 |
| `completePasswordReset` | POST `/password-resets/completion` | reset page | FR-040, FR-041 |
| `applyMailboxMailSettingsBulkAction` | POST `/mailboxes/mail-settings/bulk-actions` | UI 003 mailbox list bulk TLS | FR-076, FR-019 |
| `listAppPasswords` | GET `/mailboxes/{mailbox}/app-passwords` | app passwords | FR-060 |
| `createAppPassword` | POST `/mailboxes/{mailbox}/app-passwords` | create | FR-061–FR-063 |
| `getAppPassword` | GET `/mailboxes/{mailbox}/app-passwords/{appPasswordId}` | detail (deep link) | FR-006, FR-064 |
| `updateAppPassword` | PATCH `/mailboxes/{mailbox}/app-passwords/{appPasswordId}` | rename, protocols, active, new password | FR-064, FR-065 |
| `deleteAppPassword` | DELETE `/mailboxes/{mailbox}/app-passwords/{appPasswordId}` | delete | FR-066 |
| `listTemporaryAliases` | GET `/mailboxes/{mailbox}/temporary-aliases` | aliases | FR-068 |
| `createTemporaryAlias` | POST `/mailboxes/{mailbox}/temporary-aliases` | generate | FR-069, FR-070 |
| `updateTemporaryAlias` | PATCH `/mailboxes/{mailbox}/temporary-aliases/{temporaryAlias}` | change validity | FR-071 |
| `deleteTemporaryAlias` | DELETE `/mailboxes/{mailbox}/temporary-aliases/{temporaryAlias}` | delete | FR-072 |
| `listTemporaryAliasDomains` | GET `/mailboxes/{mailbox}/temporary-alias-domains` | domain choice | FR-069 |
| `getPushNotificationSettings` | GET `/mailboxes/{mailbox}/push-notifications` | Pushover form | FR-077, FR-078 |
| `replacePushNotificationSettings` | PUT `/mailboxes/{mailbox}/push-notifications` | save | FR-077, FR-078 |
| `deletePushNotificationSettings` | DELETE `/mailboxes/{mailbox}/push-notifications` | remove | FR-081 |
| `verifyPushNotificationSettings` | POST `/mailboxes/{mailbox}/push-notifications/verification` | verify | FR-080 |
| `getMailboxMailSettings` | GET `/mailboxes/{mailbox}/mail-settings` | tagging, TLS | FR-074, FR-075 |
| `updateMailboxMailSettings` | PATCH `/mailboxes/{mailbox}/mail-settings` | tagging, TLS | FR-014, FR-074, FR-075 |
| `listRecentLogins` | GET `/mailboxes/{mailbox}/recent-logins` | recent logins | FR-082, FR-083 |
| `clearRecentLogins` | DELETE `/mailboxes/{mailbox}/recent-logins` | clear | FR-084 |
| `resetActiveSyncCache` | DELETE `/mailboxes/{mailbox}/activesync-cache` | ActiveSync reset | FR-086 |
| `resetGroupwareProfile` | DELETE `/mailboxes/{mailbox}/groupware-profile` | SOGo profile reset | FR-087 |
| `listSieveFilters` | GET `/sieve-filters` | Mail setup › Filters | FR-090 |
| `validateSieveScript` | POST `/sieve-filters/validation` | "Check" | FR-093 |
| `listMailboxSieveFilters` | GET `/mailboxes/{mailbox}/sieve-filters` | mailbox context, My account, activation warning | FR-089, FR-090, FR-094 |
| `createSieveFilter` | POST `/mailboxes/{mailbox}/sieve-filters` | create | FR-091 |
| `getSieveFilter` | GET `/mailboxes/{mailbox}/sieve-filters/{sieveFilterId}` | detail | FR-095 |
| `updateSieveFilter` | PATCH `/mailboxes/{mailbox}/sieve-filters/{sieveFilterId}` | edit, (de)activate, switch kind | FR-095 |
| `deleteSieveFilter` | DELETE `/mailboxes/{mailbox}/sieve-filters/{sieveFilterId}` | delete | FR-095 |
| `getActiveSieveScript` | GET `/mailboxes/{mailbox}/active-sieve-script` | active script panel | FR-089 |

Not called: `getOwnSecondFactor` and `getTemporaryAlias`.

### Operations of earlier features used here

| operationId | Feature | Used for |
|---|---|---|
| `getCsrfToken`, `getSession`, `getIdentity` | 001 | bootstrap, guard, refetch after forced actions and the reset |
| `createPasskeyRegistrationOptions`, `registerPasskey` | 001 | the passkey option of the forced second-factor setup (`usePasskeyRegistration`) |
| `listAuditEvents` with `targetType`/`targetId` | 001 + 002 | History and the self-service labels |
| `listMailboxes` | 003 | `MailboxSearchPicker` in the filter form |

## Problem types and the app's response

Messages come from `problem.<name>`, never from `title` or `detail` (001 FR-075). Types already
handled by UI 001 keep 001's behaviour unless noted.

| `type` (`/api/v2/problems/…`) | Status | App behaviour in this feature |
|---|---|---|
| `current-password-incorrect` | 403 | Error on the current-password field; the field is cleared and focused (FR-028) |
| `password-managed-externally` | 403 | Replace the section with the external notice; refetch capabilities |
| `permission-flag-required` | 403 | "Permission withdrawn: {flags}"; invalidate identity and capabilities; hide (own) or read-only (mailbox) (FR-007) |
| `password-reset-unavailable` | 403 | Request screen: legacy `danger.password_reset_na`; reset page: unavailable state |
| `invalid-reset-token` | 400 | Invalid or expired link state with "Request a new link" (FR-039) |
| `second-factor-enrolment-expired` | 400 | Expired state, "Start again" (FR-047) |
| `second-factor-enrolment-failed` | 400 | TOTP: error on the code with `attemptsRemaining` and the clock hint; WebAuthn and Yubico: explanation with "Try again" |
| `last-second-factor` | 409 | Refetch; the entry's action becomes "Turn off two-factor authentication" (FR-052) |
| `second-factor-required-by-policy` | 403 | Legacy `danger.tfa_removal_blocked`; refetch capabilities and list (FR-054) |
| `push-notifications-not-configured` | 409 | "Save the settings first" (FR-080) |
| `groupware-disabled` | 403 | Explain; hide webmail, resets and the full profile; refetch capabilities (FR-088) |
| `temporary-failure` | 503 | Name the `dependency` in plain words with "Try again" and the `Retry-After` countdown (FR-020) |
| `temporary-verification-failure` | 503 | "The Yubico verification service is unavailable", retry (enrolment and reset) |
| `second-factor-required` | 401 | Reset completion only: show the second-factor step with `methods` (a `useSecretMutation` call with `sessionReactions: false`); elsewhere 001's behaviour |
| `second-factor-failed` | 401 | Reset completion: stay on the factor step, retry while the link is valid |
| `second-factor-unavailable` | 403 | Reset: "ask an administrator to reset your second factors" |
| `too-many-requests` | 429 | Countdown from `retryAfter`, action disabled (wrong current passwords, reset requests, checks, completions) |
| `pending-action-required` | 403 | 001: back to the pending-actions screen |
| `forbidden` | 403 | 001: "no permission" in context, identity refreshed (for example the Webmail action for another role) |
| `validation-failed` | 422 | Field errors from `errors`, including `tooShort`, `missingCharacterClass`, `preHashedPassword`, `sieveSyntax`, `secretRequired`, `invalidRegex`, `notInList`, `tooLong` (`unit: bytes`, `stored: true`), `mutuallyExclusive`, `tooMany` (FR-012) |
| `about:blank` 404 | 404 | "Not found" state; in per-item actions the outcome `notFound` and a refreshed list |
| `about:blank` 412 | 412 | "Changed elsewhere": reload, keep non-secret input, mark changed values; single settings apply the reloaded value; a refused deletion is confirmed again (FR-016) |
| unknown types | — | 001's generic message with the request ID |
