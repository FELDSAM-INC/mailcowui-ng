# Data Model: Sync Jobs

**Feature**: `specs/008-sync-jobs` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

The app owns no persistent data. This document defines the API data UI 008 consumes, the
app-defined view models derived from it, the server-state cache, the route map and address
parameters, the client-side validation, the state machines and the mock scenarios. Decisions are
justified in [research.md](./research.md). Contract shapes are not restated: types come from
`src/api/generated/schema.ts` through `@/api` (UI 001 research R7).

## 1. API data consumed

Generated root types, imported from `@/api`:

| Type | Operation(s) | Used by | Notes |
|---|---|---|---|
| `SyncJob`, `SyncJobRunStatus`, `SyncJobLastResult`, `SyncJobEncryption` | `listSyncJobs`, `getSyncJob`, `createSyncJob`, `updateSyncJob`, `rescheduleSyncJob` | list, details, actions | `remotePasswordSet` only; the password is never returned. `etag` is the quoted strong ETag. `runStatus` is not covered by `etag`. |
| `SyncJobCreateRequest` | `createSyncJob` | create form | `remotePassword` is `writeOnly` |
| `SyncJobPatch` | `updateSyncJob` (`application/merge-patch+json`, `If-Match`) | section saves, activate, deactivate | only changed members; `mailbox` never sent |
| `SyncJobLog` | `getSyncJobLog` | log viewer | `log` may be empty or several MB; `runStatus` refreshes the header |
| `SyncJobCapabilities`, `SyncJobDefaults`, `SyncJobRange` | `getSyncJobsCapabilities` | create form, sections, bulk bar | defaults, limits, encryptions, `customParameters.allowed`, `allowedOptions`, `bulkLimit`, `pageSize` |
| `SyncJobBulkActionRequest`, `SyncJobBulkAction`, `SyncJobBulkTarget` | `applySyncJobBulkAction` | bulk bar | `targets[].id` is the decimal string; `version` is `etag` without quotes |
| `BulkResult`, `BulkItemResult`, `BulkItemOutcome` | `applySyncJobBulkAction` | `BulkResultSummary` | results in request order |
| `SyncJobPermissionFlagProblem`, `ValidationProblem`, `Problem` | every sync-job error | `ApiProblem`, field messages | `sync-job-exists` carries `syncJobId` |
| `Mailbox` (address, display name) | `listMailboxes` | shared `MailboxSearchPicker` (create form, mailbox filter) | resources are never listed |
| `Domain` (name) | `listDomains` | shared `DomainPicker` (domain filter) | administrators and domain administrators only |
| `Identity`, `Scope`, `PermissionFlags` | `getIdentity` | access, mailbox user's target, fields per role | `scope.mailbox` for mailbox users |
| `AuditTarget['type']` (`syncJob`) | `listAuditEvents` via `HistoryLink` | History action | administrators only |

## 2. App-defined models

None of these restates an API shape. Each is derived from API data or from app constants.

### Job label (`presentation.ts`)

`jobLabel(job) = "{remoteUser}@{remoteHost}:{remotePort}"`, the legacy "server" column. It is the
card heading, the accessible name of the job's checkbox and menu, and the name in dialogs and
summaries. Long labels wrap (`break-words`), never truncate silently (FR-008).

### State (`presentation.ts`, FR-005, FR-006)

| `active` | `runStatus.running` | Badges (icon + text) |
|---|---|---|
| true | true | Running (`mailbox.running`) |
| true | false | Waiting (`mailbox.waiting`) |
| false | false | Inactive (`mailbox.inactive`) |
| false | true | Inactive + Running |

### Result (`presentation.ts`, FR-007)

| `lastResult` | `exitStatus` | Shown |
|---|---|---|
| `unknown` | any | nothing ("no result" for the filter) |
| `succeeded` | any | check icon + "Success" (`mailbox.syncjob_EX_OK`) |
| `failed` | one of `EXIT_CONNECTION_FAILURE`, `EXIT_CONNECTION_FAILURE_HOST1`, `EXIT_TLS_FAILURE`, `EXIT_AUTHENTICATION_FAILURE`, `EXIT_AUTHENTICATION_FAILURE_USER1`, `EXIT_OVERQUOTA` | cross icon + hidden "Failed:" + `mailbox.syncjob_<code>` |
| `failed` | anything else or `null` | cross icon + hidden "Failed:" + "Check log" (`mailbox.syncjob_check_log`) as a link that opens the log |

### Last run (`presentation.ts`, FR-005, FR-051)

| `lastRunAt` | `logAvailable` | Shown |
|---|---|---|
| a time | any | `RelativeTime` (absolute time available) |
| `null` | false | "Never" (`mailbox.never`) |
| `null` | true | "Cleared, runs on the next cycle" (`syncJobs.lastRun.cleared`) |

Constitution IV 1.3.0: the two `null` rows, and "Success" for an unrecognised success code above,
deviate from the classic interface (`mailbox.waiting` for every job without a last run;
`mailbox.syncjob_check_log` for an unrecognised code). They wait for a decision (plan, "Deviations
needing a decision"); until then the legacy texts are shown.

### Form values and sections (`form-model.ts`)

`SyncJobFormValues` is `Required<Omit<SyncJobCreateRequest, 'mailbox' | 'remotePassword'>>` plus
`mailbox: string` and `remotePassword: string`, derived with TypeScript utility types from the
generated type (constitution I). Numbers are held as strings while typed and parsed on submit.

| Section (`SectionId`) | Members, with imapsync option name (FR-025) | Advanced (FR-017) | Editable on details |
|---|---|---|---|
| `target` | `mailbox` | no | no (FR-020) |
| `source` | `remoteHost`, `remotePort`, `encryption`, `remoteUser`, `remotePassword` | no | yes |
| `schedule` | `intervalMinutes`, `active` | no | yes |
| `folders` | `destinationSubfolder` (`--subfolder2`), `exclude` (`--exclude`), `automap` (`--automap`), `subscribeAll` (`--subscribeall`) | no | yes |
| `duplicates` | `deleteDuplicatesOnDestination` (`--delete2duplicates`), `skipCrossDuplicates` (`--skipcrossduplicates`), `deleteFromSource` (`--delete1`), `deleteFromDestination` (`--delete2`) | yes | yes |
| `limits` | `maxAgeDays` (`--maxage`), `maxBytesPerSecond` (`--maxbytespersecond`), `remoteTimeoutSeconds` (`--timeout1`), `localTimeoutSeconds` (`--timeout2`) | yes | yes |
| `expert` | `customParameters`, `dryRun` (`--dry`) | yes | yes (`customParameters` read-only when not allowed, FR-056) |

Rules:

- **Initial create values**: `capabilities.defaults` for every member it lists; `remoteHost`,
  `remoteUser` and `remotePassword` empty; `remotePort` from the port rule; `mailbox` from the
  `?mailbox=` address parameter (administrators and domain administrators) or empty, and
  `identity.scope.mailbox` for mailbox users (shown, never sent).
- **Port rule** (FR-019): `standardPort(ssl) = 993`, `standardPort(starttls | plain) = 143`. On an
  encryption change, `remotePort` becomes the new standard port when the user has not typed into
  the port during this form or section edit and the port equals the previous encryption's standard
  port (or is empty).
- **Non-default count** of a section: the number of its members whose current value differs from
  `capabilities.defaults` (members without a default are not counted). Shown on collapsed headers
  in the form and on the details screen.
- **Create body**: every member of the form, except `mailbox` for mailbox users and
  `customParameters` when `capabilities.customParameters.allowed` is false; numbers parsed to
  integers.
- **Section patch**: the section's members whose value differs from the loaded `SyncJob`;
  `remotePassword` only when not empty; never `mailbox`; `customParameters` never when not
  allowed. An empty patch sends nothing and closes the section.
- **Warnings** (FR-024): shown while `deleteFromSource` or `deleteFromDestination` is on;
  `dryRun` always explains that a simulated run copies nothing.

### Field message override (`field-messages.ts`, FR-022)

`fieldMessage(field, violation)` returns a `syncJobs.errors.*` key for the pairs of research R13,
otherwise UI 001's `validation.<code>` key; `kind` (`resource`, `alias`, `aliasDomainAddress`) is
translated through `syncJobs.errors.kind.<kind>`.

### Log view (`log-view.ts`, FR-041 to FR-046)

| Condition (in this order) | View |
|---|---|
| request pending | loading state |
| request failed | `ProblemMessage` with retry; `404` says the job no longer exists |
| `log` not empty | the text in chunks of 500 lines (`chunkLog(text, 500)` preserves every character; joining the chunks returns the input), each displayed through `neutralise(chunk, { multiline: true })` (UI 006 R9); Copy uses the original text |
| `log` empty, `lastRunAt` null and `logAvailable` false | "No log yet" |
| `log` empty otherwise | "The run produced no output" |

Independently, `runStatus.running` adds the notice "A run is in progress. This is the log of the
previous run." with Refresh. View options: `wrap` (default true), held in component state only.

### Bulk view (`useSyncJobActions.ts`, FR-037)

A selection snapshot maps each selected `id` to `{ label, mailbox, etag, running }` when the action
starts, so the summary and the delete dialog name jobs even after the list changes.
`target(job) = { id: String(job.id), version: job.etag.replace(/^"|"$/g, '') }`.

## 3. Server-state cache

### Query keys (`src/api/query/keys.ts`)

| Key | Operation | staleTime | Fetched when | Notes |
|---|---|---|---|---|
| `['sync-jobs','list',SyncJobListParams]` | `listSyncJobs` | 30 s | on the list page | params from the address (§5); `refetchInterval` per research R7 |
| `['sync-jobs','detail',id]` | `getSyncJob` | 30 s | on the details page; for the log header when the job is not in the list cache | `initialData` from a cached list entry, `initialDataUpdatedAt` = that list's `dataUpdatedAt` |
| `['sync-jobs','log',id]` | `getSyncJobLog` | 30 s, `gcTime` 60 s | when the log viewer opens; on its Refresh | never prefetched (FR-046) |
| `['sync-jobs','capabilities']` | `getSyncJobsCapabilities` | 5 min | create page; details page; when selection mode starts | refetched after a `customParamsNotPermitted` refusal |
| `['mailboxes','picker',{q}]` | `listMailboxes` (`sort=address`, `limit=25`) | 30 s | picker open and typing (300 ms debounce) | `useInfiniteQuery`; the key of `MailboxSearchPicker` (UI 006's, if it differs, applies) |
| `['domains','picker',{q}]` | `listDomains` (`limit=25`) | 30 s | domain filter open and typing | `useInfiniteQuery`; the key of `DomainPicker` (as UI 007 R14) |

`SyncJobListParams` is an alias of the generated
`NonNullable<operations['listSyncJobs']['parameters']['query']>`.

### Invalidation after mutations

| Mutation | On success | On `412` | On other failures |
|---|---|---|---|
| `createSyncJob` | write `['sync-jobs','detail',id]` from the response; invalidate `['sync-jobs','list']` and `['audit-events']` | — | keep the form (FR-023) |
| `updateSyncJob` (section save, activate, deactivate) | write the detail; replace the entry in cached list pages; invalidate the other list pages and `['audit-events']` | refetch the detail and the list; mark changed values (section) or offer retry (action) | `404`: remove the detail, invalidate the lists, show "no longer exists" |
| `rescheduleSyncJob` | as `updateSyncJob` | — (no `If-Match`) | as above |
| `deleteSyncJob` | remove the detail and log; invalidate the lists and `['audit-events']` | refetch the detail; confirm again | as above |
| `applySyncJobBulkAction` | invalidate the lists and `['audit-events']`; remove details and logs of `done` deletions; invalidate details of other `done` items | per item (`outdated` in the summary) | network: "outcome unknown" for all, selection cleared, lists invalidated |

The typed remote password never enters any cache entry: the create and patch bodies are built in
the mutation function from component state and are not stored (FR-033).

## 4. Client state

- **Pinia**: nothing new.
- **Component state**: form values and section edits; the password `ref` (research R12); the
  selection (`useBulkSelection`); the automatic refresh controller (paused, inactivity notice) and
  `useInactivity`'s last interaction time; the log viewer's wrap option.
- **Device storage**: nothing new. UI 001's storage allowlist (data-model §4 there) is unchanged,
  and `tests/e2e/sync-jobs/password-secrecy.spec.ts` asserts it after the sync-job flows.

## 5. Route map

The base is `/ng/`.

| Name | Path | Layout | Access | Title key | Component (lazy chunk) |
|---|---|---|---|---|---|
| `sync-jobs` | `/sync-jobs` | shell | `active`, nav `syncJobs` | `syncJobs.title` | `features/sync-jobs/pages/SyncJobsPage.vue` |
| `sync-job-create` | `/sync-jobs/new` | shell | `active`, nav `syncJobs` | `syncJobs.create.title` | `features/sync-jobs/pages/SyncJobCreatePage.vue` |
| `sync-job-detail` | `/sync-jobs/:syncJobId([1-9][0-9]{0,9})` | shell | `active`, nav `syncJobs` | `syncJobs.detail.title` | `features/sync-jobs/pages/SyncJobDetailPage.vue` |

Rules:

- `syncJobId` above 2,147,483,647 renders `NotFoundState` with a link to the list, without a request.
- `sync-job-create` accepts `?mailbox=<address>` (≤ 255 characters) to preselect the target for
  administrators and domain administrators; it is ignored for mailbox users.
- `sync-jobs` and `sync-job-detail` accept `?log=<id>` (research R17). On the details page only the
  page's own `syncJobId` is accepted; another value is removed with `router.replace`.
- `sync-job-detail` accepts `?edit=<section>` with `source`, `schedule`, `folders`, `duplicates`,
  `limits` or `expert`, which opens that section's edit mode (`EditableSection`, research R11);
  another value, or `expert` with nothing editable, is removed with `router.replace`.
- UI 014 maps the classic `/edit/syncjob/{id}` to `sync-job-detail` (UI 014 row M30).
- The catalogue entry `syncJobs` (path `/sync-jobs`) becomes `available` when these routes are
  registered; its placeholder route disappears.

### Address parameters of the list (`list-state.ts`, `useListState` schema)

Defaults are omitted from the address. Invalid values fall back to the default and the address is
normalised with `router.replace`.

| Param | Type | Default | Roles | Maps to |
|---|---|---|---|---|
| `q` | string ≤ 255 | — | all | `q` |
| `mailbox` | string ≤ 255 | — | admin, domain admin | `mailbox` (exact, case-insensitive) |
| `domain` | string ≤ 255 | — | admin, domain admin | `domain` (exact, case-insensitive) |
| `active` | `yes`, `no` | — | all | `active=true/false` |
| `running` | `yes`, `no` | — | all | `running=true/false` |
| `result` | `succeeded`, `failed`, `none` | — | all | `lastResult=succeeded/failed/unknown` |
| `sort` | `id`, `mailbox` (not for mailbox users), `remoteHost`, `remoteUser`, `intervalMinutes`, `active`, `lastRunAt`, `lastResult` | `id` | all | `sort` |
| `order` | `asc`, `desc` | `desc` for `id`, `asc` otherwise | all | `order` |
| `page` | integer ≥ 1 | 1 | all | `offset = (page − 1) × size` |
| `size` | 25, 50, 100 | 25 | all | `limit` |
| `log` | integer 1–2147483647 | — | all | view parameter: opens the log viewer; never resets `page` or the selection |

Changing `q`, a filter, `sort`, `order` or `size` resets `page` and clears the selection.

## 6. Client-side validation

These checks run before submitting; server field errors are always shown too (FR-022). Every
limit comes from `getSyncJobsCapabilities()` (FR-055); the values in brackets are today's.

| Field | Rule | Message key |
|---|---|---|
| Target mailbox (admin, domain admin, create only) | required | `validation.required` |
| Host | required; ≤ `limits.remoteHostMaxLength` (255) after trimming | `validation.required`, `validation.tooLong` |
| Port | required; whole number in `limits.remotePort` (1–65535) | `validation.required`, `validation.outOfRange` |
| Encryption | one of `encryptions` | `validation.notInList` |
| Remote username | required; ≤ `limits.remoteUserMaxLength` (255) | `validation.required`, `validation.tooLong` |
| Remote password | create: required; edit: optional; ≤ `limits.remotePasswordMaxLength` (255) | `validation.required`, `validation.tooLong` |
| Interval | required; whole number in `limits.intervalMinutes` (1–43800) | `validation.outOfRange` |
| Subfolder | ≤ `limits.destinationSubfolderMaxLength` (255) | `validation.tooLong` |
| Exclusion pattern | ≤ `limits.excludeMaxLength` (500); may be empty | `validation.tooLong` |
| Maximum age | required; whole number in `limits.maxAgeDays` (0–32000) | `validation.outOfRange` |
| Maximum bytes per second | required; whole number in `limits.maxBytesPerSecond` (0–125000000) | `validation.outOfRange` |
| Timeouts | required; whole numbers in `limits.remoteTimeoutSeconds` and `limits.localTimeoutSeconds` (1–32000) | `validation.outOfRange` |
| Custom parameters | ≤ `limits.customParametersMaxLength` (512); may be empty | `validation.tooLong` |
| Bulk selection | ≤ `bulkLimit` (100), through `useBulkSelection`'s `limit` option | the shared bulk messages |
| Typed count (bulk delete) | equals the number of selected jobs | `ConfirmDialog` (UI 002) |

## 7. State machines

### Section edit (`EditableSection`, research R11)

```text
read ──Edit [push ?edit=<section>]──► editing ──Save (no change)──► read
                 │ ──Save──► saving ──200──► read (announce "Saved"; values from response; ?edit removed)
                 │             │ ──412──► outdated (input kept; job reloaded; changedSince() marks values)
                 │             │            ├─"Save again"──► saving (fields differing from the reloaded job, its version)
                 │             │            └─"Discard my changes"──► editing (reloaded values)
                 │             │ ──422/409──► editing (field errors / exists alert with link)
                 │             │ ──404──► gone ("no longer exists"; link to list)
                 └─Cancel or Back──► read (input and password discarded)
Leaving the page while a section holds changed input → the leave guard asks (useConfirm).
```

### Automatic refresh (`useRunningRefresh`, research R7)

```text
idle (no running job on the page) ──a listed job runs──► refreshing (every 30 s)
refreshing ──page hidden──► hidden ──visible──► refreshing (one refetch if data > 30 s old)
refreshing ──selection mode on──► suspended ──selection mode off──► refreshing
refreshing ──"Pause"──► paused ──"Resume"──► refreshing (refetch at once)
refreshing ──min(15 min, idle timeout) without interaction──► inactive (notice + Resume) ──Resume or manual Refresh──► refreshing
any ──no listed job runs──► idle
```

### Log viewer (`useLogViewer`, research R17)

```text
closed ──open(id) [router.push ?log=id]──► loading ──200──► shown(text | no log yet | no output) ──Refresh──► loading
                                            └──404──► gone (message) 
shown ──Close / Escape / Back──► closed (router.back() if pushed in-app, else replace; focus returns to the opener, or the page h1)
```

### Bulk action (`useSyncJobActions`, research R15)

```text
selecting ──action──► [deactivate: confirm listing the jobs; delete: confirm with typed count] ──► sending ──200──► summary (done/notFound deselected; refused/outdated/failed stay selected)
                                                                  │ ──403 permission-flag-required──► identity refresh → NoAccessState
                                                                  │ ──422 tooMany──► message with the limit
                                                                  └──network──► summary "outcome unknown" for all; selection cleared; list refetched
```

## 8. Mock scenarios (`tests/mocks/scenarios/sync-jobs.ts`)

| Name | Account | Content |
|---|---|---|
| `sync-jobs-admin` | admin | 60 jobs over the domains `example.org` and `example.net` and the mailboxes `alice@example.org`, `dora@example.org`, `erik@example.org`, `carol@example.net` and `frank@example.net` (plus a resource that must never appear in the picker): never run, running, running while inactive, succeeded, failed with each of the six known codes, failed with an unknown code and with `null`, inactive, rescheduled (`lastRunAt` null with a log); 255-character hosts, usernames, patterns and 512-character custom parameters; logs: normal, empty after a run, markup-like (`<script>alert(1)</script>`, `&amp;`), 120 columns wide |
| `sync-jobs-empty` | admin | no jobs; mailboxes exist |
| `sync-jobs-domain-admin` | domain admin with `syncjobs`, domain `example.org` | the admin scenario's jobs; only `example.org` jobs visible |
| `sync-jobs-domain-admin-no-mailboxes` | domain admin with `syncjobs`, a domain without mailboxes | no jobs, no mailboxes |
| `sync-jobs-domain-admin-no-flag` | domain admin without `syncjobs` | jobs exist but are refused |
| `sync-jobs-user` | mailbox user `alice@example.org` with `syncjobs` | two jobs of alice (#1 never run, #2 failed `EXIT_AUTHENTICATION_FAILURE_USER1` with a log), carol's job out of scope |
| `sync-jobs-user-no-flag` | mailbox user without `syncjobs` | — |
| `sync-jobs-user-restricted-params` | mailbox user with `syncjobs`; `customParameters.allowed: false`, `restrictedToAdministrators: true` | one job with stored custom parameters |
| `sync-jobs-running` | admin | 3 jobs, one running; used with `PATCH /__mock/scenarios/:id` to finish the run |
| `sync-jobs-bulk` | admin | 30 jobs; `failBulkItems` set for one id; `bulkLimit` 100; the outdated and not-found cases use the runtime changes below |
| `sync-jobs-big-log` | admin | one job whose log is 5 MB (about 80,000 lines) |

### Runtime changes (`PATCH /__mock/scenarios/:id`)

The scenario patch handling of UI 001 (T028 there) gains a `syncJobs` member. Account and session
changes use UI 001's existing members.

| Change | Body | Effect |
|---|---|---|
| Finish a run | `{ "syncJobs": { "finishRun": { "id": 2, "lastResult": "succeeded", "exitStatus": "EX_OK" } } }` | `running` false, `lastRunAt` now, result and exit status set, a log line appended; `etag` unchanged |
| Start a run | `{ "syncJobs": { "startRun": 2 } }` | `running` true |
| Change elsewhere | `{ "syncJobs": { "changeElsewhere": { "id": 5, "intervalMinutes": 45 } } }` | stored configuration changed, new `etag` (outdated tests) |
| Delete elsewhere | `{ "syncJobs": { "delete": 5 } }` | job removed (not-found tests) |
| Rename a target mailbox | `{ "syncJobs": { "renameMailbox": { "from": "dora@example.org", "to": "dora.new@example.org" } } }` | the mailbox and its jobs move to the new address |
| Change capabilities | `{ "syncJobs": { "capabilities": { "bulkLimit": 2 } } }` or `{ "syncJobs": { "capabilities": { "customParameters": { "allowed": false, "restrictedToAdministrators": true } } } }` | capabilities and validation follow |
| Fail a bulk item | `{ "syncJobs": { "failBulkItems": [7] } }` | those targets get `failed` with a `500` problem |
| Revoke the flag | UI 001's account patch with `permissions.syncjobs: false` | every sync-job operation answers `403 permission-flag-required` |
| Expire the session | UI 001's `{ "expireSession": true }` | the next request is `401 unauthenticated` |
