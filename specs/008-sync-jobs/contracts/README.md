# Contracts of UI feature 008

This app exposes no API of its own. Its only interface is the mailcow-rest-v2 contract it
consumes (constitution I), vendored in `contract/` as UI 001 decided
([UI 001 contracts](../../001-sign-in-app-shell/contracts/README.md)). This file records the
contract version UI 008 needs and the operations it uses.

## Pinned contract

| Field | Value |
|---|---|
| API repository | `FELDSAM-INC/mailcow-rest-v2` |
| API feature | 008 – sync jobs (module `api/modules/sync-jobs/`), plus operations of 001, 002 and 003 |
| Contract version (`info.version`) | `0.1.0` (does not identify a contract, UI 001 research R6) |
| Planning baseline (authoritative minimum) | `32079252d55797d3da4e58ae661e9fb91c51c6f9` (2026-10-18, "Register KnownProblemType in contract components") |
| Last change of the sync-jobs contract | `0fb4f73` ("Use requiredFlags in feature 008 permission refusals") |
| Bundle at the baseline | `@redocly/cli@2.64.1 bundle api/openapi.yaml`, 376 operations, sha256 `5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6` (computed while planning) |
| `knownProblemTypeValues` generated | yes: `KnownProblemType` is listed under `components.schemas` at the baseline (UI 001 plan, API gap 5, closed) |

**Pin rule** (research R1, task T001): pins only move forward. If `contract/VERSION.json` already
names the baseline or a later commit, keep it; otherwise run
`scripts/contract/bump.sh 32079252d55797d3da4e58ae661e9fb91c51c6f9` (or a later release tag that
contains it). Then confirm that the operations below, their parameters, request and response
schemas and documented statuses are identical to the baseline. A difference stops UI 008 until
this plan is updated. After a bump: `npm run typecheck`, `npm run test:unit`, `npm run test:e2e`.

## Operations used by this feature

| operationId | Method and path | Used by | Requirements |
|---|---|---|---|
| `listSyncJobs` | GET `/sync-jobs` | list (search, filters, sort, paging), pre-filtered list, automatic refresh | FR-002, FR-004, FR-005, FR-009 to FR-014 |
| `createSyncJob` | POST `/sync-jobs` | create form | FR-016 to FR-025, FR-028 |
| `getSyncJobsCapabilities` | GET `/capabilities/sync-jobs` | defaults, limits, encryptions, custom-parameter permission and allow-list, bulk limit | FR-018, FR-021, FR-037, FR-055, FR-056 |
| `applySyncJobBulkAction` | POST `/sync-jobs/bulk-actions` | activate, deactivate, schedule next and delete for a selection | FR-037, FR-039, SC-008 |
| `getSyncJob` | GET `/sync-jobs/{syncJobId}` | details screen; log header when the job is not cached | FR-015, FR-020, FR-030 |
| `updateSyncJob` | PATCH `/sync-jobs/{syncJobId}` (`application/merge-patch+json`, `If-Match`) | section saves; activate and deactivate one job | FR-026, FR-030, FR-036 |
| `deleteSyncJob` | DELETE `/sync-jobs/{syncJobId}` (`If-Match`) | delete one job | FR-039, FR-040 |
| `getSyncJobLog` | GET `/sync-jobs/{syncJobId}/log` | log viewer, only when opened | FR-041 to FR-046 |
| `rescheduleSyncJob` | POST `/sync-jobs/{syncJobId}/schedule-reset` (no `If-Match`) | schedule next run for one job | FR-036 |
| `listMailboxes` | GET `/mailboxes` (API 003) | target mailbox picker, mailbox filter | FR-009, FR-020 |
| `listDomains` | GET `/domains` (API 002) | domain filter | FR-009 |
| `listAuditEvents` | GET `/audit-events` with `targetType=syncJob&targetId=<id>` (API 001, filters from API 002 FR-058) | History action, through `HistoryLink` | FR-015 |
| `getIdentity` | GET `/me` (API 001) | access, mailbox user's target, refresh after `permission-flag-required` | FR-001, FR-003, FR-020 |

UI 001's operations (session, CSRF, public configuration) continue to apply unchanged.

## Problem types and the app's response

Messages come from `problem.<name>` or the feature's field messages, never from `title` or
`detail` (UI 001 FR-075). Details in [research R13](../research.md#r13-errors).

| `type` (`/api/v2/problems/…`) | Status | Operations | App behaviour |
|---|---|---|---|
| `permission-flag-required` (`requiredFlags: [syncjobs]`) | 403 | all nine | refresh the identity; `NoAccessState` in place; the navigation entry disappears (FR-001, FR-003) |
| `sync-job-exists` (`syncJobId`) | 409 | `createSyncJob`, `updateSyncJob` | form alert with "Open the existing job"; values kept (FR-023) |
| `validation-failed` | 422 | create, update, bulk, list | field messages (research R13); bulk `tooMany` names the limit; list parameters are normalised by the app and cannot fail in practice |
| `pending-action-required` | 403 | all | UI 001 session reaction |
| `csrf-token-mismatch` | 403 | unsafe operations | UI 001's silent retry |
| `insufficient-key-scope`, `api-key-source-not-allowed` | 403 | — | cannot occur with a session; generic message |
| `about:blank` 404 | 404 | single-job operations, create (target mailbox) | "not found" page, or "no longer exists" with a refreshed list; on create, an error on the target mailbox field |
| `about:blank` 412 | 412 | `updateSyncJob`, `deleteSyncJob` | reload and mark (sections), offer a retry (actions), confirm again (delete) |
| `about:blank` 400, 500 and non-problem 5xx; network failure | — | all | UI 001's generic message with retry and request ID |

## Contract facts the design relies on

- List entries carry `etag` and `runStatus`, but never the log or the password (API 008 FR-015).
- `etag` covers the stored configuration only; runs and reschedules never change it (FR-020
  there), so an open section edit is not outdated by a run.
- `SyncJobPatch` ignores unknown and read-only members and refuses `null`; an empty
  `remotePassword` keeps the stored one; a different `mailbox` is refused with `immutable`.
- `SyncJobBulkTarget.id` is the decimal string of `SyncJob.id`; `version` may omit the quotes.
- `exitStatus` is free text of at most 50 characters; only the seven codes listed in
  `SyncJobRunStatus` are recognised.
- `GET /mailboxes` never lists resources; mailbox users are refused, so the picker is offered only
  to administrators and domain administrators.
- `GET /audit-events` is for administrators only.
