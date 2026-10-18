# Quickstart and Validation Guide: UI Feature 004

**Feature**: `specs/004-aliases-alias-domains-resources` | **Plan**: [plan.md](./plan.md) |
**Contract**: [contracts/README.md](./contracts/README.md)

This guide proves the feature works. It relies on UI 001's setup and gates
([UI 001 quickstart](../001-sign-in-app-shell/quickstart.md)) and does not repeat them:

- Part A lists what changes in the automated gates.
- Part B gives manual checks per user story against the mock API.
- Part C covers the smoke suite against a real mailcow-rest-v2 dev stack.
- Part D covers a mailcow host.

## Prerequisites

- UI 001, UI 002 and UI 003 are implemented. The dependency test
  `tests/unit/dependencies/feature-004-dependencies.spec.ts` passes (research R2).
- mailcow-rest-v2 feature 004 is implemented. `contract/VERSION.json` pins the commit or tag that
  ships it, and its feature 004 contract files match the planning baseline `3207925` or were
  reviewed (research R1).
- Legacy texts come at runtime from the installation's `/lang/lang.<code>.json`, with UI 001's
  bundled `en-gb` snapshot as the fallback (constitution IV 1.3.0).

## Part A: Automated gates

The commands are UI 001's (Part A there). What this feature adds:

```bash
npm run contract:check   # pin = API 004 implementation commit or tag (R1)
npm run i18n:check       # new strings in en-gb, cs-cz, sk-sk; used legacy keys in the en-gb snapshot;
                         #   004 values in the scope manifest; closed enums
npm run test:unit        # + dependencies, mock handlers, entry lists, sequential creation, drafts,
                         #   patch builders, address preview, send-as model, permission matrix
npm run build && npm run budget:check   # initial JS still ≤ 200 KB gzipped; 10 new lazy chunks
npm run test:e2e         # + tests/e2e/{aliases,alias-domains,resources,sender-settings,history}
npm run lhci             # + /ng/aliases (scenario aliases-60): performance and accessibility ≥ 0.9
```

**Expected**:

- Every command exits with 0.
- `test:e2e` reports every `US<n>-AS<m>` of this feature passing on `mobile-chromium` and
  `desktop-chromium`, and every test not tagged `@virtual-authenticator` passing on `mobile-webkit`.
  There is no axe, CSP or mock contract violation.
- `budget:check` lists the chunks of `AliasesPage`, `AliasCreatePage`, `AliasDetailPage`,
  `AliasDomainsPage`, `AliasDomainCreatePage`, `AliasDomainDetailPage`, `ResourcesPage`,
  `ResourceCreatePage`, `ResourceDetailPage` and `SendAsPage`. The initial size is unchanged within
  a few hundred bytes (three catalogue rows).

### Legacy texts

Constitution IV 1.3.0 replaced the build-time import (research R20). This feature has no
`legacy-map.json` entries: it uses legacy keys verbatim through UI 001's legacy translation layer,
texts with markup render through `SanitizedHtml.vue`, and a key missing in a language falls back to
`en-gb`. Check a screen in English, Czech, Slovak and one other mailcow language (for example
de-de), and compare its labels, help texts, options and messages with the classic interface's form
named in the plan's legacy form map.

## Part B: Manual checks per user story (mock API)

Start `npm run preview:mock` and open `http://localhost:4173/ng/`. Pick a scenario with
`npm run mock:scenario -- <name>`. Check every screen at 360 px and on a desktop, in both themes.
Scenario names are defined in `tests/mocks/scenarios/`.

| Story | Scenario | Steps | Expected (spec reference) |
|---|---|---|---|
| US1 | `aliases-60` (admin) | Open Aliases; page; search "INVOICE"; filter by delivers-to `anna@example.org`; open an alias and go back | Cards with badges and "+10 more"; the total is 60; the result count is announced; the chip is removable; the search survives Back (US1-AS1–AS6) |
| US1 | `aliases-da-two-of-ten` | Sign in as the domain administrator; open an alias address of a third domain directly | Only aliases of the two domains and their alias domains; "not found" for the third (US1-AS9) |
| US2 | `aliases-create` (admin) | Add `info@, sales@, office@example.org` delivering to two mailboxes, where `sales@` is in use | Two created with links, `sales@` refused with "used by an alias", only `sales@example.org` left in the field (US2-AS8) |
| US2 | `aliases-create-da-no-external` | As the domain administrator, add an external destination | Advance notice; after saving, the message names the destination and "Allow aliases with external goto domains" (US2-AS7) |
| US3 | `aliases-edit` | Edit the destination of `sales@`; meanwhile change it in the mock (`curl -X PATCH localhost:4010/__mock/scenarios/<id> -d '{"changeElsewhere":"sales@example.org"}'`); save | "Changed elsewhere" with the new value marked, your input kept, nothing overwritten (US3-AS2) |
| US4 | `alias-domains` (domain admin with `aliasDomains`) | Add `example.net` for `example.org` with DKIM on | The report lists four steps; with the `dkim-failed` variant, the DKIM step is a warning naming DKIM keys (US4-AS1, AS2) |
| US4 | `alias-domains-feldhost` (admin) | Open "Add domain alias" | "Generate a DKIM key" is on, with selector `feldhost` and 2048 bits; switching it off and saving reports "no DKIM key requested" (US4-AS10) |
| US5 | `sender-settings` (admin) | Open Mailboxes › anna › Send as; allow sending as `info@`; save; turn on "any address" | Sections as in US5-AS1; `info@` moves to explicit; the warning, then "Sender check is disabled" (US5-AS1–AS3) |
| US5 | `sender-settings-da` | As the domain administrator, open the same screen | `@other.example` marked not changeable; external addresses read-only with the permission note; no "any address" (US5-AS4–AS6) |
| US6 | `bulk-004` | Select all 30 aliases; deactivate; then copy `sales@example.org` over its alias domains | Confirmation with the count; 30 done; copy results show `sales@example.com` created and `example.net` skipped (US6-AS1, AS4) |
| US7 | `resources` | Add "Meeting Room 1" in `example.org` with a hard limit | Preview `MeetingRoom1@example.org`; the number field accepts only whole numbers ≥ 1; the badge says "Hard limit (2)" (US7-AS1, AS4, AS5) |
| US8 | `history-004` (admin) | Open History on an alias, an alias domain, a resource and a "Send as" screen | The audit log, filtered to that object, with translated labels (US8-AS1) |

**Device and usability validation** (SC-001, SC-002, SC-009, SC-010, SC-011): on a mid-range
Android phone and an iPhone, with the production build served by `npm run preview:mock` on the local
network, use DevTools "Fast 4G" throttling for SC-009. Record:

- the timings of finding an alias, creating an alias with two destinations, creating an alias domain,
  the first alias page, and the 100-alias bulk results;
- whether testers identify catch-all aliases, special actions and receive-only aliases from the
  list;
- a VoiceOver and TalkBack pass over every story.

The results go in a "Validation log" section appended to this file.

## Part C: Smoke suite against a real mailcow-rest-v2 dev stack

```bash
export MAILCOW_REST_V2_DIR=../mailcow-rest-v2
scripts/smoke/stack-up.sh
npm run test:smoke -- --grep "@feature-004"
scripts/smoke/stack-down.sh
```

**Expected**: the smoke specs pass for:

- `aliases-list.smoke.spec.ts`: `admin` filters by domain, `reseller` sees only its domains, and
  there is no horizontal scroll at 360 px;
- `aliases-create.smoke.spec.ts`, `aliases-edit.smoke.spec.ts` and `aliases-bulk.smoke.spec.ts`:
  create (one and several addresses), edit a destination, delete, and bulk deactivate, activate and
  delete;
- `alias-domains.smoke.spec.ts`: create with DKIM off and see the report, deactivate, delete;
- `resources.smoke.spec.ts`: create with the previewed address, change the booking rule, delete;
- `sender-settings.smoke.spec.ts`: grant an alias address to a seeded mailbox and revoke it.

Each spec creates uniquely named objects in a domain it finds in the account's scope, and deletes
them afterwards.

## Part D: On a mailcow host

After UI 001's Part D, open `https://<MAILCOW_HOSTNAME>/ng/aliases` as an administrator.

**Expected**:

- Aliases created in the classic interface appear at once, with the same destinations.
- An alias edited in the classic interface while its section is open here causes "changed
  elsewhere" on save.
- An alias domain created here appears in the classic interface's Domain aliases tab.
