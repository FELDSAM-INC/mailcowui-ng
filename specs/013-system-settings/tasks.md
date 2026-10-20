---
description: "Task list for UI feature 013: system settings"
---

# Tasks: System Settings

**Input**: Design documents from `specs/013-system-settings/`:
- [plan.md](./plan.md)
- [spec.md](./spec.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/README.md](./contracts/README.md)
- [quickstart.md](./quickstart.md)

**Prerequisites**: UI features 001–012 are implemented (this feature extends their screens and
reuses their building blocks, research R1), and the API 013 contract is merged in mailcow-rest-v2.
The API implementation is not needed: everything is built and tested against the contract-validated
mock first.

**Tests**: Mandatory (constitution VI, test-first). In every phase, mock handlers and tests come
first and must fail before the implementation tasks that follow them. Every end-to-end spec:
- runs on `mobile-chromium` (360 px), `desktop-chromium` and `mobile-webkit`;
- calls `expectAccessible` on every screen and state it reaches; from T071 on, that fixture also
  checks the limit brand palettes (research R12);
- fails on any CSP violation or mock contract violation (001's fixtures);
- checks `expectNoHorizontalScroll` and `expectTouchTargets` (44 × 44 px, FR-094, FR-095) on every
  screen it reaches;
- names its spec reference in the test title (`US1-AS2 …`, `FR-036 …`, `Edge: …`);
- starts from a scenario whose administrator session is already active (no UI sign-in).

**Organization**: Tasks are grouped by user story (spec priorities P1 to P3), so that each story can
be implemented and tested on its own once the foundation is in place.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task belongs to (US1 to US12)
- Paths are relative to the repository root `mailcowui-ng/`. Paths of files that UI 002–012 create
  are their expected paths in UI 001's structure; use the delivered path if it differs (research R1).

---

## Implementation checkpoint — 2026-10-20

The owner instructed starting isolated worktree `wt/013` from UI `dbf920db` while UI005 is still
being finalized. Rebase onto the merged UI005 before integration. This checkpoint is a first
independent slice, not completion of US1/US11 or the foundational phase:

- API pin advanced from `4be8653` to `dd9a44e`, with ancestry verified; generated schemas/types
  and all 51 consumed-operation assertions pass. T001 remains open for its full integration gates.
- T003 query roots and generated parameter aliases pass. The existing password-policy key is reused;
  infinite picker keys differ from ordinary paged lists.
- T004/T005 reused existing `%d` formatter coverage (`legacy-format.spec.ts`); the new IP-check
  component check verifies both `<strong>` host names survive the legacy HTML layer. No formatter change.
- T006/T007 found binary support already delivered. Seven tests cover five documented logo media
  types, an undocumented type, and retained JSON/merge-patch validation. No artificial red test or
  validator rewrite was needed for that existing behavior.
- T008/T009/T011 are partial: typed capabilities/IP-check data and defaults, admin/demo/error/role
  scenarios, failure injection and version tags exist; other settings stores remain for later slices.
- T008a records the field map; D1 grouping is orchestrator-approved. All other unresolved deviations
  continue to require the legacy form.
- T022/T023/T035 are partial: the reusable section core covers versioned saves, cache updates,
  unchanged saves, explicit 412 retry/discard, demo-mode refresh and failed-request draft retention.
  IP check uses the canonical leave guard; multi-section coordination and the full validation
  matrix remain open.
- T024 passes loading/retry/render-gating/demo-capability component checks. The registered settings
  overview and IP-check route are lazy and admin-only; only implemented routes receive links.
- US11 IP-check portions of T150/T153/T154/T156/T158 are implemented. Other server settings and the
  complete US11 gates remain open. Browser and real-stack results are recorded in quickstart as run.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Pin the contract that contains API 013, add the cache roots, and extend the i18n and
mock tooling that the whole feature needs (research R2, R28, R30).

- [ ] T001 Bump the contract (research R2, contracts README):
  - run `scripts/contract/bump.sh <ref>` with the mailcow-rest-v2 ref that is current when 013 starts (a release tag containing API 013 if one exists). Pins only move forward (`docs/conventions.md`): the ref must contain both the current pin and the baseline commit `32079252d55797d3da4e58ae661e9fb91c51c6f9`; check with `git -C $MAILCOW_REST_V2_DIR merge-base --is-ancestor 32079252 <ref>`. This updates `contract/openapi.yaml`, `contract/openapi.json`, `contract/VERSION.json` and `src/api/generated/schema.ts`;
  - re-export the 013 root types of data-model §1 from `src/api/index.ts`, and export the generated `Type` as `AuditTargetType` (plan, observation O3);
  - record the pinned ref, commit and bundle sha256 in the "Pinned contract" table of `specs/013-system-settings/contracts/README.md`;
  - run `npm run typecheck && npm run test:unit && npm run test:e2e`; fix type errors without changing behaviour.
- [x] T002 [P] Write `tests/unit/api/system-settings-operations.spec.ts`. It reads `contract/openapi.json` and asserts that each of the 44 API 013 operations and the 7 operations of earlier features listed in `specs/013-system-settings/contracts/README.md` exists with its method, path and documented response statuses (for example `replaceRspamdRegexMap`: 200, 409, 412, 422; `createMassMailJob`: 201, 409, 422; `setRspamdUiPassword`: 204, 502, 504). It must pass after T001 and fail on any later bump that drops one.
- [x] T003 [P] Add the 013 query key roots of data-model §3 to `src/api/query/keys.ts`, with list parameter types aliased from the generated `operations['listRspamdSettingsRules' | 'listRspamdRegexMaps' | 'listMassMailJobs' | 'listMassMailJobRecipients' | 'previewMassMailRecipients' | 'listDomains' | 'listMailboxes']['parameters']['query']`. Reuse UI 003's password-policy key (expected `['password-policy']`) instead of adding one. Extend `tests/unit/api/query-keys.spec.ts`: keys are stable, `['domains','picker',…]` and `['mailboxes','picker',…]` never equal UI 002/003 list keys.
- [x] T004 [P] Extend the unit tests of UI 001's legacy formatter (research R28, constitution IV 1.3.0; no importer extension). They must check that `%d` is substituted like `%s` (fixture `admin.password_policy_length`: "Minimum password length is %d") and that a legacy value with markup (`admin.ip_check_opt_in`) is passed unchanged to `SanitizedHtml.vue`, which keeps its `<strong>` elements. Where UI 001's tests already cover this, record that and skip; otherwise the new tests must fail.
- [x] T005 Add `%d` substitution to UI 001's legacy formatter if T004 fails, so that T004 passes.
- [x] T006 [P] Write `tests/unit/mocks/validator-binary.spec.ts`. The contract validator must accept a `replaceLogo` request whose body is raw bytes with a documented media type (`image/png`, `image/jpeg`, `image/gif`, `image/svg+xml`, `application/octet-stream`), reject one with an undocumented media type (`text/plain`), and still validate JSON and merge-patch bodies against their schemas. The test must fail.
- [x] T007 Implement binary request bodies in `tests/mocks/contract/validator.ts`: for a documented non-JSON media type, only the media type is checked (research R30). T006 must pass.
- [ ] T008 [P] Extend the scenario state in `tests/mocks/scenarios/state.ts` with a `settings` store (research R30):
  - capabilities (host name, demo mode, license switch, Rspamd address, logo limits, colour references, the limits of `SettingsLimits`, the mass mail policy);
  - logos (bytes, media type, size, dimensions), UI texts, login page options, custom and built-in app links, brand colours, IP check, password policy, reset notification, quota notification, quota copy recipients per domain;
  - Rspamd rules, regex maps (content, `available`, `vanishOnSave`), global Sieve filters, the restart behaviour (`done` or `failed`), the Rspamd password behaviour (`ok`, `serviceFailure`, `timeout`), CORS (origins, methods, server origin), license (GUID, validity, last verification, next verification result);
  - receiving, inactive and resource mailboxes for mass mail, mass mail jobs with recipients, and the per-read progress step;
  - a helper that issues a new strong `etag` for a resource on every write, and the existing failure injection by operationId.

**Checkpoint**: The contract is pinned with API 013, the operations guard passes, and the tooling
accepts binary bodies and `%d` legacy placeholders.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The settings mock base, the shared building blocks with two or more uses (contrast
maths, code editor, e-mail preview, entry lists, e-mail validation), the problem formatting, the
catalogue, the section editing composable, and the settings layout with a minimal overview.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T008a Write the legacy form map for this feature's screens (screen → legacy template → field → legacy key, including messages) in `plan.md`, and use only those keys plus the minimal new strings in the implementation.
  Follow `docs/conventions.md` "Translations and forms" and the templates in plan.md "Translations and forms (constitution IV 1.3.0)"; list any deviation under "Deviations needing a decision". Every later screen task depends on it.

### Mock base

- [ ] T009 Create `tests/mocks/factories/settings.ts` with the legacy defaults of the spec's edge case "Settings never saved" (empty texts, announcement inactive, no logos, all sign-in links shown, no app links, IP check off, length 6 without classes, no reset sender or subject with the default templates marked as defaults, quota sender `quota-warning@localhost`, subject "Quota warning" and the default template marked, CORS for the server origin with GET, POST, PUT and DELETE) and the default capabilities (limits of API 013: 255, 65,535, 1,048,576 bytes, 50 app links, 100 recipients, 100 origins, policy 3–64, Rspamd password 6–256, page sizes 25/1,000; logos 15 MiB and 1,920 × 1,920; references `#ffffff`, `#1d2939`, minimum 4.5; mass mail sender `noreply@mail.example.org`, 10/s, 1 job, 3 retries, 300 s, 1,000 entries, 1,048,576 bytes).
- [x] T010 Implement `tests/mocks/handlers/settings-server.ts` with `getSettingsCapabilities` (admin only; `403 forbidden` for other roles; failure injection to `500`), and register it in `tests/mocks/handlers/index.ts`.
- [ ] T011 Create `tests/mocks/scenarios/system-settings.ts`, registered in `tests/mocks/scenarios/index.ts`, with `settings-admin-defaults`, `settings-admin-custom`, `settings-domain-admin` (domain administrator of `example.org`), `settings-mailbox-user`, `settings-capabilities-error` (`500` on `getSettingsCapabilities`), `settings-demo-mode` (`demoMode: true`), `settings-license-disabled` and `settings-temporary-failure` (switchable `503 temporary-failure` with `Retry-After` on any settings operation). Later stories add their scenarios to this module.
- [ ] T012 Extend `tests/mocks/handlers/public-config.ts`: logos, page title, product name, apps label, help text, footer, announcement, login page options and operator app links come from the settings store; `brandColors` holds the effective colours and foregrounds of FR-031 (dark: the dark colour, else the light colour when it reaches 4.5:1 on `#1d2939`, else `null`; foreground black or white by the higher ratio, ties black); the `ETag` changes with the store.

### Tests for the shared building blocks (write first; must fail)

- [ ] T013 [P] Write `tests/unit/shared/color/contrast.spec.ts` (research R13): luminance with the 0.04045 threshold and weights 0.2126/0.7152/0.0722; `#1D4ED8` 6.70:1 on white and 2.19:1 on `#1D2939` with a white foreground; `#FFD700` 1.40:1; `#60A5FA` 5.78:1 on `#1D2939` with a black foreground; ties choose black; `ratioLabel` rounds to one decimal and shows a failing 4.46 as "4.4"; `adjust('#FFD700', '#ffffff', 4.5)` keeps hue 51° and saturation 100 %, reaches at least 4.5:1, and no 8-bit lightness closer to the input passes (about `#8b7500`); `adjust` of `#1D4ED8` against `#1d2939` goes lighter; HSL and hex round trips; invalid input returns `null`.
- [ ] T014 [P] Write `tests/unit/shared/components/code-editor/CodeEditor.spec.ts`, `tests/unit/shared/components/code-editor/line-layout.spec.ts` and `tests/unit/shared/components/code-editor/byte-length.spec.ts` (research R17, FR-072):
  - a labelled `<textarea>` with `autocapitalize="off"`, `autocorrect="off"`, `spellcheck="false"`, `autocomplete="off"`; `monospace` and `lineNumbers` props;
  - wrapping on by default; the toggle sets `wrap="off"` with sideways scrolling inside the editor only; the choice is not written to storage;
  - gutter numbers at `n × lineHeight` with wrapping off, and at the mirror-measured offsets with wrapping on (fake element heights), re-measured only for changed lines after input and for all lines on resize;
  - `marks` render a gutter icon with a text alternative and a list entry with "Go to line"; `goToLine(n)` selects line `n`, focuses the textarea, scrolls to it and announces "Line n: <message>";
  - the size status appears from 90 % of `maxBytes` (UTF-8 bytes) and above the limit sets `aria-invalid` and emits `overLimit`;
  - `readonly`; the Tab key's default action is never prevented.
- [ ] T015 [P] Write `tests/unit/shared/security/email-html.spec.ts` (research R21; FR-090, FR-107): the hostile vector table (`<script>`, `onerror`, `onload`, `javascript:` links, `<iframe>`, `<object>`, `<embed>`, `<form>` and controls, `<base>`, `<meta http-equiv="refresh">`, `<link>`, `<svg>`, `<math>`, media elements) is neutralised; tables, `div`, `span`, `font`, `center`, headings and lists are kept; `style` attributes become `data-preview-style` indexes with their CSS kept aside; `<style>` rules are applied per matching element in source order before the element's own styles; `@import`, `@font-face`, `@media` and `@keyframes` are dropped; declarations with `url(`, `image-set(`, `src(`, `expression(`, `behavior` or `-moz-binding` are dropped; every `<img>` (remote, relative or `data:`) becomes a placeholder naming its `alt`; links lose `href` and keep the target as `title`; `background`, `srcset`, `poster`, `lowsrc` and `dynsrc` are removed.
- [ ] T016 [P] Write `tests/unit/shared/components/EmailHtmlPreview.spec.ts`: the iframe has `sandbox="allow-same-origin"` exactly, no `src` and no `srcdoc`, and a `title`; the document is built only when the preview opens; styles are set through `element.style.cssText` and no element in the frame carries a `style` attribute set from markup; the frame is emptied on close; `EmailPreviewDialog.vue` is labelled, says that e-mail clients may show the message differently, fills the screen below `md`, and returns focus to its opener.
- [ ] T017 [P] Write `tests/unit/features/system-settings/lib/email-samples.spec.ts`: for `passwordReset`, `{{link}}`, `{{username}}`, `{{username2}}`, `{{date}}`, `{{token_lifetime}}` and `{{hostname}}` are replaced with translated samples, the real host name and the locale's date format; for `quota`, `{{username}}` and `{{percent}}`; sample values are HTML-escaped; unknown placeholders stay; `massMail` input is unchanged.
- [ ] T018 [P] Write `tests/unit/shared/validation/email.spec.ts` and `tests/unit/shared/validation/entry-list.spec.ts`. E-mail: `quota-warning@localhost` and `it@example.org` pass; `no-reply@`, `not-an-address`, addresses with whitespace or control characters fail. Entry lists: pasted text splits on spaces, commas, semicolons and line breaks; entries are trimmed; empty ones dropped; entries that differ only in letter case are kept once with the first spelling; `max` is reported.
- [ ] T019 [P] Extend `tests/unit/shared/components/TagEditor.spec.ts` (research R26): `validateEntry` marks an entry with its reason in text and blocks submission; `normalise` is applied on add; at `max` the add action is unavailable with the limit stated; pasting splits by `splitPattern`; remove buttons are at least 44 px and named with the entry; UI 002 FR-039's existing behaviour still passes.
- [ ] T020 [P] Write `tests/unit/i18n/problems-system-settings.spec.ts` (research R10; FR-092, FR-105): `tooLong` with `unit: bytes` formats `max` as a binary size; `insufficientContrast` shows `ratio`, `minimum` and the `surface`; `unsafeSvgContent.construct`, `invalidRegexLine.reason`, `unbalancedStructure.construct` and `notEligible.reason` values are translated; `invalidFormat` with `email`, `singleLine`, `appLinkUrl`, `hexColor` and `origin` selects its message; `sieveSyntax` embeds `message` quoted with `lang="en"` and `line`; an unknown code falls back to `validation.invalid`.
- [ ] T021 [P] Write `tests/unit/features/system-settings/catalogue.spec.ts`: seven groups and seventeen pages in FR-004 order with the ids, paths, sections, legacy names and audit targets of data-model §10; every page's route name resolves once registered; every key exists in en-gb; `visible(caps)` hides only `license` when `licenseVerificationEnabled` is `false`; every `auditTarget.type` is a value of the generated `AuditTargetType`; for every page component file that exists, each section id occurs as a heading `id` in the SFC (static scan; T179 requires all seventeen).
- [ ] T022 [P] Write `tests/unit/features/system-settings/composables/useSettingsSection.spec.ts` against the state machine of data-model §5 (research R9; FR-009 to FR-014, FR-017, FR-092): edit from the cached resource keeping its `etag`; a merge patch of only the changed fields (nested for the announcement, whole lists for app links, origins and recipients) with `If-Match`; on `200` the cache is written, success announced and the follow-up hook run; on `412` the draft is kept, the resource refetched and `changedSinceRead` filled; on `422` field errors are mapped and the summary focused; on `403 demo-mode` the draft is kept and the capabilities invalidated; on `503` and network failures the draft is kept with "nothing was changed"; only one section of a page edits at a time; Save is disabled while saving.
- [ ] T023 [P] Write `tests/unit/features/system-settings/composables/useSettingsSection-leave.spec.ts` (FR-013): a dirty section passes `shouldGuard: true` to UI 002's `useLeaveGuard` (`src/shared/composables/useLeaveGuard.ts`, the canonical leave guard of `docs/conventions.md`; no feature-own guard), so leaving asks through `useConfirm` and `beforeunload` is registered only while dirty; opening another section while one is dirty asks through `useConfirm`; nothing is asked when clean or after a save.
- [x] T024 [P] Write `tests/unit/features/system-settings/layouts/SettingsLayout.spec.ts`: loading and error states with retry for the capabilities (FR-032); the routed page renders only after the capabilities load; demo mode is provided to pages as read-only.
- [ ] T025 [P] Write `tests/e2e/system-settings/navigation/foundation.spec.ts`: on `settings-admin-defaults`, the navigation shows "System settings" (no longer a placeholder) and `/ng/system` renders the layout with the groups and the pages registered so far; on `settings-capabilities-error`, the area shows its error state and the retry recovers after `mockApi.patch`; FR-001: on `settings-domain-admin` and `settings-mailbox-user`, `/ng/system` shows UI 001's "no access" and `mockApi.requests()` contains no settings operation.

### Implementation of the shared building blocks and the settings core

- [ ] T026 [P] Implement `src/shared/color/contrast.ts` so that T013 passes.
- [ ] T027 [P] Implement `src/shared/components/code-editor/CodeEditor.vue`, `src/shared/components/code-editor/line-layout.ts` and `src/shared/components/code-editor/byte-length.ts` so that T014 passes (research R17). Add the `codeEditor.*` messages (wrap toggle, size status, over-limit, go to line, marks list, the Tab hint) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`.
- [ ] T028 [P] Implement `src/shared/security/email-html.ts` so that T015 passes, using the DOMPurify instance that UI 001 already bundles.
- [ ] T029 Implement `src/shared/components/EmailHtmlPreview.vue` and `src/shared/components/EmailPreviewDialog.vue` so that T016 passes (depends on T028); build the frame's document after its `load` event (research R21). Add the `emailPreview.*` messages (note, image placeholder, link title, close) in three locales.
- [ ] T030 [P] Implement `src/features/system-settings/lib/email-samples.ts` so that T017 passes.
- [ ] T031 [P] Implement `src/shared/validation/email.ts` (reuse and extend it if an earlier feature created it) and `src/shared/validation/entry-list.ts` so that T018 passes.
- [ ] T032 Extend `src/shared/components/TagEditor.vue` with `validateEntry`, `normalise`, `max` and `splitPattern` so that T019 passes. If UI 002's tag editor still lives in `src/features/domains/components/`, move it to `src/shared/components/TagEditor.vue` first and update its imports (second use, constitution VIII).
- [ ] T033 Extend `src/i18n/problems.ts` with the parameter formatting of research R10 so that T020 passes, and map the problem types and rule codes to the legacy `danger.*` messages of T008a's form map where the meaning matches (for example `sieveSyntax` → `danger.sieve_error`, `demo-mode` → `danger.demo_mode_enabled`, image limits → `danger.img_size_exceeded` and `danger.img_dimensions_exceeded`). Add, in three locales and only where the form map has no legacy key, `problem.<name>` for `demo-mode`, `feature-disabled`, `regex-map-unavailable`, `global-sieve-filter-unavailable`, `mass-mail-already-running`, `mass-mail-recipient-count-changed`, and this feature's wording for `container-action-failed`, `outcome-unknown` and `temporary-failure`; `validation.<code>` for `unsupportedImageType`, `invalidImage`, `imageDimensionsExceeded`, `unsafeSvgContent`, `insufficientContrast`, `invalidRegexLine`, `unbalancedStructure`, `mutuallyExclusive`, `tooFew`, `sieveSyntax`; `validation.format.{email,singleLine,appLinkUrl,hexColor,origin}`; `validation.params.construct.*` and `validation.params.reason.*` (data-model §8).
- [ ] T034 Implement `src/features/system-settings/api/capabilities.ts` (`useSettingsCapabilities`, `staleTime: 5 min`, research R8) and add to `src/shared/validation/limits.ts` the contract-only constants: app link address 2,048, CORS origin 2,048, copy recipient entry 255, each with its schema path. Extend `tests/unit/shared/validation/limits.spec.ts` to compare them with `contract/openapi.json`.
- [ ] T035 Implement `src/features/system-settings/catalogue.ts` with the seventeen pages of data-model §10 so that T021 passes for the parts that do not need page components.
- [ ] T036 Implement `src/features/system-settings/composables/useSettingsSection.ts` so that T022 and T023 pass. It builds on UI 002's `EditableSection` contract, the field diff of `src/shared/composables/useVersionedSave.ts` (001-R20) and UI 002's `useLeaveGuard`; editor pages and the compose page use `useLeaveGuard` directly.
- [ ] T037 Implement the common components in `src/features/system-settings/components/common/`:
  - `SettingsSection.vue`: wraps `src/shared/components/EditableSection.vue`; in edit mode below `md` the Save and Cancel actions sit in a sticky bottom bar, and `scroll-padding-bottom` equals the bar's height while it is shown (FR-009, FR-098);
  - `SettingsPageHeader.vue`: `<h1 tabindex="-1">`, description, below `xl` a "Settings" link to the overview and a slot for the page switcher, and a slot for History;
  - `ReadOnlyNotice.vue` (demo mode, FR-033), `DefaultBadge.vue` (FR-016), `SettingsNotFoundState.vue` (FR-006, with a link back to a given list), `StatusMessage.vue` (an inline status region that persists until the next action and never disappears while focused or hovered, FR-093).
- [ ] T038 Implement `src/features/system-settings/layouts/SettingsLayout.vue` (capabilities gate, error state, provides read-only for demo mode), `src/features/system-settings/routes.ts` (the parent `/system` route `system-settings` with `meta.navEntry: 'system'` and the overview child), a minimal `src/features/system-settings/pages/SettingsOverviewPage.vue` (groups and visible pages with descriptions as links, listing only pages whose route is registered) and `src/features/system-settings/index.ts`. Register the routes in `src/app/router/routes.ts`, and set the catalogue's `system` entry to `available` in `src/app/navigation/catalogue.ts`. T024 and T025 must pass.
- [ ] T039 Use the legacy keys of T008a's form map verbatim as page titles (the legacy menu entries and card titles, for example `admin.change_logo`, `admin.ui_texts`, `admin.login_page`, `admin.app_links`, `admin.password_policy`, `admin.password_reset_settings`, `admin.quota_notifications`, `admin.rspamd_settings_map`, `admin.regex_maps`, `admin.cors_settings`, `admin.ip_check`, `admin.guid_and_license`, `admin.sys_mails`) and for the common actions (`admin.save`, `admin.remove`, `admin.add`). Add to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` only the new strings: `systemSettings.overview.*`, `systemSettings.groups.*`, the page descriptions, the titles without a legacy key and the `systemSettings.common.*` entries without a legacy equivalent. `npm run i18n:check` must pass.
- [ ] T040 Record in `specs/013-system-settings/contracts/README.md` whether any operation of the pinned contract differs from the planning baseline, and stop for re-planning if one used by this feature does (constitution I). Specify API gap G1 (a stable `failureCode` for mass mail recipients, `specs/013-system-settings/plan.md`) in mailcow-rest-v2 before US10 starts, and record the reference in the plan's gap section; if the pinned contract already has such a code, translate it in US10 instead of quoting replies.

**Checkpoint**: The foundation is ready. An administrator opens `/ng/system` and sees the settings
area; the shared editor, preview, contrast maths and entry lists exist with their tests. User
stories can now start.

---

## Phase 3: User Story 1 - Find a setting quickly, also on a phone (Priority: P1) 🎯 MVP

**Goal**: The grouped overview with search over the app's own catalogue, the wide-screen page list,
the phone page switcher, focus on the matching section, addresses per page, and "no access" for
other roles.

**Independent Test**: At 360 px and on desktop, search page names, section headings, field labels
and legacy names in all three languages; open pages from search, list and address; move between
groups; repeat as a domain administrator and a mailbox user.

### Tests for User Story 1 (write first; must fail)

- [ ] T041 [US1] Write `tests/e2e/system-settings/navigation/settings-navigation.spec.ts` on `settings-admin-defaults`:
  - US1-AS1: at 360 px, groups with their pages and one-line descriptions, no horizontal scroll;
  - US1-AS2: typing "announcement" lists "UI texts › Announcement"; selecting it opens `/ng/system/ui-texts#announcement` with focus on the announcement heading;
  - US1-AS3: in Czech, a field label typed without diacritics finds its page; "Customize" and "System mails" find the branding pages and the mass mail pages;
  - US1-AS4: no match shows "No matching settings" and "Clear search" restores the overview;
  - US1-AS5: at 360 px, the page switcher lists every page by group with the current one marked (`aria-current="page"`), works by touch and keyboard, and opens the chosen page;
  - US1-AS6: on `settings-domain-admin` and `settings-mailbox-user`, no navigation entry, and a settings address shows "no access" without settings requests;
  - US1-AS7: reloading a page, and opening its address in a new context, opens the same page;
  - FR-005: at 1366 px, the grouped list stays beside the open page and marks it;
  - FR-033: on `settings-license-disabled`, License is absent from the overview, the switcher and the search, and `/ng/system/license` shows the "not found" state;
  - FR-100: the result count is announced in the polite live region; SC-014: results appear within 300 ms of a keystroke (measured);
  - FR-007 and FR-008: page names, descriptions, section headings, field labels and legacy names are found, and typing in the search sends no request (`mockApi.requests()` unchanged).
- [ ] T042 [P] [US1] Write `tests/unit/features/system-settings/search.spec.ts` (research R6): normalisation of Czech and Slovak diacritics and case; all query tokens must match; the ranking order; grouping by page with the matched section; English legacy names found in `cs-cz`; License excluded when hidden; the index rebuilt on a locale change; a search over the full index takes under 5 ms.
- [ ] T043 [P] [US1] Write `tests/unit/features/system-settings/layouts/PageSwitcher.spec.ts` and `tests/unit/features/system-settings/layouts/SettingsNav.spec.ts`: a labelled dialog of links grouped under headings, the current page marked, closing on choice with focus on the new page's heading, Escape closes; `SettingsNav` renders only from `xl` up.
- [ ] T044 [P] [US1] Write `tests/unit/app/router/focus-hash.spec.ts`: a route with a hash focuses the element with that id when it is a heading with `tabindex="-1"`; it waits for the element through a `MutationObserver` for at most 3 s and otherwise focuses the `<h1>`; routes without a hash keep 001-R19's behaviour.
- [ ] T045 [P] [US1] Write `tests/smoke/system-settings/navigation.smoke.spec.ts`: `admin` opens `/ng/system`, the overview lists the pages the dev stack's capabilities allow, and searching "announcement" opens UI texts; `reseller` sees "no access" at `/ng/system`.

### Implementation for User Story 1

- [ ] T046 [US1] Implement `src/features/system-settings/search.ts` so that T042 passes.
- [ ] T047 [US1] Extend `src/app/router/focus.ts` with hash-target focus and the router's `scrollBehavior` with `{ el: hash }` so that T044 passes.
- [ ] T048 [P] [US1] Implement `src/features/system-settings/layouts/SettingsNav.vue` and `src/features/system-settings/layouts/PageSwitcher.vue` (Reka `Dialog`, bottom sheet below `md`), and integrate them in `SettingsLayout.vue` and `SettingsPageHeader.vue` so that T043 passes.
- [ ] T049 [US1] Complete `src/features/system-settings/pages/SettingsOverviewPage.vue`: the search field with `q` in the address (`router.replace` while typing), results grouped by page with "Page › Section", "No matching settings" with "Clear search", the debounced count announcement, and License visibility from the capabilities.
- [ ] T050 [US1] Add `systemSettings.search.*` (plural count), `systemSettings.legacyNames.{rspamdUi,prefilter,postfilter}`, and `systemSettings.sections.<page>.<section>` and `systemSettings.fields.<page>.<field>` only for catalogue entries without a legacy key in T008a's form map, to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. The catalogue's other headings and labels, and the legacy names of data-model §10, are legacy keys used verbatim (`admin.customize`, `admin.change_logo`, `admin.ui_texts`, `admin.ui_header_announcement`, `admin.login_page`, `admin.app_links`, `admin.password_settings`, `admin.password_policy`, `admin.password_reset_settings`, `admin.quota_notifications`, `edit.quota_warning_bcc`, `admin.rspamd_settings_map`, `admin.active_rspamd_settings_map`, `admin.rspamd_global_filters`, `admin.regex_maps`, `mailbox.filters`, `admin.cors_settings`, `admin.ip_check`, `admin.guid_and_license`, `admin.sys_mails`); keys missing from the upstream sk-sk file fall back to `en-gb` and are not written by hand. `npm run i18n:check` must pass.
- [ ] T051 [US1] Run T041 to T045 on all projects and fix failures until they pass.

**Checkpoint**: US1 works on its own: the settings area is navigable and searchable. This is the MVP.

---

## Phase 4: User Story 2 - Brand the app with logos and texts (Priority: P1)

**Goal**: The Logos page (previews in both themes before upload, checks against the server's limits,
details, deletion) and the UI texts page (titles, apps heading, sanitised help text and footer
previews, announcement preview), with the shell updating at once.

**Independent Test**: Upload PNG, JPEG, GIF and SVG logos, a PDF named `logo.png`, an SVG with a
script and an oversized file; delete a logo; change every text including hostile HTML; check the
previews, the requests, every message, and the shell after each save.

### Tests for User Story 2 (write first; must fail)

- [ ] T052 [US2] Implement the first part of `tests/mocks/handlers/settings-branding.ts` and register it in `tests/mocks/handlers/index.ts`:
  - `getLogoSetting`, `replaceLogo`, `deleteLogo`: content classification by signature (an SVG containing `<script`, an `on…=` attribute or `javascript:` is refused as `unsafeSvgContent` with `construct` and `line`), `unsupportedImageType` with `allowed`, `tooLong` with `unit: bytes`, `imageDimensionsExceeded`, `If-Match` and `412`, `403 demo-mode`, `503` injection; the stored bytes are served by `getPublicConfigLogo`;
  - `getUiTexts`, `updateUiTexts`: merge patch, `singleLine` refusal of line breaks, the 255 and 65,535 limits, the announcement type enum or `null`, `If-Match`, demo mode, `403 forbidden` injection.

  Add `tests/fixtures/logos/` (`logo-300x80.png`, `logo.jpg`, `logo-animated.gif`, `logo.svg` with width and height, `logo-no-size.svg`, `logo-script.svg`, `pdf-named-logo.png`) and the scenarios `branding-light-logo` (a stored light logo, no dark logo), `branding-legacy-unsafe-svg` (a stored SVG with a script), `ui-texts-custom`, `announcement-warning-active` and `help-text-malicious` in `tests/mocks/scenarios/system-settings.ts`.
- [ ] T053 [P] [US2] Write `tests/e2e/system-settings/branding/logos.spec.ts`:
  - US2-AS1: choosing the 300 × 80 PNG shows, before any request, the file's name, type and size and previews on a light and a dark surface at header and sign-in size; Upload announces success, shows type, dimensions and size, and the shell header shows the logo in the light theme;
  - US2-AS2: the SVG with a script is refused by the API with a translated message naming the construct; the stored logo stays;
  - US2-AS3: a file above `maxBytes` (generated in the test) is refused before upload with the limit as a binary size and no Upload action; a raster above the pixel limit likewise;
  - US2-AS4 and FR-022: deleting the dark logo after a confirmation that names the variant and shows the default shows that default in the dark preview and in the dark shell header; FR-011: a deletion refused as outdated shows the confirmation again with the fresh logo;
  - FR-019: previews only as `<img>` elements, on both surfaces and at both sizes; FR-021: API refusals are translated with their parameters and the stored logo stays shown; FR-105: sizes in binary units formatted for the locale;
  - FR-018: an SVG without size shows "no declared size"; FR-020: JPEG, animated GIF and SVG are accepted; a PDF named `logo.png` is refused before upload as an unsupported type; FR-023: the guidance states the sizes the app uses and the server's limits from the capabilities;
  - Edges: the stored legacy SVG with a script is shown only as an image; a logo that fails to load shows the product name; on `branding-light-logo` the dark preview shows the default; demo mode shows the page read-only with the reason (FR-033); a lowered limit refused by the API states the current limit;
  - no CSP violation while `blob:` previews are shown.
- [ ] T054 [P] [US2] Write `tests/e2e/system-settings/branding/ui-texts.spec.ts`:
  - US2-AS5: on `help-text-malicious`, the help text preview shows the paragraph and the link, runs and shows no script, and lists the removed kinds of content with the note that the classic interface shows the HTML as written (FR-036);
  - US2-AS6: product name "Acme & Co Mail" appears literally in the header, on the sign-in screen and in the page title; FR-035: `<b>` in a plain-text field is shown literally;
  - US2-AS7: on `announcement-warning-active`, switching it off and saving removes the announcement from the app; a new context no longer sees it;
  - US2-AS8: leaving with unsaved changes asks for confirmation;
  - FR-034: a pasted line break in a single-line field is refused with `singleLine`; the 255 and 65,535 limits; the apps heading explains the Apps menu and its translated default;
  - FR-016: empty fields say what the empty value means, with the server's default shown;
  - FR-037: the announcement preview for each type and for "no type" (neutral), with the type in text;
  - FR-009: at 360 px the edited section's Save and Cancel stay visible without scrolling, and a focused field is never hidden behind the bar;
  - FR-010: the request carries only the changed fields and `If-Match` (`mockApi.requests()`), and the page continues with the returned values and version tag; FR-012: two field errors show next to their fields and in an error summary whose links move focus to them; FR-014: Save shows progress and ignores a second activation;
  - FR-011 and SC-007: an outdated save (`mockApi.patch` changes the product name meanwhile) keeps the input, marks the changed field with its new value, and saving again succeeds;
  - FR-033: on `settings-demo-mode` the page is read-only with the reason;
  - FR-003: a `403 forbidden` keeps the input, shows the reason and refreshes the identity; FR-017: demo mode switched on while the form is open keeps the input and turns the page read-only; Edge: a temporary failure says nothing changed and the retry keeps the input.
- [ ] T055 [P] [US2] Write unit tests: `tests/unit/features/system-settings/lib/logo-file.spec.ts` (PNG, JPEG, GIF signatures; SVG after a BOM, an XML declaration, comments and a doctype; anything else `null`), `tests/unit/features/system-settings/composables/useLogoCandidate.spec.ts` (size and dimension checks from the capabilities, `createImageBitmap` dimensions, the object URL revoked on cancel, upload and unmount), `tests/unit/features/system-settings/components/branding/LogoCard.spec.ts` (details in text, "no declared size", the deletion confirmation text), `tests/unit/shared/security/sanitize-report.spec.ts` (`sanitizeHtmlWithReport` reports scripts, styles, images, forms, frames, event handlers, unsupported links and other formatting; for every vector of UI 001's sanitiser table its `html` equals `sanitizeHtml()`'s output, SC-010) and `tests/unit/features/system-settings/components/branding/HtmlFieldPreview.spec.ts`.
- [ ] T056 [P] [US2] Write `tests/smoke/system-settings/branding.smoke.spec.ts`: as `admin`, set the product name to a unique value, see it in `GET /api/v2/public-config` and in the header, then restore the previous value.

### Implementation for User Story 2

- [ ] T057 [US2] Amend the CSP in `docker/nginx/security-headers.conf` to `img-src 'self' blob:` (research R14); `vite preview` reads the same file. Update the CSP expectation in `tests/smoke/sign-in.smoke.spec.ts` if it compares the exact header.
- [ ] T058 [US2] Implement `src/app/branding/logo-sizes.ts` and give `src/app/shell/BrandLogo.vue` a `size` (`header`, `signIn`) and an optional `src` prop, keeping the shell's current rendering; extend `tests/unit/app/shell/shell.spec.ts` for both props.
- [ ] T059 [P] [US2] Implement `src/features/system-settings/lib/logo-file.ts` and `src/features/system-settings/composables/useLogoCandidate.ts`.
- [ ] T060 [P] [US2] Add `sanitizeHtmlWithReport()` to `src/shared/security/sanitize.ts`.
- [ ] T061 [US2] Implement the logo and UI text queries and mutations in `src/features/system-settings/api/branding.ts`: `replaceLogo` with `bodySerializer: (file) => file`, the detected `Content-Type` (or `application/octet-stream`) and `If-Match`; `deleteLogo` with `If-Match`; `updateUiTexts` as a merge patch; every successful save invalidates `['public-config']` (data-model §3).
- [ ] T062 [US2] Implement `src/features/system-settings/components/branding/LogoPreview.vue` (BrandLogo at both sizes on light and dark surfaces), `LogoUploadPanel.vue` and `LogoCard.vue`, and `src/features/system-settings/pages/branding/LogosPage.vue`; add the `system-settings-logos` route to `src/features/system-settings/routes.ts`.
- [ ] T063 [US2] Implement `src/features/system-settings/components/branding/HtmlFieldPreview.vue` and `src/features/system-settings/pages/branding/UiTextsPage.vue` with the sections `names`, `login-help`, `footer` and `announcement` (the preview reuses `src/app/shell/AnnouncementBanner.vue` with the draft values); add the `system-settings-ui-texts` route.
- [ ] T064 [US2] Add to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` only the `systemSettings.logos.*` and `systemSettings.uiTexts.*` new strings of T008a's form map (previews, empty meanings, removed-content notes). Use verbatim the legacy keys `admin.change_logo`, `admin.logo_info`, `admin.reset_default`, `admin.logo_normal_label`, `admin.logo_dark_label`, `admin.upload`, `admin.help_text`, `admin.ui_footer`, `admin.ui_header_announcement_type`, `admin.ui_header_announcement_type_info`, `admin.ui_header_announcement_type_warning`, `admin.ui_header_announcement_type_danger`, `admin.ui_header_announcement_help`, `admin.ui_header_announcement_active`, `admin.main_name`, `admin.title_name`, `admin.apps_name` (with the placeholder `header.apps`), `success.ui_texts`, `success.upload_success`, `success.reset_main_logo`, `danger.img_size_exceeded` and `danger.img_dimensions_exceeded`; the announcement text label follows plan "Deviations needing a decision" item 4. No `legacy-map.json` entry and no hand-written sk-sk value for a legacy key (FR-103). `npm run i18n:check` must pass.
- [ ] T065 [US2] Run T053 to T056 on all projects and fix failures until they pass.

**Checkpoint**: US1 and US2 work on their own.

---

## Phase 5: User Story 3 - Choose brand colours that stay accessible (Priority: P1)

**Goal**: The Colours page with live contrast feedback, the accessible adjustment and the live
preview, and the brand colours applied to the whole app through CSS custom properties.

**Independent Test**: Enter passing, failing, upper-case, unprefixed and invalid colours per theme;
set only a light colour, both, and clear both; check the preview, ratios, offer, requests and the
app's colours afterwards in both themes with automated contrast checks.

### Tests for User Story 3 (write first; must fail)

- [ ] T066 [US3] Extend `tests/mocks/handlers/settings-branding.ts` with `getBrandColors` and `updateBrandColors`: `hexColor` format, exact ratio ≥ the minimum against the theme's reference, refusal `insufficientContrast` with `ratio` rounded down to two decimals, `minimum` and `surface`; lower-case storage; `effective` per FR-031; demo mode; `If-Match`. Add the scenarios `brand-colours-none`, `brand-colours-set` (light `#1d4ed8`, dark `#60a5fa`) and `brand-colours-light-only` (`#1d4ed8`).
- [ ] T067 [P] [US3] Write `tests/e2e/system-settings/colours/colours.spec.ts`:
  - US3-AS1 and FR-025: `#1D4ED8` for the light theme shows white text on the preview button and "6.7:1, minimum 4.5:1, passes" in text; the dark preview says the colour reaches only 2.2:1 and that the dark theme keeps the default palette;
  - US3-AS2: `#FFD700` shows 1.4:1, "fails" in text, Save unavailable, and an offered colour reaching at least 4.5:1 that replaces the value when chosen (FR-026);
  - US3-AS3: dark `#60A5FA` shows black text and 5.8:1, passes;
  - US3-AS7: a refusal by the API (a colour accepted locally but refused, injected) shows the measured ratio, the minimum and the reference surface on the field (FR-028);
  - FR-024: `1d4ed8` is normalised to `#1d4ed8`; upper case accepted; `#abc` refused with a format hint; FR-102: the hex field is always available and the colour picker sets the same value; FR-027: the preview shows the header sample, primary button, link, selected navigation entry and checked switch per theme; FR-029: the explanation about the classic interface and clearing;
  - Edge: on `brand-colours-light-only` with a light colour too bright for the dark surface, the dark preview and the dark theme use the default palette;
  - demo mode shows the page read-only.
- [ ] T068 [P] [US3] Write `tests/e2e/system-settings/colours/brand-shell.spec.ts`:
  - US3-AS4 and FR-030: after saving `brand-colours-set`, primary buttons, links, the selected navigation entry and checked switches, checkboxes and radio buttons use the effective colour and foreground in both themes at once (computed styles), and a new context sees them after loading;
  - US3-AS5: clearing both and saving returns the default palette;
  - US3-AS6: success, warning, error and info states and the focus indicator keep their colours;
  - a public configuration without `brandColors` keeps the defaults; no CSP violation is recorded.
- [ ] T069 [P] [US3] Write unit tests: `tests/unit/app/branding/brand-colors.spec.ts` (sets the six `--brand-*` properties on `<html>` with `style.setProperty`, removes them for `null` or a missing `brandColors`, hover towards black for a white foreground and towards white for a black one, reacts to public configuration changes), `tests/unit/features/system-settings/components/branding/ColourField.spec.ts` (normalisation, picker sync, clearing gives `null`, the offer button), `tests/unit/features/system-settings/components/branding/ContrastReport.spec.ts` (verdicts in text, `ratioLabel`) and `tests/unit/features/system-settings/components/branding/BrandPreview.spec.ts` (custom properties set through a `:style` binding on its own container, all five sample elements, the dark-rule statement).
- [ ] T070 [P] [US3] Write `tests/e2e/system-settings/colours/brand-palette-sweep.spec.ts` (SC-004): with the limit palettes (light `#767676`, dark `#8f8f8f`) and the extreme palettes (light `#0f766e`, dark `#f472b6`) set through the scenario's brand colours, run axe `color-contrast` in both themes on a representative screen of every feature that exists: sign-in, home, a list, a detail form, a dialog, the audit log, and this feature's overview, Colours and a settings form.
- [ ] T071 [US3] Extend `tests/e2e/fixtures/a11y.ts` (SC-003): after the default light and dark passes, `expectAccessible` sets `--brand-light: #767676`, `--brand-light-foreground: #000000`, `--brand-dark: #8f8f8f`, `--brand-dark-foreground: #000000` (and their hover values) on `<html>` and runs axe in both themes again, then removes them (research R12). From now on every end-to-end test of every feature runs these passes.
- [ ] T072 [P] [US3] Write `tests/smoke/system-settings/colours.smoke.spec.ts`: as `admin`, set the light colour `#1d4ed8`, read `GET /api/v2/public-config` and find `brandColors.light` with foreground `#ffffff` and `brandColors.dark` `null`, then clear the colours and find both `null`.

### Implementation for User Story 3

- [ ] T073 [US3] Add the accent tokens of research R12 to `src/styles/main.css` (`--accent`, `--accent-foreground`, `--accent-text`, `--accent-hover`, each reading `--brand-light-*` under `:root` and `--brand-dark-*` under `.dark` with UI 001's defaults as fallbacks; `@theme inline` utilities; the link style; a separate `--color-focus`). Rewire `src/shared/ui/button` (primary variant), `src/shared/ui/switch`, `src/shared/ui/checkbox`, `src/shared/ui/radio-group` and `src/app/shell/NavigationList.vue` (the selected entry becomes a solid `bg-accent text-accent-foreground` pill) to the tokens, and keep tinted or muted surfaces free of `text-accent-text`. Update their unit tests.
- [ ] T074 [US3] Implement `src/app/branding/brand-colors.ts` and start it from `src/app/bootstrap.ts` so that it follows the public configuration query; T069's brand-colors test must pass.
- [ ] T075 [US3] Implement the brand colour query and mutation in `src/features/system-settings/api/branding.ts` (invalidating `['public-config']`), `src/features/system-settings/components/branding/ColourField.vue`, `ContrastReport.vue` and `BrandPreview.vue`, and `src/features/system-settings/pages/branding/ColoursPage.vue` with the sections `brand-colours` and `colour-preview`, using the references from the capabilities; add the `system-settings-colours` route.
- [ ] T076 [US3] Add `systemSettings.colours.*` (ratio and minimum with locale number formatting, passes and fails, the offer, the dark-theme rule statements, the classic interface note) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. `npm run i18n:check` must pass. Then run T067 to T072 and the whole end-to-end suite with the extended fixture, and fix every contrast violation by moving brand-coloured text onto white or dark reference surfaces (research R12).

**Checkpoint**: All P1 stories work; brand colours apply app-wide and every end-to-end test checks
them at the 4.5:1 limit.

---

## Phase 6: User Story 4 - Configure the sign-in page and the app links (Priority: P2)

**Goal**: The Sign-in page options with the force-SSO note, and the custom app links with
validation, reordering, the user-link preview, the built-in links and the limit.

**Independent Test**: Change each sign-in option; add, edit, reorder and remove app links on a phone
and a desktop, including invalid links and the 50-entry limit; check requests and messages.

### Tests for User Story 4 (write first; must fail)

- [ ] T077 [US4] Extend `tests/mocks/handlers/settings-branding.ts` with `getLoginPageSettings`, `updateLoginPageSettings`, `getAppLinkSettings` and `updateAppLinkSettings` (per-entry errors at `links.<i>.<field>` with `appLinkUrl`, `singleLine`, `tooLong`; at most 50 entries; built-in links read-only; demo mode; `If-Match`), feeding the public configuration. Add the scenarios `app-links-three`, `app-links-50`, `idp-none` (`singleSignOnAvailable: false`) and `idp-sso-available`.
- [ ] T078 [P] [US4] Write `tests/e2e/system-settings/sign-in-and-app-links/sign-in-page.spec.ts`: US4-AS1 (hiding the administrator link removes it from the sign-in screens); US4-AS2 (on `idp-none`, force single sign-on says it has no effect until single sign-on is configured, with a link to the identity providers screen); FR-038 the legacy explanations; demo mode read-only.
- [ ] T079 [P] [US4] Write `tests/e2e/system-settings/sign-in-and-app-links/app-links.spec.ts`: US4-AS3 (the user link preview reads `https://help.example.org/?u=admin` for `admin`; after saving, UI 001's Apps menu shows the link without a reload); US4-AS4 (`javascript:alert(1)` is marked invalid before sending); US4-AS5 (moving the third link to the top with its labelled move actions, by touch and by keyboard, announces the new position and saves the order); US4-AS6 (built-in links read-only with an explanation); US4-AS7 (on `app-links-50` the add action is unavailable and the limit of 50 is stated); US4-AS8 (a removed, unsaved link asks before leaving); FR-040 add, edit and remove, the list saved as a whole; FR-039 cards at 360 px and a table at 1366 px; FR-104 link names shown as stored; FR-033 demo mode read-only; FR-041 explanations of signed-out and signed-in links and `%u`; Edges: a relative path is accepted with its explanation, 255-character names wrap, a webmail link is still listed while the groupware is disabled.
- [ ] T080 [P] [US4] Write unit tests: `tests/unit/features/system-settings/lib/app-link-url.spec.ts` (absolute `http`/`https`, one leading `/`, `//host` refused, `%u` only in user links, 2,048 limit), `tests/unit/features/system-settings/components/branding/AppLinkList.spec.ts` (move up and down, add disabled at the limit, remove, the user-link preview with `encodeURIComponent(username)`) and `tests/unit/features/system-settings/components/branding/AppLinkEntryForm.spec.ts`.
- [ ] T081 [P] [US4] Write `tests/smoke/system-settings/sign-in-page.smoke.spec.ts`: as `admin`, hide the domain administrator link, find `loginPage.hideDomainAdminLogin: true` in the public configuration, and restore it.

### Implementation for User Story 4

- [ ] T082 [US4] Implement the login page and app link queries and mutations in `src/features/system-settings/api/branding.ts` (both invalidate `['public-config']`), and `src/features/system-settings/lib/app-link-url.ts`.
- [ ] T083 [US4] Implement `src/features/system-settings/pages/branding/SignInPageSettingsPage.vue` with the sections `sign-in-links` and `single-sign-on`; the note reads `externalIdentityProvider.singleSignOnAvailable` from the public configuration and links to UI 012's identity providers screen when its catalogue entry is available; add the `system-settings-sign-in-page` route.
- [ ] T084 [US4] Implement `src/features/system-settings/components/branding/AppLinkList.vue` (cards below `md`, table from `md` up, labelled move actions), `AppLinkEntryForm.vue` and `BuiltInAppLinks.vue`, and `src/features/system-settings/pages/branding/AppLinksPage.vue` (the list saved as a whole); add the `system-settings-app-links` route.
- [ ] T085 [US4] Add to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` only the `systemSettings.signInPage.*` and `systemSettings.appLinks.*` new strings of T008a's form map (the "no effect without single sign-on" note, reorder actions, the user link preview). Use verbatim the legacy keys `admin.login_page`, `admin.quicklink_text`, `admin.user_quicklink`, `admin.domainadmin_quicklink`, `admin.admin_quicklink`, `admin.force_sso`, `admin.force_sso_text`, `admin.app_links`, `admin.app_name`, `admin.link`, `admin.user_link`, `admin.app_hide`, `admin.add_row`, `admin.remove_row`, `admin.merged_vars_hint` (markup through `SanitizedHtml.vue`), `success.custom_login_modified` and `success.app_links`. No hand-written sk-sk value for a legacy key. `npm run i18n:check` must pass.

**Checkpoint**: US1 to US4 work on their own.

---

## Phase 7: User Story 5 - Set the password policy and the password reset e-mail (Priority: P2)

**Goal**: The password policy with live rules, and the reset e-mail with availability, placeholders,
default templates, warnings and the isolated HTML preview.

**Independent Test**: Change the policy with valid and out-of-range lengths; save the reset e-mail
with valid and invalid senders, custom, default and partly empty templates, and with the sender or
subject cleared; check requests, previews, availability and messages.

### Tests for User Story 5 (write first; must fail)

- [ ] T086 [US5] Implement `tests/mocks/handlers/settings-password.ts` (`getPasswordResetNotification`, `updatePasswordResetNotification`: `email` format for the sender, `singleLine` and 255 for the subject, 1 MiB templates, default templates and `templatesAreDefault`, `passwordResetAvailable`, `If-Match`) and extend UI 003's `tests/mocks/handlers/password-policy.ts` with `updatePasswordPolicy` (`outOfRange` with `min: 3`, `max: 64`, the version tag shared with `getPasswordPolicy`); register both. Add the scenarios `password-defaults`, `password-reset-available` and `password-reset-custom`, and `tests/fixtures/email/hostile.html` (scripts, `onerror`, `javascript:` links, a form, remote images, CSS `url()`, `@import`, `<base>`, `<meta http-equiv="refresh">`).
- [ ] T087 [P] [US5] Write `tests/e2e/system-settings/passwords/password-policy.spec.ts` (FR-043, FR-044): US5-AS1 (length 10 with digits and mixed case saves, and the rules read "Minimum password length is 10", "Must contain at least one number", "Must contain lowercase and uppercase characters"); US5-AS2 (2 and 65 state the range 3 to 64 before sending); FR-044 the rules update while editing, with the note that existing passwords keep working; an outdated save keeps the input; FR-109 a password form of UI 003 afterwards shows the new rules without a reload.
- [ ] T088 [P] [US5] Write `tests/e2e/system-settings/passwords/password-reset-email.spec.ts`: US5-AS3 (`no-reply@` gives a translated sender error); US5-AS4 (default templates shown and marked); US5-AS5 (clearing the subject warns that self-service reset stops for every user and asks; afterwards the page says reset is unavailable); US5-AS6 (restoring defaults and saving shows the default templates marked); US5-AS7 (FR-090: the HTML preview, opened only on request, replaces placeholders with samples, runs no script and loads no remote resource); US5-AS8 (a text template without `{{link}}` warns without blocking); FR-046 and FR-047 are traced by AS-4 to AS-6; FR-045 the placeholder reference with a copy action per placeholder; FR-048 one empty template warns; FR-072 the template editors use a monospace font without line numbers and show the size from 90 %.
- [ ] T089 [P] [US5] Write `tests/e2e/system-settings/security/email-preview-isolation.spec.ts` (research R21, SC-010) on `password-reset-custom` with the hostile fixture as the HTML template: opening the preview issues no request outside the app's origin (`page.on('request')`), opens no dialog (`page.on('dialog')`), does not navigate, sets no `window.__pwned` flag from the fixture's scripts, records no CSP violation, shows image placeholders and inert links; run on Chromium and WebKit.
- [ ] T090 [P] [US5] Write unit tests: `tests/unit/features/system-settings/components/passwords/PolicyRulesPreview.spec.ts` (the legacy rule texts for each combination, live from the draft), `tests/unit/features/system-settings/components/passwords/PlaceholderReference.spec.ts` (meaning and copy per placeholder) and `tests/unit/features/system-settings/pages/passwords/PasswordResetEmailPage.spec.ts` (the warning before saving an empty sender or subject while reset is available; restore empties both templates; the `{{link}}` and one-empty warnings).
- [ ] T091 [P] [US5] Write `tests/smoke/system-settings/passwords.smoke.spec.ts`: as `admin`, raise the minimum length by one and restore it; read the reset e-mail page and its availability.

### Implementation for User Story 5

- [ ] T092 [US5] Implement `src/features/system-settings/api/passwords.ts`: the policy through UI 003's password-policy query key, `updatePasswordPolicy` writing that key (FR-109), and the reset notification query and mutation.
- [ ] T093 [P] [US5] Implement `src/features/system-settings/components/passwords/PolicyRulesPreview.vue` (reuse the shared policy rules list if UI 003, 005 or 007 promoted one), `PlaceholderReference.vue` and `TemplateField.vue` (`CodeEditor` without line numbers, the default badge, "Restore default", the Preview action opening `EmailPreviewDialog`).
- [ ] T094 [US5] Implement `src/features/system-settings/pages/passwords/PasswordPolicyPage.vue` (sections `policy`, `policy-rules`; `inputmode="numeric"`) and `src/features/system-settings/pages/passwords/PasswordResetEmailPage.vue` (sections `availability`, `sender`, `templates`, `placeholders`); add both routes.
- [ ] T095 [US5] Add to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` only the `systemSettings.passwordPolicy.*` and `systemSettings.passwordReset.*` new strings of T008a's form map (including the sample values for the preview and the warnings without a legacy equivalent). Use verbatim the legacy keys `admin.password_settings`, `admin.password_policy`, `admin.password_reset_settings`, `admin.quota_notification_sender` and `admin.quota_notification_subject` (legacy's sender and subject labels on this form), `admin.reset_password_vars`, `admin.restore_template`, `admin.password_length`, `admin.password_policy_length` (with `%d`), `admin.password_policy_chars`, `admin.password_policy_numbers`, `admin.password_policy_special_chars`, `admin.password_policy_lowerupper`, `admin.password_reset_tmpl_text`, `admin.password_reset_tmpl_html` and `success.password_policy_saved`. `npm run i18n:check` must pass.
- [ ] T096 [US5] Run T087 to T091 on all projects and fix failures until they pass.

**Checkpoint**: US1 to US5 work on their own.

---

## Phase 8: User Story 6 - Configure quota notifications and their copies (Priority: P2)

**Goal**: The Quota notifications page with defaults, explanations and the preview, and the "Quota
notification copies" section on UI 002's domain page for administrators and domain administrators.

**Independent Test**: Read and save the notification settings with defaults, custom values and
invalid senders; as an administrator and a domain administrator, read and save the copies of a
domain with invalid entries, duplicates, an empty active list and a domain outside the scope.

**Depends on**: UI 002's domain page and its section area.

### Tests for User Story 6 (write first; must fail)

- [ ] T097 [US6] Implement `tests/mocks/handlers/settings-quota-notifications.ts` (settings with the `…IsDefault` markers and empty values restoring defaults; recipients per domain: `404` for a domain outside the caller's scope or an alias domain, `email` per entry at `recipients.<i>`, case-insensitive dedupe keeping the first spelling, at most 100, an empty list stored inactive, `If-Match`) and register it. Add the scenarios `quota-defaults`, `quota-custom` and `quota-copies-example-org` (a domain administrator of `example.org`, recipients of `example.net` kept after domain deletion).
- [ ] T098 [P] [US6] Write `tests/e2e/system-settings/quota/quota-notifications.spec.ts`: US6-AS1 (defaults shown and marked; the 80 % and 95 % explanation); US6-AS2 (custom sender, subject and template with `{{username}}` and `{{percent}}` save and lose their default marks); FR-049 the variables, empty meanings and the fallback explanation, "Restore default template", the isolated preview; FR-050 the explanation of per-domain copies and the link to UI 002's domain list.
- [ ] T099 [P] [US6] Write `tests/e2e/system-settings/quota/quota-copies.spec.ts`: US6-AS3 (the domain administrator of `example.org` adds `it@example.org` and `boss@example.net` on the domain page, switches copies on, saves, and sees both active); US6-AS4 (`not-an-address` is marked before sending); US6-AS5 (FR-053: an empty active list explains that copies stay inactive and shows them inactive after saving; the save replaces the whole list and the active state); US6-AS6 (a domain the domain administrator does not manage shows UI 002's "not found"); FR-051 the explanation of separate copies with the mailbox name in the subject; FR-052 pasting several addresses and case duplicates; an administrator edits any domain; Edges: the domain removed from the scope while the section is open says it is no longer available; recipients reappear for a re-created domain.
- [ ] T100 [P] [US6] Write `tests/unit/features/system-settings/components/notifications/QuotaCopiesSection.spec.ts`: view and edit modes, the tag editor with the e-mail check and the limit from the capabilities, the empty-list explanation, `404` handling, and History rendered only for administrators.
- [ ] T101 [P] [US6] Write `tests/smoke/system-settings/quota.smoke.spec.ts`: `reseller` opens one of its domains and sees the copies section; `admin` sets a copy recipient on a seeded domain and restores the previous list.

### Implementation for User Story 6

- [ ] T102 [US6] Implement `src/features/system-settings/api/notifications.ts` (quota notification settings; recipients under `['quota-notification-recipients',domain]`).
- [ ] T103 [US6] Implement `src/features/system-settings/pages/notifications/QuotaNotificationsPage.vue` with the sections `notification-email`, `notification-template` (`TemplateField`) and `copies`; add the `system-settings-quota-notifications` route.
- [ ] T104 [US6] Implement `src/features/system-settings/components/notifications/QuotaCopiesSection.vue`, export it from `src/features/system-settings/index.ts`, and place it in the designated section area of UI 002's domain page (`src/features/domains/pages/DomainDetailPage.vue`, path as delivered) for administrators and the domain's domain administrators; UI 002's domain page tests must stay green.
- [ ] T105 [US6] Add to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` only the `systemSettings.quota.*` and `systemSettings.quotaCopies.*` new strings of T008a's form map (the pointer to the per-domain copies, empty-list explanation). Use verbatim the legacy keys `admin.quota_notifications`, `admin.quota_notifications_info`, `admin.quota_notification_sender`, `admin.quota_notification_subject`, `admin.quarantine_notification_html`, `admin.quota_notifications_vars`, `success.saved_settings`, and for the domain section `edit.quota_warning_bcc`, `edit.quota_warning_bcc_info`, `edit.target_address` and `edit.active`. `npm run i18n:check` must pass. Run T098 to T101 and fix failures.

**Checkpoint**: US1 to US6 work on their own.

---

## Phase 9: User Story 7 - Manage Rspamd settings rules from presets (Priority: P2)

**Goal**: The rule list, the new-rule and rule pages with presets and a server Check, deletion, the
effective settings map, and the Sieve presets in UI 005's create-filter form.

**Independent Test**: Create rules blank and from each preset; check valid and broken content;
edit, deactivate and delete; page, search, filter and sort 30 rules; open the effective map, also
while unavailable; insert each Sieve preset into a new mailbox filter.

**Depends on**: UI 005's create-filter form for US7-AS8.

### Tests for User Story 7 (write first; must fail)

- [ ] T106 [US7] Implement the rule part of `tests/mocks/handlers/settings-rspamd.ts` (list with `q`, `active`, `sort`, `order`, paging and `ListMeta`; create, get, update, delete; the structure check outside comments and quoted strings giving `unbalancedStructure` with `line` and `construct`; `validateOnly`; `If-Match`; `404`; the effective map with an `additional_settings_<id>` block per active rule and `503` injection) and `tests/mocks/handlers/presets.ts` (`rspamd` for administrators, `sieve` for administrators and domain administrators, `403` otherwise; eight Sieve presets with `mailbox.sieve_preset_<n>` keys; Rspamd presets with `admin.rsettings_preset_<n>` keys, one with an unknown key and one with `null`); register both. Add `tests/mocks/factories/rspamd-rule.ts`, `tests/mocks/factories/preset.ts` and the scenarios `rspamd-rules-empty`, `rspamd-rules-30` and `settings-map-unavailable`.
- [ ] T107 [P] [US7] Write `tests/e2e/system-settings/rspamd-rules/rspamd-rules.spec.ts`:
  - US7-AS1: "No rules available" offers to add a rule;
  - US7-AS2: choosing "Disable Rspamd for a domain" fills the translated description and the content, and asks before replacing typed content;
  - US7-AS3: content with an unclosed brace checked shows a translated error naming the structure and its position, "Go to line" reaches it in one action (SC-006), and nothing is saved;
  - US7-AS4: saving valid content as active lists the rule as active with the refresh-interval note;
  - US7-AS5: on `rspamd-rules-30`, search, the active filter, sorting and paging show the matching rules and the total, kept in the address across a reload;
  - US7-AS6: the effective map is read-only with a copy action and contains the rule's block; on `settings-map-unavailable` an error with retry;
  - US7-AS7 and FR-057: deleting asks with the description and identifier and the next-refresh statement; FR-011: a deletion refused as outdated shows the confirmation again with the fresh rule;
  - FR-054, FR-056, FR-058, FR-059, FR-060 are traced by AS-5, AS-2, AS-3, AS-4 and AS-6 above;
  - FR-055: active is preselected on the new-rule page; the page explains that Rspamd names the setting and links to the Rspamd documentation; FR-006: an unknown rule ID shows "not found" with a way back; an outdated save keeps the input; Edges: a brace inside a quoted string is accepted; long lines wrap and the wrap toggle scrolls only the editor.
- [ ] T108 [P] [US7] Write `tests/e2e/system-settings/rspamd-rules/sieve-presets.spec.ts`: US7-AS8 for an administrator and for a domain administrator with the filters flag in UI 005's create-filter form: "Insert example" lists the eight Sieve examples by their translated headlines, choosing one fills the script (and the description when it is empty), and asks before replacing a typed script; an unknown translation key shows the API's English headline (FR-061); the Global Sieve filters page offers no examples (FR-062).
- [ ] T109 [P] [US7] Write unit tests: `tests/unit/features/system-settings/components/spam/PresetPicker.spec.ts`, `tests/unit/features/system-settings/lib/preset-key.spec.ts`, `tests/unit/features/system-settings/components/spam/RuleForm.spec.ts` (required description 1–255 and content, active default on create, Check marks), `tests/unit/features/system-settings/components/spam/RuleFilters.spec.ts` and `tests/unit/features/system-settings/rule-list-state.spec.ts` (data-model §7 parameters mapped to the query).
- [ ] T110 [P] [US7] Write `tests/smoke/system-settings/rspamd-rules.smoke.spec.ts`: as `admin`, create an inactive rule with a unique description, Check it, delete it; open the effective settings map.

### Implementation for User Story 7

- [ ] T111 [US7] Implement the rule and effective-map queries and mutations in `src/features/system-settings/api/rspamd.ts` (validate-only variants; invalidation of data-model §3), `src/features/system-settings/api/presets.ts` and `src/features/system-settings/lib/preset-key.ts`.
- [ ] T112 [P] [US7] Implement `src/features/system-settings/components/spam/RuleList.vue`, `RuleCard.vue` (below `md`), `RuleTable.vue` (from `md` up, `aria-sort`) and `RuleFilters.vue`.
- [ ] T113 [P] [US7] Implement `src/features/system-settings/components/spam/RuleForm.vue` (description, `CodeEditor` content with `maxBytes` from the capabilities, active switch, Check, server marks), `PresetPicker.vue` (export it from `src/features/system-settings/index.ts`) and `CheckResult.vue`.
- [ ] T114 [US7] Implement `src/features/system-settings/pages/spam/RspamdRulesPage.vue`, `RspamdRuleCreatePage.vue`, `RspamdRuleDetailPage.vue` (delete with `useConfirm`, `SettingsNotFoundState` on `404`) and `EffectiveSettingsMapPage.vue`; add the four routes.
- [ ] T115 [US7] Add "Insert example" with `PresetPicker kind="sieve"` to UI 005's create-filter form (`src/features/sieve-filters/components/SieveFilterForm.vue`, path as delivered), and move its script field onto `src/shared/components/code-editor/CodeEditor.vue` (monospace, line numbers) without changing UI 005's behaviour; remove the replaced editor component; UI 005's tests must stay green.
- [ ] T116 [US7] Add to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` only the `systemSettings.rspamdRules.*` new strings of T008a's form map (search, filters, Check results, the overwrite question). Use verbatim the legacy preset headlines `admin.rsettings_preset_<n>` and `mailbox.sieve_preset_<n>` (no `systemSettings.presets.*` keys), `mailbox.sieve_preset_header`, and `admin.rspamd_settings_map`, `admin.active_rspamd_settings_map`, `admin.rsetting_none`, `admin.rsetting_no_selection`, `admin.rsetting_desc`, `admin.rsetting_content`, `admin.rsetting_add_rule`, `admin.add_settings_rule`, `admin.active`, `admin.rspamd_com_settings` (with its documentation link, through `SanitizedHtml.vue`), `add.validate`, `success.settings_map_added`, `success.object_modified`, `success.settings_map_removed`, `danger.settings_map_invalid` and `danger.map_content_empty`. `npm run i18n:check` must pass.
- [ ] T117 [US7] Run T107 to T110 on all projects and fix failures until they pass.

**Checkpoint**: US1 to US7 work on their own.

---

## Phase 10: User Story 8 - Maintain the global filter maps (Priority: P2)

**Goal**: The map list and map pages with live line marks, a server Check naming failing lines, a
review of added and removed lines before saving, and the unavailable-map message.

**Independent Test**: Open every map; enter valid lines, comments, empty lines, lines without
slashes, two flags and patterns that do not compile; check and save; simulate a missing file and an
outdated version.

### Tests for User Story 8 (write first; must fail)

- [ ] T118 [US8] Extend `tests/mocks/handlers/settings-rspamd.ts` with `listRspamdRegexMaps`, `getRspamdRegexMap` and `replaceRspamdRegexMap`: the 13 maps of legacy's `$RSPAMD_MAPS['regex']` with their English names, one listed with `available: false` and one that vanishes on save (`409 regex-map-unavailable`); line checks giving `invalidRegexLine` with `line` and `reason` (`notSlashDelimited`, `tooManyFlags`, `innerSlash`, and `doesNotCompile` decided by JavaScript `RegExp` in the mock only); `validateOnly`; `If-Match`; content stored trimmed with a final line break. Add `tests/mocks/factories/regex-map.ts` and the scenario `filter-maps-13`.
- [ ] T119 [P] [US8] Write `tests/e2e/system-settings/filter-maps/filter-maps.spec.ts`:
  - US8-AS1: the 13 maps listed with name and identifier, with a search on the name;
  - US8-AS2: typing `spam.example` on line 3 marks line 3 before any request;
  - US8-AS3: checking `/[unclosed/i` on line 5 names line 5 and "Go to line" moves the cursor there (SC-006);
  - US8-AS4: saving valid content shows the review with added and removed lines and counts, and confirming announces success with the no-restart note;
  - US8-AS5: saving the vanishing map shows the unavailable message and changes nothing;
  - US8-AS6: `/x/im` is refused for two flags;
  - FR-064, FR-065, FR-066 and FR-067 are traced by AS-2, AS-3, AS-4 and AS-5 above; FR-104 map names shown as the API supplies them;
  - FR-063 the purpose and the `/pattern/flags` format with an example; FR-097 the review scrolls inside the dialog at 360 px with its actions visible; a map listed `available: false` shows the notice and a read-only editor; an outdated save keeps the input; FR-072 near 1 MiB the size is shown and saving above it is blocked with the limit; FR-094 with wrapping off only the editor scrolls sideways.
- [ ] T120 [P] [US8] Write `tests/e2e/system-settings/filter-maps/editor-performance.spec.ts` (research R31): a 1 MiB map generated in the test loads in the map page within 2 s, and ten typed characters each appear in the textarea within 100 ms.
- [ ] T121 [P] [US8] Write unit tests: `tests/unit/features/system-settings/lib/regex-lines.spec.ts` (empty, comments, `/a/`, `/a/i`, `/a/m`, `/a/s`, `/a/im` → `tooManyFlags`, `a` → `notSlashDelimited`, `/a/b/` → `innerSlash`, CRLF), `tests/unit/features/system-settings/lib/line-diff.spec.ts` (added and removed with counts, reordering is no change, duplicates counted, the final empty line ignored, 1 MiB in under 50 ms) and `tests/unit/features/system-settings/components/spam/MapChangeReview.spec.ts` (lines rendered through `PlainText.vue`, so a bidi override in a pattern shows as a marker).
- [ ] T122 [P] [US8] Write `tests/smoke/system-settings/filter-maps.smoke.spec.ts`: as `admin`, open a map and Check its current content; the result is valid and the map's version tag is unchanged afterwards (nothing written).

### Implementation for User Story 8

- [ ] T123 [US8] Implement the map queries and mutation in `src/features/system-settings/api/rspamd.ts`: the list seeds `['rspamd-regex-maps','detail',mapId]` from its entries; validate-only and real replacement with `If-Match`.
- [ ] T124 [P] [US8] Implement `src/features/system-settings/lib/regex-lines.ts` and `src/features/system-settings/lib/line-diff.ts` so that T121's library tests pass.
- [ ] T125 [US8] Implement `src/features/system-settings/components/spam/MapList.vue`, `MapChangeReview.vue` and `RegexFormatHelp.vue`, and `src/features/system-settings/pages/spam/FilterMapsPage.vue` and `FilterMapPage.vue` (live marks, Check, review, save, unavailable notice, `SettingsNotFoundState` on `404`); add both routes.
- [ ] T126 [US8] Add to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` only the `systemSettings.filterMaps.*` new strings of T008a's form map (line marks, change review, "not available"). Use verbatim the legacy keys `admin.rspamd_global_filters`, `admin.regex_maps`, `admin.rspamd_global_filters_info`, `success.object_modified`, `danger.global_map_invalid` and `danger.global_map_write_error`; `admin.rspamd_global_filters_regex` and `admin.rspamd_global_filters_agree` follow plan "Deviations needing a decision" item 7. `npm run i18n:check` must pass.
- [ ] T127 [US8] Run T119 to T122 on all projects and fix failures until they pass.

**Checkpoint**: US1 to US8 work on their own.

---

## Phase 11: User Story 9 - Maintain the global Sieve filters (Priority: P2)

**Goal**: The pre-filter and post-filter, each with a Check showing line and parser reason, and a
save that asks to restart now or apply at the next restart and reports the outcome.

**Independent Test**: Read both scripts; check and save valid, invalid and empty scripts with and
without an immediate restart; simulate a failed restart, a missing file and an outdated version.

### Tests for User Story 9 (write first; must fail)

- [ ] T128 [US9] Implement `tests/mocks/handlers/settings-global-filters.ts` (`listGlobalSieveFilters`; `replaceGlobalSieveFilter` with `validateOnly`, a `sieveSyntax` check for a missing semicolon with `message` and `line`, `deferRestart`, `meta.dovecotRestart` `done`, `failed` or `deferred`, `409 global-sieve-filter-unavailable`, `If-Match`) and register it. Add the scenarios `global-sieve-default`, `global-sieve-restart-fails` and `global-sieve-file-missing`.
- [ ] T129 [P] [US9] Write `tests/e2e/system-settings/global-sieve/global-sieve.spec.ts`: US9-AS1 (both filters with their explanations); US9-AS2 (a missing semicolon checked shows the line and the parser's reason, with "Go to line", nothing saved or restarted); US9-AS3 (saving with "Restart the mail service now" explains the interruption and reports saved and restarted); US9-AS4 ("Apply at the next restart" reports it takes effect at the next restart); US9-AS5 (on `global-sieve-restart-fails`, saved but the restart failed, effective at the next restart); US9-AS6 (an empty script explains "no global filter" before confirming); FR-068, FR-069 and FR-070 are traced by AS-1, AS-2, AS-3, AS-4 and AS-6; FR-071 on `global-sieve-file-missing` nothing saved or restarted; an outdated save keeps the input; the restart dialog fits 360 px; no "Insert example" on this page.
- [ ] T130 [P] [US9] Write `tests/unit/features/system-settings/components/mail-filtering/RestartChoiceDialog.spec.ts` (restart now preselected, the explanation, the empty-script note, the choice mapped to `deferRestart`) and `tests/unit/features/system-settings/components/mail-filtering/GlobalSieveFilterForm.spec.ts` (Check, outcome messages per `dovecotRestart.outcome`, the parser message quoted through UI 006's `PlainText.vue`/`neutralise()`).
- [ ] T131 [P] [US9] Write `tests/smoke/system-settings/global-sieve.smoke.spec.ts`: as `admin`, Check both filters' current scripts with `validateOnly`; both are valid and neither version tag changes (no write, no restart).

### Implementation for User Story 9

- [ ] T132 [US9] Implement `src/features/system-settings/api/global-filters.ts` (list; validate-only and real replacement with `If-Match` and `deferRestart`; the saved entry replaces the cached one).
- [ ] T133 [US9] Implement `src/features/system-settings/components/mail-filtering/GlobalSieveFilterForm.vue` and `RestartChoiceDialog.vue`, and `src/features/system-settings/pages/mail-filtering/GlobalSieveFiltersPage.vue` with the sections `prefilter` and `postfilter`; add the route.
- [ ] T134 [US9] Add to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` only the `systemSettings.globalSieve.*` new strings of T008a's form map (the restart choice once approved, plan "Deviations needing a decision" item 11). Use verbatim the legacy keys `add.validate`, `admin.save`, `success.global_filter_written`, `danger.global_filter_write_error`, `danger.sieve_error` (with the parser message), `success.dovecot_restart_success` and `warning.dovecot_restart_failed`. `npm run i18n:check` must pass. Run T129 to T131 and fix failures.

**Checkpoint**: All P2 stories (US4 to US9) work.

---

## Phase 12: User Story 10 - Send mass mail to mailboxes (Priority: P3)

**Goal**: Compose with recipient selection, preview and one explicit confirmation naming the count;
handle changed counts, a running job and refused entries; follow and cancel jobs; inspect recipients.

**Independent Test**: Compose with each kind of selection, preview, send with a matching and a
changed count, try a second job while one runs, cancel a running job, and inspect completed and
cancelled jobs with every outcome at 360 px and on desktop.

### Tests for User Story 10 (write first; must fail)

- [ ] T135 [US10] Implement `tests/mocks/handlers/mass-mail.ts` and register it:
  - `previewMassMailRecipients`: the selection rules of `MassMailSelection` (receiving mailboxes only, the domain limit, include or exclude), `notFound` and `notEligible` (`reason`) at `selection.<list>.<i>`, `q`, paging, `meta.recipientCount` and `meta.total`;
  - `createMassMailJob`: `expectedRecipients` checked against the current count (`409 mass-mail-recipient-count-changed` with `actualRecipients`), one running job (`409 mass-mail-already-running` with `runningJobId`), `tooFew` for zero recipients, `201` with `Location`;
  - `listMassMailJobs` (`q`, `status`, newest first), `getMassMailJob` (a running job advances by the scenario's step on each read and completes), `listMassMailJobRecipients` (`q`, `outcome`, paging, address order; failures with `interrupted` or a Dovecot reply), `cancelMassMailJob` (pending become skipped; idempotent when cancelled; `409` when completed).

  Make sure UI 002's `listDomains` and UI 003's `listMailboxes` handlers support `q`, `status` and `domain`. Add `tests/mocks/factories/mass-mail.ts` and the scenarios `mass-mail-none`, `mass-mail-120` (3 domains, 120 receiving mailboxes, 2 inactive, 4 resources), `mass-mail-running`, `mass-mail-completed` (with failed recipients) and `mass-mail-cancelled`.
- [ ] T136 [P] [US10] Write `tests/e2e/system-settings/mass-mail/compose.spec.ts`:
  - US10-AS1: previewing "all mailboxes" on `mass-mail-120` states 120 recipients, lists them page by page sorted by address, and searches by address;
  - US10-AS2: Send opens a confirmation with sender, subject, selection, 120 recipients and the no-spam-filter, no-recall statement; its button reads "Send to 120 mailboxes"; `mockApi.requests()` shows no `createMassMailJob` before it is chosen (SC-008);
  - US10-AS3: a mailbox added after the preview (`mockApi.patch({ addReceivingMailbox: true })`) makes the app say the count changed, show the new preview and ask again, with nothing sent;
  - US10-AS4: on `mass-mail-running`, sending says a mass mail is already running and links to it;
  - US10-AS7: excluding `ghost@example.org` marks that entry with a translated error;
  - FR-084 and FR-085 are traced by AS-2 to AS-4 and AS-7 above;
  - FR-080: four steps with "Step n of 4" at 360 px, focus on each step heading, one page of sections at 1366 px; FR-081: domain and mailbox pickers search page by page, pasted addresses become entries, and the explanation about inactive mailboxes and resources; FR-082: the sender prefilled with the capabilities' suggestion and validated, subject 1–255 on one line, bodies required and optional with the HTML preview; FR-083: changing the selection discards the preview, and zero recipients disables sending; FR-086: leaving with content asks, and a successful send opens the job page.
- [ ] T137 [P] [US10] Write `tests/e2e/system-settings/mass-mail/jobs.spec.ts`:
  - US10-AS5: on `mass-mail-running`, the job page shows delivered, failed, skipped and pending as text and as a bar, updates every 5 s while visible (`page.clock`), shows the last update time, and after Cancel and confirmation shows the job cancelled with the remaining recipients skipped;
  - US10-AS6: on `mass-mail-completed`, filtering recipients by "failed" shows each with its reason (`interrupted` translated, other replies quoted);
  - US10-AS8: on `mass-mail-none`, the empty state explains mass mail and offers to compose;
  - FR-087: each job shows subject, status in text, creator, creation time and counts per outcome; list filters by status and search on the subject in the address; the running job banner at the top; FR-105: times in the device's time zone and counts formatted for the locale; SC-009: the shown counts are never more than 10 s behind the mock's state while visible and active; FR-088: the refresh pauses while the page is hidden and runs once when visible again; the "Pause automatic refresh" control pauses and resumes it; after the inactivity limit (`min(15 min, idleTimeout)`, advanced with `page.clock` and a short `idleTimeout` scenario) it pauses with a notice and "Resume" and does not resume on its own; a manual refresh always works; it stops at the end; progress announced at most every 30 s and at the end; the bodies viewable with the HTML body only in the preview; FR-089: cancelling a just-completed job says it completed and shows the final state; an unknown job ID shows "not found"; Edge: leaving a running job's page does not cancel it.
- [ ] T138 [P] [US10] Write unit tests: `tests/unit/features/system-settings/composables/useMassMailCompose.spec.ts` (draft to selection mapping, `selectionKey`, preview discarded on change, `confirmedCount`, the transitions of data-model §5 for each conflict), `tests/unit/features/system-settings/composables/useJobRefresh.spec.ts` (interval only while running, visible, not paused by the user and within the inactivity limit from the shared `useInactivity` (`min(15 min, Session.idleTimeout)`); no automatic resume after an inactivity pause; one refetch on becoming visible; stop and one recipients invalidation at the end; announcement throttling at 30 s plus the final one), `tests/unit/features/system-settings/lib/selection.spec.ts` (normalisation and the summary text), `tests/unit/features/system-settings/components/mass-mail/SendConfirmDialog.spec.ts` (content, plural button text in three locales, nothing emitted before confirmation) and `tests/unit/features/system-settings/components/mass-mail/JobProgress.spec.ts` (text equivalents of the bar).
- [ ] T139 [P] [US10] Write `tests/smoke/system-settings/mass-mail.smoke.spec.ts`: as `admin`, preview "all mailboxes" and see the dev stack's receiving mailbox count; no job is sent.

### Implementation for User Story 10

- [ ] T140 [US10] Implement `src/features/system-settings/api/mass-mail.ts` (the preview query with `gcTime: 0`; create; list; running; detail with the refresh options from `useJobRefresh`; recipients; cancel; invalidation of data-model §3) and `src/features/system-settings/lib/selection.ts`.
- [ ] T141 [US10] Implement `src/features/system-settings/composables/useMassMailCompose.ts` and `src/features/system-settings/composables/useJobRefresh.ts` so that T138's composable tests pass.
- [ ] T142 [P] [US10] Give the canonical `src/shared/components/MailboxSearchPicker.vue` (UI 006, promoted by UI 008) a multi-select mode with removable chips and `status` and `domain` filters, keeping its existing behaviour and tests; implement `src/features/system-settings/components/mass-mail/DomainPicker.vue` on the same pattern (Reka `Combobox` without `ComboboxViewport`, debounced search, load more), `RecipientSelection.vue` (using `MailboxSearchPicker`), `RecipientPreview.vue`, `ComposeSteps.vue` and `SendConfirmDialog.vue`.
- [ ] T143 [P] [US10] Implement `src/features/system-settings/components/mass-mail/JobList.vue`, `JobCard.vue` (below `md`), `JobTable.vue` (from `md` up), `RunningJobBanner.vue`, `JobProgress.vue`, `JobRecipients.vue` (mail server replies through `PlainText.vue`) and `JobBodies.vue`.
- [ ] T144 [US10] Implement `src/features/system-settings/pages/mass-mail/MassMailSendPage.vue`, `MassMailJobsPage.vue` and `MassMailJobPage.vue` (cancel with `useConfirm`, `SettingsNotFoundState` on `404`); add the three routes.
- [ ] T145 [US10] Add to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` only the `systemSettings.massMail.*` new strings of T008a's form map (plural forms for counts and the send button, statuses, outcomes, failure labels, the paused-refresh note: elements the classic interface lacks). Use verbatim the legacy keys `admin.sys_mails`, `admin.from`, `admin.subject`, `admin.text`, `admin.html`, `admin.optional`, `admin.include_exclude`, `admin.include_exclude_info`, `admin.includes`, `admin.excludes`, `admin.send`, `danger.from_invalid`, `danger.subject_empty` and `danger.text_empty`. `npm run i18n:check` must pass.
- [ ] T146 [US10] Run T136 to T139 on all projects and fix failures until they pass.

**Checkpoint**: US1 to US10 work on their own.

---

## Phase 13: User Story 11 - Operate the remaining server settings (Priority: P3)

**Goal**: The Rspamd web interface password, the CORS settings of the classic API, the IP check and
the License page.

**Independent Test**: Set Rspamd passwords of valid and invalid length and with a failing container
service; save CORS with valid and invalid origins and methods; toggle the IP check; read and verify
the license with the service valid, unreachable and disabled.

### Tests for User Story 11 (write first; must fail)

- [ ] T147 [US11] Extend the mocks: `tests/mocks/handlers/settings-rspamd.ts` with `setRspamdUiPassword` (6–256 characters, no control characters, `204`, `502 container-action-failed` with `container: rspamd-mailcow`, `504 outcome-unknown` with `step: rspamdUiPassword`); `tests/mocks/handlers/settings-server.ts` with `getLegacyApiCorsSettings` and `updateLegacyApiCorsSettings` (`origin` format per entry, lower case and once each, at most 100, methods non-empty from GET, POST, PUT, DELETE, the resulting settings validated as a whole); `tests/mocks/handlers/settings-branding.ts` with `getIpCheckSetting` and `updateIpCheckSetting` (demo mode); `tests/mocks/handlers/license.ts` (`403 feature-disabled` when disabled; GUID valid or `null`; `verifyLicense` results `valid` with IDs and support level, or `unreachable`), registered. Add the scenarios `rspamd-ui-service-fails`, `rspamd-ui-outcome-unknown`, `cors-legacy-bare-host`, `settings-license-valid`, `settings-license-unreachable` and `settings-license-guid-invalid`.
- [ ] T148 [P] [US11] Write `tests/e2e/system-settings/server/rspamd-web-interface.spec.ts`: US11-AS1 (a 12-character passphrase confirms the password set and Rspamd restarted, and the field is cleared); US11-AS2 (5 characters state the minimum of 6 before sending); FR-073 the show/hide control, `autocomplete="new-password"`, the field always empty on load, and the link to the reported Rspamd address; FR-074 on `rspamd-ui-service-fails` the could-not-be-confirmed message with a retry; on `rspamd-ui-outcome-unknown` the unknown-outcome message; Edge: quotes and spaces sent exactly (request body); FR-106 the password appears in no storage key, address or `history.state` after any attempt.
- [ ] T149 [P] [US11] Write `tests/e2e/system-settings/server/cors.spec.ts`: US11-AS3 (`https://portal.example.org` and `*` with GET and POST save, with the `*` warning shown before); US11-AS4 (`https://portal.example.org/app/` is marked invalid for its path); FR-075 the classic-API scope explanation, lower-case normalisation, paste splitting, the limit, at least one method; FR-076 the empty list means the server's own origin, shown; Edge: on `cors-legacy-bare-host`, the stored bare host name is shown, marked invalid in edit mode, and blocks saving until corrected or removed.
- [ ] T150 [P] [US11] Write `tests/e2e/system-settings/server/ip-check.spec.ts` (FR-042): US11-AS5 (switching on explains the third-party services `ipv4.mailcow.email` and `ipv6.mailcow.email` and the dashboard, and saves); the link to UI 011's dashboard; demo mode read-only.
- [ ] T151 [P] [US11] Write `tests/e2e/system-settings/server/license.spec.ts` (FR-077, FR-078): US11-AS6 (on `settings-license-valid`, the GUID with a copy action and the last result; "Verify now", after explaining that only the GUID is sent, shows progress and the new result with customer ID, service ID and support level); US11-AS7 (on `settings-license-unreachable`, "unreachable" is shown as a result, not an error); US11-AS8 (on `settings-license-disabled`, License is absent everywhere and its address shows "not found"); FR-079 a `403 feature-disabled` on verification reloads the capabilities and shows "not found"; Edge: on `settings-license-guid-invalid`, "marked invalid" is shown and verification is still offered.
- [ ] T152 [P] [US11] Write unit tests: `tests/unit/features/system-settings/lib/origin.spec.ts` (`*`; `http` and `https` with host and port; IPv6 in brackets; trailing `/`, path, query, fragment, credentials and other schemes refused; lower-casing), `tests/unit/features/system-settings/components/integrations/MethodCheckboxes.spec.ts`, `tests/unit/features/system-settings/components/integrations/LicenseResult.spec.ts` and `tests/unit/features/system-settings/pages/spam/RspamdWebInterfacePage.spec.ts` (secrets rule of `docs/conventions.md`: the password is sent by a direct `api` client call and never appears in the `QueryClient`'s query or mutation caches; it lives only in component state with no form draft; the field is cleared in `finally`; no announcement or log contains it).
- [ ] T153 [P] [US11] Write `tests/smoke/system-settings/server.smoke.spec.ts`: as `admin`, add an origin to CORS and restore the previous settings; switch the IP check and restore it; open License and see either the GUID or, when the dev stack disables verification, no License page.

### Implementation for User Story 11

- [ ] T154 [US11] Implement `setRspamdUiPassword` in `src/features/system-settings/api/rspamd.ts` as a plain function over the `api` client, not a TanStack Query mutation (secrets rule), `src/features/system-settings/api/cors.ts`, the IP check query and mutation in `src/features/system-settings/api/branding.ts`, `src/features/system-settings/api/license.ts` and `src/features/system-settings/lib/origin.ts`.
- [ ] T155 [US11] Implement `src/features/system-settings/pages/spam/RspamdWebInterfacePage.vue` with the sections `password` and `web-interface` (link through `safeHref`); add the route.
- [ ] T156 [US11] Implement `src/features/system-settings/components/integrations/MethodCheckboxes.vue`, `src/features/system-settings/pages/integrations/CorsPage.vue` (origins in the tag editor with `normalise` to lower case and the origin check) and `src/features/system-settings/pages/integrations/IpCheckPage.vue`; add both routes.
- [ ] T157 [US11] Implement `src/features/system-settings/components/integrations/LicenseResult.vue` and `src/features/system-settings/pages/integrations/LicensePage.vue` (renders `SettingsNotFoundState` without requests while verification is disabled); add the route.
- [ ] T158 [US11] Add to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` only the `systemSettings.rspamdUi.*`, `systemSettings.cors.*`, `systemSettings.ipCheck.*` and `systemSettings.license.*` new strings of T008a's form map (the CORS scope note, the dashboard note, verification results without a legacy key). Use verbatim the legacy keys `admin.password`, `admin.password_repeat` (per plan "Deviations needing a decision" item 8), `success.rspamd_ui_pw_set`, `danger.rspamd_ui_pw_length`, `admin.cors_settings`, `admin.allowed_origins`, `admin.allowed_methods`, `success.cors_headers_edited`, `danger.cors_invalid_origin`, `danger.cors_invalid_method`, `admin.ip_check`, `admin.ip_check_opt_in` (markup through `SanitizedHtml.vue`), `success.ip_check_opt_in_modified`, `admin.guid_and_license`, `admin.guid`, `admin.customer_id`, `admin.service_id`, `admin.validate_license_now` and `admin.license_info` (per item 6). No hand-written sk-sk value for a legacy key. `npm run i18n:check` must pass.
- [ ] T159 [US11] Run T148 to T153 on all projects and fix failures until they pass.

**Checkpoint**: US1 to US11 work on their own.

---

## Phase 14: User Story 12 - Trace settings changes (Priority: P3)

**Goal**: A History action on every settings page and on rule, map and job pages, the audit log's
target filters and labels for this feature, and readable details of every settings change.

**Independent Test**: With audit records for every kind of settings change, including refused ones,
open History from each page and from a job, and check that domain administrators are never offered
it.

**Depends on**: UI 002's `HistoryLink` and the audit list state's `targetType` and `targetId`.

### Tests for User Story 12 (write first; must fail)

- [ ] T160 [US12] Extend `tests/mocks/factories/audit-event.ts` and add the scenario `audit-settings-records` to `tests/mocks/scenarios/system-settings.ts`: one success record per event type of data-model §11 with the `details` of the API's data model §7 (sizes for templates, maps, rules and scripts; logo type, dimensions and size; `passwordChanged` with `rspamdConfirmed`; `dovecotRestart`; mass mail counts), plus refusals with `demoMode`, `featureDisabled`, `fileUnavailable`, `serviceFailure` and `versionOutdated`. Make sure the audit handler filters by `targetType` and `targetId`.
- [ ] T161 [P] [US12] Write `tests/e2e/system-settings/history/history.spec.ts`: US12-AS1 (History on the sender denylist map opens the audit log filtered to that map, showing actor, time, client address and the old and new size); US12-AS2 (the Rspamd password entry says it was changed and shows no password); US12-AS3 (a completed job's History shows the creation and the completion with the counts per outcome); US12-AS4 (a domain administrator on the quota copies section is offered no History); FR-091: table-driven over the catalogue, every page's History opens the audit log with its `targetType`, and rule, map and job pages add their `targetId`; the target type filter of the audit log lists this feature's 17 target types with labels.
- [ ] T162 [P] [US12] Write `tests/unit/features/audit-log/details-system-settings.spec.ts` (a formatter per event type: changed values old → new in the user's language; templates, maps, rules, scripts, help text and footer only as "changed" with binary sizes; logos with type, dimensions and size; the Rspamd password only as changed; the restart outcome and the Rspamd confirmation; unknown keys fall back to the generic list) and extend `tests/unit/features/audit-log/labels.spec.ts` for the 21 event types, 17 target types and 5 failure reasons.
- [ ] T163 [P] [US12] Write `tests/smoke/system-settings/history.smoke.spec.ts`: after the UI text smoke change, the audit log filtered by target type `uiTexts` lists that change with its old and new value.

### Implementation for User Story 12

- [ ] T164 [US12] Render UI 002's `src/shared/components/HistoryLink.vue` in `src/features/system-settings/components/common/SettingsPageHeader.vue` from the page's `auditTarget`, for administrators only; pass `targetId` from `RspamdRuleDetailPage.vue` (rule ID), `FilterMapPage.vue` (map file name) and `MassMailJobPage.vue` (job ID); add History with `targetType: quotaNotificationRecipients` and the domain to `QuotaCopiesSection.vue` for administrators only.
- [ ] T165 [US12] Implement `src/features/audit-log/details/system-settings.ts` and register it in `src/features/audit-log/components/AuditEventDetails.vue`; add this feature's target types to the target type options of `src/features/audit-log/components/AuditFilters.vue` where UI 002 does not already derive them from the enumeration.
- [ ] T166 [US12] Add or complete `auditLog.events.<type>` for the 21 event types, `auditLog.targets.<type>` for the 17 target types, `auditLog.failureReasons.{demoMode,featureDisabled,fileUnavailable,serviceFailure,outcomeUnknown}` and `auditLog.details.systemSettings.*` in `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` (an earlier contract bump may have added placeholders: reword them). `npm run i18n:check` must pass. Run T161 to T163 and fix failures.

**Checkpoint**: All user stories work on their own.

---

## Phase 15: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story verification of the requirements that every screen shares, budgets,
documentation and release readiness.

- [ ] T167 [P] Write and pass `tests/e2e/system-settings/polish/page-states.spec.ts`, table-driven over the catalogue (FR-015): each page's loading state in the shape of its content (delayed responses), its error state with a translated message and a working retry (`503` and `500` injection), and the empty states with their add action for app links, settings rules, filter maps, mass mail jobs, job recipients, copy recipients and CORS origins.
- [ ] T168 [P] Write and pass `tests/e2e/system-settings/polish/permissions.spec.ts` (FR-002, SC-012): for an administrator, a domain administrator with and without the filters flag, and a mailbox user, exactly the capabilities of FR-002's table are offered: the settings area, the quota copies of own or all domains, the Sieve examples where UI 005 offers the editor, and History.
- [ ] T169 [P] Write and pass `tests/e2e/system-settings/polish/reflow-and-zoom.spec.ts` (FR-094, FR-097, SC-005): every page, step and dialog of this feature at 320 px and at the equivalent of 400 % zoom on a 1,280 px screen without page scroll; an editor with wrapping off scrolls only inside; in landscape on the mobile projects; the focused element is never hidden behind the header or a section's sticky action bar (WCAG 2.4.11); no transition under `prefers-reduced-motion: reduce`.
- [ ] T170 [P] Write and pass `tests/e2e/system-settings/polish/keyboard-only.spec.ts` (FR-098, FR-101): each story's main path with the keyboard alone, with focus visible at every step: search and results, the page switcher, section edit and save, entry editing and removal, app link reordering, the colour field and picker, the editors (Tab leaves them), "Go to line", every dialog (Escape closes unless busy; focus returns).
- [ ] T171 [P] Write and pass `tests/e2e/system-settings/polish/input-attributes.spec.ts` (FR-096, FR-099): address fields use `type="email"`, link fields `type="url"`, number fields `inputmode="numeric"`, and addresses, origins, links, colours and hex values have `autocapitalize="off"` and `autocorrect="off"`; contrast verdicts, line marks, entry validity, job statuses, outcome counts and progress have text equivalents.
- [ ] T172 [P] Write and pass `tests/e2e/system-settings/polish/storage-and-secrets.spec.ts` (FR-106, FR-108): after the US10 and US11 flows, `localStorage` and `sessionStorage` hold only the keys of UI 001's data-model §4; no stored value, address or `history.state` contains the Rspamd password, a mass mail subject or body, or a selection; with storage throwing, every settings page still works.
- [ ] T173 [P] Write and pass `tests/e2e/system-settings/polish/freshness.spec.ts` (FR-109, constitution VII): revisiting a settings page within its stale time sends no request; after each save the screens that show the value (the shell after branding, UI 003's password form after the policy, the effective map after a rule) show the new value; the running job's refresh is the only periodic request, and no request is sent while the user is away.
- [ ] T174 [P] Write and pass `tests/e2e/system-settings/polish/parity.spec.ts` (SC-011): on `settings-admin-custom`, every value of the spec's Legacy Parity tables that the replaced classic screens show (logos and their details, every UI text, login options, app links with user links and hide flags, policy, reset and quota values, copy recipients, rules, maps, both Sieve filters, CORS, IP check, GUID and license details, mass mail fields) is visible in the new screens.
- [ ] T175 [P] Write and pass `tests/unit/lint/system-settings-rules.spec.ts` (FR-107): the ESLint configuration forbids `srcdoc` and `document.write` everywhere, and the only `v-html` remains in `src/shared/components/SanitizedHtml.vue` (add the `no-restricted-properties` and `no-restricted-syntax` rules to `eslint.config.ts`).
- [ ] T176 Add a Lighthouse collection for `/ng/system/ui-texts` with an administrator scenario to `scripts/run-lhci.mjs`, then run `npm run build && npm run budget:check && npm run lhci` and fix regressions until the initial JavaScript is at most 204,800 bytes gzipped and performance is at least 0.8 and accessibility is at least 0.9 on every collected URL (constitution VII, SC-014).
- [ ] T177 [P] Add the plan's parity notes 1–4 to the "Legacy Parity" tables in `specs/013-system-settings/spec.md`.
- [ ] T178 [P] Propose observations O1–O3 to mailcow-rest-v2 as written in `specs/013-system-settings/plan.md` (API gap G1 was specified in T040), and record the reference in that section.
- [ ] T179 [P] Write and pass `tests/unit/features/system-settings/catalogue-complete.spec.ts`: all seventeen page components exist and every catalogue section id is a heading id in its page (completes T021's scan).
- [ ] T180 [P] Run `npm run i18n:check` (SC-013), remove the unused keys it reports from `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, check that no new string duplicates a legacy key of T008a's form map, and list this feature's new cs-cz and sk-sk strings for the owner's review (plan, owner question 3).
- [ ] T181 Run quickstart Part B on a mid-range Android phone and an iPhone with `npm run preview:mock` on the local network: record SC-002 (logo, product name and brand colour in under 3 minutes) and SC-014 timings, run the moderated SC-001 test with at least five administrators who know the classic interface, and do a screen-reader pass of each story's main path with VoiceOver and TalkBack; record everything in the "Validation log" of `specs/013-system-settings/quickstart.md`.
- [ ] T182 Run quickstart Part C (`scripts/smoke/stack-up.sh`, `npm run test:smoke -- tests/smoke/system-settings`, `scripts/smoke/stack-down.sh`) against the mailcow-rest-v2 dev stack once its 013 implementation runs, and record the result in the "Validation log" of `specs/013-system-settings/quickstart.md`.

---

## Dependencies & Execution Order

### External prerequisites

| Prerequisite | Needed by | What 013 relies on |
|---|---|---|
| UI 001 | everything | shell, catalogue, router, list and dialog primitives, sanitiser, public configuration, audit log, fixtures, mock server |
| UI 002 | T032, T036, T037, US6, US12 | `EditableSection` and the `useVersionedSave` field diff; the tag editor; the domain page and its section area; `HistoryLink` and the audit target filters |
| UI 003 | US5, US10 | the password-policy query key and mock handler; the mailbox list handler |
| UI 005 | US7 (T108, T115) | the create-filter form and its script editor |
| UI 011, UI 012 | US11, US4 | the dashboard and identity providers screens that this feature links to |
| API 013 contract | T001 | the 44 operations of the contracts README |

### Phase dependencies

- **Setup (Phase 1)**: T001 first; T002–T008 after T001 (T005 after T004, T007 after T006).
- **Foundational (Phase 2)**: depends on Setup and **blocks every story**. T008a (the legacy form
  map) first; every screen and message task depends on it. Mock base T009 → T010 →
  T011 → T012; tests T013–T025 in parallel; implementation T026–T031 in parallel, then T032–T040
  in order (T029 after T028; T036 after T034; T038 after T035–T037).
- **User stories (Phases 3–14)**: each depends on Foundational and on the earlier features in the
  table above. Story-to-story dependencies are below.
- **Polish (Phase 15)**: depends on every story it verifies.

### User story dependencies

| Story | Priority | Depends on | Why |
|---|---|---|---|
| US1 | P1 | Foundational | MVP: search, switcher, wide-screen list. Other stories do not need it, because the minimal overview exists after T038. |
| US2 | P1 | Foundational | Logos and UI texts. |
| US3 | P1 | Foundational | T071 changes the shared a11y fixture: run it after the other stories' current end-to-end tests are green, then fix every contrast violation (T076). |
| US4 | P2 | Foundational | Extends `settings-branding.ts` and `api/branding.ts` after US2 and US3 (serialise). |
| US5 | P2 | Foundational; UI 003 | `TemplateField` is reused by US6. |
| US6 | P2 | Foundational; US5 (T093 `TemplateField`); UI 002 | |
| US7 | P2 | Foundational; UI 005 for T108 and T115 | |
| US8 | P2 | Foundational | Extends `settings-rspamd.ts` and `api/rspamd.ts` after US7 (serialise). |
| US9 | P2 | Foundational | |
| US10 | P3 | Foundational; UI 002 and 003 list handlers | |
| US11 | P3 | Foundational; US7 and US8 for the shared files below | |
| US12 | P3 | All pages it links from (US2–US11); UI 002's `HistoryLink` | |

### Files edited by several stories

Edits to these files must be serialised, even when stories run in parallel:

- `src/features/system-settings/routes.ts`: every story adds its routes;
- `src/features/system-settings/api/branding.ts`: US2, US3, US4, US11;
- `src/features/system-settings/api/rspamd.ts`: US7, US8, US11;
- `tests/mocks/handlers/settings-branding.ts`: US2, US3, US4, US11;
- `tests/mocks/handlers/settings-rspamd.ts`: US7, US8, US11;
- `tests/mocks/handlers/settings-server.ts`: Foundational, US11;
- `tests/mocks/handlers/index.ts` and `tests/mocks/scenarios/system-settings.ts`: every story;
- `src/features/system-settings/index.ts`: Foundational, US6, US7;
- `src/i18n/messages/*.json`: every story (new strings only; T008a's form map first);
- `src/features/system-settings/components/common/SettingsPageHeader.vue`: Foundational, US1, US12.

### Within each user story

- Mock handlers and scenarios first, then end-to-end, unit and smoke tests, which must fail, then
  the implementation (api → lib and composables → components → pages and routes) with the legacy
  keys of T008a's form map, then the story's new strings in all three locales, then a run of the
  story's tests.

### Parallel opportunities

- Setup: T002, T003, T004, T006 and T008 in parallel after T001.
- Foundational: T013–T025 (tests) all in parallel; T026, T027, T028, T030 and T031 in parallel.
- Stories: after Foundational, US1, US2, US5, US7, US9 and US10 can be staffed in parallel; US3 and
  US4 follow US2 on the shared branding files; US6 follows US5; US8 and US11 follow US7 on the
  shared Rspamd files; US12 comes last.
- Within each story, every task marked [P].

---

## Parallel Example: User Story 2

```bash
# After T052 (handlers, fixtures, scenarios), write the US2 tests together:
Task: "T053 tests/e2e/system-settings/branding/logos.spec.ts"
Task: "T054 tests/e2e/system-settings/branding/ui-texts.spec.ts"
Task: "T055 unit tests for logo-file, useLogoCandidate, LogoCard, sanitize-report, HtmlFieldPreview"
Task: "T056 tests/smoke/system-settings/branding.smoke.spec.ts"

# Then the independent implementation parts:
Task: "T059 lib/logo-file.ts + composables/useLogoCandidate.ts"
Task: "T060 sanitizeHtmlWithReport in src/shared/security/sanitize.ts"
# T061 → T062 → T063 each touch api/branding.ts or routes.ts: run them one after another.
```

## Parallel Example: User Story 10

```bash
Task: "T136 tests/e2e/system-settings/mass-mail/compose.spec.ts"
Task: "T137 tests/e2e/system-settings/mass-mail/jobs.spec.ts"
Task: "T138 unit tests for useMassMailCompose, useJobRefresh, selection, SendConfirmDialog, JobProgress"
Task: "T139 tests/smoke/system-settings/mass-mail.smoke.spec.ts"
# after T140 and T141:
Task: "T142 compose components"   Task: "T143 job components"
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1 (Setup) and Phase 2 (Foundational): the contract with API 013, the shared editor,
   preview and contrast maths, and a navigable settings area.
2. Phase 3 (US1): search, page switcher and the wide-screen list.
3. **Stop and validate**: `npm run test:e2e -- --grep US1` on all projects and the US1 rows of
   quickstart Part B. Every page not yet built is simply not listed.

### Incremental delivery

1. Foundation, then US1 (MVP).
2. US2 and US3: branding complete, brand colours applied app-wide, limit palettes checked in every
   end-to-end test.
3. US4, US5, US6: sign-in page, app links, passwords and notifications.
4. US7, US8, US9: spam and mail filtering.
5. US10 and US11: mass mail and the remaining settings.
6. US12: History across all pages.
7. Polish: shared-requirement sweeps, budgets, parity notes, device validation, smoke against the
   real API.

### Parallel team strategy

After Foundational:
- Developer A: US1, then US2, then US3 and US4 (shared branding files).
- Developer B: US5, then US6, then US10.
- Developer C: US7, then US8, then US9 and US11 (shared Rspamd files).
- Developer D: test infrastructure for later stories, then US12 and Polish.

---

## Notes

- [P] tasks touch different files and have no dependency on an incomplete task.
- [USn] labels map tasks to the spec's user stories; test titles carry the spec IDs.
- Verify that each test fails before implementing (constitution VI).
- Commit after each task or logical group, directly to `main`, with short imperative subjects.
- Never add a hand-written API type, a `v-html` outside `SanitizedHtml.vue`, an inline style or
  script, a storage key outside UI 001's data-model §4, a hard-coded limit, or a periodic request
  other than the condition-bound job refresh; use the canonical shared names of `docs/conventions.md`
  (`useLeaveGuard`, `ConfirmDialog`, `EditableSection`, `HistoryLink`, `useInactivity`,
  `MailboxSearchPicker`, `PlainText`/`neutralise()`).
