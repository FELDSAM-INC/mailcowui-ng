---
description: "Task list for UI feature 001: sign-in, application shell, passkeys and API keys"
---

# Tasks: Sign-in, Application Shell, Passkeys and API Keys

**Input**: Design documents from `specs/001-sign-in-app-shell/`:
- [plan.md](./plan.md)
- [spec.md](./spec.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/README.md](./contracts/README.md)
- [quickstart.md](./quickstart.md)

**Prerequisites**: plan.md, spec.md, research.md, data-model.md and contracts/ are complete.

**Tests**: Mandatory (constitution VI, test-first). In every phase, tests are written first and must
fail before the implementation tasks that follow them. Every end-to-end spec:
- runs on the `mobile-chromium` (360 px) and `desktop-chromium` projects, and on `mobile-webkit`
  except for tests tagged `@virtual-authenticator`;
- calls `expectAccessible` (axe, WCAG 2.2 AA, both themes) on every screen and state it reaches;
- fails on any CSP violation or mock contract violation, through the fixtures of T029;
- names its spec reference in the test title (`US1-AS6 …`, `FR-035 …`, `Edge: …`).

**Organization**: Tasks are grouped by user story (spec priorities P1 to P3), so that each story can
be implemented and tested on its own once the foundation is in place.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task belongs to (US1 to US8)
- Paths are relative to the repository root `mailcowui-ng/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the project, tooling, contract, deployment artefacts and CI (research R1–R7,
R26–R29).

- [X] T001 Create `package.json` with the exact runtime and dev versions of research R1/R2, `"type": "module"`, `engines.node` `^22.13.0 || ^24.0.0`, and the npm scripts:
  - `dev`, `dev:mock`, `build`, `preview`, `preview:mock`;
  - `mock:server`, `mock:scenario`;
  - `lint`, `format`, `format:check`, `typecheck`;
  - `test` (`npm run test:unit && npm run test:e2e`), `test:unit`, `test:e2e`, `test:smoke`;
  - `contract:generate`, `contract:check`, `i18n:import`, `i18n:check`;
  - `licenses:check`, `audit`, `budget:check`, `lhci`.

  Add `.npmrc` (`save-exact=true`, `engine-strict=true`) and `.nvmrc` (`24`). Run `npm install` to create `package-lock.json`.

  *Implementation note*: `audit` runs `npm audit --omit=dev --audit-level=moderate` and, for the whole tree, `--audit-level=critical` instead of `high` (research R27). At the pinned versions the whole tree has high advisories with no fixed version (`braces` through `@vue/eslint-config-typescript`, `extract-zip` and others through `@lhci/cli`), all in development-only tools that never reach `dist/`. Production dependencies have none.
- [X] T002 [P] Create the strict TypeScript configuration in `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.vitest.json` and `src/env.d.ts`:
  - `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`;
  - `exactOptionalPropertyTypes` off;
  - the path alias `@/*` to `src/*`;
  - `/// <reference types="vite/client" />`.
- [X] T003 [P] Add `.editorconfig`, `.prettierrc.json` and `.prettierignore`. Extend `.gitignore` with `playwright-report/`, `test-results/`, `.lighthouseci/` and `blob-report/`. Add `.gitattributes`, marking `src/api/generated/**`, `contract/**` and `src/i18n/legacy/**` as `linguist-generated`.
- [X] T004 [P] Create `docker/nginx/security-headers.conf`. It holds one `add_header … always;` line per header of research R18/R29. The CSP is exactly `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'`. The only other headers are `Permissions-Policy` and `Cross-Origin-Opener-Policy`. Do not send `X-Content-Type-Options`, `X-Frame-Options` or `Referrer-Policy`: nginx-mailcow already sets them at server level (R29).
- [X] T005 Create `vite.config.ts`:
  - `base: '/ng/'`;
  - the plugins `@vitejs/plugin-vue`, `@tailwindcss/vite` and `@intlify/unplugin-vue-i18n` (`runtimeOnly`, `compositionOnly`, `fullInstall: false`, `include: src/i18n/{messages,legacy}/**`);
  - the alias `@`;
  - `build.manifest: true`, `build.assetsInlineLimit: 0`, `build.modulePreload.polyfill: false`, `build.sourcemap: 'hidden'`;
  - `server.proxy['/api/v2']` to `process.env.API_PROXY_TARGET ?? 'http://localhost:8080'` (`changeOrigin: false`);
  - `preview.proxy['/api/v2']` to `process.env.MOCK_API_TARGET ?? 'http://127.0.0.1:4010'`;
  - `preview.headers` parsed from `docker/nginx/security-headers.conf`, so there is a single CSP source (R18).
- [X] T006 [P] Create `eslint.config.ts` (flat config, loaded through `jiti`) with:
  - `eslint-plugin-vue` (recommended), with `vue/no-v-html` and `vue/no-static-inline-styles` as errors;
  - type-aware rules from `@vue/eslint-config-typescript` and `typescript-eslint`;
  - `eslint-plugin-vuejs-accessibility`;
  - `eslint-config-prettier`;
  - `no-restricted-imports`, which forbids:
    - `@/api/generated/*` outside `src/api/`;
    - `@/features/*/*` deep imports;
    - `@/app/*` and `@/features/*` from `src/shared/**`;
    - the `reka-ui` named imports `SelectViewport`, `ComboboxViewport`, `AutocompleteViewport`, `ScrollAreaViewport`, the generic `Viewport` and `SplitterResizeHandle` (R3, R18);
  - ignores for `src/api/generated/**`, `dist/**` and `coverage/**`.
- [X] T007 [P] Create `index.html` and `public/theme-init.js`:
  - `index.html`: `<html lang="en">`, `<meta name="viewport" content="width=device-width, initial-scale=1">` with no `user-scalable`, the host's own icons (`/favicon.ico`, `/favicon-32x32.png`, `/favicon-16x16.png` and `/apple-touch-icon.png`, R16; first written as `/favicon.png`, which mailcow does not serve), `<script src="/theme-init.js"></script>` in `<head>` (blocking), `<div id="app">`, the module entry `/src/main.ts`, and no inline script or style.
  - `public/theme-init.js` reads `localStorage['mailcowui-ng.theme']` in `try/catch` and sets `.dark` on `<html>` for `dark`, or for `system` when `prefers-color-scheme: dark` holds (R16).
- [X] T008 Vendor the pinned contract (research R6):
  - Write `scripts/contract/bump.sh` (resolve the ref in `$MAILCOW_REST_V2_DIR` (default `../mailcow-rest-v2`) or in a fresh clone, `git archive` of `api/`, `redocly lint`, `redocly bundle` to YAML, write `VERSION.json`, call `contract:generate`).
  - Write `scripts/contract/generate.mjs`: `redocly bundle contract/openapi.yaml --ext json -o contract/openapi.json`, then `openapi-typescript contract/openapi.yaml -o src/api/generated/schema.ts --root-types --root-types-no-schema-prefix --enum-values --read-write-markers --alphabetize`.
  - Write `scripts/contract/check.mjs`: verify the sha256 against `VERSION.json`, regenerate, then `git diff --exit-code contract src/api/generated`.
  - Run `scripts/contract/bump.sh 293b7c293ec0b8d8bdf389b35fc1698fcf4d7ffa`, or a release tag of the feature 001 contract if mailcow-rest-v2 has published one. **Never** pin "the latest commit": later features' contracts share the tree and the `0.1.0` version (R6). This produces `contract/openapi.yaml`, `contract/openapi.json`, `contract/VERSION.json` and `src/api/generated/schema.ts`. Confirm the bundle sha256 `8fb1d4b4…` and 31 operations.
  - Record in `specs/001-sign-in-app-shell/contracts/README.md` whether `knownProblemTypeValues` is generated. If it is not, API gap 5 is still open: report it to mailcow-rest-v2. Nothing waits for it, because the translation check derives problem types from the bundle text (R27). Never hand-write the list (constitution I).
- [X] T009 [P] Copy the TailAdmin Vue Free 2.5.0 (commit `94ebe1bce19fa51eb4225cc981ee1265b6bdf567`) primitives into `src/shared/ui/`:
  - the directories `alert`, `badge`, `button`, `card`, `checkbox`, `collapsible`, `combobox` (without `ComboboxViewport`), `dialog`, `dropdown-menu`, `field`, `input`, `input-group`, `label`, `pagination`, `radio-group`, `switch`, `table` and `textarea`;
  - the helpers `src/shared/ui/utils/cn.ts` (on `tailwind-merge` 3) and `src/shared/ui/utils/focusOnOpen.ts`.

  Each file gets the derivation header comment. Raise control sizes to at least 44 × 44 px (R4, R21). Write `THIRD_PARTY_NOTICES.md` with:
  - the repository, version and commit;
  - the copied files with their source paths;
  - the full MIT notice;
  - the deviations 1–6 of research R4;
  - an empty "Lucide (ISC)" section for icons added in T011.
- [X] T010 [P] Create `src/styles/main.css`:
  - `@import 'tailwindcss'` and `@import 'tw-animate-css'`;
  - TailAdmin's `@theme` tokens as the default colours of FR-004, with dark-mode text using `brand-300` or `brand-400` for AA contrast (R16), `@custom-variant dark (&:is(.dark *))` and the `data-*` variants;
  - `--font-sans` set to the system UI stack of research R5, with no Google Fonts import;
  - `color-scheme` following `.dark`;
  - `scroll-padding-top` equal to the header height;
  - `motion-safe` transition defaults.

- [X] T011 Create the inline-SVG icon components in `src/shared/icons/` with a barrel `src/shared/icons/index.ts`. Each has `aria-hidden="true"` and `focusable="false"`. Icons come from TailAdmin `src/icons/layout` first, otherwise from Lucide, recorded in the Lucide section of `THIRD_PARTY_NOTICES.md`. Needed: menu, close, chevron-down, chevron-right, home, key, passkey (fingerprint), list (audit), user, sign-out, language, sun, moon, monitor, external-link, copy, check, info, warning, danger, eye, eye-off, plus one icon per navigation catalogue section of data-model §2.
- [X] T012 Create `vitest.config.ts` (jsdom, `tests/setup/vitest.setup.ts`, v8 coverage with thresholds of 90 % lines for `src/api`, `src/app/session`, `src/app/router`, `src/app/navigation`, `src/shared/security` and `src/shared/platform/webauthn`, 80 % elsewhere in `src/`, R23). Also create:
  - `tests/setup/vitest.setup.ts`: a fresh Pinia, `QueryClient` and i18n with `en-gb` per test, plus mount helpers;
  - the fakes `tests/unit/support/webauthn-stub.ts`, `tests/unit/support/media.ts` (matchMedia) and `tests/unit/support/broadcast.ts` (BroadcastChannel).

  *Implementation note*: coverage excludes the copied TailAdmin primitives and icons (`src/shared/ui/**`, `src/shared/icons/**`, see `THIRD_PARTY_NOTICES.md`) and `src/main.ts`; they are exercised through the shared components and the end-to-end suite. The mount helpers live in `tests/unit/support/mount.ts`.
- [X] T013 Create `playwright.config.ts` (R24):
  - `mobile-chromium`: 360 × 780, `isMobile`, `hasTouch`, `deviceScaleFactor: 3`;
  - `desktop-chromium`: 1366 × 900;
  - `mobile-webkit`: 360 × 780, `grepInvert: /@virtual-authenticator/`;
  - all three with `testDir: tests/e2e` and base URL `http://localhost:4173/ng/`;
  - `smoke`: `testDir: tests/smoke`, base URL `process.env.SMOKE_BASE_URL ?? 'http://localhost:8080/ng/'`;
  - `webServer` entries for `npm run mock:server` (:4010) and `npm run preview -- --port 4173`, with `MOCK_API_TARGET` set. They serve an existing `dist/`: `npm run build` runs first locally, and CI downloads the build artifact;
  - traces kept on failure.

  *Implementation note*: the smoke base URL defaults to `http://localhost:18480/ng/`, the port `scripts/smoke/stack-up.sh` serves on (T019 note), not 8080. Ports are overridable with `MOCK_PORT` and `PREVIEW_PORT`.
- [X] T014 [P] Create `lighthouserc.cjs` and `scripts/run-lhci.mjs` (R26).
  - `lighthouserc.cjs`: mobile preset with 3 runs; assertions `categories:performance >= 0.9`, `categories:accessibility >= 0.9` and `resource-summary:script:size <= 204800`; reports written to `.lighthouseci/`.
  - `scripts/run-lhci.mjs`, the `lhci` script, runs one collection per default scenario: `/ng/sign-in` with `MOCK_DEFAULT_SCENARIO=anonymous-default`, then `/ng/` with `MOCK_DEFAULT_SCENARIO=admin-active`. For each it starts `npm run mock:server` and `vite preview --port 4173`, runs `lhci collect --url`, then stops both. It finishes with one `lhci assert`.
- [X] T015 [P] Create `scripts/check-bundle-budget.mjs` (R26). It reads `dist/.vite/manifest.json`, gzips the entry chunk and its transitive static imports with `node:zlib`, fails above 204,800 bytes, and prints every lazy chunk's gzipped size.
- [X] T016 [P] Create `scripts/check-licenses.mjs` (R27). It runs `npm ls --omit=dev --all --json`, adds the dev packages whose code ends up in `dist/` (`tailwindcss`, `tw-animate-css`), reads every package's licence, and fails unless it is MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, MPL-2.0, 0BSD, or a dual licence that contains one of them.
- [X] T017 [P] Create `docker/Dockerfile` (stage 1 `node:24-alpine`: `npm ci && npm run build`; stage 2 `nginxinc/nginx-unprivileged:1.28-alpine`, pinned by digest, copies `dist/` without `*.map` to `/usr/share/nginx/html/ng/`) and `docker/nginx/default.conf`, which listens on 8080 with:
  - `location /ng/` and `try_files $uri $uri/ /ng/index.html`;
  - `location /ng/assets/` with `Cache-Control: public, max-age=31536000, immutable`;
  - `no-cache` for `index.html` and `theme-init.js`;
  - `location = /ng/healthz` returning 200;
  - `location = /` redirecting to `/ng/`;
  - gzip for JS, CSS, JSON and SVG, and `server_tokens off`;
  - `include security-headers.conf` in every content location (R29).
- [X] T018 [P] Create `deploy/docker-compose.override.yml` with the service `ng-mailcow`: image `ghcr.io/feldsam-inc/mailcowui-ng:${MAILCOWUI_NG_VERSION}`, network `mailcow-network` with the alias `ng-mailcow`, `read_only: true`, tmpfs for `/tmp` and `/var/cache/nginx`, `restart: always`, and a healthcheck of `wget -q --spider http://127.0.0.1:8080/ng/healthz` (R29).
- [X] T019 [P] Create `scripts/smoke/stack-up.sh` and `scripts/smoke/stack-down.sh` (R25). Up:
  1. In `$MAILCOW_REST_V2_DIR`, at `contract/VERSION.json` `commit` or `SMOKE_API_REF`, run `docker compose up -d --build`, the API quickstart setup commands and `scripts/dev/reset-dev-database.sh`.
  2. Run `docker build -t mailcowui-ng:smoke -f docker/Dockerfile .`.
  3. Run the image on the API stack's network with `--network-alias ng-mailcow`.
  4. Wait for `/api/v2/health/ready` and `/ng/`, then print `ready: http://localhost:8080/ng/`.

  Down removes the container and runs `docker compose down -v`.

  *Implementation note*: the API is checked out in a separate `git worktree` under `.smoke/api` and run as its own Compose project (`SMOKE_PROJECT`, default `mailcowui-ng-smoke`) on its own port (`SMOKE_WEB_PORT`, default 18480). A developer's own checkout and running `restv2` dev stack (port 18080) are never touched. The pinned commit holds only the contract, so `SMOKE_API_REF` selects an API commit with the implementation until a pin contains one.
- [X] T020 [P] Write tests for the i18n tooling in `tests/unit/scripts/i18n-tools.spec.ts`, against fixture message sets (FR-086, SC-006). Cover:
  - the import:
    - `%s` becomes `{0}`, and `{ } @ $ |` are escaped as literal interpolations;
    - decorative glyphs are stripped (`"> Forgot Password?"` becomes `"Forgot Password?"`);
    - mapped values containing HTML, "FIDO2" or "Touch ID" are refused;
    - a key missing from a locale's legacy file (for example `login.login_admin` in `sk-sk`) is left out of that locale's legacy layer;
  - the check rules 1–5 of research R27:
    - equal merged key sets with no empty values, and equal placeholder sets;
    - a key for every contract enumeration value, with problem types taken from every `/api/v2/problems/<name>` in `contract/openapi.json`;
    - the banned words "FIDO2", "Touch ID" and, in en-gb, "legacy";
    - no key in both layers for the same locale;
    - every legacy-map key present in the en-gb legacy file;
    - a key missing from a cs-cz or sk-sk legacy file must be supplied by that locale's app layer.

  The tests must fail.
- [X] T021 Implement `scripts/i18n/lib.mjs`, `scripts/i18n/import-legacy.mjs` and `scripts/i18n/check.mjs` so that T020 passes.
  - `import-legacy.mjs [--ref 2026-09a]` reads `data/web/lang/lang.{en-gb,cs-cz,sk-sk}.json` with `git -C ${MAILCOW_REPO:-../mailhosting} show <ref>:<path>` and writes `src/i18n/legacy/<locale>.json` for the keys of `src/i18n/legacy-map.json` that exist in that locale.
  - `check.mjs` reads the enumeration arrays from `src/api/generated/schema.ts`, and the problem types from `contract/openapi.json` (plus `knownProblemTypeValues` when present). It reports unused keys as warnings (R15, R27).
- [X] T022 [P] Create `.github/workflows/ci.yml` with the jobs `quality`, `build`, `e2e`, `lighthouse`, `image` and `smoke` exactly as research R28 describes:
  - Node 24 with npm cache;
  - actions pinned by SHA;
  - the `smoke` job checks out `FELDSAM-INC/mailcow-rest-v2` with `secrets.MAILCOW_REST_V2_TOKEN` and runs on `workflow_dispatch`, nightly, or when `vars.SMOKE_ENABLED == 'true'`.

  Also create `.github/dependabot.yml` (npm and github-actions, weekly).

**Checkpoint**: `npm run lint`, `typecheck` and `contract:check` run (on an empty `src/`), and the CI
workflow parses.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The contract-validated mock API and test fixtures, plus the core every story
renders in:
- the API client;
- i18n, theming and preferences;
- branding;
- the session state machine;
- the router and its guards;
- the navigation catalogue;
- the shell;
- the shared primitives with two or more uses in this feature (R20);
- the WebAuthn platform module.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Test infrastructure

- [X] T023 [P] Write `tests/unit/mocks/validator.spec.ts`. The validator must:
  - accept a valid `getSession` 200;
  - reject an undocumented status;
  - reject a body that violates the schema, for example `Base64Url` with `=` padding;
  - reject a missing required header (`Location` on 201, `Retry-After` on 429, `ETag` on `PreferencesResponse`);
  - reject a request matching no operation (FR-093);
  - reject an unsafe request without `X-CSRF-Token`;
  - reject a request body that violates its schema;
  - prefer literal path segments over templates (`/api-keys/owner-candidates` versus `/api-keys/{apiKeyId}`);
  - reject a value outside a closed enumeration, for example an unknown `AuditEventType` (R22).

  The test must fail.
- [X] T024 Implement `tests/mocks/contract/validator.ts` (R22):
  - Ajv 2020 with `ajv-formats` over `contract/openapi.json`;
  - `discriminator`, `example`, `xml` and `externalDocs` registered as annotation keywords, and the `password` format registered;
  - resolution of `$ref` response objects;
  - operation matching, then request and response validation;
  - a violation recorder that answers `500` with `mock-contract-violation`.
- [X] T025 [P] Create the scenario model and the base data:
  - `tests/mocks/scenarios/state.ts`: scenario state with accounts, second factors, passkeys, API keys, audit events, preferences, public-config variant, session (state, CSRF token, last activity, pending sign-in, challenge), behaviour switches and failure injection by operationId;
  - `tests/mocks/scenarios/accounts.ts`;
  - `tests/mocks/scenarios/public-config.ts`: variants default, custom branding, `forceSingleSignOn`, hidden login links, identity provider configured, no app links, malicious HTML, language subsets, unavailable;
  - `tests/mocks/scenarios/index.ts`: a registry that aggregates one module per area (`tests/mocks/scenarios/<area>.ts`), so that parallel stories never edit the same scenario file. It starts with `tests/mocks/scenarios/base.ts`, which holds `anonymous-default`, `admin-active`, `config-unavailable` (documented `500` on `getPublicConfig`) and `bootstrap-500` (documented `500` on `getSession`). "API not ready" as a transport failure is not a mock scenario: tests use Playwright `route.abort()` or an HTML 502 `route.fulfill()` (R22). Later story tasks that name `tests/mocks/scenarios/index.ts` add their scenarios in their own area module, registered there;
  - the factories `tests/mocks/factories/passkey.ts`, `tests/mocks/factories/api-key.ts`, `tests/mocks/factories/audit-event.ts` and `tests/mocks/factories/webauthn.ts` (option builders and credential ID extraction from `attestationObject` and `rawId`).
- [X] T026 Implement the baseline handlers with `openapi-msw`, all wrapped by the validator of T024:
  - `tests/mocks/handlers/public-config.ts`: `getPublicConfig` with `ETag` and `304` on `If-None-Match`, and `getPublicConfigLogo`;
  - `tests/mocks/handlers/auth.ts`: `getCsrfToken` (creates the anonymous session), `getSession` for every state, and `deleteSession`;
  - `tests/mocks/handlers/identity.ts`: `getIdentity`, deriving `scope` and `permissions` from the account;
  - `tests/mocks/handlers/index.ts`: a factory `createHandlers(stateResolver)`.

  The handlers apply the server idle timeout: a request after `idleTimeout` seconds without activity sees the session as ended.
- [X] T027 Create `tests/mocks/node.ts` (`setupServer` from `msw/node` with a single default scenario state) and wire it into `tests/setup/vitest.setup.ts`: `onUnhandledRequest: 'error'`, a reset after each test, and a test failure when the validator recorded a violation.
- [X] T028 Create the Node mock server `tests/mocks/server.ts` on port 4010 (R22):
  - `node:http` plus MSW 3 `getResponse(handlers, request)` for `/api/v2/*`;
  - `POST /__mock/scenarios` (`{ name, overrides }` returns `{ id }`), `PATCH /__mock/scenarios/:id` (changes flags and accounts at runtime), `GET /__mock/scenarios/:id/violations` and `GET /__mock/scenarios/:id/requests`;
  - scenario selection by the `mock-scenario` cookie, with `MOCK_DEFAULT_SCENARIO` as the fallback.

  Add the package scripts `mock:server` (`tsx tests/mocks/server.ts`), `mock:scenario` (prints a URL that sets the cookie for a scenario name), `dev:mock` (mock server plus `vite` with `API_PROXY_TARGET=http://127.0.0.1:4010`) and `preview:mock`.
- [X] T029 Create the end-to-end fixtures (R24):
  - `tests/e2e/fixtures/test.ts`: extends Playwright `test` with the fixtures below and the per-test assertions of zero contract violations and zero CSP violations;
  - `tests/e2e/fixtures/mock-api.ts`: `mockApi.use(name, overrides)`, `mockApi.patch(changes)`, `mockApi.requests()`;
  - `tests/e2e/fixtures/a11y.ts`: `expectAccessible(page)` with the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa`, run once in light and once in dark. It toggles the `.dark` class on `<html>` together with `emulateMedia`, so both themes are checked whatever theme the scenario's profile chose (FR-079, SC-004);
  - `tests/e2e/fixtures/csp.ts`: an init-script listener for `securitypolicyviolation`;
  - `tests/e2e/fixtures/layout.ts`: `expectNoHorizontalScroll(page, { widths: [360, 320] })`, and `expectTouchTargets(page)` (≥ 44 × 44 px for visible buttons, inputs, selects and standalone links; links in running text exempt);
  - `tests/e2e/fixtures/webauthn.ts`: CDP virtual authenticator (ctap2, internal, resident key, user verification), `addCredential`, `withoutPasskeySupport()` (an init script deleting `PublicKeyCredential`), `stubCredentialsRejection(name)`, and `stubCredentials(credential)`. The last replaces `navigator.credentials.get` and `create` with a stub that resolves with a contract-valid fake credential from `tests/mocks/factories/webauthn.ts`, so tests that only need a submitted credential also run on WebKit (R24).

  *Implementation note*: three fixes made while running the T048 checkpoint. `mockApi.use` sets the `mock-scenario` cookie with `path: /`: a cookie set from the app URL got the path `/ng/` and never reached `/api/v2`. `expectNoHorizontalScroll` waits two animation frames after each resize, so that media-query listeners (the navigation drawer) re-render before it measures. `expectAccessible` switches the theme as the app does (the class and the inline `color-scheme`), then waits two animation frames and, on WebKit, 150 ms more: behind a modal dialog WebKit briefly reports the previous theme's inherited text colours, which axe read as contrast failures.

### Tests for the core (write first; must fail)

- [X] T030 [P] Write `tests/unit/api/client.spec.ts` and `tests/unit/api/query-client.spec.ts` (R7, R8, R9). `query-client.spec.ts` must check the `QueryClient` defaults: `staleTime` 30 s, `refetchOnWindowFocus` and `refetchOnReconnect` false, and no `refetchInterval`, which FR-033 depends on. It must also check the retry policy (once only after a network error or a non-problem 5xx, never after a 4xx, never for mutations), and that the `onError` hooks dispatch `unauthenticated`, `second-factor-required`, `pending-action-required` and `forbidden` to the session reactions. `client.spec.ts` must check:
  - `X-CSRF-Token` is sent on POST, PATCH and DELETE only;
  - the token fetch is single-flight under concurrent writes;
  - a `csrf-token-mismatch` leads to one silent refresh and replay with the original body (FR-035), and a second mismatch or `unauthenticated` emits the session-ended signal;
  - problem+json becomes `ApiProblem`, with `fieldErrors`, `retryAfter`, `pendingActions`, `requestId` and `serverDate` from the `Date` header; a network error becomes `kind: 'network'`; a non-problem response of 500 or more, such as an HTML 502 from nginx, becomes `kind: 'unavailable'`;
  - activity is recorded for every response except `401 unauthenticated`;
  - requests use `cache: 'no-store'`, except `getPublicConfig` with `'no-cache'`;
  - no client-side timeout applies;
  - `X-API-Key` is never sent (FR-070);
  - a 419 is treated as a generic problem.
- [X] T031 [P] Write `tests/unit/i18n/problems.spec.ts` and `tests/unit/i18n/format.spec.ts` (R15). `problems.spec.ts` must check that:
  - every problem type named in `contract/openapi.json` maps to `problem.<name>`;
  - an unknown type falls back to `problem.status.<status>`, then to `problem.generic`;
  - `validation.<code>` gets the parameters `max` and `min` as numbers, `allowed` as an `Intl.ListFormat` list, and `allowedRoles` as translated role names;
  - `invalidFormat` selects the message `validation.format.<format>`, and an unknown format falls back to `validation.invalidFormat`;
  - an unknown code becomes `validation.invalid`, tested with plain values (FR-076).

  `format.spec.ts` must check that dates, numbers and relative times are formatted per locale in the device time zone (FR-087).
- [X] T032 [P] Write `tests/unit/app/preferences/locale.spec.ts` and `tests/unit/app/preferences/theme.spec.ts`.
  - `locale.spec.ts` covers the FR-060 and FR-061 matrix:
    - available = server ∩ {en-gb, cs-cz, sk-sk};
    - none available means en-gb, no choice and no language saved, while the theme can still be saved (`canSave` per field);
    - one available means no choice;
    - the order remembered, then browser, then server default, then en-gb;
    - a profile language enabled on the server but not translated by the app (`de-de`) falls back to that order without overwriting the profile;
    - `<html lang>` is set to BCP 47.
  - `theme.spec.ts`: `system` follows `matchMedia` changes without a reload (FR-062), `.dark` and `color-scheme` are applied, and `mailcowui-ng.theme` is written.
- [X] T033 [P] Write `tests/unit/shared/platform/storage.spec.ts` and `tests/unit/shared/platform/broadcast.spec.ts`.
  - Storage: only the keys of data-model §4 can be written (FR-091), and a throwing `localStorage` or `sessionStorage` never breaks the caller (edge "storage disabled").
  - Broadcast: messages are versioned, and an unknown `v` or `type` is ignored.
- [X] T034 [P] Write `tests/unit/shared/security/sanitize.spec.ts` and `tests/unit/shared/security/safe-url.spec.ts` (R17, SC-013).
  - The sanitiser test runs the injection vector table (`<script>`, `onerror`, `javascript:` and `data:` hrefs, `<iframe>`, `<form>`, `<svg onload>`, `<style>`, `<img src=//evil>`, `<math>` mutation XSS, `<a href=" javascript:">`). Each vector must be neutralised, while `p br strong b em i u small h1–h6 ul ol li a blockquote` and `http`, `https` and `mailto` links are kept, with `rel="noopener noreferrer nofollow"`.
  - `safeHref` accepts http(s) and same-origin paths and rejects `javascript:`, `data:` and `//host` values.
- [X] T035 [P] Write `tests/unit/shared/validation/ip-network.spec.ts` and `tests/unit/shared/validation/limits.spec.ts`.
  - `ip-network.spec.ts`: IPv4 addresses and prefixes `/0–32`, IPv6 addresses (compressed and full) and prefixes `/0–128` are accepted. Out-of-range octets and prefixes, extra characters and over-long values (> 49 characters) are rejected.
  - `limits.spec.ts`: every constant of `limits.ts` equals its `maxLength` or `maxItems` in `contract/openapi.json`, for example `ApiKeyCreateRequest.name` 255, `allowedNetworks` 100 and 49, `eventType` 20 and `password` 4096 (data-model §6).
- [X] T036 [P] Write `tests/unit/shared/platform/webauthn.spec.ts` (R14). It covers:
  - support detection (secure context and `PublicKeyCredential`);
  - `isConditionalMediationAvailable`;
  - the unpadded base64url round trip;
  - option conversion through the native `parse*FromJSON` and through the fallback (`challenge`, `user.id`, `allowCredentials` and `excludeCredentials` IDs, and `extensions.appid` passed through);
  - credential serialisation through `toJSON` and through the fallback, matching the generated request types;
  - the single abort controller: a new ceremony aborts the previous one;
  - the error mapping table of R14.
- [X] T037 [P] Write `tests/unit/app/router/return-to.spec.ts` (FR-092). Accepted: `/api-keys?status=active`. Rejected: `//evil.example`, `/\evil`, `https://x`, `javascript:…`, control characters, more than 2,048 characters, sign-in routes, and non-strings.
- [X] T038 [P] Write `tests/unit/app/navigation/visibility.spec.ts`. It is table-driven over every catalogue row of data-model §2 × the roles admin, domainAdmin and mailboxUser × the flags `syncjobs`, `bccMaps`, `spamScore` and `spamPolicy` (on and off). It asserts `visibleEntries` and `canAccess` (FR-043, SC-007), and that every non-available entry produces a placeholder route.
- [X] T039 [P] Write `tests/unit/app/router/guards.spec.ts`. It covers:
  - the state-to-route table of research R11 (anonymous, pendingSecondFactor, restricted, active), on start and after every sign-in (FR-030);
  - `returnTo` carried to sign-in and to the second-factor step;
  - a refetch of the identity only when it is older than 5 minutes (FR-050);
  - a route the catalogue denies resolves, but is marked for `NoAccessState` (FR-045).
- [X] T040 [P] Write `tests/unit/app/bootstrap.spec.ts`, `tests/unit/app/branding/public-config.spec.ts` and `tests/unit/app/branding/app-links.spec.ts`.
  - The bootstrap test covers:
    - `GET /csrf-token` first, then `getSession` and `getPublicConfig` in parallel, then `getIdentity` only for active or restricted sessions;
    - a network error or any 5xx, including a non-JSON 502, shows `ServiceUnavailablePage` with a retry;
    - a public-config failure alone uses the FR-003 defaults with `location.hostname` as the product name.
  - `public-config.spec.ts`: the logo for the active theme, re-chosen when the theme changes; plain-text fields are never interpreted as HTML.
  - `app-links.spec.ts`: the login-page filter (`showOnLoginPage`), `%u` replaced with `encodeURIComponent(username)` in `signedInUrl`, `safeHref` dropping `javascript:` addresses, the configured order kept, and `appsLabel` falling back to `apps.defaultLabel` (FR-001a).
- [X] T041 [P] Write `tests/unit/app/session/session-end.spec.ts`. It covers:
  - a session end clears the query cache, sets `notice: 'sessionEnded'`, sets `returnTo` to the current path, replaces the route with sign-in and fetches a new CSRF token (FR-034);
  - a successful sign-out clears everything, broadcasts `signed-out` and fetches a new token (FR-036), and a failed one keeps the state and exposes a retry;
  - a received `session-changed` clears the cache and refetches, a received `signed-out` ends the session, and an identity refresh with a different username or role clears the cache (FR-037).
- [X] T042 [P] Write `tests/unit/shared/composables/useListState.spec.ts` (data-model §5). It covers:
  - parsing and normalisation with `replace`;
  - defaults omitted from the address;
  - `size` limited to 25, 50 or 100;
  - filter, sort and size changes resetting `page` and calling `onReset`;
  - `push` for explicit changes and `replace` for typing;
  - the mapping to `limit` and `offset`;
  - nothing written to storage.
- [X] T043 [P] Write `tests/unit/shared/composables/useVersionedSave.spec.ts`. It sends `If-Match` with the read `etag`. On a 412 problem it keeps the input, refetches, sets `outdated` and exposes the latest value. It never retries automatically and never sends `*`. A refused deletion asks for confirmation again (conventions).
- [X] T044 [P] Write `tests/unit/shared/composables/useCountdown.spec.ts` (R13). The skew is derived from the `Date` header. The remaining time counts against `Date.now() + skew`. Milestone callbacks fire, and recomputation happens on `visibilitychange`.
- [X] T045 [P] Write `tests/unit/shared/components/forms.spec.ts` for `useProblemForm`, `FormField.vue`, `ErrorSummary.vue` and `ProblemMessage.vue` (FR-075–FR-078). It covers:
  - field errors mapped by dot path, including `allowedNetworks.2`;
  - `aria-invalid` and `aria-describedby`;
  - a summary with in-page links when there is more than one error;
  - focus moved to the summary or the field;
  - the generic message with the request ID for unknown problems;
  - announcements made.
- [X] T046 [P] Write `tests/unit/shared/components/dialogs-and-lists.spec.ts` for:
  - `ConfirmDialog.vue` and `useConfirm`: promise-based, alertdialog role, Escape cancels, focus returns;
  - `ListState.vue`: loading, empty and error states with retry (FR-089);
  - `PaginationBar.vue`: total, page sizes 25/50/100, keyboard;
  - `LiveAnnouncer.vue`: polite and assertive regions;
  - `SanitizedHtml.vue`: renders sanitised HTML only;
  - `DateTime.vue` and `RelativeTime.vue`: `<time datetime>` with the absolute time available (FR-087).
- [X] T047 [P] Write `tests/unit/app/shell/shell.spec.ts` for `ShellLayout.vue` and the shell components. It covers:
  - a skip link to `<main id="main">`;
  - at < 1024 px, one header button opens the navigation drawer, which traps focus, closes with Escape and after a choice, and returns focus to the button (FR-046);
  - `NoAccessState` rendered in place without mounting the route component (FR-045);
  - `AppFooter` rendering sanitised `footerHtml`;
  - `AnnouncementBanner.vue` in both layouts (FR-048): shown only when `active` and `text` is set; the type given as an icon with a text alternative plus a visually hidden prefix; collapsible for the visit, keyed by a text hash in `sessionStorage`;
  - the user menu showing username, role, "Passkeys" and "Sign out" (FR-042);
  - the page title `"{page} – {pageTitle}"` (FR-049) and focus on the `<h1>` after navigation (FR-080).
- [X] T048 [P] Write `tests/e2e/shell/foundation.spec.ts`. It uses only routes that exist after Phase 2 (the generated placeholders and the catch-all):
  - `Edge: API not ready`: with `route.abort()` on `/api/v2/**`, with an HTML 502 from `route.fulfill()`, and with the `bootstrap-500` scenario, the full-page message is shown, and its retry recovers once the routes are released;
  - `admin-active` opening `/ng/domains` renders the shell, the catalogue navigation, the drawer at 360 px and the placeholder, with no CSP violation, no horizontal scroll at 360 and 320 px, and no axe violation in either theme;
  - the not-found page for an unknown address, with a link home.

### Core implementation

- [X] T049 Implement `src/api/problem.ts` (`ApiProblem` with fields typed from the generated `Problem`, `TooManyRequestsProblem`, `FieldViolation` and `PendingAction`; type guards; `problemName(type)` returning the last segment of `/api/v2/problems/<name>`, with no hand-written list of types), `src/api/csrf.ts` (an in-memory token with a single-flight refresh), `src/api/activity.ts`, `src/api/client.ts` (`createClient<paths>` with `baseUrl: '/api/v2'`, `credentials: 'same-origin'` and the middleware order of R8) and `src/api/index.ts` (the only barrel: the client, the re-exported root types, the enumeration arrays and `ApiProblem`), so that T030 passes.
- [X] T050 Implement `src/api/query/client.ts` and `src/api/query/keys.ts`:
  - `QueryClient` defaults per research R9: `staleTime` 30 s, `refetchOnWindowFocus` and `refetchOnReconnect` false, and the retry policy of R8;
  - `QueryCache` and `MutationCache` `onError` hooks for `unauthenticated`, `second-factor-required`, `pending-action-required` and `forbidden`, delegating to `src/app/session`;
  - the typed key factory of data-model §3, with list parameter types aliased from the generated `operations[…]['parameters']['query']`.

  The query-client part of T030 must pass.
- [X] T051 [P] Implement `src/shared/platform/storage.ts` (an allowlist of the data-model §4 keys, every call in `try/catch`), `src/shared/platform/broadcast.ts` and `src/shared/platform/clipboard.ts` (`navigator.clipboard.writeText` with a refusal result), so that T033 passes.
- [X] T052 [P] Implement `src/shared/security/sanitize.ts` (the DOMPurify allowlist and hook of R17) and `src/shared/security/safe-url.ts`, so that T034 passes.
- [X] T053 [P] Implement `src/shared/validation/ip-network.ts` and `src/shared/validation/limits.ts` (the contract limits of data-model §6, each with a comment naming its schema path), so that T035 passes.
- [X] T054 [P] Implement `src/shared/platform/webauthn/support.ts`, `base64url.ts`, `options.ts`, `credential.ts`, `errors.ts` and `ceremony.ts`, so that T036 passes.
- [X] T055 Implement the i18n core:
  - `src/i18n/index.ts`: `createI18n`, `legacy: false`, `en-gb` bundled, `cs-cz` and `sk-sk` as lazy chunks, `DefineLocaleMessage` typing from `en-gb`;
  - `src/i18n/locales.ts`: the codes and `toBcp47`;
  - `src/i18n/format.ts`;
  - `src/i18n/problems.ts`.

  Seed `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json` with the shared namespaces `common`, `problem.*` (every `KnownProblemType`, `status.*`, `generic`), `validation.*` (every `ValidationRuleCode`, `format.*`, `invalid`), `roles.*`, `themes.*`, `states.*`, `nav.*` (every catalogue entry) and `a11y.*`. Create the initial `src/i18n/legacy-map.json`, and run `npm run i18n:import` to generate `src/i18n/legacy/*.json`. T031 must pass, and `npm run i18n:check` must pass.

  *Implementation note*: `DefineLocaleMessage` gives key completion, but vue-i18n 11's `t()` accepts any string (its key parameter is `Key extends string`), so an unknown key is not a type error as research R15 assumed. Completeness and placeholders stay guarded by `npm run i18n:check` and the tests.

- [X] T056 Implement `src/app/preferences/store.ts`, `src/app/preferences/theme.ts` and `src/app/preferences/locale.ts` (R15, R16), so that T032 passes.
- [X] T057 Implement `src/app/branding/public-config.ts` (the query, logo per theme, and the plain-text fields), `src/app/branding/defaults.ts` (the FR-003 neutral defaults using `location.hostname`, with no product name in the source) and `src/app/branding/app-links.ts` (the `AppLinkView` of data-model §2: `safeHref`, `%u` replaced with `encodeURIComponent`, the login-page filter, and `appsLabel` falling back to `apps.defaultLabel`). The branding part of T040 must pass.
- [X] T058 Implement `src/app/session/store.ts` (the data-model §4 fields), `src/app/session/queries.ts` (the `session` and `identity` queries), `src/app/session/session-end.ts`, `src/app/session/sign-out.ts` and `src/app/session/cross-tab.ts` (BroadcastChannel wiring, and the identity mismatch check), so that T041 passes.
- [X] T059 Implement `src/app/navigation/catalogue.ts` (the 17 rows of data-model §2, with the per-role `access` and `classic` addresses of research R19), `src/app/navigation/visibility.ts` and `src/app/navigation/classic-links.ts` (the classic sign-in, reset and section addresses), so that T038 passes. Every row starts with `status: 'placeholder'`; the stories flip `home` (T083), `passkeys` (T106), `apiKeys` (T129) and `auditLog` (T139) to `available`, so no entry ever leads to "not found" (SC-007).
- [X] T060 Implement:
  - `src/app/router/index.ts`: `createWebHistory(import.meta.env.BASE_URL)`;
  - `src/app/router/routes.ts`: the route map of data-model §5, the generated `placeholder-<id>` routes and the catch-all, each feature registered through its `routes.ts`;
  - `src/app/router/guards.ts`: the state machine of R11 and identity freshness;
  - `src/app/router/return-to.ts`;
  - `src/app/router/focus.ts`: focus on the `<h1 tabindex="-1">` after navigation;
  - `src/app/router/title.ts`.

  T037 and T039 must pass.

  *Implementation note*: until a later story registers `sign-in`, `sign-in-second-factor` or `pending-actions`, the guard lets a navigation that would go there proceed; redirects to "home" use the path `/`, which resolves to `placeholder-home` until US1 registers `home`. The session wiring (reactions, client signal, cross-tab, mirrors) is `src/app/session/index.ts`, with `context.ts` and `reroute.ts` beside it.

- [X] T061 [P] Implement `src/shared/composables/useListState.ts`, `useVersionedSave.ts`, `useCountdown.ts`, `useAnnouncer.ts`, `useMediaQuery.ts`, `useConfirm.ts` and `useProblemForm.ts`, so that T042, T043 and T044 pass.
- [X] T062 Implement `src/shared/components/SanitizedHtml.vue` (the only `v-html`, with a justified ESLint disable), `LiveAnnouncer.vue`, `ListState.vue`, `PaginationBar.vue` (on `src/shared/ui/pagination`), `ConfirmDialog.vue` (Reka `AlertDialog`), `FormField.vue`, `ErrorSummary.vue`, `ProblemMessage.vue`, `DateTime.vue`, `RelativeTime.vue` and `PageHeader.vue`, so that T045 and T046 pass.
- [X] T063 Implement `src/app/states/NoAccessState.vue` (explanation and a link home), `src/app/states/NotFoundPage.vue`, `src/app/states/ServiceUnavailablePage.vue` (a retry that re-runs the bootstrap) and a minimal `src/app/states/PlaceholderPage.vue`. The placeholder shows the section name and "comes in a later version", and requests no data. US3 completes it.
- [X] T064 Implement `src/app/layouts/AuthLayout.vue` and `src/app/layouts/ShellLayout.vue`, adapted from TailAdmin `AuthLayout` and `AdminLayout`, with `NoAccessState` rendered in place from `canAccess`. Also implement these shell components:
  - `src/app/shell/AppHeader.vue`: logo, drawer button, user menu slot;
  - `src/app/shell/NavigationDrawer.vue`: a Reka `Dialog` below `lg`;
  - `src/app/shell/NavigationList.vue`: `visibleEntries`, rendered as a static `<nav>` from `lg` up;
  - `src/app/shell/UserMenu.vue`: username, role, Passkeys link and Sign out;
  - `src/app/shell/AppFooter.vue`, `src/app/shell/SkipLink.vue` and `src/app/shell/BrandLogo.vue` (falls back to the product name on `error`);
  - `src/app/shell/AnnouncementBanner.vue`, placed in both layouts (FR-048).

  T047 must pass.
- [X] T065 Implement `src/app/bootstrap.ts` (R11 order), `src/main.ts` (`createApp`, Pinia, Vue Query, i18n, router, bootstrap before mount) and `src/App.vue` (`<RouterView>`, `LiveAnnouncer`, and the `ConfirmDialog` host), so that T040 and T048 pass. Run `npm run build && npm run budget:check` to record the baseline size.

  *Implementation note*: baseline after Phase 2: 147.8 KB gzipped initial JavaScript (entry 99.2 KB plus a shared chunk of 48.6 KB), budget 200 KB. The bootstrap also applies the server languages, the device settings and the profile preferences (`src/app/bootstrap.ts`).

**Checkpoint**: The foundation is ready. All Phase 2 tests pass, and the app boots against the mock
with the strict CSP. An active session opening a placeholder address, such as `/ng/domains`,
renders the shell with catalogue navigation. The sign-in and home routes arrive with US1. User
stories can now start.

---

## Phase 3: User Story 1 - Sign in with username and password, complete a second factor, sign out (Priority: P1) 🎯 MVP

**Goal**: Password sign-in for every role, with the second-factor step (WebAuthn, TOTP, Yubico OTP),
role-specific screens, login page options, throttling, the idle warning, the session end and
sign-out.

**Independent Test**: Against the mock, sign in with accounts of all three roles, with and without
second factors, on 360 px and desktop. Complete the second factor, reach home and sign out, and
repeat every failure scenario of US1.

### Tests for User Story 1 (write first; must fail)

- [X] T066 [US1] Extend the mock handlers for US1:
  - `tests/mocks/handlers/auth.ts`: `createSession`, `verifySecondFactor`, `createSecondFactorWebAuthnChallenge`, `cancelPendingSignIn`, `csrf-token-mismatch` injection, and the server idle expiry. Expiry can also be triggered through `PATCH /__mock/scenarios/:id` (`{ expireSession: true }`), because `page.clock` moves only the browser's clock, not the mock server's. `createSession` covers:
    - a generic `sign-in-failed`, and a 422 for an invalid body;
    - throttling to `429` with `retryAfter` after the scenario threshold;
    - a deliberate response delay;
    - `pendingSecondFactor` with methods ordered webauthn, totp, yubiOtp and their `tier`;
    - `restricted`, and `403 second-factor-unavailable`.

    `verifySecondFactor` covers TOTP, Yubico OTP and WebAuthn success, `second-factor-failed` cancelling the pending sign-in, a method that vanished, and `503 temporary-verification-failure` with `Retry-After`.
  - `tests/mocks/scenarios/index.ts`: register the scenarios `admin-password`, `domain-admin-password`, `mailbox-password`, `mailbox-all-factors`, `totp-two-methods`, `yubi-only`, `u2f-only`, `throttled`, `slow-sign-in`, `yubico-outage`, `short-idle` (idleTimeout 150 s), `force-sso`, `hidden-admin-link`, `idp-configured`, `logo-broken`, `help-html-malicious` and `csrf-expired`, in `tests/mocks/scenarios/sign-in.ts`. `config-unavailable` comes from T025.

  *Implementation note*: the mock returns `PendingSignIn.methods` in the recommended order whatever the account's order (`sessionBody`), and the Yubico OTP of `accounts.ts` is now 44 characters, as the contract requires. Handler checks are in `tests/unit/mocks/sign-in-handlers.spec.ts`.
- [X] T067 [P] [US1] Write `tests/e2e/sign-in/sign-in-screen.spec.ts`. It covers:
  - US1-AS1 and FR-001: logo for the theme, product name, announcement, help text, and app links under the "Apps" text, without horizontal scroll;
  - FR-003: the `config-unavailable` defaults;
  - Edge: a broken logo shows the product name;
  - FR-002: the malicious help text is neutralised and the formatting kept;
  - FR-009: the "Forgot password?" link to `/reset-password`;
  - FR-049: the page title;
  - US1-AS14: role links follow the login page options, and the admin screen names its role;
  - US1-AS15: force SSO on the neutral screen shows the notice and passkey, with no form, while the admin screen keeps the form;
  - Edge: force SSO without passkey support;
  - US1-AS16: the identity-provider hint up front;
  - Edge: a 255-character product name wraps;
  - every state above has no horizontal scroll at 360 and 320 px.
- [X] T068 [P] [US1] Write `tests/e2e/sign-in/password-sign-in.spec.ts`. It covers:
  - US1-AS2: an admin without second factors lands on home with the admin navigation, and home greets them with the username and the translated role (FR-047, first bullet);
  - US1-AS5: the generic message, username kept, password cleared, message announced, focus moved (FR-018);
  - US1-AS6: on `throttled` with `page.clock`, a retry countdown, the button disabled, and re-enabling announced;
  - FR-016 and FR-081: autocomplete attributes, paste and password managers allowed with no cognitive test, a labelled show/hide toggle operable by keyboard;
  - FR-017 and `slow-sign-in`: a busy state with no double submit and no timeout, with the progress announced in the polite live region;
  - FR-005 and FR-019: a role screen sends `role`, asserted through `mockApi.requests()`.
- [X] T069 [P] [US1] Write `tests/e2e/sign-in/second-factor.spec.ts`. It covers:
  - US1-AS3: method order, Yubico OTP under "Other methods", and TOTP to home;
  - US1-AS4: two authenticators choose by name; one is preselected with focus on the code;
  - US1-AS7: a wrong code returns to the password step with the username kept;
  - US1-AS8: with `page.clock`, the one-minute warning, then a timeout with the username kept;
  - US1-AS9: Cancel;
  - US1-AS10: the Yubico outage keeps the step and allows a retry or another method;
  - US1-AS11: U2F-only shows the "ask an administrator" message;
  - US1-AS13: a reload resumes the step with the remaining time;
  - Edge: a Yubico-only account is shown directly;
  - Edge: a factor deactivated between the steps;
  - FR-022: the code format check (exactly six digits after stripping spaces) and FR-023 (44 letters or digits);
  - `@virtual-authenticator`: the WebAuthn second factor succeeds;
  - FR-021: a cancelled WebAuthn prompt (`stubCredentialsRejection('NotAllowedError')`) keeps the step open, sends no verification request, and allows a retry or another method.
- [X] T070 [P] [US1] Write `tests/e2e/sign-in/session-lifecycle.spec.ts`. It covers:
  - US1-AS12: after sign-out a confirmation, and Back reveals no content (SC-009);
  - FR-036: a sign-out network failure reports "could not be confirmed" with a retry;
  - US1-AS17: on `short-idle` with `page.clock`, the warning 2 minutes before expiry is announced; "Stay signed in" sends `GET /session` and continues; ignoring it shows sign-in with an explanation and returns to the same page after sign-in; no request is sent while idle (SC-014);
  - Edge: activity in a second page of the same context suppresses the warning;
  - FR-031: a signed-out deep link reaches its page after sign-in;
  - FR-092: a hostile `returnTo` is ignored;
  - FR-034: a 401 from any request shows the session-ended message;
  - FR-035: on `csrf-expired`, a silent retry succeeds, and a second failure ends the session;
  - FR-037: sign-out in another page discards data on the next request, and a sign-in as another account in a second page makes the first page discard the previous account's data and show the new session's state;
  - Edge: an account deactivated while signed in;
  - Edge: network loss gives a translated message with a retry and nothing reported as saved.
- [X] T071 [P] [US1] Write `tests/unit/features/auth/SignInPage.spec.ts`. It covers the role headings and "Not the correct login?" links per `loginPage` options (FR-005, FR-006), the force-SSO rules (FR-007), the identity-provider hint (FR-008), the forgot-password link (FR-009), the notices from the session store, and the app links section hidden when none is shown on the login page (FR-001a).
- [X] T072 [P] [US1] Write `tests/unit/features/auth/PasswordForm.spec.ts` (labels, autocomplete, show/hide toggle, password cleared and username kept after failure, focus) and `tests/unit/features/auth/useThrottle.spec.ts` (countdown from `retryAfter`, announcements only at the start and on re-enabling).
- [X] T073 [P] [US1] Write `tests/unit/features/auth/useSecondFactor.spec.ts` and `tests/unit/features/auth/SecondFactorPage.spec.ts`. They cover:
  - `tier` grouping, with advanced methods shown directly when no primary method exists (FR-020);
  - TOTP preselection and choice (FR-022);
  - client validation `^[0-9]{6}$` after stripping whitespace and `^[A-Za-z0-9]{44}$`;
  - the outcome-to-transition table of data-model §7;
  - the countdown warning at 60 s (FR-025).
- [X] T074 [P] [US1] Write `tests/unit/app/session/idle-timer.spec.ts` and `tests/unit/app/session/IdleWarningDialog.spec.ts`. They cover:
  - deadline = `lastActivityAt + idleTimeout`, with the warning at −120 s;
  - activity broadcasts reset the timer;
  - recomputation on `visibilitychange`;
  - expiry runs the session end without a request;
  - "Stay signed in" calls `getSession` once;
  - announcements at 120, 60 and 30 s (FR-082);
  - an alertdialog that traps focus.
- [X] T075 [P] [US1] Write `tests/smoke/fixtures/accounts.ts` (the seeded accounts and `Passw0rd!dev`, overridable through `SMOKE_ADMIN_USERNAME`, `SMOKE_ADMIN_PASSWORD` and the matching variables for the other roles, for quickstart Part D), `tests/smoke/fixtures/totp.ts` (RFC 6238 with `node:crypto`, waiting for a fresh 30 s step) and `tests/smoke/sign-in.smoke.spec.ts`. The smoke spec covers:
  - `admin`, `reseller` and `alice@example.org` (with TOTP) sign in and sign out, tagged `@read-only` for the password-only case;
  - a random unknown username gets the generic failure;
  - `/ng/` responds with the CSP header of R18; only the CSP is asserted, because nginx-mailcow adds the other headers;
  - one case runs at 360 × 780 through `test.use({ viewport })`: the `admin` sign-in with no horizontal scroll (R25).

### Implementation for User Story 1


  *Implementation note*: shared steps are in `tests/smoke/fixtures/flows.ts`. The suite runs in T150.
- [X] T076 [US1] Implement `src/features/auth/api.ts`. It holds the `createSession`, `verifySecondFactor`, `createSecondFactorWebAuthnChallenge` and `cancelPendingSignIn` mutations, with the cache writes and broadcasts of data-model §3.
- [X] T077 [P] [US1] Implement these components in `src/features/auth/components/`:
  - `SignInHeader.vue`: logo and product name;
  - `RoleLinks.vue`: FR-006;
  - `SsoNotice.vue`: FR-007, linking to `/`;
  - `IdpHint.vue`: FR-008;
  - `AppLinksSection.vue`: FR-001a;
  - `SignInNotice.vue`: one-shot notices, announced.
- [X] T078 [P] [US1] Implement `src/features/auth/composables/usePasswordSignIn.ts`, `src/features/auth/composables/useThrottle.ts` and `src/features/auth/components/PasswordForm.vue`. The form has `autocomplete="username"` and `current-password`, `autocapitalize="none"`, `autocorrect="off"`, `spellcheck="false"`, a show/hide toggle, a busy state, a cleared password and focus handling (FR-016–FR-019).
- [X] T079 [US1] Implement `src/features/auth/pages/SignInPage.vue` (a `role` prop, a help text through `SanitizedHtml`, notices), `src/features/auth/routes.ts` (`sign-in`, `sign-in-admin`, `sign-in-domain-admin`, `sign-in-mailbox-user`) and `src/features/auth/index.ts`. Register the routes in `src/app/router/routes.ts`.

  *Implementation note*: `RouteMeta.public` (docs/conventions.md) replaces the foundation's `access: 'public'`; a route with `meta.public` resolves in every session state. "Not found" is not public: it shows signed out, while a pending step or a restriction still routes to its screen (FR-038).
- [X] T080 [P] [US1] Implement `src/features/auth/composables/useSecondFactor.ts`, `src/features/auth/composables/usePendingSignInTimer.ts` (on `useCountdown`) and these components:
  - `src/features/auth/components/TotpForm.vue`: `inputmode="numeric"`, `autocomplete="one-time-code"`, and an authenticator radio group when there is more than one;
  - `src/features/auth/components/YubiOtpForm.vue`;
  - `src/features/auth/components/WebAuthnFactor.vue`: uses `src/shared/platform/webauthn`;
  - `src/features/auth/components/OtherMethods.vue`: a Reka `Collapsible`.
- [X] T081 [US1] Implement `src/features/auth/pages/SecondFactorPage.vue` and its `sign-in-second-factor` route. It handles the limit, the one-minute warning, Cancel and every outcome of data-model §7, and resumes after a reload from `getSession` (FR-020–FR-029).
- [X] T082 [P] [US1] Implement `src/app/session/idle-timer.ts` and `src/app/session/IdleWarningDialog.vue` (Reka `AlertDialog`), and mount them in `src/App.vue` (R12, FR-032, FR-033).

  *Implementation note*: `installSession` installs the idle timer. The `session` query is never garbage-collected (`setQueryDefaults` in `src/api/query/client.ts`), because the timer and the guard read it while no component observes it. The step deadline counts against `useSessionStore().clockSkew`, recorded from the `Date` header of every session answer (`recordSessionClock`).
- [X] T083 [US1] Implement `src/features/home/index.ts`, `src/features/home/routes.ts` and `src/features/home/pages/HomePage.vue`, showing a greeting with the username and the translated role (FR-047, first bullet). Register the routes in `src/app/router/routes.ts`, and set the catalogue's `home` entry to `available` in `src/app/navigation/catalogue.ts`.
- [X] T084 [US1] Add the `auth.signIn.*`, `auth.secondFactor.*`, `session.*` and `home.greeting` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. Add `src/i18n/legacy-map.json` entries for reused legacy keys whose meaning is unchanged (for example `login.username`, `login.password`, `login.login_user`, `login.login_admin`, `login.login_dadmin`, `login.forgot_password` and the TOTP and Yubico OTP labels). The upstream `sk-sk` file lacks `login.login_user`, `login.login_admin`, `login.login_dadmin` and `login.forgot_password`, so write their Slovak values in `src/i18n/messages/sk-sk.json` (research R15). Run `npm run i18n:import`. `npm run i18n:check` must pass.

**Checkpoint**: US1 works on its own: all T066–T075 tests pass. This is the MVP.

---

## Phase 4: User Story 2 - Sign in with a passkey (Priority: P1)

**Goal**: Usernameless passkey sign-in as the first and most prominent action, plus passkeys in
the username autofill, with silent cancellation and generic rejection.

**Independent Test**: With a virtual authenticator holding a credential the mock accepts, sign in
for each role and confirm the landing. Repeat with a cancelled prompt, a rejected assertion,
throttling, a device without passkey support and an account with pending actions.

### Tests for User Story 2 (write first; must fail)

- [X] T085 [US2] Extend the handlers and scenarios for passkey sign-in:
  - `tests/mocks/handlers/auth.ts`: `createPasskeyChallenge` (single use, replaced by the next request, `expiresAt` in 5 minutes) and `createSessionWithPasskey` (a known active credential signs in; unknown, inactive or role-mismatched credentials get the generic `sign-in-failed`; throttling per client address; a restricted outcome for forced accounts);
  - `tests/mocks/scenarios/index.ts`: the scenarios `passkey-user`, `passkey-admin`, `passkey-forced-password-change` and `passkey-throttled`;
  - seeded-credential helpers in `tests/mocks/factories/webauthn.ts`, matching `tests/e2e/fixtures/webauthn.ts` `addCredential`.

  *Implementation note*: the seeded credential IDs are `SEEDED_CREDENTIALS` in `tests/mocks/factories/webauthn.ts`. The end-to-end stubs keep conditional requests pending until the test releases them (`stubCredentials(id, { conditional: 'release' })`), record every call (`credentialCalls()`), and `withoutConditionalMediation()` stops Chromium's virtual authenticator from answering the autofill request by itself.
- [X] T086 [P] [US2] Write `tests/e2e/passkey-sign-in/passkey-sign-in.spec.ts`. It covers:
  - US2-AS1: the passkey action is first and most prominent, with the form below;
  - `@virtual-authenticator` US2-AS2: sign-in without username, password or second factor;
  - US2-AS3: on `withoutPasskeySupport`, no action and no error;
  - US2-AS4: on `stubCredentialsRejection('NotAllowedError')`, no error, and both options remain;
  - US2-AS5: with `stubCredentials` submitting an unknown credential, the generic message suggests the password;
  - US2-AS6: with `stubCredentials`, throttling;
  - US2-AS7 is tested in US5 (T111), because it needs the pending-actions screen; here only the `restricted` session response is asserted through `mockApi.requests()`;
  - `@virtual-authenticator` US2-AS8: the domain-administrator screen with a mailbox user's passkey fails generically;
  - US2-AS9: the username field has `autocomplete="username webauthn"`, `navigator.credentials.get` is called only with `mediation: 'conditional'` on load, and no modal prompt opens;
  - Edge: two pages take each other's challenge, and the losing page restarts silently.
- [X] T087 [P] [US2] Write `tests/unit/features/auth/usePasskeySignIn.spec.ts` (abort of the conditional request first, the challenge, `get`, the assertion with `role`, the error mapping of R14) and `tests/unit/features/auth/useConditionalPasskey.spec.ts`. The second covers:
  - a start on mount only when conditional mediation is available;
  - a restart 30 s before `expiresAt` while the page is visible, and on `visibilitychange`;
  - an abort on unmount, on a modal ceremony and on a password submit;
  - never a modal prompt.

### Implementation for User Story 2

- [X] T088 [US2] Implement `src/features/auth/composables/usePasskeySignIn.ts`, `src/features/auth/composables/useConditionalPasskey.ts` and `src/features/auth/components/PasskeySignInButton.vue`, which is rendered only when `passkeysSupported` (FR-010–FR-014).

  *Implementation note*: background failures of the autofill request stay silent and never loop; only a passkey the user picked reports a failure, and a taken challenge restarts the request with "Choose your passkey again." The password form's action becomes the secondary style when the passkey action is shown (`data-variant`).
- [X] T089 [US2] Integrate passkey-first into `src/features/auth/pages/SignInPage.vue` and `src/features/auth/components/PasswordForm.vue`:
  - the passkey action above the form;
  - `autocomplete="username webauthn"`;
  - the conditional request aborted on password submit;
  - passkey sign-in kept under force SSO (FR-007);
  - `role` sent on the role screens (FR-011).
- [X] T090 [US2] Add the `auth.passkey.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, using "passkey" wording only (FR-015). Reuse legacy keys through `src/i18n/legacy-map.json` only where the meaning is unchanged and no "FIDO2" or "Touch ID" text is involved, and re-run `npm run i18n:import`.

**Checkpoint**: US1 and US2 both work on their own. The passkey smoke test runs in US4 (T105),
because it needs registration first.

---

## Phase 5: User Story 3 - Navigate the app according to role and permissions (Priority: P1)

**Goal**: Catalogue-driven navigation per role and flags, placeholders with classic-interface
links, "no access" in place, the home screen summary, the apps menu, and the announcement and
footer on every page.

**Independent Test**: Sign in as each role with different flags, compare the visible navigation
with the catalogue, open every entry (working screen or placeholder), and open restricted
addresses directly ("no access" with no data request).

### Tests for User Story 3 (write first; must fail)

- [X] T091 [US3] Extend `tests/mocks/scenarios/index.ts` and `tests/mocks/handlers/identity.ts` with:
  - the scenarios `domain-admin-two-domains`, `domain-admin-no-domains`, `domain-admin-no-syncjobs`, `domain-admin-bcc`, `mailbox-no-spam-flags`, `mailbox-spam-score`, `mailbox-spam-policy`, `mailbox-syncjobs` and `flags-change`, where flags change through `PATCH /__mock/scenarios/:id`;
  - the app-link variants `app-links-webmail-and-two`, `app-links-groupware-disabled`, `app-links-none` and `app-links-javascript-url`;
  - `announcement-info`, `announcement-warning`, `announcement-danger` and `footer-malicious`;
  - `forbidden` injection for any operation.
- [X] T092 [P] [US3] Write `tests/e2e/navigation/navigation.spec.ts`. It covers:
  - US3-AS1 and US3-AS2: the visible entries equal the catalogue for each role and flag scenario (SC-007);
  - US3-AS3: each placeholder names its section, says it comes later and links to the classic address for the role;
  - US3-AS4: `/ng/api-keys` as a domain administrator shows "no access" with a link home, and `mockApi.requests()` contains no `listApiKeys`;
  - US3-AS5: at 360 px, one visible control opens the drawer, which works by touch and keyboard, closes after a choice and with Escape, and returns focus;
  - US3-AS7: flags changed, then a `forbidden` response or a navigation after 5 minutes (`page.clock`) refreshes the navigation (FR-045, FR-050);
  - Edge: a deep link to a section the role may not use shows "no access" after sign-in;
  - every catalogue entry visible to a role resolves to a working screen or a placeholder, never to not-found (SC-007).

  *Implementation note*: US3-AS7 covers the five-minute refresh here; the `forbidden` path needs a section request, so it is tested with the home screen's passkey read of US4 (`tests/e2e/passkeys/passkey-suggestion.spec.ts`).
- [X] T093 [P] [US3] Write `tests/e2e/navigation/home-and-shell.spec.ts`. It covers:
  - US3-AS6: home lists the two domains, or says that none are assigned;
  - home for an admin (all domains) and a mailbox user (the mailbox address) with shortcuts equal to the visible entries (FR-047);
  - US3-AS8: the announcement on every page with its type in text, not only colour (FR-084), collapsible for the visit, and the sanitised footer (FR-002, FR-048);
  - US3-AS9: the apps menu order under `appsLabel`, `%u` replaced and encoded, webmail missing when the groupware is disabled, no menu without links, and a `javascript:` link not rendered;
  - Edge: a 255-character username wraps or truncates in the header and user menu at 360 px, with the full value available.
- [X] T094 [P] [US3] Write `tests/unit/features/home/HomePage.spec.ts`: the greeting, the scope per role (`allDomains`, `domains` with an empty list, `mailbox`), and shortcuts equal to `visibleEntries` minus home.
- [X] T095 [P] [US3] Write `tests/unit/app/shell/AppsMenu.spec.ts` (order, `safeHref`, `%u` encoding, hidden when empty) and `tests/unit/app/states/PlaceholderPage.spec.ts` (classic links per role from `classic-links.ts`, the note about the separate sign-in, no query issued).
- [X] T096 [P] [US3] Write `tests/smoke/navigation.smoke.spec.ts`: `reseller` sees its two domains on home and the placeholder link to `/domainadmin/mailbox`, and `/ng/api-keys` shows "no access"; `alice@example.org` sees only mailbox-user entries.

### Implementation for User Story 3

- [X] T097 [P] [US3] Implement `src/features/home/components/ScopeSummary.vue` and `src/features/home/components/SectionShortcuts.vue`, and extend `src/features/home/pages/HomePage.vue` (FR-047, except the passkey suggestion, which comes in US4).
- [X] T098 [P] [US3] Complete `src/app/states/PlaceholderPage.vue` (classic links per role, the classic sign-in note, no data, FR-044) and the wording of `src/app/states/NoAccessState.vue` (FR-045).
- [X] T099 [P] [US3] Implement `src/app/shell/AppsMenu.vue` (Reka `DropdownMenu`) and integrate it in `src/app/shell/AppHeader.vue` (FR-001a, FR-042). The announcement banner already comes from T064.

  *Implementation note*: `AppsMenu` sits in the header's actions area, which `ShellLayout` fills (`AppHeader` stays generic). The collapsed announcement button now carries its visible type in its accessible name (WCAG 2.5.3), a foundation fix found by the US3 tests.
- [X] T100 [US3] Add the `nav.*` labels, `placeholder.*`, `home.scope.*`, `home.shortcuts.*`, `apps.*`, `announcement.*` and `states.noAccess.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`. Use "the classic interface" wording (FR-090), and add legacy-map entries for unchanged section names. `npm run i18n:check` must pass.

**Checkpoint**: US1 to US3 work on their own.

---

## Phase 6: User Story 4 - Register and manage own passkeys (Priority: P1)

**Goal**: A "Passkeys" page for every role: list (newest first, host and inactive notes), add with
an optional name, rename, remove, and the home suggestion.

**Independent Test**: As each role, register a passkey with a virtual authenticator, rename it,
remove it and confirm the list each time. Repeat with a cancelled prompt, a rejected registration
and a device without passkey support.

### Tests for User Story 4 (write first; must fail)

- [X] T101 [US4] Implement the passkeys handlers and scenarios:
  - `tests/mocks/handlers/passkeys.ts`:
    - `listPasskeys`: `sort`, `order`, `q`, paging;
    - `createPasskeyRegistrationOptions`: `excludeCredentials` of the account, `residentKey: required`;
    - `registerPasskey`: a duplicate credential gets `400 passkey-registration-failed`, a name must be 1–255 characters, `201` with `Location` and `ETag`, and a pending `secondFactorSetup` is lifted;
    - `updatePasskey` and `deletePasskey`, with `If-Match` and `412`.
  - Register the passkeys handlers in `tests/mocks/handlers/index.ts`.
  - `tests/mocks/scenarios/index.ts`: the scenarios `admin-no-passkeys`, `user-with-passkeys` (one bound to another host, one inactive, one with neither a name nor a description), `passkey-registration-rejected` and `passkey-changed-elsewhere`.

  *Implementation note*: `PASSKEY_IDS` and `alicePasskeys()` (`tests/mocks/scenarios/passkeys.ts`) give fixed IDs and version tags, so tests change a passkey "elsewhere" through `mockApi.patch`. Injected failures can now carry field `errors` (a `422 validation-failed` needs them).
- [X] T102 [P] [US4] Write `tests/e2e/passkeys/passkeys.spec.ts`. It covers:
  - US4-AS1: the empty state;
  - `@virtual-authenticator` US4-AS2: add with a name, then the list shows the name and date and the success is announced;
  - `@virtual-authenticator` US4-AS3: sign out, then sign in with the new passkey (needs US2's passkey sign-in);
  - US4-AS4: rename, refusing an empty name or one of more than 255 characters with a message on the field;
  - US4-AS5: removal confirmation text, including the last-passkey wording;
  - US4-AS6: another host noted by name;
  - US4-AS7: inactive noted;
  - US4-AS8: a cancelled prompt registers nothing and shows no error;
  - US4-AS9: a server rejection (`passkey-registration-failed`, through `stubCredentials` and the `passkey-registration-rejected` scenario) and an `InvalidStateError` (through `stubCredentialsRejection`) each get a translated message and a retry;
  - US4-AS10: without support, adding is unavailable with an explanation while rename and remove work;
  - FR-052: newest first, and the display name fallbacks;
  - FR-057: the page shows only the user's own passkeys;
  - Edge: a rename or removal changed elsewhere (412) reloads and allows a retry;
  - Edge: long names wrap.
- [X] T103 [P] [US4] Write `tests/e2e/passkeys/passkey-suggestion.spec.ts`. It covers:
  - FR-047: the home suggestion appears when the user has no passkey and the device supports passkeys, and is absent otherwise;
  - dismissing it persists on the device (`mailcowui-ng.passkey-suggestion-dismissed`);
  - FR-051: "Passkeys" is reachable from the user menu and from the suggestion.
- [X] T104 [P] [US4] Write these unit tests:
  - `tests/unit/features/passkeys/usePasskeyRegistration.spec.ts`: options, `create`, register with an optional name; cancel is silent; `InvalidStateError`, `passkey-registration-failed` and 422 are mapped;
  - `tests/unit/features/passkeys/display-name.spec.ts`;
  - `tests/unit/features/passkeys/RenamePasskeyDialog.spec.ts`: 1–255 characters after trimming, input kept on 412;
  - `tests/unit/features/passkeys/PasskeyList.spec.ts`;
  - `tests/unit/features/home/PasskeySuggestion.spec.ts`.
- [X] T105 [P] [US4] Write `tests/smoke/passkeys.smoke.spec.ts` with a virtual authenticator against the real API: `admin` registers a passkey, renames it, signs out, signs in with it (US2 with real verification), then removes it.

### Implementation for User Story 4

- [X] T106 [US4] Implement:
  - `src/features/passkeys/api.ts`: queries and mutations with the invalidation of data-model §3, and `useVersionedSave` for rename and remove;
  - `src/features/passkeys/display-name.ts`;
  - `src/features/passkeys/composables/usePasskeyRegistration.ts`;
  - `src/features/passkeys/routes.ts`;
  - `src/features/passkeys/index.ts`, which exports `usePasskeyRegistration` for US5;
  - the catalogue's `passkeys` entry set to `available` in `src/app/navigation/catalogue.ts`.
- [X] T107 [US4] Implement `src/features/passkeys/pages/PasskeysPage.vue` (`useListState` with `page` and `size`, `ListState`, `PaginationBar`) and these components:
  - `src/features/passkeys/components/PasskeyList.vue`;
  - `src/features/passkeys/components/PasskeyCard.vue`: host and inactive notes as text;
  - `src/features/passkeys/components/AddPasskeyForm.vue`: optional name, unavailable with an explanation without support;
  - `src/features/passkeys/components/RenamePasskeyDialog.vue`.

  Removal uses `useConfirm` (FR-051–FR-057).

  *Implementation note*: Rename and Remove carry the passkey's name as visually hidden text, so each button's accessible name says which passkey it acts on.
- [X] T108 [P] [US4] Implement `src/features/home/components/PasskeySuggestion.vue`, shown in `src/features/home/pages/HomePage.vue` with a `listPasskeys` call using `limit: 1`. The user menu's "Passkeys" link already comes from T064.
- [X] T109 [US4] Add the `passkeys.*` and `home.passkeySuggestion.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, using "passkey" wording only. Map legacy keys (for example the friendly-name and removal strings) through `src/i18n/legacy-map.json` where the meaning is unchanged. `npm run i18n:check` must pass.

**Checkpoint**: US1 to US4 work on their own, and the passkey smoke test covers US2 and US4.

---

## Phase 7: User Story 5 - Complete pending actions in a restricted session (Priority: P1)

**Goal**: The pending-actions screen for a forced password change (explanation, classic link,
"Check again") and a forced second-factor setup (register a passkey, then continue without a new
sign-in).

**Independent Test**: Sign in as accounts with each pending action and with both, and walk through
each resolution path, including a device without passkey support.

**Depends on**: US4 (`usePasskeyRegistration` from `@/features/passkeys`).

### Tests for User Story 5 (write first; must fail)

- [X] T110 [US5] Extend the handlers for restricted sessions in `tests/mocks/handlers/auth.ts`, `identity.ts` and `passkeys.ts`:
  - every non-allowed operation, including `updatePreferences`, gets `403 pending-action-required` with `pendingActions`;
  - registration is allowed only when `secondFactorSetup` is the sole action;
  - flags are re-evaluated per request and can be cleared through `PATCH /__mock/scenarios/:id`.

  Add the scenarios `forced-password-change`, `forced-second-factor` and `forced-both`.

  *Implementation note*: no handler change was needed beyond US4's registration rule: `requireAccount` already refuses restricted sessions, and `sessionAccount` reads the pending actions on every request. `updatePreferences` arrives with US6 on the same rule.
- [X] T111 [P] [US5] Write `tests/e2e/pending-actions/pending-actions.spec.ts`. It covers:
  - `@virtual-authenticator` US5-AS1: register a passkey and continue to home (or `returnTo`) without a new sign-in;
  - US5-AS2: the classic link for the role (`/`, `/admin` or `/domainadmin`); "Check again" stays and says so while the action is pending, then continues once it is cleared through `mockApi.patch`;
  - US5-AS3: both actions, password first, with registration explained as available later;
  - US5-AS4: without support, the classic link for second-factor setup;
  - US5-AS5: any other address shows the screen;
  - US5-AS6: Sign out;
  - `@virtual-authenticator` US2-AS7, moved here from US2: passkey sign-in of an account forced to change its password shows this screen;
  - Edge: a reload resumes the screen.

  The language and theme choice on this screen, and its device-only effect, are tested in US6 (T117).
- [X] T112 [P] [US5] Write `tests/unit/features/auth/PendingActionsPage.spec.ts`: the order of actions, the classic sign-in link per role, the "Check again" states (refetching `session` and `identity`), and registration gated by the sole `secondFactorSetup` (FR-038–FR-041).
- [X] T113 [P] [US5] Write `tests/smoke/pending-actions.smoke.spec.ts`: `bob@example.org` signs in, sees the password-change action with the link to `/`, "Check again" reports it is still pending, and sign-out works.

### Implementation for User Story 5

- [X] T114 [US5] Implement `src/features/auth/pages/PendingActionsPage.vue` and `src/features/auth/components/PendingActionItem.vue`, and add the `pending-actions` route to `src/features/auth/routes.ts`. The page:
  - registers a passkey with `usePasskeyRegistration` from `@/features/passkeys`;
  - after success, refetches `session` and `identity`, broadcasts `session-changed` and continues as after sign-in (FR-031, FR-039);
  - "Check again" refetches `session` and `identity` (the guard routes on `Session.state`), then continues once no action is pending, or announces that the action is still pending (FR-040).
- [X] T115 [US5] Add the `auth.pendingActions.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, with legacy-map entries for the forced-change explanations whose meaning is unchanged. `npm run i18n:check` must pass.

**Checkpoint**: All P1 stories (US1 to US5) work.

---

## Phase 8: User Story 6 - Choose language and theme (Priority: P2)

**Goal**: The language (en-gb, cs-cz, sk-sk, intersected with the server's languages) and the theme
(light, dark, system) apply at once, are saved to the profile, and are remembered on the device for
the sign-in screen.

**Independent Test**: Change the language and theme as a signed-in user, sign out, sign in on
another browser context and confirm both were kept. Open signed out with browsers preferring each
language.

### Tests for User Story 6 (write first; must fail)


  *Implementation note*: no legacy key was reused. The forced-2FA strings of the FeldHost fork (`tfa.setup_required`, `tfa.setup_title`) are missing from the upstream cs-cz and sk-sk files, and their wording is about TOTP enrolment, not passkeys.
- [X] T116 [US6] Extend `tests/mocks/handlers/identity.ts` with `updatePreferences`: JSON Merge Patch, `If-Match` and `412`, `422 notInList` with `allowed`, refusal in restricted sessions, a stored language that is no longer enabled reading as the default, and failure injection. Add the scenarios `languages-none-translated` (only `de-de`), `languages-single` (only `en-gb`), `default-language-sk`, `profile-cs-dark`, `profile-language-disabled` and `preferences-save-fails`.
- [X] T117 [P] [US6] Write `tests/e2e/preferences/preferences.spec.ts`. It covers:
  - US6-AS1: Czech switches the text, dates and numbers at once, `<html lang="cs-CZ">` is set (FR-088), the choice is saved, and a new context signs in in Czech;
  - US6-AS2: the dark theme applies at once with the dark logo and is saved;
  - US6-AS3: `system` follows `emulateMedia` changes without a reload;
  - US6-AS4: a Slovak browser locale gives Slovak signed out;
  - US6-AS5: an unsupported browser language gives the server default or English;
  - US6-AS6: a failed save restores the previous setting and shows a message; a `412` applies the reloaded server value and says the change was made elsewhere (spec edge case);
  - US6-AS7: one language gives no choice;
  - US6-AS8: a choice on the sign-in screen beats the profile and is saved, and the next visit without a choice uses the profile;
  - US6-AS9: remembered on the device after sign-out;
  - SC-012: the change applies in under 1 s, measured;
  - Edge: no translated server language gives English, no choice and no language save, while the theme is still saved;
  - Edge: a profile language no longer enabled uses the server default;
  - FR-038 and Edge: on the pending-actions screen of `forced-password-change`, the language and theme choices are offered and apply on the device only, with no `updatePreferences` request.

  *Implementation note*: SC-012 is measured in the page, from the `change` of the sign-in screen's language select to the translated heading (the same `chooseLocale` path as the user menu). Through the user menu, WebKit's emulated tap reaches Reka's menu item seconds late on a loaded machine, before the app is involved.
- [X] T118 [P] [US6] Write `tests/unit/app/preferences/sync.spec.ts` (profile versus sign-in choice, `canSave` per field, `If-Match` through `useVersionedSave`, a `412` applying the reloaded value, restore on other failures, local-only when restricted, an untranslated profile language not applied and not overwritten) and `tests/unit/app/preferences/selects.spec.ts` (`LanguageSelect` lists languages by native name with no flags and is hidden with fewer than two; `ThemeSelect` offers three labelled options).
- [X] T119 [P] [US6] Write `tests/smoke/preferences.smoke.spec.ts`: `admin` switches to `cs-cz` and dark, signs out, and a new browser context signs in in Czech and dark.

### Implementation for User Story 6

- [X] T120 [US6] Implement `src/app/preferences/sync.ts` (FR-059–FR-061):
  - applying the profile after sign-in;
  - `chosenOnSignIn`, which wins and is `PATCH`ed;
  - `PATCH /me/preferences` with `If-Match: preferences.etag` through `useVersionedSave`;
  - on failure, restoring the previous setting with a message;
  - no save when `canSave` is false;
  - remembering the applied language and theme on the device.
- [X] T121 [US6] Implement `src/app/preferences/LanguageSelect.vue` (a native `<select>` by native name) and `src/app/preferences/ThemeSelect.vue` (a radio group or native `<select>`). Place them in `src/app/shell/UserMenu.vue` and in `src/app/layouts/AuthLayout.vue`, so that they appear on the sign-in screens and the pending-actions screen (FR-058). Locales load lazily before they are applied.

  *Implementation note*: in the user menu the choices are Reka radio items (`menuitemradio`), the accessible pattern inside a menu, where a native select would fight the menu's keyboard handling; `LanguageSelect` and `ThemeSelect` (native selects) sit in `AuthLayout`. The other offered languages are prefetched once the app is idle. A failed or outdated save is shown by the shell (`usePreferencesStore().saveMessage`).
- [X] T122 [US6] Add the `preferences.*` messages (language, theme, saved, not saved) to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, with legacy-map entries for unchanged labels. `npm run i18n:check` must pass.

**Checkpoint**: US1 to US6 work on their own.

---

## Phase 9: User Story 7 - Manage API keys (Priority: P2)

**Goal**: Administrators list, filter, sort and page API keys, create them (name, owner picker,
access level, expiry, networks) with a one-time secret dialog, inspect them and revoke them.

**Independent Test**: As an administrator on both viewports, list, filter, create, inspect and
revoke keys, including every validation error and an empty list. As a domain administrator and as a
mailbox user, the section is absent and its address shows "no access".

### Tests for User Story 7 (write first; must fail)

- [X] T123 [US7] Implement the API key handlers and scenarios:
  - `tests/mocks/handlers/api-keys.ts`:
    - `listApiKeys`: the `ownerUsername`, `status` and `accessLevel` filters, the sorts `createdAt`, `name`, `expiresAt` and `lastUsedAt`, `order`, `q`, paging, and `ListMeta`;
    - `createApiKey`: the validation codes `required`, `tooLong` (max 255), `notFound`, `notEligible` with `allowedRoles`, `mustBeInFuture`, `invalidFormat` with `format: ipNetwork` at `allowedNetworks.<i>`, and `tooMany` (max 100); a `secret` matching `^mcv2_[A-Za-z0-9]{40}$`; `Location` and `ETag`;
    - `getApiKey`;
    - `revokeApiKey`: idempotent, with `If-Match`;
    - `listApiKeyOwnerCandidates`: `q`, `role` and paging.
  - Register the handlers in `tests/mocks/handlers/index.ts`.
  - `tests/mocks/scenarios/index.ts`: the scenarios `api-keys-empty`, `api-keys-many` (60 keys with every status and access level, some with inactive or deleted owners, 255-character names, many networks), `api-key-owner-deactivated` and `api-key-revoked-elsewhere`.

  *Implementation note*: the scenarios live in `tests/mocks/scenarios/api-keys.ts` with deterministic data (`fixedKeyId`, `scenarioKey`, `ELSEWHERE_KEY`, `LONG_KEY_NAME`) that tests import. The mock reports `owner` and `status` as they are at the time of the answer (accounts and clock). Handler checks are in `tests/unit/mocks/api-key-handlers.spec.ts`.
- [X] T124 [P] [US7] Write `tests/e2e/api-keys/list.spec.ts`. It covers:
  - US7-AS1 and FR-064: cards at 360 px with name, prefix, owner, access level, status, expiry and last use, and a table on desktop;
  - US7-AS6: filters by status, access level and owner (picker or typed username), sort and page are kept across a reload;
  - US7-AS7: an inactive or deleted owner is flagged as unusable;
  - US7-AS8: the empty state offers creation;
  - US7-AS9 and FR-063: domain administrators and mailbox users get no navigation entry and "no access" at the address;
  - FR-069: the link to `/api/v2/docs`;
  - Edge: long names and network lists wrap without horizontal scroll.
- [X] T125 [P] [US7] Write `tests/e2e/api-keys/create.spec.ts`. It covers:
  - US7-AS10: read-only and never-expires preselected, with the owner set to the signed-in admin;
  - US7-AS12: the owner picker search lists admins and domain admins with roles, loads more, shows no match, and never offers a mailbox user;
  - US7-AS2: the secret is shown once with a copy button, and the list shows the prefix;
  - US7-AS3: a past expiry, a malformed network entry and a deactivated owner show messages on the matching field or entry, and nothing is created;
  - US7-AS11: closing without copying asks for confirmation, and Back does not show the secret again;
  - FR-066 and FR-080: pressing Back, or following a link, while the dialog is open asks the same confirmation before leaving, and Escape does too;
  - Edge: a clipboard refusal selects the secret for manual copying with a message;
  - FR-065: the explanations, expiry presets of 30, 90 and 365 days or a date in the future, and up to 100 networks;
  - SC-010: the creation flow completes on 360 px.
- [X] T126 [P] [US7] Write `tests/e2e/api-keys/detail-revoke.spec.ts`. It covers:
  - US7-AS4: every attribute, including revocation details;
  - FR-067: the note that keys cannot be edited;
  - US7-AS5 and FR-068: the revoke confirmation names the key and its consequences, after which the key shows as revoked with details and stays listed;
  - Edge: a key revoked by another admin revokes again successfully and shows the current state;
  - Edge: a 412 reloads and allows a retry;
  - an unknown ID shows "not found".
- [X] T127 [P] [US7] Write these unit tests:
  - `tests/unit/features/api-keys/list-state.spec.ts`: the address parameters of data-model §5 mapped to the query;
  - `tests/unit/features/api-keys/expiry.spec.ts`: presets from now, local `datetime-local` to UTC RFC 3339, future check;
  - `tests/unit/features/api-keys/NetworkListField.spec.ts`: add and remove entries, at most 100, `isIpNetwork` per entry, server errors at `allowedNetworks.<i>`;
  - `tests/unit/features/api-keys/OwnerPicker.spec.ts`: a 300 ms debounce, `useInfiniteQuery` load more, empty, error and retry, free-text mode for the filter;
  - `tests/unit/features/api-keys/ApiKeySecretDialog.spec.ts`: copy success and refusal, the close and Escape confirmation, the route-leave confirmation while open, the secret cleared on close, nothing written to storage, the router or the query cache;
  - `tests/unit/features/api-keys/ApiKeyCard.spec.ts`: status and owner warnings as text, not only colour (FR-084).

  *Implementation note*: following docs/conventions.md ("Secrets"), the secret dialog is the shared `src/shared/components/OneTimeSecretDialog.vue`, so its spec is `tests/unit/shared/components/OneTimeSecretDialog.spec.ts`, next to `tests/unit/shared/composables/useSecretRequest.spec.ts`. `tests/unit/features/api-keys/pages.spec.ts` covers the three pages as components.
- [X] T128 [P] [US7] Write `tests/smoke/api-keys.smoke.spec.ts`: as `admin`, search the owner candidates for "res", create a read-only key owned by `reseller`, copy the secret, see the prefix on the detail page, and revoke the key.

### Implementation for User Story 7

- [X] T129 [US7] Implement:
  - `src/features/api-keys/api.ts`: list, detail, create (the secret stripped before the cache), revoke through `useVersionedSave`, and owner candidates through `useInfiniteQuery`, with the invalidation of data-model §3;
  - `src/features/api-keys/list-state.ts`;
  - `src/features/api-keys/expiry.ts`;
  - `src/features/api-keys/routes.ts` (`api-keys`, `api-key-create`, `api-key-detail`);
  - `src/features/api-keys/index.ts`;
  - the catalogue's `apiKeys` entry set to `available` in `src/app/navigation/catalogue.ts`.

  *Implementation note*: creation goes through the shared `useSecretRequest` (`src/shared/composables/useSecretRequest.ts`), a direct client call that never touches a query cache and reports session problems through `reportSessionProblem` (exported from `@/api`). `rememberCreatedKey` writes the key without its secret. Client network checks are in `src/features/api-keys/networks.ts`.
- [X] T130 [US7] Implement these list components in `src/features/api-keys/components/`. This depends on T131, because the filters use `OwnerPicker`:
  - `ApiKeyStatusBadge.vue`;
  - `ApiKeyCard.vue` (below `md`);
  - `ApiKeyTable.vue` (from `md` up, on `src/shared/ui/table`), with sortable column headers (`aria-sort`);
  - `ApiKeyList.vue`;
  - `ApiKeyFilters.vue`: native selects for status and access level, `OwnerPicker` in free-text mode, and a native sort select (created, name, expiry, last use, with the order) for the card layout (FR-064).

  *Implementation note*: `OwnerSummary.vue` (owner with the unusable warning) and `LastUse.vue` are shared by the card, the table and the detail page.
- [X] T131 [P] [US7] Implement these form components in `src/features/api-keys/components/`:
  - `OwnerPicker.vue`: Reka `Combobox` without `ComboboxViewport`, username and role per option;
  - `NetworkListField.vue`;
  - `ExpiryField.vue`: never, 30, 90 or 365 days, or a specific date through `<input type="datetime-local">`.

  *Implementation note*: `OwnerPicker.vue` is an ARIA 1.2 editable combobox written in the feature instead of Reka's `Combobox`: the search runs on the server (debounced 300 ms) with paging, "Load more" and free text, which Reka's client-side filtering and highlighting do not fit, and the list is rendered in place, so it needs no floating layer.
- [X] T132 [P] [US7] Implement `src/features/api-keys/components/ApiKeySecretDialog.vue`, following the state machine of data-model §7. The secret lives in a local `ref` only, the clipboard is used through `src/shared/platform/clipboard.ts`, closing uncopied asks through `useConfirm`, and no history entry is pushed.

  *Implementation note*: implemented as the shared, generic `src/shared/components/OneTimeSecretDialog.vue` (conventions "Shared building blocks"; texts under `secrets.*`, the title and description passed by the feature), for reuse by UI 005, 010 and 012. It exposes `requestClose()` for the page's route-leave guard. `useLeaveGuard` is not created here: UI 002 owns that name.
- [X] T133 [US7] Implement these pages in `src/features/api-keys/pages/`:
  - `ApiKeysPage.vue`: `useListState`, `ListState`, `PaginationBar`, the docs link;
  - `ApiKeyCreatePage.vue`: a sectioned form, `useProblemForm`, then the secret dialog, then `router.replace` to the detail page. While the dialog is open, `onBeforeRouteLeave` asks the uncopied-secret confirmation through `useConfirm` (data-model §7);
  - `ApiKeyDetailPage.vue`: every attribute, the not-editable note, revoke with `useConfirm`.

  This depends on T129–T132.

  *Implementation note*: the destructive button variant was darkened to `red-700` for AA contrast (THIRD_PARTY_NOTICES.md). On WebKit, the e2e CSP fixture ignores `style-src-elem` and `style-src-attr` reports, which WebKit's test build raises for the user-agent styles of native `<select>` elements; the Chromium projects still enforce them on the same build.
- [X] T134 [US7] Add the `apiKeys.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, covering every `ApiKeyStatus` and `ApiKeyAccessLevel` label, the explanations of FR-065 and FR-067, and the secret warning. Map legacy API strings through `src/i18n/legacy-map.json` only where the meaning is unchanged. `npm run i18n:check` must pass.

**Checkpoint**: US1 to US7 work on their own.

---

## Phase 10: User Story 8 - Review the authentication audit log (Priority: P3)

**Goal**: Administrators browse audit records newest first, filter by time range, event types,
outcome, actor and client address with removable chips, expand details, and see unknown codes with
a generic label.

**Independent Test**: With records of every event type and outcome, apply each filter alone and
combined on both viewports, and confirm the entries, the empty state and that the filters survive a
reload.

### Tests for User Story 8 (write first; must fail)

- [X] T135 [US8] Implement the audit handlers and scenarios:
  - `tests/mocks/handlers/audit.ts`, `listAuditEvents`:
    - `from` (inclusive) and `to` (exclusive);
    - repeated `eventType` (at most 20);
    - `outcome`;
    - `actor`, matching the username, attempted username or key ID;
    - `clientAddress` as an address or prefix match;
    - `q`, paging and `occurredAt desc`;
    - `422` for malformed `clientAddress`, `from` and `to`.
  - Register the handler in `tests/mocks/handlers/index.ts`.
  - `tests/mocks/scenarios/index.ts`: the scenarios `audit-records` (a failed sign-in of `alice@example.org` from `192.0.2.10`, key creations and revocations, every event type, outcome and reason, and a 512-character user agent) and `audit-empty`. Records with unknown event types, failure reasons or auth methods are **not** seeded: those enumerations are closed in the pinned contract, and the validator rejects them (R22). T137 covers them.

  *Implementation note*: the `audit-records` scenario builds its 41 records when a scenario is created (a getter), with times relative to that moment, so the presets always find 13, 17 and 25 records. Address and prefix matching uses `node:net`. Handler checks are in `tests/unit/mocks/audit-handler.spec.ts`.
- [X] T136 [P] [US8] Write `tests/e2e/audit-log/audit-log.spec.ts`. It covers:
  - US8-AS1: failed sign-ins from that address show the attempted username, local time, address and translated reason;
  - US8-AS2: key event types show the acting admin, the key and the time;
  - US8-AS4: filters with no match give an empty state with "clear filters";
  - US8-AS5: a reload, or the shared address, keeps the filters;
  - US8-AS6: a malformed address, or a start after the end, gives a message on the filter field;
  - US8-AS7: domain administrators and mailbox users get "no access";
  - FR-072: 25 per page by default with the total, and an expanded record shows the target, user agent, request ID and details; a 512-character user agent wraps at 360 px without horizontal scroll;
  - FR-073: the presets 24 h, 7 d and 30 d (`page.clock`), several event types at once, and chips removable one by one and all at once;
  - SC-011: finding a failed sign-in on 360 px.

  *Implementation note*: native `<select>` elements make WebKit report a CSP violation for the inline styles of their user-agent shadow tree (verified with a bare select; Chromium reports none). `tests/e2e/fixtures/csp.ts` leaves out exactly these reports on WebKit; the Chromium projects still fail on any inline style attribute of the app.
- [X] T137 [P] [US8] Write these unit tests:
  - `tests/unit/features/audit-log/list-state.spec.ts`: data-model §5 parameters, including repeated `event` values;
  - `tests/unit/features/audit-log/time-range.spec.ts`: presets resolved when the query runs, a custom `from < to`;
  - `tests/unit/features/audit-log/labels.spec.ts`, covering US8-AS3, FR-074 and the edge case of later event types with plain values, not mocked responses (R24): known `AuditEventType`, `AuditFailureReason` and `AuthMethod` values are translated, and unknown ones are shown as `auditLog.unknown` with the code. `AuditEventItem` renders such an item with the generic label;
  - `tests/unit/features/audit-log/AuditFilters.spec.ts`: actor at most 255 characters, address checked with `isIpNetwork` and at most 49 characters;
  - `tests/unit/features/audit-log/AuditEventItem.spec.ts`: the outcome in text, the actor variants (username and role, API key ID, attempted username), the expandable details.

  *Implementation note*: `tests/unit/features/audit-log/AuditLogPage.spec.ts` also covers the page, the table and the chips.
- [X] T138 [P] [US8] Write `tests/smoke/audit-log.smoke.spec.ts`: as `admin`, the audit log lists this run's sign-in events, and filtering by actor `admin` and outcome `success` narrows the list.

  *Implementation note*: written; the suite runs in T150.

### Implementation for User Story 8

- [X] T139 [US8] Implement `src/features/audit-log/api.ts`, `src/features/audit-log/list-state.ts` (with `targetType` and `targetId` reserved, research R20), `src/features/audit-log/time-range.ts`, `src/features/audit-log/labels.ts`, `src/features/audit-log/routes.ts` and `src/features/audit-log/index.ts`, and set the catalogue's `auditLog` entry to `available` in `src/app/navigation/catalogue.ts`.

  *Implementation note*: `targetType` and `targetId` are part of the list state (`RESERVED_TARGET_PARAMS`), so History links of later features keep them in the address, but `toAuditParams` never sends them until a contract bump adds target filters; the page then notes that all records are shown. The query key holds a preset as its token, and the start time is resolved when the query runs.
- [X] T140 [P] [US8] Implement `src/features/audit-log/components/AuditFilters.vue` (a collapsible filter section on mobile, presets and a custom range through `datetime-local`, event type checkboxes, native selects, `useProblemForm`) and `src/features/audit-log/components/ActiveFilterChips.vue`.
- [X] T141 [P] [US8] Implement `src/features/audit-log/components/AuditEventList.vue` (cards below `md`, a table from `md` up), `src/features/audit-log/components/AuditEventItem.vue` and `src/features/audit-log/components/AuditEventDetails.vue` (a Reka `Collapsible`, with details rendered as text in a definition list).

  *Implementation note*: `AuditOutcome.vue` shows the outcome as text with an icon in both layouts. A table row expands into a row of its own with `AuditEventDetails` in its list variant; cards use its collapsible variant.
- [X] T142 [US8] Implement `src/features/audit-log/pages/AuditLogPage.vue` with `useListState`, `ListState` and `PaginationBar` (FR-071–FR-074).
- [X] T143 [US8] Add the `auditLog.*` messages to `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, with a label for every `AuditEventType`, `AuditFailureReason`, `AuthMethod`, `AuditOutcome` and `AuditTarget.type`, plus `auditLog.unknown`. `npm run i18n:check` must pass.

  *Implementation note*: the labels of codes stay under `enums.*` (one lookup in `labels.ts`, which later features extend by adding locale keys); `auditLog.*` holds the screen's texts. No legacy key matches these texts.

**Checkpoint**: All user stories work on their own.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story verification, budgets, documentation and release readiness.

- [X] T144 [P] Write and pass `tests/e2e/shell/reflow-and-motion.spec.ts`. Every screen and dialog of this feature:
  - has no horizontal scroll at 320 px and at the equivalent of 400 % zoom (320 CSS px on a 1280 px desktop);
  - works in landscape on the mobile projects;
  - never hides the focused element behind the sticky header (WCAG 2.4.11);
  - runs no transition under `prefers-reduced-motion: reduce` (FR-080, FR-083, FR-085, SC-005).

  Add `tests/e2e/shell/keyboard-only.spec.ts`: each user story's main path completed with the keyboard alone, with no pointer events and focus visible at every step (SC-004).

  *Implementation note*: 17 screens and dialogs are checked at 320 px, in landscape (mobile) or at 320 CSS px (desktop, 400 % zoom), and for transitions under reduced motion; focus visibility under the sticky header is checked by tabbing through the three long lists. The keyboard-only spec covers the main path of each story, including the second factor.
- [X] T145 [P] Write and pass `tests/e2e/shell/storage-and-secrets.spec.ts`. After the US1, US2, US4, US6 and US7 flows:
  - `localStorage` and `sessionStorage` hold only the keys of data-model §4;
  - no value contains a password, code, token, secret or username;
  - `history.state` holds no secret (constitution V, FR-066, FR-091);
  - with storage throwing (an init script), the app still signs in and works (edge "storage disabled").
- [X] T146 Run `npm run build && npm run budget:check && npm run lhci`. Fix regressions until the initial JS is at most 204,800 bytes gzipped and performance and accessibility are at least 0.9 on `/ng/sign-in` and `/ng/`. Typical fixes: split lazy routes, trim Reka imports, lazy-load the locales.

  *Implementation note*: initial JavaScript 169.2 KB gzipped (budget 200 KB). Lighthouse (mobile, 3 runs, run inside the pinned Playwright image with `CHROME_PATH=/ms-playwright/chromium-1248/chrome-linux64/chrome`): `/ng/sign-in` performance 0.90–0.91, accessibility 1.00, all scripts 204,435 bytes (limit 204,800); `/ng/` performance 0.90–0.92, accessibility 1.00, 193,869 bytes, CLS 0. Fixes made: the home screen's passkey suggestion moved below the content (it caused a layout shift of 0.17), and an idle prefetch of the other locales was dropped (20 KB). `scripts/run-lhci.mjs` now binds `vite preview` to 127.0.0.1, because `localhost` listened on IPv6 only in the container. The sign-in screen has only 365 bytes of headroom under the script assertion: later features that add to its chunks or to the always-bundled en-gb messages must make room (for example lazy per-feature messages).
- [X] T147 [P] Reconcile `THIRD_PARTY_NOTICES.md` with the files actually copied from TailAdmin and Lucide, and confirm that `npm run licenses:check` passes.

  *Implementation note*: every copied primitive and icon is listed; the only change since Phase 1 is US7's destructive button colour (red-700 for contrast), recorded as a deviation. `npm run licenses:check`: 92 packages, all GPL-3.0-compatible.
- [X] T148 [P] Add the plan's two parity notes to the "Legacy Parity" table in `specs/001-sign-in-app-shell/spec.md`: classic links point to pages, not tabs; app links with non-http(s) addresses are not rendered.
- [ ] T149 Run `quickstart.md` Part B on a mid-range Android phone and an iPhone, with the production build served by `npm run preview:mock` on the local network. Record the SC-001, SC-002, SC-003, SC-008, SC-010 and SC-011 timings. Also record a screen-reader pass of every user story with VoiceOver on iOS and TalkBack on Android (SC-004). Both go in the "Validation log" section appended to `specs/001-sign-in-app-shell/quickstart.md`.

  *Status (2026-10-18): open.* It needs a physical Android phone, an iPhone and screen-reader passes, which the implementing agent cannot do. Left open so that it does not hold the merge; the automated stand-ins are the 360 px WebKit and Chromium projects, axe in both themes and the keyboard-only spec (T144).
- [ ] T150 Run `quickstart.md` Part C (`scripts/smoke/stack-up.sh`, `npm run test:smoke`, `scripts/smoke/stack-down.sh`) against the mailcow-rest-v2 dev stack once its implementation runs. Trigger the CI `smoke` job through `workflow_dispatch`, and set `vars.SMOKE_ENABLED=true` when it passes (plan, Complexity Tracking).

  *Status (2026-10-18): open, blocked.* The mailcow-rest-v2 dev stack (`restv2`, port 18080) serves API 001 (`GET /api/v2/public-config` answers), but `GET /api/v2/health/ready` answers 503, which `scripts/smoke/stack-up.sh` waits for, and the harness builds its own stack at `SMOKE_API_REF` rather than touching the developer's. The smoke specs are written (`tests/smoke/*.smoke.spec.ts`: sign-in, navigation, passkeys, pending actions, preferences, API keys, audit log). Run `SMOKE_API_REF=<API commit> scripts/smoke/stack-up.sh && npm run test:smoke` once readiness reports 200, then enable the CI job.
- [X] T151 [P] Run `npm run i18n:check`, remove the unused keys it reports from `src/i18n/messages/{en-gb,cs-cz,sk-sk}.json`, and list the new cs-cz and sk-sk strings for the owner's review (plan, owner question 4).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** has no dependencies. T005 needs T001 and T004. T011 needs T009 (shared
  notices file). T021 needs T020.
- **Foundational (Phase 2)** depends on Setup and **blocks every user story**. Within it:
  - test infrastructure first (T023 → T024; T025 → T026 → T027, T028; T029);
  - then the core tests T030–T048 (all [P]);
  - then the implementation T049–T065, in the order client → query → platform and security → i18n
    → preferences and branding → session → navigation → router → shared composables → components
    → states → layouts and shell → bootstrap.
- **User stories (Phases 3–10)** depend on Foundational, and on each other as the table below
  shows. To keep them as independent as possible, end-to-end tests that do not test sign-in itself
  start from a scenario whose session is already `active` or `restricted`, instead of signing in
  through the UI.
- **Polish (Phase 11)** depends on every story it verifies.

### User Story Dependencies

| Story | Priority | Depends on | Why |
|---|---|---|---|
| US1 | P1 | Foundational | MVP. Creates the auth feature, the sign-in and second-factor pages, the home page and the idle timer. |
| US2 | P1 | US1 | T089 integrates into `SignInPage.vue` (T079). |
| US3 | P1 | US1 | Extends `HomePage.vue` (T083). Its other scenarios start from active sessions. |
| US4 | P1 | Foundational; US2 for US4-AS3 only | US4-AS3 signs in with the new passkey. The rest is independent. |
| US5 | P1 | US4; US2 for the moved US2-AS7 test | Uses `usePasskeyRegistration` (T106). |
| US6 | P2 | US1; US5 for one edge test | The sign-in screen choice (US6-AS4, AS8, AS9) needs `SignInPage.vue`; the restricted-session edge in T117 needs the pending-actions screen. |
| US7 | P2 | Foundational | Starts from `admin-active` and similar scenarios. |
| US8 | P3 | Foundational | Starts from `audit-records` with an active admin session. |

The passkey smoke test that covers US2 runs in US4 (T105).

### Files edited by several stories

Edits to these files must be serialised, even when the stories run in parallel:

- `src/app/router/routes.ts` and `src/app/navigation/catalogue.ts`: each story registers its routes
  and flips its entry;
- `src/features/home/pages/HomePage.vue`: US1, US3, US4;
- `src/features/auth/pages/SignInPage.vue` and `src/features/auth/routes.ts`: US1, US2, US5;
- `src/app/shell/AppHeader.vue`, `src/app/shell/UserMenu.vue` and `src/app/layouts/AuthLayout.vue`:
  US3, US6;
- `tests/mocks/handlers/{auth,identity,passkeys,index}.ts`: US1, US2, US3, US4, US5, US6, US7,
  US8;
- `src/i18n/messages/*.json` and `src/i18n/legacy-map.json`: every story.

Scenarios avoid this problem through one module per area under `tests/mocks/scenarios/` (T025).

### Within Each User Story

- First, mock handlers and scenarios (test fixtures). Then end-to-end, unit and smoke tests, which
  must fail. Then the implementation (api → composables → components → pages). Then the messages
  in all three locales.
- Each story's message task edits the shared locale files. Run those tasks one after another
  across stories.

### Parallel Opportunities

- Setup: T002, T003, T004, T006, T007, T009, T010, T014–T020 and T022 in parallel after T001.
- Foundational: T030–T048 (tests) all in parallel. T051–T054 and T061 in parallel.
- Stories: after Foundational, US1, US4, US7 and US8 can be staffed in parallel. US2, US3 and US6
  follow US1. US5 follows US4 (T106) and US2.
- Within each story, every task marked [P] in parallel.

---

## Parallel Example: User Story 1

```bash
# After T066 (handlers and scenarios), write all US1 tests together:
Task: "T067 tests/e2e/sign-in/sign-in-screen.spec.ts"
Task: "T068 tests/e2e/sign-in/password-sign-in.spec.ts"
Task: "T069 tests/e2e/sign-in/second-factor.spec.ts"
Task: "T070 tests/e2e/sign-in/session-lifecycle.spec.ts"
Task: "T071 tests/unit/features/auth/SignInPage.spec.ts"
Task: "T072 tests/unit/features/auth/PasswordForm.spec.ts + useThrottle.spec.ts"
Task: "T073 tests/unit/features/auth/useSecondFactor.spec.ts + SecondFactorPage.spec.ts"
Task: "T074 tests/unit/app/session/idle-timer.spec.ts + IdleWarningDialog.spec.ts"
Task: "T075 tests/smoke/sign-in.smoke.spec.ts (+ fixtures)"

# Then implement the independent parts together:
Task: "T077 src/features/auth/components/{SignInHeader,RoleLinks,SsoNotice,IdpHint,AppLinksSection,SignInNotice}.vue"
Task: "T078 src/features/auth/composables/{usePasswordSignIn,useThrottle}.ts + PasswordForm.vue"
Task: "T080 src/features/auth/composables/useSecondFactor.ts + factor components"
Task: "T082 src/app/session/idle-timer.ts + IdleWarningDialog.vue"
# T079, T081 and T083 each edit src/app/router/routes.ts: run them one after another.
```

## Parallel Example: User Story 7

```bash
Task: "T124 tests/e2e/api-keys/list.spec.ts"
Task: "T125 tests/e2e/api-keys/create.spec.ts"
Task: "T126 tests/e2e/api-keys/detail-revoke.spec.ts"
Task: "T127 tests/unit/features/api-keys/*.spec.ts"
Task: "T128 tests/smoke/api-keys.smoke.spec.ts"
# after T129:
Task: "T131 form components"   Task: "T132 ApiKeySecretDialog.vue"
# after T131:
Task: "T130 list components (ApiKeyFilters uses OwnerPicker)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup), then Phase 2 (Foundational): CI green on empty stories.
2. Phase 3 (US1): password sign-in, second factor, sign-out, idle warning.
3. **Stop and validate**: run `npm run test:e2e -- --grep US1` on both viewports, and the US1 rows
   of quickstart Part B.
4. The app can now replace the classic sign-in for testers, because every section shows a
   placeholder that links to the classic interface.

### Incremental Delivery

1. Foundation, then US1 (MVP).
2. US2 (passkey sign-in), then US4 (passkey management), then US5 (pending actions): passkeys
   become the primary method.
3. US3 (navigation, home, placeholders, apps menu): a complete shell.
4. US6 (language and theme), then US7 (API keys), then US8 (audit log).
5. Polish: budgets, reflow, storage audit, parity notes, quickstart validation, and enabling the
   smoke suite.

### Parallel Team Strategy

After Foundational:
- Developer A: US1, then US2.
- Developer B: US4, then US5 (after US2).
- Developer C: US7, then US3 and US6 (after US1).
- Developer D: US8, then Polish preparation.

Edits to the shared files listed under "Files edited by several stories" run one at a time.

---

## Notes


  *Implementation note*: `common.confirm` and `common.loading` were unused and are removed; every other reported key is built dynamically (`apiKeys.columns.*`, `auditLog.filters.ranges.*`, `auth.notice.*`, `preferences.languages.*`, …). The 416 hand-written cs-cz and sk-sk strings are listed for the owner in `specs/001-sign-in-app-shell/translation-review.md`.
- [P] tasks touch different files and have no dependency on an incomplete task.
- [USn] labels map tasks to the spec's user stories, and test titles carry the spec IDs for
  traceability.
- Verify that each test fails before implementing (constitution VI).
- Commit after each task or logical group, directly to `main`, with short imperative subjects.
- Never add a hand-written API type, a `v-html` outside `SanitizedHtml.vue`, an inline style or
  script, a storage key outside data-model §4, or an automatic request while idle.
