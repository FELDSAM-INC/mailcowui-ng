# New Czech and Slovak strings of UI 002 for review

The owner reviews these before the first release (UI 001 plan, owner question 4). They are the app's
own new strings (`src/i18n/messages/`) that UI 002 adds, written only for elements the classic
interface lacks (constitution IV 1.3.0, plan "Translations and forms"). Every other text of the
Domains section is mailcow's own translation, loaded verbatim from the installation at runtime, and
is not listed. Languages other than English, Czech and Slovak show the English text of these strings.
Generated on 2026-10-19 from the messages against UI main d128215; regenerate after changes rather
than editing by hand.

181 keys.

## Kept although a legacy key has the same English text

`npm run i18n:check` lists these for review. Each is kept for the reason given.

| Key | English | Why it stays a new string |
|---|---|---|
| `domains.delete.admins` | Domain administrators: {list} | A sentence with a placeholder; the legacy key is only a word of it, and a legacy string is never joined with other text. |
| `domains.delete.blockerMailboxes` | mailboxes ({count}) | A count in a sentence of the deletion preview; the legacy key is a column title. |
| `domains.delete.blockerResources` | resources ({count}) | A count in a sentence of the deletion preview; the legacy key is a column title. |
| `domains.fields.inUseCount` | {count} in use. | A sentence with a placeholder; `mailbox.in_use` is the "In use (%)" column title. |
| `domains.filters.title` | Filters | Legacy "Filters" are sieve filters. |
| `domains.filters.withCount` | Filters ({count}) | Legacy "Filters" are sieve filters. |
| `domains.footer.aliasDomainSubtext` | Alias-Domain | The classic footer tab writes "Alias-Domain" into the template; `add.alias_domain` reads "Alias domain". |
| `domains.footer.aliasSubtext` | Alias | The classic footer tab writes "Alias" into the template without a key. |
| `domains.list.details` | Details | `user.mailbox_details` means "mailbox details" in other languages. |
| `domains.list.messagesCount` | Messages: {count} | A sentence with a placeholder; `user.messages` is a lower-case word ("messages"). |
| `domains.rateLimit.value` | Messages | The accessible name of the rate limit number; `user.messages` is a lower-case word ("messages"). |

## All new strings

| Key | English | Czech | Slovak |
|---|---|---|---|
| `auditLog.chips.targetId` | Target: {id} | Cíl: {id} | Cieľ: {id} |
| `auditLog.filters.anyTargetType` | Any target type | Jakýkoli typ cíle | Akýkoľvek typ cieľa |
| `auditLog.filters.targetId` | Target | Cíl | Cieľ |
| `auditLog.filters.targetType` | Target type | Typ cíle | Typ cieľa |
| `bulk.actions` | Bulk actions | Hromadné akce | Hromadné akcie |
| `bulk.clear` | Clear selection | Zrušit výběr | Zrušiť výber |
| `bulk.confirm.typeCount` | Type {count} to confirm | Pro potvrzení zadejte {count} | Na potvrdenie zadajte {count} |
| `bulk.count.done` | {count} done | hotovo: {count} | hotovo: {count} |
| `bulk.count.failed` | {count} failed | selhalo: {count} | zlyhalo: {count} |
| `bulk.count.notFound` | {count} not found | nenalezeno: {count} | nenájdené: {count} |
| `bulk.count.notProcessed` | {count} not processed | nezpracováno: {count} | nespracované: {count} |
| `bulk.count.outdated` | {count} changed in the meantime | mezitím změněno: {count} | medzitým zmenené: {count} |
| `bulk.count.refused` | {count} refused | odmítnuto: {count} | odmietnuté: {count} |
| `bulk.count.skipped` | {count} skipped | přeskočeno: {count} | preskočené: {count} |
| `bulk.count.unknown` | {count} with unknown outcome | s neznámým výsledkem: {count} | s neznámym výsledkom: {count} |
| `bulk.exitSelection` | Done selecting | Ukončit výběr | Ukončiť výber |
| `bulk.limitReached` | You can select at most {max} items for one action. | Pro jednu akci můžete vybrat nejvýše {max} položek. | Pre jednu akciu môžete vybrať najviac {max} položiek. |
| `bulk.outcome.done` | Done | Hotovo | Hotovo |
| `bulk.outcome.failed` | Failed | Selhalo | Zlyhalo |
| `bulk.outcome.notFound` | Not found | Nenalezeno | Nenájdené |
| `bulk.outcome.notProcessed` | Not processed | Nezpracováno | Nespracované |
| `bulk.outcome.outdated` | Changed in the meantime | Mezitím změněno | Medzitým zmenené |
| `bulk.outcome.refused` | Refused | Odmítnuto | Odmietnuté |
| `bulk.outcome.skipped` | Skipped | Přeskočeno | Preskočené |
| `bulk.outcome.unknown` | Outcome unknown | Výsledek neznámý | Výsledok neznámy |
| `bulk.progress` | Processing {count} items… | Zpracovává se {count} položek… | Spracúva sa {count} položiek… |
| `bulk.retry` | Retry the failed ones | Zopakovat neúspěšné | Zopakovať neúspešné |
| `bulk.select` | Select | Vybrat | Vybrať |
| `bulk.selectAll` | Select all on this page | Vybrat vše na této stránce | Vybrať všetko na tejto stránke |
| `bulk.selectItem` | Select {name} | Vybrat {name} | Vybrať {name} |
| `bulk.selected` | {count} selected | Vybráno: {count} | Vybrané: {count} |
| `bulk.summary.announce` | Results: {counts}. | Výsledky: {counts}. | Výsledky: {counts}. |
| `bulk.summary.title` | Results | Výsledky | Výsledky |
| `common.back` | Back | Zpět | Späť |
| `domainTemplates.create.loadFailed` | The form could not be loaded. | Formulář se nepodařilo načíst. | Formulár sa nepodarilo načítať. |
| `domainTemplates.default` | Default | Výchozí | Predvolená |
| `domainTemplates.delete.changed` | The template changed in the meantime. Check it and confirm again. | Šablona se mezitím změnila. Zkontrolujte ji a potvrďte znovu. | Šablóna sa medzitým zmenila. Skontrolujte ju a potvrďte znova. |
| `domainTemplates.delete.keepValues` | Domains created from this template keep their values. \| Domains created from these templates keep their values. | Domény vytvořené z této šablony si své hodnoty ponechají. \| Domény vytvořené z těchto šablon si své hodnoty ponechají. | Domény vytvorené z tejto šablóny si svoje hodnoty ponechajú. \| Domény vytvorené z týchto šablón si svoje hodnoty ponechajú. |
| `domainTemplates.delete.notDeletedTitle` | {name} was not deleted | {name} nebyla smazána | {name} nebola odstránená |
| `domainTemplates.detail.backToList` | Back to the domain templates | Zpět na šablony domén | Späť na šablóny domén |
| `domainTemplates.detail.loadFailed` | The template could not be loaded. | Šablonu se nepodařilo načíst. | Šablónu sa nepodarilo načítať. |
| `domainTemplates.detail.loading` | Loading the template… | Načítání šablony… | Načítava sa šablóna… |
| `domainTemplates.edit.defaultName` | The Default template cannot be renamed. | Výchozí šablonu nelze přejmenovat. | Predvolenú šablónu nemožno premenovať. |
| `domainTemplates.edit.gone` | This template no longer exists. | Tato šablona už neexistuje. | Táto šablóna už neexistuje. |
| `domainTemplates.fields.id` | ID | ID | ID |
| `domainTemplates.list.count` | Templates found: {count} | Nalezené šablony: {count} | Nájdené šablóny: {count} |
| `domainTemplates.list.detailsOf` | Details of {name} | Podrobnosti {name} | Podrobnosti {name} |
| `domainTemplates.sort.id` | ID | ID | ID |
| `domains.bulk.adminRule` | Domain administrator accounts left without any domain are deleted. | Účty administrátorů domén, kterým nezůstane žádná doména, se smažou. | Účty administrátorov domén, ktorým nezostane žiadna doména, sa odstránia. |
| `domains.bulk.dataRule` | Footers, tags and stored mail are removed. DKIM keys are kept. | Patičky, štítky a uložená pošta se odstraní. Klíče DKIM zůstanou zachovány. | Pätičky, štítky a uložená pošta sa odstránia. Kľúče DKIM zostanú zachované. |
| `domains.bulk.deactivateEffect` | Every mailbox of these domains is affected: its users can no longer sign in, and the domains receive no mail. | Týká se to všech schránek těchto domén: jejich uživatelé se už nepřihlásí a domény nebudou přijímat poštu. | Týka sa to všetkých schránok týchto domén: ich používatelia sa už neprihlásia a domény nebudú prijímať poštu. |
| `domains.bulk.deactivateTitle` | Deactivate the selected domains ({count})? | Deaktivovat vybrané domény ({count})? | Deaktivovať vybrané domény ({count})? |
| `domains.bulk.deleteConfirm` | Delete domains | Smazat domény | Odstrániť domény |
| `domains.bulk.deleteIntro` | These domains are deleted. This cannot be undone. | Tyto domény se smažou. Nelze to vrátit zpět. | Tieto domény sa odstránia. Nemožno to vrátiť späť. |
| `domains.bulk.deleteTitle` | Delete the selected domains ({count})? | Smazat vybrané domény ({count})? | Odstrániť vybrané domény ({count})? |
| `domains.bulk.impactItem` | aliases: {aliases}, alias domains: {aliasDomains}, domain administrators: {admins} | aliasy: {aliases}, aliasy domény: {aliasDomains}, administrátoři domény: {admins} | aliasy: {aliases}, aliasy domény: {aliasDomains}, administrátori domény: {admins} |
| `domains.bulk.leaveRunning` | The action keeps running on the server, but its result will not be shown. | Akce na serveru dál běží, ale její výsledek se nezobrazí. | Akcia na serveri ďalej beží, ale jej výsledok sa nezobrazí. |
| `domains.bulk.leaveTitle` | Leave while the action runs? | Odejít, dokud akce běží? | Odísť, kým akcia beží? |
| `domains.bulk.progress` | Processing {count} domains… | Zpracovává se domén: {count}… | Spracúva sa domén: {count}… |
| `domains.bulk.skippedIntro` | Skipped, because they still have mailboxes or resources: | Přeskočeno, protože stále obsahují schránky nebo prostředky: | Preskočené, pretože stále obsahujú schránky alebo prostriedky: |
| `domains.bulk.skippedItem` | {name}: mailboxes ({mailboxes}), resources ({resources}) | {name}: schránky ({mailboxes}), prostředky ({resources}) | {name}: schránky ({mailboxes}), prostriedky ({resources}) |
| `domains.create.loadFailed` | The domain templates or the server settings could not be loaded. | Šablony domén nebo nastavení serveru se nepodařilo načíst. | Šablóny domén alebo nastavenia servera sa nepodarilo načítať. |
| `domains.delete.admins` | Domain administrators: {list} | Administrátoři domény: {list} | Administrátori domény: {list} |
| `domains.delete.adminsKept` | No domain administrator account is deleted. | Žádný účet administrátora domény se nesmaže. | Žiadny účet administrátora domény sa neodstráni. |
| `domains.delete.adminsToDelete` | These domain administrator accounts are deleted, because they are left without a domain: {list} | Tyto účty administrátorů domény se smažou, protože jim nezůstane žádná doména: {list} | Tieto účty administrátorov domény sa odstránia, pretože im nezostane žiadna doména: {list} |
| `domains.delete.aliasDomains` | Alias domains removed: {list} | Odstraní se aliasy domény: {list} | Odstránia sa aliasy domény: {list} |
| `domains.delete.aliases` | Aliases removed: {count} | Odstraní se aliasy: {count} | Odstránia sa aliasy: {count} |
| `domains.delete.blockedTitle` | {name} cannot be deleted | Doménu {name} nelze smazat | Doménu {name} nemožno odstrániť |
| `domains.delete.blockerMailboxes` | mailboxes ({count}) | schránky ({count}) | schránky ({count}) |
| `domains.delete.blockerResources` | resources ({count}) | prostředky ({count}) | prostriedky ({count}) |
| `domains.delete.blockersIntro` | Remove these first: | Nejprve odstraňte: | Najprv odstráňte: |
| `domains.delete.changed` | The domain was changed in the meantime. Check the impact again. | Doména se mezitím změnila. Zkontrolujte dopad znovu. | Doména sa medzitým zmenila. Skontrolujte dopad znova. |
| `domains.delete.confirm` | Delete domain | Smazat doménu | Odstrániť doménu |
| `domains.delete.data` | The tags and the stored mail of the domain are removed. | Štítky a uložená pošta domény se odstraní. | Štítky a uložená pošta domény sa odstránia. |
| `domains.delete.dkimKept` | The DKIM key is kept. | Klíč DKIM zůstane zachován. | Kľúč DKIM zostane zachovaný. |
| `domains.delete.footer` | The footer is removed. | Patička se odstraní. | Pätička sa odstráni. |
| `domains.delete.gone` | This domain no longer exists. | Tato doména již neexistuje. | Táto doména už neexistuje. |
| `domains.delete.intro` | Deleting the domain cannot be undone. | Smazání domény nelze vrátit zpět. | Odstránenie domény nemožno vrátiť späť. |
| `domains.delete.noAdmins` | No domain administrator is assigned. | Doména nemá přiřazeného administrátora. | Doména nemá priradeného administrátora. |
| `domains.delete.notDeleted` | Nothing was deleted. | Nic nebylo smazáno. | Nič sa neodstránilo. |
| `domains.delete.notDeletedTitle` | {name} was not deleted | Doména {name} nebyla smazána | Doména {name} nebola odstránená |
| `domains.delete.showAliases` | Show the aliases | Zobrazit aliasy | Zobraziť aliasy |
| `domains.delete.title` | Delete {name}? | Smazat doménu {name}? | Odstrániť doménu {name}? |
| `domains.delete.typeName` | Type the domain name {name} to confirm | Pro potvrzení zadejte název domény {name} | Na potvrdenie zadajte názov domény {name} |
| `domains.delete.unavailable` | To delete this domain, first remove its mailboxes ({mailboxes}) and resources ({resources}). | Ke smazání domény nejprve odstraňte její schránky ({mailboxes}) a prostředky ({resources}). | Na odstránenie domény najprv odstráňte jej schránky ({mailboxes}) a prostriedky ({resources}). |
| `domains.detail.backToList` | Back to the domains | Zpět na domény | Späť na domény |
| `domains.detail.loadFailed` | The domain could not be loaded. | Doménu se nepodařilo načíst. | Doménu sa nepodarilo načítať. |
| `domains.detail.loading` | Loading the domain… | Načítá se doména… | Načítava sa doména… |
| `domains.edit.gone` | This domain no longer exists or is no longer available to you. | Tato doména již neexistuje nebo vám již není dostupná. | Táto doména už neexistuje alebo vám už nie je dostupná. |
| `domains.edit.notSaved` | Nothing was saved. | Nic nebylo uloženo. | Nič sa neuložilo. |
| `domains.empty.clearAll` | Clear search and filters | Vymazat hledání a filtry | Vymazať hľadanie a filtre |
| `domains.fields.inUseCount` | {count} in use. | Využito: {count}. | Využité: {count}. |
| `domains.filters.active` | Active state | Stav aktivace | Stav aktivácie |
| `domains.filters.all` | All | Vše | Všetky |
| `domains.filters.clear` | Clear all filters | Vymazat všechny filtry | Vymazať všetky filtre |
| `domains.filters.filterByTag` | Filter by tag {tag} | Filtrovat podle štítku {tag} | Filtrovať podľa štítku {tag} |
| `domains.filters.localOnly` | Other domains | Ostatní domény | Ostatné domény |
| `domains.filters.relay` | Relay | Předávání | Preposielanie |
| `domains.filters.relayOnly` | Relay domains | Předávané domény | Preposielané domény |
| `domains.filters.tagsHint` | Shows domains with any of these tags. | Zobrazí domény s kterýmkoli z těchto štítků. | Zobrazí domény s ktorýmkoľvek z týchto štítkov. |
| `domains.filters.title` | Filters | Filtry | Filtre |
| `domains.filters.withCount` | Filters ({count}) | Filtry ({count}) | Filtre ({count}) |
| `domains.footer.aliasDomainSubtext` | Alias-Domain | Alias-Domain | Alias-Domain |
| `domains.footer.aliasSubtext` | Alias | Alias | Alias |
| `domains.list.actionsFor` | Actions for {name} | Akce pro {name} | Akcie pre {name} |
| `domains.list.clearSearch` | Clear search | Vymazat hledání | Vymazať hľadanie |
| `domains.list.count` | Domains found: {count} | Nalezené domény: {count} | Nájdené domény: {count} |
| `domains.list.details` | Details | Podrobnosti | Podrobnosti |
| `domains.list.detailsOf` | Details of {name} | Podrobnosti domény {name} | Podrobnosti domény {name} |
| `domains.list.messagesCount` | Messages: {count} | Zprávy: {count} | Správy: {count} |
| `domains.list.moreTags` | +{count} | +{count} | +{count} |
| `domains.list.moreTagsLabel` | and {count} more tags | a další štítky ({count}) | a ďalšie štítky ({count}) |
| `domains.list.refreshFailed` | The list could not be refreshed. The results shown may be out of date. | Seznam se nepodařilo obnovit. Zobrazené výsledky mohou být zastaralé. | Zoznam sa nepodarilo obnoviť. Zobrazené výsledky môžu byť zastarané. |
| `domains.list.updating` | Updating… | Aktualizuje se… | Aktualizuje sa… |
| `domains.outcome.dkimDnsFailed` | The DKIM record of {0} could not be published in DNS. | Záznam DKIM pro {0} se nepodařilo zveřejnit v DNS. | Záznam DKIM pre {0} sa nepodarilo zverejniť v DNS. |
| `domains.outcome.dkimDnsNoZone` | No DNS zone found for {0}: publish the DKIM record at the domain's DNS provider. | Pro {0} nebyla nalezena zóna DNS: zveřejněte záznam DKIM u poskytovatele DNS domény. | Pre {0} sa nenašla zóna DNS: zverejnite záznam DKIM u poskytovateľa DNS domény. |
| `domains.outcome.rateLimitFailed` | The rate limit of {0} could not be saved. | Limit odesílání pro {0} se nepodařilo uložit. | Limit odosielania pre {0} sa nepodarilo uložiť. |
| `domains.rateLimit.frameLabel` | Time frame | Časový úsek | Časový úsek |
| `domains.rateLimit.value` | Messages | Zprávy | Správy |
| `domains.relay.short.relayUnknownOnly` | Relay non-existing mailboxes only | Předávat jen neexistující schránky | Preposielať len neexistujúce schránky |
| `domains.sort.asc` | Ascending | Vzestupně | Vzostupne |
| `domains.sort.desc` | Descending | Sestupně | Zostupne |
| `domains.sort.label` | Sort by | Řadit podle | Zoradiť podľa |
| `domains.sort.order` | Order | Pořadí | Poradie |
| `domains.sort.storageUsed` | Storage used | Využité úložiště | Využité úložisko |
| `domains.tags.remove` | Remove tag {tag} | Odebrat štítek {tag} | Odobrať štítok {tag} |
| `domains.tags.suggestions` | Suggested tags | Navrhované štítky | Navrhované štítky |
| `domains.tags.suggestionsLoading` | Loading suggestions… | Načítají se návrhy… | Načítavajú sa návrhy… |
| `domains.tags.suggestionsUnavailable` | Suggestions unavailable | Návrhy nejsou k dispozici | Návrhy nie sú k dispozícii |
| `domains.tags.tooLong` | Tags may have at most {max} characters. | Štítky mohou mít nejvýše {max} znaků. | Štítky môžu mať najviac {max} znakov. |
| `domains.usage.left` | {count} left | Zbývá: {count} | Zostáva: {count} |
| `domains.usage.nearlyFull` | Nearly full | Téměř plné | Takmer plné |
| `domains.usage.of` | {used} of {limit} | {used} z {limit} | {used} z {limit} |
| `domains.usage.over` | Over the limit | Nad limitem | Nad limitom |
| `domains.values.no` | No | Ne | Nie |
| `domains.values.none` | None | Žádné | Žiadne |
| `domains.values.rateLimit` | {value} {frame} | {value} {frame} | {value} {frame} |
| `domains.values.yes` | Yes | Ano | Áno |
| `enums.auditEventType.domainCreation` | Domain added | Doména přidána | Doména pridaná |
| `enums.auditEventType.domainDeletion` | Domain removed | Doména odebrána | Doména odstránená |
| `enums.auditEventType.domainFooterUpdate` | Domain footer changed | Patička domény změněna | Pätička domény zmenená |
| `enums.auditEventType.domainTemplateCreation` | Domain template added | Šablona domény přidána | Šablóna domény pridaná |
| `enums.auditEventType.domainTemplateDeletion` | Domain template removed | Šablona domény odebrána | Šablóna domény odstránená |
| `enums.auditEventType.domainTemplateUpdate` | Domain template changed | Šablona domény změněna | Šablóna domény zmenená |
| `enums.auditEventType.domainUpdate` | Domain changed | Doména změněna | Doména zmenená |
| `enums.auditFailureReason.attributeNotPermitted` | Change not permitted | Změna není povolena | Zmena nie je povolená |
| `enums.auditFailureReason.conflict` | Conflict with existing data | Konflikt s existujícími daty | Konflikt s existujúcimi údajmi |
| `enums.auditFailureReason.temporaryFailure` | Temporary failure | Dočasná chyba | Dočasná chyba |
| `enums.auditFailureReason.validationFailed` | Invalid values | Neplatné hodnoty | Neplatné hodnoty |
| `enums.auditFailureReason.versionOutdated` | Changed in the meantime | Mezitím změněno | Medzitým zmenené |
| `enums.auditTargetType.domainTemplate` | Domain template | Šablona domény | Šablóna domény |
| `history.link` | History | Historie | História |
| `leaveGuard.body` | Your changes will be lost. | Vaše změny budou ztraceny. | Vaše zmeny sa stratia. |
| `leaveGuard.leave` | Leave | Odejít | Odísť |
| `leaveGuard.stay` | Stay | Zůstat | Zostať |
| `leaveGuard.title` | Leave without saving? | Odejít bez uložení? | Odísť bez uloženia? |
| `problem.attribute-not-permitted` | You may not change: {attributes}. Your other input is kept. | Nemůžete měnit: {attributes}. Vaše ostatní zadání zůstalo zachováno. | Nemôžete meniť: {attributes}. Vaše ostatné zadanie zostalo zachované. |
| `problem.domain-exists` | A domain or alias domain with this name already exists. | Doména nebo alias domény s tímto názvem již existuje. | Doména alebo alias domény s týmto názvom už existuje. |
| `problem.domain-not-empty` | The domain still has {mailboxes} mailboxes and {resources} resources. Remove them first. | Doména stále obsahuje schránky ({mailboxes}) a prostředky ({resources}). Nejprve je odstraňte. | Doména stále obsahuje schránky ({mailboxes}) a prostriedky ({resources}). Najprv ich odstráňte. |
| `problem.domain-template-name-exists` | A domain template with this name already exists. | Šablona domény s tímto názvem již existuje. | Šablóna domény s týmto názvom už existuje. |
| `problem.domain-template-protected` | The Default template cannot be renamed or deleted. | Výchozí šablonu nelze přejmenovat ani smazat. | Predvolenú šablónu nemožno premenovať ani odstrániť. |
| `problem.temporary-failure` | Nothing was changed, because a server component is temporarily unavailable. Please try again in a moment. | Nic nebylo změněno, protože část serveru je dočasně nedostupná. Zkuste to prosím za chvíli znovu. | Nič sa nezmenilo, pretože časť servera je dočasne nedostupná. Skúste to prosím o chvíľu znova. |
| `sections.discard` | Discard my changes | Zahodit mé změny | Zahodiť moje zmeny |
| `sections.edit` | Edit | Upravit | Upraviť |
| `sections.editDisabled` | Finish editing {section} first. | Nejprve dokončete úpravy sekce {section}. | Najprv dokončite úpravy sekcie {section}. |
| `sections.editNamed` | Edit {section} | Upravit: {section} | Upraviť: {section} |
| `sections.outdated.body` | Someone changed this section while you were editing. Your input is kept. These values changed: | Někdo tuto sekci změnil, zatímco jste ji upravovali. Vaše zadání zůstalo zachováno. Změnily se tyto hodnoty: | Niekto túto sekciu zmenil, kým ste ju upravovali. Vaše zadanie zostalo zachované. Zmenili sa tieto hodnoty: |
| `sections.outdated.savedAs` | {field}: now saved as {value} | {field}: nyní uloženo jako {value} | {field}: teraz uložené ako {value} |
| `sections.outdated.title` | Changed elsewhere | Změněno jinde | Zmenené inde |
| `sections.save` | Save | Uložit | Uložiť |
| `sections.saveAgain` | Save again | Uložit znovu | Uložiť znova |
| `sections.saving` | Saving… | Ukládá se… | Ukladá sa… |
| `validation.belowInUse` | This is below what is in use: {inUse}. | Hodnota je nižší, než je využito: {inUse}. | Hodnota je nižšia, než je využité: {inUse}. |
| `validation.format.dkimSelector` | Use only letters, digits, hyphens, underscores and dots. | Použijte jen písmena, číslice, pomlčky, podtržítka a tečky. | Použite iba písmená, číslice, pomlčky, podčiarkovníky a bodky. |
| `validation.format.domainName` | Enter a valid domain name, for example example.org. | Zadejte platný název domény, například example.org. | Zadajte platný názov domény, napríklad example.org. |
| `validation.format.email` | Enter a valid email address. | Zadejte platnou e-mailovou adresu. | Zadajte platnú e-mailovú adresu. |
| `validation.immutable` | This value cannot be changed. | Tuto hodnotu nelze změnit. | Túto hodnotu nemožno zmeniť. |
| `validation.mustNotExceed` | This may not be higher than {field} ({value}). | Hodnota nesmí být vyšší než {field} ({value}). | Hodnota nesmie byť vyššia ako {field} ({value}). |
| `validation.notMultipleOf` | Enter a whole multiple of {factor}. | Zadejte celý násobek {factor}. | Zadajte celý násobok {factor}. |
| `validation.reserved` | This name is reserved by the server. | Tento název je vyhrazen serveru. | Tento názov je vyhradený pre server. |
| `validation.tooLongBytes` | This text may be at most {max} long. | Text smí mít nejvýše {max}. | Text môže mať najviac {max}. |
