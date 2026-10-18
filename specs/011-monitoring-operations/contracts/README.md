# Contracts of UI feature 011

This app exposes no API of its own. Its only interface is the mailcow-rest-v2 contract it consumes
(constitution I). The contract is not duplicated here. This file records the pinned version, the
operations this feature uses, and how the app reacts to each problem type. Vendoring, generation and
checks work as UI 001 defines them ([001 contracts/README.md](../../001-sign-in-app-shell/contracts/README.md)).

## Pinned contract

| Field | Value |
|---|---|
| API repository | `FELDSAM-INC/mailcow-rest-v2` |
| API features relied on | 011 Monitoring and operations; 006 (rate-limit bucket reset only); 002 (audit target filters); 001 (identity, errors, audit log) |
| Contract version (`info.version`) | `0.1.0` (does not identify a contract, UI 001 R6) |
| Pinned commit (authoritative) | `32079252d55797d3da4e58ae661e9fb91c51c6f9` (2026-10-18, "Register KnownProblemType in contract components"), the newest commit that changed `api/` when this plan was written |
| Bundle | `@redocly/cli@2.64.1 bundle api/openapi.yaml` |
| Bundle sha256 at this commit | `5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6` |
| Operations in the bundle | 376 |
| Operations used by this feature | 44 (42 of API 011, `resetRateLimitBucket` of API 006 through UI 006, `listAuditEvents` through UI 001's audit log screen) |

Task T002 runs `scripts/contract/bump.sh 32079252d55797d3da4e58ae661e9fb91c51c6f9`, unless the
repository already pins a later commit whose `api/` contains these 44 operations unchanged (an
earlier UI feature may have bumped the pin). It records the result in `contract/VERSION.json`. At
this commit `KnownProblemType` is listed under `components.schemas`, so `knownProblemTypeValues` is
generated (UI 001 plan gap 5 is closed).

## Operations used by this feature

| operationId | Method and path | Used by | Requirements |
|---|---|---|---|
| `getMonitoringCapabilities` | GET `/capabilities/monitoring` | every screen: intervals, thresholds, limits, IP check, client address, log retention | FR-018, FR-022, FR-029, FR-040, FR-052, FR-055, FR-064, FR-069, FR-071 |
| `getHostOverview` | GET `/host` | host section, processor and memory, host clock (polled) | FR-004, FR-005, FR-022 |
| `getMailStorageUsage` | GET `/host/mail-storage` | mail storage section (polled) | FR-006, FR-007 |
| `getPublicAddresses` | GET `/host/public-addresses` | "Show public IP" | FR-029 |
| `getInstallationVersion` | GET `/installation` | version line | FR-026 |
| `getUpdateStatus` | GET `/installation/update-status` | update status, release notes | FR-027, FR-028 |
| `listContainers` | GET `/containers` | container list (polled), summary, ban service container | FR-008, FR-009, FR-017 |
| `getContainer` | GET `/containers/{containerName}` | state after an unknown or failed action | FR-015, FR-016 |
| `getContainerResourceUsage` | GET `/containers/{containerName}/resource-usage` | expanded card (polled) | FR-010 |
| `startContainer` | POST `/containers/{containerName}/start` | Start | FR-011, FR-013–FR-016 |
| `stopContainer` | POST `/containers/{containerName}/stop` | Stop (confirmed) | FR-011–FR-016 |
| `restartContainer` | POST `/containers/{containerName}/restart` | Restart (confirmed), Restart netfilter | FR-011–FR-017 |
| `listPostfixLog` | GET `/logs/postfix` | log viewer | FR-030–FR-044 |
| `listDovecotLog` | GET `/logs/dovecot` | log viewer | same |
| `listSogoLog` | GET `/logs/sogo` | log viewer | same |
| `listNetfilterLog` | GET `/logs/netfilter` | log viewer | same |
| `listAutodiscoverLog` | GET `/logs/autodiscover` | log viewer | same |
| `listWatchdogLog` | GET `/logs/watchdog` | log viewer | same |
| `listAcmeLog` | GET `/logs/acme` | log viewer | same |
| `listCronLog` | GET `/logs/cron` | log viewer | same |
| `listRateLimitLog` | GET `/logs/rate-limits` | log viewer, rate limit actions | same, FR-039 |
| `listLegacyApiRequestLog` | GET `/logs/legacy-api-requests` | log viewer | same |
| `listLegacyUiActivityLog` | GET `/logs/legacy-ui-activity` | log viewer | same |
| `listLoginLog` | GET `/logs/logins` | log viewer | same, FR-044 |
| `getRspamdStatistics` | GET `/rspamd/statistics` | statistics, action bars, action filter options | FR-045, FR-046 |
| `listRspamdHistory` | GET `/rspamd/history` | scan history | FR-047, FR-048 |
| `listMailQueueMessages` | GET `/mail-queue/messages` | queue list, counts, "select all matching", "Delete all" count | FR-050–FR-055, FR-058 |
| `bulkMailQueueMessages` | POST `/mail-queue/messages/bulk-actions` | deliver now, hold, release, delete | FR-054–FR-057, FR-059, FR-061 |
| `getMailQueueMessageContent` | GET `/mail-queue/messages/{queueId}/content` | content viewer (each view audited) | FR-061 |
| `flushMailQueue` | POST `/mail-queue/flush` | Flush | FR-058 |
| `purgeMailQueue` | POST `/mail-queue/purge` | Delete all (acknowledged) | FR-058 |
| `getFail2BanSettings` | GET `/fail2ban/settings` | parameters, lists, external enforcement, ban list address | FR-067–FR-070 |
| `updateFail2BanSettings` | PATCH `/fail2ban/settings` | section saves, permanent-ban removal | FR-066–FR-069, FR-072 |
| `rotateFail2BanBanListId` | POST `/fail2ban/ban-list-rotation` | new ban list address (confirmed) | FR-070, FR-072 |
| `getFail2BanRules` | GET `/fail2ban/rules` | rules list | FR-071 |
| `replaceFail2BanRules` | PUT `/fail2ban/rules` | rules editor save | FR-071, FR-072 |
| `resetFail2BanRules` | POST `/fail2ban/rules/reset` | reset to defaults (confirmed) | FR-071, FR-072 |
| `listFail2BanActiveBans` | GET `/fail2ban/active-bans` | active bans, pending-lift refresh | FR-064, FR-065 |
| `liftFail2BanBan` | POST `/fail2ban/active-bans/{network}/lift` | Lift ban | FR-064, FR-065 |
| `allowlistFail2BanBan` | POST `/fail2ban/active-bans/{network}/allowlist` | Lift and allowlist | FR-064, FR-065 |
| `denylistFail2BanBan` | POST `/fail2ban/active-bans/{network}/denylist` | Denylist (confirmed) | FR-064, FR-065 |
| `listFail2BanPermanentBans` | GET `/fail2ban/permanent-bans` | permanent bans | FR-066 |
| `resetRateLimitBucket` | DELETE `/rate-limit-buckets/{bucketId}` | "Reset rate limit", through UI 006's mutation | FR-039 |
| `listAuditEvents` | GET `/audit-events` (`targetType`, `targetId`) | History, through UI 001's audit log screen; `details` shown as stored (plan API gap 8) | FR-075 |

Every operation of API 011 is used. `If-Match` is optional in the contract for the ban settings,
rules, rule reset and rotation; this feature always sends it (FR-072). The network path parameter is
percent-encoded (`203.0.113.0%2F24`) as `Fail2BanNetwork` documents; `openapi-fetch` encodes path
parameters, and a unit test asserts the encoded form.

## Problem types and the app's response

Messages come from `problem.<name>` and `validation.<code>`, never from `title` or `detail`
(UI 001 R15). Messages that the container service or Postfix return are shown verbatim as technical
detail.

| `type` (`/api/v2/problems/…`) | Status | Operations | App behaviour |
|---|---|---|---|
| `container-protected` | 409 | stop, restart | "This container is protected"; actions re-read from the container (FR-016) |
| `container-not-running` | 409 | resource usage | stop polling that container; "No resource data while it is not running" (FR-010) |
| `container-action-failed` | 502 | start, stop, restart, rules reset | translated failure, `serviceMessage` as technical detail; container read again (FR-016) |
| `mail-service-not-running` | 409 | every queue operation | "The queue cannot be read because <container> is not running" with a link to its card (FR-060) |
| `queue-action-failed` | 502 | queue list, content, actions | translated failure, `serviceMessage` as technical detail; list refreshed (FR-059) |
| `outcome-unknown` | 504 | container actions, queue actions, flush, delete all, rules reset | "Outcome unknown" naming the action the app sent (the prose-only `step` extension is not read); state re-read; never repeated (FR-015, FR-059) |
| `ban-rules-not-restored` | 504 | rules reset | "Defaults appear with the next log line"; "Reload", no second reset (edge case) |
| `ip-check-disabled` | 409 | public addresses | IP check explanation; capabilities refreshed (FR-029) |
| `temporary-failure` | 503 | every operation | "Temporarily unavailable; nothing was changed", retry with the input kept, `Retry-After` shown (edge case) |
| `validation-failed` | 422 | settings, rules, denylisting, queue actions, list filters | field errors; list entries by line, rules by number (FR-069, FR-071, FR-077) |
| `forbidden`, `insufficient-key-scope` | 403 | every operation | UI 001: translated reason, identity refreshed (FR-003) |
| `permission-flag-required` | 403 | rate limit reset (other roles only) | not reachable for administrators; generic message |
| `about:blank` 404 | 404 | container, content, ban actions, rate limit reset | "no longer exists", "no longer in the queue", "ban already ended", "already reset", each with a refresh |
| `about:blank` 412 | 412 | settings, rules, reset, rotation | keep input, reload, mark changed values, save again (FR-072) |
| any other | — | — | generic message with the request ID (UI 001) |

Any response carrying `Audit-Recorded: false` adds the warning "This was carried out, but no audit
record could be written" (FR-016, research R17). The shared `BulkResultResponse` does not declare
this header for queue bulk actions; the operation's description does (plan API gap 5), and the mock
validator accepts undeclared optional headers.

## Enumerations displayed

`ContainerState`, `ContainerRole` (unknown values shown as "Other", as the contract requires),
`ContainerAction`, `LogSeverity`, `MailQueueName`, `MonitoringLogRetention.policy`,
`InstallationUpdateStatus.status`, `ContainerActionResult.outcome`, `BulkItemOutcome`, and the 011
values of `AuditEventType`, `AuditTarget.type` and `AuditFailureReason`. Each has translations in
the three locales; `npm run i18n:check` enforces the named enumerations (research R19).
