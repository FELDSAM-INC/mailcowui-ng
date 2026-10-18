---
description: "Task list for UI feature 003: mailboxes and mailbox templates"
---

# Tasks: Mailboxes

**Input**: Design documents from `specs/003-mailboxes/`:
- [plan.md](./plan.md)
- [spec.md](./spec.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/README.md](./contracts/README.md)
- [quickstart.md](./quickstart.md)

**Prerequisites**:
- **UI 001 is implemented.** Its structure, tooling, mock server, validator, fixtures and shared
  primitives exist as `specs/001-sign-in-app-shell/tasks.md` builds them.
- **UI 002 is implemented**, including:
  - the domain queries, handlers and factory;
  - the reserved blocks of UI 001 R20: `useBulkSelection`, `BulkResultSummary`, `ConfirmDialog`
    `requireTyped`, the changed-value marking with `EditableSection`, and `HistoryLink` with the
    audit target filters.
- **API 003's contract is merged** (baseline `3207925`). The smoke tasks also need the API 003
  implementation merged in mailcow-rest-v2.

**Tests**: Mandatory (constitution VI, test-first). In every phase, tests are written first and must
fail before the implementation tasks that follow them. Every end-to-end spec:
- runs on the `mobile-chromium` (360 px), `desktop-chromium` and `mobile-webkit` projects;
- calls `expectAccessible` (axe, WCAG 2.2 AA, both themes) on every screen, dialog and state it
  reaches;
- fails on any CSP violation or mock contract violation (UI 001 T029 fixtures);
- calls `expectNoHorizontalScroll` at 360 and 320 px and `expectTouchTargets` on the mobile
  projects;
- names its spec reference in the test title (`US2-AS4 …`, `FR-030 …`, `Edge: …`).

**Organization**: Tasks are grouped by user story (spec priorities P1 to P3), so that each story can
be implemented and tested on its own once the foundation is in place.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task belongs to (US1 to US9)
- Paths are relative to the repository root `mailcowui-ng/`. `M/` stands for
  `src/features/mailboxes/` and `TM/` for `tests/unit/features/mailboxes/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The contract pin with API 003, the translation scope, the one new storage key and the
new catalogue entry (research R1, R2; data-model §4, §5).

- [ ] T001 Bump the contract (research R1, [contracts/README.md](./contracts/README.md)):
  - Run `scripts/contract/bump.sh <ref>`, where `<ref>` is API 003's release tag or the
    mailcow-rest-v2 commit that merges the API 003 implementation. Skip the bump if
    `contract/VERSION.json` already pins a commit that contains every operation of the contracts
    README.
  - Review `git -C ../mailcow-rest-v2 diff 32079252d55797d3da4e58ae661e9fb91c51c6f9..<ref> -- api/`
    for the 21 operations and their schemas. A changed member stops the task and is reported as a
    plan change.
  - The bump writes `contract/openapi.yaml`, `contract/openapi.json`, `contract/VERSION.json` and
    `src/api/generated/schema.ts`.
  - Confirm that `knownProblemTypeValues`, `mailboxStatusValues` and
    `componentsParametersMailboxSortValues` are generated.
  - Record the pinned ref in the "Implementation pin" row of `specs/003-mailboxes/contracts/README.md`.
  - `npm run typecheck`, `npm run test:unit` and `npm run test:e2e` must pass on the existing
    features.
- [ ] T002 [P] Extend `tests/unit/scripts/i18n-tools.spec.ts` for the scoped open enumerations
  (research R2). If UI 002 already added the scoping, add only the UI 003 cases. Cover:
  - for `AuditEventType`, `AuditTarget.type`, `AuditFailureReason`, `ValidationRuleCode` and
    `KnownProblemType`, keys are required only for the values listed in `src/i18n/enum-scope.json`;
  - a listed value missing from the contract is an error;
  - a contract value outside the scope is a warning;
  - the closed enumerations of data-model §9 added to `ENUM_NAMESPACES` are fully required under
    `enums.<name>.<value>`;
  - problem types come from `knownProblemTypeValues`.

  The tests must fail.
- [ ] T003 Implement the scoping in `scripts/i18n/lib.mjs` (`requiredKeys()`, `ENUM_NAMESPACES`) and
  `scripts/i18n/check.mjs`, so that T002 passes.
  - Create `src/i18n/enum-scope.json`, or extend UI 002's file. It holds UI 001's values (every
    value UI 001 labels), UI 002's values, and UI 003's values from data-model §9.
  - Add the closed enumerations of data-model §9 to `ENUM_NAMESPACES`.
- [ ] T004 Add the enumeration labels that T003 makes required to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`:
  - `enums.mailboxStatus.*`: map `mailbox.active`, `mailbox.disable_login` and `mailbox.inactive`
    through `src/i18n/legacy-map.json`;
  - `enums.mailboxAuthSource.*`: the `mailcow` label is `{productName}` (research R3); the others
    are "Keycloak", "Generic OIDC" and "LDAP";
  - the quarantine notification and category labels;
  - `enums.mailboxTaggedMailHandling.*`: map `user.tag_in_none`, `user.tag_in_subfolder` and
    `user.tag_in_subject`;
  - the rate-limit frames, the bulk actions and protocols, the rename steps and outcomes, the
    address holders, the creation-report outcomes, the blocker dependencies, the provider types,
    and the mailbox and template sort fields;
  - `enums.bulkItemOutcome.*`, unless UI 002 added it;
  - the scoped open values: `enums.auditEventType.mailbox*`, `enums.auditTargetType.mailbox` and
    `.mailboxTemplate`, `enums.auditFailureReason.*`;
  - the `validation.*` codes and `problem.*` names of data-model §9.

  Run `npm run i18n:import`. `npm run i18n:check` must pass.
- [ ] T005 [P] Extend `tests/unit/shared/platform/storage.spec.ts`. It covers:
  - the key `mailcowui-ng.mailboxes.columns` is accepted, with a JSON array value of at most 20
    column ids;
  - every key not listed in data-model §4 of UI 001 or of UI 003 is still refused;
  - a throwing `localStorage` never breaks the caller.

  The test must fail.
- [ ] T006 Add `mailcowui-ng.mailboxes.columns` to the allowlist in `src/shared/platform/storage.ts`,
  so that T005 passes.
- [ ] T007 [P] Extend `tests/unit/app/navigation/visibility.spec.ts` with the `mailboxTemplates` row
  (data-model §5):
  - path `/mailbox-templates`;
  - admin ✓, domainAdmin ✓, mailboxUser —;
  - delivered by 003;
  - classic links `/admin/mailbox` and `/domainadmin/mailbox`;
  - placed after `mailboxes`;
  - its placeholder route exists while its status is `placeholder`.

  The test must fail.
- [ ] T008 Add the `mailboxTemplates` row to `src/app/navigation/catalogue.ts` with
  `status: 'placeholder'`, so that T007 passes. Add an icon to `src/shared/icons/` (Lucide
  "layout-template", recorded in `THIRD_PARTY_NOTICES.md`) and `nav.mailboxTemplates` to
  `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, mapped to `mailbox.mailbox_templates` through
  `src/i18n/legacy-map.json`. US7 sets the row to `available`.

**Checkpoint**: The pinned contract contains API 003, and `npm run i18n:check`, `typecheck` and the
existing tests pass.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Everything that more than one story needs:
- the mailbox mock API base;
- the shared blocks reused from UI 002 or promoted (research R4);
- the pure modules of the feature;
- the base queries;
- the shared form fields (password, quota, protocols, permissions, initial settings, pickers);
- the section-form composable;
- the display components;
- the base translations.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Mock API base

- [ ] T009 [P] Create the factories:
  - `tests/mocks/factories/mailbox.ts`: a deterministic generator with a seeded PRNG. It builds
    `Mailbox` objects that validate against the contract: `quota` a multiple of 1,048,576 or 0;
    `percentUsed` `null` for unlimited; `largestAllowedQuota` computed from the domain;
    `lastLogins` members dates or `null`; `etag` a stable hash of the stored settings, excluding
    usage. Helpers cover IDN domains, LDAP, Keycloak and generic-OIDC sources, 255-character names,
    tags and custom attributes, and dependent counts for the deletion preview.
  - `tests/mocks/factories/mailbox-template.ts`: Default, with the legacy `init_db` values and an
    unlimited quota; "Small" (1 GiB, POP3 off, sync jobs on); and arbitrary templates.
  - `tests/mocks/factories/password-policy.ts`: the policy and its `etag`.
- [ ] T010 Write `tests/unit/mocks/mailbox-handlers.spec.ts`. It runs against the handlers through
  `msw/node` with the contract validator, and covers:
  - `listMailboxes`:
    - administrators see all mailboxes; domain administrators see those of their domains;
    - `q` matches address, display name and tags case-insensitively;
    - the `domain`, `status`, `tag` and `authSource` filters accept several values each;
    - every `MailboxSort` field works with `order`, with missing values last in both directions;
    - `limit` and `offset` work, and `ListMeta` is correct;
  - `getMailbox` sends an `ETag` header equal to `data.etag`, and answers 404 out of scope;
  - `getMailboxCapabilities` returns the scenario's variants;
  - `listMailboxTags` merges letter-case variants, counts mailboxes in scope, and supports `q` and
    paging;
  - `listMailboxTemplates` and `getMailboxTemplate` support `q`, sort and paging, and omit
    overlapping permissions for domain administrators;
  - `getPasswordPolicy` returns the policy and supports a `503` injection;
  - every response passes the validator.

  The test must fail.
- [ ] T011 Implement the mock base so that T010 passes:
  - Extend `tests/mocks/scenarios/state.ts` with `mailboxes`, `mailboxTemplates`, `passwordPolicy`,
    `mailboxCapabilities` and the per-target failure injection (data-model §3 of UI 001's
    scenario model).
  - `tests/mocks/handlers/mailboxes-read.ts`: `listMailboxes`, `getMailbox`,
    `getMailboxCapabilities` and `listMailboxTags`.
  - `tests/mocks/handlers/mailbox-templates.ts`: `listMailboxTemplates` and `getMailboxTemplate`;
    US7 adds the writes.
  - `tests/mocks/handlers/password-policy.ts`: `getPasswordPolicy`.
  - Register them in `tests/mocks/handlers/index.ts`.
  - Create `tests/mocks/scenarios/mailboxes/base.ts` with `admin-mailboxes-small` (5 mailboxes in
    `a.example` and `b.example`, for unit tests) and `admin-mailboxes-10k` (10,000 mailboxes in 500 domains,
    deterministic, research R20). Register it in `tests/mocks/scenarios/index.ts`.

### Shared blocks from UI 002 (reuse or provide; research R4)

- [ ] T012 [P] Write the tests of the quota family. If UI 002 already has these tests at these
  paths, add only the missing cases.
  - `tests/unit/shared/components/QuotaInput.spec.ts`:
    - a number with a MiB, GiB or TiB unit;
    - `v-model` in bytes;
    - refuses values that are not a whole number of MiB, values below 1 MiB, and 0;
    - shows a stored value in the largest exact unit (10,240 MiB as 10 GiB; 3,000 MiB stays);
    - brings up a numeric keypad (`inputmode="decimal"`);
    - has a labelled unit `<select>`.
  - `tests/unit/shared/utils/binary-units.spec.ts`: `toExactUnit` and `fromUnit`.
  - `tests/unit/i18n/format.spec.ts`:
    - `formatBinarySize(bytes)` uses binary units in the locale (`1,5 GiB` in cs-cz);
    - `formatDuration(minutes)` gives the largest whole unit (7,200 minutes is "5 days").

  The tests must fail where the behaviour is missing.
- [ ] T013 [P] Write `tests/unit/shared/components/UsageBar.spec.ts` and
  `tests/unit/shared/components/TagSetInput.spec.ts`. If UI 002 has them, add only the missing
  cases.
  - `UsageBar`:
    - a percent value;
    - `warnAt` and `criticalAt` thresholds (75 and 90 here);
    - a text equivalent of the state that does not depend on colour;
    - `role="meter"` with `aria-valuenow`.
  - `TagSetInput`:
    - add a tag by typing and Enter or a comma, remove one by one;
    - tags are trimmed, empty ones refused, at most `maxLength` characters;
    - a case-insensitive duplicate is not added;
    - adding beyond `limit` is refused with the limit stated;
    - a set already above the limit is shown in full and can only shrink;
    - an optional suggestion provider is debounced 300 ms;
    - a filter mode emits whole tags;
    - every chip has a labelled remove button of at least 44 × 44 px.

  The tests must fail where the behaviour is missing.
- [ ] T014 [P] Write `tests/unit/shared/components/promoted.spec.ts`:
  - `ActiveFilterChips.vue`: removable chips, "Clear all", announcements;
  - `BulkActionBar.vue`: fixed at the bottom below `md`, with the count, an actions slot and
    "Cancel", announced;
  - `NotFoundState.vue`: a heading, an explanation and a link back given as a prop;
  - `useUnsavedChangesGuard.ts`: confirms through `useConfirm` before the route leaves when dirty,
    adds a `beforeunload` listener only while dirty, and removes it on unmount.

  The test must fail where the blocks are missing.
- [ ] T015 [P] Write `tests/unit/shared/composables/reserved-blocks.spec.ts`. It checks the
  behaviour of UI 002's reserved blocks that UI 003 relies on, and adds cases only where it is not
  covered yet:
  - `useBulkSelection`:
    - items carry `BulkTarget { id, version }`;
    - a `max` option caps the selection and reports the refusal;
    - `retainOutcomes(['refused', 'outdated', 'failed'])` keeps exactly those items after a
      `BulkResult`;
    - the selection clears on `useListState`'s `onReset` with an announcement;
  - `ConfirmDialog` `requireTyped`: confirm stays disabled until the exact text is typed;
  - `useVersionedSave`: exposes `outdated` and the reloaded value for the changed-value marking;
  - `HistoryLink`: builds `/audit-log?targetType=mailbox&targetId=<address>`.

  The test must fail where the behaviour is missing.
- [ ] T016 Provide the quota family so that T012 passes:
  - `src/shared/components/QuotaInput.vue` and `src/shared/utils/binary-units.ts`: reuse UI 002's
    files at these paths, or move them there from `src/features/domains/`, updating UI 002's
    imports and keeping its tests green.
  - `formatBinarySize` and `formatDuration` in `src/i18n/format.ts`, if they are missing.
- [ ] T017 Provide `src/shared/components/UsageBar.vue` and `src/shared/components/TagSetInput.vue`
  so that T013 passes. Reuse, promote from `src/features/domains/`, or create them.
- [ ] T018 Provide the blocks of T014 so that it passes:
  - `src/shared/components/ActiveFilterChips.vue`: moved from
    `src/features/audit-log/components/` (the promotion path of UI 001 R20), with the audit log's
    imports updated, unless UI 002 moved it already;
  - `src/shared/components/BulkActionBar.vue`;
  - `src/shared/components/NotFoundState.vue`;
  - `src/shared/composables/useUnsavedChangesGuard.ts`.

  Only primitives that UI 001 copied are used: alert, badge, checkbox, collapsible, combobox,
  dialog, dropdown menu, radio group, switch and table.
- [ ] T019 Extend UI 002's reserved blocks only where T015 fails: the `max` option and
  `retainOutcomes` in `src/shared/composables/useBulkSelection.ts`, and the `outdated` exposure in
  `src/shared/composables/useVersionedSave.ts`. Keep UI 002's tests green.
- [ ] T020 [P] Extend `tests/unit/shared/validation/limits.spec.ts`. Each new constant must equal
  its value in `contract/openapi.json`:
  - `MAILBOX_DISPLAY_NAME_MAX` = `Mailbox.displayName.maxLength` (255);
  - `MAILBOX_PASSWORD_MAX` = `MailboxCreateRequest.password.maxLength` (255);
  - `MAILBOX_TEMPLATE_NAME_MAX` = `MailboxTemplate.name.maxLength` (255);
  - `MAILBOX_RATE_LIMIT_MAX` = `MailboxRateLimit.value.maximum` (2147483647);
  - `MAILBOX_ADDRESS_MAX` = `Mailbox.address.maxLength` (255);
  - `MAILBOX_RECOVERY_EMAIL_MAX` = 255.

  The test must fail.
- [ ] T021 Add these constants to `src/shared/validation/limits.ts`, each with a comment naming its
  schema path, so that T020 passes.

### Pure modules of the feature (tests first)

- [ ] T022 [P] Write `TM/validation.spec.ts` (research R18, data-model §6). It covers:
  - the local part: "Trimmed and lower-cased, then 1 to 64 ASCII letters, digits and
    ``! # $ % & ' * + / = ? ^ _ ` { | } ~ - .``, without a leading or trailing dot or two dots in a
    row";
  - the full address "at most 255 characters";
  - the rename check: equal to the current local part ignoring letter case is `unchanged`;
  - the recovery e-mail: empty, or a valid address of at most 255 characters;
  - the attribute name: 1–255 characters, `^\S+$`, unique case-sensitively;
  - the attribute value: at most 4,096 characters, or the capability value when given;
  - the rate limit: an integer from 1 to 2,147,483,647 and one of `second`, `minute`, `hour`,
    `day`;
  - the template name: trimmed, 1–255 characters.

  The test must fail.
- [ ] T023 [P] Write `TM/acl.spec.ts` (research R11, SC-010). It is table-driven:
  - administrators against every field;
  - domain administrators with each combination of `protocolAccess`, `sogoAccess`, `ratelimit`
    and `unlimitedQuota`, in the contexts `create`, `edit` (with an already-unlimited and a limited
    mailbox) and `templateRead`;
  - expected gates: `protocolAccess.*` readOnly without `protocolAccess`; `webmailRedirect`
    readOnly without `sogoAccess`; `rateLimit` readOnly without `ratelimit`; unlimited hidden
    without `unlimitedQuota` unless the mailbox is already unlimited;
  - `omittedPermissions(userPermissions)` lists the absent keys of the 15;
  - `bulkActions(identity)` leaves out the protocol actions without `protocolAccess`;
  - `flagLabelKey(flag)` maps to the legacy `acl.*` keys.

  The test must fail.
- [ ] T024 [P] Write `TM/quota.spec.ts` (research R9, R10; data-model §7.5). It covers the
  pre-fill table:
  - Default template → `defaultNewMailboxQuota`;
  - a template with 0 and unlimited not allowed → `defaultNewMailboxQuota`;
  - a template with 0 and unlimited allowed → unlimited;
  - a template with 1 GiB → 1 GiB.

  And:
  - no re-fill when the quota was touched;
  - `maxNewMailboxQuota` = 0: administrators get "Unlimited" forced; domain administrators without
    the flag get `creationImpossible`;
  - `exceedsMax(bytes, max)`;
  - `belowUsed(bytes, quotaUsed)` is a warning, not an error;
  - `canOfferUnlimited(identity, context)`.

  The test must fail.
- [ ] T025 [P] Write `TM/problems.spec.ts` (research R17, SC-005). For every problem type and rule
  code of [contracts/README.md](./contracts/README.md), it asserts the message key and parameters:
  - `address-in-use` per `holder`;
  - `mailbox-limit-reached` and `domain-alias-limit-reached` with `count` and `limit`;
  - `temporary-failure` per `dependency`, including an unknown value;
  - `outcome-unknown` per operation;
  - `attribute-not-permitted`: one field error per `attributes` path (`protocolAccess.pop3`,
    `quota`) with the flag label from `requiredFlags`;
  - `permission-flag-required` with the `requiredFlags` labels;
  - `mailbox-rename-incomplete` → `RenameReportView` with every step and outcome;
  - `outOfRange` with `limit` and `max`, formatted in binary units;
  - `missingCharacterClass` per class, `conflictsWith`, `unchanged`, and `notEligible` with `kind`;
  - an unknown type falls back to `problem.status.<status>`;
  - the English `detail` is never used.

  The test must fail.
- [ ] T026 [P] Write the password tests (research R8, SC-008):
  - `TM/password/generate.spec.ts`:
    - the length is `max(16, minLength)`, at most 255;
    - lower case, upper case and digits always present;
    - a special character from `-_.+=!?` when required or when the policy is unknown, and none
      otherwise;
    - none of `0 O 1 l I`;
    - the value never starts with `{`;
    - rejection sampling with an injected random source produces no bias at the alphabet
      boundary;
    - **SC-008**: 10,000 passwords for each of the 16 flag combinations at minimum lengths 0, 6,
      16, 17, 32 and 64 all meet their policy according to `policy-rules.ts`.
  - `TM/password/policy-rules.spec.ts`:
    - the rules in research R8's order, with the legacy keys and parameters;
    - length in UTF-8 bytes;
    - letters `[A-Za-z]`, digits, special = anything else, mixed case;
    - `met` evaluated live.
  - `TM/password/pre-hashed.spec.ts`: `{SSHA512}…`, `{BLF-CRYPT}…` and `{ARGON2ID}…` are detected;
    `Passw0rd{x}` is not.

  The tests must fail.
- [ ] T027 [P] Write `TM/auth-source.spec.ts` (research R9, FR-024). It covers:
  - the options are `capabilities.authSources`, plus the mailbox's current source when it is
    external and not listed;
  - only `mailcow` is offered when the capabilities fail;
  - the `mailcow` label uses the product name;
  - `controlsFor(source)`: an external source has no password and no recovery e-mail, and forced
    password change is unavailable with a reason key; `genericOidc` also makes forced
    second-factor setup unavailable;
  - switching to `mailcow` returns the "required if no password is stored" hint.

  The test must fail.
- [ ] T028 [P] Implement `M/validation.ts` so that T022 passes.
- [ ] T029 [P] Implement `M/acl.ts` so that T023 passes.
- [ ] T030 [P] Implement `M/quota.ts` so that T024 passes.
- [ ] T031 [P] Implement `M/problems.ts` so that T025 passes. Problem fields are typed from the
  generated problem schemas (`MailboxAddressInUseProblem`, `MailboxAttributeNotPermittedProblem` and
  the others), never restated.
- [ ] T032 [P] Implement `M/password/generate.ts`, `M/password/policy-rules.ts` and
  `M/password/pre-hashed.ts` so that T026 passes. The random source is
  `crypto.getRandomValues(new Uint32Array(n))`.
- [ ] T033 [P] Implement `M/auth-source.ts` so that T027 passes.

### Base queries and feature skeleton

- [ ] T034 Write `TM/api.spec.ts`. It covers:
  - the query keys and options of data-model §3: list `staleTime` 30 s with `keepPreviousData`;
    capabilities 5 min; password policy `staleTime: 0` with `refetchOnMount: 'always'`; the tags
    `useInfiniteQuery` with 25 per page;
  - the detail query's `initialData` is found in cached list pages, with `initialDataUpdatedAt: 0`
    so that it refetches (FR-017);
  - the detail key lower-cases the address;
  - the templates `all` query uses `limit=1000&sort=name` and puts Default first;
  - no request is made with a hand-written path; all go through the generated client.

  The test must fail.
- [ ] T035 Implement the base data layer so that T034 passes:
  - the roots `mailboxes`, `mailbox-templates` and `password-policy` in `src/api/query/keys.ts`;
  - `M/api.ts`: the list, detail, capabilities and tags queries, and the password policy query;
  - `M/templates-api.ts`: the list, all and detail queries;
  - `M/composables/useMailboxCapabilities.ts` and `M/composables/usePasswordPolicy.ts`;
  - `M/index.ts`, exporting `DomainPicker` after T042 and the link helpers after US1 and US2;
  - an empty `M/routes.ts`, registered in `src/app/router/routes.ts`. The stories add routes
    there.

### Shared form fields and display (tests first)

- [ ] T036 [P] Write `TM/components/password/PasswordField.spec.ts` and
  `PasswordPolicyHints.spec.ts` (FR-028–FR-030). They cover:
  - `autocomplete="new-password"`, `autocapitalize="none"`, `spellcheck="false"`;
  - a typed value starts hidden, with a labelled show/hide toggle;
  - "Generate" fills the field and switches it to visible;
  - "Copy" calls the clipboard only on click, and a refusal selects the text with a message;
  - there is no confirmation field;
  - the value is cleared on unmount;
  - the rules are listed before typing, each with an icon and visually hidden "met" or "not met"
    text, updated while typing;
  - the marks never disable submit;
  - "the rules are unavailable" when the policy fails;
  - the pre-hashed notice for `{SSHA512}…`.

  The test must fail.
- [ ] T037 [P] Write `TM/components/fields/MailboxQuotaField.spec.ts` (FR-034, FR-041). It covers:
  - the "Unlimited" switch is shown only when `canOfferUnlimited`;
  - "max. X" in binary units, and an error above the maximum before submitting;
  - a warning below `quotaUsed` that does not block;
  - typing 0 is refused;
  - a stored value is shown in the largest exact unit.

  The test must fail.
- [ ] T038 [P] Write `TM/components/fields/fields.spec.ts`. It covers:
  - `StatusField`: three radio options, with each effect explained before saving (FR-035);
  - `AuthSourceField`: a native `<select>` over the options of `auth-source.ts`;
  - `ProtocolAccessFields`: six labelled switches; read-only with `AclReadOnlyNote` without the
    flag;
  - `UserPermissionsFields`:
    - only the present keys are shown, grouped by topic (spam and filtering, quarantine, devices
      and apps, account) with the legacy `acl.*` labels;
    - the `pwReset` label contains the product name (US5-AS6);
    - the hidden-permissions note for domain administrators (FR-042);
  - `InitialSettingsFields` and `RateLimitField`: tagged-mail handling, quarantine notification and
    category, TLS in and out, and the rate limit as none or a value with a frame; the rate limit is
    read-only without `ratelimit`;
  - `AclReadOnlyNote`: `acl.prohibited` plus the permission label;
  - `CollapsibleGroup`: a Reka `Collapsible` with a one-line summary, and `aria-expanded`.

  The test must fail.
- [ ] T039 [P] Write `TM/components/fields/pickers.spec.ts`. It covers:
  - `DomainPicker`:
    - single and multiple modes;
    - Reka `Combobox` without `ComboboxViewport`;
    - a debounced (300 ms) `listDomains` search with infinite "load more";
    - each option shows the readable name with the ASCII form when it differs;
    - empty, error and retry states;
    - emits ASCII `name` values;
  - `TemplateSelect`: a native `<select>`, Default first;
  - `LocalPartField`: the domain shown as a suffix, the normalised address preview (trimmed,
    lower-cased), and the validation messages of `validation.ts`.

  The test must fail.
- [ ] T040 [P] Write `TM/components/display/display.spec.ts`. It covers:
  - `MailboxStatusBadge`: a text badge for each status; "Disallow login" shortened with the full
    legacy text in `title` and visually hidden text (FR-012);
  - `MailboxQuotaUsage`:
    - "Unlimited" without a bar;
    - otherwise `UsageBar` at 75 and 90, the percentage formatted with `Intl.NumberFormat`
      `percent` ("92 %" in cs-cz), and used and total with `formatBinarySize`;
    - the state as text (US1-AS7, FR-011).

  The test must fail.
- [ ] T041 [P] Write `TM/patch.spec.ts` and `TM/composables/useMailboxSection.spec.ts` (research
  R6, data-model §7.1). `patch.spec.ts` covers:
  - scalars only when changed;
  - `protocolAccess` and `userPermissions` with only the changed members, and left out when none
    changed;
  - `tags` as the whole set when it differs as a case-insensitive set;
  - `customAttributes`: added and changed names → value, removed or renamed stored names → `null`;
  - `recoveryEmail: ''` → `null`;
  - `password` only when non-empty;
  - an empty patch.

  `useMailboxSection.spec.ts` covers:
  - Save sends `application/merge-patch+json` with `If-Match: base.etag`;
  - `200` resets `base` and `draft`, writes the cache, clears the password and announces
    `success.mailbox_modified`;
  - `412`:
    - refetches;
    - marks the changed section fields with their new values;
    - untouched fields follow the server, and touched fields keep the user's values;
    - nothing is retried;
  - `403 attribute-not-permitted` gives field errors and refetches the identity and the mailbox;
  - `422` gives field errors;
  - `404` gives the not-found state;
  - the unsaved-changes guard is active while dirty;
  - a password mutation uses `gcTime: 0` and is reset.

  The tests must fail.
- [ ] T042 [P] Implement `M/components/password/PasswordField.vue` and
  `M/components/password/PasswordPolicyHints.vue` so that T036 passes.
- [ ] T043 [P] Implement `M/components/fields/MailboxQuotaField.vue` on `QuotaInput` so that T037
  passes.
- [ ] T044 [P] Implement `M/components/fields/StatusField.vue`, `AuthSourceField.vue`,
  `ProtocolAccessFields.vue`, `UserPermissionsFields.vue`, `InitialSettingsFields.vue`,
  `RateLimitField.vue`, `AclReadOnlyNote.vue` and `CollapsibleGroup.vue` so that T038 passes.
- [ ] T045 [P] Implement `M/components/fields/DomainPicker.vue`, `TemplateSelect.vue` and
  `LocalPartField.vue` so that T039 passes. `DomainPicker` uses UI 002's domain list query from
  `@/features/domains`. Add a non-behavioural export to `src/features/domains/index.ts` if it is
  not exported yet. Export `DomainPicker` from `M/index.ts` for UI 004.
- [ ] T046 [P] Implement `M/components/display/MailboxStatusBadge.vue` and
  `M/components/display/MailboxQuotaUsage.vue` so that T040 passes.
- [ ] T047 Implement `M/patch.ts` and `M/composables/useMailboxSection.ts` so that T041 passes. Also
  implement the `updateMailbox` mutation in `M/api.ts` with the invalidation of data-model §3:
  - write the detail;
  - patch the entry in every cached list page;
  - invalidate the lists;
  - invalidate the tags if `tags` was sent;
  - invalidate the domain if `quota` or `status` was sent;
  - `gcTime: 0` when `password` is sent.
- [ ] T048 Add the foundation messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`:
  - `mailboxes.common.*`;
  - the field labels and help;
  - `mailboxes.password.*`, `mailboxes.quota.*` and `mailboxes.acl.*`;
  - `mailboxes.problem.*`, the variants of `problems.ts`;
  - the `validation.format.localPart`, `.email` and `.attributeName` formats;
  - `validation.missingCharacterClass.*` and `validation.quota.*`.

  Map the legacy keys of research R3 through `src/i18n/legacy-map.json`: the `acl.*` labels except
  `pw_reset`, `add.*`, `edit.*`, `tfa.force_tfa`, `user.tag_*` and `admin.password_policy_*`.
  - Write `pwReset` and the built-in source with `{productName}`.
  - Supply the keys missing from the upstream Slovak file (`edit.custom_attributes`,
    `edit.password_recovery_email`, `user.attribute`) in `src/i18n/messages/sk-sk.json`, and
    `tfa.force_tfa` in both `cs-cz` and `sk-sk`.

  Run `npm run i18n:import`. `npm run i18n:check` must pass.

**Checkpoint**: The foundation is ready, and all Phase 2 tests pass. The stories can start.

---

## Phase 3: User Story 1 - Find and inspect mailboxes (Priority: P1) 🎯 MVP

**Goal**: The list, as cards on phones and a table with optional columns on wide screens, with
search, filters, sort, paging, refresh and remembered columns. The detail overview, with the
section navigation and the read-only groups. "Not found" and "no access".

**Independent Test**: Against the mock with 10,000 mailboxes in 500 domains, as an administrator
and as a domain administrator, on 360 px and desktop:
- search, apply each filter and sort, and page;
- open mailboxes;
- compare every displayed value with the mock data;
- run axe on each view.

### Tests for User Story 1 (write first; must fail)

- [ ] T049 [US1] Create `tests/mocks/scenarios/mailboxes/list.ts`, registered in
  `tests/mocks/scenarios/index.ts`, with these scenarios:
  - `admin-mailboxes-30`: `anna@a.example`, `bob@a.example` named "Joanna Bob", and
    `carl@a.example` tagged "Annapolis"; a mailbox at 92 %; three unlimited mailboxes; an inactive
    one, a login-disabled one and an LDAP one; an IDN domain `bücher.example`; 255-character names
    and tags;
  - `domain-admin-mailboxes`: manages only `a.example`, while `b.example` exists;
  - `mailbox-user-active`;
  - `mailboxes-empty-filter`;
  - `mailboxes-list-error`: an injected `500` on `listMailboxes`;
  - `capabilities-last-logins-off`;
  - `capabilities-groupware-off`.
- [ ] T050 [P] [US1] Write `tests/e2e/mailboxes/list.spec.ts`. It covers:
  - US1-AS1: 30 mailboxes at 360 px show 25 cards sorted by address, the total of 30 and paging,
    with no horizontal scroll;
  - US1-AS2: adding "Last password change" on desktop survives a reload in the same context;
  - US1-AS3: "ANNA" finds all three; the search is in the address; Back restores the previous list;
    the search commits 500 ms after the last keystroke (FR-009);
  - US1-AS4: domain and status filters, with removable chips and "Clear all";
  - US1-AS5, first half: filters without a match give the empty state with "clear filters";
  - US1-AS6: `percentUsed desc` puts the fullest first, and unlimited mailboxes last, labelled
    "Unlimited" without a bar;
  - US1-AS7: 92 % shows a critical bar with "92 %" and the sizes in the locale;
  - US1-AS10: the error state with retry;
  - US1-AS11: a mailbox user has no entry and gets "no access";
  - FR-006: page sizes 25, 50 and 100, kept in the address and not in storage;
  - FR-008: the default columns and each optional column;
  - FR-010: header sort with `aria-sort` on desktop, and the sort control in the panel on phones;
  - FR-012: the status badges;
  - FR-014: refresh;
  - FR-071: the filter panel opens over the list at 360 px;
  - Edge: search text with special characters is matched literally (asserted on the request);
  - Edge: long values wrap at 360 and 320 px;
  - Edge: last logins off show "Not reported";
  - Edge: IDN domains are shown readable;
  - SC-001: on 360 px with `admin-mailboxes-10k`, search a fragment and open a mailbox in under
    10 s.
- [ ] T051 [P] [US1] Write `tests/e2e/mailboxes/detail.spec.ts`. It covers:
  - US1-AS8: a domain administrator gets "not found" for a mailbox of `b.example`, the same as for
    a missing one, with a link to the list (FR-004);
  - US1-AS9: the overview shows every FR-015 group; settings managed elsewhere are read-only and
    name their feature as text without a link (FR-040);
  - FR-016: on phones the section list with summaries, and on desktop the side navigation;
    History only for administrators;
  - FR-017: opened from the list, the values show before `getMailbox` resolves (asserted with a
    delayed response), then refresh;
  - the canonical address replaces a differently cased address;
  - IDN: the ASCII form on the detail;
  - last logins: "No login recorded" for `null`, and never "never";
  - groupware off: the webmail redirect is shown as disabled on the server;
  - Edge: a mailbox deleted while open gives "not found" on the next load.
- [ ] T052 [P] [US1] Write the unit tests:
  - `TM/list-state.spec.ts`: data-model §5 parameters mapped to `MailboxListParams`; defaults left
    out; repeatable values; invalid values normalised; `onReset` on changes;
  - `TM/columns.spec.ts`: read and write of `mailcowui-ng.mailboxes.columns`; unknown ids ignored;
    defaults when storage throws;
  - `TM/components/list/MailboxCard.spec.ts`: the card opens the mailbox; a separate actions menu;
  - `TM/components/list/MailboxTable.spec.ts`: header cells, `aria-sort`, optional columns;
  - `TM/components/list/MailboxFilters.spec.ts`: the dialog panel, the domain chip label, the
    source label with the product name;
  - `TM/components/display/MailboxSectionNav.spec.ts`: summaries; only registered section routes;
    History for administrators;
  - `TM/sections/MailboxOverview.spec.ts` and `TM/components/display/LastLogins.spec.ts`.
- [ ] T053 [P] [US1] Write `tests/smoke/mailboxes.smoke.spec.ts`:
  - `admin` lists the seeded mailboxes, searches "alice" and opens `alice@example.org`;
  - `reseller` sees only mailboxes of `example.org` and `example.net`;
  - one case runs at 360 × 780 with no horizontal scroll;
  - tagged `@read-only`.

### Implementation for User Story 1

- [ ] T054 [US1] Implement `M/list-state.ts`, `M/columns.ts` (the catalogue of data-model §2 and the
  storage preference) and `M/sections.ts` (the section catalogue of data-model §2).
- [ ] T055 [P] [US1] Implement the list components in `M/components/list/`:
  - `MailboxCard.vue` (below `md`);
  - `MailboxTable.vue` (from `md` up, on `src/shared/ui/table`);
  - `MailboxList.vue`;
  - `MailboxSortControl.vue` (a native `<select>` of the 12 fields × 2 orders);
  - `ColumnChooser.vue` (Reka `DropdownMenu` with checkbox items);
  - `MailboxRowActions.vue` with "Edit". US4 adds "Remove", and later features add theirs
    (data-model §8).
- [ ] T056 [P] [US1] Implement `M/components/list/MailboxFilters.vue`:
  - a Reka `Dialog` panel;
  - `DomainPicker` in multiple mode;
  - the status checkboxes;
  - `TagSetInput` in filter mode with `listMailboxTags` suggestions;
  - the source checkboxes;
  - the sort control below `md`.

  It integrates with `ActiveFilterChips`.
- [ ] T057 [US1] Implement `M/pages/MailboxesPage.vue`:
  - `useListState`;
  - the debounced search;
  - `ListState` with loading, empty ("no mailbox matches", with clear filters) and error with
    retry;
  - `PaginationBar`;
  - refresh;
  - `PageHeader`.

  The "Add mailbox" actions render only when the `mailbox-create` route exists
  (`router.hasRoute`), which US2 registers.
- [ ] T058 [US1] Implement the detail screen:
  - `M/pages/MailboxDetailPage.vue`: the layout, the detail query, the canonical address replace,
    `NotFoundState` on 404, the side navigation from `lg` up, and a `RouterView` for the sections;
  - `M/sections/MailboxOverview.vue`: the groups of FR-015;
  - `M/components/display/MailboxSectionNav.vue`: entries from `sections.ts` whose route exists,
    with a `HistoryLink` for administrators;
  - `M/components/display/LastLogins.vue`;
  - `M/components/display/ManagedSettingsGroup.vue`: entries with an optional `to`
    (data-model §8).
- [ ] T059 [US1] Register the routes `mailboxes`, `mailbox-detail` and `mailbox-overview` in
  `M/routes.ts`. Set the catalogue's `mailboxes` entry to `available` in
  `src/app/navigation/catalogue.ts`. Export `mailboxListLink({ domain })` from `M/index.ts`.
- [ ] T060 [US1] Add the `mailboxes.list.*`, `mailboxes.filters.*`, `mailboxes.columns.*`,
  `mailboxes.detail.*`, `mailboxes.overview.*`, `mailboxes.managed.*` and `mailboxes.sections.*`
  messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. Map the `mailbox.*` list keys of
  research R3 through `src/i18n/legacy-map.json`. `npm run i18n:check` must pass.

**Checkpoint**: US1 works on its own, and T049–T053 pass. This is the MVP: a read-only mailbox
browser.

---

## Phase 4: User Story 2 - Create a mailbox (Priority: P1)

**Goal**: The single-screen create form: local part with the normalised preview, domain figures,
template application with the overwrite confirmation, quota pre-fill, password generator and
hints, collapsed groups, the minimal request, and translated refusals with every entry kept.

**Independent Test**: Against the mock, create mailboxes on both viewports:
- as an administrator, and as domain administrators with and without each flag;
- with and without templates;
- at each domain limit;
- with passwords that meet and that fail the policy.

Check each request, each error, and the screen after success.

### Tests for User Story 2 (write first; must fail)

- [ ] T061 [US2] Implement the create mock in `tests/mocks/handlers/mailboxes-write.ts`, registered
  in `tests/mocks/handlers/index.ts`. `createMailbox`:
  - trims and lower-cases the local part, and applies the rules of `MailboxCreateRequest`;
  - takes values from the template and then the defaults;
  - takes the domain's default quota when no template is named;
  - refuses a quota with `outOfRange` (`limit` `maxMailboxQuota` or `domainQuotaLeft`) or
    `notMultipleOf`;
  - answers `mailbox-limit-reached` with `count` and `limit`, and `address-in-use` with each
    holder;
  - refuses with `attribute-not-permitted` and `requiredFlags`, where a value equal to the template
    is not a choice;
  - applies the password policy (`tooShort`, `missingCharacterClass`) and stores pre-hashed values
    as given;
  - refuses a password with an external source (`conflictsWith`);
  - answers `notFound` on `templateId` and `notEligible` (`kind: aliasDomain`);
  - returns `creationReport` with injectable failed steps;
  - sends `Location` and `ETag`;
  - updates the domain's usage.

  Create `tests/mocks/scenarios/mailboxes/create.ts`, registered in the index, with:
  - `admin-create`: `example.org` with a 1 GiB default, a 5 GiB maximum and room left; Default and
    "Small";
  - `admin-create-limits`: a full domain, and a domain with `maxNewMailboxQuota` 0;
  - `domain-admin-no-flags`;
  - `domain-admin-unlimited`;
  - `admin-create-alias-taken`: `anna@example.org` is an alias;
  - `password-policy-strict`: minimum 10, digits required;
  - `password-policy-unavailable`: `503`;
  - `capabilities-ldap` and `capabilities-generic-oidc`;
  - `create-report-failures`;
  - `template-deleted-on-submit`;
  - `mailboxes-empty-scope`: no mailbox at all;
  - `inactive-backupmx-domain`.
- [ ] T062 [P] [US2] Write `tests/e2e/mailboxes/create.spec.ts`. It covers:
  - US2-AS1: ` Anna.Smith ` shows `anna.smith@example.org`; generate and create; the detail opens,
    and "Mailbox anna.smith@example.org has been added" is announced;
  - US2-AS2: 1 GiB pre-filled, "max. 5 GiB", and 8 GiB refused on the field before submitting;
  - US2-AS3: "Small" fills the fields, including the collapsed-group summaries;
  - US2-AS4: "short" marks both rules as not met, and a generated value meets both;
  - US2-AS5: no "Unlimited" without the flag; protocols read-only with the permission named;
  - US2-AS6: sync jobs absent, with the note;
  - US2-AS7: the alias holder is named on the local part field, and every entry, including the
    password, is kept;
  - US2-AS8: "no mailboxes left", then the refusal with count and limit;
  - US2-AS9: `warning.quota_exceeded_scope` with unlimited only for an administrator, and
    "creation not possible" for a domain administrator without the flag;
  - US2-AS10: `route.abort()` keeps the entries, and a resubmit works;
  - US1-AS5, second half, moved here because it needs this screen: a scope without mailboxes
    offers "Add mailbox";
  - FR-019: each local-part rule;
  - FR-020: inactive and backup-MX notes, and `?domain=` preselection from the list filtered by
    one domain;
  - FR-021: changing the template after an edit asks first; "No" restores the previous template;
  - FR-023: the display name hint;
  - FR-024: with `capabilities-ldap`, LDAP is offered; choosing it removes the password and makes
    forced change unavailable with the reason; generic OIDC also disables forced two-factor setup;
  - FR-025: through `mockApi.requests()`, the body holds the local part, domain, `templateId`,
    quota and password, and only the values that differ from the template;
  - FR-026: "Add another" keeps the domain and template;
  - creation report: failed steps are listed (research R9);
  - FR-028 and FR-029: copy only on click; the generated value is visible;
  - FR-030: "rules unavailable" with `password-policy-unavailable`, still submittable; the
    pre-hashed notice;
  - Edge: template deleted before submitting: the error on the template, the list reloaded;
  - Edge: policy changed: a `422` on the password reloads the policy and updates the hints;
  - FR-066: a double tap sends one request;
  - FR-069: the error summary receives the focus;
  - SC-002 proxy: the flow completes on 360 px.
- [ ] T063 [P] [US2] Write the unit tests:
  - `TM/create-request.spec.ts` (FR-025):
    - always `localPart` (normalised), `domain`, `templateId` and `quota`;
    - `password` unless the source is external;
    - `authSource` when it is not `mailcow`;
    - `displayName` when it is non-empty;
    - template-driven values only when they differ, with nested members, and objects left out when
      empty;
  - `TM/composables/useMailboxCreateForm.spec.ts`: data-model §7.5, including the quota re-fill
    unless touched;
  - `TM/composables/useTemplateApplication.spec.ts`: the table of data-model §7.6;
  - `TM/pages/MailboxCreatePage.spec.ts`:
    - the essentials first and five collapsed groups with summaries;
    - submit disabled when creation is impossible;
    - the password cleared after success and on unmount;
    - the create mutation's `gcTime` is 0.
- [ ] T064 [P] [US2] Write `tests/smoke/mailbox-create.smoke.spec.ts`:
  - `admin` creates `smoke-<random>@example.org` with a generated password that the real policy
    accepts, and the detail opens;
  - choosing "Small" applies 1 GiB with POP3 off;
  - creating `alice` again shows the holder `mailbox`;
  - teardown deletes the created mailbox through the API with the test's session.

### Implementation for User Story 2

- [ ] T065 [US2] Implement `M/create-request.ts` and the `createMailbox` mutation in `M/api.ts`:
  - `gcTime: 0`;
  - write the detail without `creationReport`;
  - invalidate the lists, tags and domains;
  - set the `CreationNotice` one-shot of data-model §2.
- [ ] T066 [P] [US2] Implement `M/composables/useTemplateApplication.ts` and
  `M/composables/useMailboxCreateForm.ts`.
- [ ] T067 [US2] Implement `M/pages/MailboxCreatePage.vue`:
  - the essentials: `LocalPartField`, `DomainPicker` (single) with the domain figures from UI 002's
    `getDomain` query, the display name, `TemplateSelect`, `PasswordField` with the hints, and
    `MailboxQuotaField`;
  - then the five `CollapsibleGroup`s of research R9, with the gates of `acl.ts`;
  - `useProblemForm` and `useUnsavedChangesGuard`.

  Also implement `M/components/display/CreationNotice.vue`: the success alert with "Add another
  mailbox" and the failed steps, shown once on `MailboxDetailPage.vue`.
- [ ] T068 [US2] Register the `mailbox-create` route in `M/routes.ts`. The "Add mailbox" actions of
  `MailboxesPage.vue` now render: in the header, and in the empty state of a scope without
  mailboxes. Export `mailboxCreateLink({ domain, template })` from `M/index.ts`.
- [ ] T069 [US2] Add the `mailboxes.create.*` and `mailboxes.creationReport.*` messages. Map
  `mailbox.add_mailbox`, `add.mailbox_username`, `add.full_name`, `add.password`, `add.generate`,
  `add.select_domain`, `warning.quota_exceeded_scope` and `success.mailbox_added` through
  `src/i18n/legacy-map.json`. `npm run i18n:check` must pass.

**Checkpoint**: US1 and US2 work on their own.

---

## Phase 5: User Story 3 - Change a mailbox's settings and password (Priority: P1)

**Goal**: The General, Sign-in and password, and Protocol access sections, each saving its changed
values with the version read. Outdated saves keep the input and mark the changes. The unsaved
changes guard.

**Independent Test**: Against the mock, change each field of each section on both viewports, as an
administrator and as domain administrators with and without each flag. Make the mock report the
mailbox as changed between reading and saving, and check that the entries are kept and nothing is
overwritten.

### Tests for User Story 3 (write first; must fail)

- [ ] T070 [US3] Extend `tests/mocks/handlers/mailboxes-write.ts` with `updateMailbox`:
  - Merge Patch: nested `protocolAccess` and `userPermissions`, `tags` replaced, `customAttributes`
    with `null` removals;
  - `If-Match` with `412`;
  - `immutable` for read-only members;
  - `outOfRange` with `limit: largestAllowedQuota`, while a quota below the usage is accepted;
  - a status change also changes the own alias;
  - the password rules, and `passwordChangedAt` updated;
  - with an external source: the password is refused unless the same request switches to
    `mailcow`, and switching without a password when none is stored gives `required`;
  - `recoveryEmail` `invalidFormat` or `conflictsWith`;
  - `attribute-not-permitted`, where a value equal to the current one is not a choice, and
    unlimited is allowed when the mailbox is already unlimited;
  - `503` injection.

  Add `PATCH /__mock/scenarios/:id` support for `{ mailboxChange: { address, patch } }`, which
  changes a mailbox "elsewhere" and its `etag`.

  Create `tests/mocks/scenarios/mailboxes/edit.ts`, registered in the index, with `admin-edit`,
  `admin-edit-ldap`, `domain-admin-edit-no-protocol`, `domain-admin-edit-no-sogo` and
  `domain-admin-flags-revoked`.
- [ ] T071 [P] [US3] Write `tests/e2e/mailboxes/sections.spec.ts`. It covers:
  - US3-AS1: a generated password is saved; the success is announced; the field is cleared; the
    last password change is updated; the password is never shown again;
  - US3-AS2: "Inactive" explains its effect before saving, and the list shows the new status;
  - US3-AS3: a quota changed elsewhere refuses the display-name save as outdated; the entry is
    kept; the quota is marked with its new value; the second save succeeds;
  - US3-AS4: the maximum is shown above `largestAllowedQuota`, and a warning appears below the
    usage while saving stays possible;
  - US3-AS5: a domain administrator without the flag sees protocols read-only, with the permission
    named and no save;
  - US3-AS6: the LDAP mailbox has no password or recovery fields; forced change is unavailable with
    the reason; switching to the built-in source shows the password with its hint;
  - US3-AS7: leaving with unsaved changes asks first;
  - FR-032: only the changed values are sent, asserted on the request; every section then shows
    the returned values;
  - FR-035: the status effects;
  - FR-036: the recovery e-mail is validated, empty clears it, and it is hidden for external
    sources; an empty password leaves the password unchanged;
  - FR-041: the webmail redirect is read-only without `sogoAccess`; with groupware off it is hidden;
  - FR-043 and Edge "flag removed during the session": the refusal names the field and the
    permission, the identity is refetched, and the control becomes read-only;
  - Edge: a second tab's save is refused as outdated;
  - Edge: session expired while editing: after the new sign-in the password field is empty;
  - FR-066: no double submit.
- [ ] T072 [P] [US3] Write `TM/sections/GeneralSection.spec.ts`, `TM/sections/SignInSection.spec.ts`
  (switching sources, the hints, the password cleared on success and unmount) and
  `TM/sections/ProtocolAccessSection.spec.ts` (read-only, with no save action, without the flag).
- [ ] T073 [P] [US3] Write `tests/smoke/mailbox-sections.smoke.spec.ts`:
  - `admin` creates a mailbox through the API, changes the display name, sets 2 GiB, sets it
    inactive and active again, sets a generated password (`passwordChangedAt` changes) and turns
    POP3 off;
  - `reseller` sees the protocol section read-only;
  - teardown deletes the mailbox.

### Implementation for User Story 3

- [ ] T074 [P] [US3] Implement `M/sections/GeneralSection.vue`: display name, `MailboxQuotaField`
  with `largestAllowedQuota` and `quotaUsed`, `StatusField`, and the webmail redirect gated by
  `sogoAccess` and hidden when `groupwareEnabled` is false. It is built on `useMailboxSection`.
- [ ] T075 [P] [US3] Implement `M/sections/SignInSection.vue`:
  - `AuthSourceField`;
  - `PasswordField` with the hints, only for the built-in source;
  - forced password change and forced second-factor setup, with the unavailable reasons;
  - the recovery e-mail, only for the built-in source.
- [ ] T076 [P] [US3] Implement `M/sections/ProtocolAccessSection.vue` with `ProtocolAccessFields`.
  Without the flag it is read-only, with no save action.
- [ ] T077 [US3] Register the `mailbox-general`, `mailbox-sign-in` and `mailbox-protocols` routes in
  `M/routes.ts`. The section navigation lists them automatically.
- [ ] T078 [US3] Add the `mailboxes.sections.general.*`, `mailboxes.sections.signIn.*`,
  `mailboxes.sections.protocols.*`, `mailboxes.outdated.*` and `mailboxes.unsaved.*` messages. Map
  `edit.full_name`, `edit.sogo_access`, `edit.sogo_access_info`, `edit.allowed_protocols`,
  `edit.password_recovery_email`, `mailbox.force_pw_update` and `success.mailbox_modified`.
  `npm run i18n:check` must pass.

**Checkpoint**: US1 to US3 work on their own.

---

## Phase 6: User Story 4 - Delete a mailbox (Priority: P1)

**Goal**: The delete dialog built from the deletion preview, from the list row and from the detail's
Delete section, with every outcome handled.

**Independent Test**: Against the mock, delete from the list and from the detail on both viewports.
Make the mock answer with success, the mail-store failure, outdated, not found and outcome unknown,
and check what the user sees in each case.

### Tests for User Story 4 (write first; must fail)

- [ ] T079 [US4] Implement `tests/mocks/handlers/mailbox-deletion.ts`, registered in the index:
  - `previewMailboxDeletion`: seeded counts, up to 100 alias addresses, the `present` flags,
    `blockers` with `canProceed: false` when the mail store or shared store is down, and `etag`;
  - `deleteMailbox`: `If-Match` with `412`; `503 temporary-failure` (`dependency: mailStore`);
    `504 outcome-unknown` (`step: mailStoreCleanup`); `404`; on success, removal from lists and the
    domain's usage updated.

  Create `tests/mocks/scenarios/mailboxes/delete.ts`, registered in the index, with:
  - `admin-delete`: a mailbox using 2 GiB in 10,000 messages, with dependents; a mailbox whose mail
    store fails; a mailbox that times out;
  - hooks "changed elsewhere" and "deleted elsewhere" through `PATCH /__mock/scenarios/:id`;
  - `delete-store-unreachable`: the preview has blockers.
- [ ] T080 [P] [US4] Write `tests/e2e/mailboxes/delete.spec.ts`. It covers:
  - US4-AS1, from the list and from the detail: the name, 2 GiB and 10,000 messages, the garbage
    area with the retention period, the kinds of data with their counts (passkeys named as such),
    shared aliases keeping their other recipients, and the focus on "Cancel";
  - US4-AS2: the removal is announced, the list no longer shows the mailbox, and the detail returns
    to the list;
  - US4-AS3: "not deleted, nothing removed, try again later", and the mailbox is still listed;
  - US4-AS4: changed elsewhere before opening shows the notice in the dialog; changed after
    opening gives `412`, a reload and a new confirmation;
  - US4-AS5: deleted elsewhere: "no longer exists", and the list is refreshed;
  - FR-045: the confirm button names the action and the mailbox;
  - blockers disable "Remove" and offer "Check again";
  - 504: "outcome unknown", with the mailbox still listed after the refresh;
  - the `/mailboxes/<address>/delete` deep link opens the dialog, and "Cancel" returns to the
    overview;
  - FR-066: no double submit.
- [ ] T081 [P] [US4] Write `TM/deletion.spec.ts` (the `DeletionImpact` of data-model §2: non-zero
  counts, present flags, retention as days, hours or minutes, blockers) and
  `TM/components/dialogs/MailboxDeleteDialog.spec.ts` (data-model §7.2: preview on open, the tag
  comparison, `If-Match` with `preview.etag`, the initial focus, every outcome).
- [ ] T082 [P] [US4] Write `tests/smoke/mailbox-delete.smoke.spec.ts`: a mailbox created through the
  API is removed through the dialog, with the real preview shown, and disappears from the list.

### Implementation for User Story 4

- [ ] T083 [US4] Implement `M/deletion.ts`, plus the preview query (`staleTime: 0`, `gcTime: 0`) and
  the `deleteMailbox` mutation in `M/api.ts`, with the invalidation of data-model §3.
- [ ] T084 [US4] Implement `M/components/dialogs/MailboxDeleteDialog.vue` (Reka `AlertDialog`).
  Add "Remove" to `M/components/list/MailboxRowActions.vue`. Implement
  `M/sections/MailboxDeleteRoute.vue` and register the `mailbox-delete` route in `M/routes.ts`.
- [ ] T085 [US4] Add the `mailboxes.delete.*` messages: the impact items, retention units, blockers
  and outcomes. Map `mailbox.remove` and `success.mailbox_removed`. `npm run i18n:check` must pass.

**Checkpoint**: All P1 stories (US1 to US4) work.

---

## Phase 7: User Story 5 - Manage a mailbox's permissions, tags and custom attributes (Priority: P2)

**Goal**: The Permissions, Tags and Custom attributes sections, with domain administrators'
omissions, the capability limits and tag suggestions.

**Independent Test**: Against the mock, change each permission, the tags and the custom
attributes, as an administrator and as a domain administrator lacking each overlapping flag. Check
the requests and results on both viewports.

### Tests for User Story 5 (write first; must fail)

- [ ] T086 [US5] Extend `tests/mocks/handlers/mailboxes-write.ts` and
  `tests/mocks/handlers/mailboxes-read.ts`:
  - `userPermissions` omitted, and changes refused, for domain administrators without the
    overlapping flag;
  - `tags`: set semantics, the first spelling kept, `tooMany` with `taggingLimit`, a set above the
    limit allowed to shrink only;
  - `customAttributes`: add, replace and remove with `null`; `invalidFormat: attributeName`;
    `tooLong`; `tooMany`;
  - `listMailboxTags` reflects the changes.

  Create `tests/mocks/scenarios/mailboxes/permissions.ts`, registered in the index, with:
  - `admin-permissions`: a mailbox tagged "Sales"; a mailbox with 30 legacy tags; `old=1`; a
    mailbox with 100 attributes;
  - `domain-admin-no-syncjobs`;
  - `branding-example-mail`: `productName` is "Example Mail";
  - `capabilities-low-limits`: `taggingLimit` 5, `customAttributeLimit` 10.
- [ ] T087 [P] [US5] Write `tests/e2e/mailboxes/permissions-tags-attributes.spec.ts`. It covers:
  - US5-AS1: turning on "Sync jobs" sends only `userPermissions.syncjobs`;
  - US5-AS2: a domain administrator does not see sync jobs, and the note is shown;
  - US5-AS3: "sales" is not added twice, and a 26th tag is refused with "the limit is 25";
  - US5-AS4: 30 tags are all shown, and Save is enabled only at 25 or fewer;
  - US5-AS5: add `department=Sales` and remove `old`, so only `department=Sales` remains; a name
    with a space gives a field error;
  - US5-AS6: the `pwReset` label says "Example Mail";
  - FR-037: grouped switches with the legacy labels;
  - FR-038: suggestions from the tags in use, and the limit from the capabilities
    (`capabilities-low-limits`);
  - FR-039: the value length and the count;
  - Edge: 100 attributes stay usable at 360 px, one per row;
  - Edge: long tags and values wrap.
- [ ] T088 [P] [US5] Write `TM/sections/PermissionsSection.spec.ts`, `TM/sections/TagsSection.spec.ts`
  and `TM/components/fields/CustomAttributesEditor.spec.ts`. The editor tests cover rows, add and
  remove, a rename as a removal plus an addition, duplicates, and the limits from the capabilities.
- [ ] T089 [P] [US5] Write `tests/smoke/mailbox-permissions.smoke.spec.ts`: on a mailbox created
  through the API, `admin` turns on sync jobs, adds two tags and an attribute, and removes one tag.
  The detail then shows the saved values.

### Implementation for User Story 5

- [ ] T090 [P] [US5] Implement `M/sections/PermissionsSection.vue` with `UserPermissionsFields` and
  the hidden-permissions note.
- [ ] T091 [P] [US5] Implement `M/sections/TagsSection.vue` with `TagSetInput`: the `taggingLimit`
  and `tagMaxLength` capabilities, `listMailboxTags` suggestions, and shrink-only above the limit.
- [ ] T092 [P] [US5] Implement `M/components/fields/CustomAttributesEditor.vue` and
  `M/sections/CustomAttributesSection.vue`.
- [ ] T093 [US5] Register the `mailbox-permissions`, `mailbox-tags` and `mailbox-attributes` routes
  in `M/routes.ts`.
- [ ] T094 [US5] Add the `mailboxes.sections.permissions.*`, `mailboxes.tags.*` and
  `mailboxes.attributes.*` messages. Map `add.tags`, `edit.custom_attributes` and `user.attribute`,
  and supply the Slovak gaps. `npm run i18n:check` must pass.

**Checkpoint**: US1 to US5 work on their own.

---

## Phase 8: User Story 6 - Apply an action to many mailboxes at once (Priority: P2)

**Goal**: Selection mode, the six actions with protocol variants, confirmations with the typed count
for deletion, the result summary per mailbox, and the whole-request and unknown outcomes.

**Independent Test**: Against the mock, apply each action on both viewports to selections that
include not-found, refused, outdated and failed mailboxes, and to a whole-request refusal. Check
the confirmation, the summary and the selection afterwards.

### Tests for User Story 6 (write first; must fail)

- [ ] T095 [US6] Implement `tests/mocks/handlers/mailbox-bulk.ts`, registered in the index.
  `applyMailboxBulkAction`:
  - gives per-target outcomes: `notFound` for a missing or foreign target; `outdated` for a stale
    `version`; `failed` with `temporary-failure` (`dependency: mailStore`); `refused` by injection;
  - deduplicates targets;
  - refuses domain administrators' protocol actions as a whole with `403 permission-flag-required`
    (`requiredFlags: [protocolAccess]`);
  - answers `422 tooMany` above `bulkLimit`;
  - writes one audit record per target with `bulkRequestId`.

  Create `tests/mocks/scenarios/mailboxes/bulk.ts`, registered in the index, with:
  - `admin-bulk`: 50 mailboxes on one page; a hook that deletes two elsewhere; one mailbox whose
    mail store fails;
  - `domain-admin-no-protocol`;
  - `capabilities-bulk-limit-20`.
- [ ] T096 [P] [US6] Write `tests/e2e/mailboxes/bulk.spec.ts`. It covers:
  - US6-AS1: select 50 of 50 and deactivate; "all 50 done", and the list shows them inactive;
  - US6-AS2: two are reported as not found and the rest as done;
  - US6-AS3: the next page or a new search clears the selection, with an announcement; so do the
    filters, sort and size (FR-054);
  - US6-AS4: no protocol action for a domain administrator without the flag;
  - US6-AS5: typing 3 confirms the bulk deletion; 2 removed and 1 failed with the translated
    reason, still listed and selected;
  - US6-AS6: at 360 px, "Select" enters selection mode, checkboxes are at least 44 × 44, and the
    bar stays at the bottom;
  - FR-054: "Select all" covers the current page; with `capabilities-bulk-limit-20` and size 25,
    "Select all" is disabled with the explanation;
  - FR-055: each action's confirmation names the action, its effect and the count; deletion also
    lists the addresses and the impact;
  - FR-056: the summary counts per outcome and per item, announced; outdated items stay selected;
    a whole-request refusal is one message with the selection kept; `route.abort()` gives "outcome
    unknown", the list is refetched, and exactly one bulk request was sent;
  - SC-007: 100 mailboxes at size 100 show 100 results whose counts equal the response's
    `summary`.
- [ ] T097 [P] [US6] Write `TM/bulk.spec.ts` (definitions, effects and gates),
  `TM/composables/useMailboxBulk.spec.ts` (data-model §7.4, with versions in the targets) and
  `TM/components/list/MailboxBulkActions.spec.ts` (the menu, the protocol radio group in the
  dialog, the typed count).
- [ ] T098 [P] [US6] Write `tests/smoke/mailbox-bulk.smoke.spec.ts`: two mailboxes created through
  the API are deactivated and then activated in bulk, with both results `done`. Teardown deletes
  them.

### Implementation for User Story 6

- [ ] T099 [US6] Implement `M/bulk.ts`, the bulk mutation in `M/api.ts` (data-model §3) and
  `M/composables/useMailboxBulk.ts`.
- [ ] T100 [US6] Implement `M/components/list/MailboxBulkActions.vue`. Add selection mode to
  `MailboxesPage.vue`, `MailboxCard.vue` and `MailboxTable.vue`, with `useBulkSelection` capped at
  `bulkLimit`, `BulkActionBar` on phones, and `BulkResultSummary`.
- [ ] T101 [US6] Add the `mailboxes.bulk.*` messages. Map `mailbox.toggle_all`.
  `npm run i18n:check` must pass.

**Checkpoint**: US1 to US6 work on their own.

---

## Phase 9: User Story 7 - Manage mailbox templates (Priority: P2)

**Goal**: The template list, create screen and detail with group saves for administrators,
read-only access for domain administrators, Default protection and deletion.

**Independent Test**: Against the mock, list, search, sort, create, change and delete templates as
an administrator, and open them as a domain administrator, on both viewports.

### Tests for User Story 7 (write first; must fail)

- [ ] T102 [US7] Extend `tests/mocks/handlers/mailbox-templates.ts` with `createMailboxTemplate`,
  `updateMailboxTemplate` and `deleteMailboxTemplate`:
  - the defaults for omitted values;
  - `mailbox-template-name-exists`, compared case-insensitively;
  - `mailbox-template-protected` for renaming or deleting Default;
  - `If-Match` with `412`;
  - `403 forbidden` for domain administrators;
  - `Location` and `ETag`.

  Create `tests/mocks/scenarios/mailboxes/templates.ts`, registered in the index, with
  `admin-templates` (Default, Small, Staff) and `domain-admin-templates`.
- [ ] T103 [P] [US7] Write `tests/e2e/mailboxes/templates.spec.ts`. It covers:
  - US7-AS1: cards and a table with the FR-058 columns;
  - US7-AS2: "Students" created unchanged has exactly the shown defaults, asserted on the request
    body;
  - US7-AS3: "staff" gives the error on the name field;
  - US7-AS4: Default's name is read-only and there is no delete, with the explanation;
  - US7-AS5: changing only the quota sends only `quota`;
  - US7-AS6: the delete confirmation says that mailboxes do not change;
  - US7-AS7: a domain administrator reads everything with no controls, and `/mailbox-templates/new`
    shows "no access";
  - FR-058: search, sort and paging in the address;
  - FR-061: an outdated group save keeps the input and marks the changes; a `412` on delete asks
    again;
  - the navigation entry exists for both roles;
  - administrators get the template's History link.
- [ ] T104 [P] [US7] Write the unit tests:
  - `TM/templates/list-state.spec.ts`;
  - `TM/templates/built-in-defaults.spec.ts`: typed as `MailboxTemplateCreateRequest`, with every
    value of research R14;
  - `TM/templates/useTemplateForm.spec.ts`: create sends every value, and a group save sends only
    its changes;
  - `TM/components/templates/TemplateCard.spec.ts`: the one-line protocol summary and the forced
    flags as text.
- [ ] T105 [P] [US7] Write `tests/smoke/mailbox-templates.smoke.spec.ts`: `admin` creates
  `smoke-<random>`, changes its quota, sees that Default cannot be deleted, and deletes the new
  template. `reseller` reads the list.

### Implementation for User Story 7

- [ ] T106 [US7] Implement the mutations in `M/templates-api.ts`, plus `M/templates/list-state.ts`,
  `M/templates/built-in-defaults.ts` and `M/templates/useTemplateForm.ts`.
- [ ] T107 [P] [US7] Implement `M/components/templates/TemplateCard.vue`, `TemplateTable.vue` and
  `TemplateValuesGroups.vue`. The groups reuse the shared fields of T043–T045.
- [ ] T108 [US7] Implement `M/pages/templates/MailboxTemplatesPage.vue`,
  `MailboxTemplateCreatePage.vue` (administrators only, otherwise `NoAccessState`) and
  `MailboxTemplateDetailPage.vue`:
  - `EditableSection` for each group;
  - Default's name read-only, and no delete for Default;
  - delete through `useConfirm` with `If-Match`;
  - `HistoryLink` for administrators.
- [ ] T109 [US7] Register the three template routes in `M/routes.ts`. Set the catalogue's
  `mailboxTemplates` entry to `available` in `src/app/navigation/catalogue.ts`.
- [ ] T110 [US7] Add the `mailboxTemplates.*` messages. Map `mailbox.mailbox_templates`,
  `mailbox.add_template`, `mailbox.template`, `success.template_added` and
  `success.template_modified`, and add the new key for the deletion announcement.
  `npm run i18n:check` must pass.

**Checkpoint**: US1 to US7 work on their own.

---

## Phase 10: User Story 8 - Rename a mailbox (Priority: P3)

**Goal**: The rename section: the backup acknowledgement, the explicit alias choice, the
confirmation, and every outcome, including the persistent report.

**Independent Test**: Against the mock, rename mailboxes on both viewports with and without keeping
the old address. Make the mock answer with success, conflict, "cannot be renamed", the alias limit,
a temporary failure, "incomplete" and "outcome unknown", and check each screen.

### Tests for User Story 8 (write first; must fail)

- [ ] T111 [US8] Implement `tests/mocks/handlers/mailbox-rename.ts`, registered in the index.
  `renameMailbox`:
  - `200 MailboxRenamed` with `Content-Location` and `ETag`; it moves the mailbox's data and creates
    the alias;
  - `409` `address-in-use` (each holder), `mailbox-not-renamable` and `domain-alias-limit-reached`
    (`count`, `limit`, `requested`);
  - `412`;
  - `422` `unchanged` or `invalidFormat`;
  - `503 temporary-failure` with `steps`, where `webmailRename` failed and the earlier steps were
    undone;
  - `500 mailbox-rename-incomplete` with `steps`;
  - `504 outcome-unknown` with `step` and `steps`;
  - an audit record.

  Create `tests/mocks/scenarios/mailboxes/rename.ts`, registered in the index, with
  `admin-rename`: `anna@example.org`; an inactive mailbox; a taken target; a domain at its alias
  limit; outcomes injected per mailbox.
- [ ] T112 [P] [US8] Write `tests/e2e/mailboxes/rename.spec.ts`. It covers:
  - US8-AS1: acknowledge, enter `anna.smith`, keep the alias and confirm; the new detail opens and
    "Mailbox was renamed from anna@example.org to anna.smith@example.org" is announced;
  - US8-AS2: the holder is named on the field, and nothing changes;
  - US8-AS3: an inactive mailbox: unavailable with the reason;
  - US8-AS4: the webmail step failed and was undone: "keeps the old address, try later";
  - US8-AS5: incomplete: the persistent report with both addresses and every step, advising the
    operator; it stays until dismissed, there is no navigation, and the list is refreshed;
  - US8-AS6: the alias limit suggests renaming without the alias;
  - FR-048: the form appears only after the acknowledgement;
  - FR-049: nothing preselected, no submit until answered, and a letter-case-only change refused;
  - `504`: the report names the unknown step;
  - `412`: a reload and a new confirmation.
- [ ] T113 [P] [US8] Write `TM/sections/RenameSection.spec.ts` (data-model §7.3) and
  `TM/components/dialogs/RenameReport.spec.ts` (every step and outcome translated, `role="alert"`,
  dismissal).
- [ ] T114 [P] [US8] Write `tests/smoke/mailbox-rename.smoke.spec.ts`: a mailbox created through the
  API is renamed with the alias kept, the new detail opens, and the old address no longer resolves
  as a mailbox. Teardown deletes the mailbox.

### Implementation for User Story 8

- [ ] T115 [US8] Implement the `renameMailbox` mutation in `M/api.ts`: remove the old detail, write
  the new one, invalidate the lists and domains, and refetch both addresses after `500` and `504`.
- [ ] T116 [US8] Implement `M/sections/RenameSection.vue` and
  `M/components/dialogs/RenameReport.vue`. Register the `mailbox-rename` route in `M/routes.ts`.
- [ ] T117 [US8] Add the `mailboxes.rename.*` messages. Map `edit.mailbox_rename`,
  `edit.mailbox_rename_warning`, `edit.mailbox_rename_agree`, `edit.mailbox_rename_title` and
  `success.mailbox_renamed`, with their Slovak values written in `src/i18n/messages/sk-sk.json`.
  `npm run i18n:check` must pass.

**Checkpoint**: US1 to US8 work on their own.

---

## Phase 11: User Story 9 - Review a mailbox's change history (Priority: P3)

**Goal**: The History entry for administrators opens UI 001's audit log filtered to the mailbox,
with labels for mailbox events and their details.

**Independent Test**: Against the mock, open the history of mailboxes with change, password, bulk,
rename and refused records, as an administrator and as a domain administrator, on both viewports.

### Tests for User Story 9 (write first; must fail)

- [ ] T118 [US9] Create `tests/mocks/scenarios/mailboxes/history.ts`, registered in the index, with
  `admin-history`. It holds audit records built with UI 001's audit factory:
  - a `mailboxUpdate` with `details.changes.quota` (old and new);
  - a `mailboxUpdate` with `details.passwordSet: true` and `preHashed: false`;
  - a refused `mailboxUpdate` with `failureReason: attributeNotPermitted`;
  - a bulk `mailboxUpdate` with `bulkRequestId`;
  - a `mailboxRename` with `previousAddress` and `newAddress`;
  - a `mailboxTemplateUpdate`.

  Every value is valid in the pinned contract.
- [ ] T119 [P] [US9] Write `tests/e2e/mailboxes/history.spec.ts`. It covers:
  - US9-AS1: from the detail, History opens the audit log filtered to the mailbox; both records,
    newest first; the quota change with its old and new value; "Password set" without a value;
  - US9-AS2: the refused record shows "refused" with the translated reason;
  - US9-AS3: a domain administrator has no History entry;
  - FR-064: the rename shows both addresses; bulk records show the bulk request; the template's
    History works too.
- [ ] T120 [P] [US9] Extend `tests/unit/features/audit-log/labels.spec.ts`: the mailbox event types,
  targets and failure reasons are translated, and the detail keys `changes`, `passwordSet`,
  `preHashed`, `previousAddress`, `newAddress`, `bulkRequestId` and `steps` get labels, with the
  raw key for any other.
- [ ] T121 [P] [US9] Write `tests/smoke/mailbox-history.smoke.spec.ts`: after changing a mailbox
  created through the API, its History shows a `mailboxUpdate` by `admin`.

### Implementation for User Story 9

- [ ] T122 [US9] Add the detail-key label lookup to `src/features/audit-log/labels.ts`, if UI 001's
  generic renderer lacks one, with the raw key as the fallback. Add the `auditLog.details.*`
  messages of research R17. The event, target and reason labels come from T004. Confirm that
  `MailboxSectionNav.vue` (T058) and `MailboxTemplateDetailPage.vue` (T108) render `HistoryLink`
  for administrators only. `npm run i18n:check` must pass.

**Checkpoint**: All user stories work on their own.

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: The entry points into UI 002, cross-story verification, budgets and release readiness.

- [ ] T123 Write `tests/e2e/mailboxes/entry-points.spec.ts` (FR-005, research R19). It covers:
  - UI 002's domain detail offers "Mailboxes" → `/mailboxes?domain=<name>`, filtered, and "Add
    mailbox" → the create screen with the domain preselected;
  - the domain list's mailbox usage links to the filtered list;
  - the "delete unavailable: N mailboxes" text links to the filtered list;
  - the home screen shortcuts include Mailboxes and Mailbox templates for administrators and domain
    administrators.

  The test must fail.
- [ ] T124 Add the entry points to UI 002's screens so that T123 passes. They go in the designated
  action areas of the domain detail page and the domain list in `src/features/domains/`, through
  `mailboxListLink` and `mailboxCreateLink` from `@/features/mailboxes`. Add the matching
  `domains.*` messages if UI 002 lacks them.
- [ ] T125 [P] Write and pass `tests/e2e/mailboxes/reflow-and-keyboard.spec.ts`:
  - every screen and dialog of this feature has no horizontal scroll at 320 px and at the
    equivalent of 400 % zoom;
  - the focused element is never hidden behind the sticky header or the bulk bar;
  - there is no transition under `prefers-reduced-motion`;
  - each user story's main path completes with the keyboard alone, with the focus visible
    throughout (SC-004, FR-070).
- [ ] T126 [P] Write and pass `tests/e2e/mailboxes/storage-and-secrets.spec.ts` (SC-009, FR-074).
  After the US2 and US3 flows with typed and generated passwords:
  - `localStorage` and `sessionStorage` hold only allowlisted keys;
  - no stored value, no visited URL, no `document.title`, no `history.state` and no console message
    contains either password;
  - with storage throwing, the list still works with the default columns.
- [ ] T127 Add the third collection `/ng/mailboxes` with `MOCK_DEFAULT_SCENARIO=admin-mailboxes-10k`
  to `scripts/run-lhci.mjs` and `lighthouserc.cjs` (research R20). Run
  `npm run build && npm run budget:check && npm run lhci`. Fix regressions until the initial JS is
  at most 204,800 bytes gzipped, and performance and accessibility are at least 0.9 for all three
  URLs.
- [ ] T128 [P] Run `npm run i18n:check`. Remove the unused keys it reports from
  `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, and list the new cs-cz and sk-sk strings of this
  feature for the owner's review (UI 001 owner question 4).
- [ ] T129 [P] Add the plan's six parity notes to the "Legacy Parity" tables in
  `specs/003-mailboxes/spec.md`.
- [ ] T130 Run `quickstart.md` Part B on a mid-range Android phone and an iPhone, with the
  production build served by `npm run preview:mock` on the local network. Record the SC-001,
  SC-002 and SC-003 timings and a VoiceOver and TalkBack pass of every user story in the
  "Validation log" of `specs/003-mailboxes/quickstart.md`.
- [ ] T131 Run `quickstart.md` Part C against the mailcow-rest-v2 dev stack once the API 003
  implementation is merged: `scripts/smoke/stack-up.sh`, `npm run test:smoke -- --grep mailbox`,
  `scripts/smoke/stack-down.sh`. Confirm that the generated passwords do not appear in the API's
  log.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Prerequisites**: UI 001 and UI 002 implemented. API 003's contract merged; its implementation
  merged for T001's preferred pin and for the smoke tasks.
- **Setup (Phase 1)**: T001 first. T002 → T003 → T004; T005 → T006; T007 → T008. T002, T005 and
  T007 can start in parallel after T001.
- **Foundational (Phase 2)** depends on Setup and **blocks every user story**. Within it:
  - T009 → T010 → T011 (mock base);
  - T012–T015 (block tests, [P]) → T016–T019;
  - T020 → T021;
  - T022–T027 (pure-module tests, [P]) → T028–T033 ([P]);
  - T034 → T035;
  - T036–T041 (component and composable tests, [P]) → T042–T047. T045 needs T035 for the domain
    query. T047 needs T035.
  - T048 after the components exist.
- **User stories (Phases 3–11)** depend on Foundational, and on each other as the table below shows.
- **Polish (Phase 12)** depends on every story it verifies. T123 and T124 also need UI 002's domain
  screens.

### User Story Dependencies

| Story | Priority | Depends on | Why |
|---|---|---|---|
| US1 | P1 | Foundational | MVP: the list, the detail layout, the section navigation. |
| US2 | P1 | US1 | The "Add mailbox" actions live on `MailboxesPage.vue`, the success opens the detail, and the moved US1-AS5 test needs the list. |
| US3 | P1 | US1 | The sections are child routes of the detail layout. |
| US4 | P1 | US1 | The row action and the delete route are on the list and detail. |
| US5 | P2 | US1 | Child routes of the detail layout. It is independent of US3, because `useMailboxSection` is foundational. |
| US6 | P2 | US1 | Selection mode extends the list components. |
| US7 | P2 | Foundational | The template screens share only the foundational fields. Its History link needs UI 002's `HistoryLink`. |
| US8 | P3 | US1 | A child route of the detail layout. |
| US9 | P3 | US1; US7 for the template History case | The History entry is in the section navigation (T058) and on the template detail (T108). |

### Files edited by several stories

Edits to these files must be serialised, even when stories run in parallel:

- `src/features/mailboxes/routes.ts`: US1, US2, US3, US4, US5, US7, US8;
- `src/features/mailboxes/api.ts`: Foundational (T035, T047), US2, US4, US6, US8;
- `src/features/mailboxes/index.ts`: T035, T045, US1, US2;
- `src/features/mailboxes/pages/MailboxesPage.vue`: US1, US2 (T068), US6 (T100);
- `src/features/mailboxes/components/list/{MailboxCard,MailboxTable,MailboxRowActions}.vue`: US1,
  US4, US6;
- `src/app/navigation/catalogue.ts`: T008, US1 (T059), US7 (T109);
- `tests/mocks/handlers/mailboxes-write.ts`: US2, US3, US5;
- `tests/mocks/handlers/mailboxes-read.ts`: T011, US5;
- `tests/mocks/handlers/index.ts` and `tests/mocks/scenarios/index.ts`: one registration per story;
- `src/i18n/messages/*.json` and `src/i18n/legacy-map.json`: every story's message task, run one
  after another.

Scenario modules (`tests/mocks/scenarios/mailboxes/<story>.ts`) and handler modules per operation
group keep the stories' mock work in separate files.

### Within Each User Story

- First the mock handlers and scenarios (test fixtures). Then the end-to-end, unit and smoke tests,
  which must fail. Then the implementation (api → composables → components → pages → routes). Then
  the messages in all three locales.

### Parallel Opportunities

- **Setup**: T002, T005 and T007 after T001.
- **Foundational**: T009, T012–T015, T020 and T022–T027 in parallel. Then T028–T033 and T036–T041
  in parallel. Then T042–T046 in parallel.
- **Stories**: after US1, US2, US3, US4, US5, US6 and US8 can be staffed in parallel, observing the
  serialised files above. US7 can start right after Foundational.
- **Within each story**: every task marked [P].

---

## Parallel Example: User Story 2

```bash
# After T061 (create mock and scenarios), write all US2 tests together:
Task: "T062 tests/e2e/mailboxes/create.spec.ts"
Task: "T063 tests/unit/features/mailboxes/{create-request,composables/useMailboxCreateForm,composables/useTemplateApplication,pages/MailboxCreatePage}.spec.ts"
Task: "T064 tests/smoke/mailbox-create.smoke.spec.ts"

# Then:
Task: "T065 M/create-request.ts + createMailbox mutation"
Task: "T066 M/composables/{useTemplateApplication,useMailboxCreateForm}.ts"
# T067, then T068 (edits routes.ts and MailboxesPage.vue), then T069 (messages).
```

## Parallel Example: Foundational

```bash
Task: "T022 TM/validation.spec.ts"    Task: "T023 TM/acl.spec.ts"       Task: "T024 TM/quota.spec.ts"
Task: "T025 TM/problems.spec.ts"      Task: "T026 TM/password/*.spec.ts" Task: "T027 TM/auth-source.spec.ts"
# then, each in its own file:
Task: "T028 M/validation.ts"  Task: "T029 M/acl.ts"  Task: "T030 M/quota.ts"
Task: "T031 M/problems.ts"    Task: "T032 M/password/*.ts"  Task: "T033 M/auth-source.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup), then Phase 2 (Foundational): CI green on the existing features.
2. Phase 3 (US1): a read-only mailbox browser with filters and the detail overview.
3. **Stop and validate**: run `npm run test:e2e -- --grep US1` on all projects, and the US1 rows of
   quickstart Part B.
4. Operators can now look up mailboxes in the app, while they still change them in the classic
   interface.

### Incremental Delivery

1. Foundation, then US1 (MVP).
2. US2 (create), US3 (edit) and US4 (delete): the daily provisioning cycle is complete.
3. US5 (permissions, tags, attributes) and US6 (bulk).
4. US7 (templates).
5. US8 (rename), then US9 (history).
6. Polish: the entry points from the domain screens, reflow and keyboard, the secrets scan, budgets,
   translations review, parity notes, phone validation and the smoke run.

### Parallel Team Strategy

After Foundational:
- Developer A: US1, then US2.
- Developer B: US7, then US3 (after US1).
- Developer C: US4 and US6 (after US1).
- Developer D: US5, US8 and US9 (after US1).

The shared files listed above are edited one at a time.

---

## Notes

- [P] tasks touch different files and have no dependency on an incomplete task.
- [USn] labels map tasks to the spec's user stories, and test titles carry the spec IDs for
  traceability.
- Verify that each test fails before implementing (constitution VI).
- Commit after each task or logical group, directly to `main`, with short imperative subjects.
- Never add:
  - a hand-written API type;
  - a `v-html`, an inline style or an inline script;
  - a storage key outside the allowlist;
  - a password in a cache, store, address, title or log;
  - an automatic request while idle;
  - a hard-coded server limit.
