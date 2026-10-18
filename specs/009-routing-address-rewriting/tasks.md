---
description: "Task list for UI feature 009: routing and address rewriting"
---

# Tasks: Routing and Address Rewriting

**Input**: Design documents from `specs/009-routing-address-rewriting/`:
- [plan.md](./plan.md)
- [spec.md](./spec.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/README.md](./contracts/README.md)
- [quickstart.md](./quickstart.md)

**Prerequisites**:
- plan.md, spec.md, research.md, data-model.md and contracts/ are complete.
- **UI 001–008 are implemented** (UI 001's foundation; UI 002's domain page with its section list,
  bulk selection and action bar, typed confirmation, section editing, leave guard, History link,
  role-restricted routes, coverage manifest and legacy map object entries; UI 003's mailbox layout
  with child-route sections, `ActiveFilterChips` and `AclReadOnlyNote`; UI 005's `PasswordInput`
  and `CopyButton`; UI 005's and UI 007's permission flag labels). T001 verifies them.
- **API 009 is released** (contract merged and implementation running in the API dev stack), so
  the contract bump (T002) and the smoke specs run against it.

**Tests**: Mandatory (constitution VI, test-first). In every phase, tests are written first and must
fail before the implementation tasks that follow them. Every end-to-end spec:
- runs on `mobile-chromium` (360 px), `desktop-chromium` and `mobile-webkit`;
- calls `expectAccessible` (axe, WCAG 2.2 AA, both themes) on every screen and state it reaches;
- calls `expectNoHorizontalScroll` (360 and 320 px) and `expectTouchTargets` on every screen;
- fails on any CSP violation or mock contract violation, through UI 001's fixtures;
- names its spec reference in the test title (`US1-AS3 …`, `FR-045 …`, `SC-004 …`, `Edge: …`).

**Organization**: Tasks are grouped by user story (spec priorities P1 to P3), so that each story can
be implemented and tested on its own once the foundation is in place.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task belongs to (US1 to US9)
- Paths are relative to the repository root `mailcowui-ng/`. `routing/` below means
  `src/features/routing/`, and `routing tests` means `tests/unit/features/routing/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify the prerequisites from earlier UI features, pin a contract that contains API 009,
and extend the i18n tooling for rich legacy hints and the routing enumerations (research R1, R20,
R21).

- [ ] T001 Verify the prerequisites of research R1 against the implemented code and fill the "Prerequisites table" in `specs/009-routing-address-rewriting/plan.md` with the actual file names, route names and query keys:
  - `useBulkSelection`, `BulkActionBar` and `BulkResultSummary` (selection of the current page only, cleared through `useListState`'s `onReset`, targets `{ id, version }` with the unquoted `etag`, one row per `BulkItemResult`, failed, refused and outdated items kept selected, "outcome unknown" on a network failure);
  - `ConfirmDialog` with `requireTyped` and rich content;
  - `useVersionedSave` with `changedSince` ("Save again", "Discard my changes"), `EditableSection.vue` and `useLeaveGuard` (canonical names in `docs/conventions.md`);
  - `HistoryLink.vue` and the `targetType`/`targetId` parameters of `src/features/audit-log/list-state.ts`;
  - `route.meta.roles` support in `src/app/navigation/visibility.ts` and `src/app/layouts/ShellLayout.vue` (`NoAccessState` in place, no route component mounted);
  - `ActiveFilterChips.vue`, the not-found state with a back link, `AclReadOnlyNote.vue`, `src/shared/components/password/PasswordInput.vue` and `CopyButton.vue`;
  - UI 002's domain page `src/features/domains/pages/DomainDetailPage.vue` (route `domain-detail`, key `['domains','detail',name]`): how it lists its sections and opens one with `edit=<section>`, and the read-only relayhost row of "Delivery";
  - UI 003's mailbox layout (route `mailbox-detail`, key `['mailboxes','detail',address]`): `src/features/mailboxes/routes.ts` (child routes), `src/features/mailboxes/sections.ts`, `components/display/MailboxSectionNav.vue` and `components/display/ManagedSettingsGroup.vue` (the relayhost entry of FR-040);
  - the mock state of domains and mailboxes in `tests/mocks/scenarios/state.ts` and `tests/mocks/handlers/{domains,mailboxes}.ts`;
  - the translation coverage registry (`src/i18n/coverage.json`), `ENUM_NAMESPACES` in `scripts/i18n/lib.mjs`, the `{ "from", "stripMarkup" }` entries of `src/i18n/legacy-map.json`, any existing rich hint support (`RichText.vue`; otherwise T003, T004, T013 and T023 build it), and the `permissionFlags.<flag>` labels of `bccMaps`, `domainRelayhost` and `mailboxRelayhost` (otherwise T027 adds them).

  Build any missing building block at the location its plan names, with the behaviour that plan fixes, tests first, before Phase 2. If an implemented name differs from the one used in this file, replace it here in `tasks.md` in the same commit.
- [ ] T002 Bump the contract (research R1): run `scripts/contract/bump.sh <commit>` with the mailcow-rest-v2 commit that the API 009 implementation was released against, or its release tag (planning baseline `32079252d55797d3da4e58ae661e9fb91c51c6f9`, bundle sha256 `5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6`). Never move the pin backwards: if `contract/VERSION.json` already pins a later commit whose 46 routing operations equal the baseline's, keep it. Then:
  - confirm all 46 operationIds of `specs/009-routing-address-rewriting/contracts/README.md` exist in `contract/openapi.json`;
  - re-export the routing root types of data-model §1 and the enumeration arrays of research R21 from `src/api/index.ts`;
  - replace the baseline rows of `specs/009-routing-address-rewriting/contracts/README.md` with the final commit and sha256;
  - run `npm run typecheck`, `npm run test:unit` and `npm run test:e2e`, and fix what the bump breaks in earlier features.
- [ ] T003 [P] Write `tests/unit/scripts/i18n-rich.spec.ts` against fixture message sets (research R20, R21). Skip the parts that T001 found already present. Cover:
  - `src/i18n/legacy-map.json` accepts `"app.key": "legacy.key"`, UI 002's `{ "from": "legacy.key", "stripMarkup": true }` and the new `{ "from": "legacy.key", "rich": true }`; `rich` and `stripMarkup` together are refused;
  - the rich conversion: `<br>`, `<br/>` and `<br />` with their following `\r\n` become `\n`; other `\r\n` become a space; `&#8226;` at a line start becomes `- `; `<b>`/`<strong>` become `**…**`; an unmatched `</b>` is dropped (the shape of `admin.transports_hint`); `<code>` becomes `` `…` ``; `<a href="http://www.postfix.org/postconf.5.html#smtp_tls_policy_maps" target="_blank">text</a>` becomes `[text](url)`; `&amp; &lt; &gt; &quot; &#39; &#8226;` are decoded; vue-i18n special characters are escaped afterwards (`@` in `null@hosted.mailcow.de`);
  - refusals: any other tag or attribute, and a link with a scheme other than `http` or `https`, fail with the key and locale named; a non-rich key with HTML is still refused (UI 001 R15);
  - `%s` placeholders become `{0}`, `{1}` in order (`danger.bcc_exists` has two);
  - the check: rich keys parse in all three locales and have equal link targets.

  The tests must fail.
- [ ] T004 Implement the rich legacy hints in `scripts/i18n/lib.mjs`, `scripts/i18n/import-legacy.mjs` and `scripts/i18n/check.mjs`, so that T003 passes. Keep every rule of UI 001 R15 and R27, UI 002 D2 and D27, and UI 003 R2. The routing enumeration values are registered by the tasks that add their messages (T027, T115), so that `npm run i18n:check` stays green after every task.

**Checkpoint**: the pin contains API 009, all earlier tests still pass, and the i18n tooling accepts
rich entries.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The routing slice of the mock, the routing capabilities, access rules, list states,
bulk wiring, problem mapping, entry form logic, the generic list components, `RichText`, the index
page and the shared messages. Every story renders in these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Test infrastructure

- [ ] T005 Extend `tests/mocks/scenarios/state.ts` with the routing slice (research R23): relayhosts (with a stored password that is never serialised), transports, BCC maps, recipient maps, TLS policy maps, forwarding hosts, a DNS table (`name → addresses | none | temporaryFailure`), connection test scripts per entry, the routing capabilities values (`bulkLimit` 100, `pageSize` 25/1000, BCC limits 255, `connectionTest` `relay@example.org`, `null@hosted.mailcow.de`, 15 s, 60 s, `maxLengths` 255, the eight policies, lookup limit 10) and a `relayhostId` on UI 002's domains and UI 003's mailboxes. Create the factories `tests/mocks/factories/{relayhost,transport,bcc-map,recipient-map,tls-policy-map,forwarding-host,connection-test}.ts`, which build contract-valid representations with a deterministic `etag` over the stored settings (never over `usage`, `nextHopSharedWith` or `orphaned`).
- [ ] T006 Implement `tests/mocks/handlers/routing-capabilities.ts` (`getRoutingCapabilities`: every value for administrators, `administration: null` for domain administrators, `403 forbidden` for mailbox users) and register it in `tests/mocks/handlers/index.ts`. Create `tests/mocks/scenarios/routing/index.ts` (registers every routing area module and composes `routing-admin-default` from each area's seed function) and `tests/mocks/scenarios/routing/base.ts` with the scenarios `routing-admin-empty`, `routing-admin-default`, `routing-da-bcc` (domain administrator of `example.org` and `example.net` with `bccMaps`, `domainRelayhost` and `mailboxRelayhost`), `routing-da-readonly` (the same domains, no routing flag) and `routing-mailbox-user`. Register the routing index in `tests/mocks/scenarios/index.ts`.

### Tests for the foundation (write first; must fail)

- [ ] T007 [P] Write `routing tests/access.spec.ts`, table-driven over the predicates of data-model §2 (`canOpenScreen`, `canWriteRouting`, `canWriteBccMaps`, `canEditDomainRelayhost`, `canEditMailboxRelayhost`, `canListRelayhostChoices`, `canSeeHistory`) × the roles admin, domainAdmin and mailboxUser × the flags `bccMaps`, `domainRelayhost`, `mailboxRelayhost`. Update `tests/unit/app/navigation/visibility.spec.ts`: the `routing` row is visible to every domain administrator, with or without `bccMaps` (research R2), and never to mailbox users.
- [ ] T008 [P] Write `routing tests/capabilities.spec.ts`: query key `['routing-capabilities']` with `staleTime` 5 minutes; the administrator and domain administrator shapes; page size options 25, 50 and 100 filtered by `pageSize.maximum`; an error exposes a retry (research R3).
- [ ] T009 [P] Write `routing tests/list-states.spec.ts` for the seven schemas of data-model §5 (relayhosts, relayhost usage, transports, BCC maps, recipient maps, TLS policy maps, forwarding hosts): parameter types, defaults omitted from the address, invalid values normalised with `replace`, repeated `domain` (≤ 100) and `policy` (≤ 8) values, `orphaned` ignored for domain administrators, the mapping to the generated query parameters, and the reset of `page` and the selection on filter, sort and size changes.
- [ ] T010 [P] Write `routing tests/logic/bulk-actions.spec.ts` and `routing tests/composables/useRoutingBulk.spec.ts` (research R5, data-model §2 BulkActionCatalogue):
  - the actions per collection come from the generated `*BulkActionRequestActionValues`;
  - `targetOf` sends `{ id, version }` with `version` = the `etag` without its surrounding quotes (`BulkTarget.version`), with the stored address unencoded as `id` for forwarding hosts;
  - `useBulkSelection` receives `capabilities.bulkLimit`; at the limit, further selection is disabled with a message that states the limit, and the selection never exceeds the page;
  - `delete` asks a typed count confirmation, `deactivate` one explicit confirmation, `activate` on a selection with a `*` transport one explicit confirmation;
  - results are mapped to the selected entries by `id`; refused, outdated and failed entries stay selected; a whole-request `403` gives one message; a network failure gives "outcome unknown" and no retry; the summary is announced.
- [ ] T011 [P] Write `routing tests/problems.spec.ts` and extend `tests/unit/i18n/problems.spec.ts` (research R19):
  - `routing-entry-exists` puts the entry type's `danger.*_exists` message at `field` with a link to `conflictingId`;
  - `next-hop-credentials-differ` (username field) and `next-hop-interferes` (next hop field) name `nextHop` and link `transportIds`;
  - `permission-flag-required` gives "Missing permission: {flags}" from `requiredFlags`, invalidates `['identity']`, and reports nothing as done;
  - `503 temporary-failure` exposes `retryAfter`; `404` gives "no longer exists";
  - the validation codes and formats of the contracts README table, including `required` with `because: password` → `validation.requiredBecause.password`, `tooMany` with `max: 1` on `bccDestination` → `add.bcc_dest_format`, `invalidCharacter` with `characters`, and an unknown code or format falling back as in UI 001.
- [ ] T012 [P] Write `routing tests/logic/changed-fields.spec.ts` and `routing tests/composables/useEntryForm.spec.ts` (research R6): the save is passed in as a function (the direct client call for password forms, research R7; a mutation otherwise), so no password reaches a mutation cache; only changed members after trimming are sent; `If-Match` carries the read `etag`; creation sends filled members; a `412` keeps the input, refetches, and marks the fields whose stored value changed; a refused save keeps all values except passwords and focuses the error summary; a `404` gives "no longer exists"; the dirty state arms `useLeaveGuard`, which a successful save disarms. A `412` offers "Save again" (only the fields that differ from the reloaded entry, with its version) and "Discard my changes", through `changedSince`.
- [ ] T013 [P] Write `tests/unit/shared/components/RichText.spec.ts` (research R20), unless T001 found it: line breaks, `- ` runs as `<ul>`, `**` as `<strong>`, backticks as `<code>`, `[text](url)` as a link with `target="_blank"`, `rel="noopener noreferrer"`, an icon and the hidden words "(opens an external site)"; a `javascript:` link renders as text; no `innerHTML` is ever set (assert through the rendered VNodes).
- [ ] T014 [P] Write `routing tests/components/common.spec.ts` for:
  - `EntryList.vue`: cards with every column below 768 px, a table with `aria-sort` headers from 768 px, selection checkboxes only in selection mode, entry actions;
  - `ListToolbar.vue`: debounced search with `replace`, one "Filters and sorting" control below 768 px, the active filters as `ActiveFilterChips` with "Clear all", refresh, "Add" only for permitted users, `BulkActionBar`'s "Select" only for permitted users, the "N entries" announcement after a search or filter change;
  - `EntryActionsMenu.vue`: labelled "Actions for {entry}", 44 × 44 px items, keyboard operation, focus returned;
  - `ScreenIntro.vue`: collapsed below 768 px, open above, rich texts rendered through `RichText`;
  - `RoutingSectionNav.vue`: a disclosure below 768 px, a wrapping link row with `aria-current="page"` above, no horizontal overflow;
  - `StatusText.vue`: status as words with an optional icon;
  - `FormActionBar.vue`: sticky at the bottom, Save and Cancel reachable without scrolling.
- [ ] T015 [P] Extend `tests/unit/shared/validation/limits.spec.ts`: the new constants equal `ForwardingHostCreateRequest.host.maxLength` (255) and `RoutingConnectionTestRequest.sender.maxLength` and `.recipient.maxLength` (255) in `contract/openapi.json` (research R3).
- [ ] T016 [P] Write `tests/e2e/routing/routing-shell.spec.ts`, using only what exists after Phase 2:
  - FR-001: an administrator sees the Routing entry, `/ng/routing` shows the index heading, the section introduction and the section navigation, at 360 px and on desktop;
  - FR-002: a domain administrator with and without `bccMaps` sees the Routing entry; a mailbox user sees none, and `/ng/routing` shows "no access" with no routing request in `mockApi.requests()`;
  - the index lists only the screens whose stories are done (data-model §2 `screens.ts` status), and none for a domain administrator until US5.

### Implementation for the foundation

- [ ] T017 Implement `routing/screens.ts` (the six screens of data-model §2 in the order of FR-001, each with `status: 'pending'`; each story flips its screen to `'available'`) and `routing/access.ts`. Change the `routing` entry of `src/app/navigation/catalogue.ts` to `access: { admin: true, domainAdmin: true, mailboxUser: false }` and `status: 'available'`. T007 must pass.
- [ ] T018 Implement `routing/capabilities.ts` (`useRoutingCapabilities`, page size options) and add every routing key of data-model §3 to `src/api/query/keys.ts`, with list parameter types aliased from the generated `operations[…]['parameters']['query']`. T008 must pass.
- [ ] T019 Implement `routing/list-states/{relayhosts,relayhost-usage,transports,bcc-maps,recipient-maps,tls-policy-maps,forwarding-hosts}.ts` on `useListState`, with the sort values from the generated `componentsParameters*SortValues`. T009 must pass.
- [ ] T020 Implement `routing/logic/bulk-actions.ts` and `routing/composables/useRoutingBulk.ts` on UI 002's `useBulkSelection`, `BulkResultSummary` and `ConfirmDialog` (`requireTyped`). T010 must pass.
- [ ] T021 Implement `routing/problems.ts` and the `because` rule in `src/i18n/problems.ts`. T011 must pass.
- [ ] T022 Implement `routing/logic/changed-fields.ts` and `routing/composables/useEntryForm.ts` on `useVersionedSave` (with `changedSince`), `useProblemForm` and `useLeaveGuard`. T012 must pass.
- [ ] T023 [P] Implement `src/shared/components/RichText.vue` (VNodes only, links through `safeHref`), unless T001 found it. T013 must pass.
- [ ] T024 [P] Add the forwarding host and test address constants to `src/shared/validation/limits.ts`, each with a comment naming its schema path. T015 must pass.
- [ ] T025 Implement `routing/components/common/{EntryList,ListToolbar,EntryActionsMenu,ScreenIntro,RoutingSectionNav,StatusText,FormActionBar}.vue` on the TailAdmin primitives (`table`, `collapsible`, `dropdown-menu`, `checkbox`), native `<select>` elements, UI 001's `ListState`, `PaginationBar` and `useAnnouncer`, UI 002's `BulkActionBar` and UI 003's `ActiveFilterChips`. T014 must pass.
- [ ] T026 Implement `routing/pages/RoutingIndexPage.vue` (the available screens the user may open; with exactly one, `router.replace` to it), `routing/routes.ts` (the `routing` route with `meta.navEntry: 'routing'`) and `routing/index.ts` (exports the routes). Register the routes in `src/app/router/routes.ts`. T016 must pass.
- [ ] T027 Register the closed routing enumerations of research R21 in `ENUM_NAMESPACES` (`scripts/i18n/lib.mjs`), append the `ValidationRuleCode` and problem type values of research R21 to the coverage manifest found by T001 (only those not yet listed), and add the shared routing messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`:
  - `routing.common.*` (statuses, password status texts, list and bulk texts, "Whole domain", the port 465 warning), `routing.screens.*`, `routing.bulk.*`;
  - every `enums.<name>.<value>` key that T004 requires for the closed routing enumerations: TLS policy explanations (the policy names stay untranslated), BCC types and destination kinds, test steps, failure reasons, login states, host sources, transcript directions, reference states, usage kinds, creation outcomes, the three flags, the six bulk action sets and the seven sort parameters;
  - `validation.format.{nextHop,transportDestination,recipientMapDestination,tlsPolicyDestination,tlsPolicyParameters,domainName,email,ipNetwork}`, `validation.{invalidRegex,immutable,notResolvable,invalidCharacter}`, `validation.requiredBecause.password`, and `problem.{routing-entry-exists,next-hop-credentials-differ,next-hop-interferes,permission-flag-required,temporary-failure}` where earlier features have not added them;
  - `permissionFlags.{bccMaps,domainRelayhost,mailboxRelayhost}` if T001 found no labels, mapped to `acl.bcc_maps`, `acl.domain_relayhost` and `acl.mailbox_relayhost`.

  Add `src/i18n/legacy-map.json` entries for the shared legacy keys `admin.active`, `admin.inactive`, `admin.refresh`, `admin.remove`, `mailbox.activate`, `mailbox.deactivate`, `mailbox.toggle_all`, `edit.save`, `user.spamfilter`, `acl.bcc_maps`, `acl.domain_relayhost` and `acl.mailbox_relayhost`. Use "the classic interface" wording. Run `npm run i18n:import`; `npm run i18n:check` must pass.

**Checkpoint**: the foundation is ready. `/ng/routing` renders for administrators and domain
administrators, every Phase 2 test passes, and user stories can start.

---

## Phase 3: User Story 1 - Manage relayhosts (Priority: P1) 🎯 MVP

**Goal**: The Sender-dependent transports screen: list with search, filters, sorting and paging;
add, edit, activate, deactivate and delete with impact; usage view; bulk actions; write-only
passwords.

**Independent Test**: Against the mock, create, edit, deactivate and delete relayhosts with and
without credentials on 360 px and desktop, and verify that no stored password appears on screen,
in the page or in browser storage.

### Tests for User Story 1 (write first; must fail)

- [ ] T028 [US1] Implement `tests/mocks/handlers/relayhosts.ts`, registered in `tests/mocks/handlers/index.ts` (research R23):
  - `listRelayhosts` (`q` on host and username, `active`, `inUse`, the sorts `id`, `host`, `username`, `active`, `domainCount`, `mailboxCount`, ties by `id`, paging, `ListMeta`);
  - `createRelayhost` (`201` with `Location` and `ETag`; active unless `active: false`; host grammar `host`, `host:port`, `[host]`, `[host]:port`, a bare IP stored in brackets; `invalidFormat` with `format: nextHop`; `invalidCharacter` for `:` in a username; `required` with `because: password`; lengths ≤ 255);
  - `getRelayhost`; `updateRelayhost` (merge patch, `If-Match`/`412`, omitted password kept, `""` removes, an empty username removes the password, `id` and `usage` accepted only with their current values, otherwise `immutable`);
  - `deleteRelayhost` (clears every domain and mailbox assignment, `If-Match`/`412`);
  - `listRelayhostUsage` (`kind`, `q`, sorts `kind` and `name`);
  - `applyRelayhostBulkAction` (per-target `version`, `outdated`, `notFound`, a target named twice processed once, more than `bulkLimit` targets refused with `tooMany`);
  - `listRelayhostChoices` (administrators; domain administrators with either relayhost flag; otherwise `403 permission-flag-required` with both flags).

  Create `tests/mocks/scenarios/routing/relayhosts.ts` with the seed for `routing-admin-default` (relayhost 1 `[smtp.example.net]:587` with username and password; relayhost 2 used by `example.org`, `example.net` and three mailboxes; relayhost 3 inactive; relayhosts 4 and 5 with the same host and different usernames) and the scenarios `routing-relayhosts-many` (120 relayhosts) and `routing-relayhost-changed-elsewhere` (the etag of relayhost 1 changes through `PATCH /__mock/scenarios/:id`). Register it in `tests/mocks/scenarios/routing/index.ts`.
- [ ] T029 [P] [US1] Write `tests/e2e/routing/relayhosts.spec.ts`:
  - US1-AS1 and FR-019: cards at 360 px with host, `#id`, username, password status, active state and the domain and mailbox counts, and a table on desktop, without horizontal scrolling;
  - US1-AS2 and FR-006: the empty state explains relayhosts and offers "Add"; "no entries match" offers to clear the search and filters;
  - FR-001 and FR-008: the introduction (`admin.relayhosts_hint`, rich) and "also called relayhosts", collapsed at 360 px;
  - FR-020 and FR-004: search, the active and in-use filters behind one control at 360 px, every sort, page size 50, all kept across a reload; the result count announced (FR-069);
  - US1-AS3 and FR-021: add `[smtp.example.net]:587` with credentials; active preselected; the legacy hints (brackets turn off the MX lookup, `add.relayhost_wrapped_tls_info`, `admin.add_relayhost_hint`); the new entry shown and the success announced;
  - US1-AS4: a host ending in `:465` shows the warning while typing and still saves;
  - US1-AS5, US1-AS6, FR-026 and FR-027: the edit form's empty password field with "Password stored"; saving without typing keeps it (no `password` in the request body, `mockApi.requests()`); "Remove password" is shown as pending and then results in "No password"; clearing the username shows the removal note;
  - Edge: a password typed without a username shows the API's refusal at the username field;
  - US1-AS7, FR-017 and FR-018: deleting relayhost 2 names `example.org`, `example.net` and the three mailboxes with "Show all", states the clearing, and deletes only after confirmation, Cancel being the default;
  - US1-AS8 and FR-013: an invalid host shows the translated message at the host field, keeps the other values, empties the password and focuses the error summary;
  - FR-022 and FR-024: identifier and usage read-only on the edit page; activate and deactivate from the card, deactivation confirmed;
  - FR-015 and FR-016: selection mode, "Select all on this page", bulk deactivate and bulk delete with the typed count, one result per entry, an outdated entry (`routing-relayhost-changed-elsewhere`) reported "outdated" and still selected, a dropped connection (`route.abort()`) reported "outcome unknown" with no second request;
  - SC-009: on `routing-relayhosts-many` with page size 100, a bulk action on 100 entries reports 100 outcomes;
  - FR-012: leaving the edit form with changes asks for confirmation;
  - Edge: a `412` on save keeps the input, marks the changed field and saves on the second attempt; a refused deletion is confirmed again;
  - Edge: relayhost 4 and 5 are told apart by identifier and username; a 255-character host wraps;
  - Edge: an entry deleted elsewhere shows "no longer exists" with the way back;
  - FR-002 and FR-003: a domain administrator opening `/ng/routing/relayhosts` gets "no access" and no `listRelayhosts` request.
- [ ] T030 [P] [US1] Write `tests/e2e/routing/relayhost-usage.spec.ts`: FR-023: the usage view of relayhost 2 pages, filters by kind, searches the name, keeps its state in the address, and links each domain to `/ng/domains/<name>` and each mailbox to `/ng/mailboxes/<address>`.
- [ ] T031 [P] [US1] Write `routing tests/logic/credentials.spec.ts` (the patch rules table of research R7 and the derived notes of data-model §2) and `routing tests/components/CredentialFields.spec.ts`: empty password field with the stored status; "Remove password" pending and "Undo"; the cleared-username note; UI 005's `PasswordInput` masked by default with its labelled show/hide toggle; `autocomplete="new-password"`, `data-1p-ignore`, `data-lpignore="true"`, `data-bwignore` on the password input element and `autocomplete="off"` with the name `relay-username` on the username; the typed password cleared after a successful save, a refused save and unmount.
- [ ] T032 [P] [US1] Write `routing tests/logic/next-hop.spec.ts`: `endsWithPort465` for `host:465`, `[host]:465` and `[2001:db8::1]:465`, but not `host:4650` or a bare IPv6 address ending in `465`; whether the input is bracketed (for the MX hint).
- [ ] T033 [P] [US1] Write `routing tests/components/relayhosts.spec.ts` for `relayhost-columns.ts` (fields and actions per role), `RelayhostFilters.vue`, `RelayhostForm.vue` (fields, hints, maximum lengths from the capabilities, port 465 warning) and `RelayhostDeleteImpact.vue` (counts first, up to ten names per kind from two `limit=10` usage reads, "Show all", the failed-usage note).
- [ ] T034 [P] [US1] Write `routing tests/api/relayhosts.spec.ts`: each query, mutation and direct write of the relayhosts module sends the documented parameters, `If-Match` and the merge-patch content type, and applies the data-model §3 cache updates and invalidations; `createRelayhost` and `updateRelayhost` are direct client calls, and after a create, an update with a password and a refused update, neither `queryClient.getQueryCache()` nor `queryClient.getMutationCache()` holds the password (conventions "Secrets", research R7); a `401` from a direct call still triggers UI 001's session reaction.
- [ ] T035 [P] [US1] Write `tests/smoke/routing-relayhosts.smoke.spec.ts` (tag `@routing`): as `admin`, create `[relay.smoke.example]:587` with a random username and password, see "Password stored", search and filter, edit the host, remove the password, delete it; the password never appears in the page.

### Implementation for User Story 1

- [ ] T036 [US1] Implement `routing/api/relayhosts.ts`: list, detail and usage queries; `createRelayhost` and `updateRelayhost` (merge patch, `If-Match`) as plain async functions that call the generated client directly and hand problems to the session reaction of `src/app/session/` (never `useMutation`, research R7); delete (`If-Match`) and bulk as mutations; with the cache updates and invalidations of data-model §3.
- [ ] T037 [P] [US1] Implement `routing/logic/credentials.ts`, `routing/logic/next-hop.ts` and `routing/components/common/CredentialFields.vue` on UI 005's `src/shared/components/password/PasswordInput.vue` (attributes passed through, research R7).
- [ ] T038 [US1] Implement `routing/components/relayhosts/{relayhost-columns.ts,relayhost-usage-columns.ts,RelayhostFilters.vue,RelayhostForm.vue,RelayhostDeleteImpact.vue}`. The form takes its maximum lengths from `capabilities.administration.maxLengths` (`host`, `username`, `password`).
- [ ] T039 [US1] Implement `routing/pages/relayhosts/{RelayhostsPage,RelayhostCreatePage,RelayhostEditPage,RelayhostUsagePage}.vue` with `ListToolbar`, `EntryList`, `useRoutingBulk`, `useEntryForm` and `FormActionBar`; add the routes `routing-relayhosts`, `routing-relayhost-create`, `routing-relayhost-edit` and `routing-relayhost-usage` (`meta.roles: ['admin']`, `new` before the parameter route) to `routing/routes.ts`; set the `relayhosts` screen to `available` in `routing/screens.ts`.
- [ ] T040 [US1] Add the `routing.relayhosts.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` (including "also called relayhosts", the brackets hint, password status and removal texts, usage texts, deletion impact). Add `src/i18n/legacy-map.json` entries for `admin.relayhosts`, `admin.relayhosts_hint` (rich), `admin.add_relayhost`, `admin.add_relayhost_hint`, `add.relayhost_wrapped_tls_info` (rich), `admin.host`, `admin.username`, `admin.password`, `admin.in_use_by`, `success.relayhost_added` and `success.relayhost_removed`. Run `npm run i18n:import`; `npm run i18n:check` must pass.

**Checkpoint**: US1 works on its own: T029–T034 pass, and the smoke spec T035 passes against the
API dev stack. This is the MVP.

---

## Phase 4: User Story 2 - Assign a relayhost to a domain or a mailbox (Priority: P1)

**Goal**: Relayhost sections with their own save on UI 002's domain and UI 003's mailbox screens:
current assignment, searchable choice, effective relayhost of a mailbox, inactive and dangling
assignments, and the domain administrators' flags.

**Independent Test**: With the mock, assign, change and clear relayhosts on a domain and on a
mailbox as an administrator and as domain administrators with and without each flag.

**Depends on**: US1's T028 (relayhost and choice handlers) and T039 (the "Add" route that FR-036
links to).

### Tests for User Story 2 (write first; must fail)

- [ ] T041 [US2] Implement `tests/mocks/handlers/relayhost-assignments.ts`, registered in `tests/mocks/handlers/index.ts`: `getDomainRelayhostAssignment` and `replaceDomainRelayhostAssignment`, `getMailboxRelayhostAssignment` and `replaceMailboxRelayhostAssignment`, with `RelayhostReference` states `active`, `inactive` and `dangling`, the mailbox's `effectiveRelayhost` and `credentialsRelayhost` by the contract's rules, `404` outside a domain administrator's scope and for alias domains, `403 permission-flag-required` (`domainRelayhost` or `mailboxRelayhost`) checked before the lookup, `422 notFound` on `relayhostId` for an unknown relayhost, and `If-Match`/`412`. Make UI 002's and UI 003's handlers (`tests/mocks/handlers/domains.ts`, `tests/mocks/handlers/mailboxes.ts`) report the same `relayhostId` and change the domain's or mailbox's `etag` when it changes. Create `tests/mocks/scenarios/routing/assignments.ts` with the seed for `routing-admin-default` and the scenarios `routing-assignments` (`example.org` on relayhost 3 active; `alice@example.org` on an inactive relayhost; `bob@example.org` on relayhost 5 with `example.org` on relayhost 3, so both apply; `carol@example.net` dangling on relayhost 99), `routing-no-relayhosts`, `routing-da-domain-flag-only`, `routing-da-mailbox-flag-only` and `routing-assignment-changed-elsewhere`. Register it in `tests/mocks/scenarios/routing/index.ts`.
- [ ] T042 [P] [US2] Write `tests/e2e/routing/relayhost-sections.spec.ts`, on `/ng/domains/example.org` (section `relayhost`, form at `?edit=relayhost`) and `/ng/mailboxes/<address>/relayhost` (reached from the mailbox's section navigation and from the relayhost entry of its managed settings):
  - US2-AS1 and FR-029: an administrator chooses relayhost 3 and saves the section; the section shows it, and the usage count of relayhost 3 on the relayhost list includes the domain (FR-009);
  - US2-AS2 and FR-031: a domain administrator with the domain flag can change it; one without it sees host and active state read-only, with `AclReadOnlyNote` naming the permission;
  - US2-AS3 and FR-030: with the mailbox flag, assigning relayhost 5 to a mailbox shows it as assigned and effective, and the domain's relayhost 3 alongside, with `edit.mailbox_relayhost_info`;
  - US2-AS4 and FR-033: `alice@example.org` shows its relayhost labelled "inactive" in text and the domain's relayhost as effective;
  - US2-AS5 and FR-034: `carol@example.net` shows "no longer exists (#99), no effect" and can replace and clear it;
  - US2-AS6 and FR-014: on `routing-assignment-changed-elsewhere`, saving reports the change, keeps the choice and marks the reloaded value;
  - US2-AS7 and FR-036: on `routing-no-relayhosts`, the choice offers only "None / inherit" and, for an administrator, a link to add a relayhost;
  - FR-032: the administrator's options show host, `#id`, username and "inactive"; the domain administrator's options show no username; the choice searches and loads more;
  - FR-035: `bob@example.org` shows the note that the mail server connects to the mailbox's relayhost with the domain relayhost's credentials;
  - Edge: a domain administrator with only one flag gets the other section read-only (`routing-da-domain-flag-only`, `routing-da-mailbox-flag-only`);
  - FR-012: leaving a section with changes asks for confirmation;
  - Edge: a flag removed mid-session (`mockApi.patch`) makes the next save show "Missing permission" naming it, and the section becomes read-only after the identity refresh;
  - Edge: after deleting relayhost 3 on the relayhost screen, the domain section shows "None / inherit", and the domain's next section save of UI 002 is not refused as outdated;
  - SC-010 (sections): as `routing-da-readonly`, no control that changes an assignment exists in the DOM.
- [ ] T043 [P] [US2] Write `routing tests/logic/relayhost-section.spec.ts` for `RelayhostSectionView` (data-model §2): every reference state, `null`, the mailbox's domain assignment, effective relayhost with its source or direct delivery, `credentialsNote`, `editable` and `missingFlag` per role and flag.
- [ ] T044 [P] [US2] Write `routing tests/components/RelayhostChoicePicker.spec.ts`: "None / inherit" first; administrators query `listRelayhosts` and see the username, domain administrators query `listRelayhostChoices` and do not; 300 ms debounce; "Load more" over `useInfiniteQuery` (25 per page); empty, loading and error states; "inactive" in words; the no-effect note on choosing an inactive relayhost; only "None / inherit" plus, for administrators, the add link when there is no relayhost; focus kept in the list while open, Escape closes and returns focus (FR-071).
- [ ] T045 [P] [US2] Write `routing tests/components/sections.spec.ts` for `DomainRelayhostSection.vue` (UI 002's `EditableSection` with section ID `relayhost` driven by `edit=relayhost`: full screen below 768 px, in place above, one section open at a time) and `MailboxRelayhostSection.vue` (a child route page in UI 003's layout with its own Save and a back link to the overview below `lg`): read-only and editable modes, Save and Cancel, `412` marking with "Save again" and "Discard my changes", `permission-flag-required` handling, the dangling and inactive texts, `AclReadOnlyNote` when read-only, `useLeaveGuard` while dirty, and no choices request when not editable.
- [ ] T046 [P] [US2] Write `routing tests/api/relayhost-assignments.spec.ts`: `PUT` with `{ relayhostId }` and `If-Match`; the cache write; the invalidation of `['relayhost-assignments','mailbox']` (domain change), the relayhost lists, detail and usage, and UI 002's and UI 003's detail keys as recorded by T001.
- [ ] T047 [P] [US2] Write `tests/smoke/routing-assignments.smoke.spec.ts` (`@routing`): as `admin`, create a relayhost, assign it to `example.org` on the domain page, see it as effective on `alice@example.org`'s Relayhost section, clear it, and delete the relayhost; as `reseller`, see the sections read-only or editable according to its flags.

### Implementation for User Story 2

- [ ] T048 [US2] Implement `routing/api/relayhost-assignments.ts` (both reads, both replacements with `If-Match`) and the picker queries (`['relayhosts','picker',{q}]` over `listRelayhosts`, `['relayhost-choices',{q}]` over `listRelayhostChoices`, both infinite), with the invalidations of data-model §3.
- [ ] T049 [P] [US2] Implement `routing/logic/relayhost-section.ts`.
- [ ] T050 [US2] Implement `routing/components/sections/RelayhostChoicePicker.vue` (Reka `Combobox` without `ComboboxViewport`) and `routing/components/sections/RelayhostReferenceText.vue`.
- [ ] T051 [US2] Implement `routing/components/sections/DomainRelayhostSection.vue` (on `EditableSection`) and `routing/components/sections/MailboxRelayhostSection.vue` (a section page for UI 003's layout), with `AclReadOnlyNote` and `useLeaveGuard`. Export `DomainRelayhostSection` and the child route record `mailboxRelayhostRoute` (`path: 'relayhost'`, `name: 'mailbox-relayhost'`, lazy `MailboxRelayhostSection`) from `routing/index.ts`.
- [ ] T052 [P] [US2] In UI 002's domain page (`src/features/domains/pages/DomainDetailPage.vue`, or the name T001 recorded), add the section ID `relayhost` to the page's section list (so that `edit=relayhost` opens it and unknown-section normalisation accepts it) and mount `DomainRelayhostSection` after Groupware through `defineAsyncComponent` from `@/features/routing`, with its entry in the wide-screen section index (UI 002 data-model §9). Remove the read-only relayhost row of the "Delivery" section. Update UI 002's unit and end-to-end tests that asserted that row.
- [ ] T053 [P] [US2] In UI 003's mailbox feature (names as T001 recorded): list `mailboxRelayhostRoute` from `@/features/routing` among the `mailbox-detail` layout's children in `src/features/mailboxes/routes.ts`; add the `relayhost` entry (label `edit.relayhost`, shown to administrators and domain administrators, summary: the effective relayhost or "Direct delivery") to `src/features/mailboxes/sections.ts`, which `MailboxSectionNav.vue` renders; and set the `to` of the relayhost entry in `src/features/mailboxes/components/display/ManagedSettingsGroup.vue` to `{ name: 'mailbox-relayhost' }` (UI 003 data-model §8). Update UI 003's tests that asserted the unlinked relayhost entry.
- [ ] T054 [US2] Add the `routing.relayhostSection.*` messages (effective relayhost, direct delivery, credentials note, inactive and dangling notes, missing permission, add link) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, with `src/i18n/legacy-map.json` entries for `edit.relayhost`, `edit.none_inherit` and `edit.mailbox_relayhost_info`. Run `npm run i18n:import`; `npm run i18n:check` must pass.

**Checkpoint**: US1 and US2 work; a relayhost can be created and assigned on a phone.

---

## Phase 5: User Story 3 - Manage transports (Priority: P1)

**Goal**: The Transport maps screen: list with the shared-next-hop count and filter; add with
several destinations; edit; activation, deletion and bulk actions; shared credentials named before
and after every change.

**Independent Test**: With the mock, create transports of each destination kind, including two
that share a next hop, change shared credentials, and verify the warnings and the reported effects.

**Depends on**: US1's T037 (`CredentialFields`).

### Tests for User Story 3 (write first; must fail)

- [ ] T055 [US3] Implement `tests/mocks/handlers/transports.ts`, registered in `tests/mocks/handlers/index.ts`:
  - `listTransports` (`q` on destination, next hop and username, `active`, `mxBased`, `nextHop` exact without regard to letter case, the sorts `id`, `destination`, `nextHop`, `username`, `active`, `mxBased`, `nextHopSharedWith`);
  - `createTransport` (one destination; inactive unless `active: true`; inherit the next hop's credentials when none are sent; `409 next-hop-credentials-differ` for a different username; a password replaces the next hop's password on every transport; `409 routing-entry-exists` with `field: destination` and `conflictingId`; `409 next-hop-interferes` with `nextHop` and `transportIds`; `422` `invalidFormat` with `transportDestination` or `nextHop`, `invalidRegex` for an MX-based pattern; `meta.affectedTransports`);
  - `getTransport`; `updateTransport` (the `TransportPatch` rules, adoption of the target next hop's credentials when moved without credentials, `meta.affectedTransports`, `If-Match`/`412`); `deleteTransport`; `applyTransportBulkAction`.

  Create `tests/mocks/scenarios/routing/transports.ts` with the seed for `routing-admin-default` (transports A `a.example` and B `b.example` sharing `[mx.partner.net]:25` with username `u1`; C `example.com` to `relay.net`; D MX-based `.*\.google\.com`; E `*` inactive) and the scenario `routing-transports-many` (120 transports). Register it in `tests/mocks/scenarios/routing/index.ts`.
- [ ] T056 [P] [US3] Write `tests/e2e/routing/transports.spec.ts`:
  - US3-AS1 and FR-037: cards at 360 px with destination, next hop, `#id`, username, password status, "MX regular expression" in text for D, active state and "shares the next hop with 1 other transport", which opens the list filtered by that next hop;
  - FR-038: search, the active, MX-based and next hop filters and every sort, kept across a reload;
  - FR-039 and FR-040: the add form's hints (`admin.transport_dest_format`, `admin.lookup_mx` rich, `admin.transports_hint` rich in the introduction, `admin.add_transports_hint`), active preselected off with the `*` hint;
  - US3-AS2: three destinations separated by a line break, a comma and a semicolon create three inactive transports, and the result names each destination with its outcome;
  - US3-AS3: with one invalid destination of three, two are created and the invalid one stays in the field with its reason;
  - US3-AS4 and FR-041: changing A's password names B and asks for confirmation before saving, and afterwards states that B's credentials changed too;
  - FR-041: creating a transport on `[mx.partner.net]:25` without credentials states that it will use that next hop's credentials (username `u1`);
  - US3-AS5: creating a transport for that next hop with username `u2` explains that the next hop already has different credentials and links A and B;
  - US3-AS6: creating one with `[relay.net]:587` explains that the next hops interfere and names `relay.net`;
  - US3-AS7: entering `*` warns that it applies to every recipient, including the hosted domains; activating E asks for confirmation;
  - FR-042: edit one destination, next hop, MX-based, credentials and active state; activate, deactivate (confirmed) and delete; bulk activate, deactivate and delete with per-entry results;
  - Edge: a duplicate destination shows `danger.transport_dest_exists` at the destination field with a link to the existing transport;
  - Edge: a dropped connection during a batch reports that destination as "outcome unknown" and the rest as "not sent".
- [ ] T057 [P] [US3] Write `routing tests/logic/destinations.spec.ts`: split on line breaks, commas, semicolons and spaces; trim; drop empty items; remove case-insensitive duplicates keeping the first spelling and the order.
- [ ] T058 [P] [US3] Write `routing tests/composables/useTransportCreateBatch.spec.ts` for the state machine of data-model §7: sequential requests in order; destination-only refusals continue; other refusals and next-hop conflicts stop with field errors and "not sent"; a network failure gives "outcome unknown"; created entries leave the field; affected others exclude the batch's own creations; the summary is announced.
- [ ] T059 [P] [US3] Write `routing tests/composables/useSharedNextHop.spec.ts` and `routing tests/components/SharedNextHopNotice.spec.ts`: the lookup with `nextHop` (trimmed input, unnormalised) and `limit: 100` on blur and before a save, the edited transport excluded, the notice with up to ten names and "and {n} more", the "will use that next hop's credentials" note, and the confirmation only when a username or password is sent.
- [ ] T060 [P] [US3] Write `routing tests/components/transports.spec.ts` for `transport-columns.ts`, `TransportFilters.vue`, `TransportForm.vue` (create and edit modes, limits from `maxLengths.nextHop`, `transportDestination`, `username`, `password`), `DestinationListField.vue` (the `*` warning, failed destinations listed under the field) and `TransportCreateResults.vue`.
- [ ] T061 [P] [US3] Write `routing tests/api/transports.spec.ts`: parameters, `If-Match`, merge patch, `meta.affectedTransports` exposed, and the invalidation of the whole `['transports']` root after every write; `createTransport` and `updateTransport` are direct client calls, and no password remains in the query or mutation cache after a batch, an update and a refusal.
- [ ] T062 [P] [US3] Write `tests/smoke/routing-transports.smoke.spec.ts` (`@routing`): as `admin`, create transports for two destinations to one next hop with credentials in one form, see "shares the next hop", change the password on one and see the other named, then bulk delete both with the typed count.

### Implementation for User Story 3

- [ ] T063 [US3] Implement `routing/api/transports.ts` (list, next-hop lookup and detail queries; `createTransport` and `updateTransport` as direct client calls, never `useMutation`, research R7; delete and bulk as mutations) with the invalidations of data-model §3.
- [ ] T064 [P] [US3] Implement `routing/logic/destinations.ts`.
- [ ] T065 [US3] Implement `routing/composables/useSharedNextHop.ts` and `routing/composables/useTransportCreateBatch.ts`.
- [ ] T066 [US3] Implement `routing/components/transports/{transport-columns.ts,TransportFilters.vue,TransportForm.vue,DestinationListField.vue,SharedNextHopNotice.vue,TransportCreateResults.vue}`, using `CredentialFields`.
- [ ] T067 [US3] Implement `routing/pages/transports/{TransportsPage,TransportCreatePage,TransportEditPage}.vue`; add the routes `routing-transports`, `routing-transport-create` and `routing-transport-edit` (`meta.roles: ['admin']`) to `routing/routes.ts`; set the `transports` screen to `available` in `routing/screens.ts`.
- [ ] T068 [US3] Add the `routing.transports.*` messages (shared next hop, wildcard warning, batch results, conflicts) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, with `src/i18n/legacy-map.json` entries for `admin.transport_maps`, `admin.transports_hint` (rich), `admin.add_transport`, `admin.add_transports_hint`, `admin.destination`, `admin.nexthop`, `admin.transport_dest_format`, `admin.lookup_mx` (rich), `admin.is_mx_based`, `admin.credentials_transport_warning` (rich), `danger.transport_dest_exists`, `danger.invalid_destination`, `danger.invalid_nexthop` and `danger.invalid_nexthop_authenticated`. Run `npm run i18n:import`; `npm run i18n:check` must pass.

**Checkpoint**: all P1 stories (US1 to US3) work.

---

## Phase 6: User Story 4 - Test a relayhost or a transport (Priority: P2)

**Goal**: The connection test page for every relayhost and transport: optional addresses with the
server's defaults as placeholders, a guarded running state with a watchdog, a verdict-first
summary, and a transcript readable on a phone.

**Independent Test**: With mocked results for an accepted message, each failed step and a timeout,
run the test on both viewports and verify the summary and the transcript.

**Depends on**: US1 (relayhost pages and handlers) and US3 (transport pages and handlers).

### Tests for User Story 4 (write first; must fail)

- [ ] T069 [US4] Add `testRelayhostConnection` to `tests/mocks/handlers/relayhosts.ts` and `testTransportConnection` to `tests/mocks/handlers/transports.ts`: the result comes from the scenario's script for the entry (built by `tests/mocks/factories/connection-test.ts`, contract-valid: at most 501 transcript lines of at most 1,000 characters), a delay, or "never answers" (held until the request is aborted); an omitted address takes the capabilities' default; an invalid address is `422 invalidFormat` with `format: email` on `sender` or `recipient`; `404` for an unknown entry. Create `tests/mocks/scenarios/routing/connection-tests.ts` with the scenario `routing-tests`: relayhost 1 accepted with TLS and login (`AUTH PLAIN [redacted]` in the transcript), relayhost 3 inactive and accepted, one transport per failed step (`resolve` with `nameNotResolved`, `connect` with `connectionRefused`, `greeting` with `timeout`, `tls` with `tlsFailed`, `login` with `rejected` and a `535` reply, `sender`, `recipient`, `message` with `rejected`), one transport via MX lookup (`hostSource: mailExchanger`), one transport with a transcript line containing `<b>not markup</b>`, one with 501 lines of 1,000 characters, and one that never answers. Register it in `tests/mocks/scenarios/routing/index.ts`.
- [ ] T070 [P] [US4] Write `tests/e2e/routing/connection-test.spec.ts`:
  - US4-AS1 and FR-044: the sender and recipient fields start empty, show `relay@example.org` and `null@hosted.mailcow.de` as placeholders and "empty uses the server's default address", and the recipient shows `admin.transport_test_rcpt_info`; FR-048: the direct-connection note;
  - US4-AS2 and FR-045: while running, the progress state is shown and announced, Run cannot be triggered again (one request in `mockApi.requests()`);
  - US4-AS3: relayhost 1's summary says "Accepted", TLS used and login succeeded, above the transcript;
  - US4-AS4: the login failure says "Not accepted", names the Login step and shows the `535` reply;
  - US4-AS5: the MX transport names the mail exchanger host and port and says they came from an MX lookup;
  - US4-AS6: sender `not-an-address` shows the reason at the field and sends no request;
  - US4-AS7 and FR-047: at 360 px the transcript is collapsed, opens, wraps long lines without horizontal scrolling, shows `[redacted]` as given and the `C:`/`S:`/`*` legend, and "Copy transcript" puts the plain text with markers on the clipboard;
  - SC-004: for the accepted result and each of the eight failed steps, the verdict and the step are inside the 360 × 780 viewport without scrolling or opening the transcript;
  - FR-045 and Edge: with `page.clock`, the "never answers" transport shows "No result was received" with "Run again" after 75 s (60 + 15), and the request was aborted;
  - Edge: leaving the page while a test runs leaves no stuck state, and returning shows an empty form (FR-049);
  - Edge: testing inactive relayhost 3 says that it is inactive and runs;
  - FR-043 and Edge: "Test" on an edit page with unsaved changes asks "The test uses the saved values" before leaving; "Test" exists on every relayhost and transport card;
  - FR-074: the `<b>not markup</b>` line is shown as text.
- [ ] T071 [P] [US4] Write `routing tests/logic/test-summary.spec.ts` (`TestSummaryView` and `StepTimeline` of data-model §2 for every step, `tls` false, `login` `notConfigured`, `notReached`, `failed`, `hostSource` both values, `host: null`, `lastReply: null`; an unknown failure reason as a plain value gives the generic text with the code) and `routing tests/logic/transcript.spec.ts` (markers per direction, `toPlainText`, an empty transcript).
- [ ] T072 [P] [US4] Write `routing tests/composables/useConnectionTest.spec.ts` with fake timers: the mutation uses `gcTime: 0`; `AbortSignal` passed to the request; the progress announcements at the start and after `stepTimeoutSeconds`; the watchdog at `totalTimeoutSeconds + 15` aborts and enters `noResult`; unmount aborts and resets; run again replaces the result; a `422` maps to the fields; the session reactions of UI 001 R8 still fire on `401`.
- [ ] T073 [P] [US4] Write `routing tests/components/connection-test.spec.ts` for `ConnectionTestForm.vue` (placeholders, hints, light email check, limits from `limits.ts`), `ConnectionTestSummary.vue` (verdict heading with icon and text, step and reason, last reply with `translate="no"`, the definition list), `ConnectionTestSteps.vue` (eight steps with words) and `ConnectionTranscript.vue` (collapsed below 768 px, markers `aria-hidden` with hidden direction words, `pre-wrap` and `overflow-wrap: anywhere`, UI 005's `CopyButton` with the plain text, copy success and refusal announced, refusal selects the text).
- [ ] T074 [P] [US4] Add `SMOKE_COMPOSE_PROFILES` to `scripts/smoke/stack-up.sh` (passed as `COMPOSE_PROFILES` to the API stack's `docker compose up`, so that `routing` starts `mailpit`) and write `tests/smoke/routing-connection-test.smoke.spec.ts` (`@routing`): as `admin`, create `[mailpit]:1025` with credentials, run the test, read "Accepted" and see `[redacted]` in the transcript, then delete the relayhost.

### Implementation for User Story 4

- [ ] T075 [US4] Implement `routing/api/connection-test.ts` (both test mutations, `gcTime: 0`, `signal` passed to `openapi-fetch`).
- [ ] T076 [P] [US4] Implement `routing/logic/test-summary.ts` and `routing/logic/transcript.ts`.
- [ ] T077 [US4] Implement `routing/composables/useConnectionTest.ts` (state machine of data-model §7, watchdog from `capabilities.administration.connectionTest`).
- [ ] T078 [US4] Implement `routing/components/connection-test/{ConnectionTestForm,ConnectionTestSummary,ConnectionTestSteps,ConnectionTranscript}.vue`.
- [ ] T079 [US4] Implement `routing/pages/ConnectionTestPage.vue` (`kind` prop, entry loaded and named, inactive note); add the routes `routing-relayhost-test` and `routing-transport-test` (`meta.roles: ['admin']`) to `routing/routes.ts`; add the "Test" action to `routing/components/relayhosts/relayhost-columns.ts` and `routing/components/transports/transport-columns.ts` and to `routing/pages/relayhosts/RelayhostEditPage.vue` and `routing/pages/transports/TransportEditPage.vue`, where the unsaved-changes confirmation uses the "test uses the saved values" wording.
- [ ] T080 [US4] Add the `routing.connectionTest.*` messages (progress, watchdog, summary labels, step words, transcript legend and hidden direction words, copy texts, direct-connection note) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, with `src/i18n/legacy-map.json` entries for `admin.relay_from`, `admin.relay_rcpt`, `admin.relay_run` and `admin.transport_test_rcpt_info` (rich). Run `npm run i18n:import`; `npm run i18n:check` must pass.

**Checkpoint**: US1 to US4 work.

---

## Phase 7: User Story 5 - Manage BCC maps (Priority: P2)

**Goal**: The BCC maps screen for administrators and domain administrators: list with filters,
orphaned maps for administrators, add with the paged local destination picker, edit, activation,
type switches, deletion, and a read-only mode without the BCC maps permission.

**Independent Test**: With the mock, add, edit and delete BCC maps as an administrator and as a
domain administrator with the flag; verify that a domain administrator without the flag can read
but not change them.

### Tests for User Story 5 (write first; must fail)

- [ ] T081 [US5] Implement `tests/mocks/handlers/bcc-maps.ts`, registered in `tests/mocks/handlers/index.ts`:
  - `listBccMaps` (scope: all for administrators including orphaned maps, the domains and their alias domains for domain administrators, never orphaned; `q`, `type`, `active`, repeated `domain`, `orphaned`, every sort);
  - `createBccMap` (`403 permission-flag-required` with `bccMaps` checked first; `localDestination` normalised to `@domain` or the address, `422 notFound` for unknown or out-of-scope values; `bccDestination` one address, `tooMany` with `max: 1` for a list; `409 routing-entry-exists` with `field` and `conflictingId`; active unless `false`);
  - `getBccMap` (`404` outside scope); `updateBccMap` (type, BCC destination, active; `immutable` for a changed `localDestination` or `domain`; `If-Match`/`412`); `deleteBccMap`;
  - `applyBccMapBulkAction` (`notFound` outside scope, `refused` with `routing-entry-exists` for a duplicating type switch);
  - `listBccDestinationChoices` (scope, `q`, repeated `kind` and `domain`, sorts `kind` and `value`, `deliversTo` for aliases and alias-domain addresses), generated on demand from a seeded count.

  Create `tests/mocks/scenarios/routing/bcc-maps.ts` with the seed for `routing-admin-default` (sender and recipient maps, a domain-wide map, maps in `example.org` and `example.net`, one orphaned map) and the scenario `routing-bcc-many-choices` (10,000 choices). Register it in `tests/mocks/scenarios/routing/index.ts`.
- [ ] T082 [P] [US5] Write `tests/e2e/routing/bcc-maps.spec.ts`:
  - US5-AS1 and FR-050: cards at 360 px with the type in text, local destination ("Whole domain" for `@` maps), BCC destination, domain and active state; administrators see "Domain no longer exists" on the orphaned map and can filter on it;
  - FR-051: search, the type, active and several-domain filters (checkboxes of the scope domains for a domain administrator) and every sort, kept across a reload;
  - FR-054: the introduction (`mailbox.bcc_info` rich, the spam and sub-address explanation) and the form hints;
  - US5-AS2 and FR-052: searching the local destination choices for `ali` offers matching domains, alias domains, mailboxes and aliases of the scope, labelled by kind, with the mailboxes an alias delivers to; the picker filters by kind and domain and loads more;
  - US5-AS3: a BCC destination with two addresses explains that one address is allowed and suggests an alias;
  - US5-AS4: a second recipient map for the same local destination is reported as a duplicate at the field with a link to the existing map;
  - US5-AS5 and FR-053: the edit form shows local destination and domain read-only, and type, BCC destination and active state editable, plus the creation and modification times;
  - FR-015: bulk activate, deactivate (confirmed), "Switch to sender map type", "Switch to recipient map type" (a duplicating switch reported "refused" and kept selected) and delete;
  - US5-AS6, FR-002 and SC-010 (BCC): as `routing-da-readonly`, the list has no add, edit, delete or selection controls, `AclReadOnlyNote` names the BCC maps permission, an entry opens read-only, and `/ng/routing/bcc-maps/new` shows "no access";
  - as `routing-da-bcc`, a domain administrator adds and deletes a map in `example.org`, and the index page goes straight to BCC maps;
  - SC-008 (picker): on `routing-bcc-many-choices`, typing shows matches after one request per pause.
- [ ] T083 [P] [US5] Write `routing tests/components/BccDestinationPicker.spec.ts`: debounce 300 ms, `useInfiniteQuery` with 25 per page, the kind checkboxes and the domain filter (scope checkboxes for domain administrators, a text field for administrators), the option content (value, kind in words, domain, "delivers to"), empty, loading and error states, focus handling (FR-071).
- [ ] T084 [P] [US5] Write `routing tests/components/bcc-maps.spec.ts` for `bcc-map-columns.ts` (actions per role and flag), `BccMapFilters.vue` (orphaned only for administrators) and `BccMapForm.vue` (create and edit modes, read-only members on edit, the single-address check, limits from `capabilities.bccMaps`).
- [ ] T085 [P] [US5] Write `routing tests/api/bcc-maps.spec.ts`: parameters (repeated `domain`, `kind`), `If-Match`, merge patch and the `['bcc-maps']` invalidation.
- [ ] T086 [P] [US5] Write `tests/smoke/routing-bcc-maps.smoke.spec.ts` (`@routing`): as `admin`, create a recipient map for `@example.org` to an external archive address and delete it; as `reseller`, see the BCC maps of `example.org` and `example.net`, with change controls only if its identity has `bccMaps`.

### Implementation for User Story 5

- [ ] T087 [US5] Implement `routing/api/bcc-maps.ts` (list, detail, create, update, delete, bulk, destination choices as an infinite query).
- [ ] T088 [US5] Implement `routing/components/bcc-maps/{bcc-map-columns.ts,BccMapFilters.vue,BccMapForm.vue,BccDestinationPicker.vue}` (Reka `Combobox` without `ComboboxViewport`).
- [ ] T089 [US5] Implement `routing/pages/bcc-maps/{BccMapsPage,BccMapCreatePage,BccMapEditPage}.vue` (read-only modes without `canWriteBccMaps`); add the routes `routing-bcc-maps`, `routing-bcc-map-create` and `routing-bcc-map-edit` (no `meta.roles`) to `routing/routes.ts`; set the `bccMaps` screen to `available` in `routing/screens.ts`.
- [ ] T090 [US5] Add the `routing.bccMaps.*` messages (type explanations, kinds, "delivers to", orphaned label, read-only note, spam and sub-address explanation) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, with `src/i18n/legacy-map.json` entries for `mailbox.bcc_maps`, `mailbox.bcc_map`, `mailbox.bcc_info` (rich), `mailbox.add_bcc_entry`, `mailbox.bcc_local_dest`, `mailbox.bcc_map_type`, `mailbox.bcc_sender_map`, `mailbox.bcc_rcpt_map`, `mailbox.bcc_destination`, `mailbox.bcc_to_sender`, `mailbox.bcc_to_rcpt`, `add.bcc_dest_format` (rich), `success.bcc_saved`, `success.bcc_edited`, `success.bcc_deleted`, `danger.bcc_exists`, `danger.bcc_must_be_email` and `danger.bcc_empty`. Run `npm run i18n:import`; `npm run i18n:check` must pass.

**Checkpoint**: US1 to US5 work; domain administrators have their routing screen.

---

## Phase 8: User Story 6 - Manage TLS policy maps (Priority: P2)

**Goal**: The TLS policy maps screen with the eight policies explained.

**Independent Test**: With the mock, add, edit and delete TLS policy maps on both viewports.

### Tests for User Story 6 (write first; must fail)

- [ ] T091 [US6] Implement `tests/mocks/handlers/tls-policy-maps.ts`, registered in `tests/mocks/handlers/index.ts`: list (`q` on destination and parameters, repeated `policy`, `active`, every sort), create (destination lower-cased and in ASCII, `.`, `*`, `@` and `host:port` refused with `invalidFormat` `tlsPolicyDestination`; policy in any case stored lower-case, otherwise `notInList` with `allowed`; parameters `name=value` items or `""`, otherwise `invalidFormat` `tlsPolicyParameters`; `409 routing-entry-exists` with `field: destination`; active unless `false`), get, update (`If-Match`/`412`), delete and bulk. Create `tests/mocks/scenarios/routing/tls-policy-maps.ts` with the seed for `routing-admin-default` (one map per policy, one with empty parameters) and register it in `tests/mocks/scenarios/routing/index.ts`.
- [ ] T092 [P] [US6] Write `tests/e2e/routing/tls-policy-maps.spec.ts`:
  - US6-AS1 and FR-057: cards with destination, policy, parameters (a dash when empty) and active state; the entry page shows creation and modification times; search, the several-policy and active filters, every sort;
  - US6-AS2 and FR-058: the policy choice lists eight policies, each with a one-line explanation; active preselected;
  - FR-058: the hints `mailbox.tls_map_dest_info`, `mailbox.tls_map_parameters_info`, and the introduction with the Postfix documentation link that says it opens an external site;
  - US6-AS3: an invalid destination, invalid parameters and a duplicate destination each show the reason at the matching field;
  - activate, deactivate (confirmed), delete and bulk actions with per-entry results.
- [ ] T093 [P] [US6] Write `routing tests/components/tls-policy-maps.spec.ts` for `TlsPolicyField.vue` (a radio group in the order of `capabilities.administration.tlsPolicies`, names untranslated, explanations translated, keyboard operation), `TlsPolicyMapForm.vue`, `TlsPolicyMapFilters.vue` and `tls-policy-map-columns.ts`.
- [ ] T094 [P] [US6] Write `routing tests/api/tls-policy-maps.spec.ts` (repeated `policy`, `If-Match`, merge patch, invalidation) and `tests/smoke/routing-tls-policy-maps.smoke.spec.ts` (`@routing`: as `admin`, create a `dane-only` map for a Unicode domain, see its ASCII form, delete it).

### Implementation for User Story 6

- [ ] T095 [US6] Implement `routing/api/tls-policy-maps.ts`.
- [ ] T096 [US6] Implement `routing/components/tls-policy-maps/{tls-policy-map-columns.ts,TlsPolicyMapFilters.vue,TlsPolicyMapForm.vue,TlsPolicyField.vue}` and `routing/pages/tls-policy-maps/{TlsPolicyMapsPage,TlsPolicyMapFormPage}.vue`; add the routes `routing-tls-policy-maps`, `routing-tls-policy-map-create` and `routing-tls-policy-map-edit` (`meta.roles: ['admin']`) to `routing/routes.ts`; set the `tlsPolicyMaps` screen to `available` in `routing/screens.ts`.
- [ ] T097 [US6] Add the `routing.tlsPolicyMaps.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, with `src/i18n/legacy-map.json` entries for `mailbox.tls_policy_maps`, `mailbox.tls_policy_maps_long`, `mailbox.tls_policy_maps_info` (rich), `mailbox.tls_policy_maps_enforced_tls` (rich), `mailbox.add_tls_policy_map`, `mailbox.tls_map_dest`, `mailbox.tls_map_dest_info`, `mailbox.tls_map_policy`, `mailbox.tls_map_parameters`, `mailbox.tls_map_parameters_info`, `success.tls_policy_map_entry_saved`, `success.tls_policy_map_entry_deleted`, `danger.tls_policy_map_entry_exists`, `danger.tls_policy_map_dest_invalid` and `danger.tls_policy_map_parameter_invalid`. Run `npm run i18n:import`; `npm run i18n:check` must pass.

**Checkpoint**: US1 to US6 work.

---

## Phase 9: User Story 7 - Manage recipient maps (Priority: P2)

**Goal**: The Recipient maps screen.

**Independent Test**: With the mock, add, edit and delete recipient maps on both viewports.

### Tests for User Story 7 (write first; must fail)

- [ ] T098 [US7] Implement `tests/mocks/handlers/recipient-maps.ts`, registered in `tests/mocks/handlers/index.ts`: list (`q` on both destinations, `active`, every sort), create (each destination trimmed, lower-cased, stripped of a leading `@`, then a domain stored as `@domain` or an address; otherwise `invalidFormat` with `recipientMapDestination`; `409 routing-entry-exists` with `field: originalDestination`; active unless `false`), get, update (normalised as at creation, `If-Match`/`412`), delete and bulk. Create `tests/mocks/scenarios/routing/recipient-maps.ts` with the seed for `routing-admin-default` (a domain map `@old.example` → `@new.example` and an address map) and register it in `tests/mocks/scenarios/routing/index.ts`.
- [ ] T099 [P] [US7] Write `tests/e2e/routing/recipient-maps.spec.ts`:
  - US7-AS1 and FR-055: cards with original recipient, new recipient and active state, domain-wide maps labelled in text; creation and modification times on the entry page; search, the active filter and every sort;
  - FR-056: the add form with the legacy hints and active preselected; edit; activate, deactivate (confirmed), delete and bulk actions;
  - US7-AS2: an original recipient that already has a map is reported at that field;
  - US7-AS3: a value that is neither an address nor a domain explains the accepted forms.
- [ ] T100 [P] [US7] Write `routing tests/components/recipient-maps.spec.ts` (`recipient-map-columns.ts`, `RecipientMapFilters.vue`, `RecipientMapForm.vue` with limits from `maxLengths.recipientMapDestination`), `routing tests/api/recipient-maps.spec.ts`, and `tests/smoke/routing-recipient-maps.smoke.spec.ts` (`@routing`: as `admin`, create `old.example` → `new.example`, see `@old.example` → `@new.example`, delete it).

### Implementation for User Story 7

- [ ] T101 [US7] Implement `routing/api/recipient-maps.ts`.
- [ ] T102 [US7] Implement `routing/components/recipient-maps/{recipient-map-columns.ts,RecipientMapFilters.vue,RecipientMapForm.vue}` and `routing/pages/recipient-maps/{RecipientMapsPage,RecipientMapFormPage}.vue`; add the routes `routing-recipient-maps`, `routing-recipient-map-create` and `routing-recipient-map-edit` (`meta.roles: ['admin']`) to `routing/routes.ts`; set the `recipientMaps` screen to `available` in `routing/screens.ts`.
- [ ] T103 [US7] Add the `routing.recipientMaps.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, with `src/i18n/legacy-map.json` entries for `mailbox.recipient_maps`, `mailbox.recipient_map`, `mailbox.recipient_map_info`, `mailbox.add_recipient_map_entry`, `mailbox.recipient_map_old`, `mailbox.recipient_map_old_info`, `mailbox.recipient_map_new`, `mailbox.recipient_map_new_info`, `success.recipient_map_entry_saved`, `success.recipient_map_entry_deleted`, `danger.recipient_map_entry_exists`, `danger.invalid_recipient_map_old` and `danger.invalid_recipient_map_new`. Run `npm run i18n:import`; `npm run i18n:check` must pass.

**Checkpoint**: US1 to US7 work.

---

## Phase 10: User Story 8 - Manage forwarding hosts (Priority: P2)

**Goal**: The Forwarding hosts screen: add an address, network or name with every resulting address
reported, switch the spam filter, delete, and filter by source.

**Independent Test**: With the mock, add a name that resolves to two addresses (one already
listed), switch the spam filter and delete entries on both viewports.

### Tests for User Story 8 (write first; must fail)

- [ ] T104 [US8] Implement `tests/mocks/handlers/forwarding-hosts.ts`, registered in `tests/mocks/handlers/index.ts`: list (`q`, `spamFilter`, `source` exact, sorts `address` (IPv4 before IPv6, numerically), `source`, `spamFilter`), create (an address or prefix stored canonically, `192.0.2.5/24` → `192.0.2.0/24`; a name resolved from the scenario DNS table; `added` and `updated` entries; `201` with `Location` `/api/v2/forwarding-hosts?source=…` when one was added, otherwise `200`; `422 notResolvable`; `503 temporary-failure` with `Retry-After`), get and update and delete by the percent-encoded address (`If-Match`/`412`, `immutable` for `address` and `source`), and bulk (`enableSpamFilter`, `disableSpamFilter`, `delete`). Create `tests/mocks/scenarios/routing/forwarding-hosts.ts` with the seed for `routing-admin-default` (`198.51.100.7` from `forwarder.example`, `192.0.2.0/24`, an expanded IPv6 entry from the classic interface, an entry with an empty source) and the DNS table (`forwarder.example` → `198.51.100.7` and `198.51.100.8`; `nothing.example` → none; `dns-down.example` → temporary failure). Register it in `tests/mocks/scenarios/routing/index.ts`.
- [ ] T105 [P] [US8] Write `tests/e2e/routing/forwarding-hosts.spec.ts`:
  - US8-AS1 and FR-059: cards with address, source and the spam filter in text; search, the spam filter and source filters and every sort;
  - FR-060: the add form with `admin.forwarding_hosts_add_hint` and the spam filter preselected on;
  - US8-AS2 and FR-061: adding `forwarder.example` returns to the list filtered by that source and names both addresses, `198.51.100.8` added and `198.51.100.7` updated;
  - Edge: adding `192.0.2.5/24` shows the stored form `192.0.2.0/24`;
  - US8-AS3 and FR-062: `nothing.example` shows a field error; `dns-down.example` says DNS is temporarily unavailable and enables the retry after `Retry-After`;
  - US8-AS4: selecting a card's source shows all addresses added from that source;
  - FR-063: the entry page shows address and source read-only and switches the spam filter; delete with confirmation; bulk enable and disable spam filter and delete;
  - Edge: the expanded IPv6 entry and the empty-source entry are listed and editable as stored.
- [ ] T106 [P] [US8] Write `routing tests/components/forwarding-hosts.spec.ts` (`forwarding-host-columns.ts`, `ForwardingHostFilters.vue`, `ForwardingHostForm.vue` with the 255-character limit from `limits.ts`, `ForwardingHostResults.vue`), `routing tests/composables/useForwardingHostResults.spec.ts` (one-shot, memory only, nothing in history state or storage) and `routing tests/api/forwarding-hosts.spec.ts` (the request path for `192.0.2.0/24` is `/api/v2/forwarding-hosts/192.0.2.0%2F24`; bulk targets carry the unencoded address; `Retry-After` exposed).
- [ ] T107 [P] [US8] Write `tests/smoke/routing-forwarding-hosts.smoke.spec.ts` (`@routing`): as `admin`, add `192.0.2.5/24`, see `192.0.2.0/24` added, disable its spam filter, delete it.

### Implementation for User Story 8

- [ ] T108 [US8] Implement `routing/api/forwarding-hosts.ts`.
- [ ] T109 [US8] Implement `routing/composables/useForwardingHostResults.ts` and `routing/components/forwarding-hosts/{forwarding-host-columns.ts,ForwardingHostFilters.vue,ForwardingHostForm.vue,ForwardingHostResults.vue}`.
- [ ] T110 [US8] Implement `routing/pages/forwarding-hosts/{ForwardingHostsPage,ForwardingHostCreatePage,ForwardingHostEditPage}.vue`; add the routes `routing-forwarding-hosts`, `routing-forwarding-host-create` and `routing-forwarding-host-edit` (`meta.roles: ['admin']`) to `routing/routes.ts`; set the `forwardingHosts` screen to `available` in `routing/screens.ts`.
- [ ] T111 [US8] Add the `routing.forwardingHosts.*` messages (added and updated outcomes, temporary failure, source texts) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, with `src/i18n/legacy-map.json` entries for `admin.forwarding_hosts`, `admin.forwarding_hosts_hint`, `admin.add_forwarding_host`, `admin.forwarding_hosts_add_hint`, `success.forwarding_host_added` and `success.forwarding_host_removed`. Run `npm run i18n:import`; `npm run i18n:check` must pass.

**Checkpoint**: all six screens work.

---

## Phase 11: User Story 9 - Open the change history of a routing entry (Priority: P3)

**Goal**: History actions on every routing entry and Relayhost section for administrators, and
the audit log labels of API 009's events.

**Independent Test**: With the mock, open History from each kind of entry and verify that the audit
log opens with the matching target filter; verify that domain administrators see no History action.

**Depends on**: the screens and sections it decorates (US1–US8). With only some stories done, it
applies to those.

### Tests for User Story 9 (write first; must fail)

- [ ] T112 [P] [US9] Write `routing tests/history.spec.ts` (the target table of research R18, including the domain's ASCII name, the mailbox address, the forwarding host's stored address and the source target) and extend `tests/unit/features/audit-log/labels.spec.ts`: the 21 event types `relayhostCreation` … `forwardingHostDeletion` and the 8 target types of API 009 have labels in all three locales.
- [ ] T113 [P] [US9] Write `tests/e2e/routing/history.spec.ts`:
  - US9-AS1: History on relayhost 1 opens the audit log filtered to `relayhost` and `1`;
  - US9-AS2: History in `alice@example.org`'s Relayhost section opens it filtered to `mailboxRelayhostAssignment` and `alice@example.org`; the domain section uses `domainRelayhostAssignment` and `example.org`;
  - FR-064: History on a transport, a BCC map, a recipient map, a TLS policy map and a forwarding host uses its target; on the list filtered by `forwarder.example`, "History of this source" uses `forwardingHost` and the source;
  - US9-AS3: as `routing-da-bcc`, neither BCC maps nor the Relayhost sections offer History.

### Implementation for User Story 9

- [ ] T114 [US9] Implement `routing/history.ts`; add the `history` action (only when `canSeeHistory`) to `routing/components/{relayhosts/relayhost-columns.ts,transports/transport-columns.ts,bcc-maps/bcc-map-columns.ts,recipient-maps/recipient-map-columns.ts,tls-policy-maps/tls-policy-map-columns.ts,forwarding-hosts/forwarding-host-columns.ts}`, a `HistoryLink` to the entry pages under `routing/pages/`, and to `routing/components/sections/{DomainRelayhostSection,MailboxRelayhostSection}.vue`; add "History of this source" to `routing/pages/forwarding-hosts/ForwardingHostsPage.vue` while a `source` filter is set.
- [ ] T115 [US9] Append the 21 `AuditEventType` values and the 8 `AuditTarget.type` values of API 009 (research R21) to the coverage manifest, add their labels to `src/features/audit-log/labels.ts`, and add their messages plus `routing.history.*` to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, using the key names of UI 001's audit labels. `npm run i18n:check` must pass.

**Checkpoint**: all user stories work on their own.

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story verification, budgets, parity, translations review and release readiness.

- [ ] T116 [P] Write and pass `tests/e2e/routing/credential-secrecy.spec.ts` (SC-003, FR-025, FR-028, FR-075): on `routing-admin-default` and `routing-transports-many`, open lists, edit pages, deletion dialogs, choices, test pages and Relayhost sections, type new passwords, save, fail a save, and leave forms; assert that no seeded or typed password appears in `page.content()`, `localStorage`, `sessionStorage` or `history.state`, that `mockApi.requests()` shows each typed password only in its write body, that the password fields are empty after save, refusal and return, and that no form draft of these pages is kept.
- [ ] T117 [P] Write and pass `tests/e2e/routing/reflow-and-keyboard.spec.ts`: every routing screen, form, dialog, picker, test page and section has no horizontal scroll at 320 px and at the equivalent of 400 % zoom, works in landscape on the mobile projects, never hides the focused element behind the sticky header or the sticky form action bar, and runs no transition under `prefers-reduced-motion: reduce`; long hosts, regular expressions, BCC destinations, TLS parameters and transcript lines wrap; each user story's main path completes with the keyboard alone with visible focus (FR-068, spec edge case "Long values").
- [ ] T118 Extend `scripts/run-lhci.mjs` with a collection on `/ng/routing/relayhosts` (`MOCK_DEFAULT_SCENARIO=routing-relayhosts-many`, administrator session). Run `npm run build && npm run budget:check && npm run lhci`, and fix regressions until the initial JS is at most 204,800 bytes gzipped and performance and accessibility are at least 0.9 on every collection (SC-008, constitution VII).
- [ ] T119 [P] Add the plan's three parity notes (orphaned BCC maps, test address placeholders, rich legacy hints) to the "Legacy Parity" table of `specs/009-routing-address-rewriting/spec.md`.
- [ ] T120 [P] Run `npm run i18n:check`, remove the unused keys it reports from `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, and list the new cs-cz and sk-sk strings of this feature for the owner's review (plan, owner question 1) in `specs/009-routing-address-rewriting/quickstart.md`, section "Validation log".
- [ ] T121 Run `quickstart.md` Part B on a mid-range Android phone and an iPhone with `npm run preview:mock` on the local network: record the SC-001 timing (add a relayhost, assign it, run a test in under 3 minutes at 360 px), the SC-008 timings (first list page; BCC picker on `routing-bcc-many-choices`), and a VoiceOver and TalkBack pass of every user story, in the "Validation log" section of `specs/009-routing-address-rewriting/quickstart.md`.
- [ ] T122 Run `quickstart.md` Part C (`SMOKE_COMPOSE_PROFILES=routing scripts/smoke/stack-up.sh`, `npm run test:smoke -- --grep @routing`, `scripts/smoke/stack-down.sh`), and set `SMOKE_COMPOSE_PROFILES: routing` for the `smoke` job in `.github/workflows/ci.yml`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** depends on UI 001–008 and API 009 being released. T001 comes first; T002
  needs T001; T004 needs T003.
- **Foundational (Phase 2)** depends on Setup and **blocks every user story**. Within it:
  - T005 → T006 (test infrastructure);
  - then the tests T007–T016 (all [P]);
  - then the implementation T017–T027, in this order: T017 → T018 → T019 → T020 → T021 → T022,
    with T023 and T024 in parallel, then T025 → T026 → T027.
- **User stories (Phases 3–11)** depend on Foundational and on each other as the table shows.
- **Polish (Phase 12)** depends on every story it verifies.

### User Story Dependencies

| Story | Priority | Depends on | Why |
|---|---|---|---|
| US1 | P1 | Foundational | MVP: the relayhost screen, credentials and bulk patterns |
| US2 | P1 | US1 (T028, T039) | The pickers use US1's relayhost and choice handlers; FR-036 links to US1's add route |
| US3 | P1 | US1 (T037) | Reuses `CredentialFields` |
| US4 | P2 | US1, US3 | The test page is reached from relayhost and transport pages; its handlers extend theirs |
| US5 | P2 | Foundational | Own handlers, pages and picker |
| US6 | P2 | Foundational | Own handlers and pages |
| US7 | P2 | Foundational | Own handlers and pages |
| US8 | P2 | Foundational | Own handlers and pages |
| US9 | P3 | the stories it decorates (US1–US8) | Adds History to their columns, pages and sections |

### Files edited by several tasks

Edits to these files must be serialised, even when stories run in parallel:

- `routing/routes.ts`, `routing/screens.ts` and `routing/index.ts`: T026, T039, T051, T067, T079,
  T089, T096, T102, T110;
- `tests/mocks/handlers/index.ts`: T006, T028, T041, T055, T081, T091, T098, T104;
- `tests/mocks/handlers/relayhosts.ts` and `tests/mocks/handlers/transports.ts`: T028 and T055,
  then T069;
- `tests/mocks/scenarios/routing/index.ts`: T006 and every story's scenario task;
- `tests/mocks/scenarios/state.ts`: T005 (and T001 if it builds a missing mock state);
- `routing/components/relayhosts/relayhost-columns.ts`, `routing/components/transports/transport-columns.ts`,
  `routing/pages/relayhosts/RelayhostEditPage.vue` and `routing/pages/transports/TransportEditPage.vue`:
  their story, then T079, then T114;
- every other `*-columns.ts`, entry page and section: its story, then T114;
- `src/i18n/messages/*.json` and `src/i18n/legacy-map.json`: T027, T040, T054, T068, T080, T090,
  T097, T103, T111, T115, T120;
- `scripts/i18n/lib.mjs` and the coverage manifest: T004, T027, T115;
- UI 002's and UI 003's files: `tests/mocks/handlers/{domains,mailboxes}.ts` (T041),
  `src/features/domains/pages/DomainDetailPage.vue` (T052), `src/features/mailboxes/{routes.ts,sections.ts}`
  and `ManagedSettingsGroup.vue` (T053), and their tests.

Scenario seeds avoid conflicts through one module per area under `tests/mocks/scenarios/routing/`.

### Within Each User Story

- First the mock handlers and scenarios (test fixtures), then the end-to-end, unit and smoke tests,
  which must fail, then the implementation (api → logic → composables → components → pages and
  routes), then the messages in all three locales.

### Parallel Opportunities

- Setup: T003 alongside T002.
- Foundational: T007–T016 all in parallel; T023 and T024 in parallel with the T017–T022 chain.
- Stories: after Foundational, US1, US5, US6, US7 and US8 can be staffed in parallel; US2 and US3
  follow US1; US4 follows US1 and US3; US9 last.
- Within each story, every task marked [P].

---

## Parallel Example: User Story 1

```bash
# After T028 (handlers and scenarios), write all US1 tests together:
Task: "T029 tests/e2e/routing/relayhosts.spec.ts"
Task: "T030 tests/e2e/routing/relayhost-usage.spec.ts"
Task: "T031 routing tests/logic/credentials.spec.ts + components/CredentialFields.spec.ts"
Task: "T032 routing tests/logic/next-hop.spec.ts"
Task: "T033 routing tests/components/relayhosts.spec.ts"
Task: "T034 routing tests/api/relayhosts.spec.ts"
Task: "T035 tests/smoke/routing-relayhosts.smoke.spec.ts"

# Then implement:
Task: "T036 routing/api/relayhosts.ts"
Task: "T037 routing/logic/{credentials,next-hop}.ts + CredentialFields.vue + PasswordInput.vue"
# T038 after T036 and T037; T039 after T038 (edits routes.ts and screens.ts); T040 last.
```

## Parallel Example: P2 screens

```bash
# After Foundational, four developers can build the independent P2 screens at once:
Task: "Phase 7 US5 BCC maps (T081–T090)"
Task: "Phase 8 US6 TLS policy maps (T091–T097)"
Task: "Phase 9 US7 Recipient maps (T098–T103)"
Task: "Phase 10 US8 Forwarding hosts (T104–T111)"
# Their routes.ts, screens.ts, handlers/index.ts, scenarios/routing/index.ts and message edits are serialised.
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup) and Phase 2 (Foundational): CI green, `/ng/routing` reachable.
2. Phase 3 (US1): the relayhost screen.
3. **Stop and validate**: `npm run test:e2e -- --grep US1` on all projects, quickstart Part B's US1
   rows, and `npm run test:smoke -- --grep @routing` for T035.
4. Administrators can manage relayhosts without the classic interface's clear-text passwords.

### Incremental Delivery

1. Foundation, then US1 (MVP).
2. US2 (sections on domain and mailbox screens), then US3 (transports): every P1 story.
3. US4 (connection test).
4. US5 (BCC maps, also for domain administrators), US6, US7 and US8 in any order.
5. US9 (History).
6. Polish: secrecy, reflow and keyboard, budgets, parity notes, translation review, device and smoke
   validation.

### Parallel Team Strategy

After Foundational:
- Developer A: US1, then US2, then US4.
- Developer B: US3 (after T037), then US9.
- Developer C: US5, then US6.
- Developer D: US7, then US8.

Edits to the shared files listed under "Files edited by several tasks" run one at a time.

---

## Notes

- [P] tasks touch different files and have no dependency on an incomplete task.
- [USn] labels map tasks to the spec's user stories, and test titles carry the spec IDs for
  traceability.
- Verify that each test fails before implementing (constitution VI).
- Commit after each task or logical group, directly to `main`, with short imperative subjects.
- Never add a hand-written API type, a `v-html` outside `SanitizedHtml.vue`, an inline style or
  script, a storage key outside UI 001 data-model §4, a hard-coded limit that the routing
  capabilities provide, or a password in the cache, the address, history state or storage.
