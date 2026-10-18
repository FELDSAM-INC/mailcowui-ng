# Quickstart and Validation Guide: UI Feature 009

**Feature**: `specs/009-routing-address-rewriting` | **Plan**: [plan.md](./plan.md) |
**Contract**: [contracts/README.md](./contracts/README.md)

This guide proves the feature works. Part A covers the automated gates, Part B manual checks per
user story against the mock API, Part C the smoke suite against a real mailcow-rest-v2 dev stack,
and Part D a mailcow host. Setup, tooling and the general commands are in UI 001's
[quickstart.md](../001-sign-in-app-shell/quickstart.md); this guide adds only what is specific to
routing.

## Prerequisites

- Everything UI 001's quickstart lists.
- UI features 002–008 implemented, so that the domain and mailbox detail pages, bulk selection,
  typed confirmation, section editing and History exist (research R1).
- The contract pinned at a commit that contains API 009 (`contract/VERSION.json`, see
  [contracts/README.md](./contracts/README.md)).
- For Part C: the mailcow-rest-v2 dev stack with API 009 implemented, and its `routing` compose
  profile (the `mailpit` SMTP target).

## Part A: Automated gates

```bash
npm ci
npm run lint && npm run format:check
npm run typecheck
npm run contract:check                  # the pin contains the 46 routing operations
npm run i18n:check                      # en-gb, cs-cz, sk-sk complete; routing enums; rich hints parse
npm run test:unit                       # includes tests/unit/features/routing/** and the rich import
npm run build && npm run budget:check   # initial JS unchanged; routing chunks listed
npm run test:e2e -- tests/e2e/routing   # mobile-chromium, desktop-chromium, mobile-webkit
npm run test:e2e                        # the whole suite, including UI 002/003 detail pages
npm run lhci                            # adds the /ng/routing/relayhosts collection
```

**Expected**:

- Every command exits with 0.
- `test:e2e` reports every `US1-AS*` to `US9-AS*` test, the `FR-*` and `Edge:` tests and
  `SC-003`, `SC-004`, `SC-010` passing on all three projects, with no axe, CSP or mock contract
  violation.
- `budget:check` prints the same initial JavaScript size as before UI 009 (within a few hundred
  bytes for the catalogue change) and lists the `routing` page chunks.
- `lhci` prints at least 0.9 for performance and accessibility on `/ng/routing/relayhosts`.

## Part B: Manual checks per user story (mock API)

Start `npm run preview:mock` and open `http://localhost:4173/ng/`. Pick a scenario with
`npm run mock:scenario -- <name>`. Scenario names are defined in `tests/mocks/scenarios/routing/`.
Check every screen at 360 px and on a desktop, in both themes.

| Story | Scenario | Steps | Expected (spec reference) |
|---|---|---|---|
| US1 | `routing-admin-empty` | Open Routing › Sender-dependent transports | Empty state explains relayhosts and offers "Add" (US1-AS2); the introduction says they are also called relayhosts (FR-001) |
| US1 | `routing-admin-empty` | Add `[smtp.example.net]:587` with username and password; then type a host ending in `:465` | The relayhost appears active, success announced (AS3); the port 465 warning appears while typing (AS4) |
| US1 | `routing-admin-default` | Open relayhost 1 (password stored), save without typing; then "Remove password" and save | The field starts empty with "Password stored"; it stays stored; then "No password" (AS5, AS6) |
| US1 | `routing-admin-default` | Delete relayhost 2 | The dialog names its two domains and three mailboxes and says their assignments will be cleared (AS7) |
| US1 | `routing-admin-default` | Select three relayhosts, delete | The number must be typed; one result per entry (FR-016, FR-017) |
| US2 | `routing-assignments` | Open `/ng/domains/example.org`, Relayhost section, choose relayhost 3, save | The section shows relayhost 3; its usage count includes the domain (US2-AS1) |
| US2 | `routing-assignments` | Open `/ng/mailboxes/alice@example.org` | Own assignment (inactive, in words), the domain's relayhost, the effective one and the credentials note (AS3, AS4) |
| US2 | `routing-da-readonly` | Sign in as the domain administrator; open a domain and a mailbox | Both sections read-only with host and state; no Edit (AS2, SC-010) |
| US3 | `routing-admin-default` | Add transports for `a.example, b.example; bad..example` to `[mx.partner.net]:25` with a password | Two created, `bad..example` stays with its reason; the confirmation named the transports sharing the next hop; afterwards they are named as changed (AS2–AS4) |
| US3 | `routing-admin-default` | Add a transport to `[relay.net]:587`; then one with username `u2` for a next hop that has `u1`; then destination `*` | Interference names `relay.net` (AS6); the credentials explanation (AS5); the `*` warning (AS7) |
| US4 | `routing-admin-default` | Test relayhost 1; then the transport whose script fails at login; then the "never answers" transport | Empty fields with the default addresses as placeholders (AS1); "Accepted", TLS used, login succeeded (AS3); "Not accepted", failed at Login, last reply (AS4); after 75 s "No result was received" with "Run again" (FR-045) |
| US4 | `routing-admin-default` | Open the transcript at 360 px and copy it | Long lines wrap; `[redacted]` visible; copied text has `C:`/`S:` markers (AS7) |
| US5 | `routing-da-bcc` | Add a BCC map, search the local destination for `ali` | Mailboxes and aliases of the scope, labelled by kind, aliases with their mailboxes (AS2); two BCC addresses are refused with the alias hint (AS3) |
| US5 | `routing-da-readonly` | Open BCC maps | Maps without add, edit, delete or selection, and the permission note (AS6) |
| US6 | `routing-admin-default` | Add a TLS policy map; open the policy choice | Eight policies, each with an explanation (US6-AS2) |
| US7 | `routing-admin-default` | Add a recipient map whose original already exists | Duplicate reported at that field (US7-AS2) |
| US8 | `routing-admin-default` | Add `forwarder.example`; then `nothing.example`; then `dns-down.example` | Two addresses, one added and one updated (US8-AS2); field error; "temporarily unavailable" with retry (AS3) |
| US9 | `routing-admin-default` | History on relayhost 1, and on alice's Relayhost section | The audit log opens filtered to `relayhost`/`1` and to `mailboxRelayhostAssignment`/`alice@example.org` (US9-AS1, AS2) |

## Part C: Smoke suite against a real mailcow-rest-v2 dev stack

```bash
export MAILCOW_REST_V2_DIR=../mailcow-rest-v2
SMOKE_COMPOSE_PROFILES=routing scripts/smoke/stack-up.sh   # adds mailpit (SMTP on mailpit:1025)
npm run test:smoke -- --grep @routing
scripts/smoke/stack-down.sh
```

**Expected**: the `@routing` smoke specs pass:

- `admin` creates the relayhost `[mailpit]:1025` with credentials, sees "Password stored" and no
  password anywhere, tests it and reads "Accepted" with `[redacted]` in the transcript, assigns it
  to `example.org`, sees it as effective on `alice@example.org`, and deletes it after a
  confirmation that names `example.org`;
- `admin` creates two transports for one next hop and sees the shared credentials;
- `admin` adds a TLS policy map, a recipient map and the forwarding host `192.0.2.5/24` (stored as
  `192.0.2.0/24`), then deletes them;
- `reseller` sees the BCC maps of `example.org` and `example.net`, with or without change controls
  according to its `bccMaps` flag.

`docker compose -f $MAILCOW_REST_V2_DIR/compose.yaml logs app | grep -c <smoke password>` prints `0`.

## Part D: On a mailcow host

After deploying as in UI 001's quickstart Part D, open `https://<MAILCOW_HOSTNAME>/ng/routing`:

- The six screens show the entries of the classic interface's System › Routing, Forwarding hosts,
  BCC, recipient map and TLS policy map tabs.
- The relayhost edit page shows "Password stored", never the password.
- A relayhost test of a real provider answers within 60 s and uses the provider's MX when the host
  has no brackets.
- The domain and mailbox pages show the Relayhost sections; a domain administrator with the
  "Change relayhost for a domain" permission can save one.

## Validation log

Appended by the polish tasks: SC-001 timing on a phone, screen-reader passes (VoiceOver, TalkBack),
and the SC-008 measurement of the BCC picker with 10,000 choices.
