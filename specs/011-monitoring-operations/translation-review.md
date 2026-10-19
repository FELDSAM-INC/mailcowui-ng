# New strings of UI feature 011 for native review

These are the new strings that UI 011 adds in en-gb, cs-cz and sk-sk (constitution IV, docs/conventions.md
"New strings"). Everything else on the feature's screens is mailcow's own text by its legacy key (plan.md
"Legacy form map (T010a)"). The Czech and Slovak values were written by hand for the owner's review;
none is machine-translated. Texts equal to a classic-interface literal (log names, column titles such as
"IP", "Msg ID" or "RegExp", "OK", "Already running") keep legacy's English wording.

The screen strings are in `src/i18n/messages/operations*/`, loaded with the routes; the problem,
validation and audit labels are in the main files. `operations.logs.types.ui` takes the product name from
the branding.

`npm run i18n:check` lists eight of them as close to a legacy text; none has the same meaning, so none
is replaced: `operations.dashboard.version` and `operations.updates.version` ("Version", the installed
mailcow version; `admin.iam_version` is Keycloak's version and `edit.mta_sts_version` the MTA-STS
policy's), `operations.fail2ban.allowlist`, `denylist` and `denylistTitle` (legacy's lowercase ban
actions; `user.spamfilter_wl`/`_bl` name the spam filter's lists), `operations.rspamd.columns.to`
("To" is a recipient; `admin.dkim_to` is a DKIM copy target), and `operations.rspamd.count` and
`messages` ("messages" as a count; `user.messages` is a mailbox's message count label).

156 keys.

| Key | en-gb | cs-cz | sk-sk |
|---|---|---|---|
| `auditLog.details.showAll` | Show all {count} | Zobrazit všech {count} | Zobraziť všetkých {count} |
| `enums.auditEventType.containerRestart` | Container restarted | Kontejner restartován | Kontajner reštartovaný |
| `enums.auditEventType.containerStart` | Container started | Kontejner spuštěn | Kontajner spustený |
| `enums.auditEventType.containerStop` | Container stopped | Kontejner zastaven | Kontajner zastavený |
| `enums.auditEventType.fail2banBanAllowlisting` | Network unbanned and allowlisted | Síť odblokována a povolena | Sieť odblokovaná a povolená |
| `enums.auditEventType.fail2banBanDenylisting` | Network denylisted | Síť zakázána | Sieť zakázaná |
| `enums.auditEventType.fail2banBanLift` | Network unbanned | Síť odblokována | Sieť odblokovaná |
| `enums.auditEventType.fail2banBanListIdRotation` | Banlist ID refreshed | ID seznamu blokací obnoveno | ID zoznamu blokovaní obnovené |
| `enums.auditEventType.fail2banRulesReplacement` | Fail2ban regex filters changed | Regex filtry Fail2banu změněny | Regex filtre Fail2banu zmenené |
| `enums.auditEventType.fail2banRulesReset` | Fail2ban regex filters reset | Regex filtry Fail2banu obnoveny na výchozí | Regex filtre Fail2banu obnovené na predvolené |
| `enums.auditEventType.fail2banSettingsUpdate` | Fail2ban parameters changed | Parametry Fail2banu změněny | Parametre Fail2banu zmenené |
| `enums.auditEventType.mailQueueDeletion` | Queued messages deleted | Zprávy ve frontě smazány | Správy vo fronte zmazané |
| `enums.auditEventType.mailQueueDelivery` | Delivery of queued messages requested | Vyžádáno doručení zpráv ve frontě | Vyžiadané doručenie správ vo fronte |
| `enums.auditEventType.mailQueueFlush` | Mail queue flushed | Fronta pošty vyprázdněna | Fronta pošty vyprázdnená |
| `enums.auditEventType.mailQueueHold` | Queued messages held | Zprávy ve frontě podrženy | Správy vo fronte podržané |
| `enums.auditEventType.mailQueueMessageView` | Queued message viewed | Zobrazena zpráva ve frontě | Zobrazená správa vo fronte |
| `enums.auditEventType.mailQueuePurge` | All queued messages deleted | Všechny zprávy ve frontě smazány | Všetky správy vo fronte zmazané |
| `enums.auditEventType.mailQueueRelease` | Queued messages released | Zprávy ve frontě uvolněny | Správy vo fronte uvoľnené |
| `enums.auditFailureReason.rulesNotRestored` | Default regex filters were not restored in time | Výchozí regex filtry se včas neobnovily | Predvolené regex filtre sa včas neobnovili |
| `enums.auditFailureReason.serviceFailure` | The container service or Postfix reported an error | Služba kontejnerů nebo Postfix ohlásily chybu | Služba kontajnerov alebo Postfix ohlásili chybu |
| `enums.auditTargetType.container` | Container | Kontejner | Kontajner |
| `enums.auditTargetType.fail2banActiveBan` | Active ban | Aktivní blokace | Aktívne blokovanie |
| `enums.auditTargetType.fail2banBanListId` | Banlist ID | ID seznamu blokací | ID zoznamu blokovaní |
| `enums.auditTargetType.mailQueue` | Mail queue | Fronta pošty | Fronta pošty |
| `enums.auditTargetType.mailQueueMessage` | Queued message | Zpráva ve frontě | Správa vo fronte |
| `operations.charts.diskIo` | Disk I/O | Disk I/O | Disk I/O |
| `operations.charts.hideTable` | Hide the table | Skrýt tabulku | Skryť tabuľku |
| `operations.charts.netIo` | Net I/O | Síť I/O | Sieť I/O |
| `operations.charts.read` | Read | Čtení | Čítanie |
| `operations.charts.recv` | Recv | Příjem | Príjem |
| `operations.charts.sent` | Sent | Odesláno | Odoslané |
| `operations.charts.showTable` | Show the values as a table | Zobrazit hodnoty jako tabulku | Zobraziť hodnoty ako tabuľku |
| `operations.charts.summary` | {series}: {value} now, from {min} to {max} in the last {count} samples | {series}: nyní {value}, za posledních {count} měření od {min} do {max} | {series}: teraz {value}, za posledných {count} meraní od {min} do {max} |
| `operations.charts.write` | Write | Zápis | Zápis |
| `operations.containers.alreadyRunning` | Already running | Již běží | Už beží |
| `operations.containers.announce` | {name}: {outcome} | {name}: {outcome} | {name}: {outcome} |
| `operations.containers.collapse` | Hide details of {name} | Skrýt podrobnosti: {name} | Skryť podrobnosti: {name} |
| `operations.containers.elapsed` | {seconds} s | {seconds} s | {seconds} s |
| `operations.containers.expand` | Show details of {name} | Zobrazit podrobnosti: {name} | Zobraziť podrobnosti: {name} |
| `operations.containers.noResourceData` | No resource data is available while the container is not running. | Dokud kontejner neběží, nejsou k dispozici žádné údaje o jeho prostředcích. | Kým kontajner nebeží, nie sú k dispozícii žiadne údaje o jeho prostriedkoch. |
| `operations.containers.notRunning` | Not running | Neběží | Nebeží |
| `operations.containers.ok` | OK | OK | OK |
| `operations.containers.starting` | Starting container, this may take a while | Spouští se kontejner, může to chvilku trvat | Prebieha spúšťanie kontajnera, čakajte prosím |
| `operations.containers.stopNow` | Stop now | Zastavit nyní | Zastaviť teraz |
| `operations.containers.stopTitle` | Stop container | Zastavit kontejner | Zastaviť kontajner |
| `operations.containers.stopping` | Stopping container, this may take a while | Zastavuje se kontejner, může to chvilku trvat | Prebieha zastavovanie kontajnera, čakajte prosím |
| `operations.copy` | Copy | Kopírovat | Kopírovať |
| `operations.copyRefused` | Copying is not available here. Select the text to copy it. | Kopírování zde není dostupné. Text vyberte a zkopírujte ručně. | Kopírovanie tu nie je dostupné. Text vyberte a skopírujte ručne. |
| `operations.dashboard.cpu` | CPU | CPU | CPU |
| `operations.dashboard.ips` | IPs | IP adresy | IP adresy |
| `operations.dashboard.sectionError` | This section could not be loaded. | Tuto část se nepodařilo načíst. | Túto časť sa nepodarilo načítať. |
| `operations.dashboard.unavailable` | Unavailable | Nedostupné | Nedostupné |
| `operations.dashboard.version` | Version | Verze | Verzia |
| `operations.enums.containerAction.start` | Start | Spustit | Spustiť |
| `operations.enums.containerAction.stop` | Stop | Zastavit | Zastaviť |
| `operations.fail2ban.allowlist` | allowlist | na seznam povolení | na zoznam povolených |
| `operations.fail2ban.banEnded` | This ban has already ended. | Tato blokace už skončila. | Toto blokovanie už skončilo. |
| `operations.fail2ban.banlistUrl` | Banlist url | Adresa seznamu blokací | Adresa zoznamu blokovaní |
| `operations.fail2ban.denylist` | denylist | na seznam zákazů | na zoznam zakázaných |
| `operations.fail2ban.denylistTitle` | Denylist {network}? | Přidat {network} na seznam zákazů? | Pridať {network} na zoznam zakázaných? |
| `operations.fail2ban.line` | Line {line} | Řádek {line} | Riadok {line} |
| `operations.fail2ban.notRunning` | The ban service is not running. Saved changes take effect, and queued unbans are processed, once it runs. | Služba blokování neběží. Uložené změny se projeví a čekající odblokování se zpracují, jakmile poběží. | Služba blokovania nebeží. Uložené zmeny sa prejavia a čakajúce odblokovania sa spracujú, keď bude bežať. |
| `operations.fail2ban.ownAddress` | This entry covers your own address {address}. You could lock yourself out. | Tato položka pokrývá i vaši vlastní adresu {address}. Mohli byste se zablokovat. | Táto položka pokrýva aj vašu vlastnú adresu {address}. Mohli by ste sa zablokovať. |
| `operations.fail2ban.remaining` | {hours}h {minutes}m {seconds}s | {hours}h {minutes}m {seconds}s | {hours}h {minutes}m {seconds}s |
| `operations.fail2ban.rotate` | Refresh banlist ID | Obnovit ID seznamu blokací | Obnoviť ID zoznamu blokovaní |
| `operations.fail2ban.rotateBody` | The current banlist URL stops working at once. | Současná adresa seznamu blokací okamžitě přestane fungovat. | Súčasná adresa zoznamu blokovaní okamžite prestane fungovať. |
| `operations.fail2ban.ruleId` | ID | ID | ID |
| `operations.fail2ban.ruleRegexp` | RegExp | RegExp | RegExp |
| `operations.live.containerStopped` | {name} is no longer running. | {name} už neběží. | {name} už nebeží. |
| `operations.live.failed` | Updating failed. The values shown may be out of date. | Aktualizace se nezdařila. Zobrazené hodnoty nemusí být aktuální. | Aktualizácia zlyhala. Zobrazené hodnoty nemusia byť aktuálne. |
| `operations.live.inactive` | Live updates were paused because there was no activity. | Průběžné aktualizace byly pozastaveny, protože jste delší dobu nebyli aktivní. | Priebežné aktualizácie boli pozastavené, pretože ste dlhší čas neboli aktívni. |
| `operations.live.pause` | Pause live updates | Pozastavit průběžné aktualizace | Pozastaviť priebežné aktualizácie |
| `operations.live.paused` | Live updates paused since {time}. | Průběžné aktualizace jsou pozastaveny od {time}. | Priebežné aktualizácie sú pozastavené od {time}. |
| `operations.live.resume` | Resume live updates | Obnovit průběžné aktualizace | Obnoviť priebežné aktualizácie |
| `operations.live.unavailable` | Live updates are off because the monitoring settings could not be read. | Průběžné aktualizace jsou vypnuté, protože se nepodařilo načíst nastavení monitorování. | Priebežné aktualizácie sú vypnuté, pretože sa nepodarilo načítať nastavenia monitorovania. |
| `operations.logs.autodiscover.activesync` | ActiveSync | ActiveSync | ActiveSync |
| `operations.logs.autodiscover.imap` | IMAP, SMTP, Cal-/CardDAV | IMAP, SMTP, Cal-/CardDAV | IMAP, SMTP, Cal-/CardDAV |
| `operations.logs.columns.call` | Call | Volání | Volanie |
| `operations.logs.columns.data` | Data | Data | Dáta |
| `operations.logs.columns.hash` | Hash | Hash | Hash |
| `operations.logs.columns.headerFrom` | Header From | Hlavička From | Hlavička From |
| `operations.logs.columns.ip` | IP | IP | IP |
| `operations.logs.columns.messageId` | Msg ID | ID zprávy | ID správy |
| `operations.logs.columns.method` | Method | Metoda | Metóda |
| `operations.logs.columns.role` | Role | Role | Rola |
| `operations.logs.columns.trend` | Trend | Trend | Trend |
| `operations.logs.columns.uri` | URI | URI | URI |
| `operations.logs.columns.user` | User | Uživatel | Používateľ |
| `operations.logs.columns.userAgent` | User-Agent | User-Agent | User-Agent |
| `operations.logs.healthLevel` | Health level: {level}% ({now}/{total}) | Úroveň zdraví: {level} % ({now}/{total}) | Úroveň zdravia: {level} % ({now}/{total}) |
| `operations.logs.more100` | + 100 | + 100 | + 100 |
| `operations.logs.more1000` | + 1000 | + 1000 | + 1000 |
| `operations.logs.noHash` | err | err | err |
| `operations.logs.none` | none | žádný | žiadny |
| `operations.logs.sort.asc` | Ascending | Vzestupně | Vzostupne |
| `operations.logs.sort.desc` | Descending | Sestupně | Zostupne |
| `operations.logs.types.acme` | ACME | ACME | ACME |
| `operations.logs.types.api` | API | API | API |
| `operations.logs.types.autodiscover` | Autodiscover | Autodiscover | Autodiscover |
| `operations.logs.types.crontasks` | Crontasks | Crontasks | Crontasks |
| `operations.logs.types.dovecot` | Dovecot | Dovecot | Dovecot |
| `operations.logs.types.netfilter` | Netfilter | Netfilter | Netfilter |
| `operations.logs.types.postfix` | Postfix | Postfix | Postfix |
| `operations.logs.types.ratelimits` | Ratelimits | Ratelimits | Ratelimits |
| `operations.logs.types.rspamd` | Rspamd | Rspamd | Rspamd |
| `operations.logs.types.sasl` | SASL | SASL | SASL |
| `operations.logs.types.sogo` | SOGo | SOGo | SOGo |
| `operations.logs.types.ui` | {productName} UI | {productName} UI | {productName} UI |
| `operations.logs.types.watchdog` | Watchdog | Watchdog | Watchdog |
| `operations.logs.unavailable` | This log is temporarily unavailable. | Tento záznam je dočasně nedostupný. | Tento záznam je dočasne nedostupný. |
| `operations.logs.unknown` | unknown | neznámý | neznámy |
| `operations.notRecorded` | The action was carried out, but no audit record was written. | Akce byla provedena, ale do protokolu auditu se nezapsal žádný záznam. | Akcia bola vykonaná, ale do protokolu auditu sa nezapísal žiadny záznam. |
| `operations.queue.messageGone` | This message is no longer in the queue. | Tato zpráva už ve frontě není. | Táto správa už vo fronte nie je. |
| `operations.queue.moreRecipients` | + {count} more | + {count} další | + {count} ďalší |
| `operations.queue.openContainer` | Show {container} on the dashboard | Zobrazit {container} na přehledu | Zobraziť {container} na prehľade |
| `operations.queue.purgeAcknowledge` | I understand that all queued messages, including held ones, are deleted permanently | Beru na vědomí, že všechny zprávy ve frontě včetně podržených budou trvale smazány | Beriem na vedomie, že všetky správy vo fronte vrátane podržaných budú natrvalo zmazané |
| `operations.queue.purgeCount` | {count} messages are queued, including held ones. | Ve frontě je {count} zpráv včetně podržených. | Vo fronte je {count} správ vrátane podržaných. |
| `operations.queue.qid` | QID | QID | QID |
| `operations.queue.queue` | Queue | Fronta | Fronta |
| `operations.queue.showRest` | Show the rest ({size}) | Zobrazit zbytek ({size}) | Zobraziť zvyšok ({size}) |
| `operations.queue.truncated` | Only the first {max} messages are listed. Flushing the queue and deleting all messages affect every queued message. | Zobrazuje se jen prvních {max} zpráv. Vyprázdnění fronty a smazání všech zpráv se týká každé zprávy ve frontě. | Zobrazuje sa len prvých {max} správ. Vyprázdnenie fronty a zmazanie všetkých správ sa týka každej správy vo fronte. |
| `operations.queue.viewAudited` | Each view of a message is recorded in the audit log. | Každé zobrazení zprávy se zapisuje do protokolu auditu. | Každé zobrazenie správy sa zapisuje do protokolu auditu. |
| `operations.queue.viewerTitle` | ID {id} | ID {id} | ID {id} |
| `operations.rspamd.above` | above the required score | nad požadovaným skóre | nad požadovaným skóre |
| `operations.rspamd.below` | below the required score | pod požadovaným skóre | pod požadovaným skóre |
| `operations.rspamd.columns.id` | ID | ID | ID |
| `operations.rspamd.columns.ip` | IP address | IP adresa | IP adresa |
| `operations.rspamd.columns.scanTime` | Scan Time | Doba kontroly | Čas kontroly |
| `operations.rspamd.columns.size` | Msg size | Velikost zprávy | Veľkosť správy |
| `operations.rspamd.columns.symbols` | Symbols | Symboly | Symboly |
| `operations.rspamd.columns.to` | To | Komu | Komu |
| `operations.rspamd.columns.user` | Authenticated user | Ověřený uživatel | Overený používateľ |
| `operations.rspamd.count` | {count} messages | Zprávy: {count} | Správy: {count} |
| `operations.rspamd.messages` | Messages | Zprávy | Správy |
| `operations.rspamd.noneScanned` | No messages were scanned yet. | Zatím nebyly zkontrolovány žádné zprávy. | Zatiaľ neboli skontrolované žiadne správy. |
| `operations.rspamd.share` | Share | Podíl | Podiel |
| `operations.rspamd.sort.label` | Sort by | Řadit podle | Zoradiť podľa |
| `operations.rspamd.sort.order` | Order | Pořadí | Poradie |
| `operations.rspamd.summary` | Most messages ({percent}) got the action {action}. | Nejvíce zpráv ({percent}) dostalo akci {action}. | Najviac správ ({percent}) dostalo akciu {action}. |
| `operations.rspamd.title` | Rspamd history | Historie Rspamd | História Rspamd |
| `operations.rspamd.unavailable` | Rspamd cannot be reached right now. | Rspamd teď není dostupný. | Rspamd teraz nie je dostupný. |
| `operations.updates.githubLink` | Github Link: | Odkaz na GitHub: | Odkaz na GitHub: |
| `operations.updates.image` | Image: {description} | Obrázek: {description} | Obrázok: {description} |
| `operations.updates.imageUntitled` | Image | Obrázek | Obrázok |
| `operations.updates.newRelease` | New Release {tag} | Nové vydání {tag} | Nové vydanie {tag} |
| `operations.updates.notesFailed` | The release notes could not be loaded. | Poznámky k vydání se nepodařilo načíst. | Poznámky k vydaniu sa nepodarilo načítať. |
| `operations.updates.version` | Version {tag} | Verze {tag} | Verzia {tag} |
| `problem.container-action-failed` | Error: {serviceMessage} | Chyba: {serviceMessage} | Chyba: {serviceMessage} |
| `problem.container-not-running` | The container is not running. | Kontejner neběží. | Kontajner nebeží. |
| `problem.container-protected` | This container is protected and cannot be stopped from this app. | Tento kontejner je chráněný a v této aplikaci jej nelze zastavit. | Tento kontajner je chránený a v tejto aplikácii ho nemožno zastaviť. |
| `problem.mail-service-not-running` | The Postfix container {container} is not running. | Kontejner Postfixu {container} neběží. | Kontajner Postfixu {container} nebeží. |
| `problem.queue-action-failed` | Error: {serviceMessage} | Chyba: {serviceMessage} | Chyba: {serviceMessage} |
| `validation.format.logCursor` | This position in the log is no longer valid. Refresh the log. | Toto místo v záznamu už neplatí. Obnovte záznam. | Toto miesto v zázname už neplatí. Obnovte záznam. |
| `validation.invalidRegex` | This is not a valid regular expression. | Toto není platný regulární výraz. | Toto nie je platný regulárny výraz. |
| `validation.missingCaptureGroup` | The rule needs a capture group for the client address. | Pravidlo potřebuje zachytávací skupinu pro adresu klienta. | Pravidlo potrebuje zachytávaciu skupinu pre adresu klienta. |
| `validation.outOfRangeMinField` | Enter a value from {min} ({field}) to {max}. | Zadejte hodnotu od {min} ({field}) do {max}. | Zadajte hodnotu od {min} ({field}) do {max}. |
