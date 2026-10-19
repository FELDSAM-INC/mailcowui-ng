# Quickstart and Validation Guide: UI Feature 011

**Feature**: `specs/011-monitoring-operations` | **Plan**: [plan.md](./plan.md) |
**Contract**: [contracts/README.md](./contracts/README.md)

This guide proves the feature works. Part A covers the automated gates, Part B manual checks per
user story against the mock API, Part C the smoke suite against the mailcow-rest-v2 dev stack, and
Part D checks on a mailcow host. Setup, development servers and contract bumps are as in
[UI 001's quickstart](../001-sign-in-app-shell/quickstart.md); this guide refers to the spec, the
research and the data model instead of repeating them.

## Prerequisites

- Everything UI 001's quickstart lists.
- UI features 001–010 implemented (plan "Dependencies on earlier work").
- The contract pinned at `32079252d55797d3da4e58ae661e9fb91c51c6f9` or a later commit with the same
  44 operations (`cat contract/VERSION.json`).
- For Part C: a mailcow-rest-v2 checkout whose implementation includes API 011, with its outbound
  fakes (`RESTV2_FAKE_OUTBOUND=y`, API 011 quickstart Part B).

## Part A: Automated gates

```bash
npm ci
npm run lint && npm run typecheck && npm run contract:check
npm run i18n:check                     # also ContainerState, ContainerRole, ContainerAction, LogSeverity,
                                       # MailQueueName and MonitoringLogRetention.policy
npm run licenses:check                 # marked (MIT) allowed
npm run test:unit                      # includes tests/unit/features/operations/**
npm run build && npm run budget:check  # initial JS ≤ 200 KB gz; LiveLineChart ≤ 6 KB; dashboard route ≤ 45 KB;
                                       # marked and the chart only behind dynamic imports
npm run test:e2e -- --grep "@operations"   # or the whole suite
npm run lhci                           # now also /ng/operations/dashboard (admin-operations-lighthouse)
```

**Expected**:

- Every command exits with 0.
- `budget:check` prints the budgeted chunks (`LiveLineChart-*.js`, `DashboardPage-*.js`,
  `marked-*.js`) with their sizes and confirms that none is statically imported by the entry or by
  the logs, mail queue and ban service routes.
- `test:e2e` reports every `US<n>-AS<m>` test of this feature passing on `mobile-chromium`,
  `desktop-chromium` and `mobile-webkit`, with no axe, CSP or mock contract violation.
- `lhci` prints performance and accessibility of at least 0.9 for `/ng/operations/dashboard`.

## Part B: Manual checks per user story (mock API)

Run `npm run preview:mock`, open `http://localhost:4173/ng/`, and pick a scenario with
`npm run mock:scenario -- <name>` (scenarios in `tests/mocks/scenarios/operations.ts`). Check each
screen at 360 px and on a desktop, in both themes, and once with the operating system's reduced
motion setting on.

| Story | Scenario | Steps | Expected (spec reference) |
|---|---|---|---|
| US1 | `admin-operations` | Open the navigation; open System › Dashboard | Group "System" with Dashboard, Logs, Mail queue, Fail2ban; host, processor, memory, swap, storage and container cards; ages "Updated n s ago"; charts after a moment (US1-AS1–AS3, FR-001) |
| US1 | `admin-operations` | Tap "1 not running" in the summary | Only the stopped SOGo card, "Stopped" in text; address has `state=notRunning` (US1-AS4) |
| US1 | `admin-operations` | Switch to another tab for a minute, come back | No request while hidden (DevTools network); fresh data at once (US1-AS5, SC-004) |
| US1 | `ops-container-service-down` | Open the dashboard | Host, containers and storage each show their own error with a retry; version line and logs still work (edge case, FR-025) |
| US1 | `admin-operations` | "Pause live updates", wait, "Resume" | Paused since a time, no requests; resume refetches at once (US1-AS9) |
| US2 | `ops-container-actions` | Restart SOGo; stop ClamAV; open the database card; open the API's own card | Confirmation names the container and the interruption; progress with elapsed time; "Restarted" announced; database: no Stop and an explanation; own container: neither Stop nor Restart (US2-AS1–AS3) |
| US2 | `ops-container-actions` | Restart the container set to time out | "Outcome unknown", then the state read again; no second request (US2-AS4, SC-006) |
| US3 | `ops-logs-large` | Logs › Postfix; search `ALICE@example.org`; severity Error; "Load older entries" twice | Total 10,000; matches only; no duplicates although entries are added meanwhile (US3-AS1–AS3, SC-010) |
| US3 | `ops-logs-large` | Open a 2,000-character entry at 360 px; copy it | Wraps without horizontal scrolling; expand and copy work (US3-AS4, SC-009) |
| US3 | `ops-rate-limits` | Rate limits log; "Reset rate limit" on an entry | Confirmation, then the log refreshed without that rate limit's entries (US3-AS9) |
| US4 | `ops-queue` | Mail queue; filter deferred + recipient `partner.example`; open one message | 3 messages with reasons; viewer with audit notice and verbatim content (US4-AS1, AS4) |
| US4 | `ops-queue-large` | Filter by the spam sender; "Select all matching"; Delete | "The first 1,000 of 1,400 are selected"; one request; result summary (US4-AS8, AS9) |
| US4 | `ops-queue` | "Delete all" | Dialog states the exact count incl. held; Delete disabled until the acknowledgement is ticked (US4-AS6) |
| US5 | `ops-fail2ban` | Lift a ban; lift and allowlist another; denylist a third | "lift pending", then gone; allowlist updated; denylist confirmation names the network (US5-AS1, AS2, AS9) |
| US5 | `ops-fail2ban` | Edit parameters: ban time 30 s; then 2 hours | Field error, nothing sent; 2 hours sends 7,200 (US5-AS3, AS10) |
| US5 | `ops-fail2ban-client-in-denylist` | Add the shown network to the denylist and save | Warning that it covers your own address (FR-069) |
| US6 | `ops-rspamd` | Logs › Rspamd; switch the chart to the table; search the history for `spammer@example.net` | Bars with counts and percentages, summary sentence, table with the same figures; the "reject" entry with its symbols (US6-AS1–AS3) |
| US7 | `admin-operations` | Open the version's release notes; "Show public IP" | Notes formatted, HTML as text, images as links, no request to another origin; IPv4 and IPv6 or "unavailable" (US7-AS1, AS3, AS5) |
| US7 | `ops-ip-check-disabled` | Open the dashboard | No "Show public IP"; explanation where to switch it on (US7-AS4) |
| US8 | `ops-audit-records` | A container card › History; the queue › History | Audit log filtered to the container or the queue; state before and after; queue IDs with results (US8-AS1, AS2) |

## Part C: Smoke suite against the mailcow-rest-v2 dev stack

```bash
export MAILCOW_REST_V2_DIR=../mailcow-rest-v2
scripts/smoke/stack-up.sh        # sets RESTV2_FAKE_OUTBOUND=y for the local API stack
npm run test:smoke -- --grep @operations
scripts/smoke/stack-down.sh
```

**Expected**: `tests/smoke/operations.smoke.spec.ts` passes: the dashboard shows the fake host figures
and containers; the database card offers no Stop; a Postfix line pushed into Redis is found by search
in the Postfix log; the ban time is changed with `If-Match` and restored; a SOGo restart through the
fake container service shows "Restarted" and appears in the container's History.

## Part D: On a mailcow host

1. Deploy the image as UI 001's quickstart Part D describes, with an API that includes feature 011.
2. Compare the dashboard with the classic dashboard: host figures, storage (`df -H`), every
   container's state (`docker compose ps`) (SC-003).
3. `SMOKE_BASE_URL=https://<host>/ng/ npm run test:smoke -- --grep "@operations.*@read-only"` passes
   (dashboard and logs only).
4. On a phone: restart a container in two interactions after opening its card (SC-001); find why a
   message is stuck in under a minute (SC-002). Record the timings and a VoiceOver/TalkBack pass in a
   "Validation log" section appended to this file.

## Validation log

**2026-10-19, resumed integration onto UI main `990830e7`**: the monitoring branch was rebased
once, keeping both routing and operations routes, translations, mocks, smoke cleanup and Lighthouse
collections. Type checking, ESLint, formatting, contract consistency, translations, license checks,
the production build and bundle budgets pass. Initial JavaScript is **186,459 bytes gzipped**
(limit 204,800). The runtime audit reports no vulnerabilities; the configured development audit
gate passes with 21 advisories below its critical threshold (2 low, 4 moderate, 15 high).

The full unit run passes **3,263 tests in 369 files**, with **88.97% line coverage**. The affected
browser integration run (operations, routing, navigation, shell, audit log and API keys, three
browser projects) finished with 1,449 passed, 11 skipped and four failures. Three failures were
the same outdated placeholder test: routing is now available, so the test uses System settings.
The fourth was a chart test advancing the fake clock before its preceding polling response had
finished. It now waits for each response. Those tests, together with the repaired API-key heading
assertion, pass **18 focused runs** (three tests, three projects, repeated twice). The API-key
assertion is scoped to the main content because the navigation also has a System heading.

The earlier audit-log empty-filter failure did not reproduce in the initial focused run, ten
additional mobile repetitions, or the integrated three-browser run. Its cause remains unproven;
no production change was made for it. Local logs are in the API checkout's ignored
`storage/app/restart-2026-10-19/u011/resume-*.log` files. These are local checks; no remote CI or
deployment was triggered by this resumption.

**2026-10-19, quiet-machine Lighthouse (T146): failed.** All eight collections ran three times,
including `admin-operations-lighthouse`; nothing was skipped. Browser, unit and build workloads
had finished before this run. The initial-script size and accessibility assertions pass, but
every route misses the required performance score of 90:

| Route | Performance, three-run range | Accessibility |
| --- | --- | --- |
| Sign-in | 85–89 | 100 |
| Home | 82–84 | 100 |
| Domains | 75–78 | 99 |
| Aliases | 72–74 | 99 |
| DKIM keys | 80–84 | 100 |
| Mailboxes | 81–82 | 99 |
| Relayhosts | 80–81 | 99 |
| Monitoring dashboard | 68–71 | 100 |

The run exited 1 on the performance assertions. It is not treated as a pass or attributed to
test contention. JSON/HTML reports and assertion results are preserved in the API
checkout at `storage/app/restart-2026-10-19/u011/resume-lighthouse-reports/`; the command log is
`resume-lighthouse.log`. **T146 stays open and UI main stays at `990830e7`.** The next performance
work should use these measured reports; the thresholds and throttling were not relaxed.
The best dashboard run has cumulative layout shift **0.294**, LCP **3.3 s**, and total blocking
time **190 ms**. The best sign-in run has no layout shift, LCP **3.2 s**, and blocking time
**120 ms**; its largest element is the announcement text after application startup. These are
measured symptoms, not an established root cause or a completed fix.

**2026-10-19, bounded performance follow-up**: the dashboard now keeps its overview rows and
CPU/memory area in place while values load. The first route downloads during the existing
authenticated bootstrap. Repeated number/list/relative-time formatting no longer resolves the
device time zone; calendar formatting still does. Repeated short legacy HTML translations reuse
sanitized strings in a bounded cache, with unchanged sanitization rules. Regression tests were
observed failing before the fixes.

An isolated diagnostic of the layout and route-loading changes reduced dashboard CLS from
**0.294 to 0.0225**, with performance **86**; sign-in scored **88**. These individual diagnostics
do not pass T146 and do not measure the final patch. Following the owner's concern about the
effort spent on slow-mobile optimization, further bootstrap, lazy-menu and bundler experiments
were removed. No performance threshold was changed, and further score tuning stopped. The
discarded experiments are archived locally in the API checkout's
`storage/app/restart-2026-10-19/u011/perf-experiments-before-trim.{tgz,patch}`.

The final retained patch passes **3,267 unit tests in 369 files**, with **88.98% line coverage**
(`u011/final-unit.log`). This includes the dashboard loading-state regression, formatting and
sanitizer regressions, existing hostile-content cases, and bootstrap tests.
Lint, type checking, formatting, i18n, contract consistency, licenses, the production build and
bundle budgets pass. Initial JavaScript is **186,760 bytes gzipped** (limit 204,800). No dependency
or lockfile changed, so the recorded dependency audit remains applicable.
The focused production-build browser run passes **231 tests** across mobile Chromium, desktop
Chromium and mobile WebKit: dashboard and delayed loading, shell bootstrap, password sign-in,
sign-in screens, SSO round trips, preferences and legacy translations including hostile markup.
The log is `u011/final-browser.log`; artifacts are in `u011/final-browser-results/`. The retained
fixes remain a local checkpoint while T146 is open; they have not been pushed or deployed.

**2026-10-19, Part C (T150)**: the smoke suite ran against a local mailcow-rest-v2 dev stack at
`4be8653` with `RESTV2_FAKE_OUTBOUND=y` (Compose project `ui011-smoke`, port 18680; the API checked
out as a clone in `.smoke/api`, not as a worktree). `tests/smoke/operations.smoke.spec.ts`: 6 passed
(dashboard figures and every container, no horizontal scroll at 360 px, SOGo restarted through the
fake container service with legacy's "OK" and no Stop on the database card, the Postfix line pushed
into Redis found by a case-insensitive search, the recorded queue of 8 messages with 3 deferred to
partner.example, and the ban time changed to 7,200 s with `If-Match`, read back after a reload and
restored). The restart's History entry is covered by the mock end-to-end tests
(`tests/e2e/operations/history.spec.ts`), not by the smoke suite.

**Part B on real phones (T149) and Part D on a mailcow host (T150)**: not run. This environment has
no Android phone, no iPhone and no screen reader, and the feature is not deployed to a mailcow host
before it is merged. They remain for the owner after the merge (staging host), with SC-001, SC-002
and SC-011 timed and a VoiceOver and TalkBack pass of every story.
