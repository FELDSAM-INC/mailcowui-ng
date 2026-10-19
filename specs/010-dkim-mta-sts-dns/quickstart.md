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

## Validation log

### Results (2026-10-19)

All automated gates ran in the pinned Playwright image (`mcr.microsoft.com/playwright:v1.64.1-noble`,
Node 24) on a machine shared with other builds (load average 20 to 50 on 16 cores). `wt/010` was
rebased onto main three times during validation (`681bfdb`, `c2c7fe8`, `f0c9011`); each entry names
its base.

- **Bundle (T109)**, `npm run build && npm run budget:check` on main `f0c9011`: the initial
  JavaScript is 178,958 bytes gzipped (budget 204,800; main 176,173). The additions are the DNS route
  records and the feature's `index.ts`, which the router imports (a comparison of the unminified
  builds shows no other new module in the initial graph), and the strings, legacy text entries and
  query keys the shell needs before a DNS screen loads. The DNS pages and sections are lazy:
  `DkimKeyPage` 10.0 KB, `DkimKeysPage` 8.5 KB, `DnsDiagnosticsPage` 7.9 KB, `DomainMtaStsSection`
  6.5 KB, `MtaStsPoliciesPage` 4.2 KB, `DkimImportPage` 3.7 KB, `DkimCopyPage` 2.8 KB,
  `DomainDkimSection` 1.6 KB and `AliasDomainMtaStsSection` 0.6 KB; their strings load with them
  (5.0 KB in en-gb, about 6 KB in cs-cz and in sk-sk).
  - On main `79948fc`, the DNS pages had split the shell's shared modules into six more initial
    chunks: the sign-in page loaded 29 scripts, 215,500 bytes with headers, over UI 001's
    204,800-byte assertion (which that main already missed at 206,062). UI 010 kept the shell
    together with two chunk groups; main's `$initial` group (UI 012, UI 004) now does this for every
    module the entry loads, and the rebase onto `f0c9011` took main's rule. The sign-in page loads
    11 scripts, as on main.
  - Lighthouse found a layout shift of 0.15 on `/ng/dns/dkim-keys`: the administrators' DKIM
    settings appeared above the list when the capabilities arrived. The summary now keeps its
    place with placeholders, and the shift is 0.
- **Lighthouse (T109)**, `npm run lhci` with the new `/ng/dns/dkim-keys` collection (scenario
  `dns-many`), three mobile runs per page on main `f0c9011` at a load average of about 16, with main
  measured right after under the same load:

  | Page | Performance (010) | Performance (main) | Accessibility | Scripts (010 / main) |
  |---|---|---|---|---|
  | `/ng/sign-in` | 0.86 | 0.88–0.89 | 1.0 | 199,593 / 196,789 bytes |
  | `/ng/` | 0.78–0.82 | 0.76–0.80 | 1.0 | 185,936 / 183,152 bytes |
  | `/ng/domains` | 0.66–0.73 | 0.68–0.72 | 0.99 | 223,121 / 220,289 bytes |
  | `/ng/aliases` | 0.67–0.68 | 0.67–0.70 | 0.99 | 228,546 / 225,741 bytes |
  | `/ng/dns/dkim-keys` | 0.77–0.80 | — | 1.0 | 243,226 bytes |

  Accessibility and the sign-in page's script assertion (204,800 bytes) pass, and the layout shift
  is 0 on every page. Performance misses 0.9 on the shared machine for main's pages as well:
  largest contentful paint and blocking time grow with the load, as UI 012 recorded, and the runs
  differ by about 0.03 between repetitions. Earlier runs on `681bfdb` (load 20 to 30) gave the same
  picture: sign-in 0.88–0.91 (main 0.85–0.90) and `/ng/dns/dkim-keys` 0.75–0.82. The 0.9 check
  needs a quiet runner (CI).
- **Smoke suite (T110)**, on main `681bfdb`: `scripts/smoke/stack-up.sh` with the API at main `b4058c3` (API 010
  implemented), as its own Compose project (`SMOKE_PROJECT=ui010-smoke`, `SMOKE_WEB_PORT=18710`).
  Its API work directory was a plain local clone, so the API repository's worktrees were not
  touched. Then `npm run test:smoke` ran in the Playwright image:
  - `--grep @dns`: 11 of 11 passed (read-only cases, generation, import, copy, bulk deletion,
    replacement, the MTA-STS policy, `reseller`'s scope);
  - the whole smoke suite: 44 passed and 4 skipped (UI 012's identity provider tests, which need
    `SMOKE_IDP=1`), after UI 002's history smoke test was changed to open the page header's
    History;
  - `docker compose logs app web | grep -c 'BEGIN PRIVATE KEY'` printed `0`.
- **Devices (T112)**: not run. No mid-range Android phone or iPhone was available to the
  implementing agent, so SC-001 and SC-013 on a phone, the VoiceOver and TalkBack passes of US1 to
  US4 and the SC-002 parity check on devices are still open for the owner. The automated stand-ins
  are the end-to-end suite on the two mobile projects (360 px Chromium with touch, WebKit) with axe
  in both themes, and `reflow.spec.ts` and `keyboard-only.spec.ts`.
- **End-to-end** (`npm run test:e2e`, three projects, two workers, axe in both themes):
  - Before the rebase (main `79948fc`), `tests/e2e/dns` (486 tests): 472 passed, 2 skipped and 12
    failed. The fixes:
    - "Publish DNS record again" lost its "turned off" refusal when the refreshed capabilities
      removed it; the entry page now keeps the refusal (spec edge case, FR-045).
    - The deletion impact texts in the dialogs now set their colours for both themes, because WebKit
      kept the light colours behind the dialog after the theme switch.
    - Test races: Escape before the exported key was shown, first loads waited for 5 s, the export
      refusal's alert checked after the action was gone (now the page's note), and a locator that
      also matched the app's live region.
    - One failure was the host network (`net::ERR_NETWORK_CHANGED` while other stacks started), so
      the end-to-end runs now use the container's own network.

    The affected files then passed on all three projects (138 of 138). The other suites: 1,456
    passed, 12 skipped, and 1 failed. That one was UI 002's history test, which now opens the page
    header's History, because the MTA-STS section has one as well.
  - After the rebase onto main `681bfdb`, the whole suite (2,357 tests) had 2,334 passed, 20 skipped
    and 3 failed, all on `mobile-webkit` at a load average of about 50: the MTA-STS section's
    `target-size` check, UI 012's sticky-header check of the identity provider form, and UI 001's
    sticky-header check of the passkeys page. All three passed when run again three or four times
    each, and the passkeys check passed 12 of 12 on both main and this branch.
  - On main `f0c9011` (the final base; the rebase resolved conflicts in the mock infrastructure and
    took main's `vite.config.ts`), the whole suite ran once under the shared two-slot limit: 3,017
    tests, 2,997 passed, 20 skipped, none failed. On `c2c7fe8`: 2,351 passed, 20 skipped and 1
    failed (UI 012's OAuth2 list on WebKit, a load timeout of `page.goto`; 4 of 4 when run again).
- **Unit tests** (`npm run test:unit`, coverage on), on main `f0c9011`: 274 files and 2,497 tests
  passed (on `681bfdb`: 241 files, 2,219 tests, and the coverage thresholds met). The run still
  exits with 1, because line coverage is 76.5 % against the 80 % threshold. Main `f0c9011` misses
  it on its own: without the DNS files the same report gives 74.2 %, after UI 004's alias domain
  (10.7 %), resource (7.6 %) and alias (39.8 %) files. Unit tests of the DKIM key list and entry
  pages, which only the end-to-end suite covered before, bring the DNS files to 91.9 %.
  `tests/unit/mocks/lang-handler.spec.ts` (UI 001) raised an unhandled error under Node 24 on main:
  unread mocked response bodies make undici fail when the socket closes. The test now reads them.

## Strings for review

The owner reviews the new Czech and Slovak strings before release (UI 001 owner question 4, T113).
They were written by hand, never machine-translated. 246 new strings: 225 under `dns.*` in the
feature's own files (`src/i18n/messages/{dns,dns-diagnostics,dns-mta-sts}/`, loaded with the DNS
routes), and 21 in the main files because the shell or shared components use them: `dns.checkDns`
(the "DNS" action on UI 002's and UI 004's screens), the audit labels (`enums.auditEventType.*`,
`enums.auditTargetType.dkimKey`), three problem types, six validation rules, `secrets.download`
and `common.copy.refused`. One string was removed (`nav.dns`: the catalogue now lists "ARC/DKIM
keys" and "MTA-STS" by their legacy keys). Legacy texts are mailcow's own and are not listed.

| Key | en-gb | cs-cz | sk-sk |
|---|---|---|---|
| `common.copy.refused` | The browser did not allow copying. The text is selected: copy it yourself. | Prohlížeč kopírování nepovolil. Text je označen: zkopírujte jej sami. | Prehliadač kopírovanie nepovolil. Text je označený: skopírujte ho sami. |
| `enums.auditEventType.dkimKeyGeneration` | DKIM key generated | DKIM klíč vygenerován | DKIM kľúč vygenerovaný |
| `enums.auditEventType.dkimKeyImport` | DKIM key imported | DKIM klíč importován | DKIM kľúč importovaný |
| `enums.auditEventType.dkimKeyCopy` | DKIM key copied | DKIM klíč zkopírován | DKIM kľúč skopírovaný |
| `enums.auditEventType.dkimKeyDeletion` | DKIM key removed | DKIM klíč odebrán | DKIM kľúč odstránený |
| `enums.auditEventType.dkimPrivateKeyExport` | DKIM private key exported | Soukromý DKIM klíč exportován | Súkromný DKIM kľúč exportovaný |
| `enums.auditEventType.dkimDnsPublication` | DKIM record published | DKIM záznam zveřejněn | DKIM záznam zverejnený |
| `enums.auditEventType.mtaStsPolicyCreation` | MTA-STS policy added | MTA-STS politika přidána | MTA-STS politika pridaná |
| `enums.auditEventType.mtaStsPolicyUpdate` | MTA-STS policy changed | MTA-STS politika změněna | MTA-STS politika zmenená |
| `enums.auditTargetType.dkimKey` | DKIM key | DKIM klíč | DKIM kľúč |
| `problem.dkim-private-key-export-disabled` | Private key export is turned off on this server. The operator can turn it on. | Export soukromých klíčů je na tomto serveru vypnutý. Provozovatel jej může zapnout. | Export súkromných kľúčov je na tomto serveri vypnutý. Prevádzkovateľ ho môže zapnúť. |
| `problem.dkim-dns-publication-disabled` | DNS publication is turned off on this server. | Zveřejňování v DNS je na tomto serveru vypnuté. | Zverejňovanie v DNS je na tomto serveri vypnuté. |
| `problem.mta-sts-policy-exists` | This domain already has an MTA-STS policy. | Tato doména již má MTA-STS politiku. | Táto doména už má MTA-STS politiku. |
| `secrets.download` | Download | Stáhnout | Stiahnuť |
| `validation.format.mxHost` | Enter a host name, for example mail.example.org or *.example.org. | Zadejte název hostitele, například mail.example.org nebo *.example.org. | Zadajte názov hostiteľa, napríklad mail.example.org alebo *.example.org. |
| `validation.invalidPrivateKey` | This is not a valid PEM private key. | Toto není platný soukromý klíč ve formátu PEM. | Toto nie je platný súkromný kľúč vo formáte PEM. |
| `validation.encryptedPrivateKey` | The key is protected by a passphrase. Remove the passphrase first. | Klíč je chráněn heslem. Nejprve heslo odstraňte. | Kľúč je chránený heslom. Najprv heslo odstráňte. |
| `validation.unsupportedKeyType` | Only these key types are supported: {allowed}. | Podporovány jsou jen tyto typy klíčů: {allowed}. | Podporované sú len tieto typy kľúčov: {allowed}. |
| `validation.keyLengthOutOfRange` | The key must have {min} to {max} bits. | Klíč musí mít {min} až {max} bitů. | Kľúč musí mať {min} až {max} bitov. |
| `validation.sameAsSource` | Choose a name other than the source. | Zvolte jiný název, než má zdroj. | Zvoľte iný názov, než má zdroj. |
| `dns.checkDns` | DNS | DNS | DNS |
| `dns.common.gone` | This entry no longer exists. | Tato položka již neexistuje. | Táto položka už neexistuje. |
| `dns.common.sort.label` | Sort by | Řadit podle | Zoradiť podľa |
| `dns.common.sort.order` | Order | Pořadí | Poradie |
| `dns.common.sort.asc` | Ascending | Vzestupně | Vzostupne |
| `dns.common.sort.desc` | Descending | Sestupně | Zostupne |
| `dns.capabilities.loadFailed` | The DNS settings of the server could not be loaded. | Nastavení DNS serveru se nepodařilo načíst. | Nastavenia DNS servera sa nepodarilo načítať. |
| `dns.publication.title` | DNS publication | Zveřejnění v DNS | Zverejnenie v DNS |
| `dns.publication.status.published` | Published to the DNS zone | Zveřejněno v zóně DNS | Zverejnené v zóne DNS |
| `dns.publication.status.removed` | Removed from the DNS zone | Odebráno ze zóny DNS | Odstránené zo zóny DNS |
| `dns.publication.status.noRecordToRemove` | No record to remove | Žádný záznam k odebrání | Žiadny záznam na odstránenie |
| `dns.publication.status.noZone` | No DNS zone was found for this name | Pro tento název nebyla nalezena žádná zóna DNS | Pre tento názov sa nenašla žiadna zóna DNS |
| `dns.publication.status.failed` | Not published | Nezveřejněno | Nezverejnené |
| `dns.publication.status.notConfigured` | DNS publication is not configured | Zveřejňování v DNS není nastaveno | Zverejňovanie v DNS nie je nastavené |
| `dns.publication.advice.noZone` | Publish the record manually. | Zveřejněte záznam ručně. | Zverejnite záznam ručne. |
| `dns.publication.advice.failed` | The key works; the record can be published again. | Klíč funguje; záznam lze zveřejnit znovu. | Kľúč funguje; záznam možno zverejniť znova. |
| `dns.publication.reasons.unreachable` | The DNS server could not be reached. | Server DNS nebyl dostupný. | Server DNS nebol dostupný. |
| `dns.publication.reasons.timeout` | The DNS server did not answer in time. | Server DNS neodpověděl včas. | Server DNS neodpovedal včas. |
| `dns.publication.reasons.authenticationFailed` | The DNS server refused the credentials. | Server DNS odmítl přihlašovací údaje. | Server DNS odmietol prihlasovacie údaje. |
| `dns.publication.reasons.remoteFault` | The DNS server reported an error. | Server DNS ohlásil chybu. | Server DNS ohlásil chybu. |
| `dns.publication.reasons.invalidResponse` | The DNS server sent an answer that could not be read. | Server DNS poslal odpověď, kterou nelze přečíst. | Server DNS poslal odpoveď, ktorú nemožno prečítať. |
| `dns.publication.reasons.staleRecordRemovalFailed` | An old record could not be removed from the zone. | Starý záznam se nepodařilo ze zóny odebrat. | Starý záznam sa nepodarilo zo zóny odstrániť. |
| `dns.publication.reasons.unknown` | The DNS server reported an unexpected problem. | Server DNS ohlásil neočekávaný problém. | Server DNS ohlásil neočakávaný problém. |
| `dns.publication.detail` | Technical detail | Technické podrobnosti | Technické podrobnosti |
| `dns.publication.publishAgain.action` | Publish DNS record again | Znovu zveřejnit DNS záznam | Znova zverejniť DNS záznam |
| `dns.publication.publishAgain.outdated` | The key was changed elsewhere and has been reloaded. Publish again to send the current record. | Klíč byl mezitím změněn jinde a byl znovu načten. Zveřejněte znovu, aby se odeslal aktuální záznam. | Kľúč bol medzitým zmenený inde a bol znova načítaný. Zverejnite znova, aby sa odoslal aktuálny záznam. |
| `dns.dkim.run.started` | Started: {count} names. | Zahájeno: {count} názvů. | Spustené: {count} názvov. |
| `dns.dkim.run.progress` | {percent} % done. | Hotovo {percent} %. | Hotové {percent} %. |
| `dns.dkim.run.finished` | Finished: {counts}. | Dokončeno: {counts}. | Dokončené: {counts}. |
| `dns.dkim.run.status` | {done} of {total} names processed | Zpracováno {done} z {total} názvů | Spracovaných {done} z {total} názvov |
| `dns.dkim.run.progressLabel` | Progress | Průběh | Priebeh |
| `dns.dkim.run.stop` | Stop | Zastavit | Zastaviť |
| `dns.dkim.run.leaveTitle` | Stop the run? | Zastavit zpracování? | Zastaviť spracovanie? |
| `dns.dkim.run.leaveBody` | The remaining names will not be processed. | Zbývající názvy nebudou zpracovány. | Zostávajúce názvy nebudú spracované. |
| `dns.dkim.run.leave` | Stop and leave | Zastavit a odejít | Zastaviť a odísť |
| `dns.dkim.incomplete` | Incomplete | Neúplný | Neúplný |
| `dns.dkim.kinds.none` | No domain | Bez domény | Bez domény |
| `dns.dkim.missingParts.publicKey` | public key | veřejný klíč | verejný kľúč |
| `dns.dkim.missingParts.selector` | selector | selektor | selektor |
| `dns.dkim.missingParts.privateKey` | private key | soukromý klíč | súkromný kľúč |
| `dns.dkim.filters.title` | Filters | Filtry | Filtre |
| `dns.dkim.filters.withCount` | Filters ({count}) | Filtry ({count}) | Filtre ({count}) |
| `dns.dkim.filters.kind` | Type | Typ | Typ |
| `dns.dkim.filters.all` | All | Vše | Všetko |
| `dns.dkim.filters.complete` | Completeness | Úplnost | Úplnosť |
| `dns.dkim.filters.completeOnly` | Complete keys | Úplné klíče | Úplné kľúče |
| `dns.dkim.filters.incompleteOnly` | Incomplete keys | Neúplné klíče | Neúplné kľúče |
| `dns.dkim.filters.selectorChip` | Selector {selector} | Selektor {selector} | Selektor {selector} |
| `dns.dkim.filters.domainChip` | Domain {domain} with its alias domains | Doména {domain} s jejími doménovými aliasy | Doména {domain} s jej alias doménami |
| `dns.dkim.filters.bySelector` | Show only keys with selector {selector} | Zobrazit jen klíče se selektorem {selector} | Zobraziť len kľúče so selektorom {selector} |
| `dns.dkim.list.count` | {count} entries | Položek: {count} | Položiek: {count} |
| `dns.dkim.list.updating` | Updating… | Aktualizace… | Aktualizácia… |
| `dns.dkim.list.refreshFailed` | The list could not be refreshed. The results shown may be out of date. | Seznam se nepodařilo obnovit. Zobrazené výsledky nemusí být aktuální. | Zoznam sa nepodarilo obnoviť. Zobrazené výsledky nemusia byť aktuálne. |
| `dns.dkim.settings.title` | Server settings | Nastavení serveru | Nastavenia servera |
| `dns.dkim.settings.defaultSelector` | Default selector | Výchozí selektor | Predvolený selektor |
| `dns.dkim.settings.defaultKeySize` | Default key length (bits) | Výchozí délka klíče (v bitech) | Predvolená dĺžka kľúča (bity) |
| `dns.dkim.settings.export` | Private key export | Export soukromých klíčů | Export súkromných kľúčov |
| `dns.dkim.settings.on` | On | Zapnuto | Zapnuté |
| `dns.dkim.settings.off` | Off | Vypnuto | Vypnuté |
| `dns.dkim.record.title` | DNS record | DNS záznam | DNS záznam |
| `dns.dkim.record.hostLabel` | Host label | Název hostitele v zóně | Názov hostiteľa v zóne |
| `dns.dkim.record.value` | Value | Hodnota | Hodnota |
| `dns.dkim.record.form` | Form of the value | Podoba hodnoty | Podoba hodnoty |
| `dns.dkim.record.single` | One text | Jeden text | Jeden text |
| `dns.dkim.record.split` | Split into 255-character pieces | Rozdělit na části po 255 znacích | Rozdeliť na časti po 255 znakoch |
| `dns.dkim.record.copyName` | Copy record name of {name} | Kopírovat název záznamu pro {name} | Kopírovať názov záznamu pre {name} |
| `dns.dkim.record.copyHost` | Copy host label of {name} | Kopírovat název hostitele pro {name} | Kopírovať názov hostiteľa pre {name} |
| `dns.dkim.record.copyValue` | Copy record value of {name} | Kopírovat hodnotu záznamu pro {name} | Kopírovať hodnotu záznamu pre {name} |
| `dns.dkim.record.none` | No record can be published until the key is complete. | Dokud klíč není úplný, nelze zveřejnit žádný záznam. | Kým kľúč nie je úplný, nemožno zverejniť žiadny záznam. |
| `dns.dkim.entry.notSigned` | This name has no DKIM key. Its mail is not signed. | Tento název nemá DKIM klíč. Jeho pošta není podepisována. | Tento názov nemá DKIM kľúč. Jeho pošta nie je podpisovaná. |
| `dns.dkim.entry.loadFailed` | The DKIM key could not be loaded. | DKIM klíč se nepodařilo načíst. | DKIM kľúč sa nepodarilo načítať. |
| `dns.dkim.incompleteNotice.title` | This key is incomplete | Tento klíč je neúplný | Tento kľúč je neúplný |
| `dns.dkim.incompleteNotice.body` | It is not used for signing. Missing: {parts}. | Nepoužívá se k podepisování. Chybí: {parts}. | Nepoužíva sa na podpisovanie. Chýba: {parts}. |
| `dns.dkim.incompleteNotice.adviceAdmin` | Remove it, import a complete key with overwrite, or replace it with a new key. | Odeberte jej, importujte úplný klíč s přepsáním, nebo jej nahraďte novým klíčem. | Odstráňte ho, importujte úplný kľúč s prepísaním, alebo ho nahraďte novým kľúčom. |
| `dns.dkim.incompleteNotice.adviceDomainAdmin` | Ask an administrator to repair it. | Požádejte administrátora o opravu. | Požiadajte administrátora o opravu. |
| `dns.dkim.section.open` | Details of the DKIM key | Podrobnosti DKIM klíče | Podrobnosti DKIM kľúča |
| `dns.dkim.section.list` | DKIM keys of this domain and its alias domains | DKIM klíče této domény a jejích doménových aliasů | DKIM kľúče tejto domény a jej alias domén |
| `dns.dkim.generate.namesMore` | and {count} others | a {count} dalších | a {count} ďalších |
| `dns.dkim.generate.skipped` | These already have a key and are skipped: {names} | Tyto názvy už mají klíč a budou přeskočeny: {names} | Tieto názvy už majú kľúč a budú preskočené: {names} |
| `dns.dkim.allMissing.body` | Keys will be generated for {count} names without a key. | Klíče budou vygenerovány pro {count} názvů bez klíče. | Kľúče budú vygenerované pre {count} názvov bez kľúča. |
| `dns.dkim.allMissing.filters` | Only names that match the current search and type filter. | Jen názvy, které odpovídají současnému hledání a filtru typu. | Len názvy, ktoré zodpovedajú aktuálnemu vyhľadávaniu a filtru typu. |
| `dns.dkim.allMissing.none` | Every name has a key. | Všechny názvy mají klíč. | Všetky názvy majú kľúč. |
| `dns.dkim.allMissing.continue` | Continue | Pokračovat | Pokračovať |
| `dns.dkim.allMissing.collecting` | Finding the names without a key… | Hledají se názvy bez klíče… | Hľadajú sa názvy bez kľúča… |
| `dns.dkim.import.keyHint` | RSA PKCS#8 or PKCS#1, {min} to {max} bits | RSA PKCS#8 nebo PKCS#1, {min} až {max} bitů | RSA PKCS#8 alebo PKCS#1, {min} až {max} bitov |
| `dns.dkim.import.chooseFile` | Choose a file | Vybrat soubor | Vybrať súbor |
| `dns.dkim.import.existing` | This name has a key: selector {selector}, {length} bits. | Tento název má klíč: selektor {selector}, {length} bitů. | Tento názov má kľúč: selektor {selector}, {length} bitov. |
| `dns.dkim.import.unused` | No domain or alias domain has this name. The key is listed as unused until one does. | Žádná doména ani doménový alias nemá tento název. Klíč bude veden jako nepoužitý, dokud takový nebude. | Žiadna doména ani alias doména nemá tento názov. Kľúč bude vedený ako nepoužívaný, kým taký nebude. |
| `dns.dkim.import.switchOverwrite` | Switch on overwrite | Zapnout přepsání | Zapnúť prepísanie |
| `dns.dkim.import.confirmOverwrite` | The key {selector} ({length} bits) and its private key are removed completely and replaced by the imported key. | Klíč {selector} ({length} bitů) i jeho soukromý klíč budou zcela odstraněny a nahrazeny importovaným klíčem. | Kľúč {selector} ({length} bitov) aj jeho súkromný kľúč budú úplne odstránené a nahradené importovaným kľúčom. |
| `dns.dkim.import.tooLarge` | The key is larger than the server accepts. | Klíč je větší, než server přijme. | Kľúč je väčší, než server prijme. |
| `dns.dkim.import.leave` | The private key you entered will be discarded. | Zadaný soukromý klíč bude zahozen. | Zadaný súkromný kľúč bude zahodený. |
| `dns.dkim.delete.unsigned` | Mail of {name} is no longer signed from the next message on. | Pošta pro {name} nebude od další zprávy podepisována. | Pošta pre {name} nebude od ďalšej správy podpisovaná. |
| `dns.dkim.delete.stopsSigning` | Its mail is no longer signed. | Jeho pošta už nebude podepisována. | Jeho pošta už nebude podpisovaná. |
| `dns.dkim.delete.privateKey` | The private key is deleted permanently. | Soukromý klíč bude trvale smazán. | Súkromný kľúč bude natrvalo vymazaný. |
| `dns.dkim.delete.recordStays` | The DNS record stays in the DNS zone; remove it there yourself. | DNS záznam v zóně DNS zůstane; odstraňte jej tam sami. | DNS záznam v zóne DNS zostane; odstráňte ho tam sami. |
| `dns.dkim.delete.recordRemoved` | The DNS record is removed from the DNS zone; the outcome is recorded in the history. | DNS záznam bude odebrán ze zóny DNS; výsledek se zaznamená do historie. | DNS záznam bude odstránený zo zóny DNS; výsledok sa zaznamená do histórie. |
| `dns.dkim.delete.skipped` | Without a key, skipped: {names} | Bez klíče, přeskočeno: {names} | Bez kľúča, preskočené: {names} |
| `dns.dkim.replace.title` | Replace with a new key | Nahradit novým klíčem | Nahradiť novým kľúčom |
| `dns.dkim.replace.submit` | Replace | Nahradit | Nahradiť |
| `dns.dkim.replace.hint` | Choose a selector other than {selector}, so that the old and the new record can be published side by side while DNS updates. | Zvolte jiný selektor než {selector}, aby mohl být starý a nový záznam zveřejněn souběžně, dokud se DNS neaktualizuje. | Zvoľte iný selektor ako {selector}, aby mohol byť starý a nový záznam zverejnený súbežne, kým sa DNS neaktualizuje. |
| `dns.dkim.replace.action` | Replace with a new key | Nahradit novým klíčem | Nahradiť novým kľúčom |
| `dns.dkim.replace.confirm` | The key {selector} ({length} bits) and its private key are replaced in one step, so mail stays signed. The published DNS record must then carry the new value. | Klíč {selector} ({length} bitů) i jeho soukromý klíč budou nahrazeny v jednom kroku, takže pošta zůstane podepisována. Zveřejněný DNS záznam pak musí obsahovat novou hodnotu. | Kľúč {selector} ({length} bitov) aj jeho súkromný kľúč budú nahradené v jednom kroku, takže pošta zostane podpisovaná. Zverejnený DNS záznam potom musí obsahovať novú hodnotu. |
| `dns.dkim.replace.updateRecord` | Update the DNS record with the new value. | Aktualizujte DNS záznam novou hodnotou. | Aktualizujte DNS záznam novou hodnotou. |
| `dns.dkim.export.confirm` | The private key lets its holder sign mail for {name}. The export is recorded in the history. | Soukromý klíč umožní svému držiteli podepisovat poštu za {name}. Export se zaznamená do historie. | Súkromný kľúč umožní svojmu držiteľovi podpisovať poštu za {name}. Export sa zaznamená do histórie. |
| `dns.dkim.export.action` | Show the private key | Zobrazit soukromý klíč | Zobraziť súkromný kľúč |
| `dns.dkim.export.off` | Private key export is turned off on this server. | Export soukromých klíčů je na tomto serveru vypnutý. | Export súkromných kľúčov je na tomto serveri vypnutý. |
| `dns.dkim.copy.incomplete` | This key is incomplete and cannot be copied. | Tento klíč je neúplný a nelze jej zkopírovat. | Tento kľúč je neúplný a nemožno ho skopírovať. |
| `dns.dkim.copy.hasKey` | {name} has a key (selector {selector}). | {name} má klíč (selektor {selector}). | {name} má kľúč (selektor {selector}). |
| `dns.dkim.copy.confirmOverwrite` | These names have a key: {names}. Their old keys, including the private keys, are removed completely. | Tyto názvy mají klíč: {names}. Jejich staré klíče včetně soukromých klíčů budou zcela odstraněny. | Tieto názvy majú kľúč: {names}. Ich staré kľúče vrátane súkromných kľúčov budú úplne odstránené. |
| `dns.dkim.copy.skipOverwrite` | Skip these names | Tyto názvy přeskočit | Tieto názvy preskočiť |
| `dns.diagnostics.checks.serverIpv4` | Server address (IPv4) | Adresa serveru (IPv4) | Adresa servera (IPv4) |
| `dns.diagnostics.checks.reverseIpv4` | Reverse name (IPv4) | Reverzní záznam (IPv4) | Reverzný záznam (IPv4) |
| `dns.diagnostics.checks.serverIpv6` | Server address (IPv6) | Adresa serveru (IPv6) | Adresa servera (IPv6) |
| `dns.diagnostics.checks.reverseIpv6` | Reverse name (IPv6) | Reverzní záznam (IPv6) | Reverzný záznam (IPv6) |
| `dns.diagnostics.checks.tlsa25` | TLSA for SMTP (port 25) | TLSA pro SMTP (port 25) | TLSA pre SMTP (port 25) |
| `dns.diagnostics.checks.mx` | Mail exchanger | Poštovní server (MX) | Poštový server (MX) |
| `dns.diagnostics.checks.autodiscover` | Autodiscover | Autodiscover | Autodiscover |
| `dns.diagnostics.checks.autodiscoverService` | Autodiscover service | Služba Autodiscover | Služba Autodiscover |
| `dns.diagnostics.checks.autoconfig` | Autoconfig | Autoconfig | Autoconfig |
| `dns.diagnostics.checks.mtaStsHost` | MTA-STS host | Hostitel MTA-STS | Hostiteľ MTA-STS |
| `dns.diagnostics.checks.mtaStsRecord` | MTA-STS record | Záznam MTA-STS | Záznam MTA-STS |
| `dns.diagnostics.checks.tlsReporting` | TLS reporting | Hlášení TLS | Hlásenia TLS |
| `dns.diagnostics.checks.spf` | SPF | SPF | SPF |
| `dns.diagnostics.checks.dmarc` | DMARC | DMARC | DMARC |
| `dns.diagnostics.checks.dkim` | DKIM | DKIM | DKIM |
| `dns.diagnostics.checks.dkimSelector` | DKIM (selector {selector}) | DKIM (selektor {selector}) | DKIM (selektor {selector}) |
| `dns.diagnostics.checks.service` | {service} service | Služba {service} | Služba {service} |
| `dns.diagnostics.checks.generic` | {type} record | Záznam {type} | Záznam {type} |
| `dns.diagnostics.status.match` | Correct | Správně | Správne |
| `dns.diagnostics.status.mismatch` | Different value | Jiná hodnota | Iná hodnota |
| `dns.diagnostics.status.missing` | Missing | Chybí | Chýba |
| `dns.diagnostics.status.missingOptional` | Not set (optional) | Nenastaveno (volitelné) | Nenastavené (voliteľné) |
| `dns.diagnostics.status.lookupFailed` | Could not be checked | Nepodařilo se ověřit | Nepodarilo sa overiť |
| `dns.diagnostics.status.informational` | Found | Nalezeno | Nájdené |
| `dns.diagnostics.status.expectedUnknown` | Cannot be verified | Nelze ověřit | Nemožno overiť |
| `dns.diagnostics.status.unknown` | Unknown state | Neznámý stav | Neznámy stav |
| `dns.diagnostics.scopes.server` | Server-wide records | Záznamy celého serveru | Záznamy celého servera |
| `dns.diagnostics.scopes.domain` | Records of this name | Záznamy tohoto názvu | Záznamy tohto názvu |
| `dns.diagnostics.causes.connectionFailed` | the connection failed | spojení selhalo | spojenie zlyhalo |
| `dns.diagnostics.causes.timeout` | the connection timed out | vypršel časový limit spojení | vypršal časový limit spojenia |
| `dns.diagnostics.causes.starttlsRefused` | the server refused STARTTLS | server odmítl STARTTLS | server odmietol STARTTLS |
| `dns.diagnostics.causes.tlsHandshakeFailed` | the TLS handshake failed | navázání TLS selhalo | nadviazanie TLS zlyhalo |
| `dns.diagnostics.causes.noCertificate` | no certificate was presented | server nepředložil žádný certifikát | server nepredložil žiadny certifikát |
| `dns.diagnostics.messages.lookupTimeout` | The lookup timed out after {timeoutSeconds} seconds. | Dotaz nebyl zodpovězen do {timeoutSeconds} sekund. | Dopyt nebol zodpovedaný do {timeoutSeconds} sekúnd. |
| `dns.diagnostics.messages.runTimeout` | The check reached its time limit of {timeoutSeconds} seconds before this record was checked. | Kontrola dosáhla časového limitu {timeoutSeconds} sekund dříve, než byl tento záznam ověřen. | Kontrola dosiahla časový limit {timeoutSeconds} sekúnd skôr, než bol tento záznam overený. |
| `dns.diagnostics.messages.lookupError` | The DNS resolver reported an error or a failed DNSSEC validation. | Resolver DNS ohlásil chybu nebo neúspěšné ověření DNSSEC. | Resolver DNS ohlásil chybu alebo neúspešné overenie DNSSEC. |
| `dns.diagnostics.messages.publicAddressUnknown` | The server's public {family} address could not be determined. | Veřejnou adresu {family} serveru se nepodařilo zjistit. | Verejnú adresu {family} servera sa nepodarilo zistiť. |
| `dns.diagnostics.messages.certificateUnavailable` | The certificate of {host} on port {port} could not be read: {cause}. | Certifikát serveru {host} na portu {port} se nepodařilo přečíst: {cause}. | Certifikát servera {host} na porte {port} sa nepodarilo prečítať: {cause}. |
| `dns.diagnostics.messages.dkimKeyUnavailable` | The stored DKIM key could not be read. | Uložený DKIM klíč se nepodařilo přečíst. | Uložený DKIM kľúč sa nepodarilo prečítať. |
| `dns.diagnostics.messages.hostIsAlias` | The server host name is an alias (CNAME) of {target}, which a mail exchanger must not be. | Název serveru je alias (CNAME) pro {target}, což poštovní server nesmí být. | Názov servera je alias (CNAME) pre {target}, čo poštový server nesmie byť. |
| `dns.diagnostics.messages.dkimPublicKeyDiffers` | The DKIM record carries a different public key than the stored one. | DKIM záznam obsahuje jiný veřejný klíč, než je uložený. | DKIM záznam obsahuje iný verejný kľúč, než je uložený. |
| `dns.diagnostics.messages.spfMultipleRecords` | SPF records published: {count}. Only one is allowed. | Zveřejněné SPF záznamy: {count}. Povolen je jen jeden. | Zverejnené SPF záznamy: {count}. Povolený je len jeden. |
| `dns.diagnostics.messages.spfTooManyLookups` | Evaluating the SPF policy needs more than {limit} DNS lookups. | Vyhodnocení SPF vyžaduje více než {limit} dotazů DNS. | Vyhodnotenie SPF vyžaduje viac než {limit} dopytov DNS. |
| `dns.diagnostics.messages.spfTooManyVoidLookups` | Evaluating the SPF policy hits more than {limit} lookups without an answer. | Vyhodnocení SPF narazí na více než {limit} dotazů bez odpovědi. | Vyhodnotenie SPF narazí na viac než {limit} dopytov bez odpovede. |
| `dns.diagnostics.messages.spfNotPass` | The SPF policy does not authorise the server address {address} (result: {result}). | SPF neautorizuje adresu serveru {address} (výsledek: {result}). | SPF neautorizuje adresu servera {address} (výsledok: {result}). |
| `dns.diagnostics.messages.spfError` | The SPF policy could not be evaluated (result: {result}). | SPF se nepodařilo vyhodnotit (výsledek: {result}). | SPF sa nepodarilo vyhodnotiť (výsledok: {result}). |
| `dns.diagnostics.messages.nullServiceRecord` | The name publishes a null service record: the service is marked as not offered. | Název zveřejňuje prázdný záznam služby: služba je označena jako nenabízená. | Názov zverejňuje prázdny záznam služby: služba je označená ako neponúkaná. |
| `dns.diagnostics.messages.noPublicIpv6` | The server has no public IPv6 address, so the IPv6 checks are left out. | Server nemá veřejnou adresu IPv6, kontroly IPv6 proto chybí. | Server nemá verejnú adresu IPv6, kontroly IPv6 preto chýbajú. |
| `dns.diagnostics.messages.serverChecksOmitted` | The server-wide records are checked for administrators only. | Záznamy celého serveru se kontrolují jen pro administrátory. | Záznamy celého servera sa kontrolujú len pre administrátorov. |
| `dns.diagnostics.messages.spfAuthorizeAddresses` | The SPF record must authorise the server's addresses: | SPF záznam musí autorizovat adresy serveru: | SPF záznam musí autorizovať adresy servera: |
| `dns.diagnostics.messages.spfSuggestedRecord` | Suggested SPF record: | Doporučený SPF záznam: | Odporúčaný SPF záznam: |
| `dns.diagnostics.messages.spfSyntaxReference` | The SPF syntax is explained in its reference. | Syntaxe SPF je popsána v její referenci. | Syntax SPF je opísaná v jej referencii. |
| `dns.diagnostics.messages.dmarcPublishPolicy` | Publish a DMARC policy for this name. | Zveřejněte pro tento název DMARC politiku. | Zverejnite pre tento názov DMARC politiku. |
| `dns.diagnostics.messages.tlsReportingPublishRecord` | Publish a TLS reporting record to receive reports about failed TLS connections. | Zveřejněte záznam hlášení TLS, abyste dostávali hlášení o neúspěšných spojeních TLS. | Zverejnite záznam hlásení TLS, aby ste dostávali hlásenia o neúspešných spojeniach TLS. |
| `dns.diagnostics.messages.unknown` | Further detail, in English: | Další podrobnosti, v angličtině: | Ďalšie podrobnosti, v angličtine: |
| `dns.diagnostics.allow` | Allow | Povolit | Povoliť |
| `dns.diagnostics.learnMore` | Learn more | Více informací | Viac informácií |
| `dns.diagnostics.noRecord` | No record found | Žádný záznam nenalezen | Žiadny záznam sa nenašiel |
| `dns.diagnostics.found` | Values found | Nalezené hodnoty | Nájdené hodnoty |
| `dns.diagnostics.copyName` | Copy record name of {check} | Kopírovat název záznamu: {check} | Kopírovať názov záznamu: {check} |
| `dns.diagnostics.copyExpected` | Copy expected value of {check} | Kopírovat očekávanou hodnotu: {check} | Kopírovať očakávanú hodnotu: {check} |
| `dns.diagnostics.copyValue` | Copy {value} | Kopírovat {value} | Kopírovať {value} |
| `dns.diagnostics.aliasOf` | Alias domain of {target} | Doménový alias domény {target} | Alias doména domény {target} |
| `dns.diagnostics.aliasMtaSts` | The MTA-STS records of an alias domain point to the policy of {target}. | Záznamy MTA-STS doménového aliasu odkazují na politiku domény {target}. | Záznamy MTA-STS alias domény odkazujú na politiku domény {target}. |
| `dns.diagnostics.partial` | Some records could not be checked. Run the check again later. | Některé záznamy se nepodařilo ověřit. Spusťte kontrolu později znovu. | Niektoré záznamy sa nepodarilo overiť. Spustite kontrolu neskôr znova. |
| `dns.diagnostics.changed` | The DKIM key or the MTA-STS policy changed after this check. | DKIM klíč nebo MTA-STS politika se po této kontrole změnily. | DKIM kľúč alebo MTA-STS politika sa po tejto kontrole zmenili. |
| `dns.diagnostics.summary.title` | Summary | Souhrn | Súhrn |
| `dns.diagnostics.summary.groups.ok` | {count} correct | Správně: {count} | Správne: {count} |
| `dns.diagnostics.summary.groups.needsAttention` | {count} need attention | Vyžaduje pozornost: {count} | Vyžaduje pozornosť: {count} |
| `dns.diagnostics.summary.groups.optionalNotSet` | {count} optional, not set | Volitelné, nenastavené: {count} | Voliteľné, nenastavené: {count} |
| `dns.diagnostics.summary.groups.notVerified` | {count} not verified | Neověřeno: {count} | Neoverené: {count} |
| `dns.diagnostics.summary.allCorrect` | All required records are correct. | Všechny povinné záznamy jsou správně. | Všetky povinné záznamy sú správne. |
| `dns.diagnostics.summary.allCorrectUnverified` | All required records that could be checked are correct; {count} not verified. | Všechny povinné záznamy, které šlo ověřit, jsou správně; neověřeno: {count}. | Všetky povinné záznamy, ktoré sa dali overiť, sú správne; neoverené: {count}. |
| `dns.diagnostics.summary.onlyAttention` | Only checks that need attention or were not verified | Jen kontroly, které vyžadují pozornost nebo nebyly ověřeny | Len kontroly, ktoré vyžadujú pozornosť alebo neboli overené |
| `dns.diagnostics.summary.noneLeft` | No check needs attention. | Žádná kontrola nevyžaduje pozornost. | Žiadna kontrola nevyžaduje pozornosť. |
| `dns.diagnostics.facts.title` | Server | Server | Server |
| `dns.diagnostics.facts.hostname` | Host name | Název serveru | Názov servera |
| `dns.diagnostics.facts.ipv4` | IPv4 address | Adresa IPv4 | Adresa IPv4 |
| `dns.diagnostics.facts.ipv6` | IPv6 address | Adresa IPv6 | Adresa IPv6 |
| `dns.diagnostics.facts.noIpv6` | No public IPv6 address | Žádná veřejná adresa IPv6 | Žiadna verejná adresa IPv6 |
| `dns.diagnostics.facts.checkedAt` | Checked | Zkontrolováno | Skontrolované |
| `dns.diagnostics.zone.title` | Zone file | Soubor zóny | Súbor zóny |
| `dns.diagnostics.zone.download` | Download | Stáhnout | Stiahnuť |
| `dns.diagnostics.zone.copy` | Copy zone file | Kopírovat soubor zóny | Kopírovať súbor zóny |
| `dns.diagnostics.zone.show` | Show zone file | Zobrazit soubor zóny | Zobraziť súbor zóny |
| `dns.diagnostics.zone.hide` | Hide zone file | Skrýt soubor zóny | Skryť súbor zóny |
| `dns.diagnostics.run.again` | Run again | Spustit znovu | Spustiť znova |
| `dns.diagnostics.run.running` | Checking the DNS records… This can take up to {seconds} seconds. | Kontroluji DNS záznamy… Může to trvat až {seconds} sekund. | Kontrolujem DNS záznamy… Môže to trvať až {seconds} sekúnd. |
| `dns.diagnostics.run.started` | Checking the DNS records of {name}… | Kontroluji DNS záznamy pro {name}… | Kontrolujem DNS záznamy pre {name}… |
| `dns.diagnostics.run.finished` | DNS check finished: {counts}. | Kontrola DNS dokončena: {counts}. | Kontrola DNS dokončená: {counts}. |
| `dns.diagnostics.run.timeout` | The check took longer than {seconds} seconds and was stopped. | Kontrola trvala déle než {seconds} sekund a byla zastavena. | Kontrola trvala dlhšie než {seconds} sekúnd a bola zastavená. |
| `dns.diagnostics.run.failed` | The DNS records could not be checked. | DNS záznamy se nepodařilo zkontrolovat. | DNS záznamy sa nepodarilo skontrolovať. |
| `dns.diagnostics.run.previous` | The result shown is from the previous check. | Zobrazený výsledek pochází z předchozí kontroly. | Zobrazený výsledok pochádza z predchádzajúcej kontroly. |
| `dns.diagnostics.run.remaining` | Checks left this minute: {count} | Zbývající kontroly v této minutě: {count} | Zostávajúce kontroly v tejto minúte: {count} |
| `dns.diagnostics.run.availableIn` | Available again in {time}. | Znovu dostupné za {time}. | Znova dostupné o {time}. |
| `dns.diagnostics.run.availableAgain` | Checking DNS is available again. | Kontrola DNS je opět dostupná. | Kontrola DNS je opäť dostupná. |
| `dns.mtaSts.sort.policyId` | Policy identifier | Identifikátor politiky | Identifikátor politiky |
| `dns.mtaSts.none` | No MTA-STS policy is set up for this domain. | Pro tuto doménu není nastavena žádná MTA-STS politika. | Pre túto doménu nie je nastavená žiadna MTA-STS politika. |
| `dns.mtaSts.loadFailed` | The MTA-STS policy could not be loaded. | MTA-STS politiku se nepodařilo načíst. | MTA-STS politiku sa nepodarilo načítať. |
| `dns.mtaSts.policyUrl` | Policy address | Adresa politiky | Adresa politiky |
| `dns.mtaSts.policyText` | Policy text | Text politiky | Text politiky |
| `dns.mtaSts.copyName` | Copy name of {record} | Kopírovat název {record} | Kopírovať názov {record} |
| `dns.mtaSts.copyValue` | Copy value of {record} | Kopírovat hodnotu {record} | Kopírovať hodnotu {record} |
| `dns.mtaSts.copyPolicyText` | Copy policy text of {domain} | Kopírovat text politiky pro {domain} | Kopírovať text politiky pre {domain} |
| `dns.mtaSts.updateRecord` | Update this record | Aktualizujte tento záznam | Aktualizujte tento záznam |
| `dns.mtaSts.idChanged` | The policy identifier changed from {previous} to {current}. Update the TXT record _mta-sts.{domain} in DNS to the new value. | Identifikátor politiky se změnil z {previous} na {current}. Aktualizujte v DNS TXT záznam _mta-sts.{domain} na novou hodnotu. | Identifikátor politiky sa zmenil z {previous} na {current}. Aktualizujte v DNS TXT záznam _mta-sts.{domain} na novú hodnotu. |
| `dns.mtaSts.certificateNotice` | The server requests the certificate for mta-sts.{domain} and the mta-sts. names of its alias domains at the next run of the certificate service, which can take up to one day. Both DNS records must be published. | Server si certifikát pro mta-sts.{domain} a názvy mta-sts. jejích doménových aliasů vyžádá při příštím běhu certifikační služby, což může trvat až jeden den. Oba DNS záznamy musí být zveřejněny. | Server si certifikát pre mta-sts.{domain} a názvy mta-sts. jej alias domén vyžiada pri ďalšom behu certifikačnej služby, čo môže trvať až jeden deň. Oba DNS záznamy musia byť zverejnené. |
| `dns.mtaSts.deactivate.title` | Deactivate the MTA-STS policy? | Deaktivovat MTA-STS politiku? | Deaktivovať MTA-STS politiku? |
| `dns.mtaSts.deactivate.body` | The policy of {domain} will no longer be published. Senders that cached it keep applying it for up to its max age. The certificate for its mta-sts. names will no longer be requested. | Politika domény {domain} přestane být zveřejňována. Odesílatelé, kteří ji mají v mezipaměti, ji budou uplatňovat až po dobu její maximální životnosti. Certifikát pro její názvy mta-sts. se již nebude vyžadovat. | Politika domény {domain} sa prestane zverejňovať. Odosielatelia, ktorí ju majú vo vyrovnávacej pamäti, ju budú uplatňovať až po dobu jej maximálnej platnosti. Certifikát pre jej názvy mta-sts. sa už nebude vyžadovať. |
| `dns.mtaSts.mxLength` | {used} of {max} characters | {used} z {max} znaků | {used} z {max} znakov |
| `dns.mtaSts.duplicateDropped` | {host} is listed twice and is kept once. | {host} je uveden dvakrát a zůstane jen jednou. | {host} je uvedený dvakrát a ponechá sa len raz. |
| `dns.mtaSts.alias.body` | The alias domain {aliasDomain} publishes the MTA-STS policy of its target domain {targetDomain}. | Doménový alias {aliasDomain} zveřejňuje MTA-STS politiku své cílové domény {targetDomain}. | Alias doména {aliasDomain} zverejňuje MTA-STS politiku svojej cieľovej domény {targetDomain}. |
| `dns.mtaSts.alias.link` | MTA-STS policy of {targetDomain} | MTA-STS politika domény {targetDomain} | MTA-STS politika domény {targetDomain} |
| `dns.mtaSts.list.count` | {count} policies | Politik: {count} | Politík: {count} |
| `dns.mtaSts.list.empty` | No MTA-STS policy is set up yet. Policies are set up on the page of a domain. | Zatím není nastavena žádná MTA-STS politika. Politiky se nastavují na stránce domény. | Zatiaľ nie je nastavená žiadna MTA-STS politika. Politiky sa nastavujú na stránke domény. |
