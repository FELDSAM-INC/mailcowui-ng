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
  002–004 build, under their canonical names (`useBulkSelection`, `BulkActionBar`,
  `BulkResultSummary`, `ConfirmDialog`, `EditableSection`, `HistoryLink`, `useLeaveGuard`, UI 003's
  mailbox detail and list action areas). UI 005 creates `usePerItemRunner`, `MailboxSearchPicker`,
  `useSecretRequest` and `src/shared/platform/download.ts`, which no earlier feature needs. Three areas are touched: `src/features/account/` (new; own and
  mailbox context share one implementation), `src/features/filters/` (new) and `src/features/auth/`
  (reset pages, forced actions) (R1, R3).
- **Contract**: bump to mailcow-rest-v2 commit `32079252…` or later (376 operations, all 51
  self-service operations, `KnownProblemType` registered) (R2).
- **Visibility**: a pure section registry decides, per role, flag and self-service capability,
  whether a section is shown, replaced, read-only or "no access" (R4, R5, R6).
- **Secrets**: every request that carries or returns a secret (passwords, codes, TOTP data, reset
  tokens, app passwords, Pushover credentials, the Apple profile) calls the client directly through
  `useSecretRequest` and never touches TanStack Query; generated secrets are shown once in
  `OneTimeSecretDialog` (promoted from UI 001); the reset token leaves the address bar before the page
  renders (R10, R12, R13, R21).
- **Strict CSP kept**: the API's QR code (an SVG data URI) is parsed into an allowlisted SVG subset
  and rendered by Vue, instead of relaxing `img-src` (R10).
- **Webmail**: the new tab is opened synchronously in the click handler so popup blockers allow it;
  a single `continueAfterSignIn()` applies the forwarding rule after every sign-in path (R20).
- **i18n**: constitution IV 1.3.0: the screens mirror the legacy forms and use mailcow's own
  translations verbatim by legacy key, including those with HTML (rendered through
  `SanitizedHtml.vue`); new strings only where legacy has none, with Czech and Slovak plural rules
  (R23, "Translations and forms" below).
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
≤ 200 KB gzipped; Lighthouse performance ≥ 80 and accessibility ≥ 90 for `/ng/account`.

**Constraints**: no automatic polling (no `refetchInterval` anywhere in this feature); strict CSP
unchanged (no `data:` images, no inline style or script); no secret in
storage, address, history, caches or logs (SC-008); WCAG 2.2 AA in both themes; 360 px first; only
contract operations; no hard-coded capabilities or limits (FR-009); the legacy forms mirrored with
their keys, verbatim (SC-007, constitution IV 1.3.0).

**Scale/Scope**:

- 12 user stories (4 at P1, 5 at P2, 3 at P3), 68 acceptance scenarios, 124 functional requirements.
- 31 new routes: 15 in My account, 11 in the mailbox context, 3 for Mail setup › Filters, 2 for the
  password reset.
- 49 of the 51 self-service operations, plus 7 operations of features 001–003.
- Every language mailcow ships (33); legacy keys from the legacy form map, and new strings in
  en-gb, cs-cz and sk-sk only for elements the classic interface lacks.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Gate | Status |
|---|---|---|
| I. The API contract is the only interface | Only operations of the pinned contract, through the generated client (contracts/README.md lists 49 + 7). The pin moves to a commit containing API 005 (R2), recorded in `contract/VERSION.json`. No hand-written API type: section rules, presets and view models are app-defined (data-model §2). Where the contract falls short (bulk TLS version tag, filter by ID), gaps AG1 and AG2 are reported, and the UI does not work around them. Errors are handled from `type`, `errors` and the documented extension members (R6). | PASS |
| II. Mobile-first | Every screen is designed at 360 px: sections as their own pages, lists as cards below `md`, long forms split (Pushover "Advanced", filter editor page, TOTP steps), the TOTP open/copy actions before the QR code. Selection modes for multi-item actions. Destructive actions confirmed with their impact; bulk deletions typed; the SOGo reset needs an acknowledgement. Every list has loading, empty and error states. Tested on `mobile-chromium` and `mobile-webkit`. | PASS |
| III. Accessibility (WCAG 2.2 AA) | axe on every screen and state in both themes; the QR code has a text alternative pointing to the grouped key; statuses in text; announced copy results, saves and WebAuthn waits; no time limit without "Try again"; confirmation dialogs trap and return focus (FR-112 to FR-116). | PASS |
| IV. i18n and branding | Constitution 1.3.0: every mailcow language; the screens mirror the legacy forms of "Translations and forms" below, with mailcow's translations loaded at runtime and used verbatim by legacy key, HTML-bearing values through `SanitizedHtml.vue`, missing keys falling back to `en-gb` (R23); new strings only where legacy has none, in en-gb, cs-cz and sk-sk, never machine-translated, with Czech and Slovak plural rules; locale formatting of sizes, dates, countries. No brand text in the app's own strings: the Yubico API key URL is a vendor address, not operator branding. | PASS |
| V. Security in the browser | Same-origin session and in-memory CSRF token (001). No new storage key; secret-bearing requests outside every cache (`useSecretRequest`), secrets never in the address bar, history or logs; the reset token scrubbed in `beforeEnter`; the profile blob released after hand-over. CSP unchanged: the QR code is rendered from an allowlisted SVG subset, not `data:` or `v-html`. Hiding is a convenience: refusals (`forbidden`, `permission-flag-required`, `404`) are handled and the identity re-read (FR-007). | PASS |
| VI. Test-first | Every phase of tasks.md writes failing tests first: units and components, end-to-end tests of all 68 acceptance scenarios on both viewports against the contract-validated mock, and smoke tests against the API dev stack. Mocked requests and responses, including the binary profile and the `Set-Cookie` of the hand-off, are validated against the contract (R24). | PASS (smoke gate as UI 001's Complexity Tracking) |
| VII. Performance budgets | All routes lazy; the account and filters indexes export only light modules; `budget:check` and a Lighthouse collection for `/ng/account`; queries follow 001-R9 with 5-minute freshness for capabilities and the overview and invalidation after every mutation (data-model §3). | PASS |
| VIII. Simplicity | No new dependency. One section implementation for both contexts. Shared blocks only at a second use (`OneTimeSecretDialog`, `CopyButton`, `GroupedSecret`, UI 003's password field, hints, generator and policy rules, `useSecretRequest`, `usePerItemRunner`), or where `docs/conventions.md` fixes a canonical shared location for later features (`MailboxSearchPicker`, `src/shared/platform/download.ts`); single-use helpers (`qr-svg.ts`, `useWebmailHandOff`) stay in the feature. | PASS |
| Technology constraints | Stack unchanged; no TailAdmin Pro; the needed TailAdmin primitives are already copied (radio group, switch, checkbox, collapsible, textarea, table, dialog); no CDN; no backend code. | PASS |
| Workflow and gates | Lint, types, units, end-to-end on both viewports with axe, budgets, translations and the audit run in CI as for UI 001. Commits to `main`. | PASS |
| `docs/conventions.md` | "The classic interface" wording; passkeys wording. Lists: state in the address, 25/50/100, cards and tables, states. Bulk: explicit selection of the current page, the API bulk operation for TLS (with item versions, AG1), one request per item otherwise, per-item results, failed items stay selected, "outcome unknown" never retried. Editing: per-section saves, only changed fields with the version, outdated handling with kept input and marked values, refused deletions confirmed again. Confirmations: impact named, typed count for bulk deletions. Secrets: shown once with copy, confirm on uncopied close, write-only Pushover credentials. History: labels and History actions. Errors translated, flags hidden or read-only. Entry points into UI 001 and UI 003 through their designated areas; capabilities from `getSelfServiceCapabilities`. | PASS |

**Post-design re-check (after Phase 1)**: PASS. Decisions that touched gates:

- QR code rendered from a parsed SVG allowlist instead of `img-src data:` (V, R10).
- Secret-bearing requests made outside TanStack Query with `useSecretRequest`, with the session reactions routed through one dispatcher (V, R6, R13).
- Reset routes public in every session state, an exception to UI 001's restricted-session gate that
  FR-042 requires (R12).
- Bulk TLS blocked on API gap AG1 instead of omitting the version tag (I, conventions, R16).
- Profiles downloaded through a revoked object URL, never cached (V, R21).

## Translations and forms (constitution IV 1.3.0)

The owner rule of 2026-10-18 (`docs/conventions.md`, "Translations and forms") applies to every
screen of this feature and overrides any earlier text in this plan, the spec, research and tasks.

**Legacy forms mirrored** (paths under `../mailhosting/data/web/`):

- **My account hub and its sections** (mailbox users): `templates/user.twig` (tab names
  `user.mailbox_general`, `user.mailbox_details`, `user.mailbox_settings`, `user.spam_aliases`,
  `user.app_passwds`, Pushover) with `user/tab-user-auth.twig`, `user/tab-user-details.twig` and
  `user/tab-user-settings.twig`; the domain administrator's `templates/domainadmin.twig` ("User
  settings" card); `js/site/user.js`.
- **Own password and forced password change**: `templates/modals/user.twig` `#pwChangeModal`
  (`user.password_now`, `user.new_password`, `user.new_password_repeat`, `user.generate`,
  `user.change_password_hint_app_passwords`) and
  `templates/modals/footer.twig` `#ChangePWModal` (`user.pw_update_required`); for administrators
  `templates/edit/admin.twig`; messages from `edit_user_account()` and `password_check()` /
  `password_complexity()` in `inc/functions.inc.php`.
- **Recovery e-mail**: `templates/modals/user.twig` `#pwRecoveryEmailModal`
  (`user.pw_recovery_email`, `user.email`, `user.password_reset_info`).
- **Second factors and forced setup**: `user/tab-user-auth.twig` and `templates/tfa_keys.twig`
  (`tfa.tfa`, `tfa.set_tfa`, `tfa.select` and the method options), `templates/modals/footer.twig`
  `#YubiOTPModal`, `#WebAuthnModal`, `#TOTPModal`, `#DisableTFAModal`, `#ConfirmTFAModal` and
  `#SetupTFAModal` (`tfa.setup_title`, `tfa.setup_required`); administrators through
  `admin/tab-config-admins.twig`; messages from `set_tfa()`, `unset_tfa_key()` and
  `verify_tfa_login()` in `inc/functions.inc.php`.
- **Password reset** (request and new password): `templates/reset-password.twig`, the link
  `login.forgot_password` in `templates/user_index.twig`; messages from `reset_password()` in
  `inc/functions.inc.php`.
- **Mailbox overview, webmail and mail app setup**: `user/tab-user-auth.twig` (overview, protocols,
  `user.direct_protocol_access`, `user.open_webmail_sso`, the Apple connection profiles and
  `user.client_configuration`) and `user/tab-user-details.twig` (aliases and send-as).
- **Recent logins**: `user/tab-user-auth.twig` (`user.recent_successful_connections`,
  `user.login_history`, `user.clear_recent_successful_connections`, the day/week/month choices);
  `last_login()` in `inc/functions.inc.php`.
- **App passwords**: `user/AppPasswds.twig`, `templates/modals/user.twig` `#addAppPasswdModal`,
  `templates/edit/app-passwd.twig`; `draw_app_passwd_table()` in `js/site/user.js` (columns
  `user.app_name`, `user.allowed_protocols`, `user.active`, `user.action`);
  `inc/functions.app_passwd.inc.php`.
- **Temporary aliases**: `user/SpamAliases.twig`, `templates/modals/user.twig` `#tempAliasModal`;
  `draw_tla_table()` in `js/site/user.js` (columns `user.alias`, `user.description`,
  `user.alias_valid_until`, `user.created_on`, `user.action`); `time_limited_aliases` in
  `inc/functions.mailbox.inc.php`.
- **Mail settings (tagged mail, TLS) and bulk TLS**: `user/tab-user-settings.twig`, the
  administrator's `templates/edit/mailbox.twig` (tagging and TLS buttons), and the TLS entries of
  the mailbox list's bulk menu in `templates/mailbox/tab-mailboxes.twig` (`mailbox.tls_enforce_in`,
  `mailbox.tls_enforce_out`, `mailbox.activate`, `mailbox.deactivate`); `delimiter_action` and
  `tls_policy` in `inc/functions.mailbox.inc.php`. The quarantine notification settings of the
  same tab belong to UI 006.
- **Push notifications**: `user/Pushover.twig` and the `#mpushover` tab of
  `templates/edit/mailbox.twig` (tab label `edit.pushover`); `inc/functions.pushover.inc.php`.
- **Groupware resets**: `user/tab-user-settings.twig` (`user.eas_reset`, `user.eas_reset_help`,
  `user.eas_reset_now`, `user.sogo_profile_reset`, `user.sogo_profile_reset_help`,
  `user.sogo_profile_reset_now`); `eas_cache` and `sogo_profile` in
  `inc/functions.mailbox.inc.php`.
- **Filters** (Mail setup › Filters, the mailbox context and the user's read-only view):
  `templates/mailbox/tab-filters.twig`, the add-filter modal in `templates/modals/mailbox.twig`,
  `templates/edit/filter.twig`, the user's `#userFilterModal` in `templates/modals/user.twig`
  (`user.active_sieve`, `user.show_sieve_filters`); `draw_filter_table()` in `js/site/mailbox.js`;
  `filter` in `inc/functions.mailbox.inc.php`; `inc/ajax/sieve_validation.php`.

**Screens or elements without a legacy counterpart** get new strings in en-gb, cs-cz and sk-sk
(never machine-translated), kept minimal: the passkey link and passkey texts (owner decision), the
one-time secret dialog of app passwords, the per-item result summaries, outdated-version handling,
"Sign out my other sessions" and the post-change summary of ended sessions and the mail server's
cache time, the reset link validity, the read-only and "no access" reasons, the dependency outage
labels, and the History labels for the audit log. Counts in new strings use the Czech and Slovak
plural rules (R23); legacy strings with `%d` stay as they are.

**Deviation-free rule**: these screens add, drop, rename, reword or reorder nothing relative to the
legacy forms above, except the conventions' improvements (sections with their own save, typed
confirmations, bulk mode, outdated-version handling). Labels, help and info texts (`*_info`),
placeholders, option labels, units, order and grouping, column headers, action labels and
success, warning and danger messages come from the legacy keys. Every mailcow language is
supported; legacy values are loaded at runtime from the installation and shown verbatim, values
with HTML (`tfa.api_register`, `user.direct_protocol_access`, `user.tls_policy_warning`,
`user.pushover_info`, `edit.pushover_vars`, `mailbox.sieve_info` and others) through
`SanitizedHtml.vue`, and a missing key falls back to `en-gb`, never to a hand-written value.

**Legacy form map**: written by task T010a, below.

### Legacy form map (T010a, 2026-10-19)

Paths are under `../mailhosting/data/web/` (FeldHost fork, branch `feldhost-202609a`, upstream tag
`2026-09a`). Every legacy key below was checked against the bundled snapshot
`src/i18n/snapshot/lang.en-gb.json` (a script resolved each `section.key` to a string). Keys the
templates reference but the snapshot lacks are marked **missing**; they render empty in legacy and
are not used.

Legend:

- **HTML**: the value carries markup; render it with `<LegacyText>` (sanitised by `SanitizedHtml.vue`),
  never as text and never altered.
- **hard-coded**: legacy writes the text into a template or `js/site/*.js` without a key. It becomes
  a new string whose English text equals legacy's (conventions, "Text the classic interface
  hard-codes").
- **composed as legacy**: legacy itself builds the text from a key and literal text (for example
  `{{ lang.user.expire_in }} 1 {{ lang.user.hour }}`). The app reproduces exactly that composition
  (same key, same literal, same order) and never makes a different sentence from it. Deviation D21
  asks the orchestrator to confirm this reading.
- `%s` / `%d`: filled in order, with the source named in the notes.
- New strings: key, English text and reason. Keys follow the plan's namespaces (`account.*`,
  `filters.*`, `auth.passwordReset.*`, `auth.pendingActions.passwordChange.*`,
  `auth.pendingActions.secondFactor.*`, `selfService.dependency.*`), except that audit labels use the
  existing `enums.auditEventType.*` / `enums.auditTargetType.*` / `enums.auditFailureReason.*`
  namespaces of UI 001 to 004, which other features follow.
- Existing app strings reused (UI 001 to 004): `history.link`, `bulk.*`, `sections.*`, `states.*`,
  `lists.*`, `secrets.*`, `problem.*`, `validation.*`, `auth.secondFactor.*`,
  `auth.signIn.showPassword`, `mailboxes.protocol.*`, `hibp.error`, `common.retry`.

#### Part 1: fields and elements

##### 1. My account hub (`/account`), section names and navigation

Legacy: navigation in `templates/base.twig` (mailbox users → `/user`, domain administrators →
`/domainadmin/user`); `templates/user.twig` tabs; `templates/domainadmin.twig` card;
administrators have no own page (own two-factor card in `admin/tab-config-admins.twig`, own
password through `edit/admin.twig`).

Legacy tab structure (mailbox user), in order: dropdown `user.mailbox` › `user.mailbox_general`
(`user/tab-user-auth.twig`), `user.mailbox_details` (`user/tab-user-details.twig`),
`user.mailbox_settings` (`user/tab-user-settings.twig`); then `user.spam_aliases` (flag
`spam_alias`), `user.spamfilter` (UI 006), `user.sync_jobs` (UI 008), `user.app_passwds` (flag
`app_passwds`), "Pushover API" (hard-coded, flag `pushover`). Each tab is a card whose header repeats
the tab name.

| Element | Legacy key | Notes |
|---|---|---|
| Navigation entry, user menu entry, hub page title | `header.user_settings` | UI 001's catalogue already maps `account` to it ("User Settings") |
| Hub title on the domain administrator's page | `user.user_settings` | Legacy card header ("User settings") on `domainadmin.twig`; same meaning as the nav entry. One of the two is enough on the page |
| Group "Overview" (only if D1 keeps groups) | `user.overview` | Legend on the General tab |
| Group "Sign-in and security" (only if D1 keeps groups) | `user.authentication` | Legend that groups password, recovery e-mail and 2FA on the General tab ("Authentication") |
| Group "Mail" (only if D1 keeps groups) | `user.mailbox_settings` | The Settings tab ("Settings") |
| Group "Devices" (only if D1 keeps groups) | new `account.groups.devices` "Devices" | No legacy grouping; the resets live in the Settings tab (D1) |
| Section title: overview | `user.overview` | |
| Section title: password | `user.change_password` | pwChangeModal title and button |
| Section title: recovery e-mail | `user.pw_recovery_email` | Modal title and button |
| Section title: two-factor | `tfa.tfa` | Row label on the General tab, admin card header |
| Section title: passkeys | UI 001 `passkeys.title` | Passkey texts are new strings (owner decision); replaces the legacy FIDO2 block (`fido2.*`), moved to UI 001 |
| Section title: app passwords | `user.app_passwds` | Tab |
| Section title: recent logins | `user.recent_successful_connections` | Legend of the recent-logins column ("Seen successful connections") |
| Section title: temporary aliases | `user.spam_aliases` | Tab ("Spam email aliases" in en-gb). FR-008's "Temporary aliases" wording is superseded by the 1:1 rule; `acl.spam_alias` ("Temporary aliases") is the permission flag's label only |
| Section title: mail settings | `user.mailbox_settings` | Settings tab ("Settings"); see D1 |
| Section title: push notifications | `edit.pushover` | Plan deviation 4 (D4); the user page hard-codes "Pushover API" |
| Section title: filters (own, read-only) | `mailbox.filters` with the sub-heading `user.active_sieve` | Legacy shows the user only the active script (`user.show_sieve_filters` link, modal `user.active_sieve`); the list of admin filters is new (D16) |
| Section title: devices | new `account.sections.devices.title` "Devices" | No legacy counterpart (resets are rows of the Settings tab, D1) |
| Section title: mail app setup | new `account.sections.mailApps.title` "Mail app setup" | No legacy screen: legacy has profile links and the external-guide link `user.client_configuration` on the General tab |
| Section one-line summaries on the hub cards | new `account.sections.<id>.summary` | Legacy has none: added text (D1) |
| Mailbox context section heading | the section's legacy key, with the mailbox address as a separate subtitle | As UI 003's detail title; never a joined sentence |
| History action (administrators) | UI 002 `history.link` | |
| Section the user may not open | UI 001 `states.noAccess.title`, `states.noAccess.body` | Mail app setup for administrators and domain administrators: reason `login.mobileconfig_info` |
| Read-only reason (mailbox context, domain administrator without the flag) | `acl.prohibited` + the flag's `acl.*` label | As UI 003 renders `data-acl="0"` controls |
| Externally managed password (password section replaced) | new `account.password.external` "Your organisation manages the password and second factors of this account." | Legacy simply hides the Authentication block for `authsource` other than `mailcow` (and 2FA for sources other than `mailcow`/`ldap`); no text (D15) |
| Capabilities cannot be read | UI 001 `states.detail.error`, `common.retry` | |

##### 2. Own password (`/account/password`) and forced change (pending-actions screen)

Legacy: `templates/modals/user.twig` `#pwChangeModal` (mailbox users and domain administrators;
`edit/self` → `edit_user_account()` or `domain_admin('edit')`); administrators use
`templates/edit/admin.twig` (`edit.admin`). Field order of `#pwChangeModal`: new password, its
confirmation, a separator, the current password with the app-password hint, the button.

| Element | Legacy key | Notes |
|---|---|---|
| Page title and submit button | `user.change_password` | Same key for both, as the modal |
| New password label, with the generate link | `user.new_password`, link `user.generate` | Composed as legacy: label + " (" + link + ")" (UI 003 renders `edit.password (edit.generate)` the same way). "generate" fills both fields and shows them, as legacy |
| haveibeenpwned check under the new password | `footer.hibp_check`; result `footer.loading`, `footer.hibp_ok`, `footer.hibp_nok`; error UI 001 `hibp.error` | `user_new_pass` has `data-hibp`, so the conventions keep the check (shared `HibpCheck`); the spec's parity row "Dropped" is superseded (D7) |
| Password policy list under the check | `admin.password_policy_length` (`%d` = policy minimum length), `admin.password_policy_chars`, `admin.password_policy_special_chars`, `admin.password_policy_lowerupper`, `admin.password_policy_numbers` | Only the rules that are set, in this order (legacy's Redis hash order, UI 003's `policy-rules.ts`), each prefixed "- " as `password_complexity('html')` prints it. Met / not met marking is new (D8) |
| Confirmation | `user.new_password_repeat` | Legacy also prints `user.new_password_description` below: **missing** from en-gb (upstream and fork), renders empty, not used |
| Current password | `user.password_now` | Last field, after a separator (D9 on the order) |
| App password hint (mailbox users with active app passwords) | `user.change_password_hint_app_passwords` | `%d` = overview `activeAppPasswords` (legacy `number_of_app_passwords`, the active ones); shown only when > 0, under the current password |
| Show / hide toggle | UI 001 `auth.signIn.showPassword` | Legacy has none |
| Copy the generated password | UI 001 `secrets.copy`; announcement `admin.copy_to_clipboard` | `admin.copy_to_clipboard` ("Text copied to clipboard!") is legacy's copy confirmation (same meaning as `secrets.copied`) |
| Username for password managers (visually hidden) | `user.username` | Legacy has none; the label is only read by assistive technology |
| "Sign out my other sessions" (ticked) | new `account.password.endOtherSessions` "Sign out my other sessions" | No legacy option (sessions of this API) |
| After the change: sessions ended | new `account.password.result.sessionsEnded` "{count} other sessions were signed out." (plural forms) | Legacy cannot report it |
| After the change: app passwords keep working | `user.change_password_hint_app_passwords` (`%d` = response `activeAppPasswords`) | Same meaning ("…app passwords that will not be changed"); mailbox users only, when > 0 |
| After the change: mail server cache | new `account.password.result.mailServerCache` "Mail apps may accept the old password for up to {duration}." | Legacy cannot report it |
| Administrators (`edit/admin.twig`) | legacy: `edit.password` + `edit.generate`, `edit.password_repeat`, no current password, plus fields of UI 007 | One own-password form for every role, with the pwChangeModal keys (D9) |

Forced change (`/pending-actions`, UI 001 screen), legacy `templates/modals/footer.twig`
`#ChangePWModal` and its script in `templates/base.twig`:

| Element | Legacy key | Notes |
|---|---|---|
| Heading | `user.change_password` | UI 001 already uses it |
| Explanation (warning alert) | `user.pw_update_required` | |
| New password (placeholder in legacy) | `user.new_password` | Legacy uses placeholders only; the app shows the same text as the visible label |
| Confirmation (placeholder in legacy) | `user.new_password_repeat` | |
| Submit | `user.save_changes` | Not `user.change_password`: the modal's button says "Save changes" |
| Sign out (legacy: the close button logs out) | `tfa.cancel_setup` | UI 001 already uses it on this screen ("Cancel and log out") |
| Error alert | Part 2 (`changeOwnPassword`); network failure UI 001 `problem.network` | Legacy falls back to hard-coded "Password change failed." and "Request failed. Please try again." |
| Policy list, generate, show / hide | as the own-password form | Legacy's `#ChangePWModal` has no `data-hibp`, no policy list and no generator (D8) |
| Second-factor step shown as "next" while the password is pending | new `auth.pendingActions.secondFactor.afterPasswordChange` "You set up two-factor authentication after the new password." | Replaces UI 001's passkey-only `auth.pendingActions.secondFactor.afterPassword` |
| UI 001's interim texts | remove `auth.pendingActions.password.body`, `.link`, `.checkAgain`, `.stillPending` | Replaced by the form (FR-029) |

##### 3. Recovery e-mail (`/account/recovery-email`)

Legacy: `templates/modals/user.twig` `#pwRecoveryEmailModal` (shown with flag `pw_reset` and source
`mailcow`); `edit/self` → `edit_user_account()`.

| Element | Legacy key | Notes |
|---|---|---|
| Title | `user.pw_recovery_email` | |
| Address field | `user.email` | `type="email"`, prefilled with the stored address |
| Help under the field | `user.password_reset_info` | |
| Current password | `user.password_now` | |
| Save | `user.save` | ("Save changes") |
| Clearing | empty field + `user.save` | Legacy stores an empty value when the field is empty or not an address; an extra "Remove" action would be an addition (D15) |

##### 4. Two-factor authentication (`/account/two-factor`, `/account/two-factor/add/:method`) and forced setup

Legacy: `user/tab-user-auth.twig` rows (mailbox users), `domainadmin.twig` (domain administrators),
`admin/tab-config-admins.twig` card `tfa.tfa` (administrators); `templates/tfa_keys.twig`;
`templates/modals/footer.twig` `#YubiOTPModal`, `#WebAuthnModal`, `#TOTPModal`, `#DisableTFAModal`,
`#SetupTFAModal`; the select handler in `templates/base.twig`.

| Element | Legacy key | Notes |
|---|---|---|
| Row label "Two-factor authentication" | `tfa.tfa` | Legacy appends ":" on the user and admin pages, not on the domain administrator's |
| Entries | the entry's name (`key_id`) | Legacy shows one badge per active entry, the entry used for this sign-in in green (colour only), and "-" when none (`tfa_data.pretty`, hard-coded "-") |
| Entry type (new column, D11) | `tfa.totp`, `tfa.webauthn`, `tfa.yubi_otp`; `u2f`, `hotp`: new (enumerations below) | The legacy method names of the same meaning |
| Entry used for this sign-in (text, FR-116) | new `account.twoFactor.usedForSignIn` "Used for this sign-in" | Legacy marks it by colour only |
| Inactive entry | `mailbox.inactive` | ("Inactive") |
| Unsupported entry (`u2f`, `hotp`) | new `account.twoFactor.unsupported` "No longer supported" | `tfa.u2f_deprecated` is a sign-in message whose meaning does not fit a list |
| Yubico public ID | — | Legacy never shows it (D11) |
| Remove one entry | `admin.remove` | Legacy "[Remove]" link (composed with brackets in legacy) |
| Confirm removing one entry | `admin.ays` | Legacy browser `confirm()`; in the app the dialog text, with `admin.remove` and `footer.cancel` as buttons |
| "Set two-factor authentication method" | `tfa.set_tfa` | Row label |
| Help (mailbox users) | `user.tfa_info` | Tooltip on the user page only; rendered `\|raw` (no markup in en-gb). FR-055's link to App passwords is an addition (D10) |
| Method choice | `tfa.select` (placeholder), options `tfa.yubi_otp`, `tfa.webauthn`, `tfa.totp`, `tfa.none` | Legacy order: Yubico OTP, WebAuthn, TOTP, Deactivate (D10 on the plan's order and grouping) |
| "Other methods" grouping | UI 001 `auth.secondFactor.otherMethods` | Legacy has no grouping (D10) |
| Pointer to passkeys | new `account.twoFactor.passkeyPointer` "Passkeys let you sign in without a password. Add one in Passkeys." | Passkey texts are new strings (owner decision) |
| Policy note (removal blocked) | `danger.tfa_removal_blocked` | As FR-054 |

Add an authenticator app (`TOTPModal`; forced setup: `#SetupTFAModal` tab "Time-based OTP"):

| Element | Legacy key | Notes |
|---|---|---|
| Title | `tfa.totp` | |
| Name (placeholder in legacy) | `tfa.key_id_totp` | Used as the visible label |
| Current password (placeholder; not in forced setup) | `user.password_now` | |
| Step 1 | `tfa.scan_qr_code` | Legacy numbered list (`<ol>`), kept |
| Key as text | `tfa.enter_qr_code` | Composed as legacy: key + ":" + line break + `<code>` key. Grouping and copy (`secrets.copy`, `admin.copy_to_clipboard`) are additions of FR-046 |
| QR code text alternative | new `account.twoFactor.totp.qrAlt` "QR code of the key shown as text" | Legacy image has no alternative (FR-113) |
| "Open in authenticator app" | new `account.twoFactor.totp.openInApp` "Open in authenticator app" | No legacy counterpart (FR-046) |
| Step 2 | `tfa.confirm_totp_token` | Composed as legacy with ":" |
| Code field | — | Legacy number input without placeholder; UI 001 `auth.secondFactor.totp.code` as the label |
| Confirm | `tfa.confirm` | |
| Wrong code, attempts left | `danger.totp_verification_failed` + new `account.twoFactor.totp.attemptsLeft` "{count} attempts left." (plural) and `account.twoFactor.totp.clockHint` "Check that the time on your phone is set automatically." | |
| Setup expired / start again | new `account.twoFactor.enrolment.expired` "The setup expired. Start again." and `account.twoFactor.enrolment.restart` "Start again" | Legacy has no expiry |

Add a security key (`#WebAuthnModal`; forced setup tab "WebAuthn"):

| Element | Legacy key | Notes |
|---|---|---|
| Title | `tfa.webauthn` | |
| Name (placeholder) | `tfa.key_id` | |
| Current password (placeholder; not in forced setup) | `user.password_now` | |
| Start | `tfa.start_webauthn_validation` | Legacy: clickable fingerprint icon with this caption |
| Waiting | `tfa.waiting_usb_register` (HTML) | Legacy key of the same meaning ("Waiting for USB device… Please enter your password above and confirm…"), still in the language files although the current templates no longer use it; FR-115's "Waiting for the server" is new `account.twoFactor.webauthn.waitingServer` "Waiting for the server…" |
| Ceremony failure | legacy: `tfa.error_code` + ": " + browser error + " " + `tfa.reload_retry` (composed as legacy) | The plan's plain-language texts per error are new (D12) |
| Browser cannot use security keys | hard-coded "Browser not supported." (`window.alert`) → new `account.twoFactor.webauthn.unsupported` "Browser not supported." | |
| Name missing (forced setup) | hard-coded "Please fill in the key ID first." → client `validation.required` | |

Add a Yubico OTP key (`#YubiOTPModal`; forced setup tab "Yubi OTP"):

| Element | Legacy key | Notes |
|---|---|---|
| Title | `tfa.yubi_otp` | |
| Name (placeholder) | `tfa.key_id` | |
| Explanation with the link | `tfa.api_register` (HTML) | `%s` = product name from branding (legacy `ui_texts.main_name`); the `<a>` stays as the value has it |
| Yubico API ID (placeholder) | hard-coded "Yubico API ID" → new `account.twoFactor.yubico.clientId` "Yubico API ID" | |
| Yubico API Key (placeholder) | hard-coded "Yubico API Key" → new `account.twoFactor.yubico.secretKey` "Yubico API Key" | |
| Current password (placeholder; not in forced setup) | `user.password_now` | |
| OTP (placeholder) | hard-coded "Touch Yubikey" → UI 001 `auth.secondFactor.yubiOtp.placeholder` | |
| Save | `user.save_changes` | |

Turn off (`#DisableTFAModal`, opened by option `tfa.none`):

| Element | Legacy key | Notes |
|---|---|---|
| Action and dialog title | `tfa.none` (action), `tfa.delete_tfa` (title) | FR-052/FR-053's "Turn off two-factor authentication" rewords them (D10) |
| Current password (placeholder) | `user.password_now` | |
| Confirm button | `tfa.delete_tfa` | Legacy replaces spaces with `&nbsp;`; plain text in the app |
| "All entries are removed, passkeys stay" | new `account.twoFactor.turnOff.body` "All second factors are removed. Your passkeys stay." | Passkey wording |

Forced setup (`#SetupTFAModal`): heading `tfa.setup_title`, warning `tfa.setup_required`, tabs
hard-coded "Time-based OTP", "WebAuthn", "Yubi OTP" (UI 001 already labels the methods with
`tfa.totp`, `tfa.webauthn`, `tfa.yubi_otp`), forms as above without the current password, sign-out
`tfa.cancel_setup`. The passkey option and its recommendation are UI 001's `auth.pendingActions.secondFactor.*`
(passkey wording); UI 001's `auth.pendingActions.secondFactor.classicLink` and `.unsupported` are
removed once the other methods replace the classic link.

##### 5. Password reset request (`/reset-password/request`) and reset page (`/reset-password`)

Legacy: `templates/reset-password.twig`, `reset-password.php`, POST handlers in
`inc/triggers.user.inc.php`; link on `templates/user_index.twig`.

| Element | Legacy key | Notes |
|---|---|---|
| Sign-in link | `login.forgot_password` | Verbatim with its "> " (UI 001 already) |
| Card heading (both screens) | `login.reset_password` | |
| Product name legend | branding (legacy `ui_texts.main_name`, HTML) | As UI 001's sign-in screens |
| Request: address field (placeholder in legacy) | `login.username` | Legacy `type="text"` with "Username"; the app's e-mail field keeps this label (D18) |
| Request: submit | `login.request_reset_password` | |
| Request: confirmation | new `auth.passwordReset.requested` "If this address belongs to an account with a recovery e-mail address, a reset link valid for {minutes} minutes is on its way." (plural) | Legacy's `success.recovery_email_sent` cannot occur (D2) |
| Reset: new password (placeholder) | `login.new_password` | |
| Reset: confirmation (placeholder) | `login.new_password_confirm` | |
| Reset: mismatch | `danger.password_mismatch` | Legacy references `login.password_mismatch`, **missing** from en-gb; `password_check()` returns `danger.password_mismatch` |
| Reset: submit | `login.reset_password` | |
| Reset: account address | `login.username` (label) + the token's address | Legacy does not show it (D17) |
| Reset: link validity | new `auth.passwordReset.validUntil` "This link is valid until {time} ({relative})." | Legacy does not show it (D17) |
| Reset: policy rules, generate, show / hide | as the own-password form | Legacy reset page has none (D8) |
| Reset: signed-in warning | new `auth.passwordReset.signedIn.body` "Completing the reset signs out every session of this account." and `.bodySelf` "…including this one."; actions `auth.passwordReset.signedIn.continue` "Continue", `common.back` | Legacy redirects signed-in users away; FR-042 (D17) |
| Invalid or expired link | `login.invalid_pass_reset_token` (HTML, `<br>`) | |
| Request a new link | `login.request_reset_password` | Same meaning ("Request password change"); legacy only offers the next link |
| Back to sign-in | `login.back_to_mailcow` | Fork text may name the brand; loaded at runtime |
| Second-factor step | heading `tfa.tfa`, notice `info.awaiting_tfa_confirmation`, UI 001's factor components (`tfa.totp`, `tfa.webauthn`, `tfa.yubi_otp`, `tfa.authenticators`, `login.login`) | Legacy `#ConfirmTFAModal` after `reset_password('reset')` returns `info.awaiting_tfa_confirmation` |
| Account cannot use its second factors | UI 001 `problem.second-factor-unavailable` | |
| Done | `success.password_changed_success` + new `auth.passwordReset.done.sessionsEnded` "All sessions of this account were signed out." and the sign-in action `login.login` | Legacy redirects to the sign-in page with the success message |

##### 6. Mailbox overview, webmail and home card (`/account`, UI 001 home)

Legacy: `user/tab-user-auth.twig` (General tab, left column) and `user/tab-user-details.twig`
(Details tab); `user_get_alias_details()`.

| Element | Legacy key | Notes |
|---|---|---|
| Webmail button | `user.open_webmail_sso` | Legacy adds an arrow icon; disabled during a forced password change and in dual login without `allow_admin_email_login` (UI 007) |
| Webmail tab blocked: link | `user.open_webmail_sso` as the link text + new `account.webmail.blocked` "The browser blocked the new tab. Open webmail here:" | Legacy has no hand-off |
| Webmail help (FR-099) | new `account.webmail.signsOutClassic` "Opening webmail signs this browser out of the classic interface." | Legacy has none (D19) |
| Overview legend | `user.overview` | |
| Message count | the number + " " + `user.messages` | Composed as legacy (`{{ messages }} {{ lang.user.messages }}`) |
| Storage | "used / quota" with locale sizes, "∞" when unlimited (hard-coded symbol) | Legacy has no key; the plan's "256 MiB of 1 GiB used (25 %)" is a new sentence (D14) |
| Storage bar | percentage "{n}%" inside the bar | Accessible value from `role="progressbar"`; colour classes as legacy (`percent_class`) |
| Protocols row label | `user.protocols` | Legacy appends ":" |
| Protocols help | `user.direct_protocol_access` (HTML) | Legacy tooltip; the app shows it as text (FR-116) |
| Protocol names | IMAP, SMTP, Sieve, POP3, ActiveSync, CalDAV/CardDAV in this order (hard-coded) → UI 003 `mailboxes.protocol.imap`, `.smtp`, `.sieve`, `.pop3`, `.activeSync`, `.dav` | Legacy order differs from UI 003's mass menu; same English texts |
| Protocol state as text (FR-116) | new `account.overview.protocol.allowed` "allowed", `.notAllowed` "not allowed" | Legacy shows a check or cross icon only |
| Direct aliases + help | `user.direct_aliases` + `user.direct_aliases_desc` | Entry: address, then " — " + comment icon + public comment when set (composed as legacy); none: cross icon |
| Alias-domain addresses | listed under `user.direct_aliases`, comment `add.alias_domain` | `user_get_alias_details()` adds them as direct aliases with this comment |
| Shared aliases + help | `user.shared_aliases` + `user.shared_aliases_desc` | As direct aliases |
| Also allowed to send as | `user.aliases_also_send_as` | `*` → `user.sender_acl_disabled` (HTML badge); otherwise the comma-separated list; none: cross icon |
| Send as any address of domains | `user.aliases_send_as_all` | Value list or cross icon |
| Catch-all | `user.is_catch_all` | Value or cross icon |
| Display name | `mailbox.fname` | Legacy user page does not show it (D14) |
| Recovery address | `user.pw_recovery_email` | Shown in legacy only inside its modal (D14) |
| Last password change | `user.last_pw_change` | Legacy shows it only in the mailbox list (`mailbox.last_pw_change`, "-" when never set); `null` → "-" as legacy, no new string (D14) |
| Counts (active app passwords, temporary aliases, push active) | new `account.overview.counts.appPasswords` "{count} active app passwords", `.temporaryAliases` "{count} temporary aliases", `.pushActive` "Push notifications are on" | Legacy never shows them (D14) |
| Home card | `user.overview`, the storage as above, `user.open_webmail_sso` | UI 001 home; link to My account with `header.user_settings` |
| Forced-password alert of the General tab | `user.force_pw_update` (HTML) | Not shown: a forced change now blocks the app on the pending-actions screen (spec "Improved") |

##### 7. Recent logins (`/account/recent-logins`, mailbox context)

Legacy: right column of `user/tab-user-auth.twig`; `last_logins()` in `js/site/user.js`;
`last_login()` in `inc/functions.inc.php`.

| Element | Legacy key | Notes |
|---|---|---|
| Heading | `user.recent_successful_connections` | |
| Loading | `user.loading` | Legacy spinner with hard-coded visually hidden "Loading..." |
| Period menu | `user.login_history` | Button label of the dropdown |
| Periods | "1 " + `user.day`, "1 " + `user.week`, "2 " + `user.weeks`, "1 " + `user.month` | Composed as legacy (D21); default 1 week as legacy |
| Clear | `user.clear_recent_successful_connections` | Legacy text link |
| Clear confirmation | `user.delete_ays` | Legacy browser `confirm(lang.delete_ays)`; FR-084's "also cleared in the classic interface" is new (D20) |
| Entry: address | the address | Legacy links it to bgp.tools (dropped, spec) |
| Entry: internal address | hard-coded "Web/EAS/Internal (" + address + ")" → new `account.recentLogins.internal` "Web/EAS/Internal ({address})" | `last_login()` builds it for private and reserved addresses |
| Entry: country | country name from `Intl.DisplayNames` | Legacy shows a flag icon only (spec "Improved") |
| Entry: service | the service code as stored, upper-case | Legacy badge shows the code; the fork turns `MAILCOWUI` into `WEBUI`. Translated service labels are new (D20) |
| Entry: time | locale date and time | |
| Entry: app password | its name, linking to its detail page | Name missing (deleted): hard-coded "App" → new `account.recentLogins.appPasswordFallback` "App" (D20) |
| Empty list | `user.no_record` | Legacy shows an empty list; `user.no_record` ("No record") is the same meaning, used by the mailbox list's last login |
| Service filter "all" | UI 001 `lists.filters.all` | Filter, search and sort are app additions (spec "Improved") |
| Sort and filter labels | time `admin.time`, service `admin.service`, address UI 001 `auditLog.columns.address` | |

Domain administrators' legacy card also shows `.last-ui-login` (no script fills it in this
version) and `user.clear_recent_successful_connections` for their UI logins: dropped (FR-085, D20).

##### 8. App passwords (list, create, detail)

Legacy: `user/AppPasswds.twig`, `draw_app_passwd_table()` in `js/site/user.js` (`lang` = `lang_user`),
`templates/modals/user.twig` `#addAppPasswdModal`, `templates/edit/app-passwd.twig` (through
`edit.php`); `inc/functions.app_passwd.inc.php`.

List:

| Element | Legacy key | Notes |
|---|---|---|
| Title | `user.app_passwds` | |
| Explanation | `user.app_hint` | Rendered `\|raw` in legacy (no markup in en-gb), so through `<LegacyText>`. Above the table. FR-067's further sentences are new (D13) |
| Create | `user.create_app_passwd` | |
| Selection and mass actions | `mailbox.toggle_all`, `mailbox.quick_actions`: `mailbox.activate`, `mailbox.deactivate`, `mailbox.remove` | Legacy has them above and below the table; the plan drops them (D13) |
| Expand / collapse all | `datatables.expand_all`, `datatables.collapse_all` | DataTables child rows only; not used |
| Columns | "ID" (hard-coded, UI 001 `lists.id`), `user.app_name`, `user.allowed_protocols`, `user.active`, `user.action` | In this order. The plan adds a creation date and drops ID (D13); creation date would be `user.created_on` |
| Protocols cell | IMAP, SMTP, EAS/ActiveSync, DAV, POP3, Sieve (hard-coded, in this order, `<code>`) | Enumeration below |
| Active cell | check / cross icon | Text for FR-116: `user.active` / `mailbox.inactive` |
| Row actions | `user.edit`, `user.remove` | |
| Search, loading, empty, no match, page info | `datatables.search`, `datatables.loadingRecords`, `datatables.emptyTable`, `datatables.zeroRecords`, `datatables.info` (`_START_`, `_END_`, `_TOTAL_`) | As other lists |
| Filter "active", sort labels | `user.active` (with UI 001 `lists.filters.yes`/`no`); sort `user.app_name`, `user.created_on`, `mailbox.last_modified`, `user.active` | |
| Read-only (mailbox context without `appPasswds`) | `acl.prohibited` + `acl.app_passwds` | Legacy draws "-" in the action column without the flag |

Create (`#addAppPasswdModal`):

| Element | Legacy key | Notes |
|---|---|---|
| Page title | `add.app_password` | |
| Name | `add.app_name` | |
| Password with generate | `user.password` + `user.generate` (composed as legacy), haveibeenpwned (`data-hibp`) | Dropped by server generation (D3) |
| Password repeat | `user.password_repeat` | Dropped by server generation (D3); `user.new_password_description` below it is **missing** |
| Protocols | `add.app_passwd_protocols` | Legacy multi-select, all selected; options IMAP, SMTP, EAS/ActiveSync, CardDAV/CalDAV, POP3, Sieve (hard-coded, in this order) |
| No protocol warning (FR-061) | new `account.appPasswords.noProtocol` "With no protocol selected, this app password works nowhere." | Legacy has none (D13) |
| Active | `add.active` | Checked |
| Submit | `admin.add` | |
| One-time dialog title | `edit.app_passwd` | ("App password") |
| One-time dialog username | `user.username` + the mailbox address | |
| One-time dialog secret, copy, warning, close | UI 001 `secrets.label`, `secrets.copy`, `secrets.copied`, `secrets.warning`, `secrets.close`, `secrets.confirmClose.*` | Legacy never shows a generated secret (D3) |

Detail (`edit/app-passwd.twig`):

| Element | Legacy key | Notes |
|---|---|---|
| Title | `edit.app_passwd` + the app password's name | Conventions "Detail pages"; legacy card header `edit.title`, back link `edit.previous` |
| Name | `edit.app_name` | |
| Password with generate, repeat | `edit.password` + `edit.generate`, `edit.password_repeat` (haveibeenpwned) | With server generation: the action "generate" (`edit.generate`) asks for confirmation and shows the dialog (D3) |
| Generate confirmation | new `account.appPasswords.regenerate.body` "The current password of this app password stops working. The new one is shown once." | Legacy has none (the typed password simply replaces it) |
| Active | `edit.active` | |
| Protocols | `edit.app_passwd_protocols`, options as the create form | |
| Save | `edit.save` | |
| Delete (list only in legacy) | `user.remove` with `footer.confirm_delete`, `footer.delete_these_items`, `footer.delete_now`, `footer.cancel` | Conventions keep deletion in the list; the plan also offers it on the detail page (D13) |
| History | UI 002 `history.link` | |

##### 9. Temporary aliases (`/account/temporary-aliases`, mailbox context)

Legacy: `user/SpamAliases.twig`, `draw_tla_table()` in `js/site/user.js`, `#tempAliasModal` in
`templates/modals/user.twig`; `mailbox('add'|'edit'|'delete', 'time_limited_alias')`.

| Element | Legacy key | Notes |
|---|---|---|
| Title | `user.spam_aliases` | |
| Explanation | `user.spam_aliases_info` (HTML) | |
| Columns | `user.alias`, `user.description`, `user.alias_valid_until`, `user.created_on`, `user.action` | In this order. Legacy's default order is "Valid until", latest first, permanent aliases last (`order: [[4, 'desc']]`, column 4 is the validity); the plan sorts by creation, newest first (D22) |
| Permanent alias in "Valid until" | `user.forever` | ("Forever"); the plan's "Never expires" is not a legacy text |
| Relative expiry (FR-120) | `user.alias_time_left` + the relative duration | Legacy key of the same meaning ("Time left"), in the language files but unused by the current templates |
| Row action | `user.remove` | |
| Selection, mass actions | `mailbox.toggle_all`, `mailbox.quick_actions` | |
| Validity actions | `user.expire_in` + " 1 " + `user.hour`; " 1 " + `user.day`; " 1 " + `user.week`; " 1 " + `user.month`; " 1 " + `user.year`; " 10 " + `user.years`; `user.expire_never` | Composed as legacy (D21); hours 1, 24, 168, 744, 8760, 87600 and permanent |
| Mass remove | `mailbox.remove` with `footer.confirm_delete`, `footer.delete_these_items`, `footer.delete_now`, `footer.cancel`; typed count UI 002 `bulk.confirm.typeCount` | |
| Generate (button) | legacy `user.alias_create_random` + ", 1 " + `user.year`, a dropdown of "@ " + domain | Composed as legacy. With the validity chosen at creation (D5) the button and the form title are `user.alias_create_random` alone |
| Domain | `add.domain` | Legacy picks it from the dropdown (hard-coded "@ " prefix) before the modal opens; no label |
| Description | `user.description` | |
| Validity at creation (D5) | `user.alias_select_validity` ("Period of validity") | In the language files, unused by the current templates. Options composed as the validity actions without `user.expire_in`: "1 " + `user.hour` … "10 " + `user.years`, and `user.expire_never` |
| Submit | `admin.add` | |
| New address shown with copy | the address + UI 001 `secrets.copy`; announcement `admin.copy_to_clipboard` | Legacy only refreshes the table |
| Copy button per address (FR-070) | UI 001 `secrets.copy` | Legacy has none |
| Filter "permanent", sort labels | `user.forever` (yes / no); sort `user.created_on`, `user.alias_valid_until`, `user.alias` | |
| Search, empty, etc. | `datatables.*` as above | |
| Per-item results | UI 002 `bulk.*` summary, each line the legacy message (Part 2) | |

##### 10. Mail settings (`/account/mail-settings`, mailbox context) and bulk TLS

Legacy: `user/tab-user-settings.twig` (user page, first two rows); `templates/edit/mailbox.twig`
Mailbox tab (administrators: tagging after the relayhost, then quarantine rows (UI 006), then the
TLS row); bulk entries in `templates/mailbox/tab-mailboxes.twig`.

| Element | Legacy key | Notes |
|---|---|---|
| Tagged mail label | `user.tag_handling` | |
| Options (button group, single choice) | `user.tag_in_subfolder`, `user.tag_in_subject`, `user.tag_in_none` | In this order |
| Help | `user.tag_help_explain` (HTML), `user.tag_help_example` (HTML) | The example is legacy's fixed `me+Facebook@example.org`; FR-074's example from the mailbox's own address is new (D14) |
| TLS label | `user.tls_policy` | |
| TLS toggles | `user.tls_enforce_in`, `user.tls_enforce_out` | Legacy toggle buttons (pressed = on); the app's switches have the same meaning |
| TLS warning | `user.tls_policy_warning` (HTML) | Already says that the policy covers alias-domain addresses and aliases with only this mailbox as target, so FR-075's "note" needs no new string. The legacy edit-mailbox page shows no warning (D6) |
| Read-only (no flag) | `acl.prohibited` + `acl.delimiter_action` / `acl.tls_policy` | Legacy `data-acl="0"` disables the buttons |
| Quarantine notification and category rows | — | UI 006 |
| Bulk TLS (mailbox list) | group headers `mailbox.tls_enforce_in`, `mailbox.tls_enforce_out`, each with `mailbox.activate`, `mailbox.deactivate` | Inside `mailbox.quick_actions`; four separate actions without confirmation in legacy (D6) |
| Bulk results | UI 002 `bulk.*`, each line `success.mailbox_modified` | |

##### 11. Push notifications (`/account/push-notifications`, mailbox context)

Legacy: `user/Pushover.twig` (own context, `user.*` keys) and the `#mpushover` tab of
`templates/edit/mailbox.twig` (administrators, `edit.*` keys); `inc/functions.pushover.inc.php`.
The en-gb texts differ between the two key sets, so the app uses the `user.*` set in the own context
and the `edit.*` set in the mailbox context, as legacy does.

| Element | Own context (user page) | Mailbox context (edit page) | Notes |
|---|---|---|---|
| Title | hard-coded "Pushover API" | `edit.pushover` | D4: `edit.pushover` in both |
| Logo link to pushover.net | image (own context only) | — | Not a text |
| Info | `user.pushover_info` (HTML, `%s` = the mailbox address) | `user.pushover_info` (same, `%s` = the mailbox) | The edit page also uses the `user.*` key |
| Placeholders | `edit.pushover_vars` (HTML) + ": " + `{SUBJECT}`, `{SENDER}`, `{SENDER_ADDRESS}`, `{SENDER_NAME}`, `{TO_NAME}`, `{TO_ADDRESS}`, `{MSG_ID}` (hard-coded `<code>`) | same | Composed as legacy; both pages use `edit.pushover_vars` |
| Application token | hard-coded "API Token/Key (Application)" → new `account.push.token` | same | `maxlength` 30 |
| User / group key | hard-coded "User/Group Key" → new `account.push.userKey` | same | |
| Stored, write-only (conventions "Secrets") | new `account.push.stored` "A value is stored. Leave empty to keep it." | same | Legacy prefills the stored values |
| Title | `user.pushover_title`, placeholder hard-coded "Mail" | `edit.pushover_title`, same placeholder | Placeholder → new `account.push.titlePlaceholder` "Mail" (the server default) |
| Text | `user.pushover_text`, placeholder hard-coded "You've got mail 📧" | `edit.pushover_text`, same | → new `account.push.textPlaceholder` "You've got mail 📧" |
| Senders | `user.pushover_sender_array` (HTML) | `edit.pushover_sender_array` (HTML) | Single line, placeholder hard-coded "sender1@example.com, sender2@example.com" → new `account.push.sendersPlaceholder`; the plan's one-per-line textarea is a deviation (D16) |
| Sound | `edit.pushover_sound` | `edit.pushover_sound` | The user page also uses the `edit.*` key. Option labels: Enumeration "Pushover sounds" below |
| Active | `user.active` | `edit.active` | |
| Advanced settings | `user.advanced_settings` | `edit.advanced_settings` | Collapsed by default |
| Sender pattern | `user.pushover_sender_regex`, placeholder hard-coded `/(.*@example\.org$\|^foo@example\.com$)/i` | `edit.pushover_sender_regex`, same | Placeholder → new `account.push.senderPatternPlaceholder` (literal) |
| Escalate high priority | `user.pushover_evaluate_x_prio` (HTML) | `edit.pushover_evaluate_x_prio` (HTML) | |
| Only high priority | `user.pushover_only_x_prio` (HTML) | `edit.pushover_only_x_prio` (HTML) | |
| Save | `user.save` | `edit.save` | |
| Verify | `user.pushover_verify` | `edit.pushover_verify` | |
| Remove | `user.remove` | `edit.remove` | |
| Remove confirmation | `user.delete_ays` | — | Legacy confirms only on the user page (`js/site/user.js`); the app confirms in both (FR-081, conventions) |
| Read-only (no flag) | `acl.prohibited` + `acl.pushover` | same | |

##### 12. Filters (Mail setup › Filters, mailbox context, the user's read-only view)

Legacy: `templates/mailbox/tab-filters.twig`, `draw_filter_table()` in `js/site/mailbox.js`
(`lang` = `lang_mailbox`), `#addFilterModalAdmin` in `templates/modals/mailbox.twig`,
`templates/edit/filter.twig`, `#userFilterModal` in `templates/modals/user.twig`,
`inc/ajax/sieve_validation.php`.

List (`/filters`, `/mailboxes/:address/filters`):

| Element | Legacy key | Notes |
|---|---|---|
| Navigation entry, title | `mailbox.filters` | UI 001 catalogue entry `filters` |
| Refresh | `admin.refresh` | |
| Explanation | `mailbox.sieve_info` (HTML) | |
| Add | `mailbox.add_filter` | |
| Selection, mass actions | `mailbox.toggle_all`, `mailbox.quick_actions`: `mailbox.activate`, `mailbox.deactivate`, `mailbox.set_prefilter`, `mailbox.set_postfilter`, `mailbox.remove` | In this order |
| Mass remove confirmation | `footer.confirm_delete`, `footer.delete_these_items`, `footer.delete_now`, `footer.cancel`; typed count `bulk.confirm.typeCount` | Legacy passes `data-text="{{ lang.user.eas_reset }}?"` here, so it asks "Reset ActiveSync device cache?" — a legacy bug (D22) |
| Columns | "ID" (UI 001 `lists.id`), `mailbox.active`, "Type" (hard-coded → new `filters.columns.type` "Type"), `mailbox.owner`, `mailbox.description`, "Script" (hard-coded child row → new `filters.columns.script` "Script"), `mailbox.action` | Default order by ID, newest first in legacy (`order: [[2, 'desc']]`); the plan sorts by mailbox (D22) |
| Active cell | `mailbox.active` / `mailbox.inactive` | Badges |
| Kind cell | Enumeration "SieveFilterKind" below | Legacy capitalises the stored value |
| Row actions | `mailbox.edit`, `mailbox.remove` | |
| Filters and sort labels | mailbox `mailbox.owner`, kind `add.sieve_type`, active `mailbox.active`; sort `mailbox.owner`, `mailbox.description`, `add.sieve_type`, `mailbox.active`, `mailbox.created_on`, `mailbox.last_modified` | |
| Search, empty, etc. | `datatables.*` | |
| Read-only (domain administrator without `filters`) | `acl.prohibited` + `acl.filters` | Legacy `data-acl` disables the action group |
| Global prefilter / postfilter, presets | — | UI 013 |

Create (`#addFilterModalAdmin`) and edit (`edit/filter.twig`):

| Element | Create | Edit | Notes |
|---|---|---|---|
| Title | hard-coded "Filter" → new `filters.form.title` "Filter" | hard-coded "Filter" (h4) + the description | `admin.filter` ("Filter") exists but labels an LDAP search filter; a new string is safer |
| Mailbox | `add.username` (searchable choice) | — (not on the edit page) | Field order differs: create = mailbox, type, description, script, active; edit = description, type, script, active (D23) |
| Kind | `add.sieve_type` | `edit.sieve_type` | Options: Enumeration "SieveFilterKind" |
| Description | `add.sieve_desc` | `edit.sieve_desc` | `maxlength` 255 |
| Script | hard-coded "Script:" → new `filters.form.script` "Script" | same | The colon is template punctuation (as `{{ … }}:` elsewhere) |
| Activation warning | `add.activate_filter_warn` | — | FR-094's warning naming the filter is new `filters.form.deactivates` "Saving deactivates the active {kind} \"{name}\"." (D23) |
| Active | `add.active` (checked) | `edit.active` | |
| Check | `add.validate` | — (single "Validate and save") | |
| Save | `admin.add` (enabled only after a successful check) | `edit.validate_save` | D23 |
| Script size counter | new `filters.form.bytes` "{used} of {max} bytes" | same | Legacy has none |
| Presets | `mailbox.sieve_preset_header` (HTML), `mailbox.insert_preset`, `mailbox.sieve_preset_1`…`_8` | — | UI 013 (FR-096) |

The user's read-only view (`/account/filters`, `#userFilterModal`):

| Element | Legacy key | Notes |
|---|---|---|
| Link on the General tab | `user.show_sieve_filters` | Becomes the hub entry (D1) |
| Heading | `user.active_sieve` | |
| Loading | `user.loading` | |
| Script | monospaced block | Copy: UI 001 `secrets.copy`, `admin.copy_to_clipboard` |
| No active script | `user.no_active_filter` | |
| Filters set by administrators | columns as the admin list, read-only | Legacy never shows them to the user (D16) |
| Mailbox context: active script panel | `user.active_sieve`, `user.no_active_filter` | Legacy offers administrators no such panel (D16) |

##### 13. Groupware resets (`/account/devices`, mailbox context `groupware`)

Legacy: `user/tab-user-settings.twig` (after a separator, only with the groupware); confirmation
`#ConfirmDeleteModal` in `templates/modals/footer.twig` through `delete_selected` in
`js/build/011-api.js`.

| Element | Legacy key | Notes |
|---|---|---|
| ActiveSync row label | `user.eas_reset` | |
| ActiveSync button | `user.eas_reset_now` | |
| ActiveSync help | `user.eas_reset_help` (HTML) | |
| SOGo row label | `user.sogo_profile_reset` | |
| SOGo button | `user.sogo_profile_reset_now` | |
| SOGo help | `user.sogo_profile_reset_help` (HTML) | Already says that contacts and calendars are deleted irretrievably |
| Confirmation title, buttons | `footer.confirm_delete`, `footer.delete_now`, `footer.cancel` | |
| Confirmation text | `user.eas_reset` + "?" / `user.sogo_profile_reset` + "?" | Composed as legacy (`data-text`); the item list shows the mailbox address |
| SOGo acknowledgement box | new `account.devices.sogoAcknowledge` "I understand that my contacts and calendars will be deleted" | FR-087; a confirmation step legacy lacks (D24) |
| Read-only / hidden | `acl.prohibited` + `acl.eas_reset` / `acl.sogo_profile_reset`; hidden without the groupware | |

##### 14. Mail app setup (`/account/mail-apps`)

Legacy: `user/tab-user-auth.twig` (two rows of profile links and the guide link); `mobileconfig.php`;
`login.mobileconfig_info` on `user_index.twig`.

| Element | Legacy key | Notes |
|---|---|---|
| Profiles row label | `user.apple_connection_profile` | Legacy appends ":" |
| Profile "e-mail" | `user.email` + " [IMAP, SMTP]" (hard-coded `<small>`) | Help `user.apple_connection_profile_mailonly` (legacy tooltip) |
| Profile "e-mail, calendars and contacts" (groupware only) | `user.email_and_dav` + " [IMAP, SMTP, Cal/CardDAV]" (hard-coded `<small>`) | Help `user.apple_connection_profile_complete` |
| Profiles with an app password (flag `app_passwds` in the API; legacy shows them to everyone) | second row label `user.apple_connection_profile` + line break + `user.with_app_password` | Help: the variant's text + " " + `user.apple_connection_profile_with_app_password` (composed as legacy). The plan's single "Include a new app password" option (D25) would use `user.with_app_password` |
| "For iPhone, iPad and Mac" | — | Legacy's help texts already say "for an Apple device"; no new string needed (D25) |
| After a profile with an app password | `user.apple_connection_profile_with_app_password` + new `account.mailApps.profile.deleteAfterInstall` "Delete the file after installing it." and link `user.app_passwds` | |
| External guide link | `user.client_configuration` | Legacy builds a link to the mailcow documentation; the API's `documentationUrl` |
| In-app guide | new strings: `account.mailApps.guide.title` "Server settings", `.server` → `add.hostname` ("Host"), `.port` → `add.port`, encryption label `user.encryption`, values new `account.mailApps.encryption.tls` "SSL/TLS" and `.starttls` "STARTTLS", authentication label `user.authentication` with value new `account.mailApps.auth.normalPassword` "Normal password", username `user.username` | No legacy screen (conventions: screens without a counterpart stay, shared fields use legacy keys) |
| Protocol headings in the guide | `mailboxes.protocol.imap`, `.pop3`, `.smtp`, `.activeSync`; new `account.mailApps.protocol.caldav` "CalDAV", `.carddav` "CardDAV" | |
| Protocol without direct access | new `account.mailApps.appPasswordOnly` "Only an app password that allows {protocol} works here." | |
| When an app password is needed (FR-102) | `user.tfa_info` (same meaning, when 2FA is on) + `user.direct_protocol_access` (HTML, when direct access is off) | Prefer these over a new explanation |
| Administrators and domain administrators | `login.mobileconfig_info` | FR-106 |

##### Shared: confirmations, outcomes, dependencies

| Element | Key | Notes |
|---|---|---|
| Deletion dialogs | `footer.confirm_delete`, `footer.delete_these_items`, `footer.delete_now`, `footer.cancel` | Conventions |
| Typed count | UI 002 `bulk.confirm.typeCount` | |
| Per-item and bulk summaries | UI 002 `bulk.*` | Each item line: the legacy message of the single action (Part 2) |
| Outdated | UI 002 `sections.outdated.*`, `problem.status.412` | |
| Dependency names for `temporary-failure` | new `selfService.dependency.sharedStore` "the settings store", `.mailStore` "the mail server", `.pushover` "the Pushover service", `.addressGeneration` "the address generator", `.unknown` "a server component" | Legacy shows `danger.redis_error` with the raw exception; UI 003's `mailboxes.delete.blocker.mailStore` / `.sharedStore` are full sentences of the same meaning and could be shown instead of composing |
| Yubico service | UI 001 `LEGACY_TEXTS`: `problem.temporary-verification-failure` → `danger.temp_error`; name new `selfService.dependency.yubico` "the Yubico verification service" | FR-020 |
| Recent-login service labels | none: codes are shown as sent | The plan's `selfService.service.*` would be new (D20) |
| Groupware disabled | new `problem.groupware-disabled` "Webmail, groupware resets and calendar profiles are not available on this server." | Legacy hides these when `SKIP_SOGO=y` |
| Password managed externally | new `problem.password-managed-externally` = `account.password.external` | |
| Enrolment expired | new `problem.second-factor-enrolment-expired` = `account.twoFactor.enrolment.expired` | |
| Pre-hashed password | new `validation.preHashedPassword` "The password may not start with a hash scheme such as {scheme}." | Legacy has no such check |
| Name too long once stored | new `validation.tooLongStored` "This name is too long once special characters are encoded." | `tooLong` with `stored: true` |

##### Enumerations and flags

| Value | Legacy key | Notes |
|---|---|---|
| OwnSecondFactorType `totp` | `tfa.totp` | "Time-based OTP (Google Authenticator, Authy, etc.)"; legacy tabs hard-code "Time-based OTP" |
| `webauthn` | `tfa.webauthn` | "WebAuthn authentication" |
| `yubiOtp` | `tfa.yubi_otp` | "Yubico OTP authentication" |
| `u2f` | none: hard-coded "Fido U2F" (`get_tfa()` pretty name) / "U2F" (sign-in tab) → new `enums.secondFactorType.u2f` "Fido U2F" | Deprecated |
| `hotp` | none: hard-coded "HMAC-based OTP" (`get_tfa()`) → new `enums.secondFactorType.hotp` "HMAC-based OTP" | Deprecated |
| AppPasswordProtocol `imap` | hard-coded "IMAP" → `mailboxes.protocol.imap` | Legacy form order: imap, smtp, activeSync, dav, pop3, sieve |
| `pop3` | hard-coded "POP3" → `mailboxes.protocol.pop3` | |
| `smtp` | hard-coded "SMTP" → `mailboxes.protocol.smtp` | |
| `sieve` | hard-coded "Sieve" → `mailboxes.protocol.sieve` | |
| `activeSync` | hard-coded "EAS/ActiveSync" (form and list) → new `enums.appPasswordProtocol.activeSync` "EAS/ActiveSync" | Differs from UI 003's "ActiveSync" |
| `dav` | hard-coded "CardDAV/CalDAV" (form) and "DAV" (list) → new `enums.appPasswordProtocol.dav` "CardDAV/CalDAV" and `enums.appPasswordProtocol.davShort` "DAV" | Two legacy labels |
| MailboxTaggedMailHandling `subfolder` / `subject` / `none` | `user.tag_in_subfolder` / `user.tag_in_subject` / `user.tag_in_none` | Legacy order subfolder, subject, none |
| SieveFilterKind `prefilter` / `postfilter` | hard-coded "Prefilter" / "Postfilter" → new `enums.sieveFilterKind.prefilter`, `.postfilter` | Actions are `mailbox.set_prefilter` / `mailbox.set_postfilter` |
| Recent-login services `IMAP`, `POP3`, `SMTP`, `SIEVE`, `SOGO`, `SSO`, `EAS`, `DAV`, `WEBUI` | none (legacy shows the code) | D20 |
| Validity presets 1 h, 1 day, 1 week, 1 month, 1 year, 10 years | "1 " + `user.hour`, "1 " + `user.day`, "1 " + `user.week`, "1 " + `user.month`, "1 " + `user.year`, "10 " + `user.years` | Composed as legacy; as actions prefixed by `user.expire_in` + " " |
| Never expires | `user.expire_never` (choice and action), `user.forever` (list value) | |
| Recent-login periods 1 day, 1 week, 2 weeks, 1 month | "1 " + `user.day`, "1 " + `user.week`, "2 " + `user.weeks`, "1 " + `user.month` | Menu `user.login_history` |
| Pushover sounds | hard-coded option labels: "Pushover (default)", "Bike", "Bugle", "Cash Register", "Classical", "Cosmic", "Falling", "Gamelan", "Incoming", "Intermission", "Magic", "Mechanical", "Piano Bar", "Siren", "Space Alarm", "Tug Boat", "Alien Alarm (long)", "Climb (long)", "Persistent (long)", "Pushover Echo (long)", "Up Down (long)", "Vibrate Only", "None (silent)" → new `enums.pushoverSound.<value>` | For values from `capabilities.pushoverSounds` not in this list, show the value as sent |
| Flag `appPasswds` | `acl.app_passwds` | |
| `spamAlias` | `acl.spam_alias` | |
| `filters` | `acl.filters` | |
| `pushover` | `acl.pushover` | |
| `delimiterAction` | `acl.delimiter_action` | |
| `tlsPolicy` | `acl.tls_policy` | |
| `easReset` | `acl.eas_reset` | |
| `sogoProfileReset` | `acl.sogo_profile_reset` | |
| `pwReset` | `acl.pw_reset` | The value names the product ("mailcow"); the fork's runtime file supplies its own text |

##### History labels (audit log, FR-107)

Target types (through `LEGACY_TEXTS`, as UI 002 to 010 did): `accountPassword` → `login.password`
("Password", already the label of `enums.authMethod.password`); `secondFactor` → `tfa.tfa`;
`recoveryEmail` → `user.pw_recovery_email`; `passwordReset` → `login.reset_password`; `appPassword`
→ `edit.app_passwd`; `temporaryAlias` → `mailbox.spam_aliases` ("Temp. alias"); `sieveFilter` →
new `enums.auditTargetType.sieveFilter` "Filter" (same text as `filters.form.title`);
`pushNotificationSettings` → `edit.pushover`; `mailSettings` → `user.mailbox_settings`;
`recentLogins` → `user.recent_successful_connections`; `groupwareData` → new "Groupware data";
`webmailHandOff` → `user.open_webmail_sso`.

Event types (new strings in `enums.auditEventType.*`, no legacy equivalent): `ownPasswordChange`
"Own password changed", `ownSecondFactorEnrolment` "Second factor added", `ownSecondFactorRemoval`
"Second factor removed", `ownRecoveryEmailChange` "Recovery e-mail changed", `passwordResetRequest`
"Password reset requested", `passwordResetCompletion` "Password reset", `appPasswordCreation` "App
password added", `appPasswordUpdate` "App password changed", `appPasswordDeletion` "App password
removed", `temporaryAliasCreation` "Temporary alias added", `temporaryAliasUpdate` "Temporary alias
validity changed", `temporaryAliasDeletion` "Temporary alias removed", `sieveFilterCreation` "Filter
added", `sieveFilterUpdate` "Filter changed", `sieveFilterDeletion` "Filter removed",
`pushNotificationSettingsUpdate` "Push notification settings changed",
`pushNotificationSettingsDeletion` "Push notification settings removed",
`pushNotificationVerification` "Push notification credentials verified", `mailSettingsUpdate` "Mail
settings changed", `recentLoginsClear` "Recent logins cleared", `activeSyncCacheReset` "ActiveSync
device cache reset", `groupwareProfileReset` "SOGo profile reset", `webmailHandOff` "Webmail opened".

Failure reasons new in API 005 with a legacy message of the same meaning (administrators may see
these, so revealing ones are fine here): `currentPasswordIncorrect` → `danger.access_denied`;
`unknownAccount` and `noRecoveryEmail` → `danger.password_reset_invalid_user`; `tokenLimitReached` →
`danger.reset_token_limit_exceeded`; `messageNotSent` → `danger.recovery_email_failed`;
`invalidResetToken` → `danger.invalid_reset_token`; `lastSecondFactor` → `danger.last_key`;
`secondFactorRequiredByPolicy` → `danger.tfa_removal_blocked`; `notConfigured` →
`danger.pushover_credentials_missing`. New: `accountNotEligible` "Account cannot reset its
password", `featureDisabled` "Turned off on this server" (if UI 013 has not added it).

#### Part 2: messages

Legacy returns each outcome from the named PHP function as `success.*`, `danger.*` or `info.*`.
Placeholders are filled in order. "New" means legacy cannot produce the outcome; UI 001's generic
`problem.*` / `validation.*` strings apply unless a new string is named. Common to every operation:
`401` → UI 001; `403 forbidden` → `danger.access_denied` (UI 001 `LEGACY_TEXTS`);
`403 permission-flag-required` → `danger.access_denied` (UI 004 `LEGACY_TEXTS`) plus `acl.prohibited`
and the `acl.*` label of each `requiredFlags` entry (every legacy self-service function answers a
missing flag with `access_denied`); `403 pending-action-required` → UI 001; `404` → UI 001
`problem.status.404` (per item: `bulk.outcome.notFound`); `412` → `problem.status.412` and UI 002
`sections.outdated.*` (per item: `bulk.outcome.outdated`); `429` → UI 001 countdown
(`auth.signIn.throttle.*`); `503 temporary-failure` → UI 001 `problem.temporary-failure` with
`selfService.dependency.<dependency>`; network failure → UI 001 `problem.network` (per item:
`bulk.outcome.unknown`); unknown types → `danger.unknown` (UI 001 `problem.generic`).

| Operation | Outcome | Legacy key (placeholder source) | Legacy function |
|---|---|---|---|
| `changeOwnPassword` | 200, mailbox user | `success.mailbox_modified` (own address, `identity.username`) | `edit_user_account()` |
| | 200, domain administrator | `success.domain_admin_modified` (own username) | `domain_admin('edit')` |
| | 200, administrator | `success.admin_modified` (no placeholder; legacy passes the username but the value has no `%s`) | `admin('edit')` |
| | 200, alternative of the plan | `success.password_changed_success` (D9) | `reset_password('reset')` |
| | 200, summary | new `account.password.result.sessionsEnded` (`sessionsEnded`), `user.change_password_hint_app_passwords` (`%d` = `activeAppPasswords`, mailbox users, > 0), new `account.password.result.mailServerCache` (`mailServerCacheSeconds` as a duration) | — |
| | `current-password-incorrect` | `danger.access_denied`, on the current-password field | wrong `user_old_pass` |
| | `validation-failed` `newPassword` `required`, `tooShort`, `missingCharacterClass` | `danger.password_complexity` (and the unmet `admin.password_policy_*` rule marked) | `password_check()` |
| | confirmation differs (client) | `danger.password_mismatch` | `password_check()` |
| | `preHashedPassword` | new `validation.preHashedPassword` (`scheme`) | — |
| | `password-managed-externally` | new `problem.password-managed-externally` | — (legacy hides the form) |
| | forced change, any refusal | the same keys; legacy shows them in `#changePWAlert` | `base.twig` script |
| `getOwnPasswordPolicy` | errors only | common | `password_complexity('get')` |
| `listOwnSecondFactors` | errors only | common | `get_tfa()` |
| `startOwnTotpEnrolment` | errors only | common | — |
| `createOwnSecondFactorWebAuthnOptions` | errors only | common | — |
| `enrolOwnSecondFactor` | 201 | `success.object_modified` (own username) | `set_tfa()` (all three methods) |
| | `current-password-incorrect` | `danger.access_denied` | `set_tfa()` |
| | `second-factor-enrolment-failed`, TOTP | `danger.totp_verification_failed` + new `account.twoFactor.totp.attemptsLeft` (`attemptsRemaining`) | `set_tfa()` |
| | `second-factor-enrolment-failed`, Yubico OTP | `danger.yotp_verification_failed` (`%s`: legacy passes the Yubico client's message; the API gives none, so legacy's own fallback literal "unknown" from `verify_tfa_login()`) | `set_tfa()` |
| | `second-factor-enrolment-failed`, WebAuthn | `danger.webauthn_verification_failed` (`%s` as above, "unknown"); legacy enrolment actually shows `tfa.error_code` + exception + `tfa.reload_retry` (D12) | `json_api.php` `webauthn-tfa-registration` |
| | `validation-failed` OTP `invalidFormat` (`yubicoOtp`) | `danger.tfa_token_invalid` | `set_tfa()` (not 44 letters or digits) |
| | `validation-failed` other fields | UI 001 `validation.*` (`validation.format.totpCode`, `.yubicoOtp`; new `validation.format.digits` "Use digits only." for the client ID) | — |
| | `second-factor-enrolment-expired` | new `problem.second-factor-enrolment-expired` | — |
| | `temporary-verification-failure` | `danger.temp_error` (UI 001) + `selfService.dependency.yubico` | — |
| `removeAllOwnSecondFactors` | 204 | `success.object_modified` (own username) | `set_tfa()` `none` |
| | `current-password-incorrect` | `danger.access_denied` | `set_tfa()` |
| | `second-factor-required-by-policy` | `danger.tfa_removal_blocked` | `set_tfa()` `none` |
| `deleteOwnSecondFactor` | 204 | `success.object_modified` (own username) | `unset_tfa_key()` |
| | `last-second-factor` | `danger.last_key` | `unset_tfa_key()` |
| | `second-factor-required-by-policy` | `danger.tfa_removal_blocked` | `unset_tfa_key()` |
| `getOwnRecoveryEmail` | errors only | common | — |
| `replaceOwnRecoveryEmail` | 200 | `success.mailbox_modified` (own address) | `edit_user_account()` |
| | `current-password-incorrect` | `danger.access_denied` | `edit_user_account()` |
| | `permission-flag-required` (`pwReset`) | `danger.access_denied` + `acl.pw_reset` | `edit_user_account()` |
| | `validation-failed` `invalidFormat` (email) | UI 001 `validation.format.email` | — (legacy silently stores an empty value) |
| | `password-managed-externally` | new `problem.password-managed-externally` | — |
| `getOwnMailboxOverview` | errors only | common | `mailbox('get', 'mailbox_details')`, `user_get_alias_details()` |
| `createWebmailHandOff` | 200 | no message (the tab opens); blocked tab → `account.webmail.blocked` | — |
| | `groupware-disabled` | new `problem.groupware-disabled` | — |
| `getOwnClientConfiguration` | errors only | common | — |
| `getOwnAppleProfile` | 200 | no message (download) | `mobileconfig.php` |
| | `forbidden` (not a mailbox user) | `login.mobileconfig_info` | `user_index.twig` |
| | `groupware-disabled` (`emailAndDav`) | new `problem.groupware-disabled` | — |
| `createOwnAppleProfileWithAppPassword` | 201 | `user.apple_connection_profile_with_app_password` + new `account.mailApps.profile.deleteAfterInstall` | — |
| | `permission-flag-required` (`appPasswds`) | `danger.access_denied` + `acl.app_passwds` | — |
| `requestPasswordReset` | 200 | new `auth.passwordReset.requested` (`tokenLifetimeMinutes`); legacy `success.recovery_email_sent` (masked address), `danger.password_reset_invalid_user`, `danger.recovery_email_failed` cannot occur (D2) | `reset_password('issue')` |
| | `password-reset-unavailable` | `danger.password_reset_na` | `reset_password('issue')` |
| | `too-many-requests` | `danger.reset_token_limit_exceeded` + countdown (uncertain: legacy's limit is per account, the API's per client address; the meaning "try again later" fits) | `reset_password('issue')` |
| | `validation-failed` email `invalidFormat` | `danger.access_denied` (legacy's answer for a username that is not an address); or UI 001 `validation.format.email` (D18) | `reset_password('issue')` |
| `checkPasswordResetToken` | 200 | page shows the form | `reset_password('check')` |
| | `invalid-reset-token` | `login.invalid_pass_reset_token` (page state) | `reset-password.twig` |
| | `password-reset-unavailable` | `danger.password_reset_na` | — |
| `createPasswordResetWebAuthnChallenge` | errors | as `checkPasswordResetToken` | — |
| `completePasswordReset` | 200 | `success.password_changed_success` + new `auth.passwordReset.done.sessionsEnded` | `reset_password('reset')` |
| | `invalid-reset-token` | `login.invalid_pass_reset_token` (page state); `danger.invalid_reset_token` as the alert | `reset_password('reset')` |
| | `second-factor-required` | `info.awaiting_tfa_confirmation` (UI 001) | `reset_password('reset')` |
| | `second-factor-failed` | by method: `danger.totp_verification_failed`; `danger.yotp_verification_failed` ("unknown"); `danger.webauthn_verification_failed` ("unknown"). UI 001's `problem.second-factor-failed` says "start the sign-in again", which does not fit a retry | `verify_tfa_login()` |
| | `second-factor-unavailable` | UI 001 `problem.second-factor-unavailable` | — |
| | `temporary-verification-failure` | `danger.temp_error` + `selfService.dependency.yubico` | — |
| | `validation-failed` `newPassword` | `danger.password_complexity`; `preHashedPassword` new | `password_check()` |
| | confirmation differs (client) | `danger.password_mismatch` | `password_check()` |
| `applyMailboxMailSettingsBulkAction` | per item done | `success.mailbox_modified` (the item's mailbox) | `mailbox('edit', 'tls_policy')` |
| | per item refused | `danger.access_denied` | same |
| | summary, `tooMany` | UI 002 `bulk.*`, `bulk.limitReached` (`max`) | — |
| `listAppPasswords`, `getAppPassword` | errors only; 404 on a detail | `danger.app_passwd_id_invalid` (the ID from the address) | `app_passwd('details')` |
| `createAppPassword` | 201 | `success.app_passwd_added` (no placeholder) | `app_passwd('add')` |
| | `name` `required` | `danger.app_name_empty` | `app_passwd('add')` |
| | `name` `tooLong` | UI 001 `validation.tooLong`; with `stored: true` new `validation.tooLongStored` | — |
| | `password` refusals (only if D3 mirrors the typed password) | `danger.password_complexity`, `danger.password_mismatch` (client), `validation.preHashedPassword` | `password_check()` |
| `updateAppPassword` | 200 | `success.object_modified` (the app password ID) | `app_passwd('edit')` |
| | 404 | `danger.app_passwd_id_invalid` (ID) | `app_passwd('edit')` |
| | `name` `required` | `danger.app_name_empty` | — (legacy keeps the old name) |
| `deleteAppPassword` | 204 | `success.app_passwd_removed` (ID) | `app_passwd('delete')` |
| | 404 | `danger.app_passwd_id_invalid` (ID) | `app_passwd('delete')` |
| `listTemporaryAliases`, `listTemporaryAliasDomains` | errors only | common | `mailbox('get', 'time_limited_aliases')` |
| `createTemporaryAlias` | 201 | `success.mailbox_modified` (the mailbox) | `mailbox('add', 'time_limited_alias')` |
| | `domain` `notInList` | `danger.domain_invalid` (no placeholder) | same |
| | `lifetimeHours` `outOfRange` | `danger.validity_missing` | same |
| | `description` `tooLong` | UI 001 `validation.tooLong` | — |
| | `temporary-failure` `addressGeneration` | `selfService.dependency.addressGeneration` | — |
| `updateTemporaryAlias` | 200 | `success.mailbox_modified` (the alias's mailbox; legacy passes an undefined variable and prints an empty name, the app fills the mailbox) | `mailbox('edit', 'time_limited_alias')` |
| | `lifetimeHours` `outOfRange` | `danger.validity_missing` | same |
| `deleteTemporaryAlias` | 204 | `success.mailbox_modified` (the alias's mailbox, legacy's `goto`) | `mailbox('delete', 'time_limited_alias')` |
| `getPushNotificationSettings` | errors only | common | `pushover('get')` |
| `replacePushNotificationSettings` | 200 | `success.pushover_settings_edited` | `pushover('edit')` |
| | `token` `invalidFormat` (`pushoverCredential`) | `danger.pushover_token` | same |
| | `userKey` `invalidFormat` | `danger.pushover_key` | same |
| | `token` / `userKey` `secretRequired` | `danger.pushover_credentials_missing` | same meaning (`pushover('test')`) |
| | `senderPattern` `invalidRegex` | hard-coded "Invalid regex" → new `account.push.errors.invalidRegex` "Invalid regex" | `pushover('edit')` |
| | other fields | UI 001 `validation.*` | — |
| `deletePushNotificationSettings` | 204 | `success.pushover_settings_edited` (legacy uses the same key for removal) | `pushover('edit')` `delete` |
| `verifyPushNotificationSettings` | 200 `accepted: true` | hard-coded "Pushover API OK (%d): %s" (HTTP code, raw answer) → new `account.push.verify.accepted` "Pushover API OK" | `pushover('test')` |
| | 200 `accepted: false` | hard-coded "Pushover API ERR (%d): %s" → new `account.push.verify.rejected` "Pushover API ERR: {reason}" (`reason`, or without it when `null`) | same |
| | `push-notifications-not-configured` | `danger.pushover_credentials_missing` | same |
| | `temporary-failure` `pushover` | `selfService.dependency.pushover` | — |
| `getMailboxMailSettings` | errors only | common | `mailbox('get', 'delimiter_action' / 'tls_policy')` |
| `updateMailboxMailSettings` | 200 | `success.mailbox_modified` (the mailbox) | `mailbox('edit', 'delimiter_action' / 'tls_policy')` |
| | `temporary-failure` `sharedStore` | `selfService.dependency.sharedStore` (legacy `danger.redis_error` with the exception) | `delimiter_action` |
| | 412 on a single setting | the reloaded value + `problem.status.412` | — |
| `listRecentLogins` | errors only | common | `last_login('get')` |
| `clearRecentLogins` | 204 | legacy shows no message (it reloads the list) → new `account.recentLogins.cleared` "Recent logins cleared." (FR-011) | `last_login('reset')` |
| `resetActiveSyncCache` | 204 | `success.eas_reset` (the mailbox) | `mailbox('delete', 'eas_cache')` |
| | `groupware-disabled` | new `problem.groupware-disabled` | — |
| `resetGroupwareProfile` | 204 | `success.sogo_profile_reset` (the mailbox) | `mailbox('delete', 'sogo_profile')` |
| `listSieveFilters`, `listMailboxSieveFilters`, `getSieveFilter` | errors only | common | `mailbox('get', 'filters')` |
| `validateSieveScript` | valid | `add.validation_success` | `inc/ajax/sieve_validation.php` |
| | invalid result | `danger.sieve_error` (`%s` = the result's parser message); legacy's check prints the raw parser message alone | same |
| | empty script | `danger.script_empty` | same |
| `createSieveFilter` | 201 | `success.mailbox_modified` (the filter's mailbox) | `mailbox('add', 'filter')` |
| | `script` `required` | `danger.script_empty` | same |
| | `script` `sieveSyntax` | `danger.sieve_error` (`message`) | same |
| | `script` `tooLong` (`unit: bytes`) | UI 001 `validation.tooLongBytes` | — |
| | `description` `required` | `danger.value_missing` | same |
| | `kind` `notInList` | `danger.filter_type` | same |
| | mailbox not chosen (client, Mail setup) | `danger.no_user_defined` | same |
| `updateSieveFilter` | 200 | `success.mailbox_modified` (the filter's mailbox) | `mailbox('edit', 'filter')` |
| | refusals | as `createSieveFilter` | same |
| `deleteSieveFilter` | 204 | `success.delete_filter` (the filter ID) | `mailbox('delete', 'filter')` |
| `getActiveSieveScript` | `script: null` | `user.no_active_filter` | `get/active-user-sieve` |
| | `temporary-failure` `mailStore` | `selfService.dependency.mailStore` | — |

The problem-type table in `src/i18n/legacy-messages.ts` gains: `problem.current-password-incorrect`
→ `danger.access_denied`; `problem.password-reset-unavailable` → `danger.password_reset_na`;
`problem.invalid-reset-token` → `danger.invalid_reset_token`; `problem.last-second-factor` →
`danger.last_key`; `problem.second-factor-required-by-policy` → `danger.tfa_removal_blocked`;
`problem.push-notifications-not-configured` → `danger.pushover_credentials_missing`; the enumeration
and audit targets above. `LEGACY_ARGS` gains the `%s` sources of the success keys (the mailbox, the
own username, the app password or filter ID).

#### Part 3: deviations needing a decision

The plan's four, confirmed:

- **D2 (plan 2) Recovery-related reset messages**: confirmed. Legacy also answers a username that is
  not an address with `danger.access_denied`; the API answers the same acknowledgement for every
  well-formed request. Administrators can still see the legacy reasons in the audit log (failure
  reasons above).
- **D3 (plan 1) App password creation and renewal**: confirmed, with additions: legacy's typed
  password field carries `data-hibp` (create and edit), so mirroring it also brings the
  haveibeenpwned check; with server generation, the renewal action can keep legacy's own label
  `edit.generate` instead of a new "Generate new password".
- **D4 (plan 4) Pushover tab label**: confirmed. Note that the fields keep the `user.pushover_*` keys
  in the own context and the `edit.pushover_*` keys in the mailbox context, whose en-gb texts differ
  ("Consider the following sender email addresses" / "Only consider …", "Match senders by the
  following regex" / "Consider the following sender regex").
- **D5 (plan 3) Validity at creation**: confirmed, and legacy has a key for exactly this field:
  `user.alias_select_validity` ("Period of validity"). The legacy button "Generate random alias, 1
  year" then becomes `user.alias_create_random` alone.

Found while mapping:

- **D1 Hub structure versus legacy tabs**. The conventions say a legacy tab becomes one section,
  never several (decided for UI 003). Legacy has General (overview, webmail, protocols, profiles,
  guide link, active filter link, Authentication: password, recovery e-mail, 2FA, FIDO2; plus recent
  logins), Details (aliases, send-as), Settings (tagging, TLS, quarantine (UI 006), ActiveSync and
  SOGo resets), Spam aliases, App passwords, Pushover. The plan splits General into six sections,
  Settings into Mail settings and Devices, adds Mail app setup and Filters, and adds group headings
  and one-line summaries legacy lacks. Options: mirror the tabs (each with its own address, FR-006
  still met), or approve the split (then the titles and group headings above apply). FR-008's
  "Temporary aliases" naming is superseded either way (`user.spam_aliases`).
- **D6 Mailbox context of mail settings, Pushover and bulk TLS**. Legacy edits tagging and TLS in
  the Mailbox tab of the edit-mailbox page (UI 003 shows them read-only "until UI 005") and Pushover
  in its `#mpushover` tab (UI 003's Pushover section, read-only "until UI 005"). The conventions say
  such fields become editable there. The plan adds separate routes `mailbox-mail-settings` and
  `mailbox-push-notifications`. Also: the edit page shows no TLS warning; legacy's bulk TLS is four
  menu actions without confirmation, the plan has one dialog with "unchanged / on / off" and a
  confirmation. Decide: UI 003's sections become editable (and the bulk menu mirrors the four
  actions), or the plan's routes and dialog.
- **D7 haveibeenpwned on the own password**: settled by the conventions (owner, 2026-10-18), listed
  so the spec's parity row ("Dropped") and FR-111 wording are corrected and the own-password task
  includes `HibpCheck`. Legacy's forced-change modal and reset page have no `data-hibp`, so no check
  there.
- **D8 Policy marking and generator where legacy has none**: legacy lists the policy only under
  `data-hibp` fields, without met / not-met marking; `#ChangePWModal` and the reset page have no
  policy list and no generator. FR-022, FR-025, FR-030 and FR-039 add them (texts would be legacy
  keys, but the live state is new).
- **D9 Own password: messages, field order, administrators**. (a) Legacy's success messages are
  role-specific (`success.mailbox_modified`, `success.domain_admin_modified`,
  `success.admin_modified`); the plan announces `success.password_changed_success`, legacy's reset
  message. (b) Legacy order is new password, confirmation, then the current password; the plan puts
  the current password first. (c) Administrators change their password in legacy on the
  edit-administrator page with `edit.password` / `edit.password_repeat` and no current password; the
  plan gives them the pwChangeModal form (the API requires the current password). (d) "Sign out my
  other sessions" and the post-change summary are new elements (FR-026).
- **D10 Second-factor actions**: legacy offers one select (`tfa.set_tfa`, options in the order Yubico
  OTP, WebAuthn, TOTP, Deactivate); the plan offers explicit actions in the order TOTP, security key,
  "Other methods" › Yubico OTP, and renames "Deactivate" / "Disable TFA" to "Turn off two-factor
  authentication". Mirroring keeps the legacy labels and order (`tfa.none`, `tfa.delete_tfa`). FR-055's
  link from `user.tfa_info` to App passwords is an addition.
- **D11 Second-factor list content**: legacy shows only each entry's name and marks the entry used for
  this sign-in by colour; the plan adds type, state, the Yubico public ID and a "used for this
  sign-in" text (FR-043, FR-116). Display of data legacy never shows.
- **D12 Security key failures**: legacy shows `tfa.error_code` + the browser's error + `tfa.reload_retry`;
  the plan has plain-language texts per error (R11, FR-049), all new.
- **D13 App password list and explanations**: legacy has selection with mass activate, deactivate and
  remove, and an ID column; the plan offers per-item actions only, drops ID, adds the creation date
  (data the legacy list never shows), offers deletion on the detail page (conventions keep it in the
  list), and adds explanations beyond `user.app_hint` (FR-067) and a no-protocol warning (FR-061).
- **D14 Overview additions**: display name, recovery address and last password change are shown
  elsewhere in legacy (allowed with those keys), but the counts of app passwords, temporary aliases
  and push state are not; the storage sentence "256 MiB of 1 GiB used (25 %)" rewords legacy's
  "used / quota" and percentage; FR-074's tagging example from the mailbox's own address rewords the
  fixed `user.tag_help_example`.
- **D15 Externally managed password and clearing the recovery address**: legacy hides the
  Authentication block without explanation; the plan shows a notice (new string). Legacy clears the
  recovery address by saving an empty field; an explicit "Remove" action would be an addition.
- **D16 Filters shown to users and administrators; Pushover senders**: legacy shows a mailbox user only
  the active script (`#userFilterModal`), not the administrators' filters (FR-089 adds them);
  administrators have no active-script panel in legacy (mailbox context adds it). Pushover senders
  are one comma-separated line in legacy (its label says "comma-separated"); the plan uses a textarea
  with one address per line.
- **D17 Reset page additions**: legacy shows only the two password fields; the plan adds the account
  address, the link validity, the policy rules and the signed-in warning (FR-039, FR-042).
- **D18 Reset request field**: legacy asks for `login.username` in a text field; the plan uses an
  e-mail field. Keep `login.username` as its label, or use `login.email` ("Email address") as UI 001
  does on the mailbox-user sign-in. Same choice for the invalid-format message (`danger.access_denied`
  as legacy, or `validation.format.email`).
- **D19 Webmail texts**: the help that opening webmail signs the browser out of the classic interface
  (FR-099) and the blocked-tab notice are new; legacy has neither.
- **D20 Recent logins**: legacy shows the service code as stored (the plan translates it with
  `selfService.service.*`), "Web/EAS/Internal (address)" for internal addresses (the plan: "internal"),
  "App" for a deleted app password (the plan: "deleted app password"), and confirms clearing with
  `user.delete_ays` (the plan adds that the classic list is cleared too). Recommended: codes and
  legacy texts verbatim. The domain administrator's UI-login clearing is dropped (FR-085), confirm.
- **D21 Compositions**: legacy composes several labels from a key and literal text: the validity
  actions (`user.expire_in` + " 1 " + `user.hour`, …), the periods ("2 " + `user.weeks`), the reset
  confirmations (`user.eas_reset` + "?"), "Generate random alias, 1 year", the message count, the
  placeholder list after `edit.pushover_vars` + ": ". Confirm that reproducing legacy's composition
  is mirroring, not "joining a legacy string with other text"; the alternative is one new string per
  label, which would leave mailcow's translations.
- **D22 Filter list and default orders**: legacy's mass-remove confirmation for filters says
  `user.eas_reset` + "?" ("Reset ActiveSync device cache?"), a legacy bug; the app uses
  `footer.delete_these_items` (a legacy text whose meaning does not fit is replaced, conventions).
  Default orders differ: legacy sorts filters by ID, newest first (the plan: by mailbox) and
  temporary aliases by "Valid until", latest first (the plan: by creation, newest first).
- **D23 Filter form**: legacy enables "Add" only after a successful "Validate" and disables it again
  when the script changes; the edit page has a single "Validate and save". The plan makes the check
  optional and validates on save. Legacy's create and edit forms order the fields differently
  (mailbox, type, description, script, active / description, type, script, active). FR-094's warning
  that names the filter to be deactivated is new; `add.activate_filter_warn` is the legacy text.
- **D24 SOGo reset acknowledgement**: the tick box is a confirmation step legacy lacks (conventions:
  no confirmation legacy lacks); legacy's help `user.sogo_profile_reset_help` already states the
  irretrievable deletion.
- **D25 Mail app setup**: legacy offers four links in two rows (with and without an app password);
  the plan offers two choices and an "Include a new app password" option. Legacy shows the
  app-password row to every mailbox user (neither the template nor `app_passwd('add')` checks the
  `app_passwds` flag); the API and FR-104 require the flag, so the row is hidden without it. The
  plan's note "for iPhone, iPad and Mac" duplicates legacy's "for an Apple device"; recommended to
  drop it. The in-app guide itself is a screen without a legacy counterpart (allowed).

#### Decisions on the deviations (implementation, 2026-10-19)

Settled by `docs/conventions.md` ("Translations and forms", the orchestrator's decisions of
2026-10-18) and legacy parity. Where the conventions say a deviation "is not built until the owner
or orchestrator decides", the element is left out and listed as an open deviation below; it is cheap
to add once approved. The conventions override the earlier spec, research and task texts, so the
end-to-end tests assert these decisions.

| # | Decision |
|---|---|
| D1 | Sections keep their own addresses (FR-006): legacy's modals (password, recovery e-mail, second factors) and tabs (spam aliases, app passwords, Pushover) each become one section. The Settings tab stays **one** section, `user.mailbox_settings`, with tagged mail, TLS and the two groupware resets in legacy order (no separate "Devices" section; `/account/devices` is not created, the mailbox context's resets live in the same section). The hub lists the sections flat in legacy order, without group headings or summaries; the overview block (General's overview and the Details tab) leads it for mailbox users. Recent logins, the active Sieve script (legacy link `user.show_sieve_filters`) and Mail app setup are sections of their own. |
| D2 | Kept: one acknowledgement for every request (API behaviour); new `auth.passwordReset.requested`. |
| D3 | Kept: the server generates app passwords, shown once (spec clarification, conventions "Secrets"); renewal is labelled `edit.generate`. Mirroring the typed password with `HibpCheck` stays possible (open question 1). |
| D4 | `edit.pushover` as the title in both contexts; fields use the `user.pushover_*` keys in the own context and the `edit.pushover_*` keys in the mailbox context, as legacy. |
| D5 | Kept: the validity is chosen at creation, labelled `user.alias_select_validity`. |
| D6 | Mailbox context: decided with UI 003's final action areas (see "Mailbox context" below). Bulk TLS mirrors legacy's four quick actions (`mailbox.tls_enforce_in` / `mailbox.tls_enforce_out` × `mailbox.activate` / `mailbox.deactivate`) without a confirmation, sending each mailbox's `mailSettingsVersion`. |
| D7 | `HibpCheck` on the own-password form's new password (conventions). |
| D8 | Kept: the policy rules (legacy `admin.password_policy_*` texts) marked met or not met, and the generator, on every new-password form (FR-022, FR-025). |
| D9 | Role-specific success messages as legacy (`success.mailbox_modified` / `success.domain_admin_modified` / `success.admin_modified`); legacy field order (new password, repeat, then the current password with the app-password hint); one form for every role. "Sign out my other sessions" and the result lines stay (new strings). |
| D10 | The method choice keeps legacy's label `tfa.set_tfa` and order (Yubico OTP, WebAuthn, TOTP, `tfa.none`) as one action per option instead of a select that navigates on change (WCAG 3.2.2); no "Other methods" grouping. Turning off uses `tfa.none` and the dialog `tfa.delete_tfa`. Forced setup keeps the owner's passkey first, then legacy's tab order (TOTP, WebAuthn, Yubi OTP). |
| D11 | The list shows the name, the type (legacy method names), "inactive" (`mailbox.inactive`), "no longer supported" and "used for this sign-in" as text (legacy's colour, FR-116). The Yubico public ID is not shown (open). |
| D12 | Kept: plain-language WebAuthn failure texts (new strings), because legacy's raw browser error names are not usable text. |
| D13 | Legacy's list: selection with `mailbox.activate`, `mailbox.deactivate`, `mailbox.remove` (one request per item), columns ID, `user.app_name`, `user.allowed_protocols`, `user.active`, `user.action`; no creation date; deletion only in the list; only `user.app_hint` as explanation. The no-protocol warning stays (an outcome warning of the spec's edge case). |
| D14 | Storage as legacy ("used / quota", "∞" when unlimited, the percentage in the bar), the message count as legacy, the last password change and the recovery address with their legacy labels; no display name and no counts; `user.tag_help_example` verbatim. |
| D15 | Kept: the external-password notice (new string). The recovery address is cleared by saving an empty field, as legacy; no extra "Remove" action. |
| D16 | Not built (open): the administrators' filters in the user's own view (legacy shows only the active script) and an active-script panel in the mailbox context. Pushover senders are one comma-separated line, as legacy. |
| D17 | Kept: the signed-in warning (the reset ends this session, FR-042). Not built (open): the account address and the link validity on the reset page; the policy rules follow D8. |
| D18 | `login.username` as the label of an e-mail field; client check `validation.format.email`. |
| D19 | Kept: the blocked-tab notice (behaviour, not help). Not built (open): the "signs you out of the classic interface" help. |
| D20 | Service codes as stored; "Web/EAS/Internal ({address})" and "App" as legacy (new strings equal to legacy's hard-coded texts); clearing confirmed with `user.delete_ays`; empty list `user.no_record`. The period menu (composed as legacy), the service filter and paging stay. |
| D21 | Accepted: compositions legacy makes itself are reproduced exactly (same key, literal and order). |
| D22 | Filters remove with `footer.delete_these_items`. Default orders: filters by creation, newest first (the contract has no ID sort; IDs grow with creation); temporary aliases by "Valid until", latest first. |
| D23 | Legacy's form: create = mailbox, type, description, script, active, with `add.validate` enabling `admin.add` after a successful check (disabled again on a change); edit = description, type, script, active with `edit.validate_save`. The activation note is `add.activate_filter_warn` (no named warning). |
| D24 | No acknowledgement box: the SOGo reset is confirmed like legacy (`#ConfirmDeleteModal`, `user.sogo_profile_reset` + "?"); its help already states the deletion. |
| D25 | Legacy's two rows of profile links (the second row with `user.with_app_password` only with `appPasswds`); no "for iPhone, iPad and Mac" note. The in-app guide is a screen without a counterpart and stays. |

Open deviations (not built, listed for the owner): D3 (typed app password), D11 (Yubico public ID),
D16 (administrators' filters for the user, active-script panel for administrators), D17 (account
address and link validity on the reset page), D19 (webmail help).


**Deviations needing a decision** (found at planning time):

1. **App password creation and renewal**: the legacy add modal and edit page let the user type a
   password twice or generate one in the browser (`user.password`, `user.password_repeat`,
   `user.generate`; `edit.password`, `edit.password_repeat`, `edit.generate`). The plan creates
   the password on the server and shows it once (R14), which drops those fields.
   `AppPasswordCreateRequest` and `AppPasswordPatch` both accept an optional `password`, so the
   legacy fields could be mirrored.
   Decision: keep server generation, or mirror the legacy fields.
2. **Recovery-related reset messages**: legacy reports `success.recovery_email_sent` ("Recovery
   email sent to %s") and `danger.password_reset_invalid_user`. API 005 deliberately answers the
   same way for every account, so these outcomes cannot occur and the confirmation is a new string.
   Confirm that this stays (spec parity row "Dropped").
3. **Temporary alias validity at creation**: legacy creates an alias valid for one year and changes
   the validity afterwards (`user.expire_in`). The plan adds the validity choice to creation (R15).
   It is an added field labelled with the legacy keys; confirm it is accepted as an improvement.
4. **Pushover tab label**: the user page hard-codes "Pushover API" (no key). The app uses the
   edit-mailbox tab key `edit.pushover` ("Pushover") on both screens.

## API dependency and gaps

This feature depends on **mailcow-rest-v2 feature 005** (contract authored in commit `4a8401e`,
amended up to `3207925`), and on the contracts of features 001 (identity, sessions, passkeys,
second-factor step, audit log), 002 (audit target filters, bulk outcome types) and 003 (mailbox list
and detail). The pin is in [contracts/README.md](./contracts/README.md). The spec's "Amendment" rows
are API 005 FR-080 ("must keep a second factor", capabilities `account`), FR-081 (temporary-alias
domains), FR-082 (Apple connection profile) and FR-083 (client configuration); the spec's table is
updated accordingly.

Gaps and observations found while planning:

1. **AG1 – Bulk TLS version tag (blocks FR-019 for US7-AS7)**: `applyMailboxMailSettingsBulkAction`
   compares each target's `version` with the mailbox's **mail-settings** tag (API research R15), but
   UI 003's mailbox list exposes only the mailbox `etag`. The UI must send each item's version as
   listed (conventions, FR-019), which would make every item `outdated`. **Proposed to
   mailcow-rest-v2**: accept the mailbox `etag` as `version` for `setTlsEnforcement` (TLS
   enforcement is stored in the mailbox row that this tag covers), or add the mail-settings tag to
   `Mailbox`. **Default applied**: the bulk TLS task depends on the fix being in the pinned contract;
   the UI does not omit the version. Everything else in US7 proceeds.
2. **AG2 – No read of a Sieve filter by its ID alone (affects UI 014 row M31)**: every filter
   operation needs the mailbox in its path, and `GET /sieve-filters` has no `id` filter, so the
   classic `/edit/filter/{id}` cannot be mapped to UI 005's filter detail
   (`/filters/:mailbox/:filterId`). **Proposed**: an `id` query filter on `GET /sieve-filters` or a
   top-level `GET /sieve-filters/{sieveFilterId}`. **Default**: UI 005's route keeps the mailbox
   segment; UI 014 maps M31 to `/filters` until the gap is closed. Not blocking for UI 005.
3. **AG3 – Recent-login services are an open string** (observation): `RecentLogin.service` and the
   `service` filter document their values only in prose. The UI offers the documented codes as filter
   options and shows unknown codes as sent (R17). **Proposed**: list known values (an open
   enumeration) in the contract.
4. **AG4 – Stale descriptions** (observation): `PendingAction` and `docs/problems.md`
   `pending-action-required` still say that a password change happens in the legacy UI and that
   only a passkey resolves `secondFactorSetup`. **Proposed**: describe the routes that API 005
   opens in restricted sessions.
5. **AG5 – QR code format** (observation): `OwnTotpEnrolment.qrCode` is an SVG data URI, which the
   web app's strict CSP cannot load as an image; the UI renders an allowlisted subset (R10).
   **Proposed**: document that the SVG uses only `svg`, `rect`, `g` and `path`.
6. **AG6 – Per-object history** (observation): self-service audit records carry the object's ID only
   in `details`, so History on one app password, alias or filter filters by target type and mailbox
   (R22). Acceptable under FR-108 ("that mailbox or object").
7. **AG7 – Reset token in access logs — resolved for generated links**: API gap G27 changed
   `RESTV2_PW_RESET_PAGE` to `/ng/reset-password#token={token}`. Verified in API
   `config/restv2.php` and the running maildev API configuration on 2026-10-20. The fragment
   never reaches a server. The UI accepts old query links too, and the `ng-mailcow` image logs
   the path without query or Referer. An operator choosing a legacy query-based link must still
   account for the upstream proxy's logging; this change does not rewrite upstream nginx logs.

## Owner-level questions (defaults applied)

1. **Webmail forwarding when the app address is the bare start page** (FR-100): a mailbox user who
   opens a bookmark of `/ng/` while signed out arrives at sign-in with `returnTo=/`. **Default**: the
   home address counts as the front door, so the app forwards to webmail; any other address counts
   as a deep link and is opened instead. Changing this is one condition in
   `src/app/session/landing.ts`.
2. **Releasing UI 005 without bulk TLS if API gap AG1 is still open at implementation time**:
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
│   └── query/{client.ts,keys.ts}     # + exported dispatchProblemReactions(), permission-flag-required reaction; new key roots
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
│   │   ├── validity.ts  recent-login-period.ts  totp.ts  qr-svg.ts  webmail-forwarding.ts  list-state.ts
│   │   ├── api/{capabilities,password,second-factors,recovery-email,overview,webmail,client-setup,
│   │   │        app-passwords,temporary-aliases,mail-settings,push-notifications,recent-logins,groupware}.ts
│   │   ├── composables/{useAccountContext,useSectionAccess,useTotpEnrolment,useSecurityKeyEnrolment,
│   │   │                useWebmailHandOff,useProfileDownload}.ts
│   │   ├── components/
│   │   │   ├── layout/{AccountLayout,SectionNav,SectionCard,ReadOnlyNotice,MailboxContextHeader}.vue
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
│   ├── api-keys/pages/ApiKeyCreatePage.vue   # uses the promoted OneTimeSecretDialog and useSecretRequest
│   ├── api-keys/components/ApiKeySecretDialog.vue   # removed (promoted to shared)
│   └── mailboxes/{sections.ts,routes.ts,components/display/ManagedSettingsGroup.vue,
│                  components/list/MailboxBulkActions.vue,bulk.ts}   # UI 003 action areas: entries only
├── shared/
│   ├── components/{OneTimeSecretDialog,CopyButton,GroupedSecret,MailboxSearchPicker}.vue
│   ├── components/ConfirmDialog.vue  # + requireAcknowledgement (UI 002 has requireTyped)
│   ├── components/password/{PasswordField,PasswordPolicyHints}.vue   # moved from UI 003
│   ├── components/password/NewPasswordFields.vue
│   ├── password/{generate.ts,policy-rules.ts}                         # moved from UI 003
│   ├── platform/download.ts          # canonical download helper (conventions)
│   └── composables/{useSecretRequest,usePerItemRunner}.ts
└── i18n/
    ├── index.ts                      # + cs-cz and sk-sk plural rules
    ├── problems.ts                   # + parameters of the 005 problem types and rule codes
    ├── coverage.json                 # UI 002's manifest: + 005 values
    └── messages/{en-gb,cs-cz,sk-sk}.json   # new strings only; legacy keys are used verbatim
scripts/
├── i18n/{lib.mjs,check.mjs}       # plural-form check for new strings
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
- **UI 002**: `useBulkSelection`, `BulkActionBar`, `BulkResultSummary`, `ConfirmDialog` with
  `requireTyped`, `EditableSection` with changed-value marking, `HistoryLink` and the audit log's
  `targetType`/`targetId` filters, `useLeaveGuard`, `formatBytes` and `src/i18n/coverage.json`
  (UI 002 D2, D21, D22). Legacy texts come from UI 001's legacy translation layer (runtime `/lang/`
  loader, `en-gb` snapshot, formatter) and `SanitizedHtml.vue`, not from UI 002's `stripMarkup`
  import (constitution IV 1.3.0).
- **UI 003**: the mailbox detail (`mailbox-detail`, `/mailboxes/:address`) with its section list
  (`sections.ts`, `MailboxSectionNav.vue`, child routes in `routes.ts`), `ManagedSettingsGroup.vue`
  with the optional `to` of its FR-040 entries, the bulk menu `MailboxBulkActions.vue` with `bulk.ts`,
  and `PasswordField.vue`, `PasswordPolicyHints.vue`, `password/generate.ts` and
  `password/policy-rules.ts`, which UI 005 moves to `src/shared/` (UI 003 R4, R19, data-model §8).
- **UI 004**: `src/shared/validation/utf8.ts` and the promoted `DomainPicker`, the pattern of
  `MailboxSearchPicker`.
- **API 005**: merged contract (pin) for the mock-based work; a running implementation in the dev
  stack for the smoke suite.

Names follow `docs/conventions.md` ("Shared building blocks and canonical names"). When a named
piece is missing at implementation time, the task that needs it creates it at the location given in
research R1 with the behaviour the earlier plan describes, never as a renamed or feature-local copy.

## Complexity Tracking

No new violation. UI 001's two recorded deviations still apply unchanged: default brand colours
until API 013, and the smoke suite as a non-blocking CI job until mailcow-rest-v2 runs its
implementation in the dev stack.


### Maildev staging validation, 2026-10-20

The US1–US4 increment retains the owner's previously authorized alias-list performance exception
for maildev: final runs score 74–77 against 80. The other nine configured URL assertions pass,
including My account at 87–90 performance/100 accessibility and sign-in at 213,656 transferred
script bytes against 215,040. The full Lighthouse command still exits 1 for aliases; it is not
reported as entirely green. No performance, accessibility, payload or throttling limit changed.
See the quickstart validation log for the 30 measurements and remaining feature scope.
