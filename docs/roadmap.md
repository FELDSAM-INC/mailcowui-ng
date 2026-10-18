# mailcowui-ng roadmap

## Architecture

mailcowui-ng is a static Vue SPA. Its only backend is mailcow REST API v2 (repository
`mailcow-rest-v2`, base path `/api/v2`), served on the same origin. The legacy UI keeps
working until the last feature lands.

```
              ┌──────────────── nginx-mailcow ────────────────┐
 browser ───► │ /ng/        → mailcowui-ng static assets       │
              │ /api/v2/    → mailcow-rest-v2                  │
              │ legacy UI, /api/v1 → php-fpm-mailcow           │
              └────────────────────────────────────────────────┘
```

Paths are placeholders; the routing decision belongs to the plan of feature 001.

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
| 005 | Mailbox self-service | 005 | User page (auth, settings, temporary aliases, app passwords) |
| 006 | Quarantine & spam policy | 006 | Quarantine page, user spam filter, policy lists |
| 007 | Domain administrators | 007 | System › Domain admins, login-as |
| 008 | Sync jobs | 008 | Sync jobs (admin and user) |
| 009 | Routing & address rewriting | 009 | System › Routing, BCC, recipient maps, TLS policy maps |
| 010 | DKIM, MTA-STS, DNS | 010 | System › DKIM, edit domain › MTA-STS, DNS diagnostics |
| 011 | Monitoring & operations | 011 | Dashboard, logs, queue, fail2ban |
| 012 | Identity providers & OAuth2 | 012 | System › Identity provider, OAuth2 apps |
| 013 | System settings | 013 | System › Customise, password policy, quota notifications, Rspamd maps, filters |
| 014 | Cutover | — | Redirect the legacy UI to mailcowui-ng |

## Input for the first `/speckit-specify`

Run this after mailcow-rest-v2 feature 001 has its contract (after its `/speckit-plan`).

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
