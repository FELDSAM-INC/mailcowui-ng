# Implementation Plan: DKIM, MTA-STS and DNS

**Branch**: `main` (no feature branches, constitution 1.1.0) | **Date**: 2026-10-18 |
**Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/010-dkim-mta-sts-dns/spec.md`

## Summary

UI feature 010 adds three areas to mailcowui-ng. All are built on mailcow REST API v2 feature 010.

- **ARC/DKIM keys**:
  - a paged, filterable list of every DKIM entry in the user's scope;
  - an entry page with the DNS record and its copy buttons;
  - generation for one name, a selection or "all names without a key";
  - for administrators: import, copy, replacement with a new key, deletion (single and bulk),
    private key export and "Publish DNS record again".
- **MTA-STS**:
  - a policy section on the domain page (UI 002), with set-up, section editing, activation and
    deactivation;
  - an "inherits the target's policy" section on the alias domain page (UI 004);
  - an "MTA-STS policies" overview.
- **DNS diagnostics**: its own page per domain or alias domain. Each check is shown as a card or a
  table row, with:
  - a translated purpose, status and reasons;
  - summary groups and a "needs attention" filter;
  - the server facts;
  - a zone file to copy or download;
  - rate-limit awareness.

The feature also adds its entry points to earlier screens:
- the DKIM, MTA-STS and "Check DNS" parts of the UI 002 domain list and domain page;
- the same parts of the UI 004 alias domain list and alias domain page;
- the DKIM and MTA-STS labels of UI 001's audit log.

The technical approach (details in [research.md](./research.md)):

- **No new dependency.**
  - Everything runs on UI 001's stack: Vue 3.5, Vue Router 5, TanStack Vue Query, vue-i18n,
    openapi-fetch and Reka UI.
  - IDN conversion uses the browser's URL parser.
  - Downloads use `Blob` and `<a download>`.
  - The mock uses `node:crypto` for RSA keys (R26).
- **One feature area**, `src/features/dns/`, behind one `index.ts`. UI 001's single catalogue row
  `dns` becomes two rows, `dkimKeys` (`/dns/dkim-keys`) and `mtaStsPolicies`
  (`/dns/mta-sts-policies`), as FR-001 requires. Diagnostics live at
  `/dns/diagnostics/:diagnosticsName` (R2).
- **Contract**: the pin moves to mailcow-rest-v2 commit
  `32079252d55797d3da4e58ae661e9fb91c51c6f9` or a later one. It is the first commit with the
  complete API 010 contract: bulk deletion, generation with overwrite, check identifiers and
  message codes, publication reason codes, the server host name in `/capabilities/dns`, rate-limit
  headers, and `KnownProblemType` registered as a component. The feature uses 15 operations
  ([contracts/README.md](./contracts/README.md)).
- **Server state**:
  - DKIM entries, policies and capabilities are TanStack queries with explicit invalidation (R5).
  - Diagnostics results are queries kept for 10 minutes and cleared at sign-out. They run with
    their own 45-second timeout, and the request is not aborted when the user leaves the page (R14).
- **Secrets** (R11, R12):
  - The private key of an import or an export never enters the query or mutation cache. Requests
    that carry a private key use direct client calls.
  - The key lives only in a component `ref`. It is cleared on success, on close and on `pagehide`.
  - It is never put in storage, the address or history.
- **Runs on several names**: generation and copy send one request per name or target through UI
  004's `useSequentialCreate`, with a DKIM refusal classifier. Bulk deletion uses the API's
  `POST /dkim-keys/bulk-actions` with version tags, as `docs/conventions.md` requires (R8, R9).
- **Tests**: Vitest units and components; Playwright end-to-end tests of every acceptance scenario
  on 360 px and desktop with axe in both themes, against the contract-validated mock; smoke tests
  against the API dev stack (R25).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict) and Vue 3.5 SFCs; Node.js 24 LTS for tooling. As
UI 001.

**Primary Dependencies**: UI 001's ten runtime dependencies, unchanged (UI 001 research R1). No
runtime or development dependency is added (research R26).

**Storage**: none on a server. In the browser: the in-memory query cache only. No new
`localStorage` or `sessionStorage` key. Private key text exists only in component state (data-model
§4).

**Testing**:
- Vitest with jsdom and Vue Test Utils.
- Playwright projects `mobile-chromium` (360 × 780), `desktop-chromium` and `mobile-webkit`,
  against the production build and the Node mock server, with axe in both themes, CSP checks,
  horizontal-scroll and touch-target checks, and zero contract violations (UI 001 R22, R24).
- The `smoke` project against the mailcow-rest-v2 dev stack with API 010 implemented (R25).

**Target Platform**: As UI 001: the two latest major versions of evergreen browsers, served under
`/ng/` by the `ng-mailcow` image.

**Project Type**: web application (static SPA). The backend is the mailcow-rest-v2 repository.

**Performance Goals**:
- The first page of the DKIM list is visible within 2 s of opening when the API answers within 1 s
  (SC-013).
- The diagnostics progress state appears at once.
- Every new route is a lazy chunk. The initial JS stays at most 200 KB gzipped, and Lighthouse
  mobile scores stay at least 90 (constitution VII).

**Constraints**:
- Only contract operations are used.
- Strict CSP: downloads work without `data:` URLs or inline code (R13).
- No `v-html` in the feature. DNS values, policy texts and zone files are rendered as text (FR-078).
  Legacy help texts with HTML (`edit.mta_sts_info`, `edit.mta_sts_mode_info`,
  `edit.mta_sts_version_info`) go through UI 001's `SanitizedHtml.vue`, unaltered (constitution IV
  1.3.0).
- WCAG 2.2 AA in both themes, 360 px and 400 % zoom.
- No automatic request while idle. A diagnostics run starts only when its page opens without a
  fresh result, or when the user asks (FR-058).
- Private keys never reach storage, the address, history, logs or the query cache (FR-076, FR-077).

**Scale/Scope**:
- 8 user stories (3 at P1, 2 at P2, 3 at P3).
- 7 new routes (one a redirect), 2 navigation entries, and entry points on 5 earlier screens (UI
  002 domain list and page, UI 004 alias domain list and detail, UI 001 audit log).
- 15 of the contract's operations, plus UI 001's `listAuditEvents` and `getIdentity`.
- About 40 legacy keys used verbatim; new strings only for what legacy lacks (diagnostics statuses
  and messages, publication outcomes, runs, exports, the overview), fewer than the first plan's
  350 (R22).
- Lists of up to 10,000 entries are paged by the API.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Gate | Status |
|---|---|---|
| I. The API contract is the only interface | Only the 15 operations listed in contracts/README.md, through the generated client. The pin is bumped to a commit that contains the whole API 010 contract (R1), and generated types are re-exported through `@/api` (no hand-written API type). Gaps the API still has are listed below and not worked around: audit `details` are shown generically; the bulk limit comes from the contract's `maxItems`. Problem types and rule codes drive the UI (R21). | PASS |
| II. Mobile-first | Every screen is designed at 360 px first. The DKIM list, the policy list and the diagnostics results are cards below `md` and tables from `md` up. Import and copy are pages, not modals. Generation and deletion are short dialogs, full-screen sheets on phones. Selection uses a mode with a sticky action bar. Destructive actions show their impact: single deletion, bulk deletion with the number typed, replacement, overwrite, deactivation and export. Every list and result has loading, empty and error states (FR-014, FR-056, FR-069). | PASS |
| III. Accessibility (WCAG 2.2 AA) | axe on every screen and state in both themes. Tables have header cells and `aria-sort`. Card lists are lists with headings. Badges carry text and icon. Copy buttons have names that say what they copy. Runs, counts, diagnostics start and end, and copies are announced politely, a countdown at most once. Dialogs trap focus and return it. Sticky bars never hide the focus (R23). | PASS |
| IV. i18n and branding | Constitution IV 1.3.0: every mailcow language; legacy texts by their legacy keys, verbatim from the installation's `/lang/` files, HTML help texts through `SanitizedHtml.vue`; a key missing in a locale falls back to `en-gb`, never to a hand-written value (R22). The screens mirror the legacy forms and messages ("Translations and forms" below). New strings, only for elements legacy lacks, are in en, cs and sk and never machine-translated. Diagnostics purposes, statuses, message codes, publication outcomes and reason codes are translated from contract codes. Unknown codes fall back to a translated generic label with the API's English text marked `lang="en"`, as the contract asks. Durations, numbers and times use `Intl`. No brand data is introduced. | PASS |
| V. Security in the browser | Private keys:<br>• kept in component state only;<br>• never in a TanStack mutation (`variables` would be cached) or query;<br>• cleared on success, close, leave and `pagehide`;<br>• never in storage, the address, history or error reports (R11, R12).<br>The export dialog asks before closing an uncopied key (conventions "Secrets"). DNS content is plain text, and guidance links pass `safeHref` (R27). Downloads use `blob:` object URLs revoked at once, which the CSP allows (R13). Hiding actions is a convenience: 403 and 404 are handled (FR-003, FR-004). | PASS |
| VI. Test-first | `tasks.md` puts tests before implementation in every phase. Every acceptance scenario has an end-to-end test on both viewports against the contract-validated mock. Unknown-code fallbacks of closed enumerations are unit-tested with plain values, so the mock never contradicts the contract (UI 001 R22). Smoke tests run against the API dev stack (R25). | PASS (UI 001's smoke-gate entry still applies) |
| VII. Performance budgets | Routes are lazy (`dns` chunks). There is no new dependency. The query policy reuses cached lists and diagnostics: no refetch without reason, no polling. A Lighthouse collection is added for `/ng/dns/dkim-keys` (R26). | PASS |
| VIII. Simplicity | No new dependency. UI 010 reuses the shared blocks of UI 002, 004 and 005 (`EditableSection`, `useBulkSelection`, `BulkActionBar`, `BulkResultSummary`, `useLeaveGuard`, `HistoryLink`, `useSequentialCreate`, `DomainNameText`, `SearchField`, `CopyButton`, `OneTimeSecretDialog`, `utf8ByteLength`). It promotes two feature-local helpers at their second use: UI 002's `domain-name.ts` and UI 005's `download.ts` (R3). Blocks used several times inside this feature only (`RecordValue`, `RunResultList`) stay in the feature. | PASS |
| Technology constraints | Stack unchanged. No new TailAdmin primitive beyond those UI 001–009 copied, apart from `tabs` if not yet copied (R3). No CDN. No SSR. | PASS |
| Workflow and gates | CI gates as in UI 001. Commits go to `main`. The feature names API 010 and the pinned commit. | PASS |
| `docs/conventions.md` | **Wording**: "the classic interface". **Lists**: state in the address; sizes 25, 50 and 100; cards and tables; four states. **Bulk actions**: selection mode on the current page only; the API bulk operation with version tags; per-item summary; failed, refused and outdated items stay selected; a dropped connection is "outcome unknown". **Editing**: MTA-STS section editing sends changed fields with the version tag, and an outdated save marks the changed values. **Confirmations**: single deletion shows the impact, bulk deletion needs the number typed (spec aligned), other risky actions get one confirmation. **Secrets**: the export is shown once and closing uncopied asks. **History** and **errors** as the conventions describe. **Entry points**: added to UI 002 and 004 screens through their designated action areas. **Capabilities**: from `/capabilities/dns`, never hard-coded. | PASS (spec aligned, see below) |

**Post-design re-check (after Phase 1)**: PASS. The data model, the contracts README and the
quickstart introduce no violation. These decisions touched gates:

- Secret-bearing requests bypass TanStack Query. That is a deviation from UI 001 R9 ("all server
  state"), made for constitution V (R11).
- Diagnostics have their own client-side timeout. That is a deviation from UI 001 R8 ("no
  client-side timeout"), made for spec FR-058 (R14).
- The catalogue row `dns` is split into two rows for FR-001 (R2).
- Bulk deletion needs the number typed, aligned with `docs/conventions.md` (spec change 2 below).

## Translations and forms (constitution IV 1.3.0)

The owner rule of 2026-10-18 (`docs/conventions.md`, "Translations and forms") applies to every
screen and section of this feature, and overrides earlier text in this plan, the spec, research and
tasks.

**Legacy forms mirrored** (paths under `../mailhosting/data/web/`):

- **ARC/DKIM keys** (list, generation, import, copy, deletion) → `templates/admin/tab-config-dkim.twig`
  (System › Configuration › `admin.dkim_keys` in `templates/admin.twig`, page `admin/system.php`):
  the state toggles `admin.dkim_key_valid`, `admin.dkim_key_unused`, `admin.dkim_key_missing`;
  `mailbox.toggle_all` and `admin.remove`; the add form `admin.dkim_add_key` (`admin.domain_s`,
  `admin.dkim_domains_wo_keys`, `admin.dkim_domains_selector`, `admin.dkim_key_length`,
  `admin.add`); the import form `admin.import_private_key` (`admin.domain`,
  `admin.dkim_domains_selector`, `admin.private_key`, `admin.dkim_private_key`,
  `admin.dkim_overwrite_key`, `admin.import`); the copy form `admin.duplicate_dkim`
  (`admin.dkim_from`, `admin.dkim_from_title`, `admin.dkim_to`, `admin.dkim_to_title`,
  `admin.duplicate`). JS: `#dkim_missing_keys` and the private key modal in `js/site/admin.js`;
  the private key modal `showDKIMprivKey` in `templates/modals/admin.twig`. Messages of `dkim()` in
  `inc/functions.dkim.inc.php`: `success.dkim_added`, `success.dkim_removed`,
  `success.dkim_duplicated`, `danger.dkim_domain_or_sel_exists`,
  `danger.dkim_domain_or_sel_invalid`, `danger.private_key_error`, `danger.access_denied`.
- **DKIM section** on the domain and alias domain pages → the DKIM block below the form of
  `templates/edit/domain.twig` (`add.domain`, selector, TXT value).
- **MTA-STS section** → the `dmtasts` tab of `templates/edit/domain.twig`: `edit.mta_sts`,
  `edit.mta_sts_info`; `edit.mta_sts_version` (`edit.mta_sts_version_info`, option `STSv1`);
  `edit.mta_sts_mode` (`edit.mta_sts_mode_info`, options `enforce`, `testing`, `none` as raw
  values); `edit.mta_sts_max_age` (`edit.mta_sts_max_age_info`); `edit.mta_sts_mx`
  (`edit.mta_sts_mx_info`, `edit.mta_sts_mx_notice`); `edit.active` (`edit.mta_sts_active_info`);
  `admin.save`. Messages of `mailbox('add'|'edit', 'mta_sts', …)` in
  `inc/functions.mailbox.inc.php`: `danger.version_invalid`, `danger.mode_invalid`,
  `danger.max_age_invalid`, `danger.mx_invalid`, `success.object_modified`.
- **DNS diagnostics** → `dnsInfoModal` in `templates/modals/mailbox.twig`
  (`diagnostics.dns_records`, `diagnostics.dns_records_24hours`), opened by the "DNS" buttons of the
  domain and alias domain tables in `js/site/mailbox.js`, with the content of
  `inc/ajax/dns_diagnostics.php`: columns `diagnostics.dns_records_name`,
  `diagnostics.dns_records_type`, `diagnostics.dns_records_data`, `diagnostics.dns_records_status`;
  footnotes `diagnostics.cname_from_a` and `diagnostics.optional`; the fork's SPF hint with
  `diagnostics.allow`.
- **ISPConfig publication** (fork) → `dkim_update_in_dns()` in `inc/functions.dkim.inc.php` with
  `inc/lib/ispconfig.php`. Legacy publishes silently, with no text of its own.

**Screens and elements without a legacy counterpart** use new strings (en-gb, cs-cz, sk-sk, never
machine-translated), kept minimal: the MTA-STS policies overview, the alias domain MTA-STS section,
the DKIM entry page's record forms and copy names, run and bulk result summaries, the export dialog,
the diagnostics statuses, summary groups, message codes and rate-limit notices, the publication
outcomes and reasons, "Publish DNS record again", "Replace with a new key", outdated-version
handling and History. Fields of these screens that legacy forms also have (selector, key length,
MTA-STS fields) use the legacy keys above.

**Deviation-free rule**: these screens add, drop, rename, reword or reorder nothing relative to the
legacy forms above, except the conventions' improvements (sections with their own save, typed
confirmations, bulk mode, outdated-version handling). Labels, help and info texts (`*_info`,
`*_title`), placeholders, option labels, units, order and grouping, column headers, action labels
and success, warning and danger messages come from the legacy keys. Every mailcow language is
supported; legacy values are loaded at runtime from the installation and shown verbatim (HTML
through `SanitizedHtml.vue`); a missing key falls back to `en-gb`, never to a hand-written value.

**Legacy form map** (T004a, 2026-10-19). Paths under `../mailhosting/data/web/`. New strings are
named by their key in `src/i18n/messages/` (`dns/<locale>.json` unless marked "main"); a key in
`LEGACY_TEXTS` is shown with mailcow's own text. The deviations below are settled by the
orchestrator's decisions of 2026-10-18 (`docs/conventions.md`), as the "Settled" list records.

*1. Fields and elements*

| Screen (route) | Legacy source | Element | Legacy key (or new string, reason) |
|---|---|---|---|
| Navigation | `admin.twig` tab | "ARC/DKIM keys" entry | `admin.dkim_keys` |
| Navigation | `edit/domain.twig` `#dmtasts` | "MTA-STS" entry (no overview in legacy; the tab's name) | `edit.mta_sts` |
| DKIM keys (`dkim-keys`) | `admin/tab-config-dkim.twig` | heading, title | `admin.dkim_keys` |
| | state toggles | filter checkboxes (unused for administrators only) | `admin.dkim_key_valid`, `admin.dkim_key_unused`, `admin.dkim_key_missing` |
| | entry | name label, column header and sort | `admin.domain` |
| | entry badge | state badge | `admin.dkim_key_valid`, `admin.dkim_key_missing`, `admin.dkim_key_unused` (`LEGACY_TEXTS` for `dns.dkim.states.*`); "Incomplete": `dns.dkim.incomplete` (new: legacy cannot hold a partial key) |
| | entry badge "Selector '…'" | selector label, column, sort | `admin.dkim_domains_selector` |
| | entry badge "… bit" (hard-coded "bit") | key length label, column, sort | `admin.dkim_key_length` (its "(bits)" replaces the hard-coded unit) |
| | "↳ Alias-Domain:" (hard-coded) | kind label, kind filter option | `add.alias_domain`; `domain` → `admin.domain`; `none` → `dns.dkim.kinds.none` (new: legacy has no label for unused names) |
| | — | kind and completeness filters, search, sort control, result count, empty and no-match states, refresh failure | new `dns.dkim.list.*` and `dns.dkim.filters.*` (list improvements, conventions "Lists"); search label `datatables.search`, empty table `datatables.emptyTable`, no match `datatables.zeroRecords`, loading `datatables.loadingRecords`, refresh `admin.refresh` |
| | `#toggle_multi_select_all`, `delete_selected` | select all on the page; remove the selection | `mailbox.toggle_all`; `admin.remove` |
| | add form legend | generation dialog title, "Add" action of the selection | `admin.dkim_add_key`; submit `admin.add` |
| | add form "Domain/s" | the names of the generation, read-only | `admin.domain_s` |
| | `#dkim_missing_keys` link | "all names without a key" action | `admin.dkim_domains_wo_keys` |
| | add form selector (fork value `feldhost`) | selector field, prefilled from `defaultSelector` | `admin.dkim_domains_selector` |
| | add form key size select (subtext "bits") | key length select, options from `allowedKeySizes` | `admin.dkim_key_length` |
| | — | runs: progress, per-name outcome, retry, stop, leave question, confirmation of "all names without a key" | new `dns.dkim.run.*`; outcomes reuse `bulk.outcome.*` (main) |
| | import legend | "Import private key" action | `admin.import_private_key` |
| | — | read-only server settings (administrators) | new `dns.dkim.settings.*`; labels `admin.dkim_domains_selector`, `admin.dkim_key_length` |
| DKIM entry (`dkim-key`) | the entry's row in the tab | heading: the readable name; facts | `admin.domain`, `admin.dkim_domains_selector`, `admin.dkim_key_length`, the state badge; kind as above |
| | entry `textarea` with the TXT value | record name, host label, value; one or split form; copy buttons | new `dns.dkim.record.*` (legacy shows the value only; copy and split are FR-017); copied message `admin.copy_to_clipboard` |
| | — | not signed, incomplete notice with the missing parts and repair advice | new `dns.dkim.entry.*`, `dns.dkim.missingParts.*` |
| | "Private key" link (`showDKIMprivKey`) | export action and dialog title | `admin.dkim_private_key` |
| | — | "Replace with a new key", "Publish DNS record again", History | new `dns.dkim.replace.*`, `dns.publication.publishAgain.*`; History `history.link` (main) |
| | duplicate form | "Duplicate" action to the copy page | `admin.duplicate` |
| | mass action "Remove" | delete action | `admin.remove` |
| | `dnsInfoModal` button (hard-coded "DNS") | diagnostics action | `dns.checkDns` (main, new: hard-coded text, same English text) |
| Import (`dkim-import`) | import form | title | `admin.import_private_key` |
| | "Domain:" | name field | `admin.domain` |
| | "Selector:" (fork value `feldhost`) | selector field, prefilled from `defaultSelector` | `admin.dkim_domains_selector` |
| | "Private key: (RSA PKCS#8)", placeholder `-----BEGIN RSA KEY-----` | key field; its hint names the bit range of the capabilities | `admin.private_key`; hint `dns.dkim.import.keyHint` (new: the hard-coded "(RSA PKCS#8)" with the limits); the placeholder is a technical literal |
| | checkbox | overwrite | `admin.dkim_overwrite_key` |
| | button | submit | `admin.import` |
| | — | file chooser, existing-key notice, overwrite confirmation, leave question | new `dns.dkim.import.*` |
| Copy (`dkim-copy`) | duplicate form | title | `admin.duplicate_dkim` |
| | "From:" (`title` "Source domain to copy data from") | source summary and its description | `admin.dkim_from`, `admin.dkim_from_title` |
| | "To:" (`title` "Target domain/s - will be overwritten") | target picker and its description | `admin.dkim_to`, `admin.dkim_to_title` |
| | button | submit | `admin.duplicate` |
| | — | "has a key" marker, overwrite confirmation, incomplete source, load more | new `dns.dkim.copy.*` |
| Deletion (dialogs) | `#ConfirmDeleteModal` (`modals/footer.twig`) | title, intro, buttons | `footer.confirm_delete`, `footer.delete_these_items`, `footer.delete_now`, `footer.cancel` |
| | — | impact lines, typed count | new `dns.dkim.delete.*`; `bulk.confirm.typeCount` (main) |
| Export (dialog) | `showDKIMprivKey` | title | `admin.dkim_private_key` |
| | — | confirmation, turned-off note, download | new `dns.dkim.export.*`; dialog texts `secrets.*` (main) |
| Domain page DKIM block (`domain-detail`) | `edit/domain.twig` below the `#dedit` form | "Domain: **name** (selector._domainkey)" and the TXT `<pre>` | `add.domain`; the value with its copy button; heading `admin.dkim_keys` (the block becomes a section, so it needs a heading) |
| | — | state, link to the entry, "Add" for a name without a key, "DKIM keys of this domain and its alias domains" | state badge as above; `admin.dkim_add_key`; new `dns.dkim.section.*` |
| Domain page MTA-STS section | `edit/domain.twig` `#dmtasts` (tab order: after "Quota warning BCC", before "Domain wide footer") | heading, explanation | `edit.mta_sts`; `edit.mta_sts_info` (HTML, `SanitizedHtml`) |
| | version select, tooltip | version field (one option `STSv1`), help | `edit.mta_sts_version`; `edit.mta_sts_version_info` (HTML) |
| | mode select, tooltip | mode field, options as raw values `enforce`, `testing`, `none` in legacy order, help | `edit.mta_sts_mode`; `edit.mta_sts_mode_info` (HTML, whole) |
| | max age input, tooltip | max age in seconds, help | `edit.mta_sts_max_age`; `edit.mta_sts_max_age_info` |
| | MX textarea, tooltip, notice | MX hosts, comma-separated; help; notice | `edit.mta_sts_mx`; `edit.mta_sts_mx_info`; `edit.mta_sts_mx_notice` |
| | active checkbox, tooltip | active, help | `edit.active`; `edit.mta_sts_active_info` |
| | button | save | `admin.save` |
| | — | "no policy", policy identifier, policy address, DNS records with copy buttons, identifier-change notice and highlight, deactivation confirmation, certificate notice | new `dns.mtaSts.*` (legacy shows none of these; FR-050 to FR-052) |
| MTA-STS overview (`mta-sts-policies`) | none | heading | `edit.mta_sts` |
| | — | columns and filters | `mailbox.domain`, `edit.mta_sts_mode`, `edit.mta_sts_max_age`, `edit.mta_sts_mx`, `edit.active`; identifier and the rest new `dns.mtaSts.list.*` |
| Diagnostics (`dns-diagnostics`) | `dnsInfoModal` (`modals/mailbox.twig`) | heading, notice, documentation | `diagnostics.dns_records`; `diagnostics.dns_records_24hours`; `diagnostics.dns_records_docs` (HTML) |
| | `inc/ajax/dns_diagnostics.php` table | columns | `diagnostics.dns_records_name`, `diagnostics.dns_records_type`, `diagnostics.dns_records_data`, `diagnostics.dns_records_status` |
| | ✓, ✗, "?" with the values found | status: icon plus text (an icon alone has no accessible name) | new `dns.diagnostics.status.*` |
| | footnotes ¹ ² | note of `matchedByAddressRecords`; the optional marker | `diagnostics.cname_from_a`; `diagnostics.optional` |
| | SPF hint "Allow ip4:…" (fork key) | SPF guidance | `dns.diagnostics.allow` (new: fork-only key `diagnostics.allow`) |
| | "Download" (hard-coded) | zone file download | `dns.diagnostics.zone.download` (new, same English text) |
| | — | purposes, message codes, summary, filter, server facts, run states, rate limit, copy and view of the zone file | new `dns.diagnostics.*` (contract codes legacy cannot show) |
| Publication outcomes | `dkim_update_in_dns()` (silent) | statuses, reasons, advice | new `dns.publication.*` (legacy reports nothing) |
| Audit log | none | event and target labels | new `enums.auditEventType.dkim*`, `.mtaSts*`, `enums.auditTargetType.dkimKey` (main); `enums.auditTargetType.mtaStsPolicy` → `edit.mta_sts` |

*2. Messages*

| API outcome | Legacy key | Placeholders |
|---|---|---|
| `generateDkimKey` 201, 200 (replace); `importDkimKey` 201, 200 | `success.dkim_added` | the entry's name |
| `copyDkimKey` 201, 200 | `success.dkim_duplicated` | source name, target name |
| `deleteDkimKey` 204; bulk `done` | `success.dkim_removed` | the entry's name |
| `409 dkim-key-exists` | `danger.dkim_domain_or_sel_exists` (`LEGACY_TEXTS`, `LEGACY_ARGS` `name`) | the name |
| `422` `selector` `invalidFormat`, `required`, `tooLong` | `danger.dkim_domain_or_sel_invalid` (form key `dns.dkim.form`) | the name |
| `422` `privateKey` rule codes | new `validation.invalidPrivateKey`, `.encryptedPrivateKey`, `.unsupportedKeyType`, `.keyLengthOutOfRange` (main): `danger.private_key_error` is filled with OpenSSL's text, which the API never returns | — |
| `422` `target` `sameAsSource` | new `validation.sameAsSource` (main) | — |
| `403 dkim-private-key-export-disabled`, `403 dkim-dns-publication-disabled`, `409 mta-sts-policy-exists` | new `problem.*` (main) | — |
| `403 forbidden` | `danger.access_denied` (UI 001) | — |
| `createMtaStsPolicy` 201, `updateMtaStsPolicy` 200 | `success.object_modified` (legacy's add says nothing; the edit message fits both) | the domain |
| `422` `mode` | `danger.mode_invalid` (form key `dns.mtaSts.form`) | the domain |
| `422` `maxAge` | `danger.max_age_invalid` | the domain |
| `422` `mxHosts.<i>` `invalidFormat` | `danger.mx_invalid` | the entry |
| `422` `version` | `danger.version_invalid` | the version |
| `422` `mxHosts` `tooLong`, `tooMany`, `required` | UI 001's `validation.*` | `max` |
| client checks of the same rules | the same keys, through `client-errors.ts` | as above |

*3. Settled deviations* (orchestrator decisions of 2026-10-18 in `docs/conventions.md`):

1. Mode help: `edit.mta_sts_mode_info` is shown whole; no per-mode texts ("follow the legacy form").
2. New policy: mode `enforce` (legacy's first option), max age empty, active off, and the server
   host name as the only MX host (orchestrator answer to owner question 2, `analysis.md`).
3. Max age: seconds in a number field, as legacy; no unit select (durations in legacy's units).
4. MX hosts: legacy's comma-separated textarea with `edit.mta_sts_mx_notice`; entries are checked
   one by one and named in their errors.
5. Version: a select with the one option `STSv1`.
6. Diagnostics columns: legacy's four headers; the status column shows the API's status as icon
   plus text, because an icon alone has no accessible name (WCAG 1.1.1).
7. `diagnostics.allow`: the new string `dns.diagnostics.allow` (fork-only key).
8. "DNS" button: the new string `dns.checkDns` with legacy's hard-coded text "DNS".
9. Domain administrators' DKIM screen, the MTA-STS overview and the alias domain section stay
   ("screens with no legacy counterpart"). The free-text names of legacy's add form are not
   offered: the API generates keys for domains and alias domains only (API FR-024); unused names
   get keys by import.

Further decisions made while mapping:

- The MTA-STS section takes legacy's tab position: after "Rate limit" (the spam filter and quota
  warning BCC tabs belong to later features), before "Domain wide footer". The DKIM block is shown
  right after the "Edit domain" section, where legacy shows it below that tab's form.
- Activation and deactivation use the section's "Active" checkbox, as legacy does; a save that
  switches it off asks first (conventions "Confirmations": deactivating), and one that switches it
  on shows the certificate notice (FR-051). There are no separate Activate and Deactivate buttons.
- The DKIM bulk limit is `DnsCapabilities.dkim.bulkLimit` (API gap 2, closed at the pinned commit);
  no constant is kept in `limits.ts`.

**Deviations needing a decision** (as the plan listed them; all nine are settled, see "Settled
deviations" in the legacy form map above):

1. **MTA-STS mode help**: legacy's `edit.mta_sts_mode_info` is one HTML list for all three modes.
   The first plan split it into new per-mode keys next to each choice (FR-047). Splitting a legacy
   string is not allowed, so the plan now shows it whole; per-mode explanations would be new
   strings.
2. **MTA-STS defaults for a new policy**: legacy starts with `enforce` (first option), an empty max
   age and the server-side default for active; the plan starts with `testing`, 1 week and inactive.
3. **MTA-STS max age unit**: legacy takes seconds (`edit.mta_sts_max_age_info`, "Time in seconds");
   the plan offers a number with a unit and a readable duration (R18).
4. **MTA-STS MX hosts**: legacy is a comma-separated text area with `edit.mta_sts_mx_notice`; the
   plan uses a list of entries, for which that notice no longer fits.
5. **MTA-STS version**: legacy is a select with the one option `STSv1`; the plan shows fixed text.
6. **DNS diagnostics columns**: the plan replaced `diagnostics.dns_records_data` ("Correct Data")
   and `diagnostics.dns_records_status` ("Current State") with new "expected" and "found" labels,
   and legacy's ✓, ✗ and ? icons with six text statuses.
7. **Fork-only key** `diagnostics.allow` ("Allow", SPF hint): it is not in the upstream `en-gb`
   snapshot, so `i18n:check` cannot accept it as a legacy key. It stays a new string unless the
   snapshot is to include fork keys.
8. **"DNS" button**: legacy's hard-coded "DNS" label; the plan's "Check DNS" is a new string.
9. **Added screens and roles**: domain administrators get the DKIM keys screen with generation
   (legacy: administrators only), and the MTA-STS policies overview and the alias domain section
   have no legacy counterpart. The free-text domain entry of legacy's add form is dropped (API
   FR-024).

## Dependencies and order

UI 010 is implemented **after UI 001–009** and after **mailcow-rest-v2 feature 010 is implemented**
in the API dev stack. The constitution lets a UI feature start once the contract is merged, so the
API implementation is needed only for the smoke tests (T110). The prerequisites:

| Prerequisite | From | What UI 010 uses |
|---|---|---|
| Foundation | UI 001 | Shell, catalogue, router guards, session, `@/api` client and query keys, i18n and problem mapping, the legacy translation layer (runtime `/lang/` loader, `en-gb` snapshot, formatter) and `SanitizedHtml.vue`, `useListState`, `ListState`, `PaginationBar`, `useConfirm` and `ConfirmDialog`, `useVersionedSave`, `useProblemForm`, `FormField`, `ErrorSummary`, `ProblemMessage`, `DateTime`, `useAnnouncer`, `useCountdown`, `useMediaQuery`, `clipboard.ts`, `safeHref`, `limits.ts`, the mock server and fixtures, the audit log screen |
| Domain list and domain page with section editing | UI 002 | The action areas of UI 002 data-model §9; `EditableSection.vue` and the field diff of `useVersionedSave`; `useBulkSelection`, `BulkActionBar`, `BulkResultSummary`; `ConfirmDialog` `requireTyped`; `useLeaveGuard`; `HistoryLink.vue` and the audit `targetType` and `targetId` filters; router scroll restoration (UI 002 D9); the `src/i18n/coverage.json` manifest (UI 002 D2) |
| Alias domain list and alias domain detail view | UI 004 | Their card, table and detail page; `useSequentialCreate`, `DomainNameText`, `SearchField` and `utf8ByteLength` (promoted to `src/shared/`); `isEntryAvailable` |
| `OneTimeSecretDialog.vue`, `CopyButton.vue`; `download.ts` | UI 005 | The export dialog, extended with a download action; copy buttons; the download helper, promoted by UI 010 |
| Contract pins of UI 002–009 | UI 002–009 | The pin T002 starts from |
| API feature 010 contract (merged) and implementation (dev stack) | mailcow-rest-v2 | Types, mock validation, smoke tests |

The paths below are those that the plans of UI 002, 004 and 005 name. T001 checks them against the
repository before any other task. Where the implementation differs, T001 records the actual path
in this plan, and the tasks use the recorded path.

### Building blocks from earlier features

| Block | Path (as planned) | Planned by | If absent at T001 |
|---|---|---|---|
| Section editing with changed-value marking | `src/shared/components/EditableSection.vue`, `src/shared/composables/useVersionedSave.ts` | UI 002 | Hard prerequisite: stop |
| Bulk selection, action bar and per-item summary (with the `#item` slot) | `src/shared/composables/useBulkSelection.ts`, `src/shared/components/BulkActionBar.vue`, `src/shared/components/BulkResultSummary.vue` | UI 002; slot added by UI 004 (D4) | Hard prerequisite: stop |
| Typed confirmation | `src/shared/components/ConfirmDialog.vue` `requireTyped` | UI 002 | Hard prerequisite: stop |
| Leave guard | `src/shared/composables/useLeaveGuard.ts` | UI 002 (D21) | Hard prerequisite: stop |
| History link and audit target filters | `src/shared/components/HistoryLink.vue`, `src/features/audit-log/list-state.ts` | UI 002 | Hard prerequisite: stop |
| One-time secret dialog | `src/shared/components/OneTimeSecretDialog.vue` | UI 005 | Hard prerequisite: stop |
| One request per entry | `src/shared/composables/useSequentialCreate.ts` | UI 004 (R9) | Hard prerequisite: stop. T025 adds the `unknown` outcome if it lacks one |
| Readable name with the ASCII form below | `src/shared/components/DomainNameText.vue` | UI 002, promoted by UI 004 | Hard prerequisite: stop |
| Search field | `src/shared/components/SearchField.vue` | UI 004 (R7) | Hard prerequisite: stop |
| UTF-8 byte length | `src/shared/validation/utf8.ts` (`utf8ByteLength`) or UI 005's `src/shared/validation/byte-length.ts` | UI 004, UI 005 | Use whichever exists |
| Copy button | `src/shared/components/CopyButton.vue` | UI 005 | T022 creates it. If it lacks the select-in-place fallback (FR-075), T022 adds it |
| Domain name syntax check (readable or ASCII, 253/63) | `src/features/domains/domain-name.ts`, feature-local | UI 002 | T024 promotes it to `src/shared/validation/domain-name.ts` (second use) and adds the `*.` wildcard option |
| Text download through a revoked object URL | `src/features/account/download.ts`, feature-local in UI 005 | UI 005 | T023 promotes it to `src/shared/platform/download.ts` (second use), or creates it |
| Router scroll restoration on Back, and focus without scrolling | `src/app/router/index.ts`, `src/app/router/focus.ts` | UI 002 (D9) | T027 adds it |
| Enumeration coverage manifest | `src/i18n/coverage.json`, `scripts/i18n/check.mjs` | UI 002 (D2), UI 004 (R20) | Hard prerequisite: stop |
| Legacy translation layer and `SanitizedHtml.vue` | `src/i18n/`, `src/shared/components/SanitizedHtml.vue` | UI 001 (constitution IV 1.3.0) | Hard prerequisite: stop |

### Entry points into earlier screens

UI 002 data-model §9 names the action areas that UI 010 fills. UI 004 offers its card, table and
detail page. UI 010 places these components there, all exported from `src/features/dns/index.ts`:
`DomainDkimSection`, `DomainMtaStsSection`, `AliasDomainMtaStsSection` and `CheckDnsAction`. The
earlier pages import them from `@/features/dns`, as UI 001 R3 allows.

| Screen | File (as planned) | Area | UI 010 adds | Story |
|---|---|---|---|---|
| Domain list (UI 002) | `src/features/domains/components/list/DomainCard.vue`, `DomainTable.vue` | entry actions menu (Reka `DropdownMenu`) | "Check DNS" (FR-023) | US3 |
| Domain page (UI 002) | `src/features/domains/pages/DomainDetailPage.vue` (route `domain-detail`, `/domains/:domain`) | section list after Groupware; header actions (a menu below `md`) | DKIM section (FR-021), MTA-STS section `id="mta-sts"` (FR-022, FR-046), "Check DNS" (FR-023), "DKIM keys of this domain and its alias domains" (FR-012) | US1, US2, US3, US4 |
| Alias domain list (UI 004) | `src/features/alias-domains/components/AliasDomainCard.vue`, `AliasDomainTable.vue` | entry actions | "Check DNS" | US3 |
| Alias domain detail (UI 004) | `src/features/alias-domains/pages/AliasDomainDetailPage.vue` (route `alias-domain-detail`) | sections after General; page actions | DKIM section, MTA-STS section naming the target, "Check DNS" | US1, US2, US3, US4 |
| Creation reports (UI 002, UI 004) | `src/shared/components/CreationReport.vue` and its callers | DKIM key and DKIM DNS publication lines | Live link to the DKIM keys screen: `isEntryAvailable('dkimKeys')` replaces `'dns'` (T021) | US1 |
| Audit log (UI 001, filters by UI 002) | `src/features/audit-log/labels.ts`, `src/i18n/coverage.json` | event and target labels | 8 event types, 2 target types (FR-070) | US8 |

### T001 reconciliation (2026-10-19)

UI main `f02acc5` has UI 001, the runtime translations, UI 002 and the shared pieces of UI 003 and
UI 004; UI 003, 004, 005, 008, 009 and 012 are still being implemented in parallel worktrees. What
exists, and what UI 010 does about the rest:

| Block | Found | UI 010 |
|---|---|---|
| `EditableSection`, `useVersionedSave`, `useBulkSelection`, `BulkActionBar`, `BulkResultSummary` (`#item` slot), `ConfirmDialog` `requireTyped`, `useLeaveGuard`, `HistoryLink`, `SearchField`, `ActiveFilterChips`, `utf8ByteLength` (`src/shared/validation/utf8.ts`), `OneTimeSecretDialog`, `useSecretRequest`, `src/i18n/coverage.json` | as planned | reused |
| `useSequentialCreate` | not on main; UI 004's worktree has it (`src/shared/composables/useSequentialCreate.ts`, with `src/shared/validation/entry-list.ts`) | copied unchanged from UI 004 (commit `9fc0c45`), then T025 adds `unknown` for the entry in flight when the connection drops |
| `DomainNameText` | feature-local `src/features/domains/components/list/DomainNameText.vue`; UI 004 moves it to `src/shared/components/` | moved the same way (identical file, same imports) |
| `CopyButton` | absent (UI 005 not started) | T022 creates `src/shared/components/CopyButton.vue` with the select-in-place fallback |
| `download.ts` | absent | T023 creates `src/shared/platform/download.ts` |
| `domain-name.ts` | `src/features/domains/domain-name.ts`, feature-local | T024 promotes it to `src/shared/validation/domain-name.ts` |
| Router scroll restoration and focus without scrolling | present (`appScrollBehavior`, `focusPageHeading`, UI 002 D9) | T027 not needed |
| Alias domain list and detail page | absent (UI 004 in progress) | the DKIM section, the alias MTA-STS section and "DNS" are exported from `@/features/dns`; UI 004 places them in its card, table and detail page (conventions "Where features meet") |
| Creation reports `isEntryAvailable('dns')` | no reference to the `dns` entry exists on main | nothing to replace |

Entry points as implemented:

| Screen | File | Area | UI 010 adds |
|---|---|---|---|
| Domain list | `src/features/domains/components/list/DomainEntryActions.vue` (used by `DomainCard` and `DomainTable` through `DomainListPage`) | entry actions menu, now shown to domain administrators too (Delete stays administrator-only) | "DNS" |
| Domain page | `src/features/domains/pages/DomainDetailPage.vue` | after the "Edit domain" section; after "Rate limit"; header actions | DKIM section; MTA-STS section `#mta-sts` (`edit=mta-sts`); "DNS" |
| Audit log | `src/features/audit-log/labels.ts` via `enums.*` | event and target labels | 8 event types, 2 target types |

## API dependency and gaps

This feature depends on **mailcow-rest-v2 feature 010** at commit
`32079252d55797d3da4e58ae661e9fb91c51c6f9` or later
([contracts/README.md](./contracts/README.md)). It also depends on API 001's identity and audit log
and on API 002's audit target filters.

**Gaps of the spec that the API has closed** (the spec is aligned, see "Spec alignment"):

| Spec gap | Closed by |
|---|---|
| 1. Check identifiers, machine-readable reasons, notes and guidance | `DnsCheck.id` and `DnsCheckMessage` with `DnsCheckMessageCode` and `params` (API 010 FR-044) |
| 3. Form of the "failed" publication reason | `DkimDnsPublicationOutcome.reason` with `code` (`DkimDnsPublicationReasonCode`) and `detail` (FR-030) |
| 4. No atomic key rotation | `generateDkimKey` with `overwrite: true` and `If-Match`, administrators only (FR-013, FR-014) |
| 5. Server host name only inside a diagnostics result | `DnsCapabilities.serverHostname` (FR-012) |
| 6. Rate limit not visible before it is reached | `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset` on every result and refusal (FR-049) |
| (FR-041) No batch operation for deletion | `POST /dkim-keys/bulk-actions`, up to 100 keys, with per-key results and removal outcomes (FR-059) |

**Gaps that remain** (proposed to mailcow-rest-v2; the UI does not work around them):

1. **Audit `details` keys of the DKIM and MTA-STS events are not in the contract.**
   - The keys are `old` and `new` with `selector`, `keyLength` and `publicKeySha256`;
     `overwriteRequested`, `sourceName`, `dnsPublication`, `changes`, `oldPolicyId` and
     `newPolicyId`.
   - They are documented only in API 010 research R22. `AuditEvent.details` is
     `additionalProperties: true`.
   - **Until then**: the audit log shows `details` generically, as UI 001 does (key and value as
     text, nested objects indented). FR-070's labelled old and new values arrive with a contract
     that documents the keys.
   - **Proposed**: list them per event type in the `AuditEvent.details` description, or as
     `details` schemas per event.
2. **`DnsCapabilities` has no DKIM bulk limit.** Other capabilities reads have `bulkLimit`.
   - **Until then**: the limit is the contract's `DkimKeyBulkActionRequest.targets.maxItems` (100),
     held in `src/shared/validation/limits.ts` and checked against `contract/openapi.json` by a
     unit test. The selection covers one page of at most 100 entries, so it cannot exceed the limit.
   - **Proposed**: `dkim.bulkLimit`.
3. **The publication outcome of a single deletion exists only in the audit record**, by design
   (API 010 FR-024). Its keys are undocumented (gap 1). The deletion confirmation and result
   therefore point administrators to the history. The bulk deletion reports outcomes in
   `meta.dnsPublication`.

## Spec alignment made by the plan

These are consistency changes recorded in the spec's "Plan alignment" clarification block, with
the requirements edited accordingly:

1. **Bulk deletion** uses the API's bulk operation with version tags and per-key results (FR-040,
   FR-041, new FR-092). Generation and copy stay one request per name or target, because creation is
   never a bulk operation (API conventions).
2. **Bulk deletion confirmation** asks for the number of selected keys to be typed, as
   `docs/conventions.md` "Confirmations" requires. It no longer uses an acknowledgement checkbox
   (FR-038, US5-AS7, the edge case).
3. **Replacing a key with a new one** (generation with overwrite) is offered to administrators on
   entries with a key, including incomplete keys. This is the new FR-090; it touches FR-002,
   FR-019, FR-028, the edge case and the assumption on rotation.
4. **Diagnostics labels and messages** come from check identifiers and message codes. Unknown
   values fall back to a generic label (FR-059, FR-071).
5. **Publication failure reasons** are translated from their code, and the detail is shown as
   plain technical text (FR-044).
6. **The MTA-STS set-up form** pre-fills the server host name as its MX host (FR-047, US4-AS2).
7. **Rate-limit headers**: the diagnostics page shows the runs left when 3 or fewer remain, and it
   disables "Run again" while none remain (new FR-091).
8. **The export dialog** asks for confirmation before it closes without the key having been copied
   or downloaded (FR-077, conventions "Secrets").
9. **The "API Dependency" section**: gaps 1, 3, 4, 5 and 6 are marked closed, and the two new gaps
   above are listed. The table names API FR-012, FR-044, FR-049 and FR-059.

## Owner-level questions (defaults applied)

1. **Bulk deletion confirmation**: the spec's clarification chose an acknowledgement checkbox.
   `docs/conventions.md` requires the number of objects to be typed. **Default**: the number is
   typed, as the conventions require. The dialog still lists every key and marks the domains whose
   mail stops being signed.
2. **MTA-STS MX hosts on set-up**: the spec's clarification chose an empty list, because the host
   name was not available. The API now offers it for exactly this purpose. **Default**: the server
   host name is pre-filled as the only MX host and can be removed.

## Parity notes added by the plan

1. Legacy's "Select domains with missing keys" picks names on the visible page. UI 010's "Generate
   keys for all names without a key" applies the current search and kind filter across all pages
   (spec clarification). The confirmation names the count and the filters.
2. Legacy offers key rotation only as deletion plus generation. UI 010 offers "Replace with a new
   key" (atomic, administrators), which keeps mail signed during the change.

## Project Structure

### Documentation (this feature)

```text
specs/010-dkim-mta-sts-dns/
├── spec.md              # Feature specification (clarifications, plan alignment, parity)
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R27
├── data-model.md        # Phase 1: consumed data, view models, query keys, routes, validation, state machines
├── quickstart.md        # Phase 1: validation guide
├── contracts/README.md  # Phase 1: pinned contract, operations used, problem types
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

New and changed files. UI 001's structure is unchanged.

```text
src/
├── api/
│   ├── index.ts                         # + re-exports of the 010 root types and enum arrays
│   └── query/keys.ts                    # + dns-capabilities, dkim-keys, mta-sts-policies, dns-diagnostics
├── app/
│   ├── navigation/catalogue.ts          # row `dns` → `dkimKeys`, `mtaStsPolicies`
│   └── router/routes.ts                 # registers `features/dns/routes.ts`
├── features/
│   ├── dns/
│   │   ├── index.ts                     # routes; DomainDkimSection, DomainMtaStsSection,
│   │   │                                #   AliasDomainMtaStsSection, CheckDnsAction
│   │   ├── routes.ts
│   │   ├── permissions.ts               # action matrix (FR-002)
│   │   ├── names.ts                     # route params, file names
│   │   ├── api/{capabilities,dkim,dkim-secrets,mta-sts,diagnostics}.ts
│   │   ├── dkim/{list-state,record,generate-run}.ts
│   │   ├── mta-sts/{list-state,max-age,mx-hosts,policy-change}.ts
│   │   ├── diagnostics/{summary-groups,check-labels,check-messages,rate-limit}.ts
│   │   ├── components/                  # see tasks.md for each component
│   │   └── pages/{DkimKeysPage,DkimKeyPage,DkimImportPage,DkimCopyPage,
│   │              MtaStsPoliciesPage,DnsDiagnosticsPage}.vue
│   ├── domains/…                        # UI 002: mounts DKIM, MTA-STS, Check DNS (designated areas)
│   ├── aliases/…                        # UI 004: mounts DKIM, MTA-STS (target), Check DNS
│   └── audit-log/labels.ts              # + DKIM and MTA-STS event and target labels
├── shared/
│   ├── components/{CopyButton,OneTimeSecretDialog}.vue  # extended (select fallback; download)
│   ├── composables/useSequentialCreate.ts  # + `unknown` outcome if missing
│   ├── platform/download.ts             # promoted from UI 005's feature
│   └── validation/{limits,domain-name}.ts  # + 010 limits; domain-name promoted from UI 002
└── i18n/
    ├── messages/{en-gb,cs-cz,sk-sk}.json   # + dns.*, problem.*, validation.*, auditLog.*
    └── coverage.json                       # + 010 values of the shared enumerations (UI 002 D2)
scripts/i18n/check.mjs                      # + 010 enumerations (fully required) and formats
tests/
├── mocks/
│   ├── handlers/{dkim,mta-sts,dns-diagnostics}.ts
│   ├── scenarios/dns.ts
│   └── factories/{dkim-key,mta-sts-policy,dns-diagnostics,dkim-publication}.ts
├── unit/features/dns/…  unit/shared/…
├── e2e/dns/…
└── smoke/dns-*.smoke.spec.ts
lighthouserc.cjs, scripts/run-lhci.mjs      # + collection /ng/dns/dkim-keys
```

**Structure Decision**: One feature area `src/features/dns/`, matching UI 001's reserved
catalogue id `dns`. DKIM, MTA-STS and diagnostics share the capabilities read, the name helpers and
the copy and run components, so one area with one public `index.ts` keeps the surface that UI 002
and 004 import small. Inside it, `dkim/`, `mta-sts/` and `diagnostics/` hold the pure logic per
area. `components/` and `pages/` stay flat, as in UI 001's features.

## Complexity Tracking

No constitution violation beyond UI 001's recorded entries (brand colours until API 013, and the
smoke suite not yet a blocking gate), which still apply.
