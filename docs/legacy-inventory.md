# Legacy mailcow UI — inventory

Reference for parity checks in feature specs. Snapshot taken 2026-10-18 from the FeldHost fork
(`feldhost-202609a`, upstream tag `2026-09a`, `db_version = 18082026_1200`). Paths are relative
to the mailcow-dockerized repo's `data/` directory.

The backend side (the `/api/v1` catalogue, dependencies, internal endpoints and DB schema) is
documented in `mailcow-rest-v2/docs/legacy-inventory.md`.

## Features by role

- **Admin**
  - Dashboard: container start/stop/restart, host stats, vmail disk usage, 13 log tabs.
  - Mail setup: domains, domain/mailbox templates, mailboxes, resources, alias domains, aliases,
    sync jobs, sieve filters, BCC maps, recipient maps, TLS policy maps.
  - Domain settings: quotas and limits, relay/backup MX, GAL, relayhost, ratelimit,
    allow/block lists, footer, MTA-STS, quota-warning BCC, tags.
  - Mailbox settings: protocol access, user ACL, custom attributes, Pushover, rename, ratelimit,
    sender ACL, forced password change and forced 2FA.
  - System: admins, domain admins, API keys, identity provider (Keycloak, generic OIDC, LDAP with
    attribute mapping, provisioning and sync), OAuth2 clients, Rspamd UI password, routing
    (relayhosts, transports, transport check), DKIM, forwarding hosts, fail2ban, quarantine
    settings, quota notifications, Rspamd settings maps, customisation (logos, UI texts, app
    links, login page, IP check), password policy and reset templates, system/mass mail, global
    regex filters, CORS.
  - Queue: Postfix mail queue (list, flush, delete, postcat).
  - Login-as (dual login) and domain-admin SSO tokens.
- **Domain admin**: the mailbox page, gated by `da_acl` (20 flags, e.g. login_as, ratelimit,
  spam_policy, protocol_access, relayhost, alias_external_goto). Also own password,
  TOTP/WebAuthn/Yubi OTP, FIDO2 keys, and DNS diagnostics (`web/inc/ajax/dns_diagnostics.php`).
- **Mailbox user**, gated by `user_acl` (15 flags):
  - Auth: password, 2FA, FIDO2, webmail SSO, Apple mobileconfig, recent logins, recovery email.
  - Send-as details and settings: tagging, TLS in/out, quarantine notifications, EAS/SOGo reset.
  - Temporary aliases, spam filter, sync jobs, app passwords, Pushover, quarantine.
- **Fork-only (FeldHost)**: ISPConfig DKIM DNS push (`web/inc/lib/ispconfig.php`), FeldHost
  branding.
- **No UI today**: ARC (reuses the DKIM Redis keys) and full-text search.

## Auth and sessions

- PHP sessions in Redis (`MCSESSID`, SameSite=Lax, 3 h lifetime, user-agent pinning).
- Login tries admin → domain admin → app password → mailbox user. The pending 2FA step is
  held in the session.
- 2FA: TOTP, Yubi OTP, WebAuthn. FIDO2 passwordless login.
- Identity providers: Keycloak, generic OIDC, LDAP (`authsource=ldap` mailboxes authenticate
  against LDAP).
- SOGo SSO through `sogo-auth.php`. Dual login for admin/domain-admin impersonation.
- Password hashes: `{BLF-CRYPT}` by default (`MAILCOW_PASS_SCHEME`) or SSHA/SSHA256/SSHA512.
  Verification also accepts ARGON2*, *-CRYPT, MD5, PLAIN, LDAP-MD5, PBKDF2(-SHA512).

## i18n

- `web/lang/lang.<locale>.json`: nested JSON with 23 sections and 1,382 keys in en-gb, in 33
  languages. cs and sk are complete. Backend messages are i18n keys.
- The files are served publicly on the same origin as `/lang/lang.<code>.json` (verified on the
  staging host: 200, `application/json`). mailcowui-ng loads them at runtime and uses them
  verbatim, in all 33 languages (constitution IV 1.3.0, `docs/conventions.md` "Translations and
  forms"). The fork's `en-gb`, `cs-cz` and `sk-sk` have 1,391 keys each; its texts say
  "FeldHost™ Mailhosting" where upstream says "mailcow". Upstream `2026-09a` `sk-sk` lacks 187
  of 1,390 keys, which fall back to `en-gb` as in the classic interface.

## Frontend today

- Twig 3 server rendering (79 templates, 10.9k lines), jQuery 3.6, Bootstrap 5.1 (Lumen theme
  plus custom dark mode), DataTables 1.13 Responsive, Chart.js 3.7, bootstrap-select. Assets are
  minified at runtime in PHP.
- Own JS is about 8.1k lines; vendor JS about 36k.
- Mobile problems: `user-scalable=0`, huge modals (`modals/mailbox.twig` is 1,349 lines), 47
  DataTables relying on row collapse, collapsed cards used as tabs, only 14 `@media` rules.
