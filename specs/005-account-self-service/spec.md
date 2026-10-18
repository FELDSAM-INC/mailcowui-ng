# Feature Specification: Account Self-Service

**Feature Branch**: `main` (no feature branches, constitution 1.1.0)

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Account self-service screens for mailcowui-ng, the mobile-first web
app for mailcow-dockerized (UI feature 005). Its only backend is mailcow REST API v2 feature 005
(account self-service for every role). Every signed-in account changes its own password, resolves
a forced password change and a forced second-factor setup from a restricted session, and enrols
and removes its own TOTP, WebAuthn security key and Yubico OTP second factors. Mailbox users keep a
recovery e-mail and reset a forgotten password through it before signing in, see an overview of
their mailbox, open webmail without signing in again, and manage app passwords (shown once),
temporary aliases, tagged-mail handling, TLS enforcement, Pushover notifications, recent logins,
ActiveSync and SOGo resets, set up mail apps with a setup guide and Apple connection profiles, and
read their filters and active sieve script. Administrators and
domain administrators do the same for the mailboxes in their scope where the API allows it,
including the mailbox sieve filters only they manage and bulk TLS enforcement. Every section follows
the permission flags (hidden or read-only when disallowed, still enforced by the API), shows secrets
once with a copy button, and has loading, empty and error states. Every screen works at 360 px,
meets WCAG 2.2 AA and is translated into English, Czech and Slovak. Sign-in, the app shell,
navigation, passkeys, the audit log viewer and error handling come from UI feature 001; the mailbox
list and mailbox detail screens come from UI feature 003. The legacy reference is the user page,
the 2FA modals, the password reset page, the own-password and 2FA sections of the administrator and
domain-administrator pages, the edit-mailbox page (tagging, TLS, Pushover), the mailbox list's TLS
mass action and Mail setup › Filters."

## Clarifications

### Session 2026-10-18

- Q: Where do administrators and domain administrators manage the self-service objects of a mailbox
  that the API lets them reach? → A: In a self-service part of the mailbox detail screen of UI
  feature 003 (the "mailbox context"). Everyone manages their own account in My account, and
  filters across all mailboxes in scope are in Mail setup › Filters. (agent decision: API 005 FR-001
  and FR-005 grant administrators and domain administrators these objects; legacy already puts
  tagging, TLS and Pushover on the edit-mailbox page and filters in Mail setup, and reaches the rest
  only by logging in as the user.)
- Q: What does the app do with a section whose change needs a permission flag the user lacks, given
  that the API lets reads through without the flag? → A: In My account the section is hidden (the
  overview still shows the counts and the recovery address). In the mailbox context it is shown
  read-only, with the reason. (agent decision: the brief says to hide what is disallowed and legacy
  hides the user tabs; API 005 FR-006 allows reads, and legacy shows domain administrators the
  Filters tab with its actions disabled.)
- Q: Who produces an app password, and may the user type one? → A: The API generates it (32
  characters that meet the policy) and the app shows it exactly once with a copy button. "Generate
  new password" does the same for an existing app password. Typing a password is not offered.
  (agent decision: API 005 FR-038 and FR-039 and the cross-feature rule that generated secrets are
  shown once; a typed app password invites reusing the mailbox password, and legacy also offered
  generation.)
- Q: How does a user remove their only active second factor, which the API refuses to remove on its
  own ("last second factor")? → A: On that entry, the remove action becomes "Turn off two-factor
  authentication", which removes all entries after confirmation with the current password. Other
  single removals need only a confirmation. (agent decision: API 005 FR-034 and FR-035 mirror
  legacy `unset_tfa_key` and `set_tfa none`; one remove action per entry is simpler on a phone than
  legacy's method select with "Deactivate".)
- Q: In which order are second-factor methods offered for enrolment? → A: "Add authenticator app"
  and "Add security key" directly and Yubico OTP under "Other methods"; passkeys (UI feature 001)
  are recommended for passwordless sign-in, and forced setup on the pending-actions screen lists the
  passkey first.
  (agent decision: the API 001 owner decision makes passkeys primary and Yubico OTP advanced, and
  the API 005 restricted session accepts every method; legacy's select listed Yubico OTP first.)
- Q: When a forced password change and a forced second-factor setup are both pending, which comes
  first? → A: The password change, then the second-factor setup, in one linear flow on the
  pending-actions screen. (agent decision: API 005 allows either order; UI 001 FR-041 already lists
  the password change first because the server refuses passkey registration while it is pending; a
  fixed order is easier to follow and to test.)
- Q: Should the app forward a mailbox user to webmail after sign-in when the mailbox has "direct
  forwarding to SOGo" turned on? → A: Yes, once the session is full after a sign-in started from the
  sign-in screen and webmail is enabled; not when the sign-in started from a bookmarked or linked
  app address, which the app then opens. (agent decision: API 005 user story 5 says the app does it,
  legacy `index.php` forwards, and the UI 001 orchestrator decision deferred this landing to 005;
  the deep-link exception keeps My account reachable, because SOGo's own settings button still
  leads to the classic interface. Confirmed by orchestrator decision below.)
- Q: How are actions on several selected temporary aliases or filters carried out when the API has
  no batch operation for them? → A: The app keeps multi-selection, sends one request per item,
  reports the result per item and keeps failed items selected. App passwords get per-item actions
  only. (agent decision: API 005 FR-079 and the cross-feature bulk outcomes; legacy offers these
  mass actions, and per-item results avoid silent partial failures.)
- Q: Should the password forms keep a confirmation field although the API takes the new password
  once? → A: Yes: new password and confirmation, with show and hide and a generator. The own-password
  form also offers "Sign out my other sessions", ticked by default. (agent decision: legacy uses a
  repeat field and ranks above mobile convention in this project's precedence; a typo in a forced or
  reset password locks the user out; API 005 FR-011 ends other sessions by default.)
- Q: Should the sign-in screen always offer "Forgot password?"? → A: Only when the signed-out
  self-service capabilities say that password reset is available. (agent decision: API 005 FR-080
  exists for exactly this; legacy always shows the link and then fails with "password recovery
  unavailable".)
- Q: Should the app forward mailbox users to webmail after sign-in, and is webmail single sign-on
  built? → A: Yes to both: forwarding as decided above, except after sign-ins that started from a
  deep link, and the webmail hand-off is built as API feature 005 decided. (orchestrator decision:
  the agent's defaults for owner questions 1 and 2 are accepted.)
- Q: Are the Apple connection profiles and the client configuration guide kept, although the API
  first assigned them to its optional feature 014? → A: Yes. API feature 005 adds an operation that
  generates a connection profile for the signed-in mailbox user (full or e-mail only, optionally with
  a newly generated app password, respecting the app-password flag) and one that reads the client
  configuration data (host names, ports, encryption and authentication per protocol). My account
  gets a "Mail app setup" section with the profile downloads and a setup guide with copy buttons.
  (orchestrator decision: reverses the agent's default for owner question 3.)
- Q: How does the app learn that an account must keep a second factor, and which domains an
  administrator may use for a mailbox's temporary aliases? → A: From API feature 005, which now
  reports both: the "must keep a second factor" state with the second factors, and the
  temporary-alias domains in the mailbox context. The app hides removal up front and offers the
  domains in both contexts. (orchestrator decision: closes the API gaps 1 and 2 of the first
  report.)
- Q: When does the app use the API's bulk operations, and when one request per item? → A: The API's
  bulk operation wherever the API offers one (TLS enforcement from the mailbox list), and one request
  per item for the per-item actions on temporary aliases and filters, each request carrying the
  item's version tag. (orchestrator decision: aligns with `docs/conventions.md` and API 005
  FR-079.)

## User Scenarios & Testing *(mandatory)*

The actors are the three roles of UI feature 001: **administrators**, **domain administrators** and
**mailbox users**. "Permission flags" are the effective flags the API reports in the user's
identity (legacy `user_acl` and `da_acl`). A "restricted session" is the 001 session state in which
the API lists pending actions (`passwordChange`, `secondFactorSetup`) and refuses everything else.
The **own context** is My account, where a user manages their own account. The **mailbox context**
is the self-service part of a mailbox's detail screen (UI feature 003), where an administrator or a
domain administrator manages one mailbox in their scope. The **self-service capabilities** are the
server settings and limits the API reports for this feature (for example whether webmail is
enabled).

### User Story 1 - Change my password, including a forced change (Priority: P1)

Any signed-in user opens **My account › Password**, enters their current password and a new one
twice, sees which rules of the server's password policy the new password meets, and saves. Their
other signed-in browsers are signed out unless they untick that option. A user whose account mailcow
forces to change its password sees, right after signing in, the pending-actions screen asking only
for the new password twice. Nothing else in the app is reachable until they set it or sign
out. Once it is set, the app continues to forced second-factor setup if that is also pending,
otherwise to the user's home screen.

**Why this priority**: A forced password change blocks the account completely, and UI feature 001
can only send these users to the legacy UI. Changing one's own password is the most basic
self-service task of every role.

**Independent Test**: Sign in as one account of each role and change the password with and without
signing out other sessions; sign in with the new password. Flag a mailbox user and a domain
administrator for a forced password change in the classic interface, sign in, and confirm the
pending-actions screen shows the form, blocks every other address, lifts after a valid new password
and leads to the home screen.

**Acceptance Scenarios**:

1. **Given** a signed-in domain administrator with two other sessions, **When** they enter their
   correct current password and a valid new password twice and save with "Sign out my other
   sessions" ticked, **Then** the app announces that the password was changed and that 2 other
   sessions were signed out, clears the fields and keeps the user signed in.
2. **Given** the password form, **When** the user enters a wrong current password, **Then** the
   error is shown on the current-password field. **When** they keep trying, **Then** the app shows
   the "too many attempts" message with the time after which they can retry.
3. **Given** a policy that requires 10 characters and a digit, **When** the user types "summer",
   **Then** the rule list shows both rules as not met, and a refused save shows both unmet rules on
   the new-password field.
4. **Given** a mailbox user with three active app passwords, **When** they open the password screen,
   **Then** a note says that their 3 app passwords keep working.
5. **Given** a mailbox user flagged for a forced password change, **When** they sign in, **Then** the
   pending-actions screen shows the "Set a new password" form without a current-password field.
   **When** they open any other address of the app, **Then** they are brought back to that screen.
6. **Given** that form, **When** the user saves a valid new password, **Then** the user
   lands on their home screen. **When** second-factor setup is also pending, **Then** they land on
   second-factor setup on the pending-actions screen instead.
7. **Given** the pending-actions screen, **When** the user chooses "Sign out", **Then** the session
   ends and the sign-in screen is shown.
8. **Given** a mailbox whose password is managed by an external identity provider, signed in with a
   passkey, **When** the user opens My account, **Then** the password section explains that their
   organisation manages the password and offers no form.

---

### User Story 2 - Set up and remove second factors, including forced setup (Priority: P1)

An administrator, a domain administrator or a mailbox user whose password mailcow manages opens
**My account › Two-factor authentication**. They see their entries (type, name, state, and which one
they signed in with) and add an authenticator app (TOTP) or a security key (WebAuthn), or, under
"Other methods", a Yubico OTP key, confirming with their current password. TOTP setup shows the QR
code, the key as text with a copy button and an "Open in authenticator app" action for phones, then
asks for a six-digit code. They remove an entry with a simple confirmation; removing the only active
entry turns two-factor authentication off and needs the current password. A user whom mailcow forces
to set up a second factor sees, right after signing in, the pending-actions screen offering a passkey
(recommended, UI feature 001), an authenticator app, a security key or a Yubico OTP key, without the
current password.

**Why this priority**: Forced second-factor setup blocks accounts, second factors protect every
role, and until now they can only be enrolled in the legacy UI.

**Independent Test**: For one account of each role, add a TOTP factor (verified with a generated
code), a security key (virtual authenticator) and a Yubico OTP key (stubbed verification service);
sign out and sign in with each through UI feature 001. Remove entries until none remain. Flag an
account for forced setup, sign in, and resolve the restriction with each method in turn.

**Acceptance Scenarios**:

1. **Given** a user without second factors, **When** they open the section, **Then** an empty state
   explains two-factor authentication, says (for mailbox users) that mail apps then need app
   passwords, and offers "Add authenticator app", "Add security key" and "Other methods".
2. **Given** TOTP setup, **When** the user enters a name, a valid code and their current password,
   **Then** the entry appears in the list, and the key is never shown again.
3. **Given** TOTP setup, **When** the code is wrong, **Then** the error is shown on the code field and
   another code can be entered without scanning again. **When** the setup has expired or too many
   wrong codes were entered, **Then** the app says so and offers to start again.
4. **Given** a phone at 360 px, **When** the user starts TOTP setup, **Then** "Open in authenticator
   app" and "Copy key" come before the QR code.
5. **Given** a browser without WebAuthn support, **When** the user opens the section, **Then** the
   security key option is unavailable with an explanation, and the other options work.
6. **Given** two active entries, **When** the user removes one and confirms, **Then** only the other
   remains, and no password was asked.
7. **Given** one active entry, **When** the user removes it, **Then** the confirmation says that
   two-factor authentication will be turned off and all entries removed (passkeys stay), asks for the
   current password, and afterwards the empty state is shown.
8. **Given** an account whose administrator requires a second factor, **When** the user opens the
   section, **Then** no removal or turn-off action is offered, and a note explains that the
   administrator requires two-factor authentication.
9. **Given** an account forced to set up a second factor, **When** it signs in, **Then** the setup
   screen is shown, every other address leads back to it, and completing any one method lifts the
   restriction and leads to the home screen.

---

### User Story 3 - Reset a forgotten password with the recovery e-mail (Priority: P1)

A mailbox user keeps a recovery e-mail address in **My account › Recovery e-mail**, confirming each
change with their current password. When they forget their password, they choose "Forgot password?"
on the sign-in screen, enter their mailbox address and get a link at the recovery address, valid for
a limited time (15 minutes by default). The link opens the app, which names the account, shows until
when the link is valid and asks for a new password twice. If the account has a second factor, they
confirm with it in the same step as at sign-in. All their sessions end, and they sign in with the new
password.

**Why this priority**: A locked-out user cannot reach any other function, and the legacy reset page
is the only alternative today.

**Independent Test**: As a mailbox user with the reset flag, set a recovery address. Sign out,
request a reset, open the link from the captured message, set a new password (with and without a TOTP
factor on the account) and sign in with it. Open an expired link and a used link and confirm the
invalid-link state. Request resets for unknown and ineligible addresses and confirm the same
confirmation appears. Remove the operator's reset sender and confirm the link disappears from the
sign-in screen.

**Acceptance Scenarios**:

1. **Given** a mailbox user with the reset flag, **When** they enter a valid address and their
   current password and save, **Then** the new recovery address is shown. **When** they clear it and
   confirm, **Then** no recovery address is set.
2. **Given** a mailbox user without the reset flag, **When** they open My account, **Then** the
   recovery e-mail section is absent and the overview still shows the address an administrator set.
3. **Given** the sign-in screen and password reset available, **When** the user chooses "Forgot
   password?" and submits any well-formed address, **Then** the same confirmation appears, saying that
   a link valid for 15 minutes is sent if the address belongs to an account with a recovery address.
4. **Given** a valid reset link, **When** the user opens it, **Then** the app shows the account
   address, the time until which the link is valid and the policy rules, and the token is no longer
   visible in the address bar.
5. **Given** a reset for an account with TOTP, **When** the user submits a valid new password,
   **Then** the app asks for the second factor in the same way as at sign-in. **When** the code is
   wrong, **Then** they may try again while the link is valid. **When** it is right, **Then** the app
   confirms the reset and offers the sign-in screen.
6. **Given** an expired or used link, **When** the user opens it, **Then** a message says the link is
   invalid or expired and offers to request a new one.
7. **Given** a server whose reset message has no sender or subject, **When** the sign-in screen is
   shown, **Then** it offers no "Forgot password?" link, and an old bookmark of the request screen
   says that password recovery is currently unavailable and to contact the administrator.

---

### User Story 4 - Create and manage app passwords (Priority: P1)

A mailbox user whose permission flags allow app passwords opens **My account › App passwords** and
creates one for their phone: a name, the protocols it may use, and whether it is active. The server
generates a strong password, which the app shows exactly once, large and readable, with a copy
button and the username to use. Later the user renames one, changes its protocols, deactivates it,
gives it a new generated password, or deletes it. An administrator, or a domain administrator with
the app-password flag, does the same in the mailbox context.

**Why this priority**: Users with second factors need app passwords for every mail client, so story
2 is unusable without them.

**Independent Test**: As a mailbox user with the flag, create an app password limited to IMAP and
SMTP, use it for IMAP, deactivate it, give it a new password, and delete it, confirming IMAP
sign-in each time. Repeat in the mailbox context as an administrator and as a domain administrator
with and without the flag.

**Acceptance Scenarios**:

1. **Given** no app passwords, **When** the user opens the section, **Then** an empty state explains
   app passwords and offers "Create app password".
2. **Given** the creation form, **When** the user enters "Phone", keeps IMAP and SMTP and creates
   it, **Then** the generated password is shown once with a copy button and the mailbox address as
   username, in a dialog that asks for confirmation when closed without copying.
3. **Given** a created app password, **When** the user returns to the list, **Then** it shows the
   name, the protocols, the active state and the creation date, and no password.
4. **Given** an app password, **When** the user chooses "Generate new password" and confirms,
   **Then** a new password is shown once and the old one stops working.
5. **Given** an app password, **When** the user deletes it and confirms, **Then** it disappears.
6. **Given** a mailbox user without the app-password flag, **When** they open the section's address
   directly, **Then** the "no access" state of UI feature 001 is shown.
7. **Given** a domain administrator without the app-password flag, **When** they open a mailbox's app
   passwords, **Then** the list is shown read-only, without create, change or delete actions.

---

### User Story 5 - See my mailbox at a glance and open webmail (Priority: P2)

A mailbox user's My account starts with an overview: storage used against the quota and the
message count, the protocols they may use, the addresses that deliver to them (direct and
shared aliases, alias-domain addresses, catch-alls), the addresses they may send as, their recovery
address, when the password last changed, and how many app passwords and temporary aliases are
active. Their home screen shows the storage usage and a "Webmail" action, which opens webmail in a
new tab, already signed in. When the user's mailbox is set to go straight to webmail after sign-in,
the app does that after sign-in, as legacy does.

**Why this priority**: Webmail is the main tool of most mailbox users and the overview answers
frequent support questions, but users can still reach webmail through its own sign-in page.

**Independent Test**: As a mailbox user, compare every value of the overview with the legacy user
page; choose Webmail and confirm webmail opens signed in. Turn on direct forwarding to webmail for
the mailbox, sign in, and confirm the app opens webmail; sign in from a bookmarked app address and
confirm the app opens that address instead.

**Acceptance Scenarios**:

1. **Given** a mailbox with a 1 GiB quota of which 256 MiB are used, **When** the user opens My
   account, **Then** the overview shows the usage in the user's locale with a 25 % bar that has a text
   equivalent.
2. **Given** a mailbox without IMAP access, **When** the overview is shown, **Then** IMAP is listed as
   not allowed, in text and not by colour alone.
3. **Given** webmail is enabled, **When** the user chooses Webmail, **Then** webmail opens in a new
   tab signed in as the user. **When** the browser blocks the new tab, **Then** the app shows an
   "Open webmail" link to tap.
4. **Given** a mailbox with direct forwarding to webmail, **When** the user signs in from the sign-in
   screen, **Then** the app opens webmail in the same tab. **When** they sign in after opening a
   bookmarked app address, **Then** the app shows that address.
5. **Given** webmail is disabled on the server, **When** the user opens My account, **Then** neither
   the Webmail action nor the groupware resets are shown.

---

### User Story 6 - Use temporary aliases (Priority: P2)

A mailbox user whose flags allow temporary aliases opens **My account › Temporary aliases**. They
generate a random alias on their domain or one of its alias domains, with an optional description
and a validity (one year by default, or never expiring), and copy it for an online shop. Later they
change the validity of one or several aliases, or delete them. Administrators and domain
administrators do the same in the mailbox context.

**Why this priority**: A popular privacy feature, but nothing else depends on it.

**Independent Test**: As a mailbox user with the flag, generate an alias valid for one day, send mail
to it, make it permanent, delete it, and confirm mail is then refused. Repeat in the mailbox context.

**Acceptance Scenarios**:

1. **Given** no temporary aliases, **When** the user opens the section, **Then** an empty state
   explains temporary aliases and offers "Generate alias".
2. **Given** the generation form, **When** the user picks a domain, enters "Shop" and keeps one year,
   **Then** the new address is shown with a copy button and appears in the list with its expiry.
3. **Given** several aliases, **When** the user selects two and chooses "Expire in 1 week", **Then**
   both show the new expiry, and the app reports the result per alias if one of them fails.
4. **Given** a permanent alias, **When** the list is shown, **Then** its validity reads "Never
   expires".
5. **Given** an alias, **When** the user deletes it and confirms, **Then** it disappears.
6. **Given** a mailbox whose domain has no alias domains, **When** the user generates an alias,
   **Then** no domain choice is shown.

---

### User Story 7 - Adjust mail settings and push notifications (Priority: P2)

A mailbox user opens **My account › Mail settings**. Within their flags they choose how tagged mail
(`me+shop@example.org`) is handled, turn TLS enforcement for incoming and outgoing mail on or off
next to the warning, and connect Pushover: application token, user or group key, title, text, sender
filters, sound, priority options and active state; they verify the credentials and can remove the
settings. Administrators and domain administrators change the same settings in the mailbox context,
and set TLS enforcement for many selected mailboxes at once from the mailbox list.

**Why this priority**: These settings matter to the users who use them; defaults work for everyone
else.

**Independent Test**: As a mailbox user with the three flags, set tagging to "In subfolder" and
confirm a tagged message lands in a subfolder; turn on outgoing TLS enforcement; save, verify and
remove Pushover settings against a stubbed service. Turn each flag off and confirm its control is
absent. As an administrator, enforce outbound TLS for 30 selected mailboxes and read the
per-mailbox results.

**Acceptance Scenarios**:

1. **Given** the tagging setting, **When** the user selects "In subject", **Then** the choice is saved
   and announced, and the help shows an example with the user's own address.
2. **Given** the TLS policy, **When** the user looks at the switches, **Then** the warning about
   bounced mail is visible next to them without any interaction.
3. **Given** saved Pushover settings, **When** the user opens the form, **Then** the token and key
   fields are empty and say that a value is stored, never showing it.
4. **Given** the Pushover form, **When** the user enters a 29-character token, **Then** the error
   appears on the token field.
5. **Given** saved Pushover settings, **When** the user chooses "Verify credentials", **Then**
   Pushover's verdict, with its reason when negative, is announced.
6. **Given** saved Pushover settings, **When** the user removes them and confirms, **Then** the form
   returns to "not configured".
7. **Given** an administrator who selected 30 mailboxes in the mailbox list, one of them deleted
   meanwhile, **When** they enforce outbound TLS, **Then** the app reports 29 changed and 1 not
   found.

---

### User Story 8 - Review and clear recent logins (Priority: P2)

A mailbox user opens **My account › Recent logins** to check who used the account: each source
address with its country, the service (IMAP, SMTP, web, webmail and so on), the app password used if
any, and the last time, for the last day, week (default), two weeks or month. They clear the list
after changing their password. An administrator or domain administrator looks at the same list in
the mailbox context while helping the user.

**Why this priority**: The main tool to notice a compromised account, but it blocks nothing.

**Independent Test**: Sign in to IMAP with the password and with an app password, sign in to the web
app and open webmail, then open the section and confirm the entries; switch the period; filter by
service; clear the list.

**Acceptance Scenarios**:

1. **Given** connections in the last week, **When** the user opens the section, **Then** entries are
   shown newest first with address, country, service and time, and an app password's name where one
   was used.
2. **Given** the period "1 month", **When** the user selects it, **Then** older entries within the
   month are added.
3. **Given** entries, **When** the user clears them and confirms, **Then** the empty state is shown.
4. **Given** a connection from a private or internal address, **When** it is listed, **Then** it is
   labelled "internal" instead of showing a country.

---

### User Story 9 - Set up mail apps on my devices (Priority: P2)

A mailbox user who wants mail on a new phone opens **My account › Mail app setup**. The setup guide
lists, for each protocol (IMAP, POP3, SMTP, CalDAV/CardDAV, ActiveSync), the server name, port,
encryption and authentication method, and the username, each with a copy button, and says when an
app password is needed. On an iPhone, iPad or Mac they download a connection profile instead: e-mail
only, or e-mail, calendars and contacts. With the app-password flag they can have a new app password
put into the profile, so the device needs no password at all; that app password then appears in
their App passwords.

**Why this priority**: Configuring mail apps is one of the most frequent support requests, and
users who turned on two-factor authentication need the right settings together with an app
password. Legacy offers both, so dropping them would be a regression at cutover.

**Independent Test**: As a mailbox user with and without the app-password flag, open the setup
guide and compare every value with the server configuration; copy each value. Download each profile
variant, install it on an Apple test device, and confirm that mail (and calendars and contacts for
the full profile) work; for the variant with an app password, confirm the new app password is listed
and works. Disable groupware and confirm the full profile is no longer offered.

**Acceptance Scenarios**:

1. **Given** a mailbox user, **When** they open Mail app setup, **Then** each protocol shows its
   server name, port, encryption and authentication method and the username, each with a copy
   button whose success is announced.
2. **Given** a mailbox without direct POP3 access, **When** the guide is shown, **Then** POP3 carries a
   note that only an app password allowing POP3 works for it.
3. **Given** groupware enabled, **When** the user downloads "E-mail, calendars and contacts", **Then**
   the browser receives the profile, and the app explains that it is for iPhone, iPad and Mac.
4. **Given** the app-password flag, **When** the user downloads the e-mail-only profile with "Include
   a new app password", **Then** the profile is downloaded, the app says that it contains a password
   and should be deleted after installation, and the new app password appears in App passwords.
5. **Given** a mailbox user without the app-password flag, **When** they open Mail app setup,
   **Then** the "Include a new app password" option is not shown.
6. **Given** a domain administrator, **When** they open the Mail app setup address, **Then** the "no
   access" state explains that connection profiles are for mailbox users (legacy
   `login.mobileconfig_info`).

---

### User Story 10 - Manage mailbox sieve filters and read my filters (Priority: P3)

An administrator, or a domain administrator with the filters flag, opens **Mail setup › Filters**
(or a mailbox's Filters in the mailbox context) and manages the sieve filters of the mailboxes in
their scope: list, filter and search them, create one (mailbox, prefilter or postfilter,
description, script, active), check the script, edit it, activate or deactivate it, switch its kind,
and delete it. A domain administrator without the flag sees the same list read-only. A mailbox user
opens **My account › Filters** to read the filters their administrator set and the sieve script they
manage in webmail.

**Why this priority**: Few mailboxes need administrator filters, and webmail covers the user's own
rules.

**Independent Test**: As an administrator, create a postfilter with an invalid script (parser error
shown), fix and save it, deactivate and delete it. Repeat as a domain administrator with and without
the flag. As a mailbox user, open Filters with and without filters and an active script.

**Acceptance Scenarios**:

1. **Given** a script with a syntax error, **When** the user checks or saves it, **Then** the
   server's parser message is shown on the script field and nothing is saved.
2. **Given** a mailbox with an active prefilter, **When** the user activates another prefilter for
   it, **Then** the form has warned that the other active prefilter is deactivated, and the list
   reflects that.
3. **Given** several filters, **When** the user selects them and chooses "Deactivate", **Then** all
   selected filters show as inactive, with a per-filter result if one fails.
4. **Given** a mailbox user with two administrator filters and no active webmail script, **When** they
   open Filters, **Then** both filters are listed read-only and the script part shows "No active
   filter available".

---

### User Story 11 - Reset the ActiveSync device cache and the SOGo profile (Priority: P3)

A mailbox user whose phone stopped syncing resets the ActiveSync device cache from **My account ›
Devices**. A user with a broken webmail profile, whose administrator allows it, resets their SOGo
profile after reading that this deletes their contacts and calendars for good. Administrators and
domain administrators do both in the mailbox context.

**Why this priority**: Rare repair actions that save a support request.

**Independent Test**: With the flags on and webmail enabled, perform each reset and confirm the
effect; turn a flag off, or disable webmail, and confirm the control is absent.

**Acceptance Scenarios**:

1. **Given** the ActiveSync reset, **When** the user confirms, **Then** a success message is
   announced.
2. **Given** the SOGo profile reset, **When** the user opens the confirmation, **Then** it states that
   contacts and calendars are deleted irretrievably, and the reset button stays disabled until the
   user ticks "I understand that my contacts and calendars will be deleted".
3. **Given** a server with webmail disabled, **When** an administrator opens a mailbox's self-service
   part, **Then** no groupware reset is offered.

---

### User Story 12 - Trace self-service changes (Priority: P3)

An administrator investigating a complaint opens the audit log of UI feature 001, filters it by a
mailbox and by self-service event types (password changes, failed current-password checks, second
factors, reset requests, app passwords, temporary aliases, filters, settings, cleared logins,
groupware resets, webmail hand-offs) and reads who did what, when and from where, never a secret. A
mailbox's detail screen links to this filtered view.

**Why this priority**: Required for investigations, but users can work without it.

**Independent Test**: Perform each kind of change, then filter the audit log by mailbox and event
type and confirm the entries and that no secret is shown.

**Acceptance Scenarios**:

1. **Given** a user who changed their password and created an app password, **When** an
   administrator uses the History action of that mailbox, **Then** both events appear with actor,
   time and address, and the password appears only as "changed".
2. **Given** a domain administrator, **When** they open a mailbox's detail screen, **Then** no History
   action is shown.

---

### Edge Cases

- **Flag removed while a section is open**: the next change is refused with "permission flag
  missing". The app shows that the permission was withdrawn, re-reads the identity, and hides the
  section (own context) or makes it read-only (mailbox context).
- **Restricted session during any self-service screen**: when the API answers "pending action
  required", the app returns to the pending-actions screen.
- **Both forced actions pending**: the password change comes first, then second-factor setup.
- **Session expires while a form is open**: UI feature 001 handles re-authentication. Secret inputs
  (passwords, codes, keys) are cleared; other input may be restored.
- **Changed elsewhere**: when a setting changed in the legacy UI after it was loaded and the API
  refuses the write as outdated, the app says so, reloads the current values and keeps the user's
  unsaved non-secret input visible for re-entry.
- **Mail apps after a password change**: the mail server may accept the old password for up to 5
  minutes. The success message says so.
- **Second-factor setup started in another tab or session**: the API refuses the confirmation as
  expired; the app offers to start again.
- **Same security key as a passkey and as a second factor**: allowed; each entry is listed in its own
  section.
- **Inactive second-factor entries** (disabled by an administrator in the legacy UI): listed as
  inactive; they become active again at the next sign-in without an active second factor.
- **Unsupported entries** (deprecated U2F or HOTP): listed as "no longer supported" with a removal
  action; never counted as the active entry that keeps two-factor authentication on.
- **WebAuthn ceremony cancelled, timed out or refused**: the app explains the cause in plain language
  and offers to try again. Nothing is saved.
- **Security key already enrolled as a second factor**: the authenticator refuses it, and the app
  explains that this key is already enrolled.
- **Same YubiKey enrolled again**: the new entry replaces the old one; the list shows one entry.
- **TOTP code from a phone with a wrong clock**: the API refuses the code; the error hint suggests
  checking the phone's time.
- **Yubico, Pushover or country lookup service unreachable**: a temporary-failure message names the
  service in plain words and offers "Try again"; recent logins are shown without the missing
  countries.
- **Password reset link opened while signed in**: the app says that completing the reset signs out
  every session, including this one, and lets the user continue or return to the account.
- **Reset link opened on another device**: it works; the link alone carries the authorisation.
- **Reset for an account whose only second factors are unsupported entries**: the API refuses; the app
  tells the user to ask an administrator to reset their second factors.
- **Reset requested too often**: the app shows the "too many requests" message with the retry time.
- **App password created but the browser closed before copying**: the password cannot be shown
  again; the user generates a new password for it.
- **App password without any protocol**: allowed after a warning that it cannot be used anywhere.
- **App password and mailbox protocol access**: the section explains that an app password works for
  its own protocols even when the mailbox's direct access to a protocol is off, and never for the web
  app or webmail.
- **Copy to clipboard not permitted**: the secret stays visible and selectable, and the app says that
  copying failed.
- **Temporary alias expires while the list is open**: the next action on it reports "not found" and
  the list refreshes without it.
- **Bulk action with partial failure** (temporary aliases, filters, TLS): the app reports the result
  per item and keeps the failed items selected.
- **Filter kind changed on an active filter**: the other active filter of the new kind is deactivated;
  the form warns before saving.
- **Script larger than the size limit** (64 KiB by default): the API's size error is shown on the
  script field.
- **Domain administrator opens a mailbox outside their scope** (old link): the 001 "not found" state.
- **Webmail opened in a browser signed in to the classic interface**: the classic interface asks for
  a sign-in again; the Webmail action's help text says so.
- **App session ends while webmail is open in another tab**: webmail asks for a sign-in at its next
  request.
- **Pushover settings saved for the first time without token or key**: both fields are required.
- **Groupware disabled on the server**: webmail, both resets and the full connection profile are
  hidden in both contexts; the e-mail profile and the setup guide still work.
- **Password managed by an external identity provider**: password, recovery e-mail and second factors
  are replaced by an explanation; all other sections work.
- **App-password flag removed between opening Mail app setup and downloading**: the API refuses the
  variant with an app password; the app explains that the permission was withdrawn and hides the
  option.
- **Profile download interrupted after the API created the app password**: the app password is listed
  in App passwords, where the user can delete it, and the download can be repeated.
- **Self-service capabilities cannot be read**: sections that depend on them show their error state
  with "Try again" instead of guessing.
- **Offline or server unreachable**: every view shows its error state with "Try again".

## Requirements *(mandatory)*

### Functional Requirements

#### Placement, navigation and permissions

- **FR-001**: The app MUST provide a **My account** area for every signed-in role. It replaces the
  "My account" placeholder of the UI feature 001 navigation catalogue and MUST also be reachable from
  the user menu, in at most two interactions from any screen. For mailbox users, the UI feature 001
  home screen MUST additionally show the Webmail action (FR-098) and the storage usage, linking to My
  account; landing after sign-in follows FR-100.
- **FR-002**: My account MUST group its sections as follows and show each section only when its
  condition holds. A group with no visible section MUST be hidden.

  | Group | Section | Shown for |
  |---|---|---|
  | Overview | Mailbox overview and Webmail action | Mailbox users (Webmail only when webmail is enabled) |
  | Sign-in and security | Password | Every role, mailbox users only with a mailcow-managed password |
  | Sign-in and security | Recovery e-mail | Mailbox users with the `pwReset` flag and a mailcow-managed password |
  | Sign-in and security | Two-factor authentication | Administrators, domain administrators, mailbox users with a mailcow-managed password |
  | Sign-in and security | Passkeys (UI feature 001) | Every role |
  | Sign-in and security | App passwords | Mailbox users with the `appPasswds` flag |
  | Sign-in and security | Recent logins | Mailbox users |
  | Mail | Temporary aliases | Mailbox users with the `spamAlias` flag |
  | Mail | Mail settings: tagged mail | Mailbox users with the `delimiterAction` flag |
  | Mail | Mail settings: TLS policy | Mailbox users with the `tlsPolicy` flag |
  | Mail | Mail settings: Pushover | Mailbox users with the `pushover` flag |
  | Mail | Filters (read-only) | Mailbox users |
  | Devices | ActiveSync device cache reset | Mailbox users with the `easReset` flag, webmail enabled |
  | Devices | SOGo profile reset | Mailbox users with the `sogoProfileReset` flag, webmail enabled |
  | Devices | Mail app setup (setup guide and connection profiles) | Mailbox users |

  For a mailbox user with an externally managed password, the Password section MUST be replaced by a
  short explanation that their organisation manages the password and second factors.
- **FR-003**: The mailbox detail screen of UI feature 003 MUST offer, for administrators and for
  domain administrators on mailboxes in their scope, a self-service part with: App passwords,
  Temporary aliases, Filters (with the active sieve script), Push notifications, Mail settings,
  Recent logins and, when webmail is enabled, Groupware resets. Each section MUST name the mailbox in
  its heading.
- **FR-004**: In the mailbox context, every section MUST be readable. Change actions MUST be shown
  only when the caller may change: administrators always; domain administrators always, except that
  app passwords need their own `appPasswds` flag, Pushover their own `pushover` flag and filters
  their `filters` flag. Without the flag, the section MUST be read-only and say why.
- **FR-005**: **Mail setup › Filters** MUST appear in the navigation of administrators and domain
  administrators; for domain administrators without the `filters` flag it MUST be read-only.
- **FR-006**: Every section MUST have its own address so it can be bookmarked and opened directly.
  Opening the address of a section the user may not see MUST show the "no access" state of UI
  feature 001, never a broken page.
- **FR-007**: Hiding is a convenience only. When the API refuses an operation as forbidden, as
  "permission flag missing" (naming the flag) or as not found, the app MUST show the corresponding
  message, re-read the identity and update the visible sections.
- **FR-008**: Section and action labels MUST name what the user controls ("Temporary aliases", "App
  passwords"), not legacy table names.
- **FR-009**: The app MUST take server-dependent choices from the self-service capabilities and
  never hard-code them: whether webmail, the groupware resets and the full connection profile are
  offered; whether password reset
  is offered and the reset link lifetime; the temporary-alias validity range and default; the
  recent-login period range and default; the bulk limit; the field size limits; and the Pushover
  sounds.

#### Common behaviour of every view

- **FR-010**: Every view MUST define a loading state with an accessible busy indication, an empty
  state with a short explanation and the primary action where one exists, and an error state with the
  translated reason and "Try again".
- **FR-011**: Every successful change MUST be confirmed with a short translated message announced to
  assistive technology, without moving focus away from the changed control.
- **FR-012**: Validation errors returned by the API MUST be shown on the matching fields, translated
  from their rule code and parameters, including each unmet password rule and the refusal of values
  that look like a stored password hash. Errors that belong to no field MUST be shown in a summary at
  the top of the form, which receives focus.
- **FR-013**: The app MUST translate these problem types into specific messages: current password
  incorrect, password managed externally, permission flag missing (with the flag's label), password
  reset not available, invalid reset token, enrolment expired, last second factor, second factor
  required by policy, push notifications not configured, groupware disabled, outdated version,
  temporary failure (with the unavailable service), and from UI feature 001 second factor required,
  second factor failed, too many requests (with the retry time) and pending action required. Unknown
  types MUST fall back to the generic message of UI feature 001.
- **FR-014**: Single-setting controls (tagging, TLS switches, active switches) MUST save on change and
  show a pending state until the API confirms. If the save fails, the control MUST return to the
  stored value and the error MUST be announced.
- **FR-015**: Multi-field forms (passwords, recovery e-mail, Pushover, filters, second-factor setup,
  app password and temporary alias creation) MUST save only on an explicit action and MUST warn
  before the user leaves with unsaved changes.
- **FR-016**: A save MUST send only the changed fields plus the version the app read. When the API
  refuses a change as outdated, the app MUST say that it was changed elsewhere, keep the user's
  non-secret input, reload the object and mark the values that changed, and let the user save again.
  There is no automatic merge and no "overwrite anyway". A refused deletion MUST be confirmed again.
- **FR-017**: Deleting one object (an app password, temporary alias or filter) MUST be confirmed in a
  dialog that names it and its consequences. Deleting several selected objects MUST additionally
  require typing their number. Other destructive actions (generating a new app password, removing
  second factors, clearing recent logins, both resets, removing Pushover settings) MUST require one
  explicit confirmation that names the consequences.
- **FR-018**: Lists (app passwords, temporary aliases, filters, recent logins) MUST offer the search,
  filters and sort orders that the API supports for them, and page through results with page sizes of
  25 (default), 50 or 100. The list state MUST be kept in the page address, never in browser storage.
- **FR-019**: Actions on several selected items MUST use the API's bulk operation where it offers one
  (TLS in the mailbox list) and otherwise one request per item (temporary aliases and filters), each
  item carrying the version tag from the list. They MUST work on an explicit
  selection of the current page, which clears when the page, search, filters, sort or page size
  change. They MUST show progress, report the result per item (done, not found, refused, outdated, or
  failed with the reason), and keep the items that did not succeed selected. A dropped connection
  MUST be reported as "outcome unknown" and never retried automatically.
- **FR-020**: When an operation fails because a service is temporarily unavailable, the app MUST say
  which service in plain words (for example "the Yubico verification service") and offer "Try
  again".

#### Own password

- **FR-021**: Every role MUST be able to change its own password with the current password, the new
  password and its confirmation. Mailbox users with an externally managed password get no form
  (FR-002).
- **FR-022**: The form MUST show the password policy the API reports for the user's own password as a
  list of rules, and mark each rule as met or not met while the user types. The check guides only;
  the API decides.
- **FR-023**: The app MUST report a mismatch between the new password and its confirmation before
  submitting.
- **FR-024**: Each password field MUST offer show and hide and MUST carry the hints that let password
  managers recognise current and new passwords.
- **FR-025**: The form MUST offer "Generate", which fills both new-password fields with a random
  password that meets the displayed policy, shows it in clear text and offers to copy it.
- **FR-026**: The form MUST offer "Sign out my other sessions", ticked by default. After a successful
  change, the app MUST announce the change, the number of other sessions signed out and, for mailbox
  users, the number of app passwords that keep working, and say that mail apps may accept the old
  password for a few minutes. The user stays signed in and the fields are cleared.
- **FR-027**: Before the change, the form MUST tell mailbox users how many active app passwords they
  have and that those keep working.
- **FR-028**: A wrong current password MUST be reported on the current-password field. Repeated
  failures MUST show the "too many attempts" message with the retry time.

#### Forced password change

- **FR-029**: When the identity lists the pending action `passwordChange`, the pending-actions screen
  of UI feature 001 MUST offer a "Set a new password" form in place of its explanation, its link to
  the classic interface and its "Check again" action (UI 001 FR-040). The screen keeps its other
  content (language, theme, "Sign out"), and every other address still leads to it.
- **FR-030**: The form MUST ask for the new password and its confirmation only, with the policy rules
  (FR-022), show and hide (FR-024) and "Generate" (FR-025), and MUST explain the requirement with the
  legacy text `user.pw_update_required`.
- **FR-031**: After a successful change the app MUST re-read the identity. If `secondFactorSetup` is
  still pending, the pending-actions screen MUST continue with second-factor setup (FR-057);
  otherwise the app MUST continue as after sign-in (UI 001 FR-031), subject to FR-100.

#### Recovery e-mail

- **FR-032**: Mailbox users with the `pwReset` flag and a mailcow-managed password MUST be able to see
  their recovery e-mail address and set, change or clear it, confirming every change with the current
  password. The address field MUST open the e-mail keyboard.
- **FR-033**: The section MUST explain that password recovery is impossible without a recovery address
  (legacy `user.password_reset_info`).

#### Password reset before sign-in

- **FR-034**: When the signed-out self-service capabilities say that password reset is available, the
  sign-in screen of UI feature 001 MUST offer a "Forgot password?" link (legacy
  `login.forgot_password`) that opens the reset request screen. Otherwise the link MUST NOT be shown.
- **FR-035**: The reset request screen MUST work without a session and ask for the mailbox address
  only.
- **FR-036**: Every accepted request MUST lead to the same confirmation, which states the link
  lifetime and that a link is sent if the address belongs to an account with a recovery address, and
  MUST NOT state whether it does.
- **FR-037**: The app MUST show specific messages for "password recovery not available" and "too many
  requests" (with the retry time).
- **FR-038**: The app MUST provide the reset page that the e-mailed link opens. It MUST read the token
  from the link, remove it from the visible address and the browser history at once, and send it only
  to the API.
- **FR-039**: The reset page MUST check the token first. For a valid token it MUST show the account
  address, the time until which the link is valid, and the policy rules. For an unusable token it
  MUST show an "invalid or expired link" state (legacy `login.invalid_pass_reset_token`) with an
  action to request a new link.
- **FR-040**: The reset page MUST ask for the new password and its confirmation with FR-022 to FR-025.
  When the API requires a second factor, the app MUST present the second-factor step of UI feature
  001 (same method order and behaviour). A failed second factor MUST let the user try again while the
  link is valid. When the account has only unsupported second factors, the app MUST tell the user to
  ask an administrator.
- **FR-041**: After a successful reset the app MUST say that all sessions of the account were signed
  out and offer the sign-in screen. It MUST NOT sign the user in.
- **FR-042**: When a reset link is opened in a browser that is signed in, the app MUST warn that
  completing the reset signs out every session of the account, including this one.

#### Second factors

- **FR-043**: Administrators, domain administrators and mailbox users with a mailcow-managed password
  MUST be able to list their own second-factor entries with type (authenticator app, security key,
  Yubico OTP, or no longer supported), name, state (active or inactive), the key identifier for
  Yubico OTP, and a mark on the entry used for the current sign-in, together with whether the account
  must keep a second factor.
- **FR-044**: The section MUST offer "Add authenticator app" and "Add security key" directly and
  "Yubico OTP" under "Other methods", and MUST point to passkeys (UI feature 001) as the recommended
  way to sign in without a password.
- **FR-045**: Every addition MUST ask for a name of 1 to 255 characters and, outside forced setup, the
  current password.
- **FR-046**: TOTP setup MUST show the QR code the API provides, the key as grouped text with a copy
  button, and an "Open in authenticator app" action that uses the provisioning address the API
  provides. On narrow touch screens the open and copy actions MUST come before the QR code.
- **FR-047**: TOTP setup MUST ask for a six-digit code with the numeric keyboard and one-time-code
  autofill. A wrong code MUST keep the setup open with the same key. When the API reports the setup
  as expired (time limit or too many wrong codes), the app MUST say so and offer to start again.
- **FR-048**: The TOTP key, provisioning address and QR code MUST be shown only during setup and
  discarded when setup completes, is cancelled or expires.
- **FR-049**: Security key setup MUST check that the browser supports WebAuthn, and otherwise show the
  option as unavailable with an explanation. It MUST start the authenticator ceremony only after an
  explicit action and explain cancellation, timeout, an already enrolled key and an unsupported
  authenticator in plain language with "Try again".
- **FR-050**: Yubico OTP setup MUST ask for the Yubico API client ID (digits), the secret key, and an
  OTP produced by touching the key, with a link to where the API credentials are obtained (legacy
  `tfa.api_register`). The OTP field MUST accept the key's keyboard input and submit when the key
  sends its final Enter.
- **FR-051**: The user MUST be able to remove one entry after a confirmation, without the current
  password.
- **FR-052**: When the entry is the account's only active entry, removing it MUST instead turn
  two-factor authentication off: the confirmation MUST say that all entries are removed and that
  passkeys stay, and MUST ask for the current password.
- **FR-053**: The section MUST also offer "Turn off two-factor authentication", which removes all
  entries after confirmation with the current password.
- **FR-054**: When the API reports that the account must keep a second factor, the section MUST NOT
  offer removing entries or turning two-factor authentication off, and MUST explain that the
  administrator requires it (legacy `danger.tfa_removal_blocked`). If a removal is still refused with
  "second factor required by policy" (the requirement changed meanwhile), the app MUST show the same
  explanation and refresh the section.
- **FR-055**: For mailbox users, the section MUST explain that mail clients need app passwords once
  two-factor authentication is on (legacy `user.tfa_info`), linking to App passwords when the user has
  that flag.
- **FR-056**: After any addition or removal, the list MUST show the server's state without a manual
  reload.

#### Forced second-factor setup

- **FR-057**: When the identity lists `secondFactorSetup`, the pending-actions screen of UI feature 001
  MUST explain the requirement (legacy `tfa.setup_title`, `tfa.setup_required`) and offer every
  setup method, not only passkey registration. On a device without passkey support, the other
  methods replace the link to the classic interface (UI 001 FR-039).
- **FR-058**: The methods MUST be offered in this order: passkey (recommended, the UI feature 001
  registration), authenticator app, security key, and under "Other methods" Yubico OTP, each as in
  FR-045 to FR-050 but without the current password.
- **FR-059**: After a method completes, the app MUST re-read the identity and, once no action is
  pending, continue as after sign-in (UI 001 FR-031), subject to FR-100.

#### App passwords

- **FR-060**: Users with access (FR-002, FR-004) MUST be able to list app passwords with name, allowed
  protocols, active state and creation date.
- **FR-061**: Creating an app password MUST ask for a name (1 to 255 characters), the allowed
  protocols (IMAP, SMTP, POP3, Sieve, ActiveSync, CalDAV/CardDAV; all selected by default) and the
  active state (on by default). Choosing no protocol MUST show a warning that the app password then
  works nowhere.
- **FR-062**: The password MUST be generated by the API, never typed. After creation, the app MUST
  show it exactly once, in a dialog, in a readable grouping with a copy button, together with the
  username to use (the mailbox address) and a note that it cannot be shown again.
- **FR-063**: Closing that dialog without copying MUST ask for confirmation. The password MUST be
  discarded when the dialog closes.
- **FR-064**: The user MUST be able to rename an app password, change its protocols, and switch it
  between active and inactive.
- **FR-065**: The user MUST be able to give an app password a new password generated by the API
  ("Generate new password"), confirmed first and shown once as in FR-062 and FR-063.
- **FR-066**: The user MUST be able to delete an app password after confirmation.
- **FR-067**: The section MUST explain what app passwords are for (legacy `user.app_hint`), that each
  works only for its protocols even when the mailbox's direct access to a protocol is off, and that
  none of them signs in to the web app or webmail.

#### Temporary aliases

- **FR-068**: Users with access MUST be able to list temporary aliases with address, description,
  validity (expiry time or "Never expires") and creation time, newest first by default, sortable by
  expiry, filterable by permanence and searchable by address and description.
- **FR-069**: Generating an alias MUST let the user choose the domain from the domains the API reports
  as available for temporary aliases of that mailbox, in both contexts (no choice when there is only
  one), enter an optional description within the size
  limit, and choose a validity from 1 hour, 1 day, 1 week, 1 month, 1 year, 10 years and never
  expires, limited to the server's range, with the server's default preselected (1 year by default).
- **FR-070**: After generation the app MUST show the new address with a copy button. Each address in
  the list MUST also have a copy button.
- **FR-071**: The user MUST be able to change the validity of one or several selected aliases to one
  of the choices of FR-069, counted from now.
- **FR-072**: The user MUST be able to delete one or several selected aliases after confirmation.
- **FR-073**: The section MUST explain temporary aliases (legacy `user.spam_aliases_info`).

#### Mail settings

- **FR-074**: Users with the right (FR-002, FR-004) MUST be able to choose tagged-mail handling from
  "In subfolder", "In subject" and "Do nothing", as a single-choice group with the legacy explanation
  and an example built from the mailbox's address.
- **FR-075**: Users with the right MUST be able to turn "Enforce TLS incoming" and "Enforce TLS
  outgoing" on or off independently, each a labelled switch, with the warning (legacy
  `user.tls_policy_warning`) visible next to them and the note that enforcement also covers
  alias-domain addresses and aliases that deliver only to this mailbox.
- **FR-076**: The mailbox list of UI feature 003 MUST offer administrators and domain administrators a
  bulk action that sets inbound and/or outbound TLS enforcement on or off for selected mailboxes, up to
  the bulk limit (100 by default), with the per-mailbox results of FR-019.

#### Push notifications

- **FR-077**: Users with the right MUST be able to edit the Pushover settings: application token and
  user or group key (30 letters or digits each), title ("Mail" when empty), text (the default text
  when empty), sender addresses, the sound (from the server's list of Pushover sounds), the active
  state, and under "Advanced settings" a sender pattern, "Escalate high priority mail" and "Only
  consider high priority mail", each within the size limits.
- **FR-078**: The token and key fields MUST start empty and say whether a value is stored, never
  showing it. Leaving a field empty keeps the stored value and typing replaces it. Both MUST be
  required when none are stored.
- **FR-079**: The form MUST explain what is notified, with the mailbox's address (legacy
  `user.pushover_info`), and list the placeholders usable in title and text (legacy
  `edit.pushover_vars`).
- **FR-080**: The user MUST be able to verify the stored credentials and see Pushover's verdict, with
  its reason when negative, announced. Verifying unconfigured settings MUST explain that settings must
  be saved first.
- **FR-081**: The user MUST be able to remove all Pushover settings after confirmation.

#### Recent logins

- **FR-082**: Recent logins MUST show, per entry: the source address, or "internal" for private and
  internal addresses; the country when known; the service; the last time; and the name of the app
  password used, if any, linking to it when the viewer may open app passwords.
- **FR-083**: The user MUST be able to choose the period from 1 day, 1 week, 2 weeks and 1 month,
  limited to the server's range, with the server's default preselected (1 week by default); filter by
  service; and sort by time (newest first by default), service or address.
- **FR-084**: The user MUST be able to clear the recent logins after a confirmation that says they are
  also cleared in the classic interface.
- **FR-085**: Administrators and domain administrators MUST see recent logins only in the mailbox
  context. Their own sign-ins are in the audit log of UI feature 001.

#### Groupware resets

- **FR-086**: Users with the right MUST be able to reset the ActiveSync device cache, with the legacy
  explanation (`user.eas_reset_help`).
- **FR-087**: Users with the right MUST be able to reset the SOGo profile. The confirmation MUST state
  that settings, contacts, calendars and sharing are deleted irretrievably, and its reset button MUST
  stay disabled until the user ticks "I understand that my contacts and calendars will be deleted".
- **FR-088**: Both resets MUST be hidden in both contexts when webmail is disabled on the server. A
  "groupware disabled" refusal MUST still be explained if it occurs.

#### Sieve filters

- **FR-089**: Mailbox users MUST be able to read, in **My account › Filters**, the filters set for
  their mailbox (description, kind, active state, and the script on demand) and the active sieve
  script they manage in webmail, read-only, each script in a monospaced block that keeps line breaks,
  with a copy button. Without an active script the app MUST show "No active filter available"
  (legacy `user.no_active_filter`).
- **FR-090**: Administrators and domain administrators MUST be able to list the filters of all
  mailboxes in their scope in **Mail setup › Filters**, and of one mailbox in the mailbox context,
  with mailbox, description, kind and active state; filter by mailbox, kind and active state; search
  by description and mailbox; and sort.
- **FR-091**: Callers who may change filters MUST be able to create one with mailbox (a searchable
  choice within scope, preset in the mailbox context), kind (prefilter or postfilter), description (1
  to 255 characters), script and active state (on by default).
- **FR-092**: The script field MUST be a multi-line monospaced editor without automatic correction,
  capitalisation or spell checking, scrolling inside its own area.
- **FR-093**: They MUST be able to check a script without saving it; saving also checks it. The
  server's parser message MUST be shown on the script field when the check fails.
- **FR-094**: The form MUST warn that activating a filter, or changing the kind of an active filter,
  deactivates the other active filter of that kind for the mailbox (legacy `add.activate_filter_warn`,
  `mailbox.sieve_info`).
- **FR-095**: They MUST be able to edit, activate, deactivate, change the kind of, and delete one
  filter or several selected filters (FR-019).
- **FR-096**: Global prefilters and postfilters and sieve presets are not part of this feature (UI
  feature 013).

#### Mailbox overview and webmail

- **FR-097**: The mailbox overview MUST show: the address and display name; storage used against the
  quota (or "unlimited") and the percentage as a bar with a text equivalent; the message count; the
  direct-access state of IMAP, SMTP, POP3, Sieve, ActiveSync and CalDAV/CardDAV in text and icon; the
  direct aliases, shared aliases with their public comments, alias-domain addresses and catch-all
  addresses that deliver to the mailbox; the addresses and domains it may send as, or that it may send
  as any address; the recovery address; when the password last changed; and the number of active app
  passwords and temporary aliases and whether push notifications are active, each linking to its
  section when the user may open it.
- **FR-098**: The Webmail action MUST request the webmail hand-off from the API and open the returned
  address in a new tab. When the browser blocks the tab, the app MUST show an "Open webmail" link to
  tap. The action MUST NOT be offered during a restricted session or when webmail is disabled.
- **FR-099**: The Webmail action's help text MUST say that opening webmail signs the browser out of the
  classic interface if it is signed in there.
- **FR-100**: Once a mailbox user's session is full after a sign-in started from the sign-in screen,
  the app MUST open webmail in the same tab through the hand-off when the overview reports the
  mailbox's direct forwarding to webmail and webmail is enabled. It MUST NOT do so when the sign-in
  started from a bookmarked or linked app address, which the app then opens.

#### Mail app setup

- **FR-101**: The Mail app setup section MUST show the client configuration the API reports for the
  signed-in mailbox: for each protocol (such as IMAP, POP3, SMTP, CalDAV/CardDAV and ActiveSync) the
  server name, port, encryption and authentication method, plus the username (the mailbox address),
  each value with a copy button (FR-111). A protocol to which the mailbox has no direct access MUST
  carry a note that only an app password allowing it works.
- **FR-102**: The guide MUST explain when the mailbox password works and when an app password is
  needed (two-factor authentication on, or direct access off), linking to App passwords when the user
  has that flag.
- **FR-103**: The section MUST offer two Apple connection profile downloads, each explained (legacy
  `user.apple_connection_profile_mailonly`, `user.apple_connection_profile_complete`): "E-mail"
  (IMAP, SMTP) always, and "E-mail, calendars and contacts" only when groupware is enabled. Both MUST
  be offered on every device, with the note that they are for iPhone, iPad and Mac.
- **FR-104**: For users with the `appPasswds` flag, each download MUST offer "Include a new app
  password" (legacy `user.apple_connection_profile_with_app_password`). After such a download the app
  MUST say that the profile contains a new app password, that the file should be deleted after
  installation, and that the app password can be managed in App passwords, whose list then shows
  it. Without the flag the option MUST NOT be shown.
- **FR-105**: A profile MUST be handed to the browser as a download as soon as the API returns it, and
  the app MUST NOT keep it in memory, browser storage or any cache afterwards.
- **FR-106**: Opening the Mail app setup address as an administrator or domain administrator MUST show
  the "no access" state with the explanation that connection profiles are for mailbox users (legacy
  `login.mobileconfig_info`). After a mailbox user signs in from such a link, UI feature 001's
  deep-link landing MUST open the section.

#### Self-service history

- **FR-107**: The audit log viewer of UI feature 001 MUST let administrators filter by the self-service
  target types and by mailbox, and MUST show translated labels for the self-service event types and
  outcomes. Changed secrets MUST appear only as "set" or "changed".
- **FR-108**: Administrators MUST get a **History** action on the self-service part of the mailbox
  detail screen and on each app password, temporary alias and filter, opening the UI feature 001
  audit log filtered by that mailbox or object.

#### Secrets and security

- **FR-109**: Passwords, one-time codes, TOTP keys and provisioning addresses, app passwords, Yubico API
  keys, Pushover tokens and keys, connection profiles and reset tokens MUST NOT be written to browser
  storage, to the
  address bar or history (apart from the reset link's arrival, FR-038), or to any log.
- **FR-110**: Shown-once secrets (generated app passwords, TOTP keys) MUST be removed from the screen
  and from memory when their view closes, and MUST NOT be kept in any cached server state.
- **FR-111**: Copy actions MUST announce success or failure. When copying fails, the secret MUST stay
  visible and selectable. The app MUST NOT send any password or its hash to a third party.

#### Accessibility

- **FR-112**: Every screen MUST meet WCAG 2.2 AA in light, dark and system themes, be fully operable by
  keyboard with visible focus, and pass the automated accessibility checks of the constitution.
- **FR-113**: The QR code MUST have a text alternative that points to the key shown as text, and the
  key MUST be read by screen readers in its groups.
- **FR-114**: Confirmation dialogs MUST move focus into the dialog, keep it there, name the action on
  its confirming button and return focus to the triggering control on close.
- **FR-115**: Security key ceremonies and other waits MUST announce their state ("Touch your security
  key now", "Waiting for the server") and MUST NOT impose a time limit without "Try again".
- **FR-116**: Status (active, inactive, permanent, protocol allowed, used for this sign-in) MUST be
  conveyed by text, not by colour alone.

#### Internationalisation

- **FR-117**: All text MUST come from the translation files in English, Czech and Slovak.
- **FR-118**: Legacy keys MUST be reused where the meaning is unchanged, at least those listed in the
  Legacy Parity section. Legacy strings with HTML markup MUST be carried over as plain text with safe
  formatting, never rendered as raw HTML.
- **FR-119**: Counts and durations ("3 app passwords", "expires in 2 days", "2 sessions signed out")
  MUST use the plural rules of each language, including the Czech and Slovak forms for 1, 2 to 4 and
  5 or more.
- **FR-120**: Dates, times, sizes and numbers MUST be formatted with the user's locale, and expiry
  times MUST show the relative duration and the absolute date.

#### Mobile

- **FR-121**: Every screen MUST be usable at 360 px wide without horizontal page scrolling. Lists MUST
  render as cards on narrow screens and MAY become tables on wide screens.
- **FR-122**: Touch targets MUST be at least 44 by 44 CSS pixels.
- **FR-123**: Forms MUST use one column on narrow screens, open the matching keyboard (numeric for
  codes, e-mail for addresses) and keep the primary action reachable without scrolling past
  explanations.
- **FR-124**: Multi-selection MUST work by touch through an explicit selection mode, with the actions
  shown together with the number of selected items.

### Legacy Parity

Reference: FeldHost fork at upstream tag `2026-09a`, `data/web/`. Its files for this feature differ
from upstream only in the recent-login service label (`WEBUI`). "Matched" keeps the behaviour,
"Improved" keeps the capability with a better flow, "Moved" hands it to another UI feature, and
"Dropped" removes it, each with the reason.

| Legacy screen or element | Requirements | Outcome | Reason |
|---|---|---|---|
| User page tabs (`user.twig`: Mailbox › General / Details / Settings, Temporary aliases, App passwords, Pushover), gated by `acl.*` | FR-001, FR-002, FR-006 | Improved | My account sections with their own addresses instead of dropdown tabs and collapsed cards |
| Login landing: mailbox users go to webmail when "Direct forwarding to SOGo" is on (`index.php`), else to the user page | FR-001, FR-100 | Matched | Deep links are honoured instead of always forwarding |
| Spam filter tab, quarantine notification and category settings | — | Moved | UI feature 006 |
| Sync jobs tab | — | Moved | UI feature 008 |
| FIDO2 section (list, rename, remove, register, Touch ID) on user, domain-admin and admin pages | FR-002 (link) | Moved | UI feature 001 (passkeys) |
| Forced-password alert on the General tab (`user.force_pw_update`) | FR-029, FR-030 | Improved | The blocking pending-actions screen replaces an alert on a page that still worked |
| Webmail button (`user.open_webmail_sso`), disabled during forced change or dual login | FR-098, FR-099 | Matched | New tab with fallback link; dual login belongs to UI feature 007 |
| Overview: messages, quota bar | FR-097 | Matched | Text equivalent added |
| Protocol badges with tooltip (`user.direct_protocol_access`) | FR-097, FR-116 | Improved | State in text, not colour; no hover-only tooltip |
| Details tab: direct and shared aliases, "also allowed to send as", "send as all", catch-all | FR-097 | Matched | In the overview |
| Apple connection profiles (four `mobileconfig.php` links: e-mail or e-mail with calendars and contacts, each with or without a new app password) | FR-103 to FR-105 | Matched | Same four variants; the app-password variant follows the flag; the user is told that the file holds a password |
| Client configuration guide link (`user.client_configuration`, external documentation with a server-built anchor) | FR-101, FR-102 | Improved | In-app setup guide with the server's own values and copy buttons |
| Login page notice for profile links (`login.mobileconfig_info`) | FR-106 | Matched | Deep link to Mail app setup survives sign-in |
| "Show active user sieve filter" modal | FR-089 | Improved | Own section with the administrator filters, copy and empty state |
| Change password modal (`pwChangeModal`: new, repeat, generate, current, app-password hint) | FR-021 to FR-028 | Improved | Live policy rules, show and hide, password-manager hints, other sessions signed out; generator kept |
| HaveIBeenPwned check on password fields | FR-111 | Dropped | Sends password hash prefixes to a third party (privacy, CSP, offline installations) |
| Recovery e-mail modal (`pwRecoveryEmailModal`, `acl.pw_reset`) | FR-032, FR-033 | Matched | Clearing made explicit |
| "Forgot password?" link always shown on the login page | FR-034 | Improved | Shown only when password reset works |
| 2FA badges with "[remove]" (`tfa_keys.twig`) | FR-043, FR-051 | Improved | List with type, name, state and the entry used for this sign-in |
| "Set two-factor authentication method" select (Yubi OTP, WebAuthn, TOTP, Deactivate) | FR-044, FR-053 | Improved | Explicit add actions; "Deactivate" becomes "Turn off two-factor authentication" |
| `last_key` error when removing the last key | FR-052 | Improved | Removing the only active entry turns 2FA off instead of failing |
| Removal blocked when 2FA is forced (`tfa_removal_blocked`) | FR-054 | Matched | Explained, removal no longer offered |
| TOTP modal (name, current password, QR, secret, confirm code) | FR-045 to FR-048 | Improved | Open-in-app and copy for phones; retry without re-scan |
| WebAuthn modal (name, current password, start validation) | FR-045, FR-049 | Improved | Support check and plain-language failure states |
| Yubi OTP modal (name, Yubico API ID and key, current password, touch) | FR-045, FR-050 | Matched | Under "Other methods" |
| Disable TFA modal (current password) | FR-052, FR-053 | Matched | — |
| Forced 2FA setup modal (`SetupTFAModal`: TOTP, WebAuthn, Yubi tabs, close = logout) | FR-057 to FR-059 | Improved | Passkey offered first; explicit sign-out |
| Forced password modal (`ChangePWModal`: new, repeat, close = logout) | FR-029 to FR-031 | Improved | Policy rules; continues to 2FA setup when pending |
| Recent successful connections (period 1 day to 1 month, clear, flag image, bgp.tools link, app-password link) | FR-082 to FR-084 | Improved | Service filter and sorting; country as text instead of a flag image; the external bgp.tools link is dropped (third-party lookup) |
| Domain-admin "last UI login" and its clear link | FR-085 | Dropped | The API does not offer it; administrators' sign-ins are in the 001 audit log |
| Tagging buttons with help (`user.tag_*`), also on the edit-mailbox page | FR-074 | Improved | Single-choice group with the mailbox's own example |
| TLS policy toggle buttons with warning, also on the edit-mailbox page | FR-075 | Improved | Labelled switches with the warning always visible |
| Mailbox list TLS mass actions | FR-076 | Improved | Per-mailbox results |
| EAS reset button | FR-086 | Matched | — |
| SOGo profile reset button | FR-087 | Improved | Extra deliberate step for an irreversible deletion |
| Temporary aliases table, quick actions (expire in 1 h … 10 y, never, remove), random alias per domain for 1 year | FR-068 to FR-073 | Improved | Validity chosen at creation; copy buttons; search and filters; per-alias results |
| App passwords table, quick actions (activate, deactivate, remove), add modal with typed or browser-generated password, edit page | FR-060 to FR-067 | Improved | Server-generated, shown once; new password on demand; per-item actions |
| Pushover tab on the user page and the edit-mailbox page (token, key, title, text, senders, sound, active, advanced, save, verify, remove) | FR-077 to FR-081 | Improved | Token and key write-only after saving |
| Reset password page (request by username; new password with token; invalid token message) | FR-035 to FR-042 | Improved | Account and link validity shown; token removed from the address bar |
| Reset completion requires 2FA when the account has it (`awaiting_tfa_confirmation`) | FR-040 | Matched | Same second-factor step as sign-in |
| "Recovery email sent to j***@example.org", "Mailbox not found or no recovery email is set", "Could not send a recovery email" | FR-036 | Dropped | They reveal whether an account exists |
| Mail setup › Filters tab (list, add, edit, quick actions, validate), shown to every domain admin with actions gated by `filters` | FR-005, FR-090 to FR-095 | Improved | Filters and search, check before save, per-filter results, mailbox context |
| Sieve presets in the add-filter modal; global prefilter and postfilter | FR-096 | Moved | UI feature 013 |
| Admin own password (through "edit admin") and domain-admin "change password" link | FR-021 | Improved | One own-password screen for every role |
| Admins reaching a user's app passwords, temporary aliases or recent logins only by logging in as the user | FR-003, FR-004 | Improved | Mailbox context, without impersonation |

Legacy translation keys reused (meaning unchanged): the `user.*` keys for password, recovery e-mail,
app passwords, temporary aliases, tagging, TLS policy, Pushover, resets, recent logins, active
filter and webmail; `edit.pushover_*`; `tfa.tfa`, `tfa.totp`, `tfa.webauthn`, `tfa.yubi_otp`,
`tfa.key_id`, `tfa.key_id_totp`, `tfa.scan_qr_code`, `tfa.enter_qr_code`, `tfa.confirm_totp_token`,
`tfa.api_register`, `tfa.setup_title`, `tfa.setup_required`, `tfa.start_webauthn_validation`,
`tfa.delete_tfa`; `login.forgot_password`, `login.reset_password`, `login.request_reset_password`,
`login.new_password`, `login.new_password_confirm`, `login.invalid_pass_reset_token`;
`add.app_password`, `add.app_name`, `add.app_passwd_protocols`, `add.sieve_desc`, `add.sieve_type`,
`add.validate`, `add.activate_filter_warn`, `mailbox.filters`, `mailbox.add_filter`,
`mailbox.sieve_info`, `mailbox.set_prefilter`, `mailbox.set_postfilter`, `edit.sogo_access`,
`edit.validate_save`, `user.apple_connection_profile`, `user.apple_connection_profile_mailonly`,
`user.apple_connection_profile_complete`, `user.apple_connection_profile_with_app_password`,
`user.email`, `user.email_and_dav`, `user.with_app_password`, `user.client_configuration`,
`login.mobileconfig_info`; and the messages `danger.last_key`, `danger.tfa_removal_blocked`,
`danger.totp_verification_failed`, `danger.yotp_verification_failed`,
`danger.webauthn_verification_failed`, `danger.password_mismatch`, `danger.password_complexity`,
`danger.password_reset_na`, `danger.reset_token_limit_exceeded`, `danger.invalid_reset_token`,
`danger.sieve_error`, `danger.pushover_key`, `danger.pushover_token`,
`danger.pushover_credentials_missing`, `success.password_changed_success`,
`success.app_passwd_added`, `success.eas_reset`, `success.sogo_profile_reset`. Not reused:
`user.alias_full_date` (locale formatting replaces it), `success.recovery_email_sent` and
`danger.password_reset_invalid_user` (dropped behaviour), and strings whose `%s` or `%d` placeholders
need plural forms (for example `user.change_password_hint_app_passwords`), which get new keys with the
legacy text as the starting translation.

### API Dependency

This feature depends on **mailcow-rest-v2 feature 005** (account self-service, specified in commit
`feeb443`, aligned in `c3cfa14`, and amended by the orchestrator decisions recorded in
Clarifications) and on the released contracts of **feature 001** (identity,
permission flags, pending actions, passkeys, second-factor step, audit log, problem types) and
**feature 003** (mailbox list and detail that host the mailbox context). It can start once the
feature 005 contract is merged. Requirement numbers in the middle column refer to the API feature 005
specification unless stated.

| Capability the UI needs | API requirement | UI requirements |
|---|---|---|
| Identity with role, flags, authentication source and pending actions | 001 FR-014, FR-028 | FR-001 to FR-007, FR-029, FR-057 |
| Passkey registration (also in forced setup) | 001 FR-052 to FR-054 | FR-002, FR-058 |
| Scope and authorisation per operation, "permission flag missing" naming the flag | FR-001 to FR-006 | FR-002 to FR-007 |
| Self-service capabilities, signed in and signed out | FR-080 | FR-009, FR-034, FR-036, FR-069, FR-076, FR-077, FR-083, FR-088 |
| Own password change with optional sign-out of other sessions; counts of ended sessions and working app passwords | FR-008 to FR-013 | FR-021 to FR-028 |
| Password rules for the own password, also in a restricted session and for a reset token | FR-014, FR-023 | FR-022, FR-030, FR-039 |
| Forced password change and forced second-factor setup in a restricted session | FR-015 to FR-017 | FR-029 to FR-031, FR-057 to FR-059 |
| Recovery address read and change with the current password | FR-018 | FR-032, FR-033 |
| Reset request, token check (address, expiry, rules), completion with optional second factor, reset page address | FR-019 to FR-026 | FR-034 to FR-042 |
| Second-factor list, TOTP enrolment (secret, provisioning address, QR code), WebAuthn enrolment, Yubico OTP enrolment, removing one, removing all | FR-027 to FR-036 | FR-043 to FR-059 |
| "Must keep a second factor" state with the second factors | FR-080 (capabilities `account`) | FR-043, FR-054 |
| App passwords list, create with a server-generated password returned once, change (including a new generated password), delete | FR-037 to FR-041 | FR-060 to FR-067 |
| Temporary aliases list, create, change validity, delete | FR-042 to FR-046 | FR-068 to FR-073 |
| Temporary-alias domains of a mailbox, also in the mailbox context | FR-069, FR-081 | FR-069 |
| Filters list, create, change, delete, validate; active sieve script | FR-047 to FR-053 | FR-089 to FR-095 |
| Push notification settings read (credentials only as "stored"), replace, remove, verify | FR-054 to FR-057 | FR-077 to FR-081 |
| Tagging and TLS read and change; bulk TLS with per-mailbox outcomes | FR-058 to FR-060 | FR-074 to FR-076 |
| Recent logins with period, filters, sorting; clear | FR-061 to FR-063 | FR-082 to FR-085 |
| ActiveSync and groupware profile resets | FR-064 to FR-066 | FR-086 to FR-088 |
| Webmail hand-off; mailbox overview (including direct forwarding, temporary-alias domains, counts) | FR-067 to FR-069 | FR-069, FR-097 to FR-100 |
| Client configuration data per protocol for the signed-in mailbox user | FR-083 | FR-101, FR-102 |
| Connection profile for the signed-in mailbox user: full or e-mail only, optionally with a new app password, respecting the app-password flag | FR-082 | FR-103 to FR-106 |
| Version tags and outdated refusal | FR-070, FR-071 | FR-016, FR-019 |
| Audit records with self-service target types and filters | FR-073, FR-074 | FR-107, FR-108 |
| Problem types and validation rule codes | FR-075; 001 FR-049, FR-055 | FR-012, FR-013 |

**API gaps**: the three gaps found while specifying (the "must keep a second factor" state, the
temporary-alias domains in the mailbox context, and the connection profiles with the client
configuration) were added to API feature 005 by orchestrator decision and are now API FR-080 to
FR-083 (contract commit `3207925`). Gaps found while planning are listed in
[plan.md](./plan.md#api-dependency-and-gaps): the bulk TLS version tag (G1) blocks only the bulk
TLS action; the others do not block this feature.

### Key Entities *(include if feature involves data)*

- **Account**: the signed-in user with role, permission flags, authentication source and pending
  actions (UI feature 001).
- **Self-service capabilities**: the server settings and limits the screens depend on.
- **Password policy**: the rules for new passwords, shown as a checklist.
- **Recovery e-mail**: an optional address of a mailbox user that receives reset links.
- **Password reset link**: a single-use, time-limited link that names the account.
- **Second-factor entry**: a TOTP, WebAuthn security key, Yubico OTP or unsupported entry with a name,
  a state and a mark when used for the current sign-in.
- **App password**: a named, server-generated secret of a mailbox with allowed protocols, an active
  state and a creation date. The secret is visible once.
- **Temporary alias**: a generated address on the mailbox domain or one of its alias domains, with a
  description, an expiry or "never expires", and a creation time.
- **Mail settings**: tagged-mail handling and inbound and outbound TLS enforcement of a mailbox.
- **Push notification settings**: Pushover credentials (write-only) and notification options of a
  mailbox.
- **Recent login**: a source address, country, service, optional app password and last time.
- **Sieve filter**: a prefilter or postfilter script of a mailbox with description and active state;
  plus the read-only active script from webmail.
- **Mailbox overview**: quota, usage, protocols, addresses, send-as permissions, recovery address and
  counts of the user's mailbox.
- **Client configuration**: server name, port, encryption and authentication per protocol for the
  user's mailbox.
- **Connection profile**: a downloadable Apple configuration file for the user's mailbox, e-mail only
  or with calendars and contacts, optionally holding a newly created app password.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In moderated tests on a 360 px phone, at least 9 of 10 mailbox users set up an
  authenticator app as a second factor within 3 minutes without help.
- **SC-002**: 100% of test accounts flagged for a forced password change or forced second-factor
  setup resolve it in the new web app without visiting the legacy UI, and at least 9 of 10 users reach
  their home screen within 60 seconds of signing in.
- **SC-003**: A mailbox user creates an app password and copies it in under 30 seconds and in at most
  4 interactions from My account.
- **SC-004**: A password reset, from "Forgot password?" to signing in with the new password, takes
  under 3 minutes excluding message delivery, including a second factor.
- **SC-005**: Every screen of this feature passes the automated accessibility checks with zero
  violations on the mobile and desktop viewports, in light and dark themes.
- **SC-006**: No screen of this feature scrolls horizontally at 360 px in 100% of the end-to-end
  checks.
- **SC-007**: 100% of user-facing strings exist in English, Czech and Slovak, and every legacy key
  listed in the Legacy Parity section is reused.
- **SC-008**: In end-to-end tests, no password, one-time code, TOTP key, app password, Yubico key,
  Pushover credential or reset token is found in browser storage, the address bar or history (after
  the reset link has been read), or the console.
- **SC-009**: For each permission flag of FR-002 and FR-004 turned off, the matching section is absent
  (own context) or read-only (mailbox context) in 100% of tests, and a direct address of a hidden
  section shows the "no access" state.
- **SC-010**: 100% of the legacy elements in the Legacy Parity table are matched, improved, moved or
  dropped with a reason.
- **SC-011**: Every view shows a loading indication at once and its content within 2 seconds for 95%
  of loads on a mid-range phone over a 4G-class connection.
- **SC-012**: A mailbox user reaches webmail from the app within 3 seconds and without a credential
  prompt in 95% of attempts.
- **SC-013**: In moderated tests, at least 9 of 10 mailbox users get mail working in a phone mail app
  within 5 minutes without help, using either the setup guide or a connection profile.

## Assumptions

- UI feature 001 provides the app shell, navigation, the sign-in screen, the second-factor step, the
  restricted-session gate, passkeys, the audit log viewer, the "no access" state and the shared
  error handling, including the pending-actions screen of restricted sessions. This feature adds the
  "Forgot password?" link, replaces that screen's forced-password explanation with a form, adds the
  remaining second-factor methods to it, adds self-service filters and History actions to the audit
  log, and fills the "My account" entry of the navigation catalogue.
- UI feature 003 provides the mailbox list (with multi-selection) and the mailbox detail screen that
  host the mailbox context and the bulk TLS action. UI features 002 to 004 provide the Mail setup
  navigation that hosts Mail setup › Filters.
- The API generates app passwords when the client gives none; the app always lets it. The app
  generates only the suggested own password (FR-025), as legacy does.
- The reset message's link opens this app's reset page, which is the API's default reset page. The
  message template and sender come from the existing mailcow settings (edited in UI feature 013).
- Mailboxes whose password is managed by an external identity provider reach the app only by passkey
  until UI feature 012, and have no password, recovery e-mail or second-factor management here.
- Administrators manage other accounts' passwords, recovery e-mails, forced flags and second factors
  in UI features 003 and 007, not here.
- Quarantine notification settings, spam filter, sync jobs, sender permission editing, login-as and
  webmail on behalf of a user, global filters and sieve presets are out of scope (UI features 006,
  008, 004, 007, 013).
- The webmail is SOGo on the same host name. The webmail hand-off is built as API feature 005
  decided (orchestrator decision).
- Connection profiles and client configuration data are produced by the API; the app only displays
  the data and hands the profile to the browser as a download.
- SOGo's own "back to settings" button keeps pointing to the legacy user page (API feature 005
  assumption).
