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

**Legacy form map**: written into this section by task T010a, before any screen is built.

**Deviations needing a decision**:

1. **Duration units** (FR-068, clarification on the ban settings): legacy enters ban time, maximum
   ban time and retry window in seconds, labelled `admin.f2b_ban_time` "Ban time (s)",
   `admin.f2b_max_ban_time` and `admin.f2b_retry_window`. The planned number-and-unit field changes
   the unit and would need new labels. Until decided, the legacy labels and seconds apply.
2. **Texts that describe the legacy presentation**: `admin.ban_list_info` ("Red labels indicate
   active permanent bans") and `admin.hash_remove_info` ("Each hash is indicated by an individual
   color") are shown verbatim, so the screens either mirror those red labels and colours or the
   texts describe something absent.
3. **`admin.ip_check_disabled`** points to "System > Configuration > Options > Customize", a
   classic-interface path. Shown verbatim, it names a path that differs in the app.
4. **`admin.f2b_list_info`** says list updates take "a few seconds", while the API documents up to a
   minute. Shown verbatim.
5. **Log types as a `<select>` and per-type explanations**: legacy has tabs and only the shared
   `debug.log_info`. The per-type explanations are new strings.
6. **Expand all / Collapse all** (`datatables.expand_all`, `datatables.collapse_all`) on every log
   table are dropped, because cards replace collapsed rows.
7. **"Delete all" confirmation**: legacy asks `queue.ays`. The typed count and the acknowledgement
   (FR-056, FR-058) are kept as typed confirmations, with `queue.ays` as the dialog text; the
   acknowledgement label is a new string.
8. **Arrival time**: the legacy column `admin.arrival_time` says "Arrival time (server time)", while
   FR-051 shows the arrival time relative and in the device's time zone. Either the column shows
   server time as the label says, or the label no longer fits.
9. **SASL log columns**: earlier drafts named `debug.service`, `debug.username` and
   `debug.login_time` ("Time"). The legacy table uses `admin.service`, `admin.username` and
   `admin.login_time` ("Login time"), because the dashboard binds `lang` to the `admin` section; the
   plan now uses those (no decision needed, recorded for the reviewer).

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
