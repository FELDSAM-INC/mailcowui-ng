# Implementation Plan: Mailboxes

**Branch**: `main` (no feature branches, constitution 1.1.0) | **Date**: 2026-10-18 |
**Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-mailboxes/spec.md`

## Summary

UI feature 003 replaces the classic interface's mailbox tab, the add-mailbox modal, the edit
mailbox page and the mailbox templates tab and pages. Administrators and domain administrators:

- list, search, filter, sort and page through the mailboxes in their scope, as cards on phones and
  as a table with optional columns on wide screens;
- open a mailbox on an overview with a section navigation;
- create mailboxes on one screen from templates, with the domain's quota figures, a secure password
  generator and live password-policy hints;
- edit a mailbox section by section (General, Sign-in and password, Protocol access, Permissions,
  Tags, Custom attributes), each section saving only its changes with the version it read;
- delete a mailbox after a confirmation built from the API's deletion preview;
- rename a mailbox with an explicit alias choice and a persistent report for incomplete renames;
- apply bulk actions to up to the server's bulk limit with one result per mailbox;
- manage mailbox templates. Domain administrators read them.

Domain administrators see only their domains' mailboxes, and their permission flags make controls
read-only or absent. Mailbox users get UI 001's "no access" state.

The technical approach is UI 001's foundation. This feature adds no runtime dependency. Details are
in [research.md](./research.md).

- **Contract**: the pin moves to a mailcow-rest-v2 commit with the complete API 003 contract
  (planning baseline `3207925`, R1). Because such a pin carries every later feature's enumeration
  values too, the translation check is scoped to the values each UI feature translates (R2).
- **Screens**: lazy routes under `/mailboxes` and `/mailbox-templates`. The detail is a layout
  route with one child route per section, so every section has its own link (R5).
- **Server state**:
  - TanStack Query keys under `['mailboxes', …]`, `['mailbox-templates', …]` and
    `['password-policy']`, with the invalidation table of data-model §3;
  - the detail renders at once from the list entry;
  - the capabilities read supplies every limit and server setting, and nothing is hard-coded
    (R16).
- **Editing**: one composable, `useMailboxSection`, over UI 001's `useVersionedSave` and UI 002's
  changed-value marking. It sends JSON Merge Patches with only the changed members. An outdated
  save keeps the user's input and marks what changed (R6).
- **Passwords**:
  - the generator uses `crypto.getRandomValues` with rejection sampling, at least 16 characters,
    the required classes, and no look-alike characters;
  - the policy hints are evaluated with the API's own definitions;
  - passwords never reach a cache, storage, the address or a log (R8).
- **Reuse** (R4):
  - UI 001's list state, dialogs, problem forms, announcer and storage wrapper;
  - UI 002's bulk selection, result summary, typed confirmation, section editing and History link;
  - UI 002's quota input, usage bar, tag editor, filter chips, bulk bar, unsaved-changes guard and
    not-found state. UI 003 reuses each at a fixed shared path, or promotes it there as the second
    use.
- **Tests**:
  - Vitest units for every pure module (`patch`, `create-request`, `quota`, `acl`, `validation`,
    `problems`, `bulk`, `deletion`, the generator and the policy rules);
  - component tests;
  - Playwright end-to-end tests of every acceptance scenario on 360 px and desktop, with axe in
    both themes, against the contract-validated mock with a 10,000-mailbox scenario;
  - a smoke suite against the API's dev stack.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict) and Vue 3.5 SFCs; Node.js 24 LTS (UI 001).

**Primary Dependencies**: unchanged from UI 001 R1 (`vue` 3.5.44, `vue-router` 5.4.0,
`@tanstack/vue-query` 5.104.4, `pinia` 4.1.0, `vue-i18n` 11.4.16, `reka-ui` 2.11.0, `clsx`,
`tailwind-merge`, `openapi-fetch` 0.17.0, `dompurify`). **No new runtime dependency.** The tooling
is unchanged (UI 001 R2).

**Storage**: none on a server. In the browser: the query cache, plus one convenience key,
`localStorage` `mailcowui-ng.mailboxes.columns` for the chosen list columns (data-model §4).

**Testing**: UI 001 R22–R25 apply unchanged:

- Vitest with jsdom and Vue Test Utils;
- Playwright projects `mobile-chromium` (360 × 780), `desktop-chromium` (1366 × 900) and
  `mobile-webkit`, against the production build with the production CSP and the Node mock server;
- in every test: axe in both themes, CSP and contract-violation detection, horizontal-scroll and
  touch-target checks;
- the `smoke` project against the mailcow-rest-v2 dev stack.

**Target Platform**: as UI 001: the two latest major versions of evergreen browsers, including iOS
Safari and Chrome for Android, served by the `ng-mailcow` image under `/ng/`.

**Project Type**: web application. A static single-page frontend; the backend is mailcow-rest-v2.

**Performance Goals**:

- SC-003: the first list page visible within 2 s on a mid-range phone for a server with 10,000
  mailboxes. Lighthouse mobile performance of at least 0.9 on `/ng/mailboxes` with the 10,000
  scenario is the automated proxy, and T163 is the manual check.
- SC-001: find and open a mailbox among 10,000 within 10 s.
- The initial JavaScript stays at most 200 KB gzipped. Every route of this feature is a lazy chunk.

**Constraints**:

- Only contract operations are used (21, listed in [contracts/README.md](./contracts/README.md)).
- Strict CSP, so no inline style or script, and no banned Reka viewports.
- WCAG 2.2 AA in both themes.
- Usable at 360 px and 320 px.
- No password anywhere but component memory.
- Limits come from the capabilities read.
- en-gb, cs-cz and sk-sk complete, reusing legacy keys.

**Scale/Scope**:

- 9 user stories (4 at P1, 3 at P2, 2 at P3).
- 15 routes (12 mailbox routes, 3 template routes).
- 21 operations (16 of API 003, 2 of API 002, 3 of API 001).
- Up to 10,000 mailboxes in 500 domains, and tens of templates.
- About 450 new translation keys, part of them reused from legacy.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Gate | Status |
|---|---|---|
| I. The API contract is the only interface | Only the 21 listed operations are used, through the generated client. The pin is bumped deliberately with the bump script and a review of the used operations (R1). No hand-written API types: form and view models derive from generated types, and list parameters alias generated operation types (data-model §1–§2). The capabilities read replaces the spec's former gaps. The remaining gaps are reported to mailcow-rest-v2 and never worked around: untyped audit details are rendered generically (R17). Errors are handled from `type`, `errors`, `requiredFlags`, `holder`, `count`/`limit`, `dependency` and `steps` ([contracts/README.md](./contracts/README.md)). | PASS |
| II. Mobile-first | Every screen is designed and tested at 360 px first. Lists are cards below `md` and tables from `md` up. Filters and sorting sit in a panel over the list. Bulk selection on phones uses an explicit mode, 44 × 44 targets and a sticky bar. The long create form is one screen with collapsed groups, not a modal or wizard (clarification). Detail editing is split into sections. Destructive actions are confirmed with their impact: the deletion preview, the typed count for bulk deletion, and the template deletion's effect. Loading, empty and error states use `ListState` and `NotFoundState`. | PASS |
| III. Accessibility (WCAG 2.2 AA) | axe runs on every screen, dialog and state in both themes. Sortable headers expose `aria-sort`. Usage bars, statuses, policy marks and bulk outcomes have text equivalents. Dialogs trap and return focus, and the delete dialog focuses "Cancel". The error summary receives the focus. Announcements use UI 001's live regions. A keyboard-only pass is part of Polish (T157). | PASS |
| IV. i18n and branding | All text is in en-gb, cs-cz and sk-sk. Legacy keys are reused where the meaning is unchanged (R3), with the Slovak gaps supplied by hand. The product name for the built-in source and the `pwReset` label comes from `GET /public-config`. Sizes use binary units, and numbers and dates use the locale. Translation completeness is enforced. The scoping of open enumerations (R2) follows `docs/conventions.md`, and unknown values always show translated generic labels. | PASS |
| V. Security in the browser | The column choice is the only new storage key. It is a convenience and is allowlisted (data-model §4). Passwords live only in component memory: password mutations use `gcTime: 0`, fields are cleared after submit and on unmount, and nothing goes into the address, title or logs (R8, SC-009 test T159). API text (names, tags, attributes, template names) is rendered as text, with no `v-html`. Gates are a convenience, and every refusal is handled (R11). | PASS |
| VI. Test-first | `tasks.md` puts tests before implementation in every phase. Every pure module has unit tests. Every acceptance scenario has an end-to-end test on both viewports against the contract-validated mock. SC-008's 10,000 passwords per policy are a unit test. Smoke tests cover each story against the real API. | PASS |
| VII. Performance budgets | Lazy route chunks. No new dependency. A third Lighthouse collection on `/ng/mailboxes` with 10,000 mailboxes (R20). Queries are cached with explicit invalidation, and the detail reuses the list entry (FR-017). There are no automatic refetches (UI 001 R9). | PASS |
| VIII. Simplicity | No new runtime dependency. Shared blocks are reused or promoted only at their second use (R4). The domain picker and the password field stay in the feature, with promotion paths. Later features extend named components instead of a plug-in registry (R19). | PASS |
| Technology constraints | Only the stack of the constitution. Native `<select>` for selects. Reka `Combobox` without its viewport for the domain picker. No new TailAdmin primitive beyond those UI 001 copied. If a needed one is missing, it is copied with the notice update (T012). | PASS |
| Workflow and gates | It depends on UI 001, UI 002 and API 003 (below). Every merge gate of UI 001 R28 applies. Commits go to `main`. | PASS |
| `docs/conventions.md` | "The classic interface" wording; passkeys in the deletion impact. List state in the address, with page sizes 25, 50 and 100; the spec's page-size storage is aligned to this rule. Cards and tables; list states. Bulk: explicit selection mode, current page only, cleared on change, `BulkTarget` with version, one result per item, refused, outdated and failed items kept, "outcome unknown" without a retry. Section editing with changed fields and the version read; outdated saves keep the input and mark changes, without a merge or overwrite. Confirmations: the delete preview, typed counts for bulk deletion, one confirmation for other risky actions. Secrets: the generated password is shown in the field, never stored. History through UI 001's audit log screen. Translated problem types and rule codes. Gated controls read-only or hidden. Entry points into UI 002, and designated action areas for later features (R19). Limits from the capabilities read. | PASS |

**Post-design re-check (after Phase 1)**: PASS. The data model, contracts README and quickstart
introduce no violation. These decisions touched gates:

- The page size is not stored, against the spec's FR-008 wording, because conventions "Lists" and
  UI 002 forbid it. The spec is aligned (owner question 1).
- History opens the audit log screen instead of an embedded list (conventions, VIII).
- External authentication sources are offered from the capabilities read, which FR-024 allows once
  the contract reports them (I).
- `gcTime: 0` for password mutations (V).

## Dependencies

UI 003 is implemented **after UI 001, UI 002 and the API 003 implementation**.

| Dependency | What UI 003 needs from it |
|---|---|
| **UI 001** (planned, `specs/001-sign-in-app-shell/`) | The whole foundation: the generated client behind `@/api`, query client and key factory, router, guards, catalogue and `NoAccessState`, the shell, i18n with `legacy-map.json` and `i18n:check`, `useListState`, `ListState`, `PaginationBar`, `useConfirm` and `ConfirmDialog`, `useVersionedSave`, `useProblemForm`, `FormField`, `ErrorSummary`, `ProblemMessage`, `useAnnouncer`, `DateTime`, `RelativeTime`, `PageHeader`, `useMediaQuery`, the clipboard and storage wrappers, the audit log screen, the mock server, the validator and the end-to-end fixtures, the smoke harness and the Lighthouse runner. |
| **UI 002** (specified, planned in parallel) | The domain queries, with `listDomains` and `getDomain` exported from `@/features/domains`, and the domain mock handlers and factory. The reserved blocks of UI 001 R20: `useBulkSelection`, `BulkResultSummary`, `ConfirmDialog` `requireTyped`, the changed-value marking with `EditableSection`, and `HistoryLink` with the audit target filters. The expected blocks of research R4: quota input and binary units, usage bar, tag set editor, filter chips, bulk bar, unsaved-changes guard and not-found state. Each has a Phase 2 task that reuses it, or moves it to the shared path. UI 002's domain detail page and domain list, where UI 003 adds its entry points (T150). |
| **API 003** (mailcow-rest-v2) | Its merged implementation, so that the smoke suite runs against it. The contract is already merged (baseline `3207925`). The UI can be built against the mock before the implementation is merged. |
| **API 002, API 001** | Implemented before API 003 (API plan). The domains, identity, branding and audit target filters. |

## API dependency and gaps

This feature depends on **mailcow-rest-v2 feature 003** (with 002 and 001), pinned as
[contracts/README.md](./contracts/README.md) describes.

**Spec gaps closed by the contract**:

API 003's orchestrator added these capabilities after this spec recorded its gaps. They are used,
and the spec's API Dependency section is aligned:

- gap 1, the allowed authentication sources: `getMailboxCapabilities.authSources` and
  `identityProviderType`;
- gap 2, webmail disabled: `groupwareEnabled`;
- gap 3, last logins turned off: `lastLoginsReported`;
- gap 4, the deletion impact and retention: `previewMailboxDeletion` and
  `garbageRetentionMinutes`;
- gap 5, operator-configured limits: `bulkLimit`, `taggingLimit`, `tagMaxLength` and the
  custom-attribute limits;
- gap 6, the tags in use: `listMailboxTags`.

**Remaining gaps, to be specified in mailcow-rest-v2.** The UI does not work around them:

- **A. Audit record details are untyped.** `AuditEvent.details` is `additionalProperties: true`.
  The members of mailbox records are documented only in API 003 research R22: `changes` with the
  old and new value of each field, `passwordSet`, `preHashed`, `previousAddress`, `newAddress`,
  `bulkRequestId` and `steps`.
  - **Proposed**: a documented details schema per event family, at least `changes` as
    `{ <field>: { old, new } }` with the field names of the resource schema.
  - **Until then**: History shows the details through UI 001's generic renderer, with translated
    key labels. Values stay raw, for example quota in bytes rather than "1 GiB" (US9-AS1 is met at
    that level).
  - UI 002 FR-063 (old and new quota in the user's units) depends on the same change.
- **B. The recognised hash-scheme prefixes are not enumerated.** The contract names
  `{BLF-CRYPT}` and `{SSHA512}` only as examples. Legacy accepts 25 schemes.
  - **Proposed**: list them in `MailboxCreateRequest.password`, or expose them in the
    capabilities.
  - **Until then**: the pre-hashed notice appears for any `{SCHEME}` prefix. It is a hint, and the
    API decides (R8).
- **C. The built-in template defaults are not readable.** They are server settings "with the
  upstream values" (`MailboxCreateRequest`), so an operator can change them.
  - **Proposed**: add them to the mailbox capabilities.
  - **Until then**: a new template's form starts with the documented upstream values, and the
    create request sends every value explicitly, so the stored template equals what the form showed
    (R14).
- **Observation, not blocking**: the mailbox representation does not say whether a password hash is
  stored. The sign-in section therefore shows the hint "required if the mailbox has no password
  stored" whenever the source is switched to the built-in one (FR-036). The API's `required`
  refusal names the field.

**Coordination with UI 002**: the translation-scope rule (R2) and the reserved shared blocks
(R4). Whichever of UI 002 and UI 003 is implemented first builds them. UI 002 is scheduled first.

## Owner-level questions (defaults applied)

1. **Page size memory**: FR-008 and FR-074 ask that the page size be remembered in the browser.
   `docs/conventions.md` ("List state … lives in the page address and never in browser storage")
   and UI 002 forbid it, and the conventions win where specs disagree.
   - **Default**: the page size lives in the address only, so links, Back and reloads keep it. The
     column choice is still remembered in the browser. The spec text is aligned.
   - If the owner wants a remembered default page size, the conventions must change first.

## Parity notes added by the plan

The spec's parity tables are complete. The plan changes or adds:

1. **SOGo access hidden when webmail is disabled**: now **Matched**, because the capabilities report
   `groupwareEnabled`. It was "Blocked by API gap 2".
2. **Identity provider select and hidden authentication source**: external sources are offered when
   the server has a provider configured, at creation as well. Legacy's add form offers none. This is
   **Improved**, and was "Blocked by API gap 1".
3. **Delete confirmation**: shows the numbers from the deletion preview (aliases deleted and kept,
   sender permissions, sync jobs, app passwords, passkeys and the others) and the actual retention
   period. **Improved**.
4. **Creation follow-up steps**: legacy reports a failed rate limit or SOGo step only as a log entry.
   The app lists failed steps after creation. **Improved**.
5. **Page length**: kept in the page address, which is how links keep it. Legacy stores it in the
   browser. **Improved**, under the conventions.
6. **Tag suggestions**: the tag filter and the tag input suggest tags in use. Legacy has none.
   **Improved**.

## Project Structure

### Documentation (this feature)

```text
specs/003-mailboxes/
├── spec.md              # Feature specification (with clarifications and parity)
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R20
├── data-model.md        # Phase 1: consumed data, form and view models, query keys, routes, validation, state machines
├── quickstart.md        # Phase 1: setup, gates and validation guide
├── contracts/README.md  # Phase 1: pin, operations used, problem handling
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

New files are marked `+`. Edited files from earlier features are marked `~`.

```text
contract/{openapi.yaml,openapi.json,VERSION.json}                 ~ bumped (T001)
src/api/generated/schema.ts                                       ~ regenerated (T001)
src/api/query/keys.ts                                             ~ mailboxes, mailbox-templates, password-policy roots
src/app/navigation/catalogue.ts                                   ~ mailboxes available; + mailboxTemplates row
src/app/router/routes.ts                                          ~ registers the feature's routes
src/shared/platform/storage.ts                                    ~ + mailcowui-ng.mailboxes.columns
src/shared/components/{QuotaInput,UsageBar,TagSetInput,ActiveFilterChips,
                       BulkActionBar,NotFoundState}.vue           reused from UI 002, or promoted/created (T008–T012)
src/shared/composables/useUnsavedChangesGuard.ts                  reused or created (T012)
src/shared/utils/binary-units.ts                                  reused or created (T008)
src/shared/validation/limits.ts                                   ~ + mailbox schema limits (T013)
src/i18n/format.ts                                                ~ formatBinarySize, formatDuration if missing (T008)
src/i18n/enum-scope.json                                          + or extended (T002)
src/i18n/messages/{en-gb,cs-cz,sk-sk}.json  src/i18n/legacy-map.json  src/i18n/legacy/*.json   ~
scripts/i18n/check.mjs                                            ~ scoped open enumerations (T002, if UI 002 did not)
scripts/run-lhci.mjs                                              ~ third collection /ng/mailboxes (T160)
src/features/domains/…                                            ~ entry points (T150); exports used by the picker
src/features/audit-log/…                                          ~ labels of mailbox events and detail keys (T148)
src/features/mailboxes/                                           +
├── index.ts                    # routes; DomainPicker and link helpers for UI 002 and UI 004
├── routes.ts                   # 12 mailbox routes + 3 template routes (data-model §5)
├── api.ts                      # mailbox queries and mutations, capabilities, tags, preview, bulk, rename, policy
├── templates-api.ts            # mailbox template queries and mutations
├── list-state.ts  columns.ts  sections.ts
├── acl.ts  quota.ts  validation.ts  patch.ts  create-request.ts
├── problems.ts  bulk.ts  deletion.ts  auth-source.ts
├── password/{generate.ts,policy-rules.ts,pre-hashed.ts}
├── templates/{list-state.ts,built-in-defaults.ts,useTemplateForm.ts}
├── composables/{useMailboxSection.ts,useMailboxCreateForm.ts,useTemplateApplication.ts,
│                useMailboxBulk.ts,usePasswordPolicy.ts,useMailboxCapabilities.ts}
├── pages/{MailboxesPage.vue,MailboxCreatePage.vue,MailboxDetailPage.vue}
├── pages/templates/{MailboxTemplatesPage.vue,MailboxTemplateCreatePage.vue,MailboxTemplateDetailPage.vue}
├── sections/{MailboxOverview.vue,GeneralSection.vue,SignInSection.vue,ProtocolAccessSection.vue,
│             PermissionsSection.vue,TagsSection.vue,CustomAttributesSection.vue,RenameSection.vue,
│             MailboxDeleteRoute.vue}
└── components/
    ├── list/{MailboxList.vue,MailboxCard.vue,MailboxTable.vue,MailboxFilters.vue,MailboxSortControl.vue,
    │         ColumnChooser.vue,MailboxRowActions.vue,MailboxBulkActions.vue}
    ├── display/{MailboxStatusBadge.vue,MailboxQuotaUsage.vue,LastLogins.vue,ManagedSettingsGroup.vue,
    │            MailboxSectionNav.vue,CreationNotice.vue}
    ├── fields/{MailboxQuotaField.vue,StatusField.vue,AuthSourceField.vue,ProtocolAccessFields.vue,
    │           UserPermissionsFields.vue,InitialSettingsFields.vue,RateLimitField.vue,AclReadOnlyNote.vue,
    │           CollapsibleGroup.vue,DomainPicker.vue,TemplateSelect.vue,LocalPartField.vue,
    │           CustomAttributesEditor.vue}
    ├── password/{PasswordField.vue,PasswordPolicyHints.vue}
    ├── dialogs/{MailboxDeleteDialog.vue,RenameReport.vue}
    └── templates/{TemplateCard.vue,TemplateTable.vue,TemplateValuesGroups.vue}
tests/
├── unit/features/mailboxes/…   # mirrors src/features/mailboxes (pure modules, composables, components)
├── unit/shared/…               # promoted blocks (T008–T012)
├── unit/scripts/i18n-tools.spec.ts                               ~ scoping rule (T002)
├── mocks/handlers/{mailboxes,mailbox-templates,password-policy}.ts   +
├── mocks/handlers/index.ts                                       ~ registration
├── mocks/factories/{mailbox,mailbox-template,password-policy}.ts     +
├── mocks/scenarios/mailboxes.ts                                  + (registered in scenarios/index.ts)
├── e2e/mailboxes/{list,detail,create,sections,delete,permissions-tags-attributes,bulk,templates,
│                  rename,history,entry-points}.spec.ts           +
└── smoke/{mailboxes,mailbox-sections,mailbox-bulk,mailbox-templates,mailbox-rename}.smoke.spec.ts  +
```

**Structure Decision**: one feature directory, `src/features/mailboxes/`, holds both mailboxes and
mailbox templates. The template form shares the field groups of the create screen, and one
directory keeps those imports relative (UI 001 R3). Other features reach it only through
`index.ts`. Blocks with a second use live in `src/shared/` (R4).

## Complexity Tracking

No constitution principle is violated, so there is no entry. The inherited deviations of UI 001
still apply: default brand colours until API 013, and the smoke suite as a non-blocking gate until
the API runs its implementation in its dev stack.
