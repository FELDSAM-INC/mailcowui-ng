# Feature Specification: Administrators and Domain Administrators

**Feature Branch**: `main` (no feature branches, constitution 1.1.0)

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Administrators and domain administrators for mailcowui-ng, the
mobile-first web app for mailcow-dockerized. Its only backend is mailcow REST API v2 feature 007
(administrator accounts, domain administrators with domain assignments and `da_acl` permission
flags, login-as / impersonation, webmail login on a user's behalf, domain-administrator single
sign-on tokens, and the audit trail of these). It replaces the legacy System › Configuration ›
Administrators and Domain administrators cards, the edit administrator and edit domain
administrator pages, the `da_acl` editor, the 'Login' and 'SOGo' buttons in the mailbox and
domain-administrator lists, the 'logged in as' indicator, and the domain-administrator SSO token
sign-in. Users: server administrators, and domain administrators who hold the login-as permission.
Stories: (P1) manage domain administrators and their domains; (P1) act as a domain administrator
or mailbox user with a persistent, clearly visible 'acting as' indicator naming the impersonator
and a one-tap return; (P2) set a domain administrator's permission flags; (P2) manage
administrator accounts with protection against removing the last administrator; (P2) one-time
domain-administrator sign-in links; (P3) open a mailbox's webmail on the user's behalf; (P3) trace
account changes and impersonations. Destructive actions need confirmation. Lists become cards on
phones. Every view has loading, empty and error states. Every screen works at 360 px, meets WCAG
2.2 AA and is translated into English, Czech and Slovak. Shell, sign-in and error handling come
from UI feature 001."

## Clarifications

### Session 2026-10-18

- Q: Where is "Sign in as" offered for mailbox users, given that the mailbox screens belong to UI
  feature 003? → A: This feature owns the action, its eligibility rules and its behaviour. It
  appears in the action menu of mailbox list entries and on the mailbox detail screen of UI feature
  003, and on the domain administrator list entries and detail screen of this feature. "Open webmail
  as" is placed the same way. (agent decision: the roadmap allocates login-as to 007 in both
  repositories, and API feature 003 lists the login-as and webmail buttons of the mailbox list as
  "not covered: feature 007". One owner keeps the rules in one place.)
- Q: Does starting "Sign in as" ask for confirmation? → A: No. It starts at once, the switch is
  announced to assistive technology, and the acting banner appears with the target's home screen.
  Returning is a single tap. (agent decision: the action changes no data, is reversible in one tap
  and is audited by the API. Legacy asks for no confirmation, and the action sits in an action menu,
  so accidental taps are unlikely.)
- Q: Where does the user land after returning to their own account, either explicitly or because
  the API ended the impersonation? → A: On the screen where they started acting, with its search,
  filters and page restored. When that screen is no longer available, on their home screen. (agent
  decision: legacy always redirects to the mailbox page, which loses the administrator's place in
  long lists. Returning to the origin is the expected behaviour for a temporary context switch.)
- Q: How does the app protect against removing the last administrator, and which status changes
  need a confirmation? → A: The own account's Remove control is disabled with its reason.
  Deactivating the last active administrator is disabled with its reason, and a multi-select
  deactivation that would leave none is stopped before any request. Deactivating the own account
  needs a confirmation warning that the session ends. Activating other accounts needs no
  confirmation; deactivating them needs one explicit confirmation that states the effect, and the
  result message states it too. The API's refusals are always shown. (Aligned by the plan:
  `docs/conventions.md` lists deactivating among the high-risk actions that need one explicit
  confirmation.) (agent decision: API 007 FR-028 and FR-029 define the rules, and legacy reports them only
  after submission. Constitution II requires confirmation for destructive actions; deactivation is
  reversible, and API 007 FR-035 keeps the API keys so that reactivation restores them.)
- Q: Are a new domain administrator's permission flags and forced sign-in requirements set in the
  creation form? → A: Yes. The creation form has the sections Account, Domains, Sign-in
  requirements and Permissions. Permissions start collapsed with the server defaults selected and a
  note saying so, and can be changed before saving. Everything is sent in one creation request.
  (agent decision: API 007 FR-017 and FR-018 accept forced flags and initial flags at creation.
  Setting them up front avoids a window in which defaults such as "login as mailbox user" apply.
  Collapsed sections keep the form short at 360 px, as constitution II asks.)
- Q: Does the password field have a confirmation ("repeat") field, as in legacy? → A: No. There is
  one password field with a show/hide control, a "Generate" control and the server's policy listed
  next to it. (agent decision: API 007 FR-016 takes the password once, without a confirmation field,
  following API 003 FR-024. Revealing the password replaces retyping it, which is the usual mobile
  practice.)
- Q: Are the legacy multi-select actions (activate, deactivate, suspend two-factor authentication,
  remove) kept? → A: Yes, for both lists. The app sends the API's bulk operation for the selected
  accounts, each with the version tag it read, shows that the action is running, and ends with a
  summary of each account's result. The own account is never part of a multi-select remove or
  deactivate. (agent decision: legacy parity. Aligned by the plan: API 007 FR-075 and FR-076, an
  orchestrator decision, replaced one request per account with bulk operations of up to 100
  accounts, which `docs/conventions.md` requires the UI to use.)
- Q: How are domain-administrator single sign-on tokens presented? → A: Two parts. A sign-in landing
  accepts a token from a link, removes it from the address bar and history, exchanges it for a
  session and opens the domain administrator's home. When the browser is already signed in, the
  landing first asks whether to continue as the link's account or stay as the current one, naming
  both. On a domain administrator's detail screen, an administrator can create a one-time sign-in
  link, shown with its remaining validity and a copy control but no "open" control. (Aligned by the
  plan: the link's account is named once the API can report it before the exchange; see API gaps.)
  (agent decision:
  API 007 US5 lets billing panels redirect to the new web app, which needs a landing. API 007 FR-063
  would silently replace an existing session; asking first keeps a link from switching accounts
  unnoticed, which the API permits. Opening the link in the administrator's own browser would
  replace their session, so only copying is offered.)
- Q: What happens in a browser tab whose request was prepared under a previous identity, after
  another tab started or ended acting? → A: The API refuses it (the anti-forgery token is renewed on
  every switch). The app then re-reads the identity, discards the data of the previous identity,
  says that the action was not carried out because the account changed in another tab, and shows
  the current identity's view. It never resends the request automatically. (agent decision: API 007
  renews the token precisely so that such requests do not run as the wrong account; resending them
  would defeat that.)
- Q: Which audit capabilities does this feature add to the app? → A: Each account's detail screen
  links to the audit log of UI feature 001 filtered to that account. The audit log screen shows, for
  records written while acting, both the impersonator and the impersonated account, and offers a
  filter by impersonated account. (agent decision: API 007 FR-069 adds these filters and fields, so
  the feature that introduces them owns their presentation.)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage domain administrators and their domains (Priority: P1)

An administrator opens Domain administrators on a phone. The accounts appear as cards showing the
username, the assigned domains, the two-factor status and the status. They search by username or
domain and filter by status, by domain or by two-factor status. They add a reseller: they enter a
username, pick two domains from a searchable picker, generate a password, require a password change
at the first sign-in, turn off "unlimited quota" in the permissions section, and save. Later they
open the account, assign a third domain, set a new password, suspend its second factors after the
reseller lost their phone, and finally remove a former reseller after confirming a dialog that names
the account and its domains. On a wide screen the same list is a table.

**Why this priority**: Domain administrators are how mailcow operators delegate domains to customers
and resellers. Without this screen, operators keep needing the legacy UI for a daily task.

**Independent Test**: Against the mock API, as an administrator at 360 px and at desktop width,
list, search, filter, create, edit, rename, suspend second factors of and remove domain
administrators, and check every request, every field error and every loading, empty and error
state.

**Acceptance Scenarios**:

1. **Given** an administrator on a 360 px screen and three domain administrators, **When** they
   open Domain administrators, **Then** they see three cards with username, assigned domains,
   two-factor status and status, with no horizontal scrolling.
2. **Given** the list, **When** the administrator searches for part of a domain name, **Then** only
   domain administrators with a matching assigned domain remain, and the search is kept when they
   open an account and come back.
3. **Given** the creation form, **When** the administrator enters a username, picks two domains,
   enters a password that meets the policy and saves, **Then** the account is created with the
   permissions shown in the form, a translated success message names it, and its detail screen
   opens.
4. **Given** the creation form, **When** no domain is picked or the username contains characters
   other than a–z, 0–9, `-`, `_` and `.`, **Then** saving is blocked and each problem is shown on
   its field. **When** the password misses a policy rule, **Then** the rule is marked as not met
   while typing, and the API's refusal names it on the password field.
5. **Given** a username that already exists as an administrator or domain administrator in any
   letter case, **When** the administrator saves, **Then** the username field shows a translated
   "already exists" message and the form keeps its values.
6. **Given** an existing domain administrator, **When** the administrator adds a domain, removes
   another and saves, **Then** the account shows exactly the new set of domains.
7. **Given** an account with active second factors, **When** the administrator chooses "Suspend
   two-factor authentication" and confirms, **Then** its two-factor status shows "suspended until
   next sign-in" and the confirmation said that passkeys keep working.
8. **Given** an existing domain administrator, **When** the administrator taps "Remove" and
   confirms the dialog that names the account and its domains, **Then** the account disappears from
   the list. **When** they cancel instead, **Then** nothing changes.
9. **Given** no domain administrators, **When** the administrator opens the list, **Then** an empty
   state explains what domain administrators are and offers "Add domain administrator".
10. **Given** the list fails to load, **When** the error appears, **Then** it is translated and
    offers a retry, and the rest of the app keeps working.

---

### User Story 2 - Act as a domain administrator or mailbox user, then return (Priority: P1)

An administrator helping a customer opens the mailbox list and chooses "Sign in as" on the
customer's mailbox. The app switches to the mailbox user's view. A banner at the top of every screen
says "Acting as alice@example.org (mailbox user)" and "Signed in as admin since 14:05", with a
"Return to admin" button. The administrator reproduces the customer's problem, taps "Return to
admin" and is back in the mailbox list exactly where they were. In the same way, an administrator
can act as a domain administrator from the domain administrator list, and a domain administrator
who holds the "login as mailbox user" permission can act as a mailbox user in their own domains.

**Why this priority**: Login-as is the daily support tool of mailcow operators and resellers.
Showing at all times who is really acting prevents changes made under the wrong identity.

**Independent Test**: Against the mock API, start acting as a mailbox user and as a domain
administrator from each entry point, visit every screen available to the target, and return, both
explicitly and through an "impersonation ended" refusal. Check that the banner is present on every
screen at both viewports, that no data of the previous identity is shown after either switch, and
that the user lands on the origin screen.

**Acceptance Scenarios**:

1. **Given** an administrator viewing the mailbox list, **When** they choose "Sign in as" on a
   mailbox, **Then** the app shows the mailbox user's home, the acting banner names the mailbox
   user, their role, the administrator and the start time, and screen readers announce the switch.
2. **Given** an administrator acting as a mailbox user, **When** they navigate to any screen,
   **Then** the acting banner stays visible at the top, never hidden in a menu, at 360 px and on
   desktop.
3. **Given** a user acting as someone, **When** they tap "Return to <own username>", **Then** the
   app shows their own identity, the banner disappears, and they land on the screen where they
   started, with its search and filters restored.
4. **Given** a domain administrator with "login as mailbox user" on, **When** they view mailboxes of
   their domains, **Then** each mailbox offers "Sign in as". **Given** a domain administrator with
   the flag off, **Then** no mailbox offers it.
5. **Given** an administrator, **When** they view the domain administrator list, **Then** each
   account offers "Sign in as", including inactive ones, and no administrator account offers it.
6. **Given** a user acting as someone, **When** they look for "Sign in as" anywhere, **Then** it is
   not offered.
7. **Given** a user acting as someone, **When** they choose "Sign out completely", **Then** the
   whole session ends and the sign-in screen appears.
8. **Given** a user acting as a mailbox user, **When** they open the screens for changing the
   password, passkeys, second factors or recovery e-mail, **Then** those controls are unavailable
   with the reason "Not available while acting as another user".
9. **Given** an administrator acting as a mailbox user whose mailbox another administrator deletes,
   **When** the next request is refused with "impersonation ended", **Then** the app explains that
   acting ended because the account is no longer available, removes the banner and opens the origin
   screen as the administrator.
10. **Given** two tabs of the same browser and acting started in one, **When** the other tab sends a
    change prepared under the previous identity, **Then** the change is not carried out, the tab
    explains why, and it then shows the acting banner and the target's view.

---

### User Story 3 - Set a domain administrator's permissions (Priority: P2)

On a domain administrator's detail screen, the administrator sees the 19 permission flags as
labelled switches, grouped by topic (mailbox settings, domain settings, spam and quarantine,
access), each with a short explanation. They allow the reseller to change protocol access, forbid
unlimited mailbox quotas, and save. The next time the reseller uses the app, the matching actions
appear or disappear.

**Why this priority**: New accounts get their permissions in the creation form, so this story is
only needed for later changes. It still replaces the legacy ACL box, which is hard to use on a
phone.

**Independent Test**: Against the mock API, open a domain administrator, change several flags, save,
reload, and check the request (only changed flags, with the version read), the success message, the
unsaved-changes guard, the outdated-version handling and the error state.

**Acceptance Scenarios**:

1. **Given** a domain administrator's detail screen, **When** the permissions section loads,
   **Then** every permission flag is shown as a switch with a translated label and explanation, in
   the groups of FR-028, reflecting its stored state.
2. **Given** changed switches, **When** the administrator saves, **Then** only the changed flags are
   sent, a translated success message appears, and reloading shows the saved state.
3. **Given** changed but unsaved switches, **When** the administrator tries to leave the screen,
   **Then** the app asks whether to discard the changes.
4. **Given** another administrator saved the same account in the meantime, **When** the
   administrator saves, **Then** the app explains that the account was changed elsewhere, keeps the
   switches as the administrator set them, and offers to load the current values.
5. **Given** a save that fails, **When** the error appears, **Then** the switches keep the
   administrator's choices and a translated message offers a retry.

---

### User Story 4 - Manage administrator accounts (Priority: P2)

An administrator opens Administrators. Each account shows its username, its two-factor status and
its status; their own account is marked "You". They add a colleague, deactivate an administrator on
leave, require another to set up two-factor authentication at the next sign-in, suspend a
locked-out colleague's second factors, and remove a former colleague after confirming. They cannot
remove their own account, and they cannot deactivate the last active administrator: both controls
are disabled and say why.

**Why this priority**: Administrator accounts change rarely, but the screen is needed to replace the
legacy UI, and the last-administrator protection keeps operators from locking themselves out.

**Independent Test**: Against the mock API, list, create, edit, rename, deactivate and remove
administrators, including the own account and the last active administrator, and check every
protection, confirmation and message.

**Acceptance Scenarios**:

1. **Given** an administrator on a 360 px screen, **When** they open Administrators, **Then** they
   see one card per account with username, two-factor status, status and a "You" marker on their
   own account.
2. **Given** the creation form, **When** they enter a valid username and a password that meets the
   policy and save, **Then** the account is created and a translated success message names it.
3. **Given** their own account, **When** they open its actions, **Then** "Remove" is disabled and
   the reason "You cannot remove the account you are signed in with" is shown.
4. **Given** an administrator who is the only active administrator, **When** they open their own
   account's actions or edit screen, **Then** deactivation is disabled and the reason "At least one
   administrator must stay active" is shown.
5. **Given** their own account and another active administrator, **When** they deactivate their own
   account, **Then** a confirmation warns that their session ends, and confirming saves the change
   and then shows the sign-in screen with an explanation.
6. **Given** their own account, **When** they rename it, **Then** a confirmation states the new
   username to use for the next sign-in, and after saving they stay signed in under the new name.
7. **Given** a deactivation or removal that the API refuses as "last active administrator" (for
   example because of a concurrent change), **When** the refusal arrives, **Then** its translated
   message is shown and the account keeps its previous state.

---

### User Story 5 - Sign in a domain administrator with a one-time link (Priority: P2)

A billing portal sends a reseller to the new app with a one-time sign-in link. The reseller lands
directly in their domain administrator home without typing a password. Separately, an administrator
can create such a link on a domain administrator's detail screen, for example to test a billing
integration, and copy it before it expires.

**Why this priority**: Billing and hosting panels use single sign-on tokens today and need a target
in the new app to migrate, but password sign-in works without it.

**Independent Test**: Against the mock API, open the landing with a valid, an expired, a used and a
malformed token, signed out and signed in as another account, and create and copy a link as an
administrator, for an active and for an inactive domain administrator.

**Acceptance Scenarios**:

1. **Given** no session and a valid one-time link, **When** the domain administrator opens it,
   **Then** they are signed in, the token no longer appears in the address bar or history, and
   their home screen appears.
2. **Given** an expired, already used or malformed link, **When** it is opened, **Then** the sign-in
   screen shows "This sign-in link is invalid or has expired" and offers normal sign-in.
3. **Given** a browser already signed in as another account, **When** a valid link is opened,
   **Then** the app asks whether to continue with the link or stay signed in as the current
   account, naming the current account (and the link's domain administrator once the API can
   report it, see API gaps), and acts only on the user's choice.
4. **Given** a domain administrator flagged for a forced password change, **When** they open a valid
   link, **Then** they are signed in to the restricted session that UI feature 001 handles.
5. **Given** an administrator on an active domain administrator's detail screen, **When** they
   choose "Create sign-in link", **Then** the link is shown with a copy control and its remaining
   validity counting down, and once it expires the app says so and offers to create a new one.
6. **Given** an inactive domain administrator, **When** the administrator opens its detail screen,
   **Then** "Create sign-in link" is disabled with the reason that the account is inactive.

---

### User Story 6 - Open a mailbox's webmail on the user's behalf (Priority: P3)

On a server whose operator allows administrators to open users' webmail, an administrator, or a
reseller with "login as mailbox user", opens the webmail of a mailbox in their scope directly from
the mailbox list or the mailbox detail screen. The webmail opens in a new tab, and the app stays
where it was. While acting as the user, webmail is not available, because the API refuses every
webmail sign-in during an impersonation.

**Why this priority**: The operator setting is off by default, and only some installations use it.

**Independent Test**: Against the mock API, with the setting reported on and off, check where "Open
webmail as" appears for an administrator and for domain administrators with and without the flag,
check that webmail is unavailable while acting, and check the refusal messages.

**Acceptance Scenarios**:

1. **Given** the setting on and an administrator viewing the mailbox list, **When** they choose
   "Open webmail as" on an active mailbox, **Then** the user's webmail opens in a new tab and the app
   stays on the list.
2. **Given** the setting off, **When** an administrator views the mailbox list, **Then** no "Open
   webmail as" is offered.
3. **Given** the setting on and a mailbox that cannot use webmail, **When** "Open webmail as" is
   chosen, **Then** the API's refusal is shown as a translated message.
4. **Given** the setting on and an administrator acting as a mailbox user, **When** they look at the
   webmail control on that user's home, **Then** it is unavailable with the reason "Not available
   while acting as another user", and no "Open webmail as" is offered anywhere.

---

### User Story 7 - Trace account changes and impersonations (Priority: P3)

An administrator investigating an incident opens a domain administrator's detail screen and follows
"View history" to the audit log filtered to that account. They see every change to it: who made it,
when and what changed, with passwords recorded only as changed. They filter the audit log by
impersonated account to see everything done on a customer's behalf, and each such record shows both
the impersonator and the impersonated account.

**Why this priority**: Accounts can be managed without reading their history, but operators need it
when something goes wrong.

**Independent Test**: Against the mock API, follow "View history" from an administrator and a domain
administrator, filter by impersonated account, and check that records written while acting show both
accounts.

**Acceptance Scenarios**:

1. **Given** an account's detail screen, **When** the administrator follows "View history", **Then**
   the audit log opens filtered to that account.
2. **Given** audit records written while acting, **When** they are listed, **Then** each shows the
   impersonator as the actor and the impersonated account, marked as done while acting.
3. **Given** the audit log, **When** the administrator filters by impersonated account
   `bob@a.example`, **Then** only records written while acting as that account remain.

---

### Edge Cases

- **Impersonation ended by the API**: when the target is deleted or renamed, leaves the
  impersonator's scope, or the impersonating domain administrator loses "login as mailbox user", the
  next request is refused with "impersonation ended" and was not carried out. The app says so,
  discards the target's data, removes the banner and opens the origin screen as the impersonator.
- **Impersonator deactivated or deleted while acting**: the whole session ends. The app shows the
  sign-in screen with UI feature 001's session-ended message.
- **Screen not available after a switch**: when the new identity cannot use the current screen, the
  app opens that identity's home screen instead of a forbidden error.
- **Data from the previous identity**: on every switch into or out of acting, all data loaded for
  the previous identity is discarded before anything is shown, including lists, details, cached
  pages and form drafts.
- **Several tabs**: acting applies to the browser session, so every tab follows it. A tab that
  notices a different identity, or whose request is refused by the anti-forgery check after a
  switch, re-reads the identity, shows or hides the banner, says that its last action was not
  carried out, and moves to the home screen when its current screen is unavailable.
- **Inactive target**: inactive mailboxes, mailboxes in inactive domains and inactive domain
  administrators can be acted as (legacy behaviour). The target's forced password change or
  second-factor setup does not restrict the acting session.
- **Long usernames in the banner**: on a 360 px screen, long usernames are shortened with an ellipsis
  in the middle, keeping the domain visible, and the full text stays available to assistive
  technology and on focus or tap.
- **Domain administrator without any domain** (left by legacy): the card shows a "No domains"
  warning. It can be inspected, acted as and removed, and any save of its domains needs at least one.
- **Assignment that is not a domain** (an alias domain name, a removed domain, or legacy's `ALL`):
  shown with a "not a domain" warning and the note that it grants no access and is dropped at the
  next save of the domains.
- **Assignment status differing from the account status** (left by legacy tools): the assignment
  shows its own status badge.
- **Domain administrator without a permission record** (left by legacy): every switch reads as off,
  as the API reports it, and saving creates the record.
- **Many domains**: the domain picker searches the server's domain list, shows the selected domains
  as removable chips, and stays usable with thousands of domains. A card shows the first three
  assigned domains and "+N more".
- **Domain removed while the form is open**: the save is refused with a field error on the domain
  picker naming the entry, and the form keeps the other values.
- **Concurrent edit**: when the API reports an edit as outdated, the app says so, keeps the user's
  input, and offers to load the current values.
- **Renaming another account**: the confirmation states that the account's open sessions and any
  acting session on it end. Renaming the own account keeps the session under the new name.
- **Self-deactivation**: after the confirmed save, the next request reveals the ended session, and
  the app shows the sign-in screen with an explanation.
- **Removing an account that someone is acting as**: the removal goes through, and the other user's
  acting session ends as in the first edge case.
- **Domain administrator removed with its last domain** (feature 002 deletes such accounts): it
  disappears from the list on the next load, and an open detail screen shows "not found" with a link
  back to the list.
- **API key or restricted session**: this feature's screens need a full signed-in session. A
  restricted session (pending password change or second-factor setup) is handled by UI feature 001.
- **Webmail not possible for a mailbox** (inactive, login disabled, inactive domain, webmail disabled
  on the server): the API's refusal is shown. The app does not open an empty tab, and when the
  browser blocks the new tab it offers a link to open it.
- **Multi-select partly fails**: the summary lists each account with its translated result, the
  succeeded ones are updated in the list, and the failed ones stay selected so that the action can
  be retried.
- **One-time link opened twice** (for example by a mail scanner that previews links): the second
  opening shows the invalid-or-expired message. The landing exchanges the token only when the page
  is opened in a browser by the user, never on prefetch.
- **One-time link created but not copied in time**: the countdown reaches zero, the link is marked
  expired, and the copy control is disabled.
- **One-time link sign-in throttled**: the throttling message of UI feature 001 is shown with its
  retry hint.
- **Offline or network failure during a save**: the form keeps its values, shows a translated network
  error and offers a retry, and the action is never reported as done.

## Requirements *(mandatory)*

### Functional Requirements

#### Access and navigation

- **FR-001**: The Administrators and Domain administrators sections MUST be offered in the
  navigation only to administrators, as items of the system area defined by UI feature 001. Opening
  their screens with any other role MUST show feature 001's forbidden state.
- **FR-002**: The app MUST derive every control of this feature from the identity, scope and
  permission flags the API reports, and MUST treat hiding as a convenience only: every refusal from
  the API MUST still be handled (constitution V).
- **FR-003**: Every screen of this feature MUST have a direct, shareable address, so that reloading
  or sharing it shows the same screen, including the selected account, section, search and filters.
- **FR-004**: Every list and detail screen MUST show a loading state, an empty state with a relevant
  primary action, and an error state with a translated message and a retry control.

#### Domain administrator list

- **FR-005**: The domain administrator list MUST show for each account: username, assigned domains
  (the first three and "+N more", with warnings for FR-022's cases), two-factor status (none,
  active, or suspended until next sign-in), status, and an action menu with Edit, Sign in as
  (FR-040), Activate or Deactivate, Suspend two-factor authentication (when active), and Remove.
- **FR-006**: Below 768 px the list MUST render as cards, the whole card opening the detail screen.
  From 768 px it MUST render as a table (`docs/conventions.md`). Neither layout MAY need horizontal
  scrolling.
- **FR-007**: The list MUST offer a search on usernames and assigned domain names; filters by
  status, two-factor status, pending sign-in requirement (forced password change, forced
  two-factor setup), assigned domain, and the value of one permission flag; sorting by username,
  status, creation time, modification time and number of domains; and pagination with the total.
  These MUST be kept when the user opens an account and returns.
- **FR-008**: The list MUST offer "Add domain administrator" as its primary action, reachable with
  one tap at 360 px.
- **FR-009**: The list MUST support selecting several accounts, through a selection mode on phones
  and checkboxes on wide screens, and applying Activate, Deactivate, Suspend two-factor
  authentication or Remove to all of them. Remove MUST need one confirmation that lists the selected
  accounts and asks for their number to be typed (`docs/conventions.md`).
- **FR-010**: A multi-select action MUST send the API's bulk operation for the selected accounts, each
  with the version tag it read and at most the bulk limit the API reports. It MUST show that the
  action is running, and end with a summary of each account's translated result. Failed, refused and
  outdated accounts MUST stay selected. A dropped connection MUST be reported as "outcome unknown"
  and never retried.

#### Creating a domain administrator

- **FR-011**: The creation form MUST have the sections Account (username, password, active, on by
  default), Domains (one or more), Sign-in requirements (force password change, force two-factor
  setup, both off by default) and Permissions (FR-028), and MUST send everything in one request. On
  phones it MUST be a full screen, not a modal dialog.
- **FR-012**: The username MUST be validated before submission: required, at most the length the
  API reports (255 characters), only a–z, 0–9, `-`, `_` and `.`, at least one letter or digit, and not `api` in any letter case.
  Leading and trailing spaces MUST be removed and upper-case letters converted to lower case when
  the field loses focus, with a hint that explains the allowed characters.
- **FR-013**: The domain picker MUST let the user search the server's primary domains, select
  several, and see the selection as removable chips. On phones it MUST open as a full-screen list
  with a search field and checkboxes. At least one domain MUST be selected.
- **FR-014**: The password field MUST be a single field with show and hide controls. It MUST list the
  server's password policy as read from the API and mark each rule as met or not met while the user
  types, without blocking submission: the API decides, and stores a value that begins with a
  recognised hash-scheme prefix as given, as in UI feature 003. It MUST offer "Generate", which fills the field with a random password that meets the policy, reveals it and
  offers to copy it. Passwords MUST NOT be kept anywhere after the form is left.
- **FR-015**: The Permissions section of the creation form MUST start collapsed, with the server's
  default flags (from the API's account capabilities) selected and a note that the defaults apply.
  Expanding it MUST show the switches of
  FR-028, and only flags that differ from the defaults need to be sent.
- **FR-016**: Errors returned by the API MUST appear on the matching fields, using the
  machine-readable rule codes and their parameters to build translated messages (API feature 001,
  FR-055): each unmet password rule on the password field, each refused domain on the domain picker,
  and "already exists" on the username field.
- **FR-017**: After a successful creation, the app MUST show a translated success message naming the
  account and open its detail screen.

#### Domain administrator detail and editing

- **FR-018**: The detail screen MUST show the account in sections: Account (username, status,
  creation and modification dates), Domains, Sign-in and security (two-factor status, number of
  passkeys, sign-in requirements, FR-024), Permissions (FR-027 to FR-031), One-time sign-in link
  (FR-062) and a "View history" link (FR-071). On phones the sections MUST be stacked and reachable
  from a section index.
- **FR-019**: Each editable section MUST have its own save control and MUST send only that section's
  changed values, together with the version tag it read. Leaving a screen with unsaved changes in any
  section MUST ask for confirmation.
- **FR-020**: The Account section MUST allow renaming (rules of FR-012), changing the status, and
  setting a new password (FR-014). Leaving the password empty MUST keep the current password.
- **FR-021**: Renaming another account MUST need a confirmation that states that its open sessions
  and any acting session on it end. Renaming the own account MUST need a confirmation that states the
  new username for the next sign-in.
- **FR-022**: The Domains section MUST use the picker of FR-013, MUST refuse to save an empty
  selection, and MUST link each assigned domain to its screen in UI feature 002. An assignment that
  is not a domain MUST be shown with a warning that it grants no access and is dropped at the next
  save. An assignment whose status differs from the account's MUST show its own status.
- **FR-023**: The Sign-in and security section MUST allow switching "Force password change at next
  sign-in" and "Force two-factor setup at next sign-in", each with its explanation, using the product
  name from the branding configuration where legacy shows it.
- **FR-024**: When the account has active second factors, the section MUST offer "Suspend two-factor
  authentication until next sign-in", after a confirmation that states that the account can then
  sign in with its password alone until its next successful sign-in, and that passkeys keep working.

#### Removing and changing status

- **FR-025**: Removing a domain administrator MUST need a confirmation dialog that names the account,
  lists its assigned domains, and states that its API keys are revoked permanently, its passkeys and
  second factors are removed, its sessions end, and the domains and their mailboxes stay. The
  confirm control MUST be labelled with the action ("Remove domain administrator"), not "OK". After
  the removal the app MUST return to the list and announce the result.
- **FR-026**: Activating another account MUST need no confirmation. Deactivating another account,
  alone or in a multi-select, MUST need one explicit confirmation that states the effect: the
  account's sessions end and its API keys stop working until it is activated again. The result
  message MUST state the effect too. A refusal MUST restore the previous state.

#### Domain administrator permissions

- **FR-027**: The Permissions section MUST show the account's permission flags as labelled switches
  with a one-line explanation each, reflecting their stored state.
- **FR-028**: The switches MUST be grouped, each group as a labelled set:
  - Mailbox settings: protocol access, allowed SMTP hosts, unlimited quota, mailbox relayhost,
    webmail access management, app passwords, push notifications, sync jobs, filters;
  - Domain settings: domain description, domain relayhost, alias domains, aliases with external
    destinations, extending sender permissions with external addresses, BCC maps;
  - Spam and quarantine: deny and allow lists, quarantine actions, rate limits;
  - Access: log in as mailbox user.

  A flag the API reports that is not in this list MUST still be shown, in an "Other" group.
- **FR-029**: Saving MUST send only the changed flags with the version tag read, and MUST show a
  translated success or error message. A failed save MUST keep the user's choices.
- **FR-030**: Labels MUST reuse the legacy `acl.*` translation keys where the meaning is unchanged.
  Explanations use new keys.
- **FR-031**: Permission flags MUST NOT be offered for administrator accounts, which always hold
  every permission.

#### Administrator accounts

- **FR-032**: The administrator list MUST show for each account: username, two-factor status,
  status, a "You" marker on the own account, and an action menu with Edit, Activate or Deactivate,
  Suspend two-factor authentication (when active), and Remove. It MUST follow FR-006, FR-008 (with
  "Add administrator"), FR-009 and FR-010, and offer search by username, the filters of FR-007 that
  apply to administrators (status, two-factor status, pending sign-in requirement), and the sorts of
  FR-007 except the number of domains.
- **FR-033**: The creation form MUST have the Account and Sign-in requirements sections of FR-011,
  with the rules of FR-012, FR-014 and FR-016.
- **FR-034**: The administrator detail screen MUST offer the Account and Sign-in and security
  sections (FR-019 to FR-021, FR-023, FR-024) and the "View history" link (FR-071).
- **FR-035**: The own account's Remove control MUST be disabled everywhere, with the visible reason
  "You cannot remove the account you are signed in with". The own account MUST be left out of a
  multi-select remove or deactivate, and the summary MUST say so.
- **FR-036**: When exactly one administrator is active, that account's deactivation MUST be disabled
  everywhere, with the visible reason "At least one administrator must stay active". A multi-select
  deactivation that would leave no active administrator MUST be stopped before any request is sent,
  with the same reason.
- **FR-037**: Deactivating the own account MUST need a confirmation that warns that the current
  session ends. After the save, the app MUST show the sign-in screen with a translated explanation.
- **FR-038**: Removing an administrator MUST need a confirmation dialog that names the account and
  states that its API keys are revoked permanently and its passkeys and second factors are removed.
- **FR-039**: The app MUST show the API's "last active administrator" and "cannot delete own
  account" refusals as translated messages, even when its own checks did not predict them, and MUST
  then show the account's actual state.

#### Sign in as (login-as)

- **FR-040**: An administrator MUST be offered "Sign in as" for every domain administrator and every
  mailbox user, whether active or not. A domain administrator MUST be offered it only for mailbox
  users of the domains in their scope, and only when their effective permissions include "login as
  mailbox user". Nobody MUST be offered it for administrator accounts, for resources, or while
  acting.
- **FR-041**: "Sign in as" MUST be offered in the action menu of the domain administrator list
  entries and on the domain administrator detail screen of this feature, and in the action menu of
  the mailbox list entries and on the mailbox detail screen of UI feature 003.
- **FR-042**: "Sign in as" MUST NOT be offered when the session cannot start acting: with a
  restricted session or while already acting. A refusal of the API ("already impersonating",
  forbidden, not found) MUST be shown as a translated message and leave the user in their own view.
- **FR-043**: Choosing "Sign in as" MUST start acting at once, without confirmation. The app MUST
  remember the screen it was started from with its search, filters and page, discard all data of the
  own identity (FR-052), adopt the identity the API returns, and open the target's home screen.
- **FR-044**: While acting, every screen MUST show an acting banner at the top of the viewport that:
  - names the target's username and role ("Acting as alice@example.org, mailbox user");
  - names the impersonator's username and the time acting started ("Signed in as admin since
    14:05");
  - offers a "Return to <impersonator>" control of at least 44×44 CSS px;
  - stays visible while scrolling and is never collapsed into a menu, at every viewport width;
  - pushes the content down instead of covering it;
  - uses a colour treatment distinct from the normal header in both themes, together with an icon
    and text, so that the state never depends on colour alone.
- **FR-045**: The acting banner MUST be a labelled page region. Starting and ending acting MUST be
  announced to screen readers. The page title MUST be prefixed with the acting indicator, so that the
  state is visible in the browser's tab list.
- **FR-046**: "Return to <impersonator>" MUST end acting with one tap and no confirmation, discard all
  data of the target identity (FR-052), and open the remembered origin screen with its search,
  filters and page restored, or the own home screen when the origin is not available.
- **FR-047**: While acting, the account menu's sign-out MUST be labelled "Sign out completely", MUST
  end the whole session and MUST open the sign-in screen.
- **FR-048**: While acting, the navigation, screens and actions MUST follow the identity, scope and
  permissions the API reports for the acting session, never the impersonator's own role.
- **FR-049**: While acting, the controls that manage the signed-in account's own credentials
  (password change, passkeys, second factors, recovery e-mail, in UI features 001 and 005) MUST be
  unavailable with the visible reason "Not available while acting as another user". A "not allowed
  while impersonating" refusal MUST be shown with the same message.
- **FR-050**: While acting, the language and theme controls MUST remain available and MUST change
  the impersonator's own preferences, as the API defines. The app MUST keep the impersonator's
  language and theme while acting.
- **FR-051**: When a request is refused with "impersonation ended", the app MUST tell the user that
  the request was not carried out and that acting ended because the account is no longer available
  to them, MUST discard the target's data, and MUST then behave as in FR-046.
- **FR-052**: On every switch into or out of acting, and whenever the app notices that the identity
  changed, all data loaded for the previous identity MUST be discarded before anything for the new
  identity is shown.
- **FR-053**: When a request is refused by the anti-forgery check after the identity changed in
  another tab, the app MUST re-read the identity, apply FR-052, say that the action was not carried
  out because the account changed in another tab, and MUST NOT resend the request.
- **FR-054**: Every tab of the browser MUST reflect a change of identity when another tab announces
  it, which also reaches background tabs by the time they regain focus, and otherwise at the latest
  on its next write or refused request. No automatic request is made on focus, because UI feature
  001 forbids automatic requests that would keep an idle session alive (FR-033 there).

#### Webmail on a user's behalf

- **FR-055**: When the identity reports that the operator allows webmail login on a user's behalf,
  "Open webmail as" MUST be offered next to "Sign in as" for mailbox users, with the eligibility
  rules of FR-040 except that it is not offered while acting. It MUST NOT be offered when the setting
  is off.
- **FR-056**: "Open webmail as" MUST obtain the webmail sign-in from the API and open it in a new
  tab, leaving the app on its current screen. When the browser blocks the new tab, the app MUST offer
  a link that opens it. Refusals (webmail login on behalf disabled, mailbox cannot use webmail, not
  found) MUST be shown as translated messages, and no empty tab MAY remain open.
- **FR-057**: While acting as a mailbox user, the webmail control on that user's home screen (UI
  feature 005) MUST be unavailable with the visible reason "Not available while acting as another
  user", because the API refuses every webmail sign-in during an impersonation (API 007 FR-049 and
  FR-054).

#### One-time sign-in links

- **FR-058**: The app MUST offer a sign-in landing with a stable, documented address that accepts a
  domain-administrator single sign-on token from a link and exchanges it with the API for a session.
- **FR-059**: The landing MUST remove the token from the address bar and from the browser history
  before anything else is shown, and MUST exchange it only when the user opens the page, never on a
  link prefetch.
- **FR-060**: Without a session, a valid token MUST sign the domain administrator in and open their
  home screen, or the restricted session of UI feature 001 when the account has pending actions.
  With an existing session, the landing MUST first ask whether to continue with the link or to stay
  signed in as the current account, naming the current account and, once the API can report it
  before the exchange, the token's domain administrator (see API gaps). It MUST exchange the token
  only after "Continue".
- **FR-061**: A refused token MUST lead to the sign-in screen with the translated message "This
  sign-in link is invalid or has expired", without saying why it was refused. Throttling MUST show
  UI feature 001's throttling message.
- **FR-062**: On an active domain administrator's detail screen, administrators MUST be able to
  create a one-time sign-in link. The app MUST show the full link built from the landing address and
  the token, a copy control whose result is announced to screen readers, the remaining validity as a
  countdown from the expiry the API returns, and a warning that opening the link in the same browser
  replaces the current session. It MUST NOT offer to open the link. For an inactive account, the
  control MUST be disabled with the reason that the account is inactive.
- **FR-063**: When the countdown reaches zero, the link MUST be shown as expired, the copy control
  MUST be disabled, and "Create new link" MUST be offered. The link MUST be forgotten when the user
  leaves the screen.

#### Errors and concurrency

- **FR-064**: Every refusal of this feature MUST be shown as a translated message chosen by the
  problem type and rule codes the API returns, never by the English detail text. Field errors MUST
  appear on their fields, and other errors in a dismissible message that screen readers announce.
- **FR-065**: The app MUST provide dedicated translated messages at least for these problems of API
  feature 007: account already exists, last active administrator, cannot delete own account, already
  impersonating, impersonation ended, not allowed while impersonating, webmail login on behalf
  disabled, account inactive, outdated version; and for these validation rules: username characters
  and length, reserved username, domain not found or not a primary domain, missing domain, and each
  password policy rule.
- **FR-066**: Every edit, permission change, second-factor suspension and removal MUST send the
  version tag it read. An outdated refusal MUST keep the user's input, explain that the account was
  changed elsewhere, and offer to load the current values.
- **FR-067**: A failed save MUST never be reported as done. The form MUST keep its values and offer a
  retry.

#### Accessibility, internationalisation and mobile

- **FR-068**: Every screen and dialog MUST be fully operable by keyboard and touch, with visible
  focus, labelled controls, focus moved into each dialog and back to its trigger when it closes, and
  touch targets of at least 44×44 CSS px.
- **FR-069**: Status and two-factor status MUST be conveyed by text or an accessible name, never by
  colour or icon alone.
- **FR-070**: Results of saves, removals, multi-select actions, copies and switches of identity MUST
  be announced to screen readers.
- **FR-071**: Each administrator and domain administrator detail screen MUST link to the audit log of
  UI feature 001 filtered to that account. The audit log MUST show, for records written while acting,
  the impersonator as the actor and the impersonated account, marked as done while acting, and MUST
  offer a filter by impersonated account.
- **FR-072**: Every user-facing text MUST come from the translation files in English, Czech and
  Slovak. Legacy keys MUST be reused where the meaning is unchanged (see Legacy Parity), and brand
  names MUST come from the branding configuration.
- **FR-073**: Dates and times MUST be formatted in the user's locale.
- **FR-074**: Every screen MUST be designed first for a 360 px viewport and MUST pass automated
  accessibility checks with no violation in both themes.
- **FR-075**: Usernames, domain names and other API data MUST be shown as plain text, never as
  markup.

### Legacy Parity

Legacy reference: FeldHost fork of mailcow-dockerized (`feldhost-202609a`, upstream tag `2026-09a`),
`data/web/templates/admin/tab-config-admins.twig`, `templates/modals/admin.twig` (add
administrator, add domain administrator), `templates/edit/admin.twig`,
`templates/edit/domainadmin.twig`, `templates/base.twig` (logged-in-as item),
`templates/user/tab-user-auth.twig` (webmail button while acting), `js/site/admin.js`
(`draw_admins`, `draw_domain_admins`, `process_table_data`), `js/site/mailbox.js` (login-as and
SOGo buttons), `inc/triggers.global.inc.php` (dual login), `inc/sessions.inc.php` (sign-out during
dual login), `inc/triggers.domainadmin.inc.php` and `inc/functions.domain_admin.inc.php` (SSO
token), `sogo-auth.php` (webmail on a user's behalf).

| Legacy screen or element | Outcome | Requirements | Reason |
|---|---|---|---|
| Administrators card: table with username, TFA, active, edit and remove buttons | Improved | FR-032, FR-006 | Cards on phones instead of collapsed DataTables rows, search and filters |
| Own account marker (`item.usr` is computed in `admin.js` but never displayed) | Improved | FR-032 | Users see which account they are signed in with |
| Administrator multi-select: toggle all, activate, deactivate, disable TFA, remove | Matched | FR-009, FR-010, FR-035, FR-036 | Per-account results instead of one combined message |
| Add administrator modal: username, password, repeat, generate, active | Improved | FR-033, FR-011, FR-012, FR-014 | Full screen on phones, policy shown before submission, sign-in requirements at creation, one revealable password field |
| Edit administrator page: rename, password, active, disable TFA, force 2FA, force password update | Matched | FR-034, FR-020, FR-021, FR-023, FR-024 | Same fields, in sections with their own save |
| "Cannot delete logged in user" and "Cannot deactivate last active admin" after submission | Improved | FR-035 to FR-039 | Controls disabled with their reason beforehand, API refusals still shown |
| Own two-factor keys and FIDO2 keys on the administrators tab | Moved | — | Passkeys: UI feature 001. Second factors: UI feature 005 |
| API section (legacy read-only and read-write keys) | Moved | — | UI feature 001 manages the new API keys. Legacy `/api/v1` keys stay in the legacy UI |
| CORS settings in the API section | Moved | — | UI feature 013 |
| Domain administrators card: table with username, assigned domains, TFA, active, edit, remove, Login | Improved | FR-005 to FR-008 | Cards on phones, domain search and filters, translated actions |
| Domain administrator multi-select: toggle all, activate, deactivate, disable TFA, remove | Matched | FR-009, FR-010 | Per-account results |
| Add domain administrator modal: username, searchable domain multi-select, password, repeat, generate, active | Improved | FR-011 to FR-017 | Full-screen picker with chips, sign-in requirements and permissions in the same form |
| Edit domain administrator page: rename, domains, password, active, disable TFA, force 2FA, force password update | Matched | FR-018 to FR-024 | Same fields, in sections |
| Edit domain administrator: an empty domain selection silently keeps the old domains | Improved | FR-022 | An empty selection is refused visibly |
| `da_acl` multi-select box (10 rows, Ctrl-click to select) | Improved | FR-027 to FR-031 | Grouped, labelled switches with explanations, usable by touch and screen readers |
| TFA column showing only on or off | Improved | FR-005, FR-032 | Distinguishes none, active and suspended |
| "Login" button on domain administrator rows (hard-coded English) | Improved | FR-040, FR-041, FR-043 | Translated "Sign in as" |
| "Login" button on mailbox rows for administrators and domain administrators with `login_as` | Matched | FR-040 to FR-043 | Placed in UI feature 003's screens |
| "SOGo" button on mailbox rows (`ALLOW_ADMIN_EMAIL_LOGIN`) | Matched | FR-055, FR-056 | Shown only when the identity reports the setting on |
| Dual login started by a `?duallogin=` link | Improved | FR-043 | Started only by an explicit action, so a crafted link cannot switch identity |
| Navbar item "username (impersonator)" | Improved | FR-044, FR-045 | Persistent banner with roles, start time, return control and announcements |
| Sign-out during dual login returns to the original account | Changed | FR-046, FR-047 | Dedicated one-tap return; sign-out ends the whole session (API 007 FR-051) |
| After return, redirect to the mailbox page | Improved | FR-046 | Back to the origin screen with its state |
| Nested dual login silently ignored | Improved | FR-040, FR-042 | Not offered while acting, API refusal translated |
| Own password and second-factor forms usable while acting | Changed | FR-049 | The API refuses them while acting (API 007 FR-049) |
| Webmail button on the user page while acting, disabled when admin webmail login is off | Changed | FR-057 | Unavailable while acting, with its reason: the API refuses every webmail sign-in during an impersonation (API 007 FR-049) |
| `?sso_token=` sign-in on the domain administrator page | Improved | FR-058 to FR-061 | Token removed from the address bar, no silent account switch |
| `sso/domain-admin` token issuance (legacy: `/api/v1` only, no screen) | New | FR-062, FR-063 | Lets administrators test billing integrations |
| Password "generate" link (`pwgen`) | Matched | FR-014 | Generated passwords meet the server policy |
| Password repeat field | Dropped | FR-014 | The API takes the password once; a show control replaces retyping |
| Have I Been Pwned check on password fields (`data-hibp`) | Dropped | — | It sends requests to a third-party service, which the constitution forbids. A server-side policy refusal is shown through FR-016 |
| Username lower-cased on every key press | Improved | FR-012 | Converted when the field loses focus, so the cursor does not jump |
| Success and error alerts from legacy message keys | Matched | FR-016, FR-064, FR-065 | Translated from the API's codes |
| DataTables state saving (page, search) | Matched | FR-003, FR-007 | Kept in the screen's address |
| Legacy UI log entries "impersonator => target" | Improved | FR-071 | Audit log shows both accounts and filters by impersonated account |

Reused legacy translation keys (meaning unchanged): `admin.admins`, `admin.domain_admins`,
`admin.domain_admin`, `admin.add_admin`, `admin.add_domain_admin`, `admin.admin_domains`,
`admin.search_domain_da`, `admin.username`, `admin.password`, `admin.active`,
`admin.action`, `edit.admin`, `edit.domain_admin`, `edit.domains`, `edit.force_pw_update`,
`edit.force_pw_update_info` (product name from branding), `tfa.tfa`, `tfa.disable_tfa`,
`tfa.force_tfa`, `tfa.force_tfa_info`, `mailbox.activate`, `mailbox.deactivate`, `mailbox.remove`,
`mailbox.active`, `mailbox.inactive`, the 19 domain-administrator flags under `acl.*`,
`warning.no_active_admin`, `warning.cannot_delete_self`, `danger.username_invalid`,
`danger.object_exists`, `danger.domain_invalid`, `danger.password_complexity`,
`success.admin_added`, `success.admin_modified`, `success.admin_removed`,
`success.domain_admin_added`, `success.domain_admin_modified`, `success.domain_admin_removed`,
`success.acl_saved`, `success.logged_in_as`, `user.open_webmail_sso` (40 keys and the 19 flags).
The "Generate" control's label comes from the shared password field of UI features 003 and 005, so
`admin.generate` is not reused here. Keys whose legacy text contains a brand name or HTML are
replaced by new keys with a product-name placeholder.

### API Dependency

This feature depends on mailcow-rest-v2 feature 007, `specs/007-administrators-domain-admins/spec.md`
(commit `c5f9dd3`). Its OpenAPI contract was published in commit `a13c370`. The plan pins commit
`3207925` and confirmed every capability below against it (constitution I).

| UI need | API feature 007 | Requirements |
|---|---|---|
| List administrators with full representation, search, filters (status, second-factor status, forced flags), sorts, pagination and total | FR-006, FR-008, FR-010, FR-011 | FR-032 |
| Create, inspect, change, rename and delete administrators; suspend their second factors | FR-013, FR-017, FR-022, FR-025 to FR-027, FR-030 | FR-033, FR-034, FR-038 |
| "Last active administrator" and "cannot delete own account" refusals | FR-028, FR-029 | FR-035 to FR-039 |
| List domain administrators with assignments, filters by domain and by permission flag, sort by domain count | FR-007, FR-012 | FR-005, FR-007 |
| Create a domain administrator with domains, forced flags and initial permission flags in one request | FR-018 to FR-020 | FR-011 to FR-017 |
| Change a domain administrator's domains, forced flags and status; rename; delete | FR-021, FR-023, FR-025, FR-031, FR-034, FR-035 | FR-018 to FR-026 |
| Read and change permission flags, sending only the changed ones | FR-037, FR-038, FR-041 | FR-027 to FR-031 |
| Start and end an impersonation; identity naming the impersonator, its role and the start time | FR-042 to FR-048, FR-050 | FR-040 to FR-048 |
| "Already impersonating", "impersonation ended", "not allowed while impersonating" refusals; anti-forgery token renewal on every switch | FR-043, FR-045, FR-049, FR-050, FR-052 | FR-042, FR-049, FR-051, FR-053 |
| Sign-out ends the whole session while acting; preferences stay the impersonator's | FR-047, FR-051 | FR-047, FR-050 |
| Webmail sign-in on a user's behalf, and the operator setting in the identity | FR-054 to FR-056 | FR-055 to FR-057 |
| Issue a single sign-on token with its expiry; sign in with a token | FR-057 to FR-063 | FR-058 to FR-063 |
| Version tags on accounts and outdated refusals | FR-064, FR-065 | FR-066 |
| Audit log filters by target and by impersonated account, and the impersonated account in records | FR-066 to FR-069 | FR-071 |
| Problem types and rule codes for every message in FR-065 | FR-070 | FR-064, FR-065 |
| Bulk actions on several accounts with per-item results and version tags | FR-075, FR-076 | FR-009, FR-010 |
| Account capabilities: default permission flags, bulk limit, username length | FR-077 | FR-012, FR-015 |

It also uses API feature 001 (identity, sessions, sign-out, anti-forgery token, error conventions,
throttling, audit log), API feature 002 (the domain list for the picker and the domain links), API
feature 003 (the mailbox list and detail as entry points, the read-only password policy) and API
feature 005 (the webmail single sign-on hand-off that API 007 FR-055 reuses; "Open webmail as"
becomes available with it).

**API gaps** (to be specified in mailcow-rest-v2; the UI does not work around them):

- Resolved: webmail while acting. API 007 FR-049 and FR-054 refuse every webmail sign-in during an
  impersonation, on behalf of a user and the impersonated mailbox's own. FR-057 follows.
- Resolved: the default permission flags. API 007 FR-077 reports them through the account
  capabilities read.
- Open: naming the link's account on the landing (FR-060). The only operation that reads a token
  consumes it and replaces the session (API 007 FR-060, FR-063), so the app cannot name the token's
  account before the user chooses. Proposed to mailcow-rest-v2: a non-consuming token read counted
  towards the same throttle. Until then the landing names the current account only.

### Key Entities *(include if feature involves data)*

- **Administrator account**: username, status, two-factor status (none, active, suspended), number
  of active passkeys, forced password change and forced two-factor setup flags, creation and
  modification times, version. Holds every permission.
- **Domain administrator account**: everything an administrator account has, plus its assignments
  and its permission flags.
- **Domain assignment**: links a domain administrator to one domain, with its own status and creation
  time, and a marker when the name is not an existing primary domain.
- **Domain administrator permissions**: the 19 named on/off flags that limit what a domain
  administrator may do in its domains.
- **Acting session** (API: "impersonation"; legacy: "login-as" or "dual login"): the state in which
  an impersonator (an administrator, or a domain administrator with "login as mailbox user") uses
  the app as a target (a domain administrator or a mailbox user). It has the impersonator, the
  target, the start time and the origin screen remembered by the app. In the app's texts the state
  is called "acting as" and the action that starts it "Sign in as".
- **One-time sign-in link**: a single sign-on token for one domain administrator, valid once and
  until its expiry (30 seconds after issue).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator on a 360 px phone creates a domain administrator with two domains and
  a generated password in under 2 minutes, without horizontal scrolling or zooming.
- **SC-002**: Starting to act as someone takes at most 2 taps from a list entry, and returning takes
  exactly 1 tap from any screen.
- **SC-003**: In end-to-end tests on both viewports, the acting banner is present, naming the target
  and the impersonator, on 100% of screens visited while acting, and on none afterwards.
- **SC-004**: In end-to-end tests, 0 items of data belonging to the previous identity are visible
  after any switch into or out of acting, and 0 requests prepared under a previous identity are
  resent automatically.
- **SC-005**: After returning, the user lands on the origin screen with its search and filters
  restored in 100% of tested cases where that screen is still available.
- **SC-006**: Automated accessibility checks report 0 violations on every screen and dialog of this
  feature, in light and dark themes, and every flow can be completed with the keyboard alone.
- **SC-007**: 100% of the feature's texts exist in English, Czech and Slovak, and every legacy key
  listed under Legacy Parity is reused.
- **SC-008**: In tests, the UI never offers removing the own account or deactivating the last active
  administrator, and 100% of API refusals in this feature appear as translated messages, none as the
  API's English text.
- **SC-009**: A domain administrator opening a valid one-time sign-in link sees their home screen
  within 5 seconds, and 100% of invalid, expired or used links lead to the explanatory message.
- **SC-010**: An administrator changes a domain administrator's permissions and sees the saved result
  in under 30 seconds from opening the account on a phone.

## Assumptions

- UI feature 001 provides the shell, navigation, sign-in, session and restricted-session handling,
  the forbidden and not-found states, the generic error presentation, the throttling message and the
  audit log screen. This feature adds its screens and navigation items, the acting banner, the
  one-time sign-in landing, and the impersonation fields and filter of the audit log.
- UI feature 002 provides the domain screens that assignments link to. UI feature 003 provides the
  mailbox list and detail screens, into which this feature adds "Sign in as" and "Open webmail as".
  UI feature 005 provides the mailbox user's home with its webmail control, and the own-credential
  screens that FR-049 makes unavailable while acting.
- The API decides the effective permissions while acting (API 007 FR-046). The UI only follows the
  identity it reports.
- The API's account capabilities report the default permission flags (API 007 FR-077), so that the
  creation form can show them.
- The one-time link's lifetime comes from the expiry in the API's issue response (30 seconds, fixed
  by API 007 because the legacy login enforces it). Billing panels that redirect to the new app use
  the landing address of FR-058, which this feature documents for operators. Panels that keep
  redirecting to the legacy login keep working, because both accept the same tokens.
- A domain administrator's API keys are managed in UI feature 001.
- The legacy UI may still overwrite a change made in the new app, because it never sends version
  tags (API 007). The UI cannot prevent that.
- **Out of scope**: own-account self-service (password, second factors, recovery e-mail); enrolling
  second factors or passkeys for other accounts; listing or ending other users' sessions; legacy
  `/api/v1` keys; identity-provider accounts (UI feature 012); domain administrators managing other
  domain administrators.
