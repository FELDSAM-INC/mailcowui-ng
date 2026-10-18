---
description: "Task list for UI feature 010: DKIM, MTA-STS and DNS"
---

# Tasks: DKIM, MTA-STS and DNS

**Input**: Design documents from `specs/010-dkim-mta-sts-dns/`:
- [plan.md](./plan.md)
- [spec.md](./spec.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/README.md](./contracts/README.md)
- [quickstart.md](./quickstart.md)

**Prerequisites**:
- **UI features 001–009 are implemented and merged.** In particular:
  - UI 001: foundation, audit log;
  - UI 002: domain list and page, `EditableSection`, `useBulkSelection`, `BulkActionBar`,
    `BulkResultSummary`, `ConfirmDialog` `requireTyped`, `useLeaveGuard`, `HistoryLink`, audit
    target filters, `src/i18n/coverage.json`;
  - UI 004: alias domain list and detail, `useSequentialCreate`, `DomainNameText`, `SearchField`;
  - UI 005: `OneTimeSecretDialog`, `CopyButton`.
- **mailcow-rest-v2 feature 010**: its contract is merged (commit `3207925` or later). It is
  implemented in the API dev stack for the smoke tasks (T110).

T001 verifies both before any other task.

**Tests**: Mandatory (constitution VI, test-first). In every phase, tests are written first and must
fail before the implementation tasks that follow them. Every end-to-end spec:
- runs on the `mobile-chromium` (360 px), `desktop-chromium` and `mobile-webkit` projects;
- calls `expectAccessible` (axe, WCAG 2.2 AA, both themes) on every screen, dialog and state it
  reaches, plus `expectNoHorizontalScroll` and `expectTouchTargets`;
- fails on any CSP violation or mock contract violation (UI 001 fixtures);
- names its spec reference in the test title (`US1-AS3 …`, `FR-066 …`, `Edge: …`).

**Organization**: Tasks are grouped by user story (spec priorities P1 to P3), so that each story can
be implemented and tested on its own once the foundation is in place.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task belongs to (US1 to US8)
- Paths are relative to the repository root `mailcowui-ng/`. Paths of UI 002, 004 and 005 files
  are those their plans name, as listed in plan.md and confirmed or corrected by T001.

---

## Phase 1: Setup (Prerequisites and contract)

**Purpose**: Confirm the prerequisites, pin the contract and prepare the generated types and the
translation check (research R1, R3, R22).

- [ ] T001 Verify the prerequisites and reconcile the plan with the repository:
  - Confirm that UI 001–009 are merged and that their tests pass on `main`.
  - For every row of plan.md "Building blocks from earlier features" and "Entry points into earlier
    screens", locate the file, export or route name in the repository.
  - Where the code differs from the paths that the UI 002, 004 and 005 plans named, update both
    tables in `specs/010-dkim-mta-sts-dns/plan.md` with the actual paths.
  - Record for T022–T025 and T027:
    - whether `CopyButton` already has a select-in-place fallback;
    - whether `useSequentialCreate` already has an `unknown` outcome;
    - where UI 002's `domain-name.ts` and UI 005's `download.ts` live (promoted already or still
      feature-local);
    - whether the router already restores the scroll position.
  - Stop and report if a hard prerequisite of the plan's table is missing. They are
    `EditableSection`, `useBulkSelection`, `BulkActionBar`, `BulkResultSummary`, `requireTyped`,
    `useLeaveGuard`, `HistoryLink`, `OneTimeSecretDialog`, `useSequentialCreate`, `DomainNameText`,
    `SearchField` and `src/i18n/coverage.json`.
- [ ] T002 Pin the contract (research R1):
  - If `contract/VERSION.json` `commit` is neither `32079252d55797d3da4e58ae661e9fb91c51c6f9` nor a
    descendant of it (`git -C ../mailcow-rest-v2 merge-base --is-ancestor 3207925 <commit>`), run
    `scripts/contract/bump.sh 32079252d55797d3da4e58ae661e9fb91c51c6f9`. Otherwise keep the pin, and
    diff `api/modules/{dkim,mta-sts,dns-diagnostics}` and their referenced components between
    `3207925` and the pinned commit.
  - Regenerate (`npm run contract:generate`) and run `npm run typecheck`, `npm run test:unit` and
    `npm run test:e2e`.
  - `npm run i18n:check` reports unlisted values of the shared enumerations only as warnings
    (UI 002 D2), so the bump adds no translations. The 010 keys come in T029 and the story tasks.
  - Record the vendored commit and sha256 in the "Pin as implemented" line of
    `specs/010-dkim-mta-sts-dns/contracts/README.md`.
- [ ] T003 [P] Re-export from `src/api/index.ts` the root types listed in data-model §1 that are not
  exported yet:
  - `DnsCapabilities`, `DkimKey`, `DkimKeyDetails`, `DkimDnsRecord`, `DkimKeyChangeResult`,
    `DkimDnsPublicationOutcome`, `DkimKeyGenerateRequest`, `DkimKeyImportRequest`,
    `DkimKeyCopyRequest`, `DkimKeyBulkActionRequest`, `DkimPrivateKey`, `MtaStsPolicy`,
    `MtaStsDnsRecord`, `MtaStsPolicyCreateRequest`, `MtaStsPolicyPatch`, `DnsDiagnosticsResult`,
    `DnsCheck` and `DnsCheckMessage`;
  - the enumeration arrays `dkimKeyStateValues`, `dkimKeyKindValues`,
    `dkimKeyDetailsMissingPartsValues`, `dkimDnsPublicationStatusValues`,
    `dkimDnsPublicationReasonCodeValues`, `dnsCheckStatusValues`, `dnsCheckMessageCodeValues`,
    `dnsCheckScopeValues`, `mtaStsModeValues` and `bulkItemOutcomeValues`.

  No hand-written type may restate any of them (constitution I).
- [ ] T004 [P] Extend the translation check (research R22, UI 002 D2):
  - in `scripts/i18n/check.mjs`, add these enumerations to the fully required set, so that every
    value needs a key: `DkimKeyState` (`dns.dkim.states.*`), `DkimKeyKind`
    (`dns.dkim.kinds.*`), `DkimKeyDetails.missingParts` (`dns.dkim.missingParts.*`),
    `DkimDnsPublicationStatus` (`dns.publication.status.*`), `DkimDnsPublicationReasonCode`
    (`dns.publication.reasons.*`), `DnsCheckStatus` (`dns.diagnostics.status.*`),
    `DnsCheckMessageCode` (`dns.diagnostics.messages.*`), `DnsCheck.scope`
    (`dns.diagnostics.scopes.*`). `MtaStsMode` is not translated: legacy shows the raw values
    `enforce`, `testing` and `none` (constitution IV 1.3.0, research R22). Where a value has a
    legacy key (`admin.dkim_key_valid`, `admin.dkim_key_missing`, `admin.dkim_key_unused`), the
    check accepts that key instead of a new string;
  - in `src/i18n/coverage.json`, append:
    - `AuditEventType`: `dkimKeyGeneration`, `dkimKeyImport`, `dkimKeyCopy`, `dkimKeyDeletion`,
      `dkimPrivateKeyExport`, `dkimDnsPublication`, `mtaStsPolicyCreation` and
      `mtaStsPolicyUpdate`;
    - `AuditTarget.type`: `dkimKey` and `mtaStsPolicy`;
    - `ValidationRuleCode`: `invalidPrivateKey`, `encryptedPrivateKey`, `unsupportedKeyType`,
      `keyLengthOutOfRange` and `sameAsSource`;
    - `problemTypes`: `dkim-key-exists`, `dkim-private-key-export-disabled`,
      `dkim-dns-publication-disabled`, `mta-sts-policy-exists`, and `temporary-failure` if not
      listed yet;
  - add the formats `dkimSelector`, `domainName` and `mxHost` to the required `validation.format.*`
    set, unless an earlier feature added them.

  Run `npm run i18n:check`. It must now fail on the missing 010 keys, which T029 and the story
  tasks add.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The mock API for DNS, the capabilities read, the catalogue split, the shared building
blocks of research R3, the publication outcome component and the base translations.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Legacy form map

- [ ] T004a Write the legacy form map for this feature's screens (screen → legacy template → field → legacy key, including messages) in `plan.md`, and use only those keys plus the minimal new strings in the implementation.
  Follow `docs/conventions.md` "Translations and forms" and the templates in plan.md "Translations and forms (constitution IV 1.3.0)"; list any deviation under "Deviations needing a decision". Every later screen task depends on it.

### Test infrastructure

- [ ] T005 [P] Create the factories (research R24):
  - `tests/mocks/factories/dkim-key.ts`:
    - an RSA key pair per size via `node:crypto` `generateKeyPairSync`, memoised per size;
    - `publicKey` as base64 DER SPKI, and `keyLength` exact;
    - `record.name` `<selector>._domainkey.<name>`;
    - `record.value` `v=DKIM1;k=rsa;t=s;s=email;p=<publicKey>`;
    - `valueParts` of at most 255 characters each, joined equal to `value`;
    - `complete` and `missingParts`;
    - a strong `etag` that changes whenever the key changes;
    - the private key PEM, kept in the scenario only and never returned except by the export
      handler.
  - `tests/mocks/factories/mta-sts-policy.ts`:
    - `policyId` as `YYYYMMDDhhmmss`, always greater than the previous one;
    - `policyUrl` `https://mta-sts.<domain>/.well-known/mta-sts.txt`;
    - `policyText`;
    - `dnsRecords`: `_mta-sts.<domain>` TXT `v=STSv1;id=<policyId>;` and `mta-sts.<domain>` CNAME to
      the server host name;
    - `etag`.
  - `tests/mocks/factories/dns-diagnostics.ts`: builders for a `DnsCheck` of every status, with and
    without `optional`, and for every `DnsCheckMessageCode` with valid `params`. Results get
    consistent `summary` counts, `checkedAt`, the server facts and a zone file.
  - `tests/mocks/factories/dkim-publication.ts`: outcomes for every `DkimDnsPublicationStatus`, and
    `failed` with every reason code, with and without `detail`.
- [ ] T006 Create the scenario area `tests/mocks/scenarios/dns.ts` and register it in
  `tests/mocks/scenarios/index.ts`. Extend `tests/mocks/scenarios/state.ts` with:
  - the DKIM entries per name: kind, target domain, key, private key PEM and stored-name spelling;
  - the capabilities configuration: `serverHostname`, default selector, allowed sizes, limits, and
    publication and export switches;
  - the MTA-STS policies;
  - the diagnostics templates per name;
  - the rate-limit counters per caller;
  - injections settable through `PATCH /__mock/scenarios/:id`: the publication outcome per
    operation, `503` per operation, a concurrent key or policy change, a diagnostics response delay,
    export or publication toggled at runtime, and the rate-limit remaining count.

  Base scenario `dns-base`: the `admin` account with upstream defaults, `serverHostname`
  `mail.example.org`, selector `dkim`, publication off, export off. Stories add their named
  scenarios in this module.
- [ ] T007 Create the handler modules, register all three in `tests/mocks/handlers/index.ts`, and
  wrap them with the validator:
  - `tests/mocks/handlers/dkim.ts` with `getDnsCapabilities`:
    - administrators get every value;
    - domain administrators get `privateKeyExportEnabled: null` and `serverChecks: false`;
    - mailbox users get `403 forbidden`.
  - `tests/mocks/handlers/mta-sts.ts` and `tests/mocks/handlers/dns-diagnostics.ts`, empty. Stories
    fill all three files.
- [ ] T008 [P] Write `tests/unit/mocks/dns-factories.spec.ts`:
  - every factory output passes the contract validator (`DkimKey`, `DkimKeyChangeResult`,
    `MtaStsPolicy`, `DnsDiagnosticsResult`);
  - `valueParts` join to `value` with no piece over 255 characters;
  - `policyId` increases strictly;
  - the `summary` per status equals the checks.

### Tests for the foundation (write first; must fail)

- [ ] T009 [P] Extend `tests/unit/shared/validation/limits.spec.ts`. Each new constant must equal its
  value in `contract/openapi.json`:
  - `dkimBulkTargets` 100 (`DkimKeyBulkActionRequest.targets.maxItems`);
  - `dkimNameMax` 255 (`DkimKeyGenerateRequest.name.maxLength`);
  - `mtaStsMxHostsMax` 128 (`MtaStsPolicyCreateRequest.mxHosts.maxItems`);
  - `mtaStsMxHostMax` 255 (its items' `maxLength`);
  - `searchMax` 255 (`Search` `q.maxLength`);
  - `dkimSelectorFilterMax` 255 and `dkimDomainFilterMax` 255 (the `listDkimKeys` `selector` and
    `domain` parameters).

  Extend `tests/unit/api/query-keys.spec.ts` with the keys of data-model §3.
- [ ] T010 [P] Write `tests/unit/features/dns/capabilities.spec.ts` (research R4):
  - one query `['dns-capabilities']` with `staleTime` 300 s;
  - invalidated after `forbidden`, `dkim-private-key-export-disabled` and
    `dkim-dns-publication-disabled` problems;
  - `privateKeyExportEnabled: null` treated as "never" for domain administrators;
  - a failed read exposes an error with retry and does not block read-only screens.
- [ ] T011 [P] Write `tests/unit/features/dns/permissions.spec.ts`. It is table-driven over role
  (`admin`, `domainAdmin`) × entry (valid complete, valid incomplete, missing, unused complete,
  unused incomplete, alias domain) × export (on, off) × publication (on, off). It asserts every flag
  of data-model §2 `DkimActions` and the list-level actions (FR-002, SC-006).
- [ ] T012 [P] Write `tests/unit/features/dns/names.spec.ts`:
  - entry and diagnostics locations for ASCII names, Unicode display names, an unused
    `Legacy.Example` name and a name containing `/`, each round-tripping through the router;
  - `safeFileName()` replaces every character outside `[A-Za-z0-9._-]` with `_`;
  - `zoneFileName(name)` gives `<name>.txt`;
  - `privateKeyFileName(selector, name)` gives `<selector>.<name>.pem`.
- [ ] T013 [P] Extend `tests/unit/shared/components/CopyButton.spec.ts` (UI 005), or write it if
  T001 found no `CopyButton` (research R6):
  - it copies exactly the given text;
  - it announces "{label} copied";
  - its accessible name is the given label;
  - on refusal, or with no `navigator.clipboard`, the `selectTarget` element is selected in place
    with the "could not be copied automatically" message (FR-075);
  - the button has the `min-h-11 min-w-11` classes;
  - the "Copied" state stays while the button has focus or the pointer, and reverts 2 s after it
    leaves (FR-074).

  Write `tests/unit/features/dns/RecordValue.spec.ts`: a labelled monospace value, a
  1,000-character value that wraps (`overflow-wrap: anywhere` class), and the `copyLabel` passed to
  `CopyButton` with the value element as `selectTarget`.
- [ ] T014 [P] Write `tests/unit/shared/platform/download.spec.ts` (research R13):
  - the Blob text equals the input byte for byte (CRLF and a trailing newline kept, no BOM);
  - `download` equals the file name;
  - the object URL is revoked after the click;
  - nothing is written to storage.
- [ ] T015 [P] Extend `tests/unit/shared/composables/useSequentialCreate.spec.ts` (UI 004) with
  the `unknown` outcome, unless T001 found it already tested:
  - a network failure, or a non-problem 5xx, marks the entry in flight `unknown`, stops the run,
    and leaves the remaining entries `notProcessed`;
  - nothing is retried on its own.

  Write `tests/unit/features/dns/RunResultList.spec.ts` (data-model §7):
  - one row per entry with its outcome and translated reason, and the counts;
  - for created keys, the `PublicationOutcome` and a link to the entry;
  - "Retry" offered for refused, unknown and not-processed entries only;
  - the progress bar (`role="progressbar"`, `aria-valuenow`);
  - announcements at the start, each 10 % step and the end.
- [ ] T016 [P] Move UI 002's test of `src/features/domains/domain-name.ts` to
  `tests/unit/shared/validation/domain-name.spec.ts`, unless T001 found it promoted already, and
  extend it:
  - readable or ASCII names; labels of letters, digits and inner hyphens; at most 253 characters
    as ASCII (via `new URL('http://' + name).hostname`) and at most 63 per label;
  - the `wildcard` option accepts a leading `*.`;
  - one trailing dot is removed;
  - UI 002's existing cases still pass.
- [ ] T017 [P] Write `tests/unit/features/dns/PublicationOutcome.spec.ts` (research R16):
  - nothing renders while `dnsPublicationEnabled` is false;
  - every status has its translated label and advice;
  - `failed` with every reason code;
  - an unknown reason code (a plain value, not mocked) shows the generic failure;
  - `detail` renders as plain text inside `lang="en"`;
  - `noZone` shows the "publish manually" advice;
  - the status is given in text and icon.
- [ ] T018 [P] Update `tests/unit/app/navigation/visibility.spec.ts`: the row `dns` is replaced by
  `dkimKeys` (`/dns/dkim-keys`) and `mtaStsPolicies` (`/dns/mta-sts-policies`), each admin `true`,
  domainAdmin `true`, mailboxUser `false`, `deliveredBy '010'`, starting as placeholder (research
  R2).
- [ ] T019 [P] Write `tests/e2e/dns/foundation.spec.ts` (FR-001):
  - administrator and domain administrator scenarios show "ARC/DKIM keys" and "MTA-STS policies" in
    the navigation, still as placeholders;
  - a mailbox user sees neither, and `/ng/dns/dkim-keys` shows "no access";
  - `/ng/dns` redirects to `/ng/dns/dkim-keys`;
  - axe, CSP and layout checks pass.

### Foundation implementation

- [ ] T020 Add the constants of T009 to `src/shared/validation/limits.ts`, each with a comment naming
  its schema path. Add the keys of data-model §3 to `src/api/query/keys.ts`, with list parameter
  types aliased from `operations['listDkimKeys' | 'listMtaStsPolicies']['parameters']['query']`.
  T009 must pass.
- [ ] T021 Split the catalogue row and create the feature skeleton (research R2):
  - In `src/app/navigation/catalogue.ts`, replace row `dns` with `dkimKeys` and `mtaStsPolicies`,
    both placeholders.
  - Create `src/features/dns/routes.ts` with the redirect `/dns` → `/dns/dkim-keys`, and
    `src/features/dns/index.ts`.
  - Register the routes in `src/app/router/routes.ts`.
  - Replace every reference to the catalogue id `'dns'` with `'dkimKeys'`, for example the
    `isEntryAvailable('dns')` links of UI 002's and UI 004's creation reports. The
    `NavigationEntry` id union makes `npm run typecheck` find them.
  - Remove `nav.dns` from `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. The `dkimKeys` entry uses
    the legacy key `admin.dkim_keys` verbatim; add `nav.mtaStsPolicies` as a new string only if the
    legacy form map (T004a) finds no legacy key for it.

  T018 and T019 must pass.
- [ ] T022 [P] Give `src/shared/components/CopyButton.vue` (UI 005) the `selectTarget` fallback, if
  T001 found it missing. If T001 found no `CopyButton`, create it on UI 001's
  `src/shared/platform/clipboard.ts` and `useAnnouncer`, using the legacy key
  `admin.copy_to_clipboard` verbatim for the copied message (falling back to `en-gb` where a locale
  lacks it) and new strings only for the other `common.copy.*` texts. Implement `src/features/dns/components/RecordValue.vue`. T013 must pass.
- [ ] T023 [P] Promote UI 005's `src/features/account/download.ts` to
  `src/shared/platform/download.ts` with `downloadText(text, fileName, mediaType)`, and update UI
  005's imports. If T001 found it promoted already, add `downloadText` if missing; if absent,
  create it. T014 must pass, and UI 005's profile download tests stay green.
- [ ] T024 [P] Promote UI 002's `src/features/domains/domain-name.ts` to
  `src/shared/validation/domain-name.ts`, add the `wildcard` option, and update UI 002's imports.
  Skip the move if T001 found it promoted already. T016 must pass, and UI 002's tests stay green.
- [ ] T025 [P] Add the `unknown` outcome to `src/shared/composables/useSequentialCreate.ts` if T001
  found it missing. Implement `src/features/dns/components/RunResultList.vue` with the progress
  announcements of research R8: start, each 10 % step, end. T015 must pass, and UI 004's tests stay
  green.
- [ ] T026 Implement:
  - `src/features/dns/api/capabilities.ts`: the query, and the invalidation hook registered in the
    query cache's `onError` for the three problem types;
  - `src/features/dns/permissions.ts`: `dkimActions` and the list-level actions;
  - `src/features/dns/names.ts`: route locations, `safeFileName`, `zoneFileName` and
    `privateKeyFileName`.

  T010, T011 and T012 must pass.
- [ ] T027 If T001 marked it "to create":
  - add to `src/app/router/index.ts` a `scrollBehavior` that returns `savedPosition` on history
    navigation, else the hash target or the top;
  - make `src/app/router/focus.ts` focus the `<h1>` with `preventScroll: true`.

  Extend `tests/unit/app/router/guards.spec.ts`, or the router's unit test, for both (FR-013).
- [ ] T028 [P] Implement `src/features/dns/components/PublicationOutcome.vue` (research R16). T017
  must pass.
- [ ] T029 Add the foundation's new strings of the legacy form map (T004a) to
  `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, never machine-translated, and use legacy keys
  verbatim wherever the form map names one (for example the `danger.*` message of a problem type or
  rule code with the same meaning):
  - `problem.dkim-key-exists`, `problem.dkim-private-key-export-disabled`,
    `problem.dkim-dns-publication-disabled` and `problem.mta-sts-policy-exists`, if not yet present;
  - `validation.invalidPrivateKey`, `validation.encryptedPrivateKey`,
    `validation.unsupportedKeyType`, `validation.keyLengthOutOfRange` and `validation.sameAsSource`;
  - `validation.format.dkimSelector`, `validation.format.domainName` and
    `validation.format.mxHost`;
  - `dns.common.*` (not found, no longer exists, nothing changed, try again in …, refresh);
  - `dns.publication.*`: every status and reason, "Technical detail", the advice;
  - `dns.capabilities.*`: the error of the capabilities read.

  Run `npm run i18n:check`. It must pass for these namespaces; the story namespaces follow.

**Checkpoint**: The foundation is ready. The navigation shows both DNS entries as placeholders for
administrators and domain administrators, the capabilities read and the shared blocks are tested,
and the mock serves `getDnsCapabilities`.

---

## Phase 3: User Story 1 - See DKIM keys and copy the DNS records they need (Priority: P1) 🎯 MVP

**Goal**:
- the DKIM key list with filters, search, sort and paging, in the address;
- the entry page with the record, the host label, the single and split forms and copy buttons;
- the DKIM section on the domain and alias domain pages;
- the read-only server settings for administrators.

**Independent Test**: Against the mock, open the list and several entries as an administrator and
as a domain administrator at 360 px and on desktop. Use every filter, search, sort and paging
option, press every copy button, and compare the copied text with the mock data.

### Tests for User Story 1 (write first; must fail)

- [ ] T030 [US1] Implement in `tests/mocks/handlers/dkim.ts`:
  - `listDkimKeys`:
    - scope per role (domain administrators: their domains and those domains' alias domains, never
      `unused`);
    - `q` over ASCII and readable names;
    - repeated `state`, `kind`, `selector`, `complete` and `domain` (a domain with its alias
      domains);
    - `sort` `name`, `state`, `selector` and `keyLength`, with entries without a key last for
      `selector` and `keyLength` ascending, and ties broken by name;
    - `order`, `limit` and `offset`, and `ListMeta`;
    - `422` for invalid parameters.
  - `getDkimKey`: lookup by exact stored name first, then by normalised name; the `ETag` header when
    a key exists; `404` outside the scope.

  Add these scenarios to `tests/mocks/scenarios/dns.ts`:
  - `dns-admin`:
    - domains `example.org` (2,048-bit `dkim`), `example.net` (no key), `bücher.example` (1,024),
      `shop.example` (3,072), `long-…` (a 253-character name, 4,096) and `incomplete.example`
      (selector only, so `missingParts: [publicKey, privateKey]`);
    - alias domains `example.com` → `example.org` (key) and `missing.example` → `example.net` (no
      key);
    - unused keys `old.example` and `Legacy.Example`;
  - `dns-domain-admin`: `reseller` with `example.org` and `example.net` and their alias domains;
  - `dns-empty-admin` and `dns-empty-domain-admin`;
  - `dns-many`: 600 entries, 120 of them missing.
- [ ] T031 [P] [US1] Write `tests/e2e/dns/dkim-list.spec.ts`. It covers:
  - US1-AS1: entries sorted by name, with state badges and the total;
  - US1-AS2: cards at 360 px with the readable name, kind, badge (text and icon), selector and
    length;
  - US1-AS5: "Key missing" shows only names without a key, the filter is shown as active, and the
    count is announced;
  - US1-AS6: a domain administrator sees exactly their entries, with no "Key unused" and no "No
    domain" filter options;
  - US1-AS7: "Incomplete" with its explanation;
  - US1-AS8: no matches gives the message and "clear search and filters";
  - FR-005: page sizes 25, 50 and 100, with first, previous, next, last and the current page, on
    `dns-many`;
  - FR-007: the table on desktop with sortable headers (`aria-sort`);
  - FR-008: the search (UI 004's `SearchField`) runs after a 500 ms pause or on submit, and clears
    with one action;
  - FR-009: kind and completeness filters; selecting a selector adds it as a filter; the active
    filter count; clear all;
  - FR-010: the sort control on mobile;
  - FR-011: a reload and a shared address restore the view, and filter changes return to page 1;
  - FR-012: `?domain=example.org` lists `example.org` and `example.com`;
  - FR-013: returning from an entry shows the previous results and scroll position without a
    loading state;
  - FR-014: loading placeholders, the empty state per role, error with retry, and a refresh failure
    keeping the previous results;
  - FR-015: the administrator's read-only server settings: default selector, default key size,
    export and publication;
  - Edge: a 253-character name wraps without horizontal scroll;
  - Edge: `Legacy.Example` listed under its stored name as unused.
- [ ] T032 [P] [US1] Write `tests/e2e/dns/dkim-entry.spec.ts`. It covers:
  - US1-AS3, FR-017 and SC-003: record name `dkim._domainkey.example.org`, host label
    `dkim._domainkey` and value, each copied character for character
    (`navigator.clipboard.readText()` on Chromium), with "Copied" announced;
  - US1-AS4: the split form shows quoted pieces, and copying copies that form;
  - FR-016: a name without a key says mail is not signed (and offers generation once US2 exists,
    so this test only asserts the text); an incomplete key shows its explanation and the missing
    parts;
  - FR-018: the monospace value of 1,000 characters wraps at 360 px;
  - FR-020: loading, error with retry;
  - FR-004 and US1-AS6: an out-of-scope or unknown name shows the not-found page with a way back;
  - Edge: the key removed while open (via `PATCH /__mock`) says it no longer exists on refresh;
  - Edge: clipboard denied (stubbed `writeText` rejection) selects the value with the message
    (FR-075);
  - Edge: the unused `Legacy.Example` entry opens by its stored name.
- [ ] T033 [P] [US1] Write `tests/e2e/dns/entry-points-dkim.spec.ts`. It covers:
  - FR-021: the UI 002 domain page of `example.org` shows the DKIM section (state, selector,
    length, record name and value with copy buttons), a link to the entry, and "DKIM keys of this
    domain and its alias domains" leading to `?domain=example.org`;
  - the UI 004 alias domain page of `example.com` shows its DKIM section;
  - `example.net`'s section says no key exists;
  - as a domain administrator, the same sections without administrator actions.
- [ ] T034 [P] [US1] Write these unit tests:
  - `tests/unit/features/dns/dkim-list-state.spec.ts`: the address parameters of data-model §5
    mapped to the query, including repeated `state`, `complete=true|false` and `domain`; domain
    administrators' `state=unused` and `kind=none` normalised away; `q`, `selector` and `domain`
    each "≤ 255 characters";
  - `tests/unit/features/dns/record.spec.ts`: `hostLabel` `${selector}._domainkey`; `split` as
    `"p1" "p2"` from `valueParts`; `null` record handling.
- [ ] T035 [P] [US1] Write component tests in `tests/unit/features/dns/`:
  - `DkimStateBadge.spec.ts`: text and icon per state and for "Incomplete" (FR-086);
  - `DkimEntryCard.spec.ts` and `DkimEntryTable.spec.ts`: the FR-006 values, with the kind "Alias
    domain of {target}";
  - `DkimFilters.spec.ts`: the options per role, the active count, clear all;
  - `DkimRecord.spec.ts`: the form switch, copy labels such as "Copy record value of example.org",
    and the copy target following the form;
  - `DkimSettingsSummary.spec.ts`: administrators only;
  - `DomainDkimSection.spec.ts`: valid, missing and incomplete states, links, and the domain-page
    link only for kind `domain`.
- [ ] T036 [P] [US1] Write `tests/smoke/dns-dkim-read.smoke.spec.ts` (`@dns @read-only`):
  - as `admin`, the list shows `example.org` valid, `example.net` missing and `old.example` unused;
  - the entry of `example.org` shows the record that `GET /api/v2/dkim-keys/example.org` returns;
  - as `reseller`, only `example.org`, `example.net` and `example.com`.

### Implementation for User Story 1

- [ ] T037 [US1] Implement:
  - `src/features/dns/api/dkim.ts`: the list and detail queries with `placeholderData:
    keepPreviousData` for the list;
  - `src/features/dns/dkim/list-state.ts`: the `useListState` schema of data-model §5;
  - `src/features/dns/dkim/record.ts`;
  - the routes `dkim-keys` and `dkim-key` in `src/features/dns/routes.ts`;
  - the catalogue entry `dkimKeys` set to `available` in `src/app/navigation/catalogue.ts`.

  T034 must pass.
- [ ] T038 [P] [US1] Implement these list components in `src/features/dns/components/`:
  - `DkimStateBadge.vue` and `DkimKindLabel.vue`;
  - `DkimEntryCard.vue` (below `md`, an `<li>` with the name as `<h3>` through the shared
    `DomainNameText`);
  - `DkimEntryTable.vue` (from `md` up, on `src/shared/ui/table`, with sortable headers and
    `aria-sort`);
  - `DkimEntryList.vue`;
  - `DkimFilters.vue`: UI 004's `SearchField`, and a collapsible filter section on mobile with state
    checkboxes (FR-009), a
    kind select, a completeness select, the selector and domain chips, the active count and clear
    all;
  - `DkimSortControl.vue`;
  - `DkimSettingsSummary.vue`.
- [ ] T039 [P] [US1] Implement these entry components in `src/features/dns/components/`:
  - `DkimRecord.vue`: the record name, host label and value in `RecordValue`, with a Reka
    `RadioGroup` for "One text" or "Split into 255-character pieces";
  - `DkimKeyFacts.vue`: kind, state, selector, length and completeness;
  - `IncompleteKeyNotice.vue`: the missing parts and the repair advice per role.
- [ ] T040 [US1] Implement:
  - `src/features/dns/pages/DkimKeysPage.vue`: `useListState`, `ListState` (loading, empty per role
    with the link to the domain list, no matches, error, and a refresh-failure notice keeping the
    results), `PaginationBar`, a refresh action, and the result count announced politely;
  - `src/features/dns/pages/DkimKeyPage.vue`: loading, not found, error with retry, the facts, the
    record, and "not signed" for missing keys.

  This depends on T037–T039. T031 and T032 must pass.
- [ ] T041 [US1] Implement `src/features/dns/components/DomainDkimSection.vue` (props `name`,
  `kind`; research R19) and export it from `src/features/dns/index.ts` as an async component.
  Place it in the section list after Groupware of `src/features/domains/pages/DomainDetailPage.vue`
  (UI 002 data-model §9), and after the General section of
  `src/features/alias-domains/pages/AliasDomainDetailPage.vue` (UI 004). Use the paths recorded by
  T001 if they differ. On the domain page, add the link "DKIM keys of this domain and its alias
  domains". T033 and T035
  must pass.
- [ ] T042 [US1] Add the legacy form map's new strings (T004a) under `dns.dkim.*` for the list,
  filters, sort, empty states, entry, record, incomplete notice and settings summary to
  `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. Use these legacy keys verbatim through UI 001's
  legacy translation layer (no copies, no hand-written values): `admin.dkim_keys`,
  `admin.dkim_key_valid`, `admin.dkim_key_missing`, `admin.dkim_key_unused`,
  `admin.dkim_domains_selector`, `admin.dkim_key_length`, `add.domain`, `mailbox.toggle_all` and
  `admin.remove`. Run `npm run i18n:check`.

**Checkpoint**: US1 works on its own: list, entry, copy and the domain and alias domain sections.

---

## Phase 4: User Story 2 - Generate DKIM keys for names without one (Priority: P1)

**Goal**: Generation for one name (from the entry or the DKIM section), for a selection, and for
"all names without a key" across pages, with progress, per-name results, retry, a leave warning
and the publication outcome.

**Independent Test**: Against the mock, generate keys for one name, a selection and all missing
names, with the default and a custom selector and each size, as an administrator and as a domain
administrator. Simulate a name that got a key meanwhile, a validation error, a temporary failure
and a dropped connection.

### Tests for User Story 2 (write first; must fail)

- [ ] T043 [US2] Implement `generateDkimKey` in `tests/mocks/handlers/dkim.ts`:
  - scope (`404` outside the scope);
  - `409 dkim-key-exists` for a name with a key, complete or not;
  - `422`: `selector` `required`, `tooLong` (`max`) or `invalidFormat` (`format: dkimSelector`),
    and `keySize` `notInList` (`allowed`);
  - `overwrite: true` from a domain administrator gives `403 forbidden`;
  - `201` with `Location` and `ETag`;
  - the scenario's publication outcome in `data.dnsPublication`;
  - `503` injection with `Retry-After`;
  - a "got a key meanwhile" injection.

  Add these scenarios to `tests/mocks/scenarios/dns.ts`:
  - `dns-admin-fork`: default selector `feldhost`, publication on, export on;
  - `dns-many-missing`: 60 missing names over three pages of 25.
- [ ] T044 [P] [US2] Write `tests/e2e/dns/dkim-generate.spec.ts`. It covers:
  - US2-AS1: the selector field shows `feldhost` (`dns-admin-fork`), the key size 2048, and the
    offered sizes equal `allowedKeySizes`;
  - US2-AS2: a single generation shows "Key valid" with the record and announces success, and the
    copy buttons are reachable without navigation;
  - US2-AS3: 12 selected names show progress and per-name results, and "Retry failed" sends only
    the failures;
  - US2-AS4: a selector with a space shows the error naming the allowed characters, and nothing is
    sent;
  - US2-AS5: a name that got a key meanwhile is reported as "already has a key", and its entry
    shows the existing key;
  - US2-AS6: a domain administrator generates from the domain page's DKIM section and sees the
    record (no replace, import, copy, delete, export or publish actions);
  - US2-AS7: publication failing gives "key created, signing works, not published", with "Publish
    again" (US7 adds the action; here, assert the outcome text);
  - FR-024: "Generate keys for all names without a key" on `dns-many-missing` with a search and kind
    filter. The confirmation states the count and the filters, and lists 10 names plus "and N
    others". The run goes in name order;
  - FR-026: a double submission sends one request;
  - FR-040: in selection mode, the action bar names the count, and entries with a key are listed as
    skipped;
  - FR-041: a dropped connection (`route.abort()` for one request) gives "outcome unknown" for that
    name; the run continues; nothing is retried on its own;
  - FR-042 and Edge "generation for many names": leaving during a run asks, and confirming marks
    the rest "not processed";
  - FR-073: a temporary failure says nothing was changed and keeps the input;
  - the selection clears when the page, filter or sort changes;
  - FR-089: after generating for `example.net` from the list, its entry page and the UI 002
    domain page's DKIM section show the new key without a reload, and returning to the list shows
    `example.net` as "Key valid";
  - SC-011: a 50-name run reports 50 outcomes, and the retry sends only the failed ones.
- [ ] T045 [P] [US2] Write these unit tests:
  - `tests/unit/features/dns/GenerateKeyDialog.spec.ts`: names read-only; selector pre-filled with
    `defaultSelector`, "not empty; ≤ `selectorMaxLength`; `^[A-Za-z0-9._-]+$`"; the selector field
    has `autocapitalize="none"`, `autocorrect="off"` and `spellcheck="false"` (FR-081); sizes from
    `allowedKeySizes` with `defaultKeySize` preselected; one submission; focus to the heading on
    open and to the error summary on failure; Escape blocked while sending;
  - `tests/unit/features/dns/generate-run.spec.ts`: collection with `state=missing`, the current
    `q` and `kind`, `sort=name`, `order=asc` and `limit=1000` until `offset ≥ total`; the first 10
    names and the remainder count; no caching of collection pages;
  - `tests/unit/features/dns/dkim-run-classifier.spec.ts`: every row of research R8's table
    (`409 dkim-key-exists`, `404` and `422` on `name` or `target` continue; `422` on `selector` or
    `keySize`, `403`, `503`, unknown problems and `409 about:blank` stop);
  - `tests/unit/features/dns/dkim-bulk.spec.ts`: the `BulkActionBar` configuration of
    `src/features/dns/dkim/bulk.ts`, with the actions per role (generate for both roles, delete for
    administrators) and the entries each action skips.
- [ ] T046 [P] [US2] Write `tests/smoke/dns-dkim-generate.smoke.spec.ts` (`@dns`):
  - as `admin`, generate a key for `example.net` with the default selector, and see "Key valid" and
    the record;
  - clean up by deleting the key through `DELETE /api/v2/dkim-keys/example.net` in the fixture;
  - as `reseller`, the same on `example.net` from the domain page's DKIM section, with the same
    cleanup.

### Implementation for User Story 2

- [ ] T047 [US2] In `src/features/dns/api/dkim.ts`, add the generation mutation with the invalidation
  of data-model §3:
  - write `detail(name)`;
  - invalidate the lists;
  - set `['dns-diagnostics','changed',name]`;
  - on `409`, invalidate `detail(name)`.

  Implement `src/features/dns/dkim/generate-run.ts`: the collection of all missing names,
  `dkimRunClassifier`, and per-name runs through `useSequentialCreate`. T045's
  `generate-run.spec.ts` and `dkim-run-classifier.spec.ts` must pass.
- [ ] T048 [P] [US2] Implement:
  - `src/features/dns/components/GenerateKeyDialog.vue`: Reka `Dialog`, full-screen below `md`,
    with `useProblemForm` field errors;
  - `src/features/dns/components/RunDialog.vue`: progress (`role="progressbar"`), "Stop", no Escape
    while running, `RunResultList` with `PublicationOutcome` per done item.

  On small screens, both dialogs keep their submit, cancel and stop actions in a footer that stays
  visible while the content scrolls (FR-080).
- [ ] T049 [US2] Add to `src/features/dns/pages/DkimKeysPage.vue`:
  - selection mode with `useBulkSelection`, reset through `useListState`'s `onReset`;
  - UI 002's `BulkActionBar`, configured by `src/features/dns/dkim/bulk.ts` (generate);
  - "Generate keys for all names without a key", with its `useConfirm` confirmation of FR-024;
  - the leave guard (`useLeaveGuard`, armed only while a run is pending).

  For a single generated name, the page then opens its entry.
- [ ] T050 [US2] Add "Generate a key" to `src/features/dns/pages/DkimKeyPage.vue` (missing state)
  and to `src/features/dns/components/DomainDkimSection.vue`. Both open `GenerateKeyDialog` for that
  name and move the focus to the record heading after success. T044 must pass.
- [ ] T051 [US2] Add the legacy form map's new strings under `dns.dkim.generate.*`,
  `dns.dkim.run.*` and `dns.dkim.selection.*` in three locales. Use verbatim `admin.dkim_add_key`,
  `admin.dkim_domains_wo_keys`, `admin.domain_s`, `admin.add`, `success.dkim_added` (`%s`),
  `danger.dkim_domain_or_sel_exists` (`%s`) and `danger.dkim_domain_or_sel_invalid` (`%s`). Run
  `npm run i18n:check`.

**Checkpoint**: US1 and US2 work: keys can be found, generated and their records copied.

---

## Phase 5: User Story 3 - Check a domain's DNS setup (Priority: P1)

**Goal**: The diagnostics page:
- the run lifecycle: reuse for 10 minutes, a 45-second timeout, errors, the rate limit with headers
  and countdown;
- translated checks with summary groups and the attention filter;
- SPF guidance, server facts, and the zone file to copy, download and view;
- "Check DNS" on every entry point.

**Independent Test**: Against the mock, run diagnostics covering every status, with and without
`optional`, with partial timeouts, for an alias domain, without IPv6 and with a 429, as an
administrator and as a domain administrator, at 360 px and on desktop. Compare the values, the
summary and the downloaded zone file with the mock.

### Tests for User Story 3 (write first; must fail)

- [ ] T052 [US3] Implement `runDnsDiagnostics` in `tests/mocks/handlers/dns-diagnostics.ts`:
  - scope (`404` outside it);
  - server checks first for administrators (`serverChecksIncluded: true`), and none for domain
    administrators, with the result note `serverChecksOmitted`;
  - `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` and `Cache-Control: no-store` on
    every `200`;
  - 10 runs per minute per caller, then `429 too-many-requests` with `retryAfter`, `Retry-After`
    and the `RateLimit-*` headers;
  - the scenario delay injection;
  - `500` injection.

  Add these scenarios to `tests/mocks/scenarios/dns.ts`:
  - `dns-diagnostics-all-statuses`:
    - `mx` match; `autodiscover` match with the note `matchedByAddressRecords`; `srv:autodiscover`
      missing;
    - `spf` mismatch (optional) with reason `spfNotPass` and guidance `spfAuthorizeAddresses` and
      `spfSuggestedRecord`;
    - `dmarc` missing (optional) with guidance `dmarcPublishPolicy`;
    - `dkim:dkim` mismatch with `dkimPublicKeyDiffers`;
    - `mta-sts` and `mta-sts-record` match, and `tls-rpt` informational (optional, found);
    - `tlsa:25` `expectedUnknown` with `certificateUnavailable`;
    - `srv:imaps` `lookupFailed` with `lookupTimeout`;

    Together they cover every status.
  - `dns-diagnostics-partial`: three `lookupFailed` with `runTimeout`;
  - `dns-diagnostics-no-ipv6`: no AAAA or PTR IPv6 checks, and the note `noPublicIpv6`;
  - `dns-diagnostics-alias`: `example.com` with `aliasDomain: true` and `targetDomain`;
  - `dns-diagnostics-markup`: found values with `<script>`, bidi controls and several values per
    check; `found: []`; an unknown identifier `caa` (the pattern allows it);
  - `dns-diagnostics-rate-limited`: remaining 3, then 0.
- [ ] T053 [P] [US3] Write `tests/e2e/dns/diagnostics-result.spec.ts`. It covers:
  - US3-AS1: MX "Correct" with icon and text, the expected host and the value found;
  - US3-AS2: a missing MX is "Missing" as a problem and counted as needing attention;
  - US3-AS3: DMARC "Not set (optional)", not counted, with translated guidance and a "Learn more"
    link that opens a new tab;
  - US3-AS4: SPF "Different value", marked optional and counted;
  - US3-AS5: DKIM "Different value" with the expected value and its copy button, and the value
    found as text;
  - US3-AS6: three "Could not be checked" with the translated reason, the "some records could not
    be checked" notice and "Run again";
  - US3-AS8: as a domain administrator, no server-wide group;
  - US3-AS9 and SC-009: "Download zone file" saves `<ASCII name>.txt` whose content equals the
    mock's `zoneFile`, and "Copy zone file" copies the same text;
  - FR-061: every check's record name and expected value have copy buttons named after the check,
    and copy exactly; values found have none;
  - FR-057: the readable and ASCII name, and the 24-hour notice;
  - FR-059 and FR-060: every status label, the optional markers and the API order, grouped into
    server-wide and the name's records;
  - FR-062: summary counts per group equal the result (SC-008); the "only attention" filter; "all
    required records are correct" with the not-verified count;
  - FR-063: SPF allowed addresses and the suggested record with copy buttons;
  - FR-064: server facts (host name, IPv4, IPv6 or "no public IPv6 address", run time);
  - FR-067: the zone file view is collapsed by default;
  - FR-068: the table on desktop, cards on mobile;
  - Edges:
    - an alias domain names its target and explains the MTA-STS checks;
    - no IPv6;
    - `expectedUnknown` shows "Cannot be verified" with its reason;
    - a host that is an alias gives "Different value" with reason `hostIsAlias`;
    - markup and bidi controls are shown literally;
    - several values are all listed;
    - an empty list shows "No record found";
    - the unknown identifier `caa` is labelled by its record type.
- [ ] T054 [P] [US3] Write `tests/e2e/dns/diagnostics-run.spec.ts`. It covers:
  - FR-058: opening starts a run with progress and "can take up to 30 seconds", and a second run
    cannot start meanwhile;
  - US3-AS10: a result from 4 minutes ago is shown with its time and starts no run; at 12 minutes,
    opening starts a run (`page.clock`); SC-016 back-and-forth navigation;
  - the 45-second timeout (`page.clock` with a delayed mock response) shows the timeout error with
    "Run again", and a previous result stays visible;
  - US3-AS7: after the API refuses a run, the previous result stays, "Available again in …" is
    shown, "Run again" is unavailable, and it is announced once when available again;
  - FR-091: "3 checks left this minute" from `RateLimit-Remaining`; at 0, "Run again" is disabled
    until the reset;
  - US3-AS8 and FR-004: a domain administrator opening an unmanaged name sees the not-found page;
  - FR-069: a `500` or a network failure shows the translated error with "Run again", keeping a
    previous result;
  - Edge: a result arriving after moving to another name is not shown there, but is shown when
    returning to its own name;
  - FR-084: the start, and the end with summary counts, are announced without moving focus;
  - sign-out drops held results, so signing in again starts a run.
- [ ] T055 [P] [US3] Write `tests/e2e/dns/entry-points-check-dns.spec.ts` (FR-023). "Check DNS"
  opens `/ng/dns/diagnostics/<name>` from:
  - the UI 002 domain list (card and table row) and the domain page;
  - the UI 004 alias domain list and alias domain page;
  - the DKIM entry page (FR-019).

  It is absent on an unused key's entry.
- [ ] T056 [P] [US3] Write these unit tests in `tests/unit/features/dns/`:
  - `summary-groups.spec.ts`: the full FR-060 matrix (6 statuses × optional), and the per-status
    totals equal `summary` for every factory result (SC-008);
  - `check-labels.spec.ts`: every identifier of research R15, `dkim:<selector>` with the selector,
    `srv:*` service names, and an unknown identifier giving the generic label with the record type;
  - `check-messages.spec.ts`: every `DnsCheckMessageCode` with its params formatted per locale (numbers,
    `Intl.ListFormat` lists, translated `cause` and `result`); `url` as a separate link only through
    `safeHref` (a `javascript:` URL dropped); an unknown code (a plain value) giving
    `dns.diagnostics.messages.unknown` plus `message` with `lang="en"`;
  - `rate-limit.spec.ts`: headers parsed to `RateLimitState`; a 429 using `retryAfter`; the
    "remaining ≤ 3" notice; disabled until `resetAt`;
  - `diagnostics-query.spec.ts`: `staleTime` and `gcTime` 600 s; `retry: false`; TanStack's
    `signal` not passed (an unmount does not abort); the timeout at `runTimeoutSeconds + 15` via
    `setTimeout`; data kept after a failed refetch; `queryClient.clear()` drops results and the
    rate-limit state; a `changed` marker newer than `receivedAt` exposes the "changed after this
    check" notice.
- [ ] T057 [P] [US3] Write component tests in `tests/unit/features/dns/`:
  - `DnsCheckCard.spec.ts` and `DnsCheckTable.spec.ts`: purpose heading, record name and type,
    status badge text and icon, the optional marker, expected value or guidance, values found as
    text, notes; copy buttons for the record name and the expected value (FR-061);
  - `DiagnosticsSummary.spec.ts`;
  - `ZoneFilePanel.spec.ts`: collapsed by default, copy, download;
  - `RunStatus.spec.ts`: running, timeout, rate-limited with countdown, and error.
- [ ] T058 [P] [US3] Write `tests/smoke/dns-diagnostics.smoke.spec.ts` (`@dns @read-only`):
  - as `admin`, run diagnostics for `example.org`; checks render with status labels, and the server
    group is present;
  - the downloaded zone file equals `zoneFile` from `GET /api/v2/dns-diagnostics/example.org`,
    fetched in the fixture; the result is held, so the fixture's own request counts against the
    limit: at most 3 runs per test;
  - as `reseller`, no server group.

### Implementation for User Story 3

- [ ] T059 [US3] Implement:
  - `src/features/dns/api/diagnostics.ts`: the query of research R14, the timeout, the rate-limit
    writes and the `changed` marker check;
  - `src/features/dns/diagnostics/summary-groups.ts`, `check-labels.ts`, `check-messages.ts` and
    `rate-limit.ts`;
  - the route `dns-diagnostics` in `src/features/dns/routes.ts`.

  T056 must pass.
- [ ] T060 [P] [US3] Implement in `src/features/dns/components/`:
  - `DnsCheckStatusBadge.vue`, `DnsCheckMessages.vue` (reasons, notes, guidance with
    `RecordValue` for addresses and suggested records, and links through `safeHref`);
  - `DnsCheckCard.vue` (an `<li>` with the purpose as `<h3>`) and `DnsCheckTable.vue` (name, type,
    expected value, values found, status);
  - `DiagnosticsSummary.vue` (counts per group and the attention filter switch);
  - `ServerFacts.vue`, `ZoneFilePanel.vue` (Reka `Collapsible`, `RecordValue` multiline,
    `downloadText`) and `RunStatus.vue`.
- [ ] T061 [US3] Implement `src/features/dns/pages/DnsDiagnosticsPage.vue`:
  - the name, its ASCII form, the alias target and the 24-hour notice;
  - `RunStatus`;
  - the "some records could not be checked" notice;
  - the "changed after this check" notice;
  - the server-wide and name groups;
  - the not-found state;
  - announcements at start and end.

  T053 and T054 must pass.
- [ ] T062 [US3] Implement `src/features/dns/components/CheckDnsAction.vue` (variants `menuItem` and
  `button`) and export it from `src/features/dns/index.ts`. Place it (paths as recorded by T001)
  in:
  - the entry actions menu of `src/features/domains/components/list/DomainCard.vue` and
    `DomainTable.vue`, and the header actions of `src/features/domains/pages/DomainDetailPage.vue`
    (UI 002 data-model §9);
  - the entry actions of `src/features/alias-domains/components/AliasDomainCard.vue` and
    `AliasDomainTable.vue`, and the page actions of
    `src/features/alias-domains/pages/AliasDomainDetailPage.vue` (UI 004);
  - `src/features/dns/pages/DkimKeyPage.vue` for domains and alias domains.

  T055 must pass.
- [ ] T063 [US3] Add the `dns.diagnostics.*` messages in three locales:
  - every check label of research R15, every status and `missingOptional`, every message code and
    `unknown`, the causes and SPF results;
  - the summary, filter, facts, zone file, run states, rate-limit and timeout texts.

  Add only the legacy form map's new strings (T004a). Use verbatim `diagnostics.dns_records`,
  `diagnostics.dns_records_24hours`, `diagnostics.dns_records_name`,
  `diagnostics.dns_records_type`, `diagnostics.dns_records_data`, `diagnostics.dns_records_status`
  (unless the owner approves new labels, plan deviation 6), `diagnostics.cname_from_a` and
  `diagnostics.optional`. Run `npm run i18n:check`.

**Checkpoint**: US1 to US3 (all P1 stories) work on their own.

---

## Phase 6: User Story 4 - Manage a domain's MTA-STS policy (Priority: P2)

**Goal**:
- the MTA-STS section on the domain page: view, set up, edit with the changed-value marking,
  activate, deactivate, and the identifier notice;
- the alias domain section;
- the "MTA-STS policies" list.

**Independent Test**: Against the mock, set up, change, activate and deactivate policies as an
administrator and as a domain administrator at 360 px and on desktop, with invalid modes, MX
entries and maximum ages, an MX list over 255 characters, an outdated version and an alias domain.
Check the values sent and every message.

### Tests for User Story 4 (write first; must fail)

- [ ] T064 [US4] Implement in `tests/mocks/handlers/mta-sts.ts`:
  - `listMtaStsPolicies`: scope, `q`, `active`, `mode`, `sort` (`domain`, `mode`, `maxAge`,
    `policyId`), `order` and paging;
  - `createMtaStsPolicy`:
    - `201` with `Location` and `ETag`;
    - `409 mta-sts-policy-exists`;
    - `404` for an alias domain or a name outside the scope;
    - `422`: `mode` `required` or `notInList`; `maxAge` `required` or `outOfRange` (`min: 1`,
      `max: 31557600`); `mxHosts` `required`, or `tooLong` (`max: 255`) on the joined list;
      `mxHosts.<i>` `invalidFormat` (`format: mxHost`);
    - `active` defaults to `false`;
  - `getMtaStsPolicy`: `404` without a policy, and `ETag`;
  - `updateMtaStsPolicy`:
    - `application/merge-patch+json` only;
    - `If-Match` gives `412` when outdated;
    - a new `policyId` (always different) when `version`, `mode`, `mxHosts` (including order) or
      `maxAge` changes;
    - the same `policyId` for `active`-only and no-op patches.

  Add the scenario `dns-mta-sts` to `tests/mocks/scenarios/dns.ts`:
  - `example.org`: active, enforce, `[mail.example.org]`, 604,800 s;
  - `example.net`: no policy;
  - `example.com` → `example.org` alias;
  - a concurrent-change injection.
- [ ] T065 [P] [US4] Write `tests/e2e/dns/mta-sts-section.spec.ts`. It covers:
  - US4-AS1: no policy, with the one-sentence explanation and "Set up";
  - US4-AS2:
    - the set-up form presets testing, 1 week, `mail.example.org` and inactive;
    - choosing enforce, adding `mx2.example.org`, entering 1 day and switching on, then saving,
      creates the policy;
    - the section shows STSv1, the identifier, the policy address (new tab) and both records with
      copy buttons;
  - US4-AS3: changing only the mode announces the old and new identifier and highlights the
    `_mta-sts` record until leaving; changing only the active state shows no such notice (SC-015);
  - US4-AS4: `mail..example`, a maximum age of 0, and MX entries joined over 255 characters each
    show a translated error with the limit, and nothing is sent; the used length is shown from 90 %;
  - US4-AS5: an outdated save keeps the input, reloads, and marks the values changed meanwhile with
    their new saved values; save again and discard both work (SC-010);
  - US4-AS6: the alias domain page of `example.com` names `example.org`, links to its `#mta-sts`
    section, and offers no editing;
  - US4-AS7: "Deactivate" asks with the three consequences, after which the section shows inactive
    with the same identifier; "Activate" shows the certificate and DNS notice of FR-051;
  - US4-AS8: 604,800 s shows as 1 week in the section and the form; 31,557,600 s as 8,766 hours;
  - FR-047: mode explanations are visible; MX entry by Enter, comma and the add button; each entry
    has a labelled remove button; pasting a comma-separated list adds each item;
  - FR-053: leaving with unsaved changes asks; loading and error states;
  - Edges:
    - `Mail.Example.org.` and `mail.example.org` are kept once with the first spelling;
    - a no-op save shows no identifier notice;
    - two changes within one second show the API's identifier;
    - a `409` on create (created elsewhere) switches to editing;
  - as a domain administrator, the same on `example.net`, and no History action.
- [ ] T066 [P] [US4] Write `tests/e2e/dns/mta-sts-list.spec.ts`. It covers:
  - FR-054: paging, the total, search, filters by active state and mode, sorting by domain, mode,
    maximum age and identifier, all kept in the address;
  - FR-055: cards on mobile and a table on desktop; opening an entry goes to the domain page at
    `#mta-sts` with the section focused into view;
  - FR-056: loading, no policies (with the explanation and the link to the domain list), no
    matches, error;
  - a domain administrator sees only their domains.
- [ ] T067 [P] [US4] Write these unit tests in `tests/unit/features/dns/`:
  - `max-age.spec.ts`: `toLargestUnit` (604,800 s is 1 week, 86,400 s is 1 day, 31,557,600 s is
    8,766 hours, 90 s is 90 seconds); `toSeconds`; the check "whole number ≥ 1 in its unit;
    `maxAgeMin ≤ seconds ≤ maxAgeMax`", with the limit message in the chosen unit when exact;
    locale formatting;
  - `mx-hosts.spec.ts`: trim; one trailing dot removed; the `*.` wildcard; the ASCII form via
    `URL`; a case-insensitive dedupe keeping the first spelling; the joined length against
    `mxMaxLength`; the 90 % indicator; "≥ 1 entry"; "≤ 128 entries"; server error paths
    `mxHosts.<i>` mapped to entries;
  - `policy-change.spec.ts`: `policyId` before ≠ after gives the notice; `active` only or no-op
    gives none;
  - `mta-sts-list-state.spec.ts`: the address parameters of data-model §5.
- [ ] T068 [P] [US4] Write component tests in `tests/unit/features/dns/`:
  - `MxHostListField.spec.ts`: keyboard entry and removal, announcements of a dropped duplicate,
    and an entry input with `autocapitalize="none"`, `autocorrect="off"` and `spellcheck="false"`
    (FR-081);
  - `MaxAgeField.spec.ts`: `inputmode="numeric"`, the unit select, errors;
  - `MtaStsForm.spec.ts`:
    - set-up defaults from capabilities: mode testing, 1 week, `[serverHostname]`, `defaultActive`;
    - the patch has only the changed members, sent with `If-Match`;
    - `412` handled through `EditableSection`;
    - the leave guard;
  - `DomainMtaStsSection.spec.ts`: view, none, highlight, Activate and Deactivate, the History link
    for administrators only;
  - `AliasDomainMtaStsSection.spec.ts`.
- [ ] T069 [P] [US4] Write `tests/smoke/dns-mta-sts.smoke.spec.ts` (`@dns`):
  - as `admin`, on `example.net`'s domain page, set up a policy if none exists, otherwise edit it,
    choosing a mode different from the current one;
  - the identifier notice appears with the old and new value;
  - `GET /api/v2/mta-sts-policies/example.net` returns the shown identifier.
- [ ] T070 [US4] Implement:
  - `src/features/dns/api/mta-sts.ts`: the list and detail queries, create and update mutations
    with the invalidation of data-model §3, and the `changed` markers for the domain and its alias
    domains on `policyId` or `active` changes;
  - `src/features/dns/mta-sts/max-age.ts`, `mx-hosts.ts`, `policy-change.ts` and `list-state.ts`;
  - the route `mta-sts-policies` in `src/features/dns/routes.ts`;
  - the catalogue entry `mtaStsPolicies` set to `available` in `src/app/navigation/catalogue.ts`.

  T067 must pass.
- [ ] T071 [P] [US4] Implement in `src/features/dns/components/`:
  - `MxHostListField.vue` and `MaxAgeField.vue`;
  - `MtaStsModeField.vue`: the modes as their raw values in legacy's order (`enforce`, `testing`, `none`) with `edit.mta_sts_mode_info` shown whole through `SanitizedHtml.vue` (per-mode descriptions only if the owner approves plan deviation 1);
  - `MtaStsForm.vue`: the version as fixed text `STSv1`; the active `Switch` with the legacy
    explanation; the FR-051 notice next to the set-up form;
  - `MtaStsRecords.vue` and `MtaStsPolicyFacts.vue`.
- [ ] T072 [US4] Implement:
  - `src/features/dns/components/DomainMtaStsSection.vue`: on UI 002's `EditableSection`,
    `id="mta-sts"`, with the Activate and Deactivate buttons and the identifier notice and
    highlight;
  - `src/features/dns/components/AliasDomainMtaStsSection.vue`.

  Export both from `src/features/dns/index.ts` as async components. Place `DomainMtaStsSection`
  after `DomainDkimSection` in the section list of `src/features/domains/pages/DomainDetailPage.vue`,
  with the section key `mta-sts` for UI 002's `edit=` address parameter. Place
  `AliasDomainMtaStsSection` after the DKIM section of
  `src/features/alias-domains/pages/AliasDomainDetailPage.vue`. T065 and T068 must pass.
- [ ] T073 [P] [US4] Implement:
  - `src/features/dns/pages/MtaStsPoliciesPage.vue`: `useListState`, `ListState`, `PaginationBar`,
    links to the domain page with hash `#mta-sts`;
  - `src/features/dns/components/MtaStsPolicyCard.vue`, `MtaStsPolicyTable.vue` and
    `MtaStsFilters.vue`.

  T066 must pass.
- [ ] T074 [US4] Add the legacy form map's new strings under `dns.mtaSts.*` in three locales: the
  identifier notice, the deactivation confirmation, the certificate notice and the list texts (and
  the units or per-mode explanations only if the owner approves plan deviations 1 and 3).

  Use verbatim through UI 001's legacy translation layer (research R22):
  - `edit.mta_sts`, `edit.mta_sts_version`, `edit.mta_sts_mode`, `edit.mta_sts_max_age`,
    `edit.mta_sts_max_age_info`, `edit.mta_sts_mx`, `edit.mta_sts_mx_info`,
    `edit.mta_sts_mx_notice`, `edit.active`, `edit.mta_sts_active_info` and `admin.save`, and the
    messages `danger.version_invalid`, `danger.mode_invalid`, `danger.max_age_invalid`,
    `danger.mx_invalid` and `success.object_modified` where the API outcome has the same meaning;
  - through `SanitizedHtml.vue`, whole and unaltered: `edit.mta_sts_info`,
    `edit.mta_sts_version_info` and `edit.mta_sts_mode_info`.

  No locale supplies its own value for a legacy key; missing keys fall back to `en-gb`. Run
  `npm run i18n:check`.

**Checkpoint**: US1 to US4 work on their own.

---

## Phase 7: User Story 5 - Import, copy, replace and delete DKIM keys (Priority: P2)

**Goal**: For administrators:
- import with overwrite and secret-safe handling;
- copy to several targets with explicit overwrite;
- replace a key with a new one;
- delete one key with its impact, or a selection through the API's bulk operation with the number
  typed.

**Independent Test**: Against the mock, import valid and invalid keys with and without overwrite,
copy a key to several targets with and without keys, replace keys, and delete valid and unused keys
one at a time and in a selection, as an administrator. Simulate conflicts, outdated versions and
every validation rule. Check that a domain administrator is never offered these actions.

### Tests for User Story 5 (write first; must fail)

- [ ] T075 [US5] Implement in `tests/mocks/handlers/dkim.ts`:
  - `importDkimKey`:
    - the byte size first: `tooLong` with `max: 16384` and `unit: bytes`;
    - then `node:crypto.createPrivateKey`: `invalidPrivateKey`, `encryptedPrivateKey`,
      `unsupportedKeyType` (`allowed: [rsa]`), `keyLengthOutOfRange` (`min: 1024`, `max: 8192`);
    - `dkimName` `invalidFormat` (`format: domainName`);
    - `selector` rules;
    - `409` without overwrite;
    - overwrite with `If-Match` (`412`);
    - `201` or `200`;
    - the key text is never echoed;
  - `copyDkimKey`:
    - `404` for a source without a key;
    - `409 about:blank` for an incomplete source;
    - `target` `notFound` and `sameAsSource`;
    - `409 dkim-key-exists` without overwrite;
    - overwrite with the target's `If-Match`;
    - `201` or `200`, with the target's entry and outcome;
  - `deleteDkimKey`: `204`; `404`; `412`; an unused key's entry disappears;
  - `applyDkimKeyBulkAction`:
    - `422 tooMany` (`max: 100`) on `targets`;
    - per-target `done`, `notFound`, `outdated` (version mismatch) or `failed` (`503` injection);
    - a name given twice is processed once;
    - `meta.dnsPublication` only while publication is enabled;
  - `generateDkimKey` with `overwrite: true` from an administrator: `200`, `If-Match` checked.

  Add the scenario `dns-admin-keys` to `tests/mocks/scenarios/dns.ts`, with fixed PEM inputs in the
  scenario:
  - a valid PKCS #8 key;
  - a valid PKCS #1 key with CRLF and blank lines;
  - an encrypted key;
  - an EC key;
  - a 512-bit key;
  - a 17 KiB text.
- [ ] T076 [P] [US5] Write `tests/e2e/dns/dkim-import.spec.ts`. It covers:
  - US5-AS1: importing a pasted key for `example.net` with selector `mx2024` shows "Key valid" with
    `mx2024` and the derived record; the key text is gone from the form; "created" is announced;
  - US5-AS2: importing over `example.org` without overwrite shows the name-field error with "Switch
    on overwrite"; with overwrite, the confirmation names the selector and length and says the old
    key is removed completely; success announces "replaced";
  - US5-AS3: an encrypted key shows the field error and keeps the rest of the input;
  - FR-029:
    - a name in Unicode or upper case is accepted;
    - a non-domain name says the key is listed as unused;
    - the file chooser loads a `.pem`;
    - a file or text over `privateKeyMaxBytes` is refused before sending;
    - an empty key is refused;
    - the explanation names 1,024 to 8,192 bits from the capabilities;
  - FR-030: overwriting a known entry sends `If-Match`, and a `412` asks again with fresh data;
  - FR-032: each private key rule code shows its translated rule, and no message contains key text;
  - FR-033: after a refusal the text is kept; leaving with input asks, and confirming clears it; a
    reload shows an empty form;
  - FR-076: the textarea has spell checking, auto-correction, auto-completion and
    auto-capitalisation off; the key never appears in the address or history;
  - Edge: CRLF and surrounding blank lines are accepted as pasted;
  - a domain administrator opening `/ng/dns/dkim-import` sees "no access".
- [ ] T077 [P] [US5] Write `tests/e2e/dns/dkim-copy.spec.ts`. It covers:
  - US5-AS4: from `example.org`, three targets of which one has a key; the picker marks it "has a
    key" with its selector; the overwrite confirmation lists it and says old keys are removed
    completely; per-target results with outcomes in `dns-admin-fork`;
  - FR-034: a searchable picker loading pages ("load more"), never offering the source;
  - FR-035: a target with a key is sent with `overwrite` and `If-Match` only after agreement;
    declining removes it from the run;
  - FR-036: one request per target, continuing after a failure, with a result per target;
  - Edge: a target removed before sending gives "no longer exists";
  - Edge: opening the copy page of `incomplete.example` by its address shows "incomplete and
    cannot be copied" instead of the form; a source that became incomplete meanwhile gives the same
    message from the API's `409`;
  - Edge: leaving during the copy run asks first (FR-042);
  - a domain administrator opening `/ng/dns/dkim-keys/example.org/copy` sees "no access".
- [ ] T078 [P] [US5] Write `tests/e2e/dns/dkim-delete.spec.ts`. It covers:
  - US5-AS5:
    - deleting `example.org`'s key shows the impact (the name and ASCII form, kind, selector,
      length; mail no longer signed from the next message; the private key deleted permanently;
      the DNS record staying with publication off);
    - confirming shows "Key missing" and announces the deletion;
    - with publication on, the text says the record is removed and the outcome is in the history;
  - US5-AS6: deleting `old.example` returns to the list without it;
  - US5-AS7:
    - 5 selected keys (3 domains) are all listed with kind and selector, the 3 domains are marked,
      and Delete stays disabled until "5" is typed;
    - one bulk request carries every name with its version;
    - per-key results are shown;
  - FR-092 and the edges:
    - an `outdated` key stays selected, and the list is reloaded;
    - a `failed` key (`503` injection) stays selected with its reason;
    - publication on shows each removal outcome;
    - a dropped connection reports "outcome unknown" for every key and sends nothing again;
    - entries without a key in the selection are listed as skipped;
  - FR-039: a `412` on a single deletion shows the impact again with fresh data; a `404` says the
    key no longer exists and refreshes.
- [ ] T079 [P] [US5] Write `tests/e2e/dns/dkim-replace.spec.ts`. It covers:
  - US5-AS8 and FR-090:
    - "Replace with a new key" on `example.org` recommends a selector different from `dkim`;
    - the confirmation names `dkim` and 2,048 bits, says mail stays signed, and says the DNS record
      must be updated;
    - the entry then shows the new selector and record, and `If-Match` was sent;
  - a `412` asks again with fresh data;
  - replacing `incomplete.example` works;
  - with publication on, the outcome is shown;
  - a domain administrator is not offered the action (US2-AS6).
- [ ] T080 [P] [US5] Write these unit tests in `tests/unit/features/dns/`:
  - `dkim-secrets.spec.ts`:
    - `importKey` calls the client directly;
    - no entry with the key text exists in `queryClient.getQueryCache()` or
      `getMutationCache()` after success or failure;
    - only the `DkimKeyChangeResult` is written to `detail(name)`;
  - `PrivateKeyField.spec.ts`:
    - the attributes;
    - the byte count through the shared `utf8ByteLength` against `privateKeyMaxBytes`;
    - the file size is checked before `FileReader`;
    - the file input is reset after reading;
  - `DkimImportPage.spec.ts`:
    - the text is cleared after success, on `pagehide` and after a confirmed leave, and kept after
      a refusal;
    - the name lookup is debounced 400 ms;
    - the name and selector inputs have `autocapitalize="none"`, `autocorrect="off"` and
      `spellcheck="false"` (FR-081);
    - the existing-key notice and the `If-Match` version;
  - `CopyTargetPicker.spec.ts`:
    - `useInfiniteQuery` over `listDkimKeys` with `state=valid&state=missing` and `q`, debounced
      300 ms;
    - the source is excluded;
    - "has a key (selector)";
    - loading, no matches, and error with retry (constitution II);
  - `DeleteKeyDialog.spec.ts`: the impact texts per kind and publication setting;
  - `BulkDeleteDialog.spec.ts`: the list, marked domains, skipped entries, typed count;
  - `ReplaceKeyDialog.spec.ts`: the selector hint when equal to the current selector.
- [ ] T081 [P] [US5] Write `tests/smoke/dns-dkim-manage.smoke.spec.ts` (`@dns`), as `admin`:
  1. import a 2,048-bit key generated in the test with `node:crypto` for `import.example`; the
     entry shows "Key unused";
  2. copy `example.org` to `example.net`;
  3. bulk-delete `example.net` and `import.example` with the count typed;
  4. replace `example.org`'s key with selector `smoke<timestamp>`;
  5. delete `old.example` only if present.

  The test is idempotent across reruns.

### Implementation for User Story 5

- [ ] T082 [US5] Extend the API modules (research R9–R11):
  - `src/features/dns/api/dkim.ts`: the mutations copy (per target), delete, bulk delete and
    replace (`generateDkimKey` with `overwrite: true` and `If-Match`), with the invalidation of
    data-model §3;
  - `src/features/dns/api/dkim-secrets.ts` with `importKey()`: a direct `api.POST` call, a local
    `pending` ref, and only the non-secret result written to the cache.

  T080's `dkim-secrets.spec.ts` must pass.
- [ ] T083 [P] [US5] Implement:
  - `src/features/dns/components/PrivateKeyField.vue`;
  - `src/features/dns/pages/DkimImportPage.vue`:
    - the name (`?name=` pre-fill), the selector, the key, and the overwrite switch;
    - the existing-key lookup;
    - the overwrite confirmation of research R10;
    - `useProblemForm` errors (`dkimName` mapped to the name field);
    - "Switch on overwrite";
    - the leave guard;
    - clearing on `pagehide`;
    - `router.replace` to the entry after success;
    - on small screens, Import and Cancel in a bar that stays visible while the form scrolls
      (FR-080);
  - the route `dkim-import` in `src/features/dns/routes.ts`, with `meta.roles: ['admin']` (UI 002
    D4).

  The page uses `useLeaveGuard` and never `useFormDraft` (research R11).
- [ ] T084 [P] [US5] Implement:
  - `src/features/dns/components/CopyTargetPicker.vue`: Reka `Combobox` without
    `ComboboxViewport`, with a plain scrollable list and "load more";
  - `src/features/dns/pages/DkimCopyPage.vue`: the source summary, targets, the overwrite
    confirmation, the run through `useSequentialCreate` with `RunResultList` and `PublicationOutcome`,
    the leave guard, and on small screens a Copy and Cancel bar that stays visible (FR-080). A
    source whose key is incomplete shows "incomplete and cannot be copied" instead of the form;
  - the route `dkim-copy`, with `meta.roles: ['admin']`.
- [ ] T085 [P] [US5] Implement in `src/features/dns/components/`:
  - `DeleteKeyDialog.vue`, on `useConfirm` with a custom body, with the versioned confirmation
    loop;
  - `BulkDeleteDialog.vue`, with `requireTyped`. Its results go to `BulkResultSummary`, whose
    `#item` slot (UI 004) shows `PublicationOutcome` per done target from `meta.dnsPublication`.
- [ ] T086 [P] [US5] Implement `src/features/dns/components/ReplaceKeyDialog.vue`. It reuses the
  fields of `GenerateKeyDialog.vue`, adds the selector hint, and has the confirmation and versioned
  loop of research R10.
- [ ] T087 [US5] Wire the actions:
  - `src/features/dns/pages/DkimKeyPage.vue` (administrators, from `dkimActions`): "Replace with a
    new key", "Import with overwrite" (to `dkim-import?name=…`), "Copy key", "Delete";
  - `src/features/dns/pages/DkimKeysPage.vue`: "Import private key" (to `dkim-import`);
  - `src/features/dns/dkim/bulk.ts`: "Delete" for administrators, opening `BulkDeleteDialog`.

  T076–T079 must pass.
- [ ] T088 [US5] Add the `dns.dkim.import.*`, `dns.dkim.copy.*`, `dns.dkim.delete.*` (including
  `bulk.typeCountMismatch`) and `dns.dkim.replace.*` new strings of the legacy form map in three
  locales. Use verbatim `admin.import_private_key`, `admin.domain`, `admin.private_key`,
  `admin.dkim_private_key`, `admin.dkim_overwrite_key`, `admin.import`, `admin.duplicate_dkim`,
  `admin.dkim_from`, `admin.dkim_from_title`, `admin.dkim_to`, `admin.dkim_to_title`,
  `admin.duplicate`, `success.dkim_removed` (`%s`), `success.dkim_duplicated` (`%s`, `%s`) and
  `danger.private_key_error` (`%s`). Run `npm run i18n:check`.

**Checkpoint**: US1 to US5 work on their own.

---

## Phase 8: User Story 6 - Export a private key when the operator allows it (Priority: P3)

**Goal**: A confirmed, audited export, shown once with copy and download, discarded on close, and
absent with an explanation while export is disabled.

**Independent Test**: Against the mock with export on and off, export keys as an administrator,
check that a domain administrator is never offered it, and check that the key appears nowhere in
stored state, addresses or messages after closing.

### Tests for User Story 6 (write first; must fail)

- [ ] T089 [US6] Implement `exportDkimPrivateKey` in `tests/mocks/handlers/dkim.ts`:
  - `200` with `Cache-Control: no-store` and the stored PEM;
  - `403 dkim-private-key-export-disabled` while off;
  - `403 forbidden` for domain administrators;
  - `404` without a key;
  - `503` injection.

  Use the runtime export toggle from T006.
- [ ] T090 [P] [US6] Write `tests/e2e/dns/dkim-export.spec.ts`. It covers:
  - US6-AS1: the confirmation explains signing power and recording;
  - US6-AS2:
    - the key is shown exactly as returned, read-only, with Copy and Download;
    - the download is `dkim.example.org.pem` with content equal to the mock's PEM;
    - closing and reopening needs a new confirmed export;
  - US6-AS3: export off shows "Private key export is turned off on this server" and no action;
  - US6-AS4: export turned off after loading (via `PATCH /__mock`) shows the translated message
    and removes the action after the capabilities refresh;
  - FR-077 and the conventions: closing before copy or download asks; Escape asks too;
  - Edge "export dialog closed by mistake": after confirming the close, the key is gone;
  - SC-007: after the flow, `localStorage`, `sessionStorage`, `history.state`, the address and
    every live region contain no `PRIVATE KEY`;
  - a domain administrator is never offered the action.
- [ ] T091 [P] [US6] Write these unit tests:
  - `tests/unit/features/dns/ExportPrivateKeyAction.spec.ts`:
    - `exportKey` is a direct call;
    - nothing is in the query or mutation cache;
    - the `ref` is cleared on close;
    - the file name comes from `privateKeyFileName`;
  - extend `tests/unit/shared/components/OneTimeSecretDialog.spec.ts` with the optional `download`
    prop, where a download counts as secured, as a copy does.
- [ ] T092 [P] [US6] Write `tests/smoke/dns-dkim-export.smoke.spec.ts` (`@dns @read-only`): with the
  default server setting, `example.org`'s entry offers no export and shows the "turned off" note.

### Implementation for User Story 6

- [ ] T093 [US6] Implement:
  - in `src/shared/components/OneTimeSecretDialog.vue`, the optional `download` prop (`{ fileName,
    mediaType }`) through `downloadText`, without changing existing behaviour;
  - in `src/features/dns/api/dkim-secrets.ts`, `exportKey()` as a direct `api.GET` call;
  - `src/features/dns/components/ExportPrivateKeyAction.vue`: the confirmation, the request, the
    dialog, and the problem handling of research R12;
  - wiring into `src/features/dns/pages/DkimKeyPage.vue` with the export-off note.

  T090 and T091 must pass.
- [ ] T094 [US6] Add the `dns.dkim.export.*` messages in three locales. Run `npm run i18n:check`.

**Checkpoint**: US6 works on its own once US1 is in place.

---

## Phase 9: User Story 7 - Keep the ISPConfig DNS zone in sync with DKIM keys (Priority: P3)

**Goal**: Publication outcomes after every key change, and "Publish DNS record again" from the
entry and from `failed` or `noZone` outcomes, only while publication is enabled.

**Independent Test**: Against the mock with publication on and off, generate, import, copy,
replace and republish keys with every outcome, and check every message and action.

### Tests for User Story 7 (write first; must fail)

- [ ] T095 [US7] Implement `publishDkimDnsRecord` in `tests/mocks/handlers/dkim.ts`:
  - `200` with the entry, the outcome and `ETag`;
  - `403 dkim-dns-publication-disabled` while off;
  - `404` without a key;
  - `If-Match` gives `412`.

  Extend the publication outcome injection (T006) so that each operation can return `published`,
  `noZone` or `failed` with any reason code and detail.
- [ ] T096 [P] [US7] Write `tests/e2e/dns/dkim-publication.spec.ts`. It covers:
  - US7-AS1: a generation with `published` says the record was published;
  - US7-AS2: `noZone` says to publish manually and shows the record to copy;
  - US7-AS3: "Publish DNS record again" with `published` announces success;
  - US7-AS4: publication off shows no outcome and no action after any change;
  - FR-044: `failed` with each reason code is translated, and the detail is plain text marked
    English;
  - FR-045:
    - "Publish again" from a `failed` outcome in a run result and from the entry;
    - the publication turned off meanwhile shows the message and removes the action;
    - a `412` offers to try again;
  - outcomes after import, copy, replacement and bulk deletion (`removed`, `noRecordToRemove`).
- [ ] T097 [P] [US7] Write `tests/unit/features/dns/PublishAgainAction.spec.ts`:
  - administrators only, while enabled;
  - `If-Match`;
  - the result written to `detail(name)`;
  - a `403 dkim-dns-publication-disabled` invalidates the capabilities.

### Implementation for User Story 7

- [ ] T098 [US7] Implement `src/features/dns/components/PublishAgainAction.vue` and the mutation in
  `src/features/dns/api/dkim.ts`. Offer it:
  - on `src/features/dns/pages/DkimKeyPage.vue`;
  - from `failed` and `noZone` outcomes in `PublicationOutcome.vue`, through an `action` slot that
    `RunDialog`, `DkimCopyPage`, `DkimImportPage` and `ReplaceKeyDialog` fill.

  T096 and T097 must pass.
- [ ] T099 [US7] Add the `dns.publication.publishAgain.*` messages in three locales. Run
  `npm run i18n:check`.

**Checkpoint**: US7 works on its own once US1 is in place. Its outcomes inside runs need US2 and
US5.

---

## Phase 10: User Story 8 - Trace DKIM and MTA-STS changes (Priority: P3)

**Goal**: History actions on DKIM entries and MTA-STS sections, and labels for the DKIM and MTA-STS
event and target types in the audit log, with details shown generically (plan gap 1).

**Independent Test**: Against the mock with audit records for every DKIM and MTA-STS operation,
including refusals, open the history of an entry and of a policy as an administrator. Check that a
domain administrator is never offered it.

### Tests for User Story 8 (write first; must fail)

- [ ] T100 [US8] Add the scenario `dns-audit-records` to `tests/mocks/scenarios/dns.ts`, with audit
  records built by `tests/mocks/factories/audit-event.ts`:
  - every one of the eight event types for `example.org` and `example.com`, including:
    - an import with overwrite, with `details.old` and `.new` (`selector`, `keyLength`,
      `publicKeySha256`), `overwriteRequested` and `dnsPublication`;
    - a copy with `sourceName`;
    - an export;
    - an `mtaStsPolicyUpdate` by `reseller` with `changes.mode` and `oldPolicyId`/`newPolicyId`;
  - refusals with `failureReason` `featureDisabled`, `versionOutdated` and `conflict`.
- [ ] T101 [P] [US8] Write `tests/e2e/dns/history.spec.ts`. It covers:
  - US8-AS1: History from `example.org`'s entry opens the audit log filtered to `dkimKey` and
    `example.org`; the import record shows the actor, time, client address, and the old and new
    selector and key length in the details; no `PRIVATE KEY` appears;
  - US8-AS2: History from the MTA-STS section shows the mode change with the old and new
    identifiers;
  - US8-AS3: a domain administrator sees no History action on the entry or the section;
  - FR-070:
    - the target-type filter offers "DKIM key" and "MTA-STS policy";
    - the eight event types have translated labels;
    - refusals show their translated reason.
- [ ] T102 [P] [US8] Extend `tests/unit/features/audit-log/labels.spec.ts`: labels for
  `dkimKeyGeneration`, `dkimKeyImport`, `dkimKeyCopy`, `dkimKeyDeletion`, `dkimPrivateKeyExport`,
  `dkimDnsPublication`, `mtaStsPolicyCreation` and `mtaStsPolicyUpdate`, and for the target types
  `dkimKey` and `mtaStsPolicy`.

### Implementation for User Story 8

- [ ] T103 [US8] Implement:
  - `HistoryLink` (UI 002) on `src/features/dns/pages/DkimKeyPage.vue` (`targetType=dkimKey`,
    `targetId=<name>`) and `src/features/dns/components/DomainMtaStsSection.vue`
    (`targetType=mtaStsPolicy`, `targetId=<domain>`), for administrators only;
  - the labels in `src/features/audit-log/labels.ts`;
  - the target-type options in the audit log filters (UI 002's filter component).

  T101 and T102 must pass.
- [ ] T104 [US8] Add or finalise `auditLog.events.*` and `auditLog.targets.*` for the 010 values in
  three locales. Run `npm run i18n:check`.

**Checkpoint**: All user stories work on their own.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story verification, budgets, documentation and release readiness.

- [ ] T105 [P] Write and pass `tests/e2e/dns/reflow.spec.ts`. Every screen, dialog and state of this
  feature, including 1,000-character record values and 253-character names:
  - has no horizontal scroll at 360 and 320 px, or at the equivalent of 400 % zoom on 1,280 px;
  - works in landscape;
  - never hides the focused element behind the sticky header or the selection bar (WCAG 2.4.11);
  - at 360 px, the save, cancel and run actions of the generation, replacement, run, import, copy
    and MTA-STS forms, and the selection action bar, are visible without scrolling to the end
    (FR-080);
  - has no transitions under `prefers-reduced-motion` (FR-079, FR-080, SC-005).
- [ ] T106 [P] Write and pass `tests/e2e/dns/keyboard-only.spec.ts`. With the keyboard alone, and
  focus visible at every step (FR-082):
  - list filtering and sorting;
  - selection;
  - copying;
  - generation;
  - MX host entry;
  - deactivation;
  - the diagnostics filter;
  - zone file download;
  - every dialog.
- [ ] T107 [P] Write and pass `tests/e2e/dns/storage-and-secrets.spec.ts` (SC-007, FR-076). After
  the import, export and copy flows:
  - storage holds only UI 001's allowed keys;
  - no stored value, address, `history.state` or live region contains `PRIVATE KEY` or any line of
    the imported key;
  - with storage throwing (init script), every DNS screen still works.
- [ ] T108 [P] Write and pass `tests/e2e/dns/permissions.spec.ts` (SC-006, FR-002, FR-003):
  - for administrator and domain administrator, with export and publication on and off, the
    actions on the list, entry, sections and diagnostics equal the FR-002 matrix;
  - a `403 forbidden` mid-session (role changed via `PATCH /__mock`) shows the translated reason,
    refreshes the identity and capabilities, updates the actions and keeps unsaved input;
  - a mailbox user gets "no access" on every DNS address.
- [ ] T109 Add a collection for `/ng/dns/dkim-keys` (scenario `dns-many`) to `lighthouserc.cjs` and
  `scripts/run-lhci.mjs`. Run `npm run build && npm run budget:check && npm run lhci`, and fix
  regressions until the initial JS is at most 204,800 bytes gzipped and performance and
  accessibility are at least 0.9 (SC-013, constitution VII).
- [ ] T110 Run quickstart Part C (`scripts/smoke/stack-up.sh`, `npm run test:smoke -- --grep
  @dns`, `scripts/smoke/stack-down.sh`) against the mailcow-rest-v2 dev stack with API 010
  implemented, and confirm that the API log contains no private key.
- [ ] T111 [P] Add the plan's two parity notes ("all names without a key" across pages; atomic
  replacement) to the "Legacy Parity" tables of `specs/010-dkim-mta-sts-dns/spec.md`.
- [ ] T112 Run quickstart Part D on a mid-range Android phone and an iPhone:
  - SC-001 and SC-013 timings;
  - VoiceOver and TalkBack passes of US1–US4;
  - the SC-002 parity check for the four listed names.

  Record the results in a "Validation log" section appended to
  `specs/010-dkim-mta-sts-dns/quickstart.md`.
- [ ] T113 [P] Run `npm run i18n:check`, remove the unused `dns.*` keys it reports from
  `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, and list the new cs-cz and sk-sk strings of this
  feature for the owner's review (UI 001 owner question 4).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 first; it may stop the feature. T002 after T001. T003 and T004 after
  T002.
- **Foundational (Phase 2)** depends on Setup and **blocks every user story**:
  - test infrastructure: T005 → T006 → T007; T008 after T005;
  - then the tests T009–T019 (all [P]);
  - then the implementation: T020, T021, T022–T025 [P], T026, T027, T028 [P], T029.
- **User stories (Phases 3–10)** depend on Foundational, and on each other as the table below shows.
  End-to-end tests start from scenarios with an active session, never through sign-in.
- **Polish (Phase 11)** depends on every story it verifies. T110 also needs API 010 implemented in
  the dev stack.

### User Story Dependencies

| Story | Priority | Depends on | Why |
|---|---|---|---|
| US1 | P1 | Foundational | MVP: list, entry, DKIM sections |
| US2 | P1 | US1 | Adds generation to `DkimKeysPage`, `DkimKeyPage` and `DomainDkimSection` |
| US3 | P1 | Foundational; US1 for the "Check DNS" placement on the entry page (part of T062) | Diagnostics have their own page and handler |
| US4 | P2 | Foundational | Own handler, sections and list |
| US5 | P2 | US1, US2 | Actions on the entry and list pages; `ReplaceKeyDialog` reuses `GenerateKeyDialog`; deletion extends `src/features/dns/dkim/bulk.ts` |
| US6 | P3 | US1 | Action on the entry page |
| US7 | P3 | US1; US2 and US5 for outcomes inside runs | `PublishAgainAction` on the entry and in outcomes |
| US8 | P3 | US1, US4 | History on the entry page and the MTA-STS section |

### Files edited by several stories

Edits to these files must be serialised, even when stories run in parallel:

- `src/features/dns/routes.ts` and `src/app/navigation/catalogue.ts`: US1, US3, US4, US5;
- `src/features/dns/index.ts`: US1, US3, US4;
- `src/features/dns/api/dkim.ts`: US1, US2, US5, US7;
- `src/features/dns/pages/DkimKeyPage.vue`: US1, US2, US3, US5, US6, US7, US8;
- `src/features/dns/pages/DkimKeysPage.vue` and `src/features/dns/dkim/bulk.ts`:
  US1, US2, US5;
- `src/features/dns/components/DomainDkimSection.vue`: US1, US2;
- `src/features/dns/components/DomainMtaStsSection.vue`: US4, US8;
- `src/features/dns/components/PublicationOutcome.vue`: Foundational, US7;
- the UI 002 domain page and list and the UI 004 alias domain page and list: US1, US3, US4;
- `tests/mocks/handlers/dkim.ts` and `tests/mocks/scenarios/dns.ts`: every story;
- `specs/010-dkim-mta-sts-dns/plan.md` (legacy form map): T004a, before every screen task;
- `src/i18n/messages/*.json`: every story.

### Within Each User Story

- First the mock handlers and scenarios. Then the end-to-end, unit and smoke tests, which must fail.
  Then the implementation (api → logic → components → pages → entry points). Then the messages in
  all three locales.
- The message tasks of different stories edit the same locale files. Run them one after another.

### Parallel Opportunities

- Setup: T003 and T004 after T002.
- Foundational: T005 and T008; T009–T019 (tests) all in parallel; T022–T025 and T028 in parallel.
- Stories: after Foundational, US1, US3 and US4 can be staffed in parallel. US2 follows US1. US5
  follows US2. US6 and US7 follow US1. US8 follows US1 and US4.
- Within each story, every task marked [P] in parallel.

---

## Parallel Example: User Story 3

```bash
# After T052 (handler and scenarios), write all US3 tests together:
Task: "T053 tests/e2e/dns/diagnostics-result.spec.ts"
Task: "T054 tests/e2e/dns/diagnostics-run.spec.ts"
Task: "T055 tests/e2e/dns/entry-points-check-dns.spec.ts"
Task: "T056 tests/unit/features/dns/{summary-groups,check-labels,check-messages,rate-limit,diagnostics-query}.spec.ts"
Task: "T057 tests/unit/features/dns/{DnsCheckCard,DnsCheckTable,DiagnosticsSummary,ZoneFilePanel,RunStatus}.spec.ts"
Task: "T058 tests/smoke/dns-diagnostics.smoke.spec.ts"

# Then: T059 (logic and query), then T060 (components, [P]), then T061 (page), then T062 (entry points).
```

## Parallel Example: User Story 5

```bash
Task: "T076 tests/e2e/dns/dkim-import.spec.ts"
Task: "T077 tests/e2e/dns/dkim-copy.spec.ts"
Task: "T078 tests/e2e/dns/dkim-delete.spec.ts"
Task: "T079 tests/e2e/dns/dkim-replace.spec.ts"
Task: "T080 tests/unit/features/dns/*.spec.ts (secrets, picker, dialogs)"
Task: "T081 tests/smoke/dns-dkim-manage.smoke.spec.ts"
# after T082:
Task: "T083 import page"   Task: "T084 copy page"   Task: "T085 delete dialogs"   Task: "T086 replace dialog"
# then T087 wires them into the shared pages (serialised).
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup) and Phase 2 (Foundational): the pin, the catalogue split, the shared blocks,
   with CI green.
2. Phase 3 (US1): list, entry, copy buttons, and the DKIM sections on the domain and alias domain
   pages.
3. **Stop and validate**: run `npm run test:e2e -- tests/e2e/dns --grep US1` on both viewports, and
   the US1 rows of quickstart Part B.

### Incremental Delivery

1. Foundation, then US1 (MVP).
2. US2 (generation), then US3 (diagnostics): all P1 stories, enough to replace the classic DKIM
   record display and DNS modal for routine work.
3. US4 (MTA-STS), then US5 (import, copy, replace, delete): replaces the classic DKIM tab and the
   MTA-STS tab.
4. US6, US7 and US8 (export, publication, history).
5. Polish: reflow, keyboard, secrets, permissions, budgets, smoke, device validation.

### Parallel Team Strategy

After Foundational:
- Developer A: US1, then US2, then US5.
- Developer B: US3, then US7 (after US1).
- Developer C: US4, then US8 (after US1), then US6.

Edits to the shared files listed under "Files edited by several stories" run one at a time.

---

## Notes

- [P] tasks touch different files and have no dependency on an incomplete task.
- [USn] labels map tasks to the spec's user stories, and test titles carry the spec IDs for
  traceability.
- Verify that each test fails before implementing (constitution VI).
- Commit after each task or logical group, directly to `main`, with short imperative subjects.
- Never add:
  - a hand-written API type;
  - a `v-html` (legacy texts with HTML go through UI 001's `SanitizedHtml.vue` only);
  - an inline style or script;
  - a storage key;
  - a TanStack query or mutation that carries a private key;
  - an automatic request while idle;
  - a hard-coded limit that the capabilities read provides.
