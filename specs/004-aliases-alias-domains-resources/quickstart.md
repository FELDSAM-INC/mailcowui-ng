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

## Validation log

### Parity coverage (T112, SC-008), 2026-10-19

Every Matched or Improved row of the spec's "Legacy parity" tables, with an end-to-end test whose
title carries one of the row's FR IDs (the same specs run on desktop-chromium, mobile-chromium and
mobile-webkit). Rows whose behaviour the orchestrator's decisions of 2026-10-18 changed (plan,
legacy form map part 3) are covered by the test of the decided behaviour.

| Section | Legacy element | Status | Covered by |
|---|---|---|---|
| Mail setup › Aliases tab | "Aliases" entry in the "Aliases" tab dropdown of the mailbox page | Improved | `aliases/detail-and-access.spec.ts`: US1-AS10 FR-001 mailbox users have no entries and get "no access" without a feature 004 request |
| Mail setup › Aliases tab | Collapsed card on phones, table with row expansion | Improved | `aliases/list.spec.ts`: US1-AS2 US1-AS3 US1-AS4 FR-012 FR-017 the hint, the primary domain, special actions, "+10 more" and the badges |
| Mail setup › Aliases tab | Count badge in the card header | Matched | `aliases/list.spec.ts`: US1-AS1 FR-005 the 25 newest of 60 as cards at 360 px, the total and the next page |
| Mail setup › Aliases tab | Refresh button | Matched | `aliases/list.spec.ts`: US1-AS8 FR-008 FR-009 an unreachable API gives the error with retry, and refresh reloads |
| Mail setup › Aliases tab | Column ID | Matched | `aliases/detail-and-access.spec.ts`: FR-016 US1-AS2 US1-AS3 US1-AS4 every value, the primary domain and all 12 destinations |
| Mail setup › Aliases tab | Column alias address with "Catch-All" badge | Matched | `aliases/list.spec.ts`: US1-AS2 US1-AS3 US1-AS4 FR-012 FR-017 the hint, the primary domain, special actions, "+10 more" and the badges |
| Mail setup › Aliases tab | Column goto, with a trash icon for discard and coloured badges for spam and ham | Improved | `aliases/list.spec.ts`: US1-AS2 US1-AS3 US1-AS4 FR-012 FR-017 the hint, the primary domain, special actions, "+10 more" and the badges |
| Mail setup › Aliases tab | Column domain with an info-icon tooltip naming the target domain | Improved | `aliases/list.spec.ts`: US1-AS2 US1-AS3 US1-AS4 FR-012 FR-017 the hint, the primary domain, special actions, "+10 more" and the badges |
| Mail setup › Aliases tab | Columns SOGo visible, internal, active | Matched | `aliases/list.spec.ts`: US1-AS2 US1-AS3 US1-AS4 FR-012 FR-017 the hint, the primary domain, special actions, "+10 more" and the badges |
| Mail setup › Aliases tab | Columns public comment, private comment | Matched | `aliases/detail-and-access.spec.ts`: FR-016 US1-AS2 US1-AS3 US1-AS4 every value, the primary domain and all 12 destinations |
| Mail setup › Aliases tab | Row actions edit, remove | Matched | `aliases/delete.spec.ts`: US3-AS5 FR-029 FR-030 the confirmation names the address and the consequences, and the alias leaves the list |
| Mail setup › Aliases tab | Client-side search over all loaded aliases | Improved | `aliases/list.spec.ts`: US1-AS5 FR-010 "INVOICE" finds exactly the three, the count is announced, and the search survives opening an alias |
| Mail setup › Aliases tab | Domain filter dropdown | Improved | `aliases/list.spec.ts`: US1-AS6 FR-013 the delivers-to filter shows the three aliases of anna as a removable chip |
| Mail setup › Aliases tab | Sorting by any column, default ID descending | Matched | `aliases/list.spec.ts`: FR-007 FR-014 the table sorts from its headers with aria-sort, and cards from the sort control |
| Mail setup › Aliases tab | Page length, paging, state saved in the browser | Matched | `aliases/list.spec.ts`: US1-AS1 FR-005 the 25 newest of 60 as cards at 360 px, the total and the next page |
| Mail setup › Aliases tab | "Toggle all" | Matched | `aliases/bulk.spec.ts`: US6-AS5 FR-056 at 360 px: 44 px checkboxes, the bar stays, and list changes clear the selection |
| Mail setup › Aliases tab | Quick actions activate, deactivate, remove, show and hide in SOGo (the SOGo ones hidden when the groupware is disabled) | Matched | `aliases/bulk.spec.ts`: US6-AS1 FR-058 FR-059 deactivating all asks once, sends each version, and lists 30 results |
| Mail setup › Aliases tab | "Expand alias over alias domains" | Improved | `aliases/bulk.spec.ts`: FR-057 show and hide are absent without the groupware |
| Mail setup › Aliases tab | "Add alias" button | Matched | `aliases/create.spec.ts`: US2-AS1 FR-018 FR-021 FR-067 one address opens the new alias, with the legacy defaults and help text |
| Mail setup › Aliases tab | Hint `alias_domain_alias_hint` | Matched | `aliases/list.spec.ts`: US1-AS2 US1-AS3 US1-AS4 FR-012 FR-017 the hint, the primary domain, special actions, "+10 more" and the badges |
| Mail setup › Aliases tab | Mass actions hidden above the table on phones | Improved | `aliases/bulk.spec.ts`: US6-AS5 FR-056 at 360 px: 44 px checkboxes, the bar stays, and list changes clear the selection |
| Add alias dialog | Alias address/es text area, comma-separated, `@domain` for catch-all | Matched | `aliases/create.spec.ts`: US2-AS1 FR-018 FR-021 FR-067 one address opens the new alias, with the legacy defaults and help text |
| Add alias dialog | Help text naming the product ("mailcow domains only", fork: "FeldHost™ Mailhosting domains only") | Matched | `aliases/create.spec.ts`: US2-AS1 FR-018 FR-021 FR-067 one address opens the new alias, with the legacy defaults and help text |
| Add alias dialog | Goto addresses text area | Matched | `aliases/create.spec.ts`: US2-AS1 FR-018 FR-021 FR-067 one address opens the new alias, with the legacy defaults and help text |
| Add alias dialog | Mutually exclusive checkboxes "Silently discard", "Learn as spam", "Learn as ham" that disable the goto field | Improved | `aliases/create.spec.ts`: US2-AS1 FR-018 FR-021 FR-067 one address opens the new alias, with the legacy defaults and help text |
| Add alias dialog | "Alias is visible in SOGo" (checked; hidden when the groupware is disabled) | Matched | `aliases/create.spec.ts`: US2-AS1 FR-018 FR-021 FR-067 one address opens the new alias, with the legacy defaults and help text |
| Add alias dialog | "Internal" (unchecked), "Allow to send as this alias" (checked), "Active" (checked) | Matched | `aliases/create.spec.ts`: US2-AS1 FR-018 FR-021 FR-067 one address opens the new alias, with the legacy defaults and help text |
| Add alias dialog | Comments only on the edit page | Improved | `aliases/create.spec.ts`: US2-AS1 FR-018 FR-021 FR-067 one address opens the new alias, with the legacy defaults and help text |
| Add alias dialog | Invalid destinations and addresses skipped with a message each, the rest saved | Improved | `aliases/create.spec.ts`: US2-AS1 FR-018 FR-021 FR-067 one address opens the new alias, with the legacy defaults and help text |
| Edit alias page | Address, goto, special action checkboxes | Matched | `aliases/edit.spec.ts`: US3-AS1 FR-022 FR-026 a new destination is saved alone, with the version read |
| Edit alias page | SOGo visible, internal, sending allowed, active | Matched | `aliases/edit.spec.ts`: US3-AS1 FR-022 FR-026 a new destination is saved alone, with the version read |
| Edit alias page | Private and public comment, at most 160 characters | Matched | `aliases/create.spec.ts`: US2-AS6 FR-019 an invalid destination is named at its entry and nothing is created |
| Edit alias page | Save | Improved | `aliases/delete.spec.ts`: FR-027 a deletion refused as outdated confirms again with the reloaded alias |
| Edit alias page | No delete on the edit page | Improved | `aliases/detail-and-access.spec.ts`: FR-016 US1-AS2 US1-AS3 US1-AS4 every value, the primary domain and all 12 destinations |
| Mail setup › Domain aliases tab | "Domain aliases" entry in the "Aliases" tab dropdown | Improved | `aliases/detail-and-access.spec.ts`: US1-AS10 FR-001 mailbox users have no entries and get "no access" without a feature 004 request |
| Mail setup › Domain aliases tab | Columns alias domain, target domain (link to edit domain), active | Matched | `alias-domains/list-detail.spec.ts`: FR-033 US4-AS9 the list shows the name, the linked target, active and the relay badge |
| Mail setup › Domain aliases tab | Badge "Alias domain inactive for relay domain" | Matched | `alias-domains/list-detail.spec.ts`: FR-033 US4-AS9 the list shows the name, the linked target, active and the relay badge |
| Mail setup › Domain aliases tab | — | Improved | `alias-domains/list-detail.spec.ts`: FR-033 US4-AS9 the list shows the name, the linked target, active and the relay badge |
| Mail setup › Domain aliases tab | Row actions edit, remove | Matched | `alias-domains/edit-delete.spec.ts`: US4-AS8 FR-029 the deletion names the aliases and what goes with them, and keeps DKIM |
| Mail setup › Domain aliases tab | Client-side search, sorting, paging | Improved | `alias-domains/list-detail.spec.ts`: FR-034 search, the target and active filters and the sort live in the address |
| Mail setup › Domain aliases tab | Toggle all, quick actions activate, deactivate, remove | Matched | `aliases/bulk.spec.ts`: US6-AS1 FR-058 FR-059 deactivating all asks once, sends each version, and lists 30 results |
| Mail setup › Domain aliases tab | "Add domain alias" button gated by `alias_domains` | Matched | `shell/feature-004-permissions-matrix.spec.ts`: SC-007 FR-002 the controls of … |
| Add domain alias dialog | Alias domain text area, several names | Matched | `alias-domains/create.spec.ts`: US4-AS1 FR-036 FR-038 one name sends the form as shown and opens the new alias domain with legacy's alerts |
| Add domain alias dialog | Target domain select | Improved | `alias-domains/create.spec.ts`: US4-AS1 FR-036 FR-038 one name sends the form as shown and opens the new alias domain with legacy's alerts |
| Add domain alias dialog | Active (checked) | Matched | `alias-domains/create.spec.ts`: US4-AS1 FR-036 FR-038 one name sends the form as shown and opens the new alias domain with legacy's alerts |
| Add domain alias dialog | Rate limit value and frame | Matched | `alias-domains/create.spec.ts`: US4-AS1 FR-036 FR-038 one name sends the form as shown and opens the new alias domain with legacy's alerts |
| Add domain alias dialog | DKIM selector (pre-filled `dkim`, fork `feldhost`) and key size (2048) | Improved | `alias-domains/create.spec.ts`: US4-AS1 FR-036 FR-038 one name sends the form as shown and opens the new alias domain with legacy's alerts |
| Add domain alias dialog | One success or error message per step | Improved | `alias-domains/create.spec.ts`: US4-AS1 FR-036 FR-038 one name sends the form as shown and opens the new alias domain with legacy's alerts |
| Edit alias domain page | Target domain select, active, save | Matched | `aliases/edit.spec.ts`: US3-AS1 FR-022 FR-026 a new destination is saved alone, with the version read |
| Mail setup › Resources tab | Columns description, alias (address), kind, domain, active | Matched | `resources/list-detail.spec.ts`: FR-042 US7-AS5 the list shows the classic columns with the booking badges and the legend |
| Mail setup › Resources tab | Column multiple bookings as coloured badges with legend | Matched | `resources/list-detail.spec.ts`: FR-042 US7-AS5 the list shows the classic columns with the booking badges and the legend |
| Mail setup › Resources tab | Row actions edit, remove | Matched | `resources/list-detail.spec.ts`: FR-015 the menu has Edit, which opens the section, and Remove |
| Mail setup › Resources tab | Domain filter, client-side search, sorting, paging | Improved | `resources/list-detail.spec.ts`: FR-043 search, the domain, kind and active filters and the sort live in the address |
| Mail setup › Resources tab | Toggle all, quick actions activate, deactivate, remove | Matched | `resources/bulk.spec.ts`: FR-057 FR-058 deactivate asks once; activate runs at once |
| Mail setup › Resources tab | "Add resource" button | Matched | `resources/create.spec.ts`: FR-044 the description is checked against the server's limit |
| Add resource dialog and edit resource page | Description, domain select, active (checked) | Matched | `resources/create.spec.ts`: FR-044 the description is checked against the server's limit |
| Add resource dialog and edit resource page | Kind select with untranslated "Location", "Group", "Thing" | Improved | `resources/create.spec.ts`: FR-044 the description is checked against the server's limit |
| Add resource dialog and edit resource page | Multiple bookings select (default "Unlimited, but show as busy") with custom number | Matched | `resources/create.spec.ts`: FR-044 the description is checked against the server's limit |
| Add resource dialog and edit resource page | Address derived silently from the description | Improved | `resources/create.spec.ts`: US7-AS1 FR-045 the previewed address, then the server's address after saving |
| Add resource dialog and edit resource page | Edit description, kind, multiple bookings, active | Matched | `resources/list-detail.spec.ts`: FR-046 FR-048 the page shows the address and domain read-only, and no "Send as" |
| Edit mailbox page: "Allow to send as" and "External sender addresses" | Fields inside the long Edit mailbox form | Improved | `sender-settings/send-as.spec.ts`: FR-048 FR-049 FR-053 US5-AS1 the values in the Mailbox section, the multi-select in the form and its hint |
| Edit mailbox page: "Allow to send as" and "External sender addresses" | One multi-select mixing domains ("Disable sender check for domain %s (+ alias domains)"), `*`, addresses and aliases with "Alias (allowed)" / "Alias (blocked)" | Improved | `sender-settings/send-as.spec.ts`: FR-048 FR-049 FR-053 US5-AS1 the values in the Mailbox section, the multi-select in the form and its hint |
| Edit mailbox page: "Allow to send as" and "External sender addresses" | Blocked aliases selectable to allow sending | Matched | `sender-settings/send-as.spec.ts`: FR-048 FR-049 FR-053 US5-AS1 the values in the Mailbox section, the multi-select in the form and its hint |
| Edit mailbox page: "Allow to send as" and "External sender addresses" | Administrator-set entries shown disabled for domain administrators | Matched | `sender-settings/send-as.spec.ts`: FR-048 FR-049 FR-053 US5-AS1 the values in the Mailbox section, the multi-select in the form and its hint |
| Edit mailbox page: "Allow to send as" and "External sender addresses" | `*` option ("any address") | Improved | `sender-settings/send-as-save.spec.ts`: US5-AS3 FR-051 "*" shows that the sender check is disabled and is saved alone |
| Edit mailbox page: "Allow to send as" and "External sender addresses" | Badge "Sender check is disabled" | Matched | `sender-settings/send-as-save.spec.ts`: US5-AS3 FR-051 "*" shows that the sender check is disabled and is saved alone |
| Edit mailbox page: "Allow to send as" and "External sender addresses" | Hint `sender_acl_info` about groupware delegation | Matched | `sender-settings/send-as.spec.ts`: FR-048 FR-049 FR-053 US5-AS1 the values in the Mailbox section, the multi-select in the form and its hint |
| Edit mailbox page: "Allow to send as" and "External sender addresses" | External sender addresses text field, shown only with `extend_sender_acl` | Improved | `shell/feature-004-permissions-matrix.spec.ts`: SC-007 FR-051 FR-052 "*" for administrators only; external sender addresses only with extendSenderAcl |
| Edit mailbox page: "Allow to send as" and "External sender addresses" | Hint `extended_sender_acl_info` | Matched | `shell/feature-004-permissions-matrix.spec.ts`: SC-007 FR-051 FR-052 "*" for administrators only; external sender addresses only with extendSenderAcl |
| Edit mailbox page: "Allow to send as" and "External sender addresses" | — | Improved | `sender-settings/send-as.spec.ts`: FR-048 FR-049 FR-053 US5-AS1 the values in the Mailbox section, the multi-select in the form and its hint |
| Edit mailbox page: "Allow to send as" and "External sender addresses" | Saved with the whole mailbox form, invalid entries skipped, last write wins | Improved | `sender-settings/send-as-save.spec.ts`: US5-AS2 FR-054 allowing a blocked alias sends the whole set with If-Match and lists it |

Result: 71 of 71 rows covered.


### New cs-cz and sk-sk strings for review (T116, plan owner question 2)

UI 004 adds 55 new strings in each language; 20 more are UI 002 strings moved to the
shared `lists.*` and `forms.rateLimit.*` keys with their texts unchanged. `npm run i18n:check`
reports no unused key, and no new string repeats a legacy key of the form map with the same
meaning (the near matches it lists have another meaning, for example `lists.filters.title` against
legacy's "Filters" tab).

| Key | en-gb | cs-cz | sk-sk |
|---|---|---|---|
| `enums.aliasKind.regular` | Regular | Běžný | Bežný |
| `enums.auditEventType.aliasCreation` | Alias added | Alias přidán | Alias pridaný |
| `enums.auditEventType.aliasDeletion` | Alias removed | Alias odebrán | Alias odstránený |
| `enums.auditEventType.aliasDomainCreation` | Alias domain added | Doménový alias přidán | Alias doména pridaná |
| `enums.auditEventType.aliasDomainDeletion` | Alias domain removed | Doménový alias odebrán | Alias doména odstránená |
| `enums.auditEventType.aliasDomainUpdate` | Alias domain changed | Doménový alias změněn | Alias doména zmenená |
| `enums.auditEventType.aliasUpdate` | Alias changed | Alias změněn | Alias zmenený |
| `enums.auditEventType.mailboxSenderSettingsUpdate` | Sender permissions changed | Oprávnění odesílatele změněna | Oprávnenia odosielateľa zmenené |
| `enums.auditEventType.resourceCreation` | Resource added | Zdroj přidán | Zdroj pridaný |
| `enums.auditEventType.resourceDeletion` | Resource removed | Zdroj odebrán | Zdroj odstránený |
| `enums.auditEventType.resourceUpdate` | Resource changed | Zdroj změněn | Zdroj zmenený |
| `enums.resourceKind.group` | Group | Skupina | Skupina |
| `enums.resourceKind.location` | Location | Místo | Miesto |
| `enums.resourceKind.thing` | Thing | Věc | Vec |
| `lists.backToList` | Back to the list | Zpět na seznam | Späť na zoznam |
| `pickers.loadMore` | Load more | Načíst další | Načítať ďalšie |
| `pickers.remove` | Remove {name} | Odebrat {name} | Odobrať {name} |
| `senderSettings.externalPlaceholder` | user1@example.com, user2@example.org, @example.com, ... | user1@example.com, user2@example.org, @example.com, ... | user1@example.com, user2@example.org, @example.com, ... |
| `senderSettings.notNeeded` | {address} was not added: an alias that delivers to this mailbox already allows sending as it. | {address} nebylo přidáno: alias, který doručuje do této schránky, už odesílání jako tato adresa povoluje. | {address} nebolo pridané: alias, ktorý doručuje do tejto schránky, už odosielanie ako táto adresa povoľuje. |
| `senderSettings.subtext.admin` | Admin | Správce | Správca |
| `senderSettings.subtext.alias` | Alias | Alias | Alias |
| `senderSettings.subtext.aliasAllowed` | Alias (allowed) | Alias (povolen) | Alias (povolený) |
| `senderSettings.subtext.aliasBlocked` | Alias (blocked) | Alias (blokován) | Alias (blokovaný) |
| `senderSettings.subtext.stale` | No longer exists | Už neexistuje | Už neexistuje |
| `aliases.capabilities.failed` | The server settings this form needs could not be loaded. | Nastavení serveru, která tento formulář potřebuje, se nepodařilo načíst. | Nastavenia servera, ktoré tento formulár potrebuje, sa nepodarilo načítať. |
| `aliases.capabilities.loading` | Loading the server settings… | Načítání nastavení serveru… | Načítavajú sa nastavenia servera… |
| `aliases.create.progress` | Adding {current} of {total}… | Přidávání {current} z {total}… | Pridáva sa {current} z {total}… |
| `aliases.filters.destinationType` | Destination | Cíl | Cieľ |
| `aliases.form.externalNotice` | Only addresses of domains hosted on this server can be added as goto addresses. | Jako cílové adresy lze přidat jen adresy domén hostovaných na tomto serveru. | Ako cieľové adresy možno pridať len adresy domén hostovaných na tomto serveri. |
| `aliases.list.moreDestinations` | +{count} more | +{count} další | +{count} ďalšie |
| `aliases.orphaned.badge` | Orphaned | Osiřelý | Osirelý |
| `aliases.orphaned.warning` | The domain of this alias no longer exists. The alias can be removed from the list. A change is saved only together with an address in an existing domain. | Doména tohoto aliasu už neexistuje. Alias lze odebrat ze seznamu. Změnu lze uložit jen spolu s adresou v existující doméně. | Doména tohto aliasu už neexistuje. Alias možno odstrániť zo zoznamu. Zmenu možno uložiť len spolu s adresou v existujúcej doméne. |
| `aliases.gone` | This alias no longer exists or is no longer available to you. | Tento alias již neexistuje nebo pro vás již není dostupný. | Tento alias už neexistuje alebo už pre vás nie je dostupný. |
| `aliases.delete.impact` | Mail to this address is no longer accepted, and the permissions of other mailboxes to send as this address are removed. | Pošta na tuto adresu se přestane přijímat a odeberou se oprávnění jiných schránek odesílat jako tato adresa. | Pošta na túto adresu sa prestane prijímať a odstránia sa oprávnenia iných schránok odosielať ako táto adresa. |
| `aliases.delete.impactCatchAll` | This is a catch-all alias: the permissions to send as any address of {domain} are removed with it. | Jde o alias catch-all: spolu s ním se odeberou oprávnění odesílat jako libovolná adresa domény {domain}. | Ide o alias catch-all: spolu s ním sa odstránia oprávnenia odosielať ako ľubovoľná adresa domény {domain}. |
| `aliases.changed` | The alias changed in the meantime. Check it and confirm again. | Alias se mezitím změnil. Zkontrolujte jej a potvrďte znovu. | Alias sa medzitým zmenil. Skontrolujte ho a potvrďte znova. |
| `aliases.bulk.confirm.deactivate` | Selected aliases: {count}. While they are inactive, they no longer accept mail. | Vybrané aliasy: {count}. Dokud jsou neaktivní, nepřijímají poštu. | Vybrané aliasy: {count}. Kým sú neaktívne, neprijímajú poštu. |
| `aliases.bulk.confirm.hide` | Selected aliases: {count}. While they are hidden, SOGo does not offer them as sender addresses. | Vybrané aliasy: {count}. Dokud jsou skryté, SOGo je nenabízí jako adresy odesílatele. | Vybrané aliasy: {count}. Kým sú skryté, SOGo ich neponúka ako adresy odosielateľa. |
| `aliases.bulk.deleteImpact` | Mail to these addresses is no longer accepted, and the permissions of other mailboxes to send as them are removed. | Pošta na tyto adresy se přestane přijímat a odeberou se oprávnění jiných schránek odesílat jako tyto adresy. | Pošta na tieto adresy sa prestane prijímať a odstránia sa oprávnenia iných schránok odosielať ako tieto adresy. |
| `aliases.copy.explain` | A copy of the alias is created in every alias domain of its domain, unless the address is already in use there. | V každém doménovém aliasu domény aliasu se vytvoří kopie aliasu, pokud tam adresa už není použita. | V každej alias doméne domény aliasu sa vytvorí kópia aliasu, ak tam adresa ešte nie je použitá. |
| `aliases.copy.none` | This domain has no alias domains, so nothing was created. | Tato doména nemá žádné doménové aliasy, proto nebylo nic vytvořeno. | Táto doména nemá žiadne alias domény, preto sa nič nevytvorilo. |
| `aliasDomains.gone` | This alias domain no longer exists or is no longer available to you. | Tento doménový alias již neexistuje nebo pro vás již není dostupný. | Táto alias doména už neexistuje alebo už pre vás nie je dostupná. |
| `aliasDomains.outcome.groupwareFailed` | The groupware directory could not be updated for {0}. It is updated again with the next change; if this persists, ask the server administrator. | Adresář groupwaru se pro {0} nepodařilo aktualizovat. Aktualizuje se znovu při příští změně; pokud potíže přetrvávají, obraťte se na správce serveru. | Adresár groupwaru sa pre {0} nepodarilo aktualizovať. Aktualizuje sa znova pri ďalšej zmene; ak problémy pretrvávajú, obráťte sa na správcu servera. |
| `aliasDomains.delete.impact` | Deleted with it: its aliases ({count}) and their send-as permissions, its temporary aliases, its BCC maps and its spam allow and block lists. Its DKIM key is kept. | Spolu s ním se odstraní: jeho aliasy ({count}) a jejich oprávnění odesílat jako ně, jeho dočasné aliasy, mapy BCC a seznamy povolených a blokovaných odesílatelů spamového filtru. Klíč DKIM zůstane zachován. | Spolu s ňou sa odstránia: jej aliasy ({count}) a ich oprávnenia odosielať ako ony, jej dočasné aliasy, mapy BCC a zoznamy povolených a blokovaných odosielateľov spamového filtra. Kľúč DKIM zostane zachovaný. |
| `aliasDomains.delete.changed` | The alias domain changed in the meantime. Check it and confirm again. | Doménový alias se mezitím změnil. Zkontrolujte jej a potvrďte znovu. | Alias doména sa medzitým zmenila. Skontrolujte ju a potvrďte znova. |
| `aliasDomains.bulk.confirm.deactivate` | Selected alias domains: {count}. While they are inactive, their addresses no longer accept mail. | Vybrané doménové aliasy: {count}. Dokud jsou neaktivní, jejich adresy nepřijímají poštu. | Vybrané alias domény: {count}. Kým sú neaktívne, ich adresy neprijímajú poštu. |
| `aliasDomains.bulk.deleteImpact` | Deleted with them: their aliases ({count}) and their send-as permissions, their temporary aliases, BCC maps and spam allow and block lists. Their DKIM keys are kept. | Spolu s nimi se odstraní: jejich aliasy ({count}) a jejich oprávnění odesílat jako ně, jejich dočasné aliasy, mapy BCC a seznamy povolených a blokovaných odesílatelů spamového filtru. Jejich klíče DKIM zůstanou zachovány. | Spolu s nimi sa odstránia: ich aliasy ({count}) a ich oprávnenia odosielať ako ony, ich dočasné aliasy, mapy BCC a zoznamy povolených a blokovaných odosielateľov spamového filtra. Ich kľúče DKIM zostanú zachované. |
| `resources.gone` | This resource no longer exists or is no longer available to you. | Tento zdroj již neexistuje nebo pro vás již není dostupný. | Tento zdroj už neexistuje alebo už pre vás nie je dostupný. |
| `resources.changed` | The resource changed in the meantime. Check it and confirm again. | Zdroj se mezitím změnil. Zkontrolujte jej a potvrďte znovu. | Zdroj sa medzitým zmenil. Skontrolujte ho a potvrďte znova. |
| `resources.delete.impact` | Its calendar, its bookings and its sharing settings in the groupware are deleted. | Odstraní se jeho kalendář, rezervace a nastavení sdílení v groupwaru. | Odstráni sa jeho kalendár, rezervácie a nastavenia zdieľania v groupwari. |
| `resources.bulk.confirm.deactivate` | Selected resources: {count}. While they are inactive, they cannot be booked. | Vybrané zdroje: {count}. Dokud jsou neaktivní, nelze je rezervovat. | Vybrané zdroje: {count}. Kým sú neaktívne, nemožno ich rezervovať. |
| `resources.bulk.deleteImpact` | Their calendars, bookings and sharing settings in the groupware are deleted. | Odstraní se jejich kalendáře, rezervace a nastavení sdílení v groupwaru. | Odstránia sa ich kalendáre, rezervácie a nastavenia zdieľania v groupwari. |
| `resources.form.preview` | Address (preview): {address} | Adresa (náhled): {address} | Adresa (náhľad): {address} |
| `resources.form.noAddress` | No address can be derived: the description needs between 1 and 64 letters A–Z or digits. | Adresu nelze odvodit: popis musí obsahovat 1 až 64 písmen A–Z nebo číslic. | Adresu nemožno odvodiť: popis musí obsahovať 1 až 64 písmen A–Z alebo číslic. |
| `resources.form.addressKept` | The address does not change when the description changes. | Adresa se při změně popisu nemění. | Adresa sa pri zmene popisu nemení. |
