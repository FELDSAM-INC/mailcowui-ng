# Quickstart and Validation Guide: UI Feature 008

**Feature**: `specs/008-sync-jobs` | **Plan**: [plan.md](./plan.md) |
**Contract**: [contracts/README.md](./contracts/README.md)

This guide proves the sync job screens work. Part A runs the automated gates, Part B gives manual
checks per user story against the mock API, Part C runs the smoke suite against a real
mailcow-rest-v2 dev stack, and Part D checks a mailcow host. The setup, the commands and the
fixtures are UI 001's ([UI 001 quickstart](../001-sign-in-app-shell/quickstart.md)); only what is
specific to sync jobs is repeated here.

## Prerequisites

- UI 001 to UI 007 implemented (research R2 lists the parts UI 008 builds on), and the pinned
  contract at or after the baseline of [contracts/README.md](./contracts/README.md).
- For Part C: the mailcow-rest-v2 dev stack at the pinned commit, with API 008 implemented and its
  development seeder extended (API 008 task T066): `alice@example.org` with the sync-jobs flag and
  jobs #1 (never run) and #2 (failed, wrong username or password, with a log), `dave@example.org`
  without the flag, `carol@example.net` with job #3, and `reseller` with the flag. Every password
  is `Passw0rd!dev`; alice's TOTP secret is `JBSWY3DPEHPK3PXP`.

## Part A: Automated gates

```bash
npm run contract:check     # pinned bundle intact; the 9 sync-job operations present
npm run lint && npm run typecheck
npm run i18n:check         # syncJobs.* complete in en-gb, cs-cz, sk-sk; SyncJobEncryption,
                           # SyncJobLastResult, SyncJobBulkAction and validation.format.hostName covered
npm run test:unit -- tests/unit/features/sync-jobs
npm run build && npm run budget:check   # initial JS unchanged; prints the sync-jobs chunks
npm run test:e2e -- tests/e2e/sync-jobs  # mobile-chromium, desktop-chromium, mobile-webkit
```

**Expected**:

- Every command exits with 0.
- `test:e2e` reports every `US1-AS*` to `US6-AS*` test of this feature and its `Edge:` tests passing
  on both viewports, with no axe violation in either theme, no CSP violation and no mock contract
  violation.
- `log-performance.spec.ts` (Chromium only) opens the 5 MB log in under 3 s with 4× CPU
  throttling, and scrolling to its end records no long task over 200 ms (SC-007).
- `password-secrecy.spec.ts` finds the marker password only in the `createSyncJob` and
  `updateSyncJob` request bodies (SC-003).
- `budget:check` shows the initial JavaScript unchanged and the three sync-job page chunks plus the
  log viewer under 25 KB gzipped together.

## Part B: Manual checks per user story (mock API)

Start `npm run preview:mock`, open `http://localhost:4173/ng/`, and pick a scenario with
`npm run mock:scenario -- <name>` (scenarios in [data-model.md §8](./data-model.md#8-mock-scenarios-testsmocksscenariossync-jobsts)).
Check each screen at 360 px and on a desktop, in both themes.

| Story | Scenario | Steps | Expected (spec reference) |
|---|---|---|---|
| US1 | `sync-jobs-admin` | Open Sync jobs; filter "Last result: failed"; sort by last run; reload; open a job | Cards at 360 px, a table on desktop; failed jobs read their legacy reason or "Check log" with icons and text; "Waiting" for jobs without a last run (plan, "Legacy form map, part 3", item 1); the filter and sort survive the reload; the job page shows the run status and the job's one section (US1-AS1, AS2, AS5, AS6, AS8; FR-010, FR-015) |
| US1 | `sync-jobs-domain-admin` | Open Sync jobs | Only `example.org` jobs (US1-AS3) |
| US1 | `sync-jobs-user` | Sign in state as alice; open Sync jobs | Only alice's two jobs, no target mailbox column or filter (US1-AS4) |
| US1 | `sync-jobs-running` | Open the list and wait 30 s; finish the run with the "Finish a run" change of [data-model §8](./data-model.md#runtime-changes-patch-__mockscenariosid) | The running job updates by itself; "Pause automatic refresh" stops it (FR-014) |
| US1 | `sync-jobs-domain-admin-no-flag` | Open `/ng/sync-jobs` | No navigation entry; "not permitted" in place (FR-001, FR-003) |
| US2 | `sync-jobs-admin` | Add sync job at 360 px; pick a mailbox by typing; switch encryption to STARTTLS; enter an IPv6 host and submit | One form in legacy order with the defaults filled; port changes 993 → 143; the host error appears on the field in the chosen language and focus moves to the summary (US2-AS1, AS2, AS7; FR-019) |
| US2 | `sync-jobs-user-restricted-params` | Add sync job | No target choice (own mailbox shown), no custom parameters field (US2-AS3; FR-056) |
| US3 | `sync-jobs-admin` | Open a job, choose Edit, change the interval, save; edit again, type a new password, save; edit again | Only the interval is sent; the password is sent once; the password field is empty again with "A password is saved" (US3-AS1 to AS3) |
| US3 | `sync-jobs-admin` | Choose Edit, then apply the "Change elsewhere" change of data-model §8, save | "Changed in the meantime", input kept, changed values marked, save again works (US3-AS5) |
| US4 | `sync-jobs-bulk` | Select three jobs, one of them the injected failure, Activate | One bulk request; summary "2 activated, 1 failed: …"; the failed job stays selected (US4-AS3) |
| US5 | `sync-jobs-admin` | Open "Check log" on a failed job at 360 px; switch wrapping off; Copy; press Back | Full-screen log; only the log area scrolls sideways; "Copied" announced; Back closes the log (US5-AS1 to AS3) |
| US6 | `sync-jobs-admin` | Delete one job and cancel; delete it; select three and delete | The dialog names source and target and says copied mail stays; focus returns on cancel; the bulk dialog lists three jobs and needs "3" typed (US6-AS1 to AS3) |
| Entry | `sync-jobs-admin` | Open a mailbox in Mailboxes; choose "Sync jobs" | The list opens filtered to that mailbox (FR-004) |

## Part C: Smoke suite against a real mailcow-rest-v2 dev stack

```bash
export MAILCOW_REST_V2_DIR=../mailcow-rest-v2
scripts/smoke/stack-up.sh
npm run test:smoke -- tests/smoke/sync-jobs.smoke.spec.ts
scripts/smoke/stack-down.sh
```

**Expected**: `sync-jobs.smoke.spec.ts` passes for:

- alice (with TOTP): sees jobs #1 and #2 but not #3; #2 reads "Wrong username or password" and its
  log opens as text; creates a job, sees the "already exists" message with a link when repeating
  it, edits its interval, deactivates and activates it, and deletes it (mailbox users have no
  "Schedule next", as the classic user tab);
- dave: no Sync jobs entry, "No access" at `/ng/sync-jobs`;
- reseller: sees the jobs of its two domains, `example.org` and `example.net`;
- admin: creates two jobs for alice through the mailbox picker, deactivates and activates both in
  one bulk action, deletes both with the typed count, and opens alice's mailbox → Sync jobs.

Every job the suite creates is deleted at the end, so the seeded data stays as it was.

## Part D: On a mailcow host

With mailcowui-ng deployed as UI 001's quickstart Part D describes, sign in as an administrator,
open a mailbox that has a sync job created in the classic interface, follow "Sync jobs", and check
that the job, its last result and its log match the classic interface. Change the interval in the
new app and confirm the classic interface shows the change after a reload (spec Assumptions).

## Validation log

Record here, after implementation (tasks T076, T078 and T079):

- SC-001: time to identify every failed job in a list of 50 on a mid-range phone (target < 15 s);
- SC-002: time for a first-time user to create a job with defaults on a phone (target < 1 min);
- SC-007: the 5 MB log on a mid-range phone (target < 3 s, no visible stalls);
- a screen-reader pass of every user story with VoiceOver on iOS and TalkBack on Android.

### Results (2026-10-19)

- **Bundle (T076)**, `npm run build && npm run budget:check` on `wt/008` rebased onto main
  `f02acc5`:
  - Initial JavaScript: 176,623 bytes gzipped, against 175,721 on main (+902 bytes, 0.5 % of the
    200 KB budget). The growth is the three route records with their loader wrapper, the feature's
    string loaders, and the `LEGACY_TEXTS` and `LEGACY_ARGS` entries of the problem lookup, which
    the shell needs before a sync job screen loads. `src/app/navigation/visibility.ts` became its own
    0.2 KB chunk because the lazy sync job code shares it. The feature's strings are not in the
    shell: they load with the routes (`src/i18n/messages/sync-jobs/`, 1.3 KB en-gb, 1.6 KB cs-cz,
    1.6 KB sk-sk).
  - Sync job chunks: `SyncJobsPage` 10.7 KB, `SyncJobDetailPage` 4.5 KB, `SyncJobCreatePage`
    2.4 KB and `SyncJobLogDialog` 2.8 KB, 20.4 KB together (target under 25 KB).
- **Smoke suite (T079)**: `scripts/smoke/stack-up.sh` with the API at the pinned `33f1eea`, as its own
  Compose project (`SMOKE_PROJECT=ui008-smoke`, `SMOKE_WEB_PORT=18580`) so that other stacks on the
  machine were not touched, then `npm run test:smoke` in the Playwright image: the six tests of
  `sync-jobs.smoke.spec.ts` passed, and the whole smoke suite passed (32 of 32). Two test fixes came
  out of the run: dave's test waits for the sign-in to finish, and the edit test waits for the save
  before it reloads; the suite's time limit is 120 s because alice's sign-in may wait up to 30 s for
  an unused TOTP step.
- **Devices (T078)**: not run. No mid-range Android phone or iPhone was available to the
  implementing agent, so SC-001, SC-002, SC-007 on a phone and the VoiceOver and TalkBack passes are
  still open. The automated stand-ins passed: the end-to-end suite on the two mobile projects
  (360 px Chromium with touch, WebKit), axe in both themes, and `log-performance.spec.ts` with 4×
  CPU throttling.

## Strings for review

The owner reviews the new Czech and Slovak strings before release (plan, owner question 1;
SC-005). They were written by hand, never machine-translated. 67 new strings: 56 under `syncJobs.*`
(in `src/i18n/messages/sync-jobs/`), and the two enum groups, the audit labels and the host name
rule (`enums.*`, `validation.format.hostName`). The three encryption names are the protocol names
and read the same in every language. Legacy texts are mailcow's own and are not listed.

| Key | en-gb | cs-cz | sk-sk |
|---|---|---|---|
| `enums.auditEventType.syncJobCreation` | Sync job added | Synchronizační úloha přidána | Synchronizačná úloha pridaná |
| `enums.auditEventType.syncJobDeletion` | Sync job removed | Synchronizační úloha odstraněna | Synchronizačná úloha odstránená |
| `enums.auditEventType.syncJobReschedule` | Sync job rescheduled | Synchronizační úloha naplánována znovu | Synchronizačná úloha naplánovaná znova |
| `enums.auditEventType.syncJobUpdate` | Sync job changed | Synchronizační úloha změněna | Synchronizačná úloha zmenená |
| `enums.auditTargetType.syncJob` | Sync job | Synchronizační úloha | Synchronizačná úloha |
| `validation.format.hostName` | Enter a host name or an IPv4 address. | Zadejte název hostitele nebo adresu IPv4. | Zadajte názov hostiteľa alebo adresu IPv4. |
| `syncJobs.columns.id` | ID | ID | ID |
| `syncJobs.columns.log` | Log | Záznam | Záznam |
| `syncJobs.columns.minutes` | (min) | (min) | (min) |
| `syncJobs.columns.server` | Server | Server | Server |
| `syncJobs.detail.backToList` | Back to the sync jobs | Zpět na synchronizační úlohy | Späť na synchronizačné úlohy |
| `syncJobs.detail.gone` | This sync job no longer exists. | Tato synchronizační úloha již neexistuje. | Táto synchronizačná úloha už neexistuje. |
| `syncJobs.detail.loadFailed` | The sync job could not be loaded. | Synchronizační úlohu se nepodařilo načíst. | Synchronizačnú úlohu sa nepodarilo načítať. |
| `syncJobs.detail.loading` | Loading the sync job… | Načítání synchronizační úlohy… | Načítava sa synchronizačná úloha… |
| `syncJobs.filters.any` | Any | Libovolné | Ľubovoľné |
| `syncJobs.filters.clear` | Clear filters | Vymazat filtry | Vymazať filtre |
| `syncJobs.filters.title` | Filters | Filtry | Filtre |
| `syncJobs.filters.withCount` | Filters ({count}) | Filtry ({count}) | Filtre ({count}) |
| `syncJobs.filters.chip` | {filter}: {value} | {filter}: {value} | {filter}: {value} |
| `syncJobs.form.customParamsRestricted` | Only administrators may set custom parameters on this server. | Vlastní parametry smějí na tomto serveru nastavovat jen administrátoři. | Vlastné parametre smú na tomto serveri nastavovať len administrátori. |
| `syncJobs.form.errors.customParameters.customParamsNotPermitted` | Only administrators may set custom parameters on this server. | Vlastní parametry smějí na tomto serveru nastavovat jen administrátoři. | Vlastné parametre smú na tomto serveri nastavovať len administrátori. |
| `syncJobs.form.errors.customParameters.optionContainsSpace` | Write “{token}” as --option=value, without spaces. | Zapište „{token}“ jako --volba=hodnota, bez mezer. | Zapíšte „{token}“ ako --voľba=hodnota, bez medzier. |
| `syncJobs.form.errors.customParameters.optionNotAllowed` | The option --{option} is not allowed on this server. | Volba --{option} není na tomto serveru povolena. | Voľba --{option} nie je na tomto serveri povolená. |
| `syncJobs.form.errors.exclude.invalidRegex` | This is not a valid regular expression. | Toto není platný regulární výraz. | Toto nie je platný regulárny výraz. |
| `syncJobs.form.errors.mailbox.notEligible.kind.alias` | This address is an alias and cannot receive synced mail. | Tato adresa je alias a nemůže přijímat synchronizovanou poštu. | Táto adresa je alias a nemôže prijímať synchronizovanú poštu. |
| `syncJobs.form.errors.mailbox.notEligible.kind.aliasDomainAddress` | This address belongs to an alias domain and cannot receive synced mail. | Tato adresa patří k aliasové doméně a nemůže přijímat synchronizovanou poštu. | Táto adresa patrí k aliasovej doméne a nemôže prijímať synchronizovanú poštu. |
| `syncJobs.form.errors.mailbox.notEligible.kind.resource` | This address is a resource and cannot receive synced mail. | Tato adresa je prostředek a nemůže přijímat synchronizovanou poštu. | Táto adresa je prostriedok a nemôže prijímať synchronizovanú poštu. |
| `syncJobs.form.openExisting` | Open the existing job | Otevřít existující úlohu | Otvoriť existujúcu úlohu |
| `syncJobs.list.actionsFor` | Actions for {name} | Akce pro {name} | Akcie pre {name} |
| `syncJobs.list.clearAll` | Clear search and filters | Vymazat hledání a filtry | Vymazať hľadanie a filtre |
| `syncJobs.list.count` | Sync jobs found: {count} | Nalezené synchronizační úlohy: {count} | Nájdené synchronizačné úlohy: {count} |
| `syncJobs.list.detailsOf` | Details of {name} | Podrobnosti o {name} | Podrobnosti o {name} |
| `syncJobs.list.refreshFailed` | The list could not be refreshed. The sync jobs shown may be out of date. | Seznam se nepodařilo obnovit. Zobrazené synchronizační úlohy nemusí být aktuální. | Zoznam sa nepodarilo obnoviť. Zobrazené synchronizačné úlohy nemusia byť aktuálne. |
| `syncJobs.password.keep` | Leave the field empty to keep it. | Ponecháte-li pole prázdné, heslo zůstane zachováno. | Ak pole necháte prázdne, heslo zostane zachované. |
| `syncJobs.password.none` | No password is saved. | Žádné heslo není uloženo. | Žiadne heslo nie je uložené. |
| `syncJobs.password.saved` | A password is saved. | Heslo je uloženo. | Heslo je uložené. |
| `syncJobs.refresh.inactive` | Automatic refresh paused because you have been inactive. | Automatické obnovování bylo pozastaveno, protože jste byli neaktivní. | Automatické obnovovanie bolo pozastavené, pretože ste boli neaktívni. |
| `syncJobs.refresh.pause` | Pause automatic refresh | Pozastavit automatické obnovování | Pozastaviť automatické obnovovanie |
| `syncJobs.refresh.paused` | Automatic refresh is paused. | Automatické obnovování je pozastaveno. | Automatické obnovovanie je pozastavené. |
| `syncJobs.refresh.resume` | Resume automatic refresh | Obnovit automatické obnovování | Pokračovať v automatickom obnovovaní |
| `syncJobs.refresh.running` | While a sync job is running, this list refreshes every 30 seconds. | Dokud běží synchronizační úloha, tento seznam se obnovuje každých 30 sekund. | Kým beží synchronizačná úloha, tento zoznam sa obnovuje každých 30 sekúnd. |
| `syncJobs.result.failed` | Failed: | Neúspěšné: | Neúspešné: |
| `syncJobs.result.succeeded` | Succeeded: | Úspěšné: | Úspešné: |
| `syncJobs.running.note` | The run in progress is not interrupted and finishes on its own. | Probíhající běh se nepřeruší a dokončí se sám. | Prebiehajúci beh sa nepreruší a dokončí sa sám. |
| `syncJobs.sort.asc` | Ascending | Vzestupně | Vzostupne |
| `syncJobs.sort.desc` | Descending | Sestupně | Zostupne |
| `syncJobs.sort.label` | Sort by | Řadit podle | Zoradiť podľa |
| `syncJobs.sort.order` | Order | Pořadí | Poradie |
| `syncJobs.create.loadFailed` | The form could not be loaded. | Formulář se nepodařilo načíst. | Formulár sa nepodarilo načítať. |
| `syncJobs.bulk.deactivateTitle` | Deactivate {count} sync jobs? | Deaktivovat synchronizační úlohy ({count})? | Deaktivovať synchronizačné úlohy ({count})? |
| `syncJobs.bulk.deactivateNote` | They do not run until they are activated again. | Nespustí se, dokud je znovu neaktivujete. | Nespustia sa, kým ich znova neaktivujete. |
| `syncJobs.bulk.listLabel` | Selected sync jobs | Vybrané synchronizační úlohy | Vybrané synchronizačné úlohy |
| `syncJobs.delete.mailKept` | Mail that was already copied stays in the mailbox. | Již zkopírovaná pošta ve schránce zůstane. | Už skopírovaná pošta v schránke zostane. |
| `syncJobs.log.title` | Log | Záznam | Záznam |
| `syncJobs.log.region` | Log of {name} | Záznam úlohy {name} | Záznam úlohy {name} |
| `syncJobs.log.copy` | Copy | Kopírovat | Kopírovať |
| `syncJobs.log.copied` | The log was copied. | Záznam byl zkopírován. | Záznam bol skopírovaný. |
| `syncJobs.log.copyRefused` | Copying is not available. Select the text to copy it. | Kopírování není k dispozici. Označte text a zkopírujte ho. | Kopírovanie nie je k dispozícii. Označte text a skopírujte ho. |
| `syncJobs.log.wrap` | Wrap lines | Zalamovat řádky | Zalamovať riadky |
| `syncJobs.log.never` | No log yet. | Zatím žádný záznam. | Zatiaľ žiadny záznam. |
| `syncJobs.log.noOutput` | The run produced no output. | Běh nevytvořil žádný výstup. | Beh nevytvoril žiadny výstup. |
| `syncJobs.log.running` | A run is in progress. This is the log of the previous run. | Právě probíhá běh. Toto je záznam předchozího běhu. | Práve prebieha beh. Toto je záznam predchádzajúceho behu. |
| `enums.syncJobEncryption.plain` | PLAIN | PLAIN | PLAIN |
| `enums.syncJobEncryption.ssl` | SSL | SSL | SSL |
| `enums.syncJobEncryption.starttls` | STARTTLS | STARTTLS | STARTTLS |
| `enums.syncJobLastResult.failed` | Failed | Neúspěšné | Neúspešné |
| `enums.syncJobLastResult.unknown` | No result | Bez výsledku | Bez výsledku |
