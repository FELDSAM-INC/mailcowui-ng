# Quickstart and Validation Guide: UI Feature 008

**Feature**: `specs/008-sync-jobs` | **Plan**: [plan.md](./plan.md) |
**Contract**: [contracts/README.md](./contracts/README.md)

This guide proves the sync job screens work. Part A runs the automated gates, Part B gives manual
checks per user story against the mock API, Part C runs the smoke suite against a real
mailcow-rest-v2 dev stack, and Part D checks a mailcow host. The setup, the commands and the
fixtures are UI 001's ([UI 001 quickstart](../001-sign-in-app-shell/quickstart.md)); only what is
specific to sync jobs is repeated here.

## Prerequisites

- UI 001 to UI 007 implemented (research R2 lists the parts UI 008 builds on), and the pinned
  contract at or after the baseline of [contracts/README.md](./contracts/README.md).
- For Part C: the mailcow-rest-v2 dev stack at the pinned commit, with API 008 implemented and its
  development seeder extended (API 008 task T066): `alice@example.org` with the sync-jobs flag and
  jobs #1 (never run) and #2 (failed, wrong username or password, with a log), `bob@example.org`
  without the flag, `carol@example.net` with job #3, and `reseller` with the flag. Every password
  is `Passw0rd!dev`; alice's TOTP secret is `JBSWY3DPEHPK3PXP`.

## Part A: Automated gates

```bash
npm run contract:check     # pinned bundle intact; the 9 sync-job operations present
npm run lint && npm run typecheck
npm run i18n:check         # syncJobs.* complete in en-gb, cs-cz, sk-sk; SyncJobEncryption,
                           # SyncJobLastResult, SyncJobBulkAction and validation.format.hostName covered
npm run test:unit -- tests/unit/features/sync-jobs
npm run build && npm run budget:check   # initial JS unchanged; prints the sync-jobs chunks
npm run test:e2e -- tests/e2e/sync-jobs  # mobile-chromium, desktop-chromium, mobile-webkit
```

**Expected**:

- Every command exits with 0.
- `test:e2e` reports every `US1-AS*` to `US6-AS*` test of this feature and its `Edge:` tests passing
  on both viewports, with no axe violation in either theme, no CSP violation and no mock contract
  violation.
- `log-performance.spec.ts` (Chromium only) opens the 5 MB log in under 3 s with 4× CPU
  throttling, and scrolling to its end records no long task over 200 ms (SC-007).
- `password-secrecy.spec.ts` finds the marker password only in the `createSyncJob` and
  `updateSyncJob` request bodies (SC-003).
- `budget:check` shows the initial JavaScript unchanged and the three sync-job page chunks plus the
  log viewer under 25 KB gzipped together.

## Part B: Manual checks per user story (mock API)

Start `npm run preview:mock`, open `http://localhost:4173/ng/`, and pick a scenario with
`npm run mock:scenario -- <name>` (scenarios in [data-model.md §8](./data-model.md#8-mock-scenarios-testsmocksscenariossync-jobsts)).
Check each screen at 360 px and on a desktop, in both themes.

| Story | Scenario | Steps | Expected (spec reference) |
|---|---|---|---|
| US1 | `sync-jobs-admin` | Open Sync jobs; filter "Last result: failed"; sort by last run; reload; open a job | Cards at 360 px, a table on desktop; failed jobs read their legacy reason or "Check log" with icons and text; "Never" for never-run jobs; the filter and sort survive the reload; the details show every section (US1-AS1, AS2, AS5, AS6, AS8; FR-010, FR-015) |
| US1 | `sync-jobs-domain-admin` | Open Sync jobs | Only `example.org` jobs (US1-AS3) |
| US1 | `sync-jobs-user` | Sign in state as alice; open Sync jobs | Only alice's two jobs, no target mailbox column or filter (US1-AS4) |
| US1 | `sync-jobs-running` | Open the list and wait 30 s; finish the run with the "Finish a run" change of [data-model §8](./data-model.md#runtime-changes-patch-__mockscenariosid) | The running job updates by itself; "Pause automatic refresh" stops it (FR-014) |
| US1 | `sync-jobs-domain-admin-no-flag` | Open `/ng/sync-jobs` | No navigation entry; "not permitted" in place (FR-001, FR-003) |
| US2 | `sync-jobs-admin` | Add sync job at 360 px; pick a mailbox by typing; switch encryption to STARTTLS; enter an IPv6 host and submit | Advanced sections collapsed with counts; defaults filled; port changes 993 → 143; the host error appears on the field in the chosen language and focus moves to the summary (US2-AS1, AS2, AS7; FR-019) |
| US2 | `sync-jobs-user-restricted-params` | Add sync job | No target choice (own mailbox shown), no custom parameters field (US2-AS3; FR-056) |
| US3 | `sync-jobs-admin` | Open a job, edit Schedule, change the interval, save; edit Source, type a new password, save; edit Source again | Only the interval is sent; the password is sent once; the password field is empty again with "A password is saved" (US3-AS1 to AS3) |
| US3 | `sync-jobs-admin` | Edit Folders, then apply the "Change elsewhere" change of data-model §8, save | "Changed in the meantime", input kept, changed values marked, save again works (US3-AS5) |
| US4 | `sync-jobs-bulk` | Select three jobs, one of them the injected failure, Activate | One bulk request; summary "2 activated, 1 failed: …"; the failed job stays selected (US4-AS3) |
| US5 | `sync-jobs-admin` | Open "Check log" on a failed job at 360 px; switch wrapping off; Copy; press Back | Full-screen log; only the log area scrolls sideways; "Copied" announced; Back closes the log (US5-AS1 to AS3) |
| US6 | `sync-jobs-admin` | Delete one job and cancel; delete it; select three and delete | The dialog names source and target and says copied mail stays; focus returns on cancel; the bulk dialog lists three jobs and needs "3" typed (US6-AS1 to AS3) |
| Entry | `sync-jobs-admin` | Open a mailbox in Mailboxes; choose "Sync jobs" | The list opens filtered to that mailbox (FR-004) |

## Part C: Smoke suite against a real mailcow-rest-v2 dev stack

```bash
export MAILCOW_REST_V2_DIR=../mailcow-rest-v2
scripts/smoke/stack-up.sh
npm run test:smoke -- tests/smoke/sync-jobs.smoke.spec.ts
scripts/smoke/stack-down.sh
```

**Expected**: `sync-jobs.smoke.spec.ts` passes for:

- alice (with TOTP): sees jobs #1 and #2 but not #3; #2 reads "Wrong username or password" and its
  log opens as text; creates a job, sees the "already exists" message with a link when repeating
  it, edits its interval, deactivates it, schedules its next run and deletes it;
- bob: no Sync jobs entry, "not permitted" at `/ng/sync-jobs`;
- reseller: sees only `example.org` jobs;
- admin: creates two jobs for alice through the mailbox picker, deactivates and activates both in
  one bulk action, deletes both with the typed count, and opens alice's mailbox → Sync jobs.

Every job the suite creates is deleted at the end, so the seeded data stays as it was.

## Part D: On a mailcow host

With mailcowui-ng deployed as UI 001's quickstart Part D describes, sign in as an administrator,
open a mailbox that has a sync job created in the classic interface, follow "Sync jobs", and check
that the job, its last result and its log match the classic interface. Change the interval in the
new app and confirm the classic interface shows the change after a reload (spec Assumptions).

## Validation log

Record here, after implementation (tasks T076, T078 and T079):

- SC-001: time to identify every failed job in a list of 50 on a mid-range phone (target < 15 s);
- SC-002: time for a first-time user to create a job with defaults on a phone (target < 1 min);
- SC-007: the 5 MB log on a mid-range phone (target < 3 s, no visible stalls);
- a screen-reader pass of every user story with VoiceOver on iOS and TalkBack on Android.
