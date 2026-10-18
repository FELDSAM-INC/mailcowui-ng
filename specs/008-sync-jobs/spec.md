# Feature Specification: Sync Jobs

**Feature Branch**: `main` (no feature branches, constitution 1.1.0)

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Sync job screens for mailcowui-ng, served by mailcow REST API v2
feature 008. Administrators, domain administrators and mailbox users, each within their scope and
permission flags, see the sync jobs that copy mail from a remote IMAP server into a mailbox: a list
with each job's state, last run and last result, which becomes cards on phones. They create and
edit jobs in a grouped form whose many advanced options stay collapsed on phones, activate and
deactivate them, schedule the next run, delete them, and read the log of the last run. The remote
password is never shown again after it is saved. Every view has loading, empty and error states,
works at 360 px with touch, meets WCAG 2.2 AA and is translated into English, Czech and Slovak.
Replaces the legacy 'Sync jobs' tab of the mailbox page (administrators and domain administrators)
and of the user page, the add-sync-job modals, the edit sync job page and the log modal."

## Clarifications

### Session 2026-10-18

- Q: Where do sync jobs live in the navigation, and where is the list state kept? → A:
  Administrators and domain administrators get a "Sync jobs" section listing every job in their
  scope, which can be opened pre-filtered to one mailbox (FR-004); mailbox users get "Sync jobs" in
  their own area. Search, filters, sort and page live in the page address, never in browser storage
  (FR-010). (agent decision: API 008 scopes the list to the caller or to one mailbox (FR-011 there);
  legacy buries the list in a tab of the long mailbox page and keeps the table state in browser
  storage, which breaks links and the back button.)
- Q: What do domain administrators and mailbox users without the sync-jobs permission flag see? →
  A: No "Sync jobs" entry, and a translated "not permitted" page when they open a sync job address
  (FR-001, FR-003). (agent decision: API 008 refuses every sync-job operation to them as forbidden
  (FR-001 and FR-005 there); legacy hid the tab from users but showed domain administrators a list
  with disabled buttons.)
- Q: How are actions on several selected jobs performed? → A: With API 008's bulk operation: one
  request that names every selected job of the current page together with its version tag as
  listed, up to the bulk limit of the capabilities read. The summary shows one result per job;
  failed, refused and outdated jobs stay selected for a retry, and a dropped connection is reported
  as "outcome unknown", clears the selection and is never retried automatically (FR-037).
  (consistency change, aligned with
  `docs/conventions.md` (Bulk actions) and API 008 FR-023 and FR-024, which now offer
  `POST /sync-jobs/bulk-actions` with `targets`; the first draft sent one request per job because
  the API had no bulk operation then.)
- Q: How is the remote password shown and kept? → A: Never shown after saving; the edit field
  starts empty and an empty field keeps the stored password; it is masked with a reveal control,
  protected from browser autofill, never stored in the browser and never sent to a third party
  (FR-029 to FR-035). (agent decision: API 008 makes it write-only (FR-018 there) and constitution V
  forbids storing credentials in the browser; legacy caches the user form, password included, in
  browser storage and sends the password to a breach-check service.)
- Q: Which values does the create form start with? → A: The creation defaults of API 008's
  capabilities read (today: active, SSL, 20-minute interval, automap, subscribe all and delete
  duplicates on the destination on, timeouts 600, maximum age and speed limit 0, the exclusion
  pattern `(?i)spam|(?i)junk`, every other switch off, simulate off for every role), plus one
  form-only pre-fill: the port follows the encryption (993 for SSL, 143 otherwise) until the user
  edits it (FR-018, FR-019). (agent decision: API 008 FR-017 requires the port without a default;
  legacy pre-fills port 143 with SSL, which fails against most servers. Legacy's user form turned
  simulate on, so a user's first job copied nothing. Consistency change: API 008 now defaults the
  exclusion pattern to the legacy `(?i)spam|(?i)junk` and publishes every default in its
  capabilities read, so the app takes them from there instead of pre-filling the pattern itself.)
- Q: Which form sections are collapsed, and on which screens? → A: "Duplicates and deletion",
  "Limits and timeouts" and "Expert options" start collapsed below tablet width and open on wider
  screens; collapsed headers count values that differ from the defaults, and a section with an
  error opens itself (FR-016, FR-017). (agent decision: constitution II asks for sections, not one
  long form; the counts keep changed options visible on edit.)
- Q: How does the list stay current while jobs run in the background? → A: Manual refresh, plus an
  automatic refresh every 30 seconds only while the page is visible and a listed job is running
  (FR-014). The automatic refresh can be paused, it is suspended while selection mode is on, and it
  pauses after 15 minutes without user interaction (or the session's idle lifetime, if shorter),
  with a notice and a "Resume" action. (agent
  decision: legacy has only a manual button; constitution VII forbids refetching without reason,
  and a running job is that reason. The API never starts runs (FR-022 there), so there is no "run
  now" to wait for. Consistency change: WCAG 2.2.2 needs a way to pause content that updates on its
  own; UI 001 FR-033 forbids automatic requests that keep an idle session alive, and UI 011 FR-021
  and its plan pause live updates after the same limit; a bulk action sends the versions as listed,
  so the list must not change under a selection.)
- Q: How is the run log presented? → A: Full screen on phones and a large dialog on wider screens,
  verbatim plain text in a fixed-width font, wrapped by default with a toggle, a copy action, no
  download, fetched only when opened (FR-041 to FR-046). (agent decision: API 008 reads the log as a
  separate, possibly large, plain-text value (FR-009, FR-015 there); legacy shows it in an editable
  textarea; copying covers the support use case without an extra feature.)
- Q: May mailbox users use "Schedule next", which legacy offers only on the administrator tab? →
  A: Yes, every role that may manage sync jobs (FR-036). (agent decision: API 008 FR-005 grants
  rescheduling to every role holding the permission; only the legacy button was missing.)
- Q: Do activate, deactivate, schedule next run and delete send the job's version? → A: Activate,
  deactivate and delete send the version shown in the list or details screen, for one job and for
  each job of a bulk action; when the job changed in the meantime the app says so, refreshes the job
  and lets the user retry. Schedule next run sends no version. A section save always sends the
  version it loaded (FR-026, FR-036, FR-037). (agent decision: API 008 FR-021 recommends that
  interactive clients always send the version and exempts rescheduling; list entries carry the
  version (FR-015 there).)
- Q: Can the target mailbox of an existing job be changed? → A: No; it is shown read-only on the
  details screen (FR-020). (agent decision: legacy never changes the target on edit, and moving a
  migration to another mailbox is clearer as delete and recreate. API 008 FR-016 now refuses a
  different target with the rule code `immutable`.)
- Q: Which cross-feature UI conventions change this spec? → A: The details screen is split into the
  form's sections, each with its own edit and save; an outdated save keeps the input, reloads the
  job and marks the values that changed (FR-016, FR-026). Deleting several jobs needs their number
  typed (FR-039). The details screen offers a History action that opens the audit log filtered to
  the job (FR-015). Lists offer 25, 50 and 100 jobs per page (FR-012). Limits, defaults, the bulk
  limit and whether the user may set custom parameters come from API 008's capabilities read and are
  never hard-coded (FR-055, FR-056). (alignment with `docs/conventions.md`; replaces the first
  draft's single edit form, which predates the conventions.)
- Q: Is deactivating a sync job confirmed first? → A: Yes, with one explicit confirmation that
  says the job will not run until it is activated again and that a run in progress finishes on its
  own, for one job or a selection. Activating and scheduling the next run take effect at once. All
  three are announced (FR-036, FR-037). (consistency change, aligned with `docs/conventions.md`
  (Confirmations), which names deactivating among the actions needing one explicit confirmation;
  the first draft took effect at once, as legacy does.)

## User Scenarios & Testing *(mandatory)*

Terms used throughout:

- **Sync job**: a scheduled copy of mail from one account on a remote IMAP server into one mailbox
  on this server. Legacy calls it "sync job"; it runs the imapsync tool in the background.
- **Source**: the remote server (host, port, encryption) and the remote account (username,
  password) that mail is copied from.
- **Target mailbox**: the mailbox on this server that receives the mail. Legacy labels it "Owner".
- **Run**: one execution of a job. A job runs again when its interval has passed since its last
  run, as long as it is active.
- **Last result**: the outcome of the most recent finished run: success, a known failure reason
  (for example "Wrong username or password"), or an unrecognised failure.
- **Run log**: the text output of the most recent run.
- **Schedule next run**: clearing a job's last run so that it runs at the next opportunity
  instead of waiting for its interval. Legacy calls it "Schedule next".

### User Story 1 - See sync jobs and their state (Priority: P1)

An administrator, a domain administrator or a mailbox user opens "Sync jobs" and sees every job
in their scope: where it copies from, which mailbox it copies into (administrators and domain
administrators), whether it is active, whether it is running right now, when it last ran and how
that run ended. On a phone each job is a card; on a wide screen the jobs form a table. They can
search and filter the list and open a job to see all its settings.

**Why this priority**: Sync jobs fail silently in the background. Seeing which ones failed, and
why, is the reason people open this screen, and every other story starts from this list.

**Independent Test**: Against a mock API holding jobs in several states (never run, running,
succeeded, failed with each known reason, failed with an unknown reason, inactive), open the list
as each role on a 360 px and a desktop viewport and compare every displayed value with the mock
data.

**Acceptance Scenarios**:

1. **Given** an administrator on a 360 px wide phone, **When** they open "Sync jobs", **Then**
   every job appears as a card showing the source account and server, the target mailbox, the
   active state, the running state, the last run time and the last result, and the page never
   scrolls horizontally.
2. **Given** the same administrator on a desktop, **When** they open "Sync jobs", **Then** the
   jobs appear as a table with the same information, which they can sort.
3. **Given** a domain administrator, **When** they open "Sync jobs", **Then** they see only jobs
   whose target mailbox is in one of their domains.
4. **Given** a mailbox user with the sync-jobs permission, **When** they open "Sync jobs", **Then**
   they see only the jobs that copy into their own mailbox, without a target mailbox column.
5. **Given** a job whose last run failed with a recognised reason, **When** the list is shown,
   **Then** the result reads as that reason in the user's language, marked as a failure by an
   icon and text, not by colour alone. **Given** an unrecognised reason, **Then** it reads "Check
   log" with a direct way to open the run log.
6. **Given** a job that has never run, **When** the list is shown, **Then** its last run reads
   "Never" and it has no result.
7. **Given** a list being loaded, **Then** a loading state is shown; **given** no jobs, **Then** an
   empty state explains what sync jobs are and offers to create one when the user may; **given** a
   failed load, **Then** an error state explains the problem and offers to retry.
8. **Given** an administrator with many jobs, **When** they type part of an address or a host
   name into the search, or filter by target mailbox, active state or last result, **Then** only
   matching jobs remain and the number of matches is announced to screen readers.

---

### User Story 2 - Create a sync job (Priority: P1)

A user who may manage sync jobs creates one: an administrator or domain administrator picks the
target mailbox, a mailbox user always targets their own mailbox. They enter the source server and
remote account, choose how often it runs, and accept or change the copying options. The form is
split into sections; on a phone the advanced sections stay collapsed until opened.

**Why this priority**: Moving mail from another provider is the main reason sync jobs exist. On
the legacy UI this is a single, very long modal that is hard to use on a phone.

**Independent Test**: As each role, create a job with only the required fields and another with
every option changed, on both viewports, and compare the request sent to the mock API with the
entered values and the documented defaults. Submit invalid values and check that each server
error appears on its field.

**Acceptance Scenarios**:

1. **Given** an administrator on a phone, **When** they start creating a job, **Then** the form
   shows the sections "Target mailbox", "Source", "Schedule" and "Folders" open, and the advanced
   sections ("Duplicates and deletion", "Limits and timeouts", "Expert options") collapsed, each
   with a summary of its current values.
2. **Given** the create form, **When** it opens, **Then** every field holds the documented default
   (for example a 20-minute interval, active, folders automapped, all folders subscribed,
   duplicates on the destination deleted, spam and junk folders excluded).
3. **Given** a mailbox user, **When** they create a job, **Then** there is no target mailbox
   choice and the job is created for their own mailbox.
4. **Given** a domain administrator, **When** they pick the target mailbox, **Then** the picker
   offers only mailboxes of their domains and can be searched by typing.
5. **Given** the source password field, **When** the user types, **Then** the characters are
   hidden unless they choose to reveal them, the browser does not fill in the user's own sign-in
   credentials, and a notice says that the password is stored on the server in readable form.
6. **Given** the user switches on "Delete from source when completed" or "Delete messages on
   destination that are not on source", **Then** a warning explains that these options delete
   mail and cannot be undone.
7. **Given** a submitted form with an invalid value in a collapsed section, **When** the server
   rejects it, **Then** that section opens, the error is shown on the field in the user's
   language, and focus moves to the first invalid field.
8. **Given** a job for the same target mailbox, remote username and host already exists, **When**
   the user submits, **Then** the form explains that such a job already exists.
9. **Given** a successful submission, **Then** a confirmation is announced, the new job appears in
   the list, and nothing the user typed, including the password, is kept in browser storage.

---

### User Story 3 - Edit a sync job without exposing the remote password (Priority: P1)

A user who may manage sync jobs opens a job and changes its settings, one section of the details
screen at a time, each with its own edit and save. Every current value is shown except the remote
password, which is never shown. Leaving the password field empty keeps the stored password; typing
a new one replaces it.

**Why this priority**: Remote passwords change and copying options need adjusting after the first
run. Without editing, users would have to delete and recreate jobs and re-enter the password.

**Independent Test**: Open a job from the mock API, check that no password value appears anywhere
on the page, change one option and save, and check that the request leaves the password out. Then
save a new password and check that it is sent once and never shown again.

**Acceptance Scenarios**:

1. **Given** an existing job, **When** the user opens its Source section for editing, **Then** every
   field shows its current value, the password field is empty and says that a password is saved
   and that leaving the field empty keeps it.
2. **Given** the Schedule section in edit mode, **When** the user changes the interval and saves,
   **Then** only the changed settings are sent and the stored password stays.
3. **Given** the Source section in edit mode, **When** the user enters a new password and saves,
   **Then** the new password is sent once; editing the section again shows the empty password
   field again.
4. **Given** the details screen, **Then** the target mailbox is shown but cannot be changed.
5. **Given** another user changed the same job after it was opened, **When** the user saves a
   section, **Then** the save is refused, the user is told that the job changed in the meantime,
   their input stays in the section, the current settings are loaded and the values that changed
   are marked, and the user can save again. Their unsaved input is never silently overwritten and
   there is no "overwrite anyway".
6. **Given** unsaved changes in a section, **When** the user tries to leave the screen, **Then**
   they are asked to confirm that the changes will be lost.

---

### User Story 4 - Activate, deactivate and schedule the next run (Priority: P2)

A user who may manage sync jobs pauses a job, resumes it, or makes it run at the next opportunity
instead of waiting for its interval, for one job or for several selected jobs at once.

**Why this priority**: These are the most frequent changes after creation, for example pausing a
job during a migration window or re-running one after fixing the remote password. They are less
critical than seeing, creating and editing jobs.

**Independent Test**: Toggle one job and a selection of three jobs against the mock API, with one
of the three failing, and check the requests, the updated list and the per-job result summary.

**Acceptance Scenarios**:

1. **Given** an active job, **When** the user deactivates it from the list or from the job and
   confirms, **Then** it shows as inactive and the change is announced; activating it again needs
   no confirmation.
2. **Given** a job that has run, **When** the user chooses "Schedule next", **Then** its last run
   and result are cleared and it shows as waiting for its next run.
3. **Given** three selected jobs, **When** the user activates them, **Then** the app sends one bulk
   request naming the three jobs with their versions, and a summary states how many succeeded and
   names each job that failed with the reason; failed jobs stay selected.
4. **Given** a phone, **When** the user wants to act on several jobs, **Then** they can enter a
   selection mode with touch targets of at least 44 × 44 px, and the available actions stay
   reachable without horizontal scrolling.

---

### User Story 5 - Read the run log (Priority: P2)

A user looking at a failed or suspicious job opens the log of its most recent run, reads it on a
phone or desktop, and copies it, for example to send it to support.

**Why this priority**: The last result names only the broad reason. The log is the only way to
understand an unrecognised failure, but it is needed only after the list shows a problem.

**Independent Test**: Open logs of different sizes and contents from the mock API, including an
empty log, a log with markup-like text and a very long log, on both viewports, and check that the
text is shown verbatim and can be copied.

**Acceptance Scenarios**:

1. **Given** a job that has run, **When** the user opens its log, **Then** the log text is shown
   verbatim in a fixed-width font, read-only, with the job's source and last run time as context.
2. **Given** a phone, **When** the log is open, **Then** it fills the screen, long lines wrap by
   default, and the user can switch wrapping off to scroll lines sideways inside the log area only.
3. **Given** the log, **When** the user chooses "Copy", **Then** the whole log is copied and the
   success is announced.
4. **Given** a job that has never run, **When** the user opens its log, **Then** a message says
   that there is no log yet.
5. **Given** a log containing text that looks like markup, **Then** it is displayed as plain text
   and never interpreted.

---

### User Story 6 - Delete sync jobs (Priority: P2)

A user who may manage sync jobs deletes a job that is no longer needed, or several selected jobs,
after confirming exactly which jobs will be removed.

**Why this priority**: Finished migrations leave jobs behind, but deleting is rarer than the other
actions and an inactive job does no harm.

**Independent Test**: Delete one job and a selection of jobs against the mock API, cancel once,
and check the confirmation content, the requests and the list afterwards.

**Acceptance Scenarios**:

1. **Given** a job, **When** the user chooses "Delete", **Then** a confirmation names the job's
   source account, server and target mailbox and states that mail already copied stays in the
   mailbox.
2. **Given** the confirmation, **When** the user cancels, **Then** nothing is deleted and focus
   returns to the control that opened it.
3. **Given** several selected jobs, **When** the user deletes them, **Then** the confirmation lists
   every selected job and asks for their number to be typed, the jobs are deleted with one bulk
   request, and a summary reports any job that could not be deleted.

---

### Edge Cases

- A job is deleted or moves out of the user's scope while they look at it: opening, editing or
  acting on it shows that it no longer exists and returns to the refreshed list.
- The user's sync-jobs permission is revoked during the session: the next action is refused, the
  user sees a translated "not permitted" message, and the "Sync jobs" entry disappears once the
  identity is refreshed.
- A mailbox user without the sync-jobs permission opens a sync job address directly: a translated
  "not permitted" page is shown instead of the list.
- A domain administrator with no mailboxes in their domains starts creating a job: the target
  mailbox picker is empty and explains that a mailbox must exist first.
- The target mailbox of a job is deleted or renamed in another session: the job disappears with
  the mailbox, or appears under the new address, at the next refresh.
- A job is running while the user deactivates, edits or deletes it: the confirmation or result
  explains that a run already in progress finishes on its own.
- The run log is very large (the API returns it whole): the screen stays responsive and
  scrollable.
- The run log is empty although the job has run: the screen says that the run produced no output.
- Source host names, usernames, exclusion patterns or custom parameters are very long: they wrap or
  are shortened with the full value available, and never force horizontal scrolling.
- The server rejects the exclusion pattern or a custom parameter: the error is shown on that
  field, naming the rejected option where the server provides it.
- The connection drops during a multi-job action: the outcome of every selected job is reported as
  unknown, the selection is cleared, the list is refreshed to show what changed, and nothing is
  retried automatically.
- The session expires while a form is open: the shell's session handling applies (feature 001);
  the remote password the user typed is not stored to survive the sign-in.
- Several jobs are running: the list shows their running state and refreshes while any job runs.
- A job is rescheduled while it is running: the run in progress finishes and records its own
  result; the screen says so.
- The source host is an IPv6 address: the API refuses it, and the field error says that a host
  name or IPv4 address is required.
- The operator has restricted custom parameters to administrators: a domain administrator or
  mailbox user does not get the field on creation, and sees the stored value read-only with the
  reason on the details screen (FR-056). If the restriction changes while a form is open, the API's
  refusal is shown on that field.
- Another user changed a job between loading the list and activating, deactivating or deleting
  it: the action is refused as outdated, the job's current values are shown, and the user can
  retry.


## Requirements *(mandatory)*

### Functional Requirements

#### Access, scope and navigation

- **FR-001**: The app MUST show a "Sync jobs" navigation entry to administrators, and to domain
  administrators and mailbox users only when their identity (feature 001) reports the sync-jobs
  permission flag, because API 008 refuses every sync-job operation without it. Hiding the entry
  is a convenience; every sync job screen MUST still handle a "not permitted" answer from the API.
- **FR-002**: The list MUST show exactly the jobs the API returns for the signed-in user: all jobs
  for an administrator, jobs whose target mailbox is in a managed domain for a domain
  administrator, and jobs of their own mailbox for a mailbox user. The app MUST NOT widen or narrow
  that scope itself.
- **FR-003**: Opening the address of a sync job screen without the permission MUST show a
  translated "not permitted" page. Opening a job that does not exist or is outside the user's
  scope MUST show a translated "not found" page with a way back to the list.
- **FR-004**: The list MUST be openable pre-filtered to one target mailbox through its address, so
  that other screens (for example the mailbox details of feature 003) can link to "this mailbox's
  sync jobs".

#### List and job details

- **FR-005**: Each job in the list MUST show:
  - the source as remote username, host and port;
  - the target mailbox (not for mailbox users, whose jobs all target their own mailbox);
  - its state: running, waiting for its next run, or inactive;
  - the last run time, formatted in the user's locale, or "Never";
  - the last result (FR-007);
  - the interval in minutes.
- **FR-006**: State and result MUST each be conveyed by text plus an icon or shape, never by colour
  alone. A job that is running while inactive MUST show both facts.
- **FR-007**: The last result MUST be translated from the job's result code: success and each
  recognised failure reason (connection problem, problem with encrypted connection,
  authentication problem, target mailbox over quota, cannot connect to remote server, wrong
  username or password) use the legacy wording. Any other failure MUST read "Check log" and offer
  the run log directly. A job that has never run, or whose result was cleared, MUST show no result.
- **FR-008**: Below tablet width the list MUST render as cards; on wider screens it MUST render as a
  table. At 360 px the page MUST NOT scroll horizontally. Long hosts, usernames, addresses and
  patterns MUST wrap or be shortened with the full value available to all users, including
  screen-reader and keyboard users.
- **FR-009**: The list MUST offer a free-text search (matching source host, remote username and,
  for administrators and domain administrators, target mailbox) and filters for target mailbox and
  domain (administrators and domain administrators), active state, running state and last result
  (succeeded, failed, no result). The number of matching jobs MUST be shown and announced to screen
  readers.
- **FR-010**: Search, filters, sort order and page MUST be reflected in the page address, so that
  reloading, sharing a link and going back restore the same view. They MUST NOT be kept in browser
  storage.
- **FR-011**: The list MUST default to newest job first (highest identifier first, as the legacy
  administrator table does). On wide screens the user MUST be able to sort by the columns the API
  sorts by: identifier, target mailbox, source host, remote username, interval, active state, last
  run and last result. On phones a sort choice MUST offer the same options.
- **FR-012**: The list MUST be paginated with the API's pages, offer 25 (the default), 50 and 100
  jobs per page, show the total number of jobs, and offer page navigation that works with touch at
  360 px.
- **FR-013**: The list MUST have distinct states for loading, no jobs at all (explaining what a
  sync job is and offering creation when permitted), no jobs matching the search or filters
  (offering to clear them), and a failed load (explaining the problem and offering a retry).
- **FR-014**: The list MUST offer a manual refresh. While the page is visible and at least one
  listed job is running, it MUST refresh automatically every 30 seconds, and it MUST stop doing so
  when no listed job is running or the page is hidden. The automatic refresh MUST:
  - be suspended while selection mode is on;
  - offer a control to pause and resume it (WCAG 2.2.2);
  - pause after 15 minutes without user interaction (pointer, touch, keyboard or scrolling), or
    after the session's idle lifetime if that is shorter, with an announced notice and a "Resume"
    action, so that it never keeps an idle session alive (UI 001 FR-033);
  - announce nothing on its own.

  After any change made in this app, the affected jobs MUST be shown with their new values without
  a manual refresh.
- **FR-015**: Opening a job MUST show a details screen with its identifier, state, last run, last
  result, creation and last change times, every setting grouped like the form (FR-016), and the
  actions the user may perform: edit, activate or deactivate, schedule next run, open the run log
  and delete. For administrators it MUST offer a History action that opens the audit log screen of
  feature 001 filtered to this job (target type sync job, target ID the job's identifier), to see
  who changed it.

#### Create and edit form

- **FR-016**: The create form and the details screen MUST group fields into the sections below. On
  the details screen each section except "Target mailbox" MUST have its own edit and save
  (`docs/conventions.md`, Editing and conflicts):
  - **Target mailbox** (FR-020);
  - **Source**: host, port, encryption (SSL, STARTTLS, plain), remote username, remote password;
  - **Schedule**: interval in minutes, active;
  - **Folders**: subfolder on the destination, exclusion pattern, automap folders, subscribe all
    folders;
  - **Duplicates and deletion** (advanced): delete duplicates on the destination, skip duplicate
    messages across folders, delete from source when completed, delete messages on the destination
    that are not on the source;
  - **Limits and timeouts** (advanced): maximum message age in days (0 = no limit), maximum bytes
    per second (0 = unlimited), timeout for the remote host, timeout for the local host;
  - **Expert options** (advanced): custom parameters, simulate synchronisation (dry run).
- **FR-017**: In the create form and on the details screen, below tablet width the advanced
  sections MUST start collapsed and the others open. On wider screens all sections MUST start
  open. Each collapsed section header MUST state how many of its values differ from the defaults.
  A section containing a field with an error MUST open automatically. Sections MUST be operable by
  keyboard and expose their expanded state to assistive technology.
- **FR-018**: The create form MUST start with the creation defaults of API 008's capabilities read
  (FR-055), for every role. Today these are: encryption SSL, interval 20 minutes, active, automap
  on, subscribe all on, delete duplicates on the destination on, delete from source, delete on
  destination, skip cross-folder duplicates and simulate off, maximum age 0, maximum bytes per
  second 0, both timeouts 600 seconds, subfolder and custom parameters empty, and the exclusion
  pattern `(?i)spam|(?i)junk`, as in the legacy form; the user can clear it.
- **FR-019**: The port, which the API requires without a default, MUST start as the standard port
  of the chosen encryption (993 for SSL, 143 for STARTTLS and plain) and follow encryption changes
  until the user edits the port themselves.
- **FR-020**: Administrators and domain administrators MUST choose the target mailbox on creation
  from a picker that searches the mailboxes in their scope on the server as they type, so that it
  works with thousands of mailboxes. The picker MUST offer only mailboxes, never resources or
  aliases. Mailbox users MUST NOT be offered a choice; their own mailbox is shown as the target. On
  the details screen the target mailbox MUST be shown and MUST NOT be changeable.
- **FR-021**: Each field MUST show its allowed range or format as help text, with the ranges and
  lengths taken from the capabilities read (FR-055). Today these are: host name or IPv4 address,
  port 1–65535, interval 1–43800 minutes, maximum age 0–32000 days (0 = no limit), maximum bytes
  per second 0–125000000 (0 = unlimited), timeouts 1–32000 seconds, exclusion pattern as a regular
  expression, custom parameters written as `--param=value` and separated by spaces, with the
  options allowed on this server. The app MUST check required fields, maximum lengths (today: host,
  remote username, remote password and subfolder 255, exclusion pattern 500, custom parameters 512
  characters) and numeric ranges before sending; the API's validation is authoritative.
- **FR-022**: Validation errors from the API MUST be shown on their fields, translated from the
  error's rule code and parameters (feature 001's convention). An error summary at the top of the
  form MUST be announced and link to each invalid field, and focus MUST move to it on a failed
  submission. Unknown rule codes MUST read as a generic "invalid value". A refused custom parameter
  MUST name the refused option, and an invalid exclusion pattern MUST say that the pattern is not a
  valid regular expression.
- **FR-023**: When the API refuses a creation or an edit because another job with the same target
  mailbox, remote username and host exists, the form MUST say so, keep the entered values and offer
  to open the existing job that the API names.
- **FR-024**: Switching on "Delete from source when completed" or "Delete messages on destination
  that are not on source" MUST show an inline warning that these options delete mail permanently.
  The simulate option MUST explain that a simulated run copies nothing.
- **FR-025**: Each copying option in the Folders and advanced sections MUST show the name of the
  underlying imapsync option (for example `--delete2duplicates`) as secondary text, as legacy does.
- **FR-026**: Saving a section MUST send only the changed settings, together with the version the
  details screen was loaded with. When the API reports that the job changed in the meantime, the
  app MUST say so, keep the user's input in the section, reload the job, mark the values that
  changed, and let the user save again. It MUST NOT merge automatically or offer "overwrite
  anyway".
- **FR-027**: Leaving the create form, or a section with unsaved changes, MUST ask for
  confirmation.
- **FR-028**: A successful creation MUST be confirmed with an announced message and lead to the
  job's details screen. A successful section save MUST be announced, close the section's edit mode
  and show the saved values.

#### Remote password

- **FR-029**: The remote password MUST NOT appear on any screen, list, details view, confirmation,
  log header or address after it has been saved. The app never asks the API for it.
- **FR-030**: On edit, the password field MUST start empty and state that a password is saved and
  that leaving the field empty keeps it. An empty field MUST be left out of the request; a
  non-empty field replaces the stored password.
- **FR-031**: The password field MUST be masked by default and offer a reveal control with an
  accessible name and state. Leaving the form MUST mask it again.
- **FR-032**: The remote username and password fields MUST be marked so that the browser neither
  fills in the user's own saved sign-in credentials for this server nor offers to save the remote
  password as a credential for this site.
- **FR-033**: Form contents, including the remote password, MUST NOT be written to browser storage,
  the page address or logs, and MUST be discarded when the form closes or is saved successfully.
- **FR-034**: The password field MUST carry the legacy notice that the password is stored on the
  server in readable form.
- **FR-035**: The app MUST NOT send the remote password to any third party, including breach-check
  services.

#### Activate, deactivate and schedule next run

- **FR-036**: Users who may manage sync jobs MUST be able to activate and deactivate a job, and to
  schedule its next run, from the list (card or row actions) and from the details screen.
  Deactivating MUST ask one explicit confirmation that names the job, says that it will not run
  until it is activated again and, for a running job, that the run in progress finishes on its own;
  activating and scheduling the next run need no confirmation. Activate and deactivate MUST send the
  version the screen shows; when the job changed in the meantime, the app MUST say so, show the
  job's current values and let the user retry. Schedule next run sends no version. The result MUST
  be announced and shown in the list.
- **FR-037**: Users MUST be able to enter a selection mode, select jobs individually or all jobs on
  the current page, and apply activate, deactivate, schedule next run or delete to the selection.
  Deactivating a selection asks one explicit confirmation that lists the jobs, as in FR-036.
  The selection covers the current page only and MUST clear when the page, search, filters, sort or
  page size change. The app MUST send API 008's bulk operation once, naming every selected job with
  its version as listed (FR-036; the version is not checked for schedule next run), and MUST NOT
  send more jobs than the capabilities read's bulk limit. It MUST show that the action is in
  progress and end with a summary that counts the successes and names each other job with its
  translated outcome and reason (not found, refused, changed in the meantime, failed). Failed,
  refused and outdated jobs MUST stay selected so that the action can be retried. A dropped
  connection MUST be reported as "outcome unknown" for every selected job, MUST clear the selection
  and MUST NOT be retried automatically.
- **FR-038**: When the user deactivates, edits, reschedules or deletes a job that is running, the
  confirmation or result MUST state that the run already in progress is not interrupted and
  finishes on its own.

#### Delete

- **FR-039**: Deleting MUST require a confirmation that lists every affected job by source account,
  host and target mailbox and states that mail already copied stays in the mailbox. Deleting
  several jobs MUST also require their number to be typed. The deletion MUST send each job's version
  as in FR-036; when a single deletion is refused as outdated, the app MUST reload the job and ask
  for confirmation again. The confirming control MUST be visually marked as destructive, and
  cancelling MUST return focus to the control that opened the confirmation.
- **FR-040**: After a deletion the list MUST no longer show the job. Deleting from the details
  screen MUST return to the list.

#### Run log

- **FR-041**: The run log MUST be reachable from the last result in the list and from the details
  screen. Below tablet width it MUST open as a full-screen view; on wider screens it MUST open as a
  large dialog. Its header MUST show the source, target mailbox, last run time and last result.
- **FR-042**: The log MUST be shown read-only, verbatim, with whitespace preserved, in a
  fixed-width font, and MUST never be interpreted as markup.
- **FR-043**: Long lines MUST wrap by default. A toggle MUST switch wrapping off, in which case only
  the log area scrolls sideways. The log area MUST be scrollable by keyboard and have an accessible
  name.
- **FR-044**: A "Copy" action MUST copy the whole log and announce success, or say that copying is
  not available.
- **FR-045**: The log view MUST distinguish a job that has never run ("No log yet"), a run that
  produced no output, and a job that is running now (the log shown is the previous run's, with a
  refresh action).
- **FR-046**: The log MUST be fetched only when it is opened, never with the list. Logs of at least
  5 MB MUST stay readable and scrollable.

#### Errors and feedback

- **FR-047**: Errors MUST be handled from the API's problem details as the shell defines (feature
  001), with a translated message for each error type API 008 documents: sync job not found and
  permission flag required (`syncjobs`) as in FR-003, sync job already exists as in FR-023 (with a
  link to the existing job the problem names), invalid custom parameter, invalid exclusion pattern,
  immutable target and validation failed as in FR-022, and outdated version as in FR-026 and
  FR-036. A network failure or an unexpected server error MUST offer a retry, and any other problem
  MUST show a generic translated message. Sign-in expiry is handled by the shell.

#### Mobile, accessibility and translation

- **FR-048**: Every screen MUST be designed for a 360 px wide touch screen first. Touch targets MUST
  be at least 44 × 44 px, pinch-zoom MUST stay enabled, and the create action MUST be reachable
  without scrolling to the end of the list.
- **FR-049**: On phones, numeric fields MUST bring up a numeric keyboard, and the host, username,
  pattern and parameter fields MUST NOT be auto-capitalised or auto-corrected.
- **FR-050**: Every screen MUST meet WCAG 2.2 AA in light and dark themes: full keyboard operation,
  visible focus, labelled controls, table headers on wide screens, a heading per card, dialogs that
  keep and then return focus, and announcements for saves, deletions, multi-job summaries, copying
  and changed result counts. Automated accessibility checks MUST report no violations on any screen
  of this feature.
- **FR-051**: Dates and times MUST be shown in the user's locale, with the full date and time
  available when a relative form ("5 minutes ago") is shown. Numbers MUST use the locale's
  grouping.
- **FR-052**: All text MUST come from translation files and be complete in English, Czech and
  Slovak. Legacy keys MUST be reused where the meaning is unchanged: the sync job titles
  (`mailbox.sync_jobs`, `user.sync_jobs`, `user.create_syncjob`, `add.syncjob`, `edit.syncjob`), the
  plain-text password notice (`add.syncjob_hint`), the field labels in `add.*` and `edit.*`, the
  list labels (`mailbox.owner`, `mailbox.last_run`, `mailbox.syncjob_last_run_result`,
  `mailbox.running`, `mailbox.waiting`, `mailbox.open_logs`, `mailbox.last_run_reset`,
  `mailbox.mins_interval`, `mailbox.excludes`), the result texts (`mailbox.syncjob_EX_OK`,
  `mailbox.syncjob_EXIT_*`, `mailbox.syncjob_check_log`) and the actions (`mailbox.activate`,
  `mailbox.deactivate`, `mailbox.remove`, `admin.refresh`, `edit.save`). Legacy texts that contain
  markup (`edit.subfolder2`, `edit.maxage`, `edit.maxbytespersecond`) MUST be replaced by new keys
  that separate the label from its hint, because the app does not render markup from translations.

#### Contract and testing

- **FR-053**: The feature MUST use only operations of the pinned mailcow-rest-v2 contract: feature
  008 for sync jobs and their capabilities, feature 001 for identity, permission flags and the
  audit log, feature 003's mailbox list for the target mailbox picker and filter, and feature 002's
  domain list for the domain filter. A capability missing from the contract MUST be specified in
  mailcow-rest-v2 first and never worked around.
- **FR-054**: Every user story MUST have end-to-end tests on a 360 px and a desktop viewport against
  a mock API whose responses are validated against the contract, including a test that the remote
  password never appears in the page, the address or browser storage.
- **FR-055**: The field limits, the creation defaults, the allowed encryption values, the bulk
  limit, the custom-parameter allow-list and whether the user may set custom parameters MUST come
  from API 008's capabilities read. The app MUST NOT hard-code them (`docs/conventions.md`, Where
  features meet). The standard ports of FR-019 are protocol constants, not server limits.
- **FR-056**: When the capabilities read reports that the user may not set custom parameters, the
  create form MUST NOT offer the field, and the details screen MUST show the stored value
  read-only with the reason ("only administrators may set custom parameters on this server").

### Key Entities *(include if feature involves data)*

- **Sync job**: identifier, target mailbox, source (host, port, encryption, remote username, a
  write-only remote password), interval, active state, folder options (subfolder, exclusion
  pattern, automap, subscribe all), duplicate and deletion options, limits and timeouts, custom
  parameters, simulate flag, running state, last run time, last result, version for change
  detection.
- **Last result**: success or failure plus a result code (recognised reasons or an unrecognised
  one) of the most recent finished run. Cleared by "schedule next run".
- **Run log**: the text output of the most recent run of one job, possibly empty or partial.
- **Target mailbox**: a mailbox from feature 003 in the user's scope. A job belongs to exactly one
  and cannot be moved to another.
- **Identity**: the signed-in user's role, scope and sync-jobs permission flag (feature 001).
- **Sync-job capabilities**: the field limits, creation defaults, allowed encryption values, bulk
  limit, page sizes, custom-parameter allow-list and whether the user may set custom parameters, as
  configured on the server for the signed-in user (API 008 FR-030).

### Legacy Parity

Legacy reference: FeldHost fork `feldhost-202609a` of mailcow-dockerized (upstream tag `2026-09a`).
The sync job files are identical to upstream: `templates/mailbox/tab-syncjobs.twig`,
`templates/user/Syncjobs.twig`, the add modals in `templates/modals/mailbox.twig` and
`templates/modals/user.twig`, `templates/edit/syncjob.twig`, the log modal, `inc/ajax/syncjob_logs.php`,
and `draw_sync_job_table` in `js/site/mailbox.js` and `js/site/user.js`.

| Legacy screen or element | New requirement | Status | Reason |
|---|---|---|---|
| "Sync jobs" tab of the mailbox page (administrators, domain administrators) | FR-001, FR-002, FR-005–FR-015 | Improved | A section of its own with cards on phones, search, filters and defined states instead of a collapsed DataTable |
| "Sync jobs" tab of the user page, shown only with the sync-jobs permission | FR-001, FR-002 | Matched | Same visibility rule |
| Domain administrator without the sync-jobs flag: tab shown, buttons disabled | FR-001, FR-003 | Changed | API 008 refuses every sync-job operation without the flag, so the entry follows the identity flag for every non-admin role (see Clarifications) |
| Table columns ID, owner, server (`user@host:port`), last run, last run result, log link, active, status; excludes and interval in the collapsed row | FR-005, FR-015 | Improved | Key facts on the card, everything else on the details screen |
| User table: also username, encryption, excludes, interval | FR-005, FR-015 | Matched | On the details screen |
| "Waiting" shown both for an idle job and for a job that never ran; inactive jobs also "Waiting" | FR-005, FR-006 | Improved | "Never" for the last run; separate running, waiting and inactive states |
| Last run as a raw server timestamp | FR-051 | Improved | Locale formatting |
| Result icon coloured green or red plus translated exit status, "Check log" for unknown | FR-006, FR-007 | Improved | Same texts, not colour-only, direct link to the log |
| "Refresh" button | FR-014 | Improved | Plus automatic refresh while a job runs |
| "Toggle all" and "Actions" menu: Schedule next (administrator tab only), Activate, Deactivate, Remove | FR-036, FR-037 | Improved | Selection mode on phones, one bulk request with per-job versions and a per-job summary; "Schedule next" for every permitted role |
| "Expand all" / "Collapse all" (DataTables row collapse) | FR-008 | Dropped | Cards and the details screen replace collapsed rows |
| Per-row Edit and Remove buttons | FR-015, FR-036, FR-039 | Matched | Card/row actions and details screen |
| Sort and paging remembered in browser storage (`stateSave`) | FR-010 | Improved | Kept in the address instead, so links and back navigation work |
| Add sync job modal (administrator): mailbox select with live search and all fields in one list | FR-016–FR-024 | Improved | Sections, advanced options collapsed on phones, server-side mailbox search |
| Add sync job modal (user): no mailbox select | FR-020 | Matched | Own mailbox shown as target |
| Default port 143 with default encryption SSL | FR-019 | Improved | Port follows encryption (see Clarifications) |
| User modal: simulate (dry run) on by default; administrator modal: off | FR-018 | Changed | Off for every role (see Clarifications) |
| User modal: remote password checked against haveibeenpwned.com | FR-035 | Dropped | Third-party request, and the password belongs to another server |
| User modal: all inputs, including the remote password, cached in browser storage (`data-cached-form`) | FR-033 | Dropped | Credentials must never be stored in the browser (constitution V) |
| Plain-text password notice (`add.syncjob_hint`) | FR-034 | Matched | Same text |
| imapsync option names next to the checkbox labels | FR-025 | Matched | Secondary text |
| Range hints under numeric fields | FR-021 | Matched | Plus pre-submission checks |
| Validation failures reported as "Access denied or invalid form data" in a toast | FR-022, FR-023 | Improved | Field-level, translated errors |
| Edit sync job page: password field empty, target not editable | FR-016, FR-020, FR-026, FR-029, FR-030 | Improved | Sections with their own save on the details screen, explicit "saved, leave empty to keep" hint, change detection with marked values, unsaved-changes guard |
| Log modal: editable textarea, untranslated title "Log", "-" when empty | FR-041–FR-046 | Improved | Read-only, translated, copy, wrap toggle, distinct empty states |
| Success messages such as "Deleted syncjob ID %s" | FR-028, FR-037, FR-040 | Matched | Announced confirmations and multi-job summaries |
| Delete without naming the affected jobs | FR-039 | Improved | The confirmation lists the jobs; several jobs need their number typed |

### API Dependency

This feature depends on mailcow-rest-v2 feature 008, "Sync jobs" (`specs/008-sync-jobs/spec.md`),
whose contract (module `api/modules/sync-jobs/`, last changed in commit `0fb4f73`) the plan pins.
It also uses feature 001 (identity, the `syncjobs` permission flag, problem details, validation
rule codes, the audit log with its target filters), feature 003 (the mailbox list with search, for
the target mailbox picker and filter) and feature 002 (the domain list with search, for the domain
filter).

| UI capability | API 008 requirement |
|---|---|
| Entry visibility, "not permitted" and "not found" pages | FR-001 to FR-005 (forbidden without the flag, "not found" outside scope) |
| List with pagination, total, search, filters by mailbox, domain, active, running and last result, sorting | FR-011 to FR-015 |
| Pre-filtered list for one mailbox | FR-011 (list scopeable to a single mailbox) |
| Card and details content, state, last run, last result, result codes | FR-007, FR-008, FR-010 |
| Run log, fetched separately and shown as plain text | FR-009, FR-015 |
| Create with documented defaults and field rules | FR-016, FR-017, FR-019 |
| Edit with partial updates, the write-only password and the immutable target | FR-016, FR-018 |
| Activate, deactivate, schedule next run and delete one job | FR-016 |
| Activate, deactivate, schedule next run and delete a selection with one bulk request | FR-023, FR-024 |
| Change detection with version tags; rescheduling without one | FR-020, FR-021 |
| Field-level and typed errors | FR-027 and feature 001 FR-049, FR-055 |
| Limits, defaults, bulk limit and the custom-parameter permission | FR-006, FR-030 (capabilities read) |
| History action for administrators | FR-025, FR-026 |

**API gaps**: none open. The three gaps of the first draft are closed by API 008's contract: the
capabilities read reports whether the user may set custom parameters (FR-006, FR-030 there), an
edit that sends a different target mailbox is refused with `immutable` (FR-016 there), and the
exclusion pattern defaults to `(?i)spam|(?i)junk` (FR-017 there).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a 360 px wide phone, a user identifies every failed job in a list of 50 jobs in
  under 15 seconds, without horizontal scrolling.
- **SC-002**: A first-time user who has the remote account's details at hand creates a sync job
  with the default options on a phone in under 1 minute, as API 008 SC-008 expects.
- **SC-003**: In automated tests, the remote password appears in 0 rendered pages, page addresses
  or browser storage entries, and in no request other than the create or edit request that sets it.
- **SC-004**: Every screen of this feature shows 0 automated accessibility violations in light and
  dark themes on both test viewports.
- **SC-005**: 100% of this feature's texts exist in English, Czech and Slovak.
- **SC-006**: For 100% of the documented validation rules of the create and edit operations, the
  error appears on the matching field in the user's language.
- **SC-007**: A 5 MB run log opens in under 3 seconds on a mid-range phone and scrolls without
  visible stalls.
- **SC-008**: A multi-job action on 25 jobs reports the outcome of all 25 jobs, including failures.
- **SC-009**: Every legacy element in the Legacy Parity table is matched, improved or dropped with a
  stated reason.

## Assumptions

- Feature 001 of mailcowui-ng provides the shell, sign-in, navigation, identity, error handling
  and session expiry handling; this feature does not specify them again.
- The identity reports the `syncjobs` permission flag for domain administrators and mailbox users;
  administrators have every flag (feature 001 contract).
- The mailbox list of API feature 003 supports server-side search, which the target mailbox picker
  uses.
- API feature 008 is the behavioural source of truth, through its published contract, which the
  plan pins; any difference found later is resolved in the API first.
- Only the most recent run's log is kept, as in legacy; there is no run history.
- Runs are scheduled by the server's runner, which API 008 never triggers directly; the app
  neither starts runs immediately nor predicts the next run time.
- A job cannot be moved to another target mailbox; renaming or deleting the mailbox is handled by
  feature 003 and the API.
- Out of scope: fields that neither legacy UI nor API 008 lets users set (authentication
  mechanism, `regextrans2`, `domain2`), the server-wide list of allowed custom parameters, starting
  or stopping a run directly, a run history beyond the last log, and the audit log screen itself
  (feature 001).
- The audit log screen of feature 001 can be opened filtered to one sync job (API 008 FR-025).
- Jobs created or changed in the legacy UI appear here at the next refresh, and vice versa.
