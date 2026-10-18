# Data Model: Aliases, Alias Domains, Resources and Sender Permissions

**Feature**: `specs/004-aliases-alias-domains-resources` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

This app owns no persistent data. This document defines:

- the API data this feature consumes, as generated types;
- the app-defined view models;
- the server-state cache (query keys and invalidation);
- the in-memory draft registry;
- the route map and the list address parameters;
- the client-side checks and the error mapping;
- the state machines of multi-entry creation, section editing, the "Send as" save, bulk runs and
  copies;
- the translations: scope manifest additions, closed enumerations and reused legacy keys.

Contract shapes are not restated. Types come from `src/api/generated/schema.ts` through `@/api`
(001 R7). Decisions are justified in [research.md](./research.md).

## 1. API data consumed

| Type | Operation(s) | Used by | Notes |
|---|---|---|---|
| `Alias`, `AliasKind`, `AliasDestinationType` | `listAliases`, `getAlias`, `createAlias`, `updateAlias` | aliases | `etag` per entry and detail; `orphaned` only for administrators |
| `AliasCreateRequest`, `AliasPatch` | `createAlias`, `updateAlias` | alias form | built by `alias-form.ts` (§2) |
| `AliasCopyReport`, `AliasCopyOutcome` | `copyAliasOverAliasDomains`, `applyAliasBulkAction` (`meta.copies`) | copy results | `address` is ASCII only (plan API gap G2) |
| `AliasBulkActionRequest`, `AliasDomainBulkActionRequest`, `ResourceBulkActionRequest`, `BulkTarget`, `BulkResult`, `BulkItemResult`, `BulkItemOutcome` | the three `apply…BulkAction` operations | mass actions | `targets[].version` = list entry `etag` |
| `AliasCapabilities` | `getAliasesCapabilities` | `CapabilitiesGate`, forms, bulk bar | R5 |
| `AliasDomain`, `AliasDomainRateLimit` | `listAliasDomains`, `getAliasDomain`, `updateAliasDomain` | alias-domains | `etag` covers name, target and active only |
| `AliasDomainCreateRequest`, `AliasDomainPatch`, `AliasDomainCreated`, `AliasDomainCreationReport` | `createAliasDomain`, `updateAliasDomain` | alias domain form, creation report | the report is shown, never cached |
| `Resource`, `ResourceKind`, `ResourceBookingRule`, `ResourceCreateRequest`, `ResourcePatch` | the resource operations | resources | `bookingLimit` only with `limited` |
| `MailboxSenderSettings`, `MailboxImplicitSenderAddress`, `MailboxSenderPermission`, `MailboxSenderSettingsPatch` | `getMailboxSenderSettings`, `updateMailboxSenderSettings` | sender-settings | `etag` covers the explicit permissions and external addresses only |
| `MailboxSenderPermissionCandidate` | `listSenderPermissionCandidates` | candidate picker | `type` only (plan API gap G1) |
| `AliasLimitReachedProblem`, `AliasDomainAlreadyExistsProblem`, `Problem`, `ValidationProblem`, `FieldViolation`, `ValidationRuleCode` | errors | `ApiProblem`, i18n | extension members through `ApiProblem.extensions` (research D12) |
| `Identity`, `PermissionFlags` | `getIdentity` (001) | permissions (R6) | flags `aliasDomains`, `aliasExternalGoto`, `extendSenderAcl`, `ratelimit` |
| `PublicConfig` | `getPublicConfig` (001) | address help text | `productName` |
| `Domain` | `listDomains` (API 002) | `DomainPicker` | `name`, `nameUnicode`, `backupMx` |
| `AuditEvent`, `AuditTarget`, `AuditEventType` | `listAuditEvents` (001, with 002's `targetType` and `targetId`) | History | 10 new event types, 4 new target types |

The 004 root types and the value arrays `aliasKindValues`, `aliasDestinationTypeValues`,
`resourceKindValues`, `resourceBookingRuleValues` and `bulkItemOutcomeValues` are re-exported from
`src/api/index.ts`. List parameter types are aliases of the generated
`NonNullable<operations['listAliases' | 'listAliasDomains' | 'listResources' |
'listSenderPermissionCandidates']['parameters']['query']>`.

## 2. App-defined models

These are not API shapes. Each is derived from API data or from user input.

### EntryList (`src/shared/validation/entry-list.ts`)

`parseEntryList(text: string): ParsedEntry[]`, where `ParsedEntry = { value: string; index: number }`.

| Rule | Detail |
|---|---|
| Separators | `,`, `;`, any whitespace (including new lines) |
| Trimming | each entry; empty entries dropped |
| Duplicates | an entry equal to an earlier one ignoring letter case is dropped; the first spelling is kept |
| `index` | position in the list as sent, so that `destinations.2` maps to `index` 2 |
| Catch-all marker (alias addresses only) | `value.startsWith('@')` |

### AliasFormState (`src/features/aliases/alias-form.ts`)

| Field | Type | Rule |
|---|---|---|
| `addressesText` | string | creation only; parsed with `parseEntryList` |
| `address` | string | edit only (Address section) |
| `destinationChoice` | `'addresses' \| 'discard' \| 'learnSpam' \| 'learnHam'` | default `addresses`; maps 1:1 to `AliasDestinationType` |
| `destinationsText` | string | kept while another choice is selected; sent only for `addresses` |
| `active`, `senderAllowed`, `internal` | boolean | defaults `true`, `true`, `false` (legacy form) |
| `groupwareVisible` | boolean | default `true`; present only when `groupwareEnabled` |
| `publicComment`, `privateComment` | string | default `""` |

Functions:

- `toCreateRequest(state, address)` returns `AliasCreateRequest`:
  - `destinations` only for `addresses`; otherwise only `destinationType`;
  - `groupwareVisible` only when the groupware is enabled;
  - comments only when non-empty.
- `buildAliasPatch(read: Alias, state)` returns `AliasPatch | null`:
  - only the members that differ from `read`;
  - `destinationType` and `destinations` only when the choice or the parsed list differs;
  - never read-only members;
  - `null` when nothing changed.
- `classifyAliasRefusal(problem)` returns `'entry' | 'form'` (research R9).

### AliasDomainFormState (`src/features/alias-domains/alias-domain-form.ts`)

| Field | Rule |
|---|---|
| `namesText` | parsed with `parseEntryList` |
| `targetDomain` | ASCII name from the picker; required |
| `active` | default `true` |
| `generateDkim` | default `true` |
| `dkimSelector` | pre-filled with `dkimDefaults.selector`; required while `generateDkim` |
| `dkimKeySize` | one of `dkimKeySizes`, pre-selected `dkimDefaults.keySize` |
| `rateLimitValue`, `rateLimitFrame` | only when `canSetInitialRateLimit`; empty value means none; frame one of `rateLimitFrames` |

`toCreateRequest(state, name)`:

- with `generateDkim` false, `dkimSelector: ""` and no `dkimKeySize`;
- `rateLimit: { value, frame }` only when a value is given.

`buildAliasDomainPatch(read, state)` sends `targetDomain` and `active` only when they changed.

### ResourceFormState and AddressPreview (`src/features/resources/`)

| Field | Rule |
|---|---|
| `description` | ≤ `resourceDescriptionMaxLength` characters; required |
| `domain` | creation only; ASCII name from the picker (domains only) |
| `kind` | `location`, `thing` or `group` |
| `bookingRule` | default `unlimited` |
| `bookingLimit` | only with `limited`; whole number within `resourceBookingLimit.min..max` |
| `active` | default `true` |

`previewAddress(description, domainUnicode)`:

- returns `{ localPart, address } | { reason: 'noLettersOrDigits' | 'tooLong' }`;
- `localPart` = the description with every character outside `[A-Za-z0-9]` removed, case kept;
- the result is invalid when it is empty or longer than 64 characters.

`buildResourcePatch(read, state)` sends only the changed members, with `bookingLimit` only together
with `bookingRule: 'limited'`.

### BookingView (`src/features/resources/booking.ts`)

| `bookingRule` | Badge (legacy key) | Legend and option text (legacy key) |
|---|---|---|
| `alwaysFree` | "Always free" (`mailbox.booking_0_short`) | `mailbox.booking_null` |
| `unlimited` | "Soft limit" (`mailbox.booking_lt0_short`) | `mailbox.booking_ltnull` |
| `limited` | "Hard limit ({n})" (`mailbox.booking_custom_short` + count) | `mailbox.booking_custom` |

### CreationReportView (`src/features/alias-domains/creation-report.ts`)

One line per step, in the order `rateLimit`, `dkimKey`, `dkimDnsPublication`,
`groupwareDirectoryUpdate`. The kinds are those of UI 002's `CreationReportLine`, rendered by the
shared `CreationReport.vue` (research D13), so this feature does not use its own status names:

| Kind | Outcomes |
|---|---|
| `done` | `applied`, `created`, `published`, `done` |
| `info` | `notRequested`, `alreadyExisted`, `notConfigured`, `skipped`, `noZone`, `groupwareDisabled` |
| `warning` | `failed` |

Each row also has a text key `aliasDomains.report.<step>.<outcome>`. A `warning` row carries a
`repeatAt` catalogue entry: `rateLimit` → UI 006's entry, DKIM steps → `dns`, groupware → none. The
entry is linked only when `isEntryAvailable`.

### SendAsView and SendAsWorkingCopy (`src/features/sender-settings/send-as-model.ts`)

`toView(settings)` returns:

| Part | Source |
|---|---|
| `alwaysAllowed` | `implicitAddresses` with `source` in (`ownAddress`, `aliasDomainAddress`), plus `alias` with `senderAllowed: true`; each with `catchAll` and `aliasId` |
| `receiveOnly` | `alias` entries with `senderAllowed: false`; each with `overriddenByExplicit` = its address is among `explicitPermissions` values (case-insensitive) |
| `explicit` | `explicitPermissions` without `*`, with `changeable`, `stale` and a label key by `type` |
| `anyAddress` | `{ on: senderCheckDisabled, changeable }`, where `changeable` is the `*` entry's flag, or `canGrantAnyAddress` when absent |
| `external` | `externalSenderAddresses` |

`SendAsWorkingCopy = { explicit: string[]; anyAddress: boolean; externalText: string }` starts from
the view. Functions:

- `buildSenderPatch(read, copy)`:
  - `explicitPermissions` = `['*']` when `anyAddress`, otherwise the copy's values (including
    non-changeable ones), only if the set differs from `read` ignoring order and letter case;
  - `externalSenderAddresses` = the parsed `externalText`, only if the list differs;
  - `null` when nothing changed.
- `entryForPath(path, patchSent)` maps `explicitPermissions.N` and `externalSenderAddresses.N` back
  to the sent entry.
- `notNeededAfterSave(added, response)` returns the added values absent from
  `response.explicitPermissions` that match an `implicitAddresses` alias with `senderAllowed: true`
  (FR-055).

### BulkActionConfig (`src/features/{aliases,alias-domains,resources}/*-bulk.ts`)

| Field | Meaning |
|---|---|
| `action` | the contract's enum value |
| `labelKey` | for example `mailbox.deactivate` (legacy) |
| `confirm` | `'none' \| 'simple' \| 'explain' \| 'typedCount'` (research R16) |
| `visible(identity, caps)` | permission and groupware gating |

`toTargets(entries) = entries.map(e => ({ id: idOf(e), version: unquote(e.etag) }))`. The version is
the `etag` without surrounding quotes, as `BulkTarget.version` requires, built from the list entries
at send time. `idOf` is:

- `String(alias.id)` for aliases;
- `aliasDomain.name` for alias domains;
- `resource.address` for resources.

### SequentialCreateRun (`src/shared/composables/useSequentialCreate.ts`)

`{ status: 'idle' | 'running' | 'done' | 'stopped'; current: number; total: number; results:
EntryResult[] }`, where `EntryResult = { entry: ParsedEntry; outcome: 'created' | 'refused' |
'notProcessed'; data?: unknown; problem?: ApiProblem }`. The state machine is in §7.

### PermissionMatrix (`src/features/aliases/permissions.ts`)

Pure functions over `Identity` and, where needed, `AliasCapabilities` (research R6). The
table-driven test covers every row of spec FR-002.

## 3. Server-state cache

### Query keys (`src/api/query/keys.ts`)

| Key | Operation | staleTime | Fetched when | Notes |
|---|---|---|---|---|
| `['capabilities','aliases']` | `getAliasesCapabilities` | 5 min | first form, bulk bar or groupware-dependent list element | cleared with the cache on sign-out |
| `['aliases','list',AliasListParams]` | `listAliases` | 30 s | alias list | params from the address (§5) |
| `['aliases','detail',aliasId]` | `getAlias` | 30 s | alias detail | `placeholderData` from a cached list entry |
| `['aliases','domain-filter',{q}]` | `listAliasDomains` | 30 s | the "Domain" filter picker's alias-domain group | `useInfiniteQuery`, 25 per page; uses the `alias-domains` list key factory |
| `['alias-domains','list',AliasDomainListParams]` | `listAliasDomains` | 30 s | alias domain list | — |
| `['alias-domains','detail',name]` | `getAliasDomain` | 30 s | alias domain detail | ASCII name |
| `['resources','list',ResourceListParams]` | `listResources` | 30 s | resource list | — |
| `['resources','detail',address]` | `getResource` | 30 s | resource detail | — |
| `['sender-settings','detail',mailbox]` | `getMailboxSenderSettings` | 30 s | "Send as" | mailbox ASCII address |
| `['sender-permission-candidates',{mailbox,q,type}]` | `listSenderPermissionCandidates` | 30 s | picker open and typing (300 ms debounce) | `useInfiniteQuery`, 25 per page |
| `['domains','list',…]` | `listDomains` | 30 s | `DomainPicker` | UI 002's key, reused |

### Invalidation after mutations

| Mutation | On success | On 412 | On 404 |
|---|---|---|---|
| `createAlias` | write `['aliases','detail',id]`; invalidate `['aliases','list']`, `['alias-domains']`, `['domains']`, `['sender-settings']` | — | — |
| `updateAlias` | write the detail; invalidate `['aliases','list']`, `['alias-domains']`, `['domains']`, `['sender-settings']` | keep input; refetch the detail; mark changed fields | message; remove the detail; invalidate the list; go to the list |
| `deleteAlias` | remove the detail; invalidate as `updateAlias` | refetch; confirm again | as `updateAlias` |
| `copyAliasOverAliasDomains` | invalidate `['aliases','list']`, `['alias-domains']`, `['domains']`, `['sender-settings']` | refetch the alias; explain again | as `updateAlias` |
| `applyAliasBulkAction` | invalidate `['aliases']`, `['alias-domains']`, `['domains']`, `['sender-settings']` | (per item `outdated`) | (per item `notFound`) |
| `createAliasDomain` | write `['alias-domains','detail',name]` without `creationReport`; invalidate `['alias-domains','list']`, `['domains']`, `['sender-settings']`, `['sender-permission-candidates']` | — | — |
| `updateAliasDomain` | write the detail; invalidate `['alias-domains','list']`, `['aliases']` (primary domains change), `['domains']`, `['sender-settings']` | keep input; refetch; mark | message; go to the list |
| `deleteAliasDomain` | remove the detail; invalidate `['alias-domains','list']`, `['aliases']`, `['domains']`, `['sender-settings']`, `['sender-permission-candidates']` | refetch; confirm again | as above |
| `applyAliasDomainBulkAction` | invalidate `['alias-domains']`, `['aliases']`, `['domains']`, `['sender-settings']`, `['sender-permission-candidates']` | (per item) | (per item) |
| `createResource` | write the detail; invalidate `['resources','list']`, `['domains']` | — | — |
| `updateResource` | write the detail; invalidate `['resources','list']` | keep input; refetch; mark | message; go to the list |
| `deleteResource` | remove the detail; invalidate `['resources','list']`, `['domains']` | refetch; confirm again | as above |
| `applyResourceBulkAction` | invalidate `['resources']`, `['domains']` | (per item) | (per item) |
| `updateMailboxSenderSettings` | write `['sender-settings','detail',mailbox]`; invalidate `['sender-permission-candidates']` for that mailbox | keep the working copy; refetch; mark the changed sets | message; back to the mailbox detail |

A connection drop on any mutation keeps the input, offers a retry, and is never retried
automatically (001 R8). On bulk actions it is reported as "outcome unknown" and the list is
refreshed.

## 4. Client state

- **No new Pinia store, and no new device storage key.** UI 001 data-model §4 stays the complete
  list. The storage audit end-to-end test is extended for this feature's flows.
- **Draft registry** (`src/shared/composables/useFormDraft.ts`): a module-level `Map<string,
  { owner: string; value: unknown }>`.

  | Event | Effect |
  |---|---|
  | form unmounts while the session ended (`sessionEnded` notice) | save `{ owner: username, value }` under `fullPath#formId` |
  | form mounts | restore when `owner` equals the signed-in username, then delete |
  | successful save, explicit discard | delete that entry |
  | sign-out (`src/app/session/sign-out.ts`) | `clearAllDrafts()` |
  | another account signs in (`src/app/session/cross-tab.ts`, identity mismatch) | `clearAllDrafts()` |
  | reload | lost by design (memory only) |

- **Selections** live in `useBulkSelection` component state (research D2), current page only.

## 5. Route map

The base is `/ng/`. Every route is lazy-loaded. "nav" is the catalogue entry that decides access in
`ShellLayout` (001 R19).

| Name | Path | nav | Title key | Component (chunk) | Story |
|---|---|---|---|---|---|
| `aliases` | `/aliases` | `aliases` | `aliases.title` | `features/aliases/pages/AliasesPage.vue` | US1 |
| `alias-create` | `/aliases/new` | `aliases` | `aliases.create.title` | `features/aliases/pages/AliasCreatePage.vue` | US2 |
| `alias-detail` | `/aliases/:aliasId(\\d+)` | `aliases` | `aliases.detail.title` | `features/aliases/pages/AliasDetailPage.vue` | US1, US3 |
| `alias-domains` | `/alias-domains` | `aliasDomains` | `aliasDomains.title` | `features/alias-domains/pages/AliasDomainsPage.vue` | US4 |
| `alias-domain-create` | `/alias-domains/-/new` | `aliasDomains` | `aliasDomains.create.title` | `features/alias-domains/pages/AliasDomainCreatePage.vue` (renders `NoAccessState` without `canAddAliasDomain`) | US4 |
| `alias-domain-detail` | `/alias-domains/:aliasDomain` | `aliasDomains` | `aliasDomains.detail.title` | `features/alias-domains/pages/AliasDomainDetailPage.vue` | US4 |
| `resources` | `/resources` | `resources` | `resources.title` | `features/resources/pages/ResourcesPage.vue` | US7 |
| `resource-create` | `/resources/new` | `resources` | `resources.create.title` | `features/resources/pages/ResourceCreatePage.vue` | US7 |
| `resource-detail` | `/resources/:resourceAddress([^/]+@[^/]+)` | `resources` | `resources.detail.title` | `features/resources/pages/ResourceDetailPage.vue` | US7 |
| `mailbox-send-as` | `send-as`, a child of UI 003's `mailbox-detail` layout (`/mailboxes/:address([^/]+@[^/]+)/send-as`) | `mailboxes` | `senderSettings.title` | `features/sender-settings/pages/SendAsPage.vue` | US5 |

Rules:

- Mailbox users get UI 001's "no access" state on every route above, rendered in place with no data
  request (FR-001, US1-AS10).
- `edit=<section>` on the detail routes opens one section (research R10): `address`, `destination`,
  `options` or `comments` on `alias-detail`, `general` on `alias-domain-detail`, `resource` on
  `resource-detail`. An unknown or non-editable section is removed with `router.replace`.
- `:aliasDomain` is the ASCII name in every link the app builds. Other spellings are replaced by the
  canonical address once loaded (UI 002 D4).
- The `mailbox-send-as` record is exported by `src/features/sender-settings/index.ts` and listed among
  the children of `mailbox-detail` in `src/features/mailboxes/routes.ts`. `MailboxSectionNav.vue`
  gains its "Send as" entry (research R4).
- An object outside the scope answers 404, which shows the "not found" state with a link back to the
  list, exactly like a missing object (FR-003).
- The catalogue rows `aliases`, `aliasDomains` and `resources` (research R4) are flipped to
  `available` by the story that registers their routes (US1, US4, US7).

### Address parameters of the lists (`useListState` schemas)

Defaults are omitted from the address. Invalid values fall back to the default, and the address is
normalised with `router.replace`. `page` and `size` are as in UI 001 (25, 50, 100; default 25).
Changing a filter, the sort or the size resets `page` and clears the selection.

**Aliases** (`/aliases`, FR-013, FR-014):

| Param | Type | Default | Maps to |
|---|---|---|---|
| `q` | string ≤ 255 | — | `q` |
| `domain` | repeatable string ≤ 253 (≤ 100) | — | `domain` |
| `primaryDomain` | repeatable string ≤ 253 (≤ 100) | — | `primaryDomain` |
| `kind` | repeatable `regular`, `catchAll` | — | `kind` |
| `destinationType` | repeatable `addresses`, `discard`, `learnSpam`, `learnHam` | — | `destinationType` |
| `destination` | string ≤ 255 (one address in the UI) | — | `destination` |
| `active`, `senderAllowed`, `internal` | `true`, `false` | — | same names |
| `groupwareVisible` | `true`, `false`; ignored while the groupware is disabled or unknown | — | `groupwareVisible` |
| `sort` | `id`, `address`, `domain`, `active`, `groupwareVisible` (only with groupware), `internal`, `senderAllowed`, `createdAt`, `modifiedAt` | `id` | `sort` |
| `order` | `asc`, `desc` | `desc` for `id`, `asc` otherwise | `order` |

**Alias domains** (`/alias-domains`, FR-034):

| Param | Type | Default | Maps to |
|---|---|---|---|
| `q` | string ≤ 255 | — | `q` |
| `targetDomain` | repeatable string ≤ 253 | — | `targetDomain` |
| `active` | `true`, `false` | — | `active` |
| `sort` | `name`, `targetDomain`, `active`, `createdAt`, `modifiedAt` | `name` | `sort` |
| `order` | `asc`, `desc` | `asc` | `order` |

**Resources** (`/resources`, FR-043):

| Param | Type | Default | Maps to |
|---|---|---|---|
| `q` | string ≤ 255 | — | `q` |
| `domain` | repeatable string ≤ 253 | — | `domain` |
| `kind` | repeatable `location`, `thing`, `group` | — | `kind` |
| `active` | `true`, `false` | — | `active` |
| `sort` | `address`, `description`, `kind`, `domain`, `bookingRule`, `active`, `createdAt`, `modifiedAt` | `address` | `sort` |
| `order` | `asc`, `desc` | `asc` | `order` |

The audit log's `targetType` and `targetId` parameters come from UI 002 (research D7).

## 6. Client-side checks and error mapping

The checks below are input aids. The server stays authoritative (FR-019, FR-070). Every limit comes
from `AliasCapabilities`, except the 64-character derived local part, which is part of the
contract's documented derivation rule.

| Field | Check before submitting | Message key |
|---|---|---|
| Alias addresses (creation) | at least one entry after `parseEntryList` | `aliases.form.errors.addresses.required` (legacy `danger.alias_empty`) |
| Destinations (choice `addresses`) | at least one entry; joined with `,` ≤ `destinationsMaxLength` | `aliases.form.errors.destinations.required` (legacy `danger.goto_empty`), `validation.tooLong.unit.characters` |
| Public and private comment | UTF-8 bytes ≤ `commentMaxBytes`; on edit only when changed | `validation.tooLong.unit.bytes` |
| Alias domain names | at least one entry | `aliasDomains.form.errors.names.required` |
| Target domain | chosen; relay domains cannot be chosen | `validation.required`; picker reason `aliasDomains.form.relayNotAllowed` |
| DKIM selector | non-empty while "Generate a DKIM key" is on | `aliasDomains.form.errors.dkimSelector.required` |
| Initial rate limit | empty, or a whole number ≥ 1; a frame chosen when a value is given | `aliasDomains.form.errors.rateLimit.wholeNumber`, `validation.required` |
| Resource description | non-empty after trimming; ≤ `resourceDescriptionMaxLength`; derivable address (preview) | `validation.required`, `validation.tooLong`, `resources.form.preview.noAddress` |
| Booking limit (`limited`) | whole number within `resourceBookingLimit.min..max` | `validation.outOfRange` |
| External sender addresses | none beyond `parseEntryList` (the server validates) | — |

**Server refusals and their fields** (research R17). The paths are those of the request body.
`<n>` is the entry index.

| Operation | Path or problem | Code and parameters | Message key (first match per R17 lookup) |
|---|---|---|---|
| `createAlias`, `updateAlias` | `address` | `required`, `tooLong {max}`, `invalidFormat {format: aliasAddress}`, `notFound {resource: domain}`, `immutable` | `aliases.form.errors.address.<code>…` (legacy `danger.alias_invalid` for `invalidFormat`) |
| | `destinations` | `required`, `conflictsWith {field: destinationType}`, `tooLong {unit: characters}` | `aliases.form.errors.destinations.<code>…` |
| | `destinations.<n>` | `invalidFormat {format: email}`, `conflictsWith {field: address}`, `notEligible {kind: resource}`, `notEligible {kind: externalDestination}` | per code and kind (legacy `danger.goto_invalid` for `invalidFormat`) |
| | `publicComment`, `privateComment` | `tooLong {max: 160, unit: bytes}` | `validation.tooLong.unit.bytes` |
| | `403 attribute-not-permitted` | `attributes: [destinations.<n>]`, `requiredFlags` | `problem.attribute-not-permitted` at each entry (legacy `danger.external_goto_denied`) |
| | `409 address-in-use` | `address`, `holder` | `problem.address-in-use.holder.<holder>` at the address |
| | `409 domain-alias-limit-reached` | `domain`, `count`, `limit`, `requested` | `problem.domain-alias-limit-reached` at the address |
| `createAliasDomain`, `updateAliasDomain` | `name` | `required`, `invalidFormat {format: domainName}`, `reserved`, `conflictsWith {field: targetDomain}` | `aliasDomains.form.errors.name.<code>…` (legacy `danger.alias_domain_invalid`, `danger.aliasd_targetd_identical`) |
| | `targetDomain` | `notFound {resource: domain}`, `notEligible {kind: aliasDomain \| relayDomain}` | `aliasDomains.form.errors.targetDomain.<code>…` (legacy `danger.target_domain_invalid` for `notFound`) |
| | `rateLimit.value`, `rateLimit.frame`, `dkimSelector`, `dkimKeySize` | `outOfRange`, `notInList`, `invalidFormat {format: dkimSelector}`, `tooLong` | per field |
| | `403 permission-flag-required`, `403 attribute-not-permitted` (`rateLimit`) | `requiredFlags` | form summary, or at `rateLimit` |
| | `409 alias-domain-already-exists` | `name`, `existingKind` | `problem.alias-domain-already-exists.existingKind.<kind>` at the name |
| | `409 domain-alias-limit-reached` (target change) | as above | at `targetDomain` |
| | `503 temporary-failure` | — | `aliasDomains.errors.temporaryFailure` in the summary |
| `createResource`, `updateResource` | `description` | `required`, `tooLong`, `invalidFormat {format: resourceDescription}` | `resources.form.errors.description.<code>…` (legacy `danger.description_invalid`) |
| | `domain` | `notFound {resource: domain}`, `notEligible {kind: aliasDomain}` | `resources.form.errors.domain.<code>…` |
| | `kind`, `bookingRule` | `notInList` | `validation.notInList` |
| | `bookingLimit` | `required`, `outOfRange`, `conflictsWith {field: bookingRule}` | per code |
| | `409 address-in-use` | `address`, `holder` | at `description` (US7-AS2) |
| `updateMailboxSenderSettings` | `explicitPermissions.<n>` | `invalidFormat {format: senderPermission}`, `notFound {resource: address \| domain}`, `notEligible {allowedRoles: [admin]}` | `senderSettings.errors.explicit.<code>…` |
| | `externalSenderAddresses.<n>` | `invalidFormat {format: emailOrDomain}`, `notEligible {kind: localDomain}` | legacy `danger.extra_acl_invalid`, `danger.extra_acl_invalid_domain` |
| | `403 attribute-not-permitted` | `attributes: [externalSenderAddresses]` | at the external section |
| bulk items | `problem` of `refused` and `failed` | any of the above, `not-primary-domain-alias`, `temporary-failure` | `problem.<name>` with extension parameters |

## 7. State machines

### Multi-entry creation (`useSequentialCreate`; aliases and alias domains)

```text
idle ─submit (client checks pass)→ running(i = 0)
running(i) ─send entry i→ ┬ 2xx ───────────────→ created(i); i+1 < n ? running(i+1) : done
                          ├ entry-level refusal → refused(i); i+1 < n ? running(i+1) : done
                          ├ form-level refusal ─→ refused(i); rest notProcessed → stopped
                          └ network failure ────→ rest notProcessed (i included) → stopped
done | stopped → results shown; created entries removed from the field; others kept
               → n = 1 and created: navigate (alias detail / alias domain report)
```

Refusals are classified per research R9. Nothing is retried automatically.

### Section edit (`EditableSection` + `useVersionedSave`; alias, alias domain, resource)

```text
view ─Edit→ editing ─Save (patch ≠ null)→ saving ─200→ view (announce, write cache)
  ▲           │ Cancel/leave with changes → confirm discard        │ 412 → conflict
  │           └ Save with patch = null → view (nothing sent)       │ 404 → vanished → list
  │                                                                 │ 4xx field errors → editing (marked)
  │                                                                 └ network → editing (retry offered)
conflict: input kept, object refetched, changed fields marked "Changed elsewhere: …"
  ─Save→ saving (with the new version)    ─Discard→ view (reloaded values)
```

### "Send as" save (`SendAsPage`)

```text
loaded ─edit working copy→ dirty ─Save→ saving ─200→ loaded (FR-055 notices for not-needed entries)
                             │                  ├ 412 → conflict (copy kept; refetch; changed sets marked)
                             │                  ├ 422/403 → dirty (entries marked by index; all kept)
                             │                  ├ 404 → vanished → mailbox detail
                             │                  └ network → dirty (retry offered)
                             └ leave → confirm discard
```

### Bulk run (three lists)

```text
browsing ─Select→ selecting(0) ─pick/select all (≤ bulkLimit)→ selecting(k)
selecting(k) ─action→ confirm? (none | simple | explain | typed count) ─ok→ sending
sending ─200 BulkResult→ results: summary per outcome; done items deselected; others kept
        └ network failure → "outcome unknown"; list refreshed; selection kept; no retry
any page/size/search/filter/sort change or Done → browsing (selection cleared, announced)
```

### Copy over alias domains (single)

```text
detail ─Copy→ explain dialog ─confirm→ sending (If-Match) ─200→ copy results (per alias domain)
                                                        ├ 412 → alias reloaded → explain dialog again
                                                        ├ 409 not-primary-domain-alias → message
                                                        └ 404 → vanished → list
```

## 8. Translations

### Enumeration scope manifest additions (`src/i18n/coverage.json`, research D19)

Each listed value needs keys in en-gb, cs-cz and sk-sk. Values already listed by UI 001–003 are not
repeated.

| Enumeration | Values this feature appends |
|---|---|
| `AuditEventType` | `aliasCreation`, `aliasUpdate`, `aliasDeletion`, `aliasDomainCreation`, `aliasDomainUpdate`, `aliasDomainDeletion`, `resourceCreation`, `resourceUpdate`, `resourceDeletion`, `mailboxSenderSettingsUpdate` |
| `AuditTarget.type` | `alias`, `aliasDomain`, `resource`, `mailboxSenderSettings` |
| `AuditFailureReason` | `permissionDenied` and `notFound`, if not yet listed. 004 refusals use the shared values (API 004 research R20), and UI 002 lists the others. |
| `ValidationRuleCode` | `conflictsWith`, `reserved`, `immutable`, if not yet listed. The other codes of §6 are UI 001's. |
| problem types | `domain-alias-limit-reached`, `alias-domain-already-exists`, `not-primary-domain-alias`, and `address-in-use`, `attribute-not-permitted`, `permission-flag-required`, `temporary-failure` if not yet listed |

### Closed enumerations added to `ENUM_NAMESPACES` (fully required, `enums.<name>.<value>`)

| Enumeration | Values |
|---|---|
| `AliasKind` | `regular`, `catchAll` |
| `AliasDestinationType` | `addresses`, `discard`, `learnSpam`, `learnHam` |
| `ResourceKind` | `location`, `thing`, `group` |
| `ResourceBookingRule` | `alwaysFree`, `unlimited`, `limited` |
| `MailboxSenderPermission.type` | `address`, `domain`, `anyAddress` |
| `MailboxImplicitSenderAddress.source` | `ownAddress`, `aliasDomainAddress`, `alias` |
| `AliasCopyOutcome.outcome` | `created`, `skipped`, `failed` |
| `AliasCopyOutcome.reason` | `addressInUse`, `aliasLimitReached`, `destinationNotPermitted` |
| `AliasDomainCreationReport.rateLimit` | `applied`, `notRequested`, `failed` |
| `AliasDomainCreationReport.dkimKey` | `created`, `alreadyExisted`, `notRequested`, `failed` |
| `AliasDomainCreationReport.dkimDnsPublication` | `published`, `noZone`, `failed`, `notConfigured`, `skipped` |
| `AliasDomainCreationReport.groupwareDirectoryUpdate` | `done`, `failed`, `groupwareDisabled` |

`BulkItemOutcome` and the rate limit frames are already fully required by UI 002.

### Legacy keys reused (`src/i18n/legacy-map.json`, research R20)

`*` marks `stripMarkup: true`. `†` marks `locales: ["cs-cz", "sk-sk"]`, where en-gb comes from the app
layer. `‡` marks a value missing upstream in sk-sk (and in cs-cz where noted), which that locale's app
layer supplies. Keys that UI 002 or UI 003 already mapped are reused through their existing app key.

| Area | Legacy keys |
|---|---|
| Navigation and titles | `mailbox.aliases`, `mailbox.domain_aliases`†, `mailbox.resources`, `mailbox.add_alias`, `mailbox.add_domain_alias`†, `mailbox.add_resource`, `edit.edit_alias_domain` |
| Alias list and detail | `mailbox.catch_all`, `mailbox.alias`, `mailbox.target_address`, `mailbox.target_domain`, `mailbox.sogo_visible_y`, `mailbox.sogo_visible_n`, `mailbox.toggle_all`, `mailbox.activate`, `mailbox.deactivate`, `mailbox.remove`, `mailbox.add_alias_expand` |
| Alias form | `add.alias_address`, `add.target_address`, `add.goto_null`, `add.goto_spam`*, `add.goto_ham`*, `add.internal`‡, `edit.internal_info`‡, `edit.sender_allowed`‡, `edit.sender_allowed_info`‡, `edit.sogo_visible`, `edit.sogo_visible_info`, `edit.public_comment`, `edit.private_comment` |
| Alias domains | `add.alias_domain`, `add.target_domain`, `mailbox.alias_domain_backupmx`, `admin.dkim_domains_selector`, `admin.dkim_key_length`, `ratelimit.second`, `ratelimit.minute`, `ratelimit.hour`, `ratelimit.day` |
| Resources | `mailbox.booking_null`, `mailbox.booking_ltnull`, `mailbox.booking_custom`, `mailbox.booking_0_short`, `mailbox.booking_lt0_short`, `mailbox.booking_custom_short`, `add.kind`, `add.multiple_bookings`, `add.description` |
| Send as | `edit.sender_acl`, `edit.sender_acl_info`*, `edit.sender_acl_disabled`*, `edit.extended_sender_acl`, `edit.extended_sender_acl_info`* |
| Permission labels | `acl.alias_domains`, `acl.alias_external_goto`‡ (cs-cz too), `acl.extend_sender_acl`, `acl.ratelimit` |
| Messages | `danger.alias_empty`, `danger.goto_empty`, `danger.goto_invalid`, `danger.alias_invalid`, `danger.is_alias_or_mailbox` (fallback when `holder` is unknown), `danger.max_alias_exceeded`, `danger.external_goto_denied`‡ (cs-cz too), `danger.aliasd_targetd_identical`, `danger.alias_domain_invalid`, `danger.target_domain_invalid`, `danger.extra_acl_invalid`, `danger.extra_acl_invalid_domain`, `danger.resource_invalid`, `danger.description_invalid`, `success.alias_added` (`{0}` address, `{1}` ID), `success.alias_modified`, `success.alias_removed`, `success.aliasd_added`, `success.aliasd_modified`, `success.alias_domain_removed`, `success.resource_added`, `success.resource_removed`, `warning.is_not_primary_alias` |

**Not reused**, with new keys instead (research R20):

- `mailbox.alias_domain_alias_hint`: its meaning changes, because it names the legacy "Filters" tab;
- `add.alias_address_info`: it names the product, and the new key takes `{productName}`;
- `success.resource_modified`: it says "mailbox".

### New key namespaces

- `aliases.*`, `aliasDomains.*`, `resources.*`, `senderSettings.*`: titles, field labels and
  explanations, states, confirmations, results and notes;
- `aliases.form.errors.*`, `aliasDomains.form.errors.*`, `resources.form.errors.*`,
  `senderSettings.errors.*`: the form-context overrides of research R17;
- `validation.<code>.<param>.<value>` sub-keys: for example `validation.notEligible.kind.resource`
  and `validation.tooLong.unit.bytes`;
- `problem.address-in-use.holder.<holder>` and
  `problem.alias-domain-already-exists.existingKind.<kind>`;
- `auditLog.eventTypes.<value>` and `auditLog.targets.<value>`, under UI 001's naming in
  `src/features/audit-log/labels.ts`, for the values above.
