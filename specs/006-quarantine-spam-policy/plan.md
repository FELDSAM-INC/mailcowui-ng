# Implementation Plan: Quarantine, Spam Policy and Rate Limits

**Branch**: `main` (no feature branches, constitution 1.1.0) | **Date**: 2026-10-18 |
**Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-quarantine-spam-policy/spec.md`

## Summary

UI feature 006 adds the quarantine, spam policy and rate limit screens to mailcowui-ng:

- **Quarantine list** for every role, scoped by the API. It has search, filters, sort, paging, cards
  on phones and a table on wide screens, plus the quarantine status notice.
- **Quarantine item page**. It shows the filter result, the symbols and the content as inert,
  bidi-isolated plain text. It offers attachment and whole-message downloads that are always
  saved as files, and the actions "Deliver to inbox" (with or without learning), "Learn as spam
  and delete" and "Remove", each with the step report.
- **Bulk actions** on up to the bulk limit of items, with one result per item.
- **Notification settings**: the mailbox user's Notifications page, the panel on a mailbox's
  "Spam filter and limits" page, and two bulk actions in UI 003's mailbox list.
- **Spam score and allow/block lists**: the mailbox user's Spam filter page, and the "Spam filter
  and limits" pages of domains, alias domains and mailboxes.
- **Rate limits**: a panel on each object page, the Rate limits overview, "Set a rate limit" and
  the bucket reset.
- **Quarantine settings**: four sections, each with its own versioned save, and a source-only
  template editor.
- **Spam filter statistics**: a text list with shares and bars.
- **History**: the audit records of this feature in UI 001's audit log, and the links that open it.
- **Entry points** into the screens of UI 002, 003 and 004.

The technical approach (details in [research.md](./research.md)):

- **No new runtime dependency.** The feature uses UI 001's stack, client, query policy, i18n and
  primitives, and UI 002–004's shared blocks: bulk selection, bar and result summary, editable
  sections with conflict marking, History links and the domain picker.
- **Contract**: the pin moves to mailcow-rest-v2 commit `32079252` or later (R1). The feature uses
  38 of API 006's 42 operations and six reads of API 001–004
  ([contracts/README.md](./contracts/README.md)). Every limit comes from
  `getQuarantineCapabilities` (R8).
- **Three feature areas**, mirroring the contract modules (R4): `src/features/quarantine/`,
  `src/features/spam-filter/` and `src/features/rate-limits/`.
- **Safety**:
  - message data renders only through a new shared `PlainText.vue`, which isolates bidi text and
    shows control and override characters as visible markers (R9);
  - downloads are fetched as blobs and saved as `application/octet-stream`, never displayed (R10);
  - iOS data detectors are turned off app-wide (R9).
- **Forms**:
  - locale-aware decimal input with exact tenths arithmetic for spam scores (R17, R18);
  - per-section merge patches with `If-Match` and UI 002's conflict marking (R21);
  - a page-only bulk selection, as `docs/conventions.md` and UI 003 require (R15; spec aligned).
- **Tests**:
  - Vitest units, including the SC-005 permission matrix and a corpus of at least 50 hostile
    messages;
  - Playwright tests of every acceptance scenario on 360 px and desktop with axe in both themes,
    against the contract-validated mock (extended for binary downloads);
  - a smoke suite against the API dev stack, with seeded quarantine data and mailpit (R28).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict) and Vue 3.5 SFCs; Node.js 24 LTS (001-R2).

**Primary Dependencies**: unchanged from UI 001 (R1 there). This feature adds none. It uses
`openapi-fetch`'s `parseAs: 'blob'`, Reka UI `Dialog`, `AlertDialog`, `RadioGroup`, `Checkbox`,
`Collapsible`, `DropdownMenu` and `Combobox` (without its viewport, 001-R18), and the native
`Intl` API.

**Storage**: none on a server. In the browser: the in-memory query cache only. No new Pinia store
and no new device-storage key (data-model §4, FR-085).

**Testing**:

- Vitest and Vue Test Utils for units and components, in TDD order.
- Playwright `mobile-chromium` (360 × 780), `desktop-chromium` (1366 × 900) and `mobile-webkit`,
  against the production build with the production CSP and the contract-validated mock.
  Every test runs axe in both themes, with CSP, horizontal-scroll and touch-target checks.
- A smoke project against the mailcow-rest-v2 dev stack, with API 006 implemented and seeded.
- Lighthouse CI gains `/ng/quarantine`, and `i18n:check` gains the 006 enumerations.

**Target Platform**: as UI 001: the two latest major versions of evergreen browsers, including iOS
Safari and Chrome for Android, served under `/ng/` by the `ng-mailcow` image.

**Project Type**: web application (a static SPA). The backend is the separate mailcow-rest-v2
repository.

**Performance Goals**:

- SC-010: the first list page is visible within 2 s of opening when the API answers within 1 s,
  and search results update within 1 s after the user stops typing (`SearchField` submits after a
  500 ms pause).
- SC-001: find and deliver a message in under 1 minute at 360 px.
- Lighthouse mobile scores of at least 80 for performance and 90 for accessibility on `/ng/quarantine`. The initial JavaScript stays at most
  200 KB gzipped, because every route of this feature is lazy.

**Constraints**:

- Constitution V: no message data as markup, and no request caused by message data (SC-002).
- A strict CSP: bound `:style` for the band and bar widths only (001-R18).
- Every limit from the capabilities read.
- A page-only bulk selection.
- No automatic repeat of any item action (SC-007).
- No timer refresh of the list (FR-086).

**Scale/Scope**:

- 9 user stories: 2 at P1, 5 at P2 and 2 at P3.
- 10 routes, and entry points into 5 screens of UI 002–004.
- 44 contract operations: 38 of API 006 and 6 of API 001–004.
- Every language mailcow ships, with mailcow's own texts used verbatim through their legacy keys,
  and new strings (en-gb, cs-cz, sk-sk) only for elements the classic interface lacks (fewer than
  the 350 first estimated, because legacy keys now replace the refined ones).
- The API is sized for 100,000 quarantine items, and no screen loads more than one page.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Gate | Status |
|---|---|---|
| I. The API contract is the only interface | Only operations of the pinned contract are used (contracts README), through `@/api`. The pin moves forward by `scripts/contract/bump.sh` with the bump rule of R1, then typecheck and the tests run. No hand-written API type: problem extension members are read through guards over the generated types. Gaps are recorded below and never worked around: list-entry history is not filtered client-side, and audit `details` are not typed from the API's data model (R23). Errors are handled from `type` and `errors`, including `requiredFlags`, `requiredFlagsMatch`, `attributes`, `dependency`, `step`, `smtpResponse`, `size` and `limit` (R24). | PASS |
| II. Mobile-first | Every screen is designed at 360 px first: cards below `md`, a full-screen filter panel, full-screen section forms, and a sticky action bar and bulk bar with scroll padding. Destructive actions are confirmed with their impact, and bulk deletions require typing the count (conventions). Every list and panel has loading, empty and error states. No horizontal scroll at 360 or 320 px, or at 400 % zoom (FR-072). | PASS |
| III. Accessibility (WCAG 2.2 AA) | axe in both themes on every screen and state. Status is never colour alone: badges, the band, bars and outcomes carry text (FR-079). Sortable headers have `aria-sort`. Dialogs are Reka. Announcements go through `useAnnouncer`. 44 × 44 targets, including the selection checkboxes. Focus is never hidden behind the sticky bars (R13). | PASS |
| IV. i18n and branding | Constitution IV 1.3.0 (see "Translations and forms" below): every language mailcow ships; texts with a classic-interface equivalent are mailcow's own, used verbatim by legacy key, loaded at runtime from the installation, with marked-up values rendered whole through `SanitizedHtml.vue` (no `stripMarkup` or `segment`, R27); the screens mirror the legacy forms; new strings only where legacy has none, in en, cs and sk, never machine-translated. `i18n:check` covers the new strings, the legacy keys used (against the `en-gb` snapshot) and the 006 enumerations (R2). Numbers, scores, sizes and dates use `Intl` in the user's locale (FR-081). Message data is never translated (FR-082). Nothing brand-specific is hard-coded; legacy texts that name the product are shown as the installation has them. | PASS |
| V. Security in the browser | No `v-html`. Message data renders only through `PlainText` with bidi isolation and visible control markers (R9). No storage of content, attachments or files (FR-085). Downloads are octet-stream blobs, never opened (R10). The external lookup carries only the hash, with no referrer (R11). Hiding is a convenience, and 401, 403 and 404 are handled (R7). | PASS |
| VI. Test-first | `tasks.md` puts mock fixtures, then failing tests, before the implementation in every phase. Every acceptance scenario gets an end-to-end test on both viewports against the validated mock, which is extended for binary bodies. Unit tests cover the matrix (SC-005), the hostile corpus (SC-002), parsing and arithmetic. A smoke suite runs against the real API. | PASS |
| VII. Performance budgets | Lazy routes; the initial JS is unchanged and checked by `budget:check`. Lighthouse covers `/ng/quarantine`. The query policy: no focus or timer refetch, invalidation after mutations, and a 60 s `gcTime` for item details (R25). | PASS |
| VIII. Simplicity | No new dependency. Shared additions only where two or more uses exist: `PlainText` (quarantine plus audit log), `download.ts` (attachments plus `.eml`), `parse.ts` and `LocaleNumberField` (scores, score limit, filters, whole numbers). Single-use parts stay in their feature. The template preview, which the spec does not ask for, is not built (R3). | PASS |
| Technology constraints | Only the stack and TailAdmin primitives already copied. No chart library. No CDN request: the VirusTotal link is a user-opened link, not a request by the app. | PASS |
| Workflow and gates | Commits go to `main`. CI gates are unchanged. The smoke job can become a gate for this feature once the API 006 implementation runs in the dev stack (UI 001 Complexity Tracking). | PASS |
| `docs/conventions.md` | Wording ("the classic interface"). Lists: state in the address, sizes 25/50/100, cards and tables, and all states. **Bulk**: page-only selection, `BulkTarget` with version tags, per-item summary, failed and outdated items stay selected, "outcome unknown" never retried (R15; the spec is aligned). Editing: per-section save, changed fields with `If-Match`, conflict marking. Confirmations: single deletion with impact; bulk deletion with the typed count. History through `targetType` and `targetId` (R23). Errors and rule codes translated. Controls hidden or read-only by flags. Entry points through the hosts' action areas once the target exists (R26). Capabilities from the API (R8). | PASS |

**Post-design re-check (after Phase 1)**: PASS. The data model, contracts README and quickstart
introduce no violation. Decisions that touched gates:

- Visible markers instead of silent stripping for control and bidi characters: V and FR-082 (R9).
- Blob downloads instead of direct links: V, and FR-038's translated errors (R10).
- `format-detection` off app-wide: V and FR-083 (R9).
- Page-only selection overriding the spec's clarification: conventions (R15).
- No template preview: VIII and FR-063 (R3).

## Translations and forms (constitution IV 1.3.0)

The owner rule of 2026-10-18 (`docs/conventions.md`, "Translations and forms") applies to every
screen of this feature, and it overrides any earlier text in this plan, the spec, research and
tasks.

**Legacy forms mirrored** (paths under `../mailhosting/data/web/`):

- **Quarantine list** (`/quarantine`): `templates/quarantine.twig` (title `quarantine.quarantine`,
  `quarantine.refresh`, `quarantine.qinfo`, `quarantine.disabled_by_config`,
  `quarantine.settings_info` with the retention count and the maximum size in MiB, the
  `quarantine.toggle_all` and `quarantine.quick_actions` menus) and `js/site/quarantine.js` (table
  `quarantinetable`: columns `qid`, `sender`, `subj`, `rspamd_result`, `rcpt`, `danger`,
  `spam_score`, `notified`, `received`, `action`; badges `high_danger`, `neutral_danger`,
  `rejected`, `junk_folder`, `rewrite_subject`; row actions `show_item`, `remove`). Entry:
  `data/web/quarantine.php`.
- **Quarantine item page** (`/quarantine/:itemId`): `templates/modals/quarantine.twig` (`qitem`,
  `rspamd_result`, `spam_score`, `subj`, `recipients`, `sender_header`, `sender`,
  `text_plain_content`, `text_from_html_content`, `atts`, `check_hash`, actions `deliver_inbox`,
  `learn_spam_delete`, `download_eml`, `remove`), filled by `js/site/quarantine.js` and
  `inc/ajax/qitem_details.php`.
- **Bulk actions on the list**: the mass-action menus of `templates/quarantine.twig`.
- **Quarantine and item messages**: `inc/functions.quarantine.inc.php`: `success.item_released`,
  `success.learned_ham`, `success.qlearn_spam`, `success.item_deleted`, `success.saved_settings`,
  `danger.release_send_failed`, `danger.ham_learn_error`, `danger.spam_learn_error`,
  `warning.fuzzy_learn_error`, `danger.access_denied`.
- **Notifications** (own page, mailbox panel, mailbox list bulk actions):
  `templates/user/tab-user-settings.twig` and `templates/edit/mailbox.twig`
  (`user.quarantine_notification`, `user.quarantine_category`, options `user.never`,
  `user.hourly`, `user.daily`, `user.weekly`, `user.q_reject`, `user.q_add_header`, `user.q_all`,
  with `user.quarantine_notification_info` and `user.quarantine_category_info`), and the mass-action
  menu of `templates/mailbox/tab-mailboxes.twig` (header `mailbox.quarantine_notification`) with
  `js/site/mailbox.js`. Messages: `inc/functions.mailbox.inc.php` (`success.mailbox_modified`,
  `danger.quarantine_category_invalid`).
- **Spam filter** (own page; "Spam filter and limits" of domains, alias domains and mailboxes):
  `templates/user/Spamfilter.twig` (`user.spamfilter`, `user.spamfilter_behavior`,
  `user.spamfilter_green`, `_yellow`, `_red`, `user.save_changes`, `user.spam_score_reset`,
  `user.spamfilter_wl`, `user.spamfilter_wl_desc`, `user.spamfilter_bl`, `user.spamfilter_bl_desc`,
  `user.spamfilter_table_add`, `mailbox.toggle_all`, `mailbox.quick_actions`, `mailbox.remove`),
  the `#dspamfilter` tab of `templates/edit/domain.twig` (`edit.spam_filter`), and the list tables
  of `js/site/user.js` and `js/site/edit.js` (`user.spamfilter_table_rule`,
  `user.spamfilter_table_domain_policy`). Messages: `inc/functions.policy.inc.php`
  (`danger.policy_list_from_exists`, `danger.policy_list_from_invalid`, `success.domain_modified`,
  `success.mailbox_modified`, `success.item_deleted`, `success.items_deleted`) and
  `inc/functions.mailbox.inc.php` for the spam score (`success.mailbox_modified`).
- **Rate limit panels**: the `#dratelimit` tab of `templates/edit/domain.twig`, the rate limit form
  of `templates/edit/aliasdomain.twig` and `templates/edit/mailbox.twig` (`edit.ratelimit`, the
  value placeholder `ratelimit.disabled`, the frame options of `templates/mailbox/rl-frame.twig`:
  `ratelimit.second`, `minute`, `hour`, `day`; `edit.mbox_rl_info` on the mailbox). Messages:
  `inc/functions.ratelimit.inc.php` (`success.rl_saved`, `danger.rl_timeframe`,
  `success.hash_deleted`, `warning.hash_not_found`).
- **Bucket reset**: the rate-limited log of `templates/dashboard.twig` (`admin.reset_limit`,
  `admin.hash_remove_info`) and `js/site/dashboard.js`.
- **Quarantine settings** (`/quarantine/settings`): `templates/admin/tab-config-quarantine.twig`
  (`admin.quarantine`, `quarantine.disabled_by_config`, `admin.quarantine_retention_size`,
  `_max_size`, `_max_score`, `_max_age`, `_redirect`, `_bcc`, `_notification_sender`,
  `_notification_subject`, `_release_format` with `_raw` and `_att`, `tfa.select`,
  `_exclude_domains`, `_notification_html`, `admin.save`), in that order. The four sections keep
  the legacy field order. Messages: `success.saved_settings`.
- **Statistics** (`/quarantine/statistics`): the Rspamd chart of `templates/dashboard.twig`
  (`debug.chart_this_server`) and `js/site/dashboard.js` (`rspamd/actions`).

**Screens or elements without a legacy counterpart** get new strings (en-gb, cs-cz and sk-sk, never
machine-translated), kept minimal: the Rate limits overview, the list filters other than the
legacy column labels, the item page's added fields (size, sending server, authenticated sender),
the learning switch, the virus acknowledgement and the step report (FR-026 to FR-029), the
"Not set" category, the spam score field labels and server-default note, the inherited-group
labels, the template editor's placeholder reference, size indicator and restore confirmation, the
statistics period lines, the bulk summaries, outdated-version handling and the History records.
Fields legacy has on another form (for example the domain spam lists' labels on alias domain and
mailbox pages) use that form's legacy keys.

**Deviation-free rule**: these screens add, drop, rename, reword or reorder nothing relative to the
legacy forms above, except the conventions' improvements (sections with their own save, typed
confirmations, bulk mode, outdated-version handling). Labels, help and info texts (`*_info`),
placeholders, option labels, units (MiB for sizes, as legacy), order and grouping, column headers,
action labels and success, warning and danger messages come from the legacy keys. Every mailcow
language is supported. Legacy values are loaded at runtime from the installation and shown verbatim:
marked-up values such as `quarantine.qinfo`, `user.spamfilter_wl_desc` and the
`admin.quarantine_*` labels with their `<br><small>` help go whole through `SanitizedHtml.vue`, and
are never split or stripped. A missing key falls back to `en-gb`, never to a hand-written value.

**Legacy form map**: below (T009a, 2026-10-19), in three parts. Legacy keys are read at runtime
from the installation's `/lang/` files through UI 001's accessors: `<LegacyText k>` and `lt()` in
the screens, `legacy()` in route titles and column tables, and `LEGACY_TEXTS`
(`src/i18n/legacy-messages.ts`, with `LEGACY_ARGS` for the placeholders) for keys built at runtime:
enumeration values, sort fields, problem types, rule codes and audit labels. Values marked "markup"
render whole through `<LegacyText>` and `SanitizedHtml.vue`. Texts that the classic templates or
scripts hard-code are new strings whose English equals legacy's (marked "hard-coded"). New strings
use `quarantineUi.*` for the quarantine screens (`quarantine` is a legacy section, so the app adds
no key under it), `spamFilter.*` and `rateLimits.*`, plus the app's shared `problem.*`,
`validation.*`, `enums.*` and `auditLog.*`. No new-string namespace equals a legacy section name.
Strings that UI 001–004 already have (`bulk.*`, `lists.*`, `history.link`, `problem.*`,
`validation.*`) are reused as they are. Part 3 applies the orchestrator's decisions of 2026-10-18.
Where it settles a deviation, it overrides the paragraphs above, research R12–R22 and the spec
requirements it names, and the tasks follow it.

**Deviations needing a decision**: see "Legacy form map, part 3". It keeps the eight deviations
listed here before T009a, under the same numbers, and adds the ones the map found (9 to 23).

### Legacy form map, part 1: fields and elements

Paths are under `../mailhosting/data/web/`. In `js/site/*.js`, `lang.<key>` is the page's section:
`lang_quarantine` on `templates/quarantine.twig`, `lang_user` on the user pages, and `lang_admin`
on `templates/dashboard.twig`; `js/site/edit.js` names `lang_user` explicitly. Rows marked "D<n>"
depend on deviation n of part 3.

**1. Quarantine list** (`/quarantine`) ← `templates/quarantine.twig`, `js/site/quarantine.js`
`draw_quarantine_table()`; entry point `data/web/quarantine.php`.

| Element | Legacy key |
|---|---|
| page title / navigation entry (UI 001 catalogue) | `quarantine.quarantine` / `header.quarantine` |
| count badge, refresh | the number only, as legacy's `table-lines` badge; `quarantine.refresh` |
| status notice, quarantine inactive | `quarantine.disabled_by_config` |
| status notice, quarantine active | `quarantine.settings_info` (markup `<br>`; two `%s`: `retentionPerMailbox`, and `maxMessageSize` ÷ 1,048,576 in MiB, both from `getQuarantineSettings`, as legacy fills them from `retention_size` and `max_size`) |
| explanation | `quarantine.qinfo` (markup), whole, behind a disclosure labelled `quarantine.info` (D18) |
| search, loading, empty, no match | `datatables.search`, `datatables.loadingRecords`, `datatables.emptyTable`, `datatables.zeroRecords` (with `lists.filters.clear`) |
| paging, page size, count (`PaginationBar`) | `datatables.info` (`_START_`, `_END_`, `_TOTAL_`), `datatables.infoEmpty`, `datatables.lengthMenu` (`_MENU_`: 25, 50, 100), `datatables.paginate.first`, `datatables.paginate.previous`, `datatables.paginate.next`, `datatables.paginate.last` |
| columns, in legacy order | "ID" (hard-coded; the app's `lists.id`), `quarantine.qid`, `quarantine.sender`, `quarantine.subj`, `quarantine.rspamd_result`, `quarantine.rcpt` (administrators and domain administrators), `quarantine.danger`, `quarantine.spam_score`, `quarantine.notified`, `quarantine.received`, `quarantine.action` (row actions; legacy hides this header on small screens) |
| empty subject, no score | "-", as legacy's item modal shows an empty subject (D19); a `null` score is "-", as legacy |
| action badge | `quarantine.rejected` (`rejected`), `quarantine.junk_folder` (`junk`), `quarantine.rewrite_subject` (`subjectRewritten`); for `other` the stored `filterAction` as data (legacy shows no badge; D17) |
| virus badge | `quarantine.high_danger` (virus found), `quarantine.neutral_danger` |
| notified | "✔" or "✖" (legacy's `&#10004;` and `&#10006;`), with `lists.filters.yes` or `lists.filters.no` for assistive technology |
| row actions | `quarantine.show_item`, `quarantine.remove` |
| card details disclosure (phones) | `quarantineUi.list.details` |
| selection mode | UI 002's `bulk.select`, `bulk.exitSelection`, `bulk.selected`, `bulk.selectItem`, `bulk.limitReached`; "select all on the page" is `quarantine.toggle_all` |
| bulk menu, items in legacy order | `quarantine.quick_actions`: `quarantine.deliver_inbox`, `quarantine.learn_spam_delete`, `quarantine.remove` (legacy's `datatables.expand_all` and `datatables.collapse_all` are dropped, D7) |
| no "Quarantine actions" permission | `acl.prohibited` + `acl.quarantine` (`AclReadOnlyNote`), instead of a written notice (D12) |
| filter panel (legacy has none) | `lists.filters.title`, `lists.filters.withCount`, `lists.filters.clear`, `lists.chips.*`, and "Apply" `lists.filters.apply` (new shared string, if `FilterPanel` is created here, P24) |
| filters and their options | action `quarantine.rspamd_result` (the badge keys, and `enums.quarantineItemAction.other`); virus `quarantine.danger` (`quarantine.high_danger`, `quarantine.neutral_danger`); notified `quarantine.notified` (`lists.filters.yes`, `lists.filters.no`); arrival `quarantine.received` with `quarantineUi.filters.receivedFrom` and `quarantineUi.filters.receivedTo`; score `quarantine.spam_score` with `quarantineUi.filters.scoreMin` and `quarantineUi.filters.scoreMax`; recipient `quarantine.rcpt`; domain `mailbox.domain` |
| sort control (phones) and sort fields | `lists.sort.label`, `lists.sort.order`, `lists.sort.asc`, `lists.sort.desc`; fields as their column keys through `LEGACY_TEXTS` (`quarantineUi.sort.<field>`): `arrivedAt` `quarantine.received`, `queueId` `quarantine.qid`, `score` `quarantine.spam_score`, `sender` `quarantine.sender`, `recipient` `quarantine.rcpt`, `subject` `quarantine.subj`, `action` `quarantine.rspamd_result`, `virus` `quarantine.danger`, `notified` `quarantine.notified`; `id` is `lists.id` |

**2. Quarantine item** (`/quarantine/:itemId`) ← `templates/modals/quarantine.twig`
`#qidDetailModal`, filled by `js/site/quarantine.js` (`.show_qid_info`) and
`inc/ajax/qitem_details.php`.
The fields keep legacy's order and headings, without the plan's group headings (D20).

| Element | Legacy key |
|---|---|
| page title, with the subject as the object's name | `quarantine.qitem` |
| back link, load error | `lists.backToList`; `quarantineUi.item.loadError` ("Error loading quarantine item", hard-coded in `js/site/quarantine.js`) with UI 001's retry |
| filter result | `quarantine.rspamd_result`; `quarantine.spam_score` with the score and the action badge (legacy's "<score> - <label>"); symbols as "name (score)" with the signed score, their options listed under each symbol (legacy: tooltip) |
| subject | `quarantine.subj` |
| recipients | `quarantine.recipients`; each "address (TYPE)" with `enums.quarantineRecipientSource.*` = "TO", "CC", "BCC", "SMTP" (hard-coded: legacy upper-cases the header name, and calls the envelope recipient `smtp`) |
| From header, SMTP sender | `quarantine.sender_header`, `quarantine.sender` |
| fields the API adds, after the sender (D17) | `quarantine.received`, `quarantine.danger` (the list's badges), `quarantine.notified`, "ID" (`lists.id`), `quarantine.qid`, `admin.message_size`, `quarantineUi.item.sourceAddress` ("IP address", hard-coded in `js/site/dashboard.js` for the same stored IP), `admin.authed_user` (administrators; the rate-limited log's label for the same Rspamd user) |
| fuzzy hashes | `quarantineUi.item.fuzzyHashes` ("Fuzzy Hashes", hard-coded in the template); "-" when none; UI 001's copy control |
| content | `quarantine.text_plain_content`, `quarantine.text_from_html_content`; a missing part is "-" as legacy; parser fallback `quarantineUi.item.parserFallback` ("Parser failed, assuming HTML", hard-coded in `inc/ajax/qitem_details.php`); too large `problem.quarantine-message-too-large`; long parts `quarantineUi.item.showFullText`, `quarantineUi.item.showLess` |
| attachments (only when `content.attachments` is present, legacy's `quarantine_attachments` ACL) | `quarantine.atts`; per file: the file name (download), its type in parentheses, `debug.size`, `quarantineUi.item.sha256` with a copy control, `quarantine.check_hash`; "-" when none |
| actions, in legacy order | `quarantine.quick_actions` (phones: the action bar with the same labels): `quarantine.deliver_inbox`, `quarantine.learn_spam_delete`, `quarantine.download_eml`, `quarantine.remove`; `quarantine.quick_release_link` and `quarantine.quick_delete_link` are dropped (D3) |
| actions the flags deny | `acl.prohibited` + `acl.quarantine`; downloads of a mailbox user also `acl.quarantine_attachments` |
| recipient | links to UI 003's mailbox page when `getMailbox` answers `200`; no text |

**Item actions and their confirmations** (`templates/modals/footer.twig` `#ConfirmDeleteModal`,
`js/build/011-api.js`):

| Action | Legacy | Texts |
|---|---|---|
| Remove, one item (row or item page) | `#ConfirmDeleteModal` with the item ID | `footer.confirm_delete`, `footer.delete_these_items`, the item (ID, subject and sender as `PlainText`), `footer.delete_now`, `footer.cancel` |
| Deliver to inbox, one item | sent at once; always learns as ham | D3 (open) |
| Learn as spam and delete, one item | sent at once | sent at once (D13) |
| Download (.eml), attachment download | opened at once | saved at once; virus warning D13 (open part) |
| Deliver to inbox, bulk | sent at once | bulk confirmation (conventions): title `quarantine.deliver_inbox`, the items (subject, recipient), `bulk.selected`, buttons `quarantine.deliver_inbox` and `footer.cancel`; learning choice and virus line D3 |
| Learn as spam and delete, bulk | sent at once | title `quarantine.learn_spam_delete`, the items, `bulk.confirm.typeCount`, buttons `quarantine.learn_spam_delete` and `footer.cancel` |
| Remove, bulk | `#ConfirmDeleteModal` | `footer.confirm_delete`, `footer.delete_these_items`, the items, `bulk.confirm.typeCount`, `footer.delete_now`, `footer.cancel` |
| bulk result | one toast per item | `BulkResultSummary` (`bulk.summary.title`, `bulk.summary.announce`, `bulk.count.*`, `bulk.outcome.*`, `bulk.retry`); each item's line as part 2; a bulk delivery with every item done: `success.items_released` |

**3. Quarantine notifications of a mailbox** ← `templates/user/tab-user-settings.twig` (mailbox
user: after the encryption policy) and `templates/edit/mailbox.twig` `#medit` (administrators and
domain administrators: after the tagged mail handling, before the encryption policy). They stay in
these legacy positions (D9, D10).

| Element | Legacy key |
|---|---|
| frequency (radio group, legacy order) | `user.quarantine_notification`: `user.never`, `user.hourly`, `user.daily`, `user.weekly`; help `user.quarantine_notification_info` |
| category | `user.quarantine_category`: `user.q_reject`, `user.q_add_header`, `user.q_all`; help `user.quarantine_category_info`; a mailbox without a stored category has no option selected, as legacy (D4) |
| save | the host section's save: `edit.save` in the mailbox page's "Mailbox" section; the mailbox user's host page has its own (D10) |
| read-only | `acl.prohibited` + `acl.quarantine_notification`, `acl.prohibited` + `acl.quarantine_category` |
| History (administrators) | `history.link` (`quarantineNotificationSettings`, the mailbox) |

No new strings: "Not set" and the effect note are not built (D4, D12).

**4. Mailbox list bulk actions** (UI 003's list) ← `templates/mailbox/tab-mailboxes.twig` (the
mass-action menu) and `js/build/011-api.js` (`edit_selected`, no confirmation).

| Element | Legacy key |
|---|---|
| menu group (one group for both settings, as legacy) | header `mailbox.quarantine_notification`; items in legacy order `user.hourly`, `user.daily`, `user.weekly`, `user.never`, a divider, then `user.q_reject`, `user.q_add_header`, `user.q_all` (D21) |
| bulk confirmation (conventions) | title `mailbox.quarantine_notification` for a frequency, `mailbox.quarantine_category` for a category; the chosen option's label; `bulk.selected`; buttons `quarantine.confirm` and `footer.cancel` |
| result | UI 003's `BulkResultSummary`; per mailbox as part 2 |

**5. Spam filter** (`/spam-filter`, mailbox users) ← `templates/user/Spamfilter.twig` and
`js/site/user.js` (`noUiSlider`, `draw_wl_policy_mailbox_table()`,
`draw_bl_policy_mailbox_table()`).

| Element | Legacy key |
|---|---|
| page title, navigation entry | `user.spamfilter` |
| score heading | `user.spamfilter_behavior` |
| score control | D5 (open): legacy's two-handle slider, or the plan's two fields `spamFilter.score.junkScore` ("Junk folder from") and `spamFilter.score.rejectScore` ("Reject from") |
| zones, in legacy order, each with its range | `user.spamfilter_green` with "< {junk}", `user.spamfilter_yellow` with "{junk} - {reject}", `user.spamfilter_red` with "> {reject}"; the range formats are hard-coded in `js/site/user.js`: `spamFilter.score.rangeBelow`, `spamFilter.score.rangeBetween`, `spamFilter.score.rangeAbove` |
| server defaults (fields the API adds, D17) | `user.spamfilter_default_score` with both values; `spamFilter.score.usingDefaults` when the mailbox has no custom values; `spamFilter.score.fallback` when `defaults.fallback` is set |
| save, reset | `user.save_changes`; `user.spam_score_reset`, without a confirmation (D13) |
| read-only | `acl.prohibited` + `acl.spam_score` |
| lists, in legacy order | `user.spamfilter_wl` + `user.spamfilter_wl_desc` (markup), then `user.spamfilter_bl` + `user.spamfilter_bl_desc` (markup); on phones the switch uses the two headings and each list's count |
| add | placeholder "*@example.org" (hard-coded: `spamFilter.lists.patternPlaceholder`), button `user.spamfilter_table_add` |
| search, loading, empty, no match, paging | the `datatables.*` keys of screen 1 |
| columns, in legacy order | "ID" (hard-coded, `lists.id`), `user.spamfilter_table_rule`, "Scope" (hard-coded: `spamFilter.lists.scope`), then `user.created_on` (a field the API adds, D17) |
| inherited rows (read-only, after the own rows) | `user.spamfilter_table_domain_policy`, legacy's title of their disabled checkbox, shown as text (D16) |
| sort | `lists.sort.*`; fields `user.spamfilter_table_rule` (pattern), `user.created_on` |
| selection and removal | `mailbox.toggle_all`, `mailbox.remove` (legacy's `mailbox.quick_actions` menu holds only expand and collapse, D7); confirmation `footer.confirm_delete`, `footer.delete_these_items` (the patterns), `footer.delete_now`, `footer.cancel`, and `bulk.confirm.typeCount` for several entries; results as screen 1 |
| read-only | `acl.prohibited` + `acl.spam_policy` |

**6. Spam filter and rate limits of domains, alias domains and mailboxes** — in the legacy
positions on the pages of UI 002, UI 004 and UI 003, not on separate pages (D9).

- **Domain page** (`/domains/:domain`) ← `templates/edit/domain.twig`, tabs in legacy order
  `edit.domain`, `edit.ratelimit` (`#dratelimit`), `edit.spam_filter` (`#dspamfilter`),
  `edit.quota_warning_bcc`, `edit.mta_sts`, `edit.domain_footer`; tables `js/site/edit.js`
  (`draw_wl_policy_domain_table()`, `draw_bl_policy_domain_table()`, `lang_user`).
- **Alias domain page** (`/alias-domains/:aliasDomain`) ← `templates/edit/aliasdomain.twig`: the
  edit form, then the rate limit form, then DKIM.
- **Mailbox page** (`/mailboxes/:address`) ← `templates/edit/mailbox.twig`, tabs `edit.mailbox`,
  `edit.custom_attributes`, `edit.pushover`, `edit.acl`, `edit.ratelimit` (`#mrl`), rename.

| Element | Legacy key |
|---|---|
| domain: "Rate limit" section (UI 002's read-only section becomes editable) | title and label `edit.ratelimit`; value with placeholder `ratelimit.disabled`; frame select from `templates/mailbox/rl-frame.twig`: `ratelimit.second`, `ratelimit.minute`, `ratelimit.hour`, `ratelimit.day`; save `admin.save` |
| alias domain: rate limit form, below the edit form | label `acl.ratelimit`; value and frame as above; save `admin.save` |
| mailbox: "Rate limit" section | title `edit.ratelimit`; label `acl.ratelimit`; value and frame as above; save `edit.save`; help `edit.mbox_rl_info` |
| rate limit read-only display | "<value> <frame label>" (for example "10 msgs / hour") or `ratelimit.disabled` |
| removing a limit | an empty value and the save, as legacy (D2); no new string |
| stored value in an invalid format (the API reports it, D17) | `rateLimits.invalidStoredValue` with the stored text |
| mailbox: the limit in effect (the API adds it, D17) | `rateLimits.effective.title` with the limit and its source label (`enums.rateLimitEffectiveSource.*`: `mailbox.mailbox`, `mailbox.domain`; none: `ratelimit.disabled`) |
| rate limit read-only reason | `acl.prohibited` + `acl.ratelimit` |
| domain: "Spam filter" section, after "Rate limit" | title `edit.spam_filter`; the lists of screen 5 (the domain tab has no `mailbox.quick_actions` menu: `mailbox.toggle_all` and `mailbox.remove`); inherited rows are the domain's mailboxes' entries, marked `user.spamfilter_table_domain_policy` as legacy marks them (D16) |
| alias domain: "Spam filter" section, after the rate limit (no legacy counterpart, D22) | `edit.spam_filter` and the domain tab's keys |
| mailbox: quarantine notification and category | screen 3, editable in the "Mailbox" section, where UI 003 shows them read-only until now |
| mailbox: "Spam filter" section after "Rate limit", for administrators and domain administrators (no legacy counterpart, D22) | title `user.spamfilter`; the score of screen 5 (`user.spamfilter_behavior`, the zones, `user.spamfilter_default_score`, `user.save_changes`, `user.spam_score_reset`) and its lists (inherited rows are the domain's entries, `user.spamfilter_table_domain_policy`) |
| mailbox: link to its quarantine (FR-007) | `header.quarantine` |
| History (administrators) | `history.link` on the rate limit, the spam score, the notification settings and each own list entry |

**7. Rate limits overview** (`/quarantine/rate-limits`) — no legacy counterpart (D1).

| Element | Legacy key |
|---|---|
| title, section navigation entry | `rateLimits.title` ("Rate limits"; legacy's "Ratelimits" card is the log of UI 011) |
| search, loading, empty, no match, paging | the `datatables.*` keys of screen 1 |
| kind filter | `mailbox.kind`, with `lists.filters.all` and `enums.rateLimitObjectKind.*` (`mailbox.domain`, `add.alias_domain`, `mailbox.mailbox`) |
| columns | `rateLimits.list.object`, `mailbox.kind`, `edit.ratelimit` (the read-only display of screen 6; an invalid stored value with `rateLimits.invalidStoredValue`) |
| sort | `lists.sort.*`; fields `rateLimits.list.object`, `mailbox.kind` |
| entry actions | `mailbox.edit` (opens the object page's rate limit), `history.link` |
| "Set a rate limit" | button and dialog title `rateLimits.set.title`; kind `mailbox.kind` with the kind labels; object picker labelled with the chosen kind, placeholder `tfa.select`; buttons `mailbox.edit` and `footer.cancel` |
| bucket reset | button and dialog title `admin.reset_limit`; text `admin.hash_remove_info` (markup, whole; D23); field `rateLimits.bucket.hash` ("Hash", hard-coded column of the rate-limited log); then legacy's confirmation of "Remove hash": `footer.confirm_delete`, `footer.delete_these_items` (the hash), `footer.delete_now`, `footer.cancel` |
| read-only | `acl.prohibited` + `acl.ratelimit` |

**8. Quarantine settings** (`/quarantine/settings`) ← `templates/admin/tab-config-quarantine.twig`
(System › Configuration › Quarantine). One section in legacy order with legacy's dividers, one save
(D11). The column "Plan section" shows where the plan put each field before T009a.

| # | Element | Legacy key | Plan section |
|---|---|---|---|
| | section title | `admin.quarantine` | |
| | quarantine inactive | `quarantine.disabled_by_config` (legacy shows nothing when active) | page top |
| 1 | retention per mailbox (placeholder 0) | `admin.quarantine_retention_size` (markup) | Storage and limits |
| 2 | maximum size in MiB (placeholder 0) | `admin.quarantine_max_size` (markup) | Storage and limits |
| 3 | notification score limit (placeholder 9999.0, locale-formatted) | `admin.quarantine_max_score` (markup) | Notification e-mail |
| 4 | maximum age in days | `admin.quarantine_max_age` (markup) | Storage and limits |
| | divider | | |
| 5 | redirect recipient | `admin.quarantine_redirect` (markup) | Notification e-mail |
| 6 | copy (BCC) recipient | `admin.quarantine_bcc` (markup) | Notification e-mail |
| | divider | | |
| 7 | sender (placeholder: the value that applies, `quarantine@localhost` from the API) | `admin.quarantine_notification_sender` | Notification e-mail |
| 8 | subject (placeholder: the value that applies, from the API) | `admin.quarantine_notification_subject` | Notification e-mail |
| | divider | | |
| 9 | release format (select, title `tfa.select`) | `admin.quarantine_release_format`: `admin.quarantine_release_format_raw` (`original`), `admin.quarantine_release_format_att` (`attachment`) | Release |
| 10 | excluded domains (searchable multi-select, placeholder `tfa.select`) | `admin.quarantine_exclude_domains`; a stored entry that no longer exists: `quarantineUi.settings.missingDomain` (D17) | Storage and limits |
| | divider | | |
| 11 | template (collapsed, opened by its label, as legacy's legend; monospace, never rendered) | `admin.quarantine_notification_html` (markup; its help "Leave empty to restore default template" is the restore, D14) | Template |
| | save | `admin.save` | each section |
| | History | `history.link` (`quarantineSettings`) | |

Legacy order inside the plan's four sections, for reference: Storage and limits 1, 2, 4, 10;
Release 9; Notification e-mail 3, 5, 6, 7, 8 (FR-059 listed 3, 7, 8, 6, 5); Template 11.

**9. Statistics** (`/quarantine/statistics`) ← the Rspamd tab of `templates/dashboard.twig` and
`rspamd_pie_graph()` in `js/site/dashboard.js`, which labels each slice with Rspamd's action name
and its share ("reject 12%"), untranslated in every language.

| Element | Legacy key |
|---|---|
| title, section navigation entry | `mailbox.stats` |
| refresh | `admin.refresh` |
| chart heading | `debug.chart_this_server`, only if the chart is kept (D8) |
| rows, in legacy order (hard-coded Rspamd names) | `quarantineUi.statistics.actions.rejected` ("reject"), `quarantineUi.statistics.actions.softRejected` ("soft reject", greylisting included as legacy adds it), `quarantineUi.statistics.actions.subjectRewritten` ("rewrite subject"), `quarantineUi.statistics.actions.movedToJunk` ("add header"), `quarantineUi.statistics.actions.noAction` ("no action"); Czech and Slovak keep the Rspamd names, as legacy shows them in every language |
| columns and total | `quarantine.action`, `quarantineUi.statistics.count`, `quarantineUi.statistics.share` (percentage, `Intl`), `quarantineUi.statistics.total` |
| counting period (fields the API adds, D17) | `quarantineUi.statistics.countedSince`, `quarantineUi.statistics.countedSinceUnknown`, `quarantineUi.statistics.runningSince` |
| spam filter unreachable | `problem.service-unavailable` with UI 001's retry |

**10. History** (UI 001's audit log; no legacy counterpart, conventions "History and audit"). The
app's keys are `enums.auditEventType.*`, `enums.auditTargetType.*` and `auditLog.detailKeys.*`
(`src/features/audit-log/labels.ts`).

| Element | Legacy key, or new string |
|---|---|
| event types (new strings) | `quarantineItemRelease` "Quarantine item released", `quarantineItemSpamLearning` "Quarantine item learned as spam", `quarantineItemDeletion` "Quarantine item removed", `quarantineSettingsUpdate` "Quarantine settings changed", `quarantineNotificationSettingsUpdate` "Quarantine notifications changed", `spamScoreUpdate` "Spam score changed", `spamScoreReset` "Spam score reset to server default", `spamPolicyEntryCreation` "Allowlist or denylist entry added", `spamPolicyEntryRemoval` "Allowlist or denylist entry removed", `rateLimitUpdate` "Rate limit set", `rateLimitRemoval` "Rate limit removed", `rateLimitBucketReset` "Rate limit hash removed" |
| target types | `quarantineItem` `quarantine.qitem`, `quarantineSettings` `admin.quarantine`, `quarantineNotificationSettings` `user.quarantine_notification`, `spamScore` `acl.spam_score`, `rateLimit` `edit.ratelimit` (all through `LEGACY_TEXTS`); new: `spamPolicyEntry` "Allowlist or denylist entry", `rateLimitBucket` "Rate limit hash" |
| detail keys of API 006 (`docs/audit-events.md`, T125) | `queueId` `quarantine.qid`, `recipient` `mailbox.recipient`, `sender` `mailbox.sender`, `action` `mailbox.action`, `pattern` `user.spamfilter_table_rule`, `kind` `mailbox.kind` (through `LEGACY_TEXTS`); new: `list` "List", `entryId` "Entry ID", `old` "Old value", `new` "New value", `countersExisted` "Counters existed", `logEntriesRemoved` "Log entries removed"; `steps`, `changes` and `bulkRequestId` exist |

**11. Quarantine section navigation** (`QuarantineSectionNav`; legacy has one page per screen).

| Entry | Legacy key, or new string |
|---|---|
| landmark label | `quarantineUi.nav.label` ("Quarantine sections") |
| list | `quarantine.quarantine` |
| notifications (mailbox users, only while D10's interim applies) | `user.quarantine_notification` |
| rate limits | `rateLimits.title` |
| settings | `header.mailcow_config` (the legacy menu that leads to the settings; the page's heading is `admin.quarantine`) |
| statistics | `mailbox.stats` |

The route titles of data-model §5 use these keys instead of the `quarantine.*` new-string keys
written there before T009a.

**Enumeration labels** (`enums.<enumeration>.<value>`, namespaces as `scripts/i18n/lib.mjs`
derives them; legacy keys through `LEGACY_TEXTS`):

| Enumeration | Labels |
|---|---|
| `QuarantineItemAction` | `rejected` `quarantine.rejected`, `junk` `quarantine.junk_folder`, `subjectRewritten` `quarantine.rewrite_subject`, `other` new "Other" |
| `QuarantineNotificationFrequency` | `user.never`, `user.hourly`, `user.daily`, `user.weekly` |
| `QuarantineNotificationCategory` | `rejected` `user.q_reject`, `junk` `user.q_add_header`, `all` `user.q_all` |
| `QuarantineReleaseFormat` | `original` `admin.quarantine_release_format_raw`, `attachment` `admin.quarantine_release_format_att` |
| `SpamPolicyList` | `allow` `user.spamfilter_wl`, `block` `user.spamfilter_bl` |
| `SpamPolicyOwner.kind`, `RateLimitObjectKind` | `domain` `mailbox.domain`, `aliasDomain` `add.alias_domain`, `mailbox` `mailbox.mailbox` |
| `RateLimitValue.frame` | `ratelimit.second`, `ratelimit.minute`, `ratelimit.hour`, `ratelimit.day` |
| `RateLimit.effectiveSource` | `mailbox` `mailbox.mailbox`, `domain` `mailbox.domain`, `none` `ratelimit.disabled` |
| `QuarantineActionReport.action` | `release` `quarantine.deliver_inbox`, `releaseWithoutLearning` `quarantine.release`, `learnAsSpam` `quarantine.learn_spam_delete` |
| `QuarantineActionReport.delivery`, `.learning`, `.fuzzy` (History details only, D15) | new: delivery "Delivered", "Not applicable"; learning "Learned", "Already learned", "Failed", "Not requested"; fuzzy "Stored", "Skipped", "Failed", "Not requested" |
| `QuarantineItemDetails.contentStatus` | new: "Available", "Too large", "Missing" |
| `QuarantineRecipient.source` | new, hard-coded: "TO", "CC", "BCC", "SMTP" |
| `SpamFilterTemporaryFailureProblem.dependency`, `.step` | `spamFilter` `user.spamfilter`; new: `sharedStore` "Shared store", `mailServer` "Mail server", `delivery` "Delivery", `learning` "Learning" |

**New strings** (en-gb, cs-cz and sk-sk; reason: no legacy element, unless "hard-coded"):

| Key | English |
|---|---|
| `quarantineUi.list.details` | Details |
| `quarantineUi.filters.receivedFrom` / `receivedTo` | From / To |
| `quarantineUi.filters.scoreMin` / `scoreMax` | Minimum score / Maximum score |
| `quarantineUi.item.loadError` (hard-coded) | Error loading quarantine item |
| `quarantineUi.item.sourceAddress` (hard-coded) | IP address |
| `quarantineUi.item.fuzzyHashes` (hard-coded) | Fuzzy Hashes |
| `quarantineUi.item.parserFallback` (hard-coded) | Parser failed, assuming HTML |
| `quarantineUi.item.showFullText` / `showLess` | Show full text / Show less |
| `quarantineUi.item.sha256` | SHA-256 |
| `quarantineUi.settings.missingDomain` | no longer exists |
| `quarantineUi.statistics.actions.*` (hard-coded) | reject / soft reject / rewrite subject / add header / no action |
| `quarantineUi.statistics.count` / `share` / `total` | Count / Share / Total |
| `quarantineUi.statistics.countedSince` / `countedSinceUnknown` / `runningSince` | Counted since {date} / Counting start unknown / Spam filter running since {date} |
| `quarantineUi.nav.label` | Quarantine sections |
| `spamFilter.score.rangeBelow` / `rangeBetween` / `rangeAbove` (hard-coded) | < {junk} / {junk} - {reject} / > {reject} |
| `spamFilter.score.usingDefaults` | The server defaults apply. |
| `spamFilter.score.fallback` | The spam filter could not be asked for its defaults; these are the built-in values. |
| `spamFilter.lists.patternPlaceholder` (hard-coded) | *@example.org |
| `spamFilter.lists.scope` (hard-coded) | Scope |
| `rateLimits.title` | Rate limits |
| `rateLimits.list.object` | Object |
| `rateLimits.set.title` | Set a rate limit |
| `rateLimits.bucket.hash` (hard-coded) | Hash |
| `rateLimits.invalidStoredValue` | The stored rate limit "{value}" has an invalid format. Save a new value or empty the field. |
| `rateLimits.effective.title` | In effect: {limit} ({source}) |
| `problem.quarantine-item-busy` | Another action is in progress for this item. It is checked again in a few seconds. |
| `problem.quarantine-message-too-large` (hard-coded in `inc/ajax/qitem_details.php`) | Message size exceeds {limit}. |
| `problem.temporary-failure.dependency.sharedStore` / `.spamFilter` / `.mailServer` | Nothing was changed, because the server's shared store / the spam filter / the mail server is temporarily unavailable. Please try again in a moment. |
| `validation.byParam.invalidTemplate.reason.syntax` / `.security` / `.render` / `.timeout` | The template has a syntax error in line {line}. / The template uses something that is not allowed, in line {line}. / The template could not be rendered (line {line}). / Rendering the template took too long. |
| `lists.filters.apply` (shared, if `FilterPanel` is created here) | Apply filters |
| the enumeration and History labels above | as listed there |
| D3, D5 and D13 (only if the owner keeps them) | `quarantineUi.deliver.learn` "Also teach the spam filter that this is not spam"; `quarantineUi.deliver.virusAcknowledge` "I understand that this message contains a virus"; `quarantineUi.bulk.virusCount` "{count} of the selected items contain a virus."; `spamFilter.score.junkScore` "Junk folder from", `spamFilter.score.rejectScore` "Reject from"; `quarantineUi.download.virusWarning` "This message contains a virus. The file may harm your device." |

### Legacy form map, part 2: messages

One alert per outcome, with the key legacy returns (`inc/functions.quarantine.inc.php`,
`functions.policy.inc.php`, `functions.ratelimit.inc.php`, `functions.mailbox.inc.php`), formatted
as `alertbox_log_parser()` does. Placeholder values that come from a message or a server answer are
inserted as plain text, never as markup. Field errors show on the field and in the summary.

| API outcome | Legacy key (placeholders: source) |
|---|---|
| `releaseQuarantineItem` 200, `learnAsHam: true` | `success.item_released` (1 `%s`: the item `id`), then from `report`: learning `done` or `alreadyLearned` → `success.learned_ham` (1 `%s`: the item `id`; legacy says it also after "already learned"); learning `failed` → `danger.ham_learn_error` (1 `%s`: `learningError`, the spam filter's answer, as legacy passes Rspamd's `error`); fuzzy `failed` → `warning.fuzzy_learn_error` (1 `%s`: `fuzzyError`); fuzzy `done` or `skipped` → nothing (legacy reports neither) |
| `releaseQuarantineItem` 200, `learnAsHam: false` | `success.item_released` (1 `%s`: the item `id`; legacy's quick release passes its hash, which the app never sees) |
| `learnQuarantineItemAsSpam` 200 | `success.qlearn_spam` (1 `%s`: the item `id`); fuzzy `failed` → `warning.fuzzy_learn_error` (1 `%s`: `fuzzyError`) |
| `deleteQuarantineItem` 204 | `success.item_deleted` (1 `%s`: the item `id`) |
| bulk item `done` | the single action's keys, from the item's `report`; a deletion `success.item_deleted` |
| bulk delivery with every item `done` | summary `success.items_released` (no placeholder); otherwise UI 002's `bulk.count.*` |
| bulk item `notFound`, `refused`, `outdated`, `failed` | `bulk.outcome.*` with the item problem's message from the rows below |
| `quarantine-delivery-refused` (single or bulk item) | `danger.release_send_failed` (1 `%s`: the mail server's answer, `smtpCode` and `smtpResponse` joined by a space; legacy passes the mailer's error text) |
| `quarantine-item-busy` | `problem.quarantine-item-busy` (new), then one re-read of the item |
| `quarantine-message-too-large` (download) | `problem.quarantine-message-too-large` (new; `{limit}` = `limit` as a binary size) |
| `temporary-failure`, by `dependency` | `problem.temporary-failure.dependency.sharedStore`, `.spamFilter`, `.mailServer` (new; `dependency` joins `PROBLEM_DISCRIMINATORS`). Legacy's `danger.redis_error`, `danger.spam_learn_error` and `danger.ham_learn_error` need the component's error text, which the problem does not carry. A spam filter that cannot learn as spam answers `503` and keeps the item, so `danger.spam_learn_error` is not used. Statistics: `problem.service-unavailable` |
| `404` (item, entry) | `problem.status.404` and back to the list; bulk `bulk.outcome.notFound` (legacy answers `danger.access_denied`, whose meaning does not fit) |
| `412` | UI 002's outdated handling (`problem.status.412`); bulk `bulk.outcome.outdated` |
| `permission-flag-required`, `forbidden` | `danger.access_denied` (no placeholder; UI 001 and UI 004 map it); the controls become read-only with `acl.prohibited` and the flag's `acl.*` label (`flagLabel`) |
| `attribute-not-permitted` (notification settings) | UI 001's `problem.attribute-not-permitted` with `acl.quarantine_notification` or `acl.quarantine_category` as the attribute labels |
| no response | `problem.outcome-unknown` |
| `updateMailboxQuarantineNotificationSettings` 200 | `success.mailbox_modified` (1 `%s`: the mailbox username) |
| `applyQuarantineNotificationBulkAction`, item `done` | `success.mailbox_modified` (1 `%s`: the target mailbox) |
| `category` `notInList` | `danger.quarantine_category_invalid` (no placeholder), through `quarantineUi.notifications.errors.category.notInList`; `frequency` `notInList`: `validation.notInList` (legacy answers `danger.access_denied`) |
| `setMailboxSpamScore` 200, `resetMailboxSpamScore` 200 | `success.mailbox_modified` (1 `%s`: the mailbox username; on `/spam-filter` the signed-in mailbox) |
| score `outOfRange`, `notMultipleOf` (0.1), `mustNotExceed` | `validation.outOfRange`, `validation.notMultipleOf`, `validation.mustNotExceed` (field: the reject label, value) — legacy has none |
| list entry created 201 | owner `domain` → `success.domain_modified` (1 `%s`: the domain, `owner.name`); `aliasDomain` → `success.aliasd_modified` (1 `%s`: the alias domain); `mailbox` → `success.mailbox_modified` (1 `%s`: the mailbox) |
| list entry removed 204 | owner `domain` or `aliasDomain` → `success.item_deleted` (1 `%s`: the entry `id`); `mailbox` → `success.items_deleted` (1 `%s`: the entry `id`; legacy joins the request's IDs, here one per request) |
| `spam-policy-entry-exists` | `danger.policy_list_from_exists` (no placeholder) |
| pattern `invalidFormat` `senderPattern` (client or API) | `danger.policy_list_from_invalid` (no placeholder), through `validation.format.senderPattern`; `tooLong`: `validation.tooLong` |
| `set…RateLimit` 200, `remove…RateLimit` 204 | `success.rl_saved` (1 `%s`: `RateLimit.object`, the domain, alias domain or mailbox username as legacy passes `$object`; legacy says it also when an empty value removes the limit) |
| `frame` `notInList` | `danger.rl_timeframe` (no placeholder), through `rateLimits.form.errors.frame.notInList`; value `outOfRange`: `validation.outOfRange` (legacy has none) |
| `resetRateLimitBucket` 204 / 404 | `success.hash_deleted` / `warning.hash_not_found` (no placeholders) |
| bucket identifier not in the form `RL…` (client) | `validation.invalidFormat` (legacy answers `danger.access_denied`) |
| `updateQuarantineSettings` 200 | `success.saved_settings` (no placeholder) |
| settings rule codes | `outOfRange` → `validation.outOfRange`; `notMultipleOf` 1048576 → `validation.notMultipleOf` (factor as a size, "1 MiB"); `invalidFormat` `email` → `validation.format.email` (legacy silently empties the field); `invalidFormat` `domainName` → `validation.format.domainName`; excluded domain `notFound` → `quarantineUi.settings.missingDomain`; `tooLong` → `validation.tooLong`, with `unit: bytes` → `validation.tooLongBytes`; `invalidTemplate` → `validation.byParam.invalidTemplate.reason.*` (`{line}`); `notInList` → `validation.notInList` |
| bulk `targets` `tooMany` | `bulk.limitReached` (`{max}`) |

### Legacy form map, part 3: deviations

Status: **Settled** by `docs/conventions.md` (named), or **Open** (needs the owner or the
orchestrator; nothing of it is built until decided). The first eight are those listed before T009a.

1. **Rate limits overview** (FR-056, FR-057). **Settled** ("Screens with no legacy counterpart
   … stay"): built, with the legacy keys of screen 7 and new strings for the rest.
2. **"Remove limit"** (FR-052 to FR-054). **Settled** ("Follow the legacy form": legacy's
   controls; "No confirmation legacy lacks"): emptying the value and saving removes the limit, as in
   legacy. The app then sends `remove<Kind>RateLimit` with `If-Match` and says `success.rl_saved`.
   No explicit action, no dialog and no effect text (FR-054 and R20's dialog are not built).
3. **Quick release and quick delete links; the learning switch; the confirmation of a single
   delivery; the virus acknowledgement; bulk delivery without learning** (FR-026, FR-028, FR-032,
   FR-034). **Open.** Legacy's "Deliver to inbox" releases at once and always learns as ham.
   "Open quick release link" opens the `qhandler` page, which releases without learning after its
   `quarantine.confirm` button, under the heading `quarantine.release`. "Open quick delete link" is
   the same as Remove. The conventions allow confirmations legacy lacks only for typed and bulk
   confirmations.
   - Option A, the plan: one "Deliver to inbox" dialog with the learning switch and the virus
     acknowledgement (new strings in part 1). Its confirmation is one legacy lacks.
   - Option B, closest to legacy: "Deliver to inbox" at once with learning, as legacy; a second
     action "Release" (`quarantine.release`), confirmed as the `qhandler` page confirms it (the item
     summary and `quarantine.confirm`), releases without learning. No switch and no new string,
     except the virus acknowledgement if kept.
   - Bulk: legacy can only deliver with learning. Without learning in bulk follows A (the switch)
     or is dropped (B).
4. **"Not set" notification category** (FR-039, US3). **Settled** ("Follow the legacy form":
   radio options as legacy has them): no option is selected, as legacy's button group shows it.
   There is no "Not set" text.
5. **Spam score input** (FR-042, FR-043, R17, R18). **Open.** The conventions' "legacy's controls
   … as legacy has them" points to legacy's two-handle slider (`noUiSlider`, 0 to 5,000, with the
   ranges "< x", "x - y" and "> y" in the zone list). The plan's two decimal fields need the labels
   `spamFilter.score.junkScore` and `spamFilter.score.rejectScore`. The zones, their range texts and
   `user.spamfilter_default_score` apply either way. The note that equal values raise the reject
   value by 0.1 is not built (12).
6. **Conflict and format messages** (FR-049, US4-AS6, US4-AS7). **Settled** ("Outcomes" and "no
   help text … legacy lacks"): `danger.policy_list_from_exists` and
   `danger.policy_list_from_invalid` only. Naming the list and listing the allowed characters are
   not built.
7. **Expand all / Collapse all** (`datatables.expand_all`, `datatables.collapse_all`).
   **Settled** ("The app's design system and layout stay"; lists become cards below the tablet
   breakpoint): dropped.
8. **Statistics as a text list** instead of legacy's doughnut chart (FR-065). **Open.** The plan's
   list with bars avoids a chart library (constitution VIII) and gives text equivalents (FR-079).
   The row labels are legacy's Rspamd names (screen 9) either way. `debug.chart_this_server`
   ("Chart (this server)") fits only a chart, so a list has no heading of its own.
9. **Separate "Spam filter and limits" pages** (FR-005, FR-006, FR-007, data-model §5 routes
   `spam-filter-domain`, `spam-filter-alias-domain`, `spam-filter-mailbox`). **Settled**
   ("Detail pages": "A field another feature edits is shown read-only in its legacy position until
   that feature lands, then becomes editable there"; "a legacy tab becomes one section, never
   several"). UI 002's domain "Rate limit" section and UI 003's mailbox "Rate limit" section and
   quarantine fields are already in place, read-only, waiting for this feature. So:
   - the domain page gets an editable "Rate limit" and a new "Spam filter" section after it, in
     legacy tab order;
   - the alias domain page gets an editable rate limit form below its edit form, and a "Spam filter"
     section (22);
   - the mailbox page gets editable notification fields in its "Mailbox" section, an editable "Rate
     limit" section, and a "Spam filter" section after it for administrators and domain
     administrators (22).

   `ObjectSpamFilterPage` and its three routes are not built. The overview's entries, the item's
   recipient and FR-006's links open these pages at the section. The new string "Spam filter and
   limits" is not needed.
10. **The mailbox user's Notifications page** (`/quarantine/notifications`, FR-001, FR-039).
    **Settled in principle** ("a legacy tab becomes one section, never several"; "Where features
    meet"): legacy shows the two settings in the user's "Settings" tab
    (`templates/user/tab-user-settings.twig`), after the encryption policy. UI 005 plans that tab
    as `/account/mail-settings` and leaves these rows to UI 006, so this feature adds them there,
    and the Quarantine section has no "Notifications" entry. **Open** only for the interim: if
    UI 005's page does not exist when this feature is built, the orchestrator decides whether
    `/quarantine/notifications` hosts them meanwhile (title `user.quarantine_notification`, save
    `user.save_changes`).
11. **Quarantine settings in four sections, release format as radios** (FR-059, FR-060, R21).
    **Settled** ("legacy's tabs, groups and field order: a legacy tab becomes one section, never
    several"; "legacy's controls"): one section `admin.quarantine`, with the fields in legacy order
    and legacy's dividers (screen 8), the release format as a select, and one save of the changed
    members with `If-Match`. Because the save is versioned, R21's objection (last write wins) no
    longer applies.
12. **Explanations legacy lacks.** **Settled** ("no help text, explanation or section heading
    that legacy lacks"; UI 003 deviation 9). Not built:
    - the notification effect note (FR-040);
    - the equal-values note (FR-043);
    - the pattern help and the normalised-pattern preview (FR-048), and the panel notes (FR-051);
    - the "active" line and its reason on the settings page (FR-059: only
      `quarantine.disabled_by_config` when inactive), and the 10 MiB note (FR-061);
    - the template's default marker, size indicator, placeholder reference, quick-link note and
      fallback note (FR-063);
    - the effect timing after a settings save (FR-064);
    - the effect of removing a rate limit (FR-054), and the reset note of the statistics (FR-065);
    - the explanations of the delivery, learning and removal dialogs (FR-026 to FR-028);
    - the written "actions are disabled" notice (FR-003, R13): `acl.prohibited` + `acl.quarantine`
      instead.

    The 1 MiB template limit is still checked before sending (`validation.tooLongBytes`).
13. **Confirmations legacy lacks.** **Settled** ("No confirmation legacy lacks, except the typed
    and bulk confirmations"). Not built:
    - the confirmation of "Reset to server default" (FR-044);
    - the confirmation of a single "Learn as spam and delete" (FR-027; bulk keeps the typed count);
    - the confirmation of "Restore default template" (FR-063);
    - the confirmation of "Remove limit" (FR-054).

    **Open:** the virus warning before a download (FR-037). By the letter of the conventions it is
    not built. It is a safety measure, so the owner decides (`quarantineUi.download.virusWarning`
    if kept).
14. **"Restore default template" action** (FR-063). **Settled** ("Follow the legacy form"):
    legacy restores the default by an empty template and Save, as its label says. The app sends
    `notificationTemplate: null` when the field is empty.
15. **Step report** (FR-029, R14, R27). **Settled** ("Outcomes: one alert per outcome … There is
    no step table"): the report becomes legacy's alerts (part 2). The step labels remain only as
    enumeration labels for History.
16. **Inherited list entries in separate groups** ("Set for <domain>", "Set for mailboxes";
    FR-046, R19). **Settled** ("no … section heading that legacy lacks"; legacy's columns): one
    table per list with legacy's columns ID, Rule and Scope, own rows first, and inherited rows
    read-only and marked `user.spamfilter_table_domain_policy`. The two queries of R19 stay, so
    that own rows come first. On domain and alias domain pages legacy marks its mailboxes' entries
    with the same "n/a (domain policy)". The text is shown verbatim, as legacy shows it.
17. **Fields the API adds.** **Settled** (deviation-free rule: "A field the API adds is labelled
    with a legacy key where any legacy form has one"). They are built with the labels of part 1:
    - the item's arrival, virus state, notification state, IDs, size, sending server address and
      authenticated sender;
    - the attachments' size and SHA-256, and the stored action of an `other` item;
    - the spam score's server defaults, with the fallback;
    - a mailbox's limit in effect, and an invalid stored rate limit;
    - excluded domains that no longer exist;
    - the list entries' creation date;
    - the statistics' counting period.
18. **`quarantine.qinfo` collapsed** (FR-008). **Settled** (layout): the whole text stays, behind
    a disclosure labelled with the legacy `quarantine.info`.
19. **"(no subject)"** (FR-010). **Settled** ("Follow the legacy form"): "-", as legacy's item
    modal shows an empty subject. No new string.
20. **The item page's group headings** (Summary, Filter result, Fuzzy hashes, Content,
    Attachments; FR-019). **Settled** ("legacy's … field order"; "no … section heading that legacy
    lacks"): legacy's per-field headings in legacy order (screen 2). The API's fields follow the
    sender.
21. **Two named bulk actions in the mailbox list** ("Set quarantine notifications", "Set quarantine
    notification category"; FR-041). **Settled** ("Follow the legacy form"): one menu group under
    `mailbox.quarantine_notification` with the seven options in legacy order (screen 4). The bulk
    confirmation stays (bulk confirmations are allowed).
22. **Spam settings with no legacy form**: the alias domain's lists (legacy has none), and the
    spam score and lists of a mailbox for administrators and domain administrators (legacy offers
    them only to the mailbox user). **Settled** ("Screens with no legacy counterpart … stay. Any
    field they share with a legacy form uses that legacy key"): built as sections with the keys of
    the domain's `#dspamfilter` tab and of `templates/user/Spamfilter.twig`.

23. **`admin.hash_remove_info` on the overview's bucket reset** (FR-058, R20, R27). **Open**
    (minor). The text is shown whole, as the conventions require, including its second sentence
    ("Each hash is indicated by an individual color."), which refers to the colour stripes of the
    rate-limited log (UI 011) and not to the overview. The conventions replace a text whose meaning
    no longer fits by a new string, only for that text; the default is the whole legacy text.

**Resolved by the implementer (2026-10-19)**, as the orchestrator asked ("resolve ambiguities
yourself, using legacy parity or best practice, and record them"). The constitution supersedes the
conventions where they meet (constitution, Governance).

- **3 → Option B, with the high-risk confirmation.** "Deliver to inbox" releases at once and learns
  as ham, as legacy (`releaseQuarantineItem`, `learnAsHam: true`). "Release" (`quarantine.release`)
  replaces the dropped quick release link: it releases without learning after a confirmation that
  shows the item and `quarantine.confirm`, as the `qhandler` page confirms it. A virus-flagged
  item's delivery or release is a high-risk action (conventions "Confirmations": "other destructive
  or high-risk actions … need one explicit confirmation"): it opens a confirmation whose button
  stays disabled until `quarantineUi.deliver.virusAcknowledge` is ticked. Bulk: legacy's three
  actions only (delivery with learning, learn as spam and delete, remove), each with the bulk
  confirmation; a bulk delivery that includes virus-flagged items states their number
  (`quarantineUi.bulk.virusCount`) and needs the same acknowledgement. Bulk release without
  learning is not offered (legacy has none). The learning switch (`quarantineUi.deliver.learn`) is
  not built.
- **5 → the two decimal fields.** Legacy's two-handle slider over a non-linear 0–5,000 range cannot
  be set precisely by touch or by single-pointer input (WCAG 2.2 AA 2.5.7 and 2.5.8, constitution
  III supersedes "legacy's controls"). The fields `spamFilter.score.junkScore` and
  `spamFilter.score.rejectScore` sit under legacy's heading `user.spamfilter_behavior`, above
  legacy's three zones with their range texts, which form the band.
- **8 → the text list with bars.** Legacy's doughnut chart carries its shares in colour and a
  legend only; the list states each count and share in text (constitution III, FR-079) and needs
  no chart library (constitution VIII). The rows use legacy's Rspamd names (screen 9).
- **10 (interim) → `/quarantine/notifications`.** UI 005's `/account/mail-settings` is not on
  `main` when this feature is built. The mailbox user's notification rows stay on the interim page
  `/quarantine/notifications` (title `user.quarantine_notification`, save `user.save_changes`),
  through the exported `NotificationSettingsPanel`. When UI 005 lands, its mail settings page mounts
  the panel after the encryption policy and the interim route and its section navigation entry are
  removed (orchestrator follow-up).
- **13 (download) → kept.** Downloading a file from a virus-flagged item is a high-risk action
  (conventions "Confirmations"): `quarantineUi.download.virusWarning` is confirmed first. The single
  "Learn as spam and delete" deletes the item permanently, so it is confirmed too (constitution II:
  "destructive actions need explicit confirmation"), with `#ConfirmDeleteModal`'s texts and the
  action's legacy label; no new string. The other confirmations of 13 stay unbuilt.
- **23 → the whole legacy text**, as the conventions require; its second sentence refers to UI 011's
  log, which reuses the dialog.

Nothing is left open for the owner in this map; the report of the implementation lists 3, 5 and 8
for review.

## API dependency and gaps

This feature depends on **mailcow-rest-v2 feature 006** (contract baseline commit
`32079252d55797d3da4e58ae661e9fb91c51c6f9`, [contracts/README.md](./contracts/README.md)), and on
the identity, errors and audit log of API 001, the audit target filters of API 002, and the
domain, mailbox and alias domain reads of API 002–004. It is implemented after **UI 001–005** and
after **API 006 is implemented** (smoke suite). Gaps and observations:

1. **Closed at the pin (API G15, commit `bd333f6`)**: list entry records now target their owner
   (`{type: domain | aliasDomain | mailbox, id: <owner>}`) with `entryId`, `list` and `pattern` in
   `details`, so History of an owner's lists is its owner's History (`targetType=<kind>`,
   `targetId=<owner>`). The text below is the gap as it was planned.
   **History of list entries per owner (API gap, before the pin)**: `spamPolicyEntryCreation` and
   `spamPolicyEntryRemoval` records use the entry's identifier as `target.id` and the pattern as
   `target.name`. The owner exists only in `details`. `GET /audit-events` therefore cannot be
   filtered to "the allow and block list changes of this domain or mailbox", which FR-066 implies
   for the "Spam filter and limits" pages.
   - **UI behaviour**: History per existing own entry (`targetType=spamPolicyEntry&targetId=<id>`),
     and no panel-level list history. Never filtered in the browser.
   - **Proposed to mailcow-rest-v2** (a new entry for its `docs/api-gaps.md`, which this plan cannot
     edit because the API repository is read-only here): make list-entry records filterable by
     owner, for example by letting `targetId` for `spamPolicyEntry` also match
     `<ownerKind>:<owner>`, or by recording the owner as the target name.
2. **Closed for API 006 at the pin**: `docs/audit-events.md` documents the detail keys of the 12
   event types (T125 labels them; unknown keys stay verbatim). The text below is the gap as planned.
   **`AuditEvent.details` is untyped (API gap)**: the members of the 006 records (`steps`,
   `changes`, `owner`, `countersExisted` and so on) are documented in the API's `data-model.md`, not
   in the contract (`details` is `additionalProperties: true`). The second half of FR-066 (step
   outcomes, old and new values in the user's units, the template's sizes, the list entry's owner)
   needs those members. mailcow-rest-v2 already tracks this as **G3** in `docs/api-gaps.md`. The
   fix is each API feature documenting its keys in `docs/audit-events.md` when it is implemented,
   per the API convention "Audit record details".
   - **UI behaviour**: as UI 002, 004 and 010 decided, the records show their event and target
     labels, actor, time, address and outcome. Their `details` go through UI 001's generic details
     view, whose values now render through `PlainText` (R23). If API 006's section of
     `docs/audit-events.md` exists at the pinned commit, T125 adds translated labels for its keys,
     and unknown keys stay verbatim. The presentation is never built from the API's data model
     (constitution I).
   - **Action for mailcow-rest-v2**: API 006's implementation documents its 12 event types' keys in
     `docs/audit-events.md` (G3).
3. **Observation: recipient kind.** A quarantine item does not say whether its recipient is an
   existing mailbox, a resource or a deleted mailbox. The item page asks `getMailbox` before
   linking the recipient (R13). This is one extra read per opened item for administrators and
   domain administrators. No change is requested.
4. **Observation: notification bulk targets** are sent without `version`, because the mailbox list
   does not carry the notification settings' tag. The API does not version-check such targets
   (R16). No change is requested.
5. **Observation: the bucket identifier pattern** exists only as the path parameter schema, not in
   the capabilities. It is kept in `limits.ts` and checked against the contract by a unit test (R8).
6. **Closed since the UI spec was written**: the spec's API gaps 1 (statistics period) and 2
   (template validation) were specified by API 006 (FR-058, FR-070 and FR-071). The UI shows the
   counting period (R22) and handles `invalidTemplate` (R21). It does not use the preview
   (owner question 1).

## Dependencies on earlier UI features

UI 001 is planned and partly implemented. UI 002, 003 and 004 were planned in parallel with this
feature, and the table names the blocks and action areas as their plans define them. UI 005 adds
nothing this feature uses except the contract pin.

Phase 2 starts with `tests/unit/dependencies/feature-006-dependencies.spec.ts` (T010). It imports
each block below and checks the behaviour listed, as UI 004 does for its own prerequisites. T011
then fills every gap:

- a missing block is built at the listed location, where it then has its second use;
- a block kept in its first feature folder is promoted, with the first feature's imports updated;
- a block lacking a listed capability is extended without changing its existing behaviour.

If an earlier feature shipped a block under another name or path, the references in this plan,
research and tasks are updated instead of creating a copy. P15 is always promoted, by T012, and
P25 by T029. Every name follows the UI conventions' "Shared building blocks and canonical
names".

| ID | Block or area | Location | From | What this feature relies on |
|---|---|---|---|---|
| P01 | `useListState` (repeatable parameters, `onReset`) | `src/shared/composables/useListState.ts` | 001 | address state of the three lists; **plus an optional key prefix** for the two lists of one page (R19; T022 and T035 add it if absent) |
| P02 | `ListState`, `PaginationBar`, `useConfirm`/`ConfirmDialog`, `useVersionedSave`, `useProblemForm`/`FormField`/`ErrorSummary`, `ProblemMessage`, `DateTime`, `useAnnouncer`, `clipboard.ts`, `limits.ts`, `problems.ts`, `format.ts` (binary sizes), `NoAccessState`, `NotFoundPage` (with a back link), the catalogue and `isEntryAvailable` | as in UI 001, 002 and 003 | 001, 002, 003 | everything |
| P03 | `useBulkSelection` (current page; `limit`; `targets()` gives `{ id, version }`; `retain(results, keep)`) | `src/shared/composables/useBulkSelection.ts` | 002 | bulk actions (R15, R16) |
| P04 | `BulkActionBar` ("Select", "Done", "Select all", count, fixed bar) | `src/shared/components/BulkActionBar.vue` | 002 | quarantine list selection mode |
| P05 | `BulkResultSummary` with the `#item` slot and the "outcome unknown" state | `src/shared/components/BulkResultSummary.vue` | 002 | bulk results with action reports (R15) |
| P06 | `ConfirmDialog` `requireTyped` and rich content | `src/shared/components/ConfirmDialog.vue` | 002 | typed count of bulk deletions; item lists in dialogs |
| P07 | `EditableSection` with the field diff of `useVersionedSave`, and `useLeaveGuard` | `src/shared/components/EditableSection.vue`, `src/shared/composables/useLeaveGuard.ts` | 002 | settings sections and every panel form (R16, R17, R20, R21) |
| P08 | `HistoryLink` and the audit log target filters | `src/shared/components/HistoryLink.vue`, `src/features/audit-log/list-state.ts` | 002 | History (R23) |
| P09 | `meta.roles` check in `ShellLayout` | `src/app/layouts/ShellLayout.vue` | 002 (D4) | sub-pages (R6) |
| P10 | scroll restoration and focus without scrolling | `src/app/router/{index.ts,focus.ts}` | 002 (D9) | back to the list (R13) |
| P11 | `SearchField`, `ActiveFilterChips`, `IdnText`, `utf8ByteLength()` | `src/shared/components/{SearchField,ActiveFilterChips,IdnText}.vue`, `src/shared/validation/utf8.ts` | 002, 003 | list search and chips; readable domain names; template size |
| P12 | `ApiProblem.extensions`, and the identity refresh on `permission-flag-required` and `attribute-not-permitted` | `src/api/problem.ts`, `src/api/query/client.ts` | 002, 003 | refusals (R7, R24) |
| P13 | the coverage manifest of open enumerations (UI 002's `stripMarkup` mappings are superseded by constitution IV 1.3.0: legacy values are used whole) | `src/i18n/coverage.json`, `scripts/i18n/check.mjs` | 002 (D2) | translations (R2); the closed 006 enumerations (T002, T003) |
| P14 | `DomainPicker` (searched, infinite, single or multiple, domain and alias domain sources) | `src/shared/components/DomainPicker.vue` | 003, promoted by 004 | an administrator's domain filter; excluded domains; "Set a rate limit" |
| P15 | `AclReadOnlyNote` ("Prohibited by ACL" with the flag label) | `src/features/mailboxes/components/fields/AclReadOnlyNote.vue`, promoted to `src/shared/components/` by T012 | 003 | read-only presentation (R7) |
| P16 | domain page with its section list (after Groupware, reserved for 006) and the Delivery section's read-only rate limit; key root `['domains', …]` | `src/features/domains/pages/DomainDetailPage.vue`, `/domains/:domain` | 002 (data-model §9) | entry point (R26); invalidation (R25) |
| P17 | mailbox detail with `MailboxSectionNav`, `ManagedSettingsGroup` (FR-040 entries with an optional `to`) and `MailboxBulkActions`; key root `['mailboxes', …]` | `src/features/mailboxes/components/{display,list}/…`, `/mailboxes/:mailbox` | 003 (data-model §8) | entry points; notification bulk actions; recipient link check |
| P18 | alias domain detail with its rate limit note and creation report links (`isEntryAvailable`); catalogue entry `aliasDomains`; key root `['alias-domains', …]` | `src/features/alias-domains/pages/AliasDomainDetailPage.vue`, `/alias-domains/:aliasDomain` | 004 | entry point; `meta.navEntry` of `spam-filter-alias-domain` |
| P19 | resource detail page | `src/features/resources/pages/ResourceDetailPage.vue` | 004 | asserts no link (US5-AS5) |
| P20 | mock state, handlers and factories for domains, alias domains and mailboxes | `tests/mocks/{handlers,factories}/…` | 002, 003, 004 | the 006 handlers read scope and objects from them |
| P21 | binary bodies in the mock validator | `tests/mocks/contract/validator.ts` | — | downloads (R28); T004 and T005 add it if absent |
| P22 | contract pin | `contract/VERSION.json` | 005 | bump rule (R1, T001) |
| P23 | API 006 implemented in the dev stack, with the seeded data of its quickstart | `../mailcow-rest-v2` | API 006 | smoke suite (R28); without it the smoke job stays non-blocking |
| P24 | `FilterPanel` (full screen below `md`, inline from `md`, "Apply" and "Clear all") | `src/shared/components/FilterPanel.vue` | — (UI 002 and 003 keep theirs in-feature) | quarantine filters (R12); T011 creates it if absent, and UI 008 expects it there |
| P25 | download helper (object URL, click, revoke after 1 s) | `src/features/account/download.ts`, promoted to `src/shared/platform/download.ts` by T029 | 005 | downloads (R10); T029 creates the module if UI 005 shipped none |

## Spec alignment

The spec governs its own screens, but `docs/conventions.md` says: "Where a spec is silent, or
contradicts another UI spec, this document applies, and the next change to that spec aligns it."
The plan applies these decisions, and the analysis step aligned the spec text:

1. **Bulk selection** (clarification 4, FR-033, US2-AS3, US2-AS4, US2's independent test, the
   parity row): the spec asked for a selection that persists across pages, which contradicts the
   conventions and UI 003 FR-054. The selection now covers the current page only and is cleared
   when the view changes. The limit comes from the capabilities, and US2-AS4 tests it with a
   lowered limit (R15).
2. **Bulk outcomes** (FR-035): the spec listed done, not found and failed, and kept only failed
   items selected. It now lists all five outcomes of the contract, and keeps failed, refused and
   outdated items selected, as the conventions say.
3. **Typed confirmation of bulk deletions** (FR-034, FR-050): the spec was silent, and the
   conventions require typing the number of objects for a bulk deletion. This applies to bulk
   "Remove" and bulk "Learn as spam and delete" (both delete items permanently), and to the
   removal of several list entries. Bulk delivery keeps a single explicit confirmation.
4. **Limits from the capabilities**: the spec's numbers (100 items, 0–5,000 with one decimal,
   100 characters, 1–2,147,483,647, 1 MiB, 255 characters, 10 MiB) are the server defaults. The UI
   reads them from `getQuarantineCapabilities` (R8). The spec text keeps the defaults as examples.
5. **API gaps of the spec**: gaps 1 and 2 are marked closed by API 006, and FR-065 now states the
   counting period when the API reports it. FR-063's fallback note still applies to templates
   saved in the classic interface. The plan's gaps 1 and 2 above are added as spec gaps 4 and 3.
6. **History presentation** (FR-066): the spec asked for record details in the user's units and
   language. Constitution I forbids relying on the undocumented `details` members, so FR-066 now
   shows them as stored until the contract describes them, as UI 002 does (R23).
7. **"Remove hash" in the rate-limited log** (FR-058) is delivered by UI 011 (its FR-039, "Reset rate
   limit"), with the dialog this feature exports. This feature delivers the overview reset. The spec
   text is unchanged, because the requirement is met once UI 011 ships.
8. **Translations and forms** (constitution IV 1.3.0): FR-008, FR-049, FR-080, FR-081, SC-009,
   US4-AS6, US4-AS7, the `qinfo` parity row and the Assumptions are aligned to "Translations and
   forms" above: legacy texts verbatim, including their markup, legacy messages where the meaning
   matches, and every mailcow language.

## Owner-level questions (defaults applied)

1. **Template preview**: API 006 now offers `previewQuarantineTemplate`, which returns the rendered
   notification as text, and a validate-only save. Spec FR-063 says the template is never previewed.
   **Default**: no preview in UI 006. Saving still shows the API's `invalidTemplate` errors with
   reason and line. A text-only preview ("show the rendered source and the plain-text version")
   would need a spec change, and fits constitution V because nothing is rendered as HTML.
2. **Native review of the new Czech and Slovak strings** (as UI 001 question 4). **Default**: the
   owner reviews the list that task T141 produces before the release. `i18n:check` guarantees
   completeness, not wording.

## Parity notes added by the plan

The spec's parity table is complete. The plan adds:

1. Bidi and control characters in message fields are shown as visible markers (for example
   `U+202E`). Legacy shows them raw, which lets a file name or address be spoofed (R9).
2. The statistics page states when counting started, and since when the spam filter runs, when
   the spam filter reports them. Legacy shows neither (R22).
3. Attachment and message downloads are always saved as files, even for types a browser could
   display. Legacy relies on the server headers alone (R10).

## Project Structure

### Documentation (this feature)

```text
specs/006-quarantine-spam-policy/
├── spec.md              # Feature specification (clarifications, parity)
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R28
├── data-model.md        # Phase 1: consumed data, view models, query keys, routes, address parameters, state machines
├── quickstart.md        # Phase 1: gates, manual checks, smoke and host validation
├── contracts/README.md  # Phase 1: pinned contract, operations, problem types, rule codes, enumerations
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks); the analysis summary is in the agent report
```

### Source Code (repository root)

Only the files this feature adds or changes are listed: `+` new, `~` changed. The rest is UI 001's
layout and what UI 002–005 added (see the prerequisite table).

```text
contract/{openapi.yaml,openapi.json,VERSION.json}  src/api/generated/schema.ts   ~ bumped (T001)
index.html                                         ~ <meta name="format-detection" …> (R9)
scripts/
├── i18n/{lib.mjs,check.mjs}                       ~ closed 006 enumerations (R2)
├── smoke/stack-up.sh                              ~ mailpit profile and release SMTP env (R28)
└── run-lhci.mjs                                   ~ /ng/quarantine collection
src/
├── api/query/keys.ts                              ~ quarantine, spam-policy, rate-limits roots (data-model §3)
├── api/problem.ts                                 ~ guards for the 006 extension members
├── app/navigation/catalogue.ts                    ~ quarantine and spamFilter become available
├── app/router/routes.ts                           ~ 10 routes; `meta.sectionNav` typing
├── features/
│   ├── quarantine/                                + 
│   │   ├── index.ts  routes.ts  api.ts  capabilities.ts  permissions.ts  list-state.ts
│   │   ├── symbols.ts  content-preview.ts  action-outcome.ts  downloads.ts  settings-form.ts  statistics.ts
│   │   ├── pages/{QuarantineListPage,QuarantineItemPage,NotificationsPage,QuarantineSettingsPage,
│   │   │          SpamFilterStatisticsPage}.vue
│   │   ├── components/
│   │   │   ├── QuarantineSectionNav.vue  QuarantineStatusNotice.vue  QuarantineFilters.vue
│   │   │   ├── QuarantineSortControl.vue  QuarantineItemList.vue  QuarantineItemCard.vue  QuarantineItemRow.vue
│   │   │   ├── ActionBadge.vue  VirusBadge.vue  NotifiedBadge.vue
│   │   │   ├── QuarantineBulkConfirm.vue  QuarantineBulkResultRow.vue
│   │   │   ├── ItemSummary.vue  FilterResult.vue  FuzzyHashes.vue  MessageContent.vue  TextPart.vue
│   │   │   ├── AttachmentList.vue  ItemActionBar.vue  ReleaseDialog.vue  LearnSpamDialog.vue
│   │   │   ├── RemoveItemDialog.vue  DownloadWarningDialog.vue  ActionOutcomeMessage.vue
│   │   │   ├── NotificationSettingsPanel.vue  NotificationBulkAction.vue
│   │   │   ├── settings/{StorageSection,ReleaseSection,NotificationMailSection,TemplateSection,
│   │   │   │             ExcludedDomainsPicker,TemplatePlaceholders,TemplateSizeIndicator}.vue
│   │   │   └── statistics/ActionStatisticsList.vue
│   │   └── composables/{useItemAction,useBusyRecheck,useQuarantineBulk,useNotificationBulk}.ts
│   ├── spam-filter/                               +
│   │   ├── index.ts  routes.ts  api.ts  owner.ts  spam-score.ts  pattern.ts  lists-state.ts
│   │   ├── pages/{SpamFilterPage,ObjectSpamFilterPage}.vue
│   │   ├── components/{SpamScorePanel,ScoreBand,PolicyListsPanel,PolicyList,PolicyListSwitch,
│   │   │               PolicyEntryAddForm,PolicyEntryRow,RemoveEntriesDialog,RemoveEntriesReport,
│   │   │               ObjectPageHeader,ObjectHistoryMenu,SpamFilterLink}.vue
│   │   └── composables/useRemoveEntries.ts
│   ├── rate-limits/                               +
│   │   ├── index.ts  routes.ts  api.ts  rate-limit.ts  bucket-id.ts  list-state.ts
│   │   ├── pages/RateLimitsPage.vue
│   │   └── components/{RateLimitPanel,RateLimitForm,RemoveLimitDialog,RateLimitList,
│   │                   SetRateLimitDialog,MailboxSearchPicker,ResetBucketDialog}.vue
│   ├── audit-log/labels.ts                        ~ 12 event types, 7 target types (R23)
│   ├── audit-log/components/AuditEventDetails.vue ~ generic view values through PlainText (R23)
│   ├── domains/pages/DomainDetailPage.vue         ~ section list entry; Delivery rate limit link (R26)
│   ├── mailboxes/components/display/{MailboxSectionNav,ManagedSettingsGroup}.vue   ~ entry; FR-040 links
│   ├── mailboxes/components/list/MailboxBulkActions.vue                           ~ notification bulk actions
│   ├── mailboxes/components/fields/AclReadOnlyNote.vue   ~ moved to shared (T012); imports updated
│   └── alias-domains/pages/AliasDomainDetailPage.vue     ~ entry; rate limit note and report links
├── shared/
│   ├── components/{PlainText,LocaleNumberField,AclReadOnlyNote}.vue   + (R9, R18; promoted R7)
│   ├── components/FilterPanel.vue                 + if absent (P24, R12)
│   ├── composables/useListState.ts                ~ key prefix, if absent (R19)
│   ├── security/plain-text.ts                     + (R9)
│   ├── platform/download.ts                       + promoted from UI 005's account feature (P25, R10)
│   └── validation/limits.ts                       ~ bucket identifier pattern (R8)
├── i18n/
│   ├── parse.ts                                   + locale decimals and integers (R18)
│   ├── problems.ts                                ~ 006 extension parameters (R24)
│   ├── coverage.json                              ~ 006 open-enumeration values (R2)
│   ├── messages/{en-gb,cs-cz,sk-sk}.json          ~ quarantine.*, spamFilter.*, rateLimits.*, problem, validation, auditLog
│   (legacy keys used verbatim through UI 001's legacy translation layer: no copies, R27)
└── styles/main.css                                ~ plain-text block, control marker, sticky bar scroll padding
tests/
├── unit/dependencies/feature-006-dependencies.spec.ts   +
├── unit/shared/…  unit/i18n/parse.spec.ts  unit/scripts/i18n-tools-006.spec.ts   +
├── unit/features/{quarantine,spam-filter,rate-limits,audit-log}/…                 +
├── mocks/contract/validator.ts                    ~ binary bodies, if absent
├── mocks/factories/{quarantine-item,hostile-messages,quarantine-settings,spam-policy-entry,spam-score,
│                    rate-limit,spam-statistics,quarantine-audit}.ts               +
├── mocks/handlers/{quarantine,spam-policy,rate-limits}.ts  + ; {index,audit}.ts ~
├── mocks/scenarios/{quarantine,spam-filter,rate-limits}.ts + ; index.ts ~
├── e2e/fixtures/{requests,downloads}.ts           + ; test.ts ~
├── e2e/{quarantine,spam-filter,rate-limits,audit-log,mailboxes,entry-points}/…    +
└── smoke/{quarantine,quarantine-bulk,notifications,spam-filter,spam-policy-objects,rate-limits,
           quarantine-settings,statistics}.smoke.spec.ts                            +
```

**Structure Decision**: The single static frontend of UI 001, with three new feature areas that
mirror the contract modules (R4). The object pages live in `spam-filter` and compose panels from
all three areas through their `index.ts`. Shared additions are limited to building blocks with two
or more uses:
- `PlainText`: quarantine and the audit log;
- `download.ts`: UI 005's profiles, attachments and messages;
- `parse.ts` and `LocaleNumberField`: scores, the score limit, filters and whole numbers;
- `AclReadOnlyNote`: mailboxes and this feature;
- `FilterPanel`: domains, mailboxes and this feature.

Every name follows the UI conventions' canonical list. Changes to earlier features are confined to
the action areas their data models designate, and to the audit log's labels and generic details
view.

## Complexity Tracking

No new deviation from the constitution. UI 001's two rows still apply: brand colours until API 013,
and the smoke suite as a non-blocking job until the API implementation runs in its dev stack. For
this feature the smoke job can become blocking as soon as API 006 runs there (task T140).

Integration measurement on 2026-10-20 found that importing UI 006's public barrels while
registering routes pulled notification forms and API composables into sign-in's initial chunk.
Lighthouse measured 217,621 script-transfer bytes, above the owner-approved 215,040 allowance.
The route registry now imports the three declarative `routes.ts` modules directly; ESLint and
the conventions document this narrow public-entry exception. Other cross-feature code still
uses `index.ts`. The simpler barrel-only arrangement was measured failing the transfer budget;
raising that budget again or moving form behavior into the router would not address the cause.

The release build also groups the common collection controls into one lazy chunk and keeps
sign-in's form feedback in a separate, smaller chunk. The four UI 006 message files loaded by
`loadFeatureMessages('quarantine')` share one emitted chunk per language. These are packaging
changes; the source modules, route loading, language behavior and performance thresholds remain
intact. The page reserves notice space during loading, and collapsed phone-card metadata mounts
on disclosure. See the quickstart for the failing measurements and release validation.

The 27-run release measurement passes the new quarantine gate and all shell-transfer and
accessibility assertions. The existing domains and aliases performance failures remain; the
maildev release carries forward the owner's staging exception already recorded for monitoring.
The threshold stays at 80. The quickstart records every page's three scores rather than describing
the full Lighthouse run as green.
