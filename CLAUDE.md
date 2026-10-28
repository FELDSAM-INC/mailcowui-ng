# mailcowui-ng

@AGENTS.md

Mobile-first Vue 3 + TypeScript SPA for mailcow-dockerized. It is a static build, and its only
backend is mailcow REST API v2 (`../mailcow-rest-v2`, base path `/api/v2`, same origin).

**Read first**: `.specify/memory/constitution.md`. Its non-negotiables:
- Use only operations of the pinned mailcow-rest-v2 contract, through the generated client.
- Design for a 360 px viewport first.
- Meet WCAG 2.2 AA.
- Use mailcow's translations one to one, in all its languages, and mirror the legacy forms
  (constitution IV, `docs/conventions.md` "Translations and forms"). New strings only where legacy
  has none, complete in en/cs/sk and never machine-translated.
- Do not store credentials in browser storage.
- Write tests first.

**API contract**: `../mailcow-rest-v2/api/`. If a feature needs something the contract lacks,
specify it there first and never work around it in the UI.

**Legacy reference**: `docs/legacy-inventory.md` covers the current UI's features, auth flow,
translations and frontend problems. The legacy templates are in
`../mailhosting/data/web/templates/`, and the translations in
`../mailhosting/data/web/lang/lang.*.json`.

**Roadmap**: `docs/roadmap.md`.

## Development

The foundation is defined in `specs/001-sign-in-app-shell/plan.md` and `research.md`. The rules
below apply to every feature.

- **Stack**: Node 24 LTS, npm with exact versions and a committed lockfile, Vite 8 with base
  `/ng/`, strict TypeScript 5.9 (not 7: tooling peers).
- **Layout**:
  - `src/api/`: the client. `generated/` is never edited by hand and may be imported only inside
    `src/api/`.
  - `src/app/`: router, navigation catalogue, shell, session, preferences and branding.
  - `src/features/<name>/`: one area per feature. Other code reaches it only through its
    `index.ts`. The app's route registry may import a feature's declarative `routes.ts` directly
    to keep form/API exports out of the initial JavaScript.
  - `src/shared/`: code with at least two uses, including the TailAdmin primitives in `ui/`.
  - `src/i18n/`: translations.
  - `contract/`: the vendored, pinned API contract.
  - `tests/{unit,mocks,e2e,smoke}`.
- **Commands**:
  - `npm run dev:mock` runs the mock API with the dev server. `npm run dev` proxies to the API at
    `API_PROXY_TARGET`.
  - `npm run lint`, `typecheck`, `test:unit`, `test:e2e`, `test:smoke`, `i18n:check`,
    `contract:check`, `build`, `budget:check` and `lhci`.
  - `scripts/contract/bump.sh <ref>` pins a new contract.
- **Rules**:
  - No inline `<script>` or `<style>` and no static `style=""`, because of the strict CSP.
  - Reka's `SelectViewport`, `ComboboxViewport` and `ScrollAreaViewport` are banned.
  - `v-html` is allowed only in `SanitizedHtml.vue`.
  - Every mocked request and response is validated against `contract/openapi.json`.
  - End-to-end tests run on 360 px and desktop with axe in both themes.
