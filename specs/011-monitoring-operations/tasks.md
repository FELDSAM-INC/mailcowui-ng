---
description: "Task list for UI feature 011: monitoring and operations"
---

# Tasks: Monitoring and Operations

**Input**: Design documents from `specs/011-monitoring-operations/`:
- [plan.md](./plan.md)
- [spec.md](./spec.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/README.md](./contracts/README.md)
- [quickstart.md](./quickstart.md)

**Prerequisites**: UI features **001–010 are implemented** and the **API 011 contract is merged**
(plan "Dependencies on earlier work"). The smoke tasks additionally need the API 011
implementation in mailcow-rest-v2's dev stack. T001 verifies the prerequisites before anything
else.

**Tests**: Mandatory (constitution VI, test-first). In every phase, tests are written first and must
fail before the implementation tasks that follow them. Every end-to-end spec:
- runs on the `mobile-chromium` (360 px), `desktop-chromium` and `mobile-webkit` projects;
- calls `expectAccessible` (axe, WCAG 2.2 AA, both themes), `expectNoHorizontalScroll` and
  `expectTouchTargets` on every screen and state it reaches;
- fails on any CSP violation or mock contract violation (UI 001 fixtures);
- names its spec reference in the test title (`US1-AS6 …`, `FR-035 …`, `Edge: …`) and carries the
  tag `@operations`.

**Organization**: Tasks are grouped by user story (spec priorities P1 to P3), so that each story can
be implemented and tested on its own once the foundation is in place.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task belongs to (US1 to US8)
- Paths are relative to the repository root `mailcowui-ng/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prerequisites, the contract pin, the one new dependency, and the tooling extensions
(research R1, R2, R19, R21, R22).

- [ ] T001 Verify the prerequisites of plan "Dependencies on earlier work" and record the result in that section of `specs/011-monitoring-operations/plan.md`. Check that these exist and note any different name: `src/shared/components/{HistoryLink,BulkActionBar,BulkResultSummary,EditableSection,ConfirmDialog,SanitizedHtml,ListState,PaginationBar}.vue`, `src/shared/composables/{useBulkSelection,useLeaveGuard,useListState,useVersionedSave,useConfirm,useProblemForm,useAnnouncer,useCountdown,useMediaQuery}.ts`, `useVersionedSave`'s `changedSince`, `ConfirmDialog`'s rich content, the `stripMarkup` form of `scripts/i18n/import-legacy.mjs`, `formatBytes` in `src/i18n/format.ts`, the audit log's `targetType`/`targetId` list state, UI 006's exported rate-limit bucket reset mutation (expected in `src/features/spam-policy/index.ts`) and its `resetRateLimitBucket` mock handler, and UI 006's proportional bar list component. If any is missing, stop: it is a dependency failure, and UI 011 never re-creates another feature's part.
- [ ] T002 Pin the contract (research R1): run `scripts/contract/bump.sh 32079252d55797d3da4e58ae661e9fb91c51c6f9`, unless `contract/VERSION.json` already pins a later commit whose `api/` contains the 44 operations of `specs/011-monitoring-operations/contracts/README.md` unchanged. Confirm the bundle sha256 `5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6` (for that commit), 376 operations and a generated `knownProblemTypeValues` in `src/api/generated/schema.ts`. Run `npm run contract:check`, `npm run typecheck` and `npm run test:unit` to show that UI 001–010 still pass, and record the pin in `specs/011-monitoring-operations/contracts/README.md`. If `npm run i18n:check` now reports keys missing for contract enumeration values or problem types that are new at this pin, add their messages in the three locales in this task (the stories give the final wording), so that the translation gate stays green.
- [ ] T003 [P] Add the runtime dependency `marked` `18.1.1` (exact) to `package.json` and `package-lock.json` (research R2), and run `npm run licenses:check` (MIT is allowed).
- [ ] T004 [P] Extend `tests/unit/scripts/i18n-tools.spec.ts`: the check must require a key for every value of `ContainerState`, `ContainerRole`, `ContainerAction`, `LogSeverity`, `MailQueueName` and `MonitoringLogRetention.policy`, read from the generated enumeration arrays (research R19). The new cases must fail.
- [ ] T005 Add the six enumerations to the required list in `scripts/i18n/check.mjs`, and add their labels (`operations.enums.containerState.*`, `operations.enums.containerRole.*`, `operations.enums.containerAction.*`, `operations.enums.logSeverity.*`, `operations.enums.mailQueueName.*`, `operations.enums.logRetentionPolicy.*`) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` in the same task, so that T004 passes and `npm run i18n:check` stays green. The stories use these labels.
- [ ] T006 [P] Write `tests/unit/scripts/bundle-budget.spec.ts` against fixture Vite manifests in `tests/unit/scripts/fixtures/`: a budgeted chunk above its gzipped limit fails; a budgeted chunk reachable through a static import of the entry, or of the logs, mail queue or ban service route chunks, fails; reachability only through `dynamicImports` passes; the initial JavaScript limit of 204,800 bytes still applies (research R22). The test must fail.
- [ ] T007 Extend `scripts/check-bundle-budget.mjs` with per-chunk budgets from a new `scripts/bundle-budgets.json` (`LiveLineChart` ≤ 6,144 bytes gzipped; `DashboardPage` ≤ 46,080 bytes gzipped; `marked` and `render-release-notes` only behind dynamic imports; `forbidStaticFrom`: the entry and the `LogPage`, `MailQueuePage` and `Fail2banPage` chunks), so that T006 passes. A budgeted or listed chunk that the build does not contain yet (before its story) is skipped with a notice, so the gate stays green during the stories.
- [ ] T008 [P] Extend `scripts/run-lhci.mjs` with a third collection, `/ng/operations/dashboard` with `MOCK_DEFAULT_SCENARIO=admin-operations-lighthouse` (research R22). Until US1 registers that scenario (T046), the mock server refuses the name, and the script skips the collection with a notice, so the Lighthouse job stays green; T146 confirms that it runs.
- [ ] T009 [P] Extend `scripts/smoke/stack-up.sh` to set `RESTV2_FAKE_OUTBOUND=y` in the mailcow-rest-v2 checkout's `.env` for the local dev stack (API 011 quickstart Part B), and `scripts/smoke/stack-down.sh` to remove it again (research R21).
- [ ] T010 [P] Add the inline-SVG icons `server`, `logs`, `queue`, `shield`, `play`, `stop`, `restart`, `pause`, `arrow-up`, `arrow-down`, `trend-up`, `trend-down` and `alert-triangle` to `src/shared/icons/` and its barrel, each with `aria-hidden="true"` and `focusable="false"`, from TailAdmin first, otherwise Lucide, recorded in `THIRD_PARTY_NOTICES.md`.

**Checkpoint**: The contract is pinned, `marked` is installed, and the tooling knows the new
enumerations and budgets.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The mock scaffolding for six contract modules, the visibility fixture, and the core
every story uses: the capabilities read, the live-update controller, freshness and the host clock,
live series, app-level status messages, the "System" navigation group, the feature routes, shared
promotions and formatters.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Test infrastructure

- [ ] T011 [P] Extend `tests/unit/mocks/validator.spec.ts`: an optional response header the operation documents only in prose (`Audit-Recorded: false` on a `bulkMailQueueMessages` 200) is accepted; a `startContainer` 200 without `data.container` is rejected; a request to `/fail2ban/active-bans/203.0.113.0%2F24/lift` matches `liftFail2BanBan`; `version` in a `MailQueueBulkTarget` is rejected. Cases that fail show what T012 must change.
- [ ] T012 Adjust `tests/mocks/contract/validator.ts` so that T011 passes (only if it does not already).
- [ ] T013 Create the operations scenario scaffolding (research R21):
  - `tests/mocks/scenarios/operations/state.ts`: the state shape — capabilities (contract defaults: `pollIntervalSeconds` 5, `maxAgeSeconds` 5/10/15/60, retention per log, `clientAddress` `198.51.100.7`, limits 25/1,000/1,000/10,000/100/1,000/10,000, `ipCheckEnabled` true), a host clock (real time plus an offset), per-kind collection lags, and failure injection by operationId (`{ status, problemType, extensions, auditRecorded, delayMs, times }`);
  - `tests/mocks/scenarios/operations/index.ts`: registers the area modules `dashboard.ts`, `container-actions.ts`, `logs.ts`, `mail-queue.ts`, `fail2ban.ts`, `rspamd.ts`, `updates.ts` and `audit.ts` in the same directory, each created here as an empty module that later stories fill, so that parallel stories never edit the same scenario file. The combined scenario `admin-operations` is assembled from the seed data that each area module contributes;
  - registration of `operations/index.ts` in `tests/mocks/scenarios/index.ts`;
  - `PATCH /__mock/scenarios/:id` support for `{ advanceHostClockSeconds, capabilities, inject }` in `tests/mocks/server.ts`.
- [ ] T014 Create `tests/mocks/handlers/{host,containers,logs,rspamd,mail-queue,fail2ban}.ts` as handler arrays registered in `tests/mocks/handlers/index.ts`, with `getMonitoringCapabilities` implemented in `host.ts` from the scenario's capabilities and failure injection. The other operations follow in their stories, so later stories do not edit `index.ts`.
- [ ] T015 [P] Create `tests/e2e/fixtures/visibility.ts`: an init script that makes `document.visibilityState` and `document.hidden` controllable, and `setPageVisibility(page, 'hidden' | 'visible')`, which flips them and dispatches `visibilitychange`; register it in `tests/e2e/fixtures/test.ts`. Add `countRequests(operationId, sinceMark)` to `tests/e2e/fixtures/mock-api.ts` on top of `mockApi.requests()`.

### Tests for the core (write first; must fail)

- [ ] T016 [P] Write `tests/unit/api/problem-audit-recorded.spec.ts`: `ApiProblem.auditRecorded` is `false` only when the response carries `Audit-Recorded: false`, and `true` otherwise; the success helper `isAuditRecorded(response)` reads the same header (research R17).
- [ ] T017 [P] Write `tests/unit/features/operations/capabilities.spec.ts` (research R4): the derived values of data-model §2 (`intervalSeconds(kind)` with mail storage = `maxAgeSeconds.mailStorage`; `thresholdSeconds` = max age + 2 × interval, giving 20/15/25/180 s with the defaults and other values for other capabilities); the limits passed through; `unavailable` when the read fails, with no fallback constant.
- [ ] T018 [P] Write `tests/unit/features/operations/live/useLiveUpdates.spec.ts` and `tests/unit/features/operations/live/useInactivity.spec.ts` with fake timers (research R5, data-model §7): `running` sets the interval, every other state sets `false`; hiding sets `hidden` and showing refetches `['monitoring','live']` at once (within 1 s, SC-004); "Pause" and "Resume" (immediate refetch) with `since`; pointer, key, wheel, touch and scroll interactions reset the inactivity timer (throttled to once per second); the limit is `min(15 min, Session.idleTimeout)` from UI 001's session store; unmounting removes listeners and timers; capabilities missing → `unavailable`.
- [ ] T019 [P] Write `tests/unit/features/operations/live/freshness.spec.ts` and `tests/unit/features/operations/live/useHostClock.spec.ts` (research R6): skew from `HostOverview.currentTime` minus the receive time, else from the newest live response's `Date` header; age never negative; outdated exactly above the threshold (SC-005, both sides of the boundary); a device clock 1 hour off changes nothing.
- [ ] T020 [P] Write `tests/unit/features/operations/live/useLiveSeries.spec.ts`: at most 30 samples; a sample with an unchanged time is not appended; reset on dispose (FR-005, FR-010).
- [ ] T021 [P] Write `tests/unit/features/operations/live/components.spec.ts` for `FreshnessIndicator.vue` ("Updated n s ago" while running, absolute collection time when paused or hidden, "Outdated" text and icon, no live region, the 5-second ticker only while running), `LiveUpdatesBar.vue` (pause and resume button with its state in text, "paused since", the inactivity notice with Resume, the capabilities-unavailable notice with retry, FR-020, FR-021) and `SectionError.vue` (message, retry, "updating failed, retrying" notice that keeps the last values, FR-023, FR-025).
- [ ] T022 [P] Write `tests/unit/app/shell/StatusMessageHost.spec.ts`: `useStatusMessage().push()` shows a message in a `role="status"` region of `ShellLayout`; it stays until dismissed (never on a timer, so never while focused or hovered, FR-078); a dismiss button returns focus sensibly; several messages stack (research R8).
- [ ] T023 [P] Update `tests/unit/app/navigation/visibility.spec.ts` for the four rows of data-model §5 (`dashboard`, `logs`, `mailQueue`, `fail2ban`, admin only, `group: 'system'`) replacing `operations`, and write `tests/unit/app/shell/NavigationList.spec.ts`: consecutive rows of one group render under one heading (`nav.groups.system`) in the drawer and the static navigation, as a labelled list (FR-001).
- [ ] T024 [P] Write `tests/unit/features/operations/routes.spec.ts`: `/operations` redirects to `/operations/dashboard`; `containerRoute(name)` from `src/features/operations/index.ts` builds `/operations/containers/<name>` only for names matching `^[a-z0-9][a-z0-9_.-]{0,62}$` (the `ContainerName` pattern).
- [ ] T025 [P] Write `tests/unit/shared/composables/useListState.prefix.spec.ts`: with `prefix: 'b'`, the parameters are read from and written to `bq`, `bpage`, `bsize`, `bsort`, `border` and the filter keys, two prefixed states on one page reset independently, and unprefixed lists are unchanged (data-model §5). Skip if UI 001–010 already cover a prefix option.
- [ ] T026 [P] Extend `tests/unit/i18n/format.spec.ts`: `formatRate` (binary units per second, `null` → no value), `formatUptime` (days, hours and minutes in each locale, FR-004), and binary sizes through UI 002's `formatBytes` (FR-007). Extend `tests/unit/shared/validation/limits.spec.ts`: `LIST_LIMIT_MAX` equals the `maximum` of the contract's `Limit` parameter (1,000), the page size of the unfiltered container list (research R8).
- [ ] T027 [P] Write `tests/unit/styles/chart-palette.spec.ts`: `--color-chart-1` and `--color-chart-2` in `src/styles/main.css` have at least 3:1 contrast against the card surface in the light and the dark theme (WCAG 1.4.11, FR-083).
- [ ] T028 [P] Write `tests/e2e/operations/navigation.spec.ts`: `FR-001` an administrator sees the "System" group with Dashboard, Logs, Mail queue and Fail2ban, and every entry opens a working screen or a placeholder, never "not found"; domain administrators and mailbox users get no entry of the group, and each of the four addresses shows UI 001's "not available for your role" state with no request of this feature (`mockApi.requests()`); the home screen of UI 001 stays the landing screen.

### Core implementation

- [ ] T029 Implement `auditRecorded` in `src/api/problem.ts` and export `isAuditRecorded(response)` from `src/api/index.ts`, so that T016 passes.
- [ ] T030 Add the query keys of data-model §3 to `src/api/query/keys.ts` (`monitoring`, `containers`, `logs`, `rspamd`, `mail-queue`, `fail2ban` roots), with list parameter types aliased from the generated `operations[…]['parameters']['query']`.
- [ ] T031 Implement `src/features/operations/capabilities.ts` (`useMonitoringCapabilities()`: the query with `staleTime` 5 min and the derived values), so that T017 passes.
- [ ] T032 [P] Implement `src/features/operations/live/useInactivity.ts` and `src/features/operations/live/useLiveUpdates.ts`, so that T018 passes.
- [ ] T033 [P] Implement `src/features/operations/live/useHostClock.ts` and `src/features/operations/live/freshness.ts`, so that T019 passes.
- [ ] T034 [P] Implement `src/features/operations/live/useLiveSeries.ts`, so that T020 passes.
- [ ] T035 Implement `src/features/operations/live/components/{FreshnessIndicator,LiveUpdatesBar,SectionError}.vue`, so that T021 passes.
- [ ] T036 Implement `src/shared/composables/useStatusMessage.ts` and `src/app/shell/StatusMessageHost.vue`, and mount the host in `src/app/layouts/ShellLayout.vue`, so that T022 passes.
- [ ] T037 Replace the `operations` row in `src/app/navigation/catalogue.ts` with the four rows of data-model §5 (status `placeholder`, classic addresses `/admin/dashboard` for `dashboard` and `logs`, `/admin/queue` for `mailQueue`, `/admin/system` for `fail2ban`), add the optional `group` field to `NavigationEntry`, and render group headings in `src/app/shell/NavigationList.vue`, so that T023 passes.
- [ ] T038 Create `src/features/operations/routes.ts` (the `operations` redirect) and `src/features/operations/index.ts` (routes and `containerRoute`), and register the routes in `src/app/router/routes.ts`, so that T024 passes. Each story adds its own routes to `routes.ts`.
- [ ] T039 [P] Promote `src/features/audit-log/time-range.ts` to `src/shared/filters/time-range.ts` and `src/features/audit-log/components/ActiveFilterChips.vue` to `src/shared/components/ActiveFilterChips.vue` (their second use, constitution VIII), move their tests to `tests/unit/shared/`, add the `1h` preset to `time-range.ts`, and update the audit log's imports. Skip a part that an earlier feature already promoted, and use its location.
- [ ] T040 [P] Add a `prefix` option to `src/shared/composables/useListState.ts`, so that T025 passes (skip if present).
- [ ] T041 [P] Add `formatRate` and `formatUptime` to `src/i18n/format.ts` and `LIST_LIMIT_MAX` (with a comment naming the `Limit` parameter) to `src/shared/validation/limits.ts`, so that T026 passes.
- [ ] T042 [P] Add `--color-chart-1` and `--color-chart-2` (light and dark values) to `src/styles/main.css`, so that T027 passes.
- [ ] T043 Add `nav.groups.system` (legacy `header.mailcow_system` through `src/i18n/legacy-map.json`), `nav.dashboard`, `nav.logs`, `nav.mailQueue`, `nav.fail2ban` and the `operations.live.*` messages (updated, outdated, paused since, inactivity notice, resume, refresh, capabilities unavailable, updating failed) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, run `npm run i18n:import`, and make T028 pass.

**Checkpoint**: The foundation is ready: the capabilities read, live-update controller, freshness,
series and status messages pass their tests, and the four navigation entries open placeholders for
administrators only. User stories can now start.

---

## Phase 3: User Story 1 - See the state of the server at a glance (Priority: P1) 🎯 MVP

**Goal**: The dashboard with the host section, processor, memory and swap with live charts, the mail
storage, the version line (installed version), and one card per container with summary, filter,
search, sort and live resource charts, refreshed while visible, with freshness markers.

**Independent Test**: Against the mock with one stopped and one unhealthy container and figures that
change between polls, open the dashboard at 360 px and desktop width, compare every value with the
mock, advance time and see updates, hide the page and confirm no further requests, then show it
again.

### Tests for User Story 1 (write first; must fail)

- [ ] T044 [US1] Create `tests/mocks/factories/host.ts` (overview figures from a deterministic sequence per request, storage, installation version) and `tests/mocks/factories/container.ts` (the containers of a mailcow installation, including this API's own container (`role: api`) and the web app's (`role: webApp`), with images, states, health, `protected`, `role` and `availableActions` derived as the contract describes; resource samples with `null` rates on the first sample).
- [ ] T045 [US1] Implement in `tests/mocks/handlers/host.ts` `getHostOverview` (figures change on every request, `currentTime` from the scenario clock, `collectedAt` lagging by the scenario's lag), `getMailStorageUsage` (measured, approximate, or `measured: false` with `null` figures) and `getInstallationVersion`; and in `tests/mocks/handlers/containers.ts` `listContainers` (`limit`, `offset`, `sort`, `order`, `q`, `running`) and `getContainerResourceUsage` (first request after a pause with one sample and `null` rates, then rates; `409 container-not-running`). All honour failure injection (`503 temporary-failure` with `Retry-After`).
- [ ] T046 [US1] Fill `tests/mocks/scenarios/operations/dashboard.ts` with: `admin-operations` (the healthy installation with SOGo stopped and ClamAV unhealthy), `admin-operations-lighthouse` (`pollIntervalSeconds: 60`), `ops-container-service-down` (`503` on host, storage, containers and resource usage only), `ops-storage-unavailable`, `ops-storage-nearly-full` (approximate, 93 %), `ops-freshness-lag` (host `collectedAt` 25 s old), `ops-capabilities-unavailable` (`500` on `getMonitoringCapabilities`), and `ops-container-renamed` (a container that disappears from the list).
- [ ] T047 [P] [US1] Write `tests/e2e/operations/dashboard.spec.ts`:
  - `US1-AS1`: host name, architecture, installed version, the host's time in its time zone with the zone's name, uptime in days, hours and minutes, cores, processor usage, memory total and usage, swap total, used and percentage, storage device, used, available, total and percentage (FR-004 to FR-007, binary units);
  - `US1-AS2`: at 360 px no horizontal scroll, figures readable without charts, each container a card with name, image, state, health when reported, start time and role (FR-008);
  - `US1-AS4`: the stopped SOGo card says "Stopped" in text with an icon; the summary counts it; "Not running" in the summary filters to it and writes `state=notRunning` to the address (FR-009);
  - `US1-AS7`: `ops-storage-unavailable` says "unavailable" and shows no zeros; approximate figures are marked; `ops-storage-nearly-full` marks the bar as nearly full in text (FR-006);
  - `US1-AS8`: as a domain administrator and a mailbox user, `/ng/operations/dashboard` shows "not available for your role";
  - `FR-003`: a `403 forbidden` injected on `listContainers` shows the translated reason in the container section and refreshes the identity (UI 001's handling);
  - `FR-005`/`FR-010`: charts appear after the figures; expanding a running card shows processor, memory against limit, disk and network rates with charts; "Collecting data" until the second sample; a stopped card says no resource data is available; collapsing discards the series;
  - `FR-009`: search on name and image, sort by name, state and start time, all kept across a reload; "no matching containers" with "Clear";
  - `FR-002`: `/ng/operations/containers/sogo-mailcow` opens the dashboard with that card expanded and focused; collapsing it returns to `/ng/operations/dashboard`; an unknown name shows "not found" with a link to the dashboard;
  - `FR-025` and `Edge: container service unavailable`: on `ops-container-service-down`, the host, processor and memory, storage and container sections each show their own error with a retry while the version line still shows; on `ops-container-renamed`, the vanished container leaves the list;
  - `FR-007`, `FR-089`: names, images and versions shown as returned.
- [ ] T048 [P] [US1] Write `tests/e2e/operations/live-updates.spec.ts` with `page.clock` and the visibility fixture:
  - `US1-AS3`: after the polling interval the host figures, container states and charts show the new values, and each section says how long ago its data was collected;
  - `US1-AS5`, `SC-004`, `FR-019`: hidden for a minute → 0 overview, container, storage and resource requests; visible → requests within 1 s, then polling continues; after leaving the dashboard for another screen, no further status request is made;
  - `US1-AS6`, `FR-023`: with the overview failing, the last values stay, are marked outdated with their age, and a notice says that updating failed and is retried; polling continues;
  - `US1-AS9`, `FR-020`, `FR-021`: "Pause live updates" → no requests, "paused since"; the manual refresh still works; "Resume" requests at once; 15 minutes without interaction (or the scenario's shorter session idle timeout) pause with a notice and Resume;
  - `FR-022`, `SC-005`: `ops-freshness-lag` marks the host figures outdated; fresh figures are not marked;
  - `FR-024`: a container that stops while shown is announced once (polite region), automatic updates are not announced;
  - `FR-018`: mail storage requested at its own interval; version requested once per visit; `ops-capabilities-unavailable` loads the figures once, polls nothing and shows the notice with retry;
  - `Edge: device clock wrong`: with the browser clock 1 hour ahead, nothing is marked outdated;
  - `Edge: session ends`: a `401` on a poll stops polling and shows UI 001's sign-in with its notice.
- [ ] T049 [P] [US1] Write `tests/unit/features/operations/dashboard/container-list.spec.ts` (filter, case-insensitive search over name and image, sort by name, state and start time with ties by name and `null` start times last, summary counts) and `tests/unit/features/operations/dashboard/uptime.spec.ts`.
- [ ] T050 [P] [US1] Write `tests/unit/features/operations/charts/scale.spec.ts` (fixed 0–100 % scale; "nice" binary steps for rates; axis labels in binary units) and `tests/unit/features/operations/charts/LiveLineChart.spec.ts` (`<figure>` with caption and current values in text; `<svg role="img">` with `<title>` and a `<desc>` summary; second series dashed with a legend naming each pattern; "Show values" table with header cells and caption; "Collecting data" with fewer than two samples or `null` rates; no `style` attribute and no `transition` or `animation`; fits any width; FR-083, FR-084), plus `ChartValuesTable.spec.ts`.
- [ ] T051 [P] [US1] Write component tests in `tests/unit/features/operations/dashboard/`: `HostSection.spec.ts` (host time in the host's time zone with the zone's long name, uptime, FR-004), `VersionLine.spec.ts` (tag, and branch, commit and commit date when present, FR-026), `CpuMemorySection.spec.ts` (figures before the async chart resolves, FR-091) and `MailStorageSection.spec.ts` (unavailable, approximate, nearly full at 90 % by text and icon, FR-006).
- [ ] T052 [P] [US1] Write component tests in `tests/unit/features/operations/dashboard/`: `ContainerCard.spec.ts` (state text for all seven states, "not running" icon, health only when not `null`, relative start time with the exact time, protected marker, role label with an unknown role value shown as "Other" (plain value, not mocked), header `<button aria-expanded>`, list item heading), `ContainerResources.spec.ts` (polling only while running, stop on `409`), `ContainerSummary.spec.ts` and `ContainerFilters.spec.ts` (address state), and `useStoppedAnnouncer.spec.ts` (one announcement per running → not running transition).
- [ ] T053 [P] [US1] Create `tests/smoke/operations.smoke.spec.ts` with the dashboard cases (research R21): as `admin` against the dev stack with outbound fakes, the dashboard shows the fake host figures and every fake container; tagged `@operations @read-only`; one case at 360 × 780 without horizontal scroll.

### Implementation for User Story 1

- [ ] T054 [US1] Implement `src/features/operations/dashboard/api.ts`: the live queries `['monitoring','live','host']`, `['monitoring','live','containers']` (`limit = LIST_LIMIT_MAX`, `sort=name`), `['monitoring','live','resource-usage',name]` and `['monitoring','live','mail-storage']` with `refetchInterval` from `useLiveUpdates`, `refetchIntervalInBackground: false`, `retry: false`, and the skew update of `useHostClock`; and `['monitoring','installation']` with `refetchOnMount: 'always'` (data-model §3).
- [ ] T055 [P] [US1] Implement `src/features/operations/dashboard/container-list.ts` and `src/features/operations/dashboard/uptime.ts`, so that T049 passes.
- [ ] T056 [P] [US1] Implement `src/features/operations/charts/scale.ts`, `src/features/operations/charts/LiveLineChart.vue` and `src/features/operations/charts/ChartValuesTable.vue`, so that T050 passes.
- [ ] T057 [P] [US1] Implement `src/features/operations/dashboard/components/{HostSection,VersionLine,CpuMemorySection,MailStorageSection}.vue`, loading `LiveLineChart` with `defineAsyncComponent` behind a fixed-height placeholder, each section with its loading placeholders, `SectionError` and `FreshnessIndicator`, so that T051 passes.
- [ ] T058 [US1] Implement `src/features/operations/dashboard/components/{ContainerSummary,ContainerFilters,ContainerList,ContainerCard,ContainerResources}.vue` and `src/features/operations/dashboard/composables/useStoppedAnnouncer.ts` (cards as a `<ul>`; filter, search and sort through `useListState`; the expanded panel with its own series), so that T052 passes.
- [ ] T059 [US1] Implement `src/features/operations/dashboard/pages/DashboardPage.vue` (`useLiveUpdates`, `LiveUpdatesBar`, the manual refresh, the `expand` prop) and add the `operations-dashboard` and `operations-container` routes to `src/features/operations/routes.ts`; set the catalogue's `dashboard` entry to `available` in `src/app/navigation/catalogue.ts`.
- [ ] T060 [US1] Add the `operations.dashboard.*`, `operations.containers.*` (health values, summary, filters, sort, resource labels, "collecting data"; state and role labels come from T005) messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, and `src/i18n/legacy-map.json` entries for `debug.system_containers`, `debug.architecture`, `debug.current_time`, `debug.timezone`, `debug.uptime`, `debug.disk_usage`, `debug.cores`, `debug.memory`, `debug.container_running`, `debug.container_stopped` and `debug.started_on`. Write the Slovak values missing upstream (`debug.architecture`, `debug.current_time`, `debug.timezone`, `debug.cores`, `debug.memory`, `debug.container_running`, `debug.container_stopped`) in `src/i18n/messages/sk-sk.json` (research R19). Run `npm run i18n:import`; `npm run i18n:check` must pass.

**Checkpoint**: US1 works on its own: T044–T053 pass. This is the MVP; it replaces the legacy System
& Containers tab without actions.

---

## Phase 4: User Story 2 - Restart, stop and start a container (Priority: P1)

**Goal**: Start, stop and restart as the API allows, with role-aware confirmations, progress with
elapsed time, every outcome including "outcome unknown", and outcomes that survive leaving the
dashboard.

**Independent Test**: Against the mock, start, stop and restart containers in each state, including a
protected container and the API's own container, with every answer type, at 360 px and desktop width.

### Tests for User Story 2 (write first; must fail)

- [ ] T061 [US2] Implement in `tests/mocks/handlers/containers.ts` `startContainer`, `stopContainer`, `restartContainer` (outcomes `done` and `alreadyInState` with the container after the action and a new `startedAt`; `409 container-protected` with `container`; `502 container-action-failed` with `serviceMessage`; `404`; `503`; `504 outcome-unknown`; optional `Audit-Recorded: false`; a configurable delay) and `getContainer`; fill `tests/mocks/scenarios/operations/container-actions.ts` with `ops-container-actions` (an outcome per container: SOGo restarts after 3 s, ClamAV stopped, the database protected, the API's own container, a container that times out, one whose service refuses, one restarted without an audit record, one removed before the action, one `restarting` and one `paused`).
- [ ] T062 [P] [US2] Write `tests/e2e/operations/container-actions.spec.ts`:
  - `US2-AS1`, `SC-001`: Restart SOGo in two interactions after opening its card; the dialog names the container, the interruption and the graceful-restart notice; progress with elapsed time; no second action on that card; "Restarted" with the new start time, announced;
  - `US2-AS2`, `US2-AS3`: the database offers Restart but no Stop, with the protected explanation; the API's own container offers neither, with its explanation (FR-011);
  - `US2-AS4`, `SC-006`: a restart answered with `504` shows "Outcome unknown", reads the container once (`getContainer`), shows its state, sends the action exactly once, and offers the actions again;
  - `US2-AS5`, `US2-AS6`: Start without confirmation; "already running" says nothing changed;
  - `US2-AS7`: a refused stop shows the translated failure and the service's message as technical detail;
  - `US2-AS8`: Cancel and Escape send nothing and return focus to the action;
  - `FR-012`: the restart dialog of the reverse proxy and of the app's own web container warns that this app may be unavailable; the database and key-value store dialogs warn about other screens and the audit record;
  - `FR-013`: actions on other containers stay possible while one runs;
  - `FR-016`: `Audit-Recorded: false` shows the warning; `404` says the container no longer exists and refreshes; `503` says nothing changed;
  - `Edge: restart of the reverse proxy`: with `route.abort()` on the restart request, "Outcome unknown", polling continues, the state appears when the API answers;
  - `Edge: leaving the dashboard`: navigating to the Logs during a restart shows the outcome as a status message there, which stays until dismissed;
  - `Edge: transitional states`: `restarting` and `paused` cards show the state in text and only the actions the API reports.
- [ ] T063 [P] [US2] Write `tests/unit/features/operations/dashboard/useContainerAction.spec.ts`: the state machine of data-model §7; confirmation only for stop and restart; no automatic repeat in any state; network failure → `outcomeUnknown` → `getContainer`; `setQueryData` of the returned container into the list; `auditRecorded` passed through; with the component unmounted while pending, the outcome is pushed to `useStatusMessage` and announced (TanStack v5 `useMutation` callbacks).
- [ ] T064 [P] [US2] Write `tests/unit/features/operations/dashboard/ContainerActions.spec.ts`: exactly `availableActions` rendered; explanations for protected and API containers; the confirmation content per role (proxy and webApp, database and keyValueStore, other protected, unprotected); elapsed time shown while pending and not announced every second.
- [ ] T065 [P] [US2] Add to `tests/smoke/operations.smoke.spec.ts`: as `admin`, restart SOGo through the fake container service and see "Restarted"; the database card offers no Stop.

### Implementation for User Story 2

- [ ] T066 [US2] Add the `startContainer`, `stopContainer`, `restartContainer` and `getContainer` mutations and query to `src/features/operations/dashboard/api.ts`, and implement `src/features/operations/dashboard/composables/useContainerAction.ts` (research R8), so that T063 passes.
- [ ] T067 [US2] Implement `src/features/operations/dashboard/components/ContainerActions.vue` (buttons, `useConfirm` with role-specific rich content, progress, outcomes with technical detail) and place it in `src/features/operations/dashboard/components/ContainerCard.vue`, so that T064 and T062 pass.
- [ ] T068 [US2] Add the `operations.containers.actions.*` messages (actions, confirmations per role, progress, outcomes, "outcome unknown", without an audit record) and `problem.*` wording for `container-protected`, `container-not-running`, `container-action-failed`, `outcome-unknown` and `temporary-failure` to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, with `src/i18n/legacy-map.json` entries for `footer.restart_container`, `footer.restart_now`, `footer.restarting_container` and `footer.restart_container_info` (with `stripMarkup`). `npm run i18n:check` must pass.

**Checkpoint**: US1 and US2 work on their own.

---

## Phase 5: User Story 3 - Read and search mailcow's logs (Priority: P1)

**Goal**: All 12 log types with grouped type choice, the type's fields and filters, search, time
range and severity in the address, duplicate-free loading of older entries, readable cards on
phones, copy, retention notes and the rate limit reset.

**Independent Test**: Against a mock with every log type, all severities, decoded multi-line messages,
masked secrets, long messages and more entries than one page, open each type at 360 px and desktop
width, use every filter, the search, the order and "load older" while entries are added.

### Tests for User Story 3 (write first; must fail)

- [ ] T069 [US3] Create `tests/mocks/factories/log-entry.ts`: entries of all 12 schemas with stable cursor `id`s, every severity and priority, decoded messages with line breaks, a 2,000-character message without spaces, masked `*` values in legacy request data and calls, watchdog health and message entries, autodiscover `activesync` and `imap` services, login entries with the `WEBUI` label, rate limit entries with valid, `null` and malformed hashes.
- [ ] T070 [US3] Implement the 12 log operations in `tests/mocks/handlers/logs.ts`: sort by time with `order`; `from`/`to` inclusive; `severity`; the type's filters as case-insensitive substrings with OR within a filter; `q` over the documented fields; `limit`/`offset`; `before` keeping only entries older than the cursor (and, when the cursor is unknown, strictly older than its time) with `offset` 0; `meta.total`; entries pushed between requests through the scenario; `503` injection; `422` for a malformed cursor.
- [ ] T071 [US3] Fill `tests/mocks/scenarios/operations/logs.ts` with `ops-logs-large` (10,000 Postfix entries plus a few of every other type; new entries pushed on every request), `ops-logs-empty`, `ops-logs-unavailable` (`503` on Postfix and Dovecot) and `ops-rate-limits` (rate limit entries for three buckets, the reset handler of UI 006 answering `204` once per bucket and `404` after).
- [ ] T072 [P] [US3] Write `tests/e2e/operations/logs.spec.ts`:
  - `US3-AS1`, `SC-010`: Postfix shows the newest first with the total 10,000; "Load older entries" adds 50 below twice without duplicates while entries arrive;
  - `US3-AS2`: `ALICE@example.org` matches case-insensitively once typing stops; the count is announced;
  - `US3-AS3`: severity "Error" lists only error entries, each marked "Error" in text;
  - `US3-AS4`, `SC-009`: at 360 px each entry is a card with time, severity and source on the first line; the 2,000-character token wraps; long messages collapse after four lines and expand; copy copies the full entry;
  - `US3-AS5`: a legacy API request with a password shows `*` in its details;
  - `US3-AS6`: type, search and filters survive a reload and open the same view in a new context;
  - `US3-AS7`: a range without entries shows "no matching entries" with "Clear filters";
  - `US3-AS8`: `ops-logs-unavailable` says the log is temporarily unavailable with a retry;
  - `FR-030`: the Logs index groups in-memory, external (with Rspamd once US6 is done) and stored logs; on a log, a `<select>` switches the type, with no tab row;
  - `FR-031`, `FR-032`: for each of the 12 types, the entry and detail fields of the spec's table, cards at 360 px and a table with those columns on desktop; autodiscover labels "ActiveSync" and "IMAP, SMTP, Cal-/CardDAV"; the watchdog change with sign and direction in text (FR-034);
  - `FR-035`: each type offers exactly its filters; the active filter count; chips remove one; one action clears all;
  - `FR-036`: "Oldest first" offers "Load newer entries" and never duplicates;
  - `FR-038`: no automatic request; "Refresh" reloads the newest page and updates "Loaded at";
  - `FR-040`: each log names its retention, including the configured length from the capabilities; the index links to the audit log;
  - `FR-041`: the device time zone is stated; times show to the second on each entry;
  - `FR-042`, `FR-044`: legacy UI activity shows the message key and parameters; logins show the reported label;
  - `FR-043`: loading placeholders, no entries, error with retry, and a failed refresh that keeps the entries with an error notice;
  - `Edge: unknown log type`: `/ng/operations/logs/unknown` shows "not found" with a link to the Logs index;
  - `Edge: decoded line breaks` are kept.
- [ ] T073 [P] [US3] Write `tests/e2e/operations/rate-limits.spec.ts`: `US3-AS9` "Reset rate limit" asks for confirmation naming the rate limit and its consequences, resets through `resetRateLimitBucket`, and refreshes the log without that bucket's entries; `FR-039` "Show entries of this rate limit" sets the search to the hash; a second reset says it was already reset; entries with a `null` or malformed hash offer no reset; `SC-007` nothing is sent before confirming.
- [ ] T074 [P] [US3] Write `tests/unit/features/operations/logs/log-types.spec.ts`: for each descriptor, `operationPath` exists in `contract/openapi.json`, every filter name is a query parameter of that operation, `hasSeverity` equals whether the operation accepts `severity`, and `retentionKey` is a property of `MonitoringCapabilities.logRetention`; and `tests/unit/features/operations/logs/list-state.spec.ts` (the address parameters of data-model §5 per type, unknown filters dropped).
- [ ] T075 [P] [US3] Write `tests/unit/features/operations/logs/api.spec.ts` (newest first: the next page sends `before` = the oldest shown `id` with `offset` 0; oldest first: the next page sends `offset` = entries shown; duplicates by `id` are dropped; the total comes from the first page; "Refresh" resets to the first page; `staleTime` Infinity) and `tests/unit/features/operations/logs/entry-text.spec.ts` (the copied text of each type as `field: value` lines, including request data and calls as JSON).
- [ ] T076 [P] [US3] Write component tests in `tests/unit/features/operations/logs/`: `LogMessage.spec.ts` (text interpolation only, `pre-wrap`, `overflow-wrap: anywhere`, "Show all" only when clamped content overflows, FR-033), `LogEntryCard.spec.ts`, `LogEntryTable.spec.ts` (header cells, `aria-sort` on the time column), `LogEntryDetails.spec.ts`, `LogFilters.spec.ts` (300 ms debounce, clear, severity checkboxes, type filters, `from ≤ to`), `RetentionNote.spec.ts` (each policy, the configured length), `TimeZoneNote.spec.ts`, `LogTypeSelect.spec.ts` (grouped `<optgroup>`s) and `RateLimitActions.spec.ts` (the bucket pattern gate).
- [ ] T077 [P] [US3] Add to `tests/smoke/operations.smoke.spec.ts`: push a Postfix line into the dev stack's Redis (`LPUSH POSTFIX_MAILLOG`, API 011 quickstart Part B), then find it in the Postfix log by searching `ALICE@example.org` with severity "Error"; tagged `@read-only` except for the push.

### Implementation for User Story 3

- [ ] T078 [US3] Implement `src/features/operations/logs/log-types.ts`, `src/features/operations/logs/list-state.ts` and `src/features/operations/logs/entry-text.ts`, so that T074 and the entry-text part of T075 pass.
- [ ] T079 [US3] Implement `src/features/operations/logs/api.ts` (one `useInfiniteQuery` factory over the 12 operations, the paging of research R11, the `id` guard), so that T075 passes.
- [ ] T080 [P] [US3] Implement `src/features/operations/logs/components/{LogMessage,LogEntryCard,LogEntryTable,LogEntryDetails,LogEntryList}.vue` (cards below `md`, tables from `md`, details in place, copy through `clipboard.ts`).
- [ ] T081 [P] [US3] Implement `src/features/operations/logs/components/{LogFilters,LogTypeSelect,RetentionNote,TimeZoneNote}.vue` (shared `time-range.ts` and `ActiveFilterChips`, announcements of the new count).
- [ ] T082 [US3] Implement `src/features/operations/logs/components/RateLimitActions.vue` with UI 006's reset mutation and confirmation (research R12), so that its part of T076 passes.
- [ ] T083 [US3] Implement `src/features/operations/logs/pages/LogIndexPage.vue` and `src/features/operations/logs/pages/LogPage.vue` (`ListState` states, "Load older/newer entries", "Refresh" with "Loaded at", the not-found case), add the `operations-logs` and `operations-log` routes to `src/features/operations/routes.ts`, and set the catalogue's `logs` entry to `available`, so that T072 and T073 pass.
- [ ] T084 [US3] Add the `operations.logs.*` messages (type names and explanations, groups, field labels per type, filters, retention texts with `{maxEntries}`, time zone note, rate limit actions; severity and retention policy labels come from T005) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, with `src/i18n/legacy-map.json` entries for `debug.in_memory_logs`, `debug.external_logs`, `debug.static_logs`, `debug.logs`, `debug.service`, `debug.username`, `debug.login_time`, `admin.priority`, `admin.message`, `admin.rate_name`, `admin.authed_user`, `admin.task`, `admin.time`, `admin.refresh` and `admin.reset_limit`, and a new key for the reset explanation (legacy `admin.hash_remove_info` explains the colour stripes this feature drops); write the Slovak value of `admin.task` in `src/i18n/messages/sk-sk.json`. `npm run i18n:check` must pass.

**Checkpoint**: US1 to US3 work on their own.

---

## Phase 6: User Story 4 - Manage the mail queue (Priority: P1)

**Goal**: The queue with counts per queue, filters, sorting and paging in the address, cards and
table, selection by page or all matching up to the API limit, one-request actions with per-message
results, flush, an acknowledged delete all, the audited content viewer, and the Postfix-stopped state.

**Independent Test**: Against a mock with messages in every queue, deferral reasons, a truncated list
and IDs that disappear, list, filter, sort and page at 360 px and desktop width, view a message,
apply each action, flush and delete all, and check requests, confirmations and results.

### Tests for User Story 4 (write first; must fail)

- [ ] T085 [US4] Create `tests/mocks/factories/mail-queue.ts`: messages in all five queues with hexadecimal IDs, recipients with and without deferral reasons, bounces with an empty sender, `forcedExpiry` true, false and `null`, and content of a given size (up to 10 MiB, including multi-byte characters).
- [ ] T086 [US4] Implement in `tests/mocks/handlers/mail-queue.ts` `listMailQueueMessages` (filters, `q`, sort with ties by ID, paging, `meta.truncated` above the listing limit, `meta.queueCounts` over everything), `bulkMailQueueMessages` (one result per distinct ID in request order, `done` or `notFound`; `422` above the bulk limit or for a non-hexadecimal ID), `getMailQueueMessageContent` (`404` when gone), `flushMailQueue` and `purgeMailQueue` (`MailQueueActionResult`), with `409 mail-service-not-running` (`container: postfix-mailcow`), `502 queue-action-failed` (`serviceMessage`), `504 outcome-unknown` and `Audit-Recorded: false` injection.
- [ ] T087 [US4] Fill `tests/mocks/scenarios/operations/mail-queue.ts` with `ops-queue` (8 messages, 3 deferred to `partner.example`), `ops-queue-large` (12,000 reported: truncated, 1,400 held from `spam@compromised.example`), `ops-queue-empty`, `ops-queue-postfix-stopped`, `ops-queue-timeout`, `ops-queue-failure` and `ops-queue-vanishing` (one selected ID delivered before the action; one message gone before its content is viewed).
- [ ] T088 [P] [US4] Write `tests/e2e/operations/mail-queue.spec.ts`:
  - `US4-AS1`, `SC-002`: filtering the deferred queue by recipient `partner.example` lists exactly 3 messages with recipients and deferral reasons; done within a minute on 360 px;
  - `US4-AS2`: 4 selected with one delivered meanwhile → Hold sends one request; "3 held, 1 no longer in the queue"; the list refreshes;
  - `US4-AS3`: Delete of 2 asks for confirmation naming 2 and "cannot be undone"; the result is announced;
  - `US4-AS5`: Flush says Postfix accepted it, delivery continues in the background, held messages stay on hold, and refreshes;
  - `US4-AS6`, `SC-007`: "Delete all" states the exact total including held messages and arrivals, and its Delete button stays disabled until the acknowledgement is ticked; nothing is sent before;
  - `US4-AS7`, `FR-060`: `ops-queue-postfix-stopped` says the queue cannot be read because `postfix-mailcow` is not running, with a link to its card;
  - `US4-AS8`, `FR-052`: `ops-queue-large` says only the first 10,000 are listed and that whole-queue actions affect every message;
  - `US4-AS9`, `FR-055`: filtering by the spam sender and "Select all matching" selects 1,000 of 1,400 and says so; Delete sends one request with 1,000 IDs after the confirmation;
  - `FR-050`: header and queue filter show the count per queue; filters, sort, page and size kept across a reload;
  - `FR-051`: cards at 360 px (sender or "empty sender (bounce)", first recipient with "+ n more", first reason, queue, age, size, forced-expiry marker), the rest without leaving the list; a table on desktop with `aria-sort`;
  - `FR-053`: the help panel explains the queue and each action;
  - `FR-056`: deliver now, hold and release are sent without a confirmation;
  - `FR-054`, `FR-080`: selection mode on phones with checkboxes and a sticky action bar naming the count; the selection clears when page, search, filters, sort or size change; the focused element is never hidden behind the bar;
  - `FR-059`: `ops-queue-timeout` says "outcome unknown", refreshes and does not repeat; `ops-queue-failure` shows the translated failure with Postfix's message as technical detail; `route.abort()` on an action is "outcome unknown", never retried;
  - `FR-062`: loading, empty queue (positive message), no matching messages with "Clear filters", error with retry; no automatic refresh except after an action;
  - `FR-016`/`FR-076`: `Audit-Recorded: false` on an action shows the warning.
- [ ] T089 [P] [US4] Write `tests/e2e/operations/queue-content.spec.ts`: `US4-AS4` opening a message shows the queue ID, the audit notice and the content verbatim as plain text in a fixed-width font (HTML in the content is shown as text), with copy; `FR-061` full screen at 360 px and a large dialog on desktop, wrapping on by default with a switch, the first 256 Ki characters of a 10 MiB message then "Show the rest", copy of the complete content (clipboard checked), deliver now, hold, release and delete from the viewer; the address `/ng/operations/mail-queue/messages/<id>` opens it directly; `SC-011` the first view is readable within 2 s after the response; closing and reopening requests the content again (discarded); `Edge: message left the queue`: "no longer in the queue" with a way back, and it leaves the list.
- [ ] T090 [P] [US4] Write `tests/unit/features/operations/mail-queue/list-state.spec.ts`, `tests/unit/features/operations/mail-queue/useQueueSelection.spec.ts` (page mode through `useBulkSelection` with `maxItems` from the capabilities and targets without `version`; matching mode with `limit = min(total, bulk limit)`, paging in steps of `limits.maxPageSize` when the bulk limit is larger, the capped flag; clearing on list state changes and after an action) and `tests/unit/features/operations/mail-queue/content.spec.ts` (262,144 code units, no split surrogate pair, the remaining length).
- [ ] T091 [P] [US4] Write component tests in `tests/unit/features/operations/mail-queue/`: `QueueHeader.spec.ts` (total and counts per queue), `QueueFilters.spec.ts`, `QueueMessageCard.spec.ts`, `QueueMessageTable.spec.ts`, `PurgeQueueDialog.spec.ts` (count read when opened, disabled until ticked, Escape closes unless sending, focus returns), `MessageContentViewer.spec.ts` (no `v-html`, wrap switch, show the rest, copy complete, cache entry removed on close) and `MailServiceStopped.spec.ts` (link from `problem.container`, rendered only when the container route exists).
- [ ] T092 [P] [US4] Add to `tests/smoke/operations.smoke.spec.ts`: as `admin`, the mail queue lists the fake queue with its counts per queue; tagged `@read-only`.

### Implementation for User Story 4

- [ ] T093 [US4] Implement `src/features/operations/mail-queue/api.ts` (list, IDs for "select all matching", counts, content with `gcTime` 0 and removal on close, bulk action, flush, purge, with the invalidation of data-model §3) and `src/features/operations/mail-queue/list-state.ts`.
- [ ] T094 [P] [US4] Implement `src/features/operations/mail-queue/useQueueSelection.ts` and `src/features/operations/mail-queue/content.ts`, so that T090 passes.
- [ ] T095 [P] [US4] Implement `src/features/operations/mail-queue/components/{QueueHeader,QueueHelp,QueueFilters,QueueList,QueueMessageCard,QueueMessageTable,MailServiceStopped}.vue`. `MailServiceStopped` renders the link to the container's card only when `router.hasRoute('operations-container')` (US1), so no link is ever broken.
- [ ] T096 [P] [US4] Implement `src/features/operations/mail-queue/components/PurgeQueueDialog.vue` (Reka `AlertDialog`) and `src/features/operations/mail-queue/components/MessageContentViewer.vue` (research R15).
- [ ] T097 [US4] Implement `src/features/operations/mail-queue/pages/MailQueuePage.vue`: `useListState`, `ListState`, `PaginationBar`, the selection mode with UI 002's `BulkActionBar`, the actions with `useConfirm` for delete, UI 002's `BulkResultSummary` for results, flush, delete all, the truncation notice, the viewer route; add the `operations-mail-queue` and `operations-mail-queue-message` routes to `src/features/operations/routes.ts`, and set the catalogue's `mailQueue` entry to `available`, so that T088, T089 and T091 pass.
- [ ] T098 [US4] Add the `operations.queue.*` messages (queue labels come from T005; counts, filters, actions, confirmations, results, truncation, viewer, delete-all acknowledgement, Postfix stopped) and `problem.*` wording for `mail-service-not-running` and `queue-action-failed` to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, with `src/i18n/legacy-map.json` entries for `queue.queue_manager`, `queue.legend`, `queue.deliver_mail`, `queue.deliver_mail_legend`, `queue.hold_mail`, `queue.hold_mail_legend`, `queue.unhold_mail`, `queue.unhold_mail_legend`, `queue.flush`, `queue.delete`, `queue.show_message`, `queue.info` (with `stripMarkup`), `admin.arrival_time`, `admin.message_size`, `admin.sender`, `admin.recipients` and `success.queue_command_success`. `npm run i18n:check` must pass.

**Checkpoint**: All P1 stories (US1 to US4) work on their own.

---

## Phase 7: User Story 5 - Configure the ban service and act on bans (Priority: P2)

**Goal**: The ban service screen with active and permanent bans and their actions, the bounded
pending-lift refresh, versioned section saves of parameters (with units), lists (line errors,
own-address warning) and external enforcement with rotation, the rules editor with reset, and
"Restart netfilter".

**Independent Test**: Against the mock, read and change every setting, list and rule with valid and
invalid values, act on active and permanent bans, rotate the address, reset the rules, and simulate
an outdated save and a stopped ban service.

### Tests for User Story 5 (write first; must fail)

- [ ] T099 [US5] Create `tests/mocks/factories/fail2ban.ts`: settings (stored and defaults, with `etag`), rules, active bans (IPv4 and IPv6 networks, some queued for lifting), permanent bans.
- [ ] T100 [US5] Implement the 11 ban service operations in `tests/mocks/handlers/fail2ban.ts`: `If-Match` and `412`; merge patch with the documented rules (`outOfRange` with `min`, `max`, `minField`; `mustNotExceed`; `invalidFormat` with `ipNetworkOrHostname` or `ipNetwork`; `reserved`; `conflictsWith`; `tooMany`; `tooLong`; errors at `allowlist.<n>`/`denylist.<n>`); rules replacement (`tooShort`, `tooLong`, `tooMany`, `required`, `invalidRegex` with `error`, `missingCaptureGroup` at `rules.<n>`); reset (`200`, `504 ban-rules-not-restored`, `504 outcome-unknown`, `502`); rotation; active bans list with `queuedForLifting` filter, sort and search, where a lifted ban disappears after a configurable number of reads; lift, allowlist, denylist with `404` for an ended ban; permanent bans; `banServiceRunning` per scenario; `Audit-Recorded: false` injection.
- [ ] T101 [US5] Fill `tests/mocks/scenarios/operations/fail2ban.ts` with `ops-fail2ban` (stored settings with ban time 1,800 s and maximum 10,000 s, three active bans, two permanent bans, default rules), `ops-fail2ban-legacy-values` (stored ban time 30 s), `ops-fail2ban-not-running`, `ops-fail2ban-changed-elsewhere` (the settings change between the read and the save), `ops-fail2ban-rules-not-restored`, `ops-fail2ban-client-in-denylist` (an active ban whose network covers `clientAddress` `198.51.100.7`) and `ops-fail2ban-empty`.
- [ ] T102 [P] [US5] Write `tests/e2e/operations/fail2ban-bans.spec.ts`:
  - `US5-AS1`: "Lift ban" marks the ban "lift pending" at once and it leaves the list after the bounded refresh;
  - `US5-AS2`: "Lift and allowlist" updates the allowlist and denylist, marks the ban pending and says so;
  - `US5-AS9`: "Denylist" asks for confirmation naming the network and the permanent ban; nothing is sent before; on `ops-fail2ban-client-in-denylist` the confirmation warns about the own address;
  - `FR-063`: sections in order with a section index at 360 px; `/ng/operations/fail2ban/bans`, `/settings` and `/rules` focus their section;
  - `FR-064`: paging, network search, sort by end time (default) or network, the pending filter, all in the address with the `b…` keys;
  - `FR-065`: the refresh runs at the capabilities' interval only while visible and not paused, and stops 60 s after the last lift (`page.clock`); `404` says the ban already ended and refreshes;
  - `FR-066`: "Remove from denylist" saves the denylist without the entry with `If-Match`; a `412` reloads and asks again;
  - `FR-017`: "Restart netfilter" confirms, shows progress and the outcome as on the dashboard, found by the `banService` role;
  - `FR-073`: `ops-fail2ban-not-running` says changes take effect and lifts are processed once it runs;
  - `FR-074`: loading, no active bans, no permanent bans, error states.
- [ ] T103 [P] [US5] Write `tests/e2e/operations/fail2ban-settings.spec.ts`:
  - `US5-AS3`: ban time 30 seconds shows the range error on the field and sends nothing;
  - `US5-AS4`: a denylist with `0.0.0.0/0` refused by the API (and by the client) names the entry with its line and translated reason, and keeps the input;
  - `US5-AS5`: on `ops-fail2ban-changed-elsewhere` the save is stopped, the input kept, and the values changed by the other administrator marked with their new saved values; "Save again" and "Discard";
  - `US5-AS6`: reset rules with confirmation shows the defaults the API returns; on `ops-fail2ban-rules-not-restored` the explanation and "Reload", with no second reset request;
  - `US5-AS7`: generating a new ban list address after a confirmation that the old one stops working shows the new address with copy;
  - `US5-AS8`: a save while the ban service is not running says it takes effect once it runs;
  - `US5-AS10`: a stored 1,800 s shows 30 minutes; entering 2 hours sends 7,200;
  - `FR-067`: each section read-only with its own Edit; full screen at 360 px with sticky Save and Cancel, in place on desktop; only the section's changed values are sent, always with `If-Match`;
  - `FR-068`: `ops-fail2ban-legacy-values` shows 30 s as stored and accepts a save that leaves it unchanged;
  - `FR-069`: one entry per line with a count; trimmed, empty lines ignored, duplicates kept once; the own-address warning when a new entry covers `198.51.100.7`; the list limit from the capabilities;
  - `FR-071`: rules numbered; add, edit, remove, Move up/Move down by keyboard with focus kept and the new position announced; 0 rules and too-long rules refused before sending; `invalidRegex` and `missingCaptureGroup` shown on their rule with the compiler message as technical detail;
  - `FR-074`: leaving with unsaved changes asks for confirmation;
  - `FR-077`: several field errors produce an error summary whose entries lead to their fields;
  - `FR-081`: numeric keypad for numbers; no auto-capitalisation or correction in list and rule fields;
  - `Edge: network on both lists`: refused with the entry named, input kept;
  - `Edge: temporary failure on a save`: a `503` says nothing was changed and offers a retry that keeps the input.
- [ ] T104 [P] [US5] Write unit tests in `tests/unit/features/operations/fail2ban/`: `limits.spec.ts` (each range's text occurs verbatim in `Fail2BanSettingsPatch.description` of `contract/openapi.json`; `maxLength` 253 and `maxItems` match the schema), `duration.spec.ts` (1,800 → 30 minutes, 10,000 → 10,000 seconds, 86,400 → 1 day, round trips), `list-entries.spec.ts` (trim, empty lines, duplicates, line map, client checks of data-model §6, host name labels) and `covers-address.spec.ts` (IPv4 and IPv6 addresses and prefixes, `/0`, mixed families, invalid input).
- [ ] T105 [P] [US5] Write `tests/unit/features/operations/fail2ban/usePendingLifts.spec.ts` (refresh at the interval while a ban is pending, visible and running; stop after 60 s or when none is pending; paused by inactivity) and `tests/unit/features/operations/fail2ban/list-state.spec.ts` (prefixed `b…` and `p…` keys and `edit`).
- [ ] T106 [P] [US5] Write component tests in `tests/unit/features/operations/fail2ban/`: `DurationField.spec.ts`, `ParametersSection.spec.ts` (changed values only, ranges, maximum not below ban time, `If-Match`), `EntryListField.spec.ts` (count, errors by line), `ListsSection.spec.ts` (own-address warning in the save confirmation), `ExternalSection.spec.ts` (copy, rotation confirmation), `RulesSection.spec.ts` and `RuleEditor.spec.ts` (reorder by keyboard, limits from the capabilities, errors per rule, reset outcomes), `ActiveBanItem.spec.ts` (actions only when not pending, denylist confirmation content) and `BanServiceNotice.spec.ts`.
- [ ] T107 [P] [US5] Add to `tests/smoke/operations.smoke.spec.ts`: as `admin`, change the ban time to 2 hours with `If-Match`, see 2 hours after a reload, and restore the original value.

### Implementation for User Story 5

- [ ] T108 [US5] Implement `src/features/operations/fail2ban/api.ts` (settings and rules with `etag` → `If-Match` always; active and permanent bans; lift, allowlist, denylist; rotation; replacement; reset; the invalidation of data-model §3) and `src/features/operations/fail2ban/list-state.ts`.
- [ ] T109 [P] [US5] Implement `src/features/operations/fail2ban/limits.ts`, `duration.ts`, `list-entries.ts` and `covers-address.ts`, so that T104 passes.
- [ ] T110 [P] [US5] Implement `src/features/operations/fail2ban/usePendingLifts.ts` on `useLiveUpdates`, so that T105 passes.
- [ ] T111 [P] [US5] Implement `src/features/operations/fail2ban/components/{DurationField,ParametersSection}.vue` on UI 002's `EditableSection` and `useVersionedSave`.
- [ ] T112 [P] [US5] Implement `src/features/operations/fail2ban/components/{EntryListField,ListsSection,ExternalSection}.vue`.
- [ ] T113 [P] [US5] Implement `src/features/operations/fail2ban/components/{RulesSection,RuleEditor}.vue`.
- [ ] T114 [P] [US5] Implement `src/features/operations/fail2ban/components/{ActiveBansSection,ActiveBanItem,PermanentBansSection,BanServiceNotice,RestartNetfilterButton}.vue`; `RestartNetfilterButton` reuses `useContainerAction` and `ContainerActions` of US2 for the container with role `banService`.
- [ ] T115 [US5] Implement `src/features/operations/fail2ban/pages/Fail2banPage.vue` and `src/features/operations/fail2ban/components/SectionIndex.vue` (section order, section focus from `:section`, UI 002's `useLeaveGuard`), add the `operations-fail2ban` and `operations-fail2ban-section` routes to `src/features/operations/routes.ts`, and set the catalogue's `fail2ban` entry to `available`, so that T102, T103 and T106 pass.
- [ ] T116 [US5] Add the `operations.fail2ban.*` messages (sections, parameters with units, lists, own-address warning, external enforcement, rotation, rules, reset, bans, pending, not running) and `problem.*` wording for `ban-rules-not-restored`, plus `validation.*` wording for `reserved`, `conflictsWith`, `mustNotExceed`, `invalidRegex`, `missingCaptureGroup`, `outOfRange` with `minField` and the formats `ipNetwork` and `ipNetworkOrHostname`, to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, with `src/i18n/legacy-map.json` entries for `admin.f2b_parameters`, `admin.f2b_ban_time_increment`, `admin.f2b_max_attempts`, `admin.f2b_netban_ipv4`, `admin.f2b_netban_ipv6`, `admin.f2b_whitelist`, `admin.f2b_blacklist`, `admin.f2b_filter`, `admin.f2b_regex_info`, `admin.f2b_manage_external`, `admin.f2b_manage_external_info`, `admin.queue_unban`, `admin.unban_pending`, `admin.no_active_bans`, `admin.reset_default`, `header.restart_netfilter`, `success.f2b_modified` and `success.f2b_banlist_refreshed`; new keys where the meaning changed (research R19): the duration labels (legacy `admin.f2b_ban_time`, `admin.f2b_max_ban_time` and `admin.f2b_retry_window` say "(s)"), the list explanation (legacy `admin.f2b_list_info` says "a few seconds"), the ban list explanation (legacy `admin.ban_list_info` describes colours) and the rules-not-restored message (legacy `danger.reset_f2b_regex` says to try again). Write the Slovak values missing upstream (`admin.f2b_ban_time_increment`, `admin.f2b_manage_external`, `admin.f2b_manage_external_info`, `admin.queue_unban`, `success.f2b_banlist_refreshed`) in `src/i18n/messages/sk-sk.json`. `npm run i18n:check` must pass.

**Checkpoint**: US1 to US5 work on their own.

---

## Phase 8: User Story 6 - Review Rspamd's scan history and statistics (Priority: P2)

**Goal**: The Rspamd view with statistics, accessible proportional action bars with a summary and a
table alternative, and the paged, filterable scan history with symbols.

**Independent Test**: Against a mock with history entries of every action, symbols with positive,
negative and zero scores and statistics for every action, open the view at 360 px and desktop width,
use every filter and sort and the table alternative, and compare every value.

### Tests for User Story 6 (write first; must fail)

- [ ] T117 [US6] Create `tests/mocks/factories/rspamd.ts`, implement `getRspamdStatistics` and `listRspamdHistory` (filters by action, time and score range, `q` over the documented fields, sort by time, score, size and scan time, paging, `503`) in `tests/mocks/handlers/rspamd.ts`, and fill `tests/mocks/scenarios/operations/rspamd.ts` with `ops-rspamd` (a `reject` entry from `spammer@example.net` with positive, negative and zero symbols), `ops-rspamd-zero` (every action count zero) and `ops-rspamd-unavailable`.
- [ ] T118 [P] [US6] Write `tests/e2e/operations/rspamd.spec.ts`: `US6-AS1` the search for `spammer@example.net` shows the entry with "reject" in text, the score against the required score with above or below in text, and the symbols in the API's order with signed scores and options; `US6-AS2` scanned, learned, spam, ham and the per-action counts as figures, then the bars; `US6-AS3` the table alternative with the same counts and percentages and the text summary; `US6-AS4` `ops-rspamd-unavailable` says temporarily unavailable with a retry, separately for statistics and history; `FR-045` connections, control connections, statistics files, fuzzy hashes and the collection time, labelled "this server"; `FR-046` `ops-rspamd-zero` replaces the bars with "no messages were scanned yet"; `FR-047` the history labelled "all servers", paging 25/50/100, sorts, action, time and score filters and the search, all in the address; `FR-048` details without leaving the list: client address, user or "none", size, real and virtual scan time, message ID, all as plain text; `FR-049` loading, empty and no-matching states; the Logs index lists Rspamd in the external group.
- [ ] T119 [P] [US6] Write `tests/unit/shared/components/ProportionBarList.spec.ts`: one row per item with label, count and percentage in text; widths through a dynamic `:style` binding only; the optional summary sentence; the optional "Show as table" switch rendering a `<table>` with header cells and caption; the zero state; UI 006's existing usage still renders as before.
- [ ] T120 [P] [US6] Write component tests in `tests/unit/features/operations/rspamd/`: `RspamdStatistics.spec.ts`, `RspamdActionsChart.spec.ts` (summary names the most frequent action and its share), `RspamdHistoryEntry.spec.ts` (score relation text, "none" for no user), `RspamdSymbols.spec.ts` (order kept, signed scores), `RspamdFilters.spec.ts` (action checkboxes from the statistics, disabled with a reason when unavailable; `minScore ≤ maxScore`; decimal keypad) and `list-state.spec.ts`.

### Implementation for User Story 6

- [ ] T121 [US6] Promote UI 006's proportional bar list to `src/shared/components/ProportionBarList.vue` with the optional `summary` and `tableAlternative` props (research R13), update UI 006's import, and keep UI 006's tests passing, so that T119 passes.
- [ ] T122 [US6] Implement `src/features/operations/rspamd/api.ts` and `src/features/operations/rspamd/list-state.ts`.
- [ ] T123 [P] [US6] Implement `src/features/operations/rspamd/components/{RspamdStatistics,RspamdActionsChart,RspamdFilters,RspamdHistoryList,RspamdHistoryEntry,RspamdSymbols}.vue`, so that T120 passes.
- [ ] T124 [US6] Implement `src/features/operations/rspamd/pages/RspamdPage.vue`, add the `operations-rspamd` route (before `operations-log`) to `src/features/operations/routes.ts`, and list Rspamd in `src/features/operations/logs/pages/LogIndexPage.vue` and `src/features/operations/logs/components/LogTypeSelect.vue`, so that T118 passes.
- [ ] T125 [US6] Add the `operations.rspamd.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, with `src/i18n/legacy-map.json` entries for `debug.chart_this_server` and `debug.history_all_servers`. Action names, symbols, senders and subjects are shown as returned (FR-089). `npm run i18n:check` must pass.

**Checkpoint**: US1 to US6 work on their own.

---

## Phase 9: User Story 7 - Check for updates and look up the public addresses (Priority: P3)

**Goal**: The update status next to the version, safely rendered release notes of the new and the
installed version, and "Show public IP" when the IP check is enabled.

**Independent Test**: Against a mock with every update status, release notes with links, images and
HTML, and the IP check enabled, disabled and partly failing, open the dashboard and check what is
shown and that the notes are displayed safely.

### Tests for User Story 7 (write first; must fail)

- [ ] T126 [US7] Implement `getUpdateStatus` and `getPublicAddresses` in `tests/mocks/handlers/host.ts` (every status; notes with headings, tables, code, a remote image, raw `<script>`, `<img onerror>`, an `<iframe>`, a `javascript:` link and an https link; `409 ip-check-disabled`; an address `null`), and fill `tests/mocks/scenarios/operations/updates.ts` with `ops-update-up-to-date`, `ops-update-check-failed`, `ops-update-disabled`, `ops-ip-check-disabled`, `ops-ip-partial` (IPv6 `null`) and `ops-ip-disabled-meanwhile` (capabilities say enabled, the lookup answers `409`). `admin-operations` reports `updateAvailable` with notes and installed notes.
- [ ] T127 [P] [US7] Write `tests/e2e/operations/updates-addresses.spec.ts`: `US7-AS1` "update available" with the newest version; opening it shows the notes with the publication time and the release page link; `US7-AS2` "check failed" blocks nothing; `ops-update-disabled` shows only the version; `US7-AS3` "Show public IP" shows progress then both addresses, or "unavailable" for IPv6 on `ops-ip-partial`; `US7-AS4` `ops-ip-check-disabled` offers no button and explains where to switch the check on; `ops-ip-disabled-meanwhile` shows the same explanation after the refusal; `US7-AS5`, `FR-028`: the image appears as a link with its description and is not loaded, the HTML shows as text, links open in a new window marked as external with `rel="noopener noreferrer nofollow"`, and no request leaves the origin while the notes are open (`page.on('request')`); full screen at 360 px and a dialog on desktop; `FR-027` installed-version notes offered when present; `FR-025` progress and an error with retry for the notes and the lookup.
- [ ] T128 [P] [US7] Extend `tests/unit/shared/security/sanitize.spec.ts` and `tests/unit/shared/components/dialogs-and-lists.spec.ts` (`SanitizedHtml`): the `releaseNotes` profile keeps `p br strong em del h1–h6 ul ol li a blockquote code pre table thead tbody tr th td hr` with `href` and `align`, removes `img`, `style`, `class`, event handlers, `iframe`, `form`, `svg` and non-http(s)/mailto links, runs UI 001's injection vector table, and adds `target="_blank"`, `rel="noopener noreferrer nofollow"` and the translated hidden "(opens in a new window)" to links; the `operator` profile is unchanged (research R9).
- [ ] T129 [P] [US7] Write `tests/unit/features/operations/dashboard/render-release-notes.spec.ts`: raw HTML blocks and inline HTML are escaped as text; images become links labelled with their description (or "Image"); `javascript:` links render as text; tables, code blocks, lists, quotes and headings are kept; `marked` is imported dynamically.
- [ ] T130 [P] [US7] Write component tests in `tests/unit/features/operations/dashboard/`: `VersionLine.status.spec.ts` (each status, disabled shows only the version), `ReleaseNotesDialog.spec.ts` (full screen below `md`, dialog from `md`, labelled, Escape, focus return, renders through `SanitizedHtml` with `profile="releaseNotes"`) and `PublicAddresses.spec.ts` (offered only when `ipCheckEnabled`, progress, "unavailable", the explanation with the classic location).

### Implementation for User Story 7

- [ ] T131 [US7] Add the `releaseNotes` profile to `src/shared/security/sanitize.ts` and the `profile` prop to `src/shared/components/SanitizedHtml.vue`, so that T128 passes.
- [ ] T132 [US7] Implement `src/features/operations/dashboard/release-notes/render-release-notes.ts` with a dynamic import of `marked` and the renderer overrides of research R9, so that T129 passes.
- [ ] T133 [US7] Add the `['monitoring','update-status']` and `['monitoring','public-addresses']` queries to `src/features/operations/dashboard/api.ts` (data-model §3).
- [ ] T134 [US7] Implement `src/features/operations/dashboard/components/{ReleaseNotesDialog,PublicAddresses}.vue`, add the update status to `src/features/operations/dashboard/components/VersionLine.vue`, and place both in `src/features/operations/dashboard/components/HostSection.vue`, so that T127 and T130 pass.
- [ ] T135 [US7] Add the `operations.updates.*` messages (statuses, release notes, external link suffix, public addresses, IP check disabled) and `problem.ip-check-disabled` wording to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, with `src/i18n/legacy-map.json` entries for `debug.show_ip`, `debug.error_show_ip`, `debug.update_available`, `debug.no_update_available`, `debug.update_failed` and `admin.ip_check_disabled` (with `stripMarkup`); write their Slovak values missing upstream (`debug.show_ip`, `debug.error_show_ip`, `debug.update_available`, `debug.no_update_available`, `debug.update_failed`) in `src/i18n/messages/sk-sk.json`. `npm run i18n:check` must pass.

**Checkpoint**: US1 to US7 work on their own.

---

## Phase 10: User Story 8 - Trace operations (Priority: P3)

**Goal**: History actions on container cards, the mail queue, the ban settings and the rules that
open UI 001's audit log filtered to the target, with this feature's labels and the details shown as
stored (spec gap 10).

**Independent Test**: With audit records of every target type of this feature in the mock, open the
history from each entry point and check the filters and the presentation of each record.

### Tests for User Story 8 (write first; must fail)

- [ ] T136 [US8] Extend `tests/mocks/factories/audit-event.ts` with records of the 17 event types of this feature (targets `container`, `mailQueue`, `mailQueueMessage`, `fail2banSettings`, `fail2banRules`, `fail2banActiveBan`, `fail2banBanListId`; outcomes success and failure with `serviceFailure`, `rulesNotRestored`, `outcomeUnknown` and refusals), whose open `details` carry the members API 011 writes (for example `stateBefore`, `stateAfter`, `results` with 4 and with 400 queue IDs, `changes`, `allowlistAdded`, `oldRules`, `newRules`), and fill `tests/mocks/scenarios/operations/audit.ts` with `ops-audit-records`.
- [ ] T137 [P] [US8] Write `tests/e2e/operations/history.spec.ts`: `US8-AS1` a container card's History opens the audit log with `targetType=container&targetId=sogo-mailcow`, and the entry shows actor, time, client address, the translated action and outcome, and `stateBefore`/`stateAfter` as stored; `US8-AS2` the queue screen's History (`targetType=mailQueue`) shows a deletion's 4 queue IDs with their results, and a 400-ID record collapsed behind "Show all 400"; `US8-AS3` the ban settings' History (`targetType=fail2banSettings`) shows the old and new ban time and the allowlist entries added and removed as stored; `FR-075` the rules' History (`targetType=fail2banRules`); the seven target types are offered in the audit log's target filter; refusals and "outcome unknown" records show their translated reason; details are text only.
- [ ] T138 [P] [US8] Extend `tests/unit/features/audit-log/labels.spec.ts` (the 17 event types, 7 targets and the failure reasons `serviceFailure` and `rulesNotRestored` translated; unknown values still generic, with plain values) and write `tests/unit/features/audit-log/AuditEventDetails.spec.ts` (nested objects and arrays as nested definition lists, arrays longer than 10 collapsed behind "Show all <n>", values as text, no `v-html`).

### Implementation for User Story 8

- [ ] T139 [US8] Add the event type, target and failure reason labels of this feature to `src/features/audit-log/labels.ts`, so that the labels part of T138 passes.
- [ ] T140 [US8] Make `src/features/audit-log/components/AuditEventDetails.vue` shape-agnostic for nested values and long arrays (research R18), so that T138 passes.
- [ ] T141 [US8] Place UI 002's `HistoryLink` in `src/features/operations/dashboard/components/ContainerCard.vue` (`targetType=container`, `targetId` = name), `src/features/operations/mail-queue/pages/MailQueuePage.vue` (`targetType=mailQueue`), `src/features/operations/fail2ban/pages/Fail2banPage.vue` next to the settings sections (`targetType=fail2banSettings`) and `src/features/operations/fail2ban/components/RulesSection.vue` (`targetType=fail2banRules`), so that T137 passes.
- [ ] T142 [US8] Add the `auditLog.*` labels for this feature's event types, targets and failure reasons (final wording; an earlier contract bump may have added placeholders) and `operations.history.*` to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. `npm run i18n:check` must pass.

**Checkpoint**: All user stories work on their own.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story verification, budgets, validation and release readiness.

- [ ] T143 [P] Write and pass `tests/e2e/operations/reflow-and-keyboard.spec.ts`: every screen, dialog and viewer of this feature has no horizontal scroll at 320 px and at 400 % zoom (320 CSS px on a 1,280 px desktop) (FR-079, SC-009); each user story's main path completes with the keyboard alone with visible focus (FR-082); no focused element hides behind the sticky header, the selection bar or the form actions (WCAG 2.4.11); under `prefers-reduced-motion: reduce` no element of this feature has a running transition or animation, and nothing blinks at any setting (FR-084).
- [ ] T144 [P] Write and pass `tests/e2e/operations/performance.spec.ts` (research R22, SC-011, FR-091): opening the logs, the mail queue and the ban screen requests no `LiveLineChart-*.js` and no `marked` chunk; on the dashboard, with the chart chunk delayed through `page.route`, the figures are visible before the charts; the release-notes chunk is requested only when the notes open.
- [ ] T145 [P] Write and pass `tests/unit/features/operations/contract-usage.spec.ts`: every operation listed in `specs/011-monitoring-operations/contracts/README.md` is referenced by its path in `src/features/operations/**` (or by UI 006's and UI 001's modules for `resetRateLimitBucket` and `listAuditEvents`), and no other `/host`, `/containers`, `/logs`, `/rspamd`, `/mail-queue` or `/fail2ban` path is used.
- [ ] T146 Run `npm run build && npm run budget:check && npm run lhci`. Fix regressions until the initial JavaScript is at most 204,800 bytes gzipped, the per-chunk budgets of `scripts/bundle-budgets.json` hold, and performance and accessibility are at least 0.9 on `/ng/operations/dashboard` as well as on UI 001's collections.
- [ ] T147 [P] Reconcile `THIRD_PARTY_NOTICES.md` with the icons added in T010 and confirm `npm run licenses:check` with `marked`.
- [ ] T148 [P] Run `npm run i18n:check`, remove the unused keys it reports from `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, and list this feature's new cs-cz and sk-sk strings for the owner's review (UI 001 owner question 4).
- [ ] T149 Run `quickstart.md` Part B on a mid-range Android phone and an iPhone with `npm run preview:mock` on the local network; record SC-001, SC-002 and SC-011 timings and a VoiceOver and TalkBack pass of every user story in a "Validation log" section appended to `specs/011-monitoring-operations/quickstart.md`.
- [ ] T150 Run `quickstart.md` Part C (`scripts/smoke/stack-up.sh`, `npm run test:smoke -- --grep @operations`, `scripts/smoke/stack-down.sh`) against the mailcow-rest-v2 dev stack once its API 011 implementation runs, and, when a mailcow host with the API is available, Part D: the parity comparison of every dashboard, log, queue and ban value with the classic interface (SC-003) and the `@read-only` smoke subset. Record both in the validation log.
- [ ] T151 [P] Report the remaining API gaps of `specs/011-monitoring-operations/plan.md` ("API dependency and gaps" 3 to 9) to mailcow-rest-v2 as proposals, and note in the plan which were accepted.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Before this feature**: UI features 001–010 implemented; the API 011 contract merged (and its
  implementation for T053, T065, T077, T092, T107 and T150). T001 checks this.
- **Setup (Phase 1)**: T001 first; T002 after T001; T003, T004, T006, T008, T009 and T010 in
  parallel after T002; T005 after T004; T007 after T006.
- **Foundational (Phase 2)** depends on Setup and **blocks every user story**:
  - test infrastructure: T011 → T012; T013 → T014; T015;
  - core tests T016–T028 (all [P]);
  - implementation: T029, T030, T031, then T032–T034 in parallel, T035 (needs T032, T033), T036,
    T037, T038, T039–T042 in parallel, T043 last.
- **User stories (Phases 3–10)** depend on Foundational and on each other as the table below shows.
- **Polish (Phase 11)** depends on every story it verifies; T146 depends on T144.

### User Story Dependencies

| Story | Priority | Depends on | Why |
|---|---|---|---|
| US1 | P1 | Foundational | MVP. Creates the dashboard, the live queries and the charts. |
| US2 | P1 | US1 | Adds actions to `ContainerCard.vue` and mutations to `dashboard/api.ts`. |
| US3 | P1 | Foundational | Independent; its rate-limit reset needs UI 006 only. |
| US4 | P1 | Foundational; US1 for one assertion | Independent. Its Postfix-stopped link to US1's container address is rendered only once that route exists; the link assertion of T088 needs US1. |
| US5 | P2 | Foundational; US2 for T114 | "Restart netfilter" reuses US2's action runner. The rest is independent. |
| US6 | P2 | US3 for T124 | The Rspamd view is listed on US3's Logs index and type selector. The rest is independent. |
| US7 | P3 | US1 | Extends `VersionLine.vue`, `HostSection.vue` and `dashboard/api.ts`. |
| US8 | P3 | US1, US4, US5 | Places History links on their screens; the audit log changes are independent. |

### Files edited by several stories

Edits to these files must be serialised, even when stories run in parallel:

- `src/features/operations/routes.ts` and `src/app/navigation/catalogue.ts`: US1, US3, US4, US5, US6;
- `src/features/operations/dashboard/api.ts`: US1, US2, US7;
- `src/features/operations/dashboard/components/ContainerCard.vue`: US1, US2, US8;
- `src/features/operations/dashboard/components/{VersionLine,HostSection}.vue`: US1, US7;
- `src/features/operations/logs/pages/LogIndexPage.vue`, `logs/components/LogTypeSelect.vue`: US3, US6;
- `src/features/operations/mail-queue/pages/MailQueuePage.vue`: US4, US8;
- `src/features/operations/fail2ban/pages/Fail2banPage.vue`, `fail2ban/components/RulesSection.vue`: US5, US8;
- `tests/mocks/handlers/host.ts`: Foundational, US1, US7; `tests/mocks/handlers/containers.ts`: US1, US2;
- `tests/smoke/operations.smoke.spec.ts`: US1, US2, US3, US4, US5;
- `src/i18n/messages/*.json` and `src/i18n/legacy-map.json`: every story.

Scenarios avoid this through one module per area under `tests/mocks/scenarios/operations/` (T013),
and handlers through one file per contract module registered once (T014).

### Within Each User Story

- First the mock factories, handlers and scenarios. Then end-to-end, unit and smoke tests, which
  must fail. Then the implementation (api → pure modules → components → page and routes). Then the
  messages in all three locales.
- Each story's message task edits the shared locale files; run those tasks one after another
  across stories.

### Parallel Opportunities

- Setup: T003, T004, T006, T008, T009, T010 after T002.
- Foundational: T016–T028 (tests) all in parallel; T032–T034 and T039–T042 in parallel.
- Stories: after Foundational, US1, US3 and US4 can be staffed in parallel; US2 and US7 follow US1;
  US5 can start with US2's action runner available (or defer T114); US6 can start any time and
  finishes T124 after US3; US8 last.
- Within each story, every task marked [P].

---

## Parallel Example: User Story 1

```bash
# After T044–T046 (factories, handlers, scenarios), write all US1 tests together:
Task: "T047 tests/e2e/operations/dashboard.spec.ts"
Task: "T048 tests/e2e/operations/live-updates.spec.ts"
Task: "T049 tests/unit/features/operations/dashboard/{container-list,uptime}.spec.ts"
Task: "T050 tests/unit/features/operations/charts/*.spec.ts"
Task: "T051 tests/unit/features/operations/dashboard/{HostSection,VersionLine,CpuMemorySection,MailStorageSection}.spec.ts"
Task: "T052 tests/unit/features/operations/dashboard/{ContainerCard,ContainerResources,ContainerSummary,ContainerFilters,useStoppedAnnouncer}.spec.ts"
Task: "T053 tests/smoke/operations.smoke.spec.ts (dashboard cases)"

# After T054 (api.ts), implement the independent parts together:
Task: "T055 container-list.ts + uptime.ts"
Task: "T056 charts/{scale.ts,LiveLineChart.vue,ChartValuesTable.vue}"
Task: "T057 dashboard/components/{HostSection,VersionLine,CpuMemorySection,MailStorageSection}.vue"
# Then T058 (container components), T059 (page, routes, catalogue), T060 (messages).
```

## Parallel Example: User Story 5

```bash
Task: "T102 tests/e2e/operations/fail2ban-bans.spec.ts"
Task: "T103 tests/e2e/operations/fail2ban-settings.spec.ts"
Task: "T104 tests/unit/features/operations/fail2ban/{limits,duration,list-entries,covers-address}.spec.ts"
Task: "T105 tests/unit/features/operations/fail2ban/{usePendingLifts,list-state}.spec.ts"
Task: "T106 tests/unit/features/operations/fail2ban/*Section*.spec.ts and item tests"
Task: "T107 tests/smoke/operations.smoke.spec.ts (ban time case)"
# after T108:
Task: "T109 pure modules"  Task: "T110 usePendingLifts.ts"
Task: "T111 parameters"    Task: "T112 lists and external"   Task: "T113 rules"   Task: "T114 bans"
# then T115 (page, routes, catalogue) and T116 (messages)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup) and Phase 2 (Foundational): the pin, the controller, the navigation group.
2. Phase 3 (US1): the read-only dashboard with live charts.
3. **Stop and validate**: `npm run test:e2e -- --grep "US1|@operations.*FR-00"` on both viewports,
   `npm run budget:check`, and the US1 rows of quickstart Part B.
4. The dashboard can replace the classic System & Containers tab for monitoring; the other entries
   of the group show placeholders that link to the classic interface.

### Incremental Delivery

1. Foundation, then US1 (MVP).
2. US2 (container actions): the dashboard is complete.
3. US3 (logs) and US4 (mail queue): the P1 operations work is covered.
4. US5 (ban service), then US6 (Rspamd).
5. US7 (updates and public addresses), then US8 (history).
6. Polish: reflow and keyboard, performance and budgets, contract usage, device validation, smoke.

### Parallel Team Strategy

After Foundational:
- Developer A: US1, then US2, then US7.
- Developer B: US3, then US6.
- Developer C: US4, then US5 (after US2's T066–T067), then US8.

Edits to the shared files listed under "Files edited by several stories" run one at a time.

---

## Notes

- [P] tasks touch different files and have no dependency on an incomplete task.
- [USn] labels map tasks to the spec's user stories; test titles carry the spec IDs.
- Verify that each test fails before implementing (constitution VI).
- Commit after each task or logical group, directly to `main`, with short imperative subjects.
- Never hard-code a value the capabilities read reports, never add a hand-written API type (including
  for audit `details`), never add a `v-html` outside `SanitizedHtml.vue`, an inline style or script,
  a storage key, or a poll outside `useLiveUpdates`.
- New messages never name the product: where an explanation needs it ("the default rules of …"),
  it interpolates `{productName}` from the branding configuration (FR-089, constitution IV). Legacy
  keys are mapped only where the meaning is unchanged (research R19).
