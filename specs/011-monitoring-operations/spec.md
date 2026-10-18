# Feature Specification: Monitoring and Operations

**Feature Branch**: `main` (no feature branches, constitution 1.1.0)

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Monitoring and operations screens for mailcowui-ng, the mobile-first
web app for mailcow-dockerized, built only on mailcow REST API v2 feature 011 (Monitoring and
operations). Administrators only. A dashboard shows the host (host name, architecture, installed
version with the update status, system time and time zone, uptime, public IP addresses on demand),
live processor and memory figures with charts, the mail storage disk usage, and one card per
mailcow container with its state, health and start time; a card expands into live disk and network
throughput charts and offers start, stop and restart where the API allows them, with a confirmation
for the destructive ones and an explicit 'outcome unknown' state when an action times out. A logs
screen reads every log type the API offers with time range, search, severity and type-specific
filters, loads older entries without duplicates and stays readable on a phone. A mail queue screen
lists, filters and sorts queued messages, shows a message's content, and delivers, holds, releases
and deletes selected messages in one request, flushes the queue and deletes all queued mail after a
confirmation. A ban service (Fail2ban) screen edits the ban parameters, allowlist, denylist and
filter rules, lists active and permanent bans and lifts, allowlists or denylists them, and rotates
the public ban list address. An Rspamd view shows the scan history and statistics with an
accessible chart and a table alternative. Live data is refreshed by polling at the API's
recommended interval, paused while the page is hidden, with freshness indicators and respect for
reduced motion. Every view has loading, empty and error states, works at 360 px with touch, meets
WCAG 2.2 AA and is translated into English, Czech and Slovak. Replaces the legacy dashboard (System
& Containers tab and log tabs), the Queue Manager and the Fail2ban section of System ›
Configuration."

## Clarifications

### Session 2026-10-18

- Q: Where do the new screens live, and should the dashboard replace the administrator's home
  screen, as the legacy UI sends administrators to its dashboard after sign-in? → A: The
  administrator navigation gets a "System" group with Dashboard, Logs (including Rspamd), Mail queue
  and Fail2ban. The home screen of UI feature 001 stays the landing screen; this feature does not
  change it. (agent decision: UI feature 001 already settled on its home screen as the landing
  screen; a live dashboard as the landing screen would start polling the container service at every
  administrator sign-in, which constitution VII discourages; the dashboard is one tap away.)
- Q: When does the app refresh live data on its own, and how can the user stop it? → A: Every
  5 seconds, the interval the API contract recommends, for the host figures, the container list and
  each expanded container; the mail storage every 60 seconds; the version and update status once per
  visit. Refreshing stops while the page is hidden or the dashboard is left, and restarts at once
  when it is shown again. The dashboard has a "Pause live updates" control. After 15 minutes without
  any user interaction, live updates pause on their own, with a notice and a Resume action, so that an
  unattended dashboard does not keep a session signed in for ever. (agent decision: API 011 FR-012
  recommends 5 seconds and states the freshness limits; legacy polls every 5 seconds; WCAG 2.2
  success criterion 2.2.2 requires a way to pause content that updates on its own; every API request
  resets the session's idle timer (API 001), so endless polling would defeat the configured session
  lifetime; mail storage is at most 60 seconds fresh, so polling it faster would refetch without
  reason.)
- Q: When is a live figure shown as outdated? → A: When its age is more than its freshness limit
  plus two of its refresh intervals: host figures after 20 seconds, container states after
  15 seconds, container resource samples after 25 seconds, mail storage after 180 seconds. Ages are
  measured against the host's current time from the overview, not the device clock. (agent decision:
  marking data outdated as soon as it passes the API's freshness limit would flag it between almost
  every two polls; two missed refreshes are a real problem worth showing; a wrong device clock must
  not make data look outdated.)
- Q: Which actions need a confirmation, and how strong must it be? → A: Stop and restart: a dialog
  naming the container and the interruption, and for protected containers also that the app itself
  may be unavailable for a moment. Delete selected messages: a dialog with the number of messages.
  Delete all: a dialog with the current number of queued messages, read when it opens, and a Delete
  button that stays disabled until the administrator ticks "I understand that all queued messages,
  including held ones, are deleted permanently". Denylisting a network from a ban, resetting the
  filter rules, generating a new ban list address and resetting a rate limit: a dialog naming the
  object and the consequence. Start, deliver now, hold, release, flush, lifting a ban (with or
  without allowlisting) and removing a denylist entry: no confirmation. (agent decision: API 011
  FR-017, FR-042, FR-051 and FR-055 mark stop, restart, delete, delete all, rule reset and rotation as
  destructive; constitution II requires confirmation that shows what is affected; a denylist entry
  bans permanently; deleting the whole queue is irreversible and affects every user, so it gets a
  stronger step than a dialog; lifting and releasing undo harm and must stay fast; legacy confirms
  only restart and delete.)
- Q: Can an administrator act on more queued messages than one page shows, for example all messages
  of a spam outbreak? → A: Yes, up to 1,000 at a time. Besides selecting messages on the current
  page, the administrator can select all messages that match the current search and filters. When
  more than 1,000 match, the app selects the first 1,000 in the current sort order and says so. Each
  action is one request with a result per message. (agent decision: API 011 FR-040 accepts up to
  1,000 queue IDs in one request and its list returns up to 1,000 per page; legacy acts only on the
  selected rows; acting on more than 1,000 would mean repeating requests, which the API does not
  offer as one operation, so it is reported as an API gap instead of worked around.)
- Q: How does the administrator page through a log, and does a log refresh on its own? → A: On every
  screen size the newest 50 entries are shown first and "Load older entries" adds the next 50 below,
  asking the API for entries older than the oldest one shown, so new entries never cause duplicates.
  There are no page numbers. Logs never refresh on their own; a Refresh action loads the newest
  entries again and the screen shows when they were loaded. (agent decision: API 011 FR-026
  documents this way of loading older entries; page numbers shift while new entries arrive; logs are
  read at request time and the contract recommends polling only the overview and resource usage;
  legacy has the same manual refresh with "+100" and "+1000".)
- Q: How is a queued message's content shown, given that it can be large and that every view is
  audited? → A: It is fetched when the viewer opens and discarded when it closes. The viewer shows the
  queue ID, a notice that the view is recorded in the audit log, and the content verbatim in a
  fixed-width font. Only the first 256 KiB are shown at first, with an action that shows the rest;
  copying always copies the complete content. (agent decision: API 011 FR-039 and FR-062 return the
  complete content and audit every view; legacy shows it in a 40-row text area; keeping personal data
  in memory after the viewer closes serves no purpose; rendering several megabytes of text at once
  freezes mid-range phones.)
- Q: How are release notes displayed, and what is shown when the update check is disabled? → A:
  Release notes are shown with their Markdown formatting (headings, emphasis, lists, code, quotes,
  tables and links). Any HTML in them is shown as text, images are not loaded and appear as a link
  with their description, and links open in a new window and are marked as external. When the API
  reports the update check as disabled, the version line shows only the version. (agent decision:
  API 011 FR-020 says release notes are externally authored Markdown to render safely; constitution V
  forbids rendering unsanitised HTML and the constitution's privacy rule forbids requests to third
  parties, which remote images would cause; the FeldHost deployment disables the check and its
  dashboard shows no update line.)
- Q: What does the Rspamd chart show, and from which data? → A: The count per action from the API 011
  statistics, with every action as Rspamd names it, as horizontal bars each labelled with its count
  and percentage, a one-sentence text summary and a table with the same figures. The merged action
  figures of API feature 006 are not used. (agent decision: API 011 FR-035 returns the per-action
  counts, so no second API feature is needed; bars with labels can be read without colour and on a
  narrow screen, unlike the legacy doughnut with percentages inside the slices; the constitution
  requires charts to be accessible and lazy-loaded.)
- Q: How are the ban service settings edited on a phone? → A: Section by section (parameters, lists,
  external enforcement), each with its own Edit and Save, sending only that section's values with the
  version tag. Durations are entered as a number and a unit (seconds, minutes, hours, days) and shown
  in the largest unit that represents them exactly. The allowlist and the denylist are multi-line
  fields with one entry per line, a count, and every entry the API refuses listed below the field
  with its line. While a listed ban waits to be lifted, the active bans refresh every 5 seconds for
  at most 60 seconds. (agent decision: UI feature 002 edits section by section and API 011 FR-045
  accepts partial changes; legacy forces seconds, so 10,000 seconds has to be worked out by hand;
  lists can hold hundreds of networks that are pasted from elsewhere, which a per-entry editor makes
  slow; API 011 FR-053 says lifts take about 10 seconds, so a short bounded refresh shows the result
  without polling for ever.)
- Q: The legacy rate limit log offers "Remove hash", which resets a rate limit. Does this feature
  offer it, although the reset belongs to API feature 006? → A: Yes. Each rate limit entry offers
  "Reset rate limit", which uses API 006's reset operation after a confirmation that the counter is
  reset completely and the log entries of that rate limit are removed. "Show entries of this rate
  limit" searches the log for the entry's hash. (agent decision: API 011 FR-031 returns the hash
  precisely so that a client can reset the limit with API 006 FR-057; the rate limit log lives only in
  this feature, so leaving the action to UI feature 006 would drop a legacy capability with no screen
  to host it.)

### Plan alignment 2026-10-18

The API 011 contract closed several gaps this spec had listed. The plan aligned the spec as follows
(agent decisions, constitution I and `docs/conventions.md` "Capabilities and limits"):

- Q: Where do the polling interval, the freshness limits, the log lengths and the limits come from?
  → A: From the API's monitoring capabilities read at run time. The outdated thresholds are each
  freshness limit plus two of its refresh intervals, which gives the values above with the API's
  defaults (FR-018, FR-022, FR-040, FR-052, FR-055, FR-069, FR-071).
- Q: Is "Show public IP" always offered? → A: No. The capabilities say whether the IP check is
  enabled; the action is offered only then, as in legacy, and otherwise the host section explains
  where to switch it on (FR-029).
- Q: What can the app show now that the API reports counts per queue, the caller's own address and
  each container's role? → A: The queue header and filter show the count per queue, and "Delete all"
  states the exact number of queued messages (FR-050, FR-058); a denylist entry or denylisting that
  covers the administrator's own address gets a warning (FR-064, FR-069); container cards name the
  role, and the restart confirmation warns according to it (FR-008, FR-012).
- Q: How strong are the queue deletion confirmations, given that `docs/conventions.md` asks for the
  number of objects to be typed for bulk deletions? → A: The conventions are binding. Deleting
  selected messages needs the number of messages typed; "Delete all" needs the number of queued
  messages typed and the acknowledgement checkbox (FR-056, FR-058). (orchestrator decision; this
  replaces the corresponding part of the confirmation clarification above.)
- Q: What if the session's idle timeout is shorter than the 15-minute inactivity pause? → A: Live
  updates pause after the shorter of the two, so that an unattended dashboard keeps a session alive
  for at most one idle timeout beyond what the session itself allows (FR-021).
- Q: How are the details of this feature's audit records presented, given that the contract leaves
  them undescribed? → A: As stored, in the audit log's generic details view, with nested values
  readable and long lists collapsed, until the contract describes them (FR-075, gap 10).
  Constitution I forbids relying on undocumented shapes; UI feature 002 decided the same for its
  records.

## User Scenarios & Testing *(mandatory)*

Terms used throughout:

- **Container**: one service container of this mailcow installation, for example
  `postfix-mailcow`, identified by its service name.
- **Protected container**: a container the API refuses to stop, and in the case of the API's own
  container also to restart.
- **Live data**: figures the API measures and the app refreshes on its own while they are visible:
  host figures, container states and container resource usage, and the mail storage usage.
- **Freshness**: how old a figure is, measured from the collection time the API reports.
- **Outcome unknown**: the state of an action whose answer did not arrive, because the API reported
  a timeout with an unknown outcome or the connection was lost. The action may or may not have
  happened.
- **Ban service**: mailcow's automatic firewall, which the legacy UI calls "Fail2ban" and whose
  container is `netfilter-mailcow`. It bans networks after repeated failed logins.
- **Queued message**: an e-mail waiting in Postfix's queue, identified by its queue ID.

### User Story 1 - See the state of the server at a glance (Priority: P1)

An administrator opens the dashboard on a phone. At the top they see the host name, the processor
architecture, the installed mailcow version, the system time with its time zone and the uptime.
Below, the processor and memory usage are shown as figures and as small live charts, and the mail
storage disk shows how much space is used. Then one card per container shows its name, image,
whether it is running, its health and when it was started. A summary says how many containers run
and how many do not, and the administrator can show only the containers that are not running. The
figures update on their own every few seconds, and each section says how old its data is.

**Why this priority**: The dashboard answers "is everything running?", which starts every
operations task. It changes nothing, so it is also the safest first slice, and it replaces the
legacy System & Containers tab on its own.

**Independent Test**: Against a mock API with one stopped container, one unhealthy container and
figures that change between polls, open the dashboard at 360 px and at desktop width. Compare every
value with the mock data, advance time and confirm the figures and charts update, hide the page and
confirm that no further requests are made, then show it again.

**Acceptance Scenarios**:

1. **Given** a running installation, **When** an administrator opens the dashboard, **Then** it
   shows the host name, architecture, installed version, the host's current time in its configured
   time zone with the zone's name, the uptime, the number of processor cores, processor usage,
   total memory, memory usage, swap usage and the mail storage disk with device, used and total
   space and percentage used.
2. **Given** a 360 px wide screen, **When** the dashboard is shown, **Then** no content needs
   horizontal scrolling, the figures are readable without the charts, and each container is a card
   with its name, image, state, health when reported and start time.
3. **Given** the dashboard open and visible, **When** 5 seconds pass, **Then** the host figures,
   the container states and the charts show the newly collected values, and each section shows how
   long ago its data was collected.
4. **Given** the SOGo container stopped, **When** the dashboard is shown, **Then** its card says
   "Stopped" in text, the summary counts it as not running, and selecting "Not running" lists only
   that container.
5. **Given** the page hidden in a background tab, **When** a minute passes, **Then** the app makes
   no status request. **When** the page becomes visible again, **Then** the app requests fresh data
   at once and continues updating.
6. **Given** the API stops answering, **When** the next updates fail, **Then** the last values stay
   visible, are marked as outdated with their age, and a notice says that updating failed and is
   being retried.
7. **Given** a mail storage measurement that the API reports as unavailable, **When** the dashboard
   is shown, **Then** the storage section says "unavailable" and never shows zeros. **Given** a
   measurement marked as approximate, **Then** the figures are marked as approximate.
8. **Given** a domain administrator or a mailbox user, **When** they open the dashboard address,
   **Then** the shell of UI feature 001 shows that the page is not available for their role, and no
   navigation entry of this feature is offered to them.
9. **Given** the dashboard updating, **When** the administrator chooses "Pause live updates",
   **Then** no further status request is made, the dashboard says since when updates are paused, and
   "Resume" requests fresh data at once. **Given** 15 minutes without any interaction, **Then**
   updates pause on their own with a notice and a Resume action.

---

### User Story 2 - Restart, stop and start a container (Priority: P1)

An administrator sees that SOGo misbehaves. They open its card, choose Restart, read in the
confirmation that the restart interrupts the groupware for every user and that a graceful restart
can take a while, and confirm. The card shows that the restart is running. When the API answers,
the card shows the outcome and the container's new state and start time, and the result is
announced. On a small server they stop the antivirus scanner and later start it again. When the
API cannot say whether an action happened, the app says exactly that and shows the container's
current state instead of guessing.

**Why this priority**: Restarting a container is the most common fix in mailcow operations, and
the legacy dashboard offers it on every container.

**Independent Test**: Against a mock API, start, stop and restart containers in each state,
including a protected container and the API's own container. Make the mock answer with success,
"already in that state", a failure with the container service's message, a protected refusal, a
timeout with an unknown outcome and a dropped connection. Check the actions offered, the
confirmation, the progress, every outcome shown and the state afterwards, at 360 px and at desktop
width.

**Acceptance Scenarios**:

1. **Given** a running SOGo container, **When** the administrator opens its card, chooses Restart
   and confirms, **Then** the card shows that the restart is in progress, no second action can be
   started on that container, and when the API answers the card shows "Restarted" with the new
   start time and the outcome is announced to screen reader users.
2. **Given** a protected container such as the database, **When** its card is opened, **Then** Stop
   is not offered, Restart is, and the card explains that the container is protected.
3. **Given** the API's own container, **When** its card is opened, **Then** neither Stop nor Restart
   is offered, and the card explains why.
4. **Given** a restart that the API answers with a timeout whose outcome is unknown, **When** the
   answer arrives, **Then** the card shows "Outcome unknown" with an explanation, the app reads the
   container's state again at once and shows it, and the action is not repeated on its own.
5. **Given** a stopped antivirus container, **When** the administrator chooses Start, **Then** no
   confirmation is asked, and the card shows the container running once the API answers.
6. **Given** a running container and a Start request that the API answers as "already running",
   **When** the answer arrives, **Then** the app says the container was already running and nothing
   changed.
7. **Given** a stop that the container service refuses with a message, **When** the answer
   arrives, **Then** the app shows a translated "container action failed" message and the service's
   own message as technical detail.
8. **Given** a confirmation dialog open on a phone, **When** the administrator cancels or presses
   Escape, **Then** nothing is sent and the focus returns to the action that opened the dialog.

---

### User Story 3 - Read and search mailcow's logs (Priority: P1)

An administrator investigates why a customer's mail bounced. On their phone they open Logs, choose
the Postfix log, search for the customer's address, narrow it to the last hour and to warnings and
errors, and read the entries as compact cards whose long messages wrap and expand. They load older
entries a page at a time. They switch to the Dovecot, SOGo, netfilter, autodiscover, watchdog, ACME,
cron, rate limit, legacy API request, legacy UI activity and login logs in the same way, each with
the fields and filters that fit it.

**Why this priority**: Logs are the main debugging tool, and the legacy dashboard offers 13 log
views. The new app cannot replace the legacy dashboard without them.

**Independent Test**: Against a mock API with every log type, entries of every severity, decoded
messages with line breaks, masked secrets, very long messages and more entries than one page, open
each log type at 360 px and at desktop width. Use every filter, the search, the sort order and
"load older" while new entries are added to the mock, and compare what is shown with the mock data.

**Acceptance Scenarios**:

1. **Given** 10,000 Postfix entries, **When** the administrator opens the Postfix log, **Then** the
   newest entries are shown first with the total of 10,000, and "Load older entries" adds the next
   older entries below without duplicates, also when new entries arrived in the meantime.
2. **Given** entries mentioning `alice@example.org`, **When** the administrator types
   `ALICE@example.org` into the search, **Then** only the matching entries are listed once they stop
   typing, and the new count is announced.
3. **Given** entries of every priority, **When** the administrator selects the severity "Error",
   **Then** only error-class entries are listed, each marked "Error" in text and not by colour alone.
4. **Given** a 360 px wide screen, **When** a log is shown, **Then** each entry is a card with its
   time, severity and source on one line and the message below it, long tokens wrap instead of
   causing horizontal scrolling, and a message longer than a few lines can be expanded and copied.
5. **Given** a legacy API request entry whose data contained a password, **When** its details are
   opened, **Then** the value is shown as `*`, as the API returns it.
6. **Given** a search, filters and a log type, **When** the administrator reloads the page or opens
   the same address on another device, **Then** the same log, search and filters are shown.
7. **Given** a time range that contains no entries, **When** the log is shown, **Then** a "no
   matching entries" message with an action that clears the search and filters is shown.
8. **Given** a log the API cannot read because a mailcow service is unavailable, **When** it is
   opened, **Then** the app says the log is temporarily unavailable and offers a retry.
9. **Given** a rate limit entry, **When** the administrator chooses "Reset rate limit" and confirms,
   **Then** the rate limit is reset through API feature 006 and the log is refreshed without that
   rate limit's entries.

---

### User Story 4 - Manage the mail queue (Priority: P1)

An administrator gets a complaint that mail to a partner is delayed. In the mail queue they filter
the deferred queue by the partner's domain and see, for each message, the sender, the recipients,
the size, the age and the reason delivery was deferred. They open one message to read its headers.
Once the partner's server is back, they select the messages and choose "Deliver now", or flush the
whole queue. During a spam outbreak they filter by the compromised sender, put the messages on
hold, check one, and delete them after a confirmation that names how many messages are deleted. In
an emergency they delete every queued message after a stronger confirmation.

**Why this priority**: Stuck or unwanted queued mail is a frequent, time-critical task, and the
legacy Queue Manager is its only tool.

**Independent Test**: Against a mock API with messages in every queue, deferral reasons, a
truncated list and IDs that disappear between listing and acting, list, filter, sort and page the
queue at 360 px and at desktop width. View a message, apply each action to single messages and to
selections, flush and delete all, and check the request sent, the confirmations and every result
shown.

**Acceptance Scenarios**:

1. **Given** 3 deferred messages to `partner.example` among 8 queued messages, **When** the
   administrator filters the deferred queue by recipient `partner.example`, **Then** exactly the 3
   messages are listed, each with its recipients and their deferral reasons.
2. **Given** 4 selected messages of which 1 was delivered meanwhile, **When** the administrator
   chooses Hold, **Then** one request is sent, and the app reports 3 messages held and 1 no longer in
   the queue, and refreshes the list.
3. **Given** 2 selected messages, **When** the administrator chooses Delete, **Then** a confirmation
   names the number of messages and says that deletion cannot be undone, and Delete stays disabled
   until the administrator types that number. **When** they confirm, **Then** the messages are
   deleted and the result is announced.
4. **Given** a queued message, **When** the administrator opens it, **Then** its complete content is
   shown as plain text exactly as returned, never interpreted as markup, with a copy action and a
   notice that the view is recorded in the audit log.
5. **Given** a deferred queue, **When** the administrator flushes the queue, **Then** the app says
   that Postfix accepted the request and that delivery continues in the background, and refreshes
   the list.
6. **Given** queued messages, **When** the administrator chooses "Delete all", **Then** a
   confirmation states how many messages are queued, that held messages are included and that the
   deletion cannot be undone, and nothing is sent until the administrator confirms explicitly.
7. **Given** a stopped Postfix container, **When** the administrator opens the mail queue, **Then**
   the app says that the queue cannot be read because the Postfix container is not running, and
   offers the way to that container on the dashboard.
8. **Given** a queue of more than 10,000 messages, **When** it is listed, **Then** the app says that
   only the first 10,000 messages are listed and that whole-queue actions affect every message.
9. **Given** 1,400 held messages from one sender, **When** the administrator filters by that sender
   and selects all matching messages, **Then** the first 1,000 are selected, the app says that only
   these are selected, and Delete sends one request for those 1,000 after the confirmation.

---

### User Story 5 - Configure the ban service and act on bans (Priority: P2)

An administrator opens the ban service screen. They see the active bans with the time each ends and
the permanent bans from the denylist. A customer was banned by mistake, so the administrator lifts
the ban and allowlists the customer's network in one step. They denylist a known attacker straight
from its ban. They change the ban time and the number of failed attempts, keep an allowlist of
their office networks, let an external firewall enforce the bans through the public ban list
address, and generate a new address when the old one leaked. They edit the filter rules that
recognise failed logins, or reset them to mailcow's defaults.

**Why this priority**: The defaults work for most servers and the ban service keeps working without
the app, but lifting a wrongly banned customer is an urgent support task.

**Independent Test**: Against a mock API, read and change every setting, list and rule with valid
and invalid values, act on active and permanent bans, rotate the ban list address, reset the rules,
and simulate an outdated save and a ban service that is not running. Check the values sent, every
message shown and that no other administrator's change is silently overwritten.

**Acceptance Scenarios**:

1. **Given** an active ban of `203.0.113.0/24`, **When** the administrator chooses "Lift ban",
   **Then** the ban is marked "lift pending" at once and leaves the list once the ban service has
   lifted it.
2. **Given** an active ban, **When** the administrator chooses "Lift and allowlist", **Then** the
   network is added to the allowlist and removed from the denylist, the ban is marked "lift
   pending", and the result says so.
3. **Given** a ban time of 30 seconds, **When** the administrator tries to save it, **Then** the
   field shows that the ban time must be from 60 seconds to the stated maximum, and nothing is sent.
4. **Given** a denylist with the entry `0.0.0.0/0`, **When** it is saved and the API refuses it,
   **Then** the refused entry is named with its translated reason, and the administrator's input is
   kept.
5. **Given** two administrators editing the settings, **When** the second saves after the first,
   **Then** the save is stopped, the second administrator's input is kept, and the values the first
   administrator changed are marked with their new saved values.
6. **Given** edited filter rules, **When** the administrator resets them and confirms, **Then** the
   app shows mailcow's default rules as the API returns them.
7. **Given** an external firewall using the ban list address, **When** the administrator generates
   a new address and confirms, **Then** the new address is shown with a copy action, and the
   confirmation said that the old address stops working at once.
8. **Given** a ban service that is not running, **When** the administrator saves a change, **Then**
   the app says that the change is saved and takes effect once the ban service runs.
9. **Given** an active ban, **When** the administrator chooses "Denylist", **Then** a confirmation
   names the network and says that it becomes a permanent ban, and nothing is sent before the
   administrator confirms.
10. **Given** a stored ban time of 1,800 seconds, **When** the parameters are edited, **Then** the
    field shows 30 minutes, and entering 2 hours sends 7,200 seconds.

---

### User Story 6 - Review Rspamd's scan history and statistics (Priority: P2)

An administrator checks why a message was rejected. In the Rspamd view they search the scan history
for the sender, see the action, the score against the required score and the symbols that
contributed with their scores and options, and the message's size, scan time and authenticated
user. A chart, with a table showing the same figures, shows how many messages Rspamd scanned and
what it did with them.

**Why this priority**: It answers "why was this mail rejected or marked as spam?", but the Rspamd
web interface offers the same information to operators who need it now.

**Independent Test**: Against a mock API with history entries of every action, symbols with
positive, negative and zero scores and statistics for every action, open the Rspamd view at 360 px
and at desktop width, use every filter, sort and the table alternative of the chart, and compare
every value shown with the mock data.

**Acceptance Scenarios**:

1. **Given** a rejected message from `spammer@example.net`, **When** the administrator searches the
   history for that sender, **Then** the entry is shown with the action "reject" in text, its score
   and the required score, and its symbols in the order the API returns them, each with its score
   and options.
2. **Given** Rspamd statistics, **When** the Rspamd view is opened, **Then** the numbers of scanned
   and learned messages, spam, ham and the count per action are shown as figures, and the
   per-action counts are shown as a chart once it has loaded.
3. **Given** a screen reader user, **When** they reach the chart, **Then** they can switch to a table
   with the same counts and percentages, and the chart has a text summary.
4. **Given** an unreachable Rspamd controller, **When** the view is opened, **Then** the app says the
   history and statistics are temporarily unavailable and offers a retry.

---

### User Story 7 - Check for updates and look up the public addresses (Priority: P3)

An upstream mailcow administrator sees next to the installed version whether a newer release exists
and reads its release notes. When the operator has enabled the IP check, the administrator asks for
the server's public IPv4 and IPv6 addresses to compare them with the DNS records.

**Why this priority**: Both are conveniences. Updates are installed on the host, and the addresses
can be found with other tools.

**Independent Test**: Against a mock API with every update status, release notes containing links,
images and HTML, and the IP check enabled, disabled and partly failing, open the dashboard and check
what is shown and that release notes are displayed safely.

**Acceptance Scenarios**:

1. **Given** an update available, **When** the dashboard is shown, **Then** the version line says
   that an update is available with the newest version, and opening it shows the release notes and
   a link to the release page.
2. **Given** the update check failed, **When** the dashboard is shown, **Then** the version line says
   that the check failed, without blocking anything else. **Given** the update check disabled, as in
   the FeldHost deployment, **Then** the version line shows only the version.
3. **Given** the IP check enabled, **When** the administrator chooses "Show public IP", **Then**
   progress is shown and then the IPv4 and IPv6 addresses, or "unavailable" for an address family
   the API could not determine.
4. **Given** the IP check disabled, **When** the dashboard is shown, **Then** "Show public IP" is not
   offered and the app explains that the IP check is switched off and where it can be switched on.
   **Given** the check switched off after the dashboard was loaded, **When** the administrator
   chooses "Show public IP" and the API refuses it as disabled, **Then** the same explanation is
   shown.
5. **Given** release notes that contain an image, raw HTML and a link, **When** they are opened,
   **Then** the image is not loaded and appears as a link with its description, the HTML is shown as
   text, the link opens in a new window marked as external, and no request is made to another
   server.

---

### User Story 8 - Trace operations (Priority: P3)

An administrator investigating an outage opens the history of a container from its card and sees
who restarted or stopped it, when, from where and with what outcome, with the state before and
after. They trace queue deletions, views of queued messages, ban lifts and changes of the ban
settings and rules the same way.

**Why this priority**: The audit log is required, but operations work without reading it.

**Independent Test**: With audit records of every target type of this feature in the mock API, open
the history from each entry point and check the filters applied and the presentation of each record.

**Acceptance Scenarios**:

1. **Given** a container stopped by another administrator, **When** the administrator opens the
   container's history, **Then** the audit log screen of UI feature 001 opens filtered to that
   container, and the entry shows the actor, time, client address, action, outcome and the state
   before and after.
2. **Given** a deletion of 4 queued messages, **When** its entry is opened, **Then** it lists the 4
   queue IDs with their results.
3. **Given** a change of the ban time and the allowlist, **When** its entry is shown, **Then** it
   shows the old and new ban time and the allowlist entries added and removed.

---

### Edge Cases

- **Container service unavailable**: the host figures, the containers, the resource charts, the mail
  storage and the mail queue show a temporary-failure state with a retry, each section on its own,
  while the logs and the ban service keep working. Container and queue actions report that nothing
  was changed.
- **Restart of the reverse proxy**: the connection may drop before the answer arrives. The app
  shows "Outcome unknown", keeps polling, and shows the container's state as soon as the API answers
  again.
- **Restart of the database or the shared store**: other requests may fail for a while and figures
  are marked outdated. When the API reports that the restart was carried out without an audit
  record, the app shows that as a warning.
- **Leaving the dashboard while an action runs**: the action is not cancelled. Its outcome is shown
  as a status message on whatever screen of the app is open.
- **Closing the app while an action runs**: the outcome is not shown; the container's state and the
  audit log show what happened.
- **Container removed or renamed between list and action**: the API answers "not found"; the app
  says the container no longer exists and refreshes the list.
- **Container in a transitional state** (restarting, paused, being removed, created, dead): the card
  shows that state in text, and the actions offered follow what the API reports.
- **Resource usage of a container that is not running**: the card says that no resource data is
  available while it is not running.
- **First resource sample**: rates need two samples, so the charts say they are collecting data until
  the second sample arrives.
- **Device clock wrong**: ages are computed against the host's current time from the overview, so a
  wrong device clock does not make data look outdated or new.
- **Session ends while the dashboard updates**: updating stops, and UI feature 001 handles the
  signed-out state.
- **Log entry with a very long message or no spaces** (encoded data, long URLs): it wraps at any
  character and never causes horizontal scrolling.
- **Decoded log message with line breaks**: the line breaks are kept.
- **Log trimmed while the administrator loads older entries**: the oldest entries may disappear; the
  app shows what the API returns and never shows duplicates.
- **Log type the API does not know** (an old bookmarked address): the app shows the "not found" page
  with a way to the log list.
- **Queue ID delivered or deleted between listing and acting**: reported as "no longer in the queue"
  while the other selected messages are processed.
- **Content view of a message that left the queue**: the app says the message is no longer in the
  queue and removes it from the list.
- **Message with an empty sender (a bounce)**: the sender is shown as "empty sender (bounce)".
- **Large message content** (attachments of several megabytes): only the first 256 KiB are shown at
  first; the rest is shown on request, and copying always copies everything.
- **More than 1,000 messages match a selection across pages**: the first 1,000 in the current sort
  order are selected and the app says so; after the action the administrator can select the rest.
- **Messages arriving while "Delete all" is being confirmed**: they are deleted too; the confirmation
  says that it covers every message queued when the deletion runs, not only the number shown.
- **Unattended dashboard** (for example on a wall screen): live updates pause after 15 minutes
  without interaction and resume with one action.
- **Rate limit already reset** by another administrator: the API answers "not found" and the app
  says the rate limit was already reset.
- **Flush with held messages**: the app says held messages stay on hold.
- **Ban service not running**: the ban screen shows a notice; saved changes take effect when it runs
  and lifts stay pending.
- **Ban expires between listing and lifting**: the API answers "not found"; the app says the ban has
  already ended and refreshes the list.
- **Stored ban settings outside the rules** (from legacy): they are shown as stored, and a save that
  does not change them is accepted.
- **Network on both lists**: refused by the API with the entry named; the app keeps the input.
- **Rule reset while the server is idle**: the API reports that the defaults will appear with the
  next log line; the app explains this and offers a reload.
- **Release notes with HTML, scripts or images**: never executed or loaded from elsewhere.
- **Temporary failure** on a save: the app says nothing was changed and offers a retry that keeps
  the input.
- **Very large installations**: logs, the queue, the history and the ban lists are loaded one page at
  a time, with search, filters and sorting applied by the API.

## Requirements *(mandatory)*

### Functional Requirements

#### Access and navigation

- **FR-001**: The app MUST offer this feature's screens only to administrators, through a "System"
  group in the administrator navigation of UI feature 001 with the entries Dashboard, Logs (which
  includes the Rspamd view), Mail queue and Fail2ban (ban service). The landing screen of UI feature
  001 MUST stay unchanged. Domain administrators and mailbox users MUST NOT be offered any screen or
  action of this feature; opening one of its addresses MUST show the "not available for your role"
  state of UI feature 001.
- **FR-002**: The dashboard, each container, each log type, the Rspamd view, the mail queue, each
  queued message, the ban service settings, the filter rules and the ban lists MUST have their own
  address that can be bookmarked, reloaded and shared. A container's address MUST open the dashboard
  with that container's card expanded, so that other screens can link to it. Opening the address of
  a container, log type or queued message that does not exist MUST show a "not found" page with a
  way back.
- **FR-003**: When the API refuses an action as forbidden, the app MUST show the translated reason,
  refresh the identity and update the controls it offers, as UI feature 001 defines.

#### Dashboard: host and storage

- **FR-004**: The dashboard MUST show a host section with:
  - the host name and the processor architecture;
  - the installed version (FR-026);
  - the host's current time, shown in the host's configured time zone together with that zone's
    name;
  - the uptime as days, hours and minutes in the user's language;
  - the public addresses (FR-029).
- **FR-005**: The dashboard MUST show the processor and memory usage: the number of cores, the
  processor usage in percent, the total memory, the memory usage in percent, and the swap total, used
  swap and swap usage in percent. Processor and memory usage MUST also be shown as live charts of the
  last 30 samples collected while the dashboard is visible (about 2.5 minutes, as in legacy); the
  samples are kept only while the dashboard is open.
- **FR-006**: The dashboard MUST show the mail storage disk: its device name, used, available and
  total space, the percentage used and a usage bar. At 90 % or more the bar MUST be marked as nearly
  full by text or an icon as well as colour. Values the API marks as approximate MUST be marked as
  approximate. When the API reports the usage as unavailable, the section MUST say "unavailable" and
  MUST NOT show zeros.
- **FR-007**: Sizes MUST be shown in binary units (KiB, MiB, GiB, TiB) and rates in bytes per second
  in binary units, formatted for the user's language.

#### Dashboard: containers

- **FR-008**: The dashboard MUST list every container the API returns for this installation, on one
  screen, with a summary of how many are running and how many are not. Each card MUST show:
  - the service name and the image;
  - the state in text (running, restarting, paused, exited, created, dead, removing), with
    containers that are not running clearly marked by text and icon, not by colour alone;
  - the health status, when the container reports one;
  - the start time, as a relative time with the exact time available;
  - a "protected" marker for protected containers;
  - the container's role as the API reports it (for example webmail, database or reverse proxy), in
    words, with roles the app does not know shown as "other".
- **FR-009**: The container list MUST offer a filter (all, running, not running), a search on the
  service name and the image, and sorting by name (the default), state or start time. Selecting the
  "not running" part of the summary MUST apply that filter. The filter, search and sort MUST be kept
  in the page address.
- **FR-010**: Expanding a running container's card MUST show its resource usage: processor usage,
  memory used against its limit, and the disk read and write rates and network receive and send
  rates, as figures and as live charts of the last 30 samples collected while the card is expanded,
  which are discarded when the card is collapsed. Until two samples exist, the charts MUST say that
  data is being collected. For a container that is not running, the card MUST say that no resource
  data is available.
- **FR-011**: Each card MUST offer exactly the actions (start, stop, restart) that the API reports as
  available for that container. For a protected container, the card MUST explain that it cannot be
  stopped from the app; for the API's own container, that it can be neither stopped nor restarted
  from the app.

#### Container actions

- **FR-012**: Stop and restart MUST ask for confirmation in a dialog that names the container,
  states that its service is interrupted while it stops or restarts, and, for a restart, carries the
  legacy notice that a graceful restart can take a while. The restart dialog MUST also warn according
  to the container's role: for the reverse proxy and the container that serves this app, that this
  app may be unavailable for a moment and may then show the outcome as unknown; for the database and
  the key-value store, that other screens may fail for a moment and that the restart may finish
  without an audit record; for any other protected container, that it is a core service. Start MUST
  NOT ask for confirmation.
- **FR-013**: While an action on a container is running, the card MUST show the action in progress
  with the elapsed time and MUST NOT accept another action on that container. Actions on other
  containers MUST stay possible.
- **FR-014**: When the API answers, the app MUST show the outcome: done, or already in the requested
  state ("already running", "not running"), update the card with the container representation the
  API returns, and announce the outcome to screen reader users.
- **FR-015**: When the API reports a timeout with an unknown outcome, or the connection is lost
  before an answer arrives, the app MUST show "Outcome unknown" on the card with an explanation that
  the action may or may not have happened, read the container's state again, and show it. The app
  MUST NOT repeat the action on its own. The actions the API reports for the container MUST become
  available again once its state has been read.
- **FR-016**: When the API refuses an action, the app MUST show the translated reason: container
  protected, container action failed (with the container service's message shown verbatim as
  technical detail), not found, or temporary failure (nothing changed). When the API reports that an
  action was carried out without an audit record, the app MUST show this as a warning.
- **FR-017**: The ban service screen MUST offer "Restart netfilter" for the ban service container,
  with the same confirmation, progress and outcomes as on the dashboard.

#### Live data and freshness

- **FR-018**: While the dashboard is visible, the app MUST refresh the host figures, the container
  list and the resource usage of every expanded container at the polling interval the API's
  monitoring capabilities recommend (5 seconds by default). The mail storage usage MUST be refreshed
  at its freshness limit as the capabilities report it (60 seconds by default), and the version and
  update status once per visit of the dashboard. When the capabilities cannot be read, the figures
  MUST be loaded once, nothing MUST refresh on its own, and a notice with a retry MUST say so. Other screens of this feature MUST NOT
  refresh on their own, except the active bans while a lift is pending (FR-065).
- **FR-019**: The app MUST stop all automatic refreshing while the page is hidden (for example in a
  background tab or a locked phone) or when the user leaves the dashboard, and MUST request fresh
  data at once when the dashboard becomes visible again.
- **FR-020**: The dashboard MUST offer a "Pause live updates" control. While live updates are paused,
  the dashboard MUST say so and since when, MUST NOT refresh on its own, and the manual refresh MUST
  still work. "Resume" MUST request fresh data at once and restart the automatic refreshing.
- **FR-021**: After 15 minutes without any user interaction (pointer, touch, keyboard or scrolling)
  on a screen of this feature, or after the session's idle timeout when that is shorter, every
  automatic refreshing of this feature MUST pause, with a notice that live updates were paused
  because of inactivity and a Resume action as in FR-020.
- **FR-022**: Each dashboard section MUST show how long ago its data was collected, measured from the
  collection time the API reports against the host's current time from the overview, not against
  the device clock. A section MUST be marked as outdated, in text, when its data is older than its
  freshness limit plus two of its refresh intervals, both as the monitoring capabilities report them;
  with the API's defaults: host figures after 20 seconds, container states after 15 seconds,
  container resource samples after 25 seconds, mail storage after 180 seconds.
- **FR-023**: When an automatic refresh fails, the last values MUST stay visible and be marked as
  outdated, a notice MUST say that updating failed, and refreshing MUST continue. A manual refresh
  action MUST be available.
- **FR-024**: Automatically refreshed figures MUST NOT be announced to screen reader users on every
  update. A container that stops running while the dashboard is shown MUST be announced once, as a
  status message that does not move the focus.
- **FR-025**: Each dashboard section (host, processor and memory, mail storage, containers, an
  expanded container's resource usage) MUST define its own loading state (placeholders in the shape
  of the section) and its own error state with a retry, so that one failing section does not hide the
  others. The container list MUST also define a "no matching containers" state with an action that
  clears the search and filter. The release notes and the public address lookup MUST show progress
  while loading and an error with a retry when they fail.

#### Version, updates and public addresses

- **FR-026**: The version line MUST show the installed version tag, and the branch, commit and commit
  date when the API reports them.
- **FR-027**: The version line MUST show the update status the API reports: up to date, update
  available with the newest version tag, or check failed. An available update MUST open its release
  notes with the publication time and a link to the release page. When the API includes the release
  notes of the installed version, the version MUST offer them. When the API reports the update check
  as disabled, the version line MUST show only the version, without any update status.
- **FR-028**: Release notes MUST open full-screen on small screens and in a dialog on wide screens,
  and MUST be displayed safely, as the API contract requires for externally authored text:
  - Markdown headings, emphasis, lists, code, quotes, tables and links MUST be shown with their
    formatting;
  - any HTML in the notes MUST be shown as text and MUST NOT be interpreted;
  - images MUST NOT be loaded; each MUST appear as a link labelled with its description;
  - links MUST open in a new window, MUST be marked as external, and MUST NOT give the opened page
    access to the app;
  - displaying the notes MUST NOT cause any request to another server.
- **FR-029**: The host section MUST offer "Show public IP" when the monitoring capabilities report
  the IP check as enabled. Choosing it MUST show progress and then the IPv4 and IPv6 address, each
  replaced by "unavailable" when the API could not determine it. When the IP check is disabled, or
  the API refuses the lookup because it was disabled meanwhile, the app MUST explain that the IP
  check is switched off and where an administrator can switch it on.

#### Logs

- **FR-030**: The Logs screen MUST offer every log type of the API, grouped as in legacy: in-memory
  logs (Postfix, Dovecot, SOGo, Netfilter, Autodiscover, Watchdog, ACME, Cron, Rate limits, Legacy
  API requests), external logs (Rspamd, FR-045 to FR-049) and stored logs (Legacy UI activity,
  Logins). On small screens the type MUST be chosen from a list or selector, not from a row of tabs
  that needs horizontal scrolling.
- **FR-031**: Each log type MUST show the fields the API returns for it:

  | Log type | Shown on the entry | Shown in the details |
  |---|---|---|
  | Postfix, Dovecot | time, severity, program, message | priority as stored |
  | SOGo, Netfilter | time, severity, message | priority as stored, program |
  | Autodiscover | time, service, user | user agent, client address |
  | Watchdog | time, service, health level in percent, change with its direction; or the message | health points now and total |
  | ACME | time, message | — |
  | Cron | time, severity, task, message | priority as stored |
  | Rate limits | time, rate limit name, sender, recipients | authenticated user, subject, header From, message ID, scanner queue ID, client address, rate limit hash |
  | Legacy API requests | time, method, URI | client address, request data |
  | Legacy UI activity | time, type, task, user and role | client address, message key and parameters, call |
  | Logins | time, username, service | client address, whether an app password was used |

  The autodiscover services `activesync` and `imap` MUST be labelled as legacy labels them
  ("ActiveSync" and "IMAP, SMTP, Cal-/CardDAV"); other services MUST be shown as returned.

- **FR-032**: On small screens each entry MUST be a card with its time, severity or type and source
  on the first line and the main text below. On wide screens each log type MUST be a table with
  columns for the entry fields of FR-031. In both layouts the details MUST be reachable from the
  entry without leaving the list.
- **FR-033**: Messages, request data and calls MUST be shown as plain text, never interpreted as
  markup, MUST keep their line breaks, and MUST wrap at any character when needed. Messages longer
  than four lines MUST be collapsed with an action to show the whole text. Each entry MUST offer an
  action that copies its full content.
- **FR-034**: Severity MUST be shown as the API's class (error, warning, info) in text, with colour
  only as an addition. The watchdog change MUST be shown with its sign and direction in text.
- **FR-035**: Each log MUST offer a time range filter, one search field (case-insensitive, applied
  once the user pauses typing, clearable with one action), a severity filter for types with a
  priority (several classes may be selected), and the type-specific filters the API offers:
  program (Postfix, Dovecot), service (Autodiscover, Watchdog, Logins), user (Autodiscover, Rate
  limits, Legacy UI activity), task (Cron), rate limit name and sender (Rate limits), method and
  client address (Legacy API requests), type and role (Legacy UI activity), username and client
  address (Logins). The number of active filters MUST be visible and one action MUST clear them.
- **FR-036**: Each log MUST list the newest entries first by default and MUST offer oldest first. It
  MUST show the first 50 entries and the total of matching entries. On every screen size, a "Load
  older entries" action at the end of the list (or "Load newer entries" when sorted oldest first)
  MUST add the next 50 entries below the shown ones, asking the API for entries beyond the last one
  shown, so that entries that arrive in the meantime never cause duplicates or gaps. Logs MUST NOT
  use page numbers.
- **FR-037**: The log type, search, filters and sort order MUST be kept in the page address, not in
  browser storage. Changing any of them MUST start again from the newest (or oldest) entries.
- **FR-038**: Logs MUST NOT refresh on their own. Each log MUST offer a refresh action that loads the
  newest entries again, and MUST show when the shown entries were loaded.
- **FR-039**: Each rate limit entry MUST offer "Show entries of this rate limit", which searches the
  log for the entry's rate limit hash, and "Reset rate limit". The reset MUST ask for confirmation
  naming the rate limit and stating that its counter is reset completely and that its log entries are
  removed, MUST use the rate limit reset operation of API feature 006, and MUST refresh the log
  afterwards. When the API answers "not found", the app MUST say that the rate limit was already
  reset.
- **FR-040**: Each log type MUST explain what the log contains and how long mailcow keeps it, from
  the retention the monitoring capabilities report: in-memory logs are trimmed every minute to the
  configured length, which MUST be named, the autodiscover log keeps about 100 entries, the login log
  is cleaned daily, and the legacy UI activity log is never trimmed. The
  Logs screen MUST say that actions taken in this app appear in the audit log, not in the legacy
  logs, and MUST link to the audit log screen of UI feature 001.
- **FR-041**: Times MUST be shown in the device's time zone, formatted for the user's language, with
  the exact time to the second available on each entry. When the device's time zone differs from the
  host's, the Logs screen MUST state which time zone is used.
- **FR-042**: Log contents (messages, names, addresses, URIs, message keys) MUST be shown as returned
  and never translated, apart from the autodiscover service labels of FR-031 and the severity classes.
  The legacy UI activity message MUST be shown as its key with its parameters.
- **FR-043**: Each log MUST define these states: loading (placeholders in the shape of the list), no
  entries, no matching entries (with an action that clears the search and filters), and error with a
  retry. When a refresh fails, the entries shown before MUST stay visible with an error notice.
- **FR-044**: The Logins log MUST show the web UI service label the API reports, without changing it.

#### Rspamd history and statistics

- **FR-045**: The Rspamd view MUST show the statistics: scanned and learned messages, spam, ham,
  connections and control connections, the count per action as Rspamd names the actions, each
  statistics file with its symbol, type, revision and users, the number of fuzzy hashes per storage,
  and the collection time. It MUST be labelled as the statistics of this server.
- **FR-046**: The per-action counts of the statistics MUST be shown as a chart of horizontal bars, one
  per action as Rspamd names it, each labelled with its action, count and percentage of all scanned
  messages, together with a one-sentence text summary (for example the most frequent action and its
  share) and a table alternative that contains the same counts and percentages. When every count is
  zero, the chart MUST be replaced by a message that no messages were scanned yet.
- **FR-047**: The Rspamd view MUST list the scan history, labelled as the history of all servers,
  with paging (25 by default, 50 or 100), the total, sorting by time (default, newest first), score,
  size or scan time, filters by action, time range and score range, and one search over the senders,
  recipients, subject, client address, authenticated user and message ID. The paging, sort, filters
  and search MUST be kept in the page address.
- **FR-048**: Each history entry MUST show the time, the action in text, the score against the
  required score with whether it is above or below in text, the envelope and header sender, the
  recipients, the subject, and, without leaving the list: the symbols in the order the API returns
  them, each with its name, score with its sign and options, the client address, the authenticated
  user or "none", the size, the real and virtual scan times and the message ID. Senders, subjects and
  symbols MUST be shown as plain text.
- **FR-049**: The Rspamd view MUST define loading, empty, no matching entries and error states. When
  the Rspamd controller cannot be reached, the app MUST say that the data is temporarily unavailable
  and offer a retry.

#### Mail queue

- **FR-050**: The mail queue screen MUST list the queued messages with paging (25 by default, 50 or
  100), the total, sorting by arrival time (default, oldest first), size, sender, queue or queue ID,
  filters by queue (active, deferred, hold, incoming, maildrop), arrival time range, sender and
  recipient, and one search over the queue ID, sender, recipients and deferral reasons. The paging,
  sort, filters and search MUST be kept in the page address. The header MUST show the number of
  queued messages in total and per queue, and the queue filter MUST show each queue's count, as the
  API reports them independently of filters and paging.
- **FR-051**: Each message MUST show the queue ID, the queue in text, the arrival time as a relative
  time with the exact time available, the size, the sender ("empty sender (bounce)" when empty), and
  each recipient with its deferral reason when there is one, and a marker when Postfix has marked the
  message for forced expiry. On small screens each message MUST be a card showing the sender, the
  first recipient with the number of further recipients, the first deferral reason, the queue, the
  age and the size, with the remaining recipients and reasons reachable without leaving the list. On
  wide screens the list MUST be a table.
- **FR-052**: When the API reports that the list is truncated, the screen MUST say that only the
  first messages up to the listing limit the monitoring capabilities report (10,000 by default) are
  listed and that flushing and deleting all affect every message.
- **FR-053**: The screen MUST explain the queue and each action as the legacy Queue Manager does:
  deliver now attempts delivery again, hold prevents further delivery attempts, release returns held
  messages for delivery, and the deferral reason says why a message was not delivered.
- **FR-054**: Administrators MUST be able to select messages, one by one or all on the current page,
  and apply deliver now, hold, release or delete to the selection in one request. On small screens
  selection MUST be reachable through a selection mode that shows a checkbox on every card and an
  action bar that names the number of selected messages. The selection MUST be cleared when the
  page, search, filters, sort or page size change.
- **FR-055**: Administrators MUST also be able to select all messages that match the current search
  and filters, across pages. When more messages match than one queue action accepts (the limit the
  monitoring capabilities report, 1,000 by default), the app MUST select that many, the first in the
  current sort order, and say that only these are selected and that the action can be repeated for
  the rest. The action bar MUST name the number of selected messages in every case.
- **FR-056**: Deleting selected messages MUST ask for confirmation naming the number of messages and
  stating that deletion cannot be undone, and MUST NOT send until the administrator has typed that
  number. Deliver now, hold and release MUST NOT ask for confirmation.
- **FR-057**: After a queue action, the app MUST report the result per message as the API returns
  it: how many were done and which were no longer in the queue, announce the summary, and refresh
  the list. After deliver now or flush, the app MUST say that Postfix accepted the request and that
  delivery continues in the background.
- **FR-058**: Administrators MUST be able to flush the queue and to delete all queued messages. The
  flush MUST NOT ask for confirmation and MUST say that held messages stay on hold. Deleting all MUST
  ask for a confirmation that states the number of queued messages read when the dialog opens (the
  API's total count, also when the list is truncated), that held messages and messages arriving in
  the meantime are included, and that the deletion cannot be undone. Its Delete button MUST stay
  disabled until the administrator has typed that number and ticked "I understand that all queued
  messages, including held ones, are deleted permanently".
- **FR-059**: When a queue action times out with an unknown outcome, the app MUST say so, refresh the
  list and MUST NOT repeat the action on its own. When Postfix reports a failure, the app MUST show
  a translated "queue action failed" message with Postfix's message as technical detail.
- **FR-060**: When the API refuses queue operations because the Postfix container is not running,
  the screen MUST say so, name the container, and link to its card on the dashboard.
- **FR-061**: Administrators MUST be able to open a queued message's content from its entry. It MUST
  open full-screen on small screens and in a large dialog on wide screens, show the queue ID, show
  the content verbatim as plain text in a fixed-width font, never interpreted as markup, wrapped by
  default with an option to turn wrapping off, offer a copy action that copies the complete content,
  and say that each view is recorded in the audit log. Only the first 256 KiB MUST be shown at first,
  with an action that shows the rest. The content MUST be requested when the viewer opens and MUST be
  discarded when it closes. From the content view the administrator MUST be able to apply the
  actions of FR-054 to that message.
- **FR-062**: The mail queue MUST define these states: loading, empty queue (a positive message that
  nothing waits for delivery), no matching messages (with an action that clears the search and
  filters), and error with a retry. The queue MUST offer a refresh action and MUST NOT refresh on
  its own except after an action.

#### Ban service

- **FR-063**: The ban service screen MUST show the active bans and the permanent bans, the
  parameters, the allowlist and denylist, external enforcement with the ban list address, and the
  filter rules, in that order of sections. On small screens the sections MUST be reachable without
  scrolling through all others, for example through a section index.
- **FR-064**: Each active ban MUST show the network, the time the ban ends with the remaining time,
  and "lift pending" when it is queued for lifting. The list MUST offer paging, a search on the
  network, sorting by network or end time (default soonest ending first) and a filter on lift
  pending. Each active ban that is not pending MUST offer: lift ban, lift and allowlist, and
  denylist. Lifting, with or without allowlisting, MUST NOT ask for confirmation. Denylisting MUST ask
  for confirmation naming the network and stating that it becomes a permanent ban within about a
  minute and is removed from the allowlist; when the network covers the administrator's own address
  as the monitoring capabilities report it, the confirmation MUST also warn about that.
- **FR-065**: After a ban action, the app MUST show the resulting ban and the list changes, say that
  the ban service processes lifts within about 10 seconds, and show the ban as pending until a
  later read no longer lists it. While a listed ban is pending and the page is visible, the app MUST
  refresh the active bans at the polling interval the monitoring capabilities recommend (5 seconds by
  default), for at most 60 seconds after the last lift. When the API
  answers "not found", the app MUST say that the ban has already ended and refresh the list.
- **FR-066**: Each permanent ban MUST show the network and the time the ban started, and MUST offer
  "Remove from denylist", which saves the denylist without that entry together with the version tag
  (FR-072).
- **FR-067**: The ban service settings MUST be shown read-only in three sections (parameters, lists,
  external enforcement), each with its own Edit action. On small screens a section form MUST open
  full-screen, on wide screens in place. Saving a section MUST send only that section's changed
  values together with the version tag (FR-072).
- **FR-068**: The parameters MUST be editable: ban time, maximum ban time, whether the ban time grows
  with each repeated ban, maximum failed attempts, the retry window, and the IPv4 and IPv6 prefix
  lengths. The ban time, maximum ban time and retry window MUST be entered as a whole number and a
  unit (seconds, minutes, hours, days) and shown in the largest unit that represents the stored value
  exactly (1,800 seconds as 30 minutes, 10,000 seconds as 10,000 seconds). Before sending, the app
  MUST check the rules the API documents: ban time and maximum ban time from 60 seconds to
  2,147,483,647 seconds and the maximum not below the ban time, attempts and retry window from 1 to
  2,147,483,647, the IPv4 prefix length from 8 to 32 and the IPv6 prefix length from 8 to 128. A stored
  value outside these rules MUST be shown as stored and MUST NOT block a save that does not change
  it.
- **FR-069**: The allowlist (addresses, networks in prefix notation and host names) and the denylist
  (addresses and networks) MUST be edited as multi-line fields with one entry per line, showing the
  number of entries, with the legacy explanation that a denylisted entry always outweighs an
  allowlisted one, that list changes take up to a minute to apply, and a warning not to denylist the
  administrator's own network. Before a denylist is saved that newly covers the administrator's own
  address as the monitoring capabilities report it, the app MUST warn and name the address. Each list
  MUST hold at most the number of entries the capabilities report (10,000 by default). Entries MUST be
  trimmed, empty lines ignored and duplicates kept once before sending. When the API refuses entries, every refused entry MUST be listed below its field
  with its line number and translated reason, and the user's input MUST be kept.
- **FR-070**: The external enforcement section MUST offer the "manage externally" switch with the
  legacy explanation, show the public ban list address with a copy action, and offer to generate a
  new address after a confirmation that the old address stops working at once and that external
  firewalls must be updated.
- **FR-071**: The filter rules MUST be shown as a numbered, ordered list. Administrators MUST be able
  to add, edit, remove and reorder rules and save the whole list, with at least one rule and at most
  the number and length the monitoring capabilities report (100 rules of 1,000 characters by
  default), checked before sending. The editor MUST explain that the first capture group of
  each rule must capture the client address, and MUST show each rule the API refuses with its
  translated reason. Administrators MUST be able to reset the rules to mailcow's defaults after a
  confirmation that states that the custom rules are discarded and that the ban service restarts.
- **FR-072**: Every save of the settings, a rules replacement, a rules reset and a ban list address
  rotation MUST send the version tag of the data the form was based on. When the API refuses it as
  outdated, the app MUST keep the user's unsaved values, load the latest saved data, mark every value
  that changed in the meantime with its new saved value, and let the user save again or discard
  their changes, without merging or re-sending on its own.
- **FR-073**: When the API reports that the ban service is not running, the screen MUST say so and
  that saved changes take effect and pending lifts are processed once it runs.
- **FR-074**: The ban service screen MUST define loading, no active bans, no permanent bans and error
  states. Leaving a form with unsaved changes MUST ask for confirmation.

#### History

- **FR-075**: Container cards, the mail queue screen, the ban service settings and the filter rules
  MUST offer a History action that opens the audit log screen of UI feature 001 filtered to that
  target. That screen MUST gain the target types of this feature (container, mail queue, queued
  message, ban settings, ban rules, active ban, ban list ID) and present each record with the time,
  actor, client address and outcome, including refusals and "outcome unknown", and:
  - for a container action: the action and the state before and after;
  - for a queue action: the action and every queue ID with its result, collapsed when there are many;
  - for a content view: the queue ID;
  - for a settings change: each changed value with its old and new value, and the list entries added
    and removed;
  - for a rules change or reset: the old and new rules;
  - for a ban action: the network and the list changes;
  - for a ban list address rotation: that the address was rotated.

  The event type, target, outcome and failure reason MUST be translated. The record details above
  MUST be shown as the contract describes them. While the contract does not describe them (gap 10),
  they MUST be shown as stored, with nested values readable and lists of more than 10 items
  collapsed, without translated names or unit formatting.

#### Errors and feedback

- **FR-076**: Every API error MUST be shown as a translated message built from the error code and the
  validation rule codes the API returns, never as the API's English text. This feature MUST translate
  at least: container protected, container not running, container action failed, mail service not
  running, queue action failed, operation outcome unknown, ban rules not restored, IP check disabled,
  outdated version, temporary failure, not found, and the validation rules of the ban parameters,
  list entries, filter rules and queue IDs with their parameters. Unknown rule codes MUST be shown as
  a generic invalid value of that field. Messages that the container service or Postfix return MUST
  be shown verbatim and labelled as technical detail.
- **FR-077**: Forms MUST show field errors next to their field and in an error summary whose entries
  lead to the fields.
- **FR-078**: The outcome of every action MUST be shown and announced to screen reader users. A status
  message MUST NOT disappear while it has focus or is hovered.

#### Mobile and responsive behaviour

- **FR-079**: Every screen and state of this feature MUST be fully usable at 360 px width without
  horizontal scrolling, and its content MUST reflow at 400 % zoom on a 1,280 px wide screen. Charts
  MUST fit the width of the screen.
- **FR-080**: Interactive targets MUST be at least 44 × 44 CSS px. On small screens the save and
  cancel actions of forms and the action bar of a selection MUST stay reachable without scrolling to
  the end.
- **FR-081**: Number fields MUST bring up a numeric keypad, and fields for addresses, networks, host
  names, rules, queue IDs and searches MUST NOT auto-capitalise or auto-correct.

#### Accessibility

- **FR-082**: Every screen of this feature MUST meet WCAG 2.2 AA. Every function MUST be operable by
  keyboard, including expanding cards, selection, reordering rules, filters and dialogs, and the
  focus MUST be visible and never hidden behind sticky bars.
- **FR-083**: Every chart MUST have a text equivalent: the current values as text next to it and a
  table alternative with the values it shows. Charts MUST NOT rely on colour alone to distinguish
  series, and MUST have sufficient contrast in the light and dark themes.
- **FR-084**: No screen of this feature MUST show anything that blinks, including state indicators.
  When the user's system asks for reduced motion, charts and indicators MUST update without
  animation.
- **FR-085**: Tables MUST have header cells, sortable headers MUST expose the current sort direction,
  and card lists MUST be exposed as lists with each item's name as its heading.
- **FR-086**: Changes of the result count after a search or filter, action progress and outcomes, and
  save outcomes MUST be announced as status messages without moving the focus.
- **FR-087**: Dialogs MUST be labelled, keep the focus inside, close with Escape unless an action is
  being sent, and return the focus to the control that opened them.

#### Internationalisation

- **FR-088**: All text of this feature MUST come from the translation files and MUST be complete in
  English, Czech and Slovak. Legacy translation keys MUST be reused where the meaning is unchanged.
- **FR-089**: Container names, images, host names, versions, log contents, queue IDs, addresses,
  networks, rules, subjects and symbols MUST be shown as returned and never translated. The product
  name in explanatory texts MUST come from the branding configuration.

#### Data freshness and performance

- **FR-090**: After a successful change, every screen that shows the changed container, queue, ban,
  setting or rule MUST show the new state. Data already loaded MUST NOT be loaded again without
  reason, for example when returning to a list.
- **FR-091**: Chart rendering MUST be loaded only when a screen that shows a chart is opened, and the
  figures of that screen MUST be shown without waiting for it.

### Legacy Parity

Legacy reference: FeldHost fork of mailcow-dockerized (upstream tag `2026-09a`), `data/web/`
`templates/dashboard.twig`, `templates/queue.twig`, `templates/modals/queue.twig`,
`templates/admin/tab-config-f2b.twig`, `templates/modals/footer.twig` (`RestartContainer`,
`showVersionModal`), `templates/base.twig` ("Restart SOGo" menu entry, footer version),
`js/site/dashboard.js`, `js/site/queue.js`, `js/site/admin.js`, `js/build/013-mailcow.js` (restart
dialog) and `lang/lang.{en-gb,cs-cz,sk-sk}.json`. On these screens the fork differs from upstream
only in branding, in the removed version link and changelog dialog, in the removed license and GUID
card, and in showing `MAILCOWUI` logins as `WEBUI`. Status: **Matched** (same capability),
**Improved** (same capability, better behaviour) or **Dropped** (intentionally not in this feature,
with the reason).

#### Dashboard › System & Containers

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Tab bar with "System & Containers" and a "Logs" dropdown of 13 tabs | One page with tabs | Improved: own screens with their own addresses; a log type selector instead of a dropdown of tabs | FR-001, FR-002, FR-030 |
| Card header with the UI title and the product logo | Repeats the branding | Dropped: the shell of UI feature 001 shows the branding, and repeating it costs space on phones | — |
| Hostname, Architecture | Text | Matched | FR-004 |
| IPs: "Show public IP" button, or "IP check is disabled" text | Button shown only with the IP check on | Matched: offered only when the API reports the IP check as enabled, otherwise explained | FR-029 |
| Version with update status ("latest version", "update available", "could not check"); upstream links the version to a changelog dialog | Checked by the browser on the `master` branch only | Improved: status from the API, release notes of the new and the installed version shown safely, nothing shown when the check is disabled (FeldHost) | FR-026 to FR-028 |
| System Time, Timezone | Host time as `dd.mm.yyyy hh:mm:ss` | Matched, formatted for the user's language, with the zone's name | FR-004 |
| Uptime | `1D 2H 3M 4S` | Improved: translated units | FR-004 |
| Disk usage: device, used / total (percent), progress bar | `df` text; zeros on failure | Improved: binary units, approximate and nearly-full markers, "unavailable" instead of zeros | FR-006, FR-007 |
| CPU: cores @ usage, line chart of 30 samples | Chart drawn in the browser | Matched; text values first, accessible chart loaded on demand | FR-005, FR-083, FR-091 |
| Memory: total "GB" @ usage, line chart | Binary value labelled GB | Improved: binary units, swap added | FR-005, FR-007 |
| Polling every 5 seconds while the tab is active | No age shown, no pause | Improved: pauses when hidden, pause control, pause after inactivity, age and outdated markers | FR-018 to FR-024 |
| Container cards: name, image, "Started on", "Running" with animated dots or "Stopped" | Collapsed cards | Improved: state in text including transitional states, health, role in words, protected marker, summary, filter, search, sort, no animation | FR-008, FR-009, FR-084 |
| Expanded card: Disk I/O and Net I/O charts, spinner until two samples | Rates computed in the browser | Matched with the API's rates, plus processor and memory of the container | FR-010 |
| "Restart" link with a coloured state dot | Opens the restart dialog | Improved: start, stop and restart as the API allows, protected containers explained | FR-011 to FR-016 |
| License and GUID card (upstream only) | — | Dropped: belongs to UI feature 013 | — |

#### Restart dialog and restart shortcuts

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| "Restart container" dialog with the container name, the graceful-restart notice, "Restart now", "Restarting container, this may take a while" | HTML reply, page reload after success | Improved: confirmation with consequences, progress and elapsed time on the card, structured outcome, "outcome unknown", no page reload | FR-012 to FR-016 |
| "Restart SOGo" entry in the E-mail menu | Opens the restart dialog | Improved: the SOGo container's own address opens its card with Restart, so other screens (for example the Global Address List notice of UI feature 002) can link to it; the navigation holds places, not actions | FR-002, FR-011 |
| "Restart netfilter" button in the Fail2ban section | Opens the restart dialog | Matched | FR-017 |

#### Log tabs

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Explanation of in-memory, external and static logs | Names the configured `LOG_LINES` | Matched per log type, naming the configured length the API reports | FR-040 |
| Refresh button | Reloads the table | Matched | FR-038 |
| Quick actions "+ 100", "+ 1000" | Loads a range of older lines | Improved: "Load older entries" in steps of 50, without duplicates, combined with filters | FR-036 |
| Search, sorting and paging over 1,000 loaded lines | In the browser | Improved: search, time range, severity and type filters applied by the API to every retained entry; the view is kept in the address | FR-035, FR-037 |
| Expand all, Collapse all, collapsed child rows | Responsive table rows | Dropped: cards and expandable details replace collapsed rows | FR-032 |
| Postfix, Dovecot, SOGo, Netfilter, ACME, Crontasks: time, priority badge, message, task | Base64 decoded in the browser; badge colour only | Matched; severity class in text; decoded by the API | FR-031, FR-033, FR-034 |
| Autodiscover: time, user agent, username, IP, service badge | "IMAP, SMTP, Cal-/CardDAV" label for `imap` | Matched, with the legacy service labels | FR-031 |
| Watchdog: time, service, trend badge with arrow, health level text | Colour and arrow | Matched; change with sign and direction in text | FR-031, FR-034 |
| API: time, URI, method badge, IP, data | Only fields named like "pass" masked | Matched; masking by the API | FR-031, FR-033 |
| Ratelimits: colour stripe per hash, time, rate name, sender, recipients, auth. user, message ID, header From, subject, hash, Rspamd QID, IP, "Remove hash" | Reset without confirmation | Matched; the colour stripe is replaced by "Show entries of this rate limit"; the reset uses API feature 006 after a confirmation | FR-031, FR-039 |
| "FeldHost™ Mailhosting UI" (upstream "Mailcow UI") activity log: time, type badge, task, user, role, IP, message, call | Raw values | Matched as "Legacy UI activity" with the message key and parameters and the structured, masked call; no brand name hard-coded | FR-031, FR-042, FR-089 |
| SASL: username, service (the fork shows `MAILCOWUI` as `WEBUI`), IP, login time | — | Matched as "Logins" with the label the API reports, plus "app password used" | FR-031, FR-044 |

#### Rspamd tab

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| "Chart (this server)": doughnut of the actions | Greylisting merged into soft reject; percentages inside the slices | Improved: labelled bars per action as Rspamd names them, text summary and table | FR-045, FR-046 |
| "History (all servers)": time, IP address, From, To, Subject, Action badge, Score with required score, Symbols with coloured scores and options, Msg size, Scan Time, ID, Authenticated user | In the browser over loaded rows | Matched; action and score relation in text; paging, sorting, filters and search by the API | FR-047, FR-048 |
| "+ 100", "+ 1000", Expand all, Collapse all | — | Improved by paging; expanding and collapsing dropped as for logs | FR-047 |
| Statistics other than the action counts | Not shown | Improved: scanned, learned, spam, ham, connections, statistics files, fuzzy hashes | FR-045 |

#### Queue Manager

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Header with count, Refresh | — | Matched | FR-050, FR-062 |
| Info text and legend of Deliver, Unhold, Hold | Static text | Matched | FR-053 |
| Table: QID, Queue, Arrival time, Message size, Sender, Recipients, "Show message" | First 10,000 messages; recipients flattened as `address (reason)` | Improved: recipients with their reasons, forced expiry marker, filters, sorting and paging by the API, cards on phones, truncation notice | FR-050 to FR-052 |
| Checkbox column, Toggle all | Selection on the page | Improved: selection mode on phones, selection of all matching messages up to 1,000 | FR-054, FR-055 |
| Quick actions Deliver, Unhold, Hold, Remove | One request, overall success only; Remove confirmed by the generic list dialog | Improved: one request with a result per message; deletion confirmed with the number of messages | FR-054 to FR-057 |
| "Flush queue" | No confirmation | Matched, with the note that held messages stay on hold | FR-058 |
| "Delete all" with a browser `confirm()` | — | Improved: exact count (also beyond the listed 10,000), held messages named, explicit acknowledgement | FR-058 |
| "Show message" dialog with a 40-row text area | Raw `postcat` output | Improved: full-screen viewer on phones, verbatim, wrapping toggle, copy, audit notice, actions | FR-061 |
| Saved table state | Browser storage | Improved: the view is kept in the address | FR-050 |

#### Fail2ban (System › Configuration)

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Collapsible "Fail2ban parameters" panel among the configuration tabs | One long panel | Improved: own screen with a section index | FR-063 |
| Ban time (s), Max. ban time (s), "Ban time is incremented", Max. attempts, Retry window (s), IPv4 and IPv6 subnet size | Seconds only; values below the minimum silently raised | Improved: units, checks before sending, refusals per field | FR-067, FR-068 |
| "Manage Fail2Ban externally" with explanation | Checkbox | Matched | FR-070 |
| Allowlist and denylist text areas with the list explanation | Invalid entries silently skipped | Matched as one entry per line; improved: refused entries listed with their line, warning about the own network | FR-069 |
| Save for the whole form | Last write wins | Improved: section saves with version tags; outdated saves stopped without losing input | FR-067, FR-072 |
| Regex filters: ID, RegExp, Remove row, Add row, Save, Reset to default, "Logs taken into consideration" | Any strings accepted | Improved: reordering, limits checked, refusals per rule; reset with confirmation | FR-071 |
| Ban list explanation, "No active bans" | — | Matched | FR-064, FR-074 |
| Ban list address with copy (HTTPS only) and refresh button | Refresh without confirmation | Improved: copy, and a new address only after a confirmation naming the consequence | FR-070 |
| Active bans: network linked to bgp.tools, remaining time, actions [unban], [allowlist], [denylist (needs restart)], "unban pending" | — | Improved: lift, lift and allowlist, denylist with confirmation, pending state refreshed until lifted, no "needs restart" (the API documents the timing). The bgp.tools link is dropped: it sends the banned address to a hard-coded third-party service; the network can be copied instead | FR-064, FR-065 |
| Permanent bans in red | Not actionable | Improved: "Remove from denylist" | FR-066 |

#### Footer and version dialog

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Version in the footer for every signed-in user (upstream links it to the release or commit) | — | Dropped for domain administrators and mailbox users, because the API returns the version only to administrators (API gap 7); administrators see it on the dashboard | FR-026 |
| Version dialog with release notes fetched from GitHub by the browser | Markdown rendered as HTML | Improved: notes come from the API, are rendered safely and cause no third-party request | FR-027, FR-028 |

### API Dependency

This feature depends on **mailcow REST API v2 feature 011, Monitoring and operations**
(`mailcow-rest-v2/specs/011-monitoring-operations/spec.md`), on the identity, error conventions and
audit log of API feature 001, on the audit target filters of API feature 002, and, for the rate
limit reset only, on API feature 006. The contract versions are pinned in the plan, once the API 011
contract has been merged.

| Behaviour relied on | API requirement |
|---|---|
| Administrator-only access, forbidden for other roles, "not found" for unknown or foreign objects | API 011 FR-001 to FR-004 |
| System overview with host time, time zone, processor, memory and swap, and its collection time | API 011 FR-005, FR-006, FR-059 |
| Mail storage usage in bytes, approximate marker, "unavailable" | API 011 FR-007 |
| Container list with state, health, protected flag, role and available actions; filter, search and sort | API 011 FR-008 to FR-010 |
| Container resource usage with rates, first-sample behaviour and "container not running" | API 011 FR-011 |
| Recommended polling interval and freshness limits | API 011 FR-012 |
| Monitoring capabilities: IP check state, polling interval, freshness limits, log retention, the caller's client address, bulk, list and rule limits | API 011 FR-069 |
| Start, stop, restart with outcome and resulting container; protected refusal; failure with the service's message; timeout as "outcome unknown"; destructive marking | API 011 FR-013 to FR-017 |
| Version, update status with release notes, disabled check; release notes as externally authored Markdown | API 011 FR-018 to FR-020 |
| Public addresses and the "IP check disabled" refusal | API 011 FR-021 |
| Log types and fields, decoding, severity classes, paging, sorting, filters, loading older entries, retention, masking, legacy UI activity messages, login label, rate limit hash, unparsable entries | API 011 FR-022 to FR-032 |
| Rspamd history and statistics, symbol order, temporary failure | API 011 FR-033 to FR-036 |
| Queue list with truncation, counts per queue, filters and sorting; content; actions on up to 1,000 IDs with a result per ID; flush and delete all; timing; Postfix not running | API 011 FR-037 to FR-043 |
| Ban settings, partial changes, rules, list validation, timing, filter rules and reset, ban lists, ban actions, permanent bans, ban list rotation, ban service not running | API 011 FR-044 to FR-056 |
| Version tags and outdated refusal for ban settings and rules | API 011 FR-057 |
| Temporary failures of mailcow's services | API 011 FR-060 |
| Audit records of this feature's targets, target filters, "carried out without an audit record" | API 011 FR-062 to FR-064; API 002 FR-058; API 001 FR-046, FR-047 |
| Problem types and validation rule codes with parameters | API 011 FR-065; API 001 FR-049, FR-055 |
| Rate limit reset by its hash | API 006 FR-057 |
| Role of the signed-in user | API 001 FR-028, FR-029 |

**Gaps in the API that this feature does not work around** (to be specified in mailcow-rest-v2 if
wanted; until then the app behaves as stated). Gaps 1, 2, 4, 5, 6 and 8 were closed by the API 011
contract (monitoring capabilities, counts per queue and container roles), and this spec was aligned
in the plan:

1. *Closed*: the monitoring capabilities say whether the IP check is enabled (FR-029).
2. *Closed*: the queue list reports the count per queue (FR-050, FR-058).
3. No operation acts on every queued message that matches a filter. Actions on selections are
   limited to the API's bulk limit (1,000 messages by default) at a time (FR-055). The API declined
   to add one, as the bulk limit together with flush and delete all cover the legacy Queue Manager.
4. *Closed*: the monitoring capabilities report the caller's own client address (FR-064, FR-069).
5. *Closed*: the polling interval and the freshness limits are delivered at run time (FR-018,
   FR-022).
6. *Closed*: the configured retention of each log is exposed (FR-040).
7. The installed version is readable only by administrators. Domain administrators and mailbox users
   no longer see it in the footer, as they do in legacy (FR-026). The API declined to change this.
8. *Closed*: each container carries a role (FR-008, FR-012).
9. The way to load the next entries of a log is documented only for the newest-first order. In
   oldest-first order the app continues after the entries it shows, which never duplicates an entry
   but can skip entries that mailcow trims meanwhile (FR-036).
10. The details of this feature's audit records (state before and after, queue IDs with results,
    old and new values and rules) are not described in the contract. The history shows them as
    stored, without translated names or unit formatting, until the contract describes them (FR-075).

### Key Entities *(include if feature involves data)*

- **Host overview**: host name, architecture, version, host time and time zone, uptime, processor,
  memory and swap figures, and their collection time.
- **Mail storage usage**: device, used, available and total space, percentage, approximate marker or
  "unavailable", and collection time.
- **Monitoring capabilities**: whether the IP check is enabled, the polling interval, the freshness
  limit of each kind of live data, the retention of each log, the caller's own client address and
  the bulk, list and rule limits.
- **Container**: service name, image, state, running flag, health, start time, protected flag, role
  and available actions.
- **Container resource sample**: processor, memory and limit, disk and network counters and rates at
  one time.
- **Live series**: the samples the app collected for one chart while it was visible; never stored.
- **Live update state**: whether automatic refreshing runs, is stopped because the page is hidden,
  is paused by the user, or is paused after inactivity, and since when.
- **Container action run**: one action on one container, its progress and its outcome (done, already
  in that state, refused, failed, outcome unknown).
- **Version and update status**: installed version, branch, commit, update status and release notes.
- **Public addresses**: IPv4 and IPv6, each possibly unavailable.
- **Log view**: log type, time range, search, filters, sort order and the entries loaded so far.
- **Log entry**: time and the type-specific fields the API returns.
- **Rspamd statistics and history entry**: as the API returns them.
- **Queued message**: queue ID, queue, arrival time, size, sender, recipients with deferral reasons,
  forced expiry marker and content.
- **Queue selection and queue action result**: the selected queue IDs, one action and the result per
  ID.
- **Ban service settings**: parameters, allowlist, denylist, external enforcement, ban list address and
  version tag.
- **Filter rules**: the numbered rules and their version tag.
- **Active ban and permanent ban**: network, end or start time, remaining time and lift state.
- **History entry**: an audit record about one of this feature's targets.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator restarts a container from the dashboard on a 360 px wide phone in at
  most two interactions after opening its card (choose Restart, confirm).
- **SC-002**: An administrator finds why a message is stuck (filter the deferred queue by recipient
  and read the deferral reason) on a 360 px wide phone in under 1 minute.
- **SC-003**: For 100 % of the values in the parity test set, every value that the legacy dashboard,
  log tabs, Queue Manager and Fail2ban section show is shown by the new app with the same figure,
  allowing for unit, time zone and masking conversions.
- **SC-004**: While the dashboard page is hidden, while live updates are paused, and after 15 minutes
  without user interaction, the app sends 0 status requests; after the page becomes visible again or
  the user resumes, fresh data is requested within 1 second.
- **SC-005**: In 100 % of tests, a figure whose collection time is older than its outdated threshold
  (FR-022) is marked as outdated, and a figure within its threshold is not.
- **SC-006**: In 100 % of tests with an action timeout or a dropped connection, the app shows
  "Outcome unknown", shows the container's or queue's state read afterwards, and sends the action
  exactly once.
- **SC-007**: 100 % of destructive actions (stop, restart, delete selected, delete all, rule reset,
  ban list address rotation, denylisting, rate limit reset) are sent only after a confirmation that
  names what is affected, and "Delete all" is never sent without the explicit acknowledgement.
- **SC-008**: Automated accessibility checks report 0 WCAG 2.2 AA violations on every screen and
  state of this feature, at 360 px and at desktop width, in the light and dark themes.
- **SC-009**: No screen of this feature needs horizontal scrolling at 360 px width or at 400 % zoom on
  a 1,280 px wide screen, including log entries with 2,000-character messages without spaces.
- **SC-010**: In 100 % of tests where entries are added while older entries are loaded, no log entry
  is shown twice.
- **SC-011**: When the API answers within 1 second, the dashboard figures and the first page of a log
  are visible within 2 seconds of opening them on a mid-range phone over a mobile connection, the
  content of a 10 MiB queued message is readable within 2 seconds after it has arrived, and opening a
  screen without charts does not download chart rendering.
- **SC-012**: Translation completeness checks find 0 missing keys in English, Czech and Slovak.
- **SC-013**: In a moderated test with at least 5 administrators who know the legacy UI, at least 90 %
  lift a ban, find a log entry by address and restart a container on a phone at the first attempt
  without help.

## Assumptions

- UI feature 001 provides the shell, navigation, sign-in, the landing screen, the identity with the
  role, language and theme, session handling, the generic translated error handling (including 401
  and 403), status announcements, and the audit log screen, which this feature extends with target
  filters (FR-075). This feature adds the "System" navigation group and does not change the landing
  screen.
- The rate limit reset (FR-039) is the only use of API feature 006. If the API 006 contract is not
  merged when this feature is planned, the plan may ship the reset later; the rest of the feature
  does not depend on it.
- The 15-minute inactivity pause, the 50-entry log steps, the 256 KiB first view of a queued message,
  the 90 % "nearly full" threshold and the page sizes are defaults of this feature.
- The API 011 contract is merged before this feature is planned. Until the API is implemented, the
  feature is built and tested against a mock generated from the contract.
- The API's recommended polling interval (5 seconds by default), freshness limits (by default host
  figures 10 seconds, container states 5 seconds, resource samples 15 seconds, mail storage 60
  seconds), log retention and limits are read at run time from its monitoring capabilities; the
  values in this spec are the API's defaults.
- Live charts show only the samples collected while they are visible, as in legacy. The API offers
  no history of host or container figures.
- Legacy translation keys with unchanged meaning are reused, for example `debug.system_containers`,
  `debug.architecture`, `debug.current_time`, `debug.timezone`, `debug.uptime`,
  `debug.disk_usage`, `debug.cores`, `debug.memory`, `debug.container_running`,
  `debug.container_stopped`, `debug.started_on`, `debug.show_ip`, `debug.error_show_ip`,
  `debug.update_available`, `debug.no_update_available`, `debug.update_failed`,
  `debug.in_memory_logs`, `debug.external_logs`, `debug.static_logs`, `debug.chart_this_server`,
  `debug.history_all_servers`, `footer.restart_container`, `footer.restart_container_info`,
  `footer.restart_now`, `footer.restarting_container`, `header.restart_netfilter`, `queue.*`,
  `admin.f2b_*`, `admin.queue_unban`, `admin.unban_pending`, `admin.no_active_bans`,
  `admin.reset_default`, `admin.arrival_time`, `admin.message_size`, `admin.sender`,
  `admin.recipients`, `admin.priority`, `admin.message`, `admin.rate_name`, `admin.authed_user`,
  `admin.task`, `admin.ip_check_disabled`, `admin.reset_limit`, `success.f2b_modified`,
  `success.f2b_banlist_refreshed` and `success.queue_command_success`. Legacy texts that contain HTML
  markup or the product name are carried over without the markup and with the product name from the
  branding configuration. Labels whose meaning changes get new keys; the plan found this for the
  duration labels in seconds, `admin.f2b_list_info` (a few seconds instead of up to a minute),
  `admin.hash_remove_info` and `admin.ban_list_info` (colours this feature replaces) and
  `danger.reset_f2b_regex` (it asks to try again, which the API advises against).
- **Out of scope**: container log streams; installing updates; editing the IP check switch, the
  update check settings, the protected containers and the container-service timeout (server
  settings, UI feature 013 or the host); the license and GUID card (UI feature 013); quarantine and
  spam policy, including the merged spam filter action figures (UI feature 006); push updates; an
  automatic "follow" mode for logs.
