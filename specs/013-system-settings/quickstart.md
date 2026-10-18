# Quickstart and Validation Guide: UI Feature 013

**Feature**: `specs/013-system-settings` | **Plan**: [plan.md](./plan.md) |
**Contract**: [contracts/README.md](./contracts/README.md)

This guide proves the feature works. Part A covers the automated gates, Part B manual checks per
user story against the mock API, Part C the smoke suite against a real mailcow-rest-v2 dev stack,
and Part D a mailcow host. It refers to the spec, the research and the data model instead of
repeating them. Setup, servers and contract commands are those of
[UI 001's quickstart](../001-sign-in-app-shell/quickstart.md).

## Prerequisites

- UI features 001–012 implemented, and the contract pinned at a ref that contains the API 013
  contract (T001).
- Node.js 24 LTS, npm, Playwright browsers (`npx playwright install chromium webkit`).
- For Part C: Docker with Compose v2 and a mailcow-rest-v2 checkout whose dev stack provides the
  shared Rspamd map directory and the global Sieve files (API 013 quickstart).

## Part A: Automated gates

```bash
npm run lint && npm run typecheck && npm run contract:check && npm run i18n:check
npm run test:unit -- tests/unit/features/system-settings tests/unit/shared tests/unit/app/branding
npm run build && npm run budget:check
npm run test:e2e -- tests/e2e/system-settings     # all three projects
npm run test:e2e                                  # whole suite: limit-palette axe passes everywhere
npm run lhci                                      # now also /ng/system/ui-texts
```

**Expected**:

- `contract:check` passes, and `tests/unit/api/system-settings-operations.spec.ts` finds all 44 API
  013 operations of the contracts README.
- `i18n:check` passes with every `AuditEventType`, `AuditTarget` type, `AuditFailureReason`,
  `ValidationRuleCode` and `KnownProblemType` value of the pin shown through a legacy message or a
  new string in en-gb, cs-cz and sk-sk, and every legacy key used present in the `en-gb` snapshot.
- Every `US<n>-AS<m>` test of US1–US12 passes on `mobile-chromium`, `desktop-chromium` and
  `mobile-webkit`, with no axe violation in four passes (light, dark, light at the limit colour
  `#767676`, dark at `#8f8f8f`), no CSP violation, no mock contract violation, no horizontal scroll
  at 360 px and no touch target below 44 × 44 px.
- `budget:check` reports the initial JavaScript still below 204,800 bytes gzipped and lists the
  settings page chunks, the editor chunk and the e-mail preview chunk separately.
- `lhci` reports at least 0.9 for performance and accessibility on `/ng/system/ui-texts`.

## Part B: Manual checks per user story (mock API)

Start `npm run preview:mock`, open `http://localhost:4173/ng/system`, and choose a scenario with
`npm run mock:scenario -- <name>` (names in `tests/mocks/scenarios/system-settings.ts`). Check each
row at 360 px and on a desktop, in both themes.

| Story | Scenario | Steps | Expected (spec reference) |
|---|---|---|---|
| US1 | `settings-admin-defaults` | Open System settings on a phone; type "announcement", then "uprava" in Czech, then "System mails"; open the page switcher on a page; reload a page | Groups and pages with descriptions; "UI texts › Announcement" opens with focus on that heading; diacritics ignored; legacy names found; switcher lists all pages with the current one marked; reload keeps the page (US1 AS-1 to AS-5, AS-7) |
| US1 | `settings-domain-admin` | Open `/ng/system/logos` | "No access", no settings request (US1 AS-6) |
| US1 | `settings-capabilities-error` | Open System settings | Area error state with retry (FR-032) |
| US2 | `settings-admin-defaults` | Logos: choose the 300 × 80 PNG, upload; choose the SVG with a script; choose an oversized PNG; delete the dark logo | Previews on light and dark at header and sign-in size before upload; details after upload; unsafe SVG refused naming the construct; size refused before upload with the limit; dark preview shows the default (US2 AS-1 to AS-4) |
| US2 | `settings-admin-defaults` | UI texts: help text with a script; product name "Acme & Co Mail"; switch the warning announcement off; leave with unsaved changes | Script not shown, removal notice; literal name in header, sign-in and title; announcement gone; leave confirmation (US2 AS-5 to AS-8) |
| US3 | `brand-colours-none` | Enter `#1D4ED8`, `#FFD700`, then dark `#60A5FA`; save; clear both | 6.7:1 pass and dark 2.2:1 note; 1.4:1 fail with an offer; 5.8:1 with black text; whole app recoloured at once; defaults restored; status colours unchanged (US3 AS-1 to AS-6) |
| US4 | `settings-admin-defaults` | Hide the admin link; add "Helpdesk" with `%u`; enter `javascript:alert(1)`; move the third link to the top; open with 50 links (`app-links-50`) | Sign-in links follow; user link preview with `admin`; invalid entry marked; order saved; add unavailable with the limit (US4 AS-1 to AS-8) |
| US5 | `settings-admin-defaults` | Policy length 10 with digits and mixed case; length 2; reset sender `no-reply@`; clear the subject; preview the HTML template | Rules list updates; range stated; sender error; warning that reset stops working; preview with sample values, no script, no remote image (US5 AS-1 to AS-8) |
| US6 | `settings-domain-admin` | Open domain `example.org`, add `it@example.org` and `boss@example.net`, switch on, save; add `not-an-address`; save an empty active list | Section offered; entries saved; invalid entry marked; copies shown inactive (US6 AS-3 to AS-5) |
| US7 | `rspamd-rules-empty`, then `rspamd-rules-30` | Add a rule from "Disable Rspamd for a domain"; check an unclosed brace; save active; search, filter, sort, page; open the effective map; delete a rule | Empty state; preset fills, asks before replacing; error with position and "Go to line"; refresh-interval note; list with total; map read-only with copy; delete confirmation names the rule (US7 AS-1 to AS-7) |
| US7 | UI 005 scenario with a domain administrator with the filters flag | Create a mailbox filter, "Insert example" | Eight translated Sieve examples; asks before replacing (US7 AS-8) |
| US8 | `filter-maps-13` | Type `spam.example` on line 3; check `/[unclosed/i` on line 5; save valid content; save the vanished map; check `/x/im` | Line 3 marked live; line 5 named with "Go to line"; review of added and removed lines; unavailable message; two-flag refusal (US8 AS-1 to AS-6) |
| US9 | `global-sieve-default`, `global-sieve-restart-fails` | Check a missing semicolon; save the pre-filter restarting now; save the post-filter at the next restart; save with a failing restart; save an empty script | Line and parser reason; outcomes done, deferred and failed; empty-script note before confirming (US9 AS-1 to AS-6) |
| US10 | `mass-mail-120` | Preview all mailboxes; send; add a mailbox meanwhile (`mockApi.patch`); exclude `ghost@example.org`; open the running job; cancel; filter failed recipients | 120 recipients paged and searchable; "Send to 120 mailboxes"; changed count re-asks; refused entry marked; progress updates every 5 s, with a pause control and a pause after the inactivity limit; cancelled with skipped; failure reasons (US10 AS-1 to AS-8) |
| US11 | `settings-license-valid`, `settings-license-disabled` | Set a 12-character Rspamd password; try 5; save CORS with `*`; add `https://portal.example.org/app/`; switch the IP check on; verify the GUID | Password set and field cleared; minimum stated; `*` warning; path refused; third-party explanation; result with IDs; License absent when disabled (US11 AS-1 to AS-8) |
| US12 | `audit-settings-records` | Open History on a filter map, on the Rspamd page and on a completed job; open the quota copies as a domain administrator | Audit log filtered with actor, time, address and sizes; password only "changed"; creation and completion with counts; no History for domain administrators (US12 AS-1 to AS-4) |

## Part C: Smoke suite against a real mailcow-rest-v2 dev stack

```bash
export MAILCOW_REST_V2_DIR=../mailcow-rest-v2
scripts/smoke/stack-up.sh
npm run test:smoke -- tests/smoke/system-settings
scripts/smoke/stack-down.sh
```

**Expected**: the capabilities load and the overview lists the pages; a UI text, a brand colour, a
sign-in page option, CORS and the IP check are changed and restored, and the public configuration
reflects each change; a settings rule is created, checked and deleted; a filter map and both global
Sieve filters pass a Check without being written or restarting Dovecot; a mass mail preview counts
the seeded mailboxes without sending; the audit log, filtered by target type, lists these changes.
The Rspamd password, sending mass mail and license verification are deliberately not smoke-tested
(research R31).

## Part D: On a mailcow host

1. Deploy the release image as UI 001's quickstart Part D describes.
2. Open `https://<MAILCOW_HOSTNAME>/ng/system` as an administrator.

**Expected**:

- The `Content-Security-Policy` header of `/ng/` contains `img-src 'self' blob:` and no
  `'unsafe-inline'`.
- A brand colour saved in Colours recolours the app at once; the classic interface is unchanged.
- On the FeldHost deployment (license verification disabled), License appears nowhere.
- A Check of a global Sieve filter shows the parser's reason for a syntax error without restarting
  Dovecot.
- In Firefox, the password reset e-mail preview shows the template with its layout and placeholders
  for images, and the browser console reports no CSP violation (research R21).

## Validation log

Filled in by T181 and T182: device timings for SC-002 and SC-014 on a mid-range Android phone and
an iPhone, the moderated SC-001 test, a screen-reader pass (VoiceOver, TalkBack) of each user
story's main path, and the smoke run against the real API.
