# Implementation Plan: Administrators and Domain Administrators

**Branch**: `main` (no feature branches, constitution 1.1.0) | **Date**: 2026-10-18 |
**Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-administrators-domain-admins/spec.md`

## Summary

UI feature 007 adds the account administration of mailcow and the account switching that support
staff and resellers use every day. It delivers:

- **domain administrators**: list, search, filter, create (account, domains, sign-in requirements,
  permissions), inspect and edit in sections, rename, change status, suspend second factors,
  remove, and bulk actions;
- **permission flags**: the 19 flags as labelled switches with the legacy `acl.*` texts (the
  grouping awaits a decision, "Translations and forms");
- **administrators**: the same list and edit screens, with the last-administrator and own-account
  protections shown before submission;
- **acting as another account** (API "impersonation", legacy "login as"): "Sign in as" from the
  domain administrator and mailbox screens, a persistent acting banner on every screen, a one-tap
  return to the origin screen, and the discarding of the previous identity's data on every switch,
  also across tabs;
- **one-time sign-in links**: a landing that takes a domain administrator's single sign-on token
  from a link, removes it from the address bar and history and signs in, and a screen action that
  creates such a link;
- **webmail on a user's behalf**, when the operator allows it;
- **the audit trail**: History links on the detail screens, and the impersonation fields and filter
  of the audit log.

The technical approach reuses every decision of UI 001 and the shared building blocks of UI 002 to
006 under their canonical names (`docs/conventions.md`; details in [research.md](./research.md)):

- **No new runtime dependency.** The contract pin must contain API 007's final contract; the
  baseline is mailcow-rest-v2 commit `32079252d55797d3da4e58ae661e9fb91c51c6f9`. Pins only move
  forward (R1).
- **Feature layout**: `src/features/administrators/` holds both account lists, their forms and
  detail screens, reached from two catalogue rows, `domainAdmins` and `administrators`, under the
  `/administrators/` addresses that UI 014's route table already lists.
  `src/features/acting/` holds the entry actions ("Sign in as", "Open webmail as"), their
  eligibility rules and the switch requests. Cross-cutting parts live in the core:
  `src/app/session/identity-switch.ts` and `acting-origin.ts`, and `src/app/shell/ActingBanner.vue`
  and `ShellNotice.vue`. The one-time sign-in landing joins `src/features/auth/` (R2, R3).
- **One identity-switch protocol** serves every change of identity: starting and ending acting, an
  "impersonation ended" refusal, a one-time link that replaces a session, a self-rename, another
  tab's switch, and a refused anti-forgery check. It unmounts the current screen first, cancels and
  clears the query cache, renews the anti-forgery token, adopts the new identity, and only then
  routes and renders (R4).
- **UI 001's anti-forgery retry changes**: after `csrf-token-mismatch` the client re-reads
  `GET /me` and replays the write only when the identity is unchanged, as the contract now
  requires. Otherwise it discards the write and runs the identity switch (R5).
- **Secrets never enter TanStack caches**: requests that carry a password or a sign-in token, and
  the one-time link response, run through the canonical `useSecretRequest`, whose values live in
  component state only and whose problems still reach `dispatchProblemReactions()` (conventions
  "Secrets in requests or responses"; R10, R11, R14, R19).
- **Bulk actions** use the API's `/admins/bulk-actions` and `/domain-admins/bulk-actions` with each
  item's version tag, through UI 002's `useBulkSelection`, `BulkActionBar` and `BulkResultSummary`
  (R13).
- **Tests**: unit and component tests first; Playwright on 360 px and desktop with axe in both
  themes against the contract-validated mock, which models impersonation, token renewal and
  automatic ends; smoke tests against the API's dev stack (R20, R21).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict) and Vue 3.5 SFCs; Node.js 24 LTS (UI 001).

**Primary Dependencies**: the ten runtime dependencies of UI 001 R1, unchanged. No new runtime or
development dependency. Feature 007 builds on code of UI 001 to 006, listed under "Dependencies on
earlier features" below.

**Storage**: none on a server. In the browser: the query cache and two Pinia stores (UI 001 R10).
The session store gains memory-only fields (data-model §4). Nothing new goes to `localStorage`,
`sessionStorage` or IndexedDB: no token, link, password, username or origin path (constitution V).
Passwords, sign-in tokens and one-time links never enter the query or mutation cache.

**Testing**: Vitest and Vue Test Utils for units and components; Playwright `mobile-chromium`,
`desktop-chromium` and `mobile-webkit` against the production build with the production CSP and
the contract-validated mock; axe in both themes on every screen and dialog; the smoke project
against mailcow-rest-v2's dev stack (UI 001 R22–R25).

**Target Platform**: as UI 001: the two latest major versions of evergreen browsers, including iOS
Safari and Chrome for Android, served under `/ng/` on the mailcow host's origin.

**Project Type**: web application (static single-page frontend; the backend is mailcow-rest-v2).

**Performance Goals**: initial JavaScript stays under 200 KB gzipped: the new routes are lazy, and
only the acting banner, the shell notice and the identity-switch module join the entry chunk (about
3 KB). Lighthouse mobile scores stay at least 90. No polling: countdowns are local timers. SC-001: a
domain administrator with two domains created in under 2 minutes at 360 px. SC-009: a valid
one-time link reaches the home screen within 5 seconds. SC-010: a permission change saved in under
30 seconds.

**Constraints**:

- Only operations of the pinned contract, through the generated client (constitution I).
- A request prepared under one identity is never sent under another (contract "Authentication").
- Data of a previous identity is never visible after a switch (FR-052, SC-004).
- Tokens, links and passwords live in component memory only and are cleared on leave (FR-014,
  FR-063).
- Strict CSP; WCAG 2.2 AA; 360 px first (UI 001 constraints).
- Texts follow constitution IV 1.3.0: every language mailcow ships, legacy texts verbatim by their
  legacy keys, forms one to one with the classic interface, and new strings complete in en-gb,
  cs-cz and sk-sk ("Translations and forms" below).

**Scale/Scope**: 7 user stories (2 at P1, 3 at P2, 2 at P3); 7 new routes (one a redirect) plus the landing; 2
catalogue rows; 20 of the 21 operations of API 007 and 8 operations of earlier features; changes to
screens of UI 001, 003 and 005; about 70 legacy keys used verbatim (the legacy form map lists
them), and new strings only for what the classic interface lacks (the acting banner and notices,
the one-time link and its landing, the impersonation audit fields, filters and impact texts).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Gate | Status |
|---|---|---|
| I. The API contract is the only interface | Every operation is in the pinned contract (baseline `3207925`, R1); the [contracts README](./contracts/README.md) lists the 28 used. Types come from the generated client: `Admin`, `DomainAdmin`, `DomainAdminPermissions`, `AccountCapabilities`, `Impersonation`, `ImpersonationStarted`, `DomainAdminSsoToken`, `MailboxWebmailSignIn`, `BulkResult` and the enumeration arrays `domainAdminPermissionNameValues` and `accountSecondFactorStatusValues`. Messages are chosen by problem `type` and rule `code` (R17). Both gaps the spec named are closed by the contract, as are UI 001's problem-type gap and the bulk question; one new gap is recorded and not worked around ("API dependency and gaps"). | PASS |
| II. Mobile-first | Lists are cards below `md` and tables above (FR-006). Forms are full screens with collapsible sections; the domain picker is a full-screen list on phones (FR-013). The acting banner is designed for 360 px first, with middle ellipsis for long names (R7). Every list and detail has loading, empty or not-found, and error states (`ListState`, `NotFoundState`). Destructive and high-risk actions are confirmed with their impact, deactivation included (R13, R15). 44 × 44 px targets. | PASS |
| III. Accessibility | axe on every screen, dialog and state in both themes. The banner is a labelled region with icon and text, never colour alone; switches are announced; the page title carries the acting prefix (R7). Permission switches are grouped in fieldsets with descriptions (R16). Focus moves into dialogs and back. SC-006 keyboard-only paths are tested. | PASS |
| IV. i18n and branding | Constitution IV 1.3.0 ("Translations and forms" below): every mailcow language; the screens mirror the legacy forms of `tab-config-admins.twig`, `modals/admin.twig`, `edit/admin.twig` and `edit/domainadmin.twig`, with their labels, help texts, actions and messages taken verbatim by legacy key from the installation's `/lang/` files (`en-gb` fallback, never a hand-written value); `edit.force_pw_update_info` gets the product name from branding, as legacy fills it from `ui_texts.main_name`. New strings only for elements legacy lacks, in en-gb, cs-cz and sk-sk, never machine-translated (R17). `i18n:check` gains the enumerations `DomainAdminPermissionName` and `AccountSecondFactorStatus`, and 007's values of the shared enumerations join UI 002's coverage manifest `src/i18n/coverage.json`. Dates and times via `Intl`. Deviations from the legacy forms wait for a decision. | PASS |
| V. Security in the browser | The sign-in token is removed from the address bar and history before the bootstrap runs, held in memory and exchanged through `useSecretRequest` only for a visible, non-prerendered page (R10). Passwords and issued links live in component state only, never in the query or mutation cache, router state or storage (R11, R14). The CSRF retry never resends a write under another identity (R5). Webmail opens with `opener` cleared (R9). Hidden controls are conveniences; every refusal is handled (FR-002). | PASS |
| VI. Test-first | `tasks.md` puts every test before its implementation. Every acceptance scenario has an end-to-end test on both viewports, against a mock whose requests and responses are validated against the contract. Smoke tests run against the real API (R21). | PASS |
| VII. Performance budgets | Lazy routes; the entry chunk grows by about 3 KB, checked by `budget:check` (R2). Query defaults of UI 001 R9; no polling and no focus refetch; the identity switch clears the cache instead of refetching stale data; lists invalidate after mutations (R19). | PASS |
| VIII. Simplicity | No new dependency. The canonical shared blocks are reused: UI 002's `useBulkSelection`, `BulkActionBar`, `BulkResultSummary`, `ConfirmDialog`, `EditableSection`, `HistoryLink` and `useLeaveGuard`; UI 003's `NotFoundState`; UI 004's shared `DomainPicker`; UI 005's password fields, `useSecretRequest`, `meta.public` and `OneTimeSecretDialog` (R22). New code lives in the features unless it has two uses: `SignInAsAction` (mailboxes and domain administrators) is exported from `@/features/acting`; the identity switch (seven triggers) and the banner are core. | PASS |
| Technology constraints | Stack unchanged. Reka `Dialog`, `Switch`, `Checkbox`, `DropdownMenu` and `Collapsible` from the TailAdmin primitives; no banned viewport part. No SSR, no backend code. | PASS |
| Workflow and gates | Commits to `main`. CI gates unchanged; `i18n:check`, `contract:check` and the end-to-end suite cover the new screens. | PASS |
| `docs/conventions.md` | Wording ("the classic interface", "passkeys"). List state in the address, sizes 25/50/100, cards and tables. Bulk: explicit selection mode, current page only, bulk limit from the capabilities with selection disabled at the limit, API bulk operation with version tags, per-item summary, failed items stay selected, "outcome unknown" on a dropped connection (R13). Sections with their own save, changed fields only, `If-Match`, outdated handling with marked changes and no merge (R15). Confirmations: impact dialogs, one confirmation for deactivating, typed count for bulk removal (R13, R15). Secrets: never in TanStack caches; the one-time link in the one-time secret dialog (R11, R14). Polling: none. Contract pins only move forward (R1). History links (R18). Problem types and rule codes translated (R17). Entry points into UI 003 and UI 005 screens through their designated action areas (R8). Capabilities from `GET /capabilities/accounts` (R14). Canonical shared names (R22). | PASS |

**Post-design re-check (after Phase 1)**: PASS. The data model, the contracts README and the
quickstart introduce no violation. Decisions that touched gates:

- The anti-forgery retry now re-reads the identity before a replay (I, V; R5).
- The landing never stores or logs the token in the app and exchanges it only for a visible page
  (V; R10).
- The acting origin stays in memory, so a reload returns to the home screen instead of storing a
  path that can contain search terms (V; R6).
- FR-054 is met through the cross-tab channel, without a request on focus, because UI 001 FR-033
  forbids automatic requests that keep an idle session alive (VII; R4).
- The one-time link uses the shared one-time secret dialog, extended with a countdown, instead of
  a second secret display (VIII, conventions; R11).

## Translations and forms (constitution IV 1.3.0)

The owner rule of 2026-10-18 (`docs/conventions.md`, "Translations and forms") applies to every
screen of this feature and overrides any earlier text in this plan, the spec, research and tasks.

**Legacy forms mirrored** (paths under `../mailhosting/data/web/`; page entry `admin/system.php`,
`templates/admin.twig`, tab `admin.admins`):

- **Domain administrator list**: `templates/admin/tab-config-admins.twig`, card
  `admin.domain_admins` (toggle `mailbox.toggle_all`; action menu `mailbox.quick_actions` with
  `mailbox.activate`, `mailbox.deactivate`, `tfa.disable_tfa`, `mailbox.remove`; add button
  `admin.add_domain_admin`). Table: `js/site/admin.js` `draw_domain_admins` and
  `process_table_data` (`domainadminstable`): columns `admin.username`, `admin.admin_domains`, TFA
  (hard-coded in legacy; the app uses `tfa.tfa`), `admin.active`, `admin.action`; row actions
  `admin.edit`, `admin.remove` and the untranslated "Login" button (see "Deviations"). Messages:
  `inc/functions.domain_admin.inc.php` (`success.domain_admin_added`,
  `success.domain_admin_modified`, `success.domain_admin_removed`, `danger.username_invalid`,
  `danger.object_exists`, `danger.domain_invalid`, `danger.access_denied`).
- **Add domain administrator**: `templates/modals/admin.twig` `#addDomainAdminModal`: title
  `admin.add_domain_admin`; `admin.username`; `admin.admin_domains` with the placeholder
  `admin.search_domain_da`; `admin.password` with `admin.generate`; `admin.password_repeat`;
  `admin.active` (checked); submit `admin.add`. Password outcomes from `inc/functions.inc.php`
  `password_check()` (`danger.password_complexity`, `danger.password_mismatch`); policy hints from
  the shared password fields (`admin.password_policy_*`).
- **Domain administrator detail**: `templates/edit/domainadmin.twig` via `edit.php`: title
  `edit.domain_admin`; in this order `edit.username`, `edit.domains`, `edit.password` with
  `edit.generate`, `edit.password_repeat`, `edit.active`, `tfa.disable_tfa`, `tfa.force_tfa` with
  `tfa.force_tfa_info`, `edit.force_pw_update` with `edit.force_pw_update_info` (`%s` = product
  name); save `edit.save`. Permissions: the second form of the same template, the `acl.<flag>`
  labels in the `da_acl` column order and save `admin.save`; `success.acl_saved` and
  `danger.access_denied` from `inc/functions.acl.inc.php`. Legacy writes the form's heading as the
  untranslated text "ACL", so the section heading is a new string.
- **Administrator list**: `templates/admin/tab-config-admins.twig`, card `admin.admin_details` (the
  same toggle, action menu and `admin.add_admin`). Table: `js/site/admin.js` `draw_admins`
  (`adminstable`): `admin.username`, TFA (`tfa.tfa`), `admin.active`, `admin.action`; row actions
  `admin.edit`, `admin.remove`. Messages: `inc/functions.admin.inc.php` (`success.admin_added`,
  `success.admin_modified`, `success.admin_removed`, `danger.username_invalid`,
  `danger.object_exists`, `warning.no_active_admin`, `warning.cannot_delete_self`).
- **Add administrator**: `templates/modals/admin.twig` `#addAdminModal` (`admin.add_admin`,
  `admin.username`, `admin.password`, `admin.generate`, `admin.password_repeat`, `admin.active`,
  `admin.add`).
- **Administrator detail**: `templates/edit/admin.twig` (`edit.admin`, then the fields of the domain
  administrator detail without domains and permissions, and `edit.save`).
- **Removal confirmations**: the classic confirmation modal of `templates/modals/footer.twig`
  (`footer.confirm_delete`, `footer.delete_these_items`, `footer.delete_now`, `footer.cancel`).
  The impact lines (API keys, passkeys, sessions, domains stay) and the typed count are new strings
  (conventions: typed confirmations).
- **"Sign in as" and "Open webmail as"** in UI 003's mailbox screens: `js/site/mailbox.js` (the
  untranslated "Login" and "SOGo" buttons) and `js/site/admin.js` (the domain administrator "Login"
  button), `inc/triggers.global.inc.php` (dual login) and `sogo-auth.php`. "Open webmail as" uses
  `user.open_webmail_sso`, the label of the webmail button in `templates/user/tab-user-auth.twig`.
  After a switch: `success.logged_in_as`.

**Screens or elements without a legacy counterpart** get new strings in en-gb, cs-cz and sk-sk,
written for the owner's review and never machine-translated, and kept minimal: the acting banner,
its return control, the shell notices and "Sign out completely" (legacy shows only "username
(impersonator)" in the navbar, with no text); the one-time sign-in landing and the link section with
its countdown (legacy has no screen); the impersonation fields and filter of the audit log and the
audit labels; the "You" marker; the second-factor status "suspended until next sign-in"; the passkey
count (passkeys by owner decision); the deactivation and suspension confirmations and the impact
lines; the filter panel's own texts where no legacy key fits; bulk summaries; outdated-version
handling; and the problems legacy cannot produce (`already-impersonating`, `impersonation-ended`,
`not-allowed-while-impersonating`, `webmail-on-behalf-disabled`, `account-inactive`).

**Deviation-free rule**: these screens add, drop, rename, reword or reorder nothing relative to the
legacy forms above, except the conventions' improvements (sections with their own save, typed
confirmations, bulk mode, outdated-version handling). Labels, help and info texts (`*_info`),
placeholders, option labels, units, order and grouping, column headers, action labels and the
success, warning and danger messages come from the legacy keys. Every mailcow language is supported;
legacy values are loaded at runtime from the installation and shown verbatim (HTML through
`SanitizedHtml.vue`), and a key missing in the selected language falls back to `en-gb`, never to a
hand-written value. Fields the API adds (the sign-in requirements and permissions at creation, the
creation and modification dates) use the legacy key that labels the same field in another legacy
form (`edit.force_pw_update`, `tfa.force_tfa`, `acl.<flag>`, `mailbox.created_on`,
`mailbox.last_modified`). Disabled-control reasons reuse the legacy refusal texts of the same
meaning: `warning.cannot_delete_self` and `warning.no_active_admin`.

**Messages**: `account-exists` → `danger.object_exists` (the username) on the username field;
`reserved` and `invalidFormat` (`accountUsername`) on the username → `danger.username_invalid` (the
username); domain errors on `domains.<index>` → `danger.domain_invalid`; the password rules →
`danger.password_complexity` and the policy hints; `last-active-admin` →
`warning.no_active_admin`; `cannot-delete-own-account` → `warning.cannot_delete_self`; creation,
change and removal → the `success.*` keys above with the username (`success.admin_modified` has no
placeholder); a permission save → `success.acl_saved` (the username); a started or ended acting
session → `success.logged_in_as` (the new username). Bulk items use the same keys; only the summary
line is new.

**Legacy form map**: written into this section by task T006a before any screen is built (screen →
legacy template → field or element → legacy key, with the messages and placeholder sources).

**Deviations needing a decision** (not built until the owner or orchestrator decides):

1. **Password repeat field**: legacy's add modals and edit pages have `admin.password_repeat` /
   `edit.password_repeat` ("Confirmation password (repeat)") with `danger.password_mismatch`.
   FR-014 and R14 use one field with show and hide, and the spec's parity table drops the repeat
   field. It needs no API support (the comparison is local), and UI 005's `NewPasswordFields` has a
   `confirm` mode. **Proposed**: mirror legacy with `confirm`.
2. **Permission editor layout**: legacy lists the 19 `acl.*` flags flat, in the `da_acl` column
   order (`syncjobs`, `quarantine`, `login_as`, `sogo_access`, `app_passwds`, `bcc_maps`,
   `pushover`, `filters`, `ratelimit`, `spam_policy`, `extend_sender_acl`, `unlimited_quota`,
   `protocol_access`, `smtp_ip_access`, `alias_domains`, `mailbox_relayhost`, `domain_relayhost`,
   `domain_desc`, `alias_external_goto`), without explanations. FR-027 and FR-028 (R16) regroup
   them under four new group names and add 19 new explanation strings. **Until decided**: switches
   in legacy order with the `acl.*` labels and no explanations; the groups and explanations wait.
3. **"Sign in as" label**: the classic "Login" button is untranslated hard-coded English, so no
   human translation exists. Options: the legacy key `login.login` ("Login", the sign-in button's
   text, translated in every language) or the new string "Sign in as". **Until decided**: the new
   string, with the target username as its accessible description.
4. **Have I Been Pwned check** (`data-hibp`, `footer.hibp_check`, `footer.hibp_ok`,
   `footer.hibp_nok`) stays dropped: it calls a third-party service from the browser (constitution
   V and the no-third-party-requests rule). Confirm.
5. **Creation form extras**: legacy's add modals have no sign-in requirements and no permissions;
   FR-011 adds both (labelled with legacy keys, see above). Confirm as an API-added improvement.
6. **Field order on the detail screen**: legacy orders username, domains, password, active, then
   the two-factor and sign-in checkboxes. FR-018 and FR-020 put status and the password form in the
   Account section, above Domains. **Proposed**: accept the sections and keep legacy's order inside
   each section.

## Dependencies on earlier features

UI features are implemented in number order, so UI 001 to 006 exist when UI 007 starts. API 007 is
implemented before UI 007's smoke tests run; until then the smoke suite stays non-blocking (UI 001
Complexity Tracking).

| Feature | Used or extended by UI 007 | Why |
|---|---|---|
| UI 001 | Client, CSRF middleware, problem mapping, query client and keys; session store, cross-tab channel, session end, sign-out; router, guards, title, focus; catalogue and visibility; shell, layouts, user menu; `useListState`, `ListState`, `PaginationBar`, `useConfirm`, `useVersionedSave`, `useProblemForm`, `FormField`, `ErrorSummary`, `ProblemMessage`, `DateTime`, `useAnnouncer`, `useCountdown`, `useMediaQuery`, clipboard; auth feature (sign-in notices, `useThrottle`); passkeys page; audit log | Everything; R4–R8, R10, R18 |
| UI 002 | `useBulkSelection`, `BulkActionBar`, `BulkResultSummary`, `ConfirmDialog` with `requireTyped`, `EditableSection` with `changedSince()`, `useLeaveGuard`, `HistoryLink`, the audit log's `targetType`/`targetId` parameters, the `domain-detail` route, the coverage manifest `src/i18n/coverage.json` | Bulk actions, sections, leave guard, History links, domain links, translation scope (R13, R15, R17, R18) |
| UI 003 | `MailboxRowActions.vue` and the `MailboxDetailPage.vue` header (designated action areas); `NotFoundState`; `ActiveFilterChips` (promoted); the mailbox capabilities and password policy queries; the pre-hashed password detection | Entry points; states; `groupwareEnabled`; passwords (R8, R9, R14, R18) |
| UI 004 | The shared `DomainPicker.vue` (single or multiple) | Domain assignments (R14) |
| UI 005 | `NewPasswordFields`, `PasswordField`, `PasswordPolicyHints`, `src/shared/password/{generate,policy-rules}.ts` (promoted from UI 003); `useSecretRequest` and `dispatchProblemReactions()`; `meta.public` and its guard rule; `OneTimeSecretDialog`; the own password, second-factor and recovery e-mail screens and `WebmailAction.vue`; the self-service mock handlers | Passwords; one-time link; credential controls while acting (R8, R11, R14) |
| API 007 | 21 operations and the additive changes to 001's components | Contract at `a13c370`, within the baseline `3207925` |

The expected locations, and the rule when an earlier feature named a block differently, are in
research R22.

## API dependency and gaps

This feature depends on **mailcow-rest-v2 feature 007** (`specs/007-administrators-domain-admins/`)
with its contract as of commit `a13c370` ("Apply orchestrator decisions to feature 007"). The
baseline pin is the contract head `32079252d55797d3da4e58ae661e9fb91c51c6f9` ("Register
KnownProblemType in contract components"), the first commit that contains the final contracts of
API 001 to 007 together with the registered `KnownProblemType` (see
[contracts/README.md](./contracts/README.md)). It covers every capability of the spec's "API
Dependency" table. Findings:

1. **Closed: default permission flags** (spec API gap 2). `GET /capabilities/accounts` returns
   `domainAdminPermissionDefaults` and the other limits (API 007 FR-077). The creation form reads
   them (R14).
2. **Closed: webmail while acting** (spec API gap 1). The API refuses every webmail sign-in while
   impersonating, on behalf of a user and the impersonated mailbox's own hand-off, with
   `not-allowed-while-impersonating` (API 007 FR-049, FR-054). The spec's FR-057 and US6-AS4 are
   aligned below.
3. **Closed: problem-type constants** (UI 001 plan gap 5). `KnownProblemType` is registered under
   `components.schemas` at the baseline, so `knownProblemTypeValues` is generated.
4. **Closed by the contract: bulk actions.** API 007 FR-075 replaced "one request per account" with
   bulk operations of up to 100 accounts. The spec's FR-010 is aligned below.
5. **New gap G1: naming the link's account before the exchange.** FR-060 asks the landing to name
   both accounts when a browser that already holds a session opens a one-time link. The contract
   offers no way to learn a token's account without consuming it: `POST /session/sso-token` is the
   only operation that reads a token, and it replaces the session.
   - **Proposed to mailcow-rest-v2**: a non-consuming read, for example
     `POST /session/sso-token/inspection` with `{token}`, answering the username for a valid token
     and the generic `sign-in-failed` otherwise, counted towards the same throttle and audited like
     a failed sign-in when refused.
   - **Until then** the landing names the current account and refers to the other as "the domain
     administrator this link was created for" (R10). The spec's FR-060 and US5-AS3 state this. No
     workaround: the UI does not read a username from the link, because a link parameter is not
     trustworthy.
6. **Behaviour change taken from the contract: the anti-forgery retry.** The contract now says: on
   `csrf-token-mismatch`, fetch a new token, re-read `GET /me`, and retry once only when the
   identity is unchanged. UI 001 retries without the check because its pin predates API 007. This
   feature implements the new rule in `src/api/csrf.ts` (R5) and aligns UI 001's FR-035 and
   research R8 (T020).
7. **Contract inconsistency to report** (not blocking): `DomainAdminCreateRequest` describes an
   alias domain name as `notEligible` with `expected: primaryDomain`, while `ValidationRuleCode`
   lists `notEligible` with `kind: aliasDomain`. The UI keys the message on the code and the field
   path `domains.<index>` only, so either parameter works (R17).

## Spec alignment made by this plan

These edits bring the spec in line with the published contract (constitution I) and
`docs/conventions.md`. They change no user story's intent:

1. **Bulk actions** (clarification on multi-select actions, FR-009, FR-010): the app sends the API's
   bulk operation for the selection, with each account's version tag, instead of one request per
   account. Removing several accounts also asks for the number of accounts to be typed.
2. **Webmail while acting** (US6 narrative, Independent Test, US6-AS4, FR-057, parity row, API gap 1):
   the webmail control on the impersonated user's home is unavailable with the reason "Not
   available while acting as another user".
3. **Default permission flags** (FR-015, Assumptions, API gap 2): read from the account
   capabilities.
4. **Landing question** (FR-060, US5-AS3, API gaps): the current account is named; the link's
   account is named once the API can report it (gap G1).
5. **API Dependency**: the contract is published; the baseline commit is recorded.
6. **Deactivation** (status clarification, FR-026): deactivating another account, alone or in a
   multi-select, needs one explicit confirmation stating the effect (conventions "Confirmations").
7. **Password policy** (FR-014, US1-AS4): the rules are marked while typing and never block
   submission, as UI 003 and UI 005 decided; the API's refusal names each unmet rule.
8. **Smaller alignments**: FR-006 (tables from 768 px, conventions "Lists"), FR-012 (the length the
   API reports), FR-035 (the own account also left out of a bulk deactivate), US4-AS4 (the only
   active administrator is the signed-in one) and FR-054 (no request on focus, UI 001 FR-033). The
   earlier removal of `admin.generate` from the legacy key list is reversed by constitution IV
   1.3.0: the forms label "Generate" with `admin.generate` and `edit.generate`, as legacy does.

## Owner-level questions (defaults applied)

1. **Naming the link's account on the landing** (gap G1): should mailcow-rest-v2 add a
   non-consuming token read? **Default**: the landing names only the current account until the API
   offers it; the gap is proposed to mailcow-rest-v2 (T113).
2. **Identity check when a tab regains focus**: FR-054 originally asked for one; a request on focus
   would keep an idle session alive, which UI 001 FR-033 forbids. **Default**: no request on focus;
   the cross-tab message, which background tabs process when they resume, and the next write or
   refused request carry the change (R4).
3. **Documented landing address for billing panels**: **Default**:
   `https://<host>/ng/sign-in/sso-token?sso_token=<token>`, keeping legacy's parameter name so that
   panels change only the path. Classic `/domainadmin?sso_token=` links reach the landing through
   UI 014's arrival page and the in-memory hand-off `handOverSsoToken()` (R10).

## Parity notes added by the plan

The spec's parity table is complete after the alignment above. The plan adds:

1. Bulk results arrive in one response, so the progress indicator of a bulk action is a busy state,
   not a per-account counter (R13).
2. After a reload while acting, "Return" opens the own home screen, because the origin screen is
   kept in memory only (R6). Legacy always returns to the mailbox page.

## Project Structure

### Documentation (this feature)

```text
specs/007-administrators-domain-admins/
├── spec.md              # Feature specification (aligned with the contract by this plan)
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R22
├── data-model.md        # Phase 1: consumed API data, client state, query keys, routes, state machines
├── quickstart.md        # Phase 1: validation guide and the operator's landing address
├── contracts/README.md  # Phase 1: pinned contract and the operations used
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

Only the files that UI 007 adds or changes are listed; the layout is UI 001's.

```text
contract/{openapi.yaml,openapi.json,VERSION.json}      # moved forward to the baseline when older
src/api/generated/schema.ts                            # regenerated
src/api/
├── index.ts                     # changed: re-exports Admin, DomainAdmin, … and the new enum arrays
├── problem.ts                   # changed: kind 'identityChanged'
├── csrf.ts                      # changed: identity check before a replay (R5)
└── query/{client.ts,keys.ts}    # changed: impersonation-ended reaction; new key roots (R19)
src/main.ts                      # changed: captures the sign-in token before the bootstrap (R10)
src/styles/main.css              # changed: acting colour tokens, sticky height variable
src/shared/icons/{UserSwitchIcon,ShieldOffIcon,LinkIcon}.vue   # new (THIRD_PARTY_NOTICES.md)
src/shared/components/OneTimeSecretDialog.vue          # changed (UI 005): optional expiry countdown
src/shared/components/DomainPicker.vue                 # changed (UI 004), only if it lacks the phone list and chips
src/app/
├── session/
│   ├── identity-switch.ts       # new: the switch protocol (R4)
│   ├── identity-key.ts          # new: username|role|impersonation id
│   ├── acting-origin.ts         # new: origin of the acting session, memory only (R6)
│   ├── store.ts                 # changed: identityTransition, actingOrigin, shellNotice, notices
│   └── cross-tab.ts             # changed: session-changed re-reads the identity, switches on change
├── shell/
│   ├── ActingBanner.vue         # new (R7)
│   ├── ShellNotice.vue          # new: dismissible, announced shell message
│   └── UserMenu.vue             # changed: "Sign out completely" while acting
├── layouts/{ShellLayout.vue,AuthLayout.vue}   # changed: banner, transition gate, notice
├── router/{routes.ts,title.ts}                # changed: routes, title prefix (the landing uses UI 005's meta.public)
└── navigation/catalogue.ts      # changed: rows domainAdmins and administrators, available
src/features/
├── administrators/              # new
│   ├── index.ts  routes.ts  api.ts  list-state.ts  username.ts  permissions.ts  bulk.ts
│   ├── confirmations.ts  sso-link.ts
│   ├── pages/{DomainAdminsPage,DomainAdminCreatePage,DomainAdminDetailPage,
│   │          AdminsPage,AdminCreatePage,AdminDetailPage}.vue
│   └── components/{AccountStatusBadge,SecondFactorStatusBadge,DomainAdminCard,DomainAdminTable,
│                   DomainAdminFilters,AdminCard,AdminTable,AdminFilters,AccountActionsMenu,
│                   UsernameField,AccountPasswordField,SignInRequirementsFields,AccountSection,
│                   PasswordChangeForm,SignInSecuritySection,DomainAssignmentList,DomainsSection,
│                   PermissionsEditor,PermissionsSection,SsoLinkSection,DetailSectionIndex}.vue
├── acting/                      # new
│   ├── index.ts  api.ts  eligibility.ts  webmail-opener.ts
│   ├── composables/useActingState.ts
│   └── components/{SignInAsAction,OpenWebmailAsAction,ActingUnavailableNotice}.vue
├── auth/                        # changed (UI 001)
│   ├── sso-token-capture.ts  composables/useSsoTokenSignIn.ts
│   ├── pages/SsoTokenLandingPage.vue  components/SignInNotice.vue  api.ts  routes.ts  index.ts
├── audit-log/                   # changed (UI 001/002): impersonated filter, labels, item marker
├── passkeys/                    # changed (UI 001): unavailable while acting
├── mailboxes/                   # changed (UI 003): MailboxRowActions.vue, MailboxDetailPage.vue
└── account/                     # changed (UI 005): credential controls and WebmailAction while acting
src/i18n/messages/{en-gb,cs-cz,sk-sk}.json      # new strings only; legacy keys via UI 001's runtime layer
src/i18n/coverage.json                          # changed (UI 002): 007's shared enumeration values
scripts/i18n/check.mjs                          # changed: two more feature enumerations
specs/001-sign-in-app-shell/{spec.md,research.md}   # aligned: FR-035, R8, R12 (T020)
tests/
├── mocks/handlers/{admins,domain-admins,impersonation,sso-tokens}.ts       # new
├── mocks/handlers/{identity,auth,passkeys,audit,index}.ts                  # changed
├── mocks/handlers/self-service/own-account.ts                              # changed (UI 005)
├── mocks/scenarios/{administrators,acting,sso-sign-in}.ts                  # new
├── mocks/factories/{admin,domain-admin,impersonation}.ts                   # new
├── e2e/fixtures/{tabs,popup}.ts                                            # new
├── e2e/fixtures/test.ts                                                    # changed: sentinel detail check
├── e2e/{administrators,acting,sso-sign-in,webmail-on-behalf}/              # new
├── e2e/audit-log/impersonation.spec.ts                                     # new
├── unit/…                                                                  # mirrors src/
└── smoke/{administrators,admins,acting,sso-sign-in}.smoke.spec.ts          # new
```

**Structure Decision**: The single frontend project of UI 001. Both account lists share one
feature directory, because they form one area of the navigation and share most components. Acting
is split into the core switch (`src/app/session`, `src/app/shell`), which every screen depends on,
and a feature (`src/features/acting`) that other features import through its `index.ts` for their
entry points. The landing belongs to the auth feature, next to the other sign-in routes.

## Complexity Tracking

No constitution principle is violated, so this table is empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| — | — | — |
