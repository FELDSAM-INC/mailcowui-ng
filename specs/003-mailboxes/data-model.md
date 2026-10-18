# Data Model: Mailboxes

**Feature**: `specs/003-mailboxes` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

This app owns no persistent data. This document defines what UI 003 adds to UI 001's model
(`specs/001-sign-in-app-shell/data-model.md`):

- the API data it consumes, as generated types;
- the form and view models;
- the query keys and their invalidation;
- the one storage key it adds;
- the routes and address parameters;
- the client-side validation rules;
- the state machines;
- the designated action areas;
- the enumeration values it adds to the translation scope.

Contract shapes are never restated. Types come from `src/api/generated/schema.ts` through `@/api`
(UI 001 R7). Decisions are justified in [research.md](./research.md).

## 1. API data consumed

These are generated root types, imported from `@/api`. Operations are listed in
[contracts/README.md](./contracts/README.md).

| Type | Operation(s) | Used by |
|---|---|---|
| `Mailbox`, `MailboxStatus`, `MailboxAuthSource`, `MailboxProtocolAccess`, `MailboxUserPermissions`, `MailboxTagSet`, `MailboxCustomAttributes`, `MailboxLastLogins`, `MailboxRateLimit`, `MailboxQuarantineNotification`, `MailboxQuarantineCategory`, `MailboxTaggedMailHandling` | `listMailboxes`, `getMailbox`, `updateMailbox` | list, detail, sections |
| `MailboxCreateRequest`, `MailboxCreated`, `MailboxCreationReport` | `createMailbox` | create screen |
| `MailboxPatch`, `MailboxProtocolAccessInput`, `MailboxUserPermissionsInput` | `updateMailbox` | sections (`patch.ts`) |
| `MailboxCapabilities` | `getMailboxCapabilities` | list, forms, dialogs |
| `MailboxTagUsage` | `listMailboxTags` | tag filter and tag input suggestions |
| `MailboxDeletionPreview`, `MailboxAddressSample` | `previewMailboxDeletion` | delete dialog |
| `MailboxRenameRequest`, `MailboxRenamed`, `MailboxRenameStep`, `MailboxRenameIncompleteProblem` | `renameMailbox` | rename section, rename report |
| `MailboxBulkActionRequest`, `BulkTarget`, `BulkResult`, `BulkItemResult`, `BulkItemOutcome` | `applyMailboxBulkAction` | bulk actions |
| `MailboxTemplate`, `MailboxTemplateCreateRequest`, `MailboxTemplatePatch` | the five template operations | templates, create screen |
| `PasswordPolicy` | `getPasswordPolicy` | password hints and generator |
| `MailboxAddressInUseProblem`, `MailboxLimitReachedProblem`, `MailboxAliasLimitReachedProblem`, `MailboxAttributeNotPermittedProblem`, `MailboxPermissionFlagRequiredProblem`, `MailboxTemporaryFailureProblem`, `MailboxOutcomeUnknownProblem` | errors | `problems.ts` |
| `Domain`, `DomainUsage` | `listDomains`, `getDomain` (API 002, through UI 002's queries) | domain picker, filter, create figures |
| `Identity`, `PermissionFlags`, `Role` | `getIdentity` (UI 001) | gates (`acl.ts`) |
| `PublicConfig` (`productName`) | `getPublicConfig` (UI 001) | built-in source label, `pwReset` label |
| `AuditEvent`, `AuditTarget` | `listAuditEvents` (UI 001, target filters from UI 002) | History through the audit log screen |

Enumeration value arrays used for choices and labels: `mailboxStatusValues`,
`mailboxAuthSourceValues`, `mailboxQuarantineNotificationValues`,
`mailboxQuarantineCategoryValues`, `mailboxTaggedMailHandlingValues`,
`mailboxRateLimitFrameValues`, `mailboxBulkActionRequestActionValues`,
`mailboxBulkActionRequestProtocolValues`, `bulkItemOutcomeValues`, `mailboxRenameStepStepValues`,
`mailboxRenameStepOutcomeValues`, `mailboxAddressInUseProblemHolderValues`,
`mailboxCreationReportRateLimitValues`, `mailboxCreationReportTaggedMailHandlingValues`,
`mailboxCreationReportGroupwareDirectoryUpdateValues`,
`mailboxDeletionPreviewBlockersDependencyValues`, `componentsParametersMailboxSortValues`,
`componentsParametersMailboxTemplateSortValues` and `knownProblemTypeValues`. These names were
verified by generating the client from the baseline bundle.

List parameter types are aliases of the generated operation types, never hand-written:

- `MailboxListParams = NonNullable<operations['listMailboxes']['parameters']['query']>`;
- `MailboxTemplateListParams = NonNullable<operations['listMailboxTemplates']['parameters']['query']>`;
- `MailboxTagListParams = NonNullable<operations['listMailboxTags']['parameters']['query']>`.

## 2. App-defined models

These are not API shapes. Each is derived from API data or from app constants.

### Mailbox column catalogue (`src/features/mailboxes/columns.ts`)

| id | Header key | Default | Sort field | Value |
|---|---|---|---|---|
| `select` | (checkbox) | ✓ (fixed) | — | selection |
| `address` | `mailbox.username` | ✓ (fixed) | `address` | address, display name below |
| `domain` | `mailbox.domain` | ✓ | `domain` | `domainUnicode` (ASCII in `title` when it differs) |
| `quota` | `mailbox.in_use` | ✓ | `percentUsed` | `MailboxQuotaUsage` |
| `messages` | `mailbox.msg_num` | ✓ | `messageCount` | number |
| `lastMailLogin` | `mailbox.last_mail_login` | ✓ | `lastMailLogin` | newest of `imap`, `pop3` and `smtp` |
| `status` | `mailbox.active` | ✓ | `status` | `MailboxStatusBadge` |
| `tags` | `add.tags` | ✓ | — | first 3 tags and "+n" |
| `actions` | (menu) | ✓ (fixed) | — | `MailboxRowActions` |
| `authSource` | `mailboxes.columns.authSource` | — | — | source label |
| `passwordChangedAt` | `mailbox.last_pw_change` | — | `passwordChangedAt` | date |
| `imap`, `pop3`, `smtp`, `sieve`, `activeSync`, `dav` | `mailboxes.protocol.<id>` | — | — | yes or no, as text |
| `tlsEnforceInbound`, `tlsEnforceOutbound` | `mailbox.tls_enforce_in` and `_out` | — | — | yes or no |
| `quarantineNotification`, `quarantineCategory` | `mailbox.quarantine_notification` and `_category` | — | — | label |
| `createdAt` | `mailbox.created_on` | — | `createdAt` | date |
| `modifiedAt` | `mailbox.last_modified` | — | `modifiedAt` | date or "never modified" |

The sort control on phones offers all 12 `MailboxSort` fields, including `displayName`, `quota` and
`quotaUsed`, which have no column of their own.

### Section catalogue (`src/features/mailboxes/sections.ts`)

| id | Route name | Label key | Shown to | Summary (FR-016) | Fields (`Mailbox` members) |
|---|---|---|---|---|---|
| `general` | `mailbox-general` | `mailboxes.sections.general` | all | display name, quota, status | `displayName`, `quota`, `status`, `webmailRedirect` |
| `signIn` | `mailbox-sign-in` | `mailboxes.sections.signIn` | all | source, last password change | `authSource`, `password` (write-only), `forcePasswordChange`, `forceSecondFactorSetup`, `recoveryEmail` |
| `protocols` | `mailbox-protocols` | `edit.allowed_protocols` | all | allowed protocols as a list | `protocolAccess.*` |
| `permissions` | `mailbox-permissions` | `mailboxes.sections.permissions` | all | "n of m allowed" | `userPermissions.*` (present keys only) |
| `tags` | `mailbox-tags` | `add.tags` | all | first tags, count | `tags` |
| `attributes` | `mailbox-attributes` | `edit.custom_attributes` | all | count | `customAttributes` |
| `history` | — (`HistoryLink`) | `mailboxes.sections.history` | administrators | — | — |
| `rename` | `mailbox-rename` | `edit.mailbox_rename` | all | current address | — |
| `delete` | `mailbox-delete` | `mailbox.remove` | all | storage used | — |

### Form models

All values live in component memory. None are stored (FR-074).

**`CreateForm`** (`composables/useMailboxCreateForm.ts`):

| Field | Type | Initial value |
|---|---|---|
| `localPart` | string (as typed) | `''` |
| `domain` | `Domain['name'] \| null` | `?domain=` if it is in scope |
| `displayName` | string | `''` |
| `templateId` | `MailboxTemplate['id'] \| null` | `?template=` or the Default template |
| `password` | string (memory only) | `''` |
| `authSource` | `MailboxAuthSource` | `'mailcow'` |
| `quota` | `{ unlimited: boolean; bytes: number \| null }` | pre-fill rule (§7.5) |
| template-driven fields | as in `MailboxTemplate`: `status`, `forcePasswordChange`, `forceSecondFactorSetup`, `webmailRedirect`, `protocolAccess`, `userPermissions` (present keys), `tags`, `taggedMailHandling`, `quarantineNotification`, `quarantineCategory`, `tlsEnforceInbound`, `tlsEnforceOutbound`, `rateLimit` | from the template |
| `touched` | `Set<TemplateDrivenField>` | empty |

**Section drafts** (`composables/useMailboxSection.ts`):

| Section | Draft | Patch rule (`patch.ts`) |
|---|---|---|
| General | `displayName`, `quota {unlimited, bytes}`, `status`, `webmailRedirect` | each scalar when changed; `quota` as bytes, 0 for unlimited |
| Sign-in | `authSource`, `password`, `forcePasswordChange`, `forceSecondFactorSetup`, `recoveryEmail` | `password` only when non-empty; `recoveryEmail: ''` → `null` |
| Protocols | the six booleans | `protocolAccess` with the changed members only |
| Permissions | the present keys | `userPermissions` with the changed members only |
| Tags | `string[]` | the whole set when it differs as a case-insensitive set |
| Attributes | rows `{ rowId, name, value, storedName? }` | changed or added names → value; removed or renamed stored names → `null` |

**`TemplateForm`** (`templates/useTemplateForm.ts`): `name` plus the template-driven fields
above. A new form starts from `built-in-defaults.ts`. The create request sends every value
(research R14). Edits send the changed values of one group.

### View models

- **`PasswordRule`** (`password/policy-rules.ts`): `{ id: 'minLength' | 'letters' | 'digits' |
  'special' | 'mixedCase', messageKey, params, met: boolean }`.
- **`Gate`** (`acl.ts`): `{ state: 'editable' } | { state: 'readOnly', flag: keyof PermissionFlags }
  | { state: 'hidden' }`.
- **`DeletionImpact`** (`deletion.ts`): derived from `MailboxDeletionPreview`:
  - `storageUsed`, `messageCount`, `retention` (`{ unit: 'day' | 'hour' | 'minute', value }`);
  - `exclusiveAliases` and `sharedAliasCount`;
  - `items`: the non-zero counts and the present flags, each `{ key, count? }`;
  - `blockers`, `etag`.
- **`BulkActionDef`** (`bulk.ts`): `{ action, protocol?, labelKey, effectKey, confirmKey,
  destructive, requiresTypedCount, gate }`.
- **`RenameReportView`** (`problems.ts`): `{ kind: 'incomplete' | 'unknown' | 'undone',
  previousAddress, newAddress, steps: { step, outcome }[], unknownStep? }`.
- **`CreationNotice`** (`api.ts`, a module-level one-shot in memory): `{ address, failedSteps:
  ('rateLimit' | 'taggedMailHandling' | 'groupwareDirectoryUpdate')[], domain, templateId }`. The
  detail page consumes it once.

## 3. Server-state cache

### Query keys (`src/api/query/keys.ts`, extended)

| Key | Operation | staleTime | Fetched when | Notes |
|---|---|---|---|---|
| `['mailboxes','list',MailboxListParams]` | `listMailboxes` | 30 s | list page; params from the address | `placeholderData: keepPreviousData` while paging |
| `['mailboxes','detail',address]` | `getMailbox` | 30 s | detail layout | `initialData` from cached list pages with `initialDataUpdatedAt: 0` (FR-017); `address` lower-cased |
| `['mailboxes','deletion-preview',address]` | `previewMailboxDeletion` | 0, `gcTime` 0 | each time a delete dialog opens | never reused |
| `['mailboxes','capabilities']` | `getMailboxCapabilities` | 5 min | list, forms, dialogs | — |
| `['mailboxes','tags',{q}]` | `listMailboxTags` | 30 s | tag filter and tag input, debounced 300 ms | `useInfiniteQuery`, 25 per page |
| `['mailbox-templates','list',MailboxTemplateListParams]` | `listMailboxTemplates` | 30 s | template list | — |
| `['mailbox-templates','all']` | `listMailboxTemplates` (`limit=1000&sort=name`) | 30 s | create screen | Default first |
| `['mailbox-templates','detail',id]` | `getMailboxTemplate` | 30 s | template detail | `initialData` from cached lists |
| `['password-policy']` | `getPasswordPolicy` | 0, `refetchOnMount: 'always'` | each password form | FR-030 |
| `['domains', …]` | `listDomains`, `getDomain` | UI 002 | domain picker, create figures | UI 002's keys and queries, reused through `@/features/domains` |

### Invalidation after mutations

| Mutation | On success | On 412 |
|---|---|---|
| `createMailbox` | write `['mailboxes','detail',address]` without `creationReport`; invalidate `['mailboxes','list']`, `['mailboxes','tags']` and `['domains']`; set the `CreationNotice` | — |
| `updateMailbox` | write the detail; patch the entry in every cached `['mailboxes','list',…]` page; invalidate `['mailboxes','list']`. Invalidate `['mailboxes','tags']` if `tags` was sent, and `['domains','detail',domain]` plus `['domains','list']` if `quota` or `status` was sent | refetch the detail; mark the changed fields (§7.1) |
| `deleteMailbox` | remove the detail and the preview; invalidate `['mailboxes','list']`, `['mailboxes','tags']` and `['domains']` | refetch the preview and the detail; confirm again |
| `renameMailbox` | remove the old detail; write the new detail; invalidate `['mailboxes','list']` and `['domains']` (an alias may be added) | refetch; confirm again |
| `applyMailboxBulkAction` | invalidate `['mailboxes','list']` and the details of the targets. For `delete`, remove those details, and invalidate `['mailboxes','tags']` and `['domains']` | per item (`outdated`) |
| `createMailboxTemplate`, `updateMailboxTemplate`, `deleteMailboxTemplate` | write or remove `['mailbox-templates','detail',id]`; invalidate `['mailbox-templates']` | refetch; mark or confirm again |
| `403 attribute-not-permitted` or `permission-flag-required` | — | invalidate `['identity']` and the affected mailbox |

Mutations that carry a password (`createMailbox`, and `updateMailbox` from the sign-in section)
use `gcTime: 0` and are reset when they settle (research R8).

## 4. Client state and device storage

- **Pinia**: nothing new.
- **Device storage**: one convenience key is added to the allowlist of
  `src/shared/platform/storage.ts`. Its unit test and the storage audit end-to-end test (UI 001
  T145) are extended to match.

  | Storage | Key | Value | Purpose |
  |---|---|---|---|
  | `localStorage` | `mailcowui-ng.mailboxes.columns` | JSON array of optional column ids from §2, at most 20 | columns shown in the wide list (FR-008) |

- **Not stored**: list state (search, filters, sort, page and page size) lives in the address only
  (conventions "Lists"). Passwords, drafts and selections live only in component memory.

## 5. Route map

The base is `/ng/`. Every component is lazy. "Access" is UI 001's catalogue check in
`ShellLayout`. Role restrictions within an entry are rendered in place with `NoAccessState`.

| Name | Path | Catalogue entry | Extra access | Title key | Component |
|---|---|---|---|---|---|
| `mailboxes` | `/mailboxes` | `mailboxes` | — | `mailboxes.list.title` | `features/mailboxes/pages/MailboxesPage.vue` |
| `mailbox-create` | `/mailboxes/new` | `mailboxes` | — | `mailboxes.create.title` | `pages/MailboxCreatePage.vue` |
| `mailbox-detail` (layout) | `/mailboxes/:address([^/]+@[^/]+)` | `mailboxes` | — | `mailboxes.detail.title` (with the address) | `pages/MailboxDetailPage.vue` |
| `mailbox-overview` | `''` (child) | | | | `sections/MailboxOverview.vue` |
| `mailbox-general` | `general` | | | `mailboxes.sections.general` | `sections/GeneralSection.vue` |
| `mailbox-sign-in` | `sign-in` | | | `mailboxes.sections.signIn` | `sections/SignInSection.vue` |
| `mailbox-protocols` | `protocols` | | | `edit.allowed_protocols` | `sections/ProtocolAccessSection.vue` |
| `mailbox-permissions` | `permissions` | | | `mailboxes.sections.permissions` | `sections/PermissionsSection.vue` |
| `mailbox-tags` | `tags` | | | `add.tags` | `sections/TagsSection.vue` |
| `mailbox-attributes` | `attributes` | | | `edit.custom_attributes` | `sections/CustomAttributesSection.vue` |
| `mailbox-rename` | `rename` | | | `edit.mailbox_rename` | `sections/RenameSection.vue` |
| `mailbox-delete` | `delete` | | | `mailbox.remove` | `sections/MailboxDeleteRoute.vue` (overview plus the open dialog) |
| `mailbox-templates` | `/mailbox-templates` | `mailboxTemplates` (new) | — | `mailbox.mailbox_templates` | `pages/templates/MailboxTemplatesPage.vue` |
| `mailbox-template-create` | `/mailbox-templates/new` | `mailboxTemplates` | administrators | `mailbox.add_template` | `pages/templates/MailboxTemplateCreatePage.vue` |
| `mailbox-template-detail` | `/mailbox-templates/:templateId(\\d+)` | `mailboxTemplates` | — | `mailboxTemplates.detail.title` | `pages/templates/MailboxTemplateDetailPage.vue` |

**Catalogue changes** (`src/app/navigation/catalogue.ts`):

- `mailboxes`: its `status` becomes `available` (US1).
- New row `mailboxTemplates`, placed after `mailboxes`:
  - path `/mailbox-templates`;
  - admin ✓, domainAdmin ✓, mailboxUser —;
  - delivered by 003;
  - classic links: `/admin/mailbox` and `/domainadmin/mailbox`;
  - it starts as `placeholder` (T005) and becomes `available` in US7.

  UI 001's table-driven visibility test covers the new row. `nav.mailboxTemplates` is translated.

The not-found screen for a mailbox or template address shows `NotFoundState` in place, with a link
to the list (FR-004). A mailbox user at any of these addresses gets `NoAccessState` from the
catalogue (US1-AS11).

### Address parameters (`useListState` schemas)

Defaults are left out of the address. Invalid values fall back to the default, and the address is
normalised with `router.replace`.

**Mailbox list** (`/mailboxes`, `list-state.ts`):

| Param | Type | Default | Maps to |
|---|---|---|---|
| `q` | string ≤ 255 | — | `q` |
| `domain` | repeatable string ≤ 255, ≤ 100 values | — | `domain` (exploded) |
| `status` | repeatable `active`, `loginDisabled`, `inactive` | — | `status` |
| `tag` | repeatable string 1–255, ≤ 100 values | — | `tag` |
| `source` | repeatable `mailcow`, `keycloak`, `genericOidc`, `ldap` | — | `authSource` |
| `sort` | one of the 12 `MailboxSort` values | `address` | `sort` |
| `order` | `asc`, `desc` | `asc` | `order` |
| `page` | integer ≥ 1 | 1 | `offset = (page − 1) × size` |
| `size` | 25, 50, 100 | 25 | `limit` |

**Template list** (`/mailbox-templates`, `templates/list-state.ts`): `q` (≤ 255), `sort` (`name`,
`id`, `createdAt`, `modifiedAt`; default `name`), `order` (default `asc`), `page` and `size`.

**Create screen** (`/mailboxes/new`): `domain` (an ASCII or readable domain name; ignored when it
is not in scope) and `template` (a positive integer; ignored when unknown).

**History link**: `/audit-log?targetType=mailbox&targetId=<address>` and
`/audit-log?targetType=mailboxTemplate&targetId=<id>`. These are UI 002's audit list parameters.

## 6. Client-side validation

These checks run before submitting. Server field errors are always shown too. "Capability" means a
value of `MailboxCapabilities`. When the capabilities are unavailable, that check is skipped and the
API decides (research R16).

| Field | Rule (quoted from the contract or spec) | Message key |
|---|---|---|
| Local part (create, rename) | "Trimmed and lower-cased, then 1 to 64 ASCII letters, digits and ``! # $ % & ' * + / = ? ^ _ ` { \| } ~ - .``, without a leading or trailing dot or two dots in a row"; full address "at most 255 characters" | `validation.required`, `validation.format.localPart`, `mailboxes.validation.addressTooLong` |
| New local part (rename) | as above, and not equal to the current local part ignoring letter case ("a change of letter case only is not a rename") | `validation.unchanged` |
| Keep old address as alias (rename) | required yes or no, nothing preselected | `validation.required` |
| Backup acknowledgement (rename) | checked before the form shows | — |
| Domain (create) | required; a primary domain from the picker | `validation.required` |
| Display name | at most 255 characters | `validation.tooLong` |
| Password (create, built-in source) | required, 1–255 characters | `validation.required`, `validation.tooLong` |
| Password (sign-in section) | optional; at most 255; empty leaves it unchanged | `validation.tooLong` |
| Quota | unlimited, or a number with MiB, GiB or TiB that "comes to a whole number of MiB and at least 1 MiB"; typing 0 is refused | `validation.quota.wholeMib`, `validation.quota.min` |
| Quota maximum | create: ≤ `usage.maxNewMailboxQuota` of the chosen domain; edit: ≤ `largestAllowedQuota`; templates: none | `mailboxes.validation.quotaMax` (with the maximum in binary units) |
| Quota below the storage used (edit) | allowed, with a warning | `mailboxes.quota.belowUsed` (warning, not an error) |
| Unlimited quota | offered only to administrators, to domain administrators with `unlimitedQuota`, or for a mailbox that is already unlimited | — |
| Recovery e-mail | empty (clears it) or a valid address of at most 255 characters | `validation.format.email`, `validation.tooLong` |
| Tags | each trimmed, 1 to capability `tagMaxLength` (255) characters; duplicates that differ only in letter case are merged; at most capability `taggingLimit` (25 by default); a mailbox above the limit can only shrink, and Save stays disabled until the set is within it | `validation.tooLong`, `mailboxes.tags.limit` (with the limit) |
| Custom attribute name | 1 to capability `customAttributeNameMaxLength` (255) characters, no whitespace (`^\S+$`), unique within the mailbox | `validation.required`, `validation.format.attributeName`, `mailboxes.attributes.duplicate` |
| Custom attribute value | at most capability `customAttributeValueMaxLength` (4,096) characters | `validation.tooLong` |
| Custom attribute count | at most capability `customAttributeLimit` (100) after the change | `validation.tooMany` |
| Rate limit | none, or an integer 1–2,147,483,647 with a frame of `second`, `minute`, `hour` or `day` | `validation.outOfRange` |
| Template name | trimmed, 1–255 characters; uniqueness without regard to letter case is checked by the API | `validation.required`, `validation.tooLong` |
| Bulk selection | 1 to capability `bulkLimit` items, from the current page | `mailboxes.bulk.limit` |
| Bulk deletion | the typed number equals the selection size | handled by `ConfirmDialog` `requireTyped` |

## 7. State machines

### 7.1 Section save (`useMailboxSection`)

```text
clean ──edit──► dirty ──save──► saving ──200──► clean (base := response; password cleared; announced)
  ▲               │                │ 412 ──► refetch ──► dirty+marked (untouched fields follow the
  │               │                │         server; touched keep the user's values; base := reloaded)
  │               │                │ 403 attribute-not-permitted ──► dirty (field errors; identity
  │               │                │         and mailbox refetched)
  │               │                │ 422 ──► dirty (field errors)   503/network ──► dirty (message)
  │               │                │ 404 ──► not found
  └── discard ────┘ leave while dirty ──► confirm "Discard changes?" ──yes──► leave / no ──► stay
```

### 7.2 Delete dialog (`MailboxDeleteDialog`)

```text
open ──► loading preview ──ok──► shown (canProceed?) ──confirm──► deleting ──204──► done
             │ 404 ──► gone (list refreshed)                │        │ 412 ──► loading preview (again)
             └ error ──► error (retry)                       │        │ 404 ──► gone
   preview.etag ≠ version read ──► shown + "changed since opened"     │ 503 ──► shown + "not deleted"
   canProceed = false ──► blocked (blockers named; "Check again")     │ 504 ──► shown + "outcome unknown"
```

### 7.3 Rename (`RenameSection`)

```text
unavailable (status inactive)
acknowledge ──checked──► form ──valid──► confirm ──yes──► renaming ──200──► detail of the new address
                                                           │ 409/422 ──► form (errors)
                                                           │ 412 ──► reload ──► confirm (again)
                                                           │ 503 ──► form ("keeps the old address")
                                                           │ 500 incomplete / 504 unknown ──► report
                                                           │      (persistent; stays until dismissed)
```

### 7.4 Bulk action (`useMailboxBulk`)

```text
idle ──select──► selecting(n ≤ bulkLimit) ──action──► confirming ──yes──► sending
  ▲  list-state reset ──► idle (announced)              │ no ──► selecting
  │                                                     sending ──200──► summary (refused, outdated
  │                                                     │           and failed stay selected;
  │                                                     │           list refetched)
  │                                                     │ 403/422 ──► selecting (one message)
  └────────────── close summary ◄───────────────────────│ network ──► selecting ("outcome unknown";
                                                                  list refetched; no retry)
```

### 7.5 Create screen

```text
loading (templates, capabilities, policy) ──► editing
editing ──choose template──► touched ∩ template fields = ∅ ? apply : confirm(replace?) ──yes──► apply
                                                                                         └no──► keep previous
editing ──choose domain──► read domain ──► figures; quota pre-fill unless the quota was touched
editing ──submit──► creating ──201──► detail (announced; CreationNotice) ──► "Add another"
                       │ 409/422/403 ──► editing (entries kept, errors on fields)
                       │ network ──► editing (entries kept, message)
```

**Quota pre-fill** (`quota.ts`): with `t` the chosen template and `d` the chosen domain's usage:

- if `t.isDefault`, or `t.quota === 0` and unlimited is not allowed: `d.defaultNewMailboxQuota`;
- otherwise `t.quota`, where 0 sets the "Unlimited" switch.

When `d.maxNewMailboxQuota === 0`: administrators get "Unlimited", forced. Domain administrators
without `unlimitedQuota` get "creation not possible" (§6).

### 7.6 Template application (create screen)

| Event | `touched` empty | `touched` not empty |
|---|---|---|
| Initial load | apply silently | — |
| Template changed | apply; `touched` stays empty | confirm. **Yes**: apply all, clear `touched`. **No**: restore the previous choice |
| User edits a template-driven field | add it to `touched` | add it to `touched` |

## 8. Designated action areas for later features

| Component | Area | Added by later features |
|---|---|---|
| `components/MailboxRowActions.vue` | menu of each list card and row: "Edit", "Remove" | UI 007: "Sign in as", "Open webmail as" |
| `components/MailboxSectionNav.vue` plus the detail child routes in `routes.ts` | the section list | UI 004: "Send as"; UI 009: "Relayhost" |
| `components/ManagedSettingsGroup.vue` | the FR-040 entries; each has `labelKey`, `value`, `managedByKey` and an optional `to` | UI 005 (tagged mail, TLS, temporary aliases, push), UI 006 (quarantine notification and category, rate limit), UI 009 (relayhost) fill `to` |
| `components/MailboxBulkActions.vue` | the bulk action menu, from `bulk.ts` | UI 005 and UI 006: TLS and quarantine bulk actions |
| `pages/MailboxDetailPage.vue` header | page actions | UI 007: "Sign in as" |

Until a feature ships, nothing is rendered for it (conventions).

## 9. Translation scope added by UI 003

**`src/i18n/enum-scope.json`** (research R2) gains these values:

| Enumeration | Values |
|---|---|
| `AuditEventType` | `mailboxCreation`, `mailboxUpdate`, `mailboxDeletion`, `mailboxRename`, `mailboxTemplateCreation`, `mailboxTemplateUpdate`, `mailboxTemplateDeletion` |
| `AuditTarget.type` | `mailbox`, `mailboxTemplate` |
| `AuditFailureReason` | `outcomeUnknown`, `partiallyCompleted`, plus `attributeNotPermitted`, `versionOutdated`, `validationFailed`, `conflict`, `temporaryFailure`, `permissionDenied` and `notFound` unless UI 002 listed them |
| `ValidationRuleCode` | `notMultipleOf`, `missingCharacterClass`, `conflictsWith`, `unchanged`, `immutable`, plus `outOfRange`, `notEligible`, `tooMany` and `notInList` unless already listed |
| `KnownProblemType` | `address-in-use`, `mailbox-limit-reached`, `mailbox-not-renamable`, `mailbox-rename-incomplete`, `outcome-unknown`, `mailbox-template-name-exists`, `mailbox-template-protected`, `domain-alias-limit-reached`, `permission-flag-required`, plus `attribute-not-permitted` and `temporary-failure` unless already listed |

**Message namespaces**:

- `mailboxes.*`: list, filters, columns, create, sections, password, quota, tags, attributes,
  bulk, delete, rename, problem variants, managed settings;
- `mailboxTemplates.*`;
- `nav.mailboxTemplates`;
- additions to `problem.*`, `validation.*` (formats `localPart`, `email`, `attributeName`;
  `missingCharacterClass.<class>`; quota limits) and `auditLog.*` (event types, targets, failure
  reasons, detail-key labels).

Legacy keys are mapped as research R3 lists.
