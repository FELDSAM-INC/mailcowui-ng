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
- **i18n** (constitution IV 1.3.0, "Translations and forms" below): the screens mirror the legacy
  alias, alias domain, resource and sender-permission forms. Their texts are mailcow's own
  translations, used verbatim by legacy key through UI 001's legacy translation layer (runtime
  `/lang/` loader, `en-gb` snapshot, formatter); texts with markup go through `SanitizedHtml.vue`.
  New strings exist only where legacy has no equivalent. The feature's values are appended to the
  enumeration scope manifest of UI 002 and UI 003 (R20).

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
  shown verbatim through `SanitizedHtml.vue` (constitution IV 1.3.0, R20).
- 44 × 44 px targets. Usable at 360 px and 320 px and at 400 % zoom.
- Limits, the groupware state, the external-destination setting, the DKIM defaults and the bulk
  limit come from the capabilities read, never from constants (FR-071).
- No polling and no `refetchInterval`: data refreshes after mutations and on the user's refresh
  (conventions "Polling"). No secret passes through any request of this feature.
- Shared blocks use the canonical names of `docs/conventions.md` ("Shared building blocks and
  canonical names").

**Scale/Scope**:

- 8 user stories: 3 at P1, 3 at P2, 2 at P3.
- 10 new routes and 3 catalogue entries replacing one.
- 23 new contract operations, plus 4 reused ones.
- About 75 legacy keys used verbatim, plus only the new strings that the legacy form map lists for
  elements legacy lacks (constitution IV 1.3.0).
- Target servers have 5,000 domains and 200,000 aliases.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Gate | Status |
|---|---|---|
| I. The API contract is the only interface | The pin is a reviewed bump (`contract/VERSION.json`, regenerated types, typecheck and all tests; R1). The 23 operations of [contracts/README.md](./contracts/README.md) are called through `@/api`, with types re-exported from the generated schema. No hand-written API type. The mock validates every request and response. Four gaps are reported to mailcow-rest-v2 and not worked around (see "API dependency and gaps"). Problem `type` and `errors` drive every message (R17). | PASS |
| II. Mobile-first | Every screen is designed at 360 px first. Lists are cards below 768 px and tables above. The creation forms are full-screen pages, and section editors open full screen on phones (FR-064). Selection mode has 44 px checkboxes and a sticky action bar (FR-056). Destructive actions are confirmed with their impact, and a mass deletion needs the typed count (FR-029, FR-058). Every list and detail view has loading, empty and error states (FR-008). Pinch-zoom is untouched. | PASS |
| III. Accessibility | axe in both themes on every screen, dialog and state. Single-choice controls are Reka radio groups. Errors are linked to their fields and summarised. Saves, deletions, result counts and bulk summaries are announced. Every state shown by colour also has text (FR-063). A keyboard-only end-to-end pass covers every story (R21). | PASS |
| IV. i18n and branding | Constitution IV 1.3.0 ("Translations and forms" below): every mailcow language; the screens mirror the legacy forms; text with a legacy equivalent is mailcow's own translation, used verbatim by legacy key and loaded at runtime from the installation, with HTML through `SanitizedHtml.vue` and a missing key falling back to `en-gb`. New strings only for elements legacy lacks, in en-gb, cs-cz and sk-sk, never machine-translated. `i18n:check` fails on a missing new string or a used legacy key absent from the `en-gb` snapshot, and covers the feature's values in the enumeration scope manifest and every closed enumeration the feature renders (R20). Product names inside legacy texts are the installation's (`add.alias_address_info`). Dates and numbers use `Intl`. | PASS |
| V. Security in the browser | No new storage key. Form drafts are kept in memory only (R10), and the storage audit end-to-end test is extended. No `v-html` of its own: legacy texts with markup go through UI 001's `SanitizedHtml.vue`. Hidden controls are a convenience: `forbidden`, `permission-flag-required` and `attribute-not-permitted` refresh the identity (FR-004). 404 for objects outside the scope is shown as "not found" (FR-003). | PASS |
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
- Legacy texts with markup are rendered verbatim through `SanitizedHtml.vue`, never converted or
  rewritten (IV 1.3.0, V, R20). This supersedes the earlier plain-text import.
- The candidate labels fall back to the contract's coarser `type` until API gap G1 is closed (I).

## Translations and forms (constitution IV 1.3.0)

The owner rule of 2026-10-18 (`docs/conventions.md`, "Translations and forms") applies to every
screen of this feature. It overrides any earlier text in this plan, the spec, research, data-model,
quickstart and tasks that says otherwise.

**Legacy forms mirrored** (paths under `../mailhosting/data/web/`; page entries
`admin/mailbox.php`, `domainadmin/mailbox.php` and `edit.php`):

- **Alias list** (`/aliases`): `templates/mailbox/tab-mbox-aliases.twig` (title, hint
  `mailbox.alias_domain_alias_hint`, toggle all, quick actions activate, deactivate, remove,
  `mailbox.add_alias_expand`, `mailbox.sogo_visible_y`/`_n`, `mailbox.add_alias`);
  `js/site/mailbox.js` `draw_alias_table()` (columns alias, target address, domain, SOGo visible,
  public comment, private comment, internal, active, action; the catch-all, spam and ham badges).
- **Alias creation** (`/aliases/new`): `templates/modals/mailbox.twig` `#addAliasModal` (alias
  address with `add.alias_address_info`, target address with `add.target_address_info`, the
  mutually exclusive `add.goto_null`, `add.goto_spam`, `add.goto_ham` checkboxes that disable the
  target field, `js/site/mailbox.js`; `edit.sogo_visible`, `add.internal`, `add.sender_allowed`
  with their `*_info` texts; `add.active`; `admin.add`).
- **Alias detail** (`/aliases/:id`): `templates/edit/alias.twig` and `js/site/edit.js` (target
  address, goto checkboxes, SOGo visible, internal, allowed to send, private and public comment,
  active).
- **Alias domain list, creation and detail**: `templates/mailbox/tab-domain-aliases.twig`;
  `js/site/mailbox.js` `draw_aliasdomain_table()`; `templates/modals/mailbox.twig`
  `#addAliasDomainModal` (alias domain with `add.alias_domain_info`, target domain, active, rate
  limit with `ratelimit.disabled` as placeholder, DKIM selector and key length);
  `templates/edit/aliasdomain.twig` (target domain, active, rate limit).
- **Resource list, creation and detail**: `templates/mailbox/tab-resources.twig` (booking legend);
  `js/site/mailbox.js` `draw_resource_table()` (columns description, alias, kind, domain, multiple
  bookings badges `booking_*_short`, with " (n)" after the hard limit, active);
  `templates/modals/mailbox.twig` `#addResourceModal` (description, domain, kind, multiple
  bookings with the custom number, active); `templates/edit/resource.twig`.
- **Send as** (`/mailboxes/:address/send-as`): the "Allow to send as" and "External sender
  addresses" part of `templates/edit/mailbox.twig` (`edit.sender_acl` with the
  `edit.dont_check_sender_acl` options, `edit.sender_acl_disabled`, `edit.sender_acl_info`,
  `edit.extended_sender_acl`, `edit.extended_sender_acl_info`).
- **Messages**: `inc/functions.mailbox.inc.php` (`mailbox('add' | 'edit' | 'delete', 'alias' |
  'alias_domain' | 'resource' | 'mailbox')`): `success.alias_added` (address, ID),
  `success.alias_modified`, `success.alias_removed`, `success.aliasd_added`,
  `success.aliasd_modified`, `success.alias_domain_removed`, `success.resource_added`,
  `success.resource_modified` (legacy's own text for a resource, used as it is),
  `success.resource_removed`, `warning.is_not_primary_alias`, and the `danger.*` keys of the alias,
  alias domain, resource and sender-permission checks (for example `danger.is_alias`,
  `danger.is_spam_alias`, `danger.is_alias_or_mailbox`, `danger.targetd_relay_domain`,
  `danger.alias_goto_identical`, `danger.sender_acl_invalid`, `danger.extended_sender_acl_denied`).

**Screens or elements without a legacy counterpart** get new strings (en-gb, cs-cz and sk-sk,
never machine-translated), kept minimal: the creation report of an alias domain and the per-entry
results of multi-entry creation, the derived-address preview of a resource, the copy report over
alias domains, bulk summaries and the outdated-version handling, filter and sort controls the
legacy client-side tables lack, the read-only rate limit note, the orphaned-alias warning, the
History link and the audit labels. The kind options of a resource are hard-coded English in the
legacy template ("Location", "Group", "Thing"), so they are new strings whose English text equals
legacy's.

**Deviation-free rule**: these screens add, drop, rename, reword or reorder nothing relative to the
legacy forms above, except the conventions' improvements (sections with their own save, typed
confirmations, bulk mode, outdated-version handling). Labels, help and info texts (`*_info`),
placeholders, option labels, units, order and grouping, column headers, action labels and the
success, warning and danger messages come from the legacy keys. Every mailcow language is
supported. Legacy values are loaded at runtime from the installation and shown verbatim (HTML
through `SanitizedHtml.vue`), and a missing key falls back to `en-gb`, never to a hand-written
value. In particular the English legacy texts "Domain aliases" (`mailbox.domain_aliases`) and "Add
domain alias" (`mailbox.add_domain_alias`) are shown as they are; the spec's earlier change of
their English text to "Alias domains" is withdrawn.

### Legacy form map (T005a, 2026-10-19)

Written before any screen was built. Implementation uses only these keys plus the new strings named
here. The orchestrator's decisions of 2026-10-18 apply (docs/conventions.md "Decisions on the
deviations", "Detail pages", "Outcomes", "No confirmation legacy lacks"): legacy's controls (the
goto checkboxes, the sender multi-select, the booking select), one section per legacy form, the
detail title is legacy's edit heading with the object's name, deletion and the expand action only in
the list, outcomes as legacy's alerts, and no confirmation legacy lacks except the typed and bulk
confirmations. Legacy keys are read at runtime (`lt()`, `<LegacyText k>` for values with markup,
`legacy()` in route titles and column tables, `LEGACY_TEXTS` for keys built at runtime). Paths are
under `../mailhosting/data/web/`. In `js/site/mailbox.js` `lang.<key>` is `mailbox.<key>`.

#### Part 1: fields and elements

**Navigation** (`src/app/navigation/catalogue.ts`): `aliases` → `mailbox.aliases`, `aliasDomains` →
`mailbox.domain_aliases`, `resources` → `mailbox.resources` (the classic "Aliases" tab dropdown
entries). The `nav.aliases` new string is removed.

**Alias list** (`/aliases`) ← `templates/mailbox/tab-mbox-aliases.twig`, `draw_alias_table()`.

| Element | Legacy key or new string |
|---|---|
| title | `mailbox.aliases` |
| refresh | `admin.refresh` |
| hint (FR-017, verbatim with markup) | `mailbox.alias_domain_alias_hint` |
| add | `mailbox.add_alias` |
| selection mode, select all on the page | `mailbox.toggle_all` (UI 002's `bulk.*` for the bar, count, clear and results) |
| mass actions | `mailbox.quick_actions` (menu label), `mailbox.activate`, `mailbox.deactivate`, `mailbox.remove`, `mailbox.sogo_visible_y`, `mailbox.sogo_visible_n` (only with the groupware), `mailbox.add_alias_expand` |
| search | `datatables.search` |
| domain filter, its empty option | `mailbox.domain`, `mailbox.all_domains` |
| other filters (app improvement, FR-013) | labels by the attribute's legacy key: primary domain `mailbox.target_domain`, destination type `mailbox.target_address` (options `add.goto_null`, `mailbox.goto_spam`*, `mailbox.goto_ham`* and the new `aliases.destination.addresses`), kind (new `aliases.filters.kind`, options `mailbox.catch_all` and new `aliases.kind.regular`), delivers to (new `aliases.filters.destination`), `mailbox.active`, `edit.sender_allowed`, `mailbox.sogo_visible` (only with the groupware), `mailbox.internal`; generic `lists.filters.*` (title, count, all, yes, no, clear; UI 002's `domains.filters.*` generic texts moved there) |
| sort control (cards; table headers on wide screens) | new `lists.sort.*` (label, order) and `aliases.sort.newest`/`oldest`; the other keys by their column's legacy key (`mailbox.alias`, `mailbox.domain`, `mailbox.active`, `mailbox.sogo_visible`, `mailbox.internal`, `edit.sender_allowed`, `edit.created_on`, `edit.last_modified`) |
| columns (cards show the same fields with these labels) | "ID" (hard-coded in legacy: new `aliases.fields.id`), `mailbox.alias` (with the `mailbox.catch_all` badge), `mailbox.target_address` (destinations, or the special action as text: `add.goto_null`, `mailbox.goto_spam`*, `mailbox.goto_ham`*), `mailbox.domain` (with "`mailbox.target_domain`: primary domain" as text for an alias in an alias domain, legacy's tooltip), `mailbox.sogo_visible` (only with the groupware), `mailbox.public_comment`, `mailbox.private_comment`, `mailbox.internal`, `mailbox.active`, `mailbox.action` |
| boolean cells | `mailbox.yes`, `mailbox.no` (legacy's ✓ and ✕) |
| empty comment | "-" as legacy (no key) |
| row actions | `mailbox.edit`, `mailbox.remove`, `mailbox.add_alias_expand` (single copy, list only) |
| loading, empty, no match | `datatables.loadingRecords`, `datatables.emptyTable`, `datatables.zeroRecords`; the clear action is `lists.filters.clear` |
| count and paging | `datatables.info` (`_START_`, `_END_`, `_TOTAL_`), UI 001's `PaginationBar` |
| orphaned alias (administrators; the API's `orphaned`, which legacy cannot show) | new `aliases.orphaned.badge`, `aliases.orphaned.warning` |
| more destinations | new `aliases.list.moreDestinations` ("+{count} more", FR-012) |

**Add alias** (`/aliases/new`) ← `templates/modals/mailbox.twig` `#addAliasModal`,
`js/site/mailbox.js` (goto checkboxes). One form, no section headings, no comments (legacy has
none at creation).

| Element | Legacy key |
|---|---|
| title | `mailbox.add_alias` |
| alias addresses (textarea) + help (markup, names the product as the installation's file does) | `add.alias_address` + `add.alias_address_info`* |
| catch-all mark of an `@domain` entry | `mailbox.catch_all` |
| goto addresses (textarea) + help | `add.target_address` + `add.target_address_info`* |
| mutually exclusive checkboxes that disable the textarea | `add.goto_null`, `add.goto_spam`*, `add.goto_ham`* |
| external destinations notice (FR-020; legacy refuses only after saving) | `danger.external_goto_denied` is the refusal; the advance notice is the new `aliases.form.externalNotice` |
| visible in SOGo (checked, only with the groupware) + info | `edit.sogo_visible` + `edit.sogo_visible_info` |
| internal (unchecked) + info | `add.internal` + `edit.internal_info` |
| allowed to send (checked) + info | `add.sender_allowed` + `edit.sender_allowed_info` |
| active (checked) | `add.active` |
| submit | `admin.add` |
| results of several addresses (app improvement, FR-021) | each line the legacy message of its outcome; new `aliases.create.results.*` for the heading and "not processed" |

**Alias page** (`/aliases/:id`) ← `templates/edit/alias.twig`, `js/site/edit.js`. Title
`edit.alias` with the address. Display-only (legacy's list columns): "ID" (`aliases.fields.id`),
`mailbox.domain`, `mailbox.target_domain` (for an alias in an alias domain; linked to the domain page
when available), the `mailbox.catch_all` badge, the orphaned warning. One section, "`edit.alias`",
with the form of `edit/alias.twig` in its order:

| Element | Legacy key |
|---|---|
| address (legacy labels it with the heading) | `edit.alias` |
| goto addresses + checkboxes | `edit.target_address`*, `add.goto_null`, `add.goto_spam`*, `add.goto_ham`* |
| visible in SOGo + info (only with the groupware) | `edit.sogo_visible`, `edit.sogo_visible_info` |
| internal + info | `edit.internal`, `edit.internal_info` |
| allowed to send + info | `edit.sender_allowed`, `edit.sender_allowed_info` |
| private comment, public comment | `edit.private_comment`, `edit.public_comment` |
| active | `edit.active` |
| save | `edit.save` |
| history (administrators) | UI 002's `history.link` |

**Domain aliases list** (`/alias-domains`) ← `templates/mailbox/tab-domain-aliases.twig`,
`draw_aliasdomain_table()`: title `mailbox.domain_aliases`, `admin.refresh`, `mailbox.toggle_all`,
`mailbox.quick_actions` with `mailbox.activate`, `mailbox.deactivate`, `mailbox.remove`, add
`mailbox.add_domain_alias` (only with `aliasDomains`, hidden otherwise as legacy's `data-acl`),
search `datatables.search`, target filter `mailbox.target_domain` (`mailbox.all_domains`), active
filter `mailbox.active`, sort keys by their column's key (`mailbox.alias`, `mailbox.target_domain`,
`mailbox.active`, `edit.created_on`, `edit.last_modified`), columns `mailbox.alias`,
`mailbox.target_domain` (linked to the domain page when available, with the
`mailbox.alias_domain_backupmx` badge), `mailbox.active`, `mailbox.action`; row actions
`mailbox.edit`, `mailbox.remove` (the DNS action is UI 010's).

**Add domain alias** (`/alias-domains/-/new`) ← `#addAliasDomainModal`: title
`mailbox.add_domain_alias`; `add.alias_domain` (textarea) + `add.alias_domain_info`*;
`add.target_domain` (picker, placeholder `add.select`; relay domains disabled with the reason
`danger.targetd_relay_domain`); `add.active`; rate limit `acl.ratelimit` with the placeholder
`ratelimit.disabled` and the frames `ratelimit.second/minute/hour/day` (only with `ratelimit`);
`admin.dkim_domains_selector` (prefilled with `dkimDefaults.selector`; emptied, no key is
generated, as in legacy) and `admin.dkim_key_length` (the sizes of the capabilities, `dkimDefaults`
preselected); submit `admin.add`.

**Domain alias page** (`/alias-domains/:aliasDomain`) ← `templates/edit/aliasdomain.twig`: title
`edit.edit_alias_domain` with the name; one section "`edit.edit_alias_domain`" with
`edit.target_domain` (picker) and `edit.active`, save `edit.save`; the rate limit read-only in its
legacy position under `acl.ratelimit` (`ratelimit.disabled` when none; edited in UI 006); history.

**Resource list** (`/resources`) ← `templates/mailbox/tab-resources.twig`, `draw_resource_table()`:
title `mailbox.resources`, `admin.refresh`, `mailbox.toggle_all`, `mailbox.quick_actions` with
`mailbox.activate`, `mailbox.deactivate`, `mailbox.remove`, add `mailbox.add_resource`; the legend
`mailbox.booking_0_short` – `mailbox.booking_null`, `mailbox.booking_lt0_short` –
`mailbox.booking_ltnull`, `mailbox.booking_custom_short` – `mailbox.booking_custom`; search
`datatables.search`; filters `mailbox.domain` (`mailbox.all_domains`), `mailbox.kind`,
`mailbox.active`; sort keys by column key; columns `mailbox.description`, `mailbox.alias` (the
address), `mailbox.kind`, `mailbox.domain`, `mailbox.multiple_bookings` (badges `_short`, " (n)"
after the hard limit), `mailbox.active`, `mailbox.action`; row actions `mailbox.edit`,
`mailbox.remove`. Kind values: legacy hard-codes "Location", "Group", "Thing" and the list shows the
raw value, so they are the new strings `enums.resourceKind.*` with English equal to legacy's.

**Add resource** (`/resources/new`) ← `#addResourceModal`: title `mailbox.add_resource`;
`add.description`; `add.domain` (picker, domains only, placeholder `add.select`); `add.kind` (select:
`enums.resourceKind.location`, `group`, `thing`, legacy's order); `add.multiple_bookings` (select:
`mailbox.booking_null`, `mailbox.booking_ltnull` preselected, `mailbox.booking_custom`, then the
number field); `add.active`; submit `admin.add`. The derived address preview (FR-045, legacy derives
it silently) is the new `resources.form.preview` and `resources.form.noAddress`.

**Resource page** (`/resources/:resourceAddress`) ← `templates/edit/resource.twig`: title
`edit.resource` with the address; display-only `mailbox.alias` (the address) and `mailbox.domain`;
one section "`edit.resource`" with `add.description`, `edit.kind`, `add.multiple_bookings` (select
and number), `edit.active`, save `edit.save`; the note that the address does not change is the new
`resources.form.addressKept`; history.

**Send as** (`/mailboxes/:address/send-as`) ← the "Allow to send as" and "External sender
addresses" fields of `templates/edit/mailbox.twig` (#medit) and `js/site/edit.js`. Title and the
mailbox section entry `edit.sender_acl` with the mailbox address. One form, one save.

| Element | Legacy key |
|---|---|
| multi-select of the explicit permissions | `edit.sender_acl`; options: a domain or `*` as `edit.dont_check_sender_acl` with the domain (`%s`), an address as itself; subtexts hard-coded in legacy ("Admin" for entries the user cannot change, "Alias", "Alias (allowed)", "Alias (blocked)"): new strings `senderSettings.subtext.*` with English equal to legacy's |
| the aliases that deliver to the mailbox | selected and locked "Alias (allowed)" when they allow sending; unselected "Alias (blocked)" options when not, selecting one adds the explicit permission (legacy) |
| searching the server's candidates (5,000 and more; legacy loads all) | the field is searchable as legacy's live search; loading, no match and error states use `datatables.loadingRecords`, `datatables.zeroRecords` and UI 001's error message |
| sender check disabled (when `*` is selected) | `edit.sender_acl_disabled`* |
| hint | `edit.sender_acl_info`* |
| external sender addresses (text field, comma-separated, only with `extendSenderAcl` as legacy's `data-acl`) | `edit.extended_sender_acl`, placeholder "user1@example.com, user2@example.org, @example.com, ..." (hard-coded in legacy: new `senderSettings.externalPlaceholder`, equal to legacy's), `edit.extended_sender_acl_info`* |
| save | `edit.save` |
| an entry whose domain or address no longer exists (the API's `stale`) | new `senderSettings.subtext.stale` |
| an added entry the mailbox already had through an alias (FR-055) | new `senderSettings.notNeeded` |
| history (administrators) | `history.link` |

**Confirmations** (docs/conventions.md "Confirmations"): single deletions from the lists and
the typed count of bulk deletions use `footer.confirm_delete`, `footer.delete_these_items`,
`footer.delete_now`, `footer.cancel`; the impact lines are new strings
(`aliases.delete.impact*`, `aliasDomains.delete.impact`, `resources.delete.impact`); the bulk
deactivate and hide confirmations and the expand explanation are new strings
(`aliases.bulk.confirm.*`, `aliases.copy.explain`, `aliasDomains.bulk.confirm.deactivate`,
`resources.bulk.confirm.deactivate`). No confirmation for deactivating one object, turning on `*`
or other saves (legacy has none).

**Audit log**: `enums.auditEventType.*` and `enums.auditTargetType.*` for the 10 event types and 4
target types (no classic counterpart: new strings; the target `alias` uses `mailbox.alias`,
`aliasDomain` `add.alias_domain`, `resource` `edit.resource` through `LEGACY_TEXTS`, and
`mailboxSenderSettings` `edit.sender_acl`).

#### Part 2: messages

Placeholders are filled as legacy's `vsprintf` fills them (`inc/functions.mailbox.inc.php`).

| API outcome | Legacy key (placeholder source) |
|---|---|
| `createAlias` 201 | `success.alias_added` (address as typed, ID) |
| `updateAlias` 200 | `success.alias_modified` (address) |
| `deleteAlias` 204 | `success.alias_removed` (address) |
| `copyAliasOverAliasDomains` / bulk copy, per copy | created: `success.alias_added` (copy address, ID); skipped `addressInUse`: `danger.is_alias_or_mailbox` (copy address); `aliasLimitReached`: `danger.max_alias_exceeded`; `destinationNotPermitted`: `danger.external_goto_denied` (copy address); failed: the problem's message; no alias domains: new `aliases.copy.none` |
| `not-primary-domain-alias` | `warning.is_not_primary_alias` (address) |
| `createAliasDomain` 201 | in legacy's order: `success.rl_saved` (name) when the rate limit was applied (failed: UI 002's `domains.outcome.rateLimitFailed`); `success.dkim_added` (name), `success.domain_add_dkim_available` or `danger.dkim_domain_or_sel_invalid` (name) for the key; UI 002's `domains.outcome.dkimDnsNoZone`/`dkimDnsFailed` for the DNS publication; new `aliasDomains.outcome.groupwareFailed` for a failed directory update; then `success.aliasd_added` (name) |
| `updateAliasDomain` 200 / `deleteAliasDomain` 204 | `success.aliasd_modified` (name) / `success.alias_domain_removed` (name) |
| `createResource` 201 / `updateResource` 200 / `deleteResource` 204 | `success.resource_added` / `success.resource_modified` (legacy's own text) / `success.resource_removed` (address) |
| `updateMailboxSenderSettings` 200 | `success.mailbox_modified` (mailbox address; legacy saves these fields with the mailbox) |
| `address-in-use` by `holder` | `alias` → `danger.is_alias`, `temporaryAlias` → `danger.is_spam_alias`, `mailbox`, `resource` → `danger.is_alias_or_mailbox` (address) |
| `domain-alias-limit-reached` | `danger.max_alias_exceeded` |
| `alias-domain-already-exists` (both kinds) | `danger.alias_domain_invalid` (name), as legacy answers an existing name |
| `attribute-not-permitted` on `destinations.N` / `externalSenderAddresses` / `rateLimit` | `danger.external_goto_denied` (entry) / `danger.extended_sender_acl_denied` / `danger.access_denied` |
| `permission-flag-required` | `danger.access_denied` |
| alias `address`: `required`, `invalidFormat`, `notFound {resource: domain}` | `danger.alias_empty`, `danger.alias_invalid` (address), `danger.domain_not_found` (domain part) |
| `destinations`: `required` / `destinations.N`: `invalidFormat`, `notEligible {kind: resource}`, `conflictsWith {field: address}`, `notEligible {kind: externalDestination}` | `danger.goto_empty` / `danger.goto_invalid` (entry), `danger.goto_invalid` (entry), `danger.alias_goto_identical`, `danger.external_goto_denied` (entry) |
| comments `tooLong` | `danger.comment_too_long` |
| alias domain `name`: `invalidFormat`, `reserved`, `conflictsWith {field: targetDomain}` | `danger.alias_domain_invalid` (name), `danger.domain_cannot_match_hostname`, `danger.aliasd_targetd_identical` (target) |
| `targetDomain`: `notFound`, `notEligible {kind: relayDomain}`, `notEligible {kind: aliasDomain}` | `danger.targetd_not_found`, `danger.targetd_relay_domain`, `danger.target_domain_invalid` (target) |
| `rateLimit.frame` `notInList` | `danger.rl_timeframe` |
| resource `description`: `required`, `invalidFormat`; `domain`: `notFound`, `notEligible` | `danger.description_invalid` (description), `danger.domain_not_found` (domain), `danger.domain_invalid` |
| `explicitPermissions.N` (any code) | `danger.sender_acl_invalid` (entry) |
| `externalSenderAddresses.N`: `invalidFormat` / `notEligible {kind: localDomain}` | `danger.extra_acl_invalid` (entry) / `danger.extra_acl_invalid_domain` (entry) |
| `temporary-failure` | UI 002's `problem.temporary-failure` |
| 412, 404, network, unknown types, bulk summaries, "not processed" | UI 001/002 generic strings (`sections.outdated.*`, `problem.*`, `bulk.*`) and this feature's `*.gone` strings |

#### Part 3: deviations

Settled by the orchestrator's decisions and applied (the spec text they replace is noted in its
task):

1. **Send as** (old item 1): legacy's single multi-select, not the split sections, the "any
   address" switch or the always-allowed list (own and alias-domain addresses, which legacy does
   not show). `*` is an option as in legacy, offered to administrators only, with
   `edit.sender_acl_disabled` while selected and no extra confirmation. External sender addresses
   are hidden without `extendSenderAcl` (legacy's `data-acl`), not shown read-only.
2. **Alias destination** (old item 2): legacy's goto textarea and three mutually exclusive
   checkboxes.
3. **`mailbox.alias_domain_alias_hint`** (old item 3): shown verbatim.
4. **Creation form headings and comments** (old item 4): dropped; comments are edited on the alias
   page, as in legacy.
5. **Separate screens per legacy tab** (old item 5): kept, for visibility only.
6. **DKIM switch** (spec FR-036): legacy's prefilled selector field; emptying it creates no key
   (`dkimSelector: ""`), as in legacy.
7. **Deactivation confirmations of one object and of "any address"** (plan parity note 5): dropped
   (no confirmation legacy lacks). Bulk deactivate and hide keep theirs.
8. **Deletion and expand on the detail pages** (spec FR-016, FR-031): only in the lists, as legacy;
   the single copy is a list row action.

Not built until the owner decides (spec requirements beyond the legacy forms):

- the receive-only badge and the modification-time column of the alias list (FR-012), and the
  creation and modification times on the alias, domain alias and resource pages (FR-016, FR-035,
  FR-046): legacy shows neither;
- the alias count of a domain alias with its link to the filtered alias list (FR-033);
- the permission notes where legacy hides a control: no "Add domain alias" note (FR-041), no
  read-only external sender addresses (FR-052);
- the count and limit in the alias limit message (US2-AS5, US4-AS7): legacy's
  `danger.max_alias_exceeded` has none.

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
3. **G3: the `details` of feature 004 audit records.** `AuditEvent.details` is a free-form object.
   Its 004 members (`changes`, `creationReport`, `removed`, `copiedFromAliasId`, `groupwareUpdate`,
   `bulkRequestId`) are defined only in API research R20.
   - mailcow-rest-v2 already tracks this as a cross-feature gap (`docs/api-gaps.md` G3, raised by
     UI 010). Its fix: each API feature documents its detail keys in `docs/audit-events.md` when it
     is implemented, and the `AuditEvent.details` description points there (API conventions "Audit
     record details").
   - API 004 is implemented before UI 004, so its section is expected to exist at implementation
     time.
   - **Behaviour**: US8 labels the documented 004 keys and shows unknown keys verbatim, as the API
     conventions say. If the 004 section is still missing, History keeps UI 001's generic definition
     list, where the old and new values are visible as text (US8-AS1). The gap is then reported
     again.
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
   writes only the new strings of its legacy form map (constitution IV 1.3.0), far fewer than the
   earlier estimate of about 185 per locale. It no longer writes values for legacy keys missing from
   the upstream cs-cz or sk-sk files: they fall back to `en-gb`, and the fork's files are complete.
   - **Default**: the owner reviews them before the release.

3. **"Select all" at a reduced bulk limit.**
   - When the server's bulk limit is below the page size, UI 002 and UI 003 disable "Select all on
     this page". UI 004's spec instead requires selecting the first N with an explanation (FR-060,
     US6-AS6).
   - Both follow the conventions' rule that selection stops at the limit.
   - **Default**: UI 004's lists use the capped mode of `useBulkSelection`, an opt-in, because the
     spec governs its own screens. The owner may align all lists on one behaviour later.

## Parity notes added by the plan

The spec's parity tables are complete. The plan adds:

1. `mailbox.alias_domain_alias_hint` is shown verbatim, with its markup, through
   `SanitizedHtml.vue` (constitution IV 1.3.0). The earlier plan replaced it with a new key because
   it names the legacy "Filters" tab and "SOGo -> Forwarder"; that is now "Deviations needing a
   decision" item 3.
2. Eight values are missing from upstream `2026-09a`:
   - `add.internal`, `edit.internal_info`, `edit.sender_allowed` and `edit.sender_allowed_info` in
     sk-sk;
   - `acl.alias_external_goto` and `danger.external_goto_denied` in both cs-cz and sk-sk.

   They fall back to `en-gb`, as in the classic interface, and are never written by hand. The
   FeldHost fork's cs-cz and sk-sk files contain all of them.
3. Destinations, copy addresses and external sender addresses are shown as stored (ASCII) until API
   gap G2 is closed.
4. The list action "Edit" opens the detail screen with its main section open for editing:
   destinations for aliases, general for alias domains, the resource section for resources. Every
   other section has its own edit action (conventions "Editing and conflicts", R10).
5. Deactivating one alias, alias domain or resource from its section asks one confirmation naming
   the effect (conventions "Confirmations"), and turning on "any address" asks one confirmation that
   carries the spec's warning (R10, R15). Legacy saves both without asking.

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
├── messages/{en-gb,cs-cz,sk-sk}.json                 # new strings of the legacy form map only
scripts/i18n/{lib.mjs,check.mjs}                      # ENUM_NAMESPACES (R20); legacy keys checked by UI 001
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
