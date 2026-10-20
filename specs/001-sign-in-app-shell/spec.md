# Feature Specification: Sign-in, Application Shell, Passkeys and API Keys

**Feature Branch**: `main` (no feature branches, constitution 1.1.0)

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description, built from `docs/roadmap.md` ("Input for the first
`/speckit-specify`") and updated to the clarified mailcow-rest-v2 feature 001 specification:

> Sign-in, application shell, passkeys and API key management for mailcowui-ng, the mobile-first
> web app for an existing mailcow-dockerized server. Its only backend is mailcow REST API v2
> feature 001 (sign-in, sessions, passkeys, identity, preferences, API keys, public branding
> configuration and audit log). The legacy mailcow UI keeps working next to it.
>
> Users: administrators, domain administrators and mailbox users. They already have accounts.
> Some have TOTP, WebAuthn or Yubico OTP second factors, and some have credentials that legacy
> calls "FIDO2" or "Touch ID on Apple M1", which this app calls passkeys.
>
> Passkey sign-in is the primary method and is offered first when the device supports it.
> Username and password are the alternative. In the second-factor step the order is
> WebAuthn/passkey, then TOTP, with Yubico OTP shown as "advanced". Users register, rename and
> remove their own passkeys. Restricted sessions show their pending actions: forced second-factor
> setup is resolved by registering a passkey, and a forced password change is explained with a
> link to the legacy UI until feature 005. Branding (name, logos, help text, footer,
> announcement, login page options, languages) comes from the API's public configuration, with
> operator HTML sanitised and default theme colours until feature 013. Mailboxes that
> authenticate against LDAP or Keycloak get the generic sign-in failure until feature 012, with a
> hint when an identity provider is configured. The API returns stable codes in English and the
> app translates them, including throttling, expired sessions, expired pending sign-ins and
> anti-forgery failures. Navigation follows the role and permission flags, and sections of later
> features show a placeholder, never a broken link. Language and theme are saved to the profile;
> before sign-in the browser language is used. Administrators manage API keys (owner
> administrator or domain administrator, read-only or read-write, optional expiry and allowed
> networks, secret shown once with a copy button, inspect, revoke, revoked keys stay listed) and
> browse the audit log with filters. Every screen is fully usable at 360 px, meets WCAG 2.2 AA and
> has loading, empty and error states.
>
> Out of scope: managing mail objects, enrolling TOTP, WebAuthn security keys and Yubico OTP,
> password change and reset, identity-provider sign-in and login-as.

## Clarifications

### Session 2026-10-18

- Q: Should the app offer one sign-in screen for everyone, or one per role as the legacy UI
  does? → A: Both. One role-neutral sign-in screen, on which the server resolves the account
  type in mailcow's order, plus a role-specific screen each for administrators, domain
  administrators and mailbox users. Links between them follow the operator's options for hiding
  login links. (agent decision: API FR-002 makes the role optional and passkeys are role-neutral,
  so one screen serves almost everyone; the role screens keep the ambiguous-username case and the
  login page options meaningful.)
- Q: What should the app do when the operator has enabled "force single sign-on", while
  identity-provider sign-in is not available until feature 012? → A: The role-neutral and
  mailbox-user screens hide the password form and the "Forgot password?" link, keep passkey
  sign-in, and link to the classic interface for single sign-on. The administrator and
  domain-administrator screens keep the password form. (agent decision: legacy hides the form only
  on the mailbox-user page; API FR-003 lets passkeys work for identity-provider mailboxes, and
  passkeys are the owner's primary method.)
- Q: Which languages should the app offer when the server's enabled languages differ from the
  app's translations? → A: Only languages that are both enabled on the server and translated in
  the app (initially English, Czech and Slovak). If there are none, the app uses English, offers no
  language choice and saves no language. (agent decision: constitution IV requires complete
  translations, and API FR-030 rejects languages that the server has not enabled.) *Amended
  2026-10-18 (constitution 1.3.0): the app ships every mailcow language, so it offers the server's
  enabled languages that mailcow ships; see FR-060.*
- Q: When the language or theme chosen on the sign-in screen differs from the saved profile
  preference, which one applies after sign-in? → A: A choice the user made on the sign-in screen
  during this visit applies and is saved to the profile; otherwise the profile applies. The last
  applied language and theme are remembered on the device for the next sign-in screen; on a first
  visit the browser language and the device theme apply. (agent decision: an explicit choice is the
  user's current intent; legacy remembers both on the device; constitution V only forbids storing
  credentials.)
- Q: Where should a user land after signing in? → A: On the page they asked for before signing
  in, if it is an address of the app; otherwise on the home screen. The legacy redirects
  (administrators to the dashboard, domain administrators to mailboxes, mailbox users to webmail)
  are not reproduced, because those sections arrive with later features and webmail single sign-on
  with feature 005. (agent decision: deep links must survive sign-in; redirecting to a placeholder
  or to webmail without single sign-on would be worse than the home screen.)
- Q: How should the app handle the idle session timeout? → A: It warns 2 minutes before the
  session would expire, offers "Stay signed in" and "Sign out", and never sends automatic requests
  that would keep an idle session alive. After expiry it explains what happened and returns to the
  same page after the next sign-in. (agent decision: WCAG 2.2.1 Timing Adjustable applies to a
  3-hour limit; legacy silently reloaded the page.)
- Q: Should passkeys also be offered in the browser's autofill suggestions on the username field?
  → A: Yes, where the browser supports it, in addition to the passkey sign-in action, which stays
  first. The app never opens a passkey prompt by itself when the screen loads. (agent decision:
  fewer taps for the primary method; an unprompted dialog would confuse users without a passkey.)
- Q: What should a navigation entry for a section of a later feature open? → A: An in-app
  placeholder that names the section, says it will come in a later version, and links to the
  matching screen of the classic interface, which needs its own sign-in. (agent decision: "never a
  broken link"; the legacy UI keeps running until the cutover, feature 014.)
- Q: What should the API key form preselect? → A: Read-only access and no expiry are
  preselected; expiry presets are 30, 90 and 365 days or a specific date. (agent decision: least
  privilege for access; legacy keys never expire and silent expiry breaks billing integrations.
  How the owner is chosen was later settled by the orchestrator, see below.)
- Q: How should the one-time API key secret be presented and protected? → A: In a dialog right
  after creation, with the full secret, a copy button and a warning that it will not be shown
  again. Closing without copying asks for confirmation. The secret exists only while the dialog is
  open and is never written to the device or to a page address. (agent decision: API FR-034 and
  constitution V.)
- Q: What should user-facing text call the legacy mailcow UI? → A: "The classic interface"
  ("klasické rozhraní" in Czech, "klasické rozhranie" in Slovak). The word "legacy" is not used in
  the app. (agent decision: users do not know the term "legacy", and a neutral name keeps the app
  free of product names, as constitution IV requires.)
- Q: Where does the app get the app links (webmail and operator links) that the legacy login page
  and header show? → A: From the ordered, read-only app links in the API's public configuration,
  built from legacy `MAILCOW_APPS` and `APP_LINKS`, with Webmail left out when the groupware is
  disabled. The app shows them where legacy does, on the sign-in screen and in an "Apps" menu of
  the signed-in header, labelled with the operator's "Apps" UI text. (orchestrator decision: API
  feature 001 adds the list, which closes the app-links gap.)
- Q: How does an administrator choose the owner of an API key? → A: With a searchable picker of
  the key-owner candidates the API offers (active administrators and domain administrators, with
  search and paging), prefilled with the signed-in administrator. (orchestrator decision: API
  feature 001 adds an administrator-only read of key-owner candidates, which closes the key-owner
  gap.)
- Q: Should the API offer a way to extend a pending sign-in? → A: No. The 5-minute limit stays an
  essential security time limit: the app warns one minute before it ends and lets the user restart
  with the username kept. (orchestrator decision.)
- Q: Should passkeys stay available under "force single sign-on", and should mailbox users land
  on the home screen instead of webmail? → A: Yes to both. Mailbox users land on the home screen
  until feature 005 brings webmail single sign-on. (orchestrator decision: confirms the agent
  defaults above.)
- Q: Who manages the legacy `/api/v1` keys? → A: The legacy UI. The new app manages only keys of
  the new API, and the cutover (feature 014) keeps the legacy `/api/v1` key screen reachable.
  (orchestrator decision.)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in with username and password, complete a second factor, sign out (Priority: P1)

An administrator opens the app on a phone. The sign-in screen shows the operator's logo, product
name, current announcement and help text, exactly as configured for the legacy UI. Their phone
has no passkey for this server, so they enter the username and password they already use in the
legacy UI. Their account has an authenticator app, so the app asks for a second factor and offers
the methods in the recommended order. They enter the six-digit code and land on the home screen,
with navigation for their role. Later they sign out from the user menu and see the sign-in
screen again, with a confirmation that they signed out.

Wrong credentials, too many attempts, a wrong or late second factor and an unreachable
verification service each produce a clear message in the user's language.

**Why this priority**: Every account has a password, so this path always works. Every other part
of the app depends on a signed-in identity.

**Independent Test**: Against a mock API generated from the contract, with accounts of all three
roles (without second factors, and with WebAuthn, TOTP, Yubico OTP and combinations of them),
sign in on a 360 px and on a desktop viewport, complete the second factor, reach the home screen
and sign out. Repeat each failure scenario below.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor on a 360 px wide phone, **When** they open the app, **Then** the
   sign-in screen shows the operator's logo for the active theme, the product name, the active
   announcement, the help text and the operator's app links under its "Apps" text, without
   horizontal scrolling.
2. **Given** an administrator without second factors, **When** they submit the correct username
   and password, **Then** they land on the home screen with the administrator navigation.
3. **Given** a mailbox user with WebAuthn, TOTP and Yubico OTP second factors, **When** the
   password step succeeds, **Then** the second-factor step offers the security key or passkey
   first and the authenticator app second, and offers Yubico OTP only under "Other methods".
   **When** they enter a valid TOTP code, **Then** they land on the home screen.
4. **Given** a user with two authenticator apps enrolled, **When** the second-factor step opens,
   **Then** they choose the authenticator by its name before entering the code. With only one
   authenticator, it is preselected and the code field has focus.
5. **Given** any visitor, **When** they submit a wrong password, **Then** one generic message says
   that sign-in failed, without revealing whether the username exists. The username stays filled
   in, the password field is cleared, and the message is announced to screen readers.
6. **Given** repeated failed attempts, **When** the server refuses further attempts as too many
   requests, **Then** the message says when the user can try again, the sign-in action stays
   disabled until then, and its re-enabling is announced.
7. **Given** the second-factor step, **When** the user submits a wrong code, **Then** the app
   returns to the password step with the username kept and explains that the sign-in must be
   started again.
8. **Given** the second-factor step left open, **When** one minute of its time limit remains,
   **Then** the app warns the user. **When** the limit has passed, **Then** the app returns to
   the password step with the username kept and says that the sign-in timed out.
9. **Given** the second-factor step, **When** the user chooses "Cancel", **Then** the pending
   sign-in is cancelled and the sign-in screen is shown.
10. **Given** a Yubico OTP attempt while the Yubico verification service is unreachable,
    **When** the server reports a temporary verification failure, **Then** the app says so, keeps
    the second-factor step open and lets the user retry or choose another method.
11. **Given** an account whose only second factors are deprecated U2F entries, **When** the
    password step succeeds, **Then** the app tells the user to ask an administrator to reset their
    second factors.
12. **Given** a signed-in user, **When** they choose "Sign out", **Then** the session ends, the
    sign-in screen confirms the sign-out, and the browser's Back button does not reveal any
    content of the previous session.
13. **Given** the second-factor step, **When** the user reloads the page, **Then** the step is
    shown again with the same methods and the remaining time.
14. **Given** the role-neutral sign-in screen and an operator who has hidden the administrator
    login link, **When** the screen opens, **Then** it links to the domain-administrator and
    mailbox-user sign-in screens but not to the administrator one. **When** the visitor opens the
    administrator sign-in screen by its address, **Then** its heading names the role and its
    sign-ins name that role.
15. **Given** an operator who has enabled "force single sign-on", **When** the role-neutral
    sign-in screen opens, **Then** it shows passkey sign-in and a notice linking to the classic
    interface for single sign-on, but no password form. **When** the administrator sign-in screen
    opens, **Then** it shows the password form.
16. **Given** a server with an identity provider configured, **When** a screen with the password
    form opens, **Then** a hint says that accounts using the organisation's identity provider
    cannot use their password here yet and links to the classic interface.
17. **Given** a signed-in user who stays idle, **When** 2 minutes remain before the session would
    expire, **Then** a warning offers "Stay signed in" and "Sign out". **When** they choose "Stay
    signed in", **Then** the session continues. **When** they ignore the warning, **Then** the app
    shows the sign-in screen with an explanation, and after signing in again they return to the
    page they were on.

---

### User Story 2 - Sign in with a passkey (Priority: P1)

A mailbox user opens the app on an iPhone. Passkey sign-in is the first and most prominent
option. They tap it, confirm with Face ID and land on the home screen, without typing a username
or a password and without a second-factor step. The passkey may have been registered in the
legacy UI, which calls it "FIDO2" or "Touch ID", or in this app (User Story 4). On a device
without passkey support, the app simply shows the username and password form.

**Why this priority**: The project owner wants passkeys to be the primary way into the new app.
They are the fastest method and resist phishing, and most users already have a passkey-capable
device.

**Independent Test**: On a device or emulator with a virtual authenticator, sign in with a passkey
that the mock API accepts for each role, and confirm the landing. Repeat with a cancelled prompt,
a rejected assertion, throttling, a device without passkey support and an account with pending
actions.

**Acceptance Scenarios**:

1. **Given** a device that supports passkeys, **When** the sign-in screen opens, **Then**
   "Sign in with a passkey" is the first and most prominent action, and the username and password
   form is offered below it on the same screen.
2. **Given** a user with a passkey registered in the legacy UI, **When** they choose passkey
   sign-in and confirm on their device, **Then** they land on the home screen without entering a
   username, a password or a second factor.
3. **Given** a device without passkey support, **When** the sign-in screen opens, **Then** no
   passkey action is shown, the username and password form is the primary content and no error
   appears.
4. **Given** the device's passkey prompt, **When** the user cancels it, **Then** the app returns to
   the sign-in screen without an error message, and both options stay available.
5. **Given** a passkey that the server does not accept (unknown, deactivated, belonging to an
   inactive account or to another role than the one requested), **When** it is submitted,
   **Then** one generic message says that sign-in failed and suggests signing in with username
   and password.
6. **Given** repeated failed passkey attempts from the same address, **When** the server refuses
   further attempts as too many requests, **Then** the app handles it as in User Story 1,
   scenario 6.
7. **Given** an account that mailcow forces to change its password, **When** it signs in with a
   passkey, **Then** the app shows the pending-actions screen (User Story 5).
8. **Given** the role-specific sign-in screen for domain administrators, **When** a passkey of a
   mailbox user is used, **Then** sign-in fails with the generic message.
9. **Given** a browser that offers passkeys in autofill, **When** the user focuses the username
   field, **Then** their passkeys for this server appear among the suggestions, and choosing one
   signs them in. **When** the sign-in screen merely loads, **Then** no passkey prompt opens by
   itself.

---

### User Story 3 - Navigate the app according to role and permissions (Priority: P1)

A domain administrator signs in and sees only what a domain administrator may use: the home
screen, their domains, mailboxes, aliases and resources, quarantine, sync jobs if their
permission flags allow it, their account and their passkeys. Sections that later features will
deliver open a placeholder page that explains this, never a broken link. A mailbox user sees only
their own sections, gated by their permission flags. An administrator sees every section,
including API keys and the audit log. The home screen summarises who is signed in and what they
can reach.

**Why this priority**: The app cannot be used without a shell and navigation, and showing
sections a role may not use would confuse users and leak structure.

**Independent Test**: Sign in as each role with different permission flags from the mock API and
compare the visible navigation with the navigation catalogue (see Requirements). Open every entry
and confirm that it leads to a working screen or a placeholder. Open restricted addresses
directly and confirm the "no access" state.

**Acceptance Scenarios**:

1. **Given** a domain administrator whose sync jobs flag is off, **When** they open the
   navigation, **Then** it shows exactly the catalogue entries for domain administrators without
   sync jobs, and no API keys, audit log or system sections.
2. **Given** a mailbox user without the spam score and spam policy flags, **When** they open the
   navigation, **Then** the spam filter entry is not shown. **Given** either flag, **Then** it is
   shown.
3. **Given** any role, **When** they open an entry of a section that a later feature delivers,
   **Then** a placeholder names the section, says that it will come in a later version and links
   to the matching screen of the legacy UI.
4. **Given** a domain administrator, **When** they open the address of the API keys section
   directly, **Then** the app shows a "no access" state with a way back to the home screen and
   requests no key data.
5. **Given** a 360 px wide screen, **When** the user opens the navigation, **Then** it is reachable
   from one always-visible control, works by touch and keyboard, closes after a choice, and
   returns focus sensibly.
6. **Given** a domain administrator managing two domains, **When** the home screen opens, **Then**
   it lists those two domains. **Given** a domain administrator without domains, **Then** it says
   that no domains are assigned.
7. **Given** a domain administrator whose permission flags an administrator changes in the legacy
   UI, **When** the app next learns of the change (see FR-050), **Then** the navigation matches the
   new flags.
8. **Given** an active announcement, **When** any page of the app is shown, **Then** the
   announcement is visible and its type (information, warning, danger) is conveyed in text, not
   only by colour. The footer shows the operator's footer with any unsafe content removed.
9. **Given** a server with webmail and two operator app links configured, **When** a signed-in
   user opens the "Apps" menu in the header, **Then** it lists those links in the configured order
   under the operator's "Apps" text. **Given** a server whose groupware is disabled, **Then**
   webmail is not listed. **Given** no app links at all, **Then** no "Apps" menu is shown.

---

### User Story 4 - Register and manage own passkeys (Priority: P1)

A user who signed in with their password opens "Passkeys" from the user menu, or follows the
suggestion on the home screen. They add a passkey: they may give it a name, confirm with
fingerprint, face or device PIN, and see it in their list. Next time they sign in with it in one
step. They can rename a passkey and remove one they no longer use, including passkeys registered
in the legacy UI. Passkeys work in both UIs.

**Why this priority**: Most users have no passkey registered with mailcow yet. Without
registration in the app, the primary sign-in method of User Story 2 would reach only the few users
who registered one in the legacy UI.

**Independent Test**: As a user of each role, register a passkey with a virtual authenticator,
rename it, remove it, and confirm the list after each step. Repeat with a cancelled prompt, a
rejected registration and a device without passkey support.

**Acceptance Scenarios**:

1. **Given** a user without passkeys on a device that supports them, **When** they open
   "Passkeys", **Then** an empty state explains what a passkey is and offers "Add a passkey".
2. **Given** that screen, **When** they enter an optional name, start the registration and confirm
   on their device, **Then** the new passkey appears in the list with its name and registration
   date, and the success is announced.
3. **Given** a newly registered passkey, **When** the user signs out and chooses passkey sign-in,
   **Then** they are signed in with that passkey.
4. **Given** a passkey, **When** the user renames it, **Then** the list shows the new name. An empty
   name or a name longer than 255 characters is refused with a message on the field.
5. **Given** a passkey, **When** the user chooses "Remove", **Then** a confirmation names the
   passkey and says that it will no longer sign in, in either interface. **When** they confirm,
   **Then** it disappears from the list. Removing the last passkey is allowed, and the
   confirmation says that the password remains the way to sign in.
6. **Given** a passkey registered for another host name than the one serving the app, **When** the
   list is shown, **Then** that passkey is marked as working only on that host.
7. **Given** a passkey deactivated in mailcow, **When** the list is shown, **Then** it is marked as
   inactive and unusable for sign-in.
8. **Given** the device's registration prompt, **When** the user cancels it, **Then** nothing is
   registered and no error is shown.
9. **Given** a registration that the server rejects (for example because the authenticator already
   holds a passkey for this account, or because the registration took too long), **When** it
   fails, **Then** a translated message explains it and offers to try again.
10. **Given** a device without passkey support, **When** the user opens "Passkeys", **Then** adding
    is unavailable with an explanation, while renaming and removing still work.

---

### User Story 5 - Complete pending actions in a restricted session (Priority: P1)

mailcow can force an account to set up a second factor or to change its password. When such a
user signs in, the app shows a pending-actions screen instead of the home screen. For forced
second-factor setup, it offers to register a passkey right away; once registered, the
restriction lifts and the user continues to the home screen without signing in again. A forced
password change cannot be done in the app yet (feature 005): the app explains this, links to the
legacy UI, and lets the user check again after changing the password there. Sign-out is always
available.

**Why this priority**: Without this screen, restricted accounts would be stuck: every operation
other than reading the identity is refused by the server.

**Independent Test**: With the mock API, sign in as accounts with each pending action and with
both, and walk through each resolution path, including a device without passkey support.

**Acceptance Scenarios**:

1. **Given** an account forced to set up a second factor that has none, **When** it signs in,
   **Then** the pending-actions screen names the action and offers "Register a passkey".
   **When** the user registers one, **Then** the app continues to the home screen without a new
   sign-in.
2. **Given** an account forced to change its password, **When** it signs in, **Then** the screen
   explains that the password must be changed in the classic interface for now, links to it, and
   offers "Check again". **When** the user checks again after changing the password, **Then** the
   app continues to the home screen. **When** the password change is still pending, **Then** the
   screen stays and says so.
3. **Given** an account with both pending actions, **When** it signs in, **Then** the password
   change is listed first, and passkey registration is explained as available once the password
   has been changed.
4. **Given** forced second-factor setup on a device without passkey support, **When** the screen
   opens, **Then** it explains that a second factor can be set up in the classic interface and
   links to it.
5. **Given** a restricted session, **When** the user opens any other address of the app, **Then**
   the pending-actions screen is shown.
6. **Given** the pending-actions screen, **When** the user chooses "Sign out", **Then** the
   session ends as in User Story 1.

---

### User Story 6 - Choose language and theme (Priority: P2)

Any signed-in user switches the language between the languages the server enables (every language
mailcow ships; amended for constitution 1.3.0), and the theme between
light, dark and the device setting. The change applies at once and is saved to their profile, so
it follows them to other devices. Before sign-in, the app uses the browser's language.

**Why this priority**: Users can work without it, using the default language and the device's
theme, but the app serves Czech and Slovak operators and must honour personal preferences.

**Independent Test**: Change language and theme as a signed-in user, sign out, sign in on another
browser and confirm both were kept. Open the app signed out with browsers preferring each
language.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they switch to Czech, **Then** all app text, dates and
   numbers switch to Czech at once, and the choice is saved. **When** they later sign in on
   another device, **Then** the app is in Czech.
2. **Given** a signed-in user, **When** they choose the dark theme, **Then** it applies at once,
   including the operator's dark logo, and is saved.
3. **Given** the "device setting" theme, **When** the device switches between light and dark,
   **Then** the app follows without a reload.
4. **Given** a signed-out visitor whose browser prefers Slovak, **When** they open the app,
   **Then** the sign-in screen is in Slovak.
5. **Given** a browser that prefers a language the app does not offer, **When** the app opens
   signed out, **Then** it uses the server's default language if the app offers it, otherwise
   English.
6. **Given** a preference change, **When** saving it fails, **Then** the previous setting is
   restored and a translated message says that the change was not saved.
7. **Given** a server on which only one language is available to the app, **When** any screen is
   shown, **Then** no language choice is offered.
8. **Given** a user whose profile says English, **When** they switch to Slovak on the sign-in
   screen and then sign in, **Then** the app stays in Slovak and saves Slovak to the profile.
   **When** they sign in on another visit without choosing on the sign-in screen, **Then** the
   profile language applies.
9. **Given** a user who used the app in Czech and signed out, **When** they open the sign-in
   screen again on the same device, **Then** it is in Czech, whatever the browser prefers.

---

### User Story 7 - Manage API keys (Priority: P2)

An administrator creates an API key for a billing system on a phone or a desktop. They name it,
choose its owner (an administrator, or a domain administrator such as a reseller), choose
read-only or read-write access, and optionally set an expiry and the networks it may be used
from. The secret is shown once, with a copy button and a clear warning. Later they look up when
and from where the key was last used, and revoke it when the contract with the billing system
ends. Revoked keys stay in the list with their revocation details.

**Why this priority**: Automation clients need keys, but people can use the app without them. The
legacy UI keeps managing its own `/api/v1` keys.

**Independent Test**: As an administrator, list, filter, create, inspect and revoke keys against
the mock API on both viewports, including every validation error and an empty list. As a domain
administrator and a mailbox user, confirm that the section is absent and its address shows "no
access".

**Acceptance Scenarios**:

1. **Given** an administrator on a 360 px screen, **When** they open "API keys", **Then** each key
   is shown as a card with its name, non-secret prefix, owner, access level, status, expiry and
   last use. On a wide screen the list may be a table.
2. **Given** the create form, **When** the administrator submits a name, an owner, an access level
   and optionally an expiry and allowed networks, **Then** the secret is shown once with a copy
   button. After that view is closed, the secret is never shown again anywhere in the app, and the
   list shows the new key with its prefix.
3. **Given** the create form, **When** the expiry lies in the past, a network entry is malformed,
   or the chosen owner is no longer eligible (deactivated in the meantime), **Then** a translated
   message appears on the matching field or network entry, and nothing is created.
4. **Given** a key, **When** the administrator opens it, **Then** they see its name, prefix,
   owner, access level, allowed networks, expiry, status, creation time and creator, last use time
   and address, and, if revoked, the revocation time and the administrator who revoked it.
5. **Given** an active key, **When** the administrator chooses "Revoke", **Then** a confirmation
   names the key and says that clients using it stop working immediately and that this cannot be
   undone. **When** they confirm, **Then** the key shows as revoked with its revocation details
   and stays listed.
6. **Given** many keys, **When** the administrator filters by status, access level or owner, sorts
   or pages through them, **Then** the list shows the matching keys, and a reload keeps the
   filters, sort and page.
7. **Given** a key whose owner has been deactivated or deleted, **When** it is listed, **Then** it
   is flagged as unusable because of its owner.
8. **Given** no keys, **When** the section opens, **Then** an empty state explains what API keys
   are for and offers to create one.
9. **Given** a domain administrator or a mailbox user, **When** they look for API keys, **Then**
   the section is not in the navigation, and its address shows the "no access" state.
10. **Given** the create form, **When** it opens, **Then** read-only access and "never expires" are
    preselected, and the owner picker holds the signed-in administrator.
11. **Given** the dialog with a new secret, **When** the administrator closes it without using the
    copy button, **Then** the app asks them to confirm that they have saved the secret. **When**
    they then use the browser's Back button, **Then** the secret is not shown again.
12. **Given** the owner picker, **When** the administrator types part of a username, **Then** it
    lists the matching active administrators and domain administrators with their roles, loads
    more on request, and says so when nothing matches. Mailbox users are never offered.

---

### User Story 8 - Review the authentication audit log (Priority: P3)

An administrator investigating a suspicious sign-in opens the audit log, filters by time range,
event type, outcome, user and client address, and reads who did what, when, from where, how they
authenticated and why an attempt failed.

**Why this priority**: It supports security operations, but users can sign in and work without
it.

**Independent Test**: With audit records of every event type and outcome in the mock API, apply
each filter alone and combined on both viewports, and confirm the shown entries, the empty state
and the persistence of filters across reloads.

**Acceptance Scenarios**:

1. **Given** a failed sign-in for "alice@example.org" from 192.0.2.10, **When** the administrator
   filters failed sign-ins from that address, **Then** the entry shows the attempted username, the
   time in their locale, the address and a translated failure reason.
2. **Given** key creations and revocations, **When** the administrator filters by those event
   types, **Then** each entry shows the acting administrator, the key and the time.
3. **Given** a record with an event type or failure reason that this app version does not know,
   **When** it is listed, **Then** it is shown with a generic label and its code, not hidden.
4. **Given** filters that match nothing, **When** they are applied, **Then** an empty state offers
   to clear the filters.
5. **Given** applied filters, **When** the page is reloaded or its address is shared with another
   administrator, **Then** the same filters apply.
6. **Given** a malformed client address or a time range whose start is after its end, **When** the
   administrator applies it, **Then** a message appears on the matching filter field.
7. **Given** a domain administrator or a mailbox user, **When** they open the audit log address,
   **Then** the "no access" state is shown.

---

### Edge Cases

- **Public configuration unavailable**: the sign-in screen falls back to neutral built-in
  defaults (FR-003) and sign-in still works.
- **Operator logo fails to load**: the product name is shown in its place.
- **Operator help text or footer containing scripts, styles, event handlers, embedded frames,
  forms or images from other sites**: these are removed. Safe formatting and safe links remain.
- **Very long product names, usernames, key names (255 characters), user agents or network
  lists**: they wrap or truncate with the full value available, without horizontal scrolling at
  360 px.
- **Device without passkey support**: passkey actions are hidden or explained (FR-010, FR-056) and
  username and password work as usual.
- **Passkey created for another host name**: the server rejects the assertion with the generic
  error. The passkeys list marks such passkeys (FR-052).
- **Passkey prompt shows no passkey for this server**: the user cancels and continues with
  username and password.
- **"Force single sign-on" on a device without passkey support**: the role-neutral screen shows
  only the single sign-on notice and the links to the role-specific screens that the operator has
  not hidden.
- **Server languages without any translation in the app** (for example only German enabled): the
  app is in English, offers no language choice and does not save a language (FR-060).
- **Session warning while another tab of the app is in use**: activity in any tab counts, so the
  warning does not appear while the user works in another tab (FR-032).
- **Account whose only second factor is Yubico OTP (an advanced method)**: it is shown directly,
  because hiding the only method behind "Other methods" would make no sense.
- **Second factor deactivated in the legacy UI between the password step and the second-factor
  step**: the server cancels the pending sign-in, and the app returns to the password step.
- **Throttling during passkey sign-in**: handled like throttling of password sign-in.
- **Slow sign-in response because the server deliberately delays failed attempts**: the app keeps
  its busy state and does not report a timeout while waiting.
- **Reload during the second-factor step or on the pending-actions screen**: the app resumes the
  same step from the session state.
- **Both pending actions at once**: password change first, passkey registration after it
  (FR-041).
- **Language or theme change in a restricted session**: the server refuses to save preferences
  until the restriction is lifted, so the change applies on this device only.
- **Profile language no longer enabled on the server**: the server reports its default language
  instead, and the app uses that.
- **Domain administrator without domains**: the home screen says that no domains are assigned.
- **Permission flags or domains changed elsewhere while signed in**: the next "no permission"
  response refreshes the identity and the navigation (FR-045, FR-050).
- **Account deactivated while signed in**: the next request reports an ended session, and the app
  shows the sign-in screen (FR-034).
- **Sign-out or sign-in as another user in a second tab of the same browser**: the first tab
  discards the previous account's data at the latest on its next request (FR-037).
- **Deep link opened while signed out**: the app asks the user to sign in and then opens the
  requested page, provided it is an address of the app (FR-031, FR-092).
- **Deep link to a section the role may not use**: the "no access" state is shown after sign-in.
- **Network loss or offline device**: actions fail with a translated message and a way to retry.
  Nothing is reported as saved that was not saved.
- **API not ready (service unavailable)**: a full-page message says that the service is
  temporarily unavailable and offers to retry.
- **Clipboard access refused when copying the API key secret**: the secret is selected for manual
  copying and the user is told to copy it themselves.
- **Key owner deactivated between choosing it and creating the key**: the server's validation
  message appears on the owner field (FR-065).
- **No app links configured, or all hidden on the login page**: the sign-in screens show no
  "Apps" section, and the header shows no "Apps" menu when there are no links at all (FR-001a).
- **API key revoked by another administrator while it is on screen**: revoking again succeeds and
  changes nothing. The view then shows the current state.
- **Item changed elsewhere before a rename, revocation or preference change**: the app reports the
  conflict, reloads the current state and lets the user try again.
- **Audit records of event types added by later features**: shown with a generic label and their
  code (FR-074).
- **Persistent browser storage disabled or cleared**: the app works. Only device-level
  conveniences (FR-047, FR-061) are not remembered.

## Requirements *(mandatory)*

### Functional Requirements

#### Sign-in screen and branding

- **FR-001**: Before sign-in, the app MUST load the server's public configuration and show the
  operator's logo for the active theme, the product name, the announcement when it is active and
  has text, the login help text, the app links (FR-001a) and the footer. The browser page title
  MUST use the configured page title.
- **FR-001a**: The app links of the public configuration (webmail and the operator's links) MUST
  be shown in their configured order under the operator's "Apps" text, on the sign-in screens and
  in the signed-in header (FR-042), as legacy does. Where the configuration hides a link on the
  login page, the sign-in screens MUST NOT show it. Where a link has a form for signed-in users,
  the header MUST use that form, as legacy does. The "Apps" text and the link names are plain
  text. When there are no app links, neither the section nor the menu may be shown.
- **FR-002**: The help text and the footer contain operator-authored HTML and MUST be sanitised
  before display. Paragraphs, line breaks, emphasis, headings, lists and links with `http`,
  `https` or `mailto` targets MUST be kept. Everything else MUST be removed, including scripts,
  styles, event handlers, embedded frames, forms and images from other hosts. The product name,
  page title and announcement are plain text and MUST be shown as text, never interpreted as
  markup.
- **FR-003**: If the public configuration cannot be loaded, sign-in MUST still work with neutral
  built-in defaults: the server's host name as the product name, no logo, no help text, footer,
  announcement or app links, the languages of mailcow's default language menu (amended for
  constitution 1.3.0), and no login page options.
  No product or operator name may be built into the app (constitution IV).
- **FR-004**: Until the API offers branding colours (feature 013), the app MUST use its default
  theme colours in both themes.
- **FR-005**: The app MUST provide one role-neutral sign-in screen, on which the server resolves
  the account type in mailcow's order (administrator, domain administrator, mailbox user), and one
  role-specific sign-in screen each for administrators, domain administrators and mailbox users,
  each reachable by its own address. A role-specific screen MUST name its role in its heading and
  in every sign-in it sends (FR-011, FR-019).
- **FR-006**: Every sign-in screen MUST link ("Not the correct login?") to the role-specific
  screens other than itself, except those whose login link the operator has hidden. Each
  role-specific screen MUST also link back to the role-neutral screen.
- **FR-007**: When the operator has enabled "force single sign-on", the role-neutral and
  mailbox-user sign-in screens MUST NOT show the password form or the "Forgot password?" link.
  They MUST keep passkey sign-in and show a notice that single sign-on is available in the classic
  interface, with a link to its sign-in page. The administrator and domain-administrator screens
  MUST keep the password form, as in legacy.
- **FR-008**: When the public configuration says that an external identity provider is
  configured, the sign-in screens that show the password form MUST show a hint that accounts which
  sign in through the organisation's identity provider cannot use their password here yet, with a
  link to the sign-in page of the classic interface. The hint MUST be shown up front, not in
  reaction to a failed sign-in, so that it reveals nothing about an account.
- **FR-009**: The role-neutral and mailbox-user sign-in screens MUST link to the password reset
  page of the classic interface ("Forgot password?") until feature 005 brings password reset to
  the app, unless FR-007 applies.

#### Passkey sign-in

- **FR-010**: When the device supports passkeys, passkey sign-in MUST be the first and most
  prominent sign-in action, and username and password MUST be offered on the same screen without
  further navigation. When the device does not support passkeys, the passkey action MUST NOT be
  shown, the password form MUST be the primary content, and no error may be shown.
- **FR-011**: Passkey sign-in MUST need no username or password: the app requests a challenge,
  lets the device verify the user, and submits the result. On a role-specific sign-in screen, the
  sign-in MUST name that role.
- **FR-012**: Where the browser supports it, the app MUST also offer the user's passkeys among the
  autofill suggestions of the username field, in addition to the passkey sign-in action, which
  stays first. The app MUST NOT open a passkey prompt by itself when a screen loads.
- **FR-013**: When the user cancels the device prompt or it times out, the app MUST return to the
  sign-in screen without an error message, and both sign-in options MUST remain available.
- **FR-014**: A rejected passkey sign-in MUST show one generic message that suggests username and
  password, and MUST NOT reveal why it was rejected.
- **FR-015**: The app MUST call these credentials "passkeys" everywhere, including credentials
  registered in the legacy UI as "FIDO2" or "Touch ID on Apple M1". The legacy names MUST NOT
  appear in the app.

#### Password sign-in

- **FR-016**: The password form MUST have labelled username and password fields that password
  managers recognise, allow pasting, and do not auto-capitalise or auto-correct the username. A
  control to show or hide the password MUST be operable by keyboard and labelled for screen
  readers.
- **FR-017**: While a sign-in request is in progress, the app MUST show a busy state, prevent a
  second submission and announce the progress. A response that the server deliberately delays
  after failed attempts MUST NOT be treated as a failure or timeout.
- **FR-018**: After a failed sign-in, the app MUST show one generic message, keep the username,
  clear the password and move focus to the message or the password field.
- **FR-019**: On a role-specific sign-in screen, the password sign-in MUST name that role.

#### Second-factor step

- **FR-020**: When the password is correct and the account needs a second factor, the app MUST
  show the second-factor step as its own screen. It MUST list the methods in the order the server
  returns them: WebAuthn security keys and passkeys first, TOTP second. Methods the server marks
  as advanced (Yubico OTP) MUST be offered behind an "Other methods" control, unless no primary
  method exists, in which case they MUST be shown directly.
- **FR-021**: For WebAuthn, one action MUST start the device verification. The app requests a
  challenge for the pending sign-in and submits the result. If the user cancels the device prompt,
  the step stays open and they can retry or choose another method.
- **FR-022**: For TOTP, the user MUST choose the authenticator by its display name when the account
  has more than one. A single authenticator MUST be preselected. The code field MUST bring up a
  numeric keyboard on phones, accept one-time-code autofill, and check that the code is exactly six
  digits before submitting, so that a typing slip in its length does not cancel the sign-in.
- **FR-023**: For Yubico OTP, a single field MUST accept the key's output and check that it is
  44 letters or digits before submitting.
- **FR-024**: When the server rejects the second factor, which cancels the pending sign-in, the app
  MUST return to the password step with the username kept and explain that the code was not
  accepted and the sign-in must be started again.
- **FR-025**: The step MUST tell the user its time limit, warn them when one minute remains, and,
  when the limit has passed, return to the password step with the username kept and a message that
  the sign-in timed out.
- **FR-026**: A "Cancel" action MUST cancel the pending sign-in on the server and return to the
  sign-in screen.
- **FR-027**: When the server reports a temporary verification failure (Yubico service
  unreachable), the app MUST say so, keep the step open, and let the user retry or choose another
  method.
- **FR-028**: When the server reports that the account's second factors cannot be used (only
  deprecated U2F entries), the app MUST tell the user to ask an administrator to reset their
  second factors, and return to the sign-in screen.
- **FR-029**: After a reload during the second-factor step, the app MUST resume the step with the
  same methods and the remaining time.

#### Landing, session lifecycle and sign-out

- **FR-030**: On start and after every sign-in, the app MUST read the session state and show the
  matching screen: sign-in when nobody is signed in, the second-factor step when a sign-in awaits
  a second factor, the pending-actions screen when the session is restricted, and the app when the
  session is fully signed in.
- **FR-031**: After sign-in, the app MUST open the page the user requested before signing in,
  provided it is an address of the app; otherwise the home screen. It MUST NOT reproduce the
  legacy redirects to the dashboard, the mailbox list or webmail.
- **FR-032**: The app MUST warn the user 2 minutes before the idle session would expire, based on
  the server's idle lifetime and the time of the app's last request in any of its open tabs. The
  warning MUST be announced to screen readers and offer "Stay signed in", which keeps the session
  alive with a single action, and "Sign out".
- **FR-033**: The app MUST NOT send automatic requests while the user is idle that would keep the
  session alive. Only user actions, including "Stay signed in", may extend it.
- **FR-034**: When a request reports that the session is no longer valid, the app MUST discard the
  displayed account data, show the sign-in screen with a translated message that the session has
  ended, and return to the same page after the next sign-in.
- **FR-035**: When a write is refused because of an anti-forgery check, the app MUST obtain a fresh
  token and re-read the identity. It MUST retry once without user action only when the identity
  key (`username|role|impersonation.id`) matches the account that prepared the write. A changed
  key discards the write and switches identity (UI 007 research R4/R5); a second token refusal
  or an unauthenticated identity read ends the session (FR-034).
- **FR-036**: Every signed-in screen, including the pending-actions screen, MUST offer "Sign out".
  It MUST end the server session without asking for confirmation, discard all account data held by
  the app, and show the sign-in screen with a confirmation. The browser's Back button MUST NOT
  reveal content of the ended session. If the server cannot be reached, the app MUST say that the
  sign-out could not be confirmed and offer to retry, and MUST NOT claim a sign-out that did not
  happen.
- **FR-037**: When the app learns that its session has ended or now belongs to another account,
  for example after a sign-out or a new sign-in in another tab, it MUST discard the previous
  account's data and show the state of the current session, at the latest on its next request.
  Account changes compare `username|role|impersonation.id`; restarting acting as the same
  username is a change too (UI 007 research R4). The old page unmounts before its cache clears.

#### Restricted sessions

- **FR-038**: In a restricted session, the app MUST show a pending-actions screen that lists each
  pending action in plain language. That screen MUST offer only the resolution of the actions,
  language and theme choice (applied on the device only, because the server does not save
  preferences in a restricted session) and "Sign out". Any other address of the app MUST show this
  screen.
- **FR-039**: When second-factor setup is the only pending action, the screen MUST offer to
  register a passkey, with the same steps as FR-053. After a successful registration, the app MUST
  re-read the identity and continue as after sign-in (FR-031), without a new sign-in. On a device
  without passkey support, it MUST instead explain that a second factor can be set up in the
  classic interface and link to it.
- **FR-040**: When a password change is pending, the screen MUST explain that the password cannot
  be changed in this app yet, link to the sign-in page of the classic interface for the user's
  role, and offer "Check again", which re-reads the identity and continues once the action is
  gone.
- **FR-041**: When both actions are pending, the password change MUST be listed first, and passkey
  registration MUST be shown as available once the password has been changed, because the server
  refuses passkey registration while a password change is pending.

#### Application shell and navigation

- **FR-042**: Signed-in screens MUST share a shell with:
  - a header with the operator's logo for the active theme, a control for the navigation, an
    "Apps" menu with the app links when there are any (FR-001a), and a user menu with the
    username, the role, language and theme choice, "Passkeys" and "Sign out";
  - the main content;
  - the operator's footer (FR-002);
  - a skip link to the main content.
- **FR-043**: The navigation MUST show each entry of the navigation catalogue below only to the
  roles it lists and, where a permission flag is listed, only when the identity reports that flag
  as granted. Later feature specifications refine their own entries.
- **FR-044**: An entry whose section a later feature delivers MUST open a placeholder page inside
  the app. It MUST name the section, say that the section will come in a later version of the app,
  and link to the matching screen of the classic interface (see the catalogue), noting that the
  classic interface needs its own sign-in. A placeholder MUST NOT request any data.
- **FR-045**: Hiding an entry is a convenience, not access control. Opening the address of a
  section the role may not use MUST show a "no access" state with a way to the home screen, and
  MUST NOT request the section's data. When the server refuses an operation as not permitted, the
  app MUST show a translated "no permission" message in context and refresh the identity, so that
  the navigation matches the current permissions.
- **FR-046**: On narrow screens, one always-visible control MUST open the navigation. The open
  navigation MUST NOT cause horizontal scrolling, MUST close after a choice and with the Escape
  key, and MUST return focus to its control. On wide screens, the navigation MAY stay visible.
- **FR-047**: The home screen MUST show:
  - a greeting with the username and the role;
  - the scope: all domains for an administrator, the managed domains for a domain administrator
    (or a statement that none are assigned), the mailbox address for a mailbox user;
  - shortcuts to the sections visible to the role;
  - when the user has no passkey and the device supports passkeys, a suggestion to add one, which
    the user can dismiss on this device.
- **FR-048**: When the announcement is active and has text, it MUST appear on the sign-in screen
  and on every signed-in page. Its type (information, warning, danger) MUST be conveyed in text or
  by an icon with a text alternative, not only by colour. The user MUST be able to collapse it for
  the rest of the visit.
- **FR-049**: The browser page title MUST name the current page followed by the configured page
  title.
- **FR-050**: The app MUST refresh the identity on start, after each sign-in, after every "no
  permission" or "pending action" response, and when the user opens a section while the identity
  it holds is older than five minutes.

**Navigation catalogue** (✓ = shown; a flag means "shown only when the identity grants it"):

| Section | Admin | Domain admin | Mailbox user | Delivered by | Legacy screen linked from the placeholder |
|---|---|---|---|---|---|
| Home | ✓ | ✓ | ✓ | 001 | — |
| Domains | ✓ | ✓ | — | 002 | Mail setup › Domains |
| Mailboxes | ✓ | ✓ | — | 003 | Mail setup › Mailboxes |
| Aliases, alias domains and resources | ✓ | ✓ | — | 004 | Mail setup › Aliases, Alias domains, Resources |
| My account (password, second factors, app passwords, temporary aliases, settings) | ✓ | ✓ | ✓ | 005 | Own account and second factors (admin), User settings (domain admin, mailbox user) |
| Passkeys | ✓ | ✓ | ✓ | 001 | — |
| Quarantine | ✓ | ✓ | ✓ | 006 | Quarantine |
| Spam filter | — | — | spam score or spam policy | 006 | User settings › Spam filter |
| Domain administrators | ✓ | — | — | 007 | System › Configuration › Access |
| Administrators | ✓ | — | — | 007 | System › Configuration › Access |
| Sync jobs | ✓ | sync jobs | sync jobs | 008 | Mail setup › Sync jobs, User settings › Sync jobs |
| Routing and address rewriting | ✓ | BCC maps | — | 009 | System › Configuration › Routing, Mail setup › Address rewriting |
| DKIM, MTA-STS and DNS | ✓ | ✓ | — | 010 | System › Configuration › ARC/DKIM keys, DNS diagnostics |
| Monitoring and operations (dashboard, logs, mail queue, fail2ban) | ✓ | — | — | 011 | System › Information, E-Mail › Queue |
| Identity providers and OAuth2 | ✓ | — | — | 012 | System › Configuration › Identity provider, OAuth2 |
| System settings | ✓ | — | — | 013 | System › Configuration › Options |
| API keys | ✓ | — | — | 001 | — |
| Audit log | ✓ | — | — | 001 | — |

#### Passkey management

- **FR-051**: Every signed-in user MUST reach a "Passkeys" page from the user menu and from the
  home screen suggestion (FR-047).
- **FR-052**: The list MUST show, for each of the user's passkeys:
  - its display name, or else its authenticator description, or else "Unknown passkey" with the
    registration date, as legacy does;
  - the authenticator description and the registration date in the user's locale;
  - a note when it is bound to another host name than the one serving the app, naming that host;
  - a note when it is inactive and cannot be used for sign-in.

  The newest passkey MUST come first.
- **FR-053**: "Add a passkey" MUST let the user enter an optional name (1 to 255 characters),
  start the registration, and confirm on the device. On success, the list MUST update and the
  success MUST be announced. A cancelled prompt MUST register nothing and show no error. A
  rejected registration MUST show a translated message and offer to try again.
- **FR-054**: "Rename" MUST accept a name of 1 to 255 characters and show validation messages on
  the field.
- **FR-055**: "Remove" MUST ask for confirmation, naming the passkey and stating that it will no
  longer sign in, in either interface. For the last passkey, the confirmation MUST also say that
  the password remains the way to sign in.
- **FR-056**: On a device without passkey support, adding MUST be unavailable with an explanation,
  while renaming and removing stay available.
- **FR-057**: The app MUST offer no way to see or change another account's passkeys.

#### Language and theme

- **FR-058**: The user menu and the sign-in screen MUST offer the language and the theme (light,
  dark or device setting).
- **FR-059**: A change MUST apply at once to all text, the document language, date and number
  formats, the theme and the logo, and MUST be saved to the user's profile when signed in. If
  saving fails, the previous setting MUST be restored and a translated message shown.
- **FR-060**: The app MUST offer the languages that are both enabled on the server and shipped by
  mailcow (its 33 `lang.<code>.json` files; amended for constitution 1.3.0), in the server's order
  and with the names of the server's language menu. When only one language is available, no
  language choice may be shown. When none of the server's enabled languages is one of them, the
  app MUST use English, offer no language choice and save no language to the profile.
- **FR-061**: Before sign-in, the app MUST use the language and theme last applied on this device.
  Without them, it MUST use the browser's preferred language when the app offers it, otherwise the
  server's default language when the app offers it, otherwise English, and the device's theme
  setting. After sign-in, the profile preferences MUST apply, except that a language or theme the
  user chose on the sign-in screen during this visit MUST be kept and saved to the profile. The
  language and theme last applied MUST be remembered on the device.
- **FR-062**: The "device setting" theme MUST follow changes of the device setting without a
  reload.

#### API keys

- **FR-063**: The API keys section MUST be available to administrators only (FR-043, FR-045).
- **FR-064**: The list MUST show each key's name, non-secret prefix, owner (username and role,
  with a warning when the owner is inactive or deleted), access level, status (active, expired or
  revoked), expiry and last use (time and address, or "never"). It MUST offer filters by owner,
  status and access level, sorting by creation time (newest first by default), name,
  expiry and last use, and pages with the total count. The owner filter MUST offer the owner
  picker of FR-065 and also accept a typed username, so that keys of inactive or deleted owners
  can still be found. Filters, sort and page MUST be kept in the page address. On narrow screens
  keys MUST be shown as cards.
- **FR-065**: The create form MUST ask for:
  - a name (required, up to 255 characters);
  - an owner, chosen with a searchable picker of the key-owner candidates that the API offers
    (active administrators and domain administrators), prefilled with the signed-in
    administrator. The picker MUST search by username, show each candidate's username and role,
    load further results page by page, and have loading, no-match and error states. If the chosen
    owner stops being eligible before the key is created, the server's validation message MUST
    appear on the owner field;
  - an access level: read-only (preselected) or read-write;
  - an expiry: never (preselected), 30, 90 or 365 days from now, or a specific date and time in
    the user's local time zone, which must lie in the future;
  - optional allowed networks, up to 100 entries, each an IPv4 or IPv6 address or prefix. No
    entries means any address.

  The app MUST check the format of each network entry before submitting and show any server
  validation error on the matching field or entry. The form MUST explain that a key owned by a
  domain administrator is limited to that administrator's domains and permissions, and that a
  read-only key cannot change anything.
- **FR-066**: After creation, the app MUST show the secret once, in a dialog with the full secret,
  a copy button and a warning that it cannot be shown again. If the user closes the dialog without
  having copied the secret, the app MUST ask for confirmation first. The secret MUST exist only
  while the dialog is open: it MUST NOT be written to device storage or to a page address, and it
  MUST NOT come back through the browser's Back or Forward buttons.
- **FR-067**: Opening a key MUST show every attribute listed in User Story 7, scenario 4. The
  detail view MUST state that keys cannot be edited and that a change means creating a new key and
  revoking the old one.
- **FR-068**: "Revoke" MUST ask for confirmation, naming the key and stating that clients using it
  stop working immediately and that revocation cannot be undone. Afterwards the key MUST show as
  revoked with the revocation time and the administrator who revoked it, and MUST stay listed.
- **FR-069**: The API keys section MUST link to the API documentation.
- **FR-070**: The app MUST NOT authenticate with API keys itself.

#### Audit log

- **FR-071**: The audit log MUST be available to administrators only (FR-043, FR-045).
- **FR-072**: The list MUST show records newest first, 25 per page by default (page sizes 25, 50
  and 100, as `docs/conventions.md` sets for every list), with the total count. Each
  record MUST show the time, the event type, the outcome (in text, not only colour), the actor
  (username and role, the key identifier, or the attempted username of a failed sign-in), the
  client address, the authentication method and, for failures, the reason. The target, the user
  agent, the request identifier and the other non-secret details MUST be available when the
  record is expanded.
- **FR-073**: The app MUST offer filters by time range (last 24 hours, 7 days, 30 days, or a
  custom start and end), event types (several at once), outcome, actor (username or key
  identifier) and client address (an address or a prefix). It MUST check that the start lies
  before the end and that the address is well-formed before applying them. Active filters MUST be
  visible and removable one by one and all at once. Filters and page MUST be kept in the page
  address.
- **FR-074**: Records of event types, failure reasons or authentication methods that this app
  version does not know MUST be shown with a generic translated label and their code.

#### Errors and messages

- **FR-075**: Every error MUST be shown as a translated message chosen by its stable problem type,
  as listed in the error handling table below. The English titles and details from the API MUST
  NOT be shown as the message.
- **FR-076**: A validation error MUST be shown on the matching field, built from the rule code and
  its parameters (for example a maximum length) in the user's language. Unknown rule codes MUST be
  shown as a generic "invalid value" message. When a form has more than one error, a summary at the
  top MUST link to each field.
- **FR-077**: An unknown problem type, a server error or a network failure MUST show a translated
  generic message with a way to retry and, when available, the request identifier for support.
- **FR-078**: Every error and status message MUST be announced to screen readers.

**Error handling** (problem types of API feature 001 and the app's response):

| Outcome reported by the API | App behaviour |
|---|---|
| Sign-in failed | One generic message (FR-018). After a passkey attempt, suggest username and password (FR-014). |
| Pending sign-in or passkey challenge expired | "Sign-in timed out", back to the password step with the username kept (FR-025). |
| Second factor required | Show or resume the second-factor step (FR-029). |
| Second factor failed | Back to the password step with the username kept (FR-024). |
| Second factor unavailable | Ask an administrator to reset second factors (FR-028). |
| Temporary verification failure | Keep the step open, retry or choose another method (FR-027). |
| Too many requests | Say when to retry, using the server's retry hint; disable the action until then; announce re-enabling. |
| Unauthenticated | Session ended (FR-034). |
| Anti-forgery check failed | Refresh the token and re-read identity; retry once only for the same identity key (FR-035, UI 007 R5). |
| Pending action required | Show the pending-actions screen (FR-038). |
| Forbidden | "No permission" in context and identity refresh (FR-045). |
| Passkey registration failed | Explain and offer to try again (FR-053). |
| Validation failed | Field messages and summary (FR-076). |
| Not found | "Not found" state with a way back. |
| Changed elsewhere (precondition failed) | Say that the item changed elsewhere, reload it, let the user retry. |
| Service unavailable | "Service temporarily unavailable" with retry. |
| Session required, API key outcomes, any other type | Not expected from the app's own use; generic message (FR-077). |

#### Accessibility, mobile and translations

- **FR-079**: Every screen and state of this feature MUST meet WCAG 2.2 level AA in both themes, at
  360 px and on a desktop viewport. Automated accessibility checks MUST report no violations.
- **FR-080**: Everything MUST be operable by keyboard alone, with visible focus and a logical
  focus order. When the screen or step changes, focus MUST move to its heading or first field.
  Dialogs MUST keep focus inside while open, return it when closed, and close with the Escape key;
  when closing would lose unsaved input or the API key secret, the Escape key MUST ask for
  confirmation first (FR-066). Sticky elements MUST NOT hide the focused element.
- **FR-081**: Sign-in MUST NOT require any cognitive test. Pasting and password managers MUST work
  in every username, password and code field (WCAG 2.2 "Accessible Authentication").
- **FR-082**: Progress, success, copy and save confirmations and countdown milestones MUST be
  announced to screen readers without moving focus.
- **FR-083**: No screen may need horizontal scrolling at 360 px, at 320 px, or at 400 % zoom on a
  desktop. Touch targets MUST be at least 44 × 44 CSS px. Pinch-zoom MUST NOT be disabled. Screens
  MUST work in portrait and landscape. Dialogs MUST fit small screens, and long forms MUST be split
  into sections.
- **FR-084**: Status, outcome and announcement types MUST NOT be conveyed by colour alone.
- **FR-085**: Animations MUST respect the device's reduced-motion setting.
- **FR-086** (amended for constitution 1.3.0): All app text MUST come from translations. Every
  element with a classic-interface counterpart MUST show mailcow's own text, verbatim, loaded at
  runtime from the installation's `/lang/lang.<code>.json` merged over its `lang.en-gb.json` (a
  missing key shows English, as in the classic interface), with the bundled upstream en-gb snapshot
  used only when `/lang/` cannot be loaded. Legacy values MUST NOT be changed: only `%s`, `%d` and
  the DataTables placeholders are filled, and markup is rendered through the sanitiser. Elements
  the classic interface lacks MUST use new strings in English, Czech and Slovak; other languages
  show their English text. Passkey texts are new strings (owner decision). Operator texts (product
  name, help text, footer, announcement, "Apps" text and app link names) MUST be shown as
  authored. Each screen follows the legacy form map in the plan.
- **FR-087**: Dates, times and numbers MUST be formatted for the user's language and shown in the
  device's time zone. A relative time ("5 minutes ago") MUST make the absolute time available.
- **FR-088**: The document language MUST match the language in use.
- **FR-089**: Every screen and every collection MUST have defined loading, empty and error
  states.
- **FR-090**: User-facing text MUST call the legacy mailcow UI "the classic interface" and MUST
  NOT use the word "legacy".

#### Security in the browser

- **FR-091**: Passwords, one-time codes, API key secrets and session tokens MUST NOT be written to
  device storage or to page addresses. Password and code fields MUST be cleared after each
  attempt. The app MUST NOT remember usernames itself.
- **FR-092**: The page opened after sign-in (FR-031) MUST be an address of the app. Any other
  return address MUST be ignored.
- **FR-093**: The app MUST use only operations of the mailcow-rest-v2 contract. The legacy UI MAY
  only be a link target.

### Legacy Parity

Reference: the FeldHost fork at `../mailhosting/data/web/` (upstream baseline `2026-09a`):
`templates/{user_index,admin_index,domainadmin_index,base}.twig`, `templates/modals/footer.twig`,
`templates/fido2.twig`, `templates/admin/tab-config-admins.twig`,
`templates/user/tab-user-auth.twig`, `templates/domainadmin.twig`, `js/build/013-mailcow.js` and
`lang/lang.*.json` (all 33, loaded from the installation at runtime; constitution 1.3.0).

| Legacy screen or element | New app | Status | Requirements |
|---|---|---|---|
| Three login pages (mailbox user at `/`, administrator at `/admin`, domain administrator at `/domainadmin`), each fixing the role | Role-neutral sign-in plus role-specific sign-in | Improved | FR-005, FR-011, FR-019 |
| Role title in the login card header (`login.login_user`, `login_admin`, `login_dadmin`) | Heading of the role-specific sign-in | Matched | FR-005 |
| "Not the correct login?" links, hidden by the login page options | Links to role-specific sign-in, same options | Matched | FR-006 |
| Dark-mode switch on the login page and in the header (light or dark, kept in browser storage) | Light, dark or device setting, saved to the profile | Improved | FR-058 to FR-062 |
| Language drop-down with flag icons (cookie per browser) | Language choice by the menu's names, every mailcow language the server enables, saved to the profile | Improved: flags are not languages and are not accessible | FR-058 to FR-061 |
| Texts of every screen in the user's language (`lang.<code>.json` over `lang.en-gb.json`) | mailcow's own texts, verbatim, from the installation's `/lang/` at runtime | Matched (constitution 1.3.0) | FR-086 |
| Light and dark logo | Same, from the public configuration | Matched | FR-001 |
| Announcement on the login page and on signed-in pages | Same, plain text, type not by colour only | Matched | FR-048 |
| Product name (`main_name`) as the login legend, website title | Same | Matched | FR-001, FR-049 |
| Username and password form with show-password button | Same, password-manager friendly, accessible toggle | Matched | FR-016 |
| "Forgot password?" link (mailbox-user page) | Link to the legacy reset page until feature 005 | Matched (deferred) | FR-009 |
| "or login with" FIDO2/WebAuthn button below the form | Passkey sign-in first, above the form | Improved (owner decision) | FR-010 to FR-015 |
| Identity-provider ("IAM SSO") button | Hint and link to the classic interface until feature 012 | Deferred to 012 | FR-007, FR-008 |
| "force_sso" hiding the form and the FIDO2 button on the mailbox-user page | Password form hidden on the role-neutral and mailbox-user screens, passkey sign-in kept, link to the classic interface for single sign-on | Changed: passkeys stay available | FR-007 |
| "Login was delayed by %s seconds" notice | Busy state while waiting, "too many requests" with retry time | Improved | FR-017, error table |
| FIDO2 alert area | Translated messages, announced | Improved | FR-014, FR-078 |
| Apple connection profile notice (`mobileconfig_info`) | Not shown | Deferred to 005 (Apple profiles) | — |
| OAuth2 authorisation login (`oauth2_request`) | Not shown | Deferred to 012 | — |
| App links on the login page and "Apps" menu in the header (webmail and operator links) | Same, from the public configuration, in the configured order, under the operator's "Apps" text | Matched | FR-001a, FR-042 |
| Help text panel (collapsible) | Same, sanitised | Matched | FR-001, FR-002 |
| Footer (operator HTML) | Same, sanitised | Matched | FR-002, FR-042 |
| Version number in the footer for signed-in users | Not shown | Deferred to 011 (version information) | — |
| Two-factor modal with WebAuthn, Yubi OTP and TOTP tabs and authenticator lists; closing it cancels the login | Second-factor screen, order WebAuthn, TOTP, then Yubico OTP under "Other methods"; explicit "Cancel" | Improved | FR-020 to FR-029 |
| U2F tab that deletes U2F keys and logs in without verification | Message to ask an administrator | Improved (security fix in the API) | FR-028 |
| Forced 2FA setup modal (TOTP, WebAuthn or Yubi OTP; close signs out) | Pending-actions screen with passkey registration; other methods in the legacy UI until 005 | Improved (partly deferred to 005) | FR-038, FR-039 |
| Forced password change modal | Explanation, link to the legacy UI and "Check again" | Deferred to 005 | FR-040, FR-041 |
| Redirect after login: administrator to the dashboard, domain administrator to mailboxes, mailbox user to webmail or the user page | Requested page or home screen | Changed: those sections arrive with later features, webmail single sign-on with 005 | FR-031, FR-047 |
| Header navigation per role (System, E-Mail, User settings, Quarantine) | Navigation catalogue with placeholders | Improved | FR-042 to FR-046 |
| "Restart SOGo" in the E-Mail menu | Placeholder of monitoring and operations | Deferred to 011 | FR-044 |
| Username and power icon to log out | User menu with username, role and "Sign out" | Matched | FR-036, FR-042 |
| Dual-login indicator (original user in brackets) | Not shown | Deferred to 007 (login-as) | — |
| "[ slave ]" indicator | Not shown | Dropped: not exposed by the API and of no use to most users | — |
| Page reload after the session lifetime | Warning 2 minutes before expiry with "Stay signed in", explanation after it | Improved (WCAG 2.2.1) | FR-032 to FR-034 |
| FIDO2 section (admin configuration, domain-admin page, mailbox-user auth tab): known IDs, rename, remove, "Register FIDO2 device", "Register Touch ID on Apple M1" | "Passkeys" page for every role with one "Add a passkey" action | Improved | FR-051 to FR-057 |
| Unlock icon marking the FIDO2 key used for the current session | Not shown | Dropped: the API does not report it | — |
| Friendly-name modal (`fido2.set_fn`, `fido2.fn`) | Rename | Matched | FR-054 |
| Browser "Are you sure?" confirmation for removal | Confirmation naming the passkey and the consequence | Improved | FR-055 |
| API section of the admin configuration: one read-only and one read-write `/api/v1` key, allowed IPs, "skip IP check", key always readable, activate, regenerate | API keys of this API: many named keys with owner, access level, expiry and networks, secret shown once, inspect, revoke | Replaced. `/api/v1` keys stay managed in the legacy UI, whose key screen the cutover (014) keeps reachable | FR-063 to FR-070 |
| CORS settings in the same section | Not shown | Deferred to 013 | — |
| API information text linking to the API documentation | Link to the documentation of this API | Matched | FR-069 |
| `user-scalable=0` | Pinch-zoom allowed | Improved | FR-083 |
| Links to legacy sections (menu entries that open a tab of a page) | Placeholders link to the classic interface pages, not tabs, because the classic interface has no hash-to-tab handling (research R19) | Changed | FR-044 |
| App links with any address, including `javascript:` | Only http(s) and same-origin addresses are rendered; other app links are left out | Improved (security fix, research R17) | FR-001a |

### API Dependency

This feature depends on **mailcow-rest-v2 feature 001** (authentication, sessions, passkeys,
identity, preferences, API keys, public configuration and audit log). Its contract version is
0.1.0 at the time of writing; the plan pins the exact version. The app relies on these operations,
described by behaviour:

- **Session bootstrap**: start an anonymous session and obtain its anti-forgery token, and obtain
  a fresh token after an anti-forgery failure.
- **Public configuration**: read the branding, the ordered app links with the operator's "Apps"
  text, login page options, enabled and default languages and whether an identity provider is
  configured, without signing in; load the operator's logos.
- **Session state**: read whether nobody is signed in, a second factor is pending (with its methods
  and expiry), the session is restricted (with its pending actions) or fully signed in, and the
  idle lifetime.
- **Password sign-in**: submit username, password and an optional role.
- **Passkey sign-in**: request a passkey challenge and submit the assertion, with an optional role.
- **Second factor**: request a WebAuthn challenge for the pending sign-in, submit a WebAuthn
  assertion, a TOTP code with the chosen method or a Yubico OTP, and cancel the pending sign-in.
- **Sign-out**: end the session.
- **Identity**: read the username, role, authentication method, scope, permission flags, pending
  actions and preferences.
- **Preferences**: update language and theme.
- **Own passkeys**: list them, request registration options, register a passkey with an optional
  name, rename and remove one.
- **API keys**: list with pages, sorting and filters (owner, status, access level), inspect, create
  and revoke.
- **Key-owner candidates** (administrators only): read the active administrators and domain
  administrators that can own a key, with search by username and pages.
- **Audit log**: list with pages and filters (time range, event types, outcome, actor, client
  address).
- **Problem types**: the stable problem types and validation rule codes, with their parameters,
  that the app translates.
- **API documentation**: the documentation page, as a link target only.

### Key Entities *(include if feature involves data)*

- **Public configuration**: page title, product name, light and dark logos, help text and footer
  (operator HTML), announcement (text, type, active), app links (ordered, with the operator's
  "Apps" text), login page options (hide each role's login link, force single sign-on), enabled
  languages, default language, and whether an identity provider is configured.
- **App link**: name, address, whether it is hidden on the login page, and an optional form for
  signed-in users; webmail or an operator-defined link.
- **Session state**: anonymous, awaiting a second factor, restricted or active; the account's
  username and role; the sign-in method; the idle lifetime.
- **Pending sign-in**: the available second-factor methods in presentation order, each with a type,
  a display name and a tier (primary or advanced), and an expiry.
- **Identity**: username, role, authentication method, scope (all domains, managed domains or own
  mailbox), permission flags, pending actions and preferences.
- **Pending action**: password change or second-factor setup.
- **Passkey**: display name, authenticator description, registration date, host name, active state
  and a non-secret identifier.
- **Preferences**: language and theme (light, dark or device setting).
- **API key**: name, non-secret prefix, owner (username, role, active state), access level, allowed
  networks, expiry, status, created at and by, last used at and from, revoked at and by. The
  secret exists only in the creation response.
- **Key-owner candidate**: an active administrator or domain administrator that can own a key,
  with its username and role.
- **Audit record**: time, event type, outcome, actor, target, client address, user agent,
  authentication method, failure reason, request identifier and non-secret details.
- **Navigation entry** (app-defined): section name, roles, optional permission flag, delivering
  feature and, for placeholders, the matching legacy screen.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a 360 px wide phone, users with a passkey reach the home screen from the sign-in
  screen in under 10 seconds in 90 % of attempts, with one tap plus the device's verification.
- **SC-002**: On a 360 px wide phone, users with a password and an authenticator app reach the home
  screen in under 45 seconds in 90 % of attempts.
- **SC-003**: A user without a passkey adds one in under 1 minute and uses it at the next sign-in,
  without visiting the legacy UI.
- **SC-004**: Automated accessibility checks report zero WCAG 2.2 AA violations on every screen and
  state of this feature, in both themes and on both viewports, and every user story can be
  completed with a keyboard alone and with a screen reader.
- **SC-005**: No screen of this feature scrolls horizontally at 360 px, and every touch target is
  at least 44 × 44 CSS px.
- **SC-006**: 100 % of new strings, problem types and validation rule codes of the API feature 001
  contract have English, Czech and Slovak translations or the classic interface's message of the
  same meaning, every legacy key the app uses exists in the en-gb snapshot, and no English API
  message is ever shown as a user-facing message.
- **SC-007**: Every navigation entry of every role leads to a working screen or a placeholder (zero
  broken links), and each role sees exactly the entries of the navigation catalogue for its
  permission flags.
- **SC-008**: On first visit, the sign-in screen is usable within 3 seconds on a mid-range phone
  over a typical mobile connection.
- **SC-009**: After sign-out on a shared device, none of the previous user's data can be seen,
  neither on screen nor through the browser's Back button.
- **SC-010**: An administrator creates an API key and copies its secret on a phone in under
  90 seconds, and the secret appears nowhere in the app afterwards.
- **SC-011**: An administrator finds a specific failed sign-in in the audit log with filters in
  under 1 minute on a phone.
- **SC-012**: A language or theme change applies in under 1 second and is in effect at the next
  sign-in on another device in 100 % of tests.
- **SC-013**: Sanitising the operator's help text and footer removes 100 % of the script-injection
  vectors in the test set while keeping the allowed formatting and links.
- **SC-014**: In 100 % of tests, an idle user is warned at least 2 minutes before the session
  expires and can extend it with one action, and an idle app sends no request that extends the
  session by itself.

## Assumptions

- The app is served from the same host name as the legacy UI and the API. Passkeys registered in
  the legacy UI therefore work, and the legacy UI's screens can be linked by their usual
  addresses on that host until the cutover (feature 014); the plan records the exact addresses.
  The legacy UI has its own sessions, so a user following such a link signs in there separately.
- The legacy UI keeps managing its `/api/v1` keys. This app manages only the keys of the new API,
  and the cutover (feature 014) keeps the legacy `/api/v1` key screen reachable.
- The app links and the key-owner candidates come from operations that API feature 001 adds to
  its contract. The plan follows the contract's exact shape for them.
- Enrolling TOTP, WebAuthn security keys and Yubico OTP, password change and password reset come
  with feature 005. Until then users do these in the legacy UI.
- Identity-provider sign-in (LDAP, Keycloak, generic OIDC) comes with feature 012. Until then such
  mailboxes get the generic sign-in failure with a password, but can sign in with a passkey.
- Branding colours come with feature 013.
- The time limits (5 minutes for a pending sign-in or a passkey challenge, the idle session
  lifetime, the throttling window) are set by the server. The app reads or reacts to them and does
  not set them.
- The 5-minute limit of a pending sign-in is treated as a security time limit under the
  "essential" exception of WCAG 2.2.1: the app announces it, warns one minute before it ends and
  lets the user restart with the username kept (FR-025). The idle session limit is extendable
  (FR-032). The API offers no way to extend a pending sign-in, and none is planned (orchestrator
  decision).
- Language and theme remembered on the device, and a dismissed passkey suggestion, are
  conveniences, not credentials (constitution V).
- **Out of scope**: managing mail objects; enrolling or removing TOTP, WebAuthn security keys and
  Yubico OTP; password change and reset; identity-provider sign-in; login-as and dual login;
  webmail single sign-on; listing or ending other sessions; managing other accounts' passkeys;
  `/api/v1` keys; branding colours.
