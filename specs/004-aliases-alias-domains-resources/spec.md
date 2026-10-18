# Feature Specification: Aliases, Alias Domains, Resources and Sender Permissions

**Feature Branch**: `main` (no feature branches, constitution 1.2.0; spec directory
`specs/004-aliases-alias-domains-resources`)

**Created**: 2026-10-18

**Status**: Draft

**Depends on**: mailcow-rest-v2 feature 004 "Aliases, Alias Domains, Resources and Sender
Permissions" (`mailcow-rest-v2/specs/004-aliases-alias-domains-resources/spec.md` at commit
`8b59f80`) and the API's cross-feature conventions (`mailcow-rest-v2/docs/conventions.md`). The
contract version is pinned when the feature 004 contract is merged, at the latest in this feature's
plan.

**Input**: User description: "Aliases, alias domains, resources and sender permissions screens for
mailcowui-ng, the mobile-first web app for an existing mailcow-dockerized server. Its only backend
is mailcow REST API v2 feature 004. Administrators and domain administrators find, inspect, create,
change and delete aliases, including catch-all aliases and the special actions discard, learn as
spam and learn as ham. They copy aliases over a domain's alias domains, manage alias domains and
groupware resources, decide what a mailbox may send as (explicit send-as permissions, the 'any
address' permission and external sender addresses), and apply mass actions to selected objects.
Everything follows the API's per-role permission matrix and the domain administrator's permission
flags; mailbox users have no access. Destructive actions need explicit confirmation, lists become
cards on phones, every view has loading, empty and error states, and stale edits are detected by
version tag. The feature replaces the legacy Mail setup › Aliases, Alias domains and Resources tabs,
their add dialogs and edit pages, and the 'Allow to send as' and 'External sender addresses' fields
of the legacy Edit mailbox page. It builds on UI features 001 (sign-in, app shell, navigation, i18n,
error handling), 002 (domains) and 003 (mailboxes)."

## Clarifications

### Session 2026-10-18

- Q: Should aliases, alias domains and resources stay tabs of one mail setup page, as in legacy, or
  become separate screens? → A: Separate screens, each with its own navigation entry and address, in
  the mail setup group of UI feature 001 (FR-001, FR-006). (agent decision: constitution II wants
  lists, not collapsed cards used as tabs, on phones, and the legacy inventory names that pattern as
  a mobile problem; separate addresses make filtered lists restorable and shareable.)
- Q: Which term does the app use, "alias domain" or "domain alias"? → A: "Alias domain" everywhere.
  The legacy keys `mailbox.domain_aliases` and `mailbox.add_domain_alias` are reused with their Czech
  and Slovak texts, and their English texts become "Alias domains" and "Add alias domain" (FR-067,
  Translation reuse). (agent decision: API feature 004 and the legacy add form and edit page say
  "alias domain", the Czech and Slovak legacy texts already use a single term, and the meaning is
  unchanged, so constitution IV's key reuse applies.)
- Q: Where does a user manage what a mailbox may send as? → A: On a separate "Send as" screen opened
  from the mailbox detail screen of UI feature 003, not inside the mailbox edit form (FR-048).
  (agent decision: the API models sender settings as a separate resource with its own version tag,
  constitution II asks for long forms to be split, and the legacy Edit mailbox form is one of the
  largest forms of the legacy UI.)
- Q: Should the add forms accept several alias addresses or alias domain names at once, as legacy
  does, although the API creates one object per request? → A: Yes. The app sends one creation per
  entry, in the order entered, shows one result per entry and keeps refused entries in the field for
  correction (FR-021, FR-037). (agent decision: the API clarification expects the web app to send one
  request per address of the legacy multi-address form; this keeps legacy parity, and per-entry
  results replace legacy's silent skipping.)
- Q: How does the user choose between destination addresses and a special action? → A: With one
  single-choice control: "Deliver to addresses", "Discard silently", "Learn as spam" or "Learn as
  ham". The address list is editable and sent only for the first choice (FR-018). (agent decision:
  the API refuses a special action combined with addresses or a second special action; a single
  choice makes those combinations impossible and is clearer on touch and for screen readers than the
  legacy mutually exclusive checkboxes.)
- Q: What does the app do when a save is refused because the object was changed elsewhere? → A: It
  keeps the user's entries, reloads the object, marks each field whose stored value changed in the
  meantime together with its new value, and asks the user to review and save again or discard. A
  deletion is confirmed again against the reloaded object. Nothing is retried or overwritten
  automatically. Mass actions send each object's version tag from the list, and objects changed
  since are reported as changed elsewhere and stay selected (FR-026, FR-027, FR-059). (agent
  decision: the API refuses outdated changes and checks per-item version tags in bulk actions; UI
  features 002 and 003 use the same pattern, so users meet one behaviour across the app.)
- Q: How do mass actions work on a phone, and how many objects can be selected? → A: An explicit
  "Select" control enters selection mode with 44 px checkboxes and an action bar that stays visible.
  The selection holds only objects of the current page and is cleared, with an announcement, when
  the page, page size, search, filters or sort change. "Select all" selects the current page, whose
  largest size equals the bulk limit of 100 (FR-056, FR-060). (agent decision: long-press is neither
  discoverable nor accessible; one page is one bulk request within the API limit; clearing the
  selection never lets an action reach objects the user no longer sees; UI features 002 and 003 do
  the same.)
- Q: How is the "any address" permission presented? → A: As a separate switch shown only to
  administrators, with a warning that it disables the sender check and replaces the other explicit
  permissions; domain administrators see the resulting status read-only (FR-051). (agent decision:
  the API stores "any address" alone and lets only administrators grant it; legacy hides it as one
  entry of a long multi-select, which makes a security-relevant setting easy to miss.)
- Q: What does a domain administrator without the "extend sender ACL" permission see of a mailbox's
  external sender addresses? → A: The addresses, read-only, with a note that an administrator grants
  the permission. The app does not send them when saving other send-as changes (FR-052, FR-054).
  (agent decision: the API lets domain administrators read the sender settings of their mailboxes
  and refuses only changes; seeing why a mailbox may send as an outside address helps support,
  whereas legacy hides the field and with it relevant state.)
- Q: How does the alias domain form offer the DKIM key? → A: A "Generate a DKIM key" switch, on by
  default, with the selector and key size pre-filled from the server's defaults in the feature's
  capabilities and editable; turning the switch off creates the alias domain without a key (FR-036).
  (agent decision: legacy pre-fills the selector and key size, API FR-068 provides the defaults,
  including the fork's `feldhost` selector, and the API skips the key for an explicitly empty
  selector; a switch makes "no key" a visible choice instead of an emptied field.)
- Q: Should the resource form show the address that will be derived from the description before
  saving? → A: Yes, as a labelled preview computed with the derivation rule documented in the
  contract; the address the server returns is authoritative (FR-045). (agent decision: the derived
  address can never be changed afterwards, so users must see it before committing; legacy derives it
  silently, which surprises users with descriptions such as "Raum Süd", which becomes `RaumSd@…`.)
- Q: How strong must the delete confirmations be? → A: A single deletion uses a dialog that names
  the object, states what else is removed (for an alias domain, the number of its aliases) and has a
  confirm control that names the action. A mass deletion lists every selected object and also
  requires typing the number of selected objects. Deactivating or hiding a selection needs one
  confirmation that names the action, its effect and the count; activating and showing need none
  (FR-029, FR-058). (agent decision: constitution II requires explicit confirmation that shows what
  is affected; typing the count guards the one action that can delete 100 objects at once without
  slowing single deletions on a phone; this matches UI feature 003's mailbox deletions.)

## User Scenarios & Testing *(mandatory)*

Actors: **administrators** (all objects), **domain administrators** (objects of the domains they
manage, limited by their permission flags) and **mailbox users** (no access to anything in this
feature; their own send-as view is UI feature 005). Every story is tested end to end on a 360 px
touch viewport and on a desktop viewport, against a mock generated from the pinned contract.

### User Story 1 - Find and inspect aliases (Priority: P1)

An administrator opens "Aliases" from the mail setup navigation on a phone. The newest aliases are
listed first as cards. Each card shows the address, a "Catch-all" badge where it applies, the
destinations (or the special action, such as "Learn as spam"), the domain and, for an alias in an
alias domain, the primary domain it belongs to, plus text badges for inactive, internal, hidden from
the groupware and receive-only aliases. They search by a fragment of an address, a destination or a
comment, narrow the list with filters, change the sort order and page through the results. Opening
an alias shows all its settings. On a wide screen the same list is a table with sortable columns.

A domain administrator sees the same screen, limited to the aliases of the domains they manage and
of those domains' alias domains.

**Why this priority**: Every alias task starts by finding the alias, and the legacy list becomes
unusable on phones and on large servers. It is also the safest first slice, because it changes
nothing.

**Independent Test**: Against mock data with aliases of every kind (regular, catch-all, each special
action, in alias domains, inactive, internal, hidden, receive-only, orphaned, with many
destinations), open the list and detail as an administrator and as a domain administrator, use each
search, filter and sort option, and compare every value shown with the mock data.

**Acceptance Scenarios**:

1. **Given** 60 aliases, **When** an administrator opens the alias list on a 360 px screen, **Then**
   the 25 newest aliases are shown as cards with the total of 60, without horizontal scrolling, and
   the next page can be opened.
2. **Given** the alias `info@example.net`, where `example.net` is an alias domain of `example.org`,
   **When** it is listed, **Then** the card shows the domain `example.net` and states that it
   belongs to `example.org`.
3. **Given** an alias with the special action "learn as spam", **When** it is listed or opened,
   **Then** it shows the text "Learn as spam" instead of destination addresses.
4. **Given** an alias with 12 destinations, **When** it is listed, **Then** the card shows the first
   two and "+10 more", and the detail view shows all 12.
5. **Given** aliases whose address, destination or comment contains "invoice", **When** the
   administrator searches for "INVOICE", **Then** exactly those aliases are listed, the number of
   results is announced to screen readers, and the search survives opening an alias and going
   back.
6. **Given** three aliases that deliver to `anna@example.org`, **When** the list is filtered by that
   destination, **Then** exactly those three are listed and the active filter is shown as a
   removable chip.
7. **Given** filters that match nothing, **When** the list loads, **Then** an empty state says that
   no alias matches and offers to clear the filters. **Given** a server with no aliases at all,
   **Then** the empty state offers "Add alias".
8. **Given** an API that does not respond, **When** the list loads, **Then** an error state with a
   retry action is shown instead of an empty list.
9. **Given** a domain administrator who manages two of ten domains, **When** they open the list,
   **Then** only aliases of those domains and their alias domains appear. **When** they open the
   address of an alias of a third domain directly, **Then** the app shows its "not found" state.
10. **Given** a mailbox user, **When** they look at the navigation, **Then** there is no entry for
    aliases, alias domains or resources, and opening such an address directly shows the "no access"
    state of UI feature 001.

---

### User Story 2 - Create aliases (Priority: P1)

An administrator taps "Add alias". The form, full screen on a phone, has four short sections:
addresses, destination, options and comments. They enter one or more addresses, or `@domain` for a
catch-all, and choose either "Deliver to addresses" with a list of destinations or one special
action: discard silently, learn as spam or learn as ham. The alias is active, allowed to send and
visible in the groupware unless they change that, as in the legacy form; they can mark it internal
and add a public and a private comment. Each option explains its effect. After saving they see the
new alias, or a result per address when they entered several.

**Why this priority**: Aliases are the second most frequent provisioning object after mailboxes,
and creating them is the main reason operators open these screens.

**Independent Test**: Create aliases with each kind of destination, as an administrator and as a
domain administrator with and without the external-destination permission, with one and with
several addresses, and with mocked refusals for every documented error type. Check the requests
sent, the messages shown and where they appear.

**Acceptance Scenarios**:

1. **Given** the form with `sales@example.org` delivering to `anna@example.org` and
   `bob@example.org`, **When** the administrator saves it, **Then** the creation is announced, the
   new alias's detail view opens, and the alias appears in the list.
2. **Given** the address `@example.org`, **When** it is entered, **Then** the form marks it as a
   catch-all before saving, and after saving the alias carries the "Catch-all" badge.
3. **Given** the special action "Discard silently" is chosen, **When** the form is shown, **Then**
   the destination list cannot be edited and its content is not sent.
4. **Given** an address that already belongs to a mailbox, a resource, an alias or a temporary alias,
   **When** the form is saved, **Then** the address field shows a translated message naming which
   kind of object holds the address, and every value entered stays in the form.
5. **Given** a domain whose alias limit is reached, **When** an alias is saved in it, **Then** the
   message states the number of aliases in use and the limit.
6. **Given** three destinations of which one is not a valid address, **When** the form is saved,
   **Then** the destination field names the invalid destination and nothing is created.
7. **Given** a domain administrator without the external-destination permission, **When** they open
   the form, **Then** the destination field states that only addresses of domains hosted on this
   server can be added. **When** they save an external destination anyway, **Then** the message
   names the destination and the missing permission. **Given** a server where external destinations
   are disabled for everyone, **Then** administrators see the same notice.
8. **Given** the addresses `info@`, `sales@` and `office@example.org`, of which `sales@` is in use,
   **When** the form is saved, **Then** two aliases are created, a summary lists both with links and
   the refusal of `sales@` with its reason, and only `sales@example.org` stays in the address field
   for correction.
9. **Given** a private comment longer than 160 bytes, **When** the user tries to save, **Then** the
   form is not sent and the comment field states the limit of 160 bytes.
10. **Given** a form with unsaved input, **When** the user navigates away, **Then** the app asks
    whether to discard the input.
11. **Given** a server whose groupware is disabled, **When** the form opens, **Then** it has no
    "visible in the groupware" option, and the alias list shows no groupware visibility badges or
    actions, as in legacy.

---

### User Story 3 - Change or delete an alias (Priority: P1)

An administrator or a domain administrator opens an alias and edits its address, destinations or
special action, its options or its comments. Only the values they changed are saved, together with
the version they read, so that an edit made meanwhile in the legacy UI or by a colleague is not
overwritten. They delete an alias after confirming a dialog that names the alias and what the
deletion removes.

**Why this priority**: Operators change destinations whenever staff change and remove aliases with
the customer. Without editing, creation alone is not a usable product.

**Independent Test**: Edit each attribute and check the request carries only the changed values and
the version. Mock an outdated version, a deleted alias and a permission refusal on save. Delete with
and without confirming.

**Acceptance Scenarios**:

1. **Given** `sales@example.org` delivering to Anna, **When** the destination is changed to Bob and
   saved, **Then** the detail view shows Bob and the change is announced.
2. **Given** an alias the user opened, which a colleague then changed, **When** the user saves,
   **Then** the app explains that the alias was changed elsewhere, lists the values the user had
   entered, and offers to load the latest version. Nothing is overwritten.
3. **Given** an alias with an external destination set by an administrator, and a domain
   administrator without the external-destination permission, **When** the domain administrator
   deactivates the alias, **Then** the change is saved, because the destinations are not sent.
4. **Given** an alias with destination addresses, **When** the user switches it to "Learn as ham"
   and saves, **Then** the detail view shows the special action and no destinations.
5. **Given** an alias, **When** the user chooses "Delete", **Then** a confirmation names the address
   and states that mail to it will no longer be accepted and that permissions of other mailboxes to
   send as it are removed. **When** they confirm, **Then** the alias is gone from the list. **When**
   they cancel, **Then** nothing changes and focus returns to the delete control.
6. **Given** an alias deleted by someone else, **When** the user saves a change to it, **Then** the
   app says the alias no longer exists and returns to the list.
7. **Given** an orphaned alias whose domain no longer exists, **When** an administrator opens it,
   **Then** a warning explains the situation, deletion is offered, and a change can only be saved
   together with an address in an existing domain.

---

### User Story 4 - Manage alias domains (Priority: P2)

An administrator, or a domain administrator with the "alias domains" permission, adds an alias
domain such as `example.net` for `example.org`, so that every mailbox of `example.org` also receives
mail under the other name. They pick the target from their domains, decide how the DKIM key is
generated and, when allowed, set an initial rate limit. Afterwards they see which follow-up steps
succeeded. Later they point the alias domain at another domain, deactivate it, or delete it after a
confirmation that states how many aliases go with it.

**Why this priority**: Alias domains are common for customers with several brands, but less frequent
than aliases, and the legacy UI keeps working meanwhile.

**Independent Test**: List, create, change and delete alias domains as an administrator and as
domain administrators with and without the "alias domains" and "rate limit" permissions, with
mocked creation reports that contain failed steps, and with each documented refusal.

**Acceptance Scenarios**:

1. **Given** a domain administrator with the "alias domains" permission who manages `example.org`,
   **When** they create `example.net` for it, **Then** the app shows the alias domain as created and
   lists each follow-up step (rate limit, DKIM key, DKIM DNS publication, groupware update) with its
   outcome.
2. **Given** a creation report in which the DKIM key failed, **When** it is shown, **Then** the alias
   domain is presented as created, and the failed step is a warning that says where DKIM keys are
   managed.
3. **Given** a domain administrator without the "alias domains" permission, **When** they open the
   alias domain list, **Then** they see their alias domains but no "Add alias domain" control, and a
   note says that an administrator grants this permission.
4. **Given** a domain administrator without the "rate limit" permission, **When** they open the
   creation form, **Then** it has no rate limit fields.
5. **Given** a name that already exists as a domain or alias domain, **When** the form is saved,
   **Then** the name field says so.
6. **Given** the target picker, **When** it lists a relay domain, **Then** that domain cannot be
   chosen and the reason is stated.
7. **Given** the alias domain `example.net` of `example.org`, **When** its target is changed to a
   domain whose alias limit would be exceeded, **Then** the message states the number in use and the
   limit, and nothing changes.
8. **Given** an alias domain with 7 aliases, **When** the user deletes it, **Then** the confirmation
   states that the 7 aliases, their send-as permissions, its temporary aliases, its BCC maps and its
   spam allow and block lists are deleted too, and that its DKIM key is kept.
9. **Given** an alias domain whose target is a relay domain, **When** it is listed, **Then** it shows
   the warning "Alias domain inactive for relay domain".
10. **Given** a server whose default DKIM selector is `feldhost` with 2048-bit keys, **When** the
    creation form opens, **Then** "Generate a DKIM key" is on with the selector `feldhost` and 2048
    bits pre-filled. **When** the user turns the switch off and saves, **Then** the creation report
    says that no DKIM key was requested.

---

### User Story 5 - Decide what a mailbox may send as (Priority: P2)

From a mailbox's detail screen (UI feature 003), an administrator or a domain administrator opens
"Send as". The screen explains every address the mailbox may send as and why: its own address and
its alias-domain addresses, the aliases that deliver to it and allow sending, and the explicit
permissions for other addresses or whole domains. Aliases that deliver to it but do not allow
sending are listed as receive-only, each with an action to allow sending as it anyway. The user adds
permissions from a searchable list of what they may grant, and removes permissions. An administrator
can allow the mailbox to send as any address, which disables its sender check. With the "external
sender addresses" permission, the user lets the mailbox send as addresses that are not hosted on
this server.

**Why this priority**: Shared mailboxes, assistants and customers moving to the server need send-as
rights, but mailboxes work without them.

**Independent Test**: Open the screen for mailboxes with each kind of implicit and explicit sender
address, as an administrator and as domain administrators with and without the external-sender
permission. Grant and revoke entries, mock stale and locked entries, an outdated version and
per-entry refusals, and check the request and the messages.

**Acceptance Scenarios**:

1. **Given** Anna, who receives `sales@` (sending allowed) and `info@` (sending not allowed) and has
   an explicit permission for `@example.com`, **When** the screen opens, **Then** it lists her own
   and alias-domain addresses and `sales@` as always allowed, `info@` as receive-only, and
   `example.com` (including its alias domains) as an explicit permission.
2. **Given** the receive-only alias `info@example.org`, **When** the user chooses "Allow sending as
   this alias" and saves, **Then** `info@example.org` appears among the explicit permissions.
3. **Given** an administrator, **When** they turn on "Allow sending as any address", **Then** a
   warning explains that the sender check is disabled and that the other explicit permissions are
   replaced, and after saving the screen shows "Sender check is disabled".
4. **Given** a permission for `@other.example`, which an administrator set and the domain
   administrator does not manage, **When** the domain administrator opens the screen, **Then** the
   entry is marked as not changeable by them, with the reason, and has no remove control. **When**
   they save other changes, **Then** the entry is still there.
5. **Given** a domain administrator, **When** they open the list of grantable entries, **Then** it
   offers only domains, alias domains, aliases and mailboxes in their scope, never "any address".
6. **Given** a domain administrator without the external-sender permission, **When** the screen
   opens, **Then** the external sender addresses are shown read-only with a note that an
   administrator grants the permission, and saving other changes does not send them.
7. **Given** an external sender address in a domain hosted on this server, **When** the user saves,
   **Then** that entry is marked with a translated message, nothing is saved, and every entry stays
   as entered.
8. **Given** a permission whose domain no longer exists, **When** the screen opens, **Then** the
   entry is marked "no longer exists", and an administrator can remove it.
9. **Given** 5,000 grantable addresses, **When** the user searches for "sales", **Then** the
   matching entries appear with labels saying whether each is a domain, alias domain, alias or
   mailbox, and more results load on demand.
10. **Given** the user grants an address that the mailbox already may send as through an alias,
    **When** they save, **Then** the app explains that the entry was not needed because of that
    alias.

---

### User Story 6 - Apply an action to many objects at once (Priority: P2)

On the alias list, the user switches to selection mode, selects aliases and activates, deactivates,
shows or hides them in the groupware, copies them over their domains' alias domains, or deletes
them. On the alias domain and resource lists they activate, deactivate or delete the selection. They
see one result per object, and the objects that did not succeed stay selected so they can try
again. From an alias's detail view, they copy that one alias over its domain's alias domains.

**Why this priority**: Operators use the legacy mass actions to suspend customers and to clean up;
doing this one object at a time on a phone would be impractical.

**Independent Test**: Apply each action to selections that mix successful objects with mocked "not
found", refused and failed results, on a phone and on a desktop, and check the confirmation, the
per-object results and the selection afterwards.

**Acceptance Scenarios**:

1. **Given** 30 active aliases on one page, **When** the user selects all, chooses "Deactivate" and
   confirms the dialog that names the action, its effect and the count of 30, **Then** all 30 are
   reported done, the list shows them inactive and the summary is announced.
2. **Given** a selection of five aliases of which two were deleted meanwhile, **When** the user hides
   them in the groupware, **Then** three are reported done, two "not found", and the two stay
   selected.
3. **Given** five selected resources, **When** the user chooses "Delete", **Then** the confirmation
   lists their names and the consequences, and nothing happens until the user types "5" and
   confirms.
4. **Given** `sales@example.org` and the alias domains `example.net` and `example.com`, where
   `sales@example.net` exists, **When** the user copies the alias over its alias domains, **Then** the
   result lists `sales@example.com` as created, with a link, and `example.net` as skipped because the
   address is in use.
5. **Given** a phone, **When** the user taps "Select", **Then** each card gets a checkbox with a touch
   target of at least 44×44 px, the number selected and the available actions stay visible, and
   leaving selection mode, or moving to another page, clears the selection with an announcement.
6. **Given** a server that reports a bulk limit of 50 and a page of 100 aliases, **When** the user
   chooses "Select all", **Then** the first 50 are selected and the app says that at most 50 objects
   can be changed at once.
7. **Given** a domain administrator without the "alias domains" permission, **When** they select
   alias domains, **Then** activate, deactivate and delete are still offered, because these do not
   need that permission.
8. **Given** three selected aliases, one of which was changed in the legacy UI after the list was
   loaded, **When** the user deactivates them, **Then** two are reported done, the third is reported
   as changed elsewhere and unchanged, it stays selected, and the app offers to refresh the list.

---

### User Story 7 - Manage resources (Priority: P3)

An administrator or a domain administrator adds a meeting room, a projector or a team calendar as a
resource: a description, a domain, a kind (location, thing or group) and how double bookings are
handled. The form previews the address that will be derived from the description. Later they change
the description, kind, booking rule or active state, or delete the resource after confirming.

**Why this priority**: Only some customers use groupware resources, and the rest of the mail setup
works without them.

**Independent Test**: List, create, change and delete resources of each kind and booking rule, with
mocked refusals, and compare the values shown with the mock data.

**Acceptance Scenarios**:

1. **Given** the description "Meeting Room 1" and the domain `example.org`, **When** it is typed,
   **Then** the form previews `MeetingRoom1@example.org`, labelled as a preview. **When** the
   resource is saved, **Then** its detail view shows the address returned by the server.
2. **Given** an existing `MeetingRoom1@example.org`, **When** the user saves a resource described as
   "Meeting-Room 1" in the same domain, **Then** the description field says that the derived address
   is in use.
3. **Given** the description "!!!", **When** it is typed, **Then** the preview says that no address
   can be derived and the form cannot be saved.
4. **Given** the booking rule "Hard limit", **When** it is chosen, **Then** a number field for the
   maximum number of concurrent bookings appears and accepts only whole numbers of 1 or more.
5. **Given** the resource list, **When** it is shown, **Then** each booking rule appears as a text
   badge ("Always free", "Soft limit", "Hard limit (2)") and a legend explains the three rules.
6. **Given** a resource, **When** its description is changed, **Then** the form states that the
   address stays the same.
7. **Given** a resource, **When** the user deletes it, **Then** the confirmation states that its
   calendar, bookings and sharing settings in the groupware are deleted too.

---

### User Story 8 - Trace changes to an object (Priority: P3)

An administrator investigating a complaint opens "History" on an alias, an alias domain, a resource
or a mailbox's send-as screen and sees the audit records of that object: who changed what, when and
from where.

**Why this priority**: The audit log exists for every change, but the objects can be managed without
reading it.

**Independent Test**: As an administrator, open "History" from each object screen and check that the
audit log screen opens filtered by that object. As a domain administrator, check that the control is
absent.

**Acceptance Scenarios**:

1. **Given** an alias, **When** an administrator opens its "History", **Then** the audit log screen
   of UI feature 001 opens, filtered to that alias, with the old and new values of each change.
2. **Given** a domain administrator, **When** they open any object of this feature, **Then** no
   "History" control is shown.

---

### Edge Cases

- **Long values on a phone**: addresses of up to 254 characters, internationalised domain names and
  lists of hundreds of destinations wrap inside the card or field and never cause horizontal
  scrolling at 360 px or at 400% zoom.
- **Internationalised names**: addresses and domains are shown in readable (Unicode) form, with the
  ASCII form as secondary text where it differs. Users may type either form.
- **Letter case**: the local part of an address is shown exactly as stored; the app does not change
  its case.
- **Separators**: address and destination lists accept commas, semicolons, spaces and new lines, as
  in legacy. Empty entries and entries that differ only in letter case are dropped before sending.
- **Catch-all in a single-label domain** such as `@localdomain`: sent as entered; the server decides.
- **Destinations stored by another tool** that today's rules would refuse, for example a resource
  address: shown as stored and not re-validated by the app. They are sent again only when the user
  edits the destination list; the server then names each entry it refuses, and the app marks it.
- **Permission flags changed during the session**: if the API refuses an action as forbidden or not
  permitted, the app explains it, refreshes the user's identity and updates the visible controls.
- **Domain administrator loses a domain while working**: the next request for an object of that
  domain is answered "not found"; the app says the object is no longer available and returns to the
  list.
- **Object deleted elsewhere** while its detail or form is open: the next save or refresh shows the
  "no longer exists" message.
- **Session expires while a form is open**: handled by UI feature 001 (sign in again); the form keeps
  its input when the user returns to it in the same tab.
- **Network failure during save**: the form keeps its input, shows the error and offers to retry.
- **Temporary failure** reported by the API (for example while an alias domain is created or
  deleted): a translated "try again shortly" message; the form keeps its input.
- **Network failure during a mass action**: the outcome is reported as unknown, the list is
  refreshed, and the request is not repeated automatically.
- **Network failure during a multi-address creation**: the results already received are shown; the
  remaining entries are reported as not processed and stay in the form.
- **Selection and list changes**: changing the page, page size, search, filters or sort clears the
  selection, with an announcement.
- **Very large servers** (200,000 aliases, 5,000 domains): lists, filters, domain pickers and the
  grantable-entry list are searched and paged by the server; the app never loads a whole collection.
- **Groupware disabled on the server**: the groupware visibility option, badges, columns, filter and
  mass actions are hidden, as in legacy. Values stored earlier are kept, because the app never sends
  the option.
- **External destinations disabled server-wide**: every role sees the advance notice in the
  destination field, and the refusal names the server setting as the reason.
- **Capabilities cannot be read**: forms and mass actions that depend on them show the error state
  with a retry action instead of falling back to assumed values; lists and detail views still work.
- **Object changed after the list was loaded** and then included in a mass action: reported as
  changed elsewhere, left unchanged and kept selected.
- **Orphaned alias** (its domain no longer exists): visible to administrators only, marked "orphaned",
  deletable; a change needs an address in an existing domain.
- **Stale sender permission** (its domain or address no longer exists): marked "no longer exists";
  administrators can remove it; domain administrators cannot, when it lies outside their scope.
- **"Any address" set by an administrator**, seen by a domain administrator: shown as "Sender check
  is disabled" and marked as not changeable by them.
- **Alias domain whose target became a relay domain**: listed with the relay warning; still editable.
- **Resource description with letters outside A–Z**, such as "Raum Süd": the preview shows the
  derived address without them (`RaumSd@…`).
- **Copying an alias that lives in an alias domain**: the action is not offered for it; in a mass
  selection it is reported as refused with the reason.
- **Double submission**: the submit control is disabled while a request is pending.
- **Unknown error type** from a newer API: a generic translated message with the request identifier
  is shown.

## Requirements *(mandatory)*

### Functional Requirements

#### Access and navigation

- **FR-001**: The app MUST offer "Aliases", "Alias domains" and "Resources" as separate screens in
  the mail setup navigation of administrators and domain administrators, replacing the placeholder
  that UI feature 001 shows for feature 004, and MUST NOT offer them to mailbox users. Opening such
  a screen as a mailbox user MUST show the "no access" state of UI feature 001.
- **FR-002**: The app MUST show each control only when the user's role and permission flags, as
  reported by the identity of API feature 001, allow the operation behind it:

  | Control | Administrator | Domain administrator |
  |---|---|---|
  | View aliases, alias domains, resources | Yes | Yes (own scope) |
  | Add, edit, delete, copy aliases; alias mass actions | Yes | Yes (own scope) |
  | Add external destinations without an advance notice | Unless disabled for everyone | Only with "alias external goto", unless disabled for everyone |
  | Add alias domain | Yes | Only with "alias domains" |
  | Initial rate limit of a new alias domain | Yes | Only with "rate limit" |
  | Edit, delete alias domains; alias domain mass actions | Yes | Yes (own scope) |
  | Add, edit, delete resources; resource mass actions | Yes | Yes (own scope) |
  | Open and edit "Send as" of a mailbox | Yes | Yes (own scope) |
  | "Allow sending as any address" | Yes | No |
  | Edit external sender addresses | Yes | Only with "extend sender ACL" |
  | "History" | Yes | No |
  | Orphaned aliases | Yes | Never listed |

- **FR-003**: An object that does not exist and an object outside the user's scope MUST lead to the
  same "not found" state, with a way back to the list.
- **FR-004**: When the API refuses an action as forbidden or as not permitted for the role, the app
  MUST show a translated explanation that names the missing permission when the API names it, MUST
  refresh the user's identity, and MUST update the visible controls. Hiding a control is never the
  only protection.

#### Lists (all three object types)

- **FR-005**: Each list MUST be paged by the server, MUST show the total number of matching objects,
  MUST start with the default page size from the capabilities (25) and MUST let the user choose 25,
  50 or 100 entries per page.
- **FR-006**: The search text, filters, sort order, page and page size MUST be part of the screen's
  address, so that reloading, going back and sharing a link restore the same view.
- **FR-007**: At viewport widths below 768 CSS px, entries MUST be shown as cards with no horizontal
  scrolling, tested at 360 px. From 768 CSS px they MAY be shown as a table whose sortable column
  headers state the current sort order to assistive technology.
- **FR-008**: Every list and detail view MUST have a loading state, an error state with a retry
  action, and an empty state. The empty state MUST distinguish "nothing exists yet" (offering the
  add action when permitted) from "nothing matches" (offering to clear search and filters).
- **FR-009**: After a successful change, every list and detail view that shows the changed object
  MUST show its new state without a manual reload. Each list MUST also offer a manual refresh.
- **FR-010**: The search MUST run when the user submits it or stops typing for about half a second,
  and the number of results MUST be announced to screen readers. Active filters MUST be shown as
  removable chips with a "clear all" action.
- **FR-011**: Domain choices in filters and forms MUST be searchable pickers backed by the server, so
  that they work with thousands of domains.

#### Alias list and detail

- **FR-012**: Each alias entry MUST show: the address in readable form (and ASCII form where it
  differs); a "Catch-all" badge for catch-all aliases; the destinations, limited to the first two
  plus the number of further ones, or the special action as text; the domain and, for an alias in an
  alias domain, its primary domain; and text badges for inactive, internal, hidden from the
  groupware (only when the groupware is enabled), receive-only (sending not allowed) and, for
  administrators, orphaned. Wide screens MUST additionally offer the identifier, the public and
  private comments and the modification time as columns.
- **FR-013**: The alias list MUST offer the search of API feature 004 (address, destinations,
  comments) and these filters: domain (domains and alias domains), primary domain (a domain with its
  alias domains), kind (regular, catch-all), destination type (addresses, discard, learn as spam,
  learn as ham), delivers to (an address), active, sending allowed, visible in the groupware (only
  when the groupware is enabled), and internal.
- **FR-014**: The alias list MUST be sortable, ascending or descending, by newest first (the
  default), address, domain, active, visible in the groupware (only when the groupware is enabled),
  internal, sending allowed, creation time and modification time.
- **FR-015**: Each list entry MUST offer open, edit and delete when permitted. On cards, the
  secondary actions MUST be in a menu whose trigger has a touch target of at least 44×44 px.
- **FR-016**: The alias detail view MUST show the identifier, the address in both forms, the kind,
  the domain and primary domain (linking to the domain's screen of UI feature 002), the complete
  destination list or the special action, each option with its explanation, both comments, the
  creation and modification times, and for orphaned aliases a warning. It MUST offer edit, delete,
  copy over alias domains (only for an alias of a primary domain) and, for administrators,
  "History".
- **FR-017**: The alias list MUST show the hint that aliases are not applied to alias domains
  automatically and that "Copy over alias domains" adds the missing ones.

#### Alias form

- **FR-018**: The creation form MUST contain, in the sections "Addresses", "Destination", "Options"
  and "Comments":
  - addresses: one or more, separated by commas, semicolons, spaces or new lines; an entry of the
    form `@domain` creates a catch-all alias;
  - destination: a single choice between "Deliver to addresses", "Discard silently", "Learn as spam"
    and "Learn as ham";
  - destination addresses: required for "Deliver to addresses", with the same separators, and not
    editable or sent for the other choices;
  - options: active (default on), allowed to send as this alias (default on), visible in the
    groupware (default on, offered only when the groupware is enabled) and internal (default off),
    each with its explanatory text;
  - public comment, explained as shown to the mailbox users who receive the alias, and private
    comment, explained as visible to administrators and domain administrators only.
- **FR-019**: Before sending, the form MUST trim the entries of both lists, drop empty entries and
  entries that differ only in letter case, mark `@domain` entries as catch-all, and check that there
  is at least one address, at least one destination for "Deliver to addresses", and that each
  comment stays within the byte limit from the capabilities (160 bytes by default). Messages MUST
  appear at the field. The server's validation stays authoritative.
- **FR-020**: When the capabilities report that external destinations are disabled for everyone,
  or the user is a domain administrator without the "alias external goto" permission, the
  destination field MUST state in advance that only addresses of domains hosted on this server can
  be added.
- **FR-021**: With one address, a successful creation MUST open the new alias's detail view. With
  several addresses, the app MUST create one alias per address, one after another in the order
  entered, and then show one result per address: created (with a link) or refused (with the
  translated reason). Refused addresses MUST stay in the address field and created ones MUST be
  removed from it, so that the user can correct and save again.
- **FR-022**: The edit form MUST offer the same fields for a single address, pre-filled with the
  stored values, and MUST send only the attributes the user changed, together with the version tag
  that was read.
- **FR-023**: The app MUST map these refusals to translated messages at the matching field: address
  in use (naming the kind of holder: mailbox, resource, alias or temporary alias), the domain's
  alias limit reached (with the count and the limit), destination not permitted (naming each
  destination and the reason: missing permission or server setting), and each validation rule code
  with its parameters, marking every entry the API names. Errors that belong to no field MUST appear
  in a summary at the top of the form.
- **FR-024**: While a save is pending, its submit control MUST be disabled and the pending state
  announced.
- **FR-025**: Leaving a form with unsaved changes MUST ask the user to confirm discarding them.

#### Version conflicts and vanished objects

- **FR-026**: Every edit, replacement and single deletion MUST send the version tag the app read.
  Every mass action MUST send, for each object, the version tag from the list entry it was selected
  from.
- **FR-027**: When the API refuses a save as outdated, the app MUST keep the user's entries, reload
  the object, mark each field whose stored value changed in the meantime together with its new value,
  and ask the user to review and save again or discard their changes. When a deletion is refused as
  outdated, the app MUST show the confirmation again with the reloaded object. The app MUST NOT retry
  automatically and MUST NOT offer to overwrite the newer version.
- **FR-028**: When a save or refresh finds that the object no longer exists, the app MUST say so and
  return to the list.

#### Deletion

- **FR-029**: Every single deletion MUST require confirmation in a dialog that names the object,
  states what else is removed, and has a confirm control labelled with the action (for example
  "Delete alias"). Focus MUST start on the cancel control. The consequences are:
  - alias: mail to the address is no longer accepted, and permissions of other mailboxes to send as
    the address are removed;
  - alias domain: the number of aliases that live in it, their send-as permissions, its temporary
    aliases, its BCC maps and its spam allow and block lists are deleted; its DKIM key is kept;
  - resource: its calendar, bookings and sharing settings in the groupware are deleted.
- **FR-030**: After a deletion, the app MUST announce it, return to the list if it was on the detail
  view, and show the list without the object.

#### Copy over alias domains

- **FR-031**: For an alias of a primary domain, the app MUST offer "Copy over alias domains" from
  the detail view and as a mass action. Before running it, the app MUST explain that a copy is
  created in each alias domain of the alias's domain unless the address is in use there.
- **FR-032**: The result MUST list, per alias domain, the created copy with a link, or the reason it
  was skipped (address in use, alias limit reached, destination not permitted). When the domain has
  no alias domains, the app MUST say that nothing was created.

#### Alias domains

- **FR-033**: Each alias domain entry MUST show its name (readable and ASCII form), its target domain
  linking to the domain's screen of UI feature 002, its active state, the number of aliases that live
  in it (linking to the alias list filtered by that domain) and, when the target is a relay domain,
  the warning "Alias domain inactive for relay domain".
- **FR-034**: The alias domain list MUST offer a search on the name and target, filters on target
  domain and active state, and sorting by name (the default), target, active state, creation time
  and modification time.
- **FR-035**: The alias domain detail view MUST show all attributes, including its rate limit (or
  "none") as read-only with a note that rate limits are managed with spam and rate limit settings
  (UI feature 006), and its creation and modification times. It MUST offer edit, delete and, for
  administrators, "History".
- **FR-036**: The creation form MUST contain:
  - one or more names, separated as in FR-018;
  - the target domain, chosen from the domains in the user's scope, where relay domains are shown
    but cannot be chosen, with the reason;
  - active (default on);
  - the DKIM key: a "Generate a DKIM key" switch (default on) with a selector and a key size,
    pre-filled with the server's default selector and key size and offering the allowed key sizes,
    all from the capabilities; with the switch off, no key is generated;
  - an initial rate limit (a number and one of the allowed time frames from the capabilities, such as
    second, minute, hour or day; empty meaning none), only for users allowed to set it (FR-002).
- **FR-037**: Several names MUST be handled as several creations, with results per name as in
  FR-021.
- **FR-038**: After a creation, the app MUST show the creation report: one line per follow-up step
  (rate limit, DKIM key, DKIM DNS publication, groupware update) with its translated outcome. Failed
  steps MUST be shown as warnings that say where the step can be repeated, and MUST NOT make the
  creation look failed.
- **FR-039**: The edit form MUST let the user change the target domain (with the picker of FR-036)
  and the active state. The name MUST be read-only.
- **FR-040**: The app MUST map these refusals to translated messages at the matching field: alias
  domain already exists, name equals the server's host name, name equals the target, target not
  found or a relay domain, and the new target's alias limit reached on a target change (with the
  count and the limit).
- **FR-041**: A domain administrator without the "alias domains" permission MUST see the list without
  the add control and with a note that an administrator grants the permission.

#### Resources

- **FR-042**: Each resource entry MUST show its description, address, kind as translated text
  (location, thing or group), domain, booking rule as a text badge ("Always free", "Soft limit",
  "Hard limit (N)") and active state. The list MUST show a legend that explains the three booking
  rules.
- **FR-043**: The resource list MUST offer a search on description and address, filters on domain,
  kind and active state, and sorting by address (the default), description, kind, domain, booking
  rule, active state, creation time and modification time.
- **FR-044**: The creation form MUST contain the description, the domain (chosen from the domains in
  the user's scope; alias domains are not offered), the kind, the booking rule as a single choice of
  "Always show as free", "Unlimited, but show as busy when booked" (the default) and "Hard-limit to a
  custom amount of bookings" (with a whole number within the range from the capabilities, at least
  1), and active (default on). The description length is checked against the limit from the
  capabilities.
- **FR-045**: The creation form MUST preview the address that will be derived from the description
  and the domain, by the rule documented in the contract, labelled as a preview. When no address can
  be derived, it MUST say so and MUST NOT send the form. The address shown after saving MUST be the
  one the server returns.
- **FR-046**: The edit form MUST let the user change the description, kind, booking rule and active
  state. The address and the domain MUST be read-only, with a note that the address does not change
  when the description changes. The detail view MUST offer edit, delete and, for administrators,
  "History".
- **FR-047**: The app MUST map these refusals to translated messages at the matching field: derived
  address in use (at the description), description empty, too long or without letters or digits,
  domain not found, and booking limit out of range.

#### Send as (sender permissions of a mailbox)

- **FR-048**: The mailbox detail screen of UI feature 003 MUST offer "Send as" to administrators and
  to domain administrators for mailboxes in their scope. It MUST NOT be offered for resources.
- **FR-049**: The "Send as" screen MUST show, in separate sections:
  - always allowed: the mailbox's own address, its addresses in alias domains, and the aliases that
    deliver to it and allow sending (catch-all aliases marked as such, each alias linking to its
    detail view);
  - receive-only: the aliases that deliver to it but do not allow sending, each with an "Allow
    sending as this alias" action that adds it as an explicit permission;
  - explicit permissions: addresses and domains (a domain entry stating that it includes the domain's
    alias domains); entries the user cannot change marked with the reason and without a remove
    control; entries whose address or domain no longer exists marked "no longer exists";
  - the sender check status, showing "Sender check is disabled" when the mailbox may send as any
    address;
  - external sender addresses (addresses or `@domain` entries).
- **FR-050**: The user MUST be able to add explicit permissions from a searchable, server-paged list
  of the entries they may grant, each labelled as domain, alias domain, alias or mailbox, and to
  remove the entries they may change.
- **FR-051**: Administrators MUST be able to turn on "Allow sending as any address" as a separate
  switch, with a warning that this disables the sender check for the mailbox and replaces its other
  explicit permissions. Domain administrators MUST NOT be offered it.
- **FR-052**: Administrators, and domain administrators with the "extend sender ACL" permission, MUST
  be able to add and remove external sender addresses, given as an address or `@domain`. Others MUST
  see them read-only with a note that an administrator grants the permission. The section MUST show
  the legacy hints: import a DKIM key for the external domain if available, add this server to that
  domain's SPF record, and external addresses are removed when their domain is added to this server.
- **FR-053**: The screen MUST show the legacy hint that another mailbox's address becomes a sender
  identity in the groupware only after that mailbox delegates access to it.
- **FR-054**: One save MUST send the explicit permissions, the external sender addresses, or both,
  whichever the user changed, each as a whole set, with the version tag that was read (FR-026,
  FR-027). A set the user did not change MUST NOT be sent. When the API refuses entries, the app MUST
  mark each named entry with its translated message and keep all entries as entered.
- **FR-055**: When an entry the user added is absent after saving because the mailbox already may
  send as it through an alias, the app MUST say so for that entry.

#### Mass actions

- **FR-056**: The alias, alias domain and resource lists MUST offer a selection mode, entered through
  an explicit control, with selecting single entries, selecting all entries of the current page and
  clearing the selection. The number of selected entries and the available actions MUST stay visible
  while scrolling. Selection checkboxes MUST have touch targets of at least 44×44 px. The selection
  MUST hold only objects of the current page and MUST be cleared, with an announcement, when the
  page, page size, search, filters or sort change.
- **FR-057**: The actions MUST be: for aliases, activate, deactivate, show in the groupware and hide
  in the groupware (both only when the groupware is enabled), copy over alias domains and delete; for
  alias domains and resources, activate, deactivate and delete. Only actions the user may use
  (FR-002) MUST be offered.
- **FR-058**: A mass deletion MUST require confirmation that lists every selected object by name,
  states the consequences of FR-029 and requires typing the number of selected objects. Deactivating
  and hiding in the groupware MUST require one confirmation that names the action, its effect and
  the number of objects. Activating and showing in the groupware MUST NOT ask for confirmation; a
  copy over alias domains shows the explanation of FR-031 first.
- **FR-059**: After a mass action, the app MUST show the number of objects per outcome and one result
  per object: done, not found, changed elsewhere (outdated), refused (with the translated reason) or
  failed (with the translated reason). It MUST announce the summary, deselect the objects that
  succeeded, keep the others selected for a retry, offer to refresh the list when an object was
  changed elsewhere, and show the new state of the changed objects. Copies over alias domains MUST
  show their results per alias as in FR-032. When the connection drops before the response, the app
  MUST report the outcome as unknown, refresh the list and MUST NOT repeat the request
  automatically.
- **FR-060**: A selection MUST NOT exceed the bulk limit from the capabilities (100 objects by
  default, equal to the largest page size). When the server reports a smaller limit, "select all"
  MUST select only the first objects up to the limit and say why, and selecting more MUST be refused
  with the same explanation.

#### History

- **FR-061**: For administrators, "History" on an alias, an alias domain, a resource and a "Send as"
  screen MUST open the audit log screen of UI feature 001 filtered by that object's target type and
  identifier. This feature adds translated labels and presentation for the alias, alias domain,
  resource and sender settings events to that screen, which otherwise shows them with a generic
  label.

#### Accessibility, mobile and internationalisation

- **FR-062**: Every screen, dialog, picker and selection mode MUST be fully operable with a keyboard
  and with a screen reader. Focus MUST be visible, MUST move into a dialog when it opens and MUST
  return to the triggering control when it closes. Form errors MUST be programmatically associated
  with their fields and summarised at the top of the form with links to the fields. Saves,
  deletions, search result counts and mass action summaries MUST be announced as status messages.
- **FR-063**: Every state shown with a colour or icon (catch-all, special action, inactive, internal,
  hidden, receive-only, orphaned, relay warning, booking rule, not changeable, no longer exists,
  sender check disabled, step outcomes) MUST also be shown as text.
- **FR-064**: Interactive targets MUST be at least 44×44 CSS px. Forms MUST be a single column at
  360 px, and the alias, alias domain and resource forms MUST use full-screen views on phones rather
  than dialogs that need scrolling inside the page.
- **FR-065**: Address and domain inputs MUST turn off automatic capitalisation and correction and
  request an e-mail-friendly keyboard where the field holds a single address.
- **FR-066**: Content MUST reflow without loss at a width of 320 CSS px and at 400% zoom.
- **FR-067**: All texts MUST come from the translation files and MUST be complete in English, Czech
  and Slovak. Legacy keys MUST be reused where their meaning is unchanged (see Legacy parity).
  Legacy texts that contain markup MUST be shown as plain text with any emphasis provided by the
  app, never as raw HTML. Texts that name the product MUST use the product name from the API's
  branding configuration.
- **FR-068**: Every error type and validation rule code of API feature 004 MUST have a translated
  message that uses the parameters the API returns (for example the byte limit, the count and limit,
  the kind of holder or the destination). An unknown error type MUST produce a generic translated
  message with the request identifier.
- **FR-069**: Dates, times and numbers MUST be formatted with the user's locale.

#### Contract use

- **FR-070**: The app MUST use only operations of the pinned contract. Apart from the input aids of
  FR-019 and the address preview of FR-045, it MUST NOT reimplement server rules; the API's answer is
  authoritative.
- **FR-071**: The app MUST take the groupware state, the external-destination setting, the bulk limit,
  the page sizes, the field limits (comment bytes, destination length, description length, booking
  range), the rate limit time frames, the DKIM key sizes and the DKIM defaults from the capabilities
  read of API feature 004, never from fixed values. When the capabilities cannot be read, the forms
  and mass actions that depend on them MUST show the error state with a retry action.

### Key Entities *(include if feature involves data)*

- **Alias**: an address, or `@domain` for a catch-all, with an identifier, a domain and primary
  domain, either destination addresses or a special action, the flags active, sending allowed,
  visible in the groupware and internal, a public and a private comment, times, an orphaned marker
  and a version tag.
- **Special action**: discard silently, learn as spam or learn as ham, used instead of destinations.
- **Alias domain**: a domain name that maps to a target domain's mailboxes, with its active state,
  relay warning, alias count, read-only rate limit, times and version tag.
- **Alias domain creation report**: the outcome of each follow-up step of a creation.
- **Resource**: a bookable location, thing or group with a description, derived address, domain,
  booking rule, active state, times and version tag.
- **Booking rule**: always free, soft limit (unlimited, shown busy) or hard limit with a number.
- **Send-as settings of a mailbox**: implicit addresses (own, alias-domain, aliases that allow
  sending), receive-only aliases, explicit permissions (address, domain or any address, with
  changeable and stale markers), external sender addresses, sender check status and version tag.
- **Grantable entry**: a domain, alias domain, alias, mailbox or "any address" that the user may add
  as an explicit permission.
- **Mass action result**: the outcome per object of one action on a selection.
- **Feature capabilities**: the server settings and limits the app needs before the user submits:
  whether the groupware is enabled, whether external destinations are disabled, the bulk limit, page
  sizes, field limits, rate limit time frames, DKIM key sizes and DKIM defaults.
- **Version tag**: a marker the server returns with each alias, alias domain, resource and send-as
  setting. The app sends it back with a change so that the server can refuse the change when someone
  else changed the object in the meantime.

## Legacy parity

Legacy reference: FeldHost fork `~/Projects/mailhosting/data/web` (upstream tag `2026-09a`). The
alias, alias domain and resource templates, `js/site/mailbox.js` and `js/site/edit.js` are identical
to upstream apart from the default DKIM selector `feldhost` in the add alias domain dialog and the
product name in one help text. Status: **Matched** (same capability), **Improved** (same capability,
better), **Moved** (provided by another UI feature), **Dropped** (with reason).

### Mail setup › Aliases tab (`mailbox/tab-mbox-aliases.twig`, `draw_alias_table()`)

| Legacy element | Status | Requirements | Notes |
|---|---|---|---|
| "Aliases" entry in the "Aliases" tab dropdown of the mailbox page | Improved | FR-001 | Own navigation entry and address |
| Collapsed card on phones, table with row expansion | Improved | FR-007, FR-012 | Cards with essentials, details in the detail view |
| Count badge in the card header | Matched | FR-005 | Total of matching aliases |
| Refresh button | Matched | FR-009 | Plus automatic refresh after changes |
| Column ID | Matched | FR-012, FR-016 | Wide-screen column and detail view |
| Column alias address with "Catch-All" badge | Matched | FR-012 | |
| Column goto, with a trash icon for discard and coloured badges for spam and ham | Improved | FR-012, FR-063 | Special actions as text, not icon or colour alone |
| Column domain with an info-icon tooltip naming the target domain | Improved | FR-012 | Primary domain shown as text; tooltips are not usable on touch |
| Columns SOGo visible, internal, active | Matched | FR-012 | Text badges on cards, columns on wide screens |
| Columns public comment, private comment | Matched | FR-012, FR-016 | Wide-screen columns and detail view |
| Row actions edit, remove | Matched | FR-015, FR-029 | |
| Client-side search over all loaded aliases | Improved | FR-010, FR-013 | Server search, also over destinations and comments |
| Domain filter dropdown | Improved | FR-013 | Domain and primary-domain filters plus seven more |
| Sorting by any column, default ID descending | Matched | FR-014 | |
| Page length, paging, state saved in the browser | Matched | FR-005, FR-006 | State kept in the screen address |
| "Toggle all" | Matched | FR-056 | Select all on the page |
| Quick actions activate, deactivate, remove, show and hide in SOGo (the SOGo ones hidden when the groupware is disabled) | Matched | FR-057, FR-058, FR-059 | Per-object results; objects changed since the list loaded are reported, not overwritten |
| "Expand alias over alias domains" | Improved | FR-031, FR-032, FR-057 | Per-alias-domain results instead of one message |
| "Add alias" button | Matched | FR-018 | |
| Hint `alias_domain_alias_hint` | Matched | FR-017 | Reference to the legacy "Filters" tab dropped |
| Expand all / collapse all rows | Dropped | — | Cards and the detail view make row expansion unnecessary |
| Mass actions hidden above the table on phones | Improved | FR-056 | Selection mode with a persistent action bar |

### Add alias dialog (`modals/mailbox.twig` `#addAliasModal`)

| Legacy element | Status | Requirements | Notes |
|---|---|---|---|
| Alias address/es text area, comma-separated, `@domain` for catch-all | Matched | FR-018, FR-019, FR-021 | Per-address results; refused entries stay for correction |
| Help text naming the product ("mailcow domains only", fork: "FeldHost™ Mailhosting domains only") | Improved | FR-067 | Product name from the branding configuration |
| Goto addresses text area | Matched | FR-018 | |
| Mutually exclusive checkboxes "Silently discard", "Learn as spam", "Learn as ham" that disable the goto field | Improved | FR-018 | One single-choice control |
| "Alias is visible in SOGo" (checked; hidden when the groupware is disabled) | Matched | FR-018, FR-071 | Hidden when the capabilities report the groupware disabled |
| "Internal" (unchecked), "Allow to send as this alias" (checked), "Active" (checked) | Matched | FR-018 | Same defaults |
| Comments only on the edit page | Improved | FR-018 | Comments can be set at creation |
| Form input cached between openings of the dialog | Dropped | FR-025 | Replaced by the unsaved-changes guard |
| Invalid destinations and addresses skipped with a message each, the rest saved | Improved | FR-021, FR-023 | Nothing saved for an invalid entry; each entry marked at its field |

### Edit alias page (`edit/alias.twig`, `edit.js`)

| Legacy element | Status | Requirements | Notes |
|---|---|---|---|
| Address, goto, special action checkboxes | Matched | FR-022 | Single-choice destination control |
| SOGo visible, internal, sending allowed, active | Matched | FR-022 | |
| Private and public comment, at most 160 characters | Matched | FR-019, FR-022 | Limit from the capabilities, stated in bytes as the API counts |
| Save | Improved | FR-022, FR-026, FR-027 | Only changed values, protected by the version tag |
| No delete on the edit page | Improved | FR-016, FR-029 | Delete from the detail view |

### Mail setup › Domain aliases tab (`mailbox/tab-domain-aliases.twig`, `draw_aliasdomain_table()`)

| Legacy element | Status | Requirements | Notes |
|---|---|---|---|
| "Domain aliases" entry in the "Aliases" tab dropdown | Improved | FR-001 | Own navigation entry "Alias domains" |
| Columns alias domain, target domain (link to edit domain), active | Matched | FR-033 | |
| Badge "Alias domain inactive for relay domain" | Matched | FR-033, FR-063 | |
| — | Improved | FR-033 | New: number of aliases, linked to the filtered alias list |
| Row actions edit, remove | Matched | FR-015, FR-029 | Confirmation states the cascade |
| Row action DNS (DNS diagnostics dialog) | Moved | — | UI feature 010 (DNS diagnostics) |
| Client-side search, sorting, paging | Improved | FR-034, FR-005 | Server-side, plus target and active filters |
| Toggle all, quick actions activate, deactivate, remove | Matched | FR-056 to FR-059 | |
| "Add domain alias" button gated by `alias_domains` | Matched | FR-002, FR-041 | Plus a note explaining the missing permission |

### Add domain alias dialog (`#addAliasDomainModal`)

| Legacy element | Status | Requirements | Notes |
|---|---|---|---|
| Alias domain text area, several names | Matched | FR-036, FR-037 | Per-name results |
| Target domain select | Improved | FR-036, FR-011 | Searchable picker; relay domains not selectable, with reason |
| Active (checked) | Matched | FR-036 | |
| Rate limit value and frame | Matched | FR-036, FR-002 | Offered only when the user may set it |
| DKIM selector (pre-filled `dkim`, fork `feldhost`) and key size (2048) | Improved | FR-036, FR-071 | Pre-filled from the server's defaults; explicit "Generate a DKIM key" switch instead of an emptied field |
| One success or error message per step | Improved | FR-038 | Creation report with one line per follow-up step |

### Edit alias domain page (`edit/aliasdomain.twig`)

| Legacy element | Status | Requirements | Notes |
|---|---|---|---|
| Target domain select, active, save | Matched | FR-039, FR-026 | Protected by the version tag |
| Rate limit form (`edit/rl-domain`) | Moved | FR-035 | Read-only here; edited in UI feature 006 |
| DKIM TXT record display | Moved | — | UI feature 010 (DKIM) |

### Mail setup › Resources tab (`mailbox/tab-resources.twig`, `draw_resource_table()`)

| Legacy element | Status | Requirements | Notes |
|---|---|---|---|
| Columns description, alias (address), kind, domain, active | Matched | FR-042 | Kind translated (legacy shows the raw value) |
| Column multiple bookings as coloured badges with legend | Matched | FR-042, FR-063 | Badge text carries the meaning, not only the colour |
| Row actions edit, remove | Matched | FR-015, FR-029 | |
| Domain filter, client-side search, sorting, paging | Improved | FR-043, FR-005 | Server-side, plus kind and active filters |
| Toggle all, quick actions activate, deactivate, remove | Matched | FR-056 to FR-059 | |
| "Add resource" button | Matched | FR-044 | |

### Add resource dialog and edit resource page (`#addResourceModal`, `edit/resource.twig`)

| Legacy element | Status | Requirements | Notes |
|---|---|---|---|
| Description, domain select, active (checked) | Matched | FR-044 | Domain picker searchable |
| Kind select with untranslated "Location", "Group", "Thing" | Improved | FR-044, FR-067 | Translated |
| Multiple bookings select (default "Unlimited, but show as busy") with custom number | Matched | FR-044 | Number field only for the hard limit |
| Address derived silently from the description | Improved | FR-045 | Preview before saving |
| Edit description, kind, multiple bookings, active | Matched | FR-046 | Note that the address does not change |

### Edit mailbox page: "Allow to send as" and "External sender addresses" (`edit/mailbox.twig`, `edit.js`)

| Legacy element | Status | Requirements | Notes |
|---|---|---|---|
| Fields inside the long Edit mailbox form | Improved | FR-048 | Own "Send as" screen, keeping the mailbox form short |
| One multi-select mixing domains ("Disable sender check for domain %s (+ alias domains)"), `*`, addresses and aliases with "Alias (allowed)" / "Alias (blocked)" | Improved | FR-049, FR-050 | Separate sections for always allowed, receive-only and explicit entries; searchable paged picker |
| Blocked aliases selectable to allow sending | Matched | FR-049 | "Allow sending as this alias" on each receive-only alias |
| Administrator-set entries shown disabled for domain administrators | Matched | FR-049 | With the reason, as "not changeable by you" |
| `*` option ("any address") | Improved | FR-051 | Separate administrator-only switch with a warning |
| Badge "Sender check is disabled" | Matched | FR-049, FR-051 | |
| Hint `sender_acl_info` about groupware delegation | Matched | FR-053 | |
| External sender addresses text field, shown only with `extend_sender_acl` | Improved | FR-052 | List editor; read-only view without the permission |
| Hint `extended_sender_acl_info` | Matched | FR-052 | |
| — | Improved | FR-049 | New: stale entries marked "no longer exists" |
| Saved with the whole mailbox form, invalid entries skipped, last write wins | Improved | FR-054, FR-027 | Own save with version tag and per-entry messages |

### Translation reuse

Legacy keys reused with unchanged meaning (markup removed where present): `mailbox.aliases`,
`mailbox.domain_aliases`, `mailbox.resources`, `mailbox.add_alias`, `mailbox.add_domain_alias`,
`mailbox.add_resource`, `mailbox.add_alias_expand`, `edit.edit_alias_domain`,
`mailbox.alias_domain_alias_hint`, `mailbox.catch_all`, `mailbox.alias`, `mailbox.target_address`,
`mailbox.target_domain`, `mailbox.alias_domain_backupmx`, `mailbox.sogo_visible_y`,
`mailbox.sogo_visible_n`, `mailbox.toggle_all`, `mailbox.activate`, `mailbox.deactivate`,
`mailbox.remove`, `mailbox.booking_null`, `mailbox.booking_ltnull`, `mailbox.booking_custom`,
`mailbox.booking_0_short`, `mailbox.booking_lt0_short`, `mailbox.booking_custom_short`,
`add.alias_address`, `add.target_address`, `add.alias_domain`, `add.target_domain`, `add.goto_null`,
`add.goto_spam`, `add.goto_ham`, `add.internal`, `add.kind`, `add.multiple_bookings`,
`add.description`, `edit.internal_info`, `edit.sender_allowed`, `edit.sender_allowed_info`,
`edit.sogo_visible`, `edit.sogo_visible_info`, `edit.public_comment`, `edit.private_comment`,
`edit.sender_acl`, `edit.sender_acl_info`, `edit.sender_acl_disabled`, `edit.extended_sender_acl`,
`edit.extended_sender_acl_info`, `acl.alias_domains`, `acl.alias_external_goto`,
`acl.extend_sender_acl`, `acl.ratelimit`, `admin.dkim_domains_selector`, `admin.dkim_key_length`,
`ratelimit.second`, `ratelimit.minute`, `ratelimit.hour`, `ratelimit.day`, and the messages
`danger.alias_empty`, `danger.goto_empty`, `danger.goto_invalid`, `danger.alias_invalid`,
`danger.is_alias_or_mailbox`, `danger.max_alias_exceeded`, `danger.external_goto_denied`,
`danger.aliasd_targetd_identical`, `danger.alias_domain_invalid`, `danger.target_domain_invalid`,
`danger.extra_acl_invalid`, `danger.extra_acl_invalid_domain`, `danger.resource_invalid`,
`danger.description_invalid`, `success.alias_added`, `success.alias_modified`,
`success.alias_removed`, `success.aliasd_added`, `success.aliasd_modified`,
`success.alias_domain_removed`, `success.resource_added`, `success.resource_removed` and
`warning.is_not_primary_alias`. All exist in en-gb, cs-cz and sk-sk. `mailbox.domain_aliases` and
`mailbox.add_domain_alias` are reused with their Czech and Slovak texts; their English texts become
"Alias domains" and "Add alias domain", the canonical term. `add.alias_address_info` names the
product and is replaced by a new key that takes the branding product name.
`success.resource_modified` says "mailbox" and is replaced by a new key.

## API dependency

This feature uses only these API capabilities. Items 1 to 7 come from mailcow-rest-v2 feature 004.

1. **Aliases** (API FR-011 to FR-037): list with paging, total, search, the filters of FR-013 and the
   sort keys of FR-014; inspect by identifier with version tag; create one alias per request; change
   only sent attributes with version check; delete with version check; copy over alias domains with
   per-alias-domain results.
2. **Alias domains** (API FR-038 to FR-045): list with paging, search, target and active filters and
   sorting; inspect with version tag, alias count, relay state and read-only rate limit; create with
   DKIM options and initial rate limit, returning the creation report; change target and active
   state; delete.
3. **Resources** (API FR-046 to FR-052): list with paging, search, filters and sorting; inspect;
   create with the derived address returned; change; delete. The contract documents the address
   derivation rule used by the preview (FR-045).
4. **Sender settings of a mailbox** (API FR-053 to FR-057): read implicit addresses, aliases with
   their sending flag, explicit permissions with changeable and stale markers, sender check status,
   external addresses and version tag; replace explicit permissions, external addresses or both in
   one request; list grantable entries with paging and search.
5. **Bulk actions** (API FR-058, FR-059): activate, deactivate, show and hide in the groupware, copy
   and delete for up to the bulk limit of objects, each item with its optional version tag, with one
   result per object (done, not found, refused, outdated, failed). Every list entry carries its
   version tag (API FR-060).
6. **Capabilities** (API FR-068): groupware state, external-destination setting, bulk limit, page
   sizes, field limits, rate limit time frames, DKIM key sizes and, for administrators and domain
   administrators with `alias_domains`, the DKIM defaults.
7. **Errors** (API FR-028, FR-065): problem types not found, forbidden, attribute not permitted for
   the role (with field and flag), address in use (with holder kind), domain alias limit reached
   (with count and limit), destination not permitted (with destinations and reason), alias domain
   already exists, not a primary-domain alias, outdated version and temporary failure; validation
   failures with rule codes, parameters and every refused entry named.
8. **API feature 001**: identity with role, scope and the permission flags `aliasDomains`,
   `aliasExternalGoto`, `extendSenderAcl` and `ratelimit`; the public configuration's product name;
   the audit log, filtered by target type and identifier (API feature 004 FR-064).
9. **API feature 002**: the searchable domain list with each domain's relay state, for the domain
   pickers and filters.
10. **UI features 002 and 003** (no further API operations): the domain screens linked from aliases
    and alias domains, and the mailbox detail screen that links to "Send as".

### API gaps

None at API commit `8b59f80`. Three gaps found during the legacy analysis, against the first API
draft, were closed by the capabilities read (API FR-068): whether the groupware is enabled, whether
external destinations are disabled for everyone, and the default DKIM selector and key size. If the
merged contract lacks any capability listed above, the gap is specified in mailcow-rest-v2 first and
the UI does not work around it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a 360 px touch screen, an administrator finds an alias by a fragment of its address
  and opens it in under 15 seconds in 9 of 10 usability test runs.
- **SC-002**: On a phone, an administrator creates an alias with two destinations in under 1 minute,
  and a domain administrator creates an alias domain in under 1 minute.
- **SC-003**: Automated accessibility checks find zero WCAG 2.2 AA violations on every screen, dialog
  and state of this feature, on the 360 px and the desktop viewport.
- **SC-004**: With test data containing 254-character addresses and aliases with 200 destinations,
  no screen of this feature scrolls horizontally at 360 px.
- **SC-005**: 100% of the error types and validation rule codes of API feature 004 produce a
  translated message in English, Czech and Slovak, and translation completeness checks pass with no
  missing key.
- **SC-006**: In 100% of tested saves with an outdated version tag, the conflict notice appears, no
  stored value is overwritten, and every value the user entered is still visible.
- **SC-007**: For every role and permission flag combination in the test matrix, no control is shown
  whose action the API would refuse for that combination, and every permitted action has a control.
- **SC-008**: Every legacy element in the Legacy parity tables is covered by at least one end-to-end
  test or is marked Moved or Dropped with a reason.
- **SC-009**: The first page of the alias list appears within 2 seconds on a mid-range phone over a
  4G connection, on a server with 200,000 aliases.
- **SC-010**: A mass action on 100 aliases shows its per-object results within 15 seconds.
- **SC-011**: In usability tests, 9 of 10 administrators correctly identify catch-all aliases,
  special actions and receive-only aliases from the list alone.

## Assumptions

- UI feature 001 provides the shell, navigation groups, sign-in, identity refresh, the handling of
  401, 403, session expiry and unknown problems, the "no access" and "not found" states, language and
  theme switching, and the audit log screen. This feature adds its screens to the mail setup group,
  replacing UI feature 001's placeholder, and uses the audit log screen's target filter, which UI
  feature 002 adds.
- UI feature 002 provides the domain screens linked from aliases and alias domains; UI feature 003
  provides the mailbox detail screen that links to "Send as".
- The mailbox user's own view of their aliases and send-as addresses is UI feature 005. Temporary
  aliases (005), rate limit changes (006), BCC and recipient maps (009), and DKIM keys and DNS
  diagnostics (010) are managed in their features; this feature links to them where they exist.
- The app is built and tested against a mock generated from the pinned contract until the API
  implementation exists, as the constitution allows.
- "SOGo" in legacy groupware texts is the name of the groupware bundled with mailcow, not operator
  branding, so those texts are reused.
- The bulk limit of 100 objects, the default page size of 25 and the comment limit of 160 bytes are
  the API defaults; the app always uses the values from the capabilities read (FR-071). The page
  size choices of 25, 50 and 100 follow the API's cross-feature conventions.
- **Out of scope**:
  - the mailbox user's own view of aliases and send-as addresses, and temporary aliases (UI 005);
  - editing alias domain rate limits (UI 006) and DKIM keys, DKIM records and DNS diagnostics of
    alias domains (UI 010);
  - BCC maps and recipient maps that name alias addresses (UI 009);
  - domain administrator accounts and their permission flags (UI 007);
  - creating several objects in one request, which the API does not offer; the app sends one
    request per entry.
