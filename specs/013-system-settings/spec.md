# Feature Specification: System Settings

**Feature Branch**: `main` (no feature branches, constitution 1.1.0)

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "System settings screens for mailcowui-ng, the mobile-first web app for
mailcow-dockerized, built only on mailcow REST API v2 feature 013 (System settings). Administrators
find every server-wide setting in one grouped, searchable settings area that is easy to move
through on a phone. They brand the app: light and dark logos with a preview in both themes, a brand
colour per theme with a live preview and contrast feedback that keeps WCAG 2.2 AA, the UI texts and
the announcement, whose HTML fields get a safe preview, the login page options and the app links.
They opt in to the IP check, set
the password policy and the password reset e-mail, and configure the quota notifications;
administrators and domain administrators set a domain's quota notification copies. They manage the
Rspamd settings rules with the shipped presets and the effective settings map, the global filter
maps and the global Sieve pre- and post-filters, in editors with validation feedback. They set the
Rspamd web interface password and the CORS settings of the legacy API, and verify the server's GUID.
They send mass mail to mailboxes after a recipient preview and an explicit confirmation, then follow
and cancel the delivery. The Sieve presets are offered in the mailbox filter editor. Settings changes
can be traced in the audit log. Destructive and high-risk actions need confirmation, edits based on
outdated data are caught with the API's version tags, and every view has loading, empty and error
states. The feature replaces the legacy System › Configuration tabs Customize, Password settings,
Quota notifications, Rspamd settings map, Rspamd UI and the CORS card, the System mails tab, the
Global filter maps, the global prefilter and postfilter forms, the Sieve presets of the add-filter
modal, the Quota warning BCC tab of Edit domain and the upstream GUID & License card. Every screen
works at 360 px width, meets WCAG 2.2 AA and is translated into English, Czech and Slovak."

## Clarifications

### Session 2026-10-18

- Q: How is the settings area organised, and how does a phone user find a setting and move between
  groups? → A: One System settings area with seven groups and seventeen pages (FR-004; License only
  where license verification is enabled). Wide screens keep the list of groups and pages next to the
  open page. Phones show the overview as its own
  screen, and every page offers a page switcher that lists all pages by group. A search on the
  overview covers page names, descriptions, section headings, field labels and the legacy screen
  names, in the language in use, ignoring case and diacritics. It searches only the app's own
  catalogue, never stored values. Every page has its own address. (agent decision: the brief asks
  for grouped, searchable settings with phone-friendly navigation; legacy spreads them over three
  menus and collapsed cards; searching stored values would need many API reads and could surface map
  or template contents in results; Czech and Slovak users often type without diacritics.)
- Q: Should a setting save as soon as it changes, or with an explicit Save per section, and what
  happens on concurrent edits? → A: An explicit Save per section; switches never save on their own.
  Each save sends only the changed values with the version tag. An outdated refusal keeps the user's
  input, marks what changed and asks to save again or discard, exactly as in UI feature 002.
  (agent decision: API 013 FR-007 to FR-009 support partial changes with version tags; several
  saves need a warning or confirmation first (reset e-mail, Sieve restart, map review), which
  automatic saving cannot offer; consistency with UI 002's clarified behaviour.)
- Q: How does the colour editor preserve bright branding colours? → A: Any valid six-digit accent
  is saveable unchanged. Button text uses black or white, whichever contrasts more. Text-only links
  use a separately derived shade against white in light mode and `#222932` in dark mode. The preview
  reports the actual button-text contrast. (Owner correction, 2026-10-23: `#febc23` must stay yellow.)
- Q: Which parts of the app carry the brand colour, and does this feature apply the colours in the
  shell? → A: Yes, this feature applies them. The effective colour and its foreground replace the
  default accent on primary buttons, links, the selected navigation entry and selected switches,
  checkboxes and radio buttons. Text-only links use an adjusted shade when needed.
  Status colours and the focus indicator keep the app's own style. (agent decision, confirmed by the
  orchestrator: UI 001 FR-004 defers the colours to this feature, and they arrive with API 013
  FR-029 to FR-033; limiting the colour to accent elements keeps every accepted colour within AA and
  leaves status meaning intact. The display of the app links was later moved to UI 001, see below.)
- Q: How are the HTML fields previewed without breaking the app's security rules? → A: The help text
  and the footer are previewed through exactly the sanitiser of UI feature 001, so the preview equals
  what users will see, with a note listing the kinds of content removed. The HTML of the reset and
  quota e-mails and of mass mail is previewed only on request, isolated from the app, with scripts
  and forms disabled, no remote resource loaded (remote images replaced by a placeholder) and the
  placeholders filled with sample values. (agent decision: constitution V allows API HTML only after
  sanitising; e-mail HTML needs layout that the shell's sanitiser would strip, so an isolated,
  script-free preview is the safe way to show it; loading remote images would reveal the
  administrator's address to third parties.)
- Q: How are risky edits of the global filter maps and the global Sieve filters protected, now that
  the legacy "I will be careful!" gate is gone? → A: Both offer a Check action that uses the API's
  validate-only option, and filter maps also mark invalid lines while the user types. Saving a map
  shows a review of the added and removed lines that must be confirmed. Saving a Sieve filter asks
  for confirmation with "Restart the mail service now" preselected and "Apply at the next restart" as
  the alternative, and explains the brief interruption of IMAP, POP3 and delivery. (agent decision:
  API 013 FR-093 offers validation without side effects, and FR-065 restarts by default as legacy
  does; a one-time checkbox remembered in the browser protects nothing after the first click,
  whereas reviewing each change catches accidental deletions.)
- Q: How strong must the confirmation be before mass mail is sent? → A: One explicit confirmation.
  The dialog shows the sender, the subject, the selection and the recipient count from the preview,
  states that the copies go straight into the inboxes without spam filtering and cannot be
  recalled, and its send action names the count, for example "Send to 120 mailboxes". When the API
  reports a changed count, the app shows a fresh preview and asks again. (agent decision, aligned
  with `docs/conventions.md` (Confirmations), which asks one explicit confirmation for mass mail and
  keeps typed numbers for bulk deletions; the first draft required typing the count. API 013 FR-074
  makes the confirmed count binding, so a changed selection never sends unexpectedly.)
- Q: How does a running mass mail job stay up to date on screen? → A: Its page refreshes the job
  every 5 seconds while the job runs and the page is visible. It pauses while the page is hidden,
  refreshes once when the page becomes visible again, and stops when the job ends. The time of the
  last update is shown, and progress is announced at most every 30 seconds and at the end. Leaving
  the page does not affect the delivery. (agent decision: API 013 offers no push channel; a 5-second
  interval keeps the display within the 10-second target of SC-009 while respecting constitution
  VII; announcing every refresh would flood screen reader users. Refined by the plan session below:
  the refresh also pauses on request and after the app's inactivity limit.)
- Q: Where do administrators and domain administrators set a domain's quota notification copies? →
  A: In a "Quota notification copies" section of the domain page of UI feature 002, for
  administrators and for the domain administrators of that domain, without a permission flag. The
  Quota notifications settings page explains this and leads to the domain list. (agent decision:
  legacy keeps the copies on the Edit domain page; UI 002 leaves the quota warning BCC to this
  feature; domain administrators have no access to the settings area; API 013 FR-046 scopes the
  copies per domain.)
- Q: Where are the shipped Rspamd and Sieve presets offered? → A: The Rspamd presets through "Insert
  example" on the new-rule page, and the Sieve presets through "Insert example" in the create-filter
  form of the mailbox Sieve filters of UI feature 005. Both ask before replacing typed content and
  show headlines translated through the legacy keys, falling back to the API's English headline. The
  global Sieve filters do not offer the Sieve presets. (agent decision: legacy offers them in exactly
  these two places, and UI 005 moved the Sieve presets to this feature; the Sieve presets are
  written for one mailbox, for example a vacation reply, and would act on every mailbox in a global
  filter.)
- Q: What happens to the License page on a server where license verification is disabled, such as
  the FeldHost deployment? → A: It is hidden. The settings capabilities read of API 013 reports
  whether verification is enabled; when it is not, License appears nowhere (overview, page switcher,
  search) and its address shows the "not found" state. Where it is enabled, verification runs only
  when the administrator chooses "Verify now", after the page has explained that only the GUID is
  sent. (orchestrator decision: API 013 adds a settings capabilities read with this flag; replaces
  the earlier agent decision to show a "not available on this server" state.)
- Q: Does this feature show the app links on the sign-in screen and in an Apps menu? → A: No. UI
  feature 001 shows them, from the app links of API 001's public configuration. This feature only
  edits the custom app links and the apps heading, and after a save refreshes what the shell shows.
  (orchestrator decision: API 001 adds the app links to its public configuration; see the
  clarifications of UI 001.)
- Q: How does the app learn the server-specific limits and switches that the first draft listed as
  API gaps? → A: From the settings capabilities read of API 013: the logo size and dimension limits,
  whether license verification is enabled, whether demo mode is on, the server's host name and the
  address of the Rspamd web interface. The mass mail recipient preview also gains a search by
  address. The app checks logo files before uploading, shows the branding pages read-only in demo
  mode, hides License when verification is disabled, prefills the mass mail sender with `noreply@`
  and the server's host name, and links to the Rspamd web interface at the reported address.
  (orchestrator decision: API 013 adds the capabilities read and the preview search, which closes
  all six API gaps of the first draft.)
- Q: Are the default brand colour elements and the dropped vendor links accepted? → A: Yes. The brand
  colour applies to primary buttons, links, the selected navigation entry and selected controls,
  never to status colours or the focus indicator; the license vendor links and the external
  HTML-to-text converter link are not reproduced. (orchestrator decision: confirms the agent
  defaults.)
- Q: Which cross-feature UI conventions change this spec? → A: User-facing text calls the legacy UI
  "the classic interface"; every list shows cards below the tablet breakpoint and a table on wide
  screens and keeps its state in the page address; mass mail needs one explicit confirmation; each
  History action filters by target type and target ID, and this feature adds labels and
  translations for its audit event types; limits and enabled features come from the capabilities
  read or the contract and are never hard-coded. (alignment with `docs/conventions.md`.)

### Session 2026-10-18 (plan)

- Q: How does the 5-second refresh of a running mass mail job respect UI feature 001's rule that
  automatic requests must not keep an idle session alive (UI 001 FR-033)? → A: The refresh runs only
  while the job runs, the page is visible, the administrator has not paused it with its pause
  control, and the last interaction is younger than the app's inactivity limit (the lower of
  15 minutes and the session's idle timeout). When that limit passes, the page says that automatic
  refresh paused and offers "Resume"; it never resumes on its own, and a manual refresh always
  works. SC-009 applies while the user is active. (agent decision, plan: the two UI specs conflicted;
  `docs/conventions.md` ("Polling") sets this rule for every polling screen, as in UI 008 and
  UI 011.)
- Q: How are the failure reasons of mass mail recipients shown, now that the API reports Dovecot's
  reply as free text without a stable code? → A: The reason `interrupted` gets its own translated
  text; any other failure shows the translated "Delivery failed" with the mail server's reply quoted
  as it is. A stable failure code is requested from mailcow-rest-v2 (plan, API gap G1). (agent
  decision, plan: constitution I forbids guessing codes; the contract offers only free text.)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find a setting quickly, also on a phone (Priority: P1)

An administrator opens System settings on a phone. The settings are grouped: Branding and sign-in,
Passwords, Notifications, Spam filtering, Mail filtering, Integrations and privacy, and Mass mail.
They type "announcement" into the search and land on the UI texts page at the announcement section.
From there they switch to the global filter maps in another group without going back to the start.
On a wide screen the groups and pages stay visible next to the open page.

**Why this priority**: Every other story starts here. Legacy spreads these settings over three
menus, ten tabs and several collapsed cards, which are hard to find and to use on a phone.

**Independent Test**: Against a mock API generated from the contract, open the settings area as an
administrator at 360 px and at desktop width. Search for page names, section names, field labels and
legacy tab names in the selected language (for example English, Czech and Slovak), open each page
from the search, from the list and by its address, and move between groups. Repeat as a domain administrator and as a mailbox user.

**Acceptance Scenarios**:

1. **Given** an administrator on a 360 px wide screen, **When** they open System settings, **Then**
   the groups are listed with their pages, each page with a one-line description, without
   horizontal scrolling.
2. **Given** the settings overview, **When** the administrator types "announcement", **Then** the
   results include "UI texts › Announcement". **When** they select it, **Then** the UI texts page
   opens and the focus is on the heading of the announcement section.
3. **Given** the app in Czech, **When** the administrator searches for a field label without its
   diacritics, **Then** the matching page is found. **When** they search for the legacy names
   "Customize" or "System mails", **Then** the branding pages or the mass mail page are found.
4. **Given** a search that matches nothing, **When** the results are shown, **Then** a "no matching
   settings" message offers to clear the search.
5. **Given** an open settings page on a phone, **When** the administrator opens the page switcher,
   **Then** every settings page is listed by group with the current one marked, and selecting
   another opens it.
6. **Given** a domain administrator or a mailbox user, **When** they look at the navigation, **Then**
   System settings is not offered, and opening a settings address shows the "no access" state of UI
   feature 001.
7. **Given** the address of a settings page, **When** it is reloaded or opened on another device,
   **Then** the same page opens.

---

### User Story 2 - Brand the app with logos and texts (Priority: P1)

An administrator gives the server their company's look. They pick a light and a dark logo and see
each one on a light and on a dark surface, at the sizes the app uses in the header and on the
sign-in screen, before uploading it. After the upload they see its type, dimensions and file size.
They set the page title, the product name and the heading of the apps menu, write the login help
text and the footer, and publish an announcement for all users. The help text and the footer are
HTML, and their preview shows exactly what the app will show.

**Why this priority**: The constitution requires that the product name, logos and login texts come
from the API at runtime. Without this story operators must keep the legacy UI to brand the new app.

**Independent Test**: Against a mock API, select and upload PNG, JPEG, GIF and SVG logos, a PDF named
`logo.png`, an SVG with a script and an oversized file, delete a logo, and change every text,
including HTML that contains scripts and remote images. Check the previews, the values sent, every
message, and the header, page title, sign-in screen and announcement after each save.

**Acceptance Scenarios**:

1. **Given** no logo, **When** an administrator selects a 300 × 80 PNG as the light logo, **Then**
   before anything is sent the app shows it on a light and on a dark surface at header and sign-in
   size, with its file name, type and size. **When** they upload it, **Then** the success is
   announced, the stored logo is shown with its type, its dimensions and its size, and the header
   shows it in the light theme.
2. **Given** an SVG that contains a script element, **When** it is uploaded and the API refuses it,
   **Then** a translated message says that the file contains unsafe content and names the
   construct, and the stored logo is unchanged.
3. **Given** a file larger than the server's logo size limit, **When** it is chosen, **Then** the app
   says before uploading that it exceeds the limit, states the limit as a file size, and offers no
   Upload action.
4. **Given** a stored dark logo, **When** the administrator deletes it and confirms, **Then** the dark
   preview shows what the app shows without a dark logo, and the header in the dark theme changes
   accordingly.
5. **Given** a help text with a paragraph, a link and a script element, **When** it is previewed,
   **Then** the paragraph and the link are shown, the script is neither run nor shown, and a notice
   says that some content will not be shown by the app.
6. **Given** a product name "Acme & Co Mail", **When** it is saved, **Then** the header, the
   sign-in screen and the browser page title show "Acme & Co Mail" literally.
7. **Given** an active announcement of type "warning", **When** the administrator switches it off
   and saves, **Then** the announcement disappears from the app, and other users no longer see it
   after their next page load.
8. **Given** unsaved changes to the UI texts, **When** the administrator tries to leave the page,
   **Then** the app asks for confirmation before discarding them.

---

### User Story 3 - Choose brand colours that stay accessible (Priority: P1)

An administrator picks the company's colour for the light theme and, optionally, one for the dark
theme. While they choose, a live preview shows buttons, links and the selected navigation entry in
both themes, together with the actual button-text contrast. Every valid six-digit accent is
preserved; text-only links get a separately derived shade. After saving, the app uses the colours
at once.

**Why this priority**: Operators need to preserve their brand colours while keeping text readable.

**Independent Test**: Enter bright yellow, dark blue and invalid values, set only a light colour,
set both, clear both, and save each. Check that fills remain unchanged after save and reload,
foregrounds adapt, text-only links use their own colour, and dark mode inherits when unset.

**Acceptance Scenarios**:

1. **Given** no brand colours, **When** the administrator enters `#1D4ED8`, **Then** both themes
   preview blue controls with white text and a ratio of about 6.7:1. Dark text-only links adapt.
2. **Given** `#FEBC23`, **When** it is entered, **Then** yellow buttons show black text with a ratio
   of about 12.4:1, saving is allowed, and no replacement accent is offered. Light text-only links
   use a darker shade without changing the chosen yellow.
3. **Given** the light colour `#1D4ED8`, **When** `#60A5FA` is entered for the dark theme, **Then**
   dark buttons use that colour with black text and a ratio of about 8.3:1.
4. **Given** saved colours, **When** the save succeeds, **Then** the administrator's app uses them at
   once for primary buttons, links, the selected navigation entry and selected controls, in both
   themes, and other users see them after their next page load.
5. **Given** saved colours, **When** the administrator clears both and saves, **Then** the app
   returns to its default palette.
6. **Given** any brand colour, **When** the app shows success, warning or error states, **Then**
   their colours are unchanged.
7. **Given** a colour the API refuses, **When** the save returns, **Then** the field shows the
   measured ratio, the minimum and the reference surface from the error.

---

### User Story 4 - Configure the sign-in page and the app links (Priority: P2)

An administrator hides the sign-in links of roles their customers never use and decides whether
single sign-on is forced. They maintain the app links, for example the webmail and a helpdesk:
a name, the link for signed-out visitors, a personal link for signed-in users that can contain the
username, and whether it appears on the sign-in screen. UI feature 001 shows the links on the
sign-in screen and in its Apps menu.

**Why this priority**: Operators rely on the app links to guide users to webmail and support, but
the sign-in page works without them.

**Independent Test**: Against a mock API, change each sign-in option, add, edit, reorder and remove
app links on a phone and a desktop, including invalid links and the 50-entry limit, and check the
values sent and every message.

**Acceptance Scenarios**:

1. **Given** all sign-in links shown, **When** the administrator hides the administrator link and
   saves, **Then** the sign-in screens no longer link to the administrator sign-in.
2. **Given** no identity provider configured, **When** the administrator looks at "force single
   sign-on", **Then** the app explains that the option has no effect until an identity provider is
   configured.
3. **Given** a new app link "Helpdesk" with the link `https://help.example.org` and the user link
   `https://help.example.org/?u=%u`, **When** the administrator `admin` enters it, **Then** the form
   shows the user link as `https://help.example.org/?u=admin`. **When** they save, **Then** the
   success is announced and the Apps menu of UI feature 001 shows the new link without a reload.
4. **Given** a link `javascript:alert(1)`, **When** the administrator tries to save, **Then** the
   entry is marked as invalid before anything is sent.
5. **Given** three app links, **When** the administrator moves the third one to the top with its
   move actions and saves, **Then** the links are saved and shown in the new order.
6. **Given** built-in app links from the operator's configuration, **When** the page is shown,
   **Then** they appear read-only next to the custom links, with an explanation, and cannot be
   edited or removed.
7. **Given** 50 custom app links, **When** the page is shown, **Then** the add action is unavailable
   and the limit of 50 is stated.
8. **Given** a removed app link that is not saved yet, **When** the administrator tries to leave the
   page, **Then** the app asks for confirmation before discarding the change.

---

### User Story 5 - Set the password policy and the password reset e-mail (Priority: P2)

An administrator raises the minimum password length and requires digits and mixed case. The page
shows the rules as users will see them when they choose a password. They also set up the password
reset e-mail: the sender, the subject and the text and HTML templates, with a reference of the
placeholders, a preview and a way back to the default templates. The app makes clear that self-service
password reset only works while a sender and a subject are set.

**Why this priority**: The policy protects every account, and password reset depends on the e-mail
settings, but both have safe defaults and change rarely.

**Independent Test**: Against a mock API, change the policy with valid and out-of-range lengths, save
the reset e-mail with valid and invalid senders, with custom, default and partly empty templates, and
with the sender or subject cleared. Check the values sent, the previews, the availability state and
every message.

**Acceptance Scenarios**:

1. **Given** the default policy (length 6, no character classes), **When** the administrator sets a
   length of 10 with digits and mixed case required and saves, **Then** the success is announced and
   the rule list reads "Minimum password length is 10", "Must contain at least one number" and "Must
   contain lowercase and uppercase characters".
2. **Given** a length of 2 or 65, **When** the administrator tries to save, **Then** the field states
   the allowed range of 3 to 64 before anything is sent.
3. **Given** the sender `no-reply@`, **When** the administrator tries to save the reset e-mail,
   **Then** the sender field shows a translated "invalid e-mail address" error.
4. **Given** no stored templates, **When** the page opens, **Then** the default templates are shown
   and marked as the defaults.
5. **Given** a reset e-mail with sender and subject, **When** the administrator clears the subject
   and saves, **Then** the app first warns that self-service password reset will stop working for
   every user and asks for confirmation; after the save the page states that password reset is
   unavailable.
6. **Given** custom templates, **When** the administrator restores the defaults and saves, **Then**
   the default templates are shown and marked as defaults.
7. **Given** an HTML template, **When** the administrator opens its preview, **Then** the
   placeholders are replaced by sample values, no script runs and no remote resource is loaded.
8. **Given** a text template without the `{{link}}` placeholder, **When** it is saved, **Then** the
   app warns that the e-mail will contain no reset link.

---

### User Story 6 - Configure quota notifications and their copies (Priority: P2)

An administrator sets the sender, the subject and the HTML template of the e-mail that a user gets
when their mailbox crosses 80 % and 95 % of its quota. An administrator, or a domain administrator
for their own domains, enters on the domain page the addresses that receive a copy of the quota
notifications of that domain's mailboxes, for example the customer's IT contact, and switches the
copies on.

**Why this priority**: Quota notifications prevent full mailboxes and resellers want the copies, but
mailcow sends useful defaults without any configuration.

**Independent Test**: Against a mock API, read and save the notification settings with defaults,
custom values and invalid senders; as an administrator and as a domain administrator, read and save
copy recipients of a domain, with invalid entries, duplicates, an empty active list and a domain
outside the scope.

**Acceptance Scenarios**:

1. **Given** no stored settings, **When** the page opens, **Then** it shows the sender
   `quota-warning@localhost`, the subject "Quota warning" and the default template, each marked as
   the default, and explains that notifications are sent once at 80 % and once at 95 %.
2. **Given** a sender, a subject and a template that uses `{{username}}` and `{{percent}}`, **When**
   they are saved, **Then** the success is announced and the values are no longer marked as defaults.
3. **Given** a domain administrator of `example.org`, **When** they open the domain page of
   `example.org`, **Then** a "Quota notification copies" section is offered. **When** they add
   `it@example.org` and `boss@example.net`, switch the copies on and save, **Then** the success is
   announced and the section shows both addresses as active.
4. **Given** the entry `not-an-address`, **When** it is added, **Then** it is marked as invalid
   before anything is sent.
5. **Given** an empty list with copies switched on, **When** it is saved, **Then** the app explains
   that copies without recipients stay inactive, and the section shows them as inactive afterwards.
6. **Given** a domain administrator, **When** they open the address of a domain they do not manage,
   **Then** the "not found" page of UI feature 002 is shown.

---

### User Story 7 - Manage Rspamd settings rules from presets (Priority: P2)

An administrator adds an Rspamd settings rule from the shipped example "Disable Rspamd for a
domain", adapts it to `example.org`, checks it and activates it. They browse and search the rules,
deactivate or delete one, and review the effective settings map that Rspamd receives. Administrators
and domain administrators who write a mailbox Sieve filter can start from the shipped Sieve
examples in the same way.

**Why this priority**: Spam control is a daily operational need, and a broken rule can weaken
filtering for every mailbox, so safe editing matters.

**Independent Test**: Against a mock API, create rules blank and from each preset, check valid and
structurally broken content, edit, deactivate and delete rules, page, search, filter and sort a list
of 30 rules, and open the effective settings map, also while it is unavailable. Insert each Sieve
preset into a new mailbox filter.

**Acceptance Scenarios**:

1. **Given** no rules, **When** the administrator opens Rspamd settings rules, **Then** the "No rules
   available" state offers to add a rule.
2. **Given** the new-rule form, **When** the administrator chooses the example "Disable Rspamd for a
   domain", **Then** the description and the content are filled in, the description in the user's
   language. **When** they had already typed content, **Then** the app asks before replacing it.
3. **Given** content with an opening brace that is never closed, **When** the administrator checks
   it, **Then** the content field shows a translated error that names the unbalanced structure and
   its position, and nothing is saved.
4. **Given** valid content, **When** the rule is saved as active, **Then** it is listed as active and
   the app says that Rspamd applies it within its settings refresh interval, without a restart.
5. **Given** 30 rules, **When** the administrator searches, filters by active state, sorts and pages,
   **Then** the list shows the matching rules with their total.
6. **Given** an active rule, **When** the administrator opens the effective settings map, **Then** it
   is shown read-only with a copy action and contains the rule's block. **When** the map cannot be
   retrieved, **Then** an error with a retry action is shown.
7. **Given** a rule to delete, **When** the administrator chooses Delete, **Then** a confirmation
   names the rule by description and identifier and states that Rspamd stops applying it at its next
   refresh.
8. **Given** an administrator, or a domain administrator with the filters permission, creating a
   mailbox filter (UI feature 005), **When** they open "Insert example", **Then** the eight shipped
   Sieve examples are listed by their translated headline, and choosing one fills in the script,
   asking before replacing typed content.

---

### User Story 8 - Maintain the global filter maps (Priority: P2)

An administrator maintains the global filter maps, such as the sender denylist or the bad words
list. The editor numbers the lines and flags a line that is not a `/pattern/` expression while they
type. A check against the server finds patterns that do not compile and names the line. Before
saving, they review which lines they added and removed. Rspamd picks up the change without a
restart.

**Why this priority**: A broken map silently weakens filtering for every mailbox, so editing must be
safe, but the maps change rarely.

**Independent Test**: Against a mock API, open every map, enter valid lines, comments, empty lines,
lines without slashes, lines with two flags and patterns that do not compile, check and save them,
and simulate a missing map file and an outdated version.

**Acceptance Scenarios**:

1. **Given** the operator's 13 editable maps, **When** the administrator opens Global filter maps,
   **Then** each map is listed with its name and identifier.
2. **Given** a map with the line `spam.example` on line 3, **When** the administrator types it,
   **Then** line 3 is marked as not being a `/pattern/` expression before anything is sent.
3. **Given** the line `/[unclosed/i` on line 5, **When** the administrator checks the map, **Then**
   the error names line 5 and the app can move the cursor to it.
4. **Given** valid content, **When** the administrator saves, **Then** a review lists the added and
   removed lines and asks for confirmation. **When** they confirm, **Then** the success is announced
   with the note that Rspamd reloads the map without a restart.
5. **Given** a map whose file is missing on the server, **When** it is saved, **Then** a translated
   message says that the map is not available on this server, and nothing changes.
6. **Given** the line `/x/im`, **When** it is checked, **Then** it is refused because only one of the
   flags `i`, `m` or `s` is allowed.

---

### User Story 9 - Maintain the global Sieve filters (Priority: P2)

An administrator edits the global Sieve pre-filter, which runs before every mailbox's own filters,
and the post-filter, which runs after them and by default files spam into the Junk folder. They check
the script, and the app shows the line and the reason of a syntax error. When they save, the app
explains that the mail service is restarted so that the script takes effect, which briefly interrupts
IMAP, POP3 and delivery for everyone, and lets them apply the change at the next restart instead.

**Why this priority**: Global filters affect every delivered message, so they need validation and an
explicit restart choice, but they change rarely.

**Independent Test**: Against a mock API, read both scripts, check and save valid, invalid and empty
scripts with and without an immediate restart, and simulate a failed restart, a missing filter file
and an outdated version.

**Acceptance Scenarios**:

1. **Given** both global filters, **When** the administrator opens Global Sieve filters, **Then** the
   pre-filter and the post-filter are shown with their explanations.
2. **Given** a pre-filter with a missing semicolon, **When** the administrator checks it, **Then** the
   error states the line and the parser's reason, and nothing is saved or restarted.
3. **Given** a valid pre-filter, **When** the administrator saves with "Restart the mail service now",
   **Then** the confirmation explains the brief interruption, and after confirming the app reports
   that the script is saved and the mail service restarted.
4. **Given** a valid post-filter, **When** the administrator saves with "Apply at the next restart",
   **Then** the app reports that the script is saved and takes effect at the next restart of the mail
   service.
5. **Given** a restart that fails, **When** the save returns, **Then** the app reports that the
   script is saved but the restart failed, and that the script takes effect at the next restart.
6. **Given** an empty script, **When** the administrator saves it, **Then** the app explains that an
   empty script means no global filter before asking for confirmation.

---

### User Story 10 - Send mass mail to mailboxes (Priority: P3)

An administrator announces planned maintenance to all users, or to the mailboxes of some domains.
They choose the recipients: every mailbox, the mailboxes of some domains, only listed mailboxes, or
everyone except listed mailboxes. They see how many and which mailboxes will receive the message,
write the subject and the text, optionally an HTML version, and confirm with the recipient count.
They then follow the delivery, can cancel it, and later look up the outcome for every recipient.

**Why this priority**: Rarely used and high risk; the legacy form keeps working until then.

**Independent Test**: Against a mock API, compose messages with each kind of selection, preview,
send with a matching and with a changed count, try a second job while one runs, cancel a running job,
and inspect completed and cancelled jobs with every outcome, at 360 px and at desktop width.

**Acceptance Scenarios**:

1. **Given** 120 receiving mailboxes, **When** the administrator previews "all mailboxes", **Then**
   the app states 120 recipients and lists them page by page, sorted by address, with a search by
   address.
2. **Given** that preview and a complete message, **When** the administrator chooses Send, **Then** a
   confirmation shows the sender, the subject, the selection, the 120 recipients and that the message
   goes straight into the inboxes without spam filtering and cannot be recalled. The send action
   reads "Send to 120 mailboxes", and nothing is sent until it is chosen.
3. **Given** a mailbox created after the preview, **When** the job is sent, **Then** the app says
   that the number of recipients changed, shows the new preview, asks for confirmation again, and
   nothing is sent.
4. **Given** a running job, **When** another job is sent, **Then** the app says that a mass mail is
   already running and links to it.
5. **Given** a running job, **When** the administrator opens it, **Then** the numbers of delivered,
   failed, skipped and pending recipients are shown as text and as a bar and update while the page is
   open. **When** they cancel and confirm, **Then** the job is shown as cancelled with the remaining
   recipients as skipped.
6. **Given** a completed job, **When** the administrator filters its recipients by "failed", **Then**
   each failed recipient is shown with its reason: translated where the API reports a known reason,
   otherwise a generic translated failure label (FR-088; G1 is closed).
7. **Given** an exclusion of `ghost@example.org`, which is not a receiving mailbox, **When** the
   preview is requested and the API refuses it, **Then** that entry is marked with a translated error.
8. **Given** no job yet, **When** the administrator opens the mass mail jobs, **Then** an empty state
   explains what mass mail does and offers to compose one.

---

### User Story 11 - Operate the remaining server settings (Priority: P3)

An administrator sets a new password for the Rspamd web interface, edits which origins and methods
the legacy API allows for cross-origin requests, opts in to the IP check that lets the dashboard show
the server's public addresses, and on an upstream installation verifies the server's GUID against
the mailcow license service.

**Why this priority**: Each of these settings changes rarely, and the legacy UI keeps offering them.

**Independent Test**: Against a mock API, set Rspamd passwords of valid and invalid length and with a
failing container service, save CORS settings with valid and invalid origins and methods, toggle the
IP check, and read and verify the license with the service valid, unreachable and disabled.

**Acceptance Scenarios**:

1. **Given** a 12-character passphrase, **When** the administrator sets it as the Rspamd web
   interface password, **Then** the app confirms that the password is set and Rspamd restarted, and
   the field is cleared.
2. **Given** a 5-character password, **When** the administrator tries to save, **Then** the field
   states the minimum of 6 characters before anything is sent.
3. **Given** the origins `https://portal.example.org` and `*` with the methods GET and POST, **When**
   they are saved, **Then** the success is announced, and the app has warned that `*` allows every
   origin.
4. **Given** the origin `https://portal.example.org/app/`, **When** it is added, **Then** it is marked
   as invalid because an origin has no path.
5. **Given** the IP check switched off, **When** the administrator switches it on and saves, **Then**
   the app has explained that the server then contacts third-party services to learn its public
   addresses, and the dashboard can show them.
6. **Given** license verification enabled, **When** the administrator opens License, **Then** the
   GUID is shown with a copy action together with the last verification result. **When** they choose
   "Verify now", **Then** the new result, with customer ID, service ID and support level, is shown.
7. **Given** the license service unreachable, **When** the GUID is verified, **Then** the result
   "unreachable" is shown as a result, not as an error.
8. **Given** license verification disabled on the server, **When** the administrator opens System
   settings, **Then** License appears neither in the overview, nor in the page switcher, nor in the
   search, and opening its address shows the "not found" state.

---

### User Story 12 - Trace settings changes (Priority: P3)

An administrator investigating why spam suddenly passes opens the history of a global filter map and
sees who changed it, when and from where. Another reviews the history of the mass mail jobs.

**Why this priority**: Useful for support and accountability, but settings can be managed without it.

**Independent Test**: Against a mock API with audit records for every kind of settings change,
including refused ones, open the history from each settings page and from a mass mail job, and check
that domain administrators are never offered it.

**Acceptance Scenarios**:

1. **Given** a saved sender denylist, **When** another administrator opens the history of that map,
   **Then** the audit log of UI feature 001 opens filtered to that map, and the entry shows the
   actor, the time, the client address and the old and new size of the map.
2. **Given** a Rspamd password change, **When** its history entry is shown, **Then** it states that
   the password was changed and shows no password.
3. **Given** a completed mass mail job, **When** its history is opened, **Then** it shows the creation
   and the completion with the counts per outcome.
4. **Given** a domain administrator on the quota notification copies of their domain, **When** the
   section is shown, **Then** no history action is offered.

---

### Edge Cases

- **Settings never saved**: every page shows the legacy defaults the API returns (empty texts,
  announcement inactive, no logos, all sign-in links shown, no app links, IP check off, password
  length 6 without character classes, no reset sender or subject, the default quota sender, subject
  and template, CORS for the server's own origin with GET, POST, PUT and DELETE).
- **Logo stored through the legacy UI that the API would now refuse**, for example an SVG with a
  script: it is shown only as an image, so nothing in it runs, and it can be replaced or deleted.
- **SVG without width and height**: the details show "no declared size" instead of dimensions.
- **Animated GIF logo**: accepted and previewed as the app shows it.
- **Only one logo variant set**: each preview shows what the app shows in that theme (UI feature 001).
- **Logo that fails to load**: the preview shows the product name in its place, as the app does.
- **Very long product names and app link names (255 characters)**: they wrap in previews and lists
  without horizontal scrolling.
- **Help text or footer containing content the sanitiser removes**: the preview shows the result and
  lists what kind of content was removed, and notes that the classic interface still shows the HTML
  as written.
- **Announcement active without a type**: allowed; it is shown in the neutral style.
- **Plain-text field containing `<b>`**: shown literally everywhere.
- **Force single sign-on without an identity provider**: stored; the app says it has no effect.
- **Dark colour unset and light colour too bright for the dark surface**: the dark preview and the
  app use the default palette in the dark theme.
- **Colour typed with three digits, without `#` or in upper case**: the app accepts `#RRGGBB` in either
  case and normalises a value without `#`; other forms are invalid with a format hint.
- **App links that point to the webmail while the groupware is disabled**: the API leaves them out of
  what UI feature 001 shows; the settings page still lists them.
- **User link that contains `%u`**: the form explains that signed-out visitors get the link, not the
  user link, so they never see the placeholder.
- **App link to a relative path**: accepted; the form explains that it leads to a page on this
  server.
- **Password policy changed while passwords exist**: the page explains that existing passwords keep
  working and only the next password set is checked.
- **Only one reset template empty**: the app warns that the e-mail will be sent without that part,
  because the defaults apply only when both templates are empty.
- **Quota template with a syntax error**: accepted; the page explains that the mail service falls
  back to the default template when it cannot use the stored one.
- **Copy recipients that differ only in letter case**: kept once with the first spelling.
- **Domain deleted and created again**: its earlier copy recipients reappear, because domain deletion
  keeps them.
- **Settings rule with a brace inside a quoted string or a comment**: accepted.
- **Rule that is structurally valid but uses an unknown option**: accepted; the effective settings map
  shows what Rspamd receives.
- **Global filter map or global Sieve filter changed in the legacy UI at the same time**: the legacy
  UI never sends a version tag, so its save can overwrite a change made in this app; the app cannot
  detect it.
- **Very long lines in an editor**: they wrap by default; with wrapping turned off only the editor
  scrolls sideways, never the page.
- **Editor content near the 1 MiB limit**, for example after a paste: the size is shown against the
  limit, and saving above it is blocked with a message stating the limit.
- **Global Sieve filter saved while a mass mail job runs**: the restart may delay deliveries; the job
  retries them, and the app shows no special warning.
- **Rspamd password with quotes or spaces**: accepted and set exactly as typed.
- **Rspamd restart failing after the password was stored**: the app says that the change could not
  be confirmed and that the new password may take effect only at Rspamd's next start.
- **CORS origin stored by an older release as a bare host name**: shown as stored and marked invalid;
  it must be corrected or removed before the CORS settings can be saved.
- **Mass mail with zero recipients**: the preview says so and sending is unavailable.
- **Mailbox deleted, deactivated or over quota during delivery**: recorded as failed with the reason.
- **Leaving a running job's page or closing the app**: the delivery continues on the server; the job
  can be opened again from the job list.
- **Cancelling a job that has just completed**: the API refuses; the app says the job already
  completed and shows its final state. Cancelling an already cancelled job changes nothing.
- **GUID marked invalid by mailcow**: shown as invalid; verification is still offered.
- **Demo mode enabled by the operator**: the branding pages and the IP check are read-only with the
  reason (FR-033). When demo mode is switched on while a form is open, the API's refusal is
  explained, the input is kept and the capabilities are read again (FR-017).
- **Logo limits lowered by the operator after the capabilities were read**: the API's refusal states
  the current limit (FR-021).
- **Settings capabilities unavailable**: the settings area shows its error state with a retry action,
  because the offered pages and limits depend on them (FR-032).
- **Temporary failure** reported by the API: the app says that nothing was changed and offers a retry
  that keeps the input.
- **Session expiry or sign-out in another tab while a form is open**: handled by UI feature 001.
- **Domain removed from a domain administrator's scope while the copies section is open**: the next
  request returns "not found", and the app says the domain is no longer available.

## Requirements *(mandatory)*

### Functional Requirements

#### Access and navigation

- **FR-001**: The app MUST offer the System settings area only to administrators, through the
  "System settings" entry of the navigation of UI feature 001. Domain administrators and mailbox
  users MUST NOT be offered any settings page, and opening a settings address MUST show the "no
  access" state of UI feature 001 without requesting the page's data.
- **FR-002**: The app MUST offer exactly these capabilities per role, as reported by the API's
  identity:

  | Capability | Administrator | Domain administrator | Mailbox user |
  |---|---|---|---|
  | System settings area (every page of FR-004) | Yes | Not offered | Not offered |
  | Quota notification copies of a domain (domain page) | All domains | Own domains, no permission flag needed | Not offered |
  | Sieve examples in the mailbox filter editor | Yes | Where UI feature 005 offers the editor | Not offered |
  | Settings history | Yes | Not offered | Not offered |

- **FR-003**: When the API refuses an action as forbidden, the app MUST show the translated reason,
  refresh the identity and update the controls it offers, without discarding unsaved input.

#### Settings area, groups and search

- **FR-004**: The settings area MUST contain these groups and pages, in this order:

  | Group | Page | Contents |
  |---|---|---|
  | Branding and sign-in | Logos | Light and dark logo |
  | | Colours | Light-theme and dark-theme brand colour |
  | | UI texts | Page title, product name, apps heading, login help text, footer, announcement |
  | | Sign-in page | Hiding the sign-in links per role, forcing single sign-on |
  | | App links | Custom and built-in app links |
  | Passwords | Password policy | Minimum length and required character classes |
  | | Password reset e-mail | Sender, subject, text and HTML templates |
  | Notifications | Quota notifications | Sender, subject, HTML template; pointer to the per-domain copies |
  | Spam filtering | Rspamd settings rules | Rule list, rule pages, effective settings map |
  | | Global filter maps | Map list, map pages |
  | | Rspamd web interface | Password |
  | Mail filtering | Global Sieve filters | Pre-filter and post-filter |
  | Integrations and privacy | CORS of the classic API | Allowed origins and methods of `/api/v1` |
  | | IP check | Opt-in to third-party address lookup |
  | | License | GUID and license verification; only where verification is enabled (FR-033) |
  | Mass mail | Send mass mail | Compose, recipients, preview, send |
  | | Mass mail jobs | Job list, job pages with recipients |

- **FR-005**: The settings overview MUST list every group with its pages, each page with its name
  and a one-line description. On wide screens the list of groups and pages MUST stay visible next to
  the open page and mark the current page. On small screens the overview MUST be its own screen, and
  every settings page MUST offer a way back to the overview and a page switcher that lists every
  page by group, marks the current one and opens the chosen one.
- **FR-006**: Every settings page, every rule, map and job page, and the effective settings map MUST
  have its own address that can be bookmarked, reloaded and shared. Opening the address of a rule,
  map or job that does not exist MUST show a "not found" state with a way back to its list.
- **FR-007**: The settings overview MUST offer a search over the names and descriptions of the pages,
  the headings of their sections, the labels of their fields and the legacy names of the replaced
  screens (for example "Customize", "System mails", "Rspamd settings map", "Global filter maps"),
  in the language in use. The search MUST ignore letter case and diacritics and MUST update the
  results while the user types. Each result MUST name its page and, where it matches a section or
  field, that section. Selecting a result MUST open the page and move the focus to the matching
  section heading. A search without results MUST show a "no matching settings" message with an
  action that clears the search.
- **FR-008**: The search MUST work on the app's own catalogue of pages and fields. It MUST NOT
  search the stored values, such as texts, maps or scripts, and MUST NOT request data from the API.

#### Common behaviour of settings forms

- **FR-009**: Each settings page MUST be split into sections, and each section that contains values
  the user can change MUST be saved on its own with an explicit Save action. Switches and choices
  MUST NOT save on their own. On small screens the Save and Cancel actions of the section being
  edited MUST stay reachable without scrolling to its end.
- **FR-010**: Every save MUST send only the values the user changed in that section, together with
  the version tag of the data the form was based on. After a successful save the app MUST announce
  the success, show the values as the API returned them and continue with the new version tag.
- **FR-011**: When the API refuses a save as outdated, the app MUST keep the user's unsaved values,
  load the latest saved data, mark every value that changed in the meantime together with its new
  saved value, and let the user save again, based on the latest version, or discard their changes.
  The app MUST NOT merge or re-send on its own. For a deletion, the confirmation MUST be shown again
  with fresh data.
- **FR-012**: When the API refuses a save, the app MUST keep every entered value, show each field
  error next to its field, or next to the list entry or editor line it names, and in an error summary
  at the top whose entries lead to the fields.
- **FR-013**: Leaving a page or section with unsaved changes MUST ask for confirmation.
- **FR-014**: While a save is being sent, its action MUST show progress and MUST NOT accept a second
  submission.
- **FR-015**: Every settings page MUST define a loading state in the shape of its content, and an
  error state with a translated message and a retry action. Pages with collections (app links,
  settings rules, global filter maps, mass mail jobs and recipients, copy recipients, CORS origins)
  MUST also define an empty state that explains the collection and offers its add action where one
  exists. Lists MUST be shown as cards below the tablet breakpoint and as tables on wide screens, and
  their search, filters, sort, page and page size (25, the default, 50 or 100) MUST be kept in the
  page address, never in browser storage.
- **FR-016**: Where a value falls back to a default when it is left empty, the field MUST say what
  the empty value means (for example "Empty: the server's default product name"), and values the API
  marks as defaults MUST be labelled as defaults.
- **FR-017**: When the settings capabilities report demo mode, the pages listed in FR-033 MUST be
  read-only. When the API nevertheless refuses a change because demo mode is on, the app MUST say
  that changes are disabled on this demonstration server, keep the input and read the capabilities
  again.

#### Logos

- **FR-018**: The Logos page MUST show, for the light and for the dark logo, the stored logo or the
  statement that none is set, and for a stored logo its type, its file size and its pixel dimensions,
  or "no declared size" for an SVG without one.
- **FR-019**: Each logo MUST be previewed on a light and on a dark surface, at the sizes the app uses
  in the header and on the sign-in screen, and each theme's preview MUST show what the app shows in
  that theme, including the case of a missing variant (UI feature 001). Logos MUST be shown only as
  images, never inserted into the page as markup.
- **FR-020**: The administrator MUST be able to choose a new file for each logo from the device. The
  chooser MUST accept PNG, JPEG, GIF and SVG images. Before uploading, the app MUST show the chosen
  file with the previews of FR-019 and its name, type and size, and MUST offer Upload and Cancel. A
  file larger than the logo size limit of the settings capabilities, or a raster image larger than
  their pixel dimensions, MUST be refused before uploading with the limit stated. Uploading MUST
  replace the stored logo of that variant.
- **FR-021**: When the API refuses a logo, the app MUST show the translated reason with its
  parameters: unsupported image type; unsafe SVG content with the construct it names; file size or
  pixel dimensions above the limit, with the limit. The stored logo MUST stay shown.
- **FR-022**: The administrator MUST be able to delete each logo on its own after a confirmation that
  names the variant and shows what the app shows instead.
- **FR-023**: The page MUST explain that a scalable graphic (SVG) is recommended, which sizes the app
  uses, and the server's file size and pixel limits from the settings capabilities.

#### Brand colours

- **FR-024**: The Colours page MUST offer an optional brand colour for the light theme and one for
  the dark theme. Each MUST be entered as a six-digit hexadecimal colour (`#RRGGBB`) in either letter
  case, typed or chosen with a colour picker, and MUST be clearable. A value without the leading `#`
  MUST be normalised; any other format MUST be refused before sending with a format hint.
- **FR-025**: While a colour is entered, the app MUST report contrast between its black or white
  foreground and the unchanged fill, rounded to one decimal, with the minimum of 4.5:1.
- **FR-026**: Any valid six-digit accent MUST be saveable unchanged. Text-only links MUST use a
  separate shade derived with the same hue and saturation and the nearest lightness reaching the
  required text contrast against the theme surface. This MUST NOT replace the entered accent.
- **FR-027**: Each theme's preview MUST include a header, primary button, link, selected navigation
  entry and switch. When no dark colour is set, dark mode MUST inherit the light colour and explain
  this. Button foregrounds and derived link colours MUST match the runtime shell.
- **FR-028**: When the API refuses a colour, the field MUST show the measured ratio, the minimum and
  the reference surface from the error.
- **FR-029**: The page MUST explain that brand colours are used only by this app and not by the
  classic interface, and that clearing them returns the app to its default palette.

#### Branding in the app shell

- **FR-030**: The app MUST apply the effective brand colour of each theme and its foreground from the
  public configuration, replacing the default accent colour on primary action buttons, links, the
  selected navigation entry and the selected state of switches, checkboxes and radio buttons. Text-only
  links MUST use a separately derived readable shade; backgrounds MUST keep the exact chosen accent
  and carry its contrasting foreground colour. Without
  an effective colour, the theme MUST use the default palette. Colours of success, warning, error and
  information states and the focus indicator MUST keep the app's own style.
- **FR-031**: After a successful change of any branding setting, the administrator's app MUST read
  the public configuration again, so that the logos, texts, colours and app links that the shell of
  UI feature 001 shows change at once, without a reload. Other users MUST see them after their next
  page load. Showing the app links on the sign-in screen and in the Apps menu belongs to UI feature
  001.

#### Settings capabilities

- **FR-032**: The app MUST read the settings capabilities of API feature 013 before it shows the
  settings area, and MUST take from them the logo file size and pixel dimension limits, whether
  license verification is enabled, whether demo mode is on, the server's host name and the address
  of the Rspamd web interface. Limits and enabled features MUST come from the capabilities or the
  pinned contract and MUST NOT be hard-coded; the numbers named in this spec are those of API 013 at
  the time of writing. When the capabilities cannot be read, the settings area MUST show its error
  state with a retry action.
- **FR-033**: When license verification is disabled, the License page MUST appear neither in the
  overview, nor in the page switcher, nor in the search, and its address MUST show the "not found"
  state of FR-006. When demo mode is on, the Logos, Colours, UI texts, Sign-in page, App links and IP
  check pages MUST show their values read-only, with the reason that changes are disabled on this
  demonstration server.

#### UI texts and announcement

- **FR-034**: The UI texts page MUST offer the page title, the product name and the apps heading as
  single-line plain-text fields of at most 255 characters; the login help text and the footer as
  multi-line HTML fields of at most 65,535 characters; and the announcement with its text (plain
  text, at most 65,535 characters), its type (information, warning, very important or none) and
  whether it is active. Line breaks MUST be refused in the single-line fields. The apps heading MUST
  explain that it titles the Apps menu of UI feature 001 and that an empty value means the
  translated default "Apps". The labels are the legacy ones (`admin.title_name`, `admin.main_name`,
  `admin.apps_name`, `admin.help_text`, `admin.ui_footer`, `admin.ui_header_announcement_*`); the
  announcement text's legacy label says "HTML allowed" (pending: plan, "Deviations needing a
  decision" item 4).
- **FR-035**: Plain-text values MUST be shown as text everywhere and never interpreted as markup.
- **FR-036**: The help text and the footer MUST each offer a preview that renders the HTML through
  exactly the sanitiser of UI feature 001 (FR-002 there), so that it shows what the sign-in screen
  and the shell will show. When the sanitiser removes content, the preview MUST say which kinds of
  content were removed (for example scripts, styles, images from other sites, forms or unsupported
  links), and that the classic interface shows the HTML as written.
- **FR-037**: The announcement MUST offer a preview in the style of its type, with the type conveyed
  in text or by an icon with a text alternative. The page MUST explain that an active announcement
  is shown to every signed-in user and on the sign-in screen.

#### Sign-in page options

- **FR-038**: The Sign-in page MUST offer switches to hide the sign-in link for administrators, for
  domain administrators and for mailbox users, and a switch to force single sign-on, each with the
  legacy explanation. When the public configuration reports no identity provider, the force single
  sign-on switch MUST state that it has no effect until one is configured (UI feature 012).

#### App links

- **FR-039**: The App links page MUST list the custom app links in their stored order, each with its
  name, its link, its user link or "same as link", and whether it is hidden on the sign-in screen, and
  below them the built-in app links of the operator's configuration, marked read-only with an
  explanation. Below the tablet breakpoint the links MUST be cards, on wide screens a table.
- **FR-040**: The administrator MUST be able to add a link, edit and remove each custom link, and
  move each one up or down with labelled actions that work by touch and keyboard. The list MUST be
  saved as a whole. With 50 custom links the add action MUST be unavailable with the limit stated.
- **FR-041**: Each entry MUST be checked before sending: the name is 1 to 255 characters without line
  breaks; the link is an absolute `http` or `https` address or a path that starts with a single `/`;
  the user link, when given, has the same form and may contain the placeholder `%u`. The form MUST
  explain that signed-out visitors get the link and signed-in users the user link, that `%u` is
  replaced by the signed-in user's username, and MUST show the user link as it would read for the
  administrator.

#### IP check

- **FR-042**: The IP check page MUST offer the opt-in as a switch, saved with the page's Save action,
  labelled with the legacy `admin.ip_check_opt_in` verbatim (it names the third-party services
  `ipv4.mailcow.email` and `ipv6.mailcow.email`), and MUST explain that the dashboard (UI feature
  011) can show the public addresses only while the opt-in is on.

#### Password policy

- **FR-043**: The Password policy page MUST show the current policy, read through the password policy
  operation of API feature 003, and MUST offer the minimum length, a whole number from 3 to 64
  checked before sending, and switches for requiring letters, digits, special characters, and lower-
  and upper-case letters.
- **FR-044**: The page MUST show the resulting rules as users will see them when they choose a
  password (the legacy texts `admin.password_policy_*`), updated while the administrator edits, and
  MUST explain that existing passwords keep working and only the next password set is checked.

#### Password reset e-mail

- **FR-045**: The Password reset e-mail page MUST show whether self-service password reset is
  available and MUST offer the sender (empty or a valid e-mail address), the subject (at most 255
  characters, single line), the plain-text template and the HTML template (each at most 1 MiB), with
  a reference of the placeholders `{{link}}`, `{{username}}`, `{{username2}}`, `{{date}}`,
  `{{token_lifetime}}` and `{{hostname}}`, each with its meaning and a copy action.
- **FR-046**: Templates the API marks as defaults MUST be labelled as the default templates. A
  "Restore default templates" action MUST empty both templates in the form, explaining that the
  defaults apply after saving.
- **FR-047**: When a save would leave the sender or the subject empty while password reset is
  available, the app MUST warn that self-service password reset stops working for every user and
  ask for confirmation before sending.
- **FR-048**: The app MUST warn, without blocking, when a template does not contain `{{link}}`, and
  when exactly one of the two templates is empty.

#### Quota notifications

- **FR-049**: The Quota notifications page MUST offer the sender (empty or a valid e-mail address),
  the subject (at most 255 characters, single line) and the HTML template (at most 1 MiB), MUST label
  the values the API marks as defaults, and MUST explain: notifications are sent once at 80 % and
  once at 95 % of the quota; the variables `{{username}}` and `{{percent}}`; empty values mean the
  defaults; the mail service falls back to the default template when it cannot use the stored one.
  A "Restore default template" action MUST empty the template in the form.
- **FR-050**: The page MUST explain that copies of the notifications are set per domain, and MUST lead
  administrators to the domain list of UI feature 002.

#### Quota notification copies

- **FR-051**: The domain page of UI feature 002 MUST gain a "Quota notification copies" section for
  administrators and for the domain administrators of that domain. It MUST show the copy recipients
  and whether copies are active, and MUST explain that each copy is a separate message whose subject
  ends with the mailbox name in parentheses. The section heading and the explanation are the legacy
  `edit.quota_warning_bcc` and `edit.quota_warning_bcc_info`, verbatim.
- **FR-052**: Recipients MUST be edited as a set of entries with the behaviour of UI feature 002's
  tag editor (FR-039 there): each entry a valid e-mail address checked before sending, entries that
  differ only in letter case kept once with the first spelling, at most 100 entries. Several
  addresses pasted at once, separated by spaces, commas, semicolons or line breaks, MUST become
  separate entries.
- **FR-053**: Saving MUST replace the whole list and the active state. When the list is empty, the
  form MUST explain that copies stay inactive without recipients.

#### Rspamd settings rules

- **FR-054**: The Rspamd settings rules page MUST list the rules page by page (25, 50 or 100 per page,
  default 25) with the total, each with its identifier, description, active state and modification
  time, and MUST offer a search on description and content, a filter on the active state, and sorting
  by identifier, description, active state, creation time and modification time (default:
  identifier, ascending). The search, filter, sort and page MUST be kept in the page address.
- **FR-055**: The administrator MUST be able to create a rule on its own page with a description
  (1 to 255 characters), the content (required, at most 1 MiB) in the text editor of FR-072, and the
  active state, which MUST start switched on as in legacy. The page MUST show the legacy text
  `admin.rspamd_com_settings` verbatim, which explains that the setting's name is generated and
  links to the Rspamd documentation of the settings structure.
- **FR-056**: The new-rule page MUST offer "Insert example", listing the Rspamd presets of the API by
  their translated headline. Choosing one MUST fill in the description with the headline and the
  content with the preset's content, and MUST ask before replacing values the user has typed.
- **FR-057**: The administrator MUST be able to open a rule, change its description, content and
  active state, and delete it after a confirmation that names it by description and identifier and
  states that Rspamd stops applying it at its next refresh.
- **FR-058**: The rule pages MUST offer a Check action that asks the API to validate the content
  without saving it, and MUST report success or the error with the unbalanced structure and its
  position, which the user can reach in one action.
- **FR-059**: After a successful save or deletion, the app MUST say that Rspamd applies the change
  within its settings refresh interval, without a restart.

#### Effective settings map

- **FR-060**: The Rspamd settings rules page MUST lead to the effective settings map, shown
  read-only in the text editor of FR-072 with a copy action. When the API cannot retrieve it, the
  app MUST show a translated error with a retry action.

#### Presets

- **FR-061**: Preset headlines MUST be shown in the user's language through the preset's translation
  key, reusing the legacy keys (`admin.rsettings_preset_*`, `mailbox.sieve_preset_*`). A preset whose
  key the app does not know MUST be shown with the English headline the API supplies.
- **FR-062**: The create-filter form of the mailbox Sieve filters (UI feature 005) MUST gain "Insert
  example", listing the Sieve presets of the API by their translated headline. Choosing one MUST
  fill in the script, and the description when it is empty, and MUST ask before replacing a script
  the user has typed. The global Sieve filters MUST NOT offer the Sieve presets.

#### Global filter maps

- **FR-063**: The Global filter maps page MUST list the editable maps with their name, as the API
  supplies it, and their identifier, with a search on the name, and MUST explain what the maps are
  for and the `/pattern/flags` format with an example, through the legacy texts
  `admin.rspamd_global_filters_info` and `admin.rspamd_global_filters_regex` (pending for the
  latter's restart link: plan, "Deviations needing a decision" item 7).
- **FR-064**: Each map MUST open on its own page in the text editor of FR-072. While the user types,
  the app MUST mark every line that is neither empty, nor a comment starting with `#`, nor a
  `/pattern/` expression followed by at most one of the flags `i`, `m` or `s`.
- **FR-065**: The map page MUST offer a Check action that asks the API to validate the content
  without saving it, and MUST report success or each failing line with its number and reason.
- **FR-066**: Saving MUST first show a review of the change, listing the added and the removed lines
  with their counts, and MUST require confirmation. After a successful save the app MUST say that
  Rspamd reloads the map without a restart.
- **FR-067**: When the API reports that the map is not available on this server, the app MUST say so
  and that nothing was changed.

#### Global Sieve filters

- **FR-068**: The Global Sieve filters page MUST show the pre-filter and the post-filter, each in the
  text editor of FR-072, each saved on its own, with the explanation that the pre-filter runs before
  and the post-filter after every mailbox's own filters.
- **FR-069**: Each filter MUST offer a Check action that asks the API to validate the script without
  saving it, and MUST report success or the error with its line and the parser's reason, which the
  user can reach in one action.
- **FR-070**: Saving MUST ask for confirmation with a choice between "Restart the mail service now",
  preselected, and "Apply at the next restart". The confirmation MUST explain that the restart
  briefly interrupts IMAP, POP3 and mail delivery for every user. For an empty script it MUST also
  explain that an empty script means no global filter.
- **FR-071**: After a successful save the app MUST report the restart outcome the API returns: done;
  failed, with the note that the script is saved and takes effect at the next restart; or deferred.
  When the API reports that the filter file is not available on this server, the app MUST say so
  and that nothing was saved or restarted.

#### Text editors

- **FR-072**: Settings rules, filter maps, global Sieve filters, the effective settings map, the
  e-mail templates and the mass mail bodies MUST be edited in a text editor that:
  - uses a monospaced font, except for the mass mail plain-text body;
  - shows line numbers, except for the e-mail templates and the mass mail bodies;
  - never auto-capitalises, auto-corrects or checks spelling;
  - wraps long lines by default and offers to turn wrapping off, in which case only the editor
    scrolls sideways, never the page;
  - lets an error that names a line move the cursor to that line and announce it;
  - shows the content's size against the 1 MiB limit once it exceeds 90 % of it, and blocks saving
    above the limit with a message stating it;
  - is fully operable by keyboard, with a documented way to leave it by keyboard (the Tab key must
    not be captured without an escape).

#### Rspamd web interface

- **FR-073**: The Rspamd web interface page MUST offer one password field with a show and hide
  control, accepting 6 to 256 characters without control characters, checked before sending, and
  MUST work with password managers as a new password. The field MUST always start empty, because
  the password is write-only. The page MUST link to the Rspamd web interface at the address the
  settings capabilities report. (Pending: legacy asks for the password twice, `admin.password` and
  `admin.password_repeat`; plan, "Deviations needing a decision" item 8.)
- **FR-074**: After a successful change the app MUST say that the password is set and Rspamd
  restarted, and MUST clear the field. When the API reports a container service failure, the app
  MUST say that the change could not be confirmed and that the new password may take effect only at
  Rspamd's next start, and MUST offer to try again.

#### CORS of the classic API

- **FR-075**: The CORS page MUST explain that these settings apply only to the API of the classic
  interface (`/api/v1`) and not to this app's API. It MUST offer the allowed origins as a set of
  entries, with the behaviour of FR-052 for adding, pasting and removing, at most 100, each `*` or
  `scheme://host[:port]` with the scheme `http` or `https` and no path, query or fragment, checked
  before sending and normalised to lower case; and the allowed methods as checkboxes for GET, POST,
  PUT and DELETE, of which at least one MUST be chosen.
- **FR-076**: The page MUST explain that an empty origin list means the server's own origin, and MUST
  warn, without blocking, that `*` allows every origin.

#### License

- **FR-077**: The License page MUST show the server's GUID with a copy action, or that mailcow marked
  it invalid, and the last verification result: valid, invalid, unreachable or never verified, with
  the customer ID, service ID and support level when known.
- **FR-078**: A "Verify now" action MUST explain that only the GUID is sent to the mailcow license
  service, MUST show progress while waiting, and MUST show the new result. An unreachable service
  MUST be shown as the result "unreachable", not as an error.
- **FR-079**: When the API answers "feature disabled" although the capabilities reported license
  verification as enabled, the app MUST read the capabilities again and show the "not found" state
  of FR-006.

#### Mass mail: compose and recipients

- **FR-080**: The Send mass mail page MUST offer, in this order: the recipients, the sender, the
  subject, the plain-text body and an optional HTML body. On small screens these MUST be steps with a
  progress indicator ("Step 2 of 4": recipients, message, preview, send); on wide screens one page
  with sections.
- **FR-081**: The recipients MUST be chosen as: every receiving mailbox, optionally limited to chosen
  domains; and then either nobody else excluded, only listed mailboxes, or everyone except listed
  mailboxes. Domains MUST be chosen with a searchable picker of the server's domains, and mailboxes
  with a searchable picker of the server's mailboxes, both page by page from the API; addresses
  pasted at once MUST become separate entries as in FR-052. The form MUST explain that inactive
  mailboxes that may not receive mail and resources are never included.
- **FR-082**: The sender MUST be prefilled with `noreply@` followed by the server's host name from
  the settings capabilities, and MUST be a valid e-mail address. The subject MUST be 1 to 255
  characters on one line. The plain-text body MUST be required and the HTML body optional, each at
  most 1 MiB. The HTML body MUST offer the preview of FR-090.
- **FR-083**: The app MUST request a recipient preview whenever the user reaches the preview step,
  or asks for it on wide screens, and MUST show the number of recipients and the recipient addresses
  page by page, sorted by address, with a search by address. A preview with no recipients MUST say
  so and make sending unavailable. Changing the selection MUST discard the preview.

#### Mass mail: sending

- **FR-084**: Sending MUST require a confirmation that shows the sender, the subject, a summary of the
  selection and the number of recipients from the preview, and that states that every recipient
  receives one copy directly in their inbox, without spam filtering, and that a sent message cannot
  be recalled. The confirmation's send action MUST name the recipient count, for example "Send to
  120 mailboxes", and nothing MUST be sent until it is chosen.
- **FR-085**: When the API reports that the number of recipients changed, the app MUST show a fresh
  preview with the new number and ask for confirmation again. When it reports that a mass mail is
  already running, the app MUST say so and link to the running job. When it refuses selection
  entries, each refused entry MUST be marked with its translated error.
- **FR-086**: After a successful send the app MUST open the new job's page. Leaving the compose page
  with entered content and without sending MUST ask for confirmation.

#### Mass mail: jobs

- **FR-087**: The Mass mail jobs page MUST list the jobs page by page, newest first, with subject,
  status (running, completed or cancelled), creator, creation time and the numbers per outcome, with
  a filter by status and a search on the subject. A running job MUST be marked at the top of the list.
- **FR-088**: A job page MUST show the sender, the subject, the selection, the creator, the creation,
  start and end times, the status and the numbers of delivered, failed, skipped and pending
  recipients as text and as a bar. While the job runs and the page is visible, these MUST be
  refreshed every 5 seconds; the refresh MUST pause while the page is hidden and run once when it
  becomes visible again, MUST offer a control that pauses and resumes it, MUST pause with a
  "Resume" action once the last interaction is older than the app's inactivity limit (the lower of
  15 minutes and the session's idle timeout) and not resume on its own, and MUST stop when the job
  ends; the last update time MUST be shown. Leaving the page MUST NOT affect
  the delivery. Its recipients MUST be listable page by page, sorted by address, filtered by outcome
  and searchable by address, each with its outcome and, for failures, the reason: translated where
  the API reports a stable `failureCode`, otherwise a generic translated failure label. Raw SMTP
  diagnostic text is not rendered (G1 closed by contract pin `dd9a44e`). The bodies MUST be viewable, the HTML body only through the preview of FR-090.
- **FR-089**: Cancelling a running job MUST ask for confirmation, stating that pending recipients
  will not receive the message and that recipients who already received it keep it. After
  cancellation the job MUST show as cancelled with the pending recipients as skipped. When the API
  reports that the job already completed, the app MUST say so and show its final state.

#### HTML previews of e-mail content

- **FR-090**: The HTML templates of the password reset and quota notification e-mails and the HTML
  body of mass mail MUST offer a preview on request, never automatically. The preview MUST be shown
  isolated from the app, MUST NOT run scripts or submit forms, MUST NOT load any remote resource
  (remote images are replaced by a labelled placeholder), MUST replace the documented placeholders by
  translated sample values, and MUST say that e-mail clients may show the message differently.

#### History

- **FR-091**: Every settings page, rule, map and job page MUST offer a History action that opens the
  audit log screen of UI feature 001, filtered to that page's target type and, where there is one,
  its target ID. This feature MUST add labels and translations for its audit event types to that
  screen. That screen MUST gain filters by the target types of this feature (logo, UI texts,
  login page options, app links, brand colours, IP check, password policy, reset e-mail, quota
  notification, quota notification copies, settings rule, filter map, global Sieve filter, Rspamd
  password, CORS, mass mail job, license) and by target. Entries MUST show the changed values with
  their old and new value in the user's language; templates, maps, rules, scripts, the help text and
  the footer only as changed with their old and new size; logos with their old and new type,
  dimensions and size; the Rspamd password only as changed; and the outcome of the mail service
  restart or the Rspamd confirmation.

#### Errors and feedback

- **FR-092**: Every API error MUST be shown as a translated message chosen by its problem type and
  validation rule codes, with their parameters, never as the API's English text. This feature MUST
  handle at least:

  | API outcome | App behaviour |
  |---|---|
  | Outdated version | FR-011 |
  | Temporary failure | Nothing was changed; retry that keeps the input |
  | Demo mode | FR-017 |
  | Map unavailable | FR-067 |
  | Filter file unavailable | FR-071 |
  | Container service failure | FR-074 |
  | Mass mail already running | FR-085 |
  | Recipient count changed | FR-085 |
  | Feature disabled (license) | FR-079 |
  | Conflict when cancelling a completed job | FR-089 |
  | Session required | Generic message with the advice to sign in again (not expected from the app's own use) |
  | Validation failed | FR-012, with the rule codes for unsupported image type, unsafe SVG content, too-low contrast, invalid regex line, invalid Sieve syntax, unbalanced settings rule, and the length, format, range and list rules of this feature |
  | Not found | "Not found" state of FR-006, or of UI feature 002 for a domain |
  | Forbidden | FR-003 |

  Unknown rule codes MUST be shown as a generic invalid value of that field.
- **FR-093**: The outcome of every change, check and verification MUST be shown and announced to
  screen reader users. A status message MUST NOT disappear while it has focus or is hovered.

#### Mobile and responsive behaviour

- **FR-094**: Every screen and state of this feature MUST be fully usable at 360 px width without
  horizontal scrolling of the page, and its content MUST reflow at 400 % zoom on a 1,280 px wide
  screen. Only a text editor with wrapping turned off may scroll sideways, inside itself.
- **FR-095**: Interactive targets MUST be at least 44 × 44 CSS px, including move actions, entry
  remove buttons and editor actions.
- **FR-096**: Fields for addresses, origins, links, colours and hexadecimal values MUST NOT
  auto-capitalise or auto-correct, e-mail fields MUST bring up an e-mail keyboard, link fields a URL
  keyboard, and number fields a numeric keypad.
- **FR-097**: Dialogs and confirmations MUST fit a 360 px screen; long content in them, such as a
  review of map changes, MUST scroll inside the dialog while its actions stay visible.

#### Accessibility

- **FR-098**: Every screen of this feature MUST meet WCAG 2.2 AA in both themes, with the default
  palette and with any brand colour the API accepts. Every function MUST be operable by keyboard,
  including the search, the page switcher, entry editing, reordering, the colour picker and the
  editors, and the focus MUST be visible and never hidden behind sticky bars.
- **FR-099**: Contrast results, validity marks of editor lines and entries, job statuses, outcome
  counts and progress bars MUST have text equivalents and MUST NOT rely on colour alone.
- **FR-100**: Search result counts, check results, save outcomes and job progress MUST be announced
  as status messages without moving the focus; job progress MUST be announced at most once every
  30 seconds and at the end of the job.
- **FR-101**: Dialogs MUST be labelled, keep the focus inside, close with Escape unless an action is
  in progress, and return the focus to the control that opened them. Opening a page, a step or a
  section form MUST move the focus to its heading, and a failed submission to the error summary.
- **FR-102**: The colour picker MUST NOT be the only way to enter a colour; the hexadecimal field MUST
  always be available.

#### Internationalisation

- **FR-103**: All user-facing text MUST follow constitution IV 1.3.0: every language mailcow ships
  is supported; text with a classic-interface equivalent MUST be mailcow's own translation, used
  verbatim by its legacy key, including texts that name the product (for example
  `admin.main_name`, `admin.title_name`, `admin.force_sso`) and texts with HTML markup (rendered
  through the sanitiser); the screens MUST mirror the legacy forms (fields, labels, help texts,
  options, units, order and messages); new strings, only for elements the classic interface lacks,
  MUST exist in English, Czech and Slovak and MUST NOT be machine-translated. New strings MUST call
  the legacy UI "the classic interface" ("klasické rozhraní" in Czech, "klasické rozhranie" in
  Slovak), never "legacy".
- **FR-104**: Operator texts, logos, app link names, rule descriptions, map contents, scripts,
  templates, mass mail content and addresses MUST be shown as stored and never translated. Filter
  map names MUST be shown as the API supplies them, because the operator's configuration defines
  them.
- **FR-105**: Sizes MUST be shown in binary units, and numbers, ratios and times MUST be formatted for
  the user's language, times in the device's time zone.

#### Security in the browser

- **FR-106**: The Rspamd web interface password MUST NOT be written to device storage or to page
  addresses, MUST be cleared after each attempt, and MUST NOT be shown after it was submitted.
- **FR-107**: Operator HTML MUST be rendered only through the sanitiser of FR-036 or in the isolated
  preview of FR-090. Logos and chosen files MUST be shown only as images.
- **FR-108**: Mass mail content and selections MUST be kept only while the page is open and MUST NOT
  be written to device storage.

#### Data freshness

- **FR-109**: After a successful change, every screen that shows the changed setting MUST show the new
  value, including the shell after branding changes (FR-031). Data already loaded MUST NOT be loaded
  again without reason, apart from the periodic refresh of a running mass mail job.

### Legacy Parity

Legacy reference: FeldHost fork of mailcow-dockerized at `../mailhosting/data/web/` (upstream tag
`2026-09a`): `templates/admin.twig`, `templates/admin/tab-config-customize.twig`,
`templates/admin/customize/logo.twig`, `tab-config-password-settings.twig`, `tab-config-quota.twig`,
`tab-config-rsettings.twig`, `tab-config-rspamd.twig`, `tab-config-admins.twig` (CORS card),
`tab-sys-mails.twig`, `tab-globalfilter-regex.twig`, `templates/modals/admin.twig`
(`addRsettingModal`), `templates/mailbox/tab-filters.twig` (global filters),
`templates/modals/mailbox.twig` (Sieve presets), `templates/edit/domain.twig` (Quota warning BCC),
`templates/base.twig` (Apps menu), the upstream `templates/dashboard.twig` (GUID & License),
`js/site/admin.js`, `js/presets/{rspamd,sieveMailbox}.js` and `lang/lang.{en-gb,cs-cz,sk-sk}.json`.
Status: **Matched** (same capability), **Improved** (same capability, better behaviour) or
**Dropped** (intentionally not in this feature, with the reason).

#### Navigation

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| System › Configuration with the menus Access, Options and Global filter maps, and the System mails tab | Tabs and drop-downs; on phones collapsed cards | Revised by the owner: TailAdmin sidebar sections with shared content tabs, responsive tab disclosures and an address per page; the overview retains settings discovery | FR-004 to FR-008 |
| Remembered active tab | Browser storage | Improved: every page has its own address | FR-006 |

#### Options › Customize

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Change logo: Normal and "Inverted for dark mode" file inputs, one Upload button | Uploads one or both, declared type trusted | Improved: each variant on its own with a preview before upload; limits checked before upload, content checked by the API | FR-018 to FR-021 |
| Logo thumbnail with dimensions, type and size badges | Light logo on white, dark logo on black | Improved: both themes, header and sign-in sizes, text details | FR-018, FR-019 |
| Reset to default | Deletes both logos at once, no confirmation | Improved: each logo on its own, with a confirmation | FR-022 |
| Logo size hint (`admin.logo_info`) | 40 px header height, 250 px start page | Matched, with the sizes this app uses | FR-023 |
| IP Check opt-in checkbox and Save | Text with markup | Matched, explanation verbatim with its markup through the sanitiser | FR-042 |
| Login Page: three quick-link checkboxes, force SSO with explanation, Save | — | Matched; force SSO explains when it has no effect | FR-038 |
| App links table: name, link, user link, "Hide for login", Remove row, Add row, Save | Rows on one wide table; mismatched rows saved nothing yet reported success | Improved: cards on phones, reordering, validation per entry, user link preview, limit | FR-039 to FR-041 |
| Greyed-out built-in app links (`admin.merged_vars_hint`) | Read-only rows | Matched | FR-039 |
| UI texts: website title, product name, "Apps" name, help text | Inputs with branded placeholders | Matched with the legacy labels verbatim; empty meaning explained; hard-coded brand placeholders dropped (constitution IV; plan "Deviations" item 5), `header.apps` placeholder kept | FR-016, FR-034 |
| Announcement: type select, text "(HTML allowed)", active checkbox | The text is in fact shown escaped | Improved: preview and the existing plain-text `admin.text` label, matching actual rendering (plan "Deviations" item 4) | FR-034, FR-037 |
| Footer "(HTML allowed)" | Rendered raw by legacy | Improved: preview through the app's sanitiser | FR-036 |
| Demo mode refusal | Error message after submitting | Improved: branding pages read-only with the reason in demo mode | FR-017, FR-033 |
| No brand colours | — | Improved: new colours with live preview and contrast checks | FR-024 to FR-030 |

#### Header and login page app links

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| App links under the login form | Links not hidden for login | Moved to UI feature 001, which shows them from API 001's public configuration | — |
| "Apps" drop-down in the header with `%u` replaced | For signed-in users | Moved to UI feature 001; this feature edits the links and the heading | FR-034, FR-039 to FR-041 |

#### Options › Password settings

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Password policy: length 3 to 64 and four checkboxes, Save | Out-of-range lengths silently kept the old value | Improved: range checked, rules shown as users see them | FR-043, FR-044 |
| Password Recovery Settings: sender, subject, collapsed text and HTML templates, placeholder list, "Leave empty to restore default template" | Invalid sender stored as empty and reported as success | Improved: sender checked, defaults labelled, restore action, previews, warnings when reset is switched off or `{{link}}` is missing | FR-045 to FR-048, FR-090 |

#### Options › Quota notifications

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Info text (80 % and 95 %), sender, subject, collapsed HTML template | Variables text commented out in the template | Improved: variables documented, defaults labelled, restore action, preview | FR-049, FR-090 |

#### Edit domain › Quota warning BCC

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Recipients text area, Active checkbox, Save, info text | Invalid entries silently skipped | Improved: entries checked one by one, paste splitting, explanation of empty lists | FR-051 to FR-053 |

#### Options › Rspamd settings map

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Collapsed "Active settings map" | Read-only text area | Matched, with a copy action and an error state | FR-060 |
| Rule list on the left, rule form on the right; "No rules available", "Please select a rule" | All rules on one page | Improved: paged, searchable, filterable list; one page per rule | FR-054, FR-057 |
| Rule form: description, content, active, Save, Remove | Remove without impact statement | Improved: Check action, confirmation naming the rule | FR-057 to FR-059 |
| Add rule modal with presets ("Insert example preset") | Fills description and content, overwriting silently | Improved: own page; asks before overwriting | FR-055, FR-056 |

#### Global filter maps › Regex maps

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| "I will be careful!" gate | Remembered in browser storage and the session | Dropped: replaced by a review and confirmation of each change (pending decision, plan "Deviations" item 7) | FR-066 |
| Explanation and format example | Text with markup and a restart link | Matched verbatim with its markup; the restart link is pending (plan "Deviations" item 7); restarting Rspamd belongs to UI feature 011 | FR-063 |
| Index of maps with anchors | One long page with every map | Improved: list with search and one page per map | FR-063, FR-064 |
| Text area per map, Validate (browser), Save enabled only after Validate | Browser check only; editing disables Save again | Improved: live line marks, server check with line numbers, review before save | FR-064 to FR-066 |
| Missing map file | Silently reported as success | Improved: "not available" message | FR-067 |

#### Mail setup › Filters › Global prefilter and postfilter

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Two text areas, Validate, Save (enabled after Validate) | Every save restarts Dovecot; missing file still reports success | Improved: line and reason of errors, restart choice with explanation, restart outcome, missing file reported | FR-068 to FR-071 |

#### Mail setup › Filters › Add filter modal

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Sieve example presets | Links fill the script | Matched in the mailbox filter form of UI feature 005; asks before overwriting | FR-061, FR-062 |

#### Access › Rspamd UI

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Link to the Rspamd UI, Rspamd logo | Fixed path `/rspamd/` | Link matched, at the address the capabilities report; logo dropped (decoration) | FR-073 |
| Password and repeat fields, Save | Minimum 6 characters | Improved: one field with show and hide (pending decision, plan "Deviations" item 8), password-manager support, outcome including restart | FR-073, FR-074 |

#### Access › Administrators › API › CORS Settings

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Allowed origins text area, methods multi-select, Save | Origins in one text area | Improved: entries checked one by one, methods as checkboxes, `*` warning, scope explained | FR-075, FR-076 |

#### System mails

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| From (prefilled `noreply@<host name>`), Subject | — | Matched | FR-082 |
| Excludes and Includes multi-selects of every mailbox (selecting one clears the other) | Long lists rendered in the page; inactive mailboxes included; unknown entries ignored | Improved: domain limit, include or exclude choice, searchable pickers, refused entries marked | FR-081, FR-085 |
| Text, optional HTML, link to an external HTML-to-text converter | — | Text and HTML matched with a preview; external converter link dropped (no third-party links built into the app) | FR-082, FR-090 |
| "Activate send button" checkbox, Send | Sent synchronously without showing who receives it | Improved: preview of the recipients, confirmation of the count, background job | FR-083 to FR-086 |
| No record of sent mail | — | Improved: job list and job pages with outcomes, cancellation | FR-087 to FR-089 |

#### Dashboard › GUID & License (upstream only; removed in the FeldHost fork)

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| GUID field, heart icon for a valid license, customer ID, service ID, "Moo level" | Icon only for validity | Improved: result in text, copy action; page hidden where verification is disabled | FR-033, FR-077 |
| "Validate GUID against license server" button | — | Matched with progress and an explanation of what is sent | FR-078 |
| License info text with links to the vendor's order pages | — | Text kept verbatim; dropping the vendor links is pending (plan "Deviations" item 6) | FR-077 |

### API Dependency

This feature depends on **mailcow REST API v2 feature 013, System settings**
(`mailcow-rest-v2/specs/013-system-settings/spec.md`), on the identity, public configuration,
error conventions and audit log of API feature 001, on the domain list and domain page conventions of
API feature 002, and on the password policy read and the mailbox list of API feature 003. The
contract version is pinned in the plan once the API 013 contract has been merged.

| Behaviour relied on | API requirement |
|---|---|
| Permission matrix; "not found" for copy recipients outside the scope; forbidden for other roles | API 013 FR-001 to FR-005 |
| Mass mail sending and cancelling and the Rspamd password in a signed-in session | API 013 FR-006 |
| Partial changes, version tags on every mutable resource, outdated refusal, refusals change nothing, demo mode | API 013 FR-007 to FR-012 |
| Logo upload, content-based type check, limits, SVG safety, deletion, details | API 013 FR-013 to FR-018 |
| UI texts, plain-text and HTML fields, lengths, empty meanings | API 013 FR-019 to FR-023 |
| Login page options and the force single sign-on rule | API 013 FR-024 |
| Custom and built-in app links, rules, limit | API 013 FR-025 to FR-027 |
| Brand colours, reference surfaces, effective colours and foregrounds | API 013 FR-029 to FR-032 |
| Public configuration with the effective brand colours, read again after branding changes | API 013 FR-033, FR-034; API 001 FR-042 to FR-044 |
| Settings capabilities: logo limits, license verification enabled, demo mode, server host name, Rspamd web interface address | API 013 settings capabilities read (being added) |
| IP check opt-in | API 013 FR-035 |
| Password policy change, version tag shared with the read | API 013 FR-036 to FR-038; API 003 FR-063 |
| Reset e-mail, availability, defaults, placeholders | API 013 FR-039 to FR-042 |
| Quota notification settings and defaults | API 013 FR-043 to FR-045 |
| Quota notification copy recipients | API 013 FR-046 to FR-049 |
| Settings rules: list, search, filter, sort, create, change, delete, structural check | API 013 FR-050 to FR-055 |
| Global filter maps (the API's global regex maps): list, read, replace, line check, map unavailable | API 013 FR-056 to FR-059 |
| Effective settings map | API 013 FR-060 |
| Rspamd and Sieve presets with translation keys and English headlines | API 013 FR-061 |
| Global Sieve filters, validation, restart outcome, filter file unavailable | API 013 FR-062 to FR-065 |
| Rspamd web interface password | API 013 FR-066, FR-067 |
| CORS settings of the legacy API | API 013 FR-068 to FR-071 |
| Mass mail preview with search by address (search being added), selection rules, send with expected count, single job, jobs, recipients, cancel | API 013 FR-072 to FR-081 |
| License status, verification, disable setting | API 013 FR-082 to FR-085 |
| Audit records with target types, changed values and side effects; target filters | API 013 FR-086 to FR-088; API 001 FR-046, FR-047 |
| Problem types and validation rule codes with parameters | API 013 FR-089; API 001 FR-049, FR-055 |
| Validate-only option for global filter maps, global Sieve filters and settings rules | API 013 FR-093 |
| Domain list for pickers and the domain page | API 002 |
| Mailbox list for the mass mail picker | API 003 |

**API gaps**: none. The six gaps found against the first API draft are being closed in API 013. Its
settings capabilities read reports the logo limits, whether license verification is enabled, whether
demo mode is on, the server's host name and the address of the Rspamd web interface (FR-032), and the
recipient preview gains a search by address (FR-083). If the merged contract lacks any of them, the
gap is specified in mailcow-rest-v2 first and the UI does not work around it. Planning found one
gap in the merged contract: mass mail recipient failure reasons are free text without a stable code
(plan, API gap G1). It is proposed to mailcow-rest-v2 before implementation; until it is closed,
the app translates stable `failureCode` values and uses a generic translated fallback (FR-088).
The pinned contract `dd9a44e` closes G1; raw SMTP diagnostics are not UI messages.

### Key Entities *(include if feature involves data)*

- **Settings page** (app-defined): group, name, description, sections, field labels and legacy names
  used by the search.
- **Settings capabilities**: logo file size and pixel limits, whether license verification is
  enabled, whether demo mode is on, the server's host name and the Rspamd web interface address.
- **Logo**: light or dark image with type, file size, pixel dimensions and a version tag.
- **Brand colours**: optional light and dark colour, the derived effective colour and foreground per
  theme, and a version tag.
- **UI texts**: page title, product name, apps heading, help text, footer, announcement text, type and
  active state, and a version tag.
- **Login page options**: three sign-in link visibility flags and "force single sign-on".
- **App link**: name, link, optional user link, hidden on the sign-in screen; custom or built-in.
- **IP check opt-in**: on or off.
- **Password policy**: minimum length and required character classes.
- **Password reset e-mail**: sender, subject, text and HTML templates, default markers and
  availability of password reset.
- **Quota notification settings**: sender, subject, HTML template and default markers.
- **Quota notification copies**: per domain, recipient addresses and active state.
- **Rspamd settings rule**: identifier, description, content, active state, times and a version tag.
- **Effective settings map**: the read-only text Rspamd receives.
- **Preset**: identifier, translation key, English headline and content, of kind Rspamd or Sieve.
- **Global filter map**: identifier, name, content and a version tag.
- **Global Sieve filter**: pre-filter or post-filter script with a version tag and the restart outcome
  of its last save.
- **Rspamd web interface password**: write-only.
- **CORS settings**: allowed origins and methods of the legacy API.
- **License status**: GUID or invalid marker, last verification result, customer ID, service ID and
  support level.
- **Mass mail selection and preview**: domains, include or exclude list, recipient count and
  addresses.
- **Mass mail job**: sender, subject, bodies, selection, creator, times, status and counts per outcome.
- **Mass mail recipient**: address, outcome and failure reason.
- **History entry**: an audit record about one of this feature's targets.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a moderated test with at least 5 administrators who know the legacy UI, at least 90 %
  open a named setting (for example the announcement, a filter map or the CORS origins) on a 360 px
  wide phone at the first attempt and in under 20 seconds.
- **SC-002**: An administrator uploads a logo, sets the product name and picks a brand colour on a
  phone in under 3 minutes.
- **SC-003**: Automated accessibility checks report 0 WCAG 2.2 AA violations on every screen and
  state of this feature, at 360 px and at desktop width, in the light and dark themes, with the
  default palette and with brand colours at the 4.5:1 limit.
- **SC-004**: With any brand colour the API accepts, 100 % of brand-coloured texts reach at least
  4.5:1 and 100 % of brand-coloured control parts at least 3:1 against what surrounds them, in both
  themes.
- **SC-005**: No screen of this feature scrolls horizontally at 360 px width or at 400 % zoom on a
  1,280 px wide screen.
- **SC-006**: 100 % of invalid regex lines, Sieve syntax errors and unbalanced settings rules in the
  test set are reported with their line or construct, and the user reaches the failing line in one
  action.
- **SC-007**: 100 % of saves based on outdated data are stopped, and the user's unsaved input is
  still present afterwards.
- **SC-008**: In 100 % of mass mail tests, nothing is sent before the confirmation naming the
  recipient count has been accepted, and a changed count always leads to a new confirmation.
- **SC-009**: The progress shown on a running mass mail job's page is never more than 10 seconds
  behind the API's state while the page is visible and the user is active (FR-088).
- **SC-010**: The preview of the help text and the footer matches what the sign-in screen shows for
  100 % of the test set, and in 100 % of the hostile e-mail templates no script runs and no remote
  resource is requested during a preview.
- **SC-011**: For 100 % of the settings in the parity test set, every value the replaced legacy
  screens show is shown by the new app.
- **SC-012**: In 100 % of the permission tests (administrator, domain administrator, mailbox user),
  the app offers exactly the capabilities of FR-002.
- **SC-013**: Translation completeness checks find 0 new strings missing in English, Czech or Slovak,
  and 0 legacy keys used by the feature missing from the bundled `en-gb` snapshot.
- **SC-014**: When the API answers within 1 second, every settings page is usable within 2 seconds of
  opening it on a mid-range phone over a mobile connection, and the settings search shows results
  within 300 ms of a keystroke.

## Assumptions

- UI feature 001 provides the shell, navigation, sign-in, identity, language and theme, session
  handling, generic error handling (including 401 and 403), status announcements, the sanitiser for
  operator HTML, the audit log screen, and the app links on the sign-in screen and in the Apps menu.
  This feature extends the shell with the brand colours (FR-030, FR-031), and the audit log screen
  with its target filters and event labels (FR-091).
- UI feature 002 provides the domain page that gains the quota notification copies section
  (FR-051), and UI feature 005 the mailbox filter form that gains the Sieve examples (FR-062).
- UI feature 011 provides the dashboard's public address lookup and restarting containers, for
  example to apply a deferred global Sieve filter.
- The API 013 contract is merged before this feature is planned. Until the API is implemented, the
  feature is built and tested against a mock generated from the contract.
- The settings capabilities read and the search in the recipient preview are being added to API 013
  and are part of the contract this feature pins.
- The reference surfaces of the brand colours are white and `#1D2939`, as agreed with the API; the
  app's light surfaces that carry brand-coloured text are white and its dark ones at most as light
  as `#1D2939`.
- The legacy UI keeps working for everything until the cutover (feature 014), and it never sends
  version tags.
- Constitution IV 1.3.0 applies: legacy translation keys are used verbatim, for example
  `admin.customize`,
  `admin.change_logo`, `admin.logo_normal_label`, `admin.logo_dark_label`, `admin.upload`,
  `admin.ip_check`, `admin.login_page`, `admin.quicklink_text`, `admin.user_quicklink`,
  `admin.domainadmin_quicklink`, `admin.admin_quicklink`, `admin.app_links`, `admin.app_name`,
  `admin.link`, `admin.user_link`, `admin.app_hide`, `admin.ui_texts`, `admin.apps_name`,
  `admin.ui_header_announcement*`, `admin.password_policy*`, `admin.password_length`,
  `admin.password_reset_settings`, `admin.password_reset_tmpl_text`,
  `admin.password_reset_tmpl_html`, `admin.quota_notifications`, `admin.quota_notifications_info`,
  `admin.quota_notification_sender`, `admin.quota_notification_subject`,
  `admin.rspamd_settings_map`, `admin.active_rspamd_settings_map`, `admin.rsetting_*`,
  `admin.rsettings_preset_*`, `admin.rspamd_global_filters`, `admin.regex_maps`,
  `admin.cors_settings`, `admin.allowed_origins`, `admin.allowed_methods`, `admin.sys_mails`,
  `admin.includes`, `admin.excludes`, `admin.guid_and_license`, `admin.guid`, `admin.customer_id`,
  `admin.service_id`, `admin.validate_license_now`, `edit.quota_warning_bcc`, `add.validate`,
  `mailbox.sieve_preset_*`, `header.apps`, `success.ui_texts`, `success.app_links`,
  `success.custom_login_modified`, `success.ip_check_opt_in_modified`,
  `success.password_policy_saved`, `success.rspamd_ui_pw_set`, `success.cors_headers_edited`,
  `success.global_filter_written`, `success.dovecot_restart_success`,
  `warning.dovecot_restart_failed`, `danger.sieve_error`, `danger.img_size_exceeded`,
  `danger.img_dimensions_exceeded`, `danger.cors_invalid_origin` and `danger.cors_invalid_method`,
  and also the texts that name the product or carry markup (`admin.main_name`, `admin.title_name`,
  `admin.force_sso`, `admin.ip_check_opt_in`, `admin.rspamd_com_settings`,
  `admin.merged_vars_hint`, `admin.license_info`). Where a legacy text's meaning no longer fits (the
  announcement text label), the plan lists it under "Deviations needing a decision" instead of
  giving it a new key.
- Defaults of this feature: page sizes 25 (default), 50 and 100; the 90 % size indicator of the
  editors.
- **Out of scope**: per-domain branding, favicons, custom style sheets and more than one brand colour
  per theme; displaying the app links (UI feature 001); the quota thresholds; adding or removing
  filter maps; Rspamd actions, scores and
  quarantine settings (UI feature 006); fail2ban, the dashboard and restarting containers outside
  the global filter save (UI feature 011); password reset itself and mailbox Sieve filters apart from
  the examples (UI feature 005); identity-provider configuration (UI feature 012); scheduled mass
  mail, attachments and mass mail to addresses outside the server; bulk actions; legacy `/api/v1`
  keys.

### System mails implementation decision — 2026-10-21

The implemented US10 flow follows FR-080–089: recipient selection, message fields, preview, then one
explicit Send confirmation showing the actual recipient count. This resolves plan D3 within the
existing feature-completion authorization; it is an implementation decision, not a new user quote.
The classic sender, subject, text and optional HTML field order and meanings remain. G1 is closed
by the pinned generated `failureCode` enum; translated stable codes and a generic fallback replace
the earlier interim proposal to quote SMTP replies. No maildev sending is used for validation.
