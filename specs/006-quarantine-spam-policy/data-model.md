# Data Model: Quarantine, Spam Policy and Rate Limits

**Feature**: `specs/006-quarantine-spam-policy` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

The app owns no persistent data. This document defines the following for UI feature 006:

- the API data it consumes, as generated types;
- the app-defined view models;
- the server-state cache: query keys, freshness and invalidation;
- the client state, which is memory only: no new store and no storage key;
- the route map and the address parameters;
- the client-side validation rules;
- the state machines of item actions, bulk runs, downloads and list removals.

Contract shapes are not restated. Types come from `src/api/generated/schema.ts` through `@/api`
(001-R7). Decisions are justified in [research.md](./research.md) (R*n*) and in UI 001's research
(001-R*n*).

## 1. API data consumed

These are generated root types, imported from `@/api`.

| Type | Operation(s) | Used by | Notes |
|---|---|---|---|
| `QuarantineCapabilities` | `getQuarantineCapabilities` | every form and list of this feature | R8. Never hard-code a limit it carries |
| `QuarantineItem`, `QuarantineItemAction` | `listQuarantineItems` | quarantine list | `etag` per entry, sent as the bulk `version` and in `If-Match` |
| `QuarantineItemDetails`, `QuarantineSymbol`, `QuarantineRecipient`, `QuarantineMessageContent`, `QuarantineAttachment` | `getQuarantineItem` | item page | `content` is `null` unless `contentStatus` is `available`; `attachments` is `null` for callers without the right to download; `authenticatedSender` is present for administrators only |
| `QuarantineReleaseRequest`, `QuarantineActionReport` | `releaseQuarantineItem`, `learnQuarantineItemAsSpam` | item actions | R14 |
| — (`204`) | `deleteQuarantineItem` | item action "Remove" | — |
| `QuarantineBulkActionRequest`, `BulkTarget`, `QuarantineBulkResult`, `QuarantineBulkItemResult`, `BulkItemOutcome` | `applyQuarantineBulkAction` | bulk actions | R15 |
| binary (`message/rfc822`, `application/octet-stream`) | `downloadQuarantineMessage`, `downloadQuarantineAttachment` | downloads | R10. `Content-Disposition` gives the file name |
| `QuarantineSettings`, `QuarantineSettingsPatch`, `QuarantineReleaseFormat` | `getQuarantineSettings`, `updateQuarantineSettings` | status notice (public subset), settings page (`visibility: full`) | merge patch, `If-Match`; `validateOnly` is not used (R3) |
| `QuarantineNotificationSettings`, `QuarantineNotificationSettingsPatch`, `QuarantineNotificationFrequency`, `QuarantineNotificationCategory` | `getMailboxQuarantineNotificationSettings`, `updateMailboxQuarantineNotificationSettings` | notification panel | `category` may be `null` ("Not set") |
| `QuarantineNotificationBulkRequest`, `BulkResult` | `applyQuarantineNotificationBulkAction` | mailbox list bulk actions | targets without `version` (R16) |
| `SpamScore`, `SpamScoreUpdate` | `getMailboxSpamScore`, `setMailboxSpamScore`, `resetMailboxSpamScore` | spam score panel | R17 |
| `SpamPolicyEntry`, `SpamPolicyOwner`, `SpamPolicyList`, `SpamPolicyEntryCreateRequest` | `list…SpamPolicyEntries`, `create…SpamPolicyEntry`, `delete…SpamPolicyEntry` (domain, alias domain and mailbox variants) | lists panel | `own` tells own from inherited; `etag` per entry |
| `RateLimit`, `RateLimitValue`, `RateLimitUpdate`, `RateLimitObjectKind` | `get…RateLimit`, `set…RateLimit`, `remove…RateLimit` (3 kinds), `listRateLimits` | rate limit panel, overview | `invalidStoredValue`, `effectiveLimit`, `effectiveSource` |
| — (`204`) | `resetRateLimitBucket` | bucket reset | `404` means nothing to reset |
| `SpamFilterActionStatistics` | `getSpamFilterActionStatistics` | statistics page | `countedSince` and `spamFilterRunningSince` may be `null` |
| `AuditEvent`, `AuditTarget`, `AuditEventType` | `listAuditEvents` | audit log (UI 001/002 screen) | 12 event types and 7 target types added (R23) |
| `Identity`, `PermissionFlags`, `Scope` | `getIdentity` | permissions, domain filter for domain administrators | R7 |
| `Domain`, `AliasDomain`, `Mailbox` | `listDomains`, `listAliasDomains`, `listMailboxes`, `getMailbox` | pickers; the recipient link check | read only; their query keys belong to UI 002–004 |
| `SpamFilterPermissionFlagProblem`, `QuarantineNotificationAttributeNotPermittedProblem`, `SpamFilterTemporaryFailureProblem`, `QuarantineDeliveryRefusedProblem`, `QuarantineMessageTooLargeProblem`, `SpamPolicyEntryExistsProblem`, `ValidationProblem` | error responses | `ApiProblem` (001-R8), `src/i18n/problems.ts` | R24 |

The extension members of these problems are read through type guards over the generated problem
types in `src/api/problem.ts`. They are not restated by hand.

## 2. App-defined models

None of these is an API shape. Each one is derived from API data or app constants.

### Abilities (`src/features/quarantine/permissions.ts`, R7)

These are pure functions of `Identity`, with `MailboxRef = string` (an address) and
`OwnerKind = SpamPolicyOwner['kind']`.

| Function | Admin | Domain admin | Mailbox user |
|---|---|---|---|
| `canActOnItems(id)` | true | `permissions.quarantine` | `permissions.quarantine` |
| `canSeeAttachments(id)` | true | true | `permissions.quarantineAttachments` |
| `canDownloadMessage(id)` | true | `permissions.quarantine` | `quarantine && quarantineAttachments` |
| `canChangeFrequency(id, mailbox)` | true | true | own mailbox and `quarantineNotification` |
| `canChangeCategory(id, mailbox)` | true | true | own mailbox and `quarantineCategory` |
| `canChangeSpamScore(id, mailbox)` | true | true | own mailbox and `spamScore` |
| `canReadPolicy(id, kind)` | true | true | `kind === 'mailbox'` (own only) |
| `canChangePolicy(id, kind)` | true | `spamPolicy` | `kind === 'mailbox'` and `spamPolicy` |
| `canReadRateLimits(id)` | true | true | false |
| `canChangeRateLimits(id)` | true | `ratelimit` | false |
| `canResetBucket(id)`, `canSeeSettings(id)`, `canSeeStatistics(id)`, `canSeeHistory(id)` | true | false | false |
| `missingFlag(id, ability)` | — | the flag | the flag (for the "Prohibited by ACL" note) |

The API stays the authority: scope is enforced by `404` and flags by `403`.

### PlainText segments (`src/shared/security/plain-text.ts`, R9)

```ts
type PlainTextSegment = { kind: 'text'; value: string } | { kind: 'marker'; codePoint: string } // "U+202E"
neutralise(value: string, options: { multiline: boolean }): PlainTextSegment[]
```

| Class | Single-line | Multi-line |
|---|---|---|
| U+0009, U+000A | marker | kept |
| U+000D, CR LF | marker | normalised to U+000A |
| other C0 (U+0000–U+001F), U+007F, C1 (U+0080–U+009F) | marker | marker |
| U+202A–U+202E, U+2066–U+2069 (embeddings, overrides, isolates) | marker | marker |
| U+200E, U+200F, U+061C (bidi marks) | marker | kept |
| U+2028, U+2029 | marker | normalised to U+000A |
| U+FEFF | marker | marker |

### Content preview (`src/features/quarantine/content-preview.ts`, R9)

`preview(text, { maxLines: 20, maxChars: 4000 })` returns `{ head: string, truncated: boolean }`.
`truncated` is true when the text has more than 20 lines or more than 4,000 characters.

### Score values (`src/features/spam-filter/spam-score.ts`, R17)

- `Tenths = number` (an integer): 6.5 is 65. `toTenths(n)` and `fromTenths(t)` convert.
- `validatePair(junk, reject, caps)` returns field errors with the codes `outOfRange`,
  `notMultipleOf` and `mustNotExceed`.
- `equalRaisesReject(junk, reject)` returns a boolean.
- `bandZones(junk, reject)` returns three zones with `from` and `to` (in tenths, `to` exclusive
  except the last), a `labelKey`, and a display width in percent from a scale that is linear up to
  `max(reject × 1.5, 200 tenths)`, with the remaining width for the tail.

### PolicyOwner (`src/features/spam-filter/owner.ts`, R19)

`{ kind: 'domain' | 'aliasDomain' | 'mailbox', name: string }` maps to:

- the list, create and delete operations of its kind;
- its page route (`spam-filter-domain`, `spam-filter-alias-domain` or `spam-filter-mailbox`);
- the label of its inherited group ("Set for <domain>" or "Set for mailboxes").

### Action outcome view (`src/features/quarantine/action-outcome.ts`, R14)

`toOutcome(report: QuarantineActionReport)` returns `{ messageKey, params, warnings: string[] }`:

| Report | Message | Warning |
|---|---|---|
| `release` with `learning: done` | delivered and learned as not spam | — |
| `releaseWithoutLearning` (`learning: notRequested`) | delivered without learning | — |
| `release` with `learning: alreadyLearned` | delivered; already learned | — |
| any with `learning: failed` | delivered | the filter could not learn it |
| any with `fuzzy: failed` | (unchanged) | similar messages could not be remembered |
| `fuzzy: skipped` | (unchanged) | note: no content for similar-message hashes |
| `learnAsSpam` with `learning: done` or `alreadyLearned` | learned as spam and removed | per `fuzzy` |

`toProblemOutcome(problem)` maps the refusals of R14 to a message and a follow-up: `return`,
`recheckAfter(seconds)`, `keep` or `retry`.

### Rate limit view (`src/features/rate-limits/rate-limit.ts`, R20)

- `formatLimit(limit, locale)` returns "100 msgs / hour", or "Disabled" when `null`.
- `effectiveText(rateLimit)` returns the source "this mailbox", "the domain <domain of the address>"
  or "none".
- `validateLimit(value, frame, caps)` returns errors with the codes `outOfRange` and `notInList`.

### Quarantine section navigation item (`src/features/quarantine/components/QuarantineSectionNav.vue`)

It is built from the registered routes with `meta.sectionNav: { labelKey, order }` and
`meta.roles`. Only routes that exist and whose roles include the user's role are shown (R6).

### Download target (`src/shared/platform/download.ts`, R10)

`saveApiFile(fetcher: () => Promise<{ data: Blob; response: Response }>, fallbackName: string)`
reads `Content-Disposition`, sanitises the name, saves the file as `application/octet-stream`
through an object URL, and resolves when the click has been dispatched. It writes no storage.

## 3. Server-state cache

### Query keys

These are added to `src/api/query/keys.ts` under three new roots. The policy is 001-R9.

| Key | Operation | staleTime | gcTime | Fetched when |
|---|---|---|---|---|
| `['quarantine','capabilities']` | `getQuarantineCapabilities` | 10 min | default | the first screen of this feature that needs a limit |
| `['quarantine','settings']` | `getQuarantineSettings` | 30 s | default | the list (status notice) and the settings page |
| `['quarantine','list',QuarantineListParams]` | `listQuarantineItems` | 30 s | default | the list page; params from the address |
| `['quarantine','detail',itemId]` | `getQuarantineItem` | 30 s | **60 s** | the item page; the busy re-check |
| `['quarantine','notification-settings',mailbox]` | `getMailboxQuarantineNotificationSettings` | 30 s | default | the Notifications page; the mailbox page |
| `['spam-policy','spam-score',mailbox]` | `getMailboxSpamScore` | 30 s | default | the Spam filter page; the mailbox page |
| `['spam-policy','entries',ownerKind,owner,EntryListParams]` | `list<Kind>SpamPolicyEntries` | 30 s | default | the lists panel, 4 queries per owner (allow/block × own/inherited) |
| `['spam-policy','statistics']` | `getSpamFilterActionStatistics` | 30 s | default | the statistics page; Refresh |
| `['rate-limits','list',RateLimitListParams]` | `listRateLimits` | 30 s | default | the overview |
| `['rate-limits','detail',kind,object]` | `get<Kind>RateLimit` | 30 s | default | the rate limit panel |

`QuarantineListParams`, `EntryListParams` and `RateLimitListParams` alias
`NonNullable<operations['…']['parameters']['query']>`. They are never written by hand.

Pickers reuse UI 002–004's keys for `listDomains`, `listAliasDomains` and `listMailboxes` (an
infinite query with `q`, 25 per page). The recipient link check reuses UI 003's mailbox detail key
for `getMailbox`.

### Invalidation after mutations

| Mutation | On success | On 412 | Also invalidates (FR-086) |
|---|---|---|---|
| `releaseQuarantineItem`, `learnQuarantineItemAsSpam`, `deleteQuarantineItem` | remove `['quarantine','detail',id]`; invalidate `['quarantine','list']` | refetch the detail; "changed elsewhere" | — |
| `applyQuarantineBulkAction` | remove the detail of each `done` id; invalidate `['quarantine','list']` | (per-item `outdated`) | — |
| `updateQuarantineSettings` | write `['quarantine','settings']` from the response | keep the section input; refetch; mark changed values | — |
| `updateMailboxQuarantineNotificationSettings` | write `['quarantine','notification-settings',m]` | keep the input; refetch; mark | the mailbox detail and list keys of UI 003 |
| `applyQuarantineNotificationBulkAction` | invalidate `['quarantine','notification-settings']` | (per-item) | the mailbox list and detail keys of UI 003 |
| `setMailboxSpamScore` | write `['spam-policy','spam-score',m]` | keep the input; refetch; mark | — |
| `resetMailboxSpamScore` | invalidate `['spam-policy','spam-score',m]` | refetch; confirm again | — |
| `create…SpamPolicyEntry` | invalidate `['spam-policy','entries',kind,owner]` and, for a domain or alias domain, the mailbox entries of that domain (whose inherited group shows it) | — | — |
| `delete…SpamPolicyEntry` (each) | invalidate as for creation, once after the run | (per entry; reported) | — |
| `set…RateLimit`, `remove…RateLimit` | write or invalidate `['rate-limits','detail',kind,object]`; invalidate `['rate-limits','list']`; for a domain, invalidate the details of its mailboxes (their effective limit) | keep the input; refetch; mark; a refused removal is confirmed again | `getDomain` and `getAliasDomain` detail and list keys (`rateLimit`), and the mailbox detail and list keys (effective rate limit) |
| `resetRateLimitBucket` | none (UI 011 refreshes its own log) | — | — |

Nothing refetches on a timer or on focus (FR-086, 001-R9). `queryClient.clear()` on sign-out
discards all of the above (FR-085).

## 4. Client state

- **No new Pinia store and no new device-storage key.** The storage allowlist of 001 data-model §4
  stays unchanged, and its unit test also covers this feature's flows (FR-085).
- **Memory only, component-local**:
  - the bulk selection of the current page (`useBulkSelection`);
  - the selection of own list entries for removal;
  - dialog state: the learning switch, the virus acknowledgement and the typed value;
  - the busy re-check timer;
  - the bucket identifier being typed;
  - the in-flight download blob, dropped after the click.
- Nothing from a message is put into the page address, route state, history state or storage.

## 5. Route map

The base is `/ng/`. Each route is lazy (001-R19). "Nav entry" is `meta.navEntry`, and "Roles" is
the additional `meta.roles` (R6).

| Name | Path | Nav entry | Roles | Title key | Component |
|---|---|---|---|---|---|
| `quarantine` | `/quarantine` | `quarantine` | all | `quarantine.list.title` | `features/quarantine/pages/QuarantineListPage.vue` |
| `quarantine-notifications` | `/quarantine/notifications` | `quarantine` | `mailboxUser` | `quarantine.notifications.title` | `features/quarantine/pages/NotificationsPage.vue` |
| `quarantine-rate-limits` | `/quarantine/rate-limits` | `quarantine` | `admin`, `domainAdmin` | `rateLimits.overview.title` | `features/rate-limits/pages/RateLimitsPage.vue` |
| `quarantine-settings` | `/quarantine/settings` | `quarantine` | `admin` | `quarantine.settings.title` | `features/quarantine/pages/QuarantineSettingsPage.vue` |
| `quarantine-statistics` | `/quarantine/statistics` | `quarantine` | `admin` | `quarantine.statistics.title` | `features/quarantine/pages/SpamFilterStatisticsPage.vue` |
| `quarantine-item` | `/quarantine/:itemId(\d+)` | `quarantine` | all | `quarantine.item.title` | `features/quarantine/pages/QuarantineItemPage.vue` |
| `spam-filter` | `/spam-filter` | `spamFilter` | (catalogue: mailbox users with `spamScore` or `spamPolicy`) | `spamFilter.title` | `features/spam-filter/pages/SpamFilterPage.vue` |
| `spam-filter-domain` | `/domains/:domain/spam-filter` | `domains` | `admin`, `domainAdmin` | `spamFilter.object.title` | `features/spam-filter/pages/ObjectSpamFilterPage.vue` (`kind: 'domain'`) |
| `spam-filter-alias-domain` | `/alias-domains/:aliasDomain/spam-filter` | the alias domain entry of UI 004 | `admin`, `domainAdmin` | `spamFilter.object.title` | same page (`kind: 'aliasDomain'`) |
| `spam-filter-mailbox` | `/mailboxes/:mailbox/spam-filter` | `mailboxes` | `admin`, `domainAdmin` | `spamFilter.object.title` | same page (`kind: 'mailbox'`) |

Rules:

- The literal quarantine routes are registered before `quarantine-item`, and `:itemId` matches
  digits only.
- **Fragments**: the object page focuses and scrolls to the panel named by `#notifications`,
  `#spam-score`, `#lists` or `#rate-limit` when present (the host links of R26).
- **Not found**: a `404` from any panel's primary read, or a parameter that the API rejects as
  `404`, renders UI 001's `NotFoundPage` in place, with a way back to the host list. A resource's
  mailbox address therefore shows "not found".
- **Catalogue**: `quarantine` and `spamFilter` change from `placeholder` to `available` in the
  stories that register their first route (US1 and US4), so neither entry ever leads to "not
  found".
- **UI 014** maps the classic `/quarantine` to `quarantine` (row M14). The other addresses have no
  classic counterpart.

## 6. Address parameters

Defaults are omitted from the address. An invalid value falls back to its default, and the address
is normalised with `router.replace` (001-R20).

**Quarantine list** (`/quarantine`, FR-009 to FR-015):

| Param | Type | Default | Maps to |
|---|---|---|---|
| `q` | string ≤ 255 | — | `q` (through `SearchField`: Enter or a 500 ms pause) |
| `recipient` | e-mail address ≤ 255 (admin, DA) | — | `recipient` |
| `domain` | domain name ≤ 255 (admin, DA) | — | `domain` |
| `action` | repeatable `rejected`, `junk`, `subjectRewritten`, `other` | — | `action` (exploded) |
| `virus` | `true`, `false` | — | `virus` |
| `notified` | `true`, `false` | — | `notified` |
| `from`, `to` | `YYYY-MM-DD`, `from ≤ to` | — | `from` = start of `from` in the device time zone, in UTC; `to` = start of the day after `to`, in UTC (exclusive) |
| `minScore`, `maxScore` | decimal with `.`, `min ≤ max` | — | `minScore`, `maxScore` |
| `sort` | `arrivedAt`, `id`, `queueId`, `score`, `sender`, `recipient`, `subject`, `action`, `virus`, `notified` | `arrivedAt` | `sort` |
| `order` | `asc`, `desc` | `desc` for `arrivedAt`, `id` and `score`; `asc` otherwise | `order` |
| `page` | integer ≥ 1 | 1 | `offset = (page − 1) × size` |
| `size` | 25, 50, 100 (≤ `maxPageSize`) | 25 (`defaultPageSize`) | `limit` |

A mailbox user's address ignores `recipient` and `domain`.

**Lists panel** (object pages and `/spam-filter`, FR-045 to FR-047), for each `<p>` in
{`allow`, `block`}:

| Param | Type | Default | Maps to |
|---|---|---|---|
| `list` | `allow`, `block` | `allow` | the list shown below `md` |
| `<p>Q` | string ≤ 255 | — | `q` of both of the list's queries |
| `<p>Sort` | `pattern`, `createdAt` | `pattern` | `sort` |
| `<p>Order` | `asc`, `desc` | `asc` for `pattern`, `desc` for `createdAt` | `order` |
| `<p>Page` | integer ≥ 1 | 1 | `offset` of the own query |
| `<p>InheritedPage` | integer ≥ 1 | 1 | `offset` of the inherited query |
| `<p>Size` | 25, 50, 100 | 25 | `limit` of both queries |

Every query also sends `list=<p>` and `ownership=own` or `inherited`.

**Rate limits overview** (`/quarantine/rate-limits`, FR-056):

| Param | Type | Default | Maps to |
|---|---|---|---|
| `kind` | `domain`, `aliasDomain`, `mailbox` | — | `kind` |
| `q` | string ≤ 255 | — | `q` |
| `sort` | `object`, `kind` | `object` | `sort` |
| `order` | `asc`, `desc` | `asc` | `order` |
| `page`, `size` | as above | 1, 25 | `offset`, `limit` |

## 7. Client-side validation

These checks run before submitting. Server field errors are always shown too (FR-067, FR-068).
The limits come from `QuarantineCapabilities` (written `caps.` below) unless stated. Message keys
are the `validation.*` keys of 001-R15.

| Field | Rule | Code |
|---|---|---|
| Spam score junk, reject | a locale decimal (R18) from `caps.spamScore.min` to `max`, a multiple of `step` | `outOfRange`, `notMultipleOf`, or `spamFilter.score.notANumber` |
| Spam score pair | junk ≤ reject; equal values show the "+0.1" note and are allowed | `mustNotExceed` (`field: rejectScore`, `value`) |
| Allow/block pattern | trimmed and lower-cased; only `caps.senderPattern.allowedCharacters`; at least one `[a-z0-9]`; ≤ `caps.senderPattern.maxLength` | `invalidFormat` (`format: senderPattern`), `tooLong` |
| Rate limit value | a whole number from `caps.rateLimit.min` to `max` | `outOfRange` |
| Rate limit frame | one of `caps.rateLimit.frames` | `notInList` |
| Bucket identifier | `^RL[0-9A-Za-z=]+$`, ≤ 128 (contract parameter `RateLimitBucketId`, in `src/shared/validation/limits.ts`) | `invalidFormat` (`format: bucketId`, app-defined message) |
| Retention per mailbox | a whole number from 0 to `caps.settings.maxRetentionPerMailbox` | `outOfRange` |
| Maximum message size (MiB) | a whole number from 0 to `caps.settings.maxMessageSize / maxMessageSizeStep`; sent × `maxMessageSizeStep` | `outOfRange` |
| Maximum age (days) | a whole number from `caps.settings.maxAgeDays.min` to `max` | `outOfRange` |
| Notification score limit | empty (9999.0 applies) or a locale decimal | `spamFilter.score.notANumber` |
| Notification sender, copy, redirect | empty, or an address with one `@` and a dot in the domain part, ≤ 255 (the server's `email` check is final) | `invalidFormat` (`format: email`) |
| Notification subject | ≤ `caps.settings.notificationSubjectMaxLength` characters | `tooLong` |
| Notification template | UTF-8 bytes ≤ `caps.settings.notificationTemplateMaxBytes` (the save is blocked) | `tooLong` (`unit: bytes`) |
| Excluded domains | chosen from the picker only; stored missing entries may stay | — (server: `notFound`) |
| List filters: score range | locale decimals, `min ≤ max` | `quarantine.filters.scoreOrder` |
| List filters: days | valid dates, `from ≤ to` | `quarantine.filters.dayOrder` |
| List filters: recipient | an address ≤ 255 | `invalidFormat` (`format: email`) |
| Bulk selection | ≤ `caps.bulkLimit` | `quarantine.bulk.limitReached` |

## 8. State machines

### Item action (`useItemAction`, R14)

```text
idle ──choose action──► confirming ──cancel──► idle
                           │ confirm (controls disabled)
                           ▼
                        sending ──200 report──► done (announce; remove detail; back to list)
                           │──204 (remove)───► done
                           │──404────────────► gone ("already released or removed"; back; refresh list)
                           │──409 busy───────► busy ──after Retry-After (default 5 s), once──► re-read item
                           │                                    ├─404─► gone
                           │                                    └─200─► idle ("available again")
                           │──409 refused────► idle (item kept; mail server answer shown)
                           │──412────────────► idle (re-read; "changed elsewhere")
                           │──403────────────► idle (reason; identity refreshed; controls updated)
                           │──503────────────► idle (nothing changed; names the service; user may retry)
                           └──no response────► unknown ("outcome unknown"; re-read item once; never resend)
```

### Bulk run (`useQuarantineBulk`, R15)

```text
selecting (≤ caps.bulkLimit, current page only) ──action──► confirming ──cancel──► selecting
       ▲                                                        │ confirm
       │                                                        ▼
       │                                                     running ("in progress"; controls disabled)
       │   ┌──────────────────────── 200 QuarantineBulkResult ──┤
       │   ▼                                                    ├─403/422──► selecting (one message; selection kept)
   summary (counts + rows; done deselected;                     └─no response──► unknown (announce; refresh list;
            refused/failed/outdated stay selected)                                never resend)
```

Any change of page, page size, search, filters or sort clears the selection, with an announcement.

### Busy re-check

One timer per item page. It starts on `409 quarantine-item-busy` and is cancelled on unmount or on
any new action. It never sends an action.

### Download (`saveApiFile`, R10)

```text
idle ──download──► (virus? warning ──cancel──► idle) ──► fetching ──200──► saving (blob → <a download>) ──► idle
                                                            └─problem──► idle (translated reason)
```

### List entry removal run (`useRemoveEntries`, R19)

```text
selected own entries ──confirm──► run: for each entry in order: DELETE (If-Match)
    204 → removed · 404 → already removed · other → failed (problem kept)
──► report (per entry) ──"retry failed"──► run over the failed entries only
```

### Section edit (UI 002 `EditableSection` with `useVersionedSave`)

The settings sections, the notification panel, the spam score panel and the rate limit form use
it unchanged:

```text
read ──Edit──► editing ──Save──► saving ──200──► read (announce; effect timing note)
                                   ├─412──► editing (input kept; changed values marked; save again or discard)
                                   ├─422──► editing (field errors; summary focused)
                                   └─503──► editing (nothing changed; retry keeps input)
```
