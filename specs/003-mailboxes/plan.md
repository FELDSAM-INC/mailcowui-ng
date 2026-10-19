# Implementation Plan: Mailboxes

**Branch**: `main` (no feature branches, constitution 1.1.0) | **Date**: 2026-10-18 |
**Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-mailboxes/spec.md`

## Summary

UI feature 003 replaces the classic interface's mailbox tab, the add-mailbox modal, the edit
mailbox page and the mailbox templates tab and pages. Administrators and domain administrators:

- list, search, filter, sort and page through the mailboxes in their scope, as cards on phones and
  as a table with optional columns on wide screens;
- open a mailbox on an overview with a section navigation;
- create mailboxes on one screen from templates, with the domain's quota figures, a secure password
  generator and live password-policy hints;
- edit a mailbox section by section (General, Sign-in and password, Protocol access, Permissions,
  Tags, Custom attributes), each section saving only its changes with the version it read;
- delete a mailbox after a confirmation built from the API's deletion preview;
- rename a mailbox with an explicit alias choice and a persistent report for incomplete renames;
- apply bulk actions to up to the server's bulk limit with one result per mailbox;
- manage mailbox templates. Domain administrators read them.

Domain administrators see only their domains' mailboxes, and their permission flags make controls
read-only or absent. Mailbox users get UI 001's "no access" state.

The technical approach is UI 001's foundation. This feature adds no runtime dependency. Details are
in [research.md](./research.md).

- **Contract**: the pin moves to a mailcow-rest-v2 commit with the complete API 003 contract
  (planning baseline `3207925`, R1). Because such a pin carries every later feature's enumeration
  values too, the translation check is scoped to the values each UI feature translates (R2).
- **Screens**: lazy routes under `/mailboxes` and `/mailbox-templates`. The detail is a layout
  route with one child route per section, so every section has its own link (R5).
- **Server state**:
  - TanStack Query keys under `['mailboxes', …]`, `['mailbox-templates', …]` and
    `['password-policy']`, with the invalidation table of data-model §3;
  - the detail renders at once from the list entry;
  - the capabilities read supplies every limit and server setting, and nothing is hard-coded
    (R16).
- **Editing**: each section page wraps its fields in UI 002's `EditableSection`, driven by one
  composable, `useMailboxSection`, over UI 001's `useVersionedSave` and UI 002's `changedSince`
  marking. It sends JSON Merge Patches with only the changed members. An outdated
  save keeps the user's input and marks what changed (R6).
- **Passwords**:
  - the generator uses `crypto.getRandomValues` with rejection sampling, at least 16 characters,
    the required classes, and no look-alike characters;
  - the policy hints are evaluated with the API's own definitions;
  - passwords never reach a cache, storage, the address or a log (R8).
- **Reuse** (R4):
  - UI 001's list state, dialogs, problem forms, announcer and storage wrapper;
  - UI 002's shared blocks under their canonical names (`docs/conventions.md`, "Shared building
    blocks and canonical names"): `useBulkSelection`, `BulkActionBar`, `BulkResultSummary`,
    `ConfirmDialog` with `requireTyped`, `EditableSection`, `HistoryLink`, `useLeaveGuard`,
    `formatBytes`, `NotFoundPage` with its back link, and the `src/i18n/coverage.json` registry;
  - promoted from UI 002's feature as their second use: `QuotaField`, `UsageMeter` and
    `TagSetInput`, plus the audit log's `ActiveFilterChips`.
- **Tests**:
  - Vitest units for every pure module (`patch`, `create-request`, `quota`, `acl`, `validation`,
    `problems`, `bulk`, `deletion`, the generator and the policy rules);
  - component tests;
  - Playwright end-to-end tests of every acceptance scenario on 360 px and desktop, with axe in
    both themes, against the contract-validated mock with a 10,000-mailbox scenario;
  - a smoke suite against the API's dev stack.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict) and Vue 3.5 SFCs; Node.js 24 LTS (UI 001).

**Primary Dependencies**: unchanged from UI 001 R1 (`vue` 3.5.44, `vue-router` 5.4.0,
`@tanstack/vue-query` 5.104.4, `pinia` 4.1.0, `vue-i18n` 11.4.16, `reka-ui` 2.11.0, `clsx`,
`tailwind-merge`, `openapi-fetch` 0.17.0, `dompurify`). **No new runtime dependency.** The tooling
is unchanged (UI 001 R2).

**Storage**: none on a server. In the browser: the query cache, plus one convenience key,
`localStorage` `mailcowui-ng.mailboxes.columns` for the chosen list columns (data-model §4).

**Testing**: UI 001 R22–R25 apply unchanged:

- Vitest with jsdom and Vue Test Utils;
- Playwright projects `mobile-chromium` (360 × 780), `desktop-chromium` (1366 × 900) and
  `mobile-webkit`, against the production build with the production CSP and the Node mock server;
- in every test: axe in both themes, CSP and contract-violation detection, horizontal-scroll and
  touch-target checks;
- the `smoke` project against the mailcow-rest-v2 dev stack.

**Target Platform**: as UI 001: the two latest major versions of evergreen browsers, including iOS
Safari and Chrome for Android, served by the `ng-mailcow` image under `/ng/`.

**Project Type**: web application. A static single-page frontend; the backend is mailcow-rest-v2.

**Performance Goals**:

- SC-003: the first list page visible within 2 s on a mid-range phone for a server with 10,000
  mailboxes. Lighthouse mobile performance of at least 0.8 on `/ng/mailboxes` with the 10,000
  scenario is the automated proxy, and T130 is the manual check.
- SC-001: find and open a mailbox among 10,000 within 10 s.
- The initial JavaScript stays at most 200 KB gzipped. Every route of this feature is a lazy chunk.

**Constraints**:

- Only contract operations are used (21, listed in [contracts/README.md](./contracts/README.md)).
- Strict CSP, so no inline style or script, and no banned Reka viewports.
- WCAG 2.2 AA in both themes.
- Usable at 360 px and 320 px.
- No password anywhere but component memory.
- Limits come from the capabilities read.
- Every language mailcow ships. Legacy texts verbatim by their legacy keys, and the screens mirror
  the classic interface's forms; new strings complete in en-gb, cs-cz and sk-sk (constitution IV
  1.3.0, "Translations and forms" below).

**Scale/Scope**:

- 9 user stories (4 at P1, 3 at P2, 2 at P3).
- 15 routes (12 mailbox routes, 3 template routes).
- 21 operations (16 of API 003, 2 of API 002, 3 of API 001).
- Up to 10,000 mailboxes in 500 domains, and tens of templates.
- Legacy keys for every element with a classic-interface equivalent; new strings only for the
  rest, counted in the legacy form map (T008a).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Gate | Status |
|---|---|---|
| I. The API contract is the only interface | Only the 21 listed operations are used, through the generated client. The pin is bumped deliberately with the bump script and a review of the used operations (R1). No hand-written API types: form and view models derive from generated types, and list parameters alias generated operation types (data-model §1–§2). The capabilities read replaces the spec's former gaps. The remaining gaps are reported to mailcow-rest-v2 and never worked around: untyped audit details are rendered generically (R17). Errors are handled from `type`, `errors`, `requiredFlags`, `holder`, `count`/`limit`, `dependency` and `steps` ([contracts/README.md](./contracts/README.md)). | PASS |
| II. Mobile-first | Every screen is designed and tested at 360 px first. Lists are cards below `md` and tables from `md` up. Filters and sorting sit in a panel over the list. Bulk selection uses an explicit selection mode at every width, 44 × 44 targets and, on phones, a sticky bar. The long create form is one screen with collapsed groups, not a modal or wizard (clarification). Detail editing is split into sections. Destructive and high-risk actions are confirmed with their impact: the deletion preview, the typed count for bulk deletion, the template deletion's effect, and one confirmation for deactivating a mailbox. Loading, empty and error states use `ListState` and UI 002's `NotFoundPage`. | PASS |
| III. Accessibility (WCAG 2.2 AA) | axe runs on every screen, dialog and state in both themes. Sortable headers expose `aria-sort`. Usage bars, statuses, policy marks and bulk outcomes have text equivalents. Dialogs trap and return focus, and the delete dialog focuses "Cancel". The error summary receives the focus. Announcements use UI 001's live regions. A keyboard-only pass is part of Polish (T125). | PASS |
| IV. i18n and branding | Every language mailcow ships. Every element with a classic-interface equivalent uses the legacy key verbatim, loaded at runtime from the installation, with `en-gb` as the fallback and no hand-written value for a missing translation (R3). The screens mirror the legacy forms listed in "Translations and forms" below; new strings exist only for elements without a legacy equivalent, in en-gb, cs-cz and sk-sk. `acl.pw_reset` and `edit.force_pw_update_info` are shown verbatim, the latter's placeholder filled with the product name from `GET /public-config`, as legacy fills it with `ui_texts.main_name`. The built-in source option, which the legacy template hard-codes, also takes the product name from branding. Sizes use binary units, and numbers and dates use the locale. Translation completeness is enforced. The scoping of open enumerations (R2) follows `docs/conventions.md`, and unknown values always show translated generic labels. | PASS |
| V. Security in the browser | The column choice is the only new storage key. It is a convenience and is allowlisted (data-model §4). Passwords live only in component state: requests that carry one go through UI 001's `useSecretRequest` and never through TanStack Query (conventions "Secrets in requests or responses"), no draft of these forms is saved, fields are cleared after submit and on unmount, and nothing goes into the address, title or logs (R8, SC-009 test T126). API text (names, tags, attributes, template names) is rendered as text, with no `v-html`. Gates are a convenience, and every refusal is handled (R11). | PASS |
| VI. Test-first | `tasks.md` puts tests before implementation in every phase. Every pure module has unit tests. Every acceptance scenario has an end-to-end test on both viewports against the contract-validated mock. SC-008's 10,000 passwords per policy are a unit test. Smoke tests cover each story against the real API. | PASS |
| VII. Performance budgets | Lazy route chunks. No new dependency. A third Lighthouse collection on `/ng/mailboxes` with 10,000 mailboxes (R20). Queries are cached with explicit invalidation, and the detail reuses the list entry (FR-017). There are no automatic refetches and no polling: no query has a `refetchInterval` (UI 001 R9, conventions "Polling"). | PASS |
| VIII. Simplicity | No new runtime dependency. Shared blocks are reused or promoted only at their second use (R4). The domain picker and the password field stay in the feature, with promotion paths. Later features extend named components instead of a plug-in registry (R19). | PASS |
| Technology constraints | Only the stack of the constitution. Native `<select>` for selects. Reka `Combobox` without its viewport for the domain picker. No new TailAdmin primitive: UI 003 uses only those UI 001 copied (alert, badge, checkbox, collapsible, combobox, dialog, dropdown menu, radio group, switch, table). | PASS |
| Workflow and gates | It depends on UI 001, UI 002 and API 003 (below). Every merge gate of UI 001 R28 applies. Commits go to `main`. | PASS |
| `docs/conventions.md` | "The classic interface" wording; passkeys in the deletion impact. List state in the address, with page sizes 25, 50 and 100; the spec's page-size storage is aligned to this rule. Cards and tables; list states. Bulk: explicit selection mode, current page only, cleared on change, `BulkTarget` with version, one result per item, refused, outdated and failed items kept, "outcome unknown" without a retry. Section editing with changed fields and the version read; outdated saves keep the input and mark changes, without a merge or overwrite. Confirmations: the delete preview, typed counts for bulk deletion, one confirmation for other risky actions. Secrets: the generated password is shown in the field, never stored. History through UI 001's audit log screen. Translated problem types and rule codes. Gated controls read-only or hidden. Entry points into UI 002, and designated action areas for later features (R19). Limits from the capabilities read. | PASS |

**Post-design re-check (after Phase 1)**: PASS. The data model, contracts README and quickstart
introduce no violation. These decisions touched gates:

- The page size is not stored, against the spec's FR-008 wording, because conventions "Lists" and
  UI 002 forbid it. The spec is aligned (owner question 1).
- History opens the audit log screen instead of an embedded list (conventions, VIII).
- External authentication sources are offered from the capabilities read, which FR-024 allows once
  the contract reports them (I).
- Password requests go through UI 001's `useSecretRequest` and never pass through the query cache
  (V, conventions "Secrets").
- Refused, outdated and failed bulk items stay selected (orchestrator decision on owner question 2;
  conventions "Bulk actions").
- Deactivating one mailbox, or disallowing its login, asks one confirmation (conventions
  "Confirmations"); the spec is aligned.
- Shared blocks use UI 002's canonical names; nothing is created under a second name.

## Translations and forms (constitution IV 1.3.0)

The owner rule of 2026-10-18 (`docs/conventions.md`, "Translations and forms") applies to every
screen of this feature and overrides earlier text in this plan, the spec, research and tasks.

- **Legacy forms mirrored** (paths under `../mailhosting/data/web/`):
  - mailbox list → `templates/mailbox/tab-mailboxes.twig`, with the columns, row actions, "Toggle
    all" and mass actions of `draw_mailbox_table()` in `js/site/mailbox.js` (`lang` is
    `lang_mailbox` there);
  - create screen → the `#addMailboxModal` of `templates/modals/mailbox.twig`, with the password
    policy and generator of `js/build/013-mailcow.js` and `js/site/pwgen.js`;
  - mailbox detail → `templates/edit/mailbox.twig` through `edit.php`. Its tabs, in order:
    "Mailbox" (`edit.mailbox`), "Custom attributes" (`edit.custom_attributes`), "Pushover"
    (`edit.pushover`, UI 005), "ACL" (`edit.acl`), "Rate limit" (`edit.ratelimit`, UI 006) and
    "Rename" (`edit.mailbox_rename`). Fields that later features own (sender ACL and external
    sender addresses for UI 004, relayhost for UI 009, tagging, quarantine notification and
    category and TLS policy for UI 005 and 006) keep their legacy place in the "Mailbox" section
    when those features add them;
  - mailbox templates → `templates/mailbox/tab-templates-mbox.twig` and `draw_templates_mbox_table()`
    in `js/site/mailbox.js`, the `#addMailboxTemplateModal` of `templates/modals/mailbox.twig`, and
    `templates/edit/mailbox-templates.twig`;
  - deletion and bulk confirmations → `#ConfirmDeleteModal` of `templates/modals/footer.twig`
    (`footer.confirm_delete`, `footer.delete_these_items`);
  - messages → the `success.*`, `danger.*` and `warning.*` keys that `mailbox('add' | 'edit' |
    'delete', …)` returns for mailboxes, templates and renames in `inc/functions.mailbox.inc.php`,
    and the password checks of `password_check()` in `inc/functions.inc.php`. Examples:
    `success.mailbox_added`, `success.mailbox_modified`, `success.mailbox_removed`,
    `success.mailbox_renamed`, `success.template_added`, `success.template_modified`,
    `success.template_removed`, `danger.mailbox_invalid`, `danger.is_alias_or_mailbox`,
    `danger.max_mailbox_exceeded`, `danger.mailbox_quota_exceeded`,
    `danger.mailbox_quota_left_exceeded`, `danger.unlimited_quota_acl`,
    `danger.password_complexity`, `danger.password_mismatch`, `danger.template_exists`,
    `warning.quota_exceeded_scope`.
- **Elements without a legacy counterpart** get new strings in en-gb, cs-cz and sk-sk, never
  machine-translated, and kept minimal: the deletion preview's impact lines (passkeys among them),
  the bulk result summary, outdated-version handling, the incomplete-rename report, failed
  creation follow-up steps, the list filters and column chooser the classic interface lacks, the
  pre-hashed password notice, the "password rules unavailable" notice, and History.
- **Deviation-free rule**: these screens add, drop, rename, reword or reorder nothing relative to
  the legacy forms above, except the conventions' improvements (sections with their own save,
  typed confirmations, bulk mode, outdated-version handling). Labels, help and info texts
  (`*_info`), placeholders, option labels, units, order and grouping, column headers, action labels
  and the success, warning and danger messages come from the legacy keys those templates,
  `js/site/mailbox.js` and `inc/functions.mailbox.inc.php` use. Every language mailcow ships is
  supported. Legacy values are loaded at runtime from the installation and shown verbatim, HTML
  ones (`user.tag_help_explain`, `edit.allow_from_smtp`) through `SanitizedHtml.vue`. A missing
  key falls back to `en-gb`, never to a hand-written value.
- **Messages**: R17's problem and rule-code table maps each outcome to the legacy key of the same
  meaning first, and to a `mailboxes.problem.*` new string only where legacy has none (for example
  `outcome-unknown`, the rename steps, `temporary-failure` per dependency).
- **Legacy form map**: below (T008a, 2026-10-19). The orchestrator's decisions of 2026-10-18
  (`docs/conventions.md` "Decisions on the deviations", "Detail pages", "Outcomes", "No
  confirmation legacy lacks", the haveibeenpwned check, "The domain's Default mailbox quota") settle
  deviations 1–6 and 9 below, and the API settles 7 and 8 (part 3).
- **Deviations needing a decision** (the spec's parity table marks them "Improved" or "Dropped";
  under the rule they wait for the owner or orchestrator):
  1. **Detail grouping**: the plan splits the legacy "Mailbox" tab into General, Sign-in and
     password, Protocol access and Tags sections, and calls the "ACL" tab Permissions. The rule
     asks for one section per legacy tab, in the legacy order and with the legacy field order
     (authentication source, full name, tags, quota, …, active, force password update, force 2FA,
     SOGo access). R5's per-section routes and the US3 and US5 tasks follow whichever grouping is
     decided.
  2. **Password repeat**: legacy's add and edit forms have "Confirmation password"
     (`add.password_repeat`, `edit.password_repeat`, `danger.password_mismatch`). The spec drops
     it for a show/hide control. Restoring it needs no API change, because the comparison is
     client-side.
  3. **Quota units**: legacy enters quotas in MiB (`add.quota_mb`, `edit.quota_mb`, "0 = ∞"). The
     plan uses UI 002's `QuotaField` with a MiB, GiB or TiB select and an "Unlimited" switch (UI 002
     research D12, spec clarification on quotas). This is shared with UI 002 and needs one decision
     for both.
  4. **haveibeenpwned check** (`footer.hibp_check`): **decided by the owner (2026-10-18): kept as
     in legacy** (constitution 1.4.0). This feature creates the shared `HibpCheck` component that
     `docs/conventions.md` describes, with the CSP `connect-src` entry for
     `https://api.pwnedpasswords.com`, on the mailbox add and edit password fields.
  5. **Rename alias choice**: legacy offers "Create alias automatically" (`edit.mailbox_rename_alias`,
     checked by default). FR-049 requires an explicit yes or no answer. Mirroring legacy means the
     preselected checkbox.
  6. **ACL flags grouped**: the plan groups the 15 permission switches under headings legacy does
     not have (legacy: one multi-select in the `acl.*` order). Mirroring legacy means the legacy
     order without new headings.
  7. **"Allowed hosts for SMTP"** (`edit.allow_from_smtp`, shown in legacy when the
     `smtp_ip_access` ACL is set): the API offers no such field. A legacy field the API does not
     support (gap to raise in mailcow-rest-v2, or an approved drop).
  8. **Mass removal of templates**: legacy can remove several templates at once; the API has no bulk
     template action (spec: "Dropped").
  9. **Added explanations**: the plan adds help texts the legacy form lacks (the status effect, the
     domain figures on the create screen, the external-source reasons). They are new strings and
     need approval as improvements, or are left out.

### Legacy form map, part 1: fields and elements

Legacy keys are read at runtime from the installation's `/lang/` files: `lt()` and
`<LegacyText k>` in the screens (values with markup, `user.tag_help_explain` and
`user.tag_help_example`, through `<LegacyText>` and its sanitiser), `legacy()` in route titles and
column tables, and `LEGACY_TEXTS` for keys built at runtime (statuses, sort fields, field labels by
field name, frames, audit targets). Texts the classic templates hard-code are new strings whose
English text equals legacy's (marked "hard-coded").

**Mailbox list** (`/mailboxes`) ← `templates/mailbox/tab-mailboxes.twig`, `js/site/mailbox.js`
`draw_mailbox_table()` (`lang` = `lang_mailbox`).

| Element | Legacy key |
|---|---|
| title, navigation entry | `mailbox.mailboxes` |
| actions | `mailbox.add_mailbox`, `admin.refresh`, `mailbox.toggle_all` (select all on the page in selection mode), `mailbox.quick_actions` |
| search label, loading, empty, no match | `datatables.search`, `datatables.loadingRecords`, `datatables.emptyTable`, `datatables.zeroRecords` |
| columns shown by default (legacy's visible columns, in legacy order) | `mailbox.username`, `mailbox.domain_quota` (used / total, "∞" for unlimited, sorted by the storage used as legacy sorts it), `mailbox.last_mail_login` (one line per allowed protocol, "IMAP @ …", "POP3 @ …", "SMTP @ …", and "SSO @ …", labels hard-coded; empty value `user.no_record`; the column is left out when the server does not report last logins), `mailbox.last_pw_change` ("-" when never set, as legacy), `mailbox.in_use` (bar with the percentage; legacy's 75 % and 90 % classes), `mailbox.msg_num`, `mailbox.active` (✓, ✗, "—" with the status text for assistive technology), `mailbox.action` |
| further columns (legacy's row details, offered by the column chooser) | `mailbox.fname`, `mailbox.domain`, `mailbox.iam` (the built-in source is the product name from branding, as the fork hard-codes it; others "Keycloak", "Generic-OIDC", "LDAP" hard-coded), `mailbox.tls_enforce_in`, `mailbox.tls_enforce_out`, "SMTP", "IMAP", "POP3", "SIEVE", "EAS", "DAV" (hard-coded), `mailbox.quarantine_notification` (`user.never`/`hourly`/`daily`/`weekly`), `mailbox.quarantine_category` (`user.q_reject`, `user.q_add_header`, `user.q_all`), `mailbox.created_on`, `mailbox.last_modified`, `add.tags` (legacy hard-codes "Tags"; `add.tags` has the same meaning) |
| row actions | `mailbox.edit`, `mailbox.remove` |
| mass actions, group "Mailbox" | `mailbox.mailbox`: `mailbox.activate`, `mailbox.disable_login`, `mailbox.deactivate`, `mailbox.remove` |
| mass actions, group "Allowed protocols" | `mailbox.allowed_protocols`: per protocol "IMAP", "POP3", "SMTP", "Sieve", "ActiveSync (EAS)", "CalDAV/CardDAV (DAV)" (hard-coded) with `mailbox.activate` / `mailbox.deactivate`; left out for a domain administrator without `protocolAccess` |
| mass actions of later features | TLS (UI 005), quarantine notification and category (UI 006) |
| deletion and mass-deletion confirmation | `footer.confirm_delete`, `footer.delete_these_items`, `footer.delete_now`, `footer.cancel` |
| new strings (no legacy element) | `mailboxes.list.count`, the filters panel and chips (`mailboxes.filters.*`), the column chooser (`mailboxes.columns.*`), the sort control on phones (`mailboxes.sort.quotaUsed`; the other sort labels are the column keys through `LEGACY_TEXTS`), the empty scope (`mailboxes.empty.*`), the deletion preview's impact lines (`mailboxes.delete.*`), the bulk confirmation texts and outcome summary (`mailboxes.bulk.*`, UI 002's `bulk.*`) |

**Add mailbox** (`/mailboxes/new`) ← `templates/modals/mailbox.twig` #addMailboxModal, behaviour
`js/site/mailbox.js` (`auto_fill_quota`, `#addMailboxModal` show, `setMailboxTemplateData`),
`js/build/013-mailcow.js` (generate, haveibeenpwned, password policy). One form, in legacy order.

| Element | Legacy key |
|---|---|
| page title | `mailbox.add_mailbox` |
| Username (left part) / Full name | `add.mailbox_username` (with the `@domain` suffix and the normalised address) / `add.full_name` |
| Domain (searchable select of the primary domains in scope) | `add.domain` |
| Template (Default first and applied; another template replaces the values without asking) | `mailbox.template` |
| Password, "generate" | `add.password`, `add.generate` (fills both fields and shows them, as legacy) |
| haveibeenpwned check under the password | `footer.hibp_check`, `footer.loading`, `footer.hibp_ok`, `footer.hibp_nok` (shared `HibpCheck`) |
| password policy under the check | `admin.password_policy_length` (minimum), `admin.password_policy_chars`, `admin.password_policy_numbers`, `admin.password_policy_special_chars`, `admin.password_policy_lowerupper`, each as legacy lists them (`- rule`) |
| Confirmation password | `add.password_repeat` |
| Tags | `add.tags` |
| Quota (MiB), the "max." badge, "0 = ∞" | `add.quota_mb`; "max. {n} MiB" and "0 = ∞" are hard-coded (`mailboxes.quota.max`, `mailboxes.quota.unlimitedHint`); `add.select_domain` before a domain is chosen; `warning.quota_exceeded_scope` when the domain has no quota left (the quota is then fixed at 0, as legacy disables it) |
| tagged mail | `user.tag_handling`: `user.tag_in_subfolder`, `user.tag_in_subject`, `user.tag_in_none`; help `user.tag_help_explain`, `user.tag_help_example` |
| quarantine notification | `user.quarantine_notification`: `user.never`, `user.hourly`, `user.daily`, `user.weekly`; help `user.quarantine_notification_info` |
| quarantine category | `user.quarantine_category`: `user.q_reject`, `user.q_add_header`, `user.q_all`; help `user.quarantine_category_info` |
| encryption policy (two toggles) | `user.tls_policy`: `user.tls_enforce_in`, `user.tls_enforce_out` |
| allowed protocols (multi-select) | `edit.allowed_protocols`; options "IMAP", "POP3", "SMTP", "Sieve", "ActiveSync", "CalDAV/CardDAV" (hard-coded) |
| ACL (multi-select, legacy order) | label "ACL" (hard-coded); options `acl.spam_alias`, `acl.tls_policy`, `acl.spam_score`, `acl.spam_policy`, `acl.delimiter_action`, `acl.syncjobs`, `acl.eas_reset`, `acl.sogo_profile_reset`, `acl.pushover`, `acl.quarantine`, `acl.quarantine_attachments`, `acl.quarantine_notification`, `acl.quarantine_category`, `acl.app_passwds`, `acl.pw_reset` (verbatim, the installation's product name included); only the permissions the API returns for the caller |
| rate limit | `acl.ratelimit`, placeholder `ratelimit.disabled`, frames `ratelimit.second`/`minute`/`hour`/`day`, help `edit.mbox_rl_info` |
| status (select) | `add.active`, `add.disable_login`, `add.inactive` |
| Force password update + help | `edit.force_pw_update` + `edit.force_pw_update_info` (`%s` = product name from branding) |
| Force 2FA + help | `tfa.force_tfa` + `tfa.force_tfa_info` |
| SOGo access + help (only when the groupware is enabled) | `edit.sogo_access` + `edit.sogo_access_info` |
| action | `admin.add` |
| controls a domain administrator's flags do not allow | shown read-only with `acl.prohibited` and the flag's label (`acl.protocol_access`, `acl.sogo_access`, `acl.ratelimit`), as legacy's `data-acl="0"` controls |
| authentication source | not on the classic add form (hidden `authsource=mailcow`): the app adds no field and creates `mailcow` mailboxes, as legacy |
| new strings | `mailboxes.create.loadFailed` (load step), `mailboxes.creationReport.*` (failed follow-up steps legacy reports only in its log) |

**Mailbox page** (`/mailboxes/:address`) ← `templates/edit/mailbox.twig` through `edit.php`; the
tabs become sections in legacy order. Deletion stays in the list, as in legacy.

| Element | Legacy key |
|---|---|
| page title, with the address as subtitle (and its readable form when the domain is an IDN) | `edit.mailbox` |
| usage figures (display-only, the list's keys) | `mailbox.domain_quota`, `mailbox.in_use`, `mailbox.msg_num`, `mailbox.last_mail_login` (as the list), `mailbox.last_pw_change` |
| History (administrators) | UI 002's `history.link` |
| section "Mailbox" (tab #medit) | `edit.mailbox` |
| Identity provider (select) | `admin.iam`; options: the product name (built-in), "Keycloak", "Generic-OIDC", "LDAP" (hard-coded), from `MailboxCapabilities.authSources` plus the mailbox's own source |
| Full name / Tags | `edit.full_name` / `add.tags` |
| Quota (MiB), "max." badge, "0 = ∞" | `edit.quota_mb`, `mailboxes.quota.max` from `largestAllowedQuota`, `mailboxes.quota.unlimitedHint` |
| Allow to send as, external sender addresses | UI 004 adds them in their legacy positions |
| Sender-dependent transports (read-only until UI 009; only with `mailboxRelayhost` or for administrators) | `edit.relayhost`; none: `edit.none_inherit`; value "ID n"; help `edit.mailbox_relayhost_info` |
| tagged mail, quarantine notification, quarantine category, encryption policy (read-only until UI 005 and UI 006) | the keys of the add form above, value as the selected option |
| Password, "generate", check, policy, Confirmation password (only for the built-in source) | `edit.password` (placeholder `edit.unchanged_if_empty`), `edit.generate`, `HibpCheck`, the policy keys, `edit.password_repeat` |
| Password recovery email + help (only for the built-in source) | `edit.password_recovery_email` + `admin.password_reset_info` |
| allowed protocols | `edit.allowed_protocols` with the options above; read-only with `acl.prohibited` + `acl.protocol_access` |
| Allowed hosts for SMTP | hidden in legacy (`<div hidden>`): not shown |
| status (select) | `edit.active`, `edit.disable_login`, `edit.inactive` |
| Force password update / Force 2FA / SOGo access, with help | as the add form, with `edit.*`; SOGo access read-only with `acl.prohibited` + `acl.sogo_access`, left out without the groupware |
| save, times | `edit.save`; `edit.created_on`, `edit.last_modified` (`user.never` when never) |
| section "Custom attributes" (tab #mattr) | `edit.custom_attributes`; columns `user.attribute`, `user.value`; `admin.remove_row`, `admin.add_row`, `admin.save` |
| section "Pushover" (tab #mpushover, read-only until UI 005) | `edit.pushover`; `edit.active` with yes or no |
| section "ACL" (tab #macl) | `edit.acl`; the multi-select of the `acl.*` options above, the permissions the API returns; `edit.save` |
| section "Rate limit" (tab #mrl, read-only until UI 006) | `edit.ratelimit`; `acl.ratelimit`, value and frame (`ratelimit.*`), `ratelimit.disabled` when the mailbox has none of its own; help `edit.mbox_rl_info` |
| section "Rename mailbox" (tab #mrename, "⚠️" as legacy's tab) | `edit.mailbox_rename`; `edit.mailbox_rename_warning`, checkbox `edit.mailbox_rename_agree`, then `edit.mailbox_rename_title` (prefilled with the local part, `@domain` suffix), checkbox `edit.mailbox_rename_alias` (checked), `edit.save` |
| new strings | `mailboxes.detail.*` (page states), `mailboxes.rename.report.*` (the incomplete-rename report legacy cannot produce) |

**Mailbox templates** (`/mailbox-templates`) ← `templates/mailbox/tab-templates-mbox.twig`,
`js/site/mailbox.js` `draw_templates_mbox_table()`.

| Element | Legacy key |
|---|---|
| title, navigation entry | `mailbox.mailbox_templates` |
| add (administrators) / refresh | `mailbox.add_template` / `admin.refresh` |
| search label, loading, empty, no match | `datatables.search`, `datatables.loadingRecords`, `datatables.emptyTable`, `datatables.zeroRecords` |
| columns | "ID" (hard-coded, UI 002's `domainTemplates.fields.id`), `mailbox.template`, `mailbox.domain_quota`, `mailbox.tls_enforce_in`, `mailbox.tls_enforce_out`, "SMTP", "IMAP", "POP3", "SIEVE", "EAS", "DAV", "SOGO" (hard-coded), `mailbox.force_tfa`, `mailbox.active`, `mailbox.action`; details `mailbox.quarantine_notification`, `mailbox.quarantine_category`, `mailbox.force_pw_update`, `edit.ratelimit` ("∞" without one), `add.tags` |
| row actions (no Remove for Default) | `mailbox.edit`, `mailbox.remove` |
| mass removal (administrators) and its confirmation | `mailbox.toggle_all`, `mailbox.remove`; `footer.confirm_delete`, `footer.delete_these_items`, `footer.delete_now`, `footer.cancel` |
| new strings | `mailboxTemplates.list.count`, the sort control (UI 002's `domainTemplates.sort.*`), `mailboxTemplates.delete.keepValues` (US7-AS6), page states |

**Add template** (`/mailbox-templates/new`, administrators) ← `templates/modals/mailbox.twig`
#addMailboxTemplateModal: `mailbox.add_template` (title), `mailbox.template` (name), `add.tags`,
`edit.quota_mb` + "0 = ∞", the tagged mail, quarantine, encryption policy, allowed protocols, ACL
and rate limit groups of the add mailbox form, then `edit.active` / `edit.disable_login` /
`edit.inactive`, `edit.force_pw_update` + info, `tfa.force_tfa` + info, `edit.sogo_access` + info
(with the groupware), action `admin.add`. The form starts with `MailboxCapabilities.templateDefaults`
(G32) and sends every value it shows.

**Edit template** (`/mailbox-templates/:id`) ← `templates/edit/mailbox-templates.twig`: title
`edit.title` with the template name, back link `edit.previous`, the same fields as the add form
(name read-only for Default), save `edit.save`. Domain administrators read the values without a
form.

### Legacy form map, part 2: messages

| API outcome | Legacy key (placeholder source) |
|---|---|
| `createMailbox` 201 | `success.mailbox_added` (the new address) |
| creation report steps legacy cannot report | new strings `mailboxes.creationReport.rateLimit`, `.taggedMailHandling`, `.groupwareDirectoryUpdate` |
| `updateMailbox` 200 | `success.mailbox_modified` (address) |
| `deleteMailbox` 204 | `success.mailbox_removed` (address) |
| `renameMailbox` 200 | `success.mailbox_renamed` (previous address, new address) |
| `createMailboxTemplate` 201 / `updateMailboxTemplate` 200 | `success.template_added` / `success.template_modified` (template name) |
| `deleteMailboxTemplate` 204 | `success.template_removed` (template ID, as legacy passes it) |
| `address-in-use`, holder `mailbox` or `resource` / `alias` / `temporaryAlias` | `danger.is_alias_or_mailbox` / `danger.is_alias` / `danger.is_spam_alias` (the address) |
| `mailbox-limit-reached` | `danger.max_mailbox_exceeded` (`count`, `limit`) |
| quota `outOfRange` with `limit: maxMailboxQuota` / `domainQuotaLeft` / `largestAllowedQuota` | `danger.mailbox_quota_exceeded` / `danger.mailbox_quota_left_exceeded` / `danger.mailbox_quota_exceeded` (`max` in MiB) |
| quota above the maximum, before sending | `danger.mailbox_quota_exceeded` (the maximum in MiB) |
| unlimited quota without the flag (`attribute-not-permitted` on `quota`, or 0 typed) | `danger.unlimited_quota_acl` |
| `localPart` / `newLocalPart` `invalidFormat` (client or API) | `danger.mailbox_invalid` |
| `password` `tooShort` or `missingCharacterClass` | `danger.password_complexity` |
| the two password fields differ (client) | `danger.password_mismatch` |
| `tags` `tooMany` | `mailboxes.problem.tagLimit` (new: legacy's `tag_limit_exceeded` is missing from the language files) |
| `mailbox-template-name-exists` | `danger.template_exists` (the name as typed) |
| empty template name (client) | `danger.template_name_invalid` |
| `attribute-not-permitted` on other fields | `acl.prohibited` with the flag's `acl.*` label, on the field |
| `mailbox-not-renamable` | new string (legacy answers `danger.access_denied`, whose meaning does not fit) |
| `domain-alias-limit-reached`, `mailbox-rename-incomplete`, `outcome-unknown`, `temporary-failure` per dependency, `mailbox-template-protected`, outdated (412), gone (404) | new strings (no legacy equivalent) |

### Legacy form map, part 3: deviations

Settled by the orchestrator's decisions (2026-10-18) and applied:

1. **Detail grouping**: one section per legacy tab, in legacy order (Mailbox, Custom attributes,
   Pushover, ACL, Rate limit, Rename). The spec's General, Sign-in, Protocol access and Tags
   sections, their routes and summaries, and the separate Delete section are not built. Sections
   open for editing with UI 002's `?edit=<section>` parameter, so each has its own link.
2. **Password repeat**: restored on the add and edit forms (`danger.password_mismatch` before
   sending). The spec's show/hide and copy controls replaced it and are not built.
3. **Quota units**: MiB with "0 = ∞" everywhere; no unit select and no "Unlimited" switch. The
   create form always sends a quota, prefilled from the chosen template and capped at the domain's
   `usage.maxNewMailboxQuota` (owner decision on the domain's default quota).
4. **haveibeenpwned**: kept, as the shared `HibpCheck`.
5. **Rename alias choice**: legacy's checkbox, checked by default; no extra confirmation.
6. **ACL**: legacy's multi-select in legacy order, without headings.
9. **Added explanations**: not built (status effects, domain figures, inactive and backup-MX
   notes, external-source reasons, the hidden-permissions note, the pre-hashed notice, "rules
   unavailable", live policy marks, "Add another mailbox", collapsed groups and their summaries,
   the template-overwrite confirmation, the deactivation confirmation of the single form).

Settled by the API:

7. **Allowed hosts for SMTP**: always hidden in legacy (`<div hidden>`), so it is not shown.
8. **Mass removal of templates**: `applyMailboxTemplateBulkAction` (G39) makes it possible; built.

Still open (listed for the owner, nothing built): none.

## Dependencies

UI 003 is implemented **after UI 001 and UI 002**. It is built and tested against the mock from the
pinned API 003 contract. The smoke tasks, and the final pin, need the API 003 implementation merged
in mailcow-rest-v2 (research R1).

| Dependency | What UI 003 needs from it |
|---|---|
| **UI 001** (planned, `specs/001-sign-in-app-shell/`) | The whole foundation: the generated client behind `@/api`, query client and key factory, router, guards, catalogue and `NoAccessState`, the shell, i18n with its legacy translation layer (runtime `/lang/` loader, `en-gb` snapshot, formatter) and `i18n:check`, `useListState`, `ListState`, `PaginationBar`, `useConfirm` and `ConfirmDialog`, `useVersionedSave`, `useProblemForm`, `FormField`, `ErrorSummary`, `ProblemMessage`, `useAnnouncer`, `DateTime`, `RelativeTime`, `PageHeader`, `useMediaQuery`, the clipboard and storage wrappers, the audit log screen, the mock server, the validator and the end-to-end fixtures, the smoke harness and the Lighthouse runner. |
| **UI 002** (planned, `specs/002-domains/`) | The domain queries, with `listDomains` and `getDomain` exported from `@/features/domains`, and the domain mock handlers and factory. Its shared blocks, under the canonical names of `docs/conventions.md`: `useBulkSelection`, `BulkActionBar`, `BulkResultSummary`, `ConfirmDialog` with `requireTyped`, `EditableSection` with the `changedSince` extension of `useVersionedSave`, `HistoryLink` with the audit target filters, `useLeaveGuard`, `formatBytes`, `NotFoundPage` with its back link, `meta.roles`, and the coverage registry `src/i18n/coverage.json`. Its feature-local `QuotaField`, `UsageMeter` and `TagSetInput`, which UI 003 promotes to `src/shared/` (T016, T017). UI 002's domain detail page and domain list, where UI 003 adds its entry points (T124). |
| **API 003** (mailcow-rest-v2) | The contract is merged (baseline `3207925`), so T001 can pin it and the UI can be built against the mock. The implementation must be merged before the smoke tasks, and T001's pin then moves forward to the merge commit (pins only move forward). |
| **API 002, API 001** | Implemented before API 003 (API plan). The domains, identity, branding and audit target filters. |

## API dependency and gaps

This feature depends on **mailcow-rest-v2 feature 003** (with 002 and 001), pinned as
[contracts/README.md](./contracts/README.md) describes.

**Spec gaps closed by the contract**:

API 003's orchestrator added these capabilities after this spec recorded its gaps. They are used,
and the spec's API Dependency section is aligned:

- gap 1, the allowed authentication sources: `getMailboxCapabilities.authSources` and
  `identityProviderType`;
- gap 2, webmail disabled: `groupwareEnabled`;
- gap 3, last logins turned off: `lastLoginsReported`;
- gap 4, the deletion impact and retention: `previewMailboxDeletion` and
  `garbageRetentionMinutes`;
- gap 5, operator-configured limits: `bulkLimit`, `taggingLimit`, `tagMaxLength` and the
  custom-attribute limits;
- gap 6, the tags in use: `listMailboxTags`.

**Remaining gaps, to be specified in mailcow-rest-v2.** The UI does not work around them:

- **A. Audit record details are untyped.** `AuditEvent.details` is `additionalProperties: true`.
  The members of mailbox records are documented only in API 003 research R22: `changes` with the
  old and new value of each field, `passwordSet`, `preHashed`, `previousAddress`, `newAddress`,
  `bulkRequestId` and `steps`.
  - **Proposed**: a documented details schema per event family, at least `changes` as
    `{ <field>: { old, new } }` with the field names of the resource schema.
  - **Until then**: History shows the details through UI 001's generic renderer, with translated
    key labels. Values stay raw, for example quota in bytes rather than "1 GiB" (US9-AS1 is met at
    that level).
  - UI 002 FR-063 (old and new quota in the user's units) depends on the same change.
- **B. The recognised hash-scheme prefixes are not enumerated.** The contract names
  `{BLF-CRYPT}` and `{SSHA512}` only as examples. Legacy accepts 25 schemes.
  - **Proposed**: list them in `MailboxCreateRequest.password`, or expose them in the
    capabilities.
  - **Until then**: the pre-hashed notice appears for any `{SCHEME}` prefix. It is a hint, and the
    API decides (R8).
- **C. The built-in template defaults are not readable.** They are server settings "with the
  upstream values" (`MailboxCreateRequest`), so an operator can change them.
  - **Proposed**: add them to the mailbox capabilities.
  - **Until then**: a new template's form starts with the documented upstream values, and the
    create request sends every value explicitly, so the stored template equals what the form showed
    (R14).
- **Observation, not blocking**: `BulkTarget.version` is "the value of the object's ETag, without
  quotes", while `Mailbox.etag` is "equal to the `ETag` header", which carries quotes. The UI strips
  the quotes for bulk targets, as UI 002 does (R12). **Proposed**: state the quoting of `etag`
  members in the contract.
- **Observation, not blocking**: the mailbox representation does not say whether a password hash is
  stored. The sign-in section therefore shows the hint "required if the mailbox has no password
  stored" whenever the source is switched to the built-in one (FR-036). The API's `required`
  refusal names the field.

**Coordination with UI 002**: UI 002's plan defines the translation coverage registry and the shared
blocks, and `docs/conventions.md` makes its names canonical. UI 003 imports them, and promotes only
the blocks UI 002 keeps inside its feature (R4).

## Owner-level questions (defaults applied)

1. **Page size memory**: FR-008 and FR-074 ask that the page size be remembered in the browser.
   `docs/conventions.md` ("List state … lives in the page address and never in browser storage")
   and UI 002 forbid it, and the conventions win where specs disagree.
   - **Default**: the page size lives in the address only, so links, Back and reloads keep it. The
     column choice is still remembered in the browser. The spec text is aligned.
   - If the owner wants a remembered default page size, the conventions must change first.
2. **Outdated items after a bulk action**: **decided by the orchestrator**. `docs/conventions.md` is
   binding over the earlier clarification, so refused, outdated and failed mailboxes stay selected,
   and outdated ones are retried with the version of the reloaded list. The spec records this as a
   superseding clarification.

## Parity notes added by the plan

The spec's parity tables are complete. The plan changes or adds the following, and the analysis
applied them to the spec's tables:

1. **SOGo access hidden when webmail is disabled**: now **Matched**, because the capabilities report
   `groupwareEnabled`. It was "Blocked by API gap 2".
2. **Identity provider select and hidden authentication source**: external sources are offered when
   the server has a provider configured, at creation as well. Legacy's add form offers none. This is
   **Improved**, and was "Blocked by API gap 1".
3. **Delete confirmation**: shows the numbers from the deletion preview (aliases deleted and kept,
   sender permissions, sync jobs, app passwords, passkeys and the others) and the actual retention
   period. **Improved**.
4. **Creation follow-up steps**: legacy reports a failed rate limit or SOGo step only as a log entry.
   The app lists failed steps after creation. **Improved**.
5. **Page length**: kept in the page address, which is how links keep it. Legacy stores it in the
   browser. **Improved**, under the conventions.
6. **Tag suggestions**: the tag filter and the tag input suggest tags in use. Legacy has none.
   **Improved**.

## Project Structure

### Documentation (this feature)

```text
specs/003-mailboxes/
├── spec.md              # Feature specification (with clarifications and parity)
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R20
├── data-model.md        # Phase 1: consumed data, form and view models, query keys, routes, validation, state machines
├── quickstart.md        # Phase 1: setup, gates and validation guide
├── contracts/README.md  # Phase 1: pin, operations used, problem handling
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

New files are marked `+`. Edited files from earlier features are marked `~`.

```text
contract/{openapi.yaml,openapi.json,VERSION.json}                 ~ bumped (T001)
src/api/generated/schema.ts                                       ~ regenerated (T001)
src/api/query/keys.ts                                             ~ mailboxes, mailbox-templates, password-policy roots
src/app/navigation/catalogue.ts                                   ~ mailboxes available; + mailboxTemplates row
src/app/router/routes.ts                                          ~ registers the feature's routes
src/shared/platform/storage.ts                                    ~ + mailcowui-ng.mailboxes.columns
src/shared/components/{QuotaField,UsageMeter,TagSetInput}.vue    promoted from src/features/domains (T016, T017)
src/shared/components/ActiveFilterChips.vue                       promoted from src/features/audit-log (T018)
src/shared/utils/{quota-units,tag-set}.ts                         promoted from src/features/domains (T016, T017)
src/shared/{components,composables}/…                             UI 002's blocks, imported only: BulkActionBar,
                                                                  BulkResultSummary, ConfirmDialog, EditableSection,
                                                                  HistoryLink, useBulkSelection, useLeaveGuard
src/shared/validation/limits.ts                                   ~ + mailbox schema limits (T020–T021)
src/i18n/format.ts                                                ~ + formatDuration (formatBytes is UI 002's) (T016)
src/i18n/coverage.json                                            ~ UI 003's values appended (T003)
src/i18n/messages/{en-gb,cs-cz,sk-sk}.json                       ~ new strings of the legacy form map only (T008a)
scripts/i18n/lib.mjs                                              ~ UI 003's closed enumerations in ENUM_NAMESPACES (T003)
scripts/run-lhci.mjs  lighthouserc.cjs                            ~ third collection /ng/mailboxes (T127)
src/features/domains/…                                            ~ entry points (T124); exports used by the picker (T045)
src/features/audit-log/…                                          ~ detail-key labels (T122); ActiveFilterChips promoted (T018)
src/features/mailboxes/                                           +
├── index.ts                    # routes; DomainPicker and link helpers for UI 002 and UI 004
├── routes.ts                   # 12 mailbox routes + 3 template routes (data-model §5)
├── api.ts                      # mailbox queries and mutations, capabilities, tags, preview, bulk, rename, policy
├── templates-api.ts            # mailbox template queries and mutations
├── list-state.ts  columns.ts  sections.ts
├── acl.ts  quota.ts  validation.ts  patch.ts  create-request.ts
├── problems.ts  bulk.ts  deletion.ts  auth-source.ts
├── password/{generate.ts,policy-rules.ts,pre-hashed.ts}
├── templates/{list-state.ts,built-in-defaults.ts,useTemplateForm.ts}
├── composables/{useMailboxSection.ts,useMailboxCreateForm.ts,useTemplateApplication.ts,
│                useMailboxBulk.ts,usePasswordPolicy.ts,useMailboxCapabilities.ts}
├── pages/{MailboxesPage.vue,MailboxCreatePage.vue,MailboxDetailPage.vue}
├── pages/templates/{MailboxTemplatesPage.vue,MailboxTemplateCreatePage.vue,MailboxTemplateDetailPage.vue}
├── sections/{MailboxOverview.vue,GeneralSection.vue,SignInSection.vue,ProtocolAccessSection.vue,
│             PermissionsSection.vue,TagsSection.vue,CustomAttributesSection.vue,RenameSection.vue,
│             MailboxDeleteRoute.vue}
└── components/
    ├── list/{MailboxList.vue,MailboxCard.vue,MailboxTable.vue,MailboxFilters.vue,MailboxSortControl.vue,
    │         ColumnChooser.vue,MailboxRowActions.vue,MailboxBulkActions.vue}
    ├── display/{MailboxStatusBadge.vue,MailboxQuotaUsage.vue,LastLogins.vue,ManagedSettingsGroup.vue,
    │            MailboxSectionNav.vue,CreationNotice.vue}
    ├── fields/{MailboxQuotaField.vue,StatusField.vue,AuthSourceField.vue,ProtocolAccessFields.vue,
    │           UserPermissionsFields.vue,InitialSettingsFields.vue,RateLimitField.vue,AclReadOnlyNote.vue,
    │           CollapsibleGroup.vue,DomainPicker.vue,TemplateSelect.vue,LocalPartField.vue,
    │           CustomAttributesEditor.vue}
    ├── password/{PasswordField.vue,PasswordPolicyHints.vue}
    ├── dialogs/{MailboxDeleteDialog.vue,RenameReport.vue}
    └── templates/{TemplateCard.vue,TemplateTable.vue,TemplateValuesGroups.vue}
tests/
├── unit/features/mailboxes/…   # mirrors src/features/mailboxes (pure modules, composables, components)
├── unit/shared/…               # promoted blocks (T012–T015)
├── unit/scripts/i18n-tools.spec.ts                               ~ scoping rule (T002)
├── mocks/handlers/{mailboxes-read,mailbox-update,mailbox-create,mailbox-deletion,mailbox-bulk,mailbox-rename,
│                   mailbox-templates,password-policy}.ts           +
├── mocks/handlers/index.ts                                       ~ registration
├── mocks/factories/{mailbox,mailbox-template,password-policy}.ts     +
├── mocks/scenarios/mailboxes/{base,list,create,edit,delete,permissions,bulk,templates,rename,
│                             history}.ts                         + (registered in scenarios/index.ts)
├── e2e/mailboxes/{list,detail,create,sections,delete,permissions-tags-attributes,bulk,templates,
│                  rename,history,entry-points,reflow-and-keyboard,storage-and-secrets}.spec.ts  +
└── smoke/{mailboxes,mailbox-create,mailbox-sections,mailbox-delete,mailbox-permissions,mailbox-bulk,
           mailbox-templates,mailbox-rename,mailbox-history}.smoke.spec.ts  +
```

**Structure Decision**: one feature directory, `src/features/mailboxes/`, holds both mailboxes and
mailbox templates. The template form shares the field groups of the create screen, and one
directory keeps those imports relative (UI 001 R3). Other features reach it only through
`index.ts`. Blocks with a second use live in `src/shared/` (R4).

## Complexity Tracking

No constitution principle is violated, so there is no entry. The inherited deviations of UI 001
still apply: default brand colours until API 013, and the smoke suite as a non-blocking gate until
the API runs its implementation in its dev stack.
