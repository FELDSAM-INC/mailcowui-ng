# Feature Specification: Identity Providers and OAuth2

**Feature Branch**: `main` (no feature branches, constitution 1.1.0)

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Identity provider and OAuth2 screens for mailcowui-ng, the
mobile-first web app for mailcow-dockerized, built only on mailcow REST API v2 feature 012 (Identity
providers and OAuth2 clients) and the sign-in of UI feature 001. Administrators set up the server's
single external identity provider (Keycloak, a generic OpenID Connect provider or an LDAP directory)
with a form per provider type: connection and credentials, the return addresses to register at the
provider, the attribute-to-mailbox-template mapping with a default template, automatic mailbox
creation on first sign-in, the Keycloak mailpassword flow, and the user import and periodic full
synchronisation of Keycloak and LDAP. They test the connection with the values in the form and get a
readable result, see stored client secrets and bind passwords only as 'set', replace them by typing
a new value, change the provider type and remove the configuration while no mailbox uses it. Mailbox
users sign in with single sign-on from the UI 001 sign-in screen and come back from the provider
signed in, with clear messages when the provider refuses, the sign-in expires or the provider is
unreachable; the 'force single sign-on' login option is honoured. Mailboxes whose password lives in
LDAP or Keycloak sign in through the normal UI 001 password form. Administrators manage the OAuth2
clients of mailcow's own OAuth2 provider: list and search them, add one with its redirect URIs and
copy the secret shown once, change the redirect URIs, generate a new secret, revoke all tokens and
delete clients. Destructive actions need a confirmation that shows what is affected, and every view
has loading, empty and error states. Administrators trace changes, tests and provider sign-ins in
the audit log. The feature replaces the legacy System › Configuration › Identity Provider and OAuth2
Apps tabs, the add OAuth2 client modal, the OAuth2 client edit page and the Single Sign-On button of
the login page. Every screen works at 360 px width, meets WCAG 2.2 AA and is translated into
English, Czech and Slovak."

## Clarifications

### Session 2026-10-18

- Q: Where does the single sign-on action appear on the sign-in screens, and in which order? → A:
  Only on the role-neutral and mailbox-user screens, and only when the public configuration reports
  single sign-on as available. On a device that supports passkeys the order is passkey sign-in, then
  "Sign in with single sign-on" as a full-width action, then the password form after an "or"
  divider; without passkey support single sign-on comes first. The administrator and
  domain-administrator screens never offer it. (agent decision: API 012 signs in only mailbox users
  by single sign-on; passkeys first is an owner decision recorded in UI 001; legacy shows the button
  only on the mailbox-user page; one tap to the provider is quicker than typing a password, so it
  precedes the form.)
- Q: What does "force single sign-on" do now that single sign-on exists? → A: When the option is set
  and single sign-on is available, the role-neutral and mailbox-user screens hide the password form
  and "Forgot password?" and keep passkey sign-in. The order is passkey sign-in (when the device
  supports it), then "Sign in with single sign-on", plus the "Not the correct login?" links that the
  login page options allow. This matches UI 001 FR-007, with the single sign-on action in place of
  its notice that points to the classic interface. When the option is set but single sign-on is not
  available (an LDAP provider, an incomplete configuration or none), the option is ignored and the
  screens look as without it. The administrator and domain-administrator screens are never affected.
  (orchestrator decision on the owner question, 2026-10-18: passkeys are phishing-resistant
  credentials held by mailcow and the owner wants them first, as decided in UI 001; this
  deliberately deviates from legacy and from the API 012 FR-020 client note, which also hide the
  passkey button. Agent decision for the unavailable case: the legacy option text applies it only
  "if an external OIDC provider is configured", and legacy otherwise shows an empty login page,
  which locks users out.)
- Q: How does the page a user asked for survive the round trip to the provider? → A: Before leaving
  for the provider, the app keeps the requested in-app address for this browser tab only, reads and
  discards it on return, opens it only if it is an address of the app (UI 001 FR-092), and otherwise
  opens the home screen. If it cannot be kept, for example because site storage is blocked, the user
  lands on the home screen. (agent decision: UI 001 FR-031 requires deep links to survive sign-in;
  an in-app address is not a credential, so constitution V allows keeping it; the API's pending
  sign-in holds only its own return address.)
- Q: How are the code, the state and errors on the return from the provider handled? → A: The app
  reads them once, removes them from the page address and the history entry at once, keeps them in
  memory only and submits the code and state once. A provider-reported error makes the app cancel
  the pending sign-in and show a translated message; the provider's own error text is never shown.
  "Try again" always starts a new single sign-on and never resubmits an old code. (agent decision:
  API 012 makes the state single-use and forbids exposing codes and states (FR-055 there); provider
  texts are untranslated and uncontrolled; resubmitting a consumed code can only fail.)
- Q: How does the app react when a single sign-on session ends at the provider, and when the user
  signs out? → A: When a request is answered with "identity provider session ended", the app ends
  the session, explains on the sign-in screen that the single sign-on session ended and offers the
  single sign-on action, without sending the browser to the provider on its own; after the next
  sign-in it returns to the same page. After signing out of a single sign-on session, the
  confirmation adds that the user is still signed in at the organisation's provider. (agent
  decision: legacy silently redirects to the provider when renewal fails, which loops while the
  provider is down and surprises users; API 012 FR-027 does not sign out at the provider, which
  matters on shared devices.)
- Q: Should the identity provider be configured in one long form or in smaller parts? → A: The first
  setup is its own page with steps on narrow screens (type, connection and credentials, return
  addresses for OIDC types, sign-in and mailbox creation, review) and one page with a section index
  on wide screens; it saves the whole configuration once. A stored configuration is shown as an
  overview with read-only sections, each with its own Edit that saves only that section with the
  version tag. A type change goes through the setup flow again. (agent decision: constitution II
  forbids giant forms; API 012 FR-009 offers both a whole save and changes of individual settings;
  UI 002 established per-section editing with version tags.)
- Q: How are stored secrets shown, kept and replaced? → A: Only their status ("Set" or "Not set") is
  shown. In an edit the field starts empty: leaving it empty keeps the stored secret, typing
  replaces it, and there is no action to remove it. When the Keycloak server URL, the OIDC token
  endpoint or the LDAP hosts change in the same edit, the field becomes required and explains why.
  Secret fields are never filled with the administrator's own saved credentials and are emptied
  after every save, refusal or cancel. (agent decision: API 012 FR-014 makes secrets write-only,
  kept when omitted and required again for a new receiving address. The "explicit remove action" of
  `docs/conventions.md` does not apply: API 012 offers no removal of these secrets, and a
  configuration without its secret cannot sign anyone in.)
- Q: Which values does "Test connection" use, and must a test succeed before saving? → A: It tests
  the values currently entered, completed with the stored values for everything not being edited,
  and is offered in the setup's connection step, in the connection section's edit and on the
  overview. The result appears next to the action with a failure category and a hint, is announced,
  and is marked as outdated when a value it depends on changes. Saving never requires a successful
  test. (agent decision: API 012 FR-019 tests unsaved candidate settings; legacy places the test
  next to Save and does not require it; providers can be temporarily unreachable while the settings
  are right.)
- Q: Which bulk actions does the OAuth2 apps screen offer? → A: In an explicit selection mode,
  administrators select clients on the current page and can revoke all tokens of, or delete, the
  selected clients through the API's bulk operations, with each client's version tag as listed. The
  app shows one result per client; failed, refused and outdated clients stay selected for a retry,
  and a dropped connection is reported as "outcome unknown" and never retried automatically.
  Generating new secrets in bulk is not offered. The selection is cleared when the page, search,
  filter, sort or page size changes; once it reaches the bulk limit that the API reports, further
  selection is disabled with a message that states the limit.
  (agent decision, aligned with `docs/conventions.md`: legacy offers the quick actions, and API 012
  FR-060 and FR-061 provide bulk deletion and bulk token revocation for up to 100 clients with one
  result per client; each new secret must be shown and copied individually, which a bulk run cannot
  do safely.)
- Q: How strong must the confirmations for destructive actions be? → A: Removing the configuration,
  changing the provider type, deleting a client, revoking a client's tokens and generating a new
  secret each need a confirmation dialog that names the item and states the consequences (token
  counts for clients); no typing is required, except that a bulk deletion of clients needs the
  number of selected clients typed. Removal and type change are unavailable, with the reason and a
  link to the affected mailboxes, while the configuration reports mailboxes of the configured type.
  (agent decision: constitution II requires explicit confirmation showing what is affected;
  `docs/conventions.md` asks for the typed number in bulk deletions; the API refuses removal and
  type changes while mailboxes depend on the provider, so the remaining impact is limited and
  recoverable by re-entering settings or issuing a new secret.)

### Session 2026-10-18 (plan: alignment with the API 012 contract)

- Q: Which mailbox counts decide whether removal and a type change are possible? → A: The API
  reports the number of mailboxes for each external source (Keycloak, generic OIDC, LDAP), counted
  as its "in use" checks count them. Removal is unavailable while any of these counts is above zero.
  A change to another type is unavailable while mailboxes use a source other than that type; since
  the configured type is always another source, this holds whenever mailboxes use the configured
  type. The overview shows every non-zero count with a link to those mailboxes. (plan decision: API
  012 FR-006, FR-015 and FR-017 now report per-source counts, which closes a former API gap.)
- Q: Does the overview show whether the synchronisation works? → A: Yes. For Keycloak and LDAP, the
  Synchronisation section shows the status that the API derives from the scheduled-job log: whether
  a job is enabled, running, waiting, overdue or unknown, the end of the last completed run, a
  failure since then and the expected next run, together with the limits of that derivation
  (FR-020). (plan decision: API 012 FR-062, which closes a former API gap.)
- Q: What does the app do when the provider returns an error instead of a code? → A: It reports the
  provider's error code and the state to the API, which consumes the state, cancels the pending
  sign-in and records the refusal in the audit log. A return that cannot be reported that way (no
  state, an error code the API would not accept, or a code without a state) makes the app cancel the
  pending sign-in instead (FR-048). (plan decision: API 012 FR-063, which closes a former API gap.)
- Q: Where do the defaults, the field limits and the return addresses come from before a
  configuration or a client exists? → A: From the API's identity provider and OAuth2 capabilities
  reads, which also report the OAuth2 endpoint paths, the token lifetimes, the accepted grant types
  and the bulk limit (FR-011, FR-018, FR-027, FR-057, FR-065). (plan decision: API 012 FR-064 and
  `docs/conventions.md`, "Capabilities and limits come from each API feature's capabilities read".)
- Q: Can the audit log be filtered by sign-in method? → A: No. The API offers no such filter and its
  conventions forbid feature-specific audit filters. Every sign-in record shows its method, and
  administrators narrow the log by event type, outcome, actor and time. The filter is recorded as an
  API gap (FR-067, gap 1). (plan decision: constitution I forbids working around the contract, for
  example by filtering one page of results in the browser.)
- Q: Which address does the provider return to, given that the server's return path is configurable?
  → A: The app serves `/ng/sso/return`, the API's default return path. When the return addresses
  that the API reports point to another path, the Return addresses section warns administrators that
  single sign-on in this app fails until the server setting is corrected (FR-027, FR-045). (plan
  decision: the static app cannot serve a path it does not know, and the setting exists on the API
  side for development.)

## User Scenarios & Testing *(mandatory)*

Actors: **administrators** (manage the identity provider and the OAuth2 clients) and **mailbox
users** (sign in with single sign-on, or with a directory or Keycloak password). Domain
administrators have no access to the screens of this feature and sign in as described in UI feature
001.

Terms: the **identity provider** is the one external Keycloak, generic OpenID Connect (OIDC) or LDAP
service configured on the server. **Single sign-on** is the sign-in on the provider's own page
(Keycloak and generic OIDC only). An **OAuth2 client** is an application registered with mailcow's
own OAuth2 provider; the screen listing them is called "OAuth2 apps", as in legacy. The legacy UI is
called **the classic interface** in user-facing text (UI 001 FR-090).

### User Story 1 - Set up and test the identity provider (Priority: P1)

An administrator of a school opens "Identity provider" on a tablet. No provider is configured yet,
so the screen explains what an identity provider does and offers to set one up. They choose LDAP,
enter the two directory hosts, choose StartTLS, enter the bind DN and bind password, the base DN and
the attribute that holds a user's group, and test the connection with the values in the form. The
first test says that the credentials were rejected; they correct a typo in the bind DN and the
second test succeeds. They map the attribute values "students" and "staff" to the mailbox templates
"Students" and "Staff", leave automatic mailbox creation on, turn on the periodic synchronisation,
review everything and save. The overview then shows the provider, that it is complete, that
directory password sign-in works, and that no mailbox uses it yet.

**Why this priority**: Every other part of the feature needs a configuration, and replacing the
legacy screen is the only way for administrators to stop using the classic interface for sign-in
settings.

**Independent Test**: Against a mock API generated from the contract, as an administrator on a 360
px and on a desktop viewport, set up a configuration of each type, run tests that return each result
category, and save. Confirm each request against the contract and each message shown. As a domain
administrator and a mailbox user, open the screen's address and confirm the "no access" state.

**Acceptance Scenarios**:

1. **Given** no configuration, **When** an administrator opens "Identity provider", **Then** an
   empty state explains single sign-on, password sign-in through the provider and automatic mailbox
   creation, and offers "Set up an identity provider".
2. **Given** the setup flow on a 360 px screen, **When** the administrator chooses a type, **Then**
   the flow continues in steps with a progress indicator, shows only the fields of that type, and
   starts with the API's defaults (for example port 389, username field `mail`, sync interval 15
   minutes, automatic creation on).
3. **Given** entered LDAP settings with a wrong bind password, **When** the administrator tests the
   connection, **Then** the result says that the credentials were rejected, names the tested
   address, is announced to screen readers, and nothing is saved.
4. **Given** a successful test, **When** the administrator changes a host afterwards, **Then** the
   result is marked as referring to earlier values.
5. **Given** a mapping entry whose attribute value repeats another entry's value, **When** the
   administrator tries to continue, **Then** the entry is marked with a message and the step does
   not advance.
6. **Given** the review step, **When** the administrator saves, **Then** the overview shows the
   stored configuration, the secret appears only as "Set", and the success is announced.
7. **Given** a Keycloak or generic OIDC setup, **When** the return addresses step opens, **Then** it
   lists the app's sign-in return addresses with copy actions and explains that they must be
   registered at the provider, next to the classic interface's return URL.
8. **Given** a domain administrator or a mailbox user, **When** they open the address of the screen,
   **Then** the "no access" state is shown and no configuration is requested.

---

### User Story 2 - Sign in with single sign-on (Priority: P1)

A teacher whose school uses Keycloak opens the app on a phone. The sign-in screen offers "Sign in
with single sign-on". They tap it, sign in on the school's Keycloak page with its own second factor,
and come back to the app on the page they had opened from a link before signing in. Their mailbox
did not exist yet; the server created it from the template their Keycloak attribute maps to. When
they later sign out, the app reminds them that they are still signed in at the school's provider.

**Why this priority**: Organisations that use Keycloak or another OpenID Connect provider cannot use
the app at all without it, and UI feature 001 deliberately left it to this feature.

**Independent Test**: With the mock API reporting single sign-on as available, start single sign-on
from each sign-in screen, simulate the return with a valid code and state, with each error the API
can report, with a provider-reported error and without parameters, and confirm the landing page, the
messages, and that the code and state are gone from the page address.

**Acceptance Scenarios**:

1. **Given** single sign-on is available, **When** a visitor opens the role-neutral or the
   mailbox-user sign-in screen, **Then** "Sign in with single sign-on" is offered. **When** they
   open the administrator or domain-administrator screen, **Then** it is not offered.
2. **Given** the single sign-on action, **When** the visitor taps it, **Then** the action shows a
   busy state and the browser opens the provider's sign-in page in the same tab.
3. **Given** a return from the provider with a valid code and state, **When** the return screen
   opens, **Then** it shows a "Completing sign-in" state, the code and state disappear from the page
   address, and the user lands on the page they asked for before signing in, or on the home screen,
   without a second-factor step.
4. **Given** a return whose sign-in state has expired, was already used or belongs to another
   browser, **When** the app completes it, **Then** a message says that the sign-in must be started
   again and offers to start it.
5. **Given** a return on which the provider reports that the user cancelled or refused, **When** the
   return screen opens, **Then** the app reports the provider's error code to the API, which cancels
   the pending sign-in, says that the sign-in was cancelled at the provider and offers to try again,
   without showing the provider's own text.
6. **Given** a user without a mailbox while automatic creation is off, **When** the app completes
   the sign-in, **Then** one generic message says that the sign-in did not succeed and suggests
   contacting the administrator, without revealing the reason.
7. **Given** the provider is unreachable, **When** the app completes the sign-in, **Then** a message
   says that the organisation's sign-in service is not reachable and offers to try again.
8. **Given** a signed-in single sign-on user, **When** a request is answered with "identity provider
   session ended", **Then** the app shows the sign-in screen with an explanation and the single
   sign-on action, and returns to the same page after the next sign-in.
9. **Given** a single sign-on session, **When** the user signs out, **Then** the sign-out
   confirmation adds that they are still signed in at their organisation's provider.
10. **Given** "force single sign-on" is set and single sign-on is available, **When** a visitor on a
    device that supports passkeys opens the role-neutral or the mailbox-user sign-in screen,
    **Then** passkey sign-in, then "Sign in with single sign-on" and the permitted "Not the correct
    login?" links are shown, without the password form or "Forgot password?". **Given** the option
    is set but only an LDAP provider is configured, **When** the screen opens, **Then** it looks as
    without the option.
11. **Given** a device that supports passkeys and single sign-on is available, **When** the
    role-neutral sign-in screen opens, **Then** the order is passkey sign-in, single sign-on, then
    the password form.

---

### User Story 3 - Sign in with an LDAP or Keycloak password (Priority: P1)

A member of staff whose mailbox authenticates against the school's LDAP directory opens the app and
signs in with their directory username and password in the normal sign-in form, exactly as in the
classic interface. Their mailcow second factor is asked for as usual. When the directory is down,
the app says that the organisation's sign-in service is not reachable instead of claiming a wrong
password.

**Why this priority**: UI feature 001 told these users that they cannot sign in with a password yet.
Without this story they must keep using the classic interface.

**Independent Test**: With the mock API, sign in through the role-neutral and the mailbox-user
screen with responses for success, second factor required, restricted session, generic failure,
"identity provider unavailable" and throttling, and confirm the screens and messages.

**Acceptance Scenarios**:

1. **Given** an LDAP mailbox, **When** its owner submits the correct directory password, **Then**
   they land on the home screen, or on the second-factor step when their mailbox has second factors,
   as for any password sign-in.
2. **Given** the API answers "identity provider unavailable" to a password sign-in, **When** the
   answer arrives, **Then** a temporary-failure message says that the organisation's sign-in service
   is not reachable, the username stays filled in, the password is cleared, and the message does not
   say that the password was wrong.
3. **Given** an identity provider is configured, **When** the sign-in screen opens, **Then** the UI
   001 hint that identity-provider accounts cannot use their password here is no longer shown.
4. **Given** a Keycloak mailbox signing in for the first time, **When** the API reports a restricted
   session because the template forces second-factor setup, **Then** the pending-actions screen of
   UI 001 is shown.

---

### User Story 4 - Maintain the identity provider (Priority: P2)

Months later the school moves its directory to a new host. The administrator opens the overview,
edits the "Connection and credentials" section, replaces the host and is told that the bind password
must be entered again because it would be sent to a new address. They enter it, test, and save only
that section. Later they add a mapping entry for "teachers", and notice that an entry points to a
template that someone deleted, which the overview flags. When the school switches to Keycloak, the
app explains that the type cannot be changed while 340 mailboxes authenticate against LDAP. After
those mailboxes have been switched, they change the type through a confirmation and a new setup
flow.

**Why this priority**: Configurations change rarely but must be changeable safely; the first setup
(User Story 1) already delivers a working provider.

**Independent Test**: With a stored configuration of each type in the mock API, edit each section,
change an address with and without the secret, save with an outdated version tag, change the type
with and without mailboxes in use, and remove the configuration.

**Acceptance Scenarios**:

1. **Given** a stored configuration, **When** the overview opens, **Then** it shows the type,
   whether the configuration is complete, what users can do with it, the number of mailboxes that
   use it (and of any other external source that still has mailboxes) with links to those
   mailboxes, the last change, and one read-only section per group of settings with its own Edit
   action.
2. **Given** the "Connection and credentials" section in edit, **When** the administrator changes
   the LDAP hosts, the Keycloak server URL or the OIDC token endpoint, **Then** the secret field
   becomes required with an explanation before the form is submitted.
3. **Given** a section edit, **When** the administrator saves, **Then** only that section's changes
   are sent with the version tag read, and the section shows the values the API stored, including
   its normalisations (for example StartTLS turned off when SSL is on).
4. **Given** another administrator saved a change in the meantime, **When** the save is refused as
   outdated, **Then** the entered values are kept, the changed settings are marked with their new
   saved values, and the administrator can save again or discard.
5. **Given** a mapping entry whose template no longer exists, **When** the overview opens, **Then**
   the entry is marked "Template missing" with an explanation.
6. **Given** 340 mailboxes that use the configured type, **When** the administrator looks at "Change
   provider type" or "Remove", **Then** each is unavailable with the reason and a link to those
   mailboxes.
7. **Given** no mailbox uses the provider, **When** the administrator removes it and confirms,
   **Then** the empty state is shown and the sign-in screen no longer offers single sign-on.
8. **Given** a configuration with "ignore TLS certificate errors" on, **When** the overview opens,
   **Then** a warning says that connections to the provider are not protected against impersonation.

---

### User Story 5 - Manage OAuth2 clients (Priority: P2)

An administrator registers the school's wiki, which signs mailbox users in through mailcow's OAuth2
provider. They add a client with the wiki's redirect URI and copy the client ID and secret from a
dialog that shows the secret once. Later they add a second redirect URI, generate a new secret after
a leak, revoke all tokens to sign every wiki user out, and finally delete the client when the wiki
is retired.

**Why this priority**: Only some servers use mailcow as an OAuth2 provider, and existing
applications keep working without these screens.

**Independent Test**: With the mock API, list, search, filter, sort and page through clients on both
viewports; create, edit, regenerate, revoke and delete, including bulk actions with a failing item,
and confirm that a secret is visible only in the credentials dialog.

**Acceptance Scenarios**:

1. **Given** an administrator on a 360 px screen, **When** they open "OAuth2 apps", **Then** each
   client is a card with its client ID, its first redirect URI and how many more there are, and its
   active token counts, and no secret appears anywhere.
2. **Given** the add form, **When** the administrator enters
   `https://wiki.example.org/oauth/callback` and submits, **Then** a dialog shows the client ID and
   the secret with copy actions and a warning that the secret will not be shown again. **When** they
   close it without copying the secret, **Then** the app asks for confirmation.
3. **Given** a redirect URI that is relative, contains a fragment or contains a space, **When** the
   administrator submits, **Then** the entry is marked with a translated message and nothing is
   sent.
4. **Given** a client, **When** the administrator generates a new secret and confirms, **Then** the
   new secret is shown once in the same kind of dialog, and the confirmation said beforehand that
   the application must be updated and can no longer renew tokens with the old secret.
5. **Given** a client with 12 active access tokens, **When** the administrator revokes its tokens,
   **Then** the confirmation names the client and the token counts, and afterwards the counts are
   zero.
6. **Given** a client, **When** the administrator deletes it and confirms, **Then** it disappears
   from the list, and the confirmation said that the application stops working at once and that this
   cannot be undone.
7. **Given** 40 clients, **When** the administrator searches for "wiki", **Then** only the clients
   whose client ID or redirect URIs contain "wiki" are listed, and a reload keeps the search.
8. **Given** no clients, **When** the screen opens, **Then** an empty state explains what OAuth2
   apps are for and offers to add one.
9. **Given** three selected clients of which one was changed elsewhere, **When** the administrator
   deletes them, typing "3" to confirm, **Then** the app reports a result per client (two deleted,
   one outdated) and the outdated client stays selected for a retry. Generating new secrets is not
   offered as a bulk action.

---

### User Story 6 - Trace identity provider and OAuth2 changes (Priority: P3)

An administrator investigating why a new teacher got the wrong mailbox quota opens the history of
the identity provider and sees that a colleague changed the mapping yesterday, then filters the
audit log by single sign-on and finds the teacher's first sign-in with the template it used.

**Why this priority**: It supports investigations; the feature works without anyone reading the log.

**Independent Test**: With audit records of every event type, target type, sign-in method and
failure reason of API feature 012 in the mock API, open the history from the overview and from a
client page, apply the target, event type and outcome filters, and confirm the entries shown.

**Acceptance Scenarios**:

1. **Given** the overview, **When** the administrator chooses History, **Then** the audit log of UI
   001 opens filtered to the identity provider configuration.
2. **Given** a change of the bind password and the sync interval, **When** the entry is shown,
   **Then** it shows the old and new interval and says only that the bind password changed.
3. **Given** a connection test record, **When** it is shown, **Then** it names the provider type,
   the tested address and the translated outcome.
4. **Given** a failed single sign-on because no mapping matched, **When** the administrator filters
   the audit log by failed sign-ins, **Then** the entry shows the single sign-on method, the e-mail
   address from the provider and the translated reason. (The API offers no filter by sign-in method:
   API gap 1.)

---

### Edge Cases

- **Configuration changed in the classic interface while open in the app**: the next save is refused
  as outdated and handled as in User Story 4, scenario 4.
- **Configuration stored by legacy with empty required values**: the overview says that it is
  incomplete and marks the empty values "Not set".
- **Mapping or default template pointing to a deleted template**: flagged "Template missing".
- **Mailboxes of an external source other than the configured type** (left by legacy): the overview
  shows their count with a link; removal stays unavailable, and so does a change to any type other
  than theirs, until they are switched.
- **Return addresses reported by the API that do not end in the app's return page**: the Return
  addresses section warns that single sign-on in this app fails until the server's return path is
  corrected.
- **Synchronisation status unknown or overdue**: the section explains that the status comes from the
  scheduled-job log, which keeps a limited number of entries, and that a failure the jobs do not log
  shows only as an overdue run.
- **No mailbox templates exist**: the mapping cannot get entries; the form says so and links to the
  mailbox templates of UI feature 003.
- **Template list cannot be loaded while editing the mapping**: an error with retry; entered entries
  are kept.
- **Single sign-on becomes unavailable between showing the action and tapping it**: the app says
  that single sign-on is not offered, refreshes the public configuration and hides the action.
- **Return address opened in another browser, after more than 10 minutes, or twice**: the sign-in
  state is invalid, and the user starts again.
- **Reload of the return screen after the parameters were read**: no parameters remain, and the app
  shows the sign-in screen, or the app when a session exists.
- **Browser Back from the provider's page**: the sign-in screen is shown with every action usable
  again.
- **Site storage blocked or cleared during the round trip**: single sign-on still works, and the
  user lands on the home screen instead of the requested page.
- **"Force single sign-on" set while only an LDAP provider, an incomplete configuration or no
  provider exists**: the option is ignored and the normal sign-in screens are shown.
- **"Force single sign-on" set on a device without passkey support**: only the single sign-on action
  is shown, because passkey sign-in is not offered on such devices (UI 001 FR-010).
- **Administrator on the role-neutral screen while "force single sign-on" applies**: they use the
  administrator screen through "Not the correct login?" or its own address, which keeps the password
  form.
- **The app's return address is not registered at the provider**: the provider shows its own error
  and the user never comes back; the configuration's explanation of the return addresses is the only
  remedy.
- **Another account signs in in a second tab during the round trip**: handled as in UI 001 (the
  current session's state is shown after completion).
- **Provider unreachable during a password sign-in**: temporary-failure message, no wrong-password
  wording, no extra waiting time.
- **LDAP test against many hosts**: the test may take long; the app keeps its busy state and reports
  when no result arrives in time.
- **Test while offline**: a network error with retry; nothing is stored.
- **Clipboard access refused when copying a return address, a client ID or a secret**: the value is
  selected for manual copying and the user is told to copy it themselves.
- **Credentials dialog lost** (tab closed or device switched off): the secret cannot be shown again;
  the only remedy is to generate a new secret.
- **OAuth2 client deleted by another administrator while its page is open**: the next action gets
  "not found", and the app shows the not-found state with a way back to the list.
- **OAuth2 client with redirect URIs stored by legacy that break the rules**: they are shown and
  marked, and must be corrected before the redirect URIs can be saved.
- **Revoking the tokens of a client without tokens**: succeeds and changes nothing.
- **Very long values** (URLs up to 2,000 characters, DNs, filters, client IDs): they wrap without
  horizontal scrolling at 360 px.
- **Network loss during a save**: nothing is reported as saved; the input is kept for a retry.

## Requirements *(mandatory)*

### Functional Requirements

#### Access and navigation

- **FR-001**: The "Identity providers and OAuth2" entry of the UI 001 navigation catalogue MUST be
  shown to administrators only and MUST lead to two screens, "Identity provider" and "OAuth2 apps".
  It replaces that entry's placeholder.
- **FR-002**: For domain administrators and mailbox users, the addresses of these screens MUST show
  the "no access" state of UI 001 (FR-045 there), and the app MUST NOT request any data of this
  feature for them.
- **FR-003**: Every screen and every collection of this feature MUST have defined loading, empty and
  error states. The error state MUST offer a retry and MUST keep any entered input. Every
  destructive action MUST ask for a confirmation that names the item and states what will be
  affected. Only a bulk deletion requires typing (FR-065).

#### Identity provider overview

- **FR-004**: The Identity provider screen MUST read the configuration. When the API answers
  "identity provider not configured", the screen MUST show an empty state with the legacy
  description `admin.iam_description` (verbatim) and offer "Set up an identity provider". This
  answer MUST NOT be presented as an error. (Further explanations are pending: plan, "Deviations
  needing a decision" item 4.)
- **FR-005**: For a stored configuration, the overview MUST show:
  - the provider type;
  - whether the configuration is complete for sign-in, and when it is not, a warning that neither
    single sign-on nor password sign-in through the provider works until the missing values are
    entered;
  - what users can do with it: single sign-on on the sign-in screen (Keycloak and generic OIDC, when
    complete), password sign-in against the directory (LDAP), password sign-in through Keycloak
    (when the mailpassword flow is on);
  - the number of mailboxes that authenticate against the configured type, and the number for each
    other external source that still has mailboxes, each with a link to the mailbox list of UI 003
    filtered by that authentication source;
  - the time of the last change;
  - the sections of FR-006 with the stored values;
  - the actions Test connection, Change provider type, Remove and History.
- **FR-006**: The settings MUST be grouped into these sections:

  | Section | Keycloak | Generic OIDC | LDAP |
  |---|---|---|---|
  | Connection and credentials | Server URL, realm, Keycloak version, client ID, client secret status, ignore TLS certificate errors | Authorization endpoint, token endpoint, user info endpoint, client ID, client secret status, scopes, ignore TLS certificate errors | Hosts, port, connection security, bind DN, bind password status, ignore TLS certificate errors |
  | Directory search | — | — | Base DN, username field, filter, attribute field |
  | Return addresses | The app's return addresses (read-only), the classic interface's return URL, additional return URLs | Same as Keycloak | — |
  | Sign-in and mailbox creation | Mailpassword flow, automatic creation, attribute mapping, default template | Automatic creation, attribute mapping, default template | Automatic creation, attribute mapping, default template |
  | Synchronisation | User import, periodic full synchronisation, sync interval | — | Same as Keycloak |

- **FR-007**: Empty required values of an incomplete configuration MUST be marked "Not set" in their
  section. Empty optional values MUST be shown as "None". Each mapping entry, and the default
  template, whose template the API reports as missing MUST be marked "Template missing", with an
  explanation that mailboxes cannot be created from it, and existing mailboxes are not updated from
  it, until it is corrected.
- **FR-008**: When "ignore TLS certificate errors" is on, the overview and the Connection and
  credentials section MUST warn that connections to the provider are not protected against
  impersonation.

#### Setup and change of provider type

- **FR-009**: "Set up an identity provider" MUST open a setup flow on its own page. On narrow
  screens it MUST proceed in steps with a progress indicator such as "Step 2 of 5": provider type;
  connection and credentials, with the directory search for LDAP; return addresses, for Keycloak and
  generic OIDC only; sign-in and mailbox creation, with the synchronisation for Keycloak and LDAP;
  review. On wide screens all sections MAY be shown on one page with a section index. Each step MUST
  check its fields before the next one opens, and going back MUST keep the entries.
- **FR-010**: The type step MUST offer Keycloak, generic OpenID Connect and LDAP, each with a
  one-sentence explanation: Keycloak offers single sign-on, optional password sign-in through the
  mailpassword flow, user import and synchronisation; a generic OpenID Connect provider offers
  single sign-on without synchronisation; LDAP offers password sign-in against a directory, user
  import and synchronisation. (Pending: the explanations are new strings next to legacy's bare
  select; plan, "Deviations needing a decision" item 4.)
- **FR-011**: The setup form MUST start with the defaults that the API's identity provider
  capabilities report, currently: automatic creation on; scopes `openid profile email
  mailcow_template`; port 389; neither SSL nor StartTLS; username field `mail`; sync interval 15
  minutes; TLS certificate errors not ignored; mailpassword flow, user import and periodic full
  synchronisation off. The mapping, the default template and the additional return URLs start
  empty.
- **FR-012**: The review step MUST summarise every value, show secrets only as "entered", show the
  latest connection test result if there is one, list the return addresses to register, and offer
  Save. Saving MUST send the whole configuration. On success, the app MUST show the overview,
  announce that the identity provider was set up, and refresh the public configuration so that the
  sign-in screens reflect it. When a first setup is answered as "updated" because another
  configuration was stored in the meantime, the announcement MUST say that the existing
  configuration was replaced (API gap 3).
- **FR-013**: A change to a type MUST be treated as blocked while the configuration reports
  mailboxes of any external source other than that type. "Change provider type" MUST be unavailable,
  with the reason and the links of FR-005, while every other type is blocked, which is always the
  case while mailboxes use the configured type. Otherwise it MUST ask for confirmation, naming the
  current type and stating that its settings, including its secret, will be removed when the new
  configuration is saved, and then open the setup flow at the type step, where the current type and
  each blocked type are unavailable with their reason. The stored configuration MUST stay unchanged
  until the new one is saved, that save MUST carry the version tag read, and leaving the flow MUST
  change nothing.
- **FR-014**: An "identity provider in use" conflict on a save, a type change or a removal MUST be
  shown as a translated message with the number of mailboxes the API reports and a link to the
  mailbox list of UI 003. Nothing is changed.

#### Editing sections

- **FR-015**: Each section's Edit action MUST open that section's form, full-screen on narrow
  screens and in place on wide screens, prefilled with the stored values. Saving MUST send only that
  section's changed settings as a change of the stored configuration, with the version tag read. On
  success the section MUST show the values the API returns, which may be normalised (a trailing
  slash removed from the Keycloak server URL, attribute names lower-cased, StartTLS turned off when
  SSL is on), and the outcome MUST be announced.
- **FR-016**: Leaving a form with unsaved changes MUST ask for confirmation.
- **FR-017**: When a save is refused as outdated, the app MUST keep the entered values, load the
  latest configuration, mark every setting that changed in the meantime together with its new saved
  value (for a secret: "changed elsewhere", without any value), and ask the administrator to save
  again or discard their changes. It MUST NOT merge or re-send on its own.

#### Field rules

- **FR-018**: Before sending, the app MUST check these rules and show each violation at its field or
  entry:
  - Keycloak: server URL required, an absolute `http` or `https` URL of at most 2,000 characters;
    realm 1 to 255 characters without `/`; client ID 1 to 255 characters; Keycloak version one to
    four whole numbers separated by dots;
  - generic OIDC: the three endpoints required, each an absolute `http` or `https` URL of at most
    2,000 characters; client ID 1 to 255 characters; scopes 1 to 50 names separated by single
    spaces, without `"` or `\`;
  - LDAP: 1 to 10 hosts; port 1 to 65,535; base DN and bind DN 1 to 1,000 characters; username field
    and attribute field each an attribute name (a letter followed by letters, digits or hyphens, at
    most 255 characters); attribute field required while user import or periodic full
    synchronisation is on; filter empty, or at most 1,000 characters starting with `(`, ending with
    `)` and with balanced parentheses;
  - return addresses: the classic interface's return URL required, and at most 100 additional return
    URLs, each an absolute `http` or `https` URL of at most 2,000 characters, with duplicates
    marked;
  - mapping: at most 100 entries, each with an attribute value of 1 to 255 characters, unique with
    letter case counting, and a chosen template;
  - sync interval: a whole number of minutes from 1 to 10,080;
  - secrets: 1 to 1,000 characters.

  The numeric limits MUST come from the identity provider capabilities read, and the syntax rules
  from the contract. The API stays authoritative: its validation errors MUST be shown at the
  matching field or entry, including "secret required" at the secret and "template not found" at
  the named mapping entry.
- **FR-019**: LDAP hosts MUST be entered as a list of entries with add and remove actions.
  Connection security MUST be one choice of "None", "SSL" and "StartTLS". When SSL is chosen with
  port 389, the form MUST say that port 636 will be used; when StartTLS is chosen, it MUST say that
  the directory's standard port is expected. (Pending: legacy has one comma-separated
  `admin.iam_host` input with `admin.iam_host_info`, and the two switches `admin.iam_use_ssl` and
  `admin.iam_use_tls` with their `*_info` texts; plan, "Deviations needing a decision" items 1 and
  2. Until decided, the legacy fields apply.)
- **FR-020**: The sync interval MUST be entered in whole minutes and shown with a readable
  equivalent ("every 15 minutes", "every 2 hours"). The Synchronisation section MUST explain that
  user import creates a mailbox for each provider user without one, that periodic full
  synchronisation re-applies the mapped template to existing mailboxes and never uses the default
  template, and that a job runs at most once per interval and picks up changes at its next run. Once
  UI feature 011 ships, it MUST link to that feature's scheduled-job log; until then it MUST show no
  link and no placeholder. For Keycloak and LDAP, the section MUST also show the synchronisation
  status that the API reports: whether a job is disabled, running, waiting, overdue or unknown, the
  end of the last completed run, the time of a failure logged since then, and when the next run is
  expected, each conveyed by text and not by colour alone. It MUST explain that the status is
  derived from the scheduled-job log, which keeps a limited number of entries, so that "unknown" can
  mean that no run was logged recently and a failure that the jobs do not log shows only as an
  overdue run.
- **FR-021**: For Keycloak, the form MUST show the legacy texts verbatim, as the classic interface
  does: `admin.iam_extra_permission` (the service account with the `view-users` permission) before
  the mailpassword flow, user import and synchronisation settings, and `admin.iam_auth_flow_info`
  (the hash in the user's `mailcow_password` attribute) with the mailpassword flow switch.
- **FR-022**: For a generic OIDC provider, the form MUST NOT offer synchronisation settings and MUST
  say that such a provider has no synchronisation.

#### Stored secrets

- **FR-023**: The app MUST NOT display the client secret or the bind password, or any part of one,
  anywhere. It MUST show only whether each is set.
- **FR-024**: In the setup flow the secret field MUST be required. In a section edit the secret
  field MUST start empty and state that a secret is set; leaving it empty MUST keep the stored
  secret, and typing a value MUST replace it. There MUST be no action that removes a secret.
- **FR-025**: When an edit changes the address that receives the secret (the Keycloak server URL,
  the generic OIDC token endpoint or the LDAP hosts), the secret field MUST become required and
  explain that the secret must be entered again because it would be sent to a new address.
- **FR-026**: Secret fields MUST be masked by default, MAY offer a control to reveal what is being
  typed, MUST NOT be filled with the administrator's own saved sign-in credentials, and MUST be
  emptied after a save, a refused save, a cancelled edit or leaving the form.

#### Return addresses

- **FR-027**: For Keycloak and generic OIDC, the Return addresses section MUST list the app's
  sign-in return addresses that the API reports, one for each of the server's host names, each with
  a copy action, and MUST explain that they must be registered at the provider as allowed redirect
  addresses for single sign-on in this app, in addition to the classic interface's return URL. In
  the setup flow, before anything is stored, the addresses MUST come from the capabilities read.
  When a reported address does not end in the app's own return page (`/ng/sso/return`), the section
  MUST warn that single sign-on in this app fails until the server's return path is corrected.
- **FR-028**: The classic interface's return URL MUST be required, and the additional return URLs
  MUST be a list with add and remove actions, both explained as used by the classic interface.

#### Attribute mapping and automatic creation

- **FR-029**: The mapping MUST be edited as a list of entries, each with an attribute value and a
  mailbox template chosen from the templates that the API lists (UI 003). On narrow screens each
  entry MUST be a card with both fields stacked and a remove action labelled with the entry's value.
  "Add entry" MUST be offered up to 100 entries. The template choice MUST offer a search when there
  are many templates.
- **FR-030**: The form MUST explain where the attribute value comes from: the `mailcow_template`
  value of the user's details for single sign-on, the user's `mailcow_template` attribute for the
  Keycloak mailpassword flow, and the configured attribute field for LDAP; that the first value is
  used when there are several; and that values match exactly, letter case included.
- **FR-031**: The default template MUST be "None" or a template, explained as used for new mailboxes
  whose value matches no entry, and never for updates.
- **FR-032**: Automatic creation MUST be explained as creating a mailbox at a user's first sign-in
  through the provider, from the mapped template or else the default template. The form MUST say
  that when it is off, or when neither template applies, users without a mailbox cannot sign in.

#### Connection test

- **FR-033**: "Test connection" MUST be offered in the setup flow's connection step, in the edit
  form of the Connection and credentials section, and on the overview for the stored configuration.
- **FR-034**: The test MUST use the values currently entered, completed with the stored values for
  everything not being edited. When the secret is left empty while the type or the address that
  receives the secret differs from the stored one, the app MUST ask for the secret at its field
  instead of testing.
- **FR-035**: While a test runs, the app MUST show and announce a progress state and MUST prevent
  starting another test. If no result arrives within 90 seconds, the app MUST say that no result was
  received and offer to test again.
- **FR-036**: The result MUST state success, or failure with a translated category and a hint:
  - unreachable: check the address, the port and whether the server can reach the provider;
  - timed out: the provider did not answer in time;
  - TLS certificate rejected: the provider's certificate is not trusted, has expired or does not
    match the address; ignoring certificate errors is possible but unsafe;
  - credentials rejected: check the client ID and secret, or the bind DN and password;
  - unexpected response: with the provider's status code.

  It MUST also name the provider type, the tested address and the time of the test. A successful
  Keycloak test MUST note, when the mailpassword flow, user import or synchronisation is on, that it
  checked only the service token and not the `view-users` permission.
- **FR-037**: The result MUST be shown next to the test action, announced to screen readers, and
  conveyed by text and an icon with a text alternative. When a value it depends on changes
  afterwards, it MUST be marked as referring to earlier values. Results MUST NOT be stored; leaving
  the screen discards them. A failed or missing test MUST NOT prevent saving.
- **FR-038**: Validation errors in the candidate settings MUST be shown at their fields, and no test
  MUST run.

#### Removal

- **FR-039**: "Remove" MUST be unavailable, with the reason and the links of FR-005, while the
  configuration reports any mailbox with an external authentication source. Otherwise it MUST
  ask for confirmation, naming the type and stating that single sign-on is no longer offered,
  password sign-in through the provider stops, synchronisation stops at its next run, and every
  setting including the secret is removed and cannot be restored. On success the app MUST show the
  empty state, announce the removal and refresh the public configuration.

#### Single sign-on on the sign-in screens

- **FR-040**: When the public configuration reports single sign-on as available, the role-neutral
  and mailbox-user sign-in screens of UI 001 MUST offer the single sign-on action, labelled with the
  legacy `admin.iam_sso` ("Single Sign-On"), as a full-width action. On a device that supports
  passkeys it MUST come directly after passkey sign-in; otherwise it MUST come first. The password form MUST follow it after an "or" divider. The
  administrator and domain-administrator screens MUST NOT offer it.
- **FR-041**: When the "force single sign-on" login option is set and single sign-on is available,
  the role-neutral and mailbox-user sign-in screens MUST NOT show the password form or "Forgot
  password?". They MUST keep passkey sign-in, first when the device supports it, followed by the
  single sign-on action and the "Not the correct login?" links that the login page options allow (UI
  001 FR-006). The single sign-on action takes the place of the UI 001 FR-007 notice that points to
  the classic interface; everything else of UI 001 FR-007 applies unchanged. When the option is set
  and single sign-on is not available, the option MUST be ignored. The administrator and
  domain-administrator screens MUST NOT be affected.
- **FR-042**: The hint of UI 001 FR-008, which tells identity-provider accounts that they cannot use
  their password here yet, MUST no longer be shown: LDAP and Keycloak mailboxes now sign in with the
  password form, and single sign-on accounts use the single sign-on action.
- **FR-043**: Starting single sign-on MUST show a busy state on the action and prevent a second
  start, request the start from the API, and then open the provider's authorization address that the
  API returns in the same tab. Before leaving, the app MUST keep the in-app address the user had
  requested (UI 001 FR-031) for this browser tab only, as the only thing it keeps for the round
  trip. When the API answers "single sign-on not available", the app MUST say that single sign-on is
  not offered, refresh the public configuration and hide the action. Other failures MUST be handled
  as in UI 001. When the user comes back from the provider's page with the browser's Back button,
  every sign-in action MUST be usable again.
- **FR-044**: The app MUST NOT open the provider in a pop-up window or an embedded frame.

#### Return from the provider

- **FR-045**: The app MUST serve the sign-in return address that the API registers for it,
  `/ng/sso/return` (the API's default return path). Opening it MUST show a screen with the
  operator's branding and a "Completing sign-in" progress state that is announced to screen readers.
- **FR-046**: The app MUST read the code and the state, or the provider's error, from the page
  address once, remove them from the address and from the browser history entry before anything else
  happens, keep them only in memory, and submit the code and the state once to complete the sign-in.
  They MUST NOT be shown, written to device storage, or sent anywhere other than the completion
  request.
- **FR-047**: After a successful completion, the app MUST continue as after any sign-in of UI 001
  (FR-030 there): it MUST read and discard the address kept by FR-043 and open it only if it is an
  address of the app (UI 001 FR-092), and otherwise open the home screen. When nothing was kept,
  including because site storage is unavailable, it MUST open the home screen. A single sign-on
  session has no second-factor step and no pending actions.
- **FR-048**: The return screen MUST handle these outcomes:

  | Outcome | Message | Actions |
  |---|---|---|
  | The provider reports an error (for example the user cancelled or refused) | The sign-in was cancelled or refused at the organisation's sign-in page. The app first reports the provider's error code and the state to the API, which cancels the pending sign-in and records it; when they cannot be reported (no state, or an error code the API would not accept), the app cancels the pending sign-in instead. The message does not depend on the outcome of that request. The provider's own text is never shown or sent. | Try again, Back to sign-in |
  | Sign-in state invalid, including a return with a code but no state, or a state but no code (the app then cancels the pending sign-in first) | The sign-in expired or was already completed and must be started again. | Try again, Back to sign-in |
  | Sign-in failed | Signing in with the organisation's account did not succeed; contact the administrator if it persists. No reason is given. | Try again, Back to sign-in |
  | Identity provider unavailable | The organisation's sign-in service is not reachable; try again in a few minutes. | Try again, Back to sign-in |
  | Single sign-on not available | Single sign-on is not offered on this server. The public configuration is refreshed. | Back to sign-in |
  | Too many requests, service unavailable, network failure, any other error | As in UI 001. | Try again, Back to sign-in |

  "Try again" MUST start a new single sign-on and MUST NOT resubmit the old code and state.
- **FR-049**: When the return address is opened without a code, a state or an error, the app MUST
  show the app if a session exists, and otherwise the sign-in screen without an error.

#### Password sign-in through a provider

- **FR-050**: LDAP and Keycloak mailboxes MUST sign in through the UI 001 password form without any
  additional choice, including its second-factor step and pending-actions screen.
- **FR-051**: When a password sign-in is answered with "identity provider unavailable", the app MUST
  show a temporary-failure message saying that the organisation's sign-in service is not reachable,
  keep the username and clear the password. It MUST NOT describe the failure as a wrong password or
  delay a retry.

#### End of a single sign-on session

- **FR-052**: When any request is answered with "identity provider session ended", the app MUST end
  the session as in UI 001 (FR-034 there), show the sign-in screen with an explanation that the
  single sign-on session ended, for example after a sign-out or a change at the organisation's
  provider, offer the single sign-on action when it is available, and return to the same page after
  the next sign-in. The app MUST NOT send the browser to the provider on its own.
- **FR-053**: When the identity reports that the session was established by single sign-on, the
  sign-out confirmation MUST add that the user is still signed in at the organisation's provider and
  should sign out there too on a shared device.

#### OAuth2 client list

- **FR-054**: The OAuth2 apps screen MUST list the clients in pages of 25 (default), 50 or 100, with
  the total. It MUST offer a search over the client ID and the redirect URIs, sorting by identifier
  (default, ascending), client ID and first redirect URI, and a filter on whether a client has
  active tokens. Search, sort, filter, page and page size MUST be kept in the page address.
- **FR-055**: On narrow screens each client MUST be a card with its client ID, its identifier, its
  first redirect URI and the number of further ones, and its active access and refresh token counts
  ("No active tokens" when both are zero). Wide screens MUST show a table with the same values. No
  secret MUST appear.
- **FR-056**: The empty state MUST explain that OAuth2 apps let other applications sign mailbox
  users in through this server and offer "Add OAuth2 client". A search or filter without matches
  MUST offer to clear it.
- **FR-057**: The screen MUST offer an information panel, collapsed on narrow screens, with the
  legacy text `admin.oauth2_info` verbatim (markup through the sanitiser), and the authorization,
  token and profile addresses on the current host name with copy actions. The endpoint paths MUST
  come from the OAuth2 capabilities read. (Pending: further explanations, the grant types the server
  accepts and the token lifetimes as new strings; plan, "Deviations needing a decision" item 5.)

#### OAuth2 client changes

- **FR-058**: "Add OAuth2 client" MUST ask for one or more redirect URIs as a list of entries with
  add and remove actions. Each entry MUST be an absolute URI with a scheme, without a fragment and
  without whitespace; duplicates MUST be marked; and the entries joined by single spaces MUST NOT
  exceed 2,000 characters, with the remaining length shown. On success the app MUST show the
  credentials dialog of FR-059. (Pending: legacy has one Redirect URI field; plan, "Deviations
  needing a decision" item 8.)
- **FR-059**: After a client is created or its secret regenerated, a dialog MUST show the client ID
  and the secret, each with a copy action, and a warning that the secret will not be shown again.
  Closing the dialog without having copied the secret MUST ask for confirmation, and the Escape key
  MUST NOT close it without that confirmation. The secret MUST exist only while the dialog is open
  and MUST NOT be written to device storage or to a page address.
- **FR-060**: The client page MUST show the identifier, the client ID with a copy action, the scope,
  the active token counts and the redirect URIs, and MUST state that the secret is hidden and that a
  new one can be generated. It MUST offer saving changed redirect URIs (under the rules of FR-058,
  with the version tag read), Generate new secret, Revoke all tokens, Delete and History. The client
  ID and the scope MUST NOT be editable. A client that no longer exists MUST show the not-found
  state with a way back to the list.
- **FR-061**: Stored redirect URIs that break the rules of FR-058 MUST be shown and marked with the
  rule they break, and MUST be corrected before the redirect URIs can be saved.
- **FR-062**: "Generate new secret" MUST ask for confirmation, naming the client ID and stating that
  the application must be given the new secret, that renewing tokens with the old secret fails, and
  that existing access tokens keep working until they expire. On success the app MUST show the
  credentials dialog with the new secret.
- **FR-063**: "Revoke all tokens" MUST ask for confirmation, naming the client ID and its active
  token counts, and stating that every user of the application is signed out of it at once and must
  authorise it again, while the client and its secret stay. On success the counts MUST show zero and
  the outcome MUST be announced.
- **FR-064**: "Delete" MUST ask for confirmation, naming the client ID and its first redirect URI,
  and stating that the application stops working at once, that its tokens are removed and that this
  cannot be undone. On success the client MUST disappear from the list, the outcome MUST be
  announced, and from the client page the app MUST return to the list.
- **FR-065**: Administrators MUST be able to select clients on the current page in an explicit
  selection mode and to revoke all tokens of, or delete, the selected clients through the API's bulk
  operation:
  - one confirmation MUST list the selected clients with their token counts and the consequences of
    FR-063 or FR-064, and a bulk deletion MUST require the number of selected clients to be typed;
  - the app MUST send the API's bulk operation with each client's version tag as listed. Once the
    selection reaches the bulk limit that the OAuth2 capabilities report, further selection MUST be
    disabled with a message that states the limit (`docs/conventions.md`);
  - the app MUST show a summary with one result per client (done, not found, refused, outdated or
    failed), and failed, refused and outdated clients MUST stay selected so that they can be
    retried;
  - a dropped connection MUST be reported as "outcome unknown" and MUST NOT be retried
    automatically;
  - generating new secrets MUST NOT be offered as a bulk action;
  - the selection MUST be cleared when the page, search, filter, sort or page size changes.

  The app MUST NOT replace the bulk operation with one request per client.
- **FR-066**: When an OAuth2 change is refused as outdated, the app MUST keep the entered redirect
  URIs and handle it as in FR-017. For a secret regeneration, a revocation or a deletion, it MUST
  show the current state of the client and ask again.

#### History

- **FR-067**: The overview and the client page MUST offer a History action that opens the audit log
  of UI 001 filtered to the identity provider configuration or to that client. That screen MUST gain
  the target types "identity provider configuration" and "OAuth2 client" as filters, and labels for
  the sign-in methods "single sign-on", "directory password" and "provider password" (each with and
  without a second factor), which every sign-in record shows. The API offers no filter by sign-in
  method (API gap 1), so the screen MUST NOT offer one. Entries MUST show:
  - changed settings with their old and new value, and secrets only as "changed";
  - connection tests with the provider type, the tested address and the translated outcome;
  - revocations and deletions of clients with the number of tokens and codes removed;
  - refusals with their translated reason;
  - sign-ins through a provider with their method, the provider type and, for failures, the
    translated reason (sign-in state invalid, provider refused, identity provider unavailable, no
    e-mail address, mailbox not linked to the provider, automatic creation off, no matching mapping,
    creation failed, password not verifiable);
  - mailboxes created or updated at sign-in with the template used, linking to the mailbox and to
    that account's sign-in records (the API offers no filter that leads to the one sign-in record:
    API gap 2).

#### Errors and feedback

- **FR-068**: Every API error MUST be shown as a translated message chosen by its problem type,
  never as the API's English text. This feature MUST translate at least: identity provider not
  configured, identity provider in use (with the mailbox count), single sign-on not available,
  sign-in state invalid, identity provider unavailable, identity provider session ended, outdated
  version, the connection test categories, and the validation rules of its fields with their
  parameters, including "secret required" and "template not found". Unknown types and rule codes
  MUST be handled as in UI 001.
- **FR-069**: Forms MUST show field errors next to their field, or next to the entry for list
  entries (hosts, return URLs, mapping entries, redirect URIs), and in an error summary at the top
  whose items lead to the fields.
- **FR-070**: The outcome of every change MUST be shown and announced to screen readers. A status
  message MUST NOT disappear while it has focus or is hovered.

#### Accessibility and mobile behaviour

- **FR-071**: Every screen and state of this feature MUST meet WCAG 2.2 level AA in both themes, at
  360 px and on a desktop viewport, and automated accessibility checks MUST report no violations.
- **FR-072**: No screen MAY need horizontal scrolling at 360 px or 320 px width or at 400 % zoom on
  a 1,280 px wide screen. Long URLs, DNs, filters, client IDs and attribute values MUST wrap. Touch
  targets MUST be at least 44 × 44 CSS px.
- **FR-073**: Step changes MUST move focus to the step's heading and announce the step ("Step 2 of
  5"). Dialogs MUST keep focus inside while open, return it when closed, and close with the Escape
  key unless unsaved data or a secret would be lost.
- **FR-074**: Help texts MUST be visible text associated with their control, not hover-only
  tooltips. Switches, choices and list entries MUST be labelled, and add and remove actions MUST
  name the entry they act on.
- **FR-075**: Completeness, test results, token status, "Template missing" and warnings MUST NOT be
  conveyed by colour alone.
- **FR-076**: Copy actions MUST announce success. When copying fails, the value MUST be selected for
  manual copying with an explanation.

#### Internationalisation

- **FR-077**: All user-facing text MUST follow constitution IV 1.3.0: every language mailcow ships
  is supported; text with a classic-interface equivalent MUST be mailcow's own translation, used
  verbatim by its legacy key, including texts that name the product or contain markup; the screens
  MUST mirror the legacy forms (fields, labels, help texts, options, units, order and messages); new
  strings, only for elements the classic interface lacks, MUST exist in English, Czech and Slovak
  and MUST NOT be machine-translated.
- **FR-078**: Provider names (Keycloak, LDAP, OpenID Connect) and technical values (URLs, DNs,
  filters, attribute and claim names, scopes, client IDs) MUST be shown as they are and never
  translated. Dates, times and numbers MUST be formatted for the user's language.
- **FR-079**: New strings MUST call the legacy mailcow UI "the classic interface" (UI 001
  FR-090).

#### Security in the browser

- **FR-080**: The app MUST use only operations of the mailcow-rest-v2 contract. The provider MUST
  only be a navigation target of the browser; the app MUST NOT send requests to the provider itself.
- **FR-081**: Secrets, OAuth2 client secrets outside the credentials dialog, and the provider's code
  and state MUST NOT be written to device storage, page addresses or logs. The only value this
  feature keeps on the device is the requested in-app address during a single sign-on round trip
  (FR-043), which is discarded on return.
- **FR-082**: Values from the API (URLs, DNs, filters, attribute values, client IDs, redirect URIs)
  MUST be rendered as text, never as markup. Return addresses, redirect URIs and provider endpoints
  MUST be shown as copyable text, not as links.

### Legacy Parity

Legacy reference: FeldHost fork of mailcow-dockerized (upstream tag `2026-09a`), `data/web/`
`templates/admin.twig` (System › Configuration menu),
`templates/admin/tab-config-identity-provider.twig`, `templates/admin/tab-config-oauth2.twig`,
`templates/modals/admin.twig` (`addOAuth2ClientModal`), `templates/edit/oauth2client.twig`,
`templates/user_index.twig` (Single Sign-On button, `force_sso`), `inc/triggers.user.inc.php`
(`?iam_sso=1`, return with code and state, token renewal), `js/site/admin.js`
(`draw_oauth2_clients`, `iam_test_connection`, mapping and return URL rows, provider select) and
`lang/lang.{en-gb,cs-cz,sk-sk}.json`. The identity provider and OAuth2 templates and `admin.js`
parts are identical to upstream; the fork differs only in branding texts. Status: **Matched** (same
capability), **Improved** (same capability, better behaviour) or **Dropped** (intentionally not in
this feature, with the reason).

#### System › Configuration › Identity Provider

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Card used as a tab, collapsed on phones | Collapsed card with all three forms in the page | Improved: own screen, overview with sections | FR-001, FR-005, FR-006 |
| Description text (`admin.iam_description`, HTML) | Static text | Matched: verbatim, markup through the sanitiser, in the empty state and setup | FR-004, FR-010 |
| Provider select (Keycloak, Generic-OIDC, LDAP) switching the visible form | Switching shows another form; saving it changes the type; the old type's values stay stored | Improved: type chosen in setup; an explicit type change with impact and the mailbox-use rule | FR-009, FR-010, FR-013 |
| Keycloak: Server URL, Realm, Client ID, Version | Text inputs, only presence checked | Improved: checked before sending | FR-006, FR-018 |
| Client Secret / Bind Password, prefilled with the stored secret, reveal button | Stored secret sent to the browser and revealable | Improved: secret never shown, only "Set"; replaced by typing | FR-023 to FR-026 |
| Redirect Url and additional redirect URL rows with + and × buttons | Required URL, list of extra URLs | Matched, plus the app's return addresses to register | FR-027, FR-028 |
| Attribute Mapping rows (Attribute, Template, + and ×), Default Template with hover tooltip | Rows silently dropped when incomplete; deleted templates not noticed | Improved: cards on phones, duplicates refused, missing templates flagged, visible help | FR-007, FR-029 to FR-031, FR-074 |
| Service account hint (`admin.iam_extra_permission`) | Static text naming the product | Matched: verbatim, with the product name the installation's file has | FR-021, FR-077 |
| Mailpassword Flow switch with info text | Switch | Matched | FR-021 |
| Ignore SSL Errors switch | Switch | Improved: warning while on | FR-008 |
| Auto-create users on login | Switch | Matched, with explanation | FR-032 |
| Periodic Full Sync, Import Users, Sync / Import interval (min) | Switches and a number (values below 1 raised to 1) | Improved: range 1 to 10,080, readable interval, explanation, synchronisation status, link to the job log | FR-018, FR-020 |
| Generic OIDC: Authorization, Token and User info endpoints, Client Scopes with placeholder | Text inputs | Matched, checked before sending, default scopes prefilled | FR-011, FR-018 |
| LDAP: Host (comma-separated, tooltip) | One text input | Improved: list of entries (pending decision, plan "Deviations" item 1) | FR-019 |
| LDAP: Port, Use SSL, Use StartTLS (switches that clear each other, tooltips) | Two switches | Improved: one choice with visible hints on ports (pending decision, plan "Deviations" item 2) | FR-019 |
| LDAP: Base DN, Username Field (placeholder `mail`), Filter, Attribute Field, Bind DN | Text inputs | Matched, checked before sending | FR-006, FR-018 |
| Test Connection button | Generic "Connection successful" or "Connection failed" alert | Improved: failure category with hint, tested address, stale marking, announced | FR-033 to FR-038 |
| Save button | Saves the whole form; last write wins | Improved: whole save in setup, section saves later, version tags | FR-012, FR-015, FR-017 |
| Remove button | Generic confirmation; refused while mailboxes use an external source | Improved: unavailable with reason, impact in the confirmation | FR-039 |
| "Identity provider in use" message (`danger.authsource_in_use`) | Alert without numbers | Improved: with the mailbox count and a link | FR-014 |

#### Login page and single sign-on

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| "Single Sign-On" button (`admin.iam_sso`) under "Other logins" on the mailbox-user page | Shown when a Keycloak or generic OIDC provider is configured; below the form; links to `/?iam_sso=1` | Improved: on the role-neutral and mailbox-user screens, after passkey sign-in and before the password form | FR-040, FR-043 |
| `force_sso` login option | Hides the password form, the passkey button and "Forgot password?" on the mailbox-user page, even when no single sign-on is available | Changed, deliberate deviation: the password form and "Forgot password?" are hidden as in legacy, but passkey sign-in stays, first (owner decision, as in UI 001 FR-007); Improved: ignored while single sign-on is unavailable, so that nobody is locked out | FR-041 |
| Return to `/` with code and state | State compared with the session; a mismatch is ignored silently; failures show "Login failed" | Improved: dedicated return screen, specific translated outcomes, code and state removed from the address | FR-045 to FR-049 |
| Redirect after single sign-on | Mailbox user area or webmail | Changed: requested app page or home screen, as for every sign-in of UI 001 | FR-047 |
| Provider token renewal on every page load; on failure, redirect to the provider | Silent redirect, the user may land on the provider's page unexpectedly | Improved: explanation on the sign-in screen with one action to sign in again | FR-052 |
| Sign-out | Ends the mailcow session only | Matched, with a note that the provider session remains | FR-053 |
| LDAP and Keycloak password sign-in in the normal form | Provider outages reported as wrong password | Improved: temporary-failure message | FR-050, FR-051 |
| OAuth2 authorisation login (`oauth2_request`) and consent page (`oauth/authorize.twig`) | Login and consent in the legacy PHP container | Dropped from this feature: the API keeps the OAuth2 endpoints and the consent page in the classic interface until feature 014 | Assumptions |

#### System › Configuration › OAuth2 Apps

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Information text (`admin.oauth2_info`, HTML) | Static text with endpoint paths | Matched: verbatim; Improved: copyable endpoint addresses (grant types and lifetimes pending, plan "Deviations" item 5) | FR-057 |
| Table: ID, Client ID, Client secret, Redirect URI, actions | DataTables, client-side search, table state in browser storage; secret shown in clear | Improved: secret never listed; server-side search, sort, active-token filter and token counts; state in the page address | FR-054, FR-055 |
| Toggle all, Quick actions Remove, Revoke all client tokens | One request for all selected items, no per-item result; only removal asks for confirmation | Improved: selection mode, confirmation for both (typed number for deletion), result per client, failed items kept for retry | FR-065 |
| Quick action Generate new client secret | New secrets for all selected clients, visible only later in the table | Dropped: each new secret must be shown once and copied individually; offered per client (pending decision, plan "Deviations" item 7) | FR-062 |
| Add OAuth2 client button and modal (one Redirect URI field, cached form) | Any text accepted, even unusable URIs; the secret appears later in the table | Improved: several redirect URIs, checked (pending decision, plan "Deviations" item 8); secret shown once in a dialog | FR-058, FR-059 |
| Edit action and Remove action per row | Edit page; generic confirmation | Improved: client page with every action; removal shows impact | FR-060, FR-064 |

#### OAuth2 client edit page

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Client ID (disabled) | Read-only | Matched, with copy action | FR-060 |
| Client secret (disabled, shown in clear) | Stored secret visible | Improved: hidden; a new one can be generated | FR-060, FR-062 |
| Scope (disabled) | Read-only `profile` | Matched | FR-060 |
| Redirect/Callback URL, Save | One text field; last write wins | Improved: list of URIs, checked, version tag | FR-058, FR-060, FR-061, FR-066 |

#### Not replaced by this feature

| Legacy element | Reason |
|---|---|
| LDAP Administrators tab (`admin/tab-ldap.twig`) | Not part of the legacy UI: its include is commented out in `admin.twig`. |
| Identity provider select of the mailbox forms | Mailbox authentication source belongs to UI feature 003. |
| LDAP password confirmation in the user's own settings | Belongs to UI feature 005. |
| "Disable mailcow login and show only Single Sign-On" option editor (Customize) | Editing login page options belongs to UI feature 013; this feature only honours the option. |
| Scheduled-job (cron) log with the synchronisation runs | Belongs to UI feature 011; linked from FR-020. |

### API Dependency

This feature depends on **mailcow REST API v2 feature 012, Identity providers and OAuth2 clients**
(`mailcow-rest-v2/specs/012-identity-providers-oauth2/spec.md`), and on the sign-in, sessions,
public configuration, error conventions and audit log of API feature 001, the audit target filters
of API feature 002, and the mailbox templates and mailbox list filters of API feature 003. The plan
pins the contract commit that contains feature 012 (`info.version` 0.1.0 does not identify it).

| Behaviour relied on | API requirement |
|---|---|
| Administrator-only access; "forbidden" for other roles | API 012 FR-001 to FR-003 |
| "Identity provider not configured" when nothing is stored; "not found" for clients | API 012 FR-004 |
| Configuration representation: type, settings, secret status, missing-template flags, completeness and missing settings, the app's return addresses, mailbox counts per external source, last change, version tag | API 012 FR-006 to FR-008 |
| Synchronisation status of Keycloak and LDAP, derived from the scheduled-job log | API 012 FR-062 |
| Capabilities: configured type, the app's return addresses before the first save, provider types and what each offers, defaults, field limits, provider time-out; OAuth2 endpoint paths, scope, grant types, token lifetimes, redirect URI length, bulk limit, page sizes | API 012 FR-064 |
| Whole save and change of individual settings, "created" or "updated" with representation | API 012 FR-009 |
| Field rules and normalisations | API 012 FR-010 to FR-013 |
| Write-only secrets, kept when omitted, required again when the receiving address changes | API 012 FR-014 |
| Type change refused while mailboxes use another external source; old type's settings removed | API 012 FR-015 |
| Removal refused while mailboxes have an external source | API 012 FR-017 |
| Synchronisation behaviour documented for the explanation | API 012 FR-018 |
| Connection test of candidate settings with result categories | API 012 FR-019 |
| Single sign-on availability in the public configuration; "force single sign-on" meaning | API 012 FR-020; API 001 FR-042 |
| Start (authorization address), completion (code and state), cancellation, "sign-in state invalid", "identity provider unavailable", "single sign-on not available" | API 012 FR-021 to FR-023 |
| Report of a provider-returned error with the state, which cancels the pending sign-in and is audited | API 012 FR-063 |
| Single sign-on sessions without second factor or pending actions; identity reports the method | API 012 FR-024 |
| "Identity provider session ended" | API 012 FR-026 |
| Sign-out does not sign out at the provider | API 012 FR-027 |
| Password sign-in of LDAP and Keycloak mailboxes through the normal sign-in, "identity provider unavailable" | API 012 FR-029 to FR-033 |
| OAuth2 client list with paging, search, sort and active-token filter; inspection | API 012 FR-041, FR-042 |
| Create with one-time secret; redirect URI rules; change; regenerate; revoke; delete | API 012 FR-043 to FR-048 |
| Documented OAuth2 endpoint behaviour for the information panel | API 012 FR-049 |
| Version tags and outdated refusal | API 012 FR-050, FR-051 |
| Audit records, target types, sign-in methods and failure reasons; the generic target type and target identifier filters | API 012 FR-052 to FR-054; API 001 FR-045 to FR-047; API 002 FR-058 |
| Problem types and validation rule codes | API 012 FR-057; API 001 FR-049, FR-055 |
| Bulk revoke-tokens and delete operations for OAuth2 clients, with per-item version tags and results, and the bulk limit | API 012 FR-060, FR-061, FR-064 |
| Mailbox templates list; mailbox list filter by authentication source | API 003 (mailbox templates, FR-013 there) |

**Gaps in the API that this feature does not work around** (to be specified in mailcow-rest-v2 if
wanted; until then the app behaves as stated). The former gaps of this spec (mailbox counts of
other external sources, synchronisation status, provider-returned errors and OAuth2 bulk actions)
were closed by API 012 and are covered by FR-005, FR-013, FR-020, FR-039, FR-048 and FR-065.

1. **No audit filter by sign-in method.** `GET /audit-events` cannot be narrowed to single sign-on,
   directory password or provider password sign-ins, and API 012 FR-054 adds no filter because the
   API conventions forbid feature-specific audit filters. A generic `authMethod` filter of API
   feature 001's audit log would serve every feature. Until then the app shows the method on each
   record and offers no method filter (FR-067, User Story 6 scenario 4).
2. **No audit filter by request.** A mailbox created or updated at sign-in refers to its sign-in
   record by request ID, but the audit log can be filtered neither by request ID nor read record by
   record. Until a `requestId` filter exists, the app links to the mailbox and to that account's
   sign-in records, filtered by actor and event type (FR-067).
3. **No create-only precondition for the first setup.** `PUT /identity-provider` accepts `If-Match`
   but no `If-None-Match: *`, so when two administrators set up a provider at the same time, the
   later save replaces the earlier one. The app sends no precondition for a first setup and, when
   the API answers "updated" instead of "created", tells the administrator that an existing
   configuration was replaced (FR-012).

### Key Entities *(include if feature involves data)*

- **Identity provider configuration**: the provider type, its settings grouped as in FR-006, secret
  status, completeness with the missing settings, the mapping with missing-template flags, the app's
  return addresses, the number of mailboxes per external source, the synchronisation status (Keycloak
  and LDAP), the last change and a version tag.
- **Identity provider capabilities**: whether and which configuration is stored, the app's return
  addresses, what each provider type offers, the defaults, the field limits and the provider
  time-out.
- **Mapping entry**: an attribute value and a mailbox template name.
- **Connection test result**: success, or a failure category with the provider's status code, plus
  the provider type, the tested address and the time. Held only on screen.
- **Single sign-on round trip** (app-side): the start, the provider's sign-in page, and the return
  with a code and a state or an error.
- **OAuth2 client**: identifier, client ID, redirect URIs, scope, active token counts and a version
  tag.
- **Client credentials**: the client ID and the one-time secret, shown only in the credentials
  dialog.
- **History entry**: an audit record about the configuration, a client or a sign-in through a
  provider.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator sets up, tests and saves an LDAP configuration on a 360 px wide phone
  in under 5 minutes.
- **SC-002**: A mailbox user with a provider account reaches the home screen from the sign-in screen
  with one tap in the app plus the provider's own sign-in, and the app's own steps add less than 3
  seconds in 95 % of attempts on a mid-range phone.
- **SC-003**: Automated scans of every screen, state, page address and device storage after the full
  test run find no client secret, bind password, provider code or state, and no OAuth2 client secret
  outside an open credentials dialog.
- **SC-004**: Automated accessibility checks report 0 WCAG 2.2 AA violations on every screen and
  state of this feature, at 360 px and at desktop width, in the light and dark themes.
- **SC-005**: No screen of this feature needs horizontal scrolling at 360 px width or at 400 % zoom
  on a 1,280 px wide screen.
- **SC-006**: 100 % of the problem types, validation rule codes, test result categories and audit
  failure reasons of API feature 012 are shown with the legacy message of the same meaning or with a
  new string that exists in English, Czech and Slovak, and no English API text is shown as a
  message.
- **SC-007**: For 100 % of the configurations in the parity test set, every value that the legacy
  Identity Provider tab shows, apart from secrets, is shown by the app with the same value.
- **SC-008**: An administrator adds an OAuth2 client and copies its credentials on a phone in under
  90 seconds.
- **SC-009**: 100 % of saves based on outdated data are stopped, and the entered values are still
  present afterwards.
- **SC-010**: In 100 % of the permission tests, domain administrators and mailbox users see no entry
  of this feature and get the "no access" state at its addresses.
- **SC-011**: In 100 % of the tests in which a signed-out user opens a link to a page of the app and
  signs in with single sign-on, they land on that page when site storage is available, and on the
  home screen otherwise.
- **SC-012**: In a moderated test with at least 5 administrators, at least 4 name the cause of a
  failed connection test (address, certificate, credentials or provider response) from its result
  alone, without help.
- **SC-013**: A bulk action on 20 OAuth2 clients reports an individual outcome for all 20, and only
  the clients that did not succeed stay selected for a retry.

## Assumptions

- UI feature 001 provides the shell, the navigation catalogue, the sign-in screens, session
  handling, the generic translated error handling (including 401, 403 and anti-forgery retries),
  status announcements and the audit log screen, which this feature extends (FR-067). UI feature 002
  establishes the conventions for version-tag conflicts and section editing. UI feature 003 provides
  the mailbox list with its authentication-source filter and the mailbox templates. UI feature 011
  provides the scheduled-job log, which FR-020 links to once it ships. This feature follows
  `docs/conventions.md`.
- The API 012 contract, including the single sign-on availability in the public configuration and
  the path of the app's sign-in return address, is merged before this feature is planned. Until the
  API is implemented, the feature is built and tested against a mock generated from the contract.
  UI 012 is implemented after UI features 001 to 011, and its smoke tests run once API 012 is
  implemented.
- The operator registers the app's return addresses at the provider (API 012 assumption). Until then
  single sign-on from the app fails on the provider's page.
- This feature is consistent with UI 001 FR-007 and FR-008. Under "force single sign-on", the
  password form and "Forgot password?" stay hidden and passkey sign-in stays first, as UI 001
  decided; this feature only adds the single sign-on action, in place of the notice that points to
  the classic interface (FR-041), and retires the temporary FR-008 hint, because the password
  sign-in it announced now works (FR-042). The rest of the UI 001 sign-in screens is unchanged.
- The OAuth2 authorize, token and profile endpoints and the consent page stay in the classic
  interface until feature 014. A user authorising an application signs in there. Their paths are
  fixed and documented in the API contract, so the information panel shows them on the current host
  name.
- mailcow stores no name for an OAuth2 client, so clients are recognised by their client ID and
  redirect URIs.
- Constitution IV 1.3.0 applies: legacy translation keys are used verbatim, for example `admin.iam`,
  `admin.iam_sso`, `admin.iam_server_url`, `admin.iam_realm`, `admin.iam_client_id`,
  `admin.iam_client_secret`, `admin.iam_version`, `admin.iam_mapping`, `admin.iam_default_template`,
  `admin.iam_default_template_description`, `admin.iam_rest_flow`, `admin.iam_login_provisioning`,
  `admin.iam_periodic_full_sync`, `admin.iam_import_users`, `admin.iam_sync_interval`,
  `admin.iam_test_connection`, `admin.iam_authorize_url`, `admin.iam_token_url`,
  `admin.iam_userinfo_url`, `admin.iam_client_scopes`, `admin.iam_host`, `admin.iam_port`,
  `admin.iam_use_ssl`, `admin.iam_use_tls`, `admin.iam_basedn`, `admin.iam_username_field`,
  `admin.filter`, `admin.iam_attribute_field`, `admin.iam_binddn`, `admin.iam_bindpass`,
  `admin.ignore_ssl_error`, `success.iam_test_connection`, `danger.iam_test_connection`,
  `danger.authsource_in_use`, `admin.oauth2_apps`, `admin.oauth2_add_client`,
  `admin.oauth2_client_id`, `admin.oauth2_redirect_uri`, `admin.oauth2_renew_secret`,
  `admin.oauth2_revoke_tokens`, `edit.client_id`, `edit.client_secret`, `edit.redirect_uri`,
  `edit.scope`, `user.attribute` and `mailbox.template`. Texts that name the product
  (`admin.iam_auth_flow_info`, `admin.iam_extra_permission`) or contain markup
  (`admin.iam_description`, `admin.oauth2_info`) are used verbatim too, as the installation's files
  have them. `admin.iam_redirect_url` labels the redirect URL field as in legacy; only the app's own
  return addresses next to it are a new string. The upstream Slovak file lacks most `admin.iam_*`
  keys; they fall back to `en-gb` as in the classic interface (the FeldHost fork's `sk-sk` has
  them), and none is translated by hand.
- **Out of scope**: running, triggering or scheduling the synchronisation; single sign-on for
  administrators and domain administrators; signing out at the provider; more than one provider;
  filling the OIDC endpoints from the provider's discovery document (the app never contacts the
  provider); editing the "force single sign-on" option (UI 013); the mailbox authentication source
  (UI 003); the OAuth2 endpoints and the consent page.
