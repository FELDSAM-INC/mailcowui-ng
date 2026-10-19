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
