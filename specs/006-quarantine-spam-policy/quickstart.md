# Quickstart and Validation Guide: UI Feature 006

**Feature**: `specs/006-quarantine-spam-policy` | **Plan**: [plan.md](./plan.md) |
**Contract**: [contracts/README.md](./contracts/README.md)

This guide proves the feature works:

- **Part A**: the automated gates;
- **Part B**: manual checks per user story against the mock API;
- **Part C**: the smoke suite against the mailcow-rest-v2 dev stack;
- **Part D**: parity checks on a mailcow host next to the classic interface.

It refers to the spec, research and data model instead of repeating them. The setup, servers and
scripts are UI 001's
([UI 001 quickstart](../001-sign-in-app-shell/quickstart.md)).

## Prerequisites

- UI 001–005 are implemented, and their gates pass on `main`.
- The contract pin contains API 006 (`contract/VERSION.json` commit `32079252…` or later, research
  R1).
- For Part C: a mailcow-rest-v2 checkout at `$MAILCOW_REST_V2_DIR` (default `../mailcow-rest-v2`)
  with API 006 implemented, and Docker with Compose v2.
- For the legacy form map and the legacy keys: a mailcow-dockerized checkout with the upstream tags
  at `$MAILCOW_REPO` (default `../mailhosting`). Legacy texts are loaded at runtime from the
  installation's `/lang/`, so nothing is imported.

## Part A: Automated gates

```bash
npm ci
npm run lint && npm run format:check
npm run typecheck
npm run contract:check          # pin contains API 006; generated types current
npm run i18n:check              # new strings en/cs/sk; legacy keys in en-gb snapshot; 006 enums (R2)
npm run test:unit               # includes the SC-005 matrix and the SC-002 hostile corpus
npm run build && npm run budget:check
npm run test:e2e                # every US1–US9 scenario on mobile-chromium, desktop-chromium and mobile-webkit
npm run lhci                    # adds /ng/quarantine (mailbox user scenario)
```

**Expected**:

- Every command exits with 0.
- `test:e2e` lists the titles `US1-AS1` to `US9-AS3`, `SC-002 …`, `FR-0xx …` and `Edge: …`, all
  passing on both viewports, with no axe, CSP or mock contract violation.
- `budget:check` reports an unchanged initial JavaScript size, and lazy chunks for the quarantine,
  spam filter and rate limit routes.
- `lhci` reports at least 0.8 for performance and 0.9 for accessibility on `/ng/quarantine`
  (owner decision 2026-10-19).

Focused runs:

```bash
npm run test:e2e -- --grep "US1-"                       # the MVP story
npm run test:e2e -- --grep "SC-002"                     # hostile corpus, both viewports
npm run test:unit -- tests/unit/features/quarantine/permissions.spec.ts   # SC-005 matrix
```

## Part B: Manual checks per user story (mock API)

Start `npm run preview:mock` and open `http://localhost:4173/ng/`. Choose a scenario with
`npm run mock:scenario -- <name>`, which prints a ready URL. Scenario names are defined in
`tests/mocks/scenarios/{quarantine,spam-filter,rate-limits}.ts`. Check each screen at 360 px and on
a desktop, in both themes.

| Story | Scenario | Steps | Expected (spec reference) |
|---|---|---|---|
| US1 | `quarantine-mailbox-user` | Open Quarantine; filter "Rejected"; open an item; deliver with the switch on, then another with it off | 25 of 30 items, newest first; the status notice; the item's symbols sorted, with signed scores; delivered "and learned", then "without learning" (AS1, AS3–AS5) |
| US1 | `quarantine-hostile` | Open several hostile items; tap phone numbers and links in the text | Text shown literally, with `U+202E` markers where overrides were; nothing tappable; the layout is intact (AS2, SC-002) |
| US1 | `quarantine-user-no-actions` | Open the list and an item | The notice "actions are disabled for your mailbox"; no action or `.eml` download (AS8) |
| US1 | `quarantine-mailbox-user` | Open the virus item; choose "Deliver to inbox"; download an attachment | Confirm stays disabled until the acknowledgement is ticked; the download warns first and then saves a file (AS7, FR-037) |
| US2 | `quarantine-domain-admin` | Filter by domain, "Junk folder" and virus "High"; sort by score; go to page 2; reload | The same view after the reload; only the two domains are offered (AS1, AS2) |
| US2 | `quarantine-bulk-failures` | Select 40 items on a 50-item page; deliver | The confirmation names 40; the summary shows 39 done and 1 not found, with rows; the failed row stays selected (AS3) |
| US2 | `quarantine-domain-admin` | Change the page while items are selected | The selection is cleared, with an announcement (research R15) |
| US3 | `notifications-user-no-category` | Open Quarantine › Notifications; choose "Daily"; save | Saved and announced; the category is read-only with "Prohibited by ACL: Change quarantine notification category" (AS1, AS2) |
| US3 | `quarantine-domain-admin` | Mailbox list: select 30, choose "Set quarantine notifications" › "Weekly" | 29 done, 1 not found (AS4) |
| US4 | `spam-score-defaults` (cs-cz) | Open Spam filter; enter `6,5` and `12`; save; add `*@Spam.Example ` to the Denylist | Defaults 8 and 15 shown; saved as 6.5 and 12 in Czech format; `*@spam.example` added and the field focused again (AS1, AS2, AS6) |
| US5 | `policy-domain-admin` | Open `/ng/domains/example.org/spam-filter` | Own entries, then "Set for mailboxes" with links to each mailbox's page (AS2) |
| US6 | `rate-limits-domain-admin` | Set 100 msgs / hour on the domain; open a mailbox's page | The mailbox shows "100 msgs / hour, from the domain example.org" (AS1) |
| US6 | `rate-limits-admin` | Overview: filter "Mailboxes"; reset `RLabc=` and then `RLunknown` | Four mailbox limits; "reset", then "nothing to reset" (AS4, AS6) |
| US7 | `quarantine-settings-fresh` | Open Quarantine › Settings; set retention 20 and size 15 MiB | "Inactive" with the reason, then "active" (AS1, AS2) |
| US7 | `quarantine-settings-custom` | Show and edit the template containing `<img src=x onerror=alert(1)>`; restore the default | Only source text; the size indicator; the default restored and marked (AS5, AS6) |
| US8 | `spam-statistics`, `spam-statistics-unavailable` | Open Quarantine › Statistics | Counts, shares of 1,000 and bars in text; then "temporarily unavailable" with a retry (AS1, AS2) |
| US9 | `quarantine-audit` | Open History from Settings and from a mailbox's spam score panel | The audit log filtered by target, with step outcomes and no subject (AS1, AS2) |

## Part C: Smoke suite against the mailcow-rest-v2 dev stack

```bash
export MAILCOW_REST_V2_DIR=../mailcow-rest-v2
scripts/smoke/stack-up.sh      # API dev stack (with API 006 seed data) + mailpit + this image as ng-mailcow
npm run test:smoke -- --grep "@006"
scripts/smoke/stack-down.sh
```

**Expected**:

- `stack-up.sh` ends with `ready: http://localhost:8080/ng/`, and the mailpit UI answers on
  `http://localhost:8025`.
- `alice@example.org`:
  - lists 30 items, opens one and downloads an attachment as a file;
  - delivers one without learning, and mailpit receives it;
  - delivers one with learning, and the app reports "delivered, but the filter could not learn it",
    because the dev stack has no Rspamd (US1-AS6);
  - learns one as spam, and the app reports a temporary failure with the item kept;
  - sets and resets her spam score, and adds and removes a Denylist entry next to the read-only
    domain entry `*@spam.example`.
- `reseller` sets and removes a mailbox rate limit and sees the domain's `100 / 1h` as the
  effective limit afterwards. He sets notifications for two mailboxes from the mailbox list.
- `admin`:
  - opens the settings, where a template `{% for x in meta %}` is refused with "syntax error, line
    1";
  - sees the statistics in the "temporarily unavailable" state;
  - gets "nothing to reset" for an unknown bucket;
  - finds the release in History by target.

## Part D: On a mailcow host, next to the classic interface

1. Install the image as UI 001's quickstart Part D describes.
2. For ten items, compare the classic quarantine list and item modal with the new list and item
   page (SC-006): every value is present, allowing for formatting.
3. Save a spam score, a Denylist entry, the notification settings and a rate limit in the app, and
   confirm that the classic pages show the same values (API SC-003).
4. Release an item with learning, and confirm in Rspamd's history that `learnham` was called.

## Validation log

Task T139 appends here:

- SC-001 timings on a mid-range Android phone and an iPhone;
- SC-010 timings;
- a VoiceOver and TalkBack pass through US1, US2, US4 and US7 (SC-003);
- the SC-011 moderated test with at least 5 mailbox users.

**2026-10-19, resumed list implementation (local `wt/006`)**: the saved branch could not build
because its registered `QuarantineListPage.vue` did not exist. The page now renders the caller's
items as cards or a table, with legacy labels, inert message text, URL search/filter/sort/page
state, draft filters, status information, count announcements, error recovery, and single removal
with confirmation and `If-Match`. The existing item page receives the Show item links.

Validation of this slice:

- The first saved-feature unit run passed 108 tests but could not load the rate-limit section
  suite because of the missing page. After the page was added, those 14 rate-limit section tests
  passed. The ten new page/filter unit tests pass, including ignored mailbox-user scope filters,
  hostile text, empty/no-match states, pagination, draft application and invalid filter ranges.
- Type checking, the production build and lint of the new files pass. No new translation was
  introduced. The full translation gate still fails on the saved, unused
  `quarantineUi.bulk.virusCount` key; the bulk UI that uses it remains unfinished.
- The first three-browser list run passed 12 checks and failed the same tap-target check in each
  project for a subject containing only `-`. A minimum width fixed that link in both layouts;
  all three affected checks pass after rebuilding. The passing paths cover paging and page size,
  filters and reload, empty/inactive/read-only states, retry after a failed read, and confirmed
  removal with a single versioned request. Accessibility in both themes, horizontal reflow,
  touch targets, the production CSP and the hostile-content request guard are included.
- The additional administrator recipient-filter and sort/reload test passes in all three browser
  projects. Desktop `aria-sort`, mobile sort controls, both-theme accessibility and reflow are
  covered. All six list scenarios now pass across the three projects (18 checks across the
  initial run and focused follow-ups).
- A regression test first reproduced stale list data after a removal received `412`. The action
  now waits for both detail and list refreshes before a new confirmation can submit the updated
  version tag. The page/action suites pass together (19 tests); lint and type checking pass.

Logs are under the API checkout's ignored `storage/app/restart-2026-10-19/u006/resume-*.log`.
This is a checkpoint of the list work, not completion of US1 or UI 006: bulk actions, remaining
item/download/hostile-content coverage, integration entry points, smoke, performance and the
real-device/live-host checks remain pending. The branch has not been rebased, merged or deployed.

**2026-10-20, quarantine bulk actions (local `wt/006`)**: the list now offers explicit selection
mode and the server's bulk limit. Select all takes the first permitted number on the current page;
page, size, search, filter, sort and browser-history changes clear the selection. Both layouts use
44 px selection controls and the shared sticky action bar.

Deliver to inbox, release without learning, learn as spam and delete, and removal use one request
with each listed version tag. Every action is confirmed with subjects and recipients; deletions
require the typed count, and virus deliveries require acknowledgement of the virus count. Results
show each message's outcome and learning warnings. Failed, refused and outdated targets remain
selected. A retry refreshes and confirms again, and cannot accidentally include newly selected
messages. A lost response refreshes the list, reports unknown outcomes and sends no retry. A
whole-request refusal preserves the selection.

Validation of this slice:

- Test-first failures covered the missing bulk modules/page controls and a retry that incorrectly
  included a newly selected message. The quarantine feature suites now pass **94 tests in 13
  files**. The existing contract-validated quarantine mock-handler suite passes **21 tests**;
  the confirmation component's five tests also passed after the final theme-color change.
- Type checking, changed-file ESLint, formatting, production build and bundle budget pass. The
  initial JavaScript is **188,897 bytes gzipped**, below 204,800. No Lighthouse measurement was
  needed for this local slice.
- The full translation gate passes: the dialog uses the already translated
  `quarantineUi.bulk.virusCount`, resolving the previous unused-key failure. No new strings were
  introduced.
- All **45 distinct browser checks** (nine bulk scenarios and six existing list scenarios, across
  mobile Chromium, desktop Chromium and mobile WebKit) pass across the initial run and focused
  follow-ups. Coverage includes 40 selected messages with one already removed, 100 deletions and
  result rows, mixed outcomes, typed counts, virus acknowledgements, unknown outcomes, whole
  refusals, selection resets, both-theme axe, touch targets, reflow and CSP. The first run passed
  37/42: three failures were an incorrect fixture-subject expectation, and two exposed inherited
  text colors in a WebKit dark-theme dialog. Explicit theme colors fixed the latter. The second
  run passed 29/30; its remaining test advanced before the debounced search finished and used an
  absent fixture phrase. Waiting for each URL/list transition with a matching phrase passed in
  all three projects (3/3). No retry count or timeout was increased.

Logs and browser failure artifacts are under the API checkout's ignored
`storage/app/restart-2026-10-20/u006/`; no test containers remain running.

This remains a local checkpoint. Remaining item/download/hostile-content coverage, scope and
recipient integration, smoke tests and the feature's final integration/release checks are still
open. T060, T062 and T064 are not completed by the bulk slice. The owner's performance minimum of
80 and shell script-transfer allowance of 210 KiB are already on UI main; preserve those policies
when this older worktree is eventually integrated.

**2026-10-20, item actions and host integration**: resumed past the earlier checkpoint. The
mailbox, domain and alias-domain pages now mount the spam-filter section in legacy order. The
mailbox's two notification fields save with its existing Save action and their own version tag;
the mailbox list offers the notification bulk menu. Single-message and bulk-notification actions
lock during confirmation and sending, retain explicit retry targets, and do not resend unknown
outcomes. Administrators have a notification History link in the mailbox section.

The initial 57 item/action/download/host integration checks pass on Chromium at 360 px and desktop
and WebKit at 360 px. The policy/settings/notification/rate-limit run passed 27 checks; the six
selector corrections passed in the subsequent focused run. The hostile corpus covers 61 vectors.
It exposed a WebKit stall on headers and symbol options with 5,000 lines: these metadata fields
now have bounded, expandable plain-text previews. The focused six-case check including that
vector passes on all three profiles, without changing timeouts or retries.

The feature unit suites passed 163 tests before the additional settings/statistics/cache/preview
checks. New regressions cover duplicate submission, changes during confirmation, retry scope,
notification version conflicts, byte limits and bounded metadata rendering. All three isolated
API smoke cases passed across the initial and focused HTTPS runs: message download and delivery
to Mailpit; mailbox notifications, scores, policy and rate limit round trips; invalid template
rejection and statistics matching the API. The dev API supplies deterministic statistics; this
is not a real Rspamd parity measurement.

Smoke runs use `SMOKE_BASE_URL=https://web/ng/ SMOKE_IGNORE_HTTPS_ERRORS=1` inside the isolated
`u006-smoke_default` Docker network. HTTP on the service hostname cannot retain the API's Secure
cookie. The opt-in certificate exception is confined to the smoke browser. No deployed mailbox
or message was modified. Logs and failure traces are retained under the API checkout's ignored
`storage/app/restart-2026-10-20/u006/`. Final integration checks and deployment are recorded below
when complete. Physical-device, assistive-technology, moderated-user and live-mailcow comparisons
remain outside these automated results.

**2026-10-20, integration with deployed monitoring**: rebased the feature onto UI main
`8431c4eb`, preserving the performance-80, accessibility-90 and shell-transfer-210-KiB policies.
The shared plain-text renderer retains monitoring's explicit element choice and the quarantine
screen-reader description of control markers. Audit details retain monitoring's bounded list
expansion. One shared bucket-reset mock now removes monitoring log entries and quarantine
counters, records history and preserves the monitoring failure injections.

Integration validation:

- The full unit suite passes **3,633 tests in 415 files**, with **85.07% line coverage**, including
  the stricter security-area thresholds. The final CSS-only contrast correction also passes
  seven confirmation component tests.
- Type checking, ESLint, changed-code formatting, contract generation/checksum, translations,
  licenses and the configured dependency audit pass. Production dependencies have no reported
  vulnerabilities. The audit still reports 21 development-tool findings (none critical), within
  the existing development audit policy.
- The feature/monitoring browser run passed 218 checks and skipped the desktop-only counterpart
  of a phone-layout check. Three WebKit dark-theme failures exposed inherited text colors in
  bulk confirmations; explicit colors on the affected paragraphs and list items fix them.
- The host-screen browser run passed 285 checks and skipped three viewport-specific checks.
  Twelve failures were obsolete global Save/History selectors, the old expectation that no spam
  filter existed, or an audit request-count check made before the initial read completed.
  Selectors now name the relevant section, and the request-count test waits for loaded records.
  The focused **39-check** run passes on all three browser profiles, covering every failure from
  both runs: **518 distinct selected browser checks pass across the runs, with four skips**.
  Both-theme axe, touch targets, reflow and production CSP checks remain enabled. No retry count,
  timeout or accessibility threshold was relaxed.
- All **three real-API smoke cases pass together** against the integrated Docker image and API
  `8ae22afa7fd271449c4c2fe23c3df7fe970a5464` in the isolated `u006-smoke` stack. The final
  changes after that run affect confirmation text colors and test selectors only.
- The final initial JavaScript is **195,519 / 204,800 bytes gzipped**; the existing dashboard and
  chart chunk budgets also pass.

Logs are `integrated-unit-final.log`, `integrated-browser.log`, `host-regression.log`,
`final-focused-browser.log`, `integrated-smoke.log`, `theme-unit.log` and `final-budget.log` under
`storage/app/restart-2026-10-20/u006/` in the API checkout. Failing runs and their browser traces
are retained alongside the passing follow-ups. This validation does not close every acceptance
case in the original task list or the physical-device/live-mailcow/manual checks above.

**2026-10-20, release loading improvements**: the first integrated Lighthouse run found a
217,621-byte sign-in script transfer and quarantine performance of 71–73. Route registration now
uses the three declarative route entry points, keeping notification forms and API composables out
of the shell. Common collection controls and form-feedback helpers have separate lazy chunks;
the four UI 006 message files that always load together now share one chunk per locale. Sign-in
does not import the collection chunk. The entry remains **189,635 / 204,800 bytes gzipped**.

The quarantine page reserves its translated notice's space and keeps the footer below the
viewport while reads are pending, reducing measured layout shift from 0.112 to 0.001. Mobile
cards mount their collapsed metadata only when the native disclosure opens. A delayed-response
browser regression failed before the layout fix; a component regression observed 100 premature
metadata fields before the disclosure fix. The final component run passes **10 tests**. The
list/bulk/loading browser run passes **50 checks**, with one desktop skip for the phone-only
keyboard disclosure case, including both-theme axe, touch targets, paging and reopening details.

The release-wide Lighthouse collection ran all nine canonical scenarios three times on the
quiet machine, with the pinned Chromium image and the existing mobile/4G settings. Its only
failed assertions are the previously reported domains and aliases performance checks:

| Page | Performance, three runs | Accessibility |
|---|---|---|
| Quarantine | 80, 79, 79 | 100 |
| Dashboard | 84, 83, 85 | 100 |
| Relayhosts | 81, 80, 80 | 99 |
| Mailboxes | 81, 80, 81 | 99 |
| DKIM | 83, 84, 83 | 100 |
| Aliases | 77, 75, 74 | 99 |
| Domains | 76, 77, 78 | 99 |
| Home | 80, 80, 81 | 100 |
| Sign-in | 88, 88, 88 | 100 |

The existing LHCI aggregation passes quarantine's performance-80 assertion; two individual runs
remain at 79. Sign-in transfers **208,730 / 215,040 script bytes** and home 197,194. Every
accessibility and shell-transfer assertion passes. This is not a green full Lighthouse run:
the two existing list failures remain under the owner's already authorized maildev staging
exception. No threshold or aggregation setting was changed. Results and all 27 JSON/HTML reports
are retained in `release-lighthouse.log` and `release-lighthouse-reports/` under the same artifact
root.

The final source passes type checking, changed-code ESLint/Prettier, the bundle budget and
**19 component/budget tests in two files**. All **three real-API smoke tests pass together**
against the final `mailcowui-ng:u006-release` Docker image after resetting only the isolated
`u006-smoke` fixtures. They cover message bytes/delivery, saved notification/score/policy/rate
settings, rejected invalid templates and statistics. Logs are `release-{type,lint,format,budget,
unit,image,smoke}.log`.

The final production-bundle regression passes **259 browser checks**, with two viewport-specific
skips, across mobile Chromium, desktop Chromium and mobile WebKit. It covers quarantine list,
disclosures, bulk actions, loading and host integration; spam policy, rate limits and password
sign-in; and the domain, alias, DKIM and monitoring dashboard screens that use the repackaged
shared controls. Both-theme axe, reflow, touch targets and CSP remain enforced. No failures or
retries occurred. See `release-browser.log`; this run follows the earlier integration coverage
rather than replacing it. Deployment is recorded in the following release note.

**2026-10-20, deployed to maildev**: UI main was fast-forwarded and pushed through `3de1d64a`.
The standard deployment script built its clean Git archive and installed
`mailcowui-ng:3de1d64a` at **https://maildev.feldhost.cz/ng/**. Only `ng-mailcow` was recreated;
API `mailcow-rest-v2:b3dc2ab` remains running and healthy. Compose validation, container health,
HTTP 200 and the production CSP check pass. Previous UI image `mailcowui-ng:5e3c1e89` remains on
the host for rollback.

Live public administrator sign-in checks pass on mobile Chromium, desktop Chromium and mobile
WebKit: fields visible, submit enabled, no horizontal overflow or JavaScript errors, the CSP
recorder clean, and API readiness HTTP 200. No credentials were submitted. The probe uses the
repository's existing CSP recorder (including its documented WebKit native-control exception)
and matches the `username` autocomplete token, allowing conditional passkey autofill's
`username webauthn`. The earlier standalone probe failures are retained separately; they did not
require an application change. Logs: `deploy-maildev.log`, `deploy-maildev-browser.log` and
`deploy-maildev-health.log` under the same artifact root.

This deployment includes the implemented quarantine, spam policy, notification and rate-limit
flows described above. The original checklist's remaining acceptance cases, physical devices,
assistive-technology and live authenticated parity checks remain open. The separate UI 005
account/self-service worktree is still unfinished and is not part of this release.

**2026-10-20, busy-item and recipient follow-up (T062, focused T047 coverage)**: delayed
confirmations, action responses and busy-item reads previously retained the old page's callbacks
after navigation. They could submit an action after the user left its confirmation, navigate back
to the list from another item, or clear a newer failure. Item actions now belong to their current
route and operation. Leaving cancels the pending recheck, and obsolete results cannot change the
current page. Already-sent mutations still update the shared cache. The current action also
finishes correctly when its successful mutation removes the cached item.

The ten lifecycle regressions first produced nine failures and one pass, then all passed with the
fix. All **122 quarantine unit tests** pass. The missing `busy-and-recipient.spec.ts` passes
**30 browser cases** across mobile Chromium, desktop Chromium and mobile WebKit. It verifies one
five-second recheck for both available and gone outcomes, no automatic resubmission, navigation
during pending work, administrator and domain-administrator recipient links, and plain text for
mailbox users, resources and deleted mailboxes. Recipient navigation uses the existing mailbox
host section at `#spam-filter`.

The existing action, item and host-integration specs pass **51 further browser cases** against the
same frozen production build, for **81 passing cases** with no retries. Both-theme axe, 360/320 px
reflow, CSP and mock-contract checks are enforced. The initial run was stopped to correct two
test fixtures: a fully paused page clock prevented action dispatch, and the navigation helper
selected an item outside the first list page. No product change was needed for those failures.

Full type checking, scoped ESLint/Prettier, the production build and bundle budgets pass; initial
JavaScript is **193,361 / 204,800 bytes gzipped**. Logs and retained failed-run traces are under
`storage/app/restart-2026-10-20/u006/busy-recipient/` in the API checkout, including
`u006-busy-red.log`, `u006-busy-units.log`, `u006-busy-browser-focused.log` and
`u006-busy-browser-regression.log`. This completes T062 and adds lifecycle coverage under T047;
the remaining UI 006 acceptance and manual checks stay open. This follow-up has not been deployed.

**2026-10-20, scope and filter follow-up (T060)**: the domain administrator's domain filter was
using the server-searched picker. It now offers the domains already present in
`identity.scope.domains`, including an empty scope, without a domain-list request, as research
R12 specifies. Administrators keep the searched picker. No API contract or translation change
was needed.

Three component regressions first failed; all **27 focused unit tests** now pass. The new browser
spec verifies a two-of-five-domain scope, empty scope, administrator domain search, exact recipient
matching, all ten sort fields, and the action/virus/score/page state across reloads and a shared
address. It also verifies that mailbox users have no recipient/domain controls and do not send
those filters from a supplied URL. Together with the existing list regression, **41 browser
cases pass** on mobile Chromium, desktop Chromium and mobile WebKit, with one expected desktop
skip for a mobile-only disclosure case. Six affected cases were rerun after expanding the scope
fixture to five domains; all passed. Both-theme axe, 360/320 px reflow, CSP and mock-contract
checks remain enforced, with no retries in these runs.

Full type checking, scoped ESLint/Prettier, production build and bundle budgets pass. Initial
JavaScript is **195,785 / 204,800 bytes gzipped**. Evidence is retained under
`storage/app/restart-2026-10-20/u006/scope-filters/` in the API checkout, including
`u006-scope-red.log`, `u006-scope-units.log`, `u006-scope-browser.log` and
`u006-scope-browser-five-domains.log`. T060 is complete; this follow-up has not been deployed.
