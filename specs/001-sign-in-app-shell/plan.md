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

**Performance Goals**: Lighthouse mobile scores of at least 90 for performance and accessibility.
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
- 3 locales.
- About 400 translation keys, part of them reused from legacy.
- The foundation for 13 later UI features.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (below).*

| Principle | Gate | Status |
|---|---|---|
| I. The API contract is the only interface | Only contract operations are used. A request matching no operation is a mock violation (R22), and FR-093 is tested. The pinned version is recorded in `contract/VERSION.json` with a checksum (R6). Types and client are generated (`openapi-typescript`, `openapi-fetch`), generated files are guarded by `contract:check`, and they are importable only via `@/api`. No hand-written API types (R7). A bump is a script plus typecheck and tests. Gaps are reported to mailcow-rest-v2 and never worked around (see "API dependency and gaps"). Errors are handled from problem `type` and `errors` (R8, R15). | PASS |
| II. Mobile-first | Every screen is designed and tested at 360 px first (the `mobile-chromium` and `mobile-webkit` projects), with horizontal-scroll checks at 360 and 320 px and 44 × 44 targets (R21, R24). Lists are cards below `md` and tables above. Long forms are split into sections; the key form is its own page, not a modal. Destructive actions are confirmed with their impact. Every collection has loading, empty and error states (`ListState`). Pinch-zoom is allowed. | PASS |
| III. Accessibility (WCAG 2.2 AA) | axe with the WCAG 2.2 AA tags runs on every screen and state, in light and dark (R24); a violation fails the test. The rules of R21 cover keyboard, focus, live regions, the skip link, labels and non-colour status. There are three themes, `light`, `dark` and `system` (R16). | PASS |
| IV. i18n and branding | All text comes from en-gb, cs-cz and sk-sk messages, and `i18n:check` fails on any gap, including every contract enumeration (R27). Legacy keys are reused through `legacy-map.json` and an import from the upstream baseline (R15). `Intl` formatting uses the user's locale. Product name, logos, texts, links and announcement come from `GET /public-config`. Nothing brand-specific is in the source. Colours stay at the defaults until API 013 (FR-004). | PASS |
| V. Security in the browser | Same-origin session cookie. The CSRF token is in memory only (R8). Storage holds only the conveniences listed in data-model §4, verified by a unit test. A strict CSP is enforced in the end-to-end tests and on the image (R18). `v-html` appears only in `SanitizedHtml` behind DOMPurify (R17). Hiding is a convenience: "no access" is rendered in place, and 401, 403 and 404 are handled (R11, R19). Lockfile pinning, `npm audit` and a licence allowlist run in CI (R27). | PASS |
| VI. Test-first | `tasks.md` puts tests before implementation in every phase. Unit and component tests; end-to-end tests of every acceptance scenario on both viewports, against a mock generated from the contract whose requests and responses are validated against it (R22); a smoke suite against the real API (R25). | PASS (see Complexity Tracking for the smoke gate) |
| VII. Performance budgets | `budget:check` caps the initial JS at 200 KB gzipped from the Vite manifest. Lighthouse CI asserts performance and accessibility of at least 0.9 (R26). Routes are lazy. The query policy forbids refetching without reason and invalidates after mutations (R9). | PASS |
| VIII. Simplicity | Ten runtime dependencies, each justified (R1). Shared components exist only with two uses in this feature; single-use patterns stay in the feature with a recorded promotion path, and later patterns have reserved locations (R20). No date, form, icon or WebAuthn library. | PASS |
| Technology constraints | The stack is exactly as listed. TailAdmin Vue Free is copied in at a pinned version, with the MIT notice in `THIRD_PARTY_NOTICES.md`. No Pro code or demo parts (R4). Fonts and icons make no CDN request: a system font stack and inline SVG (R5). No SSR and no backend code. Deployment is a static image beside mailcow-rest-v2 via `docker-compose.override.yml`, on the same origin, with no upstream file patched (R29). | PASS |
| Workflow and gates | CI jobs map to every merge gate: lint, types, unit; end-to-end on both viewports with a11y; budgets; translations; vulnerability scan (R28). Commits go to `main`. Licence: GPL-3.0, with every dependency compatible. | PASS |
| `docs/conventions.md` | Wording ("the classic interface", "passkeys"). List state in the address, page sizes 25/50/100, cards and tables, list states (`useListState`). Outdated saves keep the input and reload (`useVersionedSave`). Confirmations. Secrets shown once, never stored. Problem types and rule codes translated. Controls hidden or read-only by permission. Bulk actions and History are reserved for the features whose contract offers them (R20). | PASS |

**Post-design re-check (after Phase 1)**: PASS. The data model, contracts README and quickstart
introduce no violation. Decisions that touched gates:

- The system font stack instead of TailAdmin's Outfit: V and the licence rule (R5).
- Native `<select>` instead of Reka `Select`, and Reka's style-injecting parts banned: V, CSP
  (R18).
- `refetchOnWindowFocus` off: FR-033 and VII (R9).
- Single-use patterns kept in the feature: VIII (R20).

## API dependency and gaps

This feature depends on **mailcow-rest-v2 feature 001**, contract `0.1.0`, with the planning
baseline at commit `293b7c2` (see [contracts/README.md](./contracts/README.md)). It covers every
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
4. **Native review of new Czech and Slovak strings**: reused legacy translations are reviewed
   upstream; new strings are written by the implementer. **Default**: the owner reviews the new
   cs-cz and sk-sk strings before the first release. `i18n:check` guarantees completeness, not
   wording.

## Parity notes added by the plan

The spec's parity table is complete. The plan adds:

1. Placeholder links to the classic interface point to pages, not tabs, because the classic
   interface has no hash-to-tab handling. The exact addresses are in research R19.
2. Classic app links with a `javascript:` or other non-http(s) address are not rendered, as a
   security fix (R17). Legacy renders them as links.

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
├── i18n/{import-legacy.mjs,check.mjs}
├── smoke/{stack-up.sh,stack-down.sh}
├── check-bundle-budget.mjs
└── check-licenses.mjs
src/
├── main.ts                           # createApp, plugins, bootstrap, mount
├── App.vue                           # RouterView, LiveAnnouncer, ConfirmDialog host, IdleWarningDialog
├── env.d.ts
├── api/
│   ├── generated/schema.d.ts         # generated, never edited
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
│   ├── components/{SanitizedHtml,LiveAnnouncer,ListState,PaginationBar,ConfirmDialog,FormField,
│   │               ErrorSummary,ProblemMessage,DateTime,RelativeTime,PageHeader}.vue
│   ├── composables/{useListState,useConfirm,useVersionedSave,useProblemForm,useAnnouncer,
│   │                useCountdown,useMediaQuery}.ts
│   ├── platform/{storage.ts,broadcast.ts,clipboard.ts,
│   │             webauthn/{support.ts,base64url.ts,options.ts,credential.ts,errors.ts,ceremony.ts}}
│   ├── security/{sanitize.ts,safe-url.ts}
│   └── validation/ip-network.ts
├── i18n/
│   ├── index.ts  locales.ts  format.ts  problems.ts
│   ├── messages/{en-gb,cs-cz,sk-sk}.json   # hand-written
│   ├── legacy/{en-gb,cs-cz,sk-sk}.json     # generated by scripts/i18n/import-legacy.mjs
│   └── legacy-map.json
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
| The smoke suite (a constitution VI required layer) is written and runnable, but it is not a blocking merge gate until mailcow-rest-v2 runs its implementation in its dev stack. Until then the CI `smoke` job runs on dispatch, nightly, or when `SMOKE_ENABLED=true`. | Today mailcow-rest-v2 is a merged contract without an implementation. The constitution allows a UI feature to start once the contract is merged (Workflow). A blocking gate would block every merge on a service that cannot yet run. | Leaving the smoke suite out until the API exists was rejected: VI requires the layer, and writing it now keeps it test-first. Mocking the API in the smoke suite was rejected, because that is the end-to-end suite's job and would defeat the smoke layer's purpose. |
