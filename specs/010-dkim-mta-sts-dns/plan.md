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
- **Runs on several names**: generation and copy send one request per name or target through
  `useSequentialRun`. Bulk deletion uses the API's `POST /dkim-keys/bulk-actions` with version
  tags, as `docs/conventions.md` requires (R8, R9).
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
- No `v-html`. DNS values, policy texts and zone files are rendered as text (FR-078).
- WCAG 2.2 AA in both themes, 360 px and 400 % zoom.
- No automatic request while idle. A diagnostics run starts only when its page opens without a
  fresh result, or when the user asks (FR-058).
- Private keys never reach storage, the address, history, logs or the query cache (FR-076, FR-077).

**Scale/Scope**:
- 8 user stories (3 at P1, 2 at P2, 3 at P3).
- 7 new routes (one a redirect), 2 navigation entries, and entry points on 5 earlier screens (UI
  002 domain list and page, UI 004 alias domain list and detail, UI 001 audit log).
- 15 of the contract's operations, plus UI 001's `listAuditEvents` and `getIdentity`.
- About 350 new translation keys, 30 of them reused from legacy (R22).
- Lists of up to 10,000 entries are paged by the API.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Gate | Status |
|---|---|---|
| I. The API contract is the only interface | Only the 15 operations listed in contracts/README.md, through the generated client. The pin is bumped to a commit that contains the whole API 010 contract (R1), and generated types are re-exported through `@/api` (no hand-written API type). Gaps the API still has are listed below and not worked around: audit `details` are shown generically; the bulk limit comes from the contract's `maxItems`. Problem types and rule codes drive the UI (R21). | PASS |
| II. Mobile-first | Every screen is designed at 360 px first. The DKIM list, the policy list and the diagnostics results are cards below `md` and tables from `md` up. Import and copy are pages, not modals. Generation and deletion are short dialogs, full-screen sheets on phones. Selection uses a mode with a sticky action bar. Destructive actions show their impact: single deletion, bulk deletion with the number typed, replacement, overwrite, deactivation and export. Every list and result has loading, empty and error states (FR-014, FR-056, FR-069). | PASS |
| III. Accessibility (WCAG 2.2 AA) | axe on every screen and state in both themes. Tables have header cells and `aria-sort`. Card lists are lists with headings. Badges carry text and icon. Copy buttons have names that say what they copy. Runs, counts, diagnostics start and end, and copies are announced politely, a countdown at most once. Dialogs trap focus and return it. Sticky bars never hide the focus (R23). | PASS |
| IV. i18n and branding | All text is in en-gb, cs-cz and sk-sk. 30 legacy keys are reused through `legacy-map.json`. Where a legacy locale lacks a key, that locale's app layer supplies it (R22). Diagnostics purposes, statuses, message codes, publication outcomes and reason codes are translated from contract codes. Unknown codes fall back to a translated generic label with the API's English text marked `lang="en"`, as the contract asks. Durations, numbers and times use `Intl`. No brand data is introduced. | PASS |
| V. Security in the browser | Private keys:<br>• kept in component state only;<br>• never in a TanStack mutation (`variables` would be cached) or query;<br>• cleared on success, close, leave and `pagehide`;<br>• never in storage, the address, history or error reports (R11, R12).<br>The export dialog asks before closing an uncopied key (conventions "Secrets"). DNS content is plain text, and guidance links pass `safeHref` (R27). Downloads use `blob:` object URLs revoked at once, which the CSP allows (R13). Hiding actions is a convenience: 403 and 404 are handled (FR-003, FR-004). | PASS |
| VI. Test-first | `tasks.md` puts tests before implementation in every phase. Every acceptance scenario has an end-to-end test on both viewports against the contract-validated mock. Unknown-code fallbacks of closed enumerations are unit-tested with plain values, so the mock never contradicts the contract (UI 001 R22). Smoke tests run against the API dev stack (R25). | PASS (UI 001's smoke-gate entry still applies) |
| VII. Performance budgets | Routes are lazy (`dns` chunks). There is no new dependency. The query policy reuses cached lists and diagnostics: no refetch without reason, no polling. A Lighthouse collection is added for `/ng/dns/dkim-keys` (R26). | PASS |
| VIII. Simplicity | No new dependency. New shared blocks exist only where UI 010 has two or more uses: `CopyableValue` (records, policies, diagnostics), `download.ts` (zone file, private key) and `useSequentialRun` with `RunResultList` (generation, copy). Each is created only if an earlier feature has not created it (R3). Single-use parts stay in the feature. | PASS |
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

## Dependencies and order

UI 010 is implemented **after UI 001–009** and after **mailcow-rest-v2 feature 010 is implemented**
in the API dev stack. The constitution lets a UI feature start once the contract is merged, so the
API implementation is needed only for the smoke tests (T110). The prerequisites:

| Prerequisite | From | What UI 010 uses |
|---|---|---|
| Foundation | UI 001 | Shell, catalogue, router guards, session, `@/api` client and query keys, i18n and problem mapping, `useListState`, `ListState`, `PaginationBar`, `useConfirm` and `ConfirmDialog`, `useVersionedSave`, `useProblemForm`, `FormField`, `ErrorSummary`, `ProblemMessage`, `DateTime`, `useAnnouncer`, `useCountdown`, `useMediaQuery`, `clipboard.ts`, `safeHref`, `limits.ts`, the mock server and fixtures, the audit log screen |
| Domain list and domain page with section editing | UI 002 | Designated action areas; `EditableSection.vue` and the field diff of `useVersionedSave`; `useBulkSelection`; `BulkResultSummary`; `ConfirmDialog` `requireTyped`; `HistoryLink.vue` and the audit `targetType` and `targetId` filters |
| Alias domain list and alias domain detail view | UI 004 | Designated action areas |
| `OneTimeSecretDialog.vue` | UI 005 (promoted from UI 001's `ApiKeySecretDialog`) | The export dialog, extended with a download action |
| Contract pins of UI 002–009 | UI 002–009 | The pin T002 starts from |
| API feature 010 contract (merged) and implementation (dev stack) | mailcow-rest-v2 | Types, mock validation, smoke tests |

T001 checks these against the repository before any other task. Where an earlier plan named a
building block or file differently from the tables below, T001 records the actual path in this
plan, and the tasks use the recorded path.

### Building blocks from earlier features (assumed paths)

| Block | Assumed path | Created by | Fallback if absent (created by UI 010) |
|---|---|---|---|
| Section editing with changed-value marking | `src/shared/components/EditableSection.vue`, `src/shared/composables/useVersionedSave.ts` | UI 002 (UI 001 R20) | None: a hard prerequisite |
| Bulk selection and per-item summary | `src/shared/composables/useBulkSelection.ts`, `src/shared/components/BulkResultSummary.vue` | UI 002 (UI 001 R20) | None: a hard prerequisite |
| Typed confirmation | `ConfirmDialog.vue` `requireTyped` | UI 002 (UI 001 R20) | None: a hard prerequisite |
| History link and audit target filters | `src/shared/components/HistoryLink.vue` | UI 002 (UI 001 R20) | None: a hard prerequisite |
| One-time secret dialog | `src/shared/components/OneTimeSecretDialog.vue` | UI 005 (UI 001 R20) | None: a hard prerequisite |
| Domain name syntax check (readable or ASCII, 253/63) | `src/shared/validation/domain-name.ts` | UI 002 (domain names), UI 004 | T024 creates it |
| Readable name with ASCII form below | `src/shared/components/DomainName.vue` | UI 002, UI 004 | T024 creates it |
| Sequential per-name run and its result list | `src/shared/composables/useSequentialRun.ts`, `src/shared/components/RunResultList.vue` | UI 002 (FR-046), UI 004 (FR-037) | T025 creates them |
| Copyable value with clipboard fallback | `src/shared/components/CopyableValue.vue` | possibly UI 005 | T022 creates it |
| Text download | `src/shared/platform/download.ts` | possibly UI 005 | T023 creates it |
| Router scroll restoration on Back, and focus without scrolling | `src/app/router/index.ts` (`scrollBehavior`), `src/app/router/focus.ts` (`preventScroll`) | UI 002 lists | T027 adds it |

### Entry points into earlier screens (assumed paths)

Each earlier screen keeps a designated action or section area. UI 010 places its components there:
`DomainDkimSection`, `DomainMtaStsSection`, `AliasDomainMtaStsSection` and `CheckDnsAction`, all
exported from `src/features/dns/index.ts`. If UI 002 defines a registry for these areas instead,
UI 010 registers its components there. T001 records the actual mechanism and file names.

| Screen | Assumed file | Area | UI 010 adds | Story |
|---|---|---|---|---|
| Domain list (UI 002) | `src/features/domains/components/DomainRowActions.vue` | row and card actions | "Check DNS" (FR-023) | US3 |
| Domain page (UI 002) | `src/features/domains/pages/DomainPage.vue` | sections and page actions | DKIM section (FR-021), MTA-STS section `#mta-sts` (FR-022, FR-046), "Check DNS" (FR-023), "DKIM keys of this domain and its alias domains" (FR-012) | US1, US2, US3, US4 |
| Alias domain list (UI 004) | `src/features/aliases/components/AliasDomainRowActions.vue` | row and card actions | "Check DNS" | US3 |
| Alias domain detail (UI 004) | `src/features/aliases/pages/AliasDomainPage.vue` | sections and page actions | DKIM section, MTA-STS section naming the target, "Check DNS" | US1, US2, US3, US4 |
| Audit log (UI 001, filters by UI 002) | `src/features/audit-log/labels.ts` | event and target labels | 8 event types, 2 target types (FR-070) | US8 |
| Domain page route (UI 002) | route name `domain`, param `domain`, from `@/features/domains` | link target | links from the MTA-STS list and alias sections | US4 |

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
│   ├── components/{CopyableValue,DomainName,RunResultList,OneTimeSecretDialog}.vue  # created or extended
│   ├── composables/useSequentialRun.ts  # created if absent
│   ├── platform/download.ts             # created if absent
│   └── validation/{limits,domain-name}.ts
└── i18n/
    ├── messages/{en-gb,cs-cz,sk-sk}.json   # + dns.*, problem.*, validation.*, auditLog.*
    └── legacy-map.json                     # + 30 legacy keys (research R22)
scripts/i18n/check.mjs                      # + 010 enumerations and formats
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
