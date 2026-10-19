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
- `lhci` reports at least 0.9 for performance and accessibility on `/ng/quarantine`.

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
