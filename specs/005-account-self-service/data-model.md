# Data Model: Account Self-Service

**Feature**: `specs/005-account-self-service` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

The app owns no persistent data. This document lists what UI feature 005 adds to UI 001's data
model (`specs/001-sign-in-app-shell/data-model.md`, cited as "001-DM"):

- the API data it consumes, as generated types;
- the app-defined models (section registry, visibility, validity presets, view models);
- the server-state cache (query keys, freshness, invalidation);
- client state (one session-store field, one in-memory holder, no device storage);
- the route map and the address parameters of the lists;
- client-side validation;
- the state machines of the enrolments, the reset, the forced actions, the webmail hand-off and the
  single-setting saves.

Contract shapes are never restated: types come from `src/api/generated/schema.ts` through `@/api`
(001-R7). Decisions are justified in [research.md](./research.md).

## 1. API data consumed

Generated root types, imported from `@/api` at the pin of [contracts/README.md](./contracts/README.md).

| Type | Operation(s) | Used by | Notes |
|---|---|---|---|
| `SelfServiceCapabilities` | `getSelfServiceCapabilities` | section visibility, limits, presets, "Forgot password?" | signed out: only `passwordReset`; sessions also get `account` |
| `PasswordPolicy` | `getOwnPasswordPolicy`, `checkPasswordResetToken` | `PasswordPolicyHints` | length in UTF-8 bytes |
| `OwnPasswordChangeRequest`, `OwnPasswordChangeResult` | `changeOwnPassword` | own and forced password | `currentPassword` omitted in the forced change |
| `OwnSecondFactor`, `OwnSecondFactorType` | `listOwnSecondFactors`, `deleteOwnSecondFactor` | two-factor section | no secret material |
| `OwnTotpEnrolment`, `OwnTotpEnrolmentConfirmation` | `startOwnTotpEnrolment`, `enrolOwnSecondFactor` | `TotpSetup` | the enrolment is a secret: component state only |
| `OwnSecondFactorWebAuthnOptions`, `OwnWebAuthnSecondFactorEnrolment` | `createOwnSecondFactorWebAuthnOptions`, `enrolOwnSecondFactor` | `SecurityKeySetup` | 001's codec parses the creation options |
| `OwnYubiOtpEnrolment` | `enrolOwnSecondFactor` | `YubicoOtpSetup` | `secretKey`, `otp` write-only |
| `OwnSecondFactorRemovalRequest` | `removeAllOwnSecondFactors` | turn off two-factor | current password |
| `OwnRecoveryEmail`, `OwnRecoveryEmailReplacement` | `getOwnRecoveryEmail`, `replaceOwnRecoveryEmail` | recovery e-mail | `etag`, `If-Match` |
| `MailboxOverview` | `getOwnMailboxOverview` | overview, home card, forwarding, counts | mailbox users, full session |
| `WebmailHandOff` | `createWebmailHandOff` | Webmail action, forwarding | response sets the legacy cookie |
| `MailboxClientConfiguration`, `MailboxClientServer` | `getOwnClientConfiguration` | setup guide | DAV and ActiveSync `null` without groupware |
| `AppleProfileRequest` (and the binary profile) | `getOwnAppleProfile`, `createOwnAppleProfileWithAppPassword` | profile downloads | `parseAs: 'blob'`, never cached |
| `PasswordResetRequest`, `PasswordResetAcknowledgement` | `requestPasswordReset` | reset request screen | same answer for every address |
| `PasswordResetTokenCheckRequest`, `PasswordResetTokenInfo` | `checkPasswordResetToken` | reset page | address, expiry, policy, methods |
| `PasswordResetWebAuthnChallengeRequest`, `WebAuthnChallenge` | `createPasswordResetWebAuthnChallenge` | reset second factor | 001's assertion flow |
| `PasswordResetCompletionRequest`, `PasswordResetCompleted`, `SecondFactorVerification`, `SecondFactorMethod` | `completePasswordReset` | reset page | `401 second-factor-required` carries `methods` |
| `AppPassword`, `AppPasswordResult`, `AppPasswordCreateRequest`, `AppPasswordPatch`, `AppPasswordProtocol` | app password operations | app passwords | `generatedPassword` returned only to `useSecretMutation`'s caller |
| `TemporaryAlias`, `TemporaryAliasCreateRequest`, `TemporaryAliasPatch`, `TemporaryAliasDomain` | temporary alias operations | temporary aliases | `TemporaryAliasPatch` is `lifetimeHours` or `permanent: true` |
| `PushNotificationSettings`, `PushNotificationSettingsReplacement`, `PushNotificationVerification` | push notification operations | Pushover form | `tokenSet`, `userKeySet` |
| `MailboxMailSettings`, `MailboxMailSettingsPatch`, `MailboxTaggedMailHandling` | `getMailboxMailSettings`, `updateMailboxMailSettings` | mail settings | `etag` covers the three settings only |
| `MailboxMailSettingsBulkActionRequest`, `BulkTarget`, `BulkResult`, `BulkItemResult`, `BulkItemOutcome` | `applyMailboxMailSettingsBulkAction` | bulk TLS (UI 003 list) | API gap AG1 on `version` |
| `RecentLogin` | `listRecentLogins`, `clearRecentLogins` | recent logins | `service` is an open string |
| `SieveFilter`, `SieveFilterKind`, `SieveFilterCreateRequest`, `SieveFilterPatch`, `SieveScriptValidationRequest`, `SieveScriptValidationResult`, `ActiveSieveScript` | sieve operations | filters | script ≤ `sieveScriptMaxBytes` bytes |
| `SelfServicePermissionFlagProblem`, `SelfServiceTemporaryFailureProblem`, `SecondFactorEnrolmentFailedProblem`, `PasswordResetSecondFactorRequiredProblem`, `PendingActionProblem`, `ValidationProblem` | every error | `ApiProblem` extension members (research R6) | `requiredFlags`, `requiredFlagsMatch`, `dependency`, `attemptsRemaining`, `methods` |
| `Identity`, `PermissionFlags`, `PendingAction`, `Role`, `MailboxProtocolAccess`, `MailboxAuthSource` | `getIdentity` (001), overview | visibility, read-only rules | `identity.impersonation` hides the Webmail action |
| `AuditEvent`, `AuditTarget`, `AuditEventType`, `AuditFailureReason` | `listAuditEvents` (001, with 002's target filters) | History, labels | self-service values appended |

Not called: `getOwnSecondFactor` (list entries suffice) and `getTemporaryAlias` (no alias detail
screen).

## 2. App-defined models

These are not API shapes. Each is derived from API data or from app constants.

### AccountSection (`src/features/account/sections.ts`)

| Field | Type | Rule |
|---|---|---|
| `id` | `'overview' \| 'password' \| 'recoveryEmail' \| 'twoFactor' \| 'passkeys' \| 'appPasswords' \| 'recentLogins' \| 'temporaryAliases' \| 'mailSettings' \| 'pushNotifications' \| 'filters' \| 'devices' \| 'mailApps'` | unique |
| `group` | `'overview' \| 'security' \| 'mail' \| 'devices'` | FR-002 grouping |
| `labelKey` | i18n key | `account.sections.<id>.title` |
| `route` | route name | own context, [§5](#5-route-map) (`passkeys` points to 001's `passkeys` route) |
| `mailboxRoute` | route name or `null` | mailbox context |
| `ownVisibility(identity, capabilities)` | `'visible' \| 'hidden' \| 'replaced' \| 'unknown'` | table below; `unknown` when a needed capabilities member cannot be read |
| `mailboxAccess(identity, capabilities)` | `{ mode: 'change' } \| { mode: 'readOnly', flag } \| { mode: 'hidden' }` | table below |

**Own context** (FR-002). `caps` is the self-service capabilities; `pw` is
`caps.account.passwordChangeAvailable`; `tf` is `caps.account.secondFactorManagementAvailable`;
`gw` is `caps.groupware.enabled`.

| Section | Administrator | Domain administrator | Mailbox user |
|---|---|---|---|
| overview | hidden | hidden | visible |
| password | visible | visible | `pw` ? visible : replaced (external notice) |
| recoveryEmail | hidden | hidden | `pwReset && pw` |
| twoFactor | visible | visible | `tf` |
| passkeys | visible (link to `/passkeys`) | visible | visible |
| appPasswords | hidden | hidden | `appPasswds` |
| recentLogins | hidden | hidden | visible |
| temporaryAliases | hidden | hidden | `spamAlias` |
| mailSettings | hidden | hidden | `delimiterAction \|\| tlsPolicy` (each card by its own flag) |
| pushNotifications | hidden | hidden | `pushover` |
| filters | hidden | hidden | visible (read-only) |
| devices | hidden | hidden | `gw && (easReset \|\| sogoProfileReset)` (each reset by its own flag) |
| mailApps | hidden (reason `login.mobileconfig_info`) | hidden (same) | visible |

**Mailbox context** (FR-003, FR-004), administrators and domain administrators on a mailbox in
scope. Administrators always get `change`. A domain administrator gets `change`, except for the
three sections below that need its own flag, where it gets `readOnly` with that flag when the flag
is off.

| Section | Flag for domain administrators | Hidden when |
|---|---|---|
| appPasswords | `appPasswds` | — |
| temporaryAliases | none | — |
| filters | `filters` | — |
| pushNotifications | `pushover` | — |
| mailSettings | none | — |
| recentLogins | none | — |
| groupware (`devices`) | none | `!gw` |

### Validity presets (`src/features/account/validity.ts`, FR-069, FR-071)

`[1, 24, 168, 744, 8760, 87600]` hours and `permanent`, labelled "1 hour", "1 day", "1 week",
"1 month", "1 year", "10 years" and "Never expires" (legacy). `availablePresets(caps)` keeps the
values within `minLifetimeHours` … `maxLifetimeHours`; the default is `defaultLifetimeHours`
(8760 today). A request sends `{ lifetimeHours }` or `{ permanent: true }`.

### Recent-login periods (`src/features/account/recent-login-period.ts`, FR-083)

`[1, 7, 14, 31]` days, labelled "1 day", "1 week", "2 weeks", "1 month" (legacy), filtered to
`minDays` … `maxDays`, default `defaultDays` (7). Service options: "All services" plus the codes
`IMAP`, `POP3`, `SMTP`, `SIEVE`, `EAS`, `DAV`, `SSO`, `SOGO`, `WEBUI` (contract description of
`RecentLogin.service`); labels in `selfService.service.<code>`; an unknown code is displayed as sent.

### PolicyRuleState (`src/shared/password/policy-rules.ts`, UI 003's module moved)

`evaluatePolicy(policy, password)` returns, in this order, `{ rule, met }` for `minLength` (always)
and, when required, `letters`, `digits`, `special`, `mixedCase`. Length counts UTF-8 bytes; letters
`[A-Za-z]`, digits `[0-9]`, special = any other character, mixed case = `[a-z]` and `[A-Z]`. A
server `missingCharacterClass` maps `letter`, `digit`, `special`, `lowerAndUpper` to these rules;
`tooShort` to `minLength`.

### QrTree (`src/features/account/qr-svg.ts`)

`parseQrDataUri(uri)` returns `{ tag: 'svg' | 'g' | 'rect' | 'path', attrs, children }` or `null`.
Allowed attributes: `svg` `viewBox` `width` `height`; `g` `transform` (`translate(n[,n])`,
`scale(n[,n])` only); `rect` `x` `y` `width` `height` `fill`; `path` `d` (`^[MmLlHhVvZz0-9.,\s-]+$`)
`fill` `fill-rule` (`evenodd`, `nonzero`). `fill` must be `#rgb` or `#rrggbb`. Anything else makes
the whole result `null` (research R10).

### Temporary-failure labels (`src/i18n/problems.ts`)

`dependency` → `selfService.dependency.<value>`: `sharedStore`, `mailStore`, `pushover`,
`addressGeneration`; unknown values → `selfService.dependency.unknown`.
`temporary-verification-failure` → "the Yubico verification service" in this feature's screens.

### Per-item outcome (`usePerItemRunner`, `src/shared/composables/`, created by UI 005)

Requests without an API bulk operation (temporary aliases, filters) map each response to the
conventions' outcomes: `2xx` → `done`; `404` → `notFound`; `412` → `outdated`; `403` → `refused`
(with the problem); other `4xx`/`5xx` → `failed` (with the problem); network failure → "outcome
unknown" (never retried). Items not `done` stay selected.

## 3. Server-state cache

### Query keys (`src/api/query/keys.ts`, added roots)

`<m>` is the mailbox address lower-cased.

| Key | Operation | staleTime | Fetched when | Notes |
|---|---|---|---|---|
| `['capabilities','self-service']` | `getSelfServiceCapabilities` | 5 min | sign-in screens (anonymous); My account, mailbox context and pending-actions screen (signed in) | cleared with the cache at every sign-in and sign-out (001-R9), so the anonymous and signed-in answers never mix |
| `['me','password-policy']` | `getOwnPasswordPolicy` | 30 s | own and forced password forms | — |
| `['me','second-factors',{limit,offset}]` | `listOwnSecondFactors` | 30 s | two-factor section, pending-actions screen, setup guide (2FA on?) | `sort=id` |
| `['me','recovery-email']` | `getOwnRecoveryEmail` | 30 s | recovery section | — |
| `['me','mailbox']` | `getOwnMailboxOverview` | 5 min | hub, home card, password form (app password count), forwarding, setup guide | full session only |
| `['me','client-configuration']` | `getOwnClientConfiguration` | 5 min | Mail app setup | — |
| `['self-service',<m>,'app-passwords','list',params]` | `listAppPasswords` | 30 s | app passwords list | — |
| `['self-service',<m>,'app-passwords','detail',id]` | `getAppPassword` | 30 s | detail page (deep links, UI 014 M32) | seeded from the list entry |
| `['self-service',<m>,'temporary-aliases','list',params]` | `listTemporaryAliases` | 30 s | aliases list | — |
| `['self-service',<m>,'temporary-alias-domains']` | `listTemporaryAliasDomains` | 5 min | generate panel | `limit: 1000` |
| `['self-service',<m>,'push-notifications']` | `getPushNotificationSettings` | 30 s | Pushover form | — |
| `['self-service',<m>,'mail-settings']` | `getMailboxMailSettings` | 30 s | mail settings | — |
| `['self-service',<m>,'recent-logins',params]` | `listRecentLogins` | 30 s | recent logins | — |
| `['self-service',<m>,'active-sieve-script']` | `getActiveSieveScript` | 30 s | My account › Filters, mailbox context filters | — |
| `['sieve-filters','list',params]` | `listSieveFilters` | 30 s | Mail setup › Filters | — |
| `['sieve-filters','mailbox',<m>,params]` | `listMailboxSieveFilters` | 30 s | mailbox context, My account, activation warning | — |
| `['sieve-filters','detail',<m>,id]` | `getSieveFilter` | 30 s | filter detail | — |

Never cached, because they carry or return secrets and run through `useSecretMutation` outside
TanStack Query (research R13, `docs/conventions.md`): password changes, recovery-address changes,
second-factor enrolments, TOTP starts and full removals, the three reset steps that carry the token,
app password creation and regeneration, Pushover replacement, and Apple profiles. Also never cached:
WebAuthn options and webmail hand-offs.

### Invalidation after mutations and secret requests

| Mutation | On success | On 412 |
|---|---|---|
| `changeOwnPassword` | clear the fields; invalidate `['me','mailbox']`; in a restricted session refetch `session` and `identity`, then continue (§7) | — |
| `enrolOwnSecondFactor`, `deleteOwnSecondFactor`, `removeAllOwnSecondFactors` | invalidate `['me','second-factors']` and `['capabilities','self-service']`; in a restricted session refetch `session` and `identity` | — |
| `replaceOwnRecoveryEmail` | write `['me','recovery-email']` from the response; invalidate `['me','mailbox']` | keep the address input (not the password); refetch; "changed elsewhere" |
| `createAppPassword`, `updateAppPassword`, `deleteAppPassword` (creation and regeneration through `useSecretMutation`) | invalidate `…'app-passwords'` and `['me','mailbox']`; write the detail without `generatedPassword` | keep non-secret input; refetch; mark changed values (`EditableSection`); a refused deletion is confirmed again |
| `createOwnAppleProfileWithAppPassword` | invalidate `['self-service',<me>,'app-passwords']` and `['me','mailbox']` | — |
| `createTemporaryAlias`, `updateTemporaryAlias`, `deleteTemporaryAlias` | invalidate `…'temporary-aliases'`, `['me','mailbox']`, UI 003's `['mailboxes','detail',<m>]` and `['mailboxes','list']` (active alias count) | per-item outcome `outdated`; the item stays selected |
| `updateMailboxMailSettings` | write `…'mail-settings'`; invalidate UI 003's `['mailboxes','detail',<m>]` and `['mailboxes','list']` | refetch; apply the reloaded value; "changed elsewhere, choose again" |
| `applyMailboxMailSettingsBulkAction` | invalidate `['mailboxes','list']` and every `['self-service',<m>,'mail-settings']` of the targets | per-item `outdated` |
| `replacePushNotificationSettings`, `deletePushNotificationSettings` | write or invalidate `…'push-notifications'`; invalidate `['me','mailbox']` and UI 003's `['mailboxes','detail',<m>]` | keep non-secret input (token and key fields are cleared); refetch; mark changed values |
| `verifyPushNotificationSettings` | nothing cached | — |
| `clearRecentLogins` | invalidate `…'recent-logins'` | — |
| `createWebmailHandOff` | invalidate `['self-service',<me>,'recent-logins']` (an `SSO` entry appears) | — |
| `resetActiveSyncCache`, `resetGroupwareProfile` | nothing | — |
| `createSieveFilter`, `updateSieveFilter`, `deleteSieveFilter` | invalidate `['sieve-filters']` (the active sieve script is the user's own and is unaffected) | per-item `outdated`; a single save keeps the input and marks changed values |
| `completePasswordReset` | refetch `session`; if it became `anonymous`, run 001's session-end clean-up without redirect | — |

## 4. Client state

### `useSessionStore` addition (`src/app/session/store.ts`)

| Field | Type | Lifetime | Rule |
|---|---|---|---|
| `landingIntent` | `'default' \| 'requested'` | memory | `requested` when the guard sends an anonymous navigation to sign-in with a `returnTo` other than home, and on 001's session end (FR-034). Read by `continueAfterSignIn()`; reset to `default` after landing and on sign-out (FR-100). |

### In-memory holders (never storage)

| Holder | Where | Lifetime |
|---|---|---|
| reset token | `src/features/auth/reset-token.ts` (module variable) | from the route's `beforeEnter` until completion, "request a new link" or unmount |
| TOTP enrolment | `TotpSetup.vue` local `shallowRef` | until success, cancel, expiry, route leave or unmount |
| generated app password | `OneTimeSecretDialog.vue` local state | until the dialog closes |
| new password, codes, current password | form-local refs | cleared after submit, on session end and on unmount |
| profile blob | local variable in `src/shared/platform/download.ts` | until the object URL is revoked (≈ 1 s) |

### Device storage and cross-tab messages

No new storage key (001-DM §4 stays the complete list; its storage unit test still passes). No new
broadcast message: the forced flows and the reset completion reuse 001's `session-changed` and
`signed-out`.

## 5. Route map

Base `/ng/`. Shell routes carry 001's `meta.navEntry`; My account routes also carry
`meta.accountSection`, mailbox-context routes `meta.selfServiceSection`.

### My account (`src/features/account/routes.ts`, nav entry `account`)

| Name | Path | Section | Component |
|---|---|---|---|
| `account` | `/account` | hub | `pages/AccountHomePage.vue` |
| `account-password` | `/account/password` | password | `pages/PasswordPage.vue` |
| `account-recovery-email` | `/account/recovery-email` | recoveryEmail | `pages/RecoveryEmailPage.vue` |
| `account-two-factor` | `/account/two-factor` | twoFactor | `pages/TwoFactorPage.vue` |
| `account-two-factor-add` | `/account/two-factor/add/:method(authenticator-app\|security-key\|yubico-otp)` | twoFactor | `pages/AddSecondFactorPage.vue` |
| `account-app-passwords` | `/account/app-passwords` | appPasswords | `pages/AppPasswordsPage.vue` |
| `account-app-password-create` | `/account/app-passwords/new` | appPasswords | `pages/AppPasswordCreatePage.vue` |
| `account-app-password-detail` | `/account/app-passwords/:appPasswordId(\\d+)` | appPasswords | `pages/AppPasswordDetailPage.vue` |
| `account-recent-logins` | `/account/recent-logins` | recentLogins | `pages/RecentLoginsPage.vue` |
| `account-temporary-aliases` | `/account/temporary-aliases` | temporaryAliases | `pages/TemporaryAliasesPage.vue` |
| `account-mail-settings` | `/account/mail-settings` | mailSettings | `pages/MailSettingsPage.vue` (anchors `#tagged-mail`, `#tls-policy`) |
| `account-push-notifications` | `/account/push-notifications` | pushNotifications | `pages/PushNotificationsPage.vue` |
| `account-filters` | `/account/filters` | filters | `pages/OwnFiltersPage.vue` |
| `account-devices` | `/account/devices` | devices | `pages/DevicesPage.vue` |
| `account-mail-apps` | `/account/mail-apps` | mailApps | `pages/MailAppsPage.vue` |

### Mailbox context (`src/features/account/mailbox-routes.ts`, children of UI 003's detail route, nav entry `mailboxes`)

| Name | Path | Component |
|---|---|---|
| `mailbox-app-passwords` | `/mailboxes/:address/app-passwords` | `pages/AppPasswordsPage.vue` (`context: 'mailbox'`) |
| `mailbox-app-password-create` | `/mailboxes/:address/app-passwords/new` | `pages/AppPasswordCreatePage.vue` |
| `mailbox-app-password-detail` | `/mailboxes/:address/app-passwords/:appPasswordId(\\d+)` | `pages/AppPasswordDetailPage.vue` |
| `mailbox-temporary-aliases` | `/mailboxes/:address/temporary-aliases` | `pages/TemporaryAliasesPage.vue` |
| `mailbox-filters` | `/mailboxes/:address/filters` | `@/features/filters` `MailboxFiltersPage.vue` |
| `mailbox-filter-create` | `/mailboxes/:address/filters/new` | `@/features/filters` `FilterFormPage.vue` |
| `mailbox-filter-detail` | `/mailboxes/:address/filters/:filterId(\\d+)` | `@/features/filters` `FilterFormPage.vue` |
| `mailbox-push-notifications` | `/mailboxes/:address/push-notifications` | `pages/PushNotificationsPage.vue` |
| `mailbox-mail-settings` | `/mailboxes/:address/mail-settings` | `pages/MailSettingsPage.vue` |
| `mailbox-recent-logins` | `/mailboxes/:address/recent-logins` | `pages/RecentLoginsPage.vue` |
| `mailbox-groupware` | `/mailboxes/:address/groupware` | `pages/DevicesPage.vue` (resets only) |

`:address` is the parameter of UI 003's `mailbox-detail` route (`/mailboxes/:address([^/]+@[^/]+)`);
the records are spread into its children in `src/features/mailboxes/routes.ts`.

### Mail setup › Filters (`src/features/filters/routes.ts`, nav entry `filters`)

| Name | Path | Component |
|---|---|---|
| `filters` | `/filters` | `pages/FiltersPage.vue` |
| `filter-create` | `/filters/new` | `pages/FilterFormPage.vue` |
| `filter-detail` | `/filters/:mailbox/:filterId(\\d+)` | `pages/FilterFormPage.vue` |

### Password reset (`src/features/auth/routes.ts`, `AuthLayout`, `meta.public: true`, every session state)

| Name | Path | Component |
|---|---|---|
| `password-reset-request` | `/reset-password/request` | `pages/PasswordResetRequestPage.vue` |
| `password-reset` | `/reset-password` (`?token=` or `#token=` read once in `beforeEnter`, then removed) | `pages/PasswordResetPage.vue` |

### Address parameters of the lists (`useListState` schemas)

Defaults are omitted from the address; invalid values fall back and are normalised with
`router.replace` (001-R20). `page` ≥ 1 and `size` ∈ {25, 50, 100} everywhere.

| List | Parameters (default) | Maps to |
|---|---|---|
| Second factors | `page`, `size` | `limit`, `offset`, `sort=id` |
| App passwords | `q` (≤ 255), `active` (`true`/`false`), `sort` (`name`; `createdAt`, `modifiedAt`, `active`), `order` (`asc` for `name`, `desc` for times) | same names |
| Temporary aliases | `q`, `permanent` (`true`/`false`), `sort` (`createdAt`; `expiresAt`, `address`), `order` (`desc` for `createdAt`, `asc` otherwise) | same names |
| Recent logins | `days` (capabilities default, one of 1/7/14/31 within range), `service` (≤ 32), `q`, `sort` (`lastSeenAt`; `service`, `clientAddress`), `order` (`desc` for `lastSeenAt`, `asc` otherwise) | same names |
| Mail setup › Filters | `mailbox` (≤ 255), `kind` (`prefilter`/`postfilter`), `active`, `q`, `sort` (`mailbox`; `description`, `kind`, `active`, `createdAt`, `modifiedAt`), `order` (`asc`) | same names |
| Mailbox filters | as above without `mailbox` | same names |

The Mail app setup route accepts `variant` (`email`, `emailAndDav`) and `appPassword` (`1`) as
preselection only (UI 014 FR-050); they are removed from the address after reading.

## 6. Client-side validation

Checked before submitting; server field errors are always shown too (FR-012). Limits come from the
capabilities read where it has them (`limits.*`); the others are contract constants in
`src/shared/validation/limits.ts`, each compared with `contract/openapi.json` by 001's limits test.

| Field | Rule | Message key |
|---|---|---|
| Current password | 1–4096 characters | `validation.required`, `validation.tooLong` |
| New password | 1–4096 characters; equal to its confirmation | `validation.required`, `validation.tooLong`, `danger.password_mismatch` (legacy) |
| Recovery e-mail | empty (removes) or an e-mail address ≤ 255, `type="email"` | `validation.format.email`, `validation.tooLong` |
| Reset request address | required, an e-mail address ≤ 255 | `validation.required`, `validation.format.email` |
| Second-factor name, app password name | 1–`limits.nameMaxLength` (255) after trimming | `validation.required`, `validation.tooLong` |
| TOTP code | spaces stripped, `^[0-9]{6}$` | `validation.format.totpCode` |
| Yubico client ID | `^[0-9]{1,32}$` | `validation.format.digits` |
| Yubico secret key | 1–128 characters | `validation.required`, `validation.tooLong` |
| Yubico OTP | `^[A-Za-z0-9]{44}$` | `validation.format.yubicoOtp` |
| Temporary alias description | ≤ `limits.descriptionMaxLength` (255) | `validation.tooLong` |
| Temporary alias domain | one of `listTemporaryAliasDomains` | `validation.notInList` |
| Pushover token, user key | empty (keeps) or `^[A-Za-z0-9]{30}$`; required while not stored | `validation.format.pushoverCredential`, `validation.secretRequired` |
| Pushover title / text | ≤ `limits.pushTitleMaxLength` (250) / `limits.pushTextMaxLength` (1,024) | `validation.tooLong` |
| Pushover senders | ≤ `limits.pushSendersMax` (100) lines, each ≤ 255 | `validation.tooMany`, `validation.tooLong` |
| Pushover sender pattern | ≤ `limits.pushSenderPatternMaxLength` (1,024) | `validation.tooLong` (server: `invalidRegex`) |
| Pushover sound | `^[A-Za-z0-9_-]{1,20}$` (list from capabilities) | `validation.format.soundName` |
| Filter description | 1–`limits.descriptionMaxLength` (255) | `validation.required`, `validation.tooLong` |
| Filter script | 1–`limits.sieveScriptMaxBytes` (65,535) UTF-8 bytes | `validation.required`, `validation.tooLong` (bytes) |
| Filter mailbox (Mail setup) | required, chosen from the picker | `validation.required` |
| Bulk TLS | at least one of inbound and outbound changed; ≤ `bulkLimit` targets | `account.bulkTls.chooseOne` |

## 7. State machines

### Forced actions (pending-actions screen, FR-029 to FR-031, FR-057 to FR-059)

```text
restricted ──passwordChange pending──► [set new password] ──200──► refetch session + identity
    │                                                                  │
    │                                   secondFactorSetup pending ◄────┤
    └──only secondFactorSetup────────► [choose method] ─ passkey | TOTP | security key | Yubico ─► enrolled
                                                                       │
                       refetch session + identity ◄────────────────────┘
                                  │ active
                                  ▼
               broadcast session-changed → continueAfterSignIn() (returnTo / home / webmail, FR-100)
```

### TOTP enrolment (`useTotpEnrolment`)

```text
idle ─continue(name, password?)→ starting ─200→ shown(key, uri, qr, expiresAt)
  ▲        │ current-password-incorrect → idle (error on password)
  │   shown ─code→ confirming ─201→ done (enrolment discarded)
  │     ▲            │ enrolment-failed (attemptsRemaining > 0) → shown, error on code
  │     └────────────┘
  │   shown/confirming ─ enrolment-expired | attemptsRemaining 0 | countdown 0 → expired ─start again→ starting
  └── cancel / leave (confirmed) / unmount: enrolment discarded
```

### Security key enrolment (`useSecurityKeyEnrolment`)

```text
idle ─start→ requesting-options ─200→ awaiting-key ("Touch your security key now")
  ─credential→ verifying ("Waiting for the server") ─201→ done
  any DOMException / enrolment-failed / enrolment-expired → failed(reason) ─try again→ requesting-options
```

### Password reset page (`usePasswordReset`)

```text
[beforeEnter: token → holder, address scrubbed]
checking ─200→ valid ─(signed in?)→ warning ─continue→ password-step
   │ 400 invalid-reset-token / no token        → invalid ─request new link→ /reset-password/request
   │ 403 password-reset-unavailable            → unavailable
   │ secondFactorRequired && methods = []      → ask-administrator
password-step ─submit(password)→ completing
   ├ 200 → done
   ├ 422 → password-step (field errors)
   └ 401 second-factor-required(methods) → factor-step
factor-step ─submit(password + proof)→ completing-factor
   ├ 200 → done
   ├ 401 second-factor-failed / 503 → factor-step (retry, another method)
   ├ 403 second-factor-unavailable → ask-administrator
   └ 400 invalid-reset-token → invalid
countdown to expiresAt reaches 0 (any step) → invalid (expired)
done: refetch session; signed out here? → local session end without redirect; offer sign-in
```

### Webmail hand-off (`useWebmailHandOff`)

```text
click → tab = window.open('', '_blank') (synchronous) → requesting
requesting ─200→ tab ? (tab.opener = null; tab.location.replace(url)) : show "Open webmail" link
requesting ─problem→ tab?.close(); show problem
```

### Single-setting save (tagging, TLS switches, app password active)

```text
stored ─change→ pending (control shows new value, busy) ─200→ stored(new), announced
                       ├ 412 → stored(reloaded value), "changed elsewhere, choose again"
                       └ other problem → stored(previous value), error announced
```

### One-time secret dialog

Unchanged from 001-DM §7, now in `src/shared/components/OneTimeSecretDialog.vue`; the secret enters
it from `useSecretMutation`'s result, never from a cache.
