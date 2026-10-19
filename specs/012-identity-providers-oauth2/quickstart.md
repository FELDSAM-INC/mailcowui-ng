# Quickstart and Validation Guide: UI Feature 012

**Feature**: `specs/012-identity-providers-oauth2` | **Plan**: [plan.md](./plan.md) |
**Contract**: [contracts/README.md](./contracts/README.md)

This guide proves that the feature works:

- Part A covers the automated gates.
- Part B gives manual checks per user story against the mock API.
- Part C covers the smoke suite against the mailcow-rest-v2 dev stack.
- Part D covers a mailcow host with a real Keycloak and LDAP.

It builds on [UI 001's quickstart](../001-sign-in-app-shell/quickstart.md), whose prerequisites,
commands and development servers apply unchanged.

## Prerequisites

- Everything of UI 001's quickstart.
- UI features 001 to 011 implemented; the building blocks of plan.md "Dependencies on earlier UI
  features" present (T002).
- For Part C: mailcow-rest-v2 with features 001, 002, 003 and 012 implemented, and about 1.5 GB of
  free memory for its `idp` profile (OpenLDAP and Keycloak).
- For Part D: a mailcow host with mailcow-rest-v2 and this app installed (UI 001 Part D), a
  Keycloak realm or generic OIDC provider, and an LDAP directory.

## Part A: Automated gates

```bash
npm ci
npm run lint && npm run format:check && npm run typecheck
npm run contract:check                  # the pin contains the 19 API 012 operations (T001)
npm run i18n:check                      # new strings in en-gb/cs-cz/sk-sk; legacy keys in snapshot
npm run test:unit
npm run build && npm run budget:check   # initial JS ≤ 200 KB gzipped; three new lazy chunks
npm run test:e2e                        # whole suite; this feature's specs are in
                                        # tests/e2e/{identity-provider,single-sign-on,oauth2-clients},
                                        # tests/e2e/sign-in, tests/e2e/audit-log and tests/e2e/shell
npm run lhci
```

**Expected**:

- Every command exits with 0.
- Every `US1-…` to `US6-…` test passes on `mobile-chromium`, `desktop-chromium` and
  `mobile-webkit`, with no axe, CSP or mock contract violation.
- `budget:check` lists the chunks of `identity-providers/provider`, `identity-providers/oauth2` and
  `SingleSignOnReturnPage`, and the initial JavaScript grows by under 1 KB.
- `storage-and-secrets.spec.ts` finds no code, state, client secret, bind password or OAuth2 client
  secret in storage, addresses, `history.state` or request headers (SC-003).

## Part B: Manual checks per user story (mock API)

Run `npm run preview:mock` and open `http://localhost:4173/ng/`. Choose a scenario with
`npm run mock:scenario -- <name>`, as in UI 001. Check every screen at 360 px and on a desktop, in
both themes.

On the mock, single sign-on sends the browser to `https://idp.example.test/…`, which does not
exist. To walk through it by hand, copy the `state` from the address bar of the failed provider
page and open
`http://localhost:4173/ng/sso/return?code=mock-code-1&state=<state>`. The end-to-end tests route
that host automatically.

| Story | Scenario | Steps | Expected (spec reference) |
|---|---|---|---|
| US1 | `idp-none` | Open Identity providers and OAuth2 › Identity provider | Empty state explains single sign-on, provider password sign-in and automatic creation (US1-AS1) |
| US1 | `idp-none` | Set up LDAP at 360 px: two hosts, StartTLS, a bind DN, a wrong bind password; Test; correct it; Test; map `students` and `staff`; turn on synchronisation; review; Save | "Step 2 of 4"; defaults prefilled from the capabilities (port 389, `mail`, 15 minutes); the first test says the credentials were rejected and names the address, and after a change the result is marked outdated; a duplicate `staff` entry blocks Next; the overview shows "Set", complete, directory password sign-in and no mailboxes (US1-AS2 to AS6) |
| US1 | `idp-none` | Set up Keycloak on a desktop | One page with a section index; the return addresses step lists `http://localhost:4173/ng/sso/return` with a copy action next to the classic return URL (US1-AS7) |
| US1 | UI 001's active domain-administrator scenario | Open `/ng/identity-providers/provider` | "No access", and no identity provider request in `mockApi.requests()` (US1-AS8) |
| US2 | `sso-available` | Open `/ng/sign-in`, then `/ng/sign-in/admin` | Passkey, "Single Sign-On" (`admin.iam_sso`), "or", form on the first; no single sign-on on the admin screen (US2-AS1, AS11) |
| US2 | `sso-available` | Open `/ng/mailboxes` signed out, tap single sign-on, complete with the return address | Busy state, then the provider address; on return, "Completing sign-in", then `/ng/mailboxes` with no `code` or `state` in the address bar (US2-AS2, AS3, SC-011) |
| US2 | `sso-available` | Return with `?error=access_denied&state=<state>` | "Cancelled or refused" without provider text; Try again starts a new sign-in (US2-AS5) |
| US2 | `sso-refused`, `sso-provider-down`, `sso-disabled-after-start` | Complete a return | The generic failure, "service not reachable" and "not offered" (with the action gone) respectively (US2-AS6, AS7, FR-048) |
| US2 | `sso-session-ends` | Signed in, apply `mockApi.patch({ singleSignOn: { endIdpSession: true } })`, navigate | Sign-in screen explains that the single sign-on session ended; after signing in again, the same page (US2-AS8) |
| US2 | `sso-signed-in` | Sign out | The confirmation adds the provider note (US2-AS9) |
| US2 | `sso-force`, `sso-force-ldap` | Open `/ng/sign-in` | Passkey and single sign-on only; with LDAP, the normal screen (US2-AS10) |
| US3 | `ldap-password`, `ldap-provider-down`, `keycloak-password-forced-2fa` | Sign in as `carl@example.org` | Home; "service not reachable" with the username kept and no countdown; the pending-actions screen (US3-AS1, AS2, AS4) |
| US4 | `idp-ldap` | Edit Connection and credentials, change a host | The bind password becomes required with the reason; saving sends only that section (US4-AS2, AS3) |
| US4 | `idp-changed-elsewhere` | Edit and save a section | Refused as outdated; the entries are kept and the changed values are marked (US4-AS4) |
| US4 | `idp-ldap-in-use`, `idp-other-source` | Look at Change provider type and Remove | Both unavailable with "340 mailboxes" and a link; with other-source mailboxes, removal is unavailable and only that type can be chosen (US4-AS6) |
| US4 | `idp-template-missing`, `idp-ignore-tls`, `idp-sync-overdue`, `idp-return-path-mismatch` | Open the overview | "Template missing", the TLS warning, the overdue status with its explanation and the job-log link, and the return-path warning (US4-AS5, AS8, FR-020, FR-027) |
| US4 | `idp-ldap` | Remove and confirm | Empty state; the sign-in screen no longer offers single sign-on (US4-AS7) |
| US5 | `oauth2-many` | Search "wiki", filter "With active tokens", sort, reload | The filters survive the reload, cards at 360 px, a table on the desktop, no secret anywhere (US5-AS1, AS7) |
| US5 | `oauth2-empty` | Add a client with a relative URI, then a valid one; close the dialog without copying | The entry is marked and nothing is sent; then the dialog shows the client ID and secret and asks for confirmation on close (US5-AS2, AS3, AS8) |
| US5 | `oauth2-many` | On a client: generate a new secret, revoke its 12 tokens, delete it | Each confirmation names the client with its consequences; the counts become 0; the list returns (US5-AS4 to AS6) |
| US5 | `oauth2-bulk-partial` | Select three clients, delete, type "3" | Two deleted, one outdated and still selected (US5-AS9) |
| US6 | `audit-identity-provider` | History from the overview and from a client; filter failed sign-ins | Changed settings with old and new values and "bind password changed"; a test with its address and outcome; the failed single sign-on with method, e-mail and "no matching mapping" (US6-AS1 to AS4) |

## Part C: Smoke suite against the mailcow-rest-v2 dev stack

```bash
export MAILCOW_REST_V2_DIR=../mailcow-rest-v2
SMOKE_IDP=1 scripts/smoke/stack-up.sh        # also starts the API's idp profile (OpenLDAP, Keycloak)
SMOKE_IDP=1 npm run test:smoke                # the whole suite, with @idp, @sso and the OAuth2 test
scripts/smoke/stack-down.sh
```

Keycloak imports mailcow-rest-v2's realm (`docker/keycloak/example-realm.json`, API gap G21), so
the single sign-on test needs no manual setup. The stack publishes Keycloak on
`SMOKE_KEYCLOAK_PORT` (default 18481). The API sends the browser to `http://keycloak:8080` (its
service name) and back to `http://localhost/ng/sso/return` (no port), so with `SMOKE_IDP=1` the smoke
project maps both to the published ports (`--host-resolver-rules`, `playwright.config.ts`). On a
mailcow host, `SMOKE_SSO_USERNAME` and `SMOKE_SSO_PASSWORD` run the test against the stored
configuration instead.

**Expected**:

- `identity-provider.smoke.spec.ts` passes: an LDAP setup with host `openldap`, a test with a wrong
  bind password reporting "credentials rejected", a passing test, and a save showing "complete".
- `provider-password.smoke.spec.ts` passes: `carl@example.org` gets a mailbox from the mapped
  template "Staff" and reaches home with the directory password; the mailbox and the configuration
  are removed afterwards.
- `oauth2-clients.smoke.spec.ts` passes: create, copy, edit, bulk secret renewal, bulk token
  revocation and bulk removal.
- `single-sign-on.smoke.spec.ts` stores the dev Keycloak, lands on home through the real provider
  as `anna@example.org`, with no `code` or `state` in the address or storage, and removes the
  mailbox and the configuration afterwards.

## Part D: On a mailcow host

1. Register `https://<host>/ng/sso/return` at the Keycloak client or OIDC provider, next to the
   classic return URL. Leave `RESTV2_SSO_RETURN_PATH` at its default `/ng/sso/return`.
2. Set up the provider in the app on a phone. Record the time from opening the screen to the saved
   LDAP configuration (SC-001: under 5 minutes).
3. Sign in with single sign-on on a mid-range phone from a deep link. Confirm the landing page, a
   clean address bar and clean storage (developer tools). Time the app's own steps (SC-002: under
   3 s for 95 % of attempts, measured over 20 attempts).
4. Compare the overview with the classic Identity Provider tab for an LDAP and a Keycloak
   configuration: every non-secret value matches (SC-007).
5. Add an OAuth2 client and copy its credentials on a phone (SC-008: under 90 seconds).
6. Run a moderated test with at least 5 administrators on failed connection tests of each category
   (SC-012: at least 4 name the cause without help).
7. Do a screen-reader pass of US1, US2 and US5 with VoiceOver on iOS and TalkBack on Android.

Record the results in a "Validation log" section appended to this file (T100).

## Validation log

### Part C, 2026-10-19 (T101)

- mailcow-rest-v2 at the pinned `33f1eea` (`scripts/smoke/stack-up.sh` with `SMOKE_IDP=1`, a clone
  of the API repository under `.smoke/api`), this app at the rebased `wt/012`, Playwright 1.64.1 in
  `mcr.microsoft.com/playwright:v1.64.1-noble` on the host network, one worker.
- Whole smoke suite, two consecutive rounds on the same stack: 37 passed, 0 failed, 0 skipped each
  time, including both `@idp` tests, the OAuth2 test and `@sso` through the imported Keycloak realm.
- The first run found three harness faults, now fixed:
  - `configureDevLdap()` stored no attribute mapping, so carl's first sign-in had no template to
    create his mailbox from ("Login failed", legacy's "no matching mapping"); it now maps
    `title: staff` to "Staff" as API quickstart Part B does, and the test removes carl's mailbox and
    the configuration afterwards, so that a second run starts clean;
  - the OAuth2 test chained three quick actions on one selection, but clients an action is done for
    leave the selection (FR-065); it selects them again before each action;
  - the single sign-on test needed hand-made settings; it now stores the dev Keycloak itself.
- Owner question 2 is settled: mailcow-rest-v2 ships the realm import (`bae8f34`), so the CI
  `smoke` job sets `SMOKE_IDP=1` and the single sign-on test is part of the suite.

