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
- For the reused translations: `$MAILCOW_REPO` (default `../mailhosting`) with the upstream tag
  `2026-09a`.

## Part A: Contract bump and automated gates

```bash
# 1. Pin the contract with API 003 (research R1). Skip if contract/VERSION.json already has it.
scripts/contract/bump.sh <api-003-tag-or-merge-commit>
git -C ../mailcow-rest-v2 diff 32079252d55797d3da4e58ae661e9fb91c51c6f9..<ref> -- api/   # review
npm run contract:check

# 2. Translations: legacy layer and completeness, with the scoped open enumerations (research R2).
MAILCOW_REPO=../mailhosting node scripts/i18n/import-legacy.mjs --ref 2026-09a
npm run i18n:check

# 3. The usual gates (UI 001 Part A).
npm run lint && npm run typecheck && npm run test:unit
npm run build && npm run budget:check
npm run test:e2e -- --grep "mailbox|Mailbox|US[1-9]-AS"
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
- `test:e2e` passes every `US1-AS…` to `US9-AS…` test of this feature on `mobile-chromium`,
  `desktop-chromium` and `mobile-webkit`, with no axe, CSP or mock contract violation.
- `lhci` prints performance and accessibility of at least 0.9 for `/ng/sign-in`, `/ng/` and
  `/ng/mailboxes` (the 10,000-mailbox scenario).

## Part B: Manual checks per user story (mock API)

Start `npm run preview:mock` and open `http://localhost:4173/ng/`. Select a scenario with
`npm run mock:scenario -- <name>`. The names are defined in `tests/mocks/scenarios/mailboxes.ts`.
Check each screen at 360 px and on a desktop, in both themes.

| Story | Scenario | Steps | Expected (spec reference) |
|---|---|---|---|
| US1 | `admin-mailboxes-10k` | Open Mailboxes. Search "anna". Filter by a domain and "inactive". Sort by "in use" descending. Page to 3. Reload. Add the "Last password change" column. | Cards at 360 px and a table on desktop. Total shown. Chips per filter and "Clear all". Unlimited mailboxes last. The address keeps every choice. The column persists after a reload, and the page size stays in the address (US1-AS1–AS7) |
| US1 | `domain-admin-mailboxes` | Open `/ng/mailboxes/x@b.example`, a foreign domain | "Not found" with a link to the list (US1-AS8) |
| US1 | `mailbox-user` | Open `/ng/mailboxes` | No navigation entry; "no access" (US1-AS11) |
| US2 | `admin-create` | Add mailbox: type ` Anna.Smith `, choose `example.org`, keep Default, generate a password, enter 8 GiB, then 1 GiB, and create | Preview `anna.smith@example.org`; "max. 5 GiB"; an error at 8 GiB before submitting; the detail opens with the announcement and "Add another" (US2-AS1, AS2) |
| US2 | `domain-admin-no-flags` | Add mailbox | No "Unlimited"; protocols read-only with "Prohibited by ACL"; the sync-jobs permission absent, with the note (US2-AS5, AS6) |
| US2 | `admin-create-limits` | Choose the full domain, then the domain without quota left | "No mailboxes left"; the API refusal states count and limit; "Only unlimited mailboxes can be created" (US2-AS8, AS9) |
| US3 | `admin-edit` | General: set "Inactive" and save. Then, in a second tab, change the quota and save a display name in the first tab | The effect is explained before saving. The outdated save keeps the input and marks the quota, and a second save works (US3-AS2, AS3) |
| US3 | `admin-edit-ldap` | Open Sign-in and password of the LDAP mailbox | No password or recovery fields; forced change unavailable with the reason; switching to the built-in source shows the password with its hint (US3-AS6) |
| US4 | `admin-delete` | Remove the 2 GiB, 10,000-message mailbox from the list. Then the one whose mail store fails | Preview numbers, retention and alias counts, with focus on Cancel; removal announced; "not deleted" for the failing one (US4-AS1–AS3) |
| US5 | `admin-permissions` | Turn on "Sync jobs" and save; add "sales" to a "Sales" mailbox; add `department=Sales`, remove `old` | Only that flag is sent; no duplicate tag; the attribute diff (US5-AS1, AS3, AS5) |
| US6 | `admin-bulk` | Select 50 on a page of 50 and deactivate; bulk-delete 3 with one mail-store failure, typing 3 | All 50 done; 2 removed and 1 failed, kept selected with the translated reason (US6-AS1, AS5) |
| US7 | `admin-templates` | Create "Students" unchanged; open Default; delete "Staff" | Created with the defaults shown; Default name read-only with no delete; the confirmation says mailboxes do not change (US7-AS2, AS4, AS6) |
| US8 | `admin-rename` | Rename `anna@example.org` to `anna.smith`, keeping the alias; then the scenario's "incomplete" mailbox | The new detail opens with the announcement; the persistent report lists the steps (US8-AS1, AS5) |
| US9 | `admin-history` | Open a mailbox › History | The audit log filtered to the mailbox, newest first, with "Password set" without a value (US9-AS1) |

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
with random local parts (`smoke-<random>`) and delete them, and never change `alice` or `bob`.

**Expected**: the smoke specs pass:

- `mailboxes.smoke.spec.ts`: list, create with a generated password, detail, delete with a preview;
  one case at 360 px;
- `mailbox-sections.smoke.spec.ts`: general, sign-in, protocols, permissions, tags and attributes
  saves, and the domain administrator's read-only protocols;
- `mailbox-bulk.smoke.spec.ts`: deactivate and activate two mailboxes;
- `mailbox-templates.smoke.spec.ts`: create, edit and delete a template, with Default protected;
- `mailbox-rename.smoke.spec.ts`: rename with the alias kept; the History link shows the rename.

Also check that `docker compose -f $MAILCOW_REST_V2_DIR/compose.yaml logs app | grep -c <generated
password>` prints `0`.

## Part D: On a mailcow host

After UI 001's Part D, open `https://<MAILCOW_HOSTNAME>/ng/mailboxes` as an administrator.

**Expected**:

- Mailboxes created in the classic interface appear, with the same quota usage.
- A display name changed in the classic interface while the app's section is open makes the app's
  save refused as outdated.
- The app's password generator produces passwords that the classic interface's sign-in accepts.

## Validation log

Filled in by T163: SC-001 to SC-003 timings on a mid-range Android phone and an iPhone, and a
VoiceOver and TalkBack pass of every user story.
