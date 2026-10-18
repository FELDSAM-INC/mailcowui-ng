# Quickstart and Validation Guide: UI Feature 010

**Feature**: `specs/010-dkim-mta-sts-dns` | **Plan**: [plan.md](./plan.md) |
**Contract**: [contracts/README.md](./contracts/README.md)

This guide proves the feature works:
- Part A covers the automated gates.
- Part B gives manual checks per user story against the mock API.
- Part C covers the smoke suite against the mailcow-rest-v2 dev stack.
- Part D lists the device and parity checks.

The setup, commands and fixtures are UI 001's
([UI 001 quickstart](../../001-sign-in-app-shell/quickstart.md)). This guide refers to the spec,
the research and the data model instead of repeating them.

## Prerequisites

- UI features 001–009 are merged, as the plan's "Dependencies and order" table lists. T001 has
  confirmed the building blocks and entry points.
- The contract pin contains API 010 (commit `3207925` or later; see `contract/VERSION.json`).
- For Part C: a mailcow-rest-v2 checkout with feature 010 implemented, at `../mailcow-rest-v2` or
  `$MAILCOW_REST_V2_DIR`.

## Part A: Automated gates

```bash
npm ci
npm run lint && npm run typecheck && npm run contract:check && npm run i18n:check
npm run test:unit -- tests/unit/features/dns tests/unit/shared
npm run build && npm run budget:check
npm run test:e2e -- tests/e2e/dns
npm run lhci                                  # includes the /ng/dns/dkim-keys collection
```

**Expected**:

- Every command exits with 0.
- `i18n:check` reports no missing key for the 010 enumerations: `DkimKeyState`,
  `DkimDnsPublicationReasonCode`, `DnsCheckMessageCode`, `MtaStsMode` and the others in research
  R22.
- `test:e2e` reports every `US1-AS*` to `US8-AS*` test passing on `mobile-chromium`,
  `desktop-chromium` and `mobile-webkit`, with no axe, CSP or mock contract violation.
- `budget:check` keeps the initial JS under 204,800 bytes, and the `dns` chunks are lazy.
- Lighthouse scores at least 0.9 for performance and accessibility on `/ng/dns/dkim-keys`.

## Part B: Manual checks per user story (mock API)

Start `npm run preview:mock`, open `http://localhost:4173/ng/`, and pick a scenario with
`npm run mock:scenario -- <name>` (the names are defined in `tests/mocks/scenarios/dns.ts`). Check
each row at 360 px and on a desktop, in both themes.

| Story | Scenario | Steps | Expected (spec reference) |
|---|---|---|---|
| US1 | `dns-admin` | Open ARC/DKIM keys; filter "Key missing"; search "bücher"; sort by key length; open `example.org`; switch to the split form; press each copy button | 6 + N entries with state badges; the filter count is announced; the record name, host label and value are copied exactly; the split form is quoted pieces (US1 AS-1 to AS-5) |
| US1 | `dns-domain-admin` | Open the list; open `/ng/dns/dkim-keys/other.example` | Only own domains and their alias domains; no "Key unused" filter; not-found page (AS-6) |
| US1 | `dns-admin` | Open the domain page of `example.org` (UI 002) | The DKIM section with the record and copy buttons; the link "DKIM keys of this domain and its alias domains" (FR-021, FR-012) |
| US2 | `dns-admin` | Filter "Key missing", select 3, Generate with the default selector; then "Generate keys for all names without a key" | The selector is pre-filled, sizes come from capabilities; progress; results per name; "Retry failed" (US2 AS-1 to AS-3) |
| US2 | `dns-admin-fork` | Generate for `example.net` with publication failing | "Key created, signing works, record not published", with "Publish again" (AS-7) |
| US3 | `dns-diagnostics-all-statuses` | Check DNS for `example.org`; toggle "Only attention"; download and copy the zone file; go back and reopen within 10 minutes | Every status label; summary counts; DMARC "Not set (optional)" not counted; zone file identical; no new run on reopening (US3 AS-1 to AS-5, AS-9, AS-10) |
| US3 | `dns-diagnostics-rate-limited` | Press "Run again" until refused | The previous result stays; "Available again in …"; "N checks left" shown at 3 or fewer (AS-7, FR-091) |
| US4 | `dns-mta-sts` | On `example.net`'s domain page, set up a policy; change only the mode; deactivate | The defaults (testing, 1 week, server host name, inactive); records with copy buttons; the identifier-changed notice and the highlighted `_mta-sts` record; the deactivation confirmation (US4 AS-1 to AS-3, AS-7) |
| US4 | `dns-mta-sts` | Open the alias domain page of `example.com` (UI 004) | It names `example.org`'s policy, with a link and no editing (AS-6) |
| US5 | `dns-admin` | Import a pasted key for `example.net`; import over `example.org` without overwrite; copy `example.org` to 3 targets; delete 5 selected keys | Import results; the conflict on the name field; overwrite confirmations; the bulk dialog asks to type 5 (US5 AS-1 to AS-7) |
| US5 | `dns-admin` | "Replace with a new key" on `example.org` | The confirmation names the old selector and says mail stays signed; the entry shows the new key (FR-090) |
| US6 | `dns-admin-fork` | Export the private key of `example.org`; close without copying | The confirmation; the key with Copy and Download (`dkim.example.org.pem`); closing asks first; reopening needs a new export (US6 AS-1, AS-2) |
| US7 | `dns-admin-fork` | "Publish DNS record again" with each outcome | Translated outcomes; the failed reason translated and the detail as plain text (US7 AS-1 to AS-4) |
| US8 | `dns-audit-records` | Open History from `example.org`'s entry and from its MTA-STS section | The audit log filtered to the target; labels for every DKIM and MTA-STS event (US8 AS-1, AS-2) |

## Part C: Smoke suite against the mailcow-rest-v2 dev stack

```bash
export MAILCOW_REST_V2_DIR=../mailcow-rest-v2
scripts/smoke/stack-up.sh
npm run test:smoke -- --grep @dns
scripts/smoke/stack-down.sh
```

**Expected**: `tests/smoke/dns-*.smoke.spec.ts` pass against the seeded data (research R25):
- the read-only cases;
- generation and deletion on `example.net`;
- import and deletion on `import.example`;
- copy and bulk deletion;
- replacement on `example.org`;
- the identifier notice on `example.net`'s policy;
- `reseller`'s limited scope.

`docker compose -f $MAILCOW_REST_V2_DIR/compose.yaml logs app | grep -c 'BEGIN PRIVATE KEY'`
prints `0`. The API never logs keys; the check guards against the UI ever sending a key anywhere
other than the import.

## Part D: Devices, assistive technology and parity

1. **Timings** on a mid-range Android phone and an iPhone, with `npm run preview:mock` on the
   local network:
   - SC-001: generate a key and copy its record in under 1 minute;
   - SC-013: the first list page within 2 s.
2. **Screen readers**: VoiceOver on iOS and TalkBack on Android for US1, US2, US3 and US4.
   Announced:
   - the result counts;
   - run progress at 10 % steps;
   - the start and end of a diagnostics run with its summary;
   - copy outcomes;
   - the rate-limit countdown, once.
3. **Parity (SC-002)**: for `example.org`, `example.com`, `bücher.example` and `old.example`, every
   value that the classic interface's ARC/DKIM keys tab, Edit domain page and DNS modal show is
   present in the app, allowing for the spec's stated improvements.
4. **SC-014** (moderated test with at least 5 domain administrators) is scheduled by the owner
   after release. It is recorded here when done.

Results go in a "Validation log" section appended to this file (T112).
