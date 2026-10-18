# Implementation Plan: Routing and Address Rewriting

**Branch**: `main` (no feature branches, constitution 1.1.0) | **Date**: 2026-10-18 |
**Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/009-routing-address-rewriting/spec.md`

## Summary

UI feature 009 adds the Routing section and the Relayhost sections to mailcowui-ng. It delivers:

- **six Routing screens** for administrators, with the legacy names: Sender-dependent transports
  (relayhosts), Transport maps, TLS policy maps, Recipient maps, BCC maps and Forwarding hosts. Each
  has a list (cards on phones, a table on wide screens, search, filters, sorting, paging, refresh),
  add and edit pages, activation, deletion with confirmation, and bulk actions on a selection;
- **BCC maps for domain administrators**: always readable for their domains, changeable with the
  BCC maps permission;
- **write-only relay credentials**: the password status, never the password, with explicit keep,
  replace and remove;
- **transports with shared next hops**: several destinations per form, and the transports that
  share credentials named before and after every change;
- **the connection test** of a relayhost or transport, with a verdict-first summary and a
  transcript readable on a phone;
- **Relayhost sections** on UI 002's domain and UI 003's mailbox screens, with their own save, the
  effective relayhost of a mailbox, dangling and inactive assignments, and the domain
  administrators' relayhost permissions;
- **History** links into UI 001's audit log for every routing entry and assignment.

The technical approach (details in [research.md](./research.md)):

- **Stack and structure**: UI 001's, unchanged, with no new runtime dependency. One feature
  directory, `src/features/routing/`, under the existing `/routing` catalogue entry (R2).
- **Contract**: a deliberate bump to a mailcow-rest-v2 commit that contains API 009's 46
  operations; the planning baseline is `3207925` (R1). All 46 operations are used
  ([contracts/README.md](./contracts/README.md)).
- **Server settings**: limits, the bulk limit, the default test addresses and timeouts and the TLS
  policies come from `GET /capabilities/routing`, never from constants (R3).
- **Lists and edits**: a generic `EntryList` renders the six lists as cards or tables (R4). Bulk
  actions send per-item version tags and use UI 002's selection, typed confirmation and result
  summary (R5). Entry pages send only changed fields with `If-Match`, and outdated saves keep the
  input and mark changed values (R6).
- **Credentials**: `CredentialFields` with a password field that starts empty, says whether a
  password is stored, and is cleared after every save attempt (R7).
- **Connection test**: a mutation with no cache, a watchdog at the server's total timeout plus 15 s
  that aborts the request, a summary that fits a 360 × 780 screen, and a transcript with text
  direction markers and a copy action (R11–R13).
- **Sections**: exported from the feature's `index.ts` into the earlier screens' designated areas:
  an async section after Groupware on UI 002's domain page (`edit=relayhost`), and a child route
  `relayhost` of UI 003's mailbox layout with an entry in its section catalogue. Administrators
  pick from `GET /relayhosts`, domain administrators from `GET /relayhost-choices` (R9).
- **Text**: mailcow's own translations, used verbatim by their legacy keys and loaded at runtime from
  the installation; the twelve hints with markup render through `SanitizedHtml.vue`, unaltered
  (constitution IV 1.3.0, R20, "Translations and forms" below).
- **Tests**: stateful, contract-validated mock handlers for the eight API 009 modules (R23);
  end-to-end tests of every user story on 360 px and desktop with axe in both themes; unit and
  component tests; smoke tests against the API dev stack with a real SMTP target (R24).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict) and Vue 3.5 SFCs; Node.js 24 LTS for tooling
(UI 001).

**Primary Dependencies**: UI 001's ten runtime dependencies (UI 001 R1). No new runtime or dev
dependency (research R25). TailAdmin primitives already copied by UI 001: combobox (without its
viewport), collapsible, dropdown menu, radio group, checkbox, switch, table, dialog.

**Storage**: none on a server. Browser: the in-memory query cache. Nothing new in Pinia or device
storage; typed passwords, test results and batch results live only in component memory
(data-model §4).

**Testing**:

- Vitest with jsdom, Vue Test Utils and MSW for logic, composables and components.
- Playwright end-to-end specs in `tests/e2e/routing/` on `mobile-chromium` (360 × 780),
  `desktop-chromium` and `mobile-webkit`, against the production build with the production CSP and
  the contract-validated mock. Every test runs axe in both themes and the horizontal-scroll,
  touch-target, CSP and contract-violation checks (UI 001 R24).
- Smoke specs against the mailcow-rest-v2 dev stack with the `routing` profile (mailpit).
- One more Lighthouse collection (`/ng/routing/relayhosts`).

**Target Platform**: as UI 001: the two latest major versions of evergreen browsers, served by the
`ng-mailcow` image under `/ng/` on the mailcow host's origin.

**Project Type**: web application (static single-page frontend; the backend is mailcow-rest-v2).

**Performance Goals**: SC-008: a list's first page within 2 s on the standard mobile profile, and
BCC picker matches within 1 s of a pause for 10,000 choices (one debounced request per pause). The
initial JavaScript stays within UI 001's 200 KB budget: every routing page is a lazy route chunk,
and the sections load as async components (research R25). Lighthouse mobile scores of at least 90.

**Constraints**:

- Only contract operations; no hand-written API types.
- Strict CSP: no inline script or style, no `v-html` outside `SanitizedHtml.vue`, no banned Reka
  viewport parts.
- WCAG 2.2 AA in both themes; 360 px first; 44 × 44 px targets; no horizontal scrolling, also at
  320 px.
- Passwords never displayed, never stored in the browser, never in a TanStack Query cache: the
  four writes that can carry one call the client directly (FR-025, FR-075, conventions "Secrets",
  research R7).
- No automatic polling (conventions "Polling"); the contract pin only moves forward and the 46
  operations are checked against the baseline commit (conventions "Contract pins").
- Limits from the capabilities read (conventions).
- Constitution IV 1.3.0: every mailcow language; legacy texts verbatim from the installation; forms
  one to one with the legacy forms; new strings only where legacy has none, in en-gb, cs-cz and
  sk-sk.

**Scale/Scope**:

- 9 user stories (3 at P1, 5 at P2, 1 at P3), 75 functional requirements, 10 success criteria.
- 22 routes, 2 sections embedded in UI 002 and UI 003, 46 contract operations.
- About 100 legacy keys used verbatim; new strings only for the elements legacy lacks (fewer than the
  first plan's 400 per locale, which assumed new keys for statuses, actions and messages that legacy
  has).
- Up to 10,000 entries per collection (paged lists, paged pickers).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Gate | Status |
|---|---|---|
| I. The API contract is the only interface | All calls are operations of the pinned contract through the generated client; the bump is a deliberate task with typecheck and all tests (R1). Types are generated root types and operation parameter aliases (data-model §1). Gaps are to be registered in mailcow-rest-v2's gap register first (G34–G37 below, checked by T001) and are not worked around: the shared-next-hop lookup sends the input unnormalised (R10), and the permission message stays neutral without `requiredFlagsMatch` (R19). Errors are handled from `type`, extension members and `errors` (R19, contracts README). | PASS |
| II. Mobile-first | Every screen is designed and tested at 360 px first. Lists are cards below `md` and tables above (R4). Forms are their own pages with a sticky action bar (R6); the Relayhost sections open full-screen on phones (R9). Destructive actions are confirmed with their impact (R5, R8). Every list and picker has loading, empty and error states. The test summary fits 360 × 780 (R12); the transcript wraps (R13). | PASS |
| III. Accessibility | axe in both themes on every screen and state (R24). Statuses in words (R4). Live announcements for saves, bulk results, result counts, test progress and summary. Pickers and dialogs are Reka components with focus handling (FR-071). The transcript direction is spoken, not only shown (R13). | PASS |
| IV. i18n and branding | Constitution IV 1.3.0: every mailcow language; legacy texts by their legacy keys, verbatim from the installation's `/lang/` files, markup hints through `SanitizedHtml.vue` (R20, R21); the screens mirror the legacy forms and messages ("Translations and forms" below); new strings only for elements legacy lacks, in en, cs and sk, never machine-translated. `i18n:check` covers the new strings, the legacy keys against the `en-gb` snapshot and the routing enumerations. Values from the API are shown untranslated (FR-073). No brand-specific text in the app's own strings. | PASS |
| V. Security in the browser | Passwords are write-only in the UI too: empty fields, status only, `new-password` autocomplete, cleared after every save attempt, never in cache, address, history state or storage (R7). API data is rendered as text; legacy hints with markup go only through `SanitizedHtml.vue`, the one `v-html` (R20). Hiding controls is a convenience: the API's refusals are handled (R19). | PASS |
| VI. Test-first | `tasks.md` writes tests before implementation in every phase. End-to-end tests of every acceptance scenario on both viewports against the contract-validated mock (R23, R24). Unit tests cover unknown enumeration values that a mock may not send. Smoke tests against the real API. | PASS |
| VII. Performance budgets | No new dependency; lazy routes; async sections; debounced searches; capabilities cached for 5 minutes; invalidation only of what a change affects (R22, R25). `budget:check` and Lighthouse run on a routing page. | PASS |
| VIII. Simplicity | One feature directory. Generic `EntryList` and `CredentialFields` inside the feature because six and two of its screens use them; legacy hints reuse UI 001's `SanitizedHtml.vue` instead of a new renderer. Earlier features' shared blocks (`BulkActionBar`, `useLeaveGuard`, `PasswordInput`, `CopyButton`, `AclReadOnlyNote`, `ActiveFilterChips` and the others of R1) are reused, not rebuilt. | PASS |
| Technology constraints | The constitution's stack and TailAdmin primitives only; no new font, icon set or CDN request. Static build, unchanged deployment. | PASS |
| Workflow and gates | All UI 001 CI gates apply unchanged; the smoke job runs the `@routing` specs with the `routing` profile. | PASS |
| `docs/conventions.md` | Legacy names kept ("Sender-dependent transports"). List state in the address, page sizes 25/50/100, cards and tables, list states (R4). Bulk: explicit selection, current page only, per-item version tags, per-item results, failed items stay selected, "outcome unknown" (R5). Editing: changed fields plus version tag, input kept on `412`, changed values marked, no overwrite, refused deletion confirmed again (R6). Confirmations: impact preview, typed count for bulk deletion, explicit confirmation for deactivation (R5, R8). Write-only secrets (R7). History by target type and ID, audit labels (R18). Problems and rule codes translated (R19). Entry points into UI 002 and UI 003 through their section areas (R9). Limits from the capabilities read (R3). | PASS |

**Post-design re-check (after Phase 1)**: PASS. The data model, contracts README and quickstart
introduce no violation. Decisions that touched gates:

- The test watchdog aborts the request at the server's total timeout plus 15 s, an exception to UI
  001 R8's "no client-side timeout" for this one operation (R11); it follows FR-045 and the
  conventions' "limits from capabilities", and is not a constitution deviation.
- The legacy hints with markup are rendered verbatim through `SanitizedHtml.vue` (IV 1.3.0, V,
  R20); the first plan's `RichText.vue` notation is dropped.
- The admin relayhost picker reads `GET /relayhosts` to show usernames (FR-032) instead of asking
  the API for a new field (I, R9).

## Translations and forms (constitution IV 1.3.0)

The owner rule of 2026-10-18 (`docs/conventions.md`, "Translations and forms") applies to every
screen and section of this feature, and overrides earlier text in this plan, the spec, research and
tasks.

**Legacy forms mirrored** (paths under `../mailhosting/data/web/`; entry pages `admin/system.php`
for `templates/admin.twig`, `admin/mailbox.php` and `domainadmin/mailbox.php` for
`templates/mailbox.twig`, `edit.php` for the edit pages):

- **Sender-dependent transports** (list, add) → the relayhost card of
  `templates/admin/tab-routing.twig` (add form below the table, `mailbox.quick_actions` menu,
  `mailbox.toggle_all`), `draw_relayhosts()` in `js/site/admin.js` (columns ID, `admin.host`,
  `admin.username`, `admin.in_use_by`, `admin.active`, `admin.action`); messages of `relayhost()` in
  `inc/functions.transports.inc.php`.
- **Relayhost edit** → `templates/edit/relayhost.twig` (`add.hostname`, `add.username`,
  `add.password`, `add.relayhost_wrapped_tls_info`, `edit.active`, `edit.save`).
- **Transport maps** (list, add) → the transport card of `tab-routing.twig`,
  `draw_transport_maps()` in `admin.js` (ID, `admin.destination`, `admin.nexthop`,
  `admin.username`, `admin.active`, `admin.action`); **edit** → `templates/edit/transport.twig`
  (`add.destination`, `edit.nexthop`, `edit.lookup_mx`, `add.username`, `add.password`,
  `edit.active`); messages of `transport()` in `functions.transports.inc.php`.
- **Connection test** → `testTransportModal` in `templates/modals/admin.twig` (`admin.relay_from`,
  `admin.relay_rcpt`, `admin.transport_test_rcpt_info`, `admin.relay_run`), the `#test_transport`
  handler in `admin.js` and `inc/ajax/transport_check.php`.
- **BCC maps** → the BCC card of `templates/mailbox/tab-bcc.twig` (`mailbox.bcc_maps`,
  `mailbox.bcc_info`, `mailbox.bcc_to_rcpt`, `mailbox.bcc_to_sender`, `admin.refresh`),
  `draw_bcc_table()` in `js/site/mailbox.js` (`mailbox.bcc_type`, `mailbox.bcc_local_dest`,
  `mailbox.bcc_destinations`, `mailbox.domain`, `mailbox.active`, `mailbox.action`), add form
  `addBCCModalAdmin` in `templates/modals/mailbox.twig`, edit `templates/edit/bcc.twig`; messages of
  `bcc()` in `inc/functions.address_rewriting.inc.php`.
- **Recipient maps** → the recipient map card of `tab-bcc.twig`, `draw_recipient_map_table()` in
  `mailbox.js`, `addRecipientMapModalAdmin`, `templates/edit/recipient_map.twig`; messages of
  `recipient_map()` in `functions.address_rewriting.inc.php`.
- **TLS policy maps** → `templates/mailbox/tab-tls-policy.twig`, `draw_tls_policy_table()` in
  `mailbox.js`, `addTLSPolicyMapAdmin` (the eight options are the raw Postfix values),
  `templates/edit/tls_policy_map.twig`; messages of `tls_policy_maps()` in
  `inc/functions.tls_policy_maps.inc.php`.
- **Forwarding hosts** → `templates/admin/tab-config-fwdhosts.twig`, `draw_fwd_hosts()` in
  `admin.js` (`admin.host`, `admin.source`, `admin.spamfilter`, `admin.action`); messages of
  `fwdhost()` in `inc/functions.fwdhost.inc.php`.
- **Relayhost sections** → the relayhost selector of `templates/edit/domain.twig` (`edit.relayhost`,
  `edit.none_inherit`) and of `templates/edit/mailbox.twig` (also `edit.mailbox_relayhost_info`).
- **Navigation labels** → `admin.routing`, `admin.forwarding_hosts`, `mailbox.address_rewriting` and
  `mailbox.tls_policy_maps` of `templates/admin.twig` and `templates/mailbox.twig`.

**Screens and elements without a legacy counterpart** use new strings (en-gb, cs-cz, sk-sk, never
machine-translated), kept minimal: the relayhost usage view, password status and removal, the test
summary, steps and transcript legend, shared next hops, the effective relayhost, dangling and
inactive assignments, "Whole domain", orphaned BCC maps, bulk result summaries, outdated-version
handling, the forwarding hosts' "Enable/Disable spam filter" (hard-coded English in legacy) and
History.

**Deviation-free rule**: these screens add, drop, rename, reword or reorder nothing relative to the
legacy forms above, except the conventions' improvements (sections with their own save, typed
confirmations, bulk mode, outdated-version handling). Labels, help and info texts (`*_info`,
`*_hint`), placeholders, option labels, units, order and grouping, column headers, action labels and
success, warning and danger messages come from the legacy keys; the add and edit screens each use
their own legacy template's keys (for example `admin.host` on the add form, `add.hostname` on the
edit page). Every mailcow language is supported; legacy values are loaded at runtime from the
installation and shown verbatim (HTML through `SanitizedHtml.vue`); a missing key falls back to
`en-gb`, never to a hand-written value.

**Legacy form map**: written into this section by T004a before any screen is built.

**Deviations needing a decision** (not built until the owner or orchestrator decides):

1. **Navigation grouping**: legacy spreads these screens over System › Routing (relayhosts,
   transports), System › Configuration › Forwarding hosts, Mail setup › Address rewriting (BCC and
   recipient maps) and Mail setup › TLS policy maps; the plan groups all six under one Routing
   entry (UI 001's catalogue, FR-001).
2. **Test addresses**: legacy prefills the recipient with `null@hosted.mailcow.de` (value and
   placeholder) and shows the placeholder `relay@example.org` for the sender; the plan leaves both
   empty with the server's defaults as placeholders (parity note 2).
3. **Test dialog title**: legacy's hard-coded "Transport"; the plan replaces it with a new string.
4. **Edit page heading**: legacy's relayhost and transport edit pages are headed `edit.resource`
   ("Resource", a legacy slip); verbatim use would show "Resource".
5. **Added explanatory texts** (new strings beyond the legacy forms): "also called relayhosts"
   (FR-001), the port 465 warning, the `*` transport warning, the TLS policy explanations (legacy
   shows only the raw values), the BCC type explanations, the spam and sub-address explanation, and
   the credential lookup note of the mailbox section.
6. **Dropped legacy columns and option text**: the leading ID column of the BCC, recipient and TLS
   policy map tables (spec Legacy Parity), and the username in a domain administrator's relayhost
   options ("ID n: host (username)"; API FR-023 withholds it).
7. **Write-only relay passwords**: legacy's edit pages show the stored password in its field; the
   plan shows only its status (conventions "Secrets"; listed for completeness).

## Consistency changes to the spec

The plan aligned `spec.md` with the API contract and `docs/conventions.md`. Each change is recorded
in the spec's "Consistency changes (plan)" clarification:

1. **Bulk actions carry version tags** (conventions "Bulk actions", API FR-091): each item is sent
   with its version as listed; the outcomes include "outdated"; failed, refused and outdated items
   stay selected; a dropped connection is "outcome unknown". The spec said bulk actions carry no
   versions.
2. **Confirmations** (conventions): a bulk deletion needs the number typed; deactivation, single or
   bulk, and activating a `*` transport need one explicit confirmation.
3. **Outdated saves** (conventions): the input is kept, the entry is reloaded and the changed
   values are marked; the user saves again or takes the current values.
4. **Limits from the capabilities read** (conventions, API FR-093): the selection limit is the
   server's bulk limit (100 by default); the test watchdog is the server's total timeout plus 15 s
   (75 s by default).
5. **Both of the spec's API gaps are closed by API 009**: the default test addresses are readable
   and shown as placeholders (the fields still start empty); BCC maps report `orphaned`, so
   administrators see "Domain no longer exists" and can filter on it.
6. **Documented error types**: "too many requests" and "attribute not permitted" are not documented
   for API 009 operations; they keep the shared translations of earlier features.
7. **Navigation**: domain administrators always see the Routing section with BCC maps, as FR-002
   already says. UI 001's catalogue row ("BCC maps" flag) is changed in code by this feature; its
   spec table should be aligned by the next change to UI 001's spec.
8. **Shared next hop lookup, interim limitation** (analysis C1, gap G35): until the API
   normalises its `nextHop` filter, FR-041's pre-save confirmation can miss transports for bare IP
   and Unicode next hops; the post-save report still names them.
9. **Credential note on mailboxes** (analysis H2): FR-035's note follows the contract's
   `credentialsRelayhost`: the domain relayhost's credentials, or none when the domain's relayhost
   has no username, whenever both relayhosts are active.

## Dependencies

- **API**: mailcow-rest-v2 feature 009, and API 001–003 for identity, the audit log target filters
  and the domain and mailbox representations. As the constitution allows, the work starts once API
  009's contract is merged (it is, at the baseline) and runs against the contract-validated mock.
  Only the smoke tasks and the final contract pin wait for the API 009 implementation to be
  released (T120 re-checks the pin then).
- **UI**: UI 001 (foundation); UI 002 (domain page with its section list, bulk selection and action
  bar, typed confirmation, section editing, leave guard, History link, role-restricted routes,
  coverage manifest); UI 001's legacy translation layer (runtime `/lang/` loader, `en-gb` snapshot,
  formatter) and `SanitizedHtml.vue`; UI 003 (mailbox layout with child-route sections,
  `ActiveFilterChips`, `AclReadOnlyNote`); UI 005 (`PasswordInput`, `CopyButton`, flag labels);
  UI 006 (promotes `AclReadOnlyNote`); UI 007 (manages the permission flags this feature reads,
  flag labels). UI 004 and UI 008 add nothing this feature needs, but their contract pins come
  first (pins are monotonic, R1).
- **Prerequisites table**: T001 fills it with the actual names before Phase 2.

  | Prerequisite (research R1) | Location in the earlier plan | Actual location (T001) |
  |---|---|---|
  | `useBulkSelection`, `BulkActionBar`, `BulkResultSummary` | `src/shared/composables/useBulkSelection.ts`, `src/shared/components/{BulkActionBar,BulkResultSummary}.vue` (UI 002) | _to be recorded_ |
  | `ConfirmDialog` with `requireTyped` and rich content | `src/shared/components/ConfirmDialog.vue` (UI 002) | _to be recorded_ |
  | `useVersionedSave` with `changedSince`, `EditableSection` | `src/shared/composables/useVersionedSave.ts`, `src/shared/components/EditableSection.vue` (UI 002) | _to be recorded_ |
  | `useLeaveGuard` | `src/shared/composables/useLeaveGuard.ts` (UI 002, canonical name) | _to be recorded_ |
  | `HistoryLink` and the audit target filters | `src/shared/components/HistoryLink.vue`, `src/features/audit-log/list-state.ts` (UI 002) | _to be recorded_ |
  | `ActiveFilterChips`, not-found state with a back link | `src/shared/components/ActiveFilterChips.vue` (UI 003), `NotFoundState` or `NotFoundPage` `backTo` (UI 002, UI 003) | _to be recorded_ |
  | Route roles inside an entry | `src/app/navigation/visibility.ts`, `src/app/layouts/ShellLayout.vue` (UI 002) | _to be recorded_ |
  | Domain page, section list, `edit=<section>`, key | `src/features/domains/pages/DomainDetailPage.vue`, route `domain-detail`, `['domains','detail',name]` (UI 002) | _to be recorded_ |
  | Mailbox layout, child routes, section catalogue, managed settings, key | `src/features/mailboxes/{routes.ts,sections.ts,pages/MailboxDetailPage.vue,components/display/{MailboxSectionNav,ManagedSettingsGroup}.vue}`, route `mailbox-detail`, `['mailboxes','detail',address]` (UI 003) | _to be recorded_ |
  | Mock state and handlers of domains and mailboxes | `tests/mocks/scenarios/state.ts`, `tests/mocks/handlers/{domains,mailboxes}.ts` (UI 002, UI 003) | _to be recorded_ |
  | `PasswordInput`, `CopyButton` | `src/shared/components/password/PasswordInput.vue`, `src/shared/components/CopyButton.vue` (UI 005) | _to be recorded_ |
  | `AclReadOnlyNote` | `src/shared/components/AclReadOnlyNote.vue` (UI 003, promoted by UI 006) | _to be recorded_ |
  | Domain administrator flag labels | legacy `acl.bcc_maps`, `acl.domain_relayhost`, `acl.mailbox_relayhost`, used verbatim (UI 007) | _to be recorded_ |
  | Coverage registry, `ENUM_NAMESPACES` | `src/i18n/coverage.json` (canonical), `scripts/i18n/lib.mjs` (UI 002, UI 003) | _to be recorded_ |
  | Legacy translation layer and `SanitizedHtml.vue` allowlist | UI 001 (constitution IV 1.3.0) | _to be recorded_ |

## API dependency and gaps

The pinned contract covers every requirement of the spec except the gaps below. Constitution I
says a gap is specified in mailcow-rest-v2 first: each one is to be registered in
`../mailcow-rest-v2/docs/api-gaps.md` with the next free numbers (proposed rows below; the
register's last entry at planning time is G33). The planning agent cannot write to the API
repository, so the orchestrator registers them, and T001 stops the implementation until they are
registered. None blocks the UI work, and the UI never works around them.

| Proposed row | API feature | Gap | Fix | UI meanwhile |
|---|---|---|---|---|
| G34 | 001/009 (shared) | `requiredFlagsMatch` (`all`, `any`) is defined in `docs/problems.md` and `docs/conventions.md` but declared in no schema, including `RoutingPermissionFlagProblem`. | Declare `requiredFlagsMatch: enum [all, any]` on every `permission-flag-required` problem schema. | Neutral wording "Missing permission: A, B", correct in both cases (R19) |
| G35 | 009 | The `nextHop` filter of `GET /transports` is not normalised like a stored next hop (bare IP in brackets, Unicode host in ASCII). | Normalise the filter value as at creation. | The FR-041 pre-save confirmation can miss transports for such inputs; the post-save report names them (spec consistency change 8, R10) |
| G36 | 009 | `RoutingCapabilities.administration.maxLengths` has no limit for the forwarding host `host` and the connection test `sender` and `recipient`. | Add `forwardingHost`, `testSender` and `testRecipient` (or one `testAddress`). | No client-side maximum on these fields; the API's `tooLong` is shown at the field (R3) |
| G37 | 009 | `RelayhostPatch` says a changed read-only member is refused with `readOnly`, while `ValidationRuleCode` and the other patches use `immutable`. | Use `immutable` in `RelayhostPatch.yaml`. | Both codes are translated; changed-fields-only saves never send read-only members (R6) |

Observations without a register entry:

- **Documentation drift**: API 009's `contracts/README.md` points to
  `api/modules/capabilities/routing/`, but the module is `api/modules/routing-capabilities/`. The
  API spec's FR-087 lists "attribute not permitted", which no API 009 operation documents. No UI
  effect.
- **Forwarding host creations are audited under the source**, updates and deletions under the
  address (API data-model). Not a gap: the UI adds "History of this source" (R18).
- **Quotes in version tags** are already register entry G33 (UI 003); UI 009 strips them for
  `BulkTarget.version` as UI 002 does (R5).

## Owner-level questions (defaults applied)

1. **Review of the new Czech and Slovak strings**: legacy translations are used verbatim and need no
   review; only the new strings, which the implementer writes and never machine-translates, do. **Default**: the
   owner reviews the list that T118 produces before the release, as for UI 001 (UI 001 owner
   question 4).

## Parity notes added by the plan

The spec's parity table is complete. The plan adds:

1. **Orphaned BCC maps** (legacy hides them from everyone): administrators see them labelled
   "Domain no longer exists" and can filter and delete them. Improved, from API 009.
2. **Test addresses**: legacy prefills `null@hosted.mailcow.de`; the app leaves the fields empty
   and shows the server's configured defaults as placeholders. Improved.
3. **Legacy hints with markup**: shown verbatim, with their bold, code, bullet and link formatting,
   through `SanitizedHtml.vue` (constitution IV 1.3.0). Matched.

## Project Structure

### Documentation (this feature)

```text
specs/009-routing-address-rewriting/
├── spec.md              # Feature specification (with clarifications, consistency changes, parity)
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R25
├── data-model.md        # Phase 1: consumed API data, view models, query keys, routes, state machines
├── quickstart.md        # Phase 1: validation guide
├── contracts/README.md  # Phase 1: pinned contract, operations used, problem handling
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

New files of this feature, plus the existing files it changes (marked "changed"). The layout is UI
001's (UI 001 plan, "Project Structure").

```text
.github/workflows/ci.yml                                  # changed: smoke job with the routing profile (T120)
contract/{openapi.yaml,openapi.json,VERSION.json}        # changed: bumped pin (T002)
scripts/
├── i18n/{lib.mjs,check.mjs}                              # changed: routing enums (T025)
├── smoke/stack-up.sh                                     # changed: SMOKE_COMPOSE_PROFILES (T072)
└── run-lhci.mjs                                          # changed: routing collection (T116)
src/
├── api/
│   ├── generated/schema.ts                               # regenerated
│   ├── index.ts                                          # changed: routing root types re-exported
│   └── query/keys.ts                                     # changed: routing keys
├── app/
│   ├── navigation/catalogue.ts                           # changed: routing access and status
│   └── router/routes.ts                                  # changed: routing routes registered
├── features/
│   ├── routing/
│   │   ├── index.ts                                      # routes, DomainRelayhostSection, MailboxRelayhostSection
│   │   ├── routes.ts
│   │   ├── screens.ts  access.ts  capabilities.ts  history.ts  problems.ts
│   │   ├── api/{relayhosts,relayhost-assignments,transports,connection-test,bcc-maps,
│   │   │        recipient-maps,tls-policy-maps,forwarding-hosts}.ts
│   │   ├── list-states/{relayhosts,relayhost-usage,transports,bcc-maps,recipient-maps,
│   │   │                tls-policy-maps,forwarding-hosts}.ts
│   │   ├── logic/{changed-fields,credentials,next-hop,destinations,relayhost-section,
│   │   │          test-summary,transcript,bulk-actions}.ts
│   │   ├── composables/{useEntryForm,useRoutingBulk,useSharedNextHop,useTransportCreateBatch,
│   │   │                useConnectionTest,useForwardingHostResults}.ts
│   │   ├── components/
│   │   │   ├── common/{EntryList,ListToolbar,EntryActionsMenu,ScreenIntro,RoutingSectionNav,
│   │   │   │           CredentialFields,StatusText,FormActionBar}.vue
│   │   │   ├── relayhosts/{relayhost-columns.ts,relayhost-usage-columns.ts,RelayhostFilters.vue,
│   │   │   │               RelayhostForm.vue,RelayhostDeleteImpact.vue}
│   │   │   ├── sections/{RelayhostChoicePicker,RelayhostReferenceText,DomainRelayhostSection,
│   │   │   │             MailboxRelayhostSection}.vue
│   │   │   ├── transports/{transport-columns.ts,TransportFilters.vue,TransportForm.vue,
│   │   │   │               DestinationListField.vue,SharedNextHopNotice.vue,TransportCreateResults.vue}
│   │   │   ├── connection-test/{ConnectionTestForm,ConnectionTestSummary,ConnectionTestSteps,
│   │   │   │                    ConnectionTranscript}.vue
│   │   │   ├── bcc-maps/{bcc-map-columns.ts,BccMapFilters.vue,BccMapForm.vue,BccDestinationPicker.vue}
│   │   │   ├── recipient-maps/{recipient-map-columns.ts,RecipientMapFilters.vue,RecipientMapForm.vue}
│   │   │   ├── tls-policy-maps/{tls-policy-map-columns.ts,TlsPolicyMapFilters.vue,TlsPolicyMapForm.vue,
│   │   │   │                    TlsPolicyField.vue}
│   │   │   └── forwarding-hosts/{forwarding-host-columns.ts,ForwardingHostFilters.vue,
│   │   │                         ForwardingHostForm.vue,ForwardingHostResults.vue}
│   │   └── pages/
│   │       ├── RoutingIndexPage.vue  ConnectionTestPage.vue
│   │       ├── relayhosts/{RelayhostsPage,RelayhostCreatePage,RelayhostEditPage,RelayhostUsagePage}.vue
│   │       ├── transports/{TransportsPage,TransportCreatePage,TransportEditPage}.vue
│   │       ├── bcc-maps/{BccMapsPage,BccMapCreatePage,BccMapEditPage}.vue
│   │       ├── recipient-maps/{RecipientMapsPage,RecipientMapFormPage}.vue
│   │       ├── tls-policy-maps/{TlsPolicyMapsPage,TlsPolicyMapFormPage}.vue
│   │       └── forwarding-hosts/{ForwardingHostsPage,ForwardingHostCreatePage,ForwardingHostEditPage}.vue
│   ├── domains/pages/DomainDetailPage.vue                # changed (UI 002): `relayhost` section after Groupware
│   ├── mailboxes/routes.ts                               # changed (UI 003): child route `mailbox-relayhost`
│   ├── mailboxes/sections.ts                             # changed (UI 003): `relayhost` section entry
│   ├── mailboxes/components/display/ManagedSettingsGroup.vue   # changed (UI 003): relayhost `to`
│   └── audit-log/labels.ts                               # changed: routing event and target labels
└── i18n/
    ├── messages/{en-gb,cs-cz,sk-sk}.json                 # changed: routing.*, validation.*, problem.*, auditLog.*
    ├── coverage.json                                     # changed: API 009 values
    └── problems.ts                                       # changed: `because` parameter
tests/
├── mocks/
│   ├── handlers/{relayhosts,relayhost-assignments,transports,bcc-maps,recipient-maps,
│   │             tls-policy-maps,forwarding-hosts,routing-capabilities}.ts
│   ├── handlers/index.ts                                 # changed: registers them
│   ├── handlers/{domains,mailboxes}.ts                   # changed (UI 002, UI 003): shared relayhostId
│   ├── scenarios/routing/{index,base,relayhosts,assignments,transports,connection-tests,
│   │                      bcc-maps,tls-policy-maps,recipient-maps,forwarding-hosts}.ts
│   ├── scenarios/{state,index}.ts                        # changed: routing state, registration
│   └── factories/{relayhost,transport,bcc-map,recipient-map,tls-policy-map,forwarding-host,
│                  connection-test}.ts
├── unit/
│   ├── features/routing/**                               # logic, composables, components, api
│   └── features/routing/legacy-hints.spec.ts             # legacy hints verbatim through SanitizedHtml
├── e2e/routing/{routing-shell,relayhosts,relayhost-usage,relayhost-sections,transports,
│                connection-test,bcc-maps,tls-policy-maps,recipient-maps,forwarding-hosts,
│                history,credential-secrecy,reflow-and-keyboard}.spec.ts
└── smoke/routing-{relayhosts,assignments,transports,connection-test,bcc-maps,
                   tls-policy-maps,recipient-maps,forwarding-hosts}.smoke.spec.ts
```

**Structure Decision**: one feature directory for the Routing section, organised by screen inside
(R2). Building blocks that six or two of its screens share stay in the feature; legacy hints with
markup reuse UI 001's `SanitizedHtml.vue`. The domain section and the mailbox
child route are the feature's public surface for UI 002 and UI 003, through `index.ts`.

## Complexity Tracking

No constitution violation needs justification. The smoke specs of this feature run against a real
API 009 implementation, which exists when UI 009 is implemented. Whether the CI `smoke` job is a
blocking gate follows UI 001's recorded decision (UI 001 plan, Complexity Tracking, and its T150):
if that job is not yet a gate, UI 001's deviation still applies and this feature adds none.
