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
- **Text**: the legacy keys of the spec are reused, including ten hints with markup, which the
  i18n import converts into a small notation that `RichText.vue` renders without `v-html` (R20).
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
- Every user-facing text in en-gb, cs-cz and sk-sk, reusing the listed legacy keys.

**Scale/Scope**:

- 9 user stories (3 at P1, 5 at P2, 1 at P3), 75 functional requirements, 10 success criteria.
- 22 routes, 2 sections embedded in UI 002 and UI 003, 46 contract operations.
- About 90 reused legacy keys and roughly 400 new message keys per locale.
- Up to 10,000 entries per collection (paged lists, paged pickers).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Gate | Status |
|---|---|---|
| I. The API contract is the only interface | All calls are operations of the pinned contract through the generated client; the bump is a deliberate task with typecheck and all tests (R1). Types are generated root types and operation parameter aliases (data-model §1). Gaps are to be registered in mailcow-rest-v2's gap register first (G34–G37 below, checked by T001) and are not worked around: the shared-next-hop lookup sends the input unnormalised (R10), and the permission message stays neutral without `requiredFlagsMatch` (R19). Errors are handled from `type`, extension members and `errors` (R19, contracts README). | PASS |
| II. Mobile-first | Every screen is designed and tested at 360 px first. Lists are cards below `md` and tables above (R4). Forms are their own pages with a sticky action bar (R6); the Relayhost sections open full-screen on phones (R9). Destructive actions are confirmed with their impact (R5, R8). Every list and picker has loading, empty and error states. The test summary fits 360 × 780 (R12); the transcript wraps (R13). | PASS |
| III. Accessibility | axe in both themes on every screen and state (R24). Statuses in words (R4). Live announcements for saves, bulk results, result counts, test progress and summary. Pickers and dialogs are Reka components with focus handling (FR-071). The transcript direction is spoken, not only shown (R13). | PASS |
| IV. i18n and branding | All text from en-gb, cs-cz and sk-sk messages. The spec's legacy keys are reused, including markup hints through the rich import (R20, R21). `i18n:check` covers the routing enumerations. Values from the API are shown untranslated (FR-073). No brand-specific text. | PASS |
| V. Security in the browser | Passwords are write-only in the UI too: empty fields, status only, `new-password` autocomplete, cleared after every save attempt, never in cache, address, history state or storage (R7). API data is rendered as text; `RichText` renders only translation text from the repository, without `v-html` (R20). Hiding controls is a convenience: the API's refusals are handled (R19). | PASS |
| VI. Test-first | `tasks.md` writes tests before implementation in every phase. End-to-end tests of every acceptance scenario on both viewports against the contract-validated mock (R23, R24). Unit tests cover unknown enumeration values that a mock may not send. Smoke tests against the real API. | PASS |
| VII. Performance budgets | No new dependency; lazy routes; async sections; debounced searches; capabilities cached for 5 minutes; invalidation only of what a change affects (R22, R25). `budget:check` and Lighthouse run on a routing page. | PASS |
| VIII. Simplicity | One feature directory. Generic `EntryList` and `CredentialFields` inside the feature because six and two of its screens use them; `RichText` in `src/shared/` because ten hints on six screens use it. Earlier features' shared blocks (`BulkActionBar`, `useLeaveGuard`, `PasswordInput`, `CopyButton`, `AclReadOnlyNote`, `ActiveFilterChips` and the others of R1) are reused, not rebuilt. | PASS |
| Technology constraints | The constitution's stack and TailAdmin primitives only; no new font, icon set or CDN request. Static build, unchanged deployment. | PASS |
| Workflow and gates | All UI 001 CI gates apply unchanged; the smoke job runs the `@routing` specs with the `routing` profile. | PASS |
| `docs/conventions.md` | Legacy names kept ("Sender-dependent transports"). List state in the address, page sizes 25/50/100, cards and tables, list states (R4). Bulk: explicit selection, current page only, per-item version tags, per-item results, failed items stay selected, "outcome unknown" (R5). Editing: changed fields plus version tag, input kept on `412`, changed values marked, no overwrite, refused deletion confirmed again (R6). Confirmations: impact preview, typed count for bulk deletion, explicit confirmation for deactivation (R5, R8). Write-only secrets (R7). History by target type and ID, audit labels (R18). Problems and rule codes translated (R19). Entry points into UI 002 and UI 003 through their section areas (R9). Limits from the capabilities read (R3). | PASS |

**Post-design re-check (after Phase 1)**: PASS. The data model, contracts README and quickstart
introduce no violation. Decisions that touched gates:

- The test watchdog aborts the request at the server's total timeout plus 15 s, an exception to UI
  001 R8's "no client-side timeout" for this one operation (R11); it follows FR-045 and the
  conventions' "limits from capabilities", and is not a constitution deviation.
- The rich legacy hints are rendered from repository translations without `v-html` (V, R20).
- The admin relayhost picker reads `GET /relayhosts` to show usernames (FR-032) instead of asking
  the API for a new field (I, R9).

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
  coverage manifest, legacy map object entries); UI 003 (mailbox layout with child-route sections,
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
  | Domain administrator flag labels | legacy `acl.bcc_maps`, `acl.domain_relayhost`, `acl.mailbox_relayhost` through the legacy map (UI 007) | _to be recorded_ |
  | Coverage registry, `ENUM_NAMESPACES`, legacy map object entries | `src/i18n/coverage.json` (canonical), `scripts/i18n/lib.mjs`, `{ "from", "stripMarkup" }` (UI 002, UI 003) | _to be recorded_ |

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

1. **Review of the new Czech and Slovak strings** (about 400 per locale): reused legacy
   translations are reviewed upstream; new strings are written by the implementer. **Default**: the
   owner reviews the list that T118 produces before the release, as for UI 001 (UI 001 owner
   question 4).

## Parity notes added by the plan

The spec's parity table is complete. The plan adds:

1. **Orphaned BCC maps** (legacy hides them from everyone): administrators see them labelled
   "Domain no longer exists" and can filter and delete them. Improved, from API 009.
2. **Test addresses**: legacy prefills `null@hosted.mailcow.de`; the app leaves the fields empty
   and shows the server's configured defaults as placeholders. Improved.
3. **Rich legacy hints**: bold, code, bullet and link formatting of the reused hints is kept
   through the app's own formatting, and the Postfix documentation link says that it opens an
   external site. Matched.

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
├── i18n/{lib.mjs,import-legacy.mjs,check.mjs}            # changed: rich hints (T004), routing enums (T025)
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
├── shared/
│   └── components/RichText.vue                           # new unless an earlier feature added it
└── i18n/
    ├── messages/{en-gb,cs-cz,sk-sk}.json                 # changed: routing.*, validation.*, problem.*, auditLog.*
    ├── legacy/{en-gb,cs-cz,sk-sk}.json                   # regenerated
    ├── legacy-map.json                                   # changed: reused keys, rich entries
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
│   ├── shared/components/RichText.spec.ts
│   └── scripts/i18n-rich.spec.ts
├── e2e/routing/{routing-shell,relayhosts,relayhost-usage,relayhost-sections,transports,
│                connection-test,bcc-maps,tls-policy-maps,recipient-maps,forwarding-hosts,
│                history,credential-secrecy,reflow-and-keyboard}.spec.ts
└── smoke/routing-{relayhosts,assignments,transports,connection-test,bcc-maps,
                   tls-policy-maps,recipient-maps,forwarding-hosts}.smoke.spec.ts
```

**Structure Decision**: one feature directory for the Routing section, organised by screen inside
(R2). Building blocks that six or two of its screens share stay in the feature; `RichText` goes
to `src/shared/` because other features' hints can use it. The domain section and the mailbox
child route are the feature's public surface for UI 002 and UI 003, through `index.ts`.

## Complexity Tracking

No constitution violation needs justification. The smoke specs of this feature run against a real
API 009 implementation, which exists when UI 009 is implemented. Whether the CI `smoke` job is a
blocking gate follows UI 001's recorded decision (UI 001 plan, Complexity Tracking, and its T150):
if that job is not yet a gate, UI 001's deviation still applies and this feature adds none.
