---
description: "Task list for UI feature 004: aliases, alias domains, resources and sender permissions"
---

# Tasks: Aliases, Alias Domains, Resources and Sender Permissions

**Input**: Design documents from `specs/004-aliases-alias-domains-resources/`:
- [plan.md](./plan.md)
- [spec.md](./spec.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/README.md](./contracts/README.md)
- [quickstart.md](./quickstart.md)

**Prerequisites**:
- The design documents above are complete.
- **Before Phase 1** (research R1, R2):
  - UI 001, UI 002 and UI 003 are implemented, and their gates pass.
  - mailcow-rest-v2 feature 004 is implemented: its `tasks.md` is complete and its quickstart Part A
    passes.

**Tests**: Mandatory (constitution VI, test-first). In every phase, tests are written first and must
fail before the implementation tasks that follow them. Every end-to-end spec:
- runs on `mobile-chromium` (360 px), `desktop-chromium` and `mobile-webkit`;
- calls `expectAccessible` (axe, WCAG 2.2 AA, both themes) on every screen, dialog and state it
  reaches (SC-003);
- calls `expectNoHorizontalScroll` (360 and 320 px) and `expectTouchTargets` on the mobile projects;
- fails on any CSP violation or mock contract violation (UI 001 T029 fixtures);
- names its spec reference in the test title (`US2-AS8 …`, `FR-060 …`, `Edge: …`).

Smoke specs carry the tag `@feature-004`.

**Organization**: Tasks are grouped by user story (spec priorities P1 to P3), so that each story can
be implemented and tested on its own once the foundation is in place.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task belongs to (US1 to US8)
- Paths are relative to the repository root `mailcowui-ng/`

---

## Phase 1: Setup (contract and tooling)

**Purpose**: Pin the contract that ships API 004, expose its types, and check that UI 001's legacy
translation layer covers this feature (research R1, R20; constitution IV 1.3.0).

- [X] T001 *(done: pinned 33f1eea0 (API main after fc79902, API 004 complete); the feature 004 diff since 3207925 closes G1, G2 and G4; Pin record in contracts/README.md)* Bump the contract (research R1):
  - Run `scripts/contract/bump.sh <ref>`. `<ref>` is the mailcow-rest-v2 release tag that ships the
    feature 004 implementation, or else the commit that merges it. It is never older than the pin
    in `contract/VERSION.json`. Keep the existing pin when it already contains the API 004
    implementation.
  - Before accepting it, read `git -C ../mailcow-rest-v2 diff 32079252d55797d3da4e58ae661e9fb91c51c6f9..<ref>`
    for the feature 004 files listed in `specs/004-aliases-alias-domains-resources/contracts/README.md`.
    Any change stops the task for a plan review (constitution I).
  - The task updates `contract/openapi.yaml`, `contract/openapi.json`, `contract/VERSION.json` and
    `src/api/generated/schema.ts`.
  - Confirm that all 23 operations of the contracts README exist. Add a "Pin record" section to that
    README with the ref, the commit, the bundle sha256 and the operation count.
- [X] T002 *(done: the 004 types, value arrays and the four list parameter aliases; typecheck and unit tests green after the bump)* Re-export from `src/api/index.ts`:
  - the root types: `Alias`, `AliasKind`, `AliasDestinationType`, `AliasCreateRequest`, `AliasPatch`,
    `AliasCapabilities`, `AliasCopyReport`, `AliasCopyOutcome`, `AliasBulkActionRequest`,
    `AliasLimitReachedProblem`, `AliasDomain`, `AliasDomainRateLimit`, `AliasDomainCreateRequest`,
    `AliasDomainPatch`, `AliasDomainCreated`, `AliasDomainCreationReport`,
    `AliasDomainAlreadyExistsProblem`, `AliasDomainBulkActionRequest`, `Resource`, `ResourceKind`,
    `ResourceBookingRule`, `ResourceCreateRequest`, `ResourcePatch`, `ResourceBulkActionRequest`,
    `MailboxSenderSettings`, `MailboxSenderSettingsPatch`, `MailboxSenderPermission`,
    `MailboxSenderPermissionCandidate` and `MailboxImplicitSenderAddress`;
  - the value arrays `aliasKindValues`, `aliasDestinationTypeValues`, `resourceKindValues` and
    `resourceBookingRuleValues`;
  - the list parameter aliases `AliasListParams`, `AliasDomainListParams`, `ResourceListParams` and
    `SenderPermissionCandidateParams`, from the generated `operations[…]['parameters']['query']`
    (data-model §1).

  Then run `npm run typecheck`, `npm run test:unit` and `npm run test:e2e`, and fix any type error
  the bump caused in existing code without changing behaviour.
- [X] T003 *(done: tests/unit/i18n/legacy-004.spec.ts; they pass on UI 001's layer)* [P] Extend the tests of UI 001's legacy translation layer (research R20, constitution IV
  1.3.0) with this feature's cases, skipping what UI 001, UI 002 or UI 003 already cover:
  - `%s` and `%d` are filled in order (`success.alias_added`: "Alias address %s (%d) has been added"
    with the address and the ID);
  - values with markup (`add.goto_spam`, `edit.sender_acl_info`, `add.alias_address_info`) render
    unchanged through `SanitizedHtml.vue`;
  - a key missing in sk-sk upstream (`add.internal`) falls back to `en-gb`.

  The new tests must fail.
- [X] T004 *(done: no gap: UI 001's layer already fills placeholders, renders markup and falls back to en-gb; the placeholders of legacy texts built at runtime (LEGACY_ARGS) came with T013)* Fill the gaps T003 reports in UI 001's legacy translation layer, test first, without
  changing its behaviour for earlier features. There is no build-time import, `legacy-map.json`
  option or `stripMarkup` step to add.
- [X] T005 *(done: coverage.json gains the 10 events, 4 targets, permissionDenied, notFound, conflictsWith and 5 problem types; ENUM_NAMESPACES gains aliasKind, aliasDestinationType, resourceKind and resourceBookingRule (the values the form map renders; the other enumerations of data-model §8 are shown through legacy messages or not at all); targets and most values through LEGACY_TEXTS)* Extend the translation scope (research R20, data-model §8):
  - Append this feature's values to `src/i18n/coverage.json`: the 10 event types, the 4 target
    types, the failure reasons, the rule codes and the problem types of data-model §8.
  - Add the closed enumerations of data-model §8 to `ENUM_NAMESPACES` in `scripts/i18n/lib.mjs`.
  - Write their labels in `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` (FR-067, SC-005), only
    where no legacy key has the same meaning (constitution IV 1.3.0; for example
    `AliasDestinationType` uses `add.goto_null`, `add.goto_spam`, `add.goto_ham`, and
    `ResourceBookingRule` the `mailbox.booking_*` keys). Never machine-translate:
    - `enums.<name>.<value>`;
    - `auditLog.eventTypes.*` and `auditLog.targets.*` under UI 001's naming;
    - the base `problem.<name>` messages.

  `npm run i18n:check` must pass.

**Checkpoint**: The contract is pinned, typecheck and existing tests are green, and the i18n tooling
accepts the new entry forms.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Everything the stories share:
- the dependency check on UI 001–003 and the promotions it triggers;
- query keys and problem mapping;
- the complete contract-validated mock for the 23 operations;
- the new shared blocks;
- the capabilities, permissions and catalogue rows.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Legacy form map (constitution IV 1.3.0)

- [X] T005a *(done: plan.md "Legacy form map (T005a)" with parts 1-3; the orchestrator's decisions are applied (goto checkboxes, sender multi-select, booking select, one section per legacy form, deletion and expand only in the lists, legacy alerts, no confirmation legacy lacks) and the remaining spec items beyond legacy are listed as not built)* Write the legacy form map for this feature's screens (screen → legacy template → field → legacy key, including messages) in `plan.md`, and use only those keys plus the minimal new strings in the implementation.
  Follow `docs/conventions.md` "Translations and forms" and the templates in plan.md "Translations and forms (constitution IV 1.3.0)"; list any deviation under "Deviations needing a decision". Every later screen task depends on it.

### Dependencies on earlier features (research R2)

- [ ] T006 Write `tests/unit/dependencies/feature-004-dependencies.spec.ts`. It imports each block of
  research R2 and checks the behaviour UI 004 relies on:
  - D1 `useListState`: repeatable parameters and `onReset`.
  - D2 `useBulkSelection`:
    - `toggle`, `selectPage`, `clear` and `keep`, and the reset through `onReset`;
    - the bulk limit from the capabilities: once it is reached, further selection is disabled, with
      a message that states the limit (conventions "Shared building blocks"). "Select all" selects
      only the first `limit` entries of the page (spec FR-060).
  - D3 `BulkActionBar.vue`: the count, actions and Cancel.
  - D4 `BulkResultSummary.vue`: rows per outcome including `unknown`, a scoped `#item` slot, and a
    "Refresh the list" action shown when a row is `outdated`.
  - D5 `ConfirmDialog`: `requireTyped` and rich content, with focus on Cancel.
  - D6 `EditableSection.vue`: driven by `edit`, one section at a time; and `changedSince()`.
  - D7 `HistoryLink.vue`: the resulting address. The audit log list state accepts `targetType` and
    `targetId`.
  - D8 `ActiveFilterChips.vue` in `src/shared/components/`.
  - D9 the leave guard `useLeaveGuard` (the canonical name in `docs/conventions.md`).
  - D10 `NotFoundState.vue`.
  - D14 `ApiProblem` exposes the extension members `holder`, `count`, `limit`, `requested`,
    `existingKind`, `attributes` and `requiredFlags`.
  - D15 `attribute-not-permitted` and `permission-flag-required` responses invalidate the identity,
    as `forbidden` does, in `src/api/query/client.ts`.
  - D16 `isEntryAvailable(id)`.
  - D17 the route `domain-detail`.
  - D18 the route `mailbox-detail`, `src/features/mailboxes/sections.ts` and `MailboxSectionNav`
    rendering entries whose route exists.
  - D19 `src/i18n/coverage.json`.
  - D20 the domain and mailbox mock state, handlers and factories.
  - `SearchField.vue`: submit or a 500 ms pause, and a result-count hook.
  - `utf8ByteLength()`.

  The test must fail for every block that is missing or lacks a listed behaviour.
- [ ] T007 Fill the non-promotion gaps T006 reports, test first in the matching
  `tests/unit/shared/**` spec, keeping every earlier feature's tests green:
  - D2's limit behaviour in `src/shared/composables/useBulkSelection.ts` (selection disabled at the
    limit, "Select all" capped);
  - D4's `#item` slot and refresh action in `src/shared/components/BulkResultSummary.vue`;
  - D15 in `src/api/query/client.ts`;
  - D16 in `src/app/navigation/visibility.ts`;
  - `src/shared/components/SearchField.vue` and `src/shared/validation/utf8.ts`, if missing.

  If UI 002 or UI 003 changed a name or path, update the references in this feature's `plan.md`,
  `research.md` and `tasks.md` instead of creating a copy.
- [ ] T008 [P] Promote `DomainPicker` (D11):
  - Write `tests/unit/shared/components/DomainPicker.spec.ts`. It covers:
    - single and multiple modes;
    - a debounced server search, with "load more" in pages of 25;
    - `sources` of domains and alias domains in two labelled groups;
    - `disabledReason(item)`, which renders the option disabled with its reason as text;
    - the readable and ASCII names;
    - keyboard operation, and no `ComboboxViewport`;
    - loading, "no match" and error-with-retry states.
  - Move `src/features/mailboxes/components/fields/DomainPicker.vue` to
    `src/shared/components/DomainPicker.vue`. Fetching goes through props, so shared code never
    imports a feature.
  - Update `src/features/mailboxes/index.ts` and UI 003's imports, so that UI 003's tests stay green.
- [ ] T009 [P] Promote UI 002's display and field components (D12, D13):
  - Write `tests/unit/shared/components/{DomainNameText,DkimFields,RateLimitField,CreationReport}.spec.ts`:
    - `DomainNameText`: the readable text, and the ASCII text only when it differs.
    - `DkimFields`:
      - a "Generate a DKIM key" switch whose value the parent owns;
      - a selector input with `autocapitalize="none"`;
      - a key size `<select>` from a `keySizes` prop;
      - the selector and key size hidden while the switch is off.
    - `RateLimitField`: a whole number with `inputmode="numeric"` and a frame `<select>` from a
      `frames` prop, where empty means none.
    - `CreationReport`: a `lines` prop with the kinds `done`, `info` and `warning`, each shown with
      an icon and text, and a per-line `#repeat` slot.
  - Move `src/features/domains/components/list/DomainNameText.vue`,
    `src/features/domains/components/fields/DkimFields.vue`,
    `src/features/domains/components/fields/RateLimitField.vue` and
    `src/features/domains/components/detail/CreationReport.vue` to `src/shared/components/`. Make them
    prop-driven, with UI 002 passing its domain capabilities.
  - Update UI 002's imports, so that UI 002's tests stay green. T006 must pass after T007–T009.

### Query keys and problem mapping

- [ ] T010 [P] Write `tests/unit/api/query-keys-004.spec.ts`:
  - the key shapes of data-model §3: `['capabilities','aliases']`; the `aliases`, `alias-domains`,
    `resources` and `sender-settings` list and detail keys; `['alias-domains','options',{q}]`;
    `['sender-permission-candidates',{mailbox,q,type}]`;
  - parameters typed from the generated operations;
  - prefix invalidation, so that `['aliases']` matches the list and the detail keys.
- [ ] T011 Extend `src/api/query/keys.ts` so that T010 passes.
- [X] T012 *(done: tests/unit/i18n/problems-004.spec.ts)* [P] Write `tests/unit/i18n/problems-004.spec.ts` (research R17, FR-068, SC-005):
  - **Form-context lookup order**: `<formKey>.errors.<field>.<code>.<param>.<value>`, then
    `<formKey>.errors.<field>.<code>`, then `validation.<code>.<param>.<value>`, then
    `validation.<code>`, then `validation.invalid`.
    - The discriminating parameters are `kind`, `unit`, `field`, `format` and `resource`.
    - Index stripping: `destinations.2` → `destinations`.
    - `{entry}` is the value at the index sent.
  - **Problem extension members as parameters**:
    - numbers formatted with the locale;
    - `requiredFlags` rendered with the legacy `acl.*` labels;
    - `holder` and `existingKind` sub-keys.
  - Every code and parameter variant of data-model §6, and every problem type of the contracts
    README, resolves to an existing en-gb key.
- [X] T013 *(done: problems.ts: form-context keys, problem sub-keys by holder and existingKind, string and flag extension parameters, {entry}/{entryDomain}; validation.byParam.* instead of validation.<code>.<param>.* (a vue-i18n key cannot be a message and a group); useProblemForm gains formKey, valueAt and problemParams; legacy messages with placeholders through LEGACY_TEXTS + LEGACY_ARGS (text()))* Extend `src/i18n/problems.ts` and `src/shared/composables/useProblemForm.ts` (a
  `formKey` option and the `{entry}` parameter) so that T012 passes. Add the en-gb, cs-cz and sk-sk
  messages of data-model §6:
  - `validation.notEligible.kind.{resource,externalDestination,relayDomain,aliasDomain,localDomain}`;
  - `validation.notEligible.allowedRoles`;
  - `validation.tooLong.unit.{bytes,characters}`;
  - `validation.invalidFormat.format.{aliasAddress,emailOrDomain,senderPermission,resourceDescription}`,
    unless `validation.format.*` keys already exist from UI 002;
  - `problem.address-in-use.holder.{mailbox,resource,alias,temporaryAlias}`;
  - `problem.alias-domain-already-exists.existingKind.{domain,aliasDomain}`;
  - the count and limit message of `problem.domain-alias-limit-reached`.

### Contract-validated mock for the 23 operations (research R21)

- [ ] T014 [P] Write `tests/unit/mocks/feature-004-handlers.spec.ts` against `tests/mocks/node.ts`.
  Every response passes the validator, and the documented behaviours hold:
  - **Aliases**:
    - `listAliases`: every filter, sort key and `q` field of the contract; newest first by default;
      the domain administrator's scope including the alias domains of their domains; orphaned
      aliases for administrators only.
    - `createAlias`:
      - `409 address-in-use` for each `holder`, including an address that reaches a mailbox through
        an alias domain;
      - `409 domain-alias-limit-reached` with `count`, `limit` and `requested`;
      - `422` with each code of data-model §6 at its path;
      - external destinations: `422 notEligible {kind: externalDestination}` when disabled
        server-wide, and `403 attribute-not-permitted` with `attributes` and `requiredFlags` for a
        domain administrator without `aliasExternalGoto`.
    - `updateAlias`:
      - `If-Match` and `412`;
      - only added destinations are checked;
      - comments are checked only when they change;
      - an orphaned alias accepts a change only to an existing domain;
      - `immutable` for a read-only member sent with another value.
    - `deleteAlias`: `If-Match`.
    - `copyAliasOverAliasDomains`: the per-alias-domain outcomes; `409 not-primary-domain-alias`; an
      empty `copies` list for a domain without alias domains.
    - `applyAliasBulkAction`:
      - per-target outcomes, with `outdated` for a stale `version` and `notFound` for a missing or
        out-of-scope alias;
      - `meta.copies` for `copyOverAliasDomains`;
      - `422 tooMany` above 100 targets.
    - `getAliasesCapabilities`: `dkimDefaults` is `null` for a domain administrator without
      `aliasDomains`.
  - **Alias domains**:
    - list, detail and create, including the `creationReport` outcomes from the scenario and
      `dkimSelector: ""` giving `notRequested`;
    - `alias-domain-already-exists` with `existingKind`;
    - `reserved`, `conflictsWith`, and `notEligible {kind: relayDomain}`;
    - `permission-flag-required` without `aliasDomains`, and `attribute-not-permitted` for
      `rateLimit` without `ratelimit`;
    - a target change hitting the alias limit;
    - deletion with its cascade;
    - `503 temporary-failure` while `sharedStoreDown`.
  - **Resources**:
    - the derived address (`Raum Süd` → `RaumSd`);
    - `invalidFormat {format: resourceDescription}`;
    - `409 address-in-use` for a derived address;
    - the booking rules, with `conflictsWith {field: bookingRule}`.
  - **Sender settings**:
    - implicit addresses, `changeable` and `stale` markers, and `senderCheckDisabled`;
    - whole-set replacement;
    - for a domain administrator, entries outside their scope kept;
    - `*` stored alone, and refused for domain administrators;
    - `notEligible {kind: localDomain}` for external addresses;
    - `attribute-not-permitted` without `extendSenderAcl`;
    - an added alias that allows sending is dropped (FR-055);
    - candidates: `mailbox`, `q`, `type`, paging and the exclusions.

  The test must fail.
- [ ] T015 Extend `tests/mocks/scenarios/state.ts` with `aliases`, `aliasDomains`, `resources`,
  `senderAcl`, `temporaryAliasAddresses`, `capabilities004`, `aliasDomainCreationOutcomes` and
  `sharedStoreDown`, on top of UI 002's domains and UI 003's mailboxes. Create the factories
  `tests/mocks/factories/alias.ts`, `tests/mocks/factories/alias-domain.ts`,
  `tests/mocks/factories/resource.ts` and `tests/mocks/factories/sender-acl.ts`. `PATCH
  /__mock/scenarios/:id` in `tests/mocks/server.ts` gains:
  - `changeElsewhere` (an object's stored values and version change);
  - `deleteElsewhere`;
  - `flags` (a domain administrator's permission flags);
  - `capabilities004`;
  - `sharedStoreDown`.
- [ ] T016 Implement `tests/mocks/handlers/feature-004-rules.ts` (research R21):
  - normalisation;
  - holder lookup across mailboxes, resources, aliases and temporary aliases, including addresses
    reached through an alias domain;
  - external classification, against active domains and active alias domains;
  - the alias limit, counted as API 002 counts;
  - scope and `404`;
  - `orphaned`, `inAliasDomain` and `primaryDomain`;
  - ETags over the stored fields of API data-model "Version tags";
  - implicit sender addresses, `changeable`, `stale` and candidate filtering;
  - resource address derivation;
  - validation codes and parameters as in data-model §6.
- [ ] T017 Implement `tests/mocks/handlers/aliases.ts`, `tests/mocks/handlers/alias-domains.ts`,
  `tests/mocks/handlers/resources.ts` and `tests/mocks/handlers/sender-settings.ts`. Together they
  cover the 23 operations, written with `openapi-msw` on T016's rules and wrapped by the validator.
  Register them in `tests/mocks/handlers/index.ts`. A request that matches no contract operation
  stays a recorded violation (FR-070). T014 must pass.
- [ ] T018 Create `tests/mocks/scenarios/feature-004-base.ts` and register it in
  `tests/mocks/scenarios/index.ts`, with these scenarios:
  - `admin-004`: active admin, ten domains with alias domains, a few aliases, resources and sender
    settings;
  - `domain-admin-004`: manages two of the ten domains, with the flags `aliasDomains`,
    `aliasExternalGoto`, `extendSenderAcl` and `ratelimit` off;
  - `domain-admin-004-all-flags`;
  - `mailbox-user-004`;
  - `capabilities-unavailable`: a documented `500` on `getAliasesCapabilities`;
  - `groupware-disabled`;
  - `external-destinations-disabled`.

### New shared blocks (research R3, R8–R10)

- [ ] T019 [P] Write `tests/unit/shared/validation/entry-list.spec.ts` and
  `tests/unit/shared/composables/useSequentialCreate.spec.ts`:
  - `parseEntryList` (data-model §2):
    - splits on `,`, `;`, any whitespace and new lines, and trims;
    - drops empty entries;
    - drops case-insensitive duplicates, keeping the first spelling;
    - `index` follows the order sent;
    - the letter case of local parts is kept.
  - `useSequentialCreate` (data-model §7):
    - strictly one request at a time, in order;
    - `created`, `refused` and `notProcessed` outcomes;
    - an entry-level refusal continues and a form-level one stops, by the `classify` callback;
    - a network failure stops the run and marks the rest `notProcessed`;
    - the pending state and progress ("2 of 3") are exposed;
    - nothing is retried.
- [ ] T020 Implement `src/shared/validation/entry-list.ts` and
  `src/shared/composables/useSequentialCreate.ts` so that T019 passes.
- [ ] T021 [P] Write `tests/unit/shared/components/EntryListField.spec.ts`:
  - a labelled textarea with a hint, `autocapitalize="none"`, `autocorrect="off"` and
    `spellcheck="false"`;
  - the parsed entries listed as text, with an optional per-entry marker such as "Catch-all";
  - server errors for `<field>.<n>` shown on the entry with `index` n, linked through
    `aria-describedby`, and summarised;
  - a read-only mode;
  - wrapping of 254-character entries without horizontal overflow.
- [ ] T022 Implement `src/shared/components/EntryListField.vue` on UI 001's `FormField` so that T021
  passes.
- [ ] T023 [P] Write `tests/unit/shared/composables/useFormDraft.spec.ts` (data-model §4):
  - the draft is saved under `fullPath#formId` when the form unmounts while the session ended;
  - it is restored only for the same username;
  - it is cleared by `clearAllDrafts()`, on account change, after a save and on discard;
  - nothing is written to `localStorage` or `sessionStorage`.
- [ ] T024 Implement `src/shared/composables/useFormDraft.ts`, and call `clearAllDrafts()` and
  `setDraftOwner()` from `src/app/session/sign-out.ts`, `src/app/session/session-end.ts` and
  `src/app/session/cross-tab.ts`, so that T023 passes.

### Capabilities, permissions and navigation

- [ ] T025 [P] Write `tests/unit/features/aliases/permissions.spec.ts`. It is table-driven over every
  row of spec FR-002, for administrators, domain administrators with each flag on and off, and
  mailbox users (SC-007). It covers `externalDestinationsRestricted` with and without
  `externalDestinationsDisabled`.
- [ ] T026 [P] Write `tests/unit/features/aliases/capabilities.spec.ts` and
  `tests/unit/features/aliases/CapabilitiesGate.spec.ts`:
  - the key `['capabilities','aliases']` with `staleTime` 5 minutes and no focus refetch;
  - `defaultPageSize` and `maxPageSize` checked against the contract examples (25, 1000), so that
    research R5's page-size decision stays valid;
  - the gate renders a skeleton while loading, an error state with retry on failure (FR-071), and
    its slot with the capabilities.
- [ ] T027 Implement `src/features/aliases/permissions.ts`, `src/features/aliases/capabilities.ts`,
  `src/features/aliases/components/CapabilitiesGate.vue` and `src/features/aliases/index.ts`, which
  exports them for the other areas. T025 and T026 must pass.
- [ ] T028 [P] Extend `tests/unit/app/navigation/visibility.spec.ts`. UI 001's `aliases` row is
  replaced by `aliases` (`/aliases`), `aliasDomains` (`/alias-domains`) and `resources`
  (`/resources`), each with:
  - admin ✓, domainAdmin ✓, mailboxUser —;
  - deliveredBy `004`;
  - the classic links `/admin/mailbox` and `/domainadmin/mailbox`;
  - `placeholder` status.

  They sit consecutively where `aliases` was, after `mailboxTemplates`. No entry leads to "not
  found".
- [ ] T029 Update `src/app/navigation/catalogue.ts` (rows and the `NavigationEntry` id union) and its
  icons in `src/shared/icons/` so that T028 passes. The labels are the legacy keys
  `mailbox.aliases`, `mailbox.domain_aliases` and `mailbox.resources`, verbatim in every language
  (constitution IV 1.3.0).

  Remove the former app-layer `nav.aliases` values. Run `npm run i18n:check`.

**Checkpoint**: The dependencies are verified, the mock serves all 23 operations, and the shared
blocks, capabilities, permissions and catalogue rows are in place. The stories can start.

---

## Phase 3: User Story 1 - Find and inspect aliases (Priority: P1) 🎯 MVP

**Goal**: The server-paged alias list (cards and table) with search, filters, sorting and paging in
the address, and the read-only alias detail, scoped by role.

**Independent Test**: Against `aliases-60` and `aliases-da-two-of-ten`, open the list and the detail
as an administrator and as a domain administrator. Use every search, filter and sort option, and
compare the values with the mock data.

### Tests for User Story 1 (write first; must fail)

- [ ] T030 [US1] Create `tests/mocks/scenarios/aliases-list.ts` and register it in
  `tests/mocks/scenarios/index.ts`, with these scenarios:
  - `aliases-60`: 60 aliases of every kind:
    - regular and catch-all;
    - each special action;
    - in alias domains, with `example.net` as an alias domain of `example.org`;
    - inactive, internal, hidden from the groupware and receive-only;
    - orphaned;
    - one with 12 destinations;
    - "invoice" in an address, a destination and a comment;
    - three delivering to `anna@example.org`;
  - `aliases-empty`;
  - `aliases-da-two-of-ten`;
  - `aliases-long-values`: 254-character addresses, internationalised domains, 200 destinations;
  - `aliases-5000-domains`, for the domain picker.
- [ ] T031 [P] [US1] Write `tests/e2e/aliases/list.spec.ts`. It covers:
  - US1-AS1: 25 newest as cards at 360 px, the total of 60, and the next page;
  - US1-AS2, US1-AS3 and US1-AS4, list parts: the alias-domain alias states its primary domain,
    "Learn as spam" replaces destinations, and the first two destinations plus "+10 more" are shown;
  - US1-AS5: "INVOICE" finds exactly those aliases, the count is announced, and the search survives
    opening an alias and going back;
  - US1-AS6: delivers-to filter with a removable chip;
  - US1-AS7: "nothing matches" with "Clear search and filters", and "nothing exists yet" on
    `aliases-empty`;
  - US1-AS8: `route.abort()` gives the error state with retry;
  - FR-005: page sizes 25, 50 and 100;
  - FR-006: reload, Back and a shared address restore the view;
  - FR-007: a table from 768 px with `aria-sort` headers;
  - FR-009: refresh;
  - FR-010: the search runs on submit and after about 500 ms; "Clear all";
  - FR-011: the domain picker on `aliases-5000-domains` sends `q` and paging and never loads the
    whole list;
  - FR-012: every badge as text, orphaned only for administrators, and the wide columns ID,
    comments and modification time;
  - FR-013: every filter maps to its request parameter (`mockApi.requests()`);
  - FR-014: every sort key;
  - FR-017: the hint;
  - US2-AS11, list part: on `groupware-disabled` there is no groupware badge, column, filter or sort
    key;
  - Edge, capabilities cannot be read: on `capabilities-unavailable` the list works, without the
    groupware elements;
  - Edge, long values and SC-004: no horizontal scroll at 360 and 320 px on `aliases-long-values`;
  - Edge, internationalised names: the readable form with the ASCII form below;
  - Edge, letter case: local parts are shown as stored.
- [ ] T032 [P] [US1] Write `tests/e2e/aliases/detail-and-access.spec.ts`. It covers:
  - FR-016: every detail value, with domain and primary domain linked to `domain-detail`;
  - US1-AS2, US1-AS3 and US1-AS4, detail parts: the primary domain stated, the special action, all
    12 destinations;
  - US1-AS9: the domain administrator sees only their scope, and a third domain's alias address
    shows `NotFoundState` with a link back (FR-003);
  - US1-AS10: a mailbox user has no Aliases, Alias domains or Resources entry, and
    `/ng/aliases`, `/ng/alias-domains` and `/ng/resources` show "no access" with no feature 004
    request in `mockApi.requests()`;
  - FR-001: the three navigation entries for administrators and domain administrators;
  - US3-AS7, detail part: an orphaned alias shows the warning to administrators, with no domain link;
  - FR-008: loading and error states of the detail;
  - FR-069: with a cs-cz profile, the creation and modification times and the counts are formatted
    in the user's locale.
- [ ] T033 [P] [US1] Write these unit tests:
  - `tests/unit/features/aliases/list-state.spec.ts`: data-model §5. Defaults are omitted. The
    repeatable parameters work. `groupwareVisible` is ignored while the groupware is disabled or
    unknown. "Newest first" is `id desc`.
  - `tests/unit/features/aliases/AliasCard.spec.ts` and `AliasBadges.spec.ts`: the badges as text
    (FR-063), catch-all, the special action text, the primary domain statement, orphaned for
    administrators only, and a menu trigger of at least 44 × 44 px (FR-015).
  - `tests/unit/features/aliases/AliasTable.spec.ts`: the columns, and `aria-sort` only on the
    contract's sort keys.
  - `tests/unit/features/aliases/AliasFilters.spec.ts`:
    - chips and "Clear all";
    - `DomainPicker` with domain and alias-domain sources for "Domain", and domains for "Primary
      domain";
    - the delivers-to field with `type="email"`;
    - the groupware filter hidden while the groupware is disabled.
  - `tests/unit/features/aliases/DestinationSummary.spec.ts`: two plus "+N more", and special
    actions.
- [ ] T034 [P] [US1] Write `tests/smoke/aliases-list.smoke.spec.ts` (`@feature-004`):
  - `admin` opens Aliases and filters by a domain found through the picker;
  - `reseller` sees only its domains in the picker and the list;
  - one case at 360 × 780 with no horizontal scroll.

### Implementation for User Story 1

- [ ] T035 [US1] Implement:
  - `src/features/aliases/api.ts`:
    - `useAliasList(params)` and `useAlias(id)`, with `placeholderData` from a cached list entry;
    - the alias-domain source for the "Domain" filter, through `keys.aliasDomains.options(q)`;
  - `src/features/aliases/list-state.ts`;
  - `src/features/aliases/routes.ts`: `aliases`, and `alias-detail` at `/aliases/:aliasId(\\d+)`;
  - the routes exported from `src/features/aliases/index.ts`.

  Register them in `src/app/router/routes.ts`, and set the catalogue's `aliases` entry to
  `available` in `src/app/navigation/catalogue.ts`.
- [ ] T036 [P] [US1] Implement `src/features/aliases/components/AliasBadges.vue`,
  `DestinationSummary.vue`, `AliasCard.vue`, `AliasTable.vue` (on `src/shared/ui/table`),
  `AliasList.vue` (cards below `md`, table from `md`) and `AliasDomainHint.vue` (FR-017), with
  addresses through `DomainNameText`.
- [ ] T037 [P] [US1] Implement `src/features/aliases/components/AliasFilters.vue`:
  - `SearchField`;
  - the two `DomainPicker`s;
  - native selects for kind, destination type, active, sending allowed, groupware (only when
    enabled) and internal;
  - the delivers-to field;
  - a native sort select with order for cards;
  - `ActiveFilterChips`.
- [ ] T038 [US1] Implement `src/features/aliases/pages/AliasesPage.vue`:
  - `PageHeader`;
  - the hint;
  - `ListState`, which tells "nothing exists yet" from "nothing matches";
  - `PaginationBar`;
  - refresh;
  - the result count announcement.

  Groupware elements wait for the capabilities, without blocking the list (research R5).
- [ ] T039 [US1] Implement `src/features/aliases/pages/AliasDetailPage.vue` with read-only sections:
  - identifier, both address forms and kind;
  - domain and primary domain, linked to `domain-detail` only when `isEntryAvailable('domains')`
    holds and the alias is not orphaned;
  - destinations or the special action;
  - the options with their explanations;
  - comments and times through `DateTime`;
  - `NotFoundState` on 404.

  Also implement `src/features/aliases/components/OrphanedAliasWarning.vue`.
- [ ] T040 [US1] (FR-067) Use the legacy keys of T005a's form map for the alias list and detail
  verbatim (texts with markup through `SanitizedHtml.vue`, the FR-017 hint
  `mailbox.alias_domain_alias_hint` unless the owner decides otherwise). Add to
  `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` only the form map's new strings among
  `aliases.title`, `aliases.list.*`, `aliases.filters.*`, `aliases.sort.*`, `aliases.badges.*` and
  `aliases.detail.*`, never machine-translated. Run `npm run i18n:check`.

**Checkpoint**: US1 works on its own. This is the MVP: aliases can be found and inspected on any
device.

---

## Phase 4: User Story 2 - Create aliases (Priority: P1)

**Goal**: The full-screen alias creation form with several addresses, the single-choice
destination, the options and comments, one request per address and per-address results.

**Independent Test**: Create aliases with each destination kind, with one and several addresses, as
an administrator and as domain administrators with and without `aliasExternalGoto`, with mocked
refusals of every documented type. Check the requests and where the messages appear.

**Depends on**: US1 (the Add controls on `AliasesPage.vue` and the alias detail as the landing
page).

### Tests for User Story 2 (write first; must fail)

- [ ] T041 [US2] Create `tests/mocks/scenarios/aliases-create.ts` and register it, with these
  scenarios:
  - `aliases-create`: holders of each kind, among them `sales@example.org` held by an alias;
  - `aliases-create-limit`: `example.org` at its alias limit;
  - `aliases-create-da-no-external`;
  - `aliases-create-network`: a network failure on the n-th `createAlias`.
- [ ] T042 [P] [US2] Write `tests/e2e/aliases/create.spec.ts`. It covers:
  - US2-AS1 to US2-AS11;
  - FR-018: the four sections, and the defaults sent (active, sending allowed and internal; the
    groupware option only when enabled);
  - FR-019: the client checks at their fields;
  - FR-020: the notice for a domain administrator without the flag and on
    `external-destinations-disabled` for administrators;
  - FR-021, with `mockApi.requests()` showing one `createAlias` per address, in order:
    - one address opens the detail;
    - several addresses show the per-address results, with refused ones kept in the field;
  - FR-023: each refusal at its field, with the summary for field-less errors;
  - FR-024: the submit is disabled and the pending state announced;
  - FR-025: the unsaved-input guard;
  - FR-064: a full-screen form at 360 px;
  - FR-065: input attributes;
  - FR-004 and Edge, permission flags changed: an `attribute-not-permitted` answer refreshes the
    identity, and the notice appears;
  - Edge, separators;
  - Edge, catch-all in a single-label domain: `@localdomain` is sent as entered;
  - Edge, double submission;
  - Edge, network failure during save: the input is kept and a retry offered;
  - Edge, network failure during a multi-address creation: results so far, the rest not processed
    and kept;
  - Edge, unknown error type: a `409` with an unknown `type` shows the generic message with the
    request ID;
  - Edge, session expires while the form is open: `mockApi.patch({ expireSession: true })`, sign in
    again in the same tab, and the input is restored;
  - Edge, capabilities cannot be read: the form shows the error state with retry.
- [ ] T043 [P] [US2] Write these unit tests:
  - `tests/unit/features/aliases/alias-form.spec.ts`: `toCreateRequest` (data-model §2), and
    `classifyAliasRefusal` against research R9's table.
  - `tests/unit/features/aliases/DestinationField.spec.ts`:
    - a Reka radio group;
    - the list disabled, not sent for special actions, and restored when switching back;
    - the notice conditions.
  - `tests/unit/features/aliases/AddressEntriesField.spec.ts`: catch-all marking, and the product
    name from the branding in the hint.
  - `tests/unit/features/aliases/AliasCommentsFields.spec.ts`: a byte counter against
    `commentMaxBytes` with multi-byte text.
  - `tests/unit/features/aliases/AliasCreateResults.spec.ts`: created with links, refused with the
    reason, not processed, announced, and focus moved to the summary.
- [ ] T044 [P] [US2] Write `tests/smoke/aliases-create.smoke.spec.ts` (`@feature-004`), as `admin`:
  - create `smoke-<timestamp>@<domain>` with two destinations;
  - create three addresses, one of them a duplicate of the first, and see one refused;
  - remove the created aliases through the UI.

### Implementation for User Story 2

- [ ] T045 [US2] Implement in `src/features/aliases/alias-form.ts` the form model, `toCreateRequest`
  and `classifyAliasRefusal` (data-model §2, research R8, R9). Add `useCreateAlias` to
  `src/features/aliases/api.ts`, with the invalidation of data-model §3.
- [ ] T046 [P] [US2] Implement these components in `src/features/aliases/components/`:
  - `AddressEntriesField.vue` (`EntryListField`);
  - `DestinationField.vue` (Reka `RadioGroup` plus `EntryListField`, with the FR-020 notice);
  - `AliasOptionsFields.vue` (switches with the legacy explanations; groupware only when enabled);
  - `AliasCommentsFields.vue` (byte counters through `utf8ByteLength`).
- [ ] T047 [P] [US2] Implement `src/features/aliases/components/AliasCreateResults.vue`.
- [ ] T048 [US2] Implement `src/features/aliases/pages/AliasCreatePage.vue`:
  - `CapabilitiesGate`;
  - the four sections;
  - `useProblemForm` with the form key `aliases.form`;
  - `useSequentialCreate`;
  - one created entry navigates to `alias-detail`, several show the results, and created entries are
    removed from the field;
  - the leave guard;
  - `useFormDraft('alias-create')`.

  Add the route `alias-create` (`/aliases/new`) to `src/features/aliases/routes.ts`. Add the "Add
  alias" control to the header and the "nothing exists yet" state of `AliasesPage.vue`, only when
  permitted.
- [ ] T049 [US2] Use the legacy keys of T005a's form map for the alias form verbatim: the labels and
  `*_info` texts of `#addAliasModal`, `add.alias_address_info` as the installation has it, and the
  messages, with problem types and rule codes mapped to the legacy `danger.*` keys
  (`success.alias_added` with the address and the ID; `acl.alias_external_goto` and
  `danger.external_goto_denied` fall back to `en-gb` where a language lacks them). Add only the
  form map's new strings among `aliases.create.*`, `aliases.form.*` and `aliases.form.errors.*` to
  the three locales. Run `npm run i18n:check`.

**Checkpoint**: US1 and US2 work.

---

## Phase 5: User Story 3 - Change or delete an alias (Priority: P1)

**Goal**: Section editing on the alias detail, with only changed values and the version tag, the
conflict flow, deletion with its consequences, and orphaned aliases.

**Independent Test**: Edit each attribute and check that the request carries only the changed values
and `If-Match`. Mock an outdated version, a deleted alias and a permission refusal on save. Delete
with and without confirming.

**Depends on**: US1 (the detail page). It reuses US2's form fields.

### Tests for User Story 3 (write first; must fail)

- [ ] T050 [US3] Create `tests/mocks/scenarios/aliases-edit.ts` and register it, with these cases:
  - `sales@example.org` delivering to Anna;
  - an alias with an external destination that an administrator set, opened by
    `domain-admin-004`;
  - an orphaned alias;
  - an alias with a 300-byte stored comment;
  - an alias whose destinations include a resource address stored by another tool;
  - a catch-all alias.

  Changes and deletions behind the app's back use `PATCH /__mock/scenarios/:id`
  (`changeElsewhere`, `deleteElsewhere`).
- [ ] T051 [P] [US3] Write `tests/e2e/aliases/edit.spec.ts`. It covers:
  - US3-AS1;
  - US3-AS2, SC-006 and FR-027: "changed elsewhere" marks the new value, the input stays, "Save
    again" sends the new `If-Match`, and "Discard my changes" reloads. Nothing is overwritten;
  - US3-AS3: deactivating asks one confirmation naming the effect, and the patch then holds only
    `active` (research R10);
  - US3-AS4: a special action is sent without destinations;
  - US3-AS6 and FR-028: no longer exists, back to the list;
  - US3-AS7: an orphaned alias accepts only an existing domain, with the message at the address;
  - FR-022 and FR-026: only changed members, with `If-Match` carrying the version read
    (`mockApi.requests()`);
  - FR-025: the leave guard;
  - FR-064: sections open full screen at 360 px through `?edit=`, and Back closes them;
  - Edge, long stored comment: editing the options saves;
  - Edge, destinations stored by another tool: not re-sent unless edited, and each entry the server
    names is marked once edited;
  - Edge, groupware disabled: the option is never sent;
  - Edge, domain administrator loses the domain: a 404 on save, the message, back to the list;
  - Edge, network failure during save.
- [ ] T052 [P] [US3] Write `tests/e2e/aliases/delete.spec.ts`. It covers:
  - US3-AS5: the confirmation names the address and the consequences; focus starts on Cancel; Cancel
    returns focus to Delete; confirming removes the alias from the list;
  - FR-029: the catch-all sentence;
  - FR-030;
  - FR-015: delete from the card menu (44 × 44 trigger) and the table row;
  - a deletion refused as outdated confirms again with the reloaded alias (FR-027);
  - an alias deleted elsewhere;
  - US3-AS7: deleting an orphaned alias.
- [ ] T053 [P] [US3] Write these unit tests:
  - `tests/unit/features/aliases/alias-patch.spec.ts` (`buildAliasPatch`, data-model §2):
    - only differing members, and never read-only members;
    - destinations only when the choice or the list changed;
    - comments only when changed;
    - `null` when nothing changed.
  - `tests/unit/features/aliases/AliasSections.spec.ts`:
    - each section on `EditableSection`, editable per permission;
    - marks after a 412;
    - the groupware option absent while disabled;
    - the external notice in the destination section.
- [ ] T054 [P] [US3] Write `tests/smoke/aliases-edit.smoke.spec.ts` (`@feature-004`): create an
  alias, change its destination, then delete it after confirming.

### Implementation for User Story 3

- [ ] T055 [US3] Add `buildAliasPatch` to `src/features/aliases/alias-form.ts`. Add `useUpdateAlias`
  and `useDeleteAlias` to `src/features/aliases/api.ts`, through `useVersionedSave`, with the 412
  and 404 handling and the invalidation of data-model §3.
- [ ] T056 [P] [US3] Implement `src/features/aliases/components/AliasAddressSection.vue`,
  `AliasDestinationSection.vue`, `AliasOptionsSection.vue` and `AliasCommentsSection.vue` on
  `EditableSection`, reusing US2's field components. Comments are checked only when changed.
- [ ] T057 [US3] Integrate them into `src/features/aliases/pages/AliasDetailPage.vue`:
  - the `edit` query parameter;
  - `useFormDraft` per section;
  - Delete through `useConfirm` with the consequences of research R11;
  - the vanished handling;
  - Delete in the orphaned warning;
  - the deactivation confirmation when the Options section saves `active: false`.

  Add "Edit" and "Delete" to the menus of `AliasCard.vue` and `AliasTable.vue` (FR-015). "Edit"
  opens the detail with `edit=destination`.
- [ ] T058 [US3] Use `success.alias_modified`, `success.alias_removed` and the other legacy keys of
  T005a's form map verbatim. Add only the form map's new strings among `aliases.edit.*`,
  `aliases.delete.*` and `aliases.orphaned.*` to the three locales. Run `npm run i18n:check`.

**Checkpoint**: All P1 stories (US1 to US3) work.

---

## Phase 6: User Story 4 - Manage alias domains (Priority: P2)

**Goal**: The alias domain list and detail, creation with the DKIM switch, the initial rate limit and
the creation report, target and active changes, and deletion.

**Independent Test**: List, create, change and delete alias domains as an administrator and as
domain administrators with and without `aliasDomains` and `ratelimit`. Use mocked reports with
failed steps and every documented refusal.

**Depends on**: Foundational. The alias count link points at US1's list.

### Tests for User Story 4 (write first; must fail)

- [ ] T059 [US4] Create `tests/mocks/scenarios/alias-domains.ts` and register it, with these
  scenarios:
  - `alias-domains`: the domain administrator with `aliasDomains` manages `example.org`;
    `example.net` is an alias domain with 7 aliases;
  - an alias domain whose target became a relay domain;
  - `alias-domains-dkim-failed`;
  - `alias-domains-feldhost`: `dkimDefaults` selector `feldhost` with 2048 bits;
  - `alias-domains-da-no-flags`;
  - a target at its alias limit;
  - an existing domain and an existing alias domain name;
  - the server host name;
  - `alias-domains-store-down`: `sharedStoreDown`.
- [ ] T060 [P] [US4] Write `tests/e2e/alias-domains/list-detail.spec.ts`. It covers:
  - FR-033: name forms, target link, active state, alias count linking to `/aliases?domain=<name>`;
  - US4-AS9: the relay warning as text;
  - FR-034: the search, the target and active filters, every sort key, all in the address;
  - FR-035: the rate limit or "None", read-only with the note;
  - US4-AS3 and FR-041: no add control and the permission note;
  - FR-015: each card and row offers open, "Edit" (detail with `edit=general`) and "Delete", with a
    menu trigger of at least 44 × 44 px on cards;
  - FR-008: the states;
  - FR-003: not found;
  - the domain administrator's scope;
  - Edge, temporary failure: `alias-domains-store-down` gives the error state with "try again
    shortly";
  - Edge, alias domain whose target became a relay domain: still editable.
- [ ] T061 [P] [US4] Write `tests/e2e/alias-domains/create.spec.ts`. It covers:
  - US4-AS1: the report lists four steps;
  - US4-AS2: a failed DKIM step is a warning, while the alias domain shows as created;
  - US4-AS4: no rate limit fields without `ratelimit`;
  - US4-AS5: an existing name at the name field, by `existingKind`;
  - US4-AS6: relay targets disabled with the reason;
  - US4-AS10: `feldhost` and 2048 pre-filled; switching off sends `dkimSelector: ""`, and the report
    says "no DKIM key requested";
  - FR-036: the request members (`mockApi.requests()`);
  - FR-037: several names with per-name results;
  - FR-038;
  - FR-040: `reserved`, `conflictsWith` and `notEligible {kind: relayDomain}` at their fields;
  - FR-004: `permission-flag-required` after the flag was removed mid-session refreshes the
    identity, and the add control disappears;
  - `/ng/alias-domains/-/new` without `aliasDomains` shows "no access" with the note;
  - Edge, temporary failure;
  - Edge, capabilities cannot be read;
  - FR-025: the leave guard.
- [ ] T062 [P] [US4] Write `tests/e2e/alias-domains/edit-delete.spec.ts`. It covers:
  - US4-AS7: a target change hitting the limit shows count and limit, and nothing changes;
  - FR-039: target and active editable, the name read-only. Deactivating asks one confirmation
    (research R10);
  - the outdated flow (FR-027);
  - US4-AS8: the deletion confirmation states the 7 aliases, their send-as permissions, temporary
    aliases, BCC maps, spam lists, and that the DKIM key is kept;
  - a deletion refused as outdated confirms again;
  - `503` on delete;
  - vanished.
- [ ] T063 [P] [US4] Write these unit tests:
  - `tests/unit/features/alias-domains/list-state.spec.ts`;
  - `alias-domain-form.spec.ts`: `toCreateRequest` and `buildAliasDomainPatch` (data-model §2),
    the DKIM switch, an omitted rate limit, and the classifier of research R9 for names;
  - `creation-report.spec.ts`: the lines and kinds of data-model §2, and `repeatAt` linked only when
    available;
  - `AliasDomainCard.spec.ts`;
  - `TargetDomainField.spec.ts`: relay domains disabled with the reason.
- [ ] T064 [P] [US4] Write `tests/smoke/alias-domains.smoke.spec.ts` (`@feature-004`), as `admin`:
  - create `smoke-<timestamp>.example` for a seeded domain with DKIM off, and read the report;
  - deactivate it;
  - delete it.

  `reseller` sees the add control exactly when its identity grants `aliasDomains`.

### Implementation for User Story 4

- [ ] T065 [US4] Implement:
  - `src/features/alias-domains/api.ts`: list, detail, create (the report stripped before caching),
    update and delete, with data-model §3;
  - `list-state.ts`, `alias-domain-form.ts` and `creation-report.ts`;
  - `routes.ts`: `alias-domains`, `alias-domain-create` (`/alias-domains/-/new`) and
    `alias-domain-detail`, with the canonical ASCII replace;
  - `index.ts`.

  Register them in `src/app/router/routes.ts`, and set the catalogue's `aliasDomains` entry to
  `available`.
- [ ] T066 [P] [US4] Implement `src/features/alias-domains/components/AliasDomainCard.vue` and
  `AliasDomainTable.vue`, each with the open, "Edit" (`edit=general`) and "Delete" actions (FR-015).
  Also implement `AliasDomainList.vue`, `AliasDomainFilters.vue` (search, target `DomainPicker`,
  active, sort) and `RelayWarning.vue`.
- [ ] T067 [P] [US4] Implement `src/features/alias-domains/components/TargetDomainField.vue`
  (`DomainPicker` with `disabledReason` for `backupMx`), `AliasDomainCreateResults.vue` (per name,
  with each created name's `CreationReport` collapsed) and `AliasDomainGeneralSection.vue`
  (`EditableSection`, with the deactivation confirmation).
- [ ] T068 [US4] Implement the pages in `src/features/alias-domains/pages/`:
  - `AliasDomainsPage.vue`: the add control or the permission note, and the states;
  - `AliasDomainCreatePage.vue`:
    - `CapabilitiesGate`;
    - `NoAccessState` without `canAddAliasDomain`;
    - names, target and active;
    - `DkimFields` pre-filled from `dkimDefaults`;
    - `RateLimitField` only with `canSetInitialRateLimit`;
    - `useSequentialCreate`;
    - the report, with the step warnings linking to UI 006 or UI 010 only when available;
    - the leave guard and `useFormDraft`;
  - `AliasDomainDetailPage.vue`:
    - the general section;
    - the read-only rate limit with the note;
    - the alias count link;
    - Delete with the impact of research R11;
    - `NotFoundState`.
- [ ] T069 [US4] Use the legacy keys of T005a's form map for alias domains verbatim:
  - `mailbox.add_domain_alias` (its English text "Add domain alias" as legacy has it);
  - `edit.edit_alias_domain`;
  - `mailbox.alias_domain_backupmx`;
  - `acl.alias_domains`;
  - `success.aliasd_added`, `success.aliasd_modified` and `success.alias_domain_removed`;
  - `danger.aliasd_targetd_identical`, `danger.alias_domain_invalid` and
    `danger.target_domain_invalid`;
  - the same legacy keys as UI 002 for the rate limit frames and DKIM labels.

  Add to the three locales only the form map's new `aliasDomains.*` strings (for example the report
  lines `aliasDomains.report.<step>.<outcome>`, which legacy lacks). Run `npm run i18n:check`.

**Checkpoint**: US4 works on its own, next to US1–US3.

---

## Phase 7: User Story 5 - Decide what a mailbox may send as (Priority: P2)

**Goal**: The "Send as" screen under UI 003's mailbox detail. It explains every sender address and
edits the explicit permissions, "any address" and the external sender addresses in one save.

**Independent Test**: Open the screen for mailboxes with each kind of implicit and explicit sender
address, as an administrator and as domain administrators with and without `extendSenderAcl`. Grant
and revoke entries, and mock stale and locked entries, an outdated version and per-entry refusals.

**Depends on**: Foundational and UI 003 (the mailbox detail layout, `sections.ts`). The alias links
point at US1's detail.

### Tests for User Story 5 (write first; must fail)

- [ ] T070 [US5] Create `tests/mocks/scenarios/sender-settings.ts` and register it, with these
  scenarios:
  - `sender-settings`: Anna receives `sales@` (sending allowed) and `info@` (not allowed), has
    `@example.com` explicitly and has alias-domain addresses;
  - `@other.example`, set by an administrator outside the domain administrator's scope;
  - a stale entry;
  - 5,000 candidates;
  - external sender addresses, one of them in a local domain;
  - `senderCheckDisabled` set by an administrator;
  - `sender-settings-da` and `sender-settings-da-extend`;
  - an alias that, after the candidate list loaded, delivers to Anna and allows sending (FR-055,
    through `changeElsewhere`).
- [ ] T071 [P] [US5] Write `tests/e2e/sender-settings/send-as.spec.ts`. It covers:
  - FR-048: "Send as" in the mailbox section navigation for administrators and domain
    administrators; it opens `/ng/mailboxes/<address>/send-as` and keeps UI 003's side navigation
    from `lg` up;
  - US5-AS1 and FR-049: the sections always allowed, receive-only, explicit, sender check and
    external, with catch-all marks and alias links;
  - US5-AS4: a non-changeable entry with its reason and no remove control;
  - US5-AS5: the domain administrator's picker requests `type=address&type=domain` and never offers
    "any address";
  - US5-AS6: external addresses read-only with the permission note;
  - US5-AS8: "no longer exists", removable by administrators;
  - US5-AS9 and FR-050: on 5,000 candidates, a search for "sales" with load more and the labels of
    plan API gap G1, then removing a changeable entry;
  - FR-052 and FR-053: the legacy hints verbatim, with their markup rendered;
  - Edge, "any address" seen by a domain administrator: "Sender check is disabled", read-only, with
    no add control;
  - Edge, stale sender permission;
  - FR-003: a foreign mailbox address shows `NotFoundState`;
  - mailbox users get "no access";
  - FR-008: the states.
- [ ] T072 [P] [US5] Write `tests/e2e/sender-settings/send-as-save.spec.ts`. It covers:
  - US5-AS2: "Allow sending as this alias", then save, puts `info@` among the explicit permissions;
  - US5-AS3 and FR-051: turning the switch on opens the confirmation with the warning, and
    cancelling leaves it off. After confirming and saving, `['*']` is sent and the screen shows
    "Sender check is disabled";
  - US5-AS7: a local-domain external entry is marked, nothing is saved, and every entry stays;
  - US5-AS10 and FR-055: the "not needed" notice;
  - FR-054: only changed sets are sent, as whole sets with `If-Match`, and the domain
    administrator's patch keeps non-changeable entries (`mockApi.requests()`);
  - FR-027: the outdated flow keeps the working copy;
  - FR-004: `attribute-not-permitted` after the flag was removed refreshes the identity, and the
    section turns read-only;
  - FR-025: the leave guard;
  - Edge, session expires while the form is open: the draft is restored;
  - Edge, network failure during save.
- [ ] T073 [P] [US5] Write these unit tests:
  - `tests/unit/features/sender-settings/send-as-model.spec.ts`: `toView`, `buildSenderPatch`,
    `entryForPath` and `notNeededAfterSave` (data-model §2).
  - `PermissionCandidatePicker.spec.ts`:
    - a 300 ms debounce and `useInfiniteQuery`;
    - type labels by contract `type`;
    - working-copy entries excluded;
    - no `anyAddress`;
    - loading, "no match" and error-with-retry states.
  - `ExternalSenderAddressesSection.spec.ts`: read-only without the flag, and not sent unless
    changed.
  - `AnyAddressSwitch.spec.ts`: administrators only, the confirmation with the warning before the
    switch turns on, and the explicit list disabled while on.
  - `ReceiveOnlySection.spec.ts`: the action, and the "allowed by an explicit permission" state.
- [ ] T074 [P] [US5] Write `tests/smoke/sender-settings.smoke.spec.ts` (`@feature-004`), as `admin`:
  - open "Send as" of `alice@example.org`;
  - grant an address candidate found through the picker (another seeded mailbox), save, and see it
    listed;
  - remove it and save.

### Implementation for User Story 5

- [ ] T075 [US5] Implement:
  - `src/features/sender-settings/api.ts`: get, save with `If-Match`, candidates through
    `useInfiniteQuery`, and data-model §3;
  - `send-as-model.ts`;
  - `routes.ts`: the child route record `mailbox-send-as` (`send-as`);
  - `index.ts`.

  List the record among the children of `mailbox-detail` in `src/features/mailboxes/routes.ts`. Add
  the `sendAs` entry, with its summary, to `src/features/mailboxes/sections.ts`. Extend
  `tests/unit/features/mailboxes/components/display/MailboxSectionNav.spec.ts` with the entry.
- [ ] T076 [P] [US5] Implement these components in `src/features/sender-settings/components/`:
  `AlwaysAllowedSection.vue`, `ReceiveOnlySection.vue`, `ExplicitPermissionsSection.vue`,
  `PermissionCandidatePicker.vue` (Reka `Combobox` without a viewport, with loading, "no match" and
  error states), `AnyAddressSwitch.vue` (confirmation through `useConfirm`),
  `SenderCheckStatus.vue`, `ExternalSenderAddressesSection.vue` (`EntryListField`) and
  `SendAsHints.vue`. Legacy texts with markup are rendered unchanged through `SanitizedHtml.vue`.
- [ ] T077 [US5] Implement `src/features/sender-settings/pages/SendAsPage.vue`:
  - the sections;
  - one sticky save bar;
  - `useProblemForm` with the form key `senderSettings`;
  - entry marks by index;
  - the FR-055 notices;
  - the leave guard and `useFormDraft`;
  - announcements;
  - `NotFoundState`.
- [ ] T078 [US5] Use the legacy keys of T005a's form map for "Send as" verbatim:
  - `edit.sender_acl`, `edit.dont_check_sender_acl`, `add.sender_allowed`,
    `edit.extended_sender_acl` and `acl.extend_sender_acl`;
  - `danger.extra_acl_invalid`, `danger.extra_acl_invalid_domain`, `danger.sender_acl_invalid` and
    `danger.extended_sender_acl_denied`;
  - with markup, through `SanitizedHtml.vue`: `edit.sender_acl_info`, `edit.sender_acl_disabled` and
    `edit.extended_sender_acl_info`.

  Add only the form map's new `senderSettings.*` strings to the three locales. Run
  `npm run i18n:check`.

**Checkpoint**: US5 works on its own, reached from the mailbox detail.

---

## Phase 8: User Story 6 - Apply an action to many objects at once (Priority: P2)

**Goal**: Selection mode and mass actions on the alias and alias domain lists, copying over alias
domains (single and bulk), per-object results and retention. Resource mass actions follow in US7
(T094, T100).

**Independent Test**: Apply each action to selections that mix successful objects with mocked "not
found", refused, outdated and failed results, on a phone and a desktop. Check the confirmation, the
per-object results and the selection afterwards.

**Depends on**: US1 (alias list and detail) and US4 (alias domain list).

### Tests for User Story 6 (write first; must fail)

- [ ] T079 [US6] Create `tests/mocks/scenarios/bulk-004.ts` and register it, with these scenarios:
  - `bulk-004`: 30 active aliases on one page; five aliases, two of them deleted after loading
    (`deleteElsewhere`); one changed after loading (`changeElsewhere`);
  - `sales@example.org` with the alias domains `example.net`, where `sales@example.net` exists, and
    `example.com`;
  - an alias in an alias domain;
  - `bulk-limit-50`: `bulkLimit` 50 and a page of 100;
  - a domain administrator without `aliasDomains` selecting alias domains;
  - temporary failures for two alias domain targets;
  - 100 aliases for SC-010.
- [ ] T080 [P] [US6] Write `tests/e2e/aliases/bulk.spec.ts`. It covers:
  - US6-AS1: select all, deactivate after the confirmation naming the action, its effect and 30;
    30 done, the list shows them inactive, and the summary is announced;
  - US6-AS2: hide, with three done, two not found, and the two still selected;
  - US6-AS5: "Select" at 360 px, 44 × 44 checkboxes, the bar staying visible, and leaving or paging
    clearing the selection with an announcement;
  - US6-AS6: `bulk-limit-50` selects the first 50 with the explanation, and the remaining checkboxes
    are disabled with the message stating the limit;
  - US6-AS8: an outdated item reported and kept, and "Refresh the list" keeps the selection with new
    versions;
  - FR-056: selection is cleared on page, size, search, filter and sort changes;
  - FR-057: show and hide are absent on `groupware-disabled`;
  - FR-058: activate and show without confirmation; delete lists every address and needs the typed
    count;
  - FR-059 and FR-026: the summary per outcome, and targets with `{ id, version }` from the list
    entries, without quotes (`mockApi.requests()`);
  - FR-060;
  - SC-010: 100 results rendered;
  - Edge, network failure during a mass action: "outcome unknown", the list refreshed, the selection
    kept, and no second request;
  - Edge, capabilities cannot be read: the bar shows the error state with retry.
- [ ] T081 [P] [US6] Write `tests/e2e/aliases/copy.spec.ts`. It covers:
  - US6-AS4: from the detail, the explanation, then `sales@example.com` created with a link and
    `example.net` skipped "address in use";
  - FR-031: no action for an alias in an alias domain or an orphaned alias;
  - FR-032: no alias domains, "nothing was created";
  - bulk copy: per-alias copies in the summary rows, and an alias in an alias domain `refused` with
    the translated reason (Edge, copying an alias that lives in an alias domain);
  - a single copy answered 412 reloads and explains again.
- [ ] T082 [P] [US6] Write `tests/e2e/alias-domains/bulk.spec.ts`. It covers:
  - US6-AS7: activate, deactivate and delete are offered without `aliasDomains`;
  - deactivate with its confirmation;
  - delete listing every name with the impact, and the typed count;
  - two targets `failed` with "try again shortly", kept selected.
- [ ] T083 [P] [US6] Write these unit tests:
  - `tests/unit/features/aliases/alias-bulk.spec.ts`: the actions per permission and groupware
    state, the confirmation kinds of research R16, `toTargets` stripping quotes, and the retention
    of every non-`done` item;
  - `tests/unit/features/aliases/CopyResults.spec.ts`: created with a link, skipped reasons, failed,
    and the empty list;
  - `tests/unit/features/alias-domains/alias-domain-bulk.spec.ts`.
- [ ] T084 [P] [US6] Write `tests/smoke/aliases-bulk.smoke.spec.ts` (`@feature-004`): create two
  aliases, bulk-deactivate them, bulk-activate them, then bulk-delete them with the typed count.

### Implementation for User Story 6

- [ ] T085 [US6] Implement `src/features/aliases/alias-bulk.ts` (data-model §2 `BulkActionConfig`).
  Add `useAliasBulkAction` and `useCopyAlias` (with `If-Match`) to `src/features/aliases/api.ts`,
  with the invalidation of data-model §3.
- [ ] T086 [P] [US6] Implement `src/features/aliases/components/CopyOverAliasDomainsDialog.vue` (the
  FR-031 explanation) and `CopyResults.vue`.
- [ ] T087 [US6] Add selection mode to `src/features/aliases/pages/AliasesPage.vue`,
  `components/AliasCard.vue` and `components/AliasTable.vue`:
  - `useBulkSelection` with `limit = bulkLimit`;
  - `BulkActionBar` inside `CapabilitiesGate`;
  - the confirmations through `useConfirm` and `requireTyped`;
  - `BulkResultSummary` with `CopyResults` in its `#item` slot, and the refresh action;
  - the connection-drop handling.

  Add "Copy over alias domains" to `src/features/aliases/pages/AliasDetailPage.vue`.
- [ ] T088 [US6] Implement `src/features/alias-domains/alias-domain-bulk.ts` and
  `useAliasDomainBulkAction` in `src/features/alias-domains/api.ts`. Add selection mode to
  `src/features/alias-domains/pages/AliasDomainsPage.vue`, `components/AliasDomainCard.vue` and
  `components/AliasDomainTable.vue`.
- [ ] T089 [US6] Use the legacy keys `mailbox.sogo_visible_y`, `mailbox.sogo_visible_n`,
  `mailbox.add_alias_expand`, `warning.is_not_primary_alias`, `mailbox.toggle_all`,
  `mailbox.activate`, `mailbox.deactivate` and `mailbox.remove` verbatim; each bulk result line uses
  the single action's legacy message. Add only the form map's new strings among `aliases.bulk.*`,
  `aliases.copy.*` and `aliasDomains.bulk.*` (summaries, copy report) to the three locales. Run
  `npm run i18n:check`.

**Checkpoint**: All P2 stories (US4 to US6) work, next to the P1 stories.

---

## Phase 9: User Story 7 - Manage resources (Priority: P3)

**Goal**: The resource list with the booking legend, creation with the address preview, section
editing, deletion and mass actions.

**Independent Test**: List, create, change and delete resources of each kind and booking rule, with
mocked refusals, and compare the values with the mock data.

**Depends on**: Foundational. The mass action tasks reuse the patterns of US6 (T085–T087) and the
shared D2–D5.

### Tests for User Story 7 (write first; must fail)

- [ ] T090 [US7] Create `tests/mocks/scenarios/resources.ts` and register it, with these cases:
  - resources of each kind and booking rule, among them `MeetingRoom1@example.org`;
  - the domain administrator's scope;
  - five resources for a bulk deletion;
  - a resource changed and one deleted elsewhere;
  - the `resourceDescriptionMaxLength` and `resourceBookingLimit` capabilities.
- [ ] T091 [P] [US7] Write `tests/e2e/resources/list-detail.spec.ts`. It covers:
  - FR-042: description, address, translated kind, domain, booking badge and active state;
  - US7-AS5: the badges "Always free", "Soft limit" and "Hard limit (2)" with the legend;
  - FR-043: search, filters and every sort key, in the address;
  - FR-015: each card and row offers open, "Edit" (detail with `edit=resource`) and "Delete";
  - FR-046: the detail, with the address and domain read-only;
  - FR-048: no "Send as" on a resource;
  - FR-003: not found;
  - FR-008: the states;
  - the domain administrator's scope.
- [ ] T092 [P] [US7] Write `tests/e2e/resources/create.spec.ts`. It covers:
  - US7-AS1: the preview `MeetingRoom1@example.org`, labelled as a preview, and the server's address
    after saving;
  - US7-AS2: `address-in-use` at the description;
  - US7-AS3: "!!!" gives no address and no submit;
  - US7-AS4: the hard limit number field accepts only whole numbers of 1 or more;
  - FR-044: the domain picker offers domains only; the description is checked against the
    capability;
  - FR-045;
  - FR-047: each refusal at its field;
  - Edge, resource description with letters outside A–Z: "Raum Süd" → `RaumSd@…`;
  - Edge, capabilities cannot be read;
  - FR-025: the leave guard.
- [ ] T093 [P] [US7] Write `tests/e2e/resources/edit-delete.spec.ts`. It covers:
  - US7-AS6: "the address stays the same";
  - deactivating asks one confirmation (research R10);
  - US7-AS7: the deletion confirmation names the groupware data;
  - FR-046: the patch holds only changed members, with `bookingLimit` only for `limited`;
  - the outdated flow, and a deletion refused as outdated;
  - vanished.
- [ ] T094 [P] [US7] Write `tests/e2e/resources/bulk.spec.ts`. It covers:
  - US6-AS3: five selected; the confirmation lists their names and the consequences, and nothing
    happens until "5" is typed;
  - activate and deactivate (FR-057, FR-058).
- [ ] T095 [P] [US7] Write these unit tests:
  - `tests/unit/features/resources/address-preview.spec.ts`: the documented rule, including case
    kept, `RaumSd`, "!!!", more than 64 characters, and the readable domain;
  - `booking.spec.ts`: the rule and limit mapping, badge text, and the range from the capabilities;
  - `resource-form.spec.ts`: `toCreateRequest` and `buildResourcePatch`;
  - `ResourceCard.spec.ts`;
  - `resource-bulk.spec.ts`.
- [ ] T096 [P] [US7] Write `tests/smoke/resources.smoke.spec.ts` (`@feature-004`), as `admin`:
  - create "Smoke Room <timestamp>" with the previewed address;
  - change its booking rule to a hard limit of 2;
  - delete it.

### Implementation for User Story 7

- [ ] T097 [US7] Implement:
  - `src/features/resources/api.ts`: list, detail, create, update, delete and bulk, with
    data-model §3;
  - `list-state.ts`, `address-preview.ts`, `booking.ts`, `resource-form.ts` and `resource-bulk.ts`;
  - `routes.ts`: `resources`, `resource-create` (`/resources/new`) and `resource-detail`
    (`/resources/:resourceAddress([^/]+@[^/]+)`);
  - `index.ts`.

  Register them in `src/app/router/routes.ts`, and set the catalogue's `resources` entry to
  `available`.
- [ ] T098 [P] [US7] Implement `src/features/resources/components/BookingRuleBadge.vue`,
  `BookingLegend.vue`, `ResourceCard.vue` and `ResourceTable.vue`, each with the open, "Edit"
  (`edit=resource`) and "Delete" actions (FR-015). Also implement `ResourceList.vue` and
  `ResourceFilters.vue`.
- [ ] T099 [P] [US7] Implement `src/features/resources/components/BookingRuleField.vue`,
  `AddressPreview.vue` (labelled, live, with the "no address" reason) and `ResourceSection.vue`
  (`EditableSection`, with the address note and the deactivation confirmation).
- [ ] T100 [US7] Implement the pages in `src/features/resources/pages/`:
  - `ResourcesPage.vue`: the legend, the states and selection mode with `BulkActionBar`,
    `BulkResultSummary` and the typed count;
  - `ResourceCreatePage.vue`: `CapabilitiesGate`, the preview blocking submit, the leave guard and
    `useFormDraft`;
  - `ResourceDetailPage.vue`: the section, Delete with the consequences, and `NotFoundState`.
- [ ] T101 [US7] Use the legacy keys of T005a's form map for resources verbatim:
  `mailbox.add_resource`, the booking texts, `add.kind`, `add.multiple_bookings`, `add.description`,
  `success.resource_added`, `success.resource_modified` (legacy's own text), `success.resource_removed`,
  `danger.resource_invalid` and `danger.description_invalid`. Add only the form map's new
  `resources.*` strings (the kind options, whose English equals legacy's hard-coded text, and the
  address preview) to the three locales. Run `npm run i18n:check`.

**Checkpoint**: US7 works on its own, and US6's resource scenario (US6-AS3) passes.

---

## Phase 10: User Story 8 - Trace changes to an object (Priority: P3)

**Goal**: "History" for administrators on the alias, alias domain, resource and "Send as" screens,
and translated 004 event and target labels on the audit log.

**Independent Test**: As an administrator, open "History" from each object screen and check that the
audit log is filtered by that object. As a domain administrator, check that the control is absent.

**Depends on**: US1, US4, US5 and US7 (the four screens).

### Tests for User Story 8 (write first; must fail)

- [ ] T102 [US8] Create `tests/mocks/scenarios/history-004.ts` and register it. It seeds audit
  records with the 10 feature 004 event types and the 4 target types, using contract values only, so
  that the validator accepts them (UI 001 R22).
- [ ] T103 [P] [US8] Write `tests/e2e/history/feature-004-history.spec.ts`. It covers:
  - US8-AS1 and FR-061: "History" on an alias, an alias domain, a resource and a "Send as" screen opens
    `/ng/audit-log` with `targetType` `alias`, `aliasDomain`, `resource` or `mailboxSenderSettings`
    and the matching `targetId` (`String(id)`, the ASCII name, the address, the mailbox address);
    the entries show translated labels, and the old and new values are visible as text;
  - each target links back to its object;
  - US8-AS2: no "History" for domain administrators.
- [ ] T104 [P] [US8] Write `tests/unit/features/audit-log/labels-004.spec.ts`. It covers:
  - the 10 event labels and the 4 target labels;
  - the target links by route name per type;
  - the generic label for a value outside the scope manifest;
  - the documented 004 detail keys: `changes` with old and new values, `creationReport` lines,
    `removed` counts, and `copiedFromAliasId` as a link, as `docs/audit-events.md` in mailcow-rest-v2
    defines them at the pinned commit;
  - unknown keys shown verbatim (research R19).

### Implementation for User Story 8

- [ ] T105 [US8] Add `HistoryLink`, shown only when `canSeeHistory` holds, to
  `src/features/aliases/pages/AliasDetailPage.vue`,
  `src/features/alias-domains/pages/AliasDomainDetailPage.vue`,
  `src/features/resources/pages/ResourceDetailPage.vue` and
  `src/features/sender-settings/pages/SendAsPage.vue` (research R19).
- [ ] T106 [US8] Extend `src/features/audit-log/labels.ts` with:
  - the 004 target links: `alias-detail`, `alias-domain-detail`, `resource-detail` and
    `mailbox-send-as`;
  - the presentation of the documented 004 detail keys (research R19).

  If `docs/audit-events.md` lacks the 004 section at the pinned commit, keep the generic rendering
  and report plan API gap G3 again. The event and target labels come from T005. Add the
  History-specific messages to the three locales, then run `npm run i18n:check`.

**Checkpoint**: All user stories work on their own.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story verification, budgets, parity, documentation and release readiness.

- [ ] T107 [P] Write and pass `tests/e2e/shell/feature-004-reflow.spec.ts`. Every screen, dialog,
  picker and selection mode of this feature, with the long values of `aliases-long-values` (SC-004):
  - has no horizontal scroll at 320 px or at the equivalent of 400 % zoom (320 CSS px on a 1280 px
    desktop) (FR-066);
  - works in landscape on the mobile projects;
  - never hides the focused element behind the sticky header or the bulk bar;
  - runs no transition under `prefers-reduced-motion: reduce`.
- [ ] T108 [P] Write and pass `tests/e2e/shell/feature-004-keyboard.spec.ts`: each story's main path
  with the keyboard alone, including the domain and candidate pickers, the radio groups, selection
  mode, the typed confirmation and section editing. Focus moves into dialogs, returns to the trigger
  and stays visible at every step (FR-062).
- [ ] T109 [P] Write and pass `tests/e2e/shell/feature-004-permissions-matrix.spec.ts` (SC-007). For
  `admin-004`, `domain-admin-004`, `domain-admin-004-all-flags` and each single-flag variant, every
  control of spec FR-002 is present exactly when permitted, on each screen.
- [ ] T110 [P] Extend `tests/e2e/shell/storage-and-secrets.spec.ts` with the US2, US3 and US5 flows,
  including a session expiry with a restored draft. `localStorage` and `sessionStorage` hold only
  UI 001's keys, and no form value appears in storage or `history.state`.
- [ ] T111 Add the `/ng/aliases` collection (`MOCK_DEFAULT_SCENARIO=aliases-60`, active admin) to
  `scripts/run-lhci.mjs` (research R22). Run `npm run build && npm run budget:check && npm run lhci`,
  and fix regressions until the initial JavaScript is at most 204,800 bytes gzipped and performance
  and accessibility are at least 0.9 on every collection.
- [ ] T112 Check parity coverage (SC-008): every Matched or Improved row of the spec's "Legacy
  parity" tables has at least one end-to-end test whose title carries one of the row's FR IDs. List
  the result per row in a "Validation log" section appended to
  `specs/004-aliases-alias-domains-resources/quickstart.md`, and add any missing test.
- [ ] T113 [P] Align `specs/004-aliases-alias-domains-resources/spec.md` with the plan:
  - add the plan's parity notes 1–4 to "Legacy parity";
  - check that "Translation reuse" matches T005a's legacy form map (constitution IV 1.3.0);
  - list API gaps G1–G4 under "API gaps";
  - note under FR-005 and FR-071 that the page sizes follow the conventions and the API-wide list
    defaults, so that lists work without the capabilities (research R5).
- [ ] T114 Run `quickstart.md` Part B on a mid-range Android phone and an iPhone, with the production
  build served by `npm run preview:mock` on the local network and "Fast 4G" throttling. Record in
  the Validation log of `specs/004-aliases-alias-domains-resources/quickstart.md`:
  - the timings for SC-001, SC-002, SC-009 and SC-010, and the SC-011 identification results;
  - a VoiceOver and a TalkBack pass over every story.
- [ ] T115 Run `quickstart.md` Part C (`scripts/smoke/stack-up.sh`, then
  `npm run test:smoke -- --grep @feature-004`, then `scripts/smoke/stack-down.sh`) against the
  mailcow-rest-v2 dev stack at the pinned commit.
- [ ] T116 [P] Run `npm run i18n:check`, remove the unused keys it reports from
  `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, check that no new string duplicates a legacy key of
  the form map, and list this feature's new cs-cz and sk-sk strings for the owner's review (plan,
  owner question 2).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Before Phase 1**: UI 001, UI 002 and UI 003 are implemented, and API 004 is implemented (research
  R1, R2).
- **Setup (Phase 1)**: T001 → T002 → T005. T003 → T004, in parallel with T001–T002.
- **Foundational (Phase 2)** depends on Setup and **blocks every user story**. Within it:
  - T005a first; every screen and message task depends on its legacy form map.
  - T006 first, then T007, T008 and T009 (T008 and T009 in parallel). T006 passes after them.
  - T010 → T011, and T012 → T013.
  - T014 → T015 → T016 → T017 → T018.
  - T019 → T020, T021 → T022, T023 → T024.
  - T025 and T026 → T027, and T028 → T029.

  The test tasks T010, T012, T014, T019, T021, T023, T025, T026 and T028 can all start together
  after T006.
- **User stories (Phases 3–10)** depend on Foundational, and on each other as the table below shows.
  End-to-end tests start from scenarios with an active session, never by signing in through the UI.
- **Polish (Phase 11)** depends on every story it verifies.

### User Story Dependencies

| Story | Priority | Depends on | Why |
|---|---|---|---|
| US1 | P1 | Foundational | MVP: alias list and detail |
| US2 | P1 | US1 | Adds the Add controls to `AliasesPage.vue` and lands on the alias detail |
| US3 | P1 | US1; reuses US2's fields | Adds sections to `AliasDetailPage.vue` |
| US4 | P2 | Foundational | Independent. The alias count link targets US1's list. |
| US5 | P2 | Foundational, UI 003 | Independent of the alias screens. Alias links target US1's detail. |
| US6 | P2 | US1, US4 | Selection mode on the alias and alias domain lists, copy on the alias detail |
| US7 | P3 | Foundational | Independent. Its mass actions mirror US6's pattern. |
| US8 | P3 | US1, US4, US5, US7 | Adds History to their screens |

### Files edited by several stories

Edits to these files must be serialised, even when stories run in parallel:

- `src/app/router/routes.ts` and `src/app/navigation/catalogue.ts`: US1, US4, US7;
- `src/features/aliases/api.ts`: US1, US2, US3, US6;
- `src/features/aliases/pages/AliasesPage.vue`, `components/AliasCard.vue` and
  `components/AliasTable.vue`: US1, US2, US3, US6;
- `src/features/aliases/pages/AliasDetailPage.vue`: US1, US3, US6, US8;
- `src/features/alias-domains/api.ts`, `pages/AliasDomainsPage.vue`, `components/AliasDomainCard.vue`
  and `components/AliasDomainTable.vue`: US4, US6;
- `src/features/alias-domains/pages/AliasDomainDetailPage.vue`: US4, US8;
- `src/features/resources/pages/ResourceDetailPage.vue`: US7, US8;
- `src/features/sender-settings/pages/SendAsPage.vue`: US5, US8;
- `tests/mocks/scenarios/index.ts`: one registration line per story;
- `src/i18n/messages/*.json`: every story.

The mock handlers are complete after Phase 2, so no story edits them.

### Within Each User Story

- First the scenarios, then the end-to-end, unit and smoke tests, which must fail. Then the
  implementation, in the order api and models → components → pages. Then the messages in all three
  locales.
- The message tasks of different stories edit the same locale files. Run them one after another.

### Parallel Opportunities

- Setup: T003 alongside T001–T002.
- Foundational: T008 and T009; all the test tasks listed above; T020, T022 and T024 once their tests
  exist.
- Stories: after Foundational, US1, US4, US5 and US7 can be staffed in parallel. US2 and US3 follow
  US1. US6 follows US1 and US4. US8 comes last.
- Within each story, every task marked [P] can run in parallel.

---

## Parallel Example: User Story 1

```bash
# After T030 (scenarios), write the US1 tests together:
Task: "T031 tests/e2e/aliases/list.spec.ts"
Task: "T032 tests/e2e/aliases/detail-and-access.spec.ts"
Task: "T033 tests/unit/features/aliases/{list-state,AliasCard,AliasBadges,AliasTable,AliasFilters,DestinationSummary}.spec.ts"
Task: "T034 tests/smoke/aliases-list.smoke.spec.ts"

# After T035 (api, list state, routes):
Task: "T036 src/features/aliases/components/{AliasBadges,DestinationSummary,AliasCard,AliasTable,AliasList,AliasDomainHint}.vue"
Task: "T037 src/features/aliases/components/AliasFilters.vue"
# Then T038 (AliasesPage.vue), T039 (AliasDetailPage.vue) and T040 (messages).
```

## Parallel Example: User Story 5

```bash
Task: "T071 tests/e2e/sender-settings/send-as.spec.ts"
Task: "T072 tests/e2e/sender-settings/send-as-save.spec.ts"
Task: "T073 tests/unit/features/sender-settings/*.spec.ts"
Task: "T074 tests/smoke/sender-settings.smoke.spec.ts"
# After T075:
Task: "T076 src/features/sender-settings/components/*.vue"
# Then T077 (SendAsPage.vue) and T078 (messages).
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (contract and tooling), then Phase 2 (dependencies, mock, shared blocks, catalogue).
2. Phase 3 (US1): aliases can be found and inspected on any device.
3. **Stop and validate**: run `npm run test:e2e -- --grep "US1-"` on both viewports, and the US1
   rows of quickstart Part B.
4. Alias domains and resources stay placeholders that link to the classic interface.

### Incremental Delivery

1. Foundation, then US1 (MVP).
2. US2 and US3: complete alias management, which replaces the classic Aliases tab.
3. US4 (alias domains) and US5 ("Send as"), in parallel.
4. US6: mass actions and copies.
5. US7 (resources), then US8 (History).
6. Polish: reflow, keyboard, permission matrix, storage, budgets, parity, spec alignment, device
   validation and the smoke run.

### Parallel Team Strategy

After Foundational:
- Developer A: US1, then US2, then US3.
- Developer B: US4, then US6 (after US1).
- Developer C: US5, then US7.
- Developer D: Polish preparation, then US8 once the screens exist.

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
  - a `v-html` outside `SanitizedHtml.vue`;
  - an inline style or script;
  - a storage key outside UI 001 data-model §4;
  - a hard-coded limit that the capabilities provide;
  - a lookup that guesses what the contract does not say (plan API gaps).
