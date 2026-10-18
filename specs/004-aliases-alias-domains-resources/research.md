# Research: Aliases, Alias Domains, Resources and Sender Permissions

**Feature**: `specs/004-aliases-alias-domains-resources` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

Every open point of the plan is settled here, in this order of precedence:

1. the constitution;
2. the pinned mailcow-rest-v2 contract;
3. `docs/conventions.md`;
4. UI 001's research (R1–R29), which this document does not repeat;
5. best practice.

Each entry has a **Decision**, its **Rationale** and the **Alternatives considered**. References such
as "001 R20" point to `specs/001-sign-in-app-shell/research.md`.

---

## 1. Contract and dependencies

### R1. Contract pin

- **Decision**:
  - **Planning baseline**: mailcow-rest-v2 commit **`32079252d55797d3da4e58ae661e9fb91c51c6f9`**
    ("Register KnownProblemType in contract components"). UI 002 and UI 003 plan against the same
    baseline (UI 002 D1, UI 003 R1).
    - It contains the complete feature 004 contract, authored in `df21611` ("Plan feature 004") and
      analysed in `18431ab`.
    - Its `api/` tree equals HEAD at planning time.
    - Bundled with `@redocly/cli@2.64.1`, it has:
      - sha256 `5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6`;
      - 376 operations, including all 23 of feature 004;
      - 86 named problem types;
      - `KnownProblemType` under `components.schemas`.
  - **Implementation prerequisites**:
    - UI 001, UI 002 and UI 003 are implemented and their gates pass.
    - mailcow-rest-v2 feature 004 is implemented: its `tasks.md` is complete and its quickstart
      Part A passes.
  - **Implementation pin**, set by T001 with `scripts/contract/bump.sh <ref>`, in this order:
    1. the mailcow-rest-v2 release tag that ships the feature 004 implementation, if one exists;
    2. otherwise the commit that merges the API 004 implementation, so that the smoke suite, which
       checks out the pinned commit (001 R25), runs an API that implements feature 004;
    3. never "the latest commit" without that check, and never a commit older than the pin UI 002
       or UI 003 left. The pin never goes backwards.
  - **Review step of the bump**: `git diff 3207925..<ref>` in mailcow-rest-v2 is read for the
    feature 004 files listed in [contracts/README.md](./contracts/README.md). Any change is a plan
    change, reviewed before Phase 3, never a silent fix (constitution I).
  - **What earlier bumps already settled**: UI 002 and UI 003 bump to pins past the baseline.
    - `knownProblemTypeValues` is generated, which closes UI 001's API gap 5.
    - `i18n:check` rule 3 is scoped to the values each feature translates, through a committed
      manifest (UI 002 D2: `src/i18n/coverage.json`; UI 003 R2 calls it `enum-scope.json`).
    - This feature appends its own values (data-model §8) and does not translate the values of
      later features.
  - Type errors in existing code after the bump are fixed in the bump task, without behaviour
    changes (constitution I: "regenerate the client, fix type errors, run all tests").
- **Rationale**: The commit SHA is the only reliable identifier, because `info.version` stays
  `0.1.0` while later features merge into the same tree (001 R6). No commit holds features 001–004
  without later ones, because the API planned its features interleaved. Pinning the implementation
  commit gives the smoke suite a server that matches the contract, as UI 002 and UI 003 decided.
- **Alternatives considered**:
  - Pinning the baseline itself: rejected. Its API repository has no feature 004 implementation, so
    the smoke suite could not run.
  - Waiting for a release tag: mailcow-rest-v2 publishes none yet. A tag replaces the SHA without
    changing this plan.

### R2. Building blocks expected from UI 001, UI 002 and UI 003

- **Decision**: UI 004 is implemented after UI 001–003 and after API 004. The names below come from
  the UI 002 and UI 003 plans (UI 002 research D2–D30, UI 003 research R2–R20), which were written
  in parallel with this one. "Reserved" means that 001 R20 fixed the location.

  | ID | Block | Location | From | What UI 004 relies on, and what T008 adds if it is missing |
  |---|---|---|---|---|
  | D1 | `useListState` (repeatable parameters, `onReset`) | `src/shared/composables/useListState.ts` | 001 | address-backed list state |
  | D2 | `useBulkSelection` | `src/shared/composables/useBulkSelection.ts` | 002 D22, reserved | `{ active, ids }`, `toggle`, `selectPage`, `clear`, `keep(ids)`, cleared through `onReset`. **Adds if missing**: a `limit` option where `selectPage` selects the first `limit` ids and reports that it capped, and `toggle` refuses beyond `limit` (FR-060). UI 003 R12 disables "Select all" instead, and UI 004's spec asks for a capped selection. |
  | D3 | `BulkActionBar.vue` | `src/shared/components/` | 002 D22 | "Select", count, actions and Cancel in a bar fixed at the bottom on phones |
  | D4 | `BulkResultSummary.vue` | `src/shared/components/` | 002 D22, reserved | rows `{ id, label, outcome, problem }`, counts announced, the `unknown` outcome. **Adds if missing**: a scoped `#item` slot for per-item extra content (the copies of R12) and a "Refresh the list" action when a row is `outdated` (FR-059). |
  | D5 | `ConfirmDialog` with `requireTyped` and content | `src/shared/components/ConfirmDialog.vue`, `useConfirm.ts` | 001 + 002, reserved | the typed count, a list of objects, focus starting on Cancel |
  | D6 | `EditableSection.vue` and `changedSince()` of `useVersionedSave` | `src/shared/components/`, `src/shared/composables/` | 002 D11, reserved | per-section editing driven by the `edit` query parameter, one section at a time, full screen below `md`; "Save again" and "Discard my changes" after a 412 |
  | D7 | `HistoryLink.vue` and the audit log target filters | `src/shared/components/`, `src/features/audit-log/list-state.ts` | 002 D26, reserved | `/audit-log?targetType=…&targetId=…` |
  | D8 | `ActiveFilterChips.vue` | `src/shared/components/` | promoted by 003 (its T011) | removable chips and "Clear all" |
  | D9 | Leave guard | `src/shared/composables/useLeaveGuard.ts` (UI 003 R4 names it `useUnsavedChangesGuard.ts`) | 002 D21 | asks through `useConfirm` before route changes and on `beforeunload` while dirty (FR-025) |
  | D10 | `NotFoundState.vue` | `src/shared/components/` | 003 R4 | the in-place "not found" state with a link back (FR-003) |
  | D11 | `DomainPicker.vue` (single or multiple) | `src/features/mailboxes/components/fields/DomainPicker.vue`, exported from `@/features/mailboxes` (UI 003 R4: "UI 004 promotes it") | 003 | **Promoted here** to `src/shared/components/DomainPicker.vue`, with props for the sources (domains, alias domains) and a `disabledReason(item)` callback for relay domains. UI 003's imports are updated. |
  | D12 | `DomainNameText.vue` | `src/features/domains/components/list/` | 002 | **Promoted here** to `src/shared/components/DomainNameText.vue`, for alias domain names and addresses: the readable text, plus the ASCII text when it differs |
  | D13 | `DkimFields.vue`, `RateLimitField.vue`, `CreationReport.vue` | `src/features/domains/components/{fields,detail}/` | 002 D16, D19 | **Promoted here** to `src/shared/components/`, prop-driven: key sizes, the default selector and the frames as props, and report lines as a prop with a per-line `#repeat` slot. The parent owns the values, so UI 004 can pre-fill the selector (R13). UI 002's imports are updated, and its tests stay green. |
  | D14 | Problem extension members | `src/api/problem.ts` | 002 D25, 003 R17 | `holder`, `count`, `limit`, `requested`, `existingKind`, `attributes`, `requiredFlags` are readable on `ApiProblem` |
  | D15 | Identity refresh on `attribute-not-permitted` and `permission-flag-required` | `src/api/query/client.ts` | 002 D11 and 003 R6 refresh in their features | **Adds if missing**: the global reaction for both types, next to UI 001's `forbidden` (FR-004) |
  | D16 | `isEntryAvailable(id)` | `src/app/navigation/visibility.ts` | 003 R19 (FR-040 links) | **Adds if missing**: `true` when the catalogue entry is `available` and accessible |
  | D17 | Domain detail route `domain-detail`, `/domains/:domain` (ASCII name) | `src/features/domains/routes.ts` | 002 D4 | links from aliases and alias domains |
  | D18 | Mailbox detail layout `mailbox-detail`, `/mailboxes/:address([^/]+@[^/]+)`, with child routes, and the designated action area `MailboxSectionNav.vue`, which renders the entries of `sections.ts` whose route exists | `src/features/mailboxes/{routes.ts,sections.ts,components/display/MailboxSectionNav.vue}` | 003 R5, R19 | "Send as" becomes a child route and a `sections.ts` entry (R4) |
  | D19 | Enumeration scope manifest and `stripMarkup` | `src/i18n/coverage.json` (`enum-scope.json` in UI 003), `scripts/i18n/` | 002 D2, D27; 003 R2 | this feature appends its values and uses `{ "from": …, "stripMarkup": true }` (R20) |
  | D20 | Mock state, handlers and factories for domains and mailboxes | `tests/mocks/handlers/{domains,mailboxes}.ts`, `tests/mocks/factories/{domain,mailbox}.ts`, `tests/mocks/scenarios/state.ts` | 002 D28, 003 R20 | the 004 rules read domains (alias limits, relay state) and mailboxes (holders, sender settings) |

  New shared blocks of this feature, each with at least two uses here (R3):
  - `SearchField.vue`, unless UI 002 or UI 003 created one;
  - `utf8ByteLength()` in `src/shared/validation/utf8.ts`, unless UI 002's footer created one;
  - `parseEntryList()`, `EntryListField.vue`, `useSequentialCreate()` and `useFormDraft()`.
- **Verification**: Phase 2 starts with `tests/unit/dependencies/feature-004-dependencies.spec.ts`,
  which imports each block and checks the behaviour above. This is the UI counterpart of the API's
  `Feature004DependenciesTest`. The task after it fills every gap:
  - a missing block is built at the location above;
  - a block kept in its first feature folder is promoted to `src/shared/`, and the first feature's
    imports are updated;
  - a block lacking a capability above is extended without changing its existing behaviour.

  If UI 002 or UI 003 changed a name or path before implementation, the references in this plan,
  research and tasks are updated instead of creating a second copy.
- **Rationale**: UI 001 reserved locations, and UI 002 and UI 003 named the rest, so that each feature
  adds rather than reinvents. A test makes the reliance explicit. Promoting at the second use follows
  constitution VIII and the pattern UI 002 D3 set ("UI 003 promotes QuotaField and TagSetInput").
- **Alternatives considered**:
  - Building 004's own copies of the DKIM, rate limit, report and domain picker components:
    rejected by VIII and the conventions.
  - Leaving UI 002's DKIM fields unchanged and adding a pre-fill mode inside them: rejected. A
    prop-driven field whose parent owns the value serves both features with less code.

### R3. Feature areas and module boundaries

- **Decision**: Four areas under `src/features/`:
  - `aliases`;
  - `alias-domains`;
  - `resources`;
  - `sender-settings`.

  The rules:
  - **`aliases` owns what the whole API feature shares**, exported from `src/features/aliases/index.ts`:
    - `useAliasesCapabilities()`;
    - `CapabilitiesGate`;
    - the permission helpers of R6.
  - `alias-domains`, `resources` and `sender-settings` import these through `@/features/aliases`.
    `aliases` imports nothing from them, so there is no cycle. Where `aliases` needs alias-domain
    data, it calls the API itself with the shared query key factory: the alias-domain source of its
    domain filter uses `keys.aliasDomains.list(…)`.
  - Cross-area links use route names (`alias-detail`, `alias-domain-detail`, `domain-detail`,
    `mailbox-detail`, `mailbox-send-as`), never imports.
  - New shared code, each with at least two uses in this feature:
    - `src/shared/validation/entry-list.ts`: alias addresses, destinations, alias domain names and
      external sender addresses;
    - `src/shared/components/EntryListField.vue`: the same four fields;
    - `src/shared/composables/useSequentialCreate.ts`: aliases and alias domains;
    - `src/shared/composables/useFormDraft.ts`: every form of this feature;
    - `src/shared/components/SearchField.vue` and `src/shared/validation/utf8.ts`, unless UI 002 or
      UI 003 already created them (R2).
  - Promoted from earlier features at their second use (R2): `DomainPicker`, `DomainNameText`,
    `DkimFields`, `RateLimitField` and `CreationReport`.
- **Rationale**:
  - One area per screen family matches UI 001's "one directory per user-facing area" and the three
    navigation entries.
  - Concentrating the API-wide pieces in the area that owns the API module (`/capabilities/aliases`)
    keeps the dependency direction obvious.
- **Alternatives considered**:
  - One area for the whole feature: rejected. Its `components/` would hold about 50 files of
    unrelated screens.
  - A fifth `aliases-common` area: rejected as needless indirection for three exports.
  - Putting the capabilities into `src/shared/`: rejected, because shared code must not be
    feature-specific.

---

## 2. Navigation, capabilities and permissions

### R4. Navigation, routes and entry points into earlier screens

- **Decision**:
  - **Catalogue**: UI 001's single row `aliases` ("Aliases, alias domains and resources", deliveredBy
    004) becomes three consecutive rows in its place. After UI 003, that is after `mailboxTemplates`
    (UI 003 data-model §5):

    | id | path | admin | domainAdmin | mailboxUser | by |
    |---|---|---|---|---|---|
    | `aliases` | `/aliases` | ✓ | ✓ | — | 004 |
    | `aliasDomains` | `/alias-domains` | ✓ | ✓ | — | 004 |
    | `resources` | `/resources` | ✓ | ✓ | — | 004 |

    - This is FR-001's "separate screens in the mail setup group". UI 001's catalogue has no group
      field, so "group" means these consecutive positions.
    - Each row keeps the classic links `/admin/mailbox` and `/domainadmin/mailbox` and starts as a
      placeholder.
    - US1, US4 and US7 each flip their row to `available` when they register its routes, so no
      entry ever leads to "not found" (SC-007, 001 data-model §2).
    - The labels reuse `mailbox.aliases`, `mailbox.domain_aliases` (cs-cz and sk-sk; English "Alias
      domains") and `mailbox.resources`. The app-layer English text of `nav.aliases` is removed.
  - **Routes** (full map in data-model §5): `aliases`, `alias-create`, `alias-detail`,
    `alias-domains`, `alias-domain-create`, `alias-domain-detail`, `resources`, `resource-create`,
    `resource-detail` and `mailbox-send-as`.
    - An alias is addressed by its numeric `id`, and a resource by its address (`@` required in the
      parameter pattern), so `/aliases/new` and `/resources/new` cannot collide.
    - Alias domains are domain names, and single-label names such as `new` are legal. Their creation
      route is therefore `/alias-domains/-/new`, following UI 002 D4's `/-/` separator: a domain label
      cannot start with `-`.
    - Every link uses the ASCII name. A typed Unicode or upper-case address is replaced by the
      canonical ASCII address once the alias domain is loaded (UI 002 D4).
    - Section editing uses the `edit=<section>` query parameter, as UI 002 D4 does (R10).
  - **"Send as"** is a child route `send-as` of UI 003's `mailbox-detail` layout
    (`/mailboxes/:address/send-as`, name `mailbox-send-as`, D18).
    - The `mailboxes` catalogue row decides access.
    - On wide screens, UI 003's section navigation stays visible next to it.
    - The route record is exported by `src/features/sender-settings/index.ts` and listed among the
      layout's children in `src/features/mailboxes/routes.ts`.
    - `sender-settings` never imports `mailboxes`, so there is no cycle.
  - **Entry point into UI 003**: `MailboxSectionNav.vue`, UI 003's designated action area for UI 004
    (UI 003 R19), renders the entries of `src/features/mailboxes/sections.ts` whose route exists.
    UI 004 adds a `sendAs` entry for `mailbox-send-as` there, with its one-line summary
    ("Who this mailbox may send as"). It is shown to administrators and domain administrators, who
    only ever reach mailboxes in their scope.
    Resources are not mailboxes in the app, so FR-048's "not for resources" holds by construction,
    and a test asserts it.
  - **Links into other features**:
    - to UI 002 domain screens, from aliases and alias domains;
    - to the rate limit screen of UI 006, from the alias domain detail;
    - to the DKIM keys screen of UI 010, from the creation report.

    Each link is rendered only when `isEntryAvailable(id)` holds (D16), otherwise the text is shown
    without a link (conventions "Where features meet"). An orphaned alias's domain is never linked.
- **Rationale**: Separate addresses make filtered views restorable and shareable (spec
  clarification). Route names decouple the areas. The catalogue keeps its single-source role.
- **Alternatives considered**:
  - One `/aliases` page with tabs: rejected by the spec's first clarification.
  - Nesting "Send as" under `/aliases`: rejected, because the object is the mailbox's sender settings
    (API path `/mailboxes/{mailbox}/sender-settings`), and the mailbox row governs access.

### R5. Capabilities

- **Decision**:
  - `useAliasesCapabilities()` (`src/features/aliases/capabilities.ts`) reads
    `getAliasesCapabilities` with the key `['capabilities', 'aliases']` and `staleTime: 300_000`.
    Server configuration rarely changes, and UI 001's global policy has no focus refetch. The cache is
    cleared with everything else on sign-out.
  - **What depends on them** (FR-071):

    | Capability | Used by |
    |---|---|
    | `groupwareEnabled` | groupware option, badge, column, filter, sort key, and the show/hide mass actions |
    | `externalDestinationsDisabled` | the advance notice in the destination field (FR-020) |
    | `bulkLimit` | selection cap and "Select all" (FR-060) |
    | `commentMaxBytes` | comment checks and counters (FR-019) |
    | `destinationsMaxLength` | joined destination length check (FR-019, input aid) |
    | `resourceDescriptionMaxLength` | description check (FR-044) |
    | `resourceBookingLimit` | booking limit range (FR-044) |
    | `rateLimitFrames` | initial rate limit frame options (FR-036) |
    | `dkimKeySizes` | DKIM key size options (FR-036) |
    | `dkimDefaults` | DKIM switch pre-fill (FR-036) |
    | `dkimDnsPublicationEnabled` | not shown. The report's `dkimDnsPublication` outcome says enough. |

  - `CapabilitiesGate.vue` wraps every form and every bulk action bar that depends on them. While
    they load, it shows a skeleton. On failure it shows the error state with a retry action instead
    of assumed values (FR-071, spec edge case).
  - **Lists and detail views never wait for the capabilities.** While they are unknown,
    groupware-dependent list elements (badge, column, filter, sort option) are not rendered, and they
    appear once known. The alias detail shows `groupwareVisible` with a "takes effect only when the
    groupware is enabled" note until the capabilities load.
  - **Page sizes** stay UI 001's 25, 50 and 100 with the default 25 (conventions "Lists"). This
    resolves FR-005 and FR-071 against the edge case "lists and detail views still work" without
    the capabilities:
    - the API fixes `limit` 25 and 1,000 API-wide (API conventions "Lists"), so
      `defaultPageSize`/`maxPageSize` cannot differ from the UI's choice in practice;
    - `capabilities.spec.ts` asserts the documented values against the contract examples, so a
      future change is caught;
    - the largest UI page size never exceeds `maxPageSize`.
- **Rationale**: Forms must not submit values the server would refuse because of a stale assumption.
  Lists stay usable when a configuration read fails, as the spec requires.
- **Alternatives considered**:
  - Blocking every screen on the capabilities: rejected by the spec's edge case.
  - Hard-coded fallbacks: rejected by FR-071 and the conventions ("never hard-codes them").

### R6. Permissions

- **Decision**:
  - `src/features/aliases/permissions.ts` holds pure functions over `Identity` (and, where FR-002
    needs it, `AliasCapabilities`). They encode FR-002's table:
    - `canViewFeature004` and `canManageAliases`;
    - `externalDestinationsRestricted(identity, caps)`: `caps.externalDestinationsDisabled`, or a
      domain administrator without `aliasExternalGoto`;
    - `canAddAliasDomain`: an administrator, or a domain administrator with `aliasDomains`;
    - `canSetInitialRateLimit`: an administrator, or a domain administrator with `ratelimit`;
    - `canGrantAnyAddress`: administrators only;
    - `canEditExternalSenderAddresses`: an administrator, or a domain administrator with
      `extendSenderAcl`;
    - `canSeeHistory`: administrators only;
    - `canSeeOrphaned`: administrators only.

    A table-driven unit test covers every row for administrators, domain administrators with each
    flag on and off, and mailbox users (SC-007).
  - Controls the caller may not use are hidden, or shown read-only with the reason. The reason
    reuses the legacy flag labels (`acl.alias_domains`, `acl.alias_external_goto`,
    `acl.extend_sender_acl`, `acl.ratelimit`) and says that an administrator grants them (FR-041,
    FR-052).
  - **Reaction to refusals** (FR-004):
    - `forbidden`: UI 001 already refreshes the identity.
    - `permission-flag-required` and `attribute-not-permitted`: they also refresh it (D15), so the
      controls update.
    - The message names the flag from `requiredFlags`, translated with the same legacy labels.
- **Rationale**: One pure module makes SC-007 testable as a table and keeps templates free of role
  logic. The API is the authority, so hiding is a convenience (constitution V).
- **Alternatives considered**:
  - Per-component checks: rejected as untestable as a matrix.
  - Reading permissions from the capabilities: they say explicitly that the flags come from `GET /me`.

---

## 3. Lists and display

### R7. Lists, search, filters, sorting and display rules

- **Decision**:
  - **List state**: each area has `list-state.ts`, a `useListState` schema that mirrors the
    contract's query names (data-model §5).
    - Arrays (`domain`, `primaryDomain`, `kind`, `destinationType`, `destination`, `targetDomain`)
      are repeatable address parameters.
    - Booleans are `true` or `false`, or absent.
    - Defaults are omitted from the address.
    - The parameter types alias the generated `operations[…]['parameters']['query']`.
  - **Search** (FR-010): `SearchField` (R2) runs on submit or after a 500 ms pause (the spec's
    "about half a second"; UI 002's domain search uses 300 ms) and announces
    "{n} results". Filters are in a collapsible panel on phones and inline above the table on wide
    screens. Active filters appear as `ActiveFilterChips` with "Clear all".
  - **Sort**: on cards, a native `<select>` with the sort key and the order. In the table, header
    buttons with `aria-sort`.
    - The alias list's "Newest first" is `sort=id&order=desc`, the default, and "Oldest first" is
      `sort=id&order=asc`. The other keys default to ascending.
    - Only the contract's keys are offered: `AliasSort`, `AliasDomainSort` and `ResourceSort`. The
      groupware key is offered only when the groupware is enabled.
  - **Domain pickers** (FR-011) use `DomainPicker` (D11, promoted here): a Reka `Combobox` without a viewport, a
    debounced server search, "load more" pages of 25, and the readable and ASCII names.

    | Picker | Sources | Rules |
    |---|---|---|
    | Alias filter "Domain" | `listDomains` and `listAliasDomains`, in two labelled groups | — |
    | Alias filter "Primary domain" | `listDomains` | — |
    | Alias domain filter "Target domain" | `listDomains` | — |
    | Resource filter and resource form "Domain" | `listDomains` | alias domains are never offered |
    | Alias domain form "Target domain" | `listDomains` | relay domains (`backupMx: true`) shown but disabled, with the reason "Relay domains cannot be targets" (FR-036, US4-AS6) |

  - **Chip labels** for picked domains use the readable name remembered from the picker. After a
    reload, a chip shows the ASCII value from the address, which is also what the server matches.
  - **Display**:
    - Addresses and domains are shown through `DomainNameText` (D12): the readable form first, and the
      ASCII form as secondary text only when it differs.
    - The local part is shown exactly as stored.
    - Destinations and external sender addresses are shown as stored (plan API gap G2).
    - Long values wrap with `break-words`, and nothing truncates without the full value being
      available (FR-066, SC-004).
  - **Alias entries** (FR-012):
    - **Badges**: catch-all; inactive; internal; hidden from the groupware (only when the groupware
      is enabled); receive-only (`senderAllowed: false`); orphaned (administrators).
    - **Destinations**: the first two and "+{n} more", or the special action as text.
    - **Domain**: the alias's domain, and for `inAliasDomain` "belongs to {primaryDomainUnicode}".
    - **Wide-screen columns** add the ID, both comments and the modification time.
  - **Empty states** (FR-008): "nothing exists yet" when the total is 0 and no search or filter is
    active. It offers the add action when permitted. Otherwise "nothing matches", which offers
    "Clear search and filters".
  - **Freshness** (FR-009): every mutation invalidates by the table in data-model §3. Each list has a
    refresh button.
- **Rationale**: Mirroring the contract's parameter names keeps the address, the request and the
  tests aligned. Server paging everywhere satisfies the "very large servers" edge case.
- **Alternatives considered**:
  - One merged domain-and-alias-domain endpoint: the contract has none, so two sources it is.
  - Client-side punycode decoding: rejected (plan API gap G2).

---

## 4. Forms

### R8. Multi-entry fields and the alias form

- **Decision**:
  - **`parseEntryList(text)`** (`src/shared/validation/entry-list.ts`):
    - splits on commas, semicolons, any whitespace and new lines;
    - trims, and drops empty entries;
    - drops entries that equal an earlier one ignoring letter case, keeping the first spelling;
    - returns `{ value, index }[]`, where `index` is the entry's position in the list sent.

    It is used for alias addresses, destinations, alias domain names and external sender addresses
    (spec edge case "Separators").
  - **`EntryListField.vue`** (`src/shared/components/`):
    - a labelled textarea with `autocapitalize="none"`, `autocorrect="off"` and `spellcheck="false"`
      (FR-065);
    - below it, the parsed entries as a text list, so the user sees what will be sent. Each entry
      can carry a marker such as "Catch-all";
    - per-entry server errors: a field error at `destinations.2` is mapped to the parsed entry with
      `index` 2, shown on it, and summarised at the top;
    - a read-only mode, used for external sender addresses without the permission.

    Single-address inputs elsewhere use `type="email"` with `inputmode="email"`. This applies where
    a field holds a single address, such as the delivers-to filter (FR-065).
  - **Alias creation form** (FR-018–FR-020): four sections, "Addresses", "Destination", "Options"
    and "Comments", on one full-screen page.
    - **Addresses**: `AddressEntriesField`, with entries of the form `@domain` marked "Catch-all"
      (US2-AS2). The help text replaces `add.alias_address_info` with a new key that takes the
      branding `productName` (FR-067).
    - **Destination**: a Reka `RadioGroup` with "Deliver to addresses", "Discard silently", "Learn
      as spam" and "Learn as ham".
      - The destination list is editable only for the first choice. For the others it is shown
        disabled, and the form keeps its text in memory, so switching back restores it (FR-018,
        US2-AS3).
      - The advance notice of FR-020 is shown when `externalDestinationsRestricted()` holds.
    - **Options**: switches with their legacy explanations. The defaults are those of the legacy form:
      active on, allowed to send on, visible in the groupware on, internal off. The groupware switch
      exists only when `groupwareEnabled` (US2-AS11).
    - **Comments**: two textareas, each with a byte counter against `commentMaxBytes` and the
      explanations of FR-018.
  - **Client checks** (FR-019), as input aids only:
    - at least one address;
    - at least one destination for "Deliver to addresses";
    - each comment within `commentMaxBytes` UTF-8 bytes;
    - the joined destinations within `destinationsMaxLength` characters.

    No address syntax is re-validated: the server decides (FR-070). On edit, a comment is checked
    only when its value changed, so a longer comment stored by another tool never blocks saving other
    fields (contract: "longer comments stored by another tool are shown as stored").
  - **Create request**:
    - `address` is the entry as typed;
    - for "Deliver to addresses", `destinations` and no `destinationType`. Otherwise only
      `destinationType`, never `destinations` (FR-018);
    - `active`, `senderAllowed` and `internal` always;
    - `groupwareVisible` only when the groupware is enabled, so stored values are never touched while
      it is disabled (edge case);
    - each comment only when non-empty.
- **Rationale**: A single parser gives every multi-entry field the same separators and duplicate rule
  as legacy. The visible parsed list makes per-entry errors and the catch-all marking possible
  without a chip editor.
- **Alternatives considered**:
  - A token or chip input: rejected. It is harder to use with pasting long lists and with screen
    readers, and legacy users paste comma-separated lists.
  - Validating address syntax in the browser: rejected by FR-070.

### R9. One request per entry: `useSequentialCreate`

- **Decision**:
  - `useSequentialCreate(entries, send, classify)` sends one request per entry, strictly one after
    another, in the order entered (FR-021, FR-037).
  - Each entry ends `created` (with the response), `refused` (with the `ApiProblem`) or
    `notProcessed`.
  - `classify(problem)` decides whether a refusal concerns only that entry or the whole form:

    | Refusal | Scope | Effect |
    |---|---|---|
    | `409 address-in-use`, `409 domain-alias-limit-reached` (aliases may be in different domains), `409 alias-domain-already-exists`, and `422` whose `errors` keys are all `address`, or all `name` for alias domains (`invalidFormat`, `notFound`, `reserved`, `conflictsWith`) | entry | record and continue |
    | `422` naming any shared field (`destinations*`, comments, `targetDomain`, `rateLimit*`, `dkim*`), `403 attribute-not-permitted`, `403 permission-flag-required`, `403 forbidden`, `503 temporary-failure`, any other or unknown problem | form | stop: show the problem at its fields or in the summary; the remaining entries become `notProcessed` |
    | network failure | form | stop: results received so far stay; the remaining entries become `notProcessed` (edge case) |

  - **After the run**:
    - With one entry that was created, the form navigates to the new object:
      - an alias opens its detail (FR-021);
      - an alias domain shows its creation report first, then a link to its detail (FR-038).
    - With several entries, the results summary lists every entry: a created entry with a link
      (and, for alias domains, its creation report collapsed); a refused one with its translated
      reason; and `notProcessed` ones.
    - Created entries are removed from the entry field, and refused and unprocessed ones stay, so
      the user can correct and submit again (FR-021, US2-AS8).
  - The submit control is disabled while the run is pending, the progress ("Creating 2 of 3") is
    announced politely, and nothing is ever retried automatically (FR-024).
- **Rationale**: One alias per request is the API's model (spec clarification). Stopping on shared
  refusals avoids sending the same doomed destinations three times. Continuing on address-level
  refusals gives legacy's convenience without legacy's silent skipping.
- **Alternatives considered**:
  - Parallel requests: rejected. They break the "order entered" requirement and race on the alias
    limit.
  - Stopping at the first refusal of any kind: rejected by US2-AS8, where two aliases are created
    around one refused address.

### R10. Editing, drafts, conflicts and vanished objects

- **Decision**:
  - **Sections** (conventions "Editing and conflicts", D6):

    | Detail screen | Editable sections | Read-only parts |
    |---|---|---|
    | Alias | Address; Destination (choice and list); Options; Comments | identifier, kind, domain, primary domain, times |
    | Alias domain | General (target and active) | name, alias count, relay warning, rate limit, times |
    | Resource | one section (description, kind, booking rule, active) | address and domain, with the note that the address does not change (FR-046), times |

    - The section IDs are `address`, `destination`, `options` and `comments` for aliases,
      `general` for alias domains and `resource` for resources.
    - Sections open through the `edit=<section>` query parameter, one at a time (D6, UI 002 D4), so
      Back closes an open section. An unknown or non-editable section is removed with
      `router.replace`.
    - A section opens full screen below `md` and in place above (FR-064).
    - The list action "Edit" opens the detail screen, as UI 003 FR-013 does (plan parity note 4).
  - **"Send as"** is the exception the spec makes: one save for the whole screen (FR-054, R15).
  - **Patch building** (`buildAliasPatch`, and its counterparts for alias domains and resources):
    - The patch holds only the members whose value differs from the version read (FR-022). Read-only
      members are never sent, and the version goes in `If-Match`.
    - Destinations are sent only when the list or the destination choice changed:
      - a special action sends `destinationType` alone;
      - addresses send `destinationType: 'addresses'` and `destinations`.

      Destinations stored by another tool are therefore never re-sent unless the user edits them
      (edge case).
    - The resource `bookingLimit` is sent only with `bookingRule: 'limited'`.
    - The groupware option is never sent while the groupware is disabled.
  - **Outdated** (412, FR-027), through D6's `changedSince()`:
    - the user's input stays;
    - the object is refetched;
    - every field whose stored value changed shows "Changed elsewhere: {new value}";
    - the section offers "Save again" (with the reloaded version tag) and "Discard my changes",
      and the announcement says so;
    - nothing is retried, and no "overwrite anyway" exists (conventions).
  - **Refused deletion as outdated**: the confirmation opens again with the reloaded object.
  - **Vanished** (404 on refresh or save, FR-028; a domain administrator who lost the domain): the
    app says "This {object} no longer exists or is no longer available to you", announces it, and
    returns to the list with the list invalidated. A 404 on the first load shows `NotFoundState`
    (D10) in place, with a link back to the list (FR-003).
  - **Orphaned alias** (US3-AS7): administrators see a warning that explains the missing domain and
    offers deletion. The Address section may still be edited, and the server's `notFound
    {resource: domain}` on `address` is shown there, saying that a change needs an address in an
    existing domain.
  - **Unsaved changes** (FR-025): every creation form, open section and the "Send as" screen uses
    the leave guard (D9) while dirty.
  - **Drafts** (spec edge case "Session expires while a form is open"): `useFormDraft(formId)`
    (`src/shared/composables/useFormDraft.ts`).
    - It keeps a form's unsaved input in a module-level `Map` keyed by the route's full path and the
      form ID. **Memory only**: it never writes to device storage.
    - It saves when the form unmounts because the session ended, and restores on mount when the same
      username is signed in again in that tab.
    - It is cleared:
      - after a successful save;
      - when the user discards;
      - on sign-out (`clearAllDrafts()` from `src/app/session/sign-out.ts`);
      - when another account signs in (`src/app/session/cross-tab.ts` and the identity mismatch
        check);
      - by a reload, which by design loses memory.
- **Rationale**: Section editing matches UI 002 and UI 003 and the conventions, and it keeps conflicts
  small. Patching only what changed is what makes the edge cases about legacy destinations and long
  comments work, and it keeps a domain administrator's patch free of attributes they may not change
  (US3-AS3).
- **Alternatives considered**:
  - One edit page per object, as legacy: rejected by the conventions.
  - Drafts in `sessionStorage`: rejected. It is not needed for the "same tab" case, and the
    constitution keeps API data out of storage.

### R11. Deletion

- **Decision**: Single deletions use `useConfirm` with an impact body. The confirm button names the
  action ("Delete alias", "Delete alias domain", "Delete resource"), and focus starts on Cancel
  (FR-029).
  - **Alias**: names the address. Mail to it is no longer accepted, and other mailboxes' permissions
    to send as it are removed. A catch-all alias adds that the explicit domain-wide permissions for
    its domain go with it (contract `deleteAlias`, API owner question 1).
  - **Alias domain**: names it. Its `aliasCount` aliases (stated with the number), their send-as
    permissions, its temporary aliases, its BCC maps and its spam allow and block lists are deleted.
    Its DKIM key is kept (US4-AS8).
  - **Resource**: names it. Its calendar, bookings and sharing settings in the groupware are deleted
    (US7-AS7).

  Every deletion sends `If-Match`:
  - on 412, the object is reloaded and the confirmation shown again (FR-027);
  - on 404, the app says the object no longer exists and returns to the list;
  - on success, it announces, returns to the list and invalidates (FR-030).

  Mass deletion is R16.
- **Rationale**: These are the contract's stated cascades. The extra catch-all sentence makes the
  legacy side effect that the API documents visible.
- **Alternatives considered**: Typed confirmation for single deletions: the spec reserves it for mass
  deletion, to keep single deletions quick on a phone.

### R12. Copy over alias domains

- **Decision**:
  - **Single** (FR-031):
    - The alias detail offers "Copy over alias domains" only for `inAliasDomain: false` and not
      orphaned, and only to users who may manage aliases.
    - A dialog explains that a copy is created in each alias domain of the alias's domain unless the
      address is in use there.
    - Confirming sends `copyAliasOverAliasDomains` with `If-Match`. A 412 reloads the alias and shows
      the explanation again.
  - **Bulk**: `applyAliasBulkAction` with `copyOverAliasDomains` shows the same explanation first.
    - Each `done` item's copies come from `meta.copies[id]`.
    - An alias in an alias domain comes back `refused` with `not-primary-domain-alias`, translated
      (edge case).
  - **Results** (`CopyResults.vue`, also used in D4's item slot): one line per alias domain.
    - `created`: the address, linked to `alias-detail` by `aliasId`.
    - `skipped`: the translated `reason` (`addressInUse`, `aliasLimitReached`,
      `destinationNotPermitted`).
    - `failed`: the translated problem.
    - An empty `copies` list says "This domain has no alias domains, so nothing was created"
      (FR-032).
- **Rationale**: This follows the contract's report shape exactly and gives the per-alias-domain
  outcome that legacy collapsed into one message.
- **Alternatives considered**: Hiding the action when the domain has no alias domains: the alias
  representation does not say, and the empty report is a clear answer.

### R13. Alias domains

- **Decision**:
  - **Creation form** (FR-036): a full-screen page with these fields.
    - **Names**: `EntryListField`.
    - **Target**: the `DomainPicker`, with relay domains disabled and their reason.
    - **Active**: on by default.
    - **DKIM key**: the shared `DkimFields` promoted from UI 002 (D13), fed with the aliases
      capabilities:
      - a "Generate a DKIM key" switch, on by default;
      - a selector pre-filled with `dkimDefaults.selector` (for example `feldhost`), editable;
      - a native `<select>` of `dkimKeySizes`, pre-selected with `dkimDefaults.keySize`.

      With the switch on, the selector is required (an input aid that keeps the switch honest), and
      the request carries `dkimSelector` and `dkimKeySize`. With the switch off, the request carries
      `dkimSelector: ""` and no key size (US4-AS10).
    - **Initial rate limit**: the shared `RateLimitField` promoted from UI 002 (D13), only when
      `canSetInitialRateLimit`:
      - a whole number of at least 1 (`inputmode="numeric"`), and a `<select>` of `rateLimitFrames`
        labelled with the legacy `ratelimit.*` keys;
      - an empty value means none, and `rateLimit` is then omitted;
      - the field is never sent by a user who may not set it (US4-AS4).
  - **Several names** run through `useSequentialCreate` (R9).
  - **Creation report** (FR-038): `src/features/alias-domains/creation-report.ts` builds the lines
    from `AliasDomainCreationReport`, and the shared `CreationReport.vue` (D13) renders them. Each
    line has a status icon and text, with the kinds of UI 002 (data-model `CreationReportLine`):
    `done`, `info` (not requested, already existed, not configured, skipped, no zone, groupware
    disabled) and `warning` (failed).

    | Step | Outcomes | Failure warning says where to repeat it |
    |---|---|---|
    | Rate limit | applied, not requested, failed | spam and rate limit settings (UI 006, linked when available) |
    | DKIM key | created, already existed (used unchanged), not requested, failed | DKIM keys (UI 010, linked when available) |
    | DKIM DNS publication | published, no zone, failed, not configured, skipped | DKIM keys (UI 010) |
    | Groupware directory | done, failed, groupware disabled | the directory is updated again with the next change; ask the server administrator if it persists |

    - A failed step is a warning ("Created, but…"), never a failure of the creation (US4-AS2).
    - The English `messages` are not shown (001 R8: English texts are for logs).
    - The report is not cached: the detail query caches the plain `AliasDomain`.
  - **List and detail** (FR-033–FR-035):
    - the relay warning reuses `mailbox.alias_domain_backupmx` as text with an icon;
    - the alias count links to `/aliases?domain=<name>`;
    - the detail shows the rate limit ("{value} msgs / {frame}" with the legacy frame labels, or
      "None") read-only, with the note that rate limits are managed with spam and rate limit
      settings. The note links to UI 006 when that screen is available.
  - **Edit** (FR-039): target (the same picker) and active. The name is read-only.
  - **No add permission** (FR-041, US4-AS3): without `aliasDomains`, the list shows no add control and
    a note that an administrator grants "Add alias domains". Activate, deactivate and delete stay
    (US6-AS7). Opening `/alias-domains/-/new` directly renders UI 001's `NoAccessState` in place,
    with the same note. This is the flag counterpart of UI 002 D4's `meta.roles` check, kept in the
    page.
  - **`503 temporary-failure`** on the list, detail, create, edit or delete: "The mail server's
    shared store is temporarily unavailable. Nothing was changed. Try again shortly." Forms keep
    their input, and lists and details show their error state with a retry action (spec edge case).
- **Rationale**: These are the contract's fields and outcomes. The switch makes "no DKIM key" an
  explicit choice (spec clarification), and gating by flag avoids requests that the API refuses.
- **Alternatives considered**:
  - Omitting `dkimSelector` when it equals the default: this is equivalent for the server. Sending
    what is shown is simpler and testable.
  - Feature-local copies of the DKIM, rate limit and report components: rejected (R2, D13).

### R14. Resources

- **Decision**:
  - **Address preview** (`address-preview.ts`, FR-045), the rule documented in
    `ResourceCreateRequest`:
    - local part = the ASCII letters and digits of the description, in their letter case, with every
      other character left out;
    - when the result is empty, or longer than 64 characters, no address can be derived;
    - the preview shows `{localPart}@{domain readable form}`, labelled "Preview", and updates as the
      user types;
    - when no address can be derived, it says so, and the form cannot be submitted.

    Examples: "Meeting Room 1" gives `MeetingRoom1@…`; "Raum Süd" gives `RaumSd@…`; "!!!" gives none.
    After saving, the detail shows the address the server returned.
  - **Booking rule** (`BookingRuleField`): a radio group with the legacy texts `mailbox.booking_null`,
    `booking_ltnull` (the default) and `booking_custom`. With the last one, a whole-number field
    appears, checked against `resourceBookingLimit.min..max` (US7-AS4).
  - **Badges**: "Always free", "Soft limit" and "Hard limit ({n})", from the `_short` legacy keys.
    `BookingLegend` explains the three rules with the long texts (FR-042, US7-AS5).
  - The description is checked against `resourceDescriptionMaxLength`.
  - The domain picker offers domains only (FR-044).
  - Kinds are translated (location, thing, group).
- **Rationale**: The preview is the one server rule the spec allows the client to reimplement,
  because the address can never change afterwards. The server's answer stays authoritative, and
  `409 address-in-use` lands on the description (US7-AS2).
- **Alternatives considered**: Reading the 64-character limit from the capabilities: they do not carry
  it, and the contract documents it in the rule's text, which is what FR-045 refers to.

### R15. "Send as"

- **Decision**:
  - **Model** (`send-as-model.ts`, pure functions over `MailboxSenderSettings`):
    - **Always allowed**: `implicitAddresses` with `source` `ownAddress` or `aliasDomainAddress`, and
      `alias` with `senderAllowed: true`. Catch-all aliases are marked, and each alias links to
      `alias-detail` by `aliasId`.
    - **Receive-only**: `alias` entries with `senderAllowed: false`.
      - Each offers "Allow sending as this alias", which adds its address to the explicit
        permissions in the working copy (US5-AS2).
      - An alias whose address is already an explicit permission says "Sending allowed by an explicit
        permission" instead of the action.
    - **Explicit permissions**: each entry is shown with its `valueUnicode` and its type label (plan
      API gap G1: "Address", "Domain", or a domain entry stated as including its alias domains where
      the type is `domain`).
      - `changeable: false` shows "Set by an administrator; you cannot change it" and no remove
        control (US5-AS4).
      - `stale: true` shows "No longer exists". Administrators can remove it (US5-AS8).
    - **Sender check status**: `senderCheckDisabled` shows "Sender check is disabled" (the stripped
      legacy `edit.sender_acl_disabled`) as text with an icon.
    - **External sender addresses**: the list as stored.
  - **Adding permissions** (FR-050): `PermissionCandidatePicker`, a Reka `Combobox` over
    `listSenderPermissionCandidates`.
    - Query: `mailbox`, a debounced `q`, and `useInfiniteQuery` pages of 25 with "load more"
      (US5-AS9).
    - The `type` filter offers "address" and "domain", plus "any address" only for administrators.
      Administrators use the separate switch for "any address" anyway, so the picker requests
      `type=address&type=domain` and never lists `*` (US5-AS5).
    - Labels follow plan API gap G1.
    - Entries added in the working copy are excluded from the shown options.
  - **"Allow sending as any address"** (`AnyAddressSwitch`, administrators only, FR-051):
    - Turning it on shows the warning that the sender check is disabled and the other explicit
      permissions are replaced.
    - While on, the explicit list is shown disabled with "Replaced by 'any address'", and the save
      sends `explicitPermissions: ['*']`.
    - Turning it off sends the list the user has.
    - Domain administrators see the status read-only (edge case). While `*` is stored, they get no
      add control, with an explanation, because the server stores `*` alone.
  - **External sender addresses** (`ExternalSenderAddressesSection`, FR-052): an `EntryListField`
    for administrators and for domain administrators with `extendSenderAcl`. Others see it read-only,
    with a note that an administrator grants "Allow to extend sender ACL by external addresses". The
    legacy hints (`edit.extended_sender_acl_info`, split into lines) and `edit.sender_acl_info`
    (FR-053) are shown as plain text.
  - **Save** (FR-054): one save bar for the screen.
    - The patch contains `explicitPermissions` only if that set changed, and
      `externalSenderAddresses` only if that list changed. Each is the whole set, with `If-Match`.
    - A domain administrator's patch includes the non-changeable entries unchanged. The contract
      allows sending them back, and keeping the set whole is simpler than relying on the server to
      re-add them.
    - Per-entry errors at `explicitPermissions.N` or `externalSenderAddresses.N` are mapped back to
      the entries by the index sent, and every entry stays as entered (US5-AS7).
    - A 412 keeps the working copy, refetches, and marks the sets that changed elsewhere (FR-027).
  - **FR-055 notice**: after a successful save, an entry the user added that is absent from
    `explicitPermissions`, while `implicitAddresses` has an `alias` with that address and
    `senderAllowed: true`, gets the message "Not needed: the mailbox already may send as this
    address through the alias" (US5-AS10).
- **Rationale**: Every section is derived from the single representation, so no extra request is
  needed. Sending whole sets matches the contract's replace semantics, and leaving unchanged sets
  out keeps a domain administrator without `extendSenderAcl` within their permissions (US5-AS6).
- **Alternatives considered**:
  - Free-text entry of explicit permissions: rejected by FR-050 ("from a searchable list").
  - Per-section saves: rejected by FR-054.

### R16. Mass actions

- **Decision**:
  - **Selection mode** on the three lists, through D2 and D3:
    - an explicit "Select" control, 44 px checkboxes on cards and table rows, "Select all" for the
      current page, and a bar that stays visible with the count and the actions;
    - leaving the mode, or any change to the page, page size, search, filters or sort, clears the
      selection with an announcement (FR-056).
  - **Bulk limit** (FR-060): `limit = capabilities.bulkLimit`.
    - "Select all" selects the first `bulkLimit` entries and says "At most {limit} objects can be
      changed at once".
    - Selecting more is refused with the same message.
    - The bar sits inside `CapabilitiesGate`.
  - **Actions** (FR-057), filtered by R6 and by `groupwareEnabled`:
    - aliases: activate, deactivate, show in groupware, hide in groupware, copy over alias domains,
      delete;
    - alias domains and resources: activate, deactivate, delete. These need no flag (US6-AS7).
  - **Confirmations** (FR-058):

    | Action | Confirmation |
    |---|---|
    | Activate, show in groupware | none |
    | Deactivate, hide in groupware | one confirmation naming the action, its effect and the count |
    | Copy over alias domains | the explanation of R12 |
    | Delete | lists every selected object by name, states the consequences of R11, and needs the typed count (D5) |

  - **Request**: the per-list `applyAliasBulkAction`, `applyAliasDomainBulkAction` or
    `applyResourceBulkAction` with `targets: [{ id, version }]`.
    - The `id` is `String(alias.id)`, the alias domain name or the resource address.
    - The `version` is the current list entry's `etag` without surrounding quotes, as
      `BulkTarget.version` requires (UI 002 D22).
    - Targets are built from the list entries at send time, so after a refresh they carry the new
      version tags.
  - **Results** (FR-059, D4):
    - the summary per outcome and one row per object, announced;
    - `retain` keeps every result that is not `done` selected. This includes `notFound` (US6-AS2),
      which the spec asks to keep, more than the conventions' minimum (failed, refused, outdated);
    - when an item is `outdated`, the summary offers "Refresh the list" (US6-AS8). The refresh
      refetches the page and keeps the selection, so a retry uses the refreshed version tags;
    - the list and the affected details are invalidated;
    - copies render their per-alias-domain outcomes in the item slot (R12);
    - `failed` items with `temporary-failure` say "try again shortly".
  - **Connection drop**: "The outcome is unknown". The list is refreshed, the selection is kept so
    the user can check it, and the request is never repeated (FR-059). This is UI 003 R12's
    behaviour. UI 002 D22 clears the selection instead, and this feature follows the mailbox
    list.
- **Rationale**: This is the conventions' bulk model plus the spec's explicit choices. The version
  per target is what makes US6-AS8 safe.
- **Alternatives considered**: Cross-page selection: rejected by the conventions and the spec.

---

## 5. Errors, cache, history and i18n

### R17. Problem and rule-code mapping

- **Decision**: UI 001's `problems.ts` gains two generic lookup steps. Each has its own unit test.
  1. **Form-context overrides**: `useProblemForm` is given a form key such as `aliases.form`. A field
     violation then looks up keys in this order, and the first key that exists wins:
     1. `<formKey>.errors.<field>.<code>.<param>.<value>`;
     2. `<formKey>.errors.<field>.<code>`;
     3. `validation.<code>.<param>.<value>`;
     4. `validation.<code>`;
     5. `validation.invalid`.

     Here `<field>` is the path without indices (`destinations.2` → `destinations`), and `<param>` is
     one of the discriminating parameters `kind`, `unit`, `field`, `format` and `resource`. Messages
     get every parameter, plus `{entry}`: the value of the entry the index points at.
  2. **Problem extension members as parameters**: `problem.<name>` messages receive the extension
     members (D14). They are formatted: numbers with `Intl.NumberFormat`, flags with the legacy
     `acl.*` labels, `holder` and `existingKind` with sub-keys (`problem.address-in-use.holder.alias`).

  The feature 004 mapping (the full table is in data-model §6):

  | Problem or code | Where it is shown | Message |
  |---|---|---|
  | `409 address-in-use` `{address, holder}` | the address entry, or the resource description | "{address} is already used by a mailbox, resource, alias or temporary alias", by holder (US2-AS4, US7-AS2) |
  | `409 domain-alias-limit-reached` `{domain, count, limit, requested}` | the address entry, the target field or the bulk item | "{domain} already has {count} of {limit} aliases" (US2-AS5, US4-AS7) |
  | `409 alias-domain-already-exists` `{name, existingKind}` | the name entry | "already exists as a domain" or "as an alias domain" (US4-AS5) |
  | `409 not-primary-domain-alias` | copy item | the legacy `warning.is_not_primary_alias` |
  | `403 attribute-not-permitted` `{attributes, requiredFlags}` | each named field or entry (`destinations.1`, `rateLimit`, `externalSenderAddresses`) | "needs the permission '{flag}', which an administrator grants" (US2-AS7) |
  | `403 permission-flag-required` `{requiredFlags}` | form summary | the same, form-level |
  | `422 notEligible {kind: externalDestination}` | destination entry | "External destinations are disabled on this server" (server setting named, US2-AS7) |
  | `422 notEligible {kind: resource / relayDomain / aliasDomain / localDomain}`, `{allowedRoles: [admin]}` | entry or field | a specific message each |
  | `422 conflictsWith {field}` | entry or field | destination equal to the alias; alias domain equal to its target; destinations with a special action; booking limit with another rule |
  | `422 reserved` | alias domain name | "the server's own host name" |
  | `422 invalidFormat {format: aliasAddress / email / domainName / dkimSelector / emailOrDomain / senderPermission / resourceDescription}` | entry or field | a specific message each, reusing the legacy `danger.*` texts where the meaning is unchanged |
  | `422 tooLong {unit: bytes}` and `{unit: characters}` | comments, destinations | "at most {max} bytes" (US2-AS9) |
  | `503 temporary-failure` | form summary, list error or bulk item | "try again shortly" (R13) |
  | `412`, `404` | — | R10 and R11 |
  | unknown `type` | form summary | UI 001's generic message with the request ID |

  `409` problems on a multi-entry creation attach to the entry being sent. On a single object they
  attach to the field the table names. Errors without a field go to the summary at the top (FR-023).
- **Rationale**: Generic, testable lookup rules satisfy SC-005 ("every error type and rule code has a
  translated message") without one-off code per form. The extension members carry exactly the
  numbers and kinds the spec wants in the messages.
- **Alternatives considered**: Hard-coding messages per call site: rejected, because it is
  unverifiable against the enumeration list.

### R18. Server-state cache

- **Decision**: New roots in `src/api/query/keys.ts`, each with a list key and a detail key:
  - `aliases`, keyed by the alias `id`;
  - `alias-domains`, by the ASCII name;
  - `resources`, by the address;
  - `sender-settings`, by the mailbox address.

  Plus `sender-permission-candidates`, keyed by `{mailbox, q, type}`, and `['capabilities',
  'aliases']`.
  - Detail queries use the list entry as `placeholderData` when it is in the cache, so the detail
    appears at once, and always fetch.
  - Mutations write the returned representation with `setQueryData` and invalidate by the table in
    data-model §3. That table includes the cross-feature effects:
    - aliases change the domains' alias usage (UI 002) and mailboxes' implicit sender addresses;
    - alias domains change aliases' primary domains and mailboxes' alias-domain addresses.
- **Rationale**: This is UI 001 R9's pattern. The cross-feature invalidations implement FR-009 for
  screens of other features that show derived numbers.
- **Alternatives considered**: Optimistic updates: rejected. Every write can be refused per entry, and
  the conventions forbid silent merges.

### R19. History and audit presentation

- **Decision**:
  - Administrators get `HistoryLink` (D7) on four screens:

    | Screen | Target type | Target ID |
    |---|---|---|
    | Alias detail | `alias` | `String(id)` |
    | Alias domain detail | `aliasDomain` | ASCII name |
    | Resource detail | `resource` | address |
    | "Send as" | `mailboxSenderSettings` | mailbox address |

    These are the values of API research R20.
  - `src/features/audit-log/labels.ts` gains:
    - labels for the ten 004 event types (`aliasCreation` … `mailboxSenderSettingsUpdate`) and the
      four target types;
    - a target link: each of the four target types links back to its object screen by route name,
      for administrators.
  - Details render through UI 001's generic definition list until plan API gap G3 is closed. The
    old and new values are visible as text, which is what US8-AS1 checks.
  - Domain administrators never see the link (FR-002, US8-AS2).
- **Rationale**: Only contract fields (event type, target type, target ID) drive the presentation.
- **Alternatives considered**: Rendering the undocumented `details` members specially: rejected by
  constitution I until the contract documents them.

### R20. Translations and the legacy import

- **Decision**:
  - **Reuse**: every key the spec's "Translation reuse" lists is mapped in
    `src/i18n/legacy-map.json`, with these exceptions and adjustments, verified against upstream
    `2026-09a`:
    - **Markup, converted to plain text**: `add.goto_spam`, `add.goto_ham`, `edit.sender_acl_info`,
      `edit.sender_acl_disabled` and `edit.extended_sender_acl_info`.
    - **Not reused**: `mailbox.alias_domain_alias_hint`. It still names the legacy "Filters" tab and
      "SOGo -> Forwarder", and its Czech text lacks the last sentence, so the meaning changes; FR-017
      gets a new key. `add.alias_address_info` names the product and is replaced by a key with
      `{productName}`. `success.resource_modified` says "mailbox" and is replaced.
    - **Restricted to cs-cz and sk-sk**: `mailbox.domain_aliases` and `mailbox.add_domain_alias`. The
      en-gb app layer supplies "Alias domains" and "Add alias domain".
    - **Missing upstream**, supplied by that locale's app layer (001 R15):
      - in sk-sk: `add.internal`, `edit.internal_info`, `edit.sender_allowed` and
        `edit.sender_allowed_info`;
      - in cs-cz and sk-sk: `acl.alias_external_goto` and `danger.external_goto_denied`.
    - **Already mapped**: keys that UI 002 or UI 003 already mapped to an app key are reused through
      that app key, for example `ratelimit.*`, `acl.ratelimit`, `admin.dkim_*`, `mailbox.activate`
      and `mailbox.deactivate`. No second app key is added for the same legacy key and meaning.
  - **Import mechanism**: UI 002 D27's object form `{ "from": "<legacy key>", "stripMarkup": true }`
    converts the five markup texts. Tags are removed, `<br>` becomes a space, the basic entities are
    decoded, whitespace is collapsed, and no `<` or `>` may remain. UI 004 adds two options to the
    same object form, test first, unless UI 002 or UI 003 already did:
    1. `"locales": ["cs-cz", "sk-sk"]` limits the entry to those locales. For the other locales, the
       app layer must supply the key, and the check enforces that.
    2. **Positional placeholders**: `%s` and `%d`, in order, become `{0}`, `{1}` and so on. For example
       `success.alias_added` becomes "Alias address {0} ({1}) has been added".

    The converted texts are rendered as plain text, never as HTML (constitution V).
  - **Enumeration scope** (D19): this feature appends to the scope manifest:
    - the ten 004 audit event types and the four target types;
    - the rule codes its forms show;
    - the problem types of contracts README.

    The closed enumerations it renders are added to `ENUM_NAMESPACES` (`enums.<name>.<value>`) and
    stay fully required: `AliasKind`, `AliasDestinationType`, `ResourceKind`,
    `ResourceBookingRule`, `MailboxSenderPermission.type`, `MailboxImplicitSenderAddress.source`,
    `AliasCopyOutcome.outcome`, `AliasCopyOutcome.reason` and the four `AliasDomainCreationReport`
    steps. The full lists are in data-model §8.
  - **New keys**, per area: `aliases.*`, `aliasDomains.*`, `resources.*`, `senderSettings.*`,
    `bulk.*` (if UI 002's shared bulk strings lack an action), plus the problem and validation
    sub-keys of R17, and the audit labels of R19. All three locales are complete (`i18n:check`).
  - **The product name** in the address help comes from the branding configuration (FR-067).
  - **"SOGo"** stays in the reused groupware texts (spec assumption).
- **Rationale**: The constitution wants legacy translations to carry over where the meaning is
  unchanged. Converting presentational markup keeps the meaning, and refusing links and scripts keeps
  the import safe. The two-layer model already handles per-locale gaps.
- **Alternatives considered**:
  - Rendering legacy HTML through `SanitizedHtml`: rejected. That path is for operator content, and
    FR-067 asks for plain text.
  - Retyping the affected texts as new keys: rejected, because it loses the reviewed cs-cz and
    sk-sk translations.
  - Translating every enumeration value of the pin: rejected by UI 002 D2 and UI 003 R2. Unknown
    values show a translated generic label.

---

## 6. Testing and performance

### R21. Mock, end-to-end, unit and smoke tests

- **Decision**:
  - **Scenario state** (`tests/mocks/scenarios/state.ts`) gains:
    - `aliases`, `aliasDomains`, `resources` and `senderAcl`;
    - `temporaryAliasAddresses`, for the `temporaryAlias` holder;
    - `capabilities004`: `groupwareEnabled`, `externalDestinationsDisabled`, `bulkLimit`,
      `dkimDefaults` and `dkimDnsPublicationEnabled`;
    - `aliasDomainCreationOutcomes`, to inject report outcomes;
    - `sharedStoreDown`, to inject `503`s.

    Domains and mailboxes are D20's existing state, so scope, alias limits, relay state and holders
    are consistent across features.
  - **Rules** (`tests/mocks/handlers/feature-004-rules.ts`) implement the contract's documented
    behaviour on that state:
    - normalisation: trim, a lower-case ASCII domain part, the local part's letter case kept;
    - holders across mailboxes, resources, aliases and temporary aliases, plus addresses that reach a
      mailbox through an alias domain;
    - the classification of external destinations;
    - the alias limit;
    - domain-administrator scope, including alias domains of their domains, and `404` outside it;
    - `orphaned`, `inAliasDomain` and `primaryDomain`;
    - ETags over the stored fields of API data-model "Version tags", with `If-Match` and `412`;
    - the per-target bulk outcomes and `meta.copies`;
    - implicit sender addresses, `changeable` and `stale`, and candidate filtering;
    - resource address derivation;
    - validation codes and parameters as in API data-model.

    The handlers (`tests/mocks/handlers/{aliases,alias-domains,resources,sender-settings}.ts`) are
    built in Phase 2 with their own unit test, so that every story's end-to-end tests run on a
    complete mock.
  - **Scenarios**: one module per story area, registered in `tests/mocks/scenarios/index.ts` (001
    T025). Runtime changes (an object changed or deleted elsewhere, flags changed, the session
    expired) go through `PATCH /__mock/scenarios/:id`.
  - **What the mock cannot produce** (001 R22): values outside closed enumerations. An unknown problem
    `type` is still a string, so end-to-end tests do cover the generic message, on a documented
    status such as `409`.
  - **End-to-end**: one directory per area, plus `tests/e2e/history/`.
    - Test titles carry the spec IDs (`US2-AS8 …`, `FR-060 …`, `Edge: …`).
    - Every screen and state calls `expectAccessible`.
    - Request assertions use `mockApi.requests()`, for example the order of creations, the patch
      members, `If-Match` and bulk targets.
    - Network failures use Playwright `route.abort()` on the n-th matching request.
  - **Smoke** (against the API dev stack): each spec discovers a domain in the signed-in account's
    scope through the UI and creates its own objects with unique names, then deletes them. It
    covers:
    - alias create, edit, bulk deactivate and delete;
    - alias domain create (DKIM off) and delete;
    - resource create and delete;
    - granting and revoking an explicit sender permission on a seeded mailbox.

    The admin runs every case, and `reseller` runs the list and scope cases.
  - **Parity coverage** (SC-008): parity rows reference FR IDs, and end-to-end titles carry FR IDs. A
    polish task checks that every Matched or Improved row has at least one test.
- **Rationale**: A complete mock in Phase 2 keeps the stories independent and avoids serialising edits
  to shared handler files. Building on D20's state avoids two divergent mailbox models.
- **Alternatives considered**: Per-story handler growth as in UI 001: workable, but five stories
  would edit the same four handler files.

### R22. Performance

- **Decision**:
  - Every page component is a lazy route chunk, ten in all.
  - Shared components load with the routes that use them. Nothing new enters the entry chunk except
    three catalogue rows and their labels.
  - `scripts/run-lhci.mjs` gains a third collection: `/ng/aliases` with
    `MOCK_DEFAULT_SCENARIO=aliases-60`, as an active administrator. The same assertions apply:
    performance and accessibility of at least 0.9, and the script size budget.
  - SC-009 (2 s first page on a mid-range phone over 4G) and SC-010 (100-alias results in 15 s) are
    measured manually in quickstart Part B, with the throttling profile.
- **Rationale**: Constitution VII. The alias list is the heaviest new screen and the one SC-009
  names.
- **Alternatives considered**: A Lighthouse run per new route: rejected as slow, with no extra
  signal beyond the list.
