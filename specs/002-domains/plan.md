# Implementation Plan: Domains

**Branch**: `main` (no feature branches, constitution 1.1.0) | **Date**: 2026-10-18 |
**Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-domains/spec.md`

## Summary

UI feature 002 replaces the classic interface's domain screens:

- Mail setup › Domains and Domain templates;
- the add-domain and add-template modals;
- the Edit domain page (domain and footer tabs) and the Edit template page.

Administrators can:

- list, search, filter, sort and page through domains with their usage figures, and inspect a
  domain;
- create a domain from a template, as a phone stepper or a one-page form, and read the report of
  the follow-up steps;
- edit the domain section by section;
- delete one domain after its deletion preview, or act on several domains with the API's bulk
  operation;
- manage domain templates and the domain-wide footer;
- open a domain's or a template's history in UI 001's audit log.

Domain administrators see only their domains, and change the Global Address List flag, the tags and,
with `domainDesc`, the description.

The technical approach (details in [research.md](./research.md)):

- **Foundation reused**: UI 001's stack, folders, generated client, mock API, tests, i18n,
  theming, session and shared primitives, unchanged. This feature adds one folder,
  `src/features/domains/` (D3), and the shared building blocks that UI 001 R20 reserved for it:
  `useBulkSelection`, `BulkResultSummary`, `EditableSection` with the outdated-diff extension of
  `useVersionedSave`, `ConfirmDialog` with `requireTyped` and rich content, and `HistoryLink`. It
  also adds `BulkActionBar` and `useLeaveGuard`. No new runtime dependency.
- **Contract**: a bump to the mailcow-rest-v2 commit that implements feature 002. The planning
  baseline is `3207925` (D1). A translation coverage manifest keeps other features' enumeration
  values out of the completeness gate until they are delivered (D2).
- **Data**:
  - capabilities, never hard-coded limits (D6);
  - the domain page seeded from the list entry, with its identical version tag (D6);
  - JSON Merge Patches of the changed members only (D11);
  - `If-Match` on every change, and per-item versions in bulk actions (D22).
- **UX**:
  - addresses for every screen, with `/-/` for the create route, because single-label domain
    names are valid (D4);
  - section editing through `?edit=` (D11) and phone steps through `?step=` (D16);
  - quotas entered in MiB, GiB or TiB (D12);
  - relay options kept consistent (D14);
  - a typed name to delete a domain, after its preview (D20);
  - a typed count for bulk deletions (D22, D23).
- **Tests**: unit and component tests for every new module; end-to-end tests of every acceptance
  scenario on `mobile-chromium`, `mobile-webkit` and `desktop-chromium` with axe in both themes,
  against the contract-validated mock with new domain handlers (D28); smoke tests against the
  API 002 dev stack (D29); a Lighthouse collection for `/ng/domains` (D30).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict) and Vue 3.5 SFCs; Node.js 24 LTS (UI 001).

**Primary Dependencies**: UI 001's ten runtime dependencies and its tooling (UI 001 R1, R2).
**None added.** IDNA uses the WHATWG URL parser (D15). UTF-8 sizes use `TextEncoder` (D17).

**Storage**: none. Server state lives in the query cache (data-model §3). Section, create and
footer forms are local component state. **No new device storage key.** List state lives in the
address (conventions). The creation report goes through the query cache (D7).

**Testing**:

- Vitest units and components (`tests/unit/features/domains/`, `tests/unit/shared/`).
- Playwright end-to-end tests in `tests/e2e/domains/` and `tests/e2e/domain-templates/`, plus
  additions to `tests/e2e/audit-log/`, against the production build with the production CSP.
- Every test runs `expectAccessible` in both themes and asserts zero CSP and mock contract
  violations (UI 001 R24).
- The smoke project gains one spec per story: `tests/smoke/domains-*.smoke.spec.ts` (seven) and
  `tests/smoke/domain-templates.smoke.spec.ts` (research D29).

**Target Platform**: as UI 001: the two latest major versions of evergreen browsers, including iOS
Safari and Chrome for Android.

**Project Type**: web application (static SPA). The backend is mailcow-rest-v2.

**Performance Goals**:

- SC-010: the first list page within 2 s on a mid-range phone when the API answers within 1 s,
  and search results within 1 s of the last keystroke (300 ms debounce).
- Lighthouse mobile performance ≥ 80 and accessibility ≥ 90 on `/ng/domains` (D30).
- Initial JavaScript unchanged (≤ 200 KB gzipped). Every domain and template screen is a lazy
  chunk.

**Constraints**:

- Only contract operations (16 new ones plus `listAuditEvents` and `getIdentity`).
- No API data rendered as HTML: the footer HTML is source text only (FR-059).
- WCAG 2.2 AA in both themes; usable at 360 px, 320 px and 400 % zoom.
- Limits from the capabilities read.
- No automatic requests while idle (UI 001 R12): debounced typing and explicit actions only.

**Scale/Scope**:

- 8 user stories (3 at P1, 3 at P2, 2 at P3) and 79 functional requirements.
- 7 routes and 1 new catalogue entry.
- 18 contract operations (16 new).
- About 330 translation keys, part of them reused from legacy.
- Lists of up to 5,000 domains, one page at a time.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Gate | Status |
|---|---|---|
| I. The API contract is the only interface | Only the operations of [contracts/README.md](./contracts/README.md), through the generated client. The pin is a deliberate bump with a recorded commit and a diff check of the domain contract (D1). No hand-written API types: form models and view models are app-defined, and request bodies are typed by the generated `DomainCreateRequest`, `DomainPatch`, `DomainFooterReplace`, `DomainBulkActionRequest` and template types. Every gap is reported, never worked around: the typed history presentation waits for API gap G1 (D26). Errors are handled from `type`, `errors` and the documented extension members (D25). | PASS |
| II. Mobile-first | Designed at 360 px first: cards below `md`, a stepper for creation, full-screen section forms with sticky actions, a selection mode with 44 × 44 px checkboxes, and expandable entries instead of horizontal scroll (D8, D11, D16, D22). Long forms are split into sections and steps. Deletions show their impact from the API's preview (D20). Every collection has loading, empty, no-match and error states (FR-014, FR-056). | PASS |
| III. Accessibility | axe in both themes on every screen and state, at 360 px and desktop (UI 001 R24). Usage bars, badges and report outcomes have text (D10, D16). Live announcements for result counts, saves, bulk progress and results (FR-073). Focus moves to headings on step and section changes, and to the error summary on failure (FR-075). Tables have `aria-sort` and cards are lists with headings (FR-072). | PASS |
| IV. i18n and branding | en-gb, cs-cz and sk-sk. Legacy keys reused, with markup stripped where the spec says so (D27). Problem types, rule codes and their parameters are translated, and sizes and numbers are formatted for the locale (D12, D25). The coverage manifest keeps the gate mechanical for delivered values (D2). No brand text is added. | PASS |
| V. Security in the browser | No new storage. The footer HTML is never rendered and `SanitizedHtml` is not used for it. Hiding is a convenience: the permission matrix mirrors the API, `403` refreshes the identity, and `404` covers out-of-scope objects (D24). | PASS |
| VI. Test-first | `tasks.md` writes the mock handlers, unit tests, end-to-end tests and smoke tests of each phase before its implementation. Every acceptance scenario has an end-to-end test on both viewports, against mocks validated against the contract. The smoke suite runs against an API that implements feature 002 (D1, D29). | PASS |
| VII. Performance budgets | Lazy routes. The list seeds the detail cache. Lists are invalidated, not polled. Capabilities are cached for 5 minutes. A third Lighthouse collection runs on `/ng/domains` (D6, D30). | PASS |
| VIII. Simplicity | No new dependency. Shared building blocks only where UI 001 R20 reserved them or where this feature has two concrete uses: `BulkActionBar` (domains, templates), `useLeaveGuard` (five uses), `EditableSection` (domain and template pages). Fields shared by domains and templates stay inside the feature (D3). | PASS |
| Technology constraints | Native `<select>`. Reka `Combobox` without its viewport for tag suggestions, and `Collapsible` and `DropdownMenu` as in UI 001. No inline style: bar widths are dynamic `:style` bindings (CSSOM). TailAdmin primitives already copied by UI 001. | PASS |
| Workflow and gates | CI unchanged. The new tests join the existing jobs, and Lighthouse gains one URL. Commits go to `main`. | PASS |
| `docs/conventions.md` | **Lists**: address state, sizes 25, 50 and 100, cards and tables, all four states. **Bulk**: explicit selection mode, current page only, the API's bulk operation with versions, per-item summary, failed, refused and outdated kept selected, "outcome unknown" on a dropped connection. **Editing**: sections, changed fields plus version, outdated handling without merge, deletions confirmed again. **Confirmations**: preview impact, typed domain name, typed bulk count, one confirmation for deactivation. **History**. **Errors and permissions**. **Where features meet**: entry points into UI 001's home and audit log; action areas for later features (data-model §9). **Capabilities**: never hard-coded (D6, D18). **Shared building blocks and canonical names**: this
feature creates `useLeaveGuard`, `src/i18n/coverage.json`, `BulkActionBar`, `useBulkSelection`
(selection disabled at the bulk limit, with a message), `BulkResultSummary`, `ConfirmDialog` with
`requireTyped`, `EditableSection` and `HistoryLink` under these names. **Secrets**: none of this
feature's requests or responses carry one. **Polling**: none; every request follows a user action
or a navigation. **Contract pins**: forward only, with the domain operations checked against the
baseline commit (D1). | PASS |

**Post-design re-check (after Phase 1)**: PASS. Decisions that touched gates:

- The spec was aligned with the contract and the conventions where its clarifications rested on
  API facts that have since changed (see "Spec alignment").
- R27 rule 3 is scoped by a manifest (D2), with an owner question below.
- The documented default values are kept in one module, tested against the contract text (D18,
  API observation O2).
- The history shows `details` generically until API gap G1 is closed (D26).

## API dependency and gaps

This feature depends on **mailcow-rest-v2 feature 002, Domains**, implemented and passing its
quickstart Part A. The planning baseline of the contract is commit
`32079252d55797d3da4e58ae661e9fb91c51c6f9`, and the implementation pins the commit or tag that
ships the implementation (D1, [contracts/README.md](./contracts/README.md)).

The contract offers everything the spec listed as missing, except for these gaps and
observations:

- **G1. Audit details are not in the contract** (blocks part of FR-063 and US8-AS1).
  - `AuditEvent.details` is an open object (`additionalProperties: true`).
  - API 002 writes these members for domain, template and footer records: `values`, `changes`
    (`{attribute: {old, new}}`), `templateId`, `creationReport`, `removedAliasDomains`,
    `removedDomainAdmins`, `footerRemoved`, `maildirCleanup` and `bulkRequestId`. They are
    documented only in `mailcow-rest-v2/specs/002-domains/data-model.md`.
  - Without a contract description, the UI cannot format old and new quotas as sizes, translate
    the creation report steps, or list the removed objects (constitution I).
  - **Proposed to mailcow-rest-v2**: describe the `details` members of the domain, template and
    footer event types in the contract. For example, give `AuditEvent.details` a documented
    `oneOf` per event type, reusing `DomainCreationReport` and an `AuditChange { old, new }` schema
    whose attribute names are those of `Domain`, `DomainTemplate` and `DomainFooter`.
  - **Until then**: the history shows these records with their typed fields (time, actor, client
    address, event type, target, outcome and translated failure reason) and UI 001's generic
    details view. A contract bump that closes G1 adds the typed presentation.
- **O1. No footer summary on the domain** (not blocking). FR-015's footer summary needs
  `getDomainFooter`, whose texts can reach 1 MiB each. **Proposed**: a small `footer` summary
  (`present`, `excludedCount`, `skipReplies`) on `Domain`, or leave as is.
- **O2. Template defaults only in prose** (not blocking). The legacy defaults that FR-052 starts a
  new template with are documented only in the descriptions of `DomainTemplateCreateRequest` and
  `DomainCreateRequest`. The UI keeps them in `defaults.ts`, with a test against the contract text
  (D18). **Proposed**: expose them in `DomainCapabilities` or as JSON Schema `default` keywords.
- **O3. No bulk deletion preview** (not blocking). A bulk deletion's confirmation shows the impact
  from list data (aliases, alias domains, assigned domain administrators) and states the rule for
  administrators left without a domain, instead of naming them (D22). Naming them would take one
  preview request per domain.
- The spec's former gap 9 (footer exclusion candidates) is not a gap: API 002 points to the mailbox
  and alias lists of features 003 and 004, and UI 003 and UI 004 add the picker (data-model §9).
- **Where they are tracked** (T001 step 6, checked at the pin `97aa81f`): mailcow-rest-v2
  `docs/api-gaps.md` records G1 as **G3** (audit details documented per feature in
  `docs/audit-events.md`, still open for feature 002), O1 as **G28**, O2 as **G29** and O3 as
  **G30** (optional), plus **G33** (quotes in `etag` and `BulkTarget.version`; the UI first stripped the
  quotes, which every reading allows, and sends the exact `etag` since the pin `c1677d5`). The pinned contract does not describe the `details` members
  of the domain records, so the history keeps showing them generically (D26).
- **At the pin `c1677d5`** (moved during US5, contracts/README.md): G28 is done (`Domain.footer`,
  read by the footer summary), G29 is done (`DomainCapabilities.templateDefaults`, read by the
  create and template forms), G33 is done (`BulkTarget.version` is the exact `etag`, which the app
  now sends unchanged) and G30 stays open (optional). G3 is done for feature 002 in mailcow-rest-v2
  `docs/audit-events.md`, outside the contract: `AuditEvent.details` is still an untyped object,
  so the history keeps the generic details view (D26). The domain creation report lost
  `groupwareDirectoryUpdate`.

## Spec alignment

The spec was written before API 002 resolved the gaps it reported and before
`docs/conventions.md` was collected. This plan aligns the spec for consistency, as conventions
require ("the next change to that spec aligns it"). The original clarification answers stay in the
spec, followed by a dated alignment note. The changes:

1. **Bulk actions**: FR-046 to FR-048, US5-AS3 and two edge cases. The selection is sent with the
   API's bulk operation, each domain with its list entry's version tag. Failed, refused and
   outdated domains stay selected. A dropped connection reports "outcome unknown". A bulk deletion
   requires the number of domains to be typed, as conventions and UI 003 do, instead of an
   acknowledgement. This supersedes the parts of the clarifications on deletion strength and bulk
   behaviour that rested on "the API has no batch operation" and "list entries carry no version
   tag".
2. **Resources**: FR-041 and FR-047. Domains with mailboxes **or resources** cannot be deleted
   (`usage.resources`).
3. **Deletion preview**: FR-042 and FR-043. The impact comes from the API's deletion preview,
   which names the domain administrator accounts to be deleted, and the deletion carries its
   version tag.
4. **Capabilities**:
   - FR-021: the field names the server's default DKIM selector.
   - FR-040: the tagging limit is checked before sending.
   - FR-031 and FR-032: the maximum mailbox quota is checked against the largest existing mailbox
     quota.
   - Edge case "groupware disabled": the creation form hides the Global Address List flag and the
     restart option, as legacy does.
5. **Tag suggestions**: FR-010 and FR-039 suggest the tags in scope.
6. **API Dependency section**: the gap list now says which gaps were resolved by API 002 and which
   remain (G1). The legacy parity rows that cited closed gaps were updated.

## Owner-level questions (defaults applied)

1. **Superseded clarifications**:
   - Two answers from the 2026-10-18 clarification session rested on API facts that changed: bulk
     actions with one request per domain and no version tags, and an acknowledgement instead of a
     typed count for bulk deletions.
   - **Default**: the conventions and the contract apply. The spec is aligned with a dated note,
     and the original answers stay visible.
   - If the owner prefers the acknowledgement for bulk deletions, the conventions document and UI
     003 must change as well.
2. **Translation coverage manifest** (D2):
   - UI 001's completeness rule would require translations for every value that other features
     add to the shared enumerations.
   - **Default**: a committed manifest scopes the rule to delivered values, and the other values
     fall back to the generic labels.
   - **Alternative**: translate all values now (about 425 values per locale).
3. **Release tags for contracts** (D1):
   - The pin should name the API commit that implements feature 002.
   - **Default**: a mailcow-rest-v2 release tag if one exists at implementation time, otherwise
     the first commit whose feature 002 quickstart Part A passes.

## Parity notes added by the plan

The spec's parity tables are complete. This plan adds:

1. **Groupware disabled**: the creation form hides the Global Address List flag and the restart
   switch when the API reports the groupware disabled. Legacy behaves the same (`SKIP_SOGO`).
2. **Deactivating a domain** in the General section asks for one confirmation that names the
   effect on its mailboxes. Legacy saves without asking.
3. **Bulk results**: per-domain outcomes come from one bulk request. Legacy posts one request with
   all items and reloads without per-item results.

## Translations and forms (constitution IV 1.3.0)

The screens mirror these classic templates (`../mailhosting/data/web/`, branch `feldhost-202609a`).
Legacy keys are read at runtime from the installation's `/lang/` files (UI main d128215,
docs/conventions.md "Wording"): `lt()` and `<LegacyText k>` in the screens (the help texts with
markup, such as `edit.gal_info`, `edit.relay_all_info`, `add.relay_transport_info`,
`add.post_domain_add` and `edit.domain_footer_info`, through `<LegacyText>` and its sanitiser),
`legacy()` in route titles and column tables, and `LEGACY_TEXTS` for the keys built at runtime
(field labels by field name, rate limit frames, the `domain` and `domainFooter` audit targets).
The interim `legacy-map.json` entries and `stripMarkup` of the first build are gone. The orchestrator's decisions of
2026-10-18 (docs/conventions.md "Decisions on the deviations", "Detail pages", "Outcomes", "No
confirmation legacy lacks") are applied.

### Legacy form map, part 1: fields and elements

**Add domain** (`/domains/-/new`) ← `templates/modals/mailbox.twig` #addDomainModal, behaviour
`js/site/mailbox.js` (`#addDomainModal` show, `setDomainTemplateData`). One form, groups as the
`<hr>`s divide them.

| Element | Legacy key |
|---|---|
| page title | `mailbox.add_domain` |
| Domain (required) / Description / Template | `add.domain` / `add.description` / `mailbox.template` (Default first and applied; another template replaces the values without asking) |
| Tags | `add.tags` |
| Max. aliases / Max. mailboxes | `add.max_aliases` / `add.max_mailboxes` |
| Max. quota per mailbox / domain quota (MiB numbers) | `add.mailbox_quota_m` / `add.domain_quota_m` (the default mailbox quota, `add.mailbox_quota_def`, is left out: owner decision) |
| Global Address List + help (only with the groupware) | `edit.gal` + `edit.gal_info` |
| Active | `add.active` |
| Rate limit, placeholder, frames | `acl.ratelimit`, `ratelimit.disabled`, `ratelimit.second/minute/hour/day` |
| Selector (prefilled with the server's default) / DKIM key length | `admin.dkim_domains_selector` / `admin.dkim_key_length` |
| Relay options, three checkboxes and notes | `add.backup_mx_options`, `add.relay_domain`, `add.relay_all`, `add.relay_all_info`, `add.relay_unknown_only`, `add.relay_transport_info` |
| actions | `add.add_domain_only`, `add.add_domain_restart`; `add.add` without the groupware |
| note after the actions (with the groupware) | `add.post_domain_add` |
| new strings | `domains.create.loadFailed` (the form's load error; legacy has no load step) |

**Domain page** (`/domains/:domain`) ← `templates/edit/domain.twig`; the tabs UI 002 delivers
become sections in legacy order.

| Element | Legacy key |
|---|---|
| page title, with the domain name as subtitle | `edit.domain` |
| usage figures (display-only, the domain list's columns) | `mailbox.stats`, `mailbox.mailboxes`, `mailbox.aliases`, `mailbox.domain_quota`, `mailbox.msg_num`, `mailbox.mailbox_quota` (not `mailbox.mailbox_defquota`: owner decision); the "n of m" and "n left" texts are new strings (`domains.usage.*`) |
| domain administrators (display-only) | `mailbox.domain_admins`; empty: `mailbox.no_record_single` |
| section "Edit domain" (tab #dedit) | `edit.domain` |
| Domain / Description (read-only without `domain_desc`) / Tags | `mailbox.domain` / `edit.description` / `add.tags` |
| relayhost (read-only until UI 009; shown with `domain_relayhost`) | `edit.relayhost`; none: `edit.none_inherit`; value `ID n: host` as legacy's option text (G41 adds the username) |
| administrators only: limits, quotas (MiB), relay options | `edit.max_aliases`, `edit.max_mailboxes`, `edit.max_quota`, `edit.domain_quota`, `edit.backup_mx_options`, `edit.relay_domain`, `edit.relay_all`, `edit.relay_all_info`, `edit.relay_unknown_only`, `edit.relay_transport_info` |
| Global Address List + help / Active (disabled for domain administrators) | `edit.gal` + `edit.gal_info` / `edit.active` |
| save | `admin.save` |
| times | `edit.created_on`, `edit.last_modified`, `user.never` |
| section "Rate limit" (tab #dratelimit, read-only until its feature lands) | `edit.ratelimit`, `ratelimit.*`, empty: `ratelimit.disabled` |
| section "Domain wide footer" (tab #dfooter, US7) | `edit.domain_footer` and the keys of that tab |
| tabs of other features | Spam filter (UI 006), Quota warning BCC, MTA-STS (UI 010) |

**Domain list** (`/domains`) ← `templates/mailbox/tab-domains.twig`, `js/site/mailbox.js`
`draw_domain_table`. Built before the rule and re-mapped with the runtime legacy texts: column
titles `mailbox.domain`, `mailbox.aliases`, `mailbox.mailboxes`, `mailbox.domain_quota` (allocated
of the domain quota), `mailbox.stats` (messages / storage), `mailbox.mailbox_quota`, the rate limit
(`edit.ratelimit`; legacy's hard-coded "RL" is not used as a header), and in the details
`mailbox.backup_mx`, `mailbox.domain_admins`, `mailbox.created_on`, `mailbox.last_modified`;
`mailbox.active`/`mailbox.inactive`; actions `mailbox.add_domain`, `mailbox.domain_templates`,
`mailbox.activate`, `mailbox.deactivate`, `mailbox.remove` (row and bulk), `admin.refresh`;
`datatables.search`, `datatables.loadingRecords`, `datatables.emptyTable`,
`datatables.zeroRecords`; the sort keys by the same column titles (`LEGACY_TEXTS`). Deletion is
offered only here, as in legacy; its impact preview, typed confirmation, filters, sort control and
bulk mode are app improvements with new strings.

**Domain templates** (`/domain-templates`) ← `templates/mailbox/tab-templates-domains.twig`,
`js/site/mailbox.js` `draw_templates_domain_table`.

| Element | Legacy key |
|---|---|
| title, navigation entry | `mailbox.domain_templates` |
| add action / refresh | `mailbox.add_template` / `admin.refresh` |
| search label, loading, empty, no match | `datatables.search`, `datatables.loadingRecords`, `datatables.emptyTable`, `datatables.zeroRecords` |
| columns | "ID" (hard-coded), `mailbox.template`, `mailbox.max_aliases`, `mailbox.max_mailboxes`, `mailbox.max_quota`, `mailbox.domain_quota_total`, `mailbox.gal`, `mailbox.backup_mx`, `mailbox.relay_all`, `mailbox.relay_unknown`, `mailbox.active`, `mailbox.action`; details `edit.ratelimit` ("∞" without one), `mailbox.dkim_domains_selector`, `mailbox.dkim_key_length`, `add.tags` |
| row actions (no Remove for Default) | `mailbox.edit`, `mailbox.remove` |
| removal confirmation | `footer.confirm_delete`, `footer.delete_these_items`, `footer.delete_now`, `footer.cancel` |
| new strings | `domainTemplates.list.count`, `domainTemplates.list.detailsOf`, `domainTemplates.default` (the Default mark), `domainTemplates.fields.id`, `domainTemplates.sort.*` (the sort control, FR-049), `domainTemplates.delete.keepValues` (US6-AS4), `domainTemplates.delete.changed` and `notDeletedTitle` (outdated and refused removals), `domainTemplates.detail.*` and `domainTemplates.create.loadFailed` (page states), `domainTemplates.edit.gone`, `domainTemplates.edit.defaultName` (FR-053) |

**Add template** (`/domain-templates/new`) ← `templates/modals/mailbox.twig`
#addDomainTemplateModal: `mailbox.template`, `add.tags`, `add.max_aliases`, `add.max_mailboxes`,
`add.mailbox_quota_m`, `add.domain_quota_m`, `add.gal` + `add.gal_info`,
`add.active`, `edit.ratelimit` + `ratelimit.*`, `admin.dkim_domains_selector`,
`admin.dkim_key_length`, the `edit.*` relay keys as that form has them, action `admin.add`.

**Edit template** (`/domain-templates/:id`) ← `templates/edit/domain-templates.twig`, title
`edit.title` with the template name: `mailbox.template` (read-only for Default), `add.tags`,
`edit.max_aliases`, `edit.max_mailboxes`, `edit.max_quota`,
`edit.domain_quota`, `edit.gal` + `edit.gal_info`, `edit.active`, `edit.ratelimit` + `ratelimit.*`,
`admin.dkim_domains_selector`, `admin.dkim_key_length`, the `edit.*` relay keys, save
`admin.save`, back link `edit.previous`.

### Legacy form map, part 2: messages

| API outcome | Legacy key (placeholder) |
|---|---|
| `createDomain` 201 | `success.domain_added` (ASCII name); before it, per report step: `success.rl_saved` (name), `success.dkim_added` (name) or `success.domain_add_dkim_available`, `danger.dkim_domain_or_sel_invalid` (name) for a failed key; a failed restart replaces "added" with `warning.domain_added_sogo_failed` |
| report steps legacy cannot report | new strings `domains.outcome.rateLimitFailed`, `domains.outcome.dkimDnsNoZone`, `domains.outcome.dkimDnsFailed` (name) |
| `domain-exists` | `danger.domain_exists` (the name as typed) |
| `name` with `reserved` / invalid name (client or API) | `danger.domain_cannot_match_hostname` / `danger.domain_invalid` |
| `updateDomain` 200 | `success.domain_modified` (ASCII name) |
| `deleteDomain` 204 | `success.domain_removed` (name, through `domains.delete.success`) |
| `createDomainTemplate` 201 / `updateDomainTemplate` 200 | `success.template_added` / `success.template_modified` (template name) |
| `deleteDomainTemplate` 204 | `success.template_removed` (template ID) |
| `domain-template-name-exists` | `danger.template_exists` (the name as typed) |
| empty template name (client) | `danger.template_name_invalid` |
| outdated (412), gone (404), refused attributes, temporary failures | UI 001's generic and the feature's new strings (no legacy equivalent) |

### Legacy form map, part 3: deviations

Owner decision (2026-10-18), the one exception to "follow the legacy form": the domain's default
mailbox quota is dropped from every domain and domain template form, the domain list, the usage
figures and the sort keys, and is never sent or read; the API removes it (wt/002q).

Decided by the orchestrator (2026-10-18) and applied: one form per legacy form and one section per
legacy tab; quotas in MiB; no stepper, review or template-overwrite confirmation; legacy's edit
heading with the name and no badges; deletion only in the list; usage figures and domain
administrators kept display-only with the list's keys; outcomes as legacy's alerts; relayhost and
rate limit read-only in their legacy positions; removing selected templates uses the API's bulk
operation of gap G40 (T087a). Relay options are independent checkboxes as in legacy (the API normalises them on save),
so the automatic switching and its notice of the first build are gone.

Closed with the runtime legacy texts (UI main d128215): the domain list and the bulk actions use the
keys listed above, and legacy's HTML values (`*_info`, `add.post_domain_add`,
`edit.domain_footer_info`) are rendered with their markup through `<LegacyText>`.

## Project Structure

### Documentation (this feature)

```text
specs/002-domains/
├── spec.md              # Feature specification (clarifications, parity), aligned by this plan
├── plan.md              # This file
├── research.md          # Phase 0: decisions D1–D30 (feature-specific only)
├── data-model.md        # Phase 1: consumed data, view models, query keys, forms, routes, states, i18n
├── quickstart.md        # Phase 1: validation guide
├── contracts/README.md  # Phase 1: contract pin, operations used, problem handling
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root, new or changed by this feature)

```text
contract/{openapi.yaml,openapi.json,VERSION.json}     # bumped (D1)
src/api/generated/schema.ts                           # regenerated
src/api/query/keys.ts                                 # + domains, domain-templates keys
src/app/
├── router/{index.ts,focus.ts}                        # scrollBehavior; focus without scrolling (D9)
├── layouts/ShellLayout.vue                           # meta.roles check (D4)
├── navigation/catalogue.ts                           # domains available; + domainTemplates (D5)
└── states/NotFoundPage.vue                           # optional back link (FR-004)
src/features/domains/
├── index.ts  routes.ts
├── api.ts  templates-api.ts  capabilities.ts
├── list-state.ts  templates-list-state.ts
├── permissions.ts  domain-name.ts  quota.ts  relay.ts  tag-set.ts  usage.ts  patch.ts
├── create-form.ts  template-form.ts  defaults.ts  footer.ts  bulk.ts  creation-report.ts
├── composables/{useStepper,useCreateDomain,useDomainSectionSave,useDomainDeletion,
│                useDomainBulk,useTemplateBulkDelete,useTagSuggestions}.ts
├── components/
│   ├── fields/{DomainNameField,QuotaField,LimitField,RelayOptionsField,TagSetInput,
│   │           RateLimitField,DkimFields,TemplateSelect}.vue
│   ├── list/{DomainList,DomainCard,DomainTable,DomainEntryDetails,DomainFilters,
│   │         DomainSortControl,DomainNameText,RelayBadge,ActiveBadge,UsageMeter,TagChips}.vue
│   ├── detail/{DomainHeader,UsageSummary,FooterSummary,DomainAdminsList,CreationReport}.vue
│   ├── detail/sections/{GeneralSection,TagsSection,LimitsSection,RelaySection,
│   │                    GroupwareSection,DeliverySection}.vue
│   ├── create/{CreateStepper,CreateSectionIndex,CreateReview}.vue
│   ├── delete/{DeleteImpact,DeleteBlockers,BulkDeleteImpact,BulkDeactivateList}.vue
│   ├── footer/{ExclusionFields,PlaceholderReference,TextSizeIndicator}.vue
│   └── templates/{TemplateList,TemplateCard,TemplateTable,TemplateEntryDetails,
│                  TemplateNameSection,TemplateLimitsSection,TemplateOptionsSection,
│                  TemplateDkimSection}.vue
└── pages/{DomainListPage,DomainCreatePage,DomainDetailPage,DomainFooterPage,
           TemplateListPage,TemplateCreatePage,TemplateDetailPage}.vue
src/features/home/components/ScopeSummary.vue         # domain names link to their pages (entry point)
src/features/audit-log/{list-state.ts,labels.ts}      # targetType/targetId; domain labels
src/features/audit-log/components/{AuditFilters,ActiveFilterChips}.vue
src/features/api-keys/pages/ApiKeyDetailPage.vue      # History link (UI 001 R20)
src/shared/
├── components/{EditableSection,BulkActionBar,BulkResultSummary,HistoryLink}.vue   # new
├── components/{ConfirmDialog,PaginationBar}.vue      # requireTyped + content; first/last if missing
├── composables/{useBulkSelection,useLeaveGuard}.ts   # new
├── composables/{useConfirm,useVersionedSave,useProblemForm}.ts   # extended
├── validation/limits.ts                              # + domain list tag filter limit (100)
└── icons/                                            # + domain template icon
src/i18n/
├── format.ts  problems.ts                            # formatBytes; parameter formatting
├── coverage.json                                     # new (D2)
├── messages/{en-gb,cs-cz,sk-sk}.json  legacy-messages.ts   # new strings; runtime-built legacy keys
scripts/i18n/{lib.mjs,check.mjs}                      # coverage manifest folded into the check
scripts/run-lhci.mjs                                  # + /ng/domains collection
tests/
├── unit/features/domains/…  unit/shared/…  unit/scripts/i18n-tools.spec.ts  unit/i18n/…
├── unit/mocks/domain-handlers.spec.ts
├── mocks/handlers/{domains,domain-templates}.ts  mocks/handlers/{audit,index}.ts
├── mocks/factories/{domain,domain-template,domain-footer}.ts  mocks/factories/audit-event.ts
├── mocks/scenarios/domains-{base,list,create,edit,delete,bulk,footer,history}.ts
├── mocks/scenarios/domain-templates.ts  mocks/scenarios/{state,index}.ts  mocks/server.ts
├── e2e/fixtures/mock-api.ts                          # + domain, template and footer mutations
├── e2e/domains/{list,detail,create,edit,permissions,delete,bulk,footer,history,
│                reflow-and-keyboard}.spec.ts
├── e2e/domain-templates/{templates-list,templates-edit}.spec.ts
├── e2e/audit-log/target-filters.spec.ts
├── smoke/fixtures/domains-api.ts                     # set-up and clean-up through the real API
└── smoke/{domains-browse,domains-create,domains-edit,domains-delete,domains-bulk,
           domains-footer,domains-history,domain-templates}.smoke.spec.ts
```

**Structure Decision**: UI 001's single static frontend. This feature adds one feature folder
(D3), extends UI 001's core only where the conventions or UI 001 R20 place an entry point or a
reserved primitive, and keeps every domain-specific module inside `src/features/domains/`.

## Complexity Tracking

No new violation. UI 001's two rows (default brand colours until API 013; the smoke gate) still
apply. For this feature the smoke suite runs against an API that implements feature 002, because
the implementation waits for it (D1).
