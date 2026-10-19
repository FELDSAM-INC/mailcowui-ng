<!--
Sync Impact Report (1.4.0)
- Version change: 1.3.0 → 1.4.0 (MINOR: a new, owner-approved exception)
- Modified: I (one request to another origin) and Technology & Architecture Constraints (the
  haveibeenpwned range query, its CSP `connect-src` entry and its k-anonymity limits).
- Governance: the owner decisions on haveibeenpwned and on OAuth2 secrets are recorded.
- Templates: no change. `docs/conventions.md` describes the check and the secret rule.

Sync Impact Report (1.3.0)
- Version change: 1.2.1 → 1.3.0 (MINOR: materially expanded guidance in principle IV)
- Modified principles:
  - IV. Internationalisation & Branding (title unchanged): English, Czech and Slovak as the only
    required languages, and the reuse of legacy keys "where the meaning is unchanged", are replaced
    by the owner rule of 2026-10-18: every language mailcow ships; mailcow's own translations used
    verbatim, loaded at runtime from the installation's `/lang/lang.<code>.json`, with a bundled
    upstream `en-gb` snapshot (2026-09a) for key checks and as the fallback; forms 1:1 with the
    classic interface; minimal new strings in en, cs and sk, never machine-translated. "Missing
    keys fail CI" is kept for new strings in en, cs and sk and for the legacy keys the app uses.
- Other changed sections:
  - I. The API Contract Is the Only Interface: clarified that reading mailcow's static
    `/lang/lang.<code>.json` files is the one allowed non-API request (principle IV).
  - Technology & Architecture Constraints: vue-i18n carries the app's own strings; legacy texts
    use a small CSP-safe placeholder formatter.
  - Development Workflow & Quality Gates: translation completeness gate rewritten; a feature's
    definition of done includes its legacy form map.
  - Governance: owner decision on translations and forms recorded (added in 1.3.0).
- Added sections: none. Removed sections: none.
- Templates: `.specify/templates/*.md` are generic and need no change. `docs/conventions.md`
  gains "Translations and forms (owner rule, 2026-10-18)". `CLAUDE.md` is aligned.
- Follow-up TODOs:
  - UI 001 (research R15: build-time import, glyph stripping, refusing HTML, the
    en/cs/sk-only language set, the `i18n:check` rules) and UI 002 are amended by the
    orchestrator after their worktrees merge.
  - UI 003–014 plans are aligned in the same change.
-->
# mailcowui-ng Constitution

mailcowui-ng is the new mobile-first web app for mailcow-dockerized, used by administrators,
domain administrators and mailbox users. It is a static Vue single-page application. Its only
backend is mailcow REST API v2 (separate repository `mailcow-rest-v2`), and it replaces the
legacy Twig/jQuery UI feature by feature.

## Core Principles

### I. The API Contract Is the Only Interface (NON-NEGOTIABLE)

- The app talks exclusively to mailcow REST API v2 through operations in that API's released
  OpenAPI contract. It MUST NOT use legacy `/api/v1`, legacy PHP pages or undocumented
  endpoints. The one exception is mailcow's static language files, `/lang/lang.<code>.json`,
  which the app reads as plain files from the same origin (principle IV). They carry only
  translations, never data or actions. The haveibeenpwned range query is the only request to
  another origin (principle V, owner decision of 2026-10-18).
- The pinned contract version is recorded in the repository. API types and the HTTP client are
  generated from it, and hand-written request or response types for API data are forbidden.
- Bumping the contract version is a deliberate change: regenerate the client, fix type errors,
  run all tests.
- When a feature needs something the API does not offer, the gap is specified in mailcow-rest-v2
  first. The UI never works around it.
- Errors are handled from RFC 9457 problem details: field errors from `errors` are shown on the
  matching form fields, and known `type` URIs drive specific UI behaviour.

### II. Mobile-First, Responsive Design

- Every screen is designed and tested first at a 360 px wide viewport with touch input, then
  enhanced for tablet and desktop.
- Primary content never needs horizontal scrolling. Collections render as lists or cards on
  small screens and may become tables on wide screens.
- Touch targets are at least 44×44 CSS px. Pinch-zoom is never disabled.
- Long forms are split into sections or steps, not giant modals. Destructive actions need
  explicit confirmation and show what will be affected.
- Every collection view has defined loading, empty and error states.

### III. Accessibility (WCAG 2.2 AA)

- WCAG 2.2 level AA is the minimum: full keyboard operation, visible focus, sufficient contrast
  in both themes, programmatically labelled controls, and status messages announced to screen
  readers.
- Light, dark and system themes are supported.
- Automated accessibility checks run on every screen in end-to-end tests. A new violation fails
  the build.

### IV. Internationalisation & Branding

mailcow's translations were written by people, not machines. The app uses them one to one, and
its forms mirror the classic interface's forms (owner rule, 2026-10-18). The rules every feature
follows are in `docs/conventions.md`, "Translations and forms".

- **Every mailcow language.** The app supports every language mailcow ships, the 33
  `data/web/lang/lang.<code>.json` files, and keeps mailcow's codes (`en-gb`, `cs-cz`, `sk-sk`
  and so on) as locale identifiers. It offers the server's `languages` from `GET /public-config`
  intersected with these.
- **Legacy translations are verbatim and come from the installation.**
  - All user-facing text comes from translation files. Text with a classic-interface equivalent
    comes from mailcow's own language files, loaded at runtime from the installation's
    `/lang/lang.<code>.json` on the same origin. The app shows exactly what that installation's
    classic interface shows, including a fork's wording and an operator's changes.
  - A snapshot of upstream `en-gb` (baseline `2026-09a`) is bundled to type-check the legacy keys
    the app uses, and as the fallback when `/lang/` cannot be loaded. A key missing in the
    selected language falls back to `en-gb`, as the classic interface does.
  - Legacy text is never changed: no rewording, no stripped glyphs, no trimming. Only `%s` and
    `%d` placeholders are converted, mechanically. Values that contain HTML are rendered through
    the app's sanitiser with a small allowlist, never altered.
  - Legacy strings are formatted by a small CSP-safe formatter (plain placeholder substitution).
    vue-i18n never compiles them.
- **Forms are one to one.** Every screen with a classic-interface counterpart mirrors that form:
  - the same fields, with the same labels, help and info texts, placeholders, option labels,
    units, order and grouping (legacy tabs become sections);
  - the same success, warning and danger messages, through legacy's `success.*`, `warning.*` and
    `danger.*` keys wherever the meaning matches, mapped from API outcomes, problem types and
    validation rule codes;
  - legacy keys for table column headers and action labels.

  The app's design system and layout stay, and so do its improvements (sections with their own
  save, typed confirmations, bulk mode, version conflicts). They use legacy strings wherever an
  equivalent exists. Each plan records the legacy form map.
- **New strings are minimal.** They exist only for elements the classic interface does not
  have. They are written in English, Czech and Slovak (the owner reviews Czech and Slovak), and
  every other language falls back to English. Text is never machine-translated.
- **Missing keys fail CI**: a new string missing in en, cs or sk, or a legacy key the app uses
  that the `en-gb` snapshot does not contain.
- Dates, numbers and sizes are formatted with the user's locale.
- Product name, logo, colours, links and login texts come from the API's branding
  configuration at runtime. Nothing brand-specific is hard-coded in the app's code or its own
  strings. Legacy texts that name the product are shown as the installation's files have them.

### V. Security in the Browser

- The app is served from the same origin as the API and authenticates with the API's session
  cookie and CSRF token. Credentials, session tokens and API keys are never stored in
  `localStorage`, `sessionStorage` or IndexedDB.
- A strict Content-Security-Policy without inline scripts or styles is compatible with the
  build. API data is never rendered as raw HTML (`v-html`) unless it is sanitised first.
- Hiding a control is a convenience, never access control. The UI follows the role and ACL flags
  the API reports, and it handles 401, 403 and 404 gracefully.
- Dependencies are pinned through the lockfile and scanned for known vulnerabilities in CI.

### VI. Test-First (NON-NEGOTIABLE)

- Tests are written first and observed failing before implementation.
- Required layers:
  - Unit and component tests for logic and components.
  - End-to-end browser tests of every user story, on a mobile (360 px) and a desktop viewport,
    against a mock API generated from the pinned contract.
  - A smoke suite of end-to-end tests against a real mailcow-rest-v2 instance.
- Mocked responses are validated against the contract, so tests cannot pass on data the API
  could never return.

### VII. Performance Budgets

- Lighthouse mobile scores are at least 80 for performance and at least 90 for accessibility.
- The initial JavaScript payload is at most 200 KB gzipped. Routes are lazy-loaded.
- Server state is cached and invalidated after mutations. A screen never refetches what it
  already has without reason.

### VIII. Simplicity

- Prefer Vue's built-in features and a small number of mature libraries. Every new runtime
  dependency is justified in the plan that introduces it.
- Build only what a current feature spec needs. Shared components appear after the second
  concrete use.
- Deviations from a principle are recorded in the plan's Complexity Tracking table, together
  with the simpler alternative that was rejected.

## Technology & Architecture Constraints

- **Stack**:
  - Vue 3 with the Composition API and `<script setup>`, TypeScript in strict mode, Vite.
  - Vue Router for routing.
  - A query cache (TanStack Vue Query) for server state. Pinia only for the little client state
    that remains.
  - vue-i18n for the app's own strings. Legacy texts use a small CSP-safe placeholder formatter
    (principle IV).
  - A client generated from the OpenAPI contract.
  - The visual base and UI primitives come from **TailAdmin Vue Free** (MIT,
    `github.com/TailAdmin/vue-tailwind-admin-dashboard`). Its `components/ui` primitives are
    built on Reka UI and Tailwind CSS v4.
  - TailAdmin is a template, not a dependency. Copy in only the layout shell and the primitives
    a feature needs. Record the source version, and keep the MIT notice, in
    `THIRD_PARTY_NOTICES.md`.
  - TailAdmin **Pro** code or assets are never used, because they are under a commercial
    licence.
  - Demo-only parts are not copied unless a feature spec needs them: sample pages, brand logos,
    calendar, maps, carousel, date picker and charts. Charts are lazy-loaded on their route.
- Fonts and icons are self-hosted. The app makes no requests to third-party CDNs, for CSP,
  privacy (GDPR) and offline installations. The single third-party request is the haveibeenpwned
  password check that the classic interface also makes. It runs only when the user clicks the
  check, and it sends only the first five hex characters of the password's SHA-1
  (`https://api.pwnedpasswords.com/range/<prefix>`). The CSP allows `connect-src` to that origin
  and to no other.
- **No server-side rendering and no backend code** in this repository. The build output is
  static files.
- **Deployment**: the static build is served next to mailcow-rest-v2 on the same origin. That
  means either the nginx-mailcow container via an include or a small static image added to
  mailcow-dockerized via `docker-compose.override.yml`. Upstream mailcow files are never
  patched.
- **Supported browsers**: the two latest major versions of evergreen browsers, including mobile
  Safari and Chrome for Android.

## Development Workflow & Quality Gates

- Work follows Spec Kit: `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` →
  `/speckit-tasks` → `/speckit-analyze` → `/speckit-implement`, one spec per feature in
  `specs/NNN-*/`.
- Each UI feature names the mailcow-rest-v2 feature and contract version it depends on. It can
  start once that contract is merged and does not need to wait for the API implementation.
- A merge requires all of these to pass in CI:
  - lint, type checks, and unit/component tests
  - end-to-end tests on both viewports, with accessibility checks
  - performance budgets
  - translation completeness: every new string in en, cs and sk, and every legacy key the app
    uses present in the bundled `en-gb` snapshot
  - dependency vulnerability scan
- A feature is done when its legacy screens are matched or improved, the parity notes are in the
  spec, and its legacy form map is in the plan.
- **Git**: commit directly to `main`, with no feature branches and no pull requests. Parallel implementation
  may use short-lived local git worktrees on temporary local branches (`wt/NNN`), each rebased onto
  `main` and fast-forwarded when its gates are green, then deleted. Such branches are never pushed,
  and there are still no pull requests. The Spec Kit
  `before_specify` branch hook is disabled, but spec directories keep the `specs/NNN-feature-name`
  numbering. Commit subjects are short and imperative.
- **License**: GPL-3.0, the same as mailcow and mailcow-rest-v2. Every dependency, including
  bundled fonts and icons, must be GPL-3.0-compatible.

## Governance

- This constitution supersedes other practices. Each plan has a Constitution Check that reviewers
  verify.
- Amendments are made through `/speckit-constitution` and must cite an owner decision or a
  detected convention. Versioning follows semver: MAJOR for removing or redefining a principle,
  MINOR for new or materially expanded guidance, PATCH for clarifications.
- Owner decisions on 2026-10-18:
  - Vue.js for the UI.
  - The API (Laravel, repository `mailcow-rest-v2`) and this app live in separate repositories.
  - GPL-3.0 for both repositories, and commits go directly to `main` (added in 1.1.0).
  - Short-lived local worktree branches for parallel implementation, never pushed (added in
    1.2.1).
  - TailAdmin Vue Free as the visual base (added in 1.2.0).
  - mailcow's translations one to one, in every language mailcow ships, and forms one to one
    with the classic interface; new strings only where the classic interface has no equivalent,
    in en, cs and sk, never machine-translated (added in 1.3.0).
  - The classic interface's haveibeenpwned password check is kept. Stored OAuth2 client secrets
    are shown only once, at creation or renewal (added in 1.4.0).
- Owner decision on 2026-10-19: lower the Lighthouse mobile performance threshold from 90 to
  80 because 90 is too strict for the current release. Accessibility remains at least 90, and
  the 200 KB initial JavaScript budget and mobile test conditions remain unchanged (2.0.0).
- Agent runtime guidance lives in `CLAUDE.md` and MUST NOT contradict this document.

**Version**: 2.0.0 | **Ratified**: 2026-10-18 | **Last Amended**: 2026-10-19
