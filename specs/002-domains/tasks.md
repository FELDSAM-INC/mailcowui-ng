---
description: "Task list for UI feature 002: domains"
---

# Tasks: Domains

**Input**: Design documents from `specs/002-domains/`:
- [plan.md](./plan.md)
- [spec.md](./spec.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/README.md](./contracts/README.md)
- [quickstart.md](./quickstart.md)

**Prerequisites**:

- UI feature 001 is implemented and its gates pass (`specs/001-sign-in-app-shell/tasks.md`
  complete). This feature extends its shell, catalogue, router, mock API, fixtures, shared
  primitives, i18n tooling and audit log.
- mailcow-rest-v2 feature 002 is implemented and its quickstart Part A passes (research D1).
  T001 pins the contract to that implementation.

**Tests**: Mandatory (constitution VI, test-first). In every phase, tests are written first and must
fail before the implementation tasks that follow them. Every end-to-end spec:

- runs on the `mobile-chromium` (360 px), `mobile-webkit` and `desktop-chromium` projects;
- calls `expectAccessible` (axe, WCAG 2.2 AA, both themes) on every screen, state and dialog it
  reaches;
- calls `expectNoHorizontalScroll` and, on the mobile projects, `expectTouchTargets`;
- fails on any CSP or mock contract violation, through UI 001's fixtures;
- names its spec reference in the test title (`US2-AS3 …`, `FR-046 …`, `Edge: …`).

Smoke specs are tagged `@domains`, or `@domain-templates` for the template spec.

**Organization**: Tasks are grouped by user story (spec priorities P1 to P3), so that each story can
be implemented and tested on its own once the foundation is in place.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task belongs to (US1 to US8)
- Paths are relative to the repository root `mailcowui-ng/`

---

## Phase 1: Setup (Contract Bump and Tooling)

**Purpose**: Pin the contract to the API 002 implementation, adapt UI 001's translation tooling to
it, and keep every UI 001 gate green (research D1, D2, D27).

- [ ] T001 Pin the contract (research D1, [contracts/README.md](./contracts/README.md)):
  1. Confirm the prerequisites. UI 001's `npm run lint`, `typecheck`, `test:unit` and `test:e2e`
     pass. mailcow-rest-v2 feature 002 is implemented and its quickstart Part A passes at the
     chosen ref: a release tag that ships it, or else the first commit at which this holds.
  2. Run `scripts/contract/bump.sh <ref>`. This produces `contract/openapi.yaml`,
     `contract/openapi.json`, `contract/VERSION.json` and `src/api/generated/schema.ts`.
  3. Run the domain contract diff of `contracts/README.md` between
     `32079252d55797d3da4e58ae661e9fb91c51c6f9` and `<ref>`. If it is not empty, stop and review
     the difference against plan.md, research.md and data-model.md before continuing.
  4. Confirm that the generated file exports `knownProblemTypeValues`, `bulkItemOutcomeValues` and
     the root types `Domain`, `DomainCapabilities`, `DomainDeletionPreview`, `DomainFooter`,
     `DomainTemplate` and `BulkResult`.
  5. Record the ref, commit and bundle sha256 in the "Pin at implementation" row of
     `specs/002-domains/contracts/README.md`. Note there, and in
     `specs/001-sign-in-app-shell/contracts/README.md`, that UI 001's API gap 5 is closed.
- [ ] T002 Write the tests for the tooling changes in `tests/unit/scripts/i18n-tools.spec.ts`
  (research D2, D27). They run against fixture message sets, a fixture `coverage.json` and fixture
  enumeration arrays, and must fail. Cover:
  - **Coverage manifest**:
    - a value listed under `AuditEventType`, `AuditTarget.type`, `AuditFailureReason`,
      `AuthMethod`, `ValidationRuleCode` or `problemTypes` with no key in one locale is an error;
    - a listed value missing from the pinned enumeration array, or from the bundle's problem names
      and `knownProblemTypeValues`, is an error;
    - a contract value that is not listed is a warning only;
    - the fully required enumerations (`BulkItemOutcome`, the five `DomainCreationReport` step
      enumerations, `DomainRateLimit.frame`, `DomainSort`, `DomainTemplateSort`, and UI 001's
      `AuditOutcome`, `Role`, `PendingAction`, `SecondFactorType`, `ApiKeyStatus`,
      `ApiKeyAccessLevel`, `Theme` and the announcement types) still need a key for every value.
  - **`stripMarkup`**:
    - an object entry `{ "from": "edit.gal_info", "stripMarkup": true }` removes tags, turns
      `<br>` into a space, decodes `&lt; &gt; &amp; &quot; &#39;`, strips a leading `↪ ` and
      collapses whitespace;
    - a result that still contains `<` or `>` is refused;
    - a plain string entry whose legacy value contains HTML is still refused.
- [ ] T003 Implement the coverage manifest in `scripts/i18n/lib.mjs` and `scripts/i18n/check.mjs`,
  so that the manifest part of T002 passes. Create `src/i18n/coverage.json` with the six lists of
  data-model §8, seeded with UI 001's values only:
  - `ValidationRuleCode`: `required`, `invalidType`, `tooShort`, `tooLong`, `tooMany`,
    `outOfRange`, `notInList`, `invalidFormat`, `mustBeInFuture`, `notFound`, `notEligible`;
  - `AuditEventType`: `signIn`, `signOut`, `preferencesUpdate`, `passkeyRegistration`,
    `passkeyRename`, `passkeyRemoval`, `apiKeyCreation`, `apiKeyRevocation`;
  - `AuditFailureReason`: `invalidCredentials`, `accountInactive`, `externalIdentitySource`,
    `unknownPasskey`, `passkeyInactive`, `roleMismatch`, `passkeyVerificationFailed`,
    `challengeExpired`, `secondFactorFailed`, `secondFactorUnavailable`,
    `verificationUnavailable`, `throttled`, `registrationFailed`;
  - `AuthMethod`: `password`, `passwordAndSecondFactor`, `passkey`, `apiKey`;
  - `AuditTarget.type`: `apiKey`, `passkey`, `preferences`, `session`;
  - `problemTypes`: the 20 problem names of API 001.

  The stories append the domain values. `npm run i18n:check` must pass, with the other features'
  values reported as warnings.
- [ ] T004 Implement `stripMarkup` in `scripts/i18n/lib.mjs` and `scripts/i18n/import-legacy.mjs`,
  accepting the object form of a `src/i18n/legacy-map.json` entry, so that the rest of T002 passes.
- [ ] T005 Bring UI 001 in line with the new pin:
  1. Fix every `npm run typecheck` error the regenerated types cause, for example an exhaustive
     `switch` over `Session.authMethod`, which gained the values `ssoToken`, `singleSignOn`,
     `directoryPassword`, `directoryPasswordAndSecondFactor`, `providerPassword` and
     `providerPasswordAndSecondFactor`. An unknown value shows the generic label (UI 001 FR-074).
  2. Make sure no UI 001 mock factory produces data that the new schemas reject.
  3. Run `npm run test:unit`, `npm run test:e2e` and `npm run i18n:check`. All UI 001 tests must
     pass with zero contract violations.

**Checkpoint**: The new contract is pinned, UI 001 is green on it, and the translation gate scopes
the shared enumerations through `src/i18n/coverage.json`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Everything the stories share:

- the domain and template mock API;
- the shared primitives UI 001 R20 reserved for this feature, plus `BulkActionBar` and
  `useLeaveGuard`;
- the router, layout and i18n extensions;
- the feature's pure modules, data layer and form fields.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Mock API and test infrastructure

- [ ] T006 [P] Create the factories (research D28):
  - `tests/mocks/factories/domain.ts`:
    - stored settings plus `usage`;
    - `name` and `unicodeName` through `node:url` `domainToASCII` and `domainToUnicode`;
    - quotas as whole MiB in bytes;
    - tags sorted ignoring letter case;
    - `domainAdmins`, kept in the state and emitted only for administrators;
    - an `etag` computed as a quoted hash of the stored settings and tags only, never `usage`, so
      it changes exactly when they change.
  - `tests/mocks/factories/domain-template.ts`: with `isDefault` and `etag`.
  - `tests/mocks/factories/domain-footer.ts`: an absent footer and a stored empty one share the
    same `etag`.
  - Extend `tests/mocks/factories/audit-event.ts` with the records of `domainCreation`,
    `domainUpdate`, `domainDeletion`, `domainFooterUpdate`, `domainTemplateCreation`,
    `domainTemplateUpdate` and `domainTemplateDeletion`, including failures with each of
    `attributeNotPermitted`, `versionOutdated`, `validationFailed`, `conflict` and
    `temporaryFailure`.
- [ ] T007 Extend `tests/mocks/scenarios/state.ts` with:
  - domains, alias domain names, templates and footers;
  - domain administrator assignments, mailboxes and resources per domain (for usage and previews);
  - the capabilities: `groupwareEnabled`, `taggingLimit`, `maxTagLength`, `maxDescriptionLength`,
    `footerTextMaxBytes`, `bulkLimit`, `defaultPageSize`, `maxPageSize`, `quotaUnit` and `dkim`;
  - the server host name;
  - the creation report outcome per step;
  - failure injection by operation and by domain name (for example `temporary-failure` for named
    bulk targets);
  - a response delay per operation.

  Create `tests/mocks/scenarios/domains-base.ts` with `domains-60` (an administrator with 60
  domains, defined fully in T024) and register it in `tests/mocks/scenarios/index.ts`. Each story
  adds its scenarios in its own module `tests/mocks/scenarios/domains-<story>.ts`, registered in
  `index.ts`.
- [ ] T008 Write `tests/unit/mocks/domain-handlers.spec.ts` against the handlers of T009 and T010,
  through `msw/node`. Every response must pass the validator, and each documented behaviour must
  hold:
  - **List**:
    - `q` matches the ASCII name, the readable name, the description and tags;
    - `active` and `backupMx` filter;
    - repeated `tag` matches any tag, as whole tags ignoring case;
    - every one of the 15 sort keys sorts, with ties broken by name;
    - paging returns `meta.total`;
    - a domain administrator sees only their domains, never `domainAdmins`.
  - **Single reads**: `GET /domains/MÜNCHEN.de` returns `xn--mnchen-3ya.de`; an out-of-scope or
    alias domain name gives `404`.
  - **`createDomain`**:
    - template pre-fill, and the built-in values without a Default template;
    - relay normalisation;
    - `invalidFormat` (`format: domainName`), `reserved` (the host name) and `notFound` on
      `templateId`;
    - `notMultipleOf` with `factor`, `mustNotExceed` with `field` and `value`, `outOfRange`, and
      `tooMany` on `tags` with `max`;
    - `409 domain-exists` for a domain or alias domain name in any spelling;
    - `503 temporary-failure` with `Retry-After`;
    - `201` with `Location`, `ETag` and the scenario's `creationReport`.
  - **`updateDomain`**:
    - merge patch;
    - `If-Match` mismatch gives `412`;
    - `belowInUse` with `inUse` for the four limits;
    - `403 attribute-not-permitted` with `attributes` for a domain administrator;
    - `immutable`;
    - an empty description becomes the name;
    - relay normalisation;
    - the tag limit (a set above the limit can still shrink);
    - a new `etag`.
  - **`deleteDomain`**: `If-Match`, `409 domain-not-empty` with `mailboxes` and `resources`, `404`,
    `503`.
  - **`previewDomainDeletion`**: blockers with up to 100 addresses, alias domains, aliases, footer,
    `domainAdminsToDelete`, `dkimKeyKept`, `etag`.
  - **Footer**: an empty footer; `notFound` at `excludedAddresses.<i>` and
    `excludedAliasDomains.<i>`; `tooLong` with `unit: bytes`; `If-Match`.
  - **Capabilities**: `dkim` only for administrators.
  - **Tags**: `listDomainTags` respects scope, `q` and both sorts.
  - **`applyDomainBulkAction`**:
    - outcomes `done` (with a new `version`), `notFound`, `refused` (`domain-not-empty`),
      `outdated` (a target `version` without quotes that differs), and `failed` (injected
      `temporary-failure`);
    - targets without `version` are not checked;
    - a name given twice is reported once;
    - 101 targets give `422 tooMany` on `targets` with `max: 100`;
    - a domain administrator gets `403`.
  - **Templates**: list, search and sort; create with the legacy defaults;
    `409 domain-template-name-exists` ignoring case; `409 domain-template-protected` for renaming
    or deleting Default; `If-Match`.

  The test must fail.
- [ ] T009 Implement `tests/mocks/handlers/domains.ts` with `openapi-msw`, wrapped by UI 001's
  validator: `listDomains`, `createDomain`, `applyDomainBulkAction`, `getDomain`, `updateDomain`,
  `deleteDomain`, `previewDomainDeletion`, `getDomainFooter`, `replaceDomainFooter`,
  `getDomainsCapabilities` and `listDomainTags`, as T008 specifies.
- [ ] T010 Implement `tests/mocks/handlers/domain-templates.ts`: `listDomainTemplates`,
  `createDomainTemplate`, `getDomainTemplate`, `updateDomainTemplate` and `deleteDomainTemplate`.
  Register both handler files in `tests/mocks/handlers/index.ts`. T008 must pass.
- [ ] T011 Extend `tests/mocks/server.ts` and `tests/e2e/fixtures/mock-api.ts` (research D28).
  - `PATCH /__mock/scenarios/:id` gains:
    - `domains`, `templates` and `footers` mutations (`set`, `add`, `remove`), which change stored
      values and so their version tags;
    - `capabilities` overrides;
    - `failures` by operation and domain name;
    - `delays` by operation.
  - Fixture helpers: `mockApi.mutateDomain(name, changes)`, `mockApi.removeDomain(name)`,
    `mockApi.addMailbox(domain)`, `mockApi.mutateTemplate(id, changes)`,
    `mockApi.mutateFooter(name, changes)`, `mockApi.setCapabilities(changes)`,
    `mockApi.failNext(operationId, problem, { domain })` and `mockApi.delay(operationId, ms)`.
- [ ] T012 [P] Create `tests/smoke/fixtures/domains-api.ts`, used only by smoke tests to prepare and
  clean up through the real API with the page's session and a fresh `X-CSRF-Token`:
  `createDomain(page, name, body)`, `deleteDomain(page, name)`, `createTemplate(page, name)`,
  `deleteTemplate(page, id)` and `uniqueName(prefix)`. The app under test never uses it.

### Tests for the shared extensions (write first; must fail)

- [ ] T013 [P] Write `tests/unit/shared/composables/useBulkSelection.spec.ts` (research D22, data
  model §2). It covers:
  - entering and leaving selection mode;
  - `toggle`, `selectPage` and `clear`;
  - `keep(ids)` after a run keeps only the given IDs;
  - the selection clears through `useListState`'s `onReset` on page, search, filter, sort and size
    changes;
  - a selection larger than the bulk limit reports `overLimit`.
- [ ] T014 [P] Write `tests/unit/shared/components/bulk-components.spec.ts` for:
  - `BulkActionBar.vue`: it names the number selected, lists the actions given, and its controls
    are at least 44 × 44 px (class check) and keyboard operable;
  - `BulkResultSummary.vue`: one row per `BulkRow` with a translated label for each of `done`,
    `notFound`, `refused`, `outdated`, `failed`, `skipped`, `unknown` and `notProcessed`; the
    problem message through `ProblemMessage`; counts per outcome announced politely; outcome shown
    by text and icon, not colour alone (FR-076); a retry action emitted only when retryable rows
    exist.
- [ ] T015 [P] Write `tests/unit/shared/components/EditableSection.spec.ts` (research D11). It
  covers:
  - an Edit button only when `editable`;
  - read-only values rendered as text, never as disabled inputs (FR-029);
  - `edit` and `close` events driven by the parent;
  - below `md` (fake `matchMedia`), the open section renders full width with a sticky action bar
    holding Save and Cancel, and its heading receives focus (FR-069, FR-075);
  - from `md` up, in place;
  - other sections' Edit buttons disabled, with a reason, while one is open;
  - inline status messages that stay until the next action (FR-067);
  - the outdated notice listing each changed field with its new saved value, plus the
    "Save again" and "Discard my changes" actions (FR-037).
- [ ] T016 [P] Extend `tests/unit/shared/composables/useVersionedSave.spec.ts`:
  - `changedSince(base, latest, fields)` returns the fields that differ between base and latest
    with their saved values, comparing tags as sets that ignore letter case and quotas as numbers;
  - "Save again" uses the latest `etag`;
  - "Discard" returns the latest values;
  - nothing is sent automatically after a `412`.
- [ ] T017 [P] Write `tests/unit/shared/components/confirm-extended.spec.ts` for the `useConfirm`
  and `ConfirmDialog.vue` extensions (UI 001 R20):
  - `requireTyped: { accepted: string[], ignoreCase: true, labelKey }` keeps the confirm button
    disabled until the typed value matches one accepted value;
  - `content: { component, props }` renders inside the dialog;
  - the dialog is labelled, traps focus, closes with Escape and returns focus (FR-074);
  - the typed field has `autocapitalize="none"` and `autocomplete="off"`.
- [ ] T018 [P] Write `tests/unit/shared/composables/useLeaveGuard.spec.ts` (research D21):
  - while `shouldGuard` is true, a route leave and a path change ask through `useConfirm`, and a
    `beforeunload` listener is registered;
  - query-only changes on the same path are not intercepted;
  - nothing is asked when `shouldGuard` is false;
  - the listener is removed on unmount.
- [ ] T019 [P] Write `tests/unit/shared/components/HistoryLink.spec.ts`: it renders a link to the
  `audit-log` route with `targetType` and `targetId` in the query, omits `targetType` when not
  given, and has a translated label.
- [ ] T020 [P] Write the tests for the core extensions:
  - `tests/unit/i18n/format-bytes.spec.ts`:
    - `formatBytes(10737418240, { exact: true })` gives "10 GiB";
    - `formatBytes(3145728000, { exact: true })` gives "3,000 MiB" in en-gb and "3 000 MiB" in
      cs-cz;
    - `formatBytes(10200547328)` gives "9.5 GiB";
    - TiB is used;
    - numbers are locale-formatted (FR-016).
  - `tests/unit/i18n/problems-domains.spec.ts`:
    - with a field-kind map, `inUse`, `value`, `min` and `max` of a size field are formatted as
      sizes;
    - `tooLong` with `unit: bytes` formats `max` as a size;
    - `mustNotExceed` renders `field` as the form's label;
    - `notMultipleOf` formats `factor` as a size;
    - `belowInUse` and `reserved` have messages;
    - `validation.format.domainName`, `dkimSelector` and `email` exist;
    - `problem.domain-not-empty` interpolates `mailboxes` and `resources`;
    - `problem.attribute-not-permitted` lists translated attribute labels;
    - an unknown code is still `validation.invalid` (FR-064, FR-065).
  - `tests/unit/app/router/scroll-and-roles.spec.ts`:
    - `scrollBehavior` returns `savedPosition` on history navigation and the top otherwise;
    - `focus.ts` focuses the `<h1>` with `preventScroll: true` when a position is restored
      (FR-013);
    - `ShellLayout.vue` renders `NoAccessState` without mounting the route component when
      `meta.roles` excludes the identity's role (research D4).
  - `tests/unit/app/states/not-found-and-pagination.spec.ts`:
    - `NotFoundPage.vue` with a `backTo` route and label renders that link instead of the home
      link (FR-004);
    - `PaginationBar.vue` offers first, previous, next and last page actions and "page n of m"
      (FR-005).
- [ ] T021 [P] Write `tests/unit/shared/validation/limits.spec.ts` additions: the new constants for
  the domain list's `tag` filter, at most 100 items of 1–255 characters, equal the `maxItems`,
  `minLength` and `maxLength` of the `tag` parameter of `listDomains` in `contract/openapi.json`.

### Tests for the feature core (write first; must fail)

- [ ] T022 [P] Write the unit tests of the pure modules in `tests/unit/features/domains/`:
  - `domain-name.spec.ts` (research D15):
    - `toAsciiDomain(' MÜNCHEN.de ')` is `xn--mnchen-3ya.de`;
    - a single label is valid;
    - 254 characters, a 64-character label, a leading or trailing hyphen in a label, `_`, an empty
      label and a space are invalid;
    - `matchesTypedName` accepts `münchen.de`, `MÜNCHEN.DE` and `xn--mnchen-3ya.de` and rejects
      others.
  - `quota.spec.ts` (research D12):
    - largest exact unit;
    - `parseQuota` accepts `1.5` GiB and `1,5` GiB as 1,610,612,736 bytes;
    - it rejects `1.0001` GiB (`notWholeUnit`), `0` (`belowMinimum`), grouping characters and
      letters (`invalidNumber`), and more than 9,007,199,254,740,992 bytes (`aboveMaximum`).
  - `relay.spec.ts`: the four rules of FR-033 and `relayBadge` for each combination (research D14).
  - `tag-set.spec.ts`: trim, empty ignored, a tag longer than the maximum refused, case-only
    duplicates kept once with the first spelling, comma-separated input split, and the limit rule
    that lets an over-limit set shrink (research D13).
  - `usage.spec.ts`: `ok`, `nearlyFull` at 90 % and at 100 %, `over` above, and 0 of 0 counts as
    `nearlyFull` (research D10).
  - `permissions.spec.ts`: a table over administrator, domain administrator with `domainDesc` and
    domain administrator without it, asserting every field of `domainPermissions` (FR-002, SC-005).
  - `patch.spec.ts`: only changed members; tags sent whole when the set changed, nothing when only
    the order or letter case differs; quotas compared in bytes; read-only members never included
    (FR-030).
  - `bulk.spec.ts`:
    - `toBulkTargets` maps each entry to `{ id: name, version }` with the `etag`'s surrounding
      quotes removed;
    - `partitionDeletable` sets aside domains with `usage.mailboxes` or `usage.resources` above 0
      as `skipped`;
    - `rowsFromBulkResult` keeps request order and labels by readable name;
    - a network problem gives `unknown` for every target (research D22).
  - `creation-report.spec.ts`: every outcome of the five step enumerations maps to `done`, `info`
    or `warning` as in data-model §2, in the step order given there.
  - `defaults.spec.ts`: every value of `defaults.ts` (10 mailboxes, 400 aliases, 3,072 MiB,
    10,240 MiB, 10,240 MiB, active, Global Address List on, no relay options, no tags, no rate
    limit) occurs in the descriptions of `DomainTemplateCreateRequest` and `DomainCreateRequest` in
    `contract/openapi.json` (research D18).
- [ ] T023 [P] Write `tests/unit/features/domains/api.spec.ts`, using `msw/node` and a fresh
  `QueryClient`. It checks the query keys and the invalidation table of data-model §3:
  - `getDomain` takes `initialData` from a cached list entry;
  - `updateDomain` writes the detail, replaces the entry in every cached list and invalidates the
    lists, and the tags only when tags changed;
  - `createDomain` writes the detail without `creationReport` and the report under
    `['domains','creation-report',name]`;
  - `deleteDomain` removes the detail, footer and preview caches;
  - every domain and template mutation invalidates `['audit-events']`;
  - `previewDomainDeletion` is never served from the cache;
  - `getDomainsCapabilities` has a `staleTime` of 5 minutes;
  - a `403 attribute-not-permitted` invalidates `['identity']`.
- [ ] T024 [P] Write `tests/unit/features/domains/fields.spec.ts` for the shared form fields
  (research D12 to D16, D19):
  - **`QuotaField`**: number and unit, `inputmode="decimal"`, shows a stored value in the largest
    exact unit, emits bytes, and shows usage and an error.
  - **`LimitField`**: `inputmode="numeric"`, `pattern="[0-9]*"`, 0–2,147,483,647, and the "n in
    use" hint.
  - **`RelayOptionsField`**: the cascade of FR-033, a polite announcement of each automatic
    change, and the legacy explanations.
  - **`TagSetInput`**:
    - Enter, comma and the Add button add a tag; each remove button is labelled with its tag;
    - suggestions appear in a list without `ComboboxViewport`;
    - `autocapitalize="none"`, `autocorrect="off"` and `spellcheck="false"`;
    - per-chip errors by index;
    - full keyboard operation (FR-039, FR-058, FR-070, FR-071).
  - **`RateLimitField`**: "none" or a value of 1–2,147,483,647 with the legacy "msgs / hour" frame
    labels (FR-022).
  - **`DkimFields`**: the switch; when the switch is off, the selector and size are hidden; the
    selector pattern `^[A-Za-z0-9._-]*$` with at most 255 characters; the empty-selector hint names
    `capabilities.dkim.defaultSelector`; the sizes come from `allowedKeySizes` (FR-021).
  - **`DomainNameField`**: `inputmode="url"`, no auto-capitalisation or auto-correction, and the
    FR-020 check.
  - **`TemplateSelect`**: a native `<select>` with Default preselected and a "no template" state.

### Implementation of the shared extensions and the core

- [ ] T025 Implement `src/shared/composables/useBulkSelection.ts`, `src/shared/components/BulkActionBar.vue`
  and `src/shared/components/BulkResultSummary.vue` with the `BulkRow` model of data-model §2, so
  that T013 and T014 pass. Add the `bulk.*` keys to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`:
  one label per `BulkItemOutcome`, plus `skipped`, `unknown`, `notProcessed`, the selection bar,
  `bulk.tooMany` and `bulk.confirm.typeCount`.
- [ ] T026 Implement `src/shared/components/EditableSection.vue` and the `changedSince` extension
  of `src/shared/composables/useVersionedSave.ts`, so that T015 and T016 pass. Add the
  `sections.*` keys (edit, save, cancel, save again, discard, changed elsewhere, "now saved as")
  in all three locales.
- [ ] T027 Extend `src/shared/composables/useConfirm.ts` and `src/shared/components/ConfirmDialog.vue`
  with `requireTyped` and `content`, so that T017 passes.
- [ ] T028 Implement `src/shared/composables/useLeaveGuard.ts` and
  `src/shared/components/HistoryLink.vue`, so that T018 and T019 pass. Add the `history.link` and
  `leaveGuard.*` messages in all three locales.
- [ ] T029 Implement the core extensions, so that T020 and T021 pass:
  - `formatBytes` in `src/i18n/format.ts`;
  - the field-kind parameter formatting, the new rule codes and formats, and the
    problem-to-field mapping in `src/i18n/problems.ts` and `src/shared/composables/useProblemForm.ts`
    (research D25);
  - `scrollBehavior` in `src/app/router/index.ts`, and `preventScroll` in `src/app/router/focus.ts`;
  - the `meta.roles` check in `src/app/layouts/ShellLayout.vue`;
  - the `backTo` prop of `src/app/states/NotFoundPage.vue`;
  - first and last page actions and "page n of m" in `src/shared/components/PaginationBar.vue`,
    if missing;
  - the tag filter constants in `src/shared/validation/limits.ts`.

  Add the new `validation.*` and `problem.*` messages of data-model §8 in all three locales.
  Append the five rule codes and six problem types of data-model §8 to `src/i18n/coverage.json`.
- [ ] T030 Implement the pure modules, so that T022 passes:
  - `src/features/domains/domain-name.ts`, `quota.ts`, `relay.ts`, `tag-set.ts`, `usage.ts`,
    `permissions.ts`, `patch.ts`, `bulk.ts` and `creation-report.ts`;
  - `defaults.ts`, each value with a comment naming the contract description it comes from.
- [ ] T031 Implement the data layer, so that T023 passes:
  - the `domains` and `domain-templates` key trees in `src/api/query/keys.ts`;
  - `src/features/domains/api.ts`: the list, detail, footer, preview, tags, create, update,
    delete, bulk and footer replace queries and mutations, with the cache rules of data-model §3;
  - `src/features/domains/templates-api.ts`: the template queries and mutations;
  - `src/features/domains/capabilities.ts` (`useDomainCapabilities`);
  - `src/features/domains/composables/useTagSuggestions.ts` (`listDomainTags` with a 300 ms
    debounce and `limit` 25).

  Create `src/features/domains/index.ts` and an empty `src/features/domains/routes.ts`, registered
  in `src/app/router/routes.ts`.
- [ ] T032 Implement the form fields in `src/features/domains/components/fields/`, so that T024
  passes: `QuotaField.vue`, `LimitField.vue`, `RelayOptionsField.vue`, `TagSetInput.vue` (Reka
  `Combobox` without `ComboboxViewport`), `RateLimitField.vue`, `DkimFields.vue`,
  `DomainNameField.vue` and `TemplateSelect.vue`. Add their `domains.fields.*` and `domains.help.*`
  messages, with the legacy-map entries of data-model §8 for the field labels, the relay and Global
  Address List explanations (`stripMarkup`) and `ratelimit.*`. Run `npm run i18n:import`.
  `npm run i18n:check` must pass.

**Checkpoint**: The foundation is ready. The domain mock API answers every operation with
contract-valid data, and the shared primitives, data layer and fields are tested. The `domains`
catalogue entry is still a placeholder.

---

## Phase 3: User Story 1 - Find and inspect domains (Priority: P1) 🎯 MVP

**Goal**: The domain list (search, filters, sort, pages, cards and table, usage pairs, states) and
the read-only domain page, for administrators and domain administrators.

**Independent Test**: Against `domains-60` and `domain-admin-two-of-ten`, at 360 px and on desktop,
use each search, filter, sort and paging option, open several domains, and compare every value
shown with the mock data.

### Tests for User Story 1 (write first; must fail)

- [ ] T033 [US1] Add the US1 scenarios in `tests/mocks/scenarios/domains-list.ts`, registered in
  `tests/mocks/scenarios/index.ts`, and complete `domains-60` in
  `tests/mocks/scenarios/domains-base.ts`.
  - **`domains-60`**: 60 domains covering:
    - every combination of active and relay states;
    - the tags `customer-a`, `customer-b` and up to 12 tags on one domain;
    - `xn--mnchen-3ya.de`;
    - a 253-character name;
    - a domain with 8 of 10 mailboxes, 380 of 400 aliases and 9.5 of 10 GiB allocated;
    - one with usage above a limit (12 of 10);
    - one with zero limits;
    - one never modified;
    - one with a relayhost whose host name is `null`;
    - one with a rate limit;
    - one with a footer;
    - domain administrators.
  - **`domain-admin-two-of-ten`**: the reseller manages 2 of 10 domains.
  - **`domains-empty`** (administrator, no domains).
  - **`domains-list-error`**: an injected `500` on `listDomains`.

  UI 001's `domain-admin-no-domains` is reused.
- [ ] T034 [P] [US1] Write `tests/e2e/domains/list.spec.ts`. It covers:
  - US1-AS1: 25 of 60 by name, the total of 60, and a way to the other pages;
  - US1-AS2: cards at 360 px with every FR-006 value and no horizontal scroll;
  - FR-007: the table on desktop with the extra columns, and every remaining legacy value
    reachable by expanding an entry on both viewports;
  - US1-AS3: the search "customer" finds both domains; tapping `customer-a` on a card filters by
    it, and the filter shows as active with its count;
  - FR-010: the active and relay filters; tag suggestions from the distinct tag list; "clear all";
  - US1-AS4: `münchen.de` shown above `xn--mnchen-3ya.de`, and both forms found by the search;
  - US1-AS5: storage descending on page 2, then a domain and Back, restores the page, sort, filters,
    search and scroll position with no loading placeholders; a reload and a fresh page on the same
    address show the same view;
  - US1-AS6 (list part): the reseller sees exactly 2 domains, the total of 2, and no domain
    administrator list, create, delete or bulk action;
  - US1-AS7: no match shows the message and clears the search and filters;
  - US1-AS8: 8 of 10, 380 of 400 and 9.5 of 10 GiB as text and bars, with the aliases and quota
    pairs marked "nearly full" by text;
  - FR-005: page sizes 25, 50 and 100, first, previous, next and last, and the page number;
  - FR-009: results update after typing stops (300 ms; `page.clock`), and one action clears the
    search;
  - FR-011: every sort key from the sort control, and from desktop headers with `aria-sort`;
  - FR-012: a changed search, filter, sort or size returns to page 1; nothing in storage;
  - FR-013: refresh;
  - FR-014: the loading placeholders; empty for an administrator with an explanation (its create
    action arrives with the create route and is asserted in T047); empty for a domain administrator
    (`domain-admin-no-domains`); the error with retry (`domains-list-error`); a failed refresh keeps
    the results with an error notice;
  - FR-072 and FR-073: cards are a list with name headings, and the result count is announced;
  - the edge cases: the 253-character name wraps; many tags show "+n"; 12 of 10 is "over the
    limit"; zero limits show 0; a 5,000-domain scenario requests one page only (asserted through
    `mockApi.requests()`).
- [ ] T035 [P] [US1] Write `tests/e2e/domains/detail.spec.ts`. It covers:
  - FR-015: every value compared with the mock:
    - the header with the readable and ASCII names, state and relay badge;
    - usage (in use, limit and left; alias domains; resources; quota allocated; storage;
      messages; largest new and default new mailbox quota);
    - the General, Tags, Limits and quotas, Relay options and Groupware sections;
    - Delivery with the relayhost or "none" and the rate limit or "none";
    - the domain administrators for administrators only;
    - the footer summary;
    - the creation time, and "never" for an unmodified domain;
  - FR-015, last paragraph: no spam filter, quota warning BCC, MTA-STS, DKIM or DNS element;
  - FR-016: binary units, the locale and the device time zone, in en-gb and cs-cz;
  - US1-AS6 (detail part): the reseller opening a third domain and an unknown domain gets the same
    "not found" page, with a link to the list;
  - FR-017: loading, and an error with retry;
  - research D4: opening `/ng/domains/MÜNCHEN.de` shows the domain and replaces the address with
    `/ng/domains/xn--mnchen-3ya.de`;
  - FR-078: names, tags and descriptions shown as stored.
- [ ] T036 [P] [US1] Write the US1 unit tests in `tests/unit/features/domains/`:
  - `list-state.spec.ts`: the address parameters of data-model §5, mapped to `listDomains` query
    parameters (`active`, `backupMx`, exploded `tag`, the 15 sort keys);
  - `list-components.spec.ts`:
    - `DomainCard` (heading, values, tag buttons, "+n");
    - `DomainTable` (header cells, `aria-sort`, expandable row with `aria-expanded`);
    - `DomainEntryDetails`;
    - `DomainFilters` (active filter count, clear all);
    - `DomainSortControl`;
    - `UsageMeter` (text, level label and icon, bar `aria-hidden`);
    - `RelayBadge`, `ActiveBadge` and `DomainNameText`;
  - `detail-components.spec.ts`: `DomainHeader`, `UsageSummary`, `FooterSummary` (set or not,
    exclusion count, replies skipped; its link to the editor arrives with the footer route in US7)
    and `DomainAdminsList` (absent for domain administrators).
- [ ] T037 [P] [US1] Write `tests/smoke/domains-browse.smoke.spec.ts` (`@domains`):
  - as `admin`, the list shows `example.org` and `example.net`, and the domain page of
    `example.org` shows its usage with alice's mailbox;
  - as `reseller`, exactly those two, without a domain administrator list;
  - one case at 360 × 780 with no horizontal scroll.

### Implementation for User Story 1

- [ ] T038 [US1] Implement `src/features/domains/list-state.ts`, the `useListState` schema of data
  model §5 with `onReset` exposed for the bulk selection, so that the list-state test of T036
  passes.
- [ ] T039 [P] [US1] Implement the list components in `src/features/domains/components/list/`:
  `DomainList.vue`, `DomainCard.vue` (below `md`), `DomainTable.vue` (from `md` up, on
  `src/shared/ui/table`), `DomainEntryDetails.vue` (Reka `Collapsible`), `DomainFilters.vue`
  (native selects, `TagSetInput` in filter mode with `useTagSuggestions`), `DomainSortControl.vue`,
  `DomainNameText.vue`, `RelayBadge.vue`, `ActiveBadge.vue`, `UsageMeter.vue` and `TagChips.vue`,
  so that `list-components.spec.ts` passes.
- [ ] T040 [P] [US1] Implement the detail components in `src/features/domains/components/detail/`:
  `DomainHeader.vue`, `UsageSummary.vue`, `FooterSummary.vue` and `DomainAdminsList.vue`, and the
  read-only sections `sections/GeneralSection.vue`, `TagsSection.vue`, `LimitsSection.vue`,
  `RelaySection.vue`, `GroupwareSection.vue` and `DeliverySection.vue`. Each is built on
  `EditableSection` with `editable` false for now. `detail-components.spec.ts` must pass.
- [ ] T041 [US1] Implement `src/features/domains/pages/DomainListPage.vue`:
  - `useListState`, `ListState` with all four states, `PaginationBar`;
  - the refresh action;
  - the debounced search;
  - the polite result count announcement;
  - a failed refresh keeps the results with an error notice.

  No action links to a route that does not exist yet: "Add domain" arrives with US2 (T053), Delete
  with US4 (T069), "Domain templates" with US6 (T086), the footer link with US7 (T093) and History
  with US8 (T101).
- [ ] T042 [US1] Implement `src/features/domains/pages/DomainDetailPage.vue`:
  - `getDomain` with `initialData` from the list cache, and the canonical address replace of
    research D4;
  - `getDomainFooter` for the summary;
  - the `NotFoundPage` with `backTo` the list on `404`;
  - loading and error with retry;
  - the header actions area of data-model §9.
- [ ] T043 [US1] Register the `domains` and `domain-detail` routes in
  `src/features/domains/routes.ts`, with lazy components and the title keys of data-model §5. Set
  the catalogue's `domains` entry to `available` in `src/app/navigation/catalogue.ts`, and update
  `tests/unit/app/navigation/visibility.spec.ts`.
- [ ] T044 [US1] Add the home entry point in `src/features/home/components/ScopeSummary.vue`. For a
  domain administrator, each domain of `scope.domains` links to `domain-detail`. For an
  administrator, "all domains" links to `domains`. Update
  `tests/unit/features/home/HomePage.spec.ts`.
- [ ] T045 [US1] Add the `domains.title`, `domains.list.*`, `domains.filters.*`, `domains.sort.*`
  (one label per `DomainSort` value), `domains.state.*`, `domains.badge.*`, `domains.usage.*`,
  `domains.detail.*` and `domains.empty.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`,
  with the legacy-map entries of data-model §8 (`mailbox.domains`, `mailbox.domain_admins`,
  `mailbox.backup_mx`, `mailbox.relay_all`, `mailbox.relay_unknown`, `mailbox.msg_num`,
  `edit.created_on`, `edit.last_modified` and others). Write the Slovak value of
  `mailbox.relay_unknown` in `sk-sk.json`. Run `npm run i18n:import`. `npm run i18n:check` must
  pass.

**Checkpoint**: US1 works on its own. T034–T037 pass. Domains replace the placeholder, which is the
MVP.

---

## Phase 4: User Story 2 - Create a domain from a template (Priority: P1)

**Goal**: The create page (steps on phones, one page with a section index on wide screens),
template choice, every field, the review with the restart switch, error handling and the creation
report on the new domain's page.

**Independent Test**: Against `domain-create` and the variants below, create domains with only a
name, with another template, with overrides in each section, with and without a restart and with
DKIM switched off. Check the values sent, the review and every report outcome, at 360 px and on
desktop.

### Tests for User Story 2 (write first; must fail)

- [ ] T046 [US2] Add the US2 scenarios in `tests/mocks/scenarios/domains-create.ts`:
  - **`domain-create`**: the templates Default and "Reseller" (50 mailboxes, 50 GiB domain quota),
    the existing domain `taken.example` and the alias domain `alias.example`;
  - **`creation-report-mixed`**: `groupwareRestart: failed`, `dkimKey: alreadyExisted`;
  - **`groupware-disabled`**: `groupwareEnabled: false`, with both groupware steps
    `groupwareDisabled`;
  - **`templates-none`**: no template at all;
  - **`create-temporary-failure`**: a `503 temporary-failure` on `createDomain`;
  - **`dkim-feldhost`**: `dkim.defaultSelector: feldhost`.
- [ ] T047 [P] [US2] Write `tests/e2e/domains/create.spec.ts`. It covers:
  - US2-AS1: `example.org`, straight to the review, shows the Default values; after creation, the
    domain page and a report in which every step is done or not requested;
  - US2-AS2: "Reseller" with the mailbox limit lowered to 20; the review shows 20 and 50 GiB; the
    request body (`mockApi.requests()`) holds exactly the reviewed values and `templateId`;
  - US2-AS3: `Taken.example` and `alias.example` show "domain already exists" on the name in step
    1, with every value kept;
  - US2-AS4: a default quota above the maximum mailbox quota shows the error before any request;
  - US2-AS5: on `creation-report-mixed`, the restart is a warning with its meaning, the DKIM key
    "already existed" is information, and the report is announced;
  - US2-AS6: leaving with entered values asks for confirmation (link, Back and reload);
  - US2-AS7: the reseller sees no create action, and `/ng/domains/-/new` shows "not available for
    your role";
  - FR-014 and FR-018: "Add domain" in the list header and in the administrator's empty state
    (`domains-empty`) opens the create page;
  - FR-018: "Step n of 5" with Back and Next at 360 px, and Review enabled once the name is valid;
    on desktop, one page with a section index; focus moves to each step's heading;
  - FR-019: choosing a template after changing a field asks first;
  - FR-020: invalid names refused before sending; no auto-capitalisation;
  - FR-021: the DKIM switch off sends `dkimSelector: ""` and the report says "not requested"; an
    empty selector with the switch on sends the capabilities' default; the hint names `dkim`, or
    `feldhost` on `dkim-feldhost`; the key sizes come from the capabilities;
  - FR-022: "none" sends `rateLimit: null`; values refused outside 1–2,147,483,647;
  - FR-024: the restart switch is off by default, with its explanation;
  - FR-025: create is disabled while sending, with a `mockApi.delay`;
  - FR-026: the report stays until dismissed;
  - FR-027: an API field error opens its step and shows the error summary;
  - FR-069 and FR-070: sticky step actions, numeric keypads;
  - Edge: `groupware-disabled` hides the Global Address List flag and the restart switch, and the
    report shows "groupware disabled";
  - Edge: `templates-none` starts from the built-in values and names no template;
  - Edge: a template removed with `mockApi.mutateTemplate` before submitting shows the error on the
    template field, with the other values kept;
  - Edge: `create-temporary-failure` says nothing was changed and retries with the input kept.
- [ ] T048 [P] [US2] Write the US2 unit tests in `tests/unit/features/domains/`:
  - `create-form.spec.ts`: values from a template, from `defaults.ts` and from capabilities;
    `toCreateRequest` (exact payload, DKIM rules, `rateLimit: null`, the groupware members omitted
    when disabled); `fieldStep` for every field path;
  - `useStepper.spec.ts`: steps, the review jump gated on a valid name, focus targets, and
    normalisation of `step` without values;
  - `create-components.spec.ts`: `CreateStepper`, `CreateSectionIndex`, `CreateReview` (every value
    with units and the restart switch) and `CreationReport` (one line per step in order, kinds by
    text and icon, polite summary announcement, dismiss).
- [ ] T049 [P] [US2] Write `tests/smoke/domains-create.smoke.spec.ts` (`@domains`). As `admin`,
  create `smoke-<timestamp>.example` with only its name, and see the domain page and a report
  without warnings (the dev stack fakes outbound services). Clean up with
  `tests/smoke/fixtures/domains-api.ts`.

### Implementation for User Story 2

- [ ] T050 [US2] Implement `src/features/domains/create-form.ts` and
  `src/features/domains/composables/useStepper.ts`, so that `create-form.spec.ts` and
  `useStepper.spec.ts` pass.
- [ ] T051 [P] [US2] Implement `src/features/domains/components/create/CreateStepper.vue`,
  `CreateSectionIndex.vue` and `CreateReview.vue`, and
  `src/features/domains/components/detail/CreationReport.vue`, so that `create-components.spec.ts`
  passes.
- [ ] T052 [US2] Implement `src/features/domains/composables/useCreateDomain.ts` (the mutation,
  error-to-step mapping and report handoff of research D7) and
  `src/features/domains/pages/DomainCreatePage.vue`:
  - the steps below `md` with `step` in the address, and one page with a section index from `md`
    up;
  - the template confirmation through `useConfirm`;
  - `useLeaveGuard` while values are entered, disarmed after success;
  - `router.replace` to the new domain.
- [ ] T053 [US2] Register the `domain-create` route (`/domains/-/new`, `meta.roles: ['admin']`) in
  `src/features/domains/routes.ts`. Show `CreationReport` from
  `['domains','creation-report',name]` on `src/features/domains/pages/DomainDetailPage.vue`. Add
  the "Add domain" action for administrators to `DomainListPage.vue`, in its header and in the
  administrator's empty state (FR-014, FR-018).
- [ ] T054 [US2] Add the `domains.create.*`, `domains.review.*` and `domains.report.*` messages (one
  per outcome of every step enumeration, plus the meaning of each failure) to
  `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, with the legacy-map entries `mailbox.add_domain`,
  `mailbox.template`, `admin.dkim_domains_selector`, `admin.dkim_key_length` and
  `success.domain_add_dkim_available`. `npm run i18n:check` must pass.

**Checkpoint**: US1 and US2 work on their own.

---

## Phase 5: User Story 3 - Edit a domain (Priority: P1)

**Goal**: Section-by-section editing on the domain page, with usage checks, relay consistency, tags
as a set, outdated-save handling, permission refusals and the permission matrix.

**Independent Test**: Against `domain-edit`, edit each setting as an administrator, as a domain
administrator with the description flag and as one without it. Try limits below usage, outdated
saves, an exceeded tag limit and an attribute refusal, and check the values sent and every message.

### Tests for User Story 3 (write first; must fail)

- [ ] T055 [US3] Add the US3 scenarios in `tests/mocks/scenarios/domains-edit.ts`:
  - **`domain-edit`**: `edit.example`, with 8 mailboxes, 30 GiB allocated, a largest mailbox of
    5 GiB and the tags "a" and "b"; and `stale.example`, with 15 GiB allocated, for the refusal of
    stale usage;
  - **`domain-admin-desc`** and **`domain-admin-no-desc`**: the same domain for a domain
    administrator with and without `domainDesc`;
  - **`domain-tags-over-limit`**: 27 tags with `taggingLimit` 25;
  - **`domain-usage-over-limit`**: 12 mailboxes with a limit of 10;
  - **`domain-edit-temporary-failure`**.
- [ ] T056 [P] [US3] Write `tests/e2e/domains/edit.spec.ts`. It covers:
  - US3-AS1: a mailbox limit of 5 shows "8 in use", and saving is impossible below 8;
  - US3-AS2: on `edit.example`, a domain quota of 20 GiB is refused before sending with "30 GiB in
    use". On `stale.example`, `mockApi.mutateDomain` raises the allocation from 15 to 30 GiB after
    the page loaded. Usage is not covered by the version tag, so the save of 20 GiB reaches the API,
    and its `belowInUse` refusal shows the translated "30 GiB in use" on the field;
  - US3-AS3: after `mockApi.mutateDomain` changes the domain, the save is stopped, the input stays,
    the changed fields show their new saved values, "Save again" uses the new version tag, and
    "Discard" resets;
  - US3-AS4: the domain administrator without the flag can edit only Tags and Groupware; General,
    Limits and Relay have no Edit action and show text, not disabled inputs;
  - US3-AS5: removing "a" and adding "c" sends `tags: ["b","c"]`;
  - US3-AS6: switching on "relay non-existing mailboxes only" switches on the other two, with the
    explanation announced;
  - US3-AS7: saving a changed Global Address List flag shows the restart notice;
  - US3-AS8: the flag is removed through `mockApi.patch` while editing; saving a description shows
    the translated reason naming the description, makes it read-only and keeps the other input;
  - FR-029: a full-screen section at 360 px with sticky Save and Cancel; in place on desktop; one
    section at a time; Back closes the section and asks first when it has changes (FR-038);
  - FR-030: the request has only the changed members and `If-Match`;
  - FR-031 and FR-032:
    - the maximum mailbox quota below 5 GiB is refused before sending;
    - unit-aware quota entry;
    - default ≤ maximum ≤ domain quota;
    - a description longer than 255 characters is refused;
  - FR-035: the empty-description explanation;
  - FR-036: success announced, normalised relay values shown, and the next save uses the new tag;
  - FR-079: after a save, going back to the list shows the new values without a loading state;
  - FR-039 and FR-040: tag entry by Enter, comma and button; trim; case duplicates; too long;
    above the limit refused before sending with "25"; `domain-tags-over-limit` can shrink and
    cannot grow;
  - the deactivation confirmation names the effect on mailboxes (research D11);
  - Edge: `domain-usage-over-limit` saves other settings, and the mailbox limit only at 12 or more;
  - Edge: a zero limit saves and shows 0;
  - Edge: the domain is removed (`mockApi.removeDomain`) while open, and the next save says it is
    no longer available, with a link to the list;
  - Edge: a temporary failure says nothing was changed and retries with the input kept;
  - Edge: usage changes alone never make a save outdated.
- [ ] T057 [P] [US3] Write `tests/e2e/domains/permissions.spec.ts` (SC-005, FR-001, FR-002). For
  the administrator and both domain administrator scenarios, it asserts on the list, the domain
  page, its sections and the create address that exactly the matrix's actions are offered: list
  and inspect, create, description, Global Address List flag and tags, and active state, limits,
  quotas and relay options. A mailbox user (UI 001's `mailbox-password` scenario, active session)
  has no Domains entry and gets "no access" at `/ng/domains` and `/ng/domains/example.org` (edge
  case). The other rows of the matrix are asserted in their stories' specs: delete (T065), bulk
  actions (T072), templates (T079, T080), footer (T089) and history (T096).
- [ ] T058 [P] [US3] Write `tests/unit/features/domains/edit-sections.spec.ts` and
  `tests/unit/features/domains/useDomainSectionSave.spec.ts`:
  - each section's form, editable fields per permission, and client rules (usage checks only for
    changed limits; the tag limit);
  - the General section's deactivation confirmation;
  - the Groupware restart notice;
  - `useDomainSectionSave` outcomes for `200`, `412`, `422`, `403 attribute-not-permitted`, `404`,
    `503` and network.
- [ ] T059 [P] [US3] Write `tests/smoke/domains-edit.smoke.spec.ts` (`@domains`):
  - as `admin`, on a domain created with `domains-api.ts`: raise the mailbox limit, add a tag and
    switch a relay option, each section saved and the new values shown;
  - as `reseller`, on `example.org`: change the Global Address List flag and back, with Limits
    read-only.

  Clean up afterwards.

### Implementation for User Story 3

- [ ] T060 [US3] Implement `src/features/domains/composables/useDomainSectionSave.ts`:
  - the patch from `patch.ts`, sent with `If-Match`;
  - `412` through `useVersionedSave` with `changedSince`;
  - `403 attribute-not-permitted`: refetch the identity and the domain, and narrow the editable
    fields;
  - `422` through `useProblemForm` with the size field kinds;
  - `404` and `503`.

  `useDomainSectionSave.spec.ts` must pass.
- [ ] T061 [US3] Turn the read-only sections of T040 into editable sections, using the fields of
  T032:
  - `GeneralSection.vue`: description, and active with the deactivation confirmation;
  - `TagsSection.vue`;
  - `LimitsSection.vue`: usage hints and checks;
  - `RelaySection.vue`;
  - `GroupwareSection.vue`: the restart notice.

  `edit-sections.spec.ts` must pass.
- [ ] T062 [US3] Integrate editing into `src/features/domains/pages/DomainDetailPage.vue`:
  - `edit` in the address, with unknown or non-editable values removed;
  - `domainPermissions` for each section's `editable`;
  - `useLeaveGuard` while a section has changes;
  - focus on the section heading when it opens.
- [ ] T063 [US3] Add the `domains.sections.*`, `domains.edit.*`, `domains.deactivate.*` and
  attribute label messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. Use the legacy-map
  entries `edit.gal_info` (`stripMarkup`), `edit.relay_all_info` (`stripMarkup`), `edit.description`
  and `success.domain_modified` where the meaning is unchanged. `npm run i18n:check` must pass.

**Checkpoint**: All P1 stories (US1 to US3) work.

---

## Phase 6: User Story 4 - Delete a domain (Priority: P2)

**Goal**: Deleting one domain from its page or its list entry, after the API's deletion preview,
with the name typed, and with every refusal handled.

**Independent Test**: Against `domain-delete`, delete domains with and without aliases, alias
domains and domain administrators, look at domains with mailboxes and resources, and simulate the
API refusing because resources remain, because the version is outdated and because the domain no
longer exists.

### Tests for User Story 4 (write first; must fail)

- [ ] T064 [US4] Add the scenario `domain-delete` in `tests/mocks/scenarios/domains-delete.ts`. It
  contains:
  - `gone.example`, with 2 aliases, 1 alias domain, a footer, a DKIM key, and a domain
    administrator who manages only it plus one who manages another domain too;
  - `busy.example`, with 3 mailboxes;
  - `things.example`, with 1 resource and no mailboxes.
- [ ] T065 [P] [US4] Write `tests/e2e/domains/delete.spec.ts`. It covers:
  - US4-AS1: the confirmation shows the 2 aliases, the alias domain by name, both assigned domain
    administrators and, by name, the one whose account will be deleted, the footer, the tags and
    stored data removed and the DKIM key kept; Delete stays disabled until `GONE.example` or
    `gone.example` is typed;
  - US4-AS2: on `busy.example` the action is unavailable and says that 3 mailboxes must be removed;
    on `things.example`, that 1 resource must be removed;
  - US4-AS3: after `mockApi.addMailbox('gone.example')` before Delete, the preview's blockers are
    shown and no deletion is offered; with the mailbox added after the confirmation opens, the API's
    `409` shows the remaining counts and nothing is deleted;
  - US4-AS4: success returns to the list, announces the deletion, and the domain is gone;
  - FR-041: deletion from the list entry's actions;
  - FR-043: after `mockApi.mutateDomain` the deletion is refused as outdated, the impact is shown
    again with fresh data and needs confirming again; `mockApi.removeDomain` gives "no longer
    exists", and the domain leaves the list;
  - FR-043: the request carries `If-Match` with the preview's `etag`;
  - FR-074: the dialog is labelled, traps focus, closes with Escape and returns focus;
  - FR-002: a domain administrator (UI 001's `domain-admin-two-domains`) has no Delete action on
    the domain page or the list entries;
  - Edge: a temporary failure says nothing was deleted and offers a retry.
- [ ] T066 [P] [US4] Write `tests/unit/features/domains/deletion.spec.ts`:
  - `useDomainDeletion`: availability from usage, the preview fetched fresh each time, the outcome
    transitions of data-model §7;
  - `DeleteImpact.vue`: every item of FR-042, and the alias addresses behind a disclosure;
  - `DeleteBlockers.vue`: counts and up to 100 addresses.
- [ ] T067 [P] [US4] Write `tests/smoke/domains-delete.smoke.spec.ts` (`@domains`). As `admin`:
  - `example.org`'s Delete is unavailable because of alice's mailbox;
  - a domain created with `domains-api.ts` is deleted with its name typed, and it leaves the list.

### Implementation for User Story 4

- [ ] T068 [US4] Implement `src/features/domains/composables/useDomainDeletion.ts` and
  `src/features/domains/components/delete/DeleteImpact.vue` and `DeleteBlockers.vue`, so that T066
  passes.
- [ ] T069 [US4] Add the Delete action:
  - to the header actions of `src/features/domains/pages/DomainDetailPage.vue`;
  - to the entry actions menu (Reka `DropdownMenu`) of `src/features/domains/components/list/DomainCard.vue`
    and `DomainTable.vue`, for administrators.

  Show the unavailable reason when the domain has mailboxes or resources.
- [ ] T070 [US4] Add the `domains.delete.*` messages (impact lines, typed-name label, blockers,
  refusals, success) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, with the legacy-map entries
  `mailbox.remove` and `success.domain_removed` where the meaning is unchanged.
  `npm run i18n:check` must pass.

**Checkpoint**: US1 to US4 work on their own.

---

## Phase 7: User Story 5 - Act on several domains at once (Priority: P2)

**Goal**: Selection mode, bulk activate, deactivate and delete through the API's bulk operation with
version tags, confirmation, progress, per-domain results and retry.

**Independent Test**: Against `bulk-mixed`, select 10 domains on a phone and a desktop, deactivate
them with 2 failures injected, retry the failures, and bulk-delete a selection that includes
domains with mailboxes and resources.

### Tests for User Story 5 (write first; must fail)

- [ ] T071 [US5] Add the US5 scenarios in `tests/mocks/scenarios/domains-bulk.ts`:
  - **`bulk-mixed`**: 30 domains, two of them with injected `temporary-failure` for bulk actions,
    one with mailboxes and one with resources;
  - **`bulk-limit-small`**: `bulkLimit: 20`;
  - **`bulk-fifty`**: 50 domains for SC-008.
- [ ] T072 [P] [US5] Write `tests/e2e/domains/bulk.spec.ts`. It covers:
  - US5-AS1: deactivating 10 after the confirmation shows progress, then one row per domain, done
    or failed with a translated reason;
  - US5-AS2: "Retry" sends only the 2 failed domains (`mockApi.requests()`);
  - US5-AS3: a bulk deletion of 4 including `busy.example` lists 3 with their impact and the fourth
    as skipped; confirming needs "3" typed; the skipped domain is not in the request;
  - US5-AS4: at 360 px, selection mode shows 44 × 44 px checkboxes and a bar naming the count;
  - FR-045: select all on the page; the selection clears on page, search, filter, sort and size
    changes; the deactivation confirmation lists the domains and the effect; activation has no
    confirmation;
  - FR-046:
    - every target carries `version` equal to its list `etag` without quotes;
    - an item changed with `mockApi.mutateDomain` comes back `outdated`, stays selected, and its
      retry carries the refreshed version;
    - a dropped connection (`route.abort` on `/api/v2/domains/bulk-actions`) reports every domain
      as "outcome unknown", clears the selection and retries nothing;
  - FR-047: `things.example` (resources) is also skipped;
  - FR-048: leaving during a delayed request warns that the result will not be shown;
  - FR-073: progress and results are announced;
  - Edge: on `bulk-limit-small` at size 25, selecting 21 disables the actions and states the limit
    of 20;
  - FR-002: a domain administrator has no selection mode;
  - SC-008: `bulk-fifty` reports 50 outcomes.
- [ ] T073 [P] [US5] Write `tests/unit/features/domains/useDomainBulk.spec.ts` and
  `tests/unit/features/domains/bulk-confirm.spec.ts`:
  - the state machine of data-model §7;
  - targets, skipped partition, the kept rows and network handling;
  - `BulkDeleteImpact.vue`: per-domain impact from list data, skipped list, the typed count;
  - `BulkDeactivateList.vue`.
- [ ] T074 [P] [US5] Write `tests/smoke/domains-bulk.smoke.spec.ts` (`@domains`). As `admin`, with
  two domains created by `domains-api.ts`:
  - bulk-deactivate them and see both done, then bulk-activate them;
  - bulk-delete them with "2" typed.

### Implementation for User Story 5

- [ ] T075 [US5] Implement `src/features/domains/composables/useDomainBulk.ts` and
  `src/features/domains/components/delete/BulkDeleteImpact.vue` and `BulkDeactivateList.vue`, so
  that T073 passes.
- [ ] T076 [US5] Integrate selection into `src/features/domains/pages/DomainListPage.vue`,
  `src/features/domains/components/list/DomainCard.vue` and `DomainTable.vue`, for administrators:
  - a "Select" toggle;
  - checkboxes and select-all;
  - `BulkActionBar` with Activate, Deactivate and Delete;
  - `useBulkSelection` reset through `useListState`;
  - the bulk limit from the capabilities;
  - the progress panel and `BulkResultSummary` with Retry;
  - `useLeaveGuard` while running.
- [ ] T077 [US5] Add the `domains.bulk.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`,
  with the legacy-map entries `mailbox.activate`, `mailbox.deactivate` and `mailbox.toggle_all`
  where the meaning is unchanged. `npm run i18n:check` must pass.

**Checkpoint**: US1 to US5 work on their own.

---

## Phase 8: User Story 6 - Manage domain templates (Priority: P2)

**Goal**: The template list (search, sort, pages, Default marked, expandable entries), the create
page, the template page with editable sections, single and multiple deletion, and the new
navigation entry.

**Independent Test**: Against `templates`, create, edit and delete templates at 360 px and on
desktop, including a duplicate name and attempts to rename or delete Default.

### Tests for User Story 6 (write first; must fail)

- [ ] T078 [US6] Add the US6 scenarios in `tests/mocks/scenarios/domain-templates.ts`:
  - **`templates`**: Default, "Small" and "Reseller", plus 30 more for paging;
  - **`templates-empty`**: no templates;
  - **`templates-list-error`**;
  - **`templates-delete-mixed`**: one template removed and one changed during a multiple deletion,
    through the mutations.
- [ ] T079 [P] [US6] Write `tests/e2e/domain-templates/templates-list.spec.ts`. It covers:
  - FR-049: reachable from the navigation entry and from the domain list; pages; total; name
    search; sort by name, ID, creation and modification time; Default marked;
  - FR-050: cards at 360 px and a table on desktop, with the listed values and the expandable rate
    limit, DKIM selector and size, tags and times;
  - FR-056: loading, no templates, no matches, and error with retry;
  - FR-055 (multiple):
    - selection mode with Default not selectable;
    - the confirmation names the templates, says domains keep their values, and needs the count
      typed;
    - one `deleteDomainTemplate` per template with `If-Match`, determinate progress, and one row
      each;
    - on `templates-delete-mixed`, rows with "not found" and "changed in the meantime";
    - a dropped connection gives "outcome unknown" and "not processed" and stops;
    - leaving while running warns that the remaining templates will not be processed;
    - retry sends only the failed, refused and outdated ones;
  - US6-AS5: the reseller has no Domain templates entry, and `/ng/domain-templates` shows "no
    access".
- [ ] T080 [P] [US6] Write `tests/e2e/domain-templates/templates-edit.spec.ts`. It covers:
  - US6-AS1: "Small" with 5 mailboxes and the offered values, then listed;
  - US6-AS2: naming another template "small" shows "template name already exists" on the name;
  - US6-AS3: Default has a read-only name and no delete action, and its values save;
  - US6-AS4: the single-deletion confirmation says domains created from it keep their values;
  - FR-051: the four sections with the field rules of FR-020 to FR-022, FR-032, FR-033 and FR-039;
  - FR-052: a new template starts with 10, 400, 3 GiB, 10 GiB, 10 GiB, active, Global Address List
    on, no relay, no tags, no rate limit, DKIM on with an empty selector whose hint names the
    server default, and 2,048 bits;
  - FR-054: only changed values with `If-Match`, and `mockApi.mutateTemplate` causing the outdated
    handling;
  - US6-AS5: `/ng/domain-templates/new` shows "no access" to the reseller;
  - FR-004: an unknown template ID shows the "not found" page with a link to the template list.
- [ ] T081 [P] [US6] Write the US6 unit tests in `tests/unit/features/domains/`:
  - `templates-list-state.spec.ts`;
  - `template-form.spec.ts`: defaults; payload; DKIM empty omitted at creation and sent as the
    capabilities' default on edit; switch off sends `""`;
  - `useTemplateBulkDelete.spec.ts`: sequence, continue after failures, network stop with "not
    processed", and the rows;
  - `template-components.spec.ts`: `TemplateCard`, `TemplateTable` (Default marker,
    `aria-sort`), `TemplateEntryDetails`, and the four template sections with Default's read-only
    name.
- [ ] T082 [P] [US6] Write `tests/smoke/domain-templates.smoke.spec.ts` (`@domain-templates`). As
  `admin`:
  - create `Smoke-<timestamp>` with 5 mailboxes, change its alias limit, and delete it;
  - Default shows a read-only name and no delete action.

### Implementation for User Story 6

- [ ] T083 [US6] Implement `src/features/domains/templates-list-state.ts`,
  `src/features/domains/template-form.ts` and
  `src/features/domains/composables/useTemplateBulkDelete.ts`, so that the corresponding tests of
  T081 pass.
- [ ] T084 [P] [US6] Implement the template components in `src/features/domains/components/templates/`:
  `TemplateList.vue`, `TemplateCard.vue`, `TemplateTable.vue`, `TemplateEntryDetails.vue`,
  `TemplateNameSection.vue`, `TemplateLimitsSection.vue`, `TemplateOptionsSection.vue` and
  `TemplateDkimSection.vue`, on `EditableSection` and the fields of T032.
  `template-components.spec.ts` must pass.
- [ ] T085 [US6] Implement the template pages in `src/features/domains/pages/`:
  - `TemplateListPage.vue`: `useListState`, `ListState`, `PaginationBar`, selection with
    `BulkActionBar`, `useTemplateBulkDelete`, `BulkResultSummary` and `useLeaveGuard`;
  - `TemplateCreatePage.vue`: a sectioned form with a sticky Save, `useProblemForm`, the
    `domain-template-name-exists` mapping to the name, and `useLeaveGuard`;
  - `TemplateDetailPage.vue`: sections with `edit` in the address, `useVersionedSave` with
    `changedSince`, and single deletion through `useConfirm` (not offered for Default).
- [ ] T086 [US6] Register the `domain-templates`, `domain-template-create` and
  `domain-template-detail` routes in `src/features/domains/routes.ts`. Add the catalogue entry
  `domainTemplates` of research D5 to `src/app/navigation/catalogue.ts`, with a new icon in
  `src/shared/icons/` (TailAdmin first, otherwise Lucide, noted in `THIRD_PARTY_NOTICES.md`). Add
  its row to `tests/unit/app/navigation/visibility.spec.ts`. Add a "Domain templates" link to
  `src/features/domains/pages/DomainListPage.vue` for administrators.
- [ ] T087 [US6] Add the `nav.domainTemplates`, `domainTemplates.*` and `domainTemplates.sort.*`
  (one label per `DomainTemplateSort` value) messages to
  `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, with the legacy-map entries
  `mailbox.domain_templates`, `mailbox.add_template`, `success.template_added`,
  `success.template_modified` and `danger.template_exists` where the meaning is unchanged.
  `npm run i18n:check` must pass.

**Checkpoint**: US1 to US6 work on their own.

---

## Phase 9: User Story 7 - Manage the domain-wide footer (Priority: P3)

**Goal**: The footer editor for administrators and domain administrators: HTML and plain text as
source, skip replies, exclusions with per-entry errors, the size limit, placeholders with copy, and
outdated handling.

**Independent Test**: Against `footer`, read, change and clear footers as an administrator and as a
domain administrator, with valid and invalid exclusions, an oversized text, HTML with a script and
an outdated version.

### Tests for User Story 7 (write first; must fail)

- [ ] T088 [US7] Add the US7 scenarios in `tests/mocks/scenarios/domains-footer.ts`:
  - **`footer`**:
    - `plain.example`, without a footer;
    - `footed.example`, with HTML containing `<script>alert(1)</script>`, plain text, skip replies,
      two exclusions and one stale exclusion;
    - the alias domain `alias.footed.example`;
    - a mailbox and an alias of the domain;
  - **`footer-domain-admin`**: the same data for a domain administrator without any flag.
- [ ] T089 [P] [US7] Write `tests/e2e/domains/footer.spec.ts`. It covers:
  - US7-AS1: `plain.example` opens with empty texts, replies not skipped and no exclusions;
  - US7-AS2: the domain administrator saves HTML, plain text and one excluded address, and the
    success is announced;
  - US7-AS3: `other@else.example` comes back as `notFound` at `excludedAddresses.1`; that chip is
    marked with a translated error, and the rest of the input stays;
  - US7-AS4: the script in `footed.example`'s HTML is shown as text in the editor, and the footer
    summary on the domain page never renders it; no script runs and no CSP violation occurs;
  - FR-057: the legacy explanation; each placeholder has a copy button, and the clipboard holds
    the token (Chromium with clipboard permission);
  - FR-058: exclusion entry by Enter, comma and button; trimming; case duplicates; the alias domain
    field;
  - FR-060: from 90 % of 1 MiB the size against the limit is shown; above 1 MiB saving is blocked
    with the limit stated;
  - FR-061: saving empty texts without exclusions explains that no footer is added;
    `mockApi.mutateFooter` causes the outdated handling with the input kept;
  - FR-062: loading, error with retry, and leaving with changes asks first;
  - Edge: the stale exclusion is shown as stored; the API refuses the save and marks it; after
    removing it, the save succeeds.
- [ ] T090 [P] [US7] Write `tests/unit/features/domains/footer.spec.ts`: the UTF-8 size of
  multi-byte text; the payload mapping; `ExclusionFields.vue` (two sets, errors by index);
  `PlaceholderReference.vue` (six entries, copy through `clipboard.ts`, the refusal message);
  `TextSizeIndicator.vue` (hidden below 90 %, size text, over-limit state).
- [ ] T091 [P] [US7] Write `tests/smoke/domains-footer.smoke.spec.ts` (`@domains`). As `admin`, on
  `example.org`:
  - save a footer with `{= from_name =}` and `alice@example.org` excluded, and read it back;
  - restore the previous footer.

### Implementation for User Story 7

- [ ] T092 [US7] Implement `src/features/domains/footer.ts` and
  `src/features/domains/components/footer/ExclusionFields.vue`, `PlaceholderReference.vue` and
  `TextSizeIndicator.vue`, so that T090 passes.
- [ ] T093 [US7] Implement `src/features/domains/pages/DomainFooterPage.vue`:
  - `getDomain` for the header, and `getDomainFooter`;
  - the form, with `<textarea>` source fields that are never rendered;
  - `replaceDomainFooter` with `If-Match`, `useVersionedSave` with `changedSince`, and
    `useProblemForm` with indexed exclusion errors;
  - `useLeaveGuard`;
  - `NotFoundPage` with `backTo` the domain.

  Register the `domain-footer` route in `src/features/domains/routes.ts`, and link to it from
  `FooterSummary.vue` and the header actions of `DomainDetailPage.vue`.
- [ ] T094 [US7] Add the `domains.footer.*` messages (placeholder descriptions, size, empty-footer
  explanation, outdated) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, with the legacy-map
  entries `edit.domain_footer`, `edit.domain_footer_info` (`stripMarkup`), `edit.domain_footer_html`,
  `edit.domain_footer_plain`, `edit.domain_footer_skip_replies`, `edit.footer_exclude` and
  `success.domain_footer_modified`. Write the Slovak values of `edit.domain_footer_skip_replies` and
  `edit.footer_exclude` in `sk-sk.json`. `npm run i18n:check` must pass.

**Checkpoint**: US1 to US7 work on their own.

---

## Phase 10: User Story 8 - Trace domain changes (Priority: P3)

**Goal**: History links on the domain and template pages, and the API key History link that UI
001 R20 assigned to this bump. The audit log gains target filters and labels for the domain events.

**Independent Test**: Against `audit-domain-records`, open the history of a domain and of a
template as an administrator, filter the audit log by target, and check that a domain administrator
is never offered history.

### Tests for User Story 8 (write first; must fail)

- [ ] T095 [US8] Extend `tests/mocks/handlers/audit.ts` with the `targetType` and `targetId` filters.
  `targetId` for `domain` and `domainFooter` targets matches the ASCII or Unicode name in any
  letter case. Without `targetType`, a domain name matches the records of the domain and of its
  footer.

  Add the scenario `audit-domain-records` in `tests/mocks/scenarios/domains-history.ts`, with
  records of `example.org`:
  - a creation whose `details.creationReport` holds a failed restart;
  - an edit raising `domainQuota`, with `details.changes`;
  - a refused edit with `failureReason: attributeNotPermitted`;
  - a footer update;
  - a template's creation, update and deletion;
  - API key records.

  Every record must pass the validator.
- [ ] T096 [P] [US8] Write `tests/e2e/domains/history.spec.ts`. It covers:
  - US8-AS1, partly, because of API gap G1: History on `example.org` opens the audit log filtered
    by `targetId=example.org`; the quota entry shows the actor, the time, the client address, the
    translated event label and target, and its details in UI 001's generic view;
  - US8-AS2: the refused edit shows its translated reason;
  - US8-AS3: a domain administrator has no History action on the domain page;
  - FR-063: the template page's History opens `targetType=domainTemplate&targetId=<id>`, showing
    the template records;
  - the footer update appears in the domain's history.
- [ ] T097 [P] [US8] Write `tests/e2e/audit-log/target-filters.spec.ts`. It covers:
  - FR-063: the target type select lists the translated target types; a target filter by type and
    identifier narrows the list; both show as removable chips; a reload keeps them;
  - research D26: the API key detail page has a History link opening
    `targetType=apiKey&targetId=<id>`;
  - unknown event types still show the generic label (unit-tested in T098).
- [ ] T098 [P] [US8] Extend the audit log unit tests:
  - `tests/unit/features/audit-log/list-state.spec.ts`: `targetType` (only `AuditTarget.type`
    values) and `targetId` (≤ 255 characters) parsed and mapped;
  - `tests/unit/features/audit-log/labels.spec.ts`: the 7 domain event types, the 3 target types
    and the 5 failure reasons are translated, and other values fall back;
  - `tests/unit/features/audit-log/AuditFilters.spec.ts`: the target fields and the ≤ 255 check;
  - `tests/unit/features/domains/history-links.spec.ts`: the domain page offers `HistoryLink` only
    when `canAccess('auditLog')`.
- [ ] T099 [P] [US8] Write `tests/smoke/domains-history.smoke.spec.ts` (`@domains`). As `admin`,
  after editing a domain created with `domains-api.ts`, its History lists the creation and the
  edit. Clean up afterwards.

### Implementation for User Story 8

- [ ] T100 [US8] Extend `src/features/audit-log/list-state.ts`,
  `src/features/audit-log/components/AuditFilters.vue` (a target type `<select>` of the translated
  types, and a target field) and `src/features/audit-log/components/ActiveFilterChips.vue`, so that
  the audit-log parts of T098 pass.
- [ ] T101 [US8] Add `HistoryLink`:
  - to the header actions of `src/features/domains/pages/DomainDetailPage.vue`
    (`targetId=<ASCII name>`, administrators only);
  - to `src/features/domains/pages/TemplateDetailPage.vue`
    (`targetType=domainTemplate&targetId=<id>`);
  - to `src/features/api-keys/pages/ApiKeyDetailPage.vue` (`targetType=apiKey&targetId=<id>`).

  `history-links.spec.ts` must pass.
- [ ] T102 [US8] Add the `auditLog.event.*` labels of the 7 domain event types, the
  `auditLog.target.*` labels of `domain`, `domainTemplate` and `domainFooter`, the
  `auditLog.failureReason.*` labels of `attributeNotPermitted`, `versionOutdated`,
  `validationFailed`, `conflict` and `temporaryFailure`, and the `auditLog.filters.target*` and
  `history.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, in
  `src/features/audit-log/labels.ts`. Append these values to `src/i18n/coverage.json`
  (data-model §8). `npm run i18n:check` must pass.

**Checkpoint**: All user stories work on their own.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story verification, budgets, parity notes and validation on devices and a real
API.

- [ ] T103 [P] Write and pass `tests/e2e/domains/reflow-and-keyboard.spec.ts`. On every screen and
  dialog of this feature:
  - no horizontal scroll at 320 px and at the equivalent of 400 % zoom (320 CSS px on a 1,280 px
    desktop), FR-068 and SC-004;
  - landscape works on the mobile projects;
  - the focused element is never hidden behind the sticky header, section bar or step bar (WCAG
    2.4.11, FR-071);
  - no transition runs under `prefers-reduced-motion: reduce`;
  - the main path of each user story completes with the keyboard alone, with visible focus:
    - tag and exclusion entry;
    - selection;
    - sorting;
    - steps;
    - dialogs.
- [ ] T104 [P] Add the `/ng/domains` collection, with `MOCK_DEFAULT_SCENARIO=domains-60` as an
  administrator, to `scripts/run-lhci.mjs`. Run `npm run build && npm run budget:check && npm run lhci`,
  and fix regressions until the initial JavaScript is unchanged and at most 204,800 bytes gzipped,
  and performance and accessibility are at least 0.9 on all three collections (SC-010,
  constitution VII).
- [ ] T105 [P] Add the plan's three parity notes to the Legacy Parity tables of
  `specs/002-domains/spec.md`:
  - the Global Address List flag and the restart switch are hidden when the groupware is disabled;
  - deactivation in the General section is confirmed;
  - bulk results come from one request.
- [ ] T106 [P] Run `npm run i18n:check`. Remove the unused keys it reports from
  `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. List the new cs-cz and sk-sk strings of this feature
  for the owner's review (UI 001 plan, owner question 4).
- [ ] T107 Run `quickstart.md` Part B on a mid-range Android phone and an iPhone, with
  `npm run preview:mock` on the local network:
  - record the SC-001 timings (a template-based creation under 1 minute, and under 30 seconds with
    the name only) and the SC-010 first-page and search times;
  - record a VoiceOver and TalkBack pass of every user story (SC-003);
  - run the SC-011 moderated test if participants are available.

  Record everything in a "Validation log" section appended to `specs/002-domains/quickstart.md`.
- [ ] T108 Run `quickstart.md` Part C against the mailcow-rest-v2 dev stack at the pinned commit:
  `scripts/smoke/stack-up.sh`, `npm run test:smoke -- --grep "@domains|@domain-templates"` and
  `scripts/smoke/stack-down.sh`. Trigger the CI `smoke` job through `workflow_dispatch`, and
  confirm that no smoke domain or template is left behind. Where a mailcow host with API 002 is
  available, also run quickstart Part D steps 2 and 3 (SC-002 parity of every value with the
  classic interface), and record the result in the validation log.

---

## Dependencies & Execution Order

### Phase Dependencies

- **External prerequisites**: UI feature 001 complete, and mailcow-rest-v2 feature 002
  implemented. T001 checks both.
- **Setup (Phase 1)**: T001, then T002. T003 and T004 need T002, and T005 needs T001 and T003.
- **Foundational (Phase 2)** depends on Setup and **blocks every user story**. Within it:
  - mock infrastructure first: T006 → T007 → T008 → T009, T010 → T011; T012 in parallel;
  - then the tests T013–T024, all [P];
  - then the implementation: T025–T029 (shared), T030 (pure modules), T031 (data layer, needs
    T030), T032 (fields, needs T030 and T031).
- **User stories (Phases 3–10)** depend on Foundational, and on each other as the table below
  shows. Their end-to-end tests start from scenarios whose session is already active (UI 001's
  practice), never by signing in through the UI.
- **Polish (Phase 11)** depends on every story it verifies.

### User Story Dependencies

| Story | Priority | Depends on | Why |
|---|---|---|---|
| US1 | P1 | Foundational | MVP. Creates the list, the domain page and the routes. |
| US2 | P1 | US1 | The new domain opens on the domain page (T042), and the list's "Add domain" action (T041). |
| US3 | P1 | US1 | Makes US1's read-only sections editable (T040, T042). |
| US4 | P2 | US1 | Adds Delete to the domain page and list entries. |
| US5 | P2 | US1 | Adds selection to the list. Independent of US4: bulk deletion has its own impact view. |
| US6 | P2 | Foundational; US1 for the link from the domain list (T086) | Uses the shared fields (T032) and primitives. |
| US7 | P3 | US1 | Linked from the domain page's footer summary. |
| US8 | P3 | US1 (domain page); US6 (template page) | Adds History to both pages. |

### Files edited by several stories

Edits to these files must be serialised, even when the stories run in parallel:

- `src/features/domains/pages/DomainDetailPage.vue`: US1, US2, US3, US4, US7, US8;
- `src/features/domains/pages/DomainListPage.vue`: US1, US2, US5, US6;
- `src/features/domains/components/list/DomainCard.vue` and `DomainTable.vue`: US1, US4, US5;
- `src/features/domains/routes.ts`: US1, US2, US6, US7;
- `src/app/navigation/catalogue.ts` and `tests/unit/app/navigation/visibility.spec.ts`: US1, US6;
- `src/i18n/messages/*.json`, `src/i18n/legacy-map.json` and `src/i18n/coverage.json`: Phase 2 and
  every story;
- `tests/mocks/scenarios/index.ts`: every story registers its own module.

Scenario data avoids conflicts through one module per story (`tests/mocks/scenarios/domains-*.ts`
and `domain-templates.ts`).

### Within Each User Story

- First the scenarios (test fixtures). Then end-to-end, unit and smoke tests, which must fail.
  Then the implementation (modules → composables → components → pages → routes). Then the messages
  in all three locales.
- Each story's message task edits the shared locale files. Run those tasks one after another
  across stories.

### Parallel Opportunities

- Setup: T003 and T004 after T002.
- Foundational: T006 and T012 together. T013–T024 (tests) all together. T025–T028 together,
  except that their edits of the locale files run one after another.
- Stories: after US1, US2, US3, US4, US5 and US7 can be staffed in parallel, with their edits to the
  shared pages serialised. US6 can start right after Foundational. US8 follows US6.
- Within each story, every task marked [P] in parallel.

---

## Parallel Example: User Story 1

```bash
# After T033 (scenarios), write all US1 tests together:
Task: "T034 tests/e2e/domains/list.spec.ts"
Task: "T035 tests/e2e/domains/detail.spec.ts"
Task: "T036 tests/unit/features/domains/{list-state,list-components,detail-components}.spec.ts"
Task: "T037 tests/smoke/domains-browse.smoke.spec.ts"

# After T038, implement the components together:
Task: "T039 src/features/domains/components/list/*.vue"
Task: "T040 src/features/domains/components/detail/*.vue and sections"
# T041–T044 touch pages, routes, the catalogue and home: run them one after another.
```

## Parallel Example: User Story 5

```bash
Task: "T072 tests/e2e/domains/bulk.spec.ts"
Task: "T073 tests/unit/features/domains/{useDomainBulk,bulk-confirm}.spec.ts"
Task: "T074 tests/smoke/domains-bulk.smoke.spec.ts"
# then T075, then T076 (DomainListPage, DomainCard and DomainTable: serialise with US4's T069).
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: pin the contract and keep UI 001 green.
2. Phase 2: the foundation.
3. Phase 3 (US1): the list and the read-only domain page replace the placeholder.
4. **Stop and validate**: run `npm run test:e2e -- --grep US1` on both viewports, the smoke test
   `domains-browse`, and the US1 rows of quickstart Part B.

### Incremental Delivery

1. Foundation, then US1 (MVP: look-ups replace the classic list).
2. US2 (create) and US3 (edit): the daily writes.
3. US4 (delete) and US5 (bulk): the customer life cycle.
4. US6 (templates).
5. US7 (footer) and US8 (history).
6. Polish: reflow and keyboard, budgets, parity notes, device validation, and the smoke run against
   the real API.

### Parallel Team Strategy

After Foundational:

- Developer A: US1, then US3.
- Developer B: US6, then US8 (after US1).
- Developer C: after US1, US2, then US7.
- Developer D: after US1, US4, then US5.

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
  - a `v-html` outside `SanitizedHtml.vue`, or any rendering of the footer HTML;
  - an inline style or script;
  - a storage key;
  - a hard-coded limit that the capabilities report;
  - an automatic request while idle.
