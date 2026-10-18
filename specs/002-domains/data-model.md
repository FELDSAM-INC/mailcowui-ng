# Data Model: Domains

**Feature**: `specs/002-domains` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

This app owns no persistent data. This document defines what UI feature 002 adds to UI 001's data
model ([data-model](../001-sign-in-app-shell/data-model.md)):

- the API data it consumes, as generated types;
- the app-defined view models;
- the query keys and invalidation;
- the form models;
- the routes and list address parameters;
- the client-side validation rules;
- the state machines;
- the translation namespaces;
- the action areas that later features extend.

Contract shapes are not restated. Types come from `src/api/generated/schema.ts` through `@/api`
(UI 001 R7). Decisions are justified in [research.md](./research.md).

## 1. API data consumed

These are generated root types, imported from `@/api`.

| Type | Operation(s) | Used by | Notes |
|---|---|---|---|
| `Domain`, `DomainUsage`, `DomainRateLimit`, `DomainRelayhost`, `DomainTagList`, `DomainFooterSummary`, `ListMeta` | `listDomains`, `getDomain`, `updateDomain` | list, domain page, sections, footer summary | `domainAdmins` only for administrators; `etag` on every entry and read; `footer` is the footer summary (G28), not covered by `etag` |
| `DomainPatch` | `updateDomain` | section saves | JSON Merge Patch (`application/merge-patch+json`), changed members only (D11) |
| `DomainCreateRequest`, `DomainCreated`, `DomainCreationReport` | `createDomain` | create page, report | `creationReport` stripped before the detail cache (D7) |
| `DomainDeletionPreview`, `DomainAddressSample` | `previewDomainDeletion` | deletion | `etag` sent with the deletion (D20) |
| `DomainFooter`, `DomainFooterReplace` | `getDomainFooter`, `replaceDomainFooter` | footer editor | `html` is never rendered (FR-059) |
| `DomainCapabilities`, `DomainDkimCapabilities`, `DomainTemplateDefaults` | `getDomainsCapabilities` | every form and the list | `dkim` and `templateDefaults` (G29) only for administrators |
| `DomainTagSummary` | `listDomainTags` | tag filter, tag suggestions | — |
| `DomainBulkActionRequest`, `BulkTarget`, `BulkResult`, `BulkItemResult`, `BulkItemOutcome` | `applyDomainBulkAction` | bulk actions | `BulkTarget.version` is the `etag` exactly as read, quotes included (D22, G33) |
| `DomainTemplate`, `DomainTemplateCreateRequest`, `DomainTemplatePatch` | `listDomainTemplates`, `createDomainTemplate`, `getDomainTemplate`, `updateDomainTemplate`, `deleteDomainTemplate` | template screens, create form | `isDefault` marks the protected template |
| `DomainAttributeNotPermittedProblem`, `DomainNotEmptyProblem` | `updateDomain`, `deleteDomain` | errors | read through `ApiProblem` (UI 001) |
| `AuditTarget`, `AuditEventType`, `AuditFailureReason` | `listAuditEvents` with `targetType`, `targetId` | History | `details` stays an open object (plan API gap G1) |
| `Identity`, `PermissionFlags` (`domainDesc`), `DomainsScope` | `getIdentity` (UI 001) | permissions, home links | — |

Path and query parameter types are aliases of the generated `operations[…]['parameters']`. They
are not hand-written (constitution I).

## 2. App-defined models

None of these is an API shape. Each is derived from API data or from app constants.

### DomainPermissions (`src/features/domains/permissions.ts`)

`domainPermissions(identity)` returns:

| Field | Administrator | Domain administrator |
|---|---|---|
| `canCreate`, `canDelete`, `canBulk`, `canManageTemplates` | `true` | `false` |
| `canSeeDomainAdmins` | `true` | `false` |
| `editable` | `description`, `active`, `maxMailboxes`, `maxAliases`, `defaultMailboxQuota`, `maxMailboxQuota`, `domainQuota`, `backupMx`, `relayAllRecipients`, `relayUnknownOnly`, `globalAddressList`, `tags` | `globalAddressList`, `tags`, and `description` when `permissions.domainDesc` |

A section is editable when it contains at least one `editable` attribute. After
`403 attribute-not-permitted`, the problem's `attributes` are removed from `editable` for the open
form until the identity is refetched (D11).

### UsageLevel (`src/features/domains/usage.ts`)

`usageLevel(used, limit)` returns one of:

- `ok`;
- `nearlyFull`: `used / limit ≥ 0.9` and `used ≤ limit`, or `limit = 0` and `used = 0`;
- `over`: `used > limit`.

### QuotaInputValue (`src/features/domains/quota.ts`)

`{ amount: string; unit: 'MiB' | 'GiB' | 'TiB' }`.

- `toQuotaInput(bytes)` picks the largest unit that represents `bytes` exactly.
- `parseQuota(value, quotaUnit)` returns bytes, or one of the errors `required`, `invalidNumber`,
  `notWholeUnit`, `belowMinimum` or `aboveMaximum`. The minimum is one `quotaUnit`. The maximum is
  9,007,199,254,740,992 bytes.

### RelayBadge (`src/features/domains/relay.ts`)

`'relayUnknownOnly' | 'relayAllRecipients' | 'relay' | null`:

- `relayUnknownOnly` when `relayUnknownOnly` is set;
- otherwise `relayAllRecipients` when `relayAllRecipients` is set;
- otherwise `relay` when `backupMx` is set;
- otherwise `null`.

### CreationReportLine (`src/features/domains/creation-report.ts`)

`{ step: keyof DomainCreationReport (without messages); outcome: string; kind: 'done' | 'info' | 'warning' }`.

| `kind` | Outcomes |
|---|---|
| `done` | `applied`, `created`, `published`, `done` |
| `info` | `notRequested`, `alreadyExisted`, `notConfigured`, `skipped`, `noZone`, `groupwareDisabled` |
| `warning` | `failed` |

The order is `rateLimit`, `dkimKey`, `dkimDnsPublication`, `groupwareRestart`. Since the pin
`c1677d5` the domain creation report has no `groupwareDirectoryUpdate` step: like legacy, a
creation does not rebuild the groupware directory.

### BulkRow (`src/shared/components/BulkResultSummary.vue`)

`{ id: string; label: string; outcome: BulkItemOutcome | 'skipped' | 'unknown' | 'notProcessed'; problem?: ApiProblem }`.

- For domains, the rows come from `BulkResult.results`, plus `skipped` rows for domains left out of
  a deletion. A lost connection gives `unknown` for every target.
- For templates, the rows come from single responses (D23).
- `label` is the readable name or the template name.

### BulkSelection (`src/shared/composables/useBulkSelection.ts`)

- **State**: `{ active: boolean; ids: Set<string>; limit: number | null }`, with the derived
  `atLimit` (the selection has reached `limit`, the bulk limit from the capabilities).
- **Methods**: `toggle(id)`, `selectPage(ids)`, `clear()`, `keep(ids)` (keeps failed, refused and
  outdated after a run). `selectPage(ids)` selects the visible IDs in order up to the limit (the
  first N) and states the limit when it cut the selection short. At the limit, `toggle` of an
  unselected ID is refused, further selection is disabled, and the UI states the limit with the same
  message (`bulk.limitReached`).
- **Reset**: cleared by `useListState`'s `onReset`.

### OutdatedDiff (extension of `src/shared/composables/useVersionedSave.ts`)

`changedSince(base, latest, fields): Array<{ field; savedValue }>`. It compares with the field's
comparator: sets for tags, numbers for quotas, strict equality otherwise.

## 3. Server-state cache

### Query keys

These are added to `src/api/query/keys.ts`.

| Key | Operation | staleTime | Fetched when | Notes |
|---|---|---|---|---|
| `['domains','list',DomainListParams]` | `listDomains` | 30 s | the list page; the home summary link target | params from the address (§5) |
| `['domains','detail',name]` | `getDomain` | 30 s | the domain page; the footer page (header) | `initialData` from a cached list entry (D6) |
| `['domains','footer',name]` | `getDomainFooter` | 30 s | the footer editor | the domain page's summary reads `Domain.footer` (G28) |
| `['domains','deletion-preview',name]` | `previewDomainDeletion` | 0 (`gcTime` 0) | when Delete is chosen; after a `412` on deletion | — |
| `['domains','capabilities']` | `getDomainsCapabilities` | 5 min | the list (bulk limit), create, domain, footer and template pages | — |
| `['domains','tags',{q,limit:25,sort:'name'}]` | `listDomainTags` | 30 s | when the tag filter or a tag editor opens; on typing (300 ms debounce) | — |
| `['domains','creation-report',name]` | none (`setQueryData`) | — | written after `201`, read and removed by the domain page (D7) | — |
| `['domain-templates','list',TemplateListParams]` | `listDomainTemplates` | 30 s | the template list; the create form with `{sort:'name',order:'asc',limit:maxPageSize}` | — |
| `['domain-templates','detail',id]` | `getDomainTemplate` | 30 s | the template page | `initialData` from a cached list entry |
| `['audit-events','list',AuditListParams]` (UI 001) | `listAuditEvents` | 30 s | the audit log | params gain `targetType`, `targetId` |

`DomainListParams` and `TemplateListParams` alias
`NonNullable<operations['listDomains' | 'listDomainTemplates']['parameters']['query']>`.

### Invalidation after mutations

| Mutation | On success | On `412` |
|---|---|---|
| `createDomain` | write `['domains','detail',name]` without `creationReport`; write `['domains','creation-report',name]`; invalidate `['domains','list']`, `['domains','tags']`, `['audit-events']` | — |
| `updateDomain` | write `['domains','detail',name]`; replace the entry in every cached `['domains','list',…]` with `setQueriesData`, then invalidate `['domains','list']`; invalidate `['domains','tags']` when tags changed; invalidate `['audit-events']` | refetch `['domains','detail',name]`; keep the input; mark the changed fields (D11) |
| `deleteDomain` | remove `detail`, `footer` and `deletion-preview` of the name; invalidate `['domains','list']`, `['domains','tags']`, `['audit-events']` | refetch the preview; confirm again (D20) |
| `applyDomainBulkAction` | invalidate `['domains','list']`, `['domains','tags']`, `['audit-events']`; remove the detail caches of deleted names; invalidate those of activated and deactivated names | per item (`outdated` row) |
| `replaceDomainFooter` | write `['domains','footer',name]`; invalidate `['audit-events']` | refetch the footer; keep the input; mark the changed fields |
| `createDomainTemplate` | write `['domain-templates','detail',id]`; invalidate `['domain-templates','list']`, `['audit-events']` | — |
| `updateDomainTemplate` | write `['domain-templates','detail',id]`; invalidate `['domain-templates','list']`, `['audit-events']` | refetch the detail; keep the input; mark the changed fields |
| `deleteDomainTemplate` | remove `['domain-templates','detail',id]`; invalidate `['domain-templates','list']`, `['audit-events']` | refetch; confirm again (single); `outdated` row (multiple) |

A `403 attribute-not-permitted` invalidates `['identity']` and refetches the domain. A `404` on a
domain or template mutation removes its caches and invalidates its lists.

## 4. Form models

These are local component state, never stored (constitution V).

### Create a domain (`src/features/domains/create-form.ts`)

| Field | Form type | Request member | Source of the starting value |
|---|---|---|---|
| `name` | string | `name` | empty |
| `description` | string | `description` | empty ("the domain name" when empty, FR-035) |
| `templateId` | number \| null | `templateId` (omitted when null) | the template with `isDefault`; `null` when no template exists |
| `maxMailboxes`, `maxAliases` | string (digits) | integer | template, or `templateDefaults` (else `defaults.ts`) |
| `defaultMailboxQuota`, `maxMailboxQuota`, `domainQuota` | `QuotaInputValue` | bytes | template, or `templateDefaults` (else `defaults.ts`) |
| `active`, `globalAddressList` | boolean | same | template, or `templateDefaults` (else `defaults.ts`); `globalAddressList` hidden and omitted when `groupwareEnabled` is false |
| `backupMx`, `relayAllRecipients`, `relayUnknownOnly` | boolean | same | template, or `templateDefaults` (else `defaults.ts`) (all false) |
| `tags` | string[] | `tags` | template, or `[]` |
| `rateLimit` | `{ enabled: boolean; value: string; frame: 'second' \| 'minute' \| 'hour' \| 'day' }` | `DomainRateLimit` or `null` | template, or `null` |
| `dkim` | `{ generate: boolean; selector: string; keySize: number }` | `dkimSelector`, `dkimKeySize` | template; without one, `generate: true`, `selector: ''`, `keySize: capabilities.dkim.defaultKeySize` |
| `restartGroupware` | boolean | `restartGroupware` | `false`; hidden and omitted when `groupwareEnabled` is false |

The steps, with each field path mapped to its step for FR-027 (`fieldStep`):

1. Domain and template: `name`, `description`, `templateId`.
2. Limits and quotas: the five limits and quotas.
3. Options: `active`, `globalAddressList`, the relay options, `tags.*`.
4. Rate limit and DKIM: `rateLimit.*`, `dkimSelector`, `dkimKeySize`.
5. Review: `restartGroupware`.

### Domain page sections (`src/features/domains/components/detail/sections/`)

| Section | Fields | Editable when |
|---|---|---|
| General | `description`, `active` | `editable` has `description` or `active` |
| Tags | `tags` | always (both roles) |
| Limits and quotas | `maxMailboxes`, `maxAliases`, `defaultMailboxQuota`, `maxMailboxQuota`, `domainQuota` | administrator |
| Relay options | `backupMx`, `relayAllRecipients`, `relayUnknownOnly` | administrator |
| Groupware | `globalAddressList` | always (both roles) |
| Delivery | `relayhost`, `rateLimit` | never (read-only, FR-015) |

Each section form is opened with the base `Domain` it was read from (`base` and `base.etag`). It
saves `patch.ts`'s changed members only.

### Domain template (`src/features/domains/template-form.ts`)

The fields are those of `DomainTemplateCreateRequest`, with the same form types as the create form
plus `name` (string). The sections on the template page are:

| Section | Fields | Notes |
|---|---|---|
| Name and tags | `name`, `tags` | `name` is read-only when `isDefault` (FR-053) |
| Limits and quotas | `maxMailboxes`, `maxAliases`, `defaultMailboxQuota`, `maxMailboxQuota`, `domainQuota` | — |
| Options | `active`, `globalAddressList`, `backupMx`, `relayAllRecipients`, `relayUnknownOnly` | — |
| Rate limit and DKIM | `rateLimit`, `dkimSelector`, `dkimKeySize` | — |

A new template starts from `capabilities.templateDefaults` (G29), or from `defaults.ts` when the
capabilities lack it, with the DKIM switch on, an empty selector and the default key size
(FR-052, D18, D19).

### Footer (`src/features/domains/footer.ts`)

`{ html: string; plain: string; skipReplies: boolean; excludedAddresses: string[]; excludedAliasDomains: string[] }`.
It maps one to one to `DomainFooterReplace` and is opened from a `DomainFooter` with its `etag`.

## 5. Route map

The base is `/ng/`. These routes replace `placeholder-domains`. Every component is lazy-loaded
(UI 001 R19).

| Name | Path | Access | Title key | Component |
|---|---|---|---|---|
| `domains` | `/domains` | nav `domains` | `domains.title` | `features/domains/pages/DomainListPage.vue` |
| `domain-create` | `/domains/-/new` | nav `domains`, `meta.roles: ['admin']` | `domains.create.title` | `features/domains/pages/DomainCreatePage.vue` |
| `domain-detail` | `/domains/:domain` | nav `domains` | `domains.detail.title` | `features/domains/pages/DomainDetailPage.vue` |
| `domain-templates` | `/domain-templates` | nav `domainTemplates` | `domainTemplates.title` | `features/domains/pages/TemplateListPage.vue` |
| `domain-template-create` | `/domain-templates/new` | nav `domainTemplates` | `domainTemplates.create.title` | `features/domains/pages/TemplateCreatePage.vue` |
| `domain-template-detail` | `/domain-templates/:templateId(\d+)` | nav `domainTemplates` | `domainTemplates.detail.title` | `features/domains/pages/TemplateDetailPage.vue` |

Rules:

- `:domain` is the ASCII name in every link the app builds. Other spellings are replaced by the
  canonical address once the domain is loaded (D4).
- A `404` from `getDomain`, `getDomainFooter` or `getDomainTemplate` renders UI 001's
  `NotFoundPage` with a back link to the list (`backTo` prop added in this feature, FR-004).
- `edit=<section>` on `domain-detail` opens a section. Under the translations and forms rule
  (plan.md, "Translations and forms") the sections are the legacy tabs: `domain` ("Edit domain")
  and, with US7, `footer` ("Domain wide footer"); "Rate limit" is read-only. The template page is
  one form, as the classic edit page. An unknown or non-editable section is removed with
  `router.replace`.
- The add domain page is one form, as the classic `#addDomainModal`; it has no steps.
- The catalogue gains the row `domainTemplates` after `domains` (D5).
- Removing `edit` from the address while the open section has unsaved changes asks first (FR-038),
  in the page's own `onBeforeRouteUpdate`, because `useLeaveGuard` ignores query-only changes.
- The create page shows a loading state until the templates and capabilities are loaded, and an
  error state with retry when either fails. The template page has the loading, not-found and error
  states of the domain page. Tag suggestions show "loading" and "suggestions unavailable" in their
  list, and typing a tag keeps working.
- A relayhost whose `hostname` is `null` is shown as "relayhost #<id> (no longer exists)".

### Address parameters of the lists

Defaults are omitted from the address. Invalid values fall back to the default with
`router.replace` (UI 001 R20).

**Domains** (`/domains`, FR-005, FR-009 to FR-012):

| Param | Type | Default | Maps to |
|---|---|---|---|
| `q` | string ≤ 255 | — | `q` |
| `active` | `active`, `inactive` | — | `active=true`, `active=false` |
| `relay` | `relay`, `local` | — | `backupMx=true`, `backupMx=false` |
| `tag` | repeatable string, 1–255 characters each, at most 100 | — | `tag` (exploded) |
| `sort` | `name`, `description`, `active`, `backupMx`, `mailboxes`, `aliases`, `quotaAllocated`, `storageUsed`, `maxMailboxes`, `maxAliases`, `defaultMailboxQuota`, `maxMailboxQuota`, `domainQuota`, `createdAt`, `modifiedAt` | `name` | `sort` |
| `order` | `asc`, `desc` | `asc` | `order` |
| `page` | integer ≥ 1 | 1 | `offset = (page − 1) × size` |
| `size` | 25, 50, 100 | 25 | `limit` |

**Domain templates** (`/domain-templates`, FR-049):

| Param | Type | Default | Maps to |
|---|---|---|---|
| `q` | string ≤ 255 | — | `q` |
| `sort` | `name`, `id`, `createdAt`, `modifiedAt` | `name` | `sort` |
| `order` | `asc`, `desc` | `asc` | `order` |
| `page`, `size` | as above | 1, 25 | `offset`, `limit` |

**Audit log** (`/audit-log`, additions to UI 001 data-model §5, FR-063):

| Param | Type | Default | Maps to |
|---|---|---|---|
| `targetType` | an `AuditTarget.type` value | — | `targetType` |
| `targetId` | string ≤ 255 | — | `targetId` |

## 6. Client-side validation

These checks run before sending. API field errors are always shown too (UI 001 FR-076). Limits
come from `getDomainsCapabilities` or from the contract through `src/shared/validation/limits.ts`,
never from hand-picked numbers (conventions).

| Field | Rule | Message key |
|---|---|---|
| Domain name | trimmed; `toAsciiDomain` succeeds; labels `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`; at most 253 characters in ASCII form (FR-020) | `validation.required`, `validation.format.domainName` |
| Description | at most `capabilities.maxDescriptionLength` (255) characters | `validation.tooLong` |
| Template name | 1–255 characters after trimming | `validation.required`, `validation.tooLong` |
| Mailbox limit, alias limit | whole number from 0 to 2,147,483,647 | `validation.outOfRange` |
| Quotas | `parseQuota`: a number, a whole multiple of `capabilities.quotaUnit`, at least 1 MiB, at most 9,007,199,254,740,992 bytes | `validation.required`, `domains.quota.invalidNumber`, `validation.notMultipleOf`, `validation.outOfRange` |
| Default vs maximum mailbox quota | `defaultMailboxQuota ≤ maxMailboxQuota` | `validation.mustNotExceed` (field: maximum mailbox quota) |
| Maximum mailbox vs domain quota | `maxMailboxQuota ≤ domainQuota` | `validation.mustNotExceed` (field: domain quota) |
| Mailbox limit (edit, changed) | `≥ usage.mailboxes` | `validation.belowInUse` (`inUse`) |
| Alias limit (edit, changed) | `≥ usage.aliases` | `validation.belowInUse` |
| Domain quota (edit, changed) | `≥ usage.quotaAllocated` | `validation.belowInUse` (size) |
| Maximum mailbox quota (edit, changed) | `≥ usage.largestMailboxQuota` | `validation.belowInUse` (size) |
| Tag | trimmed; non-empty; at most `capabilities.maxTagLength` (255) characters; case-only duplicates merged | `validation.tooLong` |
| Tag set | at most `capabilities.taggingLimit` tags, unless the stored set is already larger and the new one is smaller | `validation.tooMany` (`max`) |
| Rate limit value | whole number from 1 to 2,147,483,647 when enabled | `validation.outOfRange` |
| DKIM selector | `^[A-Za-z0-9._-]*$`, at most 255 characters | `validation.format.dkimSelector`, `validation.tooLong` |
| DKIM key size | one of `capabilities.dkim.allowedKeySizes` | `validation.notInList` |
| Footer texts | UTF-8 size at most `capabilities.footerTextMaxBytes` (1,048,576) | `validation.tooLong` (`unit: bytes`) |
| Footer exclusions | trimmed, each at most 255 characters, case-only duplicates merged | `validation.tooLong` |
| Typed confirmation, one domain | equal to `name` or `unicodeName`, ignoring letter case | `domains.delete.typeName` |
| Typed confirmation, bulk | equal to the number of objects to be deleted | `bulk.confirm.typeCount` |
| Bulk selection | at most `capabilities.bulkLimit` objects; at the limit, further selection is disabled | `bulk.limitReached` (`max`) |
| Audit target | at most 255 characters | `validation.tooLong` |

## 7. State machines

### Create a domain (`DomainCreatePage.vue`)

```text
[step 1] ─next (name valid)─► [step 2] ─► [step 3] ─► [step 4] ─► [review]
   │  ▲ back ◄────────────────────────────────────────────────────┘ │
   └─"Review" (name valid)───────────────────────────────────────────┘
[review] ─create─► (sending: create disabled, progress shown) ─201─► domain page + report
                        ├─422/409/notFound template─► step of the first error, input kept
                        ├─503 temporary-failure─► "nothing was changed", retry keeps input
                        └─network─► message, retry keeps input
```

From `md` up, the steps are sections on one page, and "next" and "back" scroll to the section.

### Section edit (`EditableSection` and `useVersionedSave`)

```text
view ─Edit─► editing ─Save (client rules pass)─► saving ─200─► view (announce; new etag)
  ▲            │ Cancel / Back (confirm if changed)        ├─412─► outdated (input kept, changed fields marked)
  └────────────┘                                            │        ├─Save again─► saving (latest etag)
                                                            │        └─Discard─► editing (latest values)
                                                            ├─422─► editing (field errors, summary focused)
                                                            ├─403 attribute-not-permitted─► editing (fields read-only, identity refetched)
                                                            ├─404─► "no longer available", link to the list
                                                            └─500/network─► editing ("nothing was saved", retry)
```

### Delete one domain (`useDomainDeletion`)

```text
(not empty: action unavailable with reason)
idle ─Delete─► loading preview ─allowed:false─► blockers dialog (no deletion)
                     └─allowed:true─► confirm (impact; name typed) ─cancel─► idle
                                         └─confirm─► deleting ─204─► list (announced)
                                                         ├─412─► loading preview (notice: changed)
                                                         ├─409─► remaining counts shown
                                                         ├─404─► list ("no longer exists")
                                                         └─503/network─► message, retry
```

### Bulk action on domains (`useDomainBulk`)

```text
selecting ─action─► (delete: partition skipped) ─► confirming (deactivate: confirm; delete: impact + count typed; activate: none)
   ▲                                                    └─confirm─► running (one request; leave warns)
   │                                                                   ├─200─► results (rows; failed/refused/outdated kept selected)
   │                                                                   └─network─► results (all "outcome unknown"; selection cleared)
   └──────────────────────── retry (kept rows, refreshed etags) / close ◄┘
```

A retry repeats the confirmed action for the kept rows without asking again; it first waits for
the list refetch that the action started, so the targets carry the refreshed version tags.

### Delete several templates (`useTemplateBulkDelete`)

```text
confirming (names; count typed) ─► running item i of n ─► next item … ─► results
                                        └─network─► item "unknown", rest "not processed", stop
```

## 8. Translations

The new namespaces, all in `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, with legacy reuse through
`src/i18n/legacy-map.json`:

- `domains.*`: list, filters, sort keys, card and table labels, the domain page, sections, the
  create page, the report, deletion, bulk actions and the footer;
- `domainTemplates.*`;
- `bulk.*`: shared texts of the selection bar, confirmation and result summary, one label per
  `BulkItemOutcome`, plus `skipped`, `unknown` and `notProcessed`;
- `sections.*`: shared texts of `EditableSection` and the outdated notice;
- `nav.domainTemplates`;
- `auditLog.event.*`, `auditLog.target.*` and `auditLog.failureReason.*`: the values below;
- `problem.*` and `validation.*`: the values below.

**Legacy keys reused** (meaning unchanged; `*` marks `stripMarkup`, D27):

| App key (examples) | Legacy key |
|---|---|
| `domains.title`, `nav.domains` | `mailbox.domains` |
| `domains.create.action` | `mailbox.add_domain` |
| `domainTemplates.title`, `nav.domainTemplates` | `mailbox.domain_templates` |
| `domainTemplates.create.action` | `mailbox.add_template` |
| `domains.fields.domain` | `mailbox.domain` |
| `domains.fields.description` | `mailbox.description` |
| `domains.fields.domainAdmins` | `mailbox.domain_admins` |
| `domains.fields.mailboxes`, `domains.fields.aliases` | `mailbox.mailboxes`, `mailbox.aliases` |
| `domains.fields.aliasDomains` | `mailbox.domain_aliases` |
| `domains.fields.active` / `domains.state.active` / `domains.state.inactive` | `edit.active`, `mailbox.active`, `mailbox.inactive` |
| `domains.fields.maxMailboxes`, `domains.fields.maxAliases` | `edit.max_mailboxes`, `edit.max_aliases` |
| `domains.fields.defaultMailboxQuota` | `edit.mailbox_quota_def` |
| `domains.fields.domainQuota` | `edit.domain_quota` |
| `domains.fields.relayOptions` | `edit.backup_mx_options` |
| `domains.fields.backupMx`, `domains.fields.relayAllRecipients`, `domains.fields.relayUnknownOnly` | `edit.relay_domain`, `edit.relay_all`, `edit.relay_unknown_only` |
| `domains.badge.relay`, `domains.badge.relayAll`, `domains.badge.relayUnknown` | `mailbox.backup_mx`, `mailbox.relay_all`, `mailbox.relay_unknown` |
| `domains.help.relayAll`* | `edit.relay_all_info` |
| `domains.fields.globalAddressList`, `domains.help.gal`* | `edit.gal`, `edit.gal_info` |
| `domains.fields.tags` | `add.tags` |
| `domains.fields.template` | `mailbox.template` |
| `domains.fields.rateLimit`, `domains.rateLimit.frame.{second,minute,hour,day}` | `edit.ratelimit`, `ratelimit.second` … `ratelimit.day` |
| `domains.fields.dkimSelector`, `domains.fields.dkimKeySize` | `admin.dkim_domains_selector`, `admin.dkim_key_length` |
| `domains.fields.createdAt`, `domains.fields.modifiedAt` | `edit.created_on`, `edit.last_modified` |
| `domains.fields.messages` | `mailbox.msg_num` |
| `domains.footer.title`, `domains.footer.info`* | `edit.domain_footer`, `edit.domain_footer_info` |
| `domains.footer.html`, `domains.footer.plain` | `edit.domain_footer_html`, `edit.domain_footer_plain` |
| `domains.footer.skipReplies`, `domains.footer.exclude` | `edit.domain_footer_skip_replies`, `edit.footer_exclude` |
| `domains.bulk.activate`, `domains.bulk.deactivate`, `domains.bulk.delete` | `mailbox.activate`, `mailbox.deactivate`, `mailbox.remove` |
| `domains.report.dkimKey.alreadyExisted` | `success.domain_add_dkim_available` |
| `domains.create.exists` (on the name field, `{0}` = the entered name) | `danger.domain_exists` |
| `domains.create.success` (`{0}` = the readable name) | `success.domain_added` |
| `domains.report.groupwareRestart.failed` | `warning.domain_added_sogo_failed` |
| `domains.delete.notEmpty` (`{0}` = the readable name, followed by the counts) | `danger.domain_not_empty` |

`sk-sk` lacks `mailbox.relay_unknown`, `edit.domain_footer_skip_replies` and `edit.footer_exclude`,
so those Slovak values are written in `src/i18n/messages/sk-sk.json`. The MiB-only labels
`edit.max_quota`, `add.mailbox_quota_m` and `add.domain_quota_m` are not reused, because the unit
is now chosen (new key `domains.fields.maxMailboxQuota`). `domains.fields.domainQuota` reuses
`edit.domain_quota`, whose label has no unit.

**Coverage manifest additions** (`src/i18n/coverage.json`, D2):

| Enumeration | Values added by UI 002 |
|---|---|
| `AuditEventType` | `domainCreation`, `domainUpdate`, `domainDeletion`, `domainFooterUpdate`, `domainTemplateCreation`, `domainTemplateUpdate`, `domainTemplateDeletion` |
| `AuditTarget.type` | `domain`, `domainTemplate`, `domainFooter` |
| `AuditFailureReason` | `attributeNotPermitted`, `versionOutdated`, `validationFailed`, `conflict`, `temporaryFailure` |
| `ValidationRuleCode` | `immutable`, `notMultipleOf`, `mustNotExceed`, `belowInUse`, `reserved` |
| `problemTypes` | `domain-exists`, `domain-not-empty`, `domain-template-name-exists`, `domain-template-protected`, `attribute-not-permitted`, `temporary-failure` |

The manifest also holds UI 001's values as of its pin `293b7c2`:

- the 11 rule codes `required` … `notEligible`;
- the 8 event types `signIn` … `apiKeyRevocation`;
- the 13 failure reasons `invalidCredentials` … `registrationFailed`;
- the 4 `AuthMethod` values `password`, `passwordAndSecondFactor`, `passkey` and `apiKey`;
- the 4 target types `apiKey`, `passkey`, `preferences` and `session`;
- the 20 problem types of API 001.

**Fully required enumerations**: every value needs a key. They are registered in the `complete`
object of `src/i18n/coverage.json`, a key prefix mapped to a JSON pointer into
`contract/openapi.json`, by the task that adds their labels:

| Key prefix | JSON pointer |
|---|---|
| `bulk.outcome` | `#/components/schemas/BulkItemOutcome` |
| `domains.rateLimit.frame` | `#/components/schemas/DomainRateLimit/properties/frame` |
| `domains.sort` | `#/components/parameters/DomainSort/schema` |
| `domainTemplates.sort` | `#/components/parameters/DomainTemplateSort/schema` |
| `domains.report.<step>`, for the five steps | `#/components/schemas/DomainCreationReport/properties/<step>` |

The growing shared enumerations are listed in the `partial` object.

**Validation formats added**: `validation.format.domainName`, `validation.format.dkimSelector`
and `validation.format.email`.

## 9. Action areas for later features

Per `docs/conventions.md` ("Where features meet"), later features add their entry points to these
areas of this feature's screens when they are implemented. Until then, the areas show nothing for
them.

| Screen | Area | Expected later use |
|---|---|---|
| Domain page | header actions (a menu below `md`): Footer, History, Delete | UI 010 "DNS check" |
| Domain page | section list, after Groupware | UI 006 rate limit and spam filter; UI 009 relayhost (replaces the read-only relayhost row of Delivery); UI 010 DKIM and MTA-STS; UI 013 quota warning BCC |
| Domain page | usage summary counts | UI 003 links mailboxes, UI 004 links aliases and alias domains |
| Domain page | domain administrators list | UI 007 links each username to its detail |
| Domain list | entry actions menu | UI 010 "DNS check" |
| Footer editor | exclusion fields | UI 003 and UI 004 add the picker of mailboxes, aliases and alias domains |
