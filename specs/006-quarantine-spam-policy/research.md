# Research: Quarantine, Spam Policy and Rate Limits

**Feature**: `specs/006-quarantine-spam-policy` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

This document settles every open point of the plan for UI feature 006. The order of precedence is
the constitution, then the pinned mailcow-rest-v2 contract, then `docs/conventions.md`, then the
decisions of UI feature 001, then best practice. Each entry has a **Decision**, its **Rationale**
and the **Alternatives considered**.

The foundation is not repeated here. UI 001's research (cited as **001-R*n***) fixes:

- the stack, the structure and the module boundaries (001-R1 to 001-R3);
- contract pinning and the generated client (001-R6, 001-R7);
- HTTP and problem handling (001-R8) and the query policy (001-R9);
- i18n (001-R15), sanitising (001-R17) and the CSP (001-R18);
- routing and the navigation catalogue (001-R19), and the shared primitives (001-R20);
- accessibility (001-R21) and testing (001-R22 to 001-R27).

This feature adds **no runtime dependency** (constitution VIII).

---

## 1. Contract and scope

### R1. Contract pin and what it brings

- **Decision**: The feature needs a pin that contains the API 006 contract. The baseline is
  mailcow-rest-v2 commit **`32079252d55797d3da4e58ae661e9fb91c51c6f9`** (2026-10-18, "Register
  KnownProblemType in contract components").
  - Its bundle (`@redocly/cli@2.64.1 bundle api/openapi.yaml`) has sha256
    `5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6` and 376 operations, all
    under `info.version` `0.1.0`.
  - It contains the 42 operations of API 006, the `requiredFlagsMatch` convention of
    `permission-flag-required` (commit `44313fb`), and `KnownProblemType` registered under
    `components.schemas`.
  - That last point closes UI 001's API gap 5: `knownProblemTypeValues` is generated from this pin
    on.

  UI 002–005 bump the pin before this feature is implemented. The bump task therefore keeps the
  **later** of the two commits, the baseline above or the commit UI 005 pinned, and never moves
  the pin backwards. When the kept commit is later than the baseline, the task diffs
  `api/modules/{quarantine,spam-policy,rate-limits}` and the 006 component schemas between the
  two commits. Any change to an operation, schema, problem type or rule code used here is then
  reflected in [contracts/README.md](./contracts/README.md) before implementation continues.
- **Rationale**: Constitution I and 001-R6: the commit is the identifier, because `info.version`
  does not change while later features' contracts are merged. The baseline is the newest commit
  that touches what this feature uses (shared problem conventions included), and nothing older
  carries the `requiredFlagsMatch` member.
- **Alternatives considered**: Pinning `7bb91da`, the last commit that changed the 006 modules, was
  rejected. It lacks the `requiredFlagsMatch` definition and the registered `KnownProblemType`
  that this feature's refusal handling and translation check rely on.

### R2. Translation coverage after the bump

- **Decision**: The bundle always contains every feature's contract, because mailcow-rest-v2 keeps
  them in one tree. 001-R27 requires a key for every value of the checked enumerations. As a
  result, the 006 values (problem types, audit event and target types, rule codes) entered the
  required set with the **first** bump after UI 001, and generic keys for them may already exist.
  This feature:
  1. adds keys for any enumeration value that its own bump newly introduces (the delta to UI
     005's pin);
  2. reviews and refines the wording of the existing 006 keys, and adds the parameterised,
     contextual messages FR-067 asks for;
  3. extends the required set of `scripts/i18n/check.mjs` with the 006 enumerations that 001-R27
     does not list. The script reads them from `contract/openapi.json` by JSON pointer, so that
     inline enumerations without a generated root type are covered too:
     - `QuarantineItemAction`, `QuarantineNotificationFrequency`,
       `QuarantineNotificationCategory`, `QuarantineReleaseFormat`, `SpamPolicyList`,
       `RateLimitObjectKind`, `SpamPolicyOwner.kind`;
     - `QuarantineActionReport.{action,delivery,learning,fuzzy}`;
     - `QuarantineItemDetails.contentStatus`, `QuarantineRecipient.source`;
     - `SpamFilterTemporaryFailureProblem.{dependency,step}`;
     - `RateLimit.effectiveSource`, `RateLimitValue.frame`;
     - the `reason` values of `invalidTemplate` (`syntax`, `security`, `render`, `timeout`). Those
       are listed only in prose, so they are checked as a fixed list next to the `format` values,
       as 001-R27 does.
- **Rationale**: Constitution IV ("missing keys fail CI") and SC-009. Reading enumerations from
  the contract file keeps the list out of hand-written code (constitution I).
- **Alternatives considered**: Hand-listing the values in the check script was rejected, because it
  drifts with every bump.

### R3. Operations used and not used

- **Decision**: The feature uses 38 of the 42 API 006 operations, plus `listAuditEvents`,
  `getIdentity`, `listDomains`, `listAliasDomains`, `listMailboxes` and `getMailbox`. The full
  table is in [contracts/README.md](./contracts/README.md). These four API 006 operations are not
  used:
  - `previewQuarantineTemplate`, and the `validateOnly` parameter of `updateQuarantineSettings`.
    Spec FR-063 says the template is "never rendered or previewed". The preview returns text only,
    so using it would not break constitution V, but it would go beyond the spec (constitution
    VIII). See owner question 1 in the plan.
  - `getDomainSpamPolicyEntry`, `getAliasDomainSpamPolicyEntry` and `getMailboxSpamPolicyEntry`.
    List entries carry every member and their `etag`, so no single read is needed.
- **Rationale**: Build only what the spec needs. Every operation used is in the pinned contract
  (constitution I).
- **Alternatives considered**: Adding the preview "because the API offers it" was rejected without
  a spec change.

---

## 2. Structure, routes and access

### R4. Feature directories

- **Decision**: Three feature directories mirror the contract modules and the query key roots:
  - `src/features/quarantine/`: the quarantine list and items, actions, bulk actions, downloads,
    notification settings (page, panel and the mailbox list bulk action), the settings page, the
    statistics page and the capabilities query, which the other two directories use through
    `index.ts`;
  - `src/features/spam-filter/`: the spam score panel, the allow and block list panel, the
    mailbox user's Spam filter page, and the "Spam filter and limits" pages of domains, alias
    domains and mailboxes, which compose panels from all three directories;
  - `src/features/rate-limits/`: the rate limit panel, the Rate limits overview, "Set a rate
    limit", and the bucket reset dialog, which UI 011 later reuses.

  Cross-directory use goes through each `index.ts`, as 001-R3 requires.
- **Rationale**: One directory per API module keeps each `api.ts` small and its invalidation local.
  The shared object pages naturally belong to the spam filter area, because they are its
  addresses.
- **Alternatives considered**: One `quarantine` directory with about 70 files was rejected as hard
  to navigate. A directory per page was rejected, because panels are reused across pages.

### R5. Route map and addresses

- **Decision**: These are the addresses. UI 014 collects them (row M14 maps `/quarantine`). The
  full table is in [data-model.md](./data-model.md#5-route-map).
  - `/quarantine` (list), `/quarantine/:itemId(\d+)` (item), `/quarantine/notifications`,
    `/quarantine/rate-limits`, `/quarantine/settings` and `/quarantine/statistics`, all under the
    catalogue entry `quarantine`.
  - `/spam-filter`, under the catalogue entry `spamFilter`.
  - `/domains/:domain/spam-filter` (entry `domains`), `/alias-domains/:aliasDomain/spam-filter`
    (the alias domain entry UI 004 adds) and `/mailboxes/:mailbox/spam-filter` (entry
    `mailboxes`). They nest under the host detail addresses of UI 002, 004 and 003.

  Literal segments (`notifications`, `rate-limits`, `settings`, `statistics`) are declared before
  `:itemId`, and `:itemId` only matches digits. A route parameter is decoded once, and the page
  passes it unchanged to the API as a path parameter, which `openapi-fetch` encodes.
- **Rationale**: Nesting the object pages under their host addresses gives a readable hierarchy and
  the right navigation highlight, and the catalogue entry already admits exactly the roles that may
  use them (administrators and domain administrators). The pages exist with their own addresses
  before the host pages link to them (spec clarification 1).
- **Alternatives considered**: Putting every page under `/quarantine/…` was rejected, because the
  quarantine entry admits mailbox users, so each object page would need its own role check, and
  the addresses would not match the hosts.

### R6. Access by role inside a section

- **Decision**: Routes carry `meta.navEntry` (001-R19) and, where a page is narrower than its
  entry, `meta.roles: Role[]`. `ShellLayout` renders `NoAccessState` when the role is not listed,
  exactly as for `canAccess` (001-R19). Notifications is `['mailboxUser']`; Rate limits is
  `['admin', 'domainAdmin']`; Settings and Statistics are `['admin']`. If UI 002–005 already
  introduced an equivalent route-level check, that check is reused (see the prerequisite table in
  the plan).

  The Quarantine section navigation (`QuarantineSectionNav.vue`) is built from the registered
  routes that carry `meta.sectionNav`, filtered by role. A page that is not implemented yet
  therefore never appears, and no link can break (SC-007 of UI 001, conventions "Where features
  meet").
- **Rationale**: FR-001, FR-005 and constitution V: hiding is a convenience, and the address shows
  "no access" in place without requesting data.
- **Alternatives considered**: Redirecting to the list was rejected, because it loses the address
  (001-R19).

### R7. Permission matrix

- **Decision**: `src/features/quarantine/permissions.ts` exports pure functions over `Identity`
  (`role`, `scope`, `permissions`) that answer every row of FR-002. Examples are
  `canActOnItems`, `canSeeAttachments`, `canDownloadMessage`, `canChangeFrequency(mailbox)`,
  `canChangeCategory(mailbox)`, `canChangeSpamScore(mailbox)`, `canReadPolicy(ownerKind)`,
  `canChangePolicy(ownerKind)`, `canReadRateLimits`, `canChangeRateLimits`, `canResetBucket`,
  `canSeeSettings`, `canSeeStatistics` and `canSeeHistory`.
  - Flags are the camelCase `PermissionFlags` members: `quarantine`, `quarantineAttachments`,
    `quarantineNotification`, `quarantineCategory`, `spamScore`, `spamPolicy` and `ratelimit`.
    API 001 already folds a domain administrator's implied flags into the identity, so the
    functions only read flags.
  - A table-driven unit test covers SC-005: an administrator; a domain administrator with and
    without each of `quarantine`, `spamPolicy` and `ratelimit`; and a mailbox user with and
    without each of the six mailbox flags.
  - Read-only presentation uses the legacy note `acl.prohibited` ("Prohibited by ACL") with the
    flag's legacy label (`acl.quarantine`, `acl.quarantine_attachments`,
    `acl.quarantine_notification`, `acl.quarantine_category`, `acl.spam_score`, `acl.spam_policy`,
    `acl.ratelimit`), through the shared note component that UI 003 uses for FR-041 there.
- **Refusals** (FR-004):
  - `403 permission-flag-required` carries `requiredFlags` and `requiredFlagsMatch`. The message
    names each listed flag by its legacy label, joined with "and" for `all` (the default) or "or"
    for `any`.
  - `403 attribute-not-permitted` (notification settings) carries `attributes` and
    `requiredFlags`. Each named attribute is marked read-only on its field.
  - Both refresh the identity, as `forbidden` does (001-R8), and the affected query. Unsaved input
    elsewhere on the screen is kept.
- **Rationale**: One function per capability makes SC-005 testable without a browser, and the
  components never read flags directly.
- **Alternatives considered**: Reading flags inline in templates was rejected: it scatters the
  matrix and cannot be tested as a table.

### R8. Capabilities instead of hard-coded limits

- **Decision**: `getQuarantineCapabilities` is read once per session (query
  `['quarantine','capabilities']`, `staleTime` 10 minutes) by every form and list that needs a
  limit:
  - `bulkLimit` (100), and `defaultPageSize` and `maxPageSize` (the page-size choice stays 25, 50
    and 100, capped at `maxPageSize`);
  - `contentSizeLimit` (10 MiB) and `pipelineMaxMessageSize`, shown as sizes in the help texts;
  - `spamScore` (`min` 0, `max` 5000, `step` 0.1);
  - `senderPattern` (`maxLength` 100, `allowedCharacters`, `wildcard`);
  - `rateLimit` (`min`, `max` and `frames`);
  - `settings` (`maxRetentionPerMailbox`, `maxMessageSizeStep` 1 MiB, `maxMessageSize`,
    `maxAgeDays`, `notificationSubjectMaxLength`, `notificationTemplateMaxBytes`,
    `releaseFormats`).

  Forms render disabled, with their loading state, until the capabilities are present, and a
  failed read shows the panel's error state with a retry. The spec's numbers are the server
  defaults: the mock returns them, and the tests assert them.

  One limit has no capability: the bucket identifier pattern (`^RL[0-9A-Za-z=]+$`, at most 128
  characters, from the path parameter `RateLimitBucketId`). It lives in
  `src/shared/validation/limits.ts`, whose unit test compares it with `contract/openapi.json`
  (001 data-model §6).
- **Rationale**: `docs/conventions.md`: "Capabilities and limits … come from each API feature's
  capabilities read. The UI never hard-codes them." API 006 FR-072 exists for exactly this.
- **Alternatives considered**: Reading the limits from the contract schema at build time was
  rejected. The contract gives maxima, while the capabilities give the server's actual
  configuration (`contentSizeLimit` is operator-configurable).

---

## 3. Showing message data safely

### R9. Plain-text rendering and neutralising bidi and control characters

- **Decision**: Every string that comes from a message, or names one, is rendered only by the
  shared component `src/shared/components/PlainText.vue`, through
  `src/shared/security/plain-text.ts`. This covers subjects, From headers, senders, recipients,
  symbol names and options, fuzzy hashes, file names, content types, mail server answers, queue
  identifiers, patterns and object names.
  1. **Text only.** Values reach the DOM through text interpolation, never `v-html` (001-R17
     lint). Nothing is interpreted: no markup, no autolinking, and no remote content, so message
     data cannot cause a request.
  2. **Isolation.** Single-line values render inside `<bdi>`, which is an isolate whose direction
     comes from its own content. Multi-line text renders in a block with `dir="auto"` and
     `unicode-bidi: plaintext`, so each paragraph takes its own direction and nothing escapes the
     block. An unmatched override or embedding ends at the isolate's boundary (UAX #9), so it
     cannot reorder the surrounding screen.
  3. **Neutralising.** `neutralise(value, { multiline })` splits the string into text segments and
     marker segments. A marker shows a code point visibly as `U+202E` in a muted style, so a
     spoofed file name such as `invoice‮fdp.exe` shows its override instead of reading
     `invoiceexe.pdf`. These characters become markers:
     - C0 controls U+0000–U+001F (except U+0009 and U+000A in multi-line text), U+007F and C1
       controls U+0080–U+009F;
     - bidi embeddings, overrides and isolates: U+202A–U+202E and U+2066–U+2069;
     - in single-line values only, the bidi marks U+200E, U+200F and U+061C, and the separators
       U+2028 and U+2029. In multi-line text the marks are kept, because right-to-left prose uses
       them legitimately, and the separators become line breaks;
     - U+FEFF (zero-width no-break space, the BOM).

     CR LF and lone CR become LF in multi-line text, and a tab or line break in a single-line value
     becomes a marker too.
  4. **Wrapping.** `white-space: pre-wrap` keeps line breaks in multi-line text, and
     `overflow-wrap: anywhere` breaks long words, URLs and hashes, so nothing scrolls sideways at
     360 px (FR-072).
  5. **Phone data detectors.** iOS Safari turns phone numbers, e-mail addresses and postal
     addresses in plain text into tappable links. `index.html` gains
     `<meta name="format-detection" content="telephone=no, date=no, email=no, address=no">`, so
     that links in message text are never activated (FR-083). The meta tag is app-wide, which is
     wanted: the app never relies on detected links.
- **Content sections** (FR-020, FR-021): `textPlain` and `textFromHtml` each render as a
  multi-line `PlainText` under its legacy heading. A part longer than 20 lines first shows its
  first 20 lines, capped at 4,000 characters so that a single giant line cannot push the actions
  away. A "Show full text" button with `aria-expanded` and `aria-controls` toggles the rest.
  `null` shows "not available", `contentStatus: tooLarge` shows the size message with the size
  and the limit, and `parserFallback: true` marks the plain-text part as unavailable.
- **Tests (SC-002)**: `tests/mocks/factories/hostile-messages.ts` holds at least 50 vectors:
  - `<script>`, event handlers, `javascript:` and `data:` links;
  - remote images, CSS and fonts;
  - `<meta http-equiv>`, `<base>`, `<form>` and `<svg onload>`;
  - template syntax (`{{ }}`, `${}`);
  - RLO/LRO/RLE/LRE/PDF and isolate characters, zero-width characters and every C0/C1 control;
  - 10,000-character lines, 5,000 lines, and mixed right-to-left text.

  A unit test runs every vector through `neutralise` and `PlainText`, and asserts that no element
  is created from the data and that markers appear. An end-to-end test opens every hostile item on
  both viewports and asserts that:
  - no script ran (a `window.__xss` canary);
  - no request left `/ng/` or `/api/v2/`;
  - the item has no horizontal scroll;
  - the header and the action bar keep their positions.
- **Rationale**: Constitution V and FR-083. The API already returns no HTML, but a message's text
  can still spoof a file name or an address, or inject direction changes, which only the client
  can neutralise. Markers make spoofing visible instead of hiding data.
- **Alternatives considered**:
  - Stripping the characters silently was rejected, because it hides an attack and changes the
    data shown (FR-082 says show as received).
  - Replacing them with U+FFFD was rejected, because it loses which character was there.
  - DOMPurify was rejected: this is text, not HTML.
  - CSS `unicode-bidi: isolate` alone was rejected, because it does not reveal overrides inside a
    value.

### R10. Downloads

- **Decision**: `src/shared/platform/download.ts` saves API files without ever displaying them.
  - **Request**: `api.GET('/quarantine/{itemId}/attachments/{position}', { parseAs: 'blob' })`,
    and the same for `/message`, through the normal client. Session cookie, middleware and problem
    handling apply, so a refused download becomes an `ApiProblem` and a translated message
    (FR-038): `quarantine-message-too-large` with `size` and `limit`,
    `permission-flag-required` with its flags, or `404` for an item or attachment that is gone.
  - **File name**: from `Content-Disposition`. The RFC 8187 `filename*` (`charset'lang'pct-value`)
    is preferred, then `filename`. The name is then sanitised again as defence in depth: path
    separators, controls and bidi characters become `_`, leading dots and trailing dots or spaces
    are trimmed, and the name is cut to 200 characters. The fallbacks are
    `quarantine-<itemId>.eml` and `attachment-<position>`.
  - **Save**: the bytes are wrapped in `new Blob([data], { type: 'application/octet-stream' })`,
    whatever the declared type, so no browser previews them. An object URL goes to a temporary
    `<a download="<name>" rel="noopener">`, which is clicked and removed, and the URL is revoked
    after one second. Nothing is written to storage, and the blob is dropped after the click
    (FR-085). Memory is bounded by `contentSizeLimit`, because larger messages are refused.
  - **Virus warning** (FR-037): when `item.virus` is true, `DownloadWarningDialog` must be
    confirmed before the request.
  - **Offer** (FR-036): attachment downloads only when `content.attachments` is present, which the
    API includes only for permitted callers; the whole message only when `canDownloadMessage`
    holds.
- **Rationale**: FR-036 and FR-038 need translated reasons, which a plain `<a href>` to the API
  cannot give: the browser would save or show the problem document. The API already sends
  `attachment`, `nosniff` and a sandbox CSP. Forcing `octet-stream` on the client closes the
  remaining path where a browser could open a blob.
- **Alternatives considered**:
  - `<a href="/api/v2/…" download>`: rejected, because errors are invisible.
  - `window.open`: rejected, because it opens a browsing context in the app's origin.
  - The File System Access API: rejected, because it is not available in Safari or Firefox.

### R11. External hash lookup

- **Decision**: Each attachment shows its SHA-256 with a copy button and the legacy link "Search
  file hash @ VT" (`quarantine.check_hash`). The link points to
  `https://www.virustotal.com/file/<sha256>/analysis/`, the address the contract documents in
  `QuarantineAttachment`. It is built only when the hash matches `^[0-9a-f]{64}$`, and it has
  `target="_blank"`, `rel="noopener noreferrer"` and `referrerpolicy="no-referrer"`. Nothing else
  is put in the address.
- **Rationale**: FR-084 and parity. The lookup opens only on an explicit tap, carries only the
  hash, and passes no referrer.
- **Alternatives considered**: Dropping the link was rejected for parity. A configurable lookup
  service is not in any spec.

---

## 4. Quarantine list, items and actions

### R12. List view and its address

- **Decision**: `useListState` (001-R20) with the schema of
  [data-model §6](./data-model.md#6-address-parameters).
  - **Search**: debounced by 300 ms, then `router.replace` (SC-010).
  - **Filters**: action (multiple), virus state, notification state, arrival days, score range,
    and for administrators and domain administrators the recipient and the domain.
  - **Day range** (FR-013): two native `<input type="date">` fields. `from` is the start of the
    first day in the device time zone, and `to` is the start of the day *after* the last day,
    because the API's `to` is exclusive. Both are converted to UTC RFC 3339 when the query runs.
    The address keeps the `YYYY-MM-DD` days.
  - **Score range**: `LocaleNumberField` (R18), kept in the address with `.` as the decimal
    separator.
  - **Domain filter**: a domain administrator chooses from the domains in `identity.scope.domains`,
    so no request is needed. An administrator uses the shared search combobox over `listDomains`
    with `q`.
  - **Recipient filter**: an e-mail field (exact address, at most 255 characters).
  - **Sort**: column headers with `aria-sort` on wide screens, and a native `<select>` plus an
    order toggle on small screens. The default order is `desc` for `arrivedAt`, `id` and `score`,
    and `asc` for the others.
  - **Presentation**: below `md` a list of cards whose heading is the subject, with a details
    disclosure for the remaining values (FR-011). From `md` up, a table whose subject cell carries
    the queue identifier and the item identifier as a second line, so that every FR-010 value
    stays visible without horizontal scrolling.
  - **Status notice** (FR-008): from `getQuarantineSettings`, which gives the public subset to
    domain administrators and mailbox users. "Inactive" uses the legacy
    `quarantine.disabled_by_config`; otherwise it shows the retention and the maximum size. The
    collapsible help text is the legacy `quarantine.qinfo` without markup (R27).
  - **States**: `ListState` gives loading, "no items", "nothing matches" with "clear filters", and
    error. Count changes are announced politely (FR-016), and Refresh calls `refetch()`.
  - **Filter panel**: full screen on small screens, with removable chips and "clear all",
    reusing the filter panel and chips of UI 002 and UI 003.
- **Rationale**: FR-009 to FR-017, conventions "Lists", and the API's documented semantics
  (`to` exclusive, `minScore`/`maxScore` leave unscored items out).
- **Alternatives considered**: A date-time range was rejected: the spec asks for days. A recipient
  picker over `listMailboxes` was rejected, because the filter is an exact match and typing is
  faster.

### R13. Item page

- **Decision**: The item opens as its own page at every width (FR-018 allows the side-by-side
  option but does not require it). "Back to the list" uses `router.back()` when the previous entry
  is the quarantine list, so the list returns with its address and scroll position. Otherwise it
  pushes `/quarantine`. Focus goes to the `<h1>` with `preventScroll`.
  - **Sections** (FR-019): Summary, Filter result, Fuzzy hashes, Content, and Attachments (only
    when `content.attachments` is present).
  - **Symbols** (FR-022): sorted by `symbols.ts` as legacy sorts them: positive scores from highest
    to lowest, then negative scores from lowest to highest, then zero. Each score is formatted with
    `Intl.NumberFormat(locale, { signDisplay: 'exceptZero' })`, so its sign is text (`+3.5`,
    `-1.2`, `0`), and the options are listed under each symbol.
  - **Recipient link** (FR-006): for administrators and domain administrators, the recipient links
    to `/mailboxes/<recipient>/spam-filter` only when `getMailbox(recipient)` answers `200`.
    Resources and mailboxes that no longer exist answer `404` there, and the address then stays
    plain text, so a resource never gets a link.
  - **Action bar** (FR-024): sticky at the bottom below `md`, with `scroll-padding-bottom` equal to
    its height so that focused elements are never hidden (WCAG 2.4.11). It holds "Deliver to
    inbox", "Learn as spam and delete", "Remove" and "Download (.eml)", which goes into a "More"
    menu on phones.
  - **Notice** (FR-003): a mailbox user without `quarantine` sees "Actions are disabled for your
    mailbox". A domain administrator without the flag sees the same notice, worded for their
    account.
- **Rationale**: A single layout is simpler and testable (VIII), and the list state in the address
  makes the way back exact.
- **Alternatives considered**: A master–detail split on desktop was rejected for now, because it
  doubles the focus and URL logic for no required gain.

### R14. Item actions and their outcomes

- **Decision**: `useItemAction` runs one mutation at a time per item, and its controls are
  disabled while it runs (FR-031). Each request sends `If-Match` with the item's `etag` (API
  FR-060 recommends it).
  - **Deliver to inbox** (`releaseQuarantineItem`): `ReleaseDialog` names the subject and sender,
    and has the switch "Also teach the spam filter that this is not spam", on by default
    (`learnAsHam`). For a virus-flagged item, confirm stays disabled until the danger
    acknowledgement is ticked (FR-026).
  - **Learn as spam and delete** (`learnQuarantineItemAsSpam`) and **Remove**
    (`deleteQuarantineItem`) use destructive confirmations with the FR-027 and FR-028 texts.
  - **Report** (FR-029): `action-outcome.ts` maps `QuarantineActionReport` to one success message
    with optional warnings:
    - `learning: failed` warns that the filter could not learn the message;
    - `learning: alreadyLearned` notes it;
    - `fuzzy: failed` warns that similar messages could not be remembered;
    - `fuzzy: skipped` notes there was no content for it.

    A delivery is never shown as failed when `delivery` is `done`.
  - **After success** (FR-025): the detail query is removed from the cache, the list is
    invalidated, the outcome is announced, and the list returns as in R13.
  - **Refusals** (FR-030):
    - `404`: "already released or removed"; return to the list and refresh it;
    - `409 quarantine-item-busy`: "another action is in progress for this item", then one re-read
      of the item after `Retry-After` seconds (5 by default). It is driven by a single timer that
      is cancelled on leaving the page, and never repeats the action;
    - `409 quarantine-delivery-refused`: the item is kept, and the message includes `smtpCode` and
      `smtpResponse` as `PlainText`;
    - `503 temporary-failure`: "nothing changed", naming `dependency` (shared store, spam filter,
      mail server) and, when present, `step`, with a retry that the user triggers;
    - `412`: "changed elsewhere", and the item is re-read.
  - **No response** (a network error): "The outcome is unknown." The item is re-read once: `404`
    means the action happened. The action is never repeated automatically.
- **Rationale**: FR-026 to FR-031 and API FR-021 to FR-026. A re-read after a lost response tells
  the user the truth without risking a second delivery (SC-007).
- **Alternatives considered**: Optimistic removal from the list was rejected, because a refused
  delivery would make the item flicker away and back.

### R15. Bulk actions on items

- **Decision**: **The selection covers the current page only.** It is cleared, with an
  announcement, when the page, page size, search, filters or sort change, and it ends when the
  user leaves the list.
  - This follows `docs/conventions.md` "Bulk actions" and UI 003 FR-054. The UI 006 spec's
    clarification ("persists across pages") contradicts both, and the conventions say that in that
    case "this document applies, and the next change to that spec aligns it". The spec is aligned
    (plan, "Spec alignment").
  - **Limit**: the selection cannot exceed `bulkLimit` from the capabilities. The largest page
    size is 100, which equals the default limit, so the limit only bites when an operator lowers
    it. The counter shows "n selected", and a selection beyond the limit is refused with a message
    that states it.
  - **Request**: `applyQuarantineBulkAction` with `action` (`release`, `releaseWithoutLearning`,
    `learnAsSpam` or `delete`) and `targets: [{ id: String(item.id), version: item.etag }]`.
  - **Confirmation** (FR-034): the action, its effect, the count and the list of subjects and
    recipients as `PlainText`. It is destructive for learning and removal, and those two remove
    items permanently, so the conventions' rule "a bulk deletion needs the number of objects typed"
    applies: `ConfirmDialog` with `requireTyped` set to the count (UI 002). A bulk delivery keeps
    a single explicit confirmation. For a delivery that includes virus-flagged items, it states
    their number and requires the acknowledgement.
  - **Result** (FR-035): `QuarantineBulkResult` goes to UI 002's `BulkResultSummary`, which
    gains an optional per-row slot so that a `done` row can show its `report` warnings. The counts
    per outcome come from `summary`. Rows that are `refused`, `failed` or `outdated` stay selected,
    and the others are deselected. The list is invalidated and the summary announced.
  - **Whole-request refusal** (`403`, `422 tooMany`): one message naming the reason, with the
    selection kept.
  - **No response**: "outcome unknown", the list is refreshed, and the request is never repeated.
  - **Phones** (FR-033): an explicit "Select" control starts selection mode. Each card gets a
    44 × 44 px checkbox. The count and the actions stay in a bottom bar. In selection mode, a tap
    on a card toggles it instead of opening it.
- **Rationale**: One selection model across the app (conventions, UI 003), and the API's per-item
  results and version tags (API FR-027).
- **Alternatives considered**: Keeping the spec's cross-page selection was rejected: it would
  contradict the conventions and UI 003, and act on items the user can no longer see.

---

## 5. Settings panels

### R16. Notification settings, single and in bulk

- **Decision**: `NotificationSettingsPanel` serves the mailbox user's Notifications page and the
  mailbox's "Spam filter and limits" page.
  - **Controls**: two radio groups (Reka `RadioGroup`) with the legacy labels and explanations
    (`user.quarantine_notification*`, `user.quarantine_category*`, `user.never|hourly|daily|weekly`,
    `user.q_reject|q_add_header|q_all`). When `category` is `null`, the group shows "Not set" with
    no option selected (FR-039).
  - **Save**: `updateMailboxQuarantineNotificationSettings`, a merge patch with only the changed
    members and `If-Match`, through `useVersionedSave` (FR-040, FR-069). A field whose flag the user
    lacks is read-only with `acl.prohibited`. `attribute-not-permitted` marks the named attributes
    read-only and refreshes the identity.
  - **Effect note**: the change applies at the next notifier run, every 20 minutes, and notified
    items are not notified again.
  - **Mailbox list bulk actions** (FR-041): `NotificationBulkAction.vue`, exported from the
    quarantine `index.ts`, plugs into UI 003's bulk action area. It offers "Set quarantine
    notifications" (frequency) and "Set quarantine notification category" (category).
    - Choosing a value is followed by a confirmation that names the action, the value and the
      count.
    - The request is `applyQuarantineNotificationBulkAction` with `frequency` or `category` and
      `targets: [{ id: mailbox }]`.
    - The result uses `BulkResultSummary` under UI 003's selection rules.
    - Targets carry **no version**: the mailbox list does not carry the notification settings'
      tag, and the API does not version-check a target without one.
- **Rationale**: FR-039 to FR-041, and API FR-035 to FR-038.
- **Alternatives considered**: Saving on click, as legacy does, was rejected, because conflicts
  could not be detected (FR-040).

### R17. Spam score panel

- **Decision**:
  - **Read**: `getMailboxSpamScore` gives the values in effect, `custom`, and `defaults` with
    `fallback`. The panel says whether the values are custom or the server defaults, shows the
    defaults (`user.spamfilter_default_score`), and adds a note when `fallback` is true.
  - **Band** (`ScoreBand.vue`): three zones, each with its text range and its legacy explanation
    (`user.spamfilter_green|yellow|red`), and a colour bar. Zone widths are proportional on a
    display scale that is linear up to `max(reject × 1.5, 20)`, then compressed for the tail, so
    that typical values (5–20) stay readable. The widths use bound inline-size styles, which CSP
    allows (001-R18). Colour is never the only carrier, because each zone states its range in text
    (FR-079).
  - **Edit**: two `LocaleNumberField`s (R18) with `inputmode="decimal"`, "Junk folder from" and
    "Reject from". Values are held as integer tenths, so 6.5 is 65 and comparisons are exact.
    Before sending, the panel checks:
    - the range and step from `capabilities.spamScore`;
    - junk ≤ reject; otherwise the field error `mustNotExceed`, and nothing is sent.

    When both are equal, a note explains that the reject value will be raised by 0.1. Saving is
    `setMailboxSpamScore` with `If-Match`, and afterwards the stored values from the response are
    shown (10 and 10.1).
  - **Reset**: "Reset to server default" (`user.spam_score_reset`) is confirmed, then sends
    `resetMailboxSpamScore` with `If-Match` and refetches.
- **Rationale**: FR-042 to FR-044 and spec clarification 5. Exact decimal arithmetic avoids
  `0.1 + 0.2` errors at the junk ≤ reject boundary.
- **Alternatives considered**:
  - A two-handle slider was rejected (spec clarification 5).
  - `<input type="number">` was rejected (R18).
  - A logarithmic band was rejected, because zero cannot be placed on it.

### R18. Number input with locale decimals

- **Decision**:
  - **Parser**: `src/i18n/parse.ts` exports `parseLocaleDecimal(text, locale, { maxFractionDigits })`
    and `parseLocaleInteger(text)`. It derives the decimal and group separators from
    `Intl.NumberFormat(locale).formatToParts(12345.6)`.
    - It accepts optional surrounding whitespace, digits, and at most one decimal separator. The
      decimal separator is the locale's, and also `.` when `.` is not the locale's group
      separator, so cs-cz and sk-sk accept both `6,5` and `6.5`, while en-gb accepts only `6.5`.
    - It refuses group separators, signs, exponents and more fraction digits than allowed. An
      ambiguous `6,5` in en-gb is therefore refused instead of being read as 65.
    - It returns `{ ok: true, tenths }` for one-decimal values, or a reason code.
  - **Field**: the shared `LocaleNumberField.vue` uses `type="text"` with
    `inputmode="decimal"` (or `numeric` for whole numbers), `autocomplete="off"`, and
    `autocorrect`/`autocapitalize` off. It formats the stored value for the locale without grouping
    while editing, and shows field errors through `FormField` (001-R20).
  - **Uses**: spam scores, the notification score limit, the list's score range, and the whole
    numbers: retention, maximum size in MiB, maximum age and the rate limit value.
- **Rationale**: US4-AS2 ("6,5" in Czech) and FR-074. `type="number"` parses decimals by the
  browser's locale, not the app's, rejects a comma in some browsers, changes with the mouse wheel,
  and returns an empty string for invalid input without telling why.
- **Alternatives considered**: Accepting both separators in every locale was rejected, because
  "1,5" in English is a thousands-style typo, and guessing is unsafe for a reject threshold. A
  masked-input library was rejected (VIII).

### R19. Allow and block lists

- **Decision**: `PolicyListsPanel` takes a `PolicyOwner` (`{ kind: 'domain' | 'aliasDomain' |
  'mailbox', name }`), which selects the list, create and delete operations of that kind.
  - **Queries**: each list ("Allowlist" = `allow`, "Denylist" = `block`, with the legacy names and
    descriptions) runs two queries: own entries (`ownership=own`, paged by the address) and
    inherited entries (`ownership=inherited`, paged separately). Both share the list's search and
    sort. Own entries come first (FR-046), and the inherited group is labelled "Set for <domain>"
    on a mailbox page or "Set for mailboxes" on a domain or alias domain page. Each inherited
    entry names its owner and links to the owner's page when `canReadPolicy` allows it.
  - **Layout** (FR-045): on wide screens both lists sit side by side. Below `md`, a two-option
    switch (a radio group styled as a segmented control) toggles between them, with each list's
    count (own plus inherited totals). The chosen list is kept in the address (`list`).
  - **Address** (conventions "Lists"): `allowQ`, `allowSort`, `allowOrder`, `allowPage`,
    `allowSize`, `allowInheritedPage`, and the same with the `block` prefix. `useListState` gains
    an optional key prefix if UI 002–005 have not added one.
  - **Add** (FR-048, FR-049): one pattern at a time. The field shows the normalised value (trimmed,
    lower-cased) as the user types. The pattern is checked against
    `capabilities.senderPattern`: allowed characters, at least one letter or digit, and
    `maxLength`. The placeholder is `*@example.org`, and the help text explains `*`. On `201` the
    entry appears, and the field is cleared and focused again.
    - `409 spam-policy-entry-exists` with `list` says "already on the Allowlist" or "already on
      the Denylist" and names the pattern that was sent, which is the existing entry's pattern.
    - `422 invalidFormat` (`format: senderPattern`) and `tooLong` show on the field.
  - **Remove** (FR-050): a single own entry is removed after a confirmation naming the pattern and
    the list. For several own entries of the current page, the user selects them in selection mode
    and confirms once, typing their number (conventions "Confirmations", bulk deletion).
    `useRemoveEntries` then sends one `DELETE` per entry, sequentially, with
    `If-Match`, continues after failures, and reports each result. `404` counts as "already
    removed". "Retry failed" re-sends only the failed entries.
  - **Notes** (FR-051): the panel states that changes apply within 1 minute, that mail from a
    blocked sender is rejected and not quarantined, that allowed senders are never treated as spam,
    and, on mailbox pages, that the mailbox's entries take precedence over its domain's.
- **Rationale**: The API pages each ownership group with its own total, so two queries keep "own
  first" exact across pages. Sequential deletes keep the audit order and the server load
  predictable for at most 100 entries.
- **Alternatives considered**:
  - One query without an ownership filter, grouped per page, was rejected: own entries would not
    come first across pages.
  - Parallel deletes were rejected, because they give no faster feedback that matters for at most
    100 entries and complicate "retry failed".

### R20. Rate limits

- **Decision**:
  - **Panel** (`RateLimitPanel`): reads `get<Kind>RateLimit`.
    - It shows `limit` as "<value> msgs / <frame>" with the legacy `ratelimit.second|minute|hour|day`
      unit labels and the number formatted for the locale, or "Disabled" (`ratelimit.disabled`).
    - For a mailbox, it adds the effective limit and its source (`effectiveSource`): "from this
      mailbox", "from the domain <domain>" or "none". The domain is the mailbox address after its
      last `@`, which is the mailbox's domain by mailcow's definition. It also shows the legacy
      explanation `edit.mbox_rl_info`.
  - **Edit**: a `LocaleNumberField` (whole number, `capabilities.rateLimit.min` to `max`) and a
    native `<select>` of `capabilities.rateLimit.frames`. Saving is `set<Kind>RateLimit` with
    `If-Match`, and a value outside the range is refused before sending (US6-AS3).
  - **Remove limit**: a confirmation states the effect. For a mailbox it names the domain limit
    that will apply, taken from the panel's effective data for the domain, or says that no limit
    will apply. Then `remove<Kind>RateLimit` is sent with `If-Match`.
  - **Invalid stored value** (FR-055): when `invalidStoredValue` is set, the stored text is shown
    with a warning, and "Replace" and "Remove" are offered.
  - **Overview** (`RateLimitsPage`, FR-056): `listRateLimits` with the kind filter, `q`, sort
    `object` or `kind`, and paging. Cards on phones, a table on wide screens. Each entry links to
    its object's page, and administrators get History.
  - **"Set a rate limit"** (FR-057): a dialog to choose the kind, then the shared search combobox
    over `listDomains`, `listAliasDomains` or `listMailboxes` with `q` (all scoped by the API), and
    then navigation to the object's page with the rate limit panel focused (`#rate-limit`).
  - **Bucket reset** (FR-058): `ResetBucketDialog` checks the identifier against the contract
    pattern (R8), explains with the legacy first sentence of `admin.hash_remove_info` (R27), and
    sends `resetRateLimitBucket`. `204` says "reset"; `404` says "there was nothing to reset"
    (`warning.hash_not_found`). The dialog and its composable are exported from the rate-limits
    `index.ts`, so that UI 011 can offer "Reset rate limit" on its log entries (UI 011 FR-039).
- **Rationale**: FR-052 to FR-058 and API FR-050 to FR-057. Deriving the domain from the mailbox
  address is a display detail, not a missing capability.
- **Alternatives considered**: An empty value removing the limit, as in legacy, was rejected by the
  spec (explicit removal).

### R21. Quarantine settings

- **Decision**: `QuarantineSettingsPage` shows the active state, then four sections built on UI
  002's `EditableSection`. Each section has its own Edit and Save, which send a merge patch of
  only that section's changed members with `If-Match` (FR-060). A conflict marks the changed values
  (FR-069), and on phones the section form opens full screen.
  - **Storage and limits**:
    - `retentionPerMailbox`: a whole number, where 0 means inactive.
    - `maxMessageSize`: shown and entered in MiB and sent as MiB × `maxMessageSizeStep`. The note
      "0 does not mean unlimited" and "messages above <pipelineMaxMessageSize> never reach the
      quarantine" use the size from the capabilities.
    - `maxAgeDays`: from `settings.maxAgeDays.min` up.
    - `excludedDomains`: chosen in the shared search combobox over `listDomains` and
      `listAliasDomains`, showing `unicodeName` or `nameUnicode`, with the ASCII name when it
      differs. Entries listed in `missingExcludedDomains` are flagged "no longer exists". They can
      be kept or removed, and the picker never offers them.
  - **Release**: `releaseFormat`, as radios over `capabilities.settings.releaseFormats`, with the
    legacy labels.
  - **Notification e-mail**:
    - `notificationScoreLimit`: a decimal (R18), where empty means 9999.0, which is shown as the
      placeholder.
    - `notificationSender`, `copyRecipient` and `redirectRecipient`: `type="email"`
      (`inputmode="email"`). Copy and redirect carry the legacy "Unsigned, unchecked mail" warning.
    - `notificationSubject`: up to `notificationSubjectMaxLength` characters. Empty fields show the
      value that applies when empty (`notificationSenderIsDefault`,
      `notificationSubjectIsDefault`).
  - **Template**: a monospace `<textarea>` with `spellcheck="false"`, `autocapitalize="none"` and
    `autocorrect="off"`. It is never rendered or previewed (FR-063). It shows:
    - "Default template in use" from `notificationTemplateIsDefault`;
    - a size indicator: UTF-8 bytes from `TextEncoder` against `notificationTemplateMaxBytes`,
      which blocks saving above the limit;
    - the placeholder reference (`meta` with `qhash`, `id`, `subject`, `score`, `sender`,
      `created`, `action`; `username`, `counter`, `hostname`, `quarantine_acl`), each with a copy
      button;
    - the quick-link note and the fallback note.

    "Restore default template" is confirmed, then sends `notificationTemplate: null`. A
    `422 invalidTemplate` shows `reason` and `line` on the field: syntax error, forbidden by the
    sandbox, rendering error or rendering timeout (`templateRenderTimeoutSeconds`).
  - **After a save** (FR-064): the effect timing text for each changed member.
- **Rationale**: FR-059 to FR-064. The placeholder names are the notifier's stable template
  interface, documented in the contract's `QuarantineSettings` description. They are not a server
  limit, so listing them is not hard-coding a capability.
- **Alternatives considered**: One form for the whole page, as in legacy, was rejected, because it
  is last-write-wins (spec parity).

### R22. Spam filter statistics

- **Decision**: `SpamFilterStatisticsPage` reads `getSpamFilterActionStatistics`.
  - **List**: one entry per action (rejected, soft-rejected including greylisted, subject
    rewritten, moved to junk, no action), each with its count (`Intl.NumberFormat`), its share
    (`Intl.NumberFormat` with `style: 'percent'` and one fraction digit, 0 % when `total` is 0), and
    a decorative bar (`aria-hidden`, bound inline size). The total follows.
  - **Period**: the page states that the counts run since the filter's statistics were last reset.
    When `countedSince` is set it adds "counting since <date>", otherwise "start unknown". When
    `spamFilterRunningSince` is set it adds "spam filter running since <date>", with the note that
    the counters survive restarts.
  - **Errors**: `503 temporary-failure` shows "temporarily unavailable" with a retry. Refresh calls
    `refetch()`. No chart library is used.
- **Rationale**: FR-065, and the API's FR-058, which now reports the period. That closes the UI
  spec's API gap 1 (plan, "Spec alignment").
- **Alternatives considered**: A doughnut chart was rejected (spec clarification 8, VIII).

---

## 6. History, errors and freshness

### R23. History and audit presentation

- **Decision**:
  - **History links**: `HistoryLink` (built by UI 002, 001-R20) opens
    `/audit-log?targetType=…&targetId=…`. Administrators get these:

    | Where | `targetType` | `targetId` |
    |---|---|---|
    | Settings page | `quarantineSettings` | (none: the target has no identifier) |
    | Notification panel of a mailbox page | `quarantineNotificationSettings` | mailbox |
    | Spam score panel of a mailbox page | `spamScore` | mailbox |
    | Rate limit panel, and each Rate limits overview entry | `rateLimit` | object name |
    | Each own list entry | `spamPolicyEntry` | entry `id` |

    The settings link filters by type only.
  - **List entries (API gap 1)**: the audit records of list entries carry the entry's identifier as
    the target and the owner only in `details`. History cannot therefore be filtered to "the lists
    of this domain or mailbox". The panel offers History per existing own entry and no panel-level
    History. It never filters client-side (constitution I).
  - **Labels**: `src/features/audit-log/labels.ts` gains the 12 event types (`quarantineItemRelease`,
    `quarantineItemSpamLearning`, `quarantineItemDeletion`, `quarantineSettingsUpdate`,
    `quarantineNotificationSettingsUpdate`, `spamScoreUpdate`, `spamScoreReset`,
    `spamPolicyEntryCreation`, `spamPolicyEntryRemoval`, `rateLimitUpdate`, `rateLimitRemoval`,
    `rateLimitBucketReset`) and the 7 target types (`quarantineItem`, `quarantineSettings`,
    `quarantineNotificationSettings`, `spamScore`, `spamPolicyEntry`, `rateLimit`,
    `rateLimitBucket`). The target filter of UI 002 offers them.
  - **Details**: `src/features/audit-log/details/spam-filter.ts` formats the documented `details`
    members:
    - `queueId`, `recipient`, `sender`, `action`, and `steps` translated as in R14;
    - `changes` with old and new values in the user's units (sizes in binary units, scores and
      numbers in the locale, enumerations translated);
    - for the template, "changed" with the old and new size;
    - `owner`, `ownerKind`, `list` and `pattern`;
    - `kind`, `old` and `new` rate limits;
    - `countersExisted` and `logEntriesRemoved`;
    - `bulkRequestId`, shown as "part of bulk action <first 8 characters>", so that the records of
      one bulk action are recognisable (the audit filters offer no bulk filter, and none is needed
      by the spec).

    Recipient, sender and pattern render through `PlainText`. Unknown members fall back to UI 001's
    generic key–value presentation (API gap 2).
- **Rationale**: FR-066, conventions "History and audit", and API 006 data-model "Audit records".
- **Alternatives considered**: Filtering list-entry records in the browser by `details.owner` was
  rejected: it would page incorrectly and work around a missing filter.

### R24. Problems and validation messages

- **Decision**: `src/i18n/problems.ts` (001-R15) already maps `type` to a message key. This feature
  adds the messages and their parameters:

  | Problem | Message parameters |
  |---|---|
  | `quarantine-item-busy` | — (R14) |
  | `quarantine-delivery-refused` | `smtpCode`, `smtpResponse` as plain text |
  | `quarantine-message-too-large` | `size`, `limit` as binary sizes |
  | `spam-policy-entry-exists` | `list` label; the pattern sent |
  | `temporary-failure` | `dependency` label; `step` label |
  | `permission-flag-required` | `requiredFlags` as legacy labels with `requiredFlagsMatch` |
  | `attribute-not-permitted` | `attributes` mapped to field labels |

  The validation codes of 006, with their parameters:
  - `invalidFormat` with `format: email`, `domainName` or `senderPattern`
    (`validation.format.<format>`);
  - `notMultipleOf` (`factor`: 0.1 shown as "one decimal", 1048576 as "whole MiB");
  - `mustNotExceed` (`field`, `value`);
  - `tooLong` with `unit: bytes` (shown as a binary size);
  - `tooMany` (`max`, the bulk limit);
  - `notFound` for an excluded domain;
  - `invalidTemplate` (`reason`, `line`);
  - `outOfRange` and `notInList`.

  Field paths map to the form fields of each section, for example `excludedDomains.3` to the
  fourth chip. Client-side checks use the same message keys, so a refusal reads the same whether
  it comes from the browser or the server.
- **Rationale**: FR-067, FR-068 and SC-009. The API never localises (`docs/problems.md`).
- **Alternatives considered**: Showing `detail` was rejected by constitution I and FR-067.

### R25. Server state, freshness and memory

- **Decision**: Query keys and invalidation are in
  [data-model §3](./data-model.md#3-server-state-cache). The policy is 001-R9: `staleTime` 30 s,
  no focus refetch, and no interval, so the quarantine list never refreshes on a timer (FR-086).
  - **Changes shown everywhere** (FR-086): a change invalidates every query that shows the changed
    value, including the read-only values on the host pages of UI 002, 003 and 004:
    - `getDomain` (`rateLimit`), `getAliasDomain` (`rateLimit`), and the mailbox representation
      (effective rate limit, notification values);
    - their list keys.

    Those keys come from the key factory in `src/api/query/keys.ts`, under the roots UI 002–004
    registered.
  - **Memory**: item details, which hold message text, use a `gcTime` of 60 seconds instead of 5
    minutes, so that parsed content does not linger after the user leaves. The detail is removed
    from the cache after a successful action. `queryClient.clear()` on sign-out (001-R11) discards
    everything (FR-085). Downloaded bytes never enter the cache (R10).
- **Rationale**: Constitution VII and FR-085. A short `gcTime` costs at most one extra request when
  the user reopens the same item a minute later.
- **Alternatives considered**: `gcTime: 0` was rejected, because Back and Forward between the list
  and an item would refetch at once without need.

### R26. Entry points into earlier screens

- **Decision**: These are added in a dedicated phase, once every panel exists (conventions "Where
  features meet"; FR-006: "Links MUST appear only once the target page exists"):
  - **UI 002 domain detail**: a "Spam filter and limits" link in the page's action area, and the
    read-only rate limit value linking to `…/spam-filter#rate-limit`.
  - **UI 003 mailbox detail**: the same link. The read-only notification frequency and category
    link to `#notifications`, and the effective rate limit to `#rate-limit` (UI 003 FR-040).
  - **UI 003 mailbox list**: the notification bulk actions (R16). These come with US3, because
    US3-AS4 tests them.
  - **UI 004 alias domain detail**: the link, and the read-only rate limit note linking to
    `#rate-limit` (UI 004 FR-035).
  - **UI 004 resource detail**: nothing. A test asserts that no link exists.
  - **UI 011**: it adds "Reset rate limit" to its own log using the exported dialog (R20). It ships
    later, so this feature only exports the dialog.

  The link component `SpamFilterLink.vue` is exported from the spam-filter `index.ts`, and it is
  rendered only for roles with `canReadPolicy` or `canReadRateLimits` on that object.
- **Rationale**: Each host's designated action area receives the entry point. The UI 006 pages
  stay reachable by their own addresses for the story tests.
- **Alternatives considered**: Adding links story by story was rejected, because a domain page link
  would appear while the domain page still had no panel.

---

## 7. Translations and testing

### R27. Legacy translation reuse

- **Decision**: Legacy keys whose meaning is unchanged are mapped through `src/i18n/legacy-map.json`
  (001-R15). Among others:
  - `quarantine.*`: `quarantine`, `deliver_inbox`, `learn_spam_delete`, `remove`, `download_eml`,
    `rspamd_result`, `spam_score`, `sender`, `sender_header`, `recipients`, `atts`, `check_hash`,
    `text_plain_content`, `text_from_html_content`, `disabled_by_config`, `rejected`,
    `junk_folder`, `rewrite_subject`, `high_danger`, `neutral_danger`, `notified`, `qid`, `subj`,
    `rcpt`, `received`, `refresh`;
  - `user.*`: `spamfilter`, `spamfilter_wl`, `spamfilter_bl`, `spamfilter_green`,
    `spamfilter_yellow`, `spamfilter_red`, `spamfilter_default_score`, `spamfilter_table_add`,
    `spamfilter_table_rule`, `spam_score_reset`, `quarantine_notification`,
    `quarantine_notification_info`, `quarantine_category`, `quarantine_category_info`, `never`,
    `hourly`, `daily`, `weekly`, `q_reject`, `q_add_header`, `q_all`;
  - `ratelimit.*` (all five), `edit.ratelimit`, `edit.spam_filter` and `edit.mbox_rl_info`;
  - `acl.prohibited`, `acl.quarantine`, `acl.quarantine_attachments`,
    `acl.quarantine_notification`, `acl.quarantine_category`, `acl.spam_score`, `acl.spam_policy`
    and `acl.ratelimit`;
  - `admin.*`: `quarantine_release_format`, `quarantine_release_format_raw`,
    `quarantine_release_format_att`, `quarantine_notification_sender`,
    `quarantine_notification_subject`, `quarantine_exclude_domains`, `reset_limit`;
  - `danger.rl_timeframe`, `success.hash_deleted` and `warning.hash_not_found`.

  **Legacy texts with markup** (FR-080) are carried over without it. `legacy-map.json` accepts an
  object form `{ "key": "<legacy key>", "stripMarkup": true, "segment": <n> }`. The import script
  turns `<br>` into a segment boundary, removes the inline tags `b`, `strong`, `em`, `small` and
  `i`, collapses whitespace, and takes segment `n`. It refuses any other tag, including links.
  This reuses the Czech and Slovak texts of:
  - `quarantine.qinfo`;
  - `user.spamfilter_wl_desc` and `user.spamfilter_bl_desc`;
  - `admin.quarantine_retention_size`, `quarantine_max_size`, `quarantine_max_score`,
    `quarantine_max_age`, `quarantine_bcc`, `quarantine_redirect` and
    `quarantine_notification_html` (label segment and help segment);
  - `admin.hash_remove_info`, segment 0 only, because segment 1 describes legacy colour stripes.

  If UI 002–005 already extended the import for markup, their mechanism is used instead.

  **Not reused, because the meaning changed**: `quarantine.settings_info` (a fixed "MiB" unit and
  markup), `user.spamfilter_table_domain_policy` (replaced by owner groups),
  `danger.policy_list_from_exists` and `danger.policy_list_from_invalid` (FR-049 names the list,
  and US4-AS7 names the allowed characters), and `success.item_released`, `success.items_released`
  and `success.qlearn_spam` (FR-029 reports steps). They get new keys.
- **Rationale**: Constitution IV and FR-080. Segment selection reuses the existing Czech and Slovak
  texts instead of rewriting them.
- **Alternatives considered**: Rewriting every marked-up text by hand in three languages was
  rejected: it loses reviewed translations.

### R28. Mock API, scenarios and the test plan

- **Decision**:
  - **Handlers** `tests/mocks/handlers/{quarantine,spam-policy,rate-limits}.ts` (one per contract
    module, 001-R22) implement the documented behaviour on the scenario state:
    - scope per role, flags (`permission-flag-required` and `attribute-not-permitted`), and `404`
      outside the scope;
    - search, filters (with the exclusive `to`), sort and paging;
    - `If-Match` and `412`;
    - releases that remove the item, with an action report;
    - busy, refused-delivery, temporary-failure and learning-failure injection;
    - bulk results with `report`;
    - downloads as binary bodies with the four required headers;
    - list entries with `own` and ownership filters, and conflicts;
    - rate limits with effective sources and invalid stored values, and bucket resets;
    - settings with merge patch, `missingExcludedDomains` and `invalidTemplate`, and statistics
      with zero counts and `503`.
  - **Validator**: UI 001's validator is extended for binary bodies (`message/rfc822`,
    `application/octet-stream`). It checks the declared content type and the required headers,
    and skips JSON schema validation for those bodies.
  - **Scenarios** live in `tests/mocks/scenarios/{quarantine,spam-filter,rate-limits}.ts`, and
    **factories** in `tests/mocks/factories/`.
  - **End-to-end**: `tests/e2e/{quarantine,spam-filter,rate-limits,audit-log,mailboxes}/`. Every
    acceptance scenario gets a test on `mobile-chromium`, `desktop-chromium` and `mobile-webkit`,
    with `expectAccessible` in both themes, and the spec IDs in the titles. SC-005 runs as a
    table-driven unit test (R7) plus end-to-end samples for each role.
  - **Smoke**: `tests/smoke/*.smoke.spec.ts` runs against the API dev stack with the seeded data
    of the API 006 quickstart: 30 items for alice, 5 for bob, a domain block entry, a domain rate
    limit and active settings. `scripts/smoke/stack-up.sh` starts the stack's `mail` profile
    (mailpit) and sets `RESTV2_RELEASE_SMTP_HOST=mailpit` and `RESTV2_RELEASE_SMTP_PORT=1025`, so
    that releases deliver. The dev stack has no Rspamd, so a release with learning reports
    "learning failed" (US1-AS6 for real), learning as spam answers `503` and keeps the item, and
    the statistics answer `503` (US8-AS2 for real).
  - **Lighthouse**: `scripts/run-lhci.mjs` gains a `/ng/quarantine` collection with the default
    scenario `quarantine-mailbox-user` (SC-010).
- **Rationale**: Constitution VI and 001-R22 to 001-R26.
- **Alternatives considered**: Mocking Rspamd in the smoke stack was rejected: the smoke suite
  checks the real API, and the dev stack's missing Rspamd exercises real failure paths.
