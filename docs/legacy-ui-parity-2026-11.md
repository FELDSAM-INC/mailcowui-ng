# Classic / modern UI parity review — mailcow 2026-11

Reviewed on 2026-11-16 against upstream tag `2026-11`
(`88fbaa459a5cd5843c2c7cb06ee2928e2a78b9e6`). The API baseline was
`bf96875720d547a59bc85a7e9ad2973b80a8db8e`; the UI baseline was
`f5deb113d4c7f03a3035370c2ada1fb678d0657a`.

The classic UI ran on the maintainer's development installation. Browser sessions
covered administrator, domain-administrator and mailbox-user views. Requests that
could modify the installation were blocked; the classic mailbox/domain search
POST endpoints were allowed because they only read data. No live configuration
was saved, mail sent, sync run started, or service restarted.

The modern UI ran as a production build against isolated, contract-backed mock
scenarios. Additional fixtures enabled the 2026-11 capabilities; older scenarios
correctly hide those controls. Inventories captured page sections, fields,
options and edit states. Functional browser tests exercised saves, validation,
conflicts, permission changes and error recovery. Screenshots were inspected for
LDAP, Keycloak, mapping order and desktop/mobile group settings.

The initial review missed first-time provider creation: offboarding and group
controls were available only after saving the provider. Follow-up coverage now
exercises LDAP and Keycloak creation with these fields visible immediately,
atomic API persistence, nested validation errors and reload/readback. The shared
fields are reused for setup and subsequent edits. This correction requires the
updated API and UI images together.

## Confirmed defects corrected

| Finding | Correction |
| --- | --- |
| Provider configuration was one long, poorly grouped form. | Connection, LDAP user lookup, login, mailbox templates and synchronization now have shared section headings and separators, in both view and edit modes. |
| The mapping Add button appeared before the default template. | Default template comes first; Add now belongs to the attribute mapping heading immediately above its rows. |
| Offboarding and group synchronization disappeared while the provider editor was open. | LDAP identity/account status, offboarding and groups remain visible as separate sections. One section is edited at a time, with an explanation when another editor is open. |
| Provider saves could leave synchronization settings cached with an old version. | Provider writes invalidate the synchronization query. Section saves preserve changed-fields-only updates and version-conflict handling. |
| Global sync controls were difficult to discover and bandwidth used the wrong units/description. | Options → Sync jobs and Sync jobs → Global settings open the same page. Parallel processes are 1–32; bandwidth is KB/s **per process**, converted to the API's bytes/s. Zero means unlimited. |
| An empty bandwidth input could become zero during numeric conversion. | Required/range validation runs before conversion; non-integer parallel counts are rejected. |
| Password-provider preset help had been replaced by generic OAuth advice. | Password presets use upstream's original app-password/IMAP guidance. OAuth advice appears only for OAuth presets. |
| The bundled language fallback predated the new mailcow features. | Refreshed from the unmodified upstream 2026-11 tag. Older installation files are normalized for renamed sync-job keys before merging languages, preserving operator translations. The old free-text parameter editor retains its original applicable hint. |
| API v1 key access levels showed raw translation identifiers. | List, detail and editor use the shared legacy-aware text resolver for Read-Only/Read-Write Access. |

## View and form coverage

“Compared” below means the classic controls and modern field/section equivalents
were reviewed, supported by browser inventory and the feature's functional tests.
It does not mean every possible data combination or external integration was run.
For new group/grant and API-key detail variants without matching classic sample
objects, the classic Twig/JavaScript form definitions supplied the field inventory.

| Area | Views/forms compared | Roles |
| --- | --- | --- |
| Domains | List, create, edit, quotas, relay options, tags, rate limits, spam policy, quota copies, footer, MTA-STS | Admin, domain admin |
| Domain templates | List, create/edit, quotas, DKIM and relay defaults | Admin |
| Mailboxes | List, create/edit, shared mailbox, authentication, quotas, protocols, ACL, SMTP access, sender permissions, relay, rename, rate limit | Admin, domain admin |
| Mailbox templates | List, create/edit, protocol, quarantine and encryption defaults | Admin, domain admin |
| Mailbox groups | List, create/edit, members, distribution address, send-as, IMAP/SOGo grants, template priority and identity-managed restrictions | Admin, domain admin |
| Aliases | List, create/edit, destination modes, send-as, visibility, internal-only and comments | Admin, domain admin |
| Domain aliases | List, create/edit, target domain, rate limits | Admin, domain admin |
| Resources | List, create/edit, kind and booking limits | Admin, domain admin |
| Sieve filters | List, create/edit, script, preset insertion, type and activation | Admin, domain admin; personal active-script view for mailbox user |
| Sync jobs | List, create/edit, source selection, credentials, interval, timeouts, bandwidth, flags, parameters, priority, actions and logs | All three roles, subject to capabilities |
| Sync sources | List, create/edit, provider presets, scope, domains/users, IMAP/TLS, password/OAuth modes and connection controls | All three roles, subject to capabilities |
| Global sync settings | Parallel processes and bandwidth per process | Admin |
| Email routing | BCC maps, recipient maps and TLS policy maps, including create/edit and actions | Admin; BCC permission for domain admin |
| System routing | Sender-dependent transports, transport maps, forwarding hosts and connection tests | Admin |
| Quarantine | List, message detail, release/delete/report actions, settings, notifications, statistics | All three roles within scope; configuration/statistics for admin |
| Administrators | List, create/edit, password, activation and forced security actions | Admin |
| Domain administrators | List, create/edit, assigned domains and ACL | Admin |
| API keys | REST v2 create/detail/revoke; v1 create/edit/regenerate, network restrictions and protected service keys | Admin |
| Identity providers | LDAP, Keycloak and generic OIDC setup/edit, mappings, secrets, connection tests; LDAP/Keycloak offboarding, groups and sync controls | Admin |
| OAuth2 apps | List, create/edit, redirect addresses, secret and deletion | Admin |
| DNS and keys | DNS diagnostics, DKIM generation/import/copy/replace/export/delete, publication, MTA-STS | Roles permitted by API |
| System/container operations | Dashboard, container actions, updates, addresses, logs and Rspamd view | Admin |
| Mail queue / Fail2Ban | Message inspection/actions; parameters, regexes, bans and allowlist | Admin |
| Audit log | List, filters, detail and contextual histories | Admin |
| Options | Quota notification defaults, Rspamd settings/effective map, password policy and recovery email templates, CORS and IP check | Admin |
| Customize | Logos, colours, UI texts, login page, announcements and application links | Admin |
| System mail / global filters | Compose/jobs/detail, recipients; filter-map and global-Sieve editors | Admin |
| Mailbox overview/setup | Overview, allowed protocols, application setup and Apple profiles | Mailbox user |
| Mailbox settings | Tagged mail, quarantine notifications, encryption, spam policy, temporary aliases and Pushover | Mailbox user |
| Account security | Password, recovery email, app passwords, second-factor enrollment, passkeys and recent logins | Roles permitted by API |
| Authentication | Password/provider sign-in, second-factor challenge, forced actions, recovery/reset and session expiry | Anonymous / pending / signed-in variants |

## Intentional differences retained

- Administrator mailbox pages omit self-service panels that the maintainer moved
  behind **Login as**; the mailbox user's own pages retain them.
- Default per-mailbox domain quota is intentionally excluded by the prior product
  decision and existing API regression test; it is not an accidental omission.
- Navigation follows the agreed sidebar/tab organization rather than copying
  classic navigation. Password/recovery email remain in the user menu; the
  personal Active Filter screen is not restored to that menu.
- App passwords are server-generated and shown once; the classic typed-secret
  workflow is intentionally replaced.
- History remains on detail/edit screens. Row text links, old back links and
  duplicate tab buttons are not restored.
- Mailbox groups, shared mailboxes, sync sources, structured parameters, identity
  synchronization and v1 key management are capability-gated. Their absence on an
  older server or an unauthorized account is expected.

## Validation and limits

- Focused unit tests: **713 passed** across identity providers, sync jobs,
  navigation, translations, v1 keys and mailbox groups.
- Broad desktop functional browser pass: 908 passed initially; the seven failures
  were one response-read race in the alias test and six tests still asserting
  pre-2026-11 sync-job labels. Those tests were corrected and rerun.
- Additional authentication/DNS/operations/affected-form pass: 469 passed initially;
  one stale domain-admin return-route assertion was corrected and passed in the
  final focused run. One scenario was skipped by its existing condition.
- Desktop/mobile identity-provider and forced-action checks: 78 passed initially;
  two mobile bulk-result tests needed to open the existing action menu before
  selecting an action. Their corrected rerun passed.
- Type checking, production build, changed-file ESLint/formatting, translation
  completeness and generated API contract checks passed.
- The browser passes above overlap; their counts must not be added as distinct tests.
- Performance and contrast checks were excluded at the maintainer's request.

The modern write tests use isolated responses, not the live installation. Real
LDAP/Keycloak/OIDC provisioning, group/offboarding execution, third-party IMAP/OAuth
connections, mail delivery and SOGo grant propagation still need an integration
environment configured for those providers. This review does not claim those
external workflows passed merely because their forms rendered or mock saves
succeeded. No release or deployment is part of this review.

Raw inventories and screenshots are kept privately outside the Git worktree;
they can contain account metadata. Only this sanitized review is committed.
Temporary classic-UI sessions were invalidated and their local cookie files
removed after the review.
