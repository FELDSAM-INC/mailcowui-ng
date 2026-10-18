# Research: DKIM, MTA-STS and DNS

**Feature**: `specs/010-dkim-mta-sts-dns` | **Date**: 2026-10-18 | **Plan**: [plan.md](./plan.md)

Every open point of the plan is settled here. The order of precedence is the constitution, then
the pinned mailcow-rest-v2 contract, then `docs/conventions.md`, then UI 001's decisions
(`specs/001-sign-in-app-shell/research.md`, cited as "UI 001 Rn"), then best practice. Each entry
has a **Decision**, its **Rationale** and the **Alternatives considered**. Decisions that UI 001
already made are not repeated; this file covers only what UI 010 adds or changes.

---

## 1. Contract and structure

### R1. Contract pin and operations

- **Decision**:
  - UI 010 needs mailcow-rest-v2 commit `32079252d55797d3da4e58ae661e9fb91c51c6f9` ("Register
    KnownProblemType in contract components", 2026-10-18) or a later one.
    - It is the first commit whose contract has every API 010 operation and change: bulk deletion
      (`applyDkimKeyBulkAction`), `overwrite` on generation, `DnsCheck.id` with
      `DnsCheckMessageCode`, `DkimDnsPublicationReasonCode`, `DnsCapabilities.serverHostname`, the
      `RateLimit-*` headers, and `KnownProblemType` listed under `components.schemas` (UI 001 plan
      gap 5, now closed).
    - Its Redocly 2.64.1 bundle has sha256
      `5201f7ed64d3f7c64414ce0a12e261934ce03dee28864374bd589bcd850253b6` and 376 operations.
  - **Bump rule**:
    - UI 002–009 bump the pin before UI 010 is implemented. T002 runs
      `scripts/contract/bump.sh 32079252d55797d3da4e58ae661e9fb91c51c6f9` only when the vendored pin
      is not already that commit or a descendant of it.
    - If the pin is a descendant, T002 keeps it. It checks that the 15 operations and the schemas
      listed in [contracts/README.md](./contracts/README.md) are unchanged, with
      `git -C ../mailcow-rest-v2 diff <A> <B> -- api/modules/dkim api/modules/mta-sts
      api/modules/dns-diagnostics` and the component files those modules reference, where `<A>` is
      `3207925` and `<B>` is the vendored pin.
    - Any difference is a deliberate contract change: regenerate, fix types, run every test
      (constitution I).
  - The 15 operations and the problem types are listed in [contracts/README.md](./contracts/README.md).
- **Rationale**: The pin is the commit SHA, because `info.version` stays `0.1.0` (UI 001 R6). Never
  moving the pin backwards keeps the later features' operations that UI 002–009 already rely on.
- **Alternatives considered**:
  - Pinning a commit before 3207925: rejected, because it lacks bulk deletion, check identifiers or
    the host name.
  - Waiting for a release tag: rejected. None exists, and the constitution allows starting on a
    merged contract.

### R2. Feature area, navigation and routes

- **Decision**:
  - **One feature area** `src/features/dns/` (UI 001 R3), with `dkim/`, `mta-sts/` and
    `diagnostics/` subfolders for the pure logic. Its public `index.ts` exports the routes and the
    four components that UI 002 and 004 mount (R19).
  - **Catalogue**: UI 001's single row `dns` (`/dns`, admin and domain administrator, by 010) is
    replaced by two rows, as FR-001 requires two navigation entries:
    - `dkimKeys` at `/dns/dkim-keys`, labelled `nav.dkimKeys` ("ARC/DKIM keys", legacy
      `admin.dkim_keys`);
    - `mtaStsPolicies` at `/dns/mta-sts-policies`, labelled `nav.mtaStsPolicies` ("MTA-STS
      policies").

    Both rows grant admin `true`, domainAdmin `true` and mailboxUser `false`, with
    `deliveredBy: '010'` and UI 001's classic links (`/admin/system`, `/domainadmin/mailbox`). Both
    start as `placeholder`. US1 flips `dkimKeys` and US4 flips `mtaStsPolicies`, so no entry ever
    leads to "not found" (UI 001 SC-007). The table-driven visibility test is updated with the two
    rows.
  - **Routes** (base `/ng/`, all lazy):

    | Name | Path | `meta.navEntry` |
    |---|---|---|
    | `dns` | `/dns` → redirect to `/dns/dkim-keys` | — |
    | `dkim-keys` | `/dns/dkim-keys` | `dkimKeys` |
    | `dkim-import` | `/dns/dkim-import` (optional `?name=`) | `dkimKeys` |
    | `dkim-key` | `/dns/dkim-keys/:dkimName` | `dkimKeys` |
    | `dkim-copy` | `/dns/dkim-keys/:dkimName/copy` | `dkimKeys` |
    | `mta-sts-policies` | `/dns/mta-sts-policies` | `mtaStsPolicies` |
    | `dns-diagnostics` | `/dns/diagnostics/:diagnosticsName` | `dkimKeys` (same access) |

    Administrator-only pages (import, copy) carry `meta.roles: ['admin']`, so `ShellLayout` renders
    UI 001's `NoAccessState` for domain administrators (UI 002 D4). The API refuses them anyway.
  - **Names in addresses**: the entry's `name`, which is the ASCII form or, for an unused key, the
    exact stored spelling (API `DkimKey.name`). Vue Router percent-encodes it. `names.ts` builds
    every location, so a stored name with upper case, Unicode or `/` round-trips.
  - The import page is outside `/dns/dkim-keys/` so that no name, not even a single-label name
    such as `import`, can collide with it.
- **Rationale**: One area matches the reserved catalogue id and gives UI 002 and 004 one import.
  Two catalogue rows satisfy FR-001 without a second navigation mechanism. Fixed kebab-case
  addresses give UI 014 stable targets.
- **Alternatives considered**:
  - Three feature areas (`dkim`, `mta-sts`, `dns-diagnostics`): rejected. They share the
    capabilities query, the name helpers, the copy and run components and the publication outcome,
    so cross-feature imports would be needed for little gain.
  - One navigation entry with tabs: rejected by FR-001.
  - A route per action (`/dns/dkim-keys/:name/generate`): rejected. Generation is a two-field
    dialog (constitution II allows short dialogs), while import and copy are pages because they
    are long or multi-step.

### R3. Building blocks: reuse first, promote at the second use

- **Decision**: UI 010 reuses the blocks that the plans of UI 001, 002, 004 and 005 create, listed
  in [plan.md](./plan.md#building-blocks-from-earlier-features). T001 confirms their paths in the
  repository.
  - **Reused as they are**:
    - UI 002: `EditableSection`, `useBulkSelection`, `BulkActionBar`, `BulkResultSummary` (with UI
      004's `#item` slot), `ConfirmDialog` `requireTyped`, `useLeaveGuard` and `HistoryLink`;
    - UI 004: `useSequentialCreate`, `DomainNameText`, `SearchField` and `utf8ByteLength`;
    - UI 005: `OneTimeSecretDialog` and `CopyButton`.
  - **Extended**:
    - `OneTimeSecretDialog` gains an optional `download` prop (`{ fileName, mediaType }`), because
      the conventions make the export a shown-once secret;
    - `CopyButton` gains the select-in-place fallback of FR-075 if it lacks one (R6);
    - `useSequentialCreate` gains an `unknown` outcome for the entry in flight when the connection
      drops, if it lacks one (R8, conventions "Bulk actions").
  - **Promoted at their second use** (constitution VIII, UI 001 R3 forbids deep imports):
    - UI 002's feature-local `src/features/domains/domain-name.ts` moves to
      `src/shared/validation/domain-name.ts` and gains a `wildcard` option for MX hosts. UI 002's
      imports are updated, and its tests move with it.
    - UI 005's feature-local `src/features/account/download.ts` moves to
      `src/shared/platform/download.ts` (R13). UI 005's imports are updated.
  - **Kept in the feature**, because only UI 010 uses them, even when it uses them several times:
    - `RecordValue.vue` (a labelled monospace value with a `CopyButton`, R6);
    - `RunResultList.vue` (per-name results of generation and copy runs, R8);
    - `PublicationOutcome.vue`, `MaxAgeField`, `MxHostListField`, `PrivateKeyField`,
      `CopyTargetPicker` and every DNS-specific card.
- **Rationale**: Constitution VIII. The earlier plans were written in parallel with this one, so
  T001 stays the single point where planned names are checked against the code.
- **Alternatives considered**: UI 010's own copy, results list and sequential runner in
  `src/shared/`: rejected, because they would duplicate UI 004 and 005.

---

## 2. Server state

### R4. Capabilities read

- **Decision**:
  - `getDnsCapabilities` is one query `['dns-capabilities']` (`staleTime: 300_000`), read by every
    screen of the feature. It supplies:
    - DKIM: `defaultSelector`, `defaultKeySize`, `allowedKeySizes`, `selectorMaxLength`,
      `privateKeyMaxBytes`, `importKeyLengthMin` and `importKeyLengthMax`,
      `dnsPublicationEnabled`, and `privateKeyExportEnabled` (`null` for domain administrators);
    - MTA-STS: `version`, `modes`, `defaultActive`, `maxAgeMin`, `maxAgeMax` and `mxMaxLength`;
    - diagnostics: `runsPerMinute`, `runTimeoutSeconds` and `serverChecks`;
    - `serverHostname`.
  - Nothing of this is hard-coded (conventions "Where features meet").
  - It is invalidated, and refetched while a DNS screen is open, after these problems:
    - `forbidden` (FR-003, together with UI 001's identity refresh);
    - `dkim-private-key-export-disabled` (US6-AS4);
    - `dkim-dns-publication-disabled` (FR-045).

    The actions then follow the fresh values.
  - While capabilities are loading, actions that depend on them are disabled, not hidden, so the
    layout does not jump. A failed read shows the section error with a retry, and read-only
    content that does not depend on it (lists, entries) still renders.
- **Rationale**: One read with five-minute freshness: the values change only when an operator
  edits server settings, and the refusal paths refresh them at once.
- **Alternatives considered**: Reading capabilities before every form: rejected as needless
  requests (constitution VII).

### R5. Query keys, freshness and invalidation

- **Decision**:
  - **Keys** (full table in [data-model.md](./data-model.md#3-server-state-cache)):
    - `['dkim-keys','list',params]`, `['dkim-keys','detail',name]` and
      `['dkim-keys','copy-targets',{q}]`;
    - `['mta-sts-policies','list',params]` and `['mta-sts-policies','detail',domain]`;
    - `['dns-diagnostics','result',name]`, `['dns-diagnostics','rate-limit']` and
      `['dns-diagnostics','changed',name]`.
  - **Search** uses UI 004's `SearchField`: it runs after a 500 ms pause or on submit, through
    `useListState`'s `replace` (FR-008).
  - **Lists** use UI 001's defaults (`staleTime: 30_000`) plus `placeholderData: keepPreviousData`,
    so paging and filtering never flash a loading state. Returning from an entry shows the cached
    page at once (FR-013). A background refetch happens only when the data is stale, with no
    skeleton. Scroll restoration on Back comes from `scrollBehavior` returning `savedPosition`, and
    the route-change focus on the `<h1>` uses `preventScroll: true` (T027 adds either if UI 002 has
    not).
  - **Mutations** write their result:
    - generation, import, copy, replacement and publication write the `DkimKey` part of the
      response to `['dkim-keys','detail',name]` (for a copy, the target), then invalidate
      `['dkim-keys','list']` and `['dkim-keys','copy-targets']`;
    - a deletion and a bulk deletion invalidate the affected details and both lists;
    - MTA-STS create and update write `['mta-sts-policies','detail',domain]` and invalidate the
      list.
  - The DKIM section of the domain and alias domain pages reads the same detail key as the entry
    page, so every screen shows the change (FR-089).
  - **Diagnostics after an in-app change**: a key or policy change records
    `['dns-diagnostics','changed',name]` (with the domain's alias domains for a policy change).
    A held result older than that change shows a notice that the DKIM key or MTA-STS policy
    changed after the check, with "Run again". No run starts on its own (SC-016).
- **Rationale**: These are UI 001 R9's rules applied to the new resources. Writing the response
  into the detail key avoids a refetch.
- **Alternatives considered**: Invalidating the diagnostics result after a change: rejected. It
  would start a run on the next visit, which SC-016 forbids. The notice tells the user instead.

---

## 3. DKIM

### R6. Copying values to the clipboard (`RecordValue` and `CopyButton`)

- **Decision**:
  - `RecordValue.vue` (feature) renders a labelled value with UI 005's shared `CopyButton`.
    - Props: `label`, `value`, `copyLabel` (the accessible name, for example "Copy record value of
      example.org"), `monospace` and `multiline`.
    - The value is rendered as text in a `<code>` or `<pre>` with `break-all` (`overflow-wrap:
      anywhere`), so 1,000-character values wrap at 360 px (FR-018, SC-005).
  - Copying uses UI 001's `clipboard.ts` (`writeText`), with the exact string that is shown:
    - for the split DKIM form, the quoted, space-separated pieces;
    - for the zone file, the API text byte for byte (SC-003, SC-009).
  - **Success**: the button shows "Copied", and `useAnnouncer` says politely "{label} copied". The
    "Copied" state stays while the button has focus or the pointer, and reverts two seconds after
    it leaves (FR-074).
  - **Refusal or no clipboard API** (FR-075): the value element is made selectable, focused and
    fully selected with `Range`/`Selection`, and an inline message says that it could not be
    copied automatically. `CopyButton` gets a `selectTarget` prop (an element ref) for this, if it
    lacks such a fallback (T022).
  - The button is at least 44 × 44 px with a visible text label on wide screens and an icon with
    an accessible name on phones.
- **Rationale**: One shared button and one feature wrapper make all copy behaviour of SC-003 and
  FR-075 testable in one place.
- **Alternatives considered**: `document.execCommand('copy')` as a fallback: rejected as
  deprecated. Selecting the text for the user is the reliable fallback.

### R7. DKIM record presentation

- **Decision** (`dkim/record.ts`):
  - **Record name**: `key.record.name` as returned.
  - **Host label**: `${key.selector}._domainkey`, the label that DNS providers ask for inside the
    zone.
  - **Value**: `key.record.value` as returned.
  - **Split form**: `key.record.valueParts.map(p => `"${p}"`).join(' ')`. DKIM values contain no
    `"`, and the contract guarantees pieces of at most 255 characters.
  - **Form switch**: a two-option radio group, "One text" or "Split into 255-character pieces",
    on Reka `RadioGroup`, which UI 001 copied. The copy button copies the form shown (FR-017). The
    choice is local state and starts at "One text".
  - **Incomplete key**: the entry shows "Incomplete", the missing parts translated (`publicKey`,
    `selector`, `privateKey`), that it is not used for signing, and how to repair it. For
    administrators these are delete, import with overwrite or replace; for domain administrators,
    to ask an administrator. A `record` of `null` shows "No record can be published until the key
    is complete".
  - Selectors, record values and public keys use the monospace font (FR-018).
- **Rationale**: These are exactly the API's fields, with no recomputation beyond the quoting that
  FR-016 asks for.
- **Alternatives considered**: Showing both forms at once: rejected by FR-017 ("one form at a
  time") and for length on phones.

### R8. Runs on several names: generation and copy

- **Decision**:
  - Runs use UI 004's `useSequentialCreate(entries, send, classify)`: one request at a time, in the
    given order. Each entry ends `created`, `refused` or `notProcessed`. UI 010 adds `unknown` for
    the entry in flight when the connection drops, if the composable lacks it (R3). The feature's
    `dkimRunClassifier` decides which refusals concern only one name and which stop the run:

    | Refusal | Scope | Result shown |
    |---|---|---|
    | `409 dkim-key-exists` | entry, continue | "Already has a key" (generation); "Has a key now" (copy target) |
    | `404` | entry, continue | "No longer exists" |
    | `422` whose `errors` keys are all `name` or `target` | entry, continue | the translated rule |
    | `409 about:blank` (copy source incomplete) | form, stop | "The source key is incomplete and cannot be copied" |
    | `422` on `selector` or `keySize`, `403` of any type, `503 temporary-failure`, any other or unknown problem | form, stop | the problem at its field or in the summary; the remaining names become `notProcessed` |
    | network failure, or a non-problem 5xx | form, stop | the entry in flight is `unknown` ("outcome unknown", never retried on its own); the remaining names become `notProcessed` |

    A failure that would affect every remaining name stops the run instead of repeating it. The
    spec's FR-041 was aligned with this.
  - **Results**: `RunResultList.vue` (feature) lists every name with its outcome, a translated
    reason, and, for created keys, `PublicationOutcome` and a link to the entry. It offers "Retry"
    for the refused, unknown and not-processed names only. An `unknown` generation that did succeed
    answers `409` on retry, which is reported as "already has a key".
  - **Generation for a selection** opens `GenerateKeyDialog` with the selected names. Entries that
    already have a key are listed as skipped (FR-040). A single name opens its entry afterwards
    (US2).
  - **Generation for all names without a key** (FR-024):
    1. The app pages through `listDkimKeys` with `state=missing`, the current `q` and `kind`,
       `sort=name`, `order=asc` and `limit=1000`, until `offset ≥ total`.
    2. The confirmation states the count and the filters, and lists the first 10 names and "and N
       others".
    3. The run goes in name order.

    The collection pages are not cached: they are a one-off read.
  - **Progress announcements**: politely at the start, at each 10 % step (at most 10
    announcements), and at the end with the counts. The visible progress bar has
    `role="progressbar"` with `aria-valuenow`.
  - **Leaving during a run** (FR-042): UI 002's `useLeaveGuard` is armed while the run is pending
    ("the remaining N names will not be processed"). Confirming stops the run, and the remaining
    names become `notProcessed`.
  - The generation run is shown in `RunDialog` (full-screen sheet below `md`). It does not close
    with Escape while running (FR-085), and it offers "Stop", which lets the current request finish.
  - **Copy runs**: the same composable on the copy page, one `copyDkimKey` per target.
    - A target with a key is sent with `overwrite: true` and `If-Match: <target etag>`, and only
      after explicit agreement (R10).
- **Rationale**: Creation is one object per request (API conventions), and UI 004 already built
  the runner. Stopping at run-wide failures follows UI 004 R9 and avoids sending a doomed request
  for each of up to hundreds of names. SC-011 ("50 names, retry only the failed") is unit-tested on
  the classifier and the runner.
- **Alternatives considered**:
  - A separate runner that always continues: rejected. It would duplicate UI 004 and repeat
    failures that affect every name.
  - Parallel requests: rejected. Order and readable progress matter more than speed, and parallel
    generations would compete for the API's per-name serialisation (API FR-053).

### R9. Deleting keys: single and bulk

- **Decision**:
  - **Single** (FR-037–FR-039): `DeleteKeyDialog` on UI 001's `ConfirmDialog`.
    - It shows the readable and ASCII name, kind, selector, key length, the signing impact for
      domains and alias domains, that the private key is deleted permanently, and the
      publication-dependent DNS sentence.
    - With publication enabled, that sentence says that the outcome is recorded in the history
      (spec plan gap 3), with a History link for administrators.
    - It sends `deleteDkimKey` with `If-Match`.
    - A `412` refetches the entry and shows the dialog again with the fresh impact (conventions: a
      refused deletion is confirmed again). A `404` says that the key no longer exists and
      refreshes.
    - On success, a domain or alias domain entry shows "Key missing". An unused key returns to the
      list.
  - **Bulk** (FR-040, FR-092): selection mode with `useBulkSelection` and `BulkActionBar` (UI 002)
    on the current page.
    - `BulkDeleteDialog` lists every selected entry with a key (kind, selector), marks the domains
      and alias domains whose mail stops being signed, lists entries without a key as skipped, and
      requires the number of keys to be typed (`requireTyped`, conventions).
    - It sends `applyDkimKeyBulkAction` with `{ action: 'delete', targets: [{ id: name, version:
      etag }] }`. At most 100 targets: the page size limit and `limits.ts` `dkimBulkTargets`
      (plan gap 2).
    - The results go to `BulkResultSummary`:
      - `done`, `notFound`, `refused`, `outdated` and `failed` are translated;
      - with publication enabled, each done row shows its `meta.dnsPublication[id]` outcome in the
        `#item` slot;
      - failed, refused and outdated rows stay selected;
      - the list is refetched, so a retry carries fresh version tags;
      - a dropped connection shows "outcome unknown" for every target and is never resent on its
        own.
- **Rationale**: This follows the conventions' bulk rules and the API's documented operation
  exactly.
- **Alternatives considered**:
  - Single deletions in a loop: rejected now that the API has the bulk operation (conventions:
    "The UI sends the API's bulk operation").
  - Keeping the acknowledgement checkbox: rejected by the conventions (owner question 1 in the
    plan).

### R10. Replacing a key, importing over a key, copying over a key

- **Decision**:
  - **Replace with a new key** (FR-090; administrators, entry with a key, including incomplete
    keys):
    - `ReplaceKeyDialog` reuses the generation fields. The selector starts with the server's
      default, and a hint recommends a selector different from the current one, so that the old
      and new records can coexist while DNS updates.
    - The confirmation names the current selector and length, and says that:
      - the old key, including its private key, is replaced in one step, so mail stays signed;
      - the published record must be updated with the new value, unless the publication is
        enabled.
    - It sends `generateDkimKey` with `overwrite: true` and `If-Match`. `200` updates the entry. A
      `412` refetches and asks again.
  - **Import with overwrite** (FR-030): when the entry has a key and overwrite is on, a
    confirmation names the selector and length and the same consequences. It is sent with
    `If-Match`.
  - **Copy over a key** (FR-035): the picker marks targets with a key and their selector. Before
    the run, one confirmation lists the targets that will be overwritten and says that their old
    keys, including private keys, are removed completely. Only then are those targets sent with
    `overwrite: true` and their `If-Match`.
- **Rationale**: Overwrites are destructive: one explicit confirmation that shows what is affected
  (constitution II, conventions).
- **Alternatives considered**: A per-target overwrite checkbox in the picker: rejected as easy to
  miss on a phone. One summary confirmation is clearer.

### R11. Private key import without leaking the key

- **Decision**:
  - **Where the key lives**: only in `DkimImportPage`'s local `ref`.
    - It is never put in Pinia, a query, a TanStack mutation (`useMutation` keeps `variables` in
      the mutation cache until `gcTime`), the route, history state or storage.
    - UI 005's `useSecretMutation` strips secrets from *responses*. It does not cover a secret in
      the request, so the import does not use it.
    - UI 004's `useFormDraft` is not used on the import page, so a session end never saves the key
      into the draft registry.
    - The request is a direct call, `api.POST('/dkim-keys/{dkimName}/import', …)`, wrapped by the
      feature's `api/dkim-secrets.ts` (`importKey`), which has its own `pending` ref. After
      success it writes only the non-secret `DkimKeyChangeResult` into the cache.
  - **Field** (`PrivateKeyField.vue`): a `<textarea>` with:
    - `autocomplete="off"`, `autocapitalize="none"`, `autocorrect="off"` and `spellcheck="false"`;
    - a "Choose file" button: `<input type="file" accept=".pem,.key,.txt,text/plain">`. The size
      is checked against `privateKeyMaxBytes` before `FileReader.readAsText`, and the file input is
      reset after reading.
  - **Size check**: the shared `utf8ByteLength(text) ≤ privateKeyMaxBytes` (UI 004 or UI 005). An empty
    text is refused before sending (FR-029). Windows line endings and blank lines are sent
    unchanged (the API normalises them).
  - **Lifecycle**:
    - after success, the text is cleared and the page is replaced by the entry;
    - after a refusal, the text is kept (FR-033);
    - when leaving with entered values, `useLeaveGuard` asks, and on confirmation the text is
      cleared;
    - on `pagehide`, the text is cleared, so a back-forward cache restore shows an empty field.

    A reload loses everything, because nothing is stored.
  - **Errors**:
    - field messages come from rule codes: `invalidPrivateKey`, `encryptedPrivateKey`,
      `unsupportedKeyType` (`allowed`), `keyLengthOutOfRange` (`min`, `max`), `tooLong` with
      `unit: bytes` and `required`;
    - the API never echoes the key, and the app never shows `detail`;
    - `dkimName` errors (`invalidFormat`, `format: domainName`) are mapped to the name field;
    - `409 dkim-key-exists` puts the translated error on the name field, with "Switch on
      overwrite" (FR-031).
  - **Name lookup**: once the typed name passes the syntax check (debounced 400 ms), `getDkimKey`
    reads its entry.
    - `200` with a key shows "This name has a key (selector, length)", and the version tag is kept
      for `If-Match`.
    - `404` shows that the key will be listed as unused until the domain or alias domain exists.

    The lookup is a normal query: it carries no secret.
- **Rationale**: Constitution V and FR-076 forbid persisting the key. The TanStack mutation cache
  is in memory, but it outlives the form, so the plan avoids it.
- **Alternatives considered**:
  - `useMutation` with `gcTime: 0`: rejected. `variables` stay in the cache while the observer is
    mounted, and devtools expose them.
  - A masked password field: rejected by the spec clarification.

### R12. Private key export dialog

- **Decision**:
  - The action appears only for administrators while `privateKeyExportEnabled` is `true` (FR-077).
  - It asks first through `useConfirm`: the private key lets its holder sign mail for the name, and
    the export is recorded.
  - The request is a direct call, `api.GET('/dkim-keys/{dkimName}/private-key')`, in
    `api/dkim-secrets.ts` (`exportKey`). It is not a query, so the key never enters the cache.
  - The result opens `OneTimeSecretDialog` (UI 005) with:
    - the key in a read-only, monospace `<textarea>`;
    - "Copy";
    - "Download", saving `<selector>.<ASCII name>.pem` (`application/x-pem-file`) through R13.

    Closing without a copy or download asks for confirmation (conventions "Secrets"). Closing
    clears the `ref`. Opening again needs a new confirmed export, which the API audits again.
  - **Refusals**:
    - `403 dkim-private-key-export-disabled` shows the translated message, invalidates the
      capabilities and removes the action (US6-AS4);
    - `404` says that the key no longer exists;
    - `503` says that nothing was read, with a retry.
  - **While disabled**: administrators see "Private key export is turned off on this server" on
    the entry, and domain administrators see nothing (FR-002).
- **Rationale**: These are the spec clarification plus the conventions' secret rule. The file
  name comes from the API's `name` and `selector`, made file-safe (R13).
- **Alternatives considered**: Showing the key inline on the entry page: rejected. It would stay in
  the DOM and be easy to leave behind.

### R13. Text downloads under the strict CSP

- **Decision**: UI 005's `download.ts` (Apple profiles, through a revoked object URL) is promoted
  to `src/shared/platform/download.ts` at this second use. It exports `downloadText(text, fileName,
  mediaType)`, which T023 adds if the promoted module has only a Blob variant:
  1. It creates `new Blob([text], { type: `${mediaType};charset=utf-8` })` and
     `URL.createObjectURL(blob)`.
  2. It clicks a detached `<a download="…" href="blob:…">`.
  3. It revokes the URL in a `setTimeout(…, 0)`.

  The file is written byte for byte, with no BOM and no newline conversion (SC-009). File names
  use the API's ASCII name; any character outside `[A-Za-z0-9._-]` becomes `_`. A legacy unused
  key may have such a name:
  - zone file: `<ASCII name>.txt`, `text/plain`;
  - private key: `<selector>.<ASCII name>.pem`.
- **Rationale**: A top-level navigation to a `blob:` URL for a download is not governed by CSP
  fetch directives, while `data:` navigations are blocked by browsers and `build.assetsInlineLimit:
  0` keeps the app free of `data:` (UI 001 R18). iOS Safari 13+ honours `download` for `blob:`.
- **Alternatives considered**:
  - The `showSaveFilePicker` API: rejected, because Safari and Firefox lack it.
  - A server download endpoint: none exists in the contract.

---

## 4. DNS diagnostics

### R14. Run lifecycle

- **Decision** (`api/diagnostics.ts`):
  - **Query**: `['dns-diagnostics','result',name]`, with `staleTime: 600_000` and `gcTime:
    600_000`, `retry: false`, and `refetchOnMount: true` only when stale.
    - Opening the page starts a run unless a result under 10 minutes old is held (FR-058, SC-016).
    - "Run again" calls `refetch()`.
    - Results stay in memory and are cleared by `queryClient.clear()` at sign-out (UI 001 R9).
  - **Not cancelled when leaving**: the query function does **not** pass TanStack's `signal` to
    the request. A run whose page was left completes and is kept for its own name only, because
    the key is per name.
  - **Client timeout** (spec FR-058; a deliberate exception to UI 001 R8's "no client-side
    timeout"):
    - its own `AbortController`, aborted by `setTimeout` after `runTimeoutSeconds + 15` seconds
      (45 s with the default 30);
    - `setTimeout` rather than `AbortSignal.timeout`, so that Playwright's `page.clock` controls it
      in tests;
    - the abort becomes a `timeout` error state with "Run again".
  - **The previous result stays visible** after a timeout, a 429, a network error or a server error.
    TanStack keeps `data` when a refetch fails. The error shows as a notice above the result.
  - **Rate limit** (FR-066, FR-091, `diagnostics/rate-limit.ts`):
    - every response's `RateLimit-Remaining` and `RateLimit-Reset` are written to
      `['dns-diagnostics','rate-limit']` as `{ remaining, resetAt }`;
    - a `429` writes `{ remaining: 0, resetAt: now + retryAfter }` from `ApiProblem.retryAfter`;
    - when `remaining ≤ 3`, the page shows "N checks left this minute";
    - when `remaining` is 0 and `resetAt` is in the future, "Run again" is disabled with
      "Available again in {time}". `useCountdown` drives it, and it is announced once when it
      becomes available again (FR-084).

    The state lives in the query cache, so sign-out clears it.
  - **States**:
    - running: progress, and "can take up to {runTimeoutSeconds} seconds";
    - result;
    - error: translated, with "Run again";
    - not found: UI 001's `NotFoundPage` content on `404`.

    A second run cannot start while one is running (FR-058).
  - **Announcements**: "Checking DNS for {name}…" at the start. At the end, the summary counts
    ("12 correct, 2 need attention, 1 not verified"), politely and without moving focus (FR-084).
- **Rationale**: These are FR-058's rules with TanStack's per-key cache, which also satisfies the
  edge case "result arriving after the user moved to another name".
- **Alternatives considered**:
  - A Pinia store of results: rejected. Server-derived data belongs in the query cache, and
    `clear()` at sign-out comes for free.
  - Polling `RateLimit-Reset`: rejected (no automatic requests).

### R15. Translating checks, statuses and messages

- **Decision**:
  - **Purpose from `DnsCheck.id`** (`diagnostics/check-labels.ts`). The key is
    `dns.diagnostics.checks.<key>`:

    | `id` | Label key | Example label |
    |---|---|---|
    | `a` | `serverIpv4` | Server address (IPv4) |
    | `ptr:ipv4` | `reverseIpv4` | Reverse name (IPv4) |
    | `aaaa` | `serverIpv6` | Server address (IPv6) |
    | `ptr:ipv6` | `reverseIpv6` | Reverse name (IPv6) |
    | `tlsa:25` | `tlsa25` | TLSA for SMTP (port 25) |
    | `mx` | `mx` | Mail exchanger |
    | `autodiscover` | `autodiscover` | Autodiscover |
    | `srv:autodiscover` | `autodiscoverService` | Autodiscover service |
    | `autoconfig` | `autoconfig` | Autoconfig |
    | `mta-sts` | `mtaStsHost` | MTA-STS host |
    | `mta-sts-record` | `mtaStsRecord` | MTA-STS record |
    | `tls-rpt` | `tlsReporting` | TLS reporting |
    | `spf` | `spf` | SPF |
    | `dmarc` | `dmarc` | DMARC |
    | `dkim:<selector>` | `dkimSelector` with `{selector}` | DKIM (selector {selector}) |
    | `dkim` | `dkim` | DKIM |
    | `srv:pop3`, `srv:pop3s`, `srv:imap`, `srv:imaps`, `srv:submission`, `srv:smtps`, `srv:sieve` | `service` with the translated service name | IMAPS service |

    Any other identifier (later releases add some) is labelled
    `dns.diagnostics.checks.generic` ("{type} record") with the record name below it.
  - **Status labels and summary groups** (`diagnostics/summary-groups.ts`): a pure function
    `summaryGroup(status, optional)` implements the FR-060 table. The summary counts are computed
    from the checks shown. A unit test asserts that the per-status totals equal the API's `summary`
    for every fixture (SC-008).

    | Group | Presentation |
    |---|---|
    | Needs attention | Problem: error colour plus icon and text |
    | Not verified | Warning |
    | OK | Positive |
    | Optional, not set | Neutral |

    Every badge carries its text (FR-086).
  - **Messages** (`diagnostics/check-messages.ts`): `messageView(message)` returns
    `{ key, params, link? }` for every `DnsCheckMessageCode` (key `dns.diagnostics.messages.<code>`).
    - Parameters are formatted per locale:
      - numbers: `timeoutSeconds`, `count`, `limit`, `hours`, `port`;
      - lists with `Intl.ListFormat`: `ipv4` and `ipv6` lists;
      - translated enumerations: `cause` (`connectionFailed`, `timeout`, `starttlsRefused`,
        `tlsHandshakeFailed`, `noCertificate`), `result` (`fail`, `softfail`, `neutral`, `none`,
        `permerror`, `temperror`) and `family`;
      - shown verbatim as code: `host`, `target`, `address` and `record`.
    - `url` is never interpolated into text. It becomes a separate "Learn more" link, rendered
      only when `safeHref` accepts it, with `target="_blank" rel="noopener noreferrer"`.
    - **Unknown codes**: the contract says to show `message`. The app shows the translated
      `dns.diagnostics.messages.unknown` ("Further detail, in English:") followed by `message` in a
      `<span lang="en">` as plain text (constitution IV with the contract's rule). This is
      unit-tested with plain values, because the closed enumeration cannot be mocked (UI 001 R22).
  - **Placement**:
    - `reason` is shown under the status;
    - `notes` are shown as notes, for example `matchedByAddressRecords` uses the legacy
      `diagnostics.cname_from_a` text and lists the addresses;
    - `guidance` replaces the expected value for checks with `expected: null`.

    SPF guidance gives FR-063:
    - `spfAuthorizeAddresses` shows the IPv4 and, if present, the IPv6 address, each in a
      `RecordValue`;
    - `spfSuggestedRecord` shows the record in a `RecordValue`;
    - `spfSyntaxReference` becomes a link.

    Result-level notes appear in the facts area: `noPublicIpv6`, `serverChecksOmitted`, and
    `propagationDelay`, which is the legacy 24-hour notice.
  - **Grouping and order**:
    - checks keep the API's order;
    - checks with `scope: server` are grouped under "Server-wide records" (administrators,
      `serverChecksIncluded`) and the rest under the name's records (FR-059);
    - the filter "Only checks that need attention or were not verified" is local state (FR-062).
  - **Values found**: each is shown as text in a `<code>` element. An empty list shows "No record
    found". Markup and control characters are shown literally (FR-078). Control characters are made
    visible as `\u{XXXX}` escapes, so they cannot reorder text (bidi controls).
- **Rationale**: The codes and identifiers are the contract's stable interface (API 010 FR-044).
  Unknown identifiers and codes are expected by the contract ("later releases may add").
- **Alternatives considered**: Labelling by record type only (the spec's gap-1 fallback): no longer
  needed.

### R16. Publication outcomes

- **Decision**:
  - `PublicationOutcome.vue` (foundational, used by US2, US5 and US7) renders a
    `DkimDnsPublicationOutcome` only while `dnsPublicationEnabled` is `true` (FR-043):
    - status labels:
      - `published`: "Published to the DNS zone";
      - `removed`: "Removed from the DNS zone";
      - `noRecordToRemove`: "No record to remove";
      - `noZone`: "No DNS zone found for this name", with "Publish the record manually" and the
        record's copy buttons, or a link to the entry from a run result;
      - `failed`: "Not published", with "The key works; the record can be published again";
      - `notConfigured`: "Publication is not configured".
    - for `failed`, the reason is translated from `reason.code`. An unknown code shows the
      generic failure. `reason.detail`, when present, is shown as "Technical detail" in a
      `<span lang="en">` as plain text (FR-044).
  - `PublishAgainAction.vue` (US7, administrators) sends `publishDkimDnsRecord` with `If-Match`.
    - It is offered on the entry page and on every `failed` or `noZone` outcome.
    - `403 dkim-dns-publication-disabled` invalidates the capabilities and removes the action
      (FR-045).
    - `412` refetches and offers to try again.
- **Rationale**: These are the contract's statuses and reason codes, with unknown values tolerated
  as the contract asks.
- **Alternatives considered**: None.

---

## 5. MTA-STS

### R17. MTA-STS section, form and list

- **Decision**:
  - **Section** (`DomainMtaStsSection.vue`, mounted on the domain page with `id="mta-sts"`). It
    reads `['mta-sts-policies','detail',domain]`; a `404` there means "no policy" for a domain the
    page already resolved. It shows:
    - the active badge, version, mode, MX hosts, maximum age (R18), policy identifier and policy
      address (link, new tab, FR-078);
    - the policy text in a `<pre>` `RecordValue`;
    - the two records from `dnsRecords`, each with name and value copy buttons.

    The page's History link is for administrators.
  - **Editing** uses UI 002's `EditableSection`: in place on wide screens, full-screen below `md`.
    - The fields are those of FR-047:
      - version as the fixed text `STSv1`;
      - mode as a radio group with the explanation of each mode visible;
      - `MxHostListField`;
      - `MaxAgeField`;
      - the active switch with the legacy explanation.
    - Set-up defaults:
      - mode `testing`;
      - maximum age 1 week;
      - MX hosts `[serverHostname]` (plan spec change 6);
      - active `capabilities.mtaSts.defaultActive`, which is `false`.
    - The set-up explanation of FR-051 is shown next to the form.
    - Create sends `createMtaStsPolicy`. Change sends `updateMtaStsPolicy` (`application/merge-patch+json`)
      with only the changed members and `If-Match`.
    - `412`: UI 002's flow keeps the input, reloads, marks every changed value with its new saved
      value, and offers "save again" or "discard" (FR-049).
    - `409 mta-sts-policy-exists` on create (another user created it): reload the policy and switch
      to editing it, keeping the input as unsaved changes.
  - **Identifier change** (`mta-sts/policy-change.ts`): after a save, `before.policyId !==
    after.policyId` triggers the success message with the old and new identifier and the
    `_mta-sts` update instruction. The `_mta-sts.<domain>` record is highlighted (a border plus
    the text "Update this record") until the user leaves the page (FR-050). Saves that change only
    `active`, or nothing, keep the identifier, so no message is shown (SC-015).
  - **Activate and Deactivate**: direct buttons next to Edit, each patching only `{ active }` with
    `If-Match`.
    - Deactivation asks through `useConfirm` with the three consequences of FR-052.
    - Activation shows the FR-051 notice in its success message.
  - **Alias domain section** (`AliasDomainMtaStsSection.vue`): names the target domain, links to
    its domain page at `#mta-sts`, and says that the alias domain publishes the target's policy. It
    offers no editing (FR-022). It reads nothing: the alias domain page already knows its target.
  - **Leaving** the form with unsaved changes asks through `useLeaveGuard` (FR-053).
  - Links to the section use UI 002's route `domain-detail` with the hash `#mta-sts`. Opening the
    form directly uses UI 002's `edit=<section>` address parameter, with the section key `mta-sts`.
  - **Policy list** (`MtaStsPoliciesPage.vue`):
    - `useListState` with `q`, `active`, `mode`, `sort` (`domain`, `mode`, `maxAge`, `policyId`),
      `order`, `page` and `size`;
    - cards below `md` and a table from `md` up;
    - opening an entry goes to the domain page with hash `#mta-sts`;
    - the no-policies state explains that policies are set up from a domain's page, with a link to
      the domain list (FR-054–FR-056).
- **Rationale**: These are UI 002's section-editing rules (conventions) applied to the policy.
  Identifier detection uses the API's values, never a client guess.
- **Alternatives considered**:
  - A separate policy page: rejected. FR-047 places the form in the domain page's sections.
  - Inferring the identifier change from the changed fields: rejected. The API is authoritative,
    including the no-op case.

### R18. Maximum age with units, and MX host entry

- **Decision**:
  - **Maximum age** (`mta-sts/max-age.ts`):
    - Units: week 604,800 s, day 86,400 s, hour 3,600 s, minute 60 s, second 1 s.
    - `toLargestUnit(seconds)` picks the largest unit that divides exactly. 604,800 s is 1 week,
      86,400 s is 1 day and 31,557,600 s is 8,766 hours.
    - `toSeconds(value, unit)` computes the seconds.
    - Display uses `Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'long' })`.
      `week`, `day`, `hour`, `minute` and `second` are sanctioned units.
    - `MaxAgeField` has a whole-number input (`inputmode="numeric"`, `pattern="[0-9]*"`) and a
      native unit `<select>`.
    - The check: a whole number of at least 1, and `capabilities.mtaSts.maxAgeMin ≤ seconds ≤
      maxAgeMax`.
    - An error names the limit in the chosen unit when it is exact, otherwise in seconds
      ("at most 8,766 hours").
  - **MX hosts** (`mta-sts/mx-hosts.ts`, `MxHostListField.vue`):
    - An entry is added with Enter, comma or the "Add" button, and removed with its own labelled
      button ("Remove mail.example.org"). Pasting a comma-separated list adds each item.
    - Each entry is trimmed. One trailing dot is removed (spec edge case). The entry is checked
      with the promoted `src/shared/validation/domain-name.ts` with the wildcard option (`*.`
      prefix, R3).
    - The ASCII form for length checks comes from `new URL('http://' + host).hostname`, the
      browser's UTS #46 conversion.
    - A case-insensitive duplicate is dropped, keeping the first spelling, with a polite
      announcement.
    - The joined ASCII length (comma-separated) must be at most `mxMaxLength`. It is shown as
      "used/limit" once it reaches 90 % (FR-048).
    - At least one entry is required.
    - Server errors at `mxHosts.<i>` map to the entry, and `mxHosts` errors map to the field.
- **Rationale**: These follow FR-047 and FR-048. The URL parser gives IDN conversion with no
  dependency (constitution VIII).
- **Alternatives considered**: A punycode library: rejected (VIII). A free-text textarea, as in
  legacy: rejected by FR-047.

---

## 6. Cross-cutting

### R19. Entry points into UI 002 and UI 004 screens

- **Decision**: `src/features/dns/index.ts` exports:
  - `DomainDkimSection` (props `name`, `kind`): the key state, selector, length, the record with
    copy buttons, a link to the entry, "Generate a key" when the key is missing, and on the domain
    page "DKIM keys of this domain and its alias domains" (`/dns/dkim-keys?domain=<name>`, FR-012,
    FR-021);
  - `DomainMtaStsSection` (prop `domain`);
  - `AliasDomainMtaStsSection` (props `aliasDomain`, `targetDomain`);
  - `CheckDnsAction` (prop `name`; variants `menuItem` and `button`), which links to
    `/dns/diagnostics/<name>` (FR-023).

  They are placed in the action areas of UI 002 data-model §9 and in UI 004's alias domain card,
  table and detail page (plan table):
  - the domain page's section list after Groupware: DKIM, then MTA-STS;
  - the domain page's header actions and the domain list's entry actions menu: "Check DNS";
  - the alias domain detail page: DKIM and the MTA-STS (target) section, plus "Check DNS" in its
    page actions;
  - the alias domain card and table: "Check DNS".

  The sections are exported as async components (`defineAsyncComponent`), so the domain page chunk
  does not grow with DNS code.

  UI 002's and UI 004's creation reports already link to "the DKIM keys screen of UI 010" when
  `isEntryAvailable(...)` holds. UI 001 named the catalogue row `dns`, so T021 replaces every
  `'dns'` catalogue reference with `'dkimKeys'`. The id union of `NavigationEntry` makes the
  compiler find each one, and those links go live with US1.

  Domain administrators see the same sections, with only the actions that FR-002 grants. Before
  UI 010, those screens show nothing for DNS (conventions), and UI 010 changes only their
  designated areas.
- **Rationale**: These are the conventions' "Where features meet" rules. Lazy components keep UI
  002's budgets.
- **Alternatives considered**: UI 010 routes that wrap the domain page: rejected, because they
  would duplicate UI 002's page.

### R20. History

- **Decision**:
  - `HistoryLink` (UI 002) is shown to administrators on:
    - the DKIM entry page: `targetType=dkimKey`, `targetId=<entry name>`;
    - the domain page's MTA-STS section: `targetType=mtaStsPolicy`, `targetId=<domain>`.

    The audit log screen offers both target types in its target-type filter.
  - `src/features/audit-log/labels.ts` gains the eight event types (`dkimKeyGeneration`,
    `dkimKeyImport`, `dkimKeyCopy`, `dkimKeyDeletion`, `dkimPrivateKeyExport`,
    `dkimDnsPublication`, `mtaStsPolicyCreation`, `mtaStsPolicyUpdate`) and the two target types
    (`dkimKey`, `mtaStsPolicy`).
  - Refusals show the shared `AuditFailureReason` label (`permissionDenied`, `notFound`,
    `versionOutdated`, `validationFailed`, `conflict`, `featureDisabled`, `temporaryFailure`).
  - `details` are rendered by UI 001's generic `AuditEventDetails`: keys as written and values as
    text, recursively. No key is interpreted (plan gap 1). The private key never appears, because
    the API never writes it. US8 asserts that no PEM armour appears in the rendered history.
- **Rationale**: Conventions "History". Interpreting undocumented keys would rely on behaviour
  outside the contract (constitution I).
- **Alternatives considered**: Translating the keys documented in API research R22: rejected
  until the contract lists them.

### R21. Errors and problem types of this feature

- **Decision**: In addition to UI 001's mapping:

  | Problem | Where | App behaviour |
  |---|---|---|
  | `409 dkim-key-exists` | generation (single), import, copy | Single generation: "{name} already has a key", then the entry is refreshed (FR-028). Run item: `exists`. Import: name-field error with "Switch on overwrite" (FR-031). Copy: target result "has a key now", with retry offering overwrite. |
  | `409 about:blank` | copy | "The source key is incomplete and cannot be copied" |
  | `409 mta-sts-policy-exists` | create policy | Reload and switch to editing (R17) |
  | `403 dkim-private-key-export-disabled` | export | Message, refresh capabilities, remove the action |
  | `403 dkim-dns-publication-disabled` | publish again | Message, refresh capabilities, remove the action |
  | `403 forbidden` | any | UI 001 handling plus capabilities refresh; actions recomputed; unsaved input kept (FR-003) |
  | `404 about:blank` | entry, diagnostics, policy page section | Entry and diagnostics: the not-found page with a way back (FR-004). Section: "no policy". Action on a vanished key: "no longer exists" and refresh. |
  | `412 about:blank` | delete, replace, import or copy over a key, publish again, policy change | Refetch, show fresh data, confirm again or mark changed values (FR-039, FR-049) |
  | `422 validation-failed` | forms | Field errors from rule codes (FR-072). Paths: `selector`, `keySize`, `name` (generation), `privateKey`, `dkimName` (import name), `target` (copy), `targets` (bulk `tooMany`), `mode`, `maxAge`, `mxHosts`, `mxHosts.<i>`, `version`. |
  | `429 too-many-requests` | diagnostics | Keep the result, countdown from `retryAfter`, "Run again" disabled (FR-066) |
  | `503 temporary-failure` | DKIM operations | "Nothing was changed. Try again in {retryAfter}." Retry keeps the input (FR-073). |

  Messages never show `title`, `detail` or `errors[].message` (UI 001 FR-075).
- **Rationale**: These are the contract's documented problems for these operations
  (`docs/problems.md`).
- **Alternatives considered**: None.

### R22. Translations

- **Decision**:
  - **Namespaces**: `dns.common`, `dns.dkim`, `dns.mtaSts`, `dns.diagnostics`, `dns.publication`
    and `dns.capabilities`, plus `nav.dkimKeys` and `nav.mtaStsPolicies`, `auditLog.events.*` and
    `auditLog.targets.*` for 010 values, `problem.<name>` for the four 010 types, and
    `validation.<code>` and `validation.format.<format>` for `dkimSelector`, `domainName` and
    `mxHost`. The `common.copy.*` keys of `CopyButton` are added only if UI 010 creates it.
  - **Legacy reuse** through `src/i18n/legacy-map.json`, checked against the upstream baseline
    `2026-09a`:

    | App key | Legacy key |
    |---|---|
    | `nav.dkimKeys`, `dns.dkim.title` | `admin.dkim_keys` |
    | `dns.dkim.states.valid` | `admin.dkim_key_valid` |
    | `dns.dkim.states.missing` | `admin.dkim_key_missing` |
    | `dns.dkim.states.unused` | `admin.dkim_key_unused` |
    | `dns.dkim.fields.selector` | `admin.dkim_domains_selector` |
    | `dns.dkim.fields.keySize` | `admin.dkim_key_length` |
    | `dns.dkim.generate.title` | `admin.dkim_add_key` |
    | `dns.dkim.import.title` | `admin.import_private_key` |
    | `dns.dkim.fields.privateKey` | `admin.private_key` |
    | `dns.dkim.import.overwrite` | `admin.dkim_overwrite_key` |
    | `dns.dkim.copy.title` | `admin.duplicate_dkim` |
    | `dns.dkim.copy.source` | `admin.dkim_from` |
    | `dns.dkim.copy.targets` | `admin.dkim_to` |
    | `dns.dkim.results.saved` | `success.dkim_added` (`{0}`) |
    | `dns.dkim.results.removed` | `success.dkim_removed` (`{0}`) |
    | `dns.dkim.results.copied` | `success.dkim_duplicated` (`{0}`, `{1}`) |
    | `dns.dkim.results.exists` | `danger.dkim_domain_or_sel_exists` (`{0}`) |
    | `common.copy.done` (only if T022 creates `CopyButton`) | `admin.copy_to_clipboard` |
    | `nav.mtaStsPolicies` (prefix) and `dns.mtaSts.title` | `edit.mta_sts` |
    | `dns.mtaSts.fields.version` | `edit.mta_sts_version` |
    | `dns.mtaSts.fields.mode` | `edit.mta_sts_mode` |
    | `dns.mtaSts.fields.maxAge` | `edit.mta_sts_max_age` |
    | `dns.mtaSts.fields.mxHosts` | `edit.mta_sts_mx` |
    | `dns.mtaSts.fields.mxHostsHelp` | `edit.mta_sts_mx_info` |
    | `dns.mtaSts.fields.activeHelp` | `edit.mta_sts_active_info` |
    | `dns.diagnostics.title` | `diagnostics.dns_records` |
    | `dns.diagnostics.propagationNotice` | `diagnostics.dns_records_24hours` |
    | `dns.diagnostics.columns.name` | `diagnostics.dns_records_name` |
    | `dns.diagnostics.columns.type` | `diagnostics.dns_records_type` |
    | `dns.diagnostics.messages.matchedByAddressRecords` | `diagnostics.cname_from_a` |
    | `dns.diagnostics.optionalExplanation` | `diagnostics.optional` |

  - **Locale gaps found at the baseline**:
    - `sk-sk` lacks `admin.copy_to_clipboard` and every `edit.mta_sts*` key;
    - `cs-cz` lacks `edit.mta_sts_active_info`.

    The app layer of that locale supplies them (UI 001 R15).
  - **Reused with markup stripped** (UI 002 D27's `{ "from": …, "stripMarkup": true }` form):
    `dns.mtaSts.explanation` from `edit.mta_sts_info`, and `dns.mtaSts.fields.versionHelp` from
    `edit.mta_sts_version_info`. `sk-sk` lacks both, so its app layer supplies them.
  - **Not reusable**:
    - `edit.mta_sts_mode_info` contains one HTML list for all three modes, while FR-047 shows each
      mode's explanation next to it. New keys `dns.mtaSts.modes.<mode>.description` carry the
      legacy wording, split per mode.
    - `edit.mta_sts_max_age_info` says "in seconds", which units make wrong.
    - `diagnostics.dns_records_data` ("Correct Data") and `diagnostics.dns_records_status`
      ("Current State") change meaning (spec Assumptions).
    - `diagnostics.allow` exists only in the FeldHost fork, not upstream, so it is a new key.
  - **Enumerations** (T004):
    - **Fully required** (every value needs a key, UI 002 D2), added to `scripts/i18n/check.mjs`:
      `DkimKeyState`, `DkimKeyKind`, `DkimKeyDetails.missingParts`, `DkimDnsPublicationStatus`,
      `DkimDnsPublicationReasonCode`, `DnsCheckStatus`, `DnsCheckMessageCode`, `DnsCheck.scope`
      and `MtaStsMode`. `BulkItemOutcome` is already fully required by UI 002.
    - **Growing shared enumerations**: this feature appends its values to `src/i18n/coverage.json`
      (UI 002 D2):
      - `AuditEventType`: the eight `dkim*` and `mtaSts*` values;
      - `AuditTarget.type`: `dkimKey` and `mtaStsPolicy`;
      - `ValidationRuleCode`: `invalidPrivateKey`, `encryptedPrivateKey`, `unsupportedKeyType`,
        `keyLengthOutOfRange` and `sameAsSource`;
      - `problemTypes`: `dkim-key-exists`, `dkim-private-key-export-disabled`,
        `dkim-dns-publication-disabled` and `mta-sts-policy-exists`, plus `temporary-failure` if
        UI 002 did not add it.
    - **Formats**: `dkimSelector`, `domainName` and `mxHost` are added to the required
      `validation.format.*` set, unless UI 002 or UI 004 already added them.
- **Rationale**: Constitution IV. Every mapped legacy value is plain text with unchanged meaning.
  The verification against the baseline files was done during planning.
- **Alternatives considered**: Mapping the HTML keys after stripping markup in the import script:
  rejected. UI 001 R15 refuses HTML on purpose, and the mode texts must be split anyway.

### R23. Accessibility specifics

- **Decision**, in addition to UI 001 R21:
  - **Lists**:
    - tables with `<th scope="col">` and `aria-sort` on sortable headers;
    - each card an `<li>` with the name, or the check's purpose, as an `<h3>` (FR-083);
    - the result count (`n entries`) announced politely after a search or filter.
  - **Selection mode**:
    - a "Select" toggle;
    - checkboxes labelled "Select example.org";
    - "Select all on this page";
    - a sticky action bar ("3 selected") at the bottom on phones with `scroll-padding-bottom`
      equal to its height, so focused cards are never hidden (WCAG 2.4.11, FR-080).
  - **Badges** for state, status, optional, publication and incomplete show icon plus text. Icons
    are `aria-hidden`.
  - **Copy buttons** have names with what and of which name (FR-086).
  - **Form focus**: opening a form moves focus to its heading. A failed submission focuses the
    error summary (FR-085).
  - **Dialogs** (generation, deletion, replacement, export, run): Reka `Dialog` or `AlertDialog`,
    labelled. They do not close with Escape while busy, and they return focus to the trigger.
  - **Highlighted `_mta-sts` record**: its region is an `aria-describedby` target, and a visible
    text label says "Update this record".
  - **Countdowns** (rate limit, temporary failure) are announced once at the start and once when
    over (FR-084).
  - **Outcome messages** (save, generation, deletion, import, copy and publication results) are
    inline alerts (TailAdmin `alert`) next to the affected content. They stay until the user
    dismisses them or the next outcome replaces them, and they never time out, so none can
    disappear while it has focus or is hovered (FR-074). Each is also announced through
    `useAnnouncer`.
  - **Sticky actions** (FR-080): below `md`, the generation, replacement and run dialogs, the
    import and copy pages, and UI 002's full-screen section form for MTA-STS keep their primary and
    cancel actions in a footer that stays visible while the content scrolls. The footer's height is
    added to `scroll-padding-bottom`.
- **Rationale**: These are FR-079 to FR-086 made concrete for the new components.
- **Alternatives considered**: None.

### R24. Mock API additions

- **Decision**:
  - **Handlers**, one file per contract module, typed with `openapi-msw` and wrapped by the
    validator (UI 001 R22):
    - `tests/mocks/handlers/dkim.ts`: the eight DKIM operations, bulk deletion and
      `getDnsCapabilities`;
    - `tests/mocks/handlers/mta-sts.ts`;
    - `tests/mocks/handlers/dns-diagnostics.ts`.
  - **Scenario area** `tests/mocks/scenarios/dns.ts`. Its state:
    - DKIM entries per name: kind, target, selector, public key, private key PEM and etag;
    - the capabilities configuration;
    - policies;
    - diagnostics templates per name;
    - rate-limit counters per caller;
    - injections: publication outcome per operation, `503` per operation, concurrent changes
      through `PATCH /__mock/scenarios/:id`, a response delay for diagnostics, and export or
      publication toggled at runtime.
  - **Factories**:
    - `dkim-key.ts` builds real RSA public keys and PEMs with `node:crypto` (`generateKeyPairSync`,
      memoised per size, so 4,096-bit keys are generated once per process). The record value and
      pieces are derived exactly as the API documents (FR-007).
    - `mta-sts-policy.ts` builds `policyId` as `YYYYMMDDhhmmss`, always greater than the previous
      one; `policyText`; `policyUrl`; and `dnsRecords`.
    - `dns-diagnostics.ts` builds checks for every status, the optional flag, every message code
      with valid params, consistent `summary` counts and a zone file.
    - `dkim-publication.ts`.
  - **Import validation in the mock**: `node:crypto.createPrivateKey` decides `invalidPrivateKey`,
    `encryptedPrivateKey` (passphrase required), `unsupportedKeyType` (non-RSA) and
    `keyLengthOutOfRange` (`asymmetricKeyDetails.modulusLength`). The byte size is checked first,
    giving `tooLong`, `unit: bytes`. The mock never echoes the text.
  - **Rate limiting in the mock**: 10 runs per minute per scenario caller. Every result carries
    `RateLimit-*` and `Cache-Control: no-store`, and a `429` carries `Retry-After`. The window
    follows the mock server's clock, and `PATCH /__mock` can set the remaining count, because
    `page.clock` does not move the server's clock (UI 001 T066).
  - **Contract limits**: closed enumerations (`DnsCheckMessageCode`, `DkimDnsPublicationReasonCode`,
    `DkimKeyState`…) cannot carry unknown values in mocked responses. Their fallbacks are
    unit-tested. `DnsCheck.id` is a pattern, so an unknown identifier such as `caa` is mocked in an
    end-to-end test.
- **Rationale**: These follow UI 001 R22. Real keys make record values and import rules realistic,
  and the validator guarantees contract-valid data.
- **Alternatives considered**: Static PEM fixtures: rejected. 8,192-bit and encrypted variants
  are easier to generate than to maintain.

### R25. End-to-end and smoke coverage

- **Decision**:
  - **End-to-end**: specs in `tests/e2e/dns/`, one per story area (tasks.md). Each title carries
    its spec ID (`US3-AS7 …`, `FR-066 …`, `Edge: …`). Every acceptance scenario of US1–US8 has at
    least one test on `mobile-chromium` and `desktop-chromium` (and `mobile-webkit`), with
    `expectAccessible` on every screen and state, `expectNoHorizontalScroll` and
    `expectTouchTargets`.
  - **Downloads** are asserted with Playwright's `download` event (`suggestedFilename`, content
    compared with the mock's zone file or key).
  - **Clipboard**: Chromium projects grant `clipboard-read`/`clipboard-write` and compare
    `navigator.clipboard.readText()`. WebKit asserts the announcement only. The refusal path
    stubs `writeText` to reject.
  - **Smoke** (`tests/smoke/dns-*.smoke.spec.ts`), against the API dev stack whose seeder creates
    `example.org` (key), `example.net` (no key), the alias domain `example.com` → `example.org`,
    the unused key `old.example`, and `reseller` managing `example.org` and `example.net`
    (API 010 quickstart):
    - **read-only** (tagged `@read-only`): the list states; the `example.org` record matching
      `GET /api/v2/dkim-keys/example.org`; a diagnostics run whose downloaded zone file equals the
      API's `zoneFile`; export absent with the "turned off" note (default setting);
    - **writing, idempotent**:
      - generate for `example.net`, then delete it;
      - import a generated 2,048-bit key for `import.example`, then delete it;
      - copy `example.org` to `example.net`, then bulk-delete `example.net` and `import.example`;
      - replace `example.org`'s key;
      - create or edit `example.net`'s policy and check the identifier notice;
      - `reseller` sees only their names and no administrator actions.
- **Rationale**: These are constitution VI's layers, and UI 001 R24 and R25 applied.
- **Alternatives considered**: None.

### R26. Performance and dependencies

- **Decision**:
  - No dependency is added. The browser URL parser does IDN conversion, `Blob` does downloads,
    `Intl` does units and lists, and `node:crypto` is used in mocks only.
  - Every page is a lazy route chunk. The sections that UI 002 and 004 mount are async components.
  - `lighthouserc.cjs` and `scripts/run-lhci.mjs` gain a collection for `/ng/dns/dkim-keys`, with
    an administrator scenario of 600 entries (SC-013).
  - `budget:check` must stay under 204,800 bytes for the initial JS.
- **Rationale**: Constitution VII and VIII.
- **Alternatives considered**: None.

### R27. Security of rendered data

- **Decision**:
  - DNS values, policy texts, zone files, record values and publication details are rendered with
    text interpolation only. No `v-html` exists in the feature (ESLint enforces it).
  - The policy address and guidance URLs are links only through `safeHref`, with `target="_blank"
    rel="noopener noreferrer"` (FR-078).
  - Problem `detail`, `errors[].message` and `DnsCheckMessage.message` are never shown as the
    primary message. Only an unknown message code shows `message`, labelled and marked `lang="en"`
    (R15).
  - Private keys are never logged, and the app has no client error reporting that could carry
    them (R11, R12).
- **Rationale**: DNS content is third-party controlled (spec edge case), and constitution V
  applies.
- **Alternatives considered**: None.
