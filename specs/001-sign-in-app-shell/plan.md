# Implementation Plan: Sign-in, Application Shell, Passkeys and API Keys

**Branch**: `main` (no feature branches, constitution 1.1.0) | **Date**: 2026-10-18 |
**Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-sign-in-app-shell/spec.md`

## Summary

UI feature 001 creates mailcowui-ng from an empty repository. Later features build on it. It
delivers:

- **sign-in**, with these parts:
  - passkey sign-in, offered first and in autofill;
  - username and password sign-in with the second-factor step;
  - role-specific screens;
  - the force-SSO and identity-provider notices;
  - throttling;
- **the session lifecycle**: CSRF bootstrap and retry, the idle warning, restricted sessions,
  sign-out and cross-tab coherence;
- **the application shell**: header, navigation drawer, user and apps menus, announcement,
  sanitised footer, and a navigation catalogue with placeholders and "no access";
- **own passkey management**: list, add, rename and remove;
- **language and theme preferences**, synced to the profile;
- **API key management**: list, filter, create with a one-time secret, inspect and revoke;
- **the authentication audit log**.

The technical approach (details in [research.md](./research.md)):

- **Stack**: Vue 3.5 `<script setup>`, strict TypeScript 5.9 and Vite 8. Vue Router 5 with an
  explicit route map under the base `/ng/`. TanStack Vue Query for all server state, and two small
  Pinia stores for client state. vue-i18n 11 with precompiled messages. Tailwind v4 and Reka UI
  primitives copied from TailAdmin Vue Free 2.5.0 (`94ebe1b`). Ten runtime dependencies in total
  (R1).
- **Contract**: mailcow-rest-v2 contract `0.1.0` is vendored as a checksummed bundle in
  `contract/` (R6). `openapi-typescript` generates the types and `openapi-fetch` is the client.
  Generated types sit behind `@/api` (R7). CSRF tokens live in memory, with one silent retry (R8).
- **Session**: a session state machine in the router guard (R11). The idle warning is computed
  from the last request in any tab, through BroadcastChannel, and the app never polls (R12).
  WebAuthn uses the native Level 3 JSON methods with a small fallback codec and a single abort
  controller (R14).
- **Security**: a strict CSP with no inline code or style. It is enforced in every end-to-end
  test against the production build (R18). Operator HTML is sanitised with DOMPurify, and app
  link URLs are checked (R17).
- **Tests**: Vitest and Vue Test Utils for units and components. Playwright on a 360 px and a
  desktop viewport (plus mobile WebKit) with axe in both themes, against a Node mock server that
  reuses MSW handlers and validates every request and response against the contract with Ajv
  (R22, R24). A smoke suite runs against the API's Docker dev stack with this image attached as
  `ng-mailcow` (R25). Lighthouse CI and a bundle budget script complete the gates (R26).
- **Deployment**: a non-root, read-only `nginx-unprivileged` image serves the build under `/ng/`.
  mailcow-rest-v2's `site.restv2.custom` proxies `/ng/` to it on the same origin (R29).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict) and Vue 3.5 SFCs; Node.js 24 LTS for tooling and
builds.

**Primary Dependencies** (runtime, exact versions in R1): `vue` 3.5.44, `vue-router` 5.4.0,
`@tanstack/vue-query` 5.104.4, `pinia` 4.1.0, `vue-i18n` 11.4.16, `reka-ui` 2.11.0, `clsx` 2.1.1,
`tailwind-merge` 3.7.0, `openapi-fetch` 0.17.0, `dompurify` 3.4.17. Build and test tooling is in
R2: Vite 8.3.4, Tailwind 4.3.3, `openapi-typescript` 7.13.0, `@redocly/cli` 2.64.1, MSW 3.0.3,
Ajv 8.20, Vitest 5.0.5, `@vue/test-utils` 2.5.1, Playwright 1.64.1, `@axe-core/playwright` 4.14.0,
`@lhci/cli` 0.15.1 and ESLint 10.

**Storage**: none on a server. In the browser: the in-memory query cache and Pinia. Device
storage holds only conveniences: `localStorage` for the language and theme last applied and the
passkey suggestion dismissal, and `sessionStorage` for the collapsed announcement. Never
credentials (constitution V; data-model §4).

**Testing**:

- Vitest with jsdom and Vue Test Utils for units and components, in TDD order.
- Playwright end-to-end projects `mobile-chromium` (360 × 780), `desktop-chromium` (1366 × 900)
  and `mobile-webkit`, against the production build with the production CSP, served by
  `vite preview` with the mock API.
- In every test: axe checks in both themes, CSP violation detection, horizontal-scroll and
  touch-target checks, and zero mock contract violations.
- A smoke project against a real mailcow-rest-v2 dev stack.
- Lighthouse CI, the bundle budget, translation completeness, licence and audit checks.

**Target Platform**: The two latest major versions of evergreen browsers, including iOS Safari and
Chrome for Android. Static files are served by `nginxinc/nginx-unprivileged:1.28-alpine` as the
`ng-mailcow` container, reached on the mailcow host's origin under `/ng/`.

**Project Type**: web application. The repository is a static single-page frontend; the backend is
the separate mailcow-rest-v2 repository.

**Performance Goals**: Lighthouse mobile scores of at least 80 for performance and 90 for accessibility.
Initial JavaScript of at most 200 KB gzipped, with lazy routes. The sign-in screen usable within
3 s on a mid-range phone (SC-008). A language or theme change applied in under 1 s (SC-012).

**Constraints**:

- Strict CSP with no inline script or style.
- No third-party requests; fonts and icons are self-hosted or none.
- WCAG 2.2 AA in both themes.
- Usable at 360 px and 320 px, and at 400 % zoom.
- Same-origin cookie session with an in-memory CSRF token.
- No automatic requests while idle.
- Only contract operations are used.
- Every dependency is GPL-3.0-compatible and pinned by the lockfile.
- No brand-specific text, colour or logo in the source.

**Scale/Scope**:

- 8 user stories (5 at P1, 2 at P2, 1 at P3).
- 14 routes, plus 13 placeholder sections from the navigation catalogue.
- 25 of the contract's 31 operations.
- 33 locales (mailcow's languages); new strings in 3 of them.
- About 350 new strings, plus about 70 legacy keys used directly.
- The foundation for 13 later UI features.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Gate | Status |
|---|---|---|
| I. The API contract is the only interface | Only contract operations are used. A request matching no operation is a mock violation (R22), and FR-093 is tested. The pinned version is recorded in `contract/VERSION.json` with a checksum (R6). Types and client are generated (`openapi-typescript`, `openapi-fetch`), generated files are guarded by `contract:check`, and they are importable only via `@/api`. No hand-written API types (R7). A bump is a script plus typecheck and tests. Gaps are reported to mailcow-rest-v2 and never worked around (see "API dependency and gaps"). Errors are handled from problem `type` and `errors` (R8, R15). | PASS |
| II. Mobile-first | Every screen is designed and tested at 360 px first (the `mobile-chromium` and `mobile-webkit` projects), with horizontal-scroll checks at 360 and 320 px and 44 × 44 targets (R21, R24). Lists are cards below `md` and tables above. Long forms are split into sections; the key form is its own page, not a modal. Destructive actions are confirmed with their impact. Every collection has loading, empty and error states (`ListState`). Pinch-zoom is allowed. | PASS |
| III. Accessibility (WCAG 2.2 AA) | axe with the WCAG 2.2 AA tags runs on every screen and state, in light and dark (R24); a violation fails the test. The rules of R21 cover keyboard, focus, live regions, the skip link, labels and non-colour status. There are three themes, `light`, `dark` and `system` (R16). | PASS |
| IV. i18n and branding | Amended for 1.3.0: the 33 mailcow languages; mailcow's own strings loaded verbatim at runtime from the installation's `/lang/`, with the bundled upstream en-gb snapshot for key types and as the fallback; new strings only where legacy has none, in en-gb, cs-cz and sk-sk; the legacy form map below (R15). `i18n:check` fails on an incomplete or unused new string, a missing contract enumeration key, or a legacy key the snapshot lacks, and lists new strings that repeat a legacy text (R27). `Intl` formatting uses the user's locale. Product name, logos, texts, links and announcement come from `GET /public-config`. Nothing brand-specific is in the source. Colours stay at the defaults until API 013 (FR-004), recorded under Complexity Tracking. | PASS (deviation recorded) |
| V. Security in the browser | Same-origin session cookie. The CSRF token is in memory only (R8). Storage holds only the conveniences listed in data-model §4, verified by a unit test. A strict CSP is enforced in the end-to-end tests and on the image (R18). `v-html` appears only in `SanitizedHtml` behind DOMPurify (R17). Hiding is a convenience: "no access" is rendered in place, and 401, 403 and 404 are handled (R11, R19). Lockfile pinning, `npm audit` and a licence allowlist run in CI (R27). | PASS |
| VI. Test-first | `tasks.md` puts tests before implementation in every phase. Unit and component tests; end-to-end tests of every acceptance scenario on both viewports, against a mock generated from the contract whose requests and responses are validated against it (R22). The two scenarios whose data the pinned contract cannot produce (US8-AS3, and audit records with later event types) are unit-tested instead, so the mock never contradicts the contract (R24); a smoke suite against the real API (R25). | PASS (see Complexity Tracking for the smoke gate) |
| VII. Performance budgets | `budget:check` caps the initial JS at 200 KB gzipped from the Vite manifest. Lighthouse CI asserts performance of at least 0.8 and accessibility of at least 0.9 (R26). Every route, including sign-in, is lazy-loaded (R19). The query policy forbids refetching without reason and invalidates after mutations (R9). | PASS |
| VIII. Simplicity | Ten runtime dependencies, each justified (R1). Shared components exist only with two uses in this feature; single-use patterns stay in the feature with a recorded promotion path, and later patterns have reserved locations (R20). No date, form, icon or WebAuthn library. | PASS |
| Technology constraints | The stack is exactly as listed. TailAdmin Vue Free is copied in at a pinned version, with the MIT notice in `THIRD_PARTY_NOTICES.md`. No Pro code or demo parts (R4). Fonts and icons make no CDN request: a system font stack and inline SVG (R5). No SSR and no backend code. Deployment is a static image beside mailcow-rest-v2 via `docker-compose.override.yml`, on the same origin, with no upstream file patched (R29). | PASS |
| Workflow and gates | CI jobs map to every merge gate: lint, types, unit; end-to-end on both viewports with a11y; budgets; translations; vulnerability scan (R28). Commits go to `main`. Licence: GPL-3.0, with every dependency compatible. | PASS |
| `docs/conventions.md` | Wording ("the classic interface", "passkeys"). List state in the address, page sizes 25/50/100, cards and tables, list states (`useListState`). Outdated saves keep the input and reload (`useVersionedSave`); preferences follow FR-059 and the spec's edge case (R20). Confirmations. Secrets shown once, never stored. Problem types and rule codes translated. Controls hidden or read-only by permission. Bulk actions and History are reserved for the features whose contract offers them (R20). | PASS |

**Post-design re-check (after Phase 1)**: PASS. The data model, contracts README and quickstart
introduce no violation. Decisions that touched gates:

- The system font stack instead of TailAdmin's Outfit: V and the licence rule (R5).
- Native `<select>` instead of Reka `Select`, and Reka's style-injecting parts banned: V, CSP
  (R18).
- `refetchOnWindowFocus` off: FR-033 and VII (R9).
- Single-use patterns kept in the feature: VIII (R20).

## API dependency and gaps

This feature depends on **mailcow-rest-v2 feature 001**, pinned at commit
`293b7c293ec0b8d8bdf389b35fc1698fcf4d7ffa` (see [contracts/README.md](./contracts/README.md)).
The commit is the identifier: `info.version` stays `0.1.0` while later features' contracts are
merged into the same tree (R6). It covers every
behaviour the spec's "API Dependency" section lists, including `appLinks` with `appsLabel` and
`GET /api-keys/owner-candidates`. Gaps and observations:

1. **Audit target filters**: contract 0.1.0 has no `targetType` or `targetId` filter on
   `GET /audit-events`. `docs/conventions.md` (UI) needs them for the History action. The UI 001
   spec does not require them, and API feature 002 FR-058 already specifies them. **Action**: none
   for 001. The History link and the target filters are reserved (R20) and arrive with the
   contract bump that includes API 002.
2. **`/ng` without a trailing slash**: the API's planned `deploy/nginx/site.restv2.custom` matches
   `^~ /ng/` only, so `/ng` falls through to the legacy `@strip-ext` handler and answers 404.
   **Proposed to mailcow-rest-v2**: add `location = /ng { return 301 /ng/; }` to the snippet.
   Not blocking: links and the cutover use `/ng/`.
3. **URI passing**: the image serves under `/ng/` because the snippet's variable upstream
   (`proxy_pass http://$upstream;` with no URI part) forwards the original path. This is a
   coordination assumption that the smoke suite verifies (R25, R29).
4. **One passkey challenge per session**: two tabs on the sign-in screen invalidate each other's
   conditional challenge. This is accepted and handled by a silent restart (R14). No change is
   requested.
5. **`KnownProblemType` missing from the bundled contract**: the schema exists "so that generated
   clients get constants", but no operation or schema references it. Redocly's bundle, which is
   the API's release artifact, therefore leaves it out, and the generated client has no
   problem-type constants (verified at the baseline, R7).
   - **Proposed to mailcow-rest-v2**: list it under `components.schemas` in `api/openapi.yaml`.
     The same applies to every shared enumeration that later features append to.
   - **Not blocking for 001**: all 20 problem types of API 001 occur by name in the bundle's
     response descriptions. The translation check derives the required set from there (R27).
   - At runtime the app needs no list: messages are keyed by the type's last path segment, with a
     fallback.
   - The UI never copies the list by hand. Typed constants arrive with the first pin that contains
     the fix.

## Owner-level questions (defaults applied)

1. **Typeface**: TailAdmin uses Outfit, which is licensed under the SIL OFL 1.1. The FSF calls
   that licence GPL-incompatible, and the constitution requires GPL-3.0-compatible bundled fonts.
   **Default**: the system UI font stack, with no font files (R5). If the owner accepts OFL fonts
   as compatible for fonts, Outfit can be added via `@fontsource-variable/outfit` with no other
   change.
2. **Image registry and release tags**: **Default**: `ghcr.io/feldsam-inc/mailcowui-ng`, tagged
   from git tags `v*`. CI builds and checks the image; a publishing workflow is added with the
   first release.
3. **CI access to mailcow-rest-v2 for the smoke suite**: **Default**: a read-only token in the
   secret `MAILCOW_REST_V2_TOKEN`. Without it, the `smoke` job is skipped and the suite runs
   locally with `scripts/smoke/stack-up.sh`.
4. **Native review of new Czech and Slovak strings**: mailcow's own translations come from the
   installation, verbatim; new strings are written by the implementer. **Default**: the owner
   reviews the new cs-cz and sk-sk strings (`translation-review.md`) before the first release.
   `i18n:check` guarantees completeness, not wording.

## Parity notes added by the plan

The spec's parity table is complete. The plan adds:

1. Placeholder links to the classic interface point to pages, not tabs, because the classic
   interface has no hash-to-tab handling. The exact addresses are in research R19.
2. Classic app links with a `javascript:` or other non-http(s) address are not rendered, as a
   security fix (R17). Legacy renders them as links.

## Translations and forms (constitution IV 1.3.0)

Amended on 2026-10-18 for the owner rule (constitution 1.3.0, `docs/conventions.md`
"Translations and forms"). It replaces the build-time import of selected legacy keys (the former
`legacy-map.json` and `src/i18n/legacy/`). The mechanism is research R15; the checks are R27.

- **Languages**: the 33 mailcow languages, by mailcow's codes. The app offers the server's
  `languages` (from `GET /public-config`) that are among them, in the server's order and with the
  server's names, which are the labels of the classic language menu (`$AVAILABLE_LANGUAGES`).
  Without the public configuration it offers mailcow's default menu (`src/i18n/default-languages.ts`,
  a lazy chunk; FR-003).
- **mailcow's strings** come from the installation at runtime (`/lang/lang.<code>.json` merged over
  `lang.en-gb.json`), verbatim, through `lt()`, `<LegacyText>` and `legacy()` references. Values
  with markup go through the legacy sanitiser. The bundled upstream snapshot is a lazy chunk used
  only when `/lang/` cannot be loaded or lacks a key.
- **New strings** (vue-i18n, `src/i18n/messages/`) exist in en-gb, cs-cz and sk-sk; every other
  language shows their English text. `specs/001-sign-in-app-shell/translation-review.md` lists them
  for the owner.
- **Keys built at runtime** (problem types, statuses and enumeration values) that the classic
  interface has a text for resolve to it through `LEGACY_TEXTS` (`src/i18n/legacy-messages.ts`).

### Legacy form map

Paths are relative to `../mailhosting/data/web/` (FeldHost fork, upstream tag `2026-09a`). "New"
marks a new string, with the reason.

**1. Fields and elements**

| Screen (route) | Legacy counterpart | Element | Legacy key |
|---|---|---|---|
| Sign-in, role screens (`/sign-in/admin`, `/sign-in/domain-admin`, `/sign-in/mailbox-user`) | `admin_index.twig`, `domainadmin_index.twig`, `user_index.twig` card header | Heading and document title | `login.login_admin`, `login.login_dadmin`, `login.login_user` |
| Sign-in, role-neutral (`/sign-in`) | — (new screen) | Heading and document title | `login.login` (same meaning: "Login") |
| Sign-in | login card legend | Product name | branding `productName` (`ui_texts.main_name`) |
| Sign-in | `#login_user` | Username label | `login.username` (legacy's visually hidden label) |
| Sign-in | `#login_user` placeholder | Placeholder: role-neutral and mailbox-user screens / other screens | `login.email` / `login.username` |
| Sign-in | `#pass_user` | Password label and placeholder | `login.password` |
| Sign-in | show-password button | Accessible name | New `auth.signIn.showPassword`: legacy hard-codes "Toggle password visibility" (English equal to it) |
| Sign-in | submit | Button; busy state | `login.login`; `footer.loading` |
| Sign-in | `/reset-password` link (mailbox-user page) | Link, verbatim with its "> " | `login.forgot_password` |
| Sign-in | `login.other_logins` and the FIDO2 button | Passkey button, separator, waiting, choose again, failure | New `auth.passkey.*`: passkey wording and passkey-first order (owner decision) |
| Sign-in | IAM SSO button (`admin.iam_sso`) | Force-SSO notice title | `admin.iam_sso`; body and link new (`auth.signIn.sso.*`): the notice has no legacy counterpart |
| Sign-in | — | Identity-provider hint | New `auth.signIn.idpHint.*` (FR-008, no legacy counterpart) |
| Sign-in | "Not the correct login?" quick links | Label and links | `login.login_linkstext`, `login.login_admintext`, `login.login_domainadmintext`, `login.login_usertext`; "Sign in with any account" new (`auth.signIn.anyRole`, the role-neutral screen is new) |
| Sign-in | help card (`ui_texts.help_text`) | Disclosure toggle, collapsed as in legacy | `start.help`; the text is operator HTML |
| Sign-in | apps legend | Section heading | branding `appsLabel`, else `header.apps` |
| Sign-in | `login.delayed` | Throttling countdown and announcements | New `auth.signIn.throttle.*`: a retry time, not a delay (FR-017) |
| Sign-in | — | One-shot notices (signed out, session ended, timed out, second factor rejected or unavailable) | New `auth.notice.*` (FR-024, FR-025, FR-028, FR-034, FR-036) |
| Second factor (`/sign-in/second-factor`) | `modals/footer.twig` `#ConfirmTFAModal` | Heading, document title | `tfa.tfa` |
| Second factor | tabs (hard-coded "WebAuthn", "Yubi OTP", "Time-based OTP") | Method headings | `tfa.webauthn`, `tfa.totp`, `tfa.yubi_otp` (keys of the same meaning from the setup modals) |
| Second factor | `tfa.authenticators` legend | TOTP authenticator list; Yubico OTP field label | `tfa.authenticators` |
| Second factor | TOTP field placeholder "123456" | Placeholder | "123456" (digits, not text); the field label "Six-digit code" is new (`auth.secondFactor.totp.code`), legacy has none |
| Second factor | Yubi OTP placeholder "Touch Yubikey" (hard-coded) | Placeholder | New `auth.secondFactor.yubiOtp.placeholder`, English equal to legacy |
| Second factor | `login.login` buttons | TOTP and Yubico OTP submit | `login.login` |
| Second factor | — | WebAuthn start, waiting, unsupported | New `auth.secondFactor.webauthn.*` (passkey wording) |
| Second factor | — | Time left, one-minute warning, "Other methods" | New `auth.secondFactor.timeLeft`, `oneMinute`, `otherMethods` (FR-020, FR-025: the time limit and the grouping are the app's) |
| Second factor | modal close | Cancel | `footer.cancel` |
| Pending actions (`/pending-actions`) | — (two modals become one screen) | Heading, intro | New `auth.pendingActions.title`, `intro` |
| Pending actions | `#ChangePWModal` | Heading; first sentence | `user.change_password`; `user.pw_update_required` |
| Pending actions | — | "This app cannot change passwords yet…", link, "Check again", still pending | New `auth.pendingActions.password.*` (FR-040, FR-041: the change happens in the classic interface until UI 005) |
| Pending actions | `#SetupTFAModal` | Heading; first sentence | `tfa.setup_title`; `tfa.setup_required` |
| Pending actions | — | "A passkey counts as a second factor", register, after password, unsupported, classic link | New `auth.pendingActions.secondFactor.*` (passkey wording) |
| Pending actions | `tfa.cancel_setup` | Sign-out button | `tfa.cancel_setup` |
| Shell header (`base.twig` navbar) | `.navbar-toggler` aria-label "Toggle navigation" (hard-coded) | Drawer button | New `a11y.openNavigation`, English equal to legacy |
| Shell | logged-in user | User menu heading | `success.logged_in_as` with the username |
| Shell | apps menu (`ui_texts.apps_name`) | Label | branding `appsLabel`, else `header.apps` |
| Shell | — | User menu label, skip link, navigation landmarks, close, sign out, sign-out failure | New `a11y.*`, `common.signOut`, `shell.signOutFailed` (legacy has an icon only) |
| Shell | announcement alert | Type names | `admin.ui_header_announcement_type_info`, `_warning`, `_danger`; collapse and expand new (`shell.announcement.*`) |
| Navigation | menu entries | Domains, Mailboxes, User Settings, Quarantine, Spam filter, Administrators, Sync jobs | `mailbox.domains`, `mailbox.mailboxes`, `header.user_settings`, `header.quarantine`, `user.spamfilter`, `admin.admins`, `mailbox.sync_jobs` |
| Navigation | — | Home, Passkeys, API keys, Audit log, and the sections whose features map them (aliases, routing, DNS, operations, identity providers, system) | New `nav.*` until those features map them (conventions "Where features meet") |
| Placeholders | `base.twig` menu | Classic page links | the menu path: `header.email` › `header.mailcow_config` (mailbox page), `header.mailcow_system` › `header.mailcow_config` (system page), `header.mailcow_system` › `header.debug`, `header.email` › `queue.queue_manager`, `header.user_settings`, `header.quarantine` |
| Placeholders | — | "Comes later", "Use the classic interface", session note | New `states.placeholder.body`, `placeholder.*` |
| Language and theme | language dropdown (flags, `$AVAILABLE_LANGUAGES` labels) | Options | the server's language names; label "Language" new (legacy shows a flag only) |
| Language and theme | dark-mode switch (icon only) | Theme select | New `preferences.theme`, `themes.*` (three choices, FR-062) |
| API keys (`/api-keys`) | `admin/tab-config-admins.twig` `#admin_api` | Access levels | `admin.api_read_only`, `admin.api_read_write` (via `LEGACY_TEXTS`) |
| API keys | `admin.api_allow_from` | Allowed networks label | `admin.api_allow_from` |
| API keys | `admin.api_key` | Detail title | `admin.api_key` |
| API keys | — | Status "Active"; "Never Expire" | `admin.active`; `user.expire_never` |
| API keys | `admin.api_info` | Intro and docs link | New `apiKeys.intro`, `apiKeys.docs`: `admin.api_info` points to `/api` (API v1) and no longer fits |
| API keys | — | Named keys, owners, expiry, revocation, filters, sort, columns, one-time secret | New `apiKeys.*`, `secrets.*` (legacy has two fixed keys) |
| API keys | `footer.cancel`, `footer.loading` | Cancel, busy state | `footer.cancel`, `footer.loading` |
| Audit log (`/audit-log`) | `dashboard.twig` log tables (`js/site/dashboard.js`) | Time column | `admin.time` |
| Audit log | DataTables (`lang.datatables`) | Empty, no match, loading | `datatables.emptyTable`, `datatables.zeroRecords`, `datatables.loadingRecords` |
| Audit log | — | Outcome "Success"; target and method "API key", "Password" | `debug.success`; `admin.api_key`, `login.password` (via `LEGACY_TEXTS`) |
| Audit log | — | Other columns, filters, chips, details, event and failure labels | New `auditLog.*`, `enums.audit*` (no classic counterpart, conventions "History and audit") |
| Lists (shared) | DataTables | Entries shown; page size; previous, next | `datatables.info` (`_START_`, `_END_`, `_TOTAL_`), `datatables.infoEmpty`, `datatables.lengthMenu` (`_MENU_` is the select), `datatables.paginate.previous`, `.next`; "Page {page} of {pages}" new |
| Confirmations (shared) | `#ConfirmDeleteModal` | Cancel | `footer.cancel` |
| Passkeys (`/passkeys`) | `fido2.twig` | Rename, Remove | `fido2.rename`, `user.remove`; everything else new (passkey wording) |
| Home (`/`) | — | All texts | New `home.*` (no classic counterpart) |

**2. Messages**

| API outcome | Legacy key | Placeholders |
|---|---|---|
| `sign-in-failed` | `danger.login_failed` | — |
| `csrf-token-mismatch` | `warning.session_token` | — |
| `forbidden`, any 403 | `danger.access_denied` | — |
| `second-factor-required` | `info.awaiting_tfa_confirmation` | — |
| `temporary-verification-failure` | `danger.temp_error` | — |
| Any 500 without its own message | `danger.generic_server_error` | — |
| Any other unknown problem | `danger.unknown` | — |
| Signed in, user menu | `success.logged_in_as` | the username |

Problems the classic interface cannot report keep their new `problem.*` strings: the API key
problems, `second-factor-failed` and `second-factor-unavailable` (their FR-024 and FR-028 texts tell
the user what to do next), `sign-in-expired`, `too-many-requests`, `session-required`,
`unauthenticated`, `pending-action-required`, `passkey-registration-failed`, `validation-failed`,
the transport failures and the other statuses. Rule codes keep `validation.*`.

**3. Deviations needing a decision**: none open. Decided under the rule:

- Passkey texts stay new strings (owner decision).
- The second-factor step no longer shows the explanatory "Signing in as …" sentence, which legacy
  lacks (conventions: no explanation legacy lacks).
- The role-neutral sign-in screen, the pending-actions screen, the time limit, the theme choice and
  the API keys and audit log screens are the app's improvements; their elements without a legacy
  equivalent are new strings, listed above.

## Project Structure

### Documentation (this feature)

```text
specs/001-sign-in-app-shell/
├── spec.md              # Feature specification (with clarifications and parity)
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R29
├── data-model.md        # Phase 1: consumed API data, client state, query keys, route map, state machines
├── quickstart.md        # Phase 1: setup, gates and validation guide
├── contracts/README.md  # Phase 1: pinned API contract, vendoring, client generation, operations used
├── checklists/requirements.md
├── tasks.md             # Phase 2 (/speckit-tasks)
└── analysis.md          # /speckit-analyze summary
```

### Source Code (repository root)

```text
.github/
├── workflows/ci.yml                  # quality, build, e2e, lighthouse, image, smoke (R28)
└── dependabot.yml
.nvmrc  .npmrc  .editorconfig  .gitattributes  .prettierrc.json  .prettierignore
eslint.config.ts                      # Vue, TS type-aware, a11y, import boundaries, Reka bans (R3, R18)
index.html                            # no inline script or style; loads /ng/theme-init.js
package.json  package-lock.json
tsconfig.json  tsconfig.app.json  tsconfig.node.json  tsconfig.vitest.json
vite.config.ts                        # base /ng/, proxy, preview CSP headers, manifest, no inlining
vitest.config.ts
playwright.config.ts                  # mobile-chromium, desktop-chromium, mobile-webkit, smoke
lighthouserc.cjs
THIRD_PARTY_NOTICES.md                # TailAdmin 2.5.0 (94ebe1b) MIT notice and file list; Lucide ISC
contract/
├── openapi.yaml                      # vendored bundled contract (R6)
├── openapi.json
└── VERSION.json
docker/
├── Dockerfile                        # node:24-alpine build → nginx-unprivileged:1.28-alpine
└── nginx/{default.conf,security-headers.conf}
deploy/docker-compose.override.yml    # ng-mailcow service for mailcow-dockerized (R29)
public/theme-init.js                  # blocking theme class before first paint (R16)
scripts/
├── contract/{bump.sh,generate.mjs,check.mjs}
├── i18n/{lib.mjs,check.mjs,refresh-snapshot.mjs}
├── smoke/{stack-up.sh,stack-down.sh}
├── run-lhci.mjs                      # one Lighthouse collection per mock default scenario (R26)
├── check-bundle-budget.mjs
└── check-licenses.mjs
src/
├── main.ts                           # createApp, plugins, bootstrap, mount
├── App.vue                           # RouterView, LiveAnnouncer, ConfirmDialog host, IdleWarningDialog
├── env.d.ts
├── api/
│   ├── generated/schema.ts         # generated, never edited
│   ├── index.ts                      # the only door: client, root types, enum arrays, ApiProblem
│   ├── client.ts  csrf.ts  activity.ts  problem.ts
│   └── query/{client.ts,keys.ts}
├── app/
│   ├── bootstrap.ts
│   ├── router/{index.ts,routes.ts,guards.ts,return-to.ts,focus.ts,title.ts}
│   ├── navigation/{catalogue.ts,visibility.ts,classic-links.ts}
│   ├── layouts/{AuthLayout.vue,ShellLayout.vue}
│   ├── shell/{AppHeader.vue,NavigationDrawer.vue,NavigationList.vue,UserMenu.vue,AppsMenu.vue,
│   │          AppFooter.vue,SkipLink.vue,AnnouncementBanner.vue,BrandLogo.vue}
│   ├── session/{store.ts,queries.ts,sign-out.ts,session-end.ts,idle-timer.ts,cross-tab.ts,
│   │            IdleWarningDialog.vue}
│   ├── branding/{public-config.ts,defaults.ts,app-links.ts}
│   ├── preferences/{store.ts,theme.ts,locale.ts,sync.ts,LanguageSelect.vue,ThemeSelect.vue}
│   └── states/{NoAccessState.vue,NotFoundPage.vue,ServiceUnavailablePage.vue,PlaceholderPage.vue}
├── features/
│   ├── auth/{index.ts,routes.ts,api.ts,pages/,components/,composables/}
│   ├── home/{index.ts,routes.ts,pages/,components/}
│   ├── passkeys/{index.ts,routes.ts,api.ts,display-name.ts,pages/,components/,composables/}
│   ├── api-keys/{index.ts,routes.ts,api.ts,list-state.ts,expiry.ts,pages/,components/}
│   └── audit-log/{index.ts,routes.ts,api.ts,list-state.ts,time-range.ts,labels.ts,pages/,components/}
├── shared/
│   ├── ui/                           # TailAdmin primitives (R4) + utils/{cn.ts,focusOnOpen.ts}
│   ├── icons/
│   ├── components/{SanitizedHtml,LegacyText,LiveAnnouncer,ListState,PaginationBar,ConfirmDialog,FormField,
│   │               ErrorSummary,ProblemMessage,DateTime,RelativeTime,PageHeader}.vue
│   ├── composables/{useListState,useConfirm,useVersionedSave,useProblemForm,useAnnouncer,
│   │                useCountdown,useMediaQuery}.ts
│   ├── platform/{storage.ts,broadcast.ts,clipboard.ts,
│   │             webauthn/{support.ts,base64url.ts,options.ts,credential.ts,errors.ts,ceremony.ts}}
│   ├── security/{sanitize.ts,safe-url.ts}
│   └── validation/{ip-network.ts,limits.ts}   # limits checked against contract/openapi.json
├── i18n/
│   ├── index.ts  locales.ts  format.ts  problems.ts  default-languages.ts
│   ├── legacy.ts  legacy-format.ts  legacy-messages.ts  text.ts   # mailcow's strings (R15)
│   ├── messages/{en-gb,cs-cz,sk-sk}.json   # new strings, hand-written
│   └── snapshot/lang.en-gb.json            # upstream 2026-09a, scripts/i18n/refresh-snapshot.mjs
└── styles/main.css                   # Tailwind v4 + TailAdmin tokens, system font stack
tests/
├── setup/vitest.setup.ts
├── unit/                             # mirrors src/ ; support/{webauthn-stub,media,broadcast}.ts
├── mocks/
│   ├── contract/validator.ts
│   ├── handlers/{auth,identity,passkeys,api-keys,audit,public-config,index}.ts
│   ├── scenarios/{state,accounts,public-config,index}.ts
│   ├── factories/{passkey,api-key,audit-event,webauthn}.ts
│   ├── node.ts                       # msw/node for Vitest
│   └── server.ts                     # Node mock server for dev, end-to-end tests and Lighthouse
├── e2e/
│   ├── fixtures/{test,mock-api,a11y,csp,layout,webauthn}.ts
│   └── {shell,sign-in,passkey-sign-in,navigation,passkeys,pending-actions,preferences,api-keys,audit-log}/
└── smoke/{fixtures/{accounts,totp}.ts, *.smoke.spec.ts}
```

**Structure Decision**: A single static frontend project at the repository root, organised by
feature (R3). `src/app/` is the cross-cutting core this feature owns and later features extend:
the catalogue entry, routes and section roots. `src/features/<name>/` holds one area per feature,
and `src/shared/` holds building blocks with at least two uses. The contract and generated code
are isolated in `contract/` and `src/api/generated/`. Deployment artefacts live in `docker/` and
`deploy/`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Brand colours do not yet come from the API's branding configuration (constitution IV): both themes use TailAdmin's default palette, adjusted for AA contrast. | The API offers no colours until feature 013, and spec FR-004 requires the defaults until then. Colours are CSS custom properties, so 013 can set them at runtime through CSSOM without other changes (R16). | Hard-coding operator colours is forbidden by IV. Blocking UI 001 until API 013 would block every other feature. Reading legacy colours is impossible, because legacy has none. |
| The smoke suite (a constitution VI required layer) is written and runnable, but it is not a blocking merge gate until mailcow-rest-v2 runs its implementation in its dev stack. Until then the CI `smoke` job runs on dispatch, nightly, or when `SMOKE_ENABLED=true`. | Today mailcow-rest-v2 is a merged contract without an implementation. The constitution allows a UI feature to start once the contract is merged (Workflow). A blocking gate would block every merge on a service that cannot yet run. | Leaving the smoke suite out until the API exists was rejected: VI requires the layer, and writing it now keeps it test-first. Mocking the API in the smoke suite was rejected, because that is the end-to-end suite's job and would defeat the smoke layer's purpose. |


## Owner navigation update — 2026-10-20

The owner replaced the flat sidebar and Home landing with the following information architecture.
This decision supersedes the earlier Home/shortcut and flat-catalogue layout requirements; route
permissions and API contracts are unchanged. Existing TailAdmin Free primitives and the Routing
section's responsive navigation style are reused.

- **Email configuration**: Domains (Domains, Domain Templates), Mailboxes (Mailboxes, Mailbox
  Templates), Aliases (Aliases, Domain aliases), Resources, Filters, Sync jobs, and Routing
  (BCC maps, Recipient maps, TLS policy maps).
- **Quarantine** keeps its destinations and role filtering. Its tabs use the shared tab styling.
- **System**: System & Containers, with System & Containers, Logs and Audit log tabs.
- **System configuration**: Access (Administrators, Domain administrators, API keys, Identity
  Provider, OAuth2 Apps, Rspamd UI), Options (ARC/DKIM keys, Forwarding Hosts, Fail2ban parameters,
  Quota notifications, Rspamd settings map, Password Settings, Customize), Routing
  (Sender-dependent transports, Transport Maps), System mails and Global filter maps.

Home, Passkeys, User Settings and MTA-STS are absent from the sidebar. Account settings and passkeys
remain in the username dropdown; their routes and the MTA-STS routes retain their access rules.
`/` replaces itself with `/operations/dashboard` for administrators, `/domains` for domain
administrators, or `/account/password` for mailbox users. Valid deep links and the existing mailbox webmail
forwarding hook retain precedence. The old `/routing` address now opens BCC maps.

Sidebar section disclosures use TailAdmin's existing collapsible primitives. The desktop sidebar
and mobile drawer body scroll independently; the mobile close button stays visible. A single
`max-w-7xl` shell content wrapper sets the width of all signed-in pages and tabs. A scoped rule
normalizes immediate route roots only, preserving internal data-table scrolling and form layouts.
The theme switch sits outside the username dropdown. Its language choices use TailAdmin dropdown
items, the installation's verbatim language names and decorative locale-region flags.
The menu retains a Device setting checkbox so the existing automatic theme preference can be
restored after using the outside dark-mode switch. The announcement is inside the content column,
so it cannot push the desktop sidebar's lower edge below the viewport.

Unimplemented destinations are explicitly disabled, without a link action: Rspamd settings map,
Customize, System mails and Global filter maps. Quota notifications is now available. Password Settings opens
the policy editor and recovery-email templates at `/system/password-policy`. Rspamd UI opens
the web-interface password settings. Administrators and Domain administrators have separate tabs.
Queue Manager is linked from the System &
Containers page header; IP Check is linked from its public-addresses panel, and links back to the
existing System settings overview. These contextual links preserve the requested sidebar order.
Account sections also use the shared tabs above their full-width content; mailbox-scoped account
pages retain their mailbox context and permission checks.

Implementation is on `wt/navigation`, based on `b7446038`. Validation and any remaining integration
work are recorded with the implementation commit.

Validation completed on 2026-10-20: 513 impacted unit checks across the initial and focused runs;
385 distinct browser checks passed across the final core, migrated landing, foundation and storage
runs, with one expected desktop skip for the mobile drawer. Core navigation, width, scroll,
keyboard, language and theme checks passed in mobile Chromium, desktop Chromium and mobile WebKit.
Two read-only local-API smoke cases passed for administrator and domain-administrator navigation.
Full lint, typecheck, translation check and production build passed; initial JavaScript is 198,898
bytes gzipped against the 204,800-byte budget. Screenshots and logs are retained under
`storage/app/restart-2026-10-20/navigation` in the API workspace.

Integration checkpoint: the UI007 CRUD routes and quarantine scope-filter fix are now combined
with this navigation. Access opens `/administrators/admins`, and domain-administrator detail routes
retain the Administrators tab. Identity transitions still unmount
the previous route and suppress its tabs. Validation: 170 focused unit tests, 72 browser checks
across mobile Chromium, desktop Chromium and mobile WebKit, and four isolated real-API smoke
checks passed. Typecheck, lint, translations, production build and bundle budgets passed; combined
initial JavaScript is 202,257/204,800 bytes gzipped. Browser coverage includes following Access
from the sidebar into account detail and measures the actual domain creation form at
`/domains/-/new`. UI002 T044 is superseded by the owner's Home removal.

The account-width and contextual-link follow-up passed 62 focused unit tests and 21 browser
checks across all three profiles, including dark/light accessibility, reflow, touch targets,
mailbox context, permission checks and unsaved-change prompts. Its validation evidence is in
`storage/app/restart-2026-10-20/navigation/entry-links` in the API workspace.

The password-policy and staged domain-picker integration passed 159 focused unit checks and
70 browser checks, with two expected desktop skips for phone-only dialogs. The Access correction
uses exactly the five requested tabs: both administrator account types remain under Administrators,
with contextual links between their lists. Its final validation passed 18 browser cases and
13 navigation unit checks; the preceding component and route run passed 75 unit checks.
Typecheck, lint, translation validation, production build and bundle budgets passed. Initial
JavaScript is 202,397/204,800 bytes gzipped. Logs are retained under
`storage/app/restart-2026-10-20/policy-picker-integration` in the API workspace. Password policy and
mobile domain assignment also passed their isolated real-API smoke checks before integration.

The Rspamd UI and recovery-email integration passed 68 focused unit checks, nine browser cases
covering both settings pages and hostile preview isolation across all three profiles, and three
exact Access/Options tab checks. Typecheck, lint, translations, production build and bundle
budgets passed; initial JavaScript is 202,544/204,800 bytes gzipped. These supplement the workers'
27 Rspamd and 51 recovery-email browser cases and their read-only real-API smoke checks. New
settings wording that lacks approved Czech or Slovak translations retains explicit English
source text, as recorded in the feature checkpoints. Logs are retained under
`storage/app/restart-2026-10-20/reset-rspamd-integration` in the API workspace.


### Owner follow-up: TailAdmin shell and account entry points

The later owner request supersedes the five-tab Access grouping described in the earlier validation
checkpoints: Domain administrators is now the second tab, immediately after Administrators.
The redundant cross-links between the two lists are removed.

The shell follows the [TailAdmin Free demo](https://free-demo.tailadmin.com/): desktop sidebar from
the top of the viewport, operator logo above the independently scrolling navigation, header beside
the sidebar, and a header button switching between the 290px sidebar and 90px icon rail. Existing
navigation, collapsible groups, permission rules, mobile focus-trapped drawer, theme switch and
branding are reused. Rail links retain accessible names. The compact logo uses the configured
operator image; the branding API has no separate icon asset. Collapse/expand accessibility labels
retain explicit English source fallback in Czech and Slovak until approved copy is available.

The user menu's Language row shows the selected language and flag, opening the existing TailAdmin
submenu primitive beside the menu; collision handling puts it to the left on desktop and keeps it
within narrow viewports. Language names remain installation-provided. The user menu is loaded on
signed-in use to preserve the initial JavaScript budget.

User Settings opens Password directly. `/account` remains a redirect for saved addresses; its
former overview/cards page is removed. Passkeys keeps `/passkeys` and now shares the account layout
and tabs. Mailbox information and webmail access remain available within the Mail apps tab.
Validation of this follow-up is recorded with its release checkpoint.


Release validation — 2026-10-21: the combined TailAdmin shell, account navigation, acting sessions
and quota notification changes passed 204 focused unit checks, 156 integrated browser checks,
and the desktop expanded/collapsed rail check. The earlier shell/preferences suite passed 57
checks, with two expected mobile skips for the desktop rail; the separate language keyboard/touch
suite passed six checks. All three browser profiles were exercised (desktop Chromium, mobile
Chromium, mobile WebKit), including accessibility, responsive widths, tabs, preference persistence,
account role guards, previews and acting-session return. A native 44px minimum width was added to
administrator-table sort buttons after the rail accessibility check exposed the narrow Active
header. The final desktop screenshots were visually reviewed.

Four read-only/session-only local API smoke cases passed: administrator navigation and account
entry points, reseller access, and both acting-session flows with owner restoration. The mailbox
acting smoke follows the Mail apps tab without reloading, preserving its intentionally in-memory
origin. The quota checkpoint separately passed two reversible local API smoke checks and restored
its test settings. Typecheck (including a fresh forced run), focused lint, formatting, translations,
production build and bundle budgets passed. The initial JavaScript is 186,395/204,800 bytes gzipped;
the signed-in Apps and user menus load lazily. Physical-device/screen-reader acceptance remains
separate from these browser checks. Logs and screenshots are retained in the API workspace under
`storage/app/restart-2026-10-20/navigation` and `storage/app/restart-2026-10-20/tailadmin-shell`.
