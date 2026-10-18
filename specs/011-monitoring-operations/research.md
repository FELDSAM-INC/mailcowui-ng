# Research: Monitoring and Operations

**Feature**: `specs/011-monitoring-operations` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

Every open point of the plan is settled here, in this order of precedence: the constitution, the
pinned mailcow-rest-v2 contract, `docs/conventions.md`, the decisions of UI feature 001
(`specs/001-sign-in-app-shell/research.md`, cited as "UI 001 R<n>"), then best practice. Each entry
has a **Decision**, its **Rationale** and the **Alternatives considered**. Decisions of UI 001 that
apply unchanged (stack, client generation, CSRF, query policy, i18n layers, CSP, mock server,
Playwright projects, smoke harness) are not repeated.

---

## 1. Foundations

### R1. Prerequisites from UI 001–010 and the contract pin

- **Decision**: UI 011 is implemented after UI features 001–010 and after the API 011 contract is
  merged. It relies on these existing parts and does not rebuild them:

  | From | Part | Used for |
  |---|---|---|
  | UI 001 | Shell, router, guards, navigation catalogue, `NoAccessState`, `NotFoundPage` | routes, the "System" group, role checks (FR-001, FR-002) |
  | UI 001 | `@/api` client, `ApiProblem`, query client and key factory | every request |
  | UI 001 | `useListState`, `ListState`, `PaginationBar`, `useConfirm` + `ConfirmDialog`, `useVersionedSave`, `useProblemForm`, `FormField`, `ErrorSummary`, `ProblemMessage`, `DateTime`, `RelativeTime`, `useAnnouncer` + `LiveAnnouncer`, `useMediaQuery`, `useCountdown`, `SanitizedHtml`, `clipboard.ts` | lists, dialogs, forms, announcements, copying |
  | UI 001 | Audit log screen (`src/features/audit-log/`) | History (FR-075) |
  | UI 001 | Mock server, contract validator, scenario registry, e2e fixtures (`a11y`, `csp`, `layout`, `mock-api`), smoke harness, budget script, Lighthouse runner | tests and gates |
  | UI 002 (UI 001 R20 reserved) | `HistoryLink.vue`, `targetType`/`targetId` in the audit log's list state and filters | History links |
  | UI 002 (UI 001 R20 reserved) | `useBulkSelection.ts`, `BulkActionBar.vue`, `BulkResultSummary.vue` | queue selection, action bar and results |
  | UI 002 (UI 001 R20 reserved) | `EditableSection.vue` (driven by the `edit` address parameter) and `useVersionedSave`'s `changedSince` marking | ban service sections and rules (FR-067, FR-071, FR-072) |
  | UI 002 | `useLeaveGuard.ts`, `ConfirmDialog` with rich content, the `stripMarkup` mapping of the legacy importer, `formatBytes` in `src/i18n/format.ts` | unsaved-changes guard (FR-074), confirmations with warnings, legacy texts without markup, binary sizes |
  | UI 006 | The rate-limit bucket reset mutation and its confirmation (UI 006 FR-058), exported through UI 006's feature `index.ts` (expected `src/features/spam-policy/index.ts`) | "Reset rate limit" (FR-039) |
  | UI 006 | The proportional bar list of the Quarantine › Statistics panel | first use of the bar list that R13 promotes |

  Task T001 verifies that these exist at the named paths and records any different name in
  `plan.md`. A missing prerequisite stops the implementation: it is a dependency failure, and UI 011
  never re-creates another feature's part.

  **Contract pin**: mailcow-rest-v2 commit **`32079252d55797d3da4e58ae661e9fb91c51c6f9`**
  ("Register KnownProblemType in contract components", 2026-10-18), the newest commit that changed
  `api/` when this plan was written. Its Redocly 2.64.1 bundle has 376 operations and sha256
  `5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6`. It contains all 42 operations of
  API 011 (including `/capabilities/monitoring`, `Container.role` and `MailQueueListMeta.queueCounts`),
  `resetRateLimitBucket` of API 006, the audit target filters of API 002, and `KnownProblemType` under
  `components.schemas` (UI 001 plan gap 5, now closed). `info.version` is still `0.1.0`, so the commit
  is authoritative (UI 001 R6). If an earlier UI feature already pinned a later commit whose `api/`
  holds these 44 operations unchanged, that pin stays.
- **Rationale**: The constitution lets a UI feature start once its contract is merged. Naming every
  inherited part makes the dependency explicit and keeps the shared building blocks single-sourced
  (constitution VIII).
- **Alternatives considered**: Pinning `a563357` ("Record 011 analysis") was rejected: it lacks the
  registered `KnownProblemType`, so the generated client would have no problem-type constants.
  Re-creating missing shared parts inside UI 011 was rejected: it forks UI 002's patterns.

### R2. Runtime dependency: `marked` for release notes only

- **Decision**: Add exactly one runtime dependency, **`marked` 18.1.1** (MIT, no dependencies,
  14.1 KB gzipped for `lib/marked.esm.js`, measured from the registry tarball on 2026-10-18). It is
  imported dynamically by `src/features/operations/dashboard/release-notes/render-release-notes.ts`
  when release notes are opened, so it is never part of the initial JavaScript or of the dashboard
  route chunk (R22). No chart, date, virtual-list or Markdown-sanitiser library is added.
- **Rationale**: FR-028 requires Markdown formatting (headings, emphasis, lists, code, quotes,
  tables, links). Writing a Markdown parser is a security risk and violates simplicity. `marked` is
  small, maintained, has no dependencies, and its renderer hooks let the app escape raw HTML and turn
  images into links (R9). MIT is GPL-3.0-compatible and passes `licenses:check`.
- **Alternatives considered**:
  - `markdown-it` 15.0.3 (MIT): `html: false` escapes raw HTML by default, but it pulls in four
    dependencies and is about 2.5× larger.
  - `micromark`/`remark`: correct but large and plugin-heavy.
  - `snarkdown`: tiny but has no tables and no escaping guarantees.
  - Showing the notes as plain text: rejected by FR-028.

### R3. Feature layout, routes and the "System" navigation group

- **Decision**:
  - One feature directory, `src/features/operations/`, with sub-areas `live/`, `charts/`,
    `dashboard/`, `logs/`, `rspamd/`, `mail-queue/` and `fail2ban/`, plus `capabilities.ts`,
    `routes.ts` and `index.ts` (full tree in [plan.md](./plan.md#source-code-repository-root)).
  - **Navigation** (FR-001): UI 001's single placeholder row `operations` (`/operations`) is replaced
    by four rows that share the new optional field `group: 'system'`:
    `dashboard` (`/operations/dashboard`), `logs` (`/operations/logs`), `mailQueue`
    (`/operations/mail-queue`) and `fail2ban` (`/operations/fail2ban`), all administrator-only,
    `deliveredBy: '011'`. `NavigationList.vue` renders consecutive rows of one group under a group
    heading (`nav.groups.system`, legacy `header.mailcow_system` "System") in the drawer and the
    static navigation. The home screen's shortcuts follow the catalogue unchanged.
  - **Routes** (data-model §5): `/operations` redirects to the dashboard. Every screen and object
    has its own address (FR-002): `/operations/containers/:containerName` opens the dashboard with
    that card expanded; `/operations/logs/:logType` and `/operations/logs/rspamd`;
    `/operations/mail-queue/messages/:queueId` opens the queue with the content viewer;
    `/operations/fail2ban/:section(bans|settings|rules)` opens the ban screen at that section.
  - These addresses are the targets of UI 014's rows M06 (`/operations/dashboard`) and M09
    (`/operations/mail-queue`).
- **Rationale**: One feature directory matches the one API feature and the one catalogue area. Child
  routes give bookmarkable addresses without one page per section. A group field is the smallest
  change to UI 001's flat catalogue that meets FR-001.
- **Alternatives considered**: One catalogue entry with in-page tabs was rejected: FR-001 asks for
  four navigation entries, and tabs that scroll sideways fail FR-030 on phones. Hash anchors for the
  ban sections were rejected: they conflict with UI 001's focus-on-`<h1>` navigation rule.

### R4. Monitoring capabilities: intervals, limits and documented rules

- **Decision**:
  - `src/features/operations/capabilities.ts` reads `GET /capabilities/monitoring` once per visit of
    any screen of this feature (`staleTime` 5 min) and exposes derived values. **Nothing the
    capabilities report is hard-coded** (conventions "Capabilities and limits"):

    | Value | From | Used by |
    |---|---|---|
    | Live polling interval | `pollIntervalSeconds` | host, containers, resource usage, pending lifts (FR-018, FR-065) |
    | Mail storage interval | `maxAgeSeconds.mailStorage` (polling faster refetches unchanged data) | FR-018 |
    | Outdated thresholds | `maxAgeSeconds.<kind> + 2 × interval of that kind` | FR-022 |
    | Show public IP offered | `ipCheckEnabled` | FR-029 |
    | Retention note per log | `logRetention.<type>` (`policy`, `maxEntries`) | FR-040 |
    | Own-address warning | `clientAddress` | FR-064, FR-069 |
    | Selection limit across pages | `limits.mailQueueBulkMaxIds` | FR-055 |
    | Truncation notice | `limits.mailQueueListingMax` | FR-052 |
    | Rule count and length | `limits.fail2banRulesMax`, `limits.fail2banRuleMaxLength` | FR-071 |
    | List entry count | `limits.fail2banListMaxEntries` | FR-069 |
    | Largest page | `limits.maxPageSize` | the unfiltered container list, "select all matching" |

    With the default capabilities the thresholds are the spec's values: host figures 10 + 2 × 5 =
    20 s, container states 5 + 2 × 5 = 15 s, resource samples 15 + 2 × 5 = 25 s, mail storage
    60 + 2 × 60 = 180 s.
  - **When the capabilities cannot be read**, the screens still load their data once, but nothing
    polls, the queue's "select all matching" and the denylist's own-address check are unavailable,
    and a notice with a retry says that live updates and limits could not be loaded. No fallback
    constant is used.
  - **Rules documented only in prose**: the ban parameter ranges (ban time and maximum ban time 60 to
    2,147,483,647, attempts and retry window 1 to 2,147,483,647, IPv4 prefix 8 to 32, IPv6 prefix 8
    to 128) appear only in the description of `Fail2BanSettingsPatch`; the schema has no `minimum`
    or `maximum`. They live in `src/features/operations/fail2ban/limits.ts`, and a unit test asserts
    that each range's text occurs verbatim in that description in `contract/openapi.json`, so a
    contract bump that changes them fails the test. This is the approach UI 001 R27 uses for problem
    types (derive from the bundle text, never copy blindly). Entry length 253 and the schema limits
    (`maxItems`, `maxLength`) are checked against schema keywords as in UI 001's `limits.spec.ts`.
    Plan API gap 4 asks the API to express the ranges as schema keywords.
- **Rationale**: The capabilities read exists because this spec found the gaps (API 011
  clarification). Deriving every limit from it or from the bundle keeps the UI correct when an
  operator changes `LOG_LINES` or the API changes a limit.
- **Alternatives considered**: Hard-coding 5 s and the limits with a comment was rejected by the
  conventions. Skipping client-side range checks was rejected by US5-AS3 ("nothing is sent").

---

## 2. Live data

### R5. Live updates: polling, visibility, pause and inactivity

- **Decision**:
  - **Mechanism**: TanStack Vue Query with a reactive per-query `refetchInterval`
    (`computed(() => live.running ? ms : false)`), `refetchIntervalInBackground: false`,
    `retry: false` (the next tick is the retry) and `staleTime: 0`. UI 001's global defaults stay:
    no focus or reconnect refetch, and no default interval (UI 001 R9). Only queries under the key
    prefix `['monitoring', 'live']` and the pending-lift refresh (R16) ever poll.
  - **Controller** `src/features/operations/live/useLiveUpdates.ts`, created by each screen that
    polls (dashboard, ban screen). Its state (data-model §7) is one of `running`, `hidden`,
    `paused` (user), `inactive` (inactivity) or `unavailable` (capabilities missing), with `since`.
    - **Visibility** (FR-019): a `visibilitychange` listener sets `hidden` while
      `document.visibilityState === 'hidden'`; on `visible` it returns to `running` and calls
      `queryClient.refetchQueries({ queryKey: ['monitoring', 'live'], type: 'active' })` at once
      (SC-004: within 1 s).
    - **Leaving the screen** stops everything: the controller and the queries are scoped to the
      page component, so unmounting removes the observers and the timers.
    - **Pause** (FR-020): "Pause live updates" sets `paused`; "Resume" refetches at once and sets
      `running`. The manual "Refresh" works in every state.
    - **Inactivity** (FR-021): `useInactivity.ts` listens (passive, throttled to once per second) to
      `pointerdown`, `keydown`, `wheel`, `touchstart` and `scroll` on `window`. After the inactivity
      limit without one, the state becomes `inactive`, a notice with "Resume" appears, and nothing
      polls. **Limit** = `min(15 min, Session.idleTimeout)` from UI 001's session store: polling
      renews the server session (UI 001 R8, R12), so an unattended dashboard extends a session by at
      most one idle period beyond the last interaction, never indefinitely.
  - **Polling counts as session activity**: UI 001's activity middleware records every response,
    so the idle warning follows the server's own timer, which every poll renews. This is the
    intended consequence of FR-018 and is bounded by FR-021. UI 001's rule "no automatic requests
    while idle" holds, with "idle" meaning no interaction for the inactivity limit.
  - **Session end** (edge case): a `401` from a poll triggers UI 001's session end, which clears the
    cache and routes to sign-in; the page unmounts and polling stops.
- **Rationale**: Vue Query keeps server state in one cache (constitution, UI 001 R9) and supports
  reactive intervals and background suspension. An explicit controller is needed because UI 001
  turns off focus refetching globally, while FR-019 requires an immediate refetch on return.
- **Alternatives considered**: `setTimeout` loops outside the cache were rejected: they duplicate
  caching and invalidation. Server-sent events or WebSockets are not offered by the API (API 011
  FR-012). Enabling `refetchOnWindowFocus` for these queries only was rejected: TanStack's focus
  manager also reacts to window focus, which is not the visibility rule the spec states.

### R6. Freshness and the host clock

- **Decision**:
  - **Host clock** (`live/useHostClock.ts`): `skew = HostOverview.currentTime − local receive time`,
    updated on every successful overview. Before the first overview, or while the host section
    fails, the skew comes from the `Date` header of the newest live response (UI 001 R13). The device
    clock alone is never used (FR-022, edge case "Device clock wrong").
  - **Age** of a section = `(Date.now() + skew) − collectedAt` (`sampledAt` for resource usage).
    **Outdated** when age > threshold (R4).
  - **Indicator** (`live/components/FreshnessIndicator.vue`): "Updated 4 s ago" while running; the
    text is recomputed on each poll and by one shared 5-second ticker that runs only while the state
    is `running`. When paused, hidden or inactive the ticker stops and the indicator shows the
    absolute collection time ("Collected at 14:03:12"), next to the pause notice. Outdated adds the
    word "Outdated" and a warning icon with text, never colour alone (FR-022, FR-034 pattern). The
    indicator has no live region: automatic updates are not announced (FR-024).
  - **Failed refresh** (FR-023): the query keeps its last `data`; `error` adds a section notice
    "Updating failed; retrying" while polling continues; the section is marked outdated once the
    threshold passes.
- **Rationale**: Measuring against the host's `currentTime` is what the spec clarified. Stopping
  the ticker while paused keeps the screen still once the user asked for it (WCAG 2.2.2), and a
  5-second step matches the polling interval, so the age text never changes faster than the data.
- **Alternatives considered**: A per-second ticker was rejected (needless re-rendering, and moving
  text that 2.2.2 would require pausing separately). Announcing ages was rejected by FR-024.

### R7. Live series and the SVG line chart (no chart library)

- **Decision**:
  - **Series** (`live/useLiveSeries.ts`): a ring buffer of the last 30 samples per chart, appended
    only when the sample time (`collectedAt` or `sampledAt`) changes, because shared collection can
    return the same sample to two polls. Host series live in the dashboard page; a container's
    series live in its expanded panel and are discarded on collapse (FR-005, FR-010). Nothing is
    stored.
  - **Chart** `src/features/operations/charts/LiveLineChart.vue`, hand-written inline SVG, about
    2 KB:
    - `<figure>` with a visible caption, the current values as text next to the chart, and
      `<svg role="img" aria-labelledby>` with `<title>` and a `<desc>` summary ("Processor usage over
      the last 2.5 minutes, from 12 % to 48 %, now 31 %").
    - One or two series. The second series is dashed (`stroke-dasharray` attribute) and the legend
      shows each pattern with its name, so series never differ by colour alone (FR-083).
    - Fixed `viewBox`, `preserveAspectRatio="none"` and `vector-effect="non-scaling-stroke"`, so the
      chart fits any width (FR-079). Percentages use a fixed 0–100 scale; rates scale to the
      series maximum with "nice" binary steps (`charts/scale.ts`) and axis labels in binary units
      (FR-007).
    - A table alternative: a `<details>` "Show values" with a `<table>` of the samples (time and
      value per series, header cells, caption) (FR-083).
    - Until two samples exist, or while rates are `null` on the first resource sample, the chart
      area says "Collecting data…" in text (FR-010, edge case).
    - Colours are the tokens `--color-chart-1` and `--color-chart-2` in `src/styles/main.css`, with
      at least 3:1 contrast against the card surface in both themes (WCAG 1.4.11), asserted by a
      unit test that reads the tokens. Presentation uses attributes and classes only, never
      `style=""` (UI 001 R18).
    - No transition or animation exists on any chart element, so updates are instant for everyone,
      including under `prefers-reduced-motion` (FR-084). Nothing blinks.
  - **Lazy loading**: the dashboard imports the chart with `defineAsyncComponent(() =>
    import('../charts/LiveLineChart.vue'))`. The figures render immediately; the chart area keeps a
    fixed-height placeholder until the chunk arrives (FR-091, SC-011). The chunk name
    `LiveLineChart-*.js` lets the e2e tests prove that screens without charts never request it.
- **Rationale**: The charts are 30-point sparklines with at most two series. SVG is accessible,
  CSP-safe, theme-aware through `currentColor` and tokens, and costs a few hundred lines. The
  constitution prefers built-in features and few libraries, and the user asked for accessible SVG
  with a table alternative.
- **Alternatives considered**:
  - Chart.js 4 (MIT, about 70 KB gzipped, the legacy library): canvas output is opaque to screen
    readers, so the table and summary would be needed anyway, plus a large chunk.
  - uPlot (MIT, about 20 KB): canvas, same accessibility problem.
  - Apache ECharts (Apache-2.0): far too large.
  - TailAdmin's chart demo (ApexCharts): excluded as a demo part (UI 001 R4) and canvas/SVG-heavy.

---

## 3. Dashboard

### R8. Containers: list, roles, actions and outcomes

- **Decision**:
  - **List**: one polled request, `GET /containers?limit=<limits.maxPageSize>&sort=name`, unfiltered.
    The filter (all, running, not running), the search over name and image and the sort (name,
    state, start time; ties by name, as the API sorts) are applied in the browser by
    `dashboard/container-list.ts`, from the address (FR-009). The summary counts come from the same
    response. A mailcow installation has about 20 containers; one poll serves the summary and every
    filter.
  - **Card** (FR-008): service name, image, the role as a translated label (`ContainerRole`, unknown
    values shown as "Other" as the contract requires), the state in text with an icon for "not
    running", health when not `null`, the start time as `RelativeTime` with the exact time, and a
    "Protected" marker. Cards are a list (`<ul>`) with each name as the item heading (FR-085). The
    card that the address names (`/operations/containers/:name`) is expanded and focused on load;
    collapsing it replaces the address with the dashboard address (query kept). A name not in the
    list shows UI 001's not-found page with a link to the dashboard (FR-002).
  - **Resource panel** (FR-010): an expanded running card polls `getContainerResourceUsage`. A
    `409 container-not-running` stops that container's polling until the list reports it running
    again, and the panel says that no resource data is available.
  - **Actions** (FR-011): exactly `Container.availableActions`. Protected containers explain that
    they cannot be stopped; the API's own container (`role: api`) explains that it can be neither
    stopped nor restarted.
  - **Confirmation** (FR-012) through `useConfirm`, for stop and restart only, naming the container
    and the interruption, with the legacy restart notice (`footer.restart_container_info` without
    markup). The role refines the warning: `proxy`, and `webApp` (the container that serves this
    app) → "this app may be unavailable for a moment and may show the outcome as unknown";
    `database` and `keyValueStore` → "other screens may fail for a moment and figures may be marked
    outdated; the restart may finish without an audit record"; any other protected container → the
    general protected wording (spec gap 8, closed by `Container.role`).
  - **Action runner** (`dashboard/composables/useContainerAction.ts`, data-model §7): one mutation
    per container (`mutationKey: ['containers', 'action', name]`). While pending, the card shows the
    action with the elapsed time (`useCountdown`-style ticker, not announced) and accepts no other
    action on that container; other containers stay usable (FR-013). Outcomes:
    - `200 done` / `alreadyInState`: the returned `container` replaces the list entry
      (`setQueryData`), the outcome is announced ("Restarted", "Already running") (FR-014).
    - `504 outcome-unknown` or a network failure: "Outcome unknown" with the explanation, then
      `getContainer` is read at once and shown; the action is never repeated (FR-015, SC-006).
    - `409 container-protected`, `502 container-action-failed` (with `serviceMessage` verbatim as
      technical detail), `404` (container removed: message and list refresh), `503 temporary-failure`
      (nothing changed): translated messages (FR-016).
    - `Audit-Recorded: false` on any answer adds the warning "carried out without an audit record"
      (FR-016, R17).
    - The mutation's own callbacks report the outcome, so it appears even after the user left the
      dashboard (edge case); they fire after unmount because TanStack Query v5 runs `useMutation`
      option callbacks on the mutation object. While the card is mounted, the outcome shows on the
      card and is announced. When it is not, `useStatusMessage()` shows it in
      `src/app/shell/StatusMessageHost.vue`, a `role="status"` region in `ShellLayout` whose
      messages stay until dismissed, so they never disappear while focused or hovered (FR-078). UI
      002 shows its messages inline and has no app-level host; the dashboard cards and the ban
      screen's "Restart netfilter" are its two uses (constitution VIII).
  - **Stopped-container announcement** (FR-024): `dashboard/composables/useStoppedAnnouncer.ts`
    compares the running flags of consecutive polls and announces, once per transition and
    politely, "<name> is no longer running".
  - **Restart netfilter** (FR-017): the ban screen finds the container whose `role` is `banService`
    in the container list and reuses the same action button, confirmation and outcomes. No service
    name is hard-coded.
- **Rationale**: Client-side filtering avoids a second poll for the summary and matches the API's
  documented sort semantics. Roles (API 011 FR-008) remove every dependence on service names, which
  operators can change.
- **Alternatives considered**: Server-side filtering per address was rejected: the summary needs the
  unfiltered list, so it would double the polling. Hard-coding `netfilter-mailcow` and
  `postfix-mailcow` was rejected for the same reason roles exist.

### R9. Version, update status and safe release notes

- **Decision**:
  - The version line uses `GET /installation` (needs no container service, so it stays visible when
    the host section fails) and `GET /installation/update-status`, each fetched once per visit of the
    dashboard (`refetchOnMount: 'always'`) (FR-018, FR-026, FR-027). `disabled` shows only the version
    (FeldHost). `checkFailed` says so without blocking anything. `updateAvailable` offers the release
    notes of the new version with `publishedAt` and the release page link; `installedReleaseNotes`,
    when present, are offered from the version.
  - **Rendering** (`dashboard/release-notes/render-release-notes.ts`, FR-028):
    1. `marked` (R2) with GFM, `breaks: false`, and renderer overrides:
       - `html` (block and inline): returns the raw HTML **escaped as text**;
       - `image`: returns a link to the image address labelled with its description (or "Image"),
         never an `<img>`;
       - `link`: only `http:`, `https:` and `mailto:` targets through `safeHref()` (UI 001 R17);
         other links are rendered as their text.
    2. The output goes through `SanitizedHtml` with the new profile `releaseNotes`
       (`src/shared/security/sanitize.ts`): tags `p br strong em del h1–h6 ul ol li a blockquote code
       pre table thead tbody tr th td hr`, attributes `href` and `align`, URI scheme allowlist, no
       `img`, `style`, `class` or event handlers. A hook adds `target="_blank"`,
       `rel="noopener noreferrer nofollow"` and a visually hidden translated "(opens in a new
       window)" to every link (FR-028).
    3. Displaying the notes makes no request: no image, frame or font can survive the sanitiser.
       An e2e test asserts that no request leaves the origin while the notes are open.
  - The viewer is full-screen below `md` and a dialog from `md` up (FR-028).
- **Rationale**: Escaping (instead of stripping) raw HTML satisfies "shown as text". Two layers —
  renderer overrides plus a strict sanitiser profile — keep the guarantee even if a `marked` upgrade
  changes its output. Keeping the one `v-html` in `SanitizedHtml.vue` follows UI 001 R17.
- **Alternatives considered**: Sanitising with the operator profile was rejected: it drops tables
  and code. Rendering Markdown to Vue nodes without `v-html` was rejected: it needs a second parser
  layer for no security gain over the sanitiser.

### R10. Public addresses

- **Decision**: "Show public IP" is offered only when `ipCheckEnabled` is `true` (FR-029). It calls
  `GET /host/public-addresses` on demand (no caching beyond the visit), shows progress, then each
  address or "unavailable" for `null`. When the check is disabled, the host section explains that
  it is switched off and where: the legacy wording `admin.ip_check_disabled` without markup
  ("System › Configuration › Options › Customize" in the classic interface), until UI 013 adds its
  own link. A `409 ip-check-disabled` (the setting changed meanwhile) shows the same explanation and
  refreshes the capabilities.
- **Rationale**: The capabilities close spec gap 1; legacy hides the button up front.
- **Alternatives considered**: Always offering the button (the spec's original fallback) was
  rejected now that the API reports the setting.

---

## 4. Logs and Rspamd

### R11. Log viewer

- **Decision**:
  - **Registry** `logs/log-types.ts`: one typed descriptor per log type (data-model §2) with its
    address slug, its operation, its group (in-memory, external, stored — FR-030), its retention key,
    its entry and detail fields (FR-031), whether it has a severity, and its type-specific filters
    as the contract names them (FR-035). The Rspamd view is listed in the external group and has its
    own route.
  - **Type choice** (FR-030): `/operations/logs` is an index of the three groups with each log's
    explanation. On a log, a native `<select>` with `<optgroup>`s switches the type (no tab row).
  - **Loading** (FR-036): `useInfiniteQuery` with `limit: 50`.
    - **Newest first** (default): the next page asks for `before = <id of the oldest entry shown>`
      with `offset: 0`, exactly as `LogBefore` documents, so arrivals never duplicate.
    - **Oldest first**: the contract documents `before` only for loading older entries; its meaning
      with `order=asc` is not stated (plan API gap 3). The next page therefore asks for
      `offset = <entries shown>`: new entries arrive at the newest end, after everything shown, so
      they never cause duplicates. If mailcow trims the oldest end meanwhile, entries can be
      skipped; they are never duplicated (edge case "log trimmed").
    - In both orders the client drops an entry whose `id` is already shown, as a guard for SC-010.
    - The total comes from the first page (`meta.total`), and "Showing 150 of 10,000" is shown.
  - **No automatic refresh** (FR-038): `staleTime: Infinity` within the cache lifetime, so returning
    to a log shows what was loaded with "Loaded at 14:03:12". "Refresh" calls `resetQueries` for the
    log's key, which reloads only the newest page.
  - **Address** (FR-037): type, search, time range, severity, the type's filters and the order live in
    the address through `useListState` without paging; any change starts again from the newest (or
    oldest) entries.
  - **Filters** (FR-035): one search (`q`, debounced 300 ms, clearable), a time range (last hour,
    24 hours, 7 days, custom) from the shared `time-range.ts` (promoted from the audit log, R19 of
    UI 001's promotion rule), severity checkboxes for types with a severity, and the type-specific
    text filters. The number of active filters is shown, chips remove them one by one
    (`ActiveFilterChips`, promoted to `src/shared/components/` on this second use), and one action
    clears all. The new count after a search or filter change is announced (FR-086).
  - **Entries** (FR-032 to FR-034): cards below `md` (time, severity or type and source on the first
    line; main text below), a table per type from `md` up; details expand in place (Reka
    `Collapsible`). Text is shown by interpolation only, with `white-space: pre-wrap` and
    `overflow-wrap: anywhere`, so line breaks are kept and 2,000-character tokens wrap (SC-009).
    Messages taller than four lines are clamped (`line-clamp-4`) with "Show all", offered only when
    the clamped element overflows (measured on mount and on breakpoint changes). "Copy" copies the
    entry's full content as `field: value` lines. Severity is the class name in text plus an icon.
    The watchdog change shows its sign and an arrow with text ("+2, rising").
  - **Labels** (FR-031, FR-042): autodiscover `activesync` → "ActiveSync" and `imap` → "IMAP, SMTP,
    Cal-/CardDAV"; every other content is shown as returned. Legacy UI activity shows the message
    key with its parameters, and the call as formatted JSON text.
  - **Time zone** (FR-041): every log screen states "Times are shown in your device's time zone
    (<zone>)". Stating it always satisfies "when they differ" without reading the host overview,
    which needs the container service that logs must not depend on (edge case "container service
    unavailable").
  - **Retention** (FR-040): each log explains its retention from `logRetention.<type>`: "keeps the
    newest {maxEntries} entries, trimmed every minute", "keeps about {maxEntries} entries"
    (autodiscover), "cleaned daily", "never trimmed". The Logs index says that actions taken in this
    app are in the audit log, with a link.
  - **States** (FR-043): `ListState` for loading, no entries, no matching entries (with "Clear
    filters"), and error with retry; `503 temporary-failure` says that the log is temporarily
    unavailable. A failed refresh keeps the old entries with an error notice.
  - **Unknown type** (edge case): UI 001's not-found page with a link to the Logs index.
- **Rationale**: The cursor is the documented duplicate-free method for the default order; offset
  is the duplicate-free documented method for the opposite order. One descriptor registry keeps 12
  types consistent and makes each table-driven test simple.
- **Alternatives considered**: Client-side windowing or a virtual list was rejected: pages of 50
  render quickly, and virtualisation complicates find-in-page and screen readers. Polling logs was
  rejected by FR-038.

### R12. Rate limit reset (reuse of UI 006)

- **Decision**: Each rate limit entry offers "Show entries of this rate limit" (sets `q` to the
  hash) and "Reset rate limit". The reset reuses UI 006's mutation for `resetRateLimitBucket`
  (`DELETE /rate-limit-buckets/{bucketId}`) and its confirmation wording (UI 006 FR-058), passing
  `rateLimitHash` as `bucketId`. It is offered only when the hash is not `null` and matches the
  parameter's pattern `^RL[0-9A-Za-z=]+$` (at most 128 characters). `204` resets the log query
  (refresh); `404` says that the rate limit was already reset; `503` says that nothing changed.
- **Rationale**: One reset implementation for both entry points (UI 006 FR-058 names this log as
  one of them).
- **Alternatives considered**: A second mutation in UI 011 was rejected (duplication).

### R13. Rspamd statistics and history

- **Decision**:
  - **Statistics** (FR-045): `getRspamdStatistics` once per visit with a refresh action; figures as
    text, labelled "this server", with the collection time; statistics files and fuzzy hashes as
    small tables.
  - **Action chart** (FR-046): a horizontal proportional bar list, one row per key of `actions`
    exactly as Rspamd names it, each labelled with the action, the count and the percentage of
    `scanned`; a one-sentence summary ("Most messages (82 %) got no action."); a "Show as table"
    switch that renders a real `<table>` with the same counts and percentages; "No messages were
    scanned yet" when every count is zero. Bars are CSS with a dynamic `:style` width (CSSOM,
    allowed by UI 001 R18), so they need no chart code at all.
    - The bar list is UI 006's Quarantine › Statistics pattern. On this second use it is promoted to
      `src/shared/components/ProportionBarList.vue` (constitution VIII) with optional `summary` and
      `tableAlternative` props; UI 006's panel keeps its behaviour.
  - **History** (FR-047, FR-048): an ordinary paged list (25/50/100) with `useListState`: sort by
    time, score, size or scan time; filters by action (checkboxes from the statistics' action names;
    disabled with a reason when the statistics are unavailable), time range and score range
    (`inputmode="decimal"`); one search. Each entry shows the action in text, "12.4 of 15 required
    (below)" in text, senders, recipients and subject; details expand in place with the symbols in
    the API's order (name, signed score, options), client address, user or "none", size, scan times
    and message ID. All as plain text.
  - **States** (FR-049): `503` says that the Rspamd controller is temporarily unreachable, with a
    retry, separately for the statistics and the history.
- **Rationale**: Bars with text labels read without colour and fit 360 px, which the legacy
  doughnut did not.
- **Alternatives considered**: An SVG bar chart was rejected: CSS bars with text are simpler and
  equally accessible.

---

## 5. Mail queue

### R14. Mail queue: list, selection and actions

- **Decision**:
  - **List** (FR-050, FR-051): `useListState` with search, queues (repeatable), sender, recipient,
    arrival time range, sort (arrival time ascending by default, size, sender, queue, queue ID) and
    page size 25/50/100. The header shows the total and the count per queue from
    `meta.queueCounts`, and the queue filter shows each queue's count (spec gap 2, closed). Cards
    below `md` (sender or "empty sender (bounce)", first recipient with "+ n more", first deferral
    reason, queue, age, size, forced-expiry marker); a table from `md` up.
  - **Truncation** (FR-052): when `meta.truncated`, a notice says that only the first
    `limits.mailQueueListingMax` messages are listed and that flush and delete all affect every
    message.
  - **Help** (FR-053): the legacy explanation and legend (`queue.info` without markup,
    `queue.legend`, `queue.*_legend`) in a collapsible help panel.
  - **Selection** (FR-054, FR-055): UI 002's `useBulkSelection` for the current page (clears through
    `useListState`'s reset hook), configured with `maxItems = limits.mailQueueBulkMaxIds` and
    targets **without** a version (`MailQueueBulkTarget` forbids `version`). An explicit selection
    mode shows checkboxes on cards (a checkbox column in the table), and UI 002's sticky
    `BulkActionBar` names the count and the actions (FR-054, FR-080).
    `mail-queue/useQueueSelection.ts` adds the "Select all matching" mode: it lists the IDs with the
    current filters and sort, `offset: 0`, `limit: min(meta.total, limits.mailQueueBulkMaxIds)`
    (paging in steps of `limits.maxPageSize` if the bulk limit is larger), and says "The first 1,000
    of 1,400 matching messages are selected; repeat the action for the rest" when more match.
  - **Actions** (FR-054 to FR-059): one `bulkMailQueueMessages` request per action. Deliver now, hold
    and release are not confirmed; delete asks for confirmation with the count and "cannot be
    undone" (`useConfirm`). The result is shown with UI 002's `BulkResultSummary` (done, and the IDs
    "no longer in the queue" for `notFound`), announced, and the list is invalidated. Deliver now
    and flush add "Postfix accepted the request; delivery continues in the background"; flush adds
    "Held messages stay on hold". `504 outcome-unknown` says so and refreshes the list without
    repeating; `502 queue-action-failed` shows the translated message with `serviceMessage` as
    technical detail; a network failure is "outcome unknown" and never retried.
  - **Delete all** (FR-058): `PurgeQueueDialog.vue` (feature-local; its acknowledgement checkbox has
    no second use) reads the counts when it opens (`listMailQueueMessages?limit=1`) and states
    `meta.queueCounts.total` exactly, including held messages, even when the listing is truncated,
    and that messages arriving meanwhile are deleted too. Its Delete button stays disabled until
    the acknowledgement is ticked. It is a Reka `AlertDialog` (labelled, focus trapped, Escape
    closes unless sending, focus returns).
  - **Postfix not running** (FR-060): `409 mail-service-not-running` replaces the list with a
    message naming `problem.container` and a link to `/operations/containers/<container>`.
  - **Confirmation strength**: `docs/conventions.md` asks for the number to be typed for bulk
    deletions, but this spec's clarification decides a dialog naming the number for selected
    messages and an acknowledgement for "Delete all". The conventions say that a feature spec
    governs its own screens, so the spec applies (plan owner question 1).
- **Rationale**: The bulk operation and the 1,000-ID limit are the contract's. Selecting across
  pages reuses the list operation with `limit` up to 1,000, so no new API is needed (gap 3 stays
  open only for more than 1,000).
- **Alternatives considered**: Repeating requests in batches of 1,000 for larger selections was
  rejected: it is a workaround for API gap 3, which the constitution forbids.

### R15. Queued message content viewer

- **Decision**:
  - Route `/operations/mail-queue/messages/:queueId` opens `MessageContentViewer.vue` over the queue
    list: full-screen below `md`, a large dialog from `md` up (FR-061). The content query
    (`['mail-queue', 'content', id]`) uses `staleTime: 0` and `gcTime: 0`, and closing the viewer
    removes it from the cache (`removeQueries`), so the content is discarded (clarification).
  - The viewer shows the queue ID, the audit notice ("Each view is recorded in the audit log"), and
    the content in a `<pre>` with a fixed-width font, as text interpolation. Wrapping is on by default
    with a "Wrap lines" switch.
  - **First view**: the first 262,144 UTF-16 code units (256 Ki characters, cut before a surrogate
    pair if needed) are rendered; "Show the rest (3.2 MiB)" renders everything. "Copy" always copies
    the complete string through `clipboard.ts`.
  - From the viewer, deliver now, hold, release and delete (with its confirmation) act on that one
    message through the same bulk operation.
  - `404` shows "This message is no longer in the queue" with a way back to the queue and removes
    it from the cached list (edge case, FR-002).
- **Rationale**: A route gives each message its own address. Rendering a slice keeps a 10 MiB
  message readable within 2 s on a mid-range phone (SC-011).
- **Alternatives considered**: A virtualised line viewer was rejected: `<pre>` with a slice is enough
  and keeps find-in-page and selection working.

---

## 6. Ban service

### R16. Ban service: sections, lists, rules and bans

- **Decision**:
  - **Screen** (FR-063): sections in order — active bans, permanent bans, parameters, lists, external
    enforcement, filter rules — with a section index at the top on phones (links to each section
    heading). `/operations/fail2ban/:section` focuses `bans`, `settings` (parameters) or `rules`. A
    banner shows `banServiceRunning: false` (FR-073) and "Restart netfilter" sits in the page header
    (FR-017, R8).
  - **Settings** (FR-067, FR-072): three `EditableSection`s (UI 002) over one `getFail2BanSettings`
    query, opened through the `edit` address parameter (`parameters`, `lists`, `external`, and
    `rules` for the rules editor), one at a time. Each save sends `PATCH /fail2ban/settings`
    (`application/merge-patch+json`) with only that section's changed values and **always**
    `If-Match: <etag>` (the contract makes it optional; the spec requires it). `412` uses
    `useVersionedSave`'s `changedSince` marking: the input is kept, the settings are reloaded,
    values changed meanwhile are marked with their new saved value, and the user saves again or
    discards; nothing is merged or re-sent automatically. Leaving with unsaved changes asks for
    confirmation through UI 002's `useLeaveGuard` (FR-074).
  - **Durations** (FR-068): `fail2ban/duration.ts` converts seconds to the largest exact unit (days,
    hours, minutes, seconds) and back; `DurationField.vue` is a number input (`inputmode="numeric"`)
    plus a unit `<select>`. Ranges come from `fail2ban/limits.ts` (R4); "maximum not below ban time"
    is checked too. A stored value outside the rules is shown as stored and does not block a save
    that leaves it unchanged, because only changed values are sent.
  - **Lists** (FR-069): `EntryListField.vue`, a `<textarea>` with one entry per line
    (`autocapitalize="none"`, `autocorrect="off"`, `spellcheck="false"`) and an entry count.
    `fail2ban/list-entries.ts` trims, drops empty lines and keeps the first of duplicates, keeping a
    map from each sent index to its line number, so that a server error at `denylist.<n>` is listed
    below the field as "Line 12: <entry> — <translated reason>". Client checks: allowlist entries are
    an address, a prefix network or a host name; denylist entries an address or prefix network and
    not `0.0.0.0`, `0.0.0.0/0` or `::/0`; an entry on both lists is refused; at most
    `limits.fail2banListMaxEntries` entries of at most 253 characters. mailcow's internal networks
    are known only to the server (`reserved`).
  - **Own address** (FR-064, FR-069): `fail2ban/covers-address.ts` tests whether an address or
    network contains `clientAddress` (IPv4 and IPv6 prefix arithmetic). Saving a denylist that newly
    covers it, and denylisting a ban whose network covers it, show a warning in the confirmation
    ("This entry covers your own address 198.51.100.7; you would lock yourself out"). It warns; it
    does not block.
  - **External enforcement** (FR-070): the switch with the legacy explanation, the ban list address
    with a copy action, and "Generate a new address" after a confirmation that the old address stops
    working at once; `POST /fail2ban/ban-list-rotation` with `If-Match`; the new address is shown
    with copy.
  - **Rules** (FR-071): `RulesSection.vue` lists numbered rules; the editor adds, edits (multi-line
    `<textarea>` per rule), removes and reorders with "Move up"/"Move down" buttons (keyboard
    operable, the moved rule keeps focus, the new position is announced). Client checks: 1 to
    `limits.fail2banRulesMax` rules of 1 to `limits.fail2banRuleMaxLength` characters. The explanation
    says that the first capture group must capture the client address. `PUT /fail2ban/rules` with
    `If-Match`; refusals at `rules.<n>` (`invalidRegex` with `error` shown verbatim as technical
    detail, `missingCaptureGroup`) are shown on their rule. "Reset to default" asks for confirmation
    (custom rules discarded, ban service restarts); `POST /fail2ban/rules/reset` with `If-Match`:
    `200` shows the returned defaults; `504 ban-rules-not-restored` explains that the defaults appear
    with the next log line and offers "Reload" (never a second reset); `504 outcome-unknown` reloads
    the rules.
  - **Active bans** (FR-064, FR-065): a paged list (address keys prefixed `b`, data-model §5) with
    search, sort (end time, network) and the "lift pending" filter. Each ban not pending offers
    "Lift ban", "Lift and allowlist" (no confirmation) and "Denylist" (confirmation naming the
    network, that it becomes permanent within about a minute and is removed from the allowlist).
    The returned ban replaces the entry; the settings and permanent bans are invalidated when lists
    changed. `404` says that the ban already ended and refreshes.
  - **Pending lifts** (FR-065): `fail2ban/usePendingLifts.ts` refetches the active bans every
    `pollIntervalSeconds` while a listed ban is `queuedForLifting`, the page is visible and live
    updates are not paused or inactive (R5), for at most 60 s after the last lift.
  - **Permanent bans** (FR-066): a paged list (keys prefixed `p`) showing network and start time, with
    "Remove from denylist": a `PATCH` of the denylist without that entry and `If-Match`; a `412`
    reloads and asks again.
- **Rationale**: Section saves with version tags are UI 002's pattern and API 011 FR-045. Line-based
  lists are fast for hundreds of pasted networks. Warnings about the own address are what the
  contract recommends to clients.
- **Alternatives considered**: Drag-and-drop reordering was rejected as the only means (keyboard
  operability); buttons are enough. Blocking a denylist entry that covers the own address was
  rejected: an administrator may intend it from another network, and the spec asks for a warning.

---

## 7. Cross-cutting

### R17. Problem handling and `Audit-Recorded`

- **Decision**:
  - Problem types are translated by name (UI 001 R15): `container-protected`,
    `container-not-running`, `container-action-failed`, `mail-service-not-running`,
    `queue-action-failed`, `outcome-unknown`, `ban-rules-not-restored`, `ip-check-disabled`,
    `temporary-failure`, `about:blank` 404 and 412, `validation-failed` (FR-076). The "outcome
    unknown" message names the action the app sent; it does not read the `step` extension, which
    the contract documents only in prose. `serviceMessage` (declared in `ContainerProblem` and
    `MailQueueProblem`) and `invalidRegex`'s `error` parameter are shown verbatim in a "Technical
    detail" disclosure.
  - Validation messages for this feature's codes and parameters: `outOfRange` (`min`, `max`,
    `minField`), `mustNotExceed` (`field`, `value`), `reserved` (`reserved`), `conflictsWith`
    (`field`, `value`), `tooMany`, `tooLong`, `tooShort`, `required`, `invalidFormat` with formats
    `ipNetwork`, `ipNetworkOrHostname`, `queueId` and `logCursor`, `invalidRegex`,
    `missingCaptureGroup`. Unknown codes fall back to the generic invalid value (FR-076).
  - `src/api/problem.ts` gains `auditRecorded: boolean`, `false` only when the response carries
    `Audit-Recorded: false`; the feature's success handlers read the same header from
    `response.headers`. The flag drives the "carried out without an audit record" warning.
  - `503 temporary-failure` says that nothing was changed and offers a retry that keeps the input
    (edge case); `Retry-After` is shown as "try again in about N seconds".
- **Rationale**: FR-076 and the contract's problem documentation. The header is the only way the
  API reports a missing audit record.

### R18. History and the audit log screen

- **Decision**:
  - History actions (FR-075) use UI 002's `HistoryLink.vue`: container cards
    (`targetType=container&targetId=<name>`), the mail queue screen (`targetType=mailQueue`), the ban
    settings (`targetType=fail2banSettings`) and the filter rules (`targetType=fail2banRules`).
  - The audit log screen gains labels for the 17 event types, the 7 target types and the failure
    reasons `serviceFailure` and `rulesNotRestored` (`src/features/audit-log/labels.ts`). These are
    contract enumerations, so they are typed.
  - **Details**: `AuditEvent.details` is an open object in the contract (`additionalProperties:
    true`). The members that API 011 writes (`outcome`, `stateBefore`, `stateAfter`,
    `serviceMessage`, `results`, `changes`, `allowlistAdded`, `denylistRemoved`, `oldRules`,
    `newRules`, `network`, …) are documented only in the API's own research, not in the contract.
    Constitution I forbids relying on undocumented shapes, so the app presents them, like UI 002
    does for its records (UI 002 plan gap G1), through UI 001's generic details view, **as
    stored**: keys and values as text. The generic view is made shape-agnostic where it is not yet:
    nested objects and arrays become nested definition lists, and any array longer than 10 items is
    collapsed behind "Show all <n>" (`src/features/audit-log/components/AuditEventDetails.vue`).
    That shows the state before and after, every queue ID with its result (collapsed when there are
    many), the old and new values and the rules, without translated keys or unit formatting.
    Typed, translated presenters follow with the contract bump that describes these members (plan
    API gap 8, spec gap 10).
- **Rationale**: Conventions "History and audit": each feature adds its labels to the audit log
  screen. Constitution I: no hand-written types for API data.
- **Alternatives considered**: Typed presenters written from the API's research document: rejected
  (constitution I); they would break silently when the API changes a member name.

### R19. Internationalisation

- **Decision**:
  - New hand-written keys under `operations.*` (`nav`, `live`, `dashboard`, `containers`, `logs`,
    `rspamd`, `queue`, `fail2ban`, `updates`) and `nav.groups.system`, in `en-gb`, `cs-cz` and
    `sk-sk`.
  - **Legacy reuse** through `src/i18n/legacy-map.json` for the keys the spec lists where the meaning
    is unchanged (`debug.*`, `footer.restart_*`, `header.restart_netfilter`, `queue.*`, `admin.f2b_*`,
    `admin.queue_unban`, `admin.unban_pending`, `admin.no_active_bans`, `admin.reset_default`,
    `admin.arrival_time`, `admin.message_size`, `admin.sender`, `admin.recipients`, `admin.priority`,
    `admin.message`, `admin.rate_name`, `admin.authed_user`, `admin.task`, `admin.ip_check_disabled`,
    `admin.reset_limit`, `admin.hash_remove_info`, `admin.ban_list_info`, `success.f2b_modified`,
    `success.f2b_banlist_refreshed`, `success.queue_command_success`, `danger.reset_f2b_regex`).
    Labels whose meaning changes get new keys, notably the duration labels with "(s)"
    (`admin.f2b_ban_time`, `admin.f2b_max_ban_time`, `admin.f2b_retry_window`) because the unit is now
    chosen, and `debug.log_info`, which names `LOG_LINES` and the product.
  - **Markup**: six reused keys contain HTML (`footer.restart_container_info`, `queue.info`,
    `admin.f2b_list_info`, `admin.ip_check_disabled`, `admin.hash_remove_info`,
    `admin.ban_list_info`). They are mapped with UI 002's opt-in form
    `{ "from": "<legacy key>", "stripMarkup": true }`, which removes tags, decodes entities and
    collapses whitespace; the plain form keeps refusing HTML.
  - **Slovak gaps**: the upstream `sk-sk` file lacks `debug.architecture`, `debug.current_time`,
    `debug.timezone`, `debug.cores`, `debug.memory`, `debug.container_running`,
    `debug.container_stopped`, `debug.show_ip`, `debug.error_show_ip`, `debug.update_available`,
    `debug.no_update_available`, `debug.update_failed`, `admin.f2b_ban_time_increment`,
    `admin.f2b_manage_external`, `admin.f2b_manage_external_info`, `admin.queue_unban`, `admin.task`
    and `success.f2b_banlist_refreshed`; their Slovak values are written in
    `src/i18n/messages/sk-sk.json` (UI 001 R15).
  - **Enumerations**: `scripts/i18n/check.mjs` adds `ContainerState`, `ContainerRole`,
    `ContainerAction`, `LogSeverity`, `MailQueueName` and `MonitoringLogRetention.policy` to its
    required enumerations; the 011 values of `AuditEventType`, `AuditTarget.type`,
    `AuditFailureReason`, `ValidationRuleCode` and the problem types are already required by the
    existing rules once the pin contains them, and UI 011 gives them final wording.
  - **Formatting**: sizes in binary units through UI 002's `formatBytes` in `src/i18n/format.ts`;
    UI 011 adds `formatRate` (bytes per second, binary units) and `formatUptime` (days, hours and
    minutes with `Intl.NumberFormat` unit style) there; percentages with `Intl.NumberFormat`
    (`style: 'percent'`). Host time in the host's time zone with the zone's
    name (`Intl.DateTimeFormat` with `timeZone` and `timeZoneName: 'long'`) (FR-004).
  - Product names in explanations come from the branding (FR-089); no text names mailcow's product
    brand.
- **Rationale**: Constitution IV and UI 001 R15/R27.

### R20. Accessibility and mobile specifics

- **Decision** (UI 001 R21 applies; additions):
  - **Announcements** (FR-024, FR-086): automatic refreshes are silent; a container that stops is
    announced once; result counts after search or filter, action progress start and outcomes, and
    save outcomes are announced politely without moving focus. Outcome unknown and failures use the
    assertive region.
  - **No blinking** (FR-084): state indicators are static icons with text; the legacy animated
    "running" dots are not reproduced. Spinners use `motion-safe:animate-spin` and are replaced by a
    static icon under reduced motion.
  - **Sticky bars** (FR-080, FR-082): the selection action bar and form actions are sticky at the
    bottom on phones, and `scroll-padding-bottom` equals their height so focused elements are never
    hidden behind them (WCAG 2.4.11).
  - **Inputs** (FR-081): number fields use `inputmode="numeric"` (`decimal` for scores); fields for
    addresses, networks, host names, rules, queue IDs and searches set `autocapitalize="none"`,
    `autocorrect="off"` and `spellcheck="false"`.
  - **Tables** (FR-085): header cells, `aria-sort` on sortable headers; card lists are `<ul>` with
    the item name as heading.
  - **Expandable cards**: the card header is a `<button aria-expanded>` controlling the panel.
- **Rationale**: These make FR-079 to FR-087 testable with the fixtures of UI 001.

---

## 8. Testing and budgets

### R21. Testing

- **Decision**:
  - **Mock handlers** (UI 001 R22 pattern), one file per contract module:
    `tests/mocks/handlers/{host,containers,logs,rspamd,mail-queue,fail2ban}.ts`, plus UI 006's
    rate-limit handler for the reset. Every request and response is validated against the pinned
    contract; closed enumerations cannot carry unknown values, so unknown `ContainerRole`,
    `ContainerState` and audit values are unit-tested with plain values.
  - **Scenario clock**: the operations scenarios carry a host clock (real time plus an offset
    settable through `PATCH /__mock/scenarios/:id`), per-kind collection lags (to produce outdated
    data), figures that change on every overview request (a deterministic sequence), log entries
    that can be pushed between requests, and failure injection per operation (status, problem type,
    `Audit-Recorded: false`, delay). Scenarios live in `tests/mocks/scenarios/operations.ts`.
  - **Visibility fixture** `tests/e2e/fixtures/visibility.ts`: an init script makes
    `document.visibilityState` and `document.hidden` controllable and dispatches
    `visibilitychange`, so tests hide and show the page deterministically. `page.clock` advances the
    polling timers; `mockApi.requests()` counts requests per operation (SC-004).
  - **End-to-end** specs in `tests/e2e/operations/`, one per user story plus `performance.spec.ts`;
    every acceptance scenario has a test titled with its ID, on `mobile-chromium` (360 px),
    `desktop-chromium` and `mobile-webkit`, with `expectAccessible` in both themes on every screen
    and state, `expectNoHorizontalScroll` and `expectTouchTargets` (UI 001 R24). Network drops are
    simulated with `route.abort()` on the action request.
  - **Unit and component tests** in `tests/unit/features/operations/` for the pure modules
    (thresholds, host clock, series, scale, container list, duration, list entries, covers-address,
    selection, slicing, log descriptors, release-notes rendering with an injection table) and the
    main components.
  - **Smoke** (`tests/smoke/operations.smoke.spec.ts`) against the API dev stack with
    `RESTV2_FAKE_OUTBOUND=y` (API 011 quickstart Part B), which `scripts/smoke/stack-up.sh` sets for
    the local stack: dashboard figures and containers, a protected container without Stop, a Postfix
    log line pushed into Redis and found by search, a ban time change with `If-Match` and its
    restoration, a SOGo restart through the fake container service and its History entry. A
    `@read-only` subset (dashboard and logs) runs against a real host (UI 001 quickstart Part D).
- **Rationale**: Constitution VI; the clock and visibility controls make polling tests
  deterministic.

### R22. Performance budgets for the chart route

- **Decision**:
  - `scripts/check-bundle-budget.mjs` (UI 001 R26) gains per-chunk budgets read from
    `scripts/bundle-budgets.json`:
    - `LiveLineChart` chunk ≤ 6 KB gzipped;
    - the dashboard route chunk ≤ 45 KB gzipped (without the chart and without `marked`);
    - the `marked` chunk and the release-notes renderer reachable only through dynamic imports;
    - the initial JavaScript still ≤ 200 KB gzipped, and none of these chunks among its static
      imports.
    The script fails when a budgeted chunk exceeds its limit or appears in the static import graph
    of the entry or of the logs, mail queue and ban service route chunks (it reads the Vite
    manifest's `imports` and `dynamicImports`).
  - `tests/e2e/operations/performance.spec.ts`: opening the logs, mail queue and ban screens
    requests no `LiveLineChart-*.js` and no `marked` chunk (SC-011); on the dashboard, with the chart
    chunk delayed by `page.route`, the figures are visible before the chart.
  - Lighthouse CI gets a third collection, `/ng/operations/dashboard` with the scenario
    `admin-operations-lighthouse` (performance and accessibility ≥ 0.9). That scenario reports
    `pollIntervalSeconds: 60`, a contract-valid value, so that Lighthouse's network-idle detection is
    not defeated by 5-second polling.
- **Rationale**: Constitution VII requires budgets and lazy routes, and the constitution's
  technology rule requires charts to be lazy-loaded on their route.
