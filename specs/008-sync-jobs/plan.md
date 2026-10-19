# Implementation Plan: Sync Jobs

**Branch**: `main` (no feature branches, constitution 1.1.0) | **Date**: 2026-10-18 |
**Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-sync-jobs/spec.md`

## Summary

UI feature 008 replaces the classic interface's sync job tabs, add modals, edit page and log modal
for administrators, domain administrators and mailbox users. It delivers:

- a **list** of the jobs in the user's scope, with state, last run and last result, as cards on
  phones and a sortable table on wide screens, with search, filters and paging in the address, a
  pre-filtered entry from UI 003's mailbox detail, and an automatic refresh while a job runs;
- a sectioned **create form** whose advanced sections stay collapsed on phones, with defaults,
  limits and the custom-parameter permission from API 008's capabilities read;
- a **details screen** whose sections each have their own edit and save, with the write-only remote
  password, conflict handling and a History action;
- **activate, deactivate, schedule next run and delete**, for one job and for a selection through
  API 008's bulk operation, with per-job results;
- a **run log viewer**: full screen on phones, a large dialog on wide screens, verbatim, copyable
  and fast with 5 MB logs.

The technical approach (details in [research.md](./research.md)):

- **No new dependency.** UI 001's stack, client, query policy, mock API and test layers are used
  as they are. One feature area, `src/features/sync-jobs/`, with pure logic modules for the list
  state, presentation, form model, field messages and log view (R3).
- **Contract**: the 9 sync-job operations of API 008 plus `listMailboxes`, `listDomains`,
  `listAuditEvents` and `getIdentity`, from a pin at or after mailcow-rest-v2 commit `3207925`
  (R1).
- **Reuse** (R2): bulk selection, the bulk action bar, typed confirmation, section editing driven
  by the `edit` address parameter, the leave guard and `HistoryLink` from UI 002; the mailbox
  detail screen and its header actions from UI 003; the shared `DomainPicker` (UI 003, promoted by
  UI 004); `MailboxSearchPicker`, promoted from UI 006 at this second use; UI 006's `neutralise()`
  for the untrusted log text; the shell, list state, forms, dialogs and announcer from UI 001.
- **Server state**: new query roots `['sync-jobs', …]`; the list's only `refetchInterval`, bound to
  running jobs, visibility, selection mode, a pause control and UI 011's inactivity limit of
  `min(15 min, session idle timeout)` (R5, R7).
- **Secrets**: the remote password lives in one component `ref`, never in caches, the address,
  storage or logs, and an end-to-end test proves it (R12).
- **Log viewer**: an address parameter so Back closes it, and chunked rendering with
  `content-visibility: auto` for large logs (R17).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict) and Vue 3.5 SFCs; Node.js 24 LTS for tooling
(UI 001 plan).

**Primary Dependencies**: unchanged from UI 001 research R1/R2 (`vue`, `vue-router`,
`@tanstack/vue-query`, `pinia`, `vue-i18n`, `reka-ui`, `openapi-fetch` and the others). No runtime
or development dependency is added.

**Storage**: none on a server. In the browser: the query cache and component state. No new device
storage key; the remote password never reaches any storage (FR-033).

**Testing**: Vitest and Vue Test Utils for units and components; Playwright on `mobile-chromium`
(360 px), `desktop-chromium` and `mobile-webkit` with axe in both themes against the
contract-validated mock; a smoke spec against the API dev stack (UI 001 research R22 to R25).

**Target Platform**: as UI 001: the two latest major versions of evergreen browsers, served under
`/ng/` next to mailcow-rest-v2.

**Project Type**: web application (static single-page frontend; the backend is mailcow-rest-v2).

**Performance Goals**: a 5 MB run log readable in under 3 s on a mid-range phone and scrolling
without stalls (SC-007); initial JavaScript unchanged (lazy routes); the three page chunks plus the
log viewer under 25 KB gzipped.

**Constraints**: only contract operations; WCAG 2.2 AA in both themes; 360 px and 320 px without
horizontal scrolling; strict CSP (no inline style, no `v-html`); no automatic requests while the
user is idle beyond the bounded refresh of R7; limits and defaults never hard-coded (FR-055).

**Scale/Scope**: 6 user stories (3 at P1, 3 at P2); 3 routes and one address-driven dialog; 13
operations; every language mailcow ships, with the legacy keys of the legacy form map and new
strings in en-gb, cs-cz and sk-sk only for elements the classic interface lacks; one entry point
into UI 003.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Gate | Status |
|---|---|---|
| I. The API contract is the only interface | Only the 13 operations of [contracts/README.md](./contracts/README.md), through `@/api`. The pin is recorded in `contract/VERSION.json` and verified against the baseline (R1). No hand-written API type: form values and view models derive from generated types (data-model §2). The first draft's three API gaps are closed by the contract; none is open, and nothing is worked around. Errors come from problem `type`, rule `code` and `params` (R13). | PASS |
| II. Mobile-first | Designed at 360 px first: cards below `md`, a table from `md` up; advanced form sections collapsed on phones; the log full screen on phones; the selection bar wraps instead of scrolling; 44 × 44 px targets; a top-of-page create action (FR-048). Deleting is confirmed with the jobs named, and several deletions need the count typed. Loading, empty, no-match and error states on the list, details, pickers and log. | PASS |
| III. Accessibility (WCAG 2.2 AA) | axe in both themes on every screen and state of the end-to-end tests. State and result use icons with text; table headers with `aria-sort`; a heading per card; keyboard-scrollable log region; announced saves, deletions, summaries, copies and result counts; the automatic refresh can be paused (WCAG 2.2.2) and announces nothing on its own (R7, R8, R17). | PASS |
| IV. i18n and branding | Constitution 1.3.0: every mailcow language; the screens mirror the legacy forms of "Translations and forms" below, with mailcow's translations loaded at runtime and used verbatim by legacy key, the markup-carrying labels through `SanitizedHtml.vue`, missing keys falling back to `en-gb`; new strings under `syncJobs.*` only where legacy has none, in en-gb, cs-cz and sk-sk, never machine-translated; new contract enumerations required by `i18n:check` (R19). Locale formatting for times and numbers. No brand data. | PASS |
| V. Security in the browser | The remote password is masked, protected from autofill and saving, held in one component `ref`, sent only by create and Source saves, never stored, cached, logged or put in the address, and never sent to a third party; an end-to-end test proves it (R12). The log is rendered as text, never as HTML (R17). Hiding the entry is a convenience: `permission-flag-required`, `404` and `412` are handled (R4, R13). | PASS |
| VI. Test-first | `tasks.md` writes the mock, unit, end-to-end and smoke tests before each story's implementation. Every acceptance scenario of US1 to US6 has an end-to-end test on both viewports against the contract-validated mock; the 5 MB log and the password secrecy have dedicated tests (R20, R21). | PASS |
| VII. Performance budgets | No new dependency; lazy routes and a lazy log viewer; `budget:check` unchanged initial JS (R22). Server state cached, written from responses and invalidated after mutations; the log is fetched only when opened; the only interval is bounded by running jobs, visibility, selection, a pause control and inactivity (R5, R7). | PASS |
| VIII. Simplicity | No new dependency. Shared parts are reused from UI 001 to UI 006; `MailboxSearchPicker` is promoted at its second use. Single-use parts stay in the feature (`useRunningRefresh`, `useInactivity`, the log viewer), with UI 011 as the recorded promotion point for `useInactivity`. Only possibly-missing small shared parts are added where their owners placed them (R2). | PASS |
| Technology constraints | Stack unchanged; Reka parts without style injection; no TailAdmin Pro code; no CDN request. | PASS |
| Workflow and gates | Commits to `main`; CI gates of UI 001 unchanged; this feature names its API dependency and contract pin (R1). | PASS |
| `docs/conventions.md` | Wording ("the classic interface" where it appears). List state in the address, page sizes 25/50/100, cards and tables, list states. Bulk actions: page-only selection, one bulk request with versions as listed, per-item summary, failed/refused/outdated stay selected, "outcome unknown" without retry. Section editing with only changed fields and the read version; outdated saves keep input, reload and mark, no overwrite. Confirmations: single delete with impact, bulk delete with typed count, one explicit confirmation for deactivating (single and bulk). Secrets: write-only remote password. History via target filters, and audit labels for the four sync-job event types. Problem types and rule codes translated. Capabilities from the capabilities read. Entry point into UI 003 through its action area, shown only when UI 008 exists. | PASS |

**Post-design re-check (after Phase 1)**: PASS. The data model, contracts README and quickstart
introduce no violation. Decisions that touched gates:

- The list's `refetchInterval` is the single, bounded exception to UI 001 R9's "no interval", with
  the inactivity pause that UI 001 FR-033 and UI 011 FR-021 imply (VII, V; R7).
- The log viewer's chunked `content-visibility` rendering instead of a virtualisation library
  (VIII; R17).
- Custom parameters hidden or read-only from the capabilities read, instead of a refusal after
  submission (I, conventions; R10).

## Translations and forms (constitution IV 1.3.0)

The owner rule of 2026-10-18 (`docs/conventions.md`, "Translations and forms") applies to every
screen of this feature and overrides any earlier text in this plan, the spec, research and tasks.

**Legacy forms mirrored** (paths under `../mailhosting/data/web/`):

- **List** (administrators and domain administrators): `templates/mailbox/tab-syncjobs.twig`
  (`mailbox.sync_jobs`, `user.create_syncjob`, `admin.refresh`, the quick actions
  `mailbox.activate`, `mailbox.deactivate`, `mailbox.last_run_reset`, `mailbox.remove`,
  `mailbox.toggle_all`); `draw_sync_job_table()` in `js/site/mailbox.js` (columns ID,
  `mailbox.owner`, Server, `mailbox.last_run`, `mailbox.syncjob_last_run_result`, Log,
  `mailbox.active`, `mailbox.status`, `mailbox.excludes`, `mailbox.mins_interval`,
  `mailbox.action`; states `mailbox.running`, `mailbox.waiting`, `mailbox.inactive`,
  `mailbox.never`; results `mailbox.syncjob_EX_OK`, the six `mailbox.syncjob_EXIT_*`,
  `mailbox.syncjob_check_log`; `mailbox.open_logs`).
- **List** (mailbox users): `templates/user/Syncjobs.twig` (`user.sync_jobs`,
  `user.create_syncjob`); `draw_sync_job_table()` in `js/site/user.js` (columns `user.username`,
  `user.last_run`, `user.syncjob_last_run_result`, `user.active`, `user.status`,
  `user.encryption`, `user.excludes`, `user.interval` with "(min)", `user.action`).
- **Create**: `templates/modals/mailbox.twig` `#addSyncJobModalAdmin` (with the owner select
  `add.username`) and `templates/modals/user.twig` `#addSyncJobModal`: `add.syncjob`,
  `add.syncjob_hint`, `add.hostname`, `add.port`, `add.username`, `add.password`,
  `add.enc_method`, `add.select`, `add.mins_interval`, `edit.subfolder2`, `edit.maxage`,
  `edit.maxbytespersecond`, `edit.timeout1`, `edit.timeout2`, `add.exclude`, `add.custom_params`,
  `add.delete2duplicates`, `add.delete1`, `add.delete2`, `add.automap`,
  `add.skipcrossduplicates`, `add.subscribeall`, `add.dry`, `add.active`, `admin.add`, in that
  order.
- **Details and section editing**: `templates/edit/syncjob.twig` (`edit.syncjob` and the edit page's
  own keys: `edit.hostname`, `edit.username`, `edit.password`, `edit.encryption`,
  `edit.mins_interval`, `edit.subfolder2`, `edit.maxage`, `edit.maxbytespersecond`,
  `add.timeout1`, `add.timeout2`, `edit.exclude`, `add.custom_params`, `add.custom_params_hint`,
  `edit.delete2duplicates`, `edit.delete1`, `edit.delete2`, `edit.automap`,
  `edit.skipcrossduplicates`, `add.subscribeall`, `add.dry`, `edit.active`, `edit.save`).
- **Run log**: `#syncjobLogModal` in `templates/modals/mailbox.twig` and
  `templates/modals/user.twig`; `inc/ajax/syncjob_logs.php`.
- **Messages**: the `syncjob` cases of `mailbox('add' | 'edit' | 'delete')` in
  `inc/functions.mailbox.inc.php`: create and change → `success.mailbox_modified` (`%s` the target
  mailbox), delete → `success.deleted_syncjob` (`%s` the ID) and `success.deleted_syncjobs`;
  `danger.object_exists` (`%s` "host / user") for `sync-job-exists`, `danger.no_user_defined`,
  `danger.access_denied`.

**Screens or elements without a legacy counterpart** get new strings in en-gb, cs-cz and sk-sk
(never machine-translated), kept minimal: filters, sorts and paging controls, the running-refresh
pause control and the inactivity notice, the saved-password hint of the write-only password, the
deactivation confirmations, per-job bulk results and outdated-version handling, the log viewer's
copy and wrap controls, empty states, the custom-parameter refusals (`optionContainsSpace`,
`optionNotAllowed`: legacy reports them as untranslated English), and History labels. The
hard-coded legacy texts "Server", "Log" (column and log title) and "ID" have no key, so they are
new strings too.

**Deviation-free rule**: these screens add, drop, rename, reword or reorder nothing relative to the
legacy forms above, except the conventions' improvements (sections with their own save, typed
confirmations, bulk mode, outdated-version handling). Labels, help and info texts, placeholders,
option labels, units, order and grouping, column headers, action labels and success, warning and
danger messages come from the legacy keys. Every mailcow language is supported; legacy values are
loaded at runtime from the installation and shown verbatim, values with HTML (`edit.subfolder2`,
`edit.maxage`, `edit.maxbytespersecond`) through `SanitizedHtml.vue`, and a missing key falls back
to `en-gb`, never to a hand-written value.

**Legacy form map**: below (T004a).

**Deviations needing a decision** (found at planning time; not built until decided):

1. **Last run without a time**: legacy shows `mailbox.waiting` ("Waiting") in the last-run column
   whenever a job has no last run (never run, or cleared by "Schedule next"). Research R8 plans
   `mailbox.never` for a job that never ran and a new "Cleared, runs on the next cycle" after a
   reschedule (parity note 1).
2. **Unrecognised success code**: legacy shows `mailbox.syncjob_check_log` ("Check log") next to the
   success icon; parity note 2 plans "Success" (`mailbox.syncjob_EX_OK`) instead.
3. **Success messages**: legacy confirms a created or changed job with `success.mailbox_modified`
   ("Changes to mailbox %s have been saved") and has no "job created" text. Mirroring it is the
   default; a new string would need approval.

### Legacy form map, part 1: fields and elements (T004a)

Written before any screen was built. The owner rule 1:1 and the orchestrator's decisions in
`docs/conventions.md` ("Decisions on the deviations") settle the structure: one form per legacy
form and one section per legacy tab, legacy's field order, legacy's controls (checkboxes, a
select), no help text or section heading that legacy lacks, actions that legacy offers only in the
list stay in the list, and outcomes as legacy's alerts. They replace the seven collapsible form
sections, the inline deletion warnings, the "Simulate" explanation and the details-page actions
that the spec (FR-015 to FR-017, FR-024, FR-036) planned before the rule (see part 3). Paths are
under `../mailhosting/data/web/`.

**Sync jobs list** (`/sync-jobs`) ← `templates/mailbox/tab-syncjobs.twig` (administrators and
domain administrators), `templates/user/Syncjobs.twig` (mailbox users), `draw_sync_job_table` in
`js/site/mailbox.js` and `js/site/user.js`.

| Element | Legacy key |
|---|---|
| page title (navigation: `mailbox.sync_jobs`) | `mailbox.sync_jobs` (administrators, domain administrators) / `user.sync_jobs` (mailbox users) |
| create action (header and empty state) | `user.create_syncjob` (both tabs) |
| refresh | `admin.refresh` (the user tab lacks it; offered to every role because the automatic refresh needs a manual counterpart, conventions "Polling") |
| search label, loading, empty, no match | `datatables.search`, `datatables.loadingRecords`, `datatables.emptyTable`, `datatables.zeroRecords` |
| paging and page size | `datatables.info`, `datatables.infoEmpty`, `datatables.lengthMenu`, `datatables.paginate.*` (`PaginationBar`) |
| columns, administrators and domain administrators | "ID" and "Server" (hard-coded: new strings `syncJobs.columns.id`, `syncJobs.columns.server`), `mailbox.owner`, `mailbox.last_run`, `mailbox.syncjob_last_run_result`, "Log" (hard-coded: `syncJobs.columns.log`), `mailbox.active`, `mailbox.status`, `mailbox.action`; in the expandable details (legacy's collapsed child row): `mailbox.excludes`, `mailbox.mins_interval` |
| columns, mailbox users | "ID", "Server", `user.username`, `user.last_run`, `user.syncjob_last_run_result`, "Log", `user.active`, `user.status`, `user.action`; details: `user.encryption`, `user.excludes`, `user.interval` with the hard-coded "(min)" (`syncJobs.columns.minutes`) |
| server value | `user@host:port` (the job label, also the card heading and the accessible name of its checkbox and menu) |
| last run | the time in the user's locale; none: `mailbox.waiting` / `user.waiting` (plan deviation 1 open) |
| last run result | check or cross glyph with the hidden prefix "Succeeded:"/"Failed:" (`syncJobs.result.*`, not colour alone) + `mailbox.syncjob_<exitStatus>` / `user.syncjob_<exitStatus>` for the seven known codes, otherwise `mailbox.syncjob_check_log` / `user.syncjob_check_log` as a link to the log (FR-007); no result: nothing ("-" in legacy; plan deviation 2 open) |
| log | `mailbox.open_logs` / `user.open_logs` |
| active | `mailbox.yes` / `mailbox.no` (legacy's check and cross glyphs, rendered through `SanitizedHtml.vue`) |
| status | `mailbox.running` / `mailbox.waiting` (`user.running` / `user.waiting`) |
| excludes | the pattern in `<code>`; empty: "-" (legacy's hard-coded dash) |
| encryption values | SSL, STARTTLS, PLAIN (hard-coded: `enums.syncJobEncryption.*`) |
| row actions | `mailbox.edit` / `user.edit` (opens the job), `mailbox.remove` / `user.remove`; the menu's name is the new string `syncJobs.list.actionsFor` |
| selection mode | UI 002's `bulk.*` bar and summary; select all: `mailbox.toggle_all` |
| selection actions | administrators and domain administrators: `mailbox.last_run_reset`, `mailbox.activate`, `mailbox.deactivate`, `mailbox.remove`; mailbox users: `mailbox.activate`, `mailbox.deactivate`, `mailbox.remove` (the user tab has no "Schedule next", plan deviation 4) |
| filters, sort and automatic refresh (no legacy counterpart) | labels reuse the columns' keys: owner `mailbox.owner`, domain `mailbox.domain`, active `mailbox.active` with `mailbox.active`/`mailbox.inactive`, status `mailbox.status` with `mailbox.running`/`mailbox.waiting`, result `mailbox.syncjob_last_run_result` with `enums.syncJobLastResult.*` (`succeeded` is `mailbox.syncjob_EX_OK`); sort options are the column keys plus `add.hostname`, `add.username` and `mailbox.mins_interval`; new strings for "Filters", "Any", "Clear filters", "Sort by", the order, the match count, "Pause/Resume automatic refresh" and the inactivity notice |

**Add sync job** (`/sync-jobs/new`) ← `templates/modals/mailbox.twig` `#addSyncJobModalAdmin`
(administrators, domain administrators) and `templates/modals/user.twig` `#addSyncJobModal`
(mailbox users). One form in legacy order; nothing is cached in the browser (the user modal's
`data-cached-form` is dropped, FR-033).

| Element | Legacy key |
|---|---|
| page title | `add.syncjob` |
| notice above the form | `add.syncjob_hint` |
| owner (administrators and domain administrators only), placeholder | `add.username`, `add.select` (UI 003's `MailboxSearchPicker`; no mailbox in scope: its `datatables.zeroRecords`, so no new string) |
| host / port with its range | `add.hostname` / `add.port` and "min-max" from the capabilities (legacy's hard-coded ranges, numbers only) |
| remote username / password | `add.username` / `add.password`; reveal toggle `auth.signIn.showPassword` (UI 001) |
| encryption | `add.enc_method`, options `enums.syncJobEncryption.*`, the capabilities' `encryptions` |
| interval with its range | `add.mins_interval` |
| subfolder / maximum age / bytes per second (HTML values) | `edit.subfolder2` / `edit.maxage` / `edit.maxbytespersecond`, verbatim through `SanitizedHtml.vue`; ranges for the numbers |
| timeouts with their ranges | `edit.timeout1`, `edit.timeout2` |
| exclude | `add.exclude` |
| custom parameters, placeholder, hint | `add.custom_params`; placeholder `--some-param=xy --other-param=yx` (administrators) or `--delete2folders --otheroption` (mailbox users), literal option syntax; hint `add.custom_params_hint` (administrator modal only); hidden when the capabilities read refuses custom parameters (FR-056) |
| checkboxes, with the imapsync option in `<code>` as legacy appends it | `add.delete2duplicates` (`--delete2duplicates`), `add.delete1` (`--delete1`), `add.delete2` (`--delete2`), `add.automap` (`--automap`), `add.skipcrossduplicates` (`--skipcrossduplicates`), `add.subscribeall` (`--subscribeall`), `add.dry` (`--dry`), `add.active` |
| submit | `admin.add` |
| values | the capabilities' `defaults` (FR-018: the user modal's checked "Simulate" is the server's choice now); the port starts at the encryption's standard port and follows it until typed into (FR-019; legacy pre-fills 143) |

**Sync job page** (`/sync-jobs/:syncJobId`) ← `templates/edit/syncjob.twig`, one section with
its own edit and save (conventions "Detail pages").

| Element | Legacy key |
|---|---|
| page title, with the job label as subtitle | `edit.syncjob` |
| display-only run status (the list's data and keys) | `mailbox.owner` (not for mailbox users), `mailbox.last_run`, `mailbox.syncjob_last_run_result`, `mailbox.status` (mailbox users: the `user.*` keys), values as in the list, "Check log" as text (the log stays in the list) |
| section heading | `edit.syncjob` |
| fields in legacy order, read mode as a value list and edit mode as the form | `edit.hostname`, `add.port` (the page hard-codes "Port"; `add.port` is the same text), `edit.username`, `edit.password`, `edit.encryption`, `edit.mins_interval` + range, `edit.subfolder2`, `edit.maxage` + range, `edit.maxbytespersecond` + range, `add.timeout1` + range, `add.timeout2` + range, `edit.exclude`, `add.custom_params` + placeholder `--some-param=xy --other-param=yx` + `add.custom_params_hint`, `edit.delete2duplicates`, `edit.delete1`, `edit.delete2`, `edit.automap`, `edit.skipcrossduplicates`, `add.subscribeall`, `add.dry`, `edit.active` (with the option names) |
| booleans in read mode | `mailbox.yes` / `mailbox.no`; an empty text value reads "-" |
| write-only password (conventions "Secrets"; legacy pre-fills the stored password) | new strings `syncJobs.password.saved` ("A password is saved. Leave empty to keep it.") and `syncJobs.password.none` |
| custom parameters the caller may not change (FR-056) | read-only with the new string `syncJobs.form.customParamsRestricted` |
| save | `edit.save`; outdated handling is UI 002's `EditableSection` |
| History (administrators) | `history.link` |

**Confirmations** ← `#ConfirmDeleteModal` (`templates/modals/footer.twig`).

| Element | Legacy key |
|---|---|
| delete one job or a selection | `footer.confirm_delete`, `footer.delete_these_items` before the list of jobs (ID, label, owner), `footer.delete_now`, `footer.cancel`; new strings: "Mail that was already copied stays in the mailbox." and the running note; typed count `bulk.confirm.typeCount` for a selection |
| deactivate a selection (conventions "Confirmations") | new title `syncJobs.bulk.deactivateTitle`, the jobs listed, the note "They do not run until they are activated again." (new), confirm `mailbox.deactivate`, cancel `footer.cancel` |

**Run log** ← `#syncjobLogModal` in `templates/modals/{mailbox,user}.twig`, `inc/ajax/syncjob_logs.php`.

| Element | Legacy key |
|---|---|
| title | "Log" (hard-coded: `syncJobs.log.title`) |
| header (display-only, the list's keys) | the job label, `mailbox.owner`, `mailbox.last_run`, `mailbox.syncjob_last_run_result` (mailbox users: `user.*`) |
| text | verbatim, read-only, fixed-width; control and bidi characters as visible markers (`neutralise()`) |
| empty log | legacy shows "-"; new strings "No log yet" and "The run produced no output" (FR-045) |
| actions | new strings "Copy", "Copied", "Copying is not available", "Wrap lines"; `admin.refresh`; `common.close` |
| running notice | new string (FR-045) |

### Legacy form map, part 2: messages

| API outcome | Legacy key (placeholder) |
|---|---|
| `createSyncJob` 201 | `success.mailbox_modified` (the target mailbox), as legacy confirms an added job (plan deviation 3: mirrored) |
| `updateSyncJob` 200 (section save) | `success.mailbox_modified` (the target mailbox) |
| `deleteSyncJob` 204 | `success.deleted_syncjob` (the ID) |
| bulk action | `BulkResultSummary` per job; the summary line is UI 002's new string |
| `409 sync-job-exists` | `danger.object_exists` ("host / user" as typed, as legacy fills it); "Open the existing job" (`syncJobs.form.openExisting`) links to `syncJobId` (FR-023) |
| owner left empty (client) | `danger.no_user_defined` |
| `403 permission-flag-required` | `danger.access_denied` (legacy's answer without the `syncjobs` ACL), through `LEGACY_TEXTS`; the identity is refreshed and "not permitted" replaces the screen |
| rule codes legacy reports without a translation ("bad option", "bad character SPACE") or as the generic `danger.access_denied` | new strings in the form context of UI 004's problem lookup (`syncJobs.form.errors.<field>.<code>`): `exclude.invalidRegex`, `customParameters.optionNotAllowed` ({option}), `customParameters.optionContainsSpace` ({token}), `customParameters.customParamsNotPermitted`, `mailbox.notEligible.kind.{resource,alias,aliasDomainAddress}`; and the shared `validation.format.hostName` |
| `required`, `tooLong`, `outOfRange` and the other common rules | UI 001's `validation.*` |
| outdated (412), gone (404), network | UI 001's and UI 002's generic texts, plus "This sync job no longer exists." (`syncJobs.detail.gone`) |

### Legacy form map, part 3: deviations needing a decision

Not built until the owner or the orchestrator decides (conventions "Deviation-free rule"):

1. **Last run without a time** (planning deviation 1): legacy's `mailbox.waiting` is shown.
2. **Unrecognised success code** (planning deviation 2): legacy's "Check log" is shown.
3. **Success messages** (planning deviation 3): legacy's `success.mailbox_modified` is mirrored.
4. **"Schedule next" for mailbox users** (spec FR-036): the user tab's mass actions lack it, so
   mailbox users are not offered it; administrators and domain administrators are.
5. **Single-job activate, deactivate and schedule next** in the row menu and on the job page
   (spec FR-036): legacy offers them only as mass actions on a selection, which the list's
   selection mode provides (one job may be selected). The row menu has Edit and Remove, as legacy's
   row buttons.
6. **Actions and data on the job page** (spec FR-015): delete, schedule next, activate,
   deactivate, open the log, refresh, and the created and changed times. Legacy's edit page has
   only the form and Save; deletion and the log stay in the list (conventions "Detail pages").
7. **Collapsible form sections with non-default counts** (spec FR-016, FR-017): one form in
   legacy order instead.
8. **Inline warnings** for the deleting options and the "Simulate" explanation (FR-024), the
   field-length hints and the list of allowed custom options (FR-021): legacy has no such texts.
9. **haveibeenpwned on the remote password**: the user modal marks the field `data-hibp`, but the
   spec (FR-035) and the conventions' list of checked forms leave sync jobs out; the check is not
   offered.

## API dependency and gaps

This feature depends on **mailcow-rest-v2 feature 008** (contract module `api/modules/sync-jobs/`,
last changed in `0fb4f73`), pinned at commit `32079252d55797d3da4e58ae661e9fb91c51c6f9` or later
(see [contracts/README.md](./contracts/README.md)), and on operations of API 001, 002 and 003 that
earlier UI features already pin. The API's implementation is not required: the feature is built and
tested against the contract-validated mock, and its smoke spec runs once the API's dev stack serves
feature 008 (UI 001 plan, Complexity Tracking).

**API gaps**: none open. The spec's three gaps (custom-parameter restriction not readable, target
mailbox editability unspecified, exclusion-pattern default) are closed by API 008's capabilities
read, the `immutable` rule and the `(?i)spam|(?i)junk` default.

Observations, none blocking:

1. `listMailboxes` returns full mailbox representations, so the picker loads more data per option
   than it shows. Acceptable at 25 per page; no change is requested.
2. API 008 documents no `429` or `503` for its operations. The spec's retry wording is aligned
   (FR-047); UI 001's generic handling covers them if they ever occur.

## Consistency changes to the spec

Recorded in the spec's Clarifications (session 2026-10-18) and checklist (validation run 3):

1. Multi-job actions use `POST /sync-jobs/bulk-actions` with `targets` (id and version as listed)
   instead of one request per job (FR-037, US4-AS3, US6-AS3, edge case on dropped connections).
2. The details screen edits one section at a time and marks changed values after an outdated save
   (FR-016, FR-017, FR-026 to FR-028, US3).
3. Deleting several jobs needs their number typed (FR-039).
4. History action through the audit log's target filters (FR-015); page sizes 25/50/100 (FR-012).
5. The automatic refresh can be paused, is suspended in selection mode and pauses after 15 minutes
   of inactivity, or the session's idle lifetime if shorter (FR-014).
6. Defaults, limits, the bulk limit and the custom-parameter permission come from the capabilities
   read (FR-018, FR-021, FR-055, FR-056); the exclusion pattern is now the API's default.
7. `permission-flag-required` replaces "forbidden", `sync-job-exists` links to the existing job,
   and the retry wording follows the documented statuses (FR-023, FR-047); the domain list and the
   audit log join the used operations (FR-053).
8. Deactivating asks one explicit confirmation, for one job or a selection (FR-036, FR-037,
   US4-AS1), and a dropped connection during a bulk action clears the selection, as UI 002 does.

## Dependencies on earlier features

UI 008 is implemented after **UI 001 to UI 007** and after **API 008's contract** is merged (it is).
Specifically (research R2):

- **UI 001**: shell, router, catalogue entry `syncJobs`, `canAccess`, `NoAccessState`, list state,
  forms, dialogs, announcer, clipboard, mock server and fixtures, i18n tooling, and the legacy
  translation layer (runtime `/lang/` loader, `en-gb` snapshot, formatter) with `SanitizedHtml.vue`.
- **UI 002**: `useBulkSelection`, `BulkActionBar`, `BulkResultSummary`, `ConfirmDialog` with
  `requireTyped`, `EditableSection` driven by `edit` with `changedSince()`, the leave guard,
  `HistoryLink` and the audit log's target filters, the enumeration scope manifest, the domain
  list mock.
- **UI 003**: the mailbox list mock and mailbox state, `NotFoundState`, and the mailbox detail
  screen whose header page actions (a designated action area) receive "Sync jobs".
- **UI 004**: the shared `DomainPicker`, `useBulkSelection`'s `limit` option, `SearchField`,
  `requiredFlags` on `ApiProblem`.
- **UI 005**: the `permission-flag-required` session reaction (also planned by UI 004).
- **UI 006**: `MailboxSearchPicker` (promoted here), `neutralise()`, `FilterPanel`.
- **UI 007**: no direct dependency; its contract pin precedes UI 008's.

Task T004 verifies these parts before any other work. A missing part blocks UI 008 and goes back to
its owner; only the `permission-flag-required` session reaction, the mailbox search picker and a
"view" parameter of `useListState` are added by UI 008 if still missing (T005 to T010).

## Owner-level questions (defaults applied)

1. **Review of new Czech and Slovak strings**: **Default**: as in UI 001, the owner reviews the new
   cs-cz and sk-sk strings (written by hand, never machine-translated) before release; T075 lists
   them. Legacy texts are not reviewed: they are mailcow's own.

## Parity notes added by the plan

The spec's parity table is complete. The plan adds:

1. A job whose last run was cleared by "Schedule next" reads "Cleared, runs on the next cycle"
   instead of the classic "Waiting" in the last-run column (research R8). **Pending decision**
   ("Deviations needing a decision" 1, which also covers "Never"); until then the legacy
   `mailbox.waiting` is shown for every job without a last run.
2. A success whose exit code the runner did not recognise reads "Success", where the classic
   interface showed "Check log" next to a success icon (research R8). **Pending decision**
   ("Deviations needing a decision" 2); until then the legacy `mailbox.syncjob_check_log` is shown.
3. The log can be linked by address and closed with Back on phones (research R17).
4. Deactivating asks one explicit confirmation, where the classic interface deactivates at once
   (conventions "Confirmations", research R14).

## Project Structure

### Documentation (this feature)

```text
specs/008-sync-jobs/
├── spec.md              # Feature specification (clarifications, parity, consistency changes)
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R22
├── data-model.md        # Phase 1: consumed API data, view models, cache, routes, validation, state machines, scenarios
├── quickstart.md        # Phase 1: gates and validation guide
├── contracts/README.md  # Phase 1: pinned contract and operations used
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

The `/speckit-analyze` summary is reported to the orchestrator, which records it.

### Source Code (repository root)

New files of this feature, and the existing files it edits:

```text
src/features/sync-jobs/
├── index.ts                         # routes, MailboxSyncJobsLink
├── routes.ts                        # sync-jobs, sync-job-create, sync-job-detail
├── api.ts                           # queries, mutations, cache writes and invalidation (data-model §3)
├── list-state.ts                    # useListState schema (data-model §5)
├── presentation.ts                  # job label, state, result, last run (data-model §2)
├── form-model.ts                    # values, sections, port rule, non-default counts, bodies, patches, checks
├── field-messages.ts                # (field, rule) → message key (research R13)
├── log-view.ts                      # log states and chunking
├── composables/
│   ├── useRunningRefresh.ts         # research R7
│   ├── useInactivity.ts             # research R7 (UI 011 promotes it)
│   ├── useLogViewer.ts              # research R17
│   └── useSyncJobActions.ts         # single and bulk actions (research R14, R15)
├── components/
│   ├── SyncJobStateBadges.vue  SyncJobResult.vue  SyncJobLastRun.vue
│   ├── SyncJobCard.vue  SyncJobTable.vue  SyncJobList.vue  SyncJobFilters.vue
│   ├── SyncJobRowActions.vue  AutoRefreshControl.vue  SyncJobDeleteList.vue
│   ├── FormSection.vue  SourceFields.vue  RemotePasswordField.vue  ScheduleFields.vue
│   ├── FolderFields.vue  DuplicateFields.vue  LimitFields.vue  ExpertFields.vue
│   ├── SyncJobSectionValues.vue     # read mode of a details section
│   ├── SyncJobLogDialog.vue  SyncJobLogText.vue
│   └── MailboxSyncJobsLink.vue
└── pages/
    ├── SyncJobsPage.vue
    ├── SyncJobCreatePage.vue
    └── SyncJobDetailPage.vue

# Existing files edited
src/api/query/keys.ts                       # sync-jobs keys; picker keys if missing
src/api/query/client.ts                     # permission-flag-required reaction, only if missing (T006)
src/shared/composables/useListState.ts      # view parameter, only if missing (T010)
src/shared/components/MailboxSearchPicker.vue  # promoted from UI 006's rate-limits feature (T008)
src/features/rate-limits/…                  # imports of the promoted picker updated (T008)
src/app/navigation/catalogue.ts             # syncJobs → available
src/app/router/routes.ts                    # register sync-jobs routes
src/features/mailboxes/pages/MailboxDetailPage.vue   # MailboxSyncJobsLink in the header page actions
src/features/audit-log/labels.ts            # sync-job event and target labels, if labels are mapped there
src/i18n/messages/{en-gb,cs-cz,sk-sk}.json  # new strings only; legacy keys are used verbatim
src/i18n/coverage.json                      # scope manifest of UI 002 D2 (enum-scope.json in UI 003)
scripts/i18n/lib.mjs                        # ENUM_NAMESPACES: sync-job enumerations; hostName format

tests/
├── mocks/
│   ├── factories/sync-job.ts
│   ├── scenarios/sync-jobs.ts              # registered in scenarios/index.ts
│   └── handlers/sync-jobs.ts               # registered in handlers/index.ts
├── unit/features/sync-jobs/*.spec.ts
├── e2e/sync-jobs/*.spec.ts
└── smoke/sync-jobs.smoke.spec.ts
```

**Structure Decision**: UI 001's single frontend project, organised by feature. Sync jobs are one
feature area that other code reaches only through `index.ts`; shared building blocks come from
`src/shared/` as UI 001 R20 assigned them.

## Complexity Tracking

No constitution violation needs justification. The one deviation from a UI 001 rule, the list's
condition-bound `refetchInterval`, is required by FR-014 and justified in research R7.

## Implementation notes

Recorded while implementing (tasks T001 to T079); they supersede the structure above where they
differ.

- **Files**: the form is one component (`SyncJobFormFields.vue`, legacy order) with
  `field-labels.ts` (the add modal's and the edit page's keys) instead of the seven section
  components; the job page has one `SyncJobSection.vue` driven by `useSyncJobSection.ts`;
  `SyncJobValues.vue` is its read mode. `useInactivity` lives in `src/shared/composables/` (owned
  here, for UI 011). `MailboxSearchPicker`, `SelectCheckbox`, the client errors and the bulk-row
  helpers (UI 003) and `DomainPicker`, `SearchField`, `ActiveFilterChips` and the problem lookup
  (UI 004) are used as they are (T007 and T008 superseded).
- **Strings**: the feature's strings live in `src/i18n/messages/sync-jobs/<locale>.json` and load
  with the routes (`loadFeatureMessages('sync-jobs')`, UI 002's convention), with the two enum
  groups only this feature uses (`enums.syncJobEncryption`, `enums.syncJobLastResult`). The audit
  event and target labels and `validation.format.hostName` stay in the shared files.
- **Shared changes** (each with its own unit test):
  - `useListState`: `views`, parameters that never reset the page (`?log=<id>`), with `setView`.
  - `useInactivity` (new): `useInactivity({ limit })` returns `idle`, `lastActivity` and `reset()`;
    `inactivityLimit(idleTimeoutSeconds)` is min(15 minutes, the session's idle lifetime).
  - `neutralise()` (new, `src/shared/security/plain-text.ts`, as UI 006's plan describes): control
    and bidi characters as visible markers, single- or multi-line.
  - `FormField.vue`: a `label` slot, for labels with markup (the imapsync option in `<code>`).
  - `useLeaveGuard`: lets the authentication screens through, so that the end of a session reaches
    sign-in with unsaved changes.
  - `violationParams` (`src/i18n/problems.ts`): also passes the `option` and `token` parameters.
  - `scripts/i18n`: the three sync job enum namespaces and the `hostName` format are checked.
- **Problem lookup**: the owner left empty is `danger.no_user_defined` and `sync-job-exists` is
  `danger.object_exists` with "host / user" (`LEGACY_TEXTS`, `LEGACY_ARGS`).
- **Initial bundle**: +0.9 KB gzipped against main (the three route records, the string loaders and
  the `LEGACY_TEXTS` entries); the strings themselves are lazy (quickstart, validation log).
