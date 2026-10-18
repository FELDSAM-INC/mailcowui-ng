# Implementation Plan: Aliases, Alias Domains, Resources and Sender Permissions

**Branch**: `main` (no feature branches, constitution 1.2.0) | **Date**: 2026-10-18 |
**Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-aliases-alias-domains-resources/spec.md`

## Summary

UI feature 004 replaces the legacy Mail setup › Aliases, Alias domains and Resources tabs, their
add dialogs and edit pages, and the "Allow to send as" and "External sender addresses" fields of the
legacy Edit mailbox page. It delivers, for administrators and domain administrators:

- **aliases**: a server-paged list (cards below 768 px, a table above) with search, nine filters and
  nine sort keys; a detail screen split into editable sections; a creation form that accepts several
  addresses and sends one request per address; deletion; copying over alias domains;
- **alias domains**: list, detail with the read-only rate limit, creation with the DKIM switch and
  the initial rate limit, the creation report, target and active changes, deletion;
- **resources**: list with the booking legend, creation with a preview of the derived address,
  changes and deletion;
- **"Send as"**: a screen opened from UI 003's mailbox detail that explains every sender address of a
  mailbox and edits the explicit permissions, "any address" and the external sender addresses;
- **mass actions** on the three lists, with per-object results, and **History** links for
  administrators.

The technical approach (details in [research.md](./research.md)) reuses everything UI 001 decided
and UI 002 and UI 003 deliver, and adds:

- **Contract**: planned against mailcow-rest-v2 commit `32079252d55797d3da4e58ae661e9fb91c51c6f9`,
  the baseline UI 002 and UI 003 also use. It has the complete, analysed feature 004 contract. At
  implementation time, the pin moves to the commit, or release tag, that ships the API 004
  implementation, after a review of the feature 004 contract files (R1).
- **Four feature areas**: `src/features/aliases`, `alias-domains`, `resources` and
  `sender-settings`. `aliases` owns the feature's capabilities read and the permission matrix of
  FR-002, and the other three import them through `@/features/aliases`. Imports never go the
  other way (R3).
- **Three shared building blocks**, each with at least two uses in this feature:
  - `parseEntryList()` and `EntryListField.vue` for multi-entry inputs;
  - `useSequentialCreate()` for "one request per entry";
  - `useFormDraft()`, which keeps form input in memory across a session expiry.
- **Reuse of the building blocks reserved by UI 001 R20** and named by the UI 002 and UI 003 plans:
  bulk selection, bulk bar and results, typed confirmation, editable sections with conflict marking,
  History links, filter chips, the leave guard and the in-place "not found" state.
  - This feature promotes five blocks at their second use: UI 003's `DomainPicker`, and UI 002's
    `DomainNameText`, `DkimFields`, `RateLimitField` and `CreationReport`.
  - Phase 2 pins every block with a dependency test before any story starts (R2).
- **Capabilities** (`GET /capabilities/aliases`): read once and cached for 5 minutes. They gate the
  forms and the mass actions with an error state and a retry. Lists and detail views never wait for
  them (R5).
- **The contract-validated mock** gains handlers for the 23 operations, on one scenario state that
  shares mailboxes and domains with UI 002 and UI 003 (R21).
- **i18n**: the spec's legacy keys are reused through UI 002's `stripMarkup` import option, plus two
  options added here: per-locale restriction and positional placeholders. They cover the texts with
  markup and the eight cs-cz or sk-sk gaps. The feature's values are appended to the enumeration
  scope manifest of UI 002 and UI 003 (R20).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict) and Vue 3.5 SFCs; Node.js 24 LTS for tooling (UI 001
research R1, R2).

**Primary Dependencies**: Those of UI 001 only (`vue`, `vue-router`, `@tanstack/vue-query`, `pinia`,
`vue-i18n`, `reka-ui`, `clsx`, `tailwind-merge`, `openapi-fetch`, `dompurify`). **No new runtime or
development dependency.** The Reka parts used are the ones UI 001 copied from TailAdmin 2.5.0:
`combobox` (without its viewport), `radio-group`, `switch`, `checkbox`, `dialog`, `dropdown-menu` and
`collapsible`.

**Storage**: none on a server. In the browser: the in-memory query cache, and an in-memory draft
registry (`useFormDraft`) that never touches device storage. UI 001's storage allowlist (data-model
§4) is unchanged.

**Testing** (UI 001 R22–R25, unchanged):

- Vitest with Vue Test Utils for units and components, in TDD order.
- Playwright `mobile-chromium` (360 × 780), `desktop-chromium` (1366 × 900) and `mobile-webkit`
  against the production build, the production CSP and the contract-validated mock. Every test runs
  axe in both themes, with CSP, horizontal-scroll and touch-target checks and zero mock contract
  violations.
- A smoke project against the mailcow-rest-v2 dev stack.
- `i18n:check`, `budget:check` and Lighthouse CI, which gains an `/ng/aliases` collection (R22).

**Target Platform**: as UI 001: the two latest majors of evergreen browsers including iOS Safari and
Chrome for Android, served under `/ng/` by the `ng-mailcow` image.

**Project Type**: web application (static SPA). This feature adds feature areas, mock handlers and
tests to the existing project.

**Performance Goals**:

- SC-009: the first alias page in under 2 s on a mid-range phone over 4G. One list request,
  rendering does not wait for the capabilities, and the route chunk is lazy.
- SC-010: per-object results of a 100-alias mass action within 15 s. One bulk request; the result
  list renders 100 rows without virtualisation.
- Initial JavaScript stays at most 200 KB gzipped, because every new route is lazy-loaded.

**Constraints**:

- Only operations of the pinned contract, through the generated client.
- Lists never load a whole collection: every list, picker and the grantable-entry list are searched
  and paged by the server.
- No inline script or style, and `v-html` only in `SanitizedHtml.vue`. Legacy texts with markup are
  imported as plain text (R20).
- 44 × 44 px targets. Usable at 360 px and 320 px and at 400 % zoom.
- Limits, the groupware state, the external-destination setting, the DKIM defaults and the bulk
  limit come from the capabilities read, never from constants (FR-071).

**Scale/Scope**:

- 8 user stories: 3 at P1, 3 at P2, 2 at P3.
- 10 new routes and 3 catalogue entries replacing one.
- 23 new contract operations, plus 4 reused ones.
- About 260 new translation keys, about 75 of them reused from legacy.
- Target servers have 5,000 domains and 200,000 aliases.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Gate | Status |
|---|---|---|
| I. The API contract is the only interface | The pin is a reviewed bump (`contract/VERSION.json`, regenerated types, typecheck and all tests; R1). The 23 operations of [contracts/README.md](./contracts/README.md) are called through `@/api`, with types re-exported from the generated schema. No hand-written API type. The mock validates every request and response. Four gaps are reported to mailcow-rest-v2 and not worked around (see "API dependency and gaps"). Problem `type` and `errors` drive every message (R17). | PASS |
| II. Mobile-first | Every screen is designed at 360 px first. Lists are cards below 768 px and tables above. The creation forms are full-screen pages, and section editors open full screen on phones (FR-064). Selection mode has 44 px checkboxes and a sticky action bar (FR-056). Destructive actions are confirmed with their impact, and a mass deletion needs the typed count (FR-029, FR-058). Every list and detail view has loading, empty and error states (FR-008). Pinch-zoom is untouched. | PASS |
| III. Accessibility | axe in both themes on every screen, dialog and state. Single-choice controls are Reka radio groups. Errors are linked to their fields and summarised. Saves, deletions, result counts and bulk summaries are announced. Every state shown by colour also has text (FR-063). A keyboard-only end-to-end pass covers every story (R21). | PASS |
| IV. i18n and branding | en-gb, cs-cz and sk-sk complete, checked by `i18n:check`. It covers the feature's values in the enumeration scope manifest and every closed enumeration the feature renders (R20). Legacy keys are reused where the meaning is unchanged, and markup is converted to plain text at import (R20). The product name in the address help comes from `GET /public-config`. Dates and numbers use `Intl`. | PASS |
| V. Security in the browser | No new storage key. Form drafts are kept in memory only (R10), and the storage audit end-to-end test is extended. No `v-html`. Hidden controls are a convenience: `forbidden`, `permission-flag-required` and `attribute-not-permitted` refresh the identity (FR-004). 404 for objects outside the scope is shown as "not found" (FR-003). | PASS |
| VI. Test-first | `tasks.md` puts the tests before the implementation in every phase. End-to-end tests cover every acceptance scenario on both viewports against the contract-validated mock. Unit tests cover the logic: entry parsing, sequential creation, patch building, the address preview, the send-as model and the permission matrix. Smoke tests run against the real API. | PASS (smoke gate as UI 001, Complexity Tracking there) |
| VII. Performance budgets | Ten lazy route chunks and no new dependency, checked by `budget:check`. Lighthouse adds `/ng/aliases` (R22). The query policy refetches only after invalidation, and the invalidation table is in data-model §3. | PASS |
| VIII. Simplicity | No new dependency. New shared code has at least two uses (R3). Blocks that UI 002 or UI 003 kept in their feature folders are promoted, not copied, when they get their second use here (R2). The patch building and the address preview are plain functions. | PASS |
| Technology constraints | The stack is unchanged. Only TailAdmin primitives copied by UI 001 are used, and no Reka viewport. | PASS |
| `docs/conventions.md` | **Lists**: state in the address, page sizes 25/50/100, cards and tables, all states. **Bulk**: explicit selection mode, current page only, cleared on list changes, `{id, version}` targets, per-item results, failures kept selected, connection drops reported as "outcome unknown" and never retried. **Editing**: sections each with their own save, only changed fields, the version tag read, outdated saves keep the input, reload and mark changes, a refused deletion is confirmed again. **Confirmations**: impact dialogs, typed count for mass deletion, one confirmation for deactivate and hide. **History**: the audit log filtered by target, plus labels for the 004 events. **Errors**: problem types and rule codes translated. **Permissions**: hidden or read-only controls with the reason. **Where features meet**: "Send as" on UI 003's mailbox detail, and links to UI 002, 006 and 010 screens only once they exist. **Capabilities**: limits come from the capabilities read. | PASS |

**Post-design re-check (after Phase 1)**: PASS. The data model, contracts README and quickstart add no
violation. Decisions that touched gates:

- Lists do not wait for the capabilities. Their page sizes follow the UI conventions and the API's
  fixed list defaults (R5, VII, spec edge case "Capabilities cannot be read").
- Form drafts are held in memory only, never in storage (V, R10).
- Legacy texts with markup are converted to plain text at import time and rendered as text, never
  as HTML (IV, V, R20).
- The candidate labels fall back to the contract's coarser `type` until API gap G1 is closed (I).

## API dependency and gaps

This feature depends on **mailcow-rest-v2 feature 004**. It is planned against commit
`32079252d55797d3da4e58ae661e9fb91c51c6f9` (bundle sha256
`5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6`, 376 operations; see
[contracts/README.md](./contracts/README.md)). At implementation time, it is pinned to the commit or
tag that ships the API 004 implementation (R1). It also uses API 001 (identity, public configuration,
audit log with the `targetType` and `targetId` filters that API 002 added) and API 002
(`listDomains` for the pickers). The spec's API dependency list is covered, with the gaps below.

1. **G1: grantable entries and explicit permissions cannot be labelled as FR-050 asks.**
   `MailboxSenderPermissionCandidate.type` and `MailboxSenderPermission.type` are only `address`,
   `domain` or `anyAddress`. They do not say whether a domain entry is a domain or an alias domain,
   or whether an address is an alias or a mailbox (FR-050, US5-AS9, and FR-049's "including its
   alias domains").
   - **Proposed to mailcow-rest-v2**: add `kind` (`domain`, `aliasDomain`, `alias`, `mailbox`,
     `anyAddress`) to both schemas.
   - **Until then**: the picker labels each entry by the contract's `type` ("Domain", "Address",
     "Any address"). The domain label does not claim alias domains for an entry that is itself an
     alias domain. The end-to-end test for US5-AS9 asserts these labels, and a contract bump with
     the fix extends them (R15).
   - The UI never looks up each entry in other lists to guess its kind (constitution I).
2. **G2: no readable form of some addresses.** `Alias.destinations`, `AliasCopyOutcome.address`
   and `MailboxSenderSettings.externalSenderAddresses` exist only in ASCII form. Every other address
   and domain has a `…Unicode` twin.
   - **Proposed**: add `destinationsUnicode`, `addressUnicode` and `externalSenderAddressesUnicode`.
   - **Until then**: these values are shown exactly as stored. That matches the edge case
     "destinations stored by another tool are shown as stored", but not "addresses shown in
     readable form" for punycode destinations. The app does not ship its own punycode decoder
     (constitution VIII; it would reimplement a server rule).
3. **G3: the `details` of feature 004 audit records are not in the contract.** `AuditEvent.details`
   is a free-form object. Its 004 members (`changes`, `creationReport`, `removed`,
   `copiedFromAliasId`, `groupwareUpdate`, `bulkRequestId`) are defined only in API research R20.
   - **Proposed**: document the members per event type in the contract.
   - **Until then**: History shows the 004 records with translated event and target labels, and a
     link to the object. Their details are rendered by UI 001's generic definition list, so old
     and new values are visible as text (US8-AS1).
4. **G4: wording conflict for `localDomain`.** `MailboxSenderSettingsPatch` says that external
   sender addresses in local domains get `notEligible` with `reason: localDomain`. `ValidationRuleCode`,
   API data-model and API research say `kind: localDomain`.
   - **Proposed**: align the schema description to `kind`.
   - **Until then**: the UI keys the message by `kind`, the authoritative enumeration text.
5. **Already closed**: UI 001's API gap 5. `KnownProblemType` is listed under `components.schemas`
   from commit `3207925` on, so the pins of UI 002 and UI 003 already generate
   `knownProblemTypeValues`.

## Owner-level questions (defaults applied)

1. **Sender permission labels before API gap G1 is closed.**
   - **Default**: ship US5 with labels by contract type ("Domain", "Address", "Any address").
   - **Alternative**: hold US5 until mailcow-rest-v2 adds `kind`.
   - Every other part of US5 is unaffected.
2. **Native review of the new cs-cz and sk-sk strings**, as UI 001's owner question 4. This feature
   writes about 185 new strings per locale. It also writes the eight values that the spec counted as
   reusable but that are missing from the legacy cs-cz or sk-sk files (R20).
   - **Default**: the owner reviews them before the release.

## Parity notes added by the plan

The spec's parity tables are complete. The plan adds:

1. `mailbox.alias_domain_alias_hint` is **not reused**. Without its markup it still names the legacy
   "Filters" tab and "SOGo -> Forwarder", which the spec drops (FR-017), and its Czech text lacks
   the last sentence. FR-017 gets a new key with the same meaning in all three locales (R20).
2. The spec says every reused key exists in en-gb, cs-cz and sk-sk. Eight values are missing from
   upstream `2026-09a`:
   - `add.internal`, `edit.internal_info`, `edit.sender_allowed` and `edit.sender_allowed_info` in
     sk-sk;
   - `acl.alias_external_goto` and `danger.external_goto_denied` in both cs-cz and sk-sk.

   The app layer of those locales supplies them (UI 001 R15).
3. Destinations, copy addresses and external sender addresses are shown as stored (ASCII) until API
   gap G2 is closed.
4. The list action "Edit" opens the detail screen, whose sections each have their own edit action
   (conventions "Editing and conflicts"), as UI 003 FR-013 does for mailboxes (R10).

## Project Structure

### Documentation (this feature)

```text
specs/004-aliases-alias-domains-resources/
├── spec.md              # Feature specification (with clarifications and parity)
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R22
├── data-model.md        # Phase 1: consumed API data, view models, query keys, routes, validation, state machines
├── quickstart.md        # Phase 1: validation guide
├── contracts/README.md  # Phase 1: pinned contract, operations used, problem handling
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

Only the files this feature adds or changes are listed. The rest is the layout of UI 001, plus what
UI 002 and UI 003 add. The building blocks this feature expects from them are listed in research R2.

```text
contract/{openapi.yaml,openapi.json,VERSION.json}     # bumped to the API 004 implementation commit (R1)
src/api/
├── generated/schema.ts                               # regenerated
├── index.ts                                          # + 004 root types and enum arrays
└── query/keys.ts                                     # + aliases, alias-domains, resources, sender-settings,
                                                      #   sender-permission-candidates, capabilities.aliases
src/app/
├── navigation/catalogue.ts                           # `aliases` row → aliases, aliasDomains, resources
├── router/routes.ts                                  # + the routes of the four areas
└── session/{session-end.ts,sign-out.ts,cross-tab.ts} # notify the draft registry (R10)
src/features/
├── aliases/
│   ├── index.ts                                      # routes; capabilities; permissions; CapabilitiesGate
│   ├── routes.ts  api.ts  list-state.ts  capabilities.ts  permissions.ts
│   ├── alias-form.ts                                 # form model, create request, buildAliasPatch, refusal classifier
│   ├── alias-bulk.ts                                 # bulk action configuration
│   ├── pages/{AliasesPage,AliasCreatePage,AliasDetailPage}.vue
│   └── components/{CapabilitiesGate,AliasCard,AliasTable,AliasList,AliasFilters,AliasBadges,
│                   DestinationSummary,AliasDomainHint,OrphanedAliasWarning,AddressEntriesField,
│                   DestinationField,AliasOptionsFields,AliasCommentsFields,AliasCreateResults,
│                   AliasAddressSection,AliasDestinationSection,AliasOptionsSection,
│                   AliasCommentsSection,CopyOverAliasDomainsDialog,CopyResults}.vue
├── alias-domains/
│   ├── index.ts  routes.ts  api.ts  list-state.ts  alias-domain-form.ts  creation-report.ts
│   ├── alias-domain-bulk.ts
│   ├── pages/{AliasDomainsPage,AliasDomainCreatePage,AliasDomainDetailPage}.vue
│   └── components/{AliasDomainCard,AliasDomainTable,AliasDomainList,AliasDomainFilters,RelayWarning,
│                   TargetDomainField,AliasDomainCreateResults,AliasDomainGeneralSection}.vue
├── resources/
│   ├── index.ts  routes.ts  api.ts  list-state.ts  address-preview.ts  booking.ts  resource-form.ts
│   ├── resource-bulk.ts
│   ├── pages/{ResourcesPage,ResourceCreatePage,ResourceDetailPage}.vue
│   └── components/{ResourceCard,ResourceTable,ResourceList,ResourceFilters,BookingRuleBadge,
│                   BookingLegend,BookingRuleField,AddressPreview,ResourceSection}.vue
├── sender-settings/
│   ├── index.ts                                      # sendAsRoute (child of UI 003's mailbox-detail)
│   ├── routes.ts  api.ts  send-as-model.ts
│   ├── pages/SendAsPage.vue
│   └── components/{AlwaysAllowedSection,ReceiveOnlySection,ExplicitPermissionsSection,
│                   PermissionCandidatePicker,AnyAddressSwitch,SenderCheckStatus,
│                   ExternalSenderAddressesSection,SendAsHints}.vue
├── mailboxes/{routes.ts,sections.ts}                # UI 003: "Send as" child route and section entry (R4)
├── domains/…                                         # UI 002: imports of the promoted components updated
└── audit-log/labels.ts                               # + 004 event and target labels and target links (R19)
src/shared/
├── validation/{entry-list.ts,utf8.ts}                # parseEntryList (R8); utf8ByteLength unless present
├── composables/{useSequentialCreate,useFormDraft}.ts # R9, R10
└── components/
    ├── {EntryListField,SearchField}.vue              # R8, R7 (SearchField unless present)
    └── {DomainPicker,DomainNameText,DkimFields,RateLimitField,CreationReport}.vue   # promoted (R2)
src/i18n/
├── problems.ts                                       # + param-discriminated and form-context keys (R17)
├── coverage.json                                     # enumeration scope manifest (UI 002 D2): + 004 values
├── messages/{en-gb,cs-cz,sk-sk}.json  legacy-map.json  legacy/*.json
scripts/i18n/{lib.mjs,import-legacy.mjs,check.mjs}    # + locales, positional placeholders; ENUM_NAMESPACES (R20)
scripts/run-lhci.mjs                                  # + /ng/aliases collection (R22)
tests/
├── unit/
│   ├── dependencies/feature-004-dependencies.spec.ts
│   ├── mocks/feature-004-handlers.spec.ts
│   ├── api/query-keys-004.spec.ts
│   ├── i18n/problems-004.spec.ts
│   ├── scripts/i18n-tools.spec.ts                    # extended
│   ├── app/navigation/visibility.spec.ts             # extended
│   ├── shared/{validation/entry-list,composables/useSequentialCreate,composables/useFormDraft,
│   │           components/EntryListField}.spec.ts
│   └── features/{aliases,alias-domains,resources,sender-settings,audit-log}/*.spec.ts
├── mocks/
│   ├── scenarios/state.ts                            # + aliases, aliasDomains, resources, senderAcl, capabilities
│   ├── scenarios/{feature-004-base,aliases-list,aliases-create,aliases-edit,alias-domains,
│   │              sender-settings,bulk-004,resources,history-004}.ts
│   ├── factories/{alias,alias-domain,resource,sender-acl}.ts
│   └── handlers/{feature-004-rules,aliases,alias-domains,resources,sender-settings}.ts
├── e2e/{aliases,alias-domains,resources,sender-settings,history}/*.spec.ts
│   └── shell/feature-004-{reflow,keyboard,permissions-matrix}.spec.ts
└── smoke/{aliases-list,aliases-create,aliases-edit,aliases-bulk,alias-domains,resources,
           sender-settings}.smoke.spec.ts
```

**Structure Decision**: Four feature areas, one per screen family and navigation entry, in the
single static frontend of UI 001. `aliases` owns what the whole API feature shares: the
capabilities read, `CapabilitiesGate` and the FR-002 permission matrix. The other areas depend on
it, never the reverse, so there is no import cycle. Generic building blocks with two or more uses go
to `src/shared/`. "Send as" is a route record exported by `sender-settings` and mounted as a child
of UI 003's mailbox detail layout. Its entry goes in UI 003's `sections.ts`, which the designated
`MailboxSectionNav` renders.

## Complexity Tracking

No constitution violation needs justification. UI 001's entries still apply: default brand colours
until API 013, and a smoke suite that does not gate merges until the API's implementation runs.
