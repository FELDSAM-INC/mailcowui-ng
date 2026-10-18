---
description: "Task list for UI feature 005: account self-service"
---

# Tasks: Account Self-Service

**Input**: Design documents from `specs/005-account-self-service/`:
- [plan.md](./plan.md)
- [spec.md](./spec.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/README.md](./contracts/README.md)
- [quickstart.md](./quickstart.md)

**Prerequisites**:
- UI features 001 to 004 are implemented (plan, "Dependencies on earlier features"). In particular:
  - UI 001's shell, guard, session reactions, pending-actions screen, second-factor step, passkeys,
    audit log and shared primitives;
  - UI 002's bulk selection, per-item runner, `ConfirmDialog` typed confirmation, `EditableSection`,
    `HistoryLink` and the audit target filters;
  - UI 003's mailbox detail and list with their extension points (research R5), password generator
    and byte formatter;
  - UI 003's or UI 004's mailbox picker.
- The mailcow-rest-v2 feature 005 contract is merged (pin in contracts/README.md). The smoke tasks
  also need API 005 running in the API dev stack.
- When a piece named in research R1 is missing, the task that first needs it creates it at that
  path, never as a feature-local copy.

**Tests**: Mandatory (constitution VI, test-first). In every phase, tests are written first and must
fail before the implementation tasks that follow them. Every end-to-end spec:
- runs on `mobile-chromium` (360 px), `desktop-chromium` and `mobile-webkit` (except tests tagged
  `@virtual-authenticator`);
- calls `expectAccessible` (axe, WCAG 2.2 AA, both themes) on every screen, dialog and state it
  reaches, and `expectNoHorizontalScroll` at 360 and 320 px;
- fails on any CSP violation or mock contract violation (UI 001's fixtures);
- names its spec reference in the test title (`US2-AS3 …`, `FR-047 …`, `Edge: …`, `SC-008 …`).

Smoke specs carry the tag `@005`.

**Organization**: Tasks are grouped by user story (spec priorities P1 to P3) so that each story can
be implemented and tested on its own once the foundation is in place.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task belongs to (US1 to US12)
- Paths are relative to the repository root `mailcowui-ng/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Pin the contract with API feature 005, extend the i18n tooling, the contract
validator and the test helpers this feature needs (research R2, R23, R24).

- [ ] T001 Bump the contract pin (research R2): run `scripts/contract/bump.sh 32079252d55797d3da4e58ae661e9fb91c51c6f9`, or a later mailcow-rest-v2 commit when the pin in `contract/VERSION.json` is already newer or a later commit contains the fix of API gap G1 or G2. Never pin an older commit than the current one. This rewrites `contract/openapi.yaml`, `contract/openapi.json`, `contract/VERSION.json` and `src/api/generated/schema.ts`. Confirm that the bundle contains the 51 operations of `api/modules/self-service/` and `knownProblemTypeValues`. Run `npm run typecheck` and fix the type errors the bump causes in existing code. Record the pinned commit, sha256 and operation count in `specs/005-account-self-service/contracts/README.md` when they differ from the baseline.
- [ ] T002 Extend `tests/unit/scripts/i18n-tools.spec.ts` with failing cases (research R23):
  - a `legacy-map.json` entry `{ "key": "…", "html": "plain" }` is imported with `<br>` turned into a line break, `b strong i em u small code p` unwrapped, one `<a href="…">text</a>` turned into `{link}` with the anchor text written to the sibling key `<appKey>Link`;
  - other tags, two anchors, and HTML in a plain (string) entry are refused;
  - a key whose `en-gb` value has plural choices must have exactly three choices in `cs-cz` and `sk-sk`;
  - the check derives problem types from `knownProblemTypeValues` when present, and requires labels for the enumeration arrays `OwnSecondFactorType`, `AppPasswordProtocol`, `MailboxTaggedMailHandling` and `SieveFilterKind`.
- [ ] T003 Implement T002 in `scripts/i18n/lib.mjs`, `scripts/i18n/import-legacy.mjs` and `scripts/i18n/check.mjs`, so that T002 passes.
- [ ] T004 Make `npm run i18n:check` pass at the new pin: add to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, through `src/i18n/legacy-map.json` where a legacy text has the same meaning, every key the check now requires:
  - `problem.<name>` for the feature 005 types `current-password-incorrect`, `password-managed-externally`, `password-reset-unavailable`, `invalid-reset-token`, `second-factor-enrolment-expired`, `second-factor-enrolment-failed`, `last-second-factor`, `second-factor-required-by-policy`, `push-notifications-not-configured`, `groupware-disabled`, and any other type of the pin not yet translated;
  - `validation.<code>` for `preHashedPassword`, `sieveSyntax` and any other untranslated `ValidationRuleCode`, and `validation.format.{email,pushoverCredential,soundName,digits}`;
  - `auditLog` labels for the 23 self-service `AuditEventType` values, the 12 self-service `AuditTarget.type` values and the 10 new `AuditFailureReason` values (research R22);
  - labels for every value of `OwnSecondFactorType`, `AppPasswordProtocol`, `MailboxTaggedMailHandling` and `SieveFilterKind`.

  Legacy messages reused here: `danger.last_key`, `danger.tfa_removal_blocked`, `danger.password_reset_na`, `danger.invalid_reset_token`, `danger.reset_token_limit_exceeded`. Supply the cs-cz and sk-sk values missing from the upstream legacy files (`danger.tfa_removal_blocked` in both; `danger.password_reset_na`, `danger.invalid_reset_token`, `danger.reset_token_limit_exceeded` in sk-sk) in that locale's hand-written layer. Run `npm run i18n:import`.
- [ ] T005 [P] Extend `tests/unit/mocks/validator.spec.ts` with failing cases: an `application/x-apple-aspen-config` response of `getOwnAppleProfile` is validated as a string body; a missing `Content-Disposition` or `Cache-Control` on it is rejected; a `createWebmailHandOff` response without `Set-Cookie` is rejected; an `application/merge-patch+json` request body of `updateAppPassword` is validated against `AppPasswordPatch`.
- [ ] T006 Implement T005 in `tests/mocks/contract/validator.ts`: non-JSON response bodies validated against their documented string schema, and every header the operation's response declares as `required` checked, so that T005 passes.
- [ ] T007 [P] Write `tests/unit/support/totp.spec.ts` with the RFC 6238 SHA-1 test vectors (six digits, 30-second steps) and a ±1-step verification. The test must fail.
- [ ] T008 Move `tests/smoke/fixtures/totp.ts` to `tests/support/totp.ts`, add `verifyTotp(secret, code, now, window = 1)`, and update the imports of UI 001's smoke specs, so that T007 passes (research R24).
- [ ] T009 [P] Write `tests/unit/i18n/plural.spec.ts`: `cs-cz` and `sk-sk` choose the first form for 1, the second for 2–4 and the third for 0 and 5 or more; `en-gb` keeps vue-i18n's default. If UI 002 or 003 already ship these rules and their test, extend that test instead. The test must fail if the rules are missing.
- [ ] T010 Register the `pluralRules` for `cs-cz` and `sk-sk` in `src/i18n/index.ts` (only if UI 002 or 003 did not), so that T009 passes.

**Checkpoint**: The new pin is vendored, `npm run typecheck`, `npm run contract:check`, `npm run
i18n:check` and the existing unit and end-to-end suites pass.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The mock base for the self-service module, the shared pieces every story uses
(password fields, one-time secrets, copy, secret-safe mutations, problem extensions, landing), the
section registry and visibility, the My account hub and the mailbox-context group.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Test infrastructure

- [ ] T011 Extend the scenario model in `tests/mocks/scenarios/state.ts` with the self-service state of data-model §1 (research R24):
  - per mailbox: recovery address, overview figures (quota, usage, messages, protocol access, aliases, send-as, catch-alls, `webmail.redirectAfterSignIn`, password-changed time), app passwords, temporary aliases and alias domains, push settings, mail settings, recent logins, Sieve filters and the active script;
  - per account: second-factor entries (type, name, active, usable, Yubico public ID, used for the current sign-in), `forceTfa`, the number of other sessions, the TOTP enrolment, the WebAuthn second-factor options and throttle counters;
  - server switches: groupware enabled, password reset available, reset tokens, and outages of the shared store, the mail store, Pushover and Yubico.

  Add the factories `tests/mocks/factories/{second-factor,app-password,temporary-alias,recent-login,sieve-filter,mailbox-overview,client-configuration,push-settings,qr-svg,apple-profile}.ts`. `qr-svg.ts` builds a BaconQrCode-style `data:image/svg+xml;base64,…` (an `svg` with one `rect`, nested `g` transforms and one `path`).
- [ ] T012 Implement the baseline handlers with `openapi-msw`, wrapped by the validator:
  - `tests/mocks/handlers/self-service/index.ts`, registered in `tests/mocks/handlers/index.ts`;
  - `tests/mocks/handlers/self-service/capabilities.ts`: `getSelfServiceCapabilities` (signed out: only `passwordReset`; sessions: every member plus `account` with `secondFactorRequired`, `passwordChangeAvailable`, `secondFactorManagementAvailable`; documented `500` by failure injection);
  - `tests/mocks/handlers/self-service/overview.ts`: `getOwnMailboxOverview` (mailbox users with a full session; `forbidden` for other roles; `403 pending-action-required` in a restricted session).

  Extend UI 001's restricted-session handling in `tests/mocks/handlers/auth.ts` and `tests/mocks/handlers/identity.ts` with API 005's route modes (research R8): `includes,passwordChange` for `getOwnPasswordPolicy` and `changeOwnPassword`; `includes,secondFactorSetup` for `listOwnSecondFactors`, `enrolOwnSecondFactor`, `startOwnTotpEnrolment` and `createOwnSecondFactorWebAuthnOptions`; `allow` for `getSelfServiceCapabilities`; `403 pending-action-required` for every other self-service operation.
- [ ] T013 Create `tests/mocks/scenarios/account.ts`, registered in `tests/mocks/scenarios/index.ts`, with the base scenarios:
  - `mailbox-account`: mailcow source, every user flag on, one TOTP and one security key entry, three active app passwords, aliases, recent logins, 1 GiB quota with 256 MiB used, webmail enabled;
  - `mailbox-account-no-flags`: every user flag off;
  - `mailbox-external-source`: Keycloak source, signed in with a passkey, `passwordChangeAvailable` and `secondFactorManagementAvailable` false;
  - `domain-admin-account`: two other sessions, a policy of minimum 10 characters with digits required, `da_acl` flags `appPasswds`, `pushover` and `filters` on;
  - `domain-admin-no-flags`: the same with `appPasswds`, `pushover` and `filters` off;
  - `admin-account`;
  - `groupware-disabled`;
  - `capabilities-unavailable`: documented `500` on `getSelfServiceCapabilities`.

### Tests for the core (write first; must fail)

- [ ] T014 [P] Write `tests/unit/features/account/sections.spec.ts`, table-driven over every row of data-model §2 (own context and mailbox context). Cover:
  - roles: administrator, domain administrator, mailbox user;
  - each flag of FR-002 and FR-004 on and off;
  - `passwordChangeAvailable`, `secondFactorManagementAvailable` and `groupware.enabled` true and false;
  - an unreadable capabilities read.

  Assert `ownVisibility` (`visible`, `hidden`, `replaced`, `unknown`) and `mailboxAccess` (`change`, `readOnly` with the flag, `hidden`) (FR-002 to FR-004, SC-009).
- [ ] T015 [P] Write `tests/unit/shared/password/policy.spec.ts` and `tests/unit/shared/password/generate.spec.ts` (research R7):
  - policy: length counted in UTF-8 bytes (`ä` counts 2); letters `[A-Za-z]`, digits, special (any other character), mixed case; the minimum length always listed and class rules only when required; `missingCharacterClass` values `letter`, `digit`, `special`, `lowerAndUpper` and `tooShort` mapped to rules;
  - generator: at least 16 characters or the policy minimum when longer; at least one lower-case letter, upper-case letter and digit; a special character from the small set only when required; no `0 O 1 l I`; `crypto.getRandomValues` used (stubbed); every generated password meets the policy it was generated for.
- [ ] T016 [P] Write `tests/unit/shared/components/password-fields.spec.ts` for `PasswordInput.vue`, `NewPasswordFields.vue` and `PasswordPolicyChecklist.vue` (FR-022 to FR-025):
  - the show/hide button has `aria-pressed` and a label;
  - `autocomplete`: `current-password` on the current field, `new-password` on both new fields, and a hidden read-only `username` field holding the account address;
  - the confirmation mismatch is reported before submit with legacy `danger.password_mismatch`;
  - "Generate" fills both fields in clear text and offers a copy button;
  - each rule shows "met" or "not met" in text, and the polite region announces only when every rule is met;
  - server errors `tooShort`, `missingCharacterClass` and `preHashedPassword` appear on the field and mark the matching rule;
  - submission is never blocked by the checklist.
- [ ] T017 [P] Write `tests/unit/shared/components/secrets.spec.ts`. Move UI 001's `tests/unit/features/api-keys/ApiKeySecretDialog.spec.ts` cases into it, retargeted to `OneTimeSecretDialog.vue`, plus: the optional `username` above the secret; `grouped` rendering through `GroupedSecret.vue`; `CopyButton.vue` announcing success and failure; a failed copy keeping the value visible and selected (FR-111); `GroupedSecret.vue` rendering groups of four with visually hidden separators and copying the raw value (FR-113).
- [ ] T018 [P] Write `tests/unit/shared/composables/useSecretMutation.spec.ts` (research R13): the sink receives the secret member, the mutation's `data` lacks it, `gcTime` is 0, and after resolution no entry of the query cache or the mutation cache contains the secret string.
- [ ] T019 [P] Extend `tests/unit/api/client.spec.ts` and `tests/unit/api/query-client.spec.ts`:
  - `ApiProblem` exposes `requiredFlags`, `requiredFlagsMatch`, `dependency`, `attemptsRemaining` and `methods` from the problem body;
  - a mutation with `meta: { sessionReactions: false }` that fails with `second-factor-required` does not trigger the session reaction;
  - `permission-flag-required` invalidates `['identity']` and `['capabilities','self-service']` (research R6).
- [ ] T020 [P] Extend `tests/unit/i18n/problems.spec.ts` (research R23):
  - `permission-flag-required` names the flag labels joined by `Intl.ListFormat`, as a conjunction for `all` and a disjunction for `any`;
  - `temporary-failure` names each `dependency`, and an unknown dependency falls back;
  - `second-factor-enrolment-failed` gets `attemptsRemaining`;
  - `tooLong` with `unit: bytes` and with `stored: true`;
  - `sieveSyntax` with `message` and `line`; `preHashedPassword` with `scheme`; `missingCharacterClass` with the translated class;
  - the formats `email`, `pushoverCredential`, `soundName` and `digits`.
- [ ] T021 [P] Extend `tests/unit/app/navigation/visibility.spec.ts` (the `filters` row: administrator ✓, domain administrator ✓ whatever its `filters` flag, mailbox user —, placeholder until US10) and `tests/unit/app/router/guards.spec.ts`:
  - a route with `meta.public` resolves in the `anonymous`, `pendingSecondFactor`, `restricted` and `active` states;
  - an anonymous navigation to a non-home address sets `landingIntent` to `requested`;
  - a navigation to home leaves it `default`;
  - 001's session end sets `requested`.
- [ ] T022 [P] Write `tests/unit/app/session/landing.spec.ts` (research R20): `continueAfterSignIn()` opens a validated `returnTo` or home, runs registered hooks first with the current intent, resets the intent to `default` afterwards, lands normally with an announced notice when a hook fails, and stops when a hook navigates away.
- [ ] T023 [P] Write `tests/unit/features/account/AccountLayout.spec.ts` and `tests/unit/features/account/AccountHomePage.spec.ts`:
  - a section whose `ownVisibility` is `hidden` renders `NoAccessState` in place with the address kept and no section request (FR-006);
  - `unknown` renders the error state with "Try again";
  - `NoAccessState` shows a reason key when given;
  - the hub lists only sections whose routes are registered, grouped as FR-002 lists them, and hides empty groups;
  - from `lg` up the section navigation stays visible beside the content.
- [ ] T024 [P] Write `tests/unit/features/account/mailbox-context.spec.ts`:
  - `useAccountContext` resolves `own` (the identity's username) and `mailbox` (the route's address, lower-cased);
  - the "Self-service" group registered in UI 003's detail lists only sections with registered routes;
  - each section heading names the mailbox;
  - a `readOnly` section renders `ReadOnlyNotice` naming the flag;
  - groupware is hidden when disabled.
- [ ] T025 [P] Write `tests/e2e/account/my-account-shell.spec.ts`:
  - FR-001: "My account" in the navigation and the user menu, reachable in at most two interactions from any screen, for each role;
  - the hub for `admin-account` shows the security group without the overview group;
  - `capabilities-unavailable`: sections that depend on the capabilities show their error state with "Try again";
  - `/ng/filters` for `admin-account` shows the placeholder with the classic links until US10.

### Core implementation

- [ ] T026 [P] Implement `src/shared/validation/byte-length.ts`, `src/shared/password/policy.ts` and `src/shared/password/generate.ts`, so that T015 passes. If UI 003 implemented the generator or the policy hints in `src/features/mailboxes/`, move them here without behavioural change and update UI 003's imports.
- [ ] T027 Implement `src/shared/components/password/PasswordInput.vue`, `NewPasswordFields.vue` and `PasswordPolicyChecklist.vue`, so that T016 passes. Promote the show/hide toggle of UI 001's `PasswordForm.vue` or UI 003's password field (whichever exists) into `PasswordInput.vue`, and switch those components to it without behavioural change.
- [ ] T028 [P] Promote `src/features/api-keys/components/ApiKeySecretDialog.vue` to `src/shared/components/OneTimeSecretDialog.vue` (001-R20; optional `username`, `grouped`, title and warning keys) and implement `src/shared/components/CopyButton.vue` and `src/shared/components/GroupedSecret.vue`. Switch `src/features/api-keys/pages/ApiKeyCreatePage.vue` to the shared dialog, delete the old component and its unit test (moved in T017). T017 and UI 001's API key end-to-end tests must pass.
- [ ] T029 Implement `src/shared/composables/useSecretMutation.ts`, so that T018 passes, and use it for `createApiKey` in `src/features/api-keys/api.ts` (the `secret` handed to the dialog's sink).
- [ ] T030 Extend `src/api/problem.ts` (the extension members, typed from the generated problem schemas), `src/api/query/client.ts` (the `meta.sessionReactions` opt-out; the `permission-flag-required` reaction, unless UI 003 added it) and `src/api/query/keys.ts` (the roots of data-model §3), so that T019 passes.
- [ ] T031 Extend `src/i18n/problems.ts` with the parameter handling of research R23, so that T020 passes.
- [ ] T032 Implement `src/app/session/landing.ts` (`continueAfterSignIn()` and a hook registry), the `landingIntent` field in `src/app/session/store.ts`, and in `src/app/router/guards.ts` the `meta.public` rule and the intent changes. Then switch UI 001's landing call sites in `src/features/auth/composables/` (password and passkey sign-in), `src/features/auth/pages/SecondFactorPage.vue` and `src/features/auth/pages/PendingActionsPage.vue` to `continueAfterSignIn()`. T021, T022 and UI 001's sign-in tests must pass.
- [ ] T033 Add the `filters` row to `src/app/navigation/catalogue.ts`: path `/filters`, label `nav.filters`, administrator ✓, domain administrator ✓, mailbox user —, delivered by 005, `status: 'placeholder'`, with classic links `/admin/mailbox` and `/domainadmin/mailbox`. Place it after `aliases`. T021 must pass.
- [ ] T034 Implement `src/features/account/sections.ts` (data-model §2), `src/features/account/api/capabilities.ts` (`useSelfServiceCapabilities`, key `['capabilities','self-service']`, staleTime 5 min, usable signed out), and `src/features/account/composables/useAccountContext.ts` and `src/features/account/composables/useSectionAccess.ts`, so that T014 passes.
- [ ] T035 Implement:
  - `src/features/account/components/layout/AccountLayout.vue`, `SectionNav.vue`, `SectionCard.vue` and `ReadOnlyNotice.vue`;
  - `src/features/account/pages/AccountHomePage.vue`;
  - `src/features/account/routes.ts` with the `account` route (`meta.navEntry: 'account'`);
  - `src/features/account/mailbox-routes.ts`, an empty list for now;
  - `src/features/account/index.ts`.

  Register the routes in `src/app/router/routes.ts`, set the catalogue's `account` entry to `available`, add "My account" above "Passkeys" in `src/app/shell/UserMenu.vue`, and add the optional reason key to `src/app/states/NoAccessState.vue`. T023 must pass.
- [ ] T036 Register the "Self-service" group of the mailbox context in UI 003's section registry (`src/features/mailboxes/detail-sections.ts`, or the extension point UI 003's plan named) from the `mailboxRoute` descriptors of `sections.ts`. Only sections with registered routes appear, and headings name the mailbox. T024 must pass.
- [ ] T037 Add the `account.hub.*`, `account.sections.*`, `account.readOnly.*`, `permissionFlags.*` (`appPasswds`, `spamAlias`, `filters`, `pushover`, `delimiterAction`, `tlsPolicy`, `easReset`, `sogoProfileReset`, `pwReset`), `nav.filters` and `selfService.dependency.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. Map legacy `mailbox.filters` and `login.mobileconfig_info` in `src/i18n/legacy-map.json`. Run `npm run i18n:import`; `npm run i18n:check` must pass, and T025 must pass.

**Checkpoint**: The foundation is ready. My account opens for every role with an empty hub (no
section yet), the user menu links to it, and Mail setup › Filters is a placeholder. The mailbox
detail shows no self-service group until the first section registers its route (no placeholder,
conventions "Where features meet"). All Phase 2 tests pass.

---

## Phase 3: User Story 1 - Change my password, including a forced change (Priority: P1) 🎯 MVP

**Goal**: Every role changes its own password with live policy rules, "Sign out my other sessions"
and a result message; a forced password change is resolved on the pending-actions screen.

**Independent Test**: As each role, change the password with and without signing out other sessions.
As `forced-password-change` and `forced-both`, sign in and resolve the restriction; every other
address leads back to the screen.

### Tests for User Story 1 (write first; must fail)

- [ ] T038 [US1] Implement `tests/mocks/handlers/self-service/own-account.ts` (registered in the self-service index):
  - `getOwnPasswordPolicy`;
  - `changeOwnPassword`:
    - the current password is checked, except in a session restricted by `passwordChange`;
    - `current-password-incorrect`, and after 10 failures `429` with `retryAfter`;
    - `422` with `tooShort` (`min`), `missingCharacterClass` and `preHashedPassword` (`scheme`) on `newPassword`;
    - `password-managed-externally` for the Keycloak mailbox;
    - `endOtherSessions` (default true) ends and counts the other sessions in `sessionsEnded`;
    - `activeAppPasswords`, and `mailServerCacheSeconds: 300`;
    - success clears `passwordChange` and renews the session cookie.

  Create `tests/mocks/scenarios/own-password.ts` (registered in the index) with `password-throttled`, `password-changed-flow` and `forced-password-change-domain-admin`, and extend UI 001's `forced-password-change` and `forced-both` with a policy.
- [ ] T039 [P] [US1] Write `tests/e2e/account/password.spec.ts`. It covers:
  - US1-AS1 on `domain-admin-account`: "Password changed, 2 other sessions signed out", fields cleared, still signed in; and with the box unticked, `endOtherSessions: false` asserted through `mockApi.requests()`;
  - US1-AS2: a wrong current password shows the error on its field, and on `password-throttled` the "too many attempts" countdown appears;
  - US1-AS3: typing "summer" marks the 10-character and digit rules as not met, and a refused save shows both on the new-password field;
  - US1-AS4 on `mailbox-account`: "your 3 app passwords keep working";
  - US1-AS8 on `mailbox-external-source`: the external notice and no form;
  - FR-023: the mismatch before submit;
  - FR-024: show/hide by keyboard, the autocomplete attributes and the hidden username field;
  - FR-025: "Generate" fills both fields and offers copy;
  - FR-026: the message about mail apps accepting the old password for up to 5 minutes (spec edge case);
  - FR-012: `preHashedPassword` on the field;
  - FR-015: leaving with typed input asks for confirmation.
- [ ] T040 [P] [US1] Write `tests/e2e/pending-actions/forced-password.spec.ts`. It covers:
  - US1-AS5: the "Set a new password" form without a current-password field, with legacy `user.pw_update_required`; any other address shows the screen again; the same for a domain administrator (`forced-password-change-domain-admin`);
  - US1-AS6: a valid password lands on home; on `forced-both` the second-factor setup is shown next (FR-031);
  - US1-AS7: "Sign out" ends the session;
  - FR-030: policy rules, show/hide and "Generate";
  - FR-031: `returnTo` is honoured after the change;
  - Edge: a reload resumes the screen;
  - Edge: the language and theme choices still work on the screen.
- [ ] T041 [P] [US1] Write `tests/unit/features/account/OwnPasswordForm.spec.ts` (`endOtherSessions` ticked by default; the message built from `sessionsEnded`, `activeAppPasswords` and `mailServerCacheSeconds` with Czech plural forms; fields cleared; problem mapping) and `tests/unit/features/auth/ForcedPasswordChange.spec.ts`. Extend `tests/unit/features/auth/PendingActionsPage.spec.ts` with the linear flow: password first, the second-factor item as "next step", refetch of `session` and `identity` after success, and no classic link or "Check again" for `passwordChange`.
- [ ] T042 [P] [US1] Update `tests/smoke/pending-actions.smoke.spec.ts` (it assumes the freshly reset dev database of `scripts/smoke/stack-up.sh`): `bob@example.org` signs in, sets a new password on the pending-actions screen (no classic link, no "Check again") and lands on home. Create `tests/smoke/account-credentials.smoke.spec.ts` as a `test.describe.serial` block, tagged `@005`, whose first case signs in as `alice@example.org` with TOTP, changes her password in My account › Password, signs in with the new one, and changes it back.

### Implementation for User Story 1

- [ ] T043 [US1] Implement `src/features/account/api/password.ts` (`useOwnPasswordPolicy`, `useChangeOwnPassword` with the invalidation of data-model §3) and `src/features/account/api/overview.ts` (`useOwnMailboxOverview`, key `['me','mailbox']`, staleTime 5 min). Export the password hooks from `src/features/account/index.ts` for the pending-actions screen.
- [ ] T044 [US1] Implement `src/features/account/components/password/OwnPasswordForm.vue` and `ExternalPasswordNotice.vue`, and `src/features/account/pages/PasswordPage.vue`. Add the `account-password` route to `src/features/account/routes.ts`.
- [ ] T045 [US1] Implement `src/features/auth/components/pending/ForcedPasswordChange.vue`, and change `src/features/auth/pages/PendingActionsPage.vue` and `src/features/auth/components/PendingActionItem.vue` to the linear flow of research R8. Remove the classic link and "Check again" of the password action; continue through `continueAfterSignIn()` once no action is pending.
- [ ] T046 [US1] Add the `account.password.*` and `auth.pendingActions.passwordChange.*` messages, including new plural keys for "{n} other sessions signed out" and "{n} app passwords keep working" (the latter replaces `user.change_password_hint_app_passwords`, starting from its legacy text), to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. Map `user.pw_update_required`, `login.new_password`, `login.new_password_confirm`, `success.password_changed_success`, `danger.password_mismatch` and `danger.password_complexity` (the summary when the policy refuses a password) in `src/i18n/legacy-map.json`. Write the missing values: `user.pw_update_required` in cs-cz and sk-sk; `login.new_password`, `login.new_password_confirm` and `success.password_changed_success` in sk-sk. `npm run i18n:check` must pass.

**Checkpoint**: US1 works on its own: T039–T042 pass. This is the MVP: forced password changes no
longer need the classic interface.

---

## Phase 4: User Story 2 - Set up and remove second factors, including forced setup (Priority: P1)

**Goal**: Every eligible account lists, adds (authenticator app, security key, Yubico OTP) and removes
its second factors; forced setup offers every method on the pending-actions screen.

**Independent Test**: As each role, add a TOTP factor (code computed from the displayed key), a
security key (virtual authenticator) and a Yubico OTP key; remove entries until none remain. As
`forced-second-factor`, resolve the restriction with each method.

### Tests for User Story 2 (write first; must fail)

- [ ] T047 [US2] Implement `tests/mocks/handlers/self-service/second-factors.ts`:
  - `listOwnSecondFactors` (`sort`, `q`, paging);
  - `startOwnTotpEnrolment`: a 32-character base32 secret, an `otpauth://totp/` address, `qrCode` from the factory, `expiresAt` now + 600 s; a new start replaces the old one;
  - `enrolOwnSecondFactor`:
    - TOTP verified with `tests/support/totp.ts` (±1 step): five attempts with `attemptsRemaining`, then the enrolment is removed;
    - `second-factor-enrolment-expired`;
    - the current password required unless restricted by `secondFactorSetup`;
    - names of 1–255 characters;
    - WebAuthn: single-use options, the credential ID taken from `rawId`;
    - Yubico OTP: client ID of digits and a 44-character OTP; a rejection switch answers `second-factor-enrolment-failed`, the outage switch answers `503 temporary-verification-failure` with `Retry-After`; the same public ID replaces the entry;
  - `createOwnSecondFactorWebAuthnOptions`: `excludeCredentials` of the account's WebAuthn factors;
  - `deleteOwnSecondFactor`: `409 last-second-factor` for the only active usable entry, `403 second-factor-required-by-policy`;
  - `removeAllOwnSecondFactors`: current password, policy refusal;
  - `password-managed-externally` for external sources;
  - an enrolment lifts `secondFactorSetup`.

  Create `tests/mocks/scenarios/two-factor.ts` (registered in the index) with `two-factor-empty`, `two-factor-two-active`, `two-factor-single-active`, `two-factor-required-by-policy`, `two-factor-inactive-and-unsupported` (an inactive TOTP and a `u2f` entry) and `yubico-outage-enrolment`. Extend UI 001's `forced-second-factor` and `forced-both`.
- [ ] T048 [P] [US2] Write `tests/e2e/account/two-factor.spec.ts`. It covers:
  - US2-AS1: the empty state with the explanation and, for mailbox users, the app password note; "Add authenticator app", "Add security key" and "Other methods";
  - US2-AS6: removing one of two entries needs no password;
  - US2-AS7: the only active entry offers "Turn off two-factor authentication", which states that passkeys stay, asks for the current password and ends in the empty state;
  - US2-AS8: no removal and the policy note;
  - FR-043: type, name, state, Yubico public ID and "used for this sign-in" as text;
  - FR-044: the passkeys pointer;
  - FR-053: the turn-off action;
  - FR-055: legacy `user.tfa_info` linking to App passwords;
  - Edge: inactive entries listed as inactive;
  - Edge: an unsupported entry listed as "no longer supported", removable and not counted as the active entry;
  - Edge: a `second-factor-required-by-policy` or `last-second-factor` refusal after a change elsewhere refreshes and explains.
- [ ] T049 [P] [US2] Write `tests/e2e/account/two-factor-enrolment.spec.ts`. It covers:
  - US2-AS2: TOTP with the name, a code computed from the key shown on screen and the current password, for `admin-account`, `domain-admin-account` and `two-factor-empty` (a mailbox user); the entry appears and the key is gone;
  - US2-AS3: a wrong code keeps the same key with "attempts left"; an expiry (`mockApi.patch`) or five wrong codes offer "Start again";
  - US2-AS4: at 360 px "Open in authenticator app" and "Copy key" come before the QR code in document order;
  - FR-113: the QR code's text alternative points to the key, and the key is read in groups;
  - FR-047: numeric keyboard and `one-time-code` autocomplete;
  - `@virtual-authenticator`: a security key enrols (and with `stubCredentials` on WebKit);
  - US2-AS5: without WebAuthn the security key option is unavailable with an explanation, and the others work;
  - FR-049: a cancelled ceremony (`NotAllowedError`) and an already enrolled key (`InvalidStateError`) are explained with "Try again";
  - FR-050: Yubico OTP submits on the key's final Enter;
  - Edge: the Yubico outage names the service with "Try again";
  - Edge: the same YubiKey again leaves one entry;
  - Edge: a key that is also a passkey enrols and is listed in its own section;
  - Edge: an enrolment started in another tab is reported as expired;
  - Edge: the clock hint on a wrong code;
  - Edge: a refused copy keeps the key visible and selectable;
  - FR-045: name limits and `current-password-incorrect`.
- [ ] T050 [P] [US2] Write `tests/e2e/pending-actions/forced-second-factor.spec.ts`. It covers:
  - US2-AS9: the setup explanation (legacy `tfa.setup_title`, `tfa.setup_required`) and every other address leads back;
  - FR-058: the order passkey, authenticator app, security key, then Yubico OTP under "Other methods", without current-password fields;
  - completing TOTP lands on home (or `returnTo`);
  - `@virtual-authenticator`: a security key, and a passkey (UI 001), each lift the restriction;
  - Yubico OTP lifts it;
  - FR-057: without passkey support the other methods replace the classic link;
  - `forced-both`: after the password, the methods appear (depends on T045);
  - Edge: a reload resumes the screen.
- [ ] T051 [P] [US2] Write these unit tests:
  - `tests/unit/features/account/qr-svg.spec.ts`: the factory's SVG parses to the tree of data-model §2; `<script>`, `foreignObject`, `on*` attributes, `href`, `style`, a `url(…)` fill, a non-SVG or non-base64 data URI and a parser error each yield `null`;
  - `tests/unit/features/account/QrCode.spec.ts`: renders `svg` elements through `h()`, `role="img"` with the label, the fallback note for `null`;
  - `tests/unit/features/account/totp.spec.ts`: `isOtpauthUri`;
  - `tests/unit/features/account/useTotpEnrolment.spec.ts`: the state machine of data-model §7, the enrolment held outside every cache, discarded on success, cancel, expiry and unmount, and the countdown with the `Date`-header skew;
  - `tests/unit/features/account/useSecurityKeyEnrolment.spec.ts`: the error table of research R11 and the announcements;
  - `tests/unit/features/account/SecondFactorList.spec.ts`: the "only active entry" rule, unsupported entries not counted, policy hiding actions;
  - `tests/unit/features/account/YubicoOtpSetup.spec.ts`: validation and submit on Enter.
- [ ] T052 [P] [US2] Create `tests/smoke/account.smoke.spec.ts` (tagged `@005`). Its first case: `alice@example.org` signs in with TOTP, sees her TOTP entry marked as used for this sign-in, adds a second TOTP with a code computed from the displayed key, and removes it again without a password.

### Implementation for User Story 2

- [ ] T053 [US2] Implement `src/features/account/api/second-factors.ts`: the list, enrolment, WebAuthn options, single and full removal with the invalidation of data-model §3 (and the `session`/`identity` refetch in a restricted session), and `startTotpEnrolment()` as a direct client call outside every cache.
- [ ] T054 [US2] Implement `src/features/account/totp.ts` (`isOtpauthUri`), `src/features/account/qr-svg.ts` and `src/features/account/components/two-factor/QrCode.vue`, so that the qr-svg, QrCode and totp tests of T051 pass.
- [ ] T055 [P] [US2] Implement `src/features/account/composables/useTotpEnrolment.ts` and `src/features/account/components/two-factor/TotpSetup.vue` (prop `requireCurrentPassword`, `GroupedSecret`, `CopyButton`, `QrCode`, `useCountdown`, leave confirmation), following research R10.
- [ ] T056 [P] [US2] Implement `src/features/account/composables/useSecurityKeyEnrolment.ts`, `src/features/account/components/two-factor/SecurityKeySetup.vue` and `src/features/account/components/two-factor/YubicoOtpSetup.vue` (prop `requireCurrentPassword`; the `tfa.api_register` link slot to `https://upgrade.yubico.com/getapikey/`), following research R11.
- [ ] T057 [US2] Implement `src/features/account/components/two-factor/SecondFactorList.vue`, `SecondFactorItem.vue`, `AddSecondFactorMenu.vue` and `TurnOffTwoFactorDialog.vue`, plus `src/features/account/pages/TwoFactorPage.vue` and `src/features/account/pages/AddSecondFactorPage.vue`. Add the `account-two-factor` and `account-two-factor-add` routes to `src/features/account/routes.ts`. Export `TotpSetup`, `SecurityKeySetup` and `YubicoOtpSetup` from `src/features/account/index.ts`.
- [ ] T058 [US2] Implement `src/features/auth/components/pending/ForcedSecondFactorSetup.vue` and integrate it into `src/features/auth/pages/PendingActionsPage.vue` (research R8): method order, the passkey through `usePasskeyRegistration`, inline enrolment without the password, then refetch and `continueAfterSignIn()`.
- [ ] T059 [US2] Add the `account.twoFactor.*` and `auth.pendingActions.secondFactor.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. Map in `src/i18n/legacy-map.json`: `tfa.tfa`, `tfa.totp`, `tfa.webauthn`, `tfa.yubi_otp`, `tfa.key_id`, `tfa.key_id_totp`, `tfa.scan_qr_code`, `tfa.enter_qr_code`, `tfa.confirm_totp_token`, `tfa.api_register` (`html: plain`, link slot), `tfa.setup_title`, `tfa.setup_required`, `tfa.start_webauthn_validation`, `tfa.delete_tfa`, `danger.totp_verification_failed`, `danger.yotp_verification_failed`, `danger.webauthn_verification_failed` and `user.tfa_info`. Write the missing values (`tfa.setup_title` and `tfa.setup_required` in cs-cz and sk-sk; `user.tfa_info` in sk-sk). `npm run i18n:check` must pass.

**Checkpoint**: US1 and US2 work on their own; every forced restriction is resolved in the app
(SC-002).

---

## Phase 5: User Story 3 - Reset a forgotten password with the recovery e-mail (Priority: P1)

**Goal**: Mailbox users keep a recovery address; "Forgot password?" leads to the request screen and
the e-mailed link to the reset page, with the second factor of sign-in.

**Independent Test**: Set a recovery address; sign out; request a reset; open the scenario's token
link; reset with and without a TOTP factor; open an expired and a used token; check the unavailable
server.

### Tests for User Story 3 (write first; must fail)

- [ ] T060 [US3] Extend `tests/mocks/handlers/self-service/own-account.ts` with:
  - `getOwnRecoveryEmail`;
  - `replaceOwnRecoveryEmail`: the current password; `pwReset` needed unless the address stays the same; `null` or `""` removes it; `If-Match` and `412`; `forbidden` for administrators; `password-managed-externally`.

  Implement `tests/mocks/handlers/self-service/password-reset.ts`:
  - `requestPasswordReset`: the same acknowledgement for every well-formed address; `password-reset-unavailable`; `429` after 10 requests; `422` for a malformed address;
  - `checkPasswordResetToken`: tokens of the scenario with address, expiry, policy and methods; unknown, expired and used tokens answer `400 invalid-reset-token`;
  - `createPasswordResetWebAuthnChallenge`;
  - `completePasswordReset`:
    - password rules first (`422`);
    - `401 second-factor-required` with `methods` when no factor is sent;
    - `401 second-factor-failed` with the token still valid;
    - `403 second-factor-unavailable` for an account with only unsupported entries;
    - `503 temporary-verification-failure`;
    - success invalidates every token of the account and ends all its sessions, including this browser's when it is signed in as that account.

  Create `tests/mocks/scenarios/password-reset.ts` (registered in the index) with:
  - `password-reset`: a token `3F9A1C-0B7E22-9D4F10-A6C3E8-51B2D7` for a mailbox without second factors, a token for a TOTP mailbox, an expired, a used and an unsupported-only token;
  - `password-reset-unavailable`, `password-reset-throttled`, `password-reset-signed-in`;
  - `mailbox-recovery` (with `pwReset`) and `mailbox-no-pw-reset` (an address set by an administrator, no flag).
- [ ] T061 [P] [US3] Write `tests/e2e/account/recovery-email.spec.ts`. It covers:
  - US3-AS1: set an address with the current password, then clear it with confirmation;
  - US3-AS2: without `pwReset` the section is absent (the overview part is in T082);
  - FR-032: `type="email"`;
  - FR-033: legacy `user.password_reset_info`;
  - FR-016: a `412` keeps the address, not the password, and reloads;
  - `current-password-incorrect` on the field.
- [ ] T062 [P] [US3] Write `tests/e2e/password-reset/request.spec.ts`. It covers:
  - US3-AS3: the same confirmation, with the 15-minute lifetime, for a known, an unknown and an ineligible address;
  - US3-AS7: no "Forgot password?" on `password-reset-unavailable`, and the request screen says recovery is unavailable;
  - FR-034: the link only on the role-neutral and mailbox-user screens, and not under force SSO;
  - FR-037: `password-reset-throttled` shows the countdown;
  - the address validation.
- [ ] T063 [P] [US3] Write `tests/e2e/password-reset/reset-page.spec.ts`. It covers:
  - US3-AS4: the account address, the validity time (relative and absolute) and the rules; `page.url()` has no token right after the load, and going back does not reveal it (FR-038); the same with the `#token=` form;
  - US3-AS5 with the TOTP token: the password step, then the second-factor step as at sign-in; a wrong code allows another try; a right code confirms and offers sign-in without signing in (FR-041);
  - US3-AS6: expired and used tokens show the invalid state with "Request a new link";
  - Edge (FR-042) on `password-reset-signed-in`: the warning "including this one", then completion ends this session without leaving the page, and a second page of the context shows the signed-out state;
  - Edge: a new browser context completes the reset;
  - Edge: an unsupported-only token says to ask an administrator;
  - Edge: `password-reset-throttled` on the completion;
  - Edge: the Yubico outage keeps the step with a retry;
  - `@virtual-authenticator`: the WebAuthn factor through `createPasswordResetWebAuthnChallenge`;
  - Edge: a reload after the token was read shows the invalid state;
  - the countdown reaching zero (`page.clock`) shows the invalid state;
  - SC-008: the token is not in storage, `history.state` or the console.
- [ ] T064 [P] [US3] Write these unit tests:
  - `tests/unit/features/auth/reset-token.spec.ts`: `beforeEnter` moves the token from `?token=` or `#token=` into the holder and returns the route without query and hash with `replace: true`; the holder is read once and cleared;
  - `tests/unit/features/auth/usePasswordReset.spec.ts`: the state machine of data-model §7, `meta.sessionReactions: false` on the completion, and the session-end clean-up without redirect;
  - `tests/unit/features/auth/ForgotPasswordLink.spec.ts`: hidden while loading, on error and when unavailable;
  - `tests/unit/features/account/RecoveryEmailForm.spec.ts`.
- [ ] T065 [P] [US3] Add to `tests/smoke/account-credentials.smoke.spec.ts` (serial, `@local-stack`): `alice@example.org` sets a recovery address and signs out; a reset is requested; the token is read from the dev database by `tests/smoke/fixtures/reset-token.ts` (`docker compose exec` on `$MAILCOW_REST_V2_DIR`); the link is opened and completed with a TOTP code; alice signs in with the new password and restores the old one in My account.

### Implementation for User Story 3

- [ ] T066 [US3] Implement `src/features/account/api/recovery-email.ts`, `src/features/account/components/recovery/RecoveryEmailForm.vue` and `src/features/account/pages/RecoveryEmailPage.vue`. Add the `account-recovery-email` route to `src/features/account/routes.ts`.
- [ ] T067 [US3] Implement `src/features/auth/reset-token.ts`, the reset mutations in `src/features/auth/api.ts` (with `meta.sessionReactions: false`) and `src/features/auth/composables/usePasswordReset.ts`.
- [ ] T068 [US3] Give `src/features/auth/components/TotpForm.vue`, `YubiOtpForm.vue`, `WebAuthnFactor.vue` and `OtherMethods.vue`, and `src/features/auth/composables/useSecondFactor.ts`, a `submit(proof)` callback and a challenge provider, so that the sign-in step and the reset page share them. UI 001's second-factor tests must still pass.
- [ ] T069 [US3] Implement `src/features/auth/pages/PasswordResetRequestPage.vue`, `src/features/auth/pages/PasswordResetPage.vue` and `src/features/auth/components/ResetSignedInNotice.vue`. Add the `password-reset-request` and `password-reset` routes, with `meta.public` and the token-capturing `beforeEnter` (query or fragment), to `src/features/auth/routes.ts`.
- [ ] T070 [US3] Implement `src/features/auth/components/ForgotPasswordLink.vue` and use it in `src/features/auth/pages/SignInPage.vue` in place of UI 001's classic `/reset-password` link. Remove the now unused reset constant from `src/app/navigation/classic-links.ts`, and update UI 001's FR-009 tests in `tests/e2e/sign-in/sign-in-screen.spec.ts` and `tests/unit/features/auth/SignInPage.spec.ts`.
- [ ] T071 [US3] Add the `account.recoveryEmail.*` and `auth.passwordReset.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` (the link text keeps UI 001's mapping of `login.forgot_password`). Map `login.reset_password`, `login.request_reset_password`, `login.invalid_pass_reset_token` (`html: plain`) and `user.password_reset_info` in `src/i18n/legacy-map.json`, and write their missing sk-sk values. `npm run i18n:check` must pass.

**Checkpoint**: All P1 stories but app passwords work; a locked-out user recovers without the
classic interface.

---

## Phase 6: User Story 4 - Create and manage app passwords (Priority: P1)

**Goal**: Mailbox users (and administrators or permitted domain administrators in the mailbox
context) create server-generated app passwords shown once, rename them, change protocols, deactivate,
regenerate and delete them.

**Independent Test**: As `mailbox-account`, create an app password for IMAP and SMTP, copy it,
deactivate it, regenerate it and delete it. Repeat in the mailbox context as an administrator and as
domain administrators with and without the flag.

### Tests for User Story 4 (write first; must fail)

- [ ] T072 [US4] Implement `tests/mocks/handlers/self-service/app-passwords.ts`:
  - `listAppPasswords`: `q`, `active`, `sort`, `order`, paging;
  - `createAppPassword`: a 32-character `generatedPassword`, the stored name length (`tooLong` with `stored: true`), all six protocols by default, an empty list accepted, `Location` and `ETag`;
  - `getAppPassword`;
  - `updateAppPassword`: name, protocols, active, `generatePassword: true`; `mutuallyExclusive` with `password`;
  - `deleteAppPassword`;
  - `If-Match` and `412`;
  - the flags (the mailbox user's `appPasswds`, the domain administrator's `appPasswds`) answer `permission-flag-required` with `requiredFlags`;
  - `404` outside the scope.

  Create `tests/mocks/scenarios/app-passwords.ts` (registered in the index) with `app-passwords-empty`, `mailbox-no-app-passwords-flag`, `admin-mailbox-context`, `app-password-changed-elsewhere` and `app-passwords-flag-withdrawn` (the flag removed after the first read).
- [ ] T073 [P] [US4] Write `tests/e2e/account/app-passwords.spec.ts`. It covers:
  - US4-AS1: the empty state;
  - US4-AS2: "Phone" with IMAP and SMTP shows the password once in groups, with a copy button and the mailbox address as username; closing without copying asks for confirmation;
  - US4-AS3: the list shows name, protocols, active state and creation date, and no password;
  - US4-AS4: "Generate new password" confirms and shows a new one once;
  - US4-AS5: delete with confirmation;
  - US4-AS6: without the flag, the section's address shows "no access";
  - FR-061: all protocols ticked by default, and the warning when none is chosen (spec edge case);
  - FR-063: Escape and Back while the dialog is open ask the same confirmation;
  - FR-064: rename, protocols and active switch;
  - FR-067: the explanations;
  - FR-018: search, active filter, sort and paging kept in the address;
  - Edge: a refused copy keeps the password visible and selectable;
  - Edge: leaving the page after creation never shows the password again, and the detail offers "Generate new password";
  - Edge: `app-passwords-flag-withdrawn` reports the withdrawn permission and hides the section;
  - Edge: a `412` reloads, keeps the input and marks the changed values;
  - SC-003: creation and copy take at most 4 interactions from My account.
- [ ] T074 [P] [US4] Write `tests/e2e/mailbox-self-service/app-passwords.spec.ts`. It covers:
  - on `admin-mailbox-context`, create, regenerate and delete for `anna@example.org`, with the heading naming the mailbox;
  - US4-AS7 on `domain-admin-no-flags`: read-only list and detail without create, change or delete, and the notice naming the permission;
  - `domain-admin-account` (flag on) can manage;
  - Edge: a mailbox outside the scope shows "not found".
- [ ] T075 [P] [US4] Write `tests/unit/features/account/AppPasswordForm.spec.ts`, `tests/unit/features/account/ProtocolCheckboxes.spec.ts`, `tests/unit/features/account/AppPasswordDetailPage.spec.ts` (regeneration through `useSecretMutation`, no secret in any cache) and `tests/unit/features/account/list-state.spec.ts` (the app password parameters of data-model §5).
- [ ] T076 [P] [US4] Add to `tests/smoke/account.smoke.spec.ts`: alice creates the app password "Smoke" for IMAP and SMTP, sees it listed without a password, and deletes it. Create `tests/smoke/mailbox-self-service.smoke.spec.ts` (tagged `@005`): `admin` opens alice's app passwords in the mailbox context and sees the seeded entries.

### Implementation for User Story 4

- [ ] T077 [US4] Implement `src/features/account/api/app-passwords.ts` (`useSecretMutation` for creation and regeneration; the invalidation of data-model §3) and the app password schema in `src/features/account/list-state.ts`.
- [ ] T078 [P] [US4] Implement `src/features/account/components/app-passwords/AppPasswordList.vue`, `AppPasswordCard.vue`, `AppPasswordTable.vue`, `AppPasswordFilters.vue`, `AppPasswordForm.vue` and `ProtocolCheckboxes.vue`.
- [ ] T079 [US4] Implement `src/features/account/pages/AppPasswordsPage.vue`, `AppPasswordCreatePage.vue` and `AppPasswordDetailPage.vue` for both contexts. Add the routes `account-app-passwords`, `account-app-password-create` and `account-app-password-detail` to `src/features/account/routes.ts`, and `mailbox-app-passwords`, `mailbox-app-password-create` and `mailbox-app-password-detail` to `src/features/account/mailbox-routes.ts`.
- [ ] T080 [US4] Add the `account.appPasswords.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. Map `add.app_password`, `add.app_name`, `add.app_passwd_protocols`, `user.app_hint` and `success.app_passwd_added` in `src/i18n/legacy-map.json`. `npm run i18n:check` must pass.

**Checkpoint**: All P1 stories (US1 to US4) work.

---

## Phase 7: User Story 5 - See my mailbox at a glance and open webmail (Priority: P2)

**Goal**: The mailbox overview, the home card with storage and Webmail, the Webmail action through
the hand-off, and forwarding to webmail after sign-in.

**Independent Test**: As `mailbox-account`, compare every overview value with the scenario; open
webmail (new tab, blocked tab). As `mailbox-webmail-redirect`, sign in from the sign-in screen and
from a deep link.

### Tests for User Story 5 (write first; must fail)

- [ ] T081 [US5] Extend `tests/mocks/handlers/self-service/overview.ts` with `createWebmailHandOff`:
  - `Set-Cookie: MCSESSID=…; Path=/; HttpOnly; SameSite=Lax`, `Cache-Control: no-store` and `url: /SOGo/so/`;
  - `groupware-disabled`, `forbidden` for other roles, and `pending-action-required` when restricted;
  - a recent-login entry `SSO` added to the state.

  Create `tests/mocks/scenarios/overview.ts` (registered in the index) with `mailbox-no-imap`, `mailbox-webmail-redirect`, `mailbox-unlimited-quota` and `mailbox-impersonated` (an identity with feature 007's `impersonation` member, present at the pin).
- [ ] T082 [P] [US5] Write `tests/e2e/account/overview-webmail.spec.ts`. It covers:
  - US5-AS1: "256 MiB of 1 GiB used (25 %)" with a bar that has a text equivalent, also in Czech number formatting;
  - US5-AS2: "IMAP: not allowed" in text;
  - US5-AS3: Webmail opens a new page at `/SOGo/so/` (route stub); with `window.open` returning `null`, an "Open webmail" link appears;
  - US5-AS4: on `mailbox-webmail-redirect`, a sign-in from the sign-in screen opens `/SOGo/so/` in the same tab; a sign-in after opening `/ng/account/filters` opens that address; a re-authentication after a session end does not forward;
  - US5-AS5: with groupware disabled there is no Webmail action;
  - FR-097: every field, with the counts linking to their sections when visible;
  - FR-099: the help text;
  - FR-001: the home card with storage and Webmail;
  - US3-AS2 (overview part): the recovery address set by an administrator is shown without `pwReset`;
  - FR-098: no Webmail action on `mailbox-impersonated`;
  - Edge: a failed hand-off closes the blank tab and shows the problem.
- [ ] T083 [P] [US5] Write these unit tests:
  - `tests/unit/features/account/useWebmailHandOff.spec.ts`: `window.open` called synchronously in the click, `opener` cleared, `location.replace`, a blocked tab gives the link, a failure closes the tab;
  - `tests/unit/features/account/webmail-forwarding.spec.ts`: the conditions role, intent, pending actions, `redirectAfterSignIn` and `webmail.enabled`; a failure lands normally;
  - `tests/unit/features/account/QuotaUsage.spec.ts`: percentage, unlimited, text equivalent, `aria-valuenow`;
  - `tests/unit/features/account/ProtocolAccessList.spec.ts`.
- [ ] T084 [P] [US5] Add to `tests/smoke/account.smoke.spec.ts`: alice's overview shows her address and quota; Webmail opens a new page at `/SOGo/so/` and the context holds the legacy session cookie (the page's status is not asserted when the dev stack runs without SOGo).

### Implementation for User Story 5

- [ ] T085 [US5] Implement `src/features/account/api/webmail.ts`, `src/features/account/composables/useWebmailHandOff.ts` and `src/features/account/components/overview/WebmailAction.vue` (research R20).
- [ ] T086 [P] [US5] Implement `src/features/account/components/overview/MailboxOverview.vue`, `QuotaUsage.vue`, `ProtocolAccessList.vue`, `AddressLists.vue` and `MailboxHomeCard.vue`, and show the overview at the top of `src/features/account/pages/AccountHomePage.vue` for mailbox users. Sizes come from the byte formatter in `src/i18n/format.ts`; add `formatBytes` there if UI 002 or 003 did not.
- [ ] T087 [US5] Implement `src/features/account/webmail-forwarding.ts`, register it as a landing hook in `src/app/session/landing.ts`, and show `MailboxHomeCard` for mailbox users in `src/features/home/pages/HomePage.vue`.
- [ ] T088 [US5] Add the `account.overview.*` and `account.webmail.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. Map `user.open_webmail_sso`, `user.direct_protocol_access` (`html: plain`) and `edit.sogo_access` (the overview's statement that the mailbox goes straight to webmail after sign-in) in `src/i18n/legacy-map.json`. `npm run i18n:check` must pass.

**Checkpoint**: US1 to US5 work on their own.

---

## Phase 8: User Story 6 - Use temporary aliases (Priority: P2)

**Goal**: Generate temporary aliases with a domain, description and validity; copy them; change the
validity of or delete one or several; the same in the mailbox context.

**Independent Test**: As `temporary-aliases-many`, generate an alias valid for one day, make several
permanent with one failing, delete them. Repeat in the mailbox context.

### Tests for User Story 6 (write first; must fail)

- [ ] T089 [US6] Implement `tests/mocks/handlers/self-service/temporary-aliases.ts`:
  - `listTemporaryAliases`: `q`, `permanent`, `sort`, `order`, paging; expired aliases are not listed;
  - `createTemporaryAlias`: `notInList` with `allowed` for a foreign domain; `lifetimeHours` within 1–87,600; `permanent`; description; a random readable address; `503 temporary-failure` with `dependency: addressGeneration` by switch;
  - `updateTemporaryAlias` (`lifetimeHours` or `permanent: true`) and `deleteTemporaryAlias`, with `If-Match`, `412`, and `404` for an expired alias;
  - `listTemporaryAliasDomains`;
  - the `spamAlias` flag; scope.

  Create `tests/mocks/scenarios/temporary-aliases.ts` (registered in the index) with:
  - `temporary-aliases-empty`;
  - `temporary-aliases-many`: 30 aliases, permanent and expiring, the mailbox domain plus one alias domain, and one alias whose change fails by failure injection;
  - `temporary-aliases-single-domain`;
  - `temporary-alias-expired-meanwhile`.
- [ ] T090 [P] [US6] Write `tests/e2e/account/temporary-aliases.spec.ts`. It covers:
  - US6-AS1: the empty state with legacy `user.spam_aliases_info`;
  - US6-AS2: domain, "Shop" and one year (preselected from the capabilities) show the new address with a copy button, and it appears in the list with its expiry;
  - US6-AS3: two selected and "Expire in 1 week" report the result per alias, and the failed one stays selected;
  - US6-AS4: "Never expires";
  - US6-AS5: delete with confirmation;
  - US6-AS6 on `temporary-aliases-single-domain`: no domain choice;
  - FR-068: columns, sort, permanence filter and search in the address;
  - FR-069: only the presets within the capability range;
  - FR-072: deleting several needs the typed number;
  - FR-019: the selection clears on page, sort or filter change; a dropped connection (`route.abort`) is reported as "outcome unknown" and not retried;
  - Edge: an alias that expired meanwhile reports "not found" and disappears;
  - FR-124: the selection mode at 360 px.
- [ ] T091 [P] [US6] Write `tests/e2e/mailbox-self-service/temporary-aliases.spec.ts`: an administrator and a domain administrator generate an alias in the mailbox context with the domain choice; UI 003's FR-040 count links to the section and is updated after the generation.
- [ ] T092 [P] [US6] Write `tests/unit/features/account/validity.spec.ts` (presets, range filter, default), `tests/unit/features/account/GenerateAliasPanel.spec.ts`, and extend `tests/unit/features/account/list-state.spec.ts` with the alias parameters.
- [ ] T093 [P] [US6] Add to `tests/smoke/account.smoke.spec.ts`: alice generates an alias valid for one day, makes it permanent and deletes it.

### Implementation for User Story 6

- [ ] T094 [US6] Implement `src/features/account/api/temporary-aliases.ts` (including `listTemporaryAliasDomains` with `limit: 1000`), `src/features/account/validity.ts`, and the alias schema in `src/features/account/list-state.ts`.
- [ ] T095 [P] [US6] Implement `src/features/account/components/temporary-aliases/TemporaryAliasList.vue`, `TemporaryAliasCard.vue`, `TemporaryAliasTable.vue`, `TemporaryAliasFilters.vue`, `GenerateAliasPanel.vue` and `ValiditySelect.vue`. Selection and outcomes use UI 002's `useBulkSelection`, per-item runner and `BulkResultSummary`.
- [ ] T096 [US6] Implement `src/features/account/pages/TemporaryAliasesPage.vue` for both contexts. Add `account-temporary-aliases` to `src/features/account/routes.ts` and `mailbox-temporary-aliases` to `src/features/account/mailbox-routes.ts`. Link UI 003's FR-040 count of active temporary aliases to the section, through `src/features/mailboxes/detail-sections.ts`.
- [ ] T097 [US6] Add the `account.temporaryAliases.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. Map `user.spam_aliases_info` (`html: plain`) and the validity labels whose legacy meaning is unchanged (for example `user.expire_never`) in `src/i18n/legacy-map.json`, and write the missing sk-sk value of `user.spam_aliases_info`. `npm run i18n:check` must pass.

**Checkpoint**: US1 to US6 work on their own.

---

## Phase 9: User Story 7 - Adjust mail settings and push notifications (Priority: P2)

**Goal**: Tagged-mail handling and TLS enforcement saved on change, the Pushover form with write-only
credentials, verification and removal, both contexts, and bulk TLS from the mailbox list.

**Independent Test**: As `mailbox-account`, set tagging and TLS; save, verify and remove Pushover.
Turn each flag off and confirm the control is absent. As an administrator, enforce outbound TLS for
30 selected mailboxes.

### Tests for User Story 7 (write first; must fail)

- [ ] T098 [US7] Implement:
  - `tests/mocks/handlers/self-service/mail-settings.ts`:
    - `getMailboxMailSettings` and `updateMailboxMailSettings`: `delimiterAction` and `tlsPolicy` flags, with values equal to the current one needing no flag; `If-Match` and `412`; `503 temporary-failure` with `dependency: sharedStore`;
    - `applyMailboxMailSettingsBulkAction`: up to the bulk limit; per-item `notFound`, `outdated` (the version compared as the pinned contract documents, research R16) and `failed`; one result per distinct mailbox; `forbidden` for mailbox users;
  - `tests/mocks/handlers/self-service/push-notifications.ts`:
    - get: `tokenSet`, `userKeySet`, `configured`;
    - put: `secretRequired` while none is stored; `pushoverCredential` format; title and text lengths; up to 100 senders; the sound pattern; `invalidRegex`; omitted token and key keep the stored values;
    - delete;
    - verification: accepted, or rejected with a reason; `409 push-notifications-not-configured`; `503` with `dependency: pushover`;
    - the `pushover` flag.

  Create `tests/mocks/scenarios/mail-settings.ts` (registered in the index) with:
  - `pushover-configured`, `pushover-unconfigured`, `pushover-outage`;
  - `mail-settings-changed-elsewhere`, `mail-settings-store-outage`, `mailbox-no-mail-flags`;
  - `mailbox-list-tls`: UI 003's mailbox list with 30 mailboxes, one deleted after listing.
- [ ] T099 [P] [US7] Write `tests/e2e/account/mail-settings.spec.ts`. It covers:
  - US7-AS1: "In subject" is saved and announced, and the help shows `anna+shop@example.org`;
  - US7-AS2: the bounce warning is visible without interaction;
  - FR-014: the pending state, and the return to the stored value with an announced error on `mail-settings-store-outage`;
  - FR-016: on `mail-settings-changed-elsewhere`, the reloaded value with "changed elsewhere";
  - FR-075: the alias-coverage note;
  - SC-009: on `mailbox-no-mail-flags` both controls are absent.
- [ ] T100 [P] [US7] Write `tests/e2e/account/push-notifications.spec.ts`. It covers:
  - US7-AS3: the token and key fields are empty and say a value is stored;
  - US7-AS4: a 29-character token shows the error on the token field;
  - US7-AS5: "Verify credentials" announces the verdict and the reason when negative;
  - US7-AS6: "Remove" with confirmation returns the form to "not configured";
  - FR-077: the sounds from the capabilities and "Advanced settings";
  - FR-078: both credentials required on `pushover-unconfigured` (spec edge case);
  - FR-079: the placeholders and legacy `user.pushover_info` with the mailbox address;
  - FR-080: verifying unconfigured settings says to save first;
  - Edge: `pushover-outage` names the Pushover service with "Try again";
  - FR-015: the unsaved-changes warning.
- [ ] T101 [P] [US7] Write `tests/e2e/mailbox-self-service/mail-settings.spec.ts`. It covers:
  - an administrator changes tagging, TLS and Pushover of `anna@example.org` in the mailbox context;
  - on `domain-admin-no-flags`, Pushover is read-only with the notice;
  - UI 003's FR-040 summaries link to the sections;
  - US7-AS7 on `mailbox-list-tls`: select 30 and enforce outbound TLS: "29 changed, 1 not found", the not-found mailbox stays selected, every target carries the listed version tag (`mockApi.requests()`), and an explicit confirmation precedes the request. This part depends on API gap G1 (T107).
- [ ] T102 [P] [US7] Write these unit tests:
  - `tests/unit/features/account/TaggedMailSetting.spec.ts` and `tests/unit/features/account/TlsPolicySetting.spec.ts`: the single-setting state machine of data-model §7;
  - `tests/unit/features/account/PushNotificationsForm.spec.ts`: write-only fields, senders parsed one per line, the stored custom sound added to the list, members omitted when empty;
  - `tests/unit/features/account/BulkTlsDialog.spec.ts`: at least one change, versions per item, the bulk limit from the capabilities.
- [ ] T103 [P] [US7] Add to `tests/smoke/account.smoke.spec.ts`: alice switches tagged mail to "In subfolder" and back. Add to `tests/smoke/mailbox-self-service.smoke.spec.ts`: `admin` enforces outbound TLS on alice through the bulk action and turns it off again (skipped while API gap G1 is open).

### Implementation for User Story 7

- [ ] T104 [US7] Implement `src/features/account/api/mail-settings.ts` and `src/features/account/api/push-notifications.ts` (invalidation of data-model §3).
- [ ] T105 [P] [US7] Implement `src/features/account/components/mail-settings/TaggedMailSetting.vue` and `TlsPolicySetting.vue`, and `src/features/account/components/push/PushNotificationsForm.vue` and `WriteOnlySecretField.vue`.
- [ ] T106 [US7] Implement `src/features/account/pages/MailSettingsPage.vue` (anchors `#tagged-mail`, `#tls-policy`) and `src/features/account/pages/PushNotificationsPage.vue` for both contexts. Add `account-mail-settings` and `account-push-notifications` to `src/features/account/routes.ts`, and `mailbox-mail-settings` and `mailbox-push-notifications` to `src/features/account/mailbox-routes.ts`. Link UI 003's FR-040 summaries of tagging, TLS and push notifications to them through `src/features/mailboxes/detail-sections.ts`.
- [ ] T107 [US7] Implement `src/features/account/components/mail-settings/BulkTlsDialog.vue` and register the bulk TLS action in UI 003's mailbox list (`src/features/mailboxes/bulk-actions.ts`, or the extension point UI 003's plan named), with `applyMailboxMailSettingsBulkAction`, the listed version tag per target and `BulkResultSummary`. **Depends on API gap G1** being fixed in the pinned contract (plan). If it is still open at implementation time, leave this task open, do not omit the version tag, and register no action (owner question 2).
- [ ] T108 [US7] Add the `account.mailSettings.*`, `account.push.*` and `account.bulkTls.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. Map in `src/i18n/legacy-map.json`: the `user.*` tagging and TLS keys whose meaning is unchanged, `user.tls_policy_warning` (`html: plain`), `user.pushover_info` (`html: plain`, `{0}` the mailbox), the `edit.pushover_*` keys including `edit.pushover_vars` (`html: plain`), `danger.pushover_key`, `danger.pushover_token` and `danger.pushover_credentials_missing`. `npm run i18n:check` must pass.

**Checkpoint**: US1 to US7 work on their own (bulk TLS once G1 is fixed).

---

## Phase 10: User Story 8 - Review and clear recent logins (Priority: P2)

**Goal**: Recent logins with period, service filter, sorting, internal labels, countries and app
password names; clearing; administrators in the mailbox context only.

**Independent Test**: As `recent-logins`, switch the period, filter by service, sort, clear. As an
administrator, read and clear in the mailbox context.

### Tests for User Story 8 (write first; must fail)

- [ ] T109 [US8] Implement `tests/mocks/handlers/self-service/recent-logins.ts`:
  - `listRecentLogins`: `days` 1–31 (`outOfRange`); `service` compared case-insensitively; `q`; `sort`, `order`, paging; `internal` and `country`; `appPassword.name` `null` after deletion; `503`;
  - `clearRecentLogins`.

  Create `tests/mocks/scenarios/recent-logins.ts` (registered in the index) with:
  - `recent-logins`: internal and public addresses, countries, one public address without a country, app password names including a deleted one, entries older than a week within a month;
  - `recent-logins-empty`.
- [ ] T110 [P] [US8] Write `tests/e2e/account/recent-logins.spec.ts`. It covers:
  - US8-AS1: newest first with address, country, service, time and the app password's name;
  - US8-AS2: "1 month" adds the older entries;
  - US8-AS3: clear, confirmed with the note about the classic interface (FR-084), then the empty state;
  - US8-AS4: "internal" instead of a country;
  - FR-082: the app password link only with `appPasswds`;
  - FR-083: periods within the range with the default, the service filter, the sorts, and the state in the address;
  - Edge: a missing country is simply left out;
  - FR-085: administrators have no recent logins in My account.
- [ ] T111 [P] [US8] Write `tests/e2e/mailbox-self-service/recent-logins.spec.ts`: an administrator and a domain administrator read and clear a mailbox's recent logins in the mailbox context.
- [ ] T112 [P] [US8] Write `tests/unit/features/account/recent-login-period.spec.ts` and `tests/unit/features/account/RecentLoginCard.spec.ts` (internal; the country name through `Intl.DisplayNames` per locale; service labels; an unknown code shown as sent).
- [ ] T113 [P] [US8] Add to `tests/smoke/account.smoke.spec.ts`: alice's recent logins list the seeded entries and a `WEBUI` entry of the smoke sign-in.

### Implementation for User Story 8

- [ ] T114 [US8] Implement `src/features/account/api/recent-logins.ts`, `src/features/account/recent-login-period.ts`, and the recent-login schema in `src/features/account/list-state.ts`.
- [ ] T115 [P] [US8] Implement `src/features/account/components/recent-logins/RecentLoginList.vue`, `RecentLoginCard.vue`, `RecentLoginTable.vue` and `RecentLoginFilters.vue`.
- [ ] T116 [US8] Implement `src/features/account/pages/RecentLoginsPage.vue` for both contexts. Add `account-recent-logins` to `src/features/account/routes.ts` and `mailbox-recent-logins` to `src/features/account/mailbox-routes.ts`.
- [ ] T117 [US8] Add the `account.recentLogins.*` and `selfService.service.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, mapping the legacy recent-login keys whose meaning is unchanged (for example `user.login_history`, `user.day`, `user.week`, `user.weeks`, `user.month`). `npm run i18n:check` must pass.

**Checkpoint**: US1 to US8 work on their own.

---

## Phase 11: User Story 9 - Set up mail apps on my devices (Priority: P2)

**Goal**: The setup guide with copy buttons and the Apple connection profiles, optionally with a new
app password.

**Independent Test**: As `mailbox-account` with and without the app-password flag, compare the guide
with the scenario, copy each value, download each profile variant.

**Depends on**: US4 for US9-AS4 (the new app password appears in App passwords).

### Tests for User Story 9 (write first; must fail)

- [ ] T118 [US9] Extend `tests/mocks/handlers/self-service/overview.ts` with:
  - `getOwnClientConfiguration`: DAV and ActiveSync `null` without groupware;
  - `getOwnAppleProfile`: a plist from `tests/mocks/factories/apple-profile.ts` with `Content-Type: application/x-apple-aspen-config`, `Content-Disposition: attachment; filename="<product>.mobileconfig"` and `Cache-Control: no-store`; `emailAndDav` refused with `groupware-disabled`;
  - `createOwnAppleProfileWithAppPassword`: `appPasswds` required (`permission-flag-required`); the new app password added to the state and embedded in the plist; `201` with `Location`.

  Create `tests/mocks/scenarios/mail-apps.ts` (registered in the index) with `mailbox-no-pop3`, `mailbox-2fa-on`, and `profile-flag-withdrawn` (the flag removed after the page loaded).
- [ ] T119 [P] [US9] Write `tests/e2e/account/mail-apps.spec.ts`. It covers:
  - US9-AS1: each protocol's server, ports with encryption, authentication and username, each copy announced;
  - US9-AS2 on `mailbox-no-pop3`: the POP3 note;
  - US9-AS3: "E-mail, calendars and contacts" downloads (`page.waitForEvent('download')`, the `.mobileconfig` name), with the iPhone, iPad and Mac note;
  - US9-AS4: the e-mail profile with "Include a new app password" downloads, the app says it holds a password to delete after installation, and App passwords lists it;
  - US9-AS5: without the flag the option is absent;
  - US9-AS6: a domain administrator gets "no access" with legacy `login.mobileconfig_info`;
  - FR-102 on `mailbox-2fa-on`: the app password guidance with the link;
  - FR-103: with groupware disabled, only the e-mail profile;
  - FR-106: `/ng/account/mail-apps` opened signed out opens the section after sign-in;
  - the preselection `?variant=email&appPassword=1` preselects without downloading or creating anything (UI 014 FR-050);
  - Edge: on `profile-flag-withdrawn` the refusal is explained and the option hidden;
  - Edge: an app password created by the request stays listed even when the download is cancelled.
- [ ] T120 [P] [US9] Write these unit tests:
  - `tests/unit/features/account/download.spec.ts`: an object URL created, a temporary `<a download>` clicked and removed, the URL revoked after one second, the file name from `Content-Disposition` with the fallback;
  - `tests/unit/features/account/useProfileDownload.spec.ts`: a direct client call with `parseAs: 'blob'`, nothing cached, the invalidations after the app-password variant, the problem mapping;
  - `tests/unit/features/account/ClientSetupGuide.spec.ts`: encryption labels, `null` services hidden, protocol notes.
- [ ] T121 [P] [US9] Add to `tests/smoke/account.smoke.spec.ts`: alice downloads the e-mail profile (content type and `.mobileconfig` name), and the guide shows the IMAP host and ports.

### Implementation for User Story 9

- [ ] T122 [US9] Implement `src/features/account/api/client-setup.ts`, `src/features/account/download.ts` and `src/features/account/composables/useProfileDownload.ts` (research R21).
- [ ] T123 [P] [US9] Implement `src/features/account/components/mail-apps/ClientSetupGuide.vue`, `ProtocolCard.vue` and `AppleProfileDownloads.vue`.
- [ ] T124 [US9] Implement `src/features/account/pages/MailAppsPage.vue`, with the preselection read and removed from the address, and add the `account-mail-apps` route to `src/features/account/routes.ts`. Its section passes the `login.mobileconfig_info` reason to `NoAccessState` for other roles.
- [ ] T125 [US9] Add the `account.mailApps.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. Map `user.apple_connection_profile`, `user.apple_connection_profile_mailonly`, `user.apple_connection_profile_complete`, `user.apple_connection_profile_with_app_password`, `user.email`, `user.email_and_dav`, `user.with_app_password` and `user.client_configuration` in `src/i18n/legacy-map.json`. `npm run i18n:check` must pass.

**Checkpoint**: All P2 stories (US5 to US9) work.

---

## Phase 12: User Story 10 - Manage mailbox sieve filters and read my filters (Priority: P3)

**Goal**: Mail setup › Filters and the mailbox context's filters for administrators and domain
administrators (read-only without the flag); My account › Filters read-only with the active script.

**Independent Test**: As an administrator, create a filter with an invalid script, fix and save it,
deactivate and delete it; as domain administrators with and without the flag; as a mailbox user,
read filters and the active script.

### Tests for User Story 10 (write first; must fail)

- [ ] T126 [US10] Implement `tests/mocks/handlers/self-service/sieve-filters.ts`:
  - `listSieveFilters`: `mailbox`, `kind`, `active`, `q`, `sort`, `order`, paging; `forbidden` for mailbox users;
  - `listMailboxSieveFilters`;
  - `createSieveFilter`, `getSieveFilter`, `updateSieveFilter` and `deleteSieveFilter`:
    - activating, or changing the kind of an active filter, deactivates the other active filter of that kind;
    - `sieveSyntax` with `message` and `line` from a minimal mock rule (an unknown command or unbalanced braces);
    - `tooLong` with `unit: bytes` above 65,535 bytes;
    - `If-Match` and `412`;
  - `validateSieveScript`;
  - `getActiveSieveScript`: `null` name and script when none is active; `503` with `dependency: mailStore`;
  - the `filters` flag for domain administrators (`permission-flag-required`), `forbidden` for mailbox users' writes, scope.

  Create `tests/mocks/scenarios/filters.ts` (registered in the index) with:
  - `filters-many`: an administrator, 40 filters across mailboxes, an active prefilter "Spam to folder";
  - `filters-domain-admin` and `filters-domain-admin-no-flag`;
  - `mailbox-filters-and-script`: two administrator filters and an active script;
  - `mailbox-no-active-script`, `active-script-unavailable`.
- [ ] T127 [P] [US10] Write `tests/e2e/filters/filters.spec.ts`. It covers:
  - US10-AS1: a syntax error shows the parser's message on the script field on "Check" and on save, and nothing is saved;
  - US10-AS2: activating a second prefilter shows the warning naming "Spam to folder", and the list reflects the change;
  - US10-AS3: selecting filters and "Deactivate" reports a per-filter result when one fails;
  - FR-090: the filters, search and sort in the address;
  - FR-091: creation with the mailbox picker;
  - FR-092: the editor's attributes and its own scrolling at 360 px without page overflow;
  - FR-095: edit, switch kind and delete one and several (typed number);
  - FR-005 on `filters-domain-admin-no-flag`: read-only with the reason;
  - `filters-domain-admin` (flag on) can manage;
  - Edge: an oversized script shows the size error on the field;
  - Edge: switching the kind of an active filter warns before saving.
- [ ] T128 [P] [US10] Write `tests/e2e/mailbox-self-service/filters.spec.ts` (the list, creation with the mailbox preset, the active script panel) and `tests/e2e/account/own-filters.spec.ts`. The latter covers:
  - US10-AS4 on `mailbox-no-active-script`: both filters read-only and "No active filter available";
  - FR-089: scripts on demand in a monospaced block with copy, and the active script with its name;
  - `active-script-unavailable` names the mail server with "Try again".
- [ ] T129 [P] [US10] Write `tests/unit/features/filters/ScriptEditor.spec.ts` (the byte counter against `limits.sieveScriptMaxBytes`, attributes), `tests/unit/features/filters/ActivationWarning.spec.ts` (the named or general warning), `tests/unit/features/filters/FilterForm.spec.ts` and `tests/unit/features/filters/list-state.spec.ts`.
- [ ] T130 [P] [US10] Add to `tests/smoke/mailbox-self-service.smoke.spec.ts`: `admin` creates a postfilter for alice with an invalid script (the parser message appears), fixes and saves it, deactivates and deletes it; `reseller` lists the filters of its domains.

### Implementation for User Story 10

- [ ] T131 [US10] Implement `src/features/filters/api.ts` (lists, CRUD, validation, active script, with the invalidation of data-model §3), `src/features/filters/list-state.ts` and `src/features/filters/index.ts`.
- [ ] T132 [P] [US10] Implement `src/features/filters/components/FilterList.vue`, `FilterCard.vue`, `FilterTable.vue`, `FilterFilters.vue`, `FilterForm.vue`, `ScriptEditor.vue`, `ScriptBlock.vue`, `ActivationWarning.vue`, `ActiveScriptPanel.vue` and `FilterMailboxField.vue` (UI 003's or UI 004's mailbox picker). Selection and outcomes use UI 002's runner and summary.
- [ ] T133 [US10] Implement `src/features/filters/pages/FiltersPage.vue`, `MailboxFiltersPage.vue` and `FilterFormPage.vue`, and `src/features/filters/routes.ts` (`filters`, `filter-create`, `filter-detail`). Register them in `src/app/router/routes.ts` and set the catalogue's `filters` entry to `available`. Add `mailbox-filters`, `mailbox-filter-create` and `mailbox-filter-detail` to `src/features/account/mailbox-routes.ts`. Implement `src/features/account/pages/OwnFiltersPage.vue` and add the `account-filters` route to `src/features/account/routes.ts`.
- [ ] T134 [US10] Add the `filters.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. Map in `src/i18n/legacy-map.json`: `mailbox.add_filter`, `mailbox.sieve_info` (`html: plain`), `mailbox.set_prefilter`, `mailbox.set_postfilter`, `add.sieve_desc`, `add.sieve_type`, `add.validate`, `add.activate_filter_warn`, `edit.validate_save`, `danger.sieve_error` (`{0}` the parser message) and `user.no_active_filter`. `npm run i18n:check` must pass.

**Checkpoint**: US1 to US10 work on their own.

---

## Phase 13: User Story 11 - Reset the ActiveSync device cache and the SOGo profile (Priority: P3)

**Goal**: Both groupware resets in My account › Devices and in the mailbox context, with the
acknowledgement for the irreversible SOGo reset.

**Independent Test**: With the flags on and webmail enabled, perform each reset; turn a flag off, or
disable webmail, and confirm the control is absent.

### Tests for User Story 11 (write first; must fail)

- [ ] T135 [US11] Implement `tests/mocks/handlers/self-service/groupware.ts`: `resetActiveSyncCache` and `resetGroupwareProfile` (`204`; the `easReset` and `sogoProfileReset` flags; `403 groupware-disabled`). Create `tests/mocks/scenarios/groupware.ts` (registered in the index) with `mailbox-no-reset-flags`.
- [ ] T136 [P] [US11] Write `tests/e2e/account/devices.spec.ts` and `tests/e2e/mailbox-self-service/groupware.spec.ts`. They cover:
  - US11-AS1: the ActiveSync reset is confirmed and the success is announced, with legacy `user.eas_reset_help`;
  - US11-AS2: the SOGo confirmation states the irreversible deletion, and its button stays disabled until the acknowledgement is ticked;
  - US11-AS3: with webmail disabled, no groupware reset in the mailbox context;
  - US5-AS5 (resets part): no reset in My account when webmail is disabled;
  - FR-088: a `groupware-disabled` refusal is explained;
  - SC-009 on `mailbox-no-reset-flags`: both resets absent;
  - an administrator resets both in the mailbox context.
- [ ] T137 [P] [US11] Write `tests/unit/features/account/GroupwareResets.spec.ts`. If UI 002 did not add an acknowledgement option to `ConfirmDialog`, also write `tests/unit/shared/components/confirm-acknowledgement.spec.ts`: the confirm button is disabled until the box is ticked, the box is labelled, and focus behaves as in 001.

### Implementation for User Story 11

- [ ] T138 [US11] Implement `src/features/account/api/groupware.ts`, `src/features/account/components/groupware/GroupwareResets.vue` and `src/features/account/pages/DevicesPage.vue`. Add `requireAcknowledgement` to `src/shared/components/ConfirmDialog.vue` if UI 002 did not. Add `account-devices` to `src/features/account/routes.ts` and `mailbox-groupware` to `src/features/account/mailbox-routes.ts`.
- [ ] T139 [US11] Add the `account.devices.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. Map `user.eas_reset_help` (`html: plain`), `success.eas_reset` (`{0}` the mailbox), `success.sogo_profile_reset` (`{0}` the mailbox) and the legacy reset button labels whose meaning is unchanged in `src/i18n/legacy-map.json`. `npm run i18n:check` must pass.

**Checkpoint**: US1 to US11 work on their own.

---

## Phase 14: User Story 12 - Trace self-service changes (Priority: P3)

**Goal**: Self-service labels in the audit log and History actions for administrators.

**Independent Test**: As `audit-self-service`, filter the audit log by mailbox and self-service event
types; use the History action of a mailbox's self-service group and of an app password.

**Depends on**: US4, US6 and US10 for the History actions on their objects.

### Tests for User Story 12 (write first; must fail)

- [ ] T140 [US12] Extend `tests/mocks/factories/audit-event.ts` with self-service records (`target.id` the mailbox address, `target.name` the object label, the object ID in `details`, secrets as `set`/`changed`, scripts as `{changed, oldSize, newSize}`). Create `tests/mocks/scenarios/audit-self-service.ts` (registered in the index) with `audit-self-service`: records of a password change and an app password creation for `anna@example.org`, and every other self-service event type.
- [ ] T141 [P] [US12] Write `tests/e2e/audit-log/self-service-history.spec.ts`. It covers:
  - US12-AS1: the mailbox's History opens the audit log with `targetId=anna@example.org`; both events appear with actor, time and address, and the password only as "changed";
  - US12-AS2: domain administrators get no History action;
  - FR-107: the target type filter offers the self-service types with labels, and event types and failure reasons are translated;
  - FR-108: History on an app password, a temporary alias and a filter opens `targetType` plus `targetId`;
  - script size changes are shown as text.
- [ ] T142 [P] [US12] Extend `tests/unit/features/audit-log/labels.spec.ts`: every self-service event type, target type and failure reason has a label; unknown values get the generic label; `set`, `changed` and size details are formatted.

### Implementation for User Story 12

- [ ] T143 [US12] Extend `src/features/audit-log/labels.ts` (details formatting) and `src/features/audit-log/list-state.ts` (the self-service target types in the filter). Place `HistoryLink` (administrators only):
  - on the self-service group, through `src/features/mailboxes/detail-sections.ts`;
  - in `src/features/account/pages/AppPasswordDetailPage.vue`;
  - on the items of `src/features/account/components/temporary-aliases/TemporaryAliasList.vue`;
  - in `src/features/filters/pages/FilterFormPage.vue`.
- [ ] T144 [US12] Add the remaining `auditLog.*` detail strings to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` (the labels came with T004). `npm run i18n:check` must pass.

**Checkpoint**: All user stories work on their own.

---

## Phase 15: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story verification, budgets, parity, validation on devices and release readiness.

- [ ] T145 [P] Write and pass `tests/e2e/account/visibility-matrix.spec.ts` (SC-009, FR-002, FR-004, FR-006). For each flag of FR-002 turned off, the own-context section is absent and its direct address shows "no access". For each `da_acl` flag of FR-004, the mailbox-context section is read-only. `mailbox-external-source` shows only the external notice in place of password, recovery and two-factor. `capabilities-unavailable` shows the error states.
- [ ] T146 [P] Write and pass `tests/e2e/account/secrets-audit.spec.ts` (SC-008, FR-109) after the flows of US1 (own and forced password), US2 (TOTP, Yubico), US3 (reset), US4 (app password), US7 (Pushover) and US9 (profile with app password):
  - `localStorage` and `sessionStorage` hold only UI 001's keys;
  - no stored value, `location.href`, `history.state` or console message contains a password, code, TOTP key or provisioning address, app password, Yubico key, Pushover credential or reset token.
- [ ] T147 [P] Write and pass `tests/e2e/account/reflow-keyboard.spec.ts` for every screen and dialog of this feature:
  - no horizontal scroll at 320 px and at 400 % zoom;
  - landscape on the mobile projects;
  - the focused element never hidden behind the sticky header;
  - no transition under `prefers-reduced-motion`;
  - the main paths of US1 to US4 completed with the keyboard alone, with visible focus;
  - at 360 px, every form's primary action is reachable without scrolling past an expanded explanation, and the TLS and SOGo warnings are visible without interaction (FR-112, FR-121 to FR-123, research R4).
- [ ] T148 [P] Write and pass `tests/e2e/account/edge-cases.spec.ts`:
  - `pending-action-required` from any self-service screen returns to the pending-actions screen;
  - a session expiry while a form is open clears the secret inputs and keeps the others after re-authentication;
  - offline (`route.abort`) gives every view its error state with "Try again";
  - a `412` on the recovery address, an app password and the Pushover form keeps the non-secret input and marks the changed values;
  - FR-010: every view shows its busy state at once (a delayed mock response), with an accessible busy indication;
  - FR-011: every successful change is announced in the polite region while focus stays on the changed control;
  - FR-015: leaving the recovery e-mail form, a second-factor setup, the app password and filter forms and the alias generation panel with input asks for confirmation.
- [ ] T149 Add the `/ng/account` collection (scenario `mailbox-account`) to `scripts/run-lhci.mjs`. Run `npm run build && npm run budget:check && npm run lhci` and fix regressions until the initial JS is at most 204,800 bytes gzipped and `/ng/account` scores at least 0.9 for performance and accessibility (SC-011).
- [ ] T150 [P] Write and pass `tests/unit/i18n/legacy-reuse-005.spec.ts`: every legacy key listed in the spec's Legacy Parity section is mapped in `src/i18n/legacy-map.json`, apart from the keys the spec names as not reused (SC-007). Add the plan's three parity notes to the Legacy Parity table in `specs/005-account-self-service/spec.md` (SC-010).
- [ ] T151 [P] Run `npm run i18n:check`, remove the unused keys it reports from `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, and list the new cs-cz and sk-sk strings for the owner's review (UI 001 owner question 4).
- [ ] T152 Run quickstart.md Part B on a mid-range Android phone and an iPhone, and Part D on a mailcow host:
  - authenticator apps, a security key, a YubiKey, forced actions, the reset, webmail, and the Apple profiles on an iPhone, an iPad and a Mac;
  - VoiceOver and TalkBack passes.

  Record SC-001 to SC-004 and SC-011 to SC-013 in a "Validation log" section appended to `specs/005-account-self-service/quickstart.md`. If iOS does not open the profile installer from the blob download, record it and the Downloads fallback there (research R21).
- [ ] T153 Run quickstart.md Part C (`scripts/smoke/stack-up.sh`, `npm run test:smoke -- --grep @005`, `scripts/smoke/stack-down.sh`) once API feature 005 runs in the dev stack. Confirm the status of API gaps G1 and G2 in the pinned contract and note it in the validation log.
- [ ] T154 [P] In `docker/nginx/default.conf`, define the access log format of the `ng-mailcow` image with `$uri` instead of `$request_uri`, so that reset tokens of `/ng/reset-password?token=…` never reach its log (research R12, plan G7). Extend the CI `image` job's container check in `.github/workflows/ci.yml` to request `/ng/reset-password?token=TEST` and assert that the log line contains no `TEST`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** depends on UI 001 to 004 being complete. T001 comes first; T002 → T003 → T004;
  T005 → T006; T007 → T008; T009 → T010.
- **Foundational (Phase 2)** depends on Setup and **blocks every user story**. Within it:
  - test infrastructure first (T011 → T012 → T013);
  - then the core tests T014–T025 (all [P]);
  - then the implementation T026–T037, in the order shared pieces (T026–T029) → api and i18n
    (T030, T031) → landing and guard (T032) → catalogue (T033) → sections (T034) → hub and routes
    (T035) → mailbox group (T036) → messages (T037).
- **User stories (Phases 3–14)** depend on Foundational and on each other as the table below shows.
  End-to-end tests that do not test sign-in start from scenarios whose session is already `active`
  or `restricted`.
- **Polish (Phase 15)** depends on every story it verifies.

### User Story Dependencies

| Story | Priority | Depends on | Why |
|---|---|---|---|
| US1 | P1 | Foundational | MVP. Own password and the forced change on the pending-actions screen. |
| US2 | P1 | Foundational; US1 for the `forced-both` case of T050 | The password step precedes the second-factor step. |
| US3 | P1 | Foundational | Reuses UI 001's factor components (T068) and the shared password fields. |
| US4 | P1 | Foundational | Uses `OneTimeSecretDialog` and `useSecretMutation` (T028, T029). |
| US5 | P2 | Foundational | The overview handler comes from T012; section links appear when their routes exist. |
| US6 | P2 | Foundational | UI 003's FR-040 link (T096). |
| US7 | P2 | Foundational; API gap G1 for T107 | Bulk TLS needs the version tag fix. |
| US8 | P2 | Foundational | The app password link appears when US4's routes exist. |
| US9 | P2 | Foundational; US4 for US9-AS4 | The created app password is checked in App passwords. |
| US10 | P3 | Foundational | Flips the `filters` catalogue entry. |
| US11 | P3 | Foundational | — |
| US12 | P3 | Foundational; US4, US6, US10 for T143 | History actions on their objects. |

### Files edited by several stories

Edits to these files must be serialised, even when stories run in parallel:

- `src/features/account/routes.ts`, `src/features/account/mailbox-routes.ts` and
  `src/features/account/index.ts`: US1 to US11;
- `src/features/account/list-state.ts`: US4, US6, US8;
- `src/features/mailboxes/detail-sections.ts`: Foundational, US6, US7, US12;
- `src/features/account/pages/AccountHomePage.vue`: Foundational, US5;
- `src/features/auth/pages/PendingActionsPage.vue`: Foundational (T032), US1, US2;
- `src/features/auth/routes.ts`, `src/features/auth/api.ts`: US3;
- `src/app/router/routes.ts` and `src/app/navigation/catalogue.ts`: Foundational, US10;
- `tests/mocks/handlers/self-service/overview.ts`: Foundational, US5, US9;
- `tests/mocks/handlers/self-service/own-account.ts`: US1, US3;
- `tests/mocks/handlers/self-service/index.ts` and `tests/mocks/scenarios/index.ts`: every story
  (one registration line each);
- `tests/smoke/account.smoke.spec.ts`: US2, US4 to US9; `tests/smoke/account-credentials.smoke.spec.ts`:
  US1, US3; `tests/smoke/mailbox-self-service.smoke.spec.ts`: US4, US7, US10;
- `src/i18n/messages/*.json` and `src/i18n/legacy-map.json`: every story.

Scenarios avoid conflicts through one module per story under `tests/mocks/scenarios/`.

### Within Each User Story

- First the mock handlers and scenarios, then the end-to-end, unit and smoke tests (they must fail),
  then the implementation (api → composables → components → pages and routes), then the messages
  in all three locales.
- Each story's message task edits the shared locale files; run those tasks one after another across
  stories.

### Parallel Opportunities

- Setup: T005, T007 and T009 in parallel with T002 after T001.
- Foundational: T014–T025 (tests) all in parallel; T026 and T028 in parallel, then T027 and T029.
- Stories: after Foundational, US1, US3, US4, US5, US6, US8, US10 and US11 can be staffed in
  parallel. US2 needs US1 only for one test. US7's bulk TLS waits for G1. US9 and US12 follow the
  stories they depend on.
- Within each story, every task marked [P].

---

## Parallel Example: User Story 2

```bash
# After T047 (handlers and scenarios), write all US2 tests together:
Task: "T048 tests/e2e/account/two-factor.spec.ts"
Task: "T049 tests/e2e/account/two-factor-enrolment.spec.ts"
Task: "T050 tests/e2e/pending-actions/forced-second-factor.spec.ts"
Task: "T051 unit tests: qr-svg, QrCode, totp, useTotpEnrolment, useSecurityKeyEnrolment, SecondFactorList, YubicoOtpSetup"
Task: "T052 tests/smoke/account.smoke.spec.ts (second factors)"

# Then, after T053 and T054:
Task: "T055 useTotpEnrolment.ts + TotpSetup.vue"
Task: "T056 useSecurityKeyEnrolment.ts + SecurityKeySetup.vue + YubicoOtpSetup.vue"
# T057 and T058 edit routes.ts / PendingActionsPage.vue: run them one after another.
```

## Parallel Example: User Story 4

```bash
Task: "T073 tests/e2e/account/app-passwords.spec.ts"
Task: "T074 tests/e2e/mailbox-self-service/app-passwords.spec.ts"
Task: "T075 unit tests: AppPasswordForm, ProtocolCheckboxes, AppPasswordDetailPage, list-state"
Task: "T076 smoke: account + mailbox-self-service"
# after T077:
Task: "T078 app-passwords components"
# then T079 (pages and routes), then T080 (messages)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup), then Phase 2 (Foundational): CI green with the new pin and an empty My account.
2. Phase 3 (US1): own password and the forced password change.
3. **Stop and validate**: `npm run test:e2e -- --grep US1` on both viewports, and the US1 rows of
   quickstart Part B. Forced password changes no longer send users to the classic interface.

### Incremental Delivery

1. Foundation, then US1 (MVP).
2. US2 (second factors and forced setup), then US3 (reset), then US4 (app passwords): every
   account-blocking situation is resolved in the app, and users with second factors can set up mail
   clients.
3. US5 (overview and webmail), US6 (temporary aliases), US7 (mail settings and Pushover; bulk TLS
   once G1 is fixed), US8 (recent logins), US9 (mail app setup).
4. US10 (filters), US11 (groupware resets), US12 (history).
5. Polish: visibility matrix, secrets audit, reflow and keyboard, edge cases, budgets, parity,
   device validation and the smoke suite.

### Parallel Team Strategy

After Foundational:
- Developer A: US1, then US2, then US9.
- Developer B: US3, then US5, then US11.
- Developer C: US4, then US6, then US12.
- Developer D: US8, then US10, then US7.

Edits to the files listed under "Files edited by several stories" run one at a time.

---

## Notes

- [P] tasks touch different files and have no dependency on an incomplete task.
- [USn] labels map tasks to the spec's user stories; test titles carry the spec IDs for
  traceability.
- Verify that each test fails before implementing (constitution VI).
- Commit after each task or logical group, directly to `main`, with short imperative subjects.
- Never add a hand-written API type, a `v-html` outside `SanitizedHtml.vue`, an inline style or
  script, a storage key, a secret in a cache or the address, or an automatic request while idle.
