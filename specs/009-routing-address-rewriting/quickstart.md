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
- UI features 002–008 implemented, so that the domain page, the mailbox layout, bulk selection,
  typed confirmation, section editing, the leave guard and History exist (research R1).
- The contract pinned at a commit that contains API 009 (`contract/VERSION.json`, see
  [contracts/README.md](./contracts/README.md)).
- For Part C only: the mailcow-rest-v2 dev stack with API 009 implemented, and its `routing`
  compose profile (the `mailpit` SMTP target). Parts A and B need only API 009's merged contract.

## Part A: Automated gates

```bash
npm ci
npm run lint && npm run format:check
npm run typecheck
npm run contract:check                  # vendored contract checksum; generated files up to date
npm run i18n:check                      # new strings in en-gb, cs-cz, sk-sk; legacy keys in the en-gb snapshot; routing enums
npm run test:unit                       # includes tests/unit/features/routing/** (legacy hints through SanitizedHtml)
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
| US2 | `routing-assignments` | Open `/ng/domains/example.org` (on relayhost 1), edit the Relayhost section (`?edit=relayhost`), choose relayhost 4, save | The section shows relayhost 4; its usage count on the relayhost list includes the domain (US2-AS1) |
| US2 | `routing-assignments` | Open the Relayhost sections of `alice@example.org`, `bob@example.org` and `dave@example.net` (`/ng/mailboxes/<address>/relayhost`) | alice: own relayhost 3 "inactive" in words, the domain's relayhost 1 effective (AS4); bob: relayhost 5 effective with the note that the domain relayhost's credentials are sent; dave: the note that no credentials are sent (FR-035) |
| US2 | `routing-da-readonly` | Sign in as the domain administrator; open a domain and a mailbox | Both sections read-only with host and state; no Edit (AS2, SC-010) |
| US3 | `routing-admin-default` | Add transports for `c.example, d.example; bad..example` to `[mx.partner.net]:25` (used by A and B with username `u1`) with username `u1` and a new password | The confirmation named A and B; two created and `bad..example` stays with its reason; afterwards A and B are named as changed (AS2–AS4) |
| US3 | `routing-admin-default` | Add a transport to `[relay.net]:587`; then one with username `u2` for a next hop that has `u1`; then destination `*` | Interference names `relay.net` (AS6); the credentials explanation (AS5); the `*` warning (AS7) |
| US4 | `routing-tests` | Test relayhost 1; then the transport whose script fails at login; then the "never answers" transport | Empty fields with the default addresses as placeholders (AS1); "Accepted", TLS used, login succeeded (AS3); "Not accepted", failed at Login, last reply (AS4); after 75 s "No result was received" with "Run again" (FR-045) |
| US4 | `routing-tests` | Open the transcript at 360 px and copy it | Long lines wrap; `[redacted]` visible; copied text has `C:`/`S:` markers (AS7) |
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

### 2026-10-19: new strings for the owner's review (T118)

`npm run i18n:check` passes: no unused or missing keys. UI 009 adds 115 new strings in en-gb, cs-cz
and sk-sk, written by hand (never machine-translated): 84 in the feature's own chunk
(`src/i18n/messages/routing/*.json`) and 31 in the main files (four validation messages and the
audit labels of API 009's 21 event types and six of its eight target types; `bccMap` and
`recipientMap` use legacy's `mailbox.bcc_map` and `mailbox.recipient_map`). Everything else on the
screens is legacy's text, loaded at runtime.

| Key | en-gb | cs-cz | sk-sk |
|---|---|---|---|
| `routing.bccMaps.orphaned` | Domain no longer exists | Doména už neexistuje | Doména už neexistuje |
| `routing.bulk.leaveRunning` | The action keeps running on the server, but its result will not be shown. | Akce na serveru dál běží, ale její výsledek se nezobrazí. | Akcia na serveri ďalej beží, ale jej výsledok sa nezobrazí. |
| `routing.bulk.leaveTitle` | Leave while the action runs? | Odejít, dokud akce běží? | Odísť, kým akcia beží? |
| `routing.common.backToList` | Back to the list | Zpět na seznam | Späť na zoznam |
| `routing.common.id` | ID | ID | ID |
| `routing.common.loadFailed` | The entry could not be loaded. | Položku se nepodařilo načíst. | Položku sa nepodarilo načítať. |
| `routing.common.refreshFailed` | The list could not be refreshed. The entries shown may be out of date. | Seznam se nepodařilo obnovit. Zobrazené položky mohou být zastaralé. | Zoznam sa nepodarilo obnoviť. Zobrazené položky môžu byť zastarané. |
| `routing.common.test` | Test | Test | Test |
| `routing.connectionTest.copy` | Copy transcript | Kopírovat přepis | Kopírovať prepis |
| `routing.connectionTest.copyRefused` | The browser did not allow copying. The transcript is selected: copy it yourself. | Prohlížeč kopírování nepovolil. Přepis je označen: zkopírujte jej sami. | Prehliadač kopírovanie nepovolil. Prepis je označený: skopírujte ho sami. |
| `routing.connectionTest.direction.client` | Sent | Odesláno | Odoslané |
| `routing.connectionTest.direction.info` | Note | Poznámka | Poznámka |
| `routing.connectionTest.direction.server` | Received | Přijato | Prijaté |
| `routing.connectionTest.duration` | ({seconds} s) | ({seconds} s) | ({seconds} s) |
| `routing.connectionTest.failedAt` | Failed at: {step} | Selhalo při: {step} | Zlyhalo pri: {step} |
| `routing.connectionTest.legend` | C: sent by the test · S: received from the server · *: note of the test | C: odesláno testem · S: přijato od serveru · *: poznámka testu | C: odoslané testom · S: prijaté zo servera · *: poznámka testu |
| `routing.connectionTest.login.failed` | Failed | Neúspěšné | Neúspešné |
| `routing.connectionTest.login.notConfigured` | No username stored, no login | Není uloženo uživatelské jméno, bez přihlášení | Nie je uložené používateľské meno, bez prihlásenia |
| `routing.connectionTest.login.notReached` | Not reached | Nedosaženo | Nedosiahnuté |
| `routing.connectionTest.login.succeeded` | Succeeded | Úspěšné | Úspešné |
| `routing.connectionTest.noDialogue` | No dialogue took place. | Žádná komunikace neproběhla. | Žiadna komunikácia neprebehla. |
| `routing.connectionTest.noReply` | No reply from the server | Žádná odpověď serveru | Žiadna odpoveď servera |
| `routing.connectionTest.noResult` | No result was received. The test may still have sent a message. | Nepřišel žádný výsledek. Test mohl zprávu přesto odeslat. | Neprišiel žiadny výsledok. Test mohol správu aj tak odoslať. |
| `routing.connectionTest.notReached` | Not reached | Nedosaženo | Nedosiahnuté |
| `routing.connectionTest.reached` | Reached: {step} | Dosaženo: {step} | Dosiahnuté: {step} |
| `routing.connectionTest.reason.connectionClosed` | The server closed the connection. | Server spojení ukončil. | Server spojenie ukončil. |
| `routing.connectionTest.reason.connectionFailed` | The connection failed. | Spojení se nezdařilo. | Spojenie sa nepodarilo. |
| `routing.connectionTest.reason.connectionRefused` | The connection was refused. | Spojení bylo odmítnuto. | Spojenie bolo odmietnuté. |
| `routing.connectionTest.reason.dnsTemporaryFailure` | DNS could not be queried. | DNS se nepodařilo dotázat. | DNS sa nepodarilo dopytovať. |
| `routing.connectionTest.reason.loginMechanismNotSupported` | The server offers neither PLAIN nor LOGIN. | Server nenabízí PLAIN ani LOGIN. | Server neponúka PLAIN ani LOGIN. |
| `routing.connectionTest.reason.loginNotOffered` | The server offers no login. | Server nenabízí přihlášení. | Server neponúka prihlásenie. |
| `routing.connectionTest.reason.nameNotResolved` | The host has no address. | Host nemá žádnou adresu. | Host nemá žiadnu adresu. |
| `routing.connectionTest.reason.rejected` | The server rejected it. | Server to odmítl. | Server to odmietol. |
| `routing.connectionTest.reason.timeout` | No answer in time. | Odpověď nepřišla včas. | Odpoveď neprišla včas. |
| `routing.connectionTest.reason.tlsFailed` | The TLS handshake failed. | Navázání TLS se nezdařilo. | Nadviazanie TLS sa nepodarilo. |
| `routing.connectionTest.reasonUnknown` | The test stopped ({reason}). | Test se zastavil ({reason}). | Test sa zastavil ({reason}). |
| `routing.connectionTest.result` | Test result | Výsledek testu | Výsledok testu |
| `routing.connectionTest.server` | Server | Server | Server |
| `routing.connectionTest.state.failed` | Failed | Selhalo | Zlyhalo |
| `routing.connectionTest.state.notConfigured` | Not configured | Nenastaveno | Nenastavené |
| `routing.connectionTest.state.notOffered` | Not offered | Nenabízeno | Neponúkané |
| `routing.connectionTest.state.notReached` | Not reached | Nedosaženo | Nedosiahnuté |
| `routing.connectionTest.state.passed` | Passed | Prošlo | Prešlo |
| `routing.connectionTest.step.connect` | Connection | Spojení | Spojenie |
| `routing.connectionTest.step.greeting` | Greeting | Pozdrav | Pozdrav |
| `routing.connectionTest.step.login` | Login | Přihlášení | Prihlásenie |
| `routing.connectionTest.step.message` | Message | Zpráva | Správa |
| `routing.connectionTest.step.recipient` | Recipient | Příjemce | Príjemca |
| `routing.connectionTest.step.resolve` | Name resolution | Překlad názvu | Preklad názvu |
| `routing.connectionTest.step.sender` | Sender | Odesílatel | Odosielateľ |
| `routing.connectionTest.step.tls` | TLS | TLS | TLS |
| `routing.connectionTest.time` | Time | Čas | Čas |
| `routing.connectionTest.title` | Transport | Transport | Transport |
| `routing.connectionTest.tlsNotUsed` | Not used | Nepoužito | Nepoužité |
| `routing.connectionTest.tlsUsed` | Used (STARTTLS) | Použito (STARTTLS) | Použité (STARTTLS) |
| `routing.connectionTest.transcript` | Transcript (server output, not translated) | Přepis (výstup serveru, nepřeloženo) | Prepis (výstup servera, nepreložené) |
| `routing.connectionTest.verdict.accepted` | Accepted | Přijato | Prijaté |
| `routing.connectionTest.verdict.notAccepted` | Not accepted | Nepřijato | Neprijaté |
| `routing.connectionTest.viaMx` | (MX lookup of {nextHop}) | (vyhledání MX pro {nextHop}) | (vyhľadanie MX pre {nextHop}) |
| `routing.credentials.none` | No password is stored. | Žádné heslo není uloženo. | Žiadne heslo nie je uložené. |
| `routing.credentials.removalPending` | The password will be removed when you save. | Heslo bude odstraněno při uložení. | Heslo bude odstránené pri uložení. |
| `routing.credentials.remove` | Remove password | Odstranit heslo | Odstrániť heslo |
| `routing.credentials.stored` | A password is stored. | Heslo je uloženo. | Heslo je uložené. |
| `routing.credentials.undo` | Undo | Zpět | Späť |
| `routing.credentials.usernameCleared` | Saving without a username also removes the stored password. | Uložením bez uživatelského jména se odstraní i uložené heslo. | Uložením bez používateľského mena sa odstráni aj uložené heslo. |
| `routing.filters.any` | All | Vše | Všetko |
| `routing.filters.no` | No | Ne | Nie |
| `routing.filters.title` | Filters and sorting | Filtry a řazení | Filtre a zoradenie |
| `routing.filters.yes` | Yes | Ano | Áno |
| `routing.forwardingHosts.disableSpamFilter` | Disable spam filter | Vypnout filtr spamu | Vypnúť spam filter |
| `routing.forwardingHosts.enableSpamFilter` | Enable spam filter | Zapnout filtr spamu | Zapnúť spam filter |
| `routing.forwardingHosts.historyOfSource` | History of this source | Historie tohoto zdroje | História tohto zdroja |
| `routing.forwardingHosts.hostPlaceholder` | example.org | example.org | example.org |
| `routing.forwardingHosts.updated` | Already listed, updated: {addresses} | Již uvedeno, aktualizováno: {addresses} | Už uvedené, aktualizované: {addresses} |
| `routing.relayhosts.delete.cleared` | Their sender-dependent transport becomes: | Jejich transport podle odesílatele bude: | Ich transportná mapa pre odosielanie bude: |
| `routing.relayhosts.delete.namesFailed` | The names could not be loaded. | Názvy se nepodařilo načíst. | Názvy sa nepodarilo načítať. |
| `routing.relayhosts.delete.showAll` | Show all | Zobrazit vše | Zobraziť všetko |
| `routing.relayhosts.hostPlaceholder` | [0.0.0.0], [0.0.0.0]:25, host:25, host, [host]:25 | [0.0.0.0], [0.0.0.0]:25, host:25, host, [host]:25 | [0.0.0.0], [0.0.0.0]:25, host:25, host, [host]:25 |
| `routing.sort.asc` | Ascending | Vzestupně | Vzostupne |
| `routing.sort.desc` | Descending | Sestupně | Zostupne |
| `routing.sort.label` | Sort by | Řadit podle | Zoradiť podľa |
| `routing.sort.order` | Order | Pořadí | Poradie |
| `routing.transports.affected` | The credentials of these transports changed too: {destinations} | Změnily se i přihlašovací údaje těchto transportů: {destinations} | Zmenili sa aj prihlasovacie údaje týchto transportov: {destinations} |
| `routing.transports.nextHopPlaceholder` | host:25, host, [host]:25, [0.0.0.0]:25 | host:25, host, [host]:25, [0.0.0.0]:25 | host:25, host, [host]:25, [0.0.0.0]:25 |
| `enums.auditEventType.bccMapCreation` | BCC map added | Skrytá kopie přidána | Skrytá kópia pridaná |
| `enums.auditEventType.bccMapDeletion` | BCC map removed | Skrytá kopie odebrána | Skrytá kópia odstránená |
| `enums.auditEventType.bccMapUpdate` | BCC map changed | Skrytá kopie změněna | Skrytá kópia zmenená |
| `enums.auditEventType.forwardingHostCreation` | Forwarding host added | Předávající server přidán | Preposielací server pridaný |
| `enums.auditEventType.forwardingHostDeletion` | Forwarding host removed | Předávající server odebrán | Preposielací server odstránený |
| `enums.auditEventType.forwardingHostUpdate` | Forwarding host changed | Předávající server změněn | Preposielací server zmenený |
| `enums.auditEventType.recipientMapCreation` | Recipient map added | Mapa příjemce přidána | Mapa príjemcu pridaná |
| `enums.auditEventType.recipientMapDeletion` | Recipient map removed | Mapa příjemce odebrána | Mapa príjemcu odstránená |
| `enums.auditEventType.recipientMapUpdate` | Recipient map changed | Mapa příjemce změněna | Mapa príjemcu zmenená |
| `enums.auditEventType.relayhostAssignmentUpdate` | Sender-dependent transport assignment changed | Přiřazení transportu podle odesílatele změněno | Priradenie transportu závislého na odosielateľovi zmenené |
| `enums.auditEventType.relayhostCreation` | Sender-dependent transport added | Transport podle odesílatele přidán | Transport závislý na odosielateľovi pridaný |
| `enums.auditEventType.relayhostDeletion` | Sender-dependent transport removed | Transport podle odesílatele odebrán | Transport závislý na odosielateľovi odstránený |
| `enums.auditEventType.relayhostTest` | Sender-dependent transport tested | Transport podle odesílatele otestován | Transport závislý na odosielateľovi otestovaný |
| `enums.auditEventType.relayhostUpdate` | Sender-dependent transport changed | Transport podle odesílatele změněn | Transport závislý na odosielateľovi zmenený |
| `enums.auditEventType.tlsPolicyMapCreation` | TLS policy map added | Mapa TLS pravidel přidána | Mapa TLS pravidiel pridaná |
| `enums.auditEventType.tlsPolicyMapDeletion` | TLS policy map removed | Mapa TLS pravidel odebrána | Mapa TLS pravidiel odstránená |
| `enums.auditEventType.tlsPolicyMapUpdate` | TLS policy map changed | Mapa TLS pravidel změněna | Mapa TLS pravidiel zmenená |
| `enums.auditEventType.transportCreation` | Transport added | Transport přidán | Transport pridaný |
| `enums.auditEventType.transportDeletion` | Transport removed | Transport odebrán | Transport odstránený |
| `enums.auditEventType.transportTest` | Transport tested | Transport otestován | Transport otestovaný |
| `enums.auditEventType.transportUpdate` | Transport changed | Transport změněn | Transport zmenený |
| `enums.auditTargetType.domainRelayhostAssignment` | Sender-dependent transport of a domain | Transport podle odesílatele pro doménu | Transport závislý na odosielateľovi pre doménu |
| `enums.auditTargetType.forwardingHost` | Forwarding host | Předávající server | Preposielací server |
| `enums.auditTargetType.mailboxRelayhostAssignment` | Sender-dependent transport of a mailbox | Transport podle odesílatele pro schránku | Transport závislý na odosielateľovi pre schránku |
| `enums.auditTargetType.relayhost` | Sender-dependent transport | Transport podle odesílatele | Transport závislý na odosielateľovi |
| `enums.auditTargetType.tlsPolicyMap` | TLS policy map | Mapa TLS pravidel | Mapa TLS pravidiel |
| `enums.auditTargetType.transport` | Transport | Transport | Transport |
| `validation.byParam.required.because.password` | A username is needed for a password. | K heslu je potřeba uživatelské jméno. | K heslu je potrebné používateľské meno. |
| `validation.invalidCharacter` | This value must not contain {characters}. | Tato hodnota nesmí obsahovat {characters}. | Táto hodnota nesmie obsahovať {characters}. |
| `validation.invalidRegex` | This is not a valid regular expression. | Toto není platný regulární výraz. | Toto nie je platný regulárny výraz. |
| `validation.notResolvable` | This name resolves to no address. | Tento název se nepřekládá na žádnou adresu. | Tento názov sa neprekladá na žiadnu adresu. |
