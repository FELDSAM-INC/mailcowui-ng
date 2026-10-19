---
description: "Task list for UI feature 006: quarantine, spam policy and rate limits"
---

# Tasks: Quarantine, Spam Policy and Rate Limits

**Input**: Design documents from `specs/006-quarantine-spam-policy/`:
- [plan.md](./plan.md) (with the prerequisite table P01–P23)
- [spec.md](./spec.md)
- [research.md](./research.md) (decisions R1–R28)
- [data-model.md](./data-model.md)
- [contracts/README.md](./contracts/README.md)
- [quickstart.md](./quickstart.md)

**Prerequisites**:

- **UI 001–005 are implemented**, and their gates pass on `main`. This feature edits their action
  areas and reuses their blocks (plan P01–P20).
- **The API 006 contract is merged.** The pin baseline is `32079252…` (research R1).
- **API 006 is implemented** in the mailcow-rest-v2 dev stack for the smoke tasks (P23). The other
  tasks run against the contract-validated mock and do not need it.

**Tests**: Mandatory (constitution VI, test-first). In every phase, tests are written first and must
fail before the implementation tasks that follow them. Every end-to-end spec:

- runs on the `mobile-chromium` (360 px), `desktop-chromium` and `mobile-webkit` projects;
- calls `expectAccessible` (axe, WCAG 2.2 AA, both themes) on every screen, dialog and state it
  reaches;
- fails on any CSP violation or mock contract violation (UI 001 fixtures), and on any request
  outside `/ng/` and `/api/v2/` (T027);
- names its spec reference in the test title (`US1-AS2 …`, `FR-037 …`, `SC-002 …`, `Edge: …`).

Smoke specs carry the tag `@006`.

**Organization**: Tasks are grouped by user story (spec priorities P1 to P3), so that each story can
be implemented and tested on its own once the foundation is in place. The entry points into UI
002–004 have their own phase after the stories (research R26), except the mailbox list bulk
actions, which US3 tests.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task belongs to (US1 to US9)
- Paths are relative to the repository root `mailcowui-ng/`

---

## Task adjustments after the legacy form map (T009a, 2026-10-19)

The legacy form map (plan.md, parts 1–3) applies the conventions' "Translations and forms" rules,
which override the tasks below where they differ. The tasks keep their numbers; read them with
these changes:

- **No "Spam filter and limits" pages (D9).** T023, T036 (the object routes, `ObjectSpamFilterPage`,
  `ObjectPageHeader`, `ObjectHistoryMenu`), T077, T092, T095 and T103's mounting become: the
  feature exports editable sections that the host pages render in legacy tab order: the domain page
  gets "Rate limit" (replacing UI 002's read-only section) and "Spam filter" after it; the alias
  domain page gets its rate limit form and a "Spam filter" section; the mailbox page gets the
  "Rate limit" section (replacing UI 003's read-only one), a "Spam filter" section (spam score and
  lists) for administrators and domain administrators, and editable notification fields in its
  "Mailbox" section. Links (overview entries, the item's recipient, Phase 12) open the host page
  at the section's fragment. `owner.ts` stays (kind → operations, host route, fragment).
- **Rate limits (D2):** removal is an empty value and Save (`LegacyRateLimitField`), no "Remove
  limit" action or dialog (T098's removal steps, T100's `RemoveLimitDialog` are not built).
- **Quarantine settings (D11, D14):** one section in legacy order with one save; the template is
  restored by an empty field and Save; no size indicator, placeholder reference or notes (D12).
  T112/T113 build one `QuarantineSettingsSection` instead of four.
- **Item actions (D3 resolved, D13, D15):** "Deliver to inbox" sends at once with learning;
  "Release" (without learning) and virus-flagged deliveries are confirmed; single "Learn as spam and
  delete" and "Remove" are confirmed with `#ConfirmDeleteModal`'s texts; outcomes are legacy's
  alerts (part 2), not a step table. Bulk keeps its confirmations (typed count for deletions).
- **Lists (D16, D6, D12):** one table per list (ID, Rule, Scope, created), own rows first, inherited
  rows read-only with `user.spamfilter_table_domain_policy`; legacy messages only; no pattern help,
  preview or panel notes.
- **Notifications (D4, D10, D12, D21):** no "Not set" text and no effect note; the mailbox user's
  rows stay on the interim `/quarantine/notifications`; the mailbox list gets one menu group in
  legacy order.
- **History:** list entries are recorded on their owner (API G15 closed at the pin), so History of
  the lists is the owner's History; the per-entry History link of T126 is replaced by it. T125 adds
  labels for API 006's documented detail keys.
- **Key namespaces:** new strings use `quarantineUi.*` (not `quarantine.*`, a legacy section),
  `spamFilter.*` and `rateLimits.*`; feature strings live in `src/i18n/messages/{quarantine,
  quarantine-admin,spam-filter,rate-limits}/` and load through `loadFeatureMessages('quarantine')`.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Pin a contract that contains API 006, and extend the tooling (i18n, mock validator,
smoke stack, Lighthouse, query keys) that every story uses.

- [x] T001 Bump the contract (research R1). Run `scripts/contract/bump.sh <ref>` with the **later** of `32079252d55797d3da4e58ae661e9fb91c51c6f9` and the commit in `contract/VERSION.json` (UI 005's pin); never move the pin backwards.
  - If the kept commit is later than the baseline, run `git -C ../mailcow-rest-v2 diff 32079252..<ref> -- api/modules/quarantine api/modules/spam-policy api/modules/rate-limits api/components` and update `specs/006-quarantine-spam-policy/contracts/README.md` for any change to an operation, schema, problem type or rule code used here.
  - Record the pinned commit, the bundle sha256 and the operation count in that README's "Pinned contract" table.
  - Run `npm run typecheck`. The 006 root types (`QuarantineItem`, `QuarantineCapabilities`, `SpamPolicyEntry`, `RateLimit` and so on) and `knownProblemTypeValues` must be exported from `src/api/generated/schema.ts`.
- [ ] T002 [P] Write `tests/unit/scripts/i18n-tools-006.spec.ts` against fixture message sets. It covers (no `segment` or `stripMarkup` mapping: constitution IV 1.3.0, research R27):
  - every legacy key this feature uses (the legacy form map, T009a) exists in the bundled `en-gb` snapshot;
  - the check requires a key for every value of the closed 006 enumerations of research R2, read from `contract/openapi.json` (for example `QuarantineActionReport.learning` and `SpamFilterTemporaryFailureProblem.dependency`), plus the fixed `invalidTemplate` reasons `syntax`, `security`, `render` and `timeout`;
  - a 006 value appended to `src/i18n/coverage.json` (P13) without keys fails the check.

  The test must fail.
- [ ] T003 Implement T002 in `scripts/i18n/lib.mjs` and `scripts/i18n/check.mjs`. Reuse UI 002's coverage mechanism (P13) and UI 001's legacy-key check, and add only the closed-enumeration pointers (if UI 002 already reads inline enumerations, add the 006 pointers to its list). Append the 006 open-enumeration values of research R2 to `src/i18n/coverage.json`. The check fails until the story tasks add the keys; that is expected.
- [x] T004 [P] Extend `tests/unit/mocks/validator.spec.ts` (only if P21 is absent). The validator must:
  - accept a `downloadQuarantineAttachment` `200` with an `application/octet-stream` body and the four required headers (`Content-Disposition`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy`, `Cache-Control`);
  - reject the same response without `Content-Disposition`, and a `downloadQuarantineMessage` `200` declared as `text/html`;
  - accept a `409` problem with `Retry-After` for `quarantine-item-busy`.

  The test must fail.
- [x] T005 Implement binary bodies in `tests/mocks/contract/validator.ts` (P21): for `contentMediaType` string schemas, check the declared content type and the required headers, and skip JSON schema validation. T004 must pass.
- [x] T006 [P] Add `<meta name="format-detection" content="telephone=no, date=no, email=no, address=no">` to `index.html`, so that iOS never turns message text into links (research R9, FR-083).
- [x] T007 [P] Extend `scripts/smoke/stack-up.sh`: start the API stack with `--profile mail` (mailpit), export `RESTV2_RELEASE_SMTP_HOST=mailpit` and `RESTV2_RELEASE_SMTP_PORT=1025` for the API container, wait for `http://localhost:8025`, and run the API's `reset-dev-database.sh`, which seeds the API 006 data (research R28). `scripts/smoke/stack-down.sh` also removes the mailpit container.
- [x] T008 [P] Add a `/ng/quarantine` collection with `MOCK_DEFAULT_SCENARIO=quarantine-mailbox-user` to `scripts/run-lhci.mjs` (SC-010). The scenario is created in T040.
- [x] T009 [P] Add the query key roots of data-model §3 to `src/api/query/keys.ts`: `quarantine` (`capabilities`, `settings`, `list`, `detail`, `notification-settings`), `spam-policy` (`spam-score`, `entries`, `statistics`) and `rate-limits` (`list`, `detail`). Type the parameter objects as aliases of `NonNullable<operations['…']['parameters']['query']>`, never by hand.

**Checkpoint**: `npm run typecheck` and `npm run contract:check` pass on the new pin. The mock
validator handles binary bodies.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Verify the blocks of UI 001–004 that every story relies on, and build what all stories
need: plain-text rendering, downloads, locale numbers, the permission matrix, the capabilities
query, problem messages, the route skeletons with the object page, the section navigation, and the
mock baseline.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Legacy form map

- [x] T009a Write the legacy form map for this feature's screens (screen → legacy template → field → legacy key, including messages) in `plan.md`, and use only those keys plus the minimal new strings in the implementation.
  Follow `docs/conventions.md` "Translations and forms" and the templates in plan.md "Translations and forms (constitution IV 1.3.0)"; list any deviation under "Deviations needing a decision". Every later screen task depends on it.

### Prerequisites from earlier features

- [ ] T010 Write `tests/unit/dependencies/feature-006-dependencies.spec.ts`. It imports each block of plan rows P01–P21, P24 and P25 and checks the behaviour listed there. The canonical names of the UI conventions ("Shared building blocks and canonical names") apply: `useLeaveGuard`, `BulkActionBar`, `useBulkSelection`, `BulkResultSummary`, `ConfirmDialog`, `EditableSection`, `HistoryLink` and `src/i18n/coverage.json`. Examples:
  - `useBulkSelection` honours `limit`, `targets()` returns `{ id, version }`, and `retain(results, keep)` keeps the predicate's rows;
  - `BulkResultSummary` renders an `#item` slot;
  - `ConfirmDialog` supports `requireTyped`;
  - `EditableSection` marks changed values after a `412`;
  - `HistoryLink` builds `/audit-log?targetType=…&targetId=…`;
  - `ShellLayout` honours `meta.roles`;
  - `DomainPicker` offers a domain and an alias domain source in multiple mode;
  - `ApiProblem.extensions` exposes `requiredFlags`;
  - the session reactions refresh the identity on `permission-flag-required` and `attribute-not-permitted`;
  - `isEntryAvailable` exists;
  - the designated areas of P16–P19 exist at their paths.

  Run it and record every failure.
- [ ] T011 Fill every gap that T010 found, as the plan's prerequisite section prescribes. Build a missing block at its listed location, promote a block kept in its first feature (updating that feature's imports and keeping its tests green), or extend a block without changing its behaviour. If a block exists under another path or name, update the references in `plan.md`, `research.md` and this file instead of copying it. P24 (`FilterPanel`) is created here if absent, as a full-screen Reka `Dialog` below `md` and an inline panel from `md` up, with "Apply" and "Clear all", test first in `tests/unit/shared/components/FilterPanel.spec.ts`. T010 must pass, except for P01's prefix (T022, T035), P21 (T004, T005) and P25 (T029).
- [ ] T012 Promote `src/features/mailboxes/components/fields/AclReadOnlyNote.vue` to `src/shared/components/AclReadOnlyNote.vue` (P15, research R7). Move its unit test to `tests/unit/shared/components/AclReadOnlyNote.spec.ts`, update UI 003's imports, and keep UI 003's tests green. Its props stay: the flag name (a `PermissionFlags` key), shown as "Prohibited by ACL" (`acl.prohibited`) plus the flag's legacy label.

### Tests for the foundation (write first; must fail)

- [ ] T013 [P] Write `tests/unit/shared/security/plain-text.spec.ts` (research R9, data-model §2 "PlainText segments"). It covers:
  - every row of the neutralisation table in single-line and multi-line mode;
  - CR LF and lone CR becoming LF in multi-line text;
  - the marker code point format (`U+202E`, `U+0000`);
  - right-to-left prose keeping its LRM and RLM marks in multi-line mode;
  - every vector of `tests/mocks/factories/hostile-messages.ts` (T025): the output has only `text` and `marker` segments, and every bidi or control character becomes a marker.
- [ ] T014 [P] Write `tests/unit/shared/components/PlainText.spec.ts`. It covers:
  - a single-line value renders in one `<bdi>`, and a multi-line value in a block with `dir="auto"` and the plain-text class;
  - markers render as text spans with the code point;
  - for every hostile vector, the mounted DOM contains no element other than the component's own `bdi`, `div` and `span` (no `script`, `img`, `a`, `style`, `svg` or `iframe`), and no attribute comes from the data.
- [ ] T015 [P] Write `tests/unit/shared/platform/download.spec.ts` (research R10). It covers:
  - `Content-Disposition` parsing: RFC 8187 `filename*=UTF-8''%C5%BElu%C5%A5ou%C4%8Dk%C3%BD.pdf` is preferred over `filename`, a `charset'lang'value` form, a quoted `filename`, and a missing header falling back to the given name;
  - sanitising: `../../evil.exe`, a control character, `invoice<U+202E>fdp.exe`, a leading dot, trailing dots and spaces, and a 300-character name cut to 200;
  - the blob saved with type `application/octet-stream` whatever the response type;
  - a temporary `<a download>` is clicked and removed, and the object URL is revoked after 1 s (fake timers);
  - nothing is written to `localStorage`, `sessionStorage` or IndexedDB;
  - a problem response rejects with an `ApiProblem` and saves nothing.
- [ ] T016 [P] Write `tests/unit/i18n/parse.spec.ts` (research R18). It covers:
  - `parseLocaleDecimal`: `6,5` and `6.5` in cs-cz and sk-sk give 65 tenths; `6.5` in en-gb gives 65; `6,5` in en-gb is refused; `12` gives 120; `0` gives 0;
  - refusals: `1 000`, `1,000.5`, `-1`, `1e3`, `6,55` (two fraction digits), an empty value (except where optional) and two separators, each with its reason code;
  - `parseLocaleInteger`: digits only, and leading and trailing whitespace ignored.
- [ ] T017 [P] Write `tests/unit/shared/components/LocaleNumberField.spec.ts`. It covers:
  - `type="text"` with `inputmode="decimal"` (or `numeric` for whole numbers), and autocorrect and autocapitalize off;
  - the stored value is shown in the locale without grouping;
  - typing emits parsed tenths or an integer, and an invalid entry shows the field error through `FormField` with `aria-invalid`;
  - the label is associated with the field.
- [ ] T018 [P] Write `tests/unit/features/quarantine/permissions.spec.ts`, table-driven over every row of data-model §2 "Abilities" (SC-005):
  - an administrator;
  - a domain administrator with and without each of `quarantine`, `spamPolicy` and `ratelimit`;
  - a mailbox user with and without each of `quarantine`, `quarantineAttachments`, `quarantineNotification`, `quarantineCategory`, `spamScore` and `spamPolicy`;
  - own and foreign mailboxes for the mailbox-scoped functions.

  `missingFlag` names the flag for every `false` caused by a flag.
- [ ] T019 [P] Write `tests/unit/features/quarantine/capabilities.spec.ts`. `useQuarantineCapabilities()` reads `getQuarantineCapabilities` once under `['quarantine','capabilities']` with `staleTime` 10 minutes, exposes loading and error states with a retry, and is shared by two consumers without a second request (research R8).
- [ ] T020 [P] Extend `tests/unit/shared/validation/limits.spec.ts`: the bucket identifier pattern and maximum length in `src/shared/validation/limits.ts` equal the `RateLimitBucketId` parameter schema in `contract/openapi.json` (`^RL[0-9A-Za-z=]+$`, `maxLength` 128).
- [ ] T021 [P] Write `tests/unit/i18n/problems-006.spec.ts` (research R24). It covers:
  - `quarantine-item-busy`;
  - `quarantine-delivery-refused` with `smtpCode` and `smtpResponse`;
  - `quarantine-message-too-large` with `size` and `limit` formatted as binary sizes;
  - `spam-policy-entry-exists` with the `list` label and the pattern passed by the caller;
  - `temporary-failure` with each `dependency` and `step` label;
  - `permission-flag-required`: `["quarantine","quarantineAttachments"]` joined with "and" when `requiredFlagsMatch` is absent or `all`, and with "or" for `any`, each flag by its legacy label;
  - the legacy messages of research R24: `spam-policy-entry-exists` gives `danger.policy_list_from_exists`, `invalidFormat` with `senderPattern` gives `danger.policy_list_from_invalid`, and `quarantine-delivery-refused` gives `danger.release_send_failed` with the server answer;
  - `attribute-not-permitted` with `attributes` mapped to field labels;
  - validation messages for `invalidFormat` with `format` `email`, `domainName` and `senderPattern`; `notMultipleOf` with `factor` 0.1 and 1048576; `mustNotExceed` with `field` and `value`; `tooLong` with `unit: bytes`; `tooMany` with `max`; and `invalidTemplate` with each `reason` and `line`;
  - an unknown `reason` falls back to the generic `invalidTemplate` message.
- [ ] T022 [P] Write `tests/unit/shared/composables/useListState-prefix.spec.ts` (only if P01's prefix is absent). Two `useListState` instances with the prefixes `allow` and `block` on one route keep separate `q`, `sort`, `order`, `page` and `size` under prefixed keys, reset only their own page, and leave the unprefixed parameters alone.
- [ ] T023 [P] Write `tests/unit/features/spam-filter/ObjectSpamFilterPage.spec.ts` for the page skeleton. It covers:
  - the three kinds (`domain`, `aliasDomain`, `mailbox`) from the route;
  - the header with the object name in `PlainText` and a way back to the host detail page;
  - a `404` reported by any child panel renders `NotFoundPage` in place;
  - the `#notifications`, `#spam-score`, `#lists` and `#rate-limit` fragments focus and scroll to their panel when it is present;
  - a mailbox page offers administrators and domain administrators the link "Quarantine of this mailbox" to `/quarantine?recipient=<mailbox>` (FR-007);
  - `ObjectHistoryMenu` renders only for administrators (`canSeeHistory`).
- [ ] T024 [P] Write `tests/unit/features/quarantine/QuarantineSectionNav.spec.ts`. The navigation lists only the registered routes with `meta.sectionNav`, in `order`, filtered by `meta.roles` against the identity's role, and marks the current one with `aria-current="page"`. A route that is not registered never appears.

### Mock baseline and fixtures

- [ ] T025 Create the contract-valid factories:
  - `tests/mocks/factories/quarantine-item.ts`: items and details for every action, the virus flag, notified, score or `null`, an empty subject, `contentStatus` `available`, `tooLarge` and `missing`, `parserFallback`, attachments or `null`, `authenticatedSender` for administrators, recipients with each `source`, symbols with positive, negative and zero scores, and fuzzy hashes;
  - `tests/mocks/factories/hostile-messages.ts`: at least 50 vectors as research R9 lists, each usable as a subject, From header, sender, symbol option, file name and text part, within the contract's lengths;
  - `tests/mocks/factories/quarantine-settings.ts` (full and public, defaults of a fresh server, custom values, a custom template);
  - `tests/mocks/factories/spam-policy-entry.ts`, `tests/mocks/factories/spam-score.ts`, `tests/mocks/factories/rate-limit.ts` and `tests/mocks/factories/spam-statistics.ts`;
  - capabilities with the spec's defaults: bulk limit 100, page sizes 25 and 1000, a content limit of 10 MiB, scores 0–5000 with step 0.1, patterns of 100 characters from `a-z0-9@_.*-`, rate limits 1–2147483647 per second, minute, hour or day, the settings limits, and virus scanning on.
- [ ] T026 Create the baseline handlers and scenarios:
  - `tests/mocks/handlers/quarantine.ts` with `getQuarantineCapabilities` and `getQuarantineSettings` (`visibility: full` for administrators, the public subset for others);
  - register it in `tests/mocks/handlers/index.ts`;
  - `tests/mocks/scenarios/quarantine.ts` with a base state (capabilities, active settings, and the identities of the UI 002–004 scenarios for scope, P20), registered in `tests/mocks/scenarios/index.ts`;
  - failure injection by operationId as UI 001's scenario state offers it.
- [ ] T027 [P] Create the end-to-end fixtures and add them to `tests/e2e/fixtures/test.ts`:
  - `tests/e2e/fixtures/requests.ts`: records every request and fails the test on any URL outside `/ng/` and `/api/v2/`. It installs a `window.__xss` canary in an init script and fails the test if the canary is set;
  - `tests/e2e/fixtures/downloads.ts`: `expectDownload(page, action)` returns the suggested file name and bytes from Playwright's `download` event, and asserts that the page URL did not change and that no new page opened.

### Implementation of the foundation

- [ ] T028 [P] Implement `src/shared/security/plain-text.ts` (`neutralise`) and `src/shared/components/PlainText.vue` (`multiline` prop; `<bdi>` or a block with `dir="auto"`), plus the classes in `src/styles/main.css`: the plain-text block (`white-space: pre-wrap`, `overflow-wrap: anywhere`, `unicode-bidi: plaintext`) and the muted marker style. T013 and T014 must pass.
- [ ] T029 [P] Promote UI 005's `src/features/account/download.ts` to `src/shared/platform/download.ts` (P25, research R10), keeping its behaviour (object URL, temporary `<a download>`, revocation after 1 s, never `data:` URLs), updating UI 005's imports and moving its test. Then add `saveApiFile`, `parseContentDisposition` and `sanitiseFileName` as data-model §2 "Download target" describes. If UI 005 shipped no helper, create the module at that path. T015 and UI 005's download tests must pass.
- [ ] T030 [P] Implement `src/i18n/parse.ts` and `src/shared/components/LocaleNumberField.vue`. T016 and T017 must pass.
- [ ] T031 [P] Implement `src/features/quarantine/permissions.ts`, the pure functions of data-model §2. T018 must pass.
- [ ] T032 Implement `src/features/quarantine/capabilities.ts` (`useQuarantineCapabilities`), the first query of `src/features/quarantine/api.ts`, and export the composable and `permissions.ts` from `src/features/quarantine/index.ts`. T019 must pass.
- [ ] T033 [P] Add the bucket identifier pattern and maximum length to `src/shared/validation/limits.ts`, with a comment naming the contract parameter. T020 must pass.
- [ ] T034 Extend `src/api/problem.ts` with type guards over the generated `SpamFilterPermissionFlagProblem`, `QuarantineNotificationAttributeNotPermittedProblem`, `SpamFilterTemporaryFailureProblem`, `QuarantineDeliveryRefusedProblem`, `QuarantineMessageTooLargeProblem` and `SpamPolicyEntryExistsProblem` (through `ApiProblem.extensions`, P12). Extend `src/i18n/problems.ts` with the parameter formatting of research R24. T021 must pass once T038 adds the messages.
- [ ] T035 Add the optional key prefix to `src/shared/composables/useListState.ts` (only if P01's prefix is absent), with no change for existing callers. T022 must pass.
- [ ] T036 Create the route skeletons:
  - `src/features/quarantine/routes.ts` (empty, filled by the stories);
  - `src/features/spam-filter/{routes.ts,index.ts,owner.ts}`: `owner.ts` maps each kind to its operations, its route and its group labels (data-model §2 "PolicyOwner");
  - `src/features/spam-filter/pages/ObjectSpamFilterPage.vue`, with named panel slots filled by the stories;
  - `src/features/spam-filter/components/ObjectPageHeader.vue` and `src/features/spam-filter/components/ObjectHistoryMenu.vue`.

  Register `spam-filter-domain` (`/domains/:domain/spam-filter`, `meta.navEntry: 'domains'`), `spam-filter-alias-domain` (`/alias-domains/:aliasDomain/spam-filter`, `meta.navEntry: 'aliasDomains'`) and `spam-filter-mailbox` (`/mailboxes/:mailbox/spam-filter`, `meta.navEntry: 'mailboxes'`), each with `meta.roles: ['admin', 'domainAdmin']` and the title key `spamFilter.object.title`, in `src/app/router/routes.ts` (data-model §5). T023 must pass.
- [ ] T037 Implement `src/features/quarantine/components/QuarantineSectionNav.vue` and the `meta.sectionNav` (`labelKey`, `order`) typing in `src/app/router/routes.ts`. T024 must pass.
- [ ] T038 Add the foundation's messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`:
  - the PlainText marker's accessible text;
  - the `LocaleNumberField` reasons (`spamFilter.score.notANumber` and the integer reasons);
  - download errors;
  - the object page header and its fallback link;
  - the section navigation labels;
  - the problem and validation messages of T021 that have no legacy equivalent. The others use the legacy `danger.*`, `warning.*` and `success.*` keys of the form map (research R24).

  Only the form map's new strings are added. `acl.prohibited` and the seven `acl.*` flag labels are used verbatim by their legacy keys (no `legacy-map.json` entry, no import). T021 must pass.

**Checkpoint**: All Phase 2 tests pass. The object pages render their header and "not found", and
the dependency test is green.

---

## Phase 3: User Story 1 - Review and act on my own quarantine (Priority: P1) 🎯 MVP

**Goal**: A mailbox user lists, filters, sorts and opens their quarantine, reads a message as inert
text, downloads permitted files, and delivers, learns or removes items with confirmations and step
reports.

**Independent Test**: With scenario `quarantine-mailbox-user` (30 items of every kind, including
hostile content) and the flag variants, at 360 px and desktop, list, filter, open, download,
deliver with and without learning, learn as spam and remove. Verify every value, every request
sent, and that no markup is ever rendered (spec US1).

### Tests for User Story 1 (write first; must fail)

- [ ] T039 [US1] Extend `tests/mocks/handlers/quarantine.ts`:
  - `listQuarantineItems`: scope per role; `q` over subject, sender, recipient and queue ID; the filters `recipient`, `domain`, `action` (exploded), `virus`, `notified`, `from` (inclusive), `to` (exclusive), `minScore` and `maxScore` (unscored left out); the 10 sort keys with ties by `id` desc and unscored first when ascending by score; `limit` and `offset`; `meta.total`;
  - `getQuarantineItem`: `404` outside the scope; `attachments: null` without `quarantineAttachments`; `authenticatedSender` only for administrators; `tooLarge` with `content: null`;
  - `releaseQuarantineItem` (`learnAsHam` default true), `learnQuarantineItemAsSpam` and `deleteQuarantineItem`: `If-Match`/`412`; `403 permission-flag-required` with `requiredFlags`; the item removed on success with an action report;
  - injections: learning failed, fuzzy failed or skipped, busy (`409` with `Retry-After: 5`, then gone or available on the next read), delivery refused (`smtpCode` 550, `smtpResponse` with a right-to-left override), and temporary failure with `dependency` and `step`;
  - `downloadQuarantineAttachment` and `downloadQuarantineMessage`: binary bodies with the four headers, `409 quarantine-message-too-large` with `size` and `limit`, and `403` with `requiredFlags` (`quarantine` first, then `quarantineAttachments`).
- [ ] T040 [US1] Add these scenarios to `tests/mocks/scenarios/quarantine.ts`:
  - `quarantine-mailbox-user`: alice with all flags and 30 items (rejected, junk, subject rewritten, `other` with `filterAction` `soft reject`, virus, attachments, over 10 MiB, unparseable, no score or subject, markup, script and right-to-left text);
  - `quarantine-user-no-actions`, `quarantine-user-no-attachments` and `quarantine-user-no-flags`;
  - `quarantine-inactive` (retention 0);
  - `quarantine-hostile`: every vector of the hostile factory as an item;
  - `quarantine-empty`.
- [ ] T041 [P] [US1] Write `tests/e2e/quarantine/list.spec.ts`. It covers:
  - US1-AS1: 25 newest of 30, total 30, a way to the rest, and every card value with the arrival time in the locale;
  - US1-AS11 and FR-008: the inactive notice with the legacy text; the legacy `quarantine.settings_info` with the retention and the maximum size in MiB when active; the collapsible explanation verbatim with its markup;
  - FR-009: page sizes 25, 50 and 100, and first, previous, next and last page;
  - FR-012: search after the pause, with the announced count;
  - FR-013: action, virus, notification, day range and score range filters as chips with "clear all", and the full-screen panel at 360 px;
  - FR-014: the sort control on mobile, and headers with `aria-sort` on desktop;
  - FR-015: reloading restores the view, and nothing is written to storage;
  - FR-016: Refresh announces count changes;
  - FR-017: loading, "no items", "nothing matches" with "clear filters", and an error with a retry;
  - Edge: "(no subject)" and "–" for a missing score; an `other` action shows its stored value with a neutral marker;
  - FR-076: the cards are a list with the subject as each card's heading.
- [ ] T042 [P] [US1] Write `tests/e2e/quarantine/item.spec.ts`. It covers:
  - US1-AS2: `<script>alert(1)</script>` and a link shown literally, no script, and the link not clickable;
  - US1-AS3: score with "Rejected"; "Danger: High" in text; symbols in legacy order with signed scores and visible options; subject, From, SMTP sender, recipients with their header and envelope marked; both text parts;
  - US1-AS9: no attachment section without `quarantineAttachments`;
  - US1-AS10: the summary and filter results, with content "unavailable: message exceeds the size limit" and no download;
  - Edge: unparseable message with the plain-text part "not available";
  - FR-021: "Show full text" toggles with `aria-expanded`;
  - FR-023: the hash copy and the "Search file hash @ VT" link with `target="_blank"`, `rel="noopener noreferrer"`, `referrerpolicy="no-referrer"` and only the hash in its address;
  - FR-005: an unknown or foreign ID shows the "not found" page with a way back;
  - FR-018: Back returns to the list with its address and scroll position;
  - FR-078: focus on the heading when the item opens.
- [ ] T043 [P] [US1] Write `tests/e2e/quarantine/actions.spec.ts`. It covers:
  - US1-AS4: delivery with learning; the item is gone and the outcome says "delivered and learned as not spam";
  - US1-AS5: switch off gives "delivered without learning", and the request body has `learnAsHam: false`;
  - US1-AS6: learning failed is reported as delivered with a warning, not as a failure;
  - US1-AS7: virus item, confirm disabled until the acknowledgement is ticked;
  - US1-AS8: no actions or `.eml` download, and the notice;
  - FR-027 and FR-028: destructive confirmations with the item named;
  - FR-030 and the edges:
    - not found: back to the list and refreshed;
    - delivery refused: the item kept and the mail server answer shown with a visible `U+202E` marker;
    - temporary failure: names the service, nothing changed, and a retry;
  - FR-031: controls disabled while sending, so a double click sends one request (checked through `mockApi.requests()`);
  - Edge: a dropped connection (`route.abort()`) gives "outcome unknown", one re-read of the item, and no second action request;
  - FR-004 and Edge "permission withdrawn while working": the mock withdraws `quarantine` after the page loaded, so a delivery answers `403 permission-flag-required`. The message names "Quarantine actions", the identity is refreshed, and the action controls disappear with the notice shown;
  - FR-025: back to the list in its previous state, with the outcome announced;
  - FR-024 at 360 px: the action bar stays reachable without scrolling.
- [ ] T044 [P] [US1] Write `tests/e2e/quarantine/downloads.spec.ts`. It covers:
  - FR-036: an attachment and `.eml` saved with the API's file names through `expectDownload`, with no navigation or new page, and the bytes equal to the mock's;
  - FR-037: a virus item warns before downloading, and Cancel downloads nothing;
  - FR-038: "too large" with the size and limit, a missing permission naming "Quarantine attachments", and an attachment that is gone;
  - FR-002: no `.eml` download for a mailbox user without `quarantineAttachments`.
- [ ] T045 [P] [US1] Write `tests/e2e/quarantine/hostile-content.spec.ts` with scenario `quarantine-hostile` (SC-002, FR-083). For every hostile item, on both viewports:
  - open it;
  - assert that the canary is unset and no request left the app (T027);
  - assert no horizontal scroll at 360 and 320 px;
  - assert that the heading and the action bar keep their bounding boxes compared with a plain item;
  - assert that override and control characters show as `U+…` markers;
  - assert that the text has no `a`, `img` or `svg` element.

  Assert the `format-detection` meta tag once. Tag the spec `@hostile-corpus`.
- [ ] T046 [P] [US1] Write the unit tests:
  - `tests/unit/features/quarantine/list-state.spec.ts`: data-model §6, with defaults omitted; invalid values normalised; days converted to UTC with `to` as the start of the next day in the device time zone (including a DST change); the score range with `.`; a mailbox user's `recipient` and `domain` ignored;
  - `tests/unit/features/quarantine/symbols.spec.ts`: the legacy order with ties;
  - `tests/unit/features/quarantine/content-preview.spec.ts`: 20 lines and 4,000 characters;
  - `tests/unit/features/quarantine/action-outcome.spec.ts`: every row of data-model §2 "Action outcome view", and `toProblemOutcome` for `404`, busy, refused, `412`, `403`, `503` and network.
- [ ] T047 [P] [US1] Write the component tests in `tests/unit/features/quarantine/`:
  - `ReleaseDialog.spec.ts`: the switch is on by default; its explanation changes when off; the virus acknowledgement gates confirm; subject and sender are shown as `PlainText`;
  - `ItemActionBar.spec.ts`: abilities decide the actions; "More" on phones; disabled while running;
  - `MessageContent.spec.ts`: legacy headings, "not available", `tooLarge`, fallback, and the toggle;
  - `AttachmentList.spec.ts`: hash copy through `clipboard.ts`; the VT link built only for a valid hash;
  - `QuarantineStatusNotice.spec.ts`;
  - `useItemAction.spec.ts`: each outcome of the data-model §8 state machine, with fake timers for the single busy re-check after `Retry-After`, the re-read after no response, and never a second action request.
- [ ] T048 [P] [US1] Write `tests/smoke/quarantine.smoke.spec.ts` (`@006`) against the dev stack seeded by API 006. As `alice@example.org`:
  - 30 items are listed;
  - opening an item shows its symbols;
  - an attachment download is saved;
  - a delivery without learning succeeds;
  - a delivery with learning reports the learning warning (no Rspamd in the dev stack);
  - learning as spam reports a temporary failure and keeps the item;
  - `/ng/quarantine/<an item ID of bob>` shows "not found".

### Implementation for User Story 1

- [ ] T049 [US1] Extend `src/features/quarantine/api.ts` with:
  - the list and detail queries (detail `gcTime` 60 s);
  - the release, learn and delete mutations with `If-Match` and the invalidation of data-model §3 (the detail removed, the list invalidated);
  - the download fetchers using `parseAs: 'blob'`.
- [ ] T050 [US1] Implement `src/features/quarantine/list-state.ts`: the `useListState` schema of data-model §6, the mapping to `listQuarantineItems` parameters, and the day-range conversion.
- [ ] T051 [P] [US1] Implement `src/features/quarantine/symbols.ts`, `src/features/quarantine/content-preview.ts` and `src/features/quarantine/action-outcome.ts`. T046 must pass.
- [ ] T052 [P] [US1] Implement the list components in `src/features/quarantine/components/`:
  - `QuarantineStatusNotice.vue`, with the collapsible help text;
  - `QuarantineFilters.vue`: inside the shared `FilterPanel.vue` (P24: full screen below `md`), the action, virus, notification, day and score fields (`LocaleNumberField`), and `ActiveFilterChips`;
  - `QuarantineSortControl.vue`;
  - `ActionBadge.vue`, `VirusBadge.vue` and `NotifiedBadge.vue` (text badges, FR-079);
  - `QuarantineItemCard.vue` (subject heading through `PlainText`, details disclosure for the remaining FR-010 values) and `QuarantineItemRow.vue`;
  - `QuarantineItemList.vue`: cards below `md`, and a table from `md` with header cells, `aria-sort`, and queue and item IDs as the subject cell's second line.
- [ ] T053 [US1] Implement `src/features/quarantine/pages/QuarantineListPage.vue`:
  - `useListState`, `SearchField`, `ListState`, `PaginationBar`, Refresh and the count announcement;
  - the `quarantine` route in `src/features/quarantine/routes.ts`, with `meta.sectionNav` "Items", registered in `src/app/router/routes.ts`;
  - the catalogue entry `quarantine` set to `available` in `src/app/navigation/catalogue.ts`, with UI 001's visibility test table updated.
- [ ] T054 [P] [US1] Implement the item sections in `src/features/quarantine/components/`:
  - `ItemSummary.vue`: recipients with their header and envelope marked, size, sending server, IDs, notification state, and `authenticatedSender` for administrators;
  - `FilterResult.vue`: score, badge, virus state, and symbols with `Intl` `signDisplay: 'exceptZero'` and their options listed;
  - `FuzzyHashes.vue`, with copy buttons;
  - `TextPart.vue` and `MessageContent.vue`;
  - `AttachmentList.vue`: name, type, size, hash with copy, VT link and download.

  Every message string goes through `PlainText`. T047's section tests must pass.
- [ ] T055 [P] [US1] Implement the dialogs in `src/features/quarantine/components/`: `ReleaseDialog.vue`, `LearnSpamDialog.vue`, `RemoveItemDialog.vue`, `DownloadWarningDialog.vue` and `ActionOutcomeMessage.vue` (the success message with its warnings, announced, and not dismissed while focused or hovered, FR-071).
- [ ] T056 [US1] Implement:
  - `src/features/quarantine/composables/useItemAction.ts`;
  - `src/features/quarantine/composables/useBusyRecheck.ts`;
  - `src/features/quarantine/downloads.ts`: `saveApiFile` wrappers with the fallback names `quarantine-<itemId>.eml` and `attachment-<position>`, and the virus warning first.

  T047's `useItemAction` test must pass.
- [ ] T057 [US1] Implement `src/features/quarantine/components/ItemActionBar.vue` (sticky below `md`, `scroll-padding-bottom` while shown, a "More" menu) and `src/features/quarantine/pages/QuarantineItemPage.vue`:
  - the sections of FR-019;
  - the "actions are disabled" notice (research R13);
  - loading, error and "not found";
  - Back through `router.back()` when the list is the previous entry;
  - focus on the heading.

  Register the `quarantine-item` route (`/quarantine/:itemId(\d+)`, after the literal routes).
- [ ] T058 [US1] Add only the form map's new strings for the list, filters, item, actions, downloads and status (the step lines, the learning switch, the virus acknowledgement, the added item fields) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`.
  - Use the `quarantine.*` keys of research R27 verbatim, `quarantine.qinfo` and `quarantine.settings_info` with their markup through `SanitizedHtml.vue`, and the legacy `success.*`, `danger.*` and `warning.*` outcomes of research R24.
  - No `legacy-map.json` entry, no import, and no new key where a legacy key has the meaning.
  - `npm run i18n:check` must pass for every key used so far.

**Checkpoint**: US1 works on its own. All T039–T048 tests pass. This is the MVP: mailbox users can
recover wrongly caught mail in the new app.

---

## Phase 4: User Story 2 - Handle the quarantine of all mailboxes in my scope (Priority: P1)

**Goal**: Administrators and domain administrators filter by recipient and domain, act on a page
selection of up to the bulk limit with one result per item, and open a recipient's settings.

**Independent Test**: With 250 items across five domains, as an administrator and as a domain
administrator of two domains with and without `quarantine`, at both widths. Use every filter, search
and sort, run each bulk action with partial failures, a whole-request refusal and a dropped
connection, and compare the results with the mock (spec US2).

### Tests for User Story 2 (write first; must fail)

- [ ] T059 [US2] Extend `tests/mocks/handlers/quarantine.ts` with `applyQuarantineBulkAction`:
  - more targets than `bulkLimit` gives `422` (`targets`: `tooMany`, `max`);
  - a missing flag gives a whole-request `403 permission-flag-required`;
  - duplicate targets are processed once;
  - per target: `done` with `report`, `notFound`, `refused` (busy, delivery refused), `outdated` (version mismatch) and `failed` (temporary failure), with `summary` and `bulkRequestId`.

  Add scenarios to `tests/mocks/scenarios/quarantine.ts`:
  - `quarantine-many`: 250 items across `example.org` and four other domains, reusing the domain and mailbox state of P20;
  - `quarantine-admin`, `quarantine-domain-admin` (two of five domains) and `quarantine-domain-admin-no-actions`;
  - `quarantine-bulk-failures`: one item removed meanwhile, one busy, one refused delivery, one temporary failure, one outdated, and one release whose learning fails;
  - `quarantine-busy`;
  - `quarantine-low-bulk-limit` (`bulkLimit` 10);
  - recipients that are a resource and a deleted mailbox (`getMailbox` answers `404`).
- [ ] T060 [P] [US2] Write `tests/e2e/quarantine/scope-and-filters.spec.ts`. It covers:
  - US2-AS1: only the two domains' items, the recipient column shown, and the domain filter offering only those two (no request for domains);
  - US2-AS2: "Junk folder", virus "High", sort by score descending, page 2, survive a reload and a shared address;
  - the recipient filter as an exact address;
  - an administrator's domain filter through `DomainPicker`;
  - sorting by each of the 10 keys;
  - no recipient column or filter for mailbox users.
- [ ] T061 [P] [US2] Write `tests/e2e/quarantine/bulk.spec.ts`. It covers:
  - US2-AS3: 40 items selected on a 50-item page; delivery with learning; the confirmation names the action and 40 and lists subjects and recipients; the summary shows 39 done and 1 not found, with rows;
  - FR-035 with `quarantine-bulk-failures`: counts per outcome, the learning warning on a `done` row, and refused, failed and outdated rows staying selected;
  - US2-AS4: with `bulkLimit` 10, "Select all" disabled with the message, and the eleventh selection refused with the limit stated;
  - US2-AS5: a dropped connection gives "outcome unknown", the list refreshed, and exactly one bulk request recorded;
  - SC-007: a page of 100 items, all selected and removed, gives 100 result rows whose outcomes match the mock's;
  - US2-AS6: no selection mode without `quarantine`, while details stay viewable;
  - research R15: a page, filter, sort or size change clears the selection with an announcement;
  - bulk "Remove" and "Learn as spam and delete" require typing the count, while bulk delivery needs one confirmation;
  - a delivery that includes virus items states their number and requires the acknowledgement;
  - a whole-request `403` gives one message, with the selection kept;
  - at 360 px: the "Select" control, 44 × 44 checkboxes, and the bar with the count and actions staying visible.
- [ ] T062 [P] [US2] Write `tests/e2e/quarantine/busy-and-recipient.spec.ts`. It covers:
  - US2-AS7 with `page.clock`: "another action is in progress for this item", one re-read after 5 s, and the item then gone (back to the list) or available again;
  - US2-AS8: an administrator selects bob's address and lands on `/ng/mailboxes/bob@example.org/spam-filter`;
  - Edge: the recipient of an item for a resource or a deleted mailbox is shown without a link (FR-006).
- [ ] T063 [P] [US2] Write the unit tests in `tests/unit/features/quarantine/`:
  - `useQuarantineBulk.spec.ts`: targets with `version` from `etag`; `retain` keeps refused, failed and outdated; the unknown outcome never resends; a whole-request refusal keeps the selection;
  - `QuarantineBulkConfirm.spec.ts`: typed count for the destructive actions; virus count and acknowledgement; `PlainText` lists;
  - `QuarantineBulkResultRow.spec.ts`: the report warnings in `BulkResultSummary`'s `#item` slot.
- [ ] T064 [P] [US2] Write `tests/smoke/quarantine-bulk.smoke.spec.ts` (`@006`):
  - `reseller` sees only items of his domains;
  - `admin` selects two of bob's items, removes them with the typed count, and sees two "done".

### Implementation for User Story 2

- [ ] T065 [US2] Add the `applyQuarantineBulkAction` mutation to `src/features/quarantine/api.ts` (removing the details of `done` items and invalidating the list), and implement `src/features/quarantine/composables/useQuarantineBulk.ts` on `useBulkSelection` with `limit: capabilities.bulkLimit`.
- [ ] T066 [P] [US2] Implement `src/features/quarantine/components/QuarantineBulkConfirm.vue` (on `ConfirmDialog` with `requireTyped` for removal and learning) and `src/features/quarantine/components/QuarantineBulkResultRow.vue`. Add the selection checkboxes and the selection-mode tap behaviour to `QuarantineItemCard.vue`, `QuarantineItemRow.vue` and `QuarantineItemList.vue`.
- [ ] T067 [US2] Extend `src/features/quarantine/pages/QuarantineListPage.vue` and `src/features/quarantine/components/QuarantineFilters.vue`:
  - `BulkActionBar` and selection mode, only when `canActOnItems`;
  - the three bulk actions with `BulkResultSummary`;
  - the recipient filter (`type="email"`);
  - the domain filter (`identity.scope.domains` for domain administrators, `DomainPicker` for administrators);
  - the recipient column for administrators and domain administrators.
- [ ] T068 [US2] Add the recipient link to `src/features/quarantine/components/ItemSummary.vue`: for administrators and domain administrators, query `getMailbox` (UI 003's key) and link to `spam-filter-mailbox` only on `200`; otherwise show the address as `PlainText`.
- [ ] T069 [US2] Add the form map's new `quarantine.bulk.*` strings (limit, typed count, virus count, summary and the per-row warnings), the domain filter label and the busy texts to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. Per-item lines use the legacy outcome messages and the recipient filter uses `quarantine.rcpt`. `npm run i18n:check` must pass.

**Checkpoint**: US1 and US2 work on their own. All P1 stories are done.

---

## Phase 5: User Story 3 - Choose quarantine notifications (Priority: P2)

**Goal**: Mailbox users set their frequency and category as their flags allow. Administrators and
domain administrators do it on a mailbox's page and for many mailboxes from UI 003's mailbox list.

**Independent Test**: As a mailbox user with and without each notification flag, as a domain
administrator and as an administrator, change both values on one mailbox and for 30 mailboxes in
bulk with one out of scope. Verify the requests, the read-only presentation and the results (spec
US3).

### Tests for User Story 3 (write first; must fail)

- [ ] T070 [US3] Extend `tests/mocks/handlers/quarantine.ts`:
  - `getMailboxQuarantineNotificationSettings` and `updateMailboxQuarantineNotificationSettings`: merge patch, `If-Match`/`412`; `403 attribute-not-permitted` with `attributes` and `requiredFlags` for a mailbox user changing a member without its flag (a member sent with its current value is accepted); `404` for resources and outside the scope; `category: null` when none is stored;
  - `applyQuarantineNotificationBulkAction`: `frequency` and/or `category`; `notFound` outside the scope; `422 tooMany`; `403` for mailbox users.

  Add scenarios: `notifications-user-all-flags`, `notifications-user-no-category`, `notifications-user-none`, `notifications-no-category-stored`, `notifications-outdated` (a value changed after the page loaded), and a domain administrator with 30 mailboxes, one of which leaves the scope before the bulk request.
- [ ] T071 [P] [US3] Write `tests/e2e/quarantine/notifications.spec.ts`. It covers:
  - US3-AS1: "Daily" saved and announced, with the note about the next run (every 20 minutes) and already-notified items;
  - US3-AS2: the category read-only with "Prohibited by ACL" and "Change quarantine notification category", while the frequency stays editable;
  - US3-AS3: "Not set";
  - US3-AS5: an outdated save keeps the choice, marks the newly saved value, and offers save again or discard;
  - the panel on `/ng/mailboxes/<m>/spam-filter#notifications` for an administrator and a domain administrator;
  - Edge: `attribute-not-permitted` after a permission was withdrawn marks the field read-only and refreshes the identity;
  - no Notifications entry in the section navigation for administrators.
- [ ] T072 [P] [US3] Write `tests/e2e/mailboxes/notification-bulk.spec.ts` (UI 003's list). It covers:
  - US3-AS4: 30 mailboxes selected; "Set quarantine notifications"; "Weekly"; the confirmation names the action, the value and 30; the summary shows 29 done and 1 not found;
  - "Set quarantine notification category" with "All categories";
  - the request carries targets without `version` (research R16);
  - failed and refused mailboxes stay selected, under UI 003's rules.
- [ ] T073 [P] [US3] Write the unit tests:
  - `tests/unit/features/quarantine/NotificationSettingsPanel.spec.ts`: legacy radio labels and explanations, "Not set", read-only fields with `AclReadOnlyNote`, only changed members sent with `If-Match`, the effect note, and `412` marking through `EditableSection`;
  - `tests/unit/features/quarantine/NotificationBulkAction.spec.ts`: the value chooser, the confirmation text, targets as `{ id }`, and the result handed to `retain`.
- [ ] T074 [P] [US3] Write `tests/smoke/notifications.smoke.spec.ts` (`@006`):
  - `alice@example.org` sets "Daily" and restores her previous value;
  - `reseller` sets "Weekly" for two mailboxes from the mailbox list and sees two "done".

### Implementation for User Story 3

- [ ] T075 [US3] Add the notification settings query, the patch mutation and the bulk mutation to `src/features/quarantine/api.ts`, with the invalidation of data-model §3, including UI 003's mailbox detail and list keys (FR-086).
- [ ] T076 [US3] Implement `src/features/quarantine/components/NotificationSettingsPanel.vue` (on `EditableSection`) and `src/features/quarantine/pages/NotificationsPage.vue`. Register the `quarantine-notifications` route (`meta.roles: ['mailboxUser']`, `meta.sectionNav`) before `quarantine-item`.
- [ ] T077 [US3] Mount `NotificationSettingsPanel` in the `notifications` slot of `src/features/spam-filter/pages/ObjectSpamFilterPage.vue` for the kind `mailbox` (`id="notifications"`). Export the panel from `src/features/quarantine/index.ts`.
- [ ] T078 [US3] Implement `src/features/quarantine/composables/useNotificationBulk.ts` and `src/features/quarantine/components/NotificationBulkAction.vue`, export them from `src/features/quarantine/index.ts`, and render the two items in `src/features/mailboxes/components/list/MailboxBulkActions.vue` (UI 003's designated area, P17) for administrators and domain administrators.
- [ ] T079 [US3] Add the form map's new `quarantine.notifications.*` and bulk action strings (the effect timing, "Not set" if approved, the bulk summary) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. Use verbatim `user.quarantine_notification`, `user.quarantine_notification_info`, `user.quarantine_category`, `user.quarantine_category_info`, `user.never`, `user.hourly`, `user.daily`, `user.weekly`, `user.q_reject`, `user.q_add_header`, `user.q_all`, `mailbox.quarantine_notification` and `success.mailbox_modified` (no `legacy-map.json`, no import). `npm run i18n:check` must pass.

**Checkpoint**: US3 works on its own.

---

## Phase 6: User Story 4 - Tune my spam filter (Priority: P2)

**Goal**: A mailbox user reads and changes their spam score with locale decimals and a three-zone
band, resets it, and keeps their Allowlist and Denylist next to the domain's read-only entries.

**Independent Test**: As a mailbox user with each combination of `spamScore` and `spamPolicy`, read,
change and reset the score, add valid, invalid and duplicate patterns, and remove single and several
entries, at both widths, in Czech and English (spec US4).

### Tests for User Story 4 (write first; must fail)

- [ ] T080 [US4] Create `tests/mocks/handlers/spam-policy.ts` and register it:
  - `getMailboxSpamScore`, `setMailboxSpamScore` (`If-Match`/`412`; `422` `outOfRange`, `notMultipleOf` and `mustNotExceed`; equal values stored with the reject value + 0.1) and `resetMailboxSpamScore`, with defaults and `fallback`, and one stored value reported as custom;
  - `listMailboxSpamPolicyEntries`: own and inherited domain entries (`own: false`, `owner`); `list` and `ownership` filters; `q`; sort `pattern`, `createdAt` and `id`; paging;
  - `createMailboxSpamPolicyEntry`: trimmed and lower-cased; `422` `invalidFormat` (`senderPattern`) and `tooLong`; `409 spam-policy-entry-exists` with `list` and `entryId`; `201` with `Location` and `ETag`;
  - `deleteMailboxSpamPolicyEntry`: `If-Match`; `404` when gone or inherited;
  - flags: `permission-flag-required` with `spamScore` or `spamPolicy`.

  Create `tests/mocks/scenarios/spam-filter.ts`, registered in `tests/mocks/scenarios/index.ts`, with `spam-score-defaults` (8 and 15), `spam-score-fallback`, `spam-score-custom`, `spam-score-one-value`, `spam-user-no-score-flag`, `spam-user-no-policy-flag`, `spam-user-no-flags`, `policy-user` (domain block entry `*@spam.example`) and `policy-many-entries` (40 own entries).
- [ ] T081 [P] [US4] Write `tests/e2e/spam-filter/spam-score.spec.ts`. It covers:
  - US4-AS1: defaults 8 and 15, with the band stating "below 8", "8 to below 15" and "15 and above";
  - US4-AS2 in cs-cz: `6,5` and `12` sent as 6.5 and 12, and shown in Czech format;
  - US4-AS3: 12 and 6 give the field error, and nothing is sent;
  - US4-AS4: the "+0.1" explanation, then 10 and 10.1 shown;
  - US4-AS5: a confirmed reset shows the defaults in effect;
  - the edges: the fallback note; one stored value shown as custom;
  - FR-069 and SC-008: a score changed elsewhere after the page loaded makes the save answer `412`; the typed values are kept, the newly saved values are marked, and the user saves again or discards. A refused reset is confirmed again;
  - read-only with "Prohibited by ACL" and "Spam score" without `spamScore`;
  - the band states its ranges in text.
- [ ] T082 [P] [US4] Write `tests/e2e/spam-filter/policy-lists.spec.ts`. It covers:
  - US4-AS6: `*@Spam.Example ` added as `*@spam.example`, with the field emptied and focused; adding it to the Allowlist then says "already on the Denylist" and sends nothing more;
  - US4-AS7: `user+tag@example.org` refused, naming the allowed characters, with no request;
  - US4-AS8: the domain entry in "Set for example.org", read-only, without a remove control;
  - US4-AS9: three selected own entries removed with the typed count, giving two removed and one already gone, with "retry failed";
  - US4-AS10: no Spam filter entry without both flags, and the address shows "no access";
  - FR-045: the switch with counts at 360 px, side by side on desktop, and the switch kept in the address;
  - FR-047: search, sort and paging with 40 entries, kept in the prefixed address parameters; each list's loading, empty and error states with a retry;
  - the edges: wildcards only, and 101 characters, refused before sending; an inherited entry removed by its owner meanwhile disappears after Refresh;
  - FR-051: the notes.
- [ ] T083 [P] [US4] Write the unit tests:
  - `tests/unit/features/spam-filter/spam-score.spec.ts`: tenths; `validatePair` with capabilities; `equalRaisesReject`; `bandZones`, including 0, 5000 and equal values;
  - `tests/unit/features/spam-filter/ScoreBand.spec.ts`: text ranges and explanations; the colour bar `aria-hidden`; widths through a bound style only;
  - `tests/unit/features/spam-filter/SpamScorePanel.spec.ts`;
  - `tests/unit/features/spam-filter/pattern.spec.ts`: normalisation, and the rules from `capabilities.senderPattern`;
  - `tests/unit/features/spam-filter/PolicyListsPanel.spec.ts`: two queries per list; own first; inherited labels per owner kind; owner links only when `canReadPolicy`;
  - `tests/unit/features/spam-filter/PolicyEntryAddForm.spec.ts`: the normalised preview, the conflict message per `list`, and focus after success;
  - `tests/unit/features/spam-filter/useRemoveEntries.spec.ts`: sequential with `If-Match`; `404` counted as already removed; it continues after failures; "retry failed" re-sends only the failed entries.
- [ ] T084 [P] [US4] Write `tests/smoke/spam-filter.smoke.spec.ts` (`@006`). As `alice@example.org`:
  - set 6.5 and 12, then reset;
  - add `*@smoke.example` to the Denylist and remove it;
  - see `*@spam.example` read-only under "Set for example.org".

### Implementation for User Story 4

- [ ] T085 [US4] Implement:
  - `src/features/spam-filter/api.ts`: the spam score query and mutations, and the mailbox entry list, create and delete through `owner.ts`, with data-model §3's invalidation;
  - `src/features/spam-filter/spam-score.ts`;
  - `src/features/spam-filter/pattern.ts`;
  - `src/features/spam-filter/lists-state.ts`: two prefixed `useListState` schemas plus `list`.

  T083's pure-module tests must pass.
- [ ] T086 [P] [US4] Implement `src/features/spam-filter/components/ScoreBand.vue` and `src/features/spam-filter/components/SpamScorePanel.vue` (`EditableSection`, two `LocaleNumberField`s, the "+0.1" note, the confirmed reset, defaults and the fallback note).
- [ ] T087 [P] [US4] Implement in `src/features/spam-filter/`:
  - `components/PolicyListsPanel.vue`, `components/PolicyList.vue` and `components/PolicyListSwitch.vue`;
  - `components/PolicyEntryAddForm.vue` and `components/PolicyEntryRow.vue`;
  - `components/RemoveEntriesDialog.vue` and `components/RemoveEntriesReport.vue`;
  - `composables/useRemoveEntries.ts`.
- [ ] T088 [US4] Implement `src/features/spam-filter/pages/SpamFilterPage.vue` (the own mailbox: spam score panel and lists panel). Register the `spam-filter` route (`/spam-filter`, `meta.navEntry: 'spamFilter'`), and set the catalogue entry `spamFilter` to `available` in `src/app/navigation/catalogue.ts`, with UI 001's visibility test table updated.
- [ ] T089 [US4] Add the form map's new `spamFilter.*` strings (score field labels, server-default note, band, removal summary) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`.
  - Use the `user.spamfilter*` keys of research R27 and `user.spam_score_reset` verbatim, `user.spamfilter_wl_desc` and `user.spamfilter_bl_desc` with their markup through `SanitizedHtml.vue`, and `danger.policy_list_from_exists`, `danger.policy_list_from_invalid`, `success.mailbox_modified` and `success.item_deleted` for the outcomes.
  - No `legacy-map.json` entry and no import. `npm run i18n:check` must pass.

**Checkpoint**: US4 works on its own.

---

## Phase 7: User Story 5 - Manage spam policy for domains, alias domains and mailboxes (Priority: P2)

**Goal**: Administrators and permitted domain administrators keep the lists of domains and alias
domains, with mailbox entries read-only and linked, and manage a mailbox's lists and spam score on
its page.

**Independent Test**: As an administrator and as a domain administrator with and without
`spamPolicy`, open the pages of a domain, an alias domain and a mailbox. Add and remove entries,
change and reset a mailbox's score, and verify the read-only presentation, the inherited groups and
the owner links (spec US5).

### Tests for User Story 5 (write first; must fail)

- [ ] T090 [US5] Extend `tests/mocks/handlers/spam-policy.ts`:
  - the list, create and delete operations for domains and alias domains, whose inherited entries are the domain's mailbox entries;
  - `forbidden` for mailbox users;
  - `permission-flag-required` (`spamPolicy`) for domain administrators without the flag.

  Add the scenarios `policy-admin`, `policy-domain-admin`, `policy-domain-admin-no-policy` and `policy-resource` (a resource address answering `404`) to `tests/mocks/scenarios/spam-filter.ts`.
- [ ] T091 [P] [US5] Write `tests/e2e/spam-filter/object-pages.spec.ts`. It covers:
  - US5-AS1: `*@ads.test` added to an alias domain's Denylist;
  - US5-AS2: two mailbox entries in "Set for mailboxes", each linking to its mailbox's page;
  - US5-AS3: "Prohibited by ACL" with "Denylist/Allowlist", and no add or remove control;
  - US5-AS4: an administrator sets 4 and 9 for a mailbox whose user lacks `spamScore`;
  - US5-AS5: a resource's address shows "not found" (FR-006);
  - FR-007: the "Quarantine of this mailbox" link on a mailbox page;
  - the per-entry History link appears for administrators only (its content is tested in US9).
- [ ] T092 [P] [US5] Write `tests/unit/features/spam-filter/owner.spec.ts` (dispatch per kind, the route, the group labels), and extend `tests/unit/features/spam-filter/ObjectSpamFilterPage.spec.ts` with the panels each kind shows.
- [ ] T093 [P] [US5] Write `tests/smoke/spam-policy-objects.smoke.spec.ts` (`@006`):
  - `reseller` adds and removes a Denylist entry of an alias domain of his domain;
  - `admin` sets and resets alice's spam score on `/ng/mailboxes/alice@example.org/spam-filter`.

### Implementation for User Story 5

- [ ] T094 [US5] Add the domain and alias domain list, create and delete operations to `src/features/spam-filter/api.ts` through `owner.ts`. A domain or alias domain change also invalidates the mailbox entry lists of that domain (data-model §3).
- [ ] T095 [US5] Mount the panels in `src/features/spam-filter/pages/ObjectSpamFilterPage.vue`:
  - for a mailbox, `SpamScorePanel` (`id="spam-score"`) and `PolicyListsPanel` (`id="lists"`);
  - for a domain and an alias domain, `PolicyListsPanel`.

  The inherited owner links follow `canReadPolicy`.
- [ ] T096 [US5] Add the form map's new `spamFilter.object.*` strings (page titles per kind, "Set for mailboxes", "Set for <domain>", the precedence note) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. Use `edit.spam_filter`, `user.spamfilter_table_domain_policy` and `success.domain_modified` verbatim. `npm run i18n:check` must pass.

**Checkpoint**: US4 and US5 work on their own (US5 reuses US4's panels).

---

## Phase 8: User Story 6 - Limit how much a domain or mailbox may send (Priority: P2)

**Goal**: Rate limits on each object page, with the effective mailbox limit, explicit removal and
invalid stored values. The Rate limits overview has kind filter, search, "Set a rate limit" and the
bucket reset.

**Independent Test**: As each role, with and without `ratelimit`, open the overview, filter by kind,
set, change and remove limits on a domain, an alias domain and a mailbox, show an invalid stored
value, and reset existing and unknown buckets (spec US6).

### Tests for User Story 6 (write first; must fail)

- [ ] T097 [US6] Create `tests/mocks/handlers/rate-limits.ts` and register it:
  - get, set and remove for the three kinds: `If-Match`/`412`; `422` `outOfRange` and `notInList`; `invalidStoredValue`; for a mailbox, `effectiveLimit` and `effectiveSource` (`mailbox`, `domain`, `none`);
  - removal when not set answers `204` and changes nothing;
  - `listRateLimits`: `kind`, `q`, sort `object` and `kind`, paging and scope;
  - `resetRateLimitBucket`: `204` for a known bucket, `404` for an unknown one, `503` on injection;
  - `forbidden` for mailbox users, and `permission-flag-required` (`ratelimit`) for writes of domain administrators without the flag.

  Create `tests/mocks/scenarios/rate-limits.ts`, registered in `tests/mocks/scenarios/index.ts`, with `rate-limits-admin` (limits on 3 domains, 1 alias domain and 4 mailboxes, and a bucket `RLabc=`), `rate-limits-domain-admin`, `rate-limits-domain-admin-no-flag`, `rate-limits-invalid-stored` and `rate-limits-mailbox-user`.
- [ ] T098 [P] [US6] Write `tests/e2e/rate-limits/rate-limit-panel.spec.ts`. It covers:
  - US6-AS1: "100 msgs / hour" on the domain, and a mailbox without its own limit shows "100 msgs / hour, from the domain example.org";
  - US6-AS2: the mailbox's own "10 msgs / minute", then a confirmed removal whose dialog names the domain limit that will apply, then the domain limit again;
  - US6-AS3: 0 gives the range "1 to 2,147,483,647" in the locale, and nothing is sent;
  - US6-AS5: the invalid stored text with a warning, "Replace" and "Remove";
  - US6-AS7: read-only for a domain administrator without `ratelimit`; not offered to a mailbox user (no panel; the object pages show "no access");
  - the legacy mailbox explanation;
  - FR-069 and SC-008: a limit changed elsewhere makes the save answer `412`; the input is kept, the new value is marked, and a refused removal is confirmed again;
  - FR-070 and Edge "shared store unavailable": a `503` with `dependency: sharedStore` says nothing was changed and offers a retry with the input kept;
  - Edge: removing a limit that is not set reports done.
- [ ] T099 [P] [US6] Write `tests/e2e/rate-limits/overview.spec.ts`. It covers:
  - US6-AS4: the mailboxes filter lists exactly 4, each linking to its mailbox's page;
  - US6-AS6: reset `RLabc=` gives "reset", and `RLunknown` gives "there was nothing to reset", with the legacy explanation in the confirmation;
  - FR-056: search, sort, paging, cards and table, and the empty and error states;
  - FR-057: "Set a rate limit" for each kind through `DomainPicker` or `MailboxSearchPicker`, landing on the object's `#rate-limit` with focus;
  - Edge: `RL-bad` refused before sending, naming the expected form;
  - a reset answered `503` (shared store) says nothing was changed and offers a retry;
  - the overview not in the section navigation for mailbox users, whose address shows "no access";
  - no reset action for domain administrators.
- [ ] T100 [P] [US6] Write the unit tests:
  - `tests/unit/features/rate-limits/rate-limit.spec.ts`: `formatLimit` in three locales, `effectiveText`, and `validateLimit` from the capabilities;
  - `tests/unit/features/rate-limits/bucket-id.spec.ts`;
  - `tests/unit/features/rate-limits/RateLimitPanel.spec.ts`;
  - `tests/unit/features/rate-limits/RemoveLimitDialog.spec.ts`: the effect text per kind and source;
  - `tests/unit/features/rate-limits/SetRateLimitDialog.spec.ts`;
  - `tests/unit/features/rate-limits/ResetBucketDialog.spec.ts`: `204` and `404` messages distinct, and the dialog and `useResetRateLimitBucket` exported from `src/features/rate-limits/index.ts` for UI 011.
- [ ] T101 [P] [US6] Write `tests/smoke/rate-limits.smoke.spec.ts` (`@006`):
  - `reseller` sets "10 / minute" on `alice@example.org`, then removes it and sees the domain's "100 / hour" as effective;
  - `admin` resets an unknown bucket and sees "nothing to reset".

### Implementation for User Story 6

- [ ] T102 [US6] Implement `src/features/rate-limits/api.ts`. Its invalidation follows data-model §3, including the domain, alias domain and mailbox detail and list keys of UI 002–004 for FR-086, and a domain change invalidates its mailboxes' limits. Also implement `src/features/rate-limits/rate-limit.ts`, `src/features/rate-limits/bucket-id.ts`, `src/features/rate-limits/list-state.ts`, `src/features/rate-limits/routes.ts` and `src/features/rate-limits/index.ts`. T100's pure-module tests must pass.
- [ ] T103 [P] [US6] Implement `src/features/rate-limits/components/RateLimitPanel.vue`, `RateLimitForm.vue` (`LocaleNumberField` and a native `<select>` of `capabilities.rateLimit.frames`) and `RemoveLimitDialog.vue`. Export the panel, and mount it in the `rate-limit` slot of `src/features/spam-filter/pages/ObjectSpamFilterPage.vue` for all three kinds (`id="rate-limit"`).
- [ ] T104 [P] [US6] Implement in `src/features/rate-limits/components/`:
  - `RateLimitList.vue`: cards and table, each entry linking to its object's page;
  - `SetRateLimitDialog.vue` and `MailboxSearchPicker.vue` (a Reka `Combobox` without its viewport, infinite over `listMailboxes`);
  - `ResetBucketDialog.vue`, with `useResetRateLimitBucket`.
- [ ] T105 [US6] Implement `src/features/rate-limits/pages/RateLimitsPage.vue`. Register the `quarantine-rate-limits` route (`meta.navEntry: 'quarantine'`, `meta.roles: ['admin', 'domainAdmin']`, `meta.sectionNav` "Rate limits") before `quarantine-item`.
- [ ] T106 [US6] Add the form map's new `rateLimits.*` strings (the overview and "Remove limit", if approved) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`.
  - Use verbatim `ratelimit.disabled`, `ratelimit.second`, `ratelimit.minute`, `ratelimit.hour`, `ratelimit.day`, `edit.ratelimit`, `edit.mbox_rl_info`, `admin.reset_limit`, `danger.rl_timeframe`, `success.rl_saved`, `success.hash_deleted`, `warning.hash_not_found`, and `admin.hash_remove_info` whole with its markup.
  - No `legacy-map.json` entry and no import. `npm run i18n:check` must pass.

**Checkpoint**: US6 works on its own.

---

## Phase 9: User Story 7 - Configure the quarantine system (Priority: P2)

**Goal**: Administrators edit the four settings sections with versioned saves, choose excluded
domains with stale entries flagged, and edit the template as source only.

**Independent Test**: As an administrator, open the settings of a fresh server, edit each section
with valid and invalid values, choose and remove excluded domains (including a stale one), restore
the default template, and provoke an outdated save. As a domain administrator and a mailbox user,
confirm that the page is not offered (spec US7).

### Tests for User Story 7 (write first; must fail)

- [ ] T107 [US7] Extend `tests/mocks/handlers/quarantine.ts` with `updateQuarantineSettings`:
  - merge patch and `If-Match`/`412`;
  - `null` or an empty value restores the defaults, and an empty template restores the default template (`notificationTemplateIsDefault`);
  - `422` per field: `outOfRange`, `notMultipleOf` (`factor` 1048576), `invalidFormat` (`email`), `tooLong` (subject; template with `unit: bytes`), `notFound` (`excludedDomains.<n>`), and `invalidTemplate` with `reason` and `line`;
  - entries of `missingExcludedDomains` sent back unchanged are accepted;
  - `503` with `dependency: sharedStore`;
  - `forbidden` for domain administrators and mailbox users.

  Add the scenarios `quarantine-settings-fresh`, `quarantine-settings-custom` (a template containing `<img src=x onerror=alert(1)>`, copy and redirect recipients), `quarantine-settings-stale-domain` and `quarantine-settings-outdated`.
- [ ] T108 [P] [US7] Write `tests/e2e/quarantine/settings.spec.ts`. It covers:
  - US7-AS1: inactive with the reason, and the defaults (365 days, unmodified original, `quarantine@localhost`, "Spam Quarantine Notification", the default template);
  - US7-AS2: retention 20 and 15 MiB, sent as `15728640`, then active;
  - US7-AS3: `not-an-address` gives a translated field error, and the summary leads to it;
  - US7-AS4: a stale excluded domain flagged "no longer exists", removable and keepable, and not offered by the picker;
  - US7-AS5: a confirmed restore shows the default template, marked;
  - US7-AS6: the template shown only as source text, with no `img` element anywhere and the canary unset;
  - FR-060: each section saves only its members, and the section form is full screen at 360 px;
  - FR-064: the effect timing text;
  - `invalidTemplate` "syntax error, line 1" on the template field;
  - a template over `notificationTemplateMaxBytes` blocks the save, with the size indicator showing the limit;
  - a `412` keeps the input and marks the changed values;
  - a `503` says nothing was changed and keeps the input;
  - domain administrators and mailbox users: no Settings entry, and the address shows "no access".
- [ ] T109 [P] [US7] Write the unit tests in `tests/unit/features/quarantine/`:
  - `settings-form.spec.ts`: MiB to bytes and back; the empty-means-default display; the per-section patch diff;
  - `StorageSection.spec.ts`;
  - `ExcludedDomainsPicker.spec.ts`: missing entries flagged; the picker excludes them; `IdnText` names;
  - `TemplateSection.spec.ts`: source only; the size through `utf8ByteLength`; the placeholder copy buttons; the restore confirmation; the notes;
  - `NotificationMailSection.spec.ts`: email inputs; the "unsigned, unchecked" warnings; the subject length from the capabilities.
- [ ] T110 [P] [US7] Write `tests/smoke/quarantine-settings.smoke.spec.ts` (`@006`). As `admin`, the settings show "active" (seeded retention 20 and 15 MiB). Saving the template `{% for x in meta %}` shows "syntax error, line 1", and the stored template is unchanged after a reload.

### Implementation for User Story 7

- [ ] T111 [US7] Add the settings mutation to `src/features/quarantine/api.ts` (writing `['quarantine','settings']` from the response), and implement `src/features/quarantine/settings-form.ts`.
- [ ] T112 [P] [US7] Implement `src/features/quarantine/components/settings/StorageSection.vue`, `ReleaseSection.vue`, `NotificationMailSection.vue` and `ExcludedDomainsPicker.vue` (`DomainPicker` in multiple mode with both sources, and `IdnText`), each on `EditableSection`.
- [ ] T113 [P] [US7] Implement `src/features/quarantine/components/settings/TemplateSection.vue`, `TemplatePlaceholders.vue` and `TemplateSizeIndicator.vue`.
- [ ] T114 [US7] Implement `src/features/quarantine/pages/QuarantineSettingsPage.vue` (the active state and the four sections). Register the `quarantine-settings` route (`meta.roles: ['admin']`, `meta.sectionNav` "Settings") before `quarantine-item`.
- [ ] T115 [US7] Add the form map's new `quarantine.settings.*` strings (the effect timing, the placeholder reference and the template notes) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`.
  - Use verbatim `admin.quarantine`, `admin.quarantine_release_format`, `admin.quarantine_release_format_raw`, `admin.quarantine_release_format_att`, `admin.quarantine_notification_sender`, `admin.quarantine_notification_subject`, `admin.quarantine_exclude_domains`, `tfa.select`, `admin.save` and `success.saved_settings`.
  - Use whole, with their `<br><small>` help through `SanitizedHtml.vue`, as the field labels: `admin.quarantine_retention_size`, `admin.quarantine_max_size`, `admin.quarantine_max_score`, `admin.quarantine_max_age`, `admin.quarantine_bcc`, `admin.quarantine_redirect` and `admin.quarantine_notification_html`.
  - No `legacy-map.json` entry and no import. `npm run i18n:check` must pass.

**Checkpoint**: US7 works on its own.

---

## Phase 10: User Story 8 - See how the spam filter handled mail (Priority: P3)

**Goal**: Administrators see the action counts, shares and bars in text, with the counting period
when known.

**Independent Test**: As an administrator, open the page with counts, with all counts zero and with
the spam filter unreachable. As a domain administrator, confirm that it is not offered (spec US8).

### Tests for User Story 8 (write first; must fail)

- [ ] T116 [US8] Extend `tests/mocks/handlers/spam-policy.ts` with `getSpamFilterActionStatistics` (counts, `total`, `countedSince` and `spamFilterRunningSince` set or `null`, `503` with `dependency: spamFilter`), and add the scenarios `spam-statistics` (120, 30, 0, 250, 600), `spam-statistics-zero` and `spam-statistics-unavailable` to `tests/mocks/scenarios/spam-filter.ts`.
- [ ] T117 [P] [US8] Write `tests/e2e/quarantine/statistics.spec.ts`. It covers:
  - US8-AS1: each action with its count, its percentage of 1,000 and a bar, all in text and in the locale's number format;
  - US8-AS2: "temporarily unavailable" with a working retry;
  - zero counts give 0 %;
  - the period lines when the dates are known, and "start unknown" when not;
  - Refresh;
  - not offered to domain administrators, whose address shows "no access".
- [ ] T118 [P] [US8] Write `tests/unit/features/quarantine/statistics.spec.ts` (shares, rounding to one decimal, zero total) and `tests/unit/features/quarantine/ActionStatisticsList.spec.ts` (a list with text values; the bars `aria-hidden` with a bound width).
- [ ] T119 [P] [US8] Write `tests/smoke/statistics.smoke.spec.ts` (`@006`): as `admin`, the page shows "temporarily unavailable" with a retry, because the dev stack has no Rspamd.

### Implementation for User Story 8

- [ ] T120 [US8] Implement the statistics query in `src/features/quarantine/api.ts` (key `['spam-policy','statistics']`; the quarantine feature never imports from `spam-filter` or `rate-limits`, research R4), `src/features/quarantine/statistics.ts`, `src/features/quarantine/components/statistics/ActionStatisticsList.vue` and `src/features/quarantine/pages/SpamFilterStatisticsPage.vue`. Register the `quarantine-statistics` route (`meta.roles: ['admin']`, `meta.sectionNav` "Statistics") before `quarantine-item`.
- [ ] T121 [US8] Add the form map's new `quarantine.statistics.*` strings (total, period lines, the reset note) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`; the action names are shown as the API reports them, as in legacy's chart. `npm run i18n:check` must pass.

**Checkpoint**: US8 works on its own.

---

## Phase 11: User Story 9 - Trace quarantine and spam policy changes (Priority: P3)

**Goal**: Administrators open History from this feature's pages and read the 006 audit records.
Their labels are translated, and their details are shown through the generic view until the
contract documents them (plan API gap 2).

**Independent Test**: As an administrator, open History from each page of this feature, and check
the filters and the presentation of each kind of record from the mock (spec US9).

### Tests for User Story 9 (write first; must fail)

- [ ] T122 [US9] Create `tests/mocks/factories/quarantine-audit.ts` with records of the 12 event types: a release with steps, records of one bulk action sharing `bulkRequestId`, a settings change with the template's sizes, entry creation and removal, rate limit changes, a bucket reset, and failures with their `failureReason`. A record's `recipient` carries a right-to-left override. Extend `tests/mocks/handlers/audit.ts` so that the `targetType` and `targetId` filters work for them, and add the scenario `quarantine-audit` to `tests/mocks/scenarios/quarantine.ts`.
- [ ] T123 [P] [US9] Write `tests/e2e/audit-log/quarantine-history.spec.ts`. It covers:
  - US9-AS1: the release record shows the actor, time, client address, event label and outcome, with the details (queue ID, recipient, sender, action, steps) as generic key–value text, the recipient's override as a marker, and no subject or content;
  - US9-AS2: the template record shows its old and new sizes in the generic view;
  - US9-AS3: no History control anywhere for domain administrators;
  - History opens the audit log filtered by the right `targetType` and `targetId` from:
    - the Settings page (`quarantineSettings`, type only);
    - a mailbox page's notification panel (`quarantineNotificationSettings`) and spam score panel (`spamScore`);
    - a rate limit panel and an overview entry (`rateLimit`);
    - an own list entry (`spamPolicyEntry` with its ID);
  - the target type filter offers the 7 types of 006 with their labels;
  - records of one bulk action share a visible `bulkRequestId`.
- [ ] T124 [P] [US9] Write `tests/unit/features/audit-log/quarantine-labels.spec.ts` (the 12 event types and 7 target types have labels in three locales; an unknown value falls back) and `tests/unit/features/audit-log/AuditEventDetails-plain-text.spec.ts` (generic values render through `PlainText`, overrides become markers, and nothing from `details` is rendered as markup). If API 006's section of `docs/audit-events.md` exists at the pinned commit (T125), also assert that its documented keys show translated labels and an unknown key shows verbatim.

### Implementation for User Story 9

- [ ] T125 [US9] Add the 12 event types and 7 target types to `src/features/audit-log/labels.ts`, and render the values of `src/features/audit-log/components/AuditEventDetails.vue`'s generic view through `PlainText` (research R23).
  - Check `docs/audit-events.md` in mailcow-rest-v2 at the pinned commit. If it has API 006's section (API gap G3), add translated labels `auditLog.detailKey.<key>` for the documented keys, and translate enumeration values where the section names them. Unknown keys stay verbatim (API convention "Audit record details").
  - If the section is missing, keep the generic view and note G3 as still open for API 006 in `specs/006-quarantine-spam-policy/plan.md`.
- [ ] T126 [US9] Place `HistoryLink` for administrators (research R23 table):
  - `src/features/quarantine/pages/QuarantineSettingsPage.vue`;
  - `src/features/quarantine/components/NotificationSettingsPanel.vue` (mailbox page only);
  - `src/features/spam-filter/components/SpamScorePanel.vue` (mailbox page only);
  - `src/features/spam-filter/components/PolicyEntryRow.vue` (own entries);
  - `src/features/rate-limits/components/RateLimitPanel.vue` and `src/features/rate-limits/components/RateLimitList.vue`;
  - `src/features/spam-filter/components/ObjectHistoryMenu.vue`, which groups the object page's links.
- [ ] T127 [US9] Add the `auditLog.event.*` and `auditLog.target.*` messages for the 006 values, and any failure reason the records use, to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. Confirm that they are listed in `src/i18n/coverage.json` (T003). `npm run i18n:check` must pass.

**Checkpoint**: All user stories work on their own.

---

## Phase 12: Entry points into UI 002, 003 and 004

**Purpose**: Link the "Spam filter and limits" pages from the hosts' designated action areas, now
that every panel exists (research R26, FR-006, FR-086). The mailbox list bulk actions came with US3
(T078).

- [ ] T128 [P] Write `tests/e2e/entry-points/spam-filter-entry-points.spec.ts`. It covers:
  - the domain page's section list entry after Groupware (showing the current limit) and the Delivery section's rate limit link to `#rate-limit`;
  - the mailbox detail's "Spam filter and limits" entry in `MailboxSectionNav`, and the `ManagedSettingsGroup` links of the notification frequency and category (`#notifications`) and of the effective rate limit (`#rate-limit`);
  - the alias domain detail's link and its rate limit note link;
  - the creation report "repeat the rate limit step" hints of UI 002–004, where they exist, pointing at the new object's `#rate-limit`;
  - the resource detail shows no such link (US5-AS5);
  - FR-086: after setting a domain's rate limit or a mailbox's notification frequency, the host pages show the new read-only values without a reload;
  - the links are absent for roles that may not read the target.
- [ ] T129 [P] Extend the host component tests:
  - `tests/unit/features/domains/DomainDetailPage.spec.ts`;
  - `tests/unit/features/mailboxes/MailboxSectionNav.spec.ts` and `tests/unit/features/mailboxes/ManagedSettingsGroup.spec.ts`;
  - `tests/unit/features/alias-domains/AliasDomainDetailPage.spec.ts`.

  Write `tests/unit/features/spam-filter/SpamFilterLink.spec.ts`: rendered only with `canReadPolicy` or `canReadRateLimits`, and the right route per kind with an optional fragment.
- [ ] T130 Implement `src/features/spam-filter/components/SpamFilterLink.vue` and export it from `src/features/spam-filter/index.ts`.
- [ ] T131 Add the "Spam filter and limits" section entry after Groupware, and the Delivery rate limit link, to `src/features/domains/pages/DomainDetailPage.vue` (P16).
- [ ] T132 Add the entry to `src/features/mailboxes/components/display/MailboxSectionNav.vue`, and fill the `to` of the notification and rate limit entries in `src/features/mailboxes/components/display/ManagedSettingsGroup.vue` (P17).
- [ ] T133 Add the link to `src/features/alias-domains/pages/AliasDomainDetailPage.vue`, and point its rate limit note and its creation report's rate limit hint at `spam-filter-alias-domain` with `#rate-limit` (P18). Do the same for the rate limit hints of UI 002's and UI 003's creation reports, where they exist.
- [ ] T134 Add the entry point labels (`spamFilter.entry.*`) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. `npm run i18n:check` must pass. T128 and T129 must pass.

**Checkpoint**: Every host screen links to this feature, and no link appears where the target is
not reachable.

---

## Phase 13: Polish & Cross-Cutting Concerns

- [ ] T135 [P] Write and pass `tests/e2e/quarantine/reflow-and-keyboard.spec.ts`. On every screen and dialog of this feature:
  - no horizontal scroll at 360 and 320 px;
  - reflow at 400 % zoom on a 1,280 px window (FR-072);
  - touch targets of at least 44 × 44 px (FR-073);
  - focus never hidden behind the sticky action or bulk bars (FR-075);
  - keyboard-only completion of selection, filters, sorting, the list switch, the pickers and every dialog, with Escape closing a dialog unless an action runs (FR-078);
  - the numeric and e-mail keyboards (`inputmode`) and autocorrect off on the fields of FR-074.
- [ ] T136 [P] Write and pass `tests/e2e/quarantine/storage-and-memory.spec.ts`. After the US1, US4 and US7 flows and a download:
  - `localStorage`, `sessionStorage` and IndexedDB hold only UI 001's allowed keys (FR-085);
  - after sign-out, Back shows no quarantine content, and the query cache holds no item detail.
- [ ] T137 Run `npm run build && npm run budget:check && npm run lhci`. Fix regressions until the initial JavaScript is unchanged and at most 204,800 bytes gzipped, and `/ng/quarantine` scores at least 0.9 for performance and accessibility (SC-010). Typical fixes: lazy dialogs, and splitting the settings page chunk.
- [ ] T138 [P] Add the plan's three parity notes to the "Legacy Parity" tables of `specs/006-quarantine-spam-policy/spec.md`: visible bidi and control markers, the statistics period, and downloads always saved.
- [ ] T139 Run `quickstart.md` Part B on a mid-range Android phone and an iPhone with `npm run preview:mock` on the local network. Record:
  - the SC-001 and SC-010 timings;
  - a VoiceOver and TalkBack pass through US1, US2, US4 and US7;
  - the SC-011 moderated test with at least 5 mailbox users.

  Write them in the "Validation log" of `specs/006-quarantine-spam-policy/quickstart.md`.
- [ ] T140 Run `quickstart.md` Part C (`scripts/smoke/stack-up.sh`, `npm run test:smoke -- --grep @006`, `scripts/smoke/stack-down.sh`) against the dev stack with API 006 implemented, and trigger the CI `smoke` job through `workflow_dispatch`. Once it passes, the smoke suite counts as this feature's merge gate (plan, Complexity Tracking). Then run quickstart Part D on a mailcow host: the SC-006 value comparison of ten items with the classic quarantine, the round trips of step 3, and the `learnham` check of step 4. Record the results in the "Validation log" of `specs/006-quarantine-spam-policy/quickstart.md`.
- [ ] T141 [P] Run `npm run i18n:check`, remove the unused keys it reports from `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, check that no new string duplicates a legacy key of the form map, and list the new cs-cz and sk-sk strings of this feature for the owner's review (plan, owner question 2).

---

## Dependencies & Execution Order

### External dependencies

| Depends on | Needed by | Why |
|---|---|---|
| UI 001 (implemented) | everything | stack, client, shell, catalogue, primitives, mock and fixtures (P01, P02) |
| UI 002 (implemented) | Phase 2 onwards | bulk selection, bar and summary; typed confirmation; editable sections; History links and audit target filters; `meta.roles`; scroll restoration; `SearchField`, `IdnText` and `utf8ByteLength`; coverage manifest; domain page (P03–P13, P16) |
| UI 003 (implemented) | Phase 2, US2, US3, Phase 12 | `DomainPicker`, `AclReadOnlyNote`, identity refresh, mailbox detail areas, mailbox list bulk area, `getMailbox` key (P12, P14, P15, P17) |
| UI 004 (implemented) | Phase 2, Phase 12 | the `DomainPicker` promotion, the alias domain detail with `isEntryAvailable` links, the resource detail, the `aliasDomains` catalogue entry (P14, P18, P19) |
| UI 005 (implemented) | T001 | the pin to start from (P22) |
| API 006 contract (merged) | T001 | operations and types |
| API 006 implementation (dev stack) | T048, T064, T074, T084, T093, T101, T110, T119, T140 | smoke suite (P23) |
| UI 011 (later) | — | reuses `ResetBucketDialog` from `@/features/rate-limits` for its "Reset rate limit" (FR-058; UI 011 FR-039) |

### Phase dependencies

- **Setup (Phase 1)**: T001 first, because the generated types are needed everywhere. T003 needs
  T002, and T005 needs T004. The others are [P] after T001.
- **Foundational (Phase 2)**: T009a first (the legacy form map). Then T010 → T011 → T012. Then the tests T013–T024 (all [P]) and the mock
  baseline T025 → T026, plus T027. Then the implementation T028–T038. T032 needs T031. T036 needs
  T035 when the prefix was missing. T038 last.
- **User stories (Phases 3–11)** depend on the foundation:

  | Story | Priority | Depends on | Why |
  |---|---|---|---|
  | US1 | P1 | Foundational | MVP: list, item, actions, downloads |
  | US2 | P1 | US1 | extends the list page, the filters, the cards and rows, and `ItemSummary` (T067, T068) |
  | US3 | P2 | Foundational | panel on the object page skeleton (T036); bulk in UI 003's list |
  | US4 | P2 | Foundational | own page; panels reused by US5 |
  | US5 | P2 | US4 | mounts `SpamScorePanel` and `PolicyListsPanel` (T086, T087) on the object pages |
  | US6 | P2 | Foundational | own panel and overview; the section navigation from T037 |
  | US7 | P2 | Foundational | own page |
  | US8 | P3 | Foundational | own page |
  | US9 | P3 | US3, US4, US5, US6, US7 | places History links in their panels and pages (T126) |

- **Entry points (Phase 12)** depend on US3, US5 and US6 (all panels exist).
- **Polish (Phase 13)** depends on every phase it verifies.

### Files edited by several stories (serialise these edits)

- `src/app/router/routes.ts` and `src/app/navigation/catalogue.ts`: T036, T037, T053, T057, T076,
  T088, T105, T114, T120.
- `src/features/quarantine/routes.ts`: T053, T057, T076, T114, T120. Literal routes always stay
  before `quarantine-item`.
- `src/features/quarantine/api.ts`: T032, T049, T065, T075, T111, T120.
- `src/features/spam-filter/api.ts`: T085, T094.
- `src/features/spam-filter/pages/ObjectSpamFilterPage.vue`: T036, T077, T095, T103.
- `src/features/quarantine/pages/QuarantineListPage.vue` and `components/QuarantineFilters.vue`:
  T052, T053, T067.
- `tests/mocks/handlers/quarantine.ts`: T026, T039, T059, T070, T107.
- `tests/mocks/handlers/spam-policy.ts`: T080, T090, T116.
- `tests/mocks/scenarios/{quarantine,spam-filter}.ts` and `index.ts`: each story's fixture task.
- `src/i18n/messages/*.json` (new strings only): T038, T058, T069, T079, T089, T096, T106, T115,
  T121, T127, T134, T141.

### Within each user story

Mock handlers and scenarios first, then end-to-end, unit and smoke tests (which must fail), then
the implementation (api → pure modules → composables → components → pages and routes), then the
form map's new strings in en-gb, cs-cz and sk-sk (legacy keys are used verbatim, never copied).

### Parallel opportunities

- Setup: T002, T004, T006, T007, T008 and T009 after T001.
- Foundational: T013–T024 in parallel; T028–T031 and T033 in parallel.
- Stories: after Foundational, US1, US3, US4, US6, US7 and US8 can be staffed in parallel. US2
  follows US1, US5 follows US4, and US9 follows US3–US7.
- Within a story, every [P] task.

---

## Parallel Example: User Story 1

```bash
# After T039 and T040 (handlers, scenarios), write all US1 tests together:
Task: "T041 tests/e2e/quarantine/list.spec.ts"
Task: "T042 tests/e2e/quarantine/item.spec.ts"
Task: "T043 tests/e2e/quarantine/actions.spec.ts"
Task: "T044 tests/e2e/quarantine/downloads.spec.ts"
Task: "T045 tests/e2e/quarantine/hostile-content.spec.ts"
Task: "T046 tests/unit/features/quarantine/{list-state,symbols,content-preview,action-outcome}.spec.ts"
Task: "T047 tests/unit/features/quarantine/{ReleaseDialog,ItemActionBar,MessageContent,AttachmentList,QuarantineStatusNotice,useItemAction}.spec.ts"
Task: "T048 tests/smoke/quarantine.smoke.spec.ts"

# Then, after T049 and T050:
Task: "T051 symbols.ts, content-preview.ts, action-outcome.ts"
Task: "T052 list components"
Task: "T054 item section components"
Task: "T055 dialogs"
# T053 and T057 both edit routes.ts: run them one after another.
```

## Parallel Example: User Story 6

```bash
Task: "T098 tests/e2e/rate-limits/rate-limit-panel.spec.ts"
Task: "T099 tests/e2e/rate-limits/overview.spec.ts"
Task: "T100 tests/unit/features/rate-limits/*.spec.ts"
Task: "T101 tests/smoke/rate-limits.smoke.spec.ts"
# after T102:
Task: "T103 RateLimitPanel, RateLimitForm, RemoveLimitDialog"
Task: "T104 RateLimitList, SetRateLimitDialog, MailboxSearchPicker, ResetBucketDialog"
```

---

## Implementation Strategy

### MVP first (User Story 1)

1. Phase 1 (Setup), then Phase 2 (Foundational): the pin, tooling, plain text, downloads, numbers,
   permissions, the object page skeleton and the mock.
2. Phase 3 (US1): the list, item, actions and downloads for mailbox users.
3. **Stop and validate**: `npm run test:e2e -- --grep "US1-|SC-002"` on both viewports, and the US1
   rows of quickstart Part B. The quarantine is usable from the new app.

### Incremental delivery

1. US1, then US2: the whole quarantine for every role.
2. US3 (notifications, including the mailbox list bulk actions), then US4 and US5 (spam score and
   lists), then US6 (rate limits): the settings that legacy keeps in tabs.
3. US7 (settings), then US8 (statistics), then US9 (history).
4. Phase 12 (entry points), then Polish: reflow, storage, budgets, parity notes, validation and the
   smoke gate.

### Parallel team strategy

After Foundational:

- Developer A: US1, then US2.
- Developer B: US4, then US5, then US9 (after US3, US6 and US7).
- Developer C: US3, then US6.
- Developer D: US7, then US8, then Phase 12.

Edits to the shared files listed above run one at a time.

---

## Notes

- [P] tasks touch different files and have no dependency on an incomplete task.
- [USn] labels map tasks to the spec's user stories, and test titles carry the spec IDs for
  traceability.
- Verify that each test fails before implementing (constitution VI).
- Commit after each task or logical group, directly to `main`, with short imperative subjects.
- Never add a hand-written API type, a `v-html`, an inline style or script, a storage key, an
  automatic repeat of an item action, a timer refresh, or a hard-coded limit that the capabilities
  carry. Never render message data except through `PlainText`.
