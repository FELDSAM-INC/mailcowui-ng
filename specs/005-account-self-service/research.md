# Research: Account Self-Service

**Feature**: `specs/005-account-self-service` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

This document settles the decisions that are specific to UI feature 005. Everything else is
inherited from UI feature 001 (`specs/001-sign-in-app-shell/research.md`, cited as "001-R*n*"):
the stack, the structure, contract pinning, the client, CSRF and sessions, the query policy, the
WebAuthn codec, i18n, the CSP, the mock API, the test layers and the deployment. Decisions follow
this order of precedence: the constitution, then the pinned mailcow-rest-v2 contract, then
`docs/conventions.md`, then UI 001's decisions, then best practice. Each entry has a
**Decision**, its **Rationale** and the **Alternatives considered**.

UI 005 is implemented after UI 001 to 004 and after API feature 005. Where it reuses something that
UI 002 to 004 build, the entry names the location that 001-R20 reserved for it, or the extension
point that UI 003's plan has to provide (R5).

---

## 1. Foundations

### R1. Dependencies on earlier features and new runtime dependencies (constitution VIII)

- **Decision**: UI 005 adds **no runtime dependency**. It reuses:

  | From | What | Where (001-R20 or the earlier plan) |
  |---|---|---|
  | UI 001 | client, `ApiProblem`, query client and keys, session store and reactions, router guard, navigation catalogue, shell, `NoAccessState`, pending-actions screen, second-factor step components, `usePasskeyRegistration`, WebAuthn platform module, `useListState`, `ListState`, `PaginationBar`, `useConfirm`/`ConfirmDialog`, `useVersionedSave`, `useProblemForm`, `FormField`, `ErrorSummary`, `ProblemMessage`, `DateTime`, `RelativeTime`, `useAnnouncer`, `useCountdown`, `clipboard.ts`, `safeHref`, audit log screen | `src/api/`, `src/app/`, `src/features/{auth,passkeys,audit-log}/`, `src/shared/` |
  | UI 001 | `ApiKeySecretDialog.vue`, promoted here as planned (R13) | `src/features/api-keys/components/` → `src/shared/components/OneTimeSecretDialog.vue` |
  | UI 002 (D21, D22, D27, D2) | `useBulkSelection`, `BulkActionBar`, `BulkResultSummary`, `ConfirmDialog` with `requireTyped`, `EditableSection` with changed-value marking, `HistoryLink` with the audit target filters, `useLeaveGuard`, `formatBytes`, the translation coverage manifest (legacy texts come from UI 001's legacy translation layer and `SanitizedHtml.vue`, constitution IV 1.3.0) | `src/shared/composables/{useBulkSelection,useLeaveGuard}.ts`, `src/shared/components/{BulkActionBar,BulkResultSummary,ConfirmDialog,EditableSection,HistoryLink}.vue`, `src/i18n/format.ts`, `src/i18n/coverage.json` |
  | UI 003 (R4, R19, data-model §8) | the mailbox detail with its section list (`sections.ts`, `MailboxSectionNav.vue`, child routes of `mailbox-detail` in `routes.ts`), the FR-040 entries (`ManagedSettingsGroup.vue`, optional `to`), the mailbox list's bulk menu (`MailboxBulkActions.vue`, `bulk.ts`), the password field, generator and policy hints (`PasswordField.vue`, `PasswordPolicyHints.vue`, `password/{generate,policy-rules}.ts`), promoted here at their second use | `src/features/mailboxes/` (R5), `src/features/mailboxes/password/`, `src/features/mailboxes/components/password/` |
  | UI 004 (R2, R8) | `utf8ByteLength`, the promoted `DomainPicker` (the pattern of `MailboxSearchPicker`, R19) | `src/shared/validation/utf8.ts`, `src/shared/components/DomainPicker.vue` |

  The names are the canonical ones of `docs/conventions.md` ("Shared building blocks and canonical
  names"). Where one of these does not exist at implementation time, the task that needs it creates
  it at the named path with the behaviour the earlier plan describes, never as a renamed or
  feature-local copy. UI 005 itself is the first implemented feature that needs a per-item runner
  for actions without a bulk operation (UI 002 and 003 use API bulk operations), a mailbox search
  picker and Czech and Slovak plural rules, so it creates them (R15, R19, R23).
- **Rationale**: Every capability of this feature is covered by the platform (WebAuthn, `Intl`,
  `DOMParser`, `TextEncoder`, `crypto.getRandomValues`, `Blob`) and by what UI 001 to 004 build.
  The QR code comes from the API (R10), so no QR library is needed.
- **Alternatives considered**: A QR code library (`qrcode`, `uqr`) was rejected: the spec requires
  the QR code the API provides (FR-046), and drawing a second one could disagree with it. A
  form library was rejected for the same reasons as 001-R1.

### R2. Contract pin and client regeneration (constitution I)

- **Decision**: UI 005 bumps `contract/VERSION.json` to a mailcow-rest-v2 commit that contains the
  complete API feature 005 contract:
  - **Baseline**: commit `32079252d55797d3da4e58ae661e9fb91c51c6f9` ("Register KnownProblemType in
    contract components", 2026-10-18). It is the newest commit that touches `api/` and contains all
    51 operations of `api/modules/self-service/` with every orchestrator amendment and the
    `requiredFlags`/`requiredFlagsMatch` convention. Its Redocly 2.64.1 bundle has 376 operations
    and sha256 `5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6` (verified while
    planning). It also lists `KnownProblemType` under `components.schemas`, which closes UI 001's
    API gap 5: `knownProblemTypeValues` is generated, and `i18n:check` uses it.
  - **Rule** (`docs/conventions.md`, "Contract pins"): pins only move forward, so the bump never goes
    behind the pin that UI 002 to 004 recorded. When API gaps AG1 or AG2 (plan) are fixed in the
    contract, the bump takes the commit that contains the fix. Before accepting the pin, the task
    diffs `api/` between the baseline and the pin and checks every operation UI 005 uses
    ([contracts/README.md](./contracts/README.md)) for changes.
  - The bump runs `scripts/contract/bump.sh <commit>`, then `npm run typecheck`, the unit and
    end-to-end suites, and `npm run i18n:check`. The growing shared enumerations are scoped by UI
    002's coverage manifest `src/i18n/coverage.json` (UI 002 D2): UI 005 appends the values it
    translates (its problem types, rule codes, audit event and target types and failure reasons,
    R23), and the enumerations it introduces are fully required.
- **Rationale**: 001-R6: the commit is authoritative, because `info.version` stays `0.1.0`. A
  commit that already holds the later features' contracts is harmless: the app calls only the
  operations listed in [contracts/README.md](./contracts/README.md), and the mock rejects every
  other request.
- **Alternatives considered**: Pinning the first 005 commit (`4a8401e`) was rejected: it predates the
  `requiredFlags` convention and the `KnownProblemType` fix. Waiting for a release tag was rejected:
  mailcow-rest-v2 publishes none yet.

### R3. Placement in the code base

- **Decision**: Three feature areas are touched, plus shared promotions.
  - `src/features/account/` (new): My account (own context) **and** the self-service sections of
    the mailbox context. A section component takes a `context` (`own` or `mailbox`) and a mailbox
    address, so one implementation serves both (FR-003). Its `index.ts` exports the routes, the
    mailbox-context routes and section descriptors for UI 003, the home card and Webmail action,
    the enrolment components that the pending-actions screen needs, the password API hooks, and
    the webmail forwarding hook.
  - `src/features/filters/` (new): Mail setup › Filters, the filter form and lists. Its
    `index.ts` exports the list and form components that `account` mounts in the mailbox context and
    in My account › Filters.
  - `src/features/auth/` (extended): the password reset request and reset pages (pre-sign-in, in
    `AuthLayout`, reusing the second-factor components of the sign-in step without promotion), the
    "Forgot password?" link, and the forced password change and forced second-factor setup on the
    pending-actions screen.
  - **Shared promotions and new shared blocks** (each has two or more uses, constitution VIII):
    `OneTimeSecretDialog.vue` (API keys, app passwords), `CopyButton.vue` (secrets, TOTP key, aliases,
    setup guide, scripts), `GroupedSecret.vue` (TOTP key, app password), UI 003's `PasswordField.vue`
    and `PasswordPolicyHints.vue` moved to `src/shared/components/password/` with the new
    `NewPasswordFields.vue` (own, forced and reset forms, and UI 003), UI 003's
    `password/{generate,policy-rules}.ts` moved to `src/shared/password/`, `useSecretRequest.ts`
    (every secret-bearing request, R13), `usePerItemRunner.ts` (temporary aliases, filters, R15),
    `MailboxSearchPicker.vue` (R19) and `src/shared/platform/download.ts` (R21). Byte lengths use
    UI 004's `src/shared/validation/utf8.ts`.
- **Rationale**: 001-R3's one-area-per-feature rule, with the catalogue entries `account` and
  `filters`. Sharing section components between contexts halves the code and keeps behaviour
  identical, which FR-003 and FR-004 expect. The reset pages belong to the sign-in flow and reuse
  its factor components inside the same feature.
- **Alternatives considered**: A separate `mailbox-self-service` feature duplicating the sections
  was rejected (two implementations of the same behaviour). Placing the sections inside
  `src/features/mailboxes/` was rejected: My account would then depend on UI 003's feature for
  mailbox users who never see the mailbox list.

---

## 2. Navigation and permissions

### R4. My account: catalogue, section registry, visibility and "no access"

- **Decision**:
  - **Catalogue** (`src/app/navigation/catalogue.ts`): the `account` entry (path `/account`, all
    roles) flips to `available` when the My account hub exists. A new entry `filters` (path
    `/filters`, label "Filters" from legacy `mailbox.filters`, admin ✓, domain admin ✓, mailbox user
    —, delivered by 005) is added after `aliases`. Domain administrators without the `filters` flag
    keep the entry and get a read-only screen (FR-005), so the catalogue access is `true`, not a flag
    condition.
  - **User menu** (`src/app/shell/UserMenu.vue`): "My account" is added above "Passkeys" (FR-001,
    one interaction from any screen).
  - **Section registry** (`src/features/account/sections.ts`): one typed, ordered array of section
    descriptors: `id`, `group` (`overview`, `security`, `mail`, `devices`), `labelKey`, `route`
    (own context), `mailboxRoute` (mailbox context, if any), and two pure rules:
    - `ownVisibility(identity, capabilities)` returns `visible`, `hidden`, `replaced` (the
      externally managed password notice) or `unknown` (capabilities not readable);
    - `mailboxAccess(identity, capabilities)` returns `change`, `readOnly` (with the missing flag)
      or `hidden` (groupware disabled).

    They implement the tables of FR-002 and FR-004 exactly and are unit-tested table-driven over
    every role, every flag of FR-002, `passwordChangeAvailable`, `secondFactorManagementAvailable`
    and `groupware.enabled` (SC-009).
  - **Hub** (`/account`): the overview for mailbox users (R20), then the visible sections grouped
    as FR-002 lists them, each as a link card with a one-line summary. A group without a visible
    section is hidden. The hub lists only sections whose route is registered
    (`router.hasRoute`), so each user story adds its section without a placeholder and no link can
    break (conventions "Where features meet").
  - **Section pages**: each section has its own route (FR-006), listed in
    [data-model.md](./data-model.md#5-route-map), with `meta.navEntry: 'account'` and
    `meta.accountSection: <id>`. `AccountLayout.vue` evaluates `ownVisibility` for the route's
    section and renders `NoAccessState` in place, keeping the address and requesting no section
    data, exactly as 001-R19 does for the catalogue. `unknown` renders the section's error state
    with "Try again" (spec edge case "capabilities cannot be read"). `NoAccessState` gains an
    optional reason key (Mail app setup for administrators shows legacy `login.mobileconfig_info`,
    FR-106).
  - **Sections with parts**: "Mail settings" (tagged mail, TLS policy) and "Devices" (ActiveSync
    reset, SOGo profile reset) are one section each with one address, as US7 and US11 name them.
    Each part is hidden without its own flag, and the section's address shows "no access" when no
    part is visible (FR-002, FR-006). In-page anchors (`#tagged-mail`, `#tls-policy`) are
    conveniences, not section addresses.
  - **Explanations on phones** (FR-123): long legacy explanations render as a collapsed "About …"
    disclosure above the form below `md`, expanded from `md` up, so the primary action is reachable
    without scrolling past them. Warnings that the spec requires to be visible without interaction
    (TLS bounce warning, FR-075; SOGo deletion, FR-087) are never collapsed.
  - **Wide screens**: from `lg` up, the section navigation stays visible beside the content, as in
    UI 003's mailbox detail (UI 003 FR-016). Below `lg` the hub is the navigation.
  - **Home** (`src/features/home/pages/HomePage.vue`): for mailbox users, `MailboxHomeCard` from
    `@/features/account` shows the storage usage, linking to My account, and the Webmail action
    (FR-001, R20).
- **Rationale**: Section visibility depends on the self-service capabilities as well as on the role
  and flags, so it cannot live in the catalogue, whose entries know only roles and flags. Rendering
  "no access" in place keeps 001's deep-link semantics.
- **Alternatives considered**: One catalogue entry per section was rejected: the navigation would
  grow by twelve entries for mailbox users. Tabs on one page were rejected: FR-006 needs a
  bookmarkable address per section, and legacy's dropdown tabs are the problem being fixed.

### R5. Mailbox context inside UI 003's mailbox detail

- **Decision**:
  - **Designated action areas of UI 003** (UI 003 research R19 and data-model §8; named components,
    no plug-in registry):
    1. the section list: `src/features/mailboxes/sections.ts` and `MailboxSectionNav.vue`, with the
       child routes of `mailbox-detail` (`/mailboxes/:address`) in `src/features/mailboxes/routes.ts`.
       UI 005 adds a "Self-service" group whose entries and child routes come from
       `@/features/account` (`mailboxSelfServiceSections`, `mailboxSelfServiceRoutes`, lazy
       components), so that UI 003's files gain only the imports;
    2. the mailbox list's bulk menu: `MailboxBulkActions.vue`, from `bulk.ts`, where UI 005 adds the
       TLS action;
    3. the FR-040 entries of `ManagedSettingsGroup.vue`, whose optional `to` UI 005 fills.
  - **Sections**: a "Self-service" group with App passwords, Temporary aliases, Filters, Push
    notifications, Mail settings, Recent logins and, when `groupware.enabled`, Groupware resets
    (FR-003). Child routes are `/mailboxes/:address/<section>` ([data-model.md](./data-model.md#5-route-map)),
    guarded by the catalogue entry `mailboxes`. Each heading names the mailbox
    ("App passwords of anna@example.org").
  - **Access** (FR-004): `mailboxAccess` grants `change` to administrators always, and to domain
    administrators always except for app passwords (`appPasswds`), push notifications (`pushover`)
    and filters (`filters`), which need the domain administrator's own flag in
    `identity.permissions`. The API grants domain administrators the other flags implicitly
    (`PermissionFlags`). `readOnly` sections render every value and a `ReadOnlyNotice` naming the
    missing permission; change actions are not rendered.
  - **Out-of-scope mailbox** (old link): the API answers `404`, shown as UI 001's "not found" state
    (spec edge case).
  - **UI 003 links**: the FR-040 summaries link to the matching sections (temporary aliases count,
    tagged-mail handling, TLS enforcement, push notifications active).
  - **Bulk TLS**: registered as a mailbox-list bulk action (R16).
- **Rationale**: Conventions "Where features meet" and "Action areas in earlier screens": a later
  feature adds its entry points to the earlier screens' designated areas when it is implemented.
  Reusing UI 003's detail layout keeps the mailbox's summary and navigation around the self-service
  sections.
- **Alternatives considered**: A separate "Mailbox self-service" screen outside the detail was
  rejected by the clarification (FR-003). Impersonation-based access, as in legacy, belongs to UI 007.

### R6. Permission refusals and the global problem reactions

- **Decision**:
  - **`permission-flag-required`** (403, `requiredFlags`, `requiredFlagsMatch`): the screen shows
    "Permission withdrawn: {flag label}" with the translated flag labels (`permissionFlags.<flag>`
    for the nine flags this feature uses), and the global reaction invalidates `['identity']` (and
    `['capabilities','self-service']`). The section re-evaluates: hidden in the own context,
    read-only in the mailbox context (FR-007, spec edge case "flag removed while a section is
    open"). The reaction is added to `src/api/query/client.ts` next to 001's `forbidden` reaction,
    unless UI 003 already added it.
  - **One dispatcher for the session reactions**: `src/api/query/client.ts` exports
    `dispatchProblemReactions(problem, { sessionReactions })`, the function its query and mutation
    caches' `onError` call. Requests that bypass TanStack Query because they carry secrets (R13) call
    it too, through `useSecretRequest`, so `unauthenticated`, `pending-action-required`, `forbidden`
    and `permission-flag-required` behave the same for them. The option `sessionReactions: false`
    skips the session reactions; only the password reset completion uses it: its `401
    second-factor-required` asks for a second factor *for the reset*, not for a pending sign-in, and
    must not reroute to the sign-in step (001-R8).
  - **`ApiProblem` extension members**: `src/api/problem.ts` exposes `requiredFlags`,
    `requiredFlagsMatch`, `dependency`, `attemptsRemaining` and `methods`, typed from the generated
    `SelfServicePermissionFlagProblem`, `SelfServiceTemporaryFailureProblem`,
    `SecondFactorEnrolmentFailedProblem` and `PasswordResetSecondFactorRequiredProblem`.
  - **Temporary failures** (FR-020): `temporary-failure` names its `dependency` in plain words
    (`sharedStore` "the mail settings store", `mailStore` "the mail server", `pushover` "the Pushover
    service", `addressGeneration` "no free address was found"); `temporary-verification-failure`
    names "the Yubico verification service". Unknown dependencies fall back to the generic text.
    Each comes with "Try again" and the `Retry-After` countdown where present.
- **Rationale**: FR-007 and FR-013; conventions "Errors and permissions". A per-request opt-out is the
  smallest change to 001's global reactions that keeps them global for every other request.
- **Alternatives considered**: Matching the reset completion by URL inside the global handler was
  rejected: it hides a special case in the core. Catching the problem in the mutation before the
  cache sees it was rejected: TanStack's cache `onError` runs regardless.

---

## 3. Passwords and restricted sessions

### R7. Password forms, policy checklist and generator

- **Decision**:
  - **Shared fields** (`src/shared/components/password/`, promoted from UI 003 at their second
    use, research R1):
    - `PasswordField.vue` (UI 003): a labelled input with a show/hide toggle button
      (`aria-pressed`), "generate" and "copy", paste allowed, `autocapitalize="none"`,
      `autocorrect="off"`, `spellcheck="false"`. UI 005 adds an `autocomplete` prop and a mode
      without the generator (for current-password and confirmation fields).
    - `NewPasswordFields.vue` (new): new password and, when `confirm` is set, its confirmation
      (`autocomplete="new-password"` on both), the policy hints, "Generate" (fills both fields,
      shows them in clear text and offers a copy button), and the mismatch check before submit
      (FR-023, legacy `danger.password_mismatch`).
    - `PasswordPolicyHints.vue` (UI 003): one list item per rule, each marked met or not met in text
      and icon (FR-116), with a polite live region that announces only when the whole policy becomes
      met. It never blocks submission: the API decides (FR-022, as UI 003 decided).
    - Every password form also renders a read-only username field
      (`autocomplete="username"`, visually hidden but available to password managers) holding the
      account's address, so that password managers update the right entry (FR-024).
  - **Policy evaluation** (`src/shared/password/policy-rules.ts`, UI 003's module moved): the
    contract's `PasswordPolicy` rules, evaluated as the API evaluates them: length in **UTF-8 bytes**
    (`utf8ByteLength` of `src/shared/validation/utf8.ts`), letters `[A-Za-z]`, digits `[0-9]`, special characters
    (anything else), mixed case (`[a-z]` and `[A-Z]`). The minimum length is always shown; class
    rules only when required.
  - **Server errors** on `newPassword`: `tooShort` (`min`) and `missingCharacterClass`
    (`characterClass`: `letter`, `digit`, `special`, `lowerAndUpper`) are shown on the field and also
    mark the matching rule as unmet; `preHashedPassword` (`scheme`) gets its own message (FR-012).
  - **Generator** (`src/shared/password/generate.ts`, UI 003's module moved): UI 003's rules: at least 16 characters or the
    policy's minimum when longer, at least one lower-case letter, one upper-case letter and one
    digit, a special character from a small set mail clients accept when the policy requires one,
    no look-alikes (`0 O 1 l I`), `crypto.getRandomValues` with rejection sampling and a
    cryptographic shuffle (FR-025).
  - **Own password** (`/account/password`, FR-021 to FR-028): current password, new password twice,
    "Sign out my other sessions" ticked by default (`endOtherSessions`). Before the change, mailbox
    users see the legacy `user.change_password_hint_app_passwords` with the overview's
    `activeAppPasswords` (FR-027). The request runs through `useSecretRequest` (R13). On `200`
    the app clears the fields and announces the legacy `success.password_changed_success`,
    followed by new strings built from `sessionsEnded`, `activeAppPasswords` (mailbox users) and
    `mailServerCacheSeconds` ("Mail apps may accept the old password for up to 5 minutes"), with
    plural forms (FR-026, FR-119). The
    response renews the session cookie; the next write that meets `csrf-token-mismatch` is retried
    once by 001's middleware. `current-password-incorrect` goes on the current-password field;
    `too-many-requests` shows the countdown (FR-028).
  - **Externally managed passwords**: when `capabilities.account.passwordChangeAvailable` is
    `false`, the Password section shows `ExternalPasswordNotice` instead of the form, and the
    recovery and two-factor sections are hidden (FR-002, spec edge case).
- **Rationale**: One implementation for three password forms (own, forced, reset) and UI 003's
  field. Byte length matches the contract's definition, so a password of non-ASCII characters is
  judged as the server judges it.
- **Alternatives considered**: A single new-password field as in UI 003 was rejected by the spec's
  clarification (confirmation kept). Blocking submission on unmet rules was rejected: the client
  check only guides.

### R8. Forced password change and forced second-factor setup (pending-actions screen)

- **Decision**:
  - `PendingActionsPage.vue` (UI 001) becomes a **linear flow**: when `passwordChange` is pending, it
    shows `ForcedPasswordChange.vue` in place of 001's explanation, classic link and "Check again"
    (FR-029). When `secondFactorSetup` is also pending, the second-factor item is shown below as
    "next step", not yet actionable. After the password is set, the second-factor item becomes the
    active step (FR-031, clarification "password first").
  - `ForcedPasswordChange.vue`: legacy `user.pw_update_required`, `NewPasswordFields` with the
    confirmation, the policy from `getOwnPasswordPolicy` (allowed in the restricted session, API
    mode `includes,passwordChange`), no current password, `changeOwnPassword` with `newPassword`
    only.
  - `ForcedSecondFactorSetup.vue`: legacy `tfa.setup_title` and `tfa.setup_required`, then the
    methods in the order passkey (recommended, 001's `usePasskeyRegistration`), authenticator app,
    security key, and Yubico OTP under "Other methods" (FR-057, FR-058). The enrolment components
    of R10 and R11 are mounted inline with `requireCurrentPassword: false`. Without passkey support
    the passkey option is absent and the other methods replace 001's classic link (FR-057).
    Without WebAuthn support at all, the security key is shown as unavailable with the reason.
  - **After each resolution**: refetch `session` and `identity`. If an action is still pending, the
    flow continues with it. Once the session is `active`, broadcast `session-changed` and call
    `continueAfterSignIn()` (R20), which honours `returnTo` and the webmail forwarding (FR-031,
    FR-059, FR-100).
  - The screen keeps language, theme and "Sign out" (001 FR-038). Every other address still leads
    to it (001's guard), except the public reset routes (R12).
  - **Mock**: the restricted-session handlers of UI 001 (T110) are extended with API 005's route
    modes: `includes,passwordChange` for the password policy and change, `includes,secondFactorSetup`
    for the second-factor list, enrolment, TOTP start and WebAuthn options, `allow` for the
    capabilities; everything else keeps `403 pending-action-required`.
- **Rationale**: API research R5 allows either order; the spec fixes password first. The enrolment
  components are the same as in My account, so forced and voluntary setup behave identically.
- **Alternatives considered**: Separate routes per step were rejected: a restricted session may open
  only the pending-actions route (001-R11), and a reload must resume on one screen.

---

## 4. Second factors

### R9. Listing and removing second factors

- **Decision**:
  - `listOwnSecondFactors` (`sort=id`, page and size in the address) feeds `SecondFactorList.vue`:
    type label (authenticator app, security key, Yubico OTP, "no longer supported" for `u2f` and
    `hotp`), name, state (active or inactive) as text, the Yubico public ID, and "used for this
    sign-in" from `usedForCurrentSignIn` (FR-043, FR-116).
  - **"Only active entry"**: an entry is the only active one when it is `active && usable` and no
    other entry is. Unsupported entries never count (spec edge case). On that entry the remove
    action is labelled "Turn off two-factor authentication" and opens `TurnOffTwoFactorDialog.vue`:
    it says that every entry is removed and passkeys stay, asks for the current password and calls
    `removeAllOwnSecondFactors` (FR-052). Other entries are removed with a plain confirmation and
    `deleteOwnSecondFactor`, without a password (FR-051). "Turn off two-factor authentication" is
    also offered at the end of the list whenever entries exist (FR-053).
  - **Policy**: when `capabilities.account.secondFactorRequired` is `true`, no remove or turn-off
    action is rendered and a note shows legacy `danger.tfa_removal_blocked` (FR-054). A
    `second-factor-required-by-policy` refusal (the requirement changed meanwhile) shows the same
    note and refetches the capabilities and the list. `last-second-factor` (409, the list changed
    elsewhere) refetches and reopens the action as "Turn off".
  - Mailbox users see legacy `user.tfa_info`, linking to App passwords when they hold `appPasswds`
    (FR-055). The section links to Passkeys as the recommended way to sign in without a password
    (FR-044).
  - After any change the list, the capabilities and, in a restricted session, `session` and
    `identity` are refetched (FR-056).
- **Rationale**: The client can tell "last active entry" from the list, so the user never meets the
  `last-second-factor` refusal in normal use (clarification). The policy flag comes from the
  capabilities, as the API asks clients to do (`second-factor-required-by-policy` client action).
- **Alternatives considered**: Legacy's method select with "Deactivate" was rejected by the
  clarification.

### R10. TOTP enrolment and showing the API's QR code under the strict CSP

- **Decision**:
  - **Flow** (`TotpSetup.vue` with `useTotpEnrolment`): name (1–255 characters after trimming,
    `limits.nameMaxLength`) and, outside forced setup, the current password are collected first;
    "Continue" calls `startOwnTotpEnrolment`. The response is kept **only in a component-local
    `shallowRef`**, never in the query or mutation cache (the request is made with the client
    directly, R13). The screen then shows, in this DOM order on every viewport: the key as grouped
    text with a copy button, "Open in authenticator app", the QR code, and the six-digit code field
    (`inputmode="numeric"`, `autocomplete="one-time-code"`, spaces stripped before the
    `^[0-9]{6}$` check). On wide screens the QR code sits beside the key; on phones it follows the
    actions, as FR-046 requires.
  - **Confirmation**: `enrolOwnSecondFactor` with `{ type: 'totp', name, code, currentPassword? }`,
    through `useSecretRequest` like every enrolment and removal request (R13).
    `second-factor-enrolment-failed` keeps the setup open with the same key, puts the error on the
    code field with "{n} attempts left" (`attemptsRemaining`) and the hint to check the phone's time
    (spec edge case). `second-factor-enrolment-expired`, `attemptsRemaining: 0` and the local
    expiry (`expiresAt` with the `Date`-header skew of 001-R13, `useCountdown`) switch to an
    "expired" state that offers to start again (FR-047). `current-password-incorrect` returns to the
    first step with the error on the password field.
  - **Discarding** (FR-048, FR-110): the enrolment ref is cleared on success, cancel, expiry, route
    leave and unmount. Leaving with a started enrolment asks for confirmation through UI 002's
    `useLeaveGuard` (FR-015).
  - **"Open in authenticator app"**: an `<a>` to `provisioningUri`, rendered only when it starts with
    `otpauth://totp/` (checked by `isOtpauthUri()` in `src/features/account/totp.ts`). 001's
    `safeHref` stays http(s)-only.
  - **QR code**: the API returns `qrCode` as `data:image/svg+xml;base64,…` (API research R7,
    BaconQrCode's SVG back end). The production CSP has `img-src 'self'`, which blocks `data:`
    images, and `v-html` is allowed only for sanitised operator HTML. `src/features/account/qr-svg.ts`
    therefore:
    1. accepts only `^data:image/svg\+xml;base64,[A-Za-z0-9+/]+=*$`;
    2. decodes it (`atob`, `TextDecoder`) and parses it with `DOMParser` as `image/svg+xml`,
       rejecting a `parsererror`;
    3. walks the tree and keeps only `svg` (`viewBox`, `width`, `height`), `g` (`transform` limited to
       `translate(…)` and `scale(…)` with numbers), `rect` (`x`, `y`, `width`, `height`, `fill`) and
       `path` (`d` limited to path commands and numbers, `fill`, `fill-rule`), with `fill` limited to
       hex colours;
    4. returns a plain tree, or `null` if anything else occurs.

    `QrCode.vue` renders that tree with Vue's render function (`h()`), inside a white padded box
    for scanning in both themes, with `role="img"` and a label that points to the key shown as text
    (FR-113). When the parser returns `null`, the QR code is replaced by a note to use "Open in
    authenticator app" or the key; enrolment still works.
  - **Grouped key** (`GroupedSecret.vue`): the 32-character base32 key in groups of four, each group
    a separate element with a visually hidden separator, so screen readers read it group by group
    (FR-113); the copy button copies the key without spaces.
- **Rationale**: Rendering the parsed subset keeps the CSP of 001-R18 unchanged and needs no
  dependency. The allowlist makes the rendering safe even if the response were tampered with:
  nothing executable or external can pass.
- **Alternatives considered**:
  - Adding `data:` to `img-src`: rejected, it weakens the policy for every page to show one image,
    and 001-R18 deliberately forbids `data:` URLs.
  - A `blob:` object URL: rejected, it needs `img-src blob:`, the same weakening.
  - Drawing a new QR code from `provisioningUri` with a library: rejected (R1, FR-046).
  - Passing the SVG through `SanitizedHtml`: rejected, its allowlist is for operator text and
    excludes SVG, and widening it would affect the help text and footer.

### R11. Security key and Yubico OTP enrolment

- **Decision**:
  - **Security key** (`SecurityKeySetup.vue` with `useSecurityKeyEnrolment`): support is checked
    with 001's `support.ts` (secure context and `PublicKeyCredential`); without it the option shows
    "This browser cannot use security keys" and the other methods stay usable (US2-AS5, FR-049).
    After the name and, outside forced setup, the current password, an explicit "Start" button
    requests `createOwnSecondFactorWebAuthnOptions`, then runs 001's single-abort-controller ceremony
    (`navigator.credentials.create` with the parsed creation options) and sends
    `enrolOwnSecondFactor` with `{ type: 'webauthn', name, credential, currentPassword? }`. While
    waiting, the polite region announces "Touch your security key now" and then "Waiting for the
    server" (FR-115). There is no client time limit; the options expire server-side after
    `webauthnOptionsLifetimeSeconds`, which the screen states.
  - **Error mapping** for enrolment (different from passkey sign-in, which is silent):
    `NotAllowedError` "The request was cancelled or timed out"; `InvalidStateError` "This security
    key is already enrolled as a second factor" (the options exclude the account's WebAuthn
    factors, spec edge case); `NotSupportedError`/`ConstraintError` "This security key is not
    supported"; `SecurityError` as 001; `second-factor-enrolment-failed` "The key's response could
    not be verified"; `second-factor-enrolment-expired` "The request expired". Each offers "Try
    again", which fetches new options (FR-049). A key that is also a passkey can be enrolled
    (spec edge case), because passkeys are not excluded.
  - **Yubico OTP** (`YubicoOtpSetup.vue`): name, Yubico API client ID (`inputmode="numeric"`,
    `^[0-9]{1,32}$`), secret key (1–128 characters, a password-type field without autofill), the
    OTP (`^[A-Za-z0-9]{44}$`) as the last field, so the key's final Enter submits the form natively
    (FR-050), and, outside forced setup, the current password. The explanation reuses legacy
    `tfa.api_register` with its link rendered as a component slot to
    `https://upgrade.yubico.com/getapikey/` (R23). `temporary-verification-failure` names the Yubico
    service and offers "Try again"; `second-factor-enrolment-failed` says the key or credentials
    were rejected. An enrolment of a key that already exists replaces the entry; the refreshed
    list shows one entry (spec edge case).
- **Rationale**: Reuses 001-R14's codec and ceremony control. Explaining cancellation here is
  required by FR-049, unlike sign-in where a cancelled conditional prompt must stay silent.
- **Alternatives considered**: Auto-starting the ceremony when the step opens was rejected: FR-049
  requires an explicit action, and browsers block prompts without a user gesture.

---

## 5. Password reset

### R12. Password reset before sign-in

- **Decision**:
  - **Availability**: `getSelfServiceCapabilities` is read anonymously on the role-neutral and
    mailbox-user sign-in screens. `ForgotPasswordLink.vue` (legacy `login.forgot_password`) links to
    `/reset-password/request` only when `passwordReset.available` is `true`; while loading, on error
    and when unavailable it renders nothing (FR-034). It replaces UI 001's link to the classic
    `/reset-password` (001 FR-009). Force SSO (001 FR-007) still hides the form and the link.
  - **Routes**: `password-reset-request` (`/reset-password/request`) and `password-reset`
    (`/reset-password`), both in `AuthLayout` with `meta.public: true`. 001's guard (R11) is extended
    so that public routes resolve in **every** session state, including `restricted` (FR-042 governs
    a reset link opened while signed in). UI 014 maps classic `/reset-password` without a token (M04)
    to the request route and with a token (M03) to the reset route.
  - **Request screen** (FR-035 to FR-037): one e-mail field (`type="email"`, `autocomplete="email"`),
    `requestPasswordReset`, then the same confirmation for every accepted request, built from the
    response's `tokenLifetimeMinutes` ("If the address belongs to an account with a recovery
    address, a link valid for 15 minutes is on its way"). `password-reset-unavailable` and an
    unavailable capabilities read show legacy `danger.password_reset_na` (US3-AS7);
    `too-many-requests` shows the countdown.
  - **Token capture** (FR-038): the `password-reset` route's `beforeEnter` moves the token, from
    `?token=` (the API's default `RESTV2_PW_RESET_PAGE`) or from `#token=`, into an in-memory holder
    (`src/features/auth/reset-token.ts`, a module variable, never storage) and returns the same route
    without query and hash with `replace: true`, so the token leaves the address bar and the session
    history entry before the page renders. The browser's own list of visited addresses still records
    the e-mailed link itself, which no page can prevent; the token is single-use and expires after
    `tokenLifetimeMinutes`. The `ng-mailcow` image logs `$uri` without the query string, so its access
    log never holds a token (API observation AG7 recommends the `#token=` form, which never reaches a
    server log at all). The holder is read once by the page and
    cleared on completion, on "request a new link" and on unmount. The token is sent only in request
    bodies (`checkPasswordResetToken`, `createPasswordResetWebAuthnChallenge`,
    `completePasswordReset`), never logged, never in a URL. A reload after the capture finds no
    token and shows the "invalid or expired link" state with "Request a new link".
  - **Reset page flow** (state machine in [data-model.md](./data-model.md#7-state-machines)):
    1. `checkPasswordResetToken` → `valid` with the account address, the expiry as relative and
       absolute time (FR-120), and the policy rules; `400 invalid-reset-token` → the invalid state
       (legacy `login.invalid_pass_reset_token`, FR-039); `secondFactorRequired` with an empty
       `secondFactorMethods` → the "ask an administrator" state (FR-040, spec edge case).
    2. **Signed-in warning** (FR-042): when the session is `active` or `restricted`, a notice before
       the password step says that completing the reset signs out every session of the account,
       "including this one" when the token's address equals `identity.username`, with "Continue" and
       "Back to the app".
    3. **Password step**: `NewPasswordFields` with the token's policy and a read-only username field
       holding the token's address (R7). Submit sends `completePasswordReset` **without** a second
       factor first: the API validates the password before the second factor (API research R6), so
       policy errors (`422`) appear before the user is asked for a code.
    4. **Second-factor step**: `401 second-factor-required` with `methods` shows UI 001's factor
       components (`TotpForm`, `YubiOtpForm`, `WebAuthnFactor`, `OtherMethods`) in the same order and
       tiers as at sign-in. The WebAuthn method first calls `createPasswordResetWebAuthnChallenge`.
       The proof is sent together with the password again. `second-factor-failed` keeps the step
       and allows another try while the link is valid (FR-040); `temporary-verification-failure`
       keeps it with a retry; `second-factor-unavailable` shows the "ask an administrator" state.
       These requests carry the token and the password, so they run through `useSecretRequest`
       (R13) with `sessionReactions: false` (R6).
    5. **Done** (FR-041): the app says that all sessions of the account were signed out and offers
       the sign-in screen; it never signs in. It then refetches `session`; when this browser's
       session is now `anonymous`, it runs 001's session-end clean-up **without** redirecting
       (cache cleared, `signed-out` broadcast, new CSRF token), so other tabs follow.
  - **Expiry while open**: a countdown against `expiresAt` (001's `useCountdown` with skew) moves the
    page to the expired state at zero. Any request answering `invalid-reset-token` does the same.
  - **Throttling**: every request counts towards the API's per-address limits (10 per 15 minutes per
    operation). The two-step completion uses two attempts per reset with a second factor; this is
    accepted. `429` shows the countdown on whichever step is open.
  - Factor components that UI 001 bound to `verifySecondFactor` get a `submit(proof)` callback
    prop, so the sign-in step and the reset page share them.
- **Rationale**: FR-038 asks for the token to leave the address bar "at once"; `beforeEnter` runs
  before any rendering and before the router writes its own history state. The two-step completion
  reproduces "asks for the second factor in the same way as at sign-in" (US3-AS5) and the API's
  order of checks.
- **Alternatives considered**:
  - Sending the second factor with the first completion request, using the token check's
    `secondFactorMethods`: rejected, a policy error would then appear after the code was typed and
    consumed (TOTP replay protection).
  - `history.replaceState` inside the page component: rejected, the component renders once with the
    token in the address.
  - A single `/reset-password` route showing the request form when no token is present: rejected, a
    reload after the capture would silently turn the reset page into the request form.

---

## 6. Mailbox objects

### R13. One-time secrets and the caches

- **Decision**:
  - **`OneTimeSecretDialog.vue`** is promoted from UI 001's `ApiKeySecretDialog.vue` without
    behavioural change (001-R20): the secret lives only in the dialog's local state; closing
    without copying asks for confirmation; Escape and route leave ask the same; the secret is
    cleared on close; no history entry is pushed. New optional props: `username` (shown above the
    secret, FR-062), `grouped` (render through `GroupedSecret`) and the title and warning keys. API
    keys keep their current look.
  - **Secret-bearing requests never touch TanStack Query** (`docs/conventions.md`, "Secrets in
    requests or responses"). TanStack keeps a mutation's `variables` and `data` in the mutation
    cache, so a password in a request is as exposed as a secret in a response.
    `useSecretRequest` (`src/shared/composables/useSecretRequest.ts`, the shared name reused by UI
    001, 010 and 012) is a small composable around a direct call of the generated client: it exposes
    `pending`, `problem`, `result` and `run()` as component state only, with no cache. On a problem it calls
    `dispatchProblemReactions()` (R6), so the session reactions still apply; after success the
    caller invalidates the affected query keys itself (data-model §3). It is used for every request
    that carries or returns a secret:
    - `changeOwnPassword` (own and forced), `replaceOwnRecoveryEmail`, `enrolOwnSecondFactor`,
      `startOwnTotpEnrolment`, `removeAllOwnSecondFactors`;
    - `checkPasswordResetToken`, `createPasswordResetWebAuthnChallenge`, `completePasswordReset`;
    - `createAppPassword` and `updateAppPassword` with `generatePassword: true`;
    - `replacePushNotificationSettings`;
    - `getOwnAppleProfile` and `createOwnAppleProfileWithAppPassword` (R21);
    - UI 001's `createApiKey`, switched in the same change as the dialog promotion.

    Requests without secrets (renames, protocols, active switches, deletions, mail settings,
    aliases, filters, verification, resets, the webmail hand-off) stay TanStack mutations.
  - **No drafts**: none of these forms saves a draft anywhere (conventions; UI 004's `useFormDraft`
    is not used here).
  - A unit test asserts, after each secret flow, that no entry of the query cache or the mutation
    cache contains the secret or the submitted password.
- **Rationale**: Calling the client directly is the only way to keep both the request and the
  response out of every cache; routing problems through the same dispatcher keeps 001's session
  behaviour.
- **Alternatives considered**: Building `useSecretRequest` as a `useMutation` wrapper with
  `gcTime: 0` that strips the secret from the result was rejected (the name is kept, as the
  conventions' shared block reused by UI 001, 010 and 012, but it never touches TanStack Query): the mutation cache still holds the request `variables` (passwords, codes,
  tokens) and the data until garbage collection. `mutation.reset()` after reading was rejected for
  the same reason.

### R14. App passwords

- **Decision**:
  - **List** (FR-060, FR-018): cards below `md`, a table from `md` up, with name, protocols as a text
    list, active state as text and the creation date. Address parameters: `q` (name), `active`,
    `sort` (`name`, `createdAt`, `modifiedAt`, `active`; default `name` ascending), `order`,
    `page`, `size`. Per-item actions only (clarification): open, activate or deactivate, delete.
  - **Create** (`…/app-passwords/new`, FR-061 to FR-063): name (1–255 after trimming), the six
    protocols as checkboxes (IMAP, POP3, SMTP, Sieve, ActiveSync, CalDAV/CardDAV, all ticked), active
    switch (on). Unticking all protocols shows an inline warning that the app password then works
    nowhere and still allows saving (spec edge case). `createAppPassword` (through `useSecretRequest`) without `password`; the
    `generatedPassword` goes to `OneTimeSecretDialog` with the mailbox address as username and
    `grouped` set; closing it replaces the route with the detail page.
  - **Detail** (`…/app-passwords/:appPasswordId`): rename and protocols as editable sections
    (`EditableSection`, sending only the changed member with `If-Match`), the active switch as a
    single-setting save (FR-014), "Generate new password" (confirm, then `updateAppPassword` with
    `generatePassword: true`, then the dialog, FR-065), delete (confirm, `If-Match`, then back to the
    list, FR-066), and History for administrators (R22). The route also serves UI 014's classic
    `/edit/app-passwd/{id}` mapping (M32).
  - **Explanations** (FR-067): legacy `user.app_hint`, plus that an app password works only for its
    protocols even when the mailbox's direct access is off, and never for the web app or webmail.
  - **Mailbox context** without the flag: list and detail read-only (US4-AS7).
- **Rationale**: Mirrors the API key flow of UI 001 (create page, one-time dialog, detail page), so
  users meet one pattern for generated secrets.
- **Alternatives considered**: A creation dialog on the list was rejected: the one-time dialog would
  stack on another dialog, and the convention's leave confirmation needs a route.

### R15. Temporary aliases

- **Decision**:
  - **Generate panel** (collapsible, at the top of the list, FR-069): the domain choice from
    `listTemporaryAliasDomains` (one request with `limit` 1000, the contract maximum; native select;
    no choice when there is one domain, US6-AS6), an optional description (≤
    `limits.descriptionMaxLength`) and the validity. **Validity presets** are legacy's: 1 hour (1),
    1 day (24), 1 week (168), 1 month (744), 1 year (8760), 10 years (87600) hours and "Never
    expires" (`permanent: true`), filtered to `temporaryAliases.minLifetimeHours` …
    `maxLifetimeHours`, with `defaultLifetimeHours` preselected. After `createTemporaryAlias` the new
    address is shown with a copy button and announced (FR-070); the list is invalidated.
  - **List** (FR-068): address with a copy button, description, validity ("Never expires", or the
    relative and absolute expiry, FR-120), creation time. Parameters: `q`, `permanent`
    (`true`/`false`), `sort` (`createdAt` default, newest first; `expiresAt`; `address`), `order`,
    `page`, `size`.
  - **Selection mode** (FR-071, FR-072, FR-124): actions "Expire in …" (the presets, counted from now,
    `updateTemporaryAlias` with `lifetimeHours` or `permanent: true`) and "Delete" (a confirmation
    naming the aliases; typing the number when more than one, FR-017). There is no bulk operation,
    so the actions run through `usePerItemRunner` (`src/shared/composables/`, created here: temporary
    aliases and filters are its two uses; UI 002 and 003 use API bulk operations), one request per
    alias with its listed `etag` in `If-Match`, sent one after another. Selection and the bar are UI
    002's `useBulkSelection` and `BulkActionBar`; results go to `BulkResultSummary`. Without an API
    bulk operation there is no API bulk limit, so the selection is bounded by the current page (at
    most 100); bulk TLS takes `bulkLimit` from the self-service capabilities (conventions "Bulk
    limit"). Outcomes: `2xx` done, `404` not found (the alias expired, spec edge case;
    the list refreshes without it), `412` outdated, `403` refused with the reason, network failure
    "outcome unknown" without automatic retry. Items that did not succeed stay selected (FR-019).
  - Explanation: legacy `user.spam_aliases_info`, verbatim through `SanitizedHtml.vue` (R23).
- **Rationale**: Legacy chooses the validity only after creation (one year fixed); choosing it at
  creation is the improvement the parity table records. The runner is the conventions' bulk
  behaviour for APIs without a bulk operation (clarification).
- **Alternatives considered**: Using the overview's `temporaryAliasDomains` in the own context was
  rejected: the list operation works in both contexts, so one code path serves both (FR-069).

### R16. Mail settings, push notifications and bulk TLS

- **Decision**:
  - **Single-setting saves** (FR-014): tagged-mail handling (radio group "In subfolder", "In
    subject", "Do nothing", with the legacy explanation and an example built from the mailbox's
    own address, `anna+shop@example.org`) and the two TLS switches (legacy
    `user.tls_policy_warning` and the alias-coverage note always visible next to them, FR-075) save
    on change with `updateMailboxMailSettings`, sending only the changed member with `If-Match`
    (mail-settings `etag`). The control shows a pending state; on failure it returns to the stored
    value and the error is announced. A `412` applies the reloaded value and says it was changed
    elsewhere, as 001-R20 decided for single immediate choices. A `503` names the mail settings store.
  - **Push notifications** (multi-field form, FR-015, FR-077 to FR-081): token and user key are
    write-only fields that start empty and state "A value is stored" from `tokenSet`/`userKeySet`;
    empty keeps the stored value, typing replaces it; both are required while none is stored
    (client check plus the server's `secretRequired`); each is checked against
    `^[A-Za-z0-9]{30}$` before submitting (US7-AS4). Title (≤ `pushTitleMaxLength`, "Mail" when
    empty), text (≤ `pushTextMaxLength`), senders (a textarea with one address per line, ≤
    `pushSendersMax` entries of ≤ 255 characters), sound (native select of
    `capabilities.pushoverSounds`, plus the stored value when it is not in that list), active, and
    under "Advanced settings" the sender pattern (≤ `pushSenderPatternMaxLength`), "Escalate high
    priority mail" and "Only consider high priority mail". `replacePushNotificationSettings` (through `useSecretRequest`) sends
    the whole form with `If-Match`; the token and key members are omitted when left empty. The help
    lists the placeholders of the contract and legacy `user.pushover_info` with the mailbox address
    and `edit.pushover_vars` (FR-079). "Verify credentials" announces Pushover's verdict and reason
    (FR-080); `push-notifications-not-configured` says to save first; a `503` names the Pushover
    service. "Remove" (confirmation, `deletePushNotificationSettings` with `If-Match`) returns the
    form to "not configured" (FR-081).
  - **Bulk TLS** (FR-076, US7-AS7): a mailbox-list bulk action (R5) opens a dialog with inbound and
    outbound each "unchanged", "on" or "off" (at least one changed), one explicit confirmation, then
    `applyMailboxMailSettingsBulkAction` with `action: setTlsEnforcement` and the selected mailboxes
    as `targets`, up to `capabilities.bulkLimit`. `BulkResultSummary` reports each result ("29
    changed, 1 not found"); items that did not succeed stay selected. Each target carries the
    version tag listed for it; this depends on **API gap AG1** (plan): the API compares `version` with
    the mail-settings tag, which the mailbox list does not expose.
- **Rationale**: FR-014 and FR-015 split controls into immediate and explicit saves; the Pushover
  form is a multi-field PUT that replaces the settings as a whole, so its active switch is part of
  the form (FR-077 lists it among the form's fields).
- **Alternatives considered**: Omitting `version` in the bulk targets until AG1 is fixed was rejected:
  FR-019 and the conventions require it, and the UI does not work around contract gaps.

### R17. Recent logins

- **Decision**:
  - Parameters (FR-083): `days` from legacy's periods 1, 7, 14 and 31 days ("1 day", "1 week",
    "2 weeks", "1 month"), filtered to `recentLogins.minDays` … `maxDays`, with `defaultDays`
    preselected; `service` (native select: "All services" and the service codes the contract
    documents for `RecentLogin.service`: IMAP, POP3, SMTP, SIEVE, EAS, DAV, SSO, SOGO, WEBUI); `q`
    (client address); `sort` (`lastSeenAt` default, newest first; `service`; `clientAddress`);
    `order`; `page`; `size`.
  - Entries (FR-082): the client address, or "internal" when `internal` is `true` (US8-AS4); the
    country as text from `Intl.DisplayNames(locale, { type: 'region' })`, no flag image and no
    external lookup link (parity table); the translated service label (`EAS` "ActiveSync", `DAV`
    "CalDAV/CardDAV", `SSO` "Webmail sign-in from the app", `SOGO` "Webmail", `WEBUI` "Web
    interface"; unknown codes shown as sent); the last time; the app password's name, linking to
    its detail page when the viewer may open app passwords, or "deleted app password" when the
    name is `null`.
  - "Clear" (FR-084) confirms that the list is also cleared in the classic interface, then
    `clearRecentLogins` and the empty state.
  - Administrators and domain administrators see the section only in the mailbox context (FR-085).
- **Rationale**: The service is an open string in the contract; the documented codes give
  translatable labels and a usable filter. Unknown services still display.
- **Alternatives considered**: Deriving the filter options from the loaded page was rejected: paging
  would hide services. Asking the API for a service list is recorded as API observation AG3 (plan),
  not a blocker.

### R18. Groupware resets

- **Decision**: `GroupwareResets.vue` (My account › Devices, mailbox context › Groupware) offers:
  - "Reset ActiveSync device cache" with legacy `user.eas_reset_help`, one confirmation,
    `resetActiveSyncCache`, and legacy `success.eas_reset` with the mailbox (FR-086);
  - "Reset SOGo profile" with a confirmation stating that settings, contacts, calendars and sharing
    are deleted irretrievably, whose confirm button stays disabled until "I understand that my
    contacts and calendars will be deleted" is ticked (FR-087, US11-AS2). This uses
    `requireAcknowledgement`, added here to UI 002's `ConfirmDialog` (UI 002 added only
    `requireTyped`).

  Both are hidden when `groupware.enabled` is `false`, in both contexts; a `groupware-disabled`
  refusal is still explained (FR-088).
- **Rationale**: The acknowledgement is the "extra deliberate step for an irreversible deletion" of
  the parity table.
- **Alternatives considered**: Typing the mailbox address was rejected: the conventions reserve typed
  confirmations for deletions of domains and bulk deletions.

### R19. Sieve filters

- **Decision**:
  - **Mail setup › Filters** (`/filters`, FR-090): `listSieveFilters` with `mailbox`, `kind`,
    `active`, `q`, `sort` (default `mailbox`, then description), `order`, `page`, `size` in the
    address; cards and table with mailbox, description, kind and active state as text.
  - **Mailbox context** (`/mailboxes/:mailbox/filters`): `listMailboxSieveFilters` with the same
    parameters except `mailbox`, plus the active sieve script panel (FR-003).
  - **My account › Filters** (mailbox users, FR-089): `listMailboxSieveFilters` for the own mailbox,
    read-only, each script shown on demand in `ScriptBlock.vue` (monospaced, line breaks kept, copy
    button), and `getActiveSieveScript`: its name and script, or legacy `user.no_active_filter`
    when `script` is `null`; a `503` names the mail server.
  - **Form** (`…/filters/new`, `…/filters/:filterId`, FR-091 to FR-094): mailbox (a searchable choice
    within scope from `MailboxSearchPicker`, preset and fixed in the mailbox context), kind
    (prefilter or postfilter, legacy `mailbox.set_prefilter`/`set_postfilter`), description (1–255),
    script (`ScriptEditor.vue`: a `<textarea>` with a monospaced font, `wrap="off"`,
    `autocapitalize="none"`, `autocorrect="off"`, `spellcheck="false"`, scrolling inside its own
    area, with a byte counter against `limits.sieveScriptMaxBytes`), active (on). "Check" calls
    `validateSieveScript` without saving (legacy `add.validate`); an invalid result, and a
    `422 sieveSyntax` on save, show the parser's message on the script field (legacy
    `danger.sieve_error`, FR-093). An oversized script shows the API's `tooLong` with `unit: bytes`
    on the field (spec edge case).
  - **Activation warning** (FR-094): when the filter will be active (new, activated, or an active
    filter whose kind changes), the form reads `listMailboxSieveFilters` with that kind and
    `active=true` (`limit: 1`) and, when another filter would be deactivated, names it ("Saving
    deactivates the active prefilter 'Spam to folder'"); otherwise it shows legacy
    `add.activate_filter_warn` as a general note.
  - **Selection mode** (FR-095): activate, deactivate, switch kind and delete for several filters,
    one `updateSieveFilter`/`deleteSieveFilter` per filter with its listed `etag` through
    `usePerItemRunner`; deletion of several needs the typed count.
  - **`MailboxSearchPicker`** (`src/shared/components/MailboxSearchPicker.vue`, the canonical name of
    `docs/conventions.md`): no earlier-implemented feature has a mailbox picker, so UI 005 creates it
    under `src/shared/` (conventions "Ownership"; later features reuse it). It follows the promoted
    `DomainPicker`: Reka `Combobox` without `ComboboxViewport`, a debounced `q`, `listMailboxes`
    through `useInfiniteQuery` with UI 003's `['mailboxes','list',params]` key, 25 per page, "load
    more", empty and error states.
  - **Read-only callers** (domain administrators without `filters`): lists and detail without
    actions, with the reason (FR-005). Mailbox users never see Mail setup › Filters.
  - Global filters and presets stay out (FR-096, UI 013).
- **Rationale**: One form and one list serve Mail setup and the mailbox context. Reading the one
  active filter of the kind is a cheap, exact way to name what will be deactivated (US10-AS2).
- **Alternatives considered**: A code editor component (CodeMirror) was rejected under constitution
  VIII and the CSP (it injects styles). Checking the script on every keystroke was rejected: the
  parser runs server-side, and FR-093 asks for an explicit check.

---

## 7. Overview, webmail and mail apps

### R20. Mailbox overview, webmail hand-off and forwarding after sign-in

- **Decision**:
  - **Overview** (`getOwnMailboxOverview`, FR-097): address and display name; storage as
    `QuotaUsage.vue` (a `role="progressbar"` bar with `aria-valuenow` and a visible text "256 MiB of
    1 GiB used (25 %)" formatted in the locale, or "unlimited"), the message count; protocol access
    as a list of "IMAP: allowed / not allowed" with icon and text (US5-AS2); direct aliases, shared
    aliases with their public comments, alias-domain addresses and catch-alls; send-as addresses,
    domains or "any address"; the recovery address; the password-changed time ("unknown" when
    `null`); and the counts of active app passwords and temporary aliases and whether push
    notifications are active, each linking to its section when visible.
  - **Webmail action** (`WebmailAction.vue`, `useWebmailHandOff`, FR-098, FR-099): offered only to
    mailbox users with a full session, while `groupware.enabled` is `true` and no impersonation is
    active (`identity.impersonation` absent; UI 007 owns "webmail as"). On click it **synchronously**
    opens a blank tab (`window.open('', '_blank')`), then calls `createWebmailHandOff`. On success it
    clears the tab's `opener` and navigates it to `data.url` (checked with `safeHref` as a same-origin
    path). When the browser blocked the tab (`null`), it shows an "Open webmail" link to `data.url`
    with `target="_blank" rel="noopener noreferrer"` (US5-AS3). On failure it closes the blank tab
    and shows the problem. The help text says that opening webmail signs this browser out of the
    classic interface (FR-099, spec edge case).
  - **Forwarding after sign-in** (FR-100): `src/app/session/landing.ts` gains
    `continueAfterSignIn()`, the single place where 001's landing (`returnTo` or home) happens,
    and the session store gains `landingIntent: 'default' | 'requested'`.
    - `requested` is set by the guard when it sends an anonymous navigation to sign-in with a
      `returnTo` other than home, and by the session end of 001 FR-034 (re-authentication).
    - Before landing, with intent `default`, a full session, the role `mailboxUser` and no pending
      action, the hook from `src/features/account/webmail-forwarding.ts` reads the overview (which
      the home card reuses from the cache) and, when `webmail.redirectAfterSignIn` and
      `webmail.enabled` are `true`, calls `createWebmailHandOff` and opens `data.url` in the same tab
      with `location.assign`.
    - Any failure lands normally and announces that webmail could not be opened.
    - The intent resets to `default` after landing and on sign-out.
  - The password sign-in, passkey sign-in, second-factor step and pending-actions screen of UI 001
    call `continueAfterSignIn()` instead of landing themselves.
- **Rationale**: Popup blockers allow a window opened synchronously in the click handler; opening it
  after the request has resolved is blocked by Safari and Firefox. `continueAfterSignIn()` makes
  FR-100 one rule instead of four call sites.
- **Alternatives considered**:
  - Opening the tab after the response: rejected, blocked in practice.
  - `noopener` on the pre-opened tab: rejected, `window.open` then returns `null` and the tab
    cannot be navigated.
  - Forwarding from the home page after it renders: rejected, the user would see the app flash
    before webmail.

### R21. Mail app setup: guide and Apple connection profiles

- **Decision**:
  - **Guide** (`getOwnClientConfiguration`, FR-101, FR-102): one card per protocol (IMAP, POP3,
    SMTP, CalDAV, CardDAV, ActiveSync; the last three only when not `null`) with the server name, each
    port with its encryption ("SSL/TLS" for `tlsPort`, "STARTTLS" for `starttlsPort`), the
    authentication method ("normal password", from `authentication`), and the username (the
    address), each value with a `CopyButton` whose result is announced (FR-111). A protocol whose
    direct access is off in the overview carries "Only an app password that allows {protocol} works
    here" (US9-AS2). The guide explains that an app password is needed when two-factor
    authentication is on (any active, usable entry of `listOwnSecondFactors`) or direct access is
    off, linking to App passwords for holders of `appPasswds`. `documentationUrl` is offered as an
    external link through `safeHref`.
  - **Profiles** (FR-103 to FR-105): "E-mail" (`variant=email`) always and "E-mail, calendars and
    contacts" (`emailAndDav`) only when `groupware.enabled`, with legacy explanations and the note
    that they are for iPhone, iPad and Mac. Holders of `appPasswds` get "Include a new app password".
    - The download calls `getOwnAppleProfile` or `createOwnAppleProfileWithAppPassword` through the
      client with `parseAs: 'blob'` **directly** (no query, no mutation cache).
    - `src/shared/platform/download.ts` (the canonical download helper of `docs/conventions.md`,
      created here if no earlier feature did) creates an object URL, clicks a temporary
      `<a download="<filename>">` (the file name from `Content-Disposition`, fallback
      `profile.mobileconfig`), removes the element, and revokes the URL after one second, the time
      browsers need to start the download. No reference to the blob is kept.
    - After a profile with an app password, the app says that the file contains a new app password
      and should be deleted after installation, and links to App passwords; the app password list
      and the overview are invalidated (FR-104).
    - `permission-flag-required` hides the option and explains (spec edge case).
    - An interrupted download leaves the app password listed, as the spec's edge case expects.
  - **Preselection**: the route accepts `variant` (`email`, `emailAndDav`) and `appPassword=1`, set by
    UI 014's mapping of the classic `/?mobileconfig` sign-in step (M33). They only preselect the
    choice and focus the download button; nothing is downloaded or created until the user starts it
    (UI 014 FR-050).
  - **Other roles**: the section's `ownVisibility` is `hidden` for administrators and domain
    administrators, and `NoAccessState` shows legacy `login.mobileconfig_info` (FR-106).
- **Rationale**: A fetched blob lets the app handle `401`, `403 permission-flag-required` and
  `422` like any other request and hands the file over the moment it arrives, as FR-105 describes.
  Revoking the URL right afterwards keeps the file, which may hold a password, out of memory.
- **Alternatives considered**: A plain link to `GET /me/mailbox/apple-profile` for the variant
  without an app password was considered (the API sends `Content-Disposition: attachment`), but
  rejected for uniform error handling: an expired session would download a problem document.
  Whether iOS Safari opens the profile installer from a blob download is validated on a device
  (quickstart Part D); if it does not, the file still lands in Downloads, from where it installs.

---

## 8. Cross-cutting

### R22. History and the audit log

- **Decision**:
  - API research R22: every self-service record has `target.id` = the mailbox address (or the
    username for own targets of administrators), the object's label in `target.name`, and the
    object's own ID only in `details`.
  - **History** (FR-108), administrators only (domain administrators cannot read the audit log):
    on the mailbox context's self-service group, `HistoryLink` opens the audit log with
    `targetId=<mailbox>` (all records of the mailbox); on each app password, temporary alias and
    filter it opens `targetType=appPassword|temporaryAlias|sieveFilter&targetId=<mailbox>`, the
    narrowest filter the contract offers.
  - **Audit log screen** (FR-107): the target type filter offers the self-service target types
    (`accountPassword`, `secondFactor`, `recoveryEmail`, `passwordReset`, `appPassword`,
    `temporaryAlias`, `sieveFilter`, `pushNotificationSettings`, `mailSettings`, `recentLogins`,
    `groupwareData`, `webmailHandOff`); every self-service event type and failure reason gets a
    translated label in `src/features/audit-log/labels.ts`; detail values `set`/`changed` and
    `{changed, oldSize, newSize}` are shown as text ("changed", "changed (120 → 240 bytes)").
- **Rationale**: Conventions "History and audit": each feature adds labels for its event types.
- **Alternatives considered**: Per-object filtering by `details` was rejected: the contract has no
  such filter; recorded as observation AG6 (plan).

### R23. Internationalisation

> **Superseded in part by constitution IV 1.3.0** (owner rule, 2026-10-18; `docs/conventions.md`,
> "Translations and forms"). The screens mirror the legacy forms named in plan.md "Translations and
> forms (constitution IV 1.3.0)", and mailcow's translations are used verbatim, in every language
> mailcow ships, loaded at runtime from the installation. The bullets below are corrected in place.

- **Decision**:
  - **Legacy keys** (constitution IV, FR-118, SC-007): every key listed in the spec's Legacy Parity
    section, and every key of the plan's legacy form map (task T010a), is used directly by its
    legacy key through UI 001's legacy translation layer (runtime `/lang/` loader, `en-gb`
    snapshot, formatter). There is no `src/i18n/legacy-map.json` alias and no copy in
    `src/i18n/messages/`. Checked against the upstream `2026-09a` files while planning:
    - **HTML in legacy values** (`tfa.api_register`, `login.invalid_pass_reset_token`,
      `mailbox.sieve_info`, `user.spam_aliases_info`, `user.tls_policy_warning`,
      `user.pushover_info`, `edit.pushover_vars`, `user.eas_reset_help`,
      `user.direct_protocol_access`, `user.force_pw_update`): shown verbatim through
      `SanitizedHtml.vue` with UI 001's small allowlist. They are not stripped to plain text, and
      `tfa.api_register` keeps its own anchor (no `linkSlot`); its `%s` gets the product name from
      the branding configuration, as the classic interface fills it from `ui_texts.main_name`.
    - **Missing in the upstream cs-cz or sk-sk files** (`tfa.setup_title`, `tfa.setup_required`,
      `danger.tfa_removal_blocked`, `user.pw_update_required`, and in sk-sk also the `login.*` reset
      keys, `danger.password_reset_na`, `danger.reset_token_limit_exceeded`,
      `danger.invalid_reset_token`, `success.password_changed_success`, `user.password_reset_info`,
      `user.tfa_info`, `user.spam_aliases_info`): no hand-written value. They fall back to `en-gb`,
      as in the classic interface; the FeldHost fork's cs-cz and sk-sk files are complete anyway.
    - **Placeholders**: `%s` and `%d` are converted mechanically and filled as the classic interface
      fills them. `user.change_password_hint_app_passwords` is used verbatim with its `%d` (the
      number of active app passwords), not replaced by a plural key.
  - **Plural rules** (FR-119), for new strings only: `src/i18n/index.ts` registers `pluralRules`
    for `cs-cz` and `sk-sk` (1 → first form, 2–4 → second, otherwise third), unless UI 002 or 003
    already did. `scripts/i18n/check.mjs` gains a rule: a new string whose `en-gb` value has plural
    choices must have exactly three choices in `cs-cz` and `sk-sk`.
  - **New namespaces**, only for elements the legacy forms lack (section names, the permission
    flag labels (`acl.*`), field labels and messages with a legacy key use that key): `account.*`,
    `filters.*`, `auth.passwordReset.*`, `auth.pendingActions.passwordChange.*`,
    `auth.pendingActions.secondFactor.*`, `selfService.dependency.*`, `selfService.service.*`, and
    the `problem.*`, `validation.*` and `auditLog.*` keys of the values appended to
    `src/i18n/coverage.json` that have no legacy `danger.*` equivalent. Each is in en-gb, cs-cz and
    sk-sk, never machine-translated.
  - **Problem messages with parameters** (`src/i18n/problems.ts`): `permission-flag-required` with
    the flag labels joined by `Intl.ListFormat` (conjunction or disjunction by
    `requiredFlagsMatch`); `temporary-failure` with the dependency; `second-factor-enrolment-failed`
    with `attemptsRemaining`; `tooLong` with `unit: bytes` and `stored: true`; `sieveSyntax` with the
    parser's `message` and `line`; `preHashedPassword` with `scheme`; `missingCharacterClass` with
    the translated class; the formats `email`, `pushoverCredential`, `soundName` and `digits`.
  - **Formatting**: sizes with the byte formatter of `src/i18n/format.ts` (binary units, locale
    digits), countries with `Intl.DisplayNames`, expiry as relative plus absolute time (FR-120).
- **Rationale**: Constitution IV 1.3.0: mailcow's human-made translations are used one to one, and
  missing keys fail CI (new strings in en, cs and sk; used legacy keys in the `en-gb` snapshot).
- **Alternatives considered**: Rewriting every HTML-bearing string as a new key was rejected: it
  would drop 33 existing translations per key and fail SC-007. Converting markup to plain text at
  import time (the earlier decision) was rejected by constitution IV 1.3.0: legacy text is never
  altered.

### R24. Testing

- **Decision** (001-R22 to R25 apply; additions):
  - **Mock handlers**: `tests/mocks/handlers/self-service/` with one file per area (capabilities,
    own account, second factors, password reset, overview and client setup, app passwords, temporary
    aliases, push notifications, mail settings, recent logins, groupware, sieve filters) and an
    `index.ts` registered in `tests/mocks/handlers/index.ts`. They implement the contract's documented
    behaviour on the scenario state: scope (`404` outside it), flags (`403
    permission-flag-required` with `requiredFlags`), restricted-session route modes (R8), `If-Match`
    and `412`, filters, sorting, paging, single-use TOTP enrolments (expiry, five attempts), WebAuthn
    options, reset tokens (valid, expired, used, unsupported-only), throttling, the anti-enumeration
    acknowledgement, temporary failures by dependency, Pushover verdicts and the webmail hand-off
    with its `Set-Cookie`.
  - **Contract validation**: the validator of 001-R22 is extended to non-JSON responses (the
    `application/x-apple-aspen-config` profile is validated as a string body) and checks every
    documented required header, including `Content-Disposition` and `Set-Cookie`.
  - **TOTP**: `tests/support/totp.ts` (RFC 6238 with `node:crypto`), promoted from UI 001's
    `tests/smoke/fixtures/totp.ts`, is used by the mock to verify codes, by end-to-end tests to
    compute a code from the key shown on screen (which proves the displayed key is right) and by the
    smoke suite.
  - **QR fixture**: `tests/mocks/factories/qr-svg.ts` produces a BaconQrCode-style SVG data URI; the
    unit tests of `qr-svg.ts` also feed malicious variants (`<script>`, `foreignObject`, event
    attributes, `href`, `style`, external references, a non-SVG data URI).
  - **Browser specifics**: WebAuthn enrolment uses 001's virtual authenticator
    (`@virtual-authenticator`) and `stubCredentials` on WebKit; the webmail tab is asserted with
    `context.waitForEvent('page')` and a route stub for `/SOGo/**`; a blocked tab is simulated by
    an init script that makes `window.open` return `null`; profile downloads with
    `page.waitForEvent('download')`; clipboard refusal with 001's fixture.
  - **Coverage rule** (001-R24): every acceptance scenario of US1 to US12 has an end-to-end test on
    `mobile-chromium`, `desktop-chromium` and (without `@virtual-authenticator`) `mobile-webkit`,
    with `expectAccessible` on every screen and state, no horizontal scroll at 360 and 320 px, touch
    targets, and zero CSP or contract violations. Test titles carry the spec IDs.
  - **Smoke** (001-R25) against the API dev stack and its seeder (`admin`, `reseller`,
    `alice@example.org` with TOTP, `bob@example.org` with a forced password change, plus API 005's
    seeded app passwords, filter, alias domain, `sasl_log` rows and reset template). Specs that
    change credentials run serially in one file and restore what they change; the reset smoke reads
    the token from the dev database (`@local-stack`, skipped against a real host).
- **Rationale**: The constitution's three layers, with the mock unable to return data the contract
  forbids. Computing the TOTP code from the displayed key tests the enrolment end to end.

### R25. Performance

- **Decision**: Every new route is lazy (one chunk per page, the enrolment components in their own
  chunk shared by My account and the pending-actions screen). `src/features/account/index.ts` and
  `src/features/filters/index.ts` export routes with dynamic imports and only light modules
  (sections, landing hook), so the entry chunk grows by a few kilobytes at most; `budget:check`
  guards it. `scripts/run-lhci.mjs` adds a collection for `/ng/account` with the scenario
  `mailbox-account` (SC-011). Queries follow 001-R9: capabilities and the overview are fresh for
  5 minutes (they change only through the operator or this screen's own mutations, which
  invalidate them), lists for 30 seconds.
- **Rationale**: Constitution VII.
