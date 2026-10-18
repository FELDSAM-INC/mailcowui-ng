# Feature Specification: Quarantine, Spam Policy and Rate Limits

**Feature Branch**: `main` (no feature branches, constitution 1.1.0)

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Quarantine, spam policy and rate limit screens for mailcowui-ng, the
mobile-first web app for mailcow-dockerized, built only on mailcow REST API v2 feature 006
(Quarantine, spam policy and rate limits). Mailbox users review the messages the spam filter kept
in quarantine for their mailbox (cards on phones, a table on wide screens), open a message to see
why it was caught and read its text without any HTML or script ever being rendered, release it to
the inbox with or without teaching the filter, learn it as spam, delete it, and download its
attachments or the whole message when their permissions allow. They choose how often and for which
messages they are notified, set their spam score thresholds and keep allow and block lists that
show the domain's entries read-only. Administrators and domain administrators do the same for every
mailbox in their scope, search, filter and sort the quarantine, act on up to 100 items at once with
one result per item, keep allow and block lists for domains and alias domains, set notification
values for many mailboxes from the mailbox list, and set sending rate limits for domains, alias
domains and mailboxes as their permission flags allow. Administrators configure the quarantine
system and its notification e-mail, reset rate-limit buckets and see the spam filter's action
statistics. Destructive actions need confirmation, every view has loading, empty and error states,
and every screen works at 360 px width, meets WCAG 2.2 AA and is translated into English, Czech and
Slovak. Replaces the legacy quarantine page and item modal, the user spam filter tab and quarantine
notification settings, the spam filter and rate limit tabs of the domain, alias domain and mailbox
pages, the mailbox list's notification mass actions, the admin quarantine settings tab, and the
dashboard's spam filter chart and rate-limit reset."

## Clarifications

### Session 2026-10-18

- Q: Where do the screens of this feature live in the app's navigation? → A: The "Quarantine"
  entry of the UI feature 001 navigation opens the quarantine items for every role. Within that
  section, mailbox users also get a "Notifications" page; administrators and domain administrators
  get a "Rate limits" overview; administrators also get "Settings" and "Statistics". Mailbox users
  reach their spam score and allow and block lists through the "Spam filter" entry of UI feature
  001. Each domain, alias domain and mailbox gets a "Spam filter and limits" page with its own
  address (allow and block lists, rate limit, and for a mailbox also its notification settings and
  spam score), linked from the domain, alias domain and mailbox pages of UI features 002, 003 and
  004, from the rate-limit overview and from a quarantine item's recipient. The notification bulk
  actions are added to the mailbox list of UI feature 003. (agent decision: the UI 001 navigation
  catalogue lists one Quarantine entry for every role and a Spam filter entry for mailbox users;
  legacy keeps per-object settings in tabs next to the object, so the pages are linked from there;
  pages with their own address keep this feature testable before the host pages add the links; API
  006 FR-051 offers a rate-limit list that legacy lacks.)
- Q: How is a quarantined message's content shown? → A: As inert plain text only: the plain-text
  part first, then the text the API derived from the HTML part, each in its own section, with line
  breaks kept and long lines wrapped. Nothing in it is interpreted: no markup, no clickable links,
  no images or other remote content. Each section shows the first 20 lines with a "Show full text"
  control. Subjects, addresses, symbol options and file names are also shown as plain text,
  isolated so that right-to-left or control characters cannot reorder the surrounding screen.
  (agent decision: constitution V forbids rendering API data as markup unless it is sanitised, and
  API 006 FR-013 returns no HTML at all; legacy shows the same two text parts in preformatted
  blocks; inactive links protect users from phishing links in spam; collapsing keeps the actions
  reachable on a phone.)
- Q: Which item actions need a confirmation, and how is "learn as ham" offered? → A: Every action
  is confirmed in a dialog that names the item (subject and sender) or, for several items, their
  number and list. "Deliver to inbox" contains a switch "Also teach the spam filter that this is
  not spam", on by default; turning it off delivers without learning, like the legacy quick release
  link. "Learn as spam and delete" and "Remove" are marked destructive and say that the item cannot
  be recovered. When a virus was found in an item, its delivery requires ticking an acknowledgement
  of the danger first. (agent decision: API 006 FR-022 makes learning the default and turning it off
  the legacy quick release; constitution II requires explicit confirmation for destructive actions;
  a delivery cannot be taken back either, and a virus-flagged message in the inbox is the riskiest
  outcome of this feature.)
- Q: How does selecting several quarantine items work, and what happens afterwards? → A: As in the
  mailbox list of UI feature 003: phones use an explicit selection mode; the selection persists
  across pages, searches and filters until it is cleared or an action finishes; it is capped at 100
  with a visible counter; "select all" selects the current page. Afterwards the app shows the number
  of items per outcome and every item with its outcome; failed items stay selected for a retry. When
  no response arrives, the outcome is reported as unknown, the list is refreshed, and the request is
  never repeated automatically. (agent decision: API 006 FR-027 allows 100 items per request with
  one result each; one selection pattern across the app; never repeating a release automatically
  prevents a second delivery when a response is lost.)
- Q: How are attachments and the whole message offered for download, and is the legacy VirusTotal
  link kept? → A: Downloads are offered only to users the API permits (attachment details are
  present only for them) and are always saved as files, never opened inside the app. Before a
  download from a virus-flagged item, a warning must be confirmed. Each attachment shows its
  SHA-256 hash with a copy action and the legacy "Search file hash @ VT" link, which opens the
  lookup for that hash in a new browser tab without passing on the app's address. (agent decision:
  API 006 FR-013 and FR-016 to FR-018 define the permitted downloads and allow an external lookup
  built from the hash; legacy links to VirusTotal; only the hash leaves the app, and only on an
  explicit tap.)
- Q: How is the spam score entered, given that legacy uses a two-handle slider? → A: With two
  number fields, "Junk folder from" and "Reject from", each from 0 to 5,000 with one decimal and the
  locale's decimal separator, above a three-zone band (green: not spam, yellow: junk folder, red:
  rejected) that redraws as the values change and states each range in text. The server defaults
  are shown next to the fields, marked when they are fallback values. "Reset to server default" is
  confirmed. (agent decision: API 006 FR-039 to FR-041 define the values, range and reset; legacy's
  slider is hard to operate precisely by touch and by keyboard across a non-linear 0 to 5,000
  range; number fields meet the WCAG 2.2 target-size and dragging criteria without an extra
  control.)
- Q: How are the allow and block lists laid out, and how are several entries removed? → A: On
  phones a two-option switch with entry counts toggles between "Allowlist" and "Denylist"; wide
  screens show both side by side. Own entries come first; inherited entries (the domain's entries on
  a mailbox page, the mailboxes' entries on a domain page) follow in their own group, read-only and
  labelled with their owner. Entries are added one at a time. Several own entries can be selected
  and removed after one confirmation; the app sends one request per entry, continues after
  failures and reports each result with a "retry failed" action. (agent decision: API 006 FR-043 to
  FR-048 mark ownership and offer only one removal per request; legacy shows both lists side by side
  with a mass removal and marks domain entries "n/a (domain policy)"; one request per entry is the
  pattern UI feature 002 uses where the API has no batch operation.)
- Q: Where does an administrator reset a rate-limit bucket? → A: As a "Remove hash" action on each
  entry of the rate-limited log, which UI feature 011 shows, and, so that the reset is usable before
  that log exists in the app, as "Reset a rate-limit bucket" on the Rate limits overview, where the
  administrator enters a bucket identifier copied from a log. Both are confirmed with the legacy
  explanation that the bucket's counter is reset completely. (agent decision: API 006 FR-057 offers
  the reset by identifier, and the identifiers appear only in the rate-limited log of API feature
  011; legacy offers the reset only in its dashboard log.)
- Q: Where and how are the spam filter's action statistics shown? → A: On the administrators'
  Quarantine › Statistics page, as a list of the five actions with their count, their share as a
  percentage and a proportional bar, plus the total, all in text. UI feature 011 may show the same
  panel on its dashboard. No graphical chart is used. (agent decision: API 006 FR-058; the
  legacy dashboard that showed the doughnut chart belongs to UI feature 011; a text list with bars
  is accessible without colour and needs no new dependency, constitution VIII.)
- Q: How are the quarantine settings edited, in particular the HTML notification template and the
  excluded domains? → A: The settings page shows four read-only sections (Storage and limits,
  Release, Notification e-mail, Template), each with its own Edit action that saves only its values
  with the version tag. The template is edited and shown only as source text in a monospace field,
  never rendered or previewed, with a size indicator, a reference of the documented placeholders and
  a confirmed "Restore default template". Excluded domains are chosen in a searchable picker of the
  server's domains and alias domains; a stored entry whose domain no longer exists is flagged and
  can be kept or removed. (agent decision: constitution V forbids rendering API-supplied HTML, API
  006 FR-032 neither renders nor previews the template, and legacy edits it as plain text; the
  section pattern is UI feature 002's; API 006 FR-030 accepts only existing domains and alias domains
  and lets stale entries be sent back unchanged.)
- Q: What does a user see for actions and settings their permission flags do not allow? → A:
  Actions they may not use are not offered. Settings they may see but not change are shown
  read-only with the note "Prohibited by ACL" and the name of the missing permission, as in UI
  feature 003. A mailbox user without the quarantine actions permission sees the list and the
  details with a notice that actions are disabled for their mailbox. (agent decision: constitution V
  says the UI follows the flags the API reports and hiding is a convenience; API 006 FR-006 lets
  every role view items and settings without the change flags; one presentation across the app.)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review and act on my own quarantine (Priority: P1)

A mailbox user opens Quarantine on a phone. Each quarantined message appears as a card with its
subject, sender, arrival time, spam score, whether it was rejected or moved to the junk folder,
whether a virus was found and whether a notification already mentioned it. A notice says whether
the quarantine is active and how many items per mailbox it keeps. They search and filter, open a
message and see why it was caught (score and the filter's symbols), who sent it, to whom it was
addressed, and its text, shown as plain text so nothing in the message can run.

If the message is wanted, they deliver it to their inbox; by default the spam filter also learns
that it is not spam. If it is spam, they learn it as spam, which also removes it, or simply remove
it. When their permissions allow, they see and download its attachments or download the whole
message.

**Why this priority**: Recovering a wrongly caught message is the most frequent and most urgent
quarantine task, and it is what mailbox users use the quarantine for. It is a complete slice on its
own.

**Independent Test**: Against a mock API generated from the contract, with 30 items for one
mailbox (rejected, junk, subject rewritten, virus, with attachments, over 10 MiB, unparseable, and
with markup, script and right-to-left text in subject and body), sign in as a mailbox user with each
combination of the quarantine actions and attachments permissions at 360 px and desktop width.
List, filter, open, download, deliver with and without learning, learn as spam and remove, and
verify every value, every request sent and that no markup is ever rendered.

**Acceptance Scenarios**:

1. **Given** 30 items for alice@example.org, **When** she opens Quarantine, **Then** her 25 newest
   items are shown newest first with a total of 30 and a way to reach the rest, and each card shows
   subject, sender, arrival time in her locale, score, action, virus state and notification state.
2. **Given** an item whose plain text contains `<script>alert(1)</script>` and a link, **When** she
   opens it, **Then** the text is shown literally, no script runs, and the link is not clickable.
3. **Given** an item rejected because a virus was found, **When** she opens it, **Then** she sees
   its score with the action "Rejected", a "Danger: High" marker in text, the symbols sorted with the
   highest positive scores first, the subject, the From header, the SMTP sender, the recipients with
   their header (To, Cc, Bcc, envelope), the plain text and the text converted from HTML.
4. **Given** she holds the quarantine actions permission, **When** she chooses "Deliver to inbox"
   and confirms with the learning switch left on, **Then** the item disappears from the list and a
   message reports that it was delivered and learned as not spam.
5. **Given** the same, **When** she turns the learning switch off before confirming, **Then** the
   message reports that it was delivered without learning.
6. **Given** a delivery that succeeded but whose learning failed, **When** the response arrives,
   **Then** the app reports the delivery as done and warns that the filter could not learn the
   message, without presenting the delivery as failed.
7. **Given** a virus-flagged item, **When** she chooses "Deliver to inbox", **Then** the confirm
   control stays disabled until she ticks the acknowledgement of the danger.
8. **Given** she lacks the quarantine actions permission, **When** she opens the list and an item,
   **Then** she sees all items and details, no action or whole-message download is offered, and a
   notice says that actions are disabled for her mailbox.
9. **Given** she lacks the attachments permission, **When** she opens an item with attachments,
   **Then** no attachment section and no download is offered.
10. **Given** an item larger than 10 MiB, **When** she opens it, **Then** the summary and the
    filter's results are shown, the content section says it is unavailable because the message is
    too large, and no download is offered.
11. **Given** the quarantine is inactive, **When** she opens Quarantine, **Then** the legacy notice
    that the configuration disables the quarantine is shown above the list, and existing items can
    still be opened and acted on.

---

### User Story 2 - Handle the quarantine of all mailboxes in my scope (Priority: P1)

An administrator, or a domain administrator for the domains they manage, works through the
quarantine of many mailboxes. They filter by recipient, domain, action, virus state, notification
state, arrival time and score, search by subject, sender, recipient or queue identifier, and sort by
any column. They select up to 100 items and deliver, learn or remove them after one confirmation,
and see one result per item. They open a mailbox's quarantine from its settings page, and the
mailbox's settings from an item's recipient.

**Why this priority**: Administrators and resellers handle quarantine requests for their customers
and clean up large amounts of quarantined mail. Bulk actions make that practical on a phone.

**Independent Test**: Against the mock API with 250 items across five domains, sign in as an
administrator, as a domain administrator of two domains with and without the quarantine actions
permission, at both widths. Use every filter, search and sort, select items across pages, run each
bulk action with mocked partial failures, a whole-request refusal and a dropped connection, and
compare the results shown with the mock responses.

**Acceptance Scenarios**:

1. **Given** a domain administrator of two of five domains, **When** they open Quarantine, **Then**
   the list shows only items of those domains, the recipient is shown, and the domain filter offers
   only their two domains.
2. **Given** a list filtered to the action "Junk folder" and the virus state "High", sorted by score
   descending, on page 2, **When** the administrator reloads the page or shares its address,
   **Then** the same filters, sort and page are shown.
3. **Given** 40 selected items across two pages, one of which was removed in the meantime, **When**
   the administrator delivers them with learning, **Then** the confirmation names the action and
   the 40 items, and afterwards the summary shows 39 done and 1 not found, with each item listed.
4. **Given** a selection of 100 items, **When** the administrator tries to select another, **Then**
   the app refuses and states the limit of 100.
5. **Given** a bulk removal whose connection drops before the response, **When** the app gives up
   waiting, **Then** it reports the outcome as unknown, refreshes the list and does not send the
   request again.
6. **Given** a domain administrator without the quarantine actions permission, **When** they open
   Quarantine, **Then** no selection or action is offered, and details remain viewable.
7. **Given** two administrators acting on the same item, **When** the second one's delivery is
   refused because the item is being processed, **Then** the app says another action is in progress
   for this item and refreshes it once after 5 seconds.
8. **Given** an item of bob@example.org opened by an administrator, **When** they select the
   recipient, **Then** the "Spam filter and limits" page of bob's mailbox opens.

---

### User Story 3 - Choose quarantine notifications (Priority: P2)

A mailbox user decides how often they are told about new quarantine items (never, hourly, daily or
weekly) and for which items (rejected, junk folder, or all categories), as far as their permissions
allow. An administrator or domain administrator sets the same values on a mailbox's "Spam filter and
limits" page, or for many mailboxes selected in the mailbox list.

**Why this priority**: Notifications are how most users learn about wanted mail in the quarantine,
but sensible defaults exist from mailbox creation.

**Independent Test**: As a mailbox user with and without each notification permission, as a
domain administrator and as an administrator, change both values on a single mailbox and in bulk
for 30 mailboxes with one out of scope, and verify the requests, the read-only presentation and the
per-mailbox results.

**Acceptance Scenarios**:

1. **Given** a mailbox user with both notification permissions, **When** they open Quarantine ›
   Notifications, choose "Daily" and save, **Then** the value is saved, the success is announced,
   and a note says the change applies at the next notification run.
2. **Given** a mailbox user without the category permission, **When** they open the page, **Then**
   the category is shown read-only with "Prohibited by ACL" and the missing permission's name, and
   the frequency can still be changed.
3. **Given** a mailbox that has no stored category, **When** its page opens, **Then** the category
   is shown as "Not set" and can be chosen.
4. **Given** a domain administrator who selected 30 mailboxes in the mailbox list, one of which was
   moved out of their scope meanwhile, **When** they choose "Set quarantine notifications", pick
   "Weekly" and confirm, **Then** the summary shows 29 done and 1 not found.
5. **Given** a value changed in the legacy UI after the page was loaded, **When** the user saves,
   **Then** the save is refused as outdated, their choice is kept, and the newly saved value is
   shown next to it with a choice to save again or discard.

---

### User Story 4 - Tune my spam filter (Priority: P2)

A mailbox user opens Spam filter. They see the scores in effect: from which score mail goes to the
junk folder and from which it is rejected, whether these are their own or the server's defaults,
shown as a green, yellow and red band. They change the two numbers or return to the server
defaults. They keep an allow list of senders that are never treated as spam and a block list of
senders that are always rejected, with wildcards, and they see the entries set for their whole
domain without being able to remove them.

**Why this priority**: Spam tuning reduces both missed spam and wrongly caught mail, but mailcow's
defaults work without it.

**Independent Test**: As a mailbox user with each combination of the spam score and spam policy
permissions, read, change and reset the spam score, add valid, invalid and duplicate patterns, and
remove single and several entries, at both widths, with Czech and English locales.

**Acceptance Scenarios**:

1. **Given** a mailbox without its own score on a server whose defaults are 8 and 15, **When** the
   user opens Spam filter, **Then** 8 and 15 are shown as the server defaults and the band states
   "below 8: not spam", "8 to below 15: junk folder", "15 and above: rejected".
2. **Given** the spam score permission and the Czech locale, **When** the user enters "6,5" and "12"
   and saves, **Then** the values 6.5 and 12 are sent and the band shows them in Czech number format.
3. **Given** a junk value of 12 and a reject value of 6, **When** the user tries to save, **Then**
   the app shows that the junk value must not be above the reject value and sends nothing.
4. **Given** equal values of 10 and 10, **When** the user saves, **Then** the app explains that the
   reject value is raised by 0.1 and afterwards shows 10 and 10.1.
5. **Given** a custom score, **When** the user confirms "Reset to server default", **Then** the
   server defaults are shown as in effect.
6. **Given** the spam policy permission, **When** the user adds "*@Spam.Example " to the Denylist,
   **Then** the entry `*@spam.example` appears in the Denylist and the field is ready for the next
   entry. **When** they add the same pattern to the Allowlist, **Then** the app says it is already
   on the Denylist and adds nothing.
7. **Given** the pattern `user+tag@example.org`, **When** the user tries to add it, **Then** the
   app states which characters are allowed and sends nothing.
8. **Given** a domain Denylist entry, **When** the user views the Denylist, **Then** the entry
   appears in the group "Set for example.org", read-only, without a remove control.
9. **Given** three selected own entries, one of which was removed elsewhere, **When** the user
   confirms the removal, **Then** two are reported removed and one as already gone.
10. **Given** neither the spam score nor the spam policy permission, **When** the user looks at the
    navigation, **Then** no Spam filter entry is offered (UI feature 001 catalogue).

---

### User Story 5 - Manage spam policy for domains, alias domains and mailboxes (Priority: P2)

An administrator, or a domain administrator with the spam policy permission, keeps allow and block
lists for a domain or alias domain, and sees the entries of the domain's mailboxes read-only. On a
mailbox's page they manage the mailbox's lists and spam score on behalf of its user.

**Why this priority**: Domain-wide lists protect every user of a domain at once, but they are
maintained occasionally.

**Independent Test**: As an administrator and as a domain administrator with and without the spam
policy permission, open the "Spam filter and limits" page of a domain, an alias domain and a
mailbox, add and remove entries, change and reset a mailbox's spam score, and verify read-only
presentation, inherited groups and links to owners.

**Acceptance Scenarios**:

1. **Given** a domain administrator with the spam policy permission, **When** they add `*@ads.test`
   to the Denylist of an alias domain of their domain, **Then** the entry appears there.
2. **Given** a domain with two mailbox entries, **When** its page shows the Allowlist, **Then** the
   mailbox entries appear in the group "Set for mailboxes", each labelled with its mailbox and
   linking to that mailbox's page, without a remove control.
3. **Given** a domain administrator without the spam policy permission, **When** they open a
   domain's page, **Then** the lists are shown with "Prohibited by ACL" and no add or remove
   control.
4. **Given** an administrator on a mailbox's page, **When** they set its spam score to 4 and 9,
   **Then** the values are saved for that mailbox even if its user lacks the spam score permission.
5. **Given** a resource (location, thing or group), **When** its mailbox page is shown, **Then** no
   "Spam filter and limits" link is offered.

---

### User Story 6 - Limit how much a domain or mailbox may send (Priority: P2)

An administrator, or a domain administrator with the rate limit permission, sets how many messages
a domain, alias domain or mailbox may send per second, minute, hour or day, for example to contain a
compromised account, and removes the limit later. A mailbox shows the limit in effect and whether it
comes from the mailbox or from its domain. The Rate limits overview lists every limit in scope. An
administrator who saw in the rate-limited log that a sender is blocked resets that bucket.

**Why this priority**: Rate limits protect the server's reputation, but they are an exceptional
measure.

**Independent Test**: As each role, with and without the rate limit permission, open the overview,
filter by kind, set, change and remove limits on a domain, an alias domain and a mailbox, display a
stored value in an invalid format, and reset existing and unknown buckets.

**Acceptance Scenarios**:

1. **Given** a domain administrator with the rate limit permission, **When** they set "100 msgs /
   hour" on their domain, **Then** the limit is saved, and a mailbox of that domain without its own
   limit shows "100 msgs / hour, from the domain".
2. **Given** that domain limit, **When** they set "10 msgs / minute" on a mailbox and later confirm
   "Remove limit", **Then** the mailbox first shows its own limit and afterwards the domain's limit
   again; the removal dialog says that the domain's limit will apply.
3. **Given** a value of 0, **When** the user tries to save, **Then** the app states the allowed range
   of 1 to 2,147,483,647 and sends nothing.
4. **Given** limits on 3 domains, 1 alias domain and 4 mailboxes, **When** an administrator filters
   the overview to mailboxes, **Then** exactly the 4 mailbox limits are listed, each linking to its
   mailbox's page.
5. **Given** a stored limit in an invalid format, **When** its page is shown, **Then** the stored
   text is shown with a warning and actions to replace or remove it.
6. **Given** an administrator, **When** they enter a bucket identifier on the overview and confirm
   the reset, **Then** success is reported; **When** the identifier matches nothing, **Then** the app
   says there was nothing to reset.
7. **Given** a domain administrator without the rate limit permission or a mailbox user, **When**
   they reach a rate limit, **Then** it is read-only for the domain administrator and not offered at
   all to the mailbox user.

---

### User Story 7 - Configure the quarantine system (Priority: P2)

An administrator opens Quarantine › Settings and configures how many items are kept per mailbox,
the largest message that is quarantined, the maximum age of items, which domains are never
quarantined, whether released messages are delivered unmodified or as an attachment, and the
notification e-mail: the score above which items are left out, the sender, the subject, an optional
copy recipient, an optional redirect recipient and the HTML template.

**Why this priority**: The quarantine is inactive until an administrator sets a retention and a
maximum size, but the settings change rarely.

**Independent Test**: As an administrator, open the settings of a fresh server, edit each section
with valid and invalid values, choose and remove excluded domains including a stale one, restore
the default template, and provoke an outdated save. As a domain administrator and a mailbox user,
confirm that the page is not offered.

**Acceptance Scenarios**:

1. **Given** a server on which nothing was saved, **When** the administrator opens the settings,
   **Then** the page states that the quarantine is inactive because retention and maximum size are
   0, and shows the defaults (maximum age 365 days, unmodified original, sender
   `quarantine@localhost`, subject "Spam Quarantine Notification", default template).
2. **Given** that state, **When** they set a retention of 20 and a maximum size of 15 MiB, **Then**
   the page reports the quarantine as active.
3. **Given** a copy recipient "not-an-address", **When** they save, **Then** the field shows a
   translated error and the error summary leads to it.
4. **Given** an excluded domain that has since been deleted, **When** the section is edited, **Then**
   the entry is flagged "no longer exists" and can be kept or removed, but not re-added.
5. **Given** a custom template, **When** the administrator confirms "Restore default template",
   **Then** the default template is shown, marked as the default.
6. **Given** a template containing `<img src=x onerror=alert(1)>`, **When** it is shown or edited,
   **Then** it appears only as source text and nothing is rendered.

---

### User Story 8 - See how the spam filter handled mail (Priority: P3)

An administrator opens Quarantine › Statistics and sees how many messages the spam filter rejected,
soft-rejected, marked by rewriting the subject, moved to the junk folder or let through, with each
share of the total.

**Why this priority**: It is an overview. Nothing else depends on it.

**Independent Test**: As an administrator, open the page with mocked counts, with all counts zero
and with the spam filter unreachable; as a domain administrator, confirm that it is not offered.

**Acceptance Scenarios**:

1. **Given** counts of 120 rejected, 30 soft-rejected, 0 subject rewritten, 250 junk and 600 no
   action, **When** the page opens, **Then** each action is listed with its count, its percentage of
   1,000 and a bar, in text and in the user's number format.
2. **Given** an unreachable spam filter, **When** the page opens, **Then** it says the statistics are
   temporarily unavailable and offers a retry.

---

### User Story 9 - Trace quarantine and spam policy changes (Priority: P3)

An administrator investigating "my mail disappeared" or "who allowed this sender?" opens the history
of the quarantine settings, a mailbox's or domain's spam settings, or a rate limit, and sees who
released, learned or removed which item, who changed which list, score, limit or setting, when, from
where and with which outcome.

**Why this priority**: The audit log exists from UI feature 001; this story only adds the entries
of this feature.

**Independent Test**: As an administrator, open History from each page of this feature and check
the filters and the presentation of each kind of record from the mock.

**Acceptance Scenarios**:

1. **Given** a released item, **When** the administrator views its record, **Then** it shows the
   actor, time, client address, queue identifier, recipient, SMTP sender, action and each step's
   outcome, and no subject or content.
2. **Given** a template change, **When** its record is shown, **Then** it says the template changed
   with its old and new sizes.
3. **Given** a domain administrator, **When** they look for History, **Then** it is not offered.

---

### Edge Cases

- **Quarantine inactive**: the notice is shown on the list for every role; listing and actions keep
  working.
- **Empty quarantine**: an empty state says no messages are in quarantine; with search or filters
  active it says nothing matches and offers to clear them.
- **Item removed in the meantime** (by another user, the legacy UI, the age cleanup or a quick link):
  opening or acting on it gives "not found"; the app says it was already released or removed,
  returns to the list and refreshes it.
- **Item being processed** by another request: the app says so, keeps the item and refreshes it
  once after 5 seconds.
- **Delivery refused by the mail server**: the item is kept; the message includes the mail server's
  answer as plain text.
- **Mail server or spam filter unreachable**: for a delivery, the item is unchanged and a retry is
  offered; for learning as spam, the item is kept and a retry is offered; for a delivery whose
  learning failed, the delivery is reported as done with a warning.
- **Item without score or subject**: shown with "–" and "(no subject)".
- **Unknown filter action value**: shown as stored, untranslated, with a neutral marker.
- **Unparseable message**: the converted text is shown and the plain-text section says it is
  unavailable.
- **Message over 10 MiB**: summary and filter results only; downloads are not offered, and a refused
  download explains that the message is too large.
- **Hostile content**: markup, scripts, remote image references, very long lines, right-to-left
  override characters and control characters in any message field are shown as inert text without
  affecting the layout of the screen.
- **Attachment with a dangerous type or a strange name**: shown by its safe name as text; downloaded
  only as a file.
- **Bulk selection containing items that vanished**: reported as not found; the others are
  processed.
- **Connection lost during a bulk action**: outcome unknown, list refreshed, no automatic repeat.
- **Permission withdrawn while working**: a refusal naming the permission refreshes the identity and
  removes the controls; unsaved input elsewhere is kept.
- **Domain administrator loses a domain**: its items and pages answer "not found" and are treated as
  above.
- **Spam score defaults are fallback values**: shown with a note that the server's thresholds could
  not be determined.
- **Spam score with only one stored value**: shown as custom; saving or resetting repairs it.
- **Pattern in upper case or with spaces**: shown lower-cased and trimmed before it is sent.
- **Pattern of wildcards only, or over 100 characters**: refused before sending with the rule.
- **Inherited entry removed by its owner meanwhile**: disappears after the next refresh.
- **Rate limit removed while not set**: reported as done; nothing changed.
- **Invalid stored rate limit**: shown with its stored text, replaceable and removable.
- **Bucket identifier with invalid characters**: refused before sending, naming the expected form.
- **Stale excluded domain**: flagged; kept or removed, never re-added.
- **Template larger than 1 MiB**: the size indicator shows the limit and saving is prevented.
- **Outdated save** of settings, a spam score, notification settings or a rate limit: handled as in
  UI feature 002 (input kept, changed values shown, save again or discard).
- **Shared store unavailable**: the app says nothing was changed and offers a retry with the input
  kept.
- **Statistics unavailable**: error state with retry; zero counts show 0 % without dividing by zero.
- **Mailbox page of a resource**: not offered; its address shows the "not found" page.
- **Very many list entries or quarantine items** (the API is sized for 100,000 items): paged; no
  screen loads more than one page at a time.

## Requirements *(mandatory)*

### Functional Requirements

#### Access and navigation

- **FR-001**: The "Quarantine" entry of the UI feature 001 navigation MUST open the quarantine list
  for every role. The section MUST additionally offer "Notifications" to mailbox users, "Rate
  limits" to administrators and domain administrators, and "Settings" and "Statistics" to
  administrators. The "Spam filter" entry of UI feature 001 MUST open the mailbox user's own spam
  score and allow and block lists.
- **FR-002**: The app MUST offer exactly what the user's role and permission flags allow, as
  reported by the API's identity (UI feature 001). Permissions are named by their legacy labels:

  | Capability | Administrator | Domain administrator | Mailbox user |
  |---|---|---|---|
  | List and open quarantine items | All | Own domains' mailboxes | Own mailbox |
  | Attachment details and downloads | Yes | Yes | With "Quarantine attachments" |
  | Download the whole message | Yes | With "Quarantine actions" | With "Quarantine actions" and "Quarantine attachments" |
  | Deliver, learn as spam, remove (single and bulk) | Yes | With "Quarantine actions" | With "Quarantine actions" |
  | Quarantine status notice (active, retention, maximum size) | Yes | Yes | Yes |
  | Quarantine settings page | Yes | Not offered | Not offered |
  | Notification frequency of a mailbox | All, also in bulk | Own domains' mailboxes, also in bulk | Own, with "Change quarantine notifications" |
  | Notification category of a mailbox | All, also in bulk | Own domains' mailboxes, also in bulk | Own, with "Change quarantine notification category" |
  | Spam score of a mailbox (read / change and reset) | All | Own domains' mailboxes | Own / with "Spam score" |
  | Allow and block lists of domains and alias domains (read / change) | All | Own domains and their alias domains / with "Denylist/Allowlist" | Not offered |
  | Allow and block lists of a mailbox (read / change) | All | Own domains' mailboxes / with "Denylist/Allowlist" | Own / with "Denylist/Allowlist" |
  | Rate limits and overview (read / set and remove) | All | Own domains, alias domains and mailboxes / with "Rate limit" | Not offered |
  | Reset a rate-limit bucket | Yes | Not offered | Not offered |
  | Spam filter statistics | Yes | Not offered | Not offered |
  | History | Yes | Not offered | Not offered |

- **FR-003**: Actions the user may not use MUST NOT be offered. Values the user may see but not
  change MUST be shown read-only with the note "Prohibited by ACL" and the name of the missing
  permission. A mailbox user without "Quarantine actions" MUST see a notice on the list and on each
  item that actions are disabled for their mailbox. A control MUST never be shown enabled for
  something the flags deny.
- **FR-004**: When the API refuses an action as forbidden, the app MUST show the translated reason,
  naming the missing permission when the API names it, refresh the identity and the affected data,
  and update the offered controls without discarding the user's other unsaved input.
- **FR-005**: The quarantine list (with its search, filters, sort and page), each quarantine item,
  the Notifications page, the Spam filter page, each "Spam filter and limits" page, the Rate limits
  overview, the Settings page and the Statistics page MUST have their own address that can be
  bookmarked, reloaded and shared. An address of an item or object that does not exist or lies
  outside the user's scope MUST show one and the same "not found" page with a way back.
- **FR-006**: For administrators and domain administrators, each domain, alias domain and mailbox in
  their scope MUST have a "Spam filter and limits" page. Mailbox users use the Spam filter and
  Notifications pages instead. It MUST be linked from the domain page (UI feature 002), the mailbox page and its
  read-only notification and rate limit values (UI feature 003), the alias domain page (UI feature
  004), the Rate limits overview and, for administrators and domain administrators, a quarantine
  item's recipient. Links MUST appear only once the target page exists in the app. Resources MUST
  NOT get this page or a link to it.
- **FR-007**: The mailbox's "Spam filter and limits" page MUST offer administrators and domain
  administrators a link to the quarantine list filtered to that mailbox.

#### Quarantine list

- **FR-008**: Above the list the app MUST show the quarantine status for every role: when inactive,
  the legacy notice that the configuration disables the quarantine; otherwise the maximum number of
  items kept per mailbox and the maximum message size, formatted as a size. The legacy explanation
  of the quarantine MUST be available as collapsible help text.
- **FR-009**: The list MUST show the items in the user's scope, page by page, with 25 (default), 50
  or 100 per page, the total number of matching items, and controls for the first, previous, next
  and last page with the current page number. The default order MUST be newest first.
- **FR-010**: Each entry MUST show the subject (or "(no subject)"), the SMTP sender, the arrival
  date and time, the spam score (or "–"), the filter action as a text badge ("Rejected", "Junk
  folder", "Rewrite subject", or the stored value), the virus state ("Danger: High" when a virus was
  found, otherwise "Neutral") and whether a notification included it. For administrators and domain
  administrators it MUST also show the recipient. The queue identifier and item identifier MUST be
  available in the entry's details.
- **FR-011**: On wide screens the list MUST be a table with a column for each value of FR-010. On
  small screens it MUST be a list of cards showing subject, sender, arrival time, action, score and
  virus state, with the remaining values available without leaving the list. Opening an entry MUST
  open the item.
- **FR-012**: The list MUST offer a free-text search over subject, sender, recipient and queue
  identifier that updates the results after the user stops typing.
- **FR-013**: The list MUST offer filters by action, virus state, notification state, arrival time
  range and spam score range, and for administrators and domain administrators also by recipient
  mailbox and recipient domain. The arrival time range MUST be chosen as a first and a last day,
  both included, in the user's time zone. The domain filter MUST offer only domains in the user's
  scope.
  Active filters MUST be shown as removable chips with a "clear all" control. On small screens the
  filters MUST open in a full-screen panel.
- **FR-014**: The list MUST be sortable, ascending or descending, by arrival time, identifier, queue
  identifier, spam score, sender, recipient, subject, action, virus state and notification state,
  through column headers on wide screens and a sort control on small screens.
- **FR-015**: Search, filters, sort, page and page size MUST be kept in the page address and MUST
  NOT be kept in browser storage.
- **FR-016**: The list MUST offer a refresh control. Changes of the result count MUST be announced.
- **FR-017**: The list MUST have a loading state that keeps the layout stable, an empty state that
  distinguishes "no items" from "nothing matches" (with a "clear filters" control), and an error
  state with a retry.

#### Quarantine item

- **FR-018**: An item MUST open as its own page on small screens and MAY open beside the list on wide
  screens, keeping the list's position for the way back. It MUST have loading, error and "not found"
  states.
- **FR-019**: The item MUST show, in sections:
  - Summary: subject, From header, SMTP sender, recipients each with its header (To, Cc, Bcc) and the
    envelope recipient marked as such, arrival date and time, message size, sending server address,
    queue identifier, item identifier, notification state, and for administrators the authenticated
    sender when present;
  - Filter result: the score with the action badge, the virus state, and the symbols, each with its
    name, score and options;
  - Fuzzy hashes, each with a copy action;
  - Content (FR-020);
  - Attachments (FR-023), only when the response contains attachment details.
- **FR-020**: The content section MUST show the plain-text part and the text converted from the HTML
  part as plain text, in this order, each under its legacy heading, keeping line breaks and wrapping
  long lines without horizontal scrolling. A missing part MUST be shown as "not available". A message
  too large to parse MUST show that the content is unavailable because the message exceeds the size
  limit.
- **FR-021**: Each content part longer than 20 lines MUST initially show its first 20 lines with a
  "Show full text" control that exposes its expanded state.
- **FR-022**: Symbols MUST be ordered as in legacy: positive scores from highest to lowest, then
  negative scores from lowest to highest, then zero scores. Each symbol's score MUST carry its sign
  in text, and its options MUST be readable without hovering.
- **FR-023**: Each attachment MUST show its file name, declared type, size, SHA-256 hash with a copy
  action, a "Search file hash @ VT" link (FR-084) and a download action (FR-036).
- **FR-024**: The item MUST offer the actions the user is permitted (FR-002): "Deliver to inbox"
  (releasing the item), "Learn as spam and delete", "Remove" and "Download (.eml)". On small screens
  these MUST stay reachable in an action bar without scrolling to the end of the content.
- **FR-025**: After a successful action on an open item, the app MUST return to the list in its
  previous state, without the item, remove the item from any selection, and show the outcome.

#### Acting on items

- **FR-026**: "Deliver to inbox" MUST open a confirmation that names the item by subject and sender
  and contains the switch "Also teach the spam filter that this is not spam", on by default, with an
  explanation. With the switch off, the dialog MUST explain that the message is delivered without
  learning. For a virus-flagged item the confirm control MUST stay disabled until the user ticks an
  acknowledgement of the danger.
- **FR-027**: "Learn as spam and delete" MUST open a destructive confirmation explaining that the
  filter learns the message as spam, remembers similar messages, and removes the item permanently.
- **FR-028**: "Remove" MUST open a destructive confirmation explaining that the item is removed
  permanently without teaching the filter.
- **FR-029**: After a delivery or a learning, the app MUST show each step's outcome from the action
  report: delivery (done), learning (learned, already learned, failed, not requested) and similar
  message hashes (done, skipped, failed, not requested). A failed learning or hash step after a
  successful delivery or learning MUST be shown as a warning on a successful action, not as a
  failure.
- **FR-030**: The app MUST handle these refusals: "not found" (the item was already released or
  removed; return to the list and refresh it), "item is being processed" (say so and refresh the
  item once after 5 seconds), "delivery refused" (the item is kept; show the mail server's answer as
  plain text), and temporary failure (say that the item is unchanged, naming the unavailable service,
  and offer a retry).
- **FR-031**: While an action is in progress, its controls MUST be disabled so that it cannot be sent
  twice. The app MUST NOT repeat an item action automatically.

#### Acting on several items

- **FR-032**: Users permitted to act (FR-002) MUST be able to select items and apply one action to the
  selection: "Deliver to inbox" (with the learning switch of FR-026), "Learn as spam and delete" or
  "Remove". Users not permitted MUST NOT be offered selection.
- **FR-033**: A selection MUST persist across pages, searches and filters until the user clears it or
  an action finishes, and MUST NOT exceed 100 items. "Select all" MUST select the items of the
  current page. The app MUST show the number selected and refuse further selections at the limit
  with a message that states it. On small screens, selection MUST start with an explicit "select"
  control, and each card MUST get a selection control of at least 44 × 44 CSS px.
- **FR-034**: Every bulk action MUST be confirmed in a dialog that names the action, its effect and
  the number of items, and lists the selected items by subject and recipient. The dialog MUST be
  marked destructive for learning as spam and removal. When the selection contains virus-flagged
  items and the action is a delivery, the dialog MUST state their number and require the
  acknowledgement of FR-026.
- **FR-035**: During a bulk action the app MUST show that it is in progress. Afterwards it MUST show
  the number of items per outcome (done, not found, failed) and every item with its translated
  outcome, including the step warnings of FR-029, and MUST announce the summary. Failed items MUST
  stay selected; the others MUST be deselected. A whole-request refusal MUST be shown as one message
  naming the reason, with the selection kept. When no response arrives, the app MUST report the
  outcome as unknown, refresh the list and MUST NOT repeat the request automatically.

#### Downloads

- **FR-036**: Attachment downloads and "Download (.eml)" MUST be offered only as FR-002 allows, and
  MUST save a file with the name the API provides. The app MUST NOT display or open a downloaded
  file itself.
- **FR-037**: Before a download from a virus-flagged item, the app MUST show a warning that the file
  may harm the device, and download only after confirmation.
- **FR-038**: A refused download MUST show the translated reason (message too large, permission
  missing, item or attachment not found).

#### Quarantine notifications

- **FR-039**: The Notifications page (mailbox user) and the notification panel of a mailbox's "Spam
  filter and limits" page MUST show the frequency (Never, Hourly, Daily, Weekly) and the category
  (Rejected, Junk folder, All categories) as single-choice groups with the legacy explanations. A
  mailbox without a stored category MUST show "Not set".
- **FR-040**: Saving MUST send only the changed values with the version tag read. Values the user may
  not change MUST be read-only (FR-003). The page MUST state that changes apply at the next
  notification run, which happens every 20 minutes, and that items already notified are not
  notified again.
- **FR-041**: The mailbox list of UI feature 003 MUST offer administrators and domain administrators
  the bulk actions "Set quarantine notifications" and "Set quarantine notification category" on the
  current selection. The user MUST choose the value, confirm in a dialog that names the action, the
  value and the number of mailboxes, and see the per-mailbox results (done, not found, refused,
  failed) under the selection and result rules of UI feature 003.

#### Spam score

- **FR-042**: The spam score panel (Spam filter page and a mailbox's "Spam filter and limits" page)
  MUST show the junk value and reject value in effect, whether they are custom or the server
  defaults, the server defaults themselves, and a note when the defaults are fallback values. A
  three-zone band MUST show the ranges "not spam" (below the junk value), "junk folder" (from the
  junk value to below the reject value) and "rejected" (from the reject value), each with the legacy
  explanation and stated in text.
- **FR-043**: Users permitted to change the score MUST be able to edit both values as numbers from 0
  to 5,000 with at most one decimal, typed with the locale's decimal separator. The app MUST check
  before sending that the junk value is not above the reject value, MUST explain that equal values
  raise the reject value by 0.1, and MUST send the change with the version tag read. After saving it
  MUST show the stored values.
- **FR-044**: "Reset to server default" MUST be confirmed and afterwards show the server defaults as
  in effect.

#### Allow and block lists

- **FR-045**: The lists panel (Spam filter page and each "Spam filter and limits" page) MUST present
  the allow list and the block list under the legacy names "Allowlist" and "Denylist" with the legacy
  descriptions. On small screens a two-option switch with each list's entry count MUST toggle
  between them; on wide screens both MUST be shown side by side.
- **FR-046**: Each entry MUST show its pattern and creation date. Own entries MUST come first.
  Inherited entries MUST follow in a separate group ("Set for <domain>" on a mailbox page, "Set for
  mailboxes" on a domain or alias domain page), each labelled with its owner, read-only, and linked
  to the owner's page when the user may reach it.
- **FR-047**: Each list MUST offer a search on the pattern, sorting by pattern (default) or creation
  date, and paging when it has more than 25 entries, with loading, empty and error states.
- **FR-048**: Users permitted to change the list MUST be able to add one pattern at a time to the
  allow or block list. Before sending, the app MUST show the pattern trimmed and lower-cased and MUST
  check that it contains only letters a to z, digits, `@`, `_`, `.`, `-` and `*`, at least one letter
  or digit, and at most 100 characters. The field MUST explain that `*` matches any characters,
  with the placeholder `*@example.org`. After a successful addition, the entry MUST appear and the
  field MUST be empty and focused for the next entry.
- **FR-049**: A conflict with an existing entry MUST be shown as "already on the Allowlist" or
  "already on the Denylist", naming the existing pattern, and nothing MUST be added.
- **FR-050**: Users permitted to change the list MUST be able to remove one own entry after a
  confirmation naming the pattern and the list, and to select several own entries and remove them
  after one confirmation. The app MUST send one request per entry, continue after failures, and
  report each result with a "retry failed" action. An entry already gone MUST be reported as already
  removed.
- **FR-051**: The panel MUST state that changes apply within 1 minute, that mail from a
  blocked sender is rejected and not quarantined, that mail from an allowed sender is never treated
  as spam, and, on mailbox pages, that the mailbox's entries take precedence over the domain's.

#### Rate limits

- **FR-052**: The rate limit panel of a "Spam filter and limits" page MUST show the object's limit as
  "<number> msgs / second|minute|hour|day" or "Disabled" when none is set. For a mailbox it MUST also
  show the limit in effect and whether it comes from the mailbox or from its domain (naming the
  domain), with the legacy explanation that a mailbox limit applies to everything the signed-in
  mailbox sends and overrides the domain's limit.
- **FR-053**: Users permitted to change limits MUST be able to set a whole number from 1 to
  2,147,483,647 and a time frame of second, minute, hour or day. The app MUST check the range before
  sending and send the change with the version tag read.
- **FR-054**: "Remove limit" MUST be confirmed in a dialog that states the effect, including, for a
  mailbox, the domain limit that will apply instead, or that no limit will apply.
- **FR-055**: A stored limit in an invalid format MUST be shown with its stored text and a warning,
  and MUST be replaceable and removable.
- **FR-056**: The Rate limits overview MUST list the objects with a limit set in the user's scope,
  with their kind (domain, alias domain, mailbox) and limit, page by page as in FR-009, with a kind
  filter, a search on the object, sorting by object (default) or kind, cards on small screens and a
  table on wide screens, and loading, empty and error states. Each entry MUST link to the object's
  "Spam filter and limits" page.
- **FR-057**: Users permitted to change limits MUST be able to start "Set a rate limit" from the
  overview: choose the kind, find the object in their scope by searching the domains, alias domains
  or mailboxes, and continue on that object's rate limit panel.
- **FR-058**: Administrators MUST be able to reset a rate-limit bucket through a "Remove hash" action
  on each entry of the rate-limited log of UI feature 011, and through "Reset a rate-limit bucket" on
  the overview, where they enter an identifier that the app checks for the form "RL" followed by
  letters, digits and "=" before sending. Both MUST be confirmed with the legacy explanation that the
  bucket's counter is reset completely. Success and "nothing to reset" MUST be reported distinctly.

#### Quarantine settings

- **FR-059**: The Settings page MUST show at the top whether the quarantine is active and, when
  inactive, that retention and maximum size must both be above 0. It MUST show four sections:
  - Storage and limits: retention per mailbox, maximum message size, maximum age in days, excluded
    domains;
  - Release: the release format ("Unmodified original" or "As attachment");
  - Notification e-mail: score limit, sender, subject, copy (BCC) recipient, redirect recipient;
  - Template: the notification template.
- **FR-060**: Each section MUST have its own Edit action that saves only that section's values with
  the version tag read. On small screens the section form MUST open full screen.
- **FR-061**: The fields MUST use the legacy labels and help texts: retention as a whole number where
  0 means inactive; maximum size entered in MiB where 0 means inactive and not unlimited, with a note
  that messages above 10 MiB never reach the quarantine; maximum age as a whole number of days of at
  least 1; the score limit as an optional decimal where empty means 9999.0; sender, copy and redirect
  recipients as e-mail addresses or empty, the latter two with the legacy warning that this mail is
  unsigned and unchecked and should be delivered internally only; the subject up to 255 characters.
  Empty fields MUST show the value that applies when empty.
- **FR-062**: Excluded domains MUST be chosen in a searchable picker of the server's domains and alias
  domains, shown by their readable names. A stored entry whose domain no longer exists MUST be flagged
  "no longer exists" and MAY be kept or removed, but MUST NOT be offered for adding.
- **FR-063**: The template MUST be shown and edited only as source text in a monospace field and MUST
  never be rendered or previewed. The section MUST show whether the default template is in use, a
  size indicator against the 1 MiB limit that prevents saving above it, a reference of the
  documented placeholders with a copy action each, a note that quick links built from an item's hash
  lead to the legacy quick release and delete pages, and a note that the notifier falls back to the
  default template when it cannot use the saved one. "Restore default template" MUST be confirmed.
- **FR-064**: After saving, the page MUST state when the change takes effect: immediately for new
  items, at the next notification run for notifications, at the next daily cleanup for the maximum
  age, and with a mailbox's next item for the retention, and that existing items are not removed by
  the change itself.

#### Spam filter statistics

- **FR-065**: The Statistics page MUST list the actions rejected, soft-rejected (including
  greylisted), subject rewritten, junk folder and no action, each with its count, its percentage of
  the total and a proportional bar, plus the total, all in text, and state that the counts run since
  the spam filter's statistics were last reset. It MUST offer a refresh, show 0 % when the total is
  zero, and show an error state with a retry when the spam filter cannot be reached.

#### History

- **FR-066**: Administrators MUST be able to open History from the Settings page, from each "Spam
  filter and limits" page and from each Rate limits entry. History MUST open the audit log screen of
  UI feature 001 filtered to that target. That screen MUST gain the target types of this feature
  (quarantine item, quarantine settings, notification settings, spam score, list entry, rate limit,
  rate-limit bucket) as filters, and MUST present their records: for item actions the queue
  identifier, recipient, SMTP sender, action and each step's outcome; for other changes the old and
  new values in the user's units and language; for the template only that it changed, with old and
  new size; for list entries the owner, list and pattern; for bucket resets the identifier, whether
  counters existed and the number of log entries removed; records of one bulk action recognisable as
  such.

#### Errors and feedback

- **FR-067**: Every API error MUST be shown as a translated message built from the error code and the
  validation rule codes, never as the API's English text. This feature MUST translate at least: not
  found, permission required (naming the permission with its legacy label), outdated version, list
  entry already exists, message too large, item being processed, delivery refused, temporary failure
  (naming the shared store, the spam filter or the mail server), and the validation rules of every
  field of this feature with their parameters, including the bulk limit. Unknown rule codes MUST be
  shown as a generic invalid value of that field.
- **FR-068**: Forms MUST show field errors next to their field and in an error summary at the top
  whose entries lead to the fields.
- **FR-069**: When a change is refused as outdated, the app MUST keep the user's unsaved values, load
  the latest saved data, mark each value that changed in the meantime with its new saved value, and
  ask the user to save again or discard, as in UI feature 002. It MUST never merge or re-send on its
  own.
- **FR-070**: Every page and panel of this feature MUST have a loading state and, when its data
  cannot be loaded, an error state with a retry. When the API reports a temporary failure for a
  change, the app MUST say that nothing was changed and offer a retry that keeps the input.
- **FR-071**: The outcome of every change MUST be shown and announced to screen reader users. A status
  message MUST NOT disappear while it has focus or is hovered.

#### Mobile and responsive behaviour

- **FR-072**: Every screen and state of this feature MUST be fully usable at 360 px width without
  horizontal scrolling, and its content MUST reflow at 400 % zoom on a 1,280 px wide screen. Long
  subjects, addresses, patterns, hashes and lines of message text MUST wrap.
- **FR-073**: Interactive targets MUST be at least 44 × 44 CSS px. On small screens the item actions,
  the bulk actions with the selection count, and the save and cancel actions of forms MUST stay
  reachable without scrolling to the end.
- **FR-074**: Number fields MUST bring up a numeric keypad, with a decimal keypad for spam values and
  the score limit. Fields for patterns, addresses, domains, bucket identifiers and the template MUST
  NOT auto-capitalise or auto-correct, and address fields MUST bring up an e-mail keyboard.

#### Accessibility

- **FR-075**: Every screen of this feature MUST meet WCAG 2.2 AA. Every function MUST be operable by
  keyboard, including selection, filters, sorting, the list switch, pickers and dialogs, and the
  focus MUST be visible and never hidden behind sticky bars.
- **FR-076**: Tables MUST have header cells, and sortable headers MUST expose the current sort
  direction. Card lists MUST be exposed as lists, with the subject, pattern or object as each card's
  heading.
- **FR-077**: Changes of the result count, bulk progress and results, action outcomes and save
  outcomes MUST be announced as status messages without moving the focus.
- **FR-078**: Dialogs MUST be labelled, keep the focus inside, close with Escape unless an action is
  in progress, and return the focus to the control that opened them. Opening a form or an item MUST
  move the focus to its heading; a failed submission MUST move it to the error summary.
- **FR-079**: Action badges, virus and notification states, symbol scores, spam score zones,
  statistics bars and outcome markers MUST have text equivalents and MUST NOT rely on colour alone,
  with sufficient contrast in the light and dark themes.

#### Internationalisation

- **FR-080**: All text of this feature MUST come from the translation files and MUST be complete in
  English, Czech and Slovak. Legacy translation keys MUST be reused where the meaning is unchanged;
  legacy texts that contain markup MUST be carried over without it.
- **FR-081**: Dates and times MUST be shown in the user's locale and time zone, numbers and scores
  with the locale's separators, and sizes in binary units formatted for the locale.
- **FR-082**: Message data (subjects, addresses, text, symbol names and options, file names, hashes),
  patterns, object names and mail server answers MUST be shown as received and never translated.

#### Security

- **FR-083**: No data from the API or from a message MUST be rendered as markup on any screen of this
  feature. Message data MUST NOT cause any request: no remote images, styles or fonts, and links in
  message text MUST NOT be activated. Message strings MUST be isolated so that bidirectional and
  control characters cannot change the presentation of surrounding text.
- **FR-084**: The external hash lookup MUST open only on the user's explicit action, in a new browsing
  context, without passing on the app's address, and MUST carry only the attachment's hash.
- **FR-085**: Message content, attachment details and downloaded files MUST NOT be kept in browser
  storage, and data held in memory for this feature MUST be discarded on sign-out.

#### Data freshness

- **FR-086**: After a successful change, every screen that shows the changed item, setting, list,
  score or limit MUST show the new state, including the read-only values on the pages of UI features
  002, 003 and 004. The quarantine list MUST NOT refresh by itself on a timer. Data already loaded
  MUST NOT be loaded again without reason.

### Legacy Parity

Legacy reference: FeldHost fork of mailcow-dockerized (upstream tag `2026-09a`), `data/web/`
`templates/quarantine.twig`, `templates/modals/quarantine.twig`, `templates/qhandler.twig`,
`templates/user/Spamfilter.twig`, `templates/user/tab-user-settings.twig`,
`templates/edit/domain.twig`, `templates/edit/aliasdomain.twig`, `templates/edit/mailbox.twig`,
`templates/mailbox/tab-mailboxes.twig`, `templates/mailbox/rl-frame.twig`,
`templates/admin/tab-config-quarantine.twig`, `templates/dashboard.twig`, `js/site/quarantine.js`,
`js/site/qhandler.js`, `js/site/user.js`, `js/site/edit.js`, `js/site/dashboard.js`,
`inc/ajax/qitem_details.php` and `lang/lang.{en-gb,cs-cz,sk-sk}.json`. Status: **Matched** (same
capability), **Improved** (same capability, better behaviour) or **Dropped** (intentionally not in
this feature, with the reason).

#### Quarantine page

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Card header with count badge, Refresh | Total rows, reload | Matched | FR-009, FR-016 |
| "Disabled by config" alert, "settings info" line | Shown from the settings | Matched | FR-008 |
| Explanation text (`qinfo`, with markup) | Always shown | Improved: collapsible help, without markup | FR-008, FR-080 |
| Search box, page length 10/25/50/100/all, paging | Client-side over all items | Improved: server-side search, 25/50/100, totals | FR-009, FR-012 |
| No filters | — | Improved: action, virus, notification, time, score, recipient and domain filters | FR-013 |
| Sortable columns, saved table state in browser storage | DataTables `stateSave` | Improved: 10 sort keys, state in the page address | FR-014, FR-015 |
| Columns ID, Rspamd QID, Sender, Subject, Rspamd result, Recipient, Danger, Score, Notified, Received | Table with collapsed rows on phones | Improved: cards on phones; recipient shown only to administrators and domain administrators | FR-010, FR-011 |
| Notified ✓/✗, Danger High/Neutral, action badges | Icons and coloured badges | Improved: text badges | FR-010, FR-079 |
| Show item | Opens the detail modal | Improved: item page with its own address | FR-005, FR-018 |
| Row "Remove" button only when the `login_as` flag is set | Inconsistent gating | Improved: offered by the quarantine actions permission | FR-002, FR-024 |
| Toggle all, mass Deliver to inbox, Learn as spam and delete, Remove (top and bottom) | One request, toasts, no per-item result, no confirmation for delivery | Improved: selection across pages up to 100, confirmation, per-item results, retry | FR-032 to FR-035 |
| Expand all, Collapse all | DataTables child rows | Dropped: cards and expandable entries replace collapsed rows | FR-011 |

#### Quarantine item modal

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Extra-large modal | Fixed layout | Improved: own page on phones | FR-018 |
| Rspamd result: score and action badge | — | Matched | FR-019 |
| Symbols with sign colours and options in tooltips | Hover-only options | Improved: options readable without hover, sign in text | FR-022, FR-079 |
| Subject, Recipients with type, From header, SMTP sender, Fuzzy hashes | — | Matched; hashes copyable | FR-019 |
| — | Not shown | Improved: size, sending server, queue identifier, authenticated sender (administrators) | FR-019 |
| Content (text/plain), Content (converted html) in preformatted blocks | Text only | Matched as inert text; improved with collapsing and wrapping | FR-020, FR-021, FR-083 |
| Attachments with download link and "Search file hash @ VT" (with `quarantine_attachments`) | Link opens VirusTotal | Matched; hash shown and copyable, download as file only | FR-023, FR-036, FR-084 |
| Actions Deliver to inbox, Learn as spam and delete, Remove | No confirmation for delivery | Improved: confirmations, learning switch, virus acknowledgement, step report | FR-026 to FR-029 |
| Download (.eml) | Offered with the quarantine flag; server checks no flag | Matched with the API's stricter permission | FR-002, FR-036 |
| Open quick release link, Open quick delete link | Opens the hash page in a new window | Improved: delivery without learning is the switch of "Deliver to inbox"; deletion is "Remove" | FR-026, FR-028 |
| "Error loading quarantine item" (English only) | Generic | Improved: translated, specific reasons | FR-030, FR-067 |
| Message over 10 MiB | Error message only | Improved: summary and filter results still shown | FR-020 |

#### Quick release and delete page (notification links)

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| `/qhandler/release/<hash>`, `/qhandler/delete/<hash>`, Confirm, success text | Opens without sign-in | Dropped: stays in the legacy component (API 006 keeps the hash pages in php-fpm and never exposes the hash) | — |

#### User page: Spam filter and Settings tabs

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Rating slider with two handles, non-linear 0 to 5,000 | Drag only | Improved: two number fields with a three-zone band | FR-042, FR-043 |
| Green / yellow / red explanations | — | Matched | FR-042 |
| Save, Reset to server default | Reset without confirmation; equal values silently raised | Improved: reset confirmed, junk ≤ reject checked, 0.1 rule explained | FR-043, FR-044 |
| — | Server defaults not shown | Improved: defaults and fallback note shown | FR-042 |
| Allowlist / Denylist with descriptions, add field `*@example.org`, Add item | Errors only after sending | Improved: pattern rules checked before sending, conflict names the list | FR-045, FR-048, FR-049 |
| Tables ID, Rule, Scope; domain entries with disabled checkbox "n/a (domain policy)" | — | Improved: inherited group labelled with its owner | FR-046 |
| Toggle all, Remove selected, Expand/Collapse all | One request | Improved: per-entry results and retry; Expand/Collapse dropped as for the quarantine list | FR-050 |
| Quarantine notifications Never/Hourly/Daily/Weekly | Saves on click | Matched as a form with version check, on Quarantine › Notifications | FR-039, FR-040 |
| Quarantine notification category Rejected/Junk folder/All categories | Saves on click | Matched, with "Not set" | FR-039, FR-040 |

#### Edit mailbox page and mailbox list

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Quarantine notification and category button groups | Saves on click | Matched on the mailbox's "Spam filter and limits" page | FR-039, FR-040 |
| Rate limit tab: value, frame, Save, info text | Empty value removes the limit | Improved: explicit "Remove limit" with its effect; effective limit and source shown | FR-052 to FR-054 |
| — | No mailbox lists or spam score for administrators | Improved: managed on the mailbox's page | FR-042 to FR-050 |
| Mailbox list mass actions for notification frequency and category | One request, toasts | Improved: confirmation, per-mailbox results | FR-041 |

#### Edit domain and alias domain pages

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Rate limit tab (domain), rate limit form (alias domain) | Empty value removes | Improved: explicit removal, invalid stored values shown | FR-052 to FR-055 |
| Spam filter tab: Allowlist / Denylist, add, toggle all, remove selected | — | Matched; mailbox entries shown as inherited | FR-045 to FR-051 |
| — | No alias domain lists in the UI | Improved: alias domains get lists | FR-006, FR-045 |
| — | No overview of rate limits | Improved: Rate limits overview | FR-056, FR-057 |

#### Admin › Configuration › Quarantine

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| "Disabled by config" alert | — | Matched, with the reason | FR-059 |
| Retention, maximum size (MiB), maximum score, maximum age | Number inputs; invalid values silently changed | Improved: rules and translated field errors | FR-061, FR-068 |
| Redirect, BCC with warnings; sender; subject | Invalid addresses silently emptied | Improved: field errors | FR-061 |
| Release format | Select | Matched | FR-059 |
| Exclude domains and alias-domains | Multi-select | Improved: searchable picker, stale entries flagged | FR-062 |
| Notification template textarea (collapsed), empty restores default | — | Improved: size limit, placeholder reference, confirmed restore, default marker | FR-063 |
| Single Save for the whole form | Last write wins | Improved: per-section saves with version check | FR-060, FR-069 |

#### Dashboard

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Rspamd doughnut chart (`rspamd/actions`) | Colour-only chart | Improved: text list with percentages and bars on Quarantine › Statistics | FR-065 |
| Rate-limited log "Remove hash" with explanation | Per log entry | Matched in UI feature 011's log, plus reset by identifier | FR-058 |
| Rate-limited log itself, Rspamd history | Tables | Dropped: UI feature 011 | — |

### API Dependency

This feature depends on **mailcow REST API v2 feature 006, Quarantine, Spam Policy and Rate Limits**
(`mailcow-rest-v2/specs/006-quarantine-spam-policy/spec.md`), and on the identity, error conventions
and audit log of API feature 001. It uses the domain, alias domain and mailbox lists of API features
002, 003 and 004 for pickers and filters, and the rate-limited log of API feature 011 for bucket
identifiers. The contract version is pinned in the plan, once the API 006 contract has been merged.

| Behaviour relied on | API requirement |
|---|---|
| Scope per role; "not found" outside the scope; forbidden naming the missing flag | API 006 FR-001 to FR-004 |
| Flags as legacy takes them; permission matrix | API 006 FR-005, FR-006 |
| Item list fields, paging (default 25), total, search, filters, sort keys | API 006 FR-007 to FR-011 |
| Item details, parsed content without HTML, attachment details only when permitted, size limit, no hash | API 006 FR-012 to FR-015 |
| Attachment and whole-message downloads as files | API 006 FR-016 to FR-018 |
| Release with optional learning, learning as spam, deletion, action report | API 006 FR-019 to FR-025 |
| At most one action per item; "item is being processed" | API 006 FR-026 |
| Bulk item actions up to 100 with one result per item | API 006 FR-027 |
| Quarantine settings, rules, defaults, template default marker, effect timing, public subset | API 006 FR-029 to FR-034 |
| Notification settings, single and bulk | API 006 FR-035 to FR-038 |
| Spam score read, set, reset, defaults and fallback | API 006 FR-039 to FR-042 |
| Allow and block lists with ownership, paging, search, sort, add, conflict, remove | API 006 FR-043 to FR-049 |
| Rate limits with effective mailbox limit, list, set, remove, invalid stored values | API 006 FR-050 to FR-056 |
| Rate-limit bucket reset | API 006 FR-057 |
| Spam filter action statistics | API 006 FR-058 |
| Version tags and outdated refusal | API 006 FR-059, FR-060 |
| Temporary failures | API 006 FR-061, FR-062 |
| Audit records with target filters | API 006 FR-063, FR-064; API 001 FR-046, FR-047 |
| Problem types and validation rule codes | API 006 FR-065; API 001 FR-049, FR-055 |
| Resources not addressable for mailbox-level settings | API 006 FR-069 |
| Role, scope and permission flags of the signed-in user | API 001 FR-028, FR-029 |
| Domain, alias domain and mailbox lists for the excluded-domain picker, the domain filter and "Set a rate limit" | API 002 FR-011 to FR-013; the list operations of API features 003 and 004 |
| Rate-limited log entries with bucket identifiers | API feature 011 |

**Gaps in the API that this feature does not work around** (to be specified in mailcow-rest-v2 if
wanted; until then the app behaves as stated):

1. The spam filter statistics do not say since when they are counted. The page states only that
   they run since the filter's statistics were last reset (FR-065).
2. The notification template is neither validated nor previewable. An administrator can save a
   template the notifier cannot use, which it then silently replaces with the default; the app can
   only say so (FR-063).

### Key Entities *(include if feature involves data)*

- **Quarantine item**: a message kept for one mailbox, as the API returns it: identifiers, subject,
  senders, recipient, score, action, virus and notification state, arrival time, and in its details
  the symbols, hashes, size, sending server, parsed text and, when permitted, attachment details.
- **Action report**: the outcome of the delivery, learning and hash steps of one release or learning.
- **Bulk run**: a selection of up to 100 items or mailboxes, one action, and the outcome per target.
- **Quarantine status**: whether the quarantine is active, the retention and the maximum size.
- **Quarantine settings**: retention, size, age and score limits, excluded domains, release format,
  notification sender, subject, copy and redirect recipients and template, with a version tag.
- **Notification settings**: a mailbox's frequency and category, with a version tag.
- **Spam score**: a mailbox's junk and reject values in effect, whether custom, the server defaults
  and whether they are fallback values, with a version tag.
- **List entry**: an allow or block pattern with its owner, creation time and ownership relative to
  the page.
- **Rate limit**: an object's limit or none, its kind, for mailboxes the limit in effect and its
  source, with a version tag.
- **Spam filter statistics**: message counts per action.
- **List view**: the search, filters, sort, page and page size of the quarantine list, a list panel
  or the rate-limit overview.
- **History entry**: an audit record about an item action or a change made by this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A mailbox user finds a quarantined message by its sender and delivers it to the inbox
  on a 360 px wide phone in under 1 minute.
- **SC-002**: In a test corpus of at least 50 hostile messages (scripts, event handlers, remote
  images, styles, links, right-to-left overrides, control characters, oversized lines), 100 % of
  subjects, addresses, texts, symbol options and file names are shown as inert text, 0 scripts run,
  0 requests are caused by message data, and the screen layout stays intact.
- **SC-003**: Automated accessibility checks report 0 WCAG 2.2 AA violations on every screen and state
  of this feature, at 360 px and at desktop width, in the light and dark themes.
- **SC-004**: No screen of this feature needs horizontal scrolling at 360 px width or at 400 % zoom on
  a 1,280 px wide screen.
- **SC-005**: In 100 % of the permission tests (administrator; domain administrator with and without
  each of its three flags; mailbox user with and without each of its six flags), the app offers
  exactly the capabilities of the permission matrix.
- **SC-006**: For 100 % of the items in the parity test set, every value the legacy quarantine list
  and item modal show is shown by the new app, allowing for formatting.
- **SC-007**: A bulk action on 100 items reports an individual outcome for all 100, and in tests with
  dropped connections the app never sends an item action twice.
- **SC-008**: 100 % of saves based on outdated data are stopped, and the user's unsaved input is still
  present afterwards.
- **SC-009**: 100 % of the error types and validation rules of API feature 006 are shown translated in
  English, Czech and Slovak with their parameters filled in, and translation checks find 0 missing
  keys.
- **SC-010**: When the API answers within 1 second, the first page of the quarantine list is visible
  within 2 seconds of opening it on a mid-range phone over a mobile connection, and search results
  update within 1 second after the user stops typing.
- **SC-011**: In a moderated test with at least 5 mailbox users, at least 90 % change their spam score
  and add a sender to their Denylist on a phone at the first attempt without help.

## Assumptions

- UI feature 001 provides the shell, the navigation catalogue with the Quarantine and Spam filter
  entries, sign-in, the identity with role, scope and permission flags, language and theme, session
  handling, generic translated error handling (including 401 and 403), status announcements, and
  the audit log screen, which this feature extends with its target types (FR-066).
- UI features 002, 003 and 004 provide the domain, mailbox and alias domain pages that link to this
  feature's "Spam filter and limits" pages; UI feature 003 provides the mailbox list's selection, to
  which this feature adds two bulk actions; UI feature 005's settings may link to Quarantine ›
  Notifications; UI feature 011 provides the rate-limited log, to which this feature adds the
  "Remove hash" action. Until a host page exists, this feature's pages are reached through their own
  entry points and addresses.
- The API 006 contract is merged before this feature is planned. Until the API is implemented, the
  feature is built and tested against a mock generated from the contract.
- The legacy quick release and delete pages behind notification links stay in the legacy component,
  and notification e-mails keep linking there.
- Legacy translation keys with unchanged meaning are reused, for example `quarantine.quarantine`,
  `quarantine.deliver_inbox`, `quarantine.learn_spam_delete`, `quarantine.remove`,
  `quarantine.download_eml`, `quarantine.rspamd_result`, `quarantine.spam_score`,
  `quarantine.sender`, `quarantine.sender_header`, `quarantine.recipients`, `quarantine.atts`,
  `quarantine.check_hash`, `quarantine.text_plain_content`, `quarantine.text_from_html_content`,
  `quarantine.disabled_by_config`, `quarantine.rejected`, `quarantine.junk_folder`,
  `quarantine.rewrite_subject`, `quarantine.high_danger`, `quarantine.neutral_danger`,
  `quarantine.notified`, `user.spamfilter*`, `user.spam_score_reset`, `user.quarantine_notification*`,
  `user.quarantine_category*`, `user.never`, `user.hourly`, `user.daily`, `user.weekly`,
  `user.q_reject`, `user.q_add_header`, `user.q_all`, `ratelimit.*`, `edit.ratelimit`,
  `edit.spam_filter`, `edit.mbox_rl_info`, `acl.*`, `admin.quarantine*`, `admin.reset_limit`,
  `admin.hash_remove_info`, `danger.policy_list_from_exists`, `danger.policy_list_from_invalid`,
  `danger.release_send_failed`, `danger.rl_timeframe`, `success.item_released`,
  `success.items_released`, `success.qlearn_spam`, `success.rl_saved`, `success.hash_deleted` and
  `warning.hash_not_found`. Texts whose meaning changes, and new texts (learning switch, step
  outcomes, virus acknowledgement, inherited groups), get new keys.
- The 20-line content preview, the single re-check after 5 seconds of an item being processed, and
  the page sizes are defaults of this feature.
- **Out of scope**: the quick release and delete pages; quarantine ingestion and notification
  sending; previewing the notification template; learning messages that are not in the quarantine;
  spam scores for domains; the rate-limited log itself, Rspamd history and statistics tabs, Rspamd
  settings maps and global filters; initial notification values, rate limits and permission flags at
  creation of domains, mailboxes and alias domains (UI features 002, 003 and 004); managing the
  permission flags themselves (UI features 003 and 007).
