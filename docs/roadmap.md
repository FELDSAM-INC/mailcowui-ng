# mailcowui-ng roadmap

## Current implementation and remaining scope

The application now registers routes for feature areas 001–013 in
[`src/app/router/routes.ts`](../src/app/router/routes.ts), including the
[system-settings catalogue](../src/features/system-settings/catalogue.ts). These are implemented
areas, not a declaration that all acceptance tasks or release checks are complete. Per-feature
`specs/NNN-*/tasks.md`, `quickstart.md` and [checkpoint notes](checkpoints/) record the evidence
and remaining work. For example, system-settings polish/manual acceptance and performance tasks
still need to be read individually rather than inferred from catalogue presence.

UI 014 remains the [planned cutover](../specs/014-cutover/spec.md); its deployment switch and
redirect tooling are not supplied by the current deployment helper. Backend feature 014 has a
different scope: optional internal-endpoint takeover. Neither happens merely by deploying UI
001–013. Use the [README](../README.md) for current setup, test and deployment instructions.

## Architecture

mailcowui-ng is a static Vue SPA. Its only backend is mailcow REST API v2 (repository
`mailcow-rest-v2`, base path `/api/v2`), served on the same origin. The legacy UI keeps
working alongside the new app; replacing its entry routes requires the separate cutover work.

```
              ┌──────────────── nginx-mailcow ────────────────┐
 browser ───► │ /ng/        → mailcowui-ng static assets       │
              │ /api/v2/    → mailcow-rest-v2                  │
              │ legacy UI, /api/v1 → php-fpm-mailcow           │
              └────────────────────────────────────────────────┘
```

These are the implemented paths. Vite builds with base `/ng/`; the production image serves static
files through `ng-mailcow`. The API repository's
[`site.restv2.custom`](https://github.com/FELDSAM-INC/mailcow-rest-v2/blob/main/deploy/nginx/site.restv2.custom) nginx include routes
both services without patching upstream mailcow files. The classic UI and internal endpoints
remain on php-fpm-mailcow.

The current sidebar groups and content tabs come from
[`sections.ts`](../src/app/navigation/sections.ts); access rules remain in the
[navigation catalogue](../src/app/navigation/catalogue.ts). The old Home page is removed: `/`
resolves to the role's working page (System & Containers, Domains, or account password settings).
Account settings and passkeys are reached from the user menu; approved deep links remain valid.

## Features

Each UI feature depends on the API feature with the same number, specified in mailcow-rest-v2.
A UI feature can start once that feature's contract is merged; it does not have to wait for
the API implementation. Until then it is built and tested against a mock generated from the
contract.

| # | UI feature | Depends on API | Legacy screens replaced |
|---|---|---|---|
| 001 | Sign-in, app shell, API keys | 001 | Login (all roles, 2FA step), navigation, language/theme, API key admin |
| 002 | Domains | 002 | Admin › Mail setup › Domains, edit domain |
| 003 | Mailboxes | 003 | Mail setup › Mailboxes, edit mailbox |
| 004 | Aliases, alias domains, resources | 004 | Mail setup › Aliases / Alias domains / Resources |
| 005 | Account and mailbox self-service | 005 | Password/recovery/2FA, app passwords, temporary aliases, filters, client setup and mailbox settings |
| 006 | Quarantine & spam policy | 006 | Quarantine page, user spam filter, policy lists |
| 007 | Administrators and domain administrators | 007 | Account lifecycle, domain-admin permissions, login-as and SSO tokens |
| 008 | Sync jobs | 008 | Sync jobs (admin and user) |
| 009 | Routing & address rewriting | 009 | System › Routing, BCC, recipient maps, TLS policy maps |
| 010 | DKIM, MTA-STS, DNS | 010 | System › DKIM, edit domain › MTA-STS, DNS diagnostics |
| 011 | Monitoring & operations | 011 | Dashboard, logs, queue, fail2ban |
| 012 | Identity providers & OAuth2 | 012 | System › Identity provider, OAuth2 apps |
| 013 | System settings | 013 | System › Customise, password policy, quota notifications, Rspamd maps, filters |
| 014 | Cutover | — | Redirect the legacy UI to mailcowui-ng |

## Historical input for the first `/speckit-specify`

This prompt records the original starting scope, before features 002–013 and the navigation
redesign. Its placeholder/Home requirements and narrow exclusions are historical, not current
product behavior. No new contributor needs to rerun it.

This is the historical input. Its language list (English, Czech, Slovak) is superseded by
constitution IV 1.3.0: the app offers every language mailcow ships and uses mailcow's translations
verbatim (`docs/conventions.md`, "Translations and forms").

```
/speckit-specify Sign-in, application shell and API key management for mailcowui-ng, the new
mobile-first web app for an existing mailcow-dockerized server. Its only backend is mailcow
REST API v2 feature 001 (authentication, sessions, API keys, identity, branding). The legacy
mailcow UI keeps working next to it.

Users: server administrators, domain administrators and mailbox users. They already have
accounts, and some have TOTP, WebAuthn or Yubi OTP second factors.

User stories:
1 (P1) An administrator opens the app on a phone and sees the operator's branding (name, logo,
  colours). They sign in with their existing username and password, complete their second
  factor if they have one, land on a home screen with navigation for their role, and can sign
  out. Wrong credentials, throttling and expired sessions produce clear, translated messages.
2 (P1) Domain administrators and mailbox users sign in the same way and see only the
  navigation their role and ACL flags allow. Sections that later features will fill show a
  placeholder, never a broken link.
3 (P2) Any signed-in user switches the language (English, Czech, Slovak) and the theme (light,
  dark, system). The choice is saved to their profile and follows them to other devices. Before
  sign-in, the browser language is used.
4 (P2) An administrator manages API keys on a phone or desktop: list, create (name, read-only or
  read-write, expiry, allowed networks), copy the secret shown once, inspect and revoke.
5 (P3) An administrator browses the sign-in and API key audit log, filtered by user, event
  type and time range.

Out of scope: managing domains, mailboxes or other mail objects; enrolling new second factors;
identity-provider login.

Constraints: every screen is fully usable at 360 px width and passes WCAG 2.2 AA checks. The
app uses only operations of the mailcow-rest-v2 contract. docs/legacy-inventory.md describes
the current UI.
```
