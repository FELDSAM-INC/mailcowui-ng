# Feature Specification: Domains

**Feature Branch**: `main` (no feature branches, constitution 1.1.0)

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Domain screens for mailcowui-ng, the mobile-first web app for
mailcow-dockerized, built only on mailcow REST API v2 feature 002 (Domains). Administrators list,
search, filter, sort and page through the mail domains with their usage figures, inspect a domain,
create domains from domain templates and see the report of the follow-up steps, edit limits,
quotas, relay options, Global Address List flag, description, tags and active state, activate,
deactivate and delete one or several domains after a confirmation that shows the impact, and manage
domain templates. Administrators and domain administrators manage a domain's footer. Domain
administrators see only the domains they manage and change only the Global Address List flag, the
tags and, with the `domain_desc` permission flag, the description. Mailbox users have no access.
Edits based on outdated data are caught with the API's version tags. The feature replaces the
legacy Mail setup › Domains and Domain templates tabs, the add-domain and add-template modals, the
Edit domain page (domain and footer tabs) and the Edit template page. Every screen works at 360 px
width, meets WCAG 2.2 AA and is translated into English, Czech and Slovak."

## Clarifications

### Session 2026-10-18

- Q: Should a domain be edited in one long form, as in legacy, or section by section on the domain
  page? → A: Section by section. The domain page shows read-only sections (General, Tags, Limits and
  quotas, Relay options, Groupware). Each section that contains a value the user may change has its
  own Edit action, and saving sends only that section's changes with the domain's version tag. On
  small screens the section form opens full-screen; on wide screens it opens in place. (agent
  decision: constitution II asks for long forms to be split into sections; domain administrators may
  change only two or three values, and per-section editing shows them exactly those; the API accepts
  partial changes (API 002 FR-030), and version tags keep separate saves safe.)
- Q: What does the user see when the API refuses a save as outdated? → A: The app keeps the user's
  unsaved values, loads the latest saved data, marks every value that changed in the meantime
  together with its new saved value, and asks the user to save again or to discard their changes. It
  never merges or re-sends on its own. The same applies to templates and footers. For a deletion, the
  impact is shown again with fresh data and must be confirmed again. (agent decision: API 002 FR-042
  refuses outdated changes; keeping the input avoids retyping on a phone, and an explicit second save
  avoids silently overwriting someone else's change.)
- Q: How is the long create-domain form presented on a phone? → A: As its own page in five steps
  (domain and template, limits and quotas, options, rate limit and DKIM, review) with a progress
  indicator such as "Step 2 of 5". Once the name is valid, the user can go straight to the review and
  create the domain with the template's values. Wide screens show all sections on one page with a
  section index. (agent decision: constitution II forbids giant modals; API 002 SC-008 expects a
  template-based creation in under 1 minute, and most domains use the template values unchanged.)
- Q: Should creating a domain restart the groupware by default? → A: No. The review offers "Restart
  groupware after creating" as a switch that is off by default, with the legacy explanation that the
  groupware learns about a new domain only after a restart, and a note that the restart briefly
  interrupts webmail for every user of the server. (agent decision: legacy offers both buttons with
  equal weight; a restart affects all users, so it should be an explicit choice; the creation report
  shows the outcome either way.)
- Q: How strong must the confirmation be before a domain is deleted? → A: For one domain, the dialog
  shows the impact and the Delete button stays disabled until the user types the domain name, in its
  readable or ASCII form, letter case ignored. For several domains, the dialog lists every selected
  domain with its impact and requires an explicit acknowledgement instead of typing. A domain with
  mailboxes is never deletable: the action is unavailable with the reason, and in a bulk deletion it
  is listed as skipped. (agent decision: constitution II requires explicit confirmation that shows
  what is affected; the deletion is irreversible and cascades to aliases, alias domains and domain
  administrator accounts (API 002 FR-036 to FR-038); typing one name is a common safeguard, typing
  several names is impractical on a phone.)
- Q: How do bulk activate, deactivate and delete behave, given that the API has no batch operation?
  → A: Administrators select domains on the current page, on phones through a selection mode. The app
  sends one request per domain, continues after failures, shows progress, and ends with a result per
  domain and a "retry failed" action. Deactivation and deletion ask for confirmation, activation does
  not. The selection is cleared when the page, search, filters, sort or page size change. Bulk
  requests carry no version tag, because list entries do not include one. (agent decision: API 002
  clarification on batch operations and FR-062; legacy offers the same three quick actions;
  deactivation affects every mailbox of a domain, for example its users can no longer sign in (API
  001); clearing the selection prevents acting on domains the user no longer sees. The missing
  version tag in list entries is reported as an API gap.)
- Q: In which unit does the user enter quotas? → A: A number plus a unit of MiB, GiB or TiB. The
  value must come to a whole number of MiB and at least 1 MiB. A stored value is shown in the largest
  unit that represents it exactly, so 10,240 MiB appears as 10 GiB and 3,000 MiB stays 3,000 MiB.
  (agent decision: the API takes bytes in whole MiB (API 002 FR-009); legacy forces MiB, so users type
  values such as 10240 on a phone keypad; an exact representation avoids rounding errors.)
- Q: Should the footer's HTML be previewed, and how are exclusions chosen? → A: The HTML is edited
  and shown only as source text and is never rendered. Exclusions are typed as entries (addresses or
  alias domain names) and checked by the API, which names every invalid entry. A picker of the
  domain's mailboxes, aliases and alias domains is not part of this feature; it can be added with the
  mailbox and alias screens (UI features 003 and 004). (agent decision: constitution V forbids
  rendering API-supplied HTML unless it is sanitised, and legacy has no preview; API 002 offers no
  list of exclusion candidates, and the UI must not work around a missing API capability.)
- Q: Where are the list's search, filters, sort and page kept, and which page sizes are offered? → A:
  In the page address, so that reloading, going back and sharing a link restore the same view.
  Nothing is kept in browser storage. Page sizes are 25 (default), 50 and 100. (agent decision:
  legacy keeps its table state in browser storage, which neither survives a shared link nor another
  device; the API default is 25, and capping the choice at 100 keeps pages light on phones.)
- Q: What does the domain page show for settings that later features own? → A: The relayhost and the
  rate limit, which API 002 returns, are shown read-only. The spam filter, quota warning BCC,
  MTA-STS, DKIM and DNS diagnostics are not shown at all, not even as placeholders, until their UI
  features add them. (agent decision: API 002 makes the relayhost and the rate limit read-only;
  empty placeholders add noise on small screens; the roadmap allocates those settings to UI features
  006, 009, 010 and 013.)
- Q: Where do administrators see the history of a domain or template? → A: The domain page and the
  template page offer a History action that opens the audit log screen of UI feature 001, filtered
  to that domain (with its tags and footer) or that template. This feature adds the target filters to
  that screen and the presentation of domain, template and footer events. (agent decision: one audit
  log screen avoids duplication (constitution VIII); API 002 FR-058 adds the target filters; API 002
  User Story 7.)

### Alignment 2026-10-18 (planning)

After the session above, API 002 resolved the gaps this spec reported and `docs/conventions.md`
was collected. Its rule is: "the next change to that spec aligns it". The plan aligned this spec as
follows ([plan.md](./plan.md#spec-alignment)). The answers above stay as recorded.

- **Bulk actions**: the answer on bulk behaviour assumed that "the API has no batch operation" and
  that list entries carry no version tag. API 002 now offers a bulk operation for activation,
  deactivation and deletion, with a version tag on every list entry and on every bulk item (API
  002 FR-015, FR-062, FR-063). The conventions require that operation. FR-046 to FR-048 therefore
  send the selection in one bulk request with each domain's version tag. Failed, refused and
  outdated domains stay selected, so they can be retried, and a lost connection is reported as
  "outcome unknown". Selection, progress, per-domain results and the confirmation rules for
  activation and deactivation are unchanged.
- **Bulk deletion confirmation**: the answer on deletion strength required an acknowledgement
  instead of typing for several domains. The conventions require the number of objects to be typed
  for every bulk deletion, as UI feature 003 does, so FR-047 and User Story 5, scenario 3 require
  the number of domains to be typed. Typing the name of a single domain is unchanged.
- **Resolved gaps**:
  - the domain capabilities report the groupware state, the tagging limit, the default DKIM
    selector, the bulk limit and the footer limit;
  - the usage figures include resources and the largest existing mailbox quota;
  - a deletion preview names what a deletion removes and the domain administrator accounts it
    deletes;
  - a distinct tag list feeds suggestions.

  FR-010, FR-021, FR-024, FR-031, FR-032, FR-039 to FR-043, FR-055 and the affected edge cases now
  use them.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find and inspect domains (Priority: P1)

An administrator opens Domains on a phone. Each domain appears as a card with its name, its active
and relay state, how many mailboxes and aliases it uses against its limits, how much quota is
allocated against the domain quota, the storage in use and its tags. On a wide screen the same list
is a table with more columns. The administrator searches by name, description or tag, filters by
active state, relay state and tag, sorts by any figure, and pages through the results. Opening a
domain shows every setting and figure of that domain on one page, grouped in sections.

A domain administrator sees the same screens, limited to the domains they manage and without the
list of domain administrators.

**Why this priority**: Every other domain task starts here, and it is the safest first slice
because it changes nothing. It already replaces the legacy domain list for daily look-ups.

**Independent Test**: Against a mock API with 60 domains in every relay and active state, with
tags, internationalised names and usage figures, open the list as an administrator and as a domain
administrator at 360 px and at desktop width. Use each search, filter, sort and paging option,
open several domains, and compare every value shown with the mock data.

**Acceptance Scenarios**:

1. **Given** 60 domains, **When** an administrator opens Domains, **Then** the first 25 domains
   sorted by name are shown, together with the total of 60 and a way to reach the other pages.
2. **Given** a 360 px wide screen, **When** the list is shown, **Then** each domain is a card, no
   content needs horizontal scrolling, and each card shows the readable name, the active and relay
   state, mailboxes and aliases in use against their limits, quota allocated against the domain
   quota, storage used and the tags.
3. **Given** domains tagged "customer-a" and "customer-b", **When** the administrator types
   "customer" into the search, **Then** both are listed. **When** they instead select the tag
   "customer-a" on a domain card, **Then** the list is filtered to domains with that tag and the
   filter is shown as active.
4. **Given** an internationalised domain stored as `xn--mnchen-3ya.de`, **When** it is listed,
   **Then** it is shown as `münchen.de` with `xn--mnchen-3ya.de` below it, and searching for either
   form finds it.
5. **Given** a list sorted by storage used, descending, on page 2, **When** the administrator opens
   a domain and goes back, **Then** the same page, sort, filters and search are shown. **When** they
   reload the page or open the same address on another device, **Then** the same view is shown.
6. **Given** a domain administrator who manages two of ten domains, **When** they open Domains,
   **Then** exactly those two are listed, the total is 2, no domain administrator list, create,
   delete or bulk action is offered, and opening the address of a third domain shows the same "not
   found" page as for a domain that does not exist.
7. **Given** a search that matches nothing, **When** the list is shown, **Then** a "no matching
   domains" message with an action to clear the search and filters is shown instead of an empty
   table.
8. **Given** a domain with 8 of 10 mailboxes, 380 of 400 aliases and 9.5 of 10 GiB allocated,
   **When** it is shown, **Then** each pair is shown as text and as a bar, and the aliases and quota
   pairs are marked as nearly full by text or icon as well as colour.

---

### User Story 2 - Create a domain from a template (Priority: P1)

An administrator adds a customer domain on a phone. They type the name, keep the Default template
or pick another one, which fills in limits, quotas, relay options, Global Address List flag, active
state, tags, rate limit and DKIM settings, and change any value they want. On a phone the form is a
sequence of short steps, and the administrator can jump from the name straight to the review. The
review shows exactly what will be created. After creation, the app opens the new domain and reports which follow-up
steps (rate limit, DKIM key, DKIM DNS publication, groupware update and restart) succeeded.

**Why this priority**: Adding domains is the most common write, and the new app must handle it
before it can replace the legacy screens.

**Independent Test**: Against a mock API with several templates, create domains with only a name,
with a different template, with overrides in each section, with and without a groupware restart
and with DKIM switched off. Check the values sent, the review summary and the display of every
outcome of every follow-up step, at 360 px and at desktop width.

**Acceptance Scenarios**:

1. **Given** the Default template, **When** an administrator types `example.org` and goes straight
   to the review, **Then** the review shows the Default template's values. **When** they create the
   domain, **Then** the app opens `example.org` and shows a creation report in which every step
   succeeded or was not requested.
2. **Given** a template "Reseller" with 50 mailboxes and a 50 GiB domain quota, **When** the
   administrator selects it and lowers the mailbox limit to 20, **Then** the review shows 20
   mailboxes, 50 GiB and every other value from "Reseller", and the domain is created with exactly
   those values.
3. **Given** a name that already exists as a domain or alias domain, **When** the administrator
   creates it, **Then** the name field shows a translated "domain already exists" error, the step
   with the name is shown, and every entered value is kept.
4. **Given** a default mailbox quota larger than the maximum mailbox quota, **When** the
   administrator tries to continue, **Then** the app shows the error next to the default quota
   field before anything is sent.
5. **Given** a creation in which the groupware restart failed and the DKIM key already existed,
   **When** the report is shown, **Then** the restart is marked as failed with what that means for
   the domain, the DKIM key is marked as "already existed", and the report is announced to screen
   reader users.
6. **Given** a creation form with entered values, **When** the administrator tries to leave it,
   **Then** the app asks for confirmation before discarding the values.
7. **Given** a domain administrator, **When** they look at the domain list, **Then** no create
   action is offered, and opening the create address directly shows that the page is not available
   for their role.

---

### User Story 3 - Edit a domain (Priority: P1)

An administrator changes a customer's package: the mailbox and alias limits, the quotas, the relay
options, the Global Address List flag, the description, the tags or the active state, one section
of the domain page at a time. The app shows the current usage next to each limit and refuses limits
below it before sending. If someone changed
the domain in the meantime, in this app, the legacy UI or through the API, the save is stopped and
the administrator sees what changed without losing their input.

A domain administrator changes the Global Address List flag and the tags of a domain they manage,
and the description when their permission flag allows it. Every other setting is shown to them
read-only.

**Why this priority**: Upgrading, downgrading and suspending customer domains are routine tasks
that the new app must cover.

**Independent Test**: Against a mock API, edit each setting as an administrator, as a domain
administrator with the description permission and as one without it. Try limits below usage,
outdated saves, an exceeded tag limit and an API refusal of an attribute, and check the values sent
and every message shown.

**Acceptance Scenarios**:

1. **Given** a domain with 8 mailboxes, **When** an administrator enters a mailbox limit of 5,
   **Then** the field shows that 8 mailboxes are in use and saving is not possible until the value
   is at least 8.
2. **Given** a domain whose mailboxes have 30 GiB allocated, **When** the administrator enters a
   domain quota of 20 GiB and the API refuses it, **Then** the domain quota field shows a translated
   message that 30 GiB are in use.
3. **Given** two administrators who opened the same domain, **When** the first saves a change and
   the second then saves theirs, **Then** the second save is stopped, the second administrator's
   input is still in the form, and the fields the first administrator changed are marked with their
   new saved values.
4. **Given** a domain administrator without the description permission, **When** they open a
   domain, **Then** they can change the Global Address List flag and the tags, and the description,
   active state, limits, quotas and relay options are shown read-only.
5. **Given** a domain with the tags "a" and "b", **When** the user removes "a", adds "c" and saves,
   **Then** the domain has exactly the tags "b" and "c".
6. **Given** an administrator who switches on "relay non-existing mailboxes only", **When** the
   option changes, **Then** "relay all recipients" and "relay this domain" are switched on too, and
   the form explains why.
7. **Given** a change of the Global Address List flag, **When** it is saved, **Then** the app says
   that the groupware applies it after its next restart.
8. **Given** a domain administrator whose description permission was removed while the edit was
   open, **When** they save a new description and the API refuses it as not permitted, **Then** the
   app shows the translated reason naming the description, makes the description read-only, and
   keeps their other input.

---

### User Story 4 - Delete a domain (Priority: P2)

An administrator removes a cancelled customer's domain. Before anything happens, the app shows what
the deletion will remove: the domain's aliases and alias domains, its footer and tags, its stored
data and the domain administrator accounts that are left without a domain. The administrator
confirms by typing the domain name. A domain that still has mailboxes or resources cannot be
deleted, and the app says so before the administrator tries.

**Why this priority**: Deletion completes the customer life cycle but is less frequent than
creating and editing.

**Independent Test**: Against a mock API, delete domains with and without aliases, alias domains
and domain administrators, try a domain with mailboxes, and simulate the API refusing because
resources remain, because the version is outdated and because the domain no longer exists.

**Acceptance Scenarios**:

1. **Given** a domain with 2 aliases, 1 alias domain and no mailboxes, **When** an administrator
   chooses Delete, **Then** a confirmation shows the 2 aliases and 1 alias domain that will be
   removed, the assigned domain administrators and the rule for their accounts, and the Delete
   button stays disabled until the domain name is typed.
2. **Given** a domain with 3 mailboxes, **When** an administrator looks for Delete, **Then** the
   action is unavailable and the app explains that the 3 mailboxes must be removed first.
3. **Given** a domain that gained a mailbox or a resource after it was loaded, **When** the deletion
   preview or the API refuses the deletion because the domain is not empty, **Then** the app shows
   how many mailboxes and resources remain and nothing is deleted.
4. **Given** a confirmed deletion, **When** it succeeds, **Then** the app returns to the list,
   announces that the domain was deleted, and the domain is no longer listed.

---

### User Story 5 - Act on several domains at once (Priority: P2)

An administrator selects several domains in the list and activates, deactivates or deletes them in
one go, for example to suspend all domains of a reseller found by tag. The app processes each
domain, shows progress, and reports every domain's result, so that failures can be retried.

**Why this priority**: The legacy list offers these quick actions, and billing incidents need them,
but each domain can also be handled on its own.

**Independent Test**: Against a mock API, select 10 domains on a phone and on a desktop, deactivate
them with 2 failures simulated, retry the failures, and bulk-delete a selection that includes a
domain with mailboxes.

**Acceptance Scenarios**:

1. **Given** 10 selected domains, **When** the administrator deactivates them and confirms, **Then**
   progress is shown, and at the end a result list shows each domain as done or failed with a
   translated reason.
2. **Given** a result with 2 failed domains, **When** the administrator chooses to retry the failed
   ones, **Then** only those 2 are sent again.
3. **Given** a bulk deletion of 4 domains, one of which has mailboxes, **When** the confirmation is
   shown, **Then** it lists the 3 deletable domains with their impact and the fourth as skipped, and
   it requires the number of domains to be deleted, 3, to be typed.
4. **Given** a phone, **When** the administrator turns on selection mode, **Then** each card gets a
   checkbox of at least 44 × 44 px and the available actions appear in a bar that names the number
   of selected domains.

---

### User Story 6 - Manage domain templates (Priority: P2)

An administrator keeps one domain template per hosting package. They list, search and sort the
templates, create new ones, edit their values and delete the ones no longer sold. The Default
template can be edited but not renamed or deleted.

**Why this priority**: Templates make creation fast and consistent, but domains can be created with
the Default template alone.

**Independent Test**: Against a mock API, create, edit and delete templates at 360 px and at
desktop width, including a duplicate name and attempts to rename or delete Default.

**Acceptance Scenarios**:

1. **Given** the template list, **When** an administrator creates "Small" with 5 mailboxes and
   leaves the other values as offered, **Then** the template is listed with 5 mailboxes and the
   offered values.
2. **Given** a template "Small", **When** an administrator names another template "small", **Then**
   the name field shows a translated "template name already exists" error.
3. **Given** the Default template, **When** an administrator opens it, **Then** its name is
   read-only, no delete action is offered, and its values can be changed and saved.
4. **Given** a template to delete, **When** the administrator confirms, **Then** the confirmation
   states that domains created from it keep their values.
5. **Given** a domain administrator, **When** they use the app, **Then** domain templates are not
   offered anywhere.

---

### User Story 7 - Manage the domain-wide footer (Priority: P3)

An administrator or a domain administrator sets the footer that mailcow adds to outgoing mail of a
domain: an HTML and a plain-text version, whether replies are skipped, and the addresses and alias
domains that get no footer. A reference lists the placeholders, such as the sender's name, that the
footer can use.

**Why this priority**: Only some customers use footers.

**Independent Test**: Against a mock API, read, change and clear footers as an administrator and as
a domain administrator, with valid and invalid exclusions, an oversized text, HTML that contains
scripts, and an outdated version.

**Acceptance Scenarios**:

1. **Given** a domain without a footer, **When** the footer editor opens, **Then** both texts are
   empty, replies are not skipped and there are no exclusions.
2. **Given** a domain administrator, **When** they enter an HTML and a plain-text footer, exclude one
   address and save, **Then** the footer is saved and the success is announced.
3. **Given** an exclusion that does not belong to the domain, **When** the user saves and the API
   refuses it, **Then** that entry is marked with a translated error and the rest of the input is
   kept.
4. **Given** an HTML footer that contains a script element, **When** it is shown anywhere in the app,
   **Then** it is shown as text and never interpreted.

---

### User Story 8 - Trace domain changes (Priority: P3)

An administrator investigating a customer complaint opens the history of a domain and sees every
change to it, its tags and its footer: who made it, when, from where, what changed and, for the
creation, the outcome of each follow-up step. Template changes can be traced the same way.

**Why this priority**: Useful for support, but domains can be managed without it.

**Independent Test**: Against a mock API with audit records for creations, edits, refused edits,
footer changes and deletions, open the history of a domain and of a template as an administrator,
and check that a domain administrator is never offered it.

**Acceptance Scenarios**:

1. **Given** a domain whose quota an administrator raised, **When** another administrator opens the
   domain's history, **Then** the entry shows the actor, the time, the client address and the old
   and new quota in the user's units and language.
2. **Given** a refused edit, **When** the history is shown, **Then** the refusal is listed with its
   translated reason.
3. **Given** a domain administrator, **When** they open a domain, **Then** no history action is
   offered.

---

### Edge Cases

- **Internationalised and long names**: the readable name is shown first and the ASCII name below
  it when they differ. Names of up to 253 characters wrap instead of causing horizontal scrolling.
- **Many tags**: a card or row shows the first tags and a "+n" indicator. The domain page shows all
  of them.
- **More tags than the server's limit** (possible after legacy edits): the domain can still be
  viewed and edited, and its tag set can shrink. A save that would keep it at or above its current
  size while above the limit is refused before sending, with the limit the API reports. A refusal
  by the API shows the limit from the error.
- **Usage already above a limit** (possible after changes by other tools): the pair is shown as over
  the limit, for example "12 of 10". Other settings can still be saved. The affected limit can only
  be saved with a value at least equal to the usage.
- **Explicit zero limits**: a mailbox or alias limit of 0 is valid and shown as 0, not as
  "unlimited".
- **Relay options that contradict each other**: the form keeps them consistent as the API does, so
  "relay all recipients" cannot stay on while "relay this domain" is off.
- **Domain removed, or taken out of a domain administrator's scope, while it is open**: the next
  request returns "not found". The app says the domain is no longer available and offers the way
  back to the list.
- **Permission flags changed while a form is open**: an API refusal triggers a refresh of the
  identity, and the form adapts (User Story 3, scenario 8).
- **Template deleted while a domain is being created from it**: the API refuses the unknown
  template. The template field shows the error, and the user picks another template without losing
  their other values.
- **No templates at all** (the Default template is missing from the database): the create form
  starts with the built-in values the API documents and names no template.
- **Groupware disabled on the server**: the API reports it in the domain capabilities. The creation
  form then hides the Global Address List flag and the restart option, as legacy does. The creation
  report shows "groupware disabled" for the groupware steps.
- **Explicitly no DKIM key**: when the user switches DKIM key generation off, the report shows the
  DKIM key as "not requested".
- **Footer exclusion that no longer belongs to the domain**, for example a deleted mailbox: it is
  shown as stored. When the API refuses a save because of it, the entry is marked and must be
  removed before the footer can be saved.
- **Footer text over 1 MiB**, for example after a paste: saving is blocked with a message stating the
  size limit.
- **Usage figures that change while a domain is open** (new mail): they never cause an outdated-save
  refusal, because the version tag does not cover them.
- **Saves from the legacy UI**: the legacy UI never sends a version tag, so its saves can overwrite
  changes made in this app. The app cannot detect this.
- **Connection lost during a bulk action**: the outcome of every domain of the request is reported
  as unknown. Nothing is retried automatically. The user can refresh the list to see the current
  state.
- **Leaving the page during a bulk action**: the app warns that the result will not be shown. For
  the deletion of several templates, which sends one request per template, it warns that the
  remaining templates will not be processed.
- **Bulk selection that includes domains with mailboxes or resources**: those are listed as skipped
  in the delete confirmation and never sent.
- **Bulk selection reaching the bulk limit** that the API reports: further selection is disabled,
  and a message states the limit.
- **Temporary failure** reported by the API: the app says nothing was changed and offers a retry
  that keeps the input.
- **Session expiry or sign-out in another tab while a form is open**: handled by UI feature 001.
- **Mailbox users** who open a domain address: the shell of UI feature 001 shows that the page is
  not available for their role.
- **Very large installations** (5,000 domains): only one page is loaded at a time, and search,
  filters and sorting are applied by the API.

## Requirements *(mandatory)*

### Functional Requirements

#### Access and navigation

- **FR-001**: The app MUST offer the domain screens to administrators and domain administrators
  through a "Domains" navigation entry in the shell of UI feature 001. Mailbox users MUST NOT be
  offered any screen or action of this feature.
- **FR-002**: The app MUST offer exactly the actions that the user's role and permission flags
  allow, as reported by the API's identity (UI feature 001):

  | Action | Administrator | Domain administrator |
  |---|---|---|
  | List, search, filter, sort, inspect | All domains, including their domain administrators | Own domains, without the domain administrator list |
  | Create a domain | Yes | Not offered |
  | Change description | Yes | Only with the "change domain description" (`domain_desc`) flag |
  | Change Global Address List flag and tags | Yes | Yes |
  | Change active state, limits, quotas and relay options | Yes | Shown read-only |
  | Delete, bulk activate, bulk deactivate, bulk delete | Yes | Not offered |
  | Domain templates | Yes | Not offered |
  | Read and replace the footer | Yes | Yes, own domains, no flag needed |
  | Domain and template history | Yes | Not offered |

- **FR-003**: When the API refuses an action as forbidden or as not permitted for the role, the app
  MUST show the translated reason, naming the refused attributes when the API names them, refresh
  the identity and the affected domain, and update which controls it offers, without discarding the
  user's other unsaved input.
- **FR-004**: The domain list, each domain page, each footer editor, the template list and each
  template MUST have their own address that can be bookmarked, reloaded and shared. Opening the
  address of a domain or template that does not exist or lies outside the user's scope MUST show one
  and the same "not found" page with a way back to the list.

#### Domain list

- **FR-005**: The list MUST show the domains in the user's scope, page by page, with a choice of 25
  (default), 50 or 100 per page. It MUST show the total number of matching domains and let the user move to the first,
  previous, next and last page and see the current page number.
- **FR-006**: Each entry MUST show:
  - the readable (Unicode) name, and the ASCII name below it when the two differ;
  - the active state, with inactive domains visibly marked by text;
  - for relay domains, a badge that distinguishes "relay", "relay all recipients" and "relay
    non-existing mailboxes only", as the legacy list does;
  - mailboxes in use against the mailbox limit, and aliases in use against the alias limit;
  - quota allocated against the domain quota;
  - storage used and message count;
  - the tags.
- **FR-007**: On wide screens the list MUST be a table with columns for the values of FR-006 and for
  the default mailbox quota, the maximum mailbox quota and the rate limit. On small screens it MUST
  be a list of cards with the values of FR-006. In both layouts, every other value the legacy list
  shows (the "relay this domain" flag, the domain administrators for administrators, and the creation
  and modification times) MUST be reachable from the entry without leaving the list, for example by
  expanding it.
- **FR-008**: Each usage pair (mailboxes, aliases, quota) MUST be shown as text, for example "8 of
  10", and as a bar. A pair at or above 90 % of its limit MUST be marked as nearly full, and a pair
  above its limit as over the limit, with text or an icon in addition to colour.
- **FR-009**: The list MUST offer one search field that finds domains by ASCII name, readable name,
  description or tag (case-insensitive substring match, as the API defines). Results MUST update
  without pressing a button once the user pauses typing. The search MUST be clearable with one
  action.
- **FR-010**: The list MUST offer these filters: active state (all, active, inactive), relay (all,
  relay domains, other domains) and tags (one or more whole tags; a domain matches when it has any of
  them). The number of active filters MUST be visible on the filter control, and one action MUST
  clear all filters. Selecting a tag shown on an entry MUST add that tag as a filter. The tag
  filter MUST suggest the distinct tags in the user's scope as the user types.
- **FR-011**: The list MUST be sortable, ascending or descending, by name, description, active state,
  "relay this domain", mailboxes in use, aliases in use, quota allocated, storage used, maximum
  mailboxes, maximum aliases, default mailbox quota, maximum mailbox quota, domain quota, creation
  time and modification time. The default MUST be by name, ascending. Wide screens MUST offer sorting
  through the headers of the shown columns and through a sort control that covers every key. Small
  screens MUST offer the sort control.
- **FR-012**: The search, filters, sort, page and page size MUST be kept in the page address, so
  that reloading, going back from a domain and opening a shared link restore the same view. They MUST
  NOT be kept in browser storage. Changing the search, a filter,
  the sort or the page size MUST return to the first page.
- **FR-013**: The list MUST offer a refresh action. Returning to the list from a domain MUST show the
  previous results and scroll position at once, without a loading state.
- **FR-014**: The list MUST define these states:
  - loading: placeholders in the shape of the list;
  - no domains at all: for administrators, an explanation and the create action; for domain
    administrators, a message that no domain is assigned to them;
  - no matching domains: a message and an action that clears the search and filters;
  - error: a translated message and a retry action. When a refresh fails, the results shown before
    MUST stay visible with an error notice.

#### Domain page

- **FR-015**: The domain page MUST show:
  - a header with the readable name, the ASCII name when it differs, the active state and the relay
    badge;
  - usage: mailboxes in use, limit and left; aliases in use, limit and left; the number of alias
    domains; quota allocated against the domain quota; storage used; message count; the largest
    quota a new mailbox may get; the default quota for a new mailbox;
  - the sections General (description, active state), Tags, Limits and quotas (maximum mailboxes,
    maximum aliases, default mailbox quota, maximum mailbox quota, domain quota), Relay options, and
    Groupware (Global Address List flag);
  - Delivery, read-only: the assigned relayhost or "none", and the rate limit or "none";
  - for administrators, the usernames of the domain administrators;
  - a footer summary: whether a footer is set, the number of exclusions and whether replies are
    skipped, with the way to the footer editor;
  - the creation time and the last modification time, or "never" when the domain was never
    modified.

  Settings that later features own (spam filter, quota warning BCC, MTA-STS, DKIM and DNS
  diagnostics) MUST NOT be shown, not even as placeholders.
- **FR-016**: Quotas and storage MUST be shown in binary units (MiB, GiB, TiB), and counts, sizes and
  times MUST be formatted for the user's language. Times MUST be shown in the device's time zone.
- **FR-017**: The domain page MUST define a loading state, the "not found" page of FR-004 and an
  error state with a retry action.

#### Creating a domain

- **FR-018**: Administrators MUST be able to start creating a domain from the domain list. Creation
  MUST happen on its own page, not in a dialog, with these sections: domain (name, description,
  template), limits and quotas, options (active state, Global Address List flag, relay options,
  tags), rate limit and DKIM, and review. On small screens the sections MUST be steps with a
  progress indicator ("Step 2 of 5") and back and next actions; on wide screens they MUST be shown on
  one page with a section index. As soon as the name is valid, the user MUST be able to go straight
  to the review.
- **FR-019**: The template choice MUST list every domain template, with Default preselected.
  Choosing a template MUST fill every field with the template's values. When the user has already
  changed a field, the app MUST ask before replacing the values.
- **FR-020**: The name field MUST accept the readable or the ASCII form in any letter case, MUST NOT
  auto-capitalise or auto-correct, and MUST check before sending that the name consists of labels of
  letters, digits and inner hyphens separated by dots, with at most 253 characters and at most 63 per
  label.
- **FR-021**: The DKIM settings MUST offer a switch for generating a DKIM key, a selector and a key
  size of 1024, 2048, 3072 or 4096 bits. Switching key generation off MUST create the domain without
  a DKIM key. With the switch on, an empty selector MUST mean the server's default selector, and the
  field MUST say so, naming that selector as the API reports it. The selector MUST accept only
  letters, digits, `-`, `_` and `.`, up to 255 characters. The key sizes offered MUST be those the
  API reports.
- **FR-022**: The rate limit MUST be either none, or a whole number from 1 to 2,147,483,647 together
  with a time frame of second, minute, hour or day, labelled as legacy labels them ("msgs / hour").
- **FR-023**: The review MUST summarise every value the domain will be created with, and the domain
  MUST be created with exactly those values.
- **FR-024**: The review MUST offer the groupware restart that legacy offers as "Add domain and
  restart SOGo" as a switch that is off by default. It MUST explain that the groupware learns about
  a new domain only after a restart and that the restart briefly interrupts webmail for every user
  of the server. When the API reports the groupware disabled, the switch and the Global Address List
  flag of the creation form MUST be hidden, as legacy does.
- **FR-025**: While a creation is being sent, the create action MUST show progress and MUST NOT
  accept a second submission.
- **FR-026**: After a successful creation, the app MUST open the new domain's page and show the
  creation report: one line per follow-up step (rate limit, DKIM key, DKIM DNS publication,
  groupware directory update, groupware restart) with its translated outcome. Successful outcomes
  MUST be marked as done, "not requested", "not configured", "already existed" and "groupware
  disabled" as neutral information, and failures as warnings that say what the failure means for the
  domain. The report MUST be announced to screen reader users and stay visible until dismissed or
  until the user leaves the page.
- **FR-027**: When the API refuses a creation, the app MUST keep every entered value, show each field
  error next to its field and in an error summary, and show the section that contains the first
  error.
- **FR-028**: Leaving the create page with entered values MUST ask for confirmation.

#### Editing a domain

- **FR-029**: Users MUST be able to change the settings that FR-002 allows them to change, one
  section of the domain page at a time. Each section that contains a value the user may change MUST
  offer its own Edit action; a section without such a value MUST offer none. On small screens the
  section form MUST open full-screen, on wide screens in place. Values the user may not change MUST
  be shown read-only, never as disabled-looking inputs that suggest they could become editable.
- **FR-030**: Every save MUST send only the changed values of its section together with the version
  tag of the domain data the form was based on.
- **FR-031**: The limits and quotas form MUST show the current usage next to each limit it can
  check: mailboxes in use, aliases in use, quota allocated and the largest quota of an existing
  mailbox. It MUST refuse, before sending, a changed mailbox limit, alias limit, domain quota or
  maximum mailbox quota below that usage.
- **FR-032**: Quota fields MUST take a number and a unit of MiB, GiB or TiB, and MUST show a stored
  value in the largest unit that represents it exactly (10,240 MiB as 10 GiB, 3,000 MiB as
  3,000 MiB). Before sending, the app MUST check the rules the API documents: limits are whole
  numbers from 0 to 2,147,483,647; quotas are at least 1 MiB and whole MiB; the default mailbox quota
  is not above the maximum mailbox quota, which is not above the domain quota; the description has at
  most 255 characters. Every rule the app cannot check, for example the server's host name, MUST be
  left to the API, and its error MUST be shown next to the field with its parameters.
- **FR-033**: The relay options MUST stay consistent as the API normalises them: switching on
  "relay non-existing mailboxes only" switches on the other two, switching on "relay all recipients"
  switches on "relay this domain", switching off "relay this domain" switches off the other two, and
  switching off "relay all recipients" switches off "relay non-existing mailboxes only". The legacy
  explanations of the options MUST be shown.
- **FR-034**: When the Global Address List flag is changed, the app MUST say that the groupware
  applies it after its next restart.
- **FR-035**: The description field MUST explain that an empty description is saved as the domain
  name.
- **FR-036**: After a successful save, the app MUST announce the success, show the saved values as
  the API returned them, including normalised relay options, and continue with the new version tag.
- **FR-037**: When the API refuses a save as outdated, the app MUST keep the user's unsaved values,
  load the latest saved data, mark every value that changed in the meantime together with its new
  saved value, and let the user save again, based on the latest version, or discard their changes.
  The app MUST NOT merge or re-send on its own.
- **FR-038**: Leaving a form with unsaved changes MUST ask for confirmation.

#### Tags

- **FR-039**: Tags MUST be edited as a set: the user adds a tag by typing it and confirming with
  Enter, a comma or an add button, and removes a tag with its own labelled remove button. Tags MUST
  be trimmed, empty tags MUST be ignored, tags longer than 255 characters MUST be refused, and tags
  that differ only in letter case MUST be kept once with the first spelling. The tag editor MUST
  suggest the distinct tags in the user's scope as the user types.
- **FR-040**: Saving the tags MUST replace the whole set. A set above the server's tagging limit,
  which the API reports, MUST be refused before sending with that limit, unless it shrinks a set
  that is already above the limit. When the API refuses the set anyway, the app MUST show the limit
  from the error.

#### Deleting a domain

- **FR-041**: Administrators MUST be able to delete a domain from its page and from the actions of
  its list entry. When the domain has mailboxes or resources in use, the delete action MUST be
  unavailable and the app MUST say how many mailboxes and resources have to be removed first.
- **FR-042**: Before deleting, the app MUST show a confirmation with the impact, as the API's
  deletion preview reports it:
  - the readable and ASCII name;
  - the alias domains that will be removed, by name, and the number of aliases that will be
    removed;
  - the assigned domain administrators, and by name the accounts that will be deleted because they
    are left without any domain;
  - that the footer (when one exists), the tags and the stored data of the domain are removed;
  - that the DKIM key, when one exists, is kept.

  When the preview reports that the domain is no longer empty, the app MUST show the blocking
  mailboxes and resources instead and offer no deletion. The Delete button MUST stay disabled until
  the user types the domain name, in its readable or ASCII form, letter case ignored.
- **FR-043**: The deletion MUST be sent with the version tag of the deletion preview. When the API
  refuses it as outdated, the app MUST show the impact again with fresh data. When it refuses it
  because the domain is not empty, the app MUST show how many mailboxes and resources remain. When
  the domain no longer exists, the app MUST say so and remove it from the list.
- **FR-044**: After a successful deletion, the app MUST return to the list, announce the deletion,
  and no longer list the domain.

#### Acting on several domains

- **FR-045**: Administrators MUST be able to select domains in the list, one by one or all on the
  current page, and to activate, deactivate or delete the selection. On small screens selection MUST
  be reachable through a selection mode that shows a checkbox on every card and an action bar that
  names the number of selected domains. The selection MUST be cleared when the page, search,
  filters, sort or page size change. Deactivation MUST ask for confirmation, listing the selected
  domains and stating that it affects every mailbox in them, for example that their users can no
  longer sign in. Activation needs no confirmation.
- **FR-046**: The app MUST send the selection with the API's bulk operation, each domain with the
  version tag of its list entry, and MUST NOT select more domains for one action than the bulk limit
  the API reports. It MUST show progress while the action runs, and finish with a result for every
  domain: done, not found, refused or failed with a translated reason, or outdated. Failed, refused
  and outdated domains MUST stay selected, and the app MUST offer to retry exactly those. When the
  connection is lost, every domain of the request MUST be reported as "outcome unknown" and MUST
  NOT be retried automatically.
- **FR-047**: Bulk deletion MUST ask for confirmation, listing every selected domain with its impact
  (the aliases and alias domains to be removed, the assigned domain administrators and the rule for
  those left without a domain, and the removal of footer, tags and stored data), and MUST require the
  number of domains to be deleted to be typed. Domains with mailboxes or resources in use MUST be
  listed as skipped and MUST NOT be sent.
- **FR-048**: Leaving the page while a bulk action is running MUST warn that its result will not be
  shown.

#### Domain templates

- **FR-049**: Administrators MUST be able to reach a "Domain templates" screen from the domain list
  and from the navigation. It MUST list the templates page by page as in FR-005, with the total, a
  search on the name, and sorting by name, identifier, creation time and modification time (default:
  name, ascending). The Default template MUST be marked.
- **FR-050**: Each template entry MUST show its name, maximum mailboxes and aliases, default,
  maximum mailbox and domain quota, active state, Global Address List flag and relay options, and,
  without leaving the list, its rate limit, DKIM selector, DKIM key size, tags and creation and
  modification times. Wide screens MUST show a table and small screens cards.
- **FR-051**: Administrators MUST be able to create and edit a template on its own page, with
  sections for the name and tags, limits and quotas, options (active state, Global Address List
  flag, relay options), and rate limit and DKIM. The fields MUST follow the rules and behaviour of
  FR-020 to FR-022, FR-032, FR-033 and FR-039.
- **FR-052**: A new template MUST start with the legacy defaults: 10 mailboxes, 400 aliases,
  3,072 MiB default mailbox quota, 10,240 MiB maximum mailbox quota, 10,240 MiB domain quota, active,
  Global Address List enabled, no relay options, no tags, no rate limit, DKIM key generation on with
  an empty selector (the server's default, FR-021), and 2,048-bit keys.
- **FR-053**: For the Default template, the name MUST be read-only and no delete action MUST be
  offered. Its values MUST be editable.
- **FR-054**: Saving a template MUST send only the changed values with the version tag and MUST
  handle an outdated version as in FR-037. A duplicate name MUST be shown as an error on the name
  field.
- **FR-055**: Administrators MUST be able to delete one template, or several selected ones, after a
  confirmation that names them and states that domains created from them keep their values. A
  deletion of several templates MUST require their number to be typed. The API has no bulk
  operation for templates, so the app MUST send one request per template, each with its version
  tag, continue after failures, show progress, and finish with a result per template. It MUST offer
  to retry the failed, refused and outdated ones. A lost connection marks that template "outcome
  unknown" and the rest "not processed", and leaving the page while it runs MUST warn that the
  remaining templates will not be processed. The Default template MUST NOT be selectable for
  deletion.
- **FR-056**: The template list MUST define loading, no-templates, no-matches and error states as
  in FR-014.

#### Domain-wide footer

- **FR-057**: Administrators and the domain's domain administrators MUST be able to open the footer
  editor from the domain page. It MUST show the excluded entries, the "ignore footer on reply
  e-mails" switch, the HTML text and the plain text, the legacy explanation, and a reference of the
  placeholders (`{= auth_user =}`, `{= from_user =}`, `{= from_name =}`, `{= from_addr =}`,
  `{= from_domain =}` and custom mailbox attributes) with a copy action for each.
- **FR-058**: Exclusions MUST be typed as a set of entries, each an address or an alias domain
  name, with the editing behaviour of FR-039. When the API refuses entries, each refused entry MUST
  be marked with its translated error. A picker of the domain's mailboxes, aliases and alias domains
  is not part of this feature.
- **FR-059**: The HTML text MUST be edited and shown as plain source text everywhere in the app and
  MUST NEVER be rendered or interpreted as markup.
- **FR-060**: When a text exceeds 90 % of the 1 MiB limit, the editor MUST show its size against the
  limit. Saving a text above 1 MiB MUST be blocked with a message stating the limit.
- **FR-061**: Saving MUST replace the whole footer and send the version tag, and an outdated version
  MUST be handled as in FR-037. Saving empty texts without exclusions MUST be possible, and the
  editor MUST explain that no footer is then added.
- **FR-062**: The footer editor MUST define loading and error states, and leaving it with unsaved
  changes MUST ask for confirmation.

#### History

- **FR-063**: Administrators MUST be able to open the history of a domain from its page and of a
  template from its page. The History action MUST open the audit log screen of UI feature 001,
  filtered to that domain, including its tags and footer, or to that template. That screen MUST gain
  filters by target type (domain, domain template, domain footer) and target. Each entry MUST show the time, the actor, the client address, the outcome
  including refusals with their translated reason, and the changed values with their old and new
  value in the user's units and language. Footer texts MUST be shown only as changed, with their old
  and new size. A creation MUST show its creation report, and a deletion the outcome of removing the
  stored data and the domain administrator accounts and alias domains that were removed.

#### Errors and feedback

- **FR-064**: Every API error MUST be shown as a translated message built from the error code and the
  validation rule codes the API returns, never as the API's English text. This feature MUST translate at least: domain already
  exists, domain not empty, template name already exists, protected template, outdated version,
  attribute not permitted for the role, temporary failure, and the validation rules of the domain,
  template and footer fields with their parameters (value in use, limit, maximum length, allowed
  values). Unknown rule codes MUST be shown as a generic invalid value of that field.
- **FR-065**: Forms MUST show field errors next to their field and in an error summary at the top
  whose entries lead to the fields. Sizes in error parameters MUST be formatted as sizes.
- **FR-066**: When the API reports a temporary failure, the app MUST say that nothing was changed
  and offer a retry that keeps the input.
- **FR-067**: The outcome of every change MUST be shown and announced to screen reader users. A
  status message MUST NOT disappear while it has focus or is hovered.

#### Mobile and responsive behaviour

- **FR-068**: Every screen and state of this feature MUST be fully usable at 360 px width without
  horizontal scrolling, and its content MUST reflow at 400 % zoom on a 1,280 px wide screen.
- **FR-069**: Interactive targets MUST be at least 44 × 44 CSS px. On small screens the save, cancel
  and step actions of forms MUST stay reachable without scrolling to the end of the form.
- **FR-070**: Number fields MUST bring up a numeric keypad, and fields for domain names, tags,
  selectors, addresses and footer texts MUST NOT auto-capitalise or auto-correct.

#### Accessibility

- **FR-071**: Every screen of this feature MUST meet WCAG 2.2 AA. Every function MUST be operable by
  keyboard, including tag and exclusion entry, selection, sorting, steps and dialogs, and the focus
  MUST be visible and never hidden behind sticky bars.
- **FR-072**: Tables MUST have header cells, and sortable headers MUST expose the current sort
  direction. Card lists MUST be exposed as lists, with the domain or template name as each card's
  heading.
- **FR-073**: Changes of the result count after a search or filter, bulk progress and results, and
  save outcomes MUST be announced as status messages without moving the focus.
- **FR-074**: Dialogs MUST be labelled, keep the focus inside, close with Escape unless an action is
  in progress, and return the focus to the control that opened them.
- **FR-075**: Moving to another step or opening a form MUST move the focus to the new content's
  heading. A failed submission MUST move the focus to the error summary.
- **FR-076**: Usage bars, state badges and outcome markers MUST have text equivalents and MUST NOT
  rely on colour alone, with sufficient contrast in the light and dark themes.

#### Internationalisation

- **FR-077**: All text of this feature MUST come from the translation files and MUST be complete in
  English, Czech and Slovak. Legacy translation keys MUST be reused where the meaning is unchanged.
- **FR-078**: Domain names, descriptions, tags, template names, footer texts and usernames MUST be
  shown as stored and never translated.

#### Data freshness

- **FR-079**: After a successful change, every screen that shows the changed domain, template or
  footer MUST show the new values. Data already loaded MUST NOT be loaded again without reason, for
  example when returning to the list.

### Legacy Parity

Legacy reference: FeldHost fork of mailcow-dockerized (upstream tag `2026-09a`), `data/web/`
`templates/mailbox/tab-domains.twig`, `tab-templates-domains.twig`, `templates/modals/mailbox.twig`
(`addDomainModal`, `addDomainTemplateModal`), `templates/edit/domain.twig`,
`templates/edit/domain-templates.twig`, `js/site/mailbox.js` (`draw_domain_table`,
`draw_templates_domain_table`, `setDomainTemplateData`), `js/build/011-api.js` (generic delete
confirmation) and `lang/lang.{en-gb,cs-cz,sk-sk}.json`. Status: **Matched** (same capability),
**Improved** (same capability, better behaviour) or **Dropped** (intentionally not in this feature,
with the reason).

#### Mail setup › Domains (list)

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Domains card header with count badge | Total number of rows | Matched | FR-005 |
| Refresh button | Reloads the table | Matched | FR-013 |
| Search box | Server-side search on name and tags | Improved: also readable name and description | FR-009 |
| Page length menu, pagination, "showing x of y" | DataTables controls | Matched | FR-005, FR-012 |
| Sortable columns | 9 columns sortable | Improved: 15 sort keys, also on phones | FR-011 |
| Saved table state | DataTables `stateSave` in browser storage | Improved: state restored on reload, back and shared links | FR-012 |
| No filters in the UI (the API's `?tags=` is unused) | — | Improved: active, relay and tag filters | FR-010 |
| Checkbox column, "Toggle all" | Selection on the page | Matched; selection mode on phones | FR-045 |
| Quick actions Activate, Deactivate, Remove | One request with all items, page reload, no per-item result | Improved: per-domain outcome, retry, impact confirmation | FR-045 to FR-048 |
| Quick actions Expand all, Collapse all | Toggle DataTables child rows | Dropped: cards and expandable entries replace collapsed rows | FR-007 |
| Add domain button (admin) | Opens the add-domain modal | Matched | FR-018 |
| Domain column with relay badge (Relay, Relay All, Relay Non-Local) and ASCII name | — | Matched | FR-006 |
| Aliases "x / y", Mailboxes "x / y" | Text | Improved: text and bar, nearly-full marker | FR-006, FR-008 |
| Quota "allocated / domain quota" | Text | Improved: text and bar | FR-006, FR-008 |
| Statistics "messages / storage" | Text | Matched | FR-006 |
| Default mailbox size, Max. size of a mailbox | Columns | Matched (wide screens, expandable on phones) | FR-007 |
| RL (rate limit) | Column, "∞" when none | Matched, read-only | FR-007, FR-015 |
| Relay domain ✓/✗ | Column | Matched | FR-007 |
| Domain administrators (admin), Created on, Last modified, Tags | Collapsed child-row fields | Matched; tags are also filters | FR-006, FR-007, FR-010 |
| Active ✓/✗ | Icon only | Improved: text badge | FR-006, FR-076 |
| Action Edit | Opens the Edit domain page | Matched: opens the domain page | FR-015 |
| Action Remove | Generic confirmation listing the name | Improved: impact and typed confirmation | FR-041 to FR-044 |
| Action DNS | DNS diagnostics modal | Dropped: DNS diagnostics belong to UI feature 010 | — |

#### Add domain modal

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Extra-large modal with every field | One long form | Improved: own page with sections, steps on phones | FR-018 |
| Domain, Description | Text inputs | Matched, with name syntax check | FR-018, FR-020, FR-035 |
| Template select | Default preselected, choosing fills the fields | Matched; asks before overwriting changed fields | FR-019 |
| Tags | Tag box | Matched | FR-039 |
| Max. aliases, Max. mailboxes, Default mailbox quota, Max. quota per mailbox (MiB), Total domain quota (MiB) | Number inputs, quotas in MiB | Improved: quota entry in MiB, GiB or TiB, cross-field checks before sending | FR-031, FR-032 |
| Global Address List (hidden when SOGo is disabled), Active | Checkboxes | Matched: the GAL is hidden when the API reports the groupware disabled | FR-018, FR-024 |
| Rate limit value and frame | Number and select | Matched | FR-022 |
| DKIM selector, DKIM key length | Input, select | Matched; explicit switch for "no DKIM key" | FR-021 |
| Relay options with info texts | Three checkboxes, no consistency logic | Improved: kept consistent as the API normalises | FR-033 |
| Buttons "Add domain only" and "Add domain and restart SOGo" | Two submit buttons | Matched as a restart switch on the review, off by default | FR-024 |
| Notice that SOGo must be restarted and DNS reviewed | Static text | Matched for the restart; DNS review belongs to UI feature 010 | FR-024 |
| Cached form values | Inputs cached in the browser | Dropped: replaced by a confirmation before leaving | FR-028 |
| Result messages (domain added, DKIM key already existed, SOGo restart failed) | Separate notifications | Improved: creation report with every step | FR-026 |

#### Edit domain page

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Domain name, readable and ASCII | Read-only | Matched | FR-015 |
| Description, read-only without `domain_desc` | Input | Matched | FR-002, FR-029, FR-035 |
| Tags, removed one by one at once with a confirmation | Immediate deletion per tag | Improved: edited as a set and saved with the form | FR-039, FR-040 |
| Relayhost select (with `domain_relayhost`) | Shown, but the value is never saved for domain administrators | Dropped as an editor: shown read-only; editing belongs to UI feature 009 | FR-015 |
| Limits and quotas (admin) | Number inputs, usage checked only by the server | Improved: usage shown and checked before sending | FR-031, FR-032 |
| Relay options with info texts (admin) | Checkboxes | Improved: kept consistent | FR-033 |
| GAL with info text | Checkbox | Matched, with a restart notice | FR-034 |
| Active, disabled for domain administrators | Checkbox | Matched: read-only for domain administrators | FR-029 |
| Save (one form for everything) | Last write wins | Improved: each section saved on its own; outdated saves are stopped without losing input | FR-029, FR-030, FR-037 |
| Created on, Last modified | Text | Matched | FR-015 |
| DKIM TXT record | Shown under the form | Dropped: DKIM belongs to UI feature 010 | — |
| Tabs Rate limit, Spam filter, Quota warning BCC, MTA-STS | Editors | Dropped: UI features 006 (rate limit, spam filter), 013 (quota warning BCC) and 010 (MTA-STS); the rate limit is shown read-only | FR-015 |
| Tab Domain wide footer | Editor | Matched, see below | FR-057 to FR-062 |

#### Domain wide footer tab

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Explanation and placeholder list | Static text | Improved: copy action per placeholder | FR-057 |
| Exclude from footer | Multi-select of the domain's mailboxes, aliases and alias domains | Improved in validation (per-entry errors); the picker arrives with the mailbox and alias screens (UI features 003 and 004), whose list operations API 002 names for it | FR-058 |
| Ignore footer on reply e-mails | Checkbox | Matched | FR-057 |
| HTML footer, PLAIN footer | Text areas, no size limit | Matched, with a size indicator and the 1 MiB limit | FR-059, FR-060 |
| Save | Invalid exclusions silently skipped, last write wins | Improved: refused entries marked, outdated saves stopped | FR-058, FR-061 |

#### Domain templates

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Templates tab with count, refresh, toggle all, Remove selected, Add template | DataTables, client-side | Matched; bulk delete with per-item outcome | FR-049, FR-055 |
| Expand all, Collapse all | Child rows | Dropped, as for domains | FR-050 |
| Columns ID, Template, Max. aliases, Max. mailboxes, quotas, GAL, Relay domain, Relay all, Relay unknown, Active; collapsed Rate limit, Selector, Key length, Tags | — | Matched | FR-050 |
| Default sort by ID, descending; client-side search on every column | — | Improved: default by name, search on the name, sort by name, ID and times | FR-049 |
| Actions Edit, Remove (no Remove for Default) | — | Matched | FR-053, FR-055 |
| Add template modal | One long form, values not validated | Improved: own page with sections and the domain field rules | FR-051, FR-052 |
| Edit template page, renaming Default silently ignored | — | Improved: Default name read-only | FR-053, FR-054 |

### API Dependency

This feature depends on **mailcow REST API v2 feature 002, Domains**
(`mailcow-rest-v2/specs/002-domains/spec.md`), and on the identity, error conventions and audit log
of API feature 001. The contract version is pinned in the plan, once the API 002 contract has been
merged.

| Behaviour relied on | API requirement |
|---|---|
| Permission matrix; "not found" for domains outside the scope; "forbidden" for operations the role may never use | API 002 FR-001 to FR-005 |
| Domain representation with readable and ASCII name, relayhost and rate limit (read-only), domain administrators for administrators only | API 002 FR-006, FR-007, FR-010 |
| Usage figures, including the quotas available to a new mailbox | API 002 FR-008 |
| Quotas in bytes, whole MiB in requests | API 002 FR-009 |
| List with paging (default 25), total, search, filters, sort keys and full entries | API 002 FR-011 to FR-015 |
| Inspection with a version tag | API 002 FR-016 |
| Creation with template, overrides, DKIM, rate limit, groupware restart and creation report | API 002 FR-017 to FR-029 |
| Partial edits, rules, usage checks with the value in use, refusal of attributes not permitted | API 002 FR-020, FR-021, FR-030 to FR-034 |
| Deletion preconditions, cascade, "not empty" with remaining counts | API 002 FR-035 to FR-040 |
| Version tags on domains, templates and footers; outdated refusal | API 002 FR-041, FR-042 |
| Tags as a replaced set with a limit | API 002 FR-043, FR-044 |
| Templates: list, search, sort, create, edit, delete, protected Default, legacy defaults | API 002 FR-045 to FR-050 |
| Footer read and replace, exclusion validation, 1 MiB limit, placeholders | API 002 FR-051 to FR-055 |
| Audit records with target filters, changed values, creation report and deletion outcome | API 002 FR-057, FR-058; API 001 FR-046, FR-047 |
| Problem types and validation rule codes with parameters | API 002 FR-059; API 001 FR-049, FR-055 |
| Bulk activation, deactivation and deletion with one result per domain and per-item version tags | API 002 FR-015, FR-062, FR-063 |
| Domain capabilities: groupware state, tagging limit, field and footer limits, bulk limit, page sizes, DKIM defaults | API 002 FR-064 |
| Deletion preview: blockers, removals, domain administrator accounts to be deleted, DKIM key, version tag | API 002 FR-065 |
| Distinct domain tags in scope | API 002 FR-066 |
| Role, scope and permission flags (`domainDesc`) of the signed-in user | API 001 FR-028, FR-029 |

**API gaps.** This spec first listed nine gaps. API 002 resolved these before planning:

- the groupware state, the tagging limit and the default DKIM selector (FR-064);
- the resource count and the largest existing mailbox quota (FR-008);
- the domain administrator accounts a deletion removes (FR-065);
- the version tags of list entries (FR-015);
- the distinct tag list (FR-066).

Footer exclusion candidates are not a gap: API 002 names the mailbox and alias list operations of
features 003 and 004 for them, and those UI features add the picker (FR-058).

One gap remains, recorded in the plan, and the app does not work around it:

1. The members of the audit details of domain, template and footer records (old and new values,
   the creation report, the removed objects) are not described in the contract. Until they are,
   history entries show these details as stored, without unit formatting or translated step
   outcomes (FR-063).

A changed Global Address List flag takes effect only after a groupware restart, and API 002 offers
no restart outside domain creation. The app can only inform the user (FR-034); restarting containers
belongs to API and UI feature 011.

### Key Entities *(include if feature involves data)*

- **Domain**: a mail domain as the API returns it: readable and ASCII name, description, active
  state, limits, quotas, relay options, Global Address List flag, tags, read-only relayhost and rate
  limit, times, usage figures, domain administrators (administrators only) and a version tag.
- **Usage figures**: mailboxes, aliases and alias domains in use, what is left, quota allocated,
  storage used, message count, and the quotas available to a new mailbox.
- **Domain template**: a named set of values that pre-fill a new domain, with a Default marker,
  times and a version tag.
- **Domain footer**: HTML text, plain text, reply handling and exclusions of one domain, with a
  version tag.
- **Creation report**: the outcome of each follow-up step of one domain creation.
- **List view**: the search, filters, sort, page and page size of the domain or template list.
- **Bulk run**: a selection of domains, one action, and the outcome per domain.
- **History entry**: an audit record about a domain, its footer or a template.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator creates a domain from an existing template on a 360 px wide phone in
  under 1 minute, and in under 30 seconds when only the name is entered.
- **SC-002**: For 100 % of the domains in the parity test set, every value that the legacy domain
  list and Edit domain page show is shown by the new app with the same figure, allowing for unit
  formatting.
- **SC-003**: Automated accessibility checks report 0 WCAG 2.2 AA violations on every screen and
  state of this feature, at 360 px and at desktop width, in the light and dark themes.
- **SC-004**: No screen of this feature needs horizontal scrolling at 360 px width or at 400 % zoom
  on a 1,280 px wide screen.
- **SC-005**: In 100 % of the permission tests (administrator, domain administrator with and
  without the description flag), the app offers exactly the actions of the permission matrix.
- **SC-006**: 100 % of saves based on outdated data are stopped, and the user's unsaved input is
  still present afterwards.
- **SC-007**: 100 % of field errors returned by the API are shown next to their field in English,
  Czech and Slovak, with their parameters filled in.
- **SC-008**: A bulk action on 50 domains reports an individual outcome for all 50, and a retry
  sends only the domains that failed, were refused or were outdated.
- **SC-009**: Translation completeness checks find 0 missing keys in English, Czech and Slovak.
- **SC-010**: When the API answers within 1 second, the first page of the domain list is visible
  within 2 seconds of opening it on a mid-range phone over a mobile connection, and search results
  update within 1 second after the user stops typing.
- **SC-011**: In a moderated test with at least 5 administrators who know the legacy UI, at least
  90 % find a domain by tag, raise its domain quota and add a tag on a phone at the first attempt
  without help.

## Assumptions

- UI feature 001 provides the shell, navigation, sign-in, the identity with role, scope and
  permission flags, language and theme, session handling, the generic translated error handling
  (including 401 and 403), status announcements, and the audit log screen, which this feature
  extends with target filters (FR-063).
- The API 002 contract is merged before this feature is planned. Until the API is implemented, the
  feature is built and tested against a mock generated from the contract.
- The legacy UI keeps working for everything this feature leaves to later features (rate limit
  editing, relayhost, spam filter, quota warning BCC, MTA-STS, DKIM and DNS diagnostics).
- Legacy translation keys with unchanged meaning are reused, for example `mailbox.domains`,
  `mailbox.add_domain`, `mailbox.domain_templates`, `edit.max_mailboxes`, `edit.relay_domain`,
  `edit.gal`, `edit.domain_footer`, `edit.footer_exclude`, `edit.domain_footer_skip_replies`,
  `ratelimit.*`, `danger.domain_exists`, `danger.domain_not_empty`, `danger.template_exists`,
  `success.domain_added` and `warning.domain_added_sogo_failed`. Legacy texts that contain HTML
  markup are carried over without the markup, and labels whose meaning changes (such as "Max. quota
  per mailbox (MiB)", now unit-aware) get new keys.
- The 90 % "nearly full" threshold and the page sizes are defaults of this feature.
- **Out of scope**: mailbox, alias, alias domain and resource screens; domain administrator
  management; editing the relayhost and the rate limit; DKIM, MTA-STS and DNS diagnostics; spam
  filter; quota warning BCC; restarting the groupware outside domain creation.
