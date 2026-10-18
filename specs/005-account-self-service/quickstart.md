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
npm run i18n:check                      # en-gb, cs-cz, sk-sk complete; 005 problem types, rule codes,
                                        # audit labels, permission flags; cs/sk plural forms
npm run test:unit
npm run build && npm run budget:check   # initial JS ≤ 200 KB gzipped; account and filters chunks listed
npm run test:e2e                        # mobile-chromium, desktop-chromium, mobile-webkit
npm run lhci                            # adds /ng/account (scenario mailbox-account)
```

**Expected**:

- Every command exits with 0.
- `test:e2e` reports every `US<n>-AS<m>` of US1 to US12 passing on both viewports, with no axe, CSP
  or mock contract violation, and the `SC-008` secrets audit passing.
- `budget:check` shows no growth of the entry chunk beyond a few kilobytes; every account page is a
  lazy chunk.
- `lhci` prints at least 0.9 for performance and accessibility on `/ng/account`.

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
scripts/smoke/stack-up.sh          # API dev stack with API 005's seed data (reset template, app passwords, filter)
npm run test:smoke -- --grep "@005"
scripts/smoke/stack-down.sh
```

**Expected**: `tests/smoke/{account,account-credentials,mailbox-self-service}.smoke.spec.ts` pass:

- `alice@example.org` signs in with TOTP, lists her second factors, creates and deletes an app
  password, generates and deletes a temporary alias, switches tagged mail, reads recent logins and
  the setup guide, and downloads the e-mail profile;
- `bob@example.org` resolves the forced password change on the pending-actions screen and lands on
  home;
- a password reset completes with the token read from the dev database (`@local-stack`);
- `admin` creates, checks and deletes a filter for `alice@example.org` and reads her app passwords
  in the mailbox context; `reseller` sees filters read-only when its `filters` flag is off;
- the webmail hand-off answers with the legacy cookie and opens `/SOGo/so/` in a new tab;
- `docker compose -f $MAILCOW_REST_V2_DIR/compose.yaml logs app | grep -c -E 'Passw0rd|generatedPassword'`
  prints `0`.

## Part D: On a mailcow host, with devices

1. Deploy as UI 001's Part D with this build, and set `RESTV2_PW_RESET_PAGE` to its default
   (`/ng/reset-password?token={token}`).
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
