# Research: Sign-in, Application Shell, Passkeys and API Keys

**Feature**: `specs/001-sign-in-app-shell` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

Every open point of the plan is settled here, in this order of precedence: the constitution, then
the pinned mailcow-rest-v2 contract, then `docs/conventions.md`, then best practice. Each entry has
a **Decision**, its **Rationale** and the **Alternatives considered**. This is the first UI feature,
so most entries set rules that every later feature inherits.

Versions were read from the npm registry on 2026-10-18. They are the versions the scaffold starts
from. `package.json` lists them exactly (`save-exact`), and `package-lock.json` pins the whole tree
(constitution V).

---

## 1. Foundations

### R1. Stack and runtime dependencies (constitution VIII)

- **Decision**: The app has exactly these ten runtime dependencies.

  | Package | Version | Licence | Why it is needed |
  |---|---|---|---|
  | `vue` | 3.5.44 | MIT | Constitution stack. The runtime-only build is used, so templates are compiled at build time and nothing needs `eval` (R18). |
  | `vue-router` | 5.4.0 | MIT | Constitution stack. Routes are declared explicitly; the file-based routing of v5 is not used (R19). |
  | `@tanstack/vue-query` | 5.104.4 | MIT | Constitution stack: the cache for server state (R9). |
  | `pinia` | 4.1.0 | MIT | Constitution stack: two small stores for client state (R10). |
  | `vue-i18n` | 11.4.16 | MIT | Constitution stack. Messages are precompiled at build time, so the runtime needs no message compiler and stays CSP-safe (R15). |
  | `reka-ui` | 2.11.0 | MIT | Headless, accessible primitives under TailAdmin's `components/ui` (dialog, alert dialog, dropdown menu, combobox, collapsible, radio group, checkbox, switch). |
  | `clsx` | 2.1.1 | MIT | TailAdmin's `cn()` helper, used by every copied primitive. About 0.3 KB. |
  | `tailwind-merge` | 3.7.0 | MIT | TailAdmin's `cn()` helper. Version 3 supports Tailwind v4. TailAdmin pins 2.x, which targets Tailwind v3 (R4). |
  | `openapi-fetch` | 0.17.0 | MIT | Typed fetch client over the generated `paths` type (R7). About 2 KB, with middleware hooks for CSRF and errors. |
  | `dompurify` | 3.4.17 | MPL-2.0 OR Apache-2.0 (used under Apache-2.0) | Sanitises the operator's help text and footer (R17). |

  Every licence is GPL-3.0-compatible: MIT and Apache-2.0 are compatible, and DOMPurify's dual
  licence is taken as Apache-2.0. `scripts/check-licenses.mjs` enforces an allowlist in CI (R27).
- **Rationale**:
  - These are the constitution's stack plus three small helpers that the TailAdmin primitives
    need, one client and one sanitiser.
  - The estimated initial JavaScript is about 140 KB gzipped: Vue about 40, the router 10, Query 13,
    Pinia 3, vue-i18n runtime 15, the Reka parts in use about 25, `tailwind-merge` 7, DOMPurify 9
    and the app shell. That leaves room under the 200 KB budget (R26).
  - No date library is needed: native `Intl` and `<input type="datetime-local">` cover formatting
    and input.
  - No form library is needed: forms are small, and validation comes from the contract plus a few
    client checks (R20).
  - No WebAuthn library is needed (R14).
- **Alternatives considered**:
  - Not using Pinia, with module-level refs only: possible, but the constitution names Pinia, and
    devtools and isolated test instances are worth 3 KB.
  - `@simplewebauthn/browser` (MIT, about 4 KB): rejected (R14). Native WebAuthn Level 3 JSON
    methods plus a 40-line codec do the same job.
  - `@vueuse/core`: rejected. The few composables needed (media query, clipboard) take 10–20 lines
    each, and a 15.x major would be one more upgrade track.
  - `axios` or `ofetch`: rejected. `openapi-fetch` is typed from the contract and much smaller.
  - The browser Sanitizer API (`Element.setHTML`): rejected, because it is not available in every
    supported browser.

### R2. Development tooling

- **Decision**: npm with a committed `package-lock.json`, Node.js 24 LTS (`.nvmrc`: `24`;
  `engines.node`: `^22.13.0 || ^24.0.0`), and `.npmrc` with `save-exact=true` and
  `engine-strict=true`. Dev dependencies:

  | Package | Version | Licence | Use |
  |---|---|---|---|
  | `vite` | 8.3.4 | MIT | Build and dev server. Its preview server gzips responses (`@polka/compression`), which Lighthouse needs (R26). |
  | `@vitejs/plugin-vue` | 6.0.10 | MIT | SFC compilation |
  | `typescript` | 5.9.3 | Apache-2.0 | Strict type checking. **Not 7.x**: `openapi-typescript` peers `typescript ^5` and `typescript-eslint` needs `<6.1`. |
  | `vue-tsc` | 3.3.13 | MIT | Type checking of SFCs (`vue-tsc --build`) |
  | `@vue/tsconfig` | 0.9.1 | MIT | Base tsconfig |
  | `@types/node` | 24.x | MIT | Node types for configs and scripts |
  | `tailwindcss`, `@tailwindcss/vite` | 4.3.3 | MIT | Styling (TailAdmin's v4 theme). The Vite plugin replaces TailAdmin's PostCSS setup. |
  | `tw-animate-css` | 1.4.0 | MIT | CSS-only animation utilities that TailAdmin's primitives use (`animate-in`, `fade-in-0`) |
  | `@intlify/unplugin-vue-i18n` | 11.2.7 | MIT | Precompiles messages; switches to the runtime-only vue-i18n build (R15) |
  | `openapi-typescript` | 7.13.0 | MIT | Generates `src/api/generated/schema.ts` (R7) |
  | `@redocly/cli` | 2.64.1 | MIT | Lints and bundles the contract. Same version as mailcow-rest-v2. |
  | `msw` | 3.0.3 | MIT | Mock handlers for every test transport (R22) |
  | `openapi-msw` | 2.1.0 | MIT | Types MSW handlers from the generated `paths` |
  | `ajv`, `ajv-formats` | 8.20.0, 3.0.1 | MIT | Validates mocked requests and responses against the contract (JSON Schema 2020-12) |
  | `vitest`, `@vitest/coverage-v8` | 5.0.5 | MIT | Unit and component tests |
  | `@vue/test-utils` | 2.5.1 | MIT | Mounting components |
  | `jsdom` | 30.1.3 | MIT | DOM for Vitest |
  | `@playwright/test` | 1.64.1 | Apache-2.0 | End-to-end and smoke tests |
  | `@axe-core/playwright` | 4.14.0 | MPL-2.0 | Accessibility checks in end-to-end tests. Development only and never bundled. |
  | `@lhci/cli` | 0.15.1 | Apache-2.0 | Lighthouse CI |
  | `eslint` | 10.13.0 | MIT | Lint |
  | `eslint-plugin-vue` | 10.11.1 | MIT | Vue rules, including `vue/no-v-html` and `vue/no-static-inline-styles` (R17, R18) |
  | `@vue/eslint-config-typescript`, `typescript-eslint` | 14.9.0, 8.71.2 | MIT | Type-aware TypeScript rules |
  | `eslint-plugin-vuejs-accessibility` | 2.6.2 | MIT | Template accessibility lint |
  | `eslint-config-prettier`, `prettier` | 10.1.8, 3.9.10 | MIT | Formatting |
  | `jiti` | 2.7.0 | MIT | Loads `eslint.config.ts` |
  | `tsx` | 4.23.15 | MIT | Runs the TypeScript mock server (`tests/mocks/server.ts`) and TypeScript scripts with tsconfig paths. Node's built-in type stripping resolves neither the `@/` alias nor extensionless imports. |

  TypeScript runs strictly (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`). `exactOptionalPropertyTypes` stays off,
  because the generated types and `openapi-fetch` do not satisfy it.
- **Rationale**: These are the current stable lines that are compatible with each other. The
  peer constraints were checked: `vue-router` 5 accepts `vite` ^7.3 or ^8 (optional), `vitest` 5
  accepts `vite` ^8, `msw` 3 needs Node ≥ 22.12, and `@intlify/unplugin-vue-i18n` needs Node
  ≥ 22.13. Node 24 is the active LTS line.
- **Alternatives considered**: pnpm (stricter `node_modules`) was rejected, because npm needs no
  extra tool in CI or in the Docker build and the lockfile pins just as well. TypeScript 7 (the
  native compiler) was rejected for the peer conflicts above. Biome was rejected: it has no Vue
  template rules on a par with `eslint-plugin-vue` and the accessibility plugin.

### R3. Project structure and module boundaries

- **Decision**: A single Vite project at the repository root, organised by feature. The full tree
  is in [plan.md](./plan.md#source-code-repository-root).
  - `src/api/`: the generated types (`generated/`), the client and its middleware, problem
    handling, the query client and the query key factory. It is the only place that may import
    `src/api/generated/`.
  - `src/app/`: the application core that feature 001 owns and later features extend. It holds
    the bootstrap, the router and its guards, the navigation catalogue, the layouts and shell, the
    session lifecycle, branding, preferences, and the page-level states (no access, not found,
    service unavailable, placeholder).
  - `src/features/<feature>/`: one directory per user-facing area, with `index.ts` (its public
    surface: routes and anything another feature may use), `routes.ts`, `api.ts` (its queries and
    mutations), `pages/`, `components/` and `composables/`. Feature 001 creates `auth`, `home`,
    `passkeys`, `api-keys` and `audit-log`. Later features add `domains`, `mailboxes` and so on.
  - `src/shared/`: building blocks with at least two uses (constitution VIII):
    - `ui/`: the TailAdmin primitives;
    - `icons/`;
    - `components/` and `composables/`;
    - `platform/`: browser adapters for WebAuthn, storage, BroadcastChannel and the clipboard;
    - `security/`: the sanitiser and safe URLs;
    - `validation/`.
  - `src/i18n/`: setup, messages, the legacy key map, formatting and problem translation.
  - `src/styles/main.css`: the Tailwind v4 theme.
  - `tests/{unit,mocks,e2e,smoke}` and `tests/setup/`.
- **Boundaries**, enforced by ESLint `no-restricted-imports`:
  - `@/api/generated/*` may be imported only inside `src/api/`.
  - Deep imports into another feature (`@/features/*/*`) are forbidden. Features use each other only
    through their `index.ts`, and inside a feature imports are relative.
  - `src/shared/**` must not import from `src/app/**` or `src/features/**`.
  - The Reka UI parts that inject `<style>` elements are forbidden (R18).
- **Rationale**: Feature folders let each later feature add one directory plus a catalogue entry,
  without touching other features. `src/app/` makes the cross-cutting core visible. The import
  rules keep generated types behind one door (constitution I) and keep features independent.
- **Alternatives considered**: Layer folders (`components/`, `views/`, `stores/`, as in TailAdmin)
  were rejected, because they scatter one feature across five directories. `eslint-plugin-boundaries`
  was rejected: `no-restricted-imports` covers these rules without another plugin. A monorepo with
  packages was rejected as needless at this size.

### R4. TailAdmin Vue Free copy-in (constitution 1.2.0)

- **Decision**: Copy from `github.com/TailAdmin/vue-tailwind-admin-dashboard` at version **2.5.0**,
  commit **`94ebe1bce19fa51eb4225cc981ee1265b6bdf567`** (2026-10-18). This is the first release
  whose `src/components/ui` primitives are built on Reka UI, as constitution 1.2.0 describes; 2.4.0
  had none. `THIRD_PARTY_NOTICES.md` records the repository, the version, the commit, the list of
  copied files with their source paths, and the full MIT notice ("Copyright (c) 2026 TailAdmin").
  Each copied file starts with the comment
  `Derived from TailAdmin Vue Free 2.5.0 (94ebe1b), MIT. See THIRD_PARTY_NOTICES.md.`
  - **Copied into `src/shared/ui/`**, only as feature 001 uses them: `alert`, `badge`, `button`,
    `card`, `checkbox`, `collapsible`, `combobox` (without `ComboboxViewport`, R18), `dialog`,
    `dropdown-menu`, `field`, `input`, `input-group`, `label`, `pagination`, `radio-group`,
    `switch`, `table` and `textarea`. Also `utils/cn.ts` and `utils/focusOnOpen.ts`, copied to
    `src/shared/ui/utils/`.
  - **Copied as a layout reference into `src/app/layouts` and `src/app/shell`**, then adapted:
    `AdminLayout.vue` (becomes `ShellLayout.vue`), `AuthLayout.vue`, `app-layout/header/AppHeader.vue`,
    `app-layout/sidebar/*` (menu markup and styles), `header/user-dropdown/UserDropdown.vue` (becomes
    `UserMenu.vue`) and `full-width-pages/auth/sign-in/*` (form layout only).
  - **Copied from the theme**: the `@theme` tokens, the `@custom-variant` rules and the component
    classes of `src/assets/main.css`, which becomes `src/styles/main.css`.
  - **Not copied**: `ui/select` and `ui/scroll-area` (they inject `<style>`, R18), `ui/avatar`,
    `ui/video`, `ui/file-input`, `ui/sidebar` (the shell uses its own drawer, R19), every demo page,
    chart, calendar, map, carousel, date picker, image, flag and brand logo, the notification
    dropdown, `useRTL`, `useTheme` and `useFormValidation`. No TailAdmin Pro code or asset is used.
  - **Deviations from the template**, all recorded in `THIRD_PARTY_NOTICES.md`:
    1. The Google Fonts `@import` of Outfit is removed (R5).
    2. Theme handling is replaced by `src/app/preferences/theme.ts`. TailAdmin stores the theme in
       `localStorage` and only knows light and dark; this app needs `system` and profile sync (R16).
    3. RTL support is dropped, because the app has no RTL language.
    4. `tailwind-merge` 3 replaces 2.x (R1).
    5. Static `style="…"` attributes are removed (R18). One occurs in `icons/layout/GeminiIcon.vue`,
       which is not copied anyway.
    6. Touch targets are raised to at least 44 × 44 px where the template uses `size-8`, `size-9`
       or `h-9` controls (constitution II, R21).
- **Rationale**: A pinned version and commit make the copy reproducible and auditable. Copying
  only what is used keeps the bundle small and honours "copy in only what a feature needs".
- **Alternatives considered**: 2.4.0 (2026-09-12) was rejected, because it has no Reka-based
  primitives. Vendoring the whole template was rejected as against the constitution. Writing the
  primitives from scratch was rejected, because it would lose the agreed visual base.

### R5. Fonts and icons

- **Decision**:
  - **Fonts**: no font files. `--font-sans` is the system UI stack:
    `system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Liberation Sans", Arial, sans-serif`.
    TailAdmin's Outfit is not bundled.
  - **Icons**: inline SVG Vue components in `src/shared/icons/`, each with `aria-hidden="true"` and
    `focusable="false"`. Icons are taken first from TailAdmin's `src/icons/layout` (MIT, covered by
    the TailAdmin notice). Missing ones are copied as SVG from Lucide (ISC), with the Lucide notice
    added to `THIRD_PARTY_NOTICES.md`. There is no icon font and no icon package dependency.
- **Rationale**:
  - The constitution requires fonts to be self-hosted and every bundled font to be
    GPL-3.0-compatible. Outfit is licensed under the SIL Open Font License 1.1, which the FSF lists
    as a free licence but as *incompatible with the GPL*.
  - A system font stack needs no download, which helps the Lighthouse score and SC-008. It makes no
    request at all and covers Czech and Slovak diacritics.
  - Inline SVG needs no extra CSP source, is tree-shaken per icon and inherits `currentColor` in
    both themes.
- **Alternatives considered**:
  - Bundling Outfit via `@fontsource-variable/outfit`: rejected because of the licence wording
    above (owner question 1 in the plan).
  - Inter (also OFL-1.1): rejected for the same reason.
  - `lucide-vue-next` or `unplugin-icons`: rejected. They add a dependency for about 20 icons.

---

## 2. Contract and API client

### R6. Contract pinning (constitution I)

- **Decision**: The contract is vendored in `contract/`:
  - `contract/openapi.yaml`: the bundled single-file contract (Redocly `bundle`, not dereferenced).
    It is byte-identical to the artifact the API serves at `GET /api/v2/openapi.yaml`.
  - `contract/openapi.json`: the same bundle as JSON, read by the test validator (R22).
  - `contract/VERSION.json`: the pin record, with these fields:
    - `repository`: `FELDSAM-INC/mailcow-rest-v2`;
    - `ref`: the tag or commit given to the bump script;
    - `commit`: the full SHA;
    - `contractVersion`: `info.version`;
    - `sha256`: of `openapi.yaml`;
    - `bundler`: `@redocly/cli@2.64.1`;
    - `pinnedAt`.

  **The pin is commit `293b7c293ec0b8d8bdf389b35fc1698fcf4d7ffa`** ("Resolve analysis findings for
  feature 001"). It contains the complete feature 001 contract, with 31 operations including
  `appLinks`, `appsLabel` and `GET /api-keys/owner-candidates`, and nothing of later features. Its
  bundle has sha256 `8fb1d4b4c150390fce8fd1c07687badbe7177943ce686b5e68b14b71f4c4b7b7`.

  **`info.version` does not identify a contract.** mailcow-rest-v2 keeps `0.1.0` while the
  contracts of later features are merged into the same `api/` tree: its HEAD on 2026-10-18 already
  has about 250 paths. The commit SHA is therefore authoritative.

  T008 pins exactly this commit, unless mailcow-rest-v2 publishes a release tag for the feature 001
  contract, and records the result in [contracts/README.md](./contracts/README.md). Later UI
  features bump the pin when they need their own operations.

  `scripts/contract/bump.sh <ref>` performs a pin in these steps:
  1. It resolves `<ref>` in `$MAILCOW_REST_V2_DIR` (default `../mailcow-rest-v2`) or, when that
     directory is missing, in a fresh clone of the repository.
  2. It extracts `api/` with `git archive`.
  3. It runs `redocly lint` and `redocly bundle` (to YAML and JSON).
  4. It writes `VERSION.json`.
  5. It runs `npm run contract:generate`.

  CI runs `npm run contract:check`. That checks the sha256 against `VERSION.json`, regenerates the
  JSON bundle and the types, and fails on `git diff --exit-code`.
- **Rationale**: A vendored, checksummed file is the simplest auditable record of "the pinned
  contract version", and builds need no network or sibling checkout. Bumping is one command
  followed by `npm run typecheck && npm test`, which is the deliberate change the constitution asks
  for. Bundling with the API's own Redocly version gives the same bytes as the API's release
  artifact.
- **Alternatives considered**:
  - An npm package of the contract: rejected. Nothing publishes one yet, and a registry adds
    release ceremony.
  - A git submodule: rejected. It drags the whole API repository into checkouts, and CI needs
    credentials for it.
  - Fetching `/api/v2/openapi.yaml` from a running server: rejected. A build would depend on a
    server, and the version would not be reproducible.

### R7. Generated client and types

- **Decision**:
  - `openapi-typescript contract/openapi.yaml -o src/api/generated/schema.ts --root-types
    --root-types-no-schema-prefix --enum-values --read-write-markers --alphabetize` runs as
    `npm run contract:generate`.
    - `--root-types` exports `Session`, `Identity`, `ApiKey` and the other schemas as named types.
    - `--enum-values` exports constant arrays of enumeration values (for example
      `validationRuleCodeValues`, `auditEventTypeValues` and `apiKeyStatusValues`). The
      translation check (R27) and the problem mapper (R8) use them. Because these arrays are
      runtime values, the output is a `.ts` file, not `.d.ts`. This was verified by generating from
      the planning baseline.
    - **Problem types**: contract 0.1.0 defines `KnownProblemType` "so that generated clients get
      constants", but no operation or schema references it. The bundled artifact, the API's own
      release file, therefore leaves it out, and no `knownProblemTypeValues` is generated
      (verified at the baseline).
      - This is reported to mailcow-rest-v2 as API gap 5 in the plan: the root document should
        list it under `components.schemas`.
      - **Not blocking**: all 20 problem types of API 001 occur by name
        (`/api/v2/problems/<name>`) in the bundle's response descriptions. The translation check
        derives the required set from there (R27).
      - At runtime the problem mapper needs no list: it keys messages by the last path segment of
        `type` and has a fallback (R15). Only typed constants are missing until a later pin includes
        the fix.
      - The UI never copies the list by hand (constitution I).
    - `--read-write-markers` lets `openapi-fetch` drop `readOnly` and `writeOnly` fields in the
      right direction.
  - The generated file is committed, marked `linguist-generated` in `.gitattributes`, and excluded
    from ESLint and Prettier. It is never edited by hand: `contract:check` fails on any difference.
  - `src/api/index.ts` is the barrel for hand-written code. It re-exports the generated root types
    (`export type { Session, Identity, … } from './generated/schema'`), the enumeration value
    arrays, the `api` client and the problem helpers. Features import from `@/api` only (R3).
    **No hand-written interface or type describes API data.** Derived view models, such as a
    navigation entry or a list state, are app-defined types and never restate an API shape.
  - `src/api/client.ts` creates
    `createClient<paths>({ baseUrl: '/api/v2', credentials: 'same-origin' })` with the middleware
    of R8. It sets `cache: 'no-store'` for every request except `GET /public-config`, which uses
    `cache: 'no-cache'` so that the browser revalidates with `If-None-Match` and the API's
    `ETag`/`304` work.
- **Rationale**: `openapi-typescript` plus `openapi-fetch` is a type generator, whose only runtime
  output is the constant enumeration arrays, plus a 2 KB runtime. There is no generated request
  code to review, and every path, parameter, body and status is checked by `vue-tsc`. Root types and enumeration arrays remove the reason anyone would
  write API types by hand.
- **Alternatives considered**:
  - `@hey-api/openapi-ts` or `orval`: rejected. They generate runtime SDK code (tens of KB) and
    their own query hooks, which would compete with our query key factory.
  - `openapi-generator` (Java): rejected as heavy, with verbose output.
  - Generating at install time and not committing: rejected. Contract bumps should be reviewable as
    diffs, and builds should be reproducible without running the generator.

### R8. HTTP behaviour: CSRF, retries and problems

- **Decision**: `openapi-fetch` middleware, in this order.
  1. **Activity** (`src/api/activity.ts`): every response except `401 unauthenticated` records
     "the session was used now" for the idle timer (R12), because the API renews the idle timer on
     every session request.
  2. **CSRF** (`src/api/csrf.ts`): the token is held **in memory only**, in a module variable. It
     is never stored on the device (constitution V).
     - `onRequest` adds `X-CSRF-Token` to every method except `GET`, `HEAD` and `OPTIONS`, and
       keeps a `request.clone()` for a possible retry.
     - `onResponse`: on `403` with type `/api/v2/problems/csrf-token-mismatch` and no retry yet, it
       calls `GET /csrf-token` once and replays the clone with the new token (FR-035). The token
       fetch is single-flight: concurrent requests share one promise.
     - If the replay answers `csrf-token-mismatch` or `unauthenticated` again, the session is
       treated as ended (FR-034).
  3. **Problems** (`src/api/problem.ts`): any response with `Content-Type:
     application/problem+json` becomes an `ApiProblem` error object that carries:
     - `type`, `status`, `requestId` and `retryAfter`;
     - `errors` (the field violations);
     - `pendingActions`;
     - the response `Date` header.

     A network failure becomes `ApiProblem` with `kind: 'network'`. A response of status 500 or
     higher that is not problem+json, such as nginx's HTML 502 page while the API container is
     down, becomes `kind: 'unavailable'`. The English `title` and `detail` are kept for logs only
     and are never shown (FR-075).
  4. **Session-level reactions**, in the query and mutation caches' `onError` and not in
     middleware, so that tests can observe them:
     - `unauthenticated`: the session has ended (FR-034, R11).
     - `second-factor-required`: refresh the session, then route to the second-factor step.
     - `pending-action-required`: refresh the session and the identity, then route to the
       pending-actions screen.
     - `forbidden`: show "no permission" in context and invalidate the identity (FR-045).
     - Every other problem is left to the screen that made the request.

  **419**: it is not part of the contract, because the API reports CSRF failures as
  `403 csrf-token-mismatch`. It gets no special handling. Like any undocumented status it is shown
  as the generic error with its request ID (FR-077). Reacting to it would rely on undocumented
  behaviour (constitution I).

  Requests have **no client-side timeout**: sign-in answers that the server deliberately delays
  must not be reported as failures (FR-017). Mutations are never retried automatically. Queries
  are retried once, and only after a network error or a `503` without a known problem type, never
  after a `4xx`.
- **Rationale**: This follows the contract's documented flow ("fetch a new token and retry once").
  The token survives sign-in (API R7), so it is fetched once per anonymous session and again only
  after a mismatch or a sign-out. Keeping it in memory satisfies constitution V. A reload loses
  it, and the bootstrap fetches it again (R11).
- **Alternatives considered**:
  - Double-submit cookies: impossible. The API sets no script-readable token cookie, by design.
  - Fetching a token before every write: rejected as one wasted round trip per write.
  - Retrying network errors on mutations: rejected. It could create a second API key, and the
    conventions say "never retried automatically".

### R9. Server state: query policy and query keys (constitution VII)

- **Decision**:
  - **One `QueryClient`**, created in `src/api/query/client.ts`, with these defaults:
    - `staleTime: 30_000`;
    - `gcTime: 300_000`;
    - `refetchOnWindowFocus: false`, `refetchOnReconnect: false` and no `refetchInterval` anywhere;
    - the retry policy of R8.

    Per-query overrides:
    - `session`: `staleTime: Infinity`. The session changes only through responses that the app
      handles itself.
    - `identity`: `staleTime: 300_000`. FR-050 refreshes it when a section opens and the identity
      is older than five minutes.
    - `public-config`: `staleTime: 300_000`. It is refetched when the sign-in screen opens after a
      sign-out.
  - **Query key factory** `src/api/query/keys.ts`, a typed tree (full table in
    [data-model.md](./data-model.md#query-keys)):
    - `['public-config']`, `['session']`, `['identity']`;
    - `['passkeys', 'list', params]`;
    - `['api-keys', 'list', params]`, `['api-keys', 'detail', id]`,
      `['api-keys', 'owner-candidates', params]`;
    - `['audit-events', 'list', params]`.

    Later features add their own roots, for example `['domains', …]`.
  - **Invalidation after mutations**: each feature's `api.ts` declares it next to the mutation.
    Responses that return the changed resource update the cache with `setQueryData`, and lists are
    invalidated. The full table is in data-model.md.
  - **Discarding account data**: `queryClient.clear()` runs on sign-out, after a session ends, and
    when another tab reports a different account (FR-036, FR-037). Then the session is refetched.
- **Rationale**:
  - FR-033 forbids automatic requests while the user is idle: focus refetches and intervals would
    renew the idle timer, so they are off globally.
  - Constitution VII forbids refetching without reason: a stale time plus explicit invalidation
    covers it.
  - A key factory gives later features a predictable pattern for invalidation.
- **Alternatives considered**: `refetchOnWindowFocus: true` (TanStack's default) was rejected,
  because returning to a tab would silently extend an idle session and could hide the idle warning
  (FR-032, FR-033). Pinia stores for server data were rejected, because the constitution reserves
  Pinia for client state.

### R10. Client state: minimal Pinia

- **Decision**: There are two stores, and everything else is either server state in the query
  cache or local component state.
  - `src/app/session/store.ts` (`useSessionStore`):
    - `keptUsername`: memory only. It keeps the username when a sign-in returns to the password
      step (FR-024, FR-025) and is cleared after success or sign-out.
    - `returnTo`: a validated in-app path (FR-031, FR-092).
    - `notice`: the one-shot message for the sign-in screen (`signedOut`, `sessionEnded`,
      `signInTimedOut`, `secondFactorRejected` or `secondFactorUnavailable`).
    - `lastActivityAt` and `idleTimeout`, read by the idle timer (R12).
  - `src/app/preferences/store.ts` (`usePreferencesStore`):
    - `locale` and `theme`;
    - `chosenOnSignIn: { locale: boolean; theme: boolean }`, for this visit (FR-061);
    - the derived `availableLocales` (FR-060).

  The only device storage is `src/shared/platform/storage.ts`, a `localStorage` wrapper whose every
  call sits in `try/catch`. It holds only conveniences:
  - `mailcowui-ng.locale` and `mailcowui-ng.theme`: the language and theme last applied (FR-061);
  - `mailcowui-ng.passkey-suggestion-dismissed`: device-wide, so that no username is stored
    (FR-047, FR-091).

  `sessionStorage` holds only `mailcowui-ng.announcement-collapsed` (a hash of the announcement
  text) for "the rest of the visit" (FR-048).
- **Rationale**: Constitution V forbids credentials in storage. The keys above are explicitly
  conveniences (spec Assumptions). With storage disabled, the app works and forgets them (spec edge
  case).
- **Alternatives considered**: Storing the username for convenience: forbidden by FR-091. A
  per-user dismissal key, which would need the username or a hash of it: rejected for the same
  reason.

---

## 3. Session lifecycle

### R11. Bootstrap and session state machine

- **Decision**:
  - **Bootstrap** (`src/app/bootstrap.ts`) runs once before the router resolves its first
    navigation:
    1. `GET /csrf-token`, alone. It starts the anonymous session and sets the cookie. Laravel sets
       a session cookie on every response, so parallel first requests without a cookie would create
       competing anonymous sessions, and the token could belong to the losing one.
    2. Then, in parallel: `GET /session` and `GET /public-config`.
    3. If the session is `active` or `restricted`: `GET /me`.

    On a network error or any `5xx`, including the non-JSON 502 or 503 that nginx answers while the
    API container is down, the app shows `ServiceUnavailablePage` with a retry action (spec edge
    case "API not ready"). The documented `service-unavailable` problem belongs to
    `GET /health/ready` only, which the app never calls. A failed `public-config` alone does not block: the app falls back to
    the built-in defaults of FR-003, with `location.hostname` as the product name.
  - **States** come from `Session.state` and map to routes in the global guard
    (`src/app/router/guards.ts`):

    | Session state | Allowed routes | Any other route goes to |
    |---|---|---|
    | `anonymous` | the sign-in routes, plus public states (not found) | `sign-in` with `returnTo` = the requested path |
    | `pendingSecondFactor` | `sign-in-second-factor` | `sign-in-second-factor` (FR-029: a reload resumes the step) |
    | `restricted` | `pending-actions` | `pending-actions` (FR-038) |
    | `active` | shell routes | a sign-in route goes to `returnTo` or `home` |

  - **Sign-in responses** (`201 SessionCreated`, `200 SessionResponse`) are written into the
    `session` query with `setQueryData`. `GET /me` follows for `active` and `restricted`.
    `pendingSecondFactor` routes to the step and carries `returnTo` in its query string.
  - **`returnTo`** (`src/app/router/return-to.ts`) is accepted only when all of these hold:
    - it is a string that starts with `/` and does not start with `//` or `/\`;
    - it contains no scheme or control characters;
    - it is at most 2,048 characters long;
    - it resolves with `router.resolve()` to a route that is not a sign-in route.

    Anything else is ignored (FR-092). Because the router's base is `/ng/` and navigation always
    goes through `router.push`, an accepted value can never leave the app.
  - **Session ended** (`unauthenticated` from any request, an expired idle timer, or another tab's
    sign-out): `queryClient.clear()`, `notice = 'sessionEnded'`, `returnTo` = the current full
    path, `router.replace({ name: 'sign-in' })`, then a fresh `GET /csrf-token` (FR-034).
  - **Sign-out** (`src/app/session/sign-out.ts`): `DELETE /session`.
    - On `204`: clear the cache and the store, broadcast `signed-out` (R12),
      `router.replace({ name: 'sign-in' })` with `notice = 'signedOut'`, then a new
      `GET /csrf-token`.
    - On a network failure: keep everything and show "sign-out could not be confirmed" with a retry
      (FR-036).

    The Back button cannot show old content: the cache is cleared, and every shell route is guarded
    against `anonymous` (SC-009).
- **Rationale**: This follows the contract's flow (`csrf-token`, sign-in steps, `session`) and its
  rule that `GET /session` never fails for a missing session. Holding the state machine in the
  router guard makes every address obey it, including deep links and reloads.
- **Alternatives considered**: Deriving the state from `GET /me` alone was rejected: `/me` answers
  `401` during a pending sign-in and gives neither the methods nor `expiresAt`. Lazy token
  fetching before the first write was rejected because of the competing-sessions race above.

### R12. Idle timeout warning and cross-tab coordination

- **Decision**:
  - **Deadline** = `lastActivityAt + Session.idleTimeout`. `lastActivityAt` is the time of the
    newest API response in *any* tab: the activity middleware (R8) updates it and broadcasts
    `{ v: 1, type: 'activity', at }` on a `BroadcastChannel('mailcowui-ng')`.
  - `src/app/session/idle-timer.ts` sets one `setTimeout` for `deadline − 120 s` and one for the
    deadline. Both are recomputed from `Date.now()` on every activity message and on
    `visibilitychange`, because background tabs throttle timers.
  - **Warning**: `IdleWarningDialog.vue` is a Reka `AlertDialog`, so it is announced and traps
    focus. It shows a countdown that is announced at 120, 60 and 30 seconds (FR-082) and offers:
    - "Stay signed in": `GET /session`. The response renews the server timer and confirms the
      session is still `active`.
    - "Sign out": the normal sign-out.

    Activity in another tab closes the warning (spec edge case).
  - **Expiry**: if no activity arrives before the deadline, the tab ends the session locally
    (R11). It sends no request: the server has already expired the session, and the next request
    would only create a new anonymous session.
  - **No automatic requests**: nothing in the app polls. There is no focus refetch, no interval and
    no keep-alive. The passkey challenge refresh of R14 runs only while nobody is signed in
    (FR-033).
  - **Cross-tab account changes** (FR-037): a sign-in, a sign-out and a lifted restriction
    broadcast `{ type: 'session-changed' }`. Receiving tabs clear their cache and refetch
    `session` and `identity`. A tab that receives `signed-out` ends its session as in R11. As a
    fallback, every identity refresh compares `username` and `role` with the cached identity, and
    a mismatch clears the cache.
- **Rationale**:
  - The API renews the idle timer on every request and reports only `idleTimeout`, so the client
    computes the deadline from its own last request. BroadcastChannel reaches exactly the tabs that
    share the cookie jar (same origin and profile), so "activity in any tab counts" holds without
    device storage.
  - WCAG 2.2.1 requires the warning and the one-action extension.
  - Using `GET /session` for "Stay signed in" is safe in every state and cannot fail for an ended
    session; it reports `anonymous` instead.
- **Alternatives considered**: Polling `GET /session` to learn the real expiry was rejected: it
  would keep the session alive, which FR-033 forbids. Sharing activity through `localStorage`
  events was rejected: BroadcastChannel is supported by every target browser and writes nothing.

### R13. Pending sign-in time limit and throttling

- **Decision**:
  - **Clock skew**: the time limits come as absolute UTC times (`PendingSignIn.expiresAt`,
    `WebAuthnChallenge.expiresAt`). The client estimates the skew from the HTTP `Date` header of
    the response that carried them (`skew = Date header − local receive time`, about 1 s
    resolution) and counts down against `Date.now() + skew`. `useCountdown` in
    `src/shared/composables/` implements it.
  - **Second-factor step** (FR-025): it shows the remaining time, warns and announces at one minute,
    and at zero returns to the password step:
    - it sends `DELETE /session/pending-sign-in`, which is idempotent and harmless if the step has
      already expired;
    - `keptUsername` keeps the username;
    - `notice = 'signInTimedOut'`.

    A reload resumes from `GET /session` (FR-029).
  - **Throttling** (`429 too-many-requests`): `retryAfter` (seconds) disables the submit action
    until then. A visible countdown ("You can try again in 1:45") updates every second, and its
    text is announced only at the start and when the action is enabled again. This is held in
    component state, so a reload forgets it and a new attempt simply gets `429` again.
- **Rationale**: The `Date` header is a standard response header that every origin server with a
  clock sends (RFC 9110 §6.6.1), and it is readable on same-origin responses. It avoids
  misleading countdowns on devices whose clock is wrong.
- **Alternatives considered**: Trusting the device clock was rejected: phones with manual time
  settings would show the warning at the wrong moment. Asking the API for a server time field was
  rejected, because the standard header already provides it.

---

## 4. Passkeys and WebAuthn

### R14. WebAuthn in the browser

- **Decision**: `src/shared/platform/webauthn/`, with no dependency.
  - **Support** (`support.ts`): `passkeysSupported` is true when `window.isSecureContext` holds and
    `typeof window.PublicKeyCredential === 'function'`. This follows the contract's recommendation
    and FR-010. `conditionalMediationAvailable()` awaits
    `PublicKeyCredential.isConditionalMediationAvailable?.()`. When support is false, no passkey
    action is rendered and no error is shown (US2 AS-3).
  - **JSON conversion** (`options.ts`, `credential.ts`, `base64url.ts`): the contract's options are
    WebAuthn Level 3 JSON.
    - The app prefers the native `PublicKeyCredential.parseRequestOptionsFromJSON()`,
      `parseCreationOptionsFromJSON()` and `credential.toJSON()`.
    - When a method is missing, it falls back to its own unpadded base64url codec. Some password
      manager extensions wrap `navigator.credentials` and return objects without `toJSON`.
    - The fallback converts `challenge`, `user.id`, `allowCredentials[].id` and
      `excludeCredentials[].id`, and passes `extensions` (including `appid`) through.
    - Serialised responses are typed against the generated `WebAuthnAuthenticationResponse` and
      `WebAuthnRegistrationResponse`, so they match the contract exactly.
  - **Ceremonies** (`ceremony.ts`): a single module-level `AbortController` guarantees that only
    one WebAuthn request runs at a time. Every new ceremony aborts the previous one first, which
    browsers require for conditional requests.
  - **Passkey sign-in, modal** (US2):
    1. Abort the conditional request.
    2. `POST /session/passkey-challenge`.
    3. `navigator.credentials.get({ publicKey, signal })`.
    4. `POST /session/passkey-assertion` with `{ credential, role? }`.

    A role-specific screen sends its role (FR-011). An attempt that does not sign in resumes the
    conditional request.
  - **Passkey sign-in, conditional** (FR-012): the username field has
    `autocomplete="username webauthn"`. When the sign-in screen mounts and conditional mediation
    is available, the app fetches a challenge and starts
    `navigator.credentials.get({ mediation: 'conditional', publicKey, signal })`.
    - This never opens a dialog.
    - *Amended on 2026-10-19 (owner's iPhone: a passkey picked from the autofill did nothing)*:
      exactly one conditional request stays pending for as long as the sign-in screen is shown.
      - It restarts only when it settles without a credential (the user dismissed the browser's
        prompt, or the browser gave up or aborted it by itself), after an attempt the API refused,
        and 30 s before `expiresAt` (the challenge lives 5 minutes; a lifetime under a minute is
        renewed halfway, never sooner than 5 s after the start). When the request ends within
        3 s of its start (refused at once, or a credential that came by itself and was refused),
        the restart waits 1, 5, 15 and then 60 s. A restart that falls due while the page is
        hidden runs on `visibilitychange` to visible.
      - Focus, blur and visibility changes, reconnects, re-renders and session refetches never
        abort or restart it: the iOS passkey sheet hides the page while the user picks, and a
        restart then drops the choice. The first version restarted on every `visibilitychange`
        before its first challenge had arrived, and left a request the browser had settled
        without a successor, while iOS kept offering passkeys that did nothing.
      - An expired or replaced challenge (`sign-in-expired`) restarts it silently, with "Choose
        your passkey again."
    - These are anonymous requests and cannot keep a signed-in session alive.
    - The request is aborted when the screen unmounts, before the modal ceremony requests its
      challenge (it is resumed afterwards) and when the password form is submitted.
  - **Second-factor WebAuthn** (FR-021): `POST /session/pending-sign-in/webauthn-challenge`, then
    `get()`, then `POST /session/pending-sign-in/second-factor` with `{ type: 'webauthn', credential }`.
  - **Registration** (FR-053, FR-039): `POST /me/passkeys/registration-options`, then
    `navigator.credentials.create({ publicKey, signal })`, then `POST /me/passkeys` with
    `{ credential, name? }`. One composable, `usePasskeyRegistration`, serves the passkeys page
    and the pending-actions screen.
  - **Error mapping** (`errors.ts`):

    | Source | Meaning | App behaviour |
    |---|---|---|
    | `NotAllowedError` | cancelled, timed out, or no matching credential | Silent return. Both sign-in options stay (FR-013, US4 AS-8). |
    | `AbortError` | the app aborted it | Ignored (an `AbortError` the browser raised by itself counts as `NotAllowedError`) |
    | `InvalidStateError` (create) | the authenticator already holds a passkey for this account | "This device already has a passkey for your account" (US4 AS-9) |
    | `SecurityError` | wrong host name or insecure context | "Passkeys cannot be used at this address" |
    | `NotSupportedError`, `ConstraintError` | algorithm, discoverable credential or user verification not available | "This device cannot create or use a passkey of the required kind" |
    | other `DOMException` | — | Generic passkey error with a retry |
    | `401 sign-in-failed` | rejected assertion | Generic failure with a suggestion to use username and password (FR-014) |
    | `401 sign-in-expired` | challenge used or expired, also when another tab took the challenge | "The sign-in timed out", and a new challenge on the next attempt |
    | `400 passkey-registration-failed` | rejected registration | Explanation and "Try again" (FR-053) |
    | `429` | throttled | As in R13 (US2 AS-6) |

  - **Host binding** (FR-052): a passkey whose `hostName` differs from `location.hostname` is
    marked "works only on {hostName}".
  - **Known limitation**: the API keeps one passkey challenge per session ("a new request replaces
    the previous challenge"). Two tabs on the sign-in screen therefore take each other's
    conditional challenge. The losing tab gets `sign-in-expired`, restarts its conditional request
    silently, and asks the user to choose the passkey again.
- **Rationale**: The supported browsers (the two latest majors of Chrome, Edge, Firefox and Safari,
  including iOS) all implement the Level 3 JSON methods. The fallback covers extension wrappers
  without a library. One abort controller avoids the most common conditional-UI bug ("a request is
  already pending").
- **Alternatives considered**: `@simplewebauthn/browser` (MIT) was rejected under constitution
  VIII. It does the same conversion, plus server-oriented helpers the app does not need.
  Auto-starting a modal prompt on load was rejected (FR-012). Skipping conditional UI was rejected
  (clarified spec).

---

## 5. Presentation

### R15. Internationalisation

*Amended on 2026-10-18 for constitution 1.3.0 (owner rule: mailcow's translations one to one, in
every language mailcow ships). The first version imported selected legacy keys at build time,
stripped glyphs, refused HTML and offered English, Czech and Slovak only; all of that is replaced.*

- **Decision**:
  - **Locales** (`src/i18n/locales.ts`): the 33 languages of `data/web/lang/lang.<code>.json`,
    identified by mailcow's codes (`az-az` … `zh-tw`), so that server preferences map one to one.
    `toBcp47()` converts them for `Intl` and `<html lang>` (FR-088): the region is upper-cased,
    and mailcow's `gr-gr` (Greek) and `si-si` (Slovenian) become `el-GR` and `sl-SI`.
  - **Two kinds of text**:
    - **mailcow's own strings** (`src/i18n/legacy.ts`), for every element the classic interface
      has. They are never copied into the app and never compiled.
    - **New strings** (`src/i18n/messages/<locale>.json`), only for elements the classic interface
      lacks, in en-gb, cs-cz and sk-sk. vue-i18n 11 in Composition API mode, runtime-only, with the
      messages precompiled by `@intlify/unplugin-vue-i18n` (`runtimeOnly`, `compositionOnly`,
      `fullInstall: false`, `dropMessageCompiler`), so nothing is compiled at runtime (CSP, R18).
      en-gb is bundled; cs-cz and sk-sk are lazy chunks; every other locale falls back to en-gb.
  - **Runtime loading**: at start-up and on every language change, `loadLegacy(locale)` fetches
    the installation's `/lang/lang.en-gb.json` and `/lang/lang.<code>.json` from the same origin
    (the one non-API request constitution I allows). The selected file is merged over en-gb as
    `data/web/inc/prerequisites.inc.php` does (`array_merge_real`: section by section, a nested
    group replaced as a whole), so a missing key shows English, as in the classic interface.
    - The app therefore shows exactly that installation's texts: the FeldHost fork's wording and
      additions, an operator's changes, the installed version's texts.
    - `index.html` preloads `lang.en-gb.json` (`rel="preload" as="fetch"`), and the start sequence
      prefetches the remembered language, so applying the language rarely waits.
    - Each file is fetched once per page load (a failure is retried on the next load); the HTTP
      cache revalidates it with mailcow's `ETag`. Overlapping switches apply the last one.
    - Language and texts switch together: `applyLocale` awaits the new strings and the legacy
      files, then sets the locale and `<html lang>`.
  - **Bundled snapshot** (`src/i18n/snapshot/lang.en-gb.json`): a byte-for-byte copy of upstream
    `data/web/lang/lang.en-gb.json` at `2026-09a`, refreshed by `npm run i18n:snapshot`
    (`scripts/i18n/refresh-snapshot.mjs`, `git show <tag>:<path>` from `MAILCOW_REPO`, never a
    fork's working tree). It is:
    - the source of the `LegacyKey` type: TypeScript derives every `<section>.<key>` leaf from
      the JSON's type at compile time, so `lt('login.nope')` fails type checking;
    - the fallback when the installation's en-gb cannot be loaded (any error, a non-2xx answer, a
      body that is not a JSON object), and for a key an older installation lacks;
    - a lazy chunk (about 25 KB gzipped), loaded only in those cases. `budget:check` fails if it
      ever enters the initial JavaScript.
  - **Using a legacy key**:
    - `<LegacyText k="login.forgot_password" />` in templates: plain values render as text in a
      `<span>` (or the element named by `as`); values with markup (a tag or a character reference)
      render through `SanitizedHtml` with the legacy profile (R17). Arguments are always text and
      are HTML-escaped inside markup. A slot named like a DataTables placeholder (`#_MENU_`)
      renders the caller's content in its place, as DataTables does with its page-size select.
    - `lt('success.logged_in_as', username)` where a string is needed (attributes, titles,
      announcements); reactive like `t`.
    - `legacy('header.debug')` in tables of text references (`TextRef`: a new-string key or a
      legacy reference), for example the navigation catalogue, route titles and classic links,
      resolved by `resolveText()`.
    - `LEGACY_TEXTS` (`src/i18n/legacy-messages.ts`) for keys built at runtime that the classic
      interface has a text for: problem types and statuses (`problem.sign-in-failed` →
      `danger.login_failed`) and enumeration values (`enums.apiKeyAccessLevel.readOnly` →
      `admin.api_read_only`). `text(key)` and `hasMessage(key)` resolve them.
  - **Formatter** (`src/i18n/legacy-format.ts`): plain substitution, CSP-safe. `%s` and `%d` in
    order, positional `%1$s` and `%1$d` (`%d` truncates a number), and the DataTables
    placeholders (`_START_`, `_END_`, `_TOTAL_`, `_MAX_`, `_MENU_` …) that the caller names. A
    placeholder without an argument, `%` signs, braces (`{username}`, `{{link}}`), glyphs and
    whitespace stay as the file has them. No value is trimmed, reworded or stripped.
  - **Language names**: the server's `languages[].name`, the labels of the classic language menu
    (`$AVAILABLE_LANGUAGES`, for example "Čeština (Czech)"), in the server's order. Without the
    public configuration, mailcow's default menu at `2026-09a` (`src/i18n/default-languages.ts`,
    a lazy chunk, 31 languages: upstream lists neither `az-az` nor `ca-es`).
  - **API problems and rule codes** (`src/i18n/problems.ts`, FR-075 and FR-076):
    - `problem.<name>` for each `KnownProblemType`, where `<name>` is the last path segment, or the
      classic message of the same meaning through `LEGACY_TEXTS`.
    - An unknown `type` falls back to `problem.status.<status>`, then to `problem.generic`
      (`danger.unknown`) (FR-077).
    - Validation messages are `validation.<code>` with named parameters, formatted as before
      (`max`, `min`, `allowed`, `format`, `allowedRoles`); an unknown code falls back to
      `validation.invalid`.
  - **Formatting** (`src/i18n/format.ts`, FR-087): cached `Intl` formatters per locale, always in
    the device time zone, with the BCP 47 tag of `toBcp47()`.
  - **Language resolution** (FR-060, FR-061) in `src/app/preferences/locale.ts`:
    - **Available** = the server's `languages` that mailcow ships, in the server's order. If that
      set is empty, the app uses `en-gb`, offers no choice and saves nothing; with one entry, no
      choice is shown.
    - **Before sign-in**: the remembered `mailcowui-ng.locale` if available; then, for each
      `navigator.languages` entry in order, an available locale with the same language and region
      (`pt-BR` → `pt-br`), else the first with the same language (`el` → `gr-gr`); then the
      server's `defaultLanguage` if available; then `en-gb`.
    - **After sign-in**: the profile language if available, unless the user chose one on the
      sign-in screen during this visit (then it is `PATCH`ed). The applied language is remembered.
  - **Tests**: the mock serves `/lang/` from the snapshot and the upstream cs-cz and sk-sk files
    committed under `tests/fixtures/lang/` (other languages answer 404, as an installation without
    that file would). Scenario behaviours `langUnavailable` and `langPatch` cover the snapshot
    fallback and an installation's own wording or markup.
- **Rationale**: The owner rule requires the human translations one to one, in every language,
  including a fork's and an operator's wording, which only the installation's own files carry.
  Loading them at runtime needs no app release for new mailcow texts. Legacy keys used directly
  keep the provenance obvious and the type check exact. A tiny formatter avoids escaping legacy
  values for vue-i18n's syntax, which would alter them.
- **Alternatives considered**:
  - Bundling all 33 legacy files: rejected. It would ship stale upstream texts instead of the
    installation's, lose a fork's wording, and cost about 900 KB of chunks.
  - Compiling legacy values with vue-i18n: rejected. `{`, `}`, `@`, `$` and `|` would need
    escaping, which changes the text, and runtime compilation breaks the CSP.
  - The former build-time import (`legacy-map.json`): replaced by constitution 1.3.0.

### R16. Theming and branding

- **Decision**:
  - **Tokens**: TailAdmin's `@theme` palette (`--color-brand-*` and the grays) in
    `src/styles/main.css`, used through Tailwind utilities. Dark mode uses TailAdmin's
    `@custom-variant dark (&:is(.dark *))`, with the `.dark` class on `<html>`. A `color-scheme:
    light` or `dark` declaration follows the class, so native controls match.
  - **Theme preference** (`src/app/preferences/theme.ts`): `light`, `dark` or `system`. `system`
    follows `matchMedia('(prefers-color-scheme: dark)')` with a change listener, without a reload
    (FR-062).
  - **No flash of the wrong theme**: `public/theme-init.js`, a blocking external script of about
    300 bytes referenced from `<head>`, reads `mailcowui-ng.theme` inside `try/catch` and sets
    `.dark` before first paint. It is an external same-origin file, so `script-src 'self'` allows
    it (R18). Profile sync then applies the account's theme after sign-in (FR-061).
  - **Default colours until API 013** (FR-004): TailAdmin's brand blue, adjusted where needed so
    that text and focus colours meet WCAG AA in both themes. Measured: `brand-500` (#465FFF) on
    white is 4.8:1 and passes. On `gray-900` it is 3.6:1 and fails for text, so dark-mode text uses
    `brand-300` or `brand-400`. The axe checks in both themes enforce this (R24). Brand colours
    stay CSS custom properties, so that feature 013 can set them at runtime with
    `document.documentElement.style.setProperty`. That is CSSOM, which CSP allows.
  - **Branding from `GET /public-config`** (`src/app/branding/`):
    - the logo for the active theme as `<img alt="{productName}">`, which falls back to the
      product name as text on `error` (spec edge case);
    - `productName`, `pageTitle`, the announcement, the help text, the footer, `appsLabel` and the
      app links.

    No product, operator or brand name exists anywhere in the source (constitution IV). The page
    title is `"{page} – {pageTitle}"` (FR-049), set in a router `afterEach` and again when the
    language or the configuration changes.
  - **Favicon**: `index.html` links the host's own icons, the files mailcow serves from its web
    root: `/favicon.ico` (`rel="icon"`, `sizes="any"`), `/favicon-32x32.png` and
    `/favicon-16x16.png` (`rel="icon"`), and `/apple-touch-icon.png` (`rel="apple-touch-icon"`).
    mailcow has no `/favicon.png`, which the first version linked and which answered 404. That is
    the same legacy web root that the contract's default logo URL (`/img/cow_mailcow.svg`) points
    to, and UI 014 keeps the root icon files (row X10). The app ships no icon of its own; the
    links are same-origin images, which `img-src 'self'` allows.
  - **Announcement** (`AnnouncementBanner.vue`, FR-048): shown in both layouts. Its type is given as
    an icon with a text alternative plus a visually hidden prefix ("Warning:"). It can be collapsed
    for the visit.
- **Rationale**: TailAdmin already ships light and dark tokens. A class-based dark variant plus a
  blocking init script is the only flash-free approach without inline scripts.
- **Alternatives considered**:
  - A pure `prefers-color-scheme` variant: rejected, because it cannot honour an explicit choice
    that differs from the device setting.
  - An inline `<script>` in `index.html` (TailAdmin's typical approach): forbidden by the CSP.
  - Runtime colours now: not available until API 013.

### R17. Operator HTML and other untrusted values

- **Decision**:
  - **Sanitiser** (`src/shared/security/sanitize.ts`, FR-002): DOMPurify with an explicit
    allowlist.
    - `ALLOWED_TAGS`: `p br strong b em i u small h1 h2 h3 h4 h5 h6 ul ol li a blockquote`.
    - `ALLOWED_ATTR`: `href`.
    - `ALLOWED_URI_REGEXP`: `/^(?:https?:|mailto:)/i`, so relative links and every other scheme
      are dropped.
    - Images, `style`, `class` and every event handler are removed.
    - An `afterSanitizeAttributes` hook adds `rel="noopener noreferrer nofollow"` to links.
  - **Legacy profile** (`sanitizeLegacyHtml`, amended for constitution 1.3.0): the markup in
    mailcow's language values, rendered verbatim through `LegacyText`. A separate DOMPurify
    instance with the tags those values use (`b strong i em br small code ul ol li p span div a`),
    the attributes `href` and `target`, and links that are http(s), `mailto:` or relative (never
    `//host` or another scheme). `target` survives only as `_blank`, and every link gets
    `rel="noopener noreferrer"`. Classes, data attributes and styles are removed.
  - **Rendering**: `SanitizedHtml.vue` is the **only** place where `v-html` is allowed. ESLint
    `vue/no-v-html` is an error everywhere, with a single justified disable in that file.
  - **Tests**: the sanitiser has a table of injection vectors for SC-013, including `<script>`,
    `onerror`, `javascript:` and `data:` URLs, `<iframe>`, `<form>`, `<svg onload>`, `<style>`,
    `<img src=//evil>`, `<math>` mutation XSS and `<a href=" javascript:">`. Each vector must be
    neutralised, and the allowed formatting must survive.
  - **Plain-text values** (the product name, page title, announcement, `appsLabel` and app link
    names): always text interpolation, never HTML.
  - **App link URLs** (`src/app/branding/app-links.ts`, FR-001a): `url` and `signedInUrl` are
    operator data. They are rendered only when they are http(s) or a same-origin path, checked by
    `safeHref()` in `src/shared/security/safe-url.ts`; anything else, such as `javascript:`, is
    dropped. `%u` in `signedInUrl` is replaced with `encodeURIComponent(username)`. Links use
    `rel="noopener noreferrer"`.
- **Rationale**: DOMPurify is the de-facto, well-audited sanitiser and works under a strict CSP.
  A narrow allowlist is the spec's exact list. Checking link schemes closes the `javascript:`
  vector that legacy leaves open.
- **Alternatives considered**: Rendering the help text as plain text: rejected, because operators
  author HTML (parity). Server-side sanitising: the API returns the HTML as stored by design, and
  says that clients must sanitise.

### R18. Content-Security-Policy compatibility (constitution V)

- **Decision**:
  - **Target policy**, sent by the static image (R29):
    `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self';
    connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self';
    frame-ancestors 'none'; object-src 'none'`.
  - **Build rules**:
    - Vue's runtime-only build: templates are compiled at build time, with no `new Function`.
    - vue-i18n's runtime-only build with precompiled messages (R15).
    - `build.assetsInlineLimit: 0`, so no `data:` URLs.
    - `build.modulePreload.polyfill: false`.
    - No inline `<script>` or `<style>` in `index.html`. The theme is set by the external
      `theme-init.js` (R16).
  - **Code rules**:
    - `vue/no-static-inline-styles` (ESLint): no `style="…"` in templates. Vue may stringify large
      static subtrees into `innerHTML`, and parsed style attributes are blocked.
    - Dynamic `:style` bindings are allowed. Vue applies them through CSSOM (`el.style`), which
      CSP does not block, and Reka UI's floating positioning relies on them.
    - **Forbidden Reka UI parts**: `SelectViewport`, `ComboboxViewport` (also re-exported as
      `AutocompleteViewport`), `ScrollAreaViewport`, the generic `Viewport` and
      `SplitterResizeHandle`. Each renders or injects a `<style>` element, verified in
      `reka-ui@2.11.0/dist`, that a strict `style-src` blocks. `ToastViewport` and
      `NavigationMenuViewport` only bind a `style` prop and are allowed. `no-restricted-imports` with
      `importNames` enforces this. Selects are native `<select>` elements, which are better on
      phones anyway. The owner picker uses Reka `Combobox` without its viewport, with a plain
      scrollable list (R20).
  - **Verification**:
    - Every end-to-end test runs against the production build served by `vite preview` with the
      same CSP header as production. `preview.headers` reads it from
      `docker/nginx/security-headers.conf`, so there is one source.
    - A fixture records `securitypolicyviolation` events and fails the test on any event (R24).
    - The smoke suite checks the header on the real image.
- **Rationale**: CSP is enforced only in the built app. Dev mode injects styles for hot reload,
  so the tests use the build that ships. The Reka finding would otherwise surface only in
  production as console errors and broken styles.
- **Alternatives considered**:
  - `'unsafe-inline'` for styles: forbidden by the constitution.
  - Nonces: a static build has no server templating to inject them.
  - Hash sources for Reka's fixed style text: rejected. They break on every Reka upgrade, and the
    affected components are avoidable.
  - Trusted Types: deferred as later hardening. It needs a policy for Vue's static vnodes, and it
    is not required.

### R19. Routing, navigation catalogue, placeholders and classic links

- **Decision**:
  - **Router**: `createWebHistory(import.meta.env.BASE_URL)`, with Vite `base: '/ng/'`, matching
    API research R23 and UI 014. Every route component is lazy-loaded (constitution VII), including
    the sign-in page. Only the two layouts are part of the entry chunk. The full route map, with the addresses
    that feature 014 maps to, is in [data-model.md](./data-model.md#route-map).
  - **Navigation catalogue** (`src/app/navigation/catalogue.ts`): one typed, ordered array that is
    the single source for the navigation, the home screen shortcuts, the placeholder routes and
    the access checks (SC-007). Each entry has:
    - `id`, `labelKey`, `icon` and `path`;
    - `access`: per role either `true`, `false` or `{ anyFlag: PermissionFlag[] }`, for example
      sync jobs `{ admin: true, domainAdmin: { anyFlag: ['syncjobs'] }, mailboxUser: { anyFlag:
      ['syncjobs'] } }`;
    - `deliveredBy`, the feature number;
    - `status`: `'available'` or `'placeholder'`;
    - `classic`: per role, the classic addresses the placeholder links to.

    `visibleEntries(identity)` and `canAccess(entryId, identity)` in `visibility.ts` are pure
    functions with a table-driven unit test that covers every row of the spec's catalogue for each
    role and flag combination. A later feature replaces its entry's `status` and adds its routes
    under the same `path`.
  - **Placeholders** (FR-044): every `placeholder` entry generates a route to
    `PlaceholderPage.vue`. The page names the section, says it comes in a later version, lists the
    classic links for the user's role, notes that the classic interface needs its own sign-in, and
    requests no data.
  - **Access** (FR-045): shell routes carry `meta.navEntry` or `meta.access: 'session'`. The guard
    lets the navigation proceed, but `ShellLayout` renders `NoAccessState` instead of
    `<RouterView>` when `canAccess` is false. The address is kept, and no section component (and
    so no section request) is created. When the identity changes (FR-050), the same computed check
    re-evaluates.
  - **Classic interface addresses** (spec Assumptions: "the plan records the exact addresses").
    These are same-host paths of the classic interface, from `templates/base.twig` and the login
    templates of the upstream baseline. Classic tabs cannot be deep-linked, because the classic
    interface has no hash-to-tab handling, so links point to pages.

    | Purpose | Administrator | Domain administrator | Mailbox user |
    |---|---|---|---|
    | Sign-in page (FR-040, FR-008, FR-007) | `/admin` | `/domainadmin` | `/` |
    | Password reset ("Forgot password?", FR-009) | — | — | `/reset-password` |
    | Domains, Mailboxes, Aliases… | `/admin/mailbox` | `/domainadmin/mailbox` | — |
    | My account (own password and second factors) | `/admin/system` | `/domainadmin/user` | `/user` |
    | Quarantine | `/quarantine` | `/quarantine` | `/quarantine` |
    | Spam filter | — | — | `/user` |
    | Administrators and domain administrators | `/admin/system` | — | — |
    | Sync jobs | `/admin/mailbox` | `/domainadmin/mailbox` | `/user` |
    | Routing and address rewriting | `/admin/system`, `/admin/mailbox` | `/domainadmin/mailbox` | — |
    | DKIM, MTA-STS and DNS | `/admin/system` | `/domainadmin/mailbox` | — |
    | Monitoring and operations | `/admin/dashboard`, `/admin/queue` | — | — |
    | Identity providers and OAuth2, System settings | `/admin/system` | — | — |

    For the role-neutral sign-in and the force-SSO notice, the classic mailbox-user sign-in page
    `/` is used. That is where the classic single sign-on button lives (FR-007). These constants
    live in `src/app/navigation/classic-links.ts`. They are mailcow paths, not brand data.
  - **Focus and announcements** (FR-080): after each navigation except the first, focus moves to
    the page's `<h1 tabindex="-1">`.
  - **Not found**: a catch-all route shows `NotFoundPage` with a link home.
- **Rationale**: One catalogue drives everything, so a broken link cannot exist (SC-007).
  Rendering "no access" in place keeps deep-link semantics and guarantees that no data is
  requested. Fixed English kebab-case paths give feature 014 stable targets.
- **Alternatives considered**:
  - Redirecting to a `/no-access` route: rejected. It loses the address the user opened.
  - Vue Router 5 file-based routing: rejected. The catalogue's role metadata does not fit file
    conventions.
  - Hash-based routing: rejected. It is unnecessary, because the image serves the SPA fallback.

### R20. Shared primitives and cross-feature patterns

- **Decision**: Constitution VIII: a shared building block exists only after its second concrete
  use. Feature 001 builds the following in `src/shared/` because it uses each at least twice.

  | Building block | Where | Uses in 001 | Rule it implements |
  |---|---|---|---|
  | `useListState(schema)` | `shared/composables/useListState.ts` | API keys, audit log, passkeys | Conventions "Lists". It parses and normalises `route.query` against a typed schema of search, filters, sort, order, `page` and `size` (25, 50, 100; default 25), and omits defaults from the address. It maps the state to `limit` and `offset`. Explicit changes use `router.push` (Back restores the view), and typing and normalisation use `router.replace`. Changing filters, sort or size resets `page`. It offers an `onReset` hook for bulk selection. Nothing goes to storage. |
  | `ListState.vue` | `shared/components/` | the same three, plus the owner picker | Loading, empty and error states with retry (constitution II, FR-089) |
  | `PaginationBar.vue` | `shared/components/` | API keys, audit log, passkeys | Pages, total count and page size, built on TailAdmin `ui/pagination` |
  | `useConfirm()` + `ConfirmDialog.vue` | `shared/composables/`, `shared/components/` | Passkey removal, key revocation, closing the secret dialog uncopied, leaving the create page while the secret is shown | Conventions "Confirmations". A promise-based confirmation on Reka `AlertDialog`, with one host in `App.vue`. Sign-out is never confirmed (FR-036). |
  | `useVersionedSave()` | `shared/composables/` | Passkey rename, passkey removal, key revocation, preferences | Conventions "Editing and conflicts". It sends `If-Match` with the `etag` that was read. On `412` it keeps the user's input, refetches the resource, exposes `outdated` and the latest value, and never retries or sends `*`. A refused deletion asks for confirmation again. **Preferences** are a single immediate choice: FR-059 and the spec's edge case govern, so a `412` applies the reloaded server value, says the change was made elsewhere and lets the user choose again. |
  | `useProblemForm()`, `FormField.vue`, `ErrorSummary.vue` | `shared/composables/`, `shared/components/` | Sign-in, second factor, key creation, passkey rename, audit filters | FR-075 to FR-078. It maps `errors` paths to fields and builds the linked summary when there is more than one error. Focus moves to the summary or the field. |
  | `ProblemMessage.vue` | `shared/components/` | every screen | A translated message chosen by problem type, with the request ID for generic errors (FR-077) |
  | `SanitizedHtml.vue` | `shared/components/` | Help text, footer | R17 |
  | `DateTime.vue`, `RelativeTime.vue` | `shared/components/` | Passkeys, keys, audit log | FR-087 |
  | `useAnnouncer()` + `LiveAnnouncer.vue` | `shared/` | everywhere | One polite and one assertive live region (FR-078, FR-082) |
  | `useCountdown()` | `shared/composables/` | Second-factor limit, throttling, idle warning | R13 |
  | `safeHref()`, `sanitizeHtml()` | `shared/security/` | App links, help text, footer | R17 |
  | `isIpNetwork()` | `shared/validation/ip-network.ts` | Key networks, audit address filter | IPv4 and IPv6 address or prefix, with prefixes 0–32 and 0–128 |

  **Single-use in 001**, so kept in the feature, with a recorded promotion path:
  - `ApiKeySecretDialog.vue` (`features/api-keys/components/`): conventions "Secrets". UI 005 (app
    passwords) promotes it to `src/shared/components/OneTimeSecretDialog.vue` without changing its
    behaviour. The secret lives only in the dialog's local state, never in the router state, a
    query or storage, and it is cleared on close.
  - `ActiveFilterChips.vue` (`features/audit-log/components/`).
  - `OwnerPicker.vue` (`features/api-keys/components/`): Reka `Combobox` with a debounced search
    and "load more" over `useInfiniteQuery`.

  **Reserved for later features**: not built in 001, but their place and contract are fixed here.
  - **Bulk selection**: `src/shared/composables/useBulkSelection.ts` and
    `src/shared/components/BulkResultSummary.vue`, built by UI 002 (first use) and reused by UI 003.
    - The selection covers the current page only and clears through `useListState`'s `onReset`.
    - Requests carry `BulkTarget { id, version }`, at most 100 items or the capabilities limit.
    - The summary shows one row per `BulkItemResult`. Failed, refused and outdated items stay
      selected.
    - A network failure is reported as "outcome unknown" and never retried.
  - **Typed confirmation**: `ConfirmDialog` gains `requireTyped` in UI 002 (domain name, bulk
    count).
  - **Changed-value marking after an outdated save**: UI 002 extends `useVersionedSave` with a
    field diff for section editing (`EditableSection.vue`).
  - **History link and audit target filters**: `src/shared/components/HistoryLink.vue` opens
    `/audit-log?targetType=…&targetId=…`. It is built when the pinned contract offers target
    filters on `GET /audit-events`. Contract 0.1.0 has none; API feature 002 FR-058 adds them. That
    contract bump also adds `targetType` and `targetId` to the audit log's list state, and the
    History action for API keys.
- **Rationale**: This meets VIII literally and still gives later features fixed locations and
  behaviour, so that each one adds rather than reinvents.
- **Alternatives considered**: Building the whole pattern library in 001: rejected by VIII. Leaving
  locations unplanned: rejected, because it invites five different list-state implementations.

### R21. Accessibility and mobile implementation rules

- **Decision**: These rules apply to all features. They are enforced by axe (R24), by
  `eslint-plugin-vuejs-accessibility` and by the layout checks.
  - **Layout**: the shell has a skip link to `<main id="main" tabindex="-1">`.
    - Below `lg` (1024 px), the navigation is a drawer: a Reka `Dialog` styled like TailAdmin's
      sidebar, opened from one always-visible header button. It traps focus, closes with Escape and
      after a choice, and returns focus to its button (FR-046).
    - From `lg` up, the navigation is a static `<nav>`.
    - Lists are cards below `md` (768 px) and tables from `md` up.
  - **Touch targets**: interactive controls are at least 44 × 44 px (`min-h-11 min-w-11`). Links
    inside running text are exempt, as in WCAG 2.5.8.
  - **Sticky header**: `scroll-padding-top` equals the header height, so the focused element is
    never hidden (WCAG 2.4.11, FR-080).
  - **Focus**: route changes focus the `<h1>`. Steps (password, then second factor) focus their
    heading or first field. Dialogs are Reka: they trap focus, close with Escape and return focus.
    Dialogs that could lose input or the secret ask for confirmation first (FR-080, FR-066).
  - **Forms**: every control has a visible label. Errors use `aria-describedby` and
    `aria-invalid`. The summary is a list of in-page links. Sign-in fields use `autocomplete`
    `username`, `current-password` and `one-time-code`, with `autocapitalize="none"`,
    `autocorrect="off"` and `spellcheck="false"`. Pasting is never blocked (FR-016, FR-081).
  - **Status**: outcomes, statuses and announcement types carry text or an icon with a text
    alternative, never colour alone (FR-084).
  - **Motion**: transitions use Tailwind `motion-safe:` variants (FR-085).
  - **Reflow**: no fixed widths; long values use `break-words` or truncation with the full value
    available, and are checked at 320 px and at 400 % zoom (FR-083).
- **Rationale**: These are the spec's FR-079 to FR-085, made concrete enough to test.

---

## 6. Testing

### R22. Mock API generated from the contract (constitution VI)

- **Decision**:
  - **Handlers**: MSW 3 handlers in `tests/mocks/handlers/` (one file per contract module), written
    with `openapi-msw` against the generated `paths`. Status codes, bodies and parameters are
    therefore checked by the compiler.
  - **Scenario state**: a scenario in `tests/mocks/scenarios/` describes:
    - the accounts, their second factors, passkeys and flags;
    - the public configuration variant;
    - API keys and audit records, built by the factories in `tests/mocks/factories/`;
    - behaviour switches: a throttle threshold, a Yubico outage, a short idle timeout, and failure
      injection by operation.

    The handlers implement the contract's documented behaviour on that state: CSRF tokens, the
    session states, single-use challenges, `If-Match`, filters, sorting and paging.
  - **Contract validation** (`tests/mocks/contract/validator.ts`):
    - Ajv 2020 with `ajv-formats` compiles `contract/openapi.json`. OpenAPI-only keywords
      (`discriminator`, `example`, `xml`, `externalDocs`) are registered as annotations, and the
      `password` format is registered.
    - Every mocked **request** is matched to exactly one contract operation by method and templated
      path (literal segments win). Its path, query and body are validated, and an unsafe request
      must carry `X-CSRF-Token`.
    - Every mocked **response** must use a status documented for that operation. Its body is
      validated against the documented schema for its content type, and the documented required
      headers (`Location`, `ETag`, `Retry-After`, `Cache-Control`) must be present.
    - A violation answers `500` with a `mock-contract-violation` marker and is recorded. Tests
      fail on any recorded violation, so mocked data can never contradict the contract.
    - A request that matches no operation is a violation too, which enforces FR-093.
  - **Transports**, all using the same handlers:
    1. **Vitest**: `setupServer()` from `msw/node` in `tests/setup/vitest.setup.ts`, with
       `onUnhandledRequest: 'error'`.
    2. **Node mock server** (`tests/mocks/server.ts`, port 4010): `node:http` plus MSW 3's
       `getResponse(handlers, request)`.
       - It serves `/api/v2/*` for `vite preview` (end-to-end tests and Lighthouse) and for
         `npm run dev:mock`.
       - Control endpoints under `/__mock/`: `POST /__mock/scenarios` creates an isolated
         scenario from a name plus overrides and returns its ID;
         `GET /__mock/scenarios/:id/violations` and `/requests` read what happened.
       - The browser selects its scenario with a `mock-scenario` cookie, which the Playwright
         fixture sets per test. Tabs of one test share it, so cross-tab tests work. Without a
         cookie, the server uses `MOCK_DEFAULT_SCENARIO`.
  - **What a mock may not do**: closed enumerations (`AuditEventType`, `AuditFailureReason`,
    `AuthMethod`, `ValidationRuleCode`) cannot carry values outside the pinned contract, even where
    the contract says that clients must tolerate unknown ones. Their unknown-value behaviour
    (FR-074, FR-076) is tested at unit level with plain values, not through mocked responses.
  - **API not ready** is not an API response either. Because `service-unavailable` (503) is
    documented only for `GET /health/ready`, end-to-end tests model it as a transport failure, with
    Playwright `route.abort()` or an HTML 502 from `route.fulfill()` standing in for nginx, or as
    the documented `500` of the bootstrap operations.
  - **WebAuthn in the mock**: the options have the right shape and random challenges. A
    registration stores the credential ID from the attestation. An assertion is accepted when its
    `rawId` is a known, active credential of the scenario and the challenge is current. Signatures
    are not verified (the smoke suite covers real verification, R25).
- **Rationale**: Typed handlers stop shape errors at compile time. Ajv stops anything the types
  cannot express (patterns, `minItems`, required headers, documented statuses) at runtime. One
  handler set for three transports avoids drift. The Node server lets end-to-end tests run against
  the production build (CSP, base path, chunks) without a service worker in the bundle.
- **Alternatives considered**:
  - Prism as a mock server: rejected. It is stateless and example-driven, and the sign-in flows
    need state.
  - MSW in the browser via its service worker: rejected. It would put mocking code and a worker
    into a separate test build that differs from the shipped one.
  - `@msw/playwright` 0.7: rejected for now. It is pre-1.0, and the Node server also serves
    development and Lighthouse.
  - Hand-maintained JSON fixtures: rejected. They drift from the contract.

### R23. Unit and component tests

- **Decision**:
  - Vitest 5 with `jsdom` and `@vue/test-utils`. Tests live in `tests/unit/`, mirroring `src/`.
  - The setup file installs MSW, creates a fresh Pinia and `QueryClient` per test, and installs
    i18n with the real `en-gb` messages.
  - `navigator.credentials` and `PublicKeyCredential` are stubbed per test with
    `tests/unit/support/webauthn-stub.ts`. `matchMedia` and `BroadcastChannel` get small fakes.
    Time uses `vi.useFakeTimers()`.
  - Coverage uses v8, with thresholds of 90 % lines for `src/api`, `src/app/session`,
    `src/app/router`, `src/app/navigation`, `src/shared/security` and
    `src/shared/platform/webauthn`, and 80 % elsewhere in `src/`.
- **Rationale**: This covers the logic-heavy units: the CSRF retry, the state machine, `returnTo`,
  the catalogue, the sanitiser, WebAuthn conversion and the problem mapping. Stricter thresholds
  apply to security-relevant code.

### R24. End-to-end tests: viewports, accessibility, CSP and WebAuthn

- **Decision**:
  - **Playwright projects** (`playwright.config.ts`):
    - `mobile-chromium`: viewport 360 × 780, `isMobile`, `hasTouch`, scale 3.
    - `desktop-chromium`: 1366 × 900.
    - `mobile-webkit`: 360 × 780 WebKit, mobile Safari's engine. It runs every spec except those
      tagged `@virtual-authenticator`.
    - `smoke`: R25.

    The mock projects start two web servers: the mock server on 4010, and `vite preview` on 4173
    proxying `/api/v2` to the mock. Specs live in `tests/e2e/<area>/`.
  - **Fixtures** (`tests/e2e/fixtures/test.ts`), extending `test`:
    - `mockApi.use(scenario, overrides)`: creates a scenario and sets the cookie. After each test it
      asserts zero contract violations.
    - `expectAccessible(page)`: `@axe-core/playwright` with the tags `wcag2a`, `wcag2aa`,
      `wcag21a`, `wcag21aa` and `wcag22aa`, run in both themes. It switches by toggling the
      `.dark` class on `<html>` together with `page.emulateMedia({ colorScheme })`, so both themes
      are checked whatever theme the scenario's profile chose. Any violation fails the test
      (constitution III, SC-004).
    - `cspViolations`: an `addInitScript` listener for `securitypolicyviolation`. Any event fails
      the test.
    - `expectNoHorizontalScroll(page)`: `scrollWidth <= clientWidth`, also at 320 px.
    - `expectTouchTargets(page)`: visible buttons, inputs, selects and standalone links are at least
      44 × 44 px on the mobile projects. Links in running text are exempt.
    - `virtualAuthenticator(page)`: CDP `WebAuthn.enable` and `addVirtualAuthenticator` (ctap2,
      internal, resident key, user verification, automatic presence). A device without passkey
      support is simulated by deleting `window.PublicKeyCredential` in an init script.
      `stubCredentials(result)` replaces `navigator.credentials.get` and `create` with a stub that
      resolves with a contract-valid fake credential, or rejects with a named `DOMException`. Tests
      that only need a submitted credential therefore run on WebKit too, because the mock does not
      verify signatures.
    - Clock: `page.clock` for the idle warning, the second-factor limit and throttling.
  - **Coverage rule**: every acceptance scenario of every user story has at least one end-to-end
    test, run on both viewports. The exception is a scenario whose data the pinned contract cannot
    produce in a validated mock: US8-AS3 and the edge case of audit records with later event
    types. Those are covered by unit tests of the label mapping (R22). Every screen and state calls
    `expectAccessible`. Spec IDs appear in the test titles (`US1-AS6 …`), so the analysis can trace
    them.
- **Rationale**: The constitution requires both viewports, accessibility checks on every screen
  and a mock generated from the contract. WebKit covers the mobile Safari engine for everything
  except virtual authenticators, which only Chromium offers.

### R25. Smoke suite against a real mailcow-rest-v2 instance

- **Decision**:
  - The `smoke` Playwright project (`tests/smoke/`) runs desktop Chromium plus one 360 px case
    against `SMOKE_BASE_URL` (default `http://localhost:8080/ng/`).
  - **Harness**, `scripts/smoke/stack-up.sh`:
    1. In `$MAILCOW_REST_V2_DIR` (default `../mailcow-rest-v2`), checked out at
       `contract/VERSION.json`'s `commit` or at `SMOKE_API_REF`, it runs the API's dev stack:
       `docker compose up -d --build`, the setup commands of the API quickstart, and
       `scripts/dev/reset-dev-database.sh`.
    2. It builds this repository's image (`docker build -t mailcowui-ng:smoke -f docker/Dockerfile .`).
    3. It runs the image on the API stack's network with the alias `ng-mailcow`, which is the
       upstream name that the API's nginx snippet proxies `/ng/` to (API research R23).
    4. It waits for `/api/v2/health/ready` and `/ng/`.

    `stack-down.sh` removes everything. The production routing is therefore exercised for real:
    the same origin, `/ng/` through nginx, the session cookie and the CSP header.
  - **Accounts** come from the API's `DevelopmentSeeder`: `admin`, `reseller` (domain admin of two
    domains), `alice@example.org` (TOTP secret `JBSWY3DPEHPK3PXP`) and `bob@example.org` (forced
    password change), all with password `Passw0rd!dev`. TOTP codes are computed in the test with
    `node:crypto` (RFC 6238, about 20 lines). The helper waits for a fresh 30-second step, because
    the API rejects a replayed code.
  - **Smoke cases**:
    - sign-in for each role and sign-out;
    - a TOTP second factor;
    - a forced password change on the pending-actions screen;
    - passkey registration, then passkey sign-in (virtual authenticator, with real verification by
      the API);
    - a language and theme change that persists across sign-in;
    - API key create, copy and revoke;
    - the audit log showing the sign-ins;
    - placeholders and "no access" for a domain administrator;
    - the CSP header present on `/ng/`. Only the CSP is asserted, because nginx-mailcow adds its
      own server-level headers (R29).

    Failed-sign-in checks use a random unknown username, so that the seeded accounts are never
    throttled.
- **Rationale**: This is constitution VI's smoke layer. Using the API's own dev stack and seeder
  keeps the fixtures in the API repository, where they belong.
- **Alternatives considered**: Running the smoke tests against `vite preview` proxying to the API
  was rejected as the main mode, because it would skip the image, nginx and CSP. It remains
  possible by pointing `SMOKE_BASE_URL` anywhere, including a real mailcow host.

### R26. Performance budgets and Lighthouse CI (constitution VII)

- **Decision**:
  - **Bundle budget**: `scripts/check-bundle-budget.mjs` reads `dist/.vite/manifest.json`
    (`build.manifest: true`). It gzips the entry chunk and its transitive static imports with
    `node:zlib`, the "initial JavaScript", and fails above 204,800 bytes. It also prints the size of
    every lazy route chunk. It runs in CI after every build.
  - **Lighthouse CI** (`lighthouserc.cjs`, `@lhci/cli` 0.15.1): mobile preset, three runs per URL,
    against `vite preview` (gzip on) plus the mock server. It runs on:
    - `/ng/sign-in`, with `MOCK_DEFAULT_SCENARIO=anonymous-default`;
    - `/ng/`, with a signed-in administrator scenario, as a second collection.

    Assertions: `categories:performance ≥ 0.9`, `categories:accessibility ≥ 0.9`, and
    `resource-summary:script:size ≤ 204800` as a cross-check. Reports are uploaded as CI artifacts
    (`temporary-public-storage` is not used).

    The two collections need different default scenarios, and `lighthouserc.cjs` cannot restart
    servers between URLs. `npm run lhci` therefore runs `scripts/run-lhci.mjs`, which for each
    collection:
    1. starts the mock server with its `MOCK_DEFAULT_SCENARIO` and `vite preview`;
    2. runs `lhci collect` for that URL;
    3. stops both servers.

    It then runs `lhci assert` once over all results.
- **Rationale**: The budget script is exact and fast, and it fails the build before Lighthouse
  runs. Lighthouse covers the scores the constitution names. The sign-in screen is the cold-start
  path that SC-008 measures.

### R27. Translation completeness, licences and dependency audit

- **Decision**:
  - `scripts/i18n/check.mjs` (`npm run i18n:check`) fails CI when any of these holds (amended for
    constitution 1.3.0; the rules apply to the new strings only, mailcow's are verbatim):
    1. The key sets of `en-gb`, `cs-cz` and `sk-sk` differ, or a value is empty.
    2. The placeholder sets of a key differ between locales.
    3. A required key is missing for a contract enumeration value (`ValidationRuleCode`,
       `AuditEventType`, `AuditFailureReason`, `AuditOutcome`, `AuditTarget.type`, `AuthMethod`,
       `Role`, `ApiKeyStatus`, `ApiKeyAccessLevel`, `Theme`, the announcement types) or a problem
       type of `contract/openapi.json` (R7, SC-006), unless `LEGACY_TEXTS` maps it to a classic
       text; a key in `LEGACY_TEXTS` must not also be a new string, and its target must be in the
       snapshot. Pending actions and second-factor types use legacy keys in typed tables, which
       TypeScript checks.
       - `validation.format.<format>` keys exist for the formats the app's forms can trigger;
         any other format falls back to the plain `validation.invalidFormat` message.
    4. A new string contains "FIDO2", "Touch ID", or, in `en-gb`, the word "legacy" (FR-015,
       FR-090).
    5. The source uses a legacy key (`lt('…')`, `legacy('…')`, `<LegacyText k="…">`) that is not a
       text of the bundled en-gb snapshot. TypeScript checks the same through `LegacyKey`.
    6. A new string is unused (keys built at runtime, such as `problem.*` and `enums.*`, excepted).
    7. The source names a new-string key that does not exist.

    It also prints, for review only, the new strings whose English text a legacy key already has
    (normalised: no case, punctuation, markup or placeholders), as candidates for a legacy key.
  - `scripts/check-licenses.mjs` runs `npm ls --omit=dev --all --json` and fails when a production
    dependency's licence is not in the allowlist: MIT, ISC, BSD-2-Clause, BSD-3-Clause,
    Apache-2.0, MPL-2.0, 0BSD, or dual licences that contain one of them. It also checks the dev
    dependencies whose code ends up in `dist/` (`tailwindcss` and `tw-animate-css` CSS). Copied
    code is covered by `THIRD_PARTY_NOTICES.md`.
  - **Audit**: `npm audit --omit=dev --audit-level=moderate`, plus `npm audit --audit-level=high`
    for the whole tree. `.github/dependabot.yml` proposes weekly npm and GitHub Actions updates.
- **Rationale**: These are the constitution's merge gates (translations, vulnerability scan)
  and its licence rule, made mechanical.

### R28. CI workflow

- **Decision**: `.github/workflows/ci.yml` runs on push to `main` and on manual dispatch, with
  these jobs:
  1. `quality`: `npm ci`, `lint`, `format:check`, `typecheck`, `contract:check`, `i18n:check`,
     `licenses:check`, `audit`, and `test:unit` with coverage.
  2. `build` (needs `quality`): `npm run build` and `budget:check`. Uploads `dist/`.
  3. `e2e` (needs `build`): `npx playwright install --with-deps chromium webkit`, then the
     `mobile-chromium`, `desktop-chromium` and `mobile-webkit` projects. Uploads traces on failure.
  4. `lighthouse` (needs `build`): `npm run lhci`.
  5. `image` (needs `build`): `docker build` and a container check. The container must answer
     `/ng/` with `index.html`, `/ng/api-keys` with the SPA fallback, `/ng/assets/*` with an
     immutable cache header, and must send the CSP header.
  6. `smoke` (needs `image`): `scripts/smoke/stack-up.sh` with a checkout of
     `FELDSAM-INC/mailcow-rest-v2` at the pinned commit, using the read token secret
     `MAILCOW_REST_V2_TOKEN`, then `npm run test:smoke`. It runs on manual dispatch, nightly, and
     on pushes once the repository variable `SMOKE_ENABLED` is `true`.

  Jobs 1–5 are the merge gates the constitution lists. `smoke` becomes a gate when the API's dev
  stack can run its implementation; until then the API exists as a contract only (plan,
  Complexity Tracking). Node 24 is used, with npm caching. Actions are pinned by commit SHA.
- **Rationale**: This maps one to one to the constitution's gates. Parallel jobs after `build`
  keep the wall time low.

---

## 7. Deployment

### R29. Static image and routing (matches API research R23)

- **Decision**:
  - **Image** (`docker/Dockerfile`), multi-stage:
    1. `node:24-alpine` runs `npm ci && npm run build`.
    2. `nginxinc/nginx-unprivileged:1.28-alpine` (non-root uid 101, listening on 8080), pinned by
       digest, copies `dist/` to `/usr/share/nginx/html/ng/`. Source maps are built with
       `sourcemap: 'hidden'` and not copied.

    The container runs with `read_only: true`, plus tmpfs for `/tmp` and `/var/cache/nginx`.
  - **nginx configuration** (`docker/nginx/default.conf`, with `security-headers.conf` included in
    every location that serves content):
    - `location /ng/` uses `try_files $uri $uri/ /ng/index.html` (the SPA fallback for deep links).
    - `location /ng/assets/` sends `Cache-Control: public, max-age=31536000, immutable`, because
      the files are content-hashed.
    - `index.html` and `theme-init.js` send `Cache-Control: no-cache`.
    - `location = /ng/healthz` returns `200` for the container health check.
    - `location = /` redirects to `/ng/`, only for direct access to the container.
    - Gzip is on for JavaScript, CSS, JSON and SVG. `server_tokens off`.
    - The image sends only the headers that nginx-mailcow does not already set at server level:
      - the CSP of R18, whose `frame-ancestors 'none'` takes precedence over mailcow's
        `X-Frame-Options: SAMEORIGIN` in browsers;
      - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`, which leaves
        WebAuthn at its default `self`;
      - `Cross-Origin-Opener-Policy: same-origin`.

      mailcow's `sites-default.conf.j2` already adds `X-Content-Type-Options`, `X-Frame-Options`
      and `Referrer-Policy`, and sending them again would duplicate or contradict them.
  - **mailcow integration**: `deploy/docker-compose.override.yml` adds the service `ng-mailcow`
    with these settings:
    - the image `ghcr.io/feldsam-inc/mailcowui-ng:<version>`;
    - `mailcow-network` with the alias `ng-mailcow`;
    - `read_only` and tmpfs;
    - `restart: always`;
    - a healthcheck (`wget -q --spider http://127.0.0.1:8080/ng/healthz`).

    The `/ng/` routing itself is the API repository's `deploy/nginx/site.restv2.custom` (mailcow's
    `site.*.custom` include). It proxies `^~ /ng/` to `http://ng-mailcow:8080` with a variable
    upstream, which passes the original URI (`/ng/…`) unchanged. That is why the image serves
    under `/ng/`. No upstream mailcow file is patched (constitution "Deployment").
  - **Base path**: Vite `base: '/ng/'`, also given to the router. Feature 014 keeps `/ng/` after
    cutover and redirects classic addresses to it.
- **Rationale**: This is the exact counterpart of the API plan's routing decision (`/ng/`, the
  upstream name `ng-mailcow:8080`, the same override file). A separate, non-root, read-only image
  keeps UI releases independent of mailcow's `data/web` and of the API image.
- **Alternatives considered**:
  - Serving the build from the API container: rejected, because it couples the release cycles.
  - Mounting `dist/` into nginx-mailcow: rejected by API research R23, because it changes the
    service definition.
  - `/` as the base: rejected by UI 014 clarifications, because the root is shared with `/api/v1`,
    webmail and autodiscover.
