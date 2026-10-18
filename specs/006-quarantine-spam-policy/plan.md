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
  primitives, and UI 002–004's reserved patterns: bulk selection and result summary, editable
  sections with conflict marking, History links and the search combobox.
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
`Intl` and `TextEncoder`.

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
  and search results update within 1 s after the user stops typing (300 ms debounce).
- SC-001: find and deliver a message in under 1 minute at 360 px.
- Lighthouse mobile scores of at least 90 on `/ng/quarantine`. The initial JavaScript stays at most
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
- 3 locales and about 350 new or refined translation keys.
- The API is sized for 100,000 quarantine items, and no screen loads more than one page.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Gate | Status |
|---|---|---|
| I. The API contract is the only interface | Only operations of the pinned contract are used (contracts README), through `@/api`. The pin moves forward by `scripts/contract/bump.sh` with the bump rule of R1, then typecheck and the tests run. No hand-written API type: problem extension members are read through guards over the generated types. Gaps are recorded below and never worked around: list-entry history is not filtered client-side (R23). Errors are handled from `type` and `errors`, including `requiredFlags`, `requiredFlagsMatch`, `attributes`, `dependency`, `step`, `smtpResponse`, `size` and `limit` (R24). | PASS |
| II. Mobile-first | Every screen is designed at 360 px first: cards below `md`, a full-screen filter panel, full-screen section forms, and a sticky action bar and bulk bar with scroll padding. Destructive actions are confirmed with their impact, and bulk deletions require typing the count (conventions). Every list and panel has loading, empty and error states. No horizontal scroll at 360 or 320 px, or at 400 % zoom (FR-072). | PASS |
| III. Accessibility (WCAG 2.2 AA) | axe in both themes on every screen and state. Status is never colour alone: badges, the band, bars and outcomes carry text (FR-079). Sortable headers have `aria-sort`. Dialogs are Reka. Announcements go through `useAnnouncer`. 44 × 44 targets, including the selection checkboxes. Focus is never hidden behind the sticky bars (R13). | PASS |
| IV. i18n and branding | All text is in en-gb, cs-cz and sk-sk. Legacy keys are reused, and marked-up legacy texts are carried over without markup through `stripMarkup`/`segment` mappings (R27). `i18n:check` covers the 006 enumerations (R2). Numbers, scores, sizes and dates use `Intl` in the user's locale (FR-081). Message data is never translated (FR-082). Nothing is brand-specific. | PASS |
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

## API dependency and gaps

This feature depends on **mailcow-rest-v2 feature 006** (contract baseline commit
`32079252d55797d3da4e58ae661e9fb91c51c6f9`, [contracts/README.md](./contracts/README.md)), and on
the identity, errors and audit log of API 001, the audit target filters of API 002, and the
domain, mailbox and alias domain reads of API 002–004. It is implemented after **UI 001–005** and
after **API 006 is implemented** (smoke suite). Gaps and observations:

1. **History of list entries per owner (API gap)**: `spamPolicyEntryCreation` and
   `spamPolicyEntryRemoval` records use the entry's identifier as `target.id` and the pattern as
   `target.name`. The owner exists only in `details`. `GET /audit-events` therefore cannot be
   filtered to "the allow and block list changes of this domain or mailbox", which FR-066 implies
   for the "Spam filter and limits" pages.
   - **UI behaviour**: History per existing own entry (`targetType=spamPolicyEntry&targetId=<id>`),
     and no panel-level list history. Never filtered in the browser.
   - **Proposed to mailcow-rest-v2**: make list-entry records filterable by owner, for example by
     letting `targetId` for `spamPolicyEntry` also match `<ownerKind>:<owner>`, or by recording the
     owner as the target name.
2. **`AuditEvent.details` is untyped (API gap, documentation)**: the members of the 006 records
   (`steps`, `changes`, `owner`, `countersExisted` and so on) are documented in the API's
   `data-model.md`, not in the contract (`details` is `additionalProperties: true`). FR-066 needs a
   specific presentation.
   - **UI behaviour**: documented members are formatted, and unknown members fall back to UI 001's
     generic key–value list (R23).
   - **Proposed to mailcow-rest-v2**: describe the `details` members per event type in the contract.
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

UI 002–005 have specifications but no plans yet, so the exact file names of their artefacts are
not fixed. The table gives each artefact's role and its expected location, which comes from UI 001
research R20 where that reserved the location. Task T001 checks every row against the code and
updates the paths in `tasks.md` before anything else starts. An artefact marked "006 creates if
absent" is created by the named task when the check finds it missing. Any other missing row blocks
the feature, and is reported instead of being rebuilt here.

| From | Artefact | Expected location | Used for | If absent |
|---|---|---|---|---|
| UI 001 | `useListState`, `ListState`, `PaginationBar`, `useConfirm`/`ConfirmDialog`, `useVersionedSave`, `useProblemForm`/`FormField`/`ErrorSummary`, `ProblemMessage`, `DateTime`, `useAnnouncer`, `clipboard.ts`, `limits.ts`, `problems.ts`, `format.ts`, `NotFoundPage`, `NoAccessState`, the catalogue, the mock validator and the end-to-end fixtures | as in UI 001's plan | everything | blocks |
| UI 002 | `useBulkSelection`, `BulkResultSummary` (001-R20) | `src/shared/composables/useBulkSelection.ts`, `src/shared/components/BulkResultSummary.vue` | bulk actions (R15, R16) | blocks |
| UI 002 | `ConfirmDialog` `requireTyped` (001-R20) | `src/shared/components/ConfirmDialog.vue` | typed count for bulk deletions | blocks |
| UI 002 | `EditableSection` with the field diff of `useVersionedSave` (001-R20) | `src/shared/components/EditableSection.vue` | settings sections, panels (R16, R17, R20, R21) | blocks |
| UI 002 | `HistoryLink`, and `targetType`/`targetId` in the audit list state and filters (001-R20) | `src/shared/components/HistoryLink.vue`, `src/features/audit-log/list-state.ts` | History (R23) | blocks |
| UI 002 | per-feature audit details formatting | `src/features/audit-log/details/index.ts` | US9 (R23) | 006 creates if absent (T150) |
| UI 002/003 | filter panel and removable chips (`ActiveFilterChips` promoted, 001-R20) | `src/shared/components/{FilterPanel,ActiveFilterChips}.vue` | quarantine filters (R12) | 006 creates if absent (T024) |
| UI 002/003 | search combobox (the `OwnerPicker` pattern promoted) | `src/shared/components/SearchCombobox.vue` | domain filter, excluded domains, "Set a rate limit" | 006 creates if absent (T024) |
| UI 002 | domain detail page with an action area and the read-only rate limit; key root `['domains', …]` | `src/features/domains/pages/DomainDetailPage.vue` at `/domains/:domain` | entry point (R26); invalidation (R25) | blocks |
| UI 003 | mailbox detail page with the FR-040 read-only values and an action area; key root `['mailboxes', …]` | `src/features/mailboxes/pages/MailboxDetailPage.vue` at `/mailboxes/:mailbox` | entry point; recipient link check | blocks |
| UI 003 | mailbox list bulk action area | `src/features/mailboxes/components/MailboxBulkActions.vue` | notification bulk actions (R16) | blocks |
| UI 003 | "Prohibited by ACL" note with flag labels (`acl.*`) | `src/shared/components/ProhibitedByAcl.vue` | read-only presentation (R7) | 006 creates if absent (T024) |
| UI 003 | identity refresh on `permission-flag-required` and `attribute-not-permitted` | `src/api/query/client.ts` session reactions | FR-004 (R7) | 006 creates if absent (T025) |
| UI 004 | alias domain detail page and its catalogue entry; key root `['alias-domains', …]` | `/alias-domains/:aliasDomain` | entry point; `meta.navEntry` of `spam-filter-alias-domain` | blocks |
| UI 004 | resource detail page | — | asserts no link (US5-AS5) | blocks |
| UI 005 | contract pin | `contract/VERSION.json` | bump rule (R1) | — |
| any | route-level role check (`meta.roles`) | `src/app/router/routes.ts`, `src/app/layouts/ShellLayout.vue` | sub-pages (R6) | 006 creates if absent (T026) |
| any | `useListState` key prefix | `src/shared/composables/useListState.ts` | two lists per page (R19) | 006 creates if absent (T027) |
| any | `stripMarkup`/`segment` legacy mappings | `scripts/i18n/import-legacy.mjs` | marked-up legacy texts (R27) | 006 creates if absent (T008, T009) |
| any | binary bodies in the mock validator | `tests/mocks/contract/validator.ts` | downloads (R28) | 006 creates if absent (T004, T005) |
| API 006 | implementation in the dev stack with the seeded data of its quickstart | `../mailcow-rest-v2` | smoke (R28) | smoke stays non-blocking |

## Spec alignment

The spec governs its own screens, but `docs/conventions.md` says: "Where a spec is silent, or
contradicts another UI spec, this document applies, and the next change to that spec aligns it."
The plan applies these decisions, and the analysis step aligned the spec text:

1. **Bulk selection** (clarification 4, FR-033, US2-AS3, US2-AS4): the spec asked for a selection
   that persists across pages, which contradicts the conventions and UI 003 FR-054. The selection
   now covers the current page only and is cleared when the view changes. The limit comes from the
   capabilities (R15).
2. **Typed confirmation of bulk deletions** (FR-034, FR-050): the spec is silent, and the
   conventions require typing the number of objects for a bulk deletion. This applies to bulk
   "Remove" and bulk "Learn as spam and delete" (both delete items permanently), and to the
   removal of several list entries. Bulk delivery keeps a single explicit confirmation.
3. **Limits from the capabilities**: the spec's numbers (100 items, 0–5,000 with one decimal,
   100 characters, 1–2,147,483,647, 1 MiB, 255 characters, 10 MiB) are the server defaults. The UI
   reads them from `getQuarantineCapabilities` (R8).
4. **API gaps 1 and 2 of the spec** are closed by API 006 (see above). FR-065 now shows the
   counting period, and FR-063's fallback note still applies to templates saved in the classic
   interface.
5. **"Remove hash" in the rate-limited log** (FR-058) is delivered by UI 011 (its FR-039, "Reset rate
   limit"), with the dialog this feature exports. This feature delivers the overview reset.

## Owner-level questions (defaults applied)

1. **Template preview**: API 006 now offers `previewQuarantineTemplate`, which returns the rendered
   notification as text, and a validate-only save. Spec FR-063 says the template is never previewed.
   **Default**: no preview in UI 006. Saving still shows the API's `invalidTemplate` errors with
   reason and line. A text-only preview ("show the rendered source and the plain-text version")
   would need a spec change, and fits constitution V because nothing is rendered as HTML.
2. **Native review of the new Czech and Slovak strings** (as UI 001 question 4). **Default**: the
   owner reviews the list that task T193 produces before the release. `i18n:check` guarantees
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

Only the files this feature adds or changes are listed. The rest is UI 001's layout (plan there)
and whatever UI 002–005 added.

```text
index.html                                   # + <meta name="format-detection" …> (R9)
scripts/
├── i18n/{import-legacy.mjs,check.mjs,lib.mjs}   # stripMarkup/segment (R27); 006 enumerations by JSON pointer (R2)
├── smoke/stack-up.sh                        # + mailpit profile and release SMTP env (R28)
└── run-lhci.mjs                             # + /ng/quarantine collection
src/
├── api/query/keys.ts                        # + quarantine, spam-policy, rate-limits roots (data-model §3)
├── api/problem.ts                           # + type guards for the 006 extension members
├── app/
│   ├── navigation/catalogue.ts              # quarantine and spamFilter become available
│   ├── router/routes.ts                     # + 10 routes; meta.roles and meta.sectionNav typing
│   └── layouts/ShellLayout.vue              # meta.roles check (if absent, R6)
├── features/
│   ├── quarantine/
│   │   ├── index.ts  routes.ts  api.ts  capabilities.ts  permissions.ts  list-state.ts
│   │   ├── symbols.ts  content-preview.ts  action-outcome.ts  downloads.ts  settings-form.ts  statistics.ts
│   │   ├── pages/{QuarantineListPage,QuarantineItemPage,NotificationsPage,QuarantineSettingsPage,
│   │   │          SpamFilterStatisticsPage}.vue
│   │   ├── components/
│   │   │   ├── QuarantineSectionNav.vue  QuarantineStatusNotice.vue  QuarantineFilters.vue
│   │   │   ├── QuarantineSortControl.vue  QuarantineItemList.vue  QuarantineItemCard.vue  QuarantineItemRow.vue
│   │   │   ├── ActionBadge.vue  VirusBadge.vue  NotifiedBadge.vue
│   │   │   ├── QuarantineBulkBar.vue  QuarantineBulkConfirm.vue  QuarantineBulkResultRow.vue
│   │   │   ├── ItemSummary.vue  FilterResult.vue  FuzzyHashes.vue  MessageContent.vue  TextPart.vue
│   │   │   ├── AttachmentList.vue  ItemActionBar.vue  ReleaseDialog.vue  LearnSpamDialog.vue
│   │   │   ├── RemoveItemDialog.vue  DownloadWarningDialog.vue  ActionOutcomeMessage.vue
│   │   │   ├── NotificationSettingsPanel.vue  NotificationBulkAction.vue
│   │   │   ├── settings/{StorageSection,ReleaseSection,NotificationMailSection,TemplateSection,
│   │   │   │             ExcludedDomainsPicker,TemplatePlaceholders,TemplateSizeIndicator}.vue
│   │   │   └── statistics/ActionStatisticsList.vue
│   │   └── composables/{useItemAction,useBusyRecheck,useQuarantineBulk,useNotificationBulk}.ts
│   ├── spam-filter/
│   │   ├── index.ts  routes.ts  api.ts  owner.ts  spam-score.ts  pattern.ts  lists-state.ts
│   │   ├── pages/{SpamFilterPage,ObjectSpamFilterPage}.vue
│   │   ├── components/{SpamScorePanel,ScoreBand,PolicyListsPanel,PolicyList,PolicyListSwitch,
│   │   │               PolicyEntryAddForm,PolicyEntryRow,RemoveEntriesDialog,RemoveEntriesReport,
│   │   │               ObjectPageHeader,ObjectHistoryMenu,SpamFilterLink}.vue
│   │   └── composables/useRemoveEntries.ts
│   ├── rate-limits/
│   │   ├── index.ts  routes.ts  api.ts  rate-limit.ts  bucket-id.ts  list-state.ts
│   │   ├── pages/RateLimitsPage.vue
│   │   └── components/{RateLimitPanel,RateLimitForm,RemoveLimitDialog,RateLimitList,
│   │                   SetRateLimitDialog,ResetBucketDialog}.vue
│   ├── audit-log/{labels.ts,details/spam-filter.ts,details/index.ts}   # 006 event and target labels and details (R23)
│   ├── domains/pages/DomainDetailPage.vue          # + SpamFilterLink, rate limit value link (R26)
│   ├── mailboxes/pages/MailboxDetailPage.vue       # + SpamFilterLink, notification and rate limit value links
│   ├── mailboxes/components/MailboxBulkActions.vue # + NotificationBulkAction
│   └── alias-domains/pages/AliasDomainDetailPage.vue # + SpamFilterLink, rate limit note link (path per T001)
├── shared/
│   ├── components/{PlainText,LocaleNumberField}.vue  # new (R9, R18)
│   ├── components/BulkResultSummary.vue             # + optional per-row details slot (R15)
│   ├── security/plain-text.ts                       # new (R9)
│   ├── platform/download.ts                         # new (R10)
│   └── validation/limits.ts                         # + bucket identifier pattern (R8)
├── i18n/
│   ├── parse.ts                                     # new: locale decimals and integers (R18)
│   ├── problems.ts                                  # + 006 extension parameters (R24)
│   ├── messages/{en-gb,cs-cz,sk-sk}.json            # + quarantine.*, spamFilter.*, rateLimits.*, problem/validation/auditLog keys
│   └── legacy-map.json                              # + reused legacy keys (R27)
└── styles/main.css                                  # + plain-text block, control marker, sticky bar scroll padding
tests/
├── unit/
│   ├── shared/{security/plain-text,components/PlainText,platform/download,components/LocaleNumberField}.spec.ts
│   ├── i18n/parse.spec.ts  scripts/i18n-markup.spec.ts  scripts/i18n-check-006.spec.ts
│   └── features/{quarantine,spam-filter,rate-limits,audit-log}/…spec.ts
├── mocks/
│   ├── contract/validator.ts                        # + binary bodies
│   ├── factories/{quarantine-item,hostile-messages,quarantine-settings,spam-policy-entry,spam-score,
│   │              rate-limit,spam-statistics,quarantine-audit}.ts
│   ├── handlers/{quarantine,spam-policy,rate-limits}.ts (+ index.ts registration, audit.ts extension)
│   └── scenarios/{quarantine,spam-filter,rate-limits}.ts (+ index.ts registration)
├── e2e/
│   ├── fixtures/{requests,downloads}.ts             # requests outside the app; download capture
│   ├── quarantine/  spam-filter/  rate-limits/  audit-log/  mailboxes/  entry-points/
└── smoke/{quarantine,spam-filter,rate-limits,quarantine-admin}.smoke.spec.ts
```

**Structure Decision**: The single static frontend of UI 001, with three new feature areas that
mirror the contract modules (R4). The object pages live in `spam-filter` and compose panels from
all three areas through their `index.ts`. Shared additions are limited to building blocks with two
or more uses. Changes to earlier features are confined to their designated action areas and to the
audit log's label and details modules.

## Complexity Tracking

No new deviation from the constitution. UI 001's two rows still apply: brand colours until API 013,
and the smoke suite as a non-blocking job until the API implementation runs in its dev stack. For
this feature the smoke job can become blocking as soon as API 006 runs there (task T194).
