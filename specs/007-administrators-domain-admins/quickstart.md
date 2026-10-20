# Quickstart and Validation Guide: UI Feature 007

**Feature**: `specs/007-administrators-domain-admins` | **Plan**: [plan.md](./plan.md) |
**Contract**: [contracts/README.md](./contracts/README.md)

This guide proves the feature works. Part A covers the automated gates, Part B manual checks per
user story against the mock API, Part C the smoke suite against a real mailcow-rest-v2 dev stack,
and Part D the address that billing panels use. Setup, tooling and commands are UI 001's
quickstart; only what this feature adds is listed here.

## Current implementation checkpoint (2026-10-20)

The R5 identity/CSRF foundation and both account CRUD screens are implemented. Run their focused
checks with:

```bash
npx vitest run tests/unit/api tests/unit/app/session tests/unit/app/layouts \
  tests/unit/app/shell/ShellNotice.spec.ts tests/unit/i18n/legacy-keys-007.spec.ts \
  tests/unit/scripts/i18n-tools.spec.ts tests/unit/features/administrators \
  tests/unit/mocks/administrator-handlers.spec.ts tests/unit/features/mailboxes --maxWorkers=2
npm run typecheck
npm run i18n:check
```

The checkpoint passed 438 focused tests. The new browser file is
`tests/e2e/administrators/crud.spec.ts`; the real-API file is
`tests/smoke/administrators.smoke.spec.ts`. Both are awaiting their first runs. Account creation is
at `/administrators/domain-admins/-/new` or `/administrators/admins/-/new`. The remaining stories
and the full-screen domain-picker extension described below are not yet implemented.

## Prerequisites

- The UI 001 prerequisites (Node.js 24 LTS, npm, Playwright browsers).
- UI 001 to 006 implemented; for Part C, API 007 implemented in mailcow-rest-v2.

## Part A: Automated gates

```bash
cat contract/VERSION.json               # commit contains API 007 (a13c370) — see contracts/README.md
npm run contract:check                  # vendored contract and generated client up to date
npm run lint && npm run typecheck
npm run i18n:check                      # new strings in en-gb, cs-cz, sk-sk; used legacy keys in the en-gb snapshot; feature enums and coverage.json values
npm run test:unit                       # incl. tests/unit/app/session/identity-switch.spec.ts and csrf identity check
npm run build && npm run budget:check   # entry chunk grows by about 3 KB only
npm run test:e2e -- --grep "US[1-7]-|FR-0|Edge:" tests/e2e/administrators tests/e2e/acting \
  tests/e2e/sso-sign-in tests/e2e/webmail-on-behalf tests/e2e/audit-log/impersonation.spec.ts
```

**Expected**: every command exits with 0; every `US<n>-AS<m>` test of this feature passes on
`mobile-chromium`, `desktop-chromium` and `mobile-webkit`, with no axe, CSP or mock contract
violation.

## Part B: Manual checks per user story (mock API)

Start `npm run preview:mock`, open `http://localhost:4173/ng/`, and choose a scenario with
`npm run mock:scenario -- <name>`. Check at 360 px and on a desktop, in both themes. Scenario names
are defined in `tests/mocks/scenarios/{administrators,acting,sso-sign-in}.ts`.

| Story | Scenario | Steps | Expected (spec reference) |
|---|---|---|---|
| US1 | `domain-admins-three` | Open Domain administrators (`/ng/administrators/domain-admins`); search a domain; open an account and go back | Three cards with domains, two-factor status and status; the search survives the round trip (AS-1, AS-2) |
| US1 | `domain-admins-three` | Add a domain administrator with two domains, a generated password and "unlimited quota" off | Success message names it; its detail opens; the request sends only the changed flag (AS-3, SC-001) |
| US1 | `domain-admins-three` | Assign a third domain; suspend second factors; deactivate and remove an account | Exactly the new set; "suspended until next sign-in" after a confirmation that mentions passkeys; the deactivation confirmation states its effect; the removal dialog names the domains (AS-6, AS-7, AS-8, FR-026) |
| US1 | `domain-admins-edge` | Open the account without domains, the one with `ALL`, the one without a permission record | "No domains" warning; "not a domain" warning; every switch off (edge cases) |
| US2 | `acting-admin` | Mailbox list → "Sign in as" on `alice@example.org`; visit three screens; "Return to admin" | Banner on every screen naming alice, her role, admin and the time; back on the mailbox list with its search (AS-1 to AS-3, SC-002, SC-005) |
| US2 | `acting-admin` | While acting, open the passkeys page and My account › Password | Controls unavailable with "Not available while acting as another user" (AS-8) |
| US2 | `acting-admin` | While acting, run `mockApi.patch({ invalidateImpersonation: 'targetDeletedOrRenamed' })` (Playwright) or the scenario switch, then navigate | Message that acting ended and the request was not carried out; origin screen as admin (AS-9) |
| US2 | `acting-admin` | Open a second tab; start acting in the first; return to the second and save something | The second tab shows the banner; a change prepared before the switch is not carried out and says why (AS-10) |
| US2 | `acting-reseller-login-as`, `acting-reseller-no-login-as` | Sign in as the reseller and open the mailbox list | "Sign in as" only with the flag (AS-4) |
| US3 | `domain-admins-three` | Change three switches, try to leave, then save | Leave guard; only the three flags sent; saved state after reload (AS-1 to AS-3, SC-010) |
| US4 | `admins-one-active` | Open Administrators (`/ng/administrators/admins`) and your own account | Remove disabled with its reason; deactivation disabled with the legacy `warning.no_active_admin` ("Cannot deactivate last active admin") (AS-3, AS-4) |
| US4 | `admins-two-active` | Deactivate your own account | Confirmation that the session ends; then the sign-in screen with an explanation (AS-5) |
| US5 | `sso-valid` | Open `/ng/sign-in/sso-token?sso_token=<scenario token>` signed out | Home of the domain administrator; the address bar and history hold no token (AS-1) |
| US5 | `sso-valid-signed-in` | Open the same address while signed in as admin | The question names admin; "Continue" signs in as the link's account; "Stay signed in" keeps admin (AS-3) |
| US5 | `domain-admins-three` | On an active account create a sign-in link; wait 30 s | Link, copy control, countdown, warning, no open control; then "expired" and "Create new link" (AS-5, FR-063) |
| US6 | `webmail-on`, `webmail-off` | Mailbox list → "Open webmail as" | A new tab with the stub webmail, the app stays; no action with the setting off (AS-1, AS-2) |
| US7 | `audit-impersonation` | Detail → "View history"; audit log → filter impersonated `bob@a.example` | Filtered to the account; records show both accounts, marked "while acting" (AS-1 to AS-3) |

## Part C: Smoke suite against a real mailcow-rest-v2 dev stack

```bash
export MAILCOW_REST_V2_DIR=../mailcow-rest-v2
scripts/smoke/stack-up.sh
npm run test:smoke -- tests/smoke/administrators.smoke.spec.ts tests/smoke/admins.smoke.spec.ts \
  tests/smoke/acting.smoke.spec.ts tests/smoke/sso-sign-in.smoke.spec.ts
SMOKE_WEBMAIL_ON_BEHALF=1 npm run test:smoke -- --grep @webmail   # only when the stack enables ALLOW_ADMIN_EMAIL_LOGIN
scripts/smoke/stack-down.sh
```

**Expected**: a domain administrator `smoke-da-<random>` and an administrator `smoke-admin-<random>` are
created, changed and removed; `admin`
acts as `alice@example.org` and as `reseller` and returns; a one-time link for `reseller` signs in a
fresh browser context; the audit log filtered by impersonated account lists the run's records.

## Part D: One-time sign-in address for billing panels

Panels that issue domain administrator tokens (`POST /api/v2/domain-admins/{username}/sso-token` or
legacy `/api/v1` `add/sso/domain-admin`) redirect the user's browser to:

```text
https://<MAILCOW_HOSTNAME>/ng/sign-in/sso-token?sso_token=<token>
```

The token works once, within 30 seconds of issue, in either this address or the classic
`/domainadmin?sso_token=<token>`. The app removes it from the address bar before doing anything
else, and exchanges it only when the page is shown to the user.
