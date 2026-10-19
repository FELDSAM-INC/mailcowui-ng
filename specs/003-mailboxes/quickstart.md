# Quickstart and Validation Guide: UI Feature 003

**Feature**: `specs/003-mailboxes` | **Plan**: [plan.md](./plan.md) |
**Contract**: [contracts/README.md](./contracts/README.md)

This guide proves the mailbox screens work. It builds on UI 001's guide
(`specs/001-sign-in-app-shell/quickstart.md`) for the setup, gates and development servers, which
are not repeated.

- **Part A**: the contract bump and the automated gates.
- **Part B**: manual checks per user story against the mock API.
- **Part C**: the smoke suite against a real mailcow-rest-v2 dev stack.
- **Part D**: a mailcow host.

## Prerequisites

- UI 001 and UI 002 are implemented, and their gates pass.
- A checkout of `mailcow-rest-v2` at `../mailcow-rest-v2` (or `$MAILCOW_REST_V2_DIR`) that contains
  the API 003 implementation, for Parts A (bump) and C.
- For the legacy form map and the bundled `en-gb` snapshot: `$MAILCOW_REPO` (default
  `../mailhosting`) with the upstream tag `2026-09a`. Legacy texts themselves load at runtime from
  the installation's `/lang/` (constitution IV 1.3.0).

## Part A: Contract bump and automated gates

```bash
# 1. Pin the contract with API 003 (research R1). Pins only move forward: skip if
#    contract/VERSION.json already pins a newer commit with every operation of the contracts README.
#    Before the API 003 implementation is merged, <ref> is the baseline 3207925….
scripts/contract/bump.sh <api-003-tag-or-merge-commit>
git -C ../mailcow-rest-v2 diff 32079252d55797d3da4e58ae661e9fb91c51c6f9..<ref> -- api/   # review
npm run contract:check

# 2. Translations: new strings complete in en-gb, cs-cz and sk-sk, legacy keys present in the
#    bundled en-gb snapshot, and the scoped open enumerations (research R2, constitution IV 1.3.0).
npm run i18n:check

# 3. The usual gates (UI 001 Part A).
npm run lint && npm run typecheck && npm run test:unit
npm run build && npm run budget:check
npm run test:e2e -- tests/e2e/mailboxes
npm run lhci
```

**Expected**:

- `contract:check` passes, and `contract/VERSION.json` names the API 003 commit or tag.
- `i18n:check` passes. Its warnings list contract enumeration values outside the app's scope. None
  of them belongs to API 001–003.
- `test:unit` includes these tests, all passing:
  - `password/generate.spec.ts`, which reports 10,000 passwords per policy configuration, all
    meeting their policy (SC-008);
  - the table-driven `acl.spec.ts` over every flag combination (SC-010);
  - `problems.spec.ts` covering every problem type and rule code of API 003 (SC-005).
- `budget:check` keeps the initial JavaScript below 204,800 bytes gzipped, and lists the chunks of
  `MailboxesPage`, `MailboxCreatePage`, `MailboxDetailPage` and the template pages separately.
- `test:e2e -- tests/e2e/mailboxes` passes every `US1-AS…` to `US9-AS…` test of this feature on `mobile-chromium`,
  `desktop-chromium` and `mobile-webkit`, with no axe, CSP or mock contract violation.
- `lhci` prints performance and accessibility of at least 0.9 for `/ng/sign-in`, `/ng/` and
  `/ng/mailboxes` (the 10,000-mailbox scenario).

## Part B: Manual checks per user story (mock API)

Start `npm run preview:mock` and open `http://localhost:4173/ng/`. Select a scenario with
`npm run mock:scenario -- <name>`. The names are defined in `tests/mocks/scenarios/mailboxes/`.
Check each screen at 360 px and on a desktop, in both themes.

| Story | Scenario | Steps | Expected (spec reference) |
|---|---|---|---|
| US1 | `admin-mailboxes-30` | Open Mailboxes. Search "anna". Filter by a domain and "inactive". Sort by "in use" descending. Page to 2. Reload. Add the "Last password change" column. | Cards at 360 px and a table on desktop. Total shown. Chips per filter and "Clear all". Unlimited mailboxes last. The address keeps every choice. The column persists after a reload, and the page size stays in the address (US1-AS1–AS7) |
| US1 | `admin-mailboxes-10k` | Search a fragment of an address on 360 px and open the mailbox | Within 10 s; the first page is visible within 2 s (SC-001, SC-003) |
| US1 | `domain-admin-mailboxes` | Open `/ng/mailboxes/x@b.example`, a foreign domain | "Not found" with a link to the list (US1-AS8) |
| US1 | `mailbox-user-active` | Open `/ng/mailboxes` | No navigation entry; "no access" (US1-AS11) |
| US2 | `admin-create` | Add mailbox: type ` Anna.Smith `, choose `example.org`, keep Default, generate a password, enter 8 GiB, then 1 GiB, and create | Preview `anna.smith@example.org`; "max. 5 GiB"; an error at 8 GiB before submitting; the detail opens with the announcement and "Add another" (US2-AS1, AS2) |
| US2 | `domain-admin-no-flags` | Add mailbox | No "Unlimited"; protocols read-only with "Prohibited by ACL"; the sync-jobs permission absent, with the note (US2-AS5, AS6) |
| US2 | `admin-create-limits` | Choose the full domain, then the domain without quota left | "No mailboxes left"; the API refusal states count and limit; "Only unlimited mailboxes can be created" (US2-AS8, AS9) |
| US3 | `admin-edit` | General: set "Inactive" and save. Then, in a second tab, change the quota and save a display name in the first tab | The effect is explained before saving. The outdated save keeps the input and marks the quota, and a second save works (US3-AS2, AS3) |
| US3 | `admin-edit-ldap` | Open Sign-in and password of the LDAP mailbox | No password or recovery fields; forced change unavailable with the reason; switching to the built-in source shows the password with its hint (US3-AS6) |
| US4 | `admin-delete` | Remove the 2 GiB, 10,000-message mailbox from the list. Then the one whose mail store fails | Preview numbers, retention and alias counts, with focus on Cancel; removal announced; "not deleted" for the failing one (US4-AS1–AS3) |
| US5 | `admin-permissions` | Turn on "Sync jobs" and save; add "sales" to a "Sales" mailbox; add `department=Sales`, remove `old` | Only that flag is sent; no duplicate tag; the attribute diff (US5-AS1, AS3, AS5) |
| US6 | `admin-bulk` | Select 50 on a page of 50 and deactivate; bulk-delete 3 with one mail-store failure, typing 3 | All 50 done; 2 removed and 1 failed, kept selected with the translated reason; an outdated mailbox stays selected too (US6-AS1, AS5) |
| US7 | `admin-templates` | Create "Students" unchanged; open Default; delete "Staff" | Created with the defaults shown; Default name read-only with no delete; the confirmation says mailboxes do not change (US7-AS2, AS4, AS6) |
| US8 | `admin-rename` | Rename `anna@example.org` to `anna.smith`, keeping the alias; then the scenario's "incomplete" mailbox | The new detail opens with the announcement; the persistent report lists the steps (US8-AS1, AS5) |
| US9 | `admin-history` | Open a mailbox › History | The audit log filtered to the mailbox, newest first, with "Password set" without a value and the refused record as "failure" with its reason (US9-AS1, AS2) |

## Part C: Smoke suite against a real mailcow-rest-v2 dev stack

```bash
export MAILCOW_REST_V2_DIR=../mailcow-rest-v2
scripts/smoke/stack-up.sh          # API dev stack at the pinned commit, plus this image as ng-mailcow
npm run test:smoke -- --grep mailbox
scripts/smoke/stack-down.sh
```

The API's development seeder provides `admin`, `reseller` (domain administrator of `example.org`
and `example.net`, without `protocol_access`), the Default mailbox template, the template "Small",
and the domain `example.org` (10 mailboxes, 5 GiB). The smoke tests create their own mailboxes
with random local parts (`smoke.<random>`) and delete them, and never change `alice` or `bob`.

**Expected**: the smoke specs pass (the stories' smoke tasks share the files below):

- `mailboxes.smoke.spec.ts`: list, search and detail for `admin`; `reseller`'s scope at 360 px; one
  mailbox added through the form with a generated password, renamed keeping its alias, changed and
  found in its History (the rename is in the previous address's history, where API 003 records
  it), deactivated in bulk and removed with the real deletion preview (T053, T064, T082, T098,
  T114, T121);
- `mailbox-sections.smoke.spec.ts`: the Mailbox section's full name, quota, status, generated
  password and protocol saves, and the domain administrator's read-only protocols (T073);
- `mailbox-permissions.smoke.spec.ts`: permission, tag and attribute saves (T089);
- `mailbox-templates.smoke.spec.ts`: create, edit and delete a template, with Default protected
  (T105).

Also check that no password generated in the add form or the Mailbox section appears in the
stack's logs: `docker compose -p <project> logs` (app, web, MariaDB, Redis), the image's
`docker logs` and the API's `storage/logs/`.

## Part D: On a mailcow host

After UI 001's Part D, open `https://<MAILCOW_HOSTNAME>/ng/mailboxes` as an administrator.

**Expected**:

- Mailboxes created in the classic interface appear, with the same quota usage.
- A display name changed in the classic interface while the app's section is open makes the app's
  save refused as outdated.
- The app's password generator produces passwords that the classic interface's sign-in accepts.

## Validation log

Filled in by T130: SC-001 to SC-003 timings on a mid-range Android phone and an iPhone, and a
VoiceOver and TalkBack pass of every user story.

### Results (2026-10-19)

- **Smoke suite (T073, T089, T131)**: the API at the pinned `33f1eea` as its own Compose project
  (`SMOKE_PROJECT=ui003-smoke`, `SMOKE_WEB_PORT=18680`, the image tagged `mailcowui-ng:smoke-u003`)
  so that other stacks on the machine were not touched, then `npm run test:smoke` in the
  Playwright image. The first run of `--grep mailbox` found three test faults, fixed in the tests:
  - the tag input of the Mailbox section is a combobox (it suggests the tags in use);
  - a section's success message stays in that section, so the next save waits in its own section;
  - API 003 records a rename under the previous address, so the History of the new address does
    not list it; the test now saves a change after the rename and opens both histories. The mock
    recorded the rename under the new address and now follows the API, and the record's
    `keepOldAddressAsAlias` is labelled with legacy's "Create alias automatically";
  - the navigation smoke test still expected Mailboxes as a placeholder for `reseller`; DNS is the
    placeholder now, as in the end-to-end test.

  Then the 13 mailbox tests and the whole smoke suite (40 of 40) passed. After the rebase onto
  main `681bfdb`, with the image rebuilt, 41 passed and 4 were skipped (UI 012's identity provider
  tests, which need the API's `idp` profile).
- **Generated passwords (Part C)**: a password generated in the add form and one generated in the
  Mailbox section of the same mailbox were saved through the app, then searched for in
  `docker compose -p ui003-smoke logs` (app, web, MariaDB, Redis), the image's `docker logs` and the
  API's `storage/logs/`: 0 matches for both, while the same logs list the requests.
- **Bundle (T127)**, `npm run build && npm run budget:check`: the initial JavaScript is 175,078
  bytes gzipped after the rebase onto main `681bfdb` and 177,138 after the one onto `f0c9011`. The
  modules the entry imports statically are one chunk (`vite.config.ts`, group `shell` with
  rolldown's `$initial` tag, which replaces UI 012's group of seven listed modules; UI 004 landed
  the same group on main `f0c9011`), so the sign-in page requests 12 scripts instead of 17 on main
  `681bfdb` (23 on main `79948fc`).
- **Lighthouse (T127)**, `npm run lhci` with the host's Playwright Chromium on a machine shared with
  other agents (load average 12 to 20 on 16 cores), this branch and then main `681bfdb`:

  | URL | Scripts (limit 204,800) | Performance | Accessibility | main: scripts, performance |
  |---|---|---|---|---|
  | `/ng/sign-in` | 195,370 bytes, 12 requests | 0.89, 0.90, 0.90 | 1.00 | 201,759 bytes, 17 requests; 0.88, 0.88, 0.89 |
  | `/ng/` | 182,078 bytes | 0.80, 0.83, 0.86 | 1.00 | 0.74, 0.84, 0.84 |
  | `/ng/domains` | 215,490 bytes (lazy route) | 0.69, 0.74, 0.79 | 0.99 | 0.71, 0.74, 0.77 |
  | `/ng/mailboxes` (10,000 mailboxes) | 224,912 bytes (lazy route) | 0.78, 0.81, 0.82 | 0.99 | not on main |

  The performance scores below 0.9 come from Total Blocking Time (300 to 660 ms) and an LCP of about
  3 s under this load, on main as on this branch; before the rebase, at a load average of 30 to 35,
  they were lower still. They need a run on a quiet machine or in CI.
- **End-to-end** (`npm run test:e2e`, three projects, two workers, in the pinned Playwright image):
  - before the final rebase (on main `79948fc`): 1707 passed, 23 skipped, none failed;
  - after the rebase onto main `681bfdb`: 2101 passed, 29 skipped and 2 failed under a load average
    of about 50 (UI 012's reduced-motion check of the OAuth2 client form found the page not yet
    rendered after 5 s, and UI 001's session-ended test met the expired session before it opened
    the navigation); both passed when run again, three times each;
  - after the rebase onto main `c2c7fe8`: 2116 passed, 29 skipped and 2 failed (UI 002's template
    list error test, where Chromium reported `net::ERR_NETWORK_CHANGED` while other agents' Docker
    networks changed, so a route's chunk did not load, and a WebKit `page.goto` of UI 012 that took
    over 60 s); both passed when run again, three times each;
  - after the rebase onto main `f0c9011` (UI 004 merged), in the shared two-slot limit: 2755
    passed, 29 skipped and 8 failed. Three were UI 003's History link locator, which also matched
    UI 004's new "History: Allow to send as" link on the mailbox page. Five were UI 004's reflow
    checks of the Mailbox section, which found the section by a heading that also matches UI 003's
    "⚠️ Rename mailbox". Both locators are exact now, and the two files then passed on the three
    projects (183 tests).
  - after the rebase onto main `d716050` (UI 010 merged), whose conflicts were in tests, UI 002's
    domain page and the Lighthouse script only, the narrow set in the shared two-slot limit, on
    its own Docker network: the mailbox, navigation, shell, History, audit log and sender settings
    specs, the domain page and its DNS entry points, and the sync jobs entry points. 969 passed, 12
    skipped and 3 failed: the navigation test's placeholder for a domain administrator was DNS,
    which UI 010 delivers. It is Quarantine now (also in the smoke test), and the navigation specs
    then passed on the three projects (77 tests).
- **Unit tests** (`npm run test:unit`): after the rebase onto main `f0c9011`, 235 files and 2230
  tests pass, but line coverage is 75.44 % against the global 80 % threshold, so the command fails;
  main `f0c9011` alone measures 73.97 % (UI 004's alias domains, resources and aliases are at 8 to
  40 % line coverage). After the rebase onto main `d716050`: 287 files and 2603 tests pass, line
  coverage 77.59 %; the global threshold is the only one that fails. After the rebase onto main
  `9bf0d6b`, which adds UI 004's unit tests: 298 files and 2772 tests pass with 88.7 % line
  coverage, and the command exits 0. UI 003's `src/features/mailboxes` is at 88.0 % of lines and the
  audit log it extends at 96.2 %.
- **Devices (T130)**: not run. No mid-range Android phone or iPhone was available to the
  implementing agent, so SC-001 to SC-003 on a phone and the VoiceOver and TalkBack passes are
  still open. The automated stand-ins are the end-to-end suite on the two mobile projects (360 px
  Chromium with touch, WebKit) with axe in both themes.
