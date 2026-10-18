# mailcowui-ng

Mobile-first Vue 3 + TypeScript SPA for mailcow-dockerized. It is a static build, and its only
backend is mailcow REST API v2 (`../mailcow-rest-v2`, base path `/api/v2`, same origin).

**Read first**: `.specify/memory/constitution.md`. Its non-negotiables:
- Use only operations of the pinned mailcow-rest-v2 contract, through the generated client.
- Design for a 360 px viewport first.
- Meet WCAG 2.2 AA.
- Keep en/cs/sk translations complete.
- Do not store credentials in browser storage.
- Write tests first.

**API contract**: `../mailcow-rest-v2/api/`. If a feature needs something the contract lacks,
specify it there first and never work around it in the UI.

**Legacy reference**: `docs/legacy-inventory.md` covers the current UI's features, auth flow,
translations and frontend problems. The legacy templates are in
`../mailhosting/data/web/templates/`, and the translations in
`../mailhosting/data/web/lang/lang.*.json`.

**Roadmap**: `docs/roadmap.md`.
