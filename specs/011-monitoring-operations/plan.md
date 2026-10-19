# Implementation Plan: Monitoring and Operations

**Branch**: `main` (no feature branches, constitution 1.1.0) | **Date**: 2026-10-18 |
**Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/011-monitoring-operations/spec.md`

## Summary

UI feature 011 gives administrators the operations screens of mailcowui-ng, replacing the legacy
dashboard (System & Containers and the 13 log tabs), the Queue Manager and the Fail2ban section. It
delivers:

- **a dashboard** with the host, processor, memory and swap figures and live SVG charts, the mail
  storage usage, the version and update status with safely rendered release notes, the public
  addresses on demand, and one card per container with state, health, role, start time, live
  resource charts and start, stop and restart, including "outcome unknown";
- **live data** polled at the interval the API reports, paused while the page is hidden, by the
  user or after inactivity, with freshness and outdated markers measured against the host's clock;
- **logs** of all 12 types with search, time range, severity and type filters in the address,
  duplicate-free "load older", copy, and the rate limit reset;
- **the Rspamd view** with statistics, accessible proportional bars with a table alternative, and
  the paged scan history;
- **the mail queue** with filters, counts per queue, page and "all matching" selection up to the
  API's limit, one-request actions with per-message results, flush, an acknowledged "delete all",
  and an audited content viewer;
- **the ban service** with versioned section saves, unit-aware durations, line-based lists with
  own-address warnings, the rules editor and reset, ban actions with a bounded pending refresh, and
  ban list address rotation;
- **History** links into UI 001's audit log, which gains this feature's event, target and failure
  labels; record details are shown as stored until the contract describes them (API gap 8).

The technical approach (details in [research.md](./research.md)):

- **No new stack**: everything runs on UI 001's foundation. One new runtime dependency, `marked`
  18.1.1 (MIT, 14 KB gzipped), loaded only when release notes open (R2).
- **Contract**: pin mailcow-rest-v2 commit `32079252d55797d3da4e58ae661e9fb91c51c6f9`, which
  contains the API 011 contract with `/capabilities/monitoring`, container roles and queue counts
  (R1, [contracts/README.md](./contracts/README.md)).
- **Capabilities first**: intervals, outdated thresholds, limits, the IP check and the caller's
  address come from `GET /capabilities/monitoring`; rules the contract states only in prose are
  verified against the bundle text by a test (R4).
- **Live updates**: Vue Query with a reactive `refetchInterval` under a page-scoped controller that
  handles visibility, pause and an inactivity limit of `min(15 min, session idle timeout)` (R5, R6).
- **Charts without a library**: a 2 KB inline-SVG line chart with text values, patterns instead of
  colour, a table alternative and no animation, loaded as its own async chunk; CSS proportional
  bars for Rspamd (R7, R13). Per-chunk budgets and a Lighthouse collection guard the chart route
  (R22).
- **Logs**: one descriptor registry for 12 types; cursor paging newest first, offset paging oldest
  first (API gap 3), never duplicates (R11).
- **Tests**: contract-validated mock handlers per module with a scenario clock and failure
  injection, a visibility fixture, e2e tests of every acceptance scenario on 360 px and desktop with
  axe in both themes, unit tests of every pure module, and a smoke suite against the API dev stack
  with its outbound fakes (R21).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict) and Vue 3.5 SFCs; Node.js 24 LTS (UI 001).

**Primary Dependencies**: UI 001's ten runtime dependencies (UI 001 R1) plus **`marked` 18.1.1**
(MIT), dynamically imported by the release-notes renderer only (R2). No chart library. Dev tooling
unchanged (UI 001 R2).

**Storage**: none on a server. In the browser: the query cache; no new Pinia store and no new device
storage key (data-model §4).

**Testing**: UI 001's layers (Vitest + Vue Test Utils; Playwright `mobile-chromium` 360 × 780,
`desktop-chromium` 1366 × 900, `mobile-webkit`; axe in both themes; CSP, scroll and touch-target
checks; zero mock contract violations; smoke project). Added: `tests/e2e/fixtures/visibility.ts`,
mock handlers for six contract modules with a scenario clock, and per-chunk bundle budgets (R21,
R22).

**Target Platform**: as UI 001: the two latest evergreen browsers including iOS Safari and Chrome
for Android; the static image under `/ng/`.

**Project Type**: web application (static SPA; the backend is mailcow-rest-v2).

**Performance Goals**:

- "Mid-range phone" (SC-011) means Lighthouse's mobile emulation (Moto G Power class, 4× CPU
  slowdown, slow 4G) in the automated checks, and a real Android device of that class in the device
  validation (T149).
- Dashboard figures and the first page of a log visible within 2 s on a mid-range phone when the API
  answers within 1 s (SC-011).
- A 10 MiB queued message readable within 2 s after it arrives (first 256 Ki characters, R15).
- `LiveLineChart` chunk ≤ 6 KB gzipped; dashboard route chunk ≤ 45 KB gzipped; `marked` only via a
  dynamic import; initial JavaScript still ≤ 200 KB gzipped (R22).
- Lighthouse mobile performance and accessibility ≥ 0.9 on `/ng/operations/dashboard` (R22).
- After the page becomes visible or the user resumes, fresh data requested within 1 s (SC-004).

**Constraints**:

- Only contract operations; every server value (intervals, limits, IP check, retention) read from
  the capabilities read, never hard-coded.
- Strict CSP: SVG and bars use attributes, classes and CSSOM bindings only; one `v-html` in
  `SanitizedHtml.vue`.
- No third-party request, including from release notes.
- WCAG 2.2 AA in both themes; nothing blinks; no animation under reduced motion; 360 px and 400 %
  zoom without horizontal scrolling.
- Automatic requests only while a polling screen is visible, running and interacted with within the
  inactivity limit.

**Scale/Scope**:

- 8 user stories (US1–US4 at P1, US5–US6 at P2, US7–US8 at P3), 91 functional requirements.
- 10 routes, 4 navigation entries in one group.
- 44 operations (42 of API 011, one of API 006, one of API 001).
- 12 log types, about 20 containers, queues up to 10,000 listed messages, ban lists up to 10,000
  entries.
- Every language mailcow ships, with mailcow's own texts used verbatim through their legacy keys,
  and new strings (en-gb, cs-cz, sk-sk) only for elements the classic interface lacks.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Gate | Status |
|---|---|---|
| I. The API contract is the only interface | 44 operations of the pinned commit, all through the generated client (contracts/README.md). Types come from `@/api`; no hand-written API shapes (data-model §1). Gaps are reported, never worked around: actions on more than 1,000 queued messages are not batched (API gap 1), oldest-first log paging uses the documented `offset` (API gap 3), undocumented audit details are shown as stored, not typed by hand (API gap 8), and the undocumented `step` extension is not read (R17). Problems are handled from `type` and `errors` (R17). | PASS |
| II. Mobile-first | Every screen is designed at 360 px first: container and queue cards, log cards, a log type `<select>` instead of tabs, full-screen viewers and forms on phones, a sticky selection bar, a section index on the ban screen. Destructive actions are confirmed with what is affected (stop, restart, delete, delete all, denylist, rule reset, rotation, rate limit reset). Every collection has loading, empty and error states (FR-025, FR-043, FR-049, FR-062, FR-074). | PASS |
| III. Accessibility (WCAG 2.2 AA) | axe on every screen and state in both themes; charts with text values, patterns, summaries and table alternatives; no blinking and no animation; silent automatic updates with one announcement per stopped container; keyboard reordering of rules; dialogs per UI 001 R21; tables with `aria-sort` (R7, R13, R20). | PASS |
| IV. i18n and branding | Constitution IV 1.3.0 (see "Translations and forms" below): every language mailcow ships; texts with a classic-interface equivalent are mailcow's own, used verbatim by legacy key and loaded at runtime from the installation, legacy texts with HTML rendered whole through `SanitizedHtml.vue`, no hand-written Slovak or Czech values for legacy keys (fallback to `en-gb`); the screens mirror the legacy forms; new strings only where legacy has none, in en, cs and sk, never machine-translated; `i18n:check` covers the new strings, the legacy keys used (against the `en-gb` snapshot) and the enumerations; binary units and locale formats; the app's own strings take the product name from the branding, and legacy texts that name the product are shown as installed (R19). | PASS |
| V. Security in the browser | Release notes: raw HTML escaped, images as links, links `noopener noreferrer`, sanitised with a dedicated DOMPurify profile, rendered only in `SanitizedHtml`; no third-party request (R9). Log contents, queued content, Rspamd history, rules and audit details are shown as text only, through UI 006's `PlainText`/`neutralise()` (visible control and bidi markers). Queued content is discarded on close. No new storage. Controls follow the role; the API enforces it (FR-001, FR-003). | PASS |
| VI. Test-first | `tasks.md` orders tests before implementation in every phase: unit and component tests, e2e tests of every acceptance scenario on both viewports against the contract-validated mock, and the smoke suite. Unknown enumeration values are unit-tested because the mock may not send them (R21). | PASS (smoke gate as UI 001 Complexity Tracking) |
| VII. Performance budgets | Charts are an async chunk with a budget; `marked` only via dynamic import; routes lazy; per-chunk budgets and a dashboard Lighthouse collection; polling only while visible, running and interacted with; logs never refetch on their own; list data cached and invalidated after mutations (R5, R11, R22). | PASS |
| VIII. Simplicity | One new dependency (`marked`), justified (R2); no chart library; shared parts promoted only on their second use (`useInactivity.ts` from UI 008, `time-range.ts` from the audit log, `ProportionBarList.vue` from UI 006), single-use parts kept in the feature (`PurgeQueueDialog.vue`, `covers-address.ts`) (R5, R11, R13, R14, R16). | PASS |
| Technology constraints | Stack unchanged. "Charts are lazy-loaded on their route": the SVG chart is an async component on the dashboard route only, the bars live in the Rspamd route chunk (R7, R13, R22). No TailAdmin chart demo is copied. | PASS |
| Workflow and gates | The CI gates of UI 001 cover the feature; the budget script and Lighthouse runner are extended. Commits go to `main`. `marked` is MIT. | PASS |
| `docs/conventions.md` | List state in the address; cards and tables; list states; confirmations; History via target filters; problem types and rule codes translated; controls hidden or read-only by permission; capabilities from the capabilities read. **Shared building blocks and canonical names**: UI 002's `BulkActionBar`, `useBulkSelection` (bulk limit from the capabilities), `BulkResultSummary`, `ConfirmDialog`, `EditableSection`, `HistoryLink`, `useLeaveGuard` and coverage manifest; UI 008's `useInactivity`; UI 006's `neutralise()`; no renamed copies. **Polling**: only condition-bound `refetchInterval` with visibility checks, a pause control and the `min(15 min, idle timeout)` inactivity limit (R5). **Contract pin**: forward only, with this feature's 44 operations checked against the baseline `3207925` (R1). Where this spec decides otherwise for its own screens, the spec governs, as the conventions allow: logs load in steps of 50 without page numbers (FR-036), all containers on one screen (FR-008), the queue selection can cover all matching messages up to the API limit (FR-055) and carries no version tags (the contract forbids them). Queue deletions follow the conventions: the typed count for selected messages, the typed count plus the acknowledgement for "Delete all" (FR-056, FR-058; orchestrator decision). | PASS |

**Post-design re-check (after Phase 1)**: PASS. The data model, contracts README and quickstart
introduce no violation. Decisions that touched gates:

- Polling as a bounded exception to UI 001's "nothing polls" rule, limited by visibility, pause and
  `min(15 min, idle timeout)` inactivity (VII, UI 001 R12; research R5).
- Ban parameter ranges verified against the contract text instead of copied blindly (I; R4).
- Release notes rendered through a second sanitiser profile, keeping the single `v-html` (V; R9).
- Statement of the device time zone on every log screen instead of reading the host overview, so
  logs never depend on the container service (FR-041; R11).

## Translations and forms (constitution IV 1.3.0)

The owner rule of 2026-10-18 (`docs/conventions.md`, "Translations and forms") applies to every
screen of this feature, and it overrides any earlier text in this plan, the spec, research and
tasks.

**Legacy forms mirrored** (paths under `../mailhosting/data/web/`; on the dashboard page
`js/site/dashboard.js` reads `lang.<key>` from the `admin` section and `lang_debug.<key>` from
`debug`, on the queue page `lang.<key>` is the `queue` section):

- **Dashboard and container cards** (`/operations/dashboard`, `/operations/containers/:name`): the
  `#tab-containers` tab of `templates/dashboard.twig` (`debug.system_containers`,
  `debug.architecture`, `debug.current_time`, `debug.timezone`, `debug.uptime`,
  `debug.disk_usage`, `debug.cores`, `debug.memory`, `debug.show_ip`, `admin.ip_check_disabled`,
  container cards with `debug.started_on`, `debug.container_running`, `debug.container_stopped`,
  `debug.restart_container`), the host figures and charts of `js/site/dashboard.js`, and the
  version and "Restart SOGo" entries of `templates/base.twig`. Entry: `admin/dashboard.php`.
- **Container start, stop and restart**: the `RestartContainer` dialog of
  `templates/modals/footer.twig` (`footer.restart_container`, `footer.restart_container_info`,
  `footer.restart_now`, `footer.cancel`), `js/build/013-mailcow.js` (`footer.restarting_container`)
  and `inc/ajax/container_ctrl.php`.
- **Updates and public addresses**: `js/site/dashboard.js` (`debug.update_available`,
  `debug.no_update_available`, `debug.update_failed`, `debug.error_show_ip`) and
  `inc/ajax/update_check.php`.
- **Logs** (`/operations/logs`, `/operations/logs/:logType`): the log tabs of
  `templates/dashboard.twig` (`debug.logs`, `debug.in_memory_logs`, `debug.external_logs`,
  `debug.static_logs`, `debug.log_info` with `%d` filled with the configured log length plus one,
  as legacy fills it from `log_lines`; the tab names are product names) and the log tables of
  `js/site/dashboard.js` (columns `admin.time`, `admin.priority`, `admin.message`, `admin.task`,
  `admin.rate_name`, `admin.authed_user`, `admin.sender`, `admin.recipients`, `admin.action`; the
  SASL table `admin.username`, `admin.service`, `admin.login_time`).
- **Rate limit reset in the rate-limited log**: the `#tab-api-rl` tab of `templates/dashboard.twig`
  (`admin.hash_remove_info`, `admin.reset_limit`), with UI 006's dialog and the messages of
  `inc/functions.ratelimit.inc.php` (`success.hash_deleted`, `warning.hash_not_found`).
- **Rspamd** (`/operations/logs/rspamd`): the `#tab-rspamd-history` tab of
  `templates/dashboard.twig` (`debug.chart_this_server`, `debug.history_all_servers`) and the
  history table of `js/site/dashboard.js`.
- **Mail queue** (`/operations/mail-queue`): `templates/queue.twig` (`queue.queue_manager`,
  `queue.info`, `queue.legend`, `queue.deliver_mail`, `queue.deliver_mail_legend`,
  `queue.hold_mail`, `queue.hold_mail_legend`, `queue.unhold_mail`, `queue.unhold_mail_legend`,
  `queue.flush`, `queue.delete`, `queue.ays`, `admin.refresh`, `mailbox.toggle_all`,
  `mailbox.quick_actions`, `mailbox.remove`), `templates/modals/queue.twig` and `js/site/queue.js`
  (columns `admin.arrival_time`, `admin.message_size`, `admin.sender`, `admin.recipients`,
  `queue.show_message`). Entry: `admin/queue.php`. Messages: `inc/functions.mailq.inc.php`
  (`success.queue_command_success`, `danger.access_denied`, `danger.unknown`).
- **Ban service** (`/operations/fail2ban`): `templates/admin/tab-config-f2b.twig`
  (`admin.f2b_parameters`, `admin.f2b_ban_time`, `admin.f2b_ban_time_increment`,
  `admin.f2b_max_ban_time`, `admin.f2b_max_attempts`, `admin.f2b_retry_window`,
  `admin.f2b_netban_ipv4`, `admin.f2b_netban_ipv6`, `admin.f2b_list_info`, `admin.f2b_whitelist`,
  `admin.f2b_blacklist`, `admin.f2b_manage_external`, `admin.f2b_manage_external_info`,
  `admin.f2b_filter`, `admin.f2b_regex_info`, `admin.add_row`, `admin.remove_row`,
  `admin.reset_default`, `admin.ban_list_info`, `admin.queue_unban`, `admin.unban_pending`,
  `admin.no_active_bans`, `admin.needs_restart`, `header.restart_netfilter`, `admin.save`), in that
  order, and `js/site/admin.js`. Entry: `admin/system.php`. Messages:
  `inc/functions.fail2ban.inc.php` (`success.f2b_modified`, `success.f2b_banlist_refreshed`,
  `success.object_modified`, `danger.network_host_invalid`, `danger.reset_f2b_regex`,
  `danger.access_denied`).

**Screens or elements without a legacy counterpart** get new strings (en-gb, cs-cz and sk-sk, never
machine-translated), kept minimal: the live-update bar (updated, outdated, paused, inactivity,
resume), health values, container roles, resource labels and chart text alternatives, the log type
explanations beyond `debug.log_info`, the log filters and "load older", the queue filters, counts,
"all matching" selection, truncation and viewer texts, the own-address warning, ban rotation, the
pending refresh, the bulk summaries, outdated-version handling and the History records. Column
titles that legacy hard-codes in English in `js/site/dashboard.js` ("IP", "Hash", "Msg ID",
"Score", "Symbols" and so on) have no legacy key, so they are new strings too. The
`ban-rules-not-restored` problem has no legacy equivalent: `danger.reset_f2b_regex` describes a
timeout and asks to try again.

**Deviation-free rule**: these screens add, drop, rename, reword or reorder nothing relative to the
legacy forms above, except the conventions' improvements (sections with their own save, typed
confirmations, bulk mode, outdated-version handling). Labels, help and info texts (`*_info`),
placeholders, option labels, units, order and grouping, column headers, action labels and success,
warning and danger messages come from the legacy keys. Every mailcow language is supported. Legacy
values are loaded at runtime from the installation and shown verbatim:
`footer.restart_container_info`, `queue.info`, `admin.ip_check_disabled`, `debug.log_info`,
`admin.f2b_list_info`, `admin.ban_list_info` and `admin.hash_remove_info` go whole, with their
markup, through `SanitizedHtml.vue`. A missing key falls back to `en-gb`, never to a hand-written
value.

### Decisions at implementation (2026-10-19)

The plan's "Deviations needing a decision" and the open items of the draft form map are settled
through `docs/conventions.md` ("Decisions on the deviations found in plans 002–014") and
constitution 1.4.0, as the orchestrator settled them for UI 012: follow the legacy form and its
controls, a legacy tab or panel becomes one section, no help text, explanation or section heading
that legacy lacks, no data legacy never shows, no confirmation legacy lacks except the typed and bulk
ones and those `docs/conventions.md` "Confirmations" names, and actions that legacy offers only in a
list stay in the list. The improvements that stay are the conventions' (sections with their own
save, typed and bulk confirmations, bulk mode, outdated-version handling), what the conventions
require of every feature (the polling controls of "Polling", History links, "outcome unknown"), the
constitution's accessibility requirements (text alternatives of charts, accessible names), and the
states legacy cannot report (a value that could not be measured, a stopped Postfix or ban service, a
truncated queue listing, a temporary failure, an action without an audit record). No decision needs
the owner. Each item names the plan deviation (1–9) or the draft item (D1–D25) it settles.

1. **Durations** (deviation 1, D1): seconds under `admin.f2b_ban_time`, `admin.f2b_max_ban_time`
   and `admin.f2b_retry_window`, as number inputs like legacy's. FR-068's unit select and "largest
   exact unit", `duration.ts` and `DurationField.vue` are not built.
2. **Texts that describe legacy's presentation** (deviation 2, D2): `admin.ban_list_info` and
   `admin.hash_remove_info` are shown verbatim, and their cues are mirrored so that they stay true:
   an active ban reads "network (remaining ban time) - [actions]", permanent bans are danger-styled
   labels, and each rate limit entry has a decorative stripe in its hash's colour (the hash stays a
   text column). "Show entries of this rate limit" is not built.
3. **`admin.ip_check_disabled`** (deviation 3): verbatim. The classic interface serves that path
   until the cutover. It is also the message of `409 ip-check-disabled`.
4. **`admin.f2b_list_info`** (deviation 4): verbatim. The API writes the lists netfilter reads, as
   legacy does, so the timing it names is legacy's own.
5. **Log types** (deviation 5, D5): a `<select>` labelled `debug.logs` with legacy's three groups as
   `<optgroup>`s, on every log page. `/operations/logs` opens the first log (Postfix): legacy has no
   index. `debug.log_info` is shown on every log page and the Rspamd page, `%d` filled with the
   configured length (`logRetention.postfix.maxEntries`, which the API documents as `LOG_LINES + 1`,
   the value legacy fills in). Per-type retention texts, the time zone note and the audit log note
   are not built (FR-040, FR-041 in part); `MonitoringLogRetention.policy` is not shown and leaves
   the required enumerations.
6. **Expand All / Collapse All** (deviation 6, D6): kept as legacy has them, in each log's and the
   Rspamd history's `mailbox.quick_actions` menu. They open or close every shown entry's details.
7. **Delete all** (deviation 7, D7): `footer.confirm_delete`, `queue.ays`, a line with the number of
   queued messages, the typed count and the acknowledgement (orchestrator decision).
8. **Arrival time** (deviation 8): the device's time zone under the verbatim `admin.arrival_time`, as
   legacy's script renders it.
9. **SASL columns** (deviation 9): `admin.username`, `admin.service`, "IP", `admin.login_time`.
10. **Log names and order** (D10): legacy's, hard-coded in its template, as new strings with its
    text: Postfix, Dovecot, SOGo, Netfilter, Autodiscover, Watchdog, ACME, API, Ratelimits,
    Crontasks; Rspamd; "{productName} UI" (the product name from the branding, as the fork shows
    "FeldHost™ Mailhosting UI"), SASL. The routes keep the contract's path segments.
11. **Loading more log entries** (D11): the newest 50 entries first, then legacy's quick actions
    "+ 100" and "+ 1000", which add older entries below (newer ones when sorted oldest first)
    without duplicates (research R11), with legacy's outcomes "{count}`admin.additional_rows`" and
    `admin.no_new_rows`, and the count line `datatables.info`. The Rspamd history is paged by the API
    (FR-047) with `PaginationBar`; its menu has Expand All and Collapse All.
12. **Data legacy never shows** (D12, D18) is not built: swap; available space; the approximate and
    nearly-full markers; container health, role, states other than running and stopped, the
    protected marker, the running summary, and a container's processor and memory; branch, commit
    and commit date; the release publication time; Rspamd figures other than the action chart, and
    the envelope sender; the Postfix and Dovecot `program` column; "app password used"; forced
    expiry; counts per queue; list entry counts; the permanent ban start time; freshness ages and
    outdated markers (FR-022). A storage measurement the API reports as unavailable shows
    "Unavailable" instead of legacy's zeros.
13. **Fail2ban structure** (D13): legacy's one panel. First the parameters form, in legacy order and
    with legacy's controls, as one `EditableSection` titled `admin.f2b_parameters`: ban time, max.
    ban time, increment, max. attempts, retry window, IPv4 and IPv6 subnet size, manage externally
    with its info, `admin.f2b_list_info`, allowlist, denylist; Save with `header.restart_netfilter`
    beside it. Then the regex filters, a legend collapsed by default. Then the ban list:
    `admin.ban_list_info`, the ban list address, the active bans, the permanent bans.
14. **Headings** (D14): none that legacy lacks. No section index, no "Ban list" heading, no section
    addresses; the screen has one address. `admin.no_active_bans` is shown when there are neither
    active nor permanent bans, as in legacy.
15. **`admin.needs_restart`** (D15): no longer fits (the API enforces a denylist entry without a
    restart), so the action reads legacy's "denylist" without "(needs restart)".
16. **Confirmations** (D16): restart is legacy's dialog, without role warnings. Stop gets one
    confirmation (conventions "Confirmations": stopping a container), titled like legacy's restart
    dialog. Start has none. Delete selected uses `#ConfirmDeleteModal`'s texts with the queue IDs
    and the typed count. The rate limit reset uses `#ConfirmDeleteModal`'s texts with the hash, as
    legacy does. The regex filter reset asks `admin.ays`, as legacy's `confirm()` does. Rotating the
    ban list ID (destructive in the contract) gets one confirmation that the current address stops
    working. Denylisting a ban (a permanent ban, high-risk in the conventions' sense) gets one
    confirmation naming the network, with the own-address warning when the network covers the
    caller's address. Impact lines legacy lacks (stop body, role warnings, "cannot be undone", the
    denylist body, the rules reset body) are not built.
17. **Explanations** (D17): not built: the flush notes, the pending-lift timing, the capture-group
    help, a queue help panel heading, a positive empty-queue message, the time zone note and the
    logs' audit note. Kept: the content viewer's notice that each view is recorded in the audit log
    (the app records access to personal data; legacy does not), and the states listed above.
18. **Controls** (D19): kept: Start and Stop (the API offers them, and the conventions name stopping a
    container), legacy's search, sort and paging of its tables (applied by the API), selection mode
    and "toggle all" on the page, and the content viewer's "Show the rest" and Copy (they come with
    showing the first 256 Ki characters, SC-011). Not built: filters legacy lacks (log time range,
    severity and type filters; container filter, search and sort; queue filters; Rspamd action,
    time and score filters; active ban search, sort and pending filter), "Select all matching" (the
    conventions and legacy select the page; spec gap 3 is moot), reordering rules, "Remove from
    denylist" (the denylist field does it, as in legacy), "Show entries of this rate limit",
    per-entry Copy, the viewer's wrap switch, clamped messages, actions in the viewer (list-only in
    legacy), the pending-lift refresh and its polling.
19. **Dropped or moved legacy elements** (D20): the dashboard's card heading is the branding's UI
    title, as legacy's `ui_texts.title_name`, without repeating the logo. "Restart SOGo" is not a menu
    entry: the navigation holds places, and the SOGo card restarts it. The Queue Manager is in the
    System group (FR-001). The bgp.tools links are not built (a hard-coded third-party service;
    constitution privacy rule). The doughnut becomes labelled bars with a summary and a table
    (constitution III). The installed version opens its release notes as upstream's footer does.
20. **`debug.memory|upper`** (D21): shown as the file has it.
21. **Rules saved** (D22): `success.object_modified` with an empty `%s`, as legacy fills it.
22. **`ban-rules-not-restored`** (D23): legacy returns `danger.reset_f2b_regex` for exactly this
    condition, so `LEGACY_TEXTS` maps the problem to it; `admin.refresh` reloads, never a second
    reset.
23. **Action failures** (D24): legacy prints "Error: " and the service's or Postfix's message, so
    `problem.container-action-failed` and `problem.queue-action-failed` are new strings with that
    text; the message itself is untrusted text through `PlainText`.
24. **Placeholders** (D25): as legacy: "-" for a public address the API could not determine and a
    missing start time, "none", "unknown", "err" (no reset offered), and an empty sender cell (the
    queue card's heading is its QID).
25. **Live updates**: the conventions' polling rules (visibility, a pause control, the inactivity
    limit) with the notices `operations.live.*`; no freshness ages (item 12).
26. **Missing prerequisites** (T001): UI 006 is not implemented. This feature therefore:
    - sends `resetRateLimitBucket` from its own small action (`RateLimitReset.vue`) with legacy's
      `#ConfirmDeleteModal` texts and outcomes (`success.hash_deleted`, `warning.hash_not_found`),
      and adds the bucket identifier pattern to `src/shared/validation/limits.ts` and a mock handler
      for the operation. UI 006 may move the action into its own dialog;
    - creates `src/shared/components/PlainText.vue` (canonical name) on `neutralise()`, which UI 008
      created;
    - keeps the Rspamd bars in its own `RspamdActionsChart.vue` (single use; UI 006 promotes them
      when its statistics need them).
    `useInactivity` is already shared (UI 008). `time-range.ts` and the `prefix` option of
    `useListState` are not needed (items 14 and 18).

27. **Start-up payload** (T146, constitution VII): main's sign-in page loads 196,789 bytes of
    scripts against Lighthouse's 204,800 limit, so this feature keeps its share of the start-up
    modules small. Its query keys (`src/features/operations/query-keys.ts`), the rate and uptime
    formats (`src/features/operations/format.ts`) and its six screen-only icons
    (`src/features/operations/icons/`) stay in the feature (constitution VIII: shared after a
    second use); the release notes sanitiser registers itself when the renderer loads
    (`src/shared/security/release-notes.ts`); and the shell loads the status message list with the
    first message, inside a status region that is always present. The sign-in page then loads
    199,421 bytes of scripts, and the initial JavaScript is 178,352 bytes (main at `f0c9011`:
    175,871).

### Legacy form map (T010a)

Paths are under `../mailhosting/data/web/` (FeldHost fork, upstream tag `2026-09a`). On the dashboard
page `js/site/dashboard.js` reads `lang.<key>` from `admin` and `lang_debug.<key>` from `debug`; on
the queue page `js/site/queue.js` reads `lang.<key>` from `queue` and `lang_admin.<key>` from
`admin`; on the configuration page `js/site/admin.js` reads `lang.<key>` from `admin`. A
`section.key` is a legacy key used verbatim (checked against the en-gb snapshot); "new" marks a new
string (en-gb, cs-cz, sk-sk) with its English text; "(existing)" an app string of UI 001–012. Values
with markup go whole through `SanitizedHtml.vue` (`<LegacyText>`): `debug.log_info`,
`footer.restart_container_info`, `admin.ip_check_disabled`, `queue.info`, `admin.f2b_list_info`,
`admin.ban_list_info`, `admin.hash_remove_info`. Untrusted values (log contents, queued content,
Rspamd history, service messages, audit details) render through `PlainText`.

#### Part 1: fields and elements

**Navigation** (`catalogue.ts`, group `system`):

| Element | Key |
|---|---|
| group heading | `header.mailcow_system` (`nav.groups.system` in `LEGACY_TEXTS`) |
| Dashboard `/operations/dashboard` | `debug.system_containers` (the tab's name; legacy's menu entry `header.debug` names the page with both tabs) |
| Logs `/operations/logs` | `debug.logs` |
| Mail queue `/operations/mail-queue` | `queue.queue_manager` |
| Fail2ban `/operations/fail2ban` | `admin.f2b_parameters` (the panel's only title) |
| page titles | the same keys |

**Dashboard** (`templates/dashboard.twig` `#tab-containers`, `js/site/dashboard.js`):

| Element | Key |
|---|---|
| host card heading | the branding's UI title (item 19) |
| Hostname | `edit.hostname` (legacy hard-codes "Hostname"; same text and meaning) |
| Architecture | `debug.architecture` |
| IPs | new `operations.dashboard.ips` "IPs" (hard-coded) |
| Show public IP | `debug.show_ip` when `ipCheckEnabled`; busy: `datatables.loadingRecords`; result: the IPv4 and IPv6 lines, "-" for `null`; failure: `debug.error_show_ip` |
| IP check off, `409 ip-check-disabled` | `admin.ip_check_disabled` |
| Version | new `operations.dashboard.version` "Version" (hard-coded); value `tag` |
| update status | `upToDate` `debug.no_update_available`; `updateAvailable` `debug.update_available` and the newest tag as a button that opens its notes; `checkFailed` or a failed read `debug.update_failed`; `disabled` nothing |
| System Time | `debug.current_time`, the host time in the host's zone |
| Timezone | `debug.timezone`, `timeZone` as returned |
| Uptime | `debug.uptime`, days, hours and minutes through `Intl` units |
| Disk usage | `debug.disk_usage`; device, "{used} / {total} ({percent})", the bar; not measured: new `operations.dashboard.unavailable` "Unavailable" |
| CPU | new `operations.dashboard.cpu` "CPU"; "{cores} `debug.cores` @ {percent}" |
| Memory | `debug.memory`; "{total} @ {percent}" in binary units |
| live chart | caption is the block's heading; new `operations.charts.summary` "{value} now, from {min} to {max} in the last {count} samples", `operations.charts.showTable` "Show the values as a table", `operations.charts.hideTable` "Hide the table"; table columns `admin.time` and the series; fewer than two samples: `datatables.loadingRecords` |
| section failure | new `operations.dashboard.sectionError` "This section could not be loaded." with `common.retry` (existing) |
| containers heading | `debug.containers_info` |
| card | the name, "({image})", "(`debug.started_on` {time})" ("-" when never started), `debug.container_running` or `debug.container_stopped` with an icon |
| expand / collapse | new `operations.containers.expand` "Show details of {name}", `operations.containers.collapse` "Hide details of {name}" (legacy's caret has no text) |
| Disk I/O, Net I/O | new `operations.charts.diskIo` "Disk I/O", `operations.charts.netIo` "Net I/O", series `operations.charts.read` "Read", `operations.charts.write` "Write", `operations.charts.recv` "Recv", `operations.charts.sent` "Sent", unit `operations.charts.perSecond` "{size}/s" (hard-coded in legacy) |
| not running | new `operations.containers.noResourceData` "No resource data is available while the container is not running." |
| actions | `debug.restart_container`; new `operations.enums.containerAction.start` "Start", `operations.enums.containerAction.stop` "Stop" (`operations.enums.containerAction.restart` → `debug.restart_container` in `LEGACY_TEXTS`) |
| History | `history.link` (existing) |

**Live updates** (no legacy counterpart, conventions "Polling"): new `operations.live.pause` "Pause
live updates", `operations.live.resume` "Resume live updates", `operations.live.paused` "Live updates
paused since {time}.", `operations.live.inactive` "Live updates were paused because there was no
activity.", `operations.live.unavailable` "Live updates are off because the monitoring settings
could not be read.", `operations.live.failed` "Updating failed. The values shown may be out of
date."; manual refresh `admin.refresh`; a container that stops is announced with new
`operations.live.containerStopped` "{name} is no longer running.". App status messages: new
`shell.statusMessages.region` "Status messages", `shell.statusMessages.dismiss` "Dismiss".

**Container actions** (`#RestartContainer` in `templates/modals/footer.twig`,
`js/build/013-mailcow.js`, `inc/ajax/container_ctrl.php`):

| Element | Key |
|---|---|
| restart dialog | `footer.restart_container` followed by "(<code>{name}</code>)", `footer.restart_container_info`, `footer.restart_now`, `footer.cancel` |
| stop dialog | new `operations.containers.stopTitle` "Stop container" with the name as for restart, `operations.containers.stopNow` "Stop now", `footer.cancel` |
| progress | restart `footer.restarting_container`; new `operations.containers.starting` "Starting container, this may take a while", `operations.containers.stopping` "Stopping container, this may take a while" (patterned on legacy's text), `operations.containers.elapsed` "{seconds} s" |
| outcomes | new `operations.containers.ok` "OK", `operations.containers.alreadyRunning` "Already running", `operations.containers.notRunning` "Not running" (hard-coded in `container_ctrl.php`); unknown: `bulk.outcome.unknown` and `problem.outcome-unknown` (existing) |
| without an audit record | new `operations.notRecorded` "The action was carried out, but no audit record was written." |

**Release notes** (`showVersionModal`, `templates/modals/footer.twig`): titles new
`operations.updates.newRelease` "New Release {tag}" and `operations.updates.version` "Version {tag}"
(hard-coded); the notes; new `operations.updates.githubLink` "Github Link:" with the tag as the link
(hard-coded); images as links new `operations.updates.image` "Image: {description}",
`operations.updates.imageUntitled` "Image"; external links `common.opensInNewTab` (existing);
loading `datatables.loadingRecords`; failure new `operations.updates.notesFailed` "The release notes
could not be loaded." with `common.retry`; close `common.close` (existing).

**Logs** (`templates/dashboard.twig` log tabs, `draw_*_logs` in `js/site/dashboard.js`):

| Element | Key |
|---|---|
| type choice | `<select>` labelled `debug.logs`, `<optgroup>`s `debug.in_memory_logs`, `debug.external_logs`, `debug.static_logs` |
| info | `debug.log_info` |
| type names | new `operations.logs.types.<slug>` (item 10) |
| refresh | `admin.refresh` |
| menu | `mailbox.quick_actions` with new `operations.logs.more100` "+ 100", `operations.logs.more1000` "+ 1000" (hard-coded), `datatables.expand_all`, `datatables.collapse_all`; outcomes "{count}" + `admin.additional_rows`, `admin.no_new_rows` |
| search | `datatables.search`, clear `lists.search.clear` (existing) |
| order | the time column's header (`admin.time`) sorts newest or oldest first, with `aria-sort` |
| count | `datatables.info`, none `datatables.infoEmpty` |
| states | `datatables.loadingRecords`, `datatables.emptyTable`, `datatables.zeroRecords` with `lists.search.clear`, `states.list.error` with `common.retry` (existing); `503`: new `operations.logs.unavailable` "This log is temporarily unavailable." |
| details | `auditLog.details.show`, `auditLog.details.hide` (existing "Show details", "Hide details") |

Columns in legacy order; legacy's hidden (`className: 'none'`) columns are the details:

| Log | Columns |
|---|---|
| Postfix, Dovecot, SOGo, Netfilter | `admin.time`, `admin.priority`, `admin.message` |
| Autodiscover | `admin.time`, new `operations.logs.columns.userAgent` "User-Agent", `admin.username`, new `operations.logs.columns.ip` "IP", `admin.service` |
| Watchdog | `admin.time`, `admin.service`, new `operations.logs.columns.trend` "Trend", `admin.message` |
| ACME | `admin.time`, `admin.message` |
| API | `admin.time`, new `operations.logs.columns.uri` "URI", `operations.logs.columns.method` "Method", `operations.logs.columns.ip`, `operations.logs.columns.data` "Data" |
| Ratelimits | the colour stripe, `admin.time`, `admin.rate_name`, `admin.sender`, `admin.recipients`, `admin.authed_user`, new `operations.logs.columns.messageId` "Msg ID", `operations.logs.columns.headerFrom` "Header From", `admin.subject`, `operations.logs.columns.hash` "Hash", `quarantine.qid`, `operations.logs.columns.ip`, `admin.action` |
| Crontasks | `admin.time`, `admin.task`, `admin.priority`, `admin.message` |
| {productName} UI | `admin.time`, `admin.ui_header_announcement_type`, `admin.task`, new `operations.logs.columns.user` "User", `operations.logs.columns.role` "Role", `operations.logs.columns.ip`, `admin.message`, `operations.logs.columns.call` "Call" |
| SASL | `admin.username`, `admin.service`, `operations.logs.columns.ip`, `admin.login_time` |

Values as returned (FR-089); the priority as returned with a colour and an icon by severity class;
autodiscover `activesync` new `operations.logs.autodiscover.activesync` "ActiveSync", `imap`
`operations.logs.autodiscover.imap` "IMAP, SMTP, Cal-/CardDAV"; missing autodiscover user agent or
user new `operations.logs.unknown` "unknown"; watchdog without a message new
`operations.logs.healthLevel` "Health level: {level}% ({now}/{total})", the trend as its signed
number with an arrow; missing rate limit user new `operations.logs.none` "none"; missing hash new
`operations.logs.noHash` "err"; the UI activity message as its key and parameters, the call as JSON
text. Rate limits: `admin.hash_remove_info` above the list; the reset `admin.reset_limit` for a hash
matching `^RL[0-9A-Za-z=]+$`, confirmed with `footer.confirm_delete`, `footer.delete_these_items`, the
hash, `footer.delete_now`, `footer.cancel`.

**Rspamd** (`#tab-rspamd-history`, `rspamd_pie_graph` and `draw_rspamd_history`):

| Element | Key |
|---|---|
| title | new `operations.logs.types.rspamd` "Rspamd" in the select; card heading new `operations.rspamd.title` "Rspamd history" (hard-coded) |
| info, refresh | `debug.log_info`, `admin.refresh` |
| chart | legend `debug.chart_this_server`; bars labelled "{action} {percent}" as legacy's labels, with new `operations.rspamd.count` "{count} messages"; summary new `operations.rspamd.summary` "Most messages ({percent}) got the action {action}."; table `operations.charts.showTable`/`hideTable` with columns `admin.action`, new `operations.rspamd.messages` "Messages", `operations.rspamd.share` "Share"; none scanned new `operations.rspamd.noneScanned` "No messages were scanned yet." |
| history | legend `debug.history_all_servers`; menu `mailbox.quick_actions` with `datatables.expand_all`, `datatables.collapse_all` |
| columns | `admin.time`, new `operations.rspamd.columns.ip` "IP address", `admin.from`, new `operations.rspamd.columns.to` "To", `admin.subject`, `admin.action`, `quarantine.spam_score`, new `operations.rspamd.columns.symbols` "Symbols", `operations.rspamd.columns.size` "Msg size", `operations.rspamd.columns.scanTime` "Scan Time", `operations.rspamd.columns.id` "ID", `operations.rspamd.columns.user` "Authenticated user" (all hard-coded) |
| values | score "{score} / {required}"; symbols "{name} ({score})" with options in brackets; scan time "{real} / {virtual}"; missing user `operations.logs.none` |
| list tools | `datatables.search`; sort by the time, score, size and scan time headers; `PaginationBar` (existing) |
| states | as logs; unreachable new `operations.rspamd.unavailable` "Rspamd cannot be reached right now." |

**Mail queue** (`templates/queue.twig`, `templates/modals/queue.twig`, `js/site/queue.js`):

| Element | Key |
|---|---|
| title | `queue.queue_manager` with the total as a badge |
| refresh, info, legend | `admin.refresh`; `queue.info`; `queue.legend` then "`queue.deliver_mail` \| `queue.deliver_mail_legend`", unhold, hold in legacy order |
| columns | new `operations.queue.qid` "QID", `operations.queue.queue` "Queue" (hard-coded), `admin.arrival_time`, `admin.message_size`, `admin.sender`, `admin.recipients` ("address (reason)" per recipient), `admin.action` with `queue.show_message` |
| list tools | `datatables.search`; sort by the column headers; `PaginationBar`; states as logs |
| truncated | new `operations.queue.truncated` "Only the first {max} messages are listed. Flushing the queue and deleting all messages affect every queued message." |
| selection | `mailbox.toggle_all`, UI 002's `bulk.*` (existing) |
| selection actions | `mailbox.quick_actions`: `queue.deliver_mail`, `queue.unhold_mail`, `queue.hold_mail`, `mailbox.remove`, with legacy's command tooltips as their descriptions |
| whole queue | `queue.flush`, `queue.delete` |
| delete selected | `footer.confirm_delete`, `footer.delete_these_items`, the queue IDs, `bulk.confirm.typeCount` (existing), `footer.delete_now`, `footer.cancel` |
| delete all | `footer.confirm_delete`, `queue.ays`, new `operations.queue.purgeCount` "{count} messages are queued, including held ones.", new `operations.queue.purgeAcknowledge` "I understand that all queued messages, including held ones, are deleted permanently", `bulk.confirm.typeCount`, `footer.delete_now`, `footer.cancel` |
| results | `success.queue_command_success` and `BulkResultSummary` (`bulk.*`, existing) |
| Postfix stopped | `problem.mail-service-not-running` with new `operations.queue.openContainer` "Show {container} on the dashboard" |
| viewer | title new `operations.queue.viewerTitle` "ID {id}"; loading `datatables.loadingRecords`; new `operations.queue.viewAudited` "Each view of a message is recorded in the audit log.", `operations.queue.showRest` "Show the rest ({size})", `operations.copy` "Copy", copied `admin.copy_to_clipboard`, copying refused new `operations.copyRefused` "Copying is not available here. Select the text to copy it."; gone new `operations.queue.messageGone` "This message is no longer in the queue."; close `common.close` |
| History | `history.link` |

**Fail2ban** (`templates/admin/tab-config-f2b.twig`, `js/site/admin.js`):

| Element | Key |
|---|---|
| title | `admin.f2b_parameters` |
| ban service stopped | new `operations.fail2ban.notRunning` "The ban service is not running. Saved changes take effect, and queued unbans are processed, once it runs." |
| parameters, in order | `admin.f2b_ban_time`, `admin.f2b_max_ban_time`, `admin.f2b_ban_time_increment`, `admin.f2b_max_attempts`, `admin.f2b_retry_window`, `admin.f2b_netban_ipv4` and `admin.f2b_netban_ipv6` with legacy's "/" prefix, `admin.f2b_manage_external` with `admin.f2b_manage_external_info`, `admin.f2b_list_info`, `admin.f2b_whitelist`, `admin.f2b_blacklist`; read mode shows the switches as `mailbox.yes`/`mailbox.no` |
| own address | new `operations.fail2ban.ownAddress` "This entry covers your own address {address}. You could lock yourself out." (the contract asks clients to warn) |
| refused entry | new `operations.fail2ban.line` "Line {line}" before the entry and its message |
| buttons | `sections.save` (existing, as UI 002's sections), `header.restart_netfilter` beside it, `sections.editNamed` |
| regex filters | legend `admin.f2b_filter` (collapsed); `admin.f2b_regex_info`; columns new `operations.fail2ban.ruleId` "ID", `operations.fail2ban.ruleRegexp` "RegExp"; `admin.remove_row`; `admin.save`, `admin.reset_default`, `admin.add_row`; reset confirmation `admin.reset_default` / `admin.ays` / `admin.reset_default` / `footer.cancel` |
| ban list | `admin.ban_list_info`; `admin.no_active_bans`; address with accessible name new `operations.fail2ban.banlistUrl` "Banlist url" (legacy's `aria-label`), `operations.copy`, rotation icon new `operations.fail2ban.rotate` "Refresh banlist ID" |
| rotation confirmation | title `operations.fail2ban.rotate`, body new `operations.fail2ban.rotateBody` "The current banlist URL stops working at once.", confirm `admin.refresh`, `footer.cancel` |
| active ban | "network (remaining)" with new `operations.fail2ban.remaining` "{hours}h {minutes}m {seconds}s" (legacy's `%02dh %02dm %02ds`); actions `admin.queue_unban`, new `operations.fail2ban.allowlist` "allowlist", `operations.fail2ban.denylist` "denylist"; pending `admin.unban_pending` |
| denylist confirmation | title new `operations.fail2ban.denylistTitle` "Denylist {network}?", the own-address warning, confirm `operations.fail2ban.denylist`, `footer.cancel` |
| permanent ban | the network as a danger label |
| more than the API returns at once | `datatables.info` |
| History | `history.link` on the parameters and the regex filters |

**History** (`src/features/audit-log/labels.ts`): new `enums.auditEventType.*` for the 17 event types
("Container started", "Container stopped", "Container restarted", "Redelivery of queued messages
requested", "Queued messages held", "Queued messages released", "Queued messages deleted", "Mail queue
flushed", "All queued messages deleted", "Queued message viewed", "Fail2ban parameters changed",
"Fail2ban regex filters changed", "Fail2ban regex filters reset", "Network unbanned", "Network
unbanned and allowlisted", "Network denylisted", "Banlist ID refreshed"); `enums.auditTargetType.*`:
`container` "Container", `mailQueue` "Mail queue", `mailQueueMessage` "Queued message",
`fail2banActiveBan` "Active ban", `fail2banBanListId` "Banlist ID", and `fail2banSettings` →
`admin.f2b_parameters`, `fail2banRules` → `admin.f2b_filter` (`LEGACY_TEXTS`);
`enums.auditFailureReason.serviceFailure` "The container service or Postfix reported an error",
`enums.auditFailureReason.rulesNotRestored` "Default regex filters were not restored in time".
Details as stored; long arrays new `auditLog.details.showAll` "Show all {count}".

#### Part 2: messages

| API outcome | Key (placeholders) |
|---|---|
| container action `200 done` / `alreadyInState` | `operations.containers.ok`; start `operations.containers.alreadyRunning`; stop `operations.containers.notRunning` |
| `409 container-protected` | new `problem.container-protected` "This container is protected and cannot be stopped from this app." |
| `502 container-action-failed` | new `problem.container-action-failed` "Error: {serviceMessage}"; without a message `danger.unknown` |
| `409 container-not-running` (resource usage) | new `problem.container-not-running` "The container is not running."; the panel shows `operations.containers.noResourceData` |
| `404` container | `problem.status.404` (existing), the list refreshes |
| `503 temporary-failure` | `problem.temporary-failure` (existing) |
| `504 outcome-unknown`, lost connection | `bulk.outcome.unknown` with `problem.outcome-unknown` (existing); the container or list is read again |
| `Audit-Recorded: false` | `operations.notRecorded` |
| `403` | UI 001's handling (`danger.access_denied`) |
| queue bulk, flush, purge `200` | `success.queue_command_success`; bulk per ID `bulk.outcome.done` / `bulk.outcome.notFound` |
| `409 mail-service-not-running` | new `problem.mail-service-not-running` "The Postfix container {container} is not running." |
| `502 queue-action-failed` | new `problem.queue-action-failed` "Error: {serviceMessage}"; without a message `danger.unknown` |
| content `404` | `operations.queue.messageGone` |
| settings `200` | `success.f2b_modified` |
| settings, rules, rotation `412` | UI 002's outdated handling (`sections.outdated.*`, `problem.status.412`, existing) |
| rules `200` | `success.object_modified` (empty `%s`) |
| rules reset `200` | `success.f2b_modified` (legacy's reset falls through to the parameter save) |
| rules reset `504 ban-rules-not-restored` | `danger.reset_f2b_regex` (`LEGACY_TEXTS` `problem.ban-rules-not-restored`), `admin.refresh` |
| rotation `200` | `success.f2b_banlist_refreshed` |
| unban, allowlist, denylist `200` | `success.object_modified` (the network) |
| ban action `404` | new `operations.fail2ban.banEnded` "This ban has already ended." |
| `banServiceRunning: false` | `operations.fail2ban.notRunning` |
| `409 ip-check-disabled` | `admin.ip_check_disabled` (`LEGACY_TEXTS` `problem.ip-check-disabled`) |
| public addresses, other failure | `debug.error_show_ip` |
| update status failure | `debug.update_failed` |
| rate limit reset `204` / `404` | `success.hash_deleted` / `warning.hash_not_found` |
| log or Rspamd `503` | `operations.logs.unavailable` / `operations.rspamd.unavailable` |

| Field, rule code | Key |
|---|---|
| parameters `outOfRange` (`min`, `max`) | `validation.outOfRange` (existing) |
| `maxBanTime` `outOfRange` with `minField` | new `validation.outOfRangeMinField` "Enter a value from {min} ({field}) to {max}." with `admin.f2b_ban_time` |
| `banTime` `mustNotExceed` | `validation.mustNotExceed` (existing) with `admin.f2b_max_ban_time` |
| `allowlist.<n>` `invalidFormat`, `denylist.<n>` `invalidFormat` or `reserved`, ban `network` `reserved` | `danger.network_host_invalid` (the entry), as `inc/functions.fail2ban.inc.php` reports it |
| list entries `conflictsWith` | `validation.conflictsWith` (existing) with `admin.f2b_whitelist` or `admin.f2b_blacklist` |
| `tooMany`, `tooLong`, `tooShort`, `required` | existing `validation.*` |
| `rules.<n>` `invalidRegex` (`error`) | new `validation.invalidRegex` "This is not a valid regular expression.", the `error` verbatim |
| `rules.<n>` `missingCaptureGroup` | new `validation.missingCaptureGroup` "The rule needs a capture group for the client address." |
| `before` `invalidFormat` `logCursor` | new `validation.format.logCursor` "This position in the log is no longer valid. Refresh the log." |
| any other | `validation.invalid` (existing) |

#### Part 3: deviations needing a decision

None. Every deviation is settled above.

## Dependencies on earlier work

UI 011 is implemented **after UI features 001–010** and after the **API 011 contract** is merged
(constitution: a UI feature can start once its contract is merged; the smoke suite needs the API 011
implementation). Task T001 verifies these prerequisites (research R1 lists them with their use):

- **UI 001**: shell, router and guards, navigation catalogue, session store (`idleTimeout`), API
  client and `ApiProblem`, query client and key factory, `useListState`, `ListState`,
  `PaginationBar`, `useConfirm`/`ConfirmDialog`, `useVersionedSave`, `useProblemForm`, `FormField`,
  `ErrorSummary`, `ProblemMessage`, `DateTime`, `RelativeTime`, `useAnnouncer`/`LiveAnnouncer`,
  `useMediaQuery`, `useCountdown`, `SanitizedHtml`, `sanitize.ts`, `safe-url.ts`, `ip-network.ts`,
  `clipboard.ts`, the audit log feature (`labels.ts`, `AuditEventDetails.vue`, `time-range.ts`),
  the mock server and validator, the e2e fixtures, the smoke harness, the budget script and the
  Lighthouse runner.
- **UI 002** (parts UI 001 R20 reserves for it, and its own shared additions, as its draft plan
  names them): `src/shared/components/HistoryLink.vue` with the `targetType`/`targetId` parameters
  and filters of the audit log, `src/shared/composables/useBulkSelection.ts`,
  `src/shared/components/BulkActionBar.vue`, `src/shared/components/BulkResultSummary.vue`,
  `src/shared/components/EditableSection.vue` (driven by the `edit` address parameter) with
  `useVersionedSave`'s `changedSince` marking, `src/shared/composables/useLeaveGuard.ts`,
  `ConfirmDialog` with rich content and `requireTyped`, and `formatBytes` in `src/i18n/format.ts`.
  (UI 002's `stripMarkup` mapping is superseded by constitution IV 1.3.0; UI 011 relies on UI 001's
  legacy translation layer: runtime `/lang/` loader, `en-gb` snapshot, formatter.) UI 002 pins the
  same contract commit. UI 002 has no app-level status message host (its messages are inline), so
  UI 011 creates one (R8).
- **UI 002** also provides the translation coverage manifest `src/i18n/coverage.json`, to which
  each story of UI 011 appends the shared-enumeration values it shows (R19).
- **UI 006** (as its plan names them): `ResetBucketDialog` and its composable, exported from
  `src/features/rate-limits/index.ts` (UI 006 FR-058), the bucket identifier pattern in
  `src/shared/validation/limits.ts`, its mock handler for `resetRateLimitBucket`,
  `src/features/quarantine/components/statistics/ActionStatisticsList.vue` (promoted by US6),
  `neutralise()` in `src/shared/security/plain-text.ts` with `src/shared/components/PlainText.vue`
  (for every untrusted text this feature shows), and the `prefix` option of `useListState`.
- **UI 003**: `ActiveFilterChips.vue`, promoted to `src/shared/components/` (UI 003 T018).
- **UI 008**: `src/features/sync-jobs/composables/useInactivity.ts` (UI 008 R7), which UI 011
  promotes to `src/shared/composables/useInactivity.ts` on its second use, as UI 008 asks.
- **UI 004, 005, 007, 009, 010**: nothing specific. If one of them already promoted `time-range.ts`,
  added a rate formatter or an app-level status message host, UI 011 reuses it instead of adding its
  own.
- **API**: the API 011 contract (and, for the smoke suite, its implementation with
  `RESTV2_FAKE_OUTBOUND=y`), API 006's `resetRateLimitBucket`, API 002's audit target filters and
  API 001.

T001 records any prerequisite found under another name in this section. A missing prerequisite is a
dependency failure that stops the implementation; UI 011 never re-creates another feature's part.

**T001 result (2026-10-19, UI main `681bfdb`: UI 001, 002, 008 and 012).** Present under the planned
names: `HistoryLink`, `BulkActionBar`, `BulkResultSummary`, `EditableSection`, `ConfirmDialog` (with
`requireTyped`), `SanitizedHtml`, `ListState`, `PaginationBar`, `useBulkSelection`, `useLeaveGuard`,
`useListState`, `useVersionedSave` (with `changedSince`), `useConfirm`, `useProblemForm`,
`useAnnouncer`, `useCountdown`, `useMediaQuery`, the legacy translation layer, `coverage.json`,
`formatBytes`, the audit log's `targetType`/`targetId` state, `ActiveFilterChips` (already in
`src/shared/components/`), `useInactivity` (already promoted to `src/shared/composables/` by UI 008)
and `neutralise()` (`src/shared/security/plain-text.ts`, created by UI 008). Missing because UI 006
and UI 003–005, 007, 009 and 010 are not implemented yet: UI 006's `ResetBucketDialog`, its bucket
pattern and mock handler, `ActionStatisticsList.vue` and `PlainText.vue`, and the `prefix` option of
`useListState`. The conventions' ownership rule (the first feature implemented that needs a building
block creates it) and the decisions above (item 26) settle these, so the implementation goes on.

## API dependency and gaps

This feature depends on **mailcow-rest-v2 feature 011**, pinned at commit
`32079252d55797d3da4e58ae661e9fb91c51c6f9` ([contracts/README.md](./contracts/README.md)), and on API
features 006 (reset only), 002 (audit target filters) and 001.

**Spec gaps closed by the API 011 contract** (the spec is aligned in this plan):

- Spec gap 1 (IP check state): `MonitoringCapabilities.ipCheckEnabled`.
- Spec gap 2 (counts per queue): `MailQueueListMeta.queueCounts`.
- Spec gap 4 (own client address): `MonitoringCapabilities.clientAddress`.
- Spec gap 5 (interval and freshness at run time): `pollIntervalSeconds`, `maxAgeSeconds`.
- Spec gap 6 (configured log length): `MonitoringCapabilities.logRetention`.
- Spec gap 8 (container function): `Container.role`.
- UI 001 plan gap 5 (`KnownProblemType` missing from the bundle): registered under
  `components.schemas` at the pinned commit.

**Gaps that remain**, none worked around:

1. **No action on every queued message that matches a filter** (spec gap 3). The API's
   clarification declined it: the 1,000-ID bulk limit with flush and delete all cover the legacy
   Queue Manager. The UI selects at most `limits.mailQueueBulkMaxIds` matching messages and says so.
2. **The installed version is readable only by administrators** (spec gap 7). Declined by the API;
   domain administrators and mailbox users see no version.
3. **The log cursor is documented only for newest-first order** (new, spec gap 9). `LogBefore` says
   "older than the entry", "in the list's time order", without stating its meaning with
   `order=asc`. The UI loads the next page with `offset` in oldest-first order, which never
   duplicates (arrivals append after the shown entries) but can skip entries when mailcow trims the
   oldest end meanwhile. **Proposed to mailcow-rest-v2**: document `before` with `order=asc` as
   "entries after the cursor in list order", or add an `after` cursor.
4. **Ban parameter ranges only in prose**. `Fail2BanSettingsPatch` states the ranges (60 to
   2,147,483,647 seconds, prefix lengths 8 to 32 and 8 to 128) in its description, not as
   `minimum`/`maximum`. The UI keeps them in `fail2ban/limits.ts`, verified against the description
   text by a unit test (R4). **Proposed**: add the keywords to the schema.
5. **`Audit-Recorded` undeclared on queue bulk responses**. The operation documents the header, but
   the shared `BulkResultResponse` cannot declare it. The UI reads it anyway. **Proposed**: a
   `MailQueueBulkResultResponse` that declares the header.
6. **`meta.total` with a `before` cursor is unspecified**. The UI shows the total of the first page
   (no cursor). **Proposed**: document whether `total` counts all matching entries or only those
   older than the cursor.
7. **`RateLimitLogEntry.rateLimitHash` has no pattern**, while `bucketId` requires
   `^RL[0-9A-Za-z=]+$`. The UI offers the reset only for matching hashes. **Proposed**: state the
   pattern on `rateLimitHash`.
8. **The audit details of this feature's events are not in the contract** (new, spec gap 10; the
   same gap as UI 002's G1). `AuditEvent.details` is an open object, and the members API 011 writes
   (`stateBefore`, `stateAfter`, `results`, `changes`, `allowlistAdded`, `oldRules`, `newRules`, …)
   are documented only in the API's research. The History shows them through UI 001's generic,
   shape-agnostic details view as stored (R18), without translated keys or unit formatting.
   **Proposed**: describe the `details` members per event type in the contract (for example a
   documented `oneOf` keyed by `eventType`).
9. **The `outcome-unknown` extension `step` is documented only in prose**. The UI does not need it:
   it names the action it sent. **Proposed**: declare `step` in a `MonitoringOutcomeUnknownProblem`
   schema.

**Status at implementation (2026-10-19, T151; pin `4be8653`)**: gaps 3 to 9 were reported to
mailcow-rest-v2 as G6 to G11 (and the audit details under G3) and all were accepted:

- 3 (G6): `LogBefore` now states that `before` always selects older entries and `order` only sorts
  them; oldest first therefore keeps paging with `offset` ("+ 100"/"+ 1000" add newer entries).
- 4 (G7): `Fail2BanSettingsPatch` carries `minimum`/`maximum`; the UI reads its limits from
  `src/shared/validation/limits.ts`, checked against those keywords.
- 5 (G8): `Audit-Recorded` is declared on the shared `BulkResultResponse`.
- 6 (G9): with `before`, `meta.total` counts the remaining older entries; the UI shows the first
  page's total.
- 7 (G10): `rateLimitHash` carries the bucket pattern since `4be8653` (another stored text is
  `null`); the UI still offers the reset only for a matching hash.
- 8 (G3): the API documents the detail keys of its 17 event types in its `docs/audit-events.md`,
  which `AuditEvent.details` points to; the contract still leaves `details` open, so the History
  shows them as stored.
- 9 (G11): `MonitoringOutcomeUnknownProblem` declares `step`; the UI still names the action it sent.

Gap 1 is moot after decision 18 (no "Select all matching"), and gap 2 stays declined.

## Owner-level questions

None open. The former question on the queue deletion confirmation was decided by the orchestrator:
`docs/conventions.md` is binding, so selected messages need the typed count, and "Delete all" needs
the typed count and the acknowledgement checkbox (spec FR-056, FR-058).

## Parity notes added by the plan

Added to the spec's "Legacy Parity" tables in this plan's alignment of the spec:

1. "Show public IP" is offered only when the IP check is enabled, as legacy does, now that the API
   reports the setting.
2. Each log's retention explanation names the configured length again, as legacy does.
3. The "Delete all" confirmation states the exact number of queued messages, also beyond the
   10,000 that are listed.
4. Container cards show the container's role in words (new).

## Project Structure

### Documentation (this feature)

```text
specs/011-monitoring-operations/
├── spec.md              # Feature specification (aligned with the API 011 contract by this plan)
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R22
├── data-model.md        # Phase 1: consumed API data, view models, query keys, routes, validation, state machines
├── quickstart.md        # Phase 1: gates and validation guide
├── contracts/README.md  # Phase 1: pinned contract, operations used, problem handling
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

New and changed files only; the rest is UI 001–010.

```text
package.json, package-lock.json                 # + marked 18.1.1
contract/{openapi.yaml,openapi.json,VERSION.json} # pinned at 3207925 (T002)
src/api/generated/schema.ts                     # regenerated
src/api/problem.ts                              # + auditRecorded (R17)
src/api/query/keys.ts                           # + monitoring, containers, logs, rspamd, mail-queue, fail2ban keys
src/app/navigation/catalogue.ts                 # 4 rows in group 'system' replace 'operations' (R3)
src/app/shell/NavigationList.vue                # group headings
src/app/shell/StatusMessageHost.vue             # app-level status messages, mounted in ShellLayout (R8)
src/app/layouts/ShellLayout.vue                 # mounts StatusMessageHost
src/shared/composables/useStatusMessage.ts      # push and dismiss status messages (R8)
src/app/router/routes.ts                        # registers features/operations/routes.ts
src/styles/main.css                             # + --color-chart-1, --color-chart-2 tokens
src/shared/security/sanitize.ts                 # + 'releaseNotes' profile (R9)
src/shared/components/SanitizedHtml.vue         # + profile prop
src/shared/components/ProportionBarList.vue     # promoted from UI 006's ActionStatisticsList.vue (R13)
src/shared/composables/useInactivity.ts         # promoted from UI 008's sync-jobs feature (R5)
src/shared/filters/time-range.ts                # promoted from the audit log (R11)
src/shared/composables/useListState.ts          # + key prefix option, if absent
src/shared/icons/                               # + server, logs, queue, shield, play, stop, restart, pause, arrow-up, arrow-down
src/i18n/format.ts                              # + formatRate, formatUptime (formatBytes from UI 002)
src/i18n/messages/{en-gb,cs-cz,sk-sk}.json      # + new strings only: operations.*, audit labels
src/i18n/coverage.json                          # + 011 audit, validation and problem values (R19)
src/features/audit-log/labels.ts                # + 011 event types, targets, failure reasons
src/features/audit-log/components/AuditEventDetails.vue  # nested values, long arrays collapsed (R18)
src/features/operations/
├── index.ts                     # routes and the container address helper
├── routes.ts
├── capabilities.ts              # capabilities query and derived values (R4)
├── live/
│   ├── useLiveUpdates.ts  useHostClock.ts  useLiveSeries.ts  freshness.ts
│   └── components/{LiveUpdatesBar.vue,FreshnessIndicator.vue,SectionError.vue}
├── charts/
│   ├── LiveLineChart.vue        # async chunk (R7)
│   ├── ChartValuesTable.vue
│   └── scale.ts
├── dashboard/
│   ├── api.ts  container-list.ts  uptime.ts
│   ├── composables/{useContainerAction.ts,useStoppedAnnouncer.ts}
│   ├── release-notes/render-release-notes.ts
│   ├── pages/DashboardPage.vue
│   └── components/{HostSection,VersionLine,ReleaseNotesDialog,PublicAddresses,CpuMemorySection,
│                   MailStorageSection,ContainerSummary,ContainerFilters,ContainerList,ContainerCard,
│                   ContainerResources,ContainerActions}.vue
├── logs/
│   ├── api.ts  log-types.ts  list-state.ts  entry-text.ts
│   ├── pages/{LogIndexPage.vue,LogPage.vue}
│   └── components/{LogTypeSelect,LogFilters,LogEntryList,LogEntryCard,LogEntryTable,LogEntryDetails,
│                   LogMessage,RetentionNote,TimeZoneNote,RateLimitActions}.vue
├── rspamd/
│   ├── api.ts  list-state.ts
│   ├── pages/RspamdPage.vue
│   └── components/{RspamdStatistics,RspamdActionsChart,RspamdFilters,RspamdHistoryList,
│                   RspamdHistoryEntry,RspamdSymbols}.vue
├── mail-queue/
│   ├── api.ts  list-state.ts  useQueueSelection.ts  content.ts
│   ├── pages/MailQueuePage.vue
│   └── components/{QueueHeader,QueueHelp,QueueFilters,QueueList,QueueMessageCard,QueueMessageTable,
│                   QueueActionBar,PurgeQueueDialog,MessageContentViewer,MailServiceStopped}.vue
└── fail2ban/
    ├── api.ts  list-state.ts  limits.ts  duration.ts  list-entries.ts  covers-address.ts  usePendingLifts.ts
    ├── pages/Fail2banPage.vue
    └── components/{SectionIndex,BanServiceNotice,RestartNetfilterButton,ActiveBansSection,ActiveBanItem,
                    PermanentBansSection,ParametersSection,DurationField,ListsSection,EntryListField,
                    ExternalSection,RulesSection,RuleEditor}.vue
scripts/i18n/check.mjs                              # new required enumerations (R19)
scripts/check-bundle-budget.mjs, scripts/bundle-budgets.json  # per-chunk budgets (R22)
scripts/run-lhci.mjs                                # + dashboard collection
scripts/smoke/stack-up.sh                           # RESTV2_FAKE_OUTBOUND=y for the local API stack
tests/
├── unit/features/operations/…  tests/unit/features/audit-log/…  tests/unit/shared/…  tests/unit/app/…
├── mocks/handlers/{host,containers,logs,rspamd,mail-queue,fail2ban}.ts
├── mocks/factories/{host,container,log-entry,rspamd,mail-queue,fail2ban,audit-event}.ts
├── mocks/scenarios/operations.ts                   # registered in scenarios/index.ts
├── e2e/fixtures/visibility.ts
├── e2e/operations/{navigation,dashboard,live-updates,container-actions,logs,rate-limits,mail-queue,
│                   queue-content,fail2ban-bans,fail2ban-settings,rspamd,updates-addresses,history,
│                   performance,reflow-and-keyboard}.spec.ts
└── smoke/operations.smoke.spec.ts
```

**Structure Decision**: One feature directory (`src/features/operations/`) with sub-areas per
screen, as UI 001 R3 prescribes; other code reaches it only through its `index.ts`. Cross-feature
extensions (catalogue, shell status host, audit log labels and generic details, shared promotions)
are the designated extension points of earlier features (conventions "Where features meet").

## Complexity Tracking

No constitution principle is violated. The deviations from `docs/conventions.md` that the spec
decides for its own screens are listed in the Constitution Check. The smoke suite's gate status is
inherited from UI 001's Complexity Tracking.
