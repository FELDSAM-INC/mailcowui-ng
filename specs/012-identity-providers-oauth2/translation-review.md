# New strings of UI feature 012 for native review

These are the new strings that UI 012 adds in en-gb, cs-cz and sk-sk (constitution IV, plan owner
question 1). Everything else on the feature's screens is mailcow's own text by its legacy key. The
Czech and Slovak values were written by hand for the owner's review; none is machine-translated.
Provider and type names (`Keycloak`, `Generic-OIDC`, `LDAP`) equal the classic interface's
hard-coded option texts. Removed with the classic-interface notices of UI 001:
`auth.signIn.sso.body`, `auth.signIn.sso.link`, `auth.signIn.idpHint.body`,
`auth.signIn.idpHint.link`.

The feature's own strings (`identityProvider.*`, `oauth2.*`) are in
`src/i18n/messages/identity-providers/`, loaded with its routes; the others are in the main files.

| Key | en-gb | cs-cz | sk-sk |
|---|---|---|---|
| `auth.notice.signedOutSso` | You have signed out of this app. You are still signed in at your organisation's sign-in service; on a shared device, sign out there too. | Odhlásili jste se z této aplikace. U přihlašovací služby vaší organizace jste stále přihlášeni; na sdíleném zařízení se odhlaste i tam. | Odhlásili ste sa z tejto aplikácie. V prihlasovacej službe vašej organizácie ste stále prihlásení; na zdieľanom zariadení sa odhláste aj tam. |
| `auth.sso.backToSignIn` | Back to sign-in | Zpět na přihlášení | Späť na prihlásenie |
| `auth.sso.completing` | Completing sign-in… | Dokončuje se přihlášení… | Dokončuje sa prihlásenie… |
| `auth.sso.outcome.cancelled` | The sign-in was cancelled or refused at your organisation's sign-in page. | Přihlášení bylo na přihlašovací stránce vaší organizace zrušeno nebo odmítnuto. | Prihlásenie bolo na prihlasovacej stránke vašej organizácie zrušené alebo odmietnuté. |
| `auth.sso.starting` | Opening your organisation's sign-in page… | Otevírá se přihlašovací stránka vaší organizace… | Otvára sa prihlasovacia stránka vašej organizácie… |
| `enums.auditEventType.identityProviderConnectionTest` | Identity provider connection test | Test připojení k poskytovateli identit | Test pripojenia k poskytovateľovi identít |
| `enums.auditEventType.identityProviderCreation` | Identity provider set up | Poskytovatel identit nastaven | Poskytovateľ identít nastavený |
| `enums.auditEventType.identityProviderDeletion` | Identity provider removed | Poskytovatel identit odebrán | Poskytovateľ identít odstránený |
| `enums.auditEventType.identityProviderSessionEnd` | Single sign-on session ended | Relace jednotného přihlášení ukončena | Relácia jednotného prihlásenia ukončená |
| `enums.auditEventType.identityProviderUpdate` | Identity provider changed | Poskytovatel identit změněn | Poskytovateľ identít zmenený |
| `enums.auditEventType.oauth2ClientCreation` | OAuth2 client added | OAuth2 klient přidán | OAuth2 klient pridaný |
| `enums.auditEventType.oauth2ClientDeletion` | OAuth2 client removed | OAuth2 klient odebrán | OAuth2 klient odstránený |
| `enums.auditEventType.oauth2ClientSecretRegeneration` | OAuth2 client secret renewed | Tajný klíč OAuth2 klienta obnoven | Tajný kľúč OAuth2 klienta obnovený |
| `enums.auditEventType.oauth2ClientTokenRevocation` | OAuth2 client tokens revoked | Tokeny OAuth2 klienta zneplatněny | Tokeny OAuth2 klienta zneplatnené |
| `enums.auditEventType.oauth2ClientUpdate` | OAuth2 client changed | OAuth2 klient změněn | OAuth2 klient zmenený |
| `enums.auditFailureReason.autoCreationOff` | Automatic mailbox creation is off | Automatické vytváření schránek je vypnuto | Automatické vytváranie schránok je vypnuté |
| `enums.auditFailureReason.identityProviderUnavailable` | Identity provider unavailable | Poskytovatel identit není dostupný | Poskytovateľ identít nie je dostupný |
| `enums.auditFailureReason.mailboxCreationFailed` | Mailbox could not be created | Schránku nebylo možné vytvořit | Schránku nebolo možné vytvoriť |
| `enums.auditFailureReason.mailboxNotLinked` | Mailbox not linked to the identity provider | Schránka není propojena s poskytovatelem identit | Schránka nie je prepojená s poskytovateľom identít |
| `enums.auditFailureReason.noEmailAddress` | No e-mail address from the identity provider | Poskytovatel identit nedodal e-mailovou adresu | Poskytovateľ identít nedodal e-mailovú adresu |
| `enums.auditFailureReason.noMatchingMapping` | No matching attribute mapping | Žádné odpovídající mapování atributů | Žiadne zodpovedajúce mapovanie atribútov |
| `enums.auditFailureReason.passwordNotVerifiable` | Password could not be verified | Heslo nebylo možné ověřit | Heslo nebolo možné overiť |
| `enums.auditFailureReason.providerRefused` | Refused by the identity provider | Odmítnuto poskytovatelem identit | Odmietnuté poskytovateľom identít |
| `enums.auditFailureReason.providerReturnedError` | The identity provider returned an error | Poskytovatel identit vrátil chybu | Poskytovateľ identít vrátil chybu |
| `enums.auditFailureReason.signInStateInvalid` | Sign-in expired or already completed | Přihlášení vypršelo nebo už bylo dokončeno | Prihlásenie vypršalo alebo už bolo dokončené |
| `enums.auditFailureReason.singleSignOnNotAvailable` | Single sign-on not available | Jednotné přihlášení není k dispozici | Jednotné prihlásenie nie je k dispozícii |
| `enums.auditTargetType.oauth2Client` | OAuth2 client | OAuth2 klient | OAuth2 klient |
| `enums.authMethod.directoryPassword` | Directory password | Heslo z adresáře | Heslo z adresára |
| `enums.authMethod.directoryPasswordAndSecondFactor` | Directory password and second factor | Heslo z adresáře a druhý faktor | Heslo z adresára a druhý faktor |
| `enums.authMethod.providerPassword` | Password through the identity provider | Heslo přes poskytovatele identit | Heslo cez poskytovateľa identít |
| `enums.authMethod.providerPasswordAndSecondFactor` | Password through the identity provider and second factor | Heslo přes poskytovatele identit a druhý faktor | Heslo cez poskytovateľa identít a druhý faktor |
| `identityProvider.appReturnUrls` | Redirect addresses of this app for single sign-on: allow them at the provider as well | Návratové adresy této aplikace pro jednotné přihlášení: povolte je u poskytovatele také | Návratové adresy tejto aplikácie pre jednotné prihlásenie: povoľte ich u poskytovateľa tiež |
| `identityProvider.changedElsewhere` | a new secret | nový tajný údaj | nový tajný údaj |
| `identityProvider.copyRefused` | The browser did not allow copying. The address is selected: copy it yourself. | Prohlížeč nepovolil kopírování. Adresa je označena: zkopírujte ji sami. | Prehliadač nepovolil kopírovanie. Adresa je označená: skopírujte ju sami. |
| `identityProvider.secretStored` | A secret is stored. Leave the field empty to keep it. | Tajný údaj je uložen. Ponechte pole prázdné, aby zůstal zachován. | Tajný údaj je uložený. Ponechajte pole prázdne, aby zostal zachovaný. |
| `identityProvider.stored` | Stored | Uloženo | Uložené |
| `identityProvider.test.failure.credentialsRejected` | The provider rejected the credentials. | Poskytovatel odmítl přihlašovací údaje. | Poskytovateľ odmietol prihlasovacie údaje. |
| `identityProvider.test.failure.timedOut` | The provider did not answer in time. | Poskytovatel neodpověděl včas. | Poskytovateľ neodpovedal včas. |
| `identityProvider.test.failure.tlsCertificateRejected` | The provider's TLS certificate was not accepted. | TLS certifikát poskytovatele nebyl přijat. | TLS certifikát poskytovateľa nebol prijatý. |
| `identityProvider.test.failure.unexpectedResponse` | The provider gave an unexpected answer. | Poskytovatel odpověděl neočekávaně. | Poskytovateľ odpovedal neočakávane. |
| `identityProvider.test.failure.unreachable` | The provider could not be reached. Check the address and the port. | Poskytovatel není dosažitelný. Zkontrolujte adresu a port. | Poskytovateľ nie je dosiahnuteľný. Skontrolujte adresu a port. |
| `identityProvider.test.noResult` | No result was received within {seconds} seconds. | Do {seconds} sekund nepřišel žádný výsledek. | Do {seconds} sekúnd neprišiel žiadny výsledok. |
| `identityProvider.test.running` | Testing the connection… | Testuji spojení… | Testujem spojenie… |
| `identityProvider.type.genericOidc` | Generic-OIDC | Generic-OIDC | Generic-OIDC |
| `identityProvider.type.keycloak` | Keycloak | Keycloak | Keycloak |
| `identityProvider.type.ldap` | LDAP | LDAP | LDAP |
| `oauth2.added` | Added client access | Přístup klienta byl přidán | Prístup klienta bol pridaný |
| `oauth2.backToList` | Back to the OAuth2 apps | Zpět na OAuth2 aplikace | Späť na OAuth2 aplikácie |
| `oauth2.columns.id` | ID | ID | ID |
| `oauth2.redirectUriEmpty` | Redirect/Callback URL cannot be empty | URL pro přesměrování (callback) nesmí být prázdná | URL na presmerovanie (callback) nesmie byť prázdna |
| `oauth2.title` | OAuth2 | OAuth2 | OAuth2 |
| `problem.identity-provider-not-configured` | No identity provider is configured. | Není nastaven žádný poskytovatel identit. | Nie je nastavený žiadny poskytovateľ identít. |
| `problem.identity-provider-session-ended` | Your single sign-on session has ended. Please sign in again. | Vaše relace jednotného přihlášení skončila. Přihlaste se prosím znovu. | Vaša relácia jednotného prihlásenia skončila. Prihláste sa prosím znova. |
| `problem.identity-provider-unavailable` | Your organisation's sign-in service cannot be reached. Please try again in a few minutes. | Přihlašovací služba vaší organizace není dostupná. Zkuste to prosím za několik minut znovu. | Prihlasovacia služba vašej organizácie nie je dostupná. Skúste to prosím o niekoľko minút znova. |
| `problem.sign-in-state-invalid` | The sign-in has expired or was already completed. Please start it again. | Přihlášení vypršelo nebo už bylo dokončeno. Začněte prosím znovu. | Prihlásenie vypršalo alebo už bolo dokončené. Začnite prosím znova. |
| `problem.single-sign-on-not-available` | Single sign-on is not offered on this server. | Jednotné přihlášení není na tomto serveru k dispozici. | Jednotné prihlásenie nie je na tomto serveri k dispozícii. |
| `validation.byParam.notFound.resource.mailboxTemplate` | This mailbox template does not exist. | Tato šablona schránky neexistuje. | Táto šablóna schránky neexistuje. |
| `validation.byParam.secretRequired.reason.addressChanged` | Enter it again: it would be sent to a new address. | Zadejte jej znovu: byl by odeslán na novou adresu. | Zadajte ho znova: bol by odoslaný na novú adresu. |
| `validation.byParam.secretRequired.reason.noStoredSecret` | Required: no secret is stored for this provider type yet. | Povinné: pro tento typ poskytovatele zatím není uložen žádný tajný údaj. | Povinné: pre tento typ poskytovateľa zatiaľ nie je uložený žiadny tajný údaj. |
| `validation.byParam.secretRequired.reason.typeChanged` | Required: the provider type changes. | Povinné: mění se typ poskytovatele. | Povinné: mení sa typ poskytovateľa. |
| `validation.duplicate` | This value is entered more than once. | Tato hodnota je zadána vícekrát. | Táto hodnota je zadaná viackrát. |
| `validation.format.hostName` | Enter a valid host name or IP address. | Zadejte platný název hostitele nebo IP adresu. | Zadajte platný názov hostiteľa alebo IP adresu. |
| `validation.format.httpUrl` | Enter an absolute address starting with http:// or https://. | Zadejte úplnou adresu začínající http:// nebo https://. | Zadajte úplnú adresu začínajúcu http:// alebo https://. |
| `validation.format.keycloakRealm` | Enter the realm name without a slash. | Zadejte název realmu bez lomítka. | Zadajte názov realmu bez lomky. |
| `validation.format.keycloakVersion` | Enter a version of up to four numbers separated by dots, for example 26.0.7. | Zadejte verzi z nejvýše čtyř čísel oddělených tečkami, například 26.0.7. | Zadajte verziu z najviac štyroch čísel oddelených bodkami, napríklad 26.0.7. |
| `validation.format.ldapAttribute` | Enter an attribute name: a letter followed by letters, digits or hyphens. | Zadejte název atributu: písmeno, za ním písmena, číslice nebo pomlčky. | Zadajte názov atribútu: písmeno, za ním písmená, číslice alebo spojovníky. |
| `validation.format.ldapFilter` | Enter a filter that starts with ( and ends with ), with balanced parentheses. | Zadejte filtr, který začíná znakem ( a končí znakem ), s vyváženými závorkami. | Zadajte filter, ktorý začína znakom ( a končí znakom ), s vyváženými zátvorkami. |
| `validation.format.oauthErrorCode` | The provider returned an invalid error code. | Poskytovatel vrátil neplatný chybový kód. | Poskytovateľ vrátil neplatný chybový kód. |
| `validation.format.redirectUri` | Enter an absolute URI with a scheme, without # and without spaces. | Zadejte úplnou URI se schématem, bez # a bez mezer. | Zadajte úplnú URI so schémou, bez # a bez medzier. |
| `validation.format.scopeList` | Enter scope names separated by single spaces, without quotation marks or backslashes. | Zadejte názvy scope oddělené jednou mezerou, bez uvozovek a zpětných lomítek. | Zadajte názvy scope oddelené jednou medzerou, bez úvodzoviek a spätných lomiek. |
| `validation.secretRequired` | Enter the secret again. | Zadejte tajný údaj znovu. | Zadajte tajný údaj znova. |
