# New Czech and Slovak strings of UI 001 for review

The owner reviews these before the first release (plan, owner question 4). They are the
hand-written app layer (`src/i18n/messages/`). Strings reused from the legacy translations
(`src/i18n/legacy/`) were reviewed upstream and are not listed. Generated for T151; regenerate
after changes rather than editing by hand.

416 keys.

| Key | English | Czech | Slovak |
|---|---|---|---|
| `a11y.appsMenu` | {label} menu | Nabídka {label} | Ponuka {label} |
| `a11y.closeNavigation` | Close navigation | Zavřít navigaci | Zavrieť navigáciu |
| `a11y.errorPrefix` | Error: | Chyba: | Chyba: |
| `a11y.mainNavigation` | Main navigation | Hlavní navigace | Hlavná navigácia |
| `a11y.morePages` | More pages | Další stránky | Ďalšie strany |
| `a11y.nextPage` | Next page | Další stránka | Ďalšia stránka |
| `a11y.openNavigation` | Open navigation | Otevřít navigaci | Otvoriť navigáciu |
| `a11y.pagination` | Pagination | Stránkování | Stránkovanie |
| `a11y.previousPage` | Previous page | Předchozí stránka | Predchádzajúca stránka |
| `a11y.skipToContent` | Skip to main content | Přeskočit na hlavní obsah | Preskočiť na hlavný obsah |
| `a11y.userMenu` | Account menu of {username} | Nabídka účtu {username} | Ponuka účtu {username} |
| `apiKeys.anyAddress` | Any address | Libovolná adresa | Ľubovoľná adresa |
| `apiKeys.columns.access` | Access | Přístup | Prístup |
| `apiKeys.columns.createdAt` | Created | Vytvořeno | Vytvorené |
| `apiKeys.columns.expiresAt` | Expires | Platnost do | Platnosť do |
| `apiKeys.columns.lastUsedAt` | Last used | Naposledy použito | Naposledy použité |
| `apiKeys.columns.name` | Name | Název | Názov |
| `apiKeys.columns.owner` | Owner | Vlastník | Vlastník |
| `apiKeys.columns.prefix` | Prefix | Předpona | Predpona |
| `apiKeys.columns.status` | Status | Stav | Stav |
| `apiKeys.create.action` | Create API key | Vytvořit klíč API | Vytvoriť kľúč API |
| `apiKeys.create.created` | The API key has been created. | Klíč API byl vytvořen. | Kľúč API bol vytvorený. |
| `apiKeys.create.intro` | The key acts with its owner's role and permissions. Its secret is shown only once, right after it is created. | Klíč jedná s rolí a oprávněními svého vlastníka. Jeho tajný údaj se zobrazí jen jednou, hned po vytvoření. | Kľúč koná s rolou a oprávneniami svojho vlastníka. Jeho tajný údaj sa zobrazí len raz, hneď po vytvorení. |
| `apiKeys.create.submit` | Create API key | Vytvořit klíč API | Vytvoriť kľúč API |
| `apiKeys.create.submitting` | Creating… | Vytváření… | Vytváranie… |
| `apiKeys.create.title` | Create API key | Vytvořit klíč API | Vytvoriť kľúč API |
| `apiKeys.detail.back` | Back to API keys | Zpět na klíče API | Späť na kľúče API |
| `apiKeys.detail.notEditable` | Keys cannot be edited. To change the access, networks or expiry, create a new key and revoke this one. | Klíče nelze upravovat. Chcete-li změnit přístup, sítě nebo platnost, vytvořte nový klíč a tento zrušte. | Kľúče nemožno upravovať. Ak chcete zmeniť prístup, siete alebo platnosť, vytvorte nový kľúč a tento zrušte. |
| `apiKeys.detail.notFound.body` | This API key does not exist. | Tento klíč API neexistuje. | Tento kľúč API neexistuje. |
| `apiKeys.detail.notFound.title` | API key not found | Klíč API nebyl nalezen | Kľúč API sa nenašiel |
| `apiKeys.docs` | API documentation | Dokumentace API | Dokumentácia API |
| `apiKeys.empty.body` | API keys let other programs, such as a billing system, use this API on behalf of an administrator or a domain administrator. Create one key for each program, so that each can be revoked on its own. | Klíče API umožňují jiným programům, například fakturačnímu systému, používat toto API jménem správce nebo správce domény. Pro každý program vytvořte samostatný klíč, aby šel zrušit zvlášť. | Kľúče API umožňujú iným programom, napríklad fakturačnému systému, používať toto API v mene správcu alebo správcu domény. Pre každý program vytvorte samostatný kľúč, aby sa dal zrušiť zvlášť. |
| `apiKeys.empty.filtered` | No API keys match the filters. | Filtrům neodpovídá žádný klíč API. | Filtrom nezodpovedá žiadny kľúč API. |
| `apiKeys.empty.title` | No API keys yet | Zatím žádné klíče API | Zatiaľ žiadne kľúče API |
| `apiKeys.expiry.custom` | On a specific date and time | K určitému datu a času | K určitému dátumu a času |
| `apiKeys.expiry.customLabel` | Expiry date and time | Datum a čas konce platnosti | Dátum a čas konca platnosti |
| `apiKeys.expiry.days30` | In 30 days | Za 30 dní | O 30 dní |
| `apiKeys.expiry.days365` | In 365 days | Za 365 dní | O 365 dní |
| `apiKeys.expiry.days90` | In 90 days | Za 90 dní | O 90 dní |
| `apiKeys.expiry.never` | Never expires | Bez omezení platnosti | Bez obmedzenia platnosti |
| `apiKeys.fields.access` | Access | Přístup | Prístup |
| `apiKeys.fields.allowedNetworks` | Allowed networks | Povolené sítě | Povolené siete |
| `apiKeys.fields.created` | Created | Vytvořeno | Vytvorené |
| `apiKeys.fields.createdBy` | Created by | Vytvořil | Vytvoril |
| `apiKeys.fields.expires` | Expires | Platnost do | Platnosť do |
| `apiKeys.fields.lastUsed` | Last used | Naposledy použito | Naposledy použité |
| `apiKeys.fields.owner` | Owner | Vlastník | Vlastník |
| `apiKeys.fields.prefix` | Prefix | Předpona | Predpona |
| `apiKeys.fields.revoked` | Revoked | Zrušeno | Zrušené |
| `apiKeys.fields.revokedBy` | Revoked by | Zrušil | Zrušil |
| `apiKeys.fields.status` | Status | Stav | Stav |
| `apiKeys.filters.access` | Access | Přístup | Prístup |
| `apiKeys.filters.allAccessLevels` | All access levels | Všechny úrovně přístupu | Všetky úrovne prístupu |
| `apiKeys.filters.allStatuses` | All statuses | Všechny stavy | Všetky stavy |
| `apiKeys.filters.clear` | Clear filters | Zrušit filtry | Zrušiť filtre |
| `apiKeys.filters.owner` | Owner | Vlastník | Vlastník |
| `apiKeys.filters.ownerHint` | Choose an owner, or type a username and press Enter. | Vyberte vlastníka, nebo napište uživatelské jméno a stiskněte Enter. | Vyberte vlastníka alebo napíšte používateľské meno a stlačte Enter. |
| `apiKeys.filters.sort` | Sort by | Řadit podle | Zoradiť podľa |
| `apiKeys.filters.status` | Status | Stav | Stav |
| `apiKeys.filters.title` | Filters | Filtry | Filtre |
| `apiKeys.form.access` | Access | Přístup | Prístup |
| `apiKeys.form.accessHint.readOnly` | A read-only key can read data. A read-only key cannot change anything. | Klíč jen pro čtení může číst data. Klíč jen pro čtení nemůže nic měnit. | Kľúč len na čítanie môže čítať údaje. Kľúč len na čítanie nemôže nič meniť. |
| `apiKeys.form.accessHint.readWrite` | A read-write key can also create, change and delete data. | Klíč pro čtení i zápis může data také vytvářet, měnit a mazat. | Kľúč na čítanie aj zápis môže údaje aj vytvárať, meniť a mazať. |
| `apiKeys.form.expiry` | Expiry | Platnost | Platnosť |
| `apiKeys.form.name` | Name | Název | Názov |
| `apiKeys.form.nameHint` | A name that tells you which program uses the key. | Název, podle kterého poznáte, který program klíč používá. | Názov, podľa ktorého spoznáte, ktorý program kľúč používa. |
| `apiKeys.form.networks` | Allowed networks | Povolené sítě | Povolené siete |
| `apiKeys.form.networksHint` | Leave empty to allow any address. Otherwise enter IPv4 or IPv6 addresses or networks, for example 192.0.2.0/24. | Ponechte prázdné, chcete-li povolit libovolnou adresu. Jinak zadejte adresy nebo sítě IPv4 či IPv6, například 192.0.2.0/24. | Nechajte prázdne, ak chcete povoliť ľubovoľnú adresu. Inak zadajte adresy alebo siete IPv4 či IPv6, napríklad 192.0.2.0/24. |
| `apiKeys.form.owner` | Owner | Vlastník | Vlastník |
| `apiKeys.form.ownerHint` | The key acts with this account's role and permissions. A key owned by a domain administrator is limited to that administrator's domains and permissions. | Klíč jedná s rolí a oprávněními tohoto účtu. Klíč vlastněný správcem domény je omezen na domény a oprávnění tohoto správce. | Kľúč koná s rolou a oprávneniami tohto účtu. Kľúč vlastnený správcom domény je obmedzený na domény a oprávnenia tohto správcu. |
| `apiKeys.intro` | Keys for other programs that use this API, such as billing systems. | Klíče pro jiné programy, které používají toto API, například fakturační systémy. | Kľúče pre iné programy, ktoré používajú toto API, napríklad fakturačné systémy. |
| `apiKeys.lastUsedFrom` | from {address} | z adresy {address} | z adresy {address} |
| `apiKeys.networks.add` | Add a network | Přidat síť | Pridať sieť |
| `apiKeys.networks.entry` | Allowed network {number} | Povolená síť {number} | Povolená sieť {number} |
| `apiKeys.networks.limit` | At most {max} networks. | Nejvýše {max} sítí. | Najviac {max} sietí. |
| `apiKeys.networks.remove` | Remove network {number} | Odebrat síť {number} | Odobrať sieť {number} |
| `apiKeys.neverExpires` | Never | Nikdy | Nikdy |
| `apiKeys.neverUsed` | Never used | Nikdy nepoužito | Nikdy nepoužité |
| `apiKeys.owner.deleted` | Deleted account | Smazaný účet | Zmazaný účet |
| `apiKeys.owner.unusable` | The owner is deactivated or deleted, so this key cannot be used. | Vlastník je deaktivován nebo smazán, proto tento klíč nelze použít. | Vlastník je deaktivovaný alebo zmazaný, preto tento kľúč nemožno použiť. |
| `apiKeys.ownerPicker.error` | The accounts could not be loaded. | Účty se nepodařilo načíst. | Účty sa nepodarilo načítať. |
| `apiKeys.ownerPicker.loadMore` | Load more | Načíst další | Načítať ďalšie |
| `apiKeys.ownerPicker.noMatch` | No administrators or domain administrators match. | Žádný správce ani správce domény neodpovídá. | Nezodpovedá žiadny správca ani správca domény. |
| `apiKeys.ownerPicker.searching` | Searching… | Hledání… | Hľadanie… |
| `apiKeys.revoke.action` | Revoke key | Zrušit klíč | Zrušiť kľúč |
| `apiKeys.revoke.body` | Programs using this key stop working immediately. Revocation cannot be undone. | Programy, které tento klíč používají, okamžitě přestanou fungovat. Zrušení nelze vrátit. | Programy, ktoré tento kľúč používajú, okamžite prestanú fungovať. Zrušenie nemožno vrátiť. |
| `apiKeys.revoke.done` | The key has been revoked. | Klíč byl zrušen. | Kľúč bol zrušený. |
| `apiKeys.revoke.title` | Revoke {name}? | Zrušit {name}? | Zrušiť {name}? |
| `apiKeys.secret.description` | Copy the secret of “{name}” now and store it safely, for example in the program's settings. | Zkopírujte nyní tajný údaj klíče „{name}“ a bezpečně jej uložte, například do nastavení programu. | Skopírujte teraz tajný údaj kľúča „{name}“ a bezpečne ho uložte, napríklad do nastavení programu. |
| `apiKeys.secret.title` | Your new API key | Váš nový klíč API | Váš nový kľúč API |
| `apiKeys.sorts.createdAt_asc` | Oldest first | Od nejstarších | Od najstarších |
| `apiKeys.sorts.createdAt_desc` | Newest first | Od nejnovějších | Od najnovších |
| `apiKeys.sorts.expiresAt_asc` | Expiry, soonest first | Platnost, nejdříve končící | Platnosť, najskôr končiace |
| `apiKeys.sorts.expiresAt_desc` | Expiry, latest first | Platnost, nejpozději končící | Platnosť, najneskôr končiace |
| `apiKeys.sorts.lastUsedAt_asc` | Last used, least recently first | Naposledy použito, nejdávněji | Naposledy použité, najdávnejšie |
| `apiKeys.sorts.lastUsedAt_desc` | Last used, most recently first | Naposledy použito, nejnověji | Naposledy použité, najnovšie |
| `apiKeys.sorts.name_asc` | Name, A to Z | Název, A až Z | Názov, A až Z |
| `apiKeys.sorts.name_desc` | Name, Z to A | Název, Z až A | Názov, Z až A |
| `apiKeys.title` | API keys | Klíče API | Kľúče API |
| `auditLog.actor.apiKey` | API key {id} | API klíč {id} | API kľúč {id} |
| `auditLog.actor.apiKeyOf` | API key {id} of {username} | API klíč {id} uživatele {username} | API kľúč {id} používateľa {username} |
| `auditLog.actor.attempted` | {username} (attempted) | {username} (pokus) | {username} (pokus) |
| `auditLog.actor.unknown` | Unknown actor | Neznámý aktér | Neznámy aktér |
| `auditLog.actor.withRole` | {username} ({role}) | {username} ({role}) | {username} ({role}) |
| `auditLog.chips.actor` | User or key: {value} | Uživatel nebo klíč: {value} | Používateľ alebo kľúč: {value} |
| `auditLog.chips.address` | Address: {value} | Adresa: {value} | Adresa: {value} |
| `auditLog.chips.clearAll` | Clear all filters | Zrušit všechny filtry | Zrušiť všetky filtre |
| `auditLog.chips.custom` | {from} to {to} | {from} až {to} | {from} až {to} |
| `auditLog.chips.label` | Active filters | Aktivní filtry | Aktívne filtre |
| `auditLog.chips.remove` | Remove filter: {filter} | Odebrat filtr: {filter} | Odobrať filter: {filter} |
| `auditLog.columns.actor` | Actor | Aktér | Aktér |
| `auditLog.columns.address` | Client address | Adresa klienta | Adresa klienta |
| `auditLog.columns.details` | Details | Podrobnosti | Podrobnosti |
| `auditLog.columns.event` | Event | Událost | Udalosť |
| `auditLog.columns.method` | Method | Metoda | Metóda |
| `auditLog.columns.outcome` | Outcome | Výsledek | Výsledok |
| `auditLog.columns.reason` | Reason | Důvod | Dôvod |
| `auditLog.columns.time` | Time | Čas | Čas |
| `auditLog.description` | Sign-ins, sign-outs and changes to passkeys, preferences and API keys, newest first. | Přihlášení, odhlášení a změny přístupových klíčů, předvoleb a API klíčů, od nejnovějších. | Prihlásenia, odhlásenia a zmeny prístupových kľúčov, predvolieb a API kľúčov, od najnovších. |
| `auditLog.details.hide` | Hide details | Skrýt podrobnosti | Skryť podrobnosti |
| `auditLog.details.label` | Details of {event} | Podrobnosti: {event} | Podrobnosti: {event} |
| `auditLog.details.none` | None | Žádné | Žiadne |
| `auditLog.details.requestId` | Request ID | ID požadavku | ID požiadavky |
| `auditLog.details.show` | Show details | Zobrazit podrobnosti | Zobraziť podrobnosti |
| `auditLog.details.target` | Target | Cíl | Cieľ |
| `auditLog.details.userAgent` | User agent | User agent | User agent |
| `auditLog.empty` | No audit records yet. | Zatím žádné záznamy auditu. | Zatiaľ žiadne záznamy auditu. |
| `auditLog.filters.actor` | User or API key | Uživatel nebo API klíč | Používateľ alebo API kľúč |
| `auditLog.filters.actorHelp` | A username, including one tried in a failed sign-in, or an API key ID. | Uživatelské jméno, i takové zkoušené při neúspěšném přihlášení, nebo ID API klíče. | Používateľské meno, aj také skúšané pri neúspešnom prihlásení, alebo ID API kľúča. |
| `auditLog.filters.address` | Client address | Adresa klienta | Adresa klienta |
| `auditLog.filters.addressHelp` | An IPv4 or IPv6 address or a network, for example 192.0.2.0/24. | Adresa IPv4 nebo IPv6 nebo síť, například 192.0.2.0/24. | Adresa IPv4 alebo IPv6 alebo sieť, napríklad 192.0.2.0/24. |
| `auditLog.filters.anyOutcome` | Any outcome | Libovolný výsledek | Ľubovoľný výsledok |
| `auditLog.filters.apply` | Apply filters | Použít filtry | Použiť filtre |
| `auditLog.filters.clear` | Clear filters | Zrušit filtry | Zrušiť filtre |
| `auditLog.filters.eventTypes` | Event types | Typy událostí | Typy udalostí |
| `auditLog.filters.from` | From | Od | Od |
| `auditLog.filters.outcome` | Outcome | Výsledek | Výsledok |
| `auditLog.filters.range` | Time range | Časové období | Časové obdobie |
| `auditLog.filters.rangeOrder` | The end must be after the start. | Konec musí být po začátku. | Koniec musí byť po začiatku. |
| `auditLog.filters.ranges.24h` | Last 24 hours | Posledních 24 hodin | Posledných 24 hodín |
| `auditLog.filters.ranges.30d` | Last 30 days | Posledních 30 dní | Posledných 30 dní |
| `auditLog.filters.ranges.7d` | Last 7 days | Posledních 7 dní | Posledných 7 dní |
| `auditLog.filters.ranges.any` | Any time | Kdykoli | Kedykoľvek |
| `auditLog.filters.ranges.custom` | Custom range | Vlastní období | Vlastné obdobie |
| `auditLog.filters.title` | Filters | Filtry | Filtre |
| `auditLog.filters.to` | To | Do | Do |
| `auditLog.noMatch` | No records match these filters. | Filtrům neodpovídají žádné záznamy. | Filtrom nezodpovedajú žiadne záznamy. |
| `auditLog.notRecorded` | Not recorded | Nezaznamenáno | Nezaznamenané |
| `auditLog.records` | Audit records | Záznamy auditu | Záznamy auditu |
| `auditLog.resultCount` | Records found: {total} | Nalezené záznamy: {total} | Nájdené záznamy: {total} |
| `auditLog.targetFilterUnavailable` | Filtering by a single object comes with a later version of the app. All records are shown. | Filtrování podle jednoho objektu přijde v pozdější verzi aplikace. Zobrazují se všechny záznamy. | Filtrovanie podľa jedného objektu príde v neskoršej verzii aplikácie. Zobrazujú sa všetky záznamy. |
| `auditLog.title` | Audit log | Protokol auditu | Protokol auditu |
| `auditLog.unknown` | Unknown ({code}) | Neznámé ({code}) | Neznáme ({code}) |
| `auth.notice.secondFactorRejected` | The code was not accepted. Please start the sign-in again. | Kód nebyl přijat. Začněte prosím přihlášení znovu. | Kód nebol prijatý. Začnite, prosím, prihlásenie znova. |
| `auth.notice.secondFactorUnavailable` | Your second factors cannot be used here. Ask an administrator to reset them. | Vaše druhé faktory zde nelze použít. Požádejte správce, aby je obnovil. | Vaše druhé faktory tu nemožno použiť. Požiadajte správcu, aby ich obnovil. |
| `auth.notice.sessionEnded` | Your session has ended. Please sign in again. | Vaše relace skončila. Přihlaste se prosím znovu. | Vaša relácia sa skončila. Prihláste sa, prosím, znova. |
| `auth.notice.signInTimedOut` | The sign-in timed out. Please sign in again. | Časový limit přihlášení vypršel. Přihlaste se prosím znovu. | Časový limit prihlásenia vypršal. Prihláste sa, prosím, znova. |
| `auth.notice.signedOut` | You have signed out. | Byli jste odhlášeni. | Boli ste odhlásení. |
| `auth.passkey.chooseAgain` | Choose your passkey again. | Zvolte přístupový klíč znovu. | Zvoľte prístupový kľúč znova. |
| `auth.passkey.expired` | The passkey sign-in timed out. Please try again. | Časový limit přihlášení přístupovým klíčem vypršel. Zkuste to prosím znovu. | Časový limit prihlásenia prístupovým kľúčom vypršal. Skúste to, prosím, znova. |
| `auth.passkey.failed` | Sign-in with this passkey failed. Sign in with your username and password instead. | Přihlášení tímto přístupovým klíčem se nezdařilo. Přihlaste se raději uživatelským jménem a heslem. | Prihlásenie týmto prístupovým kľúčom zlyhalo. Prihláste sa radšej používateľským menom a heslom. |
| `auth.passkey.or` | or with your username and password | nebo uživatelským jménem a heslem | alebo používateľským menom a heslom |
| `auth.passkey.signIn` | Sign in with a passkey | Přihlásit se přístupovým klíčem | Prihlásiť sa prístupovým kľúčom |
| `auth.passkey.waiting` | Waiting for your passkey… | Čekání na přístupový klíč… | Čaká sa na prístupový kľúč… |
| `auth.pendingActions.intro` | Your account has actions to complete before you can continue. | Než budete moci pokračovat, musíte na svém účtu dokončit tyto kroky. | Skôr ako budete môcť pokračovať, musíte na svojom účte dokončiť tieto kroky. |
| `auth.pendingActions.password.body` | Your password must be changed. This app cannot change passwords yet: change it in the classic interface, then check again here. | Musíte si změnit heslo. Tato aplikace zatím hesla měnit neumí: změňte jej v klasickém rozhraní a poté to zde zkontrolujte znovu. | Musíte si zmeniť heslo. Táto aplikácia zatiaľ heslá meniť nevie: zmeňte ho v klasickom rozhraní a potom to tu skontrolujte znova. |
| `auth.pendingActions.password.checkAgain` | Check again | Zkontrolovat znovu | Skontrolovať znova |
| `auth.pendingActions.password.link` | Change your password in the classic interface | Změnit heslo v klasickém rozhraní | Zmeniť heslo v klasickom rozhraní |
| `auth.pendingActions.password.stillPending` | The password change is still pending. | Změna hesla stále čeká na dokončení. | Zmena hesla stále čaká na dokončenie. |
| `auth.pendingActions.secondFactor.afterPassword` | You can register a passkey here once your password has been changed. | Přístupový klíč zde budete moci zaregistrovat, jakmile si změníte heslo. | Prístupový kľúč tu budete môcť zaregistrovať, keď si zmeníte heslo. |
| `auth.pendingActions.secondFactor.classicLink` | Set up a second factor in the classic interface | Nastavit druhý faktor v klasickém rozhraní | Nastaviť druhý faktor v klasickom rozhraní |
| `auth.pendingActions.secondFactor.register` | Register a passkey | Zaregistrovat přístupový klíč | Zaregistrovať prístupový kľúč |
| `auth.pendingActions.secondFactor.required` | Your account must have a second factor. A passkey counts as one. | Váš účet musí mít druhý faktor. Přístupový klíč se počítá jako druhý faktor. | Váš účet musí mať druhý faktor. Prístupový kľúč sa počíta ako druhý faktor. |
| `auth.pendingActions.secondFactor.unsupported` | This device cannot create passkeys. You can set up a second factor in the classic interface. | Toto zařízení nemůže vytvářet přístupové klíče. Druhý faktor si můžete nastavit v klasickém rozhraní. | Toto zariadenie nemôže vytvárať prístupové kľúče. Druhý faktor si môžete nastaviť v klasickom rozhraní. |
| `auth.pendingActions.title` | Actions required | Je potřeba dokončit kroky | Je potrebné dokončiť kroky |
| `auth.secondFactor.intro` | Signing in as {username}. Confirm the sign-in with one of your second factors. | Přihlašujete se jako {username}. Potvrďte přihlášení jedním ze svých druhých faktorů. | Prihlasujete sa ako {username}. Potvrďte prihlásenie jedným zo svojich druhých faktorov. |
| `auth.secondFactor.oneMinute` | One minute left to complete the sign-in. | Na dokončení přihlášení zbývá jedna minuta. | Na dokončenie prihlásenia zostáva jedna minúta. |
| `auth.secondFactor.otherMethods` | Other methods | Další metody | Ďalšie metódy |
| `auth.secondFactor.timeLeft` | Time left: {time} | Zbývající čas: {time} | Zostávajúci čas: {time} |
| `auth.secondFactor.totp.code` | Six-digit code | Šestimístný kód | Šesťmiestny kód |
| `auth.secondFactor.verify` | Verify | Ověřit | Overiť |
| `auth.secondFactor.webauthn.start` | Use your security key or passkey | Použít bezpečnostní klíč nebo přístupový klíč | Použiť bezpečnostný kľúč alebo prístupový kľúč |
| `auth.secondFactor.webauthn.unsupported` | This device cannot use a security key or passkey. Choose another method. | Toto zařízení nemůže použít bezpečnostní klíč ani přístupový klíč. Zvolte jinou metodu. | Toto zariadenie nemôže použiť bezpečnostný kľúč ani prístupový kľúč. Zvoľte inú metódu. |
| `auth.secondFactor.webauthn.waiting` | Waiting for your security key or passkey… | Čekání na bezpečnostní klíč nebo přístupový klíč… | Čaká sa na bezpečnostný kľúč alebo prístupový kľúč… |
| `auth.secondFactor.yubiOtp.field` | Yubico OTP | Yubico OTP | Yubico OTP |
| `auth.secondFactor.yubiOtp.help` | Touch your YubiKey to type the code into this field. | Dotkněte se klíče YubiKey, aby do tohoto pole napsal kód. | Dotknite sa kľúča YubiKey, aby do tohto poľa napísal kód. |
| `auth.signIn.anyRole` | Sign in with any account | Přihlásit se libovolným účtem | Prihlásiť sa ľubovoľným účtom |
| `auth.signIn.help` | Help | Nápověda | Pomocník |
| `auth.signIn.idpHint.body` | Accounts that sign in through your organisation's identity provider cannot use their password here yet. | Účty, které se přihlašují přes poskytovatele identity vaší organizace, zde zatím nemohou použít heslo. | Účty, ktoré sa prihlasujú cez poskytovateľa identity vašej organizácie, tu zatiaľ nemôžu použiť heslo. |
| `auth.signIn.idpHint.link` | Sign in in the classic interface | Přihlásit se v klasickém rozhraní | Prihlásiť sa v klasickom rozhraní |
| `auth.signIn.showPassword` | Show password | Zobrazit heslo | Zobraziť heslo |
| `auth.signIn.sso.body` | This server uses single sign-on. For now it is available in the classic interface. | Tento server používá jednotné přihlášení. Zatím je k dispozici v klasickém rozhraní. | Tento server používa jednotné prihlásenie. Zatiaľ je k dispozícii v klasickom rozhraní. |
| `auth.signIn.sso.link` | Sign in with single sign-on in the classic interface | Přihlásit se jednotným přihlášením v klasickém rozhraní | Prihlásiť sa jednotným prihlásením v klasickom rozhraní |
| `auth.signIn.sso.title` | Single sign-on | Jednotné přihlášení | Jednotné prihlásenie |
| `auth.signIn.submit` | Sign in | Přihlásit se | Prihlásiť sa |
| `auth.signIn.submitting` | Signing in… | Přihlašování… | Prihlasovanie… |
| `auth.signIn.throttle.announce` | Too many attempts. You can try again in {time}. | Příliš mnoho pokusů. Znovu to můžete zkusit za {time}. | Príliš veľa pokusov. Znova to môžete skúsiť o {time}. |
| `auth.signIn.throttle.countdown` | You can try again in {time} | Znovu to můžete zkusit za {time} | Znova to môžete skúsiť o {time} |
| `auth.signIn.throttle.ended` | You can try to sign in again. | Nyní se můžete znovu zkusit přihlásit. | Teraz sa môžete znova skúsiť prihlásiť. |
| `auth.signIn.title` | Sign in | Přihlášení | Prihlásenie |
| `common.close` | Close | Zavřít | Zavrieť |
| `common.documentTitle` | {page} – {site} | {page} – {site} | {page} – {site} |
| `common.goHome` | Go to the home screen | Přejít na úvodní obrazovku | Prejsť na úvodnú obrazovku |
| `common.next` | Next | Další | Ďalej |
| `common.opensInNewTab` | (opens in a new tab) | (otevře se na nové kartě) | (otvorí sa na novej karte) |
| `common.previous` | Previous | Předchozí | Predchádzajúce |
| `common.requestId` | Request ID: {requestId} | ID požadavku: {requestId} | ID požiadavky: {requestId} |
| `common.retry` | Try again | Zkusit znovu | Skúsiť znova |
| `common.signOut` | Sign out | Odhlásit se | Odhlásiť sa |
| `enums.announcementType.danger` | Important | Důležité | Dôležité |
| `enums.announcementType.info` | Information | Informace | Informácia |
| `enums.announcementType.warning` | Warning | Upozornění | Upozornenie |
| `enums.apiKeyAccessLevel.readOnly` | Read only | Jen pro čtení | Iba na čítanie |
| `enums.apiKeyAccessLevel.readWrite` | Read and write | Čtení a zápis | Čítanie a zápis |
| `enums.apiKeyStatus.active` | Active | Aktivní | Aktívny |
| `enums.apiKeyStatus.expired` | Expired | Vypršelý | Vypršaný |
| `enums.apiKeyStatus.revoked` | Revoked | Zneplatněný | Zneplatnený |
| `enums.auditEventType.apiKeyCreation` | API key created | Vytvoření API klíče | Vytvorenie API kľúča |
| `enums.auditEventType.apiKeyRevocation` | API key revoked | Zneplatnění API klíče | Zneplatnenie API kľúča |
| `enums.auditEventType.passkeyRegistration` | Passkey added | Přidání přístupového klíče | Pridanie prístupového kľúča |
| `enums.auditEventType.passkeyRemoval` | Passkey removed | Odebrání přístupového klíče | Odobratie prístupového kľúča |
| `enums.auditEventType.passkeyRename` | Passkey renamed | Přejmenování přístupového klíče | Premenovanie prístupového kľúča |
| `enums.auditEventType.preferencesUpdate` | Preferences changed | Změna předvoleb | Zmena predvolieb |
| `enums.auditEventType.signIn` | Sign-in | Přihlášení | Prihlásenie |
| `enums.auditEventType.signOut` | Sign-out | Odhlášení | Odhlásenie |
| `enums.auditFailureReason.accountInactive` | Account inactive | Účet je neaktivní | Účet je neaktívny |
| `enums.auditFailureReason.challengeExpired` | Sign-in timed out | Časový limit přihlášení vypršel | Časový limit prihlásenia vypršal |
| `enums.auditFailureReason.externalIdentitySource` | Account signs in through an identity provider | Účet se přihlašuje přes poskytovatele identit | Účet sa prihlasuje cez poskytovateľa identít |
| `enums.auditFailureReason.invalidCredentials` | Wrong username or password | Nesprávné uživatelské jméno nebo heslo | Nesprávne používateľské meno alebo heslo |
| `enums.auditFailureReason.passkeyInactive` | Passkey inactive | Přístupový klíč je neaktivní | Prístupový kľúč je neaktívny |
| `enums.auditFailureReason.passkeyVerificationFailed` | Passkey verification failed | Ověření přístupového klíče selhalo | Overenie prístupového kľúča zlyhalo |
| `enums.auditFailureReason.registrationFailed` | Registration failed | Registrace selhala | Registrácia zlyhala |
| `enums.auditFailureReason.roleMismatch` | Sign-in screen for another account type | Přihlašovací obrazovka pro jiný typ účtu | Prihlasovacia obrazovka pre iný typ účtu |
| `enums.auditFailureReason.secondFactorFailed` | Second factor not accepted | Druhý faktor nebyl přijat | Druhý faktor nebol prijatý |
| `enums.auditFailureReason.secondFactorUnavailable` | Second factor unavailable | Druhý faktor není k dispozici | Druhý faktor nie je k dispozícii |
| `enums.auditFailureReason.throttled` | Too many attempts | Příliš mnoho pokusů | Príliš veľa pokusov |
| `enums.auditFailureReason.unknownPasskey` | Unknown passkey | Neznámý přístupový klíč | Neznámy prístupový kľúč |
| `enums.auditFailureReason.verificationUnavailable` | Verification service unavailable | Ověřovací služba je nedostupná | Overovacia služba je nedostupná |
| `enums.auditOutcome.failure` | Failure | Neúspěch | Neúspech |
| `enums.auditOutcome.success` | Success | Úspěch | Úspech |
| `enums.auditTargetType.apiKey` | API key | API klíč | API kľúč |
| `enums.auditTargetType.passkey` | Passkey | Přístupový klíč | Prístupový kľúč |
| `enums.auditTargetType.preferences` | Preferences | Předvolby | Predvoľby |
| `enums.auditTargetType.session` | Session | Relace | Relácia |
| `enums.authMethod.apiKey` | API key | API klíč | API kľúč |
| `enums.authMethod.passkey` | Passkey | Přístupový klíč | Prístupový kľúč |
| `enums.authMethod.password` | Password | Heslo | Heslo |
| `enums.authMethod.passwordAndSecondFactor` | Password and second factor | Heslo a druhý faktor | Heslo a druhý faktor |
| `enums.pendingAction.passwordChange` | Change your password | Změňte své heslo | Zmeňte svoje heslo |
| `enums.pendingAction.secondFactorSetup` | Set up a second factor | Nastavte druhý faktor | Nastavte druhý faktor |
| `enums.secondFactorType.totp` | Authenticator app (TOTP) | Ověřovací aplikace (TOTP) | Overovacia aplikácia (TOTP) |
| `enums.secondFactorType.webauthn` | Security key or passkey | Bezpečnostní nebo přístupový klíč | Bezpečnostný alebo prístupový kľúč |
| `enums.secondFactorType.yubiOtp` | Yubico OTP | Yubico OTP | Yubico OTP |
| `forms.errorSummary.title` | Please correct the following | Opravte prosím následující | Opravte, prosím, nasledujúce |
| `forms.required` | required | povinné | povinné |
| `home.greeting` | Hello, {username} | Dobrý den, {username} | Dobrý deň, {username} |
| `home.passkeySuggestion.action` | Add a passkey | Přidat přístupový klíč | Pridať prístupový kľúč |
| `home.passkeySuggestion.body` | Add a passkey to sign in with your fingerprint, face or device PIN instead of your password. | Přidejte si přístupový klíč a přihlašujte se otiskem prstu, obličejem nebo PIN zařízení místo hesla. | Pridajte si prístupový kľúč a prihlasujte sa odtlačkom prsta, tvárou alebo PIN zariadenia namiesto hesla. |
| `home.passkeySuggestion.dismiss` | Not now | Teď ne | Teraz nie |
| `home.passkeySuggestion.title` | Sign in faster with a passkey | Přihlašujte se rychleji přístupovým klíčem | Prihlasujte sa rýchlejšie prístupovým kľúčom |
| `home.role` | You are signed in as {role}. | Jste přihlášeni jako {role}. | Ste prihlásení ako {role}. |
| `home.scope.allDomains` | You manage all domains. | Spravujete všechny domény. | Spravujete všetky domény. |
| `home.scope.domains` | You manage these domains: | Spravujete tyto domény: | Spravujete tieto domény: |
| `home.scope.heading` | Your scope | Váš rozsah | Váš rozsah |
| `home.scope.mailbox` | Your mailbox: {mailbox} | Vaše schránka: {mailbox} | Vaša schránka: {mailbox} |
| `home.scope.noDomains` | No domains are assigned to you. | Nejsou vám přiřazeny žádné domény. | Nie sú vám priradené žiadne domény. |
| `home.shortcuts.heading` | Sections | Sekce | Sekcie |
| `home.title` | Home | Domů | Domov |
| `lists.pagination.current` | Page {page} of {pages} | Stránka {page} z {pages} | Strana {page} z {pages} |
| `lists.pagination.empty` | No entries | Žádné položky | Žiadne položky |
| `lists.pagination.pageSize` | Per page | Na stránku | Na stránku |
| `lists.pagination.summary` | {from}–{to} of {total} | {from}–{to} z {total} | {from}–{to} z {total} |
| `nav.account` | My account | Můj účet | Môj účet |
| `nav.administrators` | Administrators | Administrátoři | Administrátori |
| `nav.aliases` | Aliases and resources | Aliasy a zdroje | Aliasy a zdroje |
| `nav.apiKeys` | API keys | API klíče | API kľúče |
| `nav.auditLog` | Audit log | Protokol auditu | Protokol auditu |
| `nav.dns` | DKIM, MTA-STS and DNS | DKIM, MTA-STS a DNS | DKIM, MTA-STS a DNS |
| `nav.home` | Home | Úvod | Úvod |
| `nav.identityProviders` | Identity providers and OAuth2 | Poskytovatelé identit a OAuth2 | Poskytovatelia identít a OAuth2 |
| `nav.operations` | Monitoring and operations | Monitorování a provoz | Monitorovanie a prevádzka |
| `nav.passkeys` | Passkeys | Přístupové klíče | Prístupové kľúče |
| `nav.routing` | Routing and rewriting | Směrování a přepisování adres | Smerovanie a prepisovanie adries |
| `nav.spamFilter` | Spam filter | Spamový filtr | Spamový filter |
| `nav.system` | System settings | Nastavení systému | Nastavenia systému |
| `passkeys.add.heading` | Add a passkey | Přidat přístupový klíč | Pridať prístupový kľúč |
| `passkeys.add.name` | Name (optional) | Název (nepovinný) | Názov (nepovinný) |
| `passkeys.add.nameHelp` | For example the device the passkey is stored on. | Například zařízení, ve kterém je přístupový klíč uložen. | Napríklad zariadenie, v ktorom je prístupový kľúč uložený. |
| `passkeys.add.submit` | Add a passkey | Přidat přístupový klíč | Pridať prístupový kľúč |
| `passkeys.add.unsupported` | This device cannot create passkeys. You can still rename and remove your passkeys here. | Toto zařízení nemůže vytvářet přístupové klíče. Své přístupové klíče zde však můžete přejmenovat a odebrat. | Toto zariadenie nemôže vytvárať prístupové kľúče. Svoje prístupové kľúče tu však môžete premenovať a odstrániť. |
| `passkeys.add.waiting` | Waiting for your device… | Čekání na zařízení… | Čaká sa na zariadenie… |
| `passkeys.added` | Passkey added. | Přístupový klíč byl přidán. | Prístupový kľúč bol pridaný. |
| `passkeys.empty` | You have no passkeys yet. A passkey lets you sign in with one tap, without a password. | Zatím nemáte žádné přístupové klíče. Přístupový klíč vám umožní přihlásit se jedním klepnutím, bez hesla. | Zatiaľ nemáte žiadne prístupové kľúče. Prístupový kľúč vám umožní prihlásiť sa jedným ťuknutím, bez hesla. |
| `passkeys.errors.alreadyRegistered` | This device already has a passkey for your account. | Toto zařízení už má přístupový klíč pro váš účet. | Toto zariadenie už má prístupový kľúč pre váš účet. |
| `passkeys.errors.generic` | Something went wrong with the passkey. Please try again. | S přístupovým klíčem se něco pokazilo. Zkuste to prosím znovu. | S prístupovým kľúčom sa niečo pokazilo. Skúste to, prosím, znova. |
| `passkeys.errors.insecure` | Passkeys cannot be used at this address. | Přístupové klíče nelze na této adrese použít. | Prístupové kľúče nemožno na tejto adrese použiť. |
| `passkeys.errors.unsupported` | This device cannot create or use a passkey of the required kind. | Toto zařízení nemůže vytvořit ani použít přístupový klíč požadovaného typu. | Toto zariadenie nemôže vytvoriť ani použiť prístupový kľúč požadovaného typu. |
| `passkeys.inactive` | Inactive: it cannot be used to sign in | Neaktivní: nelze jím se přihlásit | Neaktívny: nemožno sa ním prihlásiť |
| `passkeys.intro` | Passkeys let you sign in without a password, with your fingerprint, face or device PIN. They work here and in the classic interface. | Přístupové klíče vám umožní přihlásit se bez hesla, otiskem prstu, obličejem nebo PIN zařízení. Fungují zde i v klasickém rozhraní. | Prístupové kľúče vám umožnia prihlásiť sa bez hesla, odtlačkom prsta, tvárou alebo PIN zariadenia. Fungujú tu aj v klasickom rozhraní. |
| `passkeys.otherHost` | Works only on {host} | Funguje pouze na {host} | Funguje iba na {host} |
| `passkeys.registered` | Registered | Zaregistrován | Zaregistrovaný |
| `passkeys.remove.action` | Remove | Odebrat | Odstrániť |
| `passkeys.remove.body` | It will no longer sign you in, here or in the classic interface. | Už vás nepřihlásí, ani zde, ani v klasickém rozhraní. | Už vás neprihlási, ani tu, ani v klasickom rozhraní. |
| `passkeys.remove.confirm` | Remove | Odebrat | Odstrániť |
| `passkeys.remove.last` | This is your last passkey. Your password remains the way to sign in. | Je to váš poslední přístupový klíč. Přihlašovat se budete i nadále heslem. | Je to váš posledný prístupový kľúč. Prihlasovať sa budete aj naďalej heslom. |
| `passkeys.remove.title` | Remove the passkey “{name}”? | Odebrat přístupový klíč „{name}“? | Odstrániť prístupový kľúč „{name}“? |
| `passkeys.removed` | Passkey removed. | Přístupový klíč byl odebrán. | Prístupový kľúč bol odstránený. |
| `passkeys.rename.name` | Name | Název | Názov |
| `passkeys.rename.outdated` | This passkey was changed elsewhere and has been reloaded. Check the name and save again. | Tento přístupový klíč byl mezitím změněn jinde a byl znovu načten. Zkontrolujte název a uložte znovu. | Tento prístupový kľúč bol medzitým zmenený inde a bol znova načítaný. Skontrolujte názov a uložte znova. |
| `passkeys.rename.save` | Save | Uložit | Uložiť |
| `passkeys.rename.title` | Rename passkey | Přejmenovat přístupový klíč | Premenovať prístupový kľúč |
| `passkeys.renamed` | Passkey renamed. | Přístupový klíč byl přejmenován. | Prístupový kľúč bol premenovaný. |
| `passkeys.title` | Passkeys | Přístupové klíče | Prístupové kľúče |
| `passkeys.unknown` | Unknown passkey, registered {date} | Neznámý přístupový klíč, zaregistrován {date} | Neznámy prístupový kľúč, zaregistrovaný {date} |
| `placeholder.classicHeading` | Use the classic interface for now | Zatím použijte klasické rozhraní | Zatiaľ použite klasické rozhranie |
| `placeholder.note` | The classic interface has its own session, so you sign in there separately. | Klasické rozhraní má vlastní relaci, proto se v něm přihlašujete zvlášť. | Klasické rozhranie má vlastnú reláciu, preto sa v ňom prihlasujete zvlášť. |
| `placeholder.pages.mailSetup` | Mail setup | Nastavení pošty | Nastavenie pošty |
| `placeholder.pages.other` | Classic interface | Klasické rozhraní | Klasické rozhranie |
| `preferences.changedElsewhere` | Your preferences were changed elsewhere. The saved setting is shown now; choose again if you like. | Vaše předvolby byly změněny jinde. Nyní se zobrazuje uložené nastavení; případně vyberte znovu. | Vaše predvoľby boli zmenené inde. Teraz sa zobrazuje uložené nastavenie; prípadne vyberte znova. |
| `preferences.language` | Language | Jazyk | Jazyk |
| `preferences.languages.cs-cz` | Čeština | Čeština | Čeština |
| `preferences.languages.en-gb` | English | English | English |
| `preferences.languages.sk-sk` | Slovenčina | Slovenčina | Slovenčina |
| `preferences.notSaved` | Your change was not saved. The previous setting is back. | Změna nebyla uložena. Platí předchozí nastavení. | Zmena nebola uložená. Platí predchádzajúce nastavenie. |
| `preferences.saved` | Saved. | Uloženo. | Uložené. |
| `preferences.theme` | Theme | Motiv | Motív |
| `problem.api-key-expired` | This API key has expired. | Platnost tohoto API klíče vypršela. | Platnosť tohto API kľúča vypršala. |
| `problem.api-key-invalid` | The API key is not valid. | API klíč není platný. | API kľúč nie je platný. |
| `problem.api-key-revoked` | The API key has been revoked. | API klíč byl zneplatněn. | API kľúč bol zneplatnený. |
| `problem.api-key-source-not-allowed` | The API key cannot be used from this network address. | API klíč nelze použít z této síťové adresy. | API kľúč nemožno použiť z tejto sieťovej adresy. |
| `problem.csrf-token-mismatch` | Your session could not be verified. Please try again. | Relaci se nepodařilo ověřit. Zkuste to prosím znovu. | Reláciu sa nepodarilo overiť. Skúste to, prosím, znova. |
| `problem.forbidden` | You do not have permission to do this. | K této akci nemáte oprávnění. | Na túto akciu nemáte oprávnenie. |
| `problem.generic` | Something went wrong. Please try again. | Něco se pokazilo. Zkuste to prosím znovu. | Niečo sa pokazilo. Skúste to, prosím, znova. |
| `problem.insufficient-key-scope` | The API key does not allow this action. | API klíč tuto akci nepovoluje. | API kľúč túto akciu nepovoľuje. |
| `problem.network` | The server could not be reached. Check your connection and try again. | Server je nedostupný. Zkontrolujte připojení a zkuste to znovu. | Server je nedostupný. Skontrolujte pripojenie a skúste to znova. |
| `problem.passkey-registration-failed` | The passkey could not be registered. Please try again. | Přístupový klíč se nepodařilo zaregistrovat. Zkuste to prosím znovu. | Prístupový kľúč sa nepodarilo zaregistrovať. Skúste to, prosím, znova. |
| `problem.pending-action-required` | Your account has actions to complete first. | Ve vašem účtu je nejprve potřeba dokončit některé kroky. | Vo vašom účte je najprv potrebné dokončiť niektoré kroky. |
| `problem.second-factor-failed` | The code was not accepted. Please start the sign-in again. | Kód nebyl přijat. Začněte přihlášení prosím znovu. | Kód nebol prijatý. Začnite, prosím, prihlásenie znova. |
| `problem.second-factor-required` | Please complete the second sign-in step. | Dokončete prosím druhý krok přihlášení. | Dokončite, prosím, druhý krok prihlásenia. |
| `problem.second-factor-unavailable` | Your second factors cannot be used here. Ask an administrator to reset them. | Vaše druhé faktory zde nelze použít. Požádejte správce o jejich obnovení. | Vaše druhé faktory tu nemožno použiť. Požiadajte správcu o ich obnovenie. |
| `problem.service-unavailable` | The service is temporarily unavailable. Please try again in a moment. | Služba je dočasně nedostupná. Zkuste to prosím za chvíli znovu. | Služba je dočasne nedostupná. Skúste to, prosím, o chvíľu znova. |
| `problem.session-required` | This action needs a signed-in session. | Tato akce vyžaduje přihlášení. | Táto akcia vyžaduje prihlásenie. |
| `problem.sign-in-expired` | The sign-in timed out. Please start again. | Časový limit přihlášení vypršel. Začněte prosím znovu. | Časový limit prihlásenia vypršal. Začnite, prosím, znova. |
| `problem.sign-in-failed` | Sign-in failed. Check your details and try again. | Přihlášení se nezdařilo. Zkontrolujte údaje a zkuste to znovu. | Prihlásenie zlyhalo. Skontrolujte údaje a skúste to znova. |
| `problem.status.400` | The request could not be processed. | Požadavek se nepodařilo zpracovat. | Požiadavku sa nepodarilo spracovať. |
| `problem.status.401` | Please sign in again. | Přihlaste se prosím znovu. | Prihláste sa, prosím, znova. |
| `problem.status.403` | You do not have permission to do this. | K této akci nemáte oprávnění. | Na túto akciu nemáte oprávnenie. |
| `problem.status.404` | This item could not be found. | Položka nebyla nalezena. | Položka sa nenašla. |
| `problem.status.409` | This conflicts with the current state. Reload and try again. | Akce je v rozporu s aktuálním stavem. Načtěte stránku znovu a zkuste to znovu. | Akcia je v rozpore s aktuálnym stavom. Načítajte stránku znova a skúste to znova. |
| `problem.status.412` | This item was changed elsewhere. It has been reloaded; please try again. | Položka byla mezitím změněna jinde. Byla znovu načtena, zkuste to prosím znovu. | Položka bola medzitým zmenená inde. Bola znova načítaná, skúste to, prosím, znova. |
| `problem.status.413` | The request is too large. | Požadavek je příliš velký. | Požiadavka je príliš veľká. |
| `problem.status.422` | Some values are not valid. | Některé hodnoty nejsou platné. | Niektoré hodnoty nie sú platné. |
| `problem.status.429` | Too many requests. Please wait before trying again. | Příliš mnoho požadavků. Před dalším pokusem chvíli počkejte. | Príliš veľa požiadaviek. Pred ďalším pokusom chvíľu počkajte. |
| `problem.status.500` | Something went wrong on the server. Please try again. | Na serveru došlo k chybě. Zkuste to prosím znovu. | Na serveri došlo k chybe. Skúste to, prosím, znova. |
| `problem.status.502` | The service is temporarily unavailable. Please try again in a moment. | Služba je dočasně nedostupná. Zkuste to prosím za chvíli znovu. | Služba je dočasne nedostupná. Skúste to, prosím, o chvíľu znova. |
| `problem.status.503` | The service is temporarily unavailable. Please try again in a moment. | Služba je dočasně nedostupná. Zkuste to prosím za chvíli znovu. | Služba je dočasne nedostupná. Skúste to, prosím, o chvíľu znova. |
| `problem.status.504` | The server took too long to answer. Please try again. | Server neodpověděl včas. Zkuste to prosím znovu. | Server neodpovedal včas. Skúste to, prosím, znova. |
| `problem.temporary-verification-failure` | The code could not be checked right now. Try again or choose another method. | Kód se teď nepodařilo ověřit. Zkuste to znovu nebo zvolte jinou metodu. | Kód sa teraz nepodarilo overiť. Skúste to znova alebo zvoľte inú metódu. |
| `problem.too-many-requests` | Too many attempts. Please wait before trying again. | Příliš mnoho pokusů. Před dalším pokusem chvíli počkejte. | Príliš veľa pokusov. Pred ďalším pokusom chvíľu počkajte. |
| `problem.unauthenticated` | Your session has ended. Please sign in again. | Vaše relace skončila. Přihlaste se prosím znovu. | Vaša relácia skončila. Prihláste sa, prosím, znova. |
| `problem.validation-failed` | Some fields need your attention. | Některá pole vyžadují vaši pozornost. | Niektoré polia vyžadujú vašu pozornosť. |
| `roles.admin` | Administrator | Administrátor | Administrátor |
| `roles.domainAdmin` | Domain administrator | Správce domény | Správca domény |
| `roles.mailboxUser` | Mailbox user | Uživatel schránky | Používateľ schránky |
| `secrets.close` | Close | Zavřít | Zavrieť |
| `secrets.confirmClose.body` | It cannot be shown again. Without it, you will have to create a new one. | Znovu jej zobrazit nelze. Bez něj budete muset vytvořit nový. | Znova ho zobraziť nemožno. Bez neho budete musieť vytvoriť nový. |
| `secrets.confirmClose.cancel` | Back to the secret | Zpět k tajnému údaji | Späť k tajnému údaju |
| `secrets.confirmClose.confirm` | Yes, I have saved it | Ano, mám jej uložený | Áno, mám ho uložený |
| `secrets.confirmClose.title` | Have you saved the secret? | Uložili jste si tajný údaj? | Uložili ste si tajný údaj? |
| `secrets.copied` | Copied to the clipboard. | Zkopírováno do schránky. | Skopírované do schránky. |
| `secrets.copy` | Copy | Kopírovat | Kopírovať |
| `secrets.copyRefused` | The browser did not allow copying. The secret is selected: copy it yourself. | Prohlížeč kopírování nepovolil. Tajný údaj je označen: zkopírujte jej sami. | Prehliadač kopírovanie nepovolil. Tajný údaj je označený: skopírujte ho sami. |
| `secrets.label` | Secret | Tajný údaj | Tajný údaj |
| `secrets.warning` | This secret is shown only once. It cannot be shown again. | Tento tajný údaj se zobrazí jen jednou. Znovu jej zobrazit nelze. | Tento tajný údaj sa zobrazí len raz. Znova ho zobraziť nemožno. |
| `session.idle.body` | For your security, you will be signed out in {time} because of inactivity. | Z bezpečnostních důvodů budete kvůli nečinnosti odhlášeni za {time}. | Z bezpečnostných dôvodov budete pre nečinnosť odhlásení o {time}. |
| `session.idle.remaining` | {time} left before you are signed out. | Do odhlášení zbývá {time}. | Do odhlásenia zostáva {time}. |
| `session.idle.stay` | Stay signed in | Zůstat přihlášen | Zostať prihlásený |
| `session.idle.title` | Your session is about to end | Vaše relace brzy skončí | Vaša relácia sa čoskoro skončí |
| `shell.announcement.collapse` | Hide announcement | Skrýt oznámení | Skryť oznámenie |
| `shell.announcement.expand` | Show announcement | Zobrazit oznámení | Zobraziť oznámenie |
| `shell.announcement.prefix` | {type}: | {type}: | {type}: |
| `shell.signOutFailed` | Sign-out could not be confirmed. Check your connection and try again. | Odhlášení se nepodařilo potvrdit. Zkontrolujte připojení a zkuste to znovu. | Odhlásenie sa nepodarilo potvrdiť. Skontrolujte pripojenie a skúste to znova. |
| `shell.signingOut` | Signing out… | Odhlašování… | Odhlasovanie… |
| `shell.userMenu.signedInAs` | Signed in as | Přihlášen(a) jako | Prihlásený(-á) ako |
| `states.list.empty` | Nothing to show. | Není co zobrazit. | Nie je čo zobraziť. |
| `states.list.error` | The list could not be loaded. | Seznam se nepodařilo načíst. | Zoznam sa nepodarilo načítať. |
| `states.list.loading` | Loading… | Načítání… | Načítava sa… |
| `states.noAccess.body` | Your account cannot use this section. If you think this is wrong, ask your administrator. | Váš účet tuto sekci nemůže používat. Pokud si myslíte, že jde o chybu, obraťte se na správce. | Váš účet nemôže používať túto sekciu. Ak si myslíte, že ide o chybu, obráťte sa na správcu. |
| `states.noAccess.title` | No access | Bez přístupu | Bez prístupu |
| `states.notFound.body` | This address does not exist in the app. | Tato adresa v aplikaci neexistuje. | Táto adresa v aplikácii neexistuje. |
| `states.notFound.title` | Page not found | Stránka nenalezena | Stránka sa nenašla |
| `states.placeholder.body` | This section comes in a later version of the app. | Tato sekce přijde v některé z dalších verzí aplikace. | Táto sekcia príde v niektorej z ďalších verzií aplikácie. |
| `states.serviceUnavailable.body` | The server cannot be reached right now. Please try again in a moment. | Server je momentálně nedostupný. Zkuste to prosím za chvíli znovu. | Server je momentálne nedostupný. Skúste to, prosím, o chvíľu znova. |
| `states.serviceUnavailable.title` | Service temporarily unavailable | Služba je dočasně nedostupná | Služba je dočasne nedostupná |
| `themes.dark` | Dark | Tmavý | Tmavý |
| `themes.light` | Light | Světlý | Svetlý |
| `themes.system` | Device setting | Podle zařízení | Podľa zariadenia |
| `validation.format.base64url` | This value is not valid base64url. | Tato hodnota není platný base64url. | Táto hodnota nie je platný base64url. |
| `validation.format.dateTime` | Enter a valid date and time. | Zadejte platné datum a čas. | Zadajte platný dátum a čas. |
| `validation.format.ipAddress` | Enter a valid IPv4 or IPv6 address. | Zadejte platnou adresu IPv4 nebo IPv6. | Zadajte platnú adresu IPv4 alebo IPv6. |
| `validation.format.ipNetwork` | Enter an IPv4 or IPv6 address or network, for example 192.0.2.0/24. | Zadejte adresu nebo síť IPv4 či IPv6, například 192.0.2.0/24. | Zadajte adresu alebo sieť IPv4 či IPv6, napríklad 192.0.2.0/24. |
| `validation.format.totpCode` | Enter the six-digit code. | Zadejte šestimístný kód. | Zadajte šesťmiestny kód. |
| `validation.format.webauthnCredential` | The response of the security key or passkey is not valid. | Odpověď bezpečnostního nebo přístupového klíče není platná. | Odpoveď bezpečnostného alebo prístupového kľúča nie je platná. |
| `validation.format.yubicoOtp` | Enter the 44 letters or digits your YubiKey types. | Zadejte 44 písmen nebo číslic, které napíše váš YubiKey. | Zadajte 44 písmen alebo číslic, ktoré napíše váš YubiKey. |
| `validation.invalid` | This value is not valid. | Tato hodnota není platná. | Táto hodnota nie je platná. |
| `validation.invalidFormat` | This value has an invalid format. | Tato hodnota má neplatný formát. | Táto hodnota má neplatný formát. |
| `validation.invalidType` | This value has the wrong type. | Tato hodnota má nesprávný typ. | Táto hodnota má nesprávny typ. |
| `validation.mustBeInFuture` | Choose a time in the future. | Zvolte čas v budoucnosti. | Zvoľte čas v budúcnosti. |
| `validation.notEligible` | This item cannot be used here. Allowed: {allowedRoles}. | Tuto položku zde nelze použít. Povoleno: {allowedRoles}. | Túto položku tu nemožno použiť. Povolené: {allowedRoles}. |
| `validation.notFound` | This item does not exist. | Tato položka neexistuje. | Táto položka neexistuje. |
| `validation.notInList` | Choose one of: {allowed}. | Zvolte jednu z možností: {allowed}. | Zvoľte jednu z možností: {allowed}. |
| `validation.outOfRange` | Enter a value from {min} to {max}. | Zadejte hodnotu od {min} do {max}. | Zadajte hodnotu od {min} do {max}. |
| `validation.required` | This field is required. | Toto pole je povinné. | Toto pole je povinné. |
| `validation.tooLong` | Enter at most {max} characters. | Zadejte nejvýše {max} znaků. | Zadajte najviac {max} znakov. |
| `validation.tooMany` | Enter at most {max} entries. | Zadejte nejvýše {max} položek. | Zadajte najviac {max} položiek. |
| `validation.tooShort` | Enter at least {min} characters. | Zadejte alespoň {min} znaků. | Zadajte aspoň {min} znakov. |
