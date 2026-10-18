# Data Model: Routing and Address Rewriting

**Feature**: `specs/009-routing-address-rewriting` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

The app owns no persistent data. This document defines what this feature adds to UI 001's model
(UI 001 [data-model.md](../001-sign-in-app-shell/data-model.md)):

- the API data it consumes, as generated types;
- its app-defined view models;
- the server-state cache (query keys, freshness, invalidation);
- client state (none new in Pinia or storage);
- the route map and the address parameters of its lists;
- client-side validation;
- the state machines of the connection test, credentials, transport batches, Relayhost sections,
  bulk actions and deletions.

Decisions are justified in [research.md](./research.md). Contract shapes are not restated: types
come from `src/api/generated/schema.ts` through `@/api` (UI 001 R7). Generated names were checked
against the baseline bundle (research R1).

## 1. API data consumed

Generated root types, re-exported from `src/api/index.ts` and imported from `@/api`.

| Type | Operation(s) | Used by | Notes |
|---|---|---|---|
| `RoutingCapabilities` | `getRoutingCapabilities` | every routing screen, both sections | `administration` is `null` for domain administrators (research R3) |
| `Relayhost`, `RelayhostCreateRequest`, `RelayhostPatch` | `listRelayhosts`, `getRelayhost`, `createRelayhost`, `updateRelayhost`, `deleteRelayhost` | relayhost screens, admin relayhost picker | `passwordSet`, never a password; `usage` is outside `etag` |
| `RelayhostUsageEntry` | `listRelayhostUsage` | usage view, deletion impact | `kind` `domain` or `mailbox` |
| `RelayhostChoice` | `listRelayhostChoices` | domain administrators' picker | id, host, active only |
| `RelayhostBulkActionRequest` | `applyRelayhostBulkAction` | relayhost list | `targets: BulkTarget[]` |
| `DomainRelayhostAssignment`, `MailboxRelayhostAssignment`, `RelayhostReference`, `RelayhostAssignmentReplaceRequest` | `getDomainRelayhostAssignment`, `replaceDomainRelayhostAssignment`, `getMailboxRelayhostAssignment`, `replaceMailboxRelayhostAssignment` | Relayhost sections | `RelayhostReference.state`: `active`, `inactive`, `dangling` |
| `Transport`, `TransportCreateRequest`, `TransportPatch`, `TransportReference` | `listTransports`, `getTransport`, `createTransport`, `updateTransport`, `deleteTransport` | transport screens, shared next hop lookup | writes return `meta.affectedTransports` |
| `TransportBulkActionRequest` | `applyTransportBulkAction` | transport list | — |
| `RoutingConnectionTestRequest`, `RoutingConnectionTestResult`, `RoutingConnectionTestStep` | `testRelayhostConnection`, `testTransportConnection` | test page | never cached (research R11) |
| `BccMap`, `BccMapType`, `BccMapCreateRequest`, `BccMapPatch`, `BccMapBulkActionRequest` | `listBccMaps`, `getBccMap`, `createBccMap`, `updateBccMap`, `deleteBccMap`, `applyBccMapBulkAction` | BCC screens | `orphaned` (always `false` for domain administrators) |
| `BccDestinationChoice`, `BccDestinationChoiceKind` | `listBccDestinationChoices` | BCC destination picker | infinite list |
| `RecipientMap`, `RecipientMapCreateRequest`, `RecipientMapPatch`, `RecipientMapBulkActionRequest` | recipient map operations | recipient map screens | — |
| `TlsPolicyMap`, `TlsPolicy`, `TlsPolicyMapCreateRequest`, `TlsPolicyMapPatch`, `TlsPolicyMapBulkActionRequest` | TLS policy map operations | TLS policy map screens | `policy` is sent in lower case |
| `ForwardingHost`, `ForwardingHostCreateRequest`, `ForwardingHostCreationResult`, `ForwardingHostPatch`, `ForwardingHostBulkActionRequest` | forwarding host operations | forwarding host screens | the address is the path identifier |
| `BulkTarget`, `BulkResult`, `BulkItemResult`, `BulkItemOutcome` | every bulk operation | bulk wiring (UI 002's `useBulkSelection`, `BulkResultSummary`) | — |
| `RoutingConflictProblem`, `RoutingPermissionFlagProblem`, `Problem`, `ValidationProblem` | errors | `src/features/routing/problems.ts` | extension members `field`, `conflictingId`, `nextHop`, `transportIds`, `requiredFlags` |
| `Identity`, `PermissionFlags`, `Scope` | `getIdentity` (UI 001) | access, sections, domain filter | flags `bccMaps`, `domainRelayhost`, `mailboxRelayhost` |
| `ListMeta` | every list | lists | — |

List parameter types are aliases of the generated operation parameters, for example
`type RelayhostListParams = NonNullable<operations['listRelayhosts']['parameters']['query']>`, as in
UI 001 data-model §3. They are not hand-written shapes (constitution I).

Not called by this feature: `listAuditEvents` (the History links only navigate to UI 001's audit
log screen, which calls it), and UI 002's and UI 003's domain and mailbox operations (their pages
host the sections).

## 2. App-defined models

None of these restates an API shape; each is derived from API data or app constants.

### RoutingScreen (`src/features/routing/screens.ts`)

The six screens in the order of FR-001. Each has `id`, `routeName`, `labelKey`, `introKeys` (the
legacy explanatory texts of FR-008), `roles` and `status` (`'pending'` until the story that builds
the screen sets it to `'available'`, as UI 001 does with catalogue entries). The index page and the
section navigation list only available screens the user may open. When a user may open none yet
(for example a domain administrator before US5 is built), `/routing` renders UI 001's
`PlaceholderPage` for the `routing` entry, with the classic interface links for the role, instead of
an empty page.

| id | route | label (legacy key) | intro keys | roles |
|---|---|---|---|---|
| `relayhosts` | `routing-relayhosts` | `admin.relayhosts` | `admin.relayhosts_hint` (rich), `routing.relayhosts.alsoCalledRelayhosts` | admin |
| `transports` | `routing-transports` | `admin.transport_maps` | `admin.transports_hint` (rich) | admin |
| `tlsPolicyMaps` | `routing-tls-policy-maps` | `mailbox.tls_policy_maps` | `mailbox.tls_policy_maps_info` (rich), `mailbox.tls_policy_maps_enforced_tls` (rich) | admin |
| `recipientMaps` | `routing-recipient-maps` | `mailbox.recipient_maps` | `mailbox.recipient_map_info` | admin |
| `bccMaps` | `routing-bcc-maps` | `mailbox.bcc_maps` | `mailbox.bcc_info` (rich), `routing.bccMaps.spamAndTagsInfo` | admin, domainAdmin |
| `forwardingHosts` | `routing-forwarding-hosts` | `admin.forwarding_hosts` | `admin.forwarding_hosts_hint` | admin |

### Access predicates (`src/features/routing/access.ts`)

Pure functions of `Identity`, with a table-driven unit test:

| Predicate | True when |
|---|---|
| `canOpenScreen(identity, screen)` | `screen.roles` includes the role |
| `canWriteRouting(identity)` | role is `admin` |
| `canWriteBccMaps(identity)` | `admin`, or `domainAdmin` with `permissions.bccMaps` |
| `canEditDomainRelayhost(identity)` | `admin`, or `domainAdmin` with `permissions.domainRelayhost` |
| `canEditMailboxRelayhost(identity)` | `admin`, or `domainAdmin` with `permissions.mailboxRelayhost` |
| `canListRelayhostChoices(identity)` | `admin`, or `domainAdmin` with either relayhost flag |
| `canSeeHistory(identity)` | role is `admin` |

### EntryList columns (`components/<area>/*-columns.ts`)

`{ key, labelKey, render(entry) → text or slot name, sortKey?, cardOnly?, tableOnly? }` plus
`actions(entry, identity) → EntryAction[]`, where `EntryAction` is `{ id: 'edit' | 'test' |
'activate' | 'deactivate' | 'enableSpamFilter' | 'disableSpamFilter' | 'history' | 'delete',
labelKey, to? | run? }`. `sortKey` values are the generated sort enumeration values.

### CredentialIntent (`logic/credentials.ts`)

| Field | Type | Rule |
|---|---|---|
| `storedUsername` | `string \| null` | as read (`username`) |
| `passwordStored` | boolean | as read (`passwordSet`) |
| `username` | string | the field |
| `password` | string | the field; memory only; cleared after save, refusal and unmount (research R7) |
| `removePassword` | boolean | the pending "Remove password" action |

`toPatch(intent)` and `toCreate(intent)` implement the patch rules table of research R7. Derived
notes: `willRemoveWithUsername` (username cleared, `passwordStored`, no password typed, no
removal) and `removalPending`.

### SharedNextHopView (`composables/useSharedNextHop.ts`)

`{ nextHop, others: Transport[] (without the edited one), total, sharedUsername, sharedPasswordSet }`
from `listTransports?nextHop=`. Drives the notice, the pre-save confirmation and the "will use
that next hop's credentials" note (research R10).

### DestinationBatch (`composables/useTransportCreateBatch.ts`)

| Field | Type | Rule |
|---|---|---|
| `destinations` | `string[]` | split on line breaks, commas, semicolons and spaces, or on line breaks only when MX-based is checked; trimmed, deduplicated (case-insensitive), order kept (`logic/destinations.ts`) |
| `results` | `{ destination, outcome: 'created' \| 'refused' \| 'outcomeUnknown' \| 'notSent', transport?, reasonKey?, conflictingId? }[]` | one per destination, in order |
| `affectedOthers` | `TransportReference[]` | union of `meta.affectedTransports`, minus the batch's own creations |
| `stoppedBy` | `ApiProblem \| null` | a refusal of a non-destination member, a next-hop conflict or a network failure |

### RelayhostSectionView (`logic/relayhost-section.ts`)

Derived from `DomainRelayhostAssignment` or `MailboxRelayhostAssignment` plus the edit
permission:

| Field | Derivation |
|---|---|
| `assigned` | `{ id, host, state }` or `null` ("None / inherit") |
| `stateNote` | `inactive` → no effect until activated (mailbox: the domain's relayhost applies meanwhile); `dangling` → "no longer exists (#id), no effect" |
| `domainAssigned` | mailbox only: `domainRelayhost` |
| `effective` | mailbox only: `effectiveRelayhost` → `{ host, source }` or "Direct delivery" |
| `credentialsNote` | mailbox only, when both `relayhost.state` and `domainRelayhost.state` are `active` (spec consistency change 9): `'domainCredentials'` when `credentialsRelayhost?.source === 'domain'`, `'noCredentials'` when `credentialsRelayhost` is `null`; otherwise `null` |
| `editable` | `canEditDomainRelayhost` or `canEditMailboxRelayhost` |
| `missingFlag` | `domainRelayhost` or `mailboxRelayhost` when a domain administrator lacks it |

### Connection test views (`logic/test-summary.ts`, `logic/transcript.ts`)

- `TestSummaryView`: `{ verdict: 'accepted' | 'notAccepted', step, reasonKey, lastReply, server:
  { host, port, viaMx, nextHop } | null, tls, login, sender, recipient, startedAt, durationSeconds }`.
- `StepTimeline`: the eight steps in contract order, each `passed | failed | notReached |
  notOffered | notConfigured`:
  - steps before `step` are `passed`, except `tls` when `tls` is `false` (`notOffered`) and `login`
    when `login` is `notConfigured` (`notConfigured`);
  - `step` is `passed` when `accepted`, otherwise `failed`;
  - steps after it are `notReached`.
- `TranscriptLine` marker: `client` → `C:`, `server` → `S:`, `info` → `*`. `toPlainText(lines)` joins
  `"<marker> <text>"` with `\n` for the copy action.

### BulkActionCatalogue (`logic/bulk-actions.ts`)

Per collection: the action values (from the generated `*BulkActionRequestActionValues`), their
label keys, whether they need confirmation (`delete`: typed count; `deactivate`: one explicit
confirmation; `activate` on a selection that contains a `*` transport: one explicit confirmation),
and `targetOf(entry) → { id, version }`, where `version` is `entry.etag` without its surrounding
quotes (`BulkTarget.version`, as UI 002 D22) and `id` is the numeric ID as a string, or the stored
address, unencoded, for forwarding hosts. `useBulkSelection` receives `capabilities.bulkLimit`; at the
limit, further selection is disabled with a message that states it (conventions), and the selection
never exceeds the current page.

### ForwardingHostResults (`composables/useForwardingHostResults.ts`)

A one-shot, in-memory `ForwardingHostCreationResult` handed from the create page to the list, read
once and cleared (research R17). Never in history state or storage.

## 3. Server-state cache

### Query keys

Added to `src/api/query/keys.ts`. Default `staleTime` 30 s (UI 001 R9) unless stated.

| Key | Operation | staleTime | Fetched when |
|---|---|---|---|
| `['routing-capabilities']` | `getRoutingCapabilities` | 5 min | on entering any routing page (the Relayhost sections do not read it) |
| `['relayhosts','list',RelayhostListParams]` | `listRelayhosts` | 30 s | relayhost list |
| `['relayhosts','detail',relayhostId]` | `getRelayhost` | 30 s | relayhost edit and test pages |
| `['relayhosts','usage',relayhostId,UsageParams]` | `listRelayhostUsage` | 30 s | usage view; deletion impact with `{kind, limit: 10}` |
| `['relayhosts','picker',{q}]` | `listRelayhosts` (infinite) | 30 s | administrator's relayhost picker |
| `['relayhost-choices',{q}]` | `listRelayhostChoices` (infinite) | 30 s | domain administrator's relayhost picker |
| `['relayhost-assignments','domain',domain]` | `getDomainRelayhostAssignment` | 30 s | domain Relayhost section |
| `['relayhost-assignments','mailbox',address]` | `getMailboxRelayhostAssignment` | 30 s | mailbox Relayhost section |
| `['transports','list',TransportListParams]` | `listTransports` | 30 s | transport list |
| `['transports','detail',transportId]` | `getTransport` | 30 s | transport edit and test pages |
| `['transports','next-hop',nextHop]` | `listTransports` with `nextHop`, `limit: 100` | 0 | next hop field blur; before a save (research R10) |
| `['bcc-maps','list',BccMapListParams]` | `listBccMaps` | 30 s | BCC list |
| `['bcc-maps','detail',bccMapId]` | `getBccMap` | 30 s | BCC entry page |
| `['bcc-destination-choices',ChoiceParams]` | `listBccDestinationChoices` (infinite) | 30 s | BCC destination picker |
| `['recipient-maps','list',params]`, `['recipient-maps','detail',id]` | recipient map reads | 30 s | recipient map pages |
| `['tls-policy-maps','list',params]`, `['tls-policy-maps','detail',id]` | TLS policy map reads | 30 s | TLS policy map pages |
| `['forwarding-hosts','list',params]`, `['forwarding-hosts','detail',address]` | forwarding host reads | 30 s | forwarding host pages |

The connection test has no key: its mutation uses `gcTime: 0` and is reset when the page unmounts.

### Invalidation after mutations

`D(x)` is UI 002's `['domains','detail',name]` (ASCII name) or UI 003's
`['mailboxes','detail',address]` (lower-cased address), as their data models define them; the first
setup task confirms the implemented names.

| Mutation | On success | On 412 |
|---|---|---|
| `createRelayhost` | invalidate `['relayhosts']`, `['relayhost-choices']` | — |
| `updateRelayhost` | write `['relayhosts','detail',id]`; invalidate the relayhost lists, picker and choices, and `['relayhost-assignments']` (host and state are shown there) | keep input; refetch detail; mark changed fields |
| `deleteRelayhost` | remove the detail; invalidate `['relayhosts']`, `['relayhost-choices']`, `['relayhost-assignments']` and the prefixes `['domains','detail']`, `['domains','list']`, `['mailboxes','detail']`, `['mailboxes','list']` (cleared assignments change the tags of details and list entries) | refetch; confirm the deletion again |
| `applyRelayhostBulkAction` | as update, plus as delete when the action is `delete` | per item `outdated`: stays selected |
| `replaceDomainRelayhostAssignment` | write the domain assignment; invalidate `['relayhost-assignments','mailbox']`, `['relayhosts','list']`, `['relayhosts','detail']`, `['relayhosts','usage']`, `D(domain)` and `['domains','list']` | keep the choice; refetch; mark changed |
| `replaceMailboxRelayhostAssignment` | write the mailbox assignment; invalidate `['relayhosts','list']`, `['relayhosts','detail']`, `['relayhosts','usage']`, `D(mailbox)` and `['mailboxes','list']` | keep the choice; refetch; mark changed |
| `createTransport`, `updateTransport`, `deleteTransport`, `applyTransportBulkAction` | invalidate `['transports']` (other transports' tags change with shared credentials) | update: keep input, refetch, mark; delete: confirm again |
| `createBccMap`, `updateBccMap`, `deleteBccMap`, `applyBccMapBulkAction` | invalidate `['bcc-maps']` | as above |
| recipient map writes | invalidate `['recipient-maps']` | as above |
| TLS policy map writes | invalidate `['tls-policy-maps']` | as above |
| `createForwardingHost`, `updateForwardingHost`, `deleteForwardingHost`, `applyForwardingHostBulkAction` | invalidate `['forwarding-hosts']` | as above |
| `testRelayhostConnection`, `testTransportConnection` | nothing | — |

Writes that return the entry write it into its detail key with `setQueryData` before the lists are
invalidated. No password is ever in a response, so nothing has to be stripped before caching.
`createRelayhost`, `updateRelayhost`, `createTransport` and `updateTransport` are direct client calls,
not `useMutation`, because their bodies can carry a password and the mutation cache would keep it
(conventions "Secrets", research R7); their callers apply the cache updates of this table by hand.

## 4. Client state

- **Pinia**: nothing new.
- **Device storage**: nothing new. UI 001 data-model §4's allowlist still holds, and its unit test
  still passes (FR-075, constitution V).
- **Memory only**: typed passwords (form state only, never a query or mutation cache), the test
  result (component state), the batch results (composable state) and the forwarding host results
  (one-shot feature value).
- **No polling**: nothing in this feature refetches on an interval; the connection test's watchdog
  is a single timer for one request, not polling (conventions "Polling").

## 5. Route map

Base `/ng/`. Every route has `meta.navEntry: 'routing'`. "Roles" is `meta.roles` (research R2);
routes without it are open to every role the catalogue entry admits (admins and domain
administrators). Every component is a lazy chunk under `src/features/routing/pages/`.

| Name | Path | Roles | Title key | Component |
|---|---|---|---|---|
| `routing` | `/routing` | — | `nav.routing` | `RoutingIndexPage.vue` |
| `routing-relayhosts` | `/routing/relayhosts` | admin | `routing.relayhosts.title` | `relayhosts/RelayhostsPage.vue` |
| `routing-relayhost-create` | `/routing/relayhosts/new` | admin | `routing.relayhosts.createTitle` | `relayhosts/RelayhostCreatePage.vue` |
| `routing-relayhost-edit` | `/routing/relayhosts/:relayhostId(\\d+)` | admin | `routing.relayhosts.editTitle` | `relayhosts/RelayhostEditPage.vue` |
| `routing-relayhost-usage` | `/routing/relayhosts/:relayhostId(\\d+)/usage` | admin | `routing.relayhosts.usageTitle` | `relayhosts/RelayhostUsagePage.vue` |
| `routing-relayhost-test` | `/routing/relayhosts/:relayhostId(\\d+)/test` | admin | `routing.connectionTest.title` | `ConnectionTestPage.vue` (`kind: 'relayhost'`) |
| `routing-transports` | `/routing/transports` | admin | `routing.transports.title` | `transports/TransportsPage.vue` |
| `routing-transport-create` | `/routing/transports/new` | admin | `routing.transports.createTitle` | `transports/TransportCreatePage.vue` |
| `routing-transport-edit` | `/routing/transports/:transportId(\\d+)` | admin | `routing.transports.editTitle` | `transports/TransportEditPage.vue` |
| `routing-transport-test` | `/routing/transports/:transportId(\\d+)/test` | admin | `routing.connectionTest.title` | `ConnectionTestPage.vue` (`kind: 'transport'`) |
| `routing-tls-policy-maps` | `/routing/tls-policy-maps` | admin | `routing.tlsPolicyMaps.title` | `tls-policy-maps/TlsPolicyMapsPage.vue` |
| `routing-tls-policy-map-create` | `/routing/tls-policy-maps/new` | admin | `routing.tlsPolicyMaps.createTitle` | `tls-policy-maps/TlsPolicyMapFormPage.vue` |
| `routing-tls-policy-map-edit` | `/routing/tls-policy-maps/:tlsPolicyMapId(\\d+)` | admin | `routing.tlsPolicyMaps.editTitle` | `tls-policy-maps/TlsPolicyMapFormPage.vue` |
| `routing-recipient-maps` | `/routing/recipient-maps` | admin | `routing.recipientMaps.title` | `recipient-maps/RecipientMapsPage.vue` |
| `routing-recipient-map-create` | `/routing/recipient-maps/new` | admin | `routing.recipientMaps.createTitle` | `recipient-maps/RecipientMapFormPage.vue` |
| `routing-recipient-map-edit` | `/routing/recipient-maps/:recipientMapId(\\d+)` | admin | `routing.recipientMaps.editTitle` | `recipient-maps/RecipientMapFormPage.vue` |
| `routing-bcc-maps` | `/routing/bcc-maps` | — | `routing.bccMaps.title` | `bcc-maps/BccMapsPage.vue` |
| `routing-bcc-map-create` | `/routing/bcc-maps/new` | — (page shows "no access" without `canWriteBccMaps`) | `routing.bccMaps.createTitle` | `bcc-maps/BccMapCreatePage.vue` |
| `routing-bcc-map-edit` | `/routing/bcc-maps/:bccMapId(\\d+)` | — (read-only without `canWriteBccMaps`) | `routing.bccMaps.entryTitle` | `bcc-maps/BccMapEditPage.vue` |
| `routing-forwarding-hosts` | `/routing/forwarding-hosts` | admin | `routing.forwardingHosts.title` | `forwarding-hosts/ForwardingHostsPage.vue` |
| `routing-forwarding-host-create` | `/routing/forwarding-hosts/new` | admin | `routing.forwardingHosts.createTitle` | `forwarding-hosts/ForwardingHostCreatePage.vue` |
| `routing-forwarding-host-edit` | `/routing/forwarding-hosts/:forwardingHostAddress` | admin | `routing.forwardingHosts.entryTitle` | `forwarding-hosts/ForwardingHostEditPage.vue` |

The literal `new` segments are declared before the parameter routes.

The Relayhost sections live in the earlier features' screens (research R9):

| Screen | Address | How |
|---|---|---|
| UI 002 domain page `domain-detail` | `/domains/:domain?edit=relayhost` opens the section form | section ID `relayhost` added to the page's section list, after Groupware; `DomainRelayhostSection` mounted with `defineAsyncComponent` |
| UI 003 mailbox layout `mailbox-detail` | `/mailboxes/:address/relayhost`, route `mailbox-relayhost` | child route record `mailboxRelayhostRoute` exported by `src/features/routing/index.ts` and listed in `src/features/mailboxes/routes.ts`; entry `relayhost` in `src/features/mailboxes/sections.ts`; `to` of the relayhost entry in `ManagedSettingsGroup.vue` |

### Address parameters of the lists

Defaults are omitted from the address. Invalid values fall back to the default and the address is
normalised with `router.replace` (UI 001 R20). Every list also has `page` (≥ 1, default 1, maps to
`offset = (page − 1) × size`) and `size` (25, 50 or 100 and at most `pageSize.maximum`, default 25,
maps to `limit`). `order` is `asc` or `desc`, default `asc` for every list of this feature.

| List | Param | Type | Default | Maps to |
|---|---|---|---|---|
| Relayhosts | `q` | string ≤ 255 | — | `q` (host, username) |
| | `active` | `true`, `false` | — | `active` |
| | `inUse` | `true`, `false` | — | `inUse` |
| | `sort` | `id`, `host`, `username`, `active`, `domainCount`, `mailboxCount` | `id` | `sort` |
| Relayhost usage | `q` | string ≤ 255 | — | `q` (name) |
| | `kind` | `domain`, `mailbox` | — | `kind` |
| | `sort` | `kind`, `name` | `kind` | `sort` |
| Transports | `q` | string ≤ 255 | — | `q` (destination, next hop, username) |
| | `active`, `mxBased` | `true`, `false` | — | `active`, `mxBased` |
| | `nextHop` | string ≤ 255 | — | `nextHop` (exact, case-insensitive) |
| | `sort` | `id`, `destination`, `nextHop`, `username`, `active`, `mxBased` | `id` | `sort` |
| BCC maps | `q` | string ≤ 255 | — | `q` (local and BCC destination) |
| | `type` | `sender`, `recipient` | — | `type` |
| | `active` | `true`, `false` | — | `active` |
| | `domain` | repeatable string ≤ 255 (≤ 100) | — | `domain` (exploded) |
| | `orphaned` | `true`, `false` (administrators only; ignored otherwise) | — | `orphaned` |
| | `sort` | `id`, `type`, `localDestination`, `bccDestination`, `domain`, `active`, `createdAt`, `modifiedAt` | `id` | `sort` |
| Recipient maps | `q` | string ≤ 255 | — | `q` (both destinations) |
| | `active` | `true`, `false` | — | `active` |
| | `sort` | `id`, `originalDestination`, `newDestination`, `active`, `createdAt`, `modifiedAt` | `id` | `sort` |
| TLS policy maps | `q` | string ≤ 255 | — | `q` (destination, parameters) |
| | `policy` | repeatable `TlsPolicy` (≤ 8) | — | `policy` (exploded) |
| | `active` | `true`, `false` | — | `active` |
| | `sort` | `id`, `destination`, `policy`, `active`, `createdAt`, `modifiedAt` | `id` | `sort` |
| Forwarding hosts | `q` | string ≤ 255 | — | `q` (address, source) |
| | `spamFilter` | `true`, `false` | — | `spamFilter` |
| | `source` | string ≤ 255 | — | `source` (exact) |
| | `sort` | `address`, `source`, `spamFilter` | `address` | `sort` |

The relayhost picker and the BCC destination picker keep their search in component state, not in
the address: they are parts of a form, not lists (FR-004 covers lists).

## 6. Client-side validation

These checks run before submitting; the server's field errors are always shown too (FR-065).
"Cap" means the value from `GET /capabilities/routing` (research R3). Fields whose limit the
capabilities read does not provide get no client-side maximum; the API's `tooLong` is shown at the
field (gap G36).

| Field | Rule | Message key |
|---|---|---|
| Relayhost host, transport next hop | required after trimming; ≤ cap `maxLengths.host` / `maxLengths.nextHop` | `validation.required`, `validation.tooLong` |
| Host or next hop ending in `:465` | warning only, the save is allowed (US1-AS4) | `routing.common.port465Warning` |
| Username | ≤ cap `maxLengths.username`; a `:` is refused by the API (`invalidCharacter`) | `validation.tooLong`, `validation.invalidCharacter` |
| Password | ≤ cap `maxLengths.password`; never trimmed in the client (the API trims) | `validation.tooLong` |
| Transport destinations (create) | at least one after splitting; each ≤ cap `maxLengths.transportDestination` | `validation.required`, `validation.tooLong` |
| Destination `*` | warning only (FR-040, US3-AS7) | `routing.transports.wildcardWarning` |
| BCC local destination | required, chosen from the picker; ≤ cap `bccMaps.localDestinationMaxLength` | `validation.required` |
| BCC destination | required; ≤ cap `bccMaps.bccDestinationMaxLength`; one address: no `,`, `;` or whitespace between parts (US5-AS3) | `validation.required`, `add.bcc_dest_format` (rich) |
| Recipient map destinations | required; ≤ cap `maxLengths.recipientMapDestination` | `validation.required`, `validation.tooLong` |
| TLS destination, parameters | destination required; each ≤ cap `maxLengths.tlsPolicyDestination` / `tlsPolicyParameters` | `validation.required`, `validation.tooLong` |
| TLS policy | required; one of cap `tlsPolicies` | `validation.required` |
| Forwarding host | required after trimming; no client-side maximum (API `tooLong`) | `validation.required`, `validation.tooLong` |
| Test sender, recipient | optional; when given: one `@` with text on both sides and no whitespace (US4-AS6); no client-side maximum (API `tooLong`) | `validation.format.email`, `validation.tooLong` |
| List search `q` | no client-side maximum (API `tooLong` on `q`, shown at the search field) | `validation.tooLong` |

## 7. State machines

### Connection test (`composables/useConnectionTest.ts`)

```text
idle ──run (fields valid)──► running ──200──► result (summary + transcript)
  ▲            │                 │ ──422──► idle (field errors)
  │            │                 │ ──other problem──► idle (message)
  │            │                 └─(total + 15 s)──► noResult ("may still have sent")  [request aborted]
  │            └─leave page──► (aborted, reset)
  └────────────── run again (from result or noResult) ─────────────────────────────────┘
```

`running` disables Run and announces progress at the start and after `stepTimeoutSeconds`. Leaving
the page in any state aborts the request and discards the result.

### Credential intent (`logic/credentials.ts`)

```text
stored ──type password──► replacing ──clear field──► stored
  │ ──"Remove password"──► removalPending ──"Undo"──► stored
  │ ──clear username──► usernameCleared (note: password removed on save) ──restore username──► stored
any ──save ok / save refused / unmount──► password field emptied
```

### Transport batch creation (`composables/useTransportCreateBatch.ts`)

```text
validate ─► [confirm shared next hop?] ─► for each destination, in order:
    POST ─201─► created
         ─422 (destination only) / 409 routing-entry-exists (field destination)─► refused, continue
         ─422 (other member) / 409 next-hop-*─► stop: errors at fields; rest "not sent"
         ─network failure─► stop: this one "outcome unknown"; rest "not sent"
end ─► remove created from the field; keep refused; announce "n of m created";
       list affected other transports (meta.affectedTransports minus own creations)
```

### Relayhost section (`components/sections/*RelayhostSection.vue`)

On the domain page, "editing" is UI 002's `edit=relayhost` query state; on the mailbox page, the
section is its own child route and "editing" is its form.

```text
viewing ──Edit (permitted)──► editing ──Save──► saving ──200──► viewing (announce)
   ▲                            │  │               │ ──412──► editing (choice kept, changed value marked)
   │                            │  │               │ ──403 permission-flag-required──► viewing read-only (flag named; identity refreshed)
   │                            │  └─Cancel / leave with changes──► confirm ──► viewing
   └──────────────────────────── (422 notFound: relayhost deleted meanwhile → field error, editing)
```

### Bulk action (`composables/useRoutingBulk.ts`)

```text
browsing ──Select──► selecting (page only, ≤ min(bulkLimit, size)) ──action──► [confirm: typed count for
delete; explicit for deactivate and for activating a * transport] ──► sending ──200──► results
(done cleared; notFound cleared; refused/outdated/failed stay selected) ─► lists invalidated
                                         └─network failure──► "outcome unknown" (no retry)
page / filter / sort / size change ──► selection cleared
```

### Single deletion (`useEntryForm` and list actions)

```text
Delete ─► dialog (impact: relayhost usage names and counts; others: the entry's main values)
       ─confirm─► DELETE with If-Match ─204─► list (announce) ─412─► reload, dialog again ─404─► "no longer exists"
```
