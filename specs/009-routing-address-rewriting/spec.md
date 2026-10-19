# Feature Specification: Routing and Address Rewriting

**Feature Branch**: `main` (no feature branches, constitution 1.1.0)

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Routing and address rewriting screens for mailcowui-ng, the mobile-first
web app for an existing mailcow-dockerized server. Its only backend is mailcow REST API v2 feature
009 (routing and address rewriting). Administrators manage relayhosts (legacy 'sender-dependent
transports') and test them with a readable result, manage transport maps and run the transport
check, manage forwarding hosts, TLS policy maps, BCC maps and recipient maps, and assign a relayhost
to domains and mailboxes. Domain administrators see the BCC maps of their domains and manage them
with the BCC maps flag, and assign relayhosts to their domains and mailboxes when they hold the
matching relayhost flags. Stored relay credentials are never displayed. Destructive actions need
confirmation, lists become cards on phones, and every view has loading, empty and error states. It
replaces the legacy System › Configuration › Routing and Forwarding hosts tabs, the Mail setup ›
BCC, recipient map and TLS policy map tabs, their edit pages, the test dialog, and the relayhost
selectors of the edit-domain and edit-mailbox pages."

## Clarifications

### Session 2026-10-18

- Q: Where do these screens live in the navigation, and what does a domain administrator see? → A:
  One "Routing" section for administrators with six screens: Sender-dependent transports, Transport
  maps, TLS policy maps, Recipient maps, BCC maps and Forwarding hosts. Domain administrators see only
  BCC maps: always readable for their domains, changeable only with the BCC maps flag. Relayhost
  assignments are edited on the domain and mailbox screens, not in the Routing section. (agent
  decision: API permission matrix, FR-005 there, lets every domain administrator read BCC maps and
  reserves the rest for administrators; the UI roadmap groups these legacy tabs under one feature; legacy shows domain
  administrators the BCC tab with write buttons gated by the flag.)
- Q: How is a relayhost assignment edited on the domain and mailbox screens? → A: As its own
  "Relayhost" section with its own save action, separate from the domain or mailbox form. For a
  mailbox the section also shows the domain's assignment and the relayhost the mail server will
  actually use. (agent decision: the API changes assignments through their own operations with their
  own version tags and keeps the domain and mailbox edits refusing the field; one save per operation
  avoids half-saved forms.)
- Q: How does an administrator keep, replace or remove a stored relay password? → A: The password
  field starts empty and shows whether a password is stored. Leaving it empty keeps the password,
  typing replaces it, and a "Remove password" action removes it on save. Clearing the username tells
  the user that the password will be removed as well. (agent decision: API FR-012 to FR-014: passwords
  are write-only, an omitted password is kept, an empty one removes it, and an empty username removes
  the password.)
- Q: Can the add-transport form still take several destinations at once, as the legacy field does?
  → A: Yes. The form accepts several destinations and creates one transport per destination, then
  reports each result; destinations that failed stay in the field with their reasons. (agent decision:
  the API accepts one destination per creation and suggests the web app split the input and report
  each result; this keeps the legacy convenience without the legacy habit of silently skipping
  invalid destinations.)
- Q: Should the test form prefill the legacy sender and recipient addresses? → A: No. Both fields start
  empty and an empty field means the server's configured default address, which the fields show as
  placeholders. The legacy hint about the null recipient address is shown next to the recipient
  field. (agent decision: API FR-041 makes the defaults operator-configurable server settings, so a
  hard-coded prefill could contradict the server; the placeholders follow consistency change 5.)
- Q: How is a test result presented on a phone? → A: A summary first: accepted or not, the step reached
  or failed, the host and port used and whether they came from an MX lookup, whether TLS was used,
  whether the login succeeded, and the last server reply. The full transcript follows as plain text in
  a section collapsed on phones, with a copy action. (agent decision: API FR-043 returns exactly these
  fields; mobile-first reading puts the verdict on the first screen.)
- Q: Are the legacy mass actions kept, and how are concurrent changes handled? → A: Lists keep
  multi-select with the legacy mass actions, up to the server's bulk limit (100 by default) of
  selected entries, applied as one bulk action whose result is reported per entry (done, not found,
  refused, outdated or failed, with the reason). Each selected entry is sent with the version that
  was listed. Single edits, deletions and assignment changes always send the version that was read;
  an outdated version is reported, the user's input is kept, the entry is reloaded and the values
  that changed are marked. (agent decision: API FR-090 and FR-091 define bulk actions of up to 100
  entries with per-entry results and optional per-entry versions, and FR-008 honours versions when
  sent; constitution II requires preventing lost updates; legacy offers these mass actions. Amended
  by consistency changes 1, 3 and 4.)
- Q: What does the confirmation for deleting a relayhost that is in use show? → A: The number of
  domains and mailboxes that use it, up to ten names of each with a link to the full usage list, and
  that their assignments will be cleared to "None / inherit". (agent decision: API FR-021 clears the
  assignments atomically and FR-022 offers a paginated usage list; constitution II requires showing
  what a destructive action affects.)
- Q: What are relayhosts and transports called on screen, given that the API says "relayhost" and the
  legacy UI says "sender-dependent transport"? → A: The screens keep the legacy labels and keys:
  "Sender-dependent transports" (`admin.relayhosts`, also the Relayhost section title
  `edit.relayhost`) and "Transport maps" (`admin.transport_maps`). The screen's introduction mentions
  that sender-dependent transports are also called relayhosts. This spec uses "relayhost" and "transport" as its canonical
  terms. (agent decision: constitution IV uses mailcow's translations verbatim, so the existing
  translations of every language and operators' habits carry over; the API's term is shown once so
  that documentation and API users can match it, as a new string, which the plan lists among its
  deviations.)
- Q: Can administrators trace changes of routing entries from these screens? → A: Yes. Each entry and
  each relayhost assignment offers a "History" action to administrators that opens the audit log
  filtered to that entry. Domain administrators do not get it. (agent decision: API user story 9 and
  FR-086 add audit filters by target; the audit log is administrator-only, FR-005 there.)

### Consistency changes (plan, 2026-10-18)

The plan aligned this spec with the API 009 contract and `docs/conventions.md` (see
[plan.md](./plan.md#consistency-changes-to-the-spec)):

1. **Bulk actions carry version tags**: each selected entry is sent with the version that was
   listed; the per-entry outcomes include "outdated"; refused, outdated and failed entries stay
   selected for a retry; a dropped connection is reported as "outcome unknown" and never retried
   automatically (conventions "Bulk actions", API FR-091). Previously: "bulk actions carry no
   versions". Affects FR-016 and the edge cases.
2. **Confirmations**: a bulk deletion needs the number of entries typed; deactivation, single or
   bulk, and activating a transport for `*` need one explicit confirmation (conventions
   "Confirmations"). Affects FR-017.
3. **Outdated saves**: the input is kept, the entry is reloaded, the values that changed are marked,
   and the user saves again or takes the current values; there is no automatic merge and no
   "overwrite anyway"; a refused deletion is confirmed again (conventions "Editing and conflicts").
   Affects FR-014.
4. **Limits from the routing capabilities**: the selection limit is the server's bulk limit (100 by
   default), and the test's "no result" state appears after the server's total test timeout plus
   15 seconds (75 seconds with the default 60) instead of a fixed 75 seconds (conventions "Where
   features meet", API FR-093). Affects FR-016, FR-045 and the edge cases.
5. **Both former API gaps are closed by API 009**: the default test addresses are readable and are
   shown as placeholders of the empty test fields; every BCC map reports whether its domain still
   exists, so administrators see orphaned maps labelled and can filter on them. Affects FR-044,
   FR-050, FR-051, the edge cases and the API Dependency section.
6. **Documented error types**: "too many requests" and "attribute not permitted" are not documented
   for any API 009 operation; they keep the shared translations of earlier features and are not
   specific to this feature. Affects FR-066.
7. **Navigation**: as FR-002 says, every domain administrator sees the Routing section with BCC
   maps, read-only without the flag. UI 001's navigation catalogue row, which shows the section
   only with the BCC maps flag, is changed by this feature.
8. **Shared next hop lookup, interim limitation**: the API's `nextHop` list filter does not
   normalise its value as a stored next hop is normalised (a bare IP address is stored in brackets,
   a Unicode host in ASCII). Until mailcow-rest-v2 closes this gap (plan, API gap list), the
   confirmation of FR-041 before saving can miss the other transports when the next hop is typed as
   a bare IP address or a Unicode host; the report after saving still names every transport whose
   credentials changed. The app does not copy the server's normalisation (constitution I). Affects
   FR-041.
9. **Credential note on mailboxes**: the API reports which relayhost's credentials the mail server
   sends for a mailbox (`credentialsRelayhost`). When both the mailbox's and the domain's relayhost
   are active, the note says either that the domain relayhost's credentials are sent or, when the
   domain's relayhost has no username, that no credentials are sent at all. This replaces "tries the
   credentials of the domain's relayhost first". Affects FR-035 and the edge cases.

## Terminology

- **Relayhost** (screen label "Sender-dependent transport"): an outbound smarthost, given as a host
  with an optional port, with optional credentials. Mail sent from a domain or mailbox assigned to it
  leaves through it.
- **Relayhost assignment** (section label "Sender-dependent transports"): the relayhost chosen for a
  domain or a mailbox, or "None / inherit".
- **Effective relayhost**: the relayhost the mail server actually uses for mail sent from a mailbox's
  own address: the mailbox's relayhost when set and active, otherwise the domain's when set and active,
  otherwise none (direct delivery).
- **Transport** (screen label "Transport maps"): a rule that sends mail for a destination (a domain,
  its subdomains, an address, `*`, or a regular expression matched against the MX host name) to a next
  hop. Transports with the same next hop share one username and password. A transport overrules
  relayhosts.
- **Connection test**: a test message sent through one saved relayhost or transport. Legacy calls it
  "Test" on relayhosts and the "transport check" on transports; it is one capability in this app.
- **Password status**: "password stored" or "no password". The password itself is never shown.
- **BCC map**: a rule that silently copies every message sent by (sender type) or to (recipient type) a
  local destination — a domain, alias domain, mailbox or alias — to one BCC destination.
- **Recipient map**: a rule that replaces an original recipient (an address or a whole domain) with a
  new one before delivery.
- **TLS policy map**: an outbound TLS policy with optional parameters for a destination.
- **Forwarding host**: an address or network whose incoming mail is accepted without block-list checks
  or greylisting; its source is what the administrator entered (an address, network or name).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage relayhosts (Priority: P1)

An administrator opens Routing › Sender-dependent transports on a phone. Each relayhost is a card that
shows its host, its identifier, its username if any, whether a password is stored, whether it is
active, and how many domains and mailboxes use it. The administrator searches and filters the list,
adds a relayhost with a host and optional credentials, edits it, activates or deactivates it, sees which domains and mailboxes
use it, and deletes it after a confirmation that names them. A stored password is never displayed.

**Why this priority**: relayhosts are the most used routing objects, assignments and tests depend on
them, and the legacy UI shows their passwords in clear text today.

**Independent Test**: against the mock API, create, edit, deactivate and delete relayhosts with and
without credentials on a 360 px and a desktop viewport, and verify that no stored password appears on
screen, in the page or in browser storage.

**Acceptance Scenarios**:

1. **Given** three relayhosts exist, **When** an administrator opens the list at 360 px, **Then** each
   appears as a card with host, identifier, username, password status, active state and the numbers
   of domains and mailboxes using it, without horizontal scrolling.
2. **Given** no relayhost exists, **When** the list opens, **Then** an empty state explains what a
   relayhost is for and offers to add one.
3. **Given** the add form, **When** the administrator enters `[smtp.example.net]:587`, a username and
   a password and saves, **Then** the relayhost appears in the list, active, and a success message is
   announced.
4. **Given** the add form, **When** the administrator types a host ending in `:465`, **Then** the form
   warns that TLS-wrapped ports are not supported and suggests a STARTTLS port.
5. **Given** a relayhost with a stored password, **When** its edit form opens, **Then** the password
   field is empty, the form states that a password is stored, and saving without typing a password
   keeps it.
6. **Given** a relayhost with a stored password, **When** the administrator chooses "Remove password"
   and saves, **Then** the relayhost shows "no password".
7. **Given** a relayhost used by two domains and three mailboxes, **When** the administrator chooses to
   delete it, **Then** a confirmation names those domains and mailboxes and states that their
   assignments will be cleared; nothing is deleted until the administrator confirms.
8. **Given** an invalid host, **When** the administrator saves, **Then** a translated message appears
   at the host field and the other entered values are kept.

---

### User Story 2 - Assign a relayhost to a domain or a mailbox (Priority: P1)

On a domain's screen and on a mailbox's screen, a "Relayhost" section shows the current assignment.
An administrator, or a domain administrator holding the matching flag ("change relayhost for a
domain" or "change relayhost for a mailbox"), chooses a relayhost or "None / inherit" and saves the
section. For a mailbox the section also shows the domain's relayhost and which relayhost the mail
server will actually use. Without the flag a domain administrator sees the assignment read-only.

**Why this priority**: a relayhost has no effect until it is assigned, and domain administrators need
assignments for customers whose mail must leave through their own provider.

**Independent Test**: with the mock API, assign, change and clear relayhosts on a domain and on a
mailbox as an administrator and as domain administrators with and without each flag.

**Acceptance Scenarios**:

1. **Given** an administrator on a domain's screen, **When** they choose relayhost 3 and save the
   Relayhost section, **Then** the section shows relayhost 3 and its usage count includes the domain.
2. **Given** a domain administrator with the domain flag, **When** they open one of their domains,
   **Then** they can change its relayhost; **Given** one without the flag, **Then** the assignment is
   shown read-only with its host and active state.
3. **Given** a domain administrator with the mailbox flag and a domain assigned to relayhost 3, **When**
   they assign relayhost 5 to a mailbox, **Then** the mailbox shows relayhost 5 as assigned and as
   effective, and the domain's relayhost 3 is shown alongside.
4. **Given** a mailbox assigned to an inactive relayhost in a domain assigned to an active one, **When**
   the mailbox's section is shown, **Then** the mailbox relayhost is labelled "inactive" in text and
   the domain's relayhost is shown as effective.
5. **Given** an assignment that refers to a relayhost that no longer exists, **When** the section is
   shown, **Then** it states that the assigned relayhost no longer exists and has no effect, and offers
   to replace or clear it.
6. **Given** another user changed the assignment after the section was opened, **When** the user saves,
   **Then** the app reports that the assignment changed meanwhile and offers to reload it.
7. **Given** no relayhost exists, **When** an administrator opens the choice, **Then** only "None /
   inherit" is offered, with a link to add a relayhost.

---

### User Story 3 - Manage transports (Priority: P1)

An administrator manages transports: lists, searches and filters them; adds transports with one or
several destinations, a next hop, optional credentials, "destination is an MX regular expression" and
an active state; edits, activates, deactivates and deletes them. Transports with the same next hop
share one set of credentials, and the app makes this visible before and after every change.

**Why this priority**: transports overrule relayhosts and decide where mail for partner systems goes;
a wrong entry misroutes mail.

**Independent Test**: with the mock API, create transports of each destination kind, including two
that share a next hop, change shared credentials, and verify the warnings and the reported effects.

**Acceptance Scenarios**:

1. **Given** transports exist, **When** the list opens at 360 px, **Then** each card shows destination,
   next hop, username, password status, an "MX regular expression" marker in text where it applies,
   active state, and how many other transports share its next hop.
2. **Given** the add form, **When** the administrator enters three destinations and saves, **Then**
   three transports are created, created inactive unless the administrator chose active, and the
   result names each destination with its outcome.
3. **Given** one of three destinations is invalid, **When** the administrator saves, **Then** the two
   valid transports are created, and the invalid destination stays in the field with its reason.
4. **Given** transports A and B share a next hop, **When** the administrator changes A's password,
   **Then** before saving the form names B and asks for confirmation, and after saving it states that
   B's credentials changed too.
5. **Given** a next hop already used with username `u1`, **When** the administrator creates a transport
   for it with username `u2`, **Then** the app explains that this next hop already has different
   credentials.
6. **Given** a transport with next hop `relay.net`, **When** the administrator creates one with
   `[relay.net]:587`, **Then** the app explains that the next hops interfere and names `relay.net`.
7. **Given** the destination `*`, **When** it is entered, **Then** the form warns that it applies to
   every recipient, including the hosted domains.

---

### User Story 4 - Test a relayhost or a transport (Priority: P2)

From a relayhost or a transport, an administrator starts a connection test, optionally with a sender
and a recipient address, and runs it. While it runs, the app shows that it is in progress. Then the
administrator reads a summary — accepted or not, the step reached or failed, the server contacted,
TLS and login — followed by the full transcript, readable on a phone, without any credentials.

**Why this priority**: the test prevents misrouted mail, but routing can be configured without it.

**Independent Test**: with mocked results for an accepted message, each failed step and a timeout,
run the test on both viewports and verify the summary and the transcript.

**Acceptance Scenarios**:

1. **Given** a relayhost, **When** the administrator opens its test, **Then** the sender and recipient
   fields are empty, an empty field is explained as "use the server's default address", and the
   legacy hint about the null recipient address is shown.
2. **Given** the test is running, **When** the administrator waits, **Then** a progress state is shown
   and announced, and the run action cannot be triggered again until a result arrives.
3. **Given** the remote server accepted the message, **When** the result arrives, **Then** the summary
   says "accepted", that TLS was used and that the login succeeded, above the transcript.
4. **Given** the login was rejected, **When** the result arrives, **Then** the summary says "not
   accepted", names the login step and shows the server's last reply.
5. **Given** a transport whose next hop was looked up by MX, **When** the result arrives, **Then** the
   summary names the mail exchanger host and port that were used and says they came from an MX lookup.
6. **Given** a sender `not-an-address`, **When** the administrator runs the test, **Then** the sender
   field shows the reason and no test runs.
7. **Given** a transcript, **When** it is shown at 360 px, **Then** long lines wrap, the redaction marks
   of the login exchange are visible as given, and the administrator can copy the transcript.

---

### User Story 5 - Manage BCC maps (Priority: P2)

An administrator, or a domain administrator with the BCC maps flag, sets up silent copies: every
message sent by, or sent to, a domain, alias domain, mailbox or alias is copied to one other address.
The local destination is chosen from a searchable list of the choices in the user's scope. The list of
maps supports filters, activating, deactivating, switching the type and deleting. A domain
administrator without the flag sees the maps of their domains read-only.

**Why this priority**: archiving and compliance copies are a common customer request, and this is the
only part of the feature that domain administrators manage themselves.

**Independent Test**: with the mock API, add, edit and delete BCC maps as an administrator and as a
domain administrator with the flag; verify that a domain administrator without the flag can read but
not change them.

**Acceptance Scenarios**:

1. **Given** BCC maps exist, **When** the list opens at 360 px, **Then** each card shows the type in
   text, local destination (domain-wide maps labelled as such), BCC destination, domain and active
   state.
2. **Given** the add form, **When** the user searches the local destination choices for part of an
   address, **Then** matching domains, alias domains, mailboxes and aliases of their scope are offered,
   labelled by kind, and aliases show the mailboxes they deliver to.
3. **Given** a BCC destination with two addresses, **When** saving, **Then** the field explains that one
   address is allowed and suggests an alias for several recipients.
4. **Given** a recipient-type map for the same local destination exists, **When** the user saves
   another recipient-type map for it, **Then** the duplicate is reported.
5. **Given** an existing map, **When** its edit form opens, **Then** the local destination and the
   domain are shown read-only, and type, BCC destination and active state are editable.
6. **Given** a domain administrator without the BCC maps flag, **When** they open BCC maps, **Then**
   they see their domains' maps without add, edit, delete or selection controls, and a note explains
   that changing them needs the BCC maps permission.

---

### User Story 6 - Manage TLS policy maps (Priority: P2)

An administrator overrides the outbound TLS policy for selected destinations: lists, searches and
filters entries, adds them with a destination, a policy explained in plain language and optional
parameters, edits, activates, deactivates and deletes them.

**Why this priority**: rarely needed, but security relevant when it is.

**Independent Test**: with the mock API, add, edit and delete TLS policy maps on both viewports.

**Acceptance Scenarios**:

1. **Given** TLS policy maps exist, **When** the list opens, **Then** each card shows destination,
   policy, parameters (or a dash) and active state.
2. **Given** the add form, **When** the administrator opens the policy choice, **Then** each of the
   eight policies is listed with a one-line translated explanation.
3. **Given** an invalid destination or parameters, or a destination that already has an entry,
   **When** saving, **Then** the reason appears at the matching field.

---

### User Story 7 - Manage recipient maps (Priority: P2)

An administrator rewrites recipients before delivery: lists, searches and filters recipient maps,
adds them with an original and a new recipient (each an address or a domain), edits, activates,
deactivates and deletes them.

**Why this priority**: needed for migrations and renames, but used by few installations.

**Independent Test**: with the mock API, add, edit and delete recipient maps on both viewports.

**Acceptance Scenarios**:

1. **Given** recipient maps exist, **When** the list opens, **Then** each card shows original
   recipient, new recipient and active state, and domain-wide maps are labelled as such in text.
2. **Given** an original recipient that already has a map, **When** saving, **Then** the duplicate is
   reported at that field.
3. **Given** a value that is neither an address nor a domain, **When** saving, **Then** the field
   explains the accepted forms.

---

### User Story 8 - Manage forwarding hosts (Priority: P2)

An administrator lists the hosts that forward mail to the server, adds an address, a network, a host
name or a domain name, sees every address the input resolved to and whether each was added or
updated, switches the spam filter per entry and removes entries.

**Why this priority**: without forwarding hosts, forwarded mail is greylisted or rejected, but only
some installations need them.

**Independent Test**: with the mock API, add a name that resolves to two addresses (one already
listed), switch the spam filter and delete entries on both viewports.

**Acceptance Scenarios**:

1. **Given** forwarding hosts exist, **When** the list opens, **Then** each card shows the address, the
   source it was added as, and whether the spam filter is enabled, in text.
2. **Given** the administrator adds `forwarder.example`, **When** it resolves to two addresses, one of
   them already listed, **Then** the result names both, one as added and one as updated.
3. **Given** a name that resolves to no address, **When** saving, **Then** the field explains that it
   could not be resolved; **Given** DNS is temporarily unavailable, **Then** the app says so and offers
   to retry.
4. **Given** a card's source, **When** the administrator selects it, **Then** the list shows all
   addresses added from that source.

---

### User Story 9 - Open the change history of a routing entry (Priority: P3)

An administrator investigating misrouted mail opens "History" on a relayhost, transport, map,
forwarding host or relayhost assignment and lands in the audit log filtered to that entry.

**Why this priority**: useful for investigations, but routing can be managed without it.

**Independent Test**: with the mock API, open History from each kind of entry and verify that the
audit log opens with the matching target filter; verify that domain administrators see no History
action.

**Acceptance Scenarios**:

1. **Given** a relayhost, **When** an administrator chooses History, **Then** the audit log opens
   filtered to that relayhost.
2. **Given** a mailbox's Relayhost section, **When** an administrator chooses History, **Then** the
   audit log opens filtered to that mailbox's relayhost assignment.
3. **Given** a domain administrator, **When** they view BCC maps or a Relayhost section, **Then** no
   History action is offered.

---

### Edge Cases

- **Relayhost deleted while assigned**: the confirmation names the domains and mailboxes that use it;
  afterwards their sections show "None / inherit".
- **Several relayhosts with the same host** (two accounts on one smarthost): cards and choices show the
  identifier, and for administrators the username, so the entries can be told apart.
- **Assignment to an inactive relayhost**: allowed; the section states that it has no effect until the
  relayhost is activated and, for a mailbox, that the domain's relayhost applies meanwhile.
- **Dangling assignment** (the relayhost no longer exists): shown as such with its stored identifier,
  replaceable and clearable.
- **Both a domain and a mailbox relayhost apply**: the mailbox section notes that the mail server
  connects to the mailbox's relayhost with the domain relayhost's credentials, or with none when the
  domain's relayhost has no username.
- **Domain administrator with only one relayhost flag**: the other section stays read-only.
- **Clearing a username while a password is stored**: the form states that the password will be
  removed too. **Typing a password without a username**: the API's refusal is shown at the username
  field.
- **Credential change on a shared next hop**: the warning names the other transports; when a transport
  is moved onto a shared next hop without credentials, the form states that it will use that next
  hop's credentials.
- **Transport destination `*`**: warning that it applies to every recipient, including the hosted
  domains.
- **Test of an inactive relayhost or transport**: allowed, and the screen says the entry is inactive.
- **Test takes up to 60 seconds** or never answers: the progress state stays; after the server's total
  test timeout plus 15 seconds (75 seconds with the default) without a result, the app shows that no
  result was received, that the test may still have sent a message, and offers to run the test again.
- **Leaving the test screen while a test runs**: no stuck state remains; the result is discarded.
- **BCC map whose domain no longer exists** (administrators only): listed, labelled in text as
  "domain no longer exists", filterable, and editable and deletable like any other map.
- **Very many BCC destination choices** (thousands of mailboxes and aliases): the picker searches and
  pages instead of loading everything.
- **Very many entries in any list**: the list pages and shows the total.
- **Long values**: hosts, regular expressions, BCC destinations, TLS parameters and transcript lines
  wrap at 360 px; nothing needs horizontal scrolling.
- **Concurrent change**: an edit, deletion or assignment saved with an outdated version is refused; the
  user is told and keeps their input, the entry is reloaded with the changed values marked, and the
  user saves again or takes the current values. A refused deletion is confirmed again.
- **Entry removed elsewhere**: opening or saving it shows "no longer exists" and offers the list.
- **Permission lost mid-session** (flag removed, role changed): the next action shows "not permitted"
  naming the missing permission; navigation follows the refreshed identity.
- **Bulk action with partial failure**: each entry's outcome is reported, for example an entry removed
  meanwhile ("not found"), an entry changed since it was listed ("outdated") or a BCC map whose type
  switch would duplicate another map ("refused"). Refused, outdated and failed entries stay selected.
- **Bulk action whose connection drops**: the outcome is reported as unknown and the action is not
  retried automatically.
- **Selection above the bulk limit** (page sizes are 25, 50 and 100; the server's limit is 100 by
  default but may be lower): the app stops at the limit and says that it is the limit of one action.
- **Test started from an edit screen with unsaved changes**: the app says that the test uses the saved
  values, because the API tests only saved entries.
- **Forwarding host input in non-canonical form** (for example `192.0.2.5/24`): the result shows the
  stored form the API returns (`192.0.2.0/24`).
- **Unsaved changes**: leaving a form or a Relayhost section with changes asks for confirmation.
- **Browser offers saved sign-in credentials** in relay credential fields: those fields are not filled
  with the user's own sign-in credentials.
- **Network failure** during load or save: an error state with retry; entered values are kept, except
  passwords.

## Requirements *(mandatory)*

### Functional Requirements

#### Access and navigation

- **FR-001**: The app MUST offer administrators a Routing section with six screens, labelled with the
  legacy terms: Sender-dependent transports (relayhosts), Transport maps (transports), TLS policy maps,
  Recipient maps, BCC maps and Forwarding hosts. The relayhost screen's introduction MUST state that
  sender-dependent transports are also called relayhosts.
- **FR-002**: Domain administrators MUST see only the BCC maps screen of the Routing section: read-only
  without the BCC maps permission flag, with add, edit, delete and bulk actions when they hold it.
  Mailbox users MUST NOT see the Routing section or any Relayhost section.
- **FR-003**: Navigation entries, actions and editable controls MUST follow the role and permission
  flags that the API reports for the signed-in user. Hiding a control is a convenience only. When the
  API refuses an action for a missing permission flag, the app MUST show a translated message that
  names the permission, and MUST NOT display the action as done.
- **FR-004**: Each list (with its search, filters, sort order and page), each entry's screen, each
  relayhost usage view and each connection test MUST have its own addressable location, so that it can
  be bookmarked, shared with another administrator and reopened after sign-in.

#### Lists

- **FR-005**: Every list MUST render as cards at narrow widths and MAY render as a table on wide
  screens. At a 360 px viewport no list, card or form MAY need horizontal scrolling.
- **FR-006**: Every list MUST have a loading state, an error state with a retry action, and an empty
  state. The empty state MUST distinguish "no entries yet" (explaining the purpose and offering the add
  action to permitted users) from "no entries match" (offering to clear the search and filters).
- **FR-007**: Every list MUST page through results, 25 entries per page by default, and show the total
  number of matching entries. Lists MUST offer the search, filters and sort orders listed for each
  screen below. On phones, filters and sorting MUST open from a single control instead of taking
  permanent space.
- **FR-008**: Each screen MUST show the explanatory text of the matching legacy screen. At narrow widths
  the text MAY be collapsed behind a disclosure control.
- **FR-009**: After a change made in this app, every list, count, usage figure and Relayhost section
  affected by it MUST show the new state without a manual reload. Each list MUST also offer a refresh
  action.
- **FR-010**: Each card MUST expose its actions (edit, test where applicable, activate or deactivate,
  history where applicable, delete) through controls of at least 44×44 CSS px, reachable by touch,
  keyboard and screen reader.

#### Forms

- **FR-011**: Add and edit forms MUST open as their own screens at narrow widths, not as overlays, with
  one column, a visible label for every field, the legacy hints next to the fields they describe, and
  the save action reachable without scrolling back to the top. After a successful save the app MUST
  return to the list (or stay in the Relayhost section), show the saved entry and announce the success.
- **FR-012**: Leaving a form or a Relayhost section with unsaved changes MUST ask for confirmation.
- **FR-013**: A refused save MUST keep every entered value except passwords (FR-028), show each field
  error next to its field, list the errors in a summary at the top of the form, and move focus to that
  summary.
- **FR-014**: Edits, deletions and assignment changes MUST send the version of the entry that the user
  saw. When the API reports the version as outdated, the app MUST say that the entry changed meanwhile,
  keep the user's input, reload the entry and mark the values that changed, and let the user save
  again or take the current values, replacing the input only when the user chooses to. There MUST be
  no automatic merge and no "overwrite anyway". A deletion refused as outdated MUST be confirmed
  again.

#### Selection and bulk actions

- **FR-015**: Lists MUST let permitted users select several entries, or all entries of the current page,
  and apply the legacy mass actions: activate and deactivate (relayhosts, transports, BCC maps, recipient
  maps, TLS policy maps), switch to sender type and switch to recipient type (BCC maps), enable and
  disable the spam filter (forwarding hosts), and delete (all lists).
- **FR-016**: A selection MUST cover the current page only and hold at most the server's bulk limit
  (100 by default); when the user tries to select more, the app MUST say that this is the limit. Each
  selected entry MUST be sent with the version that was listed. A bulk action MUST report every
  selected entry's outcome: done, not found, refused, outdated or failed, the last three with a
  translated reason. Done entries MUST stay changed when others fail, and refused, outdated and failed
  entries MUST stay selected. When the whole action is refused (for example a missing permission), the
  app MUST say so once, naming the permission. When the connection drops, the app MUST report the
  outcome as unknown and MUST NOT retry automatically. The summary MUST be announced to screen
  readers.

#### Destructive actions

- **FR-017**: Every deletion, single or bulk, MUST require an explicit confirmation that names what will
  be deleted (for a bulk deletion, the number and the list of entries) and its consequences. A bulk
  deletion MUST require the number of entries to be typed. Deactivation, single or bulk, and
  activating a transport whose destination is `*` MUST require one explicit confirmation. The safe
  choice MUST be the default, and nothing MAY be changed before the user confirms.
- **FR-018**: The confirmation for deleting a relayhost MUST show the numbers of domains and mailboxes
  that use it, up to ten names of each with a link to the full usage view, and state that their
  assignments will be cleared to "None / inherit".

#### Relayhosts

- **FR-019**: The relayhost list MUST show, per relayhost: host, identifier, username (if any), password
  status ("password stored" or "no password"), active state, and the numbers of domains and of
  mailboxes assigned to it.
- **FR-020**: The relayhost list MUST offer a search on host and username, filters on the active state
  and on whether the relayhost is in use, and sorting by identifier (default), host, username, active
  state, number of domains and number of mailboxes.
- **FR-021**: Administrators MUST be able to add a relayhost with a host (required), a username, a
  password and an active state (preselected active). The form MUST show the legacy hints that
  TLS-wrapped ports are not supported and that credentials are stored as plain text on the server,
  explain that brackets around the host turn off the MX lookup, and warn when the host ends in port 465.
- **FR-022**: Administrators MUST be able to edit a relayhost's host, username, password and active
  state. The identifier and usage counts MUST be shown read-only.
- **FR-023**: Administrators MUST be able to open a relayhost's usage view: the domains and mailboxes
  assigned to it, paged, with a filter on the kind and a search on the name, each linking to its domain
  or mailbox screen.
- **FR-024**: Administrators MUST be able to activate, deactivate and delete relayhosts.

#### Stored credentials

- **FR-025**: The app MUST NOT display a stored relayhost or transport password, or any part of one,
  anywhere: not in lists, cards, forms, choices, confirmations, test screens or the page itself. It MUST
  show only the password status.
- **FR-026**: In an edit form the password field MUST start empty and state whether a password is
  stored. Saving with the field left empty MUST keep the stored password; typing a value MUST replace
  it; a "Remove password" action MUST remove it on save and be shown as pending until then.
- **FR-027**: When the user clears the username of an entry with a stored password, the form MUST state
  that saving will also remove the password.
- **FR-028**: Password fields MUST be masked by default, MAY offer a control to reveal what the user is
  typing, MUST NOT be filled with the user's own saved sign-in credentials, and MUST be emptied after a
  save, a refused save or leaving the form.

#### Relayhost assignment

- **FR-029**: Each domain's screen (feature 002) MUST contain a Relayhost section with its own save
  action. It MUST be editable for administrators and for domain administrators holding the "change
  relayhost for a domain" flag, and read-only for other domain administrators.
- **FR-030**: Each mailbox's screen (feature 003) MUST contain a Relayhost section with its own save
  action, editable for administrators and for domain administrators holding the "change relayhost for a
  mailbox" flag, and read-only otherwise. It MUST show the mailbox's assignment, the domain's assignment
  and the effective relayhost for mail sent from the mailbox's own address, with the legacy hint that
  the mailbox relayhost applies to the mailbox and its direct aliases, not to its addresses in alias
  domains, and overrides the domain's relayhost.
- **FR-031**: A read-only Relayhost section MUST show the assigned relayhost's host and active state, or
  "None / inherit".
- **FR-032**: The relayhost choice MUST offer "None / inherit" and every relayhost, each with its host,
  its identifier, an "inactive" label in text when inactive, and for administrators its username. The
  choice MUST be searchable and paged.
- **FR-033**: Choosing an inactive relayhost MUST be allowed, and the section MUST state that it has no
  effect until the relayhost is activated (for a mailbox: that the domain's relayhost applies
  meanwhile).
- **FR-034**: An assignment that refers to a relayhost that no longer exists MUST be shown as such, with
  its stored identifier and the note that it has no effect, and MUST be replaceable and clearable.
- **FR-035**: When both the mailbox's and its domain's relayhost are active, the mailbox's section
  MUST note which credentials the mail server sends when it connects to the mailbox's relayhost:
  those of the domain's relayhost, or none when the domain's relayhost has no username.
  (consistency change 9)
- **FR-036**: When no relayhost exists, the choice MUST offer only "None / inherit" and, for
  administrators, a link to add a relayhost.

#### Transports

- **FR-037**: The transport list MUST show, per transport: destination, next hop, identifier, an "MX
  regular expression" marker in text for MX-based destinations, username (if any), password status,
  active state, and the number of other transports that share its next hop. Selecting that number MUST
  show the list filtered to that next hop.
- **FR-038**: The transport list MUST offer a search on destination, next hop and username, filters on
  the active state, MX-based and next hop, and sorting by identifier (default), destination, next hop,
  username, active state and MX-based.
- **FR-039**: Administrators MUST be able to add transports with destinations, next hop, MX-based,
  username, password and active state (preselected inactive, with a hint that an active `*` transport
  reroutes all outbound mail). The destination field MUST accept several destinations separated by
  line breaks, commas, semicolons or spaces; the app MUST create one transport per destination, report
  each outcome, remove created destinations from the field and keep failed ones with their reasons.
- **FR-040**: The transport form MUST show the legacy hints on destination formats, on MX regular
  expressions, on the precedence of transports over relayhosts and on plain-text credential storage,
  and MUST warn when the destination is `*` that it applies to every recipient, including the hosted
  domains.
- **FR-041**: Before saving a username or password for a next hop that other transports use, the form
  MUST name those transports and ask for confirmation that their credentials will change too. When a
  transport is saved onto a next hop used by other transports without credentials, the form MUST state
  that it will use that next hop's credentials. After a save, the app MUST name the other transports
  whose credentials changed. (Interim limitation for bare IP and Unicode next hops: consistency
  change 8.)
- **FR-042**: Administrators MUST be able to edit a transport's destination (one), next hop, MX-based,
  username, password and active state, and to activate, deactivate and delete transports.

#### Connection test

- **FR-043**: Every relayhost and every transport, active or inactive, MUST offer administrators a
  connection test from its card and from its edit screen. A test started from an edit screen with
  unsaved changes MUST state that it uses the saved values.
- **FR-044**: The test MUST offer an optional sender and an optional recipient address, both empty at
  first, explained as "empty uses the server's default address" and showing the server's configured
  default addresses as placeholders, with the legacy hint about the null recipient address. Invalid
  addresses MUST be reported at their field and no test MUST run.
- **FR-045**: While a test runs, the app MUST show and announce a progress state and MUST prevent
  starting it again. If no result arrives within the server's total test timeout plus 15 seconds (75
  seconds with the default), the app MUST say that no result was received and that the test may still
  have sent a message, and offer to run the test again.
- **FR-046**: The result MUST start with a summary: whether the message was accepted; the step reached
  or failed (name resolution, connection, greeting, TLS, login, sender, recipient or message); the host
  and port used and whether they came from an MX lookup; whether TLS was used; whether the login
  succeeded or was not attempted; and the last server reply.
- **FR-047**: The transcript MUST follow the summary in a section that is collapsed on phones, as plain
  text that keeps line breaks and wraps long lines, labelled as untranslated server output, with a copy
  action. Its meaning MUST NOT depend on colour.
- **FR-048**: The test screen MUST state that the test connects directly to the next hop, so that TLS
  policy maps and mailbox TLS settings do not apply to it.
- **FR-049**: Test results MUST NOT be stored by the app. Running the test again replaces the result;
  leaving the screen discards it.

#### BCC maps

- **FR-050**: The BCC map list MUST show, per map: type in text (sender or recipient), local destination
  (domain-wide maps labelled as such), BCC destination, domain and active state, and for
  administrators a "domain no longer exists" label in text on orphaned maps; the map's screen MUST
  also show its creation and modification times.
- **FR-051**: The BCC map list MUST offer a search on local and BCC destination, filters on type, active
  state and domain (several domains allowed), for administrators also on orphaned maps, and sorting by
  identifier (default), type, local destination, BCC destination, domain, active state, creation time
  and modification time.
- **FR-052**: Permitted users MUST be able to add a BCC map by choosing the local destination from a
  searchable, paged list of the choices in their scope, filterable by kind and domain, where each choice
  shows its value, kind and domain and, for aliases and alias-domain addresses, the mailboxes it
  delivers to; then choosing the type, entering one BCC destination and the active state (preselected
  active).
- **FR-053**: Permitted users MUST be able to edit a map's type, BCC destination and active state; the
  local destination and domain MUST be shown read-only.
- **FR-054**: The BCC screens MUST show the legacy hints that the BCC destination is a single address
  (use an alias for several), that the local destination is not told about failed copies, and the
  explanation that copies are sent only for mail the spam filter does not reject or greylist and that
  sub-address tags are ignored when matching.

#### Recipient maps

- **FR-055**: The recipient map list MUST show original recipient, new recipient (domain-wide maps
  labelled as such) and active state; the map's screen MUST also show its creation and modification
  times. The list MUST offer a search on both recipients, a filter on the active state, and sorting by
  identifier (default), original recipient, new recipient, active state, creation time and modification
  time.
- **FR-056**: Administrators MUST be able to add and edit recipient maps (original recipient, new
  recipient, active state preselected active) with the legacy hints on the accepted forms, and to
  activate, deactivate and delete them.

#### TLS policy maps

- **FR-057**: The TLS policy map list MUST show destination, policy, parameters (a dash when empty) and
  active state; the entry's screen MUST also show its creation and modification times. The list MUST
  offer a search on destination and parameters, filters on policy (several allowed) and active state,
  and sorting by identifier (default), destination, policy, active state, creation time and
  modification time.
- **FR-058**: Administrators MUST be able to add and edit TLS policy maps (destination, policy,
  parameters, active state preselected active) and to activate, deactivate and delete them. The policy
  choice MUST list the eight policies (none, may, encrypt, dane, dane-only, fingerprint, verify, secure),
  each with a one-line translated explanation. The screens MUST show the legacy hints on destination
  examples, parameters, and that these policies override users' own TLS settings, with a link to the
  mail server's policy documentation that states it opens an external site.

#### Forwarding hosts

- **FR-059**: The forwarding host list MUST show address, source and spam filter state in text. It MUST
  offer a search on address and source, filters on the spam filter and on the source, and sorting by
  address (default), source and spam filter. Selecting a card's source MUST filter the list to that
  source.
- **FR-060**: Administrators MUST be able to add a forwarding host from an address, a network, a host
  name or a domain name, with the legacy hints on how names are resolved and what forwarding hosts do,
  and choose whether the spam filter applies (preselected enabled).
- **FR-061**: After an addition, the app MUST list every resulting address in its stored form, each
  marked "added" or "updated" (already listed; its source and spam filter setting were replaced).
- **FR-062**: The app MUST distinguish a name that cannot be resolved (field error) from a temporary DNS
  failure (message with retry).
- **FR-063**: Administrators MUST be able to enable or disable the spam filter of an entry and delete
  entries; address and source MUST be shown read-only.

#### History

- **FR-064**: For administrators, every relayhost, transport, BCC map, recipient map, TLS policy map,
  forwarding host and Relayhost section MUST offer a "History" action that opens feature 001's audit log
  filtered to that target. Domain administrators MUST NOT be offered it.

#### Errors

- **FR-065**: Field-level validation errors from the API MUST be shown at the matching field as
  translated messages built from the stable rule code and its parameters (for example the allowed
  policies or the maximum length).
- **FR-066**: The app MUST show a specific translated message for each documented error type of this
  feature: entry already exists, next hop has different credentials, next hop interferes (naming the
  next hop), outdated version (FR-014), missing permission flag (naming the permission), host not
  resolvable, temporary failure (with retry) and not found (with a way back to the list). Error types
  that API 009 does not document for its operations, such as too many requests and attribute not
  permitted, keep the shared translations of earlier features.
- **FR-067**: Any other error MUST show a generic translated message that includes the request
  identifier when the API provides one.

#### Accessibility

- **FR-068**: Every screen and section of this feature MUST meet WCAG 2.2 AA in light and dark themes:
  full keyboard operation, visible focus, programmatically labelled controls, and targets of at least
  44×44 CSS px.
- **FR-069**: Success messages, bulk results, list result counts after searching or filtering, the
  test's progress and its summary MUST be announced to screen readers as status messages.
- **FR-070**: Active state, inactive relayhosts, password status, MX-based destinations, shared
  credentials, BCC type, spam filter state and the test outcome MUST be conveyed in text, not by colour
  alone.
- **FR-071**: Confirmations, choices and pickers MUST move focus into themselves when opened, keep it
  there while open, close on Escape, and return focus to the control that opened them.

#### Internationalisation

- **FR-072**: All user-facing text MUST follow constitution IV 1.3.0: every language mailcow ships is
  supported; text with a classic-interface equivalent MUST be mailcow's own translation, used verbatim
  by its legacy key (see Legacy Parity); the screens MUST mirror the legacy forms (fields, labels, help
  texts, options, units, order and messages); new strings, only for elements the classic interface
  lacks, MUST exist in English, Czech and Slovak and MUST NOT be machine-translated.
- **FR-073**: Numbers, counts and times MUST be formatted with the user's locale. Values that come from
  the API (hosts, destinations, addresses, parameters, server replies and transcripts) MUST be shown as
  returned, untranslated.

#### Security

- **FR-074**: Data from the API MUST be displayed as text and never interpreted as markup.
- **FR-075**: The app MUST NOT keep relayhost or transport passwords, form drafts that contain them, or
  test transcripts in browser storage.

### Legacy Parity

Legacy reference: FeldHost fork of mailcow-dockerized, upstream baseline tag `2026-09a`, paths
relative to `data/web/`. The fork does not differ from upstream in these screens apart from one
forwarding-host hint text. Status: **matched** (same capability), **improved** (same capability,
better), **dropped** (not carried over, with the reason).

| Legacy screen or element | Legacy location | Requirements | Status and reason |
|---|---|---|---|
| Sender-dependent transports table (ID, host, username, in use by, active, actions) | `templates/admin/tab-routing.twig`, `draw_relayhosts()` in `js/site/admin.js` | FR-005 to FR-010, FR-019, FR-020, FR-023 | **Improved**: cards on phones, search, filters and sorting, usage counts with a paged usage view instead of a comma-joined cell, password status |
| Add relayhost form below the table (host, username, password) with "stored as plain text" hint | `tab-routing.twig` | FR-011, FR-021, FR-028 | **Improved**: own screen, active state settable, port-465 warning, MX-lookup explanation |
| Edit relayhost page with the password in clear text | `templates/edit/relayhost.twig` | FR-022, FR-025 to FR-028 | **Improved**: the stored password is never shown (security); keep, replace and remove are explicit |
| Wrapped-TLS hint on the relayhost host field | `edit/relayhost.twig` | FR-021 | **Matched**, now also on the add form |
| Relayhost mass activate, deactivate, delete and "toggle all" | `tab-routing.twig` | FR-015 to FR-017 | **Improved**: per-entry outcomes, confirmation before deletion |
| Relayhost delete button without showing affected domains; mailbox assignments left dangling | `process_table_data()` in `admin.js` | FR-017, FR-018, FR-034 | **Improved**: confirmation names the domains and mailboxes; dangling assignments are shown and fixable |
| Test button and test dialog (from, to prefilled `null@hosted.mailcow.de`, run, coloured raw SMTP transcript) for relayhosts and transports | `templates/modals/admin.twig` (`testTransportModal`), `inc/ajax/transport_check.php`, `admin.js` | FR-043 to FR-049 | **Improved**: summary with step, server and TLS first, transcript readable on phones and without credentials, no colour-only meaning; untranslated title "Transport" replaced. Prefill **dropped**: empty fields use the server's configurable defaults |
| Transport maps table (ID, destination with MX tooltip icon, next hop, username with a colour square per next hop, active) | `tab-routing.twig`, `draw_transport_maps()` | FR-037, FR-038, FR-070 | **Improved**: MX marker and shared credentials stated in text instead of a tooltip icon and a colour square; filter by next hop |
| Add transport form (comma-separated destinations, next hop, username, password, MX-based, active) and the "credentials of matching next hops are updated" warning | `tab-routing.twig` | FR-039 to FR-041 | **Improved**: several destinations still accepted with one outcome each instead of silently skipped ones; the warning names the affected transports and appears only when it applies |
| Edit transport page with the password in clear text | `templates/edit/transport.twig` | FR-042, FR-025 to FR-028 | **Improved**: password never shown |
| Transport mass activate, deactivate and delete | `tab-routing.twig` | FR-015 to FR-017 | **Matched**, with per-entry outcomes |
| Forwarding hosts table (host, source, spam filter) and add form (host, spam filter) | `templates/admin/tab-config-fwdhosts.twig`, `draw_fwd_hosts()` | FR-059 to FR-063 | **Improved**: every resulting address reported as added or updated; filter by source |
| Forwarding hosts mass "Enable spam filter" / "Disable spam filter" (hard-coded English) | `tab-config-fwdhosts.twig` | FR-015, FR-072 | **Improved**: translated as new strings (no legacy key exists) |
| BCC maps tab (ID, type badge, local destination, BCC destination, domain, active; mass activate, deactivate, switch type, delete; add dialog with a grouped picker; refresh) | `templates/mailbox/tab-bcc.twig`, `draw_bcc_table()` in `js/site/mailbox.js`, `templates/modals/mailbox.twig` (`addBCCModalAdmin`) | FR-002, FR-015, FR-050 to FR-054 | **Improved**: own add screen instead of an extra-large dialog; the picker searches and pages instead of loading every object, and shows what aliases deliver to; type stated in text |
| BCC tab for domain administrators: list visible, write buttons gated by `bcc_maps` | `tab-bcc.twig` (`data-acl`) | FR-002 | **Matched** |
| Edit BCC map page (BCC destination, type, active) | `templates/edit/bcc.twig` | FR-053 | **Matched**, local destination shown read-only |
| Recipient maps card (administrators only) with add dialog and edit page | `tab-bcc.twig`, `draw_recipient_map_table()`, `addRecipientMapModalAdmin`, `templates/edit/recipient_map.twig` | FR-055, FR-056 | **Improved**: own screen, search and filters, domain-wide maps labelled |
| TLS policy maps tab (administrators only), add dialog with the eight policies, edit page, link to the Postfix documentation | `templates/mailbox/tab-tls-policy.twig`, `draw_tls_policy_table()`, `addTLSPolicyMapAdmin`, `templates/edit/tls_policy_map.twig` | FR-057, FR-058 | **Improved**: each policy explained, policy filter |
| Relayhost selector on Edit domain ("ID n: host (username)", inactive entries on a red background, "None / Inherit"), gated by `domain_relayhost` | `templates/edit/domain.twig` | FR-029, FR-031 to FR-036 | **Improved**: inactive stated in text, searchable, read-only view without the flag, own save. Usernames for domain administrators **dropped** (least privilege, API FR-023). A domain administrator's change is now saved (legacy discarded it) |
| Relayhost selector on Edit mailbox with the "applies to the mailbox and direct aliases" hint, gated by `mailbox_relayhost` | `templates/edit/mailbox.twig` | FR-030 to FR-035 | **Improved**: shows the domain's relayhost and the effective one, notes the credential lookup order |
| Refresh buttons on the BCC, recipient map and TLS policy map cards | `tab-bcc.twig`, `tab-tls-policy.twig` | FR-009 | **Matched**, plus automatic refresh after changes |
| Table row expand and collapse ("expand all", "collapse all"), page length selector, remembered table state | DataTables options in `admin.js` and `mailbox.js` | FR-004, FR-005, FR-007 | **Dropped**: cards show every field on phones; the list's address keeps search, filters, sort and page |
| Internal IDs as the first table column | all tables above | FR-019, FR-037 | **Dropped** as a leading column for BCC, recipient and TLS policy maps (they are identified by their destinations); **kept** as secondary information for relayhosts and transports, where several entries can share a host |
| Collapsed cards used as tabs on phones | all tabs above | FR-001, FR-005 | **Dropped**: each list is its own screen |
| Change log entries in the legacy `logs` table | `json_api.php` logging | FR-064 | **Improved**: History opens the audit log filtered to the entry, without passwords |
| BCC maps whose domain no longer exists (hidden from everyone) | `draw_bcc_table()`, `bcc()` in `inc/functions.address_rewriting.inc.php` | FR-050, FR-051 | **Improved** (plan parity note 1): administrators see them labelled "Domain no longer exists", can filter by it, edit and delete them |
| Test dialog addresses ("To:" prefilled `null@hosted.mailcow.de`, "From:" empty) | `templates/modals/admin.twig` (`testTransportModal`) | FR-044 | **Matched** (plan parity note 2 as revised by plan part 3 decision 2): the recipient is prefilled with the server's default recipient and the sender shows the default sender as placeholder, both read from the routing capabilities |
| Legacy hints with markup (bold, code, lists, links) | `admin.relayhosts_hint`, `admin.transports_hint`, `mailbox.tls_policy_maps_info` and the other hints listed below | FR-008, FR-073 | **Matched** (plan parity note 3): shown verbatim through `SanitizedHtml.vue` |

**Revisions by the legacy form map** (plan part 3, 2026-10-19, constitution IV 1.4.0): where a row
above says **Improved** because of an added explanation, that explanation is not built: the port-465
and `*` warnings, the MX-lookup explanation, the policy explanations, the effective relayhost and the
credential lookup note, the shared next hop notice, the BCC type explanations and "Whole domain"
(decision 5). MX-based destinations are marked with `admin.is_mx_based` in text, the colour square is
left out, the ID column stays on every list that has it and domain administrators see usernames in
the relayhost choice (decision 6); transport destinations are split as legacy splits them (decision
10); the relayhost choice is a field of the Domain and Mailbox sections, saved with the section and
hidden without the flag (decision 12); forwarding hosts have no entry page, as in legacy (decision
9). Every other row stands as written.

**Legacy translation keys used verbatim** (constitution IV 1.3.0; the plan's legacy form map is the
complete list, including the keys the templates use that this list lacks, such as `admin.add`,
`admin.action`, `mailbox.quick_actions` and the edit pages' own keys): `admin.relayhosts`,
`admin.relayhosts_hint`,
`admin.add_relayhost`, `admin.add_relayhost_hint`, `add.relayhost_wrapped_tls_info`, `admin.host`,
`admin.username`, `admin.password`, `admin.active`, `admin.inactive`, `admin.in_use_by`,
`admin.transport_maps`, `admin.transports_hint`, `admin.add_transport`, `admin.add_transports_hint`,
`admin.destination`, `admin.nexthop`, `admin.transport_dest_format`, `admin.lookup_mx`,
`admin.is_mx_based`, `admin.credentials_transport_warning`, `admin.relay_from`, `admin.relay_rcpt`,
`admin.relay_run`, `admin.transport_test_rcpt_info`, `admin.forwarding_hosts`,
`admin.forwarding_hosts_hint`, `admin.add_forwarding_host`, `admin.forwarding_hosts_add_hint`,
`user.spamfilter`, `mailbox.bcc_maps`, `mailbox.bcc_map`, `mailbox.bcc_info`,
`mailbox.add_bcc_entry`, `mailbox.bcc_local_dest`, `mailbox.bcc_map_type`,
`mailbox.bcc_sender_map`, `mailbox.bcc_rcpt_map`, `mailbox.bcc_destination`,
`mailbox.bcc_to_sender`, `mailbox.bcc_to_rcpt`, `add.bcc_dest_format`, `mailbox.recipient_maps`,
`mailbox.recipient_map`, `mailbox.recipient_map_info`, `mailbox.add_recipient_map_entry`,
`mailbox.recipient_map_old`, `mailbox.recipient_map_old_info`, `mailbox.recipient_map_new`,
`mailbox.recipient_map_new_info`, `mailbox.tls_policy_maps`, `mailbox.tls_policy_maps_long`,
`mailbox.tls_policy_maps_info`, `mailbox.tls_policy_maps_enforced_tls`,
`mailbox.add_tls_policy_map`, `mailbox.tls_map_dest`, `mailbox.tls_map_dest_info`,
`mailbox.tls_map_policy`, `mailbox.tls_map_parameters`, `mailbox.tls_map_parameters_info`,
`edit.relayhost`, `edit.none_inherit`, `edit.mailbox_relayhost_info`, `acl.bcc_maps`,
`acl.domain_relayhost`, `acl.mailbox_relayhost`, `mailbox.activate`, `mailbox.deactivate`,
`mailbox.toggle_all`, `admin.refresh`, `admin.remove`, `edit.save`, and these `success.*` and
`danger.*` messages where the API's rule code or error type has the same meaning: `relayhost_added`,
`relayhost_removed`, `forwarding_host_added`, `forwarding_host_removed`, `bcc_saved`, `bcc_edited`,
`bcc_deleted`, `bcc_exists`, `bcc_must_be_email`, `bcc_empty`, `recipient_map_entry_saved`,
`recipient_map_entry_deleted`, `recipient_map_entry_exists`, `invalid_recipient_map_old`,
`invalid_recipient_map_new`, `tls_policy_map_entry_saved`, `tls_policy_map_entry_deleted`,
`tls_policy_map_entry_exists`, `tls_policy_map_dest_invalid`, `tls_policy_map_parameter_invalid`,
`transport_dest_exists`, `invalid_destination`, `invalid_nexthop`, `invalid_nexthop_authenticated`.
They are loaded at runtime from the installation, in every mailcow language, and values with HTML are
rendered through the app's sanitiser, unaltered. New strings (English, Czech and Slovak) are needed
only for the password status and removal, the port-465 and `*` warnings, the test summary and its steps, the policy
explanations, shared credentials, the effective relayhost, dangling assignments, the credential lookup
note, usage counts, bulk outcomes and History.

### API Dependency

This feature depends on mailcow REST API v2 feature 009 (`specs/009-routing-address-rewriting/spec.md`
in mailcow-rest-v2) and uses only operations of its released contract; it pins a contract commit that
contains feature 009 (the plan records the commit) and can be built against a mock generated from that
contract before the API is implemented. It also uses feature 001 (identity with role, scope and permission flags;
error conventions with stable codes; the audit log), feature 002 (domain screens) and feature 003
(mailbox screens).

| UI capability | API feature 009 capability |
|---|---|
| Access by role and flag (FR-001 to FR-003) | Permission matrix and flag-naming refusals (API FR-005, FR-006) |
| Lists with paging, search, filters, sorting (FR-007, FR-020, FR-038, FR-051, FR-055, FR-057, FR-059) | Common list rules and per-list search, filters and sorting (API FR-007, FR-016, FR-032, FR-047, FR-059, FR-065, FR-074) |
| Versions and outdated changes (FR-014) | Version tags on every entry and assignment (API FR-008); partial changes (API FR-009) |
| Selection and bulk actions (FR-015, FR-016) | Bulk actions of up to 100 entries, refused as a whole when not permitted, one result per entry, optional per-entry version tags with an "outdated" outcome (API FR-090, FR-091) |
| Limits and server settings (FR-016, FR-044, FR-045, FR-058) | Routing capabilities: bulk limit, page sizes, field limits, default test addresses and timeouts, allowed TLS policies (API FR-093) |
| Relayhosts and usage view (FR-019 to FR-024) | Relayhost list, inspect, create, edit, delete, usage list (API FR-015 to FR-022) |
| Password redaction, keep, replace, remove (FR-025 to FR-028) | Write-only passwords, password status, omit keeps and empty removes (API FR-012 to FR-014) |
| Relayhost sections and choice (FR-029 to FR-036) | Relayhost choices, read and replace domain and mailbox assignments, effective relayhost, dangling assignments (API FR-023 to FR-030) |
| Transports and shared credentials (FR-037 to FR-042) | Transport operations, next hop filter, sharing count, conflicts, affected transports in responses (API FR-031 to FR-040) |
| Connection test (FR-043 to FR-049) | Test operation with optional addresses and structured, redacted result within 60 seconds (API FR-041 to FR-045) |
| BCC maps and destination choices (FR-050 to FR-054) | BCC map operations and paged destination choices with kind, domain and delivery targets (API FR-046 to FR-058) |
| Recipient maps (FR-055, FR-056) | API FR-059 to FR-064 |
| TLS policy maps (FR-057, FR-058) | API FR-065 to FR-073 |
| Forwarding hosts (FR-059 to FR-063) | Add with per-address "added" or "updated", spam filter switch, delete, distinct temporary DNS failure (API FR-074 to FR-082) |
| History (FR-064) | Audit records with target types and identifiers, and the target filter (API FR-085, FR-086) |
| Errors (FR-065 to FR-067) | Documented error types and validation rule codes with parameters (API FR-087; feature 001 FR-049, FR-055) |

**Former API gaps, closed by API 009** (consistency change 5):

- The configured default test sender and recipient are readable through the routing capabilities,
  and the test form shows them as placeholders (FR-044).
- Every BCC map reports whether its domain still exists, so administrators see orphaned maps labelled
  and can filter on them (FR-050, FR-051).

The plan lists the remaining minor gaps, none of which blocks this feature.

### Key Entities *(include if feature involves data)*

- **Relayhost**: identifier, host with optional port, optional username, password status, active
  state, and its usage (numbers and lists of domains and mailboxes).
- **Relayhost choice**: identifier, host and active state, for the Relayhost sections.
- **Relayhost assignment**: on a domain or a mailbox, a relayhost or none, possibly dangling; for a
  mailbox also the domain's assignment and the effective relayhost.
- **Transport**: identifier, destination, MX-based flag, next hop, optional username, password status,
  active state, number of other transports sharing its next hop.
- **Connection test**: optional sender and recipient; result with accepted or not, step, host and port
  (and whether from an MX lookup), TLS and login state, last reply and redacted transcript. Not stored.
- **BCC map**: type, local destination, BCC destination, domain, active state, creation and
  modification times.
- **BCC destination choice**: value, kind (domain, alias domain, mailbox, alias, alias-domain address),
  domain, and the mailboxes it delivers to.
- **Recipient map**: original recipient, new recipient, active state, creation and modification times.
- **TLS policy map**: destination, policy, parameters, active state, creation and modification times.
- **Forwarding host**: address or network, source, spam filter state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can add a relayhost, assign it to a domain and run a successful test on
  a 360 px phone in under 3 minutes, without horizontal scrolling.
- **SC-002**: 100% of this feature's screens and sections pass the automated WCAG 2.2 AA checks on a
  360 px and a desktop viewport, in light and dark themes.
- **SC-003**: In end-to-end tests that seed relayhosts and transports with passwords and type new ones,
  0 passwords appear on any screen, in the page after saving, or in browser storage.
- **SC-004**: For every mocked test outcome (accepted, each of the eight failed steps), the outcome and
  the step are visible on a 360 px screen without opening the transcript or scrolling.
- **SC-005**: 100% of the legacy elements listed in Legacy Parity are matched, improved or dropped with
  a stated reason, and every matched or improved element is covered by a requirement.
- **SC-006**: 0 new strings of this feature missing in English, Czech or Slovak, and 0 legacy keys used
  by this feature missing from the bundled `en-gb` snapshot.
- **SC-007**: 100% of the validation rule codes and error types that the API documents for this feature
  map to a translated message shown at the right field or as the right message.
- **SC-008**: With the performance tests' standard mobile profile (mid-range phone, throttled 4G
  connection) and an API that answers within its own targets, a list shows its first page within 2
  seconds of opening, and the BCC destination picker shows matches within 1 second of the user pausing
  typing, for a scope of 10,000 mailboxes and aliases.
- **SC-009**: A bulk action on 100 entries reports an outcome for each of the 100 entries.
- **SC-010**: In end-to-end tests as a domain administrator without any routing flag, 0 controls that
  change a BCC map or a relayhost assignment are offered.

## Assumptions

- Feature 001 provides the app shell, sign-in, navigation by role and flags, theme and language
  switching, global error handling (expired sessions, restricted sessions, unknown errors) and status
  announcements, and its audit log screen accepts the target filters that API features 002 and 009 add
  (FR-064). This feature does not re-specify them.
- Features 002 and 003 provide the domain and mailbox screens and the place for the Relayhost section;
  their own forms keep the assignment out of their save, as the API requires.
- Domain administrator flags are managed in feature 007; this feature only reads them.
- The test's default sender and recipient addresses are server settings; the app reads them from the
  routing capabilities only to show them as placeholders.
- Server output in test transcripts is technical English text and is not translated.
- Legacy hint texts that contain markup (bold, line breaks, code, links) are used verbatim and rendered
  through the app's sanitiser with a small allowlist (constitution IV 1.3.0); API data is never
  interpreted as markup.
- A bulk action covers at most the server's bulk limit (100 by default); larger selections are not
  split into several actions.
- Testing a next hop or credentials that are not saved is out of scope, as in the API and in legacy.
- **Out of scope**: the global relayhost and custom transport files of the mail server, mailbox TLS
  settings (005), the quota warning BCC (013), the mail queue (011), sender permissions (004), editing
  domain administrator flags (007).
