# Quickstart and Validation Guide: UI Feature 005

**Feature**: `specs/005-account-self-service` | **Plan**: [plan.md](./plan.md) |
**Contract**: [contracts/README.md](./contracts/README.md)

This guide proves the feature works. Part A covers the automated gates, Part B manual checks per user
story against the mock API, Part C the smoke suite against the mailcow-rest-v2 dev stack, and Part D
a mailcow host with real devices. Setup, commands and the mock server are UI 001's
(`specs/001-sign-in-app-shell/quickstart.md`); only the additions are listed here.

## Prerequisites

- UI 001's prerequisites (Node 24, npm, Playwright browsers; Docker and a `mailcow-rest-v2` checkout
  for Parts C and D).
- UI 001 to 004 implemented; the contract pinned to a commit that contains API feature 005
  ([contracts/README.md](./contracts/README.md)).
- For Part D: an iPhone or iPad and a Mac for the connection profiles, an Android phone, a YubiKey,
  and a TOTP authenticator app.

## Part A: Automated gates

```bash
npm ci
scripts/contract/bump.sh <commit>       # once, in the setup task; then review contract/VERSION.json
npm run lint && npm run format:check
npm run typecheck
npm run contract:check
npm run i18n:check                      # new strings complete in en-gb, cs-cz, sk-sk; used legacy keys
                                        # in the en-gb snapshot; 005 problem types, rule codes, audit
                                        # labels; cs/sk plural forms
npm run test:unit
npm run build && npm run budget:check   # initial JS ≤ 200 KB gzipped; account and filters chunks listed
npm run test:e2e                        # mobile-chromium, desktop-chromium, mobile-webkit
npm run lhci                            # includes /ng/account (scenario account-mailbox)
```

**Expected**:

- Every command exits with 0.
- `test:e2e` reports every `US<n>-AS<m>` of US1 to US12 passing on both viewports, with no axe, CSP
  or mock contract violation, and the `SC-008` secrets audit passing.
- `budget:check` shows no growth of the entry chunk beyond a few kilobytes; every account page is a
  lazy chunk.
- `/ng/account` meets performance 0.8 and accessibility 0.9 (owner decision, 2026-10-20).
  The initial gzip budget stays 200 KiB; shell script transfer allows 210 KiB.

## Part B: Manual checks per user story (mock API)

Start `npm run preview:mock`, open `http://localhost:4173/ng/` and choose a scenario with
`npm run mock:scenario -- <name>` (scenario names in this feature's modules under
`tests/mocks/scenarios/`, one per story). Check each screen at 360 px and on a desktop, in both themes.

| Story | Scenario | Steps | Expected (spec reference) |
|---|---|---|---|
| US1 | `domain-admin-account` | My account › Password: change with "Sign out my other sessions" ticked; then type "summer" with the 10-character-and-digit policy | "Password changed, 2 other sessions signed out"; fields cleared; both rules unmet while typing (US1-AS1, AS3) |
| US1 | `forced-password-change` | Sign in as `bob@example.org`; open `/ng/account`; set a new password | The form without a current password; any address returns to it; home after saving (US1-AS5, AS6) |
| US1 | `forced-both` | Sign in, set the password | Second-factor setup follows on the same screen, passkey first (US1-AS6, FR-058) |
| US2 | `two-factor-empty` | Add an authenticator app: copy the key, enter the code your app shows for it | The QR code, grouped key, "Open in authenticator app" before the QR code at 360 px; the entry appears; the key is gone (US2-AS2, AS4) |
| US2 | `two-factor-single-active` | Remove the only entry | "Turn off two-factor authentication", current password asked, empty state afterwards (US2-AS7) |
| US2 | `two-factor-required-by-policy` | Open the section | No remove or turn-off action; the policy note (US2-AS8) |
| US3 | `password-reset` | Sign-in screen › "Forgot password?" › submit any address; then open `/ng/reset-password?token=3F9A1C-0B7E22-9D4F10-A6C3E8-51B2D7` | Same confirmation for every address; the token disappears from the address bar at once; the account, expiry and rules; after a new password, "sign in" (US3-AS3, AS4) |
| US3 | `password-reset` | Open the TOTP account's token, submit a valid password | The second-factor step as at sign-in; a wrong code allows another try (US3-AS5) |
| US3 | `password-reset-unavailable` | Open the sign-in screen and `/ng/reset-password/request` | No "Forgot password?"; the request screen says recovery is unavailable (US3-AS7) |
| US4 | `mailbox-account` | App passwords › Create "Phone"; close without copying; regenerate; delete | Password shown once with the username; close asks for confirmation; a new password once; gone after delete (US4-AS2, AS4, AS5) |
| US5 | `mailbox-account` | Open My account; choose Webmail; then the same with pop-ups blocked | 256 MiB of 1 GiB (25 %); webmail opens in a new tab; with the tab blocked, an "Open webmail" link (US5-AS1, AS3) |
| US5 | `mailbox-webmail-redirect` | Sign in from the sign-in screen; sign out; open `/ng/account/filters` and sign in | Webmail opens in the same tab; the second time the filters page opens (US5-AS4) |
| US6 | `temporary-aliases-many` | Generate "Shop" for one year; select two and "Expire in 1 week" with one failing | The new address with a copy button; per-alias results, the failed one stays selected (US6-AS2, AS3) |
| US7 | `mailbox-account` | Tagging "In subject"; TLS switches; Pushover with a 29-character token; save, verify, remove | Saved on change and announced; warning always visible; token error; verdict announced; "not configured" (US7-AS1 to AS6) |
| US7 | `mailbox-list-tls` (admin) | Mailbox list › select 30 › TLS enforcement › outbound on | "29 changed, 1 not found" (US7-AS7; needs API gap AG1 closed) |
| US8 | `recent-logins` | Period 1 month; filter IMAP; clear | Older entries appear; "internal" labels; empty after clearing (US8-AS1 to AS4) |
| US9 | `mailbox-account` | Mail app setup: copy values; download both profiles, the second with a new app password | Copy announced; POP3 note; downloads; the app password appears in App passwords (US9-AS1 to AS4) |
| US10 | `filters-many` (admin) | Mail setup › Filters › create with a syntax error; check; fix; activate a second prefilter | Parser message on the script; the warning names the other prefilter (US10-AS1, AS2) |
| US11 | `mailbox-account` | Devices › SOGo profile reset | The button stays disabled until the acknowledgement is ticked (US11-AS2) |
| US12 | `audit-self-service` (admin) | Mailbox detail of `anna@example.org` › History | Password change and app password creation, the password only as "changed" (US12-AS1) |

## Part C: Smoke suite against the mailcow-rest-v2 dev stack

```bash
export MAILCOW_REST_V2_DIR=../mailcow-rest-v2
SMOKE_COMPOSE_PROFILES=mail scripts/smoke/stack-up.sh # isolated API, seed data and Mailpit
npm run test:smoke -- --grep "@005"
scripts/smoke/stack-down.sh
```

**Expected**: `tests/smoke/{account,account-credentials,mailbox-self-service}.smoke.spec.ts` pass:

- `alice@example.org` signs in with TOTP, lists her second factors, creates and deletes an app
  password, generates and deletes a temporary alias, switches tagged mail, reads recent logins and
  the setup guide, and downloads the e-mail profile;
- `bob@example.org` resolves the forced password change on the pending-actions screen and lands on
  home;
- a password reset completes with the fragment link read from the delivered Mailpit message
  (`@local-stack`). The stack configures the reset SMTP target and its fixture templates.
- `admin` creates, checks and deletes a filter for `alice@example.org` and reads her app passwords
  in the mailbox context; `reseller` sees filters read-only when its `filters` flag is off;
- the webmail hand-off answers with the legacy cookie and opens `/SOGo/so/` in a new tab;
- `docker compose -f $MAILCOW_REST_V2_DIR/compose.yaml logs app | grep -c -E 'Passw0rd|generatedPassword'`
  prints `0`.

## Part D: On a mailcow host, with devices

1. Deploy as UI 001's Part D with this build, and set `RESTV2_PW_RESET_PAGE` to its default
   (`/ng/reset-password#token={token}`).
2. **Second factors**: enrol an authenticator app on an Android phone and an iPhone (scan and "Open in
   authenticator app"), a security key, and a YubiKey (Yubico OTP); sign in with each in the app and in
   the classic interface (SC-001 timing).
3. **Forced actions**: flag a mailbox for both forced actions in the classic interface; resolve them in
   the app within 60 seconds of signing in (SC-002).
4. **Reset**: request a reset, open the e-mailed link on another device, complete it with a TOTP code,
   sign in (SC-004 timing).
5. **Webmail**: choose Webmail on the home screen; webmail opens without a prompt within 3 seconds
   (SC-012); in the same browser the classic interface asks for a sign-in. Sign out of the app:
   webmail asks for a sign-in at its next request (spec edge case).
6. **Apple profiles**: download each variant on an iPhone, an iPad and a Mac (Safari), with and
   without an embedded app password; confirm that the profile installer opens (or that the file in
   Downloads installs), that mail, calendars and contacts work, and that the app password is listed
   (SC-013).
7. **Screen readers**: walk US1, US2, US3 and US4 with VoiceOver (iOS) and TalkBack (Android),
   including the grouped TOTP key and the one-time password dialog.

Record the timings and observations in a "Validation log" section appended to this file.

## Validation log

**2026-10-19, resumed password-reset checks:** the saved recovery/reset implementation now rejects
malformed, empty, repeated and overlong link tokens without retaining them or throwing during
navigation. A failed token check offers an explicit retry using the token kept in memory; reset
completion respects the server's retry time. The new regression tests failed before the fixes.
The focused unit run passed 17 tests (`password-reset.spec.ts`, `RecoveryEmailForm.spec.ts`), and
the reset-request, reset-page and recovery-email browser specs passed all 54 tests across mobile
Chromium, desktop Chromium and mobile WebKit. Type checking, the production build, and lint and
formatting of the changed files passed.

**T154:** reproduced a reset token in the UI container's access log, then verified the updated
configuration with the existing nginx runtime: reset and SSO deep links still serve the app,
while the access log contains neither the reset query token nor a token in the Referer header.
`nginx -t` passed. The image CI check now exercises this with a dummy token. This addresses the UI
container's access log; the upstream nginx-mailcow logging observation in plan AG7 still applies
to query-string reset links.

These are targeted checks of the resumed work. The remaining task boxes, full feature gates,
real API smoke flows and device validation are still pending.


**2026-10-20, account security and app-password release candidate:** UI 005 was rebased onto
UI main `d3a669bb`, retaining the released monitoring/quarantine work and the owner's performance
policy. This increment delivers US1–US4: own/forced password changes, second-factor management
and forced setup, recovery addresses and reset links, and app-password management in both own
and mailbox contexts. US5–US12 and the remaining feature-wide/manual acceptance tasks stay open.

The reset page now shows the account and relative/absolute expiry, expires safely on either
step, captures a second link opened on the same route, and keeps factor-specific failure text.
The forgot-password link is hidden after a failed capabilities refresh even if earlier data
remains cached. Reset mocks bind WebAuthn challenges to the browser and token and exercise
replacement, single use and throttling.

App passwords support search/filter/sort/paging, creation, rename/protocol/status changes,
regeneration, deletion and bulk activation/deactivation/removal. Generated passwords are shown
once with the mailbox username and raw-value copying. The approved legacy form map (D3/D13)
keeps the protocol multi-select, ID column and bulk controls; no creation-date column was added.
Domain administrators without `appPasswds` get read-only list/detail pages, and writes are also
rejected by the real API. Conflict handling retains drafts and requires an explicit save again.

Independent review regressions cover late secret responses, navigation between mailbox/app-password
contexts, cancellation of security-key setup, and Yubico 429/422/network errors. WebAuthn callers
can cancel their own request without cancelling a newer ceremony. Grouped secret dialogs put
initial keyboard focus on Copy, and expose/select the raw password if copying is refused.

AG7 is resolved for generated links: the API default and the read-only runtime check on maildev
both use `/ng/reset-password#token={token}`. The fragment never enters the upstream HTTP request.
Operators choosing legacy query-string links still need appropriate upstream logging configuration.
AG1 and AG2 were already closed in the pinned contract, as recorded in `contracts/README.md`.


Validation of this increment:

- Full unit suite: **3,861 tests in 441 files passed**, with **83.83% line coverage**. The first
  full run collected the new focus regression before its fix and failed only that case; the
  subsequent full run on stable source passed. Log: `u005/unit-final-stable.log`.
- Integrated browser regression: **389/389 passed**, no retries, across mobile Chromium,
  desktop Chromium and mobile WebKit. Scope: account security, recovery/reset, pending actions,
  passkey sign-in/management, sign-in factors and API-key creation/one-time-secret dialogs.
  Log: `u005/final-integrated-browser.log`.
- App-password browser suite: **36/36 passed**, no retries, across the same three profiles,
  covering own/admin/domain-admin contexts, permissions, conflicts, bulk operations, copy
  refusal, both-theme accessibility and reflow. A further **12/12 checks passed** on the final
  rebuilt release candidate, verifying initial Copy focus, raw selection after refusal, browser
  Back and sort/filter/order URL restoration, changed protocols, and the four-action create/copy
  flow from My account. Logs: `u005/app-passwords/browser-*.log`.
- Real API smoke: **7/7 passed**, serial with no retries, against API `2e10681` in the isolated
  `u005-smoke` stack and the final `mailcowui-ng:u005-release` runtime image. Verified own password
  round-trip, Bob's forced change, TOTP enrollment/removal, a delivered reset link with TOTP,
  own app-password creation/deletion, administrator metadata and domain-administrator read-only
  access with an actual API 403 on write. Credentials, recovery settings and Bob's forced flag
  were restored; temporary entries/accounts were removed. Fixed-password/generatedPassword
  marker counts were zero in app, web and storage logs; this is not the full T146 secrets audit.
  Log: `u005/account-release-smoke.log`. Later US5–US12 smoke flows in Part C remain unimplemented.
- Type checking, lint, formatting, translations, contract consistency, compatible licenses,
  production build and bundle budgets pass. The final initial payload is **193,343 / 204,800
  bytes gzipped**. Runtime dependency audit: no findings; the configured development audit passes
  with the existing 21 noncritical advisories (2 low, 4 moderate, 15 high).

The new app-password strings awaiting the owner's language review are
`account.appPasswords.noProtocol` and `account.appPasswords.regenerate.body` in the en-gb,
cs-cz and sk-sk account message files. T151 remains open for the complete feature's review.


The first release-candidate Lighthouse collection found sign-in at **216,139 transferred script
bytes**, above the unchanged **215,040-byte** cap, despite passing scores (85–89 performance,
100 accessibility). Collection was stopped early. Sign-in was importing the account feature's
async component wrappers and own-password API solely through its public barrel. The unchanged
capabilities query now lives in `src/shared/composables/useSelfServiceCapabilities.ts`, used by
both auth and account. The rebuilt sign-in dependency graph excludes those two unused chunks.
The 95 focused account/link unit checks pass after this move; the initial gzip budget remains
193,343 bytes. A further **68/68 browser checks** pass on the rebuilt production bundle, covering
sign-in, reset requests, forced second-factor setup and mailbox app-password pages. Both focused
real API checks (Bob's forced change and administrator app-password metadata) pass on the rebuilt
`mailcowui-ng:u005-shared` image. Type checking and changed-file lint pass again. Logs:
`capabilities-shared-unit.log`, `lazy-capabilities-browser.log`, `account-shared-smoke.log`,
`typecheck-shared.log` and `lint-shared.log`, under `u005/`. The isolated smoke stack was removed.
The final Lighthouse result is recorded below.


Final Lighthouse collected all **10 URLs × 3 runs** with no concurrent build/test workload.
The configured assertions pass for nine URLs, including My account (T149), and both shell-page
size checks. **The command still exits 1 for aliases** (74–77 performance, required 80), retained
under the owner's existing maildev staging exception. Domains now passes the configured
aggregation, although its individual runs vary. This is not a fully green Lighthouse gate.

| Page | Performance runs | Accessibility | Script transfer (shell gate only) |
|---|---|---|---|
| `/` | 82, 82, 82 | 100 | 200,898 / 215,040 bytes |
| `/account` | 90, 88, 87 | 100 | — |
| `/aliases` | 77, 75, 74 | 99 | — |
| `/dns/dkim-keys` | 80, 83, 84 | 100 | — |
| `/domains` | 83, 77, 76 | 99 | — |
| `/mailboxes` | 84, 81, 79 | 99 | — |
| `/operations/dashboard` | 81, 82, 84 | 100 | — |
| `/quarantine` | 77, 78, 80 | 100 | — |
| `/routing/relayhosts` | 82, 80, 81 | 99 | — |
| `/sign-in` | 87, 87, 86 | 100 | 213,656 / 215,040 bytes |

Evidence: `u005/lighthouse-final.log`, `lighthouse-summary.json` and
`lighthouse-final-reports/`. Performance remains 80, accessibility 90, initial gzip 200 KiB and
shell script transfer 210 KiB; none of the thresholds or throttling settings changed.
