# Data Model: Monitoring and Operations

**Feature**: `specs/011-monitoring-operations` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

This app owns no persistent data. This document defines the API data the feature consumes (as
generated types), its app-defined view models, the query cache, the route map and address
parameters, the client-side validation and the state machines. Decisions are justified in
[research.md](./research.md). Contract shapes are never restated: types come from
`src/api/generated/schema.ts` through `@/api` (UI 001 R7).

## 1. API data consumed

Generated root types, imported from `@/api`.

| Type(s) | Operation(s) | Used by | Notes |
|---|---|---|---|
| `MonitoringCapabilities`, `MonitoringLogRetention` | `getMonitoringCapabilities` | every screen (`capabilities.ts`) | intervals, thresholds, limits, `clientAddress`, `ipCheckEnabled` (R4) |
| `HostOverview` | `getHostOverview` | host section, processor and memory, host clock | polled; `currentTime` drives the host clock (R6) |
| `MailStorageUsage` | `getMailStorageUsage` | mail storage section | polled at `maxAgeSeconds.mailStorage`; `measured: false` → "unavailable" |
| `InstallationVersion` | `getInstallationVersion` | version line | once per visit |
| `InstallationUpdateStatus` | `getUpdateStatus` | version line, release notes | once per visit; notes are untrusted Markdown (R9) |
| `PublicAddresses` | `getPublicAddresses` | "Show public IP" | on demand; `409 ip-check-disabled` |
| `Container`, `ContainerState`, `ContainerRole`, `ContainerAction` | `listContainers`, `getContainer` | container list and cards | list polled unfiltered (R8); `getContainer` after an unknown outcome |
| `ContainerResourceUsage` | `getContainerResourceUsage` | expanded card | polled while expanded; `409 container-not-running` |
| `ContainerActionResult` | `startContainer`, `stopContainer`, `restartContainer` | action runner | `container` replaces the list entry |
| `ContainerProblem` | container and queue problems | messages | `container`, `serviceMessage` |
| `SyslogLogEntry`, `NetfilterLogEntry`, `AutodiscoverLogEntry`, `WatchdogLogEntry`, `AcmeLogEntry`, `CronLogEntry`, `RateLimitLogEntry`, `LegacyApiRequestLogEntry`, `LegacyUiActivityLogEntry`, `LoginLogEntry`, `LogSeverity` | the 12 `list…Log` operations | log viewer | `id` is the cursor (R11) |
| `RspamdStatistics` | `getRspamdStatistics` | statistics, action bars | `actions` keys as Rspamd names them |
| `RspamdHistoryEntry`, `RspamdHistorySymbol` | `listRspamdHistory` | history list | symbols in API order |
| `MailQueueMessage`, `MailQueueRecipient`, `MailQueueName`, `MailQueueListMeta` | `listMailQueueMessages` | queue list, counts, select all matching, delete-all count | `meta.queueCounts`, `meta.truncated` |
| `MailQueueBulkRequest`, `MailQueueBulkTarget`, `BulkResult`, `BulkItemResult` | `bulkMailQueueMessages` | queue actions | targets carry `id` only |
| `MailQueueActionResult` | `flushMailQueue`, `purgeMailQueue` | flush, delete all | — |
| `MailQueueMessageContent` | `getMailQueueMessageContent` | content viewer | discarded on close (R15) |
| `MailQueueProblem` | queue failures | messages | `serviceMessage` |
| `Fail2BanSettings`, `Fail2BanSettingsPatch` | `getFail2BanSettings`, `updateFail2BanSettings`, `rotateFail2BanBanListId` | settings sections, permanent-ban removal, rotation | `etag` → `If-Match`, always sent |
| `Fail2BanRules`, `Fail2BanRule`, `Fail2BanRulesReplaceRequest` | `getFail2BanRules`, `replaceFail2BanRules`, `resetFail2BanRules` | rules editor | `etag` → `If-Match` |
| `Fail2BanActiveBan`, `Fail2BanBanActionResult` | `listFail2BanActiveBans`, `liftFail2BanBan`, `allowlistFail2BanBan`, `denylistFail2BanBan` | active bans | network percent-encoded in the path |
| `Fail2BanPermanentBan` | `listFail2BanPermanentBans` | permanent bans | — |
| — | `resetRateLimitBucket` (API 006) | "Reset rate limit" | through UI 006's `ResetBucketDialog` (R12) |
| `AuditEvent`, `AuditEventType`, `AuditTarget`, `AuditFailureReason` | `listAuditEvents` (UI 001's screen) | History | target filters (R18) |
| `ListMeta`, `Problem`, `ValidationProblem`, `FieldViolation`, `ValidationRuleCode`, `KnownProblemType` | lists and errors | everywhere | `KnownProblemType` constants are generated at the pin (R1) |

The two list parameter types used as query keys, for example
`NonNullable<operations['listMailQueueMessages']['parameters']['query']>`, are aliases of generated
types, never hand-written shapes (constitution I).

## 2. App-defined models

These are not API shapes; each is derived from API data or app constants.

### LogTypeDescriptor (`src/features/operations/logs/log-types.ts`)

| Field | Type | Rule |
|---|---|---|
| `slug` | `'postfix' \| 'dovecot' \| 'sogo' \| 'netfilter' \| 'autodiscover' \| 'watchdog' \| 'acme' \| 'cron' \| 'rate-limits' \| 'legacy-api-requests' \| 'legacy-ui-activity' \| 'logins'` | the contract path segment under `/logs`; the address `:logType` |
| `operationPath` | the generated path literal, for example `'/logs/postfix'` | typed against `paths` |
| `group` | `'inMemory' \| 'external' \| 'stored'` | FR-030 grouping (Rspamd is listed as external with its own route) |
| `retentionKey` | `keyof MonitoringCapabilities['logRetention']` | FR-040 |
| `hasSeverity` | boolean | true for postfix, dovecot, sogo, netfilter, cron (the operations that accept `severity`) |
| `filters` | the type's query filter names, exactly as the contract names them | FR-035: program (postfix, dovecot); service (autodiscover, watchdog, logins); user (autodiscover, rate-limits, legacy-ui-activity); task (cron); rateLimitName and sender (rate-limits); method and clientAddress (legacy-api-requests); type and role (legacy-ui-activity); username and clientAddress (logins) |
| `entryFields`, `detailFields` | ordered field descriptors | FR-031 table |
| `titleKey`, `descriptionKey` | i18n keys | FR-040 |

### LiveUpdateState (`live/useLiveUpdates.ts`)

`{ state: 'running' | 'hidden' | 'paused' | 'inactive' | 'unavailable'; since: number }` plus
`intervalMs(kind)` where `kind` is `'host' | 'containers' | 'resourceUsage' | 'mailStorage' |
'pendingLifts'`. Never stored.

### Freshness (`live/freshness.ts`)

| Field | Rule |
|---|---|
| `thresholdSeconds(kind)` | `maxAgeSeconds[kind] + 2 × intervalSeconds(kind)`; interval = `pollIntervalSeconds`, except mail storage = `maxAgeSeconds.mailStorage` |
| `ageSeconds(collectedAt)` | `(Date.now() + skewMs − Date.parse(collectedAt)) / 1000`, never negative |
| `outdated` | `ageSeconds > thresholdSeconds` |

`skewMs` comes from `useHostClock` (R6): `HostOverview.currentTime − receivedAt`, else the `Date`
header of the newest live response.

### LiveSeries (`live/useLiveSeries.ts`)

A ring buffer of at most **30** `{ t: string; values: (number | null)[] }` samples, appended only
when `t` (`collectedAt` or `sampledAt`) differs from the newest sample. Host series are dropped when
the dashboard unmounts; a container's series when its panel collapses.

### ContainerListView (`dashboard/container-list.ts`)

Derived from the unfiltered `Container[]` and the address: `{ items, summary: { running,
notRunning, total }, matches }`. Filter `state`: `running` → `running === true`, `notRunning` →
`running === false`. Search: case-insensitive substring over `name` and `image`. Sort: `name`,
`state` (enum value, ties by name) or `startedAt` (`null` last, ties by name), with `order`.

### ContainerActionRun (`dashboard/composables/useContainerAction.ts`)

`{ container: string; action: ContainerAction; startedAt: number; status: 'confirming' | 'sending'
| 'done' | 'alreadyInState' | 'refused' | 'failed' | 'outcomeUnknown' | 'readingState'; problem?:
ApiProblem; auditRecorded: boolean }`. See §7.

### QueueSelection (`mail-queue/useQueueSelection.ts`)

`{ mode: 'page' | 'matching'; ids: string[]; matchingTotal?: number; capped: boolean }`. `page`
uses UI 002's `useBulkSelection` with `maxItems = limits.mailQueueBulkMaxIds`; `matching` holds the
first `min(total, limits.mailQueueBulkMaxIds)` IDs in the current sort. Cleared on any change of the
list state and after a completed action.

### ContentView (`mail-queue/content.ts`)

`{ id: string; firstView: string; rest: number; complete: string }` where `firstView` is the first
**262,144** UTF-16 code units (not splitting a surrogate pair) and `rest` the remaining length.
Lives only in the viewer component.

### DurationValue (`fail2ban/duration.ts`)

`{ value: number; unit: 'seconds' | 'minutes' | 'hours' | 'days' }`. `fromSeconds(s)` picks the
largest unit that divides `s` exactly (1,800 → 30 minutes; 10,000 → 10,000 seconds);
`toSeconds()` multiplies back (2 hours → 7,200).

### EntryListModel (`fail2ban/list-entries.ts`)

From a textarea: `{ entries: string[]; lineOf: number[]; duplicates: number[] }` — entries trimmed,
empty lines dropped, duplicates kept once (case-insensitive for host names), `lineOf[i]` the
1-based line of entry `i`, so that `denylist.<i>` errors map to their line.

### ReleaseNotesView (`dashboard/release-notes/render-release-notes.ts`)

`renderReleaseNotes(markdown: string, t): Promise<string>`: the sanitised HTML string passed to
`SanitizedHtml` with `profile="releaseNotes"`.

## 3. Server-state cache

### Query keys (added to `src/api/query/keys.ts`)

| Key | Operation | staleTime | Fetched when | Notes |
|---|---|---|---|---|
| `['monitoring','capabilities']` | `getMonitoringCapabilities` | 5 min | any screen of this feature opens | refetched after `409 ip-check-disabled` |
| `['monitoring','live','host']` | `getHostOverview` | 0 | dashboard; then every `pollIntervalSeconds` while running | `retry: false`; skew source |
| `['monitoring','live','containers']` | `listContainers` (`limit = LIST_LIMIT_MAX`, the `Limit` maximum, `sort=name`) | 0 | dashboard, ban screen (for `banService`); polled on the dashboard | filtered in the browser |
| `['monitoring','live','resource-usage',name]` | `getContainerResourceUsage` | 0 | card expanded and container running; polled | stops on `409` |
| `['monitoring','live','mail-storage']` | `getMailStorageUsage` | 0 | dashboard; every `maxAgeSeconds.mailStorage` | — |
| `['monitoring','installation']` | `getInstallationVersion` | ∞ | each dashboard visit (`refetchOnMount: 'always'`) | — |
| `['monitoring','update-status']` | `getUpdateStatus` | ∞ | each dashboard visit (`refetchOnMount: 'always'`) | — |
| `['monitoring','public-addresses']` | `getPublicAddresses` | ∞ | on "Show public IP" only (`enabled: false` + `refetch`) | removed when the dashboard unmounts |
| `['containers','detail',name]` | `getContainer` | 0 | after an unknown outcome or a failed action | written into the list entry |
| `['logs',slug,params]` | the type's `list…Log` | ∞ | log opened; "Load older/newer"; "Refresh" resets | infinite query, 50 per page (R11) |
| `['rspamd','statistics']` | `getRspamdStatistics` | ∞ | Rspamd view opened; refresh | — |
| `['rspamd','history',params]` | `listRspamdHistory` | 30 s | Rspamd view | params from the address |
| `['mail-queue','list',params]` | `listMailQueueMessages` | 30 s | queue opened; after every action | params from the address |
| `['mail-queue','ids',params]` | `listMailQueueMessages` (`limit` up to the bulk limit) | 0 | "Select all matching" | IDs only are kept |
| `['mail-queue','counts']` | `listMailQueueMessages?limit=1` | 0 | "Delete all" dialog opens | `queueCounts.total` |
| `['mail-queue','content',queueId]` | `getMailQueueMessageContent` | 0, `gcTime` 0 | viewer opens | removed on close |
| `['fail2ban','settings']` | `getFail2BanSettings` | 30 s | ban screen | `etag` |
| `['fail2ban','rules']` | `getFail2BanRules` | 30 s | ban screen | `etag` |
| `['fail2ban','active-bans',params]` | `listFail2BanActiveBans` | 30 s | ban screen; pending-lift refresh | params from the `b…` address keys |
| `['fail2ban','permanent-bans',params]` | `listFail2BanPermanentBans` | 30 s | ban screen | params from the `p…` address keys |

### Invalidation after mutations

| Mutation | On success | On problem |
|---|---|---|
| `startContainer`, `stopContainer`, `restartContainer` | replace the entry in `['monitoring','live','containers']` with `data.container`; announce; status message | `504`/network: fetch `['containers','detail',name]` and write it into the list; `404`: invalidate the list; `502`: fetch the detail |
| `bulkMailQueueMessages` | invalidate `['mail-queue','list']`; clear the selection; show the result summary | `504`: invalidate the list, say "outcome unknown"; `409`: show "Postfix not running" |
| `flushMailQueue`, `purgeMailQueue` | invalidate `['mail-queue']` | as above |
| `updateFail2BanSettings` | write `['fail2ban','settings']`; invalidate `['fail2ban','permanent-bans']` when the denylist changed | `412`: refetch settings, mark changed values (UI 002); `422`: field and line errors |
| `rotateFail2BanBanListId` | write `['fail2ban','settings']` | `412`: refetch, confirm again |
| `replaceFail2BanRules`, `resetFail2BanRules` | write `['fail2ban','rules']` | `412`: refetch, keep input; `504 ban-rules-not-restored`: offer reload; `504 outcome-unknown`: refetch |
| `liftFail2BanBan`, `allowlistFail2BanBan`, `denylistFail2BanBan` | replace the ban in `['fail2ban','active-bans',…]` with `data.ban`; invalidate `['fail2ban','settings']` and, for denylisting, `['fail2ban','permanent-bans']`; start the pending-lift refresh | `404`: invalidate active bans, say the ban ended |
| `resetRateLimitBucket` (UI 006's `ResetBucketDialog`) | `resetQueries(['logs','rate-limits'])` | `404`: the dialog says there was nothing to reset; same refresh |

## 4. Client state

No Pinia store and no device storage are added. View state (expanded cards, pause state, wrap
toggle, chart/table switch, selection) lives in component state; list and filter state lives in the
address (conventions "Lists"). UI 001's storage allowlist (data-model §4 there) is unchanged, and
its unit test keeps guarding it.

## 5. Routes, address parameters and catalogue

### Catalogue rows (`src/app/navigation/catalogue.ts`)

UI 001's row `operations` is replaced by these four rows, in this order, with the new optional field
`group: 'system'` (labelled by `nav.groups.system`):

| id | path | admin | domainAdmin | mailboxUser | by | status after 011 |
|---|---|---|---|---|---|---|
| `dashboard` | `/operations/dashboard` | ✓ | — | — | 011 | available |
| `logs` | `/operations/logs` | ✓ | — | — | 011 | available |
| `mailQueue` | `/operations/mail-queue` | ✓ | — | — | 011 | available |
| `fail2ban` | `/operations/fail2ban` | ✓ | — | — | 011 | available |

Each row starts as `placeholder`, with the classic addresses `/admin/dashboard` (dashboard, logs),
`/admin/queue` (mail queue) or `/admin/system` (Fail2ban), and the story that registers its routes
sets it to `available`: `dashboard` in US1, `logs` in US3,
`mailQueue` in US4, `fail2ban` in US5. No entry ever leads to "not found" (UI 001 SC-007).

### Route map (base `/ng/`, all shell layout, `active` session, admin only via the catalogue)

| Name | Path | navEntry | Title key | Component (lazy) |
|---|---|---|---|---|
| `operations` | `/operations` | `dashboard` | — | redirect to `operations-dashboard` |
| `operations-dashboard` | `/operations/dashboard` | `dashboard` | `operations.dashboard.title` | `features/operations/dashboard/pages/DashboardPage.vue` |
| `operations-container` | `/operations/containers/:containerName([a-z0-9][a-z0-9_.-]{0,62})` | `dashboard` | `operations.dashboard.title` | same page, `props: { expand: containerName }` |
| `operations-logs` | `/operations/logs` | `logs` | `operations.logs.title` | `features/operations/logs/pages/LogIndexPage.vue` |
| `operations-rspamd` | `/operations/logs/rspamd` | `logs` | `operations.rspamd.title` | `features/operations/rspamd/pages/RspamdPage.vue` |
| `operations-log` | `/operations/logs/:logType` | `logs` | `operations.logs.types.<slug>` | `features/operations/logs/pages/LogPage.vue` (unknown slug → not found with a link to the index) |
| `operations-mail-queue` | `/operations/mail-queue` | `mailQueue` | `operations.queue.title` | `features/operations/mail-queue/pages/MailQueuePage.vue` |
| `operations-mail-queue-message` | `/operations/mail-queue/messages/:queueId([0-9A-Fa-f]{1,32})` | `mailQueue` | `operations.queue.content.title` | same page with the viewer |
| `operations-fail2ban` | `/operations/fail2ban` | `fail2ban` | `operations.fail2ban.title` | `features/operations/fail2ban/pages/Fail2banPage.vue` |
| `operations-fail2ban-section` | `/operations/fail2ban/:section(bans\|settings\|rules)` | `fail2ban` | `operations.fail2ban.title` | same page, focusing the section heading |

UI 014 maps `/admin/dashboard` and `/debug` to `/operations/dashboard`, and `/admin/queue` and
`/queue` to `/operations/mail-queue`.

### Address parameters (`useListState` schemas; defaults omitted, invalid values normalised)

**Dashboard** (`/operations/dashboard`, FR-009):

| Param | Values | Default |
|---|---|---|
| `state` | `running`, `notRunning` | — (all) |
| `q` | string ≤ 255 | — |
| `sort` | `name`, `state`, `startedAt` | `name` |
| `order` | `asc`, `desc` | `asc` |

**Log** (`/operations/logs/:logType`, FR-035 to FR-037; no paging):

| Param | Values | Maps to |
|---|---|---|
| `q` | string ≤ 255 | `q` |
| `range` | `1h`, `24h`, `7d`, `custom` | `from = now − range` when the query runs |
| `from`, `to` | RFC 3339 (with `range=custom`, `from ≤ to`) | `from`, `to` |
| `severity` | repeatable `error`, `warning`, `info` (types with severity) | `severity` |
| type filters | one value each, ≤ 255: `program`, `service`, `user`, `task`, `rateLimitName`, `sender`, `method`, `clientAddress`, `type`, `role`, `username` (only those of the type) | the same names, one array item |
| `order` | `desc`, `asc` | `order` (default `desc`) |

**Rspamd history** (`/operations/logs/rspamd`, FR-047):

| Param | Values | Default |
|---|---|---|
| `q` | string ≤ 255 | — |
| `action` | repeatable action names from the statistics (≤ 20) | — |
| `range`, `from`, `to` | as for logs | — |
| `minScore`, `maxScore` | numbers, `minScore ≤ maxScore` | — |
| `sort` | `time`, `score`, `size`, `scanTime` | `time` |
| `order` | `asc`, `desc` | `desc` |
| `page`, `size` | ≥ 1; 25, 50, 100 | 1, 25 |

**Mail queue** (`/operations/mail-queue`, FR-050):

| Param | Values | Default |
|---|---|---|
| `q` | string ≤ 255 | — |
| `queue` | repeatable `active`, `deferred`, `hold`, `incoming`, `maildrop` | — |
| `sender`, `recipient` | string ≤ 255 | — |
| `range`, `from`, `to` | as for logs (arrival time) | — |
| `sort` | `arrivalTime`, `size`, `sender`, `queue`, `id` | `arrivalTime` |
| `order` | `asc`, `desc` | `asc` |
| `page`, `size` | ≥ 1; 25, 50, 100 | 1, 25 |

**Ban service** (`/operations/fail2ban…`, FR-064, FR-066; two lists, prefixed keys):

| Param | Values | Default |
|---|---|---|
| `bq` | string ≤ 255 (network search) | — |
| `bpending` | `true`, `false` | — |
| `bsort`, `border` | `endsAt`, `network`; `asc`, `desc` | `endsAt`, `asc` |
| `bpage`, `bsize` | ≥ 1; 25, 50, 100 | 1, 25 |
| `pq` | string ≤ 255 | — |
| `psort`, `porder` | `startedAt`, `network`; `asc`, `desc` | `startedAt`, `desc` |
| `ppage`, `psize` | ≥ 1; 25, 50, 100 | 1, 25 |
| `edit` | `parameters`, `lists`, `external`, `rules` (the open `EditableSection`, UI 002) | — |

`useListState` is used with a key prefix for the two ban lists; if UI 001's composable has no
prefix option, the foundational phase adds one (see tasks.md).

## 6. Client-side validation

Checks run before sending; server field errors are always shown too (FR-076, FR-077).

| Field | Rule | Source | Message key |
|---|---|---|---|
| Ban time, maximum ban time | whole number; 60 to 2,147,483,647 seconds after unit conversion | `Fail2BanSettingsPatch` description (R4) | `validation.outOfRange` |
| Maximum ban time | not less than the ban time | same | `validation.outOfRange` with `minField` |
| Max. attempts, retry window | 1 to 2,147,483,647 (retry window in seconds) | same | `validation.outOfRange` |
| IPv4 / IPv6 prefix length | 8 to 32 / 8 to 128 | same | `validation.outOfRange` |
| Allowlist entry | an IPv4/IPv6 address, a prefix network (`isIpNetwork`, UI 001) or a host name (RFC 1123 labels, ≤ 253) | same | `validation.format.ipNetworkOrHostname` |
| Denylist entry | an address or prefix network; not `0.0.0.0`, `0.0.0.0/0`, `::/0` | same | `validation.format.ipNetwork`, `validation.reserved` |
| Both lists | an entry on both is refused (on the denylist entry) | same | `validation.conflictsWith` |
| List size | ≤ `limits.fail2banListMaxEntries` entries; entries ≤ 253 characters | capabilities; schema `maxLength` | `validation.tooMany`, `validation.tooLong` |
| Own address | warning (not an error) when a new denylist entry covers `clientAddress` | capabilities | `operations.fail2ban.ownAddressWarning` |
| Rules | 1 to `limits.fail2banRulesMax` rules; each 1 to `limits.fail2banRuleMaxLength` characters | capabilities | `validation.required`, `validation.tooMany`, `validation.tooShort`, `validation.tooLong` |
| Searches and text filters | ≤ 255 characters | `Search` schema `maxLength` | `validation.tooLong` |
| Time range | `from ≤ to` | contract (inclusive range) | `operations.filters.rangeOrder` |
| Score range | numbers; `minScore ≤ maxScore` | — | `operations.rspamd.filters.scoreOrder` |
| Bucket ID for reset | `rateLimitHash` matches `^RL[0-9A-Za-z=]+$`, ≤ 128 (UI 006's pattern in `src/shared/validation/limits.ts`) | `RateLimitBucketId` parameter | action not offered otherwise |

## 7. State machines

### Live updates (`live/useLiveUpdates.ts`)

```text
             capabilities loaded
 unavailable ───────────────────► running ◄──────────── Resume (refetch at once) ─────┐
                                   │  │  │                                           │
         document hidden ──────────┘  │  └──── no interaction for the limit ──► inactive
         (visible → refetch at once)  │                                             │
                                      └──── "Pause live updates" ───────► paused ───┘
 hidden ──visible──► running (refetch at once)
 any state ──page unmounted──► stopped (observers and timers removed)
```

The limit is `min(15 min, Session.idleTimeout)` (R5). Only `running` sets a `refetchInterval`.

### Container action (`dashboard/composables/useContainerAction.ts`)

```text
idle ─Start─────────────────────────────► sending ──200 done/alreadyInState──► done (announce) ─► idle
idle ─Stop/Restart─► confirming ─confirm─► sending ──409/502/404/503──────────► refused/failed ─► idle
                         └─cancel/Esc─► idle (focus back)  └─504 / network──► outcomeUnknown ─► readingState
                                                                              (GET /containers/{name}) ─► idle
```

While `sending` or `readingState`, no other action on that container; the elapsed time is shown.
No automatic repeat in any state.

### Queue action (`mail-queue/pages/MailQueuePage.vue`)

```text
selection ─Deliver/Hold/Release─────────────► sending ─200─► result summary ─► list refreshed, selection cleared
selection ─Delete─► confirm(typed count) ───► sending ─409─► Postfix not running
Flush ─────────────────────────────────────► sending ─502─► failed (technical detail)
Delete all ─► dialog (count read) ─type count + tick─► Delete ─► sending ─504/network─► outcome unknown ─► list refreshed
```

### Content viewer (`mail-queue/components/MessageContentViewer.vue`)

```text
route opened ─► loading ─200─► first view (256 Ki chars) ─"Show the rest"─► complete
                 └─404─► "no longer in the queue" (removed from the cached list)
close (route back) ─► content removed from the cache
```

### Pending lifts (`fail2ban/usePendingLifts.ts`)

```text
lift/allowlist done ─► refreshing every pollIntervalSeconds (visible and running only)
     └─ stops when no listed ban is queued for lifting, or 60 s after the last lift
```

### Rules reset (`fail2ban/components/RulesSection.vue`)

```text
"Reset to default" ─► confirm ─► sending ─200─► defaults shown
                                   ├─504 ban-rules-not-restored─► explanation + "Reload" (no second reset)
                                   ├─504 outcome-unknown─► rules reloaded
                                   └─412─► reloaded; confirm again
```
