# Feature Specification: DKIM, MTA-STS and DNS

**Feature Branch**: `main` (no feature branches, constitution 1.1.0)

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "DKIM, MTA-STS and DNS screens for mailcowui-ng, the mobile-first web
app for mailcow-dockerized, built only on mailcow REST API v2 feature 010 (DKIM, MTA-STS and DNS
diagnostics). Administrators see every DKIM key of the server with its state (valid, missing,
unused, incomplete), filter, search and sort them, read the DNS record each key needs and copy the
record name and value with one tap, generate keys for names without one, import, copy and delete
keys, export a private key when the operator allows it, and publish a key's record to the ISPConfig
DNS server again when that publication is enabled. Domain administrators see the keys of their
domains and alias domains and generate keys for those without one. Administrators and domain
administrators manage a domain's MTA-STS policy (mode, MX hosts, maximum age, active state), see
the policy identifier and the DNS records it needs, and deactivate a policy instead of deleting it.
They run DNS diagnostics for a domain or alias domain and see, record by record, whether it
matches, differs, is missing, could not be looked up, is informational or cannot be verified, with
the expected and found values, partial results, rate-limit messages and a zone file to download.
Destructive actions need confirmation, lists and results become cards on phones, and every view has
loading, empty and error states. The feature replaces the legacy System › Configuration › ARC/DKIM
keys tab and its private key modal, the DKIM record and MTA-STS tab of the Edit domain page, and the
DNS diagnostics modal opened from the domain and alias domain lists. Every screen works at 360 px
width, meets WCAG 2.2 AA and is translated into English, Czech and Slovak."

## Clarifications

### Session 2026-10-18

- Q: Should domain administrators get the "ARC/DKIM keys" and "MTA-STS policies" screens, which the
  legacy UI never offered them, or only the DKIM and MTA-STS sections of their domain pages? → A:
  Both. The two screens are offered to domain administrators, limited to their domains and alias
  domains, without unused keys and with generation as their only DKIM change. (agent decision: API
  010 FR-005, FR-009 and FR-038 give domain administrators list access and key generation; a domain
  administrator with many domains needs the "Key missing" filter to find unsigned domains; legacy
  allowed their generation only through `/api/v1`, with no form.)
- Q: How does "Generate keys for all names without a key" work when those names span several pages,
  given that the API generates one name per request? → A: The app collects from the API, page by
  page, every entry in the user's scope with the state "missing" that matches the current search
  and kind filter. The confirmation states their number and the filters that apply, and lists the
  first 10 names with the number of others. The app then generates the keys one name at a time in
  name order, with progress, a result per name and a retry of the failures. (agent decision: legacy
  "Select domains with missing keys" picks every missing name; API 010 FR-013 generates one name per
  request, and creation is never a bulk operation; applying the visible search and filter keeps the
  action predictable; per-name results follow UI feature 002.)
- Q: How strong must the confirmation be before DKIM keys are deleted? → A: For one key, a dialog
  with the impact (FR-038) and a Delete button, without typing the name. For a selection, the dialog
  lists every selected key with its kind and selector, marks the domains and alias domains whose
  mail stops being signed, and keeps Delete disabled until the user ticks an explicit
  acknowledgement. (agent decision: constitution II asks for explicit confirmation that shows what is
  affected; unlike a domain deletion (UI feature 002, typed name), a key deletion removes no mail
  data and is repaired by generating a new key; typing names is impractical on a phone; a bulk
  deletion can silently stop signing for many domains, hence the acknowledgement.) For a selection,
  the plan alignment below replaces the acknowledgement with typing the number of keys.
- Q: How is an exported private key shown, and what happens to it afterwards? → A: After the
  confirmation, in a dialog with the key in a read-only field, a copy action and a download action
  that saves it unchanged as a text file named `<selector>.<ASCII name>.pem`. The key exists in the
  app only while that dialog is open: it is not kept in the app's data cache and is discarded when
  the dialog closes. Seeing it again needs a new confirmed export, which the API records again.
  (agent decision: API 010 FR-026 audits every export; constitution V forbids keeping secrets in
  browser storage; the legacy modal showed text only, and selecting a long key by hand on a phone is
  error-prone, so a download helps move the key to another server.) The plan alignment below adds a
  confirmation before the dialog closes uncopied.
- Q: Is the pasted private key visible in the import form, and how long does the app keep it? → A:
  It is shown as text in a multi-line field, so that the user can check the paste, with spell
  checking, auto-correction and auto-completion off. It is kept after a refused import so that the
  user can correct it, cleared after a successful import, and discarded when the user leaves the form
  after confirming. It is never restored after a reload. (agent decision: masking a multi-line key
  hides paste errors; some browsers send spell-checked text to online services; constitution V
  forbids keeping secrets in browser storage; legacy cached form input in the browser.)
- Q: Which diagnostics statuses count as "needs attention", and how does the optional flag change
  that? → A: Missing and mismatch of a required check, and mismatch of an optional check (for example
  an SPF record that does not authorise the server), need attention. Lookup failed and expected value
  unknown are counted separately as "not verified". A missing optional record is "Not set
  (optional)" and is never counted as a problem. Match and informational are "OK". (agent decision:
  API 010 FR-044 says optional checks report their real status and clients must not treat a missing
  optional record as an error; an existing SPF record that fails for the server harms delivery even
  though SPF is optional; a failed lookup is not a fault of the domain's records.)
- Q: Does a diagnostics run start as soon as its page opens, and what does the user see when they
  return to it? → A: Opening the page starts a run, unless the app already holds a result for that
  name from the current session that is less than 10 minutes old. Such a result is shown with the
  time of its run and "Run again". Results are kept only in the app's memory, never in browser
  storage, and are dropped on sign-out. The app waits up to 45 seconds for a run before it shows a
  timeout error with "Run again". (agent decision: legacy runs on opening the modal; the API allows 10
  runs per minute per user and makes about 30 outbound lookups per run, so a run on every back
  navigation wastes the limit; 10 minutes matches the API's reuse of server facts (API 010 FR-049);
  45 seconds covers the API's 30-second bound plus a slow mobile connection; constitution VII.)
- Q: In which unit is the MTA-STS maximum age entered, and what does the set-up form start with? → A:
  A whole number plus a unit of seconds, minutes, hours, days or weeks; a stored value is shown in
  the largest unit that represents it exactly (86,400 seconds as 1 day, 31,557,600 seconds as 8,766
  hours). The set-up form starts with mode "testing", a maximum age of 1 week, no MX hosts and the
  policy inactive. (agent decision: legacy's bare seconds field makes users type 604800 on a phone
  keypad; RFC 8461 advises starting in testing mode and a maximum age of weeks; API 010 FR-033 and
  legacy create inactive policies unless told otherwise, and activation should be deliberate because
  it needs DNS records and triggers a certificate request.) The plan alignment below pre-fills the
  server host name as the MX host.
- Q: What does the app tell the user after a policy change that renews the policy identifier? → A:
  The success message says that the identifier changed, with the old and new value, and that the
  `_mta-sts.<domain>` TXT record must be updated; the section highlights that record with its copy
  button until the user leaves the page. A change of only the active state, or a change that changes
  nothing, shows no such message. (agent decision: API 010 FR-035; senders fetch a new policy only
  when the TXT record's identifier changes, so a forgotten DNS update silently keeps the old policy
  in force; legacy said nothing.)
- Q: How is a policy activated or deactivated, and does deactivation need confirmation? → A: Besides
  Edit, the section offers "Activate" or "Deactivate" directly. Deactivation asks for confirmation,
  explaining that the policy stops being published, that senders that cached it keep applying it up
  to its maximum age, and that the certificate for its `mta-sts.` names is no longer requested.
  Activation needs no confirmation and shows the DNS and certificate notice of FR-051. Both send only
  the active state with the version tag. (agent decision: API 010 FR-037 offers no deletion, so
  deactivation is the way to withdraw a policy and is destructive in effect; constitution II.)

### Plan alignment 2026-10-18

The plan pins the merged API 010 contract (mailcow-rest-v2 commit `3207925`). That contract closes
several gaps this spec listed, and `docs/conventions.md` decides points that the spec settled
differently. These consistency changes are applied to the requirements below.

- **Bulk deletion**: deleting a selection uses the API's bulk operation (API 010 FR-059). It sends
  up to 100 keys with their version tags and gets one result per key: done, not found, refused,
  outdated, failed, or "outcome unknown" after a dropped connection (FR-040, FR-041, FR-092).
  Generation and copy still send one request per name or target, because creation is never a bulk
  operation. They use the same run rules as the other features' "one request per entry" (UI 004):
  a failure that concerns one name is recorded and the run continues, and a failure that would
  affect every remaining name stops it (FR-041).
- **Bulk deletion confirmation**: the dialog asks for the number of keys to be typed instead of an
  acknowledgement checkbox, as `docs/conventions.md` "Confirmations" requires (FR-038, US5 AS-7).
  It still lists every key and marks the names whose mail stops being signed.
- **Key replacement**: API 010 FR-013 now lets administrators generate with overwrite, atomically.
  Administrators get "Replace with a new key" on entries with a key, including incomplete keys
  (FR-090). Gap 4 is closed.
- **Diagnostics labels and messages**: every check carries a stable identifier, and every reason,
  note and guidance item a code with parameters (API 010 FR-044). The app translates them, and it
  falls back to a generic label only for identifiers or codes added after the pinned contract
  (FR-059, FR-071). Gap 1 is closed.
- **Publication failure reason**: a stable code plus optional technical detail (API 010 FR-030).
  The code is translated, and the detail is shown as plain technical text (FR-044). Gap 3 is
  closed.
- **MTA-STS set-up**: the capabilities read returns the server host name (API 010 FR-012). The
  set-up form pre-fills it as the only MX host (FR-047, US4 AS-2). Gap 5 is closed.
- **Rate limit**: every diagnostics response carries `RateLimit-*` headers (API 010 FR-049). The
  page shows the runs left and disables "Run again" while none are left (FR-091). Gap 6 is closed.
- **Export dialog**: closing without copying or downloading the key asks for confirmation, as
  `docs/conventions.md` "Secrets" requires (FR-077).

## Glossary

- **Name**: a domain, an alias domain, or the name under which a key without a domain is stored.
  Shown in readable (Unicode) form, with the ASCII form below it when the two differ.
- **DKIM entry**: one name with its key state and, when it has a key, the key's selector, length in
  bits, public key, DNS record and version tag. Entries never contain a private key.
- **Key state**: **valid** (a domain or alias domain has a key), **missing** (a domain or alias
  domain has no key, so its mail is not signed) or **unused** (a key exists for a name that is no
  longer a domain or alias domain). An entry with a key is also **complete** or **incomplete**; an
  incomplete key lacks its public key, selector or private key and is never used for signing.
- **DKIM record**: the DNS TXT record a key needs, with its record name
  (`<selector>._domainkey.<name>`) and its value (`v=DKIM1;k=rsa;t=s;s=email;p=<public key>`), as
  one text and split into pieces of at most 255 characters.
- **DKIM DNS publication**: the FeldHost-only server setting that writes a key's record into the
  name's zone on an ISPConfig DNS server whenever the key changes. Its **outcome** is one of
  published, removed, no record to remove, no DNS zone found, failed or not configured.
- **Private key export**: the administrator-only operation that returns a key's private key. It
  exists only while the operator has enabled it on the server; it is off by default.
- **MTA-STS policy**: a domain's mode (enforce, testing or none), MX hosts, maximum age, active
  state and **policy identifier**, a 14-digit value that changes whenever the policy's content
  changes. Alias domains publish their target domain's policy and never have their own.
- **DNS diagnostics run**: one check of every DNS record a domain or alias domain needs. Each
  **record check** has a status (match, mismatch, missing, lookup failed, informational, expected
  value unknown), an optional flag, the expected value or guidance, every value found and a reason
  where one applies. A run also returns a **zone file**.
- **Summary group**: how the app classifies a record check for the user: **OK**, **Needs
  attention**, **Not verified** or **Optional, not set** (FR-060).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See DKIM keys and copy the DNS records they need (Priority: P1)

An administrator opens "ARC/DKIM keys" on a phone. Each domain, alias domain and key without a
domain appears as a card with its name, what it is (domain, alias domain of which domain, or no
domain), its key state as a text badge, the selector and the key length. The administrator filters
by state to find the names whose mail is not signed, searches by name, sorts and pages through the
list. Opening an entry shows the DNS record to publish: the record name, the host label that many
DNS providers ask for, and the record value, each with its own copy button, and the value split into
255-character pieces for providers that need them.

A domain administrator sees the same screens, limited to the domains they manage and their alias
domains, never keys without a domain. The DKIM state and record of a domain or alias domain also
appear on its page (UI features 002 and 004), as on the legacy Edit domain page.

**Why this priority**: Publishing the right DKIM record is the most frequent DKIM task, and every
other DKIM task starts from this list. It changes nothing, so it is the safest first slice, and the
copy buttons remove the most common cause of broken records on phones: selecting long text by hand.

**Independent Test**: Against a mock API with domains and alias domains with and without keys,
keys of every size, unused keys, an incomplete key and internationalised names, open the list and
several entries as an administrator and as a domain administrator at 360 px and at desktop width.
Use every filter, search, sort and paging option, press every copy button and compare the copied
text with the mock data.

**Acceptance Scenarios**:

1. **Given** 3 domains with keys, 1 domain without a key, 1 alias domain with a key and 1 unused
   key, **When** an administrator opens "ARC/DKIM keys", **Then** 6 entries are shown sorted by
   name, 4 marked "Key valid", 1 "Key missing" and 1 "Key unused", together with the total of 6.
2. **Given** a 360 px wide screen, **When** the list is shown, **Then** each entry is a card, no
   content needs horizontal scrolling, and each card shows the readable name, its kind, the state
   badge with text and icon, the selector and the key length.
3. **Given** a domain with a 2,048-bit key and the selector `dkim`, **When** its entry is opened,
   **Then** the record name `dkim._domainkey.<domain>`, the host label `dkim._domainkey` and the
   value `v=DKIM1;k=rsa;t=s;s=email;p=<public key>` are shown, each with a copy button. **When**
   the user presses the value's copy button, **Then** exactly that value is copied and "Copied" is
   announced.
4. **Given** a record value longer than 255 characters, **When** the user switches to the split
   form, **Then** the pieces are shown as quoted strings separated by spaces, and copying copies
   that form.
5. **Given** the filter "Key missing", **When** it is applied, **Then** only domains and alias
   domains without a key are listed, the filter is shown as active, and the result count is
   announced.
6. **Given** a domain administrator who manages one domain with one alias domain, **When** they
   open "ARC/DKIM keys", **Then** exactly those 2 entries are listed, no "Key unused" filter is
   offered, and opening the address of another domain's entry shows the same "not found" page as for
   a name that does not exist.
7. **Given** an incomplete key, **When** it is listed, **Then** it is marked "Incomplete" with the
   explanation that it is not used for signing.
8. **Given** a search that matches nothing, **When** the list is shown, **Then** a "no matching
   keys" message with an action to clear the search and filters is shown.

---

### User Story 2 - Generate DKIM keys for names without one (Priority: P1)

An administrator filters the list to "Key missing", selects the names, or uses "Generate keys for
all names without a key", keeps the selector the server suggests and the default key size, and
generates the keys. The app reports the result for each name and, for a single name, opens its
entry with the record to copy. A domain administrator does the same for a domain or alias domain
they manage, from the list or from the domain's page.

**Why this priority**: A domain without a key sends unsigned mail, which receivers increasingly
reject. Legacy offers "Select domains with missing keys" for exactly this routine task.

**Independent Test**: Against a mock API, generate keys for one name, for a selection, and for all
missing names, with the default and with a custom selector and each key size, as an administrator
and as a domain administrator. Simulate a name that got a key in the meantime, a validation error
and a temporary failure, and check the values sent, the progress, the per-name results and the
publication outcome.

**Acceptance Scenarios**:

1. **Given** a domain without a key and a server default selector `feldhost`, **When** an
   administrator chooses Generate on its entry, **Then** the selector field shows `feldhost`, the
   key size shows 2048 bits, and the offered sizes are those the server allows.
2. **Given** a confirmed generation for one name, **When** it succeeds, **Then** the entry shows
   "Key valid" with the new record, the success is announced, and the record's copy buttons are
   reachable without further navigation.
3. **Given** 12 selected names without a key, **When** the administrator generates keys, **Then**
   progress is shown, and at the end each name is listed as done or failed with a translated
   reason, with an action to retry only the failed ones.
4. **Given** a selector containing a space, **When** the user tries to generate, **Then** the
   selector field shows a translated error naming the allowed characters before anything is sent.
5. **Given** a name that received a key from someone else in the meantime, **When** generation is
   sent, **Then** its result says that the name already has a key, and its entry shows the existing
   key.
6. **Given** a domain administrator on the page of a domain they manage without a key, **When**
   they generate a key, **Then** the key is created and the DKIM section of the page shows the
   record. **Given** a domain administrator, **When** they look at an entry with a key, **Then** no
   replace, import, copy, delete, export or publish action is offered.
7. **Given** the DKIM DNS publication enabled, **When** a key is generated and the publication
   fails, **Then** the result says that the key was created and signing works, that the DNS record
   was not published, and offers to publish it again (administrators).

---

### User Story 3 - Check a domain's DNS setup (Priority: P1)

An administrator or a domain administrator chooses "Check DNS" for a domain or alias domain, from
the domain list, the alias domain list, the domain or alias domain page or the DKIM entry. The app
shows that the check is running and may take up to 30 seconds. The result shows each record as a
card with its purpose (for example "Mail exchanger" or "DKIM"), the record name and type, a status
badge, the expected value with a copy button and every value found. A summary at the top says how
many records are correct and how many need attention, and a filter shows only those that need
attention. Optional records such as SPF and DMARC are marked optional and are never shown as errors
when they are absent. Administrators also see the server-wide records. The user downloads or copies
the zone file to import at their DNS provider.

**Why this priority**: Wrong DNS is the most common reason why mail from a new domain is rejected
or why mail clients cannot find the server. Domain administrators depend on this check to set up
their own domains.

**Independent Test**: Against a mock API, run diagnostics for results that cover every status,
with and without the optional flag, with partial results after timeouts, for an alias domain, for a
server without IPv6, and with a "too many requests" refusal, as an administrator and as a domain
administrator at 360 px and at desktop width. Compare every value shown, the summary and the
downloaded zone file with the mock data.

**Acceptance Scenarios**:

1. **Given** a domain whose MX record matches, **When** the result is shown, **Then** the MX card
   shows the status "Correct" with an icon and text, the expected host name and the value found.
2. **Given** a domain without an MX record, **When** the result is shown, **Then** the MX card shows
   "Missing" as a problem, and the summary counts it as needing attention.
3. **Given** a domain without a DMARC record, **When** the result is shown, **Then** the DMARC card
   shows "Not set (optional)", is not counted as a problem, and shows the translated guidance.
4. **Given** an SPF record that does not authorise the server's addresses, **When** the result is
   shown, **Then** the SPF card shows "Different value" marked optional and is counted as needing
   attention.
5. **Given** a DKIM record whose public key differs from the stored key, **When** the result is
   shown, **Then** the DKIM card shows "Different value" with the expected value and its copy
   button, and the value found as plain text.
6. **Given** a run in which 3 lookups timed out, **When** the result is shown, **Then** those 3
   cards show "Could not be checked" with the translated reason, a notice says that some records
   could not be checked, and "Run again" is offered.
7. **Given** a user who started 10 runs within the last minute, **When** they start another and the
   API refuses it, **Then** the previous result stays visible, the app says when the next run is
   possible, and "Run again" is unavailable until then.
8. **Given** a domain administrator, **When** they run diagnostics for a domain they manage,
   **Then** no server-wide records are shown. **When** they open the diagnostics address of a
   domain they do not manage, **Then** the same "not found" page as for a name that does not exist
   is shown.
9. **Given** any result, **When** the user chooses "Download zone file", **Then** a text file named
   after the ASCII name is saved whose content equals the zone file the API returned. **When** they
   choose "Copy zone file", **Then** the same text is copied.
10. **Given** a result for a domain from 4 minutes ago, **When** the user opens that domain's DNS
    diagnostics again, **Then** the result is shown with the time of its run and no new run starts
    until the user chooses "Run again". **Given** a result from 12 minutes ago, **When** the page is
    opened, **Then** a new run starts.

---

### User Story 4 - Manage a domain's MTA-STS policy (Priority: P2)

An administrator or domain administrator opens the MTA-STS section of a domain's page. For a domain
without a policy, they set one up: the mode, the MX host names sending servers may deliver to, the
maximum age, and whether the policy is active. Once saved, the section shows the policy, the address
at which it is published, the policy text that senders fetch, and the two DNS records to publish,
each with a copy button. When they later change the mode, the MX hosts or the maximum age, the app
says that the policy identifier changed and that the `_mta-sts` TXT record must be updated. A policy
cannot be deleted; it is deactivated instead. An alias domain's page says that it publishes its
target domain's policy. Administrators and domain administrators also get an overview of all
policies in their scope.

**Why this priority**: MTA-STS protects inbound mail against downgrade attacks, but only some
operators use it, and the rest of the feature works without it.

**Independent Test**: Against a mock API, set up, change, activate and deactivate policies as an
administrator and as a domain administrator at 360 px and at desktop width, with invalid modes,
MX entries and maximum ages, an MX list over 255 characters, an outdated version and an alias
domain, and check the values sent and every message shown.

**Acceptance Scenarios**:

1. **Given** a domain without a policy, **When** the user opens its MTA-STS section, **Then** the
   section says that no policy is set up and offers to set one up.
2. **Given** the set-up form on a server whose host name is `mail.example.org`, **When** it opens,
   **Then** the mode "testing", a maximum age of 1 week, the MX host `mail.example.org` and the
   policy inactive are preset. **When** the user chooses "enforce", adds the MX host
   `mx2.example.org`, enters a maximum age of 1 day, switches the policy on and saves, **Then** the
   policy is created, the section shows version STSv1, the identifier, the address
   `https://mta-sts.<domain>/.well-known/mta-sts.txt`, and the records `_mta-sts.<domain>` TXT and
   `mta-sts.<domain>` with copy buttons.
3. **Given** an existing policy, **When** the user changes only the mode and saves, **Then** the app
   announces that the identifier changed and highlights the `_mta-sts` record to update. **When**
   they change only the active state, **Then** no such notice is shown.
4. **Given** an MX entry `mail..example`, a maximum age of 0 or an MX list over 255 characters,
   **When** the user tries to save, **Then** the field shows a translated error with the rule's
   limit before anything is sent.
5. **Given** two users who opened the same policy, **When** the second saves after the first,
   **Then** the second save is stopped, their input is kept, and the values the first user changed
   are marked with their new saved values.
6. **Given** an alias domain, **When** its page is shown, **Then** its MTA-STS section names the
   target domain whose policy it publishes, links to it and offers no editing.
7. **Given** an active policy, **When** the user chooses "Deactivate", **Then** a confirmation
   explains that the policy will no longer be published and that senders that cached it keep
   applying it up to its maximum age. **When** they confirm, **Then** the section shows the policy
   as inactive with the same identifier.
8. **Given** a stored maximum age of 604,800 seconds, **When** the section or the form shows it,
   **Then** it appears as 1 week.

---

### User Story 5 - Import, copy and delete DKIM keys (Priority: P2)

An administrator migrating a domain from another server imports its existing private key with the
selector already published in DNS, so that the published record keeps working; when the name
already has a key, they explicitly choose to overwrite it. An administrator who wants several
domains to share one key copies it from one entry to other domains or alias domains. An
administrator cleaning up deletes keys left without a domain, one at a time or as a selection. An
administrator rotating a key replaces it with a new one in one step, so that mail stays signed.

**Why this priority**: These tasks are less frequent than generating keys and are
administrator-only.

**Independent Test**: Against a mock API, import valid and invalid keys with and without overwrite,
copy a key to several targets with and without keys, replace keys with new ones, and delete valid
and unused keys, one at a time and in a selection, as an administrator. Simulate conflicts, outdated versions and every validation
rule, and check that a domain administrator is never offered these actions.

**Acceptance Scenarios**:

1. **Given** a domain without a key, **When** an administrator imports a pasted private key with the
   selector `mx2024`, **Then** the entry shows "Key valid" with selector `mx2024` and the record
   derived from the key, and the private key text is removed from the form.
2. **Given** a domain with a key, **When** the administrator imports a key without choosing
   "Overwrite existing DKIM key", **Then** the name field shows a translated "a key already exists"
   error and offers to overwrite. **When** they choose to overwrite, **Then** a confirmation names
   the existing selector and says that the old key is removed completely.
3. **Given** an encrypted private key, **When** it is imported, **Then** the private key field shows
   a translated error saying that encrypted keys are not accepted, and the rest of the input is kept.
4. **Given** a source entry with a key and 3 selected targets, one of which already has a key,
   **When** the administrator copies the key, **Then** the target with a key is marked "has a key"
   and is copied only after the administrator explicitly agrees to overwrite it, and the result lists
   each target as done or failed.
5. **Given** a domain's key, **When** the administrator deletes it, **Then** a confirmation states
   that mail from the domain is no longer signed from the next message and that the published DNS
   record stays until it is removed. **When** confirmed, **Then** the entry shows "Key missing".
6. **Given** an unused key, **When** it is deleted, **Then** it disappears from the list.
7. **Given** a selection of 5 keys, 3 of them belonging to domains, **When** the administrator
   chooses Delete, **Then** the dialog lists all 5 with kind and selector, marks the 3 domains whose
   mail stops being signed, and keeps Delete disabled until the number 5 is typed. **When**
   confirmed, **Then** one request deletes the keys, and each key is listed as deleted or with its
   translated reason; the keys that were not deleted stay selected.
8. **Given** a domain's key, **When** the administrator chooses "Replace with a new key", keeps the
   suggested selector and confirms, **Then** the confirmation has named the old selector and key
   length and said that mail stays signed during the change and that the published DNS record must
   be updated, and the entry shows the new key and record.

---

### User Story 6 - Export a private key when the operator allows it (Priority: P3)

An administrator moving a domain to another server needs its private key. On a server where the
operator has enabled private key export, they choose "Export private key" on the entry, confirm,
and receive the key to copy or download. The key is gone once they close it. On servers where export is disabled, the action is not offered and the
entry says why.

**Why this priority**: It is rarely needed, off by default and exposes a secret.

**Independent Test**: Against a mock API with export enabled and disabled, export keys as an
administrator, check that a domain administrator is never offered the action, and check that the key
appears nowhere in the app's stored state, address or messages after the export view is closed.

**Acceptance Scenarios**:

1. **Given** export enabled, **When** an administrator chooses "Export private key" on an entry,
   **Then** a confirmation explains that the private key lets its holder sign mail for the name and
   that the export is recorded.
2. **Given** a confirmed export, **When** it succeeds, **Then** the key is shown exactly as returned
   with a copy action and a download action. **When** the dialog is closed and opened again from the
   entry, **Then** the key is not shown until a new export is confirmed.
3. **Given** export disabled, **When** an administrator opens an entry, **Then** no export action is
   offered and the entry states that private key export is turned off on this server.
4. **Given** export disabled on the server after the entry was loaded, **When** the administrator
   tries to export, **Then** the app shows the translated "private key export disabled" message and
   removes the action.

---

### User Story 7 - Keep the ISPConfig DNS zone in sync with DKIM keys (Priority: P3)

On the FeldHost deployment, the operator has enabled the DKIM DNS publication. After every key
generation, import or copy, the app tells the administrator whether the record was published, no
DNS zone was found for the name, or the publication failed. After a failure, for example while
ISPConfig was unreachable, the administrator chooses "Publish DNS record again" on the entry.

**Why this priority**: It is fork-only, off by default, and DKIM works without it.

**Independent Test**: Against a mock API with the publication enabled and disabled, generate,
import, copy and republish keys with every publication outcome, and check every message and action.

**Acceptance Scenarios**:

1. **Given** the publication enabled, **When** a key is generated and the outcome is "published",
   **Then** the result says that the record was published to the DNS zone.
2. **Given** the outcome "no DNS zone found", **When** it is shown, **Then** the app says that the
   record must be published manually and shows the record to copy.
3. **Given** an entry with a key, **When** the administrator chooses "Publish DNS record again" and
   the outcome is "published", **Then** the success is announced.
4. **Given** the publication disabled, **When** any key change succeeds, **Then** no publication
   outcome and no "Publish DNS record again" action are shown.

---

### User Story 8 - Trace DKIM and MTA-STS changes (Priority: P3)

An administrator investigating why a domain's mail fails DKIM checks opens the history of its DKIM
entry or MTA-STS policy and sees every key generation, import, copy, deletion, export and
publication outcome, and every policy change: who made it, when, from where and what changed.

**Why this priority**: Useful for support, but keys and policies can be managed without it.

**Independent Test**: Against a mock API with audit records for every DKIM and MTA-STS operation,
including refusals, open the history of an entry and of a policy as an administrator, and check that
a domain administrator is never offered it.

**Acceptance Scenarios**:

1. **Given** a key imported with overwrite, **When** an administrator opens the entry's history,
   **Then** the record shows the actor, the time, the client address, the old and new selector and
   key length and the publication outcome, and never any private key.
2. **Given** a policy whose mode a domain administrator changed, **When** an administrator opens the
   policy's history, **Then** the record shows the old and new mode and the old and new identifier.
3. **Given** a domain administrator, **When** they open an entry or a policy, **Then** no history
   action is offered.

---

### Edge Cases

- **Internationalised and long names**: the readable name is shown first and the ASCII name below
  it when they differ. Names of up to 253 characters and record values of several hundred characters
  wrap instead of causing horizontal scrolling.
- **Unused key stored under a non-standard name** (upper case or Unicode, written by legacy): it is
  listed under its exact stored name with the explanation that it is never used for signing, and it
  can be inspected, copied from and deleted.
- **Incomplete key**: marked "Incomplete", explained as not used for signing. Administrators can
  delete it, replace it with a new key (FR-090) or replace it by an import with overwrite. Plain
  generation is not offered for it, because the name counts as having a key.
- **Entry changed or removed while it is open**, in this app, the legacy UI or through the API: a
  "not found" answer says the key or name no longer exists and offers the way back to the list; an
  outdated answer shows the latest data and asks for confirmation again.
- **Name taken out of a domain administrator's scope while it is open**: the next request returns
  "not found", handled as above.
- **Domain deleted while its key stays**: the entry turns "Key unused" (administrators) or
  disappears (domain administrators).
- **Inactive domain**: keys can still be generated and diagnostics still runs; the entry and the
  result do not mark the domain as inactive, because the API does not report it there.
- **Generation for many names** (for example 500 missing keys after a migration): one request per
  name, with progress and a final result per name. Leaving the page during the run warns that the
  remaining names will not be processed.
- **Name already has a key when generation is sent** (concurrent change): reported as "already has a
  key" in its result; the entry is refreshed.
- **Copy target removed before the copy is sent**: its result is "not found".
- **Copy to the source itself**: the source is not offered as a target.
- **Private key text with Windows line endings or surrounding blank lines**: accepted as pasted; the
  API normalises it.
- **Private key text over 16 KiB**, for example a pasted certificate chain: refused before sending
  with the size limit.
- **Private key export turned off, or the DKIM DNS publication turned off, between loading and
  acting**: the translated error is shown and the action disappears after the configuration is read
  again.
- **Export dialog closed by mistake**: the key is gone; seeing it again needs a new confirmed export,
  which the API records again.
- **Bulk deletion that includes valid keys**: the confirmation marks every domain and alias domain
  whose mail stops being signed, and Delete stays disabled until the number of keys is typed.
- **Publication outcome "failed"** after a single deletion: the deletion responds without an
  outcome, so the app cannot report it; the confirmation states where the outcome can be found
  (history, administrators). A bulk deletion reports each key's removal outcome.
- **Bulk deletion with a key changed in the meantime**: that key's result is "outdated", it stays
  selected, and the list is reloaded so that a retry uses its new version.
- **Connection dropped during a bulk deletion**: every key is reported as "outcome unknown", and
  nothing is sent again automatically.
- **Clipboard unavailable or denied**: the copy button selects the full value in place and says that
  it could not be copied automatically, so that the user can copy it with the system's own action.
- **MTA-STS MX entries in another letter case, with a trailing dot, or duplicated**: duplicates that
  differ only in letter case are kept once with the first spelling; the saved list shows the values
  as the API returned them.
- **MTA-STS change that changes nothing**: accepted; no "identifier changed" notice is shown.
- **MTA-STS policy changed twice within one second**: the identifier still changes; the app shows
  whatever identifier the API returns.
- **Alias domain name in an MTA-STS address**: the app shows that alias domains have no policy of
  their own and links to the target domain.
- **Diagnostics for an alias domain**: the result names the target domain and explains that the
  MTA-STS checks use the target domain's policy.
- **Server without IPv6**: the IPv6 checks are absent and the server facts show "no public IPv6
  address".
- **Public address, certificate or key cannot be determined**: the affected checks show "Cannot be
  verified" with the translated reason; they are not counted as problems of the domain.
- **Server host name published as an alias**: the address check shows "Different value" with the
  reason.
- **Address records instead of an alias** for autodiscover, autoconfig or MTA-STS names: the check
  shows "Correct" with a note that the value was derived from address records.
- **Values found that contain markup or control characters** (DNS content is controlled by third
  parties): shown as plain text only, never interpreted.
- **Several values found for one check**: all are listed; an empty list is shown as "No record
  found".
- **Diagnostics result arriving after the user moved to another name**: it is not shown for the
  other name, but it is kept for its own name as FR-058 allows.
- **Returning to diagnostics after fixing a record at the DNS provider**: a result under 10 minutes
  old is shown with the time of its run; the user chooses "Run again" to see the change.
- **No result after 45 seconds** (slow connection): a timeout error with "Run again"; a previous
  result for the same name stays visible.
- **Diagnostics request that fails as a whole** (network error, server error): the app shows a
  translated error with "Run again"; a previous result for the same name stays visible.
- **Temporary failure** reported by the API: the app says nothing was changed and offers a retry that
  keeps the input.
- **Session expiry or sign-out in another tab while a form is open**: handled by UI feature 001.
- **Mailbox users** who open an address of this feature: the shell of UI feature 001 shows that the
  page is not available for their role.
- **Very large installations** (5,000 domains and 5,000 alias domains): only one page of entries is
  loaded at a time, and search, filters and sorting are applied by the API.

## Requirements *(mandatory)*

### Functional Requirements

#### Access and navigation

- **FR-001**: The app MUST offer the screens of this feature to administrators and domain
  administrators: an "ARC/DKIM keys" navigation entry, an "MTA-STS policies" navigation entry, the
  DKIM, MTA-STS and DNS parts of the domain and alias domain pages, and "Check DNS" actions. Mailbox
  users MUST NOT be offered any screen or action of this feature.
- **FR-002**: The app MUST offer exactly the actions that the user's role allows, as reported by the
  API's identity (UI feature 001), and the actions that the server's DKIM configuration enables:

  | Action | Administrator | Domain administrator |
  |---|---|---|
  | List, search, filter, sort and inspect DKIM entries | All names, including unused keys | Own domains and their alias domains |
  | Copy record names and values to the clipboard | Yes | Yes |
  | Generate a key | Any domain or alias domain without a key | Own domains and alias domains without a key |
  | Import, copy or delete a key, delete a selection of keys | Yes | Not offered |
  | Replace a key with a new one (FR-090) | Yes | Not offered |
  | Export a private key | Only while export is enabled on the server | Not offered |
  | Publish a DNS record again | Only while the DKIM DNS publication is enabled | Not offered |
  | Read, list, set up and change MTA-STS policies | All domains | Own domains |
  | Run DNS diagnostics | All domains and alias domains, with server-wide records | Own domains and their alias domains, without server-wide records |
  | DKIM and MTA-STS history | Yes | Not offered |

  No domain administrator permission flag gates any action of this feature.
- **FR-003**: When the API refuses an action as forbidden, the app MUST show the translated reason,
  refresh the identity and the DKIM configuration, and update which actions it offers, without
  discarding the user's other unsaved input.
- **FR-004**: The DKIM key list, each DKIM entry, the MTA-STS policy list and the DNS diagnostics of
  each name MUST have their own address that can be bookmarked, reloaded and shared. Opening the
  address of a name that does not exist or lies outside the user's scope MUST show one and the same
  "not found" page with a way back.

#### DKIM key list

- **FR-005**: The list MUST show the entries in the user's scope, page by page, with a choice of 25
  (default), 50 or 100 per page. It MUST show the total number of matching entries and let the user
  move to the first, previous, next and last page and see the current page number.
- **FR-006**: Each entry MUST show:
  - the readable name, and the ASCII name below it when the two differ;
  - its kind: "Domain", "Alias domain of <target domain>" or "No domain";
  - its key state as a badge with text and icon: "Key valid", "Key missing" or "Key unused";
  - when it has a key: the selector, the key length in bits, and an "Incomplete" marker for an
    incomplete key.
- **FR-007**: On wide screens the list MUST be a table with columns for the values of FR-006. On
  small screens it MUST be a list of cards with the same values.
- **FR-008**: The list MUST offer one search field that finds entries by ASCII or readable name
  (case-insensitive substring, as the API defines). Results MUST update without pressing a button
  once the user pauses typing, and the search MUST be clearable with one action.
- **FR-009**: The list MUST offer these filters: key state (one or more of valid, missing and,
  for administrators, unused), kind (domain, alias domain, and for administrators no domain), and
  completeness (complete, incomplete). Selecting the selector shown on an entry MUST add that
  selector as a filter. The number of active filters MUST be visible on the filter control, and one
  action MUST clear all filters.
- **FR-010**: The list MUST be sortable, ascending or descending, by name, state, selector and key
  length, with name ascending as the default. Wide screens MUST offer sorting through the column
  headers and a sort control; small screens MUST offer the sort control.
- **FR-011**: The search, filters, sort, page and page size MUST be kept in the page address, so
  that reloading, going back from an entry and opening a shared link restore the same view. They
  MUST NOT be kept in browser storage. Changing the search, a filter, the sort or the page size MUST
  return to the first page.
- **FR-012**: The list MUST be openable filtered to one domain together with its alias domains, so
  that the domain page can link to "DKIM keys of this domain and its alias domains".
- **FR-013**: The list MUST offer a refresh action. Returning to the list from an entry MUST show
  the previous results and scroll position at once, without a loading state.
- **FR-014**: The list MUST define these states:
  - loading: placeholders in the shape of the list;
  - no entries at all: for administrators, an explanation that keys belong to domains and alias
    domains, with a link to the domain list; for domain administrators, a message that no domain is
    assigned to them;
  - no matching entries: a message and an action that clears the search and filters;
  - error: a translated message and a retry action. When a refresh fails, the results shown before
    MUST stay visible with an error notice.
- **FR-015**: Administrators MUST see, on the DKIM key list, the server's DKIM settings read-only:
  the default selector, the default key size, whether private key export is enabled and whether the
  DKIM DNS publication is enabled.

#### DKIM entry and its DNS record

- **FR-016**: Each entry MUST have its own page that shows the values of FR-006 and, when the entry
  has a key:
  - the record name `<selector>._domainkey.<name>` and the host label `<selector>._domainkey`;
  - the record value as one text;
  - the record value split into pieces of at most 255 characters, shown as quoted strings separated
    by spaces, as returned by the API;
  - whether the key is complete, and for an incomplete key the explanation that it is not used for
    signing and how to repair it.

  For a name without a key, the page MUST say that mail from the name is not signed and offer
  generation (FR-024).
- **FR-017**: The record name, the host label, the value and the split value MUST each have a copy
  button that copies exactly the shown text. The value MUST be shown in one form at a time, with a
  control that switches between the single and the split form; the copy button copies the form shown.
- **FR-018**: Record values, public keys and selectors MUST be shown in a fixed-width font, MUST
  wrap at any character on small screens, and MUST NOT need horizontal scrolling.
- **FR-019**: The entry page MUST offer the actions of FR-002 that apply to it: generate (entry
  without a key), replace with a new key, import with overwrite, copy, delete, export, publish again
  and history (administrators, entry with a key), and "Check DNS" (domains and alias domains, not unused keys).
- **FR-020**: The entry page MUST define a loading state, the "not found" page of FR-004 and an error
  state with a retry action.

#### Domain and alias domain pages

- **FR-021**: The page of a domain (UI feature 002) and of an alias domain (UI feature 004) MUST show
  a DKIM section with the key state, the selector, the key length, the record name and value with the
  copy buttons of FR-017, a way to the DKIM entry, and, when the name has no key, the generation
  action. The domain page MUST also link to the DKIM key list filtered to the domain and its alias
  domains (FR-012).
- **FR-022**: The domain page MUST show the MTA-STS section of FR-046. The alias domain page MUST
  show an MTA-STS section that names the target domain whose policy it publishes, links to it and
  offers no editing.
- **FR-023**: The domain list (UI feature 002), the alias domain list (UI feature 004), and the
  domain and alias domain pages MUST offer a "Check DNS" action that opens the DNS diagnostics of
  that name.

#### Generating keys

- **FR-024**: Users MUST be able to generate a key for a single name from its entry, from the DKIM
  section of its domain or alias domain page, and for several names from a selection in the list
  (FR-040). The list MUST also offer "Generate keys for all names without a key". It MUST collect
  from the API, page by page, every entry in the user's scope with the state "missing" that matches
  the current search and kind filter, and ask for confirmation, stating their number and the filters
  that apply and listing the first 10 names with the number of others. It MUST then generate the
  keys one name at a time in name order, as in FR-041.
- **FR-025**: The generation form MUST offer:
  - the names it applies to, shown read-only;
  - a selector, pre-filled with the server's default selector from the DKIM configuration;
  - a key size, offering the allowed sizes from the DKIM configuration, with the default size
    preselected.

  Before sending, the app MUST check that the selector is not empty, has at most 255 characters and
  contains only letters, digits, `-`, `_` and `.`.
- **FR-026**: While a generation is being sent, the action MUST show progress and MUST NOT accept a
  second submission.
- **FR-027**: After a successful generation of one name, the app MUST show its entry with the new
  record and announce the success. When the DKIM DNS publication is enabled, the publication outcome
  of FR-044 MUST be shown with it.
- **FR-028**: A name that has a key, whether complete or not, MUST NOT be offered for generation;
  administrators get "Replace with a new key" instead (FR-090). A refusal because the name already
  has a key MUST be reported as such, and the entry refreshed.
- **FR-090**: Administrators MUST be able to replace the key of an entry that has a key, whether
  complete or not, with a newly generated key in one step, from the entry page. The form MUST
  offer the selector and the key size as in FR-025. It MUST recommend a selector different from
  the current one, so that the old and new records can be published side by side. Before sending,
  a confirmation MUST:
  - name the current selector and key length;
  - state that the old key, including its private key, is replaced in one step, so that mail stays
    signed;
  - state that the published DNS record must be updated with the new value, unless the DKIM DNS
    publication is enabled.

  The replacement MUST be sent with the entry's version tag. When the API refuses it as outdated,
  the app MUST show the confirmation again with fresh data. After success, the entry MUST show the
  new key and record, and the publication outcome when the publication is enabled.

#### Importing a key

- **FR-029**: Administrators MUST be able to import a key from the DKIM key list (for any name) and
  from an entry (for that name). The form MUST offer:
  - the name, accepted in readable or ASCII form in any letter case, without auto-capitalisation or
    auto-correction, checked before sending against the domain name syntax (labels of letters,
    digits and inner hyphens, at most 253 characters, at most 63 per label); it MAY be a name that is
    not a domain or alias domain, and the form MUST say that such a key is listed as unused until the
    domain or alias domain is created;
  - a selector, pre-filled with the server's default selector and checked as in FR-025;
  - the private key text in a multi-line field that shows it as text, accepted by pasting or by
    choosing a local file, explained as one unencrypted RSA private key in PEM form (PKCS #1 or
    PKCS #8) of 1,024 to 8,192 bits, and refused before sending when empty or larger than 16 KiB;
  - "Overwrite existing DKIM key", off by default.
- **FR-030**: When the name has a key and overwrite is on, the app MUST ask for confirmation before
  sending, naming the existing selector and key length, stating that the old key, including its
  private key, is removed completely, and that the published DNS record must be updated with the new
  value unless the DKIM DNS publication is enabled. When the app knows the entry, the import MUST be
  sent with its version tag.
- **FR-031**: When the API refuses the import because the name already has a key, the name field
  MUST show the translated error and offer to switch overwrite on, keeping every other value.
- **FR-032**: When the API refuses the private key, the private key field MUST show the translated
  rule: not a private key, encrypted, not RSA, too short, too long or too large. The app MUST NOT
  show any part of the key text in a message.
- **FR-033**: After a successful import, the app MUST clear the private key text, show the entry with
  its new record, announce whether a key was created or replaced, and show the publication outcome
  when the DKIM DNS publication is enabled. After a refused import, the private key text MUST be
  kept so that the user can correct it. Leaving the import form with entered values MUST ask for
  confirmation and then discard the private key text; the text MUST NOT be restored after a reload.

#### Copying a key

- **FR-034**: Administrators MUST be able to copy the key of an entry that has a key, whether valid or
  unused, to one or more targets. Targets MUST be chosen from the domains and alias domains in a
  searchable picker that loads them page by page from the API and never offers the source itself.
- **FR-035**: The picker MUST mark each target that already has a key, with its selector. A target
  with a key MUST be copied only after the administrator explicitly agrees to overwrite it, and the
  confirmation MUST state that its old key, including its private key, is removed completely. A
  target that has a key MUST be sent with its version tag.
- **FR-036**: The copy MUST be sent as one request per target, as in FR-041, and MUST end with a
  result per target that includes its publication outcome when the DKIM DNS publication is enabled.

#### Deleting keys

- **FR-037**: Administrators MUST be able to delete the key of an entry with a key from its page and
  from a selection in the list (FR-040).
- **FR-038**: Before deleting, the app MUST show a confirmation with the impact:
  - the readable and ASCII name, its kind, selector and key length;
  - for a domain or alias domain: that its mail is no longer signed from the next message, and that
    its entry will show "Key missing";
  - that the private key is deleted permanently and cannot be recovered;
  - when the DKIM DNS publication is disabled: that the published DNS record stays until it is
    removed at the DNS provider; when it is enabled: that the record is removed from the DNS zone and
    that the outcome is recorded in the history.

  For one key, the confirmation MUST be a dialog with this impact and a Delete button; the user MUST
  NOT have to type the name. For a selection, the dialog MUST list every selected key with its kind
  and selector, mark the domains and alias domains whose mail stops being signed, list the selected
  entries without a key as skipped, and keep Delete disabled until the user types the number of keys
  to be deleted (`docs/conventions.md`).
- **FR-039**: The deletion MUST be sent with the entry's version tag. When the API refuses it as
  outdated, the app MUST show the impact again with fresh data. When the key no longer exists, the app
  MUST say so and refresh the entry. After a successful deletion, the app MUST announce it and show
  the entry as "Key missing", or, for an unused key, return to the list without it.

#### Acting on several names

- **FR-040**: Users MUST be able to select entries in the list, one by one or all on the current
  page, and to apply an action to the selection: generate (entries without a key) for both roles,
  and delete (entries with a key) for administrators. On small screens selection MUST be reachable
  through a selection mode that shows a checkbox on every card and an action bar that names the
  number of selected entries. Entries the action does not apply to MUST be listed as skipped.
  Generating keys for a selection MUST open the generation form of FR-025 for the selected names;
  deleting a selection MUST be confirmed as FR-038 requires for a selection and sent as FR-092
  describes. The selection MUST be cleared when the page, search, filters, sort or page size change.
- **FR-041**: Generation and copy create one key per request, because creation is never a bulk
  operation. For them, the app MUST send one request per name or target, show progress, and finish
  with a result for every name: done, already has a key, failed with a translated reason, outcome
  unknown (the connection dropped while it was sent) or not processed. It MUST continue after a
  failure that concerns only that name (it already has a key, it no longer exists, its name is
  refused). It MUST stop at a failure that would affect every remaining name (no permission,
  temporary failure, invalid selector or key size, dropped connection), and leave the remaining
  names not processed. It MUST offer to retry the failed, unknown and unprocessed names only, and
  MUST NOT retry anything automatically.
- **FR-092**: Deleting a selection MUST be sent as one bulk request of the API with every selected
  key and its version tag as listed (at most 100, which one page never exceeds). The app MUST show
  one result per key: deleted, not found, refused, outdated or failed, each with its translated
  reason, and, while the DKIM DNS publication is enabled, the removal outcome of each deleted key's
  record. Keys that were refused, outdated or failed MUST stay selected, and the list MUST be
  reloaded so that a retry uses the current version tags. When the connection drops, every key
  MUST be reported as "outcome unknown", and nothing MUST be sent again automatically.
- **FR-042**: Leaving the page while a run on several names is in progress MUST warn that the
  remaining names will not be processed.

#### DKIM DNS publication

- **FR-043**: The app MUST read from the DKIM configuration whether the DKIM DNS publication is
  enabled. While it is disabled, the app MUST NOT show publication outcomes or the "Publish DNS
  record again" action.
- **FR-044**: While it is enabled, every generation, import and copy result MUST show its publication
  outcome translated: "published to the DNS zone", "no DNS zone found for this name" with the advice
  to publish the record manually, and "failed" with the advice that the key works and the record can
  be published again. The reason of "failed" MUST be translated from its code (ISPConfig
  unreachable, timed out, sign-in refused, remote error, unexpected answer, old selector's record
  not removed). An unknown code MUST be shown as a generic failure. The technical detail that may
  come with it MUST be shown as plain text, marked as English.
- **FR-045**: Administrators MUST be able to publish the record of an entry with a key again, from
  the entry page and from a "failed" outcome. The app MUST show the outcome. When the API refuses it
  because the publication is not enabled, the app MUST say so and remove the action.

#### MTA-STS policy of a domain

- **FR-046**: The MTA-STS section of a domain page MUST show, for a domain with a policy: the active
  state as a text badge, the version, the mode, the MX hosts, the maximum age in the largest unit
  that represents it exactly (as in FR-047), the policy identifier, the address at which the policy is
  published, the policy text that is served, and the DNS records it needs (`_mta-sts.<domain>` TXT
  `v=STSv1;id=<identifier>;` and `mta-sts.<domain>` pointing to the server's host name), each record
  name and value with a copy button. For a domain without a policy, it MUST say that none is set up,
  explain MTA-STS in a sentence, and offer to set one up.
- **FR-047**: Setting up and changing a policy MUST happen in a section form as on the domain page
  of UI feature 002: full-screen on small screens, in place on wide screens. The form MUST offer:
  - the version, shown as the fixed text STSv1;
  - the mode as a choice of enforce, testing and none, each with its explanation visible next to it;
  - the MX hosts as a list of entries, added by typing and confirming with Enter, a comma or an add
    button and removed with their own labelled remove button;
  - the maximum age as a whole number plus a unit of seconds, minutes, hours, days or weeks; a stored
    value MUST be shown in the largest unit that represents it exactly (86,400 seconds as 1 day,
    31,557,600 seconds as 8,766 hours);
  - the active state as a switch, with the explanation that an inactive policy is not published and
    no certificate is requested for its `mta-sts.` name.

  The set-up form MUST start with mode "testing", a maximum age of 1 week, the server's host name
  from the capabilities read as the only MX host, and the policy inactive.
- **FR-048**: Before sending, the app MUST check: at least one MX host; each entry is a host name of
  labels of letters, digits and inner hyphens, optionally starting with `*.`, of at most 253
  characters; duplicates that differ only in letter case are kept once; the entries joined by commas
  do not exceed 255 characters, with the used length shown once 90 % of the limit is reached; the
  maximum age is a whole number in its unit and comes to 1 to 31,557,600 seconds.
- **FR-049**: A change MUST send only the changed values with the policy's version tag. When the API
  refuses it as outdated, the app MUST keep the user's unsaved values, load the latest saved policy,
  mark every value that changed in the meantime with its new saved value, and let the user save
  again or discard their changes, as UI feature 002 does.
- **FR-050**: After a successful save, the app MUST announce the success and show the policy as the
  API returned it. When the save renewed the policy identifier, the success message MUST say that the
  identifier changed, with the old and new value, and that the `_mta-sts.<domain>` TXT record must be
  updated, and the section MUST highlight that record with its copy button until the user leaves the
  page. A save that changed only the active state, or nothing, MUST NOT show this message.
- **FR-051**: The app MUST explain, next to the set-up form and on activation, that mailcow requests
  the certificate for `mta-sts.<domain>` and the `mta-sts.` names of its alias domains at the
  certificate service's next run, which can take up to one day, and that the two DNS records must be
  published.
- **FR-052**: Policies MUST NOT be offered for deletion. The section MUST explain that a policy is
  deactivated instead and is removed together with its domain. Besides Edit, the section MUST offer
  "Activate" or "Deactivate" directly, each sending only the active state with the version tag.
  Deactivation MUST ask for confirmation, explaining that the policy stops being published, that
  senders that cached it keep applying it up to its maximum age, and that the certificate for its
  `mta-sts.` names is no longer requested. Activation MUST NOT ask for confirmation and MUST show the
  notice of FR-051.
- **FR-053**: Leaving the form with unsaved changes MUST ask for confirmation. The section MUST define
  loading and error states.

#### MTA-STS policy list

- **FR-054**: The "MTA-STS policies" screen MUST list the policies of the domains in the user's scope
  page by page as in FR-005, with the total, a search on the domain, filters by active state and
  mode, and sorting by domain, mode, maximum age and policy identifier (default: domain, ascending),
  kept in the page address as in FR-011.
- **FR-055**: Each entry MUST show the readable and ASCII domain, the active state as a text badge,
  the mode, the MX hosts, the maximum age and the policy identifier; wide screens MUST show a table
  and small screens cards. Opening an entry MUST open the domain page at its MTA-STS section.
- **FR-056**: The list MUST define loading, no-policies, no-matches and error states as in FR-014.
  The no-policies state MUST explain that policies are set up from a domain's page and link to the
  domain list.

#### DNS diagnostics

- **FR-057**: The DNS diagnostics of a name MUST be shown on its own page, not in a dialog. The page
  MUST show the name in readable and ASCII form, for an alias domain its target domain, and the
  legacy notice that DNS changes can take up to 24 hours to show.
- **FR-058**: Opening the page MUST start a run, unless the app already holds a result for that name
  from the current session that is less than 10 minutes old; such a result MUST be shown with the
  time of its run and "Run again". Results MUST be kept only in the app's memory, never in browser
  storage, and MUST be dropped on sign-out. While a run is in progress, the page MUST show progress
  and say that the check can take up to 30 seconds, and MUST NOT start a second run. When no result
  has arrived after 45 seconds, the app MUST show a timeout error with "Run again".
- **FR-059**: The result MUST show every record check returned by the API, in the API's order,
  grouped into server-wide records (administrators) and the name's records. Each check MUST show:
  - its purpose as a translated label derived from the check's identifier, for example "Mail
    exchanger", "Autodiscover", "SPF", "DMARC", "DKIM (selector dkim)", "MTA-STS record" or "IMAPS
    service"; an identifier unknown to the app is labelled by its record type;
  - the record name and type;
  - a status badge with text and icon;
  - an "Optional" marker when the check is optional;
  - the expected value, or the translated guidance for checks without an exact expected value;
  - every value found, or "No record found";
  - the translated reason and note where one applies, for example that a value was derived from
    address records. A reason, note or guidance code unknown to the app is shown as a translated
    "further detail" label followed by the API's English text as plain text, marked as English.
- **FR-060**: The status MUST be shown with these labels, and each check MUST fall into exactly one
  summary group:

  | API status | Label | Required check | Optional check |
  |---|---|---|---|
  | match | "Correct" | OK | OK |
  | informational | "Found (informational)" | OK | OK |
  | mismatch | "Different value" | Needs attention | Needs attention |
  | missing | "Missing", or "Not set (optional)" for an optional check | Needs attention | Optional, not set |
  | lookup failed | "Could not be checked" | Not verified | Not verified |
  | expected value unknown | "Cannot be verified" | Not verified | Not verified |

  "Needs attention" MUST be marked as a problem, "Not verified" as a warning, and "OK" and
  "Optional, not set" as neutral or positive information. A missing optional record MUST NEVER be
  marked as a problem.
- **FR-061**: The record name and the expected value of every check MUST have copy buttons. Values
  found MUST be shown as plain text only.
- **FR-062**: A summary at the top of the result MUST state the number of checks in each summary
  group of FR-060. A filter MUST show only the checks in the groups "Needs attention" and "Not
  verified". When no check needs attention, the summary MUST say that all required records are
  correct, and still state the number of checks that were not verified.
- **FR-063**: The SPF check MUST show the server's public IPv4 address, and IPv6 address when the
  server has one, as the addresses to allow, and the suggested SPF record when the server configures
  one, each with a copy button.
- **FR-064**: The result MUST show the server facts the run used: the server host name, the public
  IPv4 address, the public IPv6 address or "no public IPv6 address", and the time of the run in the
  user's time zone.
- **FR-065**: When any check reports "lookup failed", the result MUST show a notice that some
  records could not be checked and offer "Run again".
- **FR-066**: The page MUST offer "Run again". When the API refuses a run as too many requests, the
  app MUST keep the previous result visible, say when the next run is possible from the API's retry
  hint, and keep "Run again" unavailable until then.
- **FR-091**: After every run and every refusal, the app MUST take the runs left in the current
  window and the time until it resets from the API's rate-limit headers. When 3 or fewer runs are
  left, the page MUST say how many. When none are left, "Run again" MUST be unavailable until the
  window resets, with the time shown, so that the user is not refused. These values MUST be kept
  only in the app's memory and dropped on sign-out.
- **FR-067**: The page MUST offer "Download zone file", which saves the zone file of the result
  unchanged as a text file named after the ASCII name with the extension `.txt`, and "Copy zone file".
  The zone file MUST also be viewable on the page in a section that is collapsed by default.
- **FR-068**: On wide screens the result MUST be a table with the columns name, type, expected value,
  values found and status. On small screens each check MUST be a card with the same values.
- **FR-069**: The page MUST define the in-progress state of FR-058, the "not found" page of FR-004
  and an error state with a translated message and "Run again".

#### History

- **FR-070**: Administrators MUST be able to open the history of a DKIM entry from its page and of
  an MTA-STS policy from the domain's MTA-STS section. The History action MUST open the audit log
  screen of UI feature 001 filtered to that target. That screen MUST gain the target types "DKIM key"
  and "MTA-STS policy". Each entry MUST show the time, the actor, the client address, the operation,
  the outcome including refusals with their translated reason, and, for key changes, the old and new
  selector and key length, the source of a copy, whether an overwrite was requested and the
  publication outcome; for policy changes, each changed value with its old and new value and the old
  and new identifier. Until the contract documents these detail fields (see "API Dependency", gap
  7), they are shown as the API records them, as text, without translated labels.

#### Errors and feedback

- **FR-071**: Every API error MUST be shown as a translated message built from the error code and the
  validation rule codes the API returns, never as the API's English text. This feature MUST translate
  at least: DKIM key already exists, MTA-STS policy already exists, private key export disabled, DNS
  publication not enabled, outdated version, too many requests, temporary failure, not found,
  forbidden, the validation rules of the selector, key size, import name, private key, copy
  target, bulk targets and MTA-STS fields with their parameters, the bulk outcomes, the DKIM DNS
  publication statuses and reason codes, and the DNS diagnostics statuses, check identifiers and
  message codes. Unknown rule codes MUST be shown as a generic invalid value of that field.
- **FR-072**: Forms MUST show field errors next to their field and in an error summary at the top
  whose entries lead to the fields.
- **FR-073**: When the API reports a temporary failure, the app MUST say that nothing was changed and
  offer a retry that keeps the input.
- **FR-074**: The outcome of every change, and every copy, MUST be shown and announced to screen
  reader users. A status message MUST NOT disappear while it has focus or is hovered.
- **FR-075**: When the clipboard cannot be used, the copy button MUST select the full value in place
  and say that the value could not be copied automatically.

#### Private keys and security in the browser

- **FR-076**: Private key text, whether typed, pasted, loaded from a file or exported, MUST NOT be
  written to browser storage, the page address, the browser history, logs or error reports. The
  import field MUST disable spell checking, auto-correction and auto-completion.
- **FR-077**: Administrators MUST be able to export the private key of an entry with a key while
  export is enabled. The app MUST first ask for confirmation, explaining that the private key lets
  its holder sign mail for the name and that the export is recorded. After a successful export, the
  key MUST be shown in a dialog in a read-only field, exactly as returned, with a copy action and a
  download action that saves it unchanged as a text file named `<selector>.<ASCII name>.pem`. The
  key MUST exist in the app only while that dialog is open: it MUST NOT be kept in the app's data
  cache and MUST be discarded when the dialog closes. Closing the dialog before the key was copied
  or downloaded MUST ask for confirmation (`docs/conventions.md` "Secrets"). Seeing it again MUST
  require a new confirmed export. While export is disabled, the entry page MUST state, for administrators, that private key
  export is turned off on this server, and offer no export action.
- **FR-078**: Policy texts, zone files, record values and values found MUST be shown as text and MUST
  NEVER be rendered or interpreted as markup. Links to the policy address MUST open in a new tab.

#### Mobile and responsive behaviour

- **FR-079**: Every screen and state of this feature MUST be fully usable at 360 px width without
  horizontal scrolling, and its content MUST reflow at 400 % zoom on a 1,280 px wide screen.
- **FR-080**: Interactive targets, including copy buttons, MUST be at least 44 × 44 CSS px. On small
  screens the save, cancel and run actions of forms and the selection action bar MUST stay reachable
  without scrolling to the end.
- **FR-081**: Number fields MUST bring up a numeric keypad, and fields for names, selectors, MX hosts
  and private keys MUST NOT auto-capitalise or auto-correct.

#### Accessibility

- **FR-082**: Every screen of this feature MUST meet WCAG 2.2 AA. Every function MUST be operable by
  keyboard, including copying, MX host entry, selection, sorting, filters and dialogs, and the focus
  MUST be visible and never hidden behind sticky bars.
- **FR-083**: Tables MUST have header cells, and sortable headers MUST expose the current sort
  direction. Card lists MUST be exposed as lists, with the name, or the check's purpose, as each
  card's heading.
- **FR-084**: Changes of the result count after a search or filter, progress and results of runs on
  several names, the start and end of a diagnostics run with its summary, and save and copy outcomes
  MUST be announced as status messages without moving the focus. A countdown MUST NOT be announced
  more than once.
- **FR-085**: Dialogs MUST be labelled, keep the focus inside, close with Escape unless an action is
  in progress, and return the focus to the control that opened them. Opening a form MUST move the
  focus to its heading, and a failed submission MUST move the focus to the error summary.
- **FR-086**: State badges, status badges, the optional marker and outcome markers MUST have text
  equivalents and MUST NOT rely on colour alone, with sufficient contrast in the light and dark
  themes. Each copy button MUST have an accessible name that says what it copies, for example "Copy
  record value of example.org".

#### Internationalisation

- **FR-087**: All text of this feature MUST come from the translation files and MUST be complete in
  English, Czech and Slovak. Legacy translation keys MUST be reused where the meaning is unchanged.
- **FR-088**: Names, selectors, record names and values, values found, MX hosts, policy texts,
  policy identifiers, zone files and technical publication reasons MUST be shown as returned and
  never translated. Numbers, durations and times MUST be formatted for the user's language, and times
  shown in the device's time zone.

#### Data freshness

- **FR-089**: After a successful change, every screen that shows the changed entry or policy MUST
  show the new values, including the DKIM key list, the entry page and the domain and alias domain
  pages. Data already loaded MUST NOT be loaded again without reason, for example when returning to
  a list.

### Legacy Parity

Legacy reference: FeldHost fork of mailcow-dockerized (upstream tag `2026-09a`), `data/web/`
`templates/admin/tab-config-dkim.twig`, `admin/system.php`, `templates/modals/admin.twig`
(`showDKIMprivKey`), `js/site/admin.js` (`#dkim_missing_keys`, private key modal),
`templates/edit/domain.twig` (DKIM record, `dmtasts` tab), `edit.php`, `templates/modals/mailbox.twig`
(`dnsInfoModal`), `js/site/mailbox.js` (DNS buttons in the domain and alias domain tables, modal
loader), `inc/ajax/dns_diagnostics.php` and `lang/lang.{en-gb,cs-cz,sk-sk}.json`. Status:
**Matched** (same capability), **Improved** (same capability, better behaviour) or **Dropped**
(intentionally not in this feature, with the reason).

#### System › Configuration › ARC/DKIM keys

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| Tab inside the System › Configuration page, collapsed card on phones | One long page section | Improved: own screen with its own address | FR-001, FR-004 |
| Administrators only | Domain administrators saw a key only on the Edit domain page and could generate one only through `/api/v1` | Improved: screen also for domain administrators, limited to their domains, with generation | FR-001, FR-002 |
| Toggle buttons "Key valid", "Key unused", "Key missing" | Show or hide rows of each state | Matched; plus kind, completeness and selector filters, search, sort and paging | FR-008 to FR-011 |
| One row per domain, alias domains nested below with "↳ Alias-Domain" | All rows rendered at once | Improved: kind "Alias domain of <target>", filter by domain with its alias domains, paging | FR-005, FR-006, FR-012 |
| Badges valid/missing/unused, "Selector 'x'", "n bit" | Colour badges | Improved: text and icon badges, exact key length from the API | FR-006, FR-086 |
| TXT record in a read-only text area or `pre` block | Selected by hand to copy | Improved: record name, host label and value with copy buttons, single and split forms | FR-016 to FR-018 |
| `SPLIT_DKIM_255` setting | Server-wide choice of one notation | Improved: both forms always available | FR-016, FR-017 |
| "Private key" link and modal | Every private key embedded in the page when `SHOW_DKIM_PRIV_KEYS` is on; otherwise a "Please set $SHOW_DKIM_PRIV_KEYS" text | Improved: separate confirmed and audited export, administrators only, offered only while enabled, never preloaded, discarded when closed; copy and download | FR-002, FR-015, FR-077 |
| Checkbox per entry (disabled for missing keys), "Toggle all", "Remove" | One request for all selected, generic "Are you sure" | Improved: selection mode, generation and deletion of a selection (deletion in one bulk request with version tags), impact confirmation with the number typed, per-name results and retry | FR-038, FR-040 to FR-042, FR-092 |
| "Add ARC/DKIM key" form: domains as comma-separated text, "Select domains with missing keys", selector pre-filled with `feldhost` (hard-coded in the fork), key length 1024 to 4096 | One request with several domains | Improved: names from the selection or "all names without a key" across pages, selector from the server default, sizes from the server's allowed sizes, per-name results | FR-024 to FR-028, FR-041 |
| Free-text domain entry for generation | Accepts any text | Dropped: generation applies to listed domains and alias domains, which the API requires | FR-024 |
| "Import private key" (collapsed): domain, selector, private key text area "(RSA PKCS#8)", "Overwrite existing DKIM key" | Errors as generic notifications; form input cached in the browser | Improved: file loading, size check, overwrite confirmation, translated rules on the field, key never cached and cleared after success | FR-029 to FR-033, FR-076 |
| "Duplicate DKIM record": from (keys), to (several domains), "Target domain/s - will be overwritten" | Silent overwrite of every target | Improved: targets with a key marked, explicit overwrite, per-target results | FR-034 to FR-036 |
| Notifications `dkim_added`, `dkim_removed`, `dkim_duplicated`, `dkim_domain_or_sel_exists`, `private_key_error` | Toasts | Matched as translated outcome messages | FR-071, FR-074 |
| ISPConfig push (fork) | Silent, failures ignored | Improved: outcome shown, "Publish DNS record again" | FR-043 to FR-045 |

#### Edit domain page

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| DKIM record under the domain form: "Domain: x (selector._domainkey)" and the TXT value | Read-only `pre` block, administrators and domain administrators | Improved: DKIM section with state, copy buttons and generation when missing (domain administrators had no generation form) | FR-021, FR-024 |
| MTA-STS tab with HTML info text | Links and markup in the translation | Matched as plain explanatory text | FR-046, FR-087 |
| Version select with the single option STSv1 | Select | Improved: fixed text | FR-047 |
| Mode select enforce/testing/none, explanation in a tooltip | Tooltip on a "?" icon; a new policy starts with "enforce" | Improved: explanations visible next to each choice, usable by touch; a new policy starts with "testing" | FR-047 |
| Max age in seconds | Number input, checked only by the server, empty for a new policy | Improved: number with a unit, readable duration, 1 week for a new policy, checked before sending | FR-046 to FR-048 |
| MX server text area, comma-separated | Free text | Improved: list of entries, checked before sending, 255-character limit shown | FR-047, FR-048 |
| Active checkbox with tooltip | Checkbox | Matched as a switch with visible explanation | FR-047 |
| Save (add on first save, edit later) | Last write wins | Improved: outdated saves stopped without losing input | FR-049 |
| Deactivation by unticking Active | Saved without warning | Improved: "Deactivate" with a confirmation of the effect; no deletion, as in legacy | FR-052 |
| Policy identifier and DNS records | Not shown | Improved: identifier, records with copy buttons, policy text and address, notice when the identifier changes | FR-046, FR-050 |
| Tab on alias domain pages | None; an alias domain policy could be stored through the API but was never published | Improved: alias domain section names the target's policy | FR-022 |

#### DNS diagnostics modal

| Legacy element | Legacy behaviour | Status | Requirements |
|---|---|---|---|
| "DNS" button in the domain list (administrators and domain administrators) and alias domain list | Opens an extra-large modal | Improved: "Check DNS" on lists, pages and DKIM entries, own addressable page | FR-023, FR-057 |
| Spinner while loading, new run on every opening | No time indication | Improved: progress with the 30-second bound; a result under 10 minutes old is reused with its time | FR-058 |
| HTML table inserted from the server | Raw HTML rendered | Improved: structured data shown as text | FR-059, FR-078 |
| 24-hour notice | Text | Matched | FR-057 |
| Columns Name, Type, Correct Data, Current State | Table, horizontal scrolling on phones | Matched on wide screens; cards on phones | FR-068 |
| Status icons ✓, ✗, "?" and footnotes ¹ (derived from A/AAAA) and ² (optional) | A missing MX looked optional | Improved: six text statuses, optional marker, summary groups with a "needs attention" filter, notes as text | FR-059, FR-060, FR-062 |
| SPF: `v=spf1 mx a ~all`, "Allow ip4/ip6", "SPF Record Syntax" link (fork) | Hard-coded suggestion | Matched: addresses always, suggestion when configured, copy buttons | FR-063 |
| DMARC Assistant link | External link | Matched as translated guidance | FR-059 |
| Server-wide records for administrators | A, PTR, AAAA, PTR, TLSA | Matched | FR-002, FR-059 |
| "Download" zone file (`<domain>.txt`) | Data URL download | Matched; plus copy and in-page view | FR-067 |
| No timeouts, no rate limit | Could hang | Improved: partial results, rate-limit message with retry time | FR-065, FR-066 |
| "Session invalid" text | Inside the modal | Matched by UI feature 001's session handling | — |

### API Dependency

This feature depends on **mailcow REST API v2 feature 010, DKIM, MTA-STS and DNS diagnostics**
(`mailcow-rest-v2/specs/010-dkim-mta-sts-dns/spec.md`), on the identity, error conventions and audit
log of API feature 001, on the audit target filters of API feature 002, and on the domain and alias
domain screens of UI features 002 and 004. The plan pins the merged contract at mailcow-rest-v2
commit `32079252d55797d3da4e58ae661e9fb91c51c6f9` or later.

| Behaviour relied on | API requirement |
|---|---|
| Permission matrix; "not found" for names outside the scope; "forbidden" for operations the role may never use | API 010 FR-001 to FR-005 |
| Names in readable and ASCII form; legacy names reachable by exact stored name | API 010 FR-006 |
| DKIM entry with kind, state, selector, exact length, record name, value, split value, completeness, version tag; no private key | API 010 FR-007, FR-008 |
| List with paging, total, search, filters (state, kind, selector, completeness, domain) and sorting | API 010 FR-009, FR-010 |
| Inspection of one entry | API 010 FR-011 |
| Capabilities: server host name; DKIM default selector, default and allowed key sizes, selector and private key limits, import key lengths, publication enabled, export enabled (administrators); MTA-STS modes, limits and default active state; diagnostics limits and server-wide checks | API 010 FR-012 |
| Generation, one name per request, "created", conflict on an existing key, selector and size rules; overwrite by administrators ("updated") | API 010 FR-013 to FR-015 |
| Import with overwrite, name syntax, private key rules with rule codes, "created" or "updated" | API 010 FR-017 to FR-021 |
| Copy to one target per request, overwrite on request, source unchanged | API 010 FR-022, FR-023 |
| Deletion with no body; outcome in the audit record | API 010 FR-024, FR-025 |
| Bulk deletion of up to 100 keys with version tags, one result per key, removal outcomes | API 010 FR-059 |
| Private key export, administrators only, while enabled, "export disabled" error | API 010 FR-026, FR-027 |
| Publication outcomes with reason codes, publish again, "publication not enabled" error | API 010 FR-028 to FR-031 |
| MTA-STS policy: create, read, change, list, rules, identifier, published address, policy text, DNS records, no deletion, alias domains "not found" | API 010 FR-032 to FR-038 |
| DNS diagnostics: record set, server-wide checks for administrators, statuses, check identifiers, message codes with parameters, expected values, values found, optional flag, server facts, zone file, time limits, partial results, rate limit with retry hint and rate-limit headers | API 010 FR-039 to FR-050 |
| Version tags and outdated refusals | API 010 FR-051 |
| Temporary failure | API 010 FR-052 |
| Audit records with target filters | API 010 FR-054, FR-055; API 002 FR-058; API 001 FR-046, FR-047 |
| Problem types and validation rule codes with parameters | API 010 FR-056; API 001 FR-049, FR-055 |
| Role and scope of the signed-in user | API 001 FR-028, FR-029 |

**Gaps in the API that this feature does not work around** (to be specified in mailcow-rest-v2 if
wanted; until then the app behaves as stated):

1. Closed by API 010 FR-044 (check identifiers; reasons, notes and guidance as codes with
   parameters).
2. A single key deletion responds without a body, by design, so the publication outcome of removing
   the DNS record is available only in the audit record (API 010 FR-024). The app points to the
   history. A bulk deletion reports the outcomes (API 010 FR-059).
3. Closed by API 010 FR-030 (publication reason codes).
4. Closed by API 010 FR-013 and FR-014 (generation with overwrite, atomic).
5. Closed by API 010 FR-012 (server host name in the capabilities read).
6. Closed by API 010 FR-049 (rate-limit headers).
7. The detail fields of the DKIM and MTA-STS audit records are not in the contract. They are the
   old and new selector, key length and fingerprint, the overwrite flag, the copy source, the
   publication outcome, the changed policy values and the old and new identifier. API 010
   research documents them, but `AuditEvent.details` allows any field. The app shows them as
   recorded, without translated labels (FR-070).
8. The capabilities read has no bulk limit for DKIM keys, unlike the other features' capabilities.
   The app uses the contract's documented maximum of 100 targets, which one page of at most 100
   entries never exceeds.

### Key Entities *(include if feature involves data)*

- **DKIM entry**: a name with its kind, key state and, when it has a key, its selector, key length,
  record name, record value (single and split), completeness and version tag.
- **DKIM configuration**: the server's default selector, default and allowed key sizes, whether
  private key export is enabled and whether the DKIM DNS publication is enabled.
- **Publication outcome**: the result of one attempt to update the ISPConfig zone of a name.
- **Exported private key**: the private key of one name, shown once to an administrator.
- **MTA-STS policy**: a domain's version, mode, MX hosts, maximum age, active state, identifier,
  published address, policy text, DNS records and version tag.
- **DNS diagnostics result**: the record checks of one run, the server facts used, the time of the
  run and the zone file.
- **Record check**: one expected record with its purpose, name, type, status, optional flag,
  expected value or guidance, values found, reason and note.
- **List view**: the search, filters, sort, page and page size of the DKIM key or MTA-STS policy
  list.
- **Run on several names**: a selection of names or targets, one action, and the outcome per name.
- **History entry**: an audit record about a DKIM key or an MTA-STS policy.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator generates a key for a domain without one and copies its record name
  and value on a 360 px wide phone in under 1 minute.
- **SC-002**: For 100 % of the names in the parity test set, every value that the legacy ARC/DKIM
  keys tab, Edit domain page and DNS modal show is shown by the new app, allowing for the stated
  improvements.
- **SC-003**: 100 % of copy actions copy text identical, character for character, to the value the
  API returned.
- **SC-004**: Automated accessibility checks report 0 WCAG 2.2 AA violations on every screen and
  state of this feature, at 360 px and at desktop width, in the light and dark themes.
- **SC-005**: No screen of this feature needs horizontal scrolling at 360 px width or at 400 % zoom
  on a 1,280 px wide screen, including record values of 1,000 characters.
- **SC-006**: In 100 % of the permission tests (administrator, domain administrator, server settings
  for export and publication on and off), the app offers exactly the actions of the permission
  matrix.
- **SC-007**: After every import and export test, a scan of browser storage, page addresses, history
  entries and the app's messages finds no private key material.
- **SC-008**: For a diagnostics result that covers every status, 100 % of checks are shown with the
  correct status label and optional marker, and the summary's counts equal the result's.
- **SC-009**: 100 % of downloaded zone files are identical to the zone file the API returned.
- **SC-010**: 100 % of saves based on outdated data are stopped, and the user's unsaved input is
  still present afterwards.
- **SC-011**: A run on 50 names reports an individual outcome for all 50, and a retry sends only the
  names that failed.
- **SC-012**: Translation completeness checks find 0 missing keys in English, Czech and Slovak.
- **SC-013**: When the API answers within 1 second, the first page of the DKIM key list is visible
  within 2 seconds of opening it on a mid-range phone over a mobile connection, and the diagnostics
  progress state appears at once after the run starts.
- **SC-014**: In a moderated test with at least 5 domain administrators, at least 90 % find every
  record of their domain that needs attention and copy the value to fix it on a phone at the first
  attempt without help.
- **SC-015**: 100 % of MTA-STS saves that renew the policy identifier show the "update the
  `_mta-sts` record" notice, and none of the saves that change only the active state do.
- **SC-016**: Opening the DNS diagnostics of the same name again within 10 minutes starts no new run
  in 100 % of cases, so that a user who navigates back and forth does not reach the rate limit.

## Assumptions

- UI feature 001 provides the shell, navigation, sign-in, the identity with role and scope, language
  and theme, session handling, the generic translated error handling (including 401 and 403), status
  announcements, and the audit log screen, which this feature extends with target types (FR-070).
- UI features 002 and 004 provide the domain and alias domain lists and pages into which this
  feature adds its sections and "Check DNS" actions (FR-021 to FR-023).
- The API 010 contract is merged (mailcow-rest-v2 commit `3207925`). Until the API is implemented,
  the feature is built and tested against a mock generated from the contract.
- API 010 FR-012 exposes the server's default DKIM selector, which closes gap 8 of UI feature 002
  (selector shown as "server default") once both contracts are pinned.
- The legacy UI keeps working for everything outside this feature.
- Legacy translation keys with unchanged meaning are reused, for example `admin.dkim_keys`,
  `admin.dkim_key_valid`, `admin.dkim_key_missing`, `admin.dkim_key_unused`,
  `admin.dkim_domains_selector`, `admin.dkim_key_length`, `admin.dkim_add_key`,
  `admin.dkim_domains_wo_keys`, `admin.import_private_key`, `admin.private_key`,
  `admin.dkim_overwrite_key`, `admin.duplicate_dkim`, `admin.dkim_from`, `admin.dkim_to`,
  `admin.copy_to_clipboard`, `edit.mta_sts`, `edit.mta_sts_version`, `edit.mta_sts_mode`,
  `edit.mta_sts_max_age`, `edit.mta_sts_max_age_info`, `edit.mta_sts_mx`, `edit.mta_sts_mx_info`,
  `edit.mta_sts_active_info`, `diagnostics.dns_records`, `diagnostics.dns_records_24hours`,
  `diagnostics.dns_records_name`, `diagnostics.dns_records_type`, `diagnostics.cname_from_a`,
  `diagnostics.optional`, `diagnostics.allow`, `success.dkim_added`, `success.dkim_removed`,
  `success.dkim_duplicated` and `danger.dkim_domain_or_sel_exists`. Legacy texts that contain HTML
  markup (`edit.mta_sts_info`, `edit.mta_sts_mode_info`, `edit.mta_sts_version_info`) are carried
  over without the markup, and labels whose meaning changes (such as "Correct Data", now "Expected
  value") get new keys.
- These are defaults of this feature, not API rules: the page sizes, the 90 % length indicator, the
  collapsed zone file view, the 10-minute reuse of a diagnostics result, the 45-second wait for a
  run, and the MTA-STS set-up values (testing, 1 week, inactive).
- Key rotation replaces the key in one step (FR-090), or imports a new key with overwrite. Deleting
  the key and generating a new one stays possible, as in legacy.
- **Out of scope**: creating, changing and deleting domains and alias domains; the DKIM fields of
  domain and alias domain creation (UI features 002 and 004); changing server settings such as the
  default selector, private key export or the DKIM DNS publication; ARC settings; deleting MTA-STS
  policies; publishing MTA-STS records to ISPConfig; DNSSEC and DMARC policy analysis.
