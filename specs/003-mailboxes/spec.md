# Feature Specification: Mailboxes

**Feature Branch**: `main` (no feature branches, constitution 1.1.0)

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Mailbox management screens for mailcowui-ng, the mobile-first web app
for mailcow-dockerized, whose only backend is mailcow REST API v2 feature 003 (Mailboxes).
Administrators and domain administrators list, search, filter, sort and page through the mailboxes
in their scope with their quota usage (cards on phones, a table on wide screens), inspect a
mailbox, and create mailboxes from templates with the domain's quota defaults, a password generator
that runs in the browser and hints from the read-only password policy. They edit a mailbox in
separate sections instead of the legacy 1,349-line modal and edit page: general settings, sign-in
and password, protocol access, user permissions, tags, custom attributes, and read-only settings
owned by other features with links to them. They delete a mailbox after a confirmation that shows
the impact, including what happens when the mail store cannot move the mail to the garbage area,
rename a mailbox with an explicit choice to keep the old address as an alias and a report of
incomplete renames, and apply bulk actions to up to 100 mailboxes with one result per mailbox.
Administrators manage mailbox templates; domain administrators read them. Domain administrators
only reach their domains' mailboxes and only choose what their permission flags allow. Mailbox
users have no access. Replaces the legacy Mail setup › Mailboxes tab, the add-mailbox modal, the
Edit mailbox page and the mailbox templates tab and edit page."

## Clarifications

### Session 2026-10-18

- Q: Should a mailbox be edited in one long form, and how are its parts saved? → A: No. The detail
  screen is an overview with these sections, each with its own link: General, Sign-in and password,
  Protocol access, Permissions, Tags, Custom attributes, History (administrators only), Rename and
  Delete. Each editable section has its own form and save action, sends only the values changed in
  it with the version the screen read, and asks before the user leaves it with unsaved changes
  (FR-016, FR-031 to FR-033). (agent decision: constitution II forbids giant modals and asks for
  sections; per-section saves map onto the API's partial changes (API FR-029) and keep conflicts
  small; legacy already saves each tab separately.)
- Q: How is a password entered and generated? → A: One password field with show/hide, "generate"
  and "copy" controls, without a confirmation field. The generator uses a cryptographically secure
  random source in the browser and produces at least 16 characters, or the policy's minimum length
  when that is longer, with at least one lower-case letter, one upper-case letter and one digit, a
  special character from a small set that mail clients accept when the policy requires special
  characters, and no look-alike characters (0/O, 1/l/I). A generated password is shown in clear
  text (FR-028, FR-029). (agent decision: API FR-024 takes the password once and leaves the
  confirmation to the client; a visible password prevents typos better than a second field on a
  phone (NIST SP 800-63B); the legacy generator uses only the policy length and a pronounceable
  algorithm that ignores the required character classes, so its passwords can fail the policy.)
- Q: Should the password policy hints block submission? → A: No. The rules are listed before the
  user types and each is marked met or not met while typing, but submission stays possible; the
  API decides, and its errors appear on the password field naming each unmet rule. A value with a
  recognised hash-scheme prefix gets a notice that it is stored pre-hashed without the policy
  check. If the policy cannot be read, the form says the rules are unavailable and still allows
  submission (FR-030). (agent decision: the API is the authority (API FR-024, FR-063), the policy
  can change between reading and submitting, and pre-hashed values bypass the rules; a blocking
  copy of the check could refuse what the API accepts.)
- Q: How is the create screen organised, how are templates applied, and which values are sent?
  → A: One screen, neither a modal nor a wizard. The local part, domain, display name, template,
  password and quota come first; the other groups are collapsed, each with a one-line summary of
  its values. The Default template is preselected. Choosing another template fills every
  template-driven field; when the user has already changed some of them, the UI asks before
  overwriting. The quota comes from the chosen template, except that the Default template, and an
  unlimited template quota for a caller who may not give one, pre-fill the domain's default quota
  for a new mailbox. The request names the template, always contains the quota shown, and otherwise
  only values that differ from the template's (FR-018, FR-021, FR-022, FR-025). (agent decision:
  legacy preselects Default and fills the form from it; API FR-022 and its clarification take the
  domain's default quota when no template is named, so that the Default template's unlimited quota
  never creates unlimited mailboxes silently; API FR-006 treats values equal to the template as not
  chosen, so sending only differences never trips a domain administrator's flag check; keeping the
  essentials visible makes the common case fast on a phone.)
- Q: How are settings that a domain administrator's permission flags do not allow presented? → A:
  Read-only, with their current or template value, the legacy note "Prohibited by ACL" and the name
  of the missing permission. The unlimited quota option is not offered without the "unlimited
  quota" flag. User permissions that the API omits are not shown at all, with a note that some
  permissions are hidden. A control is never shown enabled for something the flags deny (FR-041,
  FR-042). (agent decision: legacy renders such controls as plain text with the "Prohibited by ACL"
  tooltip; read-only display tells the domain administrator what the mailbox will get; the API
  omits the overlapping permissions (API FR-035), so the UI cannot show them.)
- Q: How is a quota entered and displayed? → A: Entered as a number with a MiB, GiB or TiB unit
  that must come to a whole number of MiB and at least 1 MiB, with a separate "Unlimited" switch
  instead of legacy's "0 = ∞"; a stored value is shown in the largest unit that represents it
  exactly, as in UI feature 002. The largest allowed quota is shown next to the field. Usage is
  displayed in binary units with a bar whose style changes at 75% and 90%, as in the legacy mailbox
  list, always with the percentage as text (FR-011, FR-034). (agent decision: API FR-009 requires
  whole MiB and uses 0 for unlimited; an explicit switch avoids creating an unlimited mailbox by
  typing 0; the same entry rules as the domain screens keep the app consistent.)
- Q: How does bulk selection work across pages, and what does the user see afterwards? → A: The
  selection holds only mailboxes of the current page and is cleared, with an announcement, when the
  page, page size, search, filters or sort change, as in UI feature 002. "Select all" selects the
  current page; the largest page size equals the bulk limit of 100. Afterwards the UI shows the
  number of mailboxes per outcome and a list of every mailbox with its translated outcome;
  mailboxes that failed or were refused stay selected for a retry, the others are deselected. If
  the connection drops before the response, the outcome is reported as unknown, the list is
  refreshed, and the request is never repeated automatically (FR-054, FR-056). (agent decision: API
  FR-054 and FR-055 set the limit and return one result per mailbox; clearing the selection never
  lets an action reach mailboxes the user no longer sees and matches the domain list; legacy reloads
  the page and shows only toasts; keeping failures selected makes a retry one tap.)
- Q: How strong must the delete confirmations be? → A: A single deletion uses a dialog that names
  the mailbox, shows its storage used and message count, explains the garbage area and lists the
  kinds of data removed; its confirm button names the action. A bulk deletion lists every selected
  address and also requires typing the number of selected mailboxes. Other bulk actions need one
  confirmation that names the action, its effect and the count (FR-045, FR-055). (agent decision:
  constitution II requires explicit confirmation that shows what is affected; typing the count
  guards the one action that can delete 100 mailboxes at once without slowing single deletions on
  a phone.)
- Q: How does the rename flow handle the backup warning, the alias choice and partial failures?
  → A: The section first shows the legacy backup warning with the acknowledgement "I have created a
  backup."; the form then asks for the new local part and requires a yes/no answer to "Keep the old
  address as an alias" with nothing preselected. Renaming is unavailable for inactive mailboxes. On
  success the mailbox opens at its new address. On "rename incomplete" a persistent report lists the
  steps done and not done in the user's language, with both addresses, advises contacting the
  server operator, and the UI does not navigate away (FR-048 to FR-052). (agent decision: API
  FR-043 and FR-048 require an explicit alias choice and report the steps; the legacy UI checks the
  alias box while the legacy server defaults to no alias, so no preselection avoids either
  surprise.)
- Q: What happens when a save, deletion or rename is refused as outdated? → A: The UI always sends
  the version it read. On "outdated" it keeps the user's entries, reloads the object, marks each
  field of the section whose stored value changed meanwhile together with the new value, and asks
  the user to review and save again; a deletion or rename asks for confirmation again against the
  reloaded mailbox. Nothing is retried or overwritten automatically, and there is no "overwrite
  anyway" option (FR-044). (agent decision: API FR-038 refuses stale writes; constitution II asks
  for version tags to be honoured; keeping the entries avoids lost work.)
- Q: Which authentication sources can the UI offer, given that the API reports a mailbox's own
  source but not which external identity provider is configured? → A: The built-in authentication
  always, and for an existing mailbox its current external source. Offering an external source
  that the mailbox does not already use, including at creation, waits until the API reports the
  configured provider type; this is recorded as an API gap, and until then new mailboxes use the
  built-in authentication, as the legacy add form does (FR-024, API gaps). (agent decision:
  constitution I forbids working around a missing API capability; API FR-025 refuses unconfigured
  sources, and API 001's public configuration only says whether a provider is configured.)

## User Scenarios & Testing *(mandatory)*

Actors: **administrators** (all mailboxes), **domain administrators** (mailboxes of the domains
they manage, limited by their permission flags) and **mailbox users** (no access to this
feature). Feature 001 of this app provides sign-in, the app shell, navigation, the error and
problem-detail handling, languages and themes. Feature 002 of this app provides the domain screens.

### User Story 1 - Find and inspect mailboxes (Priority: P1)

An administrator or a domain administrator opens "Mailboxes" from the navigation, on a phone or
on a desktop. They see the first page of the mailboxes in their scope, sorted by address. On a
phone each mailbox is a card with its address, display name, status, quota usage and message
count. On a wide screen the mailboxes form a table, and the user can add the other columns the
legacy list offered. They search by a fragment of an address, display name or tag, filter by
domain, status, tag and authentication source, sort by any sortable field, and page through
thousands of mailboxes. They open a mailbox and see an overview of everything the API reports
about it: identity, status, quota usage and the largest quota it may still get, protocol access,
sign-in and security settings, last logins, tags, custom attributes, user permissions, the
settings that other features manage, and its creation and modification times.

**Why this priority**: Every other mailbox task starts by finding the mailbox. The legacy list
hides most columns behind row collapse on phones and becomes slow on large servers.

**Independent Test**: Against a mock API generated from the pinned contract, with 10,000
mailboxes in 500 domains, sign in as an administrator and as a domain administrator on a 360 px
and on a desktop viewport. Search, apply each filter and sort, page, and open mailboxes. Compare
every displayed value with the mock data and run the automated accessibility checks on each view.

**Acceptance Scenarios**:

1. **Given** an administrator and 30 mailboxes, **When** they open "Mailboxes" on a 360 px wide
   phone, **Then** they see the first 25 mailboxes sorted by address as cards, the total of 30,
   and paging controls, with no horizontal scrolling.
2. **Given** the same list on a wide screen, **When** the user adds the "Last password change"
   column, **Then** the column appears, and it is still shown on their next visit in the same
   browser.
3. **Given** mailboxes `anna@a.example`, `bob@a.example` named "Joanna Bob" and `carl@a.example`
   tagged "Annapolis", **When** the user searches for "ANNA", **Then** all three are listed, the
   search is part of the page's link, and going back in the browser restores the previous list.
4. **Given** filters for the domain `a.example` and the status "inactive", **When** they are
   applied, **Then** only matching mailboxes are listed, each active filter is shown as a
   removable chip, and one action clears all filters.
5. **Given** filters that match nothing, **When** the list loads, **Then** an empty state says that
   no mailbox matches and offers to clear the filters. **Given** a scope without any mailbox,
   **Then** the empty state offers "Add mailbox".
6. **Given** a sort by percentage used, descending, **When** the list loads, **Then** the fullest
   mailbox comes first and mailboxes with unlimited quota come last, labelled "Unlimited" without
   a usage bar.
7. **Given** a mailbox that uses 92% of its quota, **When** it is listed, **Then** its usage is
   shown as a bar in the critical style together with the text "92 %" and the used and total sizes
   in the user's locale, so the state does not depend on colour alone.
8. **Given** a domain administrator who manages only `a.example`, **When** they follow a link to a
   mailbox of `b.example`, **Then** they see the same "not found" screen as for a mailbox that does
   not exist, with a way back to the list.
9. **Given** a mailbox, **When** the user opens it, **Then** the overview shows all groups listed
   above, and each setting that another feature manages is read-only and says where it is managed.
10. **Given** the list cannot be loaded, **When** the user opens "Mailboxes", **Then** an error
    state explains the problem in the user's language and offers to try again.
11. **Given** a signed-in mailbox user, **When** they open the mailbox screen's link, **Then** the
    navigation has no "Mailboxes" entry and they see the app's "forbidden" screen.

---

### User Story 2 - Create a mailbox (Priority: P1)

An administrator or a domain administrator taps "Add mailbox". A dedicated screen opens. They
type the local part, choose a domain (preselected when they came from a list filtered by one
domain) and see how many mailboxes the domain has left and the default and largest quota a new
mailbox may get there. They pick a template, with the Default template preselected, which fills
the quota, status, protocol access, webmail redirect, forced password change and two-factor
setup, user permissions, tags and the initial tagging, quarantine notification, TLS and rate-limit
settings. They type a display name and a password, or generate one, while the password rules are
visible. They change whatever their permission flags allow and create the mailbox.

**Why this priority**: Creating mailboxes is the most frequent provisioning task. The legacy modal
is a single 1,349-line dialog that is hard to use on a phone.

**Independent Test**: Against the mock API, create mailboxes as an administrator and as domain
administrators with and without each relevant permission flag, with and without templates, at
each domain limit, and with passwords that meet and fail the policy. Check each request the UI
sends, each displayed error, and the screen shown after success, on both viewports.

**Acceptance Scenarios**:

1. **Given** an administrator and the domain `example.org` with room for more mailboxes,
   **When** they type ` Anna.Smith `, choose `example.org`, generate a password and create the
   mailbox, **Then** the form shows the address as `anna.smith@example.org` before submitting,
   the mailbox is created, its detail screen opens, and "Mailbox anna.smith@example.org has been
   added" is announced.
2. **Given** a domain whose default quota for a new mailbox is 1 GiB and whose largest is 5 GiB,
   **When** it is chosen, **Then** the quota is filled with 1 GiB, "max. 5 GiB" is shown, and
   entering 8 GiB shows an error on the quota field that states the 5 GiB maximum before the form
   is submitted.
3. **Given** a template "Small" with 1 GiB quota, POP3 off and the sync-jobs permission on,
   **When** it is selected, **Then** the form shows those values, including in the summaries of
   collapsed groups.
4. **Given** a password policy with a minimum length of 10 and digits required, **When** the user
   types "short", **Then** both rules are marked as not met. **When** they generate a password,
   **Then** it meets both rules.
5. **Given** a domain administrator without the "unlimited quota" flag, **When** they open the
   form, **Then** no "unlimited" option is offered. **Given** one without the "protocol access"
   flag, **Then** protocol access is shown read-only with the template's values and a note naming
   the missing permission.
6. **Given** a domain administrator without the "sync jobs" flag, **When** they open the
   permissions group, **Then** the sync-jobs permission is not shown at all.
7. **Given** an address that is already an alias, **When** the user submits, **Then** the local
   part field shows a translated error saying that an alias already uses the address, and every
   entry, including the password, is kept.
8. **Given** a domain whose mailbox limit is reached, **When** it is chosen, **Then** the form says
   that the domain has no mailboxes left. **When** the user submits anyway and the API refuses,
   **Then** the message states the current count and the limit.
9. **Given** a domain without quota left for limited mailboxes, **When** an administrator chooses
   it, **Then** the form shows "Domain quota exceeded: Only unlimited mailboxes can be created in
   this domain scope." and offers only an unlimited quota. **When** a domain administrator without
   the "unlimited quota" flag chooses it, **Then** the form explains that no mailbox can be created
   there and creation is not possible.
10. **Given** the request fails because the connection dropped, **When** the user is told,
    **Then** every entry is still in the form and they can submit again.

---

### User Story 3 - Change a mailbox's settings and password (Priority: P1)

An administrator or a domain administrator opens a mailbox and changes it section by section:
the general settings (display name, quota, status, webmail redirect), sign-in and password
(authentication source, password, forced password change, forced two-factor setup, recovery
e-mail) and protocol access. Each section is saved on its own, sends only what changed together
with the version the screen read, and never silently overwrites a change someone else made in the
meantime, in this app or in the legacy UI.

**Why this priority**: Operators change quotas, reset passwords and suspend mailboxes every day.

**Independent Test**: Against the mock API, change each field of each section on both viewports,
as an administrator and as domain administrators with and without each relevant flag. Make the
mock report the mailbox as changed between reading and saving, and check that the user's entries
are kept and nothing is overwritten.

**Acceptance Scenarios**:

1. **Given** a mailbox, **When** an administrator generates a new password in the sign-in section
   and saves, **Then** a success message is announced, the password field is cleared, and the last
   password change time is updated. The password is never displayed again.
2. **Given** an active mailbox, **When** its status is set to "Inactive", **Then** the form explains
   that mail to the mailbox will no longer be accepted before it is saved, and afterwards the list
   shows the status "Inactive".
3. **Given** an operator who changed the mailbox's quota in the legacy UI after the screen was
   opened, **When** the user saves a new display name, **Then** the save is refused as outdated, the
   user's entry is kept, the changed quota is pointed out, and a second save succeeds.
4. **Given** a mailbox, **When** the user enters a quota above the largest it may get, **Then** the
   quota field shows the largest allowed quota. **When** they enter a quota below the storage
   already used, **Then** a warning explains the consequence, and the change can still be saved.
5. **Given** a domain administrator without the "protocol access" flag, **When** they open the
   protocol access section, **Then** it is read-only, names the missing permission, and has no save
   action.
6. **Given** a mailbox that authenticates against LDAP, **When** the sign-in section opens,
   **Then** the password and recovery e-mail fields are absent and forced password change is
   unavailable with the reason. **When** the user switches the source to the built-in
   authentication, **Then** a password field appears with a hint that it is required if the
   mailbox has no password stored.
7. **Given** unsaved changes in a section, **When** the user tries to leave it, **Then** they are
   asked whether to discard the changes.

---

### User Story 4 - Delete a mailbox (Priority: P1)

An administrator or a domain administrator deletes a mailbox from its row in the list or from its
detail screen. A confirmation shows what will happen before anything is deleted: the mail moves to
mailcow's garbage area and is purged after the server's retention period, and everything that
belongs to the mailbox is removed. When the mail store cannot confirm the move, nothing is deleted
and the user is told so.

**Why this priority**: Deprovisioning is a daily operation, and a mistaken deletion destroys a
user's data.

**Independent Test**: Against the mock API, delete mailboxes from the list and from the detail
screen on both viewports. Make the mock answer with success, with the temporary failure of the mail
store, with "outdated" and with "not found", and check what the user sees in each case.

**Acceptance Scenarios**:

1. **Given** a mailbox using 2 GiB in 10,000 messages, **When** the user chooses "Remove",
   **Then** a confirmation names the mailbox, shows the 2 GiB and 10,000 messages, says that the
   mail moves to the garbage area and is purged after the server's retention period, lists the kinds
   of data that are removed, and says that aliases with other recipients keep them. The safe choice
   has the focus.
2. **Given** that confirmation, **When** the user confirms, **Then** "Mailbox x has been removed" is
   announced, the mailbox disappears from the list, and a detail screen returns to the list.
3. **Given** the mail store is unreachable, **When** the user confirms, **Then** the message says
   that the mailbox was not deleted, nothing was removed, and the deletion can be tried again later.
   The mailbox stays listed.
4. **Given** someone changed the mailbox after the screen was loaded, **When** the user confirms,
   **Then** the UI reloads the mailbox and asks for confirmation again against the current data.
5. **Given** the mailbox was deleted elsewhere in the meantime, **When** the user confirms, **Then**
   they are told that the mailbox no longer exists and the list is refreshed.

---

### User Story 5 - Manage a mailbox's permissions, tags and custom attributes (Priority: P2)

An administrator or a domain administrator decides what the mailbox user may do in the web app
(temporary aliases, TLS policy, spam score, allow and block lists, tagging, sync jobs, ActiveSync
and SOGo resets, push notifications, quarantine actions, attachments, notifications and category,
app passwords and password reset), labels the mailbox with tags and maintains its custom
attributes, which domain footers can insert into outgoing mail.

**Why this priority**: These settings matter, but they are rarely changed after creation and
templates set sensible defaults.

**Independent Test**: Against the mock API, change each permission, the tags and the custom
attributes, as an administrator and as a domain administrator lacking each overlapping flag, and
check the requests and the displayed results on both viewports.

**Acceptance Scenarios**:

1. **Given** the permissions section, **When** the user turns on "Sync jobs" and saves, **Then**
   only that permission is sent and saved.
2. **Given** a domain administrator without the "sync jobs" flag, **When** they open the section,
   **Then** the sync-jobs permission is not shown, and a note says that some permissions are hidden
   by their own permissions.
3. **Given** a mailbox tagged "Sales", **When** the user adds "sales", **Then** it is recognised as
   the same tag and not added twice. **When** they try to add a 26th tag, **Then** they are told
   that the limit is 25.
4. **Given** a mailbox that has 30 tags from the legacy UI, **When** its tags are shown, **Then** all
   30 appear, and saving is possible only after the set is reduced to the limit.
5. **Given** the custom attribute `old=1`, **When** the user adds `department` with the value
   "Sales", removes `old` and saves, **Then** only `department=Sales` remains. **When** they type
   an attribute name containing a space, **Then** the name field shows an error.
6. **Given** a server whose product name is "Example Mail", **When** the password reset permission
   is shown, **Then** its label uses "Example Mail" and not a hard-coded product name.

---

### User Story 6 - Apply an action to many mailboxes at once (Priority: P2)

An administrator or a domain administrator selects mailboxes in the list and activates them,
disallows their login, deactivates them, deletes them, or allows or disallows one protocol for all
of them. They then see one result per mailbox.

**Why this priority**: Operators use mass actions to suspend customers and roll out protocol
changes, but every single action also works without them.

**Independent Test**: Against the mock API, apply each action to selections on both viewports,
including selections with mailboxes that the mock reports as not found, refused and failed, and a
whole-request refusal, and check the confirmation, the result summary and the selection
afterwards.

**Acceptance Scenarios**:

1. **Given** 50 mailboxes selected on a page of 50, **When** the user chooses "Deactivate" and
   confirms, **Then** the result says that all 50 were done and the list shows them as inactive.
2. **Given** a selection in which two mailboxes were deleted elsewhere, **When** an action is
   applied, **Then** those two are reported as not found and the others as done.
3. **Given** a selection, **When** the user goes to the next page or changes the search,
   **Then** the selection is cleared and this is announced, so no action can reach mailboxes that
   are no longer shown.
4. **Given** a domain administrator without the "protocol access" flag, **When** they open the bulk
   actions, **Then** no protocol action is offered.
5. **Given** a bulk deletion of three mailboxes in which the mail store of one cannot be cleaned,
   **When** the user types 3 to confirm it, **Then** two are reported as removed and one as failed
   with a translated reason, and the failed mailbox stays in the list and selected.
6. **Given** a phone, **When** the user starts selecting, **Then** each card gets a selection
   control of at least 44×44 px and a bar with the number selected and the actions stays visible
   at the bottom of the screen.

---

### User Story 7 - Manage mailbox templates (Priority: P2)

An administrator maintains mailbox templates such as "Students" or "Staff", each holding the
values new mailboxes start with. Domain administrators see the templates and their values but
cannot change them. The Default template always exists and can be changed but not renamed or
deleted.

**Why this priority**: Templates make provisioning consistent, but mailboxes can be created
without custom templates.

**Independent Test**: Against the mock API, list, search, sort, create, change and delete
templates as an administrator, and open them as a domain administrator, on both viewports.

**Acceptance Scenarios**:

1. **Given** an administrator, **When** they open "Mailbox templates", **Then** each template shows
   its name, quota, status, protocol access, webmail redirect, forced flags, rate limit, tags and
   modification time, as cards on a phone and as a table on a wide screen.
2. **Given** an administrator, **When** they create the template "Students" without changing any
   value, **Then** it is created with the built-in defaults the form showed and appears in the list.
3. **Given** a template "Staff", **When** an administrator creates "staff", **Then** the name field
   shows that a template with this name already exists.
4. **Given** the Default template, **When** an administrator opens it, **Then** its name cannot be
   edited and no delete action is offered, with a short explanation.
5. **Given** a template, **When** an administrator changes only its quota, **Then** only the quota
   is sent.
6. **Given** a template, **When** an administrator deletes it, **Then** the confirmation says that
   mailboxes created from it do not change.
7. **Given** a domain administrator, **When** they open the templates, **Then** they can read every
   template and see no create, change or delete controls.

---

### User Story 8 - Rename a mailbox (Priority: P3)

An administrator or a domain administrator changes the local part of a mailbox, for example after
a name change, and decides whether the old address keeps working as an alias.

**Why this priority**: Renaming is rare and risky. Legacy asks the operator to make a backup first.

**Independent Test**: Against the mock API, rename mailboxes on both viewports with and without
keeping the old address. Make the mock answer with success, conflict, "mailbox cannot be renamed",
the alias limit, a temporary failure and "rename incomplete", and check each screen.

**Acceptance Scenarios**:

1. **Given** `anna@example.org`, **When** the user acknowledges the backup warning, enters
   `anna.smith`, chooses to keep the old address as an alias and confirms, **Then** the detail
   screen of `anna.smith@example.org` opens and "Mailbox was renamed from anna@example.org to
   anna.smith@example.org" is announced.
2. **Given** a new address that is already used, **When** the rename is submitted, **Then** the new
   local part field shows which kind of object uses it, and nothing changes.
3. **Given** an inactive mailbox, **When** the user opens the rename section, **Then** renaming is
   unavailable and the reason is shown.
4. **Given** a webmail step that fails and is undone, **When** the rename is submitted, **Then** the
   user is told that the mailbox keeps its old address and that they can try again later.
5. **Given** a failure that could not be undone, **When** the rename is submitted, **Then** a
   report lists the steps that are done and those that are not, in the user's language, with both
   addresses, and advises contacting the server operator.
6. **Given** a domain whose alias limit is reached, **When** the user renames with "keep the old
   address", **Then** the message explains that the alias limit is reached and suggests renaming
   without keeping the old address.

---

### User Story 9 - Review a mailbox's change history (Priority: P3)

An administrator investigating a support case opens the history of a mailbox and sees who changed
what and when, including refused attempts, through this API.

**Why this priority**: Useful for support, but no mailbox task depends on it.

**Independent Test**: Against the mock API, open the history of mailboxes with change, password,
bulk, rename and refused records as an administrator, and as a domain administrator, on both
viewports.

**Acceptance Scenarios**:

1. **Given** an administrator who changed a mailbox's quota and set its password, **When** another
   administrator opens its history, **Then** both records appear newest first, the quota change
   with its old and new value and the password change as "Password set" without any value.
2. **Given** a refused attempt, **When** the history is shown, **Then** the record shows the outcome
   "refused" and the translated reason.
3. **Given** a domain administrator, **When** they open a mailbox, **Then** there is no history
   section.

---

### Edge Cases

- **Mailbox deleted or moved out of scope while open**: the next load or save answers "not found";
  the UI says that the mailbox is no longer available and offers the way back to the list.
- **Domain assignment or permission flag removed during the session**: the next refused request
  names the field and the missing permission. The UI refreshes the identity and the mailbox, and the
  affected controls become read-only or disappear.
- **Session expired while editing**: feature 001 handles the new sign-in. A password typed into a
  form is never kept anywhere that survives the page.
- **Very long addresses, display names, tags or attribute values on a 360 px screen**: they wrap or
  are truncated with the full text available on the detail screen and to assistive technology,
  never forcing horizontal scrolling.
- **Internationalised domain names**: shown in readable form, with the ASCII form on the detail
  screen when it differs.
- **Unlimited quota**: shown as "Unlimited" without a percentage or bar, sorted after all others.
- **Quota below the storage already used**: allowed. The UI warns that mail delivery may be refused
  once the mailbox is over quota.
- **Domain quota exhausted for limited mailboxes**: only an unlimited quota can be created there;
  for a domain administrator without the "unlimited quota" flag, creation in that domain is not
  possible and the form says why.
- **Domain mailbox limit reached**: shown when the domain is chosen. A refusal from the API is still
  handled, because another user may have created a mailbox in the meantime.
- **Template deleted between opening the form and submitting**: the API's error on the template is
  shown, the template list is reloaded, and the user picks again.
- **Password policy changed between reading and submitting**: the API's error names the unmet
  rules. The UI reloads the policy and updates the hints.
- **Password policy cannot be read**: the form says that the rules are unavailable, the generator
  still works, and submitting is still possible.
- **Value that begins with a recognised hash-scheme prefix** (for example `{SSHA512}`): the form
  says that it will be stored as a pre-hashed value without the policy check.
- **Mailbox with an external authentication source**: no password or recovery e-mail fields;
  forced password change (and, for generic OIDC, forced two-factor setup) is unavailable with the
  reason.
- **Last logins turned off by the operator**: no last-login values are shown, and the UI never
  claims that a mailbox has never logged in.
- **Mailbox already carrying more tags than the limit**: all tags are shown; saving requires
  reducing the set to the limit.
- **Selected mailbox deleted elsewhere before a bulk action runs**: reported as not found.
- **Bulk action refused as a whole** (role, key scope or permission): the message names the
  reason, nothing changed, and the selection is kept.
- **Connection lost during a bulk action**: the outcome is reported as unknown, the list is
  refreshed, and the action is never repeated automatically.
- **Rename to the same local part, or one that differs only in letter case**: refused in the form
  before submitting.
- **Deletion while the mail store is unreachable**: nothing is deleted, and the message says so.
- **Two browser tabs editing the same mailbox**: the second save is refused as outdated and handled
  like any other conflict.
- **Search text with special characters**: matched literally.
- **A hundred custom attributes**: the section stays usable on a phone, one attribute per row.
- **Default template**: its name cannot be changed and it cannot be deleted.
- **Links to screens of later features** (aliases, self-service, quarantine, login-as, sync jobs,
  relayhosts): shown only when that screen exists in the app; otherwise the UI names where the
  setting is managed without a broken link (feature 001 placeholder rule).

## Requirements *(mandatory)*

### Functional Requirements

#### Access and navigation

- **FR-001**: The app MUST offer "Mailboxes" and "Mailbox templates" in the navigation to
  administrators and domain administrators, and to nobody else. Mailbox users who open one of
  these screens' links MUST see the app's "forbidden" screen (feature 001).
- **FR-002**: Every screen of this feature MUST have its own link that can be bookmarked, shared
  and reopened: the list with its search, filters, sort, page and page size; a mailbox; each of a
  mailbox's sections; the create screen with an optional preselected domain; the template list; a
  template.
- **FR-003**: The UI MUST decide which controls to show from the role and permission flags in the
  identity that feature 001 reads, and MUST still handle every refusal from the API, because hiding
  a control is not access control.
- **FR-004**: A mailbox or template that does not exist, and one outside the caller's scope, MUST
  lead to the same "not found" screen, with a way back to the list.
- **FR-005**: The mailbox list MUST accept a domain filter in its link, so that the domain screens
  of feature 002 can link to "the mailboxes of this domain" and to "add a mailbox in this domain".

#### Mailbox list

- **FR-006**: The list MUST show the mailboxes in the caller's scope, a page at a time, sorted by
  address by default, with the total number of matching mailboxes. Page sizes of 25 (the default),
  50 and 100 MUST be offered.
- **FR-007**: On viewports narrower than a tablet the list MUST render each mailbox as a card
  showing the address, display name, status, quota usage (FR-011) and message count, with the
  card opening the mailbox. It MUST NOT require horizontal scrolling.
- **FR-008**: On wide viewports the list MUST render a table with these default columns: selection,
  address with display name, domain, quota usage, message count, last mail login, status, tags and
  row actions. The user MUST be able to show or hide the further columns the legacy list offered:
  authentication source, last password change, protocol access (one column per protocol),
  inbound and outbound TLS enforcement, quarantine notification frequency and category, creation
  time and modification time. The choice of columns and the page size MUST be remembered in the
  browser.
- **FR-009**: The list MUST offer a free-text search that matches a fragment of the address,
  display name or tags, and filters for domain, status (active, login disallowed, inactive), tag
  and authentication source. Each filter MUST accept several values. The domain filter MUST offer
  the domains in the caller's scope with a search. Active filters MUST be shown as removable chips
  with one action that clears them all. The search MUST be applied 0.5 seconds after the last
  keystroke, without a separate submit.
- **FR-010**: The list MUST be sortable, ascending and descending, by every field the API sorts by:
  address, display name, domain, status, quota, storage used, percentage used, message count, last
  mail login, last password change, creation time and modification time. On wide viewports the
  sortable column headers MUST sort; on phones a sort control MUST offer the same options.
- **FR-011**: Quota usage MUST be shown as the storage used, the quota and the percentage, with a
  bar whose style changes at 75% (warning) and 90% (critical), as in legacy. An unlimited quota
  MUST be shown as "Unlimited" without a percentage or bar. The state MUST also be conveyed by
  text, not by colour alone.
- **FR-012**: The status MUST be shown as a text badge: "Active", "Disallow login (incoming mail is
  still accepted)" in a shortened form with the full text available, or "Inactive".
- **FR-013**: Each mailbox in the list MUST offer "Edit" (open the mailbox) and "Remove" (FR-045)
  actions, subject to FR-003.
- **FR-014**: The list MUST offer a manual refresh, and MUST show changes made through this app
  without a manual refresh.

#### Mailbox detail

- **FR-015**: Opening a mailbox MUST show an overview with these groups, using the values of the
  API's mailbox representation:
  - identity: address, local part, domain (readable form, plus ASCII form when it differs),
    display name, authentication source, status, and whether the domain is relayed as a backup MX;
  - quota: storage used, quota, percentage, message count, and the largest quota the mailbox may
    be given;
  - access: the six protocol settings (IMAP, POP3, SMTP, Sieve, ActiveSync, CalDAV/CardDAV) and the
    webmail redirect;
  - sign-in and security: forced password change, forced two-factor setup, last password change,
    recovery e-mail (built-in authentication only);
  - last logins per service: IMAP, POP3, SMTP and webmail single sign-on; a missing value MUST be
    shown as "No login recorded", never as "never" (API gap 3);
  - tags, custom attributes and user permissions;
  - managed by other features (read-only, FR-040);
  - creation and modification times.
- **FR-016**: The detail screen MUST list these sections, each with its own link (FR-002): General,
  Sign-in and password, Protocol access, Permissions, Tags, Custom attributes, History
  (administrators only, FR-064), Rename (FR-048) and Delete (FR-045). Each entry MUST summarise the
  section's current values. On phones the sections MUST be reachable from this list on the
  overview; on wide screens a section navigation MUST stay visible next to the content.
- **FR-017**: A mailbox opened from the list MUST be displayed at once from the list's data and
  then refreshed from the API.

#### Creating a mailbox

- **FR-018**: Administrators and domain administrators MUST be able to create a mailbox on a
  dedicated screen, not in a modal dialog. The screen MUST show first the local part, domain,
  display name, template, password and quota. The remaining groups MUST be on the same screen,
  collapsed, each showing a one-line summary of its values: status and access (status, webmail
  redirect, forced password change, forced two-factor setup), protocol access, user permissions,
  tags, and initial settings managed later by other features (tagged-mail handling, quarantine
  notification frequency and category, inbound and outbound TLS enforcement, rate limit). The
  screen MUST NOT be split into steps.
- **FR-019**: The local part field MUST show the domain as a suffix, show the normalised address
  (trimmed, lower-cased) before submitting, and check the API's local part rules before
  submitting: 1 to 64 characters, only ASCII letters, digits and ``! # $ % & ' * + / = ? ^ _ ` { | }
  ~ - .``, no leading, trailing or doubled dot, and a full address of at most 255 characters.
- **FR-020**: The domain field MUST offer the primary domains in the caller's scope with a search.
  After a domain is chosen, the form MUST show its mailboxes left, its default quota for a new
  mailbox and its largest quota for a new mailbox (feature 002), and MUST say when the domain is
  inactive or relayed as a backup MX, which does not prevent creation.
- **FR-021**: The template field MUST list every mailbox template, the Default template first and
  preselected. Choosing a template MUST fill every value the template holds into the form;
  when the user has already changed one of these values, the UI MUST ask before overwriting them.
- **FR-022**: The quota MUST be filled with the chosen template's quota, except that the domain's
  default quota for a new mailbox MUST be used when the chosen template is the Default template, or
  when the template's quota is unlimited and the caller may not give an unlimited quota. The form
  MUST refuse, before submitting, a quota above the domain's largest quota for a new mailbox.
- **FR-023**: The display name MUST be optional, with a hint that the local part is used when it is
  left empty.
- **FR-024**: The authentication source MUST default to the built-in authentication, labelled with
  the product name from the branding configuration. The UI MUST offer an external source only when
  the API reports it as allowed: for an existing mailbox, its current external source; any other
  external source, including at creation, only once the contract reports the configured provider
  type (API gap 1). For an external source the password field MUST be absent and forced password
  change unavailable; for the generic OIDC source forced two-factor setup MUST also be unavailable.
  Each unavailable control MUST state the reason.
- **FR-025**: The request MUST contain the local part, the domain, the chosen template, the
  password (unless the source is external) and the quota shown, and otherwise only the values that
  differ from the chosen template's values.
- **FR-026**: After a successful creation, the UI MUST open the new mailbox's detail screen,
  announce the success, and offer to add another mailbox with the same domain and template.
- **FR-027**: When the creation is refused, the UI MUST keep every entry, show field errors on
  their fields and every other error in a message, and translate them (FR-068). The "address in
  use" error MUST name the kind of object that uses the address, and "domain mailbox limit
  reached" MUST state the count and the limit.

#### Password entry, generation and policy

- **FR-028**: Wherever a password is set (creation and the sign-in section), the UI MUST offer one
  password field with a control to show or hide it, a "generate" action and a "copy" action that
  copies it to the clipboard only when the user asks. It MUST NOT require typing the password
  twice. A typed password MUST be hidden by default.
- **FR-029**: The generator MUST run in the browser, use a cryptographically secure random source
  and produce a password that meets every rule of the current password policy. The password MUST
  be at least 16 characters long, or the policy's minimum length when that is longer, MUST contain
  at least one lower-case letter, one upper-case letter and one digit, MUST contain a special
  character from a small set that mail clients accept when the policy requires special characters,
  and MUST NOT contain look-alike characters (0, O, 1, l, I). When the policy cannot be read, the
  generator MUST apply the same rules. A generated password MUST be displayed in clear text in the
  field.
- **FR-030**: The password policy MUST be read from the API (feature 003, read-only) whenever a
  password form opens. Its rules (minimum length, and whether letters, digits, special characters,
  and both lower and upper case are required) MUST be listed next to the field with the legacy
  wording, and each rule MUST be marked as met or not met while the user types. The marks MUST
  NOT block submission: the API's verdict decides, and its errors MUST appear on the password field
  naming each unmet rule with its parameter. A value that begins with a hash-scheme prefix the
  contract documents (for example `{SSHA512}`) MUST get a notice that it will be stored pre-hashed
  without the policy check. When the policy cannot be read, the form MUST say that the rules are
  unavailable and still allow submission.

#### Changing a mailbox

- **FR-031**: A mailbox MUST be changed in these sections, each with its own form and save action:
  - **General**: display name, quota, status, webmail redirect;
  - **Sign-in and password**: authentication source, password, forced password change, forced
    two-factor setup, recovery e-mail;
  - **Protocol access**: IMAP, POP3, SMTP, Sieve, ActiveSync and CalDAV/CardDAV;
  - **Permissions**: the user permission flags (FR-037);
  - **Tags** (FR-038);
  - **Custom attributes** (FR-039).
- **FR-032**: Saving a section MUST send only the values changed in it, together with the version
  of the mailbox the screen read. After a successful save, every section MUST show the returned
  mailbox and use its new version.
- **FR-033**: Leaving a section with unsaved changes MUST ask the user whether to discard them.
- **FR-034**: Wherever a quota is entered (creation, the general section, templates), it MUST be
  entered as a number with a MiB, GiB or TiB unit that comes to a whole number of MiB and at least
  1 MiB, with a separate "Unlimited" switch; typing 0 MUST NOT mean unlimited. A stored value MUST
  be shown in the largest unit that represents it exactly, as in UI feature 002. For a mailbox, the
  field MUST show the largest quota the mailbox may be given and refuse a larger value before
  saving, and a quota below the storage used MUST be accepted with a warning.
- **FR-035**: The status control MUST explain the effect of each value before saving: an active
  mailbox receives mail and signs in; a mailbox with login disallowed receives mail but cannot sign
  in and disappears from the webmail address book; an inactive mailbox receives no mail.
- **FR-036**: The sign-in section MUST apply FR-024 to the authentication source. When the user
  switches to the built-in authentication, a password field MUST appear with a hint that it is
  required when the mailbox has no password stored. The recovery e-mail MUST accept a valid e-mail
  address or be empty to clear it, and MUST only be shown for the built-in authentication. Leaving
  the password field empty MUST leave the password unchanged.
- **FR-037**: The permissions section MUST show the fifteen user permission flags as labelled on/off
  switches grouped by topic, with the legacy labels. Saving MUST send only the flags that changed.
- **FR-038**: The tags section MUST let the user add tags by typing and remove them one by one.
  Tags MUST be trimmed, not empty, at most 255 characters long, and a tag that differs from an
  existing one only in letter case MUST be treated as the same tag. The UI MUST prevent more tags
  than the limit (25 by default) and show the limit. Saving MUST send the whole set.
- **FR-039**: The custom attributes section MUST show the attributes as name and value rows, and
  let the user add, change and remove rows. Names MUST be 1 to 255 characters without whitespace and
  unique within the mailbox; values MUST be at most 4,096 characters; a mailbox MUST NOT have more
  than 100 attributes. Saving MUST send the added and changed attributes with their values and the
  removed ones as removals.
- **FR-040**: The overview MUST show read-only, with the name of the feature that manages them: the
  tagged-mail handling and inbound and outbound TLS enforcement (mailbox self-service), the
  quarantine notification frequency and category (quarantine and spam policy), the effective rate
  limit and whether it comes from the mailbox or the domain (quarantine and spam policy), the
  relayhost assignment (routing), the number of active temporary aliases and whether push
  notifications are active (mailbox self-service). Each MUST link to the screen that manages it once
  that screen exists in the app.

#### Domain administrator restrictions

- **FR-041**: For a domain administrator, the UI MUST make these settings read-only, showing their
  current or template value with the legacy note "Prohibited by ACL" and the name of the missing
  permission, when the matching flag is missing: protocol access ("Change protocol access"),
  webmail redirect ("Allow management of SOGo access") and the initial rate limit ("Rate limit").
  It MUST NOT offer an unlimited quota without the "Unlimited quota for mailboxes" flag, unless the
  mailbox already has one. A control MUST never be shown enabled for something the caller's flags
  deny.
- **FR-042**: User permissions that the API omits for a domain administrator MUST NOT be shown, and
  the permissions section MUST say that some permissions are hidden by the domain administrator's
  own permissions.
- **FR-043**: When the API refuses a request because a field is not permitted for the role, the UI
  MUST name the field and the missing permission in the user's language, refresh the identity and
  the mailbox, and keep the user's other entries.

#### Version conflicts

- **FR-044**: Every change, deletion and rename of a single mailbox or template MUST send the
  version the screen read. When the API refuses it as outdated, the UI MUST keep the user's entries,
  reload the object, tell the user that someone else changed it in the meantime, mark each field of
  the section whose stored value changed together with its new value, and let the user review and
  save again. A deletion or rename MUST ask for confirmation again against the reloaded object. The
  UI MUST NOT retry automatically and MUST NOT offer to overwrite the newer version.

#### Deleting a mailbox

- **FR-045**: Deleting a mailbox MUST require confirmation in a dialog that names the mailbox,
  shows its current storage used and message count, loaded when the dialog opens, says that its
  mail moves to mailcow's garbage area and is purged after the server's retention period (API gap
  4), and lists the kinds of data removed with it: aliases whose only recipient it is, sender
  permissions, sync jobs, temporary aliases, app passwords, filters, spam settings and allow and
  block lists, second factors and passkeys, quarantine items, push notification settings and
  webmail data. It MUST say that aliases with
  other recipients keep them. The confirm button MUST name the action and the mailbox, and the
  cancel choice MUST have the initial focus.
- **FR-046**: After a successful deletion, the UI MUST announce it, remove the mailbox from the
  list and return a detail screen to the list.
- **FR-047**: When the API refuses the deletion with a temporary failure, the UI MUST say that the
  mailbox was not deleted, that nothing was removed and that it can be tried again later, and MUST
  keep the mailbox listed.

#### Renaming a mailbox

- **FR-048**: The rename section MUST first show the legacy warning "IMPORTANT! Create a backup
  before renaming the mailbox." with the acknowledgement "I have created a backup.", and only then
  the form.
- **FR-049**: The rename form MUST ask for the new local part, shown with the fixed domain suffix
  and checked as in FR-019 and against the current local part (a change of letter case only is not
  a rename), and MUST require a yes/no answer to "Keep the old address as an alias" with nothing
  preselected. The rename MUST NOT be submittable until both are given.
- **FR-050**: Renaming MUST be unavailable for an inactive mailbox, with the reason.
- **FR-051**: After a successful rename, the UI MUST open the mailbox at its new address and
  announce the rename with both addresses.
- **FR-052**: The UI MUST explain each refusal: the new address in use (with the kind of holder),
  "mailbox cannot be renamed", the alias limit, and a temporary failure (the mailbox keeps its old
  address). For "rename incomplete", it MUST show a persistent report that lists the steps done
  and not done in the user's language with both addresses, advise contacting the server operator,
  refresh the list, and stay on the screen until the user dismisses the report.

#### Bulk actions

- **FR-053**: The list MUST let the user select mailboxes and apply one action to the selection:
  activate, disallow login, deactivate, remove, or allow or disallow one of the six protocols. The
  protocol actions MUST NOT be offered to a domain administrator without the "protocol access"
  flag.
- **FR-054**: A selection MUST hold only mailboxes of the current page and MUST be cleared, with an
  announcement, when the page, page size, search, filters or sort change. "Select all" MUST select
  every mailbox of the current page. The UI MUST show the number selected, and a selection MUST
  NOT exceed the bulk limit of 100, which equals the largest page size.
- **FR-055**: Every bulk action MUST be confirmed in a dialog that names the action, its effect and
  the number of mailboxes. A bulk deletion MUST also list the selected addresses and the impact of
  FR-045, and MUST require typing the number of selected mailboxes before it can be confirmed.
- **FR-056**: After a bulk action, the UI MUST show a summary with the number of mailboxes per
  outcome (done, not found, refused, failed) and a list of every mailbox with its translated
  outcome, and MUST announce the summary to assistive technology. Mailboxes that were refused or
  failed MUST stay selected; the others MUST be deselected. A whole-request refusal MUST be shown as
  one message naming the reason, with the selection kept. When no response arrives, the UI MUST
  report the outcome as unknown, refresh the list and MUST NOT repeat the request automatically.
- **FR-057**: On phones, selection MUST be started with an explicit "select" control, each card MUST
  get a selection control of at least 44×44 px, and the number selected and the actions MUST stay
  visible at the bottom of the screen.

#### Mailbox templates

- **FR-058**: Administrators and domain administrators MUST be able to list the mailbox templates
  with their name, quota, status, protocol access, webmail redirect, forced password change, forced
  two-factor setup, rate limit, tags and modification time, as cards on phones and as a table on
  wide screens, with pagination, a search on the name and sorting by name (default), identifier,
  creation time and modification time.
- **FR-059**: Administrators MUST be able to create, change and delete templates. The template form
  MUST hold the name and the values of a template: quota (FR-034), status, forced password change,
  forced two-factor setup, webmail redirect, protocol access, user permissions, tags, tagged-mail
  handling, quarantine notification frequency, quarantine category, inbound and outbound TLS
  enforcement and rate limit. A new template's form MUST start with the built-in
  defaults.
- **FR-060**: A template name MUST be required, at most 255 characters long and unique without
  regard to letter case. A duplicate MUST be shown on the name field.
- **FR-061**: Changing a template MUST send only the changed values with the version read (FR-044).
  The Default template's name MUST be read-only and it MUST NOT offer deletion, with an explanation.
- **FR-062**: Deleting a template MUST be confirmed in a dialog that names it and says that
  mailboxes created from it do not change.
- **FR-063**: Domain administrators MUST see templates read-only, without create, change or delete
  controls.

#### Change history

- **FR-064**: For administrators, the mailbox detail MUST offer a history of the mailbox's audit
  records, newest first and paginated, each with its time, actor, action, outcome (with the
  translated reason for refusals and failures) and changed values with old and new value. A
  password change MUST be shown only as "Password set", with whether it was pre-hashed. A rename
  record MUST show both addresses, and records of one bulk action MUST be recognisable as such.
  Domain administrators MUST NOT see the history.

#### States, feedback and errors

- **FR-065**: Every view that loads data MUST have a loading state that keeps the layout stable, an
  empty state that explains why it is empty and offers the next action, and an error state that
  explains the problem and offers to retry.
- **FR-066**: Submit actions MUST be disabled while their request is running, so that a double tap
  never sends a request twice.
- **FR-067**: Success and failure of every change MUST be announced as a status message that
  assistive technology reads out, and success messages MUST reuse the legacy texts where the meaning
  is unchanged (for example "Mailbox %s has been added", "Changes to mailbox %s have been saved",
  "Mailbox %s has been removed", "Mailbox was renamed from %s to %s").
- **FR-068**: The UI MUST translate every error type and validation rule code that API feature 003
  documents, with its parameters, into the user's language, including: not found, address in use
  (with the kind of holder), domain mailbox limit reached (count and limit), attribute not
  permitted for the role (field and permission), outdated version, mailbox cannot be renamed,
  rename incomplete (steps), template name already exists, protected template, temporary failure
  (mail store, webmail service or shared store), the quota rules with the bytes allowed, each
  password policy rule with its parameter, the tag limit and the read-only field rule. The English
  detail text of the API MUST NOT be shown to users as the message.
- **FR-069**: Field errors from the API MUST be shown on the matching fields, with a summary at the
  top of the form that links to each field and receives the focus after a failed submit.

#### Accessibility, internationalisation and mobile

- **FR-070**: Every screen of this feature MUST meet WCAG 2.2 AA: full keyboard operation with a
  visible focus, programmatic labels for every control including the switches and selection
  controls, sortable table headers that expose their sort state, dialogs that trap and return the
  focus, a text equivalent of each usage bar and icon, and sufficient contrast in light and dark
  themes.
- **FR-071**: Every screen MUST be designed first for a 360 px wide viewport with touch input:
  touch targets of at least 44×44 px, no horizontal scrolling of primary content, filters and
  sorting in a panel that opens over the list, and form groups that stack in one column.
- **FR-072**: All user-facing text MUST come from the translation files in English, Czech and
  Slovak. Legacy keys MUST be reused where the meaning is unchanged (the `mailbox`, `add`, `edit`,
  `acl`, `tfa`, `user`, `danger`, `success` and `warning` sections, for example `acl.prohibited`,
  `edit.mailbox_rename_warning`, `warning.quota_exceeded_scope`). Legacy texts that embed the product
  name (the password reset permission and the built-in authentication source) MUST take the product
  name from the branding configuration (feature 001).
- **FR-073**: Sizes MUST be shown in binary units (MiB, GiB, TiB), and numbers, dates and times in
  the user's locale and time zone.

#### Security in the browser

- **FR-074**: Passwords MUST NOT be written to browser storage, links, the page title or any log,
  and MUST be removed from memory after a successful submit or when the form is left. Only the
  column and page-size preferences of FR-008 MAY be stored in the browser.
- **FR-075**: Text that comes from the API (display names, tags, custom attributes, template names)
  MUST be displayed as text, never interpreted as markup.

### Legacy Parity

Legacy reference: FeldHost fork `feldhost-202609a` of upstream tag `2026-09a`,
`data/web/templates/mailbox/tab-mailboxes.twig`, `mailbox/tab-templates-mbox.twig`,
`modals/mailbox.twig` (add-mailbox and add-template modals), `edit/mailbox.twig`,
`edit/mailbox-templates.twig`, `js/site/mailbox.js`, `js/site/edit.js`, `js/build/011-api.js`
and `js/build/013-mailcow.js`. **Matched** keeps the behaviour, **Improved** keeps the purpose
with a better behaviour, **Deferred** moves it to the named feature of this app, **Dropped**
removes it, and **Blocked by an API gap** waits for a capability listed under API gaps.

#### Mailbox list ("Mail setup › Mailboxes" tab)

| Legacy element | Requirements | Status and reason |
|---|---|---|
| Column: username (address) | FR-007, FR-008 | Matched; display name shown under it |
| Column: quota (used / total, "∞") | FR-008, FR-011 | Improved: "Unlimited" in words, locale sizes |
| Column: in use (%) with coloured bar (75/90 thresholds) | FR-011 | Improved: same thresholds, text equivalent |
| Column: last mail login (IMAP, POP3, SMTP, SSO badges) | FR-008, FR-015 | Improved: most recent in the list, each service on the detail screen; never "never" when hidden |
| Column: last password change | FR-008 | Matched (optional column) |
| Column: message count | FR-007, FR-008 | Matched |
| Hidden columns: full name, domain | FR-007, FR-008 | Improved: visible without row collapse |
| Hidden column: identity provider (fork label "FeldHost™ Mailhosting") | FR-008, FR-072 | Improved: label from branding, not hard-coded |
| Hidden columns: TLS in/out, SMTP, IMAP, POP3, Sieve, EAS, DAV | FR-008, FR-015 | Improved: optional columns and detail overview instead of row collapse |
| Hidden columns: quarantine notification, quarantine category | FR-008, FR-040 | Matched as optional read-only columns |
| Hidden columns: created on, last modified, tags | FR-008 | Matched (tags shown by default) |
| Column: active (✓, ✗, "—" for login disallowed) | FR-012 | Improved: text badge instead of a dash |
| Row action: Edit | FR-013 | Matched |
| Row action: Remove | FR-013, FR-045 | Improved: confirmation shows impact |
| Row actions: Login (dual login), SOGo | — | Deferred to feature 007 (login-as) |
| Search box (server-side search) | FR-009 | Improved: matches tags, debounced, part of the link |
| No domain, status, tag or source filter | FR-009 | Improved: new filters offered by the API |
| Sorting by clicking headers | FR-010 | Improved: also on phones |
| Page length selector | FR-006, FR-008 | Matched (25, 50, 100), remembered |
| "Refresh" button | FR-014 | Matched, plus automatic refresh after own changes |
| Count badge in the card header | FR-006 | Matched (total) |
| "Toggle all" | FR-054 | Matched: selects the current page (at most 100) |
| "Expand all" / "Collapse all" | FR-007, FR-008 | Dropped: no row collapse any more |
| Mass actions: activate, disallow login, deactivate, remove | FR-053 to FR-056 | Improved: confirmation and one result per mailbox instead of a page reload |
| Mass actions: protocol on/off (six protocols) | FR-053 | Matched; hidden without the "protocol access" flag |
| Mass actions: TLS in/out, quarantine notification, quarantine category | — | Deferred to features 005 and 006, which own these settings |
| Mass actions hidden on the smallest screens | FR-057 | Improved: selection mode on phones |
| "Add mailbox" button | FR-018 | Matched; opens a screen instead of a modal |

#### Add-mailbox modal

| Legacy element | Requirements | Status and reason |
|---|---|---|
| Username (local part) with pattern | FR-019 | Improved: all API rules checked, normalised preview |
| Full name | FR-023 | Matched; hint about the local part default |
| Domain select with live search | FR-020 | Improved: domain figures, inactive and backup MX notes |
| Template select (Default preselected, fills the form) | FR-021, FR-022 | Matched; asks before overwriting the user's changes |
| Password and "generate" link | FR-028, FR-029 | Improved: secure generator that meets every rule |
| Confirmation password (repeat) | FR-028 | Dropped: show/hide control instead (API takes the password once) |
| "Check against haveibeenpwned.com" | — | Dropped: the app makes no third-party requests (constitution, privacy and CSP) |
| Password policy as server-rendered HTML list | FR-030 | Improved: structured rules, live met/unmet marks |
| Tags | FR-038 | Improved: case-insensitive duplicates, limit shown |
| Quota (MiB) with "max." badge, "0 = ∞" | FR-022, FR-034 | Improved: explicit unlimited option and units |
| "Domain quota exceeded" warning | FR-022, Edge Cases | Matched (`warning.quota_exceeded_scope`) |
| Tagged-mail handling, quarantine notification and category, TLS policy | FR-018 | Matched as initial settings, collapsed by default |
| Allowed protocols (multi-select) | FR-018, FR-041 | Improved: switches, read-only without the flag |
| ACL (multi-select of 15 flags) | FR-037, FR-042 | Improved: grouped switches, hidden flags omitted |
| Rate limit (value and frame) | FR-018, FR-041 | Matched; read-only without the "rate limit" flag |
| Status select | FR-018, FR-035 | Improved: effect explained |
| Force password update, force 2FA, SOGo access checkboxes | FR-018, FR-024 | Matched; unavailable with the reason for external sources |
| Hidden authentication source (`mailcow` only) | FR-024 | Matched: built-in authentication at creation until the API reports the configured provider type (API gap 1) |
| Form cache in browser storage | FR-074 | Dropped: passwords are never stored in the browser |
| Errors as toasts after reload | FR-027, FR-069 | Improved: field errors on fields, entries kept |

#### Edit mailbox page

| Legacy element | Requirements | Status and reason |
|---|---|---|
| Tabs collapsing into cards on phones, remembered in browser storage | FR-016, FR-031 | Improved: sections with their own links |
| Identity provider select | FR-024, FR-036 | Matched for keeping the current source and switching to the built-in one; switching to another external source is blocked by API gap 1 |
| Full name, quota with "max." badge, status | FR-031, FR-034, FR-035 | Matched in the general section |
| Tags with click-to-delete badges | FR-038 | Matched in the tags section |
| Allow to send as (sender ACL) | — | Deferred to feature 004 |
| Sender-dependent transports (relayhost) | FR-040 | Deferred to feature 009; shown read-only |
| Tagging, quarantine notification and category, TLS policy buttons | FR-040 | Deferred to features 005 and 006; shown read-only |
| Password, repeat, generate, haveibeenpwned | FR-028 to FR-030 | Improved as on the add form; repeat and haveibeenpwned dropped |
| Password recovery email | FR-036 | Improved: validated as an e-mail address |
| External sender addresses | — | Deferred to feature 004 |
| Allowed protocols | FR-031, FR-041 | Matched in the protocol access section |
| Allowed hosts for SMTP (hidden in legacy) | — | Dropped: not shown in legacy and not offered by the API |
| Force password update, force 2FA, SOGo access | FR-031, FR-036 | Matched |
| SOGo access hidden when webmail is disabled on the server | FR-031 | Blocked by API gap 2: the setting is always shown |
| Created on, last modified | FR-015 | Matched |
| Controls disabled with "Prohibited by ACL" | FR-041, FR-042 | Matched; omitted permissions not shown |
| Custom attributes tab (rows, add row, remove row) | FR-039 | Improved: per-attribute changes, validation |
| Pushover tab | FR-040 | Deferred to feature 005; "push notifications active" shown read-only |
| ACL tab | FR-037 | Matched in the permissions section |
| Rate limit tab | FR-040 | Deferred to feature 006; effective rate limit shown read-only |
| Rename tab: backup warning and "I have created a backup." | FR-048 | Matched |
| Rename tab: new local part with domain suffix | FR-049 | Improved: validated before submitting |
| Rename tab: "Create alias automatically" (checked by default) | FR-049 | Improved: explicit choice required |
| No concurrent-edit protection | FR-044 | Improved: version check on every save |

#### Mailbox templates tab and edit page

| Legacy element | Requirements | Status and reason |
|---|---|---|
| Columns: ID, template, quota, TLS in/out, six protocols, SOGo, quarantine notification and category, force password update, force 2FA, rate limit, tags, active | FR-058 | Matched; protocols summarised on cards |
| Edit action; no delete for Default | FR-061 | Matched; name read-only for Default |
| Add template modal | FR-059, FR-060 | Improved: screen instead of a modal; duplicate name on the field |
| Template edit page | FR-059, FR-061 | Improved: only changed values sent |
| Mass "Remove" of selected templates | FR-062 | Dropped: templates are deleted one at a time; there are few, and the API has no bulk template action |
| ActiveSync never stored for new templates (legacy form bug) | FR-059 | Improved: one switch per protocol |
| Templates visible to domain administrators | FR-063 | Matched, read-only |

#### Shared behaviour

| Legacy element | Requirements | Status and reason |
|---|---|---|
| Delete confirmation modal listing the object ids | FR-045, FR-055 | Improved: impact shown, bulk deletion lists addresses |
| Pinch-zoom disabled, row collapse, modals as forms | FR-071 | Improved: mobile-first screens with zoom allowed (constitution II) |
| Success and error toasts (`success.*`, `danger.*`) | FR-067, FR-068 | Matched texts, announced to assistive technology |

### API Dependency

This feature depends on **mailcow REST API v2 feature 003 (Mailboxes)**, `specs/003-mailboxes/spec.md`
in mailcow-rest-v2, through the operations of its released contract. It also uses API feature 001
(identity, role, scope and permission flags; branding; error conventions) and API feature 002
(domains and their figures). Behaviours relied on:

| Behaviour | API 003 requirements | Used by |
|---|---|---|
| Paginated list of mailboxes in scope with total, default 25 | FR-012 | FR-006 |
| Filters by domain, status, tag, authentication source, several values each; free-text search over address, name and tags | FR-013, FR-014 | FR-009 |
| Sort fields and order, missing values last | FR-015 | FR-010 |
| Full representation in each list entry | FR-016, FR-008 | FR-007, FR-008, FR-017 |
| Inspection with a version tag; "not found" for foreign and missing mailboxes | FR-017, FR-003, FR-038 | FR-004, FR-015, FR-044 |
| Usage, percentage, largest quota allowed, last logins and the missing-value rules | FR-008 to FR-011 | FR-011, FR-015, FR-034 |
| Creation with template, defaults and limits; normalisation rules; address-in-use and mailbox-limit conflicts | FR-018 to FR-028 | FR-018 to FR-027 |
| Password rules, pre-hashed values, external authentication sources | FR-024, FR-025, FR-033 | FR-024, FR-028 to FR-030, FR-036 |
| Partial changes, read-only field rule, quota and status rules | FR-029 to FR-034 | FR-031 to FR-036 |
| User permissions, omission for domain administrators, tags as a set, custom attributes per name | FR-035 to FR-037 | FR-037 to FR-039, FR-042 |
| Domain administrator flag checks with "attribute not permitted" naming field and flag | FR-006 | FR-041, FR-043 |
| Version tags on mailboxes and templates, outdated refusal | FR-038 | FR-044 |
| Deletion with refusal when the garbage move is not confirmed | FR-039 to FR-042 | FR-045 to FR-047 |
| Rename with required alias choice, preflight checks, undo and "rename incomplete" steps | FR-043 to FR-048 | FR-048 to FR-052 |
| Mailbox templates CRUD, Default protection, case-insensitive unique names | FR-049 to FR-053 | FR-058 to FR-063 |
| Bulk actions on up to 100 mailboxes with one result per mailbox | FR-054, FR-055 | FR-053 to FR-056 |
| Read-only password policy as structured rules | FR-063 | FR-029, FR-030 |
| Audit records with changed values; target filter | FR-056, FR-057 | FR-064 |
| Error types and validation rule codes with parameters | FR-058, FR-059 | FR-027, FR-068, FR-069 |
| Domain list and detail: mailboxes left, default and largest quota for a new mailbox, readable names | API 002 FR-007, FR-008, FR-011 | FR-009, FR-020, FR-022 |
| Identity with role, scope and permission flags; branding product name | API 001 FR-028, FR-042 | FR-001, FR-003, FR-072 |

#### API gaps

Capabilities this feature needs that the API contract does not offer. Each is to be specified in
mailcow-rest-v2 first (constitution I); the UI does not work around them.

1. **Allowed authentication sources**: the API reports each mailbox's source, but not which
   external identity provider type is configured (API 001's public configuration only says whether
   one is). API 012's draft spec already assumes that domain administrators learn the configured
   type through feature 003, which API 003 does not yet offer. Until it does, the UI cannot offer
   creating a mailbox with an external source or switching a mailbox to an external source it does
   not already use (FR-024).
2. **Webmail disabled on the server**: the API does not report whether webmail is disabled (legacy
   `SKIP_SOGO`). Legacy then hides the webmail redirect setting; this UI shows it in every case
   (FR-031, FR-059).
3. **Last logins turned off**: when the operator turns off last logins, the API omits them, which
   looks the same as a mailbox that never logged in. The UI shows "No login recorded" in both cases
   (FR-015).
4. **Deletion impact and retention period**: the API reports neither the number of dependent
   objects a deletion removes or changes (aliases removed and aliases that only lose this
   recipient, sender permissions, sync jobs, app passwords, second factors and passkeys) nor the
   garbage-area retention period. The confirmation therefore lists kinds of data and names "the
   server's retention period" without numbers (FR-045).
5. **Operator-configured limits**: the bulk limit, the tag limit and the custom-attribute limits
   can be changed by the operator but are not reported. The UI states the documented defaults, and
   when an operator lowered a limit the API's validation error shows the real one (FR-038, FR-039,
   FR-054).
6. **Tags in use** (optional): there is no list of the mailbox tags in use, so the tag filter and
   the tag input cannot suggest existing tags (FR-009, FR-038).

### Key Entities *(include if feature involves data)*

- **Mailbox** (API 003): address, local part, domain, display name, status, authentication source,
  quota and usage, largest quota allowed, protocol access, webmail redirect, forced flags, user
  permissions, tags, custom attributes, recovery e-mail, password-changed time, last logins,
  read-only settings of other features, times and version tag.
- **Mailbox template** (API 003): identifier, name, Default marker, the starting values of a new
  mailbox, times and version tag.
- **Password policy** (API 003, read-only): minimum length and the required character classes.
- **Domain summary** (API 002): readable and ASCII name, active and backup MX state, mailboxes left,
  default and largest quota for a new mailbox.
- **Bulk action result** (API 003): the action and one outcome per mailbox.
- **Audit record** (API 001/003): time, actor, action, outcome, target and changed values.
- **Selection** (in the browser only): up to 100 mailbox addresses chosen for a bulk action.
- **Section draft** (in the browser memory only): the unsaved entries of one section or form.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a 360 px phone, an administrator finds a mailbox among 10,000 by a fragment of its
  address or name and opens its details within 10 seconds.
- **SC-002**: In moderated tests, 90% of administrators create a mailbox from a template on a phone
  on the first attempt, within 2 minutes.
- **SC-003**: The first page of the mailbox list is visible within 2 seconds of opening the screen
  on a mid-range phone over a typical mobile connection, for a server with 10,000 mailboxes.
- **SC-004**: Every screen and dialog of this feature passes the automated WCAG 2.2 AA checks with
  zero violations on the 360 px and the desktop viewport, in light and dark themes, and needs no
  horizontal scrolling at 360 px.
- **SC-005**: 100% of the error types and validation rule codes that API feature 003 documents are
  shown as translated messages in English, Czech and Slovak; no translation key is missing.
- **SC-006**: In 100% of conflict tests, an outdated save, deletion or rename changes nothing, the
  user is told, and their entries are kept.
- **SC-007**: For a bulk action on 100 mailboxes, the user sees one outcome per mailbox, and the
  summary counts match the API's results in 100% of tests.
- **SC-008**: 100% of 10,000 generated passwords per policy configuration meet that policy.
- **SC-009**: A scan of browser storage, page links and console output after the full end-to-end
  run finds no password.
- **SC-010**: In tests with domain administrators lacking each relevant flag, 100% of the gated
  controls are read-only or absent, and each refusal the API still returns names the permission.
- **SC-011**: 100% of the legacy elements in the parity tables are covered by a requirement or
  have a recorded reason for being deferred or dropped.

## Assumptions

- Feature 001 of this app provides sign-in, the app shell and navigation, the identity with role,
  scope and permission flags, branding, languages and themes, the handling of 401, 403 and the
  restricted session, and the placeholder rule for screens of later features. Feature 002 provides
  the domain screens and links to this feature's list and create screen.
- API feature 003's contract is not yet published in mailcow-rest-v2's `api/` directory. This
  feature can be planned now and starts implementation once that contract is merged and pinned; it
  is built and tested against a mock generated from it until the API is implemented.
- Data volume follows API 003: up to 10,000 mailboxes in 500 domains per server, and tens of
  templates.
- The API's defaults apply until the contract states otherwise: page size 25, bulk limit 100, tag
  limit 25, custom attributes limited to 100 per mailbox, 255-character names and 4,096-character
  values. When an operator configures other limits, the API's validation errors carry them.
- The UI does not show the version tag; it only sends it.
- The settings managed by other features stay read-only here until those features of this app
  exist; their bulk actions arrive with them.
- **Out of scope**: sender permissions and external sender addresses (004), the mailbox user's own
  settings, pushover and recovery e-mail (005), quarantine notification settings and rate limits
  after creation (006), login-as and webmail login on behalf of a user (007), sync jobs (008),
  relayhost assignment (009), identity-provider provisioning (012), editing the password policy
  (013), resources (004), and the general audit log screen (001).
