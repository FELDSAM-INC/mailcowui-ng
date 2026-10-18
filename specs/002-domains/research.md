# Research: Domains

**Feature**: `specs/002-domains` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

This document records only the decisions that UI feature 002 adds. The stack, the folder layout,
contract pinning, the generated client, the mock API, testing, i18n, theming, the session and the
shared primitives come from UI feature 001 ([research](../001-sign-in-app-shell/research.md),
R1–R29) and are not repeated. Decisions follow this order of precedence: the constitution, then
the pinned mailcow-rest-v2 contract, then `docs/conventions.md`, then UI 001's decisions, then
best practice. Each entry has a **Decision**, its **Rationale** and the **Alternatives
considered**.

---

## 1. Contract and dependencies

### D1. Contract pin and implementation prerequisites

- **Decision**:
  - **Planning baseline**: mailcow-rest-v2 commit `32079252d55797d3da4e58ae661e9fb91c51c6f9`
    ("Register KnownProblemType in contract components"). Its Redocly bundle has sha256
    `5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6`, 376 operations and
    `info.version` `0.1.0`. The API 002 contract (`api/modules/domains/`,
    `api/modules/domain-templates/`, the `Domain*` components and the `targetType`/`targetId`
    filters of `GET /audit-events`) has been unchanged since commit `651cef0` ("Move domain
    capabilities to /capabilities/domains"). Later commits only added other features'
    components.
  - **No "002-only" commit exists.** mailcow-rest-v2 authored the contracts of features 003 to 013
    in parallel, and the final API 002 contract only exists in a tree that also contains them. Any
    pin that includes the final API 002 contract therefore also brings those operations and the
    values they add to the shared enumerations (D2).
  - **Implementation prerequisites** (tasks.md, Phase 1):
    1. UI feature 001 is implemented and its gates pass.
    2. mailcow-rest-v2 feature 002 is implemented: its `tasks.md` is complete and its quickstart
       Part A passes.
  - **Pin at implementation time**: T001 runs `scripts/contract/bump.sh` against the
    mailcow-rest-v2 release tag that ships the feature 002 implementation, or, without a tag,
    against the first commit at which the prerequisite above holds. Before accepting the pin it
    diffs the domain contract files listed in [contracts/README.md](./contracts/README.md)
    between the baseline and the new ref. Any difference is a contract change that must be
    reviewed against this plan before implementation continues (constitution I). The commit
    becomes authoritative in `contract/VERSION.json`, so the smoke suite of UI 001 (R25) runs
    against an API that implements feature 002.
  - The bump also brings `KnownProblemType` under `components.schemas`, which closes UI 001's
    API gap 5: `knownProblemTypeValues` is now generated.
- **Rationale**: Constitution I requires a recorded pin and a deliberate bump. UI 001 R6 says that
  later features bump the pin when they need their own operations. The orchestrated workflow
  implements UI 002 only after API 002 works, so the pin must also identify a runnable API for the
  smoke suite.
- **Alternatives considered**:
  - Pinning `2d52407` ("Add feature 002 contract"), the only commit with 001 and 002 alone:
    rejected. It lacks the capabilities, deletion preview, distinct tags and bulk version tags that
    API 002 added afterwards, and that this plan relies on.
  - Filtering the vendored contract down to 001 and 002: rejected. The vendored file must be
    byte-identical to the API's release artifact (UI 001 R6).

### D2. Translation coverage of growing shared enumerations (amends UI 001 R27, rule 3)

- **Decision**: UI 001's `i18n:check` requires a key for every value of the checked contract
  enumerations and every problem type named in the bundle. With the new pin, that would mean 161
  audit event types, 73 audit target types, 49 failure reasons, 10 authentication methods, 46
  validation rule codes and 86 problem types, most of them belonging to UI features 003 to 013.
  This plan scopes rule 3 for the **growing shared enumerations** with a committed manifest,
  `src/i18n/coverage.json`:

  ```json
  {
    "AuditEventType": ["signIn", "…", "domainCreation", "…"],
    "AuditTarget.type": ["apiKey", "…", "domain", "domainTemplate", "domainFooter"],
    "AuditFailureReason": ["…"],
    "AuthMethod": ["…"],
    "ValidationRuleCode": ["…"],
    "problemTypes": ["…"]
  }
  ```

  - The check fails when a listed value has no key in any locale, or when a listed value no
    longer exists in the pinned contract (stale or invented values).
  - It prints every contract value that is not listed as a warning. At runtime such a value falls
    back to the generic label: `auditLog.unknown`, `problem.status.<status>` then
    `problem.generic`, or `validation.invalid`.
  - Every other enumeration of R27 rule 3, and every enumeration this feature introduces into the
    UI (`BulkItemOutcome`, the five `DomainCreationReport` step enumerations, `DomainRateLimit.frame`,
    `DomainSort`, `DomainTemplateSort`), stays fully required: every value needs a key.
  - The manifest is seeded with the values that existed at UI 001's pin (`293b7c2`), so UI 001's
    coverage is unchanged, plus the values of [data-model.md §8](./data-model.md#8-translations).
    Each later UI feature appends the values it translates.
- **Rationale**: `docs/conventions.md` says that each feature adds labels for its own audit event
  types and that unknown event types show a generic label, and constitution VIII says to build only
  what the current feature needs. The manifest keeps the gate mechanical: it is checked against
  the generated enumeration arrays in both directions, so it can never name a value the contract
  does not have. It is a list of translated values, not an API type (constitution I).
- **Alternatives considered**:
  - Translating every value now (about 425 values in three locales): rejected. It front-loads the
    wording of ten other features without their screens, and conventions assign it to them.
  - Deriving the required set from the operations a feature uses: rejected. The shared
    enumerations are reachable from `listAuditEvents` and `FieldViolation`, so the derived set is
    still everything.
  - Dropping rule 3 for these enumerations: rejected. Nothing would then guarantee that a
    delivered feature's values are translated.

### D3. One feature folder for domains, templates and footers

- **Decision**: All screens of this feature live in `src/features/domains/`, with templates under
  `pages/Template*.vue` and `components/templates/`. The form fields that domains and templates
  share (quotas, limits, relay options, tags, rate limit, DKIM) live in
  `src/features/domains/components/fields/`. `index.ts` exports only the routes.
- **Rationale**: Templates hold the same values as domains and use the same field rules (spec
  FR-051). Separate feature folders would force those fields into `src/shared/` although no other
  feature uses them yet (constitution VIII; UI 001 R3 forbids deep imports between features).
- **Alternatives considered**: `src/features/domain-templates/` as a second feature: rejected for
  the reason above. UI 003 promotes `QuotaField` and `TagSetInput` to `src/shared/` when mailbox
  quotas and tags need them.

---

## 2. Routes and addresses

### D4. Route addresses

- **Decision**: These routes replace the `placeholder-domains` route of the catalogue entry
  `domains` (full table in [data-model.md §5](./data-model.md#5-route-map)):

  | Address | Screen |
  |---|---|
  | `/domains` | domain list |
  | `/domains/-/new` | create a domain |
  | `/domains/:domain` | domain page |
  | `/domains/:domain/footer` | footer editor |
  | `/domain-templates` | template list (new catalogue entry `domainTemplates`) |
  | `/domain-templates/new` | create a template |
  | `/domain-templates/:templateId(\d+)` | template page |

  - **`/-/` separator**: single-label domain names such as `new` or `localdomain` are valid
    (API 002 edge case), so `/domains/new` could shadow a domain. A domain label cannot start with
    `-`, so `/domains/-/new` can never collide. GitLab uses the same `/-/` separator for the same
    reason. Template IDs are integers, so `/domain-templates/new` cannot collide.
  - **`:domain`** is the ASCII name (`Domain.name`) in every link the app builds. A Unicode or
    upper-case address typed by hand still works, because the API normalises the path parameter
    (`DomainName` parameter). The page then replaces the address with the ASCII name, so that one
    domain has one canonical address.
  - **Admin-only routes**: `domain-create` belongs to the `domains` entry, which domain
    administrators may use. Its route carries `meta.roles: ['admin']`. `ShellLayout` renders
    `NoAccessState` when the role is not listed, exactly as for a catalogue denial (UI 001 R19,
    US2-AS7). This is a small extension of UI 001's access check.
  - **Section editing** uses the query parameter `edit=<section>` on the domain and template pages.
    **Creation steps** on small screens use `step=<1–5>`. Back therefore closes a section form or
    returns to the previous step, as phone users expect. A reload with an open section shows it
    again with the saved values. A reload of the create page at a step after 1 normalises to step 1
    with `router.replace`, because entered values are never stored (FR-028).
- **Rationale**: Every screen of FR-004 gets a bookmarkable address, and no domain name can be
  unreachable.
- **Alternatives considered**: `/domains/new` (collides with a domain named `new`);
  `/new-domain` outside the catalogue path (breaks UI 001's rule that a feature's routes live
  under its entry's path); section forms as dialogs (Back would leave the domain page).

### D5. Catalogue changes

- **Decision**:
  - US1 sets the `domains` entry to `available`.
  - US6 adds the entry `domainTemplates` directly after `domains`: path `/domain-templates`, label
    `nav.domainTemplates`, access `{ admin: true, domainAdmin: false, mailboxUser: false }`,
    `deliveredBy: '002'`, `status: 'available'`, classic link `/admin/mailbox`, and a new icon in
    `src/shared/icons/`.
  - UI 001's visibility test table gains the new row.
- **Rationale**: FR-049 requires templates in the navigation, and the catalogue is the single
  source of navigation and access (UI 001 R19, SC-007). The entry is added together with its
  routes, so it never leads to "not found".

---

## 3. Server state

### D6. Query keys, freshness and seeding

- **Decision**:
  - The key roots are `['domains', …]` and `['domain-templates', …]` (full table in
    [data-model.md §3](./data-model.md#3-server-state-cache)). Tags, footers, previews and
    capabilities sit under `['domains', …]`, so that one prefix invalidates everything that
    depends on domains.
  - **Capabilities** (`getDomainsCapabilities`): `staleTime` 5 minutes. They are read by every
    screen that needs a limit or a server setting (conventions "Where features meet": never
    hard-coded).
  - **Detail seeded from the list**: list entries carry the full representation and the same
    version tag as a single read (API 002 FR-015). `getDomain` therefore uses `initialData` from
    a cached list entry, with `initialDataUpdatedAt` set to that list's `dataUpdatedAt`. Opening a
    domain from the list renders at once, and refetches only when stale (constitution VII).
  - **Deletion preview**: `staleTime: 0` and `gcTime: 0`. It is fetched each time a deletion is
    started, because it must show the current state.
  - **Footer** on the domain page: the footer summary of FR-015 needs `getDomainFooter`, because
    the domain representation has no footer summary (plan, API observation O1). The same cache
    entry opens the footer editor at once.
  - **Mutations** patch the caches they can and invalidate the rest (data-model §3). Lists are
    invalidated with TanStack's default `refetchType: 'active'`, so an inactive list refetches on
    return while it shows its cached data. That keeps FR-013's "previous results at once" and
    FR-079's "new values" together.
  - Every domain, template and footer mutation also invalidates `['audit-events']`, so the History
    screen shows the new record.
- **Rationale**: Constitution VII and FR-079.
- **Alternatives considered**: a `staleTime` of `Infinity` for capabilities: rejected, because the
  operator can change the tagging limit or the groupware state, and the API re-reads them on every
  request.

### D7. Creation report handoff

- **Decision**: After `createDomain` answers `201`, the app writes the domain (without
  `creationReport`) to `['domains', 'detail', name]` and the report to
  `['domains', 'creation-report', name]`, then calls `router.replace` to the domain page. The page
  takes the report from the cache into local state, removes the cache entry, and shows it until it
  is dismissed or the page is left (FR-026).
- **Rationale**: The report is server data, so it belongs in the query cache (constitution
  "Stack"). `queryClient.clear()` at sign-out discards it with everything else. `replace` keeps
  Back from returning to a filled create form.
- **Alternatives considered**: router `history.state` (rejected: Forward would show the report
  again); a module-level variable or a Pinia store (rejected: client state for server data).

---

## 4. Lists

### D8. Domain list state, filters and layout

- **Decision**:
  - `src/features/domains/list-state.ts` is a `useListState` schema (UI 001 R20). Its parameters
    are in [data-model.md §5](./data-model.md#address-parameters-of-the-lists). The relay filter
    maps to the contract's `backupMx` ("relay this domain"), which every relay domain has after
    normalisation. The tag filter maps to the repeated `tag` parameter (any tag, whole-tag match).
  - **Search** is debounced by 300 ms and written with `router.replace` (UI 001 R20, typing). The
    API searches the ASCII name, the readable name, the description and the tags, so both forms of
    an internationalised name are found (US1-AS4) without client-side conversion.
  - **Tag filter and tag suggestions**: `TagSetInput` (D13) is used in filter mode, with
    suggestions from `listDomainTags` (`q` debounced by 300 ms, `limit` 25, `sort=name`). A tag
    chip on a card or row is a button that adds its tag to the filter (FR-010).
  - **Layout**: `DomainCard` below `md`, `DomainTable` from `md` up (UI 001 R21). The values of
    FR-007 that are not columns sit in `DomainEntryDetails`, revealed by a disclosure button per
    entry (Reka `Collapsible`, `aria-expanded`).
  - **Sorting**: a native `<select>` of all 15 sort keys plus an order toggle, on every width.
    From `md` up, the visible sortable columns also sort from their headers, with `aria-sort`.
  - **Result count**: announced politely after a search or filter change (FR-073).
  - **Pagination**: UI 001's `PaginationBar`. If it lacks first and last page actions or the
    "page n of m" text that FR-005 requires, US1 extends it.
- **Rationale**: FR-005 to FR-014, with every filter and sort key mapped one to one to the
  contract's `listDomains` parameters.

### D9. Scroll restoration on return

- **Decision**: `src/app/router/index.ts` gets a `scrollBehavior` that returns `savedPosition` on
  history navigation and the top otherwise. `src/app/router/focus.ts` focuses the `<h1>` with
  `{ preventScroll: true }` when a saved position is restored. If the shell's scroll container is
  not the window, the restoration targets that container, with positions kept in memory per
  history entry.
- **Rationale**: FR-013 requires the previous results and scroll position at once. UI 001's focus
  move to the `<h1>` would otherwise scroll to the top.
- **Alternatives considered**: `<KeepAlive>` on the list page: rejected. The cached query and the
  saved position already restore the view, and keep-alive would hold stale component state.

### D10. Usage pairs

- **Decision**: `src/features/domains/usage.ts` returns a level for a used value and a limit:
  `ok`, `nearlyFull` (at least 90 % of the limit and not above it) or `over` (above the limit). A
  limit of 0 counts as full: 0 of 0 is `nearlyFull`, anything above is `over`. `UsageMeter.vue`
  renders the text ("8 of 10", "9.5 GiB of 10 GiB"), a bar whose width is a dynamic `:style`
  binding (CSSOM, allowed by UI 001 R18), and for `nearlyFull` and `over` an icon plus a text label
  ("nearly full", "over the limit"). The bar is `aria-hidden`, and the text is the accessible
  equivalent (FR-076).
- **Rationale**: FR-008, the edge cases "usage already above a limit" and "explicit zero limits".

---

## 5. Forms

### D11. Section editing and outdated saves

- **Decision**:
  - **`EditableSection.vue`** (`src/shared/components/`, reserved by UI 001 R20). Its props are a
    section ID, a heading, whether it is editable, and the read-only and form slots. It has an Edit
    button only when editable (FR-029). The parent drives editing through the `edit` query
    parameter (D4). Only one section edits at a time, and the other Edit buttons are disabled with
    a reason while one is open.
    - Below `md`, the open section replaces the page content with its own heading (focused,
      FR-075) and a sticky action bar with Save and Cancel (FR-069).
    - From `md` up, the section opens in place.
    - Its status messages are inline and stay until the next action (FR-067). No toast
      disappears on its own.
  - **`useVersionedSave` extension** (UI 001 R20): `changedSince(base, latest, fields)` returns the
    fields whose saved value changed between the version the form was opened with and the reloaded
    one, with their new saved values. On `412`, the form keeps the input, marks those fields with
    their new saved value, and offers "Save again" and "Discard my changes" (FR-037). "Save again"
    sends the fields that differ from the reloaded version, with the reloaded version tag. "Discard"
    resets the form to the reloaded values. Nothing is merged or sent on its own.
  - **Changed values only** (FR-030, FR-054): `src/features/domains/patch.ts` builds a JSON Merge
    Patch of the section's fields whose form value differs from the value the form was opened with.
    Tags are compared as sets that ignore letter case, and the whole set is sent when it changed.
    Quotas are compared in bytes. Read-only members are never sent.
  - **Permission refusals** (FR-003, US3-AS8): `403 attribute-not-permitted` refetches `identity`
    and the domain, shows the translated reason naming each attribute of the problem's
    `attributes`, turns those fields read-only in the open form, and keeps the other input. When no
    editable field remains, the form offers only Close.
  - **Deactivation** in the General section asks one explicit confirmation that names the effect
    on every mailbox of the domain (conventions "Confirmations": deactivating is high-risk).
- **Rationale**: The spec's clarifications on section editing and outdated saves, and the
  conventions "Editing and conflicts". Two concrete uses in this feature, domain and template pages,
  justify the shared component (constitution VIII).
- **Alternatives considered**: one long edit form, as in legacy (rejected by the spec's
  clarification); automatic merging of non-conflicting fields (forbidden by the conventions).

### D12. Quotas, limits and numbers

- **Decision**:
  - `src/features/domains/quota.ts` converts between bytes and an amount plus a unit of MiB, GiB or
    TiB. A stored value is shown in the largest unit that represents it exactly (10,737,418,240
    bytes is 10 GiB; 3,145,728,000 bytes is 3,000 MiB, FR-032).
  - **Parsing** accepts digits with at most one decimal separator, `.` or `,`, so the Czech and
    Slovak keypads work. It rejects grouping characters. The result must be a whole multiple of
    `capabilities.quotaUnit` (1 MiB), at least one unit, and at most 9,007,199,254,740,992 bytes,
    the contract's maximum.
  - **Fields**: quotas use `inputmode="decimal"` with a native unit `<select>`. Limits use
    `inputmode="numeric"`, `pattern="[0-9]*"`, and whole numbers from 0 to 2,147,483,647 (FR-070).
  - **Client rules before sending** (FR-031, FR-032):
    - default mailbox quota ≤ maximum mailbox quota ≤ domain quota;
    - on an edit, a **changed** mailbox limit ≥ `usage.mailboxes`, alias limit ≥ `usage.aliases`,
      domain quota ≥ `usage.quotaAllocated`, and maximum mailbox quota ≥
      `usage.largestMailboxQuota`;
    - an unchanged limit is not checked, as the API does, so other settings stay savable when usage
      is already above a limit.
  - **Sizes** are formatted by a new `formatBytes(bytes, { exact })` in `src/i18n/format.ts`.
    `exact` picks the largest exact unit, for limits and quotas. Otherwise it rounds to one
    decimal, for storage. Binary units are labelled MiB, GiB and TiB, and numbers are
    locale-formatted (FR-016).
- **Rationale**: The spec's clarification on quota units, and API 002 FR-008, FR-009 and FR-033.
  `usage.largestMailboxQuota` closes the spec's former API gap 4, so the maximum mailbox quota rule
  is now checked before sending too.

### D13. Tag sets

- **Decision**: `TagSetInput.vue` (`src/features/domains/components/fields/`) edits a set:
  - a tag is added with Enter, a comma or an Add button, and removed with its own labelled button;
  - tags are trimmed, empty ones ignored, ones longer than `capabilities.maxTagLength` refused, and
    case-only duplicates kept once with the first spelling (`src/features/domains/tag-set.ts`);
  - optional suggestions are shown in a Reka `Combobox` without `ComboboxViewport` (UI 001 R18),
    with a plain scrollable list.

  It serves the domain tags (detail page, creation, templates), the list's tag filter, and the two
  footer exclusion sets (without suggestions). The tagging limit comes from
  `capabilities.taggingLimit`. A save is refused before sending when the new set is above the limit
  and not smaller than the stored set. A domain that already has more tags can still shrink (spec
  edge case, API `DomainTagList`).
- **Rationale**: FR-039, FR-040 and FR-058. The capabilities and the distinct tag list close the
  spec's former API gaps 2 and 7.

### D14. Relay options

- **Decision**: `src/features/domains/relay.ts` exports `applyRelayChange(current, option, on)`,
  which implements FR-033 exactly:
  - "relay non-existing mailboxes only" on turns on the other two;
  - "relay all recipients" on turns on "relay this domain";
  - "relay this domain" off turns off the other two;
  - "relay all recipients" off turns off "relay non-existing mailboxes only".

  It also exports `relayBadge(domain)`, which returns `relayUnknownOnly`, `relayAllRecipients`,
  `relay` or `null` for the list badge (FR-006). `RelayOptionsField.vue` announces each automatic
  change politely and shows the legacy explanations (D20).
- **Rationale**: FR-033 and API 002 FR-021. The API normalises the same way, so the saved values
  always equal what the form showed.

### D15. Domain names

- **Decision**: `src/features/domains/domain-name.ts`:
  - `toAsciiDomain(input)` trims, then uses the WHATWG URL host parser
    (`new URL('http://' + input + '/').hostname`). The parser applies UTS #46 and lower-cases, as
    API 002 FR-006 does. It returns `null` on a parse error.
  - `isValidDomainName(input)` checks the ASCII form: labels of letters, digits and inner hyphens,
    1–63 characters each, separated by dots, at most 253 characters in total (FR-020). A
    single-label name is valid, as in the API.
  - `matchesTypedName(typed, domain)` accepts the readable or the ASCII name, ignoring letter case,
    for the deletion confirmation (FR-042).
  - The name field uses `autocapitalize="none"`, `autocorrect="off"`, `spellcheck="false"` and
    `inputmode="url"` (FR-070).
- **Rationale**: Every supported browser implements the URL standard's IDNA processing, so no
  punycode library is needed (constitution VIII). The API remains the authority, with
  `invalidFormat` (`format: domainName`), `reserved` (the server's host name) and
  `409 domain-exists`.
- **Alternatives considered**: the `punycode` package (deprecated in Node and an extra
  dependency); no client check (FR-020 requires one).

### D16. Creation form and creation report

- **Decision**:
  - **Model** (`src/features/domains/create-form.ts`): the form values of
    [data-model.md §4](./data-model.md#4-form-models), filled from the selected template, or from
    the documented built-in values when no template exists (spec edge case, D18).
    - The template `<select>` lists the templates of
      `listDomainTemplates?sort=name&limit=<capabilities.maxPageSize>`, with Default
      (`isDefault`) preselected.
    - Choosing another template after the user changed a field asks before replacing the values
      (FR-019), through UI 001's `useConfirm`.
  - **Payload**: `toCreateRequest()` sends `templateId` (when a template is selected) and every
    value shown in the review, so the domain is created with exactly those values (FR-023). That
    includes the template's values, because the review promises them.
    - **DKIM**: with the switch off, it sends `dkimSelector: ""` ("no DKIM key"). With the switch
      on and an empty selector, it sends `capabilities.dkim.defaultSelector`. The field names that
      default (FR-021, D19).
    - **Rate limit**: "none" sends `rateLimit: null`, which overrides the template.
    - **Groupware**: when `capabilities.groupwareEnabled` is false, the Global Address List flag and
      the restart switch are hidden and not sent, as legacy does (API `DomainCapabilities`).
  - **Steps** (`useStepper`, feature-local): below `md`, five steps with "Step n of 5", Back and
    Next in a sticky bar, and "Review" reachable once the name is valid. From `md` up, all sections
    are on one page with an in-page section index whose Review link is enabled once the name is
    valid (FR-018). Moving to a step focuses its heading (FR-075).
  - **Errors** (FR-027): field errors map to fields through `useProblemForm` (UI 001). A
    `fieldStep` table maps each field path to its step, so the step with the first error opens.
    `409 domain-exists` is shown on the name field (US2-AS3). A `notFound` on `templateId` is shown
    on the template field (spec edge case).
  - **Leaving** with entered values asks for confirmation (FR-028, `useLeaveGuard`, D21). The
    guard is disarmed after success.
  - **Report** (`CreationReport.vue`): one line per step, in the order rate limit, DKIM key, DKIM
    DNS publication, groupware directory update, groupware restart. Outcomes are classed as:
    - **done**: `applied`, `created`, `published`, `done`;
    - **neutral information**: `notRequested`, `alreadyExisted`, `notConfigured`, `skipped`,
      `noZone`, `groupwareDisabled`;
    - **warning**: `failed`, with a text that says what it means for the domain.

    `noZone` is neutral: the DKIM key exists and signs mail, but the record must be published at
    the domain's own DNS provider (UI 010). The English `messages` member is never shown (FR-064).
    The report is announced politely as one summary sentence and stays until dismissed (FR-026).
- **Rationale**: FR-018 to FR-028 and the spec's clarifications on the stepper and the restart.
  The capabilities close the spec's former API gaps 1 and 8.

### D17. Footer editor

- **Decision**:
  - The editor has two set fields, "Excluded addresses" and "Excluded alias domains". They map one
    to one to the contract's `excludedAddresses` and `excludedAliasDomains`, so a refused entry
    (`notFound` at `excludedAddresses.2`) marks exactly that chip (FR-058).
  - Exclusions are trimmed, and case-only duplicates are kept once. The API stores them
    lower-cased.
  - The HTML and plain texts are `<textarea>` source fields with `spellcheck="false"` and
    `autocapitalize="none"`. The HTML is never rendered (FR-059). The app's own `SanitizedHtml` is
    not used for it.
  - **Size**: `new TextEncoder().encode(text).length` against `capabilities.footerTextMaxBytes`.
    From 90 % of the limit, a size indicator shows "x of 1 MiB". Above the limit, saving is blocked
    with the limit stated (FR-060).
  - **Placeholders**: `PlaceholderReference.vue` lists `{= auth_user =}`, `{= from_user =}`,
    `{= from_name =}`, `{= from_addr =}`, `{= from_domain =}` and the custom attribute form
    `{= attribute =}`, each with a translated description and a copy button through UI 001's
    `clipboard.ts` (FR-057).
  - Saving sends the whole footer (`replaceDomainFooter`) with `If-Match`, and an outdated version
    is handled as in D11 (FR-061). Empty texts without exclusions are allowed, and the editor says
    that no footer is then added.
- **Rationale**: FR-057 to FR-062 and the contract's `DomainFooterReplace`. The exclusion picker
  stays out of scope: API 002 points to the mailbox and alias lists of features 003 and 004, so UI
  003 and UI 004 add it to this editor as their entry point.
- **Alternatives considered**: one combined exclusion field split by the presence of `@`: rejected,
  because error positions would have to be translated back between two arrays.

### D18. Documented default values

- **Decision**: `src/features/domains/defaults.ts` holds the documented legacy defaults: 10
  mailboxes, 400 aliases, 3,072 MiB default mailbox quota, 10,240 MiB maximum mailbox quota,
  10,240 MiB domain quota, active, Global Address List on, no relay options, no tags and no rate
  limit. They are used for a new template (FR-052) and for a creation without any template (spec
  edge case). The DKIM key size comes from `capabilities.dkim.defaultKeySize`, and the selector
  hint from `capabilities.dkim.defaultSelector`. A unit test asserts that every value appears in
  the descriptions of `DomainTemplateCreateRequest` and `DomainCreateRequest` in
  `contract/openapi.json`, so a contract change cannot leave them stale. This follows UI 001's
  `limits.ts` pattern.
- **Rationale**: The spec requires these starting values, but the contract states them only in
  prose. Reported as API observation O2.

### D19. DKIM fields

- **Decision**: `DkimFields.vue` has a "Generate a DKIM key" switch, a selector field and a
  key-size `<select>` of `capabilities.dkim.allowedKeySizes`.
  - The selector accepts `^[A-Za-z0-9._-]*$` and at most 255 characters, with
    `autocapitalize="none"`.
  - With the switch on and the field empty, its hint names the server's default selector from the
    capabilities.
  - With the switch off, the selector and key size are hidden and the request sends `""`.
  - On a template, an empty selector at creation is omitted, so that the API stores the server's
    default selector. On a template edit it is sent as `capabilities.dkim.defaultSelector`, because
    an empty string means "no DKIM key" (`DomainTemplate.dkimSelector`).
- **Rationale**: FR-021 and FR-052, aligned with the contract, where an empty selector means "no
  DKIM key" and an omitted one means the template's or the server's default.

---

## 6. Destructive and bulk actions

### D20. Deleting one domain

- **Decision** (`useDomainDeletion`):
  1. The Delete action is unavailable with its reason when `usage.mailboxes + usage.resources > 0`.
     The reason names both counts (FR-041, now including resources).
  2. Delete fetches `previewDomainDeletion`. When `allowed` is false (the domain gained a mailbox
     since it was loaded), a dialog lists the blockers with their counts and up to 100 addresses,
     and offers no deletion (US4-AS3).
  3. Otherwise, `useConfirm` opens the confirmation (extended in this feature) with
     `DeleteImpact.vue` as its content and `requireTyped` set to the readable and ASCII names,
     ignoring letter case. The impact lists:
     - the readable and ASCII names;
     - the alias domains that will be removed, by name;
     - the number of aliases, with up to 100 addresses behind a disclosure;
     - whether a footer is removed;
     - that the tags and the stored data are removed;
     - the assigned domain administrators (from `domainAdmins`) and, by name, the accounts that will
       be deleted with them (`domainAdminsToDelete`);
     - whether a DKIM key exists, which is kept (FR-042).
  4. Confirming sends `deleteDomain` with `If-Match` set to the preview's `etag`.
     - `204`: remove the detail, footer and preview caches; invalidate lists and tags; go to the
       list; announce the deletion (FR-044).
     - `412`: fetch a new preview and confirm again, with a notice that the domain changed (FR-043,
       conventions).
     - `409 domain-not-empty`: show the remaining mailboxes and resources.
     - `404`: say the domain no longer exists, invalidate the lists, go to the list.
     - `503 temporary-failure`: say nothing was changed and offer a retry.
- **Rationale**: Conventions "Confirmations" ("using the API's delete preview where one exists",
  "Deleting one domain needs its name typed"). The preview closes the spec's former API gaps 3 and
  5.

### D21. Leaving forms and running actions

- **Decision**: `useLeaveGuard(shouldGuard, messageKey)` (`src/shared/composables/`) registers
  `onBeforeRouteLeave`, `onBeforeRouteUpdate` (only when the path changes, so `edit` and `step`
  changes are handled by the page) and a `beforeunload` listener while `shouldGuard` is true. It
  asks through `useConfirm`. It is used by the create pages, open sections, the footer editor and
  running bulk actions (FR-028, FR-038, FR-048, FR-062).
- **Rationale**: Five uses in this feature (constitution VIII). UI 001's `ApiKeyCreatePage` keeps
  its own single-use guard.

### D22. Bulk actions on domains

- **Decision**:
  - **Selection** (`useBulkSelection`, `src/shared/composables/`, reserved by UI 001 R20): an
    explicit selection mode on every width, entered with a "Select" button (conventions "Bulk
    actions").
    - Cards get a 44 × 44 px checkbox, and the table gets a checkbox column with "select all on
      this page".
    - `BulkActionBar.vue` (`src/shared/components/`, used by the domain and template lists) names
      the number selected and the actions (FR-045, US5-AS4).
    - The selection holds names and is cleared through `useListState`'s `onReset` when the page,
      search, filters, sort or page size change.
    - A selection larger than `capabilities.bulkLimit` disables the actions with the limit stated.
  - **Request**: one `applyDomainBulkAction` with `targets` built by `toBulkTargets()` in
    `src/features/domains/bulk.ts`: `{ id: name, version }`, where `version` is the list entry's
    `etag` without its surrounding quotes, as `BulkTarget.version` requires. Domains with mailboxes
    or resources are left out of a deletion and listed as skipped (FR-047).
  - **Confirmation**:
    - Activation: none.
    - Deactivation: one explicit confirmation that lists the domains and the effect on their
      mailboxes (FR-045).
    - Deletion: lists every domain to be deleted with its impact from the list data (aliases and
      alias domains to be removed, assigned domain administrators, the rule for administrators left
      without a domain, footer, tags and stored data removed, DKIM key kept), lists the skipped ones,
      and requires the **number** of domains to be typed (conventions "Confirmations").
  - **Progress and results**: while the single request runs, an indeterminate progress indicator
    says "Processing n domains" and is announced. `BulkResultSummary.vue` (`src/shared/components/`,
    reserved by UI 001 R20) then shows one row per domain: done, not found, refused, outdated or
    failed, each with its translated problem, plus skipped. The summary counts are announced.
  - **Retry**: failed, refused and outdated domains stay selected. "Retry" sends exactly those,
    with the version tags of the refreshed list.
  - **Connection lost**: every domain of the request is reported as "outcome unknown", nothing is
    retried automatically, the selection is cleared, and the user can refresh the list.
  - **Leaving** while the request runs warns that its result will not be shown. The API keeps
    processing.
  - **Caches**: lists and tags are invalidated, the detail caches of deleted domains removed, and
    those of changed domains invalidated.
- **Rationale**: Conventions "Bulk actions" and API 002 FR-062/FR-063, which replaced the "no batch
  operation" premise of the spec's earlier clarification. The spec was aligned
  ([plan.md](./plan.md#spec-alignment)).
- **Alternatives considered**: one request per domain, as the earlier clarification said: rejected.
  It ignores the contract's bulk operation and its per-item version checks, and conventions require
  the bulk operation.

### D23. Deleting several templates

- **Decision**: The API has no bulk operation for templates and says that each is deleted with its
  own request (API 002 FR-062). `useTemplateBulkDelete` therefore sends one `deleteDomainTemplate`
  per selected template, one after another:
  - each request carries `If-Match` with the list entry's `etag`;
  - the run continues after failures and shows determinate progress ("3 of 5");
  - the results map to the same `BulkResultSummary` rows;
  - a network failure marks that template "outcome unknown" and the rest "not processed", and stops
    the run;
  - leaving while it runs warns that the remaining templates will not be processed.

  The Default template is never selectable (FR-055). The confirmation names the templates, says
  that domains created from them keep their values, and requires the number to be typed
  (conventions).
- **Rationale**: FR-055 keeps multi-deletion. Single deletions are what the contract offers for
  templates, so this is the contract's own path and not a workaround (constitution I).

---

## 7. Permissions, errors and history

### D24. Permission matrix

- **Decision**: `src/features/domains/permissions.ts` exports `domainPermissions(identity)`, a pure
  function that returns the matrix of FR-002:
  - `canCreate`, `canDelete`, `canBulk` and `canManageTemplates` for administrators only;
  - `canSeeDomainAdmins` from `role === 'admin'`;
  - `editable`, the set of patchable attributes: all twelve for administrators;
    `globalAddressList` and `tags` for domain administrators, plus `description` when
    `permissions.domainDesc` is set.

  The History link uses UI 001's `canAccess('auditLog', identity)`. Controls outside the matrix are
  absent, or shown read-only as text (never as disabled inputs, FR-029). A table-driven unit test
  covers the three permission profiles of SC-005.
- **Rationale**: Hiding is a convenience (constitution V). The API enforces the same matrix.

### D25. Problem translation additions

- **Decision**: `src/i18n/problems.ts` (UI 001 R15) gains:
  - **parameter formatting by field kind**: `useProblemForm` takes a field-kind map. For a `size`
    field, `inUse`, `value`, `min` and `max` are formatted with `formatBytes`. `tooLong` with
    `unit: bytes` formats `max` as a size (FR-065);
  - **`mustNotExceed`**: `field` is rendered as that field's translated label, through the form's
    label map;
  - **new formats**: `validation.format.domainName`, `validation.format.dkimSelector` and
    `validation.format.email`;
  - **new rule codes**: `immutable`, `notMultipleOf` (`factor` as a size), `mustNotExceed`,
    `belowInUse` (`inUse`) and `reserved`;
  - **problem types**: `problem.domain-exists`, `problem.domain-not-empty` (with the `mailboxes` and
    `resources` members), `problem.domain-template-name-exists`,
    `problem.domain-template-protected`, `problem.attribute-not-permitted` (with the translated
    attribute labels) and `problem.temporary-failure`;
  - **problem types mapped to fields**: `domain-exists` to `name`, and
    `domain-template-name-exists` to the template's `name` (US2-AS3, US6-AS2).
- **Rationale**: FR-064 and FR-065, and constitution I (errors are handled from problem details).

### D26. History

- **Decision**:
  - `HistoryLink.vue` (`src/shared/components/`, reserved by UI 001 R20) links to the `audit-log`
    route with `targetType` and `targetId`.
  - The domain page links with `targetId=<ASCII name>` and no `targetType`. The API then returns
    the records of the domain and of its footer, and tag changes are part of `domainUpdate`
    (FR-063).
  - The template page links with `targetType=domainTemplate&targetId=<id>`.
  - The API key detail page of UI 001 gains its History link
    (`targetType=apiKey&targetId=<id>`), as UI 001 R20 assigned to this contract bump.
  - The audit log's `useListState` schema gains `targetType` (an `AuditTarget.type` value) and
    `targetId` (≤ 255 characters).
  - `AuditFilters` gains a target type `<select>` (the types that have a translation) and a target
    field. `ActiveFilterChips` shows both.
  - The audit labels gain the event types `domainCreation`, `domainUpdate`, `domainDeletion`,
    `domainFooterUpdate`, `domainTemplateCreation`, `domainTemplateUpdate` and
    `domainTemplateDeletion`, the targets `domain`, `domainTemplate` and `domainFooter`, and the
    failure reasons `attributeNotPermitted`, `versionOutdated`, `validationFailed`, `conflict` and
    `temporaryFailure`.
  - **Details**: `AuditEvent.details` is an open object in the contract. The members that API 002
    writes for domain records (`changes`, `values`, `creationReport`, `removedAliasDomains`,
    `removedDomainAdmins`, `footerRemoved`, `maildirCleanup`) are described only in the API's data
    model. Until the contract describes them (plan API gap G1), the history shows them through UI
    001's generic details view, as stored, without unit formatting or translated step outcomes. The
    typed presentation of FR-063 follows with the contract bump that closes G1.
- **Rationale**: Constitution I forbids hand-written types for API data, so the UI cannot rely on
  an undocumented `details` shape.
- **Alternatives considered**: typing `details` from the API's data model by hand: rejected
  (constitution I).

---

## 8. Translations, mock, smoke and performance

### D27. Legacy key reuse with markup stripping

- **Decision**:
  - `src/i18n/legacy-map.json` reuses the legacy keys whose meaning is unchanged
    ([data-model.md §8](./data-model.md#8-translations)).
  - The spec says that legacy texts with markup are carried over without it. So
    `scripts/i18n/import-legacy.mjs` accepts an object form for an entry,
    `{ "from": "edit.gal_info", "stripMarkup": true }`. That entry's value is converted as follows:
    - tags are removed, with `<br>` becoming a space;
    - the entities `&lt; &gt; &amp; &quot; &#39;` are decoded;
    - the leading `↪ ` is stripped;
    - whitespace is collapsed;
    - the result must contain no `<` or `>`.

    The plain string form keeps refusing HTML.
  - It is used for `edit.gal_info`, `edit.relay_all_info` and `edit.domain_footer_info`.
  - Labels whose meaning changes get new keys, for example the MiB-only labels "Max. quota per
    mailbox (MiB)", which become unit-aware. So do the footer placeholder descriptions, whose legacy
    values embed the token and column padding.
  - Keys missing in the upstream `sk-sk` file (`mailbox.relay_unknown`,
    `edit.domain_footer_skip_replies`, `edit.footer_exclude`) get Slovak values in
    `src/i18n/messages/sk-sk.json`, as UI 001 R15 prescribes.
- **Rationale**: Constitution IV and spec FR-077.

### D28. Mock API additions

- **Decision**:
  - The handlers `tests/mocks/handlers/domains.ts` and `tests/mocks/handlers/domain-templates.ts`
    implement the contract's documented behaviour on the scenario state:
    - scope;
    - name normalisation with `node:url` `domainToASCII` and `domainToUnicode`;
    - search, filters, sort with ties broken by name, and paging;
    - template pre-fill and built-in values;
    - relay normalisation;
    - the field rules with their codes and parameters;
    - `If-Match` and `412`;
    - `attribute-not-permitted`;
    - `domain-exists`, `domain-not-empty`, `domain-template-name-exists` and
      `domain-template-protected`;
    - the deletion preview;
    - footer exclusion checks by position;
    - per-item bulk outcomes with version checks.
  - The audit handler gains the target filters.
  - **Control endpoint**: `PATCH /__mock/scenarios/:id` gains `domains`, `templates` and `footers`
    mutations. They change, add or remove objects behind the app's back, standing in for another
    administrator or the classic interface, so that every version tag changes. They also switch
    capabilities (groupware, tagging limit) and inject failures by domain name, for example
    `temporary-failure` for two bulk targets.
  - **Creation report**: scenarios set the outcome of each follow-up step, for example a failed
    restart or an existing DKIM key.
  - Every response is still validated against the contract (UI 001 R22).
- **Rationale**: Constitution VI, with mocks that cannot return what the API never would.

### D29. Smoke suite additions

- **Decision**: These run against the API 002 dev stack (UI 001 R25), whose `DevelopmentSeeder`
  creates `example.org` and `example.net` (managed by `reseller`), the Default template and
  `alice@example.org`. There is one smoke spec per user story, tagged `@domains`, or
  `@domain-templates` for templates, so each story's smoke test can be written and run on its own:
  - `domains-browse`: the list and domain page as `admin` and as `reseller`;
  - `domains-create`: create `smoke-<timestamp>.example` with only its name and read the report;
  - `domains-edit`: limits, tags and relay options as `admin`; the Global Address List flag as
    `reseller`, with Limits read-only;
  - `domains-delete`: `example.org` blocked by alice's mailbox; a smoke domain deleted with its
    name typed;
  - `domains-bulk`: two smoke domains deactivated, activated and deleted in bulk;
  - `domains-footer`: a footer saved on `example.org` and restored;
  - `domains-history`: a smoke domain's history lists its creation and edit;
  - `domain-templates`: create, edit and delete `Smoke-<timestamp>`; the Default template has a
    read-only name and no delete action.

  `tests/smoke/fixtures/domains-api.ts` creates and removes the objects a smoke test needs
  through the real API, with the test's session and CSRF token. That is test code, never app code.
  Created objects use unique names and are always removed.
- **Rationale**: Constitution VI's smoke layer against a real API.

### D30. Performance

- **Decision**:
  - The domain routes and the template routes are separate lazy chunks: list, create, detail,
    footer, template list, template create and template page.
  - The initial JavaScript is unchanged. `budget:check` prints the new chunks.
  - `scripts/run-lhci.mjs` gains a third collection, `/ng/domains` with
    `MOCK_DEFAULT_SCENARIO=domains-60`, asserted like the others (SC-010, constitution VII).
- **Rationale**: Constitution VII and SC-010.
