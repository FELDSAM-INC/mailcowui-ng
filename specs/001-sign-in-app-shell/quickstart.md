# Quickstart and Validation Guide: UI Feature 001

**Feature**: `specs/001-sign-in-app-shell` | **Plan**: [plan.md](./plan.md) |
**Contract**: [contracts/README.md](./contracts/README.md)

This guide proves the feature works. Part A covers the local setup and the automated gates. Part B
gives manual checks per user story against the mock API. Part C covers the smoke suite against a
real mailcow-rest-v2 dev stack, and Part D a mailcow host. It refers to the spec, the research and
the data model instead of repeating them.

## Prerequisites

- Node.js 24 LTS (or 22.13+) and npm 10+. Run `nvm use` to read `.nvmrc`.
- For Parts C and D: Docker with Compose v2, and a checkout of `mailcow-rest-v2` next to this
  repository (`../mailcow-rest-v2`) or at `$MAILCOW_REST_V2_DIR`.
- For refreshing the reused legacy translations: a mailcow-dockerized checkout with the upstream
  tags at `$MAILCOW_REPO` (default `../mailhosting`).

## Part A: Setup and automated gates

```bash
npm ci                                  # exact versions from package-lock.json
npx playwright install chromium webkit  # browsers for the end-to-end projects

npm run lint && npm run format:check    # ESLint (Vue, TypeScript, a11y, import rules) and Prettier
npm run typecheck                       # vue-tsc --build, strict
npm run contract:check                  # vendored contract checksum; generated files up to date
npm run i18n:check                      # en-gb, cs-cz and sk-sk complete; contract enums covered
npm run licenses:check                  # production dependencies GPL-3.0-compatible
npm run audit                           # npm audit gates
npm run test:unit                       # Vitest with coverage thresholds
npm run build && npm run budget:check   # initial JS ≤ 200 KB gzipped
npm run test:e2e                        # Playwright: mobile-chromium, desktop-chromium, mobile-webkit
npm run lhci                            # Lighthouse: performance and accessibility ≥ 90
```

**Expected**:

- Every command exits with 0.
- `budget:check` prints the initial JavaScript size, below 204,800 bytes gzipped, and the lazy
  chunk per route.
- `test:e2e` reports every `US<n>-AS<m>` test passing on both viewports, with no axe violation,
  no CSP violation and no mock contract violation.
- `lhci` prints scores of at least 0.9 for `/ng/sign-in` and `/ng/`.

### Development servers

```bash
npm run dev:mock     # mock API on :4010 and the Vite dev server on :5173 proxying /api/v2 to it
                     # open http://localhost:5173/ng/ ; the scenario defaults to MOCK_DEFAULT_SCENARIO
npm run dev          # Vite dev server proxying /api/v2 to API_PROXY_TARGET (default http://localhost:8080)
npm run preview:mock # the production build with the production CSP, against the mock API (:4173)
```

The Vite dev server injects styles for hot reload, so the CSP is checked only with
`preview:mock` and in the end-to-end tests.

### Bumping the contract

```bash
scripts/contract/bump.sh <tag-or-commit>   # writes contract/* and regenerates the types
npm run typecheck && npm run test:unit && npm run test:e2e
git diff contract/VERSION.json             # review the new pin
```

### Refreshing the reused legacy translations

```bash
MAILCOW_REPO=../mailhosting node scripts/i18n/import-legacy.mjs --ref 2026-09a
npm run i18n:check
```

## Part B: Manual checks per user story (mock API)

Start `npm run preview:mock` and open `http://localhost:4173/ng/`. Pick a scenario by setting the
`mock-scenario` cookie: the fixture helper `npm run mock:scenario -- <name>` prints a ready URL.
Scenario names are defined in `tests/mocks/scenarios/index.ts`. Check every screen at 360 px (the
browser's device toolbar) and on a desktop, in both themes.

| Story | Scenario | Steps | Expected (spec reference) |
|---|---|---|---|
| US1 | `admin-password` | Open `/ng/`, sign in as `admin` with the scenario password, sign out | The sign-in screen shows the logo, product name, announcement, help text and apps; home has the admin navigation; after sign-out a confirmation appears and Back shows nothing (US1 AS-1, AS-2, AS-12) |
| US1 | `mailbox-all-factors` | Sign in as `alice@example.org` | The second-factor step lists the security key first, then TOTP, with Yubico OTP under "Other methods"; a valid code (shown by the scenario) lands home (AS-3) |
| US1 | `throttled` | Submit wrong passwords | A countdown appears, the button is disabled, and re-enabling is announced (AS-6) |
| US1 | `short-idle` | Sign in and wait (idle timeout 150 s) | The warning appears after 30 s; "Stay signed in" keeps the session; ignoring it shows sign-in with an explanation, then returns to the page after sign-in (AS-17) |
| US2 | `passkey-user` | Click "Sign in with a passkey" in Chrome with DevTools › WebAuthn › virtual authenticator holding the scenario credential | Home without username or password (US2 AS-2); cancelling the prompt shows no error (AS-4) |
| US3 | `domain-admin-no-syncjobs` | Sign in as `reseller` | The navigation matches the catalogue rows for domain administrators without sync jobs; `/ng/api-keys` shows "no access"; a placeholder links to `/domainadmin/mailbox` (US3 AS-1, AS-3, AS-4) |
| US4 | `admin-no-passkeys` | Open Passkeys, add, rename and remove one | Empty state, then the list updates; rename validation; the last-passkey confirmation text (US4 AS-1 to AS-5) |
| US5 | `forced-password-change` | Sign in as `bob@example.org` | The pending-actions screen links to the classic interface; "Check again" stays until the scenario flag is cleared (US5 AS-2) |
| US6 | `admin-password` | Switch to Čeština and the dark theme, reload, sign out | Text, dates and the logo switch at once; after sign-out the sign-in screen is in Czech and dark (US6 AS-1, AS-2, AS-9) |
| US7 | `api-keys-many` | Create a key, copy the secret, close, press Back; filter, sort and page; revoke | The secret appears only once; filters persist across a reload; the revoked key stays listed (US7 AS-2, AS-5, AS-6, AS-11) |
| US8 | `audit-records` | Filter by failed sign-ins from `192.0.2.10`; reload; enter `999.1.1.1` | Matching entries with translated reasons; filters survive the reload; a field error on the address (US8 AS-1, AS-5, AS-6) |

## Part C: Smoke suite against a real mailcow-rest-v2 dev stack

```bash
export MAILCOW_REST_V2_DIR=../mailcow-rest-v2
scripts/smoke/stack-up.sh      # API dev stack at the pinned commit + this image as ng-mailcow
npm run test:smoke             # Playwright project "smoke" against http://localhost:8080/ng/
scripts/smoke/stack-down.sh
```

**Expected**:

- `stack-up.sh` ends with `ready: http://localhost:8080/ng/`.
- `test:smoke` passes for: each role's sign-in and sign-out; the TOTP second factor (`alice`); the
  forced password change (`bob`); passkey registration and sign-in through the virtual
  authenticator; preferences persisting across sign-ins; API key creation and revocation; the
  audit log listing the run's sign-ins; and the CSP header on `/ng/`.
- `docker compose -f $MAILCOW_REST_V2_DIR/compose.yaml logs app | grep -c Passw0rd` prints `0`.

## Part D: On a mailcow host

1. Install mailcow-rest-v2 as its quickstart Part C describes, including
   `data/conf/nginx/site.restv2.custom`.
2. Append the `ng-mailcow` service of `deploy/docker-compose.override.yml` to the mailcow
   directory's `docker-compose.override.yml`, then run `docker compose up -d ng-mailcow`.
3. Open `https://<MAILCOW_HOSTNAME>/ng/`.

**Expected**:

- The operator's branding appears.
- A passkey registered in the classic interface signs in.
- The response headers of `/ng/` include the CSP of research R18.
- `SMOKE_BASE_URL=https://<host>/ng/ npm run test:smoke -- --grep @read-only` passes. The
  read-only subset only signs in and out, and only with an account given in `SMOKE_*` variables.
