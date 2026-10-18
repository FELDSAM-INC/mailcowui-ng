# Feature Specification: Cutover from the Classic Interface

**Feature Branch**: `main` (no feature branches, constitution 1.1.0)

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Cutover for mailcowui-ng (UI feature 014, roadmap: 'Redirect the
legacy UI to mailcowui-ng'). Once UI features 001–013 have shipped and parity is confirmed, the
legacy mailcow UI is redirected to the new app without breaking anything that must stay in
legacy. Scope: a complete mapping of legacy UI addresses, including deep links with parameters,
to the new app's screens, with a defined fallback; what must not be redirected (`/api/v1`, the
internal endpoints, quarantine quick-release links in old e-mails, SOGo, autodiscover and
mobileconfig, MTA-STS and the like); an operator-controlled switch (on, off, per role) and
rollback without data loss; the links the new app shows to legacy-only pages while features are
incomplete, removed at cutover; telling users about the change through the branding
announcement; verification by a route-by-route smoke test and monitoring of not-found responses
after cutover; deployment of the redirect without patching upstream mailcow files, consistent with
both constitutions and with the deployment decided in mailcow-rest-v2 feature 001's plan; the
preconditions: features 001–013 shipped and parity confirmed. Orchestrator input: legacy `/api/v1`
keys stay managed only in the legacy UI, so the legacy API key screen must stay reachable for
administrators; the new app calls the legacy UI 'the classic interface'."

The actors are the three roles of UI feature 001 (**administrators**, **domain administrators**
and **mailbox users**), the **operator** who runs the mailcow installation, and **external
systems** that hold links to the installation or call its addresses: mail clients, remote mail
servers, `/api/v1` integrations, billing panels, applications that use mailcow as an OAuth2
provider, identity providers, firewalls that fetch the ban list, and the webmail.

Terms used in this specification:

- **Classic interface**: the legacy mailcow UI, served by the legacy PHP container. User-facing
  text uses this name (UI feature 001, FR-090).
- **The app**: mailcowui-ng, served at its own base address on the same host names. mailcow-rest-v2
  feature 001's plan (research R23) sets that address to `/ng/`.
- **Classic address**: a path and query string that the classic interface answers.
- **Mapping table**: the authoritative list of classic addresses that are redirected. Each row
  names the roles that use the address (its **used-by set**), its target in the app and the
  parameters carried over (section "Route Mapping").
- **Exclusion list**: the addresses that are never redirected (section "Exclusions").
- **Cutover switch**: the operator's on/off setting, one per role. **Cutover is on for an
  address** when the switch is on for every role in the address's used-by set.
- **Classic interface entry**: a documented address that lets a browser use the classic interface
  after cutover (FR-031 to FR-035). The mark it leaves in the browser is the **classic pass**.
- **Readiness register**: the list of every legacy screen and action with its disposition in the
  app, signed off before cutover (FR-002).
- **Classic link register**: the list of every place where the app links to the classic interface
  (FR-036).
- **Cutover-ready release**: the app release that may be used with cutover on (FR-003).
- **Arrival notice**: the app's notice for people who arrive through a redirect (FR-041).

## Clarifications

### Session 2026-10-18

- Q: Where does the app live after cutover: at the root of the host, or at its own base address
  with the classic addresses redirected to it? → A: It stays at its own base address, the one
  mailcow-rest-v2 feature 001's plan decided (`/ng/`). Classic addresses are redirected to the
  matching app address on the same host name. The root `/` becomes a redirect to the app's start
  address. (agent decision: the root is shared with `/api/v1`, the webmail, autodiscover and other
  paths that must keep working; moving the app would change every address it has published since
  feature 001; rollback then only means removing redirects.)
- Q: What kind of redirect is used, and for which requests? → A: A temporary redirect that browsers
  and intermediaries must not cache, and only for GET and HEAD requests. Every other method (form
  submissions, the webmail's sign-out, calls made by classic pages still open) reaches the classic
  interface unchanged. (agent decision: browsers keep permanent redirects indefinitely, which would
  defeat rollback; a form submitted at the moment of the switch must not be lost.)
- Q: How does the per-role switch apply when the web server cannot see who is signed in? → A:
  There are three switches: administrators, domain administrators and mailbox users. Each classic
  address has a fixed used-by set in the mapping table, for example administrators for `/admin/…`,
  domain administrators for `/domainadmin/…`, mailbox users for `/` and `/user`, and all three roles
  for `/quarantine`. An address is redirected only when the switch is on for every role in its set.
  Turning all three off is the rollback. The recommended order is administrators, then domain
  administrators, then mailbox users. (agent decision: a role still on the classic interface must
  never lose a page it uses; administrators first gives a pilot group that also has the classic
  interface entry.)
- Q: May one role be switched on before features 001–013 have all shipped, when that role's
  screens are complete? → A: No. Switching any role on requires the cutover-ready release, which
  presupposes UI features 001–013 released and deployed with their API features, a signed-off
  readiness register without deferred entries, and a passing smoke test (FR-001 to FR-003). (agent
  decision: the roadmap keeps the classic interface until the last feature lands, and the feature
  request names these preconditions.)
- Q: How do administrators keep managing the `/api/v1` keys, which only the classic interface
  manages? → A: Through the classic interface entry. It marks the browser so that classic addresses
  are not redirected for the rest of that browser session, at most 8 hours, and opens the classic
  administrator sign-in. From there the administrator reaches the configuration page with the API
  section as before. The app's API keys screen tells administrators that `/api/v1` keys are managed
  in the classic interface and links to the entry. Retiring `/api/v1` keys is out of scope.
  (orchestrator decision: existing `/api/v1` integrations depend on these keys. agent decision on the
  mechanism: excluding only the configuration page would not work, because reaching it needs the
  classic administrator sign-in and dashboard, which are redirected.)
- Q: Which classic sign-in flows stay in the classic interface? → A: The root and the role sign-in
  addresses are not redirected when they carry a classic sign-in flow parameter: `oauth` (sign-in
  for an application that uses mailcow as its OAuth2 provider), `iam_sso` or an identity-provider
  callback with `code` and `state` (classic single sign-on through its registered return URL), and
  `cancel_tfa_login` or `cancel_tfa_setup`. The root carrying `mobileconfig` (the sign-in step
  before the Apple connection profile download, alone or with `only_email` and `app_password`) is
  instead redirected to the Apple connection profile screen in My account (UI feature 005) once
  mailbox users are switched on, with the profile options preselected. The download address
  `/mobileconfig.php` itself stays excluded. (agent decision: the OAuth2 endpoints and consent page
  stay in the legacy container and need a classic session (API feature 012, FR-049), and API 012
  keeps the legacy return URL registered. orchestrator decision: Apple connection profiles and the
  client setup guide are in scope of API and UI feature 005, so the app replaces the classic profile
  sign-in; `/mobileconfig.php` stays because the classic flow and external links still use it.)
- Q: How are links in e-mails already sent, and links held by external systems, handled? → A:
  Quarantine quick release and delete links (`/qhandler/…`) are never redirected and keep working in
  the classic interface. Password reset links (`/reset-password?token=…`) and domain-administrator
  single sign-on links (`?sso_token=…`) are redirected to the app's reset screen and one-time
  sign-in landing, with the token carried over. (agent decision: API feature 006 keeps the hash
  pages in the legacy container and never exposes the hash; API features 005 and 007 share reset and
  single sign-on tokens between both interfaces, and UI features 005 and 007 provide the target
  screens.)
- Q: What happens to a classic address that the mapping table does not cover? → A: Inside the
  classic interface's own address families (`/admin/…`, `/domainadmin/…`, `/edit/…`) an unmapped
  address is redirected to the role's start screen in the app with a notice that the page has
  moved. Every other address keeps its current behaviour, including "not found". There is no
  catch-all redirect. (agent decision: a catch-all would capture internal and operator-specific
  paths, such as the webmail's sign-in verification, which runs through the same web server.)
- Q: How are users told about the change? → A: Through the operator's branding announcement, which
  both interfaces show, using ready-made texts in English, Czech and Slovak for two phases: before
  the switch (at least 7 days ahead, naming the date) and after it (for at least 14 days). In
  addition, the app shows a translated arrival notice to people who arrive through a redirect, on at
  most three visits per device or until they choose "Don't show again". (agent decision: the
  announcement is the operator's existing channel and reaches users of both interfaces; the arrival
  notice reaches people who missed it and is translated, as constitution IV requires; the limit keeps
  it from becoming permanent noise for people who reach the app by typing the host name.)
- Q: How long is the cutover monitored, and what triggers a rollback? → A: For 14 days after each
  switch change, the operator reviews the not-found and fallback report daily against a 7-day
  baseline taken before the change. A rollback is recommended when an excluded address behaves
  differently from its baseline, when the app or the API is unavailable for more than 5 minutes,
  or when a role cannot complete a task that the readiness register lists as available in the
  app. (agent decision: two weeks cover weekly routines and many quarantine-notification cycles;
  concrete triggers make the decision repeatable.)
- Q: What happens to the app's links to the classic interface at cutover? → A: The cutover-ready
  release removes every link to a redirected classic address or replaces it with the app's own
  screen. Only links through the classic interface entry, for capabilities that the readiness
  register keeps in the classic interface (initially the `/api/v1` keys), and links to excluded
  addresses (webmail, Rspamd's own interface, the `/api/v1` documentation) remain. The app never
  needs to know whether cutover is on. (agent decision: a link to a redirected address would send
  the user back into the app; links that work in every switch state allow per-role cutover and
  rollback without a new app release.)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Classic bookmarks and links open the matching screen of the app (Priority: P1)

After cutover, an administrator opens a bookmark to the classic "edit mailbox" page of
`john@example.org`. The browser lands on that mailbox's detail screen in the app, signing in first
if needed. A mailbox user whose webmail session has ended is sent by the webmail to the classic
user page and arrives at My account in the app. A billing panel keeps redirecting customers to the
classic domain-administrator address with a single sign-on token, and they arrive signed in to the
app. A password reset e-mail sent shortly before the switch still works, because its link leads to
the app's reset screen.

**Why this priority**: Bookmarks, documentation, links from the webmail and links from external
systems point at classic addresses. Without a mapping, cutover would break all of them.

**Independent Test**: With cutover on for all roles, request every row of the mapping table on
every host name of a test installation, follow the redirect and confirm in the app that the
documented screen opens for the identifier in the address, signed out and signed in, on a 360 px
and a desktop viewport.

**Acceptance Scenarios**:

1. **Given** cutover is on for administrators and domain administrators and an administrator is
   signed in to the app, **When** they open `/edit/mailbox/john@example.org`, **Then** the app's
   mailbox detail screen for `john@example.org` opens and the address bar shows the app's address.
2. **Given** cutover is on for administrators and nobody is signed in, **When** someone opens
   `/admin/queue`, **Then** the app's administrator sign-in screen opens, and after a successful
   sign-in the mail queue screen opens.
3. **Given** cutover is on for mailbox users, **When** the webmail sends a user whose webmail session
   has ended to `/user`, **Then** the app opens My account, after sign-in if needed.
4. **Given** cutover is on for mailbox users and a reset link `/reset-password?token=…` that is still
   valid, **When** the user opens it, **Then** the app's password reset screen opens with that token,
   the token disappears from the address bar, and the user can set a new password.
5. **Given** cutover is on for domain administrators, **When** a billing panel sends a customer to
   `/domainadmin?sso_token=…` with a fresh token, **Then** the app's one-time sign-in landing opens
   with that token and signs the domain administrator in (UI feature 007).
6. **Given** cutover is on for all roles, **When** someone opens `/edit/unknown/42`, **Then** the app's
   start screen opens with a notice that the requested page has moved and has no exact counterpart.
7. **Given** cutover is on for administrators only, **When** anyone opens `/quarantine`, **Then** the
   classic quarantine page answers as before, because domain administrators and mailbox users also
   use that address.
8. **Given** a bookmark to a mailbox that has since been deleted, **When** it is opened after
   cutover, **Then** the app's mailbox screen shows its "not found" state with a way to the list.
9. **Given** a mailbox user signed in to the app, **When** they open an old bookmark to
   `/admin/system`, **Then** the app shows UI feature 001's "no access" state with a way to the home
   screen.
10. **Given** cutover is on for administrators, **When** someone opens `/debug` or `/queue`, addresses
    the classic interface removed in January 2025, **Then** the app's dashboard or mail queue opens
    instead of "not found".

---

### User Story 2 - Everything that must stay in the classic interface keeps working (Priority: P1)

After cutover, mail clients still configure themselves automatically, remote servers still read
the MTA-STS policy, scripts still call `/api/v1` with their keys, the webmail, ActiveSync and
CalDAV/CardDAV still sign in, firewalls still fetch the ban list, and certificates still renew. A
user who clicks "Release to inbox" in an old quarantine notification still releases the message. An
application that uses mailcow as its OAuth2 provider still signs users in, and classic single
sign-on through the identity provider still works where the operator kept it.

**Why this priority**: These addresses are used by machines and by e-mails that cannot be updated.
Breaking any of them stops mail clients, integrations or mail delivery, which is worse than not
cutting over at all.

**Independent Test**: Take the smoke test's baseline of every exclusion with cutover off, switch all
roles on, and confirm that every exclusion answers exactly as in the baseline. Then run the
end-to-end checks of the runbook: a mail client autoconfiguration, an `/api/v1` read with a key, a
webmail sign-in, an ActiveSync sync, a quarantine quick release, and an OAuth2 sign-in with a test
application.

**Acceptance Scenarios**:

1. **Given** cutover is on for all roles, **When** a mail client requests the autodiscover or
   autoconfig documents, **Then** it receives the same response as before cutover.
2. **Given** cutover is on for all roles, **When** a script calls `/api/v1/get/status/version` with a
   valid key, and without one, **Then** the answers are the same as before cutover.
3. **Given** cutover is on for all roles, **When** a user opens a quick release link
   `/qhandler/release/<hash>` from an old notification, **Then** the classic quick release page opens
   and releases the message as before.
4. **Given** cutover is on for all roles, **When** an application sends a user to
   `/oauth/authorize?…` and the user is not signed in to the classic interface, **Then** the classic
   sign-in page opens (via `/?oauth`), the user signs in, including a second factor, and returns to
   the application with an authorization code.
5. **Given** cutover is on for mailbox users, **When** a browser signed in to the classic interface
   opens `/mobileconfig.php`, **Then** the Apple connection profile downloads as before. **When** a
   signed-out user opens `/mobileconfig.php?only_email`, for example from the operator's
   documentation, **Then** the classic page forwards to its sign-in step, which leads to the app's
   Apple connection profile screen with "mail only" preselected, and after signing in the user
   downloads the profile there.
6. **Given** cutover is on for all roles, **When** the webmail, ActiveSync or a CalDAV/CardDAV client
   signs in, **Then** it works as before, including the web server's internal sign-in verification.
7. **Given** cutover is on for all roles, **When** a remote server fetches `/.well-known/mta-sts.txt`
   or the certificate service fetches an ACME challenge, **Then** the answers are unchanged.
8. **Given** a classic form was opened before the switch, **When** it is submitted after the switch,
   **Then** the classic interface processes the submission.
9. **Given** cutover is on for mailbox users, **When** someone opens `/` on an `autodiscover.` or
   `autoconfig.` host name, **Then** the answer is "not found", as before.

---

### User Story 3 - The operator switches cutover on per role and rolls it back (Priority: P1)

The operator confirms the preconditions, switches administrators over first, then domain
administrators, then mailbox users, each with one documented setting and one apply step. When
something goes wrong, they switch a role, or all roles, back. Nothing written in either interface
is lost, nobody is signed out, and mail keeps flowing.

**Why this priority**: The switch is the feature. Without a safe, reversible switch the operator
cannot cut over at all.

**Independent Test**: On a test installation, apply each switch combination, run the smoke test after
each, create and change objects in the app while cutover is on, roll back, and confirm in the
classic interface that every change is there and every classic address answers as in the baseline.

**Acceptance Scenarios**:

1. **Given** the deployed app is not a cutover-ready release, or the app or the API does not answer,
   **When** the operator applies a switch that turns a role on, **Then** the apply step refuses and
   says why, and nothing changes.
2. **Given** all switches are off, **When** the operator turns administrators on, **Then** within
   1 minute administrator addresses are redirected, while domain-administrator, mailbox-user and
   shared addresses answer as before.
3. **Given** all three switches are on, **When** someone opens a shared address such as
   `/quarantine` or `/edit/syncjob/7`, **Then** it is redirected.
4. **Given** cutover was on and a browser already followed redirects, **When** the operator turns all
   switches off, **Then** within 1 minute that browser reaches the classic pages again at the same
   addresses, without clearing anything.
5. **Given** an administrator created a domain and changed a mailbox in the app while cutover was on,
   **When** the operator rolls back, **Then** the classic interface shows the new domain and the
   changed mailbox, and the app's own data (its API keys, preferences, audit records, passkey names)
   is still there when cutover is turned on again.
6. **Given** users are signed in to either interface, **When** a switch changes, **Then** no session
   of either interface ends.
7. **Given** a switch change is applied, **When** mail is sent, received and fetched during the apply
   step, **Then** no mail service, webmail session or `/api/v1` request is interrupted.
8. **Given** any switch state, **When** the operator asks for it with the documented command,
   **Then** they see each role's state and when it last changed.

---

### User Story 4 - Administrators still reach what only the classic interface offers, and the app shows no stale classic links (Priority: P2)

After cutover, an administrator needs to regenerate the read-write `/api/v1` key used by their
billing system. The app's API keys screen says that `/api/v1` keys are managed in the classic
interface and links there. The administrator signs in to the classic interface, works in it for as
long as needed, and closes the browser or opens the documented exit address to return. Elsewhere,
the app no longer shows the "use the classic interface for now" links it showed while features were
incomplete.

**Why this priority**: `/api/v1` integrations must keep running, but only administrators need this,
rarely. Stale links would bounce users between the interfaces.

**Independent Test**: With cutover on for all roles, follow the link on the API keys screen as an
administrator, sign in to the classic interface, regenerate a test `/api/v1` key and use it from a
script. Scan the cutover-ready release for links to classic addresses.

**Acceptance Scenarios**:

1. **Given** an administrator on the app's API keys screen, **When** the screen loads, **Then** it
   states that keys for the classic API (`/api/v1`) are managed in the classic interface, which has
   its own sign-in, and offers a link to it.
2. **Given** the administrator follows that link with cutover on, **When** the classic interface
   entry opens, **Then** the classic administrator sign-in appears, and after sign-in they can
   navigate the classic interface, including the configuration page with the API section, without
   being redirected.
3. **Given** a browser holding a classic pass, **When** the browser session ends, 8 hours pass, or the
   user opens the documented exit address, **Then** classic addresses are redirected again in that
   browser, and the exit address opens the app.
4. **Given** a domain administrator or a mailbox user, **When** they open the app's screens, **Then**
   no link to the classic interface entry is shown to them.
5. **Given** the classic interface entry is opened with a target that is not on its list, **When** it
   is processed, **Then** the classic administrator sign-in opens instead, and no other address can
   be reached through it.
6. **Given** the cutover-ready release, **When** it is scanned, **Then** it contains no placeholder page
   and no link to a redirected classic address other than through the classic interface entry.

---

### User Story 5 - Users are told about the change (Priority: P2)

A week before the switch, every user of the classic interface sees an announcement with the date
and what will change. After the switch, people arriving through an old bookmark see a short,
translated notice in the app explaining that the classic interface has moved, that they sign in
again with their usual account, that passkeys and second factors keep working, and that they should
update their bookmark.

**Why this priority**: The switch changes where users sign in and forces a new sign-in. Without
notice, support load rises, but the cutover still works without it.

**Independent Test**: Activate the provided announcement texts and check them in both interfaces in
the three languages; arrive through redirected addresses and check the arrival notice, its
dismissal and its accessibility on both viewports.

**Acceptance Scenarios**:

1. **Given** the operator activates the "before" announcement, **When** users open the classic
   interface or the app, **Then** both show it, as UI feature 001 shows announcements.
2. **Given** someone arrives in the app through a redirect, **When** the target screen opens, **Then**
   the arrival notice appears in the user's language, is announced to screen readers and does not
   block the screen.
3. **Given** the arrival notice is shown, **When** the user chooses "Don't show again", or it has been
   shown on three visits, **Then** it no longer appears on that device, while a fallback arrival
   still explains that no exact counterpart exists.
4. **Given** someone opens the app directly, not through a redirect, **When** any screen opens,
   **Then** no arrival notice appears.
5. **Given** the operator needs announcement texts, **When** they open the runbook, **Then** it offers
   the "before" and "after" texts in English, Czech and Slovak.

---

### User Story 6 - The operator verifies the cutover and watches for broken links (Priority: P2)

Before switching, the operator runs the smoke test, which records how every excluded address
answers. After switching, the same test checks every mapped address and every exclusion and
reports each result. For two weeks the operator reads a daily report of "not found" answers and
fallback redirects, and adds a mapping or documents the cause for anything recurring.

**Why this priority**: Verification turns a risky change into a checked one, but the switch and
rollback deliver value on their own.

**Independent Test**: Run the smoke test against a test installation in the off, partial and on
states and after a rollback; inject a broken exclusion and an unmapped bookmark and confirm the
smoke test and the report show them.

**Acceptance Scenarios**:

1. **Given** cutover is off, **When** the operator runs the smoke test, **Then** it records the answer
   of every excluded and mapped address on every host name as the baseline and reports any target
   in the app that does not exist.
2. **Given** a switch change, **When** the operator runs the smoke test, **Then** every row of the
   mapping table and every exclusion is reported as passed or failed, with the expected and the
   actual answer, and the test ends with an overall result that automation can read.
3. **Given** an exclusion that answers differently from its baseline, **When** the smoke test runs,
   **Then** it fails that row and recommends a rollback.
4. **Given** the monitoring window, **When** the operator runs the report for a day, **Then** it lists
   "not found" answers and fallback redirects grouped by address with counts, compared with the
   baseline period, and shows no token values.
5. **Given** a mailcow update has been installed while cutover is on, **When** the operator runs the
   smoke test, **Then** any classic address whose behaviour changed is reported.

---

### Edge Cases

- **Partial cutover and shared addresses**: an administrator already on the app opens a bookmark to
  `/quarantine` while mailbox users are still on the classic interface. The classic page answers,
  because the address stays classic until every role that uses it is switched over. The runbook
  says so.
- **Signed in to the classic interface but not to the app**: the two interfaces have separate
  sessions (API constitution V). After the switch, users sign in again in the app. The target
  address is kept through sign-in (UI feature 001, FR-031).
- **Classic page open in a tab at the switch**: the page keeps working for calls it makes in the
  background and for form submissions; its next navigation is redirected.
- **Link scanners and previews** that request links in e-mails: a redirect consumes nothing. Reset
  and single sign-on tokens are only used when the app's screen submits them (UI feature 005's
  reset page; UI feature 007's one-time sign-in landing, which never exchanges a token on a link
  prefetch). Quick release links are not redirected and behave as before.
- **Expired token** in a reset or single sign-on link: the app's target screen shows its "invalid or
  expired link" state.
- **Identifiers with special characters** in `/edit/…` addresses, such as a catch-all alias
  `@example.org`, a `+` in an address or percent-encoded characters: the identifier reaches the app
  exactly as the classic page would have read it.
- **`/edit/template/<id>`** names a domain template or a mailbox template; the app determines which.
  An ID that belongs to neither shows the "not found" state of the templates screen.
- **Parameters the target does not use**, such as `lang` or `duallogin`: they are dropped. The
  language comes from the app (UI feature 001); login-as uses the app's own (UI feature 007).
- **Several host names**: the redirect keeps the host name and scheme of the request. Passkeys bound
  to another host name are handled by UI feature 001 (FR-052 there).
- **`autodiscover.` and `autoconfig.` host names**: their root answers "not found" as before; other
  classic addresses on those host names follow the mapping table, as the classic interface serves
  them there too.
- **App or API unavailable while cutover is on**: users see the app's or the web server's error page.
  The monitoring triggers recommend a rollback after 5 minutes.
- **External uptime monitors** that expect a success answer from `/`: they now receive a redirect.
  The runbook tells the operator to point them at the app or the API's liveness address before the
  switch.
- **mailcow update that changes classic addresses**: the smoke test after the update reports the
  difference; the operator rolls back the affected roles until the mapping is updated.
- **Webmail sign-out**: the webmail posts the sign-out to `/` (classic, not redirected) and then opens
  `/`, which leads to the app's start. Whether that also ends the app's session is decided by UI
  feature 005's webmail single sign-on, not by the cutover.
- **Expired quick release link** in a very old notification: the classic page shows its usual
  message; nothing changes.
- **Classic pass in a mailbox user's browser**: whoever opens the documented entry sees the classic
  interface and signs in there with its own rules. The pass grants nothing.
- **Cutover switched on without an announcement**: allowed; the apply step warns when the
  announcement is inactive.
- **Removed classic addresses `/debug`, `/queue` and `/mailbox`**: they answer "not found" today and
  are mapped after cutover.

## Requirements *(mandatory)*

### Functional Requirements

#### Preconditions and readiness

- **FR-001**: A switch MUST NOT be turned on for any role until all of these hold:
  - UI features 001–013 are released in a cutover-ready release and deployed together with the API
    releases they pin;
  - the readiness register is complete and signed off by the owner;
  - the smoke test passes in the off state, which also records the baseline (FR-043).
- **FR-002**: The readiness register MUST list every legacy screen and action of the parity tables of
  UI features 001–013 and of `docs/legacy-inventory.md`. Each entry MUST have exactly one
  disposition: matched, improved, changed, dropped (with the owner's acceptance and the reason), or
  kept in the classic interface (with the non-redirected way to reach it). No entry may be
  deferred, delivered by a placeholder, or without a disposition.
- **FR-003**: A cutover-ready release MUST contain no placeholder page of UI feature 001 (FR-044
  there) and MUST meet FR-037. The release notes MUST state that it is cutover-ready.

#### Redirects

- **FR-004**: When cutover is on for an address in the mapping table, a GET or HEAD request to it
  MUST be answered with a redirect to the documented target in the app, on the same host name and
  scheme. The target address MUST be fixed by the mapping table; only the carried-over values come
  from the request, so the redirect can never lead outside the app.
- **FR-005**: Every redirect MUST be temporary and MUST be marked as not to be stored by browsers or
  intermediaries. A permanent redirect MUST never be used.
- **FR-006**: A redirect MUST carry over only the parameters the mapping table lists, decoded as the
  classic page decoded them and encoded correctly for the target. Every other parameter MUST be
  dropped. A fragment is left to the browser.
- **FR-007**: The `.php` form of a classic address and its form with a trailing slash MUST be treated
  like the address itself. Matching MUST be case-sensitive, as the classic interface is.
- **FR-008**: Requests with any method other than GET and HEAD MUST reach the classic interface
  unchanged, whatever the switch state.
- **FR-009**: The redirect MUST NOT check, use or invalidate a token. It MUST pass tokens to the
  target unchanged, and the target screens MUST remove them from the address bar, as UI feature
  005's reset page and UI feature 007's one-time sign-in landing specify.
- **FR-010**: Every target screen MUST accept the identifier in the form the classic address used
  (mailbox, alias and resource addresses, domain names, usernames, numeric IDs) and open that
  object. When it does not exist or is outside the user's scope, the screen MUST show its "not
  found" or "no access" state with a way to the list (UI feature 001, FR-045). For a template ID the
  app MUST determine whether it is a domain template or a mailbox template.
- **FR-011**: Every target MUST be an address of the app, so that UI feature 001 keeps it through
  sign-in (FR-031 and FR-092 there).
- **FR-012**: For an unmapped address inside the families `/admin/…`, `/domainadmin/…` and `/edit/…`,
  the fallback rows F1 to F3 MUST apply: a redirect to the role's start screen in the app, with the
  fallback variant of the arrival notice.
- **FR-013**: An address that is neither mapped nor in a fallback family MUST behave exactly as it
  did before cutover, including "not found" answers.
- **FR-014**: The app MUST be able to tell an arrival through a redirect, and a fallback arrival,
  from a direct visit. The web server's access record MUST show which mapping row or fallback
  produced a redirect. The app MUST remove the arrival marker from the address bar.
- **FR-050**: The profile options carried by row M33 (`only_email`, `app_password`) MUST only
  preselect choices on the Apple connection profile screen. The app MUST NOT download a profile or
  create an app password until the user starts the download on that screen.

#### Exclusions

- **FR-015**: The addresses of the exclusion list MUST never be redirected, whatever the switch
  state, and MUST answer exactly as before cutover.
- **FR-016**: The root and the classic sign-in addresses (rows M01, M05 and M10) MUST NOT be
  redirected when the request carries a classic sign-in flow parameter: `oauth`, `iam_sso`, `code`
  together with `state`, `cancel_tfa_login` or `cancel_tfa_setup`. The root carrying `mobileconfig`
  follows row M33 instead.
- **FR-017**: The root `/` on host names that start with `autodiscover.` or `autoconfig.` MUST NOT be
  redirected.
- **FR-018**: The cutover MUST NOT change the internal web servers that other containers use (the
  Rspamd maps, the metadata exporter and the Dovecot sign-in check), the legacy PHP container, the
  webmail container or any other mailcow container.
- **FR-019**: The quick links that the quarantine notifier builds (`/qhandler/release/<hash>` and
  `/qhandler/delete/<hash>` on the mailcow host name) MUST keep working, and the cutover MUST NOT
  require changing the operator's notification template.

#### Operator switch and rollback

- **FR-020**: The operator MUST be able to turn cutover on or off separately for administrators,
  domain administrators and mailbox users, and all off at once, with one documented setting and one
  documented apply step.
- **FR-021**: An address MUST be redirected only when the switch is on for every role in its used-by
  set.
- **FR-022**: Applying a switch change MUST NOT require modifying an upstream mailcow file, template
  or container definition, rebuilding an image, or restarting any container. It MAY reload the web
  server's configuration. It MUST NOT interrupt mail services, the webmail, `/api/v1` or the API,
  and MUST take effect for new requests within 1 minute.
- **FR-023**: The apply step MUST refuse to turn a role on when the deployed app is not a
  cutover-ready release, or when the app or the API does not answer on the installation, and MUST
  say why. It MUST warn when the branding announcement is inactive. It MUST report the resulting
  state of each role.
- **FR-024**: Rollback MUST restore the classic behaviour of every address without restoring a
  backup, converting or moving data, or rebuilding anything. No data written through either
  interface may be lost or changed by a switch change in either direction. Data that only the app
  uses MUST be kept for the next time cutover is on.
- **FR-025**: A switch change MUST NOT end any session of either interface.
- **FR-026**: The operator MUST be able to read the current state of each role and the time of its
  last change with one documented command.
- **FR-027**: The switch state MUST survive restarts, certificate renewals and mailcow updates.

#### Deployment

- **FR-028**: The redirect MUST be delivered as a separate addition that uses the same web server
  extension point that mailcow-rest-v2 feature 001's plan uses to route the API and the app. It
  MUST be removable on its own without affecting the routing of the API or the app, and MUST live
  among the operator's own configuration files, which mailcow updates keep.
- **FR-029**: The redirect rules, the smoke test and the documented mapping MUST be produced from one
  authoritative mapping, so that they cannot disagree.
- **FR-030**: The mapping MUST state the mailcow releases it was verified against, starting with the
  upstream baseline `2026-09a`.

#### Classic interface entry

- **FR-031**: The classic interface entry MUST be a documented address that is neither a classic
  address nor an app address. Opening it MUST give the browser a classic pass and open the
  requested classic screen. While the pass lasts, classic addresses MUST NOT be redirected for that
  browser.
- **FR-032**: The entry MUST accept only targets from its list: the classic administrator sign-in
  (the default) and the classic screens of readiness register entries kept in the classic
  interface. Any other target MUST lead to the default.
- **FR-033**: The pass MUST end when the browser session ends or after 8 hours, whichever comes
  first. A documented exit address MUST end it and open the app's start.
- **FR-034**: The pass MUST carry no credential and grant nothing. The classic interface keeps
  requiring its own sign-in and permissions.
- **FR-035**: The app's API keys screen (UI feature 001) MUST tell administrators that keys for the
  classic API (`/api/v1`) are managed in the classic interface, which has its own sign-in, and MUST
  link to them through the classic interface entry, placed in that screen's designated action area
  (`docs/conventions.md`, "Where features meet"). Other register entries kept in the classic
  interface that are reached through a classic page MUST be linked the same way from the matching
  app screen. These links MUST be shown only to the roles the entry concerns.

#### Classic links in the app

- **FR-036**: The classic link register MUST list every place where a UI feature 001–013 links to the
  classic interface, for example placeholders, the forced password change and second-factor setup
  notes, the password reset link and the single sign-on hints of UI feature 001, with each link's
  disposition at cutover.
- **FR-037**: In the cutover-ready release, every link to an address that the redirect covers MUST
  be removed or replaced by the app's own screen. Only links through the classic interface entry
  (FR-035) and links to excluded addresses (for example the webmail, Rspamd's own interface and the
  `/api/v1` documentation) may remain.
- **FR-038**: The app MUST NOT depend on the switch state. Its links and screens MUST work the same
  with cutover off, partly on or fully on.
- **FR-039**: User-facing text MUST call the legacy UI "the classic interface" ("klasické rozhraní"
  in Czech, "klasické rozhranie" in Slovak) and MUST NOT use the word "legacy" (UI feature 001,
  FR-090; `docs/conventions.md`).

#### Communication

- **FR-040**: The runbook MUST offer announcement texts in English, Czech and Slovak for the branding
  announcement: a "before" text naming the date, the new address, that users sign in again with
  their usual account, that passkeys and second factors keep working, that bookmarks are forwarded,
  and that webmail, mail apps and quarantine e-mail links are unaffected; and an "after" text saying
  that the switch has happened and where to get help. It MUST recommend activating the "before"
  text at least 7 days ahead and keeping the "after" text for at least 14 days.
- **FR-041**: When the app is opened through a redirect, it MUST show a translated arrival notice on
  the target screen, also on the sign-in screen. It MUST say that the classic interface has moved
  to this app, that the user signs in with the usual account, that passkeys and second factors keep
  working, and that bookmarks should be updated. For a fallback arrival it MUST also say that the
  requested page has no exact counterpart and that this is the closest screen.
- **FR-042**: The arrival notice MUST be dismissible, MUST NOT block the screen, and MUST be
  announced to screen readers. It MUST stop appearing on a device after the user chooses "Don't
  show again" or after it has been shown on three separate visits, whichever comes first; this is
  remembered on the device as a convenience only. The fallback sentence MUST still appear on every
  fallback arrival. The notice MUST NOT appear on direct visits.

#### Verification and monitoring

- **FR-043**: The feature MUST deliver a smoke test that the operator runs against an installation on
  each of its host names. It MUST:
  - be read-only and need no account or credential;
  - in the off state, record the answer of every excluded and mapped address as the baseline, and
    check that every target exists in the deployed app;
  - check that every mapped row and fallback family redirects to its target exactly when cutover is
    on for it, and answers as in the baseline otherwise;
  - check that every exclusion answers with the baseline's status and content type;
  - report each row as passed or failed with the expected and actual answer, end with an overall
    result that automation can read, and recommend a rollback when an exclusion fails.
- **FR-044**: The runbook MUST require the smoke test before the first switch, after every switch
  change and rollback, and after every mailcow update or app or API release while cutover is on.
- **FR-045**: Every mapping target MUST be covered by an end-to-end test of the app that opens it with
  a classic identifier, on a 360 px and a desktop viewport, signed out and signed in.
- **FR-046**: The feature MUST deliver a read-only report from the web server's access records that
  lists, for a chosen period, "not found" answers and fallback redirects grouped by address with
  counts, compared with a baseline period. It MUST hide parameter values and add no personal data
  beyond what the access records already hold.
- **FR-047**: The runbook MUST define a monitoring window of 14 days after each switch change, with a
  daily report against a 7-day baseline taken before the change. Every address with recurring "not
  found" answers or fallbacks MUST be mapped, documented as expected, or documented as noise.
- **FR-048**: The runbook MUST recommend a rollback when an excluded address answers differently from
  its baseline, when the app or the API is unavailable for more than 5 minutes, or when a role
  cannot complete a task that the readiness register lists as available in the app.

#### Accessibility, internationalisation and mobile

- **FR-049**: The arrival notice and the classic interface note on the API keys screen MUST meet WCAG
  2.2 AA, work at 360 px without horizontal scrolling, have touch targets of at least 44 × 44 CSS px,
  and have English, Czech and Slovak texts.

### Route Mapping

Every row applies to GET and HEAD requests when cutover is on for the row's used-by set. Each
classic address includes its `.php` form and its trailing-slash form (FR-007). "Start" means the app's
home screen when signed in, otherwise the named sign-in screen of UI feature 001. Targets are named
by screen; the delivering feature's plan fixes each screen's exact app address, and feature 014's
plan collects them into the authoritative mapping (FR-029).

| Row | Classic address | Used by | Target in the app | Carried over |
|---|---|---|---|---|
| M01 | `/`, `/index.php` without a sign-in flow parameter (FR-016) or `mobileconfig` | Mailbox users | Start, role-neutral sign-in (001) | — |
| M02 | `/user` | Mailbox users | My account (005) | — |
| M03 | `/reset-password` with `token` | Mailbox users | Password reset screen (005) | `token` |
| M04 | `/reset-password` without `token` | Mailbox users | Password reset request screen (005) | — |
| M05 | `/admin`, `/admin/index.php` without a sign-in flow parameter | Administrators | Start, administrator sign-in (001) | — |
| M06 | `/admin/dashboard`, and the removed `/debug` | Administrators | Dashboard (011) | — |
| M07 | `/admin/mailbox` | Administrators | Domains list (002), the first section of the classic mail setup | — |
| M08 | `/admin/system` | Administrators | Administrators and domain administrators (007), the first section of the classic configuration page | — |
| M09 | `/admin/queue`, and the removed `/queue` | Administrators | Mail queue (011) | — |
| M10 | `/domainadmin`, `/domainadmin/index.php` without a sign-in flow parameter or `sso_token` | Domain administrators | Start, domain-administrator sign-in (001) | — |
| M11 | `/domainadmin/mailbox` without `sso_token` | Domain administrators | Domains list (002) | — |
| M12 | `/domainadmin/user` without `sso_token` | Domain administrators | My account (005) | — |
| M13 | Any address of M10 to M12 with `sso_token` | Domain administrators | One-time sign-in landing (007) | `sso_token` as the landing's token |
| M14 | `/quarantine` | Administrators, domain administrators, mailbox users | Quarantine (006) | — |
| M15 | The removed `/mailbox` | Administrators, domain administrators | Domains list (002) | — |
| M16 | `/edit/alias/{address}` | Administrators, domain administrators | Alias detail (004) | address |
| M17 | `/edit/aliasdomain/{domain}` | Administrators, domain administrators | Alias domain detail (004) | domain |
| M18 | `/edit/resource/{address}` | Administrators, domain administrators | Resource detail (004) | address |
| M19 | `/edit/domain/{domain}` | Administrators, domain administrators | Domain detail (002) | domain |
| M20 | `/edit/mailbox/{address}` | Administrators, domain administrators | Mailbox detail (003) | address |
| M21 | `/edit/template/{id}` | Administrators, domain administrators | Domain template detail (002) or mailbox template detail (003) | ID |
| M22 | `/edit/domainadmin/{username}` | Administrators | Domain administrator detail (007) | username |
| M23 | `/edit/admin/{username}` | Administrators | Administrator detail (007) | username |
| M24 | `/edit/oauth2client/{id}` | Administrators | OAuth2 client detail (012) | ID |
| M25 | `/edit/relayhost/{id}` | Administrators | Relayhost detail (009) | ID |
| M26 | `/edit/transport/{id}` | Administrators | Transport detail (009) | ID |
| M27 | `/edit/bcc/{id}` | Administrators, domain administrators | BCC map detail (009) | ID |
| M28 | `/edit/recipient_map/{id}` | Administrators | Recipient map detail (009) | ID |
| M29 | `/edit/tls_policy_map/{id}` | Administrators | TLS policy map detail (009) | ID |
| M30 | `/edit/syncjob/{id}` | Administrators, domain administrators, mailbox users | Sync job detail (008) | ID |
| M31 | `/edit/filter/{id}` | Administrators, domain administrators | Sieve filter detail (005) | ID |
| M32 | `/edit/app-passwd/{id}` | Mailbox users | App password detail (005) | ID |
| M33 | `/`, `/index.php` with `mobileconfig`, alone or with `only_email` and `app_password` (the classic sign-in step that `/mobileconfig.php` forwards to) | Mailbox users | Apple connection profile screen in My account (005), after sign-in if needed | `only_email` and `app_password` as preselected profile options (FR-050) |
| F1 | Any other address under `/admin/` | Administrators | Start, administrator sign-in, with the fallback notice | — |
| F2 | Any other address under `/domainadmin/` | Domain administrators | Start, domain-administrator sign-in, with the fallback notice | — |
| F3 | `/edit/…` with an unknown type or an empty value | Administrators, domain administrators, mailbox users | Start, role-neutral sign-in, with the fallback notice | — |

Rows M16 to M32 also cover the equivalent `/edit.php?{type}={value}` form. The classic interface
reads the type and the value from the last two path segments. A value that does not identify an
existing object leads to the target's "not found" state (FR-010), not to F3.

### Exclusions

These addresses are never redirected (FR-015). Prefixes include everything below them.

| Row | Addresses | Why they stay |
|---|---|---|
| X01 | The app's base address (`/ng/…`) and the API (`/api/v2/…`) | They are the new interface and its backend |
| X02 | `/api/v1/…`, `/json_api.php`, and the `/api/v1` documentation at `/api` and `/api/…` | `/api/v1` integrations (API constitution V) |
| X03 | `/SOGo…`, `/sogo`, `/SOGo.woa/…`, `/.woa/…`, `/Microsoft-Server-ActiveSync…`, `/principals…`, `/.well-known/caldav`, `/.well-known/carddav`, `/sogo-auth`, `/sogo-auth.php` | Webmail, ActiveSync, CalDAV/CardDAV and their sign-in verification, which runs through the same web server |
| X04 | `/Autodiscover/Autodiscover.xml` and `.json` in any letter case, `/autodiscover.php`, `/autodiscover-json.php`, `/autoconfig.php`, `/mail/config-v1.1.xml` in any letter case, `/mobileconfig.php` | Mail client configuration and Apple connection profiles |
| X05 | `/.well-known/mta-sts.txt`, `/mta-sts.php`, `/.well-known/acme-challenge/…` | Remote mail servers and certificate renewal |
| X06 | `/qhandler/…`, `/qhandler.php` | Quarantine quick release and delete links in notifications (API feature 006) |
| X07 | `/oauth/authorize`, `/oauth/token`, `/oauth/profile` and their `.php` forms | OAuth2 provider endpoints and consent page (API feature 012, FR-049) |
| X08 | M01, M05 and M10 with a classic sign-in flow parameter (FR-016) | OAuth2 sign-in, classic single sign-on, cancelling a classic second-factor step |
| X09 | `/f2b-banlist…`, `/cache/…`, `/resource.php`, `/_rspamderror.php`, `/rspamd/…` | Ban list for external firewalls, served resources, Rspamd's own interface |
| X10 | `/css/…`, `/js/…`, `/img/…`, `/fonts/…`, icon and manifest files at the root, `/robots.txt`, `/_status.502.html` | Static files the classic interface, the webmail and error pages use |
| X11 | `/inc/ajax/…`, `/inc/lib/…` (stays refused) | Calls from classic pages still open or opened with a classic pass |
| X12 | Every request with a method other than GET or HEAD (FR-008) | Form submissions, webmail sign-out, classic page calls |
| X13 | Every classic address for a browser with a classic pass (FR-031) | Classic interface entry |
| X14 | `/` on `autodiscover.` and `autoconfig.` host names (FR-017) | The classic interface answers "not found" there |
| X15 | The internal web servers of the Rspamd maps, the metadata exporter and the Dovecot sign-in check | Other containers depend on them (FR-018) |
| X16 | Any address that is neither mapped nor in a fallback family (FR-013) | Operator files and unknown addresses keep their behaviour |

### Legacy Parity

Reference: the FeldHost fork at `../mailhosting/data/` (upstream baseline `2026-09a`):
`web/index.php`, `web/user.php`, `web/admin/*.php`, `web/domainadmin/*.php`, `web/edit.php`,
`web/quarantine.php`, `web/reset-password.php`, `web/qhandler.php`, `web/mobileconfig.php`,
`web/oauth/*.php`, `web/sogo-auth.php`, `web/inc/triggers.*.inc.php`, `web/inc/functions.inc.php`
(`protect_route`), `web/templates/base.twig`, `assets/templates/quarantine.tpl`,
`conf/nginx/templates/{nginx.conf.j2,sites-default.conf.j2}`, `conf/sogo/custom-sogo.js` and
`Dockerfiles/sogo/navMailcowBtns.diff`.

| Classic behaviour | After cutover | Status | Requirements |
|---|---|---|---|
| Three sign-in pages (`/`, `/admin`, `/domainadmin`) | Redirected to the matching sign-in of the app | Replaced | M01, M05, M10 |
| Redirect after sign-in to the dashboard, the mailbox page or the webmail | The app's own behaviour (UI feature 001) | Changed (001) | — |
| Unauthenticated deep link sent to the role's sign-in page and then to the role's default page | Target kept through the app's sign-in | Improved | FR-011 |
| Addresses removed in January 2025 (`/debug`, `/queue`, `/mailbox`) answer "not found" | Redirected to their successors | Improved | M06, M09, M15 |
| `/` on `autodiscover.` and `autoconfig.` host names answers "not found" | Unchanged | Matched | X14 |
| Webmail login form and the webmail's "mailcow preferences" button open `/user` | Lead to My account in the app | Matched | M02 |
| Webmail sign-out posts to `/`, then opens `/` | Post handled by the classic interface; `/` leads to the app's start | Changed | FR-008, M01 |
| Quarantine notification quick links | Unchanged | Matched | X06, FR-019 |
| Password reset link `/reset-password?token=…` | Leads to the app's reset screen | Replaced | M03 |
| Domain-administrator single sign-on `?sso_token=…` | Leads to the app's one-time sign-in landing | Replaced | M13 |
| OAuth2 provider sign-in (`/?oauth`) and consent page | Unchanged, in the classic interface | Kept in the classic interface | X07, X08 |
| Classic single sign-on (`?iam_sso`, callback at the legacy return URL) | Unchanged | Kept in the classic interface | X08 |
| Apple connection profile download (`/mobileconfig.php`, four variants) | Unchanged at its address | Matched | X04 |
| Sign-in step before the profile download (`/?mobileconfig`, with `only_email` and `app_password`) and the profile links on the user page | The app's Apple connection profile screen in My account, with the options preselected | Replaced (005) | M33, FR-050 |
| Client configuration guide link on the user page (external mailcow documentation with a server-built anchor) | The setup guide screen of My account (UI feature 005). It is not a classic address, so nothing is redirected | Replaced (005) | — |
| `/api/v1` key management on the configuration page | Reached through the classic interface entry | Kept in the classic interface | FR-031 to FR-035 |
| Login-as through `?duallogin=` | Works only with a classic pass; the app has its own login-as (007) | Replaced | — |
| Language switch through `?lang=` | Parameter dropped; the app's language choice applies | Changed | FR-006 |
| Every page reachable at its address | Temporary redirects only; rollback restores the addresses | Matched | FR-005, FR-024 |

### API Dependency

The roadmap lists no mailcow-rest-v2 feature for UI feature 014. The feature:

- uses no API operation beyond those that UI features 001–013 already use;
- requires the API releases that UI features 001–013 pin, deployed on the installation;
- relies on the deployment in mailcow-rest-v2 feature 001's plan (research R23): the API and the app
  share one origin and are routed through mailcow's web server extension point, with the app at
  `/ng/`;
- relies on these API decisions: reset tokens shared with the classic interface (API feature 005,
  FR-021, FR-022), quick release pages kept in the legacy container (API feature 006), single sign-on
  tokens accepted by both interfaces (API feature 007), OAuth2 endpoints kept in the legacy
  container and the legacy return URL kept (API feature 012, FR-006, FR-049), and Apple connection
  profiles and the client setup guide offered by API feature 005 (orchestrator decision, 2026-10-18).

Taking over any legacy internal endpoint is mailcow-rest-v2 roadmap item 014 (optional) and is out
of scope.

### Key Entities *(include if feature involves data)*

- **Mapping row**: classic address pattern, used-by set, target screen and delivering feature,
  carried-over parameters, kind (exact or fallback), verified mailcow releases.
- **Exclusion row**: address pattern, reason, expected behaviour (taken from the baseline).
- **Cutover switch**: state per role (on or off), time of the last change.
- **Classic pass**: a per-browser mark without credentials, with a start time and an end at the end
  of the browser session or after 8 hours.
- **Readiness register entry**: legacy screen or action, delivering feature, disposition, access
  path when kept in the classic interface, owner sign-off.
- **Classic link register entry**: place in the app, classic target, disposition at cutover.
- **Smoke test result**: row, host name, switch state, expected answer, actual answer, pass or fail.
- **Monitoring report**: period, baseline period, addresses with "not found" or fallback counts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the smoke test with cutover on, 100 % of the mapping table's rows redirect to their
  documented target, on every host name of the installation.
- **SC-002**: In the smoke test with cutover on, 100 % of the exclusions answer with the same status
  and content type as in the off-state baseline, and the runbook's end-to-end checks (mail client
  autoconfiguration, `/api/v1` read, webmail sign-in, ActiveSync sync, quarantine quick release,
  OAuth2 sign-in) all pass.
- **SC-003**: A switch change takes effect for new requests within 1 minute of the apply step, with no
  interruption of mail delivery, mail retrieval, webmail sessions or `/api/v1` requests.
- **SC-004**: After a rollback, 100 % of classic addresses answer as in the baseline within 1 minute,
  including in browsers that followed redirects before, and a comparison of the mailcow data before
  and after the switch changes shows no record lost or altered by them.
- **SC-005**: For 100 % of the mapped rows, a user following a classic bookmark reaches the matching
  screen of the app with at most one sign-in and no further navigation, on a 360 px and a desktop
  viewport.
- **SC-006**: An automated scan of the cutover-ready release finds 0 placeholder pages and 0 links to
  redirected classic addresses outside the classic interface entry.
- **SC-007**: An administrator reaches the classic `/api/v1` key management from the app's API keys
  screen with one link and the classic sign-in.
- **SC-008**: During each 14-day monitoring window, the daily number of "not found" answers for
  classic addresses exceeds the 7-day baseline's daily average by no more than 5 %, and every
  fallback address seen on 3 or more days is mapped or documented by the end of the window.
- **SC-009**: The arrival notice and the API keys screen note have 0 automated WCAG 2.2 AA
  violations in both themes and on both viewports, scroll horizontally at 360 px on 0 screens, and
  have 100 % of their texts in English, Czech and Slovak.
- **SC-010**: The full rollback procedure, including the smoke test, takes an operator less than
  15 minutes.

## Assumptions

- UI features 001–013 provide addressable target screens for every row of the mapping table (UI
  features 002 and 007 require shareable addresses for their screens; UI feature 005 provides the
  reset address and, by the orchestrator decision of 2026-10-18, the Apple connection profile
  screen and the setup guide screen in My account; UI feature 007 provides the one-time sign-in
  landing with a documented address). Features whose specifications are not finished yet, and UI
  005's update for profiles and the setup guide, are expected to do the same.
- The app keeps the base address `/ng/` decided in mailcow-rest-v2 feature 001's plan. If that plan
  changes it, the targets follow.
- The operator can reload the web server configuration of the installation, as the certificate
  service already does on renewal. The operator's own configuration files in mailcow's web server
  configuration directory are kept by mailcow updates.
- The web server's access records are available to the operator for the monitoring window.
- The branding announcement is shared by both interfaces: the classic interface shows it today, and
  the app shows it as UI feature 001 specifies (FR-048 there). Operators edit it in either
  interface (UI feature 013 for the app).
- The two interfaces keep separate sessions (API constitution V); a user signs in once more after
  cutover. Passkeys and second factors work in both interfaces (UI feature 001).
- The classic interface stays installed, maintained and reachable after cutover. php-fpm keeps
  serving `/api/v1`, Dovecot's sign-in check, the webmail's sign-on and the internal endpoints (API
  constitution V).
- The webmail container's links to `/user` and its sign-out to `/` are part of upstream mailcow and
  are not changed (constitution: upstream files are never patched).
- **Out of scope**:
  - retiring the classic interface, the legacy PHP container or `/api/v1` and its keys;
  - taking over internal endpoints, the OAuth2 provider, the quick release pages or the classic
    profile download address `/mobileconfig.php` in the API or the app;
  - single sign-on between the classic interface and the app;
  - changing the webmail's links, the quarantine notification template or any upstream file;
  - moving the app to another base address;
  - redirecting addresses of the webmail, Rspamd's own interface or mail client configuration.
