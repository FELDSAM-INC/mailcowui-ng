# Quickstart and Validation Guide: UI Feature 002

**Feature**: `specs/002-domains` | **Plan**: [plan.md](./plan.md) |
**Contract**: [contracts/README.md](./contracts/README.md)

This guide proves that the domain screens work. It builds on
[UI 001's quickstart](../001-sign-in-app-shell/quickstart.md) (setup, gates, development servers,
smoke harness) and does not repeat it. Part A covers the pin and the automated gates, Part B
manual checks per user story against the mock API, Part C the smoke suite against a real
mailcow-rest-v2 dev stack, and Part D a mailcow host.

## Prerequisites

- UI feature 001 implemented, with its quickstart Part A green.
- mailcow-rest-v2 feature 002 implemented, with its quickstart Part A green, and its commit or
  release tag known (research D1).
- For Parts C and D: as in UI 001 (Docker with Compose v2, `../mailcow-rest-v2`).

## Part A: Pin and automated gates

```bash
scripts/contract/bump.sh <api-002-tag-or-commit>          # research D1, contracts/README.md
git diff contract/VERSION.json                            # the new pin

npm run lint && npm run typecheck && npm run contract:check
npm run i18n:check          # en-gb, cs-cz, sk-sk complete; coverage manifest consistent with the contract
npm run test:unit           # includes tests/unit/features/domains and the extended shared primitives
npm run build && npm run budget:check
npm run test:e2e            # mobile-chromium, desktop-chromium, mobile-webkit
npm run lhci                # now also /ng/domains
```

**Expected**:

- Every command exits with 0.
- `i18n:check` prints the contract values that are not yet in `src/i18n/coverage.json` as
  warnings, and no error.
- `budget:check` reports the initial JavaScript unchanged, under 204,800 bytes gzipped, and lists
  the lazy chunks of the seven domain and template routes.
- `test:e2e` reports every `US<n>-AS<m>` test of this feature passing on both viewports, with no
  axe, CSP or mock contract violation.
- `lhci` prints scores of at least 0.9 for `/ng/sign-in`, `/ng/` and `/ng/domains`.

## Part B: Manual checks per user story (mock API)

Start `npm run preview:mock`, open `http://localhost:4173/ng/`, and pick a scenario with
`npm run mock:scenario -- <name>`. The scenarios are defined in
`tests/mocks/scenarios/domains-*.ts` and `tests/mocks/scenarios/domain-templates.ts`. Check each
screen at 360 px and on a desktop, in both themes.

| Story | Scenario | Steps | Expected (spec reference) |
|---|---|---|---|
| US1 | `domains-60` | Open Domains; search "customer"; tap a tag on a card; sort by storage descending; go to page 2; open a domain; press Back; reload | 25 of 60 sorted by name; cards at 360 px and a table on desktop; IDN shown as `münchen.de` above `xn--mnchen-3ya.de`; nearly-full markers in text; the same view after Back and reload, with no loading state on Back (US1-AS1 to AS5, AS8) |
| US1 | `domain-admin-two-of-ten` | Sign in as the reseller; open Domains; open `/ng/domains/other.example` | Exactly 2 domains; no create, delete, bulk or domain administrator list; the third domain shows the same "not found" as an unknown one (US1-AS6) |
| US2 | `domain-create` | Create `example.org` with only the name via "Review"; then create from "Reseller" with 20 mailboxes; then reuse an existing name | Report with every step done or not requested; the review shows 20 mailboxes and 50 GiB; "domain already exists" on the name in step 1 with input kept (US2-AS1 to AS3) |
| US2 | `creation-report-mixed`, `groupware-disabled`, `templates-none` | Create a domain in each | Restart failed as a warning and DKIM "already existed" as information, announced; no Global Address List flag or restart switch when the groupware is disabled; built-in values and no template named (US2-AS5, edge cases) |
| US3 | `domain-edit` | Edit limits below usage; save a domain quota the API refuses; switch on "relay non-existing mailboxes only"; change the Global Address List flag; then run `PATCH /__mock/scenarios/:id` with a `domains` mutation and save again | Errors before sending; the translated in-use message; relay options follow with an explanation; the restart notice; the outdated save keeps the input and marks the changed fields (US3-AS1 to AS3, AS6, AS7) |
| US3 | `domain-admin-no-desc`, `domain-admin-desc` | Open a domain as each | Only Tags and Groupware editable, plus General with the flag; removing the flag mid-edit shows the reason and makes the description read-only (US3-AS4, AS8) |
| US4 | `domain-delete` | Delete a domain with aliases; look at a domain with mailboxes; delete one that gained a mailbox (mock mutation) | Preview impact; Delete enabled only after typing the name; unavailable with counts; remaining counts after refusal; back to the list with an announcement (US4-AS1 to AS4) |
| US5 | `bulk-mixed` | Select 10 domains at 360 px; deactivate with two injected failures; retry; bulk-delete a selection that includes a domain with mailboxes | Selection bar with the count; progress; per-domain results; the retry sends only the 2; the domain with mailboxes listed as skipped; the count typed to confirm (US5-AS1 to AS4) |
| US6 | `templates` | Create "Small" with 5 mailboxes; name another one "small"; open Default; delete a template | Listed with the offered values; duplicate-name error; Default name read-only with no delete; confirmation says domains keep their values (US6-AS1 to AS4) |
| US7 | `footer` | Open the footer editor of a domain without a footer; save HTML, plain text and one exclusion as a domain administrator; save an exclusion from another domain; paste a 1.1 MiB text; enter `<script>` in the HTML | Empty editor; saved and announced; the refused entry marked; saving blocked with the limit; the script shown as text only (US7-AS1 to AS4) |
| US8 | `audit-domain-records` | Open a domain's History; open a template's History; filter the audit log by target type; open an API key's History | Filtered records with actor, time, client address, outcome and translated refusal reason; the target filters as chips; no History for a domain administrator (US8-AS2, AS3; US8-AS1 partially, API gap G1) |

## Part C: Smoke suite against a real mailcow-rest-v2 dev stack

```bash
export MAILCOW_REST_V2_DIR=../mailcow-rest-v2
scripts/smoke/stack-up.sh      # API dev stack at contract/VERSION.json's commit + this image
npm run test:smoke -- --grep "@domains|@domain-templates"
scripts/smoke/stack-down.sh
```

**Expected**: the seven smoke specs `tests/smoke/domains-*.smoke.spec.ts` and
`tests/smoke/domain-templates.smoke.spec.ts` pass (research D29):

- creation of a smoke domain with its report;
- section edits and the footer;
- bulk deactivation and activation;
- the blocked deletion of `example.org`;
- the typed-name deletion of the smoke domain;
- the domain administrator's two domains and editable Global Address List flag;
- template create, edit and delete, with Default protected.

No smoke domain or template is left behind.

## Part D: On a mailcow host

1. Deploy as in UI 001 quickstart Part D, with mailcow-rest-v2 at a version that implements
   feature 002.
2. Open `https://<MAILCOW_HOSTNAME>/ng/domains` as an administrator and compare ten domains of
   different shapes with the classic Mail setup › Domains rows and Edit domain pages (SC-002).
3. Create a domain in the app, then open it in the classic interface. Edit it in the classic
   interface, then save a section in the app and see the outdated notice.
4. Repeat the SC-001 timing (creation in under 1 minute on a phone) and the SC-011 moderated
   test, and record them in a "Validation log" section appended to this file.
