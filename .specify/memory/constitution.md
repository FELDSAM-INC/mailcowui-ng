# mailcowui-ng Constitution

mailcowui-ng is the new mobile-first web app for mailcow-dockerized, used by administrators,
domain administrators and mailbox users. It is a static Vue single-page application. Its only
backend is mailcow REST API v2 (separate repository `mailcow-rest-v2`), and it replaces the
legacy Twig/jQuery UI feature by feature.

## Core Principles

### I. The API Contract Is the Only Interface (NON-NEGOTIABLE)

- The app talks exclusively to mailcow REST API v2 through operations in that API's released
  OpenAPI contract. It MUST NOT use legacy `/api/v1`, legacy PHP pages or undocumented
  endpoints.
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

- All user-facing text comes from translation files. English, Czech and Slovak are required for
  every release, and missing keys fail CI.
- Legacy `lang.*.json` keys are reused where the meaning is unchanged, so existing translations
  carry over.
- Dates, numbers and sizes are formatted with the user's locale.
- Product name, logo, colours, links and login texts come from the API's branding
  configuration at runtime. Nothing brand-specific is hard-coded.

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

- Lighthouse mobile scores are at least 90 for performance and accessibility.
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
  - vue-i18n for translations.
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
  privacy (GDPR) and offline installations.
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
  - translation completeness for en, cs and sk
  - dependency vulnerability scan
- A feature is done when its legacy screens are matched or improved, and the parity notes are
  in the spec.
- **Git**: commit directly to `main`, with no feature branches and no pull requests. The Spec Kit
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
  - TailAdmin Vue Free as the visual base (added in 1.2.0).
- Agent runtime guidance lives in `CLAUDE.md` and MUST NOT contradict this document.

**Version**: 1.2.0 | **Ratified**: 2026-10-18 | **Last Amended**: 2026-10-18
