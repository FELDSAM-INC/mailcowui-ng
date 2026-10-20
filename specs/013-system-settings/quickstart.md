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


### First implementation slice (2026-10-20)

Worktree `/home/feldsam/Projects/mailcowui-ng-wt/013`, branch `wt/013`, UI base `dbf920db`, API pin
`dd9a44e`. The first slice is the settings capabilities/layout/navigation boundary and IP check;
remaining pages, search, multi-section coordination and shared editor/preview foundations remain open.

Observed red tests covered missing query roots, missing capabilities/layout modules, missing section
save module, stale-version actions without changed fields, and the corresponding empty-diff wording.
The operation-presence guard and already-delivered binary validator passed immediately.

- Focused API, section, layout, page, navigation/router, formatter and validator units: **216 passed**.
  The final empty-diff wording change then passed all **23 impacted checks**.
- App, Node and test TypeScript checks: passed (`vue-tsc --build --force`).
- Lint, i18n and `contract:check`: passed. The pin checksum matches and regeneration produces
  identical artifacts.
- Production build and initial JavaScript budget: passed (**194,044 / 204,800 bytes gzip**).
- Browser tests: **18/18 passed**, zero retries, across mobile Chromium, desktop Chromium and
  mobile WebKit. The checks cover admin save, both denied roles, failed-capability retry, demo mode,
  stale save, unsaved navigation, both-theme axe checks, reflow and touch targets.
- Local-stack smoke: **1/1 passed**, zero retries, against the isolated API on port 18580 through
  the production preview. It verifies the changed value and ETag, reload persistence, and the
  restoration response matching the original opt-in value. The original value is restored in
  `finally`; the live deployment is not used.

Validation artifacts are in
`/home/feldsam/Projects/mailcow-rest-v2/storage/app/restart-2026-10-20/u013/`.

No push or deployment was performed from this worktree. UI005 files were not edited.


### Filter maps and shared editor checkpoint (2026-10-21)

The map list loads the pinned API's lightweight summaries; opening a map fetches its content.
The original T123 suggestion to seed detail caches from list content cannot apply to this contract.
Editing supports immediate structural marks, server PCRE checks, explicit change review, versioned
save, unavailable maps, missing-map navigation, and preserved drafts after conflict or server errors.
Legacy invalid-ID/write-error messages keep the API's English diagnostic text out of the UI.
The cs-cz/sk-sk new map strings intentionally retain the approved English source fallback pending
translation review; existing legacy keys use the installation's own selected-language translations.

The shared editor checkpoint `5c9c4e61` caches logical-line heights, updates only changed lines,
skips hidden mirror work for plain templates, and keeps gutter positions correct after wrapping,
Unicode, blank lines, edits, scrolling, and viewport changes. Structural map validation also updates
only the affected lines synchronously. No work is deferred until after typing to conceal latency.

- Relevant units: **23/23 passed**, including the one-MiB line diff under 50 ms.
- Functional/layout browser checks: **33/33 passed**, all three profiles, zero retries.
  Near-limit and over-limit status assertions additionally run on all three profiles.
- Real API smoke: **1/1 passed**, read plus `validateOnly`; content and ETag unchanged.
  The isolated u005-smoke stack had no available map file. An absent-only fixture was created in
  its verified bind-mounted `storage/dev-mailcow/rspamd_custom_maps` directory, and removed in a
  `finally` block with absence verified. No existing file was overwritten, no real map PUT was
  allowed, and no service was restarted. The first fixture-free attempt exposed this environment
  prerequisite and is not counted as a product failure.
- Separate fresh app/test typechecks, focused lint, i18n structure and production build passed.
  Initial JavaScript: **202,641 / 204,800 bytes gzip**. Runtime dependencies did not change.
- **T120/T127 remain open.** The one-MiB map opens under 2 s, but each of the three native-editor
  timing cases still exceeds the unchanged 100 ms input-to-frame limit: mobile Chromium peaks
  at 100.2 ms, desktop Chromium 127.8 ms, and mobile WebKit 386 ms. The measurements include
  a long-task observer where the browser supports it. Standalone native textarea measurements
  show that WebKit's own large-document editing already exceeds 100 ms without application code.

Evidence: `/tmp/u013-map-final-units.log`, `/tmp/u013-maps-functional.log`,
`/tmp/u013-maps-size.log`, `/tmp/u013-maps-smoke2.log`, `/tmp/u013-maps-final-lint2.log`,
`/tmp/u013-maps-release-{app,tests}.log`, `/tmp/u013-maps-release-{build,budget,i18n}.log`, and
`/tmp/u013-editor-browser2.log`. Browser traces/results are under
`test-results/u013-maps-checkpoint`, `test-results/u013-maps-size`, and
`test-results/u013-editor-cache2`. The native performance failure is retained for follow-up;
this checkpoint does not claim full US8 completion.


### Lazy large filter-map editor checkpoint (2026-10-21)

R17a records why initially large filter maps now opt into a separate virtualized editor. The
native editor remains the default for other callers and for maps initially below 128 KiB. Only
large map visits download the approximately 90 KB gzip editor chunk. The editing engine remains
stable for the visit, including when typed or pasted text crosses that threshold.

- **23 relevant unit checks passed**: opt-in/default selection, stable editing surface, native
  editor behavior, incremental validation and cached logical-line geometry.
- **42 functional browser checks passed**, across all three profiles, including the nine new
  large-editor checks and all existing map/layout regressions, with zero retries. They cover
  readonly behavior, undo, Unicode, native Tab navigation, offscreen error repair, wrapping,
  complete request content, strict CSP, both-theme axe and 320 px reflow.
- Fresh app and test typechecks, focused lint, formatting, production build and dependency checks
  pass. All 102 shipped packages are GPL-compatible; the production dependency audit reports no
  known vulnerabilities. Initial JavaScript is **202,652 / 204,800 bytes gzip** at this branch base.
- Both one-worker cold-input runs pass both Chromium profiles. WebKit still fails the unchanged
  100 ms gate: first keys are **161 ms** and **104 ms**. The final run additionally asserts that
  every measured frame already contains its typed prefix; all thirty frame assertions pass. Its
  WebKit samples are 104, 32, 36, 14, 18, 29, 16, 16, 16, 13 ms. Every profile opens the one-MiB map
  under 2 s. The cold-key variability is not resolved. **T120/T127 remain open.**
- Timing starts at captured `beforeinput` before the editor's handler, includes the first key,
  and retains long-task checks where supported. There are no synthetic edits or typing warm-ups.
  The adapter performs initial layout before enabling editing, within the same open-time gate.
- Manual physical-IME and screen-reader checks remain outstanding. This checkpoint does not claim
  that the timing or manual accessibility gates are complete.

Evidence: `/tmp/u013-large-editor-final-{unit2,app,tests,lint2,formatcheck,build,budget,licenses,audit}.log`,
`/tmp/u013-large-editor-final-{functional,perf,visible}.log`; the failing cold-key traces are
retained in `test-results/u013-large-editor-final-perf` and `test-results/u013-large-editor-final-visible`.


The follow-up lazy-download recovery shows an announced loading state, then offers **Use basic
editor** if the enhanced editor cannot be downloaded. It retains the full map and uses the native
editor already in the application; it warns that large files may respond more slowly. A reload-only
attempt failed in WebKit because the browser retained the failed module, so recovery no longer
requires that module or another network request. The regression aborts the chunk, chooses the native
fallback, edits and validates a map successfully on all three profiles (**3/3 passed**). Seven
focused editor units, fresh app/test typechecks, lint, formatting, i18n and production build pass.
The two new recovery strings use the explicit English source fallback in cs-cz/sk-sk. The unchanged
cold-input gate above remains open. Evidence: `/tmp/u013-editor-fallback-{browser,unit,app,tests,lint,formatcheck,i18n,build,budget}.log`.

### Cold first-frame investigation (2026-10-21)

T120/T127 remain open. A temporary diagnostic on the recovery build recorded the first WebKit
character in the DOM after 1 ms, the editor transaction complete after 10 ms, and its Vue/UTF-8
update complete after 19 ms. The next animation-frame callback arrived after 123 ms. A second
fresh context in the same browser process measured 17 ms, so repeating contexts alone can hide
the cold-process problem. No synthetic edits or typing warm-up were used.

A subsequent controlled comparison used the copied, unchanged main `23975541` production build,
with other agents' browsers, builds, typechecks and Lighthouse stopped. Every case launched a
fresh browser process, used one worker and zero retries, and retained the same 1 MiB document,
2 s opening limit, first keystroke, ten visible-prefix assertions and 100 ms input-to-frame limit.

| Fresh-process pair | Tracing enabled: first key | Tracing disabled: first key |
| --- | ---: | ---: |
| 1 | 126 ms | 143 ms |
| 2 | 114 ms | 164 ms |
| 3 | 162 ms | 142 ms |

All six opening checks and all sixty visible-prefix assertions passed; all six first-key timing
checks failed. Tracing does not explain the delay, so neither tracing configuration nor the
performance threshold was changed. The temporary profiler was removed from the source tree.
Initial layout/paint readiness still needs investigation; physical IME and real screen-reader
checks also remain outstanding. No new product behavior is claimed by this checkpoint.

Evidence: `/tmp/u013-editor-latency-profile.log`, `/tmp/u013-editor-ab-{1,2,3}-{retain-on-failure,off}.log`,
`/tmp/u013-editor-ab-timings.json`, and `test-results/editor-{profile,ab-*}` in the
`013-editor-latency` worktree. Two preliminary launches overlapped another agent's typecheck,
were stopped, and are excluded from these measurements.


### CORS and License checkpoint (2026-10-21)

- **118 focused unit checks pass**, including origin syntax/normalization, API requests and
  refusals, all four license results, disabled-license no-request behavior, legacy form controls,
  the shared capabilities layout/IP-check regression and contract-derived limits.
- **39 browser checks pass**, across mobile Chromium, desktop Chromium and mobile WebKit, with
  zero retries. The initial run passed 36; the remaining three required a selector correction to
  include the shared screen-reader error prefix, and all three passed on the same frozen build.
  Coverage includes normalization, pasted/empty/wildcard/invalid/over-limit origins, method choices,
  saved versions and explicit conflict retry, dirty navigation, role denials, read retries, copy,
  all license results, progress, feature-disabled refresh, both-theme axe and 320 px reflow.
- **2 real-API smokes pass** on the existing isolated stack at port 18580. CORS adds one reserved
  `.invalid` origin and restores/verifies the exact original origins and methods in `finally`.
  License is read only: no request to `/license/verification` and no external verification call.
  Preview 4241 and all browser containers were stopped afterward.
- Fresh app/test typechecks, focused lint, formatting, i18n, production build and initial bundle
  budget pass. The new strings keep an explicit English source fallback in cs-cz/sk-sk. No runtime
  dependency or API contract change is needed. Root integrates contextual navigation separately.

Evidence: `/tmp/u013-cors-license-{unitfinal,app2,tests2,tests-final,lint2,browser-lint,format-final,i18n,build2,budget}.log`,
`/tmp/u013-cors-license-browser.log`, `/tmp/u013-cors-license-rerun.log` and
`/tmp/u013-cors-license-smoke.log`. Browser artifacts are in `test-results/u013-cors-license`,
`test-results/u013-cors-license-rerun` and `test-results/u013-cors-license-smoke`.
The native multiple-select replaces the planned checkbox component per the owner-approved legacy
form rule; whole US11 and global/manual release gates are assessed with the earlier Rspamd/IP-check
slices rather than inferred from this checkpoint alone.
