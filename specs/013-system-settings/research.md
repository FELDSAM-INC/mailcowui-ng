# Research: System Settings

**Feature**: `specs/013-system-settings` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

Every open point of the plan is settled here, in this order of precedence: the constitution, then
the pinned mailcow-rest-v2 contract, then `docs/conventions.md`, then the decisions of UI feature
001 (cited as `001-R<n>`, from `specs/001-sign-in-app-shell/research.md`), then best practice. Each
entry has a **Decision**, its **Rationale** and the **Alternatives considered**. Decisions that
change a UI 001 artefact are collected in [plan.md](./plan.md#foundation-amendments).

---

## 1. Dependencies and contract

### R1. Delivery order and what 013 reuses

- **Decision**: UI 013 is implemented after UI features 001–012, against the merged API 013
  contract (the API implementation is not needed, constitution "Workflow"). It reuses, and never
  re-implements:

  | From | Reused building block | Used for |
  |---|---|---|
  | UI 001 | Shell, navigation catalogue entry `system`, router focus, `NoAccessState`, `NotFoundPage` | FR-001, FR-006 |
  | UI 001 | `useListState`, `ListState`, `PaginationBar`, `useConfirm` + `ConfirmDialog`, `useProblemForm`, `FormField`, `ErrorSummary`, `ProblemMessage`, `useAnnouncer`, `DateTime`, `RelativeTime`, `PageHeader` | every page |
  | UI 001 | `sanitizeHtml()` and `SanitizedHtml.vue` (001-R17), `safeHref()` | FR-036, FR-073 |
  | UI 001 | `BrandLogo.vue`, `public-config.ts`, `app-links.ts`, the audit log screen | FR-019, FR-031, FR-091 |
  | UI 001 | `clipboard.ts`, `storage.ts` allowlist (no new key) | copy actions, FR-106, FR-108 |
  | UI 002 | `EditableSection.vue` and the field diff of `useVersionedSave` (001-R20 reserves both for UI 002) | FR-009 to FR-011 |
  | UI 002 | `HistoryLink.vue` and the audit list state's `targetType`/`targetId` (001-R20, arriving with the API 002 contract bump) | FR-091 |
  | UI 002 | The tag editor of UI 002 FR-039 (expected in `src/shared/components/TagEditor.vue` after its second use in UI 003) | FR-052, FR-075, FR-081 |
  | UI 002 | The domain page and its designated section area | FR-051 |
  | UI 002 | `useLeaveGuard` (`src/shared/composables/useLeaveGuard.ts`) and `ConfirmDialog` with `requireTyped` | FR-013, FR-086 |
  | UI 006 | `PlainText.vue` and `neutralise()` (`src/shared/security/plain-text.ts`) | quoted server diagnostics, map lines |
  | UI 008, 011 | `useInactivity` (`src/shared/composables/useInactivity.ts`), `MailboxSearchPicker` (`src/shared/components/`) | FR-088, FR-081 |
  | UI 003, 005, 007 | The password-policy query key and, where promoted, the shared policy-rules list | FR-043, FR-044 |
  | UI 005 | The create-filter form of the mailbox Sieve filters and its script editor | FR-062 |
  | UI 011 | The dashboard that shows public addresses (linked from the IP check page) | FR-042 |
  | UI 012 | The identity providers screen (linked from the force-SSO note) | FR-038 |

  Where an earlier feature left a building block inside its own feature folder, its second use in
  013 promotes it to `src/shared/` without changing its behaviour (constitution VIII). The tasks
  name the expected paths and say "adjust to the delivered path", because UI 002–012 are not
  planned yet.
- **Rationale**: `docs/conventions.md` ("Where features meet") makes later features add their entry
  points to earlier screens. Reusing the earlier patterns keeps every list, save and conflict
  behaving the same in the whole app.
- **Alternatives considered**: Planning 013 as if it ran first and building its own section editor,
  tag editor and History link was rejected: it would fork patterns that 001-R20 reserves for
  UI 002.

### R2. Contract pin, operations and generated types

- **Decision**:
  - The first task bumps the pin with `scripts/contract/bump.sh` (001-R6) to a mailcow-rest-v2 ref
    that contains the API 013 contract and everything UI 001–012 rely on. The planning baseline is
    commit `32079252d55797d3da4e58ae661e9fb91c51c6f9` ("Register KnownProblemType in contract
    components"), bundle sha256 `5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6`,
    `info.version` `0.1.0`, 250 paths and 376 operations. Because UI 001–012 bump the pin before
    013 starts, the implementation pins the then-current ref, which must contain this baseline. A
    release tag is preferred when one exists.
  - After the bump, a contract-presence test (`tests/unit/api/system-settings-operations.spec.ts`)
    asserts that every operation of [contracts/README.md](./contracts/README.md) exists with the
    documented method, path and response statuses, so a later bump cannot silently drop one.
  - The baseline contains `KnownProblemType` under `components.schemas`, which closes UI 001's API
    gap 5: `knownProblemTypeValues` is generated, and the translation check (001-R27) uses it.
  - The bundler hoists `AuditTarget.type` into a component named `type`, so the generated root type
    is `Type`. 013 imports it through `@/api` under the alias `AuditTargetType` and reports the
    naming to mailcow-rest-v2 (plan, API observation O3).
- **Rationale**: Constitution I. The commit, not `info.version`, identifies a contract (001-R6).
- **Alternatives considered**: Pinning the baseline exactly was rejected, because it could roll back
  operations that UI 002–012 pinned later.

### R3. No new runtime dependency

- **Decision**: 013 adds no runtime dependency. The editor is a native `<textarea>` (R17), the
  e-mail preview uses DOMPurify, which UI 001 already ships (R21), the contrast maths is 60 lines
  (R13), and the line diff is a multiset comparison (R18). The feature offers no file download;
  copy actions use UI 001's `clipboard.ts`. Should one be added, it goes through
  `src/shared/platform/download.ts` (conventions).
- **Rationale**: Constitution VIII. Each candidate library was weighed in its own entry.
- **Alternatives considered**: CodeMirror 6 (MIT, about 100 KB gzipped, lazy-loadable) is the
  strongest candidate and is discussed in R17.

---

## 2. Structure and navigation

### R4. Feature module and route map

- **Decision**: One feature folder, `src/features/system-settings/`, because the whole feature sits
  behind one navigation entry (`system`, `/system`, admin only, data-model §5 of UI 001). Inside it:
  - `catalogue.ts` (R5), `search.ts` (R6), `routes.ts`, `index.ts`;
  - `api/` with one module per contract area: `capabilities.ts`, `branding.ts`, `passwords.ts`,
    `notifications.ts`, `rspamd.ts`, `global-filters.ts`, `presets.ts`, `cors.ts`, `license.ts`,
    `mass-mail.ts`;
  - `composables/`, `lib/` (pure logic), `layouts/`, `pages/<group>/`, `components/<group>/`.

  `index.ts` exports only `systemSettingsRoutes`, `QuotaCopiesSection` (for UI 002's domain page)
  and `PresetPicker` (for UI 005's filter form). Code with uses outside the feature goes to
  `src/shared/` (`color/contrast.ts`, the code editor, the e-mail preview) or `src/app/branding/`
  (brand colours in the shell).

  Every route is a child of `/system`, which renders `SettingsLayout` (R7). The full route map is
  in [data-model.md](./data-model.md#6-route-map). Rule, map and job addresses use the contract's
  identifier patterns (`\d+`, `[A-Za-z0-9_.-]{1,128}`, the ULID pattern). Every page is a lazy
  route chunk.
- **Rationale**: One folder avoids an import cycle between a settings shell and a mass mail module
  that both need the layout and the catalogue. 001-R3's boundaries still hold: other features reach
  013 only through `index.ts`.
- **Alternatives considered**: A `mass-mail` feature folder beside `system-settings` was rejected:
  the parent route must import the mass mail routes while mass mail imports the layout, which is a
  cycle. Separate folders per group (seven) were rejected as fragmentation of one navigation
  section.

### R5. The settings catalogue

- **Decision**: `src/features/system-settings/catalogue.ts` is one typed, ordered array of the seven
  groups and seventeen pages of FR-004. It is the single source for the overview, the wide-screen
  list, the page switcher, the search, the page titles, the History targets and the visibility
  rules. Each page has:
  - `id`, `group`, `routeName`, `titleKey`, `descriptionKey`;
  - `sections`: `{ id, headingKey, fieldKeys[] }`, where `id` is also the heading's DOM id;
    `titleKey`, `headingKey` and `fieldKeys` are the legacy keys of T008a's form map (the legacy menu
    entry, card title and field label) wherever one exists, and new strings only otherwise
    (constitution IV 1.3.0);
  - `legacyNameKeys`: further legacy keys used verbatim (for example `admin.customize`,
    `admin.sys_mails`), plus literal legacy names that legacy never translated ("Rspamd UI",
    "Prefilter", "Postfilter"), stored as new strings in all three locales;
  - `auditTarget`: `{ type: AuditTargetType }` for History (R27);
  - `visible(capabilities)`: `false` only for License while license verification is disabled
    (FR-033).

  The full table is in [data-model.md](./data-model.md#10-settings-catalogue). A unit test checks
  that every page has a route, every section id appears as a heading id in its page component (a
  static scan of the SFC), and every key exists in en-gb (a new string) or in the bundled `en-gb`
  legacy snapshot (a legacy key).
- **Rationale**: The same pattern as 001-R19's navigation catalogue: one array makes a missing
  entry or a broken link impossible, and FR-008 forbids searching anything but the app's own
  catalogue.
- **Alternatives considered**: Deriving sections from the rendered pages at runtime was rejected:
  searching would then need every page chunk loaded, and the overview would request data.

### R6. Settings search

- **Decision**: `search.ts` builds an index from the catalogue whenever the locale or the
  capabilities change, and searches it on every input event (no debounce; the index has fewer than
  300 entries, so SC-014's 300 ms holds with room to spare).
  - **Haystacks** per page: title, description, every section heading, every field label, and the
    legacy names in the language in use **and in English**. English legacy names are included
    because the clarified spec's examples search "Customize" and "System mails" in a Czech app.
    The English values come from the installation's `en-gb` legacy file, which UI 001's legacy layer
    loads as the fallback, or from the bundled `en-gb` snapshot and the bundled en-gb new strings,
    so they need no extra load.
  - **Normalisation** of both query and haystack: `toLocaleLowerCase(locale)`, Unicode NFD, removal
    of combining marks (`\p{M}`), collapse of whitespace. "uprava" finds "Úprava".
  - **Matching**: the query is split on whitespace; an entry matches when every token is a
    substring of one haystack of that entry.
  - **Ranking**: page title prefix, then title substring, then section heading, then field label,
    then description, then legacy name; ties keep catalogue order. Results are grouped by page,
    and a result that matched a section or field names it ("UI texts › Announcement").
  - **Selection** opens `/system/<page>#<sectionId>` (or the page alone for page-level matches).
    UI 001's router focus module (001-R19) is extended: when the route has a hash naming an element
    on the page, focus moves to that element (a section heading with `tabindex="-1"`) instead of
    the `<h1>`. Because sections render after their data, the module waits for the element with a
    `MutationObserver` for at most 3 s, then falls back to the `<h1>`.
  - **Announcements**: the result count is announced politely 500 ms after the last keystroke
    (FR-100), without moving focus. No results show "No matching settings" with a "Clear search"
    action (FR-007).
  - The query lives only in the overview's address as `?q=` (conventions "Lists"), so Back returns
    to the same results. License is absent from the index when it is hidden.
- **Rationale**: FR-007, FR-008 and the clarification on diacritics. Substring tokens are
  predictable for short labels, and including English legacy names costs nothing.
- **Alternatives considered**: A fuzzy library (Fuse.js, MiniSearch) was rejected under VIII: the
  catalogue is tiny and substring matching meets every acceptance scenario. Searching stored values
  is forbidden by FR-008.

### R7. Settings layout, page switcher and breakpoints

- **Decision**:
  - From `xl` (1280 px) up, `SettingsLayout` shows the grouped page list beside the open page and
    marks the current page with `aria-current="page"`. At `lg` the app's own navigation already
    takes a column, so a second column would squeeze content below the readable width.
  - Below `xl`, the overview (`/system`) is its own screen. Every settings page shows a "Settings"
    back link to the overview and a "Pages" button that opens the page switcher: a Reka `Dialog`
    (bottom sheet on phones) with the pages as links grouped under group headings, the current one
    marked. Choosing a link navigates and closes the dialog, and focus goes to the new page's
    heading.
  - The overview lists every visible group with its pages, each with its one-line description, as
    links with at least 44 px height (FR-005, FR-095).
  - The layout reads the capabilities first (R8) and shows their loading and error states for the
    whole area.
- **Rationale**: FR-005 at 360 px and on desktop; a dialog of links avoids WCAG 3.2.2 issues that
  a navigating `<select>` would cause.
- **Alternatives considered**: A native `<select>` with `<optgroup>` that navigates on change was
  rejected (3.2.2 On Input). Tabs across seven groups were rejected: they overflow at 360 px, which
  is legacy's problem.

### R8. Capabilities, demo mode and License visibility

- **Decision**:
  - `useSettingsCapabilities()` wraps `getSettingsCapabilities` with `staleTime: 5 min`. The layout
    renders nothing of a page until the capabilities are loaded. Their failure shows the area's
    error state with a retry (FR-032).
  - Limits come only from the capabilities (`limits.*`, `logos.*`, `massMail.*`, `brandColors.*`)
    or, where the capabilities have none, from the contract through the limits module of 001
    (`src/shared/validation/limits.ts`, checked against `contract/openapi.json` by its unit test).
    The second case covers the app link address (2,048 characters), the CORS origin (2,048) and the
    copy recipient entry (255).
  - **Demo mode** (`demoMode: true`): the Logos, Colours, UI texts, Sign-in page, App links and IP
    check pages render their values read-only, with a `ReadOnlyNotice` that says changes are
    disabled on this demonstration server (FR-033). A `403 demo-mode` refusal anyway keeps the
    input, says the same and invalidates the capabilities (FR-017).
  - **License**: when `licenseVerificationEnabled` is `false`, the catalogue hides the page (R5) and
    its route renders the settings "not found" state with a link to the overview, without
    requesting the license (FR-033). A `403 feature-disabled` from the license operations
    invalidates the capabilities and shows the same state (FR-079).
  - **Roles** (FR-002): the settings area is the catalogue entry `system` (administrators only);
    domain administrators reach only the quota copies of their domains (UI 002's scoped domain page)
    and the Sieve examples where UI 005 offers its editor; History is rendered for administrators
    only. The API enforces every rule; the UI only hides.
- **Rationale**: FR-002, FR-017, FR-032, FR-033, FR-079; `docs/conventions.md` ("Capabilities and
  limits come from each API feature's capabilities read").
- **Alternatives considered**: Hard-coding 15 MiB, 50 links or 1 MiB was rejected (FR-032).

---

## 3. Editing

### R9. Section editing, partial saves and outdated refusals

- **Decision**: `useSettingsSection()` (`src/features/system-settings/composables/`) drives every
  settings section on top of UI 002's `EditableSection.vue` and `useVersionedSave` with its field
  diff. Per section it takes the resource query, the section's fields, `toDraft()`, `toPatch()`
  and the mutation, and it:
  1. opens the section in edit mode from the cached resource, keeping the `etag` that was read;
  2. computes the changed fields and sends a JSON Merge Patch of only those fields (nested for the
     announcement; whole lists for app links, origins and copy recipients) with `If-Match`
     (FR-010);
  3. on success writes the response with `setQueryData`, announces the success, returns to view
     mode, and runs the section's follow-up (for branding: invalidate `['public-config']`, R16);
  4. on `412` keeps the draft, refetches, and marks each field whose saved value changed since the
     read with its new saved value; the user saves again on the new `etag` or discards (FR-011);
  5. on `422` maps field errors through `useProblemForm` (R10), and on `403 demo-mode`,
     `503 temporary-failure` and network failures keeps the draft with the matching message
     (FR-012, FR-017, FR-092);
  6. disables Save while a request runs (FR-014).

  Only one section per page is in edit mode at a time. Opening another one, or leaving the page,
  while a section is dirty asks for confirmation: leaving goes through UI 002's
  `useLeaveGuard(shouldGuard, messageKey)` (`src/shared/composables/useLeaveGuard.ts`, the
  canonical name in `docs/conventions.md`), and switching sections asks through `useConfirm`
  inside `useSettingsSection` (FR-013). Editor pages (rules, maps, global Sieve filters, the
  compose page) are always-editable forms that use the same guard and the same save rules.

  Values the API marks as defaults carry a "Default" badge, and fields whose empty value falls back
  to a default say what the empty value means, with the default shown (FR-016).

  On small screens the edited section's Save and Cancel sit in a sticky bar at the bottom of the
  viewport (FR-009). While the bar is shown, `scroll-padding-bottom` equals its height, so a focused
  field is never hidden behind it (FR-098, WCAG 2.4.11).
- **Rationale**: Conventions "Editing and conflicts" and the clarification on explicit saves. The
  API's merge patch semantics (FR-007 of API 013) make "only changed fields" exact.
- **Alternatives considered**: Saving switches immediately was rejected by the clarification.
  Several sections in edit mode at once was rejected: they share one `etag`, so the second save
  would always be refused as outdated.

### R10. Problems and field errors of this feature

- **Decision**: The generic mapping of 001-R8 and 001-R15 stays. 013 adds:

  | Problem | App behaviour |
  |---|---|
  | `412 about:blank` | R9 step 4; for a deletion, the confirmation is shown again with fresh data |
  | `503 temporary-failure` (`Retry-After`) | "Nothing was changed"; retry keeps the input; reads show the page error state |
  | `403 demo-mode` | R8 |
  | `403 feature-disabled` | R8 (License) |
  | `409 regex-map-unavailable` | "This map is not available on this server; nothing was changed" (FR-067) |
  | `409 global-sieve-filter-unavailable` | "This filter file is not available on this server; nothing was saved or restarted" (FR-071) |
  | `502 container-action-failed` (Rspamd password) | "The change could not be confirmed; the new password may apply at Rspamd's next start" + retry (FR-074) |
  | `504 outcome-unknown` (`step: rspamdUiPassword`) | "It is unknown whether the password was set; setting it again is safe" + retry |
  | `409 mass-mail-recipient-count-changed` (`actualRecipients`) | R22 |
  | `409 mass-mail-already-running` (`runningJobId`) | R22 |
  | `409 about:blank` from `cancelMassMailJob` | "The job already completed"; refetch the job (FR-089) |
  | `403 session-required` | Generic message advising to sign in again (not expected from the app) |
  | `404 about:blank` | The page's "not found" state with a way back to its list (FR-006), or UI 002's for a domain |
  | `403 forbidden` | Identity refresh by 001-R8; the section keeps its input and shows the reason (FR-003) |

  **Field paths** map to targets as follows: `links.<i>.<field>` to the app link entry, `recipients.<i>`
  and `allowedOrigins.<i>` to the entry in the tag editor, `selection.domains|include|exclude.<i>`
  to the picker chip, `body` (logo upload) to the file panel, `content` and `script` with a `line`
  parameter to the editor line (R17), `light`/`dark` to the colour fields.

  **Parameters**: `tooLong` with `unit: bytes` is formatted as a binary size; `insufficientContrast`
  shows `ratio` and `minimum` as numbers and `surface` as a colour swatch with its hex value;
  `unsafeSvgContent.construct`, `invalidRegexLine.reason`, `unbalancedStructure.construct`,
  `notEligible.reason` (`notReceiving`, `outsideSelectedDomains`) and the formats `email`,
  `singleLine`, `appLinkUrl`, `hexColor` and `origin` each get a translated phrase. The `format`
  values are prose in the contract, so the tasks list them explicitly.

  **English diagnostics**: two parameters are free text by contract: `sieveSyntax.message` (the
  legacy parser's message) and the Dovecot reply in `MassMailRecipient.failureReason`. FR-069
  requires the parser's reason. Both are shown inside a translated sentence (for the parser, the
  legacy `danger.sieve_error`, "Sieve parser error: %s", as in the classic interface; constitution
  IV 1.3.0), marked as the server's own message (`<q lang="en">`), never as the whole message,
  and rendered through UI 006's `PlainText.vue` and `neutralise()`
  (`src/shared/security/plain-text.ts`), so control and bidi characters are shown as markers and
  cannot spoof the screen. `DovecotRestartOutcome.detail`
  and `ContainerProblem.serviceMessage` are not shown; the translated outcome suffices.
- **Rationale**: FR-092 and constitution I/IV: the app's text is translated; quoted server
  diagnostics are data, like a stored value.
- **Alternatives considered**: Hiding the parser message was rejected by FR-069. Translating
  Dovecot replies by pattern matching was rejected as guesswork; a stable code is requested from the
  API instead (plan, API gap G1).

### R11. Client-side validation

- **Decision**: Checks run before sending; server errors are always shown too. Rules, with their
  limit source:
  - single-line texts (titles, subject, names, descriptions): `limits.singleLineTextMaxLength`, no
    line breaks or control characters (the input type prevents line breaks; pasted ones are refused
    with `validation.format.singleLine`);
  - help text, footer, announcement: `limits.htmlTextMaxLength` characters;
  - templates, rules, maps, scripts, bodies: their byte limits, counted as UTF-8 bytes
    (`TextEncoder`), shown from 90 % (R17);
  - e-mail addresses: `src/shared/validation/email.ts` (created here if no earlier feature did):
    one `@`, a non-empty local part and domain, no whitespace or control characters. It is
    deliberately permissive (`quota-warning@localhost` passes); the API is the authority;
  - colours: `^#?[0-9A-Fa-f]{6}$`, normalised to `#rrggbb` (R13);
  - app link addresses: absolute `http:`/`https:` URL (parsed with `URL`) or a path starting with
    exactly one `/`; `%u` allowed in the user link; length from the contract (2,048);
  - CORS origins: `*` or `scheme://host[:port]` with scheme `http`/`https`, host parsed by `URL`,
    and nothing after the authority (no path, not even `/`, no query, fragment or credentials);
    normalised to lower case;
  - password policy length: `limits.passwordPolicyMinLength` to `passwordPolicyMaxLength`;
  - Rspamd password: `limits.rspamdUiPasswordMinLength` to `rspamdUiPasswordMaxLength`, no control
    characters;
  - lists: app links ≤ `limits.appLinksMax`, copy recipients ≤
    `limits.quotaNotificationRecipientsMax`, origins ≤ `limits.corsOriginsMax`, selection entries
    ≤ `massMail.maxSelectionEntries`.
- **Rationale**: FR-024, FR-041, FR-043, FR-052, FR-073, FR-075, FR-082, FR-096; limits per R8.
- **Alternatives considered**: A strict RFC 5322 e-mail regex was rejected: false refusals of
  addresses the server accepts are worse than a server error.

---

## 4. Branding

### R12. Brand colours in the shell under the strict CSP

- **Decision**:
  - **Tokens**: `src/styles/main.css` gains semantic accent tokens per theme: `--accent` (background
    of primary buttons and checked controls), `--accent-foreground`, `--accent-text` (links and
    accent text on surfaces), `--accent-hover`. Their defaults are UI 001's palette (001-R16:
    `brand-500` in light, `brand-400` for dark-mode text). Each token reads an optional runtime
    property first: `--accent: var(--brand-light, var(--color-brand-500))` under `:root`, and
    `var(--brand-dark, …)` under `.dark`. Tailwind v4 exposes them through `@theme inline` as
    `bg-accent`, `text-accent-foreground`, `text-accent-text` and `bg-accent-hover`.
  - **Runtime application**: `src/app/branding/brand-colors.ts` watches the public configuration
    and sets six custom properties on `document.documentElement` with
    `style.setProperty()`: `--brand-light`, `--brand-light-foreground`, `--brand-light-hover` and
    the three `--brand-dark-*`. `null` or a missing `brandColors` removes them, which restores the
    defaults. This is CSSOM, which the CSP allows (001-R16, 001-R18); no style element and no
    inline style attribute is created. The theme switch needs no JavaScript, because the `.dark`
    selector picks the right variables.
  - **Hover**: the hover colour moves 12 % towards black when the foreground is white, and towards
    white when it is black, so its contrast with the foreground only grows. It is computed with
    `src/shared/color/contrast.ts`.
  - **Where the accent applies** (FR-030): primary buttons, links, the selected navigation entry,
    and the checked state of switches, checkboxes and radio buttons. 013 rewires exactly these
    UI 001 parts to the tokens: `src/shared/ui/button` (primary variant), `switch`, `checkbox`,
    `radio-group`, the global link style in `main.css`, and `src/app/shell/NavigationList.vue`.
    Focus rings keep their own `--color-focus` token, and success, warning, error and info colours
    are untouched.
  - **Surfaces**: brand-coloured text, icons and outlines appear only on white surfaces in the light
    theme and on surfaces at most as light as `#1D2939` (TailAdmin `gray-800` or darker) in the dark
    theme, the API's reference surfaces. A colour at the 4.5:1 limit drops to 4.35:1 on `gray-50`,
    so tinted or muted surfaces (`gray-50`, `gray-100`, `brand-50`) never carry `text-accent-text`.
    The selected navigation entry becomes a solid `bg-accent text-accent-foreground` pill instead of
    TailAdmin's tinted `bg-brand-50 text-brand-500`. Link hover adds an underline and keeps the
    colour.
  - **Verification**: UI 001's `expectAccessible` fixture (001-R24) gains two passes with brand
    colours at the 4.5:1 limit, injected through the same custom properties: light `#767676`
    (4.54:1 on white, black foreground) and dark `#8f8f8f` (4.55:1 on `#1D2939`). From then on,
    every end-to-end test of every feature checks contrast with limit colours in both themes
    (SC-003, SC-004).
- **Rationale**: FR-030, FR-031, the clarification on accent elements, and 001's Complexity Tracking
  row, which made colours custom properties so that 013 could set them through CSSOM.
- **Alternatives considered**: Overriding TailAdmin's whole `--color-brand-*` scale was rejected: it
  would recolour focus rings and tinted surfaces and break FR-030. Generating a stylesheet with the
  colours was rejected by the CSP. Deriving tints from the brand colour (`color-mix`) was rejected:
  their contrast cannot be guaranteed for every accepted colour.

### R13. Contrast computation, adjustment and colour input

- **Decision**: `src/shared/color/contrast.ts` implements exactly the API's formula (API research
  R5): sRGB linearisation with the 0.04045 threshold, luminance weights 0.2126/0.7152/0.0722,
  ratio `(L1 + 0.05) / (L2 + 0.05)`, and foreground black or white by the higher ratio (ties:
  black).
  - **References** come from `capabilities.brandColors` (`lightReferenceSurface`,
    `darkReferenceSurface`, `minimumContrastRatio`), never from constants.
  - **Pass/fail** compares the exact ratio with the minimum, as the API does.
  - **Display**: the ratio is rounded to one decimal, except that a failing ratio that would round
    up to the minimum is shown one step lower (4.46 shows "4.4:1"), so "4.5:1, fails" never
    appears. Worked examples, unit-tested: `#1D4ED8` 6.7:1 on white and 2.2:1 on `#1D2939`;
    `#FFD700` 1.4:1; `#60A5FA` 5.8:1 on `#1D2939` with a black foreground.
  - **Adjustment** (FR-026): convert to HSL; keep hue and saturation; binary-search the lightness
    below and above the entered lightness for the boundary where the ratio reaches the minimum;
    take the passing side closest to the entered lightness; round to `#rrggbb` and step one 8-bit
    unit further if rounding fell below the minimum. Example: `#FFD700` becomes about `#8b7500`
    (4.52:1). If no lightness passes (impossible for these references, kept as a guard), no offer is
    shown.
  - **Dark preview without a dark colour** applies the API rule (FR-027): the light colour if it
    passes the dark reference, otherwise the default palette, and says which applies.
  - **Input** (FR-024, FR-102): a text field (`inputmode="text"`, `autocapitalize="off"`,
    `spellcheck="false"`) that accepts `#RRGGBB` or `RRGGBB` in either case and normalises to
    lower case with `#`; beside it a native `<input type="color">` bound to the same value as a
    secondary way. Clearing the text field clears the colour (`null` in the patch).
  - **Live preview** (FR-027): a preview component per theme sets `--accent` and friends on its own
    container through a `:style` binding (CSSOM, allowed by 001-R18) and renders a header sample, a
    primary button, a link, a selected navigation entry and a checked switch. The ratio, the minimum
    and the verdict are text (FR-025, FR-099).
- **Rationale**: Identical formulas make "the app blocks" and "the API refuses" agree; the API stays
  the authority (FR-028).
- **Alternatives considered**: OKLCH lightness adjustment was rejected: FR-026 names hue and
  saturation, which is HSL's model. A colour library (culori, chroma-js) was rejected under VIII.

### R14. Logos: checks, previews and upload

- **Decision**:
  - **Choosing a file**: `<input type="file" accept="image/png,image/jpeg,image/gif,image/svg+xml">`.
    `lib/logo-file.ts` reads the first bytes and classifies the content (PNG signature, JPEG
    `FF D8 FF`, `GIF87a`/`GIF89a`, or text whose first element after an optional BOM, XML
    declaration, comments and doctype is `<svg`). Anything else is refused before upload as an
    unsupported type. The size is checked against `capabilities.logos.maxBytes`, and raster
    dimensions, read with `createImageBitmap(file)` (which decodes without fetching, so no CSP
    source is involved), against `maxWidth` and `maxHeight` (FR-020). A failed check states the
    limit as a binary size or in pixels and offers no Upload action. SVG safety is not checked in
    the browser: the API refuses unsafe SVGs and names the construct (FR-021).
  - **Preview before upload**: the file is shown through `URL.createObjectURL()` in `<img>`
    elements, which needs `img-src 'self' blob:`. **This amends UI 001's CSP** (001-R18,
    `docker/nginx/security-headers.conf`). `blob:` URLs can only be created by the app's own script,
    and an image cannot run code, so the policy stays free of inline script and style
    (constitution V). The object URL is revoked on cancel, upload and unmount. A raster-only
    canvas preview (via `createImageBitmap`) was not enough: it cannot show SVGs and loses GIF
    animation (spec edge cases).
  - **Preview sizes**: `src/app/branding/logo-sizes.ts` holds the header and sign-in sizes, and
    `BrandLogo.vue` gains a `size` prop (`header` or `signIn`) and an optional `src`, so the
    previews render the exact component the shell uses, with its fallback to the product name on a
    load error (spec edge case). Each variant is previewed on a light and on a dark surface at both
    sizes (FR-019). A missing variant shows what the public configuration serves for that theme
    (`logos.<variant>.url`, the deployment default), labelled as the default.
  - **Upload**: `replaceLogo` sends the raw file (`bodySerializer: (file) => file`) with the detected
    `Content-Type`, or `application/octet-stream` when the browser reports nothing, and `If-Match`
    with the variant's `etag`. The CSRF middleware of 001-R8 adds its header as for any write. The
    contract validator of the mock is extended for binary request bodies (R30).
  - **Details** (FR-018): type, binary size, and `width × height` or "no declared size" when the
    API returns `null` for an SVG.
  - **Deletion** (FR-022): `deleteLogo` with `If-Match` after a confirmation that names the variant
    and shows the default the app shows instead.
- **Rationale**: FR-018 to FR-023, FR-107; logos are only ever images (no markup insertion).
- **Alternatives considered**: Rendering a chosen SVG inline was rejected by FR-019 and V. Data URLs
  were rejected: `data:` would weaken `img-src` more than `blob:`.

### R15. Operator HTML, plain text and the announcement preview

- **Decision**:
  - **Help text and footer** (FR-036): the preview renders through `SanitizedHtml.vue`, which uses
    exactly UI 001's sanitiser. `src/shared/security/sanitize.ts` gains `sanitizeHtmlWithReport()`,
    which runs the same DOMPurify configuration and reads `DOMPurify.removed` to report the kinds of
    removed content: scripts, styles, images, forms, embedded frames, event handlers, unsupported
    links and other unsupported formatting. The preview lists them and notes that the classic
    interface shows the HTML as written. `sanitizeHtml()` keeps its signature, so the shell's
    rendering is unchanged.
  - **Plain-text fields** (FR-035): interpolation only. Unit tests render `<b>` and
    `Acme & Co Mail` literally in the header, the sign-in screen and `document.title`.
  - **Announcement** (FR-037): the preview reuses UI 001's `AnnouncementBanner.vue` with the draft
    values, so its type icon, text alternative and neutral style for "no type" match the shell.
- **Rationale**: One sanitiser means the preview equals what users see (SC-010).
- **Alternatives considered**: A second, preview-only sanitiser was rejected: the preview could
  drift from the shell.

### R16. Branding freshness

- **Decision**: After a successful save of a logo, the UI texts, the sign-in page options, the app
  links or the brand colours, the section invalidates `['public-config']`. UI 001's public
  configuration query refetches with `If-None-Match` (001-R7), and the shell, the page title, the
  Apps menu and the brand colours update without a reload (FR-031). The password policy save writes
  the shared password-policy query, so the password forms of UI 003, 005 and 007 show the new rules
  (FR-109).
- **Rationale**: FR-031, FR-109, constitution VII (refetch only after a change).
- **Alternatives considered**: Writing the public configuration from the settings responses was
  rejected: the effective values (for example `appLinks` with built-in links) are computed by the
  API.

---

## 5. Editors and previews

### R17. The text editor

- **Decision**: A shared `CodeEditor.vue` (`src/shared/components/code-editor/`), built on a native
  `<textarea>`, serves the settings rules, the filter maps, the global Sieve filters, the effective
  settings map (read-only), the e-mail templates, the mass mail bodies and, through promotion, the
  script field of UI 005 (second use). Its contract:
  - props: `modelValue`, `label`/`labelledby`, `monospace` (default `true`), `lineNumbers` (default
    `true`), `readonly`, `maxBytes`, `marks` (`{ line, message }[]`), `describedby`;
  - attributes: `autocapitalize="off"`, `autocorrect="off"`, `spellcheck="false"`,
    `autocomplete="off"` (FR-072);
  - **wrapping** on by default (`wrap="soft"`); a toggle switches to `wrap="off"` with
    `white-space: pre` and `overflow-x: auto` on the textarea only, so only the editor scrolls
    sideways (FR-094). The choice is kept in memory for the visit, never in storage;
  - **line numbers** in an `aria-hidden` gutter beside the textarea. With wrapping off, line `n`
    sits at `n × lineHeight`. With wrapping on, `line-layout.ts` measures each logical line's height
    in a hidden mirror element with the same font, width and padding, caches heights by line text
    and width, re-measures only changed lines in a `requestAnimationFrame` after input (never
    blocking the input event), and re-measures all lines on resize (`ResizeObserver`). The gutter
    renders only the numbers in the visible range;
  - **marks**: a marked line shows a warning icon with a text alternative in the gutter, and a list
    below the editor names each marked line with its message and a "Go to line" button (FR-099);
  - **go to line** (`goToLine(n)`, exposed): selects the line, focuses the textarea, scrolls it to
    the line's measured offset and announces "Line n: <message>" (FR-072, SC-006);
  - **size**: from 90 % of `maxBytes`, a status line shows the UTF-8 size against the limit; above
    the limit the editor sets `aria-invalid` and the form blocks saving with the limit stated;
  - **keyboard**: Tab is not captured (a native textarea moves focus on Tab), which the editor's
    hint states ("Tab moves to the next control"). Nothing needs indentation by Tab: maps, UCL
    rules and Sieve scripts accept spaces.
- **Rationale**: The task brief prefers a textarea; it is fully accessible, works with every mobile
  keyboard and IME, needs no CSP exception and no dependency. Line marks are required as text
  anyway (FR-099), so gutter icons plus a list meet FR-064 without per-line styling inside the
  textarea.
- **Alternatives considered**:
  - **CodeMirror 6** (MIT, GPL-compatible, about 100 KB gzipped, lazy-loadable; its style module
    uses constructed stylesheets, so it works under the CSP): rejected under VIII. Its virtualised
    viewport and inline lint marks are better for 1 MiB documents, but the textarea meets every
    requirement, and CodeMirror's contenteditable surface has known quirks with mobile keyboards and
    screen readers. Revisit only if the 1 MiB responsiveness test of R31 fails.
  - Monaco: rejected (several MB, no mobile support).
  - A contenteditable editor of our own: rejected (IME, undo and accessibility risks).

### R18. Filter maps: live line check, server check and change review

- **Decision**:
  - **Live check** (`lib/regex-lines.ts`, FR-064): each line is valid when it is empty, starts with
    `#`, or matches `^/(.+)/([ims])?$` with no further `/` inside the pattern (the contract's
    `innerSlash` rule). Failing lines are reported with the reasons `notSlashDelimited`,
    `tooManyFlags` or `innerSlash`, matching the API's codes. The browser does not compile patterns:
    JavaScript `RegExp` is not PCRE (possessive quantifiers, atomic groups), so it would refuse valid
    lines; the server check reports `doesNotCompile`.
  - **Check** (FR-065): `replaceRspamdRegexMap?validateOnly=true` with `If-Match`. Success is
    announced; `422` errors on `content` carry `line` and `reason`; each becomes an editor mark with
    "Go to line".
  - **Review before save** (FR-066): a multiset line diff (`lib/line-diff.ts`) lists the added and
    removed lines with counts. Map lines are independent patterns, so order changes are not
    changes; the comparison is O(n) and handles 1 MiB maps. Lines render through `PlainText.vue`
    (`neutralise()`), so hidden control or bidi characters in a pattern become visible markers. The
    review dialog scrolls inside while
    its actions stay visible (FR-097). Confirming sends the replacement with `If-Match`. Success says
    that Rspamd reloads the map without a restart.
  - **Unavailable maps**: a map listed with `available: false` shows a notice and a read-only
    editor. A `409 regex-map-unavailable` on save (the file vanished after the read) shows FR-067's
    message and keeps the input.
  - **List** (FR-063): `listRspamdRegexMaps` with `q`; the map page seeds its detail cache from the
    list entry (same `etag`), so opening a map needs no second request.
- **Rationale**: The legacy "I will be careful!" gate is replaced by reviewing each change
  (clarification). The live rule mirrors legacy's `validate_rspamd_regex` and the API.
- **Alternatives considered**: A positional (Myers) diff was rejected: it reports moves as changes,
  which map semantics ignore, and costs O(nd).

### R19. Settings rules, presets and the effective map

- **Decision**:
  - **List** (FR-054): `useListState` with `q`, `active`, `sort` (`id`, `description`, `active`,
    `createdAt`, `modifiedAt`; default `id asc`), `page`, `size`. Cards below `md`, a table above.
  - **Create and edit** (FR-055, FR-057): own pages; description, content (`CodeEditor`), active
    (on by default for new rules, as legacy's form). A link to the Rspamd documentation of the
    settings structure (`https://rspamd.com/doc/configuration/settings.html#settings-structure`)
    opens in a new tab with `rel="noopener noreferrer"`, as FR-055 requires.
  - **Check** (FR-058): `createRspamdSettingsRule?validateOnly=true` or
    `updateRspamdSettingsRule?validateOnly=true`; `unbalancedStructure` errors carry `line` and
    `construct` and become editor marks.
  - **Delete** (FR-057): confirmation naming the description and identifier; `If-Match`; after
    success or a save the app says that Rspamd applies the change within its refresh interval
    (FR-059).
  - **Presets** (FR-056, FR-061, FR-062): `PresetPicker.vue` lists `listPresets(kind)` (cached
    with a long stale time; presets ship with mailcow). The headline is `t(presetKey(translationKey))`
    when the app knows the key, otherwise the API's English headline. `presetKey()` maps
    `admin.rsettings_preset_4` to the legacy key `admin.rsettings_preset_4` itself, used verbatim
    (constitution IV 1.3.0, R28). Choosing a preset fills the fields; if the user
    typed something, a confirmation asks before replacing. In UI 005's form, only the script (and
    the description when empty) is filled. The global Sieve filters never offer presets.
  - **Effective map** (FR-060): its own address, a read-only `CodeEditor` with line numbers, a copy
    action, and the error state with retry on `503 temporary-failure`. It is invalidated after any
    rule change.
- **Rationale**: FR-054 to FR-061; the validate-only option (API FR-093) gives a side-effect-free
  Check.
- **Alternatives considered**: A client-side UCL parser was rejected: the server check is
  authoritative and the structure rule is the only rule.

### R20. Global Sieve filters

- **Decision**: One page, two sections (pre-filter, post-filter), each an always-editable form with
  its own Check and Save (FR-068). Data comes from `listGlobalSieveFilters` (both scripts and their
  `etag`s in one request).
  - **Check** (FR-069): `replaceGlobalSieveFilter?validateOnly=true`; a `sieveSyntax` error shows
    its `line` (with "Go to line") and the parser's message (R10).
  - **Save** (FR-070): a dialog with a radio group, "Restart the mail service now" preselected and
    "Apply at the next restart", explaining the brief interruption of IMAP, POP3 and delivery for
    every user, plus "an empty script means no global filter" when the script is empty. The choice
    becomes `deferRestart`.
  - **Outcome** (FR-071): `meta.dovecotRestart.outcome` `done`, `failed` (saved, takes effect at the
    next restart) or `deferred` is announced in text. `409 global-sieve-filter-unavailable` says
    nothing was saved or restarted.
  - No presets here (FR-062).
- **Rationale**: FR-068 to FR-071 and the clarification on restart choice.
- **Alternatives considered**: Restarting silently (legacy) was rejected by the clarification.

### R21. Isolated e-mail HTML previews

- **Decision**: `EmailHtmlPreview.vue` (`src/shared/components/`) shows an HTML template or body in
  an `<iframe>` that is isolated from the app, only when the user asks for it (FR-090):
  - **Frame**: `<iframe sandbox="allow-same-origin" title="…">` without `src` or `srcdoc`. Without
    `allow-scripts`, nothing can run in it; without `allow-forms`, `allow-popups` and
    `allow-top-navigation`, it can neither submit, open windows nor navigate the app. With no
    `src`, no navigation happens, so `frame-src` (which falls back to `default-src 'none'`) is never
    consulted, and the frame's `about:blank` document inherits the app's CSP as a further guard.
    `allow-same-origin` lets the app's code write into the frame; it is safe here because the frame
    can run no script.
  - **Content**: `src/shared/security/email-html.ts` parses the HTML with DOMPurify in an e-mail
    profile (`RETURN_DOM_FRAGMENT`): e-mail layout tags are kept (tables, `div`, `span`, `font`,
    `center`, headings, lists, `a`, `img`), while `script`, `style` (extracted first), `iframe`,
    `object`, `embed`, `form` and its controls, `link`, `meta`, `base`, `svg`, `math`, media
    elements and every event handler are removed. Attributes are limited to presentational ones
    plus `href`, `src`, `alt`, `title`; `background`, `srcset`, `poster`, `lowsrc` and `dynsrc` are
    removed.
  - **Styles without inline CSS**: the frame inherits `style-src 'self'`, so the app never parses an
    inline style. Each element's `style` attribute is moved to a `data-preview-style` index during
    sanitising and applied after insertion with `element.style.cssText = …` (CSSOM). `<style>`
    blocks are parsed with a constructed `CSSStyleSheet` that is never adopted, and their style
    rules are applied per matching element in source order through CSSOM, before each element's own
    inline styles. At-rules (`@import`, `@font-face`, `@media`, `@keyframes`) are dropped. Every
    declaration whose value contains `url(`, `image-set(`, `src(`, `expression(` or whose property is
    `behavior` or `-moz-binding` is dropped, so CSS cannot fetch anything.
  - **No remote resources** (FR-090, SC-010): every `<img>` is replaced by a labelled placeholder
    ("Image not loaded in the preview: <alt>"), whatever its source; inline `data:` images are
    replaced too, because the inherited `img-src 'self'` would block them. Links lose their `href`
    (the target is shown as the element's `title`), so a click does nothing.
  - **Placeholders**: `lib/email-samples.ts` replaces `{{link}}`, `{{username}}`, `{{username2}}`,
    `{{date}}`, `{{token_lifetime}}` and `{{hostname}}` (reset e-mail) and `{{username}}`,
    `{{percent}}` (quota) with translated sample values; the host name is the real one from the
    capabilities, the date is formatted for the locale. Values are inserted as text before
    sanitising and escaped as HTML text. Mass mail bodies have no placeholders.
  - **Presentation**: a dialog (full screen below `md`) with the frame filling its body and scrolling
    inside, and the note that e-mail clients may show the message differently. The frame's document
    is rebuilt on every open and emptied on close. It is built after the frame's `load` event,
    because Firefox can replace a new frame's initial `about:blank` document once it has loaded;
    Firefox is checked by hand (quickstart Part D), since the end-to-end projects run Chromium and
    WebKit (001-R24).
  - **Tests**: a hostile fixture (scripts, `onerror`, `javascript:` links, forms, remote images,
    CSS `url()`, `@import`, `<base>`, `<meta http-equiv="refresh">`) must render with no network
    request outside the app's origin, no dialog, no navigation, no script side effect and no CSP
    violation, in Chromium and WebKit.
- **Rationale**: The clarification forbids running scripts and loading remote resources; e-mail
  HTML needs layout that the shell's sanitiser removes. This design changes nothing in the app's
  CSP.
- **Alternatives considered**:
  - `srcdoc`: it inherits the CSP too, so inline styles would be blocked and reported, and the
    content could not be restyled through CSSOM without `allow-same-origin` anyway.
  - A separate static preview page with its own CSP (`style-src 'unsafe-inline'`): rejected. It
    needs `frame-src 'self'` in the app's CSP and a second policy with inline styles.
  - Rendering through the shell's sanitiser: it removes the layout that templates need.
  - Adopting a constructed stylesheet into the frame: it needs the frame realm's `CSSStyleSheet`
    constructor while scripting is disabled there, which is not reliable across engines.

---

## 6. Mass mail

### R22. Compose, preview, confirmation and conflicts

- **Decision**: `MassMailSendPage.vue` with `useMassMailCompose()`; all state lives in component
  memory only (FR-108).
  - **Layout** (FR-080): below `lg`, four steps (recipients, message, preview, send) with a progress
    indicator ("Step 2 of 4") whose heading receives focus on each step (FR-101); from `lg` up, one
    page with the same four sections.
  - **Selection** (FR-081): "All receiving mailboxes", optionally "Only these domains" (domain picker
    over `listDomains`); then "Nobody else excluded", "Only these mailboxes" (`include`) or "Everyone
    except these mailboxes" (`exclude`). The mailbox picker searches `listMailboxes` with
    `status=active&status=loginDisabled` (receiving mailboxes) and, when at most 100 domains are
    chosen, `domain=<chosen>`; with more, it searches all and the API refuses entries outside them
    (`notEligible`, `outsideSelectedDomains`). Pasted addresses become entries as in FR-052. The
    mailbox picker is the canonical `MailboxSearchPicker` (`src/shared/components/`, promoted by
    UI 008), given a multi-select mode with removable chips and the `status` and `domain` filters
    if it lacks them; the domain picker (`DomainPicker.vue`, feature-local, single use) follows the
    same pattern: a Reka `Combobox` without `ComboboxViewport` (001-R18), debounced 300 ms, "load
    more" through `useInfiniteQuery`. The form explains that inactive mailboxes that may not receive
    mail and resources are never included.
  - **Message** (FR-082): sender prefilled with `capabilities.massMail.suggestedSender`, subject,
    plain-text body (`CodeEditor`, proportional font, no line numbers), optional HTML body
    (`CodeEditor`, monospace, no line numbers) with the R21 preview.
  - **Preview** (FR-083): `previewMassMailRecipients` as a query keyed by the normalised selection,
    `q`, page and size. Any change to the selection discards it. `meta.recipientCount` is the count
    to confirm; `meta.total` the matches of `q`. Zero recipients says so and disables sending. The
    preview's search and page live in component state, not in the address: the preview belongs to an
    unsent, in-memory draft, and FR-108 keeps the selection out of history. This is the one list of
    the feature that does not follow conventions "Lists", recorded in plan.md.
  - **Confirmation** (FR-084, SC-008): `SendConfirmDialog.vue` shows the sender, subject, selection
    summary and count, and states that each recipient gets one copy straight into the inbox, without
    spam filtering, and that it cannot be recalled. The confirm button reads "Send to {count}
    mailboxes" (plural forms per locale). Nothing is sent before it is chosen.
  - **Send**: `createMassMailJob` with `expectedRecipients` = the confirmed `recipientCount`.
    - `409 mass-mail-recipient-count-changed`: refetch the preview, show the new count (from
      `actualRecipients` immediately, then the refreshed list), and open the confirmation again
      (FR-085).
    - `409 mass-mail-already-running`: say so and link to `/system/mass-mail/jobs/{runningJobId}`.
    - `422` on `selection.*.<i>`: mark that chip with its translated error and return to the
      recipients step.
    - `201`: `router.push` to the new job's page (FR-086); the draft is dropped, so leaving needs no
      confirmation.
  - **Leaving** with content and without sending asks for confirmation (UI 002's `useLeaveGuard`).
- **Rationale**: FR-080 to FR-086; the confirmed count is binding by contract (API FR-074).
- **Alternatives considered**: Typing the count was rejected by the clarification (conventions ask
  one explicit confirmation for mass mail). Keeping the preview state in the address was rejected
  as above.

### R23. Running job refresh

- **Decision**: `useJobRefresh()` drives `getMassMailJob` with TanStack's `refetchInterval` set to
  5,000 ms only while all of these hold, and `false` otherwise:
  1. the job's status is `running`;
  2. the document is visible (`refetchIntervalInBackground: false`; a `visibilitychange` to visible
     triggers one immediate refetch, FR-088);
  3. the user has not paused it with the "Pause automatic refresh" control (WCAG 2.2.2), shown only
     while the job runs;
  4. the last user interaction is younger than the inactivity limit, `min(15 min,
     Session.idleTimeout)` from UI 001's session store, tracked by the shared `useInactivity`
     (`src/shared/composables/useInactivity.ts`, created by UI 008 and promoted by UI 011; the
     polling rule of `docs/conventions.md`).

  When condition 4 fails, a polite notice says that automatic refresh paused because of inactivity,
  with "Resume"; it never resumes on its own, and a manual "Refresh" always works. The refresh stops
  when the status leaves `running`, and then the recipients list is invalidated once. The time of
  the last update is shown with `RelativeTime` (absolute time available). Unlike UI 008's silent
  refresh, progress is announced politely at most every 30 seconds and once at the end, because
  FR-100 asks for it. Leaving the page stops the refresh and never affects the job.

  This is the only periodic request of this feature. It is the condition-bound `refetchInterval`
  that the conventions allow as the exception to 001-R9. The inactivity limit reconciles 013's
  FR-088 and SC-009 with UI 001's FR-033 (no automatic requests while the user is idle that would
  keep the session alive): it bounds the effect to one idle period after the last interaction,
  exactly as UI 008 and UI 011 do.
- **Rationale**: FR-088, FR-100, SC-009 while the user is active; FR-033 of UI 001 and the polling
  rule of `docs/conventions.md` otherwise; constitution VII.
- **Alternatives considered**: Refreshing for as long as the page is visible was rejected: an
  unattended tab would keep an administrator session alive for the whole job. A shorter, feature-own
  window (2 minutes, an earlier draft of this plan) was rejected in favour of the shared rule, so
  that every polling screen of the app behaves alike. Server push was rejected: the API offers none
  (clarification).

### R24. Job list, job page and recipients

- **Decision**:
  - **Jobs list** (FR-087): `useListState` with `q` (subject), `status`, `page`, `size`; sort fixed to
    `createdAt desc`. A banner above the list shows the running job, if any, from
    `listMassMailJobs?status=running&limit=1`, whatever the filters. Status is text plus an icon
    (FR-099). Empty state explains mass mail and links to the send page.
  - **Job page** (FR-088): sender, subject, selection summary, creator, created/started/finished
    times, status, cancelled-by, and counts per outcome as text and as a stacked bar whose segments
    have text equivalents in a visually hidden list; the bodies: the text body in a read-only
    `CodeEditor` without line numbers, the HTML body only through R21's preview.
  - **Recipients**: `useListState` with `q`, `outcome`, `page`, `size`; sort `address asc`; refreshed
    on demand and once at the end of the job, not every 5 s (VII). A failed recipient shows a
    translated label: `interrupted` gets its own text; any other reason shows "Delivery failed" plus
    the mail server's reply quoted verbatim (R10). A stable failure code is requested from
    mailcow-rest-v2 (plan, API gap G1).
  - **Cancel** (FR-089): confirmation stating that pending recipients will not receive the message and
    that delivered ones keep it; `cancelMassMailJob`; the response replaces the cached job; `409`
    says the job already completed and refetches it.
- **Rationale**: FR-087 to FR-089; FR-015 list state in the address.
- **Alternatives considered**: Polling the recipients list with the job was rejected: it can be
  large and is not needed for SC-009.

---

## 7. Other settings and entry points

### R25. Rspamd web interface, CORS, IP check and License

- **Decision**:
  - **Rspamd password** (FR-073, FR-074, FR-106): one `type="password"` field with a show/hide
    toggle and `autocomplete="new-password"`, inside a `<form>` so password managers offer to save
    it. It always starts empty. Following the secrets rule of `docs/conventions.md`, the page calls
    the `api` client directly, never through a TanStack Query mutation, so the value never enters a
    query or mutation cache; it lives only in the component's state, no draft of the form is ever
    kept, and the field is cleared in `finally` after every attempt. The value never reaches
    storage, the address, logs or announcements. A link to `capabilities.rspamdWebInterfaceUrl`
    passes `safeHref()`.
  - **CORS** (FR-075, FR-076): an editable section with the origins in the tag editor (R26) and the
    methods as four checkboxes (at least one). The page explains that the settings apply only to
    `/api/v1`, that an empty list means the server's own origin (shown from `serverOrigin`), and
    warns without blocking when `*` is present. A stored invalid origin (a bare host name from an
    older release) is marked invalid in edit mode and blocks saving until it is corrected or
    removed, because the API validates the resulting settings as a whole.
  - **IP check** (FR-042): an editable section with one switch, the explanation naming
    `ipv4.mailcow.email` and `ipv6.mailcow.email`, and a link to UI 011's dashboard.
  - **License** (FR-077, FR-078): GUID with copy, or "marked invalid by mailcow"; the last result
    (`valid`, `invalid`, `unreachable`, `neverVerified`) in text with customer ID, service ID and
    support level when known. "Verify now" explains first that only the GUID is sent to the mailcow
    license service, shows progress, and announces the new result; `unreachable` is a result, not
    an error. The response replaces the cached status.
- **Rationale**: The requirements named; conventions "Secrets" (write-only fields start empty).
- **Alternatives considered**: A repeat field for the password (legacy) was rejected by the spec's
  parity table.

### R26. Entry lists (copy recipients, origins, pasted addresses)

- **Decision**: The tag editor of UI 002 (FR-039 there) is extended, keeping its behaviour, with
  props `validateEntry(value) → ruleCode | null`, `normalise(value)` (for example lower case for
  origins), `max` and `splitPattern` (default `/[\s,;]+/`). Pasting text with several separators
  creates one entry per item; entries that differ only in letter case are kept once with the first
  spelling (FR-052); each invalid entry is marked in text with its reason and blocks saving; the
  remove buttons are 44 px targets labelled with the entry. `src/shared/validation/entry-list.ts`
  holds the split and dedupe logic with its unit test.
- **Rationale**: FR-052, FR-075, FR-081 name UI 002's behaviour.
- **Alternatives considered**: A textarea with one address per line (legacy) was rejected: it cannot
  mark one entry.

### R27. Entry points into earlier screens, and History

- **Decision**:
  - **Quota notification copies** (FR-051 to FR-053): `QuotaCopiesSection.vue`, exported from
    `@/features/system-settings`, is placed in UI 002's domain page in its designated section area,
    shown to administrators and to domain administrators of that domain (the domain page is already
    scoped). It edits `recipients` (tag editor, R26) and `active`, explains that each copy is a
    separate message whose subject ends with the mailbox name in parentheses, and that copies without
    recipients stay inactive. A `404` says the domain is no longer available. Its History action is
    rendered only for administrators (US12-AS4).
  - **Sieve presets** (FR-062): `PresetPicker kind="sieve"` is added to UI 005's create-filter form
    as "Insert example", for every caller UI 005 lets create filters.
  - **Quota notifications page** links to UI 002's domain list for administrators (FR-050).
  - **History** (FR-091): `SettingsPageHeader.vue` renders UI 002's `HistoryLink` from the
    catalogue's `auditTarget`; rule, map and job pages add the target ID (rule ID, map file name,
    job ID); the quota copies section uses `quotaNotificationRecipients` with the domain. The audit
    log screen of UI 001 gains labels for the 21 event types and 17 target types of this feature
    (data-model §11), the failure reasons `demoMode`, `featureDisabled`, `fileUnavailable`,
    `serviceFailure` and `outcomeUnknown`, and detail formatters in
    `src/features/audit-log/details/system-settings.ts`: changed values as old → new in the user's
    language; templates, maps, rules, scripts, help text and footer as "changed" with old and new
    binary sizes; logos with type, dimensions and size; the Rspamd password only as "changed"; the
    Dovecot restart outcome and the Rspamd confirmation. Unknown keys fall back to UI 001's generic
    details list.
- **Rationale**: Conventions "Where features meet" and "History and audit"; the API's audit `details`
  (API data model §7).
- **Alternatives considered**: An extension registry in `src/app/` for domain page sections was
  rejected for 013 alone: it is UI 002's decision whether its section area is a slot or a registry,
  and 013 follows it.

---

## 8. Translations, accessibility, testing and performance

### R28. Translations

> **Superseded in part by constitution IV 1.3.0** (owner rule, 2026-10-18; `docs/conventions.md`,
> "Translations and forms"; plan, "Translations and forms (constitution IV 1.3.0)"). There is no
> build-time import, no `legacy-map.json` aliasing, no stripped markup and no hand-written value
> for a legacy key. The items below are corrected in place.

- **Decision**:
  - Namespace `systemSettings.*` (data-model §8 lists the key groups) for new strings only, plus
    additions to `problem.*`, `validation.*`, `auditLog.*` and `nav.system`. Where a planned new
    string has a legacy equivalent in T008a's form map, the legacy key is used instead.
  - **Legacy keys used verbatim** by their legacy name, through UI 001's legacy translation layer
    (runtime `/lang/` loader, `en-gb` snapshot, formatter): the keys of the spec's Assumptions,
    including those that name the product (`admin.main_name`, `admin.title_name`,
    `admin.apps_name`, `admin.force_sso`, shown as the installation's files have them) and those
    with markup (`admin.ip_check_opt_in`, `admin.rspamd_com_settings`, `admin.merged_vars_hint`,
    `admin.license_info`, `admin.reset_password_vars`, rendered through `SanitizedHtml.vue`).
    `admin.ui_header_announcement_content` ("HTML allowed"), the vendor links of
    `admin.license_info` and the restart link of `admin.rspamd_global_filters_regex` are plan
    "Deviations needing a decision" items 4, 6 and 7.
  - **Placeholders**: `%d` is substituted like `%s` by UI 001's formatter (needed for
    `admin.password_policy_length`); T004 and T005 verify it and add it there if missing. There is no
    importer extension.
  - **Keys missing from the upstream sk-sk file** (for example `admin.login_page`,
    `admin.app_hide`, `admin.cors_settings`, `admin.password_reset_settings`,
    `success.custom_login_modified`) fall back to `en-gb`, as in the classic interface. The FeldHost
    fork's `sk-sk` file has them. Nothing is written by hand.
  - **Messages**: API outcomes, problem types and rule codes map to the legacy `success.*`,
    `warning.*` and `danger.*` keys of the functions listed in the plan (for example
    `sieveSyntax` → `danger.sieve_error` with the parser message, a refused CORS origin →
    `danger.cors_invalid_origin`), and to new strings only where legacy has none.
  - **Presets**: the headlines use the legacy keys `admin.rsettings_preset_<n>` and
    `mailbox.sieve_preset_<n>` directly (R19).
  - **Wording**: "the classic interface" / "klasické rozhraní" / "klasické rozhranie"; plural forms
    for counts ("Send to {count} mailboxes").
  - **Sizes** in binary units, numbers, ratios and times through UI 001's `format.ts` (FR-105).
- **Rationale**: Constitution IV; FR-103, FR-104.
- **Alternatives considered**: Copying legacy strings by hand was rejected (001-R15). A build-time
  import with stripped markup (the first version of this decision) is forbidden by constitution IV
  1.3.0.

### R29. Accessibility specifics

- **Decision**: In addition to 001-R21:
  - focus: page and step headings on open; section headings from search results (R6); the error
    summary on a failed submission; dialogs return focus (FR-101);
  - status: contrast verdicts, line marks, entry validity, job status, outcome counts and the bar all
    have text (FR-099); announcements never move focus and job progress is throttled (FR-100);
  - status messages stay while focused or hovered (FR-093): outcome messages are inline status
    regions that persist until the next action, not auto-dismissing toasts;
  - touch targets ≥ 44 px, including reorder, entry removal, editor actions and gutter-mark buttons
    (FR-095);
  - inputs: `type="email"` for addresses, `type="url"` with `inputmode="url"` for links,
    `inputmode="numeric"` for the policy length, and `autocapitalize="off"`, `autocorrect="off"` for
    addresses, origins, links, colours and hex values (FR-096);
  - app link reordering uses "Move up" and "Move down" buttons labelled with the link name, and
    announces the new position (FR-040).
- **Rationale**: FR-093 to FR-102; constitution III.

### R30. Mock API for this feature

- **Decision**:
  - One handler file per contract module (001-R22): `settings-server.ts`, `settings-branding.ts`,
    `settings-password.ts`, `settings-quota-notifications.ts`, `settings-rspamd.ts`,
    `settings-global-filters.ts`, `presets.ts`, `mass-mail.ts`, `license.ts`, plus the PATCH in UI
    003's `password-policy.ts`. They work on a settings store in the scenario state: values, strong
    `etag`s that change on every write, demo mode, license switch, map files (available or not),
    Sieve files, a container-service switch for restarts and the Rspamd password, and mass mail
    jobs.
  - The public configuration handler derives `brandColors`, logos, texts, login page options and
    app links from that store, so the shell reacts to saves in end-to-end tests.
  - `replaceLogo` classifies the bytes like the API (signatures; SVG with `<script`, `on…=` or
    `javascript:` refused as `unsafeSvgContent`), checks the scenario limits, and stores the bytes
    for `getPublicConfigLogo`.
  - The contract validator (`tests/mocks/contract/validator.ts`) accepts binary request bodies: for
    a non-JSON documented media type it checks only that the media type is documented.
  - Mass mail jobs progress deterministically: each `getMassMailJob` advances a running job by the
    scenario's step (default 20 recipients), and `PATCH /__mock/scenarios/:id` can set counts or
    complete a job. Count changes after a preview are simulated by `{ addReceivingMailbox: true }`.
  - Validate-only requests apply the same checks and never change state; the mock implements the
    structure check, the regex line rules and a small Sieve check (missing semicolon) good enough
    for the scenarios.
  - Fixtures: `tests/fixtures/logos/` (300 × 80 PNG, JPEG, animated GIF, SVG with and without
    size, SVG with script, a PDF named `logo.png`, an oversized PNG generated at test time) and
    `tests/fixtures/email/hostile.html`.
- **Rationale**: Constitution VI: every mocked request and response is validated against the
  contract.

### R31. Tests

- **Decision**:
  - **Unit and component tests** (Vitest) for every pure module (`contrast`, `search`,
    `regex-lines`, `line-diff`, `logo-file`, `origin`, `app-link-url`, `email-html`,
    `email-samples`, `entry-list`, `selection`), the composables (`useSettingsSection`,
    `useJobRefresh`, `useMassMailCompose`, `useLogoCandidate`) and the
    main components, test-first. `src/shared/security/email-html.ts` falls under UI 001's 90 %
    coverage threshold for `src/shared/security`.
  - **End-to-end tests** of every acceptance scenario of US1–US12 on `mobile-chromium` (360 px),
    `desktop-chromium` and `mobile-webkit`, against the contract-validated mock, with
    `expectAccessible` (now including the limit-palette passes of R12) on every screen and state,
    the CSP and contract-violation checks, `expectNoHorizontalScroll` and `expectTouchTargets`. Test
    titles carry the spec IDs.
  - **Isolation test** for R21 in both engines (network log, dialog handler, CSP log).
  - **Responsiveness test** for R17: a 1 MiB map loads, and ten typed characters each appear in the
    textarea within 100 ms.
  - **Smoke tests** against the API dev stack (001-R25) that change nothing permanently or restore
    what they change: capabilities and overview; a UI text set and restored; a brand colour set and
    cleared, checked in the public configuration; a sign-in page option toggled back; a settings rule
    created, checked and deleted; a filter map and both Sieve filters checked with `validateOnly`
    only (no write, no restart); a mass mail preview without sending; CORS saved and restored; the
    IP check toggled back; the audit log filtered to these changes. The Rspamd password, sending mass
    mail and license verification are not smoke-tested: they restart a container, deliver mail or
    contact an external service.
- **Rationale**: Constitution VI; 001-R22 to 001-R25.

### R32. Performance

- **Decision**: Every settings page, the editor and the e-mail preview are lazy chunks; the entry
  chunk gains only `brand-colors.ts` and the accent token rules (well under 2 KB gzipped). The
  overview needs only the capabilities. Lighthouse CI gains a collection for `/ng/system/ui-texts`
  with an administrator scenario (`run-lhci.mjs`, 001-R26), so constitution VII is measured on a
  settings form too.
- **Rationale**: Constitution VII; SC-014.
