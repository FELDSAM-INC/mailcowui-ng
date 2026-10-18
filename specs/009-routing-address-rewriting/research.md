# Research: Routing and Address Rewriting

**Feature**: `specs/009-routing-address-rewriting` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

UI 001's research (R1–R29) decides the stack, structure, contract pinning, mock API, testing,
i18n, sessions and shared primitives. This document does not repeat those decisions. It settles
what is specific to this feature, in this order of precedence: the constitution, then the pinned
mailcow-rest-v2 contract, then `docs/conventions.md`, then UI 001's decisions, then best practice.
Each entry has a **Decision**, its **Rationale** and the **Alternatives considered**.

The contract facts below were read from the bundle of mailcow-rest-v2 commit
`32079252d55797d3da4e58ae661e9fb91c51c6f9` (the planning baseline, see R1), and the generated
names were checked by running UI 001's generator (`openapi-typescript` 7.13.0 with the R7 flags)
on that bundle.

---

## 1. Dependencies and structure

### R1. Contract pin and prerequisites from earlier UI features

- **Decision**:
  - **Pin**: UI 009 bumps `contract/VERSION.json` with `scripts/contract/bump.sh` to the
    mailcow-rest-v2 commit that the API 009 implementation was released against, or its release
    tag. The planning baseline is commit **`32079252d55797d3da4e58ae661e9fb91c51c6f9`**
    (2026-10-18, "Register KnownProblemType in contract components"). Its bundle has sha256
    `5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6` and 376 operations, among
    them all 46 operations of API 009. API 009's own modules last changed in `dd505ae`; the later
    commits only append values to shared enumerations and register `KnownProblemType`.
  - Pins are **monotonic**. UI 002–008 bump the pin before UI 009 starts. If the current pin is
    already at or after a commit whose 46 routing operations are byte-identical to the baseline's,
    UI 009 keeps it. It never moves the pin backwards and never pins "the latest commit" blindly
    (UI 001 R6).
  - **Prerequisites** from earlier UI features, all implemented before UI 009. The table names
    them as those features' plans do (UI 001 R20 reserved the first four; UI 002 to UI 006 added
    the rest). UI 009 uses them and does not rebuild them:

    | Building block | Location | Planned by | Used here for |
    |---|---|---|---|
    | `useBulkSelection`, `BulkActionBar.vue`, `BulkResultSummary.vue` | `src/shared/composables/`, `src/shared/components/` | UI 001 R20, UI 002 D22 | every list's selection mode, action bar and per-item results (R5) |
    | `ConfirmDialog` with `requireTyped` and rich content | `src/shared/components/ConfirmDialog.vue` | UI 001 R20, UI 002 D20 | typed bulk deletion, deletion impact (R5, R8) |
    | `useVersionedSave` with `changedSince`, `EditableSection.vue` | `src/shared/composables/`, `src/shared/components/` | UI 001 R20, UI 002 D11 | outdated saves with changed values marked (R6), the domain's Relayhost section (R9) |
    | `HistoryLink.vue`, audit list state with `targetType` and `targetId` | `src/shared/components/`, `src/features/audit-log/list-state.ts` | UI 001 R20, UI 002 D26 | History (R18) |
    | `useLeaveGuard` | `src/shared/composables/useLeaveGuard.ts` | UI 002 D21 | unsaved changes in forms and sections (R6, R9) |
    | `ActiveFilterChips.vue` | `src/shared/components/` | UI 003 R4 (promoted from the audit log) | active list filters (R4) |
    | `NotFoundState` (or `NotFoundPage` with `backTo`) | `src/shared/components/` or `src/app/states/` | UI 002 data-model §5, UI 003 | "no longer exists" with the way back (R6) |
    | Role-restricted routes inside a catalogue entry (`route.meta.roles`) | `src/app/navigation/visibility.ts`, `src/app/layouts/ShellLayout.vue` | UI 002 D4 | administrator-only routing screens (R2) |
    | Domain page `domain-detail` (`/domains/:domain`), its section list with `edit=<section>`, key `['domains','detail',name]` | `src/features/domains/pages/DomainDetailPage.vue` | UI 002 D4, D11, data-model §9 | the domain's Relayhost section, "after Groupware", replacing the read-only relayhost row of "Delivery" (R9) |
    | Mailbox layout `mailbox-detail` (`/mailboxes/:address`) with one child route per section, the section catalogue, `MailboxSectionNav.vue` and `ManagedSettingsGroup.vue`, key `['mailboxes','detail',address]` | `src/features/mailboxes/{routes.ts,sections.ts,pages/MailboxDetailPage.vue,components/display/}` | UI 003 R19, data-model §8 | the mailbox's Relayhost section as a child route (R9) |
    | `PasswordInput.vue` (show/hide toggle) and `CopyButton.vue` | `src/shared/components/password/`, `src/shared/components/` | UI 005 R7 | relay passwords (R7), the transcript copy action (R13) |
    | `AclReadOnlyNote.vue` ("Prohibited by ACL" with the permission's label) | `src/shared/components/` (promoted by UI 006) | UI 003, UI 006 | read-only BCC maps and Relayhost sections (R9, R14) |
    | Flag labels `permissionFlags.<flag>` | `src/i18n/messages/*.json` | UI 005, UI 007 | permission messages (R19) |
    | Translation coverage registry and `ENUM_NAMESPACES` | `src/i18n/coverage.json` (UI 002 D2, the canonical name in `docs/conventions.md`), `scripts/i18n/lib.mjs` | UI 002, UI 003 R2 | translation completeness (R21) |
    | Legacy map object entries `{ "from", "stripMarkup" }` | `src/i18n/legacy-map.json`, `scripts/i18n/import-legacy.mjs` | UI 002 D27 | the base of the rich hints (R20) |

    The first setup task verifies each item against the implemented code and records the actual
    names in the plan. Any item that is missing is built at its planned location with the behaviour
    its plan fixes, tests first, before the foundational phase.
- **Rationale**: The constitution makes a contract bump a deliberate change. The commit is the
  identifier, because `info.version` stays `0.1.0` (UI 001 R6). The earlier plans fix the names,
  but some still differ between plans (for example the coverage manifest's file name), so the
  first task checks the implemented code instead of assuming, without letting UI 009 duplicate a
  shared building block.
- **Alternatives considered**: Pinning API 009's own contract commit `dd505ae`: rejected, because
  it lacks the shared enumeration values and the `KnownProblemType` registration that later
  commits added, and it may precede pins that UI 002–008 already made. Rebuilding bulk selection,
  typed confirmation and History inside the routing feature: rejected by constitution VIII.

### R2. Feature module, routes and access

- **Decision**:
  - **One feature directory**, `src/features/routing/`, for the six screens, the connection test and
    the Relayhost sections. Shared pieces of the feature (capabilities, credential fields, bulk
    wiring, list scaffolding, problem mapping) live in it once. Other features reach it only
    through `src/features/routing/index.ts` (UI 001 R3). Inside it, `api/`, `list-states/`,
    `logic/`, `composables/`, `components/<area>/` and `pages/<area>/` group the code by screen. The
    full tree is in [plan.md](./plan.md#source-code-repository-root).
  - **Routes**, under the catalogue path `/routing` (route map in
    [data-model.md](./data-model.md#5-route-map)): an index page, then per screen a list, a create
    page and an entry page, plus the relayhost usage view and one connection test page per
    relayhost and transport. Every route carries `meta.navEntry: 'routing'`. All routes except the
    index and the BCC map routes also carry `meta.roles: ['admin']`. A domain administrator who
    opens an administrator-only address gets UI 001's `NoAccessState` in place, and no request is
    sent (UI 001 R19).
  - **Catalogue change**: the `routing` entry of `src/app/navigation/catalogue.ts` becomes
    `access: { admin: true, domainAdmin: true, mailboxUser: false }` and `status: 'available'`.
    UI 001's catalogue row gated domain administrators by the `bccMaps` flag. UI 009's spec (FR-002,
    clarification 1) shows every domain administrator the BCC maps of their domains, read-only
    without the flag, which the API permits (API FR-005: listing needs no flag) and legacy does.
    The table test of `visibility.spec.ts` is updated in the same task.
  - **Index page**: `/routing` lists the screens the user may open, in the order of FR-001. With a
    single screen, as for every domain administrator, it replaces the route with that screen.
  - **Section navigation**: below `md` a disclosure control names the current screen and opens the
    list of screens; from `md` up, a wrapping row of links with `aria-current="page"`. It never
    scrolls horizontally (constitution II).
- **Rationale**: One catalogue entry and one section root fit one directory. Six directories would
  have to share capabilities, credential fields and the connection test through each other's
  `index.ts`, with more boundaries than benefit.
- **Alternatives considered**: Six feature directories: rejected, see above. A horizontal tab strip:
  rejected, because six labels overflow 360 px. Redirecting `/routing` to the first screen for
  administrators: rejected, because the index explains the six screens on a phone better than a
  jump into the first list.

### R3. Routing capabilities instead of hard-coded limits

- **Decision**: `GET /capabilities/routing` (`getRoutingCapabilities`) is read once per visit of the
  section (query `['routing-capabilities']`, `staleTime` 5 minutes) and gives:
  - `bulkLimit`: the selection limit (R5);
  - `pageSize.maximum`: page size options above it are not offered (the conventions' 25, 50 and 100
    stay the options);
  - `bccMaps.localDestinationMaxLength` and `bccDestinationMaxLength`: the BCC form limits, for
    both roles;
  - for administrators, `administration`:
    - `connectionTest.defaultSender` and `defaultRecipient`: the test form's placeholders (R11);
    - `stepTimeoutSeconds` and `totalTimeoutSeconds`: the test's progress text and watchdog (R11);
    - `maxLengths`: the form limits of hosts, next hops, usernames, passwords, transport
      destinations, recipient map destinations and TLS policy fields;
    - `tlsPolicies`: the policy choice (R15);
    - `forwardingHostDnsLookupLimit`: named in the forwarding host hint.

  Two limits are not in the capabilities read: the forwarding host `host` (255) and the test
  `sender` and `recipient` (255). For these, `src/shared/validation/limits.ts` gains constants
  that its unit test compares with the `maxLength` of `contract/openapi.json`, as UI 001 data-model
  §6 does. This is recorded as a minor API gap in the plan.

  When the capabilities read fails, forms and selection show UI 001's error state with a retry;
  lists still load and work without selection.
- **Rationale**: `docs/conventions.md` ("Where features meet"): limits come from each feature's
  capabilities read, and the UI never hard-codes them. API 009 FR-093 provides exactly these
  values, including the default test addresses that the UI spec listed as an API gap.
- **Alternatives considered**: The limits module for everything: rejected by the conventions,
  because the server's configured values (for example the test addresses) can differ from the
  contract's examples. Fetching the capabilities per form: rejected by constitution VII.

---

## 2. Lists, bulk actions and editing

### R4. Responsive lists

- **Decision**:
  - **`EntryList.vue`** (`components/common/`) renders one list from a column definition: cards
    below `md` (768 px), each card a definition list with every field (FR-005), and from `md` up a
    table on `src/shared/ui/table` with sortable headers (`aria-sort`). Each screen supplies its
    columns in a `*-columns.ts` file: label key, value renderer, the slot for status texts, and the
    entry's actions. Selection checkboxes appear only in selection mode (R5).
  - **`ListToolbar.vue`**: the search field (debounced 300 ms, `router.replace`), one "Filters and
    sorting" control that opens a Reka `Collapsible` panel below `md` (FR-007) and shows the filters
    inline from `md` up, the active filters as UI 003's removable `ActiveFilterChips` with "Clear
    all", the refresh action (FR-009), and the add action for permitted users. Selection mode
    starts from UI 002's `BulkActionBar` ("Select"), shown only to permitted users. Native
    `<select>` elements and checkbox groups are used, as UI 001 R18 requires.
  - **List state**: one `useListState` schema per list in `list-states/` (UI 001 R20), with the
    parameters of [data-model.md](./data-model.md#address-parameters-of-the-lists). Defaults are
    omitted from the address; changing a filter, the sort or the size resets the page and the
    selection.
  - **States**: UI 001's `ListState` gives loading, error with retry, "no entries yet" (purpose and
    add action) and "no entries match" (clear search and filters), as FR-006 distinguishes them.
  - **Announcements**: after a search or filter change, the polite live region announces "N
    entries" (FR-069), formatted with the locale.
  - **Status texts**: active state, password status, MX-based, shared next hop, BCC type, orphaned
    domain, domain-wide maps and the spam filter are words, optionally with an icon, never colour
    alone (FR-070).
  - **Entry actions**: an "Edit" link plus an actions menu (Reka `DropdownMenu`, labelled "Actions
    for {entry}") with test, activate or deactivate, History and delete, each at least 44 × 44 px
    (FR-010).
- **Rationale**: Six lists with the same mechanics justify one generic renderer inside the feature.
  Cards that show every field replace legacy's row collapse (parity row "Table row expand").
- **Alternatives considered**: One card and one table component per screen, as UI 001's API keys
  do: rejected as twelve near-identical components. Promoting `EntryList` to `src/shared/`: deferred
  until a second feature uses it (constitution VIII).

### R5. Selection and bulk actions

- **Decision**:
  - **Selection mode** is explicit (conventions). It uses UI 002's `useBulkSelection` and
    `BulkActionBar` (the count and the actions in a bar fixed at the bottom on phones), so it covers
    the current page only and clears when the page, search, filters, sort or size change.
  - **Limit** (conventions "Shared building blocks"): `useBulkSelection` receives
    `capabilities.bulkLimit` from the routing capabilities read. Once the limit is reached, further
    selection is disabled with a message that states the limit ("{limit} is the limit of one
    action", FR-016); "Select all on this page" selects up to the limit and says so. The selection
    never exceeds the page either, so with the page sizes 25, 50 and 100 and the default limit of
    100 the message appears only if the server's limit is smaller than the page size.
  - **Actions per list**, from the generated enumeration arrays: relayhosts, transports, recipient
    maps and TLS policy maps `activate`, `deactivate`, `delete`; BCC maps also `switchToSender` and
    `switchToRecipient`; forwarding hosts `enableSpamFilter`, `disableSpamFilter`, `delete`.
  - **Targets** carry each entry's version as listed: `{ id, version }`, where `version` is the
    entry's `etag` without its surrounding quotes, as `BulkTarget.version` requires (the same rule
    as UI 002 D22). Forwarding host targets use the stored address as `id`, unencoded
    (`ForwardingHostBulkActionRequest`).
  - **Confirmation** (conventions "Confirmations"): a bulk deletion names the number and lists the
    entries, states the consequences (for relayhosts, the summed usage counts of the selected
    entries and that their assignments will be cleared), and needs the number typed
    (`requireTyped`). Deactivation, single or bulk, needs one explicit confirmation. Activating a
    transport whose destination is `*` needs one explicit confirmation too, because it reroutes all
    outbound mail (spec FR-039 hint). The safe choice is the default.
  - **Results**: UI 002's `BulkResultSummary` lists one row per entry, named by the entry's main
    value from the page data, with `done`, `notFound`, `refused`, `outdated` or `failed`, and a
    translated reason from the item's `problem` (R19). Refused, outdated and failed entries stay
    selected for a retry, and outdated entries are retried with the reloaded version only after the
    list refreshes. The summary is announced (FR-016).
  - A request refused as a whole (`403 forbidden` or `permission-flag-required`) shows one message
    naming the permission. A dropped connection shows "outcome unknown" and is never retried
    automatically (conventions).
- **Rationale**: `docs/conventions.md` and API FR-091 define per-item version tags and the
  `outdated` outcome. The UI spec's "bulk actions carry no versions" is aligned with them, as a
  recorded consistency change in the spec.
- **Alternatives considered**: Bulk actions without versions: rejected by the conventions. Splitting
  selections above the limit into several requests: rejected by the spec (Assumptions).

### R6. Entry forms, changed fields and outdated saves

- **Decision**:
  - Add and edit forms are their own pages at every width (FR-011): one column, a visible label
    per field, the legacy hints next to their fields, and a sticky action bar at the bottom of the
    viewport, so that Save is reachable without scrolling up.
  - **`useEntryForm`** (`composables/`) holds the entry as read, the form values, and the dirty
    state, on UI 001's `useProblemForm` and UI 002's `useVersionedSave` and `useLeaveGuard`. The save
    is passed in as a function: for the relayhost and transport forms it is the direct client call
    of R7, so that no password enters a mutation cache. A save sends only the changed members (conventions), computed by `logic/changed-fields.ts`
    after trimming, with `If-Match` set to the `etag` that was read. Creation sends every filled
    member. Merge-patch bodies use `application/merge-patch+json`, which the generated client
    types require.
  - **Outdated (`412`)**: `useVersionedSave` with UI 002's `changedSince` keeps the input,
    refetches the entry, marks each field whose stored value changed since it was read with its new
    value, and offers "Save again" (the fields that differ from the reloaded entry, with its
    version tag) and "Discard my changes" (UI 002 D11). There is no automatic merge and no
    "overwrite anyway" (conventions). A refused deletion is confirmed again with the reloaded entry.
  - **Refused saves** keep every value except passwords (R7), show field errors at their fields,
    list them in UI 001's `ErrorSummary` and move focus to it (FR-013).
  - **Not found** (`404`) on load or save shows "This entry no longer exists" with a link to the
    list (spec edge case), through UI 002's and UI 003's not-found state with its back link.
  - **After a successful save**, the app returns to the list with the address it came from, scrolls
    the saved entry into view, briefly marks it, and announces the success (FR-011). The
    forwarding host form is the exception (R17).
  - **Unsaved changes**: UI 002's `useLeaveGuard` asks for confirmation on route changes and on
    `beforeunload` while the form is dirty (FR-012). It is disarmed after a successful save, so the
    app's own navigation back to the list is not interrupted.
- **Rationale**: These are the conventions' editing rules with UI 001's and UI 002's primitives.
  Routing entries are small, so each entry page is one section with one save.
- **Alternatives considered**: Dialogs for add and edit: rejected by constitution II and FR-011.
  Sending the whole representation back: possible, because the API accepts read-only members with
  their current values, but rejected by the conventions ("a save sends only the changed fields").

### R7. Write-only credentials

- **Decision**:
  - **`CredentialFields.vue`** (`components/common/`, used by the relayhost and transport forms)
    holds the username field, the password field and the stored-password state.
    - In an edit form the password field starts empty. A status line says "Password stored" or "No
      password" (FR-026).
    - "Remove password" is a button shown when a password is stored. It sets a pending state shown
      as "The password will be removed when you save", with "Undo". It disables the password field
      while pending.
    - Clearing the username while a password is stored shows "Saving will also remove the stored
      password" (FR-027).
    - Typing a password while the username is empty is not blocked. The API's `required` violation
      on `username` with `params.because: password` is shown at the username field as "A username
      is needed for a password" (spec edge case).
  - **Patch rules** (`logic/credentials.ts`, from the contract's `RelayhostPatch` and
    `TransportPatch`):

    | User action | Members sent |
    |---|---|
    | password field left empty, no removal | no `password` (kept) |
    | password typed | `password: <typed>` |
    | "Remove password" pending | `password: ""` |
    | username changed | `username: <trimmed>` |
    | username cleared, no password typed | `username: ""` (the API also removes the password) |

    Creation sends `username` and `password` only when filled.
  - **Masking and autofill** (FR-028): the password field is UI 005's
    `src/shared/components/password/PasswordInput.vue` (show/hide toggle with `aria-pressed`, paste
    allowed, `autocapitalize="none"`, `autocorrect="off"`, `spellcheck="false"`), with
    `autocomplete="new-password"` and the attributes `data-1p-ignore`, `data-lpignore="true"` and
    `data-bwignore`, so that common password managers do not offer the user's own sign-in. If the
    component does not accept these attributes, they are passed through with `inheritAttrs`, not by
    copying it. UI 003's and UI 007's `PasswordField` is not used: its generator and policy
    checklist serve mailcow account passwords, while a relay password comes from the relay
    provider and has no mailcow policy. The username has `autocomplete="off"` and a name that is not
    `username` (`relay-username`), because browsers fill fields named `username` next to a password
    field.
  - **Lifetime**: the typed password lives only in the form's local state. It is cleared after a
    successful save, after a refused save and when the page unmounts. It is never in a TanStack
    Query cache, the address, history state or storage (FR-075, constitution V), and no draft of
    these forms is kept.
  - **No mutation cache for password writes** (conventions "Secrets in requests or responses"):
    TanStack's mutation cache keeps a mutation's variables until its `gcTime` ends, so
    `createRelayhost`, `updateRelayhost`, `createTransport` and `updateTransport`, whose bodies can
    carry a password, are **not** `useMutation` calls. `routing/api/relayhosts.ts` and
    `routing/api/transports.ts` export plain async functions that call the generated client
    directly. The caller writes the response (which never carries a password, because the contract
    marks it `writeOnly`) into the query cache with `setQueryData` and runs the invalidations of
    data-model §3 itself, and passes a problem to the same session reaction of `src/app/session/`
    that UI 001's cache `onError` hooks delegate to (UI 001 R8), so that `401` and `403` behave as
    for any other request. Writes without a password field (activation from a list, deletions, bulk
    actions, every other collection) stay ordinary mutations.
- **Rationale**: This is the conventions' "stored secrets are write-only" rule and API FR-012 to
  FR-014, with the spec's keep, replace and remove made explicit.
- **Alternatives considered**: A placeholder of dots for a stored password: rejected, because it
  suggests a value the field does not hold and invites accidental replacement. Blocking a password
  without a username in the client: rejected, because the spec asks for the API's refusal at the
  username field.

### R8. Relayhost deletion impact

- **Decision**: The single deletion dialog opens with the relayhost's `usage` counts from the list
  or detail representation and fetches `GET /relayhosts/{id}/usage` twice with `limit=10`
  (`kind=domain` and `kind=mailbox`). It names up to ten domains and ten mailboxes, links "Show all"
  to the usage view, and states that their assignments will be cleared to "None / inherit" (FR-018).
  It sends `If-Match` with the relayhost's `etag`. Until the usage arrives the dialog shows the
  counts and a loading line; a failed usage read still allows the deletion with the counts and a
  "could not load the names" note. A bulk deletion shows the summed counts of the selected
  relayhosts (R5).
- **Rationale**: The conventions use "the API's delete preview where one exists"; the usage list is
  that preview.
- **Alternatives considered**: Loading the full usage list: rejected, because a relayhost can serve
  thousands of mailboxes.

---

## 3. Relayhost sections and transports

### R9. Relayhost sections on the domain and mailbox screens

- **Decision**:
  - **Integration** through the designated action areas of the earlier screens (conventions "Where
    features meet"). `src/features/routing/index.ts` exports both entry points; `routing` never
    imports `domains` or `mailboxes`, so there is no import cycle.
    - **Domain**: UI 002's domain page lists its sections and opens one with `edit=<section>` (UI 002
      D4, D11); its data-model §9 reserves the place "after Groupware" for the relayhost. UI 009
      adds the section ID `relayhost` to the page's list and mounts `DomainRelayhostSection`
      there through `defineAsyncComponent`, so that the page's chunk does not grow. The section
      uses UI 002's `EditableSection` (a read-only view, an Edit button for permitted users, the form
      full-screen with a sticky Save and Cancel below `md`, in place from `md` up, one section open at
      a time). The read-only relayhost row of the "Delivery" section is removed, as UI 002 planned,
      and the section's summary links to it.
    - **Mailbox**: UI 003's mailbox page is a layout with one child route per section (UI 003 R19,
      data-model §8). `src/features/routing/index.ts` exports the child route record
      `mailboxRelayhostRoute` (`path: 'relayhost'`, `name: 'mailbox-relayhost'`, lazy component
      `MailboxRelayhostSection`), which is listed among the layout's children in
      `src/features/mailboxes/routes.ts`, the same way UI 004 adds "Send as". UI 009 adds a
      `relayhost` entry to `src/features/mailboxes/sections.ts` (label `edit.relayhost`, summary:
      the effective relayhost or "Direct delivery"), which `MailboxSectionNav.vue` renders, and
      fills the `to` of the relayhost entry of `ManagedSettingsGroup.vue` (UI 003 FR-040). Like UI
      003's other sections, it opens as its own page on phones, with a back link to the overview, and
      next to the section navigation from `lg` up. It has its own Save.
    - Both are shown to administrators and domain administrators, never to mailbox users, who do not
      reach these pages.
  - **Permission** (FR-029, FR-030): editable for administrators, and for domain administrators
    with `permissions.domainRelayhost` (domain section) or `permissions.mailboxRelayhost` (mailbox
    section), read from `GET /me`. Otherwise the section is read-only with UI 003's
    `AclReadOnlyNote` naming the permission (`acl.domain_relayhost`, `acl.mailbox_relayhost`), and
    requests no choices.
  - **Reading**: `getDomainRelayhostAssignment` and `getMailboxRelayhostAssignment`. A
    `RelayhostReference` is shown as its host and its state in words: "active", "inactive (no
    effect until it is activated)" or "no longer exists (#{id}, no effect)" (FR-031, FR-033,
    FR-034). `null` is "None / inherit" (`edit.none_inherit`).
  - **Mailbox section** shows, from `MailboxRelayhostAssignment`:
    - the mailbox's own assignment, editable;
    - the domain's assignment, read-only, with a link to the domain's Relayhost section;
    - the effective relayhost: "{host}, from the mailbox" or "from the domain" (`effectiveRelayhost.source`),
      or "Direct delivery";
    - when `credentialsRelayhost.source` is `domain` while `effectiveRelayhost.source` is
      `mailbox`, the note that the mail server connects to the mailbox's relayhost with the
      credentials of the domain's relayhost (FR-035, more precise than the spec's "tries the
      domain's first", because the contract reports it);
    - the legacy hint `edit.mailbox_relayhost_info` (FR-030).
  - **Choice** (`RelayhostChoicePicker.vue`): a Reka `Combobox` without `ComboboxViewport` (UI 001
    R18), with a 300 ms debounced search and "Load more" over `useInfiniteQuery`, 25 per page.
    "None / inherit" is always the first option. Each option shows the host, `#{id}` and, in
    words, "inactive" (FR-032).
    - Administrators: `GET /relayhosts` (`q` searches host and username), which carries the
      username that FR-032 shows to administrators.
    - Domain administrators: `GET /relayhost-choices` (`q` searches the host), which has no
      username (least privilege, API FR-023).
    - With no relayhost at all, only "None / inherit" is offered, and administrators get a link
      "Add a sender-dependent transport" to `/routing/relayhosts/new` (FR-036).
    - Choosing an inactive relayhost shows the no-effect note before saving (FR-033).
  - **Saving**: `PUT …/relayhost-assignment` with `{ relayhostId }` and `If-Match`. A `412` keeps
    the choice, reloads and marks the changed assignment (R6, US2-AS6). A
    `permission-flag-required` refusal names the flag and refreshes the identity (R19).
  - **Effects on other screens**: the response replaces the assignment in the cache. UI 002's
    `['domains','detail',name]` or UI 003's `['mailboxes','detail',address]` is invalidated, because
    the assignment is part of its version tag (API FR-028), so that the page's next section save
    sends the new tag. A domain change also
    invalidates every cached mailbox assignment, whose `domainRelayhost` and effective relayhost
    depend on it, and the relayhost lists and usage (FR-009). The full table is in
    [data-model.md](./data-model.md#invalidation-after-mutations).
  - **History** (administrators only, R18): `domainRelayhostAssignment` with the ASCII domain name,
    or `mailboxRelayhostAssignment` with the mailbox address.
- **Rationale**: The API changes assignments through their own operations with their own version
  tags (API clarification 3), so a section with its own save is the only way to avoid half-saved
  forms. The admin picker's data source closes FR-032's username requirement without an API
  change.
- **Alternatives considered**: A native `<select>` with every relayhost: rejected, because the
  choice must be searchable and paged (FR-032). Embedding the assignment in the domain form:
  rejected, because API 002 and 003 refuse the field.

### R10. Transports: several destinations and shared next hops

- **Decision**:
  - **Several destinations** (FR-039, clarification 4): `logic/destinations.ts` splits the field on
    `/[\s,;]+/`, trims, drops empty items and removes case-insensitive duplicates, keeping the first
    spelling and the order. `useTransportCreateBatch` sends one `POST /transports` per destination,
    **one after another**, each with the same next hop, MX-based flag, active state and
    credentials. Sequential requests keep the order of the results and let the first request settle
    the next hop's credentials before the next one.
    - A refusal that concerns the destination (`422` with errors only on `destination`, or `409
      routing-entry-exists` with `field: destination`) is recorded for that destination and the
      batch continues.
    - A refusal of any other member (next hop, credentials, MX-based) applies to every destination,
      so the batch stops, the errors are shown at their fields, and the remaining destinations are
      reported "not sent".
    - A `409 next-hop-credentials-differ` or `next-hop-interferes` stops the batch the same way.
    - A network failure stops the batch; the destination in flight is reported "outcome unknown"
      and the rest "not sent" (conventions: never retried automatically).
    - At the end, created destinations are removed from the field, failed ones stay one per line,
      and a results list names each destination with "created" (linked), its reason, "outcome
      unknown" or "not sent". The summary ("2 of 3 transports created") is announced.
  - **Shared next hop** (FR-041, US3):
    - `useSharedNextHop` looks up the other transports of the entered next hop with
      `GET /transports?nextHop=<trimmed input>&limit=100` when the next hop field loses focus, and
      again just before saving (query `['transports', 'next-hop', value]`, `staleTime` 0). The
      transport being edited is excluded.
    - The form shows the result before any change: "This next hop is also used by {n} transports:
      {destinations}. They share one username and password." with a link to the list filtered by
      that next hop. When credentials are not being sent, it adds "This transport will use that
      next hop's credentials (username {u}, password stored or not)".
    - Before a save that sends a username or password while other transports use the next hop, a
      confirmation names up to ten of them ("and {n} more") and states that their credentials will
      change too.
    - After the save, `meta.affectedTransports` names the other transports whose credentials
      changed (minus those created by the same batch), in the success message.
    - `next-hop-credentials-differ` (`409`, `nextHop`, `transportIds`): "This next hop already has
      different credentials. Create the transport without credentials, or change them on one of
      these transports first." with links to the transports (US3-AS5).
    - `next-hop-interferes` (`409`, `nextHop`, `transportIds`): "{nextHop} interferes with this next
      hop: the mail server would look up its credentials first." with links (US3-AS6).
  - **Lookup normalisation**: the lookup sends the trimmed input. The API compares without regard
    to letter case but does not normalise the filter as it normalises a stored next hop (a bare IP
    address is stored in brackets, a Unicode host in ASCII). For such inputs the pre-save lookup can
    miss the other transports, and only the post-save report names them. The UI does not copy the
    server's normalisation (constitution I: no workaround); the plan records an API gap asking the
    `nextHop` filter to normalise like a creation.
  - **Warnings**: the destination `*` warns that it applies to every recipient, including the hosted
    domains (FR-040). Active is preselected off, with the hint that an active `*` transport
    reroutes all outbound mail (FR-039).
- **Rationale**: The API accepts one destination per creation and suggests splitting the input
  (API FR-034). The API's `nextHop` filter, `nextHopSharedWith` count and `meta.affectedTransports`
  give everything the spec's before-and-after visibility needs.
- **Alternatives considered**: Parallel creation requests: rejected, because results would arrive
  out of order and the first password change would race the others. Pre-checking a differing
  username in the client: rejected, because the API's `409` already carries the next hop and the
  transports, and duplicating the rule could drift.

---

## 4. Connection test

### R11. Running a test

- **Decision**:
  - **Location** (FR-004): `/routing/relayhosts/:relayhostId/test` and
    `/routing/transports/:transportId/test`, both rendered by `ConnectionTestPage.vue` with a
    `kind` prop. The page loads the entry (host or next hop, username, active state) and names it.
    An inactive entry gets "This entry is inactive; the test runs anyway" (spec edge case). Nothing
    runs on load: a test sends real mail.
  - **Form** (FR-044): sender and recipient start empty, with `capabilities.administration
    .connectionTest.defaultSender` and `defaultRecipient` as placeholders and the help text "Empty
    uses the server's default address ({address})". The recipient field shows the legacy hint
    `admin.transport_test_rcpt_info`. The screen states that the test connects directly to the next
    hop, so TLS policy maps and mailbox TLS settings do not apply (FR-048). Before sending, a light
    client check (one `@` with text on both sides, no whitespace, at most 255 characters) reports an
    invalid address at its field and sends nothing; the API's `422` (`invalidFormat`, `format:
    email`) is shown the same way (US4-AS6).
  - **Running** (FR-045): `useConnectionTest` wraps a TanStack mutation with `gcTime: 0`, so that the
    global session reactions of UI 001 R8 still apply, and passes an `AbortSignal` to the request.
    While it runs:
    - the Run button is disabled with `aria-disabled` and a busy label, so it cannot start twice;
    - a progress panel says "Testing… this can take up to {total} seconds" and is announced once in
      the polite region, then again after `stepTimeoutSeconds` with "Still testing";
    - an elapsed-time counter is shown but not announced.
  - **Watchdog**: if no result arrives within `totalTimeoutSeconds + 15` seconds (75 s with the
    server's default 60 s), the app aborts the request and shows "No result was received. The test
    may still have sent a message." with "Run again". This is a deliberate exception to UI 001 R8's
    "no client-side timeout", for this operation only: FR-045 requires the state, and the API's
    nginx answers a `504` only after 90 s (API research R13). The spec's fixed 75 s becomes this
    formula, so that the client follows the server's configured timeout (conventions), and the spec
    records the change.
  - **Leaving the page** aborts the request and calls `reset()`: no stuck state, no stored result
    (FR-049, spec edge case). Running again replaces the result.
  - **From an edit page with unsaved changes**: the Test action goes through the unsaved-changes
    confirmation of R6, worded "The test uses the saved values. Leave without saving your changes?"
    (FR-043, FR-012).
- **Rationale**: The API answers within about 60 seconds and reports every outcome as `200`
  (RoutingConnectionTestResponse); a request that never answers needs a client-side end state.
  Using the mutation cache keeps `401` and `403` handling uniform.
- **Alternatives considered**: Prefilling the default addresses as values: rejected by the spec
  (clarification 5), because a server change of the defaults would then be overridden; the
  placeholders show them instead. A dialog on the list: rejected by FR-004. Polling: the API has no
  background test job.

### R12. Result summary

- **Decision**: `ConnectionTestSummary.vue` renders a `<section>` labelled "Test result" whose first
  lines answer SC-004 on a 360 × 780 screen without scrolling:
  1. **Verdict**, as a heading with an icon and text: "Accepted" or "Not accepted".
  2. **Step**: "Reached: Message" when accepted, otherwise "Failed at: {step}" with the translated
     `failure.reason` ("The server rejected the login", "No answer within 15 seconds"), from the
     eight `RoutingConnectionTestStep` values and the ten reasons. An unknown reason falls back to a
     generic "The test stopped" with the code.
  3. **Last reply**: `lastReply.code` and `text`, in monospace, marked `translate="no"`, or "No
     reply from the server".

  Then a definition list:
  - **Server**: `host:port`, and "found by an MX lookup of {nextHop}" when `hostSource` is
    `mailExchanger`, otherwise "the next hop itself" (US4-AS5); "not reached" when `host` is `null`.
  - **TLS**: "Used (STARTTLS)" or "Not used".
  - **Login**: `succeeded`, `failed`, `notConfigured` ("No username stored, no login") or
    `notReached` ("Not reached"), in words.
  - **Addresses used**: `sender` and `recipient`, which show the server's defaults when the fields
    were empty.
  - **Time**: `startedAt` in the locale and the duration in seconds.

  Below that, `ConnectionTestSteps.vue` shows the eight steps as an ordered list, each with a word:
  passed, failed, not reached, "not offered" (`tls` passed over when `tls` is false and the step
  went beyond it) or "not configured" (`login` when `login` is `notConfigured`). The summary is
  announced in the polite region when the result arrives (FR-069).
- **Rationale**: The contract's result fields map one to one to FR-046. Words and an ordered list
  carry the outcome without colour (FR-070).
- **Alternatives considered**: Showing the step timeline first: rejected, because eight rows push
  the verdict and the reply off a phone screen.

### R13. Transcript view

- **Decision**: `ConnectionTranscript.vue`:
  - It is a Reka `Collapsible` titled "Transcript (server output, not translated)". It is closed
    below `md` and open from `md` up (FR-047).
  - Lines render as an ordered list in monospace, with `white-space: pre-wrap` and
    `overflow-wrap: anywhere`, so that long lines wrap at 360 px and nothing scrolls sideways.
  - Each line starts with a visible marker by direction: `C:` for lines the test sent (`client`),
    `S:` for lines the server sent (`server`) and `*` for notes of the test (`info`). A legend above
    the list explains them. The marker is `aria-hidden`, and a visually hidden word ("Sent",
    "Received", "Note") precedes the text, so screen readers hear the direction. Colour only tints
    the markers.
  - The text is shown exactly as returned, with `translate="no"`. The redaction marks
    (`[redacted]`) and `[message: N bytes]` lines are visible as given (US4-AS7). The text is
    rendered as text, never as HTML (FR-074).
  - "Copy transcript" is UI 005's `CopyButton.vue` (over `src/shared/platform/clipboard.ts`) with
    plain text: one line per entry, prefixed `C: `, `S: ` or `* `, built by `logic/transcript.ts`.
    Success and refusal are announced; a refusal selects the list's text for manual copying.
  - An empty transcript (the test stopped before connecting) shows "No dialogue took place".
- **Rationale**: The contract returns `{ direction, text }` per line (at most 501 lines of 1,000
  characters), so the direction is data, not colour. The `C:` and `S:` markers are the usual
  notation of SMTP transcripts.
- **Alternatives considered**: A single `<pre>` block: rejected, because the direction would be
  readable only from the marker characters, which screen readers announce poorly. Arrows: rejected
  for the same reason.

---

## 5. Maps and forwarding hosts

### R14. BCC maps

- **Decision**:
  - **Local destination picker** (`BccDestinationPicker.vue`, FR-052): a Reka `Combobox` without
    its viewport, over `GET /bcc-destination-choices` with `useInfiniteQuery` (25 per page, "Load
    more"), a 300 ms debounced `q`, kind checkboxes (repeated `kind`) and a domain filter (repeated
    `domain`: the scope domains from `GET /me` as checkboxes for domain administrators, a text
    field for administrators). Each option shows its value, its kind in words, its domain and, for
    aliases and alias-domain addresses, "delivers to {mailboxes}". SC-008 (matches within 1 s of a
    pause) is met by the debounce and one request per pause.
  - **Type**: two radio buttons with the legacy labels "Recipient map" and "Sender map", each with
    a one-line explanation (copies of mail to, or sent by, the local destination).
  - **BCC destination**: one address. When the value contains a comma, semicolon or whitespace
    between addresses, the field shows `add.bcc_dest_format` (use an alias for several recipients)
    before saving; the API's `tooMany` (`max: 1`) shows the same message.
  - **Domain administrators without `bccMaps`** (FR-002, US5-AS6): no add action, no selection, no
    entry actions except opening the entry read-only, and UI 003's `AclReadOnlyNote` naming the BCC
    maps permission (`acl.bcc_maps`). The entry page shows the map read-only, with its creation and
    modification times (FR-050).
  - **Orphaned maps** (administrators): API 009 now reports `orphaned`. Such maps carry the words
    "Domain no longer exists", and the list offers an "Orphaned" filter for administrators. This
    closes the UI spec's second API gap, recorded as a consistency change.
  - **Duplicate** (`409 routing-entry-exists`, `field` `localDestination` or `type`): the message
    `danger.bcc_exists` at the named field, with a link to the existing map (`conflictingId`).
  - **Domain-wide maps** (`@domain`) are labelled "Whole domain" in words.
- **Rationale**: The picker mirrors the API's paged, searchable choices (API FR-057), which replace
  legacy's every-object dropdown.

### R15. TLS policy maps

- **Decision**: The policy is a radio group (TailAdmin `radio-group` on Reka) with eight options in
  the order of `capabilities.administration.tlsPolicies`. Each option shows the policy name
  untranslated (`dane-only`, a Postfix keyword) and a one-line translated explanation (FR-058). The
  list's policy filter is a checkbox group (repeated `policy`). The screen shows the legacy hints and
  a link to the Postfix `smtp_tls_policy_maps` documentation, rendered by `RichText` (R20) with
  "opens an external site" in words. Parameters are shown as returned, or a dash when empty
  (FR-057). Duplicates (`409 routing-entry-exists`, `field: destination`) use
  `danger.tls_policy_map_entry_exists` at the destination field.
- **Rationale**: A native select cannot show an explanation per option on every platform; a radio
  group shows all eight explanations, which the spec requires, and works by keyboard.

### R16. Recipient maps

- **Decision**: Two fields with the legacy hints `mailbox.recipient_map_old_info` and
  `mailbox.recipient_map_new_info`. Values starting with `@` are labelled "Whole domain" in words
  (FR-055). The API's `invalidFormat` (`format: recipientMapDestination`) explains the accepted
  forms (US7-AS3), and `409 routing-entry-exists` (`field: originalDestination`) shows
  `danger.recipient_map_entry_exists` at that field (US7-AS2).

### R17. Forwarding hosts

- **Decision**:
  - **Adding** (FR-060 to FR-062): `POST /forwarding-hosts` with `host` and `spamFilter`
    (preselected on). On `201` or `200` the app returns to the list filtered by the request's source
    (`/routing/forwarding-hosts?source=…`, the same filter the `Location` header names) and shows a
    results panel above the list: every entry's stored address with "added" or "updated (source and
    spam filter replaced)". The panel's data is a one-shot, in-memory value of the feature
    (`useForwardingHostResults`), never history state or storage; a reload drops it, and the
    filtered list still shows the entries.
  - **`422 notResolvable`** on `host` is a field error ("This name resolves to no address"). **`503
    temporary-failure`** shows "DNS or the mail server's store is temporarily unavailable" with a
    retry that is enabled after `Retry-After` seconds (UI 001's `useCountdown`). The form keeps its
    values.
  - **Entry page** (`/routing/forwarding-hosts/:forwardingHostAddress`): address and source
    read-only (FR-063), the spam filter as a checkbox with Save, delete and History. Vue Router
    encodes the address parameter, so `/` becomes `%2F`; the client passes the decoded address to
    `openapi-fetch`, whose path serialiser percent-encodes it again for the API, as the contract
    requires. A unit test asserts the request path `192.0.2.0%2F24`.
  - **Source**: selecting a card's source sets `?source=` (FR-059, US8-AS4). Entries in
    non-canonical stored form are shown as returned (spec edge case).
- **Rationale**: FR-011 returns to the list after a save; the source filter is exactly the set of
  addresses the request touched.
- **Alternatives considered**: Keeping the results on the create page: rejected by FR-011. Passing
  them in history state: rejected, because it would survive in browser history.

### R18. History

- **Decision**: For administrators only (FR-064, US9), UI 002's `HistoryLink` opens
  `/audit-log?targetType=…&targetId=…` with these targets (API data-model, audit events):

  | Entry | `targetType` | `targetId` |
  |---|---|---|
  | Relayhost | `relayhost` | its ID |
  | Domain's Relayhost section | `domainRelayhostAssignment` | the ASCII domain name |
  | Mailbox's Relayhost section | `mailboxRelayhostAssignment` | the mailbox address |
  | Transport | `transport` | its ID |
  | BCC map | `bccMap` | its ID |
  | Recipient map | `recipientMap` | its ID |
  | TLS policy map | `tlsPolicyMap` | its ID |
  | Forwarding host | `forwardingHost` | its stored address |

  API 009 records a forwarding host's *creation* under its source, not under each address. The
  list therefore also offers "History of this source" (`targetId` = the source) while it is
  filtered by a source, so that the creation that added an address can be found.

  The audit log screen gets labels for the 21 event types and 8 target types of API 009
  (conventions "History and audit").
- **Rationale**: The conventions' generic target filters; the forwarding host detail follows the
  API's recording rule.

---

## 6. Errors, text and i18n

### R19. Problem types and validation codes of this feature

- **Decision**: `src/features/routing/problems.ts` adds the routing-specific behaviour on top of UI
  001's problem mapping (`problem.<name>`, `validation.<code>`):

  | Problem | App behaviour |
  |---|---|
  | `409 routing-entry-exists` (`field`, `conflictingId`) | Message at the named field, using the legacy `danger.*_exists` text of that entry type, with a link to the existing entry (R14–R16; transport: `danger.transport_dest_exists`) |
  | `409 next-hop-credentials-differ` (`nextHop`, `transportIds`) | R10; at the username field, with links |
  | `409 next-hop-interferes` (`nextHop`, `transportIds`) | R10; at the next hop field, naming `nextHop`, with links |
  | `403 permission-flag-required` (`requiredFlags`) | "Missing permission: {flags}" with the flags' translated labels (`permissionFlags.<flag>` of UI 005 and UI 007, mapped to the legacy `acl.bcc_maps`, `acl.domain_relayhost`, `acl.mailbox_relayhost`); refresh the identity; nothing shown as done (FR-003, FR-066) |
  | `403 forbidden` | UI 001's global handling ("no permission", identity refresh) |
  | `412` (`about:blank`) | R6 |
  | `404` (`about:blank`) | "This entry no longer exists" with the way back to the list |
  | `503 temporary-failure` (`Retry-After`) | Message with a retry enabled after `Retry-After` (R17) |
  | `422 validation-failed` | Field errors (UI 001 R15) with the codes below |
  | other types and statuses | UI 001's generic message with the request ID (FR-067) |

  The "Missing permission" wording lists the flags without "and" or "or". It is correct in both of
  the problem's combinations (`all` lists only missing flags; with `any` every listed flag is
  missing), because the contract's schema does not declare `requiredFlagsMatch` (plan API gap).

  Validation codes and formats that this feature's forms can receive: `required` (with `because:
  password` on `username`, R7), `tooLong` (`max`), `tooMany` (`max`; on `bccDestination` with
  `max: 1`, R14; on `targets`, the bulk limit), `notInList` (`allowed`), `invalidFormat` with the
  formats `nextHop`, `transportDestination`, `recipientMapDestination`, `tlsPolicyDestination`,
  `tlsPolicyParameters`, `domainName`, `email` and `ipNetwork`, `invalidRegex`, `immutable`,
  `notFound` (unknown or out-of-scope BCC local destination or relayhost), `notResolvable` and
  `invalidCharacter` (`characters`, for example `:` in a username). Each gets a
  `validation.*` message; the formats get `validation.format.<format>`. UI 001's mapper gains
  one rule: a `because` parameter selects `validation.<code>Because.<because>` when it exists.

  The UI spec listed "too many requests" and "attribute not permitted" among this feature's error
  types. No API 009 operation documents them, so they keep UI 001's shared translations and are not
  mocked for routing operations (a mocked undocumented status would violate the contract, UI 001
  R22). The spec records this as a consistency change.
- **Rationale**: Constitution I: errors are handled from the problem `type` and `errors`. The
  extension members of the routing problems carry everything a precise message needs.

### R20. Legacy hints with markup

- **Decision**: Nine reused legacy keys contain markup: `admin.relayhosts_hint`,
  `add.relayhost_wrapped_tls_info`, `admin.transports_hint`, `admin.lookup_mx`,
  `admin.credentials_transport_warning`, `mailbox.bcc_info`, `add.bcc_dest_format`,
  `mailbox.tls_policy_maps_info` and `mailbox.tls_policy_maps_enforced_tls`; `admin.transport_test_rcpt_info`
  carries a `&#8226;` entity. UI 001's import refuses HTML (R15), and the spec requires the hints'
  meaning and links with the app's own safe formatting (Assumptions). The decision:
  - **Import**: UI 002 D27 gave `src/i18n/legacy-map.json` an object form,
    `{ "from": "<key>", "stripMarkup": true }`, which removes markup. UI 009 adds a sibling option,
    `{ "from": "<key>", "rich": true }`. For such keys, `scripts/i18n/import-legacy.mjs` converts
    the legacy HTML of every locale into a small text notation and refuses anything else:
    - `<br>`, `<br/>` and `<br />` with the line break that follows become a line break (`\n`);
      other line breaks become a space;
    - `&#8226;` at the start of a line becomes the list marker `- `;
    - `<b>` and `<strong>` become `**…**`; unmatched closing tags (legacy's
      `admin.transports_hint` has one) are dropped;
    - `<code>` becomes `` `…` ``;
    - `<a href="https?://…">text</a>` becomes `[text](url)`; any other scheme is refused;
    - the entities `&amp; &lt; &gt; &quot; &#39; &#8226;` are decoded;
    - every other tag or attribute is refused with an error naming the key and locale;
    - vue-i18n's special characters are escaped afterwards, as for every legacy value.
  - **Rendering**: `src/shared/components/RichText.vue` turns the notation into virtual nodes:
    paragraphs and line breaks, `<ul>` for runs of `- ` lines, `<strong>`, `<code>`, and links
    through UI 001's `safeHref` with `target="_blank"`, `rel="noopener noreferrer"`, an external
    link icon and the visually hidden words "(opens an external site)". It never uses `v-html`. A
    link that `safeHref` rejects renders as its text.
  - `i18n:check` verifies that rich keys parse in all three locales and that their link targets are
    equal across locales.
  - The first setup task reuses an equivalent mechanism if an earlier feature already added one.
- **Rationale**: Constitution IV reuses the legacy keys so that Czech and Slovak carry over;
  constitution V and UI 001 R17 forbid rendering translation text as HTML. A tiny notation keeps
  both. UI 002's `stripMarkup` suits its one-sentence hints, but this spec requires the hints'
  meaning and links preserved (Assumptions, FR-058): `admin.transports_hint` is a six-item list,
  and `mailbox.tls_policy_maps_info` carries the Postfix documentation link.
- **Alternatives considered**: UI 002's `stripMarkup` for the nine hints: rejected, because it
  flattens the bullet lists into one paragraph, leaves `&#8226;` undecoded and drops the link
  that FR-058 requires. Hand-written replacements for the nine hints: rejected by constitution IV,
  because their cs and sk translations exist. Rendering them through
  `SanitizedHtml`: rejected, because the spec says translation text is never interpreted as markup,
  and `SanitizedHtml` is reserved for operator HTML. vue-i18n component interpolation: rejected,
  because the link texts are inside the legacy sentences and cannot be split into separate keys
  automatically.

### R21. Translations

- **Decision**:
  - **Namespaces**: `routing.common`, `routing.screens`, `routing.relayhosts`,
    `routing.relayhostSection`, `routing.transports`, `routing.connectionTest`, `routing.bccMaps`,
    `routing.recipientMaps`, `routing.tlsPolicyMaps`, `routing.forwardingHosts`, `routing.bulk`
    and `routing.history`, plus entries in the shared `validation.*`, `problem.*`,
    `auditLog.event.*` and `auditLog.target.*` namespaces.
  - **Legacy reuse**: every key the spec's Legacy Parity section lists is mapped in
    `src/i18n/legacy-map.json`, rich keys in the object form (R20). All of them exist in the
    upstream `en-gb`, `cs-cz` and `sk-sk` files at `2026-09a` (checked during planning), so no
    per-locale fallback is needed. The `%s` placeholders of the `success.*` and `danger.*` messages
    become `{0}` and `{1}` in order, as UI 001's import does, and the UI passes list parameters.
  - **Enumerations** follow UI 002 D2 and UI 003 R2:
    - the **open** shared enumerations get API 009's values appended to the coverage manifest
      (`src/i18n/coverage.json`, the canonical registry): the 21 event types
      `relayhostCreation` … `forwardingHostDeletion` of `AuditEventType`, the 8 `AuditTarget.type`
      values `relayhost`, `domainRelayhostAssignment`, `mailboxRelayhostAssignment`, `transport`,
      `bccMap`, `recipientMap`, `tlsPolicyMap`, `forwardingHost`, the `ValidationRuleCode` values
      `invalidRegex`, `immutable`, `notResolvable` and `invalidCharacter`, and the problem types
      `routing-entry-exists`, `next-hop-credentials-differ`, `next-hop-interferes`,
      `permission-flag-required` and `temporary-failure`, each only if an earlier feature has not
      already listed it;
    - the **closed** enumerations that this feature renders are added to `ENUM_NAMESPACES` in
      `scripts/i18n/lib.mjs`, so that every value needs a key `enums.<name>.<value>` in all three
      locales: `tlsPolicyValues` (the one-line explanation; the policy name itself stays
      untranslated), `bccMapTypeValues`, `bccDestinationChoiceKindValues`,
      `routingConnectionTestStepValues`, `routingConnectionTestResultFailureOneOf0ReasonValues`,
      `routingConnectionTestResultLoginValues`, `routingConnectionTestResultHostSourceValues`,
      `routingConnectionTestResultTranscriptDirectionValues`, `relayhostReferenceStateValues`,
      `relayhostUsageEntryKindValues`, `forwardingHostCreationResultEntriesOutcomeValues`,
      `routingPermissionFlagProblemRequiredFlagsValues`, the six bulk action arrays
      (`relayhostBulkActionRequestActionValues`, `transportBulkActionRequestActionValues`,
      `bccMapBulkActionRequestActionValues`, `recipientMapBulkActionRequestActionValues`,
      `tlsPolicyMapBulkActionRequestActionValues`, `forwardingHostBulkActionRequestActionValues`)
      and the seven sort parameters (`componentsParametersRelayhostSortValues`,
      `…RelayhostUsageSortValues`, `…TransportSortValues`, `…BccMapSortValues`,
      `…RecipientMapSortValues`, `…TlsPolicyMapSortValues`, `…ForwardingHostSortValues`), as UI 002
      did for its sort enumerations. These names were generated from the baseline bundle.
  - **Wording**: the screens keep the legacy names ("Sender-dependent transports", "Transport
    Maps"), and the relayhost screen's introduction says that sender-dependent transports are also
    called relayhosts (FR-001). User-facing text calls the legacy UI "the classic interface".
  - **Formatting**: counts with `Intl.NumberFormat`, times with UI 001's `DateTime`, durations in
    seconds with the locale. Values from the API are shown as returned (FR-073).
- **Rationale**: Constitution IV and UI 001's i18n tooling.

---

## 7. Server state, mock and tests

### R22. Query keys and invalidation

- **Decision**: The keys, freshness and invalidations are listed in
  [data-model.md](./data-model.md#3-server-state-cache). The rules beyond UI 001 R9:
  - Writes that return the entry write it into its detail key with `setQueryData` and invalidate
    the lists of that collection.
  - Every transport write invalidates all transport lists and details, because a credential change
    changes the version tags of the other transports of the next hop (API FR-008).
  - Relayhost deletion, relayhost bulk deletion and assignment changes invalidate the relayhost
    assignments and the domain and mailbox detail queries, whose version tags include the
    assignment (API FR-028). Without this, UI 002's and UI 003's next section save would be
    refused as outdated.
  - Relayhost edits (host, active state) invalidate the assignments, which show host and state.
  - The connection test writes nothing to the cache.
- **Rationale**: Constitution VII: the screens refresh what a change affects and nothing else
  (FR-009).

### R23. Mock API for routing

- **Decision**: UI 001 R22's mock gains one handler file per contract module:
  `tests/mocks/handlers/{relayhosts,relayhost-assignments,transports,bcc-maps,recipient-maps,tls-policy-maps,forwarding-hosts,routing-capabilities}.ts`,
  typed with `openapi-msw` and validated by the contract validator. They implement the contract's
  documented behaviour on the scenario state:
  - lists with `q`, the documented filters, sorting with ties by identifier, paging and `ListMeta`;
  - `ETag` and `If-Match` with `412`; merge patches with the read-only members rule (`immutable`);
  - write-only credentials: the password is stored in the scenario state and never serialised;
    `passwordSet` is derived; omit keeps, `""` removes, an empty username removes the password, a
    password without a username is `422 required` with `because: password`;
  - relayhost deletion clears domain and mailbox assignments; usage lists; choices for domain
    administrators with either flag, otherwise `403 permission-flag-required`;
  - assignments with `RelayhostReference` states, the mailbox's `effectiveRelayhost` and
    `credentialsRelayhost` computed by the contract's rules, the domain administrator scope (`404`
    outside it) and the flag checks before the lookup;
  - transports with the shared credential rules of `TransportCreateRequest` and `TransportPatch`,
    `meta.affectedTransports`, `nextHopSharedWith`, and the three `409` types;
  - connection tests from a scenario script per entry: an accepted result, a failure at each of the
    eight steps, an MX lookup, an invalid-address `422`, a delay, or "never answers" (the response
    is held until the request is aborted);
  - BCC maps with scope, the `bccMaps` flag, `orphaned` (administrators only), and destination
    choices generated on demand from a seeded count, so a scenario can offer 10,000 choices
    without storing them;
  - forwarding hosts with a scenario DNS table (`name → addresses`, `name → none`,
    `name → temporary failure`), canonical forms, `added` and `updated`, `201` versus `200`, and
    `503 temporary-failure` with `Retry-After`;
  - bulk actions with per-target versions, `outdated`, `notFound` (also outside a domain
    administrator's scope), `refused` with a problem, and the limit from the capabilities.

  The scenario state (`tests/mocks/scenarios/state.ts`) gains the routing collections and a
  `relayhostId` on UI 002's and UI 003's domains and mailboxes, so that their handlers report the
  same assignment. Factories live in `tests/mocks/factories/`; scenarios in
  `tests/mocks/scenarios/routing/`, one module per area (so that stories can be built in parallel)
  with an `index.ts` that registers them and composes `routing-admin-default` from every area's
  seed. Closed enumerations (for example
  the failure reasons) never carry unknown values in a mock (UI 001 R22): unknown-value behaviour is
  unit-tested with plain values. "Outcome unknown" is a transport failure (`route.abort()`), not a
  mocked response.
- **Rationale**: Stateful handlers that follow the contract let the end-to-end tests exercise the
  real flows, and the validator stops any response the API could never send.

### R24. Test strategy

- **Decision**:
  - **End-to-end**: one spec per user story in `tests/e2e/routing/`, run on `mobile-chromium`
    (360 px), `desktop-chromium` and `mobile-webkit`, with `expectAccessible` (axe, both themes) on
    every screen and state, `expectNoHorizontalScroll` at 360 and 320 px, `expectTouchTargets`,
    and zero CSP and contract violations (UI 001 R24). Test titles carry the spec IDs
    (`US4-AS3 …`, `FR-045 …`, `Edge: …`).
  - **Watchdog**: `page.clock` advances past the deadline while the mock holds the response.
  - **Secrecy (SC-003)**: tests seed relayhosts and transports with passwords, type new ones, save,
    and assert that no password string appears in the DOM (`page.content()`), in `localStorage`,
    `sessionStorage` or `history.state`, while `mockApi.requests()` shows it was sent only in the
    write body.
  - **SC-004**: for the accepted result and each of the eight failed steps, the verdict and the
    step are inside the 360 × 780 viewport without scrolling or opening the transcript.
  - **SC-010**: as a domain administrator without any routing flag, no control that changes a BCC
    map or a relayhost assignment exists in the DOM.
  - **Unit and component tests** cover the logic modules, composables and components listed in
    [tasks.md](./tasks.md), with MSW and fake timers.
  - **Smoke**: `tests/smoke/routing-*.smoke.spec.ts` against the API dev stack, started with the
    `routing` compose profile, whose `mailpit` service is the SMTP target (`[mailpit]:1025`) of a
    real connection test (API quickstart Part B).
  - **Lighthouse**: one more collection on `/ng/routing/relayhosts` with an administrator scenario
    (SC-008, constitution VII).
- **Rationale**: Constitution VI and UI 001 R24, applied to this feature's success criteria.

### R25. Performance and dependencies

- **Decision**: No new runtime dependency. Every routing page is a lazy route chunk, and the
  Relayhost sections load as async components inside UI 002's and UI 003's chunks (R9). The
  combobox, collapsible, dropdown menu and radio group already come from UI 001's TailAdmin copy.
  Searches and pickers are debounced (300 ms). `budget:check` must still pass, and the routing
  chunks are listed in its output.
- **Rationale**: Constitution VII and VIII.
