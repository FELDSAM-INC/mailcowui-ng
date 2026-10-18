# Implementation Plan: Account Self-Service

**Branch**: `main` (no feature branches, constitution 1.1.0) | **Date**: 2026-10-18 |
**Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-account-self-service/spec.md`

## Summary

UI feature 005 lets every signed-in account look after itself, and lets administrators and domain
administrators manage the self-service objects of the mailboxes in their scope. It delivers:

- **My account** for every role (`/account`): own password, recovery e-mail, second factors
  (authenticator app, security key, Yubico OTP), a link to passkeys, and for mailbox users the
  mailbox overview, app passwords, recent logins, temporary aliases, mail settings (tagged mail, TLS),
  push notifications, read-only filters with the active sieve script, groupware resets and mail app
  setup (setup guide and Apple connection profiles);
- **restricted sessions resolved in the app**: the pending-actions screen of UI 001 gains the forced
  password change and every second-factor method, password first;
- **password reset before sign-in**: "Forgot password?" when available, the request screen and the
  reset page that the e-mailed link opens (`/ng/reset-password?token=…`), with the second-factor
  step of sign-in;
- **webmail**: a Webmail action that opens webmail signed in, and forwarding to webmail after
  sign-in when the mailbox asks for it;
- **mailbox context** in UI 003's mailbox detail: app passwords, temporary aliases, filters, push
  notifications, mail settings, recent logins and groupware resets of one mailbox; bulk TLS
  enforcement from UI 003's mailbox list;
- **Mail setup › Filters**: the sieve filters of all mailboxes in scope;
- **history**: self-service event labels and History actions into UI 001's audit log.

The technical approach (details in [research.md](./research.md)):

- **No new runtime dependency.** Everything runs on UI 001's foundation and on the shared pieces UI
  002–004 build (bulk selection, per-item runner, typed confirmation, changed-value marking, History
  link, mailbox detail and list). Three areas are touched: `src/features/account/` (new; own and
  mailbox context share one implementation), `src/features/filters/` (new) and `src/features/auth/`
  (reset pages, forced actions) (R1, R3).
- **Contract**: bump to mailcow-rest-v2 commit `32079252…` or later (376 operations, all 51
  self-service operations, `KnownProblemType` registered) (R2).
- **Visibility**: a pure section registry decides, per role, flag and self-service capability,
  whether a section is shown, replaced, read-only or "no access" (R4, R5, R6).
- **Secrets**: generated secrets never reach the query or mutation cache (`useSecretMutation`,
  `OneTimeSecretDialog` promoted from UI 001); TOTP data and profiles stay in component state; the
  reset token leaves the address bar before the page renders (R10, R12, R13, R21).
- **Strict CSP kept**: the API's QR code (an SVG data URI) is parsed into an allowlisted SVG subset
  and rendered by Vue, instead of relaxing `img-src` (R10).
- **Webmail**: the new tab is opened synchronously in the click handler so popup blockers allow it;
  a single `continueAfterSignIn()` applies the forwarding rule after every sign-in path (R20).
- **i18n**: legacy keys are reused, including those with HTML (converted to plain text with link
  slots at import time); Czech and Slovak plural rules (R23).
- **Tests**: contract-validated mock handlers for the self-service module, end-to-end tests of every
  acceptance scenario on 360 px and desktop with axe in both themes, and smoke tests against the API
  dev stack (R24).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict) and Vue 3.5 SFCs; Node.js 24 LTS for tooling (as
UI 001).

**Primary Dependencies**: UI 001's ten runtime dependencies, unchanged (001-R1). No addition.
Tooling unchanged (001-R2).

**Storage**: none on a server. In the browser: the query cache and the two Pinia stores of UI 001;
one new session-store field (`landingIntent`, memory). No new device storage key; secrets only in
component-local state (data-model §4).

**Testing**: Vitest and Vue Test Utils (units, components); Playwright on `mobile-chromium` (360 px),
`desktop-chromium` and `mobile-webkit` against the production build, the production CSP and the
contract-validated mock; axe in both themes, no horizontal scroll at 360 and 320 px, touch targets;
smoke against the mailcow-rest-v2 dev stack; Lighthouse CI and the bundle budget (001-R22 to R26).

**Target Platform**: as UI 001: the two latest major evergreen browsers including iOS Safari and
Chrome for Android, served under `/ng/` by the `ng-mailcow` image.

**Project Type**: web application (static SPA; the backend is the separate mailcow-rest-v2).

**Performance Goals**: every view shows a loading state at once and content within 2 s for 95 % of
loads on a mid-range phone (SC-011); webmail reachable within 3 s (SC-012); initial JS stays
≤ 200 KB gzipped; Lighthouse ≥ 90 for `/ng/account`.

**Constraints**: strict CSP unchanged (no `data:` images, no inline style or script); no secret in
storage, address, history, caches or logs (SC-008); WCAG 2.2 AA in both themes; 360 px first; only
contract operations; no hard-coded capabilities or limits (FR-009); every legacy key of the parity
section reused (SC-007).

**Scale/Scope**:

- 12 user stories (4 at P1, 5 at P2, 3 at P3), 68 acceptance scenarios, 124 functional requirements.
- 31 new routes: 15 in My account, 11 in the mailbox context, 3 for Mail setup › Filters, 2 for the
  password reset.
- 49 of the 51 self-service operations, plus 7 operations of features 001–003.
- 3 locales; about 450 new translation keys, about 90 of them reused from legacy.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Gate | Status |
|---|---|---|
| I. The API contract is the only interface | Only operations of the pinned contract, through the generated client (contracts/README.md lists 49 + 7). The pin moves to a commit containing API 005 (R2), recorded in `contract/VERSION.json`. No hand-written API type: section rules, presets and view models are app-defined (data-model §2). Where the contract falls short (bulk TLS version tag, filter by ID), gaps G1 and G2 are reported, and the UI does not work around them. Errors are handled from `type`, `errors` and the documented extension members (R6). | PASS |
| II. Mobile-first | Every screen is designed at 360 px: sections as their own pages, lists as cards below `md`, long forms split (Pushover "Advanced", filter editor page, TOTP steps), the TOTP open/copy actions before the QR code. Selection modes for multi-item actions. Destructive actions confirmed with their impact; bulk deletions typed; the SOGo reset needs an acknowledgement. Every list has loading, empty and error states. Tested on `mobile-chromium` and `mobile-webkit`. | PASS |
| III. Accessibility (WCAG 2.2 AA) | axe on every screen and state in both themes; the QR code has a text alternative pointing to the grouped key; statuses in text; announced copy results, saves and WebAuthn waits; no time limit without "Try again"; confirmation dialogs trap and return focus (FR-112 to FR-116). | PASS |
| IV. i18n and branding | All text in en-gb, cs-cz and sk-sk; legacy keys mapped, including HTML-bearing ones converted to plain text at import time (R23); missing cs/sk legacy values supplied by the hand-written layer; Czech and Slovak plural rules; locale formatting of sizes, dates, countries. No brand text: the Yubico API key URL is a vendor address, not operator branding. | PASS |
| V. Security in the browser | Same-origin session and in-memory CSRF token (001). No new storage key; secrets never in caches (`useSecretMutation`), the address bar, history or logs; the reset token scrubbed in `beforeEnter`; the profile blob released after hand-over. CSP unchanged: the QR code is rendered from an allowlisted SVG subset, not `data:` or `v-html`. Hiding is a convenience: refusals (`forbidden`, `permission-flag-required`, `404`) are handled and the identity re-read (FR-007). | PASS |
| VI. Test-first | Every phase of tasks.md writes failing tests first: units and components, end-to-end tests of all 68 acceptance scenarios on both viewports against the contract-validated mock, and smoke tests against the API dev stack. Mocked requests and responses, including the binary profile and the `Set-Cookie` of the hand-off, are validated against the contract (R24). | PASS (smoke gate as UI 001's Complexity Tracking) |
| VII. Performance budgets | All routes lazy; the account and filters indexes export only light modules; `budget:check` and a Lighthouse collection for `/ng/account`; queries follow 001-R9 with 5-minute freshness for capabilities and the overview and invalidation after every mutation (data-model §3). | PASS |
| VIII. Simplicity | No new dependency. One section implementation for both contexts. Shared promotions only at a second use (`OneTimeSecretDialog`, `CopyButton`, `GroupedSecret`, password fields, policy and generator, `byte-length`, `useSecretMutation`); single-use helpers (`qr-svg.ts`, `download.ts`, `useWebmailHandOff`) stay in the feature. | PASS |
| Technology constraints | Stack unchanged; no TailAdmin Pro; the needed TailAdmin primitives are already copied (radio group, switch, checkbox, collapsible, textarea, table, dialog); no CDN; no backend code. | PASS |
| Workflow and gates | Lint, types, units, end-to-end on both viewports with axe, budgets, translations and the audit run in CI as for UI 001. Commits to `main`. | PASS |
| `docs/conventions.md` | "The classic interface" wording; passkeys wording. Lists: state in the address, 25/50/100, cards and tables, states. Bulk: explicit selection of the current page, the API bulk operation for TLS (with item versions, G1), one request per item otherwise, per-item results, failed items stay selected, "outcome unknown" never retried. Editing: per-section saves, only changed fields with the version, outdated handling with kept input and marked values, refused deletions confirmed again. Confirmations: impact named, typed count for bulk deletions. Secrets: shown once with copy, confirm on uncopied close, write-only Pushover credentials. History: labels and History actions. Errors translated, flags hidden or read-only. Entry points into UI 001 and UI 003 through their designated areas; capabilities from `getSelfServiceCapabilities`. | PASS |

**Post-design re-check (after Phase 1)**: PASS. Decisions that touched gates:

- QR code rendered from a parsed SVG allowlist instead of `img-src data:` (V, R10).
- Secrets kept out of the mutation cache with `useSecretMutation` (V, R13).
- Reset routes public in every session state, an exception to UI 001's restricted-session gate that
  FR-042 requires (R12).
- Bulk TLS blocked on API gap G1 instead of omitting the version tag (I, conventions, R16).
- Profiles downloaded through a revoked object URL, never cached (V, R21).

## API dependency and gaps

This feature depends on **mailcow-rest-v2 feature 005** (contract authored in commit `4a8401e`,
amended up to `3207925`), and on the contracts of features 001 (identity, sessions, passkeys,
second-factor step, audit log), 002 (audit target filters, bulk outcome types) and 003 (mailbox list
and detail). The pin is in [contracts/README.md](./contracts/README.md). The spec's "Amendment" rows
are API 005 FR-080 ("must keep a second factor", capabilities `account`), FR-081 (temporary-alias
domains), FR-082 (Apple connection profile) and FR-083 (client configuration); the spec's table is
updated accordingly.

Gaps and observations found while planning:

1. **G1 – Bulk TLS version tag (blocks FR-019 for US7-AS7)**: `applyMailboxMailSettingsBulkAction`
   compares each target's `version` with the mailbox's **mail-settings** tag (API research R15), but
   UI 003's mailbox list exposes only the mailbox `etag`. The UI must send each item's version as
   listed (conventions, FR-019), which would make every item `outdated`. **Proposed to
   mailcow-rest-v2**: accept the mailbox `etag` as `version` for `setTlsEnforcement` (TLS
   enforcement is stored in the mailbox row that this tag covers), or add the mail-settings tag to
   `Mailbox`. **Default applied**: the bulk TLS task depends on the fix being in the pinned contract;
   the UI does not omit the version. Everything else in US7 proceeds.
2. **G2 – No read of a Sieve filter by its ID alone (affects UI 014 row M31)**: every filter
   operation needs the mailbox in its path, and `GET /sieve-filters` has no `id` filter, so the
   classic `/edit/filter/{id}` cannot be mapped to UI 005's filter detail
   (`/filters/:mailbox/:filterId`). **Proposed**: an `id` query filter on `GET /sieve-filters` or a
   top-level `GET /sieve-filters/{sieveFilterId}`. **Default**: UI 005's route keeps the mailbox
   segment; UI 014 maps M31 to `/filters` until the gap is closed. Not blocking for UI 005.
3. **G3 – Recent-login services are an open string** (observation): `RecentLogin.service` and the
   `service` filter document their values only in prose. The UI offers the documented codes as filter
   options and shows unknown codes as sent (R17). **Proposed**: list known values (an open
   enumeration) in the contract.
4. **G4 – Stale descriptions** (observation): `PendingAction` and `docs/problems.md`
   `pending-action-required` still say that a password change happens in the legacy UI and that
   only a passkey resolves `secondFactorSetup`. **Proposed**: describe the routes that API 005
   opens in restricted sessions.
5. **G5 – QR code format** (observation): `OwnTotpEnrolment.qrCode` is an SVG data URI, which the
   web app's strict CSP cannot load as an image; the UI renders an allowlisted subset (R10).
   **Proposed**: document that the SVG uses only `svg`, `rect`, `g` and `path`.
6. **G6 – Per-object history** (observation): self-service audit records carry the object's ID only
   in `details`, so History on one app password, alias or filter filters by target type and mailbox
   (R22). Acceptable under FR-108 ("that mailbox or object").
7. **G7 – Reset token in access logs** (observation): the default `RESTV2_PW_RESET_PAGE`
   (`/ng/reset-password?token={token}`) puts the token in a query string that nginx-mailcow logs, as
   the classic reset link does. **Proposed**: default to `/ng/reset-password#token={token}`; a
   fragment never reaches a server. The UI accepts both forms, and the `ng-mailcow` image logs the
   path without the query (R12).

## Owner-level questions (defaults applied)

1. **Webmail forwarding when the app address is the bare start page** (FR-100): a mailbox user who
   opens a bookmark of `/ng/` while signed out arrives at sign-in with `returnTo=/`. **Default**: the
   home address counts as the front door, so the app forwards to webmail; any other address counts
   as a deep link and is opened instead. Changing this is one condition in
   `src/app/session/landing.ts`.
2. **Releasing UI 005 without bulk TLS if API gap G1 is still open at implementation time**:
   **Default**: hold only the bulk TLS task (T107 in tasks.md, US7) and release the rest; the
   mailbox list then offers no TLS bulk action (no placeholder), as the conventions prescribe for
   missing entry points.

## Parity notes added by the plan

The spec's parity table is complete. The plan adds:

1. The TOTP QR code is drawn from the server's SVG without any image request; when the SVG cannot be
   shown safely, "Open in authenticator app" and the grouped key remain (R10).
2. The classic reset page sent users back to the sign-in page after a reset; the app also signs out
   this browser's session when the reset ended it, and other tabs follow (R12).
3. The profile with an embedded app password names the file after the server's product name, as the
   API sends it; the app adds the "delete after installation" advice (R21).

## Project Structure

### Documentation (this feature)

```text
specs/005-account-self-service/
├── spec.md              # Feature specification (clarifications, parity, API dependency)
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R25 (feature-specific)
├── data-model.md        # Phase 1: consumed API data, app models, query keys, routes, validation, state machines
├── quickstart.md        # Phase 1: setup, gates and validation guide
├── contracts/README.md  # Phase 1: pin, operations used, problem handling
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks; the /speckit-analyze summary is reported, not stored)
```

### Source Code (repository root)

UI 001's layout (`specs/001-sign-in-app-shell/plan.md`). Only files this feature adds or changes:

```text
src/
├── api/
│   ├── generated/schema.ts           # regenerated at the new pin
│   ├── problem.ts                    # + requiredFlags, requiredFlagsMatch, dependency, attemptsRemaining, methods
│   └── query/{client.ts,keys.ts}     # + meta.sessionReactions opt-out, permission-flag-required reaction; new key roots
├── app/
│   ├── navigation/catalogue.ts       # account → available; + filters entry
│   ├── navigation/classic-links.ts   # classic reset link removed (replaced by the in-app reset)
│   ├── router/{guards.ts,routes.ts}  # public routes in every state; account, filters, mailbox-context, reset routes
│   ├── session/{store.ts,landing.ts} # landingIntent; continueAfterSignIn() with the webmail forwarding hook
│   ├── shell/UserMenu.vue            # + "My account"
│   └── states/NoAccessState.vue      # + optional reason key
├── features/
│   ├── account/
│   │   ├── index.ts  routes.ts  mailbox-routes.ts  sections.ts
│   │   ├── validity.ts  recent-login-period.ts  totp.ts  qr-svg.ts  download.ts  webmail-forwarding.ts  list-state.ts
│   │   ├── api/{capabilities,password,second-factors,recovery-email,overview,webmail,client-setup,
│   │   │        app-passwords,temporary-aliases,mail-settings,push-notifications,recent-logins,groupware}.ts
│   │   ├── composables/{useAccountContext,useSectionAccess,useTotpEnrolment,useSecurityKeyEnrolment,
│   │   │                useWebmailHandOff,useProfileDownload}.ts
│   │   ├── components/
│   │   │   ├── layout/{AccountLayout,SectionNav,SectionCard,ReadOnlyNotice}.vue
│   │   │   ├── password/{OwnPasswordForm,ExternalPasswordNotice}.vue
│   │   │   ├── two-factor/{SecondFactorList,SecondFactorItem,AddSecondFactorMenu,TurnOffTwoFactorDialog,
│   │   │   │               TotpSetup,QrCode,SecurityKeySetup,YubicoOtpSetup}.vue
│   │   │   ├── recovery/RecoveryEmailForm.vue
│   │   │   ├── overview/{MailboxOverview,QuotaUsage,ProtocolAccessList,AddressLists,MailboxHomeCard,WebmailAction}.vue
│   │   │   ├── app-passwords/{AppPasswordList,AppPasswordCard,AppPasswordTable,AppPasswordFilters,
│   │   │   │                  AppPasswordForm,ProtocolCheckboxes}.vue
│   │   │   ├── temporary-aliases/{TemporaryAliasList,TemporaryAliasCard,TemporaryAliasTable,
│   │   │   │                      TemporaryAliasFilters,GenerateAliasPanel,ValiditySelect}.vue
│   │   │   ├── mail-settings/{TaggedMailSetting,TlsPolicySetting,BulkTlsDialog}.vue
│   │   │   ├── push/{PushNotificationsForm,WriteOnlySecretField}.vue
│   │   │   ├── recent-logins/{RecentLoginList,RecentLoginCard,RecentLoginTable,RecentLoginFilters}.vue
│   │   │   ├── groupware/GroupwareResets.vue
│   │   │   └── mail-apps/{ClientSetupGuide,ProtocolCard,AppleProfileDownloads}.vue
│   │   └── pages/{AccountHomePage,PasswordPage,RecoveryEmailPage,TwoFactorPage,AddSecondFactorPage,
│   │              AppPasswordsPage,AppPasswordCreatePage,AppPasswordDetailPage,RecentLoginsPage,
│   │              TemporaryAliasesPage,MailSettingsPage,PushNotificationsPage,OwnFiltersPage,DevicesPage,
│   │              MailAppsPage}.vue
│   ├── filters/
│   │   ├── index.ts  routes.ts  api.ts  list-state.ts
│   │   ├── components/{FilterList,FilterCard,FilterTable,FilterFilters,FilterForm,ScriptEditor,
│   │   │               ScriptBlock,ActivationWarning,ActiveScriptPanel,FilterMailboxField}.vue
│   │   └── pages/{FiltersPage,MailboxFiltersPage,FilterFormPage}.vue
│   ├── auth/
│   │   ├── reset-token.ts  routes.ts (+ reset routes)  api.ts (+ reset mutations)
│   │   ├── composables/usePasswordReset.ts
│   │   ├── components/{ForgotPasswordLink,ResetSignedInNotice}.vue
│   │   ├── components/pending/{ForcedPasswordChange,ForcedSecondFactorSetup}.vue
│   │   ├── components/{TotpForm,YubiOtpForm,WebAuthnFactor,OtherMethods}.vue   # + submit(proof) prop
│   │   ├── composables/useSecondFactor.ts   # submission-agnostic (sign-in step and reset page)
│   │   ├── components/PendingActionItem.vue  # linear flow, no classic link for the password action
│   │   └── pages/{PasswordResetRequestPage,PasswordResetPage}.vue; PendingActionsPage.vue, SignInPage.vue (changed)
│   ├── home/pages/HomePage.vue       # + MailboxHomeCard for mailbox users
│   ├── audit-log/{labels.ts,list-state.ts}   # self-service labels and target types
│   ├── api-keys/pages/ApiKeyCreatePage.vue   # uses the promoted OneTimeSecretDialog and useSecretMutation
│   ├── api-keys/components/ApiKeySecretDialog.vue   # removed (promoted to shared)
│   └── mailboxes/{detail-sections.ts,bulk-actions.ts}   # UI 003 extension points: registrations only
├── shared/
│   ├── components/{OneTimeSecretDialog,CopyButton,GroupedSecret}.vue
│   ├── components/password/{PasswordInput,NewPasswordFields,PasswordPolicyChecklist}.vue
│   ├── password/{policy.ts,generate.ts}
│   ├── validation/byte-length.ts
│   └── composables/useSecretMutation.ts
└── i18n/
    ├── index.ts                      # + cs-cz and sk-sk plural rules (if absent)
    ├── problems.ts                   # + parameters of the 005 problem types and rule codes
    ├── messages/{en-gb,cs-cz,sk-sk}.json
    └── legacy-map.json               # + object entries with "html": "plain"
scripts/
├── i18n/{lib.mjs,import-legacy.mjs,check.mjs}   # HTML-to-plain import; plural-form check
└── run-lhci.mjs                      # + /ng/account collection
tests/
├── support/totp.ts                   # promoted from tests/smoke/fixtures/totp.ts
├── mocks/
│   ├── contract/validator.ts         # non-JSON bodies, every required header
│   ├── handlers/self-service/{index,capabilities,own-account,second-factors,password-reset,overview,
│   │                          app-passwords,temporary-aliases,push-notifications,mail-settings,
│   │                          recent-logins,groupware,sieve-filters}.ts
│   ├── factories/{second-factor,app-password,temporary-alias,recent-login,sieve-filter,mailbox-overview,
│   │              client-configuration,push-settings,qr-svg,apple-profile}.ts
│   └── scenarios/{account,own-password,two-factor,password-reset,app-passwords,overview,
│                  temporary-aliases,mail-settings,recent-logins,mail-apps,filters,groupware,
│                  audit-self-service}.ts   # one module per story, registered in scenarios/index.ts
├── unit/features/{account,filters,auth}/…, unit/shared/…, unit/scripts/…
├── e2e/{account,pending-actions,password-reset,mailbox-self-service,filters,audit-log}/
└── smoke/{account,account-credentials,mailbox-self-service}.smoke.spec.ts
```

**Structure Decision**: UI 001's single static frontend, organised by feature (001-R3). My account
and the mailbox context share `src/features/account/`, because their sections are the same
components with a `context` (R3). Mail setup › Filters is its own catalogue entry and feature. The
reset pages extend `src/features/auth/`, next to the sign-in step whose components they reuse.
Changes to UI 001 and UI 003 files are limited to registrations and the small extensions listed
above.

## Dependencies on earlier features

UI features are implemented in order (001 → 004, then 005), after API feature 005. UI 005 assumes:

- **UI 001 complete** (all phases): the shell, catalogue, guard, session reactions, pending-actions
  screen, sign-in and second-factor pages, passkeys and `usePasskeyRegistration`, audit log, API key
  secret dialog, and the shared primitives of 001-R20.
- **UI 002**: `useBulkSelection`, `BulkResultSummary`, the per-item runner, `ConfirmDialog` typed
  confirmation and acknowledgement, `EditableSection` with changed-value marking, `HistoryLink` and
  the audit log's `targetType`/`targetId` filters (contract bump with API 002).
- **UI 003**: the mailbox detail screen with a section registry and child routes under
  `/mailboxes/:mailbox`, the mailbox list with bulk selection and a bulk action registry, the FR-040
  read-only summaries with link targets, the password generator and policy hints, the byte formatter,
  the unsaved-changes guard.
- **UI 004**: the mailbox picker (or UI 003's), used by the filter form.
- **API 005**: merged contract (pin) for the mock-based work; a running implementation in the dev
  stack for the smoke suite.

When a named piece is missing, the task that needs it creates it at the location given in research
R1 with the behaviour 001-R20 reserved for it, never as a feature-local copy. The UI 003 extension
points are expected under the names in research R5; the tasks adapt to the names UI 003's plan
chooses.

## Complexity Tracking

No new violation. UI 001's two recorded deviations still apply unchanged: default brand colours
until API 013, and the smoke suite as a non-blocking CI job until mailcow-rest-v2 runs its
implementation in the dev stack.
